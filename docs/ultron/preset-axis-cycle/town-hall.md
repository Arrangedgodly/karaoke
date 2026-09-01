# Town Hall — Cycle 4: Preset Library Shape-Out + Plain-Language Axis Cataloging

Coordinator: ultron-swarm · Meeting: 2026-09-01 · Status: **assembled, awaiting final record confirmation**
Artifacts live in `docs/ultron/preset-axis-cycle/` — NOT `docs/ultron/` top
level, which the brother's redesign flow actively owns (collision caught and
reverted 2026-09-01; recorded here so the boundary is durable).

## Problem & users

The factory library ships 14 presets, but the #28 axis map is only half
built: **6 of 9 genre values, 6 of 10 gag values, 1 of 10 vibe values, and
the hard-tune technique are uncovered.** Three gag cells (robot, megaphone,
8-bit) carry actionable 2026-09-01 audition rejection notes. The
coverage-driven goal ("every plausible karaoke request finds a close
preset") is unreachable without filling these cells — and the user wants
**an ongoing batch pipeline**, not a one-shot: author → audition → promote
→ next batch, as many as the user will audition.

Users unchanged: the operator (auditions at `?audition`), the agent
(matches requests to tags/descriptions), the developer/portfolio visitor.

## MVP boundary (approved)

1. **One full-coverage pen batch (~16–17 candidates)**: the 13 uncovered
   cells — genre Metal / Rap-Hip-Hop / R&B-Soul / Country / Dance-EDM /
   Musicals; gags helium / darth-vader / monster-demon; vibe intimate;
   technique hard-tune (Rap/Hip-Hop cell re-authored) — **plus re-authored
   robot / megaphone / 8-bit gags** that demonstrably address their
   rejection notes (robot: less buzz, more robot; megaphone: louder; 8-bit:
   less crushed, melody audible).
2. **Autotune-first insert behavior** (in scope per Q2): when autotune is
   added (palette or agent), it inserts at the FRONT of the chain by
   default unless the user moves it. Isolated insert-position rule; no
   other ordering policy changes.
3. **Genre research before authoring** (Q7): vocal-chain idioms per genre
   (EQ/compression/reverb/effect conventions for Metal, Rap, R&B, Country,
   Dance/EDM, Musicals) so genre cells are authored from evidence, not
   guesswork.
4. Descriptions in the house plain-language style (user words, artist
   shorthand where universal, complaint vocabulary) — the cataloging work.

**Operating pattern beyond the MVP**: further batches keep running
(rejection notes + real-request gaps feed the next pen) as long as the user
auditions. No fixed terminal count.

## Non-goals (approved)

- No new vocabulary values (append-only rule stands; frozen this cycle).
- No UI changes; no changes to the audition Booth or process.
- No agent-tool payload changes.
- Autotune-first changes ONLY the default insert position.
- No presets removed or retagged.

## Journeys & states

- **Authoring**: candidates authored offline against live catalog specs +
  genre research, policy-checked (gain budgets ≤ published limits, schema,
  param ranges) before the pen lands — machine-verified at PR time.
- **Pen → PR → audition**: batch lands in `src/audition-candidates.js` via
  PR only; user auditions at `?audition` (A/X at the "usable without edits"
  bar, notes optional); promotion edit follows the pen's documented
  step 3 (accepted → library with provenance; rejected → removed, notes in
  the PR record).
- **States**: cell covered (≥1 accepted preset) / pending (candidate in
  pen) / rejected-with-note (feeds re-authoring). Rejection is a learning
  state, not a failure state.

## Success measures & acceptance criteria (approved)

1. Every public axis value covered by ≥1 **accepted** preset after this
   cycle's audition (coverage counts promotions only).
2. Re-authored gags demonstrably address their notes (params/description
   delta reviewable in the pen PR).
3. Autotune-first behavior shipped, tested (palette + agent add paths).
4. Every candidate policy-conformant at authoring (suite-enforced).
5. Suite green; regression of the existing 14 presets (byte-identical).

## Constraints, assumptions, risks

- Pipeline rules in force: PR-only integration, pen/audition/promotion
  discipline, CONTEXT.md glossary terms (axis, primary tag, closeness rule,
  coverage-driven), ADR-0001 (library-as-data + drift tests).
- Assumption: audition capacity is minutes-per-batch (12 candidates ≈ 3.5
  min on 2026-09-01) — validated, re-validated each batch.
- Risk accepted: a full batch may still reject several cells; rejections
  carry notes and feed the next batch (the loop is the mitigation).
- Risk: brother's flow touches chain-editing territory concurrently — the
  autotune-first change stays minimal and isolated; PR-first, no direct
  main pushes from this cycle.

## Role Perspectives

- **Product/User Value** — Supports: gaps are countable; audition is
  cheap. Dissent: batch size vs stamina — resolved by data (minutes).
- **Domain/Content Accuracy** — Genre cells are content authoring; the
  research track (genre vocal idioms) exists because names make promises
  (Megaphone Rally failed for not being loud). Smallest experiment: one
  researched genre cell auditioned early would validate the approach —
  folded into batch order (genre first in the pen).
- **UX/Frontend** — No UI work; tags feed the agent matching surface and
  the searchable presets list.
- **Quality/Reliability** — Policy conformance machine-checked at PR time;
  re-auditions must address notes (reviewable delta).
- **Accessibility** — Plain-language descriptions are the a11y surface;
  house style enforced.
- **Security/Privacy** — Nothing new (static data).

## Open questions & disposition

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-1 | Genre vocal-chain idioms (6 genres) — evidence for authoring | deep-research | **blocking** (genre cells) |
| OQ-2 | Gag re-authoring params: robot curve character, megaphone loudness ceiling within policy, 8-bit crush recovery | deep-research | informs (gag cells) |
| OQ-3 | Autotune-first: exact insert semantics (front-of-chain vs after-gate; interaction with terminal limiter + policy validator) | planning | informs |
| OQ-4 | Hard-Tune cell re-authoring with autotune-first in place (key/scale defaults for rap) | production | non-blocking |

## Decisions & rationale

- **Full batch, not staged** (Q7): audition is minutes; rejections teach;
  the real risk (genre guesswork) is addressed by research, not staging.
- **Autotune-first in scope** (Q2): the Rap/Hip-Hop + hard-tune cells
  audition poorly without it; isolated rule, own PR.
- **Vocabulary frozen** (Q3): append-only rule; no real unmatched requests
  named.
- **Descriptions only** (Q4): no agent-payload changes this cycle.
- **Ongoing batches** (user directive 2026-09-01): the cycle delivers the
  loop, not just one batch.

## Sign-off record

- Round 1 (Q1–Q4: batch scope, autotune-first, vocab freeze,
  cataloging depth): **approved as recommended**.
- Round 2 (Q5–Q7: success measures, non-goals, batch staging with
  Challenger/Advocate): **approved as recommended**; staging rejected on
  the evidence; user added the ongoing-batches directive.

## Handoff to plan-it-out

Plan as three tracks: (1) research (OQ-1 genre idioms, OQ-2 gag
re-authoring), (2) behavior (OQ-3 autotune-first, isolated, tested), (3)
content (the ~16–17 candidate batch authored against research + rejection
notes, policy-checked, pen PR). Batch order in the pen: genre cells first
(domain-validation early), gags after. Success = coverage after THIS
audition + the loop established for the next batch.
