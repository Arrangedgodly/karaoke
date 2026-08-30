// QA-1 harness — per-effect acceptance renders on TEST-1 (assets/test-vocal.mp3).
//
// Renders the LISTENING MATERIALS for the cycle-3 QA-1 gate and runs every
// objective check that does not need ears. Audio quality itself is
// USER-JUDGED (same bar as cycle-2 QA-3); this file's job is to make that
// judgment precise, not to substitute for it.
//
// What runs here (and what is deliberately NOT re-run):
//   - REAL production node code, offline under Node, two ways:
//       1. NATIVE-NODE EFFECTS (distortion, chorus): src/audio-graph.js +
//          src/node-types.js + src/audio-param-ramp.js + the four node
//          files are loaded into a vm sandbox whose AudioContext stub
//          actually RENDS (Gain/WaveShaper/Biquad/Delay/Oscillator/
//          StereoPanner with spec DSP — the stub is the Web Audio runtime,
//          exactly like the vm-stubbed AudioWorkletGlobalScope is the
//          runtime for worklets). Chains are built through the REAL
//          AudioGraph.buildGraph() (single-entry model, same as the node
//          tests), so factory param mapping, chainGate/attenuator routing,
//          and the composites' internal wiring are all production code.
//       2. WORKLET EFFECTS (gate, autotune): the real src/gate-worklet.js
//          and src/autotune-worklet.js, booted through a stubbed
//          audioWorklet.addModule + AudioWorkletNode and driven per
//          128-sample block — node-gate.js / node-autotune.js's own async
//          addModule placeholder+splice path included.
//   - Objective checks: bypass-cleanliness (bit-exact where a bit-exact
//     neutral exists; measured delta where it does not), per-param
//     reactivity (min-vs-max renders differ measurably), dropout/glitch
//     proxies (window-RMS dips, HF ratio, spectral flux — AT-0's methods),
//     clipping (peak dBFS per render, distortion guard at Output max).
//   - NOT re-run here, cited instead: agent operability
//     (tests/test-mcp-tools-cycle3.js), preset round-trip
//     (tests/test-preset-cycle3.js), palette/keyboard (test-palette-cards-
//     cycle3.js), node-level structure (test-{gate,distortion,chorus,
//     autotune}-node.js).
//
// Documented offline substitutions (same spirit as the AT-0 spike):
//   - TEST-1 decoded via ffmpeg to mono 48 kHz f32 (the browser decodes
//     with decodeAudioData; the repo has no JS MP3 decoder).
//   - AudioParam automation applies INSTANTLY (setValueAtTime/ramps write
//     .value). The 15 ms AudioParamRamp / 5 ms bypass ramps are live-use
//     click safety; renders here are static per pass.
//   - WaveShaper '4x' oversampling is approximated: linear-interpolation
//     4x upsample -> curve lookup -> [1,3,3,1]/8 binomial decimator.
//     Chrome's exact oversampling filter differs; the curve, drive/tone/
//     output mappings and the unity guard are production code verbatim.
//   - DelayNode delayTime is sampled once per 128-frame render quantum
//     (Chrome's documented behavior, relied on by D4) with fractional
//     linear-interpolated reads.
//
// Outputs (this directory): listening WAVs (00-dry .. 10-at-slow),
// qa1-report.txt (metric dump, committed evidence), LISTENING.md (the
// user's protocol). WAV/f32 are gitignored (see .gitignore here).
//
// Run from the repo root:  node tests/qa-out/run-qa1.js

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..', '..');
var OUT_DIR = __dirname;
var SR = 48000;
var BLOCK = 128;
var PAD_S = 0.4; // render tail so worklet delays flush
var GATE_D = 240;    // gate-worklet look-ahead: 5 ms
var AT_D = 960;      // autotune-worklet declared delay: 20 ms

var report = [];
function line(msg) {
  report.push(msg);
  console.log(msg);
}
function note(kind, msg) { line('  ' + kind + ' - ' + msg); }
function metric(msg) { line('METRIC: ' + msg); }
function f1(v) { return Number(v).toFixed(1); }
function f2(v) { return Number(v).toFixed(2); }
function f3(v) { return Number(v).toFixed(3); }

function percentile(arr, p) {
  var s = arr.slice().sort(function (a, b) { return a - b; });
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

// ===========================================================================
// Asset decode (ffmpeg — documented substitution for decodeAudioData)
// ===========================================================================

function decodeVocal() {
  var mp3 = path.join(ROOT, 'assets', 'test-vocal.mp3');
  if (!fs.existsSync(mp3)) throw new Error('missing ' + mp3);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Share the AT-0 spike's decoded cache when present (same asset, same
  // decode); otherwise decode into this directory.
  var spikeCache = path.join(ROOT, 'tests', 'spike', 'out', 'test-vocal-48k-mono.f32');
  var raw = path.join(OUT_DIR, 'test-vocal-48k-mono.f32');
  var target = fs.existsSync(spikeCache) ? spikeCache : raw;
  if (!fs.existsSync(target)) {
    var res = cp.spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', mp3, '-ac', '1', '-ar', String(SR),
      '-f', 'f32le', '-c:a', 'pcm_f32le', target
    ], { encoding: 'utf8' });
    if (res.status !== 0) {
      throw new Error('ffmpeg decode failed: ' + (res.stderr || '').slice(0, 400));
    }
  }
  var buf = fs.readFileSync(target);
  var pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
  var copy = new Float32Array(pcm.length);
  copy.set(pcm);
  return copy;
}

// ===========================================================================
// WAV writer (16-bit PCM, mono or stereo — the spike's writer, extended)
// ===========================================================================

