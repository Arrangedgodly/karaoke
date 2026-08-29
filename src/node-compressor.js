// Compressor node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Same as src/node-gain.js, this file doesn't export
// a new `window.X` namespace of its own — its only job is to CALL INTO the
// two registries that already exist (window.AudioGraph.registerNodeType
// from src/audio-graph.js, and window.NodeTypes.register from
// src/node-types.js), once each, at load time. The IIFE wrapper is kept
// anyway to match this project's file-level convention (every src/*.js file
// is one) even though there's no local state here that actually needs
// hiding behind a closure.
//
// AE-6 scope: this is the SECOND of six planned node-type files (AE-5
// Gain/Trim through AE-10 Limiter — see docs/ultron/plan.md's Task Index),
// following the IDENTICAL registration shape AE-5's src/node-gain.js already
// proved out:
//   - one real Web Audio node (a plain `DynamicsCompressorNode` here — AE-5
//     used a plain `GainNode`; later types may wire up more than one node,
//     e.g. EQ's three chained BiquadFilterNodes, but the registration shape
//     stays identical),
//   - one `AudioGraph.registerNodeType(type, factory)` call — the
//     (audioContext, params) -> AudioNode factory buildGraph() (src/
//     audio-graph.js) calls when a model entry's `type` matches,
//   - one `NodeTypes.register(type, {label, paramSpec, applyParam})` call —
//     the UI-facing metadata src/param-controls.js reads generically to
//     render this type's sliders and apply live changes, with zero
//     per-type code of its own.
//
// Registering under the permanent, committed type name `compressor` is
// enough on its own for "Compressor" to appear as a real, usable palette
// chip — UI-3's palette (src/canvas.js) builds itself dynamically from
// NodeTypes.getAllTypes(), so no other file needs any change for this task.
//
// Per docs/ultron/design/px2-node-parameters.md's Compressor section: four
// parameters — `threshold` (-60..0 dB, default -24), `ratio` (1..20 :1,
// default 4), `attack` (0..1 s, default 0.01), `release` (0..1 s, default
// 0.25). UNLIKE AE-5's Gain/Trim, NO unit conversion is needed here:
// `DynamicsCompressorNode`'s `threshold`/`ratio`/`attack`/`release`
// AudioParams are already specified in exactly these same units (dB, ratio,
// seconds) — every value below is written straight onto the matching
// AudioParam's `.value`, with no conversion step at all.
//
// Knee is deliberately left at the node's own spec default (30dB, soft
// knee) and not exposed as a param, per px2-node-parameters.md's explicit
// note: keeps the control surface approachable for a non-technical host
// tuning by ear mid-event.

(function () {
  'use strict';

  // AudioGraph's audio-factory registry: (audioContext, params) -> AudioNode.
  // Called by AudioGraph.buildGraph() (src/audio-graph.js) whenever a model
  // entry has type "compressor" and no existing node instance is being
  // reused for its id.
  window.AudioGraph.registerNodeType('compressor', function (audioContext, params) {
    var node = audioContext.createDynamicsCompressor();
    var p = params || {};
    node.threshold.value = typeof p.threshold === 'number' ? p.threshold : -24;
    node.ratio.value = typeof p.ratio === 'number' ? p.ratio : 4;
    node.attack.value = typeof p.attack === 'number' ? p.attack : 0.01;
    node.release.value = typeof p.release === 'number' ? p.release : 0.25;
    // Knee is deliberately left at the node's own spec default (30dB) and not
    // exposed as a param, per px2-node-parameters.md's explicit note: keeps
    // the control surface approachable for a non-technical host tuning by
    // ear mid-event.
    return node;
  });

  // NodeTypes' UI-facing metadata registry: label + paramSpec (rendered
  // generically by src/param-controls.js) + applyParam (this type's direct,
  // no-conversion AudioParam writes for live slider updates, called by
  // param-controls.js on every `input` event — never routed through
  // AudioGraph.buildGraph(), per that file's own comment on why).
  //
  // Issue #5: each write is SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() (src/audio-param-ramp.js) instead of bare
  // `.value =` assignments — the click-safe form the 'host-param-ramps'
  // capability promise describes. (The factory's `.value =` writes above
  // stay direct on purpose: they are a brand-new node's INITIAL values,
  // applied at creation before the node is wired into the live graph —
  // there is no in-audition signal to protect and no prior value to ramp
  // from.)
  window.NodeTypes.register('compressor', {
    label: 'Compressor',
    paramSpec: [
      { id: 'threshold', label: 'Threshold', min: -60, max: 0, default: -24, step: 1, unit: 'dB' },
      { id: 'ratio', label: 'Ratio', min: 1, max: 20, default: 4, step: 0.5, unit: ':1' },
      { id: 'attack', label: 'Attack', min: 0, max: 1, default: 0.01, step: 0.001, unit: 's' },
      { id: 'release', label: 'Release', min: 0, max: 1, default: 0.25, step: 0.01, unit: 's' }
    ],
    applyParam: function (node, paramId, value) {
      if (paramId === 'threshold') window.AudioParamRamp.schedule(node.threshold, value);
      else if (paramId === 'ratio') window.AudioParamRamp.schedule(node.ratio, value);
      else if (paramId === 'attack') window.AudioParamRamp.schedule(node.attack, value);
      else if (paramId === 'release') window.AudioParamRamp.schedule(node.release, value);
    }
  });
})();
