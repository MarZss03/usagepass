---
name: UsagePass
description: A usage license printed as a two-ink riso proof that comes into register when PayPal confirms payment.
colors:
  stock: "#f2efe6"
  stock-deep: "#e8e3d4"
  sheet: "#fbfaf5"
  ink: "#1d1d1b"
  ink-soft: "#57544c"
  ink-faint: "#8a867b"
  rule-soft: "#c9c3b3"
  riso-blue: "#0078bf"
  riso-blue-deep: "#005f97"
  riso-blue-rail: "#0067a6"
  blue-wash: "#d7e7f1"
  fluoro-pink: "#ff48b0"
  yellow: "#ffe800"
  yellow-wash: "#fff7a8"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "clamp(32px, 3.4vw, 46px)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  lede:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  small:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  money:
    fontFamily: "Bricolage Grotesque, Atkinson Hyperlegible, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "0"
    fontFeature: "tnum, lnum"
  total:
    fontFamily: "Bricolage Grotesque, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.1
  stamp:
    fontFamily: "Bricolage Grotesque, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
rounded:
  hairline: "3px"
  art: "4px"
  plate: "6px"
  control: "8px"
  full: "999px"
spacing:
  gutter: "clamp(16px, 3vw, 40px)"
  rail: "232px"
  shoulder: "220px"
  aside: "440px"
  page-max: "1240px"
  measure: "760px"
components:
  button-primary:
    backgroundColor: "{colors.riso-blue}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.riso-blue-deep}"
    textColor: "#ffffff"
  button-primary-disabled:
    backgroundColor: "{colors.rule-soft}"
    textColor: "{colors.ink-soft}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.riso-blue}"
    padding: "12px 4px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
  button-danger-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
  input-text:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  chip-example:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "7px 13px"
  rail:
    backgroundColor: "{colors.riso-blue-rail}"
    textColor: "{colors.stock}"
    width: "{spacing.rail}"
    padding: "28px 18px 22px"
  nav-item:
    textColor: "{colors.stock}"
    rounded: "{rounded.plate}"
    padding: "10px 12px"
  nav-item-current:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.riso-blue}"
  proof-plate-blue:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.riso-blue}"
    rounded: "{rounded.plate}"
    padding: "22px 22px 18px"
  notice:
    backgroundColor: "{colors.yellow-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
---

# Design System: UsagePass

## Overview

**Creative North Star: "Riso Registration"**

A license is a two-ink riso print on uncoated stock. While it is unpaid, its blue and pink plates sit visibly out of register; a signature-verified PayPal capture pulls them into register. That one physical metaphor carries the product's central claim (the payment is the license) and every other surface stays quiet so the proof can say it.

The rest of the app is a printed ledger, not a dashboard: an off-white paper ground with a faint fibre tooth, black ink rules instead of cards, a solid riso-blue rail, and terms set as ruled lines with their rate-card clause sitting in a shoulder margin. Colour is spent by job, not decoration: blue for anything you can press, pink for the single live state, yellow only as a highlighter on the brand's own words.

**Key Characteristics:**
- Two spot inks plus black on paper; overprint via `mix-blend-mode: multiply`.
- Ruled lines (2px heavy head rule, 1.5px row rule) instead of cards, shadows, or fills.
- A shoulder margin (220px) beside every priced line holds its clause citation.
- Exactly one authored motion: the plates moving into register.
- State is printed in words on a run sheet, never as coloured badges.

## Colors

Uncoated stock, black ink, and two riso spot colours, each with one job.

### Primary
- **Riso Blue** (riso-blue): every pressable thing (buttons, links, focus ring, caret, current nav item text), the blue proof plate, done steps on the state line, clause marks (`§3 Paid media`).
- **Rail Blue** (riso-blue-rail): the navigation rail ground only; one step denser so stock-coloured text on it clears 4.5:1.
- **Deep Blue** (riso-blue-deep): hover for blue controls and links; code text in the history log.
- **Blue Wash** (blue-wash): input focus halo, code chips, hairlines between grant lines on the proof.

### Secondary
- **Fluorescent Pink** (fluoro-pink): reserved for the single live state: the pink plate, its halftone and stamp, the `now` band on the state line, the 9px live dot beside a payout in flight, and in-flight states in list tables. Outside state it appears only as the logo's offset second impression (and the favicon). Never used as body text.

### Tertiary
- **Riso Yellow** (yellow): text selection, and the hot highlight on the brand's request when a term is hovered or focused.
- **Yellow Wash** (yellow-wash): resting highlight on evidence phrases in the request, the notice block, and the "offline reader" tag.

### Neutral
- **Stock** (stock): page ground, under a 5%-alpha fractal-noise SVG tooth.
- **Stock Deep** (stock-deep): the split-page aside (proof, state line, ledger).
- **Sheet** (sheet): input fields, proof paper, artwork mats, table row hover.
- **Ink** (ink): text and every structural rule.
- **Ink Soft** (ink-soft): secondary text, clause body, crumbs, table headers.
- **Ink Faint** (ink-faint): todo steps, art captions, scrollbar thumb.
- **Rule Soft** (rule-soft): dashed shoulder rules, step joiners, disabled button ground, inactive dot.

