# Version 1.4: Belegungs-PDF, automatische Aktualisierung, Entfernen des „belegt“-Badges

## 1. Zweck dieses Plans

Dieser Plan ist der vollständige, ausführbare Implementierungsauftrag für ein ChatGPT-Terra-Modell ohne vorherigen Gesprächskontext. Er ersetzt den bisherigen historischen Inhalt von `plan.md`; die beschriebenen Änderungen sind noch **nicht** umgesetzt. Alle Produktentscheidungen sind abgeschlossen. Es gibt keine offenen Produktfragen und keine Varianten, über die das ausführende Modell erneut entscheiden soll.

Die Umsetzung erweitert ausschließlich das bestehende öffentliche Frontend der Gebäudevermietung. Sie erzeugt eine druckoptimierte Belegungsansicht über den Browser-Druckdialog, aktualisiert Belegungsdaten automatisch bei einem Zeitraumwechsel und entfernt gezielt den redundanten Statusbadge „belegt“ aus einzelnen bestätigten Belegungseinträgen.

## 2. Auftrag

Folgende Ergebnisse sind gemeinsam als Feature Version 1.4 umzusetzen:

1. Im Belegungsbereich steht eine sichtbare Aktion **„PDF erstellen / drucken“** zur Verfügung.
2. Diese Aktion bereitet synchron eine druckoptimierte A4-Hochformatansicht vor und öffnet anschließend `window.print()`. Der Browser-Druckdialog übernimmt PDF-Speicherung oder physischen Druck.
3. Direktes Drücken von Strg+P beziehungsweise Cmd+P bereitet über `beforeprint` dieselbe Ansicht vor.
4. Der Ausdruck basiert ausschließlich auf einem eingefrorenen Snapshot der bereits geladenen öffentlichen Belegungsdaten. Er liest keine Daten aus der sichtbaren DOM-Struktur und startet keinen API-Aufruf.
5. Ein Wechsel des Zeitraums startet automatisch den API-Abruf. Ein Wechsel zwischen Plan- und Listenansicht rendert ausschließlich lokal aus den bereits geladenen Daten.
6. Während eines Abrufs bleibt die bisherige Ansicht sichtbar, ist jedoch mit `inert` und `aria-busy` gegen Interaktion gesperrt. Auch der Export ist währenddessen gesperrt.
7. Der manuelle Button **„Aktualisieren“** bleibt erhalten und darf keinen Doppel-Submit auslösen.
8. Nur bei einzelnen Einträgen mit `statusKey === "confirmed"` entfällt der sichtbare Statusbadge. Statusanzeigen für `blocked` und unbekannte Status bleiben erhalten. Kalender, Legende und ARIA-Texte verwenden „belegt“ weiterhin unverändert.
9. Die bestehende 24-Stunden-Datenschutzgrenze des lokalen öffentlichen Belegungscaches wird physisch eingehalten und auf die Keys des aktuellen Gebäudes begrenzt bereinigt.
10. Nach vollständiger Featureimplementierung und grünen relevanten Tests wird die dokumentierte Frontend-Produktversion von `1.3.1` auf `1.4.0` erhöht, ausschließlich in `README.md` und `PROJEKTUEBERSICHT.md`; danach folgt der vollständige finale Verifikationslauf. Produkt-/Backendrelease sowie Apps-Script-/Sheet-Migration bleiben auf Stand `1.3`. Das öffentliche Occupancy-Response-Schema bleibt unverändert `schemaVersion: 2`.

## 3. Verbindliche Produktentscheidungen

Diese Entscheidungen stammen aus dem abgeschlossenen Grill-me und dürfen nicht neu verhandelt oder stillschweigend abgewandelt werden:

- Ausgabeweg: Browser-Druckdialog, kein direkter PDF-Download und keine clientseitige PDF-Datei-Erzeugung.
- Buttontext: ehrlich und vollständig **„PDF erstellen / drucken“**.
- Papierformat: A4, Hochformat.
- Druckkopf: Gebäude, gewählter Zeitraum, gewählte Ansicht, Datenstand und Erstellungszeit vollständig ausgeben.
- Kein zusätzlicher Persistenz- oder Cachehinweis im Ausdruck.
- Offline- oder stale-basierter Export ist erlaubt, muss im Druckkopf deutlich als offline und/oder möglicherweise veraltet markiert werden.
- Ein Zeitraum ohne Belegungseinträge ist exportierbar.
- Listenansicht: ausschließlich eine formatierte Belegungsliste drucken, keinen Kalender ergänzen.
- Planansicht: Monatskalender drucken und danach auf einer neuen Seite eine Detailliste ausgeben.
- Zeitraumwechsel: automatisch API abrufen.
- Ansichtswechsel: lokal rendern, kein API-Aufruf.
- Manueller Aktualisieren-Button: bleibt erhalten.
- Laden: alte Ansicht sichtbar lassen, aber mit `inert` und `aria-busy` sperren; Export ebenfalls sperren.
- Bedeutung „Nächster Monat“: unverändert vom heutigen Datum bis zum Ende des nächsten Monats, nicht nur der isolierte nächste Kalendermonat.
- Badgeänderung: nur der Eintragsbadge bestätigter Einträge entfällt. `blocked` bleibt sichtbar. Unbekannte Status bleiben sichtbar. Kalenderstatus, Legende und ARIA-Bezeichnung „belegt“ bleiben bestehen.

## 4. Nicht-Ziele

- Kein serverseitiger oder direkter PDF-Generator.
- Keine PDF-Bibliothek wie jsPDF, pdf-lib oder vergleichbare Abhängigkeit.
- Kein Download-Endpunkt und keine Speicherung erzeugter PDFs.
- Keine neue Backendfunktion, keine Änderung an Google Apps Script, Google Sheets, API-Schema oder Freigabelogik.
- Keine Änderung an Buchungs- oder Kontaktformularen.
- Keine Änderung an Manifest, Service-Worker-Quellcode, Buildskripten oder Deploymentkonfiguration.
- Keine neue Persistenzform und keine Verlängerung der Cache-TTL.
- Kein Druck privater Anfrage-, Kontakt-, Notiz- oder Formulardaten.
- Keine Änderung der Statuslogik des Kalenders oder der Legende.
- Keine Umdeutung von `next-month`.
- Kein manueller Eingriff in generierte Dateien unter `_site/`.

## 5. Ist-Architektur und aktueller Datenfluss

### 5.1 Statische Seite und Konfiguration

- `index.html` enthält den Belegungsbereich `#belegung`, das Filterformular `#occupancyFilter`, die Zeitraumwahl `#occupancyRange`, die Ansichtswahl `#occupancyView`, den manuellen Submit-Button, den Status `#occupancyMeta` und die sichtbare Ausgabe `#occupancyList`.
- `index.html` enthält außerdem `#bookingDetailsDialog` und private öffentliche Eingabeformulare für Buchungs- und Kontaktanfragen. Diese Formulare dürfen nie Teil des Print-DOM werden.
- `config/config.js` ist kein Quellfile, sondern wird je Scope aus `betreiber/allgemein/konfiguration/frontend.json`, dem jeweiligen Gebäude-Override und den Texten erzeugt.
- Sichtbare deutsche Texte kommen aus `betreiber/allgemein/texte/frontend.json`; die derzeit leeren Dateien `betreiber/DGH/texte/frontend.json` und `betreiber/EV_GEMEINDEHAUS/texte/frontend.json` sind optionale Overrides.
- `scripts/build-pages-site.py::build_scope()` kopiert `assets/css` und `assets/js` automatisch in jeden Scope, rendert `index.html`, erzeugt `config/config.js`, ermittelt alle ausgelieferten Dateien und baut daraus Precache-Liste und Inhalts-Hash des Service Workers.

### 5.2 Belegungszustand und Abruf

- `assets/js/app.js` hält den Laufzeitzustand in `currentOccupancyPayload`, `currentOccupancyRange` und `currentOccupancyStale`.
- `rangeFromSelection()` berechnet den gewünschten Zeitraum. Insbesondere liefert `next-month` heute bis zum Ende des nächsten Monats.
- `loadOccupancy()` berechnet den Range, erhöht `occupancyRequestGeneration`, bricht über `occupancyAbortController` den vorherigen Request ab und ruft `fetchOccupancy()` auf.
- `fetchOccupancy()` baut aktuell den öffentlichen GET-Request mit `action=occupancy`, `buildingId`, `from` und `to` direkt in `app.js` auf.
- Der öffentliche Occupancy-Response und die gecachten Payloads verwenden unverändert `schemaVersion: 2`; dies ist unabhängig vom Produkt-/Backendrelease beziehungsweise Apps-Script-/Sheet-Migrationsstand `1.3`.
- Erfolgreiche Daten werden in `loadOccupancy()` über `bookingItems()` um `requested`-Einträge bereinigt, mit `FrontendCore.sortOccupancyItems()` sortiert, in den drei Zustandsvariablen gespeichert und mit `writeOccupancyCache()` in `localStorage` abgelegt.
- Bei einem Fehler versucht `readOccupancyCache()` einen passenden frischen Datensatz zu laden und markiert ihn als stale. Ohne Cache zeigt `Ui.renderEmpty()` einen Fehler.
- Aktuell setzt der Submit-Handler des Filterformulars den Button-Ladezustand und ruft `loadOccupancy()` auf. Ein Zeitraumwechsel allein lädt noch nicht automatisch.
- Der `change`-Handler von `#occupancyView` ruft `renderOccupancy()` mit dem aktuellen Payload lokal auf und erzeugt keinen Request.
- Ein Klick auf einen Monatsnamen setzt den speziellen Range `selected-month`, wechselt zur Liste und ruft `loadOccupancy()` auf.

