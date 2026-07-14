#!/usr/bin/env python3
"""Browser regression test with only loopback traffic and mocked Apps Script responses."""

from __future__ import annotations

import json
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    from playwright.sync_api import sync_playwright
except ImportError as error:
    raise SystemExit("Playwright fehlt. Installieren: python -m pip install playwright==1.61.0") from error


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
FIXED_NOW = 1784024100000


@contextmanager
def local_server():
    handler = lambda *args, **kwargs: SimpleHTTPRequestHandler(*args, directory=SITE, **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def config_for(scope: str, origin: str) -> str:
    raw = (SITE / scope / "config" / "config.js").read_text(encoding="utf-8")
    payload = json.loads(raw.removeprefix("window.APP_CONFIG = ").rstrip(";\n"))
    payload["apiBaseUrl"] = f"{origin}/exec"
    payload["registerServiceWorker"] = False
    return "window.APP_CONFIG = " + json.dumps(payload, ensure_ascii=False) + ";\n"


def occupancy(building_id: str) -> list[dict]:
    prefix = "DGH" if building_id == "dgh_rb" else "Gemeindehaus"
    return [
        {"date": "2026-07-18", "from": "18:00", "to": "21:00", "allDay": False, "status": "belegt", "statusKey": "confirmed", "publicTitle": f"{prefix} Abend", "publicOrganizer": ""},
        {"date": "2026-07-18", "from": "09:00", "to": "12:00", "allDay": False, "status": "belegt", "statusKey": "confirmed", "publicTitle": "**Frühstück**\n[Details](https://example.org/info) <img src=x onerror=alert(1)>", "publicOrganizer": "[Mail](mailto:verein@example.org)"},
        {"date": "2026-07-20", "from": "00:00", "to": "23:59", "allDay": True, "status": "gesperrt", "statusKey": "blocked", "publicTitle": "", "publicOrganizer": ""},
        {"date": "2026-07-21", "from": "15:00", "to": "18:00", "allDay": False, "status": "gesperrt", "statusKey": "blocked", "publicTitle": "Teilweise gesperrt", "publicOrganizer": ""},
        {"date": "2026-07-22", "from": "10:00", "to": "12:00", "allDay": False, "status": "belegt", "statusKey": "confirmed", "publicTitle": "", "publicOrganizer": ""},
    ]


def install_routes(context, origin: str, online: dict[str, bool]):
    def route_all(route):
        request = route.request
        parsed = urlparse(request.url)
        if parsed.netloc != urlparse(origin).netloc:
            if parsed.netloc == "fonts.googleapis.com":
                route.fulfill(status=200, content_type="text/css", body="")
            else:
                route.abort()
            return
        if parsed.path.endswith("/config/config.js"):
            scope = "Gemeindehaus" if "/Gemeindehaus/" in parsed.path else "DGH"
            route.fulfill(status=200, content_type="application/javascript", body=config_for(scope, origin))
            return
        if parsed.path == "/exec":
            if not online["value"]:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": False, "message": "offline"}))
                return
            query = parse_qs(parsed.query)
            building_id = query.get("buildingId", [""])[0]
            action = query.get("action", [""])[0]
            if action == "occupancy":
                data = {"schemaVersion": 2, "loadedAt": "2026-07-14T10:15:00.000Z", "items": occupancy(building_id)}
            elif action == "building":
                data = {"name": building_id, "operatorName": "Test", "contactEmail": "test@example.org", "publicNote": "Test"}
            else:
                data = {"items": []}
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "data": data}))
            return
        route.continue_()

    context.route("**/*", route_all)


