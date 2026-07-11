# Gebäudevermietung PWA

Version 1.2. Statische, offlinefähige PWA für Dorfgemeinschaftshaus und Evangelisches Gemeindehaus Rinderbügen. Öffentliche Belegung und Formulare nutzen eine Google-Apps-Script-Web-App; private Daten bleiben in Google Sheets.

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
node tests/service-worker.test.js
```

Für eine konfigurierte Demo zusätzlich:

```pwsh
$env:APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/.../exec"
tools\demo-server.cmd
```

URLs: `https://localhost:8443/Vermietung/DGH/` und `https://localhost:8443/Vermietung/Gemeindehaus/`.

## Apps Script und Deployment

Anpassbare Backendwerte, Gebäude-Startdatensätze und Texte stehen unter `betreiber/allgemein/backend/`. `python scripts/build-apps-script.py` erzeugt daraus `apps-script/buchungs-api/Code.gs`; diese Datei ist ohne Browser-Laufzeitabhängigkeit direkt deploybar. `apps-script/buchungsverwaltung/Code.gs` bleibt das direkt einsetzbare gebundene Verwaltungsskript. Rechtstexte stammen ausschließlich aus `betreiber/allgemein/texte/rechtliches.md`; sichtbare Frontendtexte aus `frontend.json` mit optionalen Gebäude-Overrides.

GitHub Actions baut `_site`, ersetzt dort `apiBaseUrl` aus dem Secret `APPS_SCRIPT_WEB_APP_URL`, prüft Scope-Isolation und veröffentlicht das Ergebnis. Die Web-App-URL ist im Browser technisch öffentlich; echte Secrets dürfen nie in Frontend-Betreiberdateien stehen.

Weitere Anleitungen: `docs/betreiber-konfiguration.md`, `docs/github-content.md`, `docs/apps-script-deployment.md`, `docs/github-pages-links.md`, `docs/lokaler-demo-server.md`.
