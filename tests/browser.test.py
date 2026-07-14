#!/usr/bin/env python3
"""Browser regression test with only loopback traffic and mocked Apps Script responses."""

from __future__ import annotations

import json
import re
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from html import escape
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
FRONTEND_PUBLIC_NOTE = "Prüfen Sie freie Zeiten und senden Sie eine unverbindliche Anfrage. Die verbindliche Bestätigung erfolgt durch den Betreiber."
BUILDING_PUBLIC_NOTES = {
    "dgh_rb": "DGH-API-Hinweis: Bitte freie Zeiten vor der Anfrage prüfen.",
    "ev_gem_rb": "Gemeindehaus-API-Hinweis: Verfügbarkeit vor der Anfrage abstimmen.",
}


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


def config_for(scope: str, origin: str, public_note=None) -> str:
    raw = (SITE / scope / "config" / "config.js").read_text(encoding="utf-8")
    payload = json.loads(raw.removeprefix("window.APP_CONFIG = ").rstrip(";\n"))
    payload["apiBaseUrl"] = f"{origin}/exec"
    payload["registerServiceWorker"] = False
    if public_note is not None:
        payload["texts"]["publicNote"] = public_note
    return "window.APP_CONFIG = " + json.dumps(payload, ensure_ascii=False) + ";\n"


def occupancy(building_id: str, requested_to: str) -> list[dict]:
    prefix = "DGH" if building_id == "dgh_rb" else "Gemeindehaus"
    return [
        {"date": "2026-07-18", "from": "18:00", "to": "21:00", "allDay": False, "status": "belegt", "statusKey": "confirmed", "publicTitle": f"{prefix} Abend {requested_to}", "publicOrganizer": ""},
        {"date": "2026-07-18", "from": "09:00", "to": "12:00", "allDay": False, "status": "belegt", "statusKey": "confirmed", "publicTitle": "**Frühstück**\n[Details](https://example.org/info) <img src=x onerror=alert(1)>", "publicOrganizer": "[Mail](mailto:verein@example.org)"},
        {"date": "2026-07-20", "from": "00:00", "to": "23:59", "allDay": True, "status": "gesperrt", "statusKey": "blocked", "publicTitle": "", "publicOrganizer": ""},
        {"date": "2026-07-21", "from": "15:00", "to": "18:00", "allDay": False, "status": "gesperrt", "statusKey": "blocked", "publicTitle": "Teilweise gesperrt", "publicOrganizer": ""},
        {"date": "2026-07-22", "from": "00:00", "to": "23:59", "allDay": True, "status": "belegt", "statusKey": "confirmed", "publicTitle": "", "publicOrganizer": ""},
        {"date": "2026-07-23", "from": "10:00", "to": "12:00", "allDay": False, "statusKey": "unknown", "publicTitle": "Ä Ö Ü ä ö ü ß", "publicOrganizer": "", "privateNote": "DARF-NIE-GEDRUCKT-WERDEN"},
        {"date": "2026-07-24", "from": "10:00", "to": "12:00", "allDay": False, "publicTitle": "Leerer Status", "publicOrganizer": ""},
    ]


