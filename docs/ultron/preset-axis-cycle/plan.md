# Cycle 4 Plan — Preset Library Shape-Out + Axis Cataloging

Source: [town-hall.md](town-hall.md) (cycle 4, approved 2026-09-01).
Artifacts stay in `docs/ultron/preset-axis-cycle/`. Statuses live in the
task index below; `state.md` is the cursor; `production-log.md` the evidence
trail.

## Fixed by scope (do not re-litigate)

- One full-coverage pen batch (~16–17 candidates): 13 uncovered cells +
  re-authored robot/megaphone/8-bit gags addressing their 2026-09-01 notes.
- Autotune-first: default insert position FRONT of chain (user can move);
  palette + agent paths; no other ordering-policy changes.
- Vocabulary frozen (append-only stands); descriptions only; no UI/Booth/
  agent-payload changes; no retagging; existing 14 presets byte-stable.
- Pipeline discipline: PR-only, pen → user audition (`?audition`) →
  promotion edit; ongoing batches after this one.
- All candidates policy-conformant at authoring (gain budgets, schema,
  catalog param ranges) — suite-enforced before the pen PR lands.

## Research queue (→ deep-research-swarm)

| RQ | Question (answerable, task-tied) | Ties to | Blocking? | Status |
|----|----------------------------------|---------|-----------|--------|
| RQ-1 | What are the evidence-backed vocal-chain idioms (EQ tilt, compression character, reverb/delay amounts, effect use) for Metal, Rap/Hip-Hop, R&B/Soul, Country, Dance/EDM, and Musicals live/karaoke contexts — each expressible in this app's 14 node types within the published gain-budget policy? | GEN-1 | **yes** (genre cells) | **COMPLETE** → D1 |
| RQ-2 | Given the rejection notes — robot ("too buzzy not robotic enough": what param combination reads robotic rather than buzzy — ring-mod character via detune/chorus vs distortion drive/tone curves), megaphone ("not as loud as expected": max loudness within gain-budget policy — where does perceived loudness come from: midrange presence vs level), 8-bit ("too crushed, hard to hear": bits/mix/tremolo settings that keep melody intelligible) — what param deltas address each note? | GAG-1 | informs | **COMPLETE** → D2 |
| RQ-3 | Never-authored gag cells — helium, darth-vader, monster/demon: what param combos (pitchshift range + character filters) produce each distinct from the covered chipmunk/deep-voice cells? | GAG-1 | informs | **COMPLETE** → D3 |

### Dispositions (D1–D3)

Records: `research/rq1-genre-idioms.md` (RQ-1),
`research/rq2-gag-reauthoring.md` (RQ-2/RQ-3).

- **D1 — COMMITTED-BY-PLAN-AUTHORITY** (RQ-1 complete): GEN-1 unblocked —
  author the six genre candidates from the chain sketches in
  `research/rq1-genre-idioms.md`. Sketch budgets land at 9.69–11.26 dB
  (inside the published gain-budget policy). Rap = autotune-first: key C /
  scale Chromatic / retune 5 ms (OQ-4 resolved). Caveat carried into
  authoring: the fixed plate IR and 3-band EQ make the idioms
  approximations — AUD-1 audition tunes the final values.
- **D2/D3 — COMMITTED-BY-PLAN-AUTHORITY** (RQ-2/RQ-3 complete): GAG-1
  unblocked. Robot re-author = drop distortion; pitchshift(+3, mix 45) +
  chorus(1.5 ms/6 Hz/30) + tremolo(12 Hz/65) + bitcrusher(6/30).
  Megaphone = eq(−12/+9/+3) → distortion(0.5/0.45/0) →
  comp(−18/12/0.002/0.08) → limiter(−3/50) at an 11.97 dB gain budget.
  8-bit = 6 bits/mix 55 + pre-crush presence EQ + tremolo(4/25). New
  gags: helium(+10, thin −9/−1/+2); vader(−4, dry mid-band intercom
  +0.18 drive); monster(−10, drive 0.6/tone 0.18). Record:
  `research/rq2-gag-reauthoring.md`; single-knob fallbacks are
  pre-planned there.
- **Disposition basis**: D1–D3 committed by plan authority — the user was
  unanswered on the individual decision matrix; AUD-1 audition remains
  the binding content gate.

