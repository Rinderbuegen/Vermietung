# Implementierungsplan 1.7.0: Zugriffspolicy, DGH-Login und konfigurierbare Sektionen

## 1. Status, Zweck und Ziel

**Status: nur geplant, nicht implementiert.** Dieses Dokument ist die vollständige Übergabe für einen neuen Kontext. Es beschreibt die beabsichtigte Feature-Umsetzung, enthält aber weder Implementierung noch ausgeführte Tests.

Ausgangsversion ist **1.6.1**. Die Umsetzung ist ein Feature und hebt die Anwendung auf **1.7.0** an.

Zweck der Änderung:

- Die Anwendung erhält genau zwei fachliche Rollen: `unknown` und `admin`.
- Das Dorfgemeinschaftshaus, Gebäude-ID `dgh_rb`, wird bis auf die Rechtstexte vollständig durch ein Login geschützt.
- Das Evangelische Gemeindehaus, Gebäude-ID `ev_gem_rb`, bleibt standardmäßig öffentlich. Jede seiner acht Sektionen kann jedoch zentral auf `no`, `all` oder `admin` gesetzt werden.
- Frontend und Apps-Script-Backend verwenden dieselbe zentrale Policyquelle.
- Das Backend bleibt die Sicherheitsautorität. Eine manipulierte öffentliche `config.js` darf keine Backendaktion freischalten.
- Phase 1 baut Authentifizierung und Autorisierung vollständig auf, erweitert aber keine fachlichen Admin-Daten. Erfolgreiche fachliche Antworten sind für `unknown` und `admin` in Phase 1 inhaltlich identisch.

## 2. Verbindliche Ausgangslage

- Das Frontend ist eine statische GitHub-Pages-PWA ohne Bundler.
- `assets/js/main.js` ist der Composition Root eines nativen Browser-ESM-Graphen.
- `config/config.js` ist ein klassisches, vor dem ESM-Einstieg geladenes Buildprodukt und setzt `window.APP_CONFIG`.
- Das Apps-Script-Backend wird aus `apps-script/buchungs-api/Code.template.gs` und Betreiberwerten generiert.
- `apps-script/buchungs-api/Code.gs` ist ein Buildprodukt und darf nicht manuell editiert werden.
- Root entspricht dem DGH und verwendet `buildingId: "dgh_rb"`, registriert aber keinen Service Worker.
- `/DGH/` verwendet `buildingId: "dgh_rb"` und einen scope-eigenen Service Worker.
- `/Gemeindehaus/` verwendet `buildingId: "ev_gem_rb"` und einen scope-eigenen Service Worker.
- Der bestehende Belegungscache nutzt `occupancy:v3:<buildingId>:<from>:<to>` und persistiert nur die öffentliche Projektion.
- Bestehende Backendaktionen sind `building`, `occupancy`, `createBookingRequest` und `createContactRequest`.
- Das Backend liefert weiterhin JSON-Envelopes der Form `{ "ok": true, "data": ..., "message": ... }` beziehungsweise `{ "ok": false, "error": "...", "message": "..." }`.

## 3. Sicherheitsgrenze und akzeptierte Restrisiken

### 3.1 Tatsächliche Sicherheitsgrenze

Die Sicherheitsgrenze liegt ausschließlich im Apps-Script-Backend. Das Frontend-Gate dient Bedienung, Sichtbarkeit und Datenminimierung, ist aber keine Zugriffskontrolle gegen einen technisch versierten Benutzer.

- Jede geschützte Apps-Script-Aktion muss serverseitig anhand der generierten Backendpolicy und gegebenenfalls des Tokens autorisiert werden.
- `config.js`, DOM, CSS, JavaScriptmodule, News-JSON, Download-JSON, About-Markdown, PDFs und andere GitHub-Pages-Dateien sind öffentlich abrufbar und manipulierbar.
- `no` bedeutet: Sektion nicht anzeigen, ihren Feature-/Teillifecycle nicht starten, keine zugehörigen Laufzeit-Fetches oder Listener aktivieren und die zugeordnete Backendaktion mit `FEATURE_DISABLED` ablehnen. `no` bedeutet nicht, Module oder andere Dateien aus dem Buildartefakt zu entfernen.
- Der bestehende statische ESM-Graph bleibt erhalten. Auch Module deaktivierter Sections können statisch geladen und vollständig durch den Service Worker precached werden; ohne gestarteten Lifecycle dürfen sie keine fachlichen Seiteneffekte auslösen.
- Ein manipuliertes `config.js` kann statische UI sichtbar machen, aber keine vom Backend gesperrte Aktion erlauben.
- Tokens und Passwörter dürfen nie in URL, Querystring, Fragment, `Authorization`-Header, Logs, Fehlertexte, GitHub-Secrets für Benutzerkonten oder öffentliche Betreiberdateien gelangen.

### 3.2 Bewusst akzeptierte Restrisiken

- Bereits durch Version 1.6.1 in einen Service-Worker- oder `localStorage`-Cache gelangte öffentliche Belegungsdaten können einer rein offline bleibenden Altinstallation nicht nachträglich entzogen werden. Solange diese Installation nie wieder online geht, ist sie durch 1.7.0 technisch unwiderrufbar.
- Beim ersten Onlinekontakt mit 1.7.0 werden DGH-Belegungscaches frühestmöglich gelöscht. Das reduziert, aber beseitigt nicht das vorherige Offline-Risiko.
- Statische DGH-Assets und statische Inhalte bleiben direkt abrufbar. Das Produkt verspricht nur ein Laufzeit-Gate, keine vertrauliche Auslieferung statischer Dateien.
- `sessionStorage` schützt nicht gegen aktives JavaScript auf derselben Origin. Das Projekt setzt deshalb weiterhin voraus, dass keine fremden Skripte und keine XSS-Lücke eingebracht werden.
- Passwörter liegen gemäß Produktentscheidung im Klartext in Apps-Script Script Properties. Sie liegen nicht im Repository, sind aber für Personen mit ausreichendem Zugriff auf das Apps-Script-Projekt sichtbar.
- Ein abgebrochener HTTP-Request kann serverseitig bereits verarbeitet worden sein. `AbortController` verhindert veraltetes Rendern und weitere Clientverarbeitung, garantiert aber insbesondere bei schreibenden Aktionen keine serverseitige Stornierung.
- Ein durch einen clientseitig abgebrochenen oder überholten Login erzeugtes, dem Browser nicht mehr bekanntes Token kann bis zur Cacheverwerfung oder maximal vier Stunden bestehen. Es wurde nicht offengelegt und bleibt an das Gebäude gebunden.
- Mehrere Tabs dürfen getrennte Tokens besitzen. Logout widerruft nur das aktuell verwendete Token, nicht alle Sitzungen eines Benutzers.

## 4. Zentrale Zugriffspolicy

### 4.1 Neue Quelle

Neue einzige fachliche Policyquelle:

`betreiber/allgemein/konfiguration/access.json`

Vorgeschlagener vollständiger Inhalt für Version 1.7.0:

```json
{
  "schemaVersion": 1,
  "defaults": {
    "page": "all",
    "sections": {
      "start": "all",
      "occupancy": "all",
      "request": "all",
      "news": "all",
      "downloads": "all",
      "contact": "all",
      "about": "all",
      "legal": "all"
    }
  },
  "buildings": {
    "dgh_rb": {
      "page": "admin",
      "sections": {
        "legal": "all"
      }
    },
    "ev_gem_rb": {
      "page": "all",
      "sections": {}
    }
  }
}
```

Semantik des Schemas:

| Feld | Typ | Erlaubte Werte | Regel |
|---|---|---|---|
| `schemaVersion` | Integer | exakt `1` | Andere oder fehlende Version ist ungültig. |
| `defaults.page` | String | `all`, `admin` | Standard für jede Gebäudeseite. |
| `defaults.sections` | Objekt | exakt acht Schlüssel | Muss jede Section genau einmal enthalten. |
| `buildings` | Objekt | Schlüssel sind Gebäude-IDs | Schlüsselmenge muss exakt Registry und Backendkonfiguration entsprechen. |
| `buildings.<id>.page` | String, optional | `all`, `admin` | Überschreibt `defaults.page`. |
| `buildings.<id>.sections` | Objekt, optional | Teilmenge der acht Sections | Überschreibt einzelne Section-Defaults. |
| Section-Wert | String | `no`, `all`, `admin` | Andere Typen oder Werte sind ungültig. |

Der Parser akzeptiert keine unbekannten Felder, keine doppelten JSON-Schlüssel, keine zusätzlichen Sections, keine fehlenden Default-Sections und keine stillschweigende Typkonvertierung. `null`, Booleans, Zahlen und anders geschriebene Werte sind ungültig.

### 4.2 Verbindliche Section-IDs

Die Schlüssel sind unabhängig von sichtbaren deutschen DOM-IDs stabil:

| Policy-Section | Aktuelle DOM-Sektion | Inhalt |
|---|---|---|
| `start` | `#start` | Hero, Gebäudedaten, Einstieg |
| `occupancy` | `#belegung` | Belegung, Detailsdialog und Druck |
| `request` | `#anfrage` | Buchungsanfrage |
| `news` | `#hinweise` | Hinweise und News |
| `downloads` | `#downloads` | Downloadliste |
| `contact` | `#kontakt` | Kontaktformular |
| `about` | `#ueber` | Über-Inhalt |
| `legal` | `#rechtliches` | Impressum und Datenschutz |

`legal` ist eine normale konfigurierbare Section im Schema, muss in 1.7.0 aber nach vollständiger Auflösung für jedes Gebäude zwingend `all` sein. Der Build bricht ab, wenn `legal` zu `no` oder `admin` aufgelöst wird. Diese zusätzliche 1.7.0-Invariante schützt die Erreichbarkeit der Rechtstexte und kann erst durch eine spätere bewusste Produktentscheidung geändert werden.

### 4.3 Policypräzedenz

Die Auflösung erfolgt deterministisch in dieser Reihenfolge:

1. `defaults.page` und alle Werte aus `defaults.sections` bilden die Basis.
2. `buildings.<buildingId>.page` überschreibt den Page-Wert, sofern vorhanden.
3. `buildings.<buildingId>.sections.<section>` überschreibt den jeweiligen Section-Wert, sofern vorhanden.
4. Der vollständig aufgelöste Section-Wert `no` gewinnt immer und sperrt die Section auch für `admin`.
5. Für alle Sections außer `legal` gilt anschließend das strengere Ergebnis aus Page- und Section-Gate: `admin`, sobald entweder `page` oder Section `admin` verlangt; sonst `all`.
6. `legal: all` ist die ausdrückliche Ausnahme vom Page-Gate. Die Rechtstexte bleiben daher auch bei `page: admin` anonym sichtbar.
7. Eine fehlende oder ungültige Policy schaltet alle funktionalen Sections und alle Backendfachaktionen fail closed. Nur der statische Rechtstext und eine Konfigurationsfehlermeldung bleiben im Frontend sichtbar.

Damit ergibt sich für die geplante Konfiguration:

| Gebäude | Page | Anonym sichtbar | Nach gültigem Login sichtbar |
|---|---|---|---|
| `dgh_rb` | `admin` | nur `legal`, Gate und Loginmöglichkeit | alle acht Sections |
| `ev_gem_rb` | `all` | alle acht Sections | alle acht Sections, fachlich gleiche Daten wie anonym |

### 4.4 Gemeinsamer Validator und ID-Invariante

Ein neues Pythonmodul `scripts/access_policy.py` soll Parsing, Validierung und Auflösung zentral bereitstellen. Sowohl `scripts/build-pages-site.py` als auch `scripts/build-apps-script.py` müssen es verwenden; keine duplizierte Policylogik in zwei Builds.

Der Validator liest gemeinsam:

- `betreiber/allgemein/konfiguration/access.json`
- `betreiber/allgemein/konfiguration/registry.json`
- `betreiber/allgemein/backend/konfiguration.json`

