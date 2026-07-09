# Projektübersicht

## Zweck

Statische PWA für Gebäudevermietung. Nutzer können öffentliche Belegung sehen, Buchungsanfragen stellen, Hinweise lesen, PDFs öffnen und Kontaktanfragen senden.

## Leitprinzip

Einfaches Werkzeug für Betreiber, die Daten weiter direkt in Google Sheets pflegen. Keine eigene Adminoberfläche und keine eigene Datenbank.

## Technik

- Frontend: HTML, CSS, Vanilla JavaScript.
- Hosting: GitHub Pages.
- Backend/API: Google Apps Script Web-App.
- Betriebsdaten: private Google Sheets.
- Hinweise: Markdown-Dateien im GitHub-Repository mit Frontmatter.
- Downloads: PDF-Dateien im GitHub-Repository, Metadaten aus PDF-Properties.

## Gebäudekonfiguration

- `dgh_rb`: Dorfgemeinschaftshaus Rinderbügen, Spreadsheet `11yws8ZxRB9U2oyeW8hwwC_WTR1AYLao4_iNkZEIwThc`
- `ev_gem_rb`: Evangelisches Gemeindehaus Rinderbügen, Spreadsheet `1GaqxZtkEx_lByT1odJXkS4Rp80Kr4cuLwFWz32Ssq1E`

## Wichtige Dateien

- `index.html`: App-Oberfläche.
- `assets/js/config.js`: Betreiber-/Gebäudekonfiguration.
- `assets/js/api.js`: API-Zugriff auf Apps Script.
- `assets/js/app.js`: App-Logik und Formularverarbeitung.
- `assets/js/ui.js`: Rendering-Helfer.
- `assets/css/app.css`: Designsystem und Layout.
- `service-worker.js`: statischer Offline-Cache.
- `scripts/build-content-index.py`: erzeugt lokale Inhaltsindizes für Hinweise und PDFs.
- `assets/data/news.json`: automatisch erzeugter Hinweisindex.
- `assets/data/downloads.json`: automatisch erzeugter Downloadindex.
- `apps-script/Code.gs`: Google-Apps-Script-Backend.
- `docs/`: Betriebsdokumentation.

## Stand

Version 1 ist bewusst klein gehalten. Normale Nutzer erzeugen nur offene Anfragen. Betreiber entscheiden im Google Sheet.
