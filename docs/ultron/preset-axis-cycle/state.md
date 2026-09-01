# Ultron State — Cycle 4: Preset Library Shape-Out + Axis Cataloging

Home: docs/ultron/preset-axis-cycle/ (kept out of docs/ultron top level —
the brother's redesign flow owns those files; a collision was caught and
reverted 2026-09-01 before any committed damage).

## Current Phase
`town-hall` — brief assembled 2026-09-01; all clusters individually signed
off (Q1–Q7 approved as recommended + the user's ongoing-batches directive).
Awaiting final record confirmation, then `$plan-it-out`.

## Active Task
**GEN-1 (six genre candidates) — status `awaiting-approval`** on branch
`gen-1-genre-candidates` (PR-only pipeline; coordinator handles push/PR).
Six pen entries authored from the RQ-1 sketches (D1): Metal Mayhem
9.69 dB · Hard-Tune Hotline re-author 10.83 dB (autotune-first, OQ-4 =
C/Chromatic/5 ms/mix 100; supersedes the #31 cell-1 draft, removed in
the same edit) · Slow Jam Silk 11.26 dB · Nashville Nights 10.83 dB ·
Club Anthem 10.83 dB (throw 380 ms — 375 is off the delay step grid) ·
West End Nights 10.83 dB. Disposable policy check: all six
set_chain-applied + schema round-trip clean, budgets engine-computed;
suite 35/36 (the one fail is the known autotune CPU p99 environmental
flake — identical at the base commit). Per-entry budget table +
decisions in [production-log.md](production-log.md). Next unblocked:
GAG-1.

## Approvals
- Town-hall clusters: Q1 full-coverage batch (~16–17 candidates incl. 3
  re-auditioned gags) · Q2 autotune-first in scope (isolated rule) · Q3
  vocabulary frozen · Q4 descriptions only · Q5 success measures · Q6
  non-goals · Q7 one full batch (staging rejected). Ongoing-batches
  directive recorded.

## Open Decisions
- OQ-1 genre idioms (research, blocks genre cells)
- OQ-2 gag re-authoring params (research, informs)
- OQ-3 autotune-first exact semantics (planning, informs)
- OQ-4 hard-tune re-authoring defaults (production, non-blocking)

### Town-hall: APPROVED 2026-09-01 (final record confirmation, no corrections).
Phase: plan. Next: $plan-it-out.

## Plan (2026-09-01)
plan.md written via $plan-it-out: 9 tasks, 4 lanes, 4 milestones, research
queue RQ-1 (genre idioms, blocking) / RQ-2+RQ-3 (gag re-authoring + new
gags, informing). Phase gate: user plan approval.

### Plan: APPROVED 2026-09-01 (no targeted changes).
Phase: deep-research. Next: $deep-research-swarm on RQ-1/RQ-2/RQ-3.

## Deep Research Record (2026-09-01)
Both tracks complete: research/rq1-genre-idioms.md + research/rq2-gag-reauthoring.md.
Decisions D1 (six genre sketches, GEN-1 basis), D2 (robot harmony-double /
megaphone max-legal density 11.97 dB boundary / 8-bit 6-bit+presence),
D3 (helium +10 thin / vader −4 intercom / monster −10 growl): marked
COMMITTED-BY-PLAN-AUTHORITY — the user did not answer the individual
disposition questions; the approved plan already authorizes
research-informed authoring and the user's ?audition pass (AUD-1) is the
binding gate on all content. Ring-mod/tremolo-limitation caveat recorded;
single-knob fallbacks pre-planned in rq2. PEN-1 must verify the ≤-boundary
semantics for the megaphone budget.

## Behavior Record (2026-09-01)
BEH-1 autotune-first implemented on branch `beh-1-autotune-first`: the
rule defined once as `EffectCatalog.insertsAtFront` and consumed at the
two add chokepoints — `addNodeType()` (palette chip/keyboard) and
`planAddNode()` (agent add_node omitted-position default, explicit
position still honored). Autotune now ADDS at chain index 0 (still
upstream of the terminal limiter; limiter-only chain gets it before the
limiter); every other type keeps the existing insert semantics; reorder
afterwards unchanged. Tests: few3 F4, few4 J6, palette-cards BEH-1 block,
mcp-tools-cycle3 D-BEH1 (incl. set_chain round-trip through the real
policy). Suite 37/38 — test-autotune-node.js's two CPU-p99 checks are
the known environmental flake (reproduced identically at base 4aa6687).
Status: awaiting-approval; ships as its own PR before the batch PR.

### BEH-1: APPROVED 2026-09-01. Next: GEN-1 + GAG-1.

### GEN-1: APPROVED 2026-09-01 (user will audition the fx live later).
Next: GAG-1.
