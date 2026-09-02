# Scale-Out Batch — plan and lane briefs

Grilling session 2026-09-01/02. Successor to [plan.md](plan.md)'s LOOP-1
("size the next batch from real gaps only"). Every decision below was put to
the user and approved; nothing here is inferred.

Deadline: **Devpost closes 2026-09-03, 1:00 PM Pacific.**
Last-verdict cutoff: **2026-09-03, 8:00 AM Pacific.**

## Decisions (settled)

| # | Decision |
|---|---|
| D-1 | Land the orphaned promotion first. The 8 accepted seed candidates enter the library before any new audition. |
| D-2 | The one-call problem is a **surface** problem before it is a library problem. Fix the agent surface; grow the library. |
| D-3 | Admission bar: a candidate must name **the plain-language request it answers** and **why the closest existing preset fails it**. Cell coverage is evidence, not the bar. |
| D-4 | Batch target 50–100, breaks expected. **If the corpus and the bar conflict, the bar wins** — ship 40 real ones over 100 padded ones. |
| D-5 | Library outranks agent features for the submission. Three agents, split by lane. |
| D-6 | Booth gets persistence, resume-at-first-pending, filtering, and a revisit pass before the session. |
| D-7 | Corpus-first authoring; intensity variants only where the corpus shows real intensity requests. |
| D-8 | Vocabulary may **append values to existing axes** when the corpus proves a miss. **No new axes** this batch; axis-level pressure is logged for the next one. |
| D-9 | Lane split by role, not by content — the only ordering constraint is Landing before Authoring. |
| D-10 | Capability gaps are **logged, never approximated**. Exception: complaint metaphors ("tunnel", "tin can", "hiss on sss/fff") are servable anti-presets. |
| D-11 | Verdicts gain a third state: **defer**. The quality bar stays binary. |
| D-12 | `list_presets` returns a **compact index** (name + primary + ≤60-char summary). Input schemas stay frozen; `get_preset` carries the full description. |
| D-13 | The compact summary is an **explicit hand-written `summary` field**, not derived by truncation. |
| D-14 | Partial promotion at the cutoff. Whatever is judged, ships; the rest stays pending. |
| D-15 | ADR `docs/adr/0003-preset-first-agent-strategy.md` records the decision. (0002 is taken by failed-startup-recovery.) |

## Constraints the batch must respect

**Engine ceiling.** 14 node types, and three hard limits bound how many
*audibly distinct* presets can exist:

- **Reverb exposes only `mix`.** The impulse response is host-owned and fixed
  (`src/mcp-tools.js`, rule `host-reverb-internals`). Cathedral, Arena,
  Stadium, Cave and Big Room are the same plate at different wet percentages.
  Distinct venue presets cannot be authored.
- **EQ is 3 fixed bands** (200 Hz shelf / 1 kHz peak Q1.0 / 5 kHz shelf). No
  sweepable bandpass; telephone, megaphone, walkie-talkie and radio all reach
  for the same three knobs.
- **No harmony, no vocoder, no formant shift.** The prior art's entire
  "Harmony stack" family is unbuildable, and without formant shift helium and
  chipmunk are one pitchshift at two amounts.

Honest estimate: **40–60 distinct presets** at the "usable without edits" bar.
Past that, candidates become param variations that fail D-3. Capability gaps
found here are the most valuable output for the next cycle — they name which
*node type* to build, which is worth more than ten more presets.

**Single-file chokepoints.** `src/audition-candidates.js` holds one array, and
`tests/test-factory-presets-policy.js` section F hardcodes `EXPECTED_PEN` with
an explicit same-edit rule. Two lanes must not author into these at once.

