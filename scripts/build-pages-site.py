#!/usr/bin/env python3
"""Build the GitHub Pages output directory with clean building URLs."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
TARGETS = [SITE, SITE / "DGH", SITE / "Gemeindehaus"]
FILES = ["index.html", "manifest.webmanifest", "service-worker.js"]
DIRS = ["assets", "config", "downloads", "about"]
PLACEHOLDER = "<!--BUILD_TIMESTAMP-->"


def get_last_commit_timestamp() -> str:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cI"],
            capture_output=True, text=True, cwd=ROOT, check=True
        )
        raw = result.stdout.strip()
        from datetime import datetime
        dt = datetime.fromisoformat(raw)
        return dt.strftime("%d.%m.%Y %H:%M")
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        return "unbekannt"


def copy_app(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        shutil.copy2(ROOT / name, target / name)
    for name in DIRS:
        source = ROOT / name
        destination = target / name
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(source, destination)


def inject_timestamp(target: Path, timestamp: str) -> None:
    index_file = target / "index.html"
    if index_file.exists():
        content = index_file.read_text(encoding="utf-8")
        content = content.replace(PLACEHOLDER, timestamp)
        index_file.write_text(content, encoding="utf-8")


def main() -> None:
    timestamp = get_last_commit_timestamp()
    if SITE.exists():
        shutil.rmtree(SITE)
    for target in TARGETS:
        copy_app(target)
        inject_timestamp(target, timestamp)
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Pages site written to _site (timestamp: {timestamp})")


if __name__ == "__main__":
    main()