function writeWav(name, channels) {
  var n = channels[0].length;
  var nch = channels.length;
  var buf = Buffer.alloc(44 + n * nch * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nch * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(nch, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * nch * 2, 28);
  buf.writeUInt16LE(nch * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * nch * 2, 40);
  for (var i = 0; i < n; i++) {
    for (var c = 0; c < nch; c++) {
      var v = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), 44 + (i * nch + c) * 2);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  line('WROTE: ' + name + ' (' + nch + 'ch, ' + f1(n / SR) + ' s)');
}

// ===========================================================================
// Offline Web Audio runtime — spec-shaped DSP for the native-node effects.
// The production node files make every AUDIO decision (topology, curves,
// mappings, guards); this runtime only executes them.
// ===========================================================================

function makeParam(initial) {
  var p = {
    value: initial,
    __isAudioParam: true,
    __feeds: [], // nodes connected INTO this param (a-rate modulation)
    cancelScheduledValues: function () {},
    setValueAtTime: function (v) { this.value = v; },
    linearRampToValueAtTime: function (v) { this.value = v; },
    setTargetAtTime: function (v) { this.value = v; },
    exponentialRampToValueAtTime: function (v) { this.value = v; }
  };
  return p;
}

var nodeIdCounter = 0;

function makeEngineNode(kind) {
  return {
    __id: ++nodeIdCounter,
    __kind: kind,
    __inputs: [], // sources feeding THIS node (pull-render storage)
    __outputs: [], // destinations this node feeds (for disconnect bookkeeping)
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
        // blanket: sever every edge this node feeds (into nodes or params)
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

/** Sum the rendered blocks of a node's inputs, up-mixed to max channels. */
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
      var src = outs[j][c2 < outs[j].length ? c2 : 0]; // mono up-mix: copy
      for (var s = 0; s < BLOCK; s++) res[c2][s] += src[s];
    }
  }
  return res;
}

/** Param feeds summed to a 1-sample-per-block scalar (per-quantum sample). */
function paramBlockValue(param, b, engine) {
  var v = param.value;
  for (var i = 0; i < param.__feeds.length; i++) {
    var o = renderNode(param.__feeds[i], b, engine);
    v += o[0][0]; // Chrome samples delayTime once per render quantum
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

function renderNode(node, b, engine) {
  if (node.__memo[b]) return node.__memo[b];
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
        // 4x oversample: linear upsample, curve, binomial decimate.
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
      var f0 = node.frequency.value;
      var Q = node.Q.value;
      var w0 = 2 * Math.PI * f0 / SR;
      var alpha = Math.sin(w0) / (2 * Q);
      var cosw = Math.cos(w0);
      var b0 = (1 - cosw) / 2, b1 = 1 - cosw, b2 = (1 - cosw) / 2;
      var a0 = 1 + alpha, a1 = -2 * cosw, a2 = 1 - alpha;
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
  } else if (kind === 'worklet') {
    var inp6 = sumInputs(node, b, engine);
    var outputs = [];
    for (var c1 = 0; c1 < inp6.length; c1++) outputs.push(new Float32Array(BLOCK));
    var params = {};
    var names = Object.keys(node.__params);
    for (var pi = 0; pi < names.length; pi++) {
      params[names[pi]] = new Float32Array([node.__params[names[pi]].value]);
    }
    node.__processor.process([inp6], [outputs], params);
    out = outputs;
  } else {
    // destination / passthrough collector
    out = sumInputs(node, b, engine);
  }
  node.__memo[b] = out;
  return out;
}

/** Boot a vm sandbox with the REAL src files and a rendering AudioContext. */
function createRenderSandbox(pcm, opts) {
  opts = opts || {};
  var processors = {}; // name -> worklet processor constructor (vm side is
  // unnecessary for the processor itself — the worklet files run in their
  // own scope below, exactly like the gate/autotune tests' Part 2).

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
    n.port = { onmessage: null, postMessage: function () {} };
    return n;
  }

  var sourceNode = makeEngineNode('buffer-source');

  var sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: function (fn) { return setTimeout(fn, 0); },
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    document: { getElementById: function () { return null; } },
    Float32Array: Float32Array,
    AudioWorkletNode: AudioWorkletNodeCtor,
    AudioEngine: {
      isStarted: true,
      audioContext: ctx,
      sourceNode: sourceNode
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  [
    'src/audio-graph.js',
    'src/node-types.js',
    'src/audio-param-ramp.js',
    'src/node-distortion.js',
    'src/node-chorus.js',
    'src/node-gate.js',
    'src/node-autotune.js'
  ].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  });
  if (opts.audioBypass) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/audio-bypass.js'), 'utf8'),
      sandbox, { filename: 'src/audio-bypass.js' });
  }

  return {
    sandbox: sandbox,
    ctx: ctx,
    sourceNode: sourceNode,
    render: function (nSamples) {
      var nBlocks = Math.ceil(nSamples / BLOCK);
      var chans = null;
      for (var b = 0; b < nBlocks; b++) {
        var o = renderNode(ctx.destination, b, this.ctx);
        if (!chans) chans = o.map(function () { return new Float32Array(nBlocks * BLOCK); });
        for (var c = 0; c < o.length; c++) {
          chans[c].set(o[c], b * BLOCK);
        }
      }
      return chans;
    }
  };
}

/**
 * Build a single-effect chain through the REAL buildGraph and render it.
 * Returns { channels, instance }. opts.audioBypass: also load
 * audio-bypass.js and call engage() before rendering (chain-level bypass
 * check).
 */
