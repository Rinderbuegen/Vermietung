# Projektübersicht

## Stand

Version 1.6.1. Statische PWA für öffentliche Belegung, Buchungs- und Kontaktanfragen, News, Downloads und Gebäudeinformationen. Keine eigene Datenbank oder Adminoberfläche.

## Architektur

- Frontend: `index.html`, `assets/css`, `assets/js`; technische Quellen ohne Betreiberwerte. Der Browser lädt ohne Bundler einen nativen ESM-Graphen.
- Composition Root: `assets/js/main.js` verdrahtet die Module aus `config`, `domain`, `infrastructure`, `features`, `shared` und `pwa`; die Module veröffentlichen keine eigenen Browser-Globals.
- Betreiberquelle: ausschließlich `betreiber/{allgemein,DGH,EV_GEMEINDEHAUS}`.
- Registry: `betreiber/allgemein/konfiguration/registry.json` hält `DGH -> /DGH/ -> dgh_rb` und `EV_GEMEINDEHAUS -> /Gemeindehaus/ -> ev_gem_rb` stabil.
- Merge: gemeinsame Inhalte zuerst, Gebäude-Overrides anhand stabiler IDs beziehungsweise relativer Pfade danach.
- Build: `scripts/build-pages-site.py` erzeugt Root, `/DGH/` und `/Gemeindehaus/` isoliert. Root entspricht DGH, liefert und registriert aber keinen Service Worker für den übergeordneten Scope.
- Inhalte: `scripts/build-content-index.py` erzeugt scope-eigene `assets/data/{news,downloads,about}.json` ausschließlich im Artefakt.
- Downloads: nur `downloads/oeffentlich`; `downloads/quellen` und `.odt` werden ausgeschlossen.
- PWA: Build erzeugt für beide Gebäude einen scope-eigenen klassischen Service Worker. Sein Cache-Key hasht Pfade und Inhalte aller Precache-Dateien. Root bleibt ohne Worker.
- Texte: sichtbare UI-Texte kommen aus `betreiber/allgemein/texte/frontend.json`, Rechtstexte aus `rechtliches.md`; Gebäude können `frontend.json` überschreiben. Nichtleerer Frontend-Hinweis hat Vorrang; `building.publicNote` der Gebäude-API nur Fallback.
- Hero: Die Gebäudekarte kennzeichnet den Namen als „Eigentümer“ und verlinkt direkt auf das Kontaktformular. Die Überschrift erlaubt deutsche Silbentrennung.
- Backend: Google Apps Script und private Google Sheets. `scripts/build-apps-script.py` injiziert Betreiberkonfiguration/-texte in direkt deploybares `apps-script/buchungs-api/Code.gs`.
- Runtime: `scripts/configure-runtime.py` ersetzt nur die öffentliche Apps-Script-Web-App-URL im Buildartefakt. Quellen für Laufzeitwerte liegen unter `betreiber/**/konfiguration/frontend.json`; das klassische `config/config.js` ist ein scope-eigenes Buildprodukt und setzt mit `window.APP_CONFIG` das einzige globale Frontendobjekt vor dem ESM-Einstieg.
- Belegung: Zeitraumwechsel ruft die öffentliche Belegung automatisch ab, Plan-/Listenwechsel rendert lokal. Der Browserdruck nutzt einen eingefrorenen Snapshot der geladenen öffentlichen Daten, markiert Offline- oder stale-Daten und druckt A4-Hochformat.
- Statusanzeige: Bestätigte Detaileinträge zeigen keinen redundanten Badge „belegt“; gesperrte und unbekannte Status bleiben gekennzeichnet. Kalender, Legende und ARIA-Texte behalten „belegt“.
- Öffentliche Details: API-Schema 2 gibt optional `publicTitle` und `publicOrganizer` aus, ausschließlich mit fail-closed Master, Feldcheckbox und nicht leerem Text. Eingeschränktes Markdown wird im Browser über eine DOM-Whitelist gerendert.
- Offlinecache: `occupancy:v3` hält pro Gebäude und Zeitraum höchstens 24 Stunden ausschließlich die öffentliche Feldprojektion `date`, `from`, `to`, `allDay`, `status`, `statusKey`, `publicTitle` und `publicOrganizer`; private oder unbekannte API-Felder werden verworfen.
- Aktualisierungsschnitt 1.5.0: Für alte installierte PWA-Versionen gibt es keine Legacy-Skriptkompatibilität. Die PWA muss zur Aktualisierung online geöffnet werden; danach sind alle alten PWA-Fenster und Browser-Tabs zu schließen, bevor sie neu geöffnet wird.
- Deployment-Fix 1.5.1: Die Laufzeitprüfung erkennt die Platzhalter-URL weiterhin, ohne den verbotenen Deployment-Marker selbst in das finale Pages-Artefakt einzubetten.

## Betrieb

- Pages: `https://Rinderbuegen.github.io/Vermietung/DGH/` und `https://Rinderbuegen.github.io/Vermietung/Gemeindehaus/`.
- Demo: `tools/demo-server.cmd`, Caddy/mkcert, HTTPS auf `localhost:8443` und optional im LAN.
- Tests: Die Pflichtmatrix umfasst Build und Pages-Verifikation, Content-, Modulgraph- und Runtime-Tests, `npm test`, Apps-Script- und Service-Worker-Tests sowie `tests/browser.test.py` getrennt für Chromium, Firefox und WebKit. `tests/pwa-browser.test.py` prüft mit Chromium zusätzlich echte Service Worker, Offline-Neuladen und Scope-Isolation; `tools/test-demo.py` bleibt eine schnelle Zusatzprüfung.
- Workflow: `.github/workflows/pages.yml` prüft Pushes, Pull Requests und Wiederholungsläufe ohne Deploymentsecret. Nach grüner Qualität auf `main` wartet Pages auf die Freigabe im geschützten Environment `github-pages`; diese erfolgt erst nach Backend-, Migrations- und Datenschutzchecks. `workflow_dispatch` startet einen Wiederholungslauf.

## Datenschutz

Öffentlich erscheinen Datum, Uhrzeit, Status und optional ausdrücklich freigegebener Titel oder Veranstalter. Der Browserdruck enthält ausschließlich diesen bereits geladenen öffentlichen Belegungssnapshot. Namen, Kontaktdaten, interne Notizen und Anfragehistorie bleiben im Backend, sofern ein Betreiber sie nicht bewusst als öffentlichen Veranstalter freigibt. Freigegebene Details können offline bis zu 24 Stunden sichtbar bleiben. Vor Freigabe von Personennamen oder `mailto:`-Links muss die Datenschutzerklärung fertig und geprüft sein. Keine vertraulichen Werte oder Sicherheitsfreigaben unter `betreiber/**/konfiguration/frontend.json` ablegen.
