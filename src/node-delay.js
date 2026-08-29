// Delay node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Same as src/node-gain.js, src/node-compressor.js,
// and src/node-eq.js, this file doesn't export a new `window.X` namespace of
// its own — its only job is to CALL INTO the two registries that already
// exist (window.AudioGraph.registerNodeType from src/audio-graph.js, and
// window.NodeTypes.register from src/node-types.js), once each, at load
// time. The IIFE wrapper is kept anyway to match this project's file-level
// convention (every src/*.js file is one) even though there's no local state
// here that actually needs hiding behind a closure.
//
// AE-8 scope: this is the FOURTH of six planned node-type files (AE-5
// Gain/Trim through AE-10 Limiter — see docs/ultron/plan.md's Task Index),
// and the SECOND composite one (after AE-7's EQ) — built from a
// `DelayNode` plus a feedback `GainNode` loop plus a dry/wet mix pair of
// `GainNode`s, rather than one plain node like AE-5's `GainNode` or AE-6's
// `DynamicsCompressorNode`.
//
// Because this is a composite type, it follows the SAME `{input, output,
// ...}` factory contract AE-7 established and already extended
// AudioGraph.buildGraph() to support (see that file's AE-7 addendum comment
// and its getNodeInput()/getNodeOutput() helpers) — `input` is the
// connection point for whatever comes before this node in the chain,
// `output` is the connection point for whatever comes after it, and they
// are two DIFFERENT real AudioNode objects here (an entry `GainNode` and an
// exit-sum `GainNode`), same as EQ's low-shelf/high-shelf split. NO CHANGE
// to audio-graph.js is needed for this task — the contract it already
// supports is exactly what's used below.
//
// One `AudioGraph.registerNodeType(type, factory)` call and one
// `NodeTypes.register(type, {label, paramSpec, applyParam})` call, same as
// every other node-type file — registering under the permanent, committed
// type name `delay` is enough on its own for "Delay" to appear as a real,
// usable palette chip (UI-3's palette, src/canvas.js, builds itself
// dynamically from NodeTypes.getAllTypes()); no other file needs any change
// for this task beyond the new <script> tag in index.html.
//
// Per docs/ultron/design/px2-node-parameters.md's Delay section, the signal
// topology is:
//
//   inputGain (entry point, unity gain — fans out to both paths)
//     -> dryGain -> outputSum
//     -> delayNode -> wetGain -> outputSum
//   delayNode -> feedbackGain -> delayNode   (feedback loop)
//
// Three exposed params — `timeMs` (10-1000ms, default 300), `feedback`
// (0-90%, default 25), `mix` (0-100%, default 25):
//
//   - `timeMs` writes straight onto `delayNode.delayTime.value`, converted
//     from ms to seconds (`timeMs / 1000`) since `DelayNode.delayTime` is
//     specified in seconds.
//   - `delayNode` is constructed with `audioContext.createDelay(1.0)` —
//     per px2-node-parameters.md's explicit implementation note,
//     `maxDelayTime` is fixed at construction time and can't be changed
//     later, and the UI's max `timeMs` is exactly 1000ms (1.0s), so the
//     constructor argument MUST be 1.0 (or higher) or the max slider
//     setting would silently fail to reach a full second of delay.
//   - `feedback` is a 0-100 percentage in the UI/model, but the UI's own
//     slider is already capped at max="90". Per px2-node-parameters.md's
//     Cross-node notes and AE-8's own "no runaway feedback at max settings"
//     acceptance criterion, that 90% ceiling is ALSO enforced defensively
//     in code here — `Math.min(feedback, 90) / 100` — every time this
//     value is written to `feedbackGain.gain.value`, both at construction
//     and in applyParam. This means the feedback loop can never reach or
//     exceed unity gain (1.0) even if a param value ever arrives from
//     somewhere other than the slider itself (e.g. a future hand-edited or
//     corrupted preset file) — a feedback loop with gain strictly less than
//     1.0 per pass is inherently stable, each repeat decaying
//     geometrically, so this clamp is what guarantees the safety property
//     unconditionally rather than merely by UI convention.
//   - `mix` implements the EQUAL-POWER crossfade px2-node-parameters.md's
//     Cross-node notes require for every Mix/Feedback percentage (standard
//     practice to avoid a perceived volume dip at the 50% mark, unlike a
//     naive linear 0.5/0.5 crossfade): with `m = mix / 100`,
//     `dryGain.gain.value = Math.cos(m * Math.PI / 2)` and
//     `wetGain.gain.value = Math.sin(m * Math.PI / 2)`. At mix=0 this is
//     dry=1/wet=0 (fully dry); at mix=100 it's dry=0/wet=1 (fully wet); at
//     mix=50 both are ≈0.707 (the equal-power midpoint) rather than 0.5/0.5.
//
// `inputGain` and `outputSum` are both plain unity-gain `GainNode`s whose
// only job is to be stable, always-present connection points: `inputGain`
// fans the incoming signal out to both the dry and delay paths, and
// `outputSum` is where `dryGain` and `wetGain` both connect TO — Web Audio
// sums multiple inputs into one node automatically, so `outputSum` needs no
// special mixing logic of its own.
//
// All internal wiring below (inputGain -> dryGain/delayNode, delayNode ->
// wetGain/feedbackGain, feedbackGain -> delayNode, dryGain/wetGain ->
// outputSum) is done ONCE here at construction time and never touched again
// by buildGraph() — same as EQ's internal low->mid->high wiring. buildGraph()
// only ever connects/disconnects the composite's .input/.output edges to the
// REST of the chain.

