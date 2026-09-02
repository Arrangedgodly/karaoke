# Ultron State — Cycle 4: Preset Library Shape-Out + Axis Cataloging

Home: docs/ultron/preset-axis-cycle/ (kept out of docs/ultron top level —
the brother's redesign flow owns those files; a collision was caught and
reverted 2026-09-01 before any committed damage).

## Current Phase
`town-hall` — brief assembled 2026-09-01; all clusters individually signed
off (Q1–Q7 approved as recommended + the user's ongoing-batches directive).
Awaiting final record confirmation, then `$plan-it-out`.

## Active Task
**PEN-1 (policy check + pen PR) — status `awaiting-approval`** on branch
`pen-1-batch-pr` (cut from `origin/gag-1-gag-candidates`, so it carries
the full stack BEH-1 → GEN-1 → GAG-1; PR-only pipeline; coordinator opens
the PR — message draft in production-log.md's PEN-1 entry). The
conformance pass is now COMMITTED: tests/test-factory-presets-policy.js
section F runs at suite time over all 20 pen entries (schema round-trip,
catalog grid + exact param sets, vocabulary-legal tags, unique +
non-colliding names, REAL set_chain applied:true, engine-itemized
budgets ≤ +12) and pins the genre-first order plus the megaphone
boundary (12.00 applies / 12.01 rejects — inclusive, matching GAG-1's
disposable finding). Pen reordered genre-first (GEN-1 Metal→Musicals
run, seed Jazz, vibes, cleanup, then the nine gags) as a verified PURE
data move. Suite before (this session, at base): 35/36 files, 2944
checks ok; after: 35/36, 3995 ok (+1051) — the one fail is the known
autotune CPU p99 environmental flake, identical file/checks both runs.
Next unblocked after merge + approval: AUD-1 (user audition at
`?audition`).

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

### GAG-1: landed 2026-09-01, status `awaiting-approval` (branch
`gag-1-gag-candidates`, stacked on `gen-1-genre-candidates`). Six
D2/D3 chains in the pen; megaphone boundary pre-answered for PEN-1
(inclusive). Next: PEN-1.

### GAG-1: APPROVED 2026-09-01 (user auditions later). Boundary finding: +12 cap
INCLUSIVE (12.00 applies, 12.01 rejects). Pen = 20 candidates. Next: PEN-1.

### PEN-1: landed 2026-09-01, status `awaiting-approval` (branch
`pen-1-batch-pr`, stacked on `gag-1-gag-candidates`). Committed
conformance pass (policy test section F) + genre-first pen order + PR
message draft in the production log. Next: PR merge, then AUD-1.

### PEN-1: APPROVED 2026-09-01 (user ready to audition). AUD-1 ACTIVE.
Merge note: origin/main (wayfinder #46–49, PRs #56–59) merged into local
main alongside the batch stack; only cycle-doc conflicts, resolved keeping
both records. AUD-1: user auditioning the 20-candidate pen at ?audition.

### PRO-1 (seed-batch promotion): LANDED 2026-09-01, scale-out Lane B.
The 2026-09-01 live audition closed the #31 seed batch — 8 accepted, 4
rejected. The promotion edit was written on `promote-seed-batch-auditions`
but never PR'd, so it was rebased onto `main` here and opened as
`lane-b/promote-seed-batch` (scale-out plan D-1, gate 1). Library 6 → 14;
pen 20 → 12 (the eight accepted seed entries removed — the four rejected
ones had already been superseded on `main` by the GEN-1/GAG-1 re-authors
that reuse their names). Same-edit counts: `test-factory-library.js` A1
6 → 14 plus the six promoted node types in its load list,
`test-factory-presets-policy.js` B1 6 → 14 and `EXPECTED_PEN` 20 → 12,
`test-preset-cycle3.js` G2 6 → 14. The three cycle-4 records that existed
only on the stranded branch — `research/rq1-genre-idioms.md`,
`research/rq2-gag-reauthoring.md`, `town-hall.md` — are carried along,
since the GEN-1/GAG-1 candidates on `main` were authored from them. Suite
38/38, 4151 checks, all green (4186 at base; the delta is the eight
promoted candidates' per-entry pen checks giving way to the cheaper
library checks). Next: the `summary` field (D-13), then the agent
surface (D-2/D-12).

### PRO-2 (scale-out promotion): LANDED 2026-09-02, a day ahead of the
plan's Sep-3 window (the user auditioned early). The 2026-09-02 live
audition at `?audition` decided ALL TWENTY pen candidates — the PEN-1
twelve (six GEN-1 genre, six GAG-1 gag) and the LC-1 corpus eight.
NINETEEN ACCEPTED, promoted into `src/factory-library-data.js` nodes
verbatim with provenance filled (verdict accepted, auditionDate
2026-09-02): Metal Mayhem, Hard-Tune Hotline, Slow Jam Silk, Nashville
Nights, Club Anthem, West End Nights, Robot Usher, Megaphone Rally,
8-Bit Encore, Helium Hangout, Dark Helmet Baritone, Demon Growl, Chart
Topper, Pitch Safety Net, Noraebang Echo, Close-Up Whisper, Hiss
Rescue, Room Announcer, Double Track. ONE REJECTED: Podcast Warmth
('too much reverb' — the C6 corpus request stays unanswered; a
re-author with less wash is the next batch's call under D-3). The
verdict JSON stayed on the audition machine (never exported); the
verdicts were relayed by the user directly and are recorded in the pen
header — the binding record for a rejection is the header + this entry.
These twenty predate the summary requirement, so each promotee's
hand-written summary was composed at promotion from its own request
evidence (the RQ-1/RQ-2 sketches, the corpus rows the provenance
names). Library 14 → 33; pen 20 → 0 (empty array, Booth contract
preserved). Same-edit counts: `test-factory-library.js` A1 14 → 33 and
autotune + bitcrusher join its load list (now all fourteen types),
`test-factory-presets-policy.js` B1 14 → 33, `EXPECTED_PEN` 20 → 0 and
G1 14 → 33, `test-preset-cycle3.js` G2 14 → 33. Section F rework: the
batch-order pins (GEN-1 genre run, LC-1 contiguity, domain-before-gag)
retired with the decided batch; the D-3 evidence pin SURVIVES by
running over the seven LC-1 library promotees (count pinned at 7 — a
count of 8 would mean Podcast Warmth was promoted by mistake); the F8
megaphone +12-boundary characterization now reads Megaphone Rally from
the library. Remaining per the sequencing: deploy + VERIFY THE DEPLOYED
PAGE before the Sep-3 13:00 PT Devpost close.
