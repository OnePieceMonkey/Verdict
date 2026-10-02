# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary audience: the hackathon jury, mostly through a ≤ 3-minute video** (Nebius × NVIDIA Global AI Hackathon, track "Best Apps and Agents"). Judges score Technological Implementation, Design, Potential Impact and Quality of the Idea equally and are not required to run the demo themselves. The interface has to make the mechanism legible on screen within seconds.
- **Demo persona:** small German businesses, trades and freelancers who still write invoices as PDF (Word, Excel, trade software) and now need EN 16931 e-invoices. They know nothing about XRechnung rules and should not have to.
- **Secondary:** bookkeeping and software vendors who care about a traceable conversion with an audit record.

## Product Purpose

Verdict turns a PDF invoice into a valid XRechnung (CII). NVIDIA Nemotron models on Nebius Token Factory read the document and propose; the official KoSIT validator decides. Facts that are not printed on the document are asked for, never invented. Success: an e-invoice is only shown as valid when the official validator confirms it and every field has a traceable origin.

## Positioning

Other AI converters let a language model write the invoice and hope it is right. Verdict never lets the model write XML or do arithmetic: every field carries a verbatim quote from the PDF, amounts are computed deterministically, and the government reference validator is the final gate. Verdict also catches errors the validator itself accepts (a misread quantity that still adds up, a unit like "Stück" that KoSIT tolerates, a postcode read as city) and stops instead of shipping them.

## Operating Context

- Input: a PDF with a text layer (no scans or photos in this build; Nemotron vision models are not available on Token Factory).
- Pipeline states streamed live: ingest → extract → evidence check → normalize → derive → consistency check → build CII → validate → up to 3 repair rounds → output or needs-input.
- Output: XRechnung XML, a hash-chained audit log (JSONL) verifiable with `pnpm audit:verify`. ZUGFeRD PDF/A-3 comes later in phase 4, only after the core UI ships.
- A gallery of precomputed runs on synthetic invoices (clean, noisy, mutated) must work even when the daily model budget is exhausted.
- Hosting target in the plan: Koyeb (web public, verifier internal). Demo must stay online until 15.12.2026.

## Capabilities and Constraints

- Scope: commercial invoice (380), EUR, SEPA credit transfer, no allowances/charges, no prepaid or rounding amounts.
- Limits: max 5 MB, max 5 pages; daily model budget and per-IP rate limit.
- Measured on the non-holdout corpus (02.10.2026): clean 41/45 valid with correct totals and full provenance, noisy 23/30 (rest asked for input), mutated 25/26 handled as expected; ~0.3 ct and ~7 s per invoice.
- All hackathon materials, including the UI, are in English. Invoice content stays German.
- No accounts, no database, no payment.

## Brand Commitments

- Name: **Verdict** (confirmed 02.10.2026).
- Own identity, independent of Patrick's personal design system.
- Must name "Nebius Token Factory" and the NVIDIA Nemotron models visibly (hackathon rule).
- Voice: precise, calm, evidence-first. No hype words.

## Evidence on Hand

- Real benchmark reports from `pnpm eval` (`eval/results/*.json|md`, regenerated per run).
- Synthetic invoice corpus (`eval/corpus/generated/`, built by `pnpm corpus:build` from the Apache-2.0 KoSIT test suite with fictional names).
- No customers, testimonials, press, pricing or deployment claims exist. Do not fabricate them.

## Product Principles

1. The validator has the last word; "valid" only appears with a verifier report hash behind it.
2. Show the evidence: every value can be traced to its quote on the page.
3. Ask, never invent: missing facts become a short, specific question.
4. Fail safe over fail silent: an uncertain invoice stops with a reason instead of passing.
5. Make the machinery visible but calm: the jury should see the agent work without noise.
