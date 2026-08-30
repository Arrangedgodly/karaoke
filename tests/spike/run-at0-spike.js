// AT-0 spike harness — DISPOSABLE, not part of tests/run.js (which only
// auto-discovers tests/test-*.js; this lives in tests/spike/ on purpose).
//
// Runs the prototype worklet (tests/spike/at0-autotune-worklet.js) OFFLINE
// under Node, exactly like tests/test-gate-node.js drives the real gate
// processor: browser AudioWorkletGlobalScope stubbed in a vm sandbox,
// process() called by hand with 128-sample blocks.
//
// Inputs:
//   - assets/test-vocal.mp3 (TEST-1), decoded to mono 48 kHz f32 PCM via
//     ffmpeg (the repo has no JS MP3 decoder; the browser app decodes with
//     AudioContext.decodeAudioData — offline we substitute ffmpeg and say so).
//   - Synthetic tones (110/220/330/440 Hz, ±40 cents, harmonic-rich variants)
//     for ground-truth pitch, snap, latency, and artifact measurements.
//
// Measurements (D2 §7 spike design, docs/ultron/research/rq2-autotune-feasibility.md):
//   A. YIN detection accuracy vs exact synthetic ground truth
//   B. Scale-snap correctness (chromatic + C-major), output f0 vs target
//   C. Added latency (unvoiced impulse floor + voiced correlation lag)
//   D. TD-PSOLA artifact proxies on shifted steady tones
//      (AM depth, worst-window SNR, envelope dips)
//   E. The real test vocal: snap residual, dropouts, RMS discontinuity,
//      HF-ratio, spectral-flux ratio — at retune 0 ms and 250 ms
//   F. CPU per process() block (p50/p99/max vs the 2.667 ms quantum)
//
// Everything prints as "  ok/NOTE/WARN - ..." plus "METRIC:" lines that the
// spike record (docs/ultron/research/at0-spike-result.md) quotes verbatim.
//
// Run: node tests/spike/run-at0-spike.js   (from the repo root or anywhere)

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..', '..');
var OUT_DIR = path.join(__dirname, 'out');
var SR = 48000;
var BLOCK = 128;
var QUANTUM_MS = (BLOCK / SR) * 1000; // 2.667 ms
var D_SAMPLES = Math.round(0.020 * SR); // the prototype's declared delay (20 ms)

// ===========================================================================
// Asset decode (ffmpeg — documented substitution for decodeAudioData)
// ===========================================================================

function decodeVocal() {
  var mp3 = path.join(ROOT, 'assets', 'test-vocal.mp3');
  if (!fs.existsSync(mp3)) throw new Error('missing ' + mp3);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  var raw = path.join(OUT_DIR, 'test-vocal-48k-mono.f32');
  if (!fs.existsSync(raw)) {
    var res = cp.spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', mp3, '-ac', '1', '-ar', String(SR),
      '-f', 'f32le', '-c:a', 'pcm_f32le', raw
    ], { encoding: 'utf8' });
    if (res.status !== 0) {
      throw new Error('ffmpeg decode failed: ' + (res.stderr || '').slice(0, 400));
    }
  }
  var buf = fs.readFileSync(raw);
  var pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
  // Copy out of the buffer's slab so subarray math below stays sane.
  var copy = new Float32Array(pcm.length);
  copy.set(pcm);
  return copy;
}

// ===========================================================================
// Worklet boot (vm-stubbed AudioWorkletGlobalScope, gate-test precedent)
// ===========================================================================

function bootProcessor() {
  var registered = {};
  var scope = {
    console: console,
    sampleRate: SR,
    currentTime: 0,
    AudioWorkletProcessor: function () {},
    registerProcessor: function (name, ctor) { registered[name] = ctor; }
  };
  vm.createContext(scope);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, 'at0-autotune-worklet.js'), 'utf8'),
    scope, { filename: 'at0-autotune-worklet.js' }
  );
  if (!registered['spike-autotune']) throw new Error('processor did not register');
  return registered['spike-autotune'];
}

// ===========================================================================
// Chain runner (offline render + per-block CPU timing)
// ===========================================================================

function runChain(Processor, pcm, opts) {
  opts = opts || {};
  var pad = Math.round((opts.padSec !== undefined ? opts.padSec : 0.4) * SR);
  var total = Math.ceil((pcm.length + pad) / BLOCK) * BLOCK;
  var inBuf = new Float32Array(total);
  inBuf.set(pcm);
  var outBuf = new Float32Array(total);
  var params = {
    key: new Float32Array([opts.key || 0]),
    scale: new Float32Array([opts.scale || 0]),
    retune: new Float32Array([opts.retune !== undefined ? opts.retune : 0]),
    mix: new Float32Array([opts.mix !== undefined ? opts.mix : 1])
  };
  var inst = new Processor();
  var cpuUs = [];
  for (var b = 0; b < total / BLOCK; b++) {
    var inCh = inBuf.subarray(b * BLOCK, (b + 1) * BLOCK);
    var outCh = outBuf.subarray(b * BLOCK, (b + 1) * BLOCK);
    var t0 = process.hrtime.bigint();
    inst.process([[inCh]], [[outCh]], params);
    var t1 = process.hrtime.bigint();
    cpuUs.push(Number(t1 - t0) / 1000);
  }
  return { out: outBuf, in: inBuf, cpu: cpuUs, inst: inst };
}

