# QA-4 — Accessibility Verification (Cycle 2)

Covers plan.md task QA-4 / town-hall success measure 4 / design brief §7.
Split evidence: **automatable static audit** (this file — computed contrast,
keyboard/focus/ARIA/reduced-motion source verification, 2026-08-28) and a
**user manual portion** (keyboard-only pass, reduced-motion emulation
spot-check, distance readability — script below, results to be recorded).

## Methodology (honesty box)

- **Static audit, no browser.** Tool: `/tmp/qa4-audit.js` (node, seedless,
  deterministic, no network). It parses `styles/main.css` directly (26
  hex-valued `:root` tokens extracted; every `color`/`background`
  declaration resolved through `var()` chains), cross-checks each mapped
  element's declared color against the parsed rule — the script **throws**
  on any drift between this audit and the stylesheet — and computes WCAG
  2.x relative luminance ratios exactly.
- The **DOM-structure map** is curated from `index.html` plus the five
  JS-created surfaces (`src/agent-ui.js` chip in `.topbar` + toast region
  on body; `src/meters.js` meter units inside `.anchor`s; `src/meter-taps.js`
  watchdog alert after the safe-output note; `src/mcp-harness.js` `?dev`
  overlay on body; `src/audio-graph.js` safe-output-note after the OUT
  anchor). Effective surfaces follow the known containment: body→bg-body,
  .topbar/.palette/.canvas-panel/.presets→bg-panel, cards/chips/toasts/
  anchors→bg-card.
- **Canvas-painted meter pixels** are covered by the rq5 stops analysis
  (non-text boundaries M1–M5 below); the one DOM text the meters emit
  (`.meter-readout`) IS audited as text.
- **Native `<select>` dropdown rows** are UA-rendered; `color-scheme: dark`
  on `:root` makes them dark (T6b, noted, not CSS-pairable).
- Thresholds: text 4.5:1 (normal) — no pair relies on the 3:1 large-text
  allowance except where noted; non-text meaningful boundaries (WCAG
  1.4.11) and focus indicators 3:1. rq5-accepted exceptions honored:
  disabled/inactive controls (blended value computed and reported, no
  requirement per 1.4.3 inactive-UI exception), hairline decorative seams
  (excluded from text audit, listed separately).
- Verified against rq5's published ratios: every overlapping value
  reproduces exactly (5.74 / 11.04 / 12.32 / 8.46 / 10.60 / 5.08 /
  7.71–10.03 / 3.28–4.26 / 3.44 / 3.84 …). One rq5 footnote: chip initials
  were quoted "7.06–9.82"; the computed minimum is **6.40 (delay)** —
  still a comfortable PASS, no action.

## Verdict summary

| Audit | Total | PASS | Exception | FAIL |
|---|---|---|---|---|
| Text pairs | 79 | 69 | 8 (disabled/inert/UA) | **2** (1 real, 1 latent-only) |
| Non-text boundaries | 40 | 36 | — (1 ring-backed by design) | **4** (1 root cause, 3 surfaces) |
| Reduced-motion declarations | 15 | 14 (6 guarded + 8 allowed-state-color) | — | **1** minor (1px hover transform) |
| Keyboard/focus grep | 8 checks | 8 | — | 0 (1 documented carryover gap) |
| ARIA/static semantics | 19 checks | 19 | — | 0 |

## Violations found (documented precisely — NO code changes made; for master)

### V1 — REAL: "CLIP" meter readout text fails 4.5:1 (WCAG 1.4.3)

