---
name: Verdict
description: PDF invoice to valid XRechnung, recorded as a German office routing slip and an inspection stamp.
colors:
  paper: "#f2f3ee"
  sheet: "#fbfbf8"
  page-white: "#ffffff"
  rule: "#d5d7cf"
  rule-strong: "#b6b9ae"
  ink: "#1c1f22"
  ink-2: "#4a4f54"
  ink-3: "#62676d"
  office: "#2f5d4a"
  office-2: "#3c6f59"
  office-ink: "#e8efe9"
  stamp: "#4536a8"
  stamp-wash: "#e7e4f6"
  void: "#c2382b"
  void-wash: "#f6e3df"
  tab: "#e7c43f"
  tab-wash: "#f7eec4"
  tab-ink: "#5a4708"
  quote: "#f3e7a0"
typography:
  stamp-title:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  display:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  wordmark:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  title-caps:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25rem
    letterSpacing: "0.12em"
  body-lg:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5rem
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.25rem
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  label-caps:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1rem
    letterSpacing: "0.1em"
  note:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1rem
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1rem
rounded:
  none: "0px"
spacing:
  row-tight: "6px"
  row: "10px"
  inline: "8px"
  cell: "12px"
  panel: "16px"
  gutter-mobile: "16px"
  gutter-desktop: "24px"
  stack: "24px"
  column-gap: "32px"
  group: "32px"
components:
  top-bar:
    backgroundColor: "{colors.office}"
    textColor: "{colors.office-ink}"
    height: "56px"
    padding: "0 24px"
  button-stamp:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.page-white}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    height: "36px"
    padding: "0 12px"
  button-stamp-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page-white}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "36px"
    padding: "0 12px"
  button-outline-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    height: "40px"
    padding: "0 16px"
  button-ink-hover:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.sheet}"
  button-ink-disabled:
    backgroundColor: "{colors.ink-3}"
    textColor: "{colors.sheet}"
  verdict-stamp-verified:
    backgroundColor: "transparent"
    textColor: "{colors.stamp}"
    typography: "{typography.stamp-title}"
    rounded: "{rounded.none}"
    padding: "10px 20px"
  verdict-stamp-rejected:
    backgroundColor: "transparent"
    textColor: "{colors.void}"
    typography: "{typography.stamp-title}"
    rounded: "{rounded.none}"
    padding: "10px 20px"
  verdict-stamp-returned:
    backgroundColor: "transparent"
    textColor: "{colors.tab-ink}"
    typography: "{typography.stamp-title}"
    rounded: "{rounded.none}"
    padding: "10px 20px"
  void-mark:
    backgroundColor: "transparent"
    textColor: "{colors.void}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.none}"
    padding: "0 6px"
  outcome-tag-asks:
    backgroundColor: "{colors.tab}"
    textColor: "{colors.tab-ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.none}"
    padding: "0 6px"
  outcome-tag-verified:
    backgroundColor: "transparent"
    textColor: "{colors.stamp}"
    typography: "{typography.label-caps}"
    padding: "0 6px"
  slip-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "10px 0"
  slip-initials-signed:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.none}"
    height: "24px"
    width: "60px"
  slip-initials-returned:
    backgroundColor: "{colors.tab}"
    textColor: "{colors.tab-ink}"
    height: "24px"
    width: "60px"
  slip-initials-pending:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    height: "24px"
    width: "60px"
  fact-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "6px 0"
  fact-row-hover:
    backgroundColor: "{colors.stamp-wash}"
  fact-row-missing:
    backgroundColor: "{colors.tab-wash}"
    textColor: "{colors.tab-ink}"
  provenance-chip:
    textColor: "{colors.ink-2}"
    typography: "{typography.mono}"
  needs-input-panel:
    backgroundColor: "{colors.tab-wash}"
    textColor: "{colors.tab-ink}"
    rounded: "{rounded.none}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    height: "40px"
    padding: "0 12px"
  work-area-tab:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    padding: "10px 0"
  work-area-tab-active:
    textColor: "{colors.ink}"
  drop-zone:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "40px 24px"
  drop-zone-active:
    backgroundColor: "{colors.stamp-wash}"
---

# Design System: Verdict

## Overview

**Creative North Star: "The Routing Slip and the Inspection Stamp"**

