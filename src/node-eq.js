// EQ node factory for the Node-Based Web Audio Chain Builder.
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
// AE-7 scope: this is the THIRD of six planned node-type files (AE-5
// Gain/Trim through AE-10 Limiter — see docs/ultron/plan.md's Task Index),
// and the FIRST composite one — built from THREE internal `BiquadFilterNode`s
// (low-shelf, mid-peaking, high-shelf) chained together, rather than one
// plain node like AE-5's `GainNode` or AE-6's `DynamicsCompressorNode`.
//
// That breaks the assumption AudioGraph.buildGraph() (src/audio-graph.js)
// made through AE-6: that a factory's return value is a single AudioNode
// serving as BOTH the connection point for whatever comes before it AND the
// connection point for whatever comes after it. For a 3-filter chain those
// are two different real AudioNode objects — connecting the chain's INPUT
// means connecting into the low-shelf filter; connecting FROM the chain's
// OUTPUT means connecting from the high-shelf filter. This task's
// audio-graph.js change (see its AE-7 addendum comment near the top of that
// file, and getNodeInput()/getNodeOutput() alongside rampGateTo()) extends
// the factory contract to allow EITHER a plain AudioNode (unchanged — AE-5's
// Gain and AE-6's Compressor need zero changes) OR a plain object shaped
// `{ input: AudioNode, output: AudioNode, ...anythingElse }` for a composite
// type. The factory below returns exactly that shape: `input` is the
// low-shelf filter, `output` is the high-shelf filter, and `low`/`mid`/`high`
// individually expose all three internal filters so applyParam (below) can
// reach whichever one a given paramId targets.
//
// One `AudioGraph.registerNodeType(type, factory)` call and one
// `NodeTypes.register(type, {label, paramSpec, applyParam})` call, same as
// every other node-type file — registering under the permanent, committed
// type name `eq` is enough on its own for "EQ" to appear as a real, usable
// palette chip (UI-3's palette, src/canvas.js, builds itself dynamically
// from NodeTypes.getAllTypes()); no other file needs any change for this
// task beyond the audio-graph.js fix above and the new <script> tag in
// index.html.
//
// Per docs/ultron/design/px2-node-parameters.md's EQ section: frequencies
// (and Q) are FIXED internally, not exposed as params — this is a simple
// 3-slider "tone" control, not a full parametric EQ:
//   - low-shelf:    frequency fixed 200Hz
//   - mid-peaking:  frequency fixed 1000Hz, Q fixed 1.0
//   - high-shelf:   frequency fixed 5000Hz
// Three exposed params — `lowGain`/`midGain`/`highGain`, each -12..+12dB,
// default 0, step 0.5 — one gain per band. UNLIKE AE-5's Gain/Trim, no unit
// conversion is needed: `BiquadFilterNode.gain` for a shelf/peaking filter is
// already specified directly in dB, so every value below is written straight
// onto the matching filter's `.gain.value`, same as AE-6's Compressor's
// direct, no-conversion AudioParam writes. All three defaults are 0dB — flat
// response, fully transparent untouched, trivially satisfying "sounds
// reasonable untouched" since an unadjusted EQ does nothing at all.

(function () {
  'use strict';

  // AudioGraph's audio-factory registry: (audioContext, params) -> node.
  // Called by AudioGraph.buildGraph() (src/audio-graph.js) whenever a model
  // entry has type "eq" and no existing node instance is being reused for
  // its id. Returns a COMPOSITE value (see file-level comment above) rather
  // than a single AudioNode — the first factory in this project to do so.
  window.AudioGraph.registerNodeType('eq', function (audioContext, params) {
    var p = params || {};

    var low = audioContext.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 200;
    low.gain.value = typeof p.lowGain === 'number' ? p.lowGain : 0;

    var mid = audioContext.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 1.0;
    mid.gain.value = typeof p.midGain === 'number' ? p.midGain : 0;

    var high = audioContext.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 5000;
    high.gain.value = typeof p.highGain === 'number' ? p.highGain : 0;

    // Internal chain wiring, done ONCE here at construction time and never
    // touched again by buildGraph() (which only ever connects/disconnects
    // the composite's .input/.output edges to the REST of the chain — see
    // its AE-7 addendum comment). low -> mid -> high, in that fixed order.
    low.connect(mid);
    mid.connect(high);

    return { input: low, output: high, low: low, mid: mid, high: high };
  });

  // NodeTypes' UI-facing metadata registry: label + paramSpec (rendered
  // generically by src/param-controls.js) + applyParam (this type's direct,
  // no-conversion AudioParam writes for live slider updates, called by
  // param-controls.js on every `input` event — never routed through
  // AudioGraph.buildGraph(), per that file's own comment on why). `applyParam`
  // is where the composite shape actually gets used: `nodeInstance` here is
  // the SAME `{input, output, low, mid, high}` object returned by the
  // factory above (AudioGraph.getNodeInstance(id) always returns the
  // original, possibly-composite value — see that function's own comment),
  // so this reaches straight into whichever internal filter a given paramId
  // targets.
  window.NodeTypes.register('eq', {
    label: 'EQ',
    paramSpec: [
      { id: 'lowGain', label: 'Low', min: -12, max: 12, default: 0, step: 0.5, unit: 'dB' },
      { id: 'midGain', label: 'Mid', min: -12, max: 12, default: 0, step: 0.5, unit: 'dB' },
      { id: 'highGain', label: 'High', min: -12, max: 12, default: 0, step: 0.5, unit: 'dB' }
    ],
    applyParam: function (nodeInstance, paramId, value) {
      if (paramId === 'lowGain') nodeInstance.low.gain.value = value;
      else if (paramId === 'midGain') nodeInstance.mid.gain.value = value;
      else if (paramId === 'highGain') nodeInstance.high.gain.value = value;
    }
  });
})();
