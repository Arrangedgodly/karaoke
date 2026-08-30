// AudioWorklet module — the audio-thread side of the cycle-3 autotune
// (AT-1), built on the AT-0 spike's HARD-TUNE PASS verdict
// (docs/ultron/research/at0-spike-result.md; feasibility decision D2 in
// docs/ultron/research/rq2-autotune-feasibility.md). NOT a <script> in
// index.html: exactly like src/gate-worklet.js, this file is loaded BY URL
// from src/node-autotune.js via
// `audioContext.audioWorklet.addModule('src/autotune-worklet.js')`.
//
// The engine is a 1:1 port of the measured spike prototype
// (tests/spike/at0-autotune-worklet.js) with three production changes:
//   1. NO telemetry: the spike's `_dbg*` arrays are gone (they grew
//      unboundedly; AT-0 §5 explicitly bars them from the shipped node).
//   2. ALLOCATION-FREE per-block path: the spike's `{f0,clarity,rms}` frame
//      objects and `{p,T}` marker objects (push/shift every 5 ms / every
//      period) are preallocated scalar ring buffers now — no GC pressure on
//      the audio thread (AT-0's CPU reproducibility note blamed exactly the
//      telemetry/filter/map allocations for offline GC outliers).
//   3. Per-channel dry rings: mix = 0 is bit-exact per-channel dry
//      (D-delayed) even on a stereo bus (the spike duplicated channel 0 to
//      every channel on the dry leg).
//
// The four AT-0 §4 failure lessons are structural here and regression-
// tested in tests/test-autotune-node.js:
//   L1  YIN uses the ORIGINAL shrinking-window formulation
//       (d(τ) = Σ_{j<W−τ}(x[j]−x[j+τ])²) computed via the FFT
//       autocorrelation trick + prefix-sum energies; the swap-trick inverse
//       FFT lands the real, even autocorrelation in the FIRST array
//       argument of the second transform (see yinAnalyze). The fixed-W
//       variant silently computes the wrong d(τ) — clarity ≈ 1.0 at the
//       WRONG period.
//   L2  The algorithmic delay is a FIXED DECLARED constant (D = 20 ms):
//       the output content cursor starts at −D and emission advances 1:1
//       with input, forever. Adaptive emission margins structurally stall
//       in lockstep block processing (AT-0 reproduced the deadlock).
//   L3  Grains are NEVER written into already-emitted ring positions
//       (the `d < this._outLen` guard) — stale-data pollution otherwise
//       appears one ring-wrap later.
//   L4  The snap state machine hugs the ±0.5-semitone boundary with
//       ±0.52 st + 2-frame confirmation, plus a stability-gated FIRST lock
//       (onset windows are biased +12..+19c; a wide target band locks a
//       semitone-wrong note that steady state can never correct). Chatter
//       protection is the retune smoothing's job, not the band's.
//
// Declared internal delay: 20 ms (960 samples @ 48 kHz) on BOTH the wet
// and dry legs — the node's added-latency number, measured exactly 20.0 ms
// on every path in AT-0. It keeps the wet path feasible down to ~104 Hz;
// below that, samples pass dry. D is sized for TEST-1's range (f0 p2 =
// 115.7 Hz): D = 15 ms would only cover ≥ ~140 Hz, D = 24 ms would cover
// ~85 Hz (AT-0 §2C's documented trade).
//
// Zero dependencies, no postMessage on the audio path, ES module scope.
'use strict';

// ---- Fixed DSP constants (every number is AT-0-measured; see the record) ---

