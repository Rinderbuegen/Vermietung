# Hinweise Und Downloads In GitHub

Hinweise und PDF-Downloads liegen im GitHub-Repository. Dafür gibt es keine Konfiguration im Google Sheet und keinen Drive-Ordner.

## Ordnerstruktur

```text
downloads/
  dgh_rb/
    hausordnung.pdf
  ev_gem_rb/
    hausordnung.pdf
  common/
    allgemeine-information.pdf

news/
  dgh_rb/
    2026-07-urlaub.md
  ev_gem_rb/
    2026-07-hinweis.md
  common/
    allgemeiner-hinweis.md
```

Dateien in `common` gelten für alle Gebäude. Dateien direkt in `downloads/` oder `news/` gelten ebenfalls für alle Gebäude.

## PDF-Metadaten

Der Generator liest nach Möglichkeit diese PDF-Properties:

- `Title` -> angezeigter Titel
- `Subject` -> angezeigte Beschreibung
- `Keywords` -> Ersatzbeschreibung, falls `Subject` leer ist
- `ModDate` oder `CreationDate` -> Datum, falls vorhanden

Wenn kein PDF-Titel gesetzt ist, wird der Dateiname verwendet.

## Markdown-Hinweise

Markdown-Dateien müssen Frontmatter nutzen.

Beispiel:

```md
---
title: Urlaub in den Sommerferien
date: 2026-07-10
type: urlaub
active: true
valid_from: 2026-07-01
valid_until: 2026-08-15
sort_order: 10
---

Während der Sommerferien kann es zu verzögerten Rückmeldungen kommen.

**Buchungsanfragen sind weiterhin möglich.**
```

Felder:

- `title`: Überschrift.
- `date`: Datum im Format `YYYY-MM-DD`.
- `type`: `info`, `warnung`, `urlaub`, `anfahrt` oder `veranstaltung`.
- `active`: `true` oder `false`.
- `valid_from`: optionaler Start der Anzeige.
- `valid_until`: optionales Ende der Anzeige.
- `sort_order`: kleinere Zahl erscheint weiter oben.

## Index Erzeugen

Lokal:

```pwsh
python scripts/build-content-index.py
```

Erzeugt:

```text
assets/data/news.json
assets/data/downloads.json
```

Bei GitHub Pages läuft dieser Schritt automatisch über `.github/workflows/pages.yml`.

## Zero-Konfig-Prinzip

Für neue Downloads oder Hinweise wird keine App-Konfiguration angepasst.

1. Datei in den passenden Ordner legen.
2. PDF-Properties oder Markdown-Frontmatter pflegen.
3. Committen und pushen.
4. GitHub Actions erzeugt den Index und veröffentlicht die Seite.
