# Ultron Impeccable — Refinement Checklist (Cycle 2, POL-1)

**Source critique**: [`.impeccable/critique/2026-08-29T05-41-33Z__index-html.md`](../../.impeccable/critique/2026-08-29T05-41-33Z__index-html.md)
— first run for `index-html`, **27/40 (Acceptable)**. Method: single-context
(the orchestrator worker's session exposed no sub-agent tool; Assessment A was
completed and recorded before any detector output entered context, Assessment
B ran second — degraded banner per critique procedure, fallback recorded).
Reference that snapshot for full findings; this file is the execution ledger
only.

**Mode**: approval — every entry stops for user approval before `done`.
**User gate answers (2026-08-28)**: priority = occlusion first · family top
edge = **keep as ratified** · scope = **all 5 priority issues** · canvas-level
bypass indication = **include it** (was deferred scope in src/main.js).
No simulated answers (approval mode).

## Action Summary (transcribed)

| # | Command | Critique finding it addresses | Status |
|---|---------|-------------------------------|--------|
| 1 | `$impeccable layout` | **[P1]** Default-state occlusion: `#chain-list` `min-height: 1.5rem` lets the list shrink below content in the bounded VIS-7 vertical canvas; overflowing cards paint over the OUT anchor/meter (50%) and the safe-output note (47%); watchdog Restore banner appends into the same buried region. Fix shrink + stacking; audit both flow modes. | **done** (user-approved 2026-08-28) |
| 2 | `$impeccable clarify` | **[P1]** Engineer-only param vocabulary — no plain-language layer anywhere for the non-engineer operator (Marco). **[P2]** Pre-Start affordance dishonesty — "Drag an effect here…" hint while palette is pointer-locked until Start; ambiguous 0.55 dim. | **done** (user-approved 2026-08-28) |
| 3 | `$impeccable harden` | **[P1]** Dead-end error states — "Failed to start (Permission denied)" names failures, teaches no recovery; map DOMException paths to operator-voice sentences + next action, technical string demoted to footnote. | **done** (user-approved 2026-08-28) |
| 4 | `$impeccable typeset` | **[P2]** 10px text in the most distance-critical registers — RATE/LATENCY/NODES micro-labels and meter dB readouts (incl. CLIP) at 0.625rem, violating DESIGN.md's own 11px floor (DESIGN.md internally inconsistent — reconcile). Widen fixed slots. | **done-pending-approval** |
| 5 | `$impeccable polish` | **[user-included]** Canvas-level bypass indication — engaged Bypass currently changes nothing below the strip; a bypassed chain should read as bypassed at a glance (deferred scope promoted per user answer). Also the round's final finish pass. | **done-pending-approval** |

Family-edge detector flags are **adjudicated keep** (ratified Touring Rack
encoding, redundantly labeled) — not a refinement entry. Minor observations
stay in the snapshot as backlog.

## Entry log

(Workers append outcome + evidence here; the master records gate outcomes.)

### Entry 1 — `$impeccable layout` (P1 occlusion) — **done** (user-approved 2026-08-28)

- **Files changed**: `styles/main.css` only (+37/−1: one declaration changed,
  one 5-line rule added, remainder comment per house discipline). No markup,
  no JS, no tokens touched.
- **Root cause**: `.chain-list` carried `flex: 1 1 auto` (shrink 1) plus an
  explicit `min-height: 1.5rem` — the explicit min-height overrides the flex
  item's automatic content-based minimum on the canvas's main axis, so the
  bounded VIS-7 panel could squeeze the list below its `flex: none`
  (position:relative) cards; the overflow painted over the static trailing
  siblings (OUT anchor + meter, safe-output note, watchdog alert). Same
  shrink also bit in horizontal mode (row axis), which the critique had not
  measured.
