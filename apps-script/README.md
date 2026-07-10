# Apps Script

Zwei getrennte Skripte für unterschiedliche Zwecke:

## 1. Buchungs-API (`buchungs-api/Code.gs`)

Öffentliche REST-API für die PWA. Läuft als **standalone Web App**.

Aufgaben:
- `GET building` – Gebäudeinfo abrufen
- `GET occupancy` – Belegungsdaten für den Kalender
- `POST createBookingRequest` – neue Anfrage aus dem Formular speichern
- `POST createContactRequest` – Kontaktanfrage speichern
- E-Mail-Benachrichtigung an Betreiber bei neuen Anfragen
- Tabellen-Struktur via `setupSheets()` anlegen

**Einrichtung:**

1. `buchungs-api/Code.gs` in ein neues Apps-Script-Projekt kopieren
2. `setupSheets()` einmal manuell ausführen → legt Tabs an
3. Betreiberwerte im Spreadsheet prüfen (Buildings, Settings)
4. Als Web-App bereitstellen (Ausführen als: ich, Zugriff: Jeder)
5. Web-App-URL als `APPS_SCRIPT_WEB_APP_URL` im GitHub-Secret hinterlegen

Spreadsheet-Zuordnung:

| building_id | Spreadsheet-ID |
|---|---|
| `dgh_rb` | `11yws8ZxRB9U2oyeW8hwwC_WTR1AYLao4_iNkZEIwThc` |
| `ev_gem_rb` | `1GaqxZtkEx_lByT1odJXkS4Rp80Kr4cuLwFWz32Ssq1E` |

## 2. Buchungsverwaltung (`buchungsverwaltung/Code.gs`)

Betreiber-Workflow für Google Sheets. Läuft als **gebundenes Script**
direkt im Spreadsheet (Erweiterungen → Apps Script).

Aufgaben:
- Menü "Buchungen" mit Aktionen für eingehende Anfragen
- "Anfrage bestätigen → Booking" legt Eintrag in Bookings an und sendet E-Mail
- "Anfrage ablehnen" setzt Status auf rejected
- "Zeitraum sperren" trägt blocked-Eintrag in Bookings ein

**Einrichtung:**

1. Spreadsheet öffnen → Erweiterungen → Apps Script
2. `buchungsverwaltung/Code.gs` einfügen, speichern, Projektname vergeben
3. Bei erster Menü-Nutzung Berechtigungen erteilen
4. Spreadsheet neu laden → Menü "Buchungen" erscheint

## Tabellen-Struktur

Siehe `docs/google-sheet-struktur.md`. Beide Skripte nutzen dieselbe
Tabellen-Struktur – die Buchungs-API legt sie an, die Buchungsverwaltung
arbeitet darauf.
