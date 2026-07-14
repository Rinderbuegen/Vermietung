# Lokaler Demo-Server Unter Windows

`tools/demo-server.cmd` startet `tools/demo-server.ps1`, erzeugt die GitHub-Pages-Ausgabe und stellt sie mit `tools/Caddyfile` unter lokalem HTTPS bereit. mkcert erzeugt dafür eine lokale Zertifizierungsstelle und ein Zertifikat für `localhost` sowie die LAN-IP. So können beide Gebäudepfade, Service Worker und PWA-Funktionen auf dem Entwicklungsrechner und auf Mobilgeräten im privaten Netz geprüft werden.

## Schnell-Demo Gegen Vollständige Qualitätsmatrix

Die lokale Demo ist eine schnelle, manuelle Integrationsprüfung für Buildausgabe, HTTPS, Pfade, Service Worker und responsive Bedienung. Sie ersetzt nicht die vollständige Release-Qualitätsmatrix: API-Privacy, Migration, eingeschränktes Markdown, Cacheablauf, Fokusführung, XSS und Browserinteraktionen werden mit den Repository-Tests und einer Staging-Web-App geprüft.

Vor einem Release in dieser Reihenfolge ausführen:

```pwsh
python scripts/build-apps-script.py
python scripts/build-pages-site.py
python scripts/verify-pages-site.py
python tests/content-build.test.py
python tests/frontend-modules.test.py
python tests/configure-runtime.test.py
npm test
node tests/apps-script.test.js
node tests/service-worker.test.js
python tests/browser.test.py --browser chromium
python tests/browser.test.py --browser firefox
python tests/browser.test.py --browser webkit
python tests/pwa-browser.test.py
```

`tests/browser.test.py` bildet die Funktionsmatrix in Chromium, Firefox und WebKit ab. `tests/pwa-browser.test.py` läuft separat mit Chromium und echten Service Workern. `tools/test-demo.py` bleibt zusätzlich sinnvoll, prüft aber keine schreibenden Formulare und ist kein Ersatz für diese Matrix. Produktionssheets und die produktive `/exec`-URL gehören nicht in automatisierte Tests.

## Voraussetzungen

- Windows 10 oder Windows 11.
- `winget` aus dem Microsoft App Installer.
- Python 3, aufrufbar als `python`.
- Node.js, aufrufbar als `node`; GitHub Actions verwendet Node.js 22.
- Ein privates LAN für Tests mit anderen Geräten.
- Eine Google-Apps-Script-Web-App-URL, die mit `/exec` endet.

Playwright einmalig in der festgelegten Version mit allen drei Browsern installieren:

```pwsh
python -m pip install playwright==1.61.0
python -m playwright install chromium firefox webkit
```

Versionen prüfen:

```pwsh
winget --version
python --version
node --version
```

Fehlende Laufzeiten können beispielsweise installiert werden mit:

```pwsh
winget install --id Python.Python.3.13 -e
winget install --id OpenJS.NodeJS.LTS -e
```

Danach ein neues Terminal öffnen. `tools/demo-server.ps1` installiert fehlendes Caddy (`CaddyServer.Caddy`) und mkcert (`FiloSottile.mkcert`) automatisch über winget. Alternativ lassen sich beide vorab installieren:

```pwsh
winget install --id CaddyServer.Caddy -e
winget install --id FiloSottile.mkcert -e
```

## Apps-Script-URL Sicher Setzen

In PowerShell die URL als Sitzungs-Umgebungsvariable setzen. Sie gilt nur für dieses Terminal und wird beim Schließen entfernt:

```pwsh
$env:APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/.../exec"
```

In der klassischen Eingabeaufforderung entspricht dies:

```bat
set "APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/.../exec"
```

Nicht `setx` verwenden. Damit würde die URL dauerhaft im Benutzerprofil gespeichert. Die URL ist zwar später im ausgelieferten JavaScript sichtbar, soll aber nicht versehentlich in Shell-Profilen, Screenshots oder dem Repository landen.

> **Produktionswarnung:** Zeigt die Variable auf die produktive Apps-Script-Web-App, senden Buchungs- und Kontaktformulare echte Anfragen an die produktiven Google Sheets. Für Formular- und Playwright-Tests eine getrennte Apps-Script-Testbereitstellung mit Testtabellen verwenden. Ohne sichere Testumgebung nur lesende Funktionen prüfen.

Variable nach dem Test bei Bedarf vorzeitig entfernen:

```pwsh
Remove-Item Env:APPS_SCRIPT_WEB_APP_URL
```

## Server Starten

Im Repository-Stamm ausführen:

```pwsh
tools\demo-server.cmd
```

