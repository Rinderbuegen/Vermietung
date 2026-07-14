# Implementierungsplan Version 1.3: Freigegebene öffentliche Buchungsdetails

## Zweck und Arbeitsauftrag

Dieser Plan beschreibt die vollständige Erweiterung der statischen PWA von Version 1.2 auf Version 1.3. Ziel ist, dass Betreiber pro bestätigter Buchung oder Sperrung einen öffentlichen Veranstaltungstext und einen öffentlichen Veranstalter bewusst freigeben können. Beide Texte dürfen eingeschränktes Markdown enthalten. Ohne ausdrückliche Freigabe darf die öffentliche API keine Details ausgeben.

Der Plan ist für eine Implementierung in einem neuen Kontext ohne Kenntnis früherer Diskussionen geschrieben. Jeder Schritt ist in der angegebenen Reihenfolge abzuarbeiten. Abweichungen sind nur zulässig, wenn eine manuelle Live-Prüfung der privaten Google Sheets einen dokumentierten Widerspruch zum Repository ergibt.

Projektstand beim Erstellen dieses Plans:

- Statische PWA, dokumentierte Version 1.2.
- Zwei öffentliche Pages-Scopes: `/DGH/` für `dgh_rb` und `/Gemeindehaus/` für `ev_gem_rb`.
- Zwei getrennte private Google Sheets, zugeordnet in `betreiber/allgemein/backend/konfiguration.json`.
- Eine gemeinsame standalone Apps-Script-Web-App als öffentliche API.
- Je privatem Sheet ein eigenes gebundenes Verwaltungsskript.
- GitHub Pages und Apps Script werden getrennt bereitgestellt.

## Ausführungsregeln für das implementierende Modell

- [ ] Vor jeder Änderung `git status --short` ausführen und vorhandene fremde Änderungen notieren.
- [ ] Keine fremden Worktree-Änderungen zurücksetzen, überschreiben oder bereinigen.
- [ ] Ausschließlich Quellen ändern. `_site/**` nie manuell editieren.
- [ ] `apps-script/buchungs-api/Code.gs` nie manuell editieren. Nur `apps-script/buchungs-api/Code.template.gs` und Betreiberkonfiguration ändern, danach `python scripts/build-apps-script.py` ausführen.
- [ ] `DESIGN.md` als verbindliches Designsystem behandeln. Open Sans, bestehende Gebäude-Farben, eckige Komponenten und vorhandene CSS-Variablen beibehalten.
- [ ] Keine neue Root-`package.json` und keine npm-Abhängigkeit hinzufügen.
- [ ] Neue JavaScript-Tests nur mit Node-Bordmitteln wie `node:assert`, `node:fs`, `node:path` und `node:vm` schreiben.
- [ ] Browsertests mit Python und Playwright schreiben; keine Produktions-URL, kein Produktionssecret und keine echten Formulardaten verwenden.
- [ ] Version nur in den vorhandenen Dokumentationsstellen von 1.2 auf 1.3 anheben. Es existiert aktuell keine zentrale Paketversion.
- [ ] Nach jeder Phase die zugehörigen Tests ausführen. Am Ende alle Befehle aus dem Kapitel „Vollständige Prüfbefehle“ in der angegebenen Reihenfolge ausführen.
- [ ] Vor einem Deployment die privaten Live-Sheets manuell prüfen. Repository-Inhalte erlauben keine Aussage über aktuelle Live-Header, Formeln, Datenmengen, Checkboxvalidierungen oder doppelte Settings.
- [ ] Nicht committen, solange kein ausdrücklicher Auftrag dazu vorliegt.

## Nicht verhandelbare Sicherheitsregeln

- [ ] Öffentliche Details werden ausschließlich ausgegeben, wenn der neue Master `public_show_booking_details` wahr ist, das jeweilige Sichtbarkeitsfeld wahr ist und der zugehörige Text nach Normalisierung nicht leer ist.
- [ ] `public_title` und `public_organizer` werden unabhängig voneinander freigegeben. Ein Feld darf nicht vom Flag des anderen Feldes abhängen.
- [ ] Fehlende Sichtbarkeitsfelder sind immer `false`. Das gilt insbesondere in der Übergangsphase mit Version-1.2-Sheets.
- [ ] Ein vorhandener, aber leerer neuer Master gilt als `false`. In diesem Fall darf der Legacy-Key nicht ausgewertet werden.
- [ ] `public_show_booking_titles` wird nur gelesen, wenn `public_show_booking_details` als Key tatsächlich fehlt.
- [ ] Der Legacy-Key wird in Version 1.3 nicht gelöscht.
- [ ] Der bisherige Fallback `row.public_title || row.title` wird ersatzlos entfernt.
- [ ] `title`, `note`, `internal_note`, `requester_name`, `requester_contact`, beide Sichtbarkeitsfelder und alle sonstigen privaten Sheet-Felder dürfen nie Bestandteil des öffentlichen API-JSON sein.
- [ ] Neue Buchungen aus Anfragen und neue Sperrungen erhalten leere öffentliche Texte und echte boolesche `false`-Werte in beiden Sichtbarkeitsfeldern.
- [ ] `Requests.note` bleibt unverändert der Text der anfragenden Person. Dieses Feld darf nie nach `Bookings.internal_note` kopiert oder öffentlich ausgegeben werden.
- [ ] Nur `Requests.internal_note` wird beim Bestätigen nach `Bookings.internal_note` kopiert.
- [ ] Eingeschränktes Markdown wird serverseitig nur als Text normalisiert. Der Server erzeugt kein HTML.
- [ ] Der Browser erzeugt Buchungs-Markup ausschließlich über DOM-Knoten und eine feste Element-/Attribut-Whitelist. Keine Markdown-Eingabe darf in `innerHTML`, `insertAdjacentHTML` oder eine HTML-Templatezeichenfolge gelangen.
- [ ] Der bestehende News-/About-Renderer `markdown()` in `assets/js/ui.js` wird nicht funktional umgebaut. Der neue Renderer wird ausschließlich für öffentliche Buchungsdetails verwendet.
- [ ] Vollständige freigegebene Buchungsdetails werden absichtlich in `localStorage` gespeichert. Ablaufzeit ist exakt 24 Stunden ab `cachedAt`, nicht ab `loadedAt`.
- [ ] Ein Cacheeintrag mit Alter `>= 86_400_000` Millisekunden wird gelöscht und nicht angezeigt.
- [ ] Jede Nutzung von `JSON.parse`, `localStorage.getItem`, `localStorage.setItem` und `localStorage.removeItem` wird abgefangen. Security-, Quota- und Parse-Fehler dürfen die App nicht abbrechen.
- [ ] Migrationen werden nie automatisch aus `doGet`, `doPost`, `setupSheets`, `onOpen` oder einem Trigger gestartet.
- [ ] `migrateSheetsV13()` wird ausschließlich bewusst und manuell im Wartungsfenster ausgeführt.
- [ ] Vor jeder Umschreibung werden beide Gebäude vollständig geprüft. Erst nach erfolgreichem Gesamt-Preflight beginnen Backups oder Änderungen.
- [ ] Keine Aussage über globale Atomarität machen: Google Apps Script kann Änderungen an zwei getrennten Spreadsheets nicht gemeinsam transaktional zurückrollen.

## Ausgangslage und verifizierte Schwachstellen

Die folgenden Hinweise beziehen sich auf den Stand vor Version 1.3. Zeilennummern verschieben sich bei der Implementierung.

| Datei / Symbol | Aktueller Stand | Konkretes Risiko oder Defizit |
|---|---|---|
| `apps-script/buchungs-api/Code.template.gs:8-15`, `SHEET_HEADERS` | Bookings und Requests verwenden das Version-1.2-Schema. | Öffentlicher Veranstalter, Sichtbarkeitsflags und `Requests.internal_note` fehlen; `Bookings.internal_note` steht nicht am Zielende. |
| `apps-script/buchungs-api/Code.template.gs:48-74`, `setupSheets()` / `setupSheetForBuilding()` | Header werden bei jedem Lauf ohne Inhaltsprüfung in Zeile 1 geschrieben. | Gefüllte Sheets können durch eine andere Headerreihenfolge semantisch beschädigt werden. |
| `apps-script/buchungs-api/Code.template.gs:89-102`, `getOccupancy()` | Nur `public_show_booking_titles` steuert Titel. | Kein neuer Master, kein unabhängiger Veranstalter und keine per-Zeile-Freigabe. |
| `apps-script/buchungs-api/Code.template.gs:286-295`, `publicOccupancyRow()` | `publicTitle` nutzt `row.public_title || row.title`. | Kritisches Privacy-Leck: Interner `title` kann als öffentlicher Ersatz ausgegeben werden. |
| `apps-script/buchungs-api/Code.template.gs:257-263`, `appendRow()` | Feste Header aus `SHEET_HEADERS`; Werte über `data[header] || ""`. | Übergangsschemas werden nicht sauber unterstützt; echtes `false` wird in einen leeren String verwandelt. |
| `apps-script/buchungs-api/Code.template.gs:334-339`, `sanitizeText()` | Alle Steuerzeichen einschließlich LF werden durch Leerzeichen ersetzt. | Mehrzeiliges eingeschränktes Markdown kann nicht erhalten bleiben. |
| `apps-script/buchungs-api/Code.template.gs:342-347`, `formatCell()` | `String(value || "")`. | Boolesches `false` geht als leerer Wert verloren. |
| `apps-script/buchungsverwaltung/Code.gs:46-121`, `approveSelectedRequest()` | `public_title` und `internal_note` werden leer initialisiert. | Neue Felder fehlen; `Requests.internal_note` wird nicht übertragen. |
| `apps-script/buchungsverwaltung/Code.gs:216-251`, `confirmBlock()` | Sperrnotiz landet bereits in `internal_note`. | Grundidee ist richtig, aber neue öffentliche Felder und echte `false`-Flags fehlen. |
| `apps-script/buchungsverwaltung/Code.gs:370-384`, `appendRow_()` | Tatsächliche Header werden gelesen, aber `data[h] || ''` wird verwendet. | Boolesches `false` wird nicht als Checkboxwert gespeichert. |
| `assets/js/app.js:9-11`, `occupancyCacheKey()` | Key ist `occupancy:<buildingId>:<from>:<to>`. | Keine Schema-/Cacheversion. |
| `assets/js/app.js:144-172`, `loadOccupancy()` | Payload wird ohne `cachedAt` und ohne TTL gespeichert; Storage-/Parse-Fehler sind ungefangen. | Beliebig alte Daten können erscheinen; kaputtes JSON oder blockierter Storage kann die App abbrechen. |
| `assets/js/app.js:51-57`, `renderOccupancy()` | `stale` wird immer als `false` an UI-Funktionen übergeben. | Nach Ansichtswechsel verliert ein Offline-Fallback seinen sichtbaren stale-Zustand. |
| `assets/js/ui.js:62-85`, `renderOccupancy()` | Liste kennt nur optionales `publicTitle`; Ausgabe wird als HTML-String gebaut. | Kein Veranstalter, kein eingeschränktes Markdown, kein gemeinsamer Detailrenderer mit Dialog. |
| `assets/js/ui.js:105-115`, `itemStatus()` / `dayStatus()` | Ganztägige `blocked`- und `confirmed`-Einträge werden beide zu `busy`. | Gesperrte Tage sind im Kalender nicht rot unterscheidbar. |
| `assets/js/ui.js:130-151`, `renderMonth()` | Belegte Tage sind `<span>`; nur freie Tage sind Buttons. | Belegte Tage öffnen keine Details und sind nicht als Dialog-Trigger zugänglich. |
| `assets/js/ui.js:146-151`, `renderMonth()` | Monatsname ist nur Buttontext. | Keine semantische Monatsüberschrift. |
| `index.html:100-108` | Ansicht heißt „Tabellarisch“; `occupancyList` besitzt `aria-live="polite"`; `occupancyMeta` ist nur ein Absatz. | Benennung ist falsch; eine große dynamische Liste wird unnötig komplett vorgelesen; Statusziel ist nicht sauber definiert. |
| `assets/css/app.css:117-121` | `.meta` ist für dunklen Header auf halbtransparentes Weiß gesetzt. | `#occupancyMeta` liegt auf weißer Panel-Fläche und hat dadurch unzureichenden Kontrast. |
| `assets/css/app.css:426-435` | Tageszellen haben nur 34 px Mindesthöhe. | Interaktionsziel unterschreitet die angestrebten 44 px. |
| `betreiber/allgemein/konfiguration/frontend.json:3` | `publicShowBookingTitles` wird als Frontendkonfiguration ausgeliefert. | Die Eigenschaft wird im aktuellen Frontend nicht genutzt und suggeriert eine clientseitige Sicherheitsentscheidung. |
| `betreiber/allgemein/backend/konfiguration.json:10,20` | Backend-Startwert heißt `publicShowBookingTitles`. | Benennung bildet den neuen Master für beide Detailfelder nicht ab. |
| `betreiber/DGH/texte/about.md:9,13` und `betreiber/EV_GEMEINDEHAUS/texte/about.md:13,17` | Texte behaupten „nur belegt“ und vollständige Löschung am Folgetag. | Beides widerspricht dem neuen Feature; die Löschbehauptung ist im Code nicht implementiert. |
| `.github/workflows/pages.yml` | Nur Push auf `main`; bestehende Buildtests, kein Browser- oder neuer Node-Test. | Neue Sicherheitslogik wird nicht vollständig in CI abgesichert; Pull Requests haben keinen eigenen Qualitätslauf. |