Folgende Mengen müssen exakt gleich sein:

```text
set(access.buildings.keys())
== set(registry.areas[*].buildingId)
== set(backendConfig.buildings.keys())
```

Zusätzliche Bedingungen:

- Jede Registry-Gebäude-ID ist eindeutig.
- `registry.defaultArea` existiert in `registry.areas`.
- Jeder Area-Eintrag besitzt genau einen nicht leeren `buildingId` und einen gültigen `publicPath`.
- Kein Gebäude fehlt in einer der drei Quellen; kein unbekanntes Gebäude wird toleriert.
- Der Root erhält exakt die vollständig aufgelöste Policy der `defaultArea`, aktuell also DGH.
- Jeder Scope erhält in `config.js` nur seine vollständig aufgelöste Policy, nicht die Policies anderer Gebäude.
- Das Backend erhält eine vollständig aufgelöste Map für alle Gebäude.
- Validierungsfehler brechen Build und Generator mit einer konkreten Meldung und ungleich null ab. Es wird kein teilweise aktualisiertes Artefakt als gültig betrachtet.
- Die Frontend-Laufzeit validiert die aufgelöste Policy nochmals strikt. Das ersetzt nicht die Backendprüfung.
- Das Backend prüft die injizierte Policy beim Dispatch fail closed. Unbekannte oder unvollständige Policy ergibt `CONFIGURATION_ERROR` und ruft keinen Fachhandler auf.

Geplante Buildprodukte:

```js
// Je Scope in config/config.js, Beispiel DGH
window.APP_CONFIG = {
  // bestehende Werte bleiben erhalten
  buildingId: "dgh_rb",
  accessPolicy: {
    schemaVersion: 1,
    page: "admin",
    sections: {
      start: "all",
      occupancy: "all",
      request: "all",
      news: "all",
      downloads: "all",
      contact: "all",
      about: "all",
      legal: "all"
    }
  }
};
```

```js
// In generiertem Code.gs
const ACCESS_POLICY = {
  schemaVersion: 1,
  buildings: {
    dgh_rb: {
      page: "admin",
      sections: {
        start: "all",
        occupancy: "all",
        request: "all",
        news: "all",
        downloads: "all",
        contact: "all",
        about: "all",
        legal: "all"
      }
    },
    ev_gem_rb: {
      page: "all",
      sections: {
        start: "all",
        occupancy: "all",
        request: "all",
        news: "all",
        downloads: "all",
        contact: "all",
        about: "all",
        legal: "all"
      }
    }
  }
};
```

## 5. Architektur- und Dateiinventar

### 5.1 Neue Dateien und Module

| Datei | Aufgabe |
|---|---|
| `betreiber/allgemein/konfiguration/access.json` | Einzige fachliche Quelle für Page- und Sectionpolicy. |
| `scripts/access_policy.py` | Strikter Parser, Drei-Quellen-ID-Abgleich und vollständige Policyauflösung. |
| `assets/js/domain/access-policy.js` | Reine, DOM-unabhängige Runtime-Prüfung der aufgelösten Policy und Auswertung des effektiven Sectionzugriffs. |
| `assets/js/infrastructure/auth-session.js` | Gebäudespezifische `sessionStorage`-Sitzung, Ablaufprüfung, `clearIfToken` und Authzustand. |
| `assets/js/features/auth-feature.js` | Login-/Logout-/Validierungsablauf, Dialog, Rate-Limit-Anzeige und Request-Races. |
| `assets/js/features/access-control.js` | Policyentscheidung, Gate, Section-/Navigationssichtbarkeit, Deep-Link und Feature-Orchestrierung. |
| `tests/access-policy.test.py` | Policyparser, Präzedenz, ID-Abgleich und Build-Fail-Closed. |
| `tests/access-policy.test.js` | Reine Runtime-Policyprüfung und rollenabhängige Sectionauswertung. |
| `tests/auth-session.test.js` | Browser-Sitzung, Ablauf und token-genaues Löschen. |
| `tests/auth-feature.test.js` | Login, Validate, Logout, Dialog und Auth-Races. |
| `tests/access-control.test.js` | Page-/Sectionentscheidung, Gate, Deep-Link und Rollenverlust. |
| `tests/feature-lifecycle.test.js` | Start, Stop, Clear, Reload, Abort und Generation über alle Featuretypen. |

Die genaue Aufteilung der Testdateien darf bei der Umsetzung an vorhandene Test-Utilities angepasst werden. Die fachlichen Fälle aus Abschnitt 12 bleiben verbindlich.

### 5.2 Bestehende Dateien mit geplanten Änderungen

| Datei | Geplante Änderung |
|---|---|
| `scripts/build-pages-site.py` | Policy validieren/auflösen, Scopepolicy in `config.js` schreiben, Root-DGH-Regel prüfen. |
| `scripts/build-apps-script.py` | Dieselbe Policy validieren und als `ACCESS_POLICY` in das Template injizieren. |
| `scripts/verify-pages-site.py` | Vollständige Scopepolicy, Rootpolicy, Modulgraph, Flash-Schutz und Scopeisolation prüfen. |
| `scripts/configure-runtime.py` | Sicherstellen, dass nur `apiBaseUrl` ersetzt wird und Policy unverändert bleibt. |
| `apps-script/buchungs-api/Code.template.gs` | Authentifizierung, Sessionverwaltung, Rate-Limit, zentraler Dispatcher und Autorisierung. |
| `apps-script/buchungs-api/Code.gs` | Ausschließlich neu generieren; nie manuell ändern. |
| `assets/js/config/runtime-config.js` | Laufzeitkonfiguration unveränderlich kopieren und Policyprüfung an `domain/access-policy.js` delegieren. |
| `assets/js/infrastructure/apps-script-client.js` | Auth-POSTs, tokenisierte Reads/Writes, Fehlercodes und Abortsignale. |
| `assets/js/infrastructure/occupancy-cache.js` | DGH-Purge/No-op-Verhalten und garantierte öffentliche Projektion für Gemeindehaus. |
| `assets/js/infrastructure/content-repository.js` | Abortsignale konsequent an News, Downloads und About weiterreichen. |
| `assets/js/main.js` | Composition Root mit statischen Imports sowie zentraler Auth-, Access-, Lifecycle- und Generationsorchestrierung. |
| `assets/js/features/site-shell.js` | Abbrechbarer Remote-Reload, Clear und generationssicherer Rollenwechsel. |
| `assets/js/features/occupancy/controller.js` | `clear`/`suspend`, Rollenwechsel, Cachepolicy und Generation. |
| `assets/js/features/occupancy/view.js` | Fachanzeige und offenen Belegungsdialog vollständig leeren/schließen. |
| `assets/js/features/occupancy/print.js` | Drucksnapshot und Druckzustand bei Rollenverlust verwerfen. |
| `assets/js/features/request-forms.js` | Bestehendes Modul erhalten und intern separat steuerbare Buchungs-/Kontakt-Lifecycles mit eigenen Requests, Generationen und Listenern ergänzen. |
| `assets/js/features/content.js` | Bestehendes Modul erhalten und intern separat steuerbare News-/Downloads-/About-Lifecycles ergänzen. Keine generische Factory erzwingen. |
| `index.html` | Access-Metadaten, Gate, Login-/Logout-UI, Dialog, Fokusziele und flash-sichere Grundstruktur. |
| `assets/css/app.css` | Pending-/Gate-/Dialog-/Hidden-/Inert-Zustände, responsive Darstellung und sichtbarer Fokus gemäß `DESIGN.md`. |
| `betreiber/allgemein/texte/frontend.json` | Deutsche Login-, Logout-, Gate-, Session- und Fehlertexte. |
| `betreiber/DGH/texte/frontend.json` | Nur erforderliche DGH-spezifische Überschreibungen. |
| `betreiber/EV_GEMEINDEHAUS/texte/frontend.json` | Nur erforderliche Gemeindehaus-spezifische Überschreibungen. |
| `tests/apps-script.test.js` | Backendpolicy, Login, Rate-Limit, Session und Dispatch. |
| `tests/apps-script-client.test.js` | Transportvertrag, Token und Fehlercodes. |
| `tests/occupancy-cache.test.js` | Vollständiger DGH-Purge und Gemeindehaus-Phase-1-Persistenz. |
| `tests/request-forms.test.js` | Auf intern getrennte Formularlifecycles und Rollenwechsel erweitern. |
| `tests/content-repository.test.js` | Abort und getrennte Loads. |
| `tests/frontend-modules.test.py` | Bestehenden statischen ESM-Graph und erlaubte Modulgrenzen einschließlich neuem Domainmodul prüfen. |
| `tests/content-build.test.py` | Policyabhängigkeit ändert keine öffentliche Dateiauswahl. |
| `tests/configure-runtime.test.py` | Policy bleibt bei URL-Konfiguration byte-/wertgleich. |
| `tests/browser.test.py` | Gesamte Rollen-, Section-, Dialog-, Deep-Link- und Browsermatrix. |
| `tests/pwa-browser.test.py` | Echter 1.6.1-zu-1.7.0-Upgrade, DGH-Purge, Offline-Gate und Scopeisolation. |
| `tests/service-worker.test.js` | Nachweisen, dass Workerlogik unverändert bleibt und neue Assets nur precached werden. |
| `package.json` | Version `1.7.0`; neue Node-Tests in `npm test` aufnehmen. |
| `.github/workflows/pages.yml` | Nur falls ein neuer eigenständiger Python-Testbefehl nötig ist; Qualitätsreihenfolge beibehalten. |
| `README.md` | Version, Rollen-/Policybetrieb, Cache- und Abschlusskommandos. |
| `PROJEKTUEBERSICHT.md` | Architekturstand 1.7.0, Authgrenze, Policies und Lifecycle. |
| `DESIGN.md` | Login-Dialog, Gate, Fokus, Statusdarstellung und responsive Regeln. |
| `betreiber/README.md` | Pflege von `access.json`, Werte und fail-closed Validierung. |
| `docs/betreiber-konfiguration.md` | Schema, Präzedenz, Beispiele und `legal`-Invariante. |
| `docs/apps-script-deployment.md` | Script Properties, Staging, Wartungsfenster und Backend-zuerst-Rollout. |
| `apps-script/README.md` | Neue Aktionen und Einrichtung der Script Properties. |

### 5.3 Bewusst unveränderte Bereiche

- `service-worker.js` bleibt logisch unverändert. Buildhash und statische Assetliste ändern sich automatisch durch neue Dateien.
- `apps-script/buchungsverwaltung/Code.gs` erhält in Phase 1 keine Rollen- oder Datenänderung.
- Sheet-Schemas, Migration V1.3 und öffentliche Occupancy-Felder ändern sich nicht.
- Die erzeugten Dateien unter `_site/` werden weiterhin nur durch den Build erstellt und nicht als manuelle Quelle gepflegt.

## 6. Backend-Authentifizierung

### 6.1 Zugangsdaten

Die drei Konten liegen ausschließlich in den Script Properties des standalone Apps-Script-Projekts:

```text
user_peter      = <Klartextpasswort>
user_moni       = <Klartextpasswort>
user_edeltraut  = <Klartextpasswort>
```

Regeln:

- Keine dieser Properties wird in GitHub Secrets, Repositorydateien, `config.js` oder Logs gespiegelt.
- Zulässige Benutzernamen sind exakt `peter`, `moni` und `edeltraut` nach Normalisierung.
- `username` und `password` müssen echte Strings sein. Andere Typen, insbesondere Zahlen, Objekte, Arrays, Booleans und `null`, ergeben `LOGIN_INVALID`; es gibt keine implizite Konvertierung mit `String(...)`.
- Vor jeder Normalisierung gelten harte Eingabegrenzen: roher Benutzername 1 bis 64 Zeichen, rohes Passwort 1 bis 256 Zeichen. Eine Überschreitung ergibt `LOGIN_INVALID`, bevor ein Property- oder Rate-Key gebildet wird.
- Der Benutzername wird danach mit `trim().toLowerCase()` normalisiert und muss vollständig `[a-z0-9]{1,32}` entsprechen. Ein syntaktisch ungültiger Name ergibt `LOGIN_INVALID`, ohne einen frei geformten Property- oder Rate-Key anzulegen.
- Das Passwort wird mit `trim().toLowerCase()` normalisiert und muss nach `trim()` 1 bis 256 Zeichen lang sein. Benutzername und Passwort werden case-insensitiv verglichen.
- Fehlt die Property eines bekannten Benutzers oder ist sie leer, ist das eine Betreiberfehlkonfiguration: `CONFIGURATION_ERROR`.
- Ein unbekannter, aber syntaktisch gültiger normalisierter Benutzername und ein falsches Passwort ergeben nach Rate-Prüfung einheitlich `LOGIN_INVALID`. Leere, falsch typisierte, überlange oder syntaktisch ungültige Eingaben ergeben ebenfalls `LOGIN_INVALID`, erzeugen aber keinen unbeschränkten Runtime-Key.
- Passwörter, normalisierte Passwörter und Tokens werden nie protokolliert.

### 6.2 Rate-Limit

Rate-Limit-Schlüssel ist für syntaktisch gültige Benutzernamen exakt `auth_rate:<buildingId>:<username>`, wobei `<username>` bereits normalisiert und durch `[a-z0-9]{1,32}` begrenzt ist. Die Verwaltung muss atomar unter `LockService.getScriptLock()` erfolgen.

Vorgesehener Vertrag:

- Fehlversuche 1 bis 4: Zähler erhöhen, Antwort `LOGIN_INVALID`.
- Fünfter Fehlversuch: Login ablehnen, Zähler auf 5 setzen, `lockedUntil = now + 15 Minuten` setzen, für diesen fünften Versuch noch `LOGIN_INVALID` liefern.
- Jeder weitere Versuch vor `lockedUntil`, auch mit nun richtigem Passwort: ohne Passwortprüfung `LOGIN_RATE_LIMIT` liefern.
- Nach Ablauf der 15 Minuten den Zustand entfernen und wieder bei Versuch 1 beginnen.
- Erfolgreicher Login vor einer Sperre entfernt den Zähler vollständig.
- Gebäude werden getrennt gezählt.
- Unterschiedlich geschriebene oder mit Leerzeichen versehene Namen teilen nach Normalisierung denselben Zähler.
- Weil exakt 15 Minuten Sperre zugesagt sind, liegen Rate-Einträge in Script Properties und nicht im vorzeitig verwerfbaren ScriptCache. Unter dem Präfix `auth_rate:<buildingId>:<username>` stehen ausschließlich temporäre Runtime-Metadaten wie Fehlversuchszähler, `lockedUntil` und erforderlicher Aktualisierungszeitpunkt; niemals Passwort, Token oder anderer Secretwert.
- Abgelaufene Rate-Einträge werden beim nächsten relevanten Zugriff gelöscht, erfolgreiche Logins löschen den zugehörigen Eintrag sofort. Credential-Properties `user_*` bleiben logisch und namensmäßig vollständig getrennt und dürfen durch Bereinigung oder Rate-Updates nie verändert werden.
- Lock immer in `finally` freigeben. Ein Lock-/Storagefehler darf keinen Login erlauben, sondern endet fail closed.

### 6.3 Session

- Ein erfolgreicher Login erzeugt mit `Utilities.getUuid()` ein zufälliges Bearer-Token.
- Das Token wird serverseitig ausschließlich in `CacheService.getScriptCache()` gespeichert.
- Cacheeintrag enthält mindestens `buildingId`, `role: "admin"` und absolutes `expiresAt`.
- TTL ist vier Stunden ab Login; keine Verlängerung durch Nutzung in Phase 1.
- Vor jedem Cachezugriff muss das Token syntaktisch als kanonische UUID validiert werden. Der minimale namespaced Cache-Key lautet exakt `auth_session:<uuid>`; es wird kein zusätzlicher Hash oder Digest berechnet.
- Das Token ist an genau eine `buildingId` gebunden. Verwendung für ein anderes Gebäude ergibt `AUTH_INVALID`.
- ScriptCache darf Einträge vor Ablauf verwerfen. Dann ist die Sitzung sofort ungültig und eine neue Anmeldung nötig.
- Mehrere Logins und Tabs dürfen gleichzeitig mehrere Tokens erzeugen.
- `logout` entfernt nur den Cacheeintrag des im Request verwendeten Tokens.
- `validateSession` ist eine eigene Aktion und darf nicht durch `building` ersetzt werden, weil `start` auf `no` stehen kann und statische Adminsections trotzdem eine Sitzungsprüfung brauchen.

Erfolgsantworten:

```json
{
  "ok": true,
  "data": {
    "role": "admin",
    "token": "<uuid>",
    "expiresAt": 1784217600000
  },
  "message": "OK"
}
```

`validateSession` liefert kein neues Token:

```json
{
  "ok": true,
  "data": {
    "role": "admin",
    "expiresAt": 1784217600000
  },
  "message": "OK"
}
```

`logout` liefert:

```json
{
  "ok": true,
  "data": {
    "role": "unknown"
  },
  "message": "OK"
}
```

## 7. Zentrale Backendautorisierung

### 7.1 Dispatcher statt Handler-Einzelentscheidungen

`doGet` und `doPost` müssen über eine zentrale, deklarative Aktionsregistrierung dispatchen. Kein Fachhandler trifft eigene, möglicherweise abweichende Rollenentscheidung.

Jeder Registryeintrag definiert mindestens:

- Aktionsname
- erlaubte Transportart
- zugeordnete Section oder `auth`
- Read/Write/Auth-Klasse
- Handler

Zentrale Reihenfolge je Request:

1. Request sicher parsen; POST ausschließlich aus `e.postData.contents`.
2. Aktion gegen die feste Aktionsregistry prüfen; unbekannt bleibt `UNKNOWN_ACTION`.
3. `buildingId` mit bestehender Backendkonfiguration prüfen; unbekannt bleibt `VALIDATION_ERROR`.
4. Injizierte Policy und Policy für das Gebäude strikt prüfen; Fehler ergibt `CONFIGURATION_ERROR`.
5. Bei Fachaktionen Sectionpolicy auflösen. `no` ergibt sofort `FEATURE_DISABLED`, auch mit gültigem Admin-Token.
6. Aus Page- und Sectionpolicy den erforderlichen Zugriff bestimmen; `legal` hat keine Backendfachaktion.
7. Für eine geschützte Aktion fehlendes Token als `AUTH_REQUIRED` und vorhandenes, aber ungültiges Token als `AUTH_INVALID` ablehnen.
8. Bei erlaubter öffentlicher Aktion Rolle `unknown`, bei gültigem Token Rolle `admin` an den Handlerkontext geben.
9. Erst danach den Fachhandler ausführen.

### 7.2 Aktions-zu-Section-Matrix

| Aktion | Transport anonym | Transport authentifiziert | Policybereich | Besonderheit |
|---|---|---|---|---|
| `login` | `POST text/plain` | nicht nötig | `auth` | Immer öffentlich für eine gültige Gebäude-ID, auch bei Page `admin`. |
| `validateSession` | nicht sinnvoll | `POST text/plain` | `auth` | Token validieren, unabhängig von `start`. |
| `logout` | nicht sinnvoll | `POST text/plain` | `auth` | Nur verwendetes Token widerrufen. |
| `building` | `GET`, falls effektiv `all` | `POST text/plain` mit Token | `start` | Erfolgsdaten in Phase 1 unverändert. |
| `occupancy` | `GET`, falls effektiv `all` | `POST text/plain` mit Token | `occupancy` | Erfolgsdaten bleiben ausschließlich öffentliche Projektion. |
| `createBookingRequest` | `POST text/plain`, falls effektiv `all` | `POST text/plain` mit Token | `request` | DGH erfordert ab 1.7.0 zwingend Login. |
| `createContactRequest` | `POST text/plain`, falls effektiv `all` | `POST text/plain` mit Token | `contact` | DGH erfordert ab 1.7.0 zwingend Login. |

Statische Sections `news`, `downloads`, `about` und `legal` besitzen keine Apps-Script-Aktion. Ihre Policy wird im Frontend beachtet. Direkte statische URLs bleiben öffentlich.

Authentifizierte Reads laufen immer über POST. GET verarbeitet nie ein Token und akzeptiert weder Query-Token noch Auth-Header. Für DGH ergibt ein anonymer GET auf `building` oder `occupancy` `AUTH_REQUIRED`. Für Gemeindehaus bleiben diese GETs bei `all` kompatibel.

### 7.3 Fehlersemantik

Neue Fehler verwenden weiterhin das bestehende Fehler-Envelope und fachlich stabile Codes:

| Code | Wann | Vorgeschlagene Meldung | Clientfolge |
|---|---|---|---|
| `FEATURE_DISABLED` | Section ist `no` | `Diese Funktion ist für dieses Gebäude deaktiviert.` | Feature nicht starten beziehungsweise leeren; Token behalten. |
| `AUTH_REQUIRED` | Geschützte Aktion ohne Token | `Für diese Funktion ist eine Anmeldung erforderlich.` | DGH-Gate/Login anbieten; vorhandene andere Session nicht pauschal löschen. |
| `AUTH_INVALID` | Token unbekannt, abgelaufen, falsch gebunden oder ungültig | `Die Sitzung ist ungültig oder abgelaufen. Bitte melden Sie sich erneut an.` | Nur `clearIfToken(requestToken)`; Rollenverlust verarbeiten. |
| `LOGIN_INVALID` | Loginname/Passwort ungültig, einschließlich fünftem Fehlversuch | `Benutzername oder Passwort ist ungültig.` | Dialog offen lassen; Passwortfeld leeren/fokussieren. |
| `LOGIN_RATE_LIMIT` | Bereits aktivierte 15-Minuten-Sperre | `Zu viele fehlgeschlagene Anmeldungen. Bitte versuchen Sie es später erneut.` | Dialog offen lassen, keine Sessionänderung. |
| `CONFIGURATION_ERROR` | Policy oder bekannte Credential-Property fehlt/ist ungültig | `Die Zugriffskonfiguration ist ungültig. Die Funktion bleibt gesperrt.` | Fail closed, keine Fachaktion, keine falsche Freigabe. |

Wichtige Prioritäten:

- `no` liefert bei Fachaktionen immer `FEATURE_DISABLED`, auch bei gültigem Admin-Token.
- Ein fehlendes Token ist `AUTH_REQUIRED`; ein mitgesendetes, aber nicht gültiges Token ist `AUTH_INVALID`.
- Ein Transportfehler ist kein `AUTH_INVALID` und widerruft/löscht keine Sitzung.
- Vorhandene Codes wie `VALIDATION_ERROR`, `UNKNOWN_ACTION`, `SCHEMA_ERROR`, `MAINTENANCE` und `SERVER_ERROR` bleiben für ihre bisherigen Fälle erhalten.
- Der Client muss `payload.error` als konkreten `AppsScriptClientError.code` erhalten. Er darf neue Codes nicht pauschal zu `API_ERROR` reduzieren.
- Erfolgreiche Datenfelder von `building`, `occupancy`, `createBookingRequest` und `createContactRequest` bleiben unverändert.

## 8. Frontend-Auth und Access Control

### 8.1 Zustandsmodell

Der serverseitige Rollenname bleibt `unknown`. Das Frontend verwendet für den UI-Lifecycle genau diese Zustände:

| Frontendzustand | Bedeutung |
|---|---|
| `anonymous` | Keine aktuell serverseitig bestätigte Adminsession. Entspricht fachlich Rolle `unknown`. |
| `validating` | Lokal vorhandenes Token wird online geprüft oder ein Login läuft. Keine Adminfreigabe. |
| `admin` | Token wurde für aktuelle `buildingId` online bestätigt. |

