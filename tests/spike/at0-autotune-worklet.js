// AT-0 DISPOSABLE SPIKE PROTOTYPE — DO NOT SHIP.
//
// This file is NOT in src/, is NOT referenced by index.html, and is NOT
// registered anywhere in the app. It exists only to answer the cycle-3
// AT-0 question (docs/ultron/plan.md; decision D2 in
// docs/ultron/research/rq2-autotune-feasibility.md): can YIN pitch
// detection + TD-PSOLA pitch shifting run artifact-free in ONE
// AudioWorklet within the ~10-20 ms latency budget on
// assets/test-vocal.mp3?
//
// It is written exactly like a real AudioWorklet module (same shape as
// src/gate-worklet.js: registerProcessor + class extends
// AudioWorkletProcessor, ES module scope) so whatever the spike proves
// transfers 1:1 to an AT-1 src/ implementation — but it carries
// SPIKE-ONLY debug telemetry (this._dbgFrames/_dbgBlocks) that a
// production node must not have.
//
// Algorithm (D2's recommended approach, one worklet):
//
//   input ──► ring buffer (absolute-indexed, 8192, masked)
//                 │
//                 ├─► YIN detector every HOP samples (5 ms): difference
//                 │   function via the FFT autocorrelation trick,
//                 │   cumulative-mean normalization, 0.15 absolute
//                 │   threshold, parabolic interpolation → {f0,
//                 │   clarity}; median-of-3 + 2-of-3 voicing; clarity
//                 │   and RMS gates = the aperiodicity gate (sibilants
//                 │   pass through unshifted).
//                 │
//                 ├─► scale snap (Chromatic/Major/Minor × 12 keys) with
//                 │   ±0.6-semitone target hysteresis, correction
//                 │   clamped ±6 semitones; Retune = one-pole smoothing
//                 │   of the ratio PER OUTPUT EPOCH (0 ms = hard snap,
//                 │   150-300 ms = slow glide — D2's two-outcome shape).
//                 │
//                 ├─► epoch markers: max-|x| peak-picked once per
//                 │   detected input period, refined ±0.25·T.
//                 │
//                 └─► TD-PSOLA synthesis: 2T Hann grains re-spliced at
//                     output spacing T/ratio; nearest-marker selection
//                     gives duplication (upshift) / skipping (downshift)
//                     with no drift; overlap-add + WINDOW-SUM accumulator
//                     (÷ normalization kills the classic PSOLA amplitude
//                     modulation when spacing ≠ COLA); voiced⇄unvoiced and
//                     grain-coverage gaps = ~3 ms fade to the dry path.
//
//   Latency: a DECLARED fixed algorithmic delay of 20 ms — emission of
//   output position oi waits for input to oi + D (grains at oi read
//   input up to ~2.1 periods ahead). Content stays index-aligned; the
//   delay is the emission hold-back inLen - outLen = D. D covers the wet
//   path down to ~104 Hz; below that, samples pass dry (starve counter).

'use strict';

// ---- Fixed DSP constants (spike choices; every number is measured) --------

const F_MIN = 100;            // Hz — the bar only requires f0 >= 110 Hz
const F_MAX = 1000;           // Hz — soprano head-voice ceiling
const YIN_WIN = 960;          // difference-function window (>= 2*tauMax)
const HOP = 240;              // detection cadence: 5 ms @ 48 kHz
const FFT_SIZE = 2048;        // >= YIN_WIN + tauMax (1440), power of two
const YIN_THRESHOLD = 0.15;   // YIN absolute threshold (15% variant)
const CLARITY_GATE = 0.7;     // 1 - d'(tau); below = unvoiced/sibilant
const RMS_GATE = 1e-3;        // -60 dBFS analysis-window floor
const MAX_SEMI = 6;           // correction clamp, semitones
const RING = 8192;
const MASK = RING - 1;
// Declared algorithmic delay. The wet path needs input ~2.1 periods ahead
// of the emission position; 20 ms covers that down to ~104 Hz. This IS
// the node's added-latency number — the bar is ~10-20 ms.
const DELAY_S = 0.020;
const DELAY_N = Math.round(DELAY_S * sampleRate);
const FADE_TC_S = 0.003;      // voiced/unvoiced crossfade time constant