## Abgenommene Entscheidungen

- [ ] Feature-Version ist 1.3.
- [ ] `public_show_booking_details` ist ein je Gebäude im privaten `Settings`-Tab gespeicherter Master. „Global“ bedeutet: Er gilt für beide Detailfelder dieses Gebäudes, nicht für alle Gebäude gemeinsam.
- [ ] Der Legacy-Key `public_show_booking_titles` bleibt in Version 1.3 im Sheet erhalten und wird nur als Fallback gelesen, wenn der neue Key fehlt.
- [ ] Das API-Schema wird additiv auf `schemaVersion: 2` erweitert.
- [ ] `publicTitle` und `publicOrganizer` sind im API-JSON immer Strings. Nicht freigegebene oder leere Werte sind `""`.
- [ ] Sichtbarkeitsflags werden nie an den Browser gesendet.
- [ ] Beide öffentlichen Texte erlauben maximal 1000 Zeichen nach Zeilenendennormalisierung und vor der API-Ausgabe.
- [ ] Der Server normalisiert `CRLF` und einzelnes `CR` zu `LF`, behält `LF` und entfernt alle übrigen C0-Steuerzeichen sowie DEL. Er erzeugt kein HTML.
- [ ] Der Buchungs-Markdownrenderer ist eine neue, klar abgegrenzte Datei `assets/js/restricted-markdown.js`.
- [ ] Cache- und weitere browserunabhängige Kernlogik liegt in der neuen Datei `assets/js/frontend-core.js`, damit `tests/frontend-core.test.js` ohne DOM und ohne npm laufen kann.
- [ ] Beide neuen Dateien unterstützen Browser und Node über einen kleinen UMD-artigen Export: Browser-Global `window.RestrictedMarkdown` beziehungsweise `window.FrontendCore`, Node über `module.exports`.
- [ ] `index.html` lädt `frontend-core.js` und `restricted-markdown.js` vor `ui.js` und `app.js`.
- [ ] Listenansicht und Dialog rufen dieselbe Funktion `renderBookingDetails(target, item)` in `assets/js/ui.js` auf. Es gibt keine zweite Feldformatierung.
- [ ] Der native Dialog ist einmal statisch in `index.html` vorhanden. Tagesdialoge werden nicht als HTML-Strings pro Kalenderzelle erzeugt.
- [ ] Freie Tage behalten `data-booking-date`. Nicht freie Tage erhalten stattdessen `data-occupancy-date`, `aria-haspopup="dialog"` und `aria-controls="bookingDetailsDialog"`.
- [ ] Native Buttons liefern Enter- und Leertaste ohne eigene Tastatursimulation. Ein separater `keydown`-Handler für Buttonaktivierung wird nicht hinzugefügt.
- [ ] Statuspriorität eines Tages: ganztägig `blocked` vor ganztägig `confirmed`, danach `partial`, sonst `free`.
- [ ] Zeitweise Sperrungen bleiben `partial`; im Dialog und in der Liste tragen sie weiterhin das rote `blocked`-Statusbadge.
- [ ] Cachezeitpunkt `cachedAt` wird als Millisekunden seit Unix-Epoch gespeichert. `loadedAt` bleibt nur Anzeigeinformation der API.
- [ ] Der Cache ist bei `now - cachedAt < 86_400_000` gültig. Bei exakt 24:00 Stunden ist er ungültig.
- [ ] Ein Cachezeitpunkt in der Zukunft ist ungültig und wird gelöscht, damit Uhrfehler nicht zu unbegrenzter Gültigkeit führen.
- [ ] Die alten unversionierten Keys werden nicht gelesen. Beim Zugriff auf denselben Bereich wird der exakt berechenbare alte Key gezielt und fehlergeschützt entfernt; es wird nicht ungefiltert der gesamte `localStorage` geleert.
- [ ] `setupSheets()` bleibt für neue leere Installationen zuständig. Es validiert bestehende Tabs, führt aber keine Datenmigration aus.
- [ ] `migrateSheetsV13()` ist der einzige Einstieg für die Datenmigration gefüllter Version-1.2-Tabs.
- [ ] Blockgröße für Apps-Script-Migrationslesen und -schreiben ist 500 Datenzeilen. Dadurch bleiben Speicher- und Laufzeitbedarf begrenzt.
- [ ] Die Migration repariert bei einem bereits exakten Zielschema nur fehlende Format-/Checkboxvalidierungen. Sie ordnet keine Daten erneut um und erzeugt dafür kein neues Backup.
- [ ] Die CI erhält einen `pull_request`-Qualitätslauf. Deployment und Secrets bleiben auf Push `main` oder manuellen Lauf beschränkt.

## Zielschemas

### Bookings Version 1.3

Exakte Reihenfolge, keine zusätzlichen oder fehlenden Header:

```text
booking_id | building_id | date | from | to | title | status | public_title | public_title_visible | public_organizer | public_organizer_visible | created_at | updated_at | internal_note
```

Feldregeln:

| Feld | Typ / Inhalt | Öffentlich |
|---|---|---|
| `booking_id` | UUID | Nein |
| `building_id` | `dgh_rb` oder `ev_gem_rb` | Nein; Gebäude ist bereits Request-Kontext. |
| `date` | `YYYY-MM-DD` | Ja |
| `from` | `HH:MM` | Ja |
| `to` | `HH:MM` | Ja |
| `title` | Interner Buchungszweck | Nie |
| `status` | `confirmed`, `blocked` oder interner sonstiger Status | Nur übersetzter öffentlicher Status für bestätigte/gesperrte Einträge |
| `public_title` | Eingeschränktes Markdown, maximal 1000 Zeichen | Nur mit Master und eigenem Flag |
| `public_title_visible` | Google-Sheets-Checkbox, echter Boolean | Nie direkt |
| `public_organizer` | Eingeschränktes Markdown, maximal 1000 Zeichen | Nur mit Master und eigenem Flag |
| `public_organizer_visible` | Google-Sheets-Checkbox, echter Boolean | Nie direkt |
| `created_at` | ISO-Zeitstempel | Nein |
| `updated_at` | ISO-Zeitstempel | Nein |
| `internal_note` | Interner Betreibervermerk | Nie |

Migrationsregel: Der bestehende Wert aus `Bookings.internal_note` wird werttreu anhand des Headernamens gelesen und an die letzte Zielposition geschrieben. Er darf nicht anhand seiner bisherigen Spaltennummer behandelt werden.

### Requests Version 1.3

Exakte Reihenfolge, keine zusätzlichen oder fehlenden Header:

```text
request_id | building_id | date | from | to | requester_name | requester_contact | title | note | status | conflict | created_at | updated_at | internal_note
```

Feldregeln:

| Feld | Bedeutung |
|---|---|
| `note` | Freitext der anfragenden Person; bleibt von Betreiber-Notizen getrennt. |
| `internal_note` | Neuer interner Betreibervermerk; beim Bestätigen nach `Bookings.internal_note` kopieren. |
| Alle übrigen Felder | Bedeutung bleibt wie in Version 1.2. |

Neue öffentliche Formularanfragen schreiben `internal_note: ""`. Das öffentliche Formular erhält kein Feld zum Setzen von `internal_note`.

### Exakte Legacy-Schemas für den Preflight

Nur diese beiden Version-1.2-Schemas dürfen als migrierbar gelten:

```text
Bookings:
booking_id | building_id | date | from | to | title | status | public_title | internal_note | created_at | updated_at

Requests:
request_id | building_id | date | from | to | requester_name | requester_contact | title | note | status | conflict | created_at | updated_at
```

Für `Buildings`, `Settings`, `Log` und `Contacts` bleibt das aktuelle `SHEET_HEADERS`-Schema unverändert und muss exakt stimmen. Unbekannte Header, doppelte Header, leere Header innerhalb der genutzten Kopfzeile, fehlende Header oder eine andere Reihenfolge führen zum Abbruch.

## Öffentlicher API-Vertrag Version 2

### Endpoint

```text
GET <exec-url>?action=occupancy&buildingId=dgh_rb&from=2026-07-01&to=2026-07-31
```

### Erfolgsbeispiel

```json
{
  "ok": true,
  "data": {
    "schemaVersion": 2,
    "loadedAt": "2026-07-14T10:15:00.000Z",
    "items": [
      {
        "date": "2026-07-18",
        "from": "18:00",
        "to": "22:00",
        "allDay": false,
        "status": "belegt",
        "statusKey": "confirmed",
        "publicTitle": "**Sommerkonzert**\nEinlass ab 17:30 Uhr",
        "publicOrganizer": "[Kulturverein](https://example.org/veranstaltungen)"
      },
      {
        "date": "2026-07-21",
        "from": "00:00",
        "to": "23:59",
        "allDay": true,
        "status": "gesperrt",
        "statusKey": "blocked",
        "publicTitle": "",
        "publicOrganizer": ""
      }
    ]
  },
  "message": "OK"
}
```

### Ausgabeentscheidung pro Feld

| Neuer Master vorhanden? | Neuer Master wahr? | Legacy-Master wahr? | Feldflag wahr? | Text nach Normalisierung leer? | Ausgabe |
|---|---:|---:|---:|---:|---|
| Ja | Ja | Beliebig | Ja | Nein | Normalisierter Text |
| Ja | Ja | Beliebig | Nein oder fehlt | Beliebig | `""` |
| Ja | Ja | Beliebig | Ja | Ja | `""` |
| Ja | Nein oder leer | Wahr | Ja | Nein | `""`; Legacy wird nicht gelesen |
| Nein | Nicht anwendbar | Wahr | Ja | Nein | Normalisierter Text als Übergangsverhalten |
| Nein | Nicht anwendbar | Falsch, leer oder fehlt | Ja | Nein | `""` |
| Nein | Nicht anwendbar | Wahr | Flag fehlt | Nein | `""` |

Die Matrix wird separat für `public_title`/`public_title_visible` und `public_organizer`/`public_organizer_visible` angewendet.

### Verbotene API-Eigenschaften

Folgende Namen dürfen in keinem Objekt unter `data.items` vorkommen:

```text
booking_id
building_id
title
note
internal_note
requester_name
requester_contact
public_title
public_title_visible
public_organizer
public_organizer_visible
created_at
updated_at
```

`publicTitle` und `publicOrganizer` sind die einzigen öffentlichen Detailfelder. Ein Test muss zusätzlich Geheimmarker in allen privaten Feldern setzen und die serialisierte Antwort auf Abwesenheit dieser Marker prüfen.

## Architektur und Datenfluss

### Vor Version 1.3

```text
Google Sheet Bookings
  -> Code.template.gs / getOccupancy()
  -> publicOccupancyRow(showTitles)
  -> publicTitle mit möglichem Fallback auf internes title
  -> assets/js/api.js
  -> assets/js/app.js
  -> assets/js/ui.js: Liste oder kompakter Kalender
  -> unbefristeter localStorage-Fallback
```

### Nach Version 1.3

```text
Google Sheet Bookings
  -> Masterentscheidung mit New-Key-Presence-Test
  -> unabhängige Freigabe je Text und Sichtbarkeitscheckbox
  -> reine Textnormalisierung, kein HTML
  -> API schemaVersion 2 mit publicTitle/publicOrganizer
  -> assets/js/api.js reicht Daten unverändert weiter
  -> assets/js/frontend-core.js prüft Sortierung und Cachealter
  -> assets/js/app.js hält { payload, range, stale } als UI-Zustand
  -> assets/js/ui.js ruft für Liste und Dialog renderBookingDetails()
  -> assets/js/restricted-markdown.js baut Whitelist-DOM
  -> localStorage { cachedAt, payload }, maximal 24 Stunden
```

### Build- und Deploymentfluss

```text
Code.template.gs + betreiber/allgemein/backend/*.json
  -> python scripts/build-apps-script.py
  -> apps-script/buchungs-api/Code.gs
  -> separates Apps-Script-Deployment auf bestehender /exec-URL

index.html + assets/** + betreiber/**
  -> python scripts/build-pages-site.py
  -> _site/**
  -> python scripts/configure-runtime.py in CI
  -> separates GitHub-Pages-Deployment
```