Es gibt keinen optimistischen Adminzustand aus `sessionStorage`. Insbesondere DGH wird erst nach erfolgreicher Onlinevalidierung entsperrt.

### 8.2 `auth-session.js`

Speicherschlüssel:

```text
auth-session:v1:<buildingId>
```

Gespeicherter JSON-Wert enthält ausschließlich:

```json
{
  "token": "<uuid>",
  "expiresAt": 1784217600000
}
```

Regeln:

- Kein Benutzername, Passwort, Rollenname oder fachliche Daten im Storage.
- `sessionStorage` ist pro Browser-Tab und Origin. Root und `/DGH/` verwenden wegen gleicher Origin und gleicher `buildingId` bei Navigation im selben Tab dieselbe Sitzung.
- Mehrere Tabs dürfen getrennte Tokens haben.
- Ungültiges JSON, fehlendes Token, ungültiger Ablaufwert oder lokal abgelaufene Sitzung werden verworfen.
- `clearIfToken(expectedToken)` liest den aktuellen Eintrag und löscht nur, wenn dessen Token exakt `expectedToken` entspricht.
- Eine verspätete `AUTH_INVALID`-Antwort eines alten Requests darf dadurch niemals ein inzwischen neu gesetztes Login löschen.
- Transportfehler bei `validateSession` behalten den gespeicherten Token. DGH bleibt gesperrt; Gemeindehaus bleibt in seinen öffentlichen Bereichen nutzbar. Bei einem späteren `online`-Ereignis darf erneut validiert werden.

### 8.3 API-Client

Der Client erhält Tokenzugriff per injizierter Sessionfunktion, nicht durch eine globale Variable.

Neue Methoden:

```text
login({ username, password }, { signal })
validateSession(token, { signal })
logout(token, { signal })
```

Bestehende Methoden erhalten einen expliziten Authkontext oder lesen den aktuellen Token zum Start des Requests und frieren genau dieses Requesttoken ein.

- Öffentliche Reads: GET ohne Token.
- Authentifizierte Reads: POST `text/plain;charset=utf-8` mit JSON-Body und Token.
- Öffentliche Writes des Gemeindehauses: POST `text/plain;charset=utf-8` ohne Token.
- DGH-Writes und sonstige authentifizierte Writes: POST mit Token.
- Token nie in URL oder Header.
- Jeder abortbare Request erhält ein Signal.
- Der ausgelöste Fehler trägt den exakten Backendcode.
- Bei `AUTH_INVALID` ruft die zentrale Authschicht `clearIfToken(requestToken)` auf. Einzelne Features löschen keine Session selbst.

Beispielbody eines authentifizierten Reads:

```json
{
  "action": "occupancy",
  "buildingId": "dgh_rb",
  "token": "<uuid>",
  "from": "2026-07-01",
  "to": "2026-07-31"
}
```

### 8.4 Flash-Schutz

- Das HTML startet in einem neutralen `access-pending`-Zustand.
- Alle acht policygesteuerten Bereiche und ihre Navigationslinks tragen stabile `data-access-section`-Marker.
- CSS blendet im Pendingzustand alle funktionalen Bereiche aus. `legal`, eine noscript-/Konfigurationsmeldung und die Gatefläche bleiben erreichbar.
- Erst die strikt validierte Laufzeitpolicy und der Authzustand entfernen Pending für jeweils erlaubte Sections.
- DGH-Inhalte werden nie kurz vor der Sessionvalidierung sichtbar.
- Bei fehlender oder manipulierter Policy bleiben Funktionsbereiche verborgen; es erfolgt keine Rückkehr zu den öffentlichen Defaults im Browser.
- `hidden` wird für Sichtbarkeit genutzt; wo ein übergeordneter Bereich während Übergängen im DOM bleibt, zusätzlich `inert`, damit keine versteckten Fokusziele erreichbar sind.

### 8.5 DGH-Gate

- Fehlt beim DGH ein lokales Token, öffnet der Login-Dialog beim Start sofort.
- Ist die lokale Session bereits abgelaufen oder syntaktisch ungültig, wird sie entfernt und der Login-Dialog automatisch geöffnet.
- Ist ein lokal gültiges Token vorhanden und der Browser online, startet sofort `validateSession`; der Login-Dialog bleibt währenddessen geschlossen. Das Gate zeigt zugänglich den Status „Anmeldung wird geprüft“, Adminbereiche bleiben gesperrt und werden bei Erfolg direkt ohne Dialog entsperrt.
- Antwortet die Onlinevalidierung mit `AUTH_INVALID`, löscht `clearIfToken` exakt das geprüfte Token und öffnet danach automatisch den Login-Dialog.
- Ist der Browser offline und ein lokal noch nicht abgelaufenes Token vorhanden, bleibt DGH gesperrt. Das Gate zeigt einen Online-Hinweis und startet weder `validateSession` noch einen Loginrequest.
- Der Loginbutton darf den Dialog auch offline öffnen. Ein Submit wird vor dem API-Aufruf mit einer verständlichen Offlinemeldung abgelehnt; es wird kein sinnloser Loginrequest gesendet.
- Escape darf den Login-Dialog schließen.
- Nach Escape bleibt das Anwendungsgate bestehen und zeigt eine klar beschriftete Schaltfläche zum erneuten Öffnen des Login-Dialogs.
- `legal` bleibt außerhalb des Anwendungsgates sichtbar und über einen direkten Link erreichbar.
- Rollenverlust leert alle DGH-Fachbereiche, schließt Fachdialoge, verwirft Druckdaten und führt keinen anonymen Fachreload aus.
- Logout entfernt das aktuelle Token, führt in denselben gesperrten Zustand zurück und öffnet den Login-Dialog wegen des nun fehlenden Tokens automatisch; der Fokus folgt dem Dialogvertrag.

### 8.6 Gemeindehaus und Admin-Deep-Link

- Alle `all`-Sections bleiben für `anonymous` sichtbar und funktionsfähig.
- Eine `admin`-Section bleibt bis zu erfolgreicher Validierung verborgen.
- Führt der initiale Hash oder ein späterer Hashwechsel auf eine `admin`-Section, öffnet Access Control den Login-Dialog und merkt sich das Ziel.
- Nach erfolgreichem Login wird die Section geladen, sichtbar gemacht und erst danach zum gemerkten Ziel navigiert beziehungsweise dessen Überschrift fokussiert.
- Bei Escape oder Loginfehler bleibt das Ziel gemerkt, aber es erfolgt keine Navigation in einen versteckten Bereich.
- Ein Deep-Link auf `no` öffnet keinen Login, sondern meldet die nicht verfügbare Funktion und setzt den Fokus auf einen sicheren sichtbaren Bereich.
- Bei Rollenverlust leert Gemeindehaus nur Sections, die ihren Adminzugriff verloren haben.
- Weiterhin sichtbare Read-Sections werden anonym neu geladen, damit kein ehemals authentifizierter Requestzustand weiterverwendet wird.
- Öffentliche Formularwerte des Gemeindehauses werden bei einem Rollenverlust nicht unnötig gelöscht. Nur ein tatsächlich verborgenes Adminformular wird geleert.

### 8.7 Dialog, Fokus und ARIA

- Nativer `<dialog>` gemäß bestehendem Designsystem, keine neue UI-Bibliothek.
- Dialog besitzt sichtbare Überschrift, `aria-labelledby`, beschriftete Benutzername-/Passwortfelder, Statusbereich `role="status"` oder bei Fehlern `role="alert"` und eine sichtbare Schließenmöglichkeit.
- Benutzername verwendet passendes `autocomplete="username"`, Passwort `autocomplete="current-password"`.
- Beim Öffnen Fokus auf Benutzername, sofern leer; sonst auf Passwort.
- Bei `LOGIN_INVALID` Passwortfeld leeren und fokussieren, Benutzername erhalten.
- Bei `LOGIN_RATE_LIMIT` Fokus im Dialog halten und Meldung eindeutig ausgeben.
- Während eines Loginversuchs Submit gegen Doppelklick sperren und Ladezustand zugänglich benennen.
- Nach erfolgreichem Login Fokus auf gemerktes Deep-Link-Ziel, sonst auf erste neu freigegebene Hauptüberschrift.
- Nach Escape Fokus zum auslösenden Loginbutton zurückgeben.
- Bei DGH-Autostart ohne Auslöser fällt der Rückgabefokus auf die Gate-Schaltfläche.
- Logoutschaltfläche nur im Zustand `admin` anzeigen und eindeutig mit Gebäude/Sitzung beschriften.
- Bei Rollenverlust darf Fokus nicht in einer gerade verborgenen Section oder einem geschlossenen Fachdialog verbleiben.

## 9. Feature-Lifecycle und Race-Sicherheit

### 9.1 Grundvertrag

`main.js` behält den vorhandenen statischen ESM-Graphen und statische Imports. Die zentrale Orchestrierung startet nach Policy und Rolle nur erlaubte Feature- beziehungsweise Teillifecycles. Bei `no` bleibt die Section verborgen, ihr Lifecycle wird nicht gestartet und es entstehen keine zugehörigen Laufzeit-Fetches oder Listener. Alle Module bleiben Teil des Builds und des vollständigen Service-Worker-Precaches.

Jedes Feature erhält einen klaren Lifecycle, sinngemäß:

```text
start(context)
reload(context)
clear(reason)
dispose()
```

Nicht jedes Feature muss alle Methoden öffentlich anbieten, aber folgende Invarianten gelten:

- Jeder Start/Reload trägt eine monoton steigende Access-/Authgeneration.
- Jeder Remote-Request erhält einen eigenen `AbortController`.
- Ein neuer Loginversuch bricht den vorherigen Loginrequest ab und erhöht die Logingeneration.
- Ein Rollen-/Policywechsel bricht betroffene Reads ab und erhöht die Featuregeneration.
- Eine Antwort darf nur rendern, wenn Signal nicht abgebrochen, Feature noch aktiv, Generation unverändert und Section weiterhin erlaubt ist.
- `dispose` entfernt Listener und Timer und bricht Requests ab.
- Abort ist nur Clientkontrolle. Eine Schreibaktion kann serverseitig trotz Abort erfolgreich abgeschlossen sein.

### 9.2 Site Shell

`site-shell` trennt statische Konfiguration von remote geladenen Gebäudedaten.

- `start` wendet sichere statische Scopewerte an.
- `reload` lädt `building` mit passendem anonymen oder authentifizierten Transport.
- Der Request ist abortbar und generationsgesichert.
- `clearRemote` entfernt ausschließlich remote übernommene Werte und stellt sichere statische Scopewerte wieder her.
- Bei DGH-Rollenverlust kein anonymer `building`-Reload.
- Bei Gemeindehaus-Rollenverlust und weiterhin sichtbarem `start` anonymer Reload.
- Ist `start: no`, wird der Remotehandler nie aufgerufen; `validateSession` funktioniert trotzdem separat.

### 9.3 Occupancy

- `clear` bricht den laufenden Read ab, erhöht Generation, setzt Payload/Range/Stale-Status zurück und leert View/Meta.
- `clear` verwirft den Drucksnapshot und deaktiviert Druck.
- `clear` schließt den Belegungsdetaildialog und setzt Fokus auf ein noch sichtbares, sinnvolles Ziel.
- Bei DGH-Rollenverlust keine Cachelesung und kein anonymer Reload.
- DGH verwendet ab 1.7.0 keinen Belegungscache, weder Lesen noch Schreiben.
- Gemeindehaus darf in Phase 1 den öffentlichen Cache weiterverwenden.
- Auch bei Adminantworten wird vor Persistenz nochmals durch `normalizeOccupancyPayload` ausschließlich die öffentliche Projektion geschrieben.
- Wird `occupancy` von `admin` zu anonym sichtbar herabgestuft, erst alten Zustand leeren, dann anonym neu laden.
- Zeitraum-/Ansichtswechsel, Authwechsel und Dispose dürfen sich durch Abort plus Generation nicht gegenseitig überschreiben.