### 5.3 Renderer

- `assets/js/app.js::renderOccupancy()` wählt abhängig von `selectedView()` zwischen `Ui.renderOccupancyPlan()` und `Ui.renderOccupancy()`.
- `assets/js/ui.js::renderOccupancy()` rendert die Listenansicht in `#occupancyList` und schreibt derzeit zugleich `#occupancyMeta`.
- `assets/js/ui.js::renderOccupancyPlan()` rendert Monatskalender und Legende in `#occupancyList` und schreibt ebenfalls `#occupancyMeta`.
- `assets/js/ui.js::renderMonth()` erzeugt Kalenderzellen. `FrontendCore.dayStatus()` priorisiert ganztägig `blocked`, danach ganztägig `confirmed`, danach `partial`, sonst `free`.
- `assets/js/ui.js::renderBookingDetails()` erzeugt Datum, Zeit, Statusbadge sowie optional freigegebene Veranstaltung und Veranstalter. Die Detailtexte laufen durch `RestrictedMarkdown.render()` und dessen DOM-Whitelist.
- `createBookingDetailsElement()` nutzt `renderBookingDetails()` für die Liste. `openBookingDetailsDialog()` nutzt denselben Renderer für den Dialog. Dieser gemeinsame Renderer ist deshalb der exakte Ort der Badgeänderung und soll auch vom Print-Renderer wiederverwendet werden.

### 5.4 Cache

- `assets/js/frontend-core.js` definiert `OCCUPANCY_CACHE_TTL_MS` als exakt 24 Stunden.
- `occupancyCacheKey()` erzeugt `occupancy:v2:<buildingId>:<from>:<to>`.
- `createOccupancyCacheRecord()` speichert `cachedAt` plus Payload.
- `parseOccupancyCacheRecord()` klassifiziert Einträge als `fresh`, `expired` oder `invalid`.
- Der aktuelle Code entfernt abgelaufene oder ungültige Records nur beim Lesen des gerade benötigten Keys. Andere abgelaufene Keys desselben Gebäudes können physisch bestehen bleiben.
- Der Legacy-Key `occupancy:<buildingId>:<from>:<to>` wird derzeit exakt für den angefragten Zeitraum entfernt.

### 5.5 Build und PWA

- `scripts/build-pages-site.py` kopiert geänderte Quellassets automatisch in Root, `/DGH/` und `/Gemeindehaus/`.
- Für die beiden Gebäudescopes werden Dateipfade und Dateiinhalte automatisch in `cache_digest()` gehasht und in den generierten Service Worker eingesetzt.
- `tests/service-worker.test.js` und `scripts/verify-pages-site.py` prüfen Inhalts-Hash, Precache, Network-First für App-Shell-Assets sowie Scope-Isolation.
- Daraus folgt: Änderungen an `index.html`, `assets/js/*`, `assets/css/app.css` und den Frontendtexten werden ohne Build- oder Service-Worker-Quelländerung automatisch kopiert, gehasht und gecacht.

## 6. Soll-Architektur

### 6.1 Zustandsgrenzen

`app.js` bleibt Eigentümer aller Belegungsdaten und des asynchronen Ladeablaufs. `ui.js` bleibt Eigentümer der reinen DOM-Erzeugung. `frontend-core.js` erhält nur dann kleine pure Hilfsfunktionen, wenn Filter-, Sortier- oder Cachehygienelogik damit ohne Browser testbar wird; keine allgemeine Abstraktionsschicht einführen.

Der gültige exportierbare Zustand besteht ausschließlich aus:

- `currentOccupancyPayload`
- `currentOccupancyRange`
- `currentOccupancyStale`
- dem beim Vorbereiten gelesenen Onlinezustand `navigator.onLine`
- der beim Vorbereiten gelesenen Ansicht aus `#occupancyView`
- der beim Vorbereiten erzeugten Erstellungszeit
- dem Gebäudenamen aus der bereits vorhandenen `config`

### 6.2 Eingefrorener Print-Snapshot

Eine zentrale Funktion in `app.js`, beispielsweise `createOccupancyPrintSnapshot()`, muss:

1. abbrechen, wenn gerade geladen wird oder Payload/Range fehlen;
2. `currentOccupancyRange` kopieren und einfrieren;
3. ausschließlich öffentliche Einträge aus `currentOccupancyPayload.items` übernehmen;
4. jeden Eintrag auf die bereits vom öffentlichen Occupancy-Endpunkt gelieferten und für den Renderer benötigten Felder reduzieren, mindestens `date`, `from`, `to`, `allDay`, `status`, `statusKey`, `publicTitle`, `publicOrganizer`;
5. alle Einträge inklusiv nach `range.from <= item.date <= range.to` filtern;
6. das Ergebnis mit `FrontendCore.sortOccupancyItems()` stabil nach Datum, Start und Ende sortieren;
7. Einträge, Array, Range und das Snapshot-Objekt über `Object.freeze()` gegen nachträgliche Mutation schützen;
8. Ansicht, `loadedAt`, stale, `navigator.onLine`, Gebäude, Range und `createdAt` im Snapshot festhalten.

Der Snapshot darf keine Referenz auf Formularzustände, Dialoginhalt oder private Daten enthalten. Kein `innerHTML`, `textContent`, `querySelector` über die sichtbare Belegung oder sonstiges DOM-Scraping zur Datengewinnung.

### 6.3 Print-DOM

- `index.html` erhält direkt unter `<body>` einen dedizierten, semantischen Print-Container, zum Beispiel `#occupancyPrint`, außerhalb von `<main>`, Dialog, Header, Footer und Formularen.
- Der Container ist im Bildschirmmodus verborgen und wird ausschließlich für den Ausdruck befüllt/sichtbar gemacht.
- Der Print-Container enthält nur die aus dem Snapshot gebauten öffentlichen Daten.
- Ein zentraler UI-Einstieg, beispielsweise `Ui.renderOccupancyPrint(target, snapshot)`, leert und rendert den Container deterministisch.
- Der vollständige Kopf enthält Gebäudename, lokal formatierten Zeitraum, Ansicht „Belegungsplan“ oder „Liste“, Datenstand aus `loadedAt` sowie lokale Erstellungszeit aus `createdAt`.
- Bei `stale === true` steht deutlich „Möglicherweise veralteter Stand“ im Kopf.
- Bei `online === false` steht zusätzlich deutlich „Offline erstellt“ im Kopf. Beide Marker können gleichzeitig erscheinen.
- Es wird kein zusätzlicher Satz zur lokalen Speicherung oder Persistenz ausgegeben.
- Die Listenansicht rendert nur Kopf und formatierte Liste beziehungsweise die formatierte Leermeldung.
- Die Planansicht rendert Kopf, alle Monatskalender des Range, Legende und danach in einem Abschnitt mit erzwungenem Seitenumbruch die sortierte Detailliste beziehungsweise eine klare Leermeldung.
- Kalender im Ausdruck sind nicht interaktiv: keine Buttons, keine Dialogverweise, keine Buchungsaktionen. Bestehende fachliche Monats-/Tagesstatuslogik wird wiederverwendet, aber in druckgeeignete semantische Elemente umgesetzt.
- Detaileinträge verwenden `renderBookingDetails()`; dadurch gelten Markdown-Whitelist und Badgeentscheidung identisch in Liste, Dialog und Ausdruck.

### 6.4 Print-Ablauf

- Button-Klick: Snapshot synchron erzeugen, Print-DOM synchron rendern, danach direkt `window.print()` aufrufen.
- Kein `await`, kein Timeout und kein API-Aufruf zwischen Benutzeraktion und `window.print()`.
- `beforeprint`: dieselbe synchrone Vorbereitung ausführen, damit Strg+P/Cmd+P den aktuellen gültigen Zustand druckt.
- `beforeprint` darf niemals Daten nachladen. Falls kein exportierbarer Payload vorhanden ist oder gerade `loadOccupancy()` läuft, muss es einen vorhandenen alten Print-Snapshot und den Print-DOM synchron leeren und darf insbesondere keinen zuvor vorbereiteten Range drucken. Der normale UI-Zustand wird dabei nicht verfälscht.
- `afterprint` kann temporären Snapshotzustand verwerfen und den Container leeren oder für den nächsten synchronen Neuaufbau bereithalten. Er darf die sichtbare Belegung nicht verändern.
- Bereits beim Start jedes neuen `loadOccupancy()`-Ladevorgangs und damit vor dem Request werden ein eventuell vorbereiteter Print-Snapshot und der Print-DOM synchron invalidiert beziehungsweise geleert. Erfolgreicher Abruf und Fehler ohne Cache halten diesen Zustand konsistent, damit nie versehentlich ein alter Range gedruckt wird.

