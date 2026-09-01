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
  print-dim: "#767c90"
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
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.08em"
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
legend squares.

**Key Characteristics:**
- One instrument, two decks, three printed zones — machined grooves and one deck seam, no floating panels, no border-radius islands.
- Single Face Chassis: display register on the top edge, sections as print zones, jack-print anchors, VU corner + flow switch on the base plate.
- Encoder field: 54px knobs (family-colored arcs), pad radio-groups, trim slots; the display register answers the touched control.
- Free board: snap-grid positioning, patch cords that EDIT order but never gate audio; DOM order is always chain order. No arrange/tidy key — the board is a free canvas (retired 2026-08-31).
- One signal orange for system states only; family color on the arc alone; BYPASS's split-role red outranks everything on the deck.
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
- **Print ladder**: #9ea4b8 silkscreen labels (7.47 on chassis) · #c9cedc lifted print, values, trim caps (11.78) · #767c90 receding print, flow marks (5.26).
- **Key grounds**: #1d1e26 key ground with #343746 cut-edge bezel — a physical key on the panel; rest seams are decorative by the house hairline precedent.
- **Register slot** (#0b0c10): the inset display ground. **Ring track** (#454a5a): unlit knob scale — decorative; the arc carries the value. **Cap** (#1e2027): the matte knob cap.

### Named Rules
**The One Orange Rule.** Signal orange is spent only on system states (register marks, focus, live blink, pressed pads/keys, the chosen groove, Start). Family color belongs to the arc; identity color to the rail print. If a use is not a system state, it is not orange.
**The Split-Role Red Rule.** Edge red rings; fill red fills with white text. BYPASS is the only red thing on the system surface, and nothing outranks it.
**The Machined-Geometry Rule.** Boundaries are cut faces: dark cut under a light lip (grooves, seam, key bezels). No ambient shadow draws a boundary anywhere on the chassis.

## Typography

**Body Font:** system-ui stack (`system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`)
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` — no webfonts, platform stacks only.

**Character:** Two registers that never swap. Human labels are silkscreen
panel print — small, bold, uppercase, tracked 0.08em, mid-print ink — the
printing on a faceplate. Machine values live in the mono dot-matrix
register with tabular numerals so a value changing never changes
geometry. The nameplate (app title) is deliberately NOT a headline: it
is the same micro-style as the zone legends, in lifted print.

### Hierarchy
- **Family code** (mono, 700, 1.25rem, 0.06em): the rail's large silkscreen identity print, in the family's desaturated ink.
- **BYPASS label** (sans, 700, 1.05rem, tracked): the heaviest type on the page — the safety key out-weights everything, including the nameplate.
- **Register line** (mono, tabular, 0.85rem / 13.6px, 400 + 700 segments): the panel instrument's etched tier — module · param · value on one line, segments differentiated by color/weight, never size.
- **Value tier** (mono, tabular, 0.75rem / 12px): EVERY per-control value and state readout — knob/trim values (min-width 6ch), pad legends, meter dB, flow-state print, register help line, preset name, system-etch values. One size for everything that displays a value.
- **Silkscreen labels** (sans, 700, 0.7rem / 11.2px, 0.08em uppercase): param labels, zone legends, group legends, readout labels.
- **Nameplate** (sans, 700, 0.75rem, 0.08em): the identity legend on the system deck.

### Named Rules
**The Register Rule.** Machine state renders mono tabular at the value tier (register main line one tier up at 13.6px); human labels render silkscreen sans. Nothing in between, and no value readout at any size outside the two tiers.
**The 11px Floor Rule.** No text below 11px (the EXP badge's 0.6875rem is the floor). Standing recorded exception: canvas meter scale numerals are 9px inside the 96×26 scene — canvas-drawn, unchanged by recorded decision.
**The Nameplate Discipline.** The app title is a nameplate, not a headline — it must never out-shout the BYPASS key.

## Layout

The viewport is the bench; `.instrument` is a full-bleed squared chassis
frame on it. Inside, the Two-Deck Stack:

- **System deck** (sticky, `--pm-system-deck`): one wrapping row, min-height 4rem — nameplate · dot-matrix etch (engine lamp + status sentence + RATE/LAT/NODES, values at the 12px tier, subordinate to the chain register by design) · Start/device keys · agent chip · BYPASS at the right end. Below 900px the etch wraps to a second row; BYPASS stays in the visible top.
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
mirrored top-left; the register speaks only when a control is touched —
the engine-state rest line is retired); the FACE (the board → OUT jack
print) scrolling inside; base plate carrying the pinned OUT footer
mirror / VU corner, bottom-right, always visible, never dimmed) owns
the pan in BOTH axes. Below 901px the zones stack and the page keeps its
scroll. VERTICAL FLOW IS RETIRED (same day, user direction): the board
has exactly ONE reading — horizontal, condensed modules in a
left-to-right row; the FLOW toggle, its preference key, and the vertical
geometry branches are deleted (`.flow-horizontal` is a permanent panel
class), and legacy vertical payloads load horizontal.

**The board (free positioning, cycle 4 + the 2026-08-31 rounds):** every
section is an absolutely positioned slab translated to its board seat by
JS (`transform: translate(x,y)`, snap-quantized to the 16px grid). Each
section is a CONDENSED MODULE — the rail collapses into a compact header
band (grip · code · label · fold/eject right) over the wrapping encoder
field. Every module HUGS ITS OWN CONTENT: JS measures the widest
intrinsic control row after render (knob rows only — trims and pads
stretch to fill by construction) and that is the module's default width
(clamped 96–384px, resize floor 96; the layout-less fallback default is
128px). Values hug their text inside the module (no 6ch slot), so a
module opens as a single stack with no right-hand dead space; widening
re-wraps the field to fill. Height hugs content.
Position AND width are STYLE ONLY — DOM order always equals chain order
(PD-4), so bring-to-front z-order is paint, never sequence. The header
band and grip drag move a section's seat; the corner resize grip (a
machined dot-field mark, bottom-right) adjusts its width (`w` joins x/y
in the layout entry; snap-quantized, clamped, end-only persistence);
neither ever touches sound. The arrangement autosaves. THE BOARD HAS NO
TIDY/ARRANGE KEY (retired 2026-08-31, user direction: not helpful) —
nothing moves the operator's cards but the operator; the board is a
free canvas.

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

Spacing rhythm is console-tight (4/8/12/16px); panel padding ~0.85–1rem;
section padding 0.4/0.6/0.45/0.7rem (the board: header band + wrapping
body inside the condensed module, default width at the 176px resize
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

### Named Rules
**The Rest-Flat Rule.** Surfaces are flat at rest. A shadow means physical lift (drag, floating toast); emphasis means brightness on matte. Never glow.

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
- One etched slot on the chain face's top edge: inset register ground, machined lip, a 3px accent mark at the left edge, FIXED 3rem height over two lines (main + help) that clip, never reflow. Main line: `module · param · value` in mono tabular 13.6px — module segment in signal orange, segments differentiated by color/weight, never size. Help line at the 12px value tier. The touched control's value writes it; the ONE blink (register-blink) lives here. aria-hidden: the controls carry semantics; this is the redundant display.

### Sections (chain effects)
- WEIGHTED SLABS on the one faceplate (OQ-9): radius 0, `--pm-slab` face ground one step lighter than the chassis, a 1px sawn groove-cut edge all round, and the machined slab lip (inset 1px under the top cut) — a raised casting separated from its neighbors by the chassis ground, never a floating card and never a shadow at rest. Grid (vertical reading): 6.5rem family rail | fluid encoder field; grid (horizontal/default reading): one column — the rail collapsed into a compact header band over the wrapping body, the module width per its layout `w` (uniform 240px default, 176–384px clamp, corner-resize grip). **Rail:** the family print block — 3px family tick down its left edge · machined grip dot field (the drag part) · family code in desaturated ink · module label · EXP badge · IN/BYP key · fold chevron + eject × at the rail's foot; a groove-cut division separates rail from encoder field. **Family derivations:** one rule per `data-family` carries BOTH `--card-family` (rail print ink) and `--knob-arc` (saturated arc token) — single source, no per-control classes. **Per-effect bypass:** BYP strikes the family code and recedes the encoder field to 0.42 while leaving controls usable. The node, settings, and live plugin instance remain present. This state never borrows emergency red, the global hatch, or the global Bypass label. **Fold:** the params field animates 1fr→0fr to a groove-line slim row (~35px, session-only, `aria-expanded`); folded rows leave the tab order. **Focus lift:** `:focus-within` brightens to 1.13, neighbors recede to 0.9 (180ms, guarded). **Drag:** the whole section is grab surface (the rail is the ADVERTISED grip and the only one carrying the grab cursor; the encoder field's controls — knobs, pads, trims, the bypass/fold/eject keys, the resize corner — own their own press and never start a drag). The chosen (held) section lifts out of flow with the one permitted drag shadow and its machined lip goes accent; the ghost is a dashed print slot carrying the module's name — a groove reservation, not a section — and MOVING that ghost is the entire drop preview: the real sections never move under the cursor, and nothing commits until the drop. A chip dragged in from the palette opens the same ghost, on the same slot rules (including the terminal limiter's locked-last clamp), and adds nothing at all when released off the board. **Agent pulse:** one accent blink on the section's machined lip (150ms ×2, animationend-pinned class name), plus the agent chip's single 1.2s activity breath while acting — the only slow animations, both reduced-motion-guarded.

### Chips (palette zone)
- Real `<button>`s rendered as KEYS on the voice deck: key ground, cut-edge bezel, a 20px family legend square (saturated rq5 token — the identity mark) beside the module name as a silkscreen legend (12px uppercase). Rest seam is the cut edge; hover raises to full print; active/drag-origin goes signal orange. Fourteen chips chunk under five non-interactive group legends in operator language ("Shape your voice" / "Add movement" / "Change your pitch" / "Polish your sound" / "Keep it safe") as real `<h3>`s — re-categorized 2026-09-01 when the Tone.js four joined the catalog: "shape" narrowed to tone/timbre only (EQ, Distortion, Bitcrusher), "movement" is the standard modulation grouping (Chorus, Tremolo, Phaser), "pitch" is the pitch domain (Autotune, Pitch Shift) — splitting what had been one crowded "character" bucket into three legible ones.

### Cards / Containers
- **Experimental badge (autotune only):** one class, two placements (section rail + palette chip, "EXP" at chip density) — display-amber silkscreen on transparent (a machine marking, not a bright object), 1px amber border, 3px radius, 0.6875rem/700 mono at the 11px floor. A status tag, not a control: no focus, no pointer. Single-sourced from the type registration.
- **Empty socket (taught empty state):** recessed register ground, dashed print boundary, centered print text; state-aware copy (pre-Start vs drag teaching).
- **Agent toasts (rq5 residual, off-chassis):** floating cards with bezel borders, lifted shadow, ≤340px, bottom-right stack; refusal bezel is 2px edge red; Undo is the one ink-on-orange action.

### Navigation
- **System deck + dot-matrix etch:** the signature surface — one persistent row reading as an instrument's status display. The etch borrows the register's inset geometry but stays SUBORDINATE to the chain face's register: neutral bright print (never amber/orange), values one tier down at 12px. The machine reports from one mouth, and it is the canvas register's.

### Meters
- **MIC IN / OUT units + the VU corner:** 96×26px canvas lamp bars (unlit glass, green→amber→clip stops, peak tick, clip latch dot) with mono dB readouts at the 12px tier. The pinned OUT footer is a second VIEW of one feed — output ground truth never depends on scroll or collapse, and never dims (including while bypassed). Ballistics are per-frame canvas draws: functional motion, live under reduced-motion by construction.

### Inputs / Fields
- **Selects (device, presets):** shared key vocabulary, native dark rendering via root `color-scheme: dark`; optgroup labels read as silkscreen micro-legends.
- **Inline preset naming (Save As):** no browser dialogs — the naming row opens under the select in the key vocabulary; Enter commits, Escape cancels, blur never commits.
- **Preset transfer:** place Import with the Presets panel's existing actions and expose Download only for the selected personal preset. Import preview and duplicate-name handling stay inline in the panel. A collision presents Rename, Replace, and Cancel as explicit keys. The file picker is the only native dialog. Transfer feedback must name the preset and result without moving or loading the live chain.
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
- **Don't** add glow, blur, load choreography, hover shadows, or border-radius card islands — sections are print zones of the one faceplate.
- **Don't** let the cords gate audio mid-drag — sound changes only on a completed link; drop-nowhere reverts.
- **Don't** let the machine speak twice — the system etch stays subordinate (neutral print, 12px); the chain face's register is the one amber machine voice.
