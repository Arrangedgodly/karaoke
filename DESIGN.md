---
name: VOXCHAIN
description: A hardware groovebox's pattern surface in the browser — one matte instrument chassis, silkscreen sections, encoder field, and a free board where cords edit the chain.
colors:
  bench: "#0a0b0f"
  chassis: "#131316"
  system-deck: "#17181d"
  slab: "#181a21"
  slab-lip: "rgba(201, 206, 220, 0.22)"
  face-edge: "#232330"
  groove-cut: "#05060a"
  groove-lip: "rgba(158, 164, 184, 0.14)"
  seam-cut: "#010208"
  seam-lip: "rgba(201, 206, 220, 0.3)"
  print: "#9ea4b8"
  print-hi: "#c9cedc"
  print-dim: "#7f859b"
  print-gated: "#dde2ee"
  accent: "#ff6b35"
  accent-hi: "#ff8558"
  accent-lo: "#e85a20"
  display: "#ffd75e"
  register-bg: "#0b0c10"
  key: "#1d1e26"
  key-edge: "#343746"
  ring-track: "#454a5a"
  cap: "#1e2027"
  ink: "#131316"
  on-red-fill: "#FFFFFF"
  red-edge: "#E5484D"
  red-fill: "#C93A32"
  family-gain: "#D9C37A"
  family-compressor: "#8CC079"
  family-eq: "#82A9DE"
  family-delay: "#B18FDE"
  family-reverb: "#6FC2C8"
  family-limiter: "#DE8FB0"
  family-distortion: "#C0CE97"
  family-chorus: "#9E9ED1"
  family-gate: "#9AD5B2"
  family-autotune: "#D19ED1"
  family-phaser: "#96E3CC"
  family-tremolo: "#96CAE3"
  family-pitchshift: "#CB96E3"
  family-bitcrusher: "#E396CF"
  pm-family-gain: "#cdc5ad"
  pm-family-compressor: "#b0c6a9"
  pm-family-eq: "#aabacf"
  pm-family-delay: "#baaecb"
  pm-family-reverb: "#a6c6c9"
  pm-family-limiter: "#d0b3bf"
  pm-family-distortion: "#bfc7a8"
  pm-family-chorus: "#afafca"
  pm-family-gate: "#aecbbd"
  pm-family-autotune: "#cfb4cf"
  pm-family-phaser: "#aacbc1"
  pm-family-tremolo: "#aac0cb"
  pm-family-pitchshift: "#c0aacb"
  pm-family-bitcrusher: "#cbaac2"
  status-live: "#7BD389"
  status-error: "#FF806E"
  vu-low: "#4ea96b"
  vu-mid: "#ffd75e"
  vu-clip: "#e4574a"
  vu-unlit: "#262933"
  vu-tick: "#c9cedc"
  vu-label: "#9ea4b8"
typography:
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  nameplate:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    letterSpacing: "0.16em"
  key-label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.9rem"
  bypass-label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
  value:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontVariation: "tabular-nums"
  register:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.85rem"
    fontVariation: "tabular-nums"
  family-code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "1.25rem"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  sm: "2px"
  badge: "3px"
  key: "4px"
spacing:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hi}"
    textColor: "{colors.ink}"
  button-primary-active:
    backgroundColor: "{colors.accent-lo}"
    textColor: "{colors.ink}"
  button-control:
    backgroundColor: "{colors.key}"
    textColor: "{colors.print-hi}"
    rounded: "{rounded.key}"
    padding: "0.5rem 1rem"
  button-bypass:
    backgroundColor: "{colors.key}"
    textColor: "{colors.print-hi}"
    rounded: "{rounded.key}"
    padding: "0.65rem 1.6rem"
    height: "3rem"
  button-bypass-engaged:
    backgroundColor: "{colors.red-fill}"
    textColor: "#FFFFFF"
    rounded: "{rounded.key}"
    height: "3rem"
  chip-palette:
    backgroundColor: "{colors.key}"
    textColor: "{colors.print}"
    padding: "0.35rem 0.5rem"
  section-node:
    backgroundColor: "{colors.slab}"
    textColor: "{colors.print}"
    padding: "0.55rem 0.75rem 0.6rem 0.9rem"
    width: "100%"
  display-register:
    backgroundColor: "{colors.register-bg}"
    height: "3rem"
    padding: "0.35rem 0.9rem 0.35rem 1.4rem"
---

# Design System: VOXCHAIN

## Current design scope

The dark pro-audio material system below remains the visual authority. The
three-column layout, free-board composition, cable topology, and MIC IN / OUT
anchor treatment no longer do. They are incumbent production decisions under
review, not constraints on new layout prototypes.

Any replacement must preserve the competition-critical interaction facts in
[`docs/WEBMCP-CHALLENGE.md`](docs/WEBMCP-CHALLENGE.md): one visible state for
human and agent edits, a prominent human-only Bypass, visible mutation and
Undo feedback, plain-language entry, keyboard access, and truthful engine and
output status. Prototype code does not change this design system until the
user selects a direction.

## Overview

**Creative North Star: "The Pattern Machine"**

VOXCHAIN is built as one hardware instrument, not a web page about audio.
The whole viewport is a single machined chassis — the Two-Deck Stack: a
sticky SYSTEM DECK across the top (identity nameplate, dot-matrix status
etch, Start/device keys, the red-ringed BYPASS end key), a machined DECK
SEAM bolting the two slabs together, and below it the VOICE DECK — one
continuous faceplate whose three zones (palette flank · chain face ·
presets flank) are printed onto the same ground, separated by machined
grooves rather than panel borders. The chain face itself is the Single
Face Chassis: a dot-matrix display register etched along the top edge,
jack-print anchors (MIC IN / OUT), and each effect a weighted-slab
SECTION with cut faces standing on the chassis ground — never a floating
card.

