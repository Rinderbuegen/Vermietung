# Projektübersicht

## Stand

Version 1.2. Statische PWA für öffentliche Belegung, Buchungs- und Kontaktanfragen, News, Downloads und Gebäudeinformationen. Keine eigene Datenbank oder Adminoberfläche.

## Architektur

- Frontend: `index.html`, `assets/css`, `assets/js`; technische Quellen ohne Betreiberwerte.
- Betreiberquelle: ausschließlich `betreiber/{allgemein,DGH,EV_GEMEINDEHAUS}`.
- Registry: `betreiber/allgemein/konfiguration/registry.json` hält `DGH -> /DGH/ -> dgh_rb` und `EV_GEMEINDEHAUS -> /Gemeindehaus/ -> ev_gem_rb` stabil.
- Merge: gemeinsame Inhalte zuerst, Gebäude-Overrides anhand stabiler IDs beziehungsweise relativer Pfade danach.
- Build: `scripts/build-pages-site.py` erzeugt Root, `/DGH/` und `/Gemeindehaus/` isoliert. Root entspricht DGH, liefert und registriert aber keinen Service Worker für den übergeordneten Scope.
- Inhalte: `scripts/build-content-index.py` erzeugt scope-eigene `assets/data/{news,downloads,about}.json` ausschließlich im Artefakt.
- Downloads: nur `downloads/oeffentlich`; `downloads/quellen` und `.odt` werden ausgeschlossen.
- PWA: Build erzeugt für beide Gebäude einen scope-eigenen Service Worker. Sein Cache-Key hasht Pfade und Inhalte aller Precache-Dateien. Root bleibt ohne Worker.
- Texte: sichtbare UI-Texte kommen aus `betreiber/allgemein/texte/frontend.json`, Rechtstexte aus `rechtliches.md`; Gebäude können `frontend.json` überschreiben.
- Backend: Google Apps Script und private Google Sheets. `scripts/build-apps-script.py` injiziert Betreiberkonfiguration/-texte in direkt deploybares `apps-script/buchungs-api/Code.gs`.
- Runtime: `scripts/configure-runtime.py` ersetzt nur die öffentliche Apps-Script-Web-App-URL im Buildartefakt.

## Betrieb

- Pages: `https://Rinderbuegen.github.io/Vermietung/DGH/` und `https://Rinderbuegen.github.io/Vermietung/Gemeindehaus/`.
- Demo: `tools/demo-server.cmd`, Caddy/mkcert, HTTPS auf `localhost:8443` und optional im LAN.
- Tests: `scripts/verify-pages-site.py`, `tests/content-build.test.py`, `tests/service-worker.test.js`, optional `tools/test-demo.py` mit Playwright.
- Workflow: `.github/workflows/pages.yml` baut Apps Script und Pages, prüft vor und nach Runtime-Konfiguration und lädt nur `_site` hoch.

## Datenschutz

Öffentlich erscheinen nur Datum, Uhrzeit, Status und optional freigegebener Titel. Namen, Kontaktdaten, interne Notizen und Anfragehistorie bleiben im Backend. Keine vertraulichen Werte unter `betreiber/**/konfiguration/frontend.json` ablegen.
