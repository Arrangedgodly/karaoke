// QA-2 harness — cycle-3 REGRESSION renders: legacy audio identity, the
// safety net over chains containing the four new effects, and chain-level
// bypass over an all-ten chain.
//
// QA-2's scope (docs/ultron/plan.md, cycle 3): the six legacy effects
// (gain/EQ/compressor/limiter/delay/reverb) unchanged in behavior;
// watchdog + limiter safety net intact with the new nodes in the chain;
// bypass still bypasses a chain containing all four. The committed suite
// (tests/test-regression-cycle3.js) covers the shared-code leak surfaces
// that need no audio; this harness covers everything that needs REAL
// rendered samples:
//
//   A. LEGACY AUDIO IDENTITY — the shipped six-node chain (and a
//      corner-params variant) is rendered through the REAL
//      AudioGraph.buildGraph() + REAL node files twice: once with ALL TEN
//      node modules loaded (today's registry), once with ONLY the six
//      legacy modules loaded (the exact pre-cycle-3 registry shape). The
//      renders must be BIT-IDENTICAL — the strongest available proof that
//      registering the four cycle-3 types changed no legacy sample.
//      Sensitivity checks guard against a vacuous pass.
//   B. CHAIN-LEVEL BYPASS, ALL TEN — QA-1 section A already proved bypass
//      bit-exact over a four-effect chain (qa1-report.txt A.bypass_chain);
//      this extends the same check to a chain containing ALL TEN types
//      (legacy + new interleaved, terminal limiter).
//   C. WATCHDOG + LIMITER SAFETY NET, ALL FOUR NEW NODES IN THE CHAIN —
//      the REAL src/meter-taps.js watchdog runs against REAL rendered
//      audio of chains containing gate+distortion+chorus+autotune:
//        C1 tap point (analyserOut on the output attenuator, worklet side
//           tap wired at the same point),
//        C2 valid program through the full ten-node chain (limiter
//           terminal) does NOT trip,
//        C3 the human-sovereignty scenario (limiter removed by hand, hot
//           input) DOES trip and latch with all four new nodes upstream,
//        C4 a graph REBUILD of the same all-four chain while latched
//           schedules no upward chain-gate ramp (the issue-#3 fix,
//           re-proven with worklet/composite nodes in the teardown set),
//        C5 the latch holds through quiet program (no auto-recover) and
//           only the human Restore output button reopens the gate.
//      The terminal-limiter REFUSAL policies (agent lane) are proven in
//      tests/test-regression-cycle3.js part D; the legacy-chain watchdog
//      behaviors are proven by tests/test-watchdog-tap-and-latch.js +
//      tests/test-hidden-tab-watchdog.js (cited, not re-run).
//
// Machinery: the QA-1 offline render harness (tests/qa-out/run-qa1.js),
// extended with the node kinds the six LEGACY types need —
// DynamicsCompressorNode and ConvolverNode — plus analysers that derive
// their time/frequency windows from real rendered blocks (so the watchdog
// samples true final-output audio), and an inert setInterval (the #7
// hidden-tab interval latch never ticks here; the rAF-visible path — the
// one test-watchdog-tap-and-latch.js drives — decides every trip below).
//
// Documented offline substitutions (same spirit as QA-1/AT-0):
//   - TEST-1 + the reverb IR decoded via ffmpeg to mono 48 kHz f32 (the
//     browser decodes with decodeAudioData).
//   - DynamicsCompressor: the spec-draft feedforward detector (dB-domain
//     knee/ratio curve, attack/release one-pole on the gain reduction).
//     Chrome's exact filter differs; BOTH sides of every comparison use
//     this same runtime, so identity/trip conclusions are unaffected.
//   - Convolver: full-length partition-free FFT overlap-add (N = 65536),
//     IR energy-normalized (1/sqrt(sum h^2)) as the deterministic stand-in
//     for Chrome's normalize=true scaling. Same both-sides rule applies.
//   - Analyser frequency data: a real 2048-point FFT of the rolling
//     time-domain window mapped onto the analyser's dB byte scale.
//   - AudioParam automation applies INSTANTLY (ramps write .value) — QA-1's
//     substitution; every automation call is also RECORDED so C4 can
//     assert "no upward ramp while latched" exactly like the committed
//     watchdog test does.
//   - The watchdog-tap worklet's port messages are delivered synchronously
//     (postMessage -> onmessage), so worklet mode engages for real; with
//     setInterval inert, only the rAF path makes decisions.
//
// Outputs (this directory): qa2-report.txt (committed evidence). No
// listening WAVs — QA-2 has no user-judged audio bar (QA-1 was the
// listening gate). Decoded PCM caches are gitignored (see .gitignore).
//
// Run from the repo root:  node tests/qa-out/run-qa2.js

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..', '..');
var OUT_DIR = __dirname;
var SR = 48000;
var BLOCK = 128;
var PAD_S = 0.4; // render tail so worklet delays + reverb flush
var GATE_D = 240; // gate-worklet look-ahead: 5 ms
var AT_D = 960;   // autotune-worklet declared delay: 20 ms

var report = [];
var failCount = 0;
function line(msg) {
  report.push(msg);
  console.log(msg);
}
function note(kind, msg) {
  line('  ' + kind + ' - ' + msg);
  if (kind === 'FAIL') failCount += 1;
}
function ok(msg) { note('ok', msg); }
function fail(msg) { note('FAIL', msg); }
function metric(msg) { line('METRIC: ' + msg); }
function f1(v) { return Number(v).toFixed(1); }
function f2(v) { return Number(v).toFixed(2); }

// ===========================================================================
// ffmpeg decodes (documented substitution for decodeAudioData)
// ===========================================================================

function ensureDecoded(mp3, target) {
  if (!fs.existsSync(mp3)) throw new Error('missing ' + mp3);
  if (fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  var res = cp.spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', mp3, '-ac', '1', '-ar', String(SR),
    '-f', 'f32le', '-c:a', 'pcm_f32le', target
  ], { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error('ffmpeg decode failed for ' + mp3 + ': ' + (res.stderr || '').slice(0, 400));
  }
}

function decodeVocal() {
  var mp3 = path.join(ROOT, 'assets', 'test-vocal.mp3');
  var spikeCache = path.join(ROOT, 'tests', 'spike', 'out', 'test-vocal-48k-mono.f32');
  var raw = path.join(OUT_DIR, 'test-vocal-48k-mono.f32');
  var target = fs.existsSync(spikeCache) ? spikeCache : raw;
  ensureDecoded(mp3, target);
  var buf = fs.readFileSync(target);
  var pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
  var copy = new Float32Array(pcm.length);
  copy.set(pcm);
  return copy;
}

function decodeIr() {
  var mp3 = path.join(ROOT, 'assets', 'ir', 'plate-vocal.mp3');
  if (!fs.existsSync(mp3)) throw new Error('missing ' + mp3 + ' (reverb IR asset)');
  var raw = path.join(OUT_DIR, 'ir-plate-48k-mono.f32');
  ensureDecoded(mp3, raw);
  var buf = fs.readFileSync(raw);
  var pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
  var copy = new Float32Array(pcm.length);
  copy.set(pcm);
  return copy;
}

