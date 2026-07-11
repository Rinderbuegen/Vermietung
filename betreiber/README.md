# Betreiberdateien

Hier liegen ausschließlich anpassbare Dateien. Technischer Anwendungscode liegt außerhalb.

Die stabilen internen Bereiche sind `allgemein`, `DGH` und `EV_GEMEINDEHAUS`. Die Registry `allgemein/konfiguration/registry.json` ordnet Bereiche den öffentlichen Pfaden `/DGH/`, `/Gemeindehaus/` und den unveränderten IDs `dgh_rb`, `ev_gem_rb` zu.

Beim Build gilt: Werte und Inhalte aus `allgemein` werden zuerst geladen, gleichnamige Einträge des Gebäudes überschreiben sie über stabile IDs beziehungsweise relative Dateipfade. Dies gilt insbesondere für News und Downloads. Ein Scope enthält nur `allgemein` und sein eigenes Gebäude.

Nur `downloads/oeffentlich` wird veröffentlicht; relative Unterordner bleiben erhalten. Bearbeitbare Quellen wie `.odt` gehören nach `downloads/quellen` und werden nie kopiert. Rechtstexte werden allein aus `allgemein/texte/rechtliches.md` gebaut.

`assets/data/*.json`, Manifest, Laufzeitkonfiguration und deploybare Apps-Script-Dateien erzeugen die Skripte im Build.
