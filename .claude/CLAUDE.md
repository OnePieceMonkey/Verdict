# E-Invoice Gatekeeper

## Projekt-Kontext
Hackathon-Projekt (Nebius x NVIDIA Global AI Hackathon, Deadline 30.10.2026, 10:00 PDT = 18:00 MEZ). Web-App, die PDF-Rechnungen in valide XRechnung (CII) umwandelt (ZUGFeRD-PDF/A-3 erst in Phase 4, nach bestandenem Kill-Gate). Nemotron-Modelle auf Nebius Token Factory extrahieren und reparieren, der KoSIT-Validator entscheidet. Öffentliches Repo, Apache 2.0, harte Zeitgrenze ~50 h Gesamtaufwand.

Maßgebliche Dokumente: `docs/PRD.md`, `docs/SRS.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`. Vor jeder Aufgabe prüfen, zu welcher Phase und welcher Requirement-ID sie gehört.

## Tech Stack
- pnpm-Monorepo, TypeScript strict, Node 22
- `apps/web`: Next.js (App Router), Tailwind, Agent-Loop serverseitig mit SSE-Stream
- `packages/core`: zod-Schemas (Semantic Model), Decimal-Arithmetik (`decimal.js`), CII-Builder, Audit-Chain (SHA-256 + JCS/RFC 8785), Agent-Loop als State Machine
- `services/verifier`: Java 21, JDK-`HttpServer` (kein Javalin, um Klassenkonflikte mit dem KoSIT-Fat-Jar zu vermeiden), KoSIT Validator 1.6.3 + validator-configuration-xrechnung 2026-08-31 (im Dockerfile mit SHA-256 gepinnt), Build nur in Docker
- `eval/`: Korpus-Builder (Playwright für PDF-Rendering), Mutationen, Benchmark-Harness
- LLM: Nebius Token Factory, OpenAI-kompatibel, `https://api.tokenfactory.nebius.com/v1` (verifiziert 02.10.). Nemotron gibt es dort nur als Textmodell, kein Nano Omni. Preise gepinnt in `packages/core/src/llm/pricing.ts`. Tavily
- Tests: vitest (TS), JUnit (Java). Hosting: Koyeb (web + verifier, verifier nur intern)

## Architektur
PDF → Rasterisierung + Textlayer → EXTRACT (Nano Omni, JSON mit Evidenz) → EVIDENCE_CHECK → NORMALIZE → DERIVE (Beträge, USt-Aufschlüsselung) → BUILD_CII → VALIDATE (KoSIT) → bei Fehlern REPAIR (Ultra, JSON Patch mit Evidenz) → max. 3 Iterationen → NEEDS_INPUT oder OUTPUT (XRechnung XML, ZUGFeRD PDF/A-3, Audit-Log). Details: `docs/SRS.md`.

## Wichtige Regeln (gelten IMMER)
1. **Das LLM schreibt nie XML.** Modelle liefern ausschließlich JSON gegen das zod-Schema. XML entsteht nur im deterministischen CII-Builder.
2. **Das LLM rechnet nie.** Alle Beträge, Summen und USt-Aufschlüsselungen berechnet `packages/core` mit Decimal-Arithmetik. Keine `number`-Floats für Geld.
3. **Keine erfundenen Fakten.** Jedes Feld hat genau eine Herkunft: `evidence` (Zitat + Seite aus dem Dokument), `derived` (benannte deterministische Regel) oder `user` (Eingabe). Sonst bleibt es leer und landet in NEEDS_INPUT. Ein Repair-Patch ohne Herkunft wird verworfen.
4. **Der Validator hat das letzte Wort.** "Valid" wird nur angezeigt, wenn ein Verifier-Report mit Hash im Audit-Log steht.
5. **IP-Trennung zu Labrechner.** Kein Code, keine Regeln, keine Datenmodelle, keine Audit-Chain-Implementierung aus Labrechner oder anderen privaten Repos kopieren oder aus Erinnerung nachbauen. Alles hier ist neu geschrieben.
6. **Nur synthetische Daten.** Keine echten Rechnungen, keine personenbezogenen Daten im Repo, in Logs oder Fixtures.
7. **Öffentliches Repo.** Secrets nur über ENV. gitleaks läuft in CI und pre-commit. Nie Keys in Code, Tests, Screenshots oder Eval-Reports.
8. **Kosten-Guard.** Jeder Modellaufruf läuft über einen zentralen Client, der Tokens und Kosten zählt und das Tagesbudget (`DAILY_BUDGET_USD`) durchsetzt.
9. **Scope-Disziplin.** Nichts bauen, was nicht in `.planning/REQUIREMENTS.md` steht. Neue Ideen in `.planning/BACKLOG.md` notieren, nicht umsetzen.
10. **Gates respektieren.** Das Kill-Gate Kern ist verbindlich, siehe Roadmap. ZUGFeRD ist in Phase 4 verankert (VER-06 + CORE-05) und startet erst nach dem Kill-Gate.
11. **„Valid“ heißt `acceptRecommendation == ACCEPTABLE`.** Nie aus der Zahl der `error`-Meldungen ableiten: Die XRechnung-Konfiguration akzeptiert manche Codelisten-Fehler.

## Konventionen
- Code, Kommentare, Commit-Messages, README, UI: Englisch. Planungsdokumente: Deutsch.
- Conventional Commits (`feat(core): ...`, `fix(verifier): ...`), kleine Commits pro Requirement-ID, ID im Commit-Body.
- Dateinamen kebab-case, Typen PascalCase, keine Default-Exports in `packages/core`.
- ESLint + Prettier, `pnpm typecheck && pnpm test` muss vor jedem Commit grün sein.
- Jede neue Zuordnung Validator-Regel → BT-Feld bekommt einen Test mit mutierter Rechnung.
- Versionen von KoSIT-Validator, XRechnung-Konfiguration, Mustang und Modell-IDs zentral pinnen und im Audit-Log mitschreiben.

## Befehle (werden in Phase 1 angelegt)
- `pnpm dev` · `pnpm test` · `pnpm typecheck`
- `pnpm corpus:build` · `pnpm eval --set clean|noisy|mutated`
- `docker compose up verifier` · `pnpm testsuite:fetch` · `pnpm verifier:check` · `pnpm smoke:llm`

## Nützliche globale Skills
- `frontend-design` für die UI in Phase 4