### Named Rules
**The One Live Ink Rule.** Pink marks only what is happening now, plus the logo's second impression. Every pink mark on a screen must describe the same live state (the proof's pink plate, the `now` band and the live dot agree).

**The No Red Rule.** There is no error red. Errors are bold ink with a 3px ink rule above; refusals are struck through in ink; revocation is struck through. The palette has no colour outside the two inks, yellow and black.

**The Highlighter Rule.** Full yellow is applied only to the brand's own words and to selection, as a highlighter band. Its wash additionally marks things the reader must notice (the notice block, the "offline reader" tag). Never decoration.

## Typography

**Display Font:** Bricolage Grotesque (opsz 12..96; weights 500/700/800), falling back to Atkinson Hyperlegible
**Body Font:** Atkinson Hyperlegible (400/700, italic 400)
**Mono:** system `ui-monospace` stack, only for PayPal event names in the history log (700 12px)

**Character:** A chunky, slightly irregular grotesque for headlines, totals and the stamp, against a legibility-first text face. All figures are tabular (`font-variant-numeric: tabular-nums` on body).

### Hierarchy
- **Display** (800, clamp 32-46px, 1.04, -0.025em, balanced wrap): page h1, one per view.
- **Headline** (800, 30px): the license title on the proof plate.
- **Title** (700, 20px, display face): work names in the Works list.
- **Body** (400, 16px/1.5): everything else; terms set at 16.5px bold, the brand's request at 20px.
- **Lede** (400, 18px, ink-soft, max 62ch): one intro paragraph under h1.
- **Label** (700, 14px, +0.06em, uppercase, Atkinson): section h2s (Granted, Clause, Who gets paid) and table headers (12.5px).
- **Small** (13.5px): crumbs, hints, citations, state line.
- **Total** (800, 24px, display face) and **Stamp** (800, 52px, -0.03em, pink).

### Named Rules
**The Unslashed Zero Rule.** Money is always set in the display face (700, tabular + lining figures, no tracking, no wrap). Atkinson's zero is slashed and reads as struck-through next to refused lines.

**The Struck Line Rule.** A line-through means refused, not granted, or revoked; nothing else in the system uses strikethrough.

## Layout

App shell is a two-column grid: a sticky 232px blue rail plus a fluid main column. Content pages pad `34px gutter 64px` with the gutter at clamp(16px, 3vw, 40px) and cap at 1240px. Decision pages (quote, license) use a split: fluid column plus a 440px aside on stock-deep with a 2px ink left rule. Within the column, priced lines run as a two-column grid (fluid line + 220px shoulder, 28px gap) capped at 760px + shoulder; reading measure is 760px.

**At 1180px and below:** the split collapses to one column; the aside drops under the column with a 2px top rule and becomes a two-column grid (360px proof spanning four rows, state line and ledger beside it).

**At 900px and below:** `--shoulder` becomes 0 and citations stack under their line; the rail turns into a sticky top bar (17px logo, horizontally scrolling nav, counts and rail footer hidden); tables reflow into two-column cards without a header; Works rows shrink art to 88px; a fixed bottom pay bar (total + PayPal button, safe-area padded) appears and slides away (`translateY(110%)`) once the in-flow pay button is on screen.

## Elevation & Depth

Flat. There are no box shadows anywhere except the 3px blue-wash focus halo on inputs. Depth is printing: the pink plate sits over the blue with `mix-blend-mode: multiply` so overlaps darken like overprinted ink, and the logo is the same word printed twice, pink offset 2.5px/2px under stock. Layering beyond that is tonal (stock vs stock-deep vs sheet) and ruled.

### Named Rules
**The Ink Not Light Rule.** Depth comes from overprint and register, never from cast light. No shadows, no glass, no gradients except highlighter bands and the halftone.

## Shapes

Mostly square paper geometry softened slightly: 8px on controls, inputs, notice and toast; 6px on nav items and proof plates; 4px on art and the focus outline; 3px on code chips; full pills only on example chips and small inline tags. Rules carry the structure: 2px ink at the head of every list, 1.5px ink between rows, 1.5px dashed rule-soft for the shoulder, 3px ink above totals and the request block. Registration marks (22px circle + crosshair, 1.6px stroke) sit at the top-left and bottom-right corners of each plate.

## Components

### Buttons
- **Shape:** gently rounded (8px), 14px 22px, 700 16px, 10px icon gap.
- **Primary:** riso blue on white text; hover deep blue; active nudges down 1px; disabled is rule-soft on ink-soft. Loading shows a 16px white ring spinner (0.8s linear).
- **Quiet:** blue text, no fill, underline on hover.
- **Danger (Refund and revoke):** transparent with a 2px ink border, inverts to ink on hover. Destructive is ink, not red.
- **Focus:** global 2.5px blue outline, 3px offset (stock-coloured inside the rail).

### Chips
- **Example requests:** 1.5px ink outline pill, 7px 13px, 14px; hover turns border and text blue on sheet.

