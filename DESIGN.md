---
name: Karaoke Chain Builder
description: A dark pro-audio touring rack in the browser — karaoke vocal chains built live, legible from two meters, safe by construction.
colors:
  bg-body: "#1B1917"
  bg-panel: "#292623"
  bg-card: "#322E29"
  hairline: "#4C463E"
  line-strong: "#857C6E"
  text-primary: "#EDE8DE"
  text-muted: "#A79F92"
  accent: "#F0A83C"
  accent-hover: "#FFC06B"
  accent-active: "#D18A20"
  on-accent: "#241A08"
  red-edge: "#E5484D"
  red-fill: "#C93A32"
  focus-ring: "#FFB640"
  focus-ring-on-accent: "#241A08"
  family-gain: "#D9C37A"
  family-compressor: "#8CC079"
  family-eq: "#82A9DE"
  family-delay: "#B18FDE"
  family-reverb: "#6FC2C8"
  family-limiter: "#DE8FB0"
  status-live: "#7BD389"
  status-error: "#FF806E"
  meter-low: "#5CC06E"
  meter-mid: "#F0A83C"
  meter-clip: "#F05A45"
typography:
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  readout:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.85rem"
    fontVariation: "tabular-nums"
rounded:
  dot: "2px"
  xs: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  button-primary-active:
    backgroundColor: "{colors.accent-active}"
    textColor: "{colors.on-accent}"
  button-control:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-bypass:
    backgroundColor: "{colors.bg-panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "0.65rem 1.6rem"
    height: "3rem"
  button-bypass-engaged:
    backgroundColor: "{colors.red-fill}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    height: "3rem"
  chip-palette:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.6rem"
  chip-agent:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0.35rem 0.6rem"
  card-module:
    backgroundColor: "{colors.bg-card}"
    rounded: "{rounded.lg}"
    padding: "0.375rem 0.75rem"
    width: "190px"
  toast-agent:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 0.9rem"
    width: "340px"
---

# Design System: Karaoke Chain Builder

## Overview

**Creative North Star: "The Touring Rack"**

This is pro-audio rack gear built for the road, not for a studio shelf. Every
surface answers three questions before it earns a pixel: can the operator read
it from two meters away in a dark venue, does every lamp and silkscreen legend
mean something, and will it still work when the show is already running. The
console is warm industrial — brushed warm-charcoal steel, toolroom honesty,
and one amber signal register that glows only where the machine speaks. It is
dense the way real consoles are dense: deliberately, with a label rhythm, not
as noise.

The visitor here is an operator mid-task, never a browse. Physical metaphors
carry the whole vocabulary: module cards are channel strips with family color
on their top edge the way real gear codes rack modules; sliders are faders
with detent ticks, center-unity notches, and amber caps carrying an ink
position line; the top bar is a status LCD strip whose mono readouts are
machine registers. Depth is tonal first — a chassis → faceplate → module-card
ground stack — and real shadows appear only when something physically lifts
off the rack (a dragged card, a floating toast).

The one confirmed anti-reference: this is not a neon terminal, not a webfonts
showcase, not a decorative-motion piece. No display fonts in UI, no invented
brand imagery, no glow. Confidence comes from restraint and redundant
encoding — color is never the only signal anywhere in the system.

**Key Characteristics:**
- Warm charcoal three-ground tonal stack (chassis → faceplate → module card); depth by layering, shadows only on lift.
- One amber signal accent for action and machine attention; ink-on-amber fills, never amber-on-amber.
- Two type registers: silkscreen legends for humans, mono LCD/VFD readouts for machine values.
- Family color as edge marking (never fill) with always-present text labels — redundant encoding everywhere.
- Split-role safety red: the Bypass control outranks everything on the strip.
- 150–250 ms state transitions only; meter ballistics and the agent breath are functional, not decorative; `prefers-reduced-motion` respected throughout.
- Console-grade density: 11 px text floor, tracked uppercase micro-labels, tabular numerals in every readout.

## Colors

A warm-charcoal chassis with one amber signal voice and a split-role safety
red — every value WCAG-AA verified in its shipped pairing
(`docs/ultron/research/rq5-palette.md` is the source of truth).

