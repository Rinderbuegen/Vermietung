# Designsystem

## Ziel

Seriöse, ruhige Oberfläche für öffentliche Gebäudevermietung der Stadt Büdingen. Die App soll auf Smartphone und Desktop klar bedienbar sein und visuell zur Hauptseite stadt-buedingen.de passen.

## Prinzipien

- KISS: einfache Sektionen, keine komplexe Kalenderkomponente.
- Mobile-first: Formularfelder groß genug, Navigation bricht sauber um.
- Barrierearm: sichtbarer Fokus, ausreichende Kontraste, echte Labels.
- Vertrauenswürdig: gedämpfte Flächen, klare Statusfarben, wenig Dekoration.
- Datenschutzfreundlich: keine Tracker und keine privaten oder personenbezogenen Anfragedaten im öffentlichen Cache. Bewusst freigegebene öffentliche Veranstaltungsdetails dürfen für Offlinebetrieb höchstens 24 Stunden ab `cachedAt` gespeichert werden.
- Markenkonform: Farben, Schriften und Stilmittel von stadt-buedingen.de.

## Farben

Entnommen aus dem CSS von stadt-buedingen.de:

```css
/* Primärfarbe – Stadt-Büdingen Dunkelrot */
--color-primary: #6c0e15;
--color-primary-dark: #5a0b11;

/* Sekundärfarbe – dunkleres Rot für Submenüs, Akzente */
--color-secondary: #872323;

/* Header/Footer/Navigation */
--color-dark: #525151;
--color-dark-hover: #3e3e3e;

/* Flächen */
--color-bg: #ffffff;
--color-bg-page: #eaeaea;
--color-bg-muted: #f0f0f0;

/* Text */
--color-text: #666666;
--color-heading: #444444;
--color-link: #6c0e15;

/* Grenzen & dekorativ */
--color-border: #d8d2c6;

/* Statusfarben */
--color-success: #23aa23;
--color-warning: #c88700;
--color-error: #c20000;
--color-expired: #bbbbbb;
```

## Typografie

Schriftfamilie: **Open Sans** (Google Fonts, self-hosted auf stadt-buedingen.de).

Gewichte: 300 (Leicht), 400 (Regulär), 600 (Halbfett), 700 (Fett).

```css
font-family: 'Open Sans', sans-serif;
```

Fallback (falls Font nicht geladen):

```css
font-family: 'Open Sans', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Typografische Hierarchie

| Rolle | Größe | Gewicht | Farbe |
|---|---|---|---|
| body | 18px | 400 | `#666` |
| h1 (Unterseite) | ~48px (2.67em) | 300 | `#6c0e15` |
| h2 | ~34px (1.89em) | 700 | `#444` |
| h3 (Unterseite) | ~20px (1.11em) | 700 | `#6c0e15` |
| Buttons | 18px | 700 | #fff auf `#6c0e15` |
| Datum-Label | ~20px (1.11em) | 600 | #fff auf `#6c0e15` |

## Layout

- Standard-Wrapper: 1000px
- Header-Bereich: 1590px (volle Breite)
- Footer-Bereich: 1840px (volle Breite)
- Volle Breite als Option verfügbar (`pagewidth-full`)

## Komponenten

### Buttons

```css
.btn {
  background-color: #6c0e15;
  color: #fff;
  padding: 15px 20px;
  border: none;
  border-radius: 0;
  font-weight: 700;
  text-decoration: none;
}
```

- `button-primary`: Hauptaktion wie Anfrage senden.
- `button-secondary`: Nebenaktion wie Belegung ansehen.

### Panels / Karten

Weiße Karte mitrand und Schatten:

```css
.cards {
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
}
```

- Hover: `box-shadow: 0 5px 15px rgba(0, 0, 0, 0.25); background: #e0e0e0;`

### Listenelemente

- `list-item`: Belegung, Hinweis oder Download.
- Datum-Label: Hintergrund `#6c0e15`, Text weiß, eckig.
- Buchungsdetailkarte: eckiges Datum-Label, Zeit, Statusbadge und nur bei Freigabe die Blöcke „Veranstaltung“ und „Veranstalter“.
- `blocked` verwendet immer die rote Statusfarbe, auch als ganztägiger Kalenderstatus und in der Legende.

### Buchungsdetails und Dialog

- Belegte Tage öffnen einen nativen, eckigen `<dialog>`; freie Tage bleiben Buchungsaktionen.
- Der Dialog hat einen intern scrollenden Inhaltsbereich, bleibt innerhalb des Viewports und gibt den Fokus beim Schließen an den auslösenden Tagesbutton zurück.
- Bei einem Rerender ohne verbundenen Auslöser geht der Fokus auf die Belegungsansicht, ersatzweise auf deren Überschrift.
- Tagesbuttons haben mindestens 44 px Zielgröße. Bei 390 px Breite darf kein horizontaler Overflow entstehen.
- Kalenderstatus: ganztägig `blocked` vor ganztägig `confirmed`, danach `partial`, sonst `free`.

### Öffentliche Detailtexte