function cpuStats(us) {
  var s = us.slice().sort(function (a, b) { return a - b; });
  var mean = s.reduce(function (a, b) { return a + b; }, 0) / s.length;
  var ms = function (v) { return v / 1000; };
  return {
    mean: ms(mean),
    p50: ms(s[Math.floor(s.length * 0.5)]),
    p99: ms(s[Math.min(s.length - 1, Math.floor(s.length * 0.99))]),
    max: ms(s[s.length - 1])
  };
}

// ===========================================================================
// Reference offline YIN — INDEPENDENT implementation (naive direct-loop
// difference function, no FFT, main-thread style) used as the measurement
// oracle for both input contour and output contour.
// ===========================================================================

var REF_W = 1200, REF_HOP = 480, REF_TAU_MIN = 48, REF_TAU_MAX = 480;

function refYin(x) {
  var frames = [];
  var raw = [];
  for (var start = 0; start + REF_W + REF_TAU_MAX <= x.length; start += REF_HOP) {
    var rms = 0;
    for (var i = 0; i < REF_W; i++) rms += x[start + i] * x[start + i];
    rms = Math.sqrt(rms / REF_W);
    // Direct difference function.
    var bestTau = -1, bestVal = Infinity, globalMin = Infinity;
    var d = new Float64Array(REF_TAU_MAX + 1);
    var dsum = 0;
    for (var tau = 1; tau <= REF_TAU_MAX; tau++) {
      var s = 0;
      for (var j = 0; j < REF_W; j++) {
        var dd = x[start + j] - x[start + j + tau];
        s += dd * dd;
      }
      d[tau] = s;
      dsum += s;
      var cmnd = dsum > 0 ? (s * tau) / dsum : 1;
      if (cmnd < globalMin) globalMin = cmnd;
      if (tau >= REF_TAU_MIN && cmnd < 0.15 && bestTau < 0) {
        bestTau = tau; bestVal = cmnd;
      }
    }
    var f0 = 0, clar = 1 - globalMin;
    if (bestTau > 0) {
      var tau2 = bestTau;
      var cmndArr = new Float64Array(REF_TAU_MAX + 1);
      var ds2 = 0;
      for (var t2 = 1; t2 <= REF_TAU_MAX; t2++) {
        ds2 += d[t2];
        cmndArr[t2] = ds2 > 0 ? (d[t2] * t2) / ds2 : 1;
      }
      while (tau2 + 1 <= REF_TAU_MAX && cmndArr[tau2 + 1] < cmndArr[tau2]) tau2++;
      if (tau2 > REF_TAU_MIN && tau2 < REF_TAU_MAX) {
        var y1 = cmndArr[tau2 - 1], y2 = cmndArr[tau2], y3 = cmndArr[tau2 + 1];
        var den = y1 - 2 * y2 + y3;
        if (Math.abs(den) > 1e-12) {
          var delta = 0.5 * (y1 - y3) / den;
          if (delta > -1 && delta < 1) tau2 += delta;
        }
      }
      f0 = SR / tau2;
      clar = 1 - cmndArr[Math.round(tau2)] ;
    }
    raw.push({ t: start + REF_W / 2, f0: f0, clar: clar, rms: rms });
  }
  // Median-of-3 + 2-of-3 voicing, mirroring the worklet's rule.
  for (var k = 0; k < raw.length; k++) {
    var win = raw.slice(Math.max(0, k - 2), k + 1).filter(function (f) {
      return f.f0 > 0 && f.clar >= 0.7 && f.rms >= 1e-3;
    });
    var voiced = win.length >= 2;
    var f0m = 0;
    if (voiced) {
      var vs = win.map(function (f) { return f.f0; }).sort(function (a, b) { return a - b; });
      f0m = vs[Math.floor(vs.length / 2)];
    }
    frames.push({ t: raw[k].t, f0: voiced ? f0m : 0, clar: raw[k].clar, rms: raw[k].rms });
  }
  return frames;
}

function refMedianVoicedF0(frames, fromT, toT) {
  var vals = [];
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].t >= fromT && frames[i].t <= toT && frames[i].f0 > 0) vals.push(frames[i].f0);
  }
  if (!vals.length) return 0;
  vals.sort(function (a, b) { return a - b; });
  return vals[Math.floor(vals.length / 2)];
}

// ===========================================================================
// Metric helpers
// ===========================================================================

var MAJOR = [0, 2, 4, 5, 7, 9, 11];
var MINOR = [0, 2, 3, 5, 7, 8, 10];

function nearestAllowedMidi(midi, key, scale) {
  var set = scale === 1 ? MAJOR : scale === 2 ? MINOR : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  var m = Math.round(midi);
  var rel = (((m - key) % 12) + 12) % 12;
  if (set.indexOf(rel) !== -1) return m;
  var up = 1;
  while (up < 12 && set.indexOf((rel + up) % 12) === -1) up++;
  var dn = 1;
  while (dn < 12 && set.indexOf((rel - dn + 12) % 12) === -1) dn++;
  return (m + up) - midi < midi - (m - dn) ? m + up : m - dn;
}