### 6.5 Renderer-Wiederverwendung

- `renderBookingDetails(target, item)` bleibt die einzige Quelle für Datum, Zeit, Eintragsstatus und öffentliche Markdown-Details.
- Listen-, Dialog- und Print-Detaileinträge rufen diesen Renderer auf.
- Kalenderstatusberechnung bleibt in `FrontendCore.dayStatus()`.
- Monatsiteration und Rangebehandlung dürfen minimal als wiederverwendbare pure Hilfen extrahiert werden, wenn Bildschirm- und Printkalender sonst unterschiedliche Fachlogik duplizieren würden.
- Interaktive Bildschirm-Markupdetails und nicht interaktive Print-Markupdetails bleiben getrennt, damit keine versteckten Buttons, Dialogreferenzen oder Buchungsaktionen im Ausdruck landen.
- `renderOccupancy()` und `renderOccupancyPlan()` schreiben künftig nur ihre jeweilige Zielansicht. Sie dürfen `#occupancyMeta` nicht mehr überschreiben.

## 7. Refresh-State und Race-Condition-Design

### 7.1 Zentrale Loadingsteuerung

In `app.js` eine zentrale Funktion für den Belegungs-Ladezustand einführen, beispielsweise `setOccupancyLoading(isLoading, generation)`. Sie steuert gemeinsam:

- den manuellen Aktualisieren-Button inklusive Spinner und Originaltext;
- `aria-busy="true"` am Belegungs-Ausgabebereich während des Requests und Entfernung beziehungsweise `false` danach;
- `inert` am alten sichtbaren Inhalt `#occupancyList` während des Requests;
- Deaktivierung des Printbuttons während des Requests;
- Schutz gegen Doppel-Submit des manuellen Buttons;
- eine zentrale interne Boolean-/Generationsinformation für Printfreigabe und Ereignishandler.

Die alte Ansicht bleibt optisch unverändert sichtbar. Nicht durch ein leeres Loading-Template ersetzen. Die Sperre muss sowohl Maus-/Touch- als auch Tastaturinteraktion verhindern. Der Status `#occupancyMeta` meldet zentral „Belegung wird aktualisiert …“.

### 7.2 Generation und AbortController

Die bestehenden Mechanismen `occupancyRequestGeneration` und `occupancyAbortController` werden auf **alle** Auslöser angewendet:

- Initialabruf
- automatischer Rangewechsel
- Klick auf einen Monatsnamen
- manueller Aktualisieren-Submit
- Aktualisierung nach erfolgreicher Buchungsanfrage

Ablauf je Request:

1. gewünschten Range unmittelbar erfassen;
2. bei **jedem** Eintritt in `loadOccupancy()` die Cachehygiene für das aktive Gebäude ausführen, unabhängig davon, ob der folgende Onlineabruf erfolgreich ist;
3. alten Print-Snapshot und Print-DOM synchron invalidieren;
4. Generation erhöhen;
5. vorherigen Controller abbrechen;
6. neuen Controller setzen;
7. zentralen Loadingzustand für diese Generation aktivieren;
8. mit `cache: "no-store"` und `signal` abrufen;
9. Ergebnis nur übernehmen, wenn Generation aktuell und Signal nicht abgebrochen ist;
10. Fehler/Cache nur für die aktuelle Generation verarbeiten;
11. im `finally` Loadingzustand **nur** dann beenden, wenn die Generation weiterhin aktuell ist.

Ein verspätetes Ergebnis A darf nach einem neueren Request B weder Payload, Range, stale, Meta, sichtbare Ansicht, Dialogzustand, Printzustand noch Loadingzustand überschreiben.

### 7.3 Ereignisverhalten

- `#occupancyRange change`: automatisch `loadOccupancy()` starten. Der manuelle Submit ist nicht erforderlich.
- `#occupancyView change`: ausschließlich aktuellen Payload für den aktuellen Range lokal rendern. Requestzählung bleibt unverändert.
- `#occupancyFilter submit`: Default verhindern und zentral `loadOccupancy()` auslösen. Ist derselbe Submit bereits aktiv, keinen zweiten Request starten.
- Monatsklick: Range-Felder und `selected-month` setzen, Listenansicht wählen und genau einen Abruf starten. Das programmgesteuerte Setzen darf keinen zusätzlichen doppelten Change-Request erzeugen.
- Erfolgreiche Buchungsanfrage: vorhandenen zentralen Refreshweg verwenden; keine parallele Sonderlogik.

### 7.4 Meta-Eigentum

Nur `app.js` setzt `#occupancyMeta` für die Belegung:

- initial „Noch nicht geladen.“ aus dem Template;
- während Laden „Belegung wird aktualisiert …“;
- bei Erfolg „Stand: <Zeit>“;
- bei Cachefallback „Möglicherweise veralteter Stand: <Zeit> · <Fehlerhinweis>“;
- bei Fehler ohne Cache „Die Belegung konnte nicht geladen werden. <Fehler>“.

`Ui.renderOccupancy()` und `Ui.renderOccupancyPlan()` dürfen das Meta nicht setzen. Damit kann ein lokaler View-Rerender weder Lade- noch Fehlerstatus überschreiben.

### 7.5 Fehler- und Stale-Verhalten

- Nur ein frischer, exakt zu Gebäude und angefragtem Range passender Cache darf als Fallback verwendet werden.
- Fallback-Payload wird erneut um `requested` bereinigt, auf Range gefiltert und sortiert; `currentOccupancyStale = true`.
- Ein API-Fehler mit frischem passendem Cache zeigt dessen Daten und markiert UI sowie Print-Snapshot deutlich stale.
- Ein Fehler ohne passenden Cache setzt `currentOccupancyPayload = null`, `currentOccupancyRange = null` und `currentOccupancyStale = false`.
- Bei Fehler ohne Cache werden sichtbarer Dialog, `dialogTrigger`, vorbereiteter Snapshot und Print-DOM geschlossen beziehungsweise geleert. Dies gilt auch, wenn vor dem fehlgeschlagenen Request B bereits Print A vorbereitet war; kein Inhalt von A darf erhalten oder exportierbar bleiben.
- Die zuvor alte, während Laden sichtbare und inerte Ansicht wird nach finalem Fehler ohne Cache durch die Fehlermeldung ersetzt; anschließend wird der zentrale Loadingzustand korrekt beendet.
- Ein Abort durch einen neueren Request ist kein sichtbarer Fehler.

## 8. Badgeänderung

Die Änderung erfolgt **exakt** in `assets/js/ui.js::renderBookingDetails()`:

- Den Statusknoten nur erzeugen und an den Header anhängen, wenn `item.statusKey !== "confirmed"`.
- Nicht anhand des lokalisierten Textes `item.status`, `statusText()` oder des Wortes „belegt“ filtern.
- Kein globales CSS-Verstecken von `.status-confirmed`, `.status-label` oder Textinhalten.
- `blocked` behält seinen roten sichtbaren Badge.
- Unbekannte, leere oder neue Statuskeys behalten einen sichtbaren Fallbackbadge.
- Weil Liste, Dialog und Printdetails denselben Renderer verwenden, gilt die Änderung automatisch in allen drei Kontexten.
- `statusText("confirmed")`, `FrontendCore.dayStatus()`, Kalenderklassen `.is-busy`, Legende, Titel und ARIA-Labels bleiben unverändert und nennen weiterhin „belegt“.

## 9. Cachehygiene

### 9.1 Gültiger Namensraum

Für den aktiven Scope darf nur das Präfix `occupancy:v2:<buildingId>:` inspiziert werden. Beispiele:

- DGH: `occupancy:v2:dgh_rb:`
- Gemeindehaus: `occupancy:v2:ev_gem_rb:`

### 9.2 Bereinigungsregeln

