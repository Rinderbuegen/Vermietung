# Google-Sheet-Struktur

`setupSheets()` legt fehlende Tabs für neue, leere Installationen an und validiert vorhandene Header. Es überschreibt keine gefüllten oder unbekannten Tabellen. Bestehende Version-1.2-Sheets werden ausschließlich im Wartungsfenster mit `migrateSheetsV13()` migriert.

## Buildings

```text
building_id | name | operator_name | contact_email | active | public_note
```

`active` muss `true` sein, damit das Gebäude über die API nutzbar ist.

Sichtbare UI-Texte und der Hero-Kontakt werden unter `betreiber/allgemein/texte` und `betreiber/<Bereich>/konfiguration/frontend.json` gepflegt. Die Werte aus `Buildings` dienen der API und als Fallback.

## Bookings

```text
booking_id | building_id | date | from | to | title | status | public_title | public_title_visible | public_organizer | public_organizer_visible | created_at | updated_at | internal_note
```

Die Reihenfolge ist verbindlich. Öffentliche API-Antworten enthalten nur Datum, Zeit, Status, `publicTitle` und `publicOrganizer`; nie die privaten Sheet-Felder.

| Feld | Bedeutung und Öffentlichkeit |
|---|---|
| `title` | Interner Buchungszweck, nie öffentlich. |
| `public_title` | Eingeschränktes Markdown, maximal 1000 Zeichen; nur mit Master und `public_title_visible: true` öffentlich. |
| `public_title_visible` | Checkbox mit echtem Boolean, Standard `false`; nie öffentlich. |
| `public_organizer` | Eingeschränktes Markdown, maximal 1000 Zeichen; nur mit Master und `public_organizer_visible: true` öffentlich. |
| `public_organizer_visible` | Checkbox mit echtem Boolean, Standard `false`; nie öffentlich. |
| `internal_note` | Interner Betreibervermerk, nie öffentlich. |

Titel und Veranstalter werden unabhängig freigegeben. Text allein veröffentlicht nichts. Ein bewusst freigegebener Personenname oder `mailto:`-Link ist öffentlich und darf erst nach fertiger, geprüfter Datenschutzerklärung veröffentlicht werden.

Erlaubt sind Absätze, einzelne Zeilenumbrüche, `**fett**`, `*kursiv*`, absolute `https:`-Links und `mailto:`-Links. Raw HTML, Bilder, Überschriften, Listen, Tabellen, Code, relative URLs sowie `http:`, `javascript:`, `data:` und `vbscript:` werden nicht als Markdown ausgeführt.

## Statuswerte

Statuswerte:

- `confirmed`: öffentlich `belegt`
- `blocked`: öffentlich `gesperrt`
- `cancelled`: wird nicht angezeigt

Zeitformat:

- Datum: `YYYY-MM-DD`
- Zeit: `HH:MM`
- ganzer Tag: `00:00` bis `23:59`

## Requests

```text
request_id | building_id | date | from | to | requester_name | requester_contact | title | note | status | conflict | created_at | updated_at | internal_note
```

`note` ist unverändert der Text der anfragenden Person und bleibt privat. `internal_note` ist der getrennte interne Betreibervermerk. Beim Bestätigen wird nur `Requests.internal_note` nach `Bookings.internal_note` kopiert; `Requests.note` wird weder kopiert noch öffentlich ausgegeben.

Statuswerte:

- `open`
- `open_with_conflict`
- `approved`
- `rejected`
- `cancelled`

Neue öffentliche Anfragen werden nur als `open` oder `open_with_conflict` gespeichert. Bestätigte Buchungen trägt der Betreiber in `Bookings` ein.

## Settings

```text
building_id | key | value
```

Wichtige Schlüssel:

- `public_show_booking_details`: Master für beide öffentlichen Detailfelder dieses Gebäudes. Vorhandener leerer oder falscher Wert gilt als `false`.
- `public_show_booking_titles`: Legacy-Key. Er bleibt in Version 1.3 erhalten und wird nur gelesen, wenn `public_show_booking_details` als Key fehlt.
- `maintenance_migrate_sheets_v13`: Interner Wartungsmarker für die Migration. Er ist kein Master für öffentliche Details und steuert keine Veröffentlichung.
- `notify_email`: Betreiberadresse für Benachrichtigungen
- `sheet_url`: Link zum Sheet für Benachrichtigungs-E-Mails

