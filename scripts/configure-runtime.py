#!/usr/bin/env python3
"""Set public runtime values before a GitHub Pages deployment."""

from __future__ import annotations

import sys
import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_FILE = ROOT / "assets" / "js" / "config.js"
PLACEHOLDER_URL = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
API_BASE_URL_PATTERN = re.compile(r'(apiBaseUrl:\s*")[^"]+(")')


def validate_apps_script_url(value: str) -> str:
    url = value.strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "script.google.com":
        raise ValueError("APPS_SCRIPT_WEB_APP_URL muss mit https://script.google.com/ beginnen.")
    if not parsed.path.startswith("/macros/s/") or not parsed.path.endswith("/exec"):
        raise ValueError("APPS_SCRIPT_WEB_APP_URL muss die Web-App-URL mit /macros/s/.../exec sein.")
    return url


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Usage: configure-runtime.py <APPS_SCRIPT_WEB_APP_URL> [target-dir]")

    apps_script_url = validate_apps_script_url(sys.argv[1])
    if len(sys.argv) == 3:
        target_dir = (ROOT / sys.argv[2]).resolve()
        config_files = sorted(target_dir.rglob("assets/js/config.js"))
    else:
        config_files = [DEFAULT_CONFIG_FILE]

    if not config_files:
        raise SystemExit("Keine assets/js/config.js gefunden.")

    for config_file in config_files:
        content = config_file.read_text(encoding="utf-8")
        if PLACEHOLDER_URL in content:
            updated = content.replace(PLACEHOLDER_URL, apps_script_url)
        else:
            updated, count = API_BASE_URL_PATTERN.subn(rf"\g<1>{apps_script_url}\2", content, count=1)
            if count != 1:
                raise SystemExit(f"apiBaseUrl nicht gefunden: {config_file}")
        config_file.write_text(updated, encoding="utf-8")


if __name__ == "__main__":
    main()