- Über `localStorage.length` und `localStorage.key(index)` defensiv eine Keyliste aufnehmen; Storagezugriffe können werfen.
- Nur Keys entfernen, die exakt mit dem Präfix des aktuell konfigurierten Gebäudes beginnen.
- Jeden passenden Record mit `FrontendCore.parseOccupancyCacheRecord()` prüfen.
- Nur `expired` oder `invalid` physisch entfernen.
- Frische Records anderer Ranges desselben Gebäudes behalten.
- Keys des anderen Gebäudes, fremde Anwendungen und ähnlich benannte Keys nicht lesen, ändern oder entfernen.
- Legacybereinigung bleibt exakt und gezielt: nur `occupancy:<buildingId>:<from>:<to>` für konkret verwendete Ranges entfernen. Kein pauschales `occupancy:`-Löschen.
- Die Bereinigung ist verbindlich bei **jedem Start von `loadOccupancy()`** vor dem Netzwerkabruf auszuführen. Sie läuft damit auch bei dauerhaft erfolgreichen Onlineabrufen und darf nicht nur an Cachelesen oder Fehlerfallback gekoppelt sein.
- Die TTL bleibt exakt `24 * 60 * 60 * 1000`; bei `age >= TTL`, Zukunftszeit, ungültigem JSON oder ungültigem Payload wird der Record physisch entfernt.
- Schreibfehler, Quota-Fehler und blockierter Storage dürfen die UI nicht zum Absturz bringen.

### 9.3 Tests der Isolation

Tests müssen gleichzeitig Records für `dgh_rb`, `ev_gem_rb`, fremde Keys, gültige, ungültige und abgelaufene Records anlegen. Nach Hygiene dürfen nur ungültige/abgelaufene Records des aktiven Präfixes und der exakt adressierte Legacy-Key fehlen. Mindestens ein Browserfall muss einen erfolgreichen Onlineabruf beantworten und trotzdem nachweisen, dass alte `invalid`-/`expired`-Keys des aktiven Gebäudes bereits beim Start von `loadOccupancy()` physisch entfernt wurden.

## 10. Print-CSS und Druckgestaltung

In `assets/css/app.css` einen klar begrenzten `@media print`-Block ergänzen:

- Ausschließlich `#occupancyPrint` drucken; Header, Hauptseite, Dialog, Footer, Formulare und alle sonstigen direkten Body-Inhalte ausblenden.
- `#occupancyPrint` im Printmodus sichtbar machen und als normales Dokumentlayout positionieren.
- Desktop-Sonderregeln aus dem bestehenden Media Query neutralisieren: `html`, `body` und `main` erhalten für Druck `height: auto`, `min-height: 0` und `overflow: visible`; Flex-/Viewportbegrenzungen dürfen keine Seiten abschneiden.
- `@page { size: A4 portrait; margin: ...; }` mit einem praxistauglichen Rand, zum Beispiel 12 bis 15 mm.
- Drucktypografie in pt beziehungsweise druckgeeigneten Größen definieren; Kopf kompakt, aber vollständig und lesbar.
- Jahresansichten in sinnvolle Kalenderbreiten zerlegen. Pro A4-Seite höchstens so viele Monatsraster anordnen, dass Tageszahlen und Statusmuster lesbar bleiben; bevorzugt zwei Monate nebeneinander nur, wenn die Zellen nicht kollabieren, sonst ein Monat pro Zeile.
- Monatskarten, einzelne Detaileinträge und zusammengehörige Überschriften mit `break-inside: avoid` beziehungsweise `page-break-inside: avoid` schützen.
- Die Detailliste der Planansicht erhält `break-before: page` beziehungsweise kompatibel `page-break-before: always`.
- Lange Links und Texte mit `overflow-wrap: anywhere` druckbar halten.
- Umlaute, ß und eingeschränktes Markdown müssen sichtbar korrekt bleiben.
- HTTPS- und `mailto:`-Links bleiben als sicher gerenderte Links erhalten. Keine automatische Ausgabe kompletter URL-Ziele erzwingen, wenn sie Layout oder Datenschutz verschlechtert.
- Status darf nicht ausschließlich durch Hintergrundfarbe vermittelt werden. Für Schwarz-Weiß-Druck Rahmen, Muster und/oder eindeutige Symbole/Abkürzungen verwenden.
- `frei`, `belegt`, `teilweise belegt` und `gesperrt` im Kalender sowohl visuell als auch textlich über die Legende unterscheidbar machen.
- Druck mit deaktivierten Hintergrundgrafiken muss weiterhin verständlich sein.
- Keine privaten Formularfelder, Consenttexte, Kontaktnachrichten oder Buchungsanfragedaten im Print-DOM oder Druck-CSS sichtbar machen.

Im normalen Bildschirmmodus bleibt `#occupancyPrint` vollständig verborgen. Der neue Aktionsbutton folgt den bestehenden eckigen `.button`-/Designsystemregeln und bleibt bei 390 px Breite ohne horizontalen Overflow bedienbar.

## 11. Datei-für-Datei-Anweisungen

### 11.1 `index.html`

- Im Belegungsfilter neben dem manuellen Aktualisieren-Button einen `type="button"` für **„PDF erstellen / drucken“** ergänzen.
- Für beide Buttons stabile IDs oder eindeutige Data-Attribute vorsehen, damit Loading- und Testlogik nicht von sichtbarem Text abhängen.
- Den Print-Container direkt unter `<body>` als Geschwister von Header/Main/Dialog/Footer anlegen, semantisch kennzeichnen und im Screenmodus verbergen.
- Keine Belegungsdaten statisch duplizieren.
- Keine Formulare oder Dialoge in den Print-Container verschieben.

### 11.2 `assets/js/app.js`

- Zentralen Occupancy-Loadingzustand einführen.
- Bestehende Generation plus `AbortController` für alle Refreshauslöser konsistent verwenden.
- `fetchOccupancy()` um `cache: "no-store"` ergänzen.
- Rangewechsel automatisch binden; Viewwechsel lokal belassen; manuellen Submit gegen Doppel-Submit schützen.
- Metaausgabe aus Renderern herausziehen und zentral verwalten.
- Fehler ohne Cache vollständig aus Zustand, Dialog und Printzustand entfernen.
- Cachehygiene ausschließlich für das aktive `occupancy:v2:<buildingId>:`-Präfix ergänzen, verbindlich bei jedem Start von `loadOccupancy()` ausführen und Legacy nur exakt entfernen.
- Snapshot aus `currentOccupancyPayload`, `currentOccupancyRange`, `currentOccupancyStale` und `navigator.onLine` bauen, auf Range filtern, sortieren und einfrieren.
- Printbutton, `beforeprint` und optional `afterprint` anbinden.
- Synchrone Vorbereitung garantieren; kein Print-API-Aufruf und kein DOM-Scraping.
- Nach Rangewechsel, neuer Generation oder Fehler vorbereiteten Printzustand invalidieren.

### 11.3 `assets/js/ui.js`

- `renderBookingDetails()` so ändern, dass exakt `statusKey === "confirmed"` keinen Badge erzeugt.
- Bestehenden Detailrenderer für Printdetails wiederverwenden.
- `renderOccupancy()` und `renderOccupancyPlan()` vom Meta entkoppeln.
- Zielgerichtete Printrenderer für Kopf, Liste, leeren Zustand, nicht interaktiven Monatskalender, Legende und Plan-Detailliste ergänzen.
- Bestehende Datumsformatierer, `RestrictedMarkdown.render()` und Statuslogik wiederverwenden.
- Keine privaten Datenfelder akzeptieren oder rendern.
- Falls Fehlerbereinigung dies benötigt, eine kleine öffentliche UI-Funktion zum sicheren Schließen/Leeren des Buchungsdialogs ergänzen, statt Dialoginternas aus `app.js` zu manipulieren.

### 11.4 `assets/js/frontend-core.js` optional und minimal

- Nur pure, browserunabhängig testbare Helfer ergänzen, wenn dadurch Rangefilterung oder gezielte Cachehygiene eindeutig und testbar wird.
- Bestehende API nicht unnötig umbauen.
- `OCCUPANCY_CACHE_TTL_MS`, `parseOccupancyCacheRecord()`, `sortOccupancyItems()` und `dayStatus()` semantisch stabil halten.
- Keine DOM-, `window`-, `navigator`- oder Printabhängigkeit einführen.

### 11.5 `assets/css/app.css`

- Bildschirmstil für Printcontainer und neuen Button ergänzen.
- Loadingzustand visuell verständlich machen, ohne alte Belegung auszublenden.
- `@page` und vollständigen `@media print`-Block gemäß Abschnitt 10 ergänzen.
- A4-Hochformat, Desktop-Overflowreset, Seitenumbrüche, Jahresansicht, Schwarz-Weiß-Unterscheidung und lange Markdownlinks absichern.
- Keine globale Regel ergänzen, die bestätigte Statusbadges anhand CSS versteckt.

### 11.6 Frontendtexte

- In `betreiber/allgemein/texte/frontend.json` alle neuen sichtbaren Texte als deutsche Keys ergänzen, mindestens Buttontext, Printüberschrift, Kopfbezeichnungen, Ansichtsnamen im Ausdruck sowie Offline-/stale-Markierungen.
- Bestehende Schlüssel wie `statusBusy`, `statusBlocked`, `statusStale`, `occupancyEmpty`, `viewPlan` und `viewTable` wiederverwenden, soweit Wortlaut und Kontext passen.
- Kein zusätzlicher Persistenzhinweis für den Ausdruck.
- `betreiber/DGH/texte/frontend.json` und `betreiber/EV_GEMEINDEHAUS/texte/frontend.json` leer lassen, solange kein tatsächlich gebäudespezifischer Wortlaut nötig ist.
- Deutsche Rechtschreibung mit echten Umlauten und ß verwenden, nicht `ae`, `oe`, `ue` oder `ss` als Ersatz.