Verdict is a German office form (Behörden-Laufzettel) put on screen. An invoice travels from desk to desk; every station signs a ruled slip with its initials and the time it took, and the outcome is pressed onto the sheet as an inspection stamp carrying the validator version, the date and the report hash. The interface is a working surface, not a dashboard: recycled-paper grey ground, near-black ink, hairline rules, square corners, and a small set of stamp inks that each mean one thing.

Density is that of a filled-in form. Most text runs at 14px in a DIN-like grotesk (Barlow); machine readouts (BT codes, hashes, milliseconds, cents) run at 12px in JetBrains Mono; and exactly one large figure per result, the computed total, sits next to the stamp. Colour is flat and committed. The one physical object on the desk, the printed invoice page, is the only thing lifted with a shadow; it stays registered in place across every state while marks appear on it.

The system refuses the category default of "PDF left, field list right, green ticks". Validity is never a check icon; it is a stamp. Refused values are never hidden; they are struck through and cancelled with a VOID mark.

**Key Characteristics:**
- Recycled-paper ground, near-black ink, flat colour, no gradients, no glass.
- Square corners everywhere; hierarchy comes from rule weight, not boxes.
- Four inks with fixed meanings: stamp violet, void red, folder-tab yellow, office green.
- Condensed caps for anything a rubber stamp or a printed form label would carry.
- Monospace for every machine readout; one large proportional figure per result.
- Bar length on the routing slip equals real duration.
- Motion is a press and a slide, never a bounce; both switch off under reduced motion.

## Colors

A grey paper ground with near-black ink and four committed stamp inks, each owned by one actor or outcome.

### Primary
- **Stamp Violet** (`stamp`): the accepting ink. The VERIFIED stamp, the KoSIT initials when the validator accepts, the primary download button, the focused-quote outline on the PDF page, the focus ring, the active mobile tab underline, text selection, input caret.
- **Stamp Wash** (`stamp-wash`): the violet tint for hover and focus backgrounds on fact rows, line-item rows, recorded-run rows, and the drop zone while a file is dragged over it.

### Secondary
- **Void Red** (`void`): the cancelling ink. The REJECTED stamp, VOID marks, strike-through decoration on refused values and on a disagreeing printed total, rule IDs of validator errors, the KoSIT initials and duration bar when validation fails, error and budget-exhausted messages.
- **Void Wash** (`void-wash`): background of the single struck word inside a refused value.

### Tertiary
- **Folder-Tab Yellow** (`tab`): the "needs you" marker as a fill: the RTN and YOU initials, the "asks" outcome tag, their duration bars.
- **Tab Wash** (`tab-wash`): the needs-input panel, missing fact rows, the "second pass" divider on the routing slip.
- **Tab Ink** (`tab-ink`): text and borders in the needs-input world, including the RETURNED stamp. Yellow itself is never used as text.
- **Office Green** (`office`): the shell rail (top bar) and the model actor: Nemotron initials, their duration bars, and the `calc` provenance chip.
- **Office Green Light** (`office-2`): the hairline under the mobile tagline strip inside the green rail.
- **Office Ink** (`office-ink`): text on the green rail.

### Neutral
- **Recycled Paper** (`paper`): the page ground.
- **Form Sheet** (`sheet`): raised form surfaces: drop zone, input fields, mobile tab bar; also the text colour on ink buttons.
- **Page White** (`page-white`): the rendered invoice page and text on violet buttons and the wordmark.
- **Hairline** (`rule`): row dividers in every list and table; skeleton bars.
- **Strong Hairline** (`rule-strong`): group top rules, column-header rules, the dashed pending-initials boxes, the idle drop-zone border.
- **Ink** (`ink`): primary text, the 2px structural rules, the ink button.
- **Ink 2** (`ink-2`): secondary text, labels, station notes, the deterministic-core initials and bars.
- **Ink 3** (`ink-3`): tertiary metadata: BT codes, column headers, file reference, placeholders, idle stations.
- **Quote Highlighter** (`quote`): the faint yellow highlight laid (at 30%, multiplied) over every quoted span on the PDF page.

### Named Rules
**The One Ink, One Meaning Rule.** Violet means accepted or in focus, red means refused, yellow means waiting for you, green means the shell and the model, ink-grey means deterministic core. A colour never changes meaning between components.

