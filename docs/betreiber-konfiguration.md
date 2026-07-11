# Betreiber-Konfiguration

## Eine App Für Mehrere Gebäude

Beide Gebäude laufen über ein einziges GitHub-Pages-Repository. Das Gebäude wird über feste Pfade ausgewählt:

```text
https://Rinderbuegen.github.io/Vermietung/DGH/
https://Rinderbuegen.github.io/Vermietung/Gemeindehaus/
```

Die GitHub-Action erzeugt diese Unterseiten automatisch aus derselben Codebasis. Ohne Pfad verwendet die App den Standardpfad aus `config/config.js`, aktuell `DGH`.

## Globale Konfiguration

Datei: `config/config.js`

```js
window.APP_CONFIG = {
  apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  publicShowBookingTitles: false
};

window.APP_BUILDING_CONFIG = {
  defaultPath: "DGH",
  buildingIdByPath: {
    DGH: "dgh_rb",
    Gemeindehaus: "ev_gem_rb"
  }
};
```

Diese Datei enthält gemeinsame technische Werte und das Mapping von URL-Pfad zu `buildingId`.

## Dorfgemeinschaftshaus

Datei: `config/DGH/config.js`

```js
Object.assign(window.APP_CONFIG || (window.APP_CONFIG = {}), {
  buildingId: "dgh_rb",
  appTitle: "Vermietung Dorfgemeinschaftshaus Rinderbügen",
  buildingName: "Dorfgemeinschaftshaus Rinderbügen",
  heroTitle: "Dorfgemeinschaftshaus",
  heroLocation: "Rinderbügen",
  operatorName: "Betreiber Dorfgemeinschaftshaus Rinderbügen",
  contactDetails: "Kuno van Euten<br/>Außenstellenbeauftragter<br/>0161/123123123123<br/>kuno@example.com",
  contactEmail: "kontakt@example.com"
});
```

## Evangelisches Gemeindehaus

Datei: `config/Gemeindehaus/config.js`

```js
Object.assign(window.APP_CONFIG || (window.APP_CONFIG = {}), {
  buildingId: "ev_gem_rb",
  appTitle: "Vermietung Evangelisches Gemeindehaus Rinderbügen",
  buildingName: "Evangelisches Gemeindehaus Rinderbügen",
  heroTitle: "Evangelisches Gemeindehaus",
  heroLocation: "Rinderbügen",
  operatorName: "Betreiber Evangelisches Gemeindehaus Rinderbügen",
  contactDetails: "Kuno van Euten<br/>Küster<br/>0161/123123123123<br/>kuno@example.com",
  contactEmail: "kontakt@example.com"
});
```

Der Kontakt im Hero-Kasten wird über `contactDetails` in der jeweiligen Gebäudedatei gepflegt. Mehrere Zeilen können mit `<br/>` getrennt werden. E-Mail-Zeilen werden automatisch als `mailto:`-Link ausgegeben.

`contactEmail` bleibt als einfache E-Mail-Adresse für Fallbacks erhalten. Der Sheet-Wert `Buildings.contact_email` ist nur Fallback, falls in der statischen Konfiguration kein Kontaktwert gepflegt ist.

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

Die öffentliche Belegung zeigt ausschließlich Einträge aus `Bookings`. Offene Buchungsanfragen aus `Requests` werden weder tabellarisch noch im Belegungsplan angezeigt.

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
