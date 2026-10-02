---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Surface: Verdict app (single screen, `/`)

Mode: Operate. Audience: hackathon jury via a ≤ 3-minute video; demo persona a German small business with PDF invoices. Task: drop a PDF (or pick a gallery example), watch the run, read the verdict, answer missing facts, download XRechnung + audit log. Constraints: English UI, invoice content German, Nebius Token Factory and Nemotron named visibly, gallery works with no budget, desktop first for the video, usable on mobile.

## Direction contract

THESIS: The run is a German office routing slip (Laufzettel): every station signs off with time and initials, and the verdict lands as an official inspection stamp with the report hash. Refuses the category default of "PDF left, field list right, green ticks".

OWN-WORLD: Recycled-paper grey ground (#F2F3EE), ink near-black, violet stamp ink (#4536A8) for accepted, stamp red (#C2382B) for rejected, folder-tab yellow (#E7C43F) for needs-input, office green (#2F5D4A) for the shell rail. Flat colour only, no gradients or glass. DIN-like grotesk (Barlow / Barlow Condensed for stamp caps) plus a monospace for BT codes, hashes, ms and cents. Hairline rules, square corners.

STORY: The visitor sees an invoice go in, watches Nemotron and the validator sign off station by station, understands every value is quoted from the page, sees rejected values struck through and stamped VOID instead of hidden, and leaves with a stamped, valid e-invoice or a short, specific question.

FIRST VIEWPORT: Top bar (Verdict wordmark, "Nemotron on Nebius Token Factory · KoSIT 1.6.3", budget meter, gallery). Three work areas: left the PDF page with quote highlights; centre the extracted facts grouped (Invoice, Seller, Buyer, Payment, Lines, Totals), each with BT code and provenance; right the routing slip as a vertical timeline whose bar lengths are real durations. The verdict stamp sits at the top of the centre column, rotated about -4°, the signature move.

FORM: Behörden-Laufzettel & Prüfstempel, candidate 3 of 7 on the ordered list; seed key b067d9c4. Raises: nothing disappears, it cancels (ticket wallet); length = duration (Labanotation); registered page across states (botanical folio); flat committed colour (zoo map); tiny monospace readouts against one large figure (type specimen).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
