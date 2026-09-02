// Chorus node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Like src/node-distortion.js and src/node-delay.js,
// this file exports no `window.X` namespace of its own — its only job is to
// register one complete definition with window.EffectCatalog at load time.
//
// CHOR-1 scope (cycle 3, docs/ultron/plan.md): built exactly per the D4
// research decision (docs/ultron/research/rq4-chorus-topology.md, RQ-4
// COMMITTED 2026-08-29) — a 2-voice L/R phase-opposed chorus, all native
// nodes, no worklet:
//
//   inputGain ──┬─ dryGain ────────────────────────────→ outputSum
//               ├─ delayL ─ panL(-1) ─┐
//               └─ delayR ─ panR(+1) ─┴─ wetSum ─ wetGain ─→ outputSum
//
//   lfo (OscillatorNode, sine, Rate Hz, started at construction)
//     → depthGainL (+depthMs/1000) → delayL.delayTime
//     → depthGainR (−depthMs/1000) → delayR.delayTime
//
// Why each piece is what it is (all D4; evidence tags refer to that
// record's table):
//
//   - TWO voices with 180° phase-opposed LFO feeds: the negative depth
//     gain on voice R makes the two voices' delay trajectories
//     anti-correlated, so mono-summing the output (karaoke playback often
//     ends mono) yields near-constant total energy with reduced comb
//     cancellation, while the stereo bus (mono mic up-mixed to stereo by
//     default — verified in rq4 criterion 2) gets real width.
//   - ONE OscillatorNode, not two: phase opposition is achieved by sign-
//     flipping the depth GainNode on voice R — exact per-sample 180° for
//     a sine, and one node cheaper than a second oscillator with a
//     phase-offset trick (oscillators have no phase parameter).
//   - delayTime baseline 25 ms is written ONCE as `.value` at
//     construction and never param-driven; the LFO GainNode sums into the
//     a-rate `delayTime` param audio-rate (spec-legal; MDN/W3C evidence
//     in rq4). Max delay = 25 + 10 = 35 ms ≪ 60 ms constructor cap, and
//     min = 25 − 10 = 15 ms ≫ 0 — the never-reach-zero rule with margin
//     (reaching 0 glitches), per the r/DSP chorus-depth evidence.
//   - Chrome samples delayTime once per 128-frame render quantum; at
//     chorus Rates (0.1–8 Hz) the excursion per block is far below one
//     render quantum of change, so block quantization is inaudible
//     (rq4's explicit residual-risk assessment).
//   - StereoPannerNode pan ±1 (native, Chrome 42+): hard-placed voices,
//     pan BEFORE the wet sum so the equal-power dry/wet crossfade stays
//     bit-identical in law to Delay's Mix branch.
//   - Equal-power Mix: dryGain = cos(m·π/2), wetGain = sin(m·π/2) —
//     exactly node-delay.js's mix law.
//   - Node count: inputGain, 2×DelayNode, lfo, 2×depth GainNodes,
//     2×StereoPanner, wetSum, dryGain, wetGain, outputSum = 12 native
//     nodes, 0 worklets.
//
// Composite factory contract (AE-7 addendum in src/audio-graph.js, same
// shape as EQ/Delay/Reverb/Distortion): returns {input, output, ...
// internal nodes} — buildGraph() connects the composite's .input/.output
// edges; applyParam reaches the internals by name. No change to
// audio-graph.js, effect-catalog.js, or any bus/channel code needed.

