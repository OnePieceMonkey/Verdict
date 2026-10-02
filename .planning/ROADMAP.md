# Roadmap: E-Invoice Gatekeeper

## Overview

Fünf Phasen vom 17.09. bis 28.10.2026, ~50 h Gesamtaufwand. Die riskantesten Teile kommen zuerst: Verifier und ZUGFeRD-Spike in Phase 1, messbarer Korpus in Phase 2, dann die Kernschleife mit hartem Kill-Gate. UI und Einreichung erst, wenn der Kern trägt.

## Phases

- [ ] **Phase 1: Fundament & Verifier** — Repo, Credits, Java-Verifier, ZUGFeRD-Spike (17.–23.09., ~10 h)
- [x] **Phase 2: Korpus & Ground Truth** (02.10.) — Testdaten, deterministischer Kern ohne LLM, Eval-Harness (24.–30.09., ~9 h)
- [ ] **Phase 3: Kernschleife** — Extraktion, Reparatur, Rückfrage, Audit-Log (01.–10.10., ~14 h)
- [ ] **Phase 4: Produkt** — Web-UI, Erklärungen, Galerie, Deployment, danach ZUGFeRD-Ausgabe (11.–21.10., ~11 h + ZUGFeRD-Timebox 5 h)
- [ ] **Phase 5: Einreichung** — Holdout-Benchmark, README, Video, Devpost (22.–28.10., ~6 h)

## Gates

| Gate | Datum | Kriterium | Wenn nicht erfüllt |
|---|---|---|---|
| Cut-Gate ZUGFeRD | Mi 23.09. | VER-04 erfüllt | ~~ZUGFeRD streichen~~ → 02.10.: nach Phase 4 verschoben (VER-06 + CORE-05) |
| Kill-Gate Kern | Sa 10.10. | ≥ 16 von 20 PDFs aus Set clean (ohne Holdout) ergeben valide XRechnung mit korrekten BT-112/BT-115 und 0 Feldern ohne Herkunft | Projekt abbrechen, nichts einreichen |
| Stunden-Check | jeden Sonntag | Ist-Stunden ≤ Plan + 20 % | Scope der nächsten Phase kürzen, nicht Zeit verlängern |

## Phase Details

### Phase 1: Fundament & Verifier
**Goal**: Der offizielle Validator läuft als Dienst, Token Factory ist angebunden, und die ZUGFeRD-Frage ist entschieden.
**Depends on**: —
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-05, VER-01, VER-02, VER-03, VER-04, VER-05
**Success Criteria** (what must be TRUE):
  1. Eine valide Testsuite-XML liefert `valid: true`, eine mutierte liefert Regel-ID und Fundstelle
  2. Ein Smoke-Test ruft Nano Omni mit einem Seitenbild und Ultra mit einem Textprompt erfolgreich auf, Kosten werden geloggt
  3. ZUGFeRD-Spike ergibt eine von Mustang als valide gemeldete Datei oder eine dokumentierte Cut-Entscheidung
  4. Verifier läuft auf Koyeb, RAM-Bedarf gemessen und notiert
**Plans**: TBD
**Vorab zu klären**: Token-Factory-Base-URL und Modell-IDs, Koyeb-Private-Networking, Testsuite-Lizenz

