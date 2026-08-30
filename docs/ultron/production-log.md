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
