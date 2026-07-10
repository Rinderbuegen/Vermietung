# GitHub-Pages-Links Für Die Gebäude

Das Projekt liegt unter `https://github.com/Rinderbuegen/Vermietung` und wird als GitHub-Pages-Projektseite veröffentlicht.

## Empfohlen: Ein Repository, Zwei Feste Links

Die Nutzer sollen keinen URL-Parameter eintippen. Deshalb erzeugt die GitHub-Action zwei feste Unterseiten aus derselben Codebasis.

GitHub-Pages-Basislink:

```text
https://Rinderbuegen.github.io/vermietung/
```

Gebäudelinks:

```text
https://Rinderbuegen.github.io/vermietung/DGH/
https://Rinderbuegen.github.io/vermietung/Gemeindehaus/
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

Die Datei `assets/js/config.js` enthält beide Gebäudekonfigurationen. Die GitHub-Action kopiert dieselbe App nach `DGH/` und `Gemeindehaus/`.

Lokal kann dieselbe Ausgabe erzeugt werden:

```pwsh
python scripts/build-content-index.py
python scripts/build-pages-site.py
python scripts/configure-runtime.py "https://script.google.com/macros/s/.../exec" _site
python -m http.server 8080 --directory _site
```

Danach testen:

```text
http://localhost:8080/DGH/
http://localhost:8080/Gemeindehaus/
```

## GitHub-Konfiguration

- `Settings -> Pages -> Source`: `GitHub Actions`.
- `Settings -> Secrets and variables -> Actions -> Secrets`: `APPS_SCRIPT_WEB_APP_URL` mit der Apps-Script-Web-App-URL `/exec` anlegen.
- Das Secret verhindert nur, dass die URL im öffentlichen Repository steht. Im ausgelieferten JavaScript ist sie weiter sichtbar.
- Der Workflow nutzt keine weiteren Secrets.