### 9.4 Buchungs- und Kontaktanfrage getrennt

- Das bestehende Modul `request-forms.js` bleibt erhalten. Es stellt intern separat steuerbare Lifecycles für Buchungsformular und Kontaktformular bereit; keine neuen Featuredateien und keine generische Factory sind erforderlich.
- Buchungs- und Kontakt-Teillifecycle besitzen eigene Listener, Pendingzustände, Abortcontroller und Generationen und können unabhängig gestartet, geleert und beendet werden.
- `request` steuert nur die Buchungsanfrage.
- `contact` steuert Kontaktformular und seine fachliche Aktion.
- Bei DGH-Rollenverlust beide betroffenen Formulare leeren, Statusmeldungen entfernen und Submit abbrechen; es folgt kein anonymer Submit/Reload.
- Bei Gemeindehaus-Rollenverlust bleiben Werte eines weiterhin öffentlichen Formulars erhalten.
- Wird ein Gemeindehausformular von `admin` auf nicht erlaubt herabgestuft, dessen sensible Eingaben leeren.
- Eine überholte Submitantwort darf UI, Formular oder Session nicht verändern.
- Nach Abort darf nicht behauptet werden, die Anfrage sei serverseitig storniert. Bei unklarem Ausgang soll die UI eine neutrale erneute Prüfung statt blindem automatischem Resubmit ermöglichen.
- Der bestehende Occupancy-Reload nach erfolgreicher Buchungsanfrage erfolgt nur, wenn Occupancy zu diesem Zeitpunkt erlaubt und dieselbe Generation aktiv ist.

### 9.5 News, Downloads und About getrennt

- Das bestehende Modul `content.js` bleibt erhalten. Es stellt intern separat steuerbare Lifecycles für `news`, `downloads` und `about` bereit; keine neuen Featuredateien und keine generische Factory sind erforderlich.
- Jeder Content-Teillifecycle lädt nur seinen eigenen Index beziehungsweise Markdowninhalt.
- Jeder Content-Teillifecycle besitzt eigenen Abortcontroller, Generation und `clear`.
- `downloads: no` lädt weder Downloadindex noch erzeugt Links im DOM; die PDFs bleiben direkt öffentlich erreichbar.
- `news: no` lädt keinen Newsindex.
- `about: no` lädt weder Aboutindex noch Markdown.
- Ein Fehler in einer Contentsection blockiert die anderen nicht.
- Bei Rollenverlust wird nur eine verlorene Adminsection geleert. Weiterhin öffentliche Sections werden bei Bedarf anonym neu geladen.

### 9.6 Generationskoordination

Es werden mindestens drei monotone Generationen unterschieden:

- Authgeneration: ändert sich bei Login, Validate, Logout, Tokenwechsel und Rollenverlust.
- Accessgeneration: ändert sich, sobald die effektiv sichtbare Sectionmenge neu berechnet wird.
- Featuregeneration: ändert sich bei jedem Start, Reload, Clear und Dispose des konkreten Features.

Ein asynchrones Ergebnis darf nur committen, wenn alle beim Start eingefrorenen relevanten Generationen noch übereinstimmen. Das gilt auch dann, wenn `abort()` im verwendeten Mock, Browser oder bereits laufenden Serverhandler keine Wirkung mehr hatte.

## 10. Cache- und PWA-Regeln

### 10.1 DGH-Purge

Beim frühestmöglichen 1.7.0-Modulbootstrap wird unabhängig vom sichtbaren Scope versucht, alle DGH-Belegungseinträge aus `localStorage` zu löschen:

```text
occupancy:v3:dgh_rb:*
occupancy:v2:dgh_rb:*
occupancy:dgh_rb:*
```

Das globale Löschen der bekannten DGH-Präfixe ist beabsichtigt: Root, `/DGH/` und `/Gemeindehaus/` liegen auf derselben Origin, und ein Besuch eines beliebigen 1.7.0-Scopes soll alte DGH-Daten bereinigen.

- Purge vor Erstellung oder Start des Occupancy-Features ausführen.
- Storagefehler abfangen, aber DGH trotzdem ohne Cache fortsetzen.
- Keine Gemeindehauskeys löschen.
- DGH-Cacheadapter danach als No-op behandeln: `read` liefert nichts, `write` schreibt nichts.
- Root übernimmt wegen `dgh_rb` dieselbe No-op-Regel.

### 10.2 Gemeindehaus Phase 1

- `occupancy:v3:ev_gem_rb:*` bleibt bis maximal 24 Stunden nutzbar.
- Persistiert wird immer nur die bestehende öffentliche Projektion `date`, `from`, `to`, `allDay`, `status`, `statusKey`, `publicTitle`, `publicOrganizer`.
- Admin- und Unknown-Antworten sind in Phase 1 fachlich identisch.
- Vor Phase 2, sobald irgendein privates Adminfeld eingeführt wird, muss authentifizierte Persistenz generell entfallen. Diese Vorbedingung ist in Codekommentar und Dokumentation festzuhalten; sie ist kein Phase-1-Feature.

### 10.3 Service Worker und Root

- `service-worker.js` bleibt funktional unverändert. Er fängt nur same-origin GETs innerhalb seines Scopes ab; Apps-Script-POSTs und externe Apps-Script-GETs werden nicht gecacht.
- Neue Module und geänderte statische Dateien ändern nur die generierte Assetliste und den Inhaltshash.
- `/DGH/` bleibt offline als statische Hülle verfügbar, aber immer gegatet. Kein lokales Token entsperrt sie offline.
- `/Gemeindehaus/` bleibt mit öffentlichen, precached statischen Inhalten und gegebenenfalls öffentlichem Occupancy-Cache offline nutzbar.
- Root registriert weiterhin keinen Service Worker und entfernt weiterhin eine alte Rootregistrierung über die bestehende PWA-Registrierungslogik.
- Root und `/DGH/` teilen die Sitzung über `buildingId`, nicht über Pfad oder einen zweiten Schlüssel.

## 11. Schrittweise Implementierungsreihenfolge

Jeder Schritt ist klein zu halten und direkt mit nahen Tests abzuschließen. Keine große Sammeländerung ohne Zwischenprüfung.

- [ ] 1. Aktuellen Branch, `git status`, Version 1.6.1, vorhandene Tests und aktuelle Dateien erneut prüfen; keine fremden Änderungen überschreiben.
- [ ] 2. Passende Skills laden: `codebase-memory`, `frontend-design`, `google-apps-script`, `pwa-development`, `webapp-testing`.
- [ ] 3. `access.json` mit dem exakt dokumentierten Schema anlegen.
- [ ] 4. `scripts/access_policy.py` mit duplicate-key-sicherem JSON-Parsing, Typprüfung, erlaubten Werten und vollständiger Auflösung implementieren.
- [ ] 5. Drei-Quellen-ID-Abgleich und `legal: all`-Invariante ergänzen.
- [ ] 6. `tests/access-policy.test.py` für gültige Defaults/Overrides und alle Fail-Closed-Fälle schreiben und ausführen.
- [ ] 7. `build-pages-site.py` an den zentralen Resolver anbinden und vollständig aufgelöste Scopepolicy in `config.js` schreiben.
- [ ] 8. Root explizit gegen die aufgelöste Policy von `registry.defaultArea` prüfen.
- [ ] 9. `build-apps-script.py` an denselben Resolver anbinden und einen neuen Templateplatzhalter für die vollständige Backendpolicy injizieren.
- [ ] 10. Buildtests für fehlende, zusätzliche und widersprüchliche Gebäude-IDs ergänzen und ausführen.
- [ ] 11. `assets/js/domain/access-policy.js` als reine Runtimeprüfung und Auswertung der vollständig aufgelösten Policy implementieren; keine DOM-, Storage- oder Netzwerkabhängigkeit einführen.
- [ ] 12. `tests/access-policy.test.js` für exakte Schlüssel, Werte, Rollenentscheidung, Page-/Sectionpräzedenz und `legal`-Ausnahme schreiben und ausführen.
- [ ] 13. `runtime-config.js` an das Domainmodul anbinden, die geprüfte Policy unveränderlich übernehmen und keine Browserdefaults bei Fehlern verwenden.
- [ ] 14. Runtime-Config-Tests für Einbindung, Freeze und ungültige Policy ergänzen.
- [ ] 15. Im Apps-Script-Template zuerst reine Policyresolver und die Aktionsregistry implementieren, noch ohne Loginhandler.
- [ ] 16. `doGet`/`doPost` auf zentralen Dispatch umstellen und bestehende Erfolgsverträge unverändert halten.
- [ ] 17. Backendtests für `FEATURE_DISABLED`, Page-Gate, Section-Gate, `legal`-Ausnahme ohne Handler und Dispatcherprioritäten ergänzen.
- [ ] 18. Strenge Credentialtypisierung, rohe Längenlimits, Username-Regex, Normalisierung und Script-Property-Lookup für die drei festen Benutzer implementieren.
- [ ] 19. Atomaren Rate-Limit-Zustand unter ScriptLock mit Keys `auth_rate:<buildingId>:<username>` implementieren, einschließlich Bereinigung und exaktem Verhalten des fünften und sechsten Versuchs.
- [ ] 20. Backendtests für Typen, harte Längenlimits, Username-Regex, Trim, Case-Insensitivität, Gebäudeisolation, Lockfreigabe, getrennte Properties und 15-Minuten-Ablauf ergänzen.
- [ ] 21. Syntaktisch validierte UUID-Session unter `auth_session:<uuid>` in ScriptCache mit Gebäudebindung und vier Stunden TTL implementieren.
- [ ] 22. `login`, `validateSession` und `logout` in den zentralen Dispatcher integrieren.
- [ ] 23. Backendtests für UUID-Key, mehrere Tokens, falsches Gebäude, frühe Cacheverwerfung, Ablauf und token-genauen Logout ergänzen.
- [ ] 24. Geschützte Reads per POST und DGH-Writes mit Token autorisieren; Gemeindehaus-Public-Verträge erhalten.
- [ ] 25. Direkte Apps-Script-Unitfälle für jede Aktion, Section und Rolle vervollständigen.
- [ ] 26. `apps-script-client.js` so ändern, dass Backendfehlercodes erhalten bleiben und Authdaten nur im POST-Body stehen.
- [ ] 27. Clienttests für GET/POST-Auswahl, Body, fehlenden Auth-Header/Querytoken, Abort und exakten Requesttoken ergänzen.
- [ ] 28. `auth-session.js` implementieren, einschließlich `clearIfToken`.
- [ ] 29. Auth-Session-Tests für korrupte Daten, lokalen Ablauf, Gebäudeisolation, Root/DGH-Key und alte `AUTH_INVALID`-Antwort schreiben.
- [ ] 30. HTML/CSS-Flash-Schutz und stabile `data-access-section`-Marker einführen, bevor das Gate Sections kontrolliert freigibt.
- [ ] 31. Login-Dialog und Gate nach `DESIGN.md` implementieren; Fokus-, Escape-, ARIA- und Mobileverhalten isoliert testen.
- [ ] 32. `auth-feature.js` mit `anonymous|validating|admin`, Abort und Logingeneration implementieren.
- [ ] 33. DGH-Startfälle getrennt implementieren: ohne/abgelaufenes Token Dialog, vorhandenes Online-Token still im Gate validieren, vorhandenes Offline-Token mit Online-Hinweis sperren; Transportfehler darf Token nicht löschen.
- [ ] 34. `access-control.js` mit Policypräzedenz, legaler Ausnahme, Navigationssichtbarkeit und Deep-Link-Merker implementieren.
- [ ] 35. Access-Control-Tests für DGH, Gemeindehaus, `no`, `admin`, `all`, Policyfehler und Deep-Links ergänzen.
- [ ] 36. Frühesten DGH-Occupancy-Purge implementieren und testen, bevor der Occupancy-Lifecycle gestartet wird.
- [ ] 37. Cachefactory auf DGH-No-op und Gemeindehaus-Public-Projection umstellen.
- [ ] 38. `site-shell` um Abort, Generation, `reload` und `clearRemote` erweitern; Rollenverlustfälle testen.
- [ ] 39. Occupancy-Controller/View/Print um `clear`, Dialogschluss, Druckverwerfung, Abort und Generation erweitern.
- [ ] 40. Occupancy-Tests für DGH-Rollenverlust ohne anonymen Reload und Gemeindehaus-Rollenverlust mit anonymem Reload ergänzen.
- [ ] 41. `request-forms.js` erhalten und intern separat steuerbare Buchungs-/Kontakt-Lifecycles mit unabhängigen Pendingzuständen, Abortcontrollern, Generationen und Listenern ergänzen.
- [ ] 42. Beide Formularlifecycles separat auf Start/Stop, Abort, Generation, Werteerhalt/-löschung und unklare Write-Abbrüche testen.
- [ ] 43. `content.js` erhalten und intern separat steuerbare News-/Downloads-/About-Lifecycles ergänzen, ohne generische Factory zu erzwingen.
- [ ] 44. Contentrepository und drei Contentlifecycles auf eigene Abortsignale, Generationen, Start/Stop und Clear-Verhalten testen.
- [ ] 45. `main.js` mit statischen Imports beibehalten und um zentrale Accessgeneration sowie Lifecycle-Orchestrierung erweitern; `no` darf keinen Lifecycle, Laufzeit-Fetch oder Listener aktivieren.
- [ ] 46. Bestehende statische Modulgraphprüfung beibehalten und nur um die neuen statisch importierten Module ergänzen; vollständigen Service-Worker-Precache erneut prüfen.
- [ ] 47. Browser-Unit-/Integrationstests für Login, Logout, Gate, Fokus, Escape, Deep-Link, Offline und Rollenverlust ergänzen.
- [ ] 48. Browsermatrix mit Chromium, Firefox und WebKit ausführen und Unterschiede beheben.
- [ ] 49. Echten PWA-Upgradetest 1.6.1 auf 1.7.0 mit installiertem `/DGH/`-Worker, alten LocalStoragekeys und Online-/Offlineübergang implementieren.
- [ ] 50. Gemeindehaus-PWA-Offlinetest und Scopeisolation erneut prüfen.
- [ ] 51. Generiertes `Code.gs` neu bauen und gegen Template-/Generatorerwartungen testen; niemals direkt korrigieren.
- [ ] 52. Version als Feature auf 1.7.0 setzen und alle Dokumentationsdateien aus Abschnitt 13 aktualisieren.
- [ ] 53. Vollständige lokale Abschlusskommandos aus Abschnitt 14 in exakter Reihenfolge ausführen.
- [ ] 54. Staging mit getrennten Sheets, Apps-Script-Projekt, Script Properties und Direkt-API-Matrix abnehmen.
- [ ] 55. Produktionsworkflow bis zur `github-pages`-Environment-Freigabe vorlaufen lassen.
- [ ] 56. Backend-zuerst-Rollout im kurzen Wartungsfenster gemäß Abschnitt 15 durchführen.
- [ ] 57. Pages unmittelbar nach erfolgreicher Direkt-API-Prüfung freigeben und Live-Abnahme durchführen.