The control world is the encoder field: rotary knobs, pad selectors, and
trimmers condensed into fluid clusters, exactly the refusal of stacked
full-width fader rows the redesign brief demanded. The board underneath
is FREE: sections sit wherever the operator puts them (snap-grid
quantized), patch cords drawn between jacks are how the chain is
EDITED — sound changes only when a cord link completes, never while
dragging. Every value
the machine holds answers on one display register. The world is matte:
brightness is saturation on a near-black ground, never glow.

The register discipline is strict: silkscreen print (labels, codes,
legends) for humans, mono dot-matrix for machine values, tabular
numerals everywhere, and a two-tier value ladder (12px per-control /
13.6px register line). The one committed accent — signal orange — is
reserved for system states: register marks, the global focus ring, the
live-control blink, pressed pads, the chosen-drag groove lip, and Start.
Family color appears twice, in two vocabularies: desaturated silkscreen
inks for rail print, saturated rq5 tokens for knob arcs and palette
legend squares. 2026-09-01 (owner direction, "for fun"): the
signal-order strip's plugin names join the rail-print vocabulary — each
step prints in its family's desaturated ink, extending the lock ink the
terminal limiter already carried.

**Key Characteristics:**
- One instrument, two decks, three printed zones — machined grooves and one deck seam, no floating panels, no border-radius islands.
- Single Face Chassis: display register on the top edge, sections as print zones, jack-print anchors, VU corner + flow switch on the base plate.
- Encoder field: 54px knobs (family-colored arcs), pad radio-groups, trim slots; the display register answers the touched control.
- Free board: snap-grid positioning, patch cords that EDIT order but never gate audio; DOM order is always chain order. No arrange/tidy key — the board is a free canvas (retired 2026-08-31).
- One signal orange for system states only; family color on the arcs, the legend squares, the rail print, and the signal-order strip's names (2026-09-01 fun round); BYPASS's split-role red outranks everything on the deck.
- Two-register type (silkscreen sans / dot-matrix mono tabular), 12px/13.6px value ladder, 11px floor.
- One global disabled grammar — diagonal hatch + recede — for exactly two states (pre-Start gate, emergency-bypassed chain). A bypassed effect uses its local IN/BYP key, a struck family code, and a receded encoder field instead.

## Colors

A matte near-black instrument register (`--pm-*`) with one committed
signal orange, a dot-matrix display amber, ten family inks in two
saturations, and the split-role safety red on BYPASS. Every pairing is
measured in the build records (redesign.md item 1/1b tables).

