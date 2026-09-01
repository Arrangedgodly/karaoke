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
//   { name, description, tags: ['axis:value', ...], primary,
//     provenance: { origin, auditionDate: null, verdict: 'pending' },
//     nodes: [{id, type, params}] }
//
// CURRENT CONTENT — EMPTY since the 2026-09-01 audition closed the #31
// seed batch: all twelve candidates were auditioned live at the Booth;
// EIGHT were promoted into src/factory-library-data.js in the same edit
// (Chipmunk Party, Deep Narrator, AM Radio Ghost, Cathedral Drift, Jazz
// Cellar, Rotary Nostalgia, Space Lounge, Studio Polish — provenance
// filled, nodes verbatim). FOUR were rejected and removed (verdicts live
// in the promotion PR record):
//   Hard-Tune Hotline — "needs autotune first in chain, if autotune is
//     used it should be first by default unless the user moves it" (a
//     chain-ordering behavior request, recorded for the pipeline backlog,
//     not just a preset tweak)
//   Robot Usher — "too buzzy not robotic enough"
//   8-Bit Encore — "too crushed and hard to hear"
//   Megaphone Rally — "not quite as loud as you would expect from the name"
// A new batch lands here via PR when one is authored.

(function () {
  'use strict';

  window.AUDITION_CANDIDATES = [];
})();
