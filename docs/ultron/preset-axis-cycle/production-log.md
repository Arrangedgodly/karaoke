# Production Log — Cycle 4: Preset Library Shape-Out + Axis Cataloging

Home: docs/ultron/preset-axis-cycle/ (the brother's redesign flow owns the
top-level docs/ultron files; this cycle keeps its own trail — see state.md).

## BEH-1 — Autotune-first insert rule

- Status: `awaiting-approval` (behavior lane; deps none; ships as its own
  PR before the batch PR — the GEN-1 rap/Hard-Tune candidate builds on it).
- Scope guard: a MINIMAL, isolated behavior change — when an autotune node
  is ADDED it lands at the FRONT of the chain instead of the default
  position. No audio code, no reorder changes, no other type's semantics
  touched, terminal-limiter policy untouched.

### The one choke point

- `src/effect-catalog.js` — new public `insertsAtFront(type)` (returns
  `type === 'autotune'`): the ONE definition of the autotune-first
  default, so the human and agent surfaces cannot drift.
- `src/canvas.js` `addNodeType()` (the palette chip click / keyboard add
  verb — the only human add path since the drag was retired): when the
  rule fires, the new card inserts before the FIRST card (index 0, still
  upstream of a terminal limiter — a limiter-only chain gets the autotune
  before it). A missing catalog method (older harness stubs) falls
  through to the append/before-limiter placement.
- `src/mcp-tools.js` `planAddNode()` — the agent `add_node` omitted-
  position default becomes `typeInsertsAtFront(type) ? 0 : model.length`.
  An EXPLICIT position argument still wins, exactly as before. The
  add_node tool description now states the autotune exception.

### Tests (house convention: plain `node`, via `tests/run.js`)

1. Palette add → index 0: `tests/test-cord-layer-few3.js` F4 (real
   canvas.js; addNodeType against a terminal-limiter chain lands at index
   0, cords re-route, limiter stays terminal; plus the limiter-only-chain
   case) and `tests/test-palette-cards-cycle3.js` BEH-1 block (this
   harness loads the real catalog + node-autotune.js, so the chip click
   exercises the real rule; the gate chip still lands before the terminal
   limiter). One cycle-3 assertion that pinned autotune into append order
   was updated to the new policy (append still holds for every other
   type in that same block).
2. Agent add_node → index 0: `tests/test-mcp-tools-cycle3.js` D-BEH1
   (omitted position applied at position 0; pure front insert — every
   pre-existing node keeps its relative order; a non-autotune omitted
   position still follows the append default, i.e. the pre-existing
   limiter-required-terminal refusal behind the terminal limiter).
3. Other types unchanged: few3 F (gain still splices immediately before
   the terminal limiter), palette-cards (gate before the limiter),
   mcp-tools D (explicit positions), safety-refusals B3/B4 — all green
   without edits.
4. Drag-reorder still free: `tests/test-cord-editing-few4.js` J6 — a cord
   edit moves the front autotune later and commits exactly one
   ChainEditing request carrying the reordered candidate (no positional
   lock on autotune).
5. Real chain policy passes: D-BEH1-6 — a set_chain round-trip of the
   front-autotune chain is accepted (set_chain re-runs evaluateChainRules;
   no CHAIN_RULES entry constrains order except
   limiter-required-terminal, which a front insert respects by
   construction).

### Validation

- Full suite: 37/38 files, 3366 checks ok. The one failing file is
  `tests/test-autotune-node.js` — the two KNOWN CPU-p99 timing checks;
  reproduced IDENTICALLY at the base commit (4aa6687, before any BEH-1
  change) in a clean worktree. Environmental flake, not a regression.

### Decisions recorded (flag for review if disputed)

1. Agent-side "front" applies only when `position` is OMITTED — an
   explicit position is operator intent and is honored as before (mirrors
   "manual reorder afterwards is unchanged").
2. The rule lives in the catalog rather than chain-editing because the
   insert POSITION is decided BEFORE a candidate chain exists —
   ChainEditing only ever sees complete candidate arrays, and both add
   paths already treat EffectCatalog as their shared type authority.
3. The parallel flow's uncommitted plan.md edits (RQ/RES status +
   D1–D3 dispositions, companion to commit 4aa6687) were stashed during
   this work and restored afterwards — this branch's commit contains
   only the BEH-1 line change in plan.md.
