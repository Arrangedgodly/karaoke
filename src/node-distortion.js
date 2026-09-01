// Distortion node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Like src/node-compressor.js and src/node-delay.js,
// this file exports no `window.X` namespace of its own — its only job is to
// register one complete definition with window.EffectCatalog at load time.
//
// DIST-1 scope (cycle 3, docs/ultron/plan.md): the first of the four
// shelved cycle-3 effects, built exactly per the D3 research decision
// (docs/ultron/research/rq3-distortion-curves.md, RQ-3 COMMITTED
// 2026-08-29):
//
//   input -> driveGain (GainNode, Drive pre-gain)
//         -> shaper (WaveShaperNode, FIXED normalized tanh soft-clip
//            curve, oversample='4x')
//         -> tone (BiquadFilterNode lowpass, Tone-mapped cutoff)
//         -> outGain (GainNode, level-guarded Output)
//         -> (whatever comes next — the downstream limiter is untouched)
//
// Why each piece is what it is (all D3, evidence tags refer to that
// record's E1–E9):
//
//   - FIXED curve + drive-in-pre-gain: WaveShaperNode copies the curve on
//     set, and re-setting a curve isn't a reliable live-update path — so
//     Drive NEVER touches the curve. The curve is computed once below; the
//     Drive param is a plain pre-gain AudioParam (live-slider-updatable
//     via AudioParamRamp, exactly the compressor pattern). tanh is
//     near-linear for |x| < ~0.3, so Drive 0 is near-transparent "warming"
//     territory (E3), and Drive 1 (~+20 dB pre-gain) pushes everything
//     deep into the soft shoulder.
//   - Normalized symmetric tanh, y = tanh(1.5x)/tanh(1.5): symmetric so
//     the output carries no DC (E2's spec note), normalized so f(1) = 1 —
//     which is what makes the Output guard below airtight: the shaper's
//     worst-case output peak is 1.0 REGARDLESS of drive.
//   - N = 2047 (ODD) so x=0 lands exactly on a curve sample — even-length
//     curves put the zero-crossing between samples (E2).
//   - oversample = '4x' (E1: spec's "highest quality" aliasing remedy;
//     Chrome-only project per E5's implementation-variance caveat).
//   - Tone: post-shaper lowpass, cutoff swept EXPONENTIALLY 1.5 kHz →
//     12 kHz across Tone 0..1 (E8 — filter frequencies are perceptual,
//     exponential by nature). Also buries any residual ultrasonic
//     residue: belt and braces on the no-audible-aliasing criterion.
//   - Output guard: outGain.gain = min(10^(dB/20), 1.0), enforced at BOTH
//     construction and applyParam — the stage can never boost past unity,
//     so "Output at max must not slam the chain" holds unconditionally
//     (even for a hand-edited preset with dB > 0), not just by slider
//     convention. The downstream limiter stays exactly as-is, final
//     safety net unchanged.
//
// Composite factory contract (AE-7 addendum in src/audio-graph.js, same
// shape as EQ/Delay/Reverb): returns {input, output, ...internal nodes} —
// buildGraph() connects the composite's .input/.output edges; applyParam
// reaches the internals by name. No change to audio-graph.js needed.

