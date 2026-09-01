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

## GAG-1 — Six gag candidates authored into the pen

- Status: `awaiting-approval` (content lane; dep RES-2 satisfied — D2/D3
  dispositions). Branch `gag-1-gag-candidates` (stacked OFF
  `gen-1-genre-candidates` so the pen PR stacks cleanly; pen + docs only).

### What landed in the pen (src/audition-candidates.js)

Six entries appended after the GEN-1 genre entries, authored exactly from
the RQ-2/RQ-3 record (research/rq2-gag-reauthoring.md, D2/D3): the three
re-auditioned gags answering their 2026-09-01 notes, plus the three
never-authored cells. No sketch value needed touching — the step-grid
audit passed for every param (unlike GEN-1's delay 375→380 adjustment).

| # | Entry | Cell (primary) | Chain shape | Budget (of +12) | Margin |
|---|-------|----------------|-------------|-----------------|--------|
| 1 | Robot Usher (re-author) | gag:robot | eq(−6/+4/0) → pitch(+3/45) → chorus(1.5ms/6Hz/30) → crush(6/30) → trem(12Hz/65) → lim(−6/60) | 0.57·6 = **3.42 dB** | 8.58 dB |
| 2 | Megaphone Rally (re-author) | gag:megaphone | eq(−12/+9/+3) → dist(0.5/0.45/0) → comp(−18/12/2ms/0.08) → lim(−3/50) | 0.57·18 + 0.57·3 = **11.97 dB** | 0.03 dB |
| 3 | 8-Bit Encore (re-author) | gag:8-bit | eq(−2/+1/+3) → crush(6/55) → trem(4Hz/25) → lim(−6/80) | 0.57·6 = **3.42 dB** | 8.58 dB |
| 4 | Helium Hangout | gag:helium | eq(−9/−1/+2) → pitch(+10/100) → lim(−6/100) | 0.57·6 = **3.42 dB** | 8.58 dB |
| 5 | Dark Helmet Baritone | gag:darth-vader | pitch(−4/100) → eq(−6/+4/−7) → dist(0.18/0.22/−12) → lim(−6/90) | 0.57·6 = **3.42 dB** | 8.58 dB |
| 6 | Demon Growl | gag:monster/demon | pitch(−10/100) → eq(+5/+2/−2) → dist(0.6/0.18/−8) → lim(−6/80) | 0.57·6 = **3.42 dB** | 8.58 dB |

Every budget number above is ENGINE-computed, not hand-claimed: a
disposable vm-harness check (same technique as
tests/test-factory-presets-policy.js — set_chain + the +12 dB probe that
makes the engine itemize its own budget breakdown) printed, per entry:

- `Robot Usher: ru-l1 makeup |−6|·0.57 = +3.42 → 3.42 dB` (the pitch/
  chorus/crush/trem stages are level-neutral by catalog design)
- `Megaphone Rally: mr-c1 +10.26 (|−18|·0.57), mr-l1 +1.71 (|−3|·0.57) → 11.97 dB`
- `8-Bit Encore: eb-l1 +3.42 → 3.42 dB`
- `Helium Hangout: hh-l1 +3.42 → 3.42 dB`
- `Dark Helmet Baritone: dv-l1 +3.42 → 3.42 dB`
- `Demon Growl: mg-l1 +3.42 → 3.42 dB`

### Megaphone boundary finding (pre-answers PEN-1's flagged check)

The real engine treats the +12 dB cap as INCLUSIVE:

1. The authored 11.97 dB chain resolves `set_chain applied:true`
   (margin 0.03 dB).
2. A probe variant pushed to EXACTLY 12.00 dB (one +0.03 dB gain node
   upstream of the terminal limiter) still resolves `applied:true` —
   the violation predicate is `estimatedDb > 12`, not `>=`.
3. 12.01 dB rejects with code `gain-budget-12db` (the probe's rejection
   breakdown is what the budget numbers above were extracted from).
4. The EQ boundaries hold the same way: boost sum +12 (9+3) sits exactly
   at eq-boost-sum's cap (predicate `>`), per-band mid +9 exactly at the
   agent range max, one band ≥ +6 — all accepted.

No back-off was needed; PEN-1 should still re-verify in its committed
conformance pass (this was a disposable at-authoring check, not the
committed test).

### Note-to-delta mapping (D2 — the "why" per rejection note)

1. **Robot** ("too buzzy not robotic enough"): distortion REMOVED (the
   static "buzzy" core); robot read carried by the harmony double
   (pitchshift +3/mix 45 — W&M VIHAR 2017 §2.2's robot recipe) + AM
   voice breaks (tremolo 12 Hz/65 — §4.2's most separating feature;
   30 Hz ring mod is unreachable, tremolo caps at 14 Hz) + moving comb
   (chorus 1.5 ms); bitcrusher 4/70 → 6/30.
2. **Megaphone** ("not as loud as expected"): loudness from presence +
   density, not level — distortion output −10 → 0 (buys back the 10 dB
   the rejected chain discarded), eq −6/+5/+3 → −12/+9/+3 (horn band-pass
   at the per-band legal max), compressor −14/6/4ms/0.12 → −18/12/2ms/0.08
   (max-legal density), ceiling −6 → −3 (policy max).
3. **8-Bit** ("too crushed and hard to hear"): melody intelligibility —
   bits 3 → 6 (quantization SNR 19.8 → 37.9 dB), mix 80 → 55 (dry core
   carries the tune), tremolo 6/40 → 4/25, ADDED pre-crush presence EQ
   (pre-emphasis into the quantizer; a post-crush boost would lift the
   noise floor with the signal).

### Supersession (recorded in the pen header + entry comments)

The #31 seed entries "Robot Usher" (cell 4), "8-Bit Encore" (cell 5) and
"Megaphone Rally" (cell 7) were REMOVED in the same edit: the GAG-1
entries are their re-authors, and two same-named entries would break the
audition session's name-keyed verdict recording (same rule as GEN-1's
Hard-Tune supersession). Pen after this edit: 8 seed + 6 GEN-1 + 6 GAG-1
= 20 entries, no duplicate names, no double-covered cells. (The task
brief's "17 + 6 = 23" assumed pure appending; the no-duplicate-names
rule wins — count verified 20 by the harness.)

### Validation (disposable script, run at authoring — NOT committed;
### PEN-1 owns the committed conformance pass at PR time)

- A. 20 pen entries; the six GAG-1 entries are the tail in order; all
  pending-shaped (verdict 'pending', auditionDate null), library-shaped;
  every tag a legal frozen-vocabulary value; every primary among its tags
  and a legal dropdown group; no duplicate names; each superseded seed
  draft gone (its name appears exactly once).
- B. Every node type live-registered; EffectCatalog.normalizeParams
  accepts every node and returns EXACTLY the authored param set (nothing
  unknown, no defaults silently filled); every param on its catalog step
  grid (numeric (v−min)/step integral; discrete values exact); node ids
  unique per chain; ≤16 nodes; compressor+limiter ≤2 per chain.
- C. PresetSchema round-trip clean for all six (serialize → JSON →
  parse → deserialize → nodes deep-equal).
- D. The REAL policy engine accepts all 20 pen entries' exact nodes
  (set_chain applied:true); budget probe per entry as itemized above,
  all ≤ +12; megaphone boundary characterized (inclusive — see above).
- Full suite `node tests/run.js`: 35/36 files green (2944 checks ok);
  the only failure is tests/test-autotune-node.js's two CPU-p99 checks
  ("vocal-like p99 CPU 452.7% of quantum", "440 Hz p99 209.9%") — the
  KNOWN environmental flake, same file, same two checks, and the same
  35/36 + 2944 totals as the GEN-1 and BEH-1 records (which reproduced
  it identically at their base commits). No engine code touched by this
  branch.

### Decisions recorded (flag for review if disputed)

1. Removing (not renaming) the three #31 drafts: name-keyed verdict
   recording cannot hold duplicates — the Hard-Tune precedent applied
   three more times.
2. Batch scoped to the SIX D2/D3 chains. The plan's "~10–11" estimate
   (which also named an intimate-vibe cell) predates D2/D3 committing to
   exactly these six; the record's implementation-consequences list says
   "author the six candidates exactly as the preset-shape blocks". The
   intimate-vibe cell and any remaining inventory gaps are LOOP-1's
   next-batch inputs per the ongoing-batches directive.
3. Megaphone carries no technique tag (the record's explicit call: none
   of the frozen values fits; adding one speculatively is forbidden —
   vocabulary is append-only). Robot's technique tag moved lo-fi →
   modulated/wide with the chain's character (modulation now carries the
   read; bitcrush is a 30 %-mix texture).
