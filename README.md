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

## Lokale Demo

Die produktionsnahe lokale Demo wird unter Windows über `tools/demo-server.cmd` gestartet. Das Werkzeug baut dieselbe Pfadstruktur wie GitHub Pages und stellt sie mit Caddy und einem von mkcert erzeugten lokalen HTTPS-Zertifikat bereit. Dadurch lassen sich Service Worker, PWA-Verhalten und Tests auf anderen Geräten im privaten LAN sinnvoll prüfen.

Voraussetzungen sind Windows mit `winget`, Python 3 und Node.js. Die Apps-Script-URL wird nur für die aktuelle PowerShell-Sitzung gesetzt:

```pwsh
$env:APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/.../exec"
tools\demo-server.cmd
```

Danach öffnen:

```text
https://localhost:8443/Vermietung/DGH/
https://localhost:8443/Vermietung/Gemeindehaus/
```

Die frühere Anleitung mit `python -m http.server` wurde ersetzt: Ein einfacher HTTP-Server bildet HTTPS, Zertifikatsvertrauen, LAN-Zugriff und PWA-Sicherheitsanforderungen nicht ausreichend ab.

Ausführliche Anleitung einschließlich Installation, LAN-IP, Firewall, Android/iOS, CA-Entfernung, Build, GitHub Actions, Playwright und Fehlerbehebung: [`docs/lokaler-demo-server.md`](docs/lokaler-demo-server.md).

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
https://Rinderbuegen.github.io/Vermietung/DGH/
https://Rinderbuegen.github.io/Vermietung/Gemeindehaus/
```

Der Code bleibt trotzdem nur einmal vorhanden. Die GitHub-Action erzeugt die zwei Unterseiten beim Deployment automatisch.

Vor dem ersten Deployment in GitHub konfigurieren:

```text
Settings -> Pages -> Source: GitHub Actions
Settings -> Secrets and variables -> Actions -> Secrets:
APPS_SCRIPT_WEB_APP_URL = https://script.google.com/macros/s/.../exec
```

Die Apps-Script-Web-App-URL ist in der ausgelieferten statischen App öffentlich sichtbar. Das Secret verhindert nur, dass die URL im öffentlichen Repository steht.

Lokal erzeugt `tools/demo-server.cmd` dieselbe Ausgabe und stellt sie über HTTPS bereit. Zuvor die URL nur für die aktuelle Sitzung setzen:

```pwsh
$env:APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/.../exec"
tools\demo-server.cmd
```

Danach öffnen: `https://localhost:8443/Vermietung/DGH/` und `https://localhost:8443/Vermietung/Gemeindehaus/`.

**Produktionswarnung:** Verweist `APPS_SCRIPT_WEB_APP_URL` auf die produktive Web-App, können Formularaufrufe echte Daten in den produktiven Google Sheets anlegen. Für Formular- und Automatisierungstests eine getrennte Testbereitstellung mit Testtabellen verwenden.

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

## Nicht Enthalten In Version 1.1

- keine Adminoberfläche
- keine Benutzerverwaltung
- kein Login
- keine eigene Datenbank
- kein Node.js-Backend
- keine Zahlungsfunktion
- keine Vertragsautomatisierung
- keine komplexe Kalenderkomponente
