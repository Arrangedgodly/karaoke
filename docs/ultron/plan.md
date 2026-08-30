# Cycle 4 Plan — Free-Canvas Patch Editing + Card Resize

From the approved [town-hall.md](town-hall.md) (2026-08-30). Executor:
`$production`. State cursor in [state.md](state.md); evidence in
[production-log.md](production-log.md) (fresh for this cycle).

## Fixed by scope (not re-decided here)

- Cords edit ORDER, never gate audio; drop-nowhere reverts; relink =
  one commit through the existing structural chokepoint (duck/rebuild).
- Linear topology; bounded panel (internal scroll, no pan/zoom).
- Continuous whole-card scale, clamped; 11px text floor at every scale.
- Per-card flow glyph; canvas-level FLOW toggle retired.
- Layout `{x, y, scale, flow}` rides the AUTOSAVE only (versioned,
  migrated); presets stay chain-only; preset load auto-layouts (tidy
  stack).
- TIDY action; overlap allowed with bring-to-front; auto-place adds
  (appended before terminal limiter in ORDER); keyboard/SR capability
  unchanged, DOM order = chain order always.
- Per-node bypass stays DECLINED; no human-edit undo; no agent
  positioning; no touch scope.
- Built inside the locked Pattern Machine world (redesign run owns the
  cord/jack/grid visual pass afterward — OQ-9 seam).

## Planning decisions (made here, surfaced for plan approval)

- **PD-1 SortableJS**: the CHAIN list's Sortable is retired entirely —
  grip-drag becomes POSITION move (never order change); order changes
  only through cords. The PALETTE keeps SortableJS (clone-drag add) —
  its drop interplay is FEW-7's to implement.
- **PD-2 Resize text strategy** (the one flagged sizing decision):
  the card's base text already sits at the floor (11.2px labels), so
  proportional text scaling would make "scale down" illegal almost
  immediately (11/11.2 ≈ 0.98×). Strategy: scale CONTINUOUSLY applies
  to the whole card's geometry (knobs, spacing, header, hit targets)
  while TEXT sizes STEP across the continuous range (e.g. 3 discrete
  steps) with a hard 11px floor — the card reads as one continuously
  scaling object, text stays crisp and legal at every factor. The
  alternative (lifting all base text ~+2px to buy proportional headroom)
  would visibly loosen the density you approved; rejected. If you
  disagree, this returns to town hall (it touches the accepted look).
- **PD-3 Cord rendering**: SVG layer inside the canvas panel (crisp at
  any scale, hit-testing on points only, per-frame drag ghost is cheap);
  meters stay canvas-drawn as built.
- **PD-4 DOM order = chain order** always; position is visual metadata
  only. Screen readers and tab flow read the chain, never the board.

## Lanes & tasks

### Frontend / interaction (owner: FE)

**FEW-1 — Layout store seam + schema migration** · small · pending
- Extend the autosave payload with `layout: { <nodeId>: {x, y, scale,
  flow} }` behind a schema version; legacy payloads (no layout)
  migrate by auto-layout (incumbent tidy stack). PresetStore/schema
  untouched.
- Files: src/persistence.js (+ its store seam), tests.
- Acceptance: round-trip save/reload keeps positions; legacy autosave
  loads to tidy stack; preset load leaves layout tidy; unit-gated.

**FEW-2 — Free positioning + TIDY** · medium · pending (after FEW-1)
- Sections become absolutely positioned inside the bounded canvas
  panel; grip pointer-drag MOVES position (snap-quantized to the grid
  pitch constant; no order change); pointerdown brings to front;
  positions persist via autosave. TIDY control in the canvas chrome
  (flow-toggle zone) restores the incumbent stack for all nodes.
  Chain Sortable retired per PD-1 (palette Sortable untouched).
- Acceptance: move/tidy/reload round-trip; order provably untouched by
  moves (graph + model byte-stable); suite green.

**FEW-3 — Jack points + cord layer (read-only cords)** · small · pending (after FEW-2)
- SVG cord layer; jack points: MIC IN out, per-section in+out, OUT in;
  cords drawn FROM model order (visual only, this task); in-world
  placeholder styling (redesign pass later — OQ-9).
- Acceptance: cords track order changes from any existing path
  (keyboard add, agent, remove); resize/reposition re-routes cords.

**FEW-4 — Cord editing semantics** · medium, the critical path · pending (after FEW-3, QA-1)
- Drag from a jack point (deliberate-drag threshold before detach);
  ghost cord follows; drop on a compatible point = relink → compute the
  new linear order → ONE commitStructuralChange (duck/rebuild,
  autosave, revision bump); drop nowhere = revert, zero audio change;
  agent mutations queue behind in-progress cord drags (isDragActive
  discipline); unplug NEVER removes audio (declined-bypass rule).
- Acceptance: order-by-cord end-to-end; exactly one rebuild per
  committed relink; revert path provably audio-neutral; agent-queue
  test; mid-show guard demo.

**FEW-5 — Continuous resize (clamped) + stepped text** · medium · pending (after FEW-2)
- Corner handle; continuous scale factor on card geometry with
  PD-2's stepped text (hard 11px floor); clamps: min = floor-holding
  factor, max = panel-width bound; scale persists in layout; folded
  sections resize at header scale.
- Acceptance: clamp proof at both ends incl. rendered-text measurement;
  knob/pad/trim behavior + agent fast path intact at every scale;
  crisp text (no blurred half-pixel text) verified in raster.

