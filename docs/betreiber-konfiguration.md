# Betreiber-Konfiguration

## Eine App Pro Gebäude

Für ein zweites Gebäude wird die statische PWA kopiert oder als zweite GitHub-Pages-App veröffentlicht. Nur `assets/js/config.js` wird angepasst.

Alternativ können beide Gebäude über ein einziges GitHub-Pages-Repository laufen. Dann wird das Gebäude über feste Pfade ausgewählt:

```text
https://Rinderbuegen.github.io/vermietung/DGH/
https://Rinderbuegen.github.io/vermietung/Gemeindehaus/
```

Die GitHub-Action erzeugt diese Unterseiten automatisch aus derselben Codebasis. Ohne Pfad verwendet die App den Standardwert aus `assets/js/config.js`, aktuell `dgh_rb`.

## Dorfgemeinschaftshaus

```js
window.APP_CONFIG = {
  buildingId: "dgh_rb",
  appTitle: "Vermietung Dorfgemeinschaftshaus Rinderbügen",
  buildingName: "Dorfgemeinschaftshaus Rinderbügen",
  operatorName: "Betreiber Dorfgemeinschaftshaus Rinderbügen",
  contactEmail: "kontakt@example.com",
  apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  showPendingRequestsInOccupancy: true,
  publicShowBookingTitles: false
};
```

## Evangelisches Gemeindehaus

```js
window.APP_CONFIG = {
  buildingId: "ev_gem_rb",
  appTitle: "Vermietung Evangelisches Gemeindehaus Rinderbügen",
  buildingName: "Evangelisches Gemeindehaus Rinderbügen",
  operatorName: "Betreiber Evangelisches Gemeindehaus Rinderbügen",
  contactEmail: "kontakt@example.com",
  apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  showPendingRequestsInOccupancy: true,
  publicShowBookingTitles: false
};
```

## Hinweise Und Downloads Pflegen

Hinweise und PDF-Downloads werden im GitHub-Repository gepflegt, nicht in Google Drive und nicht im Sheet.

- PDFs: `downloads/dgh_rb/` oder `downloads/ev_gem_rb/`
- Hinweise: `news/dgh_rb/` oder `news/ev_gem_rb/`

Metadaten werden automatisch gelesen:

- PDF: Titel und Beschreibung aus den PDF-Properties.
- Markdown: Titel, Datum, Typ und Anzeigezeitraum aus Frontmatter.

Es gibt keine zusätzliche Download-Konfiguration in `Settings`.

Siehe `docs/github-content.md`.

## Belegung Pflegen

Bestätigte Buchungen und Sperrzeiten werden in `Bookings` gepflegt.

Ganzer Tag:

```text
from = 00:00
to   = 23:59
```

Normale Zeitfenster dürfen sich nicht überschneiden. Das Apps Script prüft Konflikte bei neuen Anfragen, blockiert sie aber nicht automatisch.

## Anfragen Bearbeiten

Neue Anfragen stehen im Tab `Requests`.

Der Betreiber entscheidet manuell:

- Bei Annahme eine Zeile in `Bookings` anlegen und Anfrage auf `approved` setzen.
- Bei Ablehnung Anfrage auf `rejected` setzen.
- Bei Stornierung Anfrage auf `cancelled` setzen.

## Datenschutz Und Impressum

Vor Veröffentlichung müssen die Platzhalter in `index.html` durch echte Angaben ersetzt oder ergänzt werden.

Empfohlen:

- Verantwortliche Stelle
- Kontaktadresse
- Zweck der Verarbeitung
- Speicherdauer
- Rechte der betroffenen Personen
- Hinweis, dass keine Tracking-Cookies genutzt werden