## 12. Geplante Tests

### 12.1 Build-Access-Policy: `tests/access-policy.test.py`

- Exaktes vorgeschlagenes Schema wird akzeptiert und vollständig aufgelöst.
- Default `page=all`; alle acht Defaultsections `all`.
- DGH wird `page=admin`, Gemeindehaus `page=all`.
- Rootpolicy ist wertgleich zur DGH-Policy.
- Sectionoverride gewinnt über Default.
- `no` bleibt auch für Admin gesperrt.
- `legal: all` umgeht nur das Page-Gate.
- Fehlende Defaultsection, zusätzliche Section, zusätzlicher Schlüssel, falscher Typ, falsche Großschreibung, unbekannter Wert, doppelte JSON-Schlüssel und falsche Schema-Version schlagen fehl.
- Access-ID fehlt/ist zusätzlich, Registry-ID fehlt/ist doppelt oder Backend-ID fehlt/ist zusätzlich: Build bricht jeweils ab.
- `legal=no` und `legal=admin` brechen in 1.7.0 den Build ab.
- Kein partielles `config.js` oder `Code.gs` wird als erfolgreiches Ergebnis gemeldet.

### 12.2 Runtime-Access-Policy: `tests/access-policy.test.js`

- Vollständig aufgelöste Policies mit exakt acht Sections werden akzeptiert und unveränderlich beziehungsweise ohne Mutation ausgewertet.
- Fehlende oder zusätzliche Schlüssel, falsche Typen, unbekannte Werte und falsche Schema-Version werden abgelehnt.
- Page `all|admin`, Section `no|all|admin` und das strengere Zusammenspiel werden für `unknown` und `admin` korrekt ausgewertet.
- `no` sperrt beide Rollen.
- `legal: all` umgeht ausschließlich das Page-Gate; andere Sections tun dies nicht.
- Das Domainmodul ist rein und benötigt weder DOM noch Storage, Fetch oder Browserglobals.
- Runtime-Konfigurationsfehler ergeben keine impliziten öffentlichen Defaults.

### 12.3 Auth-Session: `tests/auth-session.test.js`

- Storage enthält nur `token` und `expiresAt`.
- Key ist gebäudespezifisch; Root und DGH verwenden denselben `dgh_rb`-Key.
- Gemeindehaus verwendet getrennten Key.
- Ungültiges JSON, fehlende Werte und lokaler Ablauf werden entfernt.
- Transportfehler lässt Token bestehen.
- `AUTH_INVALID` löscht exakt das Requesttoken.
- `clearIfToken(old)` löscht eine inzwischen neu gespeicherte Session nicht.
- Mehrere Sessioninstanzen/Tabs beeinflussen sich im Testmodell nicht.

### 12.4 Auth-Feature: `tests/auth-feature.test.js`

- Zustandsübergänge `anonymous -> validating -> admin` und zurück.
- DGH ohne Token öffnet Login sofort.
- DGH mit lokal abgelaufener/ungültiger Session löscht sie und öffnet Login sofort.
- DGH mit lokal gültigem Token validiert online bei geschlossenem Dialog, zeigt im Gate „Anmeldung wird geprüft“ und entsperrt bei Erfolg direkt.
- DGH öffnet nach `AUTH_INVALID` automatisch den Dialog.
- Escape schließt Dialog, Gate bleibt und öffnet ihn erneut.
- DGH bleibt offline trotz lokal gültigem Token gesperrt.
- DGH zeigt mit vorhandenem Offline-Token den Online-Hinweis und sendet weder Validate- noch Loginrequest automatisch.
- Offline darf der Loginbutton den Dialog öffnen; Submit zeigt offline und sendet keinen Request.
- Onlineereignis startet spätere Validierung.
- Validate-Transportfehler behält Token und entsperrt DGH nicht.
- Gemeindehaus bleibt bei Validate-Transportfehler öffentlich nutzbar.
- Erfolgreicher Login speichert Token/Ablauf und setzt Fokus korrekt.
- `LOGIN_INVALID` leert nur Passwortfeld.
- `LOGIN_RATE_LIMIT` ändert Sitzung nicht.
- Überholter Login wird durch Abort plus Generation ignoriert.
- Alte `AUTH_INVALID`-Antwort löscht neues Token nicht.
- Logout widerruft nur aktuelles Token und verarbeitet Transportfehler ohne falsche Erfolgsanzeige.

### 12.5 Access Control: `tests/access-control.test.js`

- DGH anonym: nur legal, Gate und Login sichtbar.
- DGH admin: alle erlaubten Sections sichtbar.
- Gemeindehaus anonym: alle `all`-Sections sichtbar.
- Gemeindehaus `admin`-Section: verborgen bis Login.
- `no`: für beide Rollen verborgen, Lifecycle nicht gestartet, keine zugehörigen Laufzeit-Fetches oder Listener.
- Ungültige Policy: funktionale Sections fail closed, legal und Konfigurationsfehler sichtbar.
- Navigationslinks folgen Sectionsichtbarkeit.
- Gemeindehaus-Admin-Deep-Link öffnet Login, merkt Ziel und navigiert erst nach Featurestart.
- Deep-Link auf `no` öffnet kein Login.
- DGH-Rollenverlust leert alles ohne anonymen Fachreload.
- Gemeindehaus-Rollenverlust leert nur verlorene Adminbereiche und lädt sichtbare Reads anonym neu.
- Öffentliche Gemeindehaus-Formularwerte bleiben erhalten.

### 12.6 Apps Script: `tests/apps-script.test.js`

- Policy wird injiziert und exakt gegen `BACKEND_CONFIG.buildings` geprüft.
- `login` ist für beide gültigen Gebäude öffentlich, selbst bei DGH-Page-Gate.
- Username und Passwort müssen Strings sein; andere Typen ergeben `LOGIN_INVALID` ohne Property-/Rate-Key-Bildung.
- Roher Username über 64 Zeichen und rohes Passwort über 256 Zeichen ergeben `LOGIN_INVALID` vor Normalisierung.
- Normalisierter Username muss `[a-z0-9]{1,32}` erfüllen; ungültige Namen erzeugen keinen Rate-Key.
- Passwort muss nach Trim 1 bis 256 Zeichen lang sein.
- Username und Passwort werden getrimmt und case-insensitiv verglichen.
- Unbekannter Benutzer und falsches Passwort sind nicht unterscheidbar.
- Fehlende bekannte Credential-Property ergibt `CONFIGURATION_ERROR`.
- Fehlversuche 1 bis 4 ergeben `LOGIN_INVALID`.
- Fünfter Fehlversuch ergibt `LOGIN_INVALID` und aktiviert Sperre.
- Sechster sowie korrekte Versuche während Sperre ergeben `LOGIN_RATE_LIMIT`.
- Nach 15 Minuten ist ein neuer Versuch möglich.
- Erfolgreicher Login setzt Zähler zurück.
- Rate-Limit ist pro normalisiertem Benutzer und Gebäude getrennt und unter ScriptLock atomar.
- Rate-Einträge verwenden exakt `auth_rate:<buildingId>:<username>`, enthalten nur temporäre nicht geheime Runtime-Metadaten und werden nach Ablauf/Erfolg bereinigt; `user_*` bleibt unberührt.
- Login erzeugt UUID-Token, vier Stunden Ablauf und Gebäudebindung; Cache-Key ist exakt `auth_session:<uuid>` ohne Hash/Digest.
- Syntaktisch ungültige Tokens werden vor Cachezugriff als `AUTH_INVALID` abgelehnt.
- Frühe ScriptCache-Verwerfung ergibt `AUTH_INVALID`.
- Falsches Gebäude ergibt `AUTH_INVALID`.
- Mehrere Tokens bleiben parallel gültig.
- Logout entfernt nur verwendetes Token.
- `validateSession` funktioniert bei `start=no`.
- DGH-GETs `building`/`occupancy` ohne Token ergeben `AUTH_REQUIRED`.
- DGH-Writes ohne Token ergeben `AUTH_REQUIRED`.
- Gemeindehaus-Public-GETs und -Writes bleiben erlaubt, sofern jeweilige Section `all` ist.
- Jede Section `no` ergibt `FEATURE_DISABLED`, auch mit Admin-Token.
- Admin-Reads und -Writes laufen über POST und liefern in Phase 1 gleiche Fachfelder wie anonym.
- Bestehende Envelope- und Erfolgsdaten bleiben unverändert.
- Keine privaten Occupancy-Felder gelangen in irgendeine Rollenantwort.

