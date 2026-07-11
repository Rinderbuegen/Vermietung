# Google-Sheet-Struktur

`setupSheets()` legt die benötigten Tabs und Header automatisch an. Betreiber können die Daten danach direkt im Sheet pflegen.

## Buildings

```text
building_id | name | operator_name | contact_email | active | public_note
```

`active` muss `true` sein, damit das Gebäude über die API nutzbar ist.

Sichtbare UI-Texte und der Hero-Kontakt werden unter `betreiber/allgemein/texte` und `betreiber/<Bereich>/konfiguration/frontend.json` gepflegt. Die Werte aus `Buildings` dienen der API und als Fallback.

## Bookings

```text
booking_id | building_id | date | from | to | title | status | public_title | internal_note | created_at | updated_at
```

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
request_id | building_id | date | from | to | requester_name | requester_contact | title | note | status | conflict | created_at | updated_at
```

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

- `public_show_booking_titles`: `true` oder `false`
- `notify_email`: Betreiberadresse für Benachrichtigungen
- `sheet_url`: Link zum Sheet für Benachrichtigungs-E-Mails

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
