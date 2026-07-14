#!/usr/bin/env python3
"""Unit tests for the static frontend module graph verifier."""

from __future__ import annotations

import importlib.util
import tempfile
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from scripts.verify_frontend_modules import ModuleGraphError, module_graph

pages_spec = importlib.util.spec_from_file_location("verify_pages_site_test", ROOT / "scripts/verify-pages-site.py")
pages_verifier = importlib.util.module_from_spec(pages_spec)
pages_spec.loader.exec_module(pages_verifier)


def write(root: Path, name: str, source: str) -> None:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source, encoding="utf-8")


def rejected(root: Path, expected: str) -> None:
    try:
        module_graph(root)
    except ModuleGraphError as error:
        assert expected in str(error), error
        return
    raise AssertionError(f"Modulgraph hätte abgelehnt werden müssen: {expected}")


with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    write(root, "main.js", 'import "./feature.js";\n// statischer Einstieg\n')
    write(root, "feature.js", 'export { value } from "./nested/value.js";\n')
    write(root, "nested/value.js", "export const value = 1;\n")
    assert {path.as_posix() for path in module_graph(root)} == {"main.js", "feature.js", "nested/value.js"}

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    write(root, "main.js", 'import("./feature.js");\n')
    rejected(root, "dynamischer Import")

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    write(root, "main.js", 'const lazy = `prefix ${import("./feature.js")} suffix`;\n')
    rejected(root, "dynamischer Import")

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    write(root, "main.js", 'const value = "ok";\nconst text = `Normaler Inhalt ${value} ${loader.load("./method.js")}`;\n')
    assert {path.as_posix() for path in module_graph(root)} == {"main.js"}

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    write(root, "main.js", 'const blocked = `${/[}]/.test(x) && import("https://evil")}`;\n')
    rejected(root, "dynamischer Import")

for source in ('const text = "import(\'./lazy.js\')";\n', '// import("./lazy.js")\nexport {};\n'):
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        write(root, "main.js", source)
        rejected(root, "dynamischer Import")

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    write(root, "main.js", 'import "package";\n')
    rejected(root, "nur relative Imports")

with tempfile.TemporaryDirectory() as temp:
    base = Path(temp)
    root = base / "assets/js"
    write(root, "main.js", 'import "../outside.js";\n')
    write(base / "assets", "outside.js", "export {};\n")
    rejected(root, "verlässt assets/js")

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    write(root, "main.js", "export {};\n")
    write(root, "orphan.js", "export {};\n")
    rejected(root, "Nicht vom Moduleinstieg erreichbar")

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    write(root, "main.js", 'import "./feature.js";\n')
    write(root, "Feature.js", "export {};\n")
    rejected(root, "Groß-/Kleinschreibung")


def html_document(config_attrs: str = "", theme_attrs: str = "") -> str:
    return f'''<!doctype html><html><head>
      <script src="config/config.js"{config_attrs}></script>
      <script{theme_attrs}>const config = window.APP_CONFIG; const theme = config.theme;</script>
      <link rel="stylesheet" href="assets/css/app.css">
    </head><body><script type="module" src="assets/js/main.js"></script></body></html>'''


def rejected_document(target: Path, html: str, expected: str) -> None:
    try:
        pages_verifier.verify_frontend(target, html)
    except AssertionError as error:
        assert expected in str(error), error
        return
    raise AssertionError(f"HTML-Vertrag hätte abgelehnt werden müssen: {expected}")


with tempfile.TemporaryDirectory() as temp:
    target = Path(temp)
    write(target / "assets/js", "main.js", "export {};\n")
    assert pages_verifier.verify_frontend(target, html_document()) == frozenset({Path("main.js")})
    assert pages_verifier.verify_frontend(
        target,
        html_document(' type="text/javascript"', ' type="application/javascript"'),
    ) == frozenset({Path("main.js")})
    for attribute in (" async", " defer", " nomodule"):
        rejected_document(target, html_document(config_attrs=attribute), attribute.strip())
        rejected_document(target, html_document(theme_attrs=attribute), attribute.strip())
    rejected_document(target, html_document(config_attrs=' type="text/plain"'), "klassischen JavaScript-Typ")
    rejected_document(target, html_document(theme_attrs=' type="application/json"'), "klassischen JavaScript-Typ")

print("Frontend-Modulgraph und HTML-Skriptausführung geprüft.")