def install_routes(context, origin: str, online: dict[str, bool], request_count: dict[str, int], public_note=None, api_public_note=None):
    def route_all(route):
        request = route.request
        parsed = urlparse(request.url)
        if parsed.netloc != urlparse(origin).netloc:
            if parsed.netloc == "fonts.googleapis.com":
                route.fulfill(status=200, content_type="text/css", body="")
            else:
                route.abort()
            return
        if public_note is not None and request.resource_type == "document" and parsed.path in ("/DGH/", "/Gemeindehaus/"):
            scope = parsed.path.strip("/")
            source = (SITE / scope / "index.html").read_text(encoding="utf-8")
            body, replacements = re.subn(
                r'(<p class="lead" data-public-note>).*?(</p>)',
                lambda match: match.group(1) + escape(public_note) + match.group(2),
                source,
                count=1,
            )
            assert replacements == 1, f"Hero-Hinweis fehlt in {scope}/index.html"
            route.fulfill(status=200, content_type="text/html", body=body)
            return
        if parsed.path.endswith("/config/config.js"):
            scope = "Gemeindehaus" if "/Gemeindehaus/" in parsed.path else "DGH"
            route.fulfill(status=200, content_type="application/javascript", body=config_for(scope, origin, public_note))
            return
        if parsed.path == "/exec":
            query = parse_qs(parsed.query)
            action = query.get("action", [""])[0]
            if action == "occupancy":
                request_count["occupancy"] += 1
            if not online["value"]:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": False, "message": "offline"}))
                return
            building_id = query.get("buildingId", [""])[0]
            if action == "occupancy":
                data = {"schemaVersion": 2, "loadedAt": "2026-07-14T10:15:00.000Z", "items": occupancy(building_id, query.get("to", [""])[0])}
            elif action == "building":
                response_public_note = BUILDING_PUBLIC_NOTES[building_id] if api_public_note is None else api_public_note
                data = {"name": building_id, "operatorName": "Test", "contactEmail": "test@example.org", "publicNote": response_public_note}
            else:
                data = {"items": []}
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "data": data}))
            return
        route.continue_()

    context.route("**/*", route_all)


def wait_for_occupancy_requests(page, count: int) -> None:
    page.wait_for_function("expected => window.__occupancyFetches.length === expected", arg=count)


def assert_no_store(page, request_count: int) -> None:
    fetches = page.evaluate("window.__occupancyFetches")
    assert len(fetches) == request_count, (fetches, request_count)
    assert all(entry["cache"] == "no-store" for entry in fetches)


def assert_public_note_regression(browser, origin: str) -> None:
    cases = (
        ("DGH", FRONTEND_PUBLIC_NOTE, None, FRONTEND_PUBLIC_NOTE),
        ("Gemeindehaus", FRONTEND_PUBLIC_NOTE, None, FRONTEND_PUBLIC_NOTE),
        ("DGH", "", None, BUILDING_PUBLIC_NOTES["dgh_rb"]),
        ("Gemeindehaus", "", None, BUILDING_PUBLIC_NOTES["ev_gem_rb"]),
        ("DGH", " \t\n", None, BUILDING_PUBLIC_NOTES["dgh_rb"]),
        ("DGH", "", "", ""),
        ("DGH", "", {"invalid": "public note"}, ""),
    )
    for scope, frontend_note, api_public_note, expected_note in cases:
        errors: list[str] = []
        online = {"value": True}
        request_count = {"occupancy": 0}
        context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        try:
            context.add_init_script("""
              (() => {
                let releaseBuildingGate;
                const buildingGate = new Promise((resolve) => { releaseBuildingGate = resolve; });
                window.__buildingResponseReceived = false;
                window.__buildingProcessingComplete = false;
                window.__releaseBuildingGate = () => releaseBuildingGate();
                const nativeFetch = window.fetch.bind(window);
                window.fetch = async (input, options) => {
                  const url = new URL(input instanceof URL ? input.href : typeof input === "string" ? input : input.url, window.location.href);
                  if (url.searchParams.get("action") !== "building") return nativeFetch(input, options);
                  const response = await nativeFetch(input, options);
                  window.__buildingResponseReceived = true;
                  await buildingGate;
                  return response;
                };
                document.addEventListener("DOMContentLoaded", () => {
                  const applyConfig = window.Ui.applyConfig;
                  window.Ui.applyConfig = (...args) => {
                    const result = applyConfig(...args);
                    if (window.__buildingResponseReceived) window.__buildingProcessingComplete = true;
                    return result;
                  };
                }, { once: true });
              })();
            """)
            install_routes(context, origin, online, request_count, frontend_note, api_public_note)
            page = context.new_page()
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"{origin}/{scope}/", wait_until="domcontentloaded")
            page.wait_for_function("window.__buildingResponseReceived === true")

            note = page.locator("[data-public-note]")
            assert page.evaluate("window.APP_CONFIG.texts.publicNote") == frontend_note
            assert note.text_content() == frontend_note

            page.evaluate("window.__releaseBuildingGate()")
            page.wait_for_function("window.__buildingProcessingComplete === true")
            assert note.text_content() == expected_note
            assert not errors, f"Browser-Fehler in {scope} mit Hinweis {frontend_note!r}: " + " | ".join(errors)
        finally:
            context.close()