### Primary
- **Signal Orange** (#ff6b35, `--pm-accent`): the ONE committed accent, reserved for system states — display-register marks and module segment (6.89 on register ground), the global `:focus-visible` ring (6.25–7.97 across grounds), the live-control register blink, pressed pads and pressed keys (ink 6.54), the chosen-drag groove lip, and the Start key. Hover brightens to #ff8558, press deepens to #e85a20 (ink 7.72 / 5.22). Never decoration, never a knob arc, never large-area fill.
- **Dot-Matrix Amber** (#ffd75e, `--pm-display`): machine values on the register (14.09 on the register ground) and the EXP badge (13.36 on chassis). The register's own ink — nothing else speaks it.

### Secondary
- **Fourteen family tokens (saturated, rq5)** — Gain #D9C37A, Compressor #8CC079, EQ #82A9DE, Delay #B18FDE, Reverb #6FC2C8, Limiter #DE8FB0, Distortion #C0CE97, Chorus #9E9ED1, Gate #9AD5B2, Autotune #D19ED1, plus the 2026-09-01 color pass for the four Tone.js effects — Phaser #96E3CC, Tremolo #96CAE3, Pitch Shift #CB96E3, Bitcrusher #E396CF (hues at the widest remaining gaps in the wheel, S58/L74 — a deliberately more vivid generation than cycle-3's muted S36 batch, for perceptual separation at the tighter hue spacing 14 colors forces): the KNOB ARCS (via `--knob-arc` per `data-family`, 6.93–12.50 as non-text arcs on chassis) and the palette chip's 20px legend squares. A section's arcs answer in its menu color.
- **Fourteen family silkscreen inks (desaturated, `--pm-family-*`)** — e.g. gain #cdc5ad, eq #aabacf, plus phaser #aacbc1, tremolo #aac0cb, pitch shift #c0aacb, bitcrusher #cbaac2: the rail's 3-letter family code and its 2px left tick (8.66–10.76 on chassis — clears AA even at small print).
- **Split-role safety red**: Edge Red #E5484D (rings/bezels only — BYPASS's 2px ring, refusal-toast bezel) and Fill Red #C93A32 (solid fills with white text 5.08 — engaged BYPASS). Never swapped, never white-on-edge-red.

### Tertiary
- **Live Green** #7BD389 (engine lamp), **Error Coral** #FF806E (status-error text on the etch) — rq5 residuals still correct on the etch pairing.
- **VU lamp paint** (`--pm-vu-*`): low #4ea96b → mid #ffd75e (one lamp language with the register) → clip #e4574a, on unlit glass #262933 with tick #c9cedc. Canvas-drawn by src/meters.js.

### Neutral
- **Bench** (#0a0b0f): the ground AROUND the instrument — the page reads as a slab on a surface.
- **Chassis** (#131316): the instrument's one continuous faceplate ground, both decks' casting base; also `--pm-ink` (text/fill ink on accent).
- **System Deck cast** (#17181d): the upper slab, a hair lighter — two castings, one instrument.
- **Section slab** (#181a21, `--pm-slab`): each chain section's own face — one step lighter than the chassis it sits IN (a raised casting, never a floating card), with a 1px sawn groove-cut edge and the machined **slab lip** (rgba(201,206,220,0.22)) directly under the top cut: brighter than a section groove, dimmer than the deck seam. Elevation on the board is TONAL + EDGE only.
- **Face Edge** (#232330): the chassis frame's machined bezel edge — a cut face, not a floating border.
- **Groove Cut / Groove Lip** (#05060a / rgba(158,164,184,0.14)): the machined groove between sections and zones — dark slot beside a light lip.
- **Seam Cut / Seam Lip** (#010208 / rgba(201,206,220,0.3)): the deck seam — deliberately deeper (4px) and brighter-lipped than section grooves; the deepest cut on the page.
- **Print ladder**: #9ea4b8 silkscreen labels (7.47 on chassis) · #c9cedc lifted print, values, trim caps (11.78) · #7f859b receding print, flow marks (5.06 on chassis, 4.74 on slab — corrected 2026-09-02: the previously recorded 5.26 was never reachable on any documented ground and the old #767c90 rung missed AA on both grounds at 4.46/4.18; the rung lifts one step, same tier, and tests/test-token-contrast.js now re-verifies every pair in this ladder on each run) · #dde2ee the GATED tier (2026-09-02), the rung measured to survive the pre-Start recede — 4.92 on chassis and 4.87 on a slab AFTER opacity 0.55 composites it, where print-hi would land 4.32 and print 3.09.
- **Key grounds**: #1d1e26 key ground with #343746 cut-edge bezel — a physical key on the panel; rest seams are decorative by the house hairline precedent.
- **Register slot** (#0b0c10): the inset display ground. **Ring track** (#454a5a): unlit knob scale — decorative; the arc carries the value. **Cap** (#1e2027): the matte knob cap.

### Named Rules
**The One Orange Rule.** Signal orange is spent only on system states (register marks, focus, live blink, pressed pads/keys, the chosen groove, Start). Family color belongs to the arc; identity color to the rail print. If a use is not a system state, it is not orange.
**The Split-Role Red Rule.** Edge red rings; fill red fills with white text. BYPASS is the only red thing on the system surface, and nothing outranks it.
**The Machined-Geometry Rule.** Boundaries are cut faces: dark cut under a light lip (grooves, seam, key bezels). No ambient shadow draws a boundary anywhere on the chassis.
**The Gated Print Rule** (2026-09-02). A gated surface may not be touched, but it must still be READ — both views print their "press Start" teaching inside the recede, and Simple prints its whole cold faceplate there. The recede is calibrated for CONTROLS, not prose, and at 0.55 it pushed every pre-Start word to 3.0–4.3. So the gate keeps its exact recede and the PRINT on it moves to the gated tier, which is the only ink permitted under the pre-Start recede and is never used anywhere else — off the gate it would outshine the ladder's top rung. Large print is exempt: the cold strip's family codes stay in family ink (20px/700 clears the 3:1 large-text bar at 3.94).

## Typography

**Body Font:** system-ui stack (`system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`)
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` — no webfonts, platform stacks only.

**Character:** Two registers that never swap. Human labels are silkscreen
panel print — small, bold, uppercase, tracked 0.08em, mid-print ink — the
printing on a faceplate. Machine values live in the mono dot-matrix
register with tabular numerals so a value changing never changes
geometry. The nameplate (app title) is not in either register,
because it is not TYPE at all (2026-09-03 overdrive round): the product
name is DRAWN as 5x7 display cells and lit by the live output. Two
registers of type, and one wordmark that is geometry — so no third face
ever enters the system. The text nameplate that renders until the matrix
paints (code tier, lifted print, 0.16em wordmark tracking) is the
fallback, and it is styled to be a good answer on its own.

### Hierarchy
- **Family code** (mono, 700, 1.25rem, 0.06em): the rail's large silkscreen identity print, in the family's desaturated ink.
- **BYPASS label** (sans, 700, 1.05rem, tracked): the heaviest type on the page — the safety key out-weights everything, including the nameplate.
- **Register line** (mono, tabular, 0.85rem / 13.6px, 400 + 700 segments): the panel instrument's etched tier — module · param · value on one line, segments differentiated by color/weight, never size. The system deck's status SENTENCE rides this size since 2026-09-03 (critique P3 #5; sans, not mono): it is the operator's primary verbal status, read mid-show from across a dark room, and distance readability is a functional a11y requirement — the etch's readouts stay one tier down and the sentence keeps neutral print, so the etch remains subordinate to the chain register.
- **Value tier** (mono, tabular, 0.75rem / 12px): EVERY per-control value and state readout — knob/trim values (min-width 6ch), pad legends, meter dB, flow-state print, register help line, preset name, system-etch values, the demoted `.status-detail` footnote. One size for everything that displays a value. (The deck's status sentence is the one prose exception — a sans state word at the register tier; see Register line.)
- **Silkscreen labels** (sans, 700, 0.7rem / 11.2px, 0.08em uppercase): param labels, zone legends, group legends, readout labels.
- **Nameplate** (DRAWN, 5x7 display cells at a 4px pitch — 3px below 900px): the instrument's identity is not set in a face, it is painted as geometry, so it belongs to no type register and adds no font to the system. The text nameplate behind it (sans, 700, 1.25rem, 0.16em — the code tier, the IDENTITY tier the rail's family code and the register's preset name already speak) is the fallback the page renders until the matrix has painted once.

### The type register (2026-09-02)

Sizes are TOKENS, not literals — `--type-title` 1.7rem · `--type-code`
1.25rem · `--type-code-rail` 1rem · `--type-key` 1.05rem · `--type-body`
1rem · `--type-prose` 0.9rem · `--type-register` 0.85rem · `--type-value`
0.75rem · `--type-label` 0.7rem · `--type-floor` 0.6875rem, plus
`--leading-prose` 1.55 / `--leading-dense` 1.35 / `--leading-code` 1.6 and
`--track-prose` 0.01em, over `--font-print` and `--font-readout`. This ramp
had been prose here since cycle 2 with nothing enforcing it, and the
stylesheet had drifted to 19 distinct sizes across 13 undocumented values —
three of them (0.68 / 0.70 / 0.72rem) inside two thirds of a pixel of each
other, and two BELOW the 11px floor, one of those on the preset
descriptions an operator reads in a dark room. A size is now one of these
roles or it is a bug. Two code sizes exist on purpose: the rail's condensed
module has started at 144px wide since the compactness round and 20px
crowds it.

**Light-on-dark compensation.** Prose opens one step on BOTH axes —
leading and tracking — because light strokes bloom on a near-black ground
and lines that read comfortably in a light document run together in a dark
one. Neither reaches the silkscreen labels (their own 0.08em) or the mono
register (whose columns stay on the ch grid).

### Named Rules
**The Register Rule.** Machine state renders mono tabular at the value tier (register main line one tier up at 13.6px); human labels render silkscreen sans. Nothing in between, and no value READOUT at any size outside the two tiers. The preset field's name (2026-09-03) is not a readout and is the one thing on the register at the code tier: it is chain IDENTITY, doing for the chain exactly what the rail's family code does for a module, so it takes that same print size. A value the machine is measuring never leaves the two-tier ladder.
**The 11px Floor Rule.** No text below 11px (the EXP badge's 0.6875rem is the floor). Standing recorded exception: canvas meter scale numerals are 9px inside the 96×26 scene — canvas-drawn, unchanged by recorded decision.
**The Drawn-Mark Rule** (2026-09-02). Direction and flow marks are drawn
geometry — `.chain-arrow-mark`'s square corner — never typed glyphs. The
signal-order strip's arrow and Simple's transport keys were the last three
Unicode stand-ins; the strip's rendered at 9.8px, under this system's own
floor, three feet from a board drawing the same mark properly.

**The Nameplate Discipline.** The app title is a nameplate, not a headline — it must never out-shout the BYPASS key. It is not a rule against PRESENCE, and the 2026-09-03 overdrive round is what that distinction looks like: prominence is bought with SCALE and DRAWN FORM, and the light the wordmark carries is bounded to the letterform cells themselves — never a fill, never a ring, never a plate. Every loud thing on the deck (the red, the ring, the 3rem key mass) still belongs to BYPASS alone, and the ranking the safety rule protects is untouched. On a single-row deck the nameplate costs no height at all: the BYPASS key still sets the row.

## Layout

The viewport is the bench; `.instrument` is a full-bleed squared chassis
frame on it. Inside, the Two-Deck Stack:

- **System deck** (sticky, `--pm-system-deck`): one wrapping row, min-height 4rem — nameplate · dot-matrix etch (engine lamp + status sentence + RATE/LAT/NODES, readouts at the 12px tier with the sentence one step up at the 13.6px register tier for distance readability — subordinate to the chain register by design) · Start/device keys · agent chip · BYPASS at the right end. Below 900px the etch wraps to a second row; BYPASS stays in the visible top.
- **Deck seam**: 4px machined joint (1px bright lip over a deep cut) — deeper and brighter than any section groove so the two slabs read as one instrument under load.
- **Voice deck**: grid `200px 1fr 220px`, gap 0 — palette zone | chain face | presets zone as PRINTED ZONES on the one chassis ground, separated by groove halves (palette's right edge is the cut; the face's left border is the lip; cut-then-lip in reading order). Below 900px the zones stack palette → face → presets and the grooves turn horizontal.

The FIXED ONE-PAGE CONSOLE (2026-08-31 round, user direction): at ≥901px
the instrument IS the page — one viewport-height chassis (`html/body`
overflow hidden, `.instrument` a 100vh flex column), no page scroll
anywhere; every zone scrolls INSIDE. The voice deck takes the remaining
height; the palette and presets flanks scroll their own content; the
chain face (Single Face Chassis: display register on the top edge — which is also
the FIXED home of the MIC IN meter unit (jack ring + legend + the 96×26
lamp bar + mono dB readout in one row, the base plate's OUT corner
mirrored top-left; the left register field speaks when a control is touched,
while a persistent right field names the clean preset or reads UNSAVED —
since 2026-09-03 that right field is a dedicated inset PRESET WINDOW, its
own sub-display on the register's right end;
the engine-state rest line is retired); the FACE (the board → OUT jack
print) scrolling inside, with the OUTPUT SCOPE BAND as a fixed 3.5rem
zone between the board and the signal-order strip; base plate carrying the pinned OUT footer
mirror / VU corner, bottom-right, always visible, never dimmed) owns
the pan in BOTH axes. Below 901px the zones stack and the page keeps its
scroll. VERTICAL FLOW IS RETIRED (same day, user direction): the board
has exactly ONE reading — horizontal, condensed modules in a
left-to-right row; the FLOW toggle, its preference key, and the vertical
geometry branches are deleted (`.flow-horizontal` is a permanent panel
class), and legacy vertical payloads load horizontal.

**The board (ordered row, 2026-09-01):** sections sit in a horizontal
flex row and DOM order equals chain order (PD-4). Each section is a
CONDENSED MODULE with a compact header band over the encoder field.
Unresized modules start at the smallest safe expanded width, 144px. The
corner grip resizes an expanded module from 144–640px in 16px steps and
persists only that expanded width. Controls keep their natural width and
wrap from the left, so the minimum stacks them while a stretched module can
place a complete knob or slider field on one line. Folding is session-only:
it hides the encoder field and turns the module into a 56px vertical rail
with the full plugin name printed sideways and its actions stacked below,
then restores the saved expanded width. Resizing and folding never touch
sound.

**Patch cords (FEW-3/FEW-4, geometry by OQ-9):** an SVG cord layer
behind the sections draws MIC OUT → sections in chain order → OUT IN
from the same positions map (nodes + 1 segments, re-routed by every
position/order write path). Jack geometry is the across-from rule — one
reading since vertical flow was retired: a card's input sits at the
middle of its LEFT border and its output at the middle of its RIGHT
(directly across). The two PANEL TERMINI (2026-08-31 cord round): the
MIC cable DROPS at the content top directly beneath the fixed header
unit's meter (content-anchored so it never pans; the ring is the
drag-to-relink grab point), and the chain's OUT EXITS at the board's
bottom-right corner — one grid unit in from the extent — dropping
visually toward the base plate's OUT port. The in-flow OUT anchor block
is retired; the row reads mic → across through the modules → out.
Every jack is ONE drawn vocabulary — a 15px ring with a dark socket dot,
sitting ON the border line it serves (half-buried in the slab's edge)
with a quiet print-lift hover. Jack rings are the layer's only
pointer-live children: dragging a cord end reorders the chain — audio
changes ONLY on a completed link; drop nowhere reverts (keyboard Escape
is the twin). Ghost cords and hot drop targets take the accent ink.

**The machined gutter (2026-09-02):** every scroller inside the chassis wears one scrollbar vocabulary — a slim floating pill in the key-edge ink on a transparent track, brightening to print-dim on hover, with the corner left as chassis. It shipped on the Advanced flanks only, so Simple's Sounds library and stage and the board itself still showed the raw platform bar; one selector list now owns it, and a new scroller joins that list rather than growing a second copy. Simple's Sounds body also takes Advanced's own content padding (0.9rem right, at every width), so scrolled content keeps the same gap from the gutter that it has from the panel's left edge.

Spacing rhythm is console-tight (4/8/12/16px); panel padding ~0.85–1rem;
section padding 0.4/0.6/0.45/0.7rem (the board: header band + wrapping
body inside the condensed module, default width at the 144px resize
floor so controls open as a single stack) + fluid encoder field grid.

## Elevation & Depth

Flat by machined geometry, not by shadow. Depth is cut faces and tonal
casting: the bench around the instrument, the two deck castings, the
inset register slot, grooves and the seam as dark cuts under light lips,
keys as cut-edge bezels. The only real shadow in the world is the drag
LIFT (the held section, or a palette chip's drag image, fixed to its own
box and following the pointer) and the residual lifted toasts; a touched
section lifts a hair while neighbors recede — `filter: brightness(1.13)`
on `:focus-within`, `brightness(0.9)` on the rest — explicitly NO
shadow. No glow, no hover shadows, no ambient anything.

### Shadow Vocabulary
- **Drag lift** (the held section / the dragged chip's image): the one physical lift on the chassis.
- **Knob cap lip** (`inset 0 1px 0 rgba(255,255,255,0.06)`): bevel geometry, not ambient depth.
- **Off-chassis modal lift** (agent toasts, the headphone-check safety dialog — enumerated 2026-09-02 polish round): floating surfaces that leave the chassis entirely carry a lifted shadow over a bezel border. Same family as the toasts' documented exception; the safety dialog's own corners take the 4px key radius like the keys it holds.

### Named Rules
**The Rest-Flat Rule.** Surfaces are flat at rest. A shadow means physical lift (drag, floating toast); emphasis means brightness on matte. Never glow.
**The Power-Up Exception** (2026-09-02, owner-approved). The engine's cold start is the ONE sequence permitted past the 150–250ms answer law: the meters' lamp test and the gated face's wake (the print rising to full while the hatch peels off toward OUT, 420ms). It runs once per engine start, at setup, never during a show; it fills a wait that already exists and gates nothing — the gate class is off before the wake's first frame, so the surface is interactive throughout. Both halves are `prefers-reduced-motion` guarded, and both degrade to a state rather than a motion. Everything else on this instrument still answers in 150–250ms, and page LOAD choreography stays banned — this is a state answer to a deliberate human action, not an entrance.

## Shapes

Squared machined hardware. The chassis frame and all sections have
radius 0; the remaining radii are small and functional: 2px (empty-socket
hint), 3px (EXP badge), 4px (control keys), full-circle (knobs, jack
rings, legend squares). The recurring signature geometry: the 15px drawn
jack — one ring + dark socket vocabulary shared by the cord layer's
border-line jacks and the panel prints — the 3×3 grip dot field, the
3px family tick on the rail, the register's 3px accent mark at its left
edge, the diagonal 45° hatch texture (7px/2px) of the one disabled
grammar, and the dashed print slot of the insertion ghost / empty
socket. Focus rings are 2px solid orange with 1px offset; on orange
fills the chassis-ink ring is drawn inside the fill (`outline-offset:
-2px`).

## Components

Tactile, panel-mounted, answering within 150ms — brightness and print,
never shadow or glow.

### Buttons (control keys)
- **Shape:** 4px radius, key ground #1d1e26, cut-edge bezel #343746, bright print; padding 0.5rem 1rem.
- **Start (the one orange key):** signal-orange fill, chassis ink, 700; hover #ff8558, press #e85a20; ink focus ring inside the fill. Recedes to the shared disabled treatment once the engine runs.
- **Control keys (device, presets):** shared vocabulary; hover leans the bezel to full print; pressed = the one orange fill with ink; disabled = recede (0.55, cut-edge seam, not-allowed).
- **BYPASS (the red-ringed end key):** 3rem min-height, 1.05rem/700 tracked — the loudest element on the deck. OFF: key ground + bright print + 2px edge-red ring. ON: red-fill ground + white text + edge-red ring. Sticky-deck placement never leaves the visible top.

### Knobs (the encoder field's rotary voice)
- **40px rotary encoder** (side-label unit, 2026-08-31 compactness round); the native `input[type=range]` is the clipped, focusable semantic engine (opacity 0, hit-through); the knob draws focus as an orange ring at the dial's edge. Ring: conic arc from 225° sweeping 270°, min→value in the SECTION'S FAMILY COLOR (`--knob-arc`, set per `data-family`) over the unlit ring-track scale; matte cap with a print pointer line (`--knob-rot`); bipolar params print a neutral 12-o'clock detent tick outside the ring. Vertical drag (150px sweep, Shift ×0.2, wheel one step/notch), native arrows/Home/End. The unit reads SIDE-LABEL: dial left, silkscreen label over mono value (12px, min-width 6ch) to its right — one row's height is the dial alone. Family color lives on the arc ALONE — pointer, track, tick, labels, values stay neutral.

### Pads (discrete params)
- Real buttons in a radio group (roving tabindex; string commits verbatim): key ground, print text at the 12px value tier, 44px hit floor. The pressed pad is LIT in the accent fill with chassis ink — the accent-as-brightness economy: the selected value is the one bright thing in the group.

### Trims (wide linear ranges)
- A short horizontal instrument trimmer: silkscreen label + mono value line over a hairline milled slot with a bright print cap (delay Time, autotune Retune, gate Release). Neutral by recorded choice.

### The display register
- One etched slot on the chain face's top edge: inset register ground, machined lip, a 3px accent mark at the left edge, FIXED 3rem height over two lines (main + help) that clip, never reflow. The left field is `module · param · value` in mono tabular 13.6px — module segment in signal orange, segments differentiated by color/weight, never size. Its help line sits at the 12px value tier. The touched control's value writes it; the ONE blink (register-blink) lives here. This redundant control display stays `aria-hidden`. A persistent, independently accessible right field reads the preset state: the register's right end is a dedicated PRESET FIELD, a fixed share (min(34%, 24rem)) of the slot. It was first drawn (2026-09-03 live round) as an inset WINDOW on a deeper cut ground behind a lip border, and a second live round the same day replaced that: a recess cut deeper than the ground it sits in is exactly what made it read as a tag stuck in the corner rather than as part of the instrument. It is now the register's OTHER HALF — the register's own ground, its own 3px signal-orange mark at the same 0.6rem inset as the slot's, content flush-left behind that mark, the silkscreen PRESET label (11.2px sans) over the name in the register's amber machine ink at the CODE tier (20px, the identity tier — see the Register Rule), and a machined lip down its left edge as the whole division. UNSAVED keeps the accent orange. One slot, two displays, read left to right. The field is geometry like the slot it lives in (2.5rem tall, inset 0.25rem), its ground still opaque so it masks the control lines beneath, and the register's fixed-3rem no-reflow law is untouched. It reads `PRESET / <name>` while the chain matches a named preset and `PRESET / UNSAVED` after the first accepted adjustment or for a chain with no saved baseline. Repeated edits in the same unsaved state do not repeat the live-region announcement.

### Sections (chain effects)
- WEIGHTED SLABS on the one faceplate (OQ-9): radius 0, `--pm-slab` face ground one step lighter than the chassis, a 1px sawn groove-cut edge all round, and the machined slab lip (inset 1px under the top cut) — a raised casting separated from its neighbors by the chassis ground, never a floating card and never a shadow at rest. Grid (vertical reading): 6.5rem family rail | fluid encoder field; grid (horizontal/default reading): one column — the rail is a compact header band over the wrapping body, and the module width per its layout `w` starts at 144px with a 144–640px expanded clamp and corner-resize grip. **Rail:** the family print block — 3px family tick down its left edge · machined grip dot field (the drag part) · family code in desaturated ink · module label · EXP badge · IN/BYP key · fold chevron + eject × at the rail's foot; a groove-cut division separates rail from encoder field. **Family derivations:** one rule per `data-family` carries BOTH `--card-family` (rail print ink) and `--knob-arc` (saturated arc token) — single source, no per-control classes. **Per-effect bypass:** BYP strikes the family code and recedes the encoder field to 0.42 while leaving controls usable. The node, settings, and live plugin instance remain present. This state never borrows emergency red, the global hatch, or the global Bypass label. **Fold:** the params field leaves the tab order and the card becomes a 56px vertical identity rail (session-only, `aria-expanded`); its full name reads sideways, actions stack vertically, and expanding restores the saved width. **Focus lift:** `:focus-within` brightens to 1.13, neighbors recede to 0.9 (180ms, guarded). **Drag:** the whole section is grab surface (the rail is the ADVERTISED grip and the only one carrying the grab cursor; the encoder field's controls — knobs, pads, trims, the bypass/fold/eject keys, the resize corner — own their own press and never start a drag). The chosen (held) section lifts out of flow with the one permitted drag shadow and its machined lip goes accent; the ghost is a dashed print slot carrying the module's name — a groove reservation, not a section — and MOVING that ghost is the entire drop preview: the real sections never move under the cursor, and nothing commits until the drop. A chip dragged in from the palette opens the same ghost, on the same slot rules (including the terminal limiter's locked-last clamp), and adds nothing at all when released off the board. **Agent pulse:** one accent blink on the section's machined lip (150ms ×2, animationend-pinned class name), plus the agent chip's single 1.2s activity breath while acting — the only slow animations, both reduced-motion-guarded.

### Chips (palette zone)
- Real `<button>`s rendered as KEYS on the voice deck: key ground, cut-edge bezel, a 20px family legend square (saturated rq5 token — the identity mark) beside the module name as a silkscreen legend (12px uppercase). Rest seam is the cut edge; hover raises to full print; active/drag-origin goes signal orange. Fourteen chips chunk under five non-interactive group legends in operator language ("Shape your voice" / "Add movement" / "Change your pitch" / "Polish your sound" / "Keep it safe") as real `<h3>`s — re-categorized 2026-09-01 when the Tone.js four joined the catalog: "shape" narrowed to tone/timbre only (EQ, Distortion, Bitcrusher), "movement" is the standard modulation grouping (Chorus, Tremolo, Phaser), "pitch" is the pitch domain (Autotune, Pitch Shift) — splitting what had been one crowded "character" bucket into three legible ones.

### Cards / Containers
- **Experimental badge (autotune only):** one class, two placements (section rail + palette chip, "EXP" at chip density) — display-amber silkscreen on transparent (a machine marking, not a bright object), 1px amber border, 3px radius, 0.6875rem/700 mono at the 11px floor. A status tag, not a control: no focus, no pointer. Single-sourced from the type registration.
- **Empty socket (taught empty state):** recessed register ground, dashed print boundary, centered print text; state-aware copy (pre-Start vs drag teaching).
- **Agent toasts (rq5 residual, off-chassis):** floating cards with bezel borders, lifted shadow, ≤340px, bottom-right stack; refusal bezel is 2px edge red; Undo is the one ink-on-orange action.
- **Undo — one shared stack (2026-09-02 harden round, critique P1):** every accepted edit pushes onto the ONE undo stack with an operator-language label derived from the edit itself — agent mutations ("save_preset …", set_param plans) AND human edits ("Add Reverb", "Move Reverb after Delay", "Reverb mix 30 → 45", "Try 'Warm Ballad'"). Ctrl/Cmd+Z and the toast's Undo key pop it. **The visible human entry point (2026-09-03 refinement, critique P2):** a human STRUCTURAL edit — add, remove, reorder, same-seat replacement, or a preset try-load — announces itself with ONE transient toast in the agent-toast vocabulary carrying its own operator label (the same derivation, no second vocabulary) and the shared Undo key; param knob/pad commits and the per-effect IN/BYP key stay silent (their state is its own feedback), and the toast never relabels. Human entries restore SILENTLY (their revision is self-consistent at push, and any later bump sits above them in LIFO order — the toast's Undo key never relabels for them); the conflict confirm stays the agent path's protection against clobbering off-stack human work, so store-side bumps that push nothing (preset overwrite/delete) still conflict exactly as before. Restores route through the guarded source:'undo' transaction — never around it.

### Navigation
- **BYPASSED on the deck (2026-09-02, user direction):** while bypass is engaged the chain is gated to silence and the room hears the dry tap, so the deck's sentence stops saying LIVE and reads `BYPASSED — EFFECTS OFF`. The lamp keeps reporting the ENGINE (still live); the WORD reports the CHAIN, which is what an operator is asking the header about. Both go safety red, matching the BYPASS key lit red at the same moment — a third, deliberately narrow role for edge red (a 10px lamp and one short line, never a fill, never a large area), so the split-role rule holds and nothing outranks the key itself. A standing error still outranks it: `.status.error` is declared after `.status.bypassed`. Measured 4.99 on the etch ground.
- **BYPASSED on the Simple stage (2026-09-02 harden round, critique P1):** the default view's "what am I hearing" face answers the same moment instead of silently naming a gated-off sound. `SimpleView.onBypassChanged()` — called from `setBypassButtonLabel()`, the deck key's own choke point — recedes the stage's content under the one disabled grammar's bypass hatch variant (0.45 alpha, same as the board's chain region) while the controls STAY interactive (tune while dry, like the board's sections), and prints the deck sentence's own words as one short uppercase line in edge red, placed OUTSIDE the receded content so it never dims (measured 4.74 on the stage's chassis ground). The line is `aria-hidden` — the deck's `role="status"` sentence announces the state once; the line is the stage's redundant picture. The state is only ever true on a LIVE engine (`engineIsLive() && AudioBypass.isEngaged()`, derived on every render): the pre-Start gate owns the stopped stage, and the two readings can never meet. Meters sit outside `#simple-stage` and never dim, exactly as in Advanced.
- **The nameplate matrix (2026-09-03 overdrive round):** the product name is DRAWN, not set — 5x7 display cells at a 4px pitch (3px below 900px), 8 glyphs and a 1-cell gap, so the word is a 47x7 grid sized in whole pixels off one cell token and every dot lands square on the device grid. The reason is not decoration: the app title had been the platform sans, which is the one thing an own-world page can never use as its display voice, and this project bans webfonts and display faces outright. So the word stops being type. Nothing here is text, so the two-register type law is untouched and no third face enters the system — and the register it DOES borrow is the machine's own display, used for the one thing the machine has to say about itself.
- **How it lives:** `src/signal-lamps.js` lights the cells from the baseline up, column by column across the word, from the same final-output window the scope slots read — one feed, every live surface, no second measurement. Unlit cells print bright (`--pm-print-hi`, NOT the meters' unlit glass: a dark cell is right for a lamp bar read by its lit length and wrong for a product name that must be legible on a dead engine in a dark room), so the signal can only ADD light and can never change the resting face. Lit cells take the VU ladder's own mid paint; a column at the meters' clip threshold turns the meters' red. The lit height is sqrt-lifted, so conversational level already climbs a row instead of sitting dark until someone shouts. Engine stop repaints the resting face — a frozen last frame would claim a signal that is no longer there — and bypass flattens it by itself, because the output it reads is what bypass gates.
- **The fallback is the point:** `.app-title` is real text, styled as a nameplate, and it is what renders until the matrix paints once (`.matrix-live`, set by the first successful paint). No JS, a stripped harness, a paint path disabled by the module's one-strike rule — every one of those still shows the product's name, and the `<h1>` keeps the accessible name in all states while the canvas stays `aria-hidden`.
- **System deck + dot-matrix etch:** the signature surface — one persistent row reading as an instrument's status display. The etch borrows the register's inset geometry but stays SUBORDINATE to the chain face's register: neutral bright print (never amber/orange), values one tier down at 12px. The status SENTENCE alone rides the 13.6px register tier (2026-09-03): distance readability is a functional a11y requirement, and the sentence keeps neutral print with its technical footnote demoted at 12px, so the subordination and the one-mouth rule hold. The machine reports from one mouth, and it is the canvas register's.

### Meters
- **MIC IN / OUT units + the VU corner:** 96×26px canvas lamp bars (unlit glass, green→amber→clip stops, peak tick, clip latch dot) with mono dB readouts at the 12px tier. The pinned OUT footer is a second VIEW of one feed — output ground truth never depends on scroll or collapse, and never dims (including while bypassed). Ballistics are per-frame canvas draws: functional motion, live under reduced-motion by construction.
- **The output scope band (Advanced, 2026-09-03 live round):** the Simple stage's scope as a second VIEW on the voice deck — the same final-output tap, the same 42.7 ms window — as a fixed 3.5rem band between the board's OUT meter above it and the signal-order strip below. It PRINTS rather than mounts: Advanced's live-signal idiom is already light ON the faceplate (the chevron lamps between cards), not light inside a display window, so the band takes the signal-order strip's own vocabulary — machined lip over the top cut, groove-cut below, the chassis showing through behind the trace — instead of the register's inset ground. `src/signal-lamps.js` BUILDS Simple's slot and ADOPTS every other one by canvas class, painting all of them from ONE feed, so two views can never disagree and a slot that is off screen costs a zero-box test and nothing else. `aria-hidden` like its twin (the OUT meter immediately above keeps the numbers), no accent anywhere, and `display: none` before Start: the band has no cold reading, so it arrives with the live face and leaves with it.
- **The lamp test (the power-up, 2026-09-02):** the Start commit runs both ladders end to end and back — 260ms exponential-ease-out rise, 120ms full-scale hold, 320ms linear release — filling a wait that already exists (getUserMedia, the worklet fetches, the first graph build) and delaying nothing. It is also the only free moment to prove every segment on both meters still lights, which is what an operator most wants confirmed before a show. Three honesty rules make it admissible on a live-audio surface: the drawn level is `max(real, sweep)`, so the test can only ADD light and can never under-report a real signal; it touches the LAMPS alone, leaving the dB readout, the CLIP latch, the clip dot and every aria value on the real feed for the whole sequence (the readout reads −∞ under a full ladder, exactly as hardware does); and it runs once per engine start. Under reduced motion there is no sweep — both ladders light full-scale for a 200ms hold and release, the same proof as a state rather than a motion.

### The cold face (Simple, before Start)
- The stage's pre-Start composition, and NOT a degraded copy of the live one. The live face answers "what am I hearing"; the cold face answers "what is this machine holding" — a question that has a true answer before Start, so the stage never stands empty. Built by `src/simple-view.js#renderColdFace()` from reads only: the chain is `Persistence.loadInitialModel()` (the exact array Start will commit), the name is a STRUCTURAL match against the factory library (same types, params, order — anything else is honestly "your last chain"), the description is that preset's own library copy, and the count is the library the Sounds panel is listing. Nothing on it claims a sound is playing.
- **The strip:** a raised casting (slab ground, cut faces top and bottom, machined lip) carrying the two panel termini in the board's own 15px jack vocabulary and one PLATE per section between them — a 2px family tick down the left edge (doing double duty as the division between sections), the 3-letter code at the family-code tier in the family's desaturated ink, the module label in silkscreen micro, and the drawn chain-arrow chevron in the gap after each. Plates size to their own print, not to an equal share: real silkscreen has irregular columns because the words do. Below 901px the two termini become the strip's top and bottom rails; the sections keep their one horizontal reading and wrap.
- The strip is `aria-hidden` — a redundant picture of the sentence above it — and the legend under it carries the same fact as text.
- **Armed (2026-09-02, user direction):** a pre-Start click on a Sounds row ARMS that sound. The cold face then prints ITS chain, ITS description and "Press Start to try <name>", its legend reads QUEUED rather than CHAIN HELD, the row takes a dashed accent edge (chosen, not yet real — the insertion ghost's own distinction), and the engine loads exactly that sound the moment it comes up, through the same guarded `loadFactoryPreset`/`loadUserPreset` transaction a live Try uses. The mutation guard does not move: arming writes one UI variable and repaints, and the load runs from `onEngineStarted` after `engineIsLive()` is true, so a synthetic click on a gated row still reaches nothing. Armed-but-unresolvable prints the promise with no strip rather than the promise over another sound's chain.

### Inputs / Fields
- **Selects (device, presets):** shared key vocabulary, native dark rendering via root `color-scheme: dark`; optgroup labels read as silkscreen micro-legends.
- **Inline preset naming (Save As):** no browser dialogs — the naming row opens under the select in the key vocabulary; Enter commits, Escape cancels, blur never commits.
- **Preset sharing (links, 2026-09-02 shape round):** a personal preset travels as a URL — the preset itself, not a file. src/preset-link.js encodes PresetSchema.serialize's own shape ({name, schemaVersion, nodes}) into the URL FRAGMENT (`#preset=v1.<base64url>` plain, `v1d.` deflate-raw when CompressionStream is present; the parser accepts both), so nothing is ever sent to a server and the no-cloud constraint holds. **Copy link** lives with the Presets panel's actions (enabled exactly when the ACTIVE preset is one of Yours) and in Simple's Yours-row "…" menu; feedback rides the .preset-note line / a transient in-row note, never a browser dialog. Landing on a link renders ONE arrival card at the top of whichever panel is showing — the sound's name, a plain-language effect summary, Add to my sounds / Dismiss, and the Rename (inline input) / Replace / Cancel triad on a name collision — and never loads the live chain; the fragment is consumed on arrival (history.replaceState), so a refresh cannot re-offer. Shared links carry chain data only: no audio, no microphone identifiers, no local settings.
- **Armed Delete:** two-step in-panel — first click relabels to "DELETE?" and raises an edge-red bezel (edge, never fill — fill red is BYPASS-only); second click within 5s deletes.

## Do's and Don'ts

### Do:
- **Do** extend the `--pm-*` register — introduce no raw hex values; new colors enter as tokens in the measured vocabulary.
- **Do** keep the value ladder exact: every value/state readout mono tabular at 12px, the register main line at 13.6px, silkscreen labels at 11.2px sans — nothing between the tiers.
- **Do** keep color redundant: family identity is always code + label + arc/legend-square together; every state change is copy + color.
- **Do** draw boundaries as cut faces (dark cut under light lip) and emphasis as brightness on matte; reserve the hatch + recede grammar for the pre-Start gate and the emergency-bypassed chain. Use the local IN/BYP state for one effect.
- **Do** keep DOM order equal to chain order — board seats and z-order are paint; the cords layer re-routes from the same positions map on every write.
- **Do** guard every motion addition with `prefers-reduced-motion` (150–250ms state answers); meter ballistics stay live by drawing per-frame.

### Don't:
- **Don't** render text below 11px (recorded exception: the 9px canvas meter numerals), use webfonts/CDN assets, or add display fonts.
- **Don't** use signal orange for anything that is not a system state, and never as decoration or large-area fill.
- **Don't** swap the safety red roles (edge ↔ fill) or put white text on edge red; don't let anything outrank BYPASS on the deck.
- **Don't** add glow, blur, load choreography, hover shadows, or border-radius card islands — sections are print zones of the one faceplate. The one sequence past the answer law is the Power-Up Exception above; nothing else earns it.
- **Don't** let the cords gate audio mid-drag — sound changes only on a completed link; drop-nowhere reverts.
- **Don't** let the machine speak twice — the system etch stays subordinate (neutral print, 12px values, the sentence at the register tier for distance reading); the chain face's register is the one amber machine voice.
