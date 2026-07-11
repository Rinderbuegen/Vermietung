#!/usr/bin/env python3
"""Baut Root und beide voneinander isolierten öffentlichen Gebäudescopes."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
BETREIBER = ROOT / "betreiber"
CONTENT_SPEC = importlib.util.spec_from_file_location("build_content_index", ROOT / "scripts/build-content-index.py")
CONTENT = importlib.util.module_from_spec(CONTENT_SPEC)
CONTENT_SPEC.loader.exec_module(CONTENT)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def merge(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        result[key] = merge(result.get(key, {}), value) if isinstance(value, dict) and isinstance(result.get(key), dict) else value
    return result


def timestamp() -> str:
    try:
        raw = subprocess.run(["git", "log", "-1", "--format=%cI"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        return datetime.fromisoformat(raw).strftime("%d.%m.%Y %H:%M")
    except (OSError, ValueError, subprocess.CalledProcessError):
        return "unbekannt"


def render_legal(markdown: str) -> str:
    articles = []
    title = None
    paragraphs = []
    for line in markdown.splitlines() + ["#"]:
        if line.startswith("# ") or line == "#":
            if title:
                body = "\n".join(paragraphs).strip().split("\n\n")
                rendered = "".join(f"<p>{part.replace('**', '<strong>', 1).replace('**', '</strong>', 1)}</p>" for part in body if part)
                articles.append(f'<article class="panel"><h2>{title}</h2>{rendered}</article>')
            title = line[2:] if line != "#" else None
            paragraphs = []
        else:
            paragraphs.append(line)
    return "".join(articles)


def replace_placeholders(template: str, values: dict) -> str:
    for key, value in values.items():
        template = template.replace("{{" + key + "}}", str(value))
    return template


def cache_digest(target: Path, asset_paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in asset_paths:
        asset = "./" + path.relative_to(target).as_posix()
        digest.update(asset.encode("utf-8") + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()[:12]


def build_scope(area: str, target: Path, registry: dict, enable_service_worker: bool = True) -> None:
    entry = registry["areas"][area]
    common = read_json(BETREIBER / "allgemein/konfiguration/frontend.json")
    config = merge(common, read_json(BETREIBER / area / "konfiguration/frontend.json"))
    config["buildingId"] = entry["buildingId"]
    config["registerServiceWorker"] = enable_service_worker
    texts = read_json(BETREIBER / "allgemein/texte/frontend.json")
    override = BETREIBER / area / "texte/frontend.json"
    if override.is_file():
        texts = merge(texts, read_json(override))
    config["texts"] = texts

    target.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / "assets/css", target / "assets/css")
    shutil.copytree(ROOT / "assets/js", target / "assets/js")
    shutil.copytree(BETREIBER / "allgemein/icons", target / "assets/icons", ignore=shutil.ignore_patterns("*.md"))
    (target / "config").mkdir()
    (target / "config/config.js").write_text("window.APP_CONFIG = " + json.dumps(config, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    html = (ROOT / "index.html").read_text(encoding="utf-8").replace("<!--BUILD_TIMESTAMP-->", timestamp())
    html = replace_placeholders(html, texts)
    html = html.replace("{{legalContent}}", render_legal((BETREIBER / "allgemein/texte/rechtliches.md").read_text(encoding="utf-8")))
    (target / "index.html").write_text(html, encoding="utf-8")
    manifest = dict(common["manifest"])
    manifest.update(config.get("manifest", {}))
    manifest.update({"id":"./", "start_url":"./", "scope":"./", "display":"standalone", "lang":"de-DE", "icons":[
        {"src":"./assets/icons/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},
        {"src":"./assets/icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},
        {"src":"./assets/icons/icon-512-maskable.png","sizes":"512x512","type":"image/png","purpose":"maskable"},
        {"src":"./assets/icons/icon.svg","sizes":"any","type":"image/svg+xml","purpose":"any"}]})
    (target / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CONTENT.build(area, target / "assets/data")
    for path, _ in CONTENT.merged_files(area, Path("downloads/oeffentlich"), "*.pdf"):
        base_name = area if path.is_relative_to(BETREIBER / area / "downloads/oeffentlich") else "allgemein"
        relative_path = path.relative_to(BETREIBER / base_name / "downloads/oeffentlich")
        destination = target / "downloads" / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
    about = BETREIBER / area / "texte/about.md"
    if about.is_file(): shutil.copy2(about, target / "about.md")
    for base in (BETREIBER / "allgemein/bilder/news", BETREIBER / area / "bilder/news"):
        if base.exists(): shutil.copytree(base, target / "assets/images/news", dirs_exist_ok=True)
    asset_paths = sorted(p for p in target.rglob("*") if p.is_file() and p.name != "service-worker.js")
    assets = ["./" + p.relative_to(target).as_posix() for p in asset_paths]
    if enable_service_worker:
        sw = (ROOT / "service-worker.js").read_text(encoding="utf-8").replace("__CACHE_HASH__", cache_digest(target, asset_paths)).replace("__STATIC_ASSETS__", json.dumps(assets, ensure_ascii=False, indent=2))
        (target / "service-worker.js").write_text(sw, encoding="utf-8")


def main() -> None:
    registry = read_json(BETREIBER / "allgemein/konfiguration/registry.json")
    if SITE.exists(): shutil.rmtree(SITE)
    for area, entry in registry["areas"].items(): build_scope(area, SITE / entry["publicPath"], registry)
    build_scope(registry["defaultArea"], SITE, registry, enable_service_worker=False)
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    print("Pages-Site mit isolierten Gebäudescopes erzeugt.")


if __name__ == "__main__": main()
