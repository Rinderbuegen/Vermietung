# Betreiberkonfiguration

Einzige Pflegewurzel ist `betreiber/`. `allgemein` enthält gemeinsame Konfiguration, Texte, Backendwerte, Inhalte und Icons. `DGH` und `EV_GEMEINDEHAUS` enthalten Gebäude-Overrides.

Die zentrale Registry `betreiber/allgemein/konfiguration/registry.json` bildet internen Bereich, `publicPath` und `buildingId` ab. Öffentliche Pfade und IDs nicht umbenennen.

Frontendwerte stehen in `konfiguration/frontend.json`, sichtbare Texte in `texte/frontend.json` und Rechtstexte ausschließlich in `allgemein/texte/rechtliches.md`. Gebäudeüberschreibungen werden nach gemeinsamen Werten geladen. JSON-Objekte werden rekursiv zusammengeführt; News und Downloads überschreiben über relative Pfade beziehungsweise stabile IDs.

Keine Secrets in Frontendkonfiguration ablegen. `apiBaseUrl` ist öffentlich und wird beim Deployment aus `APPS_SCRIPT_WEB_APP_URL` gesetzt.

Build: `python scripts/build-pages-site.py`. Das Ergebnis `_site` nie als Quelle bearbeiten.