### 11.7 `tests/frontend-core.test.js`

- Pure Rangefilter-/Sortierlogik testen, falls nach `frontend-core.js` extrahiert.
- TTL-Grenzen `TTL - 1` und exakt `TTL` beibehalten.
- Invalid-, Zukunftszeit- und Payloadformate abdecken.
- Cachepräfix-Isolation und gezielte Entfernung testbar machen, falls die Hygiene pure Core-Helfer erhält.
- `dayStatus()` unverändert für confirmed/blocked/partial/free absichern.

### 11.8 `tests/browser.test.py`

- Bestehende Playwright-Mocks um Requestzählung, kontrolliert verzögerte A/B-Antworten, leere Antworten und Online-/Offlinefälle erweitern.
- Vor Ausführung der App `window.fetch` per `context.add_init_script()` instrumentieren: Für jeden Request mit `action=occupancy` URL und übergebenes Optionsobjekt beziehungsweise mindestens `options.cache` protokollieren. Nach Initialabruf, Rangewechsel, manuellem Refresh und Race-Requests muss für **jeden** protokollierten Occupancy-Fetch `options.cache === "no-store"` gelten; ein fehlendes Optionsobjekt oder fehlender `cache`-Wert ist ein Testfehler.
- Badgeverhalten in Liste, Dialog und Print prüfen.
- Printbutton testen, indem `window.print` vor dem Klick instrumentiert wird; sicherstellen, dass Print-DOM synchron vor dem Aufruf fertig ist.
- `beforeprint` direkt dispatchen und denselben Printinhalt prüfen. Zusätzlich Print A vorbereiten, Rangewechsel B starten und `beforeprint` während B noch lädt auslösen: Weder A noch B darf gedruckt werden, und der alte Print-DOM muss leer sein. B anschließend ohne Cache fehlschlagen lassen und erneut prüfen, dass kein Inhalt von A zurückkehrt.
- Printmedienmodus aktivieren und prüfen, dass ausschließlich Print-DOM sichtbar ist.
- Listen- und Planprint, Kopf, Seitenumbruchklasse/-CSS, leere Zeiträume, stale/offline, Links, Markdown, Umlaute und beide Gebäudescopes prüfen.
- Keine echten externen Requests zulassen; Apps Script vollständig mocken.
- Bestehenden 390-px-Test beibehalten und um neuen Button/Overflow ergänzen.

### 11.9 `DESIGN.md`

- Druckansicht als Bestandteil des Designsystems dokumentieren: A4 Hochformat, vollständiger Kopf, Listen-/Planstruktur, Schwarz-Weiß-Muster, Seitenumbrüche und Datenschutzgrenze.
- Buchungsdetailregel aktualisieren: bestätigte Einträge zeigen keinen redundanten Badge; gesperrte und unbekannte Status zeigen ihn weiterhin.
- Klarstellen, dass Kalender, Legende und ARIA „belegt“ weiterhin verwenden.

### 11.10 `README.md`

- Nach erfolgreicher Implementierung und grünen relevanten Featuretests Version `1.3.1` auf `1.4.0` erhöhen; anschließend die vollständige Qualitätsmatrix inklusive dieser Dokumentationsänderung erneut ausführen.
- Belegungsdruck über Browser-Druckdialog, automatische Rangeaktualisierung und Offline-/stale-Kennzeichnung knapp dokumentieren.
- Produkt-/Backendrelease und Apps-Script-/Sheet-Migration `1.3` nicht ändern; das öffentliche Occupancy-Response-Schema bleibt `schemaVersion: 2`.
- Qualitätsmatrix nur anpassen, wenn ein tatsächlich neuer Testbefehl entsteht; ansonsten unverändert lassen.

### 11.11 `PROJEKTUEBERSICHT.md`

- Nach erfolgreicher Implementierung und grünen relevanten Featuretests Version `1.3.1` auf `1.4.0` erhöhen; anschließend die vollständige Qualitätsmatrix inklusive dieser Dokumentationsänderung erneut ausführen.
- Runtimeabschnitt um lokalen Viewwechsel, automatischen Rangeabruf und snapshotbasierten Browserdruck ergänzen.
- Datenschutzabschnitt um die Aussage ergänzen, dass der Ausdruck ausschließlich bereits öffentliche Occupancy-Daten enthält.
- Projektübersicht weiterhin knapp und architekturorientiert halten.

### 11.12 Generierte Dateien und historischer Plan

- `_site/` wird **nie manuell geändert**. Es darf für Tests ausschließlich durch `python scripts/build-pages-site.py` neu erzeugt werden.
- `plan.md` war der historische Plan und wird durch diesen neuen Plan vollständig ersetzt. Bei der späteren Produktimplementierung dient sie nur als Auftrag; sie darf nicht so umgeschrieben werden, als sei das Feature bereits umgesetzt, bevor alle Akzeptanzkriterien erfüllt sind.

## 12. Nicht erforderliche Dateien und Begründung

Folgende Bereiche benötigen für dieses Feature keine Änderung:

- Backend und `apps-script/**`: Druck und Refresh verwenden den vorhandenen öffentlichen Occupancy-Endpunkt; dessen Response-Schema bleibt `schemaVersion: 2`.
- Google-Sheets-Struktur sowie Produkt-/Backendrelease und Apps-Script-/Sheet-Migrationsstand `1.3`: keine neuen Datenfelder, Status oder Operationen.
- `betreiber/**/backend/**`: keine Backendtexte oder Backendkonfiguration nötig.
- `manifest.webmanifest` beziehungsweise Manifestquellen: keine Installations-, Start-URL-, Icon- oder Displayänderung.
- `service-worker.js`: statische Assets werden bereits automatisch aus der erzeugten Scope-Dateiliste gecacht; API-Requests liegen außerhalb des Scopes und werden nicht vom Worker abgefangen.
- `scripts/build-pages-site.py`: `index.html`, CSS, JS und Textkonfiguration werden bereits kopiert/gerendert. Der Inhalts-Hash ändert sich automatisch mit den Dateien.
- sonstige Buildskripte: keine neue Assetart und keine externe Abhängigkeit.

Falls die Umsetzung glaubt, eine dieser Dateien ändern zu müssen, zuerst den Plan erneut prüfen und die kleinste Frontendlösung wählen. Es gibt für die vereinbarten Anforderungen keinen technischen Zwang zu Backend-, Manifest-, Service-Worker- oder Buildänderungen.

## 13. Schrittweise Implementierungsreihenfolge

Jeder Schritt ist klein, einzeln überprüfbar und erst nach erfolgreicher Prüfung abzuhaken.

