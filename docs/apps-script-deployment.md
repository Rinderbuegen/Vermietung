# Apps-Script-Deployment Version 1.3

Diese Anleitung beschreibt die öffentliche Apps-Script-Web-App für Belegung, Buchungs- und Kontaktanfragen. Hinweise und PDFs bleiben im GitHub-Repository. Die verbindliche Reihenfolge ist fail closed: Erst API und private Sheets, danach die Pages-Version 1.3.

## Vorbedingungen

- Beide produktiven Sheets manuell sichern und ein Wartungsfenster vereinbaren.
- Beide tatsächlichen Headerzeilen, Datenmengen, Formeln, Checkboxen und doppelte `(building_id, key)`-Settings prüfen. Repository-Dateien ersetzen diese Live-Prüfung nicht.
- Vollständige Datenschutzerklärung im Rechtstext ergänzen und rechtlich prüfen. Solange dort ein Platzhalter steht, `public_show_booking_details` nicht aktivieren und weder Personennamen noch `mailto:`-Links als Veranstalter freigeben.
- Für Staging getrennte Sheet-Kopien und eine getrennte Apps-Script-Web-App verwenden. Keine echten Formulardaten oder Produktionssecrets in Tests verwenden.

Die beiden produktiven Zuordnungen sind:

```text
dgh_rb    -> Dorfgemeinschaftshaus Rinderbügen
ev_gem_rb -> Evangelisches Gemeindehaus Rinderbügen
```

## Quellen Und Bereitstellung

`apps-script/buchungs-api/Code.template.gs` ist die Quelle der standalone API. Betreiberwerte werden aus `betreiber/allgemein/backend/` injiziert:

```pwsh
python scripts/build-apps-script.py
```

Die dadurch erzeugte Datei `apps-script/buchungs-api/Code.gs` wird in das standalone Apps-Script-Projekt kopiert. Sie ist nie manuell zu bearbeiten; jede fachliche Änderung gehört in Template oder Betreiberquellen.

Das gebundene Verwaltungsskript `apps-script/buchungsverwaltung/Code.gs` ist getrennt: Es muss nach der API-Migration in jedem der beiden Sheets einzeln aktualisiert, gespeichert, autorisiert und getestet werden.

## Neue Installation Oder Bestehendes Sheet

Für ein neues, leeres Sheet `setupSheets()` einmal manuell starten. Die Funktion legt fehlende Tabs mit Version-1.3-Headers an und validiert vorhandene Tabs. Sie überschreibt keine gefüllten Header und migriert keine Daten.

Für ein bestehendes Version-1.2-Sheet ausschließlich im Wartungsfenster `migrateSheetsV13()` einmal manuell starten. Der Lauf prüft beide Gebäude vor jeder Änderung. Erst nach vollständig erfolgreichem Gesamt-Preflight setzt er den internen Settings-Marker `maintenance_migrate_sheets_v13` in beiden Sheets auf aktiv, erstellt erforderliche Backup-Tabs und migriert blockweise. Solange der Marker aktiv ist, schlagen mutierende API- und Verwaltungsaktionen fail closed fehl. Danach Header, Zeilenanzahl, interne Notizen, Checkboxen, Settings und Logeinträge prüfen. Einen zweiten Lauf starten: Er darf keine Daten erneut schreiben und keine zusätzlichen Backups erzeugen.

`maintenance_migrate_sheets_v13` ist ausschließlich ein interner Wartungsmarker, kein Master für öffentliche Details und keine Veröffentlichungsfreigabe. Google Apps Script kann zwei getrennte Spreadsheets nicht als eine globale Transaktion zurückrollen. Tritt nach einer Teiländerung ein Fehler auf, anhand der Backup-Tabs manuell wiederherstellen und erst nach erfolgreicher Prüfung den Marker in beiden Sheets manuell auf `false` setzen. `migrateSheetsV13()` wird nie durch `doGet`, `doPost`, `setupSheets`, `onOpen` oder Trigger ausgeführt.

Details zu Schemas und Migration: `docs/google-sheet-struktur.md`.

## Öffentliche Details Fail Closed

`public_show_booking_details` ist der Master je Gebäude. Ein vorhandener leerer oder falscher Wert gilt als `false`. Nur wenn dieser Key fehlt, wird der erhaltene Legacy-Key `public_show_booking_titles` als Fallback gelesen. Zusätzlich benötigen `public_title` und `public_organizer` jeweils ihre eigene Sichtbarkeitscheckbox und einen nicht leeren Text. Fehlende Checkboxen sind `false`.

Die API gibt keine privaten Sheet-Felder aus. `title`, `note`, `internal_note`, Namen, Kontaktdaten, Sichtbarkeitsflags und Zeitstempel sind nie Teil der Belegungsantwort. Freigegebene Details sind auf 1000 Zeichen begrenzt, behalten Zeilenumbrüche und werden erst im Browser mit eingeschränktem Markdown als DOM gerendert.

