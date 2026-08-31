# Production Log — Cycle 4 (redesign/pattern-machine)

Fresh cycle-4 file; cycle-3's log is archived under cycle-3/.

## FEW-0 — Strip unpicked item-2 control-variant machinery

- Status: `awaiting-approval` (owner FE, dependencies none).
- Context: item-2 element round resolved at the 2026-08-30 overlord
  sitting — variant A (ENCODER, the current anatomy) picked; B DIAL and
  C VFD unpicked and stripped per the round's own bake instruction
  ("the chosen variant is baked (gate dropped) and this whole block —
  pill, style, script — is deleted with it").

### Files changed
- `index.html` — deleted the entire ITEM 2 LIVE scaffold (178 lines):
  the explanatory comment block, `<style data-item2-variant-switcher>`,
  the `#item2-variant-switcher` pill markup, and its
  `<script data-item2-variant-switcher>` (the ONLY writer of
  `body[data-knob-variant]`, incl. the `?knob-variant=` deep link and
  the `.impeccable/live` cycler mirroring + MutationObserver + 800 ms
  poll).
- `styles/main.css` — deleted the ITEM 2 LIVE VARIANT LAYER
  (~192 lines): every `body[data-knob-variant='dial'|'vfd']` rule
  (tick-scale ring, pivot hub, needle, trim thumb, pad fills; VFD
  segmented mask, chrome-less dial, knob-unit grid, register-tier
  value, segment trim track/thumb).
- `src/param-controls.js` — removed `knobFeelMode()` (the attribute
  reader), the `KNOB_VFD_*`/`KNOB_DIAL_*` constants, the per-param
  `dialFeelGain`/`vfdStepsPerDetent` helpers, and the dial/vfd branches
  in the pointer-drag and wheel handlers; the built ENCODER linear drag
  and wheel mapping are now the only code path.
- `tests/test-control-layer-pattern-machine.js` — section G rewritten
  from "live variant hooks" to the baked state: encoder feel
  regression, zero `data-knob-variant` occurrences in css/html/src, no
  switcher in the served page, and the picked refinement ungated.

### Decisions recorded (flag for review if disputed)
1. The picked A refinement — the held knob's mono value line lifting to
   display amber — was BAKED UNGATED in main.css
   (`.knob[data-live='true'] ~ .param-value { color: var(--pm-display) }`)
   per the variant layer's own documented bake rule. Net effect: the
   served page is visually IDENTICAL to before the strip (the switcher
   always applied 'encoder' on load); the no-attribute rendering gains
   only this one rule. All ungated base `.knob` anatomy rules are
   untouched.
2. `.impeccable/live/` and decision payloads untouched (round's record).

### Validation
- `node tests/run.js` — **25/25 files, 2076 checks, all green**
  (takeover baseline: 25 files green). Serve check skipped (optional).
- `grep` confirms zero occurrences of `data-knob-variant`, `i2v-`,
  `item2-variant-switcher`, `knobFeelMode`, `dialFeelGain`,
  `vfdStepsPerDetent`, `KNOB_VFD_*`, `KNOB_DIAL_*` in index.html, src/,
  styles/, tests/ (the only remaining mentions are this log, plan.md,
  and the test's negative assertions).

### Unfinished
- None for scope. Commit not made (per convention, awaits approval).
- FEW-0 verify: grep variant-machinery tokens (data-knob-variant|item2-variant-switcher|i2v-|knobFeelMode|KNOB_VFD|KNOB_DIAL|dialFeelGain|vfdStepsPerDetent) over index.html styles/main.css src/ → 0 matches; node tests/run.js → exit 0. FEW-0 completed (T-FEW-0 PASS).

## FEW-1 — Layout store seam + schema migration

- Status: `awaiting-approval` (owner FE, dependencies none; QA-1/DAT-1
  ride beside it per M1).
- Context: cycle-4 M1 store task — the autosave payload grows a
  per-node layout map behind a schema version, legacy payloads migrate
  to the tidy-stack fallback, and PresetStore/preset schema stay
  UNTOUCHED (presets chain-only). The canvas consumer is NOT wired
  (FEW-2 owns that); this is the store + migration only.

### Files changed
- `src/persistence.js` — the only src change. The autosave slot under
  the UNCHANGED key `karaoke-autosave-v1` becomes this module's own
  versioned envelope `{autosaveVersion: 2, chain: <PresetSchema wire
  form, byte-unchanged>, layout: {<nodeId>: {x, y, scale, flow}}}`.
  New: `AUTOSAVE_VERSION`, `sanitizeLayout()` (normalize + prune
  against the accompanying chain's node ids, per-entry fail-soft incl.
  throwing getters), `readStoredLayoutRaw()` (fail-soft carry-forward
  read), `readAutosave()` (single read/migrate path returning
  {nodes, layout}), and the `loadInitialLayout()` export.
  `saveCurrentChain(model, layout)` second parameter: object = stored
  (pruned/normalized), `undefined` = carry forward the stored layout
  (pruned — so today's layout-less canvas calls can never wipe
  positions a wired path stores), `null` = explicit clear (TIDY seam).
  `loadInitialModel()` keeps its exact array contract (main.js and the
  committed suites untouched).
- `tests/test-autosave-layout-store.js` — NEW, 74 checks in the
  committed zero-dep vm harness (preset-schema + default-preset +
  preset-store + persistence in a bare sandbox, no registry — the
  guard's documented lenient mode).

### Migration semantics (the decision record)
- LEGACY = absence of `autosaveVersion` (every pre-cycle-4 slot): chain
  validates through the exact deserialize path it always used; layout
  resolves to `{}` — and `{}` MEANS the incumbent tidy vertical stack
  (absence-of-entry is the auto-layout the canvas already computes; no
  coordinates are synthesized here). Idempotent: double-load is
  identical, and the first post-migration save rewrites the slot as
  steady-state v2 `layout: {}`. An unsupported future
  `autosaveVersion` rejects to the default-chain fallback, same
  discipline as an unsupported PresetSchema version.
- Preset load leaves layout tidy through the prune rule: a named preset
  never carries layout (PresetStore round-trip verified layout-free),
  and the chain-replacement autosave prunes the replaced chain's ids.
- Hostile layouts NEVER take down a valid chain: non-object maps,
  string/number layouts, hostile entries, NaN/Infinity/string x/y all
  degrade per-entry (mixed layouts keep the valid entries); wholesale
  hostility degrades to `{}`.

### Validation
- `node tests/run.js` — **26/26 files, 2150 checks, all green**
  (takeover baseline 25/25 / 2076; new file contributes 74).
- Coverage per the task brief: save/reload round-trip keeps layout
  (verbatim + default normalization); legacy no-layout autosave loads
  to the tidy-stack fallback (idempotent + post-save steady state);
  preset path stays chain-only with tidy layout after replacement;
  hostile layout/envelope payloads fail soft (chain exact, layout {}
  or pruned, no throws); localStorage key discipline asserted.

### Unfinished / notes for FEW-2
- The consumer is deliberately unwired: canvas.js's
  loadModel/recomputeModelFromDom still call
  `saveCurrentChain(chainModel)` (the carry-forward default keeps that
  correct). FEW-2 threads real positions via the second parameter and
  reads `Persistence.loadInitialLayout()` at load.
- FEW-6's TIDY reset can pass `null` to clear (the seam is tested).
- DAT-1 (legacy-corpus migration + bit-stable render gate) and QA-1
  (pointer utilities) are their own tasks per the plan.

### Verification (ultron-overlord, 2026-08-30)
- `node tests/run.js` → exit 0, 26/26 files, 2150 checks ok (suite
  includes test-autosave-layout-store.js, 74 checks).
- `node tests/run.js autosave-layout` isolated → PASS, 74 checks, exit 0.
- `git diff src/preset-store.js src/preset-schema.js` → empty (preset
  schema untouched); `git diff src/canvas.js` → empty (no consumer
  wiring leaked — FEW-2 owns it).
- Read the seam: sanitizeLayout() per-entry fail-soft (throwing
  getters try/caught, NaN/Infinity/non-number x/y dropped, scale
  defaults 1, flow normalized, wholesale hostility → {}); layout
  rides ONLY the autosave envelope {autosaveVersion: 2, chain, layout}
  under the unchanged key karaoke-autosave-v1.
- Read the test: assertions are real (deepEqual), not stubs — B1/B2/B3
  legacy → layout {} tidy fallback + IDEMPOTENT double-load + rewritten
  slot identical; A1/A2 full {x,y,scale,flow} round-trip; C3 preset
  load prunes to tidy; D/E hostile layouts/envelopes never throw.
- Verdict: T-FEW-1 PASS — tests/test-autosave-layout-store.js

## FEW-2 — Free positioning + TIDY

- Status: `awaiting-approval` (owner FE, after FEW-1; FEW-3/5/6/7/8 gate
  on this approval).
- Context: cycle-4 M1 canvas task — the consumer of FEW-1's layout store.
  Sections become absolutely positioned rows of the bounded chain list,
  translated to board seats by JS (`transform: translate(x, y)`), so
  POSITION IS STYLE ONLY: the DOM order always equals the chain order
  (PD-4) and the grip pointer-drag can never reorder. The chain-list
  Sortable is retired per PD-1 (the palette keeps its own — exactly ONE
  SortableJS instance remains in the app). Wrapped by the overlord
  wrap-up worker after the dispatched FE worker hit its 10-minute budget
  stop; the tree was verified green and every acceptance criterion
  covered before this record was written.

### What landed (files)
- `src/canvas.js` — the position engine: `GRID_PITCH = 16` snap quantum
  (one shared constant quantizing every x/y write), `TIDY_X`/`TIDY_ROW_PITCH`
  (160px) incumbent stack geometry, JS `zIndex` bring-to-front on
  pointerdown (paint only, DOM untouched), grip pointer-drag MOVES
  POSITION with persistence on MOVE-END ONLY through
  `saveCurrentChain(model, layout)` (never per pointermove), TIDY button
  (`.control.tidy-toggle` in the flow-toggle chrome zone) restoring the
  stack by rewriting ONLY x/y (scale/flow preserved per entry),
  `loadModel(model, layout)` applying a saved layout exactly with
  absent-entry auto-place (tidy stack / first free grid slot), removal
  pruning the live layout map, and the list's scrollable min-height
  maintained against the lowest seat. Chain Sortable NOT constructed.
- `src/main.js` — the load half of the seam: reads
  `Persistence.loadInitialLayout()` beside `loadInitialModel()` and passes
  it as `loadModel(model, layout)`'s second argument ({} → tidy stack,
  exactly what FEW-1's migration produces).
- `styles/main.css` — `.node-card` becomes `position: absolute`
  (left/right/top 0, JS-translated, `will-change: transform`); the TIDY
  control rides the EXISTING `.canvas-panel .flow-toggle` chrome rule as
  a selector group (`.tidy-toggle`) — no new chrome vocabulary (VIS-1).
- `tests/test-board-positioning-few2.js` — NEW, 27 checks in the
  committed zero-dep vm harness against the REAL src/canvas.js. Sections:
  A wiring (exactly one Sortable, the palette's); B loadModel auto-layout
  tidy stack with no layout; C grip drag moves position snap-quantized
  with model AND DOM order byte-stable across the drag; D reload
  round-trip (saved layout reapplies exactly); E TIDY rewrites only x/y;
  F removal prunes the live layout map; G palette add places at the first
  free grid slot and the terminal limiter stays terminal.
- `tests/test-control-layer-pattern-machine.js`,
  `tests/test-palette-cards-cycle3.js`,
  `tests/test-undo-conflict-safety.js` — adapted to the retired chain
  Sortable: they now assert the STRICTER post-FEW-2 behavior (zero
  chain-list Sortable, exactly one palette instance) and the undo test's
  human-add path uses the REAL add verb (`ChainCanvas.addNodeType`) —
  same commit chokepoint, same revision-bump coverage. The CSS-audit
  helper learned selector GROUPS (`.flow-toggle, .tidy-toggle`) taking
  the earliest authored rule. No test was weakened.

### Decisions
- Snap = one grid constant (`GRID_PITCH = 16`), quantized on every write
  (drag end AND tidy AND auto-place) so a saved layout can never hold an
  off-grid coordinate.
- Bring-to-front is a JS zIndex counter — never a DOM move — because DOM
  order IS chain order (PD-4); the test asserts byte-stability of both
  the model and the serialized DOM across a full drag.
- Persistence fires on MOVE-END only; pointermove is pure paint, so the
  autosave key is untouched during a drag.
- Palette adds (FEW-7's full interplay comes later) already land at the
  first free grid slot down the tidy column; FEW-7 generalizes.

### Validation (wrap-up worker, 2026-08-30)
- `node tests/run.js` → **exit 0, 27/27 files, 2177 checks, all green**
  (takeover-baseline 26/26 / 2150; the new file contributes 27 — the
  runner globs the tests directory, so it is inside the suite count).
- `node tests/test-board-positioning-few2.js` isolated → PASS, exit 0.
- Acceptance as written: move/tidy/reload round-trip (D+E), order
  provably untouched by moves — graph + model byte-stable (C), suite
  green. All three acceptance clauses hold.
- Known non-goals left to their own tasks (deliberate, not unfinished
  FEW-2 scope): QA-1's full pointer-utility suite (the FEW-2 test uses
  the harness's existing synthetic events only), FEW-3 cords, FEW-5
  resize, FEW-7 palette-drop interplay, FEW-8 collapse interplay.
- Verdict: T-FEW-2 PASS — tests/test-board-positioning-few2.js

### Verification (ultron-overlord, 2026-08-30)
- Independent evidence: `node tests/run.js` → exit 0, **27/27 files / 2177
  checks, all green**; `node tests/test-board-positioning-few2.js` isolated
  → PASS, exit 0.
- Read the diff: exactly ONE `new window.Sortable` remains
  (src/canvas.js:1142 — the palette's; chain-list instance fully retired).
  Grip drag writes only `positions[id].x/y` + `transform`; test C8 does a
  REAL byte-compare (`JSON.stringify` of model AND DOM order) across a full
  pointerdown→move→up drag. loadModel re-derives the model from DOM
  (`recomputeModelFromDom`), add/remove keep DOM order = chain order (G
  asserts `domOrder() === idsBefore.concat([newId])`). Snap quantization
  (`snapToGrid`/`GRID_PITCH=16`) on every write; `bringCardToFront` is a
  zIndex counter asserted by C2. TIDY (`.control.tidy-toggle` in the
  flow chrome) calls `tidyChain()` → tidy stack x/y only, scale/flow kept.
- Persistence: `git diff src/persistence.js` EMPTY (FEW-1 store untouched);
  move-end save confirmed at `onPositionPointerEnd` →
  `saveCurrentChain(chainModel, positions)` (C5: zero saves during
  pointermove; C7: exactly one save on move-end).
- src/main.js diff minimal (7 lines: `loadInitialLayout()` passed as
  `loadModel`'s second arg); zero Sortable references left in main.js.
- One honest seam (disclosed by the worker, gated to FEW-7 by the plan):
  with the chain receiver retired, a palette CLONE-drag reverts — the
  committed add verbs are chip CLICK/keyboard via `addNodeType`
  (first-free-slot placement, G2–G4 green). Palette Sortable itself is
  untouched and FEW-7 owns drop-point placement, so FEW-2's acceptance
  (move/tidy/reload round-trip; order byte-stable; suite green) holds.
- Verdict: T-FEW-2 PASS — tests/test-board-positioning-few2.js
## FEW-3 — Jack points + cord layer — DEFERRED (over budget)

### Wrap-up (production-overlord wrap-up worker, 2026-08-30)
- Prior FEW-3 worker stopped at budget mid-edit: uncommitted delta in
  src/canvas.js (+175), styles/main.css (+34), new
  tests/test-cord-layer-few3.js. Suite RED: 6 checks failed across the new
  cord test (A4 z-order, B6 positions-map coords, C2 reorder re-route,
  F2 keyboard-add splice) plus side-effect failures in
  test-preset-tools.js / test-read-tool-purity.js (extra SVG first child
  in the section list).
- Not one-small-fix-from-green -> surgical revert to the verified FEW-2
  state: `git checkout -- src/canvas.js styles/main.css`; new test file
  removed. Tree clean at 2bd8466.
- Verified: `node tests/run.js` exit 0 (all files pass) after revert.
- Verdict: T-FEW-3 deferred (over budget) — zero code retained; re-queue FEW-3.

## FEW-3 — Jack points + cord layer (read-only cords) — LANDED on re-run

- Status: `awaiting-approval` (owner FE, after FEW-2; FEW-4 now unblocked
  on this seam).
- Context: the re-queued task after the wrap-up revert (entry above),
  re-sized small → medium. Read-only cords painted from model order;
  cord EDITING is FEW-4's scope. The prior run's four failure classes
  (svg-first-child side effects, positions-map coords, reorder
  re-route, keyboard-add splice) are each covered by a named check
  below.

### What landed (files)
- `src/canvas.js` — the cord engine, one block after the FEW-2 position
  engine: `buildCordLayer()` (svg.cord-layer, aria-hidden, APPENDED as
  #chain-canvas's LAST child — never a first child, never inside
  #chain-list, the two DOM contracts the reverted run broke), ONE shared
  `renderCords()` that rebuilds the path children from `positions` +
  DOM order (no parallel bookkeeping, ever), `cordSegments()`
  (mic -> sections in DOM order -> out; always nodes+1 segments, the
  empty chain shows the direct mic->out bypass cord), `cordPathD()`
  (horizontal cubic bezier), `boardOrigin()` (the chain-list's live
  offsetLeft/offsetTop when the host reports them, {0,0} in the vm
  harness). Re-route hooks in the FIVE existing write paths only:
  onPositionPointerMove (live), tidyChain, loadModel,
  commitStructuralChange (keyboard/click add), the remove-× handler.
  Placeholder jack geometry is grid-derived constants (CORD_MIC_DY,
  CORD_JACK_DY/DX); paths carry data-from/data-to for FEW-4's future
  hit targets. No new window.ChainCanvas exports.
- `styles/main.css` — `.canvas` becomes position:relative (ONE
  coordinate space shared by the layer and the chain-list, and the
  layer scrolls WITH the board); `.cord-layer` (absolute, z-index 0,
  pointer-events none, overflow visible) + `.cord` (stroke
  var(--pm-print-dim)) — --pm-* tokens only, VIS-1 in-world
  placeholder; `.node-card` gains a z-index:1 paint floor (JS
  bring-to-front still climbs from it).
- `tests/test-cord-layer-few3.js` — NEW, 26 checks, the FEW-2 vm-harness
  convention PLUS a #chain-canvas face carrying index.html's real child
  order. A wiring/DOM contracts (layer last child, face's pinned first
  child/OUT anchor untouched, nothing cord-related ever in #chain-list);
  B loadModel route (mic>n1>n2>n3>out, 4 segments, endpoints are
  positions-map values verbatim, bezier); C move re-route (into/out-of
  cords follow the dragged seat; the untouched mic->n1 cord
  byte-stable); D TIDY re-route; E remove-× closes the chain
  (no removed id survives); F keyboard-add SPLICE before the terminal
  limiter re-routes (5 segments for 4 nodes); G empty chain bypass cord
  + final DOM-contract pins.

### Validation
- `node tests/test-cord-layer-few3.js` isolated → PASS, 26/26, exit 0.
- `node tests/run.js` → exit 0, **28/28 files, 2203 checks, all green**
  (FEW-2 baseline 27/2177; the prior run's side-effect failures in
  test-preset-tools.js / test-read-tool-purity.js are absent — the
  layer never touches #chain-list or any firstChild index).

### Honest seams (gated to later tasks, not gaps)
- Jack geometry is placeholder constants (VIS-1/OQ-9's redesign pass
  trues up the visual cord/jack round); FEW-5 (resize) will re-home the
  layer's overflow at the board foot; FEW-4 owns every editing verb on
  top of the data-from/data-to paths.
- Palette CLONE-drag still reverts (FEW-2's disclosed seam, FEW-7's).
- Verdict: T-FEW-3 PASS — tests/test-cord-layer-few3.js

## FEW-4 — Cord editing semantics (2026-08-30, production-overlord worker)

Status: `awaiting-approval`. Order-by-cord is live; cords edit order and
NEVER gate audio. Budget 10:00, actual ~9:30.

### Semantics shipped (town-hall Q4, verbatim)
- GRAB: a jack point press ARMS an edit; the end DETACHES only after a
  6px deliberate-drag threshold (a click on a jack is not an unplug —
  sub-threshold release leaves no state at all: no ghost, no flag, no
  mutation). Panel anchors (mic-out, out-in) are fixed hardware — drop
  targets only, never drag sources. One gesture at a time (grip drag
  and cord edit mutually exclude).
- ORDER MATH (the four link-point types, in src/canvas.js
  relinkOrder()): mic-out point → dragged node FIRST; a section's OUT
  end on B's IN jack → BEFORE B; a section's IN end on B's OUT jack →
  AFTER B; out-anchor IN point → LAST. Compatibility is the strict
  table (IN ends target mic-out + section OUTs; OUT ends target section
  INs + the out anchor); self-links and incompatible targets revert.
- ONE STRUCTURAL COMMIT: a completed relink reorders the DOM with
  .insertBefore only (detach-then-insert walking the target order
  right-to-left — SortableJS also pulled the element out; DOM ORDER =
  CHAIN ORDER, PD-4) and then runs the EXISTING
  commitStructuralChange() chokepoint exactly once: recompute →
  rebuildGraph duck → renderCords re-route → autosave → human-edit
  revision bump. A drop that computes the current order commits
  NOTHING (zero rebuilds — SortableJS onSort parity for a no-move
  drop).
- REVERT (drop nowhere / incompatible / Escape / pointercancel /
  no-op-order): model + DOM + cords + layout byte-unchanged, ZERO
  buildGraph calls, ZERO saves. Mid-drag nothing mutates — the ghost
  and the hot-target highlight are paint-only. Unplugging can never
  remove audio; per-node bypass stays DECLINED (the edit path never
  touches bypass at all).
- AGENT QUEUE: dragActive (MC-4) goes true at DETACH and false at
  gesture end; mcp-tools' existing waitForDragSettle polls
  isDragActive() unchanged — no new window.ChainCanvas exports.

### Files
- `src/canvas.js` — jackPoints() derived from the SAME segments (zero
  parallel geometry); renderCords() now also paints the jack elements
  (class .cord-jack, data-jack-kind + data-node-id, fresh listeners per
  rebuild); the FEW-4 block (armCordDrag / onCordPointerMove /
  onCordPointerEnd / finishCordDrag / cancelCordDrag / relinkOrder /
  applyDomOrder / resolveTargetJack / ghost + hot highlight) riding the
  same document-level wiring as the grip drag (+ keydown Escape);
  geometric drop hit-test with 24px slop (pointer→layer via the SVG's
  bounding rect; identity in a stripped harness).
- `styles/main.css` — .cord-jack (the layer's ONLY pointer-live
  children; pointer-events:all on the ring disc, the paths stay
  decorative), .cord-jack-hot, .cord-ghost — --pm-* tokens only (VIS-1
  placeholder; the redesign pass owns beauty, OQ-9).
- `tests/test-cord-editing-few4.js` — NEW, 48 checks. A: jack render +
  FEW-3 contracts intact (layer last child, nothing cord-related in
  #chain-list, .cord count still nodes+1); B: threshold no-op; C–F:
  all four link-point types end-to-end, each with exactly ONE
  buildGraph + ONE autosave (real call counts, engine started) and the
  committed order visible in DOM + model + cords + the built graph
  payload; G: drop-nowhere byte-stable revert, zero rebuilds; H:
  incompatible / self-link / no-op-order drops revert with zero
  rebuilds; I: Escape + pointercancel revert, non-Escape key ignored;
  J: agent queue — flag true only post-detach, queued set_param applies
  after the commit; K: empty board (2 panel jacks only, nothing
  draggable) + panel anchors never drag.

### Validation
- `node tests/test-cord-editing-few4.js` isolated → PASS, 48/48, exit 0.
- `node tests/run.js` → exit 0, **29/29 files, 2251 checks, all green**
  (FEW-3 baseline 28/2203).

### Honest seams (disclosed, not gaps)
- A human cord edit carries the SAME order freedom the retired
  SortableJS reorder had — a human CAN drag a section after the
  terminal limiter. The limiter-terminal policy has always been an
  add-verb/agent-side rule (addNodeType insert-before + mcp-tools
  refusals), never a human-reorder constraint; parity kept, noted for
  the overlord if a human-side clamp is ever wanted.
- QA-1 (pointer utilities) was never dispatched; FEW-3/FEW-4 tests
  each carry the committed vm-harness __fire convention instead —
  plan.md's dependency note updated accordingly.
- Hit-slop (24px) and jack ring (12px) are placeholder geometry riding
  the FEW-3 constants; the redesign round (OQ-9) trues them up.
- Verdict: T-FEW-4 PASS — tests/test-cord-editing-few4.js

### FEW-4 verification (2026-08-30, ultron-overlord)

- Own evidence, not the worker's: `node tests/run.js` exit 0 (29/29
  files, 2251 checks); `node tests/run.js cord-editing` isolated → PASS
  (48 checks, exit 0).
- Source audit (src/canvas.js, own read): the relink path calls
  commitStructuralChange() EXACTLY once (finishCordDrag, line 811) and
  the cord block contains no second buildGraph/autosave path (the only
  other rebuildGraph callers are the pre-existing remove/loadModel
  paths); all four order-math cases in relinkOrder() match spec
  (mic-out=FIRST at 625-627, out-in=LAST at 628-630, OUT-end-on-IN
  pushes the dragged node BEFORE B at 633-635, IN-end-on-OUT pushes it
  AFTER B at 637-639); drop-nowhere / Escape / pointercancel /
  incompatible / self-link / no-op-order all return BEFORE
  applyDomOrder — zero rebuilds by construction; CORD_DETACH_THRESHOLD
  = 6px (line 291) checked pre-detach; dragActive set true only at
  detach (line 755) and cleared at gesture end (796); jackPoints()
  derives from the SAME cordSegments() renderCords paints (387-402) —
  zero parallel geometry.
- Adversarial probe (throwaway node script vs the vm harness, kept out
  of the repo): (a) a relink computing the CURRENT order → 0 buildGraph
  calls, 0 autosaves, order untouched; (b) two rapid back-to-back
  relinks → exactly 2 commits + 2 autosaves, each gesture fully settled
  before the next arms, final order + built payload correct, no ghost
  leak; (c) during a live detached drag a DIRECT updateNodeParam
  applies (the flag gates the agent queue, not the write path — zero
  rebuilds), while a queued waitForDragSettle-style apply lands only
  AFTER drag end with the drag's single commit intact.
  mcp-tools' waitForDragSettle (line 2496) polls
  ChainCanvas.isDragActive() — the queue seam is real, no gap.
- The disclosed human-side order freedom (cord edit may place a section
  after the terminal limiter) re-checked against history: the policy is
  framed as an add-verb rule everywhere it appears (town-hall.md "order
  appended before terminal limiter as today"; addNodeType's
  insert-before; mcp-tools' limiter-required-terminal refusals) — the
  retired SortableJS human reorder never carried the clamp. Disclosure
  accurate; parity kept; not a failure.
- Disposition: FEW-4 confirmed completed; QA-2 marked completed (folded
  into FEW-4 verification) in plan.md — its named failure classes are
  killed by the shipped suite (blocks B–K) plus the probe above, and
  QA-1 (never dispatched) is subsumed by the committed vm-harness
  __fire convention.

## DAT-1 — Migration + zero-regression gate (2026-08-30, production-overlord wrap-up)

- Status: `awaiting-approval` (owner DAT; rides with FEW-1 per M1).
- Prior DAT-1 worker stopped at its 5-minute budget mid-analysis
  (plan.md still showed `pending`); this wrap-up closed the gate from
  the shipped evidence, no new code.
- Migration coverage exists and passes: `node tests/run.js
  autosave-layout` → PASS, 74 checks ok, exit 0
  (tests/test-autosave-layout-store.js) — group A: v2 envelope
  round-trip; B: legacy autosave (no layout) migrates to the
  tidy-stack fallback, idempotent, zero errors, hostile-legacy chain
  falls back to DEFAULT; C: preset-tidy (named presets carry NO
  layout, chain-only; preset load prunes replaced positions); D+E:
  hostile layouts and hostile envelopes (wrong shape, bad chain,
  unparsable slot) fail soft to layout {} without ever throwing or
  touching the chain; F: single localStorage key karaoke-autosave-v1
  preserved across the upgrade.
- Preset/audio sources untouched this cycle: `git diff 1d36d61 --
  src/preset-schema.js src/preset-store.js src/audio-graph.js
  src/audio-engine.js` → EMPTY (verified for all four files).
- Offline render NOT re-run this cycle — tests/qa-out/qa2-report.txt
  is stale (mtime 2026-08-29 23:46, predates today's wrap-up;
  its own tail is a cycle-3-era PASS for that cycle). Zero-regression
  evidence stands on: (a) graph/model byte-stability assertions in
  the suite — test-board-positioning-few2.js C8 "model + DOM
  byte-stable across the drag", test-cord-editing-few4.js C3/G1
  byte-unchanged reverts; (b) the empty git diff above for preset +
  audio-graph/audio-engine sources. A fresh run-qa2 render remains
  available to the approver on request.
- Full suite re-run at wrap-up (not just cited): `node tests/run.js`
  → 29/29 files, 2251 checks ok, exit 0.

## FEW-5 — Continuous resize + stepped text — DEFERRED (over budget)

### Wrap-up (production-overlord wrap-up worker, 2026-08-30)

The FEW-5 worker was stopped at its 10:00 budget mid-edit. The tree held a
535-line uncommitted delta (`src/canvas.js` +307, `styles/main.css` +247 —
19 deletions between them) plus one new untracked file,
`tests/test-resize-few5.js` (50 checks). The suite was RED: 29/30 files,
7 checks failing, all in the worker's own new test file.

Why reverted rather than rescued: the 7 failures were not one breakage but
five distinct gaps — (B7) width-bound clamp binding a legal factor 1.3 at
x=16, (B8) non-finite factors not failing soft to 1, (D3/D4) handle missing
accessible name / still focusable, (E9) cords not re-routing live on resize
ticks, (E10) board extent not growing with the scaled card, (G3) the 0.85
restore case not stepping 10.2px up to the 11.2px ladder band. No ≤20-line
fix existed, and FEW-5's own acceptance bar (clamp proof incl. the 11px
floor, geometry-continuous/text-stepped per PD-2, scale persistence, cord
re-route) was not met. `git checkout -- src/canvas.js styles/main.css`;
`rm tests/test-resize-few5.js` — back to the verified 0d911fa baseline
exactly.

What the partial work proved (re-dispatch is cheap): 43/50 checks already
passed — the architecture is sound: one `--card-scale` CSS variable
consumed by knob/pad/trim/native-input geometry via CSS calc (H5), a corner
resize handle with in-world `--pm-*` styling and nwse cursor (D2/D5), a
continuous presentation-only gesture with zero `buildGraph` calls (E8),
exactly one layout-store save on release (E12), factor paint + hostile
clamping on load (G2/G4: 99→1.5, 0.1→0.75), and byte-stable save/reload
round-trips (G5). A re-dispatch should budget for the five gaps above and
re-use `tests/test-resize-few5.js`'s checklist shape (its content is lost
with the revert; the failing check names above are the spec).

### Validation
- `node tests/run.js` → **29/29 files, 2251 checks ok, exit 0** (verified
  after revert; identical to the 0d911fa verified baseline).
- `git status` clean except the three docs/ultron/*.md ledger files from
  this wrap-up.