## Umsetzungsphasen in strikter Reihenfolge

## Phase 0: Baseline sichern und Live-Prüfung vorbereiten

Dateien: keine fachliche Änderung.

Arbeitsschritte:

- [ ] `git status --short` dokumentieren.
- [ ] Alle vorhandenen Testbefehle im aktuellen Zustand ausführen: Apps-Script-Build, Pages-Build, Pages-Verifikation, beide Python-Tests und Service-Worker-Test.
- [ ] Prüfen, dass `apps-script/buchungs-api/Code.gs` nach dem Build keine unerwartete Differenz zu den injizierten Template-/JSON-Quellen hat.
- [ ] In beiden privaten Live-Sheets die exakten Headerzeilen der Tabs `Bookings`, `Requests`, `Settings`, `Buildings`, `Log` und `Contacts` manuell exportieren oder dokumentieren.
- [ ] In beiden Live-Sheets Datenzeilenanzahl, vorhandene Formeln, Checkboxen und doppelte `(building_id, key)`-Settings manuell prüfen.
- [ ] Keine Live-Sheet-Struktur aufgrund der Repository-Dokumentation annehmen.

Akzeptanzkriterien:

- [ ] Baseline-Tests sind grün oder bestehende Fehler sind vor der Implementierung schriftlich festgehalten.
- [ ] Beide Gebäude wurden geprüft; abweichende Header oder Formeln sind als Blocker bekannt.
- [ ] In dieser Phase wurde kein `setupSheets()` und keine Migration auf Produktion ausgeführt.

Tests:

```pwsh
python scripts/build-apps-script.py
python scripts/build-pages-site.py
python scripts/verify-pages-site.py
python tests/content-build.test.py
python tests/configure-runtime.test.py
node tests/service-worker.test.js
```

## Phase 1: Apps-Script-Pure-Logik und API-Vertrag fail closed implementieren

Primärdatei: `apps-script/buchungs-api/Code.template.gs`.

Generierte Datei: `apps-script/buchungs-api/Code.gs`, ausschließlich über Build erzeugen.

Konfigurationsdatei: `betreiber/allgemein/backend/konfiguration.json`.

Neue/zu ändernde Symbole:

- `SHEET_HEADERS`
- neue Konstante `LEGACY_SHEET_HEADERS_V12`
- `getOccupancy(buildingId, from, to)`
- `publicOccupancyRow(row, showDetails)` oder gleichwertig mit einem klar benannten Details-Boolean
- neue Funktion `publicBookingDetailsEnabled(settings)`
- neue Funktion `hasOwn(object, key)`
- neue Funktion `normalizePublicMarkdown(value)`
- `appendRow(buildingId, sheetName, data)`
- `formatCell(value, header)`
- neue Funktion `valueOrEmpty(value)`

Genaue Änderungen:

- [ ] `SHEET_HEADERS.Bookings` und `SHEET_HEADERS.Requests` exakt auf die Zielschemas setzen.
- [ ] Die beiden aktuellen Version-1.2-Header als unveränderliche Arrays in `LEGACY_SHEET_HEADERS_V12` erfassen.
- [ ] In `betreiber/allgemein/backend/konfiguration.json` die zwei Eigenschaften `publicShowBookingTitles` in `publicShowBookingDetails` umbenennen; beide Werte bleiben `false`.
- [ ] `getOccupancy()` um `schemaVersion: 2` ergänzen.
- [ ] Masterentscheidung nicht mit `settings.public_show_booking_details || ...` implementieren, weil ein vorhandener leerer Wert sonst fälschlich auf Legacy zurückfällt.
- [ ] Mit `Object.prototype.hasOwnProperty.call(settings, "public_show_booking_details")` oder dem Helper `hasOwn()` zuerst die echte Key-Anwesenheit prüfen.
- [ ] Wenn der neue Key vorhanden ist, ausschließlich dessen Wahrheitswert mit `isTruthy()` auswerten.
- [ ] Nur wenn der neue Key fehlt, `public_show_booking_titles` als Legacy-Master auswerten.
- [ ] In `publicOccupancyRow()` `publicTitle` nur aus `row.public_title` und `publicOrganizer` nur aus `row.public_organizer` bilden.
- [ ] Beide Werte unabhängig mit Master, zugehörigem `*_visible` und nicht leerem normalisiertem Text absichern.
- [ ] Fehlende Flags durch `isTruthy(undefined) === false` fail closed behandeln.
- [ ] `normalizePublicMarkdown()` in dieser Reihenfolge implementieren: Null/Undefined zu leerem String; `\r\n` und `\r` zu `\n`; alle Steuerzeichen außer `\n` entfernen; auf 1000 Zeichen begrenzen; für die Leerheitsprüfung `trim()` verwenden, aber erhaltene interne LF nicht durch Leerzeichen ersetzen.
- [ ] `normalizePublicMarkdown()` darf keine Tags entfernen, ersetzen oder HTML erzeugen. Raw HTML bleibt Text und wird erst im Browser als Textknoten sicher dargestellt.
- [ ] `appendRow()` muss bei vorhandenen Sheets die tatsächliche Headerzeile lesen und gegen das für den Tab erlaubte Legacy- oder Zielschema validieren.
- [ ] `appendRow()` muss neue leere Tabs mit dem Zielschema initialisieren.
- [ ] `appendRow()` muss `false` erhalten: `value === null || value === undefined ? "" : value` statt `value || ""`.
- [ ] `formatCell()` muss boolesche Werte als Boolean zurückgeben, Null/Undefined als `""` und Strings weiterhin getrimmt behandeln.
- [ ] `createBookingRequest()` schreibt im Zielschema `internal_note: ""`; bei einem Legacy-Requests-Tab wird das zusätzliche Datenfeld wegen Header-Mapping sicher ignoriert.
- [ ] Öffentliche Responses dürfen keine Sheet-Zeilenobjekte spreaden oder ungefiltert serialisieren.

Akzeptanzkriterien:

- [ ] API-Antwort enthält `schemaVersion: 2` und beide öffentlichen Felder als Strings.
- [ ] Alle Freigabematrixfälle liefern exakt das erwartete Ergebnis.
- [ ] Ein Legacy-Sheet ohne Sichtbarkeitsflags liefert auch bei wahrem Legacy-Master keine Details.
- [ ] Interner `title` erscheint unter keinen Umständen als Fallback.
- [ ] LF, Umlaute und ß bleiben in freigegebenem Text erhalten.
- [ ] Boolesches `false` bleibt beim Zeilenaufbau ein Boolean.
- [ ] API bleibt vor der Migration mit exakten Version-1.2-Headers lesend und für neue Requests schreibend kompatibel.

Tests:

- [ ] In `tests/apps-script.test.js` die generierte `Code.gs` mit `node:vm` und kleinen Apps-Script-Mocks laden.
- [ ] Testtrailer im VM-Quelltext verwenden, um lexikalische Funktionen gezielt als Testobjekt verfügbar zu machen; keine Testexports in die Produktionsdatei schreiben.
- [ ] Master-Presence-Matrix vollständig testen.
- [ ] Beide Detailfelder unabhängig testen.
- [ ] `false`-Erhalt in `appendRow()` mit einem gemockten Sheet und aufgezeichnetem `appendRow` testen.
- [ ] Private Feldnamen und Geheimmarker in serialisiertem `publicOccupancyRow()`-Ergebnis ausschließen.
- [ ] Normalisierung für CRLF, CR, LF, NUL, Tab, Umlaute und ß testen.

```pwsh
python scripts/build-apps-script.py
node tests/apps-script.test.js
```

## Phase 2: Sichere und explizite Sheet-Migration implementieren

Primärdatei: `apps-script/buchungs-api/Code.template.gs`.

Öffentlicher manueller Einstieg:

```js
function migrateSheetsV13() { /* ausschließlich manuell starten */ }
```

Vorgesehene private Helper:

- `preflightAllSpreadsheetsV13_()`
- `preflightSpreadsheetV13_(buildingId)`
- `readAndClassifyHeaders_(sheet, sheetName)`
- `assertExactHeaders_(actual, allowed, context)`
- `assertNoDuplicateSettings_(sheet, buildingId)`
- `assertNoFormulasInMigrationRange_(sheet, width)`
- `backupSheetV13_(sheet, timestamp)`
- `migrateRowsByHeaderV13_(sheet, sourceHeaders, targetHeaders)`
- `migratePublicDetailsSettingV13_(buildingId)`
- `applySheetFormattingV13_(sheetName, sheet)`
- `logMigrationResultV13_(buildingId, message)`

Die Namen dürfen nur geändert werden, wenn die gleiche Trennung und eindeutige Verantwortung erhalten bleibt.

Preflight-Regeln:

- [ ] Zu Beginn `LockService.getScriptLock().waitLock(...)` beziehen und in `finally` freigeben.
- [ ] Unter demselben Lock zuerst beide Gebäude und alle relevanten Tabs prüfen, bevor ein Backup oder Schreibzugriff erfolgt.
- [ ] Fehlende Tabs als Fehler behandeln, wenn das Spreadsheet bereits produktive Daten enthält. Neue Installationen werden über `setupSheets()` angelegt, nicht über die Migration erraten.
- [ ] Für `Bookings` und `Requests` nur exaktes Legacy- oder Zielschema akzeptieren.
- [ ] Für `Buildings`, `Settings`, `Log` und `Contacts` nur das unveränderte exakte Schema akzeptieren.
- [ ] Kopfzeilen anhand aller belegten Headerzellen lesen. Doppelte, leere, fehlende oder unbekannte Header sowie falsche Reihenfolge abbrechen.
- [ ] Im `Settings`-Tab jede doppelte nicht leere Kombination aus `building_id` und `key` abbrechen. Damit sind insbesondere doppelte neue und Legacy-Master ausgeschlossen.
- [ ] Bei teilweise befüllten Settings-Zeilen ohne `building_id` oder `key` mit klarer deutscher Fehlermeldung abbrechen.
- [ ] Formeln mit `getFormulas()` blockweise in allen Datenzeilen und allen umzuschreibenden Spalten von Legacy-Bookings/Requests erkennen.
- [ ] Wenn der neue Settings-Key ergänzt werden muss, Formeln im genutzten Settings-Datenbereich ebenfalls erkennen und abbrechen.
- [ ] Headerformeln ebenfalls ablehnen.
- [ ] Fehlertext muss Gebäude-ID, Tabname und Problem nennen, zum Beispiel: `Migration abgebrochen: dgh_rb / Bookings enthält eine Formel in Zeile 7, Spalte internal_note.`
- [ ] Der Preflight gibt einen unveränderlichen Ausführungsplan zurück: pro Gebäude Schemaart, nötige Backups, nötige Umschreibungen, Settingaktion und Validierungsreparaturen.

Backup-Regeln:

- [ ] Einen gemeinsamen UTC-Zeitstempel pro Lauf im Format `yyyyMMdd_HHmmss` bilden.
- [ ] Nur Tabs sichern, deren Daten oder Settings in diesem Lauf geändert werden.
- [ ] Beim normalen Upgrade von 1.2 dadurch `Bookings`, `Requests` und `Settings` je Gebäude sichern.
- [ ] Backupnamen `Bookings_backup_v13_<Zeitstempel>`, `Requests_backup_v13_<Zeitstempel>` und `Settings_backup_v13_<Zeitstempel>` verwenden.
- [ ] Vorhandene gleichnamige Backups nicht überschreiben; mit klarer Fehlermeldung abbrechen.
- [ ] Sicherung innerhalb desselben Spreadsheets konkret mit `sheet.copyTo(spreadsheet)` anlegen, unmittelbar auf den berechneten Backupnamen umbenennen und dadurch Werte, Formate und Datenvalidierungen erhalten. Das blockweise Lesen/Schreiben gilt für die anschließende Datenumschreibung, nicht für diese native vollständige Sheet-Kopie.
- [ ] Ein Tab mit bereits exaktem Zielschema wird nicht allein wegen Validierungsreparaturen gesichert oder umgeschrieben.

Umschreibungsregeln:

- [ ] Daten in Blöcken zu höchstens 500 Zeilen lesen.
- [ ] Jede Quellzeile zuerst in ein Objekt `header -> Originalwert` umwandeln.
- [ ] Zielzeile ausschließlich durch `targetHeaders.map(...)` bilden.
- [ ] Bestehendes `internal_note` werttreu übernehmen.
- [ ] Neue `public_title_visible`- und `public_organizer_visible`-Zellen für Legacy-Zeilen als echte Booleans `false` setzen.
- [ ] Neues `public_organizer` und neues `Requests.internal_note` für Legacy-Zeilen leer setzen.
- [ ] Keine `note`-Werte nach `internal_note` kopieren.
- [ ] Zielheader und Zielzeilen in Blöcken schreiben; keine Zelle-für-Zelle-Schleife verwenden.
- [ ] Nur den tatsächlich betroffenen Quell-/Zielbereich leeren und neu schreiben. Keine fremden Tabs oder Spalten außerhalb des validierten Schemas verändern.
- [ ] Nach dem Schreiben `SpreadsheetApp.flush()` ausführen und Header sowie Zeilenanzahl erneut lesen und prüfen.

