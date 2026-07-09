# GitHub-Pages-Links Für Die Gebäude

Die endgültigen Links hängen vom GitHub-Namen und vom Repository-Namen ab. Diese Namen kennt der Code nicht automatisch.

## Empfohlen: Ein Repository, Zwei Feste Links

Die Nutzer sollen keinen URL-Parameter eintippen. Deshalb erzeugt die GitHub-Action zwei feste Unterseiten aus derselben Codebasis.

GitHub-Pages-Basislink:

```text
https://<github-name>.github.io/<repo-name>/
```

Gebäudelinks:

```text
https://<github-name>.github.io/<repo-name>/dgh-rb/
https://<github-name>.github.io/<repo-name>/ev-gem-rb/
```

Beispiel:

```text
https://meinverein.github.io/gebaeudevermietung/dgh-rb/
https://meinverein.github.io/gebaeudevermietung/ev-gem-rb/
```

Vorteile:

- Nutzer öffnen nur normale Links.
- Keine fehleranfälligen Query-Parameter.
- Code bleibt in einem Repository.
- GitHub Actions erzeugt beide Seiten automatisch.

## Wie Die Auswahl Funktioniert

Die App erkennt den Pfad:

```text
/dgh-rb/    -> buildingId dgh_rb
/ev-gem-rb/ -> buildingId ev_gem_rb
```

Die Datei `assets/js/config.js` enthält beide Gebäudekonfigurationen. Die GitHub-Action kopiert dieselbe App nach `dgh-rb/` und `ev-gem-rb/`.

Lokal kann dieselbe Ausgabe erzeugt werden:

```pwsh
python scripts/build-content-index.py
python scripts/build-pages-site.py
python -m http.server 8080 --directory _site
```

Danach testen:

```text
http://localhost:8080/dgh-rb/
http://localhost:8080/ev-gem-rb/
```

## Optional: Zwei Separate Repositories

Nur sinnvoll, wenn später wirklich getrennte Deployments nötig sind.

Empfohlene Repository-Namen:

```text
gebaeudevermietung-dgh-rb
gebaeudevermietung-ev-gem-rb
```

Links:

```text
https://<github-name>.github.io/gebaeudevermietung-dgh-rb/
https://<github-name>.github.io/gebaeudevermietung-ev-gem-rb/
```

Dann darf nicht manuell in beiden Repos entwickelt werden. Es braucht ein Haupt-Repo, das beide Pages-Repos automatisch befüllt. Für Version 1 ist das unnötig.
