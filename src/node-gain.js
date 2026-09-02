// Gain/Trim node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Unlike audio-engine.js/audio-graph.js/etc., this
// file doesn't export a new `window.X` namespace of its own — its only job
// is to register one complete definition with window.EffectCatalog at load
// time. The IIFE wrapper is kept anyway to match this project's file-level
// convention (every src/*.js file is one) even though there's no local state
// here that actually needs hiding behind a closure.
//
// AE-5 scope: this is the FIRST of six planned node-type files (AE-5
// Gain/Trim through AE-10 Limiter — see docs/ultron/plan.md's Task Index),
// and deliberately the simplest, chosen first specifically to prove out this
// exact one-file-per-node-type shape before the rest follow it:
//   - one real Web Audio node (a plain `GainNode` here; later types may wire
//     up more than one node, e.g. EQ's three chained BiquadFilterNodes, but
//     the registration shape stays identical),
//   - one complete EffectCatalog definition containing the
//     (audioContext, params) -> AudioNode factory buildGraph() uses when a
//     model entry's `type` matches, plus the UI-facing metadata and live
//     parameter behavior src/param-controls.js reads generically.
//
// Per docs/ultron/design/px2-node-parameters.md's Gain/Trim section: one
// parameter, `gainDb` (-24..+24 dB, default 0, step 0.5) — and its own
// explicit note that `GainNode.gain.value` is LINEAR AMPLITUDE, not dB, so
// every write to it must convert first: `linear = 10^(dB/20)`. Both the
// factory (initial value) and applyParam (live updates) below do that
// conversion; nothing upstream (param-controls.js, the model) ever sees or
// stores anything but the raw dB value.

(function () {
  'use strict';

  // Factory called by AudioGraph.buildGraph() (src/audio-graph.js) whenever
  // a model entry has type "gain" and no existing node instance is being
  // reused for its id.
  function createEffect(audioContext, params) {
    var node = audioContext.createGain();
    var dbValue = (params && typeof params.gainDb === 'number') ? params.gainDb : 0;
    node.gain.value = Math.pow(10, dbValue / 20);
    return node;
  }

  // UI-facing metadata rendered generically by src/param-controls.js, plus
  // applyParam (this type's own
  // dB->linear mapping for live slider updates, called by param-controls.js
  // on every `input` event — never routed through AudioGraph.buildGraph(),
  // per that file's own comment on why).
  //
  // Issue #5: the write itself is SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() (src/audio-param-ramp.js) instead of a bare
  // `.value =` — the click-safe form the 'host-param-ramps' capability
  // promise describes (a large dB jump applied instantaneously would
  // discontinuously rescale the waveform and pop).
  window.EffectCatalog.register('gain', {
    label: 'Gain',
    // wayfinder #46 — Simple view's effect summary; source of wording is
    // docs/ultron/research/plain-effect-labels.md (wayfinder #44).
    plainLabel: 'Adjusts your volume',
    experimental: false,
    paramSpec: [
      { id: 'gainDb', label: 'Gain', min: -24, max: 24, default: 0, step: 0.5, unit: 'dB' }
    ],
    create: createEffect,
    applyParam: function (node, paramId, value) {
      if (paramId === 'gainDb') {
        window.AudioParamRamp.schedule(node.gain, Math.pow(10, value / 20));
      }
    }
  });
})();
