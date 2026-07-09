# Gebäudevermietung PWA

Kleine statische PWA für öffentliche Gebäudevermietung. Die App läuft ohne Node.js-Backend auf GitHub Pages und spricht eine Google-Apps-Script-Web-App an. Die Daten liegen in privaten Google Sheets.

## Architektur

```text
GitHub Pages PWA
  -> statische Hinweise und PDFs aus GitHub Pages
  -> fetch() für Belegung und Formulare
  -> Google Apps Script Web-App
  -> private Google Sheets
```

Die PWA greift nie direkt auf Google Sheets zu. Das Apps Script läuft mit den Rechten des Script-Besitzers und gibt nur öffentliche Daten zurück.
Hinweise und PDFs liegen als Dateien im GitHub-Repository und werden beim Deployment automatisch indexiert.

## Gebäude

```text
dgh_rb    -> Dorfgemeinschaftshaus Rinderbügen
ev_gem_rb -> Evangelisches Gemeindehaus Rinderbügen
```

Beide Gebäude nutzen dieselbe Apps-Script-Schnittstelle. Die Zuordnung zum richtigen Spreadsheet erfolgt im Apps Script über `buildingId`.

## Lokal Testen

Direktes Öffnen per Datei funktioniert teilweise, Service Worker und manche Browserfunktionen brauchen aber HTTP.

```pwsh
python -m http.server 8080
```

Danach öffnen:

```text
http://localhost:8080
```

## Konfiguration

Datei: `assets/js/config.js`

Wichtig:

```js
window.APP_CONFIG = {
  buildingId: "dgh_rb",
  apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
};
```

Für das zweite Gebäude wird nur `buildingId` und sichtbarer Text angepasst:

```js
buildingId: "ev_gem_rb"
```

## Google Apps Script

Für Erstnutzer ist die genaue Anleitung hier beschrieben:

```text
docs/apps-script-deployment.md
```

Kurzfassung:

1. `https://script.google.com/` öffnen.
2. Neues Projekt erstellen.
3. Inhalt aus `apps-script/Code.gs` in `Code.gs` einfügen.
4. `setupSheets()` im Script-Editor ausführen und Berechtigungen erlauben.
5. Als Web-App bereitstellen.
6. Web-App-URL mit `/exec` kopieren.
7. URL in `assets/js/config.js` bei `apiBaseUrl` eintragen.

Siehe `docs/apps-script-deployment.md`.

## GitHub Pages

Die App ist statisch. Die GitHub-Action `.github/workflows/pages.yml` erzeugt vor dem Deployment automatisch `assets/data/news.json` und `assets/data/downloads.json`.
Außerdem erzeugt sie die festen Unterseiten `dgh-rb/` und `ev-gem-rb/`.

Wenn beide Gebäude über ein einziges GitHub-Pages-Repository laufen, sind die Links:

```text
https://<github-name>.github.io/<repo-name>/dgh-rb/
https://<github-name>.github.io/<repo-name>/ev-gem-rb/
```

Beispiel mit Platzhaltern:

```text
https://meinverein.github.io/gebaeudevermietung/dgh-rb/
https://meinverein.github.io/gebaeudevermietung/ev-gem-rb/
```

Der Code bleibt trotzdem nur einmal vorhanden. Die GitHub-Action erzeugt die zwei Unterseiten beim Deployment automatisch.

Wenn jedes Gebäude später ein eigenes GitHub-Pages-Repository bekommt, sind sprechende Repo-Namen empfohlen:

```text
https://<github-name>.github.io/gebaeudevermietung-dgh-rb/
https://<github-name>.github.io/gebaeudevermietung-ev-gem-rb/
```

PDFs werden abgelegt unter:

```text
downloads/dgh_rb/
downloads/ev_gem_rb/
```

Hinweise werden als Markdown mit Frontmatter abgelegt unter:

```text
news/dgh_rb/
news/ev_gem_rb/
```

Siehe `docs/github-content.md`.
Siehe auch `docs/github-pages-links.md`.

## Datenschutz

Die öffentliche Belegung zeigt nur:

- Datum
- Uhrzeit
- Status
- optional öffentlicher Titel

Nicht öffentlich ausgegeben werden Name, E-Mail, Telefonnummer, interne Notizen oder Anfragehistorie.

Vor Veröffentlichung müssen Betreiber die Platzhalter für Datenschutz und Impressum in `index.html` ersetzen oder ergänzen.

## Nicht Enthalten In Version 1

- keine Adminoberfläche
- keine Benutzerverwaltung
- kein Login
- keine eigene Datenbank
- kein Node.js-Backend
- keine Zahlungsfunktion
- keine Vertragsautomatisierung
- keine komplexe Kalenderkomponente