- [ ] 1. Vor Beginn `git status --short` prüfen; vorhandene fremde Änderungen notieren und unangetastet lassen.
- [ ] 2. `DESIGN.md`, aktuelle Belegungsfunktionen und bestehende Tests erneut lesen; keine Annahmen aus früheren Sessions verwenden.
- [ ] 3. In `frontend-core.js` nur benötigte pure Range-/Cachehelfer ergänzen oder bewusst bei bestehenden Helfern bleiben.
- [ ] 4. `tests/frontend-core.test.js` für jeden neuen Core-Helfer zuerst/parallel ergänzen und mit `node tests/frontend-core.test.js` grün machen.
- [ ] 5. Deutsche Printtexte in `betreiber/allgemein/texte/frontend.json` ergänzen; Gebäude-Overrides nur bei echtem Unterschied anfassen.
- [ ] 6. In `index.html` Printbutton und leeren Printcontainer direkt unter `body` ergänzen.
- [ ] 7. In `ui.js` Meta-Schreiben aus Viewrenderern entfernen und Meta-Eigentum nach `app.js` verlagern.
- [ ] 8. In `ui.js::renderBookingDetails()` ausschließlich den confirmed-Badge anhand `statusKey === "confirmed"` unterdrücken.
- [ ] 9. Bestehende Browser-Badgeprüfungen für Liste und Dialog aktualisieren; blocked und unbekannt ausdrücklich absichern.
- [ ] 10. Zentrale Loadingsteuerung in `app.js` einführen und manuellen Submit darauf umstellen.
- [ ] 11. Range-Change-Autoload und lokalen View-Change implementieren; Requestzählung per Browsermock prüfen.
- [ ] 12. Generation/Abort/finally für alle Trigger härten; A/B-Race automatisiert prüfen.
- [ ] 13. `fetchOccupancy()` auf `cache: "no-store"` setzen.
- [ ] 14. Cachehygiene für das aktive v2-Gebäudepräfix bei jedem Start von `loadOccupancy()` ausführen; Legacy nur exakt entfernen; Isolation und Bereinigung trotz erfolgreichem Onlineabruf automatisiert prüfen.
- [ ] 15. Fehlerpfade zentralisieren: frischer Cache wird stale, fehlender Cache räumt Payload/Range/stale/Dialog/Printzustand vollständig.
- [ ] 16. Snapshotfunktion implementieren und mit Rangefilter, stabiler Sortierung, Freeze, Onlinezustand und nur öffentlichen Feldern absichern.
- [ ] 17. Nicht interaktive Printrenderer in `ui.js` implementieren; `renderBookingDetails()` für Detaileinträge wiederverwenden.
- [ ] 18. Button-Klick, `beforeprint` und `afterprint` anbinden; synchronen Ablauf, null API-Requests beim Drucken sowie Print-A -> laufender Rangewechsel B -> `beforeprint` ohne alten Printinhalt testen.
- [ ] 19. Screen- und Print-CSS einschließlich A4 Hochformat, Overflowreset, Seitenumbrüchen und Schwarz-Weiß-Mustern ergänzen.
- [ ] 20. Automatisierte Printtests für Liste, Plan, leer, stale/offline, Markdown/Links/Umlaute, Jahresansicht und Datenschutz ergänzen.
- [ ] 21. DGH und Gemeindehaus automatisiert sowie bei 390 px testen.
- [ ] 22. `DESIGN.md` mit den tatsächlich implementierten Regeln aktualisieren.
- [ ] 23. Implementierung mit den relevanten Featuretests einschließlich Frontend-Core-, Browser-, Print-, Cache- und Race-Tests grün prüfen; Versionsangaben dabei noch nicht ändern.
- [ ] 24. `README.md` und `PROJEKTUEBERSICHT.md` fachlich aktualisieren und dort `1.3.1` auf `1.4.0` erhöhen; Produkt-/Backendrelease und Apps-Script-/Sheet-Migration `1.3` sowie `schemaVersion: 2` unverändert lassen.
- [ ] 25. `_site/` ausschließlich per Build neu erzeugen und danach die vollständige Qualitätsmatrix als finalen Verifikationslauf inklusive der Dokumentations-/Versionsänderungen erneut ausführen.
- [ ] 26. Lokal unter Windows verfügbare manuelle Browser-/PWA-Fälle durchführen. Safari Desktop, iOS Safari und installierte iOS-PWA als externen manuellen Abnahmeschritt auf Apple-Hardware einplanen; Ergebnis kurz im Arbeitsbericht oder PR dokumentieren, ohne dafür zwingend eine neue Repositorydatei anzulegen.
- [ ] 27. Abschließenden Diff prüfen: keine privaten Daten, keine unnötige Bibliothek, keine unerwarteten Dateien, keine manuell editierten `_site`-Artefakte.

## 14. Akzeptanzkriterien

Das Feature ist nur akzeptiert, wenn alle folgenden Punkte erfüllt sind:

### 14.1 Bedienung und Requests

- Zeitraumwechsel startet ohne Submit genau einen Occupancy-Request für den neuen Range.
- Ansichtswechsel Plan/Liste startet keinen Occupancy-Request.
- Manueller Aktualisieren-Button bleibt vorhanden und startet genau einen Request.
- Doppelklick/zweiter Submit während eines laufenden manuellen Requests startet keinen Doppelrequest.
- `next-month` reicht weiterhin von heute bis zum Ende des nächsten Monats.
- Während Laden bleibt alter Inhalt sichtbar, trägt `inert` und `aria-busy`, ist nicht fokussier-/klickbar und der Exportbutton ist deaktiviert.
- Nach Abschluss wird nur die aktuelle Generation entsperrt.

### 14.2 Race Conditions und Fehler

- Bei A gefolgt von B wird A abgebrochen; selbst bei verspäteter A-Antwort bleibt B alleiniger Eigentümer von Payload, Range, Meta, Ansicht und Print.
- Ein veraltetes `finally` von A entsperrt B nicht und aktiviert den Export nicht vorzeitig.
- Jeder Occupancy-Fetch übergibt nachweislich ein Optionsobjekt mit `cache: "no-store"`; dies gilt für Initialabruf, Rangewechsel, manuellen Refresh und Race-Requests.
- Frischer exakt passender Cache wird bei Netzfehler angezeigt und als stale markiert.
- Abgelaufener, ungültiger, fremder oder rangefremder Cache wird nicht angezeigt.
- Fehler ohne Cache entfernt alten exportierbaren Zustand, schließt/ leert Dialog und Print-DOM und zeigt eine klare Fehlermeldung.
- Wurde Print A vorbereitet und startet danach Rangewechsel B, ist Print A sofort invalidiert. `beforeprint` während B lädt lässt den Print-DOM leer und druckt A nicht; schlägt B ohne Cache fehl, bleibt der Print-DOM leer und A kehrt nicht zurück.

### 14.3 Badge

- Confirmed-Einträge zeigen in Liste, Dialog und Printdetails keinen „belegt“-Badge.
- Blocked-Einträge zeigen weiterhin „gesperrt“ mit sichtbarer Statuskennzeichnung.
- Ein unbekannter Status zeigt weiterhin seinen gelieferten oder Fallbackstatus.
- Kalender, Legende, Tooltips und ARIA-Texte zeigen confirmed weiterhin als „belegt“.
- Die Umsetzung prüft `statusKey === "confirmed"`, nicht Textinhalt oder CSS.

### 14.4 Druck

- Der Button lautet exakt „PDF erstellen / drucken“.
- Klick öffnet den Browser-Druckdialog über `window.print()`.
- Strg+P/Cmd+P erzeugt über `beforeprint` dieselbe aktuelle Druckansicht.
- Zwischen Druckauslösung und Dialog findet kein API-Aufruf statt.
- Print-DOM basiert auf einem gefrorenen Daten-Snapshot und nicht auf sichtbarem DOM.
- Kopf enthält Gebäude, Zeitraum, Ansicht, Datenstand und Erstellungszeit.
- Offline und stale werden jeweils deutlich und kombinierbar markiert.
- Kein zusätzlicher Persistenzhinweis erscheint.
- Listenansicht druckt nur die formatierte Liste.
- Planansicht druckt Monatskalender plus Detailliste nach Seitenumbruch.
- Leere Zeiträume sind in beiden Ansichten sinnvoll exportierbar.
- Nur Print-DOM ist im Druck sichtbar.
- A4-Hochformat, lesbare Kalenderzellen, funktionierende Seitenumbrüche und keine abgeschnittenen Inhalte sind nachweisbar.
- Status bleibt bei Schwarz-Weiß-Druck und deaktivierten Hintergrundgrafiken unterscheidbar.

### 14.5 Datenschutz und Inhalte

- Print-Snapshot und Print-DOM enthalten nur Datum, Zeit, öffentlichen Status, `publicTitle` und `publicOrganizer` sowie nicht personenbezogene Kopfdaten.
- Keine Werte aus Buchungs-/Kontaktformularen, internen Notizen, Anfragehistorie oder nicht freigegebenen Feldern erscheinen.
- Eingeschränktes Markdown verwendet weiterhin ausschließlich die bestehende DOM-Whitelist.
- HTTPS-Links behalten `target="_blank"`, `rel="noopener noreferrer"` und Screenreaderhinweis; `mailto:` bleibt ohne unnötigen neuen Tab.
- Raw HTML, Bilder, Scripts, Eventattribute sowie unsichere URL-Schemata bleiben ausgeschlossen.
- Umlaute und ß werden korrekt dargestellt und gedruckt.

### 14.6 Cache

- Freshnessgrenze bleibt exakt 24 Stunden.
- Bei Erreichen der TTL wird der Record nicht nur ignoriert, sondern physisch entfernt.
- Ungültige Records des aktiven Gebäudepräfixes werden entfernt.
- Auch ein erfolgreicher Onlineabruf entfernt beim Start von `loadOccupancy()` zuvor vorhandene `invalid`-/`expired`-Records des aktiven Gebäudepräfixes physisch.
- Frische Records anderer Ranges des aktiven Gebäudes bleiben erhalten.
- Keys des anderen Gebäudes und fremde Keys bleiben bytegenau unverändert.
- Legacy wird nur für exakt adressierte Gebäude-/Range-Keys entfernt.

### 14.7 Accessibility und Responsive

- Printbutton ist ein echter fokussierbarer Button mit verständlichem Namen und sichtbarem Fokus.
- Disabled-/Loadingzustand ist semantisch und visuell erkennbar.
- `aria-busy` liegt am relevanten Belegungsbereich; `inert` verhindert Interaktion mit altem Inhalt.
- Fokus bleibt nach lokalem View-Rerender und Dialogschließen gemäß bestehender Fokuslogik sinnvoll.
- Ein Fehler/Rerender mit entferntem Dialogtrigger fokussiert weiterhin Ansicht oder Überschrift als Fallback.
- Bei 390 px entsteht durch Filter, neuen Button, Kalender oder Details kein horizontaler Overflow.
- Jahresansicht bleibt am Bildschirm und im Druck lesbar.

