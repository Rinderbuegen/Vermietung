#!/usr/bin/env python3
"""Regressionsprüfungen für Betreiberstruktur und Scope-Build."""

import json
import importlib.util
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
registry = json.loads((ROOT / "betreiber/allgemein/konfiguration/registry.json").read_text(encoding="utf-8"))
assert set(registry["areas"]) == {"DGH", "EV_GEMEINDEHAUS"}
assert registry["areas"]["DGH"] == {"publicPath": "DGH", "buildingId": "dgh_rb"}
assert registry["areas"]["EV_GEMEINDEHAUS"] == {"publicPath": "Gemeindehaus", "buildingId": "ev_gem_rb"}
assert not list(SITE.rglob("*.odt"))
assert not list((ROOT / "assets/data").glob("*.json")), "assets/data darf keine gepflegte Quelle sein"
for area, entry in registry["areas"].items():
    scope = SITE / entry["publicPath"]
    own = entry["buildingId"]
    foreign = "ev_gem_rb" if own == "dgh_rb" else "dgh_rb"
    for name in ("news", "downloads", "about"):
        payload = json.loads((scope / f"assets/data/{name}.json").read_text(encoding="utf-8"))
        assert all(item.get("buildingId") in ("*", own) for item in payload["items"])
        assert foreign not in json.dumps(payload)
assert (SITE / "Gemeindehaus/downloads/Hausordnung.pdf").is_file()
assert not (SITE / "DGH/downloads/Hausordnung.pdf").exists()
root_config = (SITE / "config/config.js").read_text(encoding="utf-8")
assert '"buildingId": "dgh_rb"' in root_config and "ev_gem_rb" not in root_config
assert '"registerServiceWorker": false' in root_config
assert not (SITE / "service-worker.js").exists()
assert "{{" not in (SITE / "DGH/index.html").read_text(encoding="utf-8")
assert "Datenschutz" in (SITE / "DGH/index.html").read_text(encoding="utf-8")

pages_spec = importlib.util.spec_from_file_location("build_pages_site", ROOT / "scripts/build-pages-site.py")
pages = importlib.util.module_from_spec(pages_spec)
pages_spec.loader.exec_module(pages)
with tempfile.TemporaryDirectory() as temp:
    target = Path(temp)
    first = target / "a.txt"
    first.write_text("eins", encoding="utf-8")
    digest_one = pages.cache_digest(target, [first])
    first.write_text("zwei", encoding="utf-8")
    assert pages.cache_digest(target, [first]) != digest_one, "Cache-Key muss Dateiinhalte berücksichtigen"

content_spec = importlib.util.spec_from_file_location("build_content_index_test", ROOT / "scripts/build-content-index.py")
content = importlib.util.module_from_spec(content_spec)
content_spec.loader.exec_module(content)
with tempfile.TemporaryDirectory() as temp:
    operator_root = Path(temp)
    common = operator_root / "allgemein/downloads/oeffentlich/formulare"
    building = operator_root / "DGH/downloads/oeffentlich/formulare"
    common.mkdir(parents=True)
    building.mkdir(parents=True)
    registry_dir = operator_root / "allgemein/konfiguration"
    registry_dir.mkdir(parents=True)
    (registry_dir / "registry.json").write_text(json.dumps({"areas": {"DGH": {"buildingId": "dgh_rb"}}}), encoding="utf-8")
    (common / "Mietvertrag.pdf").write_bytes(b"%PDF allgemeine Fassung")
    (building / "Mietvertrag.pdf").write_bytes(b"%PDF Override")
    content.BETREIBER = operator_root
    merged = content.merged_files("DGH", Path("downloads/oeffentlich"), "*.pdf")
    assert len(merged) == 1 and merged[0][0] == building / "Mietvertrag.pdf"
    output = operator_root / "output"
    content.build("DGH", output)
    downloads = json.loads((output / "downloads.json").read_text(encoding="utf-8"))["items"]
    assert downloads[0]["id"] == "formulare/Mietvertrag.pdf"
    assert downloads[0]["url"] == "downloads/formulare/Mietvertrag.pdf"
print("Content-Build geprüft: Registry, Overrides, Scope-Isolation und ODT-Ausschluss.")