## Tasks by lane

### Research lane

- **RES-1 — Genre idioms track** *(medium)* — status: `complete`
  RQ-1 dispatched; record under `research/rq1-genre-idioms.md`. Output: per
  genre, a concrete chain sketch (types + param ranges) mapped to the app's
  catalog, with sources. Deps: none. **Blocks GEN-1.** Disposition: D1
  (above) — record landed; GEN-1 unblocked.

- **RES-2 — Gag re-authoring + new-gag track** *(medium)* — status: `complete`
  RQ-2 + RQ-3; record under `research/rq2-gag-reauthoring.md`. Output: param
  deltas for robot/megaphone/8-bit vs their rejected versions, and sketches
  for helium/darth-vader/monster-demon distinct from chipmunk/deep-voice.
  Deps: none. Informs GAG-1. Disposition: D2/D3 (above) — record landed;
  GAG-1 unblocked.

### Behavior lane

- **BEH-1 — Autotune-first insert rule** *(medium)* — status: `completed` (user-approved 2026-09-01, branch beh-1-autotune-first bea5cca)
  OQ-3 semantics resolved at build: palette chip + agent `add_node` insert
  autotune at chain FRONT (before all non-anchor nodes; terminal limiter
  policy untouched; user reorder afterwards unchanged). Touches the add
  path (EffectCatalog/chain-editing insert logic), NOT audio code.
  Acceptance: palette add + agent add both front-insert; explicit test for
  both paths; drag-reorder still free; existing insert semantics for all
  other types unchanged; suite green. Ships as its own PR BEFORE the batch
  PR (the Hard-Tune candidate depends on it). Deps: none. Parallel with
  RES-1/RES-2. Evidence: branch `beh-1-autotune-first` — the rule defined
  once as `EffectCatalog.insertsAtFront` and consumed by `addNodeType()`
  (palette) and `planAddNode()` (agent omitted-position default); suite
  37/38 (the one failing file is the known autotune CPU p99 environmental
  flake — reproduced identically at the base commit); entry in
  `production-log.md`.

### Content lane