### 14.8 Dokumentation und Version

- `DESIGN.md` beschreibt Badge- und Printregeln.
- `README.md` und `PROJEKTUEBERSICHT.md` nennen Version `1.4.0` und das neue Verhalten.
- Produkt-/Backendrelease und Apps-Script-/Sheet-Migration bleiben `1.3`; das öffentliche Occupancy-Response-Schema bleibt `schemaVersion: 2`.
- Keine Produktivdatei unter `_site/` wurde manuell bearbeitet.

## 15. Umfangreiche Testmatrix

### 15.1 Automatisierte Browserfälle

| Bereich | Fall | Erwartung |
|---|---|---|
| Badge | confirmed in Liste | kein Eintragsbadge „belegt“, Datum/Zeit/Details vorhanden |
| Badge | confirmed im Dialog | kein Eintragsbadge „belegt“, Kalender-ARIA nennt weiter „belegt“ |
| Badge | confirmed im Print | kein Eintragsbadge „belegt“ |
| Badge | blocked | Badge „gesperrt“ in Liste, Dialog und Print sichtbar |
| Badge | unbekannter `statusKey` | sichtbarer gelieferter/Fallbackbadge |
| Print Liste | gefüllter Range | nur Kopf und formatierte Liste, kein Monatskalender |
| Print Plan | gefüllter Range | Monatskalender plus Detailliste nach Seitenumbruch |
| Print leer | Liste | Kopf plus klare Leermeldung, `window.print()` wird aufgerufen |
| Print leer | Plan | Kalender des Ranges plus leere Detailliste/Leermeldung nach Umbruch |
| Print stale | API-Fehler mit frischem Cache | „Möglicherweise veralteter Stand“ im Kopf |
| Print offline | `navigator.onLine === false` | „Offline erstellt“ im Kopf |
| Print stale+offline | beide Zustände | beide Marker, keine Mehrdeutigkeit |
| Print Datenschutz | Snapshot/DOM | keine Formfelder, Namen aus Anfrage, Kontaktwerte, interne Notizen oder unbekannten privaten Properties |
| Print Direktaufruf | Button | Print-DOM vor instrumentiertem `window.print()` vollständig |
| Print Tastatur | `beforeprint` | aktuelle Ansicht synchron vorbereitet, null API-Requests |
| Print Race A/B | Print A vorbereitet, Rangewechsel B lädt, dann `beforeprint` | weder A noch unvollständiges B wird gedruckt; Print-DOM ist leer |
| Print Race Fehler | Print A vorbereitet, Rangewechsel B scheitert ohne Cache | alter Printinhalt A bleibt auch nach dem Fehler entfernt |
| Print CSS | `media=print` | nur `#occupancyPrint` sichtbar, Hauptseite/Dialog/Formulare verborgen |
| Print Range | Payload enthält außerhalb liegende Daten | ausschließlich inklusive Rangegrenzen gedruckt |
| Print Sortierung | unsortierte gleiche Tage/Zeiten | Datum, Start, Ende, stabile Originalreihenfolge |
| Markdown | Fett/Kursiv/Absätze/Zeilenumbruch | sicher und formatiert in Dialog/Liste/Print |
| Links | HTTPS und `mailto:` | sichere Attribute und korrekter Inhalt |
| Sicherheit | Raw HTML/Bild/Script/`javascript:` | kein ausführbarer oder unerlaubter Knoten |
| Zeichensatz | `Ä Ö Ü ä ö ü ß` | identisch in Bildschirm- und Print-DOM |
| Range | `current-month` | heute bis Monatsende |
| Range | `next-month` | heute bis Ende nächsten Monats |
| Range | `year` | heute bis Jahresende |
| Range | `next-year` | vollständiges nächstes Jahr |
| Range | Monatsklick | genau ein Request für selected-month und danach Liste |
| View | Plan zu Liste und zurück | lokale Renderer, null zusätzliche Occupancy-Requests |
| Manuell | Aktualisieren | genau ein Request, Button währenddessen deaktiviert |
| Loading | alter Inhalt | sichtbar, `inert`, `aria-busy`, Export deaktiviert |
| Race A/B | A langsam, B schnell | B gewinnt; A überschreibt nichts |
| Race finally | A endet nach B-Start | B bleibt gesperrt bis B endet |
| Fetch-Optionen | Initial-, Range-, manuelle und Race-Requests | instrumentiertes `window.fetch` sieht bei jedem Occupancy-Fetch `options.cache === "no-store"` |
| Fehler | kein Cache | Payload/Range/stale/Dialog/Print leer, Export deaktiviert |
| Cache | passender frischer Cache | stale-Fallback sichtbar/exportierbar |
| Cache | exakt TTL | physisch entfernt, nicht verwendet |
| Cache | ungültig | physisch entfernt, nicht verwendet |
| Cache | erfolgreicher Onlineabruf | alte `invalid`-/`expired`-Keys des aktiven Gebäudes werden beim Start von `loadOccupancy()` trotzdem physisch entfernt |
| Cache | anderes Gebäude | vollständig unangetastet |
| Cache | fremder Key | vollständig unangetastet |
| Cache | Legacy exakt | nur adressierter Legacy-Key entfernt |
| Responsive | 390 x 844 | kein horizontaler Overflow, Buttons bedienbar |
| Jahresansicht | zwölf Monate | Bildschirm renderbar, Printseiten ohne abgeschnittene Raster |
| Scope | `/DGH/` | DGH-Name, `dgh_rb`, richtige Daten und Cachekeys |
| Scope | `/Gemeindehaus/` | Gemeindehaus-Name, `ev_gem_rb`, richtige Daten und Cachekeys |
| Accessibility | Fokus/Dialog | Trigger- oder dokumentierter Fallbackfokus nach Schließen |
| Accessibility | Screenreaderstatus | Meta `role=status`, atomar; Loading nicht von Viewrenderer überschrieben |

### 15.2 Netzwerkrequest-Zählung

Im Browsertest den gemockten `/exec?action=occupancy`-Handler mitzählen und nach jedem Schritt den exakten Zähler prüfen. Zusätzlich `window.fetch` vor App-Start per `context.add_init_script()` wrappen, für jeden Occupancy-Aufruf `options.cache` protokollieren und am Ende ausnahmslos `"no-store"` erwarten:

1. Initialnavigation: ein Occupancy-Request.
2. Viewwechsel Plan -> Liste -> Plan: weiterhin ein Request.
3. Rangewechsel: genau ein weiterer Request.
4. Manueller Klick: genau ein weiterer Request.
5. schneller Doppelklick während Loading: höchstens ein weiterer manueller Request.
6. Printbutton: kein weiterer Request.
7. `beforeprint`: kein weiterer Request.
8. Für sämtliche bis dahin gezählten Occupancy-Requests stimmt die Anzahl der instrumentierten Fetch-Optionen mit der Requestanzahl überein und jeder Eintrag hat `cache === "no-store"`.

### 15.3 A/B-Race-Test

Der Mock muss Request A verzögert halten. Danach Range B auswählen und B sofort beantworten. Anschließend A trotz Abort nach Möglichkeit verspätet auflösen. Prüfen:

- sichtbarer Inhalt gehört B;
- `currentOccupancyRange` wirkt über Export und Viewwechsel ausschließlich als B;
- Meta nennt B-Datenstand;
- Printkopf und Details gehören B;
- A beendet weder `inert` noch `aria-busy`, solange B läuft;
- A erzeugt keinen sichtbaren Fehler;
- nur B schreibt einen neuen gültigen Cache für seinen Range.

Zusätzlicher Print-Race-Unterfall:

1. Aus geladenem Range A über den Printbutton Print A vollständig vorbereiten und `window.print()` instrumentiert abfangen.
2. Range B wählen und dessen Request im Mock offen halten.
3. Prüfen, dass der Start von `loadOccupancy()` Snapshot A und Print-DOM sofort geleert hat.
4. Während B lädt `beforeprint` dispatchen. Print-DOM bleibt leer; weder A noch ein unvollständiges B wird ausgegeben.
5. B ohne passenden Cache fehlschlagen lassen. Print-DOM und Snapshot bleiben leer; kein Inhalt aus A kehrt zurück.

### 15.4 Manuelle Browser- und Gerätefälle

Chromium und Firefox werden in der lokalen Windows-Umgebung geprüft. Safari Desktop, iOS Safari und die installierte iOS-PWA sind verbindliche **externe manuelle Abnahmeschritte**, weil sie lokal unter Windows nicht ausführbar sind. Diese Apple-Prüfungen müssen auf geeigneter Apple-Hardware erfolgen; das Ergebnis wird als kurze Abnahmenotiz im Arbeitsbericht oder PR festgehalten. Eine neue Repositorydatei ist dafür nicht erforderlich.

