# Redesign — Node-Card Control Layer (and the world it drags in)

Coordinator: ultron-redesign · Opened 2026-08-30 ·
Mode: Operate · Build path: **code-led** (no image generation in this
harness — stated, not asked).

## Intake (recorded in state.md § Redesign Pass)

Driver: the node cards read as wide, monotonous fader stacks; the user
wants an Ableton-effect-chain feel — mixed input types, knobs, condensed
and fluid. Direction handling: **full direction round** (the whole visual
world is replaced; cards are the priority surface). Fluidity means all
three of control response, motion polish, layout rhythm. Product facts
that survive: param model + ranges, preset round-trip, MCP tool contract
(0..1 agent scale), collapse-only cards (per-node bypass stays DECLINED),
terminal-limiter policy, keyboard/SR operability, 11px text floor,
offline/no-build/single-page.

## Baseline (2026-08-30, pre-redesign)

### Audit (coordinator-run, read-only; detector over index.html + styles/main.css)

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 4 | rq5-verified pairings surface-wide; real buttons/inputs, aria throughout; standing: native-title help, ~200-char Key description announces in full (P3). |
| 2 | Performance | 3 | Lean no-build vanilla surface; canvas meters per-frame by design; 18 raw rem sizes flagged are ladder values, not wins — minor. |
| 3 | Theming | 3 | Full rq5 color-token system; font-size/shadow values live as raw rems/rgba in rules (11+4 detector spots) — tokenization gap, not drift. |
| 4 | Responsive | 3 | 900px strip wrap works; standing residuals: sub-~680px card squeeze; 24px hit floors (desktop-first, Chrome-only — accepted). |
| 5 | Implementation Integrity | 4 | Detector: 4 slop findings, all standing adjudicated keeps (Roboto-in-stack, dense type ladder, sortable-chosen stripe, fader detent stripes); design-system flags = documented ladder values. |
| | **Total** | **17/20** | **Good — address weak dimensions** |

P0: none · P1: none · P2: none · P3: (a) size/shadow tokenization gap;
(b) agent-side 0..1 vs 0–100 % display seam; (c) get_capabilities 2.5k
chars; (d) autotune Key help-line length.

### Critique (closing run, same day — cited as baseline)

36/40 Excellent-boundary (.impeccable/critique/2026-08-30T05-59-04Z__index-html.md);
no P0–P2; the three P3s above are its residue. Trend 27→33→35→32→36.
This snapshot measures the incumbent immediately before replacement and
is the before/after reference for the finish phase.

## Direction round

Status: **LOCKED 2026-08-30 — "Pattern Machine" (the assigned roll).**
Seed key 2a363f1b (mode operate, scope direction; telemetry rerun recorded).
Build path: code-led (no image generation in harness; user left the
default untouched).

