# News, Downloads und Bilder

Pflegeorte je Bereich:

```text
betreiber/<Bereich>/news/*.md
betreiber/<Bereich>/downloads/oeffentlich/*.pdf
betreiber/<Bereich>/downloads/quellen/*
betreiber/<Bereich>/bilder/news/*
```

`<Bereich>` ist `allgemein`, `DGH` oder `EV_GEMEINDEHAUS`. Allgemeine Dateien gelten für beide Gebäude. Eine Gebäudedatei mit gleichem relativem Pfad überschreibt die allgemeine Datei. News sollten im Frontmatter zusätzlich eine stabile `id` tragen; ohne `id` gilt der Dateiname als ID.

Nur `downloads/oeffentlich` wird in `_site/downloads` kopiert und indexiert. Relative Unterverzeichnisse bleiben erhalten und bilden zugleich die stabile Override-ID. Bearbeitbare Quellen, insbesondere `.odt`, gehören nach `downloads/quellen` und werden niemals ausgeliefert.

Indizes entstehen innerhalb jedes Scopes beim Aufruf von `python scripts/build-pages-site.py`. `assets/data/*.json` im Quellbaum sind verboten.
