# Umsetzungsplan und Abschlussstand: Nativer ESM-Refactor

## Ziel

Das bisherige klassische Frontend wird in Version 1.5.0 durch einen direkt im Browser ausgeführten ESM-Modulgraphen ersetzt. Build, Laufzeitkonfiguration, PWA-Scope-Isolation und Datenschutzgrenzen bleiben erhalten; ein sichtbarer Designwechsel ist nicht Bestandteil des Refactors.

## Belegter Implementierungsstand

Die Häkchen bezeichnen im Repository vorhandenen Code und zugehörige Tests beziehungsweise Workflow-Konfiguration. Sie bestätigen noch keinen vollständigen grünen Abschlusslauf.

- [x] `assets/js/main.js` ist einziger Moduleinstieg und Composition Root.
- [x] Zuständigkeiten sind in `config`, `domain`, `infrastructure`, `features`, `shared` und `pwa` getrennt.
- [x] Alte klassische Frontenddateien sind aus dem Einstieg entfernt; statische relative Imports, exakte Groß-/Kleinschreibung, Scope und Erreichbarkeit werden geprüft.
- [x] Das klassische `config/config.js` setzt vor dem ESM-Einstieg ausschließlich `window.APP_CONFIG`; die Laufzeitkonfiguration wird validiert, kopiert und eingefroren.
- [x] Der scope-eigene Service Worker bleibt klassisch, alle erreichbaren ESM-Dateien liegen im Precache und Root bleibt ohne Worker.
- [x] Der Belegungscache verwendet `occupancy:v3` und projiziert API-Einträge auf `date`, `from`, `to`, `allDay`, `status`, `statusKey`, `publicTitle` und `publicOrganizer`.
- [x] Unit- und Integrationsprüfungen decken Domain, Infrastruktur, Formulare, Markdown, Modulgraph, Build, Apps Script und Service Worker ab.
- [x] Der Workflow definiert `tests/browser.test.py` für Chromium, Firefox und WebKit sowie `tests/pwa-browser.test.py` separat für Chromium mit echten Service Workern.
- [x] README, Projektübersicht und lokale Demo-Anleitung dokumentieren Version 1.5.0, Architektur, Browsermatrix und PWA-Aktualisierungsschnitt.

## Bewusste Kompatibilitätsgrenze

Alte installierte PWA-Versionen erhalten beim Wechsel auf 1.5.0 keine Legacy-Skriptkompatibilität. Für die Aktualisierung muss die installierte PWA online geöffnet werden. Danach alle alten PWA-Fenster und Browser-Tabs schließen und die PWA neu öffnen, damit der neue Service Worker aktiviert wird und ausschließlich den ESM-Stand ausliefert.

## Erledigtes Abschlussgate

- [x] Vollständige Qualitätsmatrix in einem sauberen Abschlusslauf erfolgreich ausgeführt:

```pwsh
python scripts/build-apps-script.py
python scripts/build-pages-site.py
python scripts/verify-pages-site.py
python tests/content-build.test.py
python tests/frontend-modules.test.py
python tests/configure-runtime.test.py
npm test
node tests/apps-script.test.js
node tests/service-worker.test.js
python tests/browser.test.py --browser chromium
python tests/browser.test.py --browser firefox
python tests/browser.test.py --browser webkit
python tests/pwa-browser.test.py
```

Ergebnis: Alle Build-, Verifier-, Content-, Modulgraph-, Runtime-, Apps-Script- und Service-Worker-Prüfungen waren erfolgreich. `npm test` bestand mit 34/34 Tests; die Browserläufe mit Chromium, Firefox und WebKit sowie der separate Chromium-PWA-Offline-Test waren ebenfalls erfolgreich.

Einmalige Playwright-Vorbereitung:

```pwsh
python -m pip install playwright==1.61.0
python -m playwright install chromium firefox webkit
```

Nach dem Abschlusslauf den Arbeitsbaum auf unbeabsichtigte Dateien und sensible Laufzeitwerte prüfen. Commit, Push und Deployment bleiben separate, ausdrücklich freizugebende Schritte.