- **GEN-1 — Genre candidates (6)** *(medium)* — status: `awaiting-approval`
  (branch `gen-1-genre-candidates`, authored 2026-09-01 per D1)
  Author Metal / Rap-Hip-Hop / R&B-Soul / Country / Dance-EDM / Musicals
  candidates per RES-1 sketches; Rap cell includes hard-tune technique tag
  (re- authors Hard-Tune Hotline under the new autotune-first behavior —
  OQ-4 defaults resolved in production against RES-1's rap idiom).
  House-style descriptions (#28 checklist). Deps: RES-1, BEH-1 (rap only).
  Authoring source: the sketches in `research/rq1-genre-idioms.md` (D1).
  Evidence: six entries appended to the pen — Metal Mayhem 9.69 dB,
  Hard-Tune Hotline re-author 10.83 dB (autotune first; OQ-4 = key C /
  Chromatic / retune 5 ms / mix 100; the #31 cell-1 draft removed in the
  same edit so the cell is not double-covered), Slow Jam Silk 11.26 dB,
  Nashville Nights 10.83 dB, Club Anthem 10.83 dB (one catalog-forced
  adjustment: throw 380 ms — the sketch's 375 ms is off the delay step-10
  grid), West End Nights 10.83 dB. Disposable policy check: all six
  set_chain-applied + PresetSchema round-trip clean, budgets
  engine-computed per entry; suite green except the known autotune CPU
  p99 flake (reproduced identically at base). Per-entry budget table in
  `production-log.md`.

- **GAG-1 — Gag + vibe candidates (~10–11)** *(medium)* — status:
  `awaiting-approval` (branch `gag-1-gag-candidates`, stacked on
  `gen-1-genre-candidates`)
  (unblocked per D2/D3 — RES-2 complete)
  Re-authored robot/megaphone/8-bit (notes addressed, delta reviewable) +
  helium/darth-vader/monster-demon (distinct per RQ-3) + intimate vibe +
  any remaining uncovered cells from the inventory. Deps: RES-2.
  Authoring source: `research/rq2-gag-reauthoring.md` (D2/D3).
  Landed scope: the SIX D2/D3 chains (the record's authoring instruction —
  the "~10–11" estimate predates D2/D3 committing to six; the intimate-vibe
  cell and any remaining inventory gaps are LOOP-1's next-batch inputs, per
  the ongoing-batches directive). The three re-authors supersede the #31
  cell-4/5/7 drafts (removed in the same edit, Hard-Tune rule); pen now
  20 entries, no duplicate names. Budgets engine-computed 3.42–11.97 dB;
  megaphone boundary verified inclusive through the real engine (see
  production-log GAG-1). Suite 35/36 — the known autotune CPU-p99 flake.

- **PEN-1 — Policy check + pen PR** *(small)* — status: `blocked` (GEN-1, GAG-1)
  All candidates policy-validated (schema round-trip, catalog param ranges,
  gain budgets via the real engine — reuse the conformance test pattern);
  pen ordered genre-first; PR opened (no direct main push); suite green.
  Acceptance: conformance checks pass for every candidate; PR up.
  Deps: GEN-1, GAG-1. Note (from D2/D3): must verify the gain-budget ≤
  boundary is inclusive — megaphone sits at 11.97 dB, 0.03 dB margin.
  GAG-1 pre-answer (real engine, disposable probe): the cap IS inclusive —
  11.97 applied:true, a pushed-to-exactly-12.00 variant still applied:true,
  12.01 rejects as gain-budget-12db; PEN-1 still re-verifies in the
  committed conformance pass.

### Audition/promotion lane (user-owned steps)

- **AUD-1 — User audition at `?audition`** *(user, minutes)* — status: `blocked` (PEN-1)
  User listens (A/X + notes) on their machine; exports verdict JSON.
  Deps: PEN-1 merged.

- **PRO-1 — Promotion edit** *(medium)* — status: `blocked` (AUD-1)
  Verdicts processed per the pen's step-3 procedure (same as 2026-09-01):
  accepted → library with provenance, rejected → removed w/ notes in PR
  record; same-edit test updates; coverage report against the axis map.
  Deps: AUD-1 verdicts.

- **LOOP-1 — Next-batch prep** *(small)* — status: `blocked` (PRO-1)
  Coverage delta recorded (cells still open after this audition, new
  rejection notes); next batch's authoring inputs queued. This is the
  repeatable loop's first turn — size the next batch from real gaps only.
  Deps: PRO-1.

## Dependency-ordered task index

| Order | Task | Deps | Size |
|---|---|---|---|
| 1 | RES-1 | — | medium |
| 2 | RES-2 | — | medium |
| 3 | BEH-1 | — | medium |
| 4 | GEN-1 | RES-1 (+BEH-1 for rap) | medium |
| 5 | GAG-1 | RES-2 | medium |
| 6 | PEN-1 | GEN-1, GAG-1 | small |
| 7 | AUD-1 | PEN-1 | user |
| 8 | PRO-1 | AUD-1 | medium |
| 9 | LOOP-1 | PRO-1 | small |

## Milestones

- **M1 — Behavior + evidence in**: BEH-1 merged (autotune-first live) +
  both research records landed. The batch is now authorable without
  guesswork.
- **M2 — Pen PR up**: full batch authored, policy-checked, PR open. User
  can audition any time after merge.
- **M3 — First full audition closed**: promotion merged, coverage report
  published (target: every axis value covered; gaps documented with
  reasons).
- **M4 — Loop turned once**: LOOP-1 records the next batch's inputs. Cycle
  acceptance follows; subsequent batches run under the same pattern
  without a new cycle each time.

## Handoff

- **Build order**: as the index — research + behavior in parallel first
  (M1), then content, then the pipeline's user-owned steps.
- **Fixed by scope**: listed above.
- **Delegated to deep-research**: RQ-1 (blocking), RQ-2/RQ-3 (informing) —
  all complete; dispositions D1–D3 committed by plan authority (see
  "Dispositions" above; AUD-1 remains the binding content gate).
- **Return-to-town-hall triggers**: if RQ-1 finds a genre cell cannot be
  expressed within the published gain-budget policy (scope/policy
  conflict); if autotune-first turns out to require chain-policy changes
  beyond insert position; if the user wants vocabulary growth (real
  unmatched requests surface).
- **Approval needed before research begins**: approval of this plan, then
  RQ-1/RQ-2/RQ-3 dispatch to deep-research-swarm.
