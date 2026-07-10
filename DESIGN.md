# Designsystem

## Ziel

Seriöse, ruhige Oberfläche für öffentliche Gebäudevermietung der Stadt Büdingen. Die App soll auf Smartphone und Desktop klar bedienbar sein und visuell zur Hauptseite stadt-buedingen.de passen.

## Prinzipien

- KISS: einfache Sektionen, keine komplexe Kalenderkomponente.
- Mobile-first: Formularfelder groß genug, Navigation bricht sauber um.
- Barrierearm: sichtbarer Fokus, ausreichende Kontraste, echte Labels.
- Vertrauenswürdig: gedämpfte Flächen, klare Statusfarben, wenig Dekoration.
- Datenschutzfreundlich: keine Tracker, keine personenbezogenen Daten im öffentlichen Cache.
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

- Standard-Wrapper: 1330px
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

### Statusanzeigen

```css
.booking-vacant  { background-color: #23aa23; color: #fff; } /* belegt/verfügbar */
.booking-short   { background-color: #c88700; color: #fff; } /* knapp */
.booking-reserved { background-color: #c20000; color: #fff; } /* gesperrt/reserviert */
.booking-expired { background-color: #bbb; color: #fff; }    /* abgelaufen */
```

### Formulare

- Eingabefelder: Hintergrund `#f0f0f0`, Rahmenlos.
- Platzhalter-Text: `#6d6d6d`.
- Fokus: sichtbarer Umriss.

## Statusfarben

- `belegt`: grün (`#23aa23`), bestätigt.
- `gesperrt`: rot (`#c20000`), nicht verfügbar.
- `angefragt`: gelb/orange (`#c88700`), noch nicht bestätigt.
- `abgelaufen`: grau (`#bbb`), nicht mehr gültig.

## Navigation

- Hauptnavigation: Großbuchstaben, Hover-Farbe `#6c0e15`.
- Dropdown-Hintergrund: `#6c0e15` (volle Breite, mit weißen Links).
- Fixierte Navigation beim Scrollen: Hintergrund `#525151`.

## Rechtliches

Datenschutz und Impressum sind sichtbar integriert. Die Texte sind Platzhalter und müssen vor Veröffentlichung durch Betreiberangaben ersetzt werden.
