# Dokumentenpaket: E-Invoice Gatekeeper

- **Projekt:** E-Invoice Gatekeeper (Arbeitstitel)
- **Dokumentstatus:** Entwurf
- **Basis:** Chat-Discovery vom 16.09.2026 (Hackathon-Regeln, Machbarkeitsprüfung Testdaten/Credits, Scope-Entscheidungen)
- **Stand:** 16.09.2026
- **Umfang:** schlankes Setup — PRD, SRS, GSD-Planung, CLAUDE.md, README. Bewusst ohne MRD/BRD, Rollen-Agents und projektspezifische Skills.
- **Annahmen:** 5 (PRD §2, §9, §10; SRS §3, §6)
- **Offene Punkte:** 7

## Offene Punkte (vor bzw. in Phase 1 klären)

1. Token Factory: Base-URL, exakte Modell-IDs, Multi-Image-Support von Nano Omni
2. Lizenz der KoSIT-Testsuite (Weitergabe generierter Dateien)
3. PDF/A-3-Kette für ZUGFeRD (Spike, Cut-Gate 23.09.)
4. Koyeb: privates Netz zwischen Services, JVM-RAM-Bedarf
5. Tatsächliche Preise der Modelle auf Token Factory (bisher nur Drittquellen)
6. Produktname
7. Sprache der Planungsdokumente im öffentlichen Repo

## Dateien

| Datei | Zweck |
|---|---|
| `docs/PRD.md` | Problem, Use Cases, Features, Jury-Kriterien, Video-Storyboard, Erfolgskriterien |
| `docs/SRS.md` | Architektur, Semantic Model, State Machine, Audit-Log, Verifier-API, NFRs, Risiken |
| `.planning/PROJECT.md` | GSD-Projektkontext |
| `.planning/REQUIREMENTS.md` | 46 v1-Requirements mit Phasenzuordnung |
| `.planning/ROADMAP.md` | 5 Phasen, Gates, Stundenbudget |
| `.planning/BACKLOG.md` | Parkplatz für Ideen außerhalb des Scopes |
| `.claude/CLAUDE.md` | Verbindliche Regeln für Claude Code |
