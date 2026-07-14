# Projektübersicht

## Stand

Version 1.3.1. Statische PWA für öffentliche Belegung, Buchungs- und Kontaktanfragen, News, Downloads und Gebäudeinformationen. Keine eigene Datenbank oder Adminoberfläche.

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
- Runtime: `scripts/configure-runtime.py` ersetzt nur die öffentliche Apps-Script-Web-App-URL im Buildartefakt. Quellen für Laufzeitwerte liegen unter `betreiber/**/konfiguration/frontend.json`; `config/config.js` ist ein scope-eigenes Buildprodukt.
- Öffentliche Details: API-Schema 2 gibt optional `publicTitle` und `publicOrganizer` aus, ausschließlich mit fail-closed Master, Feldcheckbox und nicht leerem Text. Eingeschränktes Markdown wird im Browser über eine DOM-Whitelist gerendert.
- Offlinecache: Vollständige öffentliche Details können pro Gebäude und Zeitraum höchstens 24 Stunden ab `cachedAt` in `localStorage` bleiben; private Anfragefelder werden nicht gecacht.

## Betrieb

- Pages: `https://Rinderbuegen.github.io/Vermietung/DGH/` und `https://Rinderbuegen.github.io/Vermietung/Gemeindehaus/`.
- Demo: `tools/demo-server.cmd`, Caddy/mkcert, HTTPS auf `localhost:8443` und optional im LAN.
- Tests: vollständige Pflichtmatrix aus Pages-Verifikation, Content-/Runtime-Tests, Apps-Script-, Markdown-, Frontend-Kern-, Service-Worker- und `tests/browser.test.py`. `tools/test-demo.py` bleibt eine zusätzliche schnelle Demo-Prüfung.
- Workflow: `.github/workflows/pages.yml` prüft Pushes, Pull Requests und Wiederholungsläufe ohne Deploymentsecret. Nach grüner Qualität auf `main` wartet Pages auf die Freigabe im geschützten Environment `github-pages`; diese erfolgt erst nach Backend-, Migrations- und Datenschutzchecks. `workflow_dispatch` startet einen Wiederholungslauf.

## Datenschutz

Öffentlich erscheinen Datum, Uhrzeit, Status und optional ausdrücklich freigegebener Titel oder Veranstalter. Namen, Kontaktdaten, interne Notizen und Anfragehistorie bleiben im Backend, sofern ein Betreiber sie nicht bewusst als öffentlichen Veranstalter freigibt. Freigegebene Details können offline bis zu 24 Stunden sichtbar bleiben. Vor Freigabe von Personennamen oder `mailto:`-Links muss die Datenschutzerklärung fertig und geprüft sein. Keine vertraulichen Werte oder Sicherheitsfreigaben unter `betreiber/**/konfiguration/frontend.json` ablegen.
