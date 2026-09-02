// AUDITION CANDIDATES — the pipeline's holding pen for chains awaiting
// their human audition (wayfinder #34/#31; map #26). Inert data: nothing
// here renders, loads, or reaches the WebMCP surface. The Booth harness
// (src/audition-harness.js, ?audition-gated) is the only consumer.
//
// PIPELINE (PR-only, per the map's standing rule):
//   1. A pipeline session authors candidates offline (schema-conformant
//      chains in the library entry shape) and lands them HERE via PR.
//   2. An audition session runs the app with ?audition, listens to each
//      candidate through the real load path (live mic; raw test-vocal
//      reference), and records binary verdicts (bar: "usable without
//      edits") with optional notes.
//   3. ACCEPTED candidates are promoted — moved into
//      src/factory-library-data.js's PRESETS with their provenance filled
//      (verdict 'accepted', the real audition date) — and REMOVED from
//      here in the same edit, alongside the same-edit test updates the
//      library conformance test documents. REJECTED candidates are simply
//      removed from here (their verdict lives in the ticket/PR record).
//
// Entry shape = the library's (src/factory-library-data.js), with
// provenance.verdict 'pending' and auditionDate null while waiting:
//   { name, description, summary, tags: ['axis:value', ...], primary,
//     provenance: { origin, auditionDate: null, verdict: 'pending' },
//     nodes: [{id, type, params}] }
//
// `summary` (<= 60 chars, hand-written, the line an agent matches a
// request against) is a LIBRARY conformance requirement, so promotion
// cannot land an entry without one. Candidates authored from here on
// should carry it at authoring time rather than have it invented at
// promotion — the person who wrote the sound knows what request it
// answers. The pen's own conformance pass does not yet require it, so
// the pre-existing entries below are not blocked.
//
// SEED BATCH, CLOSED (#31, authored offline 2026-09-01). The 2026-09-01
// live audition at the ?audition Booth decided all twelve seed
// candidates: EIGHT ACCEPTED and promoted into
// src/factory-library-data.js by step 3 above — Chipmunk Party, Deep
// Narrator, AM Radio Ghost, Cathedral Drift, Jazz Cellar, Rotary
// Nostalgia, Space Lounge, Studio Polish — and FOUR REJECTED
// (Hard-Tune Hotline: 'needs autotune first in chain'; Robot Usher:
// 'too buzzy not robotic enough'; 8-Bit Encore: 'too crushed and hard
// to hear'; Megaphone Rally: 'not quite as loud as you would expect
// from the name'). No seed entry remains here; the four rejection notes
// are answered by the GEN-1/GAG-1 re-authors below, which reuse the
// names.
//
// The seed authoring rules still govern every entry here: descriptions
// follow the #28 checklist (the sound in user words, artist shorthand
// where universal, and the complaint vocabulary the preset fixes or
// avoids); param values authored against the live catalog specs; gain
// budgets inside the published +12 (gainDb + 0.57·|threshold| +
// 0.57·|ceiling|).
//
// GEN-1 GENRE BATCH (cycle 4, appended below the seed entries): six
// genre candidates — Metal / Rap-Hip-Hop / R&B-Soul / Country /
// Dance-EDM / Musicals — authored offline 2026-09-01 from the RQ-1 chain
// sketches (D1 disposition; docs/ultron/preset-axis-cycle/research/
// rq1-genre-idioms.md). Catalog-forced adjustments are recorded in the
// per-entry comments; gain budgets 9.69–11.26 dB of the published +12.
// The rap candidate RE-AUTHORS the seed batch's Hard-Tune Hotline (its
// audition note — autotune belongs first — is answered by BEH-1's
// front-insert rule, honored as the chain's leading node); the #31
// cell-1 draft was removed in the same edit so the cell is not
// double-covered or name-duplicated in the pen.
//
// GAG-1 GAG BATCH (cycle 4, appended below the genre entries): six gag
// candidates — the three re-auditioned gags (robot / megaphone / 8-bit,
// re-authored per D2 to answer their 2026-09-01 rejection notes) and the
// three never-authored cells (helium / darth-vader / monster-demon, per
// D3) — authored offline 2026-09-01 from the RQ-2/RQ-3 record
// (docs/ultron/preset-axis-cycle/research/rq2-gag-reauthoring.md). The
// re-authors SUPERSEDE the #31 cell-4/5/7 drafts, removed in the same
// edit (same rule as the Hard-Tune supersession: name-keyed verdict
// recording cannot hold duplicates); the exact param deltas vs the
// rejected chains are recorded in the per-entry comments. Gain budgets
// 3.42–11.97 dB of the published +12 — megaphone deliberately sits at
// the boundary (PEN-1 verifies the ≤ is inclusive).
//
// LC-1 CORPUS BATCH (scale-out, appended below the PEN-1 12): eight
// candidates authored offline 2026-09-01 from
// docs/ultron/preset-axis-cycle/request-corpus.md — a 123-request corpus
// built from docs/ultron/research/taxonomy-prior-art.md (six products,
// four communities) and scored against the 26 sounds that exist today
// under the Closeness rule. Verdicts: 74 matched, 21 coverage gaps (14
// authored -> these 8 candidates, 7 deferred), 28 capability gaps LOGGED
// AND NEVER APPROXIMATED (scale-out-plan D-10).
//
// The admission bar these eight cleared (D-3): each names, in its
// provenance.origin, (1) the plain-language request it answers in a real
// singer's words and (2) why the CLOSEST existing preset FAILS that
// request. Cell coverage was evidence, never the bar — four of the seven
// "open cells" the plan listed (use-case:practice, vibe:bright,
// vibe:dark/moody, vibe:lo-fi) were scored as dropdown holes with no
// failing request behind them and are DELIBERATELY still empty.
//
// Why eight and not fifty (D-4, "if the corpus and the bar conflict, the
// bar wins"): 23% of the corpus is unbuildable at the engine ceiling
// (one fixed reverb IR, three fixed EQ bands, no harmony/vocoder/formant
// shift) and 60% is already served. The capability-gap register in the
// corpus doc — formant shift blocks 7 requests, harmony 5, a selectable
// impulse response 4 — is the batch's most valuable output.
//
// No vocabulary append: all eight tag inside the frozen vocabularies
// (src/factory-library-data.js is Lane B's file this batch). Append
// pressure and the axis-level artist: pressure are logged in the corpus
// doc, not acted on. All eight are DOMAIN candidates (no gag primary),
// so the genre-first audition order is preserved batch-wise: the PEN-1
// block still runs domain-then-gags, and this block is all domain.
//
// SCALE-OUT BATCH, CLOSED (2026-09-02 audition). The live audition at
// the ?audition Booth decided all twenty candidates — the PEN-1 twelve
// (six GEN-1 genre, six GAG-1 gag) plus the LC-1 corpus eight.
// NINETEEN ACCEPTED and promoted into src/factory-library-data.js by
// step 3 above: Metal Mayhem, Hard-Tune Hotline, Slow Jam Silk,
// Nashville Nights, Club Anthem, West End Nights, Robot Usher,
// Megaphone Rally, 8-Bit Encore, Helium Hangout, Dark Helmet Baritone,
// Demon Growl, Chart Topper, Pitch Safety Net, Noraebang Echo,
// Close-Up Whisper, Hiss Rescue, Room Announcer, Double Track. ONE
// REJECTED: Podcast Warmth ('too much reverb'). The rejection note
// answers to the C6 corpus request (podcast/streaming warmth); whether
// it is re-authored with less wash is the next batch's call, made
// against the D-3 bar like any candidate. No entry remains here; the
// pen is empty until the next batch lands.
//
// PEN-1 ORDER (cycle 4, batch PR): the 12 entries are sequenced
// GENRE-FIRST — the six GEN-1 genre candidates in sketch order
// (Metal → Rap → R&B/Soul → Country → Dance/EDM → Musicals), and only
// then the six GAG-1 gags (the three re-authors, the three new cells)
// — so the user's audition validates domain content before gags. A
// pure data move (no entry bytes changed); the committed conformance
// pass in tests/test-factory-presets-policy.js section F pins the order
// so the batch cannot regress silently. (The eight seed entries the
// order originally interleaved were promoted out on 2026-09-01; the
// order rule is unchanged.)

(function () {
  'use strict';

  // The scale-out batch is closed (see the header); the pen ships EMPTY
  // until the next batch lands. The export stays a stable empty array —
  // never deleted — because the Booth reads window.AUDITION_CANDIDATES
  // unconditionally and its pen contract covers the empty state
  // (tests/test-audition-harness.js loads the pen "pending-only (or
  // empty)" and exercises the empty case directly).
  window.AUDITION_CANDIDATES = [];
})();
