# E-Invoice Gatekeeper *(working title)*

**Turn any PDF invoice into a valid XRechnung or ZUGFeRD e-invoice — the LLM proposes, the official validator decides.**

> Status: in development for the **Nebius x NVIDIA Global AI Hackathon** (Best Apps and Agents Track, deadline Oct 30, 2026).

## Why

Germany is moving B2B invoicing from PDF to structured e-invoices (EN 16931). Most small businesses still produce PDFs. Existing "AI converters" let a language model write the invoice and hope it is correct. For an invoice, "probably correct" is not good enough.

## How it works

```
PDF ──► Nemotron Nano Omni        reads page images, returns JSON with evidence per field
    ──► Deterministic core        normalizes codes, recomputes all amounts (no LLM math)
    ──► CII builder               JSON → XML (the LLM never writes XML)
    ──► KoSIT validator           official XRechnung reference validator = ground truth
          │ invalid
          ▼
        Nemotron 3 Ultra          maps rule violations to evidence-backed JSON patches
          │ still missing facts
          ▼
        Human input               facts that are not in the document are asked, never invented
    ──► Output                    XRechnung XML · ZUGFeRD PDF/A-3 · hash-chained audit log
```

Every step (model call, derivation, validator verdict, user input) is written to a SHA-256 hash chain that can be verified independently.

## Stack

- TypeScript monorepo (pnpm): Next.js app, core engine, eval harness
- Java 21 verifier service: KoSIT Validator + XRechnung configuration, Mustang (ZUGFeRD)
- Nebius Token Factory: NVIDIA Nemotron 3 Nano Omni (extraction), Nemotron 3 Ultra (repair), Nemotron 3 Nano/Super (explanations)
- Tavily: fallback context for unknown validation rules
- Hosting: Koyeb

## Repository layout (planned)

```
apps/web            Next.js UI + API routes + agent loop (SSE)
packages/core       semantic model (zod), derivation, CII builder, audit chain, agent loop
services/verifier   Java service: KoSIT validation, PDF/A rendering, ZUGFeRD combine/validate
eval/               corpus builder, mutations, benchmark harness, results
docs/               PRD, SRS (German)
.planning/          GSD project, requirements, roadmap (German)
```

## Getting started

Requirements: Node 22+, pnpm, Docker. No local Java needed; the verifier builds in Docker.

```bash
cp .env.example .env          # add NEBIUS_API_KEY and a random VERIFIER_SECRET
pnpm install
docker compose up -d --build verifier
pnpm testsuite:fetch          # pinned KoSIT XRechnung test suite, checksum-verified
pnpm verifier:check           # all CII suite instances valid, mutations rejected with rule IDs
pnpm smoke:llm                # one extraction and one repair call via Token Factory, with cost
pnpm typecheck && pnpm test
```

## Test data

Only synthetic data. Ground truth comes from the public KoSIT XRechnung test suite; PDFs are rendered from it in several layouts and degraded variants. No real invoices, no personal data.

## Benchmark

_TBD — results from `eval/` will be published here._

## License

Apache License 2.0. Third-party components (KoSIT Validator, KoSIT configuration and visualization, Mustangproject) are used under their own licenses.