async function renderChain(pcm, model, opts) {
  opts = opts || {};
  var rs = createRenderSandbox(pcm, opts);
  var expr = 'window.AudioGraph.buildGraph(' + JSON.stringify(model) + ')';
  vm.runInContext(expr, rs.sandbox);
  await new Promise(function (r) { setTimeout(r, 150); }); // deferred rewire commit
  if (opts.audioBypass) {
    vm.runInContext('window.AudioBypass.reconnectSource(); window.AudioBypass.engage();', rs.sandbox);
  }
  var instance = model.length
    ? vm.runInContext('window.AudioGraph.getNodeInstance(' + JSON.stringify(model[0].id) + ')', rs.sandbox)
    : null;
  var channels = rs.render(pcm.length + Math.round(PAD_S * SR));
  return { channels: channels, instance: instance, rs: rs };
}

// ===========================================================================
// Independent offline YIN oracle (the spike harness's implementation,
// verbatim) — voiced spans, contour, natural-key histogram.
// ===========================================================================

var REF_W = 1200, REF_HOP = 480, REF_TAU_MIN = 48, REF_TAU_MAX = 480;

function refYin(x) {
  var frames = [];
  var raw = [];
  for (var start = 0; start + REF_W + REF_TAU_MAX <= x.length; start += REF_HOP) {
    var rms = 0;
    for (var i = 0; i < REF_W; i++) rms += x[start + i] * x[start + i];
    rms = Math.sqrt(rms / REF_W);
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
      clar = 1 - cmndArr[Math.round(tau2)];
    }
    raw.push({ t: start + REF_W / 2, f0: f0, clar: clar, rms: rms });
  }
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

