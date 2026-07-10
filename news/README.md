# News / Hinweise

Markdown-Dateien mit Hinweisen für Gebäude. Erscheinen in der App als Hinweis-Karten.

## Ordnerstruktur

```
news/
  dgh_rb/          ← Dorfgemeinschaftshaus Rinderbügen
  ev_gem_rb/       ← Evangelisches Gemeindehaus Rinderbügen
  common/          ← gilt für alle Gebäude (optional)
```

Dateien in `common/` gelten für alle Gebäude.

## Dateityp

Nur **Markdown** (`.md`) mit Frontmatter.

## Dateibenennung

Klein, mit Bindestrichen, sinnvoller Inhalt:

```
2026-07-urlaub.md
2026-08-hinweis-sperrung.md
```

## Frontmatter (Pflicht)

```yaml
---
title: Urlaub in den Sommerferien
date: 2026-07-10
type: info
active: true
valid_from: 2026-07-01
valid_until: 2026-08-15
sort_order: 10
---
```

| Feld | Pflicht | Format | Beschreibung |
|------|---------|--------|--------------|
| `title` | ja | Text | Überschrift |
| `date` | ja | `YYYY-MM-DD` | Erstelldatum |
| `type` | nein | Text | Siehe Typen unten |
| `active` | nein | `true`/`false` | Standard: `true` |
| `valid_from` | nein | `YYYY-MM-DD` | Anzeige ab |
| `valid_until` | nein | `YYYY-MM-DD` | Anzeige bis |
| `sort_order` | nein | Zahl | Kleinere Zahl = weiter oben |

### Typen

| Typ | Verwendung |
|-----|------------|
| `info` | Allgemeine Information (Standard) |
| `warnung` | Warnung |
| `urlaub` | Urlaubszeiten |
| `anfahrt` | Anfahrt / Wegbeschreibung |
| `veranstaltung` | Veranstaltung |

## Textkörper

Nach dem Frontmatter kommt der Text in Markdown:

```md
---
title: Sperrung Parkplatz
date: 2026-07-10
type: warnung
active: true
---

Der Parkplatz ist vom **15. bis 20. Juli** gesperrt.

Bitte nutzen Sie die Ausweichparkplätze.
```

## Bilder in Markdown

Bilder können eingebunden werden, müssen aber im Repository liegen.

### Empfohlener Ordner

```
assets/images/news/
  dgh_rb/
  ev_gem_rb/
  common/
```

### Syntax

```md
![Beschreibung](../../assets/images/news/dgh_rb/parkplatz.jpg)
```

Pfade sind relativ zur `.md`-Datei.

### Einschränkungen

- Nur **lokale Dateien** im Repository — externe URLs funktionieren nicht.
- Formate: JPG, PNG, SVG empfohlen.
- Dateigröße: keine technische Grenze (GitHub erlaubt bis 100 MB). Empfehlung: unter 500 KB für Performance.
- Der Generator extrahiert den Body als Text — Bilder werden in der App als HTML gerendert.

### Alternative: Externe Bilder

Wenn Bilder auf Google Drive liegen, kann man den Sharing-Link verwenden:

```md
![Bild](https://drive.google.com/uc?id=FILE_ID)
```

Achtung: Externe Bilder brauchen Internet und können offline nicht angezeigt werden.

## Neuen Hinweis anlegen

1. `.md`-Datei in den passenden Ordner legen (`dgh_rb/`, `ev_gem_rb/` oder `common/`).
2. Frontmatter ausfüllen.
3. Textkörper schreiben.
4. Optional: Bilder in `assets/images/news/` ablegen und verlinken.
5. Committen und pushen.

Keine App-Konfiguration nötig — der Index wird automatisch erzeugt.

## Besonderheiten

- Ohne Frontmatter wird die Datei ignoriert.
- `active: false` blendet den Hinweis aus, ohne ihn zu löschen.
- `valid_from` / `valid_until` ermöglichen zeitgesteuerte Ein-/Ausblendung.
- Der Hinweis erscheint nur, wenn das Datum zwischen `valid_from` und `valid_until` liegt (oder diese Felder fehlen).