const F_MIN = 100;            // Hz — wet-path support floor is ~104 Hz via D
const F_MAX = 1000;           // Hz — soprano head-voice ceiling
const YIN_WIN = 960;          // difference-function window (>= 2*tauMax/2, measured)
const HOP = 240;              // detection cadence: 5 ms @ 48 kHz
const FFT_SIZE = 2048;        // >= YIN_WIN + tauMax (1440), power of two
const YIN_THRESHOLD = 0.15;   // YIN absolute threshold (15% variant)
const CLARITY_GATE = 0.7;     // 1 - d'(tau); below = unvoiced/sibilant
const RMS_GATE = 1e-3;        // -60 dBFS analysis-window floor
const MAX_SEMI = 6;           // correction clamp, semitones
const RING = 8192;            // input ring; > D + 3*TAU_MAX headroom
const MASK = RING - 1;
// L2: the one declared latency constant (see file header). NOT adaptive.
const DELAY_S = 0.020;
const DELAY_N = Math.round(DELAY_S * sampleRate);
const FADE_TC_S = 0.003;      // voiced/unvoiced crossfade time constant

const TAU_MIN = Math.max(16, Math.floor(sampleRate / F_MAX));
const TAU_MAX = Math.floor(sampleRate / F_MIN);

// Retarget band (L4): a semitone boundary sits at ±0.5; the +0.02 margin
// plus 2-frame confirmation keeps biased onsets correctable while never
// retargeting on steady-state vibrato.
const RETARGET_SEMI = 0.52;
// First-lock stability: voiced frames must agree within this before the
// first target commits (onset windows straddle silence → biased f0).
const LOCK_SPREAD_CENTS = 30;

// Epoch-marker ring capacity: retained markers span at most
// D + 3*TAU_MAX ≈ 2400 samples; worst-case marker density is one per
// 0.75*TAU_MIN = 36 samples → ≤ ~70. 128 is ~2x headroom.
const MK_CAP = 128;

// Scale degree sets (semitone offsets from the key root). Indices are the
// `scale` param's enum values; key 0..11 = C..B (see src/node-autotune.js).
const SCALES = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],   // 0 chromatic
  [0, 2, 4, 5, 7, 9, 11],                    // 1 major
  [0, 2, 3, 5, 7, 8, 10]                     // 2 natural minor
];

// ---- Param-read defenses ---------------------------------------------------
// parameterDescriptors' min/max already clamp real AudioParams; these
// re-clamp on read so a damaged array (or a non-browser harness driving
// process() by hand) can never produce a degenerate configuration.

/**
 * Read one k-rate value with a fallback, clamped into [lo, hi].
 * @param {Float32Array|number[]} arr
 * @param {number} fallback
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function paramClamp(arr, fallback, lo, hi) {
  let v = arr && arr.length ? arr[0] : fallback;
  if (!(v >= lo)) v = lo; // also catches NaN/undefined
  if (v > hi) v = hi;
  return v;
}

// ---- DSP helpers -----------------------------------------------------------

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
 * One YIN analysis over win[0..YIN_WIN) — L1: the ORIGINAL paper
 * formulation with the shrinking comparison window:
 *   d(tau) = sum_{j<W-tau} (x[j]-x[j+tau])^2
 *          = eA(tau) + eB(tau) - 2·r(tau)
 * where r(tau) = sum_{j<W-tau} x[j]x[j+tau] is EXACTLY the zero-padded
 * linear autocorrelation (one |FFT|^2), and eA/eB come from prefix sums of
 * x². The swap-trick inverse FFT (transform the power spectrum held in
 * `im`, spectrum in `re`) leaves the real, even autocorrelation in `re`
 * after the call — the array-argument order AT-0 got wrong once.
 * CMND normalization, 0.15-threshold dip search, parabolic refine.
 * Writes {f0, clarity} into `out[0]`/`out[1]` — f0 = 0 when no period dips
 * under threshold. No allocation.
 */
