# Requirements: E-Invoice Gatekeeper

**Defined:** 2026-09-16
**Core Value:** Eine E-Rechnung wird nur als valide ausgegeben, wenn der offizielle Validator das bestätigt und jedes Feld eine nachweisbare Herkunft hat.

## v1 Requirements

### Setup & Betrieb (OPS)
- [ ] **OPS-01** *(02.10.: lokal grün, CI-Lauf auf GitHub steht aus)*: pnpm-Monorepo mit `apps/web`, `packages/core`, `services/verifier`, `eval`; TypeScript strict; `pnpm typecheck` und `pnpm test` laufen grün in CI
- [ ] **OPS-02** *(02.10.: Hook + CI-Job angelegt, GitHub-Lauf und Lizenz-Erkennung stehen aus)*: gitleaks in CI und pre-commit; Apache-2.0-LICENSE im Repo-Root, auf GitHub im About-Bereich erkannt
- [x] **OPS-03**: Credits eingelöst (Event-Code, Builder Program, Tavily); Smoke-Test ruft je ein Modell für Extraktion und Reparatur über Token Factory auf
- [x] **OPS-04**: Zentraler LLM-Client zählt Tokens und Kosten je Aufruf und bricht bei Überschreitung von `DAILY_BUDGET_USD` ab
- [ ] **OPS-05** *(02.10.: `docker compose up verifier` läuft lokal; Koyeb offen, Verifier braucht ~570 MB RAM)*: Deployment `web` (öffentlich) und `verifier` (intern oder Secret-geschützt) auf Koyeb; `docker compose up` startet den Verifier lokal

### Verifier (VER)
- [x] **VER-01**: `POST /v1/validate/xrechnung` liefert für jede valide Testsuite-Datei `valid: true` und für mutierte Dateien Fehler mit Regel-ID, Meldung und Fundstelle
- [x] **VER-02**: Versionen von Validator und Konfiguration sind gepinnt und werden in jeder Antwort mitgeliefert
- [x] **VER-03**: Report-Hash (SHA-256) in jeder Validierungsantwort
- [x] **VER-04** *(02.10.: Cut-Gate 23.09. ohne Spike verstrichen. ZUGFeRD aus Phase 1 genommen und als VER-06 + CORE-05 in Phase 4 verankert)*: Spike PDF/A-3: Aus einer Testsuite-XML entsteht eine ZUGFeRD-Datei, die `POST /v1/zugferd/validate` als valide meldet — oder dokumentierte Cut-Entscheidung bis 23.09.
- [x] **VER-05**: Alle Endpunkte verlangen `X-Verifier-Secret`; KoSIT-Daemon-GUI ist deaktiviert
- [ ] **VER-06** *(Phase 4, nur nach bestandenem Kill-Gate, Timebox 5 h)*: `POST /v1/zugferd/combine` (PDF/A + CII → ZUGFeRD PDF/A-3 via Mustang) und `POST /v1/zugferd/validate` (Mustang, gleiches Fehlerformat wie VER-01); die erzeugte Datei besteht die unabhängige Mustang-CLI-Prüfung

### Korpus & Evaluation (EVAL)
- [x] **EVAL-01**: `pnpm corpus:build` lädt die Testsuite in gepinnter Version und erzeugt reproduzierbar PDFs in den Sets clean, noisy, mutated mit Ground-Truth-Zuordnung
- [ ] **EVAL-02** *(02.10.: 3 eigene Layouts per pdfkit statt HTML/Playwright, damit Rebuilds byte-gleich sind; KoSIT-Visualisierung kommt mit dem Render-Endpunkt in Phase 4)*: Mindestens 3 eigene HTML-Layouts plus KoSIT-Visualisierung im Set clean
- [x] **EVAL-03**: Mindestens 10 Mutationstypen (u. a. fehlendes Pflichtfeld, falscher Einheitencode, inkonsistente Summe, falsche USt-Kategorie, fehlende Käuferreferenz)
- [x] **EVAL-04**: `pnpm eval --set <name>` erzeugt JSON- und Markdown-Report mit Validierungsquote, Feldgenauigkeit pro BT, Iterationen, Felder ohne Herkunft, Kosten, Laufzeit
- [x] **EVAL-05**: Holdout-Split (~20 %) wird bis Phase 5 nicht ausgewertet
- [x] **EVAL-06**: Lizenz der Testsuite geprüft; generierte Dateien nur committed, wenn zulässig

### Extraktion (EXT)
- [x] **EXT-01**: zod-Schema für MVP-BTs laut SRS §3 mit Provenance pro Feld
- [x] **EXT-02** *(02.10.: umgesetzt mit Textlayer + Nemotron Super statt Nano Omni, das in Token Factory fehlt)*: Nano Omni liefert schemakonformes JSON aus Seitenbildern; ungültiges JSON führt zu genau einem Retry, danach Fehlerzustand
- [x] **EXT-03**: Evidence-Check verwirft Felder, deren Zitat bei vorhandenem Textlayer nicht im Seitentext steht
- [x] **EXT-04**: Normalisierung gegen Codelisten (Einheiten, Länder, USt-Kategorien, Zahlungsarten); unbekannte Werte werden `missing`
- [x] **EXT-05**: Gedruckte Summen werden separat extrahiert und nur für den Konsistenzabgleich genutzt