**Direction contract (carries into the artifact's opening comment):**

- THESIS: The vocal chain is a hardware groovebox's encoder field — knob
  clusters per module, pad selectors for discrete choices, one display
  line answering the control under the operator's hand. It refuses the
  web-audio default: wide cards stacked with full-width fader rows.
- OWN-WORLD: matte near-black instrument chassis with silkscreen panel
  print; ONE committed accent (encoder-ring signal orange) as the only
  bright thing on the chassis; a dot-matrix display register for machine
  values; family coding as panel-print marking. Raised lines (donor
  disciplines the roll kept): weighted-slab modules with cut faces, never
  floating panels (cloud quarry); literal label honesty + one
  unambiguous disabled texture (quote grammar); palette economy — accent
  is the only brightness, one blink marks the live control (four
  greens); the touched module lifts a hair while neighbors recede
  (poster wall).
- STORY: the operator reads the chain as an instrument face they play
  live; touching a control answers on the display line and in the PA
  immediately; the non-engineer hears what each knob does via the
  plain-language layer, which survives verbatim.
- FIRST VIEWPORT: mic-in jack silkscreen → condensed module sections
  (one per effect; mixed control types — rotary knobs, pad selectors,
  mini-sliders where a wide range demands precision) → out; the touched
  control's exact value rides one LCD-style line; the OUT meter is the
  output VU corner.
- FORM: Pattern Machine, ranked 7 of 7 grounded candidates, seed
  2a363f1b. Alternates shown: The Pedalboard (model pick), One-Bit
  Desktop + Teletext Broadcast (competitive), 4 declined.

**Standing constraints carried from intake:** param model + ranges,
preset round-trip, MCP 0..1 contract, collapse-only cards (per-node
bypass DECLINED), terminal-limiter policy, keyboard/SR operability, 11px
floor (may be re-examined only upward), 150–250ms guarded motion,
offline/no-build/single-page, no glow (the anti-reference survives into
the new world: brightness comes from saturation on matte, never
glow/blur).

## Schedule

| # | Type | Target | Finding answered | Status |
|---|------|--------|------------------|--------|
| 1 | surface round | Chain-canvas surface in the new world: MIC IN/OUT anchors, rail rhythm, node-card chrome + control region structure (knob clusters, display line) | the redesign brief itself | built (record below) |
| 2 | element round | The control anatomy itself, live variants: rotary knob vs pad vs mini-slider rendering, value-display behavior, drag feel (the fluidity ask) | intake: control response | queued |
| 3 | element round | Card header + family coding in the new world (legend, module label, collapse/remove affordances) | intake: layout rhythm | queued |
| 4 | extract item | Consolidate the new world's repeated patterns into tokens/components (incl. the baseline size/shadow tokenization gap) | audit P3 (a) | queued |
| 5 | command item | `$impeccable polish` — agent-facing 0..1 vs 0–100 % display seam | critique P3 (b) | queued |
| 6 | command item | `$impeccable distill` — get_capabilities 2.5k chars → ~1.5k | critique P3 (c) | queued |
| 7 | command item | `$impeccable clarify` — autotune Key help-line disclosure move to badge | critique P3 (d) | queued |
| 8 | polish | Final `$impeccable polish` if fixes recommended | conditional | queued |

Order: world/surface first, elements next, command items, polish last.
Items 5–7 are agent/documentation-side (not look) and may be skipped by
user direction without affecting the redesign loop.

### Item 1 record

Surface round served 2026-08-30. Seed key `2e642e38` (scope surface,
mode operate); dealt indices 4, 7, 3 of the worker's 7-candidate ranked
list (index 4 leads). Structures derived and ranked: 1 Encoder Strip
Rail · 2 Channel Strip Row · 3 Rack and Drawer · 4 Single Face Chassis ·
5 Pad Field Wrap · 6 Register and Rail · 7 1U Rack Rows. Dealt hand:
Single Face Chassis (lead, THE ROLL) vs 1U Rack Rows vs Rack and Drawer,
as wireframe cards (code-led round; no comps, no pick card, no canon
card). Payload: `.impeccable/decision-surface-payload.json`. The
direction-round table key `ca249564` was dead; round re-presented with
`--start`, new table key `1006379e` (http://127.0.0.1:52484/). Collect
window expired at the 40-minute cap with no answer and no page close —
**no structure locked**; status stays in-progress. The table server was
still answering at give-up, so the round can resume with
`serve-question.mjs --wait --key 1006379e` or be re-served fresh. No
rerolls, no steer text, no product code touched.

## Finishing

**COMPLETE 2026-08-30 (ultron-overlord finishing worker, auto mode / trimmed
— refinement queue EMPTY BY TRIM, no closing polish round).**

- Document refresh: DESIGN.md rewritten from the built world (Pattern
  Machine / Single Face Chassis / Two-Deck Stack / free board; North Star
  "The Pattern Machine") + .impeccable/design.json sidecar regenerated
  (schemaVersion 2; JSON round-trips; var(--pm-*) refs resolve in
  main.css). Detector-driven truth fix absorbed 0.9rem/1.05rem/#FFFFFF
  into the frontmatter ramp (findings 21 → 15).
- Closing critique: snapshot
  `.impeccable/critique/2026-08-31T01-18-41Z__index-html.md` (disclosed
  trimmed single-context run). Detector 15 findings vs the takeover's 25;
  remaining quality advisories confined to the documented off-chassis rq5
  residual (toasts / watchdog Restore / ?dev harness).
- **Before/after: 36/40 → 36/40** — level in a harder world: the
  baseline's tokenization P3 (a) is paid; (b)/(c) agent-side, untouched;
  new P2 = cord-edit affordance is recall-only; standing behavioral
  residue (no manual undo, no numeric entry, hover-only help discovery)
  unchanged by the visual pass. `node tests/run.js` exit 0.
  Remaining: user acceptance.

**LOCKED 2026-08-30 (collected by the coordinator after the worker's
window expired): `single-face-chassis`** (the dealt lead), steer empty.
Thesis: one continuous instrument faceplate — effects as panel-print
sections split by machined grooves; display register etched along the
top edge; family print block + encoder field per section; collapse =
fold to a groove line; out jack + VU corner bottom-right. Full card
(payload incl. wireframe): `.impeccable/decision-surface-payload.json`.
Build dispatched under the same item. Finish-reviewer timing decision:
the reviewer runs after item 3 (element rounds settle control anatomy +
section chrome), not after item 1 alone.

### Item 1 BUILD OUTCOME (2026-08-30, ultron-redesign build worker)

**What shipped** — the canvas panel restructured into the Single Face
Chassis: display register (dot-matrix, accent-marked, fixed geometry)
etched on the top edge; MIC IN / OUT as drawn jack prints (not cards);
each effect a panel-print SECTION (family print rail: machined grip zone
+ family code + label + badge + fold/eject foot, left; encoder field:
knob/pad/trim cluster, right) separated by machined grooves; fold =
groove-line slim row (session-only, 0fr + visibility, aria-expanded);
OUT footer restyled as the VU corner (bottom-right) with the flow switch
pinned bottom-left; ONE disabled texture (diagonal hatch + recede) for
both the pre-Start gate and the bypassed chain; focus lift via
:focus-within brightness (no shadow). Control layer: rotary knobs (native
range input kept as the clipped focusable engine; vertical drag 150px
sweep, Shift ×0.2, wheel 1 step/notch, arrows/Home/End/PageUp/Down
native; bipolar detents), pad selectors (radiogroup + roving tabindex,
string commits verbatim), trim sliders for delay Time / autotune Retune /
gate Release. Direction contract comment placed as `<body>`'s first
child (147 words, five blocks + FINISH).

**Files touched** — `src/param-controls.js` (control layer rewritten;
render/updateControl contracts, help map, formatValue, pipeline
verbatim), `src/canvas.js` (display register + CanvasRegister feed +
section anatomy; drag/palette/loadModel/fast-path logic untouched),
`src/meters.js` (VU draw colors + glow→0; NO DSP, ballistics, or DOM
contract change), `styles/main.css` (new `--pm-*` token register at
:root + the canvas-panel/control/section CSS replaced; flanks/topbar
untouched), `index.html` (contract comment; canvas-panel block comment),
tests: `test-discrete-param-controls.js` (pads rewrite, behavior kept),
`test-palette-cards-cycle3.js` / `test-param-only-mutation.js` /
`test-regression-cycle3.js` (anatomy pins mechanically re-pointed at the
rail/field structure; no behavioral assertion weakened), NEW
`test-control-layer-pattern-machine.js` (52 checks: knob wiring both
directions, pad commits, register contract incl. CSS geometry, fold,
drag-handle scoping).

**Tests** — before: 23 files, 1927 checks, all green. After: 24 files,
1985 checks, all green (`node tests/run.js`).

**Detector** (`detect.mjs --json index.html styles/main.css`): 28
findings → 3 fixed mechanically (no-op `border-radius: 1px` on 2–3px
marks removed) → 25 remaining, adjudicated:
- 11 design-system-color — the rendered `--pm-*` values (locked card
  palette) sit outside DESIGN.md because DESIGN.md still documents the
  rq5 world; the tokens ARE systematized (one :root register, zero raw
  hex in canvas-panel component rules) and DESIGN.md refresh belongs to
  the finish phase. Remaining `#FFFFFF`/`rgba(0,0,0,…)` are pre-existing
  rules plus the one allowed real shadow (the SortableJS physical lift).
- 11 design-system-font-size — the documented type-ladder gap (baseline
  P3a); consolidation is schedule item 4. One NEW intentional step:
  1.25rem family code (large silkscreen print).
- 1 overused-font (Roboto in the system-ui stack) — standing baseline
  adjudicated keep.
- 1 flat-type-hierarchy — the baseline ladder finding, same class.
- 1 repeating-stripes-gradient — the committed disabled texture (hatch)
  and the trimmer tick scale: functional state/measurement markings the
  locked direction explicitly commits, not surface decoration.

**Contrast table** (shipped pairs, WCAG 2.1; grounds: chassis
#131316, register #0B0C10, key #1D1E26, unlit glass #262933):

| Pair | Use | Ratio | Gate |
|---|---|---|---|
| #9EA4B8 on #131316 | silkscreen labels, anchors, BYPASSED | 7.47 | text ≥4.5 PASS |
| #9EA4B8 on #0B0C10 | register help line | 7.87 | text ≥4.5 PASS |
| #9EA4B8 on #1D1E26 | pad legends | 6.68 | text ≥4.5 PASS |
| #C9CEDC on #131316 | mono values, trim cap, VU tick | 11.78 | text/non-text PASS |
| #FF6B35 on #131316 | register module text; knob arcs, focus rings, pressed pads (non-text) | 6.54 | ≥4.5 / ≥3 PASS |
| #FF6B35 on #0B0C10 | register accent mark | 6.89 | ≥3 PASS |
| #FFD75E on #0B0C10 | register value line | 14.09 | text PASS |
| #FFD75E on #131316 | EXP badge | 13.36 | text PASS |
| #131316 on #FF6B35 | pressed-pad ink | 6.54 | text PASS |
| family inks ×10 on #131316 | rail codes (1.25rem/700) + ticks | 8.66–10.76 | large print ≥3 PASS (also ≥4.5) |
| #4EA96B / #FFD75E / #E4574A on #262933 | VU low/mid/clip lamps | 4.98 / 10.46 / 3.98 | non-text ≥3 PASS |
| #767C90 on #131316 | flow chevron + trim detent mark | 4.46 | decorative mark ≥3 PASS (no functional text at this tint) |
| #454A5A ring track on #131316 | unlit knob scale | 2.10 | DECORATIVE by design (house hairline precedent); value carried by the 6.54 accent arc |
| #343746 key-edge / #1D1E26 key ground on #131316 | pad/trim/button rest bezels | 1.57 / 1.12 | DECORATIVE rest seams (incumbent hairline-bezel precedent); identity carried by legend text 6.68+, state by accent fill 6.54 |
| #262933 on #131316 | unlit VU glass | 1.28 | DECORATIVE dark scale (pre-existing meter vocabulary) |

**Real-Chrome probes (headless CDP, beyond the suite)** — knob pointer
drag 60px up on Gain: committed 19 dB (150px-sweep + step quantize
verified live), register answered `Gain · Gain · 19 dB`, model +
persistence updated, data-live flag cycled; fold toggle: computed
`grid-template-rows: 0fr`, rail `row`, section height 35.4px,
aria-expanded false; pre-Start drag correctly blocked by the gate (the
pointer lock held).

**Evidence rasters** — `.impeccable/review/`: `desktop.png` (1440×900,
boot state — register/anchors/footer/base plate), `mobile.png` (390×844),
`populated.png` (default preset, 6 sections, engine not started),
`populated-allshapes.png` (default + autotune pads + gate trim, reverb
folded, Threshold focused — register answering with help line).

**Residuals / deliberate non-goals**
1. Topbar, palette, presets flanks keep the rq5 vocabulary — item 2's
   scope; the page is transitional by design.
2. Drag-feel polish (inertia, arc-follow cursor), horizontal-mode fine
   tuning, and control-anatomy live variants are item 2; section-header
   + family-coding refinements are item 3.
3. Meter scale numerals stay canvas-drawn 9px (pre-existing; the 96×26
   scene has no room for 11px — recorded, unchanged).
4. Rest-bezel and unlit-scale pairs are sub-3 by adjudication (above);
   revisit only if the finish review disagrees.
5. DESIGN.md / design.json sidecar still document the rq5 world — the
   finish phase owns the refresh; until then the detector's
   design-system-color findings stand as the honest seam.

### Item 1 gate verdict (2026-08-30, user): ADJUST + scope expansion
1. Displays still inconsistently sized — unify the value-display grammar.
2. User-directed: the rest of the site (topbar, palette flank, presets
   flank) must take the new world stylistically → new schedule item 1b
   (surface round, structure dealt) added.
3. User-directed: knob color = effect family color from the palette
   (left-hand menu) — family color carries the knob arc; the single
   accent stays for system states (register marks, focus, live blink,
   Start). Palette-economy rule amended accordingly.
Adjustment round dispatched under item 1 before item 1b.

### Item 1 adjustment record (2026-08-30, ultron-redesign adjustment worker)

**Directives executed** (the two above; scope expansion item 1b was NOT
touched — flanks keep the rq5 vocabulary until their own round).

**Directive 1 — display sizing unified.** A computed-style audit in real
Chrome (fresh profile, default preset loaded) found the mono readouts
split across 13.6px (register main), 14.4px (flow toggle — a cascade
bug: bare `.flow-toggle` lost to `button.control`'s 0.9rem), 11.2px
(everything else), with the register's help line in SANS while the
instrument's value line was mono, the meter dB readouts inheriting
weight 700 through their 700-weight ancestors, and no min-widths on the
value slots. The resulting VALUE-DISPLAY LADDER (documented as a comment
block at its definition site, styles/main.css's shared label/value
registers):

| Element | Size / weight / min-width |
|---|---|
| Display register main line (`.register-main`, module·param·value) | 0.85rem (13.6px) / 400 + 700 segments / fixed-height clip — the panel instrument's etched tier, one tier up by direction |
| Register help line (`.register-help`) | 0.75rem (12px) / 400 / mono (was sans), tabular — the instrument's subordinate line at the shared value tier |
| Knob + trim values (`.param-value`) | 0.75rem / 400 / mono / tabular / min-width 6ch (43.3px — digits changing never pump layout) |
| Pad legends (`.pad`) | 0.75rem / 400 / mono / tabular / 44px hit floor (pressed pad = 700) — the 12-key field still folds 6 per row |
| Meter dB readouts (`.meter-readout`) | 0.75rem / weight pinned 400 (was inherited 700) / mono / tabular |
| Flow-state print (`.canvas-panel .flow-toggle`) | 0.75rem / 400 / tabular — the scope bump fixes the 14.4px cascade bug |
| Identity print (NOT values, unchanged) | `.section-code` 1.25rem family code; sans labels `.param-label` 0.7rem / `.node-label` 0.75rem; EXP badge 0.6875rem floor |
| Canvas meter scale numerals | 9px canvas-drawn (standing item-1 residual 3 — the 96×26 scene; recorded, unchanged) |

Verified computed in Chrome: every value/state readout now renders at
exactly 12px mono tabular (register main 13.6px); nothing in between.

**Directive 2 — family-colored arcs.** Mechanism (one source): the ten
existing `.node-card[data-family=…]` rules each gained
`--knob-arc: var(--family-<fam>)` — the SAME rq5 saturated tokens the
palette flank's chips map (never raw hex, no per-control class) — and
`.knob-ring`'s conic gradient consumes `var(--knob-arc,
var(--pm-print-hi))` instead of `--pm-accent`. The color arrives by
cascade from the section's data-family, so both write paths re-render it
for free (they only write `--knob-pos`): verified live — a synthetic
pointer drag on Gain moved `--knob-pos` 0.5→0.875 (committed 18 dB)
with the arc resolving rgb(217,195,122), and the agent fast path
(`ChainCanvas.updateNodeParam('n3','midGain',4.5)`) moved EQ's arc
0.5→0.6875 resolving rgb(130,169,222). Pointer lines, tracks, labels
and values stay neutral; the accent keeps its system-state duties
(knob focus ring still `--pm-accent`, asserted in the suite). Bipolar
detent ticks and trim caps stay NEUTRAL print — recorded choice: family
color lives on the arc alone (the one colored instrument per section);
family-colored detents/caps would multiply the colored pixels toward
decoration. The direction-contract comment in index.html carries the
palette-economy amendment.

**Arc contrast** (WCAG 2.1, non-text ≥3:1 — the arc encodes position;
ground = the knob band's actual chassis #131316; all ten measured, NONE
needed a derivation adjustment — every family token passes as-is, the
weakest also clearing 4.5:1):

| Family | Token | On #131316 | | Family | Token | On #131316 |
|---|---|---|---|---|---|---|
| delay | #B18FDE | 6.93 | | gain | #D9C37A | 10.63 |
| chorus | #9E9ED1 | 7.30 | | distortion | #C0CE97 | 11.05 |
| limiter | #DE8FB0 | 7.65 | | gate | #9AD5B2 | 11.07 |
| eq | #82A9DE | 7.66 | | compressor | #8CC079 | 8.77 |
| reverb | #6FC2C8 | 9.03 | | autotune | #D19ED1 | 8.41 |

(the previous single accent #FF6B35 scored 6.54 — the arcs now sit at
or above the accent's own contrast). The `brightness(0.9)` neighbor
recede while another section is touched is a state, same adjudication
class as the print recede.

**Files touched** — `styles/main.css` (ladder + comment block at the
shared value registers; `--knob-arc` on the ten data-family rules;
`.knob-ring` gradient; register-help face; meter-readout size/weight;
flow-toggle scope fix; comments at the token register, detent, trim
cap), `index.html` (ONE clause: the contract comment's accent economy),
`tests/test-control-layer-pattern-machine.js` (new section F, 13 checks:
ladder tiers incl. the closed two-tier assertion, per-family
derivation, token-resolution, no-raw-hex, cascade-not-class structure,
neutral detent/trim choice, focus-ring-stays-orange). No JS behavior
change was required — the arc color is pure cascade.

**Tests** — before: 24 files / 1985 checks green. After: 24 files /
1998 checks green (`node tests/run.js`; +13, zero behavioral
assertions weakened, no other test needed re-pinning — the badge and
group-label size pins are on untouched elements).

**Detector** (`detect.mjs --json index.html styles/main.css`): 25
findings before this round → 25 after, identical class distribution
(11 design-system-color, 11 design-system-font-size, 1 overused-font,
1 flat-type-hierarchy, 1 repeating-stripes) — zero net new; none land on
lines this round touched (0.75rem/0.7rem are ramp-compatible values;
the 14.4px outlier the flow-toggle bug contributed to the rendered
hierarchy is gone). Standing adjudications from item 1 carry unchanged.

**Evidence rasters refreshed** (`.impeccable/review/`, headless Chrome,
re-served over localhost): `populated.png` (default preset, engine not
started — 1440×813, same geometry as item 1's) and
`populated-allshapes.png` (default + autotune pads + gate trim inserted
before the terminal limiter, reverb folded, compressor Threshold
focused — register answering `Compressor · Threshold · -16 dB` + its
help line; captured in a 1440×1400 window so all eight sections clear
the panel's bounded scroller in one frame, raster 1440×1313). Both
validated non-blank (125KB/194KB, correct dimensions). Arc colors verified at the PIXEL
level in the shipped raster (sampled ring-band pixels per section:
compressor green-dominant, eq blue-dominant, delay purple, gain gold,
autotune orchid, gate spring-green, limiter pink — each matching its
token composited under the pre-Start gate's 0.55 opacity, not orange).

**Residuals**
1. Meter scale numerals stay canvas-drawn 9px (item-1 residual 3,
   unchanged — no room in the 96×26 scene).
2. The MIC IN / OUT jack legends still differ (sans 0.75rem anchor vs
   mono 0.7rem footer twin) — identity print, not value display; left
   for item 1b/2 where the flanks and their twins are restyled.
3. A vision-model read of the allshapes raster reported "all arcs
   orange"; measured pixels and resolved computed styles contradict it
   (per-section hue dominants above) — recorded in case a reviewer
   re-runs an image-only pass on the muted pre-Start compositing.
4. `input.focus()` in an unfocused headless window moves DOM focus
   without firing focus events (an environment artifact — the committed
   suite's synthetic focus path passes; live probes dispatch the
   FocusEvent to exercise the same listener).

### Item 1b gate — change-control event (2026-08-30, user directive)
User direction mid-run: rework chain EDITING into a free-canvas patch
model — (a) the FLOW toggle becomes per-card content-flow direction from
each card's header (not whole-canvas orientation); (b) chain linking via
draggable patch CORDS: MIC IN has one output jack point, every plugin an
IN and an OUT point, master OUT one receiving point — click a point,
drag, see the cord, link into the next plugin; (c) plugins free-position
on the canvas with a tiny snap grid (alignment assist, not forced
uniformity) so the operator can read chain order from the cords.
Per ultron-redesign change control this ALTERS PRODUCT BEHAVIOR
(interaction model; layout persistence; reorder commit path), not look
only → the functional build routes to $ultron as a new cycle
(town-hall → plan → production) with the Pattern Machine world applied;
the redesign run stays open for its visual layer + remaining schedule.

### Item 1b record (2026-08-30, surface-round worker — served, NOT yet locked)

User-directed surface round over the rest of the page: the topbar/status
strip, the palette flank (left), the presets flank (right), and the
chassis frame binding them to the built Single Face Chassis canvas (the
gate verdict's directive 2). Scope excludes the canvas column's internals
and all behavior/wiring — proposals only.

Seed key `9740cb24` (scope surface, mode operate); dealt indices 5, 2, 4
of the worker's 7-candidate ranked list (index 5 leads). Structures
derived and ranked: 1 One Sheet (full-bleed continuous faceplate, the
register band etched across the whole top edge, flanks as printed fields)
· 2 Meter Bridge (raised full-width display bridge over recessed wing
bays) · 3 Endblock Chassis (extruded top plate + endcheek flanks around
the locked face) · 4 Milled Pockets (one face, flanks sunk as milled
pockets, strip printed flat in the top margin) · 5 Two-Deck Stack (a slim
system deck machined-jointed onto a voice deck of palette | face |
presets printed zones) · 6 Full-Height Rails (milled side rails running
the machine's full height, strip between them) · 7 Rack Ears
(mounting-plate flanks with mount-hole print — old-world echo risk).
Dealt hand: **Two-Deck Stack (lead, THE ROLL)** vs **Meter Bridge** vs
**Milled Pockets**, as wireframe cards (code-led; no comps, no pick/canon
cards). All three verified to carry the product facts: BYPASS loudest and
never leaving the visible top below 900px, Start the one primary that
recedes, flat-DOM chip buttons with presentational grouping + fallback,
armed two-step red-bezel delete, agent chip as reporter, native
select/optgroup semantics, 11px floor, the shared hatch+recede disabled
grammar, family colors as identity marks only, the orange accent economy
with BYPASS's dedicated safety reds, mono tabular registers, 150–250ms
guarded transitions, no new deps.

Served: the item-1 table key `1006379e` was dead (`--update` refused —
server gone), round re-presented with `--start`, **new table key
`f45a2ef6`** (http://127.0.0.1:55240/), opened in the user's browser.
Payload: `.impeccable/decision-surface-1b-payload.json`. Collect window
expired at the ~40-minute cap with no answer, no reroll, no steer; the
server was still answering and the page heartbeat alive at give-up, so
**no structure locked** — the round resumes with
`serve-question.mjs --wait --key f45a2ef6` (or a fresh `--start` with the
same payload). No product code touched (proposals only; the payload JSON
and this record are the only files this worker wrote).

**Item 1b LOCKED 2026-08-30: `two-deck-stack`** (the dealt lead), steer
empty. Slim system deck (displays + Start + BYPASS end key) bolted by a
machined seam to a voice deck of palette | chain face | presets printed
zones. Build dispatched under item 1b.

### Item 1b build record (2026-08-30, ultron-redesign build worker)

**Outcome** — the rest of the page joined the Pattern Machine as the
locked TWO-DECK STACK: the viewport is one full-bleed instrument
(`.instrument`, one chassis frame, not three panels); the old VIS-2
status strip is re-cast as the SYSTEM DECK (`header.topbar.system-deck`
— `.topbar` kept verbatim, so agent-ui's chip mount and main.js's
getElementById wiring are untouched); a MACHINED SEAM element
(`.deck-seam`, aria-hidden) joins the two slabs; `#chain-layout` gains
`.voice-deck` beside `.layout` and its three columns become PRINTED
ZONES of one faceplate (transparent zones over the shared
`--pm-chassis`, split by groove pairs — cut then lip — in the same
grammar the canvas sections use). Structure-only markup additions:
`.instrument`, `.deck-seam`, `.system-etch` (wraps the lamp + status +
RATE/LAT/NODES so exactly that group wraps below 900px). No element was
removed, renamed, or reordered; every wiring id, the bypass button's
LAST-child position (the #agent-chip insertion point), persistence
keys, SortableJS wiring, and the engine-not-started gate class are
byte-identical. Zero JS changes were needed (src/main.js,
src/presets-ui.js, src/agent-ui.js untouched).

**Vocabulary, deck by deck**

- SYSTEM DECK: its own slab cast (`--pm-system-deck` #17181d, a hair
  lighter than the chassis — two castings, one instrument); engraved
  nameplate (silkscreen 0.75rem/700 in `--pm-print-hi`); the DOT-MATRIX
  ETCH (`.system-etch`: inset `--pm-register-bg` slot + machined lip)
  carrying lamp + status + readouts with the values at the 12px mono
  tabular tier in NEUTRAL bright print — rhyming with the chain
  register's geometry while staying one tier below its 13.6px amber
  line (the "two mouths" risk solved by register tier + color
  neutrality); Start as the ONE ORANGE KEY (signal-orange fill, chassis
  ink, hover/press via new `--pm-accent-hi`/`--pm-accent-lo` tokens);
  native device select + all shared `.control` keys restyled as panel
  keys (`--pm-key` ground, cut-edge bezel, squared 4px radius); agent
  chip as a small reporter key (states unchanged, the 1.2s breath
  animation untouched); BYPASS as the deck's red-ringed END key — 3rem
  target, 1.05rem/700 (still the heaviest type on the deck), 2px
  `--red-edge` ring at rest, `--red-fill` + #FFFFFF engaged (split-role
  safety red carried over verbatim).
- THE SEAM: a 1px bright lip (`--pm-seam-lip`, 0.30 alpha) over a 4px
  deep cut (`--pm-seam-cut` #010208) — deeper (4px vs 1px), darker, and
  brighter-lipped (0.30 vs 0.14) than every section groove, so the
  joint reads as the deepest cut on the page. VERIFIED AT PIXEL LEVEL
  in the shipped desktop raster (column x=700: deck lum 24 → lip 63 →
  cut 2 → chassis 12).
- VOICE DECK: one `--pm-chassis` faceplate; palette/face/presets zones
  as print (zone h2 legends over groove-cut rules; group labels in
  `--pm-print`); chips as panel keys whose family legend square keeps
  the saturated rq5 `--family-*` fill (the arcs' own colors) with
  chassis-ink initials; EXP badge unified to display-amber silkscreen
  on transparent for BOTH placements (one rule; the item-1
  `.canvas-panel` override retired); presets zone with the bank name in
  the shared 12px mono tier, unsaved flag in the accent, armed Delete
  keeping its red-edge bezel, `.preset-note` in print.
- CHASSIS + BENCH: body is the bench (`--pm-bench` #0a0b0f); the frame
  is full-bleed (`margin: -1rem`), face-edge shell, never clips (the
  sticky deck must keep its pin); `::selection` and the global
  `:focus-visible` ring re-tokened to the orange system-state accent.
- DISABLED GRAMMAR: the two flanking zones join the canvas face's hatch
  + recede (the IDENTICAL `repeating-linear-gradient`), retiring the
  legacy rq5 dim — one grammar, three zones, asserted by the new test.

**Narrow-viewport law (<900px)** — implemented and probed: row 1 keeps
the nameplate + agent chip + BYPASS (order 1/2/3); the Start/hint/
device block becomes a full-width internally-wrapping row (order 4 —
this FIXES a packing defect the first render exposed: as an unbreakable
`flex:none` group the select overflowed the deck past the frame; the
geometry probe caught right-edge 416 > 374); the etch wraps LAST
(order 9). Measured in a real 390px render: BYPASS row 1 at the right
end (ring rows 9–56, x 316–389), Start row 2, select row 3, etch row 4,
nothing beyond the frame edge. The voice deck stacks to one column with
the zone grooves turned horizontal — which also relieves the standing
sub-680px three-column squeeze residual. Desktop measured: one-row deck
(title 21–200, etch 327–688, Start 702–769, select 921–1140, chip
1154–1238, BYPASS 1253–1419), seam 65–69, zones 1–201 / 201–1219 /
1219–1439 — the locked wireframe, realized.

**Files touched** — `index.html` (instrument/system-deck/voice-deck
wrappers + `.system-etch` + `.deck-seam`; direction-contract FIRST-
VIEWPORT clause extended to the two-deck instrument; two block
comments), `styles/main.css` (token register extended —
`--pm-system-deck/-seam-cut/-seam-lip/-bench/-accent-hi/-accent-lo`;
body/selection/focus; the topbar→system-deck section rewritten; the
instrument + seam blocks; the layout→voice-deck + zone/groove/chip/
badge/presets/agent-chip restyles; the shared-control key restyle; the
flank hatch gate; both <900px blocks), `tests/test-palette-cards-
cycle3.js` (2 mechanical re-pins: group-label color → `--pm-print`,
badge color/background → `--pm-display`/transparent — no behavioral
assertion weakened), NEW `tests/test-two-deck-stack.js` (74 checks:
markup wrappers + wiring-id survival + canvas-internals-untouched, the
etch wrapper, seam-depth token comparison, deck/key/BYPASS/focus
tokens, etch subordination, zone grooves, the identical-hatch gate,
the <900px law incl. BYPASS's row-1 order, chip family mappings).

**Tests** — before: 24 files / 1998 checks green. After: 25 files /
2072 checks green (`node tests/run.js`).

**Detector** (`detect.mjs --json index.html styles/main.css`): 25 → 30
findings — 17 design-system-color (was 11), 10 design-system-font-size
(was 11), 1 overused-font, 1 flat-type-hierarchy, 1 repeating-stripes.
Delta adjudication: the +6 color findings are the RENDERED-page scan —
the page now renders the `--pm-*` world on body/deck/etch/keys, and
DESIGN.md still documents rq5 (the finish phase owns the refresh; the
same honest seam item 1 recorded). The −1 font-size finding is rule
consolidation (the badge's two placements collapsed into one rule). No
NEW raw hex was introduced (the two `#FFFFFF` finds are the pre-existing
engaged-BYPASS/watchdog values at moved lines; `rgba(0,0,0,…)`
remains the SortableJS drag lift + knob-cap lip). The stripes finding
is the committed hatch, now correctly covering three zones. Standing
adjudications carry.

**Contrast table** (NEW pairs this round; grounds: deck #17181d, etch
#0b0c10, key #1d1e26, chassis #131316):

| Pair | Use | Ratio | Gate |
|---|---|---|---|
| #C9CEDC on #17181D | nameplate, live sentence, BYPASS rest text, control-key legends | 11.26 | text ≥4.5 PASS |
| #9EA4B8 on #17181D | status sentence, start-hint, status-detail | 7.14 | text PASS |
| #C9CEDC on #0B0C10 | etch values (12px mono tabular) | 12.42 | text PASS |
| #9EA4B8 on #0B0C10 | etch footnotes | 7.87 | text PASS |
| #767C90 on #0B0C10 | etch micro-labels (RATE/LAT/NODES) | 4.71 | text ≥4.5 PASS |
| #FF806E on #0B0C10 | error sentence (status-error token) | 7.97 | text PASS |
| #767C90 dot on #0B0C10 | stopped lamp | 4.71 | non-text ≥3 PASS |
| #FF6B35 dot on #0B0C10 / #17181D | live lamp | 6.89 / 6.25 | non-text ≥3 PASS |
| #131316 on #FF6B35 | Start text (the one orange key) | 6.54 | text PASS |
| #131316 on #FF8558 / #E85A20 | Start hover / press (and Save) | 7.72 / 5.22 | text PASS |
| #E5484D ring on #17181D | BYPASS rest ring | 4.53 | non-text ≥3 PASS |
| #FFFFFF on #C93A32 | BYPASS engaged | 5.08 | text PASS (rq5 pairing carried) |
| #9EA4B8 on #1D1E26 | chip label at rest | 6.68 | text PASS |
| #131316 on family fills ×10 | chip legend initials | 6.93–11.07 | text PASS |
| #FF6B35 on #1D1E26 | agent-chip label (ready/acting) | 5.85 | text PASS |
| #FF6B35 on #131316 | unsaved-dot text | 6.54 | text PASS |
| #FFD75E on #131316 | EXP badge (both placements, one rule) | 13.36 | text PASS |
| #9EA4B8 on #131316 | group labels, preset-note, optgroup legends | 7.47 | text PASS |
| #C9CEDC on #131316 | preset bank name (12px mono) | 11.78 | text PASS |
| #FF6B35 focus ring on deck/chassis/etch | global :focus-visible | 6.25–6.89 | non-text ≥3 PASS |
| seam cut/lip, zone grooves, key-edge bezels | machined geometry | sub-3 | DECORATIVE by design (cut faces; identity carried by the print pairs above) |

Orange economy on the new grounds: the accent appears ONLY as Start,
the live lamp, agent-active, the unsaved flag, focus rings, and the
drag-origin bezel; family color appears ONLY as the chip legend square
(the arcs' own tokens); reds appear ONLY as BYPASS's ring/fill, the
armed-Delete bezel, and the canvas watchdog — all pre-existing roles.

**Real-Chrome probes** (headless, beyond the suite) — geometry rects
via a same-origin iframe probe at 390px and 1440px (the numbers quoted
in the narrow-viewport section; also confirmed `#agent-chip` renders
immediately before `#bypass-toggle-button` on BOTH breakpoints, proving
the agent-ui insertion contract survived the wrappers); populated
integration render through the app's own API
(`ChainCanvas.loadModel(Persistence.loadInitialModel())` — 6 sections,
10 chips, factory presets listed) with the family rails/arcs and zone
grooves composing under the pre-Start gate.

**Evidence rasters** (`.impeccable/review/`, refreshed over
localhost): `desktop.png` (1440×900 boot — deck/etch/Start/chip/BYPASS/
seam/zones/chips/presets, seam verified at pixel level),
`mobile.png` (390×844 — BYPASS row 1, stacked voice deck), NEW
`populated-two-deck.png` (1440×1000, default preset loaded through the
app API, engine not started — the full two-deck composition with six
sections under the gate). All validated non-blank, correct dimensions,
correct content.

**Residuals**
1. Agent toasts, the ?dev harness overlay, and the watchdog Restore
   key's active fill still carry rq5 tokens — floating overlays outside
   the chassis, out of item 1b's scope; the finish phase or a later
   element round owns them.
2. The sticky system deck detaches from the frame's top edge while the
   page scrolls (the seam scrolls under the pinned deck). In practice
   the canvas owns scrolling (bounded max-height) so the page rarely
   scrolls; recorded as the accepted cost of keeping the deck pinned
   (BYPASS reachability).
3. On 390px the deck is four pinned rows (~205px) — the honest floor
   given BYPASS-on-row-1 plus Start/hint/select/etch all surviving;
   revisit only if the finish review wants a denser narrow deck.
4. DESIGN.md / design.json still document the rq5 world (the detector's
   design-system-color findings stand as the honest seam until the
   finish-phase refresh); the type-ladder consolidation remains
   schedule item 4.
5. The old sub-680px three-column squeeze residual is RETIRED (zones
   now stack below 900px); the 24px hit-floor residual (desktop-first)
   stands unchanged.

**Item 1b gate: APPROVED 2026-08-30** (user, live inspection). Next:
item 2 element round (control anatomy + drag feel, live variants).

## OQ-9 element round — board identity + jack geometry (2026-08-30, redesign element worker)

**Trigger:** QA-5 verdict ADJUST — "plugin cards must STAND OUT from the
mixer ground + more individual identity (everything is smashed
together)"; cord patching "decent first attempt, sloppy". User
prescription FIXED (three parts): (1) weighted-slab sections with a real
face step (distinct ground one step lighter than the chassis, cut-edge
treatment, stronger family identity, breathing room at real sizes) —
NO floating-card regression, elevation TONAL + EDGE only; (2) exact jack
geometry — vertical card: IN top-center of the border, OUT bottom-center
(directly across); horizontal card: IN middle-left, OUT middle-right;
orientation from the per-card layout flow field; panel anchors rhyme
(mic out at bottom-center, OUT in at top-center) so the column reads
mic → down through cards → out; (3) jack visual coherence — one
teachable ring+socket vocabulary sitting ON the border, quiet hover.

**What shipped**

*Slab identity (styles/main.css).* Two new tokens — `--pm-slab`
(#181a21, one step lighter than the chassis #131316) and
`--pm-slab-lip` (rgba(201,206,220,0.22), deliberately BETWEEN the groove
lip 0.14 and the seam lip 0.30 — a part, never the joint; pinned by a
new test). `.node-card` becomes the slab: slab face ground, 1px sawn
groove-cut edge all round, inset 1px machined lip under the top cut.
Zero shadow at rest (Rest-Flat holds); the drag-clone keeps the one
physical lift (now on the slab ground); the agent pulse keyframes and
chosen-state accent lip re-based on the slab lip. Family rail more
assertive: family tick 2px → 3px down the rail's left edge, and the rail
gains a groove-cut right division (the family print block reads as the
module's identity strip). Measured on the slab ground: print 7.11,
lifted print 11.10, family code inks 8.16–10.13, knob arcs (worst)
6.53 — all pass their floors.

*Breathing room (src/canvas.js).* The tidy stack was a FIXED 160px row
pitch while real expanded sections measure ~126–280px — the literal
"smashed together". `tidyRowHeight()` now stacks rows on each section's
MEASURED height snapped up to the 16px grid + one grid unit of gap
(within the console rhythm, not arbitrary); TIDY, first-free-slot
placement, and the board extent all use it. The layout-less harness
fallback stays the old 160px pitch so the FEW-2 pins hold verbatim.
Real-Chrome proof: default chain renders six 126px slabs with 18px gaps,
zero overlap; TIDY re-stack verified overlap-free.

*Jack geometry (src/canvas.js).* `sectionJackPts(id)` — the across-from
rule exactly: vertical card → IN at (seat.x + w/2, seat.y), OUT at
(seat.x + w/2, seat.y + h); horizontal → IN at (seat.x, seat.y + h/2),
OUT at (seat.x + w, seat.y + h/2). Orientation reads the card's OWN
layout `flow` field (FEW-1 schema); the canvas FLOW toggle is now its
uniform writer (applyFlow syncs every entry + re-routes + persists, so
FEW-6's per-card glyph just works later); loadModel defaults a missing
field to the canvas-wide mode, an explicit saved field wins. Panel
anchors measured from their real elements (mic row bottom-center, OUT
row top-center; horizontal: middle-right / middle-left), with the old
grid-derived constants as the layout-less fallback. Cards measured live
(offsetWidth/Height), placeholder box 160×48 in harnesses. A guarded
window-resize listener re-routes (jack x derives from card width).
Real-Chrome proof: in-jack (725.5,164) vs card top-center (726,164),
out-jack directly across; horizontal mode: in (355,192) middle-left,
out (835,192) middle-right.

*Jack visuals (both files).* Each jack is now a `<g class="cord-jack">`:
transparent 24px hit disc + drawn 15px RING + dark SOCKET dot (the same
anatomy and size as the anchor print rings — one teachable vocabulary),
positioned ON the border line so it reads half-buried in the slab's edge
like a machined socket; quiet hover lifts the ring to full print; hot
target + ghost keep the accent. The vertical-mode anchor rows retire
their own left-edge print ring and the flow arrows (the cord layer IS
the flow indication now): label prints beside the real jack
(`calc(50% + 0.8rem)`), meter pinned absolute right. Cord d-attr shape
unchanged — endpoints moved only.

*Untouched (hard constraints):* never-gate-audio semantics, the 6px
threshold, commit chokepoint, agent queueing (isDragActive), fast path,
audio code — zero diffs outside the geometry/visual seam. 11px floor,
--pm-* tokens only, no glow, reduced-motion guards intact.

**Files:** src/canvas.js, styles/main.css, DESIGN.md (surgical sync:
slab tokens + Sections/Shape/Layout/Patch-cords spec now match the built
world), tests/test-cord-layer-few3.js (geometry pins + new §D2
orientation checks), tests/test-cord-editing-few4.js (seat helpers),
tests/test-order-focus-a11y1.js (jackPt helper), tests/test-two-deck-
stack.js (section groove pin → slab vocabulary + the new lip-hierarchy
invariant). Behavior assertions unchanged — only geometry/vocabulary
pins moved.

**Tests:** `node tests/run.js` exit 0 — **30/30 files, 2313 checks,
all green** (baseline 30/2309; +4 = few3's three new orientation checks
+ two-deck's lip-hierarchy check). FEW-3 33 ok (was 30), FEW-4 48,
A11Y-1 41, FEW-2 27, two-deck 75 — all PASS.

**Real-browser verification (MANDATORY, the hotfix lesson — all done in
headless Chrome/CDP, fresh profiles, cache-busted URLs):**
`.impeccable/review/board-identity-desktop.png` (1440×900, populated via
a real Start click with fake media — six slabs, center-column cords,
jacks on the borders) and `board-identity-mobile.png` (390×844,
populated) — both validated non-blank and showing the sections with the
new jack geometry; companion `.console.log` files are EMPTY — zero
uncaught errors / console.error at BOTH breakpoints (grep-verified).
Beyond the rasters, a CDP interaction probe proved in the real browser:
pointer-liveness of the jack's visible half over the now-opaque slab
(elementFromPoint → .jack-hit), a full relink gesture end-to-end
(n1's OUT on n3's IN → hot target n3 → order [n1,n2,n3,…] → [n2,n1,n3,…],
one commit), TIDY overlap-free, and the horizontal-flow flip moving the
jacks to the card's side borders. Zero console errors in every run.

**Residuals**
1. Panel-anchor jacks sit at the mic/OUT rows' centers (709.5px) while
   the tidy column's card jacks sit +16px right (TIDY_X) — a 16px jog
   the bezier sag absorbs; honest (cards ARE shifted on the board;
   panel anchors center on the panel). Revisit only if the user reads
   it as sloppy.
2. Tidy spacing measures section heights AT TIDY TIME — a later
   fold/unfold changes a slab's height without re-flowing neighbors
   (session-only fold; the pre-round fixed pitch had the same class of
   issue, only worse). FEW-5's resize work is the natural home.
3. Jack grab reach is the ring's VISIBLE half (the slab covers the
   other); the 24px geometric drop slop is unaffected. Fine on desktop;
   revisit with FEW-6's touch pass.
4. FEW-5 (card resize), FEW-6 (per-card flow glyph), FEW-7 drag
   placement, FEW-8 — still deferred per the completion report; this
   round's flow-field work makes FEW-6's geometry land clean.
5. design.json sidecar not regenerated this round (finish-phase refresh
   owns it; DESIGN.md already matches the built world).