**Orphaned work to rescue** (all unmerged, none PR'd):

| Branch / PR | Carries |
|---|---|
| `origin/promote-seed-batch-auditions` | the promotion edit (library 6 → 14, pen emptied) |
| same branch | `research/rq1-genre-idioms.md`, `research/rq2-gag-reauthoring.md`, `town-hall.md` |
| PR #35 `research/taxonomy-prior-art` | `docs/ultron/research/taxonomy-prior-art.md` (DRAFT) |

The 12 genre/gag candidates now on `main` were authored *from* records that are
not on `main`.

## Lane briefs

### Lane A — Booth (owns `src/audition-harness.js`)

Make a 50–100 candidate session survivable. Today the header states it plainly:
"Verdicts live in memory only: reload resets."

1. **Persist** verdicts to `localStorage` under the existing `?audition` gate.
   Key by candidate name (names are unique and test-pinned), so a pen edit
   cannot corrupt a stored verdict.
2. **Resume** at first-pending instead of always `index = 0`.
3. **Filter/jump** so an axis can be worked at a time (all gags, then genres).
4. **Defer** as a third verdict (D-11) — keeps the candidate pending, distinct
   from rejected. `VERDICT_VALUES` and the export shape both widen.
5. **Revisit pass** — re-hear a decided candidate and overwrite its verdict.
   This is the fatigue guard: 50–100 live-mic judgments is 1.5–2.5 hours of
   singing, and a late reject may be the voice, not the preset.

Constraints: stays inside the `?audition` gate (zero production bytes, zero
audio-path change); keeps the single real load path in `loadToBoard()`; export
stays provenance-shaped for the promotion edit. Extend
`tests/test-audition-harness.js`.

`CONTEXT.md`'s **Audition** / **Deferred candidate** entries are already
written — implement to match them.

### Lane B — Landing (owns `src/factory-library-data.js`, then the surface)

1. **Rebase `promote-seed-batch-auditions` onto `main`** and open the PR.
   Library 6 → 14; remove those 8 from the pen (pen 20 → 12); bump
   `EXPECTED_PEN` and the library count in the same edit, per the documented
   same-edit rule. Carry `rq1-genre-idioms.md`, `rq2-gag-reauthoring.md` and
   `town-hall.md` with it.
2. **Un-draft PR #35** so the corpus has a landed source.
3. **Add the `summary` field** (D-13): entry-shape addition in the data module,
   a ≤60-char conformance check, and a hand-written summary backfilled for all
   14 presets.
4. **Surface fix, gated on 1–3 being green and merged** (D-2, D-12):
   - `buildListPresetsResult()` returns `summary` + public tags per factory
     entry. Input schema untouched, so the 10-tool change gate still answers
     yes.
   - `SOUND_DESIGN_GUIDE.workflow` gains a preset-first line. Note it currently
     says the opposite — "preserve nodes… use set_param… add_node only for a
     missing effect" — which is why the agent builds from scratch.
   - Write `docs/adr/0003-preset-first-agent-strategy.md`: the payload
     arithmetic (~220 chars/entry full vs ~60 compact at 60 presets), why the
     input schema stayed frozen, the filter-argument road not taken, and the
     capability gaps that bound library growth.

### Lane C — Corpus + authoring (owns the corpus doc, then the pen)

1. **Build the request corpus** from
   `docs/ultron/research/taxonomy-prior-art.md`, extended. It already carries
   verbatim room language ("Give me some echo!", "can I have 33% reverb.. and
   just 15% echo?"), complaint metaphors (tunnel, well, tin can and string,
   sewer pipe, bell ringing, hiss on sss/fff), artist shorthand (T-Pain as
   universal), and a six-product consensus gag list.
2. **Score every request** against library + pen (26 sounds today) under the
   Closeness rule. Three outcomes per request: *matched* (no candidate),
   *coverage gap* (author one), *capability gap* (log it, author nothing).
3. **Author only the coverage gaps.** Each candidate carries, in its
   provenance, the request it answers and why the closest preset failed — that
   is the D-3 admission evidence, checkable at PR time.
4. Vocabulary: append values to existing axes where the corpus proves a miss
   (D-8). Prior art already suggests `gag` values the frozen list lacks —
   alien, cave, walkie-talkie, old-man, little-kid. Log axis-level pressure
   (artist shorthand wants an `artist:` axis) for the next batch; do not add
   it.
5. Every candidate policy-conformant at authoring; update `EXPECTED_PEN` in the
   same edit. Rebase onto Lane B's promotion before opening the pen PR.

Known-open cells for reference (7 of 33 primaries): `use-case:practice`,
`genre:Pop`, `vibe:natural`, `vibe:bright`, `vibe:dark/moody`,
`vibe:intimate`, `vibe:lo-fi`. Four of those are already tag-reachable on
existing presets — they are dropdown-grouping holes, so under D-3 they need a
real failing request, not just an empty optgroup.

## Sequencing

```
now ............... Lane A, Lane B, Lane C all start (C scores against
                    today's 26 sounds; promotion only moves them between
                    files, so the answer does not change)
gate 1 ............ Lane B promotion PR merged
gate 2 ............ Lane C pen PR rebased on it, merged; Lane A Booth merged
                    -> PEN FREEZES. Anything authored after is the next batch.
Sep 2 ............. user auditions
Sep 3 08:00 PT .... last verdict, hard cutoff
Sep 3 08–11 PT .... promotion edit, conformance update, PR, merge, deploy,
                    VERIFY THE DEPLOYED PAGE (not assumed)
Sep 3 13:00 PT .... Devpost closes
```

## Definition of done

- Promotion merged; library ≥ 14; orphaned research records on `main`.
- Booth survives a reload mid-session with verdicts intact.
- Every new candidate carries its failing-request evidence.
- Capability gaps recorded in the coverage report.
- `node tests/run.js` green (the two autotune CPU-p99 checks are the
  documented environmental flake — confirm identical at base before excusing).
- Deployed page verified live before the deadline, not after.
