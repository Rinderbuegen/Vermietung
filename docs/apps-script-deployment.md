# Apps-Script-Deployment: Schritt-für-Schritt

Diese Anleitung richtet sich an Personen, die Google Apps Script noch nicht genutzt haben. Ziel: Die statische PWA bekommt eine Web-App-URL für Belegung, Buchungsanfragen und Kontaktanfragen. Hinweise und PDF-Downloads liegen im GitHub-Repository und laufen nicht über Apps Script.

## Begriffe

- `Google Sheet`: die Tabelle, in der Betreiber Gebäude, Belegung und Anfragen pflegen.
- `Apps Script`: kleines Google-Script, das zwischen PWA und Sheets sitzt.
- `Web-App`: öffentlich erreichbare URL des Apps Scripts.
- `setupSheets()`: Hilfsfunktion, die Tabs und Kopfzeilen in den zwei Sheets anlegt.
- `Deployment-URL`: URL, die später in `config/config.js` eingetragen wird.

## Vorhandene Sheets

Diese beiden Sheets sind im Script fest eingetragen:

```text
dgh_rb    -> Dorfgemeinschaftshaus Rinderbügen
             11yws8ZxRB9U2oyeW8hwwC_WTR1AYLao4_iNkZEIwThc

ev_gem_rb -> Evangelisches Gemeindehaus Rinderbügen
             1GaqxZtkEx_lByT1odJXkS4Rp80Kr4cuLwFWz32Ssq1E
```

## 1. Apps-Script-Projekt Erstellen

1. Browser öffnen.
2. `https://script.google.com/` öffnen.
3. Mit dem Google-Konto anmelden, das Zugriff auf beide Sheets hat.
4. Links oben auf `Neues Projekt` klicken.
5. Projektnamen ändern, zum Beispiel `Gebäudevermietung API`.
6. Datei `Code.gs` im Editor öffnen.
7. Vorhandenen Inhalt komplett löschen.
8. Inhalt aus `apps-script/Code.gs` aus diesem Repository komplett einfügen.
9. Speichern: Disketten-Symbol oder `Strg+S`.

## 2. setupSheets() Ausführen

Diese Funktion bereitet beide Google Sheets vor.

1. Im Apps-Script-Editor oben in der Funktionsauswahl `setupSheets` auswählen.
2. Auf `Ausführen` klicken.
3. Beim ersten Mal erscheint eine Berechtigungsabfrage.
4. Google-Konto auswählen.
5. Falls Google warnt, dass die App nicht geprüft ist: `Erweitert` anklicken.
6. `Zu Gebäudevermietung API gehen` anklicken.
7. Berechtigungen erlauben.
8. Warten, bis die Ausführung fertig ist.

Erwartetes Ergebnis:

- Beide Sheets bekommen die Tabs `Buildings`, `Bookings`, `Requests`, `Settings`, `Log`, `Contacts`.
- Die erste Zeile enthält jeweils die passenden Spaltennamen.
- In `Buildings` wird je Gebäude eine Startzeile angelegt.
- In `Settings` werden Startwerte angelegt.

Wichtig: `setupSheets()` setzt die Kopfzeilen der Tabs. Nach manuellen Strukturänderungen vorsichtig verwenden.

## 3. Sheets Prüfen Und Betreiberwerte Eintragen

Nach `setupSheets()` beide Sheets öffnen und prüfen.

### Tab `Buildings`

Diese Felder anpassen:

```text
name
operator_name
contact_email
public_note
```

`active` muss `true` sein.

### Tab `Settings`

Diese Werte prüfen:

```text
notify_email
public_show_booking_titles
sheet_url
```

Empfehlung für den Start:

```text
public_show_booking_titles = false
```

`notify_email` ist die Adresse, an die neue Buchungsanfragen gesendet werden.

## 4. Apps Script Als Web-App Bereitstellen

1. Im Apps-Script-Editor rechts oben auf `Bereitstellen` klicken.
2. `Neue Bereitstellung` wählen.
3. Neben `Typ auswählen` auf das Zahnrad klicken.
4. `Web-App` auswählen.
5. Beschreibung eintragen, zum Beispiel `Erste Version`.
6. `Ausführen als`: `Ich` auswählen.
7. `Wer hat Zugriff`: `Jeder` auswählen.
8. Auf `Bereitstellen` klicken.
9. Falls erneut Berechtigungen abgefragt werden, bestätigen.
10. Die `Web-App-URL` kopieren.