(function () {
  'use strict';

  // AudioGraph's audio-factory registry: (audioContext, params) -> node.
  // Called by AudioGraph.buildGraph() (src/audio-graph.js) whenever a model
  // entry has type "delay" and no existing node instance is being reused for
  // its id. Returns a COMPOSITE value (see file-level comment above), same
  // shape as AE-7's EQ.
  window.AudioGraph.registerNodeType('delay', function (audioContext, params) {
    var p = params || {};

    var timeMs = typeof p.timeMs === 'number' ? p.timeMs : 300;
    var feedbackPct = typeof p.feedback === 'number' ? p.feedback : 25;
    var mixPct = typeof p.mix === 'number' ? p.mix : 25;

    // Entry point — unity gain, fans out to both the dry path and the delay
    // path below. This is the composite's `input`.
    var inputGain = audioContext.createGain();
    inputGain.gain.value = 1;

    // Per px2-node-parameters.md's explicit implementation note:
    // maxDelayTime is fixed at construction time and can't be changed later,
    // and the UI's max timeMs is exactly 1000ms (1.0s) — so this MUST be
    // 1.0 (or greater).
    var delayNode = audioContext.createDelay(1.0);
    delayNode.delayTime.value = timeMs / 1000;

    // Feedback loop gain. Defensively clamped to a maximum of 0.9 in code
    // (not just relying on the UI slider's max="90") so the loop can never
    // reach or exceed unity gain — see file-level comment above for why
    // this is what actually guarantees "no runaway feedback at max
    // settings", unconditionally.
    var feedbackGain = audioContext.createGain();
    feedbackGain.gain.value = Math.min(feedbackPct, 90) / 100;

    // Dry/wet crossfade pair — equal-power, per px2-node-parameters.md's
    // Cross-node notes (every Mix/Feedback percentage should be equal-power,
    // not linear).
    var dryGain = audioContext.createGain();
    var wetGain = audioContext.createGain();
    var m = mixPct / 100;
    dryGain.gain.value = Math.cos(m * Math.PI / 2);
    wetGain.gain.value = Math.sin(m * Math.PI / 2);

    // Exit point — unity gain. Both dryGain and wetGain connect into this;
    // Web Audio sums multiple inputs into one node automatically. This is
    // the composite's `output`.
    var outputSum = audioContext.createGain();
    outputSum.gain.value = 1;

    // Internal wiring, done ONCE here at construction time and never touched
    // again by buildGraph() (which only ever connects/disconnects the
    // composite's .input/.output edges to the REST of the chain — see
    // its AE-7 addendum comment, still accurate for this composite type).
    inputGain.connect(dryGain);
    inputGain.connect(delayNode);
    delayNode.connect(wetGain);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    dryGain.connect(outputSum);
    wetGain.connect(outputSum);

    return {
      input: inputGain,
      output: outputSum,
      delayNode: delayNode,
      feedbackGain: feedbackGain,
      dryGain: dryGain,
      wetGain: wetGain,
    };
  });

  // NodeTypes' UI-facing metadata registry: label + paramSpec (rendered
  // generically by src/param-controls.js) + applyParam (this type's direct
  // AudioParam writes — with the timeMs ms->s conversion and the feedback/
  // mix conversions described in the file-level comment above — for live
  // slider updates, called by param-controls.js on every `input` event —
  // never routed through AudioGraph.buildGraph(), per that file's own
  // comment on why). `applyParam` is where the composite shape actually
  // gets used: `nodeInstance` here is the SAME `{input, output, delayNode,
  // feedbackGain, dryGain, wetGain}` object returned by the factory above
  // (AudioGraph.getNodeInstance(id) always returns the original,
  // possibly-composite value — see that function's own comment), so this
  // reaches straight into whichever internal piece a given paramId targets.
  //
  // Issue #5: every write is SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() (src/audio-param-ramp.js) instead of bare
  // `.value =` assignments — the click-safe form the 'host-param-ramps'
  // capability promise describes. delayTime included: an instantaneous
  // delay-length change re-reads the circular buffer at a new offset (the
  // classic delay "zipper"/pitch-blip); a short ramp slides the read point
  // instead. mix ramps BOTH crossfade sides in one schedule pair.
  window.NodeTypes.register('delay', {
    label: 'Delay',
    paramSpec: [
      { id: 'timeMs', label: 'Time', min: 10, max: 1000, default: 300, step: 10, unit: 'ms' },
      { id: 'feedback', label: 'Feedback', min: 0, max: 90, default: 25, step: 1, unit: '%' },
      { id: 'mix', label: 'Mix', min: 0, max: 100, default: 25, step: 1, unit: '%' }
    ],
    applyParam: function (nodeInstance, paramId, value) {
      if (paramId === 'timeMs') {
        window.AudioParamRamp.schedule(nodeInstance.delayNode.delayTime, value / 1000);
      } else if (paramId === 'feedback') {
        // Same defensive clamp as the factory above — see file-level
        // comment for why this must hold unconditionally, not just via the
        // UI slider's max="90".
        window.AudioParamRamp.schedule(
          nodeInstance.feedbackGain.gain,
          Math.min(value, 90) / 100
        );
      } else if (paramId === 'mix') {
        var m = value / 100;
        window.AudioParamRamp.schedule(nodeInstance.dryGain.gain, Math.cos(m * Math.PI / 2));
        window.AudioParamRamp.schedule(nodeInstance.wetGain.gain, Math.sin(m * Math.PI / 2));
      }
    }
  });
})();