def main() -> None:
    if not SITE.is_dir():
        raise SystemExit("_site fehlt. Zuerst python scripts/build-pages-site.py ausführen.")
    errors: list[str] = []
    online = {"value": True}
    with local_server() as origin, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
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
        install_routes(context, origin, online)
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"{origin}/DGH/", wait_until="networkidle")

        assert page.locator("#occupancyList").get_attribute("aria-live") is None
        assert page.locator("#occupancyMeta").get_attribute("role") == "status"
        assert page.locator("#occupancyMeta").get_attribute("aria-atomic") == "true"
        assert page.locator(".occupancy-month h3").count() >= 1
        assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
        assert page.locator("[data-occupancy-date='2026-07-20']").evaluate("node => node.classList.contains('is-blocked')")
        assert page.locator("[data-occupancy-date='2026-07-21']").evaluate("node => node.classList.contains('is-partial')")

        trigger = page.locator("[data-occupancy-date='2026-07-18']")
        trigger.click()
        assert page.locator("#bookingDetailsDialog").evaluate("node => node.open")
        dialog = page.locator("#bookingDetailsDialog")
        assert dialog.locator(".booking-dialog-entry").count() == 2
        assert dialog.locator(".booking-dialog-entry").nth(0).inner_text().startswith("18.07.2026")
        assert dialog.locator(".booking-dialog-entry").nth(0).inner_text().find("Frühstück") >= 0
        https_link = dialog.locator("a[href='https://example.org/info']")
        assert https_link.get_attribute("target") == "_blank"
        assert https_link.get_attribute("rel") == "noopener noreferrer"
        assert "öffnet in einem neuen Tab" in https_link.inner_text()
        mailto_link = dialog.locator("a[href='mailto:verein@example.org']")
        assert mailto_link.get_attribute("target") is None
        assert dialog.locator("script, img, svg, [onerror]").count() == 0
        page.keyboard.press("Escape")
        assert page.locator("#bookingDetailsDialog").evaluate("node => !node.open")
        page.wait_for_timeout(10)
        assert page.evaluate("document.activeElement.dataset.occupancyDate") == "2026-07-18"

        trigger.focus()
        page.keyboard.press("Enter")
        assert dialog.evaluate("node => node.open")
        page.get_by_role("button", name="Schließen").click()
        page.wait_for_timeout(10)
        assert page.evaluate("document.activeElement.dataset.occupancyDate") == "2026-07-18"
        trigger.focus()
        page.keyboard.press(" ")
        assert dialog.evaluate("node => node.open")
        page.keyboard.press("Escape")

        trigger = page.locator("[data-occupancy-date='2026-07-18']")
        trigger.click()
        page.evaluate("""() => {
          const view = document.getElementById('occupancyView');
          view.value = 'table';
          view.dispatchEvent(new Event('change', { bubbles: true }));
        }""")
        page.keyboard.press("Escape")
        page.wait_for_timeout(10)
        assert page.evaluate("document.activeElement.id") == "occupancyView"

        page.locator("#occupancyView").select_option("plan")
        page.locator("[data-booking-date='2026-07-16']").click()
        assert page.locator("#bookingForm [name='date']").input_value() == "2026-07-16"

        page.locator("#occupancyView").select_option("table")
        assert page.locator(".booking-details").count() == 5
        empty_entry = page.locator(".booking-details").filter(has_text="10:00 bis 12:00 Uhr")
        assert empty_entry.locator(".booking-detail-text").count() == 0
        assert page.locator(".booking-details").filter(has_text="Frühstück").locator(".booking-detail-text").count() == 2

        online["value"] = False
        page.get_by_role("button", name="Aktualisieren").click()
        page.wait_for_timeout(100)
        assert "Möglicherweise veralteter Stand" in page.locator("#occupancyMeta").inner_text()
        assert "Frühstück" in page.locator("#occupancyList").inner_text()
        page.locator("#occupancyView").select_option("plan")
        assert "Möglicherweise veralteter Stand" in page.locator("#occupancyMeta").inner_text()
        page.evaluate("localStorage.setItem('occupancy:v2:dgh_rb:2026-07-14:2026-07-31', JSON.stringify({cachedAt: 0, payload: {items: [{date: '2026-07-18', publicTitle: 'Alt'}]}}))")
        page.locator("#occupancyView").select_option("table")
        page.get_by_role("button", name="Aktualisieren").click()
        page.wait_for_timeout(100)
        assert "Alt" not in page.locator("#occupancyList").inner_text()

        online["value"] = True
        page.goto(f"{origin}/DGH/", wait_until="networkidle")
        page.goto(f"{origin}/Gemeindehaus/", wait_until="networkidle")
        page.locator("#occupancyView").select_option("table")
        assert "Gemeindehaus Abend" in page.locator("#occupancyList").inner_text()
        keys = page.evaluate("Object.keys(localStorage).sort()")
        assert any(key.startswith("occupancy:v2:dgh_rb:") for key in keys)
        assert any(key.startswith("occupancy:v2:ev_gem_rb:") for key in keys)
        browser.close()
    assert not errors, "Browser errors: " + " | ".join(errors)
    print("browser tests passed")


if __name__ == "__main__":
    main()