Wichtig:

- Die URL muss auf `/exec` enden.
- Eine `/dev`-URL ist nur zum Testen im Editor gedacht und nicht für GitHub Pages.
- `Ausführen als: Ich` ist wichtig, damit die PWA keinen direkten Sheet-Zugriff braucht.

## 5. Web-App Kurz Testen

Die kopierte URL im Browser mit Parametern öffnen.

Beispiel:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=building&buildingId=dgh_rb
```

Erwartete Antwort enthält:

```json
{
  "ok": true,
  "data": {
    "buildingId": "dgh_rb"
  }
}
```

Wenn `ok` auf `false` steht, die Fehlermeldung lesen. Häufige Ursachen:

- `setupSheets()` wurde noch nicht ausgeführt.
- Das Script-Konto hat keinen Zugriff auf die Sheets.
- Das Gebäude ist im Tab `Buildings` nicht aktiv.
- Die URL ist nicht die `/exec`-Deployment-URL.

## 6. Web-App-URL In Der PWA Eintragen

Datei öffnen:

```text
config/config.js
```

Diesen Wert ersetzen:

```js
apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
```

Durch die echte Web-App-URL, zum Beispiel:

```js
apiBaseUrl: "https://script.google.com/macros/s/AKfycb.../exec",
```

## 7. Hinweise Und PDFs Pflegen

Nicht im Apps Script und nicht in Google Drive pflegen.

- PDFs kommen nach `downloads/dgh_rb/` oder `downloads/ev_gem_rb/`.
- Hinweise kommen nach `news/dgh_rb/` oder `news/ev_gem_rb/`.
- Metadaten kommen aus PDF-Properties bzw. Markdown-Frontmatter.
- Die GitHub-Action erzeugt beim Deployment automatisch die Indexdateien.

Siehe `docs/github-content.md`.

## 8. PWA Lokal Testen

Wenn Hinweise oder PDFs lokal ergänzt wurden, zuerst den Index erzeugen:

```pwsh
python scripts/build-content-index.py
```

Danach die lokale Demo mit `tools\demo-server.cmd` starten. Voraussetzungen und Aufruf sind in `docs/lokaler-demo-server.md` beschrieben.

Prüfen:

- Startseite zeigt den richtigen Gebäudenamen.
- Belegung lädt ohne Fehlermeldung.
- Hinweise laden aus `assets/data/news.json`.
- Downloads laden aus `assets/data/downloads.json`.
- Eine Test-Buchungsanfrage landet im Tab `Requests`.
- Optional kommt eine E-Mail an `notify_email` an.

## 9. Änderungen Am Script Später Veröffentlichen

Wenn `Code.gs` später geändert wird, reicht Speichern allein nicht immer für die öffentliche Web-App.

Dann:

1. `Bereitstellen` öffnen.
2. `Bereitstellungen verwalten` wählen.
3. Bei der Web-App auf den Stift klicken.
4. Version auf `Neue Version` setzen.
5. Beschreibung eintragen.
6. `Bereitstellen` klicken.

Die Web-App-URL bleibt normalerweise gleich.

## 10. Benötigte Berechtigungen

Das Script benötigt:

- Google Sheets: Tabellen lesen und schreiben.
- MailApp: optionale Benachrichtigungen senden.

Kein Google-Drive-Zugriff für PDFs oder Hinweise.

## 11. API-Aktionen

GET:

```text
?action=building&buildingId=dgh_rb
?action=occupancy&buildingId=dgh_rb&from=2026-07-01&to=2026-07-31
```

POST-Beispiel:

```json
{
  "action": "createBookingRequest",
  "buildingId": "dgh_rb",
  "date": "2026-07-15",
  "from": "18:00",
  "to": "20:00",
  "requesterName": "Max Mustermann",
  "requesterContact": "max@example.com",
  "title": "Probe",
  "note": "Kurze Bemerkung"
}
```

## 12. Datenschutz Und Rechtliches Fertigstellen

Vor Veröffentlichung in `index.html` ersetzen oder ergänzen:

- Impressum
- Datenschutzerklärung
- echte Betreiberadresse
- echte Kontaktadresse
- Verantwortliche Stelle
- Speicherdauer für Anfragen

## 13. Sicherheit TODO Für Spätere Version

- einfaches Rate-Limit
- Captcha
- E-Mail-Bestätigung an Anfragende
- optional Zugriff nur für Google-Konten