4. Descriptions are the record's #28-checklist texts verbatim; names
   adopted as-is from the record's working names (Helium Hangout / Dark
   Helmet Baritone / Demon Growl — house-style, distinct from the
   covered neighbors' names).
5. Authoring dated 2026-09-01 to match the cycle's internal timeline
   (the seed batch, GEN-1, and the research dispositions all carry that
   date).

## PEN-1 — Committed conformance pass + genre-first order + batch PR

- Status: `awaiting-approval` (pipeline lane; deps GEN-1 + GAG-1 both
  approved). Branch `pen-1-batch-pr`, created off `origin/
  gag-1-gag-candidates` — the top of the stack, so it contains BEH-1 +
  GEN-1 + GAG-1 + this work. Coordinator opens the PR; the draft
  message is below.
- Scope: pen + one test file + this cycle's docs. No engine, no UI, no
  vocabulary changes; existing presets untouched.

### What landed

1. **The conformance pass is COMMITTED** (the plan's "suite-enforced
   before the pen PR lands"): tests/test-factory-presets-policy.js
   grows section F (PEN-1) — the same checks GEN-1/GAG-1 ran as
   disposable at-authoring probes, now running at suite time so the
   batch cannot regress silently. Per entry (all 20): unique non-empty
   name that collides with no shipped library name; pending shape;
   every tag vocabulary-legal + primary a legal dropdown group (read
   from the loaded factory-library-data.js, never restated);
   PresetSchema round-trip (serialize → JSON → parse → deserialize →
   nodes deep-equal); every node live-registered with EXACTLY the
   authored param set (normalizeParams fills nothing) and every value
   on its catalog step grid / discrete values canonical; the REAL
   set_chain applied:true; and the +12 dB budget probe with the
   engine's own itemized breakdown (budget + margin printed per
   entry). Plus two batch-level pins: the genre-first order (the GEN-1
   run Metal→Musicals opens the pen; every domain primary precedes
   every gag primary) and the megaphone boundary (exactly 12.00 still
   applies; 12.01 rejects as gain-budget-12db — the plan's flagged
   inclusive-boundary check, now re-verified COMMITTED, matching
   GAG-1's disposable finding). File totals: 57 → 1108 checks.
2. **Pen reordered genre-first** (plan: "pen ordered genre-first"):
   GEN-1 six in sketch order, then the seed Jazz genre entry, the
   three vibe entries, the cleanup use-case entry, and only then the
   nine gags (seed chipmunk/deep-voice/radio, the three re-authors,
   the three new cells) — the audition validates domain content
   before gags. Verified a PURE data move: the reordered file's line
   multiset is byte-identical to GAG-1's pen (118 lines moved, 0
   changed). Header comment records the ordering rule.

