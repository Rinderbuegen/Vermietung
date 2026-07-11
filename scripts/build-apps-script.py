#!/usr/bin/env python3
"""Erzeugt direkt deploybare Apps-Script-Dateien aus Code und Betreiberwerten."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
backend = ROOT / "betreiber/allgemein/backend"
config = json.loads((backend / "konfiguration.json").read_text(encoding="utf-8"))
texts = json.loads((backend / "texte.json").read_text(encoding="utf-8"))
template = (ROOT / "apps-script/buchungs-api/Code.template.gs").read_text(encoding="utf-8")
code = template.replace('"__BACKEND_CONFIG__"', json.dumps(config, ensure_ascii=False, indent=2))
code = code.replace('"__BACKEND_TEXTS__"', json.dumps(texts, ensure_ascii=False, indent=2))
(ROOT / "apps-script/buchungs-api/Code.gs").write_text(code, encoding="utf-8")
print("Deploybare Apps-Script-Dateien erzeugt.")
