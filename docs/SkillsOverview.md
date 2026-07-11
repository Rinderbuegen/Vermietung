# Skill-Übersicht

Stand: 11. Juli 2026. Diese Übersicht erfasst die in der aktuellen OpenCode-Umgebung nutzbaren projektlokalen, globalen und eingebauten Skills. Das Projekt ist eine deutschsprachige, statische Vermietungs-PWA mit Vanilla HTML/CSS/JavaScript, Google Apps Script, Google Sheets, Python-Buildskripten und GitHub Pages. Lock-Einträge ohne installierte `SKILL.md` gelten nicht als verfügbar.

## Projektlokale Skills

### google-apps-script

Unterstützt Änderungen und Prüfungen an den Apps-Script-Anwendungen unter `apps-script/buchungs-api/` und `apps-script/buchungsverwaltung/`, etwa für Sheet-Zugriffe, Web-App-Endpunkte, Sperren, E-Mails und Betreiberabläufe. Das Frontmatter nennt `claude-code-only`; die projektlokalen OpenCode-Anweisungen laden den Skill dennoch für diesen Bereich.

- Umfang und Quelle: projektlokal unter `.agents/skills/google-apps-script/`; Junction unter `.claude/skills/google-apps-script/`; Quelle `jezweb/claude-skills`, festgehalten in `skills-lock.json`.
- Typische Auslöser: Änderungen oder Fehlersuche an `Code.gs`, Google Sheets, Triggern, Menüs oder der Apps-Script-Web-App.
- Dokumentation: [Repository](https://github.com/jezweb/claude-skills) und lokale `SKILL.md`.
- Verifizierter skills.sh-Link: [google-apps-script](https://skills.sh/jezweb/claude-skills/google-apps-script)
- Beispielanfrage: `Prüfe apps-script/buchungs-api/Code.gs auf sichere Konfliktprüfung und verständliche JSON-Fehler.`

### pwa-development

Deckt Installierbarkeit, Offline-Verhalten und Cache-Strategien der Vermietungs-PWA ab. Im Projekt betrifft das besonders `manifest.webmanifest`, `service-worker.js`, GitHub-Pages-Pfade und den Belegungs-Fallback in `assets/js/app.js`.

- Umfang und Quelle: projektlokal unter `.agents/skills/pwa-development/`; Junction unter `.claude/skills/pwa-development/`; Quelle `alinaqi/claude-bootstrap`, festgehalten in `skills-lock.json`.
- Typische Auslöser: Änderungen an Manifest, Service Worker, Offline-Cache, Scope, Start-URL oder Installierbarkeit.
- Dokumentation: [Repository](https://github.com/alinaqi/claude-bootstrap) und lokale `SKILL.md`.
- Verifizierter skills.sh-Link: [pwa-development](https://skills.sh/alinaqi/claude-bootstrap/pwa-development)
- Beispielanfrage: `Prüfe Manifest und Service Worker für beide GitHub-Pages-Gebäudepfade und verbessere das Offline-Verhalten.`

### web-quality-audit

Prüft die ausgelieferte PWA nach Lighthouse-orientierten Kriterien für Performance, Barrierefreiheit, SEO und Best Practices. Relevant sind unter anderem Formulare, Kalenderdarstellung, Google Fonts, statische Assets und Core Web Vitals.

- Umfang und Quelle: projektlokal unter `.agents/skills/web-quality-audit/`; Junction unter `.claude/skills/web-quality-audit/`; Quelle `addyosmani/web-quality-skills`, festgehalten in `skills-lock.json`.
- Typische Auslöser: Lighthouse-, Performance-, Core-Web-Vitals-, SEO- oder Barrierefreiheitsaudits.
- Dokumentation: [Repository](https://github.com/addyosmani/web-quality-skills) und lokale `SKILL.md`.
- Verifizierter skills.sh-Link: [web-quality-audit](https://skills.sh/addyosmani/web-quality-skills/web-quality-audit)
- Beispielanfrage: `Führe ein Webqualitätsaudit der mobilen Vermietungs-PWA durch und priorisiere konkrete Korrekturen.`

### webapp-testing

Unterstützt Browser- und End-to-End-Prüfungen mit nativen Python-Playwright-Skripten. Geeignete Projektziele sind Kalenderinteraktionen, Buchungs- und Kontaktformular, Responsive-Ansichten, beide Gebäudepfade, API-Fehler und Offline-Fallback. Das Repository enthält derzeit keine eigene Playwright-Konfiguration oder Testsuite.

- Umfang und Quelle: projektlokal unter `.agents/skills/webapp-testing/`; Junction unter `.claude/skills/webapp-testing/`; Quelle `anthropics/skills`, festgehalten in `skills-lock.json`.
- Typische Auslöser: Browser-, Formular-, Responsive-, Interaktions- oder End-to-End-Tests sowie Screenshots und Browserlogs.
- Dokumentation: [Repository](https://github.com/anthropics/skills) und lokale `SKILL.md`.
- Verifizierter skills.sh-Link: [webapp-testing](https://skills.sh/anthropics/skills/webapp-testing)
- Beispielanfrage: `Teste lokal den Ablauf von der Terminauswahl bis zur Buchungsanfrage auf Desktop und Mobilgeräten.`

## Globale und eingebaute Skills

### ai-sdk

Liefert aktuelle Anleitung für Vercels AI SDK, einschließlich Textgenerierung, Streaming, Agents, Tool Calling, strukturierter Ausgabe, Embeddings und UI-Hooks. Die Vermietungsanwendung verwendet dieses SDK nicht; der Skill ist nur für andere oder neue AI-Aufgaben der Umgebung relevant.

- Umfang und Quelle: global unter `C:/Users/hesspet/.agents/skills/ai-sdk/`, Junction unter `C:/Users/hesspet/.claude/skills/ai-sdk/`, zusätzlich sitzungsbereitgestellt; Quelle `vercel/ai`.
- Typische Auslöser: AI SDK, `generateText`, `streamText`, `ToolLoopAgent`, `useChat`, RAG oder Chatbots.
- Dokumentation: [AI SDK](https://ai-sdk.dev/docs) und [Repository](https://github.com/vercel/ai).
- Verifizierter skills.sh-Link: [ai-sdk](https://skills.sh/vercel/ai/ai-sdk)
- Beispielanfrage: `Erkläre für ein separates Projekt, wie streamText mit Tool Calling eingesetzt wird.`

### caveman

Aktiviert einen persistenten, stark komprimierten Kommunikationsstil mit mehreren Intensitätsstufen. Dies verändert Antworten, nicht die Vermietungsanwendung.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/caveman/`, zusätzlich sitzungsbereitgestellt; Repository `juliusbrussee/caveman`.
- Typische Auslöser: `/caveman`, „Caveman-Modus“, „weniger Tokens“ oder „sei knapp“.
- Dokumentation: lokale `SKILL.md` und [Repository](https://github.com/juliusbrussee/caveman).
- Verifizierter skills.sh-Link: [caveman](https://skills.sh/juliusbrussee/caveman/caveman)
- Beispielanfrage: `Aktiviere Caveman Ultra für diese Sitzung.`

### caveman-commit

Erzeugt knappe Conventional-Commit-Nachrichten mit kurzem Betreff und nur bei Bedarf einem begründenden Textkörper. Der Skill führt keine Git-Befehle aus.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/caveman-commit/`, zusätzlich sitzungsbereitgestellt; Repository `juliusbrussee/caveman`.
- Typische Auslöser: Commit-Nachricht, „write a commit“, `/commit` oder `/caveman-commit`.
- Dokumentation: lokale `SKILL.md` und [Repository](https://github.com/juliusbrussee/caveman).
- Verifizierter skills.sh-Link: [caveman-commit](https://skills.sh/juliusbrussee/caveman/caveman-commit)
- Beispielanfrage: `Erzeuge eine Commit-Nachricht für die Änderungen an Manifest und Service Worker.`

### caveman-compress

Komprimiert natürliche Sprachdateien wie Anweisungen oder Notizen, bewahrt technische Inhalte und legt vor dem Überschreiben eine lesbare Sicherung an.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/caveman-compress/`, zusätzlich sitzungsbereitgestellt; Repository `juliusbrussee/caveman`.
- Typische Auslöser: `/caveman-compress <Datei>` oder „Memory-Datei komprimieren“.
- Dokumentation: lokale `SKILL.md` und [Repository](https://github.com/juliusbrussee/caveman).
- Verifizierter skills.sh-Link: [caveman-compress](https://skills.sh/juliusbrussee/caveman/caveman-compress)
- Beispielanfrage: `Komprimiere AGENTS.md und erhalte alle Pfade und Befehle exakt.`

### caveman-help

Zeigt einmalig eine Kurzreferenz zu Caveman-Modi, Skills und Befehlen, ohne einen Modus zu aktivieren.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/caveman-help/`, zusätzlich sitzungsbereitgestellt; Repository `juliusbrussee/caveman`.
- Typische Auslöser: `/caveman-help` oder Fragen zur Caveman-Nutzung.
- Dokumentation: lokale `SKILL.md` und [Repository](https://github.com/juliusbrussee/caveman).
- Verifizierter skills.sh-Link: [caveman-help](https://skills.sh/juliusbrussee/caveman/caveman-help)
- Beispielanfrage: `Zeige mir die verfügbaren Caveman-Befehle.`

### caveman-review

Formuliert Code-Review-Befunde als kurze, handlungsorientierte Einzeiler mit Fundstelle, Problem und Korrektur.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/caveman-review/`, zusätzlich sitzungsbereitgestellt; Repository `juliusbrussee/caveman`.
- Typische Auslöser: „Review diesen PR“, „Code Review“, „Review den Diff“, `/review` oder `/caveman-review`.
- Dokumentation: lokale `SKILL.md` und [Repository](https://github.com/juliusbrussee/caveman).
- Verifizierter skills.sh-Link: [caveman-review](https://skills.sh/juliusbrussee/caveman/caveman-review)
- Beispielanfrage: `Prüfe den Apps-Script-Diff und gib nur konkrete Befunde mit Datei und Zeile aus.`

### clipboard-manager

Liest, schreibt, leert und überwacht die Systemzwischenablage. Bei deutschen Texten im Projekt muss UTF-8 beziehungsweise Unicode erhalten bleiben; PowerShells `Set-Clipboard` ist für Umlaute und ß vorzuziehen.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/clipboard-manager/`; der Name stammt mangels `name`-Frontmatter aus dem Verzeichnis.
- Typische Auslöser: Inhalte in die Zwischenablage kopieren, Zwischenablage auslesen, leeren oder überwachen.
- Dokumentation: lokale `SKILL.md`; keine vertrauenswürdige öffentliche Quellzuordnung bekannt.
- Beispielanfrage: `Kopiere den deutschen Veröffentlichungshinweis Unicode-sicher in die Zwischenablage.`

### codebase-memory

Nutzt den indexierten Code-Wissensgraphen für Architektur-, Aufrufer-, Abhängigkeits-, Datenfluss- und Auswirkungsanalysen. Für dieses Projekt kann er etwa Wege zwischen UI, API-Client und Apps Script untersuchen.

- Umfang und Quelle: global unter `C:/Users/hesspet/.claude/skills/codebase-memory/`, zusätzlich sitzungsbereitgestellt.
- Typische Auslöser: Architektur erklären, Aufrufer finden, Call-Chain verfolgen, Dead Code suchen oder Änderungsfolgen bestimmen.
- Dokumentation: lokale `SKILL.md`; keine vertrauenswürdige öffentliche Quellzuordnung bekannt.
- Beispielanfrage: `Verfolge den Datenfluss einer Buchungsanfrage vom Formular bis zum API-Aufruf.`

### customize-opencode

Unterstützt ausschließlich OpenCodes eigene Konfiguration, Agents, Skills, Plugins, MCP-Server und Berechtigungen. Der Skill ist nicht für Anwendungscode der Vermietungs-PWA bestimmt.

- Umfang und Quelle: eingebaut und sitzungsbereitgestellt; kein eigenes Skill-Verzeichnis in diesem Projekt.
- Typische Auslöser: Änderungen an `opencode.json`, `.opencode/`, `~/.config/opencode/` oder OpenCode-Erweiterungen.
- Dokumentation: eingebaute Skill-Beschreibung; keine öffentliche Skill-Quelle angegeben.
- Beispielanfrage: `Ergänze in meiner OpenCode-Konfiguration einen MCP-Server mit minimalen Berechtigungen.`

### find-skills

Sucht und bewertet installierbare Skills aus dem offenen Skills-Ökosystem. Im Projekt ist er sinnvoll, wenn für GitHub Pages, Python-Builds oder weitere Prüfbereiche ein spezialisierter Skill fehlt.

- Umfang und Quelle: global unter `C:/Users/hesspet/.agents/skills/find-skills/`, zusätzlich sitzungsbereitgestellt; Quelle `vercel-labs/skills`.
- Typische Auslöser: „Finde einen Skill“, „Gibt es einen Skill für ...?“ oder Wunsch nach neuen Agent-Fähigkeiten.
- Dokumentation: [Repository](https://github.com/vercel-labs/skills) und lokale `SKILL.md`.
- Verifizierter skills.sh-Link: [find-skills](https://skills.sh/vercel-labs/skills/find-skills)
- Beispielanfrage: `Finde einen vertrauenswürdigen Skill für GitHub-Pages-Deployments.`

### frontend-design

Hilft beim Entwurf eigenständiger, bewusst gestalteter Oberflächen statt austauschbarer Standardlayouts. Bei Änderungen an dieser PWA bleibt das bestehende `DESIGN.md` verbindlich; der Skill ergänzt, ersetzt aber nicht das Projektdesignsystem.

- Umfang und Quelle: global unter `C:/Users/hesspet/.agents/skills/frontend-design/`, zusätzlich sitzungsbereitgestellt; Quelle `anthropics/skills`.
- Typische Auslöser: neue UI, visuelle Neugestaltung, Typografie, Layout oder Designrichtung.
- Dokumentation: [Repository](https://github.com/anthropics/skills) und lokale `SKILL.md`.
- Verifizierter skills.sh-Link: [frontend-design](https://skills.sh/anthropics/skills/frontend-design)
- Beispielanfrage: `Überarbeite den mobilen Belegungsplan innerhalb der Regeln aus DESIGN.md.`

### graphify

Erzeugt und befragt persistente Wissensgraphen aus Code, Dokumenten und weiteren Medien. Der Skill ist ein allgemeines Analysewerkzeug; `graphify-out/` ist kein Bestandteil dieses Projekts.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/graphify/`, zusätzlich sitzungsbereitgestellt.
- Typische Auslöser: Fragen zu Codearchitektur, Dateibeziehungen, Projektinhalten oder vorhandenen `graphify-out`-Daten.
- Dokumentation: lokale `SKILL.md`; keine vertrauenswürdige öffentliche Repository-Zuordnung bekannt.
- Beispielanfrage: `Erzeuge einen Wissensgraphen der Projekt- und Betriebsdokumentation.`

### grill-me

Führt ein konsequentes Interview, das Pläne und Designs auf Annahmen, Lücken, Risiken und unklare Entscheidungen prüft. Der Skill wird manuell aufgerufen.

- Umfang und Quelle: global unter `C:/Users/hesspet/.agents/skills/grill-me/`, Junction unter `C:/Users/hesspet/.claude/skills/grill-me/`, zusätzlich sitzungsbereitgestellt; Quelle `mattpocock/skills`.
- Typische Auslöser: `/grill-me`, „Grill meinen Plan“ oder gründliche Plan- und Designkritik.
- Dokumentation: [Repository](https://github.com/mattpocock/skills) und lokale `SKILL.md`.
- Verifizierter skills.sh-Link: [grill-me](https://skills.sh/mattpocock/skills/grill-me)
- Beispielanfrage: `Grill mich zu meinem Plan für sichere Buchungsbestätigungen und Sperrzeiten.`

### lmstudio-model-sync

Fragt die lokale LM-Studio-API ab und synchronisiert ausgewählte Modelle mit dem `lmstudion`-Provider in OpenCodes Benutzerkonfiguration. Dies betrifft die Entwicklungsumgebung, nicht die Vermietungsanwendung.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/lmstudio-model-sync/`, zusätzlich sitzungsbereitgestellt.
- Typische Auslöser: LM Studio, Modelle synchronisieren, aktuelle Modelle laden oder Provider-Modelle pflegen.
- Dokumentation: lokale `SKILL.md`; keine vertrauenswürdige öffentliche Quellzuordnung bekannt.
- Beispielanfrage: `Synchronisiere die aktuell in LM Studio verfügbaren Modelle mit OpenCode.`

### opencode-skill-creator

Erstellt, validiert, testet, evaluiert und optimiert OpenCode-Skills. Der Skill eignet sich zur Pflege projektbezogener Agent-Workflows, nicht zur Änderung der PWA selbst.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/opencode-skill-creator/`, zusätzlich sitzungsbereitgestellt.
- Typische Auslöser: OpenCode-Skill erstellen, `SKILL.md` bearbeiten, Trigger-Evals oder Benchmarks ausführen.
- Dokumentation: lokale `SKILL.md`; keine vertrauenswürdige öffentliche Quellzuordnung bekannt.
- Beispielanfrage: `Erstelle und evaluiere einen OpenCode-Skill für GitHub-Pages-Releaseprüfungen.`

### skills-overview-creator

Erstellt oder aktualisiert eine vollständige, projektbezogene `SkillsOverview.md`. Er schützt vorhandene Dateien bei technischen Netzwerkfehlern, verifiziert skills.sh-Links und bewahrt den Git-Index.

- Umfang und Quelle: global unter `C:/Users/hesspet/.config/opencode/skills/skills-overview-creator/`, zusätzlich sitzungsbereitgestellt.
- Typische Auslöser: installierte Skills inventarisieren, Skill-Dokumentation synchronisieren oder `SkillsOverview.md` pflegen.
- Dokumentation: lokale `README.md` und `SKILL.md`; keine vertrauenswürdige öffentliche Quellzuordnung bekannt.
- Beispielanfrage: `Aktualisiere docs/SkillsOverview.md vollständig und passend zur aktuellen Projektarchitektur.`

## Verwaltung

Die vier projektlokalen Skills werden durch `skills-lock.json` mit GitHub-Quelle, Skill-Pfad und Prüfsumme beschrieben. Ihre primären Verzeichnisse liegen unter `.agents/skills/`; `.claude/skills/` enthält kompatible Junctions. Globale und eingebaute Skills werden nicht von dieser Projekt-Lockdatei verwaltet und können sich unabhängig vom Repository ändern.

Die globale Lockdatei kann Quellen nennen, deren `SKILL.md` derzeit nicht installiert ist. Solche Lock-only-Einträge gehören nicht zum nutzbaren Inventar. Verfügbare Skills lassen sich mit der Skills-CLI prüfen und aktualisieren:

```pwsh
npx skills check
npx skills update
```

Vor Updates sollten Änderungen an `skills-lock.json`, den lokalen Skill-Verzeichnissen und Junction-Zielen gemeinsam geprüft werden. skills.sh-Links in diesem Dokument wurden am oben genannten Stand gegen die exakte Skill-Seite geprüft; lokale Quellen ohne belastbare Repository-Zuordnung erhalten keinen geratenen skills.sh-Link.