Das Startprogramm führt die lokalen Build- und Prüfschritte aus, bereitet Caddy und das mkcert-Zertifikat vor und zeigt die erreichbaren URLs an. Das Terminal muss geöffnet bleiben. Beenden mit `Strg+C`.

Standardmäßig wählt `-LanIPv4 auto` eine private IPv4-Adresse aus. Bei mehreren Netzwerkadaptern kann die richtige Adresse explizit angegeben oder LAN-Zugriff abgeschaltet werden:

```pwsh
tools\demo-server.cmd -LanIPv4 192.168.178.20
tools\demo-server.cmd -LanIPv4 none
```

Erlaubt sind `auto`, `none` oder eine private IPv4-Adresse aus `10.0.0.0/8`, `172.16.0.0/12` oder `192.168.0.0/16`.

Lokale URLs:

```text
https://localhost:8443/Vermietung/DGH/
https://localhost:8443/Vermietung/Gemeindehaus/
```

LAN-URLs, wobei `<LAN-IP>` durch die vom Startprogramm angezeigte IPv4-Adresse ersetzt wird:

```text
https://<LAN-IP>:8443/Vermietung/DGH/
https://<LAN-IP>:8443/Vermietung/Gemeindehaus/
```

Beispiel:

```text
https://192.168.178.20:8443/Vermietung/DGH/
https://192.168.178.20:8443/Vermietung/Gemeindehaus/
```

Die frühere Variante `python -m http.server` ist für diese Demo nicht mehr vorgesehen. Sie liefert nur HTTP und prüft weder die von GitHub Pages verwendete Basisstruktur `/Vermietung/` noch lokales Zertifikatsvertrauen zuverlässig.

## Firewall Und Privates LAN

Beim ersten Start kann Windows den Netzwerkzugriff für Caddy anfragen. Zugriff ausschließlich für **private Netzwerke** erlauben, nicht für öffentliche Netzwerke. Das aktive Windows-Netzwerkprofil muss ebenfalls `Privat` sein.

Für Mobiltests müssen Rechner und Gerät im selben LAN beziehungsweise WLAN sein. Gast-WLANs und manche Router aktivieren Client-Isolation; dann können Geräte einander trotz korrekter Firewall nicht erreichen. Eingehend wird TCP-Port `8443` benötigt. Keine Portweiterleitung im Router einrichten und den Demo-Server nicht aus dem Internet erreichbar machen.

## Lokale CA Auf Android Installieren

Mobilgeräte vertrauen der mkcert-CA nicht automatisch. Das CA-Verzeichnis zeigt folgender Befehl:

```pwsh
mkcert -CAROOT
```

Aus diesem Verzeichnis darf nur `rootCA.pem` auf das Testgerät übertragen werden, zum Beispiel über eine lokal kontrollierte Verbindung. **`rootCA-key.pem` niemals verteilen, hochladen, versenden oder in das Repository aufnehmen.** Der private Schlüssel ermöglicht das Signieren beliebiger Zertifikate, denen alle Geräte mit installierter CA vertrauen würden.

Die Android-Menünamen unterscheiden sich je nach Hersteller und Version. Typischer Ablauf:

1. `rootCA.pem` auf das Gerät übertragen.
2. `Einstellungen -> Sicherheit -> Verschlüsselung & Anmeldedaten -> Zertifikat installieren -> CA-Zertifikat` öffnen.
3. Warnhinweis bestätigen und `rootCA.pem` auswählen.
4. Eine LAN-URL im Browser öffnen und das Zertifikat prüfen.

Einige verwaltete Android-Geräte verbieten benutzerdefinierte CAs. Manche Apps ignorieren Benutzer-CAs; für den Browser kann die Verbindung trotzdem funktionieren.

CA nach dem Test entfernen:

1. `Einstellungen -> Sicherheit -> Verschlüsselung & Anmeldedaten -> Vertrauenswürdige Anmeldedaten` öffnen.
2. Unter `Nutzer` die lokale mkcert-CA auswählen und entfernen.
3. Die übertragene Datei `rootCA.pem` vom Gerät löschen.

## Lokale CA Auf iOS Oder iPadOS Installieren

1. Nur `rootCA.pem` kontrolliert auf das Gerät übertragen, beispielsweise per AirDrop.
2. Das geladene Profil unter `Einstellungen -> Profil geladen` oder `Einstellungen -> Allgemein -> VPN und Geräteverwaltung` installieren.
3. Unter `Einstellungen -> Allgemein -> Info -> Zertifikatsvertrauenseinstellungen` das volle Vertrauen für die mkcert-Root-CA aktivieren.
4. Eine LAN-URL in Safari öffnen und das Zertifikat prüfen.