### Inputs / Fields
- **Style:** sheet ground, 2px ink border, 8px radius, 17px text (textarea 19px, min 132px).
- **Focus:** border goes blue with a 3px blue-wash halo; no outline.
- **Error:** bold ink text above a 3px ink rule. No red.

### Navigation
- **Rail:** blue-rail ground, stock text, two-ink logo. Items 700 weight, 10px 12px, 6px radius; hover is a 14% stock tint; current is a stock tile with blue text; counts at 13px.
- **Mobile:** single sticky top bar, scrollable nav, 14.5px items.

### State Line (signature)
A printed run sheet, not badges: one ordered list between a 2px top and 1.5px bottom rule, 13.5px bold. Steps are Quoted, payment step, Active, Shares paid. `done` is blue with a check; `now` sits on a pink highlighter band (10-90%) with a screen-reader "(current)"; `todo` is ink-faint regular; `revoked` is ink with a 2px strike. A 12px rule-soft dash trails each step so a wrapped line never opens with a dash. Payment step label follows the PayPal state: Awaiting payment, Approved in PayPal, Partly captured, Held by PayPal, Payment declined, Paid. In tables the same vocabulary is plain bold text: blue for Active, pink band for in-flight, strike for Revoked/Declined.

### License Proof (signature)
Two absolutely stacked plates inside an isolated wrapper. The blue plate is the readable license: 3px blue border on sheet, min-height 420px, uppercase ID label, 30px title, grant lines with money, not-granted lines struck, a blue-ruled total. The pink plate is a 3px pink border multiplied over it, carrying a masked 9px halftone band and the stamp word (UNPAID, PAYING, HELD, ACTIVE, DECLINED, VOID) confined to a reserved stamp zone so dots never print over grants. Registration state is a data attribute:
- `off` (any unpaid state): blue `translate(-10px, 8px) rotate(-.6deg)`, pink `translate(9px, -7px) rotate(.5deg)`.
- `in` (ACTIVE): both plates at identity.
- `drift` (REVOKED): blue `translate(-22px, 16px) rotate(-1.6deg)`, pink `translate(20px, -14px) rotate(1.4deg)`.
A caption under the proof says in words what the register means; it turns ink when in register.

### Rate Card and Terms
Ruled two-column grids: label and money left, clause mark (`§n Title`, 700 13px blue) and clause text in the shoulder. Refused terms draw a 2.5px ink strike across the label and carry an outline "Not offered" flag; review terms drop to regular weight with "Team will confirm". Hovering or focusing a term turns its evidence phrase in the request from yellow-wash to full yellow.

### Notice and Toast
Notice: yellow-wash block with a 1.5px ink border, 14.5px. Toast: ink bar (8px radius) at bottom centre, bold stock text, slides up 0.45s and announces through `role="status"`.

### Motion grammar
- **The registration moment (the one authored motion):** plates transition `transform 1.15s cubic-bezier(.12, .9, .2, 1)` (`--ease-ink`) between `off`, `in` and `drift`. When the stamp word changes it is wiped in left to right by `clip-path` over 0.7s with a 0.55s delay, so the plates land first. Arriving on a license that went ACTIVE within the last 90s renders it at `off` and snaps into register after 650ms.
- **Supporting motion, all `--ease-out` cubic-bezier(.16, 1, .3, 1):** a fresh quote's terms rise 6px and fade in (0.55s, 90ms stagger, 120ms base), citations slide in 14px from the shoulder, refused strikes draw across (0.5s, +520ms); new history rows rise in (0.5s); the reading bar sweeps a blue ink bar (1.4s loop); hover colour changes run 0.2s.
- **Reduced motion:** all animations and transitions collapse to 0.01ms with no delay; plates jump straight to their register state, the fresh-quote cascade class is not applied, the license replay is skipped, and the reading bar becomes a static half-opacity full bar.

## Do's and Don'ts

### Do:
- **Do** use riso blue for every pressable thing and nothing decorative.
- **Do** keep fluorescent pink to the live state (pink plate, `now` band, live dot, in-flight table state) and the logo's offset impression.
- **Do** set every money value in Bricolage Grotesque, 700, tabular and lining figures.
- **Do** separate content with ink rules (2px head, 1.5px rows) and put each term's clause in the 220px shoulder.
- **Do** say state in words on the ruled run sheet, and mirror it on the proof's register.
- **Do** keep the move into register the only authored motion; everything else is a short ease-out arrival.

### Don't:
- **Don't** use status badges or coloured pills for license state; state is text, a blue check, a pink band, or a strike.
- **Don't** introduce red or any off-palette colour for errors, danger or refusal; use bold ink, ink rules and strikethrough.
- **Don't** set money in Atkinson Hyperlegible; its slashed zero reads as struck.
- **Don't** wrap content in white cards with shadows; the ground is paper and structure is ruled.
- **Don't** use yellow for anything except the brand's own words, selection, notices and the offline tag.
- **Don't** animate the plates for decoration or on hover; they move only when PayPal changes the license state.
