#!/usr/bin/env python3
"""Erzeugt die Inhaltsindizes eines isolierten Gebäudescopes."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BETREIBER = ROOT / "betreiber"


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end < 0:
        return {}, text
    meta = {}
    for line in text[4:end].splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split(":", 1)
        value = value.strip().strip('"\'')
        meta[key.strip()] = {"true": True, "false": False}.get(value.lower(), value)
    return meta, text[end + 4:].lstrip("\r\n")


def pdf_value(data: bytes, key: str) -> str:
    match = re.search(rb"/" + key.encode() + rb"\s*\((.*?)\)", data, re.S)
    return match.group(1).decode("latin-1", errors="ignore").strip() if match else ""


def merged_files(area: str, relative: Path, pattern: str) -> list[tuple[Path, bool]]:
    merged: dict[str, tuple[Path, bool]] = {}
    for name, specific in (("allgemein", False), (area, True)):
        base = BETREIBER / name / relative
        if base.exists():
            for path in sorted(base.rglob(pattern)):
                merged[path.relative_to(base).as_posix()] = (path, specific)
    return list(merged.values())


def build(area: str, output: Path) -> None:
    registry = json.loads((BETREIBER / "allgemein/konfiguration/registry.json").read_text(encoding="utf-8"))
    building_id = registry["areas"][area]["buildingId"]
    generated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    news = []
    for path, specific in merged_files(area, Path("news"), "*.md"):
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        news.append({
            "buildingId": building_id if specific else "*", "id": str(meta.get("id") or path.stem),
            "date": str(meta.get("date") or ""), "title": str(meta.get("title") or path.stem.replace("-", " ")),
            "body": body.strip(), "type": str(meta.get("type") or "info"), "active": meta.get("active", True),
            "validFrom": str(meta.get("valid_from") or ""), "validUntil": str(meta.get("valid_until") or ""),
            "sortOrder": str(meta.get("sort_order") or "999")
        })

    downloads = []
    for path, specific in merged_files(area, Path("downloads/oeffentlich"), "*.pdf"):
        source_base = BETREIBER / (area if specific else "allgemein") / "downloads/oeffentlich"
        relative_path = path.relative_to(source_base).as_posix()
        data = path.read_bytes()
        downloads.append({
            "buildingId": building_id if specific else "*", "id": relative_path,
            "title": pdf_value(data, "Title") or path.stem.replace("-", " ").replace("_", " "),
            "description": pdf_value(data, "Subject") or pdf_value(data, "Keywords"),
            "url": "downloads/" + relative_path,
            "updatedAt": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat().replace("+00:00", "Z")
        })

    about_source = BETREIBER / area / "texte/about.md"
    about = [{"buildingId": building_id, "url": "about.md"}] if about_source.is_file() else []
    output.mkdir(parents=True, exist_ok=True)
    for name, items in (("news.json", news), ("downloads.json", downloads), ("about.json", about)):
        (output / name).write_text(json.dumps({"generatedAt": generated, "items": items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("area", choices=("DGH", "EV_GEMEINDEHAUS"))
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.area, args.output)


if __name__ == "__main__":
    main()
