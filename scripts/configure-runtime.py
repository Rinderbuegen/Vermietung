#!/usr/bin/env python3
"""Set public runtime values before a GitHub Pages deployment."""

from __future__ import annotations

import sys
import re
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_FILE = ROOT / "betreiber" / "allgemein" / "konfiguration" / "frontend.json"
PLACEHOLDER_URL = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
API_BASE_URL_PATTERN = re.compile(r'((?:["\']apiBaseUrl["\']|apiBaseUrl)\s*:\s*["\'])[^"\']+(["\'])')
STATIC_ASSETS_PATTERN = re.compile(r"const STATIC_ASSETS = (\[.*?\]);", re.S)
CACHE_VERSION_PATTERN = re.compile(r'(const CACHE_VERSION = ")[a-f0-9]{12}(";)')


def validate_apps_script_url(value: str) -> str:
    url = value.strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "script.google.com":
        raise ValueError("APPS_SCRIPT_WEB_APP_URL muss mit https://script.google.com/ beginnen.")
    if not parsed.path.startswith("/macros/s/") or not parsed.path.endswith("/exec"):
        raise ValueError("APPS_SCRIPT_WEB_APP_URL muss die Web-App-URL mit /macros/s/.../exec sein.")
    return url


def refresh_service_worker(scope_dir: Path) -> None:
    worker = scope_dir / "service-worker.js"
    if not worker.is_file():
        return
    source = worker.read_text(encoding="utf-8")
    match = STATIC_ASSETS_PATTERN.search(source)
    if not match:
        raise SystemExit(f"STATIC_ASSETS nicht gefunden: {worker}")
    digest = hashlib.sha256()
    for asset in json.loads(match.group(1)):
        path = scope_dir / asset.removeprefix("./")
        if not path.is_file():
            raise SystemExit(f"Precache-Datei fehlt: {path}")
        digest.update(asset.encode("utf-8") + b"\0" + path.read_bytes() + b"\0")
    updated, count = CACHE_VERSION_PATTERN.subn(lambda item: item.group(1) + digest.hexdigest()[:12] + item.group(2), source, count=1)
    if count != 1:
        raise SystemExit(f"CACHE_VERSION nicht gefunden: {worker}")
    worker.write_text(updated, encoding="utf-8")


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Usage: configure-runtime.py <APPS_SCRIPT_WEB_APP_URL> [target-dir]")

    apps_script_url = validate_apps_script_url(sys.argv[1])
    if len(sys.argv) == 3:
        target_dir = (ROOT / sys.argv[2]).resolve()
        config_files = sorted(target_dir.rglob("config/config.js"))
    else:
        config_files = [DEFAULT_CONFIG_FILE]

    if not config_files:
        raise SystemExit("Keine Laufzeitkonfiguration gefunden.")

    for config_file in config_files:
        content = config_file.read_text(encoding="utf-8")
        if PLACEHOLDER_URL in content:
            updated = content.replace(PLACEHOLDER_URL, apps_script_url)
        else:
            updated, count = API_BASE_URL_PATTERN.subn(lambda match: match.group(1) + apps_script_url + match.group(2), content, count=1)
            if count != 1:
                raise SystemExit(f"apiBaseUrl nicht gefunden: {config_file}")
        config_file.write_text(updated, encoding="utf-8")
        refresh_service_worker(config_file.parent.parent)


if __name__ == "__main__":
    main()