CA nach dem Test entfernen:

1. Unter `Einstellungen -> Allgemein -> VPN und Geräteverwaltung` das mkcert-Profil entfernen.
2. Prüfen, dass unter `Zertifikatsvertrauenseinstellungen` kein Vertrauen mehr aktiviert ist.
3. Die übertragene Datei aus `Dateien` löschen.

## Build- Und Actions-Schritte

Der lokale Demo-Build orientiert sich an `.github/workflows/pages.yml`. Die maßgeblichen Repository-Dateien sind:

1. `scripts/build-apps-script.py` erzeugt das deploybare Backend; `scripts/build-pages-site.py` erzeugt scope-isolierte Inhaltsindizes und Seiten.
2. `scripts/build-pages-site.py` erzeugt `_site/` mit `DGH/` und `Gemeindehaus/`.
3. `scripts/verify-pages-site.py` prüft Scopes, Manifest, Icons, lokale Links und Service-Worker-Registrierung.
4. `tests/frontend-modules.test.py` und die Pages-Verifikation prüfen den nativen ESM-Graphen ab `assets/js/main.js`.
5. `tests/service-worker.test.js` prüft Cache- und Offline-Verhalten mit Node.js; `tests/pwa-browser.test.py` prüft echte Worker separat mit Chromium.
6. `scripts/configure-runtime.py` schreibt `APPS_SCRIPT_WEB_APP_URL` in die Laufzeitkonfiguration unter `_site/`.
7. `tools/demo-server.ps1` erzeugt mit mkcert Zertifikat und Schlüssel unter `tools/.certs/`.
8. `tools/Caddyfile` stellt `_site/` unter `/Vermietung/` auf Port `8443` bereit und definiert die Weiterleitungen und statischen 404-Antworten.

Die lokale Demo nutzt ausgewählte Build- und PWA-Prüfungen, bildet aber nicht die vollständige Qualitätsmatrix ab. Diese muss zusätzlich gemäß `README.md` beziehungsweise `.github/workflows/pages.yml` ausgeführt werden. GitHub Actions konfiguriert die URL aus dem Repository-Secret `APPS_SCRIPT_WEB_APP_URL` und lädt `_site/` anschließend als Pages-Artefakt hoch; lokal verwendet `tools/demo-server.cmd` stattdessen die Sitzungsvariable.

## Browser-Test

Nach jedem Build beide lokalen URLs in einem Browserfenster öffnen und mindestens prüfen:

- Seite lädt ohne Zertifikatswarnung und ohne Fehler in der Browser-Konsole.
- DGH und Gemeindehaus zeigen jeweils die richtige Gebäudekonfiguration.
- Navigation, Hinweise, Downloads und Belegung funktionieren.
- Manifest und Service Worker gehören zum jeweiligen Gebäudepfad.
- Responsive Darstellung funktioniert auf Desktop und Mobilgerät.
- Offline-Neuladen funktioniert erst, nachdem die Seite einmal online vollständig geladen wurde.
- Formulare nur gegen eine Testbereitstellung absenden.

Für LAN-Tests dieselben Punkte auf Android oder iOS über die LAN-IP prüfen. `localhost` auf dem Mobilgerät bezeichnet das Mobilgerät selbst und darf dort nicht verwendet werden.

## Playwright-Schnelltest

`tools/test-demo.py` prüft mit Chromium beide Gebäudeseiten, Secure Context, Gebäudekonfiguration, Manifest- und Service-Worker-Scopes, Weiterleitungen und 404-Antworten. Er ergänzt die Browsermatrix und den separaten PWA-Test, ersetzt sie aber nicht. Die Playwright-Installation für alle drei Browser steht unter Voraussetzungen.

Demo in einem Terminal laufen lassen und in einem zweiten Terminal testen:

```pwsh
python tools/test-demo.py
```

Für eine explizite LAN-Adresse:

```pwsh
python tools/test-demo.py --base-url "https://192.168.178.20:8443/Vermietung/"
```

Erfolg endet mit `Demo geprüft: Gebäudeseiten, HTTPS/PWA, Redirects und 404.`. Der automatisierte Test ignoriert Zertifikatsfehler bewusst und ersetzt daher nicht die manuelle Prüfung des CA-Vertrauens im Browser und auf Mobilgeräten. Schreibende Formulare werden nicht abgesendet.

## Grenzen Der Kompatibilität

Die lokale Demo bildet Build-Ausgabe, Pfade und HTTPS wesentlich genauer ab als ein einfacher HTTP-Server, garantiert aber keine 100-prozentige Übereinstimmung mit Produktion:

- Caddy ersetzt GitHub Pages, dessen CDN, Header, Cache und Deployment-Umgebung.
- mkcert nutzt eine private lokale CA; öffentlich vertrauenswürdige Produktionszertifikate verhalten sich anders.
- Betriebssysteme, Browser, installierte PWA-Modi und Service-Worker-Caches können abweichen.
- Verwaltete Geräte können Root-CA-Installation, PWA-Installation oder lokale Netzverbindungen sperren.
- Android und iOS unterstützen PWA-Funktionen und Installationsabläufe unterschiedlich.
- Apps Script, CORS, Netzwerkzugriff und Google-Sitzungen bleiben externe Produktions- oder Testdienste.
- Das Zertifikat gilt nur für die beim Erzeugen aufgenommenen Namen und IP-Adressen. Ändert sich die LAN-IP, muss es neu erzeugt werden.

Der finale Stand muss deshalb zusätzlich über die bereitgestellten GitHub-Pages-URLs und auf den tatsächlich unterstützten Zielgeräten geprüft werden.

### Aktualisierung auf 1.5.0

Der native ESM-Schnitt enthält keine Kompatibilitätsschicht für die entfernten klassischen Legacy-Frontendskripte alter installierter PWA-Versionen. Für eine vollständige Aktualisierung die installierte PWA online öffnen, alle noch geöffneten PWA-Fenster und Browser-Tabs schließen und die PWA anschließend neu öffnen. Erst ohne alte Clients kann der neue Service Worker übernehmen und alle ESM-Dateien konsistent ausliefern.

## Fehlerbehebung

### `APPS_SCRIPT_WEB_APP_URL` Fehlt Oder Ist Ungültig

Die Variable im selben Terminal setzen, in dem `tools/demo-server.cmd` gestartet wird. Die URL muss `https://script.google.com/macros/s/.../exec` entsprechen. Eine `/dev`-URL ist nicht gleichwertig mit der bereitgestellten `/exec`-URL.

### `python`, `node`, `caddy` Oder `mkcert` Nicht Gefunden

Installation und `PATH` mit den Versionsbefehlen aus dem Abschnitt Voraussetzungen prüfen. Nach einer winget-Installation das Terminal schließen und neu öffnen.

### Zertifikatswarnung Auf Dem Entwicklungsrechner

`mkcert -install` ausführen, Browser vollständig schließen und erneut starten. Danach prüfen, ob die aufgerufene Adresse im Zertifikat enthalten ist. Bei geänderter LAN-IP Server neu starten, damit ein passendes Zertifikat erzeugt wird.

### Mobilgerät Erreicht Den Server Nicht

LAN-IP statt `localhost` verwenden. Gleiches WLAN, privates Windows-Netzwerkprofil, TCP-Port `8443`, Firewall-Freigabe nur für private Netze und deaktivierte Client-Isolation prüfen.

### Mobilgerät Zeigt Eine Zertifikatswarnung

Installation und Vertrauen von `rootCA.pem` prüfen. Unter iOS reicht die Profilinstallation allein nicht; volles Vertrauen muss zusätzlich aktiviert werden. Stimmt die LAN-IP nicht mehr, Zertifikat neu erzeugen.

### Port `8443` Ist Belegt

Anderen Prozess beenden, der Port `8443` verwendet, und `tools/demo-server.cmd` erneut starten. Die dokumentierten URLs und Zertifikate sind auf diesen Port und Startablauf abgestimmt.

### Alte Inhalte Oder Falsches Gebäude

Zuerst die PWA online öffnen, alle alten PWA-Fenster und Browser-Tabs schließen und neu öffnen. Bleibt der Stand veraltet, Service Worker und Website-Daten für `localhost:8443` beziehungsweise die LAN-IP löschen, Browser schließen und Demo neu bauen. Prüfen, dass exakt `/Vermietung/DGH/` oder `/Vermietung/Gemeindehaus/` einschließlich abschließendem Schrägstrich geöffnet wurde.

### Build Oder Test Schlägt Fehl

Die erste Fehlermeldung im Terminal auswerten. Bei Inhaltsfehlern die Betreiberdateien unter `betreiber/` prüfen. Bei Pfad-, Manifest- oder Service-Worker-Fehlern `scripts/verify-pages-site.py` beziehungsweise `tests/service-worker.test.js` nicht überspringen; die lokale Demo soll nur eine vollständig geprüfte `_site/`-Ausgabe ausliefern. Meldet `tools/test-demo.py`, dass `playwright` fehlt, die beiden Installationsbefehle aus dem Abschnitt Playwright-Test ausführen.