Freigegebene Veranstaltung und Veranstalter verwenden ausschließlich eingeschränktes Markdown. Erlaubt sind Absätze, einzelne Zeilenumbrüche, `**fett**`, `*kursiv*`, absolute `https:`-Links und `mailto:`-Links. Raw HTML, Bilder, Überschriften, Listen, Tabellen, Code, relative URLs sowie `http:`, `javascript:`, `data:` und `vbscript:` bleiben Text.

Der Renderer baut nur `p`, `br`, `strong`, `em`, `a` und den Screenreader-Hinweis als DOM-Knoten. HTTPS-Links erhalten `target="_blank"` und `rel="noopener noreferrer"` sowie den Hinweis „öffnet in einem neuen Tab“; `mailto:`-Links nicht.

### Statusanzeigen

```css
.booking-confirmed { background-color: #6c0e15; color: #fff; } /* belegt */
.booking-partial   { background: linear-gradient(135deg, #eee 0 50%, #6c0e15 50% 100%); } /* teilweise belegt */
.booking-free      { background-color: #eee; color: #444; }    /* frei */
.booking-blocked   { background-color: #c20000; color: #fff; } /* gesperrt */
.booking-expired { background-color: #bbb; color: #fff; }    /* abgelaufen */
```

### Formulare

- Eingabefelder: Hintergrund `#f0f0f0`, Rahmenlos.
- Platzhalter-Text: `#6d6d6d`.
- Fokus: sichtbarer Umriss.

## Statusfarben

- `frei`: hellgrau (`#eee`).
- `belegt`: Primärfarbe des Gebäudes, wie der Tabellen-Badge für bestätigte Belegung.
- `teilweise belegt`: diagonal geteilt, oben hellgrau wie frei, unten Primärfarbe wie belegt.
- `gesperrt`: rot (`#c20000`), nicht verfügbar.
- `abgelaufen`: grau (`#bbb`), nicht mehr gültig.

## Per-Gebäude-Design

Jedes Gebäude hat eigene Farben, die in `betreiber/<Bereich>/konfiguration/frontend.json` unter `theme` definiert und im Build vor dem CSS-Laden als CSS-Variablen injiziert werden. Layout und Typografie bleiben gleich.

### Farbzuordnung

| CSS-Variable | DGH (Dunkelrot) | ev_gem_rb (Lila) |
|---|---|---|
| `--color-primary` | `#6c0e15` | `#5c2583` |
| `--color-primary-dark` | `#5a0b11` | `#4a1d69` |
| `--color-secondary` | `#872323` | `#741cc0` |
| `--color-link` | `#6c0e15` | `#5c2583` |
| `--color-bg-page` | `#eaeaea` | `#f2ecfa` |
| `--color-bg-muted` | `#f0f0f0` | `#f2ecfa` |
| `--color-border` | `#d8d2c6` | `#e4cefa` |
| `--color-dark` | `#525151` | `#3d3050` |

### Farbquelle ev_gem_rb

Farben entnommen aus dem Designsystem der Evangelischen Kirchengemeinde Nidderbracht (`kirche-nidderbracht.ekhn.de`), Farbschema `purple`:

- `#5c2583` — Primärfarbe (Dunkellila)
- `#741cc0` — Sekundärfarbe (Mittellila)
- `#e4cefa` — Akzent/Border (Helllila)
- `#f2ecfa` — Hintergrund (Zierlila)

### Technische Umsetzung

1. Die Quellen `betreiber/allgemein/konfiguration/frontend.json` und `betreiber/<Bereich>/konfiguration/frontend.json` enthalten gemeinsame Werte beziehungsweise Gebäude-Overrides.
2. `scripts/build-pages-site.py` erzeugt je Root und Gebäudescope eine eigene `config/config.js` mit der aufgelösten Laufzeitkonfiguration und stabiler Gebäude-ID.
3. `index.html` lädt diese erzeugte Datei vor dem Stylesheet. Das folgende Inline-Script setzt die Theme-Werte per `document.documentElement.style.setProperty()`.
4. Das CSS (`app.css`) verwendet danach die überschriebenen Werte. Der Build liefert je Scope nur die aufgelöste `config/config.js` aus.

### Neues Gebäude hinzufügen

1. Neues Betreiberverzeichnis `betreiber/<Bereich>/` mit `konfiguration/frontend.json` anlegen.
2. Die Zuordnung aus URL-Pfad und Gebäude-ID in `betreiber/allgemein/konfiguration/registry.json` ergänzen.
3. Farbwerte in der Tabelle oben dokumentieren.

## Navigation

- Hauptnavigation: Großbuchstaben, Hover-Farbe `#6c0e15`.
- Dropdown-Hintergrund: `#6c0e15` (volle Breite, mit weißen Links).
- Fixierte Navigation beim Scrollen: Hintergrund `#525151`.

## Rechtliches

Datenschutz und Impressum sind sichtbar integriert. Die Texte sind Platzhalter und müssen vor Veröffentlichung durch Betreiberangaben ersetzt werden.
