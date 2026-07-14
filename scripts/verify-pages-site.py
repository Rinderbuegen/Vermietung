#!/usr/bin/env python3
"""Verify both independently deployable GitHub Pages app scopes."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

from verify_frontend_modules import module_graph


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
SCOPES = ("DGH", "Gemeindehaus")
BUILDING_IDS = {"DGH": "dgh_rb", "Gemeindehaus": "ev_gem_rb"}
FORBIDDEN_FINAL_TEXT = ("DEPLOYMENT_ID", "dgh-rb", "ev-gem-rb")
CLASSIC_JAVASCRIPT_TYPES = {"", "text/javascript", "application/javascript"}


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


class ScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.scripts: list[dict[str, str | None]] = []
        self.elements: list[dict] = []
        self.current_script: dict | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script":
            values = dict(attrs)
            self.scripts.append(values)
            self.current_script = {"tag": "script", "attrs": values, "content": ""}
            self.elements.append(self.current_script)
        elif tag == "link":
            self.elements.append({"tag": "link", "attrs": dict(attrs), "content": ""})

    def handle_data(self, data: str) -> None:
        if self.current_script is not None:
            self.current_script["content"] += data

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.current_script = None


def assert_executable_classic_script(attrs: dict[str, str | None], label: str) -> None:
    script_type = (attrs.get("type") or "").strip().lower()
    assert script_type in CLASSIC_JAVASCRIPT_TYPES, f"{label} muss einen klassischen JavaScript-Typ verwenden"
    forbidden = [name for name in ("async", "defer", "nomodule") if name in attrs]
    assert not forbidden, f"{label} darf {', '.join(forbidden)} nicht verwenden"


def verify_frontend(target: Path, index_html: str) -> frozenset[Path]:
    parser = ScriptParser()
    parser.feed(index_html)
    module_scripts = [script for script in parser.scripts if (script.get("type") or "").lower() == "module"]
    assert len(module_scripts) == 1, "Es muss genau einen type=module-Einstieg geben"
    assert module_scripts[0].get("src") == "assets/js/main.js", "Moduleinstieg muss assets/js/main.js sein"
    frontend_scripts = [script for script in parser.scripts if (script.get("src") or "").startswith("assets/js/")]
    assert frontend_scripts == module_scripts, "Alte Frontend-Script-Tags sind nicht erlaubt"
    config_scripts = [script for script in parser.scripts if script.get("src") == "config/config.js"]
    assert len(config_scripts) == 1, "config/config.js muss genau einmal geladen werden"
    assert_executable_classic_script(config_scripts[0], "config/config.js")

    config_element = next(element for element in parser.elements if element["tag"] == "script" and element["attrs"] is config_scripts[0])
    theme_elements = [
        element for element in parser.elements
        if element["tag"] == "script" and not element["attrs"].get("src")
        and "window.APP_CONFIG" in element["content"] and ".theme" in element["content"]
    ]
    assert len(theme_elements) == 1, "Genau ein synchrones Theme-Inline-Skript ist erforderlich"
    assert_executable_classic_script(theme_elements[0]["attrs"], "Theme-Inline-Skript")
    css_elements = [
        element for element in parser.elements
        if element["tag"] == "link" and element["attrs"].get("href") == "assets/css/app.css"
        and "stylesheet" in (element["attrs"].get("rel") or "").split()
    ]
    assert len(css_elements) == 1, "App-CSS muss genau einmal eingebunden sein"
    module_element = next(element for element in parser.elements if element["tag"] == "script" and element["attrs"] is module_scripts[0])
    positions = [parser.elements.index(element) for element in (config_element, theme_elements[0], css_elements[0], module_element)]
    assert positions == sorted(positions) and len(set(positions)) == 4, "Reihenfolge muss config -> Theme-Inline -> CSS -> module-main sein"
    return module_graph(target / "assets/js")


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
    index_html = (target / "index.html").read_text(encoding="utf-8")
    parser.feed(index_html)
    apple_icon = local_path(base_url, parser.links["apple-touch-icon"], target)
    assert apple_icon.is_file() and png_size(apple_icon) == (192, 192)
    graph = verify_frontend(target, index_html)

    about = json.loads((target / "assets/data/about.json").read_text(encoding="utf-8"))
    for item in about["items"]:
        assert local_path(base_url, item["url"], target).is_file(), f"About-Datei fehlt: {item['url']}"

    config = (target / "config/config.js").read_text(encoding="utf-8")
    assert BUILDING_IDS[scope] in config, f"{scope}: eigene Gebäude-ID fehlt"
    foreign = BUILDING_IDS["Gemeindehaus" if scope == "DGH" else "DGH"]
    assert foreign not in config, f"{scope}: fremde Gebäude-ID ausgeliefert"
    for index_name in ("news.json", "downloads.json", "about.json"):
        payload = json.loads((target / "assets/data" / index_name).read_text(encoding="utf-8"))
        assert all(item.get("buildingId") in ("*", BUILDING_IDS[scope]) for item in payload["items"]), f"{scope}: fremder Inhalt in {index_name}"
    assert not any(target.rglob("*.odt")), f"{scope}: ODT darf nicht veröffentlicht werden"
    worker = (target / "service-worker.js").read_text(encoding="utf-8")
    assert "__CACHE_HASH__" not in worker and "__STATIC_ASSETS__" not in worker
    assert foreign not in worker, f"{scope}: Service Worker enthält fremde ID"
    assets = json.loads(re.search(r"const STATIC_ASSETS = (\[.*?\]);", worker, re.S).group(1))
    for module in graph:
        asset = f"./assets/js/{module.as_posix()}"
        assert asset in assets, f"{scope}: Graphmodul fehlt im Precache: {asset}"
    digest = hashlib.sha256()
    for asset in assets:
        path = target / asset.removeprefix("./")
        assert path.is_file(), f"{scope}: Precache-Datei fehlt: {asset}"
        digest.update(asset.encode("utf-8") + b"\0" + path.read_bytes() + b"\0")
    cache_version = re.search(r'const CACHE_VERSION = "([a-f0-9]{12})";', worker).group(1)
    assert cache_version == digest.hexdigest()[:12], f"{scope}: Cache-Key entspricht nicht den Dateiinhalten"


def verify_service_worker_registration() -> None:
    root_html = (SITE / "index.html").read_text(encoding="utf-8")
    root_graph = verify_frontend(SITE, root_html)
    app_source = "\n".join((SITE / "assets/js" / module).read_text(encoding="utf-8") for module in sorted(root_graph))
    assert "service-worker.js" in app_source
    assert "registerServiceWorker" in app_source
    assert ".register(" in app_source
    assert ".unregister(" in app_source
    assert not (SITE / "service-worker.js").exists(), "Root darf keinen übergeordneten Service Worker ausliefern"
    root_config = (SITE / "config/config.js").read_text(encoding="utf-8")
    assert '"registerServiceWorker": false' in root_config
    for scope in SCOPES:
        scope_config = (SITE / scope / "config/config.js").read_text(encoding="utf-8")
        assert '"registerServiceWorker": true' in scope_config


def verify_final_artifact() -> None:
    for scope in SCOPES:
        assert (SITE / scope / "index.html").is_file(), f"Finale Startseite fehlt: {scope}/index.html"

    for name in ("dgh-rb", "ev-gem-rb"):
        assert not (SITE / name).is_dir(), f"Veraltetes Verzeichnis vorhanden: {name}"
    assert not any(SITE.rglob("*.odt")), "ODT-Quelle im finalen Artefakt"

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