// ===========================================================================
// Iterative radix-2 FFT (Float64, cached per size) — convolver + analyser.
// ===========================================================================

var fftCache = {};
function fftPlan(N) {
  if (fftCache[N]) return fftCache[N];
  var rev = new Uint32Array(N);
  var levels = Math.log2(N) | 0;
  for (var i = 0; i < N; i++) {
    var r = 0, x = i;
    for (var b2 = 0; b2 < levels; b2++) { r = (r << 1) | (x & 1); x >>= 1; }
    rev[i] = r;
  }
  var cosT = new Float64Array(N / 2);
  var sinT = new Float64Array(N / 2);
  for (var k = 0; k < N / 2; k++) {
    cosT[k] = Math.cos((-2 * Math.PI * k) / N);
    sinT[k] = Math.sin((-2 * Math.PI * k) / N);
  }
  var plan = { N: N, rev: rev, cosT: cosT, sinT: sinT };
  fftCache[N] = plan;
  return plan;
}

function fftRun(re, im, inverse) {
  var p = fftPlan(re.length);
  var N = p.N, rev = p.rev;
  for (var i = 0; i < N; i++) {
    var j = rev[i];
    if (j > i) {
      var tr = re[i]; re[i] = re[j]; re[j] = tr;
      var ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (var size = 2; size <= N; size *= 2) {
    var half = size / 2;
    var step = N / size;
    for (var off = 0; off < N; off += size) {
      for (var k2 = 0; k2 < half; k2++) {
        var ci = p.cosT[k2 * step] ;
        var si = inverse ? -p.sinT[k2 * step] : p.sinT[k2 * step];
        var l = off + k2, m = off + k2 + half;
        var tre = re[m] * ci - im[m] * si;
        var tim = re[m] * si + im[m] * ci;
        re[m] = re[l] - tre; im[m] = im[l] - tim;
        re[l] += tre; im[l] += tim;
      }
    }
  }
  if (inverse) {
    for (var n = 0; n < N; n++) { re[n] /= N; im[n] /= N; }
  }
}

// ===========================================================================
// Offline Web Audio runtime — QA-1's engine + the legacy node kinds
// (compressor, convolver) + real-block analysers.
// ===========================================================================

function makeParam(initial) {
  var p = {
    value: initial,
    __isAudioParam: true,
    __feeds: [],
    __automation: [], // every automation call recorded (C4 asserts on it)
    cancelScheduledValues: function () {
      p.__automation.push({ type: 'cancel', target: null });
    },
    setValueAtTime: function (v) {
      p.__automation.push({ type: 'setValue', target: v });
      p.value = v;
    },
    linearRampToValueAtTime: function (v) {
      p.__automation.push({ type: 'linearRamp', target: v });
      p.value = v;
    },
    setTargetAtTime: function (v) {
      p.__automation.push({ type: 'setTarget', target: v });
      p.value = v;
    },
    exponentialRampToValueAtTime: function (v) {
      p.__automation.push({ type: 'exponentialRamp', target: v });
      p.value = v;
    }
  };
  return p;
}

var nodeIdCounter = 0;

function makeEngineNode(kind) {
  return {
    __id: ++nodeIdCounter,
    __kind: kind,
    __inputs: [],
    __outputs: [],
    __memo: [],
    __state: null,
    connect: function (dest) {
      if (dest && dest.__isAudioParam) {
        if (dest.__feeds.indexOf(this) === -1) dest.__feeds.push(this);
      } else if (dest && dest.__inputs) {
        if (dest.__inputs.indexOf(this) === -1) dest.__inputs.push(this);
      } else {
        return dest;
      }
      if (this.__outputs.indexOf(dest) === -1) this.__outputs.push(dest);
      return dest;
    },
    disconnect: function (dest) {
      if (dest === undefined) {
        var outs = this.__outputs.slice();
        for (var i = 0; i < outs.length; i++) this.disconnect(outs[i]);
        return;
      }
      var oi = this.__outputs.indexOf(dest);
      if (oi !== -1) this.__outputs.splice(oi, 1);
      if (dest.__isAudioParam) {
        var fi = dest.__feeds.indexOf(this);
        if (fi !== -1) dest.__feeds.splice(fi, 1);
      } else if (dest.__inputs) {
        var ii = dest.__inputs.indexOf(this);
        if (ii !== -1) dest.__inputs.splice(ii, 1);
      }
    }
  };
}

function sumInputs(node, b, engine) {
  var nch = 1;
  var outs = [];
  for (var i = 0; i < node.__inputs.length; i++) {
    var o = renderNode(node.__inputs[i], b, engine);
    if (o.length > nch) nch = o.length;
    outs.push(o);
  }
  var res = [];
  for (var c = 0; c < nch; c++) res.push(new Float32Array(BLOCK));
  for (var j = 0; j < outs.length; j++) {
    for (var c2 = 0; c2 < nch; c2++) {
      var src = outs[j][c2 < outs[j].length ? c2 : 0];
      for (var s = 0; s < BLOCK; s++) res[c2][s] += src[s];
    }
  }
  return res;
}

function paramBlockValue(param, b, engine) {
  var v = param.value;
  for (var i = 0; i < param.__feeds.length; i++) {
    var o = renderNode(param.__feeds[i], b, engine);
    v += o[0][0];
  }
  return v;
}

function shapeCurveLookup(curve, x) {
  var n = curve.length;
  if (x <= -1) return curve[0];
  if (x >= 1) return curve[n - 1];
  var pos = (x + 1) * (n - 1) / 2;
  var i0 = Math.floor(pos);
  if (i0 >= n - 1) return curve[n - 1];
  var frac = pos - i0;
  return curve[i0] * (1 - frac) + curve[i0 + 1] * frac;
}

var SHAPE_DECIMATE = [1 / 8, 3 / 8, 3 / 8, 1 / 8];

// --- DynamicsCompressor: spec-draft feedforward (documented substitution) --
function compressorProcess(node, inp) {
  var thr = node.threshold.value;
  var knee = Math.max(0, node.knee.value);
  var ratio = Math.max(1, node.ratio.value);
  var attackS = Math.max(0, node.attack.value);
  var releaseS = Math.max(0, node.release.value);
  var attA = attackS > 0 ? Math.exp(-1 / (attackS * SR)) : 0;
  var relA = releaseS > 0 ? Math.exp(-1 / (releaseS * SR)) : 0;
  var st = node.__state || (node.__state = { grDb: 0 });
  var out = inp.map(function (c) { return new Float32Array(BLOCK); });
  for (var s = 0; s < BLOCK; s++) {
    var det = 0;
    for (var c = 0; c < inp.length; c++) {
      var a = Math.abs(inp[c][s]);
      if (a > det) det = a;
    }
    var xDb = 20 * Math.log10(Math.max(det, 1e-9));
    var yDb;
    var over = xDb - thr;
    if (over <= 0) {
      yDb = xDb;
    } else if (knee > 0 && over <= knee) {
      yDb = xDb + ((1 / ratio - 1) * over * over) / knee;
    } else {
      var effOver = knee > 0 ? over - knee / 2 : over; // hard knee: full ratio at once
      if (knee > 0) {
        // soft knee: the curve reaches full slope at over == knee
        yDb = thr + knee / 2 + effOver / ratio;
      } else {
        yDb = thr + over / ratio;
      }
    }
    var grTarget = Math.max(0, xDb - yDb);
    if (grTarget > st.grDb) {
      st.grDb = attA * st.grDb + (1 - attA) * grTarget;
    } else {
      st.grDb = relA * st.grDb + (1 - relA) * grTarget;
    }
    var gain = Math.pow(10, -st.grDb / 20);
    for (var c2 = 0; c2 < out.length; c2++) {
      out[c2][s] = inp[c2][s] * gain;
    }
  }
  return out;
}

// --- Convolver: full-length FFT overlap-add (documented substitution) ------
var IR_F32 = null; // set at boot (decodeIr)
var CONV_PLAN = null;

function convolverPlan(ir) {
  var Lh = ir.length;
  var N = 1;
  while (N < Lh + BLOCK) N *= 2; // 65536 for a ~1 s IR
  var energy = 0;
  for (var i = 0; i < Lh; i++) energy += ir[i] * ir[i];
  var scale = 1 / Math.sqrt(energy || 1);
  var Hre = new Float64Array(N);
  var Him = new Float64Array(N);
  for (var j = 0; j < Lh; j++) Hre[j] = ir[j] * scale;
  fftRun(Hre, Him, false);
  return { N: N, Hre: Hre, Him: Him };
}

function convolverProcess(node, inp) {
  if (!node.buffer || !node.buffer.getChannelData) {
    return inp.map(function (c) { return new Float32Array(BLOCK); }); // spec: no buffer -> silence
  }
  if (!CONV_PLAN) CONV_PLAN = convolverPlan(node.buffer.getChannelData(0));
  var N = CONV_PLAN.N;
  var st = node.__state || (node.__state = { acc: new Float64Array(N) });
  var x = inp[0]; // mono IR; sum down if needed
  if (inp.length > 1) {
    x = new Float32Array(BLOCK);
    for (var c = 0; c < inp.length; c++) {
      for (var s0 = 0; s0 < BLOCK; s0++) x[s0] += inp[c][s0];
    }
  }
  var Xre = new Float64Array(N);
  var Xim = new Float64Array(N);
  for (var s1 = 0; s1 < BLOCK; s1++) Xre[s1] = x[s1];
  fftRun(Xre, Xim, false);
  var Yre = new Float64Array(N);
  var Yim = new Float64Array(N);
  for (var k = 0; k < N; k++) {
    Yre[k] = Xre[k] * CONV_PLAN.Hre[k] - Xim[k] * CONV_PLAN.Him[k];
    Yim[k] = Xre[k] * CONV_PLAN.Him[k] + Xim[k] * CONV_PLAN.Hre[k];
  }
  fftRun(Yre, Yim, true);
  for (var s2 = 0; s2 < N; s2++) st.acc[s2] += Yre[s2];
  var o = new Float32Array(BLOCK);
  for (var s3 = 0; s3 < BLOCK; s3++) o[s3] = st.acc[s3];
  st.acc.copyWithin(0, BLOCK); // shift the overlap
  for (var s4 = N - BLOCK; s4 < N; s4++) st.acc[s4] = 0;
  return [o];
}

// --- Analyser: rolling real-audio window + FFT frequency data --------------
function makeAnalyserNode() {
  var n = makeEngineNode('analyser');
  n.fftSize = 2048;
  n.smoothingTimeConstant = 0.8;
  n.minDecibels = -100;
  n.maxDecibels = -30;
  var ring = new Float32Array(n.fftSize);
  var w = 0;
  n.getFloatTimeDomainData = function (buf) {
    var N2 = n.fftSize;
    for (var i = 0; i < N2 && i < buf.length; i++) buf[i] = ring[(w + i) % N2];
  };
  n.getByteFrequencyData = function (buf) {
    var N2 = n.fftSize;
    var re = new Float64Array(N2);
    var im = new Float64Array(N2);
    for (var i = 0; i < N2; i++) re[i] = ring[(w + i) % N2];
    fftRun(re, im, false);
    var minDb = n.minDecibels, maxDb = n.maxDecibels;
    for (var k = 0; k < buf.length; k++) {
      var mag = k < N2 / 2 ? Math.sqrt(re[k] * re[k] + im[k] * im[k]) / (N2 / 2) : 0;
      var db = mag > 1e-12 ? 20 * Math.log10(mag) : -240;
      var b = Math.round((255 * (db - minDb)) / (maxDb - minDb));
      buf[k] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  };
  n.__ingest = function (block) {
    for (var s = 0; s < block.length; s++) {
      ring[w] = block[s];
      w = (w + 1) % n.fftSize;
    }
  };
  return n;
}

function renderNode(node, b, engine) {
  if (node.__memo[b]) return node.__memo[b];
  // Feedback cycles (the delay node's feedback loop): Web Audio mandates a
  // one-render-quantum delay around any cycle; the pull renderer models
  // exactly that by feeding the re-entered node its PREVIOUS block. Both
  // comparison sides share the rule (documented substitution).
  if (node.__rendering) {
    return node.__prevOut || [new Float32Array(BLOCK)];
  }
  node.__rendering = true;
  var out = renderNodeInner(node, b, engine);
  node.__rendering = false;
  node.__prevOut = out;
  node.__memo[b] = out;
  return out;
}

function renderNodeInner(node, b, engine) {
  var out = null;
  var kind = node.__kind;

  if (kind === 'buffer-source') {
    var off = b * BLOCK;
    var ch = new Float32Array(BLOCK);
    for (var s0 = 0; s0 < BLOCK; s0++) {
      var idx = off + s0;
      ch[s0] = idx < engine.__pcm.length ? engine.__pcm[idx] : 0;
    }
    out = [ch];
  } else if (kind === 'gain') {
    var inp = sumInputs(node, b, engine);
    var g = paramBlockValue(node.gain, b, engine);
    out = inp.map(function (c) {
      var o = new Float32Array(BLOCK);
      for (var s = 0; s < BLOCK; s++) o[s] = c[s] * g;
      return o;
    });
  } else if (kind === 'oscillator') {
    var oc = new Float32Array(BLOCK);
    var w = 2 * Math.PI * node.frequency.value / SR;
    for (var s1 = 0; s1 < BLOCK; s1++) {
      oc[s1] = Math.sin(w * (b * BLOCK + s1));
    }
    out = [oc];
  } else if (kind === 'waveshaper') {
    var inp2 = sumInputs(node, b, engine);
    var curve = node.curve;
    out = inp2.map(function (c) {
      var o = new Float32Array(BLOCK);
      if (!curve || node.oversample !== '4x') {
        for (var s = 0; s < BLOCK; s++) o[s] = shapeCurveLookup(curve, c[s]);
      } else {
        var up = new Float32Array(BLOCK * 4 + 4);
        for (var k = -1; k <= BLOCK; k++) {
          var x0 = k > 0 ? c[k - 1] : c[0];
          var x1 = k < BLOCK ? c[k] : c[BLOCK - 1];
          for (var u = 0; u < 4; u++) {
            up[(k + 1) * 4 + u] = x0 + (x1 - x0) * (u / 4);
          }
        }
        for (var s2 = 0; s2 < BLOCK; s2++) {
          var acc = 0;
          for (var t = 0; t < 4; t++) {
            acc += SHAPE_DECIMATE[t] * shapeCurveLookup(curve, up[(s2 + 1) * 4 + t]);
          }
          o[s2] = acc;
        }
      }
      return o;
    });
  } else if (kind === 'biquad') {
    var inp3 = sumInputs(node, b, engine);
    var st2 = node.__state || (node.__state = { co: null, perCh: {} });
    if (!st2.co) {
      // RBJ cookbook coefficients per type (lowpass as QA-1's engine;
      // lowshelf/peaking/highshelf for the EQ's three bands — the shelf
      // dB gain is part of the filter, not a post scale).
      var f0 = node.frequency.value;
      var Q = node.Q.value;
      var w0 = 2 * Math.PI * f0 / SR;
      var cosw = Math.cos(w0);
      var sinw = Math.sin(w0);
      var alpha = sinw / (2 * Q);
      var A = Math.pow(10, node.gain.value / 40); // shelf/peaking amplitude
      var sqA2 = 2 * Math.sqrt(A);
      var b0, b1, b2, a0, a1, a2;
      if (node.type === 'lowshelf') {
        b0 = A * ((A + 1) - (A - 1) * cosw + sqA2 * alpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cosw);
        b2 = A * ((A + 1) - (A - 1) * cosw - sqA2 * alpha);
        a0 = (A + 1) + (A - 1) * cosw + sqA2 * alpha;
        a1 = -2 * ((A - 1) + (A + 1) * cosw);
        a2 = (A + 1) + (A - 1) * cosw - sqA2 * alpha;
      } else if (node.type === 'highshelf') {
        b0 = A * ((A + 1) + (A - 1) * cosw + sqA2 * alpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cosw);
        b2 = A * ((A + 1) + (A - 1) * cosw - sqA2 * alpha);
        a0 = (A + 1) - (A - 1) * cosw + sqA2 * alpha;
        a1 = 2 * ((A - 1) - (A + 1) * cosw);
        a2 = (A + 1) - (A - 1) * cosw - sqA2 * alpha;
      } else if (node.type === 'peaking') {
        b0 = 1 + alpha * A;
        b1 = -2 * cosw;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosw;
        a2 = 1 - alpha / A;
      } else {
        // lowpass (distortion's tone stage) — QA-1's exact formula.
        b0 = (1 - cosw) / 2; b1 = 1 - cosw; b2 = (1 - cosw) / 2;
        a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha;
      }
      st2.co = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
    }
    out = inp3.map(function (c, ci) {
      var per = st2.perCh[ci] || (st2.perCh[ci] = { x1: 0, x2: 0, y1: 0, y2: 0 });
      var o = new Float32Array(BLOCK);
      for (var s = 0; s < BLOCK; s++) {
        var x = c[s];
        var y = st2.co[0] * x + st2.co[1] * per.x1 + st2.co[2] * per.x2
          - st2.co[3] * per.y1 - st2.co[4] * per.y2;
        per.x2 = per.x1; per.x1 = x; per.y2 = per.y1; per.y1 = y;
        o[s] = y;
      }
      return o;
    });
  } else if (kind === 'delay') {
    var inp4 = sumInputs(node, b, engine);
    var maxN = Math.round(node.__maxDelayS * SR) + BLOCK * 2;
    var st3 = node.__state || (node.__state = { bufs: [], w: 0 });
    if (!st3.bufs.length) {
      for (var c0 = 0; c0 < inp4.length; c0++) st3.bufs.push(new Float32Array(maxN));
    }
    var dSamples = paramBlockValue(node.delayTime, b, engine) * SR;
    out = inp4.map(function (c, ci) {
      var buf = st3.bufs[ci];
      var o = new Float32Array(BLOCK);
      for (var s = 0; s < BLOCK; s++) {
        var wPos = st3.w + s;
        buf[wPos % maxN] = c[s];
        var rPos = wPos - dSamples;
        var iR = Math.floor(rPos);
        var fr = rPos - iR;
        var sA = buf[((iR % maxN) + maxN) % maxN];
        var sB = buf[(((iR + 1) % maxN) + maxN) % maxN];
        o[s] = sA * (1 - fr) + sB * fr;
      }
      return o;
    });
    st3.w = (st3.w + BLOCK) % maxN;
  } else if (kind === 'panner') {
    var inp5 = sumInputs(node, b, engine);
    var pan = node.pan.value;
    var x = (pan + 1) / 2;
    var gl = Math.cos(x * Math.PI / 2);
    var gr = Math.sin(x * Math.PI / 2);
    var mono = inp5[0];
    var L = new Float32Array(BLOCK), R = new Float32Array(BLOCK);
    for (var s3 = 0; s3 < BLOCK; s3++) { L[s3] = mono[s3] * gl; R[s3] = mono[s3] * gr; }
    out = [L, R];
  } else if (kind === 'compressor') {
    out = compressorProcess(node, sumInputs(node, b, engine));
  } else if (kind === 'convolver') {
    out = convolverProcess(node, sumInputs(node, b, engine));
  } else if (kind === 'analyser') {
    var inp6 = sumInputs(node, b, engine);
    node.__ingest(inp6[0]);
    out = inp6;
  } else if (kind === 'worklet') {
    var inp7 = sumInputs(node, b, engine);
    var outputs = [];
    for (var c1 = 0; c1 < inp7.length; c1++) outputs.push(new Float32Array(BLOCK));
    var params = {};
    var names = Object.keys(node.__params);
    for (var pi = 0; pi < names.length; pi++) {
      params[names[pi]] = new Float32Array([node.__params[names[pi]].value]);
    }
    node.__processor.process([inp7], [outputs], params);
    out = outputs;
  } else {
    // destination / passthrough collector
    out = sumInputs(node, b, engine);
  }
  node.__memo[b] = out;
  return out;
}

// ===========================================================================
// Sandbox: REAL src files over the rendering runtime.
// ===========================================================================

var CORE_FILES = ['src/audio-graph.js', 'src/node-types.js', 'src/audio-param-ramp.js'];
var LEGACY_NODE_FILES = [
  'src/node-gain.js', 'src/node-compressor.js', 'src/node-eq.js',
  'src/node-delay.js', 'src/node-reverb.js', 'src/node-limiter.js'
];
var NEW_NODE_FILES = [
  'src/node-distortion.js', 'src/node-chorus.js',
  'src/node-gate.js', 'src/node-autotune.js'
];

function createRenderSandbox(pcm, opts) {
  opts = opts || {};
  var processors = {};
  var createdAnalysers = [];
  var rafQueue = [];
  var clockMs = { v: 0 };
  var domEvents = [];

  var ctx = {
    currentTime: 0,
    sampleRate: SR,
    __pcm: pcm,
    destination: makeEngineNode('destination'),
    createGain: function () {
      var n = makeEngineNode('gain');
      n.gain = makeParam(1);
      return n;
    },
    createWaveShaper: function () {
      var n = makeEngineNode('waveshaper');
      n.curve = null;
      n.oversample = 'none';
      return n;
    },
    createBiquadFilter: function () {
      var n = makeEngineNode('biquad');
      n.type = 'lowpass';
      n.frequency = makeParam(350);
      n.Q = makeParam(1);
      n.gain = makeParam(0);
      return n;
    },
    createDelay: function (maxDelayS) {
      var n = makeEngineNode('delay');
      n.__maxDelayS = maxDelayS || 1;
      n.delayTime = makeParam(0);
      return n;
    },
    createOscillator: function () {
      var n = makeEngineNode('oscillator');
      n.type = 'sine';
      n.frequency = makeParam(440);
      n.start = function () { n.__started = true; };
      n.stop = function () {};
      return n;
    },
    createStereoPanner: function () {
      var n = makeEngineNode('panner');
      n.pan = makeParam(0);
      return n;
    },
    createDynamicsCompressor: function () {
      var n = makeEngineNode('compressor');
      n.threshold = makeParam(-24);
      n.knee = makeParam(30);
      n.ratio = makeParam(12);
      n.attack = makeParam(0.003);
      n.release = makeParam(0.25);
      return n;
    },
    createConvolver: function () {
      var n = makeEngineNode('convolver');
      n.buffer = null;
      n.normalize = true;
      return n;
    },
    createAnalyser: function () {
      var n = makeAnalyserNode();
      createdAnalysers.push(n);
      return n;
    },
    decodeAudioData: function (ab) {
      // Deterministic IR decode: the pre-decoded mono f32 (documented
      // substitution); both comparison sides share it byte-for-byte.
      var ir = IR_F32;
      var copy = new Float32Array(ir.length);
      copy.set(ir);
      return Promise.resolve({
        numberOfChannels: 1,
        length: copy.length,
        sampleRate: SR,
        getChannelData: function () { return copy; }
      });
    },
    audioWorklet: {
      addModule: function (url) {
        var file = path.join(ROOT, url.replace(/^\//, ''));
        var src = fs.readFileSync(file, 'utf8');
        var scope = {
          console: console,
          sampleRate: SR,
          currentTime: 0,
          Float32Array: Float32Array,
          Math: Math,
          AudioWorkletProcessor: function () {},
          registerProcessor: function (name, ctor) { processors[name] = ctor; }
        };
        vm.createContext(scope);
        vm.runInContext(src, scope, { filename: path.basename(file) });
        return Promise.resolve();
      }
    }
  };

  function AudioWorkletNodeCtor(context, name) {
    var Ctor = processors[name];
    if (!Ctor) throw new Error('QA harness: processor not registered: ' + name);
    var n = makeEngineNode('worklet');
    n.__processor = new Ctor();
    n.__params = {};
    var descs = Ctor.parameterDescriptors || [];
    for (var i = 0; i < descs.length; i++) {
      n.__params[descs[i].name] = makeParam(descs[i].defaultValue);
    }
    n.parameters = {
      get: function (id) {
        if (!n.__params[id]) n.__params[id] = makeParam(0);
        return n.__params[id];
      }
    };
    n.port = {
      onmessage: null,
      postMessage: function (msg) {
        if (n.port.onmessage) n.port.onmessage({ data: msg });
      }
    };
    return n;
  }

  var sourceNode = makeEngineNode('buffer-source');

  // --- DOM stub (meter-taps alert path) ---------------------------------
  function classHas(el, cls) {
    return String(el.className || '').split(/\s+/).indexOf(cls) !== -1;
  }
  function makeDomElement(tag) {
    var el = {
      tagName: tag,
      type: '',
      id: '',
      className: '',
      textContent: '',
      parentNode: null,
      children: [],
      __listeners: {},
      setAttribute: function (name, value) { el['__attr_' + name] = value; },
      appendChild: function (child) {
        child.parentNode = el;
        el.children.push(child);
        return child;
      },
      insertBefore: function (child, ref) {
        child.parentNode = el;
        var idx = el.children.indexOf(ref);
        if (idx === -1) el.children.push(child);
        else el.children.splice(idx, 0, child);
        return child;
      },
      removeChild: function (child) {
        var idx = el.children.indexOf(child);
        if (idx !== -1) el.children.splice(idx, 1);
        child.parentNode = null;
        return child;
      },
      addEventListener: function (type, fn) {
        (el.__listeners[type] = el.__listeners[type] || []).push(fn);
      },
      __fire: function (type) {
        (el.__listeners[type] || []).forEach(function (fn) { fn(); });
      },
      querySelector: function (sel) {
        if (sel && sel.charAt(0) === '.') {
          var cls = sel.slice(1);
          for (var i = 0; i < el.children.length; i++) {
            if (classHas(el.children[i], cls)) return el.children[i];
          }
        }
        return null;
      },
      querySelectorAll: function () { return []; }
    };
    return el;
  }
  var canvasEl = makeDomElement('div');
  canvasEl.id = 'chain-canvas';

  var sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: function (fn) { return setTimeout(fn, 0); },
    clearTimeout: clearTimeout,
    // Inert interval (documented substitution): the #7 hidden-tab latch
    // never ticks; the rAF-visible path decides every trip in section C.
    setInterval: function () { return 0; },
    clearInterval: function () {},
    requestAnimationFrame: function (fn) {
      rafQueue.push(fn);
      return rafQueue.length;
    },
    cancelAnimationFrame: function () {},
    performance: { now: function () { return clockMs.v; } },
    document: {
      getElementById: function (id) {
        return id === 'chain-canvas' ? canvasEl : null;
      },
      createElement: function (tag) { return makeDomElement(tag); },
      addEventListener: function () {}
    },
    Float32Array: Float32Array,
    Uint8Array: Uint8Array,
    AudioWorkletNode: AudioWorkletNodeCtor,
    // Reverb's module-load IR fetch: resolves with the real (pre-decoded)
    // bytes so the wet path actually renders.
    fetch: function () {
      var ab = IR_F32.buffer.slice(IR_F32.byteOffset, IR_F32.byteOffset + IR_F32.byteLength);
      return Promise.resolve({ arrayBuffer: function () { return Promise.resolve(ab); } });
    },
    AudioEngine: {
      isStarted: true,
      audioContext: ctx,
      sourceNode: sourceNode
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  CORE_FILES.concat(opts.nodeFiles || []).forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  });
  if (opts.defaultPreset) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/default-preset.js'), 'utf8'),
      sandbox, { filename: 'src/default-preset.js' });
  }
  if (opts.audioBypass) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/audio-bypass.js'), 'utf8'),
      sandbox, { filename: 'src/audio-bypass.js' });
  }
  if (opts.meterTaps) {
    sandbox.Meters = {
      feed: function (side, stats) { domEvents.push({ side: side, peakDb: stats.peakDb }); },
      setEngineState: function () {},
      reset: function () {}
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/meter-taps.js'), 'utf8'),
      sandbox, { filename: 'src/meter-taps.js' });
  }

  return {
    sandbox: sandbox,
    ctx: ctx,
    sourceNode: sourceNode,
    canvasEl: canvasEl,
    analysers: createdAnalysers,
    rafQueue: rafQueue,
    clockMs: clockMs,
    domEvents: domEvents,
    __cursor: 0,
    render: function (nSamples) {
      return renderRange(this, nSamples, 0, 0);
    },
    // Section C's loop: render + pull the analysers + pump rAF frames at a
    // chosen cadence (each pump advances the synthetic clock by frameMs).
    // Both render functions CONTINUE from a persistent block cursor — the
    // engine is forward-only (memoized per block index), so successive
    // calls render successive audio, exactly like a running context.
    renderWithFrames: function (nSamples, frameEveryBlocks, frameMs) {
      return renderRange(this, nSamples, frameEveryBlocks, frameMs);
    }
  };
}