**The Wash Is Not Ink Rule.** Washes (`stamp-wash`, `void-wash`, `tab-wash`) are backgrounds only. Text on a wash uses the matching full ink.

## Typography

**Display Font:** Barlow (with ui-sans-serif, system-ui)
**Stamp Font:** Barlow Condensed (with Barlow)
**Mono Font:** JetBrains Mono (with ui-monospace, SF Mono)

**Character:** A DIN-like grotesk for the form, its condensed cut for what a rubber stamp or pre-printed label would say, and a monospace for what a machine printed. Tabular, lining figures are on globally (`font-feature-settings: "tnum" 1, "lnum" 1`).

### Hierarchy
- **Stamp Title** (Barlow Condensed 700, 2.75rem; 2.25rem below 640px; line-height 1; 0.08em; uppercase): VERIFIED / REJECTED / RETURNED inside the verdict stamp.
- **Display** (Barlow 600, 2.5rem; 2rem below 640px; line-height 1.05; -0.025em): the single idle-state headline.
- **Figure** (Barlow 600, 2.5rem, line-height 1.25, -0.025em): the computed BT-112 total next to the stamp. One per result.
- **Wordmark** (Barlow Condensed 700, 1.5rem, 0.06em, uppercase): "VERDICT" in the top bar.
- **Title Caps** (Barlow Condensed 600, 0.875rem, 0.12em, uppercase): fact group headings (INVOICE, SELLER, …), "Recorded runs", "Refused, not hidden" (in void), Principles terms. The "Routing slip" heading uses the same cut at 1rem, weight 700.
- **Body** (Barlow 400/500, 0.875rem / 1.25rem): fact labels and values, station names (500), explanations held to 44–58ch.
- **Body Large** (Barlow 400/500, 1rem / 1.5rem): idle explainer paragraph, drop-zone prompt.
- **Label Caps** (Barlow Condensed 600–700, 0.75rem, 0.1–0.14em, uppercase): slip column headers, stamp sub-lines (0.14em), station initials, VOID marks and outcome tags (700, 0.12em).
- **Note** (Barlow 400, 0.75rem / 1rem): station notes, validator wording, recorded-run stories.
- **Mono** (JetBrains Mono 400, 0.75rem / 1rem): BT codes, hashes, durations, token counts, costs, unit codes, provenance chips. At 0.875rem it sets the totals ledger and the needs-input field.

### Named Rules
**The Rubber Stamp Rule.** Condensed uppercase with open tracking is reserved for text a stamp or a printed form label would carry: the verdict stamp, VOID marks, station initials, group and column headings, the wordmark. Sentences are never set in it.

**The Machine Readout Rule.** Anything a machine produced or a standard defines (BT-xx, sha256 fragments, ms, $ cost, unit codes, p.N) is mono at 12px. Prose and the large total are never mono.

## Layout

A three-desk layout inside a 1600px max container with 16px gutters (24px from 768px). From 1024px the main grid is three columns `minmax(0,1fr) | minmax(0,1.15fr) | minmax(16rem,0.75fr)` with a 32px gap (24px below): the PDF page on the left, the stamp and facts in the wider centre, the routing slip on the right. The left and right columns are sticky 24px from the top so the page and the slip stay in view while the facts scroll.

Below 1024px, once a run exists, a three-tab bar (Document / Facts / Routing slip) shows one desk at a time, Facts first. In the idle state the explainer moves above the intake on small screens and the principles list follows the intake.

The result head is a wrapping row (32px column gap, 16px row gap, minimum height 9.5rem) holding stamp, total and actions, closed by a 1px strong rule. Fact groups stack 32px apart; result blocks stack 24px apart. List rhythm is tight and form-like: 6px vertical padding on fact rows, 10px on slip rows and recorded runs.

### Named Rules
**The Registered Page Rule.** The rendered invoice page never moves or reflows between states. Only marks change on it: quote highlights for every quoted fact, a violet outlined box for the fact in focus.

## Elevation & Depth

Flat by default; depth comes from rule weight and the paper/sheet tone step. There is exactly one shadow: the rendered invoice page, which sits on the desk as a physical sheet (`0 1px 2px rgba(28,31,34,0.08), 0 8px 24px -12px rgba(28,31,34,0.18)`). Stamps and quote highlights use `mix-blend-mode: multiply`, so ink sits in the paper rather than on top of it.