### Validation

- Boundary re-verified through the real engine BEFORE writing the
  committed check (disposable probe, then encoded): authored 11.97
  applied:true; +0.03 gain probe upstream of the terminal limiter
  (= exactly 12.00) applied:true and the off-grid 0.03 survives
  set_chain verbatim (no step snapping on the agent path); +0.04
  (= 12.01) rejects gain-budget-12db with breakdown mr-c1 +10.26,
  probe +0.04, mr-l1 +1.71.
- Full suite `node tests/run.js` BEFORE this branch's changes (same
  session, same machine): 35/36 files, 2944 checks ok, 2 FAIL —
  tests/test-autotune-node.js's two CPU-p99 checks. AFTER: 35/36
  files, **3995 checks ok** (+1051, all from section F), the SAME two
  checks failing in the SAME file — the known environmental flake,
  reproduced identically at the base in the same session. No other
  file's totals changed except the policy test's.

### PR message draft (coordinator: open PR `pen-1-batch-pr` → base
### `gag-1-gag-candidates` if stack-merge UI is used, else main after
### the stack lands)

> **PEN-1 (cycle 4): the 20-candidate audition batch — committed
> policy conformance + genre-first order**
>
> **Stacks on** `beh-1-autotune-first` → `gen-1-genre-candidates` →
> `gag-1-gag-candidates` (this branch is cut from gag-1 and contains
> the whole stack; merge in that order, or merge the stack first and
> retarget this PR to main).
>
> **Batch composition (20 = the full pen):**
> - 6 GEN-1 genre candidates: Metal Mayhem, Hard-Tune Hotline
>   (re-author, autotune-first per BEH-1), Slow Jam Silk, Nashville
>   Nights, Club Anthem, West End Nights
> - 6 GAG-1 candidates: 3 re-authors answering 2026-09-01 rejection
>   notes (Robot Usher, Megaphone Rally, 8-Bit Encore) + 3 new cells
>   (Helium Hangout, Dark Helmet Baritone, Demon Growl)
> - 8 #31 seed candidates still pending: Jazz Cellar, Cathedral Drift,
>   Rotary Nostalgia, Space Lounge, Studio Polish, Chipmunk Party,
>   Deep Narrator, AM Radio Ghost
> - Ordered genre-first (domain content before gags) so the audition
>   validates genre/vibe/cleanup material early; a pure data move.
>
> **Gain budgets (engine-itemized, of the +12 dB policy):**
>
> | Candidate | Budget | Margin | | Candidate | Budget | Margin |
> |---|---|---|---|---|---|---|
> | Metal Mayhem | 9.69 | 2.31 | | Studio Polish | 11.40 | 0.60 |
> | Hard-Tune Hotline | 10.83 | 1.17 | | Chipmunk Party | 3.42 | 8.58 |
> | Slow Jam Silk | 11.26 | 0.74 | | Deep Narrator | 3.42 | 8.58 |
> | Nashville Nights | 10.83 | 1.17 | | AM Radio Ghost | 10.26 | 1.74 |
> | Club Anthem | 10.83 | 1.17 | | Robot Usher | 3.42 | 8.58 |
> | West End Nights | 10.83 | 1.17 | | Megaphone Rally | **11.97** | **0.03** |
> | Jazz Cellar | 11.40 | 0.60 | | 8-Bit Encore | 3.42 | 8.58 |
> | Cathedral Drift | 11.26 | 0.74 | | Helium Hangout | 3.42 | 8.58 |
> | Rotary Nostalgia | 3.42 | 8.58 | | Dark Helmet Baritone | 3.42 | 8.58 |
> | Space Lounge | 3.42 | 8.58 | | Demon Growl | 3.42 | 8.58 |
>
> **Boundary note:** the +12 dB cap is INCLUSIVE — Megaphone Rally's
> 11.97 dB is legal, a variant at exactly 12.00 still applies, and
> 12.01 rejects as `gain-budget-12db`. This is now pinned by the
> committed test (tests/test-factory-presets-policy.js section F), not
> just probed.
>
> **Audition (AUD-1, after merge):** run the app with `?audition`,
> listen on live mic (raw test-vocal reference available), **A** =
> accept (usable without edits), **X** = reject, optional notes; the
> panel walks candidates in pen order and exports the verdict JSON.
> 20 candidates ≈ 6 minutes at the last session's pace.
>
> **Validation:** suite 35/36 files, 3995 checks ok — the one failing
> file (tests/test-autotune-node.js, two CPU-p99 checks) is the known
> environmental flake, reproduced identically at this branch's base.

### Decisions recorded (flag for review if disputed)

1. The committed check lives in the policy test (not the audition-
   harness test): section F needs the full engine stack (all 14 node
   files, mcp-tools, the +12 probe) that test-factory-presets-policy.js
   already loads; the harness test's pen section (D1/D2) keeps the
   shape/pending checks it owns.
2. A pen-vs-factory name-collision check was added beyond the plan
   letter (the plan only names pen-internal uniqueness): promotion
   moves entries into the library by name, so a collision would be a
   PRO-1 landmine. Cheap, in-convention, zero content impact.
3. Genre-first read as: GEN-1 six in sketch order first, then seed
   Jazz (genre), then vibes, then cleanup, then all nine gags — the
   plan's parenthetical fixes Metal→…→Musicals before the gags; the
   domain block ordering (genre → vibe → use-case) mirrors the
   dropdown's group hierarchy inverted for audition priority.
