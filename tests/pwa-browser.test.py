#!/usr/bin/env python3
"""Chromium PWA regression test using the real generated service workers."""

from __future__ import annotations

import json
import threading
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    from playwright.sync_api import sync_playwright
except ImportError as error:
    raise SystemExit("Playwright fehlt. Installieren: python -m pip install playwright==1.61.0") from error


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
FIXED_NOW = 1784116800000
BUILDING_IDS = {"DGH": "dgh_rb", "Gemeindehaus": "ev_gem_rb"}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

    def send_body(self, body: str, content_type: str) -> None:
        encoded = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.endswith("/config/config.js") or parsed.path == "/config/config.js":
            parts = parsed.path.strip("/").split("/")
            scope = parts[0] if len(parts) > 2 else ""
            config_path = SITE / scope / "config/config.js" if scope else SITE / "config/config.js"
            payload = json.loads(config_path.read_text(encoding="utf-8").removeprefix("window.APP_CONFIG = ").rstrip(";\n"))
            payload["apiBaseUrl"] = f"http://{self.headers['Host']}/exec"
            self.send_body("window.APP_CONFIG = " + json.dumps(payload, ensure_ascii=False) + ";\n", "application/javascript")
            return
        if parsed.path == "/exec":
            query = parse_qs(parsed.query)
            action = query.get("action", [""])[0]
            building_id = query.get("buildingId", [""])[0]
            if action == "building":
                data = {
                    "name": f"PWA-Test {building_id}",
                    "operatorName": "PWA-Testbetrieb",
                    "contactEmail": "pwa@example.test",
                    "publicNote": "",
                }
            elif action == "occupancy":
                data = {
                    "schemaVersion": 2,
                    "loadedAt": "2026-07-15T12:00:00.000Z",
                    "items": [{
                        "date": "2026-07-18",
                        "from": "18:00",
                        "to": "20:00",
                        "allDay": False,
                        "status": "belegt",
                        "statusKey": "confirmed",
                        "publicTitle": f"PWA-Belegung {building_id}",
                        "publicOrganizer": "Testverein",
                    }],
                }
            else:
                data = {"items": []}
            self.send_body(json.dumps({"ok": True, "data": data}, ensure_ascii=False), "application/json")
            return
        super().do_GET()


@contextmanager
def local_server():
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=SITE, **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def wait_for_controller(page, scope: str) -> None:
    page.wait_for_function(
        "scope => navigator.serviceWorker.controller && new URL(navigator.serviceWorker.controller.scriptURL).pathname === `/${scope}/service-worker.js`",
        arg=scope,
    )


def assert_application_loaded(page, scope: str, errors: list[str]) -> None:
    marker = f"PWA-Belegung {BUILDING_IDS[scope]}"
    page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'false'")
    page.locator("#occupancyView").select_option("table")
    page.wait_for_function("marker => document.getElementById('occupancyList').textContent.includes(marker)", arg=marker)
    occupancy_text = page.locator("#occupancyList").inner_text()
    assert marker in occupancy_text, f"{scope}: Belegung fehlt: {occupancy_text!r}; Fehler: {' | '.join(errors)}"
    page.wait_for_function("document.getElementById('newsList').textContent.includes('Einschränkung Anfahrt')")
    page.wait_for_function("document.getElementById('aboutContent').textContent.includes('Über dieses Angebot')")
    assert "Einschränkung Anfahrt" in page.locator("#newsList").inner_text()
    assert "Über dieses Angebot" in page.locator("#aboutContent").inner_text()


def assert_offline_reload(page, origin: str, scope: str, errors: list[str]) -> None:
    page.goto(f"{origin}/{scope}/", wait_until="domcontentloaded")
    assert_application_loaded(page, scope, errors)
    assert not errors, f"{scope}: Fehler beim Online-Anwendungsstart: {' | '.join(errors)}"
    page.evaluate("() => navigator.serviceWorker.ready.then(() => true)")
    wait_for_controller(page, scope)
    errors.clear()
    page.context.set_offline(True)
    response = page.reload(wait_until="domcontentloaded")
    assert response is not None and response.ok, f"{scope}: Offline-Reload fehlgeschlagen"
    assert_application_loaded(page, scope, errors)
    assert page.evaluate("navigator.serviceWorker.controller !== null")
    unexpected = [error for error in errors if "net::ERR_INTERNET_DISCONNECTED" not in error]
    assert not unexpected, f"{scope}: Unerwartete Fehler nach Offline-Reload: {' | '.join(unexpected)}"
    assert len(errors) == 2, f"{scope}: Erwartet sind nur zwei fehlgeschlagene Runtime-API-Abrufe: {errors}"
    errors.clear()
    page.context.set_offline(False)


def main() -> None:
    if not SITE.is_dir():
        raise SystemExit("_site fehlt. Zuerst python scripts/build-pages-site.py ausführen.")
    assert not (SITE / "service-worker.js").exists(), "Root darf keinen Service Worker enthalten"

    with local_server() as origin, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(service_workers="allow")
        context.add_init_script(f"""
          (() => {{
            const NativeDate = Date;
            class FixedDate extends NativeDate {{
              constructor(...args) {{ super(...(args.length ? args : [{FIXED_NOW}])); }}
              static now() {{ return {FIXED_NOW}; }}
            }}
            window.Date = FixedDate;
          }})();
        """)
        page = context.new_page()
        errors: list[str] = []
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))

        root_response = page.goto(f"{origin}/", wait_until="domcontentloaded")
        assert root_response is not None and root_response.ok
        assert page.evaluate("navigator.serviceWorker.controller === null")
        assert page.evaluate("navigator.serviceWorker.getRegistration().then(registration => registration === undefined)")
        assert page.request.get(f"{origin}/service-worker.js").status == 404
        assert not errors, "Root-Anwendung meldet Fehler: " + " | ".join(errors)

        assert_offline_reload(page, origin, "DGH", errors)
        dgh_registration = page.evaluate("navigator.serviceWorker.getRegistration().then(registration => registration.scope)")
        assert dgh_registration == f"{origin}/DGH/"

        page.goto(f"{origin}/", wait_until="domcontentloaded")
        assert page.evaluate("navigator.serviceWorker.controller === null"), "DGH-Worker darf Root nicht kontrollieren"

        assert_offline_reload(page, origin, "Gemeindehaus", errors)
        registrations = page.evaluate("navigator.serviceWorker.getRegistrations().then(items => items.map(item => item.scope).sort())")
        assert registrations == [f"{origin}/DGH/", f"{origin}/Gemeindehaus/"], registrations
        cache_names = page.evaluate("caches.keys()")
        assert any("%2FDGH" in name for name in cache_names)
        assert any("%2FGemeindehaus" in name for name in cache_names)

        context.close()
        browser.close()
    print("PWA-Browsertest bestanden: Offline-Reload und Scope-Isolation.")


if __name__ == "__main__":
    main()