function voicedSpans(frames, guardMs) {
  var g = (guardMs || 50) * SR / 1000;
  var spans = [];
  var run = null;
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].f0 > 0) {
      if (!run) run = [frames[i].t - g, frames[i].t + g + REF_HOP];
      run[1] = frames[i].t + g + REF_HOP;
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
// Objective metric helpers (AT-0's methods, adapted)
// ===========================================================================

function rmsDb(x, from, to) {
  var acc = 0, n = Math.max(1, to - from);
  for (var i = from; i < to; i++) acc += x[i] * x[i];
  return 10 * Math.log10(acc / n + 1e-30);
}

function peakDb(x) {
  var p = 0;
  for (var i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return 20 * Math.log10(p + 1e-30);
}

/** De-delay a render by its worklet's declared latency (aligned[i]=x[i+d]). */
function alignDelay(x, d) {
  var n = x.length - d;
  var o = new Float32Array(n);
  for (var i = 0; i < n; i++) o[i] = x[i + d];
  return o;
}

/** Worst out/in window-RMS ratio (dB) over spans — dropout proxy. */
function worstDipDb(out, in_, spans, winMs, hopMs, insetMs) {
  var win = Math.round((winMs || 20) / 1000 * SR);
  var hop = Math.round((hopMs || 10) / 1000 * SR);
  var inset = Math.round((insetMs || 0) / 1000 * SR);
  var worst = Infinity, below20 = 0, total = 0;
  spans.forEach(function (sp) {
    if (sp[1] > out.length) sp[1] = out.length;
    if (sp[1] > in_.length) sp[1] = in_.length;
    if (sp[0] + inset >= sp[1]) return;
    for (var st = sp[0] + inset; st + win + inset <= sp[1]; st += hop) {
      var ri = 0, ro = 0;
      for (var i = st; i < st + win; i++) {
        ri += in_[i] * in_[i];
        ro += out[i] * out[i];
      }
      if (ri > 1e-8) {
        var dip = 10 * Math.log10((ro + 1e-30) / ri);
        total++;
        if (dip < worst) worst = dip;
        if (dip < -20) below20++;
      }
    }
  });
  return { worst: worst, below20: below20, total: total };
}

function hfRatio(x, spans) {
  var num = 0, den = 0;
  spans.forEach(function (sp) {
    for (var i = sp[0] + 1; i < sp[1]; i++) {
      num += Math.abs(x[i] - x[i - 1]);
      den += Math.abs(x[i]);
    }
  });
  return num / (den + 1e-30);
}

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

/** Difference-signal RMS (dBFS) between two equal-length renders. */
function diffRmsDb(a, b) {
  var acc = 0;
  var n = Math.min(a.length, b.length);
  for (var i = 0; i < n; i++) { var d = a[i] - b[i]; acc += d * d; }
  return 10 * Math.log10(acc / n + 1e-30);
}

function bitExact(a, b, lag) {
  // a[i] must equal b[i - lag] for every sample where both exist
  var n = Math.min(a.length, b.length) - Math.abs(lag);
  if (n <= 0) return false;
  var off = lag >= 0 ? lag : 0;
  var offB = lag >= 0 ? 0 : -lag;
  for (var i = 0; i < n; i++) {
    if (a[off + i] !== b[offB + i]) return false;
  }
  return true;
}

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

// ===========================================================================
// Main
// ===========================================================================

var KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

async function main() {
  line('QA-1 harness — per-effect acceptance renders on TEST-1 (SR=' + SR + ')');
  line('');

  var pcm = decodeVocal();
  var total = pcm.length + Math.round(PAD_S * SR);
  note('ok', 'decoded TEST-1: ' + pcm.length + ' samples = ' + f1(pcm.length / SR) +
    ' s mono 48 kHz (ffmpeg pcm_f32le; decodeAudioData substitution)');

  // -- Reference contour + natural key ------------------------------------
  var frames = refYin(pcm);
  var voicedF = frames.filter(function (f) { return f.f0 > 0; }).map(function (f) { return f.f0; });
  var spans = voicedSpans(frames, 50).filter(function (s) { return s[1] - s[0] > SR / 10; });
  note('ok', 'oracle contour: ' + voicedF.length + '/' + frames.length +
    ' frames voiced; f0 p2/p50/p98 = ' + f1(percentile(voicedF, 0.02)) + '/' +
    f1(percentile(voicedF, 0.5)) + '/' + f1(percentile(voicedF, 0.98)) + ' Hz');
  metric('E.vocal.f0_p50_hz=' + f1(percentile(voicedF, 0.5)));

  var pcHist = new Array(12).fill(0);
  frames.forEach(function (f) {
    if (f.f0 > 0 && f.clar >= 0.7) {
      var midi = 69 + 12 * Math.log(f.f0 / 440) / Math.LN2;
      pcHist[((Math.round(midi) % 12) + 12) % 12] += 1;
    }
  });
  var rightKey = 0;
  for (var k = 1; k < 12; k++) if (pcHist[k] > pcHist[rightKey]) rightKey = k;
  var wrongKey = (rightKey + 6) % 12; // tritone: maximally wrong snap grid
  note('ok', 'natural-key histogram argmax: ' + KEY_NAMES[rightKey] + ' (' +
    pcHist[rightKey] + ' frames); WRONG-key demo = ' + KEY_NAMES[wrongKey] +
    ' (tritone off, ' + pcHist[wrongKey] + ' frames)');
  metric('E.vocal.natural_key=' + KEY_NAMES[rightKey]);

  // =====================================================================
  line('');
  line('A. DRY REFERENCE + CHAIN-LEVEL BYPASS (buildGraph routing)');
  // =====================================================================
  var dry = await renderChain(pcm, []);
  var dryCh = dry.channels[0]; // mono through chainGate -> attenuator
  writeWav('00-dry.wav', [dryCh.subarray(0, pcm.length)]);
  metric('A.dry.peak_dbfs=' + f1(peakDb(dryCh)));
  metric('A.dry.rms_dbfs=' + f1(rmsDb(dryCh, 0, dryCh.length)));

  var bypassRender = await renderChain(pcm, [
    { id: 'g', type: 'gate', params: {} },
    { id: 'd', type: 'distortion', params: {} },
    { id: 'c', type: 'chorus', params: {} },
    { id: 'a', type: 'autotune', params: {} }
  ], { audioBypass: true });
  // NB: bypass hands the room the RAW source (dedicated dry tap, no chain,
  // no MC-4 attenuator), while every chain render passes the attenuator —
  // so the bit-exact comparison is against the raw input, not the dry chain
  // render (which is source x 0.5012 by design).
  var pcmPadded = new Float32Array(total);
  pcmPadded.set(pcm);
  var be = bitExact(bypassRender.channels[0], pcmPadded, 0);
  note(be ? 'ok' : 'FAIL',
    'chain-level bypass (audio-bypass.js engage, 4-effect chain in place): ' +
    'render is BIT-EXACT vs the raw source (chain gate 0, dry tap 1)');
  metric('A.bypass_chain.bit_exact=' + be);

  // =====================================================================
  line('');
  line('B. GATE — renders + objective checks');
  // =====================================================================
  var gateDef = await renderChain(pcm, [{ id: 'g1', type: 'gate', params: {} }]);
  writeWav('01-gate-default.wav', [gateDef.channels[0].subarray(0, pcm.length)]);
  // Musical setting for THIS asset: the vocal's gaps are true digital
  // silence, so gating action is heard in phrase TAIL shaping, not noise
  // floor reduction — a moderate threshold + longer release demonstrates
  // musical tail handling between the factory default and the stress case.
  var gateMus = await renderChain(pcm, [{
    id: 'g1b', type: 'gate',
    params: { threshold: -45, attack: 0.005, release: 0.3, floor: -40 }
  }]);
  writeWav('01b-gate-musical.wav', [gateMus.channels[0].subarray(0, pcm.length)]);
  var gateExt = await renderChain(pcm, [{
    id: 'g2', type: 'gate',
    params: { threshold: -30, attack: 0.001, release: 0.01, floor: -60 }
  }]);
  writeWav('02-gate-extreme.wav', [gateExt.channels[0].subarray(0, pcm.length)]);
  var gateFloor0 = await renderChain(pcm, [{
    id: 'g3', type: 'gate', params: { floor: 0 }
  }]);

  var gbe = bitExact(gateFloor0.channels[0], dryCh, GATE_D);
  note(gbe ? 'ok' : 'FAIL',
    'bypass-clean: Floor=0 dB render is bit-exact vs dry delayed by the ' +
    'declared ' + (GATE_D / SR * 1000) + ' ms look-ahead');
  metric('B.gate.floor0_bit_exact_vs_dry_plus_5ms=' + gbe);

  // Silence attenuation (floor works) + voiced transparency (default).
  // Gate metrics use the look-ahead-aligned render (content index j of the
  // gate output sits at array index j + GATE_D).
  var gateAligned = alignDelay(gateDef.channels[0], GATE_D);
  var unvoiced = [];
  var prevEnd = 0;
  for (var si = 0; si < spans.length; si++) {
    if (spans[si][0] - prevEnd > SR / 20) unvoiced.push([prevEnd, spans[si][0]]);
    prevEnd = spans[si][1];
  }
  if (pcm.length - prevEnd > SR / 20) unvoiced.push([prevEnd, pcm.length]);
  // Silence honesty: this asset's gaps are TRUE digital silence, so dB
  // ratios there are meaningless. Report (a) how many gaps carry real
  // content above -70 dBFS and their attenuation, (b) that the gate adds
  // nothing in digital silence (max |out| must be exactly 0), (c) tail
  // shaping: level delta in the 400 ms after each voiced span ends.
  var dampDb = [];
  var gapTotal = 0, silentMax = 0;
  unvoiced.forEach(function (sp) {
    gapTotal++;
    var ri = rmsDb(dryCh, sp[0], sp[1]);
    if (ri > -70) {
      dampDb.push(rmsDb(gateAligned, sp[0], sp[1]) - ri);
    } else {
      for (var q = sp[0]; q < sp[1]; q++) {
        silentMax = Math.max(silentMax, Math.abs(gateAligned[q]));
      }
    }
  });
  metric('B.gate.default_gaps=' + gapTotal + ' (' + dampDb.length +
    ' with content above -70 dBFS)');
  if (dampDb.length) {
    metric('B.gate.default_contentgap_attenuation_db_median=' + f1(percentile(dampDb, 0.5)));
  }
  note(silentMax === 0 ? 'ok' : 'NOTE',
    'gate residue in digital-silence gaps: max |out| = ' +
    f1(20 * Math.log10(silentMax + 1e-30)) + ' dBFS' +
    (silentMax === 0 ? ' (exactly zero)' :
      ' — the input\'s own decay tail passing the closing gate (a gain <= 1 ' +
      'cannot add energy); inaudible'));

  function tailDeltaDb(aligned) {
    var deltas = [];
    var w = Math.round(0.4 * SR);
    spans.forEach(function (sp) {
      if (sp[1] + w > aligned.length || sp[1] + w > dryCh.length) return;
      if (rmsDb(dryCh, sp[1], sp[1] + w) < -70) return; // no tail content
      deltas.push(rmsDb(aligned, sp[1], sp[1] + w) - rmsDb(dryCh, sp[1], sp[1] + w));
    });
    return { med: deltas.length ? percentile(deltas, 0.5) : NaN, n: deltas.length };
  }
  var tdDef = tailDeltaDb(gateAligned);
  metric('B.gate.default_tail400ms_delta_db_median=' + f1(tdDef.med) +
    ' over ' + tdDef.n + '/' + spans.length +
    ' tails with content (0 dB = phrase tails pass untouched)');
  var gateExtAligned = alignDelay(gateExt.channels[0], GATE_D);
  var tdExt = tailDeltaDb(gateExtAligned);
  metric('B.gate.extreme_tail400ms_delta_db_median=' + f1(tdExt.med) +
    ' over ' + tdExt.n + '/' + spans.length + ' tails with content');

  var gd = worstDipDb(gateAligned, dryCh, spans, 20, 10, 100);
  metric('B.gate.default_voiced_worst_dip_db=' + f1(gd.worst) +
    ' (inset 100ms; span edges are legitimate release behavior)');
  metric('B.gate.default_voiced_windows_below_-20db=' + gd.below20 + '/' + gd.total);

  // Attack-consonant preservation: onset energy in the first 10 ms.
  var onsetRatios = [];
  spans.forEach(function (sp) {
    if (sp[0] < SR || sp[1] - sp[0] < SR / 10) return;
    var r10 = rmsDb(gateAligned, sp[0], sp[0] + Math.round(0.010 * SR)) -
      rmsDb(dryCh, sp[0], sp[0] + Math.round(0.010 * SR));
    onsetRatios.push(r10);
  });
  metric('B.gate.default_onset10ms_delta_db_median=' +
    f1(onsetRatios.length ? percentile(onsetRatios, 0.5) : 0) +
    ' (0 dB = attack consonant fully preserved)');
  metric('B.gate.default_peak_dbfs=' + f1(peakDb(gateDef.channels[0])));

  // =====================================================================
  line('');
  line('C. DISTORTION — renders + objective checks');
  // =====================================================================
  var distDef = await renderChain(pcm, [{ id: 'd1', type: 'distortion', params: {} }]);
  writeWav('03-dist-default.wav', [distDef.channels[0].subarray(0, pcm.length)]);
  var distExt = await renderChain(pcm, [{
    id: 'd2', type: 'distortion', params: { drive: 1, tone: 1, output: 0 }
  }]);
  writeWav('04-dist-extreme.wav', [distExt.channels[0].subarray(0, pcm.length)]);
  var distNeutral = await renderChain(pcm, [{
    id: 'd3', type: 'distortion', params: { drive: 0, output: 0 }
  }]);

  // No bit-exact neutral exists by design (the tanh curve is always on) —
  // measure the Drive=0 delta honestly instead.
  var ndelta = diffRmsDb(distNeutral.channels[0], dryCh);
  note('NOTE',
    'bypass-clean: distortion has NO bit-exact neutral (fixed tanh curve is ' +
    'always in circuit by design — D3). Drive=0/Tone=0.7/Output=0 measures ' +
    f1(ndelta) + ' dBFS difference vs dry; the operator-clean path is ' +
    'chain-level Bypass (bit-exact, section A)');
  metric('C.dist.drive0_delta_vs_dry_db=' + f1(ndelta));

  // Unity output guard at Output=max. TWO layers, honestly separated:
  //   1. The GUARD itself: outGain.gain is capped at exactly unity (the
  //      shaper's normalized tanh curve bounds its own output to +/-1, so
  //      unity outGain = the stage never boosts past unity).
  //   2. Post-tone-filter TRANSIENT OVERSHOOT: a Q=1 lowpass rings ~16%
  //      above its input on near-square edges (2nd-order step response,
  //      spec biquad math — Chrome does the same). That is filter physics,
  //      not a gain defect; the acceptance bar is "must not slam the
  //      chain", measured at the destination.
  var guardGain = distExt.instance ? distExt.instance.outGain.gain.value : NaN;
  note(guardGain === 1.0 ? 'ok' : 'FAIL',
    'output guard at Output=0 dB (max): outGain.gain capped at exactly ' +
    guardGain + ' (never above unity on any write path)');
  metric('C.dist.extreme_outgain_value=' + guardGain);

  var extNodeOut = distExt.instance ? distExt.instance.output : null;
  var extPeakNode = -Infinity;
  if (extNodeOut) {
    for (var b = 0; b < extNodeOut.__memo.length; b++) {
      var blk = extNodeOut.__memo[b];
      if (!blk) continue;
      for (var c = 0; c < blk.length; c++) {
        for (var s = 0; s < blk[c].length; s++) {
          extPeakNode = Math.max(extPeakNode, Math.abs(blk[c][s]));
        }
      }
    }
  }
  note('NOTE',
    'measured post-tone-filter transient overshoot at Drive=1/Tone=1: node ' +
    'stage peaks ' + f1(20 * Math.log10(extPeakNode + 1e-30)) + ' dBFS — ' +
    'Q=1 lowpass step ringing on near-square shaper output (~16% class), ' +
    'spec biquad behavior, not a gain-cap failure');
  metric('C.dist.extreme_nodeoutput_peak_dbfs=' + f1(20 * Math.log10(extPeakNode + 1e-30)));
  metric('C.dist.default_peak_dbfs=' + f1(peakDb(distDef.channels[0])));
  metric('C.dist.extreme_peak_dbfs=' + f1(peakDb(distExt.channels[0])) +
    ' (destination level — the not-slam-the-chain bar)');
  var dd = worstDipDb(distDef.channels[0], dryCh, spans, 20, 10, 0);
  metric('C.dist.default_voiced_worst_dip_db=' + f1(dd.worst));
  metric('C.dist.default_voiced_windows_below_-20db=' + dd.below20 + '/' + dd.total);
  metric('C.dist.default_flux_ratio=' +
    f3(fluxP99(distDef.channels[0], spans) / fluxP99(dryCh, spans)) +
    ' (spectral change is the effect working, not a glitch proxy failure)');

  // =====================================================================
  line('');
  line('D. CHORUS — renders + objective checks');
  // =====================================================================
  var chorDef = await renderChain(pcm, [{ id: 'c1', type: 'chorus', params: {} }]);
  writeWav('05-chorus-default.wav', [
    chorDef.channels[0].subarray(0, pcm.length),
    chorDef.channels.length > 1 ? chorDef.channels[1].subarray(0, pcm.length)
      : chorDef.channels[0].subarray(0, pcm.length)
  ]);
  var chorExt = await renderChain(pcm, [{
    id: 'c2', type: 'chorus', params: { depthMs: 10, rateHz: 8, mix: 100 }
  }]);
  writeWav('06-chorus-extreme.wav', [
    chorExt.channels[0].subarray(0, pcm.length),
    chorExt.channels.length > 1 ? chorExt.channels[1].subarray(0, pcm.length)
      : chorExt.channels[0].subarray(0, pcm.length)
  ]);
  var chorMix0 = await renderChain(pcm, [{ id: 'c3', type: 'chorus', params: { mix: 0 } }]);

  note(chorDef.channels.length === 2 ? 'ok' : 'FAIL',
    'chorus renders STEREO (2 channels out of a mono vocal — D4 width)');
  var cbe = bitExact(chorMix0.channels[0], dryCh, 0);
  note(cbe ? 'ok' : 'FAIL',
    'bypass-clean: Mix=0 render (channel L) is bit-exact vs dry (dryGain=1, ' +
    'wetGain=0 — equal-power law has an exact neutral at Mix 0)');
  metric('D.chorus.mix0_bit_exact=' + cbe);

  // Mono-sum safety (D4's phase-opposition property): (L+R)/2 vs dry.
  function monoSum(chs) {
    var m = new Float32Array(chs[0].length);
    for (var i = 0; i < m.length; i++) m[i] = (chs[0][i] + chs[1][i]) / 2;
    return m;
  }
  var msDef = monoSum(chorDef.channels);
  var msExt = monoSum(chorExt.channels);
  var md = worstDipDb(msDef, dryCh, spans, 50, 25, 60);
  metric('D.chorus.default_monosum_worst_dip_db=' + f1(md.worst) +
    ' (50ms windows, inset 60ms; near-constant total energy = phase-opposed)');
  var me = worstDipDb(msExt, dryCh, spans, 50, 25, 60);
  metric('D.chorus.extreme_monosum_worst_dip_db=' + f1(me.worst));
  // Stereo width: side RMS vs mid RMS.
  function sideMidDb(chs) {
    var sm = 0, mm = 0;
    for (var i = 0; i < chs[0].length; i++) {
      var side = (chs[0][i] - chs[1][i]) / 2;
      var mid = (chs[0][i] + chs[1][i]) / 2;
      sm += side * side; mm += mid * mid;
    }
    return 10 * Math.log10(sm / (mm + 1e-30));
  }
  metric('D.chorus.default_side_over_mid_db=' + f1(sideMidDb(chorDef.channels)));
  metric('D.chorus.extreme_side_over_mid_db=' + f1(sideMidDb(chorExt.channels)));
  metric('D.chorus.default_peak_dbfs=' + f1(peakDb(chorDef.channels[0])));

  // =====================================================================
  line('');
  line('E. AUTOTUNE — renders + objective checks');
  // =====================================================================
  var atDef = await renderChain(pcm, [{ id: 'a1', type: 'autotune', params: {} }]);
  writeWav('07-at-default.wav', [atDef.channels[0].subarray(0, pcm.length)]);
  var atRight = await renderChain(pcm, [{
    id: 'a2', type: 'autotune',
    params: { key: KEY_NAMES[rightKey], scale: 'Major', retune: 0, mix: 100 }
  }]);
  writeWav('08-at-rightkey-major.wav', [atRight.channels[0].subarray(0, pcm.length)]);
  var atWrong = await renderChain(pcm, [{
    id: 'a3', type: 'autotune',
    params: { key: KEY_NAMES[wrongKey], scale: 'Major', retune: 0, mix: 100 }
  }]);
  writeWav('09-at-wrongkey-major.wav', [atWrong.channels[0].subarray(0, pcm.length)]);
  var atSlow = await renderChain(pcm, [{
    id: 'a4', type: 'autotune',
    params: { key: KEY_NAMES[rightKey], scale: 'Major', retune: 250, mix: 100 }
  }]);
  writeWav('10-at-slow-250ms.wav', [atSlow.channels[0].subarray(0, pcm.length)]);
  var atMix0 = await renderChain(pcm, [{
    id: 'a5', type: 'autotune', params: { mix: 0 }
  }]);

  var abe = bitExact(atMix0.channels[0], dryCh, AT_D);
  note(abe ? 'ok' : 'FAIL',
    'bypass-clean: Mix=0 render is bit-exact vs dry delayed by the declared ' +
    (AT_D / SR * 1000) + ' ms');
  metric('E.at.mix0_bit_exact_vs_dry_plus_20ms=' + abe);

  // Snap evidence, two ways: residual percentiles (as AT-0) AND the output
  // pitch-class histogram — for the wrong-key render, the OUTPUT histogram
  // should collapse onto the WRONG key's scale degrees, which is direct
  // evidence the snap happened (residual percentiles alone are dominated
  // by transition frames when every note shifts ~100c).
  function snapResidual(render, key, scale) {
    var N = Math.min(pcm.length, render.channels[0].length - AT_D);
    var outA = new Float32Array(N);
    outA.set(render.channels[0].subarray(AT_D, AT_D + N));
    var refOut = refYin(outA);
    var D_FRAMES = Math.round(AT_D / REF_HOP);
    var resid = [];
    var hist = new Array(12).fill(0);
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].f0 <= 0) continue;
      var of = refOut[i + D_FRAMES];
      if (!of || of.f0 <= 0) continue;
      var midi = 69 + 12 * Math.log(of.f0 / 440) / Math.LN2;
      hist[((Math.round(midi) % 12) + 12) % 12] += 1;
      resid.push(Math.abs((nearestAllowedMidi(midi, key, scale) - midi) * 100));
    }
    return {
      med: percentile(resid, 0.5),
      p95: percentile(resid, 0.95),
      within10: resid.filter(function (c) { return c < 10; }).length / resid.length,
      hist: hist
    };
  }
  function histOnScale(hist, key, scale) {
    var set = scale === 1 ? MAJOR : scale === 2 ? MINOR
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    var on = 0, tot = 0;
    for (var pc = 0; pc < 12; pc++) {
      tot += hist[pc];
      if (set.indexOf((((pc - key) % 12) + 12) % 12) !== -1) on += hist[pc];
    }
    return tot ? on / tot : 0;
  }
  var rsRight = snapResidual(atRight, rightKey, 1);
  var rsWrong = snapResidual(atWrong, wrongKey, 1);
  var wrongOnWrong = histOnScale(rsWrong.hist, wrongKey, 1);
  var wrongOnRight = histOnScale(rsWrong.hist, rightKey, 1);
  note(wrongOnWrong > 0.85 ? 'ok' : 'WARN',
    'wrong-key render snapped to the WRONG grid: ' +
    (100 * wrongOnWrong).toFixed(1) + '% of output-voiced frames sit on ' +
    KEY_NAMES[wrongKey] + '-major degrees (input: ' +
    (100 * wrongOnRight).toFixed(1) + '% already on them by chance)');
  metric('E.at.rightkey_snap_median_c=' + f1(rsRight.med));
  metric('E.at.rightkey_within10c_pct=' + (100 * rsRight.within10).toFixed(1));
  metric('E.at.rightkey_hist_on_scale_pct=' + (100 * histOnScale(rsRight.hist, rightKey, 1)).toFixed(1));
  metric('E.at.wrongkey_snap_median_c=' + f1(rsWrong.med));
  metric('E.at.wrongkey_within10c_pct=' + (100 * rsWrong.within10).toFixed(1));
  metric('E.at.wrongkey_hist_on_wrong_scale_pct=' + (100 * wrongOnWrong).toFixed(1));

  // Dropout / glitch proxies on the hard-tune render (AT-0's measures).
  var N2 = Math.min(pcm.length, atRight.channels[0].length - AT_D);
  var atAligned = new Float32Array(N2);
  atAligned.set(atRight.channels[0].subarray(AT_D, AT_D + N2));
  var ad = worstDipDb(atAligned, dryCh, spans, 20, 10, 0);
  metric('E.at.rightkey_voiced_worst_dip_db=' + f1(ad.worst));
  metric('E.at.rightkey_voiced_windows_below_-20db=' + ad.below20 + '/' + ad.total);
  metric('E.at.rightkey_hf_ratio_out_over_in=' +
    f3(hfRatio(atAligned, spans) / hfRatio(dryCh, spans)));
  metric('E.at.rightkey_flux_out_over_in=' +
    f3(fluxP99(atAligned, spans) / fluxP99(dryCh, spans)));
  metric('E.at.default_peak_dbfs=' + f1(peakDb(atDef.channels[0])));
  metric('E.at.wrongkey_peak_dbfs=' + f1(peakDb(atWrong.channels[0])));
  metric('E.at.diff_default_vs_wrong_db=' + f1(diffRmsDb(atDef.channels[0], atWrong.channels[0])));
  metric('E.at.diff_right_vs_slow_db=' + f1(diffRmsDb(atRight.channels[0], atSlow.channels[0])));

  // =====================================================================
  line('');
  line('F. PARAM REACTIVITY (8 s interior slice; one param min-vs-max per row)');
  // =====================================================================
  var off = 4 * SR;
  var slice = pcm.subarray(off, off + 8 * SR);
  var sliceCopy = new Float32Array(slice.length);
  sliceCopy.set(slice);

  async function renderSlice(type, params) {
    var r = await renderChain(sliceCopy, [{ id: 'rx', type: type, params: params }]);
    return r.channels[0];
  }

  var reactCases = [
    ['gate', 'threshold', { threshold: -80 }, { threshold: 0 }],
    ['gate', 'attack', { attack: 0.001 }, { attack: 0.5 }],
    ['gate', 'release', { release: 0.01 }, { release: 2 }],
    ['gate', 'floor', { floor: -60 }, { floor: 0 }],
    ['distortion', 'drive', { drive: 0 }, { drive: 1 }],
    ['distortion', 'tone', { tone: 0 }, { tone: 1 }],
    ['distortion', 'output', { output: -24 }, { output: 0 }],
    ['chorus', 'depthMs', { depthMs: 0 }, { depthMs: 10 }],
    ['chorus', 'rateHz', { rateHz: 0.1 }, { rateHz: 8 }],
    ['chorus', 'mix', { mix: 0 }, { mix: 100 }],
    ['autotune', 'key', { key: 'C', scale: 'Major' }, { key: 'F#', scale: 'Major' }],
    ['autotune', 'scale', { key: KEY_NAMES[rightKey], scale: 'Chromatic' },
      { key: KEY_NAMES[rightKey], scale: 'Minor' }],
    ['autotune', 'retune', { retune: 0 }, { retune: 500 }],
    ['autotune', 'mix', { mix: 0 }, { mix: 100 }]
  ];
  /** Worst per-window (20 ms) RMS delta in dB between two renders — the
   * honest reactivity measure for params that act LOCALLY (gate attack on
   * onsets, release on tails): total-diff RMS under-rates them. */
  function worstWindowDeltaDb(a, b) {
    var win = Math.round(0.02 * SR);
    var worst = 0;
    for (var st = 0; st + win <= Math.min(a.length, b.length); st += win) {
      var ra = rmsDb(a, st, st + win);
      var rb = rmsDb(b, st, st + win);
      if (ra < -75 && rb < -75) continue; // both digital silence
      var d = Math.abs(ra - rb);
      if (d > worst) worst = d;
    }
    return worst;
  }

  for (var ri = 0; ri < reactCases.length; ri++) {
    var rc = reactCases[ri];
    var lo = await renderSlice(rc[0], rc[2]);
    var hi = await renderSlice(rc[0], rc[3]);
    var dr = diffRmsDb(hi, lo);
    var sigRms = rmsDb(lo, 0, lo.length);
    var rel = dr - sigRms; // dB below the signal's own level
    var worstWin = worstWindowDeltaDb(hi, lo);
    // Reactive = EITHER a substantial total difference (within 25 dB of the
    // signal) OR a clear local change (>= 3 dB in some 20 ms window).
    var reactive = rel > -25 || worstWin >= 3;
    note(reactive ? 'ok' : 'FAIL',
      rc[0] + '.' + rc[1] + ': diff ' + f1(dr) + ' dBFS (' + f1(rel) +
      ' dB rel. to signal), worst 20ms-window delta ' + f1(worstWin) + ' dB');
    metric('F.react.' + rc[0] + '.' + rc[1] + '.diff_db=' + f1(dr));
    metric('F.react.' + rc[0] + '.' + rc[1] + '.worst_window_db=' + f1(worstWin));
  }

  // Live applyParam path sanity (one param per effect, real NodeTypes call):
  var liveChecks = [
    ['distortion', 'drive', 1, function (inst) { return inst.driveGain.gain.value; }, 10],
    ['chorus', 'rateHz', 4.5, function (inst) { return inst.lfo.frequency.value; }, 4.5],
    ['gate', 'threshold', -33, function (inst) { return inst.worklet.parameters.get('threshold').value; }, -33],
    ['autotune', 'key', 'F#', function (inst) { return inst.worklet.parameters.get('key').value; }, 6]
  ];
  for (var li = 0; li < liveChecks.length; li++) {
    var lc = liveChecks[li];
    var r = await renderChain(sliceCopy, [{ id: 'lx', type: lc[0], params: {} }]);
    vm.runInContext('window.NodeTypes.applyParam(' + JSON.stringify(lc[0]) +
      ', window.AudioGraph.getNodeInstance("lx"), ' + JSON.stringify(lc[1]) + ', ' +
      JSON.stringify(lc[2]) + ')', r.rs.sandbox);
    var got = lc[3](r.instance);
    note(got === lc[4] ? 'ok' : 'FAIL',
      'live applyParam ' + lc[0] + '.' + lc[1] + ' -> physical value ' + got +
      ' (expect ' + lc[4] + ')');
  }

  // =====================================================================
  line('');
  line('G. CLIPPING SWEEP (every listening render, destination peak)');
  // =====================================================================
  var allRenders = {
    '00-dry': dryCh, '01-gate-default': gateDef.channels[0],
    '01b-gate-musical': gateMus.channels[0],
    '02-gate-extreme': gateExt.channels[0], '03-dist-default': distDef.channels[0],
    '04-dist-extreme': distExt.channels[0], '05-chorus-default': chorDef.channels[0],
    '06-chorus-extreme': chorExt.channels[0], '07-at-default': atDef.channels[0],
    '08-at-rightkey-major': atRight.channels[0], '09-at-wrongkey-major': atWrong.channels[0],
    '10-at-slow-250ms': atSlow.channels[0]
  };
  var clipFail = 0;
  Object.keys(allRenders).forEach(function (name) {
    var p = peakDb(allRenders[name]);
    if (p > 0.0) clipFail++;
    metric('G.clip.' + name + '.peak_dbfs=' + f1(p));
  });
  note(clipFail === 0 ? 'ok' : 'FAIL',
    'no render peaks above 0 dBFS (' + Object.keys(allRenders).length + ' files; ' +
    'post -6 dB host attenuator, distortion guard measured pre-attenuator in C)');

  fs.writeFileSync(path.join(OUT_DIR, 'qa1-report.txt'), report.join('\n') + '\n');
  console.log('');
  console.log('Report written to tests/qa-out/qa1-report.txt');
}

main().catch(function (err) {
  console.error('CRASH:', err && err.stack || err);
  process.exit(1);
});