**Stand 02.10.2026**
- Token Factory: Base-URL `https://api.tokenfactory.nebius.com/v1`. Die verfügbaren NVIDIA-Modelle sind **nur Text**: Nemotron-3-Nano-30B-A3B, Nemotron-3_5-Lightning, nemotron-3-super-120b-a12b, Nemotron-3-Ultra-550b-a55b. **Nano Omni (Vision) gibt es dort nicht.** Bildfähig sind nur Fremdmodelle (Qwen3.8-27B, GLM-5.3-Flash, Kimi, MiniCPM-V, DeepSeek-V4.1-Flash). Auch die Regionen us-central1 und eu-north1 sowie die IDs `nvidia/nemotron-3-nano-omni` und Nemotron-Nano-2-VL-Varianten liefern „does not exist“ (Nano 2 VL war laut Nebius-Blog früher in AI Studio). **Entscheidung 02.10. (Patrick): vorerst Textlayer + Nemotron-Textmodelle, kein Fremd-Vision-Modell.** Bildpfad bleibt hinter einer Extractor-Schnittstelle austauschbar. Offen: bei Nebius (Discord #token-factory-support) nach Nemotron-Vision fragen; Alternative Nebius AI Cloud mit selbst gehostetem Nemotron Parse / Nano VL.
- Smoke-Test (`pnpm smoke:llm`): Super extrahiert per JSON-Schema (Constrained Decoding), 5/5 Zitate wörtlich im Text; Ultra liefert einen Patch mit Zitat. Kosten 0,0006 USD. `enable_thinking: false` halbiert die Latenz.
- Verifier: KoSIT 1.6.3 + Konfiguration 2026-08-31 in Docker, ohne lokales Java. `pnpm verifier:check`: 41/41 CII-Instanzen der Testsuite valide, 4/4 Mutationen mit erwarteter Regel-ID abgelehnt. JDK-`HttpServer` statt Javalin (keine Klassenkonflikte mit dem KoSIT-Fat-Jar).
- Befund: 2 Testsuite-Instanzen (04.05a, 02.01a-cvd) sind ACCEPTABLE trotz Codelisten-Meldungen der Stufe `error`. „Valid“ folgt deshalb ausschließlich der `acceptRecommendation`, nie der Fehlerzählung.
- Cut-Gate ZUGFeRD: ohne Spike verstrichen → ZUGFeRD aus Phase 1 genommen, in Phase 4 verankert (VER-06 + CORE-05, nach Kill-Gate).
- Offen in Phase 1: Koyeb-Deployment (OPS-05), erster CI-Lauf auf GitHub (OPS-01/02).

### Phase 2: Korpus & Ground Truth
**Goal**: Es gibt einen reproduzierbaren, gemessenen Maßstab, bevor irgendein Modell Rechnungen verarbeitet.
**Depends on**: Phase 1
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, CORE-01, CORE-02
**Success Criteria** (what must be TRUE):
  1. `pnpm corpus:build` erzeugt auf einem frischen Checkout dieselben Dateien (Hash-Vergleich)
  2. ≥ 60 PDFs über die Sets clean und noisy, ≥ 10 Mutationstypen
  3. Roundtrip Ground Truth → CII-Builder → Verifier ist für alle Korpusrechnungen im Scope valide
  4. Eval-Report läuft durch (mit Dummy-Extraktor), Holdout ist abgetrennt
**Plans**: TBD
**Hinweis**: ~~Builders & Brews Berlin keine Voraussetzung für den City Award~~ — laut Devpost-Mail ist der City Award nur für Teilnehmende eines Treffens. Siehe BACKLOG.

**Stand 02.10.2026 (Phase 2 abgeschlossen)**
- Scope: 19 Testsuite-Rechnungen (380, EUR, ohne Nachlässe/Zuschläge/Vorauszahlung/Rundung, Zahlung per Überweisung 58 oder ohne). Liste in `eval/src/scope.ts`.
- CORE-01: abgeleitete Summen = gedruckte Summen für 19/19 (USt ±0,01 nach BR-CO-17; 01.06_minimal druckt 757,41 statt 757,40). CORE-02: Rundtest 19/19 ACCEPTABLE.
- Korpus: clean 45 (3 Layouts), noisy 30 (2 Varianten), mutated 26 (13 Typen, jeder gegen den Verifier geprüft), Holdout 20 (01.03a, 01.09a, 01.10a, 01.14a per Hash). Rebuild byte-identisch.
- Befunde Verifier: `BR-CL-23` (Einheit „Stück") wird gemeldet, aber ACCEPTABLE. `BR-CO-25` (weder Fälligkeit noch Zahlungsbedingungen) greift nicht.
- Testdaten-Hygiene nach den ersten Messungen: Platzhalter („[Seller name]", „nicht vorhanden", „-", Rechnungsnummer „Rechnungsnummer") durch erfundene Werte ersetzt; Positions-IDs > 4 Zeichen werden zur Positionsnummer (das MVP-Modell hat keine Artikelnummer-Spalte). Weil das nach Sicht auf Ergebnisse geschah, zählt für den Benchmark nur der Holdout.

### Phase 3: Kernschleife
**Goal**: Aus einem PDF entsteht über Extraktion, Validierung und Reparatur eine valide XRechnung mit lückenloser Herkunft und Audit-Log.
**Depends on**: Phase 2
**Requirements**: OPS-04, EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, CORE-03, CORE-04, REP-01, REP-02, REP-03, REP-04, AUD-01, AUD-02, AUD-03
**Success Criteria** (what must be TRUE):
  1. Kill-Gate-Kriterium erfüllt (siehe Gates)
  2. Auf dem Set mutated löst die Reparatur mindestens die Hälfte der aus dem Dokument lösbaren Fehler; nicht lösbare landen in NEEDS_INPUT
  3. `pnpm audit:verify` besteht für echte Läufe und schlägt für manipulierte Logs fehl
  4. Kosten pro Rechnung und Laufzeit sind im Eval-Report sichtbar
**Plans**: TBD
**Arbeitsweise**: CLI zuerst (`pnpm run:invoice <pdf>`), UI erst in Phase 4

**Stand 02.10.2026 (Kill-Gate erfüllt, 8 Tage vor Termin)**
- Pipeline `pnpm eval --set <set> --pipeline agent`: Textlayer → Nemotron Super (JSON-Schema) → Zitat-Check → Normalisierung → Form-/Rollen-Regeln → Ableitung → Zeilen-Gegencheck → CII → KoSIT, bis 3 Reparaturrunden mit Nemotron Ultra hinter dem Patch-Guard, Audit-Kette.
- Messung (letzter Lauf): clean 41/45 = 91 % gültig mit korrekten BT-112/BT-115 und voller Herkunft (Kill-Gate ≥ 80 %), Feldgenauigkeit 98,4 %, 0,26 ct/Rechnung, Median 7,4 s. noisy 23/30 = 77 %, 98,8 %. mutated 25/26 = 96 % wie erwartet.
- Seit dem Zeilen-Gegencheck keine einzige valide Ausgabe mit falschem Betrag; Unsicheres endet in NEEDS_INPUT.
- Restfehler noisy: alle NEEDS_INPUT (Telefon/Land/Stadt bei Variante b: kleine Schrift, Seitenumbruch). Restfehler mutated: Verkäufer-Stadt aus gleichlautender Käuferadresse (gleiche PLZ 12345 in der Testsuite).
- Offen in Phase 3: OPS-04 ✓, CORE-04 (Download) mit UI; `pnpm run:invoice <pdf>`-CLI.

### Phase 4: Produkt
**Goal**: Eine Jurorin kann ohne Anleitung eine Beispielrechnung umwandeln, Fehler verstehen und alle Ergebnisse herunterladen.
**Depends on**: Phase 3
**Requirements**: EXP-01, EXP-02, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, danach VER-06 + CORE-05 (ZUGFeRD)
**ZUGFeRD-Regel (02.10.)**: Start nur nach bestandenem Kill-Gate und erst, wenn UI-Kernfluss und Deployment stehen. Timebox 5 h. Läuft Phase 4 über Plan, fällt ZUGFeRD als Erstes. Kein Umbau im Kern nötig: ZUGFeRD EN16931 nutzt dieselbe CII-XML.
**Success Criteria** (what must be TRUE):
  1. Galerie-Lauf und eigener Upload funktionieren auf der öffentlichen URL in unter 60 s (Median, ≤ 3 Seiten)
  2. Heruntergeladene Dateien bestehen eine unabhängige Prüfung (Verifier lokal bzw. Mustang-CLI)
  3. Bei erschöpftem Tagesbudget bleibt die Galerie nutzbar
  4. Tavily wird im Erklärungsfall zur Laufzeit aufgerufen und die Quelle angezeigt
**Plans**: TBD
**Skill**: `frontend-design` für UI-Arbeit nutzen

### Phase 5: Einreichung
**Goal**: Vollständige, regelkonforme Einreichung mit belastbaren Zahlen, zwei Tage vor Deadline.
**Depends on**: Phase 4
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04
**Success Criteria** (what must be TRUE):
  1. Holdout-Benchmark ausgewertet und unverändert im README berichtet
  2. Video ≤ 3:00, öffentlich, nennt Token Factory und Nemotron-Modelle
  3. Devpost-Checkliste vollständig: Demo-URL, Repo mit erkannter Lizenz, Beschreibung, Track, Feedback, Stadt
  4. Einreichung bestätigt am 28.10.; Puffer bis Fr 30.10., 18:00 MEZ
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Ist-Stunden | Completed |
|---|---|---|---|---|
| 1. Fundament & Verifier | — | In Progress (02.10.) | ? / 10 | - |
| 2. Korpus & Ground Truth | — | Complete | ? / 9 | 02.10. |
| 3. Kernschleife | — | Kill-Gate erfüllt, Rest offen | ? / 14 | - |
| 4. Produkt | 0/TBD | Not started | 0 / 11 | - |
| 5. Einreichung | 0/TBD | Not started | 0 / 6 | - |
