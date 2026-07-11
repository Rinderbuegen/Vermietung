# GitHub-Pages-Links Für Die Gebäude

Das Projekt liegt unter `https://github.com/Rinderbuegen/Vermietung` und wird als GitHub-Pages-Projektseite veröffentlicht.

## Empfohlen: Ein Repository, Zwei Feste Links

Die Nutzer sollen keinen URL-Parameter eintippen. Deshalb erzeugt die GitHub-Action zwei feste Unterseiten aus derselben Codebasis.

GitHub-Pages-Basislink:

```text
https://Rinderbuegen.github.io/Vermietung/
```

Gebäudelinks:

```text
https://Rinderbuegen.github.io/Vermietung/DGH/
https://Rinderbuegen.github.io/Vermietung/Gemeindehaus/
```

Vorteile:

- Nutzer öffnen nur normale Links.
- Keine fehleranfälligen Query-Parameter.
- Code bleibt in einem Repository.
- GitHub Actions erzeugt beide Seiten automatisch.

## Wie Die Auswahl Funktioniert

Die App erkennt den Pfad:

```text
/DGH/          -> buildingId dgh_rb
/Gemeindehaus/ -> buildingId ev_gem_rb
```

Die globale Datei `config/config.js` enthält gemeinsame Werte. Gebäudespezifische Werte stehen getrennt in `config/DGH/config.js` und `config/Gemeindehaus/config.js`. Die GitHub-Action kopiert dieselbe App nach `DGH/` und `Gemeindehaus/`.

## Lokale Links Mit Derselben Pfadstruktur

`tools/demo-server.cmd` baut `_site/` mit denselben Skripten wie GitHub Actions und stellt die beiden Scopes über lokales HTTPS bereit. In PowerShell gilt die Apps-Script-URL nur für die aktuelle Sitzung:

```pwsh
$env:APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/.../exec"
tools\demo-server.cmd
```

Danach lokal testen:

```text
https://localhost:8443/Vermietung/DGH/
https://localhost:8443/Vermietung/Gemeindehaus/
```

Auf einem Gerät im selben privaten LAN wird `localhost` durch die angezeigte LAN-IP des Demo-Servers ersetzt, zum Beispiel:

```text
https://192.168.178.20:8443/Vermietung/DGH/
https://192.168.178.20:8443/Vermietung/Gemeindehaus/
```

Vollständige Anleitung zu Voraussetzungen, Caddy, mkcert, Firewall, Mobilgeräten, Zertifikaten und Tests: [`lokaler-demo-server.md`](lokaler-demo-server.md).

## GitHub-Konfiguration

- `Settings -> Pages -> Source`: `GitHub Actions`.
- `Settings -> Secrets and variables -> Actions -> Secrets`: `APPS_SCRIPT_WEB_APP_URL` mit der Apps-Script-Web-App-URL `/exec` anlegen.
- Das Secret verhindert nur, dass die URL im öffentlichen Repository steht. Im ausgelieferten JavaScript ist sie weiter sichtbar.
- Der Workflow nutzt keine weiteren Secrets.

Einrichtung:

1. Repository `https://github.com/Rinderbuegen/Vermietung` öffnen.
2. `Settings -> Pages` öffnen.
3. Unter `Build and deployment` als `Source` den Wert `GitHub Actions` wählen.
4. Speichern.
