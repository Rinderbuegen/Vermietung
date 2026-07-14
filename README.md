# Gebäudevermietung PWA

Version 1.4.3. Statische, offlinefähige PWA für Dorfgemeinschaftshaus und Evangelisches Gemeindehaus Rinderbügen. Öffentliche Belegung und Formulare nutzen eine Google-Apps-Script-Web-App; private Daten bleiben in Google Sheets.

## Öffentliche URLs und IDs

| Betreiberbereich | URL | Gebäude-ID |
|---|---|---|
| `DGH` | `/DGH/` | `dgh_rb` |
| `EV_GEMEINDEHAUS` | `/Gemeindehaus/` | `ev_gem_rb` |

Die verbindliche Zuordnung steht in `betreiber/allgemein/konfiguration/registry.json`. Root bleibt ein DGH-kompatibler Standard, registriert aber bewusst keinen Service Worker, entfernt gegebenenfalls eine ältere Root-Registrierung und kontrolliert daher keine Gebäude-Unterpfade.

## Betreiberpflege

Alle anpassbaren Dateien liegen ausschließlich unter `betreiber/` in `allgemein`, `DGH` und `EV_GEMEINDEHAUS`. Fachordner: `konfiguration`, `texte`, `backend`, `news`, `downloads/oeffentlich`, `downloads/quellen`, `bilder/news`; gemeinsame Icons liegen unter `allgemein/icons`.

Build-Regel: `allgemein` wird zuerst geladen. Das gewählte Gebäude überschreibt gleiche stabile IDs oder relative Dateipfade. Download-Unterverzeichnisse bleiben öffentlich erhalten. Jeder Scope veröffentlicht nur `allgemein` plus eigenes Gebäude. Nur PDF-Dateien aus `downloads/oeffentlich` werden publiziert; `.odt` und sonstige Quellen bleiben in `downloads/quellen`.

`assets/data/*.json`, Manifest, Laufzeitkonfiguration und Service Worker sind reine Buildprodukte in `_site`.

## Build und Prüfung

```pwsh
python scripts/build-apps-script.py
python scripts/build-pages-site.py
python scripts/verify-pages-site.py
python tests/content-build.test.py
python tests/configure-runtime.test.py
node tests/apps-script.test.js
node tests/restricted-markdown.test.js
node tests/frontend-core.test.js
node tests/service-worker.test.js
python tests/browser.test.py
```

Für eine konfigurierte Schnell-Demo zusätzlich:

```pwsh
$env:APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/.../exec"
tools\demo-server.cmd
```

URLs: `https://localhost:8443/Vermietung/DGH/` und `https://localhost:8443/Vermietung/Gemeindehaus/`.

Die Demo prüft lokale Buildpfade, HTTPS und PWA-Verhalten, ersetzt aber weder die vollständige Qualitätsmatrix oben noch Staging- und Live-Prüfungen. Für `tests/browser.test.py` einmalig `python -m pip install playwright==1.61.0` und `python -m playwright install chromium` ausführen.

## Apps Script und Deployment

Anpassbare Backendwerte, Gebäude-Startdatensätze und Texte stehen unter `betreiber/allgemein/backend/`. `python scripts/build-apps-script.py` erzeugt daraus `apps-script/buchungs-api/Code.gs`; diese Datei ist ohne Browser-Laufzeitabhängigkeit direkt deploybar. `apps-script/buchungsverwaltung/Code.gs` bleibt das direkt einsetzbare gebundene Verwaltungsskript. Rechtstexte stammen ausschließlich aus `betreiber/allgemein/texte/rechtliches.md`; sichtbare Frontendtexte aus `frontend.json` mit optionalen Gebäude-Overrides.

Öffentlich erscheinen Datum, Zeit und Status sowie nur ausdrücklich und fail closed freigegebene Veranstaltungstitel oder Veranstalter. Eingeschränktes Markdown wird sicher gerendert. Freigegebene Details können für Offlinebetrieb bis zu 24 Stunden ab Abruf auf demselben Gerät zwischengespeichert bleiben; private Anfragefelder bleiben im Backend.

Die vollständige Datenschutzerklärung ist harte Voraussetzung, bevor Personennamen oder `mailto:`-Links als öffentliche Veranstalterdetails freigegeben werden. Solange der Rechtstext noch einen Platzhalter enthält, `public_show_booking_details` nicht aktivieren.

## Belegung

Ein Zeitraumwechsel aktualisiert die Belegung automatisch; der Wechsel zwischen Plan und Liste rendert nur bereits geladene Daten. „PDF erstellen / drucken“ erstellt aus einem eingefrorenen Snapshot öffentlicher Belegungsdaten eine A4-Druckansicht im Browser-Druckdialog. Offline oder möglicherweise veraltete Daten sind im Ausdruck markiert.

Bestätigte Einträge zeigen keinen redundanten Badge „belegt“. Gesperrte und unbekannte Status behalten ihn; Kalender, Legende und ARIA-Texte verwenden „belegt“ weiterhin.

GitHub Actions prüft Pull Requests ohne Secrets. Nach grüner Qualitätsprüfung auf `main` läuft die Pages-Bereitstellung bis zur Freigabe im geschützten Environment `github-pages`; diese darf erst nach Backend-, Migrations- und Datenschutzchecks erfolgen. `workflow_dispatch` dient zum Wiederholen. Die Web-App-URL wird ausschließlich beim Deployment aus `APPS_SCRIPT_WEB_APP_URL` in `_site` eingesetzt und ist im Browser technisch öffentlich. Echte Secrets dürfen nie in Frontend-Betreiberdateien stehen.

Weitere Anleitungen: `docs/betreiber-konfiguration.md`, `docs/github-content.md`, `docs/apps-script-deployment.md`, `docs/github-pages-links.md`, `docs/lokaler-demo-server.md`.
