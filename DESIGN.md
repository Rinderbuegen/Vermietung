# Designsystem

## Ziel

Seriöse, ruhige Oberfläche für öffentliche Gebäudevermietung. Die App soll auf Smartphone und Desktop klar bedienbar sein und nicht wie ein generisches Marketing-Template wirken.

## Prinzipien

- KISS: einfache Sektionen, keine komplexe Kalenderkomponente.
- Mobile-first: Formularfelder groß genug, Navigation bricht sauber um.
- Barrierearm: sichtbarer Fokus, ausreichende Kontraste, echte Labels.
- Vertrauenswürdig: gedämpfte Flächen, klare Statusfarben, wenig Dekoration.
- Datenschutzfreundlich: keine Tracker, keine personenbezogenen Daten im öffentlichen Cache.

## Farben

```css
--color-bg: #f7f5f0;
--color-bg-muted: #eee8dc;
--color-surface: #ffffff;
--color-text: #1f2933;
--color-muted: #5f6b76;
--color-primary: #254f6e;
--color-primary-dark: #18384f;
--color-accent: #b7791f;
--color-border: #d8d2c6;
--color-success: #2f6f4e;
--color-error: #9b2c2c;
--color-warning: #8a5a00;
```

## Typografie

Systemschrift wird bewusst verwendet, damit GitHub Pages ohne externe Font-Requests und ohne Datenschutzrisiko funktioniert.

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

## Komponenten

- `button-primary`: Hauptaktion wie Anfrage senden.
- `button-secondary`: Nebenaktion wie Belegung ansehen.
- `panel`: weiße Karte mit Rand und Schatten.
- `list-item`: Belegung, Hinweis oder Download.
- `status-label`: öffentliche Statusanzeige.
- `form-message`: Erfolg oder Fehler nach Formularversand.

## Statusfarben

- `belegt`: grün, bestätigt.
- `gesperrt`: rot, nicht verfügbar.
- `angefragt`: gelb, noch nicht bestätigt.
- Offline: gelb mit erklärendem Text.

## Rechtliches

Datenschutz und Impressum sind sichtbar integriert. Die Texte sind Platzhalter und müssen vor Veröffentlichung durch Betreiberangaben ersetzt werden.