(function () {
  'use strict';

  // ---- D3-fixed constants ------------------------------------------------

  // Odd length — exact center sample at x=0 (see file-level comment).
  var CURVE_N = 2047;
  // Curve knee: y = tanh(CURVE_K * x) / tanh(CURVE_K), normalized f(1)=1.
  var CURVE_K = 1.5;
  // Drive 0..1 -> linear pre-gain 1.0 .. +20 dB (10^drive).
  var TONE_MIN_HZ = 1500;
  var TONE_MAX_HZ = 12000;

  /**
   * Build the FIXED normalized tanh soft-clip curve (computed once).
   * Symmetric (no DC), f(1)=1 (bounded output — the Output guard's
   * precondition), near-linear around 0 (subtle at low drive).
   * @returns {Float32Array}
   */
  function makeCurve() {
    var curve = new Float32Array(CURVE_N);
    var norm = Math.tanh(CURVE_K);
    for (var i = 0; i < CURVE_N; i++) {
      var x = (i / (CURVE_N - 1)) * 2 - 1; // [-1, 1]
      curve[i] = Math.tanh(CURVE_K * x) / norm;
    }
    return curve;
  }

  /**
   * Drive 0..1 -> linear pre-gain 1.0 (0 dB) .. 10 (+20 dB).
   * @param {number} drive 0..1
   * @returns {number} linear gain >= 1
   */
  function driveToGain(drive) {
    return Math.pow(10, Math.max(0, Math.min(1, drive)));
  }

  /**
   * Tone 0..1 -> lowpass cutoff, exponential sweep 1.5 kHz .. 12 kHz (E8).
   * @param {number} tone 0..1
   * @returns {number} Hz
   */
  function toneToHz(tone) {
    var t = Math.max(0, Math.min(1, tone));
    return TONE_MIN_HZ * Math.pow(TONE_MAX_HZ / TONE_MIN_HZ, t);
  }

  /**
   * Output dB -> linear gain, HARD-CAPPED at unity. The tanh curve is
   * normalized to +/-1 so the shaper's peak output is 1.0 regardless of
   * drive; capping Output at 0 dB means this stage can never boost past
   * unity — "Output at max must not slam the chain," unconditionally
   * (clamped here, not just via the UI slider's max, same defensive
   * philosophy as Delay's feedback clamp).
   * @param {number} db
   * @returns {number} linear gain in (0, 1]
   */
  function outputDbToGain(db) {
    return Math.min(Math.pow(10, db / 20), 1.0);
  }

  // Factory called by AudioGraph.buildGraph() (src/audio-graph.js) whenever
  // a model entry has type "distortion" and no existing node instance is being
  // reused for its id. Returns a COMPOSITE value, same shape as EQ/Delay.
  function createEffect(audioContext, params) {
    var p = params || {};

    var drive = typeof p.drive === 'number' ? p.drive : 0.25;
    var tone = typeof p.tone === 'number' ? p.tone : 0.7;
    var outputDb = typeof p.output === 'number' ? p.output : -3;

    // Drive pre-gain — the composite's `input`. Drive lives HERE, never in
    // the curve (see file-level comment).
    var driveGain = audioContext.createGain();
    driveGain.gain.value = driveToGain(drive);

    // Fixed tanh soft-clip shaper. curve is set once, oversample per E1.
    var shaper = audioContext.createWaveShaper();
    shaper.curve = makeCurve();
    shaper.oversample = '4x';

    // Post-shaper tone lowpass. Q left at the node's default — a gentle
    // shelf-free rolloff, not a resonant peak.
    var toneFilter = audioContext.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = toneToHz(tone);

    // Level-guarded output gain — the composite's `output`.
    var outGain = audioContext.createGain();
    outGain.gain.value = outputDbToGain(outputDb);

    // Internal wiring, done ONCE here; buildGraph() only ever connects the
    // composite's .input/.output edges to the REST of the chain.
    driveGain.connect(shaper);
    shaper.connect(toneFilter);
    toneFilter.connect(outGain);

    return {
      input: driveGain,
      output: outGain,
      driveGain: driveGain,
      shaper: shaper,
      toneFilter: toneFilter,
      outGain: outGain
    };
  }

  // UI-facing metadata plus applyParam. Plain-language labels per
  // the existing param style (Drive / Tone / Output, cycle-3 scope table).
  //
  // Issue #5: live writes are SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() (src/audio-param-ramp.js) — the click-safe
  // form the 'host-param-ramps' capability promise describes. Creation-
  // time writes in the factory above stay direct (a new node has no live
  // signal to protect yet), same convention as the compressor.
  window.EffectCatalog.register('distortion', {
    label: 'Distortion',
    experimental: false,
    // Finishing entry 4 ($impeccable polish, critique P3-4): drive/tone
    // carry `displayScale: 100` — a READOUT-ONLY field the generic
    // formatter in src/param-controls.js multiplies into the mono value
    // span so these two read "25%"/"70%" like every other % param on the
    // surface (Mix "30%"), not "0.25%"/"0.7%". min/max/step/default above
    // stay on the internal 0..1 scale EXACTLY as before — the slider, the
    // model, AudioGraph bookkeeping, preset serialization (a saved drive
    // 0.25 still means the same sound), and the agent set_param contract
    // (mcp-tools validates against these min/max) are all unchanged. Like
    // label/step, displayScale is UI-only and deliberately NOT mirrored in
    // EffectCatalog metadata (its capabilities readout
    // truthfully keeps publishing drive/tone as 0..1).
    paramSpec: [
      { id: 'drive', label: 'Drive', min: 0, max: 1, default: 0.25, step: 0.01, unit: '%', displayScale: 100 },
      { id: 'tone', label: 'Tone', min: 0, max: 1, default: 0.7, step: 0.01, unit: '%', displayScale: 100 },
      { id: 'output', label: 'Output', min: -24, max: 0, default: -3, step: 0.5, unit: 'dB' }
    ],
    create: createEffect,
    applyParam: function (nodeInstance, paramId, value) {
      if (paramId === 'drive') {
        window.AudioParamRamp.schedule(nodeInstance.driveGain.gain, driveToGain(value));
      } else if (paramId === 'tone') {
        window.AudioParamRamp.schedule(nodeInstance.toneFilter.frequency, toneToHz(value));
      } else if (paramId === 'output') {
        // Unity cap enforced here too, not just in the factory — the guard
        // must hold for ANY write path (UI slider, agent set_param, or a
        // hand-edited preset), not merely by UI convention.
        window.AudioParamRamp.schedule(nodeInstance.outGain.gain, outputDbToGain(value));
      }
    }
  });
})();