(function () {
  'use strict';

  // ---- D4-fixed constants ------------------------------------------------

  // Baseline delay written once to both delayTime params (never reaches 0
  // even at Depth max: 25 − 10 = 15 ms, see file-level comment).
  var BASELINE_MS = 25;
  // DelayNode constructor cap — 60 ms headroom over baseline + max depth.
  var MAX_DELAY_S = 0.06;

  /**
   * Depth (ms of LFO excursion) -> linear gain magnitude for the
   * osc→delayTime feed. delayTime is in SECONDS, so ms/1000. Voice R gets
   * the negative of this (phase opposition via sign flip).
   * @param {number} depthMs 0..10
   * @returns {number} seconds
   */
  function depthToGain(depthMs) {
    return Math.max(0, Math.min(10, depthMs)) / 1000;
  }

  /**
   * Mix % -> equal-power coefficient pair, identical law to node-delay.js.
   * @param {number} mixPct 0..100
   * @returns {{dry: number, wet: number}}
   */
  function mixToGains(mixPct) {
    var m = Math.max(0, Math.min(100, mixPct)) / 100;
    return { dry: Math.cos(m * Math.PI / 2), wet: Math.sin(m * Math.PI / 2) };
  }

  // Factory called by AudioGraph.buildGraph() (src/audio-graph.js) whenever
  // a model entry has type "chorus" and no existing node instance is being reused
  // for its id. Returns a COMPOSITE value, same shape as EQ/Delay/Distortion.
  function createEffect(audioContext, params) {
    var p = params || {};

    var depthMs = typeof p.depthMs === 'number' ? p.depthMs : 3;
    var rateHz = typeof p.rateHz === 'number' ? p.rateHz : 1.5;
    var mixPct = typeof p.mix === 'number' ? p.mix : 30;

    // Entry point — unity gain, fans out to the dry path and both delay
    // voices. This is the composite's `input`.
    var inputGain = audioContext.createGain();
    inputGain.gain.value = 1;

    // The two delay voices. Baseline written ONCE here; the LFO feeds
    // below sum into the a-rate delayTime param around it.
    var delayL = audioContext.createDelay(MAX_DELAY_S);
    delayL.delayTime.value = BASELINE_MS / 1000;
    var delayR = audioContext.createDelay(MAX_DELAY_S);
    delayR.delayTime.value = BASELINE_MS / 1000;

    // Single sine LFO, started at construction and never stopped — the
    // modulation source for BOTH voices (phase opposition comes from the
    // sign of the depth gains, not from a second oscillator).
    var lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rateHz;
    lfo.start();

    // Depth feeds: osc output (±1) scaled to ±depth seconds. Voice L is
    // positive, voice R NEGATIVE — the 180° phase opposition.
    var depthGainL = audioContext.createGain();
    depthGainL.gain.value = depthToGain(depthMs);
    var depthGainR = audioContext.createGain();
    depthGainR.gain.value = -depthToGain(depthMs);
    lfo.connect(depthGainL);
    lfo.connect(depthGainR);
    depthGainL.connect(delayL.delayTime);
    depthGainR.connect(delayR.delayTime);

    // Hard-placed stereo voices — pan BEFORE the wet sum so the dry/wet
    // crossfade law is identical to Delay's.
    var panL = audioContext.createStereoPanner();
    panL.pan.value = -1;
    var panR = audioContext.createStereoPanner();
    panR.pan.value = 1;

    // Wet sum (panned voices) -> single wetGain — keeps the equal-power
    // crossfade a strict two-way dry/wet pair.
    var wetSum = audioContext.createGain();
    wetSum.gain.value = 1;

    // Dry/wet crossfade pair — equal-power, same law as node-delay.js.
    var dryGain = audioContext.createGain();
    var wetGain = audioContext.createGain();
    var g = mixToGains(mixPct);
    dryGain.gain.value = g.dry;
    wetGain.gain.value = g.wet;

    // Exit point — unity gain; dry and wet paths sum here automatically.
    // This is the composite's `output`.
    var outputSum = audioContext.createGain();
    outputSum.gain.value = 1;

    // Internal wiring, done ONCE here; buildGraph() only ever connects the
    // composite's .input/.output edges to the REST of the chain.
    inputGain.connect(dryGain);
    inputGain.connect(delayL);
    inputGain.connect(delayR);
    delayL.connect(panL);
    delayR.connect(panR);
    panL.connect(wetSum);
    panR.connect(wetSum);
    wetSum.connect(wetGain);
    dryGain.connect(outputSum);
    wetGain.connect(outputSum);

    return {
      input: inputGain,
      output: outputSum,
      inputGain: inputGain,
      outputSum: outputSum,
      delayL: delayL,
      delayR: delayR,
      lfo: lfo,
      depthGainL: depthGainL,
      depthGainR: depthGainR,
      panL: panL,
      panR: panR,
      wetSum: wetSum,
      dryGain: dryGain,
      wetGain: wetGain
    };
  }

  // UI-facing metadata plus applyParam. Plain-language labels per the
  // cycle-3 scope table; ranges per rq4's paramSpec block:
  //   depthMs 0–10 ms, default 3, step 0.5 (DunneAudioKit-style excursion)
  //   rateHz  0.1–8 Hz, default 1.5, step 0.1 (typical vocal 0.5–3 Hz)
  //   mix     0–100 %, default 30, step 1 (equal-power cos/sin)
  //
  // Issue #5: live writes are SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() (src/audio-param-ramp.js) — the click-safe
  // form. Baseline delayTime is never touched here (set once at
  // construction, never param-driven).
  window.EffectCatalog.register('chorus', {
    label: 'Chorus',
    // wayfinder #46 — see docs/ultron/research/plain-effect-labels.md
    plainLabel: 'Thickens your voice',
    experimental: false,
    paramSpec: [
      { id: 'depthMs', label: 'Depth', min: 0, max: 10, default: 3, step: 0.5, unit: 'ms' },
      { id: 'rateHz', label: 'Rate', min: 0.1, max: 8, default: 1.5, step: 0.1, unit: 'Hz' },
      { id: 'mix', label: 'Mix', min: 0, max: 100, default: 30, step: 1, unit: '%' }
    ],
    create: createEffect,
    applyParam: function (nodeInstance, paramId, value) {
      if (paramId === 'depthMs') {
        // Sign flip = phase opposition; ramp BOTH feeds in one update.
        var d = depthToGain(value);
        window.AudioParamRamp.schedule(nodeInstance.depthGainL.gain, d);
        window.AudioParamRamp.schedule(nodeInstance.depthGainR.gain, -d);
      } else if (paramId === 'rateHz') {
        window.AudioParamRamp.schedule(nodeInstance.lfo.frequency, value);
      } else if (paramId === 'mix') {
        var g = mixToGains(value);
        window.AudioParamRamp.schedule(nodeInstance.dryGain.gain, g.dry);
        window.AudioParamRamp.schedule(nodeInstance.wetGain.gain, g.wet);
      }
    }
  });
})();