**FEW-6 — Per-card flow glyph** · small · pending (after FEW-2)
- Flow toggle glyph beside the fold chevron flips content flow
  (below-header ↔ beside-header); persists in layout; canvas-level FLOW
  toggle + its localStorage key retired (read-once, then ignored).
- Acceptance: both flows render + persist; collapse/fold unaffected;
  old key harmless.

**FEW-7 — Palette add placement + lifecycle wiring** · medium · pending (after FEW-2, FEW-3)
- Click/keyboard/agent add → auto-place at first free grid slot (order
  per terminal-limiter policy unchanged); palette chip drag-drop places
  at drop point (snap); remove (×) clears layout entry; loadModel
  applies saved layout or auto-layouts.
- Acceptance: all three add verbs place sanely; ids stable; layout
  entries garbage-free after removes; preset load auto-layouts.

**FEW-8 — Collapse interplay on the board** · small · pending (after FEW-2)
- Folded groove-rows keep {x, y, scale}; grip-drag + corner-resize
  active on folded rows; fold/unfold never moves the card.
- Acceptance: fold-state + position/scale orthogonal; suite green.

### Data / persistence (owner: DAT)

**DAT-1 — Migration + zero-regression gate** · small · pending (with FEW-1)
- Migration tests for every legacy autosave shape; bit-stable audio on
  legacy chains (offline render comparison, run-qa2 style); preset
  round-trips byte-unchanged.
- Acceptance: legacy corpus loads; renders bit-identical; suite green.

### QA / test (owner: QA)

**QA-1 — Pointer-simulation utilities in the vm harness** · small · pending (first, parallel with FEW-1)
- Reusable pointerdown/move/up (+ wheel, threshold-edge) sequences for
  the vm-DOM harness, in the committed zero-dep convention.
- Acceptance: utilities land + one demo test each; no harness drift.

**QA-2 — Cord-editing suite** · medium · pending (beside FEW-4)
- Commit/revert/threshold/single-chokepoint/agent-queue/order-math
  coverage via QA-1 utilities.
- Acceptance: kills the failure classes FEW-4 names.

**QA-3 — Board suite (resize/flow/layout/TIDY/auto-place)** · medium · pending (beside FEW-5..8)
- Clamps incl. 11px rendered-text proof; migration; TIDY; auto-place;
  keyboard parity; overlap bring-to-front.
- Acceptance: gates wired into tests/run.js discovery.

**QA-4 — Regression + acceptance docs** · small · pending (after all FEW)
- Full suite; docs/ACCEPTANCE.md updated with cord/resize manual
  checks; ready for user QA.
- Acceptance: checklist reviewed; suite green.

**QA-5 — User acceptance (live)** · user-judged · pending (after QA-4)
- Build/reorder/resize by pointer on the test vocal; feel verdict.

### Accessibility (owner: A11Y)

**A11Y-1 — Order-based reading + focus rules** · small · pending (after FEW-2, FEW-4)
- DOM/tab/aria order = chain order (PD-4) enforced by test; cords +
  grid decorative (aria-hidden); focus rings visible on overlapping
  cards (bring-to-front on focus); keyboard add unchanged.
- Acceptance: SR reads the chain; focus never lost under a card; gates
  in suite.

### UI seam (owner: VIS — deliberately minimal)

**VIS-1 — In-world placeholders for new affordances** · small · pending (with FEW-3/5/6)
- Jack points, ghost cord, corner handle, TIDY + flow glyphs in the
  current panel vocabulary ONLY (tokens, no new chrome). The full
  cord/jack/grid visual pass is the redesign run's element round
  against the built feature (OQ-9) — NOT this cycle.
- Acceptance: nothing ships off-token; redesign round receives a clean
  seam.

## Dependency order / critical path

QA-1, FEW-1 (parallel) → FEW-2 → FEW-3 → **FEW-4** (+QA-2) →
FEW-5/6/7/8 (+QA-3, VIS-1 interleaved) → DAT-1 gating throughout →
A11Y-1 → QA-4 → QA-5.

## Milestones

- **M1 Contracts + harness** — FEW-1, QA-1, DAT-1: layout persists,
  migrates, and renders bit-stable; pointer utilities ready.
- **M2 Order by cord (thin path)** — FEW-2, FEW-3, FEW-4, QA-2: a
  chain built and reordered entirely by cords, audio-safe.
- **M3 Full board** — FEW-5..8, QA-3, VIS-1: resize, flow, placement,
  collapse interplay, TIDY.
- **M4 Quality + acceptance** — A11Y-1, QA-4, QA-5.

## Research queue

None — every open question (OQ-1..OQ-8) is in-house UX/engineering
owned by production with established patterns; OQ-9 is the redesign
run's. No `$deep-research` phase this cycle.

## Handoff

- Build order: M1 → M4 as above; FEW-4 is the critical path.
- Fixed: see "Fixed by scope" + PD-1/PD-3/PD-4.
- Flagged for plan approval: **PD-2** (stepped-text-within-continuous-
  scale; the proportional-text alternative would loosen the approved
  density — say the word and it returns to town hall instead).
- Return-to-town-hall triggers: any change to the never-gates-audio
  rule, the 11px floor, presets-stay-chain-only, or per-node-bypass-
  stays-declined.
- Approval needed before production: this plan (targeted changes or
  approval). No research gate.
