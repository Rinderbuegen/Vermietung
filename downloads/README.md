# Downloads

PDF-Dokumente für Gebäude. Erscheinen in der App unter „Downloads".

## Ordnerstruktur

```
downloads/
  dgh_rb/          ← Dorfgemeinschaftshaus Rinderbügen
  ev_gem_rb/       ← Evangelisches Gemeindehaus Rinderbügen
  common/          ← gilt für alle Gebäude (optional)
```

Dateien in `common/` gelten für alle Gebäude.

## Dateityp

Nur **PDF** wird erkannt. Andere Formate werden ignoriert.

## Dateibenennung

Klein, mit Bindestrichen, ohne Sonderzeichen:

```
hausordnung.pdf
feuerwehr-platz.pdf
```

Dateiname wird als Fallback-Titel verwendet.

## PDF-Metadaten

Der Generator liest folgende Properties aus dem PDF:

| Eigenschaft | Zweck |
|-------------|-------|
| `Title` | Angezeigter Titel in der App |
| `Subject` | Beschreibung unter dem Titel |
| `Keywords` | Ersatzbeschreibung, falls `Subject` leer |
| `ModDate` / `CreationDate` | Datum (Format: `YYYY-MM-DD`) |

Metadaten in Acrobat setzen: **Datei → Eigenschaften → Beschreibung**.

### Empfohlene Werte

```
Title:       Hausordnung
Subject:     Hausordnung für das Dorfgemeinschaftshaus
Keywords:    Hausordnung
```

## Neuen Download anlegen

1. PDF in den passenden Ordner legen (`dgh_rb/`, `ev_gem_rb/` oder `common/`).
2. PDF-Metadaten pflegen (Title, Subject).
3. Committen und pushen.

Keine App-Konfiguration nötig — der Index wird automatisch erzeugt.

## Besonderheiten

- Dateien mit gleichen Namen in `common/` und einem Gebäudeordner: Gebäudeordner gewinnt.
- Der Dateiname `index` ist reserviert.
- Maximale Dateigröße: GitHub erlaubt bis 100 MB pro Datei, aber PDFs sollten deutlich kleiner sein (< 5 MB empfohlen).
