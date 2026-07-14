# Apps Script

Zwei getrennte Skripte für unterschiedliche Zwecke:

## 1. Buchungs-API (`buchungs-api/Code.gs`)

Öffentliche REST-API für die PWA. Läuft als **standalone Web App**.

Aufgaben:
- `GET building` – Gebäudeinfo abrufen
- `GET occupancy` – Belegungsdaten mit fail-closed freigegebenen Details für den Kalender
- `POST createBookingRequest` – neue Anfrage aus dem Formular speichern
- `POST createContactRequest` – Kontaktanfrage speichern
- E-Mail-Benachrichtigung an Betreiber bei neuen Anfragen
- Tabellen-Struktur für neue, leere Sheets via `setupSheets()` anlegen und vorhandene Header validieren
- Bestehende Version-1.2-Sheets ausschließlich manuell via `migrateSheetsV13()` migrieren

**Einrichtung:**

1. `python scripts/build-apps-script.py` ausführen
2. Die erzeugte `buchungs-api/Code.gs` in ein neues Apps-Script-Projekt kopieren; die Datei nie manuell pflegen
3. Für neue, leere Sheets `setupSheets()` manuell ausführen; bestehende Sheets nur nach Preflight und Wartungsfenster mit `migrateSheetsV13()` migrieren
4. Betreiberwerte, Header, Checkboxen und die öffentliche Detailfreigabe im Spreadsheet prüfen
5. Als Web-App bereitstellen (Ausführen als: ich, Zugriff: Jeder)
6. Web-App-URL als `APPS_SCRIPT_WEB_APP_URL` im GitHub-Secret hinterlegen

`public_show_booking_details` ist ein Master je Gebäude. Öffentliche Titel und Veranstalter benötigen zusätzlich ihre eigene Checkbox; fehlende Werte sind immer nicht freigegeben. Der Legacy-Key `public_show_booking_titles` bleibt nur als Übergangs-Fallback erhalten. Details zu Schema, Migration und Testreihenfolge: `docs/google-sheet-struktur.md` und `docs/apps-script-deployment.md`.

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
- setzt neue öffentliche Felder standardmäßig leer und Sichtbarkeitscheckboxen auf `false`
- kopiert beim Bestätigen nur `Requests.internal_note`, niemals den Antragstellertext aus `Requests.note`

**Einrichtung:**

1. Jedes der beiden Spreadsheets öffnen → Erweiterungen → Apps Script
2. `buchungsverwaltung/Code.gs` in jedem gebundenen Projekt einzeln einfügen, speichern und Projektname vergeben
3. Bei erster Menü-Nutzung Berechtigungen erteilen
4. Spreadsheet neu laden → Menü "Buchungen" erscheint
5. Bestätigen, Ablehnen und Sperren zunächst in einer Sheet-Kopie testen

## Tabellen-Struktur

Siehe `docs/google-sheet-struktur.md`. Beide Skripte nutzen dieselbe
Tabellen-Struktur – die Buchungs-API legt sie an, die Buchungsverwaltung
arbeitet darauf. Die API-Migration und die getrennte Aktualisierung beider gebundenen Skripte gehören zur manuellen Backend-Reihenfolge vor dem Pages-Deployment.
