# Gebäudevermietung PWA

Kleine statische PWA für öffentliche Gebäudevermietung. Die App läuft ohne Node.js-Backend auf GitHub Pages und spricht eine Google-Apps-Script-Web-App an. Die Daten liegen in privaten Google Sheets.

Repository: `https://github.com/Rinderbuegen/Vermietung`

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

Globale Werte stehen in `config/config.js`, zum Beispiel die Apps-Script-URL:

```js
apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
```

Gebäudespezifische Werte stehen in eigenen Dateien:

- `config/DGH/config.js`
- `config/Gemeindehaus/config.js`

Dort werden unter anderem `buildingId`, Hero-Texte, Betreibername, mehrzeilige Kontaktdaten und Theme-Farben gepflegt.

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
7. URL in `config/config.js` bei `apiBaseUrl` eintragen.

Siehe `docs/apps-script-deployment.md`.

## GitHub Pages

Die App ist statisch. Die GitHub-Action `.github/workflows/pages.yml` erzeugt vor dem Deployment automatisch `assets/data/news.json` und `assets/data/downloads.json`.
Außerdem erzeugt sie die festen Unterseiten `DGH/` und `Gemeindehaus/`.

Produktive Links:

```text
https://Rinderbuegen.github.io/vermietung/DGH/
https://Rinderbuegen.github.io/vermietung/Gemeindehaus/
```

Der Code bleibt trotzdem nur einmal vorhanden. Die GitHub-Action erzeugt die zwei Unterseiten beim Deployment automatisch.

Vor dem ersten Deployment in GitHub konfigurieren:

```text
Settings -> Pages -> Source: GitHub Actions
Settings -> Secrets and variables -> Actions -> Secrets:
APPS_SCRIPT_WEB_APP_URL = https://script.google.com/macros/s/.../exec
```

Die Apps-Script-Web-App-URL ist in der ausgelieferten statischen App öffentlich sichtbar. Das Secret verhindert nur, dass die URL im öffentlichen Repository steht.

Lokal kann dieselbe Ausgabe erzeugt werden:

```pwsh
python scripts/build-content-index.py
python scripts/build-pages-site.py
python scripts/configure-runtime.py "https://script.google.com/macros/s/.../exec" _site
python -m http.server 8080 --directory _site
```

Danach öffnen: `http://localhost:8080/DGH/` und `http://localhost:8080/Gemeindehaus/`.

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
