#!/usr/bin/env python3
"""Prüft den laufenden lokalen HTTPS-Demo-Server."""

from __future__ import annotations

import argparse
from typing import Any
from urllib.parse import urljoin


BUILDINGS = {
    "DGH": "dgh_rb",
    "Gemeindehaus": "ev_gem_rb",
}


def test_demo(playwright: Any, base_url: str) -> None:
    browser = playwright.chromium.launch(headless=True)
    try:
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        for path, building_id in BUILDINGS.items():
            building_url = urljoin(base_url, f"{path}/")
            response = page.goto(building_url, wait_until="networkidle")
            assert response is not None and response.status == 200, f"{path}: Seite nicht erreichbar"
            assert page.url == building_url, f"{path}: unerwartete Ziel-URL {page.url}"
            assert page.evaluate("window.isSecureContext"), f"{path}: kein Secure Context"

            field = page.locator("[data-building-id-field]")
            assert field.input_value() == building_id, f"{path}: falsche Gebäudekonfiguration"

            manifest_href = page.locator('link[rel="manifest"]').get_attribute("href")
            assert manifest_href, f"{path}: Manifest-Link fehlt"
            manifest_url = urljoin(building_url, manifest_href)
            manifest_response = context.request.get(manifest_url)
            assert manifest_response.ok, f"{path}: Manifest nicht erreichbar"
            manifest = manifest_response.json()
            assert urljoin(manifest_url, manifest["scope"]) == building_url, f"{path}: falscher Manifest-Scope"
            assert urljoin(manifest_url, manifest["start_url"]) == building_url, f"{path}: falsche Manifest-Start-URL"

            registration = page.evaluate(
                """async () => {
                    const ready = await Promise.race([
                        navigator.serviceWorker.ready,
                        new Promise((_, reject) => setTimeout(() => reject(new Error('SW-Timeout')), 10000))
                    ]);
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    return {
                        readyScope: ready.scope,
                        scopes: registrations.map((item) => item.scope)
                    };
                }"""
            )
            assert registration["readyScope"] == building_url, f"{path}: falscher aktiver SW-Scope"
            assert building_url in registration["scopes"], f"{path}: Service Worker nicht registriert"

        mobile_context = browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
        )
        mobile_page = mobile_context.new_page()
        for path, building_id in BUILDINGS.items():
            building_url = urljoin(base_url, f"{path}/")
            response = mobile_page.goto(building_url, wait_until="networkidle")
            assert response is not None and response.status == 200, f"{path} mobil: Seite nicht erreichbar"
            assert mobile_page.locator("#main").is_visible(), f"{path} mobil: Hauptinhalt nicht sichtbar"
            field = mobile_page.locator("[data-building-id-field]")
            assert field.input_value() == building_id, f"{path} mobil: falsche Gebäudekonfiguration"
            has_overflow = mobile_page.evaluate(
                "document.documentElement.scrollWidth > document.documentElement.clientWidth"
            )
            assert not has_overflow, f"{path} mobil: horizontaler Seitenoverflow"
        mobile_context.close()

        for source, target in (
            (urljoin(base_url, "../"), base_url),
            (base_url.rstrip("/"), base_url),
            (urljoin(base_url, "DGH"), urljoin(base_url, "DGH/")),
        ):
            response = context.request.get(source, max_redirects=0)
            assert response.status == 308, f"Redirect fehlt: {source}"
            assert urljoin(source, response.headers["location"]) == target, f"Falscher Redirect: {source}"

        missing = context.request.get(urljoin(base_url, "nicht-vorhanden"))
        assert missing.status == 404, "Unbekannter Pfad muss statisches 404 liefern"
    finally:
        browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default="https://localhost:8443/Vermietung/",
        help="Basis-URL mit abschließendem Schrägstrich",
    )
    args = parser.parse_args()
    if not args.base_url.endswith("/"):
        parser.error("--base-url muss mit '/' enden")

    try:
        from playwright.sync_api import sync_playwright
    except ModuleNotFoundError as error:
        raise SystemExit("Python-Paket 'playwright' fehlt.") from error

    with sync_playwright() as playwright:
        test_demo(playwright, args.base_url)
    print("Demo geprüft: Gebäudeseiten, HTTPS/PWA, Redirects und 404.")


if __name__ == "__main__":
    main()
