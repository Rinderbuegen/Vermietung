# Google-Sheet-Struktur

`setupSheets()` legt die benötigten Tabs und Header automatisch an. Betreiber können die Daten danach direkt im Sheet pflegen.

## Buildings

```text
building_id | name | operator_name | contact_email | active | public_note
```

`active` muss `true` sein, damit das Gebäude über die API nutzbar ist.

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
- `show_pending_requests_in_occupancy`: `true` oder `false`
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

## Nicht Im Sheet

Hinweise und Downloads werden nicht in Google Sheets gepflegt. Sie liegen im GitHub-Repository:

- Hinweise: `news/<buildingId>/*.md` mit Frontmatter.
- Downloads: `downloads/<buildingId>/*.pdf` mit PDF-Properties.

Siehe `docs/github-content.md`.
