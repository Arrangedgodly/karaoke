// AudioWorklet module — the audio-thread side of the cycle-3 noise gate
// (GATE-1). NOT a <script> in index.html: exactly like
// src/watchdog-worklet.js, this file is loaded BY URL from src/node-gate.js
// via `audioContext.audioWorklet.addModule('src/gate-worklet.js')` (the
// same page-relative path convention as every other src/ reference —
// works unchanged on localhost:8000 and on GitHub Pages).
//
// Why a worklet at all (D1, docs/ultron/research/rq1-noise-gate.md — the
// committed RQ-1 decision): Web Audio has no native gate node, and both
// main-thread alternatives structurally fail the bar — rAF-polled
// analysers are 10–30 ms late on onsets AND freeze in hidden tabs (the
// exact issue #7 failure the watchdog worklet was created to fix), while
// scheduled-GainNode automation races live AudioParamRamp writes and
// chatters. This processor makes every decision on the audio thread,
// sample-accurately, immune to tab visibility:
//
//   input ──► [5 ms look-ahead ring delay, one per channel]
//                 │
//                 ▼
//   per-block RMS (channel 0) ──► one-pole envelope (fast rise / slow fall)
//                 │
//                 ▼
//   hysteresis decision: OPEN at envelope >= Threshold,
//                        CLOSE below Threshold − 6 dB (the hysteresis band
//                        in between holds the current state — no chatter)
//                 │
//                 ▼
//   50 ms hold countdown (runs ONLY below the close threshold) ──►
//   per-sample dB-linear gain ramp between Floor and 0 dB
//                 │
//                 ▼
//   out[c][i] = delayed[c][i] × 10^(gateDb / 20)
//
// The four exposed params (Threshold / Attack / Release / Floor) are REAL
// AudioParams via static parameterDescriptors (all k-rate — gate constants
// never need audio-rate automation), so src/node-gate.js's applyParam is
// four AudioParamRamp.schedule() calls with zero new machinery. Everything
// else — hysteresis, hold, look-ahead, detector ballistics — is a FIXED
// internal constant per D1's "param set is fixed by scope" rule; each is
// a named constant below with its rationale, tunable in one place.
//
// Look-ahead timing (the property that spares attack consonants): the
// detector consumes input UNdelayed while the audio rides the 5 ms ring,
// so the gain ramp leads the program by exactly LOOKAHEAD_S. With the
// 5 ms default Attack the ramp is complete the sample BEFORE a transient
// emerges. Bypass-clean verification aid: at Floor = 0 dB the closed gain
// equals the open gain (x × 1.0 is bit-exact IEEE float), so the node is
// passthrough-exact — the only processing left is the fixed 5 ms delay,
// D1's explicitly accepted tradeoff (Bypass reroutes around the whole
// chain, src/audio-bypass.js).
//
// Zero dependencies, no build step, ES module scope (AudioWorklet modules
// are loaded as modules — `class`/`const` are fine here even though the
// rest of src/ is ES5 IIFE style, same as watchdog-worklet.js).
'use strict';

// ---- D1-fixed internal constants (NOT exposed — the param set is fixed) --

// Hysteresis: the gate CLOSES this many dB BELOW the open threshold, so a
// signal hovering at threshold cannot flutter the gate (the −6 dB band
// between the two thresholds holds whatever state the gate is in).
const HYSTERESIS_DB = 6;

// Hold: minimum-open countdown, in seconds, that starts only once the
// envelope has fallen below the CLOSE threshold; the release ramp may not
// begin until it expires. Bridges consonant-peak gaps and breath tails;
// D1 chose 50 ms as conservative for sung vocals with a 150 ms release.
const HOLD_S = 0.05;

// Look-ahead: the internal delay the DECISION runs ahead of the audio.
// Matches the 5 ms default Attack so the gain is already fully open when
// the transient arrives; 5 ms added latency is imperceptible (< the
// ~10 ms monitoring bar) and irrelevant while Bypass is engaged.
const LOOKAHEAD_S = 0.005;

