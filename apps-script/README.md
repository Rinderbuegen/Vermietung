# Apps Script

`Code.gs` enthält die öffentliche API für die PWA und die Setup-Funktion für die finalen Google Sheets.

## Setup

1. `Code.gs` in ein Google-Apps-Script-Projekt kopieren.
2. `setupSheets()` einmal manuell ausführen.
3. Betreiberwerte im Sheet prüfen.
4. Als Web-App bereitstellen.
5. Web-App-URL in `assets/js/config.js` eintragen.

## Spreadsheet-Zuordnung

```js
dgh_rb    -> Dorfgemeinschaftshaus Rinderbügen, 11yws8ZxRB9U2oyeW8hwwC_WTR1AYLao4_iNkZEIwThc
ev_gem_rb -> Evangelisches Gemeindehaus Rinderbügen, 1GaqxZtkEx_lByT1odJXkS4Rp80Kr4cuLwFWz32Ssq1E
```

## Öffentliche Daten

Die API gibt keine personenbezogenen Request-Daten in `occupancy` oder `building` aus. Hinweise und Downloads laufen nicht über Apps Script, sondern als statische GitHub-Pages-Dateien.