def main() -> None:
    if not SITE.is_dir():
        raise SystemExit("_site fehlt. Zuerst python scripts/build-pages-site.py ausführen.")
    errors: list[str] = []
    online = {"value": True}
    request_count = {"occupancy": 0}
    with local_server() as origin, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        assert_public_note_regression(browser, origin)
        context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        context.add_init_script(f"""
          (() => {{
            const NativeDate = Date;
            class FixedDate extends NativeDate {{
              constructor(...args) {{ super(...(args.length ? args : [{FIXED_NOW}])); }}
              static now() {{ return {FIXED_NOW}; }}
            }}
            window.Date = FixedDate;
            window.__online = true;
            Object.defineProperty(Navigator.prototype, "onLine", {{ configurable: true, get: () => window.__online }});
            window.__occupancyFetches = [];
            window.__occupancyGates = new Map();
            window.__createOccupancyGate = (from) => {{
              let release;
              const promise = new Promise((resolve) => {{ release = resolve; }});
              window.__occupancyGates.set(from, {{ promise, release }});
            }};
            window.__releaseOccupancyGate = (from) => {{
              const gate = window.__occupancyGates.get(from);
              if (gate) {{ gate.release(); window.__occupancyGates.delete(from); }}
            }};
            const nativeFetch = window.fetch.bind(window);
            window.fetch = async (input, options) => {{
              const url = new URL(input instanceof URL ? input.href : typeof input === "string" ? input : input.url, window.location.href);
              if (url.searchParams.get("action") !== "occupancy") return nativeFetch(input, options);
              window.__occupancyFetches.push({{ url: url.href, cache: options && options.cache }});
              const response = await nativeFetch(input, options);
              const gate = window.__occupancyGates.get(`${{url.searchParams.get("from")}}:${{url.searchParams.get("to")}}`);
              if (gate) await gate.promise;
              return response;
            }};
            window.__printCalls = [];
            window.print = () => window.__printCalls.push({{
              text: document.getElementById("occupancyPrint").innerText,
              childCount: document.getElementById("occupancyPrint").childElementCount
            }});
          }})();
        """)
        install_routes(context, origin, online, request_count)
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"{origin}/DGH/", wait_until="networkidle")

        assert page.locator("#occupancyList").get_attribute("aria-live") is None
        assert page.locator("#occupancyMeta").get_attribute("role") == "status"
        assert page.locator("#occupancyMeta").get_attribute("aria-atomic") == "true"
        assert page.get_by_role("button", name="PDF erstellen / drucken").count() == 1
        assert request_count["occupancy"] == 1
        assert_no_store(page, request_count["occupancy"])
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
        assert dialog.locator(".status-label").count() == 0
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

        before_view_change = request_count["occupancy"]
        page.locator("#occupancyView").select_option("table")
        page.locator("#occupancyView").select_option("plan")
        assert request_count["occupancy"] == before_view_change
        page.locator("#occupancyView").select_option("table")
        assert page.locator(".booking-details").count() == 7
        empty_entry = page.locator(".booking-details.status-confirmed").filter(has_text="22.07.2026")
        assert empty_entry.locator(".booking-detail-text").count() == 0
        assert page.locator(".booking-details").filter(has_text="Frühstück").locator(".booking-detail-text").count() == 2
        assert page.locator(".booking-details").filter(has_text="Frühstück").locator(".status-label").count() == 0
        assert page.locator(".booking-details.status-blocked").first.locator(".status-label").inner_text() == "gesperrt"
        assert page.locator(".booking-details.status-unknown").locator(".status-label").inner_text() == "Status unbekannt"
        assert page.locator(".booking-details.status-default").locator(".status-label").inner_text() == "Status unbekannt"

        page.locator("#occupancyView").select_option("plan")
        page.locator("[data-occupancy-date='2026-07-20']").click()
        assert dialog.locator(".status-label").inner_text() == "gesperrt"
        page.keyboard.press("Escape")
        page.locator("[data-occupancy-date='2026-07-23']").click()
        assert dialog.locator(".status-label").inner_text() == "Status unbekannt"
        page.keyboard.press("Escape")
        page.locator("#occupancyView").select_option("table")

        page.evaluate("window.__createOccupancyGate('2026-07-14:2026-07-31')")
        refresh = page.locator("#occupancyRefreshButton")
        refresh.click()
        wait_for_occupancy_requests(page, before_view_change + 1)
        assert page.locator("#occupancyList").get_attribute("inert") == ""
        assert page.locator("#occupancyList").get_attribute("aria-busy") == "true"
        assert refresh.is_disabled()
        assert page.locator("#occupancyPrintButton").is_disabled()
        page.locator("#occupancyView").select_option("plan")
        assert page.locator("#occupancyMeta").inner_text() == "Belegung wird aktualisiert …"
        page.evaluate("document.getElementById('occupancyFilter').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))")
        page.wait_for_timeout(20)
        assert request_count["occupancy"] == before_view_change + 1
        page.evaluate("window.__releaseOccupancyGate('2026-07-14:2026-07-31')")
        page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'false'")
        page.locator("#occupancyView").select_option("table")

        before_range_change = request_count["occupancy"]
        page.locator("#occupancyRange").select_option("next-month")
        wait_for_occupancy_requests(page, before_range_change + 1)
        page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'false'")
        assert request_count["occupancy"] == before_range_change + 1
        assert_no_store(page, request_count["occupancy"])

        before_race = request_count["occupancy"]
        page.evaluate("window.__createOccupancyGate('2026-07-14:2026-07-31')")
        page.locator("#occupancyRange").select_option("current-month")
        wait_for_occupancy_requests(page, before_race + 1)
        page.locator("#occupancyRange").select_option("next-month")
        wait_for_occupancy_requests(page, before_race + 2)
        page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'false'")
        assert "DGH Abend 2026-08-31" in page.locator("#occupancyList").inner_text()
        page.evaluate("window.__releaseOccupancyGate('2026-07-14:2026-07-31')")
        page.wait_for_timeout(20)
        assert "DGH Abend 2026-08-31" in page.locator("#occupancyList").inner_text()
        assert page.locator("#occupancyList").get_attribute("aria-busy") == "false"
        assert_no_store(page, request_count["occupancy"])

        before_print = request_count["occupancy"]
        page.get_by_role("button", name="PDF erstellen / drucken").click()
        assert page.evaluate("window.__printCalls.length") == 1
        assert page.locator("#occupancyPrint .occupancy-print-header h1").inner_text() == "Belegung: Dorfgemeinschaftshaus Rinderbügen"
        assert page.locator("#occupancyPrint .occupancy-print-header dt").all_inner_texts() == ["Zeitraum", "Ansicht", "Datenstand", "Erstellt am"]
        assert "DGH Abend 2026-08-31" in page.locator("#occupancyPrint").inner_text()
        assert page.locator("#occupancyPrint .occupancy-print-plan").count() == 0
        assert page.locator("#occupancyPrint .booking-details.status-blocked .status-label").first.inner_text() == "gesperrt"
        assert page.locator("#occupancyPrint .booking-details.status-unknown .status-label").inner_text() == "Status unbekannt"
        assert page.locator("#occupancyPrint .booking-details.status-default .status-label").inner_text() == "Status unbekannt"
        assert page.locator("#occupancyPrint .booking-details.status-confirmed .status-label").count() == 0
        assert "DARF-NIE-GEDRUCKT-WERDEN" not in page.locator("#occupancyPrint").inner_text()
        assert request_count["occupancy"] == before_print

        page.locator("#occupancyRange").select_option("current-month")
        wait_for_occupancy_requests(page, before_print + 1)
        page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'false'")
        before_plan_print = request_count["occupancy"]
        page.locator("#occupancyView").select_option("plan")
        page.get_by_role("button", name="PDF erstellen / drucken").click()
        assert page.locator("#occupancyPrint .occupancy-print-plan").count() == 1
        assert page.locator("#occupancyPrint .occupancy-print-details-page").count() == 1
        assert page.locator("#occupancyPrint .occupancy-print-day-marker").count() == 0
        assert page.locator("#occupancyPrint .occupancy-print-legend-entry").all_inner_texts() == ["frei", "belegt", "teilweise belegt", "gesperrt"]
        assert page.locator("#occupancyPrint .occupancy-print-legend-symbol").count() == 4
        assert page.locator("#occupancyPrint .occupancy-print-legend-symbol .occupancy-print-status-pattern").evaluate_all("nodes => nodes.map(node => [node.dataset.status, node.getAttribute('aria-hidden'), node.querySelectorAll('line').length])") == [["free", "true", 0], ["busy", "true", 2], ["partial", "true", 1], ["blocked", "true", 4]]
        assert page.locator("#occupancyPrint .occupancy-print-day.is-free .occupancy-print-status-pattern").evaluate_all("nodes => nodes.length > 0 && nodes.every(node => node.querySelectorAll('line').length === 0)")
        assert page.locator("#occupancyPrint .occupancy-print-day.is-busy .occupancy-print-status-pattern").evaluate_all("nodes => nodes.length > 0 && nodes.every(node => node.querySelectorAll('line').length === 2)")
        assert page.locator("#occupancyPrint .occupancy-print-day.is-partial .occupancy-print-status-pattern").evaluate_all("nodes => nodes.length > 0 && nodes.every(node => node.querySelectorAll('line').length === 1)")
        assert page.locator("#occupancyPrint .occupancy-print-day.is-blocked .occupancy-print-status-pattern").evaluate_all("nodes => nodes.length > 0 && nodes.every(node => node.querySelectorAll('line').length === 4)")
        assert page.evaluate("window.__printCalls.length") == 2
        page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        assert page.locator("#occupancyPrint .occupancy-print-plan").count() == 1
        assert request_count["occupancy"] == before_plan_print
        page.emulate_media(media="print")
        assert page.locator("#occupancyPrint").evaluate("node => getComputedStyle(node).display") == "block"
        assert page.locator("main").evaluate("node => getComputedStyle(node).display") == "none"
        page.emulate_media(media="screen")

        online["value"] = False
        page.evaluate("window.__online = false")
        page.locator("#occupancyView").select_option("table")
        page.locator("#occupancyRefreshButton").click()
        page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'false'")
        stale_meta = page.locator("#occupancyMeta").inner_text()
        assert "Möglicherweise veralteter Stand" in stale_meta
        assert "Die Belegung konnte nicht geladen werden" in stale_meta
        assert "Frühstück" in page.locator("#occupancyList").inner_text()
        page.locator("#occupancyView").select_option("plan")
        assert page.locator("#occupancyMeta").inner_text() == stale_meta
        page.get_by_role("button", name="PDF erstellen / drucken").click()
        print_text = page.locator("#occupancyPrint").inner_text()
        assert "Möglicherweise veralteter Stand" in print_text
        assert "Offline erstellt" in print_text

        before_error_range = request_count["occupancy"]
        page.evaluate("""() => {
          window.__createOccupancyGate('2026-08-01:2026-08-31');
          const select = document.getElementById('occupancyRange');
          select.dataset.from = '2026-08-01';
          select.dataset.to = '2026-08-31';
          select.value = 'selected-month';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }""")
        wait_for_occupancy_requests(page, before_error_range + 1)
        page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'true'")
        assert page.locator("#occupancyPrint").inner_text() == ""
        page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        assert page.locator("#occupancyPrint").inner_text() == ""
        online["value"] = False
        page.evaluate("window.__online = false; window.__releaseOccupancyGate('2026-08-01:2026-08-31')")
        page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'false'")
        assert "Die Belegung konnte nicht geladen werden" in page.locator("#occupancyMeta").inner_text()
        assert page.locator("#occupancyPrint").inner_text() == ""
        assert page.locator("#occupancyPrintButton").is_disabled()
        assert_no_store(page, request_count["occupancy"])

        online["value"] = True
        page.evaluate("window.__online = true")
        page.goto(f"{origin}/DGH/", wait_until="networkidle")
        page.evaluate("""() => {
          const put = (key, value) => localStorage.setItem(key, value);
          put('occupancy:v2:dgh_rb:bad', '{');
          put('occupancy:v2:dgh_rb:expired', JSON.stringify({ cachedAt: 0, payload: { items: [] } }));
          put('occupancy:v2:dgh_rb:fresh', JSON.stringify({ cachedAt: 1784024100000, payload: { items: [] } }));
          put('occupancy:v2:ev_gem_rb:bad', '{');
          put('foreign:cache', 'unchanged');
          put('occupancy:dgh_rb:2027-01-01:2027-12-31', 'legacy');
        }""")
        page.locator("#occupancyRange").select_option("next-year")
        page.wait_for_function("document.getElementById('occupancyList').getAttribute('aria-busy') === 'false'")
        keys = page.evaluate("Object.keys(localStorage).sort()")
        assert "occupancy:v2:dgh_rb:bad" not in keys
        assert "occupancy:v2:dgh_rb:expired" not in keys
        assert "occupancy:v2:dgh_rb:fresh" in keys
        assert page.evaluate("localStorage.getItem('occupancy:v2:ev_gem_rb:bad')") == "{"
        assert page.evaluate("localStorage.getItem('foreign:cache')") == "unchanged"
        assert "occupancy:dgh_rb:2027-01-01:2027-12-31" not in keys
        assert all(entry["cache"] == "no-store" for entry in page.evaluate("window.__occupancyFetches"))

        page.goto(f"{origin}/Gemeindehaus/", wait_until="networkidle")
        page.locator("#occupancyView").select_option("table")
        assert "Gemeindehaus Abend" in page.locator("#occupancyList").inner_text()
        before_gemeindehaus_print = request_count["occupancy"]
        page.get_by_role("button", name="PDF erstellen / drucken").click()
        gemeindehaus_print = page.locator("#occupancyPrint")
        assert "Gemeindehaus Abend 2026-07-31" in gemeindehaus_print.inner_text()
        https_link = gemeindehaus_print.locator("a[href='https://example.org/info']")
        assert https_link.get_attribute("target") == "_blank"
        assert https_link.get_attribute("rel") == "noopener noreferrer"
        mailto_link = gemeindehaus_print.locator("a[href='mailto:verein@example.org']")
        assert mailto_link.get_attribute("target") is None
        assert mailto_link.get_attribute("rel") is None
        assert request_count["occupancy"] == before_gemeindehaus_print
        assert all(entry["cache"] == "no-store" for entry in page.evaluate("window.__occupancyFetches"))
        keys = page.evaluate("Object.keys(localStorage).sort()")
        assert any(key.startswith("occupancy:v2:dgh_rb:") for key in keys)
        assert any(key.startswith("occupancy:v2:ev_gem_rb:") for key in keys)
        browser.close()
    assert not errors, "Browser errors: " + " | ".join(errors)
    print("browser tests passed")


if __name__ == "__main__":
    main()