function centsToScale(f0, key, scale) {
  var midi = 69 + 12 * Math.log(f0 / 440) / Math.LN2;
  return (nearestAllowedMidi(midi, key, scale) - midi) * 100;
}

function centsBetween(f, ref) { return 1200 * Math.log(f / ref) / Math.log(2); }

function percentile(arr, p) {
  var s = arr.slice().sort(function (a, b) { return a - b; });
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

/** Argmax normalized correlation over lags in [minLag, maxLag]. */
function corrLag(a, b, from, len, minLag, maxLag) {
  var bestLag = -1, bestV = -Infinity;
  for (var lag = minLag; lag <= maxLag; lag++) {
    var sAB = 0, sAA = 0, sBB = 0;
    for (var i = 0; i < len; i++) {
      var av = a[from + i], bv = b[from + i + lag];
      if (bv === undefined) break;
      sAB += av * bv; sAA += av * av; sBB += bv * bv;
    }
    var v = sAB / Math.sqrt(sAA * sBB + 1e-30);
    if (v > bestV) { bestV = v; bestLag = lag; }
  }
  return { lag: bestLag, corr: bestV };
}

/** Peak amplitude per output period -> { min, max } over the steady span. */
function ampModDb(x, fHz, from, to) {
  var P = SR / fHz;
  var n = Math.floor((to - from) / P);
  var lo = Infinity, hi = 0;
  for (var s = 0; s < n; s++) {
    var a = 0;
    for (var i = Math.round(from + s * P); i < Math.round(from + (s + 1) * P); i++) {
      var v = Math.abs(x[i]);
      if (v > a) a = v;
    }
    if (a < lo) lo = a;
    if (a > hi) hi = a;
  }
  return 20 * Math.log10(hi / (lo + 1e-12));
}

/** Worst sliding least-squares sinusoid-fit SNR (dB) at fHz over [from,to). */
function snrWorstDb(x, fHz, from, to, win, step) {
  win = win || 2048; step = step || 512;
  var w = 2 * Math.PI * fHz / SR;
  var worst = Infinity;
  for (var s = from; s + win <= to; s += step) {
    var sS = 0, sC = 0;
    for (var i = 0; i < win; i++) {
      var v = x[s + i];
      sS += v * Math.sin(w * i);
      sC += v * Math.cos(w * i);
    }
    var a = 2 * sS / win, b = 2 * sC / win;
    var sig = 0, res = 0;
    for (var i2 = 0; i2 < win; i2++) {
      var fit = a * Math.sin(w * i2) + b * Math.cos(w * i2);
      sig += fit * fit;
      var e = x[s + i2] - fit;
      res += e * e;
    }
    var snr = 10 * Math.log10((sig + 1e-30) / (res + 1e-30));
    if (snr < worst) worst = snr;
  }
  return worst;
}

/** RMS (dB) series, window/hop in samples. */
function rmsSeriesDb(x, win, hop) {
  var out = [];
  for (var s = 0; s + win <= x.length; s += hop) {
    var acc = 0;
    for (var i = 0; i < win; i++) acc += x[s + i] * x[s + i];
    out.push(10 * Math.log10(acc / win + 1e-30));
  }
  return out;
}

/** mean |x[n]-x[n-1]| / mean |x| over the given [from,to) spans. */
function hfRatioSpans(x, spans) {
  var num = 0, den = 0;
  spans.forEach(function (sp) {
    for (var i = sp[0] + 1; i < sp[1]; i++) {
      num += Math.abs(x[i] - x[i - 1]);
      den += Math.abs(x[i]);
    }
  });
  return num / (den + 1e-30);
}

/** Naive-DFT spectral flux (p99 of normalized frame-to-frame change). */
function fluxP99(x, spans) {
  var NB = 128, prev = null, fluxes = [];
  spans.forEach(function (sp) {
    for (var s = sp[0]; s + NB <= sp[1]; s += NB) {
      var mag = new Float64Array(NB / 2);
      for (var k = 1; k < NB / 2; k++) {
        var re = 0, im = 0;
        for (var i = 0; i < NB; i++) {
          var ang = -2 * Math.PI * k * i / NB;
          re += x[s + i] * Math.cos(ang);
          im += x[s + i] * Math.sin(ang);
        }
        mag[k] = Math.sqrt(re * re + im * im);
      }
      if (prev) {
        var f = 0, m = 0;
        for (var k2 = 1; k2 < NB / 2; k2++) {
          f += Math.abs(mag[k2] - prev[k2]);
          m += mag[k2];
        }
        fluxes.push(f / (m + 1e-30));
      }
      prev = mag;
    }
    prev = null;
  });
  return percentile(fluxes, 0.99);
}

/** Contiguous input-stable voiced segments as [fromSample,toSample]. */
function stableSegments(refFrames, minMs, tolCents) {
  var segs = [];
  var run = null;
  for (var i = 0; i < refFrames.length; i++) {
    var f = refFrames[i];
    if (f.f0 > 0) {
      if (run && centsBetween(f.f0, run.f0) < tolCents && centsBetween(f.f0, run.f0) > -tolCents) {
        run.to = f.t;
      } else {
        if (run && run.to - run.from >= (minMs / 1000) * SR) segs.push([run.from, run.to]);
        run = { from: f.t, to: f.t, f0: f.f0 };
      }
    } else {
      if (run && run.to - run.from >= (minMs / 1000) * SR) segs.push([run.from, run.to]);
      run = null;
    }
  }
  if (run && run.to - run.from >= (minMs / 1000) * SR) segs.push([run.from, run.to]);
  return segs;
}

/** Sample spans (±guard) where the reference says voiced. */
function voicedSpans(refFrames, guardMs) {
  var g = (guardMs || 50) * SR / 1000;
  var spans = [];
  var run = null;
  for (var i = 0; i < refFrames.length; i++) {
    if (refFrames[i].f0 > 0) {
      if (!run) run = [refFrames[i].t - g, refFrames[i].t + g + REF_HOP];
      run[1] = refFrames[i].t + g + REF_HOP;
    } else if (run) {
      spans.push(run);
      run = null;
    }
  }
  if (run) spans.push(run);
  return spans.map(function (s) {
    return [Math.max(0, Math.round(s[0])), Math.round(s[1])];
  });
}

// ===========================================================================
// Signal generators
// ===========================================================================

function tone(fHz, durS, opts) {
  opts = opts || {};
  var n = Math.round(durS * SR);
  var x = new Float32Array(n);
  var edge = Math.round(0.005 * SR);
  for (var i = 0; i < n; i++) {
    var th = 2 * Math.PI * fHz * i / SR;
    var v;
    if (opts.harmonic) {
      v = 0.30 * Math.sin(th) + 0.10 * Math.sin(2 * th) + 0.05 * Math.sin(3 * th);
    } else {
      v = 0.4 * Math.sin(th);
    }
    var g = 1;
    if (i < edge) g = 0.5 * (1 - Math.cos(Math.PI * i / edge));
    if (i > n - edge) g = 0.5 * (1 - Math.cos(Math.PI * (n - i) / edge));
    x[i] = v * g;
  }
  return x;
}

function silence(durS) { return new Float32Array(Math.round(durS * SR)); }

function concat() {
  var len = 0;
  for (var i = 0; i < arguments.length; i++) len += arguments[i].length;
  var out = new Float32Array(len);
  var o = 0;
  for (var j = 0; j < arguments.length; j++) { out.set(arguments[j], o); o += arguments[j].length; }
  return out;
}

function detune(f, cents) { return f * Math.pow(2, cents / 1200); }

function writeWav(name, x) {
  var n = x.length;
  var buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (var i = 0; i < n; i++) {
    var v = Math.max(-1, Math.min(1, x[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
}

// ===========================================================================
// Report
// ===========================================================================

var notes = [];
function note(kind, msg) {
  notes.push({ kind: kind, msg: msg });
  console.log('  ' + kind + ' - ' + msg);
}
function metric(line) { console.log('METRIC: ' + line); }
function f3(v) { return Number(v).toFixed(3); }
function f1(v) { return Number(v).toFixed(1); }

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  var Processor = bootProcessor();
  console.log('AT-0 spike harness — SR=' + SR + ', quantum=' + f3(QUANTUM_MS) + ' ms');
  console.log('');

  // ------------------------------------------------------------------
  console.log('A. YIN DETECTION ACCURACY (synthetic ground truth)');
  // ------------------------------------------------------------------
  var bases = [110, 220, 440];
  var detunes = [-40, 0, 40];
  var errs = [], octaveErrs = 0, falseUnvoiced = 0, voicedDec = 0;
  var detectSeq = [];
  bases.forEach(function (fb) {
    detunes.forEach(function (dc) {
      detectSeq.push({ f: detune(fb, dc), tone: tone(detune(fb, dc), 1.2), from: 0 });
    });
  });
  detectSeq.forEach(function (item, idx) {
    var sig = concat(silence(0.25), item.tone, silence(0.25));
    var r = runChain(Processor, sig, { retune: 0 });
    var tStart = 0.4 * SR, tEnd = 1.2 * SR; // settled interior of the tone
    r.inst._dbgBlocks.forEach(function (b) {
      if (!b.voiced) return;
      if (b.outLen < tStart || b.outLen > tEnd) return;
      voicedDec++;
      var c = centsBetween(b.f0, item.f);
      if (Math.abs(Math.abs(c) - 1200) < 30) { octaveErrs++; return; }
      errs.push(Math.abs(c));
    });
    // False unvoiced inside the settled interior:
    r.inst._dbgBlocks.forEach(function (b) {
      if (b.outLen >= tStart && b.outLen <= tEnd && !b.voiced) falseUnvoiced++;
    });
  });
  note(errs.length ? 'ok' : 'FAIL', 'detection: ' + errs.length + ' voiced block decisions across 9 steady tones');
  metric('A.detect.med_abs_cents=' + f1(percentile(errs, 0.5)));
  metric('A.detect.p95_abs_cents=' + f1(percentile(errs, 0.95)));
  metric('A.detect.max_abs_cents=' + f1(errs.length ? Math.max.apply(null, errs) : 0));
  metric('A.detect.octave_errors=' + octaveErrs + '/' + voicedDec);
  metric('A.detect.false_unvoiced_blocks=' + falseUnvoiced);

  // ------------------------------------------------------------------
  console.log('B. SCALE-SNAP CORRECTNESS (output f0 vs expected target)');
  // ------------------------------------------------------------------
  var snapCases = [
    // { f, key, scale, expectHz, label } — expected targets hand-computed:
    // 265 is +22c from C4; 275 is +14c from C#4; in C major C#/D# are
    // forbidden so 275 -> C4 and 310 (6c below D#4) -> D4; in A minor A# is
    // forbidden so 239 (44c above A#3) -> B3.
    { f: 265.0, key: 0, scale: 0, expect: 261.63, label: '265 Hz -> C4 (chromatic)' },
    { f: 275.0, key: 0, scale: 0, expect: 277.18, label: '275 Hz -> C#4 (chromatic)' },
    { f: 275.0, key: 0, scale: 1, expect: 261.63, label: '275 Hz -> C4 (C major: C# forbidden)' },
    { f: 310.0, key: 0, scale: 1, expect: 293.66, label: '310 Hz -> D4 (C major: D# forbidden)' },
    { f: 239.0, key: 9, scale: 2, expect: 246.94, label: '239 Hz -> B3 (A minor: A# forbidden)' },
    // Bottom of the bar's range: 113 Hz is midi 45.46, a -46-cent snap to
    // A2 at the longest period the wet path must handle (T=425; the grain
    // lookahead bound is ~2.1T = 892 <= D = 960).
    { f: 113.0, key: 0, scale: 0, expect: 110.0, label: '113 Hz -> A2 (chromatic, lowest range)' }
  ];
  snapCases.forEach(function (c) {
    var sig = concat(silence(0.25), tone(c.f, 1.5, { harmonic: true }), silence(0.25));
    var r = runChain(Processor, sig, { key: c.key, scale: c.scale, retune: 0 });
    var ref = refYin(r.out);
    var got = refMedianVoicedF0(ref, 0.5 * SR, 1.5 * SR);
    var cents = got ? centsBetween(got, c.expect) : NaN;
    var pass = Math.abs(cents) < 10;
    note(pass ? 'ok' : 'FAIL', c.label + ': got ' + f1(got) + ' Hz, expect ' + c.expect + ' Hz (' + f1(cents) + ' cents)');
    metric('B.snap.' + c.label.replace(/[^a-z0-9]+/gi, '_') + '=' + f1(cents) + 'cents');
  });

  // ------------------------------------------------------------------
  console.log('C. ADDED LATENCY (declared algorithmic delay D)');
  // ------------------------------------------------------------------
  // The node delays its output stream by D (delay-line warm-up head,
  // outLen starts at -D): output index = content index + D. The impulse
  // and correlation checks below measure the actual index shift, which
  // IS the node's added latency; telemetry reports the realized hold-back.
  var imp = new Float32Array(SR);
  imp[Math.round(0.3 * SR)] = 1;
  var rImp = runChain(Processor, imp, { retune: 0 });
  var holdbacks = rImp.inst._dbgBlocks.map(function (b) { return b.inLen - b.outLen; });
  var realizedD = Math.round(percentile(holdbacks, 0.5));
  note(realizedD <= 0.0201 * SR ? 'ok' : 'WARN',
    'declared latency: emission hold-back = ' + realizedD + ' samples = ' + f1(realizedD / SR * 1000) + ' ms');
  metric('C.latency.declared_ms=' + f1(realizedD / SR * 1000));

  var firstNz = -1;
  for (var i2 = 0; i2 < rImp.out.length; i2++) {
    if (Math.abs(rImp.out[i2]) > 1e-7) { firstNz = i2; break; }
  }
  var impPos = Math.round(0.3 * SR);
  var impLagMs = (firstNz - impPos) / SR * 1000;
  note(impLagMs <= 20.1 ? 'ok' : 'WARN',
    'unvoiced floor: impulse at input ' + impPos + ' emerges at output ' + firstNz +
    ' → ' + f1(impLagMs) + ' ms added latency');
  metric('C.latency.impulse_ms=' + f1(impLagMs));

  [110, 220, 330, 440].forEach(function (fb) {
    var sig = concat(silence(0.25), tone(fb, 1.5, { harmonic: true }), silence(0.25));
    var r = runChain(Processor, sig, { retune: 0 });
    var from = Math.round(0.7 * SR), len = Math.round(0.5 * SR);
    // Exact-on-note tone -> ratio ~1 -> output ~ input delayed by D (+/- a
    // half period of marker-seed offset). Search lags around D.
    var cl = corrLag(r.in, r.out, from, len, D_SAMPLES - 300, D_SAMPLES + 600);
    var ms = cl.lag / SR * 1000;
    // Period aliasing: correlation peaks repeat every input period, so
    // accept |lag - D| within ~2.5 periods — the exact latency is the
    // impulse + holdback measurement above, this is a coarse sanity check.
    var tol = 2.5 * SR / fb + 30;
    note(Math.abs(cl.lag - D_SAMPLES) <= tol ? 'ok' : 'WARN',
      'voiced alignment @' + fb + ' Hz: corr lag ' + cl.lag + ' = ' + f1(ms) +
      ' ms (D=' + D_SAMPLES + ' ± one period; corr ' + f3(cl.corr) + ')');
    metric('C.latency.voiced_' + fb + 'Hz_ms=' + f1(ms));
  });

  // ------------------------------------------------------------------
  console.log('D. TD-PSOLA ARTIFACT PROXIES (shifted steady tones)');
  // ------------------------------------------------------------------
  // 239 Hz harmonic tone, chromatic snap -> A#3 (233.08): a real -43-cent
  // correction sustained for 3 s exercises grain re-splicing continuously.
  var artCases = [
    { f: 239.0, expect: 233.08, label: '239->A#3 (-44c)' },
    { f: 225.0, expect: 220.0, label: '225->A3 (-39c)' },
    { f: 252.0, expect: 246.94, label: '252->B3 (-35c)' }
  ];
  artCases.forEach(function (c) {
    var sig = concat(silence(0.3), tone(c.f, 3, { harmonic: true }), silence(0.3));
    var r = runChain(Processor, sig, { retune: 0 });
    var ref = refYin(r.out);
    var got = refMedianVoicedF0(ref, 0.8 * SR, 2.9 * SR);
    var snapErr = centsBetween(got, c.expect);
    var from = Math.round(0.8 * SR), to = Math.round(2.9 * SR);
    var am = ampModDb(r.out, c.expect, from, to);
    var snr = snrWorstDb(r.out, c.expect, from, to);
    // The harmonic test tone's OWN 2nd/3rd harmonics are residual for a
    // single-sinusoid fit — measure the input's floor for comparison and
    // judge the output against THAT (out clean == out floor == in floor).
    var snrIn = snrWorstDb(r.in, c.f, from, to);
    note(Math.abs(snapErr) < 10 && am < 3 && snr >= snrIn - 1 ? 'ok' : 'WARN',
      c.label + ': snap err ' + f1(snapErr) + 'c, AM depth ' + f1(am) + ' dB, worst-window SNR ' +
      f1(snr) + ' dB (input floor ' + f1(snrIn) + ' dB)');
    metric('D.art.' + c.label.replace(/[^a-z0-9]+/gi, '_') + '.snap_cents=' + f1(snapErr));
    metric('D.art.' + c.label.replace(/[^a-z0-9]+/gi, '_') + '.am_db=' + f1(am));
    metric('D.art.' + c.label.replace(/[^a-z0-9]+/gi, '_') + '.snr_worst_db=' + f1(snr));
    metric('D.art.' + c.label.replace(/[^a-z0-9]+/gi, '_') + '.snr_input_floor_db=' + f1(snrIn));
    // Bypass-clean aid: mix=0 must be bit-exact dry (delayed by D).
    var r0 = runChain(Processor, sig, { retune: 0, mix: 0 });
    var bitExact = true;
    for (var i3 = 0; i3 < sig.length; i3++) {
      if (r0.out[i3 + D_SAMPLES] !== sig[i3]) { bitExact = false; break; }
    }
    note(bitExact ? 'ok' : 'FAIL', c.label + ': mix=0 is bit-exact dry passthrough (D-delayed)');
  });

  // ------------------------------------------------------------------
  console.log('E. THE REAL TEST VOCAL (assets/test-vocal.mp3)');
  // ------------------------------------------------------------------
  var pcm = decodeVocal();
  var durS = pcm.length / SR;
  note('ok', 'decoded ' + pcm.length + ' samples = ' + f1(durS) + ' s mono 48 kHz (ffmpeg pcm_f32le)');
  writeWav('at0-input.wav', pcm);

  var refIn = refYin(pcm);
  var voicedF = refIn.filter(function (f) { return f.f0 > 0; }).map(function (f) { return f.f0; });
  var vMin = percentile(voicedF, 0.02), vMed = percentile(voicedF, 0.5), vMax = percentile(voicedF, 0.98);
  note('ok', 'reference contour: ' + voicedF.length + '/' + refIn.length + ' frames voiced; f0 p2/p50/p98 = ' +
    f1(vMin) + '/' + f1(vMed) + '/' + f1(vMax) + ' Hz');
  metric('E.vocal.f0_p2_hz=' + f1(vMin));
  metric('E.vocal.f0_p50_hz=' + f1(vMed));
  metric('E.vocal.f0_p98_hz=' + f1(vMax));
  metric('E.vocal.voiced_frame_ratio=' + f3(voicedF.length / refIn.length));

  // Worklet detector vs reference detector on the vocal (agreement).
  var rHard = runChain(Processor, pcm, { retune: 0 }); // chromatic, 0 ms
  var agree = 0, disagree20 = 0, octDis = 0, bothVoiced = 0;
  var wf = rHard.inst._dbgFrames;
  var refByIdx = refIn;
  // dbgFrames are at c = 480 + k*240; ref frames at t = 600 + k*480.
  wf.forEach(function (f) {
    // nearest ref frame
    var ri = Math.round((f.c - REF_W / 2) / REF_HOP);
    if (ri < 0 || ri >= refByIdx.length) return;
    var rf = refByIdx[ri];
    var wVoiced = f.clar >= 0.7 && f.rms >= 1e-3 && f.f0 > 0;
    if (wVoiced && rf.f0 > 0) {
      bothVoiced++;
      var c = Math.abs(centsBetween(f.f0, rf.f0));
      if (c < 20) agree++;
      else if (Math.abs(c - 1200) < 50 || Math.abs(c - 2400) < 50) octDis++;
      else disagree20++;
    }
  });
  note('ok', 'detector agreement (both voiced): ' + agree + '/' + bothVoiced + ' within 20 cents; ' +
    octDis + ' octave disagreements; ' + disagree20 + ' other >20c');
  metric('E.detect.agree_within20c=' + f3(agree / Math.max(1, bothVoiced)));
  metric('E.detect.octave_disagree=' + octDis + '/' + bothVoiced);

  // The node's D-sample delay shifts the output array; realign before
  // comparing against the input contour / spans.
  var D_FRAMES = Math.round(D_SAMPLES / REF_HOP);

  function vocalMetrics(tag, r, key, scale, retuneLabel) {
    var refOut = refYin(r.out);
    var holdbacks = r.inst._dbgBlocks.map(function (b) { return b.inLen - b.outLen; });
    metric('E.' + tag + '.emission_holdback_samples=' + Math.round(percentile(holdbacks, 0.5)));

    // Snap residual on voiced frames (output frame i+D_FRAMES <-> input i).
    var resid = [], lost = 0, counted = 0, lostAudible = 0, lostClar = [];
    var inClar = [], outClar = [];
    for (var i = 0; i < refIn.length; i++) {
      if (refIn[i].f0 <= 0) continue;
      counted++;
      var of = refOut[i + D_FRAMES];
      if (!of || of.f0 <= 0) {
        lost++;
        if (of) {
          lostClar.push(of.clar);
          if (of.clar >= 0.45 && of.rms >= 5e-4) lostAudible++;
        }
        continue;
      }
      resid.push(Math.abs(centsToScale(of.f0, key, scale)));
      outClar.push(of.clar);
      inClar.push(refIn[i].clar);
    }
    metric('E.' + tag + '.snap_residual_median_cents=' + f1(percentile(resid, 0.5)));
    metric('E.' + tag + '.snap_residual_p95_cents=' + f1(percentile(resid, 0.95)));
    metric('E.' + tag + '.snap_residual_lt10c_pct=' + f1(100 * resid.filter(function (c2) { return c2 < 10; }).length / resid.length));
    metric('E.' + tag + '.lost_voiced_frames=' + lost + '/' + counted);
    metric('E.' + tag + '.lost_but_audible_clar04=' + lostAudible + '/' + lost);
    if (lostClar.length) metric('E.' + tag + '.lost_clar_median=' + f3(percentile(lostClar, 0.5)));
    metric('E.' + tag + '.clar_p10_in=' + f3(percentile(inClar, 0.1)));
    metric('E.' + tag + '.clar_p10_out=' + f3(percentile(outClar, 0.1)));

    // Comparative metrics (dropouts, HF ratio, flux, RMS steps):
    // out content for input index j sits at out-array index j + D.
    var N = Math.min(pcm.length, r.out.length - D_SAMPLES);
    var inA = pcm, outA = new Float32Array(N);
    outA.set(r.out.subarray(D_SAMPLES, D_SAMPLES + N));
    var spans = voicedSpans(refIn, 50).map(function (s) {
      return [Math.max(0, s[0]), Math.min(N, s[1])];
    }).filter(function (s) { return s[1] - s[0] > SR / 10; });
    // Dropout: worst out/in window RMS ratio over voiced spans.
    var win = Math.round(0.02 * SR), hop = Math.round(0.01 * SR);
    var dips = [];
    spans.forEach(function (s) {
      for (var st = s[0]; st + win <= s[1]; st += hop) {
        var ri2 = 0, ro2 = 0;
        for (var i2 = st; i2 < st + win; i2++) {
          ri2 += inA[i2] * inA[i2];
          ro2 += outA[i2] * outA[i2];
        }
        if (ri2 > 1e-8) dips.push(10 * Math.log10((ro2 + 1e-30) / ri2));
      }
    });
    metric('E.' + tag + '.dropout_min_dip_db=' + f1(Math.min.apply(null, dips)));
    metric('E.' + tag + '.dropout_p01_dip_db=' + f1(percentile(dips, 0.01)));
    var dipsLt20 = dips.filter(function (d) { return d < -20; }).length;
    metric('E.' + tag + '.windows_below_-20db=' + dipsLt20 + '/' + dips.length);
    // HF ratio (clicks at grain joins show up here).
    var hfIn = hfRatioSpans(inA, spans), hfOut = hfRatioSpans(outA, spans);
    metric('E.' + tag + '.hf_ratio_in=' + f3(hfIn));
    metric('E.' + tag + '.hf_ratio_out=' + f3(hfOut));
    metric('E.' + tag + '.hf_ratio_out_over_in=' + f3(hfOut / hfIn));
    // Spectral flux p99 (out vs in).
    var flIn = fluxP99(inA, spans), flOut = fluxP99(outA, spans);
    metric('E.' + tag + '.flux_p99_in=' + f3(flIn));
    metric('E.' + tag + '.flux_p99_out=' + f3(flOut));
    metric('E.' + tag + '.flux_out_over_in=' + f3(flOut / flIn));
    // RMS discontinuity on sustained segments.
    var segs = stableSegments(refIn, 200, 15).map(function (s) {
      return [Math.max(0, Math.round(s[0])), Math.min(N, Math.round(s[1]))];
    }).filter(function (s) { return s[1] - s[0] > SR / 5; });
    var maxStepIn = 0, maxStepOut = 0;
    segs.forEach(function (s) {
      var w5 = Math.round(0.005 * SR);
      var prevI = null, prevO = null;
      for (var st = s[0]; st + w5 <= s[1]; st += w5) {
        var ai = 0, ao = 0;
        for (var i3 = st; i3 < st + w5; i3++) { ai += inA[i3] * inA[i3]; ao += outA[i3] * outA[i3]; }
        var di2 = 10 * Math.log10(ai + 1e-30), do2 = 10 * Math.log10(ao + 1e-30);
        if (prevI !== null) {
          maxStepIn = Math.max(maxStepIn, Math.abs(di2 - prevI));
          maxStepOut = Math.max(maxStepOut, Math.abs(do2 - prevO));
        }
        prevI = di2; prevO = do2;
      }
    });
    metric('E.' + tag + '.rms_step_max_in_db=' + f1(maxStepIn));
    metric('E.' + tag + '.rms_step_max_out_db=' + f1(maxStepOut));
    metric('E.' + tag + '.sustained_segments=' + segs.length);
    metric('E.' + tag + '.starved_voiced_samples=' + r.inst._starveVoiced + '/' + pcm.length);
    return { refOut: refOut, resid: resid };
  }

  console.log('--- E1. chromatic, retune 0 ms (hard-tune) ---');
  var hard = vocalMetrics('chromatic_0ms', rHard, 0, 0, '0 ms');
  writeWav('at0-chromatic-0ms.wav', rHard.out.subarray(0, pcm.length));

  console.log('--- E2. chromatic, retune 250 ms (slow correction) ---');
  var rSlow = runChain(Processor, pcm, { retune: 250 });
  vocalMetrics('chromatic_250ms', rSlow, 0, 0, '250 ms');
  writeWav('at0-chromatic-250ms.wav', rSlow.out.subarray(0, pcm.length));

  console.log('--- E3. C major, retune 0 ms (scale snap) ---');
  var rMaj = runChain(Processor, pcm, { key: 0, scale: 1, retune: 0 });
  vocalMetrics('cmajor_0ms', rMaj, 0, 1, '0 ms');
  writeWav('at0-cmajor-0ms.wav', rMaj.out.subarray(0, pcm.length));

  // ------------------------------------------------------------------
  console.log('F. CPU PER BLOCK');
  // ------------------------------------------------------------------
  function cpuReport(tag, r, audioSec) {
    var st = cpuStats(r.cpu);
    metric('F.cpu.' + tag + '.mean_ms=' + f3(st.mean));
    metric('F.cpu.' + tag + '.p50_ms=' + f3(st.p50));
    metric('F.cpu.' + tag + '.p99_ms=' + f3(st.p99));
    metric('F.cpu.' + tag + '.max_ms=' + f3(st.max));
    metric('F.cpu.' + tag + '.p99_pct_of_quantum=' + f1(100 * st.p99 / QUANTUM_MS));
    metric('F.cpu.' + tag + '.cpu_ms_per_audio_s=' + f1(st.mean * r.cpu.length / audioSec));
  }
  cpuReport('vocal_hard', rHard, pcm.length / SR);
  var hiSig = tone(detune(440, 45), 4, { harmonic: true }); // max grain rate + active shift
  var rHi = runChain(Processor, hiSig, { retune: 0 });
  cpuReport('tone440_hard', rHi, hiSig.length / SR);

  // ------------------------------------------------------------------
  console.log('');
  console.log('Listening artifacts (for the user\'s ear, agent cannot audition):');
  console.log('  ' + path.join('tests/spike/out', 'at0-input.wav'));
  console.log('  ' + path.join('tests/spike/out', 'at0-chromatic-0ms.wav'));
  console.log('  ' + path.join('tests/spike/out', 'at0-chromatic-250ms.wav'));
  console.log('  ' + path.join('tests/spike/out', 'at0-cmajor-0ms.wav'));
}

try {
  main();
} catch (err) {
  console.error('CRASH:', err && err.stack || err);
  process.exit(1);
}
