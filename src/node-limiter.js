// Limiter node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Same as src/node-gain.js and src/node-compressor.js,
// this file doesn't export a new `window.X` namespace of its own — its only
// job is to CALL INTO the two registries that already exist
// (window.AudioGraph.registerNodeType from src/audio-graph.js, and
// window.NodeTypes.register from src/node-types.js), once each, at load
// time. The IIFE wrapper is kept anyway to match this project's file-level
// convention (every src/*.js file is one) even though there's no local state
// here that actually needs hiding behind a closure.
//
// AE-10 scope: this is the SIXTH AND FINAL of six planned node-type files
// (AE-5 Gain/Trim through AE-10 Limiter — see docs/ultron/plan.md's Task
// Index) — landing this type completes Milestone M4 ("all Core MVP effect
// nodes live"). Like AE-6's Compressor (src/node-compressor.js) and UNLIKE
// AE-7/AE-8/AE-9's composite EQ/Delay/Reverb, this is a single-node type: one
// plain `DynamicsCompressorNode`, returned directly, with no `{input,
// output}` wrapper needed — buildGraph()'s getNodeInput()/getNodeOutput()
// helpers (src/audio-graph.js) already fall through to the node itself for
// exactly this shape.
//   - one real Web Audio node (a second, differently-configured
//     `DynamicsCompressorNode` — same underlying node type AE-6 already
//     uses, just tuned for a completely different job; see below),
//   - one `AudioGraph.registerNodeType(type, factory)` call — the
//     (audioContext, params) -> AudioNode factory buildGraph() (src/
//     audio-graph.js) calls when a model entry's `type` matches,
//   - one `NodeTypes.register(type, {label, paramSpec, applyParam})` call —
//     the UI-facing metadata src/param-controls.js reads generically to
//     render this type's sliders and apply live changes, with zero
//     per-type code of its own.
//
// Registering under the permanent, committed type name `limiter` is enough
// on its own for "Limiter" to appear as a real, usable palette chip — UI-3's
// palette (src/canvas.js) builds itself dynamically from
// NodeTypes.getAllTypes(), so no other file needs any change for this task
// beyond the new <script> tag in index.html.
//
// Per docs/ultron/design/px2-node-parameters.md's Limiter section: a second
// `DynamicsCompressorNode`, configured as a SAFETY limiter, not a musical
// effect — its job is "catch spikes," not "be tuned by ear." Only two
// params are exposed, `ceiling` (-12..0 dB, default -1, step 0.5) and
// `release` (10..500 ms, default 50, step 10); UNLIKE AE-6's Compressor,
// `release` here is spec'd in MILLISECONDS (matching a "how fast does it let
// go" mental model that reads more naturally in ms for a fast safety
// control), so — unlike AE-6's factory, which needed no unit conversion at
// all — every write to `DynamicsCompressorNode.release` (spec'd in SECONDS)
// below divides by 1000 first. `ceiling` writes straight onto `.threshold`
// with no conversion, same as AE-6's `threshold`.
//
// Two more params are fixed internally and deliberately NOT exposed, per
// px2-node-parameters.md's explicit note:
//   - `ratio` fixed at 20 (the node's native max) — brickwall behavior:
//     once signal crosses the ceiling, gain reduction tracks it almost
//     1:1, so output essentially can't rise further above the ceiling.
//   - `attack` fixed at 0 (the node's native minimum/fastest possible
//     response) — a safety limiter has to react to a spike as close to
//     instantly as the node allows, not on a musically-judged timescale.
//
// One ADDITIONAL engineering call, not literally spelled out in
// px2-node-parameters.md's Limiter table but implied by "brickwall
// limiter": `knee` is ALSO fixed, to 0 (hard knee) — the OPPOSITE choice
// from AE-6's Compressor, which deliberately leaves knee at the node's own
// spec default (30dB, soft knee) for the opposite reason. A soft knee makes
// the compressor start reducing gain gradually well BELOW the stated
// threshold (roughly threshold-minus-half-the-knee-width — with the 30dB
// native default, meaningfully reducing gain from about 15dB under
// threshold onward) and ease into full ratio only once the signal is well
// past it. That gradual, "already-coloring-the-signal-early" behavior is
// exactly what AE-6 wants for a musical vocal-bus compressor (an audibly
// smooth transition, not an audible knee/elbow) — but it's exactly WRONG
// for a safety limiter, whose entire point is to stay fully transparent
// (zero gain reduction) right up until the signal actually approaches the
// ceiling, and then clamp hard, right at it, with no gradual pre-ceiling
// coloration. A hard knee (0dB) is what makes "ceiling" mean what the
// param's name says: nothing happens below it, and a brickwall happens at
// it.

(function () {
  'use strict';

  // AudioGraph's audio-factory registry: (audioContext, params) -> AudioNode.
  // Called by AudioGraph.buildGraph() (src/audio-graph.js) whenever a model
  // entry has type "limiter" and no existing node instance is being reused
  // for its id.
  window.AudioGraph.registerNodeType('limiter', function (audioContext, params) {
    var p = params || {};
    var node = audioContext.createDynamicsCompressor();
    node.threshold.value = typeof p.ceiling === 'number' ? p.ceiling : -1;
    // Fixed, not exposed — see file-level comment above for why each of
    // these three values is what it is.
    node.ratio.value = 20; // native max — brickwall behavior
    node.attack.value = 0; // native minimum — fastest possible response
    node.knee.value = 0; // hard knee — stay transparent until the ceiling, then clamp hard
    node.release.value = (typeof p.release === 'number' ? p.release : 50) / 1000; // ms -> s
    return node;
  });

  // NodeTypes' UI-facing metadata registry: label + paramSpec (rendered
  // generically by src/param-controls.js) + applyParam (this type's direct
  // AudioParam writes — including the ms->s conversion below — for live
  // slider updates, called by param-controls.js on every `input` event —
  // never routed through AudioGraph.buildGraph(), per that file's own
  // comment on why).
  //
  // Issue #5: the writes are SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() (src/audio-param-ramp.js) instead of bare
  // `.value =` assignments — the click-safe form the 'host-param-ramps'
  // capability promise describes (the factory's creation-time writes stay
  // direct: a new node has no live signal to protect yet).
  window.NodeTypes.register('limiter', {
    label: 'Limiter',
    paramSpec: [
      { id: 'ceiling', label: 'Ceiling', min: -12, max: 0, default: -1, step: 0.5, unit: 'dB' },
      { id: 'release', label: 'Release', min: 10, max: 500, default: 50, step: 10, unit: 'ms' }
    ],
    applyParam: function (node, paramId, value) {
      if (paramId === 'ceiling') {
        window.AudioParamRamp.schedule(node.threshold, value);
      } else if (paramId === 'release') {
        window.AudioParamRamp.schedule(node.release, value / 1000); // ms -> s
      }
    }
  });
})();