`.meter-readout[data-clip='true'] { color: var(--meter-clip); }`
(`styles/main.css` line 1762) renders the 10px mono "CLIP" latch text in
`#F05A45` on the `.anchor` card ground `#322E29` = **4.01:1 < 4.5**.
rq5 verified the meter stops as **non-text** lamp colors (≥3:1 — the
canvas lamp/dot/pin in the same stop passes at 4.01 as boundary M3/M5);
VIS-5 then reused the stop as the readout's *text* state color, which the
rq5 table never claimed. Mitigations already present: the state is
triple-redundant (canvas red 0 dB pin + 4px clip dot, both non-text ≥3:1
PASS, and `aria-valuetext="CLIP"`), so no user loses the information —
but the text pair itself is a strict 1.4.3 miss. Options for master
(POL-1's bounded fix round): render "CLIP" in `--text-primary` on a
`--meter-clip` text-fill chip, or bump the stop's text usage to
`--status-error #FF806E` (5.7+ on card), or keep and file as documented
exception with the redundancy rationale.

### V2 — REAL: focus ring invisible on amber-filled controls (WCAG 2.4.11/1.4.11 focus indication)

Root cause: the global `:focus-visible` rule uses `outline-offset: 1px`,
which draws the ring **outside** the element — over the surrounding
ground, not the element's fill. rq5's `--focus-ring-on-accent #241A08`
ink variant was designed assuming ring-on-amber geometry (where it scores
8.46, boundary F4); with the offset it renders on the neutral grounds
where it scores:

| Surface | Rule | Ring over | Ratio |
|---|---|---|---|
| `#start-button:focus-visible` (always-on while keyboard-focused) | `styles/main.css` 367 | topbar `#292623` | **1.14** |
| `.agent-toast .agent-toast-undo:focus-visible` (always-on) | 1309 | toast card `#322E29` | **1.27** |
| `button.control:active:focus-visible` (transient, pressed+focused) | 316 | card `#322E29` | **1.27** |
| `.watchdog-restore:active:focus-visible` (transient) | 1418 | panel `#292623` | **1.14** |

Net effect: **keyboard focus on Start and on toast Undo is effectively
invisible** (the two always-on cases; the two `:active:focus-visible`
cases are mouse-held transients, lower severity). Ironically the default
amber `--focus-ring` the override replaces passes on every ground it
would actually paint on (7.71–10.03, F1–F3). Candidate fixes for master:
`outline-offset: 0` (or negative) for those selectors so the ink ring
sits against the amber fill as rq5 intended, or an inset
`box-shadow` ring, or dropping the override. Not fixed here per task
scope.

### V3 — MINOR: one unguarded motion property under prefers-reduced-motion

`.node-chip { transition: border-color, color, box-shadow, transform 150ms }`
(`styles/main.css` 623) — the `transform` (hover lift
`translateY(-1px)`) is real motion outside any `no-preference` guard.
Magnitude is 1px/150ms, hover-only, non-scrolling — below any vestibular
threshold, and WCAG 2.3.3 is AAA (the cycle targets AA) — but by this
audit's own classification it is neither `guarded` nor
`allowed-state-color`. Every other unguarded transition is color-only
state feedback ≤150ms (allowed). Candidate fix for master: move the
transform into the existing `no-preference` guard.

### L1 — LATENT ONLY: fallback chip-initials pairing 4.16

`.node-chip::before` / `.node-card::before` fall back to a
`--line-strong` square for an *unmapped* future node type; on-accent
initials on line-strong = 4.16 < 4.5. All six current types are mapped,
so **no rendered element hits this today**. Future-type gate for whoever
adds node type #7: give it a family token (or ≥4.5 initial-ink pairing)
at registration time.

### D1 — Design-note, accepted: bypass-engaged fill boundary 2.96

`.bypass-btn.engaged` red-fill `#C93A32` vs panel = **2.96:1** in
isolation (boundary N10) — but the engaged state retains the 2px
`--red-edge` ring at 3.84 (N9), which carries the meaningful boundary.
This is rq5's split-role design working as documented ("never red-fill as
edge"); the white-on-red-fill text itself passes at 5.08. No action.

## Text-pair table (79 pairs)

All colors resolved from the parsed stylesheet. "EXC" = WCAG 1.4.3
inactive-UI exception (native `disabled` controls, or the
`engine-not-started` gate: panels are `pointer-events:none` + inert);
blended value computed as token×alpha over surface and reported.

### PASS — topbar (surface bg-panel unless noted)

| # | Element | Pair | Ratio |
|---|---|---|---|
| T1 | `.app-title` h1 legend | muted/panel | 5.74 |
| T2 | `.status` "Stopped" | muted/panel | 5.74 |
| T3 | `.status.live` "LIVE" | primary/panel | 12.32 |
| T4 | `.readout-label` (10px silkscreen) | muted/panel | 5.74 |
| T5 | `.readout-value` (mono) | primary/panel | 12.32 |
| T6 | `select.control` closed | primary/card | 11.04 |
| T7 | `button.control` labels | primary/card | 11.04 |
| T9 | `.control:active` pressed | on-accent/accent | 8.46 |
| T10 | Start button | on-accent/accent | 8.46 |
| T11 | Start :hover | on-accent/accent-hover | 10.60 |
| T12 | Start :active | on-accent/accent-active | 6.01 |
| T13 | Bypass OFF | primary/panel | 12.32 |
| T14 | Bypass ON | #FFFFFF/red-fill | 5.08 |
| T16 | Agent chip (unavailable) | muted/card | 5.14 |
| T17 | Agent chip label (ready/acting) | accent/card | 6.65 |
| T18 | Agent chip sr-only text | muted/card | 5.14 |

### PASS — palette / canvas / presets

| # | Element | Pair | Ratio |
|---|---|---|---|
| P1 | `.palette h2` | muted/panel | 5.74 |
| P2 | `.node-chip` labels | muted/card | 5.14 |
| P3 | chip :hover label | primary/card | 11.04 |
| P4 | chip :active/chosen label | primary/card | 11.04 |
| P6.1–P6.6 | chip initials ×6 families | on-accent/family fill | 9.82 / 8.10 / 7.08 / **6.40** / 8.34 / 7.06 |
| C1 | `.anchor` MIC IN / OUT | muted/card | 5.14 |
| C2 | `.arrow` → (aria-hidden) | muted/panel | 5.74 |
| C3 | `.empty-hint` | muted/card | 5.14 |
| C4 | `.node-label` (inherits) | primary/card | 11.04 |
| C5 | grip ⋮⋮ (aria-hidden) | muted/card | 5.14 |
| C6 | grip :hover | primary/card | 11.04 |
| C7 | remove × rest | muted/card | 5.14 |
| C8 | remove × hover/active | primary/card | 11.04 |
| C9 | `.param-label` | muted/card | 5.14 |
| C10 | `.param-value` (mono) | primary/card | 11.04 |
| C11 | `.safe-output-note` | muted/panel | 5.74 |
| C12 | `.watchdog-alert-text` | primary/panel | 12.32 |
| C13 | Restore output button | #FFFFFF/red-fill | 5.08 |
| C14 | `.meter-readout` dB | muted/card | 5.14 |
| R1 | `.presets h2` | muted/panel | 5.74 |
| R2 | `.preset-name` (inherits) | primary/panel | 12.32 |
| R3 | `.unsaved-dot` | accent/panel | 7.43 |

### PASS — agent toasts / harness / global

| # | Element | Pair | Ratio |
|---|---|---|---|
| A1 | toast summary | primary/card | 11.04 |
| A2 | toast clamped note | muted/card | 5.14 |
| A3 | toast error note | primary/card | 11.04 |
| A4 | toast undone note | muted/card | 5.14 |
| A5 | toast dimmed `[data-undone]` 0.75 (NOT disabled — must pass) | blended/primary/card | 6.96 |
| A6 | toast Undo | on-accent/accent | 8.46 |
| A7 | toast Undo :hover | on-accent/accent-hover | 10.60 |
| A8 | toast Undo :active | on-accent/accent-active | 6.01 |
| H1 | harness base | primary/panel | 12.32 |
| H2 | harness title h2 | primary/panel | 12.32 |
| H3 | statusline + chipmirror | muted/panel | 5.74 |
| H4 | section titles h3 | muted/panel | 5.74 |
| H5 | tool name (code) | primary/card | 11.04 |
| H6 | read-only badge | muted/card | 5.14 |
| H7 | tool description | muted/card | 5.14 |
| H8 | param summary (mono) | muted/card | 5.14 |
| H9 | args textarea | primary/body | 14.36 |
| H10 | Run button | primary/card | 11.04 |
| H11 | Run :active | on-accent/accent | 8.46 |
| H12 | result pre | primary/body | 14.36 |
| H13 | log time/type | muted/body | 6.69 |
| H14 | log detail | muted/body | 6.69 |
| H15 | log mutation detail | primary/body | 14.36 |
| H16 | undo depth | muted/panel | 5.74 |
| H17 | undo hint (9.6px, dev-only) | muted/panel | 5.74 |
| X1 | `::selection` | on-accent/accent | 8.46 |

### FAIL (see V1 / L1)

| # | Element | Pair | Ratio |
|---|---|---|---|
| C15 | `.meter-readout[data-clip]` "CLIP" | meter-clip/card | **4.01** — V1, real |
| P6.7 | initials on unmapped-type fallback square | on-accent/line-strong | 4.16 — L1, never renders today |

### EXCEPTIONS (inactive UI; blended value reported, no requirement)

| # | Element | Blend | Ratio |
|---|---|---|---|
| T8/T8b/H18 | disabled `.control` labels (muted ×0.6) | #787268/card | 2.83 |
| T15 | disabled Bypass (primary ×0.6) | #9F9A93/panel | 5.39 |
| P5/R4 | gated panels pre-Start (muted ×0.55 over panel) | #6E6960/panel | 2.76 |
| P5b | gated chips pre-Start (muted ×0.55 over card) | #726C63/card | 2.59 |
| T6b | `<option>` rows | UA-rendered (color-scheme dark) | — |

The `.engine-not-started` gate blends to 2.59–2.76, not the "≈3:1" the
CSS comment estimates — legitimately exempt (panels are
`pointer-events:none` inert = inactive UI), recorded honestly.

## Non-text boundary table (40, ≥3:1)

| # | Boundary | Pair | Ratio | Verdict |
|---|---|---|---|---|
| F1–F3 | global focus ring vs body/panel/card | focus-ring/grounds | 10.03 / 8.61 / 7.71 | PASS |
| F4 | on-accent ring vs amber fill (intended geometry) | ink/accent | 8.46 | PASS |
| F5 | Start keyboard-focus ring as actually drawn (offset → panel) | ink/panel | **1.14** | **FAIL → V2** |
| F6 | toast Undo focus ring as drawn (→ card) | ink/card | **1.27** | **FAIL → V2** |
| F7 | `.control:active:focus-visible` ring (→ card) | ink/card | **1.27** | **FAIL → V2** |
| N1 | control bezel | line-strong/card | 3.28 | PASS |
| N2 | control hover bezel | accent/card | 6.65 | PASS |
| N3/N4 | anchor + empty-hint dashed | line-strong/card | 3.28 | PASS |
| N5/N6 | card-hover + remove bezels | line-strong/card | 3.28 | PASS |
| N7 | remove × danger hover bezel | red-edge/card | 3.44 | PASS |
| N8/N9 | bypass red-edge ring (OFF + ON) | red-edge/panel | 3.84 | PASS |
| N10 | bypass ON fill alone | red-fill/panel | 2.96 | ring-backed (D1) |
| N11/N12 | chip + toast bezels | line-strong/card | 3.28 | PASS |
| N13 | toast refusal bezel | red-edge/card | 3.44 | PASS |
| N14/N15 | watchdog ring + restore bezel | red-edge/panel | 3.84 | PASS |
| N16 | harness bezel | line-strong/panel | 3.66 | PASS |
| S1/S2/S3 | status dots (stopped/live/agent) | muted,accent/panel,card | 5.74 / 7.43 / 6.65 | PASS |
| M1–M3 | meter zone stops (canvas over card) | stops/card | 5.92 / 6.65 / 4.01 | PASS |
| M4/M5 | peak tick + clip dot/pin (canvas) | primary,clip/card | 11.04 / 4.01 | PASS |
| M6–M8 | fader thumb fill / bezel / center detent | accent,line-strong/card | 6.65 / 3.28 / 3.28 | PASS |
| E-* | 6 family card edges vs card | family/card | 7.72 / 6.37 / 5.57 / 5.04 / 6.56 / 5.56 | PASS |

Decorative exclusions (sub-3:1 by design, rq5 known-impossible list —
excluded from the meaningful audit): hairline seams 1.88/1.61/1.45 vs
body/panel/card; meter unlit lamp glass 1.45; fader detent ticks 1.45;
panel/body layer step 1.17; card/panel step 1.12; fader-bezel-vs-cap
inner side 2.03.

## Keyboard / focus findings (source-verified)

- **All interactive elements are native controls.** Static: Start, Bypass,
  Save As…, Load, Delete (`<button>`), device + preset (`<select>`).
  JS-created: toast Undo, node remove ×, watchdog Restore, harness
  Run/Close/Clear/Undo (`<button>` via `createElement`/`el()`), harness
  args (`<textarea aria-label>`), params (`<input type="range">` with
  `label[for]`). Zero `tabindex="-1"` anywhere (grep across index.html +
  src/). Zero clickable divs/spans (every `click` listener binds a real
  button — verified per-listener).
- **Global focus ring exists** (`:focus-visible` 2px `--focus-ring`),
  no `outline: none` anywhere; ring passes on all grounds (F1–F3) except
  the V2 override cases.
- **Spacebar bypass** handler guards form controls (SELECT/INPUT/
  TEXTAREA) and the disabled state; toast Ctrl/Cmd+Z mirrors the same
  guard and never consumes Space — coexistence verified in source.
- **Escape**: dismisses the focused toast (handler on the toast);
  `?dev` harness closes on Escape.
- **Carryover gap (cycle-1 identical, documented not fixed)**: palette
  chips (`.node-chip` divs) and card reorder handles are SortableJS
  pointer drags — **not focusable, no keyboard alternative for adding or
  reordering nodes**. Keyboard-reachable paths that exist: presets
  (select + Load), remove × per card, all sliders via arrows. Flagged
  for master/town-hall as a known limitation of the committed
  drag-library decision (RQ-2, cycle 1), not a cycle-2 regression.

## Reduced-motion classification (15 declarations)

| Declaration | Class | Notes |
|---|---|---|
| `.node-card.agent-pulse` animation + `@keyframes` | **guarded** | inside `no-preference`; rule inert until VIS-6 wires it |
| `.agent-chip[data-state='acting']` activity breath + keyframes | **guarded** | 1.2 s opacity loop; copy carries state under reduce |
| `.agent-toast` entrance + `agent-toast-in` keyframes | **guarded** | exit is instant by construction (FEW-1 removes synchronously) |
| `.agent-toast-undo` transition | **guarded** | inside `no-preference` |
| `.dot`, `#start-button`, `.bypass-btn`, `.param-slider thumb`, `.node-card`, `.node-drag-icon`, `.node-remove-btn` transitions | **allowed-state-color** | color/border/shadow appearance only, 150ms, state feedback (WCAG 2.3.3 essential/state exception) — unguarded but compliant |
| `.node-chip` transition | **unguarded-motion → V3** | includes 1px `translateY(-1px)` hover lift |
| meter canvas ballistics | **exempt** | functional per-frame canvas motion, no CSS animation exists (VIS-5 by construction) |
| SortableJS drag/ghost states | **exempt** | user-initiated direct manipulation |

## ARIA / static semantics (all verified in source)

- `<html lang="en">`; one `h1` (app-title), `h2` per panel (Palette /
  Presets; harness adds its own h2/h3s under `?dev`); 2 sr-only labels
  for the selects in HTML + JS-created sr-only (chip explanation, meter
  labels).
- Meters: `role="meter"` + `aria-valuemin="-60"`/`aria-valuemax="0"` +
  `aria-valuenow`/`aria-valuetext` refreshed at ~4 Hz only-on-change +
  `aria-label` + sr-only human label (src/meters.js).
- Toasts: `role="status"` `aria-live="polite"` per toast; region
  `role="region"` `aria-label="Agent activity notifications"`; Undo is a
  real button; undone note announced via the live region.
- Watchdog alert `role="alert"`; safe-output note `role="note"`;
  harness panel `role="region"` + aria-label, log `role="log"` +
  aria-label, textareas/results aria-labelled.
- Decorative glyphs hidden: arrows, grip dots (`aria-hidden`); remove ×
  carries `aria-label="Remove <type>"`.
- Minor observation (not a violation): the agent chip's state changes
  are not announced (no live region on the chip itself); the sr-only
  explanation is present and toasts carry the actionable news.

## Determinism note

`/tmp/qa4-audit.js` is seedless, offline, and pure-parse: identical
output on every run against this tree (single run recorded above;
results JSON at `/tmp/qa4-results.json`). Re-running after any CSS
change either reproduces the table or throws a drift error naming the
selector — the audit cannot silently go stale.

## PENDING-USER (manual portion)

### (a) Keyboard-only pass (browser)

1. Load `http://localhost:8000` — Tab through: Start → device select →
   Bypass (gated panels are correctly skipped pre-Start). Confirm a
   visible ring on each stop (Start per V2 may be near-invisible —
   confirm the finding).
2. Start (Enter) → Tab reaches Bypass → **Spacebar toggles it** (also
   from body focus); red ON/OFF states read.
3. After Start: Tab into presets — select + arrow keys, Load, Delete,
   Save As… (dialog typing). Add a node by mouse once, then adjust its
   **fader with arrow keys** (native range behavior; Home/End expected).
4. Remove a node via Tab-to-× + Enter. Note: no keyboard path exists to
   ADD or REORDER nodes (documented carryover gap above) — confirm this
   matches cycle-1 and is acceptable for acceptance purposes.
5. Agent toast: via `?dev` harness (Tab into panel, Run a tool) → toast
   appears → **Tab to Undo, Enter** → "Undone" note; **Escape dismisses
   a focused toast**; Ctrl/Cmd+Z performs undo while toasts are present.
6. `?dev` harness: Tab order through title/Close, tool cards (textarea +
   Run), Events Clear, Undo bar; **Escape closes the panel**.
7. Watchdog (optional, per QA-2 hot-signal method): alert announces
   (role=alert), **Restore output reachable + operable by keyboard**.

### (b) DevTools reduced-motion emulation spot-check

Chrome DevTools → ⋮ → More tools → **Rendering** → "Emulate CSS media
feature prefers-reduced-motion" → **reduce**, then reload with `?dev`:
- chip `AGENT ACTING` shows NO 1.2 s breathing (static label only);
- toasts appear/disappear instantly (no 180 ms slide — no exit animation
  exists at all);
- no agent-pulse on cards after a harness mutation;
- **meters still track audio live** (canvas functional motion stays on);
- hover/press color changes still animate in ~150 ms (allowed-state-color
  class); chip 1px hover lift still occurs (V3 — decide if acceptable).

### (c) Distance readability (~2 m / squint)

- Topbar strip: RATE/LATENCY/NODES labels (10px) and mono values legible
  at arm's-length-plus; Bypass state unambiguous at a glance.
- Meters: zone colors readable, red clip latch obvious; dB readout
  legible-or-not at distance (10px mono — record impression).
- Family edges: six card top-edges pairwise distinguishable, esp.
  amber-accent vs Gain brass (rq5's noted proximity risk) and the two
  purples (delay/limiter); initials legible as the redundant encoding.

## Results

- [ ] (a) keyboard-only pass 1–7
- [ ] (b) reduced-motion emulation
- [ ] (c) distance check
- Verdict: PASS / FAIL — static portion: **3 real findings (V1, V2, V3)
  surfaced to master, no code changes; everything computed passes or is
  a documented rq5-accepted exception.**

---

## Post-audit repairs (2026-08-28, master) — V1/V2/V3 FIXED in product

- **V1**: `.meter-readout[data-clip]` text → `--text-primary` (the red
  state stays triple-redundant on the canvas: pin + dot; stop token is a
  non-text color by rq5).
- **V2**: all three amber-fill focus sites (#start-button, toast Undo,
  shared control :active:focus-visible) now use `outline-offset: -2px` —
  the ink ring draws INSIDE the fill where it scores 8.46 (was 1.14–1.27
  on the neutral ground outside).
- **V3**: chip 1px hover lift wrapped in `prefers-reduced-motion:
  no-preference`.
- L1 stays latent-documented; N10 formally reclassified accepted-by-design
  (split-role: the retained red-edge ring carries the ≥3:1 boundary).

**Audit tooling ratchets (documented, dated):** C15 expectation → fixed
value; F5–F7 geometry model → post-fix pairing; N10/P6.7 classification
overrides; vis4 guard-scanner → union-of-all-guard-blocks (first-match
false-failed on the new sibling media block); vis2 src snapshot ratchet
(mcp-tools.js changed by QA-2's name-bound fix).

## FINAL VERDICT (automated portion)

**PASS** — text pairs 79: 70 PASS / 9 classified exceptions / **0 FAIL**;
boundaries 40/40 (39 + 1 by-design); reduced-motion 15/15 compliant after
V3; keyboard/focus 8/8 (+1 documented cycle-1 carryover: drag is
pointer-only, not a regression); ARIA 19/19. CSS truth verified
independently (brace balance 183/183; pulse rule + keyframe confirmed
inside the guard by containment analysis; offsets in place).
Pending: the PENDING-USER browser checks (keyboard-only script,
reduced-motion emulation, ~2 m distance) bundled with the QA-1 batch.

## PENDING-USER resolved (2026-08-28)

Keyboard-only script, reduced-motion emulation, and ~2 m distance check —
run by user: **"everything looked good to me" — PASS.** QA-4 complete.