Der Master allein reicht nicht: Beide Detailfelder benötigen zusätzlich ihre eigene Checkbox und einen nicht leeren Text. Fehlende Checkboxen gelten immer als `false`. Bei aktivem `maintenance_migrate_sheets_v13` brechen API- und Verwaltungsaktionen, die Daten ändern, fail closed ab.

## Migration Auf Version 1.3

Für gefüllte Version-1.2-Sheets vor dem Frontend-Release ein Wartungsfenster vereinbaren, Betreiberänderungen pausieren und Kopien beider Sheets anlegen. `migrateSheetsV13()` wird im standalone Apps-Script-Projekt bewusst manuell gestartet, nie durch `doGet`, `doPost`, `setupSheets`, `onOpen` oder Trigger.

Der Gesamt-Preflight prüft beide Gebäude vor der ersten Änderung: exakte Header, doppelte Settings und Formeln. Erst nach vollständig erfolgreichem Preflight setzt die Migration `maintenance_migrate_sheets_v13` in beiden Sheets auf aktiv. Solange der Marker aktiv ist, schlagen API- und Verwaltungsänderungen fail closed fehl. Der Lauf sichert geänderte Tabs, migriert maximal 500 Datenzeilen je Block, setzt neue Sichtbarkeitscheckboxen auf echte Booleans `false` und ergänzt den neuen Settings-Key ohne den Legacy-Key zu löschen. Nach Erfolg Backup-Tabs, Logeinträge, Header, Checkboxen und einen zweiten idempotenten Lauf prüfen.

Google Apps Script kann zwei getrennte Spreadsheets nicht global transaktional zurückrollen. Bei einem Fehler nach einer Teiländerung anhand der Backup-Tabs manuell wiederherstellen; keine globale Atomarität annehmen. Erst nach geprüfter Wiederherstellung den Marker in beiden Sheets manuell auf `false` setzen. Er darf nicht vor Abschluss der Prüfung nur in einem Sheet oder automatisch zurückgesetzt werden.

## Log

```text
timestamp | building_id | action | reference_id | message
```

Das Log soll keine vollständigen personenbezogenen Anfrageinhalte enthalten.

## Contacts

```text
contact_id | building_id | name | contact | subject | message | created_at
```

Der Reiter `Contacts` ist die Eingangsliste für allgemeine Kontaktanfragen aus dem öffentlichen Kontaktformular. Er ist kein Adressbuch und keine Buchungsliste.

Neue Einträge entstehen automatisch, wenn ein Nutzer im Abschnitt `Kontakt` das Formular absendet. Die API speichert die Anfrage mit `createContactRequest` und schreibt zusätzlich einen kurzen Eintrag in `Log`.

Felder:

- `contact_id`: automatisch erzeugte eindeutige ID der Kontaktanfrage.
- `building_id`: Gebäude, zu dem die Anfrage gehört.
- `name`: Name der anfragenden Person.
- `contact`: angegebene Kontaktmöglichkeit, zum Beispiel E-Mail-Adresse oder Telefonnummer.
- `subject`: Betreff der Anfrage.
- `message`: Nachrichtentext.
- `created_at`: Zeitpunkt der Übermittlung als ISO-Zeitstempel.

Wichtig:

- Kontaktanfragen werden nicht öffentlich angezeigt.
- Kontaktanfragen blockieren keine Zeiten und erzeugen keine Einträge in `Bookings`.
- Kontaktanfragen sind von Buchungsanfragen in `Requests` getrennt. Für Terminwünsche muss das Buchungsformular genutzt werden.
- Es gibt aktuell kein Statusfeld. Betreiber lesen und bearbeiten die Einträge direkt im Sheet, zum Beispiel durch Rückmeldung über die angegebene Kontaktmöglichkeit.
- Personenbezogene Daten stehen vollständig im Reiter `Contacts`; Zugriffsrechte auf das Sheet entsprechend eng halten.

## Nicht Im Sheet

Hinweise und Downloads werden nicht in Google Sheets gepflegt. Sie liegen im GitHub-Repository:

- Hinweise: `betreiber/<Bereich>/news/*.md` mit Frontmatter.
- Downloads: `betreiber/<Bereich>/downloads/oeffentlich/*.pdf` mit PDF-Properties.

Siehe `docs/github-content.md`.