function yinAnalyze(win, dBuf, cmndBuf, fftRe, fftIm, pre, out) {
  const W = YIN_WIN;
  fftRe.fill(0); fftIm.fill(0);
  for (let i = 0; i < W; i++) fftRe[i] = win[i];
  fftInPlace(fftRe, fftIm);
  for (let i = 0; i < FFT_SIZE; i++) {
    fftRe[i] = fftRe[i] * fftRe[i] + fftIm[i] * fftIm[i];
    fftIm[i] = 0;
  }
  fftInPlace(fftIm, fftRe); // swap trick: r(tau) lands in fftRe
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
    out[0] = 0;
    out[1] = 1 - cmndBuf[best];
    return;
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
  out[0] = sampleRate / refined;
  out[1] = 1 - cmndBuf[tauEst];
}

// ---- The processor ---------------------------------------------------------

class AutotuneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // -- Input ring (analysis channel = channel 0) + per-channel dry rings.
    this._inRing = new Float32Array(RING);
    this._dryRings = [this._inRing]; // channel 0 reuses the analysis ring
    this._inLen = 0;              // absolute input samples received
    // L2: the output CONTENT cursor starts at -D. Block k emits content
    // [128k-D, 128(k+1)-D), so the output stream IS the input delayed by
    // exactly D on every path, and the delay is measurable offline as a
    // bit-exact index shift. Never adapted, never grown.
    this._outLen = -DELAY_N;
    // -- TD-PSOLA synthesis accumulators (masked, like the rings).
    this._ola = new Float32Array(RING);
    this._wsum = new Float32Array(RING);
    // -- YIN scratch (all preallocated; yinAnalyze allocates nothing).
    this._frameWin = new Float32Array(YIN_WIN);
    this._dBuf = new Float64Array(TAU_MAX + 1);
    this._cmnd = new Float64Array(TAU_MAX + 1);
    this._pre = new Float64Array(YIN_WIN + 1);
    this._fftRe = new Float64Array(FFT_SIZE);
    this._fftIm = new Float64Array(FFT_SIZE);
    this._yinOut = new Float64Array(2);
    this._nextFrameC = YIN_WIN / 2;   // next detection frame center
    // Last 3 detection frames as a scalar ring (the spike's object array,
    // de-allocated): slots are (f0, clarity, rms).
    this._frF0 = new Float64Array(3);
    this._frCl = new Float64Array(3);
    this._frRms = new Float64Array(3);
    this._frCount = 0;
    this._frIdx = 0;                  // next write slot
    this._voiced = false;
    this._f0 = 0;
    // -- Epoch markers as parallel scalar ring buffers (same de-allocation).
    this._mkP = new Float64Array(MK_CAP);
    this._mkT = new Float64Array(MK_CAP);
    this._mkHead = 0;                 // index of the oldest marker
    this._mkCount = 0;
    this._markerCursor = 0;           // selection cursor, relative to head
    this._nextMarkerP = 0;
    this._synPos = -1;                // float; next output-epoch position (-1 = none)
    this._ratioS = 1;                 // smoothed shift ratio
    this._targetMidi = -1;            // snap hysteresis state (-1 = no target)
    this._overLimit = 0;              // consecutive over-band frames (L4)
    this._fade = 0;
    this._fadeStep = 1 - Math.exp(-1 / (FADE_TC_S * sampleRate));
    this._wasVoiced = false;
  }

  static get parameterDescriptors() {
    // Enums as numbers (key 0..11 = C..B, scale 0..2 = Chromatic/Major/
    // Minor — the string mapping lives in src/node-autotune.js so UI-1's
    // discrete selects can persist strings); retune in ms; mix 0..1
    // (the applyParam layer maps the UI's 0..100 %). All k-rate: none of
    // these needs audio-rate automation, and a fresh value per render
    // quantum is decision-grade for a 5 ms detection cadence.
    return [
      { name: 'key', defaultValue: 0, minValue: 0, maxValue: 11, automationRate: 'k-rate' },
      { name: 'scale', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'retune', defaultValue: 0, minValue: 0, maxValue: 500, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  /** Nearest allowed note (midi) to `midi` in key/scale. */
  _snapMidi(midi, key, scale) {
    const set = SCALES[scale];
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
    if (!output || output.length === 0 || !output[0]) {
      return true; // nothing to fill this quantum — stay alive regardless
    }
    const n = output[0].length;
    const input = inputs[0];
    const in0 = input && input.length > 0 ? input[0] : null;

    const key = Math.round(paramClamp(parameters.key, 0, 0, 11));
    const scale = Math.round(paramClamp(parameters.scale, 0, 0, 2));
    const retuneS = paramClamp(parameters.retune, 0, 0, 500) / 1000;
    const mix = paramClamp(parameters.mix, 1, 0, 1);

    // -- 1) Ingest: channel 0 into the analysis ring, every channel into
    // its own dry ring (mix = 0 then keeps each channel bit-exact).
    for (let c = 0; c < output.length; c++) {
      const inCh = input && c < input.length ? input[c] : null;
      if (c === 0) {
        for (let i = 0; i < n; i++) {
          this._inRing[(this._inLen + i) & MASK] = in0 ? in0[i] : 0;
        }
      } else {
        let ring = this._dryRings[c];
        if (!ring) {
          ring = this._dryRings[c] = new Float32Array(RING);
        }
        for (let i = 0; i < n; i++) {
          ring[(this._inLen + i) & MASK] = inCh ? inCh[i] : 0;
        }
      }
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
      yinAnalyze(win, this._dBuf, this._cmnd, this._fftRe, this._fftIm,
        this._pre, this._yinOut);
      const slot = this._frIdx;
      this._frF0[slot] = this._yinOut[0];
      this._frCl[slot] = this._yinOut[1];
      this._frRms[slot] = Math.sqrt(sumSq / win.length);
      this._frIdx = (slot + 1) % 3;
      if (this._frCount < 3) this._frCount++;
      this._nextFrameC += HOP;
    }

    // -- 3) Median-of-3 detection + 2-of-3 voicing (no allocations: gather
    // the voiced slots into fixed scratch, sort 2-3 values by hand).
    let vn = 0;
    const vf0 = this._pre; // reuse as 3-slot scratch (detection is done)
    for (let s = 0; s < this._frCount; s++) {
      if (this._frF0[s] > 0 && this._frCl[s] >= CLARITY_GATE &&
          this._frRms[s] >= RMS_GATE) {
        vf0[vn++] = this._frF0[s];
      }
    }
    let voiced = vn >= 2;
    let f0 = 0;
    if (voiced) {
      // The spike's exact rule: vs[floor(n/2)] of the ascending sort —
      // median of 3, UPPER of 2 (index 1), never fewer than 2 values.
      if (vn === 2) {
        f0 = vf0[0] > vf0[1] ? vf0[0] : vf0[1];
      } else {
        let a = vf0[0], b = vf0[1], c3 = vf0[2];
        if (a > b) { const t = a; a = b; b = t; }
        if (b > c3) { const t = b; b = c3; c3 = t; }
        if (a > b) { const t = a; a = b; b = t; }
        f0 = b;
      }
      if (f0 < sampleRate / TAU_MAX || f0 > sampleRate / TAU_MIN) voiced = false;
    }
    this._voiced = voiced;
    this._f0 = f0;
    const T = voiced ? Math.round(sampleRate / f0) : TAU_MAX;

    // -- 4) Scale snap (+ L4 hysteresis) → ratio target.
    let ratioT = 1;
    if (voiced) {
      // L4 (also AT-0's log-base lesson): the /Math.LN2 is load-bearing —
      // the natural-log version passes every structural test while
      // snapping to garbage notes.
      const midi = 69 + 12 * Math.log(f0 / 440) / Math.LN2;
      let tgt = this._targetMidi;
      if (tgt < 0) {
        // Stability-gated FIRST snap: an onset transient (window
        // straddling silence) must not lock a wrong note inside the
        // hysteresis band — require the voiced frames to agree within 30
        // cents before committing a target. Until then: no shift.
        let stable = vn >= 2;
        if (stable) {
          let mn = Infinity, mx = 0;
          for (let s = 0; s < this._frCount; s++) {
            if (this._frF0[s] > 0 && this._frCl[s] >= CLARITY_GATE &&
                this._frRms[s] >= RMS_GATE) {
              if (this._frF0[s] < mn) mn = this._frF0[s];
              if (this._frF0[s] > mx) mx = this._frF0[s];
            }
          }
          stable = 1200 * Math.log(mx / mn) / Math.LN2 < LOCK_SPREAD_CENTS;
        }
        if (stable) tgt = this._snapMidi(midi, key, scale);
      } else {
        const d = midi - tgt;
        // Retarget as soon as another note is genuinely nearer (the ±0.5
        // snap boundary) plus a 2-cent margin, confirmed on TWO consecutive
        // detection frames. The margin must stay TINY: onset estimates run
        // biased (+12..+19c measured), and a biased first lock that lands
        // across a boundary can only be corrected if steady state still
        // exceeds the band — a wide band locks a semitone-wrong note
        // permanently. Chatter at boundaries during vibrato is the RETUNE
        // smoothing's job (the classic hard-tune staircase), not the
        // target state's.
        if (d > RETARGET_SEMI || d < -RETARGET_SEMI) {
          this._overLimit++;
          if (this._overLimit >= 2) {
            tgt = this._snapMidi(midi, key, scale);
            this._overLimit = 0;
          }
        } else {
          this._overLimit = 0;
        }
      }
      if (tgt >= 0 && SCALES[scale].indexOf((((tgt - key) % 12) + 12) % 12) === -1) {
        tgt = this._snapMidi(midi, key, scale);  // key/scale change mid-note
      }
      this._targetMidi = tgt;
      if (tgt >= 0) {
        let semi = tgt - midi;
        if (semi > MAX_SEMI) semi = MAX_SEMI;
        if (semi < -MAX_SEMI) semi = -MAX_SEMI;
        ratioT = Math.pow(2, semi / 12);
      }
    } else {
      this._targetMidi = -1;
      this._overLimit = 0;
    }

    // -- 5) Epoch markers. On voicing onset, reseed at the frontier.
    const onsetNow = voiced && !this._wasVoiced;
    if (onsetNow) {
      this._mkHead = 0;
      this._mkCount = 0;
      this._markerCursor = 0;
      const seed = Math.max(0, this._outLen);   // outLen < 0 during warm-up
      this._nextMarkerP = seed;
      // Seed the synthesis grid at the FIRST marker (not at the frontier):
      // keeps the grain-read offset near 0 instead of a constant ~T/2.
      this._synPos = -1;
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
        // Ring push (overwriting the oldest is unreachable in practice —
        // MK_CAP is ~2x the span bound — but keeps the buffer honest).
        if (this._mkCount === MK_CAP) {
          this._mkHead = (this._mkHead + 1) % MK_CAP;
          this._mkCount--;
          if (this._markerCursor > 0) this._markerCursor--;
        }
        const idx = (this._mkHead + this._mkCount) % MK_CAP;
        this._mkP[idx] = best;
        this._mkT[idx] = T;
        this._mkCount++;
        if (this._synPos < 0) this._synPos = best;
        this._nextMarkerP = best;
      }
      // Prune markers the emission cursor has left behind.
      while (this._mkCount > 2 && this._markerCursor > 1 &&
        this._mkP[(this._mkHead + 1) % MK_CAP] < this._outLen - 3 * TAU_MAX) {
        this._mkHead = (this._mkHead + 1) % MK_CAP;
        this._mkCount--;
        this._markerCursor--;
      }
    }
    this._wasVoiced = voiced;

    // -- 6) Grain placement + per-sample emission.
    //
    // L2: block k emits CONTENT [128k-D, 128(k+1)-D) (outLen starts at
    // -D, so the output stream is the input delayed by exactly D —
    // measurable offline as an index shift). Content position p needs
    // input to ~p + 2.1T for its grains; with emission trailing input by
    // D that is always available for T <= ~D/2.1 (f0 >= ~104 Hz). Wet/dry
    // switching is time-aligned by construction (a grain at sp reads input
    // [sp-T, sp+T]; dry[p] is input[p]); grain-coverage gaps pass dry with
    // the fade pulled to 0. Content p < 0 is delay-line warm-up silence.
    const inRing = this._inRing, ola = this._ola, wsum = this._wsum;
    for (let oi = blockStart; oi < blockEnd; oi++) {
      // Place every output epoch whose marker decision is certain and
      // whose grain has fully arrived.
      for (;;) {
        if (this._mkCount === 0 || this._synPos < 0) break;
        let cur = this._markerCursor;
        while (cur + 1 < this._mkCount &&
          Math.abs(this._mkP[(this._mkHead + cur + 1) % MK_CAP] - this._synPos) <=
          Math.abs(this._mkP[(this._mkHead + cur) % MK_CAP] - this._synPos)) cur++;
        this._markerCursor = cur;
        const mkIdx = (this._mkHead + cur) % MK_CAP;
        const mkP = this._mkP[mkIdx];
        const Tm = this._mkT[mkIdx];
        const sp = Math.round(this._synPos);
        const lastP = this._mkP[(this._mkHead + this._mkCount - 1) % MK_CAP];
        if (lastP < sp + 0.75 * Tm) break;   // nearest marker not yet decided
        if (mkP + Tm > this._inLen) break;   // grain tail not yet arrived
        // Per-epoch retune smoothing (retune 0 → snap within one epoch;
        // hundreds of ms → the slow-correction glide, same engine).
        const tcSamp = Math.max(retuneS, 5 / sampleRate) * sampleRate;
        const step = 1 - Math.exp(-((Tm / this._ratioS) / tcSamp));
        this._ratioS += step * (ratioT - this._ratioS);
        for (let k = -Tm; k < Tm; k++) {
          const d = sp + k;
          // L3: never write into already-emitted positions (stale-data
          // pollution one ring-wrap later). This guard also makes negative
          // content positions unreachable — markers only exist once
          // outLen > 0, so any d < outLen (including d < 0) is skipped.
          if (d < this._outLen) continue;
          const w = 0.5 * (1 + Math.cos(Math.PI * k / Tm));
          const di = d & MASK;
          ola[di] += inRing[(mkP + k) & MASK] * w;
          wsum[di] += w;
        }
        this._synPos += Tm / this._ratioS;
      }

      if (oi < 0) {
        // Delay-line warm-up: content position before stream start.
        for (let c = 0; c < output.length; c++) output[c][oi - blockStart] = 0;
        this._outLen++;
        continue;
      }
      const di = oi & MASK;
      const dry0 = inRing[di];
      let val;
      const ws = wsum[di];
      if (ws > 0.05) {
        const wet = ola[di] / ws;
        const fadeTarget = voiced ? 1 : 0;
        this._fade += this._fadeStep * (fadeTarget - this._fade);
        val = this._fade * wet + (1 - this._fade) * dry0;
      } else {
        // No grain coverage: dry, fade toward 0 so a later wet arrival
        // fades IN over ~3 ms instead of jumping in at full level.
        this._fade += this._fadeStep * (0 - this._fade);
        val = dry0;
      }
      ola[di] = 0;
      wsum[di] = 0;
      for (let c = 0; c < output.length; c++) {
        const ring = this._dryRings[c] || inRing;
        const dryC = ring[di];
        // mix=0 → 0*val + 1*dryC = dryC, bit-exact (IEEE) per channel.
        output[c][oi - blockStart] = mix * val + (1 - mix) * dryC;
      }
      this._outLen++;
    }
    return true; // an autotune in the chain must never idle out
  }
}

registerProcessor('autotune', AutotuneProcessor);