const TAU_MIN = Math.max(16, Math.floor(sampleRate / F_MAX));
const TAU_MAX = Math.floor(sampleRate / F_MIN);

// Scale degree sets (semitone offsets from the key root).
const SCALES = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],   // 0 chromatic
  [0, 2, 4, 5, 7, 9, 11],                    // 1 major
  [0, 2, 3, 5, 7, 8, 10]                     // 2 natural minor
];

// ---- DSP helpers ----------------------------------------------------------

/** In-place iterative radix-2 FFT on Float64Array re/im (power of two). */
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] += vr; im[a] += vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/**
 * One YIN analysis over win[0..YIN_WIN) — the ORIGINAL paper formulation
 * with the shrinking comparison window:
 *   d(tau) = sum_{j<W-tau} (x[j]-x[j+tau])^2
 *          = eA(tau) + eB(tau) - 2·r(tau)
 * where r(tau) = sum_{j<W-tau} x[j]x[j+tau] is EXACTLY the zero-padded
 * linear autocorrelation (one |FFT|^2), and eA/eB come from prefix sums.
 * CMND normalization, 0.15-threshold dip search, parabolic refine.
 * Returns { f0, clarity } — f0 = 0 when no period dips under threshold.
 */
function yinAnalyze(win, dBuf, cmndBuf, fftRe, fftIm, pre) {
  const W = YIN_WIN;
  // r(tau) via power spectrum + swap-trick inverse FFT (the real, even
  // autocorrelation lands in fftRe — verified numerically in the spike).
  fftRe.fill(0); fftIm.fill(0);
  for (let i = 0; i < W; i++) fftRe[i] = win[i];
  fftInPlace(fftRe, fftIm);
  for (let i = 0; i < FFT_SIZE; i++) {
    fftRe[i] = fftRe[i] * fftRe[i] + fftIm[i] * fftIm[i];
    fftIm[i] = 0;
  }
  fftInPlace(fftIm, fftRe);
  const inv = 1 / FFT_SIZE;

  let run = 0;
  pre[0] = 0;
  for (let i = 0; i < W; i++) {
    run += win[i] * win[i];
    pre[i + 1] = run;
  }

  let dSum = 0;
  dBuf[0] = 1; cmndBuf[0] = 1;
  for (let tau = 1; tau <= TAU_MAX; tau++) {
    const eA = pre[W - tau];              // sum x[j]^2, j < W-tau
    const eB = pre[W] - pre[tau];         // sum x[j]^2, tau <= j < W
    let d = eA + eB - 2 * fftRe[tau] * inv;
    if (d < 0) d = 0;
    dBuf[tau] = d;
    dSum += d;
    cmndBuf[tau] = dSum > 0 ? (d * tau) / dSum : 1;
  }

  let tauEst = -1;
  for (let tau = TAU_MIN; tau <= TAU_MAX; tau++) {
    if (cmndBuf[tau] < YIN_THRESHOLD) {
      while (tau + 1 <= TAU_MAX && cmndBuf[tau + 1] < cmndBuf[tau]) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) {
    // No dip under threshold: report the global min as voicing evidence.
    let best = TAU_MIN;
    for (let tau = TAU_MIN + 1; tau <= TAU_MAX; tau++) {
      if (cmndBuf[tau] < cmndBuf[best]) best = tau;
    }
    return { f0: 0, clarity: 1 - cmndBuf[best] };
  }
  let refined = tauEst;
  if (tauEst > TAU_MIN && tauEst < TAU_MAX) {
    const y1 = cmndBuf[tauEst - 1], y2 = cmndBuf[tauEst], y3 = cmndBuf[tauEst + 1];
    const denom = y1 - 2 * y2 + y3;
    if (Math.abs(denom) > 1e-12) {
      const delta = 0.5 * (y1 - y3) / denom;
      if (delta > -1 && delta < 1) refined = tauEst + delta;
    }
  }
  return { f0: sampleRate / refined, clarity: 1 - cmndBuf[tauEst] };
}

// ---- The processor --------------------------------------------------------

class SpikeAutotuneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._inRing = new Float32Array(RING);
    this._inLen = 0;              // absolute input samples received
    // Content cursor, starts at -D: block k emits content [128k-D,
    // 128(k+1)-D), so the output stream IS the input delayed by D and the
    // delay is directly measurable offline (output index = content + D).
    this._outLen = -DELAY_N;
    this._ola = new Float32Array(RING);
    this._wsum = new Float32Array(RING);
    this._frameWin = new Float32Array(YIN_WIN);
    this._dBuf = new Float64Array(TAU_MAX + 1);
    this._cmnd = new Float64Array(TAU_MAX + 1);
    this._pre = new Float64Array(YIN_WIN + 1);
    this._fftRe = new Float64Array(FFT_SIZE);
    this._fftIm = new Float64Array(FFT_SIZE);
    this._nextFrameC = YIN_WIN / 2;   // next detection frame center
    this._frames = [];                // last 3 {f0, clarity, rms}
    this._voiced = false;
    this._f0 = 0;
    this._markers = [];               // [{p, T}] absolute positions
    this._markerCursor = 0;
    this._nextMarkerP = 0;
    this._synPos = 0;                 // float; next output-epoch position
    this._ratioS = 1;                 // smoothed shift ratio
    this._targetMidi = null;          // snap hysteresis state
    this._fade = 0;
    this._fadeStep = 1 - Math.exp(-1 / (FADE_TC_S * sampleRate));
    this._lastSp = -1;              // last placed grain position (telemetry)
    this._wasVoiced = false;
    this._starveVoiced = 0;           // voiced samples emitted dry (grains late)
    this._epochs = 0;                 // grains placed (CPU cross-check)
    // SPIKE-ONLY telemetry (a shipped node would postMessage summaries
    // off the audio path or nothing at all):
    this._dbgFrames = [];             // per YIN frame
    this._dbgBlocks = [];             // per process() block
  }

  static get parameterDescriptors() {
    return [
      { name: 'key', defaultValue: 0, minValue: 0, maxValue: 11, automationRate: 'k-rate' },
      { name: 'scale', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'retune', defaultValue: 0, minValue: 0, maxValue: 500, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  /** Nearest allowed note (midi) to `midi` in key/scale. */
  _snapMidi(midi, key, scale) {
    const set = SCALES[scale] || SCALES[0];
    const midiR = Math.round(midi);
    const rel = (((midiR - key) % 12) + 12) % 12;
    if (set.indexOf(rel) !== -1) return midiR;
    let up = 1;
    while (up < 12 && set.indexOf((rel + up) % 12) === -1) up++;
    let dn = 1;
    while (dn < 12 && set.indexOf((rel - dn + 12) % 12) === -1) dn++;
    const dUp = (midiR + up) - midi;
    const dDn = midi - (midiR - dn);
    return dUp < dDn ? midiR + up : midiR - dn;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0 || !output[0]) return true;
    const n = output[0].length;
    const in0 = inputs[0] && inputs[0].length > 0 ? inputs[0][0] : null;

    const key = Math.round(parameters.key ? parameters.key[0] : 0);
    const scale = Math.round(parameters.scale ? parameters.scale[0] : 0);
    const retuneS = Math.max(0, parameters.retune ? parameters.retune[0] : 0) / 1000;
    const mix = parameters.mix ? Math.max(0, Math.min(1, parameters.mix[0])) : 1;

    // -- 1) Ingest into the ring.
    for (let i = 0; i < n; i++) {
      this._inRing[(this._inLen + i) & MASK] = in0 ? in0[i] : 0;
    }
    this._inLen += n;
    const blockStart = this._outLen;
    const blockEnd = this._outLen + n;

    // -- 2) YIN frames while the W-window [c-W/2, c+W/2) fits.
    while (this._nextFrameC + YIN_WIN / 2 <= this._inLen) {
      const start = this._nextFrameC - YIN_WIN / 2;
      const win = this._frameWin;
      let sumSq = 0;
      for (let i = 0; i < win.length; i++) {
        const v = this._inRing[(start + i) & MASK];
        win[i] = v;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / win.length);
      const res = yinAnalyze(win, this._dBuf, this._cmnd, this._fftRe, this._fftIm, this._pre);
      this._frames.push({ f0: res.f0, clarity: res.clarity, rms: rms });
      this._dbgFrames.push({
        c: this._nextFrameC, f0: res.f0, clar: res.clarity, rms: rms
      });
      if (this._frames.length > 3) this._frames.shift();
      this._nextFrameC += HOP;
    }

    // -- 3) Median-of-3 detection + 2-of-3 voicing.
    const voicedFrames = this._frames.filter(function (f) {
      return f.f0 > 0 && f.clarity >= CLARITY_GATE && f.rms >= RMS_GATE;
    });
    let voiced = voicedFrames.length >= 2;
    let f0 = 0;
    if (voiced) {
      const vs = voicedFrames.map(function (f) { return f.f0; })
        .sort(function (a, b) { return a - b; });
      f0 = vs[Math.floor(vs.length / 2)];
      if (f0 < sampleRate / TAU_MAX || f0 > sampleRate / TAU_MIN) voiced = false;
    }
    this._voiced = voiced;
    this._f0 = f0;
    const T = voiced ? Math.round(sampleRate / f0) : TAU_MAX;

    // -- 4) Scale snap (+ hysteresis) → ratio target.
    let ratioT = 1;
    if (voiced) {
      const midi = 69 + 12 * Math.log(f0 / 440) / Math.LN2;
      let tgt = this._targetMidi;
      if (tgt === null) {
        // Stability-gated FIRST snap: an onset transient (window
        // straddling silence) must not lock a wrong note inside the
        // hysteresis band — require the voiced frames to agree within
        // 30 cents before committing a target. Until then: no shift.
        let stable = voicedFrames.length >= 2;
        if (stable) {
          let mn = Infinity, mx = 0;
          for (let vi = 0; vi < voicedFrames.length; vi++) {
            const vf = voicedFrames[vi].f0;
            if (vf < mn) mn = vf;
            if (vf > mx) mx = vf;
          }
          stable = 1200 * Math.log(mx / mn) / Math.LN2 < 30;
        }
        if (stable) tgt = this._snapMidi(midi, key, scale);
      } else {
        const d = midi - tgt;
        // Retarget as soon as another note is genuinely nearer (the ±0.5
        // snap boundary) plus a 2-cent margin, confirmed on TWO
        // consecutive detection frames. The margin must stay TINY: onset
        // estimates run biased (windows straddle the note edge; measured
        // +12 to +19 cents in the spike), and a biased first lock that
        // lands across a boundary can only be corrected if steady state
        // still exceeds the band — a wide band locks a semitone-wrong
        // note permanently. Chatter at boundaries during vibrato is the
        // RETUNE smoothing's job (the classic hard-tune staircase), not
        // the target state's.
        if (d > 0.52 || d < -0.52) {
          this._overLimit = (this._overLimit || 0) + 1;
          if (this._overLimit >= 2) {
            tgt = this._snapMidi(midi, key, scale);
            this._overLimit = 0;
          }
        } else {
          this._overLimit = 0;
        }
      }
      if (tgt !== null && SCALES[scale].indexOf((((tgt - key) % 12) + 12) % 12) === -1) {
        tgt = this._snapMidi(midi, key, scale);  // key/scale change mid-note
      }
      this._targetMidi = tgt;
      if (tgt !== null) {
        let semi = tgt - midi;
        if (semi > MAX_SEMI) semi = MAX_SEMI;
        if (semi < -MAX_SEMI) semi = -MAX_SEMI;
        ratioT = Math.pow(2, semi / 12);
      }
    } else {
      this._targetMidi = null;
      this._overLimit = 0;
    }

    // -- 5) Epoch markers. On voicing onset, reseed at the frontier.
    const onsetNow = voiced && !this._wasVoiced;
    if (onsetNow) {
      this._markers = [];
      this._markerCursor = 0;
      const seed = Math.max(0, this._outLen);   // outLen < 0 during warm-up
      this._nextMarkerP = seed;
      // Seed the synthesis grid at the FIRST marker (not at the frontier):
      // keeps the grain-read offset near 0 instead of a constant ~T/2.
      this._synPos = null;
      this._ratioS = 1;
    }
    if (voiced) {
      const lo = Math.floor(0.75 * T), hi = Math.ceil(1.25 * T);
      while (this._nextMarkerP + hi <= this._inLen) {
        let best = this._nextMarkerP + lo, bestA = -1;
        for (let p = this._nextMarkerP + lo; p <= this._nextMarkerP + hi; p++) {
          const a = Math.abs(this._inRing[p & MASK]);
          if (a > bestA) { bestA = a; best = p; }
        }
        this._markers.push({ p: best, T: T });
        if (this._synPos === null) this._synPos = best;
        this._nextMarkerP = best;
      }
      while (this._markers.length > 2 && this._markerCursor > 1 &&
        this._markers[1].p < this._outLen - 3 * TAU_MAX) {
        this._markers.shift();
        this._markerCursor--;
      }
    }
    this._wasVoiced = voiced;

    // -- 6) Grain placement + per-sample emission.
    //
    // Block k emits CONTENT [128k-D, 128(k+1)-D) (outLen starts at -D, so
    // the output stream is the input delayed by exactly D — measurable
    // offline as an index shift). Content position p needs input to
    // ~p + 2.1T for its grains; with emission trailing input by D that is
    // always available for T <= ~D/2.1 (f0 >= ~104 Hz). Wet/dry switching
    // is time-aligned by construction (a grain at sp reads input
    // [sp-T, sp+T]; dry[p] is input[p]); grain-coverage gaps pass dry
    // with the fade pulled to 0. Content p < 0 is delay-line warm-up
    // silence.
    const inRing = this._inRing, ola = this._ola, wsum = this._wsum;
    let starvedThisBlock = 0;
    for (let oi = blockStart; oi < blockEnd; oi++) {
      // Place every output epoch whose marker decision is certain and
      // whose grain has fully arrived.
      for (;;) {
        if (this._markers.length === 0 || this._synPos === null) break;
        let cur = this._markerCursor;
        while (cur + 1 < this._markers.length &&
          Math.abs(this._markers[cur + 1].p - this._synPos) <=
          Math.abs(this._markers[cur].p - this._synPos)) cur++;
        this._markerCursor = cur;
        const mk = this._markers[cur];
        const sp = Math.round(this._synPos);
        const lastP = this._markers[this._markers.length - 1].p;
        if (lastP < sp + 0.75 * mk.T) break;   // nearest marker not yet decided
        if (mk.p + mk.T > this._inLen) break;  // grain tail not yet arrived
        // Per-epoch retune smoothing (retune 0 → snap within one epoch).
        const tcSamp = Math.max(retuneS, 5 / sampleRate) * sampleRate;
        const step = 1 - Math.exp(-((mk.T / this._ratioS) / tcSamp));
        this._ratioS += step * (ratioT - this._ratioS);
        const Tm = mk.T;
        for (let k = -Tm; k < Tm; k++) {
          const d = sp + k;
          if (d < this._outLen) continue;  // never write into emitted history
          const w = 0.5 * (1 + Math.cos(Math.PI * k / Tm));
          const di = d & MASK;
          ola[di] += inRing[(mk.p + k) & MASK] * w;
          wsum[di] += w;
        }
        this._epochs++;
        this._lastSp = sp;
        this._synPos += Tm / this._ratioS;
      }

      if (oi < 0) {
        // Delay-line warm-up: content position before stream start.
        for (let c = 0; c < output.length; c++) output[c][oi - blockStart] = 0;
        this._outLen++;
        continue;
      }
      const dry = inRing[oi & MASK];
      let val;
      const ws = wsum[oi & MASK];
      if (ws > 0.05) {
        const wet = ola[oi & MASK] / ws;
        const fadeTarget = voiced ? 1 : 0;
        this._fade += this._fadeStep * (fadeTarget - this._fade);
        val = this._fade * wet + (1 - this._fade) * dry;
      } else {
        // No grain coverage: dry, fade toward 0 so a later wet arrival
        // fades IN over ~3 ms instead of jumping in at full level.
        this._fade += this._fadeStep * (0 - this._fade);
        val = dry;
        if (voiced) { this._starveVoiced++; starvedThisBlock++; }
      }
      ola[oi & MASK] = 0;
      wsum[oi & MASK] = 0;
      for (let c = 0; c < output.length; c++) {
        output[c][oi - blockStart] = mix * val + (1 - mix) * dry;
      }
      this._outLen++;
    }

    this._dbgBlocks.push({
      inLen: this._inLen, outLen: this._outLen, voiced: voiced ? 1 : 0,
      f0: f0, ratioT: ratioT, ratioS: this._ratioS,
      starved: starvedThisBlock,
      tgt: this._targetMidi,
      wetLag: this._lastSp > 0 ? this._inLen - this._lastSp : -1
    });
    return true;
  }
}

registerProcessor('spike-autotune', SpikeAutotuneProcessor);