Format- und Validierungsregeln:

- [ ] Zeile 1 einfrieren und bestehendes Headerformat konsistent fortführen.
- [ ] `date` als `yyyy-mm-dd`, `from`/`to` als `hh:mm` formatieren, ohne zugrunde liegende Werte in Anzeige-Strings umzuwandeln.
- [ ] `public_title`, `public_organizer`, `note` und `internal_note` auf Zeilenumbruch/Wrap setzen.
- [ ] Für beide Sichtbarkeitsspalten Checkbox-Datenvalidierung setzen.
- [ ] Leere oder ungültige Sichtbarkeitswerte in migrierten Legacy-Zeilen auf Boolean `false` setzen; vorhandene echte Zielwerte `true`/`false` beibehalten.
- [ ] Checkboxvalidierung auf bestehende Datenzeilen und einen dokumentierten Eingabebereich unterhalb der letzten Zeile anwenden.
- [ ] Bei einem bereits exakten Zielschema ausschließlich fehlende Checkboxvalidierungen und Formatierungen reparieren; Werte nicht neu schreiben.

Settingmigration:

- [ ] Existiert `public_show_booking_details`, dessen Wert unverändert erhalten. Auch leer bleibt leer und damit false.
- [ ] Fehlt der neue Key und existiert `public_show_booking_titles`, dessen Wert unverändert in eine neue Zeile mit Key `public_show_booking_details` übernehmen.
- [ ] Fehlen beide Keys, den neuen Key mit echtem Boolean `false` anlegen.
- [ ] `public_show_booking_titles` nicht löschen oder umbenennen.
- [ ] Settingzeile über tatsächliche Header schreiben und `false` nicht in `""` verwandeln.

Protokollierung und Idempotenz:

- [ ] Nach erfolgreicher Migration pro Gebäude einen knappen Eintrag im vorhandenen `Log`-Tab mit Action `migrateSheetsV13` schreiben.
- [ ] Zusätzlich `console.log` mit Gebäude, alten/neuen Schemaarten, Zeilenzahlen und Backupnamen verwenden.
- [ ] Zweiter Lauf bei Zielschemas und vorhandenem neuen Setting erzeugt keine neuen Backups und schreibt keine Datenzeilen neu.
- [ ] Zweiter Lauf darf fehlende Validierungen reparieren und muss dies protokollieren.
- [ ] Bei Fehler nach Beginn der Änderungen abbrechen, Lock freigeben und konkrete Wiederherstellung aus Backup nennen. Keine automatische scheinbare Gesamt-Rückabwicklung über beide Sheets versuchen.

`setupSheets()` gleichzeitig härten:

- [ ] Zuerst beide Spreadsheets und alle vorhandenen Tabs validieren, erst danach fehlende leere Tabs anlegen.
- [ ] Fehlende Tabs mit Zielschema anlegen.
- [ ] Bei `getLastRow() === 0` Zielheader schreiben.
- [ ] Bei bestehender Headerzeile nur exaktes Legacy- oder Zielschema akzeptieren; gefüllte Legacy-Tabs nicht migrieren.
- [ ] Bestehende gefüllte Header nie blind überschreiben.
- [ ] Startsetting ist `public_show_booking_details` aus `publicShowBookingDetails`.
- [ ] Setup darf den Legacy-Key nicht löschen.
- [ ] Formatierungen und Checkboxvalidierungen bei neuen Ziel-Tabs anwenden.

Akzeptanzkriterien:

- [ ] Gesamt-Preflight beider Gebäude läuft vor der ersten Änderung.
- [ ] Ein unbekannter Header in nur einem Gebäude verhindert jede Änderung in beiden Gebäuden.
- [ ] Eine Formel im betroffenen Datenbereich verhindert jede Änderung.
- [ ] Normaler 1.2-Lauf erzeugt Sicherungstabs, erhält Werte und erreicht exakt beide Zielschemas.
- [ ] `internal_note` landet werttreu am Ende.
- [ ] Alle neuen Flags sind echte Checkbox-Booleans und initial `false`.
- [ ] Zweiter Lauf ist datenseitig idempotent.
- [ ] Kein Text verspricht eine atomare Migration über beide Spreadsheets.

Tests:

- [ ] Pure Headerklassifikation, Header-Mapping, Settingentscheidung und Idempotenzplan in `tests/apps-script.test.js` testen.
- [ ] Google-spezifische Sicherung, Formate, Checkboxen, Lock und `flush()` zusätzlich manuell in Kopien beider Sheets testen.
- [ ] Einen Staging-Test mit absichtlich doppeltem Header, doppeltem Setting und einer Formel durchführen und jeweiligen Abbruch bestätigen.

## Phase 3: Gebundenes Verwaltungsskript an Zielschemas anpassen

Datei: `apps-script/buchungsverwaltung/Code.gs`.

Zu ändernde Symbole:

- `approveSelectedRequest()`
- `confirmBlock(data)`
- `appendRow_(sheetName, data)`
- `formatCell_(value, header)`
- `showHelp()`
- neue Headerprüfungen, zum Beispiel `assertRequiredHeaders_(sheetName, requiredHeaders)`

Genaue Änderungen:

- [ ] Konstanten mit den zwingend benötigten Headern für `Bookings`, `Requests`, `Buildings`, `Settings` und `Log` ergänzen.
- [ ] `approveSelectedRequest()` vor dem Lesen/Schreiben prüfen lassen, dass Requests und Bookings alle Zielheader besitzen.
- [ ] Fehler in klarer deutscher Form ausgeben, zum Beispiel: `Tab "Bookings" hat nicht das Schema von Version 1.3. Fehlende Spalten: public_organizer, public_organizer_visible.`
- [ ] Bestätigte Anfrage mit `public_title: ""`, `public_title_visible: false`, `public_organizer: ""`, `public_organizer_visible: false` anlegen.
- [ ] `internal_note: data.internal_note || ""` verwenden; `data.note` ausdrücklich nicht verwenden.
- [ ] `confirmBlock()` mit denselben leeren öffentlichen Feldern und echten false-Flags schreiben.
- [ ] Sperrdialogfeld `note` bleibt Dialogname, wird aber ausschließlich als `Bookings.internal_note` gespeichert.
- [ ] `appendRow_()` weiterhin tatsächliche Header verwenden lassen.
- [ ] `data[h] || ''` in `appendRow_()` durch Null/Undefined-Prüfung ersetzen.
- [ ] `formatCell_()` Boolean erhalten lassen.
- [ ] `updateRow_()` bei fehlendem angefordertem Header nicht still ignorieren, sondern einen klaren Fehler werfen.
- [ ] Nach schreibenden Aktionen `SpreadsheetApp.flush()` vor Erfolgsmeldung aufrufen.
- [ ] `showHelp()` ergänzen: `public_title`, `public_organizer` und die beiden Checkboxen werden direkt im `Bookings`-Tab gepflegt; Text allein veröffentlicht nichts; Master im Settings-Tab ist zusätzlich erforderlich.
- [ ] Hilfetext klarstellen, dass Personennamen oder `mailto:` nur nach bewusster Freigabe öffentlich werden.

Akzeptanzkriterien:

- [ ] Bestätigung kopiert nur `Requests.internal_note` in `Bookings.internal_note`.
- [ ] Antragstellertext in `Requests.note` bleibt unverändert und privat.
- [ ] Neue bestätigte Buchung und neue Sperrung sind fail closed.
- [ ] Falsches Schema führt vor Änderung zu einer verständlichen Meldung.
- [ ] Boolean `false` bleibt beim `appendRow_()` erhalten.

Tests:

- [ ] Verwaltungsskript-Pure-Helper soweit möglich in `tests/apps-script.test.js` mit VM-Mocks testen.
- [ ] Bestätigen, Ablehnen und Sperren in je einer Sheet-Kopie manuell testen.
- [ ] Prüfen, dass die Bestätigungs-E-Mail weiterhin den internen Anfragetitel nutzt, aber keine neuen öffentlichen Felder automatisch setzt.

## Phase 4: Eingeschränkten Markdownrenderer implementieren

Neue Datei: `assets/js/restricted-markdown.js`.

Neue Node-Prüfung: `tests/restricted-markdown.test.js`.

Öffentliche API des Moduls:

```js
RestrictedMarkdown.parse(value)
RestrictedMarkdown.render(target, value, options)
RestrictedMarkdown.isAllowedLink(rawUrl)
```

`parse()` liefert eine einfache, serialisierbare Struktur für Node-Tests. `render()` nimmt ein vorhandenes DOM-Ziel, leert es mit `replaceChildren()` und baut ausschließlich erlaubte Knoten mit `ownerDocument.createElement()` und `createTextNode()`.

Erlaubte Syntax:

- Absätze durch mindestens eine Leerzeile.
- Einzelne Zeilenumbrüche als `<br>`.
- `**fett**` als `<strong>`.
- `*kursiv*` als `<em>`.
- `[Text](https://absolute.example/path)` als externer Link.
- `[Text](mailto:name@example.org)` als E-Mail-Link.

Verbotene Syntax wird nicht als entsprechendes HTML interpretiert:

- Raw HTML.
- Bilder `![Alt](...)`.
- Überschriften.
- Listen.
- Tabellen.
- Inline- und Block-Code.
- `http:`.
- `javascript:`.
- `data:`.
- `vbscript:`.
- Relative URLs.
- Protokollrelative URLs.

Parser- und Rendererregeln:

- [ ] Keine Regex verwenden, die aus einem kompletten Link direkt HTML zusammensetzt.
- [ ] Markdown zeichenweise oder über klar begrenzte Token parsen.
- [ ] Linkziel mit `new URL(rawUrl)` ohne Basis-URL parsen. Dadurch bleiben relative und protokollrelative Ziele ungültig.
- [ ] Nur `url.protocol === "https:"` oder `url.protocol === "mailto:"` akzeptieren.
- [ ] HTTPS erfordert einen nicht leeren Host und darf keine eingebetteten Zugangsdaten enthalten.
- [ ] `mailto:` erfordert einen nicht leeren Empfänger und darf keine Leer- oder Steuerzeichen enthalten.
- [ ] Bei vollständig erkannter, aber abgelehnter Linksyntax nur den sichtbaren Linktext als normalen Text ausgeben; keinen `<a>`-Knoten erzeugen.
- [ ] Bei fehlerhafter, nicht vollständig erkannter Markdownsyntax die Eingabezeichen als Text erhalten.
- [ ] Bildsyntax vollständig als Text behandeln und nicht den darin enthaltenen `[Alt](...)`-Teil versehentlich als Link rendern.
- [ ] Raw HTML ausschließlich als Textknoten ausgeben.
- [ ] Erlaubte Element-Whitelist auf `p`, `br`, `strong`, `em`, `a` und `span` für den Screenreader-Hinweis begrenzen.
- [ ] Keine Eventattribute und kein `style` aus Eingaben übernehmen.
- [ ] HTTPS-Links erhalten `target="_blank"` und `rel="noopener noreferrer"`.
- [ ] Nach HTTPS-Links einen visuell versteckten Hinweis „öffnet in einem neuen Tab“ einfügen und diesen für Screenreader verfügbar lassen.
- [ ] `mailto:`-Links erhalten kein `target` und keinen Neuer-Tab-Hinweis.
- [ ] CSS-Klasse `.visually-hidden` in `assets/css/app.css` ergänzen.
- [ ] Kombinationen aus Hervorhebung und Text sicher verarbeiten. Verschachtelte oder mehrdeutige Konstrukte dürfen konservativ als Text erscheinen; Sicherheit hat Vorrang vor vollständiger Markdown-Kompatibilität.
- [ ] News/About-Funktion `markdown()` in `assets/js/ui.js` unverändert lassen.

Akzeptanzkriterien:

- [ ] Renderer funktioniert als Browsermodul und `parse()`/URL-Prüfung funktionieren per CommonJS in Node.
- [ ] Es gibt keine Stelle, an der Buchungs-Markdown in `innerHTML` gelangt.
- [ ] Erlaubte Links funktionieren mit korrekten Attributen.
- [ ] Abgelehnte Links sind nicht klickbar.
- [ ] XSS-Payloads erzeugen nur Text, keine ausführbaren Elemente oder Attribute.
- [ ] LF, Umlaute und ß bleiben sichtbar korrekt.

Pflichttests in `tests/restricted-markdown.test.js`:

- [ ] Absätze und einzelne LF.
- [ ] `**fett**` und `*kursiv*`.
- [ ] Absolute HTTPS-URL mit Query und Fragment.
- [ ] `mailto:`.
- [ ] `http:`, `javascript:`, gemischt geschriebene gefährliche Protokolle, `data:` und `vbscript:`.
- [ ] Relative und protokollrelative URL.
- [ ] `<script>`, `<img onerror>`, SVG- und Attribut-Payloads.
- [ ] Bildsyntax.
- [ ] Überschrift, Liste, Tabelle und Code bleiben nicht-semantischer Text.
- [ ] Fehlende Klammern, ungepaarte Sternchen und leeres Linkziel.
- [ ] Umlaute und ß.

```pwsh
node tests/restricted-markdown.test.js
```

## Phase 5: Frontend-Kernlogik und 24-Stunden-Cache implementieren

Neue Datei: `assets/js/frontend-core.js`.

Zu ändernde Datei: `assets/js/app.js`.

Neue Prüfung: `tests/frontend-core.test.js`.

Öffentliche Kernfunktionen:

```js
FrontendCore.OCCUPANCY_CACHE_TTL_MS
FrontendCore.occupancyCacheKey(buildingId, from, to)
FrontendCore.createOccupancyCacheRecord(payload, now)
FrontendCore.parseOccupancyCacheRecord(raw, now)
FrontendCore.sortOccupancyItems(items)
FrontendCore.dayStatus(items)
```

Cacheformat:

```json
{
  "cachedAt": 1784024100000,
  "payload": {
    "schemaVersion": 2,
    "loadedAt": "2026-07-14T10:15:00.000Z",
    "items": []
  }
}
```

Genaue Änderungen:

- [ ] Cachekey exakt als `occupancy:v2:<buildingId>:<from>:<to>` bilden.
- [ ] `OCCUPANCY_CACHE_TTL_MS` exakt auf `24 * 60 * 60 * 1000` setzen.
- [ ] `createOccupancyCacheRecord()` setzt `cachedAt` auf den übergebenen Testzeitpunkt oder `Date.now()` und enthält den vollständigen Payload einschließlich öffentlicher Details.
- [ ] `parseOccupancyCacheRecord()` kapselt `JSON.parse` nicht selbst als ungefangene Ausnahme, sondern liefert einen Ergebniszustand wie `fresh`, `expired` oder `invalid`.
- [ ] Record nur akzeptieren, wenn `cachedAt` endlich/numerisch, nicht zukünftig, Payload ein Objekt und `payload.items` ein Array ist.
- [ ] Bei Alter `< TTL` `fresh`, bei Alter `>= TTL` `expired` liefern.
- [ ] In `app.js` kleine Storage-Wrapper `readOccupancyCache(range)`, `writeOccupancyCache(range, payload)` und `removeOccupancyCache(range)` ergänzen.
- [ ] Jeden Storagezugriff separat mit `try/catch` schützen.
- [ ] Bei `invalid` oder `expired` den v2-Key fehlergeschützt entfernen und nichts anzeigen.
- [ ] Den alten exakten Key `occupancy:<buildingId>:<from>:<to>` beim Laden dieses Bereichs fehlergeschützt entfernen; alten Inhalt nie lesen.
- [ ] Quota-Fehler beim Schreiben ignorieren, nachdem die frische Netzwerkantwort normal gerendert wurde.
- [ ] `currentOccupancyPayload`/`currentOccupancyRange` zu einem eindeutigen Zustand erweitern oder um `currentOccupancyStale` ergänzen.
- [ ] `renderOccupancy()` den gespeicherten stale-Wert weiterreichen lassen, statt `false` fest einzutragen.
- [ ] Bei erfolgreichem Netzabruf `stale: false` setzen und vollständigen Payload cachen.
- [ ] Bei Netzfehler nur einen gültigen Cache unter 24 Stunden verwenden und `stale: true` setzen.
- [ ] Ansichtswechsel muss denselben Zustand mit `stale: true` weiter rendern.
- [ ] Tagesdialog muss seine Einträge aus demselben aktuellen Zustand beziehen, damit öffentliche Details im Offlinefall erhalten bleiben.
- [ ] Abgelaufenen Cache nicht als leere Belegung interpretieren; stattdessen vorhandene Ladefehlermeldung anzeigen.
- [ ] `loadedAt` ausschließlich für den sichtbaren Datenstand verwenden, nie zur TTL-Berechnung.
- [ ] `bookingItems()` weiterhin `requested` herausfiltern; defensiv sortierte API-Items verwenden.

Akzeptanzkriterien:

- [ ] 23:59:59.999 Stunden alter Cache ist nutzbar.
- [ ] Exakt 24:00:00.000 Stunden alter Cache wird gelöscht und nicht angezeigt.
- [ ] Kaputtes JSON, blockierter Storage und Quota-Fehler brechen die App nicht.
- [ ] Beide Gebäude und Bereiche besitzen getrennte Keys.
- [ ] Öffentliche Detailtexte bleiben bei gültigem Offlinefallback, Ansichtswechsel und geöffnetem Dialog erhalten.
- [ ] Stale-Anzeige bleibt nach Ansichtswechsel sichtbar.

Pflichttests in `tests/frontend-core.test.js`:

- [ ] Exakter Key für beide Gebäude.
- [ ] Zwei Datumsbereiche kollidieren nicht.
- [ ] 23:59 gültig und 24:00 ungültig.
- [ ] Zukunftszeitpunkt ungültig.
- [ ] Kaputtes JSON und falsche Recordtypen.
- [ ] Payload mit öffentlichen Details bleibt vollständig erhalten.
- [ ] Storage-Wrapper mit get/set/remove-Ausnahmen über testbare Adapter oder VM-Kontext.
- [ ] Sortierung mehrerer Einträge nach Datum, `from`, `to` und stabiler ursprünglicher Reihenfolge bei Gleichstand.
- [ ] Tagesstatuspriorität `blocked`, `busy`, `partial`, `free`.

```pwsh
node tests/frontend-core.test.js
```

## Phase 6: Gemeinsamen Detailrenderer, Liste und Dialog implementieren

Dateien:

- `index.html`
- `assets/js/ui.js`
- `assets/js/app.js`
- `assets/css/app.css`
- `betreiber/allgemein/texte/frontend.json`

Neue oder geänderte UI-Symbole:

- `renderBookingDetails(target, item)`
- `createBookingDetailsElement(item)` oder ein gleichwertiger DOM-Helper
- `renderOccupancy(items, loadedAt, stale)`
- `renderOccupancyPlan(items, loadedAt, stale, range)`
- `itemStatus(item)` und `dayStatus(items)` oder Verwendung der gleichnamigen Funktionen aus `FrontendCore`
- `renderMonth(month, itemsByDate, range)`
- neue Funktion `openBookingDetailsDialog(date, trigger)`
- neue Funktion `close`-Fokusrückgabe für den Dialog

Texte in `frontend.json` ergänzen oder ändern:

- [ ] `viewTable`: `Liste`.
- [ ] `showAsTable`: `als Liste anzeigen`.
- [ ] Label `Veranstaltung`.
- [ ] Label `Veranstalter`.
- [ ] Dialogtitel/-hinweis für Tagesdetails.
- [ ] Text `Details öffnen` für vollständige Aria-Labels.
- [ ] Status `gesperrt`.
- [ ] Legendentext `gesperrt`.
- [ ] Schließen-Text.
- [ ] Screenreader-Hinweis `öffnet in einem neuen Tab`.
- [ ] Datenschutz-/Cachehinweis in verständlichem Deutsch, wo die öffentliche Belegung erklärt wird.

Statischer Dialog in `index.html`:

- [ ] Genau ein natives `<dialog id="bookingDetailsDialog">` einfügen.
- [ ] Dialog mit `aria-labelledby` an eine dynamisch befüllte Überschrift binden.
- [ ] Einen statischen Inhaltscontainer für chronologisch sortierte Tageseinträge vorsehen.
- [ ] Schließen-Button in `<form method="dialog">` setzen.
- [ ] Keine `role="dialog"`-Doppelung hinzufügen; `<dialog>` liefert die Semantik.
- [ ] `Escape` nativ schließen lassen.
- [ ] Beim `close`-Event Fokus explizit auf den gespeicherten Trigger zurückgeben.
- [ ] Wenn der Trigger nach einem Rerender nicht mehr verbunden ist, Fokus auf `#occupancyView`, ersatzweise auf die Überschrift des Belegungsabschnitts setzen.
- [ ] Neue Scripts vor `ui.js`/`app.js` laden.

Gemeinsamer Detailrenderer:

- [ ] `renderBookingDetails(target, item)` erzeugt Datum-Label, Zeit, Statusbadge und optionale Detailblöcke.
- [ ] Datum-Label als wiedererkennbares eckiges Designelement in Primärfarbe gestalten.
- [ ] Zeit als „Ganzer Tag“ oder „HH:MM bis HH:MM Uhr“ ausgeben.
- [ ] Statusbadge anhand `statusKey` ausgeben; `blocked` rot.
- [ ] `publicTitle` nur bei nicht leerem String als gelabelten Block „Veranstaltung“ rendern.
- [ ] `publicOrganizer` nur bei nicht leerem String als gelabelten Block „Veranstalter“ rendern.
- [ ] Leere öffentliche Felder vollständig weglassen; keine Gedankenstriche oder Platzhalter.
- [ ] Beide Textwerte ausschließlich mit `RestrictedMarkdown.render()` rendern.
- [ ] Listenkarte und jeder Dialogeintrag rufen exakt diese Funktion auf.
- [ ] Liste defensiv chronologisch sortieren.
- [ ] Dialogeinträge eines Tages nach `from`, dann `to`, dann stabiler Eingangsreihenfolge sortieren.

Kalenderinteraktion:

- [ ] Freier Tag bleibt nativer Button mit `data-booking-date` und startet weiterhin das Anfrageformular.
- [ ] Jeder `partial`-, `busy`- oder `blocked`-Tag wird nativer Button mit `data-occupancy-date`.
- [ ] Nicht freie Tagesbuttons erhalten `aria-haspopup="dialog"` und `aria-controls="bookingDetailsDialog"`.
- [ ] Vollständiges `aria-label` enthält formatiertes Datum, Status und Aktion „Details öffnen“.
- [ ] Nicht freie Tagesbuttons erhalten kein `data-booking-date`, damit sie nicht versehentlich das Anfrageformular vorbefüllen.
- [ ] Kalenderzellen bleiben visuell kompakt und zeigen ausschließlich Tageszahl und Statusfarbe; Veranstaltung und Veranstalter erscheinen nur in Liste und Dialog.
- [ ] Klickdelegation in `app.js` unterscheidet zuerst Dialogtrigger und freie Buchungstrigger eindeutig.
- [ ] Enter und Leertaste über natives Buttonverhalten testen; keine `role="button"`-Nachbildung.
- [ ] Keine `role="grid"`, `role="row"` oder `role="gridcell"` hinzufügen.
- [ ] Monatstitel in eine echte Überschrift, beispielsweise `<h3>`, setzen. Die vorhandene Aktion zum Wechsel in die Monatsliste darf als Button innerhalb der Überschrift erhalten bleiben.

Statuslogik:

- [ ] Enthält der Tag einen ganztägigen `blocked`-Eintrag, Status `blocked` und rote Zelle.
- [ ] Sonst enthält der Tag einen ganztägigen `confirmed`-Eintrag, Status `busy` und Primärfarbe.
- [ ] Sonst enthält der Tag mindestens einen Eintrag, Status `partial` und bestehender diagonaler Verlauf.
- [ ] Sonst Status `free`.
- [ ] Bei mehreren Einträgen hat ganztägiges `blocked` Vorrang vor ganztägigem `confirmed`.
- [ ] Zeitweise `blocked` bleibt Kalenderstatus `partial`, zeigt im Detail aber rotes Badge.
- [ ] Legende um rote Kategorie `gesperrt` ergänzen.

Accessibility und Statusausgabe:

- [ ] `aria-live="polite"` von `#occupancyList` entfernen.
- [ ] `#occupancyMeta` mit `role="status"` und `aria-atomic="true"` versehen.
- [ ] Eigene CSS-Regel für `#occupancyMeta` oder `.occupancy-meta` mit kontrastreicher Textfarbe auf Panelhintergrund ergänzen.
- [ ] Statusupdates knapp halten, damit nicht die gesamte Liste vorgelesen wird.
- [ ] Sichtbaren Fokus für alle Tagesbuttons und Dialogsteuerungen beibehalten.
- [ ] Dialog nach `showModal()` sinnvoll fokussieren; nativer Autofokus auf Schließen-Button oder Dialogüberschrift mit `tabindex="-1"` ist festzulegen und zu testen.

Responsive CSS:

- [ ] Tagesziele standardmäßig mindestens 44 × 44 CSS-Pixel groß machen.
- [ ] Auf kleinen Breiten Panel- und Kalenderpadding reduzieren, nicht die Interaktionsziele unter 44 px verkleinern.
- [ ] Kalendergrid mit `minmax(0, 1fr)` und begrenzten Gaps ohne horizontalen Overflow halten.
- [ ] Dialog eckig, Open Sans, bestehende Variablen/Farben und `max-width` relativ zum Viewport verwenden.
- [ ] Dialoghöhe begrenzen und inneren Inhaltsbereich mit `overflow-y: auto` scrollbar machen.
- [ ] `dialog::backdrop` zurückhaltend gestalten.
- [ ] Kein generisches Redesign anderer Sektionen durchführen.
- [ ] Lange URLs, Veranstalternamen und Markdowntext mit `overflow-wrap: anywhere` abfangen.

Akzeptanzkriterien:

- [ ] Liste zeigt Datum, Zeit, Status und nur vorhandene gelabelte Details.
- [ ] Dialog zeigt alle Tageseinträge chronologisch mit identischen Detailtexten zur Liste.
- [ ] Belegte, teilbelegte und gesperrte Tage sind native Dialogbuttons.
- [ ] Freie Tage starten unverändert die Anfrage.
- [ ] Klick, Enter, Leertaste, Escape und Fokusrückgabe funktionieren.
- [ ] Monatsname ist semantische Überschrift.
- [ ] Bei 390 px Viewportbreite existiert kein horizontaler Overflow.
- [ ] DGH- und Gemeindehausfarben bleiben erhalten.

Tests:

- [ ] Pure Status-/Sortierfälle in `tests/frontend-core.test.js`.
- [ ] DOM-, Keyboard-, Dialog- und Responsive-Fälle in `tests/browser.test.py`.
- [ ] Bestehende News/About-Ausgabe regressiv im Browser prüfen.

## Phase 7: Browser-End-to-End-Test ohne Produktionssecret

Neue Datei: `tests/browser.test.py`.

Testaufbau:

- [ ] `_site` muss vor Teststart durch `python scripts/build-pages-site.py` erzeugt sein.
- [ ] Im Test einen lokalen `ThreadingHTTPServer` auf einem freien Loopback-Port starten und im `finally` sicher beenden.
- [ ] Playwright Chromium headless verwenden.
- [ ] Service Worker im Testkontext blockieren, damit alte lokale Worker den Test nicht beeinflussen.
- [ ] `config/config.js` per Playwright-Route nur im Test mit einer syntaktisch gültigen Test-`/exec`-URL ausliefern; Repositoryquelle nicht mit Secret oder Test-URL überschreiben.
- [ ] Apps-Script-GET-Antworten per `page.route()` erfüllen.
- [ ] Unterschiedliche Mockantworten für `dgh_rb` und `ev_gem_rb` verwenden.
- [ ] Keine Anfrage an die echte `script.google.com`-Produktion durchlassen.
- [ ] Console-Errors und ungefangene Page-Errors sammeln und am Testende als Fehler behandeln.

Pflichtfälle:

- [ ] Mehrere Einträge eines Tages werden chronologisch angezeigt.
- [ ] Listen- und Dialogdarstellung enthalten für denselben Eintrag identische Veranstaltung-/Veranstaltertexte.
- [ ] Leere Details erzeugen keine Labels und keine Platzhalter.
- [ ] Ganztägige Sperrung erzeugt rote Kalenderzelle und rotes Badge.
- [ ] Zeitweise Sperrung erzeugt partial-Zelle und rotes Badge im Dialog.
- [ ] Belegter Tag öffnet per Klick.
- [ ] Belegter Tag öffnet bei fokussiertem Button per Enter.
- [ ] Belegter Tag öffnet bei fokussiertem Button per Leertaste.
- [ ] Escape schließt und Fokus kehrt zum Trigger zurück.
- [ ] Schließen-Button mit `form method="dialog"` schließt und Fokus kehrt zurück.
- [ ] Freier Tag füllt weiterhin das Anfrageformular vor.
- [ ] `#occupancyList` besitzt kein `aria-live`.
- [ ] `#occupancyMeta` besitzt `role="status"` und `aria-atomic="true"`.
- [ ] Monatsname ist als Überschrift erkennbar.
- [ ] Bei 390 px Breite gilt `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- [ ] HTTPS-Link hat `_blank`, `noopener noreferrer` und Screenreader-Hinweis.
- [ ] `mailto:` öffnet keinen neuen Tab.
- [ ] XSS-Teststrings erzeugen keine `script`, `img`, `svg` oder Eventhandler im Buchungsdetail.
- [ ] DGH- und Gemeindehaus-Mockdaten bleiben in ihren Scopes isoliert.
- [ ] Offlinefallback unter 24 Stunden zeigt stale samt Details; Ansichtswechsel erhält stale.
- [ ] Abgelaufener Cache zeigt keine alten Details.

Lokale Installation:

```pwsh
python -m pip install playwright==1.61.0
python -m playwright install chromium
```

Test:

```pwsh
python tests/browser.test.py
```

CI-Installation:

```bash
python -m pip install playwright==1.61.0
python -m playwright install --with-deps chromium
```

## Phase 8: Betreibertexte, Datenschutz und Konfiguration korrigieren

Dateien:

- `betreiber/allgemein/texte/frontend.json`
- `betreiber/DGH/texte/about.md`
- `betreiber/EV_GEMEINDEHAUS/texte/about.md`
- `betreiber/allgemein/texte/rechtliches.md`
- `betreiber/allgemein/konfiguration/frontend.json`
- `betreiber/allgemein/backend/konfiguration.json`

Genaue Änderungen:

- [ ] In beiden About-Dateien die Aussage „nur belegt“ ersetzen: Öffentlich erscheinen Datum, Zeit und Status sowie ausschließlich vom Betreiber ausdrücklich freigegebene Veranstaltungstitel und Veranstalter.
- [ ] Klarstellen, dass Namen, Kontaktdaten und Texte aus Buchungsanfragen nicht automatisch veröffentlicht werden.
- [ ] Klarstellen, dass ein Betreiber bewusst einen Personennamen oder einen `mailto:`-Link als öffentlichen Veranstalter freigeben kann und damit eine öffentliche Veröffentlichung auslöst.
- [ ] Falsche Aussage zur vollständigen Löschung am Folgetag entfernen.
- [ ] Stattdessen exakt formulieren: Vergangene Belegungen werden über die öffentliche API nicht angezeigt; interne Aufbewahrung und Löschung erfolgen nach dem Prozess des jeweiligen Betreibers.
- [ ] Das bewusste Cache-Risiko dokumentieren: Bereits abgerufene freigegebene Details können nach späterer Deaktivierung auf demselben Gerät offline bis zum Ablauf der 24 Stunden sichtbar bleiben.
- [ ] Den technischen Cachehinweis auch im Datenschutz-/Rechtstext sachlich ergänzen, ohne den vorhandenen Platzhalter für die vollständige Betreiber-Datenschutzerklärung fälschlich als erledigt darzustellen.
- [ ] `publicShowBookingTitles` vollständig aus `betreiber/allgemein/konfiguration/frontend.json` entfernen. Sicherheitsfreigabe gehört nicht in öffentliche Frontendkonfiguration.
- [ ] Backend-Property wie in Phase 1 auf `publicShowBookingDetails` umbenennen.
- [ ] Persistierte Sheet-Settings nicht anhand der JSON-Umbenennung löschen; dafür ist die definierte Settingmigration zuständig.
- [ ] Alle neuen sichtbaren Texte in korrektem Deutsch mit Umlauten und ß schreiben.

Akzeptanzkriterien:

- [ ] Kein About-Text behauptet mehr, dass ausschließlich „belegt“ gezeigt werde.
- [ ] Keine Datei behauptet eine täglich vollständig implementierte Löschung.
- [ ] Automatische Veröffentlichung von Mieter-/Anfragedaten wird ausdrücklich ausgeschlossen.
- [ ] Bewusst öffentliche Personennamen/`mailto:` und 24-Stunden-Offlinerest sind transparent dokumentiert.
- [ ] Öffentliche Runtimekonfiguration enthält kein `publicShowBookingTitles` und keinen neuen Sicherheitsmaster.

## Phase 9: Design- und Betriebsdokumentation aktualisieren

Dateien:

- `DESIGN.md`
- `docs/google-sheet-struktur.md`
- `docs/apps-script-deployment.md`
- `apps-script/README.md`
- `README.md`
- `PROJEKTUEBERSICHT.md`

`DESIGN.md`:

- [ ] Datenschutzprinzip korrigieren: keine privaten/personenbezogenen Anfragedaten im öffentlichen Cache; bewusst freigegebene öffentliche Details dürfen 24 Stunden gecacht werden.
- [ ] Detailkarten mit Datum-Label, Zeit, Statusbadge, Veranstaltung und Veranstalter dokumentieren.
- [ ] Nativen eckigen Dialog, internen Scrollbereich, Fokusführung und Responsive-Regeln dokumentieren.
- [ ] Rote `blocked`-Legende und Statuspriorität dokumentieren.
- [ ] Eingeschränkte Markdown-Syntax samt Linkattributen und verbotenen Konstruktionen dokumentieren.
- [ ] Mindestziel 44 px und kein horizontales Overflow bei 390 px dokumentieren.

`docs/google-sheet-struktur.md`:

- [ ] Beide Zielschemas exakt dokumentieren.
- [ ] Bedeutung und Privacy aller vier öffentlichen Felder erklären.
- [ ] `Requests.note` und `Requests.internal_note` deutlich trennen.
- [ ] `public_show_booking_details` als Master dokumentieren.
- [ ] Legacy-Fallback und Nicht-Löschung des alten Keys für Version 1.3 dokumentieren.
- [ ] Checkboxen als echte Booleans, Standard false, erklären.
- [ ] Zulässiges eingeschränktes Markdown und 1000-Zeichen-Limit dokumentieren.
- [ ] `migrateSheetsV13()` samt Preflight, Backups, Wartungsfenster und fehlender globaler Atomarität dokumentieren.

`docs/apps-script-deployment.md`:

- [ ] `setupSheets()` nicht mehr als gefahrlosen Headerüberschreiber beschreiben.
- [ ] Neue Installation und Migration bestehender Sheets getrennt erklären.
- [ ] Exakte fail-closed Deploymentreihenfolge aus diesem Plan übernehmen.
- [ ] Neue API-Beispielantwort mit `schemaVersion: 2`, `publicTitle` und `publicOrganizer` ergänzen.
- [ ] Manuelle Live-Prüfung beider Gebäude und Geheimmarkertest aufnehmen.
- [ ] Bestehende `/exec`-URL und neue Deploymentversion erklären.

`apps-script/README.md`:

- [ ] API-Aufgaben um Detailsfreigabe und Migration ergänzen.
- [ ] Template-als-Quelle-Regel hervorheben.
- [ ] Gebundenes Verwaltungsskript und dessen separate Aktualisierung je Sheet erläutern.

`README.md` und `PROJEKTUEBERSICHT.md`:

- [ ] Version 1.2 auf 1.3 ändern.
- [ ] Öffentliche Details, fail-closed Freigabe, eingeschränktes Markdown und 24-Stunden-Offlinecache knapp beschreiben.
- [ ] Testliste um alle neuen Befehle ergänzen.
- [ ] Datenschutzsatz korrigieren: bewusst freigegebene Titel/Veranstalter können öffentlich sein; private Anfragefelder bleiben im Backend.
- [ ] `tests/browser.test.py` statt des bisher nur optional erwähnten `tools/test-demo.py` als Pflichtprüfung für dieses Feature nennen; vorhandenes Tool nicht ohne Grund löschen.

Akzeptanzkriterien:

- [ ] Dokumentation und Code verwenden dieselben Header, Keynamen, Cachegrenzen und API-Feldnamen.
- [ ] Version 1.3 steht in README und Projektübersicht.
- [ ] Kein Dokument empfiehlt manuelle Änderungen an generiertem `Code.gs` oder `_site`.

## Phase 10: Buildverifikation und CI erweitern

Dateien:

- `.github/workflows/pages.yml`
- bei Bedarf `scripts/verify-pages-site.py`
- `tests/content-build.test.py`
- bestehende `tests/configure-runtime.test.py`
- bestehende `tests/service-worker.test.js`

CI-Struktur:

- [ ] Trigger `pull_request` ergänzen.
- [ ] Einen Job `quality` auf `ubuntu-latest` für Push, Pull Request und manuellen Lauf anlegen.
- [ ] Python und Node 22 wie bisher einrichten.
- [ ] Playwright exakt in Version 1.61.0 und Chromium mit `--with-deps` installieren.
- [ ] Im Qualitätsjob alle Build- und Testbefehle aus diesem Plan ausführen.
- [ ] Deploymentjob nur ausführen, wenn Event kein Pull Request ist und `quality` erfolgreich war.
- [ ] Deploymentjob darf weiterhin das Secret `APPS_SCRIPT_WEB_APP_URL` ausschließlich zur Runtimekonfiguration von `_site` nutzen.
- [ ] Pull-Request-Job darf das Secret nicht benötigen.
- [ ] Vor Upload weiterhin `python scripts/verify-pages-site.py --final-artifact` ausführen.

Buildprüfungen:

- [ ] Sicherstellen, dass `build-pages-site.py` die neuen JS-Dateien unverändert in Root, DGH und Gemeindehaus kopiert. Der bestehende `copytree(ROOT / "assets/js", ...)` sollte bereits genügen; keine Sonderkopie hinzufügen.
- [ ] Sicherstellen, dass die generierten Service Worker beide neuen Dateien automatisch in `STATIC_ASSETS` aufnehmen und der Cachehash sich ändert.
- [ ] `scripts/verify-pages-site.py` um Assertions für vorhandene neue JS-Dateien und Scriptreferenzen erweitern.
- [ ] `tests/content-build.test.py` um Abwesenheit der entfernten Frontendproperty und Scope-Isolation der neuen Assets ergänzen.
- [ ] `tests/configure-runtime.test.py` weiterhin unverändert grün halten; nur ändern, wenn eine echte neue Regression abgesichert wird.
- [ ] `tests/service-worker.test.js` weiterhin grün halten und prüfen, dass externe Apps-Script-Requests nicht durch den Service Worker gecacht werden.

Akzeptanzkriterien:

- [ ] Pull Requests erhalten vollständige Qualitätsprüfung ohne Deploymentsecret.
- [ ] Push auf `main` deployt erst nach grünen Tests.
- [ ] Beide Gebäudescopes enthalten Renderer und Kernmodul im eigenen Precache.
- [ ] Root registriert weiterhin keinen Service Worker.
- [ ] Keine Root-npm-Abhängigkeit wurde eingeführt.

## Phase 11: Gesamtprüfung und Diff-Review

Arbeitsschritte:

- [ ] Alle Prüfbefehle exakt in der dokumentierten Reihenfolge ausführen.
- [ ] `git diff --check` ausführen.
- [ ] `git status --short` und `git diff --stat` prüfen.
- [ ] Vollständigen `git diff` lesen, besonders Template/generierte Datei, API-Privacy und Betreibertexte.
- [ ] Nach `python scripts/build-apps-script.py` prüfen, dass `Code.gs` die injizierten JSON-Werte und exakt die Template-Logik enthält.
- [ ] Keine manuelle Abweichung ausschließlich in `Code.gs` akzeptieren.
- [ ] `_site` nur als Buildartefakt betrachten; keine dortige Änderung als Quelle übernehmen.
- [ ] Prüfen, dass vorhandene fremde Worktree-Änderungen nicht verändert wurden.
- [ ] Nicht committen.

Akzeptanzkriterien:

- [ ] Alle automatisierten Tests sind grün.
- [ ] Kein Whitespacefehler laut `git diff --check`.
- [ ] API-Leaktests und Browser-XSS-Tests sind grün.
- [ ] Nur beabsichtigte Quellen, Tests, Dokumentation und generierte `Code.gs` sind geändert.

## Detailkapitel: Migration und Betriebssicherheit

### Erwarteter Migrationsablauf je Produktionslauf

- [ ] Wartungsfenster beginnen; Betreiber pausieren Änderungen in beiden Sheets.
- [ ] API-/Scriptkonto hat Zugriff auf beide Sheets.
- [ ] `migrateSheetsV13()` einmal manuell starten.
- [ ] Gesamt-Preflight-Ausgabe prüfen.
- [ ] Nach Erfolg Backup-Tabs und Logeinträge in beiden Sheets kontrollieren.
- [ ] Zielheader exakt gegen diesen Plan vergleichen.
- [ ] Stichproben für bestehendes `internal_note` durchführen.
- [ ] Checkboxen auf `false` und echte Checkboxvalidierung prüfen.
- [ ] Settingentscheidung je Gebäude kontrollieren.
- [ ] `migrateSheetsV13()` ein zweites Mal starten und bestätigen, dass keine weiteren Backups oder Datenumschreibungen entstehen.

### Manuelle Live-Prüfungen, die nicht aus dem Repository ableitbar sind

- [ ] Tatsächliche Version-1.2-Header in beiden privaten Sheets.
- [ ] Vorhandene zusätzliche Betreiber-Spalten.
- [ ] Formeln in Datenbereichen.
- [ ] Doppelte Settings.
- [ ] Aktuelle Werte der Legacy-Master.
- [ ] Anzahl der Datenzeilen und Apps-Script-Laufzeit.
- [ ] Existierende Backup-Tabs mit möglichen Namenskollisionen.
- [ ] Berechtigungen des standalone Scripts und der gebundenen Scripts.
- [ ] Zeitzone des Apps-Script-Projekts und beider Sheets.

### Kein falsches Atomaritätsversprechen

Die Migration prüft beide Gebäude vorab und schützt den Lauf mit einem Script-Lock. Danach werden zwei getrennte Spreadsheets nacheinander geändert. Ein Plattform-, Berechtigungs- oder Laufzeitfehler kann eintreten, nachdem das erste Spreadsheet bereits erfolgreich geändert wurde. Deshalb sind Sicherungstabs, Wartungsfenster, Ergebnisprotokoll und ein manueller Wiederherstellungsweg verpflichtend. Dokumentation darf diesen Ablauf nicht als Transaktion bezeichnen.

## Detailkapitel: Eingeschränktes Markdown

### Serverseitige Normalisierung

Beispiel Eingabe:

```text
**Frühlingsfest**\r\nEinlass ab 18 Uhr\rKontakt: [Verein](https://example.org)\u0000
```

Normalisierte API-Ausgabe:

```text
**Frühlingsfest**\nEinlass ab 18 Uhr\nKontakt: [Verein](https://example.org)
```

Der Server interpretiert weder Sternchen noch Links. Das ist wichtig, damit Apps Script nie untrusted HTML erzeugt.

### Browserseitige Whitelist

| Eingabe | Darstellung |
|---|---|
| `**Text**` | `<strong>` über DOM |
| `*Text*` | `<em>` über DOM |
| Ein LF | `<br>` |
| Leerzeile | neuer `<p>`-Knoten |
| `[Seite](https://example.org)` | sicherer externer Link |
| `[Mail](mailto:test@example.org)` | Mail-Link ohne neuen Tab |
| `[Alt](http://example.org)` | nur `Alt` als Text |
| `![Bild](https://example.org/a.png)` | vollständige Syntax als Text, kein Bild |
| `<img src=x onerror=alert(1)>` | sichtbarer Text, kein Element |

### Abgrenzung zu News und About

`assets/js/ui.js` enthält bereits `markdown()` für News und About. Dieser Renderer escaped zunächst HTML und unterstützt Überschriften, Fett, Kursiv und Zeilenumbrüche. Er wird in Version 1.3 nicht erweitert, nicht durch den neuen Renderer ersetzt und nicht als Buchungsrenderer verwendet. Diese Trennung verhindert unbeabsichtigte Änderungen an bestehenden Inhalten.

## Detailkapitel: UI und Barrierefreiheit

### Listenkarte

Reihenfolge der sichtbaren Informationen:

1. Eckiges Datum-Label.
2. Zeit oder „Ganzer Tag“.
3. Statusbadge.
4. Optional „Veranstaltung“ mit eingeschränktem Markdown.
5. Optional „Veranstalter“ mit eingeschränktem Markdown.

### Tagesdialog

- Ein statischer Dialog pro Seite.
- Überschrift enthält das vollständig formatierte Datum.
- Alle Einträge des Tages erscheinen chronologisch.
- Jeder Eintrag nutzt denselben Detailrenderer wie die Liste.
- Der Inhaltsbereich scrollt innerhalb des Viewports.
- Schließen funktioniert per Button und Escape.
- Fokus kehrt zum auslösenden Tagesbutton zurück; nach Rerender greift der dokumentierte Fallback.

### Kalenderstatus

| Tagesinhalt | Kalenderstatus | Farbe |
|---|---|---|
| Keine Einträge | `free` | Hellgrau |
| Mindestens ein zeitweiser Eintrag, auch zeitweise Sperrung | `partial` | Bestehender diagonaler Verlauf |
| Mindestens eine ganztägige bestätigte Buchung, keine ganztägige Sperrung | `busy` | Gebäude-Primärfarbe |
| Mindestens eine ganztägige Sperrung | `blocked` | `--color-error` |

### Semantik

- Native Buttons statt Rollen-Simulation.
- Kein ARIA-Grid.
- Native Dialogsemantik.
- Monatsnamen als Überschriften.
- Vollständige Aria-Labels auf nicht freien Tagen.
- Statusmeldungen ausschließlich über `#occupancyMeta`.

## Detailkapitel: Cache und Datenschutz

### Zustandsautomat

```text
Netz erfolgreich
  -> payload normalisieren
  -> current state stale=false
  -> {cachedAt: Date.now(), payload} schreiben, Fehler ignorierbar
  -> rendern

Netzfehler
  -> v2-Key lesen
  -> Parse-/Storagefehler: kein Cache
  -> Alter < 24h: current state stale=true, rendern
  -> Alter >= 24h oder Zukunft: löschen, nicht rendern
  -> kein Cache: Ladefehler anzeigen
```

### Bewusst akzeptiertes Risiko

Die Cacheentscheidung ist fachlich bewusst: Freigegebene Titel und Veranstalter werden vollständig für Offlinebetrieb gespeichert. Wird ein Detail im Sheet oder über den Master nachträglich deaktiviert, kann eine bereits geladene Kopie auf einem Gerät bei Netzfehler bis zum Ablauf von 24 Stunden ab `cachedAt` sichtbar bleiben. Die Implementierung darf dies nicht mit einer kürzeren, unbestimmten oder an `loadedAt` gebundenen Zeit kaschieren. Texte und Dokumentation müssen das Risiko klar benennen.

### Scope-Isolation

Beide Gebäudeseiten teilen im Browser dieselbe Origin, aber nicht denselben Cachekey. `buildingId`, `from` und `to` sind zwingender Teil des Keys. Tests müssen beweisen, dass Daten aus `dgh_rb` nicht als Fallback für `ev_gem_rb` erscheinen und umgekehrt.

## Detailkapitel: Version und Dokumentation

- Version 1.3 ist eine Feature-Version, daher Minor-Anhebung von 1.2.
- `README.md` und `PROJEKTUEBERSICHT.md` sind die verifizierten Versionsstellen.
- Keine erfundene Version in Manifest oder JavaScript ergänzen, solange dort aktuell keine Projektversion existiert.
- `PROJEKTUEBERSICHT.md` bleibt die knappe Architekturübersicht und wird nach der Implementierung aktualisiert.
- Technische Detailregeln gehören in `docs/google-sheet-struktur.md`, `docs/apps-script-deployment.md` und `DESIGN.md`.

## Vollständige Testmatrix

### API und Freigabe

- [ ] Neuer Master true, Titelflag true, Titel vorhanden: Titel sichtbar.
- [ ] Neuer Master true, Veranstalterflag true, Veranstalter vorhanden: Veranstalter sichtbar.
- [ ] Felder unabhängig: nur Titel sichtbar.
- [ ] Felder unabhängig: nur Veranstalter sichtbar.
- [ ] Neuer Master false: beide leer.
- [ ] Neuer Master leer und Legacy true: beide leer.
- [ ] Neuer Master fehlt und Legacy true: nur jeweils gesetztes Flag sichtbar.
- [ ] Beide Master fehlen: beide leer.
- [ ] Flag fehlt: Feld leer.
- [ ] Text leer/Whitespace: Feld leer.
- [ ] Interner `title` gesetzt, `public_title` leer: kein Fallback.
- [ ] Geheimmarker in `title`, `note`, `internal_note`, Requesterfeldern: kein Marker im JSON.
- [ ] API-Objekt enthält keine privaten Propertynamen.
- [ ] `schemaVersion` ist Zahl 2.
- [ ] `publicTitle` und `publicOrganizer` sind immer Strings.
- [ ] `false` bleibt beim Sheet-Append Boolean.

### Migration

- [ ] Beide exakten Legacy-Schemas werden erkannt.
- [ ] Beide exakten Zielschemas werden erkannt.
- [ ] Doppelte Header brechen ab.
- [ ] Leere Header brechen ab.
- [ ] Fehlende Header brechen ab.
- [ ] Unbekannte Header brechen ab.
- [ ] Falsche Reihenfolge bricht ab.
- [ ] Doppeltes Setting bricht ab.
- [ ] Formel in Bookings bricht vor jeder Änderung ab.
- [ ] Formel in Requests bricht vor jeder Änderung ab.
- [ ] Formel im zu ändernden Settings-Bereich bricht vor jeder Änderung ab.
- [ ] `internal_note` bleibt werttreu.
- [ ] `Requests.note` wird nicht verschoben.
- [ ] Neue Flags sind Boolean false und Checkboxen.
- [ ] Neuer Master bleibt erhalten, wenn vorhanden.
- [ ] Legacy-Wert wird nur bei fehlendem neuen Key übernommen.
- [ ] Ohne beide Keys entsteht false.
- [ ] Zweiter Lauf erstellt keine neuen Backups und schreibt keine Daten neu.
- [ ] Fehlende Validierung im Zielschema wird repariert.

### Markdown und XSS

- [ ] LF, CRLF, CR, Umlaute und ß.
- [ ] 1000-Zeichen-Grenze.
- [ ] Absätze und Zeilenumbrüche.
- [ ] Fett und Kursiv.
- [ ] HTTPS-Link.
- [ ] Mailto-Link.
- [ ] Neuer-Tab-Attribute und Screenreader-Hinweis.
- [ ] Kein neuer Tab für mailto.
- [ ] Raw HTML als Text.
- [ ] Bildsyntax als Text.
- [ ] Überschrift, Liste, Tabelle, Code nicht als solche gerendert.
- [ ] `http`, `javascript`, `data`, `vbscript` abgelehnt.
- [ ] Relative und protokollrelative URLs abgelehnt.
- [ ] Gemischte Groß-/Kleinschreibung gefährlicher Protokolle abgelehnt.
- [ ] Fehlerhafte Syntax bleibt sicherer Text.
- [ ] Keine ausführbaren Elemente oder Eventattribute.

### UI und Accessibility

- [ ] Mehrere Einträge chronologisch.
- [ ] Identische Liste-/Dialogdetails durch denselben Renderer.
- [ ] Leere Felder ohne Platzhalter.
- [ ] Ganztägig blocked rot.
- [ ] Ganztägig confirmed Primärfarbe.
- [ ] Zeitweise Belegung partial.
- [ ] Zeitweise Sperrung partial, Badge rot.
- [ ] Legende enthält gesperrt.
- [ ] Klick öffnet Dialog.
- [ ] Enter öffnet Dialog.
- [ ] Leertaste öffnet Dialog.
- [ ] Escape schließt Dialog.
- [ ] Schließen-Button schließt Dialog.
- [ ] Fokus kehrt zurück.
- [ ] Fallbackfokus nach Rerender.
- [ ] Freier Tag startet Anfrage.
- [ ] Nicht freier Tag startet keine Anfrage.
- [ ] Monat ist Überschrift.
- [ ] Kein ARIA-Grid.
- [ ] `#occupancyMeta` ist atomarer Status.
- [ ] `#occupancyList` ist keine Live-Region.
- [ ] 44-px-Tagesziele.
- [ ] 390 px ohne horizontalen Overflow.
- [ ] Dialog intern scrollbar.

### Cache und Scopes

- [ ] Key exakt `occupancy:v2:<buildingId>:<from>:<to>`.
- [ ] 23:59 gültig.
- [ ] 24:00 ungültig.
- [ ] Zukünftiges `cachedAt` ungültig.
- [ ] TTL verwendet nicht `loadedAt`.
- [ ] Kaputtes JSON bricht App nicht.
- [ ] `getItem`-Securityfehler bricht App nicht.
- [ ] `setItem`-Quota-Fehler bricht App nicht.
- [ ] `removeItem`-Fehler bricht App nicht.
- [ ] Alter v1-Key wird nicht gelesen.
- [ ] Stale bleibt nach Ansichtswechsel.
- [ ] Stale-Dialog behält Details.
- [ ] DGH/Gemeindehaus isoliert.
- [ ] Verschiedene Zeiträume isoliert.

### Regression

- [ ] Buchungsanfrage funktioniert weiter.
- [ ] Kontaktanfrage funktioniert weiter.
- [ ] News-Renderer funktional unverändert.
- [ ] About-Renderer funktional unverändert.
- [ ] Downloads funktionieren weiter.
- [ ] Service-Worker-Strategien bleiben grün.
- [ ] Root bleibt ohne Service Worker.
- [ ] Beide Gebäudethemes bleiben erhalten.
- [ ] Scope-Build enthält keine fremden Betreiberinhalte.

## Vollständige Prüfbefehle

Diese Befehle nach der Implementierung exakt in dieser Reihenfolge ausführen:

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

Zusätzliche Diff-Prüfungen:

```pwsh
git diff --check
git status --short
git diff --stat
git diff
```

Für den Browser-Test lokal einmalig:

```pwsh
python -m pip install playwright==1.61.0
python -m playwright install chromium
```

In CI:

```bash
python -m pip install playwright==1.61.0
python -m playwright install --with-deps chromium
```

## Deploymentreihenfolge fail closed

Die Reihenfolge ist verbindlich:

1. [ ] Branch lokal vollständig implementieren, generieren, bauen und mit allen Tests prüfen.
2. [ ] Kopien beider Sheets anlegen und eine Staging-Apps-Script-Web-App gegen diese Kopien testen.
3. [ ] Produktive Sheets zusätzlich außerhalb der Migration sichern und Wartungsfenster beginnen.
4. [ ] Neue rückwärtskompatible, fail-closed API zuerst als neue Version auf der bestehenden `/exec`-Deployment-URL veröffentlichen. Alte Sheets ohne Flags zeigen vorübergehend keine Details.
5. [ ] API für `dgh_rb` und `ev_gem_rb` prüfen. In private Felder eingetragener Geheimmarker darf nie in der Response erscheinen.
6. [ ] `migrateSheetsV13()` auf Produktion ausführen, Ergebnis prüfen und zweiten Lauf zur Idempotenzkontrolle starten.
7. [ ] Gebundenes `apps-script/buchungsverwaltung/Code.gs` in jedem der beiden Sheets separat aktualisieren, speichern, autorisieren und testen.
8. [ ] Öffentliche Texte und Checkboxen im `Bookings`-Tab bewusst setzen. `public_show_booking_details` erst nach Prüfung je Gebäude aktivieren.
9. [ ] Frontend/Pages Version 1.3 deployen.
10. [ ] Live online, offline, mobil, per Tastatur und hinsichtlich CORS prüfen; danach sämtliche Testdaten und Geheimmarker entfernen.

Live-Prüfungen nach Schritt 9:

- [ ] Beide `/exec?action=occupancy...`-Antworten enthalten `schemaVersion: 2`.
- [ ] Unfreigegebene private Marker fehlen.
- [ ] Titel und Veranstalter schalten unabhängig.
- [ ] Beide Pages-Scopes verwenden ihre korrekte Gebäude-ID und Farbe.
- [ ] Dialog funktioniert mit Maus, Enter, Leertaste und Escape.
- [ ] Fokus kehrt zurück.
- [ ] 390-px-Mobilansicht hat keinen horizontalen Overflow.
- [ ] Offlinefall zeigt nur Cache unter 24 Stunden.
- [ ] CORS-/Redirect-Verhalten der echten Apps-Script-URL funktioniert.
- [ ] Service Worker kontrolliert nur den jeweiligen Gebäudescope.

## Rollback

### Frontendrollback

- [ ] Pages auf den letzten bekannten Build zurücksetzen oder vorheriges Artefakt erneut bereitstellen.
- [ ] API Version 1.3 weiterlaufen lassen. Das additive API-Schema ist mit dem alten Frontend kompatibel; `publicOrganizer` wird vom alten Frontend ignoriert.
- [ ] Nicht als erste Maßnahme die API auf Version 1.2 zurückrollen, weil deren `public_title || title`-Fallback das behobene Privacy-Leck wieder einführt.

### API-Rollback

- [ ] Bevor eine alte API-Version unvermeidbar reaktiviert wird, in beiden Settings-Tabs `public_show_booking_titles` ausdrücklich auf `false` setzen.
- [ ] Neuen Master ebenfalls auf `false` setzen.
- [ ] API-Responses beider Gebäude mit Geheimmarker testen.
- [ ] Bevorzugt die Version-1.3-API vorwärts korrigieren statt auf die leckende Version-1.2-Logik zurückzugehen.

### Sheetrollback

- [ ] Wartungsfenster erneut aktivieren und alle Schreibzugriffe pausieren.
- [ ] Betroffenes Gebäude und Backupzeitstempel eindeutig auswählen.
- [ ] Aktuellen fehlerhaften Tab zusätzlich sichern.
- [ ] Backup anhand dokumentierter Header und Zeilenzahlen wiederherstellen.
- [ ] Nie blind beide Gebäude zurücksetzen, wenn nur eines betroffen ist.
- [ ] Nach Wiederherstellung API und gebundenes Verwaltungsskript gegen das wiederhergestellte Schema prüfen.
- [ ] Version-1.3-API kann exakte Legacy-Schemas fail closed lesen; dadurch bleibt ein Sheetrollback ohne Detailleck möglich.

### Cache nach Notfall-Deaktivierung

Eine Server- oder Sheet-Deaktivierung entfernt bereits gespeicherte Browserdaten nicht sofort. Bei einem sensiblen Fehlrelease ist zu dokumentieren, dass öffentliche Details auf Geräten offline bis zu 24 Stunden ab ihrem jeweiligen `cachedAt` sichtbar bleiben können. Ein Pages- oder API-Rollback kann fremden `localStorage` nicht aktiv löschen, solange das Gerät offline ist.

## Definition of Done

- [ ] Zielschemas sind in Code und Dokumentation identisch.
- [ ] `Bookings.internal_note` wurde werttreu ans Ende migriert.
- [ ] `Requests.internal_note` existiert und wird korrekt übernommen.
- [ ] `Requests.note` bleibt Antragstellertext und privat.
- [ ] Neue Sichtbarkeitsfelder sind echte Checkbox-Booleans mit Default false.
- [ ] Master-/Fallbacklogik entspricht vollständig der Freigabematrix.
- [ ] `public_title || title` existiert nirgends mehr.
- [ ] API enthält `schemaVersion: 2`, `publicTitle` und `publicOrganizer`, aber keine privaten Felder.
- [ ] Eingeschränkter Markdownrenderer ist DOM-/Whitelist-basiert und Node-/Browser-getestet.
- [ ] News/About-Markdown funktioniert unverändert.
- [ ] Liste und Dialog verwenden exakt denselben Buchungsdetailrenderer.
- [ ] Kalenderstatus, blocked-Legende und Dialoginteraktion entsprechen den Regeln.
- [ ] Accessibility-Pflichtfälle inklusive Fokus und 390-px-Layout sind getestet.
- [ ] Cachekey, Recordformat, 24-Stunden-TTL und Storagefehlerbehandlung sind umgesetzt.
- [ ] Stale-Zustand bleibt bei Ansichtswechsel und Dialog erhalten.
- [ ] Beide Gebäudescopes sind isoliert.
- [ ] `migrateSheetsV13()` ist explizit, gesichert, preflighted, blockweise und idempotent.
- [ ] `setupSheets()` überschreibt keine gefüllten unbekannten Header.
- [ ] Verwaltungsskript initialisiert öffentliche Felder fail closed und prüft Header.
- [ ] About-, Datenschutz-, Design-, Sheet-, Deployment- und Projekttexte sind konsistent.
- [ ] README und Projektübersicht nennen Version 1.3.
- [ ] Alle vollständigen Prüfbefehle sind grün.
- [ ] Generiertes `Code.gs` entspricht Template plus Betreiberinjektion.
- [ ] `_site` wurde nicht manuell editiert.
- [ ] Vollständiger Diff wurde auf Privacy-Leaks und unbeabsichtigte Änderungen geprüft.
- [ ] Keine fremden Worktree-Änderungen wurden überschrieben.
- [ ] Ohne ausdrücklichen Auftrag wurde kein Commit erstellt.

## Abschließende Warnungen

- `apps-script/buchungs-api/Code.gs` nicht manuell pflegen. Jede Änderung gehört in `Code.template.gs` oder die injizierten JSON-Dateien.
- `_site/**` nicht manuell editieren. Der Ordner wird von `scripts/build-pages-site.py` vollständig neu erzeugt.
- `setupSheets()` nicht als Migration missbrauchen.
- `migrateSheetsV13()` nicht ohne Kopien, Gesamt-Preflight und Wartungsfenster auf Produktion starten.
- Den neuen Master nicht aktivieren, bevor API, Flags, Texte und Geheimmarkertest geprüft sind.
- Eine alte API mit aktivem Legacy-Master nicht reaktivieren; sie enthält den kritischen internen Titel-Fallback.
- Keine privaten Daten, Sheet-IDs außerhalb der bereits vorgesehenen Backendkonfiguration oder Produktionssecrets in Frontenddateien oder Browsertests ergänzen.
- Keine fremden Worktree-Änderungen zurücksetzen oder überschreiben.
- Nicht committen, solange der Benutzer keinen ausdrücklichen Commit-Auftrag erteilt.
