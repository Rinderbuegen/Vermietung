#!/usr/bin/env python3
"""Prüft Runtime-Injektion für erzeugte und kompakte JS-Notation."""

import importlib.util
import hashlib
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("configure_runtime", ROOT / "scripts/configure-runtime.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
url = "https://script.google.com/macros/s/TEST_ID/exec"
for source in ('{"apiBaseUrl": "alt"}', "{apiBaseUrl:'alt'}", '{ apiBaseUrl : "alt" }'):
    result, count = module.API_BASE_URL_PATTERN.subn(lambda match: match.group(1) + json.dumps(url), source, count=1)
    assert count == 1 and json.dumps(url) in result
assert module.validate_apps_script_url(url) == url

invalid_urls = (
    "https://script.google.com/macros/s//exec",
    f"{url}?mode=test",
    f"{url}#fragment",
    f" {url}",
    "https://user@script.google.com/macros/s/TEST_ID/exec",
    "https://script.google.com/macros/s/TEST_ID/exec/extra",
    "https://script.google.com/macros/s/TEST_ID/unerwartet/exec",
    'https://script.google.com/macros/s/TEST_ID";globalThis.injected=true;//exec',
)
for invalid_url in invalid_urls:
    try:
        module.validate_apps_script_url(invalid_url)
    except ValueError:
        pass
    else:
        raise AssertionError(f"Ungültige URL akzeptiert: {invalid_url}")

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    scopes = (root, root / "DGH", root / "Gemeindehaus")
    sources = (
        f'window.APP_CONFIG = {{"apiBaseUrl": "{module.PLACEHOLDER_URL}"}};\n',
        "window.APP_CONFIG = {apiBaseUrl:'alt'};\n",
        'window.APP_CONFIG = { apiBaseUrl : "alt" };\n',
    )
    asset = "./config/config.js"
    for scope, source in zip(scopes, sources):
        config = scope / "config/config.js"
        config.parent.mkdir(parents=True)
        config.write_text(source, encoding="utf-8")
        worker = scope / "service-worker.js"
        worker.write_text('const CACHE_VERSION = "000000000000";\nconst STATIC_ASSETS = ' + json.dumps([asset]) + ";\n", encoding="utf-8")

    original_argv = sys.argv
    try:
        sys.argv = [str(ROOT / "scripts/configure-runtime.py"), url, str(root)]
        module.main()
    finally:
        sys.argv = original_argv

    for scope in scopes:
        config = scope / "config/config.js"
        content = config.read_text(encoding="utf-8")
        assert json.dumps(url) in content
        digest = hashlib.sha256(asset.encode("utf-8") + b"\0" + config.read_bytes() + b"\0").hexdigest()[:12]
        worker_content = (scope / "service-worker.js").read_text(encoding="utf-8")
        assert f'CACHE_VERSION = "{digest}"' in worker_content

print("Runtime-Injektion, URL-Validierung und Workerhash geprüft.")