- **Fix (two layers, both CSS)**: (1) `flex: 1 0 auto` on `.chain-list` —
  the list never shrinks below its cards in either orientation; growth
  (slack sharing with the empty-hint) and the 1.5rem empty droppable slot
  are unchanged; `.canvas`'s own overflow owns scrolling (vertical:
  internal scroll inside the bounded panel; horizontal: overflow-x).
  (2) `position: relative; z-index: 1` on `.anchor` / `.safe-output-note` /
  `.watchdog-alert` — fail-safe stacking so positioned cards can never
  paint over the fixed instrumentation even if a future regression
  re-introduced overlap. No layout effect: all stay in normal flow;
  SortableJS's forceFallback drag clone lives at body level, untouched.
- **Evidence (playwright-core + system Chrome, real Start path with fake-mic
  flags, fresh-profile default 6-card chain; watchdog injected exactly as
  src/meter-taps.js builds it — disclosed substitution, real trip not
  forced)** — bounding-box overlap between every `.node-card` and each
  protected element, clipped to the canvas's visible region:
  - BEFORE (repo at HEAD): 1440×900 vertical expanded — OUT anchor 100%,
    OUT meter 100%, safe-output note 100%, watchdog 82.8%; vertical long8 —
    same 100%; horizontal expanded — OUT anchor 22.1%, OUT meter 91.7%;
    horizontal long8 — OUT meter 100%, note 58.1%, watchdog 45.9%;
    1280×800 equal or worse (watchdog 100%); all-collapsed clean (matches
    critique). 12/12 states measured.
  - AFTER: **0% overlap in all 12 states** (vertical/horizontal ×
    expanded/collapsed/long8 × 1440×900/1280×800).
  - Bounded canvas survives: vertical long chain scrolls INSIDE the canvas
    (scrollHeight > clientHeight) with page height pinned at the viewport
    (docH 900/900, 800/800); horizontal panel un-bounded
    (`max-height: none`) with page-owned x-scroll.
  - Detector: CLI `detect.mjs --json index.html` self-degraded to regex
    mode (`[]`, exit 0) as in the critique run; the engine that actually
    produced the finding (browser bundle, text-occlusion rule) was run in
    the live default state via script injection — PRE-FIX reproduces the
    critique's exact findings ("OUT" 50% covered, safe-output-note 47%
    covered; 15 findings total); FIXED: **0 text-occlusion findings**
    (14 remaining = the critique's adjudicated false positives: undersized
    text, family-edge borders, font-stack, type-hierarchy — other
    entries' scope).
  - Functional: SortableJS palette→chain drag adds a card (vertical);
    reorder drags pass in BOTH orientations on the fixed code with
    identical results to pre-fix; empty-state droppable slot intact
    (1.5rem floor verified pre-Start); horizontal OUT anchor + note
    reachable at the scrollable right end.
- **Residual risk**: overlap was also verified only for card-vs-trailing
  instrumentation geometry the detector + this harness measure; drag
  reorder verified by synthetic pointer drags (both orientations), not
  human-pointer timing.

### Entry 2 — `$impeccable clarify` (P1 param vocabulary + P2 pre-Start honesty) — **done** (user-approved 2026-08-28)

- **Files changed** (entry's own delta; `styles/main.css` total vs HEAD is
  +91/−2, of which +37/−1 is entry 1's already-recorded fix):
  - `index.html` +26/−2 — pre-Start `#empty-hint` copy + comment; the
    `#start-hint` instruction span after Start + `aria-describedby` on
    `#start-button` + comment. No other markup, ids, or copy touched.
  - `src/param-controls.js` +101/−0 — the `PLAIN_LANGUAGE_HELP` map (the
    single source for all copy) + `lookupHelpLine()` + per-row wiring
    (title ×2, sr-only span, aria-describedby). Input semantics, step
    values, event wiring, `label[for]` pairing: untouched.
  - `src/canvas.js` +13/−0 — `onEngineStarted()` flips the empty-hint to
    the cycle-1 drag copy (verbatim; that string now lives only here).
  - `styles/main.css` +54/−1 — `.start-hint` + `#start-button:disabled ~
    .start-hint`; not-allowed cursor + inset hairline lock seam on the
    gated region; gated `.empty-hint` dashed→solid hairline seam. Tokens
    only (`--hairline`, `--text-muted`); no raw hex, no new motion.
- **Mechanism** (lightest that covers hover + keyboard + SR, no tooltip
  framework, no deps): native `title` on the param row AND the slider
  (hover/long-press; Chromium also surfaces title on keyboard focus),
  plus one clip-hidden `.sr-only` span per row wired via
  `aria-describedby` on the slider so the line is announced WITH the
  control. Disclosed trade-off: native title tooltips are not styleable
  and their delay is OS-controlled — accepted for this pass per scope.
  Param labels stay verbatim (terse-technical register is ratified); the
  layer is additive. No label prefix in the lines: the row already
  silkscreens the label and SR announces `label[for]` first.
- **Plain-language copy inventory** — all **14 params across all 6 node
  types** covered, single-sourced in `PLAIN_LANGUAGE_HELP`
  (src/param-controls.js). The **five riskiest**, outcome-framed with an
  explicit direction clause: compressor `threshold`, compressor `ratio`,
  delay `feedback`, delay `mix`, limiter `ceiling` (⋆).

  | Type | Param | Line |
  |---|---|---|
  | gain | Gain | Overall mic volume. Higher = louder. ⋆-adjacent (direction clause) |
  | compressor | Threshold | Where squashing kicks in. Lower = squeezes more. ⋆ |
  | compressor | Ratio | How hard loud parts get squeezed. Higher = more squash. ⋆ |
  | compressor | Attack | How fast squeezing starts. Smaller = starts sooner. |
  | compressor | Release | How fast squeezing lets go. Bigger = lets go slower. |
  | eq | Low | The bass end. Higher = more bass, lower = less. |
  | eq | Mid | The body of the voice. Higher = fuller, lower = thinner. |
  | eq | High | Brightness and air. Higher = brighter, lower = duller. |
  | delay | Time | The gap between echoes. Longer = a slower echo. |
  | delay | Feedback | How many repeats each echo adds. Higher = more repeats. ⋆ |
  | delay | Mix | How much echo you hear. Higher = more echo. ⋆ |
  | reverb | Mix | How much reverb you hear. Higher = more. |
  | limiter | Ceiling | The loudest sound allowed through. Lower = quieter. ⋆ |
  | limiter | Release | How fast the limiter lets go after a loud peak. Smaller = sooner. |

- **Pre-Start copy, before → after**:
  - empty-hint: "Drag an effect here to start building your chain" (always,
    including while dragging was impossible) → **"Press Start to power on"**
    pre-Start (static default in index.html); the drag copy returns verbatim
    exactly when the palette un-locks (canvas.js `onEngineStarted`).
  - NEW strip instruction (no equivalent existed — the device-select
    placeholder was the only true instruction): **"Press Start to power on"**
    as `.start-hint` beside Start, `aria-describedby`-associated, hidden
    purely via `#start-button:disabled ~ .start-hint` (tracks the real
    engine state through main.js's own disable/re-enable logic — verified
    reappearing on the mic-permission failure path).
  - Inert treatment: 0.55 dim kept (documented ≈3:1 gated legibility —
    stronger dim would break it); added `cursor: not-allowed` on the gated
    `.layout` (visible: the pointer-events:none panels pass hit-testing
    through to it) + inset hairline lock seam per panel + the empty-hint's
    dashed drop-target affordance retired to a solid seam while gated.
- **Evidence** (playwright-core + system Chrome, fake-mic flags, real Start
  path; temp servers on 8177/8179, both stopped; user's :8000 untouched):
  - PRE-START: power-on copy visible; computed cursor `not-allowed` on all
    three panels; lock seams computed (`inset rgb(76,70,62)`); hint border
    solid hairline; `.start-hint` visible at 12px; `aria-describedby`
    wiring correct; pointer-events still `none` (gate intact).
  - POST-START (6-type chain via the app's own `loadModel`): 14/14 rows
    carry title (row + slider) AND resolvable same-row aria-describedby
    with the exact expected line; label[for] pairing intact; sr-only spans
    1×1px with zero layout footprint (row geometry identical with the span
    display:none'd); collapse/expand still works (0-height +
    visibility:hidden + out-of-tab-order when collapsed; screenshot
    archived); empty-chain state shows the drag copy verbatim with the
    dashed target restored; keyboard: slider focus + ArrowRight still
    changes the value (wiring unregressed).
  - FAILURE path (injected getUserMedia rejection): status stays verbatim
    ("Failed to start (Permission denied)" — entry 3's scope), Start
    re-enables, `.start-hint` reappears, empty-hint stays on power-on copy.
  - Detector: CLI `detect.mjs --json index.html` self-degraded to regex
    mode (`[]`, exit 0) — same degradation as entry 1's run, noted. The
    browser bundle was therefore A/B-injected (fresh page per state,
    autoScan disabled — an earlier double-scan-in-one-page methodology
    produced self-referential artifacts, discarded) in BOTH the pre-Start
    and post-Start default-chain states against an entry-2-reverted
    baseline tree: **0 new findings, 0 disappeared** in both states. An
    initial draft of the copy (label-prefixed em-dash format) tripped the
    detector's advisory em-dash-overuse rule; the lines were rewritten as
    plain two-sentence help and the finding is gone.
- **Residuals (disclosed)**: native title tooltips' visual rendering is
  browser/OS chrome — attribute wiring and Chromium's focus-tooltip
  behavior verified programmatically, the painted tooltip itself not
  screenshot-capturable headlessly. Long-press coverage rides the same
  native title behavior (not separately touch-tested). Hover spot-checks
  performed on delay-Mix and limiter-Ceiling rows (titles verified;
  screenshots archived at /tmp/clarify-*.png).

### Entry 3 — `$impeccable harden` (P1 dead-end error states) — **done** (user-approved 2026-08-28)

- **Files changed** (entry's own delta; numstat vs HEAD minus entries 1–2's
  recorded deltas):
  - `src/main.js` +180/−6 (all entry 3; entries 1–2 untouched this file) —
    the `MIC_ERROR_COPY` map + `NO_GETUSERMEDIA_COPY` / `MIC_ERROR_FALLBACK`
    + `micErrorCopy()` / `errorFootnote()` helpers; `setStatus` gains the
    optional `detail` footnote param and clears a stale `error` class; new
    `setErrorStatus()` / `setStartHint()`; both catch blocks reworked.
    Audio engine, permission flow, device-switch wiring: untouched.
  - `index.html` +10/−1 — `role="status" aria-live="polite"` on the
    EXISTING `#status` element + comment. No other markup.
  - `styles/main.css` +53/−3 — `.status.error` (the previously-unreferenced
    `--status-error` token), `.status-detail` (muted mono footnote
    register), `.start-hint` capped at `max-width: 21rem`, `.topbar-status`
    capped at `20rem`, `.topbar-identity` `flex: 1 1 auto` → `1 1 0`.
    Tokens only; no raw hex; no new motion.
- **Mechanism**: one map keyed by DOMException `.name` near the two failure
  sites (both in main.js); each entry = WHAT HAPPENED (`line`, always short
  enough to read in full on the strip) + NEXT ACTION for a failed Start
  (`startAction`, rendered in entry 2's `.start-hint` beside Start, whose
  CSS-keyed visibility shows exactly while pressing Start is the true next
  action) + the mid-show variant (`switchLine`, what + action in one
  front-loaded sentence on the status line, since the hint is hidden while
  the engine is live). The technical string (`Name: message`) is appended as
  a `.status-detail` span — muted mono, sentence case, 12px — in the hint
  (Start failures) or on the status line (switch failures); the full
  untruncated pair also rides the hint's `title` (hover). Plain Errors share
  the name `'Error'`, so audio-engine's secure-context guard is matched by
  its stable message text; everything unmapped falls to an honest generic
  with a retry step. Every path still `console.error`s the raw exception.
  `role="status" aria-live="polite"` on `#status` announces Live/Stopped/
  failure sentences to assistive tech (previously silent — critique red
  flag under heuristic 9).
- **Strip no-pump work (the entry's hard part, disclosed in full)**: the
  strip is geometrically tight — readouts (222px) + agent chip (84) + Bypass
  (166) + controls-without-hint (295) + gaps/padding (112) leave ~560px for
  status + hint copy at 1440. With `flex-wrap`, wrapping is decided on flex
  BASE sizes before shrinking ever engages, so long copy wraps the strip
  rather than ellipsizing — and measurement showed HEAD already wrapped:
  failure states were 109px (2 rows) at 1440 AND 1280, and even pre-Start
  was 109px at 1280. Fixes: `.topbar-identity` basis `auto`→`0` (grow
  reproduces today's rendered title width exactly whenever the row has
  slack, so every non-error state renders unchanged; it differs only when
  over-full, which is the strip's own declared "legend ellipsizes first"
  behavior that basis:auto never actually delivered), plus base-capping
  `max-width`s on `.topbar-status`/`.start-hint` with front-loaded copy.
  Result: ALL failure states are one row (65px = the pre/post-Start height)
  at 1440×900, the critique's event-laptop width.
- **Error→copy mapping** (status-line sentence | Start-failure hint action |
  switch-failure line):

  | Failure (key) | Status line (WHAT) | Start hint (NEXT ACTION) | Switch line (WHAT + NEXT) |
  |---|---|---|---|
  | `NotAllowedError` | Mic was blocked. | Click the camera icon in the address bar → Microphone → Allow, then press Start. | Mic blocked. Re-allow from the address-bar icon, then pick again. |
  | `NotFoundError` | No mic was found. | Plug a mic in, then press Start. | That mic is gone. Pick another from the dropdown. |
  | `NotReadableError` | Mic is busy. | Close the other app using the mic, then press Start. | That mic is busy. Close its app, then pick again. |
  | `OverconstrainedError` | Could not start the engine.* | Press Start to try again.* | That mic is gone. Pick another from the dropdown. |
  | `SecurityError` | Mic blocked by browser. | Open Chrome at http://localhost:8000, then press Start. | Browser blocked that mic. Pick another. |
  | `AbortError` | Mic request cut off. | Press Start to try again. | That mic did not respond. Pick it again. |
  | plain Error, "getUserMedia is not available" (secure context) | Mic not available here. | Open Chrome at http://localhost:8000 (use the start file), then press Start. | (unreachable — switch requires a started engine) |
  | unmapped / non-Error | Could not start. | Press Start to try again. | Could not switch. Pick another mic, then try again. |

  \* `OverconstrainedError` cannot occur on Start (no `exact` constraint in
  AUDIO_CONSTRAINTS); its Start columns are the generic fallback strings.
- **Evidence** (playwright-core + system Chrome; temp server on 8183, stopped;
  user's :8000 untouched; screenshots at /tmp/harden-final-1440.png,
  /tmp/harden-start-notallowed-{1440,1280}.png):
  - Failure matrix — getUserMedia overridden BEFORE app scripts
    (addInitScript) to reject with each of NotAllowedError, NotFoundError,
    NotReadableError, SecurityError, AbortError, the secure-context plain
    Error, and an unknown plain Error, each at 1440×900 and 1280×800: the
    strip shows the operator sentence in Error Coral (computed
    `rgb(255,128,110)`), the footnote span present and demoted (computed
    `rgb(167,159,146)`, ui-monospace, 12px, no transform), Start re-enabled,
    hint visible beside Start with the action; **strip height 65px (one
    row, = pre/post-Start baseline) in all 14 matrix runs at 1440**.
  - REAL browser-deny path: launched WITHOUT fake-ui flags with
    `--deny-permission-prompts` (supported by this Chromium) — actual
    Chrome permission denial produced "Mic was blocked." + footnote
    "(NotAllowedError: Permission denied)" (the real Chrome message) + the
    full hint pair. No stub involved.
  - Retry-works: after each stubbed failure, a second Start click (stub now
    passing through to the real API under fake-mic flags) went **Live**,
    `error` class cleared, footnote gone from the status line, hint hidden,
    strip 65px.
  - Device-switch failures mid-show (engine live, real change handler; a
    second `<option>` injected since the fake device yields one input):
    OverconstrainedError and NotReadableError → `status live error` (lamp
    stays amber — engine truth preserved), sentence + demoted footnote on
    the status line, hint hidden, strip 65px; picking the original device
    again recovers to Live with the error cleared.
  - a11y wiring: `#status` carries `role="status"` + `aria-live="polite"`
    (verified in-DOM on every run).
  - No-pump baselines: pre-Start 65px and post-Start 65px at 1440; at 1280
    pre-Start improved to 65px (identity basis fix), failure states 109px —
    identical to HEAD's own 1280 numbers (HEAD pre-Start AND failure were
    both 109px there), so nothing regressed vs HEAD; the 1440 event-laptop
    width is strictly improved (HEAD failure 109 → 65).
  - `node --check src/main.js` clean. Detector: CLI `detect.mjs --json
    index.html` self-degraded to regex mode (`[]`, exit 0) — same
    degradation as entries 1–2, noted; all new copy renders at 0.75rem
    (12px, above the 11px floor), verified by computed style.
  - README: no recovery step it teaches changed — the in-app Chrome path
    ("camera icon in the address bar → Microphone → Allow") matches
    README's "look for a camera/mic icon in the address bar"; left
    untouched.
- **Residuals (disclosed)**: (1) At 1280×800 the failure states wrap the
  strip to its designed second row (109px) — equal to HEAD's behavior at
  that width, not a regression, but not one-row; the ~240px deficit is
  structural (fixed strip blocks), so one-row at 1280 with meaningful
  recovery copy is not achievable without strip re-architecture (out of
  scope). (2) The Chrome-permission action ellipsizes at the 21rem hint cap
  (visible through "…→ Microphone → A…" at 1440); the full sentence rides
  the hint's native title tooltip (same mechanism entry 2 uses, same
  OS-controlled-delay trade-off). (3) After a failed-then-successful Start,
  the hidden hint keeps its last footnote span in the DOM (invisible,
  display:none via the disabled-Start rule, overwritten on any later
  failure) — harmless, noted for completeness. (4) Device-switch failures
  were exercised via a real change event on an injected second `<option>`
  (the fake-mic flag exposes exactly one input device); the handler and
  engine code paths are real, the device list length is environmental.

### Entry 4 — `$impeccable typeset` (P2 sub-11px readouts) — **done-pending-approval**

- **Files changed**: `styles/main.css` (9 font-size raises + 2 slot
  min-widths + floor comments), `DESIGN.md` (hierarchy reconciliation),
  `.impeccable/design.json` (ds-chip CSS string only). No markup, no JS,
  no tokens, no id/class contracts touched.
- **Raises (before → after)**:
  - `.readout-label` (RATE/LATENCY/NODES) 0.625rem → **0.7rem** (10→11.2px),
    same 700/0.08em/uppercase vocabulary — size only.
  - `.meter-readout` (dB / CLIP latch) 0.625rem → **0.7rem** — fits the
    96px unit right-aligned ('−12.0'/'CLIP'/'−∞' measured, no overflow;
    `.meter-unit`/`.meter-canvas`/`src/meters.js` CANVAS_W 96 NOT changed,
    lockstep comment intact).
  - `#preset-select optgroup` (PS-4 legend, the detector's third flagged
    instance) 0.625rem → **0.7rem**.
  - `.node-chip::before` initials 0.625rem → **0.6875rem** (the declared
    initials floor; matches the node-card chip; fits the 1.25rem square).
  - MCP harness (dev-only, grep-proof floor): `.mcp-harness-section-title`
    0.68rem, `.mcp-harness-badge` 0.62rem, `.mcp-harness-param` and
    `.mcp-harness-params` 0.66rem, `.mcp-harness-undo-depth` 0.66rem,
    `.mcp-harness-undo-hint` 0.6rem — all → **0.6875rem**.
  - Fixed slots widened for headroom: `#readout-sample-rate` 7ch → **8ch**,
    `#readout-latency` 6ch → **7ch** (`.readout-value` stays 0.95rem; node
    count slot 3ch unchanged).
- **DESIGN.md reconciliation**: Label hierarchy now reads
  "(700, 0.7rem / 11.2px, …)" and Readout "0.7–0.95rem" — the 11px Floor
  Rule's claim is now true of the tree. `.impeccable/design.json`'s only
  size-quoting CSS string (ds-chip initials 0.625rem) updated to 0.6875rem;
  typographyMeta purposes quote no sizes.
- **Evidence** (playwright-core + system Chrome, temp server 8191/8192,
  stopped; fake-mic flags, real Start → Live; zero page errors):
  - Grep-proof: zero `font-size` declarations below 0.6875rem in
    styles/main.css + index.html; the only sub-0.7rem survivors are the
    0.6875rem initials floor (9 instances, all = the declared floor).
  - Computed: all three `.readout-label` = 11.2px; `.meter-readout` =
    11.2px inside the 96px unit.
  - Slot containment: worst-case strings injected live — '48.0 kHz' 73px
    ≤ 8ch slot, '47.8 ms' 64px ≤ 7ch slot, '8' 45px — no overflow/wrap;
    meter readout '−12.0'/'CLIP'/'−∞' all fit 96px (scrollWidth ==
    clientWidth, no clipping).
  - One-row: topbar 65px at 1440×900 both default and Live states (equals
    the entry-3 baseline). Width sweep 1440/1100/950/900/880 vs stashed
    HEAD: identical wrap behavior at every width (1440 one-row; wrapped
    below, +2px row height from the larger labels only) — no breakpoint
    regression; entry-3 max-widths still hold.
  - Detector (`detect.mjs --json index.html`): **0 findings** (regex-mode
    degradation — parser modules unavailable, noted). On `styles/main.css`:
    13 findings, all pre-existing advisories (0.8/0.9/0.95/1.05rem ramp,
    rgba/`#FFFFFF` colors) — zero undersized-text findings.
  - `node tests/run.js`: **14/14 files, 770 checks, all green**.
- **Residuals (disclosed)**: the meter canvas's dB scale numerals
  (−60/−40/−20/−6/0) are canvas-painted at 9px mono by `src/meters.js`
  (`ctx.font = '9px …'`) — CSS cannot reach them and a repaint to 11px
  risks label collision inside the fixed 96×26 grid, so they are left to
  meter-component scope. They are redundant scale ticks (the DOM readout
  at 0.7rem carries the value at distance), and the canvas contract
  comment still says 9px truthfully.

### Entry 5 — `$impeccable polish` (bypass canvas indication + finish pass) — **done-pending-approval**

- **Files changed**:
  - `src/main.js` +62/−10 — entry 5: lazily-resolved `.canvas-panel` handle
    (lazily because the node test harnesses stub `document` without
    `querySelector`); `setBypassButtonLabel()` now toggles `bypassed` on the
    panel from the SAME `AudioBypass.isEngaged()` read that drives the strip
    button; `surfaceLoss()` removes the class on lifecycle loss (#4 paths);
    `recoverFromLoss()` re-syncs via `setBypassButtonLabel()`; the stale
    UI-3 "deferred" comment replaced with a superseded-note. PLUS one
    finish-pass defect fix (see below): `Array.prototype.forEach.call` over
    `deviceSelect.children` (line ~356) — the direct `.forEach` threw on
    every real-browser Start (HTMLCollection has no forEach), surfacing a
    false "Could not start." after the mic was granted. Audio routing,
    spacebar guards, entry-1–4 behaviors: untouched.
  - `styles/main.css` +55/−0 — the entry-5 block at file end: 150ms ease
    opacity transition on `.chain-list`/`.flow-toggle`; both to `opacity:
    0.55` under `.canvas-panel.bypassed` (the engine-not-started gated
    precedent value — no new token needed); a silkscreen `BYPASSED` state
    line as `.chain-list::after` (pure CSS content — no markup, no
    SortableJS child) in the panel-legend register (`--font-readout`,
    0.7rem, 0.08em, `--text-muted`), with a horizontal-mode variant riding
    the row after the last card. Tokens only; no raw hex; no keyframes.
- **Indication design**: only the CHAIN recedes — node cards + flow toggle
  to 0.55 with the BYPASSED silkscreen. Deliberately NOT de-emphasized:
  both anchors + their meters, safe-output note, watchdog alert,
  empty-hint (operator ground truth — the dry path is live while bypassed;
  meters stay truthful), and the palette/presets flanks (the operator may
  prep the next chain while bypassed). Verified in code: the OUT tap hangs
  off the FINAL-output attenuator (post-chainGate), so while bypassed it
  honestly reads the muted chain; the dry path itself is un-metered (see
  residuals).
- **Scan findings (one screenshot round: default, live, bypassed
  [vertical+horizontal], all-collapsed, 900px wrap, ?dev harness)**:
  - FIXED: the Start-path `HTMLCollection.forEach` crash above (triable as
    tier-1: broken task + misleading state, found because the verification
    harness exercises the REAL Start path).
  - LEFT (pre-existing, by design or other entries' adjudicated scope):
    horizontal mode owns an x-scroll with the OUT block at the scrollable
    right end (entry-1 ratified behavior); meter-canvas 9px scale numerals
    (entry-4 disclosed residual); family-edge borders + detent ticks +
    font-stack (adjudicated keeps per the checklist preamble); bounded
    vertical canvas scrolls internally with long chains (entry-1 ratified).
- **Evidence** (playwright-core + system Chrome, fake-mic flags, real
  Start → Live; temp server 8195, stopped; zero page errors):
  - 91/91 checks across 5 scenarios (vertical/horizontal × 1440/900 +
    collapsed + ?dev): pre-start no class; live chain opacity 1 + no tag;
  - bypassed: class present, chain + flow toggle computed 0.55, MIC/OUT
    anchors, meter, note, hint, palette, presets all computed 1 (asserted
    differ); BYPASSED tag renders; occlusion guard 0px overlap in every
    state WITH the new class present (entry-1 geometry re-measured);
  - spacebar disengage restores (class gone, opacity 1, tag none);
    spacebar re-engage; `forceStreamLoss('device')` → NO stuck bypassed
    class; dev harness + agent toast render with zero page errors.
  - Screenshot review: default/live/bypassed states inspected (chain
    region visibly recedes, anchors at full strength, no overlap); the
    ?dev-toast capture failed remote image analysis twice (format error)
    — its layout is verified by the geometry/no-page-error checks only
    (disclosed).
  - `node --check src/main.js` clean; `node tests/run.js` **14/14 files,
    770 checks, all green** (audio-bypass/watchdog semantics untouched —
    no DOM assertions existed to extend).
  - Detector: `detect.mjs --json index.html` self-degraded to regex mode
    (`[]`, exit 0), same degradation as entries 1–4 — no new findings.
- **Residuals (disclosed)**: (1) the OUT meter taps the chain path's
  final-output attenuator, so during bypass it reads the muted chain
  (≈−∞), not the dry path the room hears — honest w.r.t. the chain but
  not a dry-path level readout; re-tapping the OUT analyser onto the dry
  path is audio-graph surgery outside this entry (and would change what
  the watchdog sees). (2) The BYPASSED tag's ::after box is a real flex
  item — it adds ~21px of chain height when engaged; measured inside the
  bounded canvas with the occlusion guard still at 0px overlap in all
  states. (3) `recoverFromLoss` re-syncs the class but the strip button's
  label too — both from the one read, so no drift path exists.