// ---- Implementation constants (detector ballistics + defenses) ----------

// Envelope value for digital silence (and the log10 floor for block RMS).
const DB_FLOOR = -180;
const LIN_FLOOR = 1e-9;

// One-pole envelope follower time constants, evaluated once per render
// quantum on the block RMS. Rise is near-instant (~1 ms) so an onset is
// detected on the first loud block; fall is slower (15 ms) so one quiet
// block between syllables does not read as silence. The follower only
// stabilizes the DECISION — audible open/close shaping is exclusively the
// Attack/Release ramps and the hold, never the follower.
const ENV_RISE_S = 0.001;
const ENV_FALL_S = 0.015;

// Param-read defenses. parameterDescriptors' minValue/maxValue already
// clamp real AudioParams; these re-clamp on read so a damaged array (or a
// non-browser harness) can never produce a degenerate ramp rate.
const THRESH_MIN_DB = -80;
const THRESH_MAX_DB = 0;
const FLOOR_MIN_DB = -60;
const FLOOR_MAX_DB = 0;
const MIN_RAMP_S = 1e-4;

// Initial gain. Deep-closed; the [Floor, 0] clamp below pulls it up to
// Floor on the very first block — a gate must never START open into a
// silent room, and at Floor = 0 dB this still means unity from sample 0.
const GATE_START_DB = -240;

/**
 * Clamp a dB value into [lo, hi].
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clampDb(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Read one value from a (k-rate) parameter array with a fallback default.
 * @param {Float32Array|number[]} arr
 * @param {number} fallback
 * @returns {number}
 */
function paramValue(arr, fallback) {
  return arr && arr.length ? arr[0] : fallback;
}