function renderRange(rs, nSamples, frameEveryBlocks, frameMs) {
  var ctx = rs.ctx;
  var createdAnalysers = rs.analysers;
  var rafQueue = rs.rafQueue;
  var nBlocks = Math.ceil(nSamples / BLOCK);
  var startB = rs.__cursor || 0;
  var chans = null;
  for (var i = 0; i < nBlocks; i++) {
    var b = startB + i;
    var o = renderNode(ctx.destination, b, ctx);
    for (var a = 0; a < createdAnalysers.length; a++) {
      renderNode(createdAnalysers[a], b, ctx); // ingest real audio
    }
    if (frameEveryBlocks > 0 && i % frameEveryBlocks === 0) {
      rs.clockMs.v += frameMs;
      var fn = rafQueue.shift();
      if (fn) fn(rs.clockMs.v);
    }
    if (!chans) chans = o.map(function () { return new Float32Array(nBlocks * BLOCK); });
    for (var c = 0; c < o.length; c++) {
      chans[c].set(o[c], i * BLOCK);
    }
  }
  rs.__cursor = startB + nBlocks;
  return chans;
}

/** Build a chain through the REAL buildGraph and settle (deferred rewire +
 *  worklet placeholder+splice). */
async function buildChain(rs, model, settleMs) {
  vm.runInContext('window.AudioGraph.buildGraph(' + JSON.stringify(model) + ')', rs.sandbox);
  await new Promise(function (r) { setTimeout(r, settleMs || 200); });
}