### Named Rules
**The One Lifted Sheet Rule.** Only the invoice page casts a shadow. Panels, buttons, stamps and tags stay flat.

## Shapes

Square corners throughout (0px radius); nothing in the build is rounded. Structure is drawn with rules in three weights: a 1px hairline (`rule`) between rows, a 1px strong hairline (`rule-strong`) above groups and under column headers, and a 2px ink rule for the routing-slip head and the totals ledger. Dashed rules mark something not yet filled in: the 2px dashed drop zone, 1px dashed pending initials boxes, and the 2px dashed tab-ink divider where a resumed run continues on the same slip.

Stamp geometry is a double rule: a 3px outer border, a 3px gap, a 1.5px inner border. Small stamps (initials, VOID marks, outcome tags) use a single 1.5px border. Stamps sit slightly off-axis: the verdict stamp at -4° (verified), +3° (rejected), -3° (returned); VOID marks at -3°; signed initials at -2°.

### Named Rules
**The Square Corner Rule.** Radius is 0 everywhere. Softness, where needed, comes from washes, not curves.

## Components

### Buttons
Flat, square, short, and decisive.
- **Shape:** square corners (0px), 600 weight, 14px label, optional 14px Lucide icon at stroke 2 with a 6px gap.
- **Stamp (primary result action):** violet fill, white text, 36px tall, 12px side padding. Used for the one download that only exists when the validator accepted (XRechnung).
- **Outline (secondary result action):** 1px ink border, ink text, same size; hover and focus invert to ink fill with sheet text. Used for Audit log.
- **Ink (form action):** ink fill, sheet text, 40px tall, 16px side padding; hover and focus turn violet. Disabled turns `ink-3` with a not-allowed cursor. Used for "Choose a file" and "Validate again".
- **Hover / Focus:** colour swap only (150ms colour transition); focus-visible also gets the global 2px violet outline at 2px offset.
- **Text link button:** "← New invoice", 14px `ink-2` turning `ink` on hover, 14px arrow icon at stroke 1.75.

### Chips (provenance and outcome)
- **Provenance chip:** a mono 12px readout at the row end, no box. `p.N` in `ink-2` for a quote from page N, `you` in `tab-ink` for a user answer, `calc` in `office` for a computed value (rule name in its title), `—` in `ink-3` when there is none.
- **Outcome tag:** a small square stamp (1.5px border, 6px side padding, 16px line, Barlow Condensed 700 12px, 0.12em, uppercase). "verified" in violet, "rejected" in red, "asks" and "asks · verified" filled yellow with tab-ink text.

### Verdict Stamp (signature component)
The result is pressed onto the sheet at the top of the centre column. Double-ruled frame (3px outer, 1.5px inner), stamp title, one or two label-caps lines (validator and XRechnung version, then the date of the VALIDATE event; or "Input needed" and the open-point count; or "See rule violations"), and for VERIFIED only a mono `report <hash>` line. Ink colour by outcome: violet, red, or tab-ink. Rotation as listed under Shapes. Enters with the stamp-press motion. While running, the slot shows "On its way through the office…" in condensed caps, `ink-3`.

### Void Mark
"Nothing disappears; it cancels." A small square stamp reading VOID (or "Not used" beside a printed total that disagrees with the computed one): 1.5px red border, red Barlow Condensed 700 12px caps, -3° rotation. It always accompanies a strike-through (`line-through`, red, 1.5px decoration) on the cancelled value. In the "Refused, not hidden" list only the first word that is not on the page is struck and marked with `void-wash`; the surrounding words stay readable, and a note says what the page prints instead.