class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._envDb = DB_FLOOR; // smoothed detector level, dB
    this._gateDb = GATE_START_DB; // current gain, dB (ramps in dB domain)
    this._linGain = Math.pow(10, GATE_START_DB / 20); // cached 10^(gateDb/20)
    this._holdRemaining = 0; // samples of hold left before release may start
    this._delayLines = []; // per-channel look-ahead rings (lazy, Float32Array)
    this._delayPos = 0; // shared ring position (same LOOKAHEAD for every channel)
    // >= 1 sample at any sane rate; Math.max guards the absurd ones.
    this._laN = Math.max(1, Math.round(LOOKAHEAD_S * sampleRate));
  }

  static get parameterDescriptors() {
    // Ranges and defaults are D1's paramSpec table verbatim; k-rate
    // because gate constants never need audio-rate automation (a fresh
    // value every render quantum is decision-grade timing).
    return [
      { name: 'threshold', defaultValue: -50, minValue: -80, maxValue: 0, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 0.005, minValue: 0.001, maxValue: 0.5, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.15, minValue: 0.01, maxValue: 2, automationRate: 'k-rate' },
      { name: 'floor', defaultValue: -40, minValue: -60, maxValue: 0, automationRate: 'k-rate' }
    ];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0 || !output[0]) {
      return true; // nothing to fill this quantum — stay alive regardless
    }
    const n = output[0].length;

    // -- 1) Detector: block RMS of channel 0 -> dB -> one-pole envelope.
    // Channel 0 is the decision channel (the watchdog worklet's same
    // convention — the app's bus is the forced mono down-mix upstream of
    // any stereo-izing effect); every channel gets the SAME gain below.
    const in0 = input && input.length > 0 ? input[0] : null;
    let blockDb = DB_FLOOR;
    if (in0 && in0.length > 0) {
      let sumSq = 0;
      for (let i = 0; i < in0.length; i++) {
        sumSq += in0[i] * in0[i];
      }
      const rms = Math.sqrt(sumSq / in0.length);
      blockDb = rms > LIN_FLOOR ? 20 * Math.log10(rms) : DB_FLOOR;
    }
    const blockDur = in0 && in0.length > 0 ? in0.length / sampleRate : 128 / sampleRate;
    const tc = blockDb > this._envDb ? ENV_RISE_S : ENV_FALL_S;
    this._envDb += (1 - Math.exp(-blockDur / tc)) * (blockDb - this._envDb);

    // -- 2) Decision constants for this block (k-rate => one value each).
    const threshDb = clampDb(paramValue(parameters.threshold, -50), THRESH_MIN_DB, THRESH_MAX_DB);
    const closeDb = threshDb - HYSTERESIS_DB;
    const floorDb = clampDb(paramValue(parameters.floor, -40), FLOOR_MIN_DB, FLOOR_MAX_DB);
    const attackS = Math.max(MIN_RAMP_S, paramValue(parameters.attack, 0.005));
    const releaseS = Math.max(MIN_RAMP_S, paramValue(parameters.release, 0.15));
    const openNow = this._envDb >= threshDb;
    const closeNow = this._envDb < closeDb;
    const holdSamples = Math.round(HOLD_S * sampleRate);
    // dB-domain ramp speeds: the full Floor..0 span over Attack / Release
    // seconds, per sample. dB-linear ramps avoid the level-dependent speed
    // error of linear-in-gain ramps (D1's gain-curve decision).
    const attackStep = (0 - floorDb) / (attackS * sampleRate);
    const releaseStep = (0 - floorDb) / (releaseS * sampleRate);

    // -- 3) Per sample: hold countdown, dB ramp, look-ahead ring, gain.
    // Decision flags are block-constant (per-block detector), but the hold
    // countdown and the ramp advance per SAMPLE so hold expiry and gain
    // movement are sample-accurate. In the hysteresis band NEITHER flag is
    // set: the hold freezes (does not run down, does not re-arm) and the
    // gate simply keeps its current trajectory — the anti-chatter property.
    for (let i = 0; i < n; i++) {
      if (openNow) {
        this._holdRemaining = holdSamples; // re-armed while clearly open
      } else if (closeNow && this._holdRemaining > 0) {
        this._holdRemaining--; // runs down ONLY below the close threshold
      }
      const opening = openNow || this._holdRemaining > 0;
      let gd = this._gateDb + (opening ? attackStep : -releaseStep);
      // Clamp into [Floor, 0]. The low clamp also lands a closed gate on a
      // live-lowered Floor param at block cadence (the AudioParam itself
      // ramps over ~15 ms; steps in the <= 1% gain region are inaudible).
      if (gd > 0) {
        gd = 0;
      }
      if (gd < floorDb) {
        gd = floorDb;
      }
      if (gd !== this._gateDb) {
        this._gateDb = gd;
        this._linGain = Math.pow(10, gd / 20); // recompute only on change
      }
      const g = this._linGain;
      for (let c = 0; c < output.length; c++) {
        const outCh = output[c];
        const inCh = input && c < input.length ? input[c] : null;
        let s = 0;
        if (inCh) {
          // Read the sample from LOOKAHEAD_S ago, then overwrite the slot
          // with the current input — the ring is exactly _laN long, so the
          // value read was written _laN iterations back. Per-channel rings
          // (one shared position) keep every channel time-aligned so a
          // stereo bus (e.g. post-chorus) never skews.
          let line = this._delayLines[c];
          if (!line) {
            line = this._delayLines[c] = new Float32Array(this._laN);
          }
          s = line[this._delayPos];
          line[this._delayPos] = inCh[i];
        }
        outCh[i] = s * g; // at gain 1.0 this is a bit-exact copy (IEEE)
      }
      this._delayPos = (this._delayPos + 1) % this._laN;
    }
    return true; // a gate in the chain must never idle out
  }
}

registerProcessor('noise-gate', NoiseGateProcessor);
