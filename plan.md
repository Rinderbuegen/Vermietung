# Plan: Sichtbaren Wechsel des Hero-Hinweises beseitigen

## 1. Auftrag

Nach dem Neuladen einer Gebäudeseite erscheint unter dem Hausnamen zunächst ein längerer Hinweis. Nach der Antwort der Gebäude-API wird dieser sichtbar durch einen kürzeren Text ersetzt. Dieser Textwechsel soll verschwinden.

Festgelegtes Sollverhalten:

- Der längere Frontendtext bleibt dauerhaft sichtbar:
  > Prüfen Sie freie Zeiten und senden Sie eine unverbindliche Anfrage. Die verbindliche Bestätigung erfolgt durch den Betreiber.
- `building.publicNote` aus der Gebäude-API wird nur verwendet, wenn kein nichtleerer Frontendtext konfiguriert ist.
- Das Verhalten muss für `/DGH/` und `/Gemeindehaus/` gelten.
- Bestehendes Offline-, PWA- und API-Verhalten darf nicht beeinträchtigt werden.

## 2. Projektkontext

- Repository: `C:\dev\Vermietung`
- Aktuelle dokumentierte Version: `1.4.3`
- Frontend: statisch gebaute PWA aus `index.html`, `assets/` und Betreiberkonfiguration
- Backend: öffentliche Google-Apps-Script-API mit Google Sheets
- Generiertes Artefakt: `_site/`; niemals manuell bearbeiten
- Sichtbare UI-Texte: `betreiber/allgemein/texte/frontend.json` mit optionalen Gebäude-Overrides
- Gebäudescopes: `/DGH/` und `/Gemeindehaus/`

Vor Änderungen `AGENTS.md`, `DESIGN.md` und `PROJEKTUEBERSICHT.md` lesen. Bestehende fremde Änderungen im Arbeitsbaum nicht zurücksetzen oder überschreiben.

## 3. Bestätigte Ursache

Es gibt zwei konkurrierende Textquellen.

### 3.1 Sofort sichtbarer Frontendtext

`index.html:61` enthält:

```html
<p class="lead" data-public-note>{{publicNote}}</p>
```

`scripts/build-pages-site.py` ersetzt `{{publicNote}}` beim Build mit dem Wert aus `betreiber/allgemein/texte/frontend.json:15`:

```text
Prüfen Sie freie Zeiten und senden Sie eine unverbindliche Anfrage. Die verbindliche Bestätigung erfolgt durch den Betreiber.
```

Dieser Text befindet sich bereits im ausgelieferten HTML und ist beim ersten Rendern sofort sichtbar.

### 3.2 Verzögerte API-Überschreibung

Nach `DOMContentLoaded` ruft `assets/js/app.js:598` asynchron `loadBuilding()` auf. Nach der Netzwerkantwort überschreibt `assets/js/app.js:356-357` den vorhandenen Absatz:

```js
const note = document.querySelector("[data-public-note]");
if (note && building.publicNote) note.textContent = building.publicNote;
```

Die API-/Sheet-Ausgangswerte stehen in `betreiber/allgemein/backend/konfiguration.json:9,19` und lauten:

```text
Bitte prüfen Sie freie Zeiten und senden Sie eine unverbindliche Anfrage.
```

Die Verzögerung entsteht durch Fetch, Apps-Script-Start und Sheet-Zugriff. Es gibt keine CSS-Fade-Animation. Die direkte `textContent`-Mutation und der damit verbundene Layoutwechsel wirken optisch wie ein Überblenden.

### 3.3 Widerspruch zur dokumentierten Priorität

`docs/google-sheet-struktur.md:13` und `PROJEKTUEBERSICHT.md:17` definieren sichtbare Frontendtexte als führende Quelle. Werte aus `Buildings` dienen der API und als Fallback. `loadBuilding()` setzt diese Priorität bei Name, Betreiber und Kontakt bereits um, beim Hero-Hinweis jedoch nicht.

## 4. Lösungsentscheidung

Frontendtext priorisieren, API-Text nur als Fallback verwenden.

Nicht umsetzen:

- Texte nur zufällig angleichen: beseitigt die doppelte Wahrheitsquelle nicht und kann später erneut auseinanderlaufen.
- Hero bis zur API-Antwort ausblenden: verschlechtert First Paint, Offlinebetrieb, Barrierefreiheit und SEO.
- Gebäude-API nicht mehr aufrufen: Name, Betreiber und Kontakt benötigen weiterhin API-Fallbacks.
- API-Text mit HTML rendern: `textContent` muss aus Sicherheitsgründen erhalten bleiben.
- Service Worker, Apps Script, Sheet-Schema oder Buildsystem ändern: für diesen Fehler unnötig.

## 5. Geplante Änderungen

### 5.1 `assets/js/app.js`

