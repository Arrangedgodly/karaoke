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

| RQ | Question (answerable, task-tied) | Ties to | Blocking? |
|----|----------------------------------|---------|-----------|
| RQ-1 | What are the evidence-backed vocal-chain idioms (EQ tilt, compression character, reverb/delay amounts, effect use) for Metal, Rap/Hip-Hop, R&B/Soul, Country, Dance/EDM, and Musicals live/karaoke contexts — each expressible in this app's 14 node types within the published gain-budget policy? | GEN-1 | **yes** (genre cells) |
| RQ-2 | Given the rejection notes — robot ("too buzzy not robotic enough": what param combination reads robotic rather than buzzy — ring-mod character via detune/chorus vs distortion drive/tone curves), megaphone ("not as loud as expected": max loudness within gain-budget policy — where does perceived loudness come from: midrange presence vs level), 8-bit ("too crushed, hard to hear": bits/mix/tremolo settings that keep melody intelligible) — what param deltas address each note? | GAG-1 | informs |
| RQ-3 | Never-authored gag cells — helium, darth-vader, monster/demon: what param combos (pitchshift range + character filters) produce each distinct from the covered chipmunk/deep-voice cells? | GAG-1 | informs |

## Tasks by lane

### Research lane

- **RES-1 — Genre idioms track** *(medium)* — status: `pending`
  RQ-1 dispatched; record under `research/rq1-genre-idioms.md`. Output: per
  genre, a concrete chain sketch (types + param ranges) mapped to the app's
  catalog, with sources. Deps: none. **Blocks GEN-1.**

- **RES-2 — Gag re-authoring + new-gag track** *(medium)* — status: `pending`
  RQ-2 + RQ-3; record under `research/rq2-gag-reauthoring.md`. Output: param
  deltas for robot/megaphone/8-bit vs their rejected versions, and sketches
  for helium/darth-vader/monster-demon distinct from chipmunk/deep-voice.
  Deps: none. Informs GAG-1.

### Behavior lane

- **BEH-1 — Autotune-first insert rule** *(medium)* — status: `pending`
  OQ-3 semantics resolved at build: palette chip + agent `add_node` insert
  autotune at chain FRONT (before all non-anchor nodes; terminal limiter
  policy untouched; user reorder afterwards unchanged). Touches the add
  path (EffectCatalog/chain-editing insert logic), NOT audio code.
  Acceptance: palette add + agent add both front-insert; explicit test for
  both paths; drag-reorder still free; existing insert semantics for all
  other types unchanged; suite green. Ships as its own PR BEFORE the batch
  PR (the Hard-Tune candidate depends on it). Deps: none. Parallel with
  RES-1/RES-2.

### Content lane

- **GEN-1 — Genre candidates (6)** *(medium)* — status: `blocked` (RES-1)
  Author Metal / Rap-Hip-Hop / R&B-Soul / Country / Dance-EDM / Musicals
  candidates per RES-1 sketches; Rap cell includes hard-tune technique tag
  (re- authors Hard-Tune Hotline under the new autotune-first behavior —
  OQ-4 defaults resolved in production against RES-1's rap idiom).
  House-style descriptions (#28 checklist). Deps: RES-1, BEH-1 (rap only).

- **GAG-1 — Gag + vibe candidates (~10–11)** *(medium)* — status: `blocked` (RES-2)
  Re-authored robot/megaphone/8-bit (notes addressed, delta reviewable) +
  helium/darth-vader/monster-demon (distinct per RQ-3) + intimate vibe +
  any remaining uncovered cells from the inventory. Deps: RES-2.

- **PEN-1 — Policy check + pen PR** *(small)* — status: `blocked` (GEN-1, GAG-1)
  All candidates policy-validated (schema round-trip, catalog param ranges,
  gain budgets via the real engine — reuse the conformance test pattern);
  pen ordered genre-first; PR opened (no direct main push); suite green.
  Acceptance: conformance checks pass for every candidate; PR up.
  Deps: GEN-1, GAG-1.

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
- **Delegated to deep-research**: RQ-1 (blocking), RQ-2/RQ-3 (informing).
- **Return-to-town-hall triggers**: if RQ-1 finds a genre cell cannot be
  expressed within the published gain-budget policy (scope/policy
  conflict); if autotune-first turns out to require chain-policy changes
  beyond insert position; if the user wants vocabulary growth (real
  unmatched requests surface).
- **Approval needed before research begins**: approval of this plan, then
  RQ-1/RQ-2/RQ-3 dispatch to deep-research-swarm.
