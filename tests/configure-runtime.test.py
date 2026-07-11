#!/usr/bin/env python3
"""Prüft Runtime-Injektion für erzeugte und kompakte JS-Notation."""

import importlib.util
import hashlib
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("configure_runtime", ROOT / "scripts/configure-runtime.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
url = "https://script.google.com/macros/s/TEST_ID/exec"
for source in ('{"apiBaseUrl": "alt"}', "{apiBaseUrl:'alt'}", '{ apiBaseUrl : "alt" }'):
    result, count = module.API_BASE_URL_PATTERN.subn(lambda match: match.group(1) + url + match.group(2), source, count=1)
    assert count == 1 and url in result
assert module.validate_apps_script_url(url) == url
with tempfile.TemporaryDirectory() as temp:
    scope = Path(temp)
    config = scope / "config/config.js"
    config.parent.mkdir()
    config.write_text("inhalt", encoding="utf-8")
    asset = "./config/config.js"
    worker = scope / "service-worker.js"
    worker.write_text('const CACHE_VERSION = "000000000000";\nconst STATIC_ASSETS = ' + json.dumps([asset]) + ";\n", encoding="utf-8")
    module.refresh_service_worker(scope)
    digest = hashlib.sha256(asset.encode("utf-8") + b"\0" + config.read_bytes() + b"\0").hexdigest()[:12]
    assert f'CACHE_VERSION = "{digest}"' in worker.read_text(encoding="utf-8")
print("Runtime-Injektion geprüft: quoted und unquoted apiBaseUrl.")