In `loadBuilding()` nur die Hero-Hinweislogik ändern. Beide Quellen defensiv als nichtleere Strings prüfen:

```js
const note = document.querySelector("[data-public-note]");
const frontendPublicNote = typeof texts.publicNote === "string" ? texts.publicNote.trim() : "";
const buildingPublicNote = typeof building.publicNote === "string" ? building.publicNote.trim() : "";

if (note && !frontendPublicNote && buildingPublicNote) {
  note.textContent = building.publicNote;
}
```

Anforderungen an die Implementierung:

- Ein nichtleerer `texts.publicNote` gewinnt immer.
- Fehlender, falscher oder nur aus Leerraum bestehender Frontendwert gilt als nicht konfiguriert.
- Fehlender, falscher oder leerer API-Wert verändert das DOM nicht.
- Der API-Fallback bleibt `textContent`; kein `innerHTML`.
- Der restliche Ablauf von `loadBuilding()` bleibt unverändert.
- Keine neue Hilfsfunktion oder Abstraktionsschicht einführen.

### 5.2 `tests/browser.test.py`

Eine deterministische Regression ergänzen. Der Test muss gegen den aktuellen fehlerhaften Code scheitern und nach dem Fix grün sein.

Testfälle:

| Scope | Frontendtext | API-Text | Erwartung nach API-Antwort |
|---|---|---|---|
| `/DGH/` | längerer Text | abweichender DGH-Text | längerer Text bleibt |
| `/Gemeindehaus/` | längerer Text | abweichender Gemeindehaus-Text | längerer Text bleibt |
| `/DGH/` | leer | abweichender DGH-Text | DGH-API-Text erscheint |
| `/Gemeindehaus/` | leer | abweichender Gemeindehaus-Text | Gemeindehaus-API-Text erscheint |

Testgestaltung:

1. Gebäudeantworten im Mock pro `buildingId` eindeutig und bewusst abweichend machen.
2. Gebäudeantwort kontrolliert verzögern; kein festes `sleep()` als Synchronisation verwenden.
3. Vor Freigabe der Antwort den anfänglichen Hero-Text prüfen.
4. Antwort freigeben und auf abgeschlossene Verarbeitung warten.
5. Danach den exakten endgültigen Hero-Text prüfen.
6. Beim Fallbacktest sowohl `config.texts.publicNote` als auch den ausgelieferten HTML-Ausgangstext im Test-Mock leer halten. Der echte Build erzeugt beide aus derselben Quelle; der Test muss diesen Zustand realistisch nachbilden.
7. Testzustand nach jedem Fall isolieren, damit bestehende Belegungs-, Offline- und Scope-Tests unverändert bleiben.

Bevorzugte Synchronisation:

- Vor App-Start `window.fetch` mit `context.add_init_script()` instrumentieren.
- Nur Requests mit `action=building` über ein eigenes Promise-Gate halten.
- Einen Status setzen, sobald die native Mockantwort eingetroffen ist.
- Mit expliziten `wait_for_function()`-Bedingungen warten.
- Für den absichtlich offenen Request `page.goto(..., wait_until="domcontentloaded")` statt `networkidle` verwenden.

Die bereits vorhandenen Occupancy-Gates dürfen nicht in ihrer Semantik verändert werden.

### 5.3 `README.md`

Nach erfolgreicher Implementierung und grünen relevanten Tests die Patchversion von `1.4.3` auf `1.4.4` erhöhen. Keine Backend-, Sheet- oder Schemazahl ändern.

### 5.4 `PROJEKTUEBERSICHT.md`

Nach erfolgreicher Implementierung und grünen relevanten Tests:

- Version `1.4.3` auf `1.4.4` erhöhen.
- Im Abschnitt zu Textquellen knapp dokumentieren: Ein nichtleerer Frontend-Hinweis hat Vorrang; `building.publicNote` aus der Gebäude-API ist nur Fallback.

### 5.5 Nicht zu ändernde Dateien

- `betreiber/allgemein/texte/frontend.json`: gewünschter längerer Wortlaut ist bereits korrekt.
- `betreiber/allgemein/backend/konfiguration.json`: API-Werte dürfen als unabhängige Fallbackwerte bestehen bleiben.
- `apps-script/**`: keine Backendänderung erforderlich.
- `scripts/build-pages-site.py`: Priorität wird zur Laufzeit korrigiert; Build ist korrekt.
- `service-worker.js`: neuer Cachehash entsteht beim Build automatisch aus geänderten Assets.
- `DESIGN.md`: keine visuelle Designregel ändert sich.
- `_site/**`: nur generieren, niemals manuell editieren.

## 6. Umsetzungsreihenfolge

