# Bilder für Hinweise

Bilder, die in Markdown-Hinweisen (`news/`) verwendet werden.

## Ordnerstruktur

```
assets/images/news/
  dgh_rb/          ← Bilder für Dorfgemeinschaftshaus
  ev_gem_rb/       ← Bilder für Evangelisches Gemeindehaus
  common/          ← Bilder für alle Gebäude
```

## Verwendung in Markdown

```md
![Beschreibung](../../../assets/images/news/dgh_rb/parkplatz.jpg)
```

Pfade sind relativ zur `.md`-Datei in `news/`.

## Dateianforderungen

- Formate: JPG, PNG, SVG
- Benennung: klein, mit Bindestrichen, aussagekräftig
- Dateigröße: keine technische Grenze (GitHub erlaubt bis 100 MB). Für Performance empfohlen: unter 500 KB. Bei wenigen Bildern in der PWA aber unkritisch.