### Routing Slip
A ruled form in the right column. Head: "ROUTING SLIP" in condensed caps over a 2px ink rule, with stamp count and total duration, and the file reference (first 16 hex of the upload hash, mono). Column header row: Station / Signed / Took in label caps, 1px strong rule. Each row is a three-column grid (`1fr | 3.75rem | 4.25rem`, 12px gap, 10px vertical padding, hairline below):
- **Station:** name in 14px/500, a 12px note from the audit event (token counts, quote counts, hashes), and a 4px duration bar whose width is the station's share of the longest station (minimum 1.5%).
- **Signed:** the station initials in a 24px-high, 1.5px-bordered, -2° rotated box, coloured by tone: office green for model stations, ink-2 for deterministic core, violet or red for the validator outcome, yellow fill for return and user input, red for a line-mismatch cross-check.
- **Took:** duration in mono, right-aligned (`ms` below one second, `s` with two decimals above, `–` for none).
- **Idle:** the eight stations of a clean run in `ink-3` with dashed initials boxes.
- **Running:** a trailing "At the next desk" row with a pulsing dashed box.
- **Second pass:** a resumed run continues below a dashed tab-ink divider on a tab wash reading "RETURNED · ANSWERED BY YOU · SECOND PASS"; earlier rows stay.
- New rows enter with the slip-in motion.

### Fact Rows
A definition list per group (Invoice, Seller, Buyer, Payment), each group under title caps and a strong hairline. Row grid: BT code (mono 12px `ink-3`, 4.25rem) | label (`ink-2`, up to 9rem) | value (`ink`) | provenance chip (right-aligned, 2.25rem). Below 640px the label drops above the value at 12px. Rows with a quote are focusable; hover or focus paints `stamp-wash` and draws the violet focus box over the quote on the PDF page. Missing facts get a `tab-wash` row with "Not on the document" in tab-ink 500. Line items use a table with BT-numbered mono column headers; the totals ledger closes the facts under a 2px ink rule, mono, with BT-112 in ink 600.

### Inputs / Fields (needs-input form)
- **Panel:** `tab-wash` block, 16px padding, square, tab-ink copy stating how many facts are required and that Verdict will not invent them.
- **Field:** label in 14px/500 ink with the BT code in mono `ink-3`; input 40px tall, 1px `tab-ink` border at 40%, `sheet` fill, mono 14px value, 12px side padding.
- **Focus:** border turns violet plus a 2px violet ring at 25%; caret is violet.
- **Action:** ink button "Validate again".
- **Contradiction variant:** the same wash panel with a bulleted list of open issues and no fields.

### Navigation
- **Top bar:** office-green rail, 56px tall: condensed wordmark (also the start-over button), a tagline in office-ink at 80% from 1024px, and on the right the model/validator credit line (from 768px) and the mono budget readout (`$spent / $budget today`, or "live runs paused"). Below 768px the credit moves into a strip under the rail, closed by an `office-2` hairline.
- **Work-area tabs (below 1024px):** three equal tabs on `sheet` over a hairline; 14px/500; inactive `ink-2`; active `ink` with a 2px violet bottom border.

### Intake
- **Drop zone:** at least 16rem tall, centred, 2px dashed `rule-strong` border on `sheet`; while dragging, the border turns violet over `stamp-wash`. A 28px file icon (stroke 1.5), a 16px/500 prompt, a 14px constraint line (26ch), the ink button. When live runs are paused the zone drops to 60% opacity and says so in red.
- **Recorded runs:** a ruled list of buttons (title 14px/500, story 12px) with an outcome tag on the right; hover and focus paint `stamp-wash`.

## Do's and Don'ts

### Do:
- **Do** keep every corner square (0px) and draw structure with the three rule weights: 1px `rule`, 1px `rule-strong`, 2px `ink`.
- **Do** show validity only as the VERIFIED stamp, and only with the validator version, date and `report <hash>` line on it.
- **Do** cancel instead of removing: strike the value with a 1.5px `void` line and set a VOID mark beside it.
- **Do** set BT codes, hashes, durations, token counts and costs in JetBrains Mono at 12px.
- **Do** size routing-slip bars by real duration relative to the longest station.
- **Do** keep the invoice page registered; express state only through marks on it.
- **Do** colour by actor and outcome per the One Ink, One Meaning Rule.
- **Do** wrap every entrance animation in the `prefers-reduced-motion: reduce` switch.

### Don't:
- **Don't** use gradients, glass, blur effects or backdrop filters on surfaces.
- **Don't** round corners.
- **Don't** use green check marks, tick icons or "success green" for validity; green belongs to the shell and the model.
- **Don't** hide refused values or collapse them out of view.
- **Don't** set yellow (`tab`) as text; use `tab-ink`.
- **Don't** cast shadows on anything but the invoice page.
- **Don't** set sentences in condensed caps or prose in mono.