### Kern & Ausgabe (CORE)
- [x] **CORE-01**: Deterministische Ableitung von BT-131, BG-23 und BG-22 mit Decimal-Arithmetik; Unit-Tests gegen alle validen Testsuite-Dateien im Scope
- [x] **CORE-02**: CII-Builder erzeugt aus Ground-Truth-Modellen XML, das VER-01 als valide meldet (Roundtrip-Test ohne LLM)
- [x] **CORE-03**: Konsistenzprüfung meldet Abweichung zwischen gedruckten und berechneten Summen als Warnung
- [ ] **CORE-04**: Ausgabe XRechnung-CII als Download
- [ ] **CORE-05** *(Phase 4, nur nach bestandenem Kill-Gate)*: Ausgabe ZUGFeRD PDF/A-3 (Profil EN16931) als Download

### Reparatur (REP)
- [x] **REP-01** *(Textlayer statt Seitenbilder)*: Ultra erhält Regelverletzungen, aktuelles Modell und Seitenbilder und liefert RFC-6902-Patches mit Provenance oder die Kennzeichnung "nicht aus Dokument lösbar"
- [x] **REP-02**: Patch-Guard verwirft Patches auf derived-Felder, ohne Provenance oder mit nicht nachweisbarem Zitat; jede Verwerfung im Audit-Log
- [x] **REP-03**: Maximal 3 Iterationen; Abbruch, wenn die Fehlerzahl nicht sinkt
- [x] **REP-04**: NEEDS_INPUT listet nur tatsächlich fehlende Felder mit Erklärung; Nutzereingabe erhält Provenance `user` und löst neue Validierung aus

### Audit (AUD)
- [x] **AUD-01**: JSONL-Hash-Kette nach SRS §6 (JCS, SHA-256, prevHash) für jeden Zustandsübergang
- [x] **AUD-02**: Modell-Events enthalten Modell-ID, Prompt-Hash, Tokens, Kosten, keine Rechnungsinhalte
- [x] **AUD-03**: `pnpm audit:verify` erkennt jede Manipulation an Events oder Ausgabedateien (Tests mit manipulierten Logs)

### Erklärung (EXP)
- [ ] **EXP-01**: Lokale Erklärungstabelle für die im Korpus auftretenden Regel-IDs (EN/DE)
- [ ] **EXP-02**: Fehlt ein Eintrag, erzeugt Nano/Super eine Erklärung; bei Bedarf Tavily-Aufruf mit angezeigter Quelle; Cache pro Regel-ID

### Web-UI (UI)
- [ ] **UI-01**: Upload mit Limits laut NFR-04 und klaren Fehlermeldungen
- [ ] **UI-02**: Live-Stream der Zustände per SSE mit Dauer je Schritt
- [ ] **UI-03**: Ergebnisansicht: Validator-Status, Regelverletzungen mit Erklärung, angewandte Patches mit Beleg, Konsistenzwarnungen
- [ ] **UI-04**: Formular für NEEDS_INPUT
- [ ] **UI-05**: Downloads: XRechnung-XML, ZUGFeRD-PDF, Audit-Log
- [ ] **UI-06**: Beispielgalerie mit mindestens 6 vorberechneten Läufen (clean, noisy, mutated), funktioniert auch bei erschöpftem Budget
- [ ] **UI-07**: Rate-Limit pro IP, Tagesbudget-Anzeige, Fallback auf Galerie

### Einreichung (SUB)
- [ ] **SUB-01**: README (EN) mit Setup, Architektur, Nemotron-/Token-Factory-Nutzung, Benchmark-Zahlen inkl. Holdout
- [ ] **SUB-02**: Video ≤ 3 min auf YouTube (öffentlich), Token-Factory-Nutzung im Audio, keine fremde Musik
- [ ] **SUB-03**: Devpost-Beschreibung, Track-Wahl, Feedback-Abschnitt, Stadt Berlin angegeben
- [ ] **SUB-04**: Einreichung abgeschlossen bis 28.10.2026

## v2 Requirements (nicht im Hackathon)

- **V2-01**: UBL-Ausgabe
- **V2-02**: Nachlässe/Zuschläge (BG-20/21), Gutschriften (381)
- **V2-03**: Eingangsrechnungen: E-Rechnung prüfen und erklären
- **V2-04**: API mit Schlüsselverwaltung
- **V2-05**: Vergleichsbenchmark gegen kommerzielle Konverter

## Out of Scope

| Feature | Reason |
|---|---|
| Versand Peppol/E-Mail | Kein Bewertungskriterium, großer Aufwand |
| ERP-Integrationen | Zeitbudget |
| Nutzerkonten, Datenbank | Nicht nötig, Datenschutzaufwand |
| Handschrift | Korpus nicht vorhanden |
| Labrechner-Code/-Regeln | IP im Asset-Deal |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| OPS-01, OPS-02, OPS-03, OPS-05 | Phase 1 | Pending |
| VER-01, VER-02, VER-03, VER-04, VER-05 | Phase 1 | Pending |
| EVAL-01 – EVAL-06 | Phase 2 | Pending |
| CORE-01, CORE-02 | Phase 2 | Pending |
| OPS-04 | Phase 3 | Pending |
| EXT-01 – EXT-05 | Phase 3 | Pending |
| CORE-03, CORE-04 | Phase 3 | Pending |
| REP-01 – REP-04 | Phase 3 | Pending |
| AUD-01 – AUD-03 | Phase 3 | Pending |
| CORE-05, VER-06 | Phase 4 | Pending (nach Kill-Gate) |
| EXP-01, EXP-02 | Phase 4 | Pending |
| UI-01 – UI-07 | Phase 4 | Pending |
| SUB-01 – SUB-04 | Phase 5 | Pending |

**Coverage:** 46 v1 Requirements, alle einer Phase zugeordnet.

---
*Last updated: 2026-09-16 after bootstrap*