### Primary
- **Signal Amber** (#F0A83C): the machine's voice — Start, Undo, active/drag states, unsaved flag, agent-ready label, fader caps. Hover brightens to Lamp Amber (#FFC06B), pressed deepens to Pressed Amber (#D18A20). Text on any amber fill is always Lamp Ink (#241A08) (8.46–10.60 contrast); amber-on-amber focus rings are forbidden (1.16) — use the dark ring token.
- **Focus Amber Ring** (#FFB640): the single global `:focus-visible` ring, visible on all three grounds; its dark twin (#241A08) rides inside amber fills.

### Secondary
- **Safety Edge Red** (#E5484D): rings and bezels only — the Bypass halo, refusal-toast bezel, meter clip pin.
- **Safety Fill Red** (#C93A32): solid fills with white text only (5.08) — the engaged Bypass state.
- Six **family edges**: Gain (#D9C37A), Compressor (#8CC079), EQ (#82A9DE), Delay (#B18FDE), Reverb (#6FC2C8), Limiter (#DE8FB0). Used as chip legend-square fills (with on-accent initials, 7.06–9.82) and as 3px card top edges — never as text, never as large fills.

### Tertiary
- **Live Green** (#7BD389): the engine-state lamp. **Error Coral** (#FF806E): status-error register.
- Meter stops: Meter Green (#5CC06E) → Meter Amber (#F0A83C) → Meter Clip (#F05A45), painted on canvas.

### Neutral
- **Chassis Charcoal** (#1B1917): body ground.
- **Faceplate Umber** (#292623): panel ground (topbar, flanks).
- **Module Card** (#322E29): card/chip/toast ground.
- **Seam Hairline** (#4C463E): decorative seams only — deliberately sub-3:1.
- **Bezel Line** (#857C6E): meaningful outlines (3:1 against all grounds).
- **Warm Chalk** (#EDE8DE): primary text. **Muted Silkscreen** (#A79F92): labels, secondary text.

### Named Rules
**The Split-Role Red Rule.** Edge red is for rings and bezels; fill red is for solid fills with white text. Never swap them: white on edge red fails (3.91), fill red as an edge fails (2.65).
**The Amber Voice Rule.** Amber speaks for action and machine attention only — never as decoration, never as large-area fill. Its rarity on the dark chassis is what makes it readable at distance.
**The Seam Rule.** Hairlines are seams, not outlines. Anything meaningful (interactive bezels, floating-card boundaries, family identity) uses the Bezel Line token; anything merely decorative uses the hairline.

## Typography

**Body Font:** system-ui stack (`system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`)
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` (no webfonts — platform stacks only)

**Character:** An instrument panel in two registers. Human labels are
silkscreen legends — small, bold, uppercase, tracked 0.08em, muted — exactly
like the printing on a faceplate. Machine values (readouts, meters, preset
names, toast footnotes) live in the mono register with tabular numerals so
`—` becoming `48.0 kHz` changes glyphs, never geometry. The two registers
never swap roles.

### Hierarchy
- **Title** (700, 0.75rem, tracked 0.08em, uppercase): the identity legend on the status strip; silkscreen register.
- **Body** (400/600, 0.85–1rem, 1.5): prose values, button labels, toast summaries.
- **Label** (700, 0.7rem / 11.2px, 0.08em, uppercase): panel headers, param labels, readout labels, optgroup legends — the surface-wide micro-label.
- **Readout** (mono, tabular-nums, 0.7–0.95rem): every machine value — sample rate, latency, node count, meter dB, preset name, param values.

### Named Rules
**The Register Rule.** If a value is machine state, it renders in the mono readout register with tabular numerals; if it is a human label, it renders as a silkscreen legend. Nothing in between.
**The 11px Floor Rule.** No text renders below 11px anywhere (0.6875rem initials and 0.7rem labels are the floor after the density pass) — distance legibility is a product requirement.

## Layout

Three-column console grid inside a rounded chassis frame
(`grid-template-columns: 200px 1fr 220px`, gap 0, hairline seam borders):
palette flank → signal-path canvas → presets flank. The sticky top bar is the
status LCD strip: silkscreen identity legend · engine-state lamp · mono
readout group · Start/device controls · agent chip · BYPASS at the far right.
Below 900px the machine cluster (lamp + readouts) wraps to a second row via
order — BYPASS never leaves the visible top.

The canvas flows top-down by default (VIS-7): MIC IN anchor with its meter →
stacked channel-strip modules → OUT, inside a bounded panel
(`max-height: calc(100vh - 7.5rem)`) that scrolls internally so a long chain
never grows the page. A pinned footer row inside the panel (beneath the
scrolling canvas, above the FLOW toggle) carries a second view of the OUT
meter — output ground truth is always visible without scrolling. A FLOW
toggle flips to the horizontal legacy reading (left→right chain, page-owned
scroll), persisted per user. Cards collapse to slim header-only rows (~39px)
via chevron — presentation only. While Bypass is engaged the chain region
(cards + flow toggle) dims to the gated-state 0.55 with a silkscreen
BYPASSED line; anchors, meters, the pinned footer, and both flanks never
dim — output truth stays readable on the dry path. Spacing rhythm is
console-tight: 4/8/12/16px steps, panel padding 1rem, card padding
6px/12px after the ~90% density pass.

## Elevation & Depth

Tonal layering is the default depth: Chassis Charcoal ground → Faceplate
Umber panels → Module Card surfaces, separated by hairline seams. Real
shadows are structural — they appear only when something physically lifts off
the rack.

### Shadow Vocabulary
- **Card rest** (`0 1px 2px rgba(0,0,0,0.3)`): the faint module seat — cards are inserted, not floating.
- **Lifted** (`0 4px 10px rgba(0,0,0,0.45–0.5)`): dragged cards/chips (SortableJS clones) and agent toasts — things held above the faceplate.
- **Highest lift** (`0 8px 20px rgba(0,0,0,0.55)`): the actively dragged node card.

### Named Rules
**The Rest-Flat Rule.** Surfaces are flat at rest; a shadow means physical lift (drag, float). No ambient glow, no hover shadows.

## Shapes

Radius scale: dot 2px (status squares) · xs 3px (legend squares, fader caps) ·
sm 4px (fader tracks) · md 6px (buttons, chips) · lg 8px (cards, toasts, the
chassis frame). Form language is rectangular hardware: the chassis frame is
one 8px rounded hairline-bordered box, cards are near-square modules, and the
recurring signature silhouette is the family legend square — a small 3px-radius
color block carrying two on-accent initials, repeated on palette chips and
card headers. Family identity rides a 3px top edge on cards (edge marking,
never fill). Focus rings are 2px solid with 1px offset; on amber fills the
dark ring is drawn inside the fill (`outline-offset: -2px`).

## Components

Tactile and confident: controls read as physical objects that answer within
150 ms.

### Buttons
- **Shape:** md radius (6px); the shared `.control` vocabulary.
- **Primary (Start):** Signal Amber fill, Lamp Ink text, 700 weight; hover Lamp Amber, pressed Pressed Amber, dark focus ring inside the fill. The strip's one primary action; recedes to disabled once the engine runs.
- **Control (secondary):** Module Card ground, Bezel Line border (1px), Warm Chalk text; hover leans the border amber, pressed fills ink-on-amber; disabled drops to hairline seam + muted text at 0.6 opacity.
- **BYPASS:** the loudest control on the strip — lg radius (8px), 3rem min-height, 1.05rem/700 type, 2px Safety Edge Red ring. Engaged: Safety Fill Red ground, white text. Nothing on the strip outranks it.

### Chips
- **Palette chip:** a real `<button>` (aria-label "Add X to chain"; disabled until Start) — Module Card ground, hairline seam at rest, md radius; 20px family legend square + silkscreen label (muted → primary on hover). Hover raises the bezel and adds a 2px family top edge (inset, no layout shift) + 1px lift (motion-guarded). Active/drag-origin: amber bezel. Keyboard: Enter/Space adds the node (appended before the terminal limiter); drag unchanged; grab cursor survives the button semantics.
- **Agent chip:** a strip-native reporter, never a control — card-ground pill, silkscreen legend type; tools-ready/acting lift to Bezel Line border, amber label, 8px amber status square; acting adds one 1.2s opacity breath (the single slow-animation exception, guarded). Unavailable is the quietest state on the strip.

### Cards / Containers
- **Node card (channel-strip module):** lg radius (8px), Module Card ground, 1px hairline border + 3px family top edge, rest shadow, min-width 190px, 6px/12px padding. Header: legend square + silkscreen label + drag grip (whole label line is the hit area) + collapse chevron + remove ×. Params region collapses to nothing on chevron toggle — the collapsed card is exactly the slim header row.
- **Drag states:** live clone lifts (0.85 opacity + lifted shadow); ghost is a 0.35-opacity dashed slot.

### Inputs / Fields
- **Select (device, presets):** `.control` vocabulary — card ground, Bezel Line bezel, native dark rendering via root `color-scheme: dark`; optgroup labels read as silkscreen micro-legends. Long labels ellipsize against a max width.
- **Inline preset naming (Save As):** no browser dialogs — the naming row opens under the select: text input in the `.control` vocabulary (sr-only label) over an ink-on-amber Save + plain Cancel. Enter commits, Escape cancels (scoped), blur never commits; focus returns to Save As… on close. Empty names answer with the quiet `.preset-note` line.
- **Armed Delete:** two-step in-panel — first click relabels to "DELETE?" (announced) and raises a Safety Edge Red bezel (edge, never fill — fill red is BYPASS-only); a second click within 5s deletes; expiry, click-elsewhere, or Escape disarms.
- **Faders (param sliders):** one native `input[type=range]` per param, re-skinned: 8px track (sm radius) painted as hairline slot + 1px detent ticks every 12px + 2px Bezel Line center-unity notch; 12×18px amber cap with Bezel Line bezel and a 2px Lamp Ink position line. Values read in the mono register right-aligned above.

### Navigation
- **Status LCD strip (topbar):** the signature surface — one persistent full-width panel row reading as broadcast rack gear's status display, not a web header. Silkscreen identity legend · state lamp · fixed-width mono readouts (7ch/6ch/3ch slots) · controls · BYPASS.

### Meters
- **MIC IN / OUT units:** 96×26px canvas lamp bar (unlit glass = hairline; green → amber → clip stops; peak tick + clip dot) over a mono dB readout (tabular, muted; CLIP latch text renders primary while the canvas carries the red). Ballistics are per-frame canvas draws — functional motion that stays live under reduced-motion by construction.
- **Pinned OUT footer:** a second VIEW of the OUT unit (one feed, one ballistics, shared scene drawer) pinned in the canvas panel's always-visible region — the operator's output ground truth never depends on scroll or collapse; never dimmed, including while bypassed. The footer canvas is presentation-only (aria-hidden); the anchor meter keeps announcements.

### Toasts (agent change summaries)
- Module Card ground, Bezel Line border (a floating card earns the meaningful outline), lg radius, lifted shadow, ≤340px, bottom-right stack (3 max, 6s auto-dismiss, hover-pause). Summary in body register; clamped/error/undone footnotes in muted mono under a hairline seam. Refusals carry a 2px Safety Edge Red bezel on all sides — the bezel is the refusal signal, never red text. Undo is the one action: ink-on-amber fill. Undone toasts recede to 0.75 opacity.

## Do's and Don'ts

### Do:
- **Do** extend the token set — introduce no raw hex values; new colors enter as `:root` tokens in the rq5-verified vocabulary.
- **Do** keep color redundant: every family edge pairs with its legend square initials and a text label; every state change is copy + color.
- **Do** use tabular numerals and fixed min-widths in readouts so machine values never pump layout.
- **Do** draw focus rings with the global 2px token, switching to the dark inside-fill ring on amber surfaces.
- **Do** keep state transitions at 150–250 ms and guard every motion addition with `prefers-reduced-motion`; meter ballistics stay live by drawing per-frame.

### Don't:
- **Don't** swap the safety red roles (edge ↔ fill) or put white text on edge red.
- **Don't** render text below 11px, use webfonts/CDN assets, or add display fonts to the UI.
- **Don't** use amber as decoration, large-area fill, or an amber-on-amber focus ring.
- **Don't** add glow, load choreography, or hover shadows — shadows mean physical lift only.
- **Don't** let anything on the status strip outrank BYPASS in loudness; don't move it from the visible top on narrow widths.
- **Don't** invent brand imagery, logos, or a product name — the working title stands until the user chooses one.
