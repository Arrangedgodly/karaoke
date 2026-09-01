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

## GEN-1 — Six genre candidates authored into the pen

- Status: `awaiting-approval` (content lane; deps RES-1 + BEH-1 both
  satisfied — D1 disposition + BEH-1 approved 2026-09-01). Branch
  `gen-1-genre-candidates` (off main; pen + docs only).
- File note: production-log.md was absent on main though referenced by
  state.md — seeded verbatim from branch `beh-1-autotune-first`'s version
  (the BEH-1 entry above) and extended here, so the cycle keeps ONE
  evidence trail.

### What landed in the pen (src/audition-candidates.js)

Six entries appended after the #31 seed entries, authored faithfully
from the RQ-1 chain sketches (research/rq1-genre-idioms.md, D1). The one
catalog-forced adjustment is recorded in the entry's comment and below;
descriptions are the sketch's #28-checklist text.

| # | Entry | Cell (primary) | Chain shape | Budget (of +12) | Margin |
|---|-------|----------------|-------------|-----------------|--------|
| 1 | Metal Mayhem | genre:Metal | eq(−4/−1/+4) → dist(0.35/0.5/−6) → comp(−14/6/3ms/0.12) → dly(90/10/12) → rev(12) → lim(−3/60) | 0.57·14 + 0.57·3 = **9.69 dB** | 2.31 dB |
| 2 | Hard-Tune Hotline (re-author) | genre:Rap/Hip-Hop | **autotune first** (C/Chromatic/5ms/100) → eq(−3/0/+2.5) → comp(−16/5/4ms/0.15) → dly(250/20/18) → rev(10) → lim(−3/50) | 0.57·16 + 0.57·3 = **10.83 dB** | 1.17 dB |
| 3 | Slow Jam Silk | genre:R&B/Soul | gain(+1) → eq(+1.5/+0.5/+1) → comp(−12/2.5/12ms/0.3) → chorus(2/0.5/15) → dly(180/12/18) → rev(35) → lim(−6/150) | 1 + 0.57·12 + 0.57·6 = **11.26 dB** | 0.74 dB |
| 4 | Nashville Nights | genre:Country | eq(−1/+1.5/+2) → comp(−13/3/5ms/0.2) → dly(100/8/20) → rev(18) → lim(−6/120) | 0.57·13 + 0.57·6 = **10.83 dB** | 1.17 dB |
| 5 | Club Anthem | genre:Dance/EDM | eq(−2/−0.5/+3) → comp(−16/4/3ms/0.1) → chorus(2.5/1.2/20) → dly(**380**/30/22) → rev(30) → lim(−3/60) | 0.57·16 + 0.57·3 = **10.83 dB** | 1.17 dB |
| 6 | West End Nights | genre:Musicals | gate(−48/5ms/0.2/−35) → eq(−3/+1/+2) → comp(−13/3/6ms/0.25) → dly(200/15/12) → rev(25) → lim(−6/120) | 0.57·13 + 0.57·6 = **10.83 dB** | 1.17 dB |

Every budget number above is ENGINE-computed, not hand-claimed: a
disposable vm-harness check (same technique as
tests/test-factory-presets-policy.js — set_chain + the +12 dB probe that
makes the engine itemize its own budget breakdown) printed, per entry:

- `Metal Mayhem: mt-c1 makeup |−14|·0.57 = +7.98, mt-l1 makeup |−3|·0.57 = +1.71 → 9.69 dB`
- `Hard-Tune Hotline: rp-c1 +9.12, rp-l1 +1.71 → 10.83 dB` (= Classic Karaoke's budget)
- `Slow Jam Silk: rb-g1 gain +1.00, rb-c1 +6.84, rb-l1 +3.42 → 11.26 dB` (batch's closest fit)
- `Nashville Nights: cn-c1 +7.41, cn-l1 +3.42 → 10.83 dB`
- `Club Anthem: dm-c1 +9.12, dm-l1 +1.71 → 10.83 dB`
- `West End Nights: mu-c1 +7.41, mu-l1 +3.42 → 10.83 dB`

### Sketch → pen adjustments (per D1's rule: record every one)

1. **Club Anthem delay 375 → 380 ms** — the sketch's dotted-eighth-at-
   120-BPM is exact at 375 ms, but delay `timeMs` steps by 10 ms in the
   catalog, so 375 is off the grid; 380 is the nearest legal value
   (~1.3% of tempo, under audition tuning anyway). No other sketch value
   needed touching — the step-grid audit passed for every other param.
2. **Names adopted as-is** from the sketch working names (naming was
   GEN-1's call; they already match house style).

### Supersession (recorded in the pen header + entry comment)

The #31 seed entry "Hard-Tune Hotline" (cell 1) was REMOVED in the same
edit: GEN-1's rap candidate is its re-author. Its audition note —
"needs autotune first in chain… should be first by default" — is
answered by BEH-1's now-approved front-insert rule, honored here as the
chain's leading node (rp-a1 first). OQ-4 defaults resolved per the
sketch's reasoning: key C (inert under Chromatic — the neutral default),
scale Chromatic (nearest-semitone grid is always valid when the karaoke
track's key is unknown; a wrong guessed scale is the #1 artifact source),
retune 5 ms (inside the 0–5 hard-tune band with one detector epoch of
settle; retune 0 is the sanctioned audition fallback if the snap reads
subtle), mix 100 (insert effect, not a blend). Pen after this edit:
11 seed + 6 GEN-1 = 17 entries, no duplicate names, no double-covered
cells.

### Validation (disposable script, run at authoring — NOT committed;
### PEN-1 owns the committed conformance pass at PR time)

- A. 6 GEN-1 entries present (names + order), all pending-shaped
  (verdict 'pending', auditionDate null), library-shaped, every tag a
  legal frozen-vocabulary value, each primary its genre tag and a legal
  dropdown group, technique:hard-tune on the Rap entry, no duplicate
  names, superseded cell-1 draft gone.
- B. Every node type live-registered; EffectCatalog.normalizeParams
  accepts every node; every param on its catalog step grid; node ids
  unique per chain.
- C. PresetSchema round-trip clean for all six (serialize → JSON →
  parse → deserialize → nodes deep-equal).
- D. The REAL policy engine accepts each candidate's exact nodes
  (set_chain applied:true — counts, terminal limiter, EQ rules,
  compound-loop guard, agent param ranges all enforced by the real
  code); budget probe per entry as itemized above, all ≤ +12.
- Full suite `node tests/run.js`: 35/36 files green (2944 checks ok);
  the only failure is tests/test-autotune-node.js's two CPU-p99 checks —
  the KNOWN environmental flake, reproduced identically at the base
  commit (main) in a clean worktree. No engine code touched by this
  branch.

### Decisions recorded (flag for review if disputed)

1. Removing (not renaming) the #31 cell-1 draft: two same-named entries
   would break the audition session's name-keyed verdict recording, and
   the plan itself calls the rap cell a re-author of that entry.
2. Rap tags keep the #31 draft's set (genre primary + performance +
   hard-tune + bright) — the re-author changes the chain and the OQ-4
   defaults, not the cell's tag identity.
3. R&B tagged technique:ambience-long (plate 35 = Warm Ballad's
   auditioned long-ambience level); Musicals tagged vibe:spacious +
   technique:ambience-long ("just enough hall" — the fixed plate's
   size limit is D1's carried caveat; AUD-1 decides if mix 25 reads
   right); Metal technique:ambience-short (near-slap, dry-ish live
   rule); Country vibe:natural (the genre's honest/radio-mix character
   over a second bright-tagged rock clone).
