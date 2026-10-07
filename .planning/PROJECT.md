# E-Invoice Gatekeeper

## What This Is

Open-Source-Web-App, die beliebige PDF-Rechnungen in valide E-Rechnungen umwandelt: XRechnung (CII) und ZUGFeRD PDF/A-3. NVIDIA-Nemotron-Modelle auf Nebius Token Factory extrahieren und reparieren, der offizielle KoSIT-Validator entscheidet. Fehlende Fakten werden erfragt, nicht erfunden. Entsteht als Einreichung für den Nebius x NVIDIA Global AI Hackathon (Best Apps and Agents Track).

## Core Value

Eine E-Rechnung wird nur als valide ausgegeben, wenn der offizielle Validator das bestätigt und jedes Feld eine nachweisbare Herkunft hat.

## Requirements

### Validated
(noch keine)

### Active
Siehe `.planning/REQUIREMENTS.md` (v1).

### Out of Scope
- Versand (Peppol, E-Mail, Portale) — kein Bewertungskriterium, großer Aufwand
- ERP-/Buchhaltungs-Integrationen — außerhalb Zeitbudget
- Eingangsrechnungen — anderes Produkt
- UBL, Gutschriften-Sonderfälle, Fremdwährung — Korpus- und Zeitbudget
- Nutzerkonten, Datenbank, Payment — nicht nötig für Demo, erhöht Datenschutzaufwand
- Wiederverwendung von Code oder Regeln aus anderen, privaten Projekten — fremdes geistiges Eigentum

## Context

- Hackathon-Regeln: Laufzeitaufruf von Token Factory, mindestens ein NVIDIA-Open-Source-Modell, öffentliches Repo mit OSS-Lizenz, Demo-URL, YouTube-Video ≤ 3 min mit Audio zur Token-Factory-Nutzung, alle Materialien auf Englisch, Feedback-Abschnitt.
- Bewertung: Technological Implementation, Design, Potential Impact, Quality of the Idea, gleich gewichtet. Nebenpreise: Tavily-Bonus, City Winner Berlin.
- Bausteine: KoSIT Validator, validator-configuration-xrechnung, xrechnung-testsuite, xrechnung-visualization; Mustangproject (Apache 2.0).
- Budget: 50 $ Token-Factory-Credits (Event-Code + Builder Program), 25 $ Tavily, Koyeb wenige Euro/Monat.
- Einreichung als Einzelperson (Patrick Werle).

## Constraints

- **Deadline:** 30.10.2026, 10:00 PDT = 18:00 MEZ. Ziel-Einreichung 28.10.
- **Zeit:** ~50 h Gesamtaufwand neben anderen Projekten.
- **Tech:** TypeScript/Node, Java nur im Verifier. Keine Datenbank.
- **Daten:** ausschließlich synthetisch.
- **Verfügbarkeit:** Demo online bis 15.12.2026.

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Validator als Gate, LLM nur JSON-Patches | Produktaussage, Fehler lokalisierbar | — Pending |
| ZUGFeRD mit Cut-Gate 23.09. | Höchstes technisches Risiko | — Pending |
| Kill-Gate Kernschleife 10.10. | Zeitbudget schützen | — Pending |
| Koyeb für web + verifier | Kein Kaltstart | — Pending |
| Apache 2.0 | Pflicht + Kompatibilität | ✓ Final |

---
*Last updated: 2026-09-16 after bootstrap*
