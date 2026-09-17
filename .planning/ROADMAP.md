# Roadmap: E-Invoice Gatekeeper

## Overview

Fünf Phasen vom 17.09. bis 28.10.2026, ~50 h Gesamtaufwand. Die riskantesten Teile kommen zuerst: Verifier und ZUGFeRD-Spike in Phase 1, messbarer Korpus in Phase 2, dann die Kernschleife mit hartem Kill-Gate. UI und Einreichung erst, wenn der Kern trägt.

## Phases

- [ ] **Phase 1: Fundament & Verifier** — Repo, Credits, Java-Verifier, ZUGFeRD-Spike (17.–23.09., ~10 h)
- [ ] **Phase 2: Korpus & Ground Truth** — Testdaten, deterministischer Kern ohne LLM, Eval-Harness (24.–30.09., ~9 h)
- [ ] **Phase 3: Kernschleife** — Extraktion, Reparatur, Rückfrage, Audit-Log (01.–10.10., ~14 h)
- [ ] **Phase 4: Produkt** — Web-UI, ZUGFeRD-Ausgabe, Erklärungen, Galerie, Deployment (11.–21.10., ~11 h)
- [ ] **Phase 5: Einreichung** — Holdout-Benchmark, README, Video, Devpost (22.–28.10., ~6 h)

## Gates

| Gate | Datum | Kriterium | Wenn nicht erfüllt |
|---|---|---|---|
| Cut-Gate ZUGFeRD | Mi 23.09. | VER-04 erfüllt | ZUGFeRD streichen (CORE-05 entfällt), Scope XRechnung-only, Roadmap anpassen |
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
**Hinweis**: Builders & Brews Berlin am Di 29.09. optional (Credits, Kontakte). Keine Voraussetzung für den City Award.

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

### Phase 4: Produkt
**Goal**: Eine Jurorin kann ohne Anleitung eine Beispielrechnung umwandeln, Fehler verstehen und alle Ergebnisse herunterladen.
**Depends on**: Phase 3
**Requirements**: CORE-05, EXP-01, EXP-02, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
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
| 1. Fundament & Verifier | 0/TBD | Not started | 0 / 10 | - |
| 2. Korpus & Ground Truth | 0/TBD | Not started | 0 / 9 | - |
| 3. Kernschleife | 0/TBD | Not started | 0 / 14 | - |
| 4. Produkt | 0/TBD | Not started | 0 / 11 | - |
| 5. Einreichung | 0/TBD | Not started | 0 / 6 | - |