Beispiel für `GET <exec-url>?action=occupancy&buildingId=dgh_rb&from=2026-07-01&to=2026-07-31`:

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
        "publicTitle": "**Sommerkonzert**",
        "publicOrganizer": "[Kulturverein](https://example.org/veranstaltungen)"
      }
    ]
  },
  "message": "OK"
}
```

Vor Aktivierung je Gebäude einen Geheimmarkertest durchführen: eindeutige Marker in allen privaten Feldern einer Testbuchung setzen, beide `/exec?action=occupancy...`-Antworten abrufen und bestätigen, dass weder Marker noch private Feldnamen vorkommen. Danach Testdaten und Marker entfernen.

## Verbindliche Deploymentreihenfolge

1. Lokalen Branch generieren, bauen und mit der vollständigen Qualitätsmatrix testen.
2. Sheet-Kopien und Staging-Web-App gegen die Version-1.3-API testen.
3. Produktive Sheets sichern, Wartungsfenster beginnen und API-Konto-Zugriff auf beide Sheets prüfen.
4. Rückwärtskompatible, fail-closed API als neue Version auf die bestehende `/exec`-URL bereitstellen. Die URL bleibt normalerweise gleich; „Neue Version“ in den Bereitstellungen wählen.
5. Beide API-Antworten einschließlich Geheimmarkertest prüfen.
6. `migrateSheetsV13()` manuell ausführen. Nach vollständigem Preflight setzt der Lauf `maintenance_migrate_sheets_v13` in beiden Sheets aktiv; Ergebnisse prüfen und den idempotenten zweiten Lauf durchführen.
7. Gebundenes Verwaltungsskript in jedem Sheet einzeln aktualisieren und Bestätigen, Ablehnen sowie Sperren testen.
8. Erst nach Datenschutzerklärung, API-, Migration- und Geheimmarkertest öffentliche Texte und Checkboxen bewusst pflegen; Master je Gebäude erst dann aktivieren.
9. Nach grüner Qualitätsprüfung auf `main` startet die Pages-Bereitstellung automatisch und wartet im geschützten Environment `github-pages`. Die zuständige Freigabe darf erst nach Abschluss der Schritte 3 bis 8 erteilt werden. `workflow_dispatch` unterstützt einen manuellen Wiederholungslauf derselben Qualität und Bereitstellung.
10. Online, offline, mobil, per Tastatur und hinsichtlich CORS gegen die echte `/exec`-URL prüfen.

Bei einem teilweisen Migrationsfehler keine weiteren API- oder Verwaltungsänderungen erzwingen: Backups im betroffenen Sheet wiederherstellen, beide Sheets vollständig prüfen und erst danach `maintenance_migrate_sheets_v13` manuell in beiden Sheets auf `false` setzen.

Die GitHub-Actions-Qualitätsprüfung auf Pull Requests benötigt kein Deploymentsecret und stellt nie Pages bereit. Pushes auf `main` und `workflow_dispatch` stellen erst nach grüner Qualität bereit; das geschützte Environment `github-pages` ist die Freigabeschranke für die abgeschlossene Backend-, Migrations- und Datenschutzcheckliste. Das Deployment nutzt `APPS_SCRIPT_WEB_APP_URL` ausschließlich, um `_site` zur Laufzeit zu konfigurieren.

## Web-App Bereitstellen

1. In `script.google.com` ein standalone Projekt mit Zugriff auf beide Sheets öffnen.
2. Generierte `apps-script/buchungs-api/Code.gs` einfügen und speichern.
3. Bei einer neuen, leeren Installation `setupSheets()` manuell ausführen; bei bestehenden Daten stattdessen den oben beschriebenen Migrationsablauf befolgen.
4. `Bereitstellen` → `Bereitstellungen verwalten` → Web-App bearbeiten → `Neue Version`.
5. `Ausführen als: Ich` und den benötigten öffentlichen Zugriff wählen.
6. Die bestehende `/exec`-URL als GitHub-Secret `APPS_SCRIPT_WEB_APP_URL` hinterlegen. `/dev` ist nur für Editor-Tests.

## Qualitätsmatrix Und Lokale Demo

Die schnelle lokale Demo ist kein Ersatz für die vollständige Qualitätsmatrix. `tools\demo-server.cmd` prüft Buildpfade, HTTPS und PWA-Verhalten mit einer Sitzungsvariable; schreibende Formulare nur gegen Staging senden.

Vor Release ausführen:

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

Für den Browser-Test einmalig:

```pwsh
python -m pip install playwright==1.61.0
python -m playwright install chromium
```

## Benötigte Berechtigungen

Das standalone Script benötigt Google-Sheets-Zugriff zum Lesen und Schreiben sowie MailApp für optionale Benachrichtigungen. Es benötigt keinen Google-Drive-Zugriff für Hinweise oder PDFs.
