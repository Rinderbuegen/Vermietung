#!/usr/bin/env python3
"""Verify both independently deployable GitHub Pages app scopes."""

from __future__ import annotations

import argparse
import json
import struct
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
SCOPES = ("DGH", "Gemeindehaus")
FORBIDDEN_FINAL_TEXT = ("DEPLOYMENT_ID", "dgh-rb", "ev-gem-rb")


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "link":
            return
        values = dict(attrs)
        if values.get("rel") and values.get("href"):
            self.links[values["rel"]] = values["href"]


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"Kein PNG: {path}"
    return struct.unpack(">II", data[16:24])


def local_path(base_url: str, relative_url: str, target: Path) -> Path:
    resolved = urljoin(base_url, relative_url)
    parsed = urlparse(resolved)
    scope_path = urlparse(base_url).path
    assert parsed.scheme == "https" and parsed.netloc == "example.test"
    assert parsed.path.startswith(scope_path), f"URL verlässt Scope: {relative_url}"
    return target / parsed.path.removeprefix(scope_path)


def verify_scope(scope: str) -> None:
    target = SITE / scope
    base_url = f"https://example.test/Vermietung/{scope}/"
    required = ("index.html", "manifest.webmanifest", "service-worker.js")
    for name in required:
        assert (target / name).is_file(), f"Fehlt in {scope}: {name}"

    manifest = json.loads((target / "manifest.webmanifest").read_text(encoding="utf-8"))
    for key in ("id", "start_url", "scope"):
        assert manifest[key] == "./", f"{scope}: {key} muss relativ sein"
        assert urljoin(base_url, manifest[key]) == base_url

    icon_specs = {
        "192x192": (192, 192),
        "512x512": (512, 512),
    }
    has_maskable = False
    has_svg = False
    for icon in manifest["icons"]:
        path = local_path(base_url, icon["src"], target)
        assert path.is_file(), f"Manifest-Datei fehlt: {path}"
        if icon["type"] == "image/png":
            assert png_size(path) == icon_specs[icon["sizes"]]
        has_maskable |= icon.get("purpose") == "maskable" and icon["sizes"] == "512x512"
        has_svg |= icon["type"] == "image/svg+xml" and icon["sizes"] == "any"
    assert has_maskable and has_svg, f"{scope}: Maskable- oder SVG-Icon fehlt"

    parser = LinkParser()
    parser.feed((target / "index.html").read_text(encoding="utf-8"))
    apple_icon = local_path(base_url, parser.links["apple-touch-icon"], target)
    assert apple_icon.is_file() and png_size(apple_icon) == (192, 192)

    about = json.loads((target / "assets/data/about.json").read_text(encoding="utf-8"))
    for item in about["items"]:
        assert local_path(base_url, item["url"], target).is_file(), f"About-Datei fehlt: {item['url']}"


def verify_service_worker_registration() -> None:
    app_source = (SITE / "assets/js/app.js").read_text(encoding="utf-8")
    assert 'PWA_BUILDING_PATHS = ["DGH", "Gemeindehaus"]' in app_source
    assert "PWA_BUILDING_PATHS.includes(segment)" in app_source
    assert "buildingPaths.length === 1" in app_source
    assert 'register(`${scope}service-worker.js`, { scope })' in app_source

    for path in ("/Vermietung/", "/Vermietung/DGH/", "/Vermietung/Gemeindehaus/"):
        segments = [segment for segment in path.split("/") if segment]
        matches = [segment for segment in segments if segment in SCOPES]
        expected = [] if path == "/Vermietung/" else [segments[-1]]
        assert matches == expected, f"Ungültige PWA-Pfadbindung: {path}"


def verify_final_artifact() -> None:
    for scope in SCOPES:
        assert (SITE / scope / "index.html").is_file(), f"Finale Startseite fehlt: {scope}/index.html"

    for name in ("dgh-rb", "ev-gem-rb"):
        assert not (SITE / name).is_dir(), f"Veraltetes Verzeichnis vorhanden: {name}"

    for path in SITE.rglob("*"):
        if not path.is_file():
            continue
        data = path.read_bytes()
        if b"\0" in data:
            continue
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if any(ord(char) < 32 and char not in "\t\n\r" for char in text):
            continue
        for forbidden in FORBIDDEN_FINAL_TEXT:
            assert forbidden not in text, f"Verbotener Text '{forbidden}' gefunden: {path.relative_to(SITE)}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Prüft das erzeugte GitHub-Pages-Artefakt.")
    parser.add_argument(
        "--final-artifact",
        action="store_true",
        help="verlangt ein vollständig konfiguriertes, von alten Pfaden bereinigtes Artefakt",
    )
    args = parser.parse_args()

    for scope in SCOPES:
        verify_scope(scope)
    verify_service_worker_registration()
    if args.final_artifact:
        verify_final_artifact()
    result = "eigenständig und final" if args.final_artifact else "eigenständig"
    print(f"Pages-Artefakt geprüft: DGH und Gemeindehaus sind {result}.")


if __name__ == "__main__":
    main()