### 12.7 Apps-Script-Client: `tests/apps-script-client.test.js`

- Öffentliche Reads verwenden GET mit Action/Gebäude/Range, aber ohne Token.
- Authentifizierte Reads verwenden POST `text/plain` mit Token im JSON-Body.
- Writes verwenden POST; DGH-Authtoken nur im Body.
- Login enthält Username/Passwort nur im Body.
- Kein Request nutzt Auth-Header oder Tokenquery.
- `FEATURE_DISABLED`, `AUTH_REQUIRED`, `AUTH_INVALID`, `LOGIN_INVALID`, `LOGIN_RATE_LIMIT`, `CONFIGURATION_ERROR` bleiben als konkrete Errorcodes erhalten.
- Ungültiges Envelope, ungültiges JSON, HTTPfehler, Transportfehler und Abort bleiben unterscheidbar.
- Der Client stellt das für den Request eingefrorene Token zur token-genauen Fehlerbehandlung bereit.

### 12.8 Feature-Lifecycle: bestehende und neue JS-Testdateien

- `site-shell`: Remote-Reload abortbar; alte Generation rendert nicht; `clearRemote` stellt statische Werte her.
- Occupancy: Clear leert Daten, Meta, Dialog und Drucksnapshot.
- Occupancy: DGH liest/schreibt nie Cache.
- Occupancy: Gemeindehaus persistiert nur normalisierte öffentliche Projektion.
- Occupancy: Rollenverlust und Zeitraumwechsel können sich nicht überholen.
- Buchungs- und Kontaktformular besitzen unabhängige Pending-/Abortzustände.
- Abort eines Writes erzeugt keine Behauptung einer serverseitigen Stornierung.
- DGH-Formwerte werden bei Rollenverlust geleert.
- Öffentliche Gemeindehaus-Formwerte bleiben bei Rollenverlust erhalten.
- News, Downloads und About laden/clearen unabhängig.
- `request-forms.js` steuert Buchungs- und Kontakt-Lifecycle intern unabhängig; `content.js` entsprechend News, Downloads und About, ohne erzwungene generische Factory.
- `no` startet keinen zugehörigen Lifecycle und erzeugt keine zugehörigen Laufzeit-Fetches oder Listener; statisch importierte Module bleiben ohne fachliche Seiteneffekte.
- Dispose entfernt Listener, Timer und Requests.

### 12.9 Build: Python- und Modulgraph-Tests

- `build-pages-site.py` erzeugt Root, DGH und Gemeindehaus mit korrekter vollständig aufgelöster Einzelpolicy.
- Kein Scope enthält die Policy des anderen Gebäudes.
- `build-apps-script.py` erzeugt vollständige Backendpolicy und reproduzierbares `Code.gs`.
- `configure-runtime.py` verändert ausschließlich `apiBaseUrl`; Policy bleibt identisch.
- `verify-pages-site.py` erkennt fehlende Policy, fremde ID, falsche Rootpolicy, fehlende Module und ungeschützte Flashzustände.
- Die bestehende statische Modulgraphprüfung bleibt erhalten und umfasst die neuen statischen Imports.
- `no` entfernt keine Datei aus dem Build.
- Der Service-Worker-Precache bleibt für den vollständigen statischen Modulgraphen unverändert vollständig.
- Service-Worker-Quelle bleibt logisch unverändert; Hash passt zu neuen Assets.

### 12.10 Browsermatrix: `tests/browser.test.py`

Für Chromium, Firefox und WebKit mindestens:

- DGH ohne Token, mit gültigem Token, ungültigem Token und Validate-Transportfehler.
- DGH online/offline und Wechsel offline -> online.
- Root verhält sich wie DGH und nutzt dieselbe Session innerhalb derselben Tabnavigation.
- Gemeindehaus öffentlich ohne Login.
- Gemeindehaus-Admin-Deep-Link, Login, Zielnavigation und Fokus.
- Escape, erneutes Öffnen, Tabreihenfolge, sichtbarer Fokus, ARIA-Namen und Live-Meldungen.
- `no`/`all`/`admin` für jede Featureklasse: API-Read, Write, statischer Content und legal.
- DGH-Rollenverlust leert alle Fachbereiche ohne anonymen Reload.
- Gemeindehaus-Rollenverlust leert nur Adminbereiche und lädt Read-Bereiche anonym.
- Öffentliche Gemeindehaus-Formwerte bleiben erhalten.
- Login-/Read-Races mit künstlich vertauschter Antwortreihenfolge.
- Mobile Viewport 390 px ohne horizontalen Overflow; Desktopdarstellung stabil.
- Token erscheint nicht in URL, Fragment oder sichtbarer Fehlerausgabe.

### 12.11 Echter PWA-Upgrade: `tests/pwa-browser.test.py`

Der Test darf nicht nur den fertigen 1.7.0-Build neu installieren. Er muss den echten Übergang simulieren:

1. Ein unverändertes 1.6.1-Artefakt aus einem festen Git-Ref/Releasefixture in einem temporären Verzeichnis bauen oder bereitstellen.
2. `/DGH/` unter HTTPS öffnen und den 1.6.1-Service-Worker vollständig aktivieren.
3. DGH-Keys für `occupancy:v3`, `occupancy:v2` und unversioniert mit erkennbaren Testdaten anlegen.
4. Optional die alte PWA einmal offline laden und damit das akzeptierte Altversionsrisiko dokumentieren.
5. Serverinhalt auf 1.7.0 umschalten und die PWA online aktualisieren.
6. Auf Aktivierung des neuen Workers und neuen ESM-Stands warten; alte Clients kontrolliert schließen/neu öffnen.
7. Prüfen, dass alle drei DGH-Keytypen gelöscht sind und nicht neu geschrieben werden.
8. Prüfen, dass Gemeindehauskeys unberührt bleiben.
9. DGH offline neu laden: statische Hülle/legal sichtbar, alle Fachbereiche gesperrt, lokales Token entsperrt nicht.
10. Gemeindehaus offline neu laden: öffentliche statische Bereiche und zulässiger öffentlicher Occupancy-Cache funktionieren.
11. Scopeisolation und fehlender Rootworker bleiben bestehen.

### 12.12 Staging-Direkt-API

Staging verwendet getrennte Sheet-Kopien, eigenes Apps-Script-Projekt, eigene Web-App-URL und nichtproduktive Passwörter.

Direkt gegen `/exec`, nicht nur über UI, prüfen:

- DGH `GET building` und `GET occupancy` anonym -> `AUTH_REQUIRED`.
- DGH beide Writes anonym -> `AUTH_REQUIRED`; keine Sheetzeile angelegt.
- Gültiger DGH-Login -> Token; `validateSession` -> admin.
- DGH authentifizierte Reads/Writes per POST -> Erfolg und unveränderte Fachfelder.
- Token mit falscher Gebäude-ID -> `AUTH_INVALID`.
- DGH-Token für Gemeindehaus -> `AUTH_INVALID`, falls mitgesendet und benötigt.
- Logout -> genau dieses Token ungültig; paralleles zweites Token bleibt gültig.
- Gemeindehaus öffentliche Reads und Writes -> Erfolg bei `all`.
- Temporäre Stagingpolicy `no` pro APIsection -> `FEATURE_DISABLED` anonym und admin.
- Rate-Limit inklusive fünftem/sechstem Versuch mit einem dedizierten Stagingkonto beziehungsweise nach geplanter Rücksetzung.
- Keine Credential-/Tokenwerte in Apps-Script-Ausführungslogs.
- CORS/Redirectverhalten aus Chromium, Firefox und WebKit gegen echte Staging-URL.
- Geheimmarkertest bestätigt weiterhin, dass Occupancy nur öffentliche Felder liefert.

## 13. Dokumentation und Version

Bei Umsetzung aktualisieren:

- `package.json`: `1.6.1` -> `1.7.0`.
- `README.md`: Version 1.7.0, Rollen, DGH-Gate, Gemeindehauspolicy, Cacheverhalten, Abschlusskommandos und Upgradehinweis.
- `PROJEKTUEBERSICHT.md`: zentrale Policyquelle, Backendautorität, statischer ESM-Graph, zentral orchestrierte Teillifecycles, Cache- und Rolloutregeln.
- `DESIGN.md`: Gate und Login-Dialog mit Fokus/ARIA/responsivem Verhalten.
- `betreiber/README.md`: Pflege von `access.json`; keine Zugangsdaten dort.
- `docs/betreiber-konfiguration.md`: vollständiges Schema, Präzedenz, gültige Werte, Beispiele und `legal: all`.
- `docs/apps-script-deployment.md`: Einrichtung von `user_peter`, `user_moni`, `user_edeltraut` als Script Properties, Staging und Produktionsablauf.
- `apps-script/README.md`: neue Aktionen, POST-Verträge, Session-/Rate-Limit-Verhalten und Generatorhinweis.
- Gegebenenfalls `docs/lokaler-demo-server.md`: Login-/Staginghinweise ohne echte Zugangsdaten.
- `.github/workflows/pages.yml`: nur falls neue, nicht durch `npm test` abgedeckte Testdateien einen zusätzlichen Befehl benötigen.

Keine echte Zugangsdaten, Tokens oder produktive Testwerte dokumentieren oder einchecken.

## 14. Vollständige vorhandene Abschlusskommandos

Diese Kommandos stehen aktuell in `README.md` und sind in genau dieser Reihenfolge als vollständiger Abschlusslauf auszuführen:

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

Falls `tests/access-policy.test.py` als eigenständiger Befehl und nicht über einen bestehenden Testentrypoint eingebunden wird, muss er bei der Umsetzung in README und Workflow an der fachlich passenden Stelle vor dem Pages-Build ergänzt werden. Die oben wiedergegebene Liste dokumentiert bewusst den vollständigen vorhandenen Stand 1.6.1.

Einmalige Browserinstallation, nicht Teil jedes Abschlusslaufs:

```pwsh
python -m pip install playwright==1.61.0
python -m playwright install chromium firefox webkit
```

## 15. Staging- und Produktionsrollout

### 15.1 Staging

1. Separate Sheet-Kopien und ein separates standalone Apps-Script-Projekt verwenden.
2. `user_peter`, `user_moni`, `user_edeltraut` mit nichtproduktiven Klartextpasswörtern in den Staging Script Properties setzen.
3. `Code.gs` ausschließlich mit `python scripts/build-apps-script.py` erzeugen und in Staging als neue Web-App-Version bereitstellen.
4. Direkt-API-Matrix aus Abschnitt 12.12 vollständig ausführen.
5. Pages-Artefakt mit Staging-Web-App-URL konfigurieren und vollständige Browser-/PWA-Matrix ausführen.
6. Einen echten 1.6.1-zu-1.7.0-Upgrade testen, nicht nur Neuinstallation.
7. Ausführungslogs auf Passwörter/Tokens prüfen und alle Staging-Formulardaten wieder entfernen.
8. Erst nach grüner Stagingabnahme Produktionsrelease vorbereiten.

### 15.2 Vorbereitung Produktion

1. Vollständigen lokalen Abschlusslauf grün abschließen.
2. Änderungen nach `main` bringen und GitHub Actions vollständig durch Qualität, Browsermatrix und PWA-Test laufen lassen.
3. Die Pages-Bereitstellung am geschützten Environment `github-pages` warten lassen; noch nicht freigeben.
4. Prüfen, dass das wartende Artefakt exakt 1.7.0 enthält und die produktive `APPS_SCRIPT_WEB_APP_URL` bei Freigabe konfiguriert wird.
5. Produktive Script Properties vor dem Backenddeployment setzen und außerhalb des Repositorys gegen die Betreiberliste prüfen.
6. Kurzes Wartungsfenster ankündigen. Währenddessen keine DGH-Formularaktionen erwarten und keine 1.6.1-Frontendfreigabe durchführen.

### 15.3 Backend zuerst im Wartungsfenster