- Chromium Desktop: Buttondruck, Systemdialog, PDF-Vorschau, Schwarz-Weiß, Hintergrundgrafiken an/aus.
- Firefox Desktop: A4-Hochformat, Seitenumbrüche, Kalenderbreite, Links und Fonts.
- Safari Desktop: `beforeprint`, Vorschau, Seitenumbrüche, `inert`-Verhalten.
- iOS Safari: Share-/Druckablauf, Hochformat, 390-px-nahe Breite, keine abgeschnittenen Inhalte.
- Installierte PWA in Chromium/Android: Offline starten, frischen Cache anzeigen, Printaktion soweit Plattform unterstützt; klare Offline-/stale-Markierung.
- Installierte PWA auf iOS: Druck/Teilen soweit Web-App-Modus erlaubt; bei Plattformgrenzen keine falsche direkte Downloadzusage.
- Beide Gebäudescopes separat prüfen, damit Name, Farbe, Cache und Daten nicht vermischt werden.
- Jahresansicht und leerer Range jeweils mindestens einmal in echter Druckvorschau prüfen.
- Ausdruck auf Schwarz-Weiß-Drucker oder monochromer Vorschau prüfen.

## 16. Vollständige Qualitätsmatrix

Nach der Implementierung aus dem Repository-Root in PowerShell vollständig ausführen. Diese vorhandene Pflichtmatrix bleibt vollständig erhalten:

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

Zusätzlich den Browser-Druck manuell gemäß Abschnitt 15.4 prüfen. Die unter Windows nicht ausführbaren Apple-Fälle werden extern abgenommen und kurz im Arbeitsbericht oder PR dokumentiert. Ein Fehlschlag wird behoben; Tests werden nicht übersprungen, abgeschwächt oder gelöscht, um Grün zu erzwingen.

## 17. Versionsregel

Dieses Vorhaben ist eine Featureimplementierung. Nach Projektregel erfolgt deshalb der Sprung:

- Produktdokumentation: `1.3.1` -> `1.4.0`
- zu ändern: nur Versionsangaben in `README.md` und `PROJEKTUEBERSICHT.md`
- nicht zu ändern: Produkt-/Backendrelease sowie Apps-Script-/Google-Sheet-Migrationsstand `1.3`
- ebenfalls nicht zu ändern: öffentliches Occupancy-Response-Schema `schemaVersion: 2`
- kein neues Versionsfile und kein Paketmanager nur für die Versionsnummer

Die Reihenfolge ist verbindlich: zuerst Feature implementieren und die relevanten Featuretests/Teilmatrix grün ausführen; danach `README.md` und `PROJEKTUEBERSICHT.md` auf `1.4.0` setzen; anschließend die vollständige Qualitätsmatrix als finalen Verifikationslauf erneut ausführen, sodass Build und Prüfungen die Dokumentations-/Versionsänderungen einschließen.

## 18. Rollout

1. Feature in Quellfiles umsetzen und relevante Featuretests/Teilmatrix lokal grün ausführen.
2. Lokal verfügbare manuelle Druck-, Datenschutz- und PWA-Prüfungen unter Windows abschließen.
3. `README.md` und `PROJEKTUEBERSICHT.md` auf `1.4.0` setzen; Produkt-/Backendrelease sowie Apps-Script-/Sheet-Migration bleiben `1.3`, das öffentliche Occupancy-Response-Schema bleibt `schemaVersion: 2`.
4. `_site/` nur durch `python scripts/build-pages-site.py` neu erzeugen; generierte Inhalte nicht manuell korrigieren.
5. Vollständige Qualitätsmatrix als finalen Verifikationslauf inklusive Dokumentations-/Versionsänderungen ausführen und beide Scopes prüfen.
6. Safari Desktop, iOS Safari und installierte iOS-PWA extern auf Apple-Hardware abnehmen; kurze Abnahmenotiz im Arbeitsbericht oder PR festhalten, ohne zwingend eine Repositorydatei anzulegen.
7. Normalen geschützten Pages-Workflow verwenden. Kein Commit, Push oder Deployment ohne ausdrücklichen Benutzerauftrag.
8. Nach Deployment DGH und Gemeindehaus online öffnen, Rangewechsel/Ansichtswechsel/Refresh prüfen und je einen Listen- und Planausdruck ansehen.
9. Offline-PWA mit zuvor aufgebautem frischem Cache prüfen; stale/offline muss im Ausdruck sichtbar sein.

Der bestehende Build erzeugt durch geänderte Assetinhalte automatisch einen neuen Service-Worker-Cachehash. Es ist keine manuelle Cacheversion nötig.

## 19. Rollback

- Bei fachlichem oder technischem Fehler die zusammengehörigen Frontend- und Dokumentationsänderungen auf den letzten freigegebenen Stand zurückrollen und diesen Stand über den normalen Pages-Workflow neu bauen/deployen.
- Nicht einzelne generierte `_site`-Dateien zurückkopieren.
- Keine `localStorage.clear()`- oder globale Cachelöschung einführen. Die v2-Records bleiben schemaidentisch; gezielte 24-Stunden-Hygiene genügt.
- Ein Rollback der Quellen erzeugt beim Build wieder einen passenden Inhalts-Hash. Der Service Worker aktualisiert die App-Shell nach seinen bestehenden Network-First-/Aktivierungsregeln.
- API, Sheet und Backend benötigen keinen Rollback, weil sie durch das Feature nicht geändert werden.
- Nach Rollback beide Gebäudescopes, normale Belegungsanzeige, Dialogfokus und manuelle Aktualisierung kurz smoke-testen.

## 20. Definition of Done

- [ ] Alle verbindlichen Entscheidungen aus Abschnitt 3 sind exakt umgesetzt.
- [ ] Alle Akzeptanzkriterien aus Abschnitt 14 sind erfüllt.
- [ ] Automatisierte Matrix aus Abschnitt 16 läuft nach der Versions-/Dokumentationsänderung im finalen Verifikationslauf vollständig grün.
- [ ] Lokale manuelle Browser-/PWA-Matrix ist durchgeführt; Safari Desktop, iOS Safari und installierte iOS-PWA sind extern abgenommen und kurz im Arbeitsbericht oder PR dokumentiert.
- [ ] Confirmed-Badge fehlt nur in Eintragsdetails; blocked/unbekannt und Kalender-/ARIA-„belegt“ bleiben korrekt.
- [ ] Print nutzt nur einen synchronen, gefrorenen Snapshot bereits geladener öffentlicher Daten.
- [ ] Kein API-Request beim Print und kein DOM-Scraping.
- [ ] Rangewechsel, Viewwechsel, manueller Refresh und A/B-Races verhalten sich exakt wie spezifiziert.
- [ ] Cache-TTL wird physisch eingehalten, ohne fremde Gebäude/Keys anzufassen.
- [ ] Print ist A4 Hochformat, schwarz-weiß verständlich, leer/stale/offline nutzbar und datenschutzkonform.
- [ ] `DESIGN.md`, `README.md` und `PROJEKTUEBERSICHT.md` spiegeln den umgesetzten Stand.
- [ ] `README.md` und `PROJEKTUEBERSICHT.md` nennen `1.4.0`; Produkt-/Backendrelease und Apps-Script-/Sheet-Migration bleiben `1.3`, das öffentliche Occupancy-Response-Schema bleibt `schemaVersion: 2`.
- [ ] Keine Backend-, Apps-Script-, Sheet-, Manifest-, Service-Worker- oder Buildänderung wurde unnötig eingeführt.
- [ ] Keine Datei unter `_site/` wurde manuell geändert.
- [ ] Abschließender Git-Diff enthält nur beabsichtigte Änderungen und keine privaten Daten.

## 21. Warnungen für das ausführende Modell

- Kleinste korrekte Änderungen bevorzugen. Keine neue Architektur oder Bibliothek einführen, wenn vorhandene Renderer und Browserdruck genügen.
- `DESIGN.md` vor UI-/CSS-Änderungen beachten und bestehende eckige, ruhige, gebäudespezifische Gestaltung erhalten.
- Deutsche Texte mit korrekten Umlauten und ß schreiben.
- `_site/` nie manuell bearbeiten; nur Buildausgabe.
- Keine PDF-Library installieren. `window.print()` ist die verbindliche Lösung.
- Keine privaten Daten in Snapshot, Print-DOM, Tests, Fixtures, Logs oder Dokumentation aufnehmen.
- Keine Textfilterung und kein globales CSS zum Entfernen des confirmed-Badges verwenden.
- Fremde Gebäude- und fremde Storage-Keys niemals löschen.
- Bestehende fremde Änderungen im Worktree nicht zurücksetzen, überschreiben oder „aufräumen“.
- Keine Commits, kein Push und kein Deployment ohne ausdrücklichen Auftrag.
- Nicht behaupten, das Feature sei umgesetzt, bevor Code, Tests, Dokumentation und manuelle Druckprüfung abgeschlossen sind.
