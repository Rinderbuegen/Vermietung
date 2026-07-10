#!/usr/bin/env python3
"""Build the GitHub Pages output directory with clean building URLs."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
TARGETS = [SITE, SITE / "DGH", SITE / "Gemeindehaus"]
FILES = ["index.html", "manifest.webmanifest", "service-worker.js"]
DIRS = ["assets", "downloads"]


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


def main() -> None:
    if SITE.exists():
        shutil.rmtree(SITE)
    for target in TARGETS:
        copy_app(target)
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    print("Pages site written to _site")


if __name__ == "__main__":
    main()