1. Generiertes 1.7.0-`Code.gs` in das produktive standalone Apps-Script-Projekt übernehmen.
2. Als neue Version auf der bestehenden `/exec`-Bereitstellung veröffentlichen; URL möglichst unverändert lassen.
3. Noch bevor Pages freigegeben wird, Direkt-API prüfen.
4. DGH anonym: `building`, `occupancy`, `createBookingRequest`, `createContactRequest` müssen `AUTH_REQUIRED` liefern und nichts schreiben.
5. DGH gültiger Login: `validateSession`, beide Reads und kontrollierte Staging-/Produktions-Testwrites müssen funktionieren; Testwrites anschließend fachlich bereinigen.
6. DGH falsches/fremdes Token: `AUTH_INVALID`.
7. Gemeindehaus anonyme Reads und kontrollierte Writes müssen wegen `all` weiter funktionieren.
8. Erfolgsantworten auf unveränderte Fachfelder und Occupancy auf fehlende Privatfelder prüfen.
9. Logout und paralleles Tokenverhalten prüfen.
10. Apps-Script-Logs auf Fehler und versehentlich protokollierte Authdaten prüfen.

Der absichtliche kurze Zwischenzustand ist sicher: Ein noch ausgeliefertes 1.6.1-DGH-Frontend kann die nun geschützten Backendaktionen nicht mehr anonym verwenden. Es zeigt gegebenenfalls Fehler, erhält aber keine Freigabe. Gemeindehaus bleibt durch seine öffentliche Backendpolicy funktionsfähig.

### 15.4 Pages sofort danach

1. Nur bei vollständig erfolgreicher Backendprüfung das wartende `github-pages`-Environment sofort freigeben.
2. Deploymentabschluss und URL des GitHub-Actions-Jobs prüfen.
3. Root, `/DGH/` und `/Gemeindehaus/` online in frischen Browserkontexten prüfen.
4. DGH-Login, Escape/Gate, legal, Logout, Cache-Purge und Offline-Gate prüfen.
5. Gemeindehaus öffentlich, Admin-Deep-Link und Offlinefunktion prüfen.
6. Einen bestehenden 1.6.1-DGH-PWA-Client online aktualisieren, alle alten Fenster/Tabs schließen, neu öffnen und Cache-Purge bestätigen.
7. Monitoring während des Wartungsfensters fortsetzen und Fenster erst nach erfolgreicher Live-Abnahme beenden.

### 15.5 Fehlerfall und Rollbackregel

- **Kein Rollback auf Frontend oder Backend 1.6.1.** Das alte DGH-Modell erlaubt anonyme Aktionen und passt nicht zur neuen Sicherheitsanforderung.
- Schlägt die Backendprüfung fehl, Pages nicht freigeben.
- Backend in einem fail-closed Wartungsstand belassen: DGH-Fachaktionen müssen weiter abgelehnt werden, notfalls mit `CONFIGURATION_ERROR`; keine alte öffentliche DGH-API reaktivieren.
- Ursache vorwärts beheben, `Code.gs` neu aus Template generieren, neue Apps-Script-Version bereitstellen und Direkt-API erneut vollständig prüfen.
- Ist Pages bereits 1.7.0 live und ein Fehler tritt auf, ebenfalls vorwärts auf eine korrigierte 1.7.x-Version gehen. Keine 1.6.1-Artefakte reaktivieren.
- Die unwiderruflich offline laufende 1.6.1-PWA bleibt als dokumentiertes Restrisiko bestehen; sie darf nicht als Rollbackstrategie betrachtet werden.

## 16. Abnahmekriterien / Definition of Done

- [ ] Version ist in allen maßgeblichen Stellen 1.7.0.
- [ ] `access.json` ist einzige fachliche Policyquelle.
- [ ] Access-, Registry- und Backend-Gebäude-IDs werden exakt verglichen; jede Abweichung bricht fail closed ab.
- [ ] Root erhält exakt DGH-Policy.
- [ ] Alle acht Sections unterstützen die definierten Werte; `legal` ist in 1.7.0 zwingend `all`.
- [ ] Backend ist Autorität und blockiert manipuliertes Frontend zuverlässig.
- [ ] `no` liefert backendseitig `FEATURE_DISABLED`, auch für Admin.
- [ ] DGH zeigt anonym nur legal, Gate und Loginmöglichkeit.
- [ ] DGH `building`, `occupancy`, `createBookingRequest` und `createContactRequest` verlangen gültige Adminsession.
- [ ] Gemeindehaus bleibt mit Defaultpolicy vollständig öffentlich.
- [ ] Login-, Logout- und `validateSession`-Verträge sind umgesetzt und direkt getestet.
- [ ] Credentials liegen nur in Script Properties; keine Zugangsdaten sind eingecheckt.
- [ ] Username/Passwort werden strikt als Strings, mit rohen Längenlimits, Username-Regex, Trim und case-insensitivem Vergleich verarbeitet.
- [ ] Rate-Limit verhält sich exakt am fünften/sechsten Versuch und ist unter ScriptLock atomar.
- [ ] Rate-Metadaten liegen nur unter `auth_rate:<buildingId>:<username>`, enthalten keine Secrets, werden nach Ablauf/Erfolg bereinigt und bleiben von `user_*` getrennt.
- [ ] Session ist UUID-basiert, gebäudegebunden, maximal vier Stunden und einzeln widerrufbar.
- [ ] Servercache verwendet syntaktisch validierte UUIDs unter `auth_session:<uuid>` ohne Hash/Digest.
- [ ] Browser speichert nur Token und Ablauf im gebäudespezifischen `sessionStorage`.
- [ ] `AUTH_INVALID` verwendet token-genaues `clearIfToken`.
- [ ] Validate-Transportfehler löscht Token nicht und erteilt keinen Adminzugriff.
- [ ] DGH validiert ein vorhandenes Online-Token bei geschlossenem Dialog mit Gate-Status und entsperrt erst nach Erfolg; automatische Dialogöffnung erfolgt nur ohne Token, nach lokalem Ablauf oder nach `AUTH_INVALID`.
- [ ] DGH mit vorhandenem Offline-Token zeigt den Online-Hinweis und sendet keinen automatischen Authrequest; ein offline abgesendeter Login wird vor Fetch abgelehnt.
- [ ] Kein Token/Passwort erscheint in URL, Header, Logs oder öffentlicher Konfiguration.
- [ ] DGH ist offline immer gesperrt.
- [ ] DGH-Caches v3, v2 und unversioniert werden früh gelöscht und nie neu geschrieben.
- [ ] Gemeindehauscache persistiert in Phase 1 nur die öffentliche Projektion.
- [ ] DGH-Rollenverlust leert alle Fachbereiche ohne anonymen Reload.
- [ ] Gemeindehaus-Rollenverlust leert nur verlorene Adminbereiche und lädt sichtbare Reads anonym neu.
- [ ] Öffentliche Gemeindehaus-Formularwerte bleiben bei unnötigem Rollenwechsel erhalten.
- [ ] Login-, Read- und Feature-Races sind durch Abort plus Generation abgesichert.
- [ ] Site Shell, Occupancy, beide Formulare, News, Downloads und About besitzen getrennte kontrollierbare Lifecycles.
- [ ] Occupancy-Clear schließt Dialog und verwirft Drucksnapshot.
- [ ] Der statische ESM-Graph und vollständige Service-Worker-Precache bleiben erhalten.
- [ ] Bei `no` bleibt die Section verborgen, ihr Lifecycle startet nicht und es entstehen keine zugehörigen Laufzeit-Fetches oder Listener.
- [ ] Login-Dialog erfüllt Fokus-, Escape-, ARIA-, Tastatur-, Mobile- und Desktopanforderungen.
- [ ] Gemeindehaus-Admin-Deep-Link merkt und öffnet das Ziel erst nach erfolgreichem Login.
- [ ] Admin und Unknown erhalten in Phase 1 dieselben fachlichen Datenfelder.
- [ ] Service-Workerlogik bleibt unverändert; Root bleibt ohne Worker.
- [ ] Unit-, Build-, Apps-Script-, Client-, Lifecycle-, Browser- und PWA-Upgradetests sind grün.
- [ ] Staging-Direkt-API und Produktions-Direkt-API sind abgenommen.
- [ ] Dokumentation und `PROJEKTUEBERSICHT.md` entsprechen dem neuen Stand.
- [ ] Generiertes `Code.gs` stimmt mit Template und Generator überein und wurde nicht manuell editiert.
- [ ] Produktionsrollout erfolgte Backend zuerst und Pages unmittelbar danach, ohne 1.6.1-Rollback.

## 17. Nicht-Ziele nach YAGNI

- Keine zusätzlichen Rollen neben `unknown` und `admin`.
- Keine Benutzerverwaltung, Registrierungsseite, Passwortänderung oder Passwortzurücksetzung in der Anwendung.
- Kein „eingeloggt bleiben“ über die Browsersitzung hinaus.
- Keine Refresh-Tokens und keine automatische Sessionverlängerung.
- Kein globales Logout aller Tabs/Tokens.
- Keine OAuth-/OIDC-/Google-Identity-Integration.
- Keine Passwortverschlüsselung oder Hashmigration in Phase 1; Klartext in Script Properties ist bewusste Produktentscheidung.
- Keine Adminoberfläche zur Policy- oder Credentialpflege.
- Keine Entfernung statischer Dateien aus dem Build aufgrund von `no`.
- Keine vertrauliche Auslieferung von News, PDFs, About oder JavaScriptmodulen.
- Keine privaten Adminfelder in Occupancy oder anderen Fachantworten.
- Keine Änderung des Sheet-Schemas und keine neue Datenmigration.
- Keine Änderung am gebundenen Buchungsverwaltungsskript.
- Keine Änderung der Service-Worker-Strategie.
- Keine Umstellung des bestehenden statischen ESM-Graphen auf dynamische Imports.
- Keine Aufspaltung von `request-forms.js` oder `content.js` in zusätzliche Featuredateien und keine erzwungene generische Lifecycle-Factory.
- Kein serverseitiges Rendern, kein Bundler, kein Framework und keine externe Authbibliothek.
- Keine Garantie, einen bereits serverseitig begonnenen Write per Abort abzubrechen.
- Keine nachträgliche Kontrolle einer dauerhaft offline gebliebenen 1.6.1-Installation.

## 18. Hinweise für den nächsten Kontext

1. Zuerst aktuellen Arbeitsbaum, Branch, Version, `plan.md`, `README.md`, `DESIGN.md`, Registry, Backendkonfiguration und vorhandene Tests prüfen. Dieser Plan beschreibt den Stand vom 16.07.2026; spätere Änderungen haben Vorrang und dürfen nicht überschrieben werden.
2. Vor Analyse/Änderung die passenden Skills laden: `codebase-memory`, `frontend-design`, `google-apps-script`, `pwa-development`, `webapp-testing`.
3. Mit `codebase-memory` aktuelle Definitionen und Beziehungen neu ermitteln; nicht auf alte Symbolnamen aus diesem Plan vertrauen.
4. Keine Zugangsdaten, Passwörter, Tokens oder produktive Script-Property-Werte einchecken.
5. `apps-script/buchungs-api/Code.gs` nie manuell editieren; immer Template/Betreiberquellen ändern und Generator ausführen.
6. `PROJEKTUEBERSICHT.md` nach der Implementierung kurz, aber vollständig auf 1.7.0 aktualisieren.
7. Featureversion auf 1.7.0 setzen, nicht Patchversion 1.6.2.
8. Kleine Änderungen mit nahen Tests umsetzen; danach vollständige Abschlussmatrix ausführen.
9. Bei widersprüchlicher Policy oder unklarem Authzustand immer fail closed entscheiden.
10. Vor Einführung privater Adminfelder in einer späteren Phase authentifizierte Browserpersistenz vollständig entfernen und neu sicherheitsprüfen.