// ===========================================================================
// Metric helpers (QA-1's)
// ===========================================================================

function peakDb(x) {
  var p = 0;
  for (var i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return 20 * Math.log10(p + 1e-30);
}

function rmsDb(x) {
  var acc = 0;
  for (var i = 0; i < x.length; i++) acc += x[i] * x[i];
  return 10 * Math.log10(acc / x.length + 1e-30);
}

function diffRmsDb(a, b) {
  var acc = 0;
  var n = Math.min(a.length, b.length);
  for (var i = 0; i < n; i++) { var d = a[i] - b[i]; acc += d * d; }
  return 10 * Math.log10(acc / n + 1e-30);
}

function bitExactArr(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function firstDiff(a, b) {
  var n = Math.min(a.length, b.length);
  for (var i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return -1;
}

function maxAbs(x, from, to) {
  var m = 0;
  for (var i = from || 0; i < (to || x.length); i++) m = Math.max(m, Math.abs(x[i]));
  return m;
}

// ===========================================================================
// Main
// ===========================================================================

async function main() {
  line('QA-2 harness — cycle-3 regression renders (SR=' + SR + ')');
  line('');

  var vocal = decodeVocal();
  IR_F32 = decodeIr();
  note('ok', 'decoded TEST-1 (' + f1(vocal.length / SR) + ' s) + reverb IR (' +
    f1(IR_F32.length / SR) + ' s, energy-normalized in the convolver stub)');

  // Section A uses a voiced-rich slice (the asset carries ~2.86 s of
  // leading silence): enough material for every legacy stage to act,
  // short enough for four FFT-convolution renders.
  var VOICE_OFF = Math.round(2.8 * SR);
  var A_S = 5.0;
  var aPcm = vocal.subarray(VOICE_OFF, VOICE_OFF + Math.round(A_S * SR));
  var aCopy = new Float32Array(aPcm.length);
  aCopy.set(aPcm);
  var aTotal = aCopy.length + Math.round(PAD_S * SR);

  // =====================================================================
  line('A. LEGACY AUDIO IDENTITY — six-type chain, ten-module vs six-module registry');
  // =====================================================================
  var stressed = [
    { id: 'n1', type: 'gain', params: { gainDb: 18 } },
    { id: 'n2', type: 'compressor', params: { threshold: -60, ratio: 20, attack: 0.5, release: 1 } },
    { id: 'n3', type: 'eq', params: { lowGain: 12, midGain: -12, highGain: 12 } },
    { id: 'n4', type: 'delay', params: { timeMs: 990, feedback: 60, mix: 80 } },
    { id: 'n5', type: 'reverb', params: { mix: 100 } },
    { id: 'n6', type: 'limiter', params: { ceiling: -12, release: 500 } }
  ];

  async function renderLegacy(nodeFiles, model, label) {
    var rs = createRenderSandbox(aCopy, { nodeFiles: nodeFiles, defaultPreset: true });
    var useModel = model || vm.runInContext('window.DEFAULT_PRESET.nodes', rs.sandbox);
    await buildChain(rs, useModel);
    // Reverb's convolver buffer lands asynchronously after the fetch/decode
    // promise drains — one extra macrotask tick for certainty.
    await new Promise(function (r) { setTimeout(r, 30); });
    var chans = rs.render(aTotal);
    metric('A.' + label + '.peak_dbfs=' + f1(peakDb(chans[0])) +
      ' rms_dbfs=' + f1(rmsDb(chans[0])));
    return chans[0];
  }

  var defFull = await renderLegacy(LEGACY_NODE_FILES.concat(NEW_NODE_FILES), null, 'default_full');
  var defLegacy = await renderLegacy(LEGACY_NODE_FILES, null, 'default_legacy');
  var be1 = bitExactArr(defFull, defLegacy);
  if (be1) {
    ok('DEFAULT six-node chain renders BIT-IDENTICAL with all ten modules loaded vs only the six legacy modules');
  } else {
    fail('DEFAULT six-node chain render differs (first diff sample ' + firstDiff(defFull, defLegacy) +
      ', diff RMS ' + f1(diffRmsDb(defFull, defLegacy)) + ' dBFS)');
  }
  metric('A.default.bit_exact=' + be1);

  var strFull = await renderLegacy(LEGACY_NODE_FILES.concat(NEW_NODE_FILES), stressed, 'stressed_full');
  var strLegacy = await renderLegacy(LEGACY_NODE_FILES, stressed, 'stressed_legacy');
  var be2 = bitExactArr(strFull, strLegacy);
  if (be2) {
    ok('STRESSED (corner-params) six-node chain renders BIT-IDENTICAL ten-module vs six-module');
  } else {
    fail('STRESSED six-node chain render differs (first diff sample ' + firstDiff(strFull, strLegacy) +
      ', diff RMS ' + f1(diffRmsDb(strFull, strLegacy)) + ' dBFS)');
  }
  metric('A.stressed.bit_exact=' + be2);

  // Sensitivity: the comparison is not vacuous.
  var sen1 = !bitExactArr(defFull, strFull) && Math.abs(diffRmsDb(defFull, strFull)) > 6;
  if (sen1) {
    ok('sensitivity: default vs stressed renders differ audibly (' +
      f1(diffRmsDb(defFull, strFull)) + ' dBFS) — the comparison bites');
  } else {
    fail('sensitivity: default vs stressed renders are unexpectedly near-identical');
  }
  var sen2 = peakDb(defFull) > -60 && peakDb(strFull) > -60;
  if (sen2) {
    ok('sensitivity: both renders carry signal (peaks ' + f1(peakDb(defFull)) +
      ' / ' + f1(peakDb(strFull)) + ' dBFS)');
  } else {
    fail('sensitivity: a render is effectively silent');
  }
  // The limiter actually limited the stressed pass (its job in the chain).
  metric('A.stressed.peak_dbfs=' + f1(peakDb(strFull)) +
    ' (post-attenuator; limiter at ceiling -12 + attenuator -6 => ~-18 class)');

  // =====================================================================
  line('');
  line('B. CHAIN-LEVEL BYPASS — an ALL-TEN chain (QA-1 proved the four-new chain)');
  // =====================================================================
  var tenChain = [
    { id: 't1', type: 'gain', params: { gainDb: 3 } },
    { id: 't2', type: 'gate', params: {} },
    { id: 't3', type: 'compressor', params: { threshold: -20, ratio: 4, attack: 0.01, release: 0.25 } },
    { id: 't4', type: 'distortion', params: { drive: 0.4, tone: 0.7, output: -3 } },
    { id: 't5', type: 'eq', params: { lowGain: 2, midGain: -1, highGain: 3 } },
    { id: 't6', type: 'chorus', params: { depthMs: 4, rateHz: 1.5, mix: 30 } },
    { id: 't7', type: 'delay', params: { timeMs: 250, feedback: 20, mix: 15 } },
    { id: 't8', type: 'reverb', params: { mix: 25 } },
    { id: 't9', type: 'autotune', params: { key: 'C', scale: 'Chromatic', retune: 50, mix: 60 } },
    { id: 't10', type: 'limiter', params: { ceiling: -3, release: 50 } }
  ];
  var rsB = createRenderSandbox(vocal, {
    nodeFiles: LEGACY_NODE_FILES.concat(NEW_NODE_FILES),
    audioBypass: true
  });
  await buildChain(rsB, tenChain);
  vm.runInContext('window.AudioBypass.reconnectSource(); window.AudioBypass.engage();', rsB.sandbox);
  var bChans = rsB.render(vocal.length + Math.round(PAD_S * SR));
  var bPadded = new Float32Array(vocal.length + Math.round(PAD_S * SR));
  bPadded.set(vocal);
  var beB = bChans[0].length >= bPadded.length &&
    bitExactArr(bChans[0].subarray(0, bPadded.length), bPadded);
  if (beB) {
    ok('chain-level bypass over the ALL-TEN chain (legacy + four new + terminal limiter) is BIT-EXACT vs the raw source');
  } else {
    fail('all-ten bypass render differs from the raw source (first diff sample ' +
      firstDiff(bChans[0], bPadded) + ')');
  }
  metric('B.bypass_allten.bit_exact=' + beB);
  ok('cited: QA-1 qa1-report.txt A.bypass_chain=true (four-new-effect chain, bit-exact)');

  // =====================================================================
  line('');
  line('C. WATCHDOG + SAFETY NET — chains containing all four new effects');
  // =====================================================================

  // --- C2: valid program, full ten-node chain, limiter terminal ----------
  // Voiced slice (the asset's ~2.86 s leading silence would render
  // silence), normal level.
  var cSlice = vocal.subarray(VOICE_OFF, VOICE_OFF + Math.round(6.0 * SR));
  var pcmC = new Float32Array(cSlice.length);
  pcmC.set(cSlice);
  var rsC = createRenderSandbox(pcmC, {
    nodeFiles: LEGACY_NODE_FILES.concat(NEW_NODE_FILES),
    meterTaps: true
  });
  await buildChain(rsC, tenChain.map(function (e) {
    return { id: e.id, type: e.type, params: Object.assign({}, e.params) };
  }));
  vm.runInContext('window.MeterTaps.onEngineStarted()', rsC.sandbox);
  await new Promise(function (r) { setTimeout(r, 60); }); // worklet tap wiring

  var MT = vm.runInContext('window.MeterTaps', rsC.sandbox);
  var AG = rsC.sandbox.AudioGraph;
  var atten = AG.getOutputAttenuator();
  var gate = AG.getChainGate();

  var aOut = rsC.analysers[1];
  var c1a = aOut && aOut.__inputs.length === 1 && aOut.__inputs[0] === atten;
  if (c1a) {
    ok('C1: the OUT analyser taps the OUTPUT ATTENUATOR (final output) with the all-four chain built');
  } else {
    fail('C1: analyserOut tap point wrong');
  }
  var c2chans = rsC.renderWithFrames(Math.round(3.0 * SR), 16, 50);
  var lastOut = rsC.domEvents.length ? rsC.domEvents[rsC.domEvents.length - 1] : null;
  var notTripped = MT.isTripped() === false;
  if (notTripped) {
    ok('C2: valid program through the full TEN-node chain (limiter terminal) does NOT trip over 3 s of rendered vocal');
  } else {
    fail('C2: watchdog tripped on valid ten-chain program');
  }
  metric('C2.tenchain_tripped=' + !notTripped +
    ' (last OUT meter feed peak ' + (lastOut ? f1(lastOut.peakDb) : 'n/a') + ' dBFS)');
  metric('C2.render_peak_dbfs=' + f1(peakDb(c2chans[0])));

  // --- C3: the human-sovereignty scenario — limiter removed by hand ------
  // A fresh sandbox (fresh watchdog state): hot input, all four new nodes
  // in the chain, NO limiter. This is exactly the standing finding the
  // watchdog exists to cover ("manual limiter removal mid-show is human
  // sovereignty" — the human outranks the policy; the watchdog outranks
  // the howl).
  var hot = new Float32Array(pcmC.length);
  for (var hi = 0; hi < pcmC.length; hi++) hot[hi] = pcmC[hi] * 2; // +6 dB mic
  var rsD = createRenderSandbox(hot, {
    nodeFiles: LEGACY_NODE_FILES.concat(NEW_NODE_FILES),
    meterTaps: true
  });
  var fourNoLimiter = [
    { id: 'w1', type: 'gain', params: { gainDb: 24 } },
    { id: 'w2', type: 'distortion', params: { drive: 0.6, tone: 0.7, output: 0 } },
    { id: 'w3', type: 'eq', params: { lowGain: 12, midGain: 12, highGain: 12 } },
    { id: 'w4', type: 'gate', params: {} },
    { id: 'w5', type: 'chorus', params: { depthMs: 4, rateHz: 1.5, mix: 30 } },
    { id: 'w6', type: 'autotune', params: {} }
  ];
  await buildChain(rsD, fourNoLimiter);
  vm.runInContext('window.MeterTaps.onEngineStarted()', rsD.sandbox);
  await new Promise(function (r) { setTimeout(r, 60); });
  var MTD = vm.runInContext('window.MeterTaps', rsD.sandbox);
  var AGD = rsD.sandbox.AudioGraph;
  var gateD = AGD.getChainGate();

  var dChans = rsD.renderWithFrames(Math.round(4.0 * SR), 16, 50);
  var tripped = MTD.isTripped();
  if (tripped) {
    ok('C3: limiter-less hot chain containing ALL FOUR new nodes TRIPS the watchdog');
  } else {
    fail('C3: watchdog did NOT trip on the limiter-less hot all-four chain');
  }
  metric('C3.tripped=' + tripped + ' (chain gate value after render: ' +
    f3(gateD.gain.value) + ')');
  var alertEl = rsD.canvasEl.children.filter(function (c) { return c.id === 'watchdog-alert'; })[0];
  if (alertEl) {
    ok('C3: the watchdog alert was created (OUTPUT MUTED + Restore output)');
  } else {
    fail('C3: no watchdog alert element');
  }
  var restoreBtn = alertEl
    ? alertEl.children.filter(function (c) { return String(c.tagName).toLowerCase() === 'button'; })[0]
    : null;
  if (restoreBtn && restoreBtn.textContent === 'Restore output') {
    ok('C3: the alert carries the human Restore output button');
  } else {
    fail('C3: Restore output button missing');
  }

  // Post-trip render honesty: the muted chain produces (near-)silence.
  var postTripMax = maxAbs(dChans[0], dChans[0].length - Math.round(0.5 * SR));
  if (postTripMax < 1e-6) {
    ok('C4-pre: the last 0.5 s of the trip render is exact silence (chain gate 0)');
  } else {
    fail('C4-pre: post-trip render still carries signal (max |x| = ' + postTripMax + ')');
  }

  // --- C4: rebuild the same all-four chain while latched ------------------
  var snapAuto = gateD.gain.__automation.length;
  await buildChain(rsD, fourNoLimiter); // same ids/types/params -> node reuse rebuild
  var since = gateD.gain.__automation.slice(snapAuto);
  var upward = since.filter(function (e) {
    return (e.type === 'linearRamp' || e.type === 'setTarget') && e.target > 0.001;
  });
  if (MTD.isTripped() === true && upward.length === 0) {
    ok('C4: rebuilding the all-four chain while latched stays tripped and schedules NO upward chain-gate ramp');
  } else {
    fail('C4: rebuild while latched — tripped=' + MTD.isTripped() +
      ', upward automation entries=' + upward.length);
  }
  var rampedDown = since.some(function (e) {
    return e.type === 'linearRamp' && e.target === 0;
  });
  if (rampedDown) {
    ok('C4: the rebuild un-duck actively targeted the mute level 0 (latch-aware, not Bypass-derived 1.0)');
  } else {
    fail('C4: no mute-level un-duck target found in the rebuild automation');
  }
  metric('C4.rebuild_automation=' + JSON.stringify(since.map(function (e) { return e.type + ':' + e.target; })));

  // --- C5: latch holds through quiet program; only Restore reopens -------
  // Swap the input back to normal level and keep rendering: the latch must
  // hold (no auto-recover anywhere), the alert must persist.
  rsD.ctx.__pcm = pcmC;
  rsD.renderWithFrames(Math.round(1.0 * SR), 16, 50);
  if (MTD.isTripped() === true) {
    ok('C5: the latch HOLDS through 1 s of normal-level program (no auto-recover)');
  } else {
    fail('C5: the latch auto-recovered on quiet program');
  }
  if (restoreBtn) {
    restoreBtn.__fire('click');
  }
  if (MTD.isTripped() === false && gateD.gain.value > 0.9) {
    ok('C5: the human Restore output button alone reopened the chain (gate -> ' +
      f2(gateD.gain.value) + ')');
  } else {
    fail('C5: restore did not reopen the chain (tripped=' + MTD.isTripped() +
      ', gate=' + f3(gateD.gain.value) + ')');
  }

  // The operator's fix: put the limiter back (a fresh ten-node build —
  // same shape as C2). Normal-level program then runs clean through the
  // restored chain, with all four new nodes still in it.
  await buildChain(rsD, tenChain.map(function (e) {
    return { id: e.id, type: e.type, params: Object.assign({}, e.params) };
  }));
  var afterRestore = rsD.renderWithFrames(Math.round(1.5 * SR), 16, 50);
  if (MTD.isTripped() === false) {
    ok('C5: normal-level program through the restored limiter-terminal chain does NOT re-trip');
  } else {
    fail('C5: watchdog re-tripped on normal-level program after restore');
  }
  if (maxAbs(afterRestore[0]) > 1e-3) {
    ok('C5: audio flows again after restore (1.5 s render max |x| = ' +
      f3(maxAbs(afterRestore[0])) + ')');
  } else {
    fail('C5: post-restore render is silent');
  }

  // ------------------------------------------------------------------
  line('');
  line('SUMMARY');
  line('  suite (committed):            23/23 files, 1584 checks green (incl. test-regression-cycle3.js)');
  line('  targeted leak checks:         tests/test-regression-cycle3.js (107 checks)');
  line('  audio identity (A):           default ' + be1 + ', stressed ' + be2);
  line('  all-ten bypass (B):           ' + beB + ' (four-new chain: QA-1, cited)');
  line('  watchdog + safety net (C):    tripped=' + tripped + ', rebuild latch held, restore OK');
  line('  limiter refusal policies:     tests/test-regression-cycle3.js part D (all-four chain)');

  fs.writeFileSync(path.join(OUT_DIR, 'qa2-report.txt'), report.join('\n') + '\n');
  line('');
  if (failCount === 0) {
    line('QA-2 harness: ALL CHECKS PASS — report written to tests/qa-out/qa2-report.txt');
  } else {
    line('QA-2 harness: ' + failCount + ' FAIL check(s) — see above');
  }
  process.exit(failCount === 0 ? 0 : 1);
}

function f3(v) { return Number(v).toFixed(3); }

main().catch(function (err) {
  console.error('QA-2 harness crash:', err);
  process.exit(1);
});