- [ ] 1. `git status --short` prüfen und fremde Änderungen dokumentieren, aber nicht verändern.
- [ ] 2. Aktuelle Stellen in `assets/js/app.js`, `tests/browser.test.py`, `README.md` und `PROJEKTUEBERSICHT.md` erneut lesen.
- [ ] 3. Browser-Regression für Priorität und Fallback ergänzen.
- [ ] 4. In `loadBuilding()` die minimale Prioritätsprüfung implementieren.
- [ ] 5. `_site/` mit `python scripts/build-pages-site.py` neu erzeugen.
- [ ] 6. Relevante Tests ausführen und Fehler beheben.
- [ ] 7. Version in `README.md` und `PROJEKTUEBERSICHT.md` auf `1.4.4` erhöhen; Projektübersicht um die Textpriorität ergänzen.
- [ ] 8. Build erneut erzeugen und vollständige Qualitätsmatrix ausführen.
- [ ] 9. Abschließenden Diff auf unbeabsichtigte Dateien, private Daten und manuelle `_site`-Änderungen prüfen.
- [ ] 10. Nicht committen, pushen oder deployen, solange dies nicht ausdrücklich beauftragt wurde.

## 7. Verifikation

Gezielte Prüfung während der Umsetzung:

```pwsh
python scripts/build-pages-site.py
python scripts/verify-pages-site.py
python tests/content-build.test.py
python tests/browser.test.py
```

Nach Versions- und Dokumentationsänderung vollständige Pflichtmatrix aus dem Repository-Root:

```pwsh
python scripts/build-apps-script.py
python scripts/build-pages-site.py
python scripts/verify-pages-site.py
python tests/content-build.test.py
python tests/configure-runtime.test.py
node tests/apps-script.test.js
node tests/restricted-markdown.test.js
node tests/frontend-core.test.js
node tests/service-worker.test.js
python tests/browser.test.py
```

Es gibt derzeit kein separates Lint- oder Typecheck-Skript.

Zusätzliche manuelle Prüfung, falls lokale Demo-/Runtime-Konfiguration vorhanden ist:

1. `/DGH/` mit geleertem Cache beziehungsweise hart neu laden.
2. Netzwerk drosseln, damit die Gebäudeantwort sichtbar verzögert ist.
3. Prüfen, dass der längere Hinweis vom ersten Paint bis nach der API-Antwort unverändert bleibt.
4. Dasselbe unter `/Gemeindehaus/` wiederholen.
5. Offline neu laden und prüfen, dass der statische Frontendtext sichtbar bleibt.
6. Bei 390 px Breite prüfen, dass kein Layoutsprung oder horizontaler Overflow entsteht.

## 8. Akzeptanzkriterien

- [ ] Beim Reload ist vom ersten Paint an nur der längere Frontendtext sichtbar.
- [ ] Eine verspätete, abweichende Gebäudeantwort mutiert den Hero-Hinweis nicht, wenn `texts.publicNote` nichtleer ist.
- [ ] Bei fehlendem oder nur aus Leerraum bestehendem Frontendtext erscheint ein nichtleerer API-Text als Fallback.
- [ ] Bei leerem oder ungültigem API-Text bleibt der vorhandene DOM-Inhalt unverändert.
- [ ] DGH und Gemeindehaus verhalten sich identisch bezüglich der Priorität und verwenden ihren eigenen API-Fallback.
- [ ] Name, Betreiber und Kontakt laden weiterhin wie zuvor.
- [ ] Keine neue Fade-, Hide- oder Loading-Animation kaschiert den Fehler nur optisch.
- [ ] Kein `innerHTML` und keine neue XSS-Fläche.
- [ ] Offlinebetrieb, Service Worker und bestehende Belegungsfunktionen bleiben grün.
- [ ] `README.md` und `PROJEKTUEBERSICHT.md` nennen Version `1.4.4`.
- [ ] Vollständige Qualitätsmatrix läuft grün.
- [ ] Keine Datei unter `_site/` wurde manuell geändert.

## 9. Rollback

Bei einer Regression nur die zusammengehörige Änderung in `assets/js/app.js`, den neuen Regressionstest und die Versions-/Dokumentationsanpassung zurücknehmen. Keine generierten `_site`-Dateien manuell zurückkopieren. Backend, Apps Script, Google Sheets, Manifest und Service Worker benötigen keinen Rollback, weil sie nicht geändert werden.

## 10. Hinweis für neuen ChatGPT-Kontext

Dieser Plan enthält bereits die geklärte Produktentscheidung. Nicht erneut fragen, welcher Wortlaut bleiben soll: Der längere Frontendtext ist verbindlich. Vor Implementierung trotzdem den aktuellen Arbeitsbaum und die aktuellen Dateiinhalte prüfen, da parallele Änderungen möglich sind. Kleinste korrekte Änderung bevorzugen und bestehende fremde Änderungen unangetastet lassen.
