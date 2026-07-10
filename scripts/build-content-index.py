#!/usr/bin/env python3
"""Build static content indexes for GitHub Pages.

No external dependencies. Scans:
- downloads/<buildingId>/**/*.pdf
- downloads/common/**/*.pdf
- downloads/*.pdf
- news/<buildingId>/**/*.md
- news/common/**/*.md
- news/*.md

PDF metadata is read from the PDF Info dictionary when present. Markdown
metadata is read from a simple YAML-like frontmatter block.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS_DIR = ROOT / "downloads"
NEWS_DIR = ROOT / "news"
DATA_DIR = ROOT / "assets" / "data"


def posix(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def iso_mtime(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat().replace("+00:00", "Z")


def decode_pdf_string(raw: bytes) -> str:
    if raw.startswith(b"\xfe\xff"):
      try:
          return raw[2:].decode("utf-16-be", errors="ignore").strip()
      except UnicodeError:
          pass
    text = raw.decode("latin-1", errors="ignore")
    text = text.replace("\\(", "(").replace("\\)", ")").replace("\\\\", "\\")
    return text.strip()


def pdf_info_value(data: bytes, key: str) -> str:
    match = re.search(rb"/" + key.encode("ascii") + rb"\s*\((.*?)\)", data, re.S)
    if not match:
        return ""
    return decode_pdf_string(match.group(1))


def pdf_date_value(data: bytes) -> str:
    raw = pdf_info_value(data, "ModDate") or pdf_info_value(data, "CreationDate")
    match = re.search(r"D:(\d{4})(\d{2})(\d{2})", raw)
    if not match:
        return ""
    return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"


def building_id_for(path: Path, base: Path) -> str:
    rel = path.relative_to(base)
    if len(rel.parts) <= 1:
        return "*"
    first = rel.parts[0]
    return "*" if first == "common" else first


def scan_downloads() -> list[dict]:
    items: list[dict] = []
    if not DOWNLOADS_DIR.exists():
        return items
    for path in sorted(DOWNLOADS_DIR.rglob("*.pdf")):
        if path.parent == DOWNLOADS_DIR:
            continue
        data = path.read_bytes()
        title = pdf_info_value(data, "Title") or path.stem.replace("-", " ").replace("_", " ")
        description = pdf_info_value(data, "Subject") or pdf_info_value(data, "Keywords")
        items.append({
            "buildingId": building_id_for(path, DOWNLOADS_DIR),
            "title": title,
            "description": description,
            "url": posix(path),
            "date": pdf_date_value(data),
            "updatedAt": iso_mtime(path),
        })
    return items


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    raw_meta = text[4:end].strip()
    body = text[end + 4:].lstrip("\r\n")
    meta: dict[str, object] = {}
    for line in raw_meta.splitlines():
        if not line.strip() or line.strip().startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        value = value.strip().strip('"').strip("'")
        if value.lower() in {"true", "false"}:
            meta[key.strip()] = value.lower() == "true"
        else:
            meta[key.strip()] = value
    return meta, body


def scan_news() -> list[dict]:
    items: list[dict] = []
    if not NEWS_DIR.exists():
        return items
    for path in sorted(NEWS_DIR.rglob("*.md")):
        if path.parent == NEWS_DIR:
            continue
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        building_id = str(meta.get("building_id") or meta.get("buildingId") or building_id_for(path, NEWS_DIR))
        active = meta.get("active", True)
        items.append({
            "buildingId": building_id,
            "date": str(meta.get("date") or ""),
            "title": str(meta.get("title") or path.stem.replace("-", " ").replace("_", " ")),
            "body": body.strip(),
            "type": str(meta.get("type") or "info"),
            "active": bool(active),
            "validFrom": str(meta.get("valid_from") or meta.get("validFrom") or ""),
            "validUntil": str(meta.get("valid_until") or meta.get("validUntil") or ""),
            "sortOrder": str(meta.get("sort_order") or meta.get("sortOrder") or "999"),
            "url": posix(path),
            "updatedAt": iso_mtime(path),
        })
    return items


def write_json(name: str, items: list[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "items": items,
    }
    (DATA_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    write_json("downloads.json", scan_downloads())
    write_json("news.json", scan_news())
    print("Content indexes written to assets/data")


if __name__ == "__main__":
    main()
