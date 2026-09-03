// Regression test for AT-1 — the cycle-3 autotune
// (src/node-autotune.js + src/autotune-worklet.js), built on the AT-0
// spike's HARD-TUNE PASS verdict (docs/ultron/research/at0-spike-result.md)
// per the D2 decision (docs/ultron/research/rq2-autotune-feasibility.md).
//
// Follows the committed zero-dependency Node harness convention (see
// tests/test-gate-node.js and tests/test-chorus-node.js): browser globals
// stubbed, the REAL src files loaded into vm sandboxes, per-check ok/FAIL
// prints, exit 0 on pass / 1 on any failure. Two sandboxes:
//
//   1. NODE SANDBOX — effect-catalog.js / audio-graph.js / audio-param-ramp.js
//      / node-autotune.js / preset-schema.js with an AudioWorkletNode stub:
//      registration, discrete paramSpec (UI-1's values selects), the
//      string→enum mapping at every boundary (factory + applyParam), the
//      async addModule load story (placeholder passthrough -> worklet
//      splice; deferred / failing / context-property constructor
//      variants), and the PresetSchema round-trip incl. key/scale strings.
//
//   2. PROCESSOR SCOPE — the REAL src/autotune-worklet.js runs in a
//      stubbed AudioWorkletGlobalScope (test-gate-node.js Part 2 /
//      tests/spike/run-at0-spike.js precedent) and process() is driven by
//      hand with 128-sample blocks. Measured with an INDEPENDENT offline
//      YIN oracle (naive direct-loop difference function — the spike
//      harness's, verbatim), so the node is judged by its OUTPUT, not its
//      internals (the production worklet carries no telemetry by design):
//        - detection→snap→shift exactness on synthetic tones (cents vs
//          scale targets, chromatic + forbidden-note masking, low range)
//        - the four AT-0 §4 lessons regress-tested: L1 shrinking-window
//          YIN + swap trick (wrong formulation = wrong snap targets),
//          L2 fixed declared delay (impulse bit-exact +D, early AND late
//          in the stream — no stall, no race, no drift), L3 no grain
//          writes into emitted history (17+ ring wraps under sustained
//          shift stay clean), L4 onset-bias-aware snap state machine
//          (±0.52 st hysteresis: biased onsets lock the right note,
//          vibrato never retargets, real note changes do)
//        - param changes mid-stream: key, scale, retune speed, mix
//        - mix = 0 bit-exact dry (per channel — the bypass-clean aid)
//        - CPU per block re-measured vs the spike's numbers
//
//   3. OPTIONAL (only where tests/spike/out/test-vocal-48k-mono.f32 — the
//      gitignored ffmpeg cache of TEST-1 — already exists; skips cleanly
//      on a clean clone): a real-test-vocal slice through the PRODUCTION
//      engine, snap-residual/dropout/HF metrics against AT-0's measured
//      numbers with honest margins.
//
// Audio-quality judgments (audible / artifact-free on
// assets/test-vocal.mp3) are USER-judged in QA-1, per the plan — the
// objective proxies here are the automatable subset of that bar.
//
// Run from a clean clone:  node tests/test-autotune-node.js

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

var failures = [];

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

function approx(a, b, tol) {
  return Math.abs(a - b) <= (tol || 1e-9);
}

var SR = 48000;      // matches the stub contexts / processor scope
var BLOCK = 128;     // render quantum
var QUANTUM_MS = (BLOCK / SR) * 1000; // 2.667 ms
var D_N = Math.round(0.020 * SR);     // the worklet's declared delay: 20 ms

// The discrete vocabularies (must match src/node-autotune.js / UI-1).
var KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var SCALE_NAMES = ['Chromatic', 'Major', 'Minor'];

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// ======================================================================
// Part 1 — node sandbox (registration, mapping, async load, presets).
// ======================================================================

function makeParam(initial) {
  return {
    value: initial,
    cancelScheduledValues: function () {},
    setValueAtTime: function (v) {
      this.value = v;
    },
    linearRampToValueAtTime: function (v) {
      this.value = v;
    }
  };
}

function makeBaseNode(typeName) {
  return {
    __nodeTypeName: typeName,
    __connectionsTo: [],
    connect: function (dest) {
      this.__connectionsTo.push(dest);
    },
    disconnect: function (dest) {
      if (dest === undefined) {
        this.__connectionsTo = [];
        return;
      }
      var i = this.__connectionsTo.indexOf(dest);
      if (i === -1) {
        var err = new Error('the destination is not connected');
        err.name = 'InvalidAccessError';
        throw err;
      }
      this.__connectionsTo.splice(i, 1);
    },
    __connectsTo: function (dest) {
      return this.__connectionsTo.indexOf(dest) !== -1;
    }
  };
}

/**
 * A node-level sandbox. opts.module: 'ok' (resolves immediately),
 * 'deferred' (the test resolves it by hand), 'fail' (rejects).
 * opts.ctorSite: 'global' (sandbox.AudioWorkletNode) or 'ctx'.
 */
function createNodeSandbox(opts) {
  var addModuleUrls = [];
  var createdWorklets = [];
  var consoleErrors = [];
  var deferredResolve = null;

  function WorkletNodeStub(ctx, name, nodeOpts) {
    var n = makeBaseNode('AudioWorkletNode');
    n.__processorName = name;
    n.__nodeOpts = nodeOpts;
    n.__paramsById = {
      key: makeParam(0),
      scale: makeParam(0),
      retune: makeParam(0),
      mix: makeParam(1)
    };
    n.parameters = {
      get: function (id) {
        return n.__paramsById[id];
      }
    };
    n.port = { onmessage: null, postMessage: function () {} };
    createdWorklets.push(n);
    return n;
  }

  var ctx = {
    currentTime: 0,
    sampleRate: SR,
    destination: makeBaseNode('AudioDestinationNode'),
    createGain: function () {
      var n = makeBaseNode('GainNode');
      n.gain = makeParam(1);
      return n;
    },
    audioWorklet: {
      addModule: function (url) {
        addModuleUrls.push(url);
        if (opts.module === 'fail') {
          return Promise.reject(new Error('stub addModule failure'));
        }
        if (opts.module === 'deferred') {
          return new Promise(function (res) {
            deferredResolve = res;
          });
        }
        return Promise.resolve();
      }
    }
  };
  if (opts.ctorSite === 'ctx') {
    ctx.AudioWorkletNode = WorkletNodeStub;
  }

  var sandbox = {
    console: {
      log: function () {},
      warn: function () {},
      error: function (msg) {
        consoleErrors.push(String(msg));
      }
    },
    setTimeout: function (fn) {
      return setTimeout(fn, 0);
    },
    clearTimeout: clearTimeout,
    document: { getElementById: function () { return null; } }
  };
  sandbox.window = sandbox;
  sandbox.Float32Array = Float32Array;
  if (opts.ctorSite !== 'ctx') {
    sandbox.AudioWorkletNode = WorkletNodeStub;
  }
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: ctx,
    sourceNode: makeBaseNode('MediaStreamAudioSourceNode')
  };
  sandbox.__addModuleUrls = addModuleUrls;
  sandbox.__createdWorklets = createdWorklets;
  sandbox.__consoleErrors = consoleErrors;
  sandbox.__resolveModule = function () {
    if (deferredResolve) {
      deferredResolve();
    }
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadNodeSources(sandbox) {
  loadSrc(sandbox, 'src/effect-catalog.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js');
  loadSrc(sandbox, 'src/node-autotune.js');
}

function settle() {
  return new Promise(function (r) {
    setTimeout(r, 60);
  });
}

async function nodeLevelTests() {
  // ------------------------------------------------------------------
  console.log('A. REGISTRATION + PARAM SPEC (discrete key/scale, UI-1)');
  // ------------------------------------------------------------------
  var ok = createNodeSandbox({ module: 'ok', ctorSite: 'global' });
  loadNodeSources(ok);
  loadSrc(ok, 'src/preset-schema.js');

  check(ok.EffectCatalog.getAllTypes().indexOf('autotune') !== -1,
    'autotune registered in EffectCatalog (palette chip source)');
  check(ok.EffectCatalog.getLabel('autotune') === 'Autotune', 'label is "Autotune"');

  var spec = ok.EffectCatalog.getParamSpec('autotune');
  check(spec.length === 4, 'paramSpec has exactly 4 params (fixed by scope)');
  var byId = {};
  spec.forEach(function (s) { byId[s.id] = s; });
  check(!!byId.key && !!byId.scale && !!byId.retune && !!byId.mix,
    'param ids are key/scale/retune/mix');
  check(byId.key.label === 'Key' && byId.scale.label === 'Scale' &&
    byId.retune.label === 'Retune Speed' && byId.mix.label === 'Mix',
    'plain-language labels Key/Scale/Retune Speed/Mix');
  check(Array.isArray(byId.key.values) && byId.key.values.length === 12 &&
    byId.key.values[0] === 'C' && byId.key.values[11] === 'B',
    'Key is the UI-1 discrete select: 12 values C..B');
  check(Array.isArray(byId.scale.values) && byId.scale.values.length === 3 &&
    byId.scale.values[0] === 'Chromatic' && byId.scale.values[1] === 'Major' &&
    byId.scale.values[2] === 'Minor',
    'Scale is the UI-1 discrete select: Chromatic/Major/Minor');
  check(byId.key.default === 'C' && byId.scale.default === 'Chromatic',
    'defaults: Key C, Scale Chromatic (hard-tune chromatic in C)');
  check(byId.retune.min === 0 && byId.retune.max === 500 &&
    byId.retune.default === 0 && byId.retune.unit === 'ms',
    'retune 0..500 ms, default 0 = HARD-TUNE (the AT-0 Outcome-PASS default)');
  check(byId.mix.min === 0 && byId.mix.max === 100 &&
    byId.mix.default === 100 && byId.mix.unit === '%',
    'mix 0..100 %, default 100 (house Mix convention)');

  // ------------------------------------------------------------------
  console.log('B. FACTORY + WORKLET WIRING (module already loadable)');
  // ------------------------------------------------------------------
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "a1", type: "autotune", params: {}}]);',
    ok
  );
  await settle();
  var a1 = vm.runInContext('window.AudioGraph.getNodeInstance("a1")', ok);

  check(!!a1 && !!a1.input && !!a1.output && !!a1.worklet,
    'factory returns composite {input, output, worklet}');
  check(a1.input.__nodeTypeName === 'GainNode' &&
    a1.output.__nodeTypeName === 'GainNode' &&
    a1.input.gain.value === 1 && a1.output.gain.value === 1,
    'input/output are UNITY GainNodes (stable connect points)');
  check(a1.worklet.__processorName === 'autotune',
    'worklet node constructed for the "autotune" processor');
  check(a1.worklet.__nodeOpts && a1.worklet.__nodeOpts.numberOfInputs === 1 &&
    a1.worklet.__nodeOpts.numberOfOutputs === 1,
    'worklet constructed 1-in / 1-out (bus channel count passes through)');
  check(ok.__addModuleUrls.length === 1 &&
    ok.__addModuleUrls[0] === 'src/autotune-worklet.js',
    'addModule fetched the worklet by page-relative URL, exactly once');
  check(a1.input.__connectsTo(a1.worklet) && a1.worklet.__connectsTo(a1.output),
    'topology: inputGain -> worklet -> outputSum');
  check(!a1.input.__connectsTo(a1.output),
    'placeholder edge inputGain -> outputSum is GONE after the splice');
  check(a1.worklet.__paramsById.key.value === 0 &&
    a1.worklet.__paramsById.scale.value === 0 &&
    a1.worklet.__paramsById.retune.value === 0 &&
    approx(a1.worklet.__paramsById.mix.value, 1),
    'creation defaults on the real AudioParams: key 0 / scale 0 / retune 0 / mix 1');

  // Second node: cached module load, no second addModule.
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "a2", type: "autotune", params: {}}]);',
    ok
  );
  await settle();
  var a2 = vm.runInContext('window.AudioGraph.getNodeInstance("a2")', ok);
  check(!!a2 && !!a2.worklet && ok.__createdWorklets.length === 2 &&
    ok.__addModuleUrls.length === 1,
    'second autotune gets a worklet; addModule still called once (per-context cache)');
  check(a2.input.__connectsTo(a2.worklet) && a2.worklet.__connectsTo(a2.output) &&
    !a2.input.__connectsTo(a2.output),
    'warm second autotune replaces its known passthrough edge with the worklet topology');

  // A RECREATED AudioContext must re-addModule (registerProcessor state is
  // per-context).
  var ctx2 = {
    currentTime: 0,
    sampleRate: SR,
    destination: makeBaseNode('AudioDestinationNode'),
    createGain: function () {
      var n = makeBaseNode('GainNode');
      n.gain = makeParam(1);
      return n;
    },
    audioWorklet: {
      addModule: function (url) {
        ok.__addModuleUrls.push(url);
        return Promise.resolve();
      }
    }
  };
  ok.AudioEngine.audioContext = ctx2;
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "a4", type: "autotune", params: {}}]);',
    ok
  );
  await settle();
  var a4 = vm.runInContext('window.AudioGraph.getNodeInstance("a4")', ok);
  check(!!a4 && !!a4.worklet && ok.__addModuleUrls.length === 2,
    'a recreated AudioContext re-adds the module (no stale sync path)');

  // ------------------------------------------------------------------
  console.log('C. STRING→ENUM MAPPING (applyParam + construction params)');
  // ------------------------------------------------------------------
  function apply(node, paramId, value) {
    ok.EffectCatalog.applyParam('autotune', node, paramId, value);
  }

  apply(a1, 'key', 'F#');
  check(a1.worklet.__paramsById.key.value === 6,
    "applyParam key 'F#' -> the REAL key AudioParam as enum 6");
  apply(a1, 'scale', 'Minor');
  check(a1.worklet.__paramsById.scale.value === 2,
    "applyParam scale 'Minor' -> enum 2");
  apply(a1, 'retune', 250);
  check(a1.worklet.__paramsById.retune.value === 250,
    'applyParam retune 250 (ms) -> the retune AudioParam verbatim');
  apply(a1, 'mix', 65);
  check(approx(a1.worklet.__paramsById.mix.value, 0.65),
    'applyParam mix 65 (%) -> the mix AudioParam as 0.65 linear');
  apply(a1, 'key', 'A');
  check(a1.worklet.__paramsById.key.value === 9,
    "applyParam key 'A' -> enum 9 (12-key coverage)");
  apply(a1, 'scale', 'Major');
  check(a1.worklet.__paramsById.scale.value === 1,
    "applyParam scale 'Major' -> enum 1");
  var invalidRetuneError = null;
  try {
    apply(a1, 'retune', 9999);
  } catch (err) {
    invalidRetuneError = err;
  }
  check(invalidRetuneError && /range 0\.\.500/.test(invalidRetuneError.message) &&
    a1.worklet.__paramsById.retune.value === 250,
    'catalog rejects out-of-range retune without touching the live value');
  var invalidMixError = null;
  try {
    apply(a1, 'mix', -20);
  } catch (err) {
    invalidMixError = err;
  }
  check(invalidMixError && /range 0\.\.100/.test(invalidMixError.message) &&
    approx(a1.worklet.__paramsById.mix.value, 0.65),
    'catalog rejects out-of-range mix without touching the live value');

  var unknownParamError = null;
  try {
    apply(a1, 'threshold', -30);
  } catch (err) {
    unknownParamError = err;
  }
  check(unknownParamError && /unknown param/.test(unknownParamError.message) &&
    a1.worklet.__paramsById.key.value === 9,
    'catalog rejects an unknown paramId without touching the live node');

  // Construction-time STRING params (the preset/agent path) map too.
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "a3", type: "autotune", ' +
    "params: {key: 'E', scale: 'Major', retune: 120, mix: 50}}]);",
    ok
  );
  await settle();
  var a3 = vm.runInContext('window.AudioGraph.getNodeInstance("a3")', ok);
  check(a3.worklet.__paramsById.key.value === 4 &&
    a3.worklet.__paramsById.scale.value === 1 &&
    a3.worklet.__paramsById.retune.value === 120 &&
    approx(a3.worklet.__paramsById.mix.value, 0.5),
    "factory honors string key/scale + retune/mix at construction ('E' Major 120ms 50%)");

  await vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "a5", type: "autotune", ' +
    'params: {key: 9, scale: 2}}]);',
    ok
  );
  var a5 = vm.runInContext('window.AudioGraph.getNodeInstance("a5")', ok);
  check(a5 && a5.worklet.__paramsById.key.value === 9 &&
    a5.worklet.__paramsById.scale.value === 2,
    'catalog preserves legacy raw numeric enums by normalizing them to registered values');

  var unknownEnumError = null;
  try {
    vm.runInContext(
      'window.AudioGraph.buildGraph([{id: "a6", type: "autotune", ' +
      "params: {key: 'H', scale: 'Dorian'}}]);",
      ok
    );
  } catch (err) {
    unknownEnumError = err;
  }
  check(unknownEnumError && /must be one of its values/.test(unknownEnumError.message) &&
    vm.runInContext('window.AudioGraph.getNodeInstance("a5")', ok) === a5,
    'catalog rejects unknown enum strings before replacing the live graph');

  // ------------------------------------------------------------------
  console.log('D. THE ASYNC addModule WINDOW (placeholder -> splice)');
  // ------------------------------------------------------------------
  var df = createNodeSandbox({ module: 'deferred', ctorSite: 'global' });
  loadNodeSources(df);
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "d1", type: "autotune", params: {}}]);',
    df
  );
  await settle();
  var d1 = vm.runInContext('window.AudioGraph.getNodeInstance("d1")', df);

  check(!!d1 && d1.worklet === null && d1.input.__connectsTo(d1.output),
    'before the module resolves: composite is a valid UNITY PASSTHROUGH (input -> output, no worklet)');
  check(df.__createdWorklets.length === 0 && df.__consoleErrors.length === 0,
    'no worklet node and no error while the module is in flight');

  df.EffectCatalog.applyParam('autotune', d1, 'key', 'G');
  df.EffectCatalog.applyParam('autotune', d1, 'mix', 40);
  check(d1.worklet === null && d1.pendingParams.key === 7 &&
    approx(d1.pendingParams.mix, 0.4),
    "applyParam during the window is recorded ENUM-MAPPED ('G' -> 7, 40% -> 0.4), not dropped");

  df.__resolveModule();
  await settle();
  check(!!d1.worklet && d1.input.__connectsTo(d1.worklet) &&
    d1.worklet.__connectsTo(d1.output) && !d1.input.__connectsTo(d1.output),
    'after resolution: worklet spliced in between the stable connect points');
  check(d1.worklet.__paramsById.key.value === 7 &&
    approx(d1.worklet.__paramsById.mix.value, 0.4) &&
    d1.worklet.__paramsById.scale.value === 0,
    'pending key/mix applied at insertion; untouched params keep creation defaults');

  // ------------------------------------------------------------------
  console.log('E. FAILURE + CONSTRUCTOR-RESOLUTION VARIANTS');
  // ------------------------------------------------------------------
  var fl = createNodeSandbox({ module: 'fail', ctorSite: 'global' });
  loadNodeSources(fl);
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "f1", type: "autotune", params: {}}]);',
    fl
  );
  await settle();
  var f1 = vm.runInContext('window.AudioGraph.getNodeInstance("f1")', fl);
  check(!!f1 && f1.worklet === null && f1.input.__connectsTo(f1.output),
    'addModule failure: autotune stays a valid unity passthrough (loud, not dead)');
  check(fl.__consoleErrors.length === 1 && /failed to load/.test(fl.__consoleErrors[0]),
    'addModule failure: exactly one honest console diagnostic');
  var failApplyThrew = false;
  try {
    fl.EffectCatalog.applyParam('autotune', f1, 'key', 'D');
  } catch (err) {
    failApplyThrew = true;
  }
  check(!failApplyThrew && f1.pendingParams.key === 2,
    'applyParam in the failed state is still a safe no-throw no-op (recorded)');

  var cp = createNodeSandbox({ module: 'ok', ctorSite: 'ctx' });
  loadNodeSources(cp);
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "c1", type: "autotune", params: {}}]);',
    cp
  );
  await settle();
  var c1 = vm.runInContext('window.AudioGraph.getNodeInstance("c1")', cp);
  check(!!c1 && !!c1.worklet && c1.worklet.__processorName === 'autotune',
    'worklet constructor resolved from the context property (meter-taps form) when no global exists');

  // ------------------------------------------------------------------
  console.log('F. PRESET ROUND-TRIP (PresetSchema, incl. key/scale strings)');
  // ------------------------------------------------------------------
  var model = [
    { id: 'gn1', type: 'gain', params: { gainDb: -2 } },
    { id: 'at1', type: 'autotune', params: { key: 'F#', scale: 'Minor', retune: 120, mix: 65 } }
  ];
  var serialized = ok.PresetSchema.serialize('autotune preset', model);
  var json = JSON.parse(JSON.stringify(serialized)); // wire-format survival
  var restored = ok.PresetSchema.deserialize(json);
  var at1 = restored.nodes.filter(function (n) { return n.type === 'autotune'; })[0];
  check(!!at1, 'preset round-trip preserves the autotune entry');
  check(at1.params.key === 'F#' && at1.params.scale === 'Minor',
    "preset round-trip preserves the key/scale STRINGS exactly");
  check(at1.params.retune === 120 && at1.params.mix === 65,
    'preset round-trip preserves retune/mix exactly');
  restored.nodes[1].params.key = 'B';
  check(json.nodes[1].params.key === 'F#',
    'deserialize deep-copies (no aliasing into the stored preset)');
  var defPres = ok.PresetSchema.deserialize(
    JSON.parse(JSON.stringify(ok.PresetSchema.serialize('defaults', [
      { id: 'at2', type: 'autotune', params: {} }
    ])))
  );
  check(defPres.nodes[0].type === 'autotune' &&
    Object.keys(defPres.nodes[0].params).length === 0,
    'a default-params autotune entry (params {}) round-trips');
}

// ======================================================================
// Part 2 — the REAL processor in a stubbed AudioWorkletGlobalScope.
// ======================================================================

function bootProcessorScope() {
  var registered = {};
  var scope = {
    console: console,
    sampleRate: SR,
    currentTime: 0,
    AudioWorkletProcessor: function () {},
    registerProcessor: function (name, ctor) {
      registered[name] = ctor;
    }
  };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/autotune-worklet.js'), 'utf8'), scope, {
    filename: 'src/autotune-worklet.js'
  });
  return registered;
}

function mkParams(o) {
  o = o || {};
  return {
    key: new Float32Array([o.key || 0]),
    scale: new Float32Array([o.scale || 0]),
    retune: new Float32Array([o.retune !== undefined ? o.retune : 0]),
    mix: new Float32Array([o.mix !== undefined ? o.mix : 1])
  };
}

/**
 * Offline render through the processor with per-block CPU timing.
 * opts: key/scale/retune/mix (constants), atBlock(b) -> overrides applied
 * from block b on (param changes mid-stream), stereo (second input
 * channel array), cpu (collect timings).
 */
function runChain(Processor, pcm, opts) {
  opts = opts || {};
  var pad = Math.round(0.4 * SR);
  var total = Math.ceil((pcm.length + pad) / BLOCK) * BLOCK;
  var in0 = new Float32Array(total);
  in0.set(pcm);
  var in1 = null;
  var out1 = null;
  if (opts.stereo) {
    in1 = new Float32Array(total);
    in1.set(opts.stereo);
    out1 = new Float32Array(total);
  }
  var out0 = new Float32Array(total);
  var base = { key: opts.key || 0, scale: opts.scale || 0,
    retune: opts.retune !== undefined ? opts.retune : 0,
    mix: opts.mix !== undefined ? opts.mix : 1 };
  var inst = new Processor();
  var cpuUs = [];
  var overrides = null;
  for (var b = 0; b < total / BLOCK; b++) {
    if (opts.atBlock && b >= (opts.atBlockAt !== undefined ? opts.atBlockAt : 0) && !overrides) {
      overrides = Object.assign({}, base, opts.atBlock());
    }
    var params = mkParams(overrides || base);
    var i0 = in0.subarray(b * BLOCK, (b + 1) * BLOCK);
    var o0 = out0.subarray(b * BLOCK, (b + 1) * BLOCK);
    var t0 = process.hrtime.bigint();
    if (in1) {
      var i1 = in1.subarray(b * BLOCK, (b + 1) * BLOCK);
      var o1 = out1.subarray(b * BLOCK, (b + 1) * BLOCK);
      inst.process([[i0, i1]], [[o0, o1]], params);
    } else {
      inst.process([[i0]], [[o0]], params);
    }
    var t1 = process.hrtime.bigint();
    cpuUs.push(Number(t1 - t0) / 1000);
  }
  return { out: out0, out1: out1, input: in0, cpu: cpuUs, inst: inst };
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
// Independent offline YIN oracle — the spike harness's naive direct-loop
// implementation, verbatim (no FFT, no shared code with the worklet).
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

// ===========================================================================
// Metric helpers (spike-harness vocabulary).
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

function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function centsBetween(f, ref) { return 1200 * Math.log(f / ref) / Math.log(2); }

function percentile(arr, p) {
  var s = arr.slice().sort(function (a, b) { return a - b; });
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

/** Peak amplitude per output period -> dB spread over the steady span. */
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

/** Worst out/in window-RMS dip (dB) over one contiguous voiced span. */
function minWindowDipDb(inA, outA, from, to) {
  var win = Math.round(0.02 * SR), hop = Math.round(0.01 * SR);
  var worst = Infinity;
  for (var st = from; st + win <= to; st += hop) {
    var ri = 0, ro = 0;
    for (var i = st; i < st + win; i++) {
      ri += inA[i] * inA[i];
      ro += outA[i] * outA[i];
    }
    if (ri > 1e-8) {
      var dip = 10 * Math.log10((ro + 1e-30) / ri);
      if (dip < worst) worst = dip;
    }
  }
  return worst;
}

/** mean |x[n]-x[n-1]| / mean |x| over [from,to). */
function hfRatio(x, from, to) {
  var num = 0, den = 0;
  for (var i = from + 1; i < to; i++) {
    num += Math.abs(x[i] - x[i - 1]);
    den += Math.abs(x[i]);
  }
  return num / (den + 1e-30);
}

// ===========================================================================
// Signal generators.
// ===========================================================================

function tone(fHz, durS, opts) {
  opts = opts || {};
  var n = Math.round(durS * SR);
  var x = new Float32Array(n);
  var edge = Math.round(0.005 * SR);
  var phase = 0;
  var inc = (2 * Math.PI * fHz) / SR;
  for (var i = 0; i < n; i++) {
    var instF = fHz;
    if (opts.vibratoCents) {
      instF = fHz * Math.pow(2, (opts.vibratoCents / 1200) *
        Math.sin(2 * Math.PI * (opts.vibratoHz || 5) * i / SR));
    }
    var v;
    if (opts.harmonic) {
      v = 0.30 * Math.sin(phase) + 0.10 * Math.sin(2 * phase) + 0.05 * Math.sin(3 * phase);
    } else {
      v = 0.4 * Math.sin(phase);
    }
    var g = 1;
    if (i < edge) g = 0.5 * (1 - Math.cos(Math.PI * i / edge));
    if (i > n - edge) g = 0.5 * (1 - Math.cos(Math.PI * (n - i) / edge));
    x[i] = v * g;
    phase += inc * (instF / fHz);
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

function f1(v) { return Number(v).toFixed(1); }

/** Median/p95 |cents vs expectHz| of voiced oracle frames in a slice. */
function snapResidual(frames, expectHz) {
  var vals = [];
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].f0 > 0) vals.push(Math.abs(centsBetween(frames[i].f0, expectHz)));
  }
  if (!vals.length) return { median: NaN, p95: NaN, n: 0 };
  return { median: percentile(vals, 0.5), p95: percentile(vals, 0.95), n: vals.length };
}

async function processorTests() {
  var registered = bootProcessorScope();

  // ------------------------------------------------------------------
  console.log('G. MODULE REGISTRATION + PARAMETER DESCRIPTORS');
  // ------------------------------------------------------------------
  check(typeof registered['autotune'] === 'function',
    'the module registers the "autotune" processor');
  var desc = registered['autotune'].parameterDescriptors;
  check(Array.isArray(desc) && desc.length === 4 &&
    desc[0].name === 'key' && desc[1].name === 'scale' &&
    desc[2].name === 'retune' && desc[3].name === 'mix',
    'parameterDescriptors: exactly key/scale/retune/mix');
  check(desc[0].defaultValue === 0 && desc[1].defaultValue === 0 &&
    desc[2].defaultValue === 0 && approx(desc[3].defaultValue, 1),
    'descriptor defaults: C / Chromatic / 0 ms (hard-tune) / full wet');
  check(desc.every(function (d) { return d.automationRate === 'k-rate'; }),
    'all four params are k-rate');
  check(desc[0].minValue === 0 && desc[0].maxValue === 11 &&
    desc[1].minValue === 0 && desc[1].maxValue === 2 &&
    desc[2].minValue === 0 && desc[2].maxValue === 500 &&
    desc[3].minValue === 0 && desc[3].maxValue === 1,
    'descriptor ranges match the enum/param domains');

  // ------------------------------------------------------------------
  console.log('H. DETECTION→SNAP→SHIFT EXACTNESS (synthetic tones; L1)');
  // ------------------------------------------------------------------
  // L1 note: every case below snaps the OUTPUT to a known scale target —
  // if the FFT-YIN formulation regressed (fixed-W difference function or
  // a wrong swap-trick argument), clarity reads ~1.0 at the WRONG period
  // and the output lands measurably off the target note.
  var hCases = [];
  [110, 220, 440].forEach(function (base) {
    [-40, 0, 40].forEach(function (dc) {
      var f = detune(base, dc);
      hCases.push({ f: f, key: 0, scale: 0, expect: midiToHz(nearestAllowedMidi(
        69 + 12 * Math.log(f / 440) / Math.LN2, 0, 0)),
        label: f1(f) + ' Hz (A-row ' + (dc > 0 ? '+' : '') + dc + 'c) -> ' +
          f1(midiToHz(nearestAllowedMidi(69 + 12 * Math.log(f / 440) / Math.LN2, 0, 0))) + ' Hz chromatic' });
    });
  });
  // AT-0's snap-correctness battery, incl. forbidden-note masking and the
  // bottom of the wet-path range (hand-computed targets from the spike):
  hCases.push({ f: 265.0, key: 0, scale: 0, expect: 261.63, label: '265 Hz -> C4 (chromatic)' });
  hCases.push({ f: 275.0, key: 0, scale: 0, expect: 277.18, label: '275 Hz -> C#4 (chromatic)' });
  hCases.push({ f: 275.0, key: 0, scale: 1, expect: 261.63, label: '275 Hz -> C4 (C major: C# forbidden)' });
  hCases.push({ f: 310.0, key: 0, scale: 1, expect: 293.66, label: '310 Hz -> D4 (C major: D# forbidden)' });
  hCases.push({ f: 239.0, key: 9, scale: 2, expect: 246.94, label: '239 Hz -> B3 (A minor: A# forbidden)' });
  hCases.push({ f: 113.0, key: 0, scale: 0, expect: 110.0, label: '113 Hz -> A2 (chromatic, lowest range)' });

  var hMax = 0;
  hCases.forEach(function (c) {
    var sig = concat(silence(0.25), tone(c.f, 0.9, { harmonic: true }), silence(0.25));
    var r = runChain(registered['autotune'], sig, { key: c.key, scale: c.scale, retune: 0 });
    // Analyze the D-delayed settled interior of the output.
    var from = Math.round((0.35) * SR), to = Math.round((1.05) * SR);
    var frames = refYin(r.out.subarray(from, to));
    var res = snapResidual(frames, c.expect);
    hMax = Math.max(hMax, res.median);
    check(res.n >= 10 && res.median < 10,
      c.label + ': median residual ' + f1(res.median) + 'c over ' + res.n +
      ' voiced frames (p95 ' + f1(res.p95) + 'c)');
  });
  check(hMax < 10, 'worst median snap residual across all ' + hCases.length +
    ' cases: ' + f1(hMax) + 'c (bar < 10c; spike measured 0.1-4.7c)');

  // ------------------------------------------------------------------
  console.log('I. FIXED DECLARED DELAY, STALL-FREE (L2: impulse exactness)');
  // ------------------------------------------------------------------
  // Early impulse in silence: emerges bit-exact at +D.
  var imp = new Float32Array(SR);
  var impPos = Math.round(0.3 * SR);
  imp[impPos] = 1;
  var rImp = runChain(registered['autotune'], imp, { retune: 0 });
  var firstNz = -1;
  for (var i2 = 0; i2 < rImp.out.length; i2++) {
    if (Math.abs(rImp.out[i2]) > 1e-7) { firstNz = i2; break; }
  }
  check(firstNz === impPos + D_N,
    'impulse at input ' + impPos + ' emerges at output ' + (impPos + D_N) +
    ' = exactly +20 ms (bit-exact position, no smear)');
  check(approx(rImp.out[impPos + D_N], 1.0, 1e-6),
    'the impulse passes at UNITY on the dry leg (declared delay, not attenuation)');
  var warmZero = true;
  for (var wz = 0; wz < D_N; wz++) {
    if (rImp.out[wz] !== 0) { warmZero = false; }
  }
  check(warmZero, 'the first ' + D_N + ' samples are delay-line warm-up silence (cursor starts at -D)');

  // Late impulse AFTER 1.5 s of sustained voiced content + trailing
  // silence: same exact +D (the emission cursor never stalls, races, or
  // drifts — the failure mode of adaptive margins).
  var tone15 = tone(220, 1.5, { harmonic: true });
  var late = concat(silence(0.5), tone15, silence(0.5));
  var lateImpPos = late.length + Math.round(0.1 * SR);
  var lateSig = concat(late, silence(0.4));
  var impArr = new Float32Array(lateSig.length);
  impArr.set(lateSig);
  impArr[lateImpPos] = 1;
  var rLate = runChain(registered['autotune'], impArr, { retune: 0 });
  var tailStart = lateImpPos + D_N;
  check(approx(rLate.out[tailStart], 1.0, 1e-6) && rLate.out[tailStart - 1] === 0,
    'a late impulse after sustained voiced audio still emerges at exactly +20 ms (stall-free, constant D)');
  var preLeak = 0;
  for (var pl = tailStart - 240; pl < tailStart; pl++) {
    preLeak = Math.max(preLeak, Math.abs(rLate.out[pl]));
  }
  check(preLeak < 1e-7,
    'no energy leaks BEFORE the emission position in trailing silence (no race-ahead)');
  var dupHits = 0;
  for (var dt = tailStart + 2; dt < rLate.out.length; dt++) {
    if (Math.abs(rLate.out[dt]) > 0.5) dupHits++;
  }
  check(dupHits === 0, 'the impulse is not duplicated downstream (history intact)');

  // ------------------------------------------------------------------
  console.log('J. HISTORY DISCIPLINE UNDER SUSTAINED SHIFT (L3: ring wraps)');
  // ------------------------------------------------------------------
  // 3 s continuous -44c correction = ~17.6 ring wraps while grains write
  // ahead of the emission cursor. AT-0 L3's failure was stale-data
  // pollution appearing one ring-wrap later.
  var jf = 239.0, jExpect = 233.08;
  var jSig = concat(silence(0.3), tone(jf, 3, { harmonic: true }), silence(0.3));
  var rJ = runChain(registered['autotune'], jSig, { retune: 0 });
  var jFrom = Math.round(0.8 * SR), jTo = Math.round(2.9 * SR);
  // D-align in/out content for the comparative metrics.
  var jN = Math.min(jSig.length, rJ.out.length - D_N);
  var jOut = new Float32Array(jN);
  jOut.set(rJ.out.subarray(D_N, D_N + jN));

  var noNaN = true;
  for (var jn = 0; jn < rJ.out.length; jn++) {
    if (!isFinite(rJ.out[jn])) { noNaN = false; break; }
  }
  check(noNaN, 'no NaN/Infinity anywhere in 3 s of continuously shifted output');
  var jFrames = refYin(rJ.out.subarray(jFrom, jTo));
  var jRes = snapResidual(jFrames, jExpect);
  check(jRes.n >= 100 && jRes.median < 10,
    'sustained 3 s shift holds the target: median residual ' + f1(jRes.median) +
    'c over ' + jRes.n + ' frames (p95 ' + f1(jRes.p95) + 'c)');
  var jAM = ampModDb(jOut, jExpect, jFrom, jTo);
  check(jAM < 3,
    'amplitude modulation depth ' + f1(jAM) + ' dB over 17+ ring wraps (spike: 0.0 dB; window-sum normalization holds)');
  var jSnrOut = snrWorstDb(jOut, jExpect, jFrom, jTo);
  var jSnrIn = snrWorstDb(jSig, jf, jFrom, jTo);
  check(jSnrOut >= jSnrIn - 1,
    'worst-window SNR ' + f1(jSnrOut) + ' dB vs the input tone\'s own harmonic floor ' +
    f1(jSnrIn) + ' dB (no added noise/jitter beyond the input)');
  var jDip = minWindowDipDb(jSig, jOut, jFrom, jTo);
  check(jDip > -20,
    'worst 20 ms out/in window dip ' + f1(jDip) + ' dB (no dropouts on the sustained note; spike: -2.6 dB)');
  var jInMax = 0, jOutMax = 0;
  for (var jm = jFrom; jm < jTo; jm++) {
    jInMax = Math.max(jInMax, Math.abs(jSig[jm]));
    jOutMax = Math.max(jOutMax, Math.abs(jOut[jm]));
  }
  check(jOutMax <= jInMax * 1.25 + 1e-6,
    'peak stays bounded under grain overlap-add (' + f1(jOutMax) + ' vs input ' + f1(jInMax) + ')');

  // ------------------------------------------------------------------
  console.log('K. SNAP STATE MACHINE (L4: onset bias + hysteresis + retarget)');
  // ------------------------------------------------------------------
  // Biased-onset lock: the AT-0 §4.4 reproduced failure — a wide target
  // band let the biased onset lock A3/B3 instead of A#3 at 239 Hz.
  var k1 = concat(silence(0.25), tone(239, 1.2, { harmonic: true }), silence(0.25));
  var rK1 = runChain(registered['autotune'], k1, { retune: 0 });
  var k1Frames = refYin(rK1.out.subarray(Math.round(0.35 * SR), Math.round(1.35 * SR)));
  var k1Res = snapResidual(k1Frames, 233.08);
  check(k1Res.n >= 10 && k1Res.median < 10,
    'biased onset locks the RIGHT note: 239 Hz -> A#3 (233.08 Hz), median ' +
    f1(k1Res.median) + 'c (not the semitone-wrong A3/B3 lock)');

  // Vibrato ±40c @ 5 Hz around A3: NEVER retargets (band is ±0.52 st;
  // chatter protection is the retune smoothing's job, not the band's).
  var k2 = concat(silence(0.25), tone(220, 1.5, { harmonic: true, vibratoCents: 40, vibratoHz: 5 }), silence(0.25));
  var rK2 = runChain(registered['autotune'], k2, { retune: 0 });
  var k2Frames = refYin(rK2.out.subarray(Math.round(0.35 * SR), Math.round(1.6 * SR)));
  var k2Off = [], k2Voiced = 0;
  for (var k2i = 0; k2i < k2Frames.length; k2i++) {
    if (k2Frames[k2i].f0 > 0) {
      k2Voiced++;
      k2Off.push(Math.abs(centsBetween(k2Frames[k2i].f0, 220)));
    }
  }
  var k2Max = k2Off.length ? Math.max.apply(null, k2Off) : NaN;
  check(k2Voiced >= 40 && k2Max < 25,
    '±40c vibrato stays snapped to A3: ' + k2Voiced + ' voiced frames, worst ' +
    f1(k2Max) + 'c (no semitone retarget churn across the ±0.52 st boundary)');

  // A REAL note change retargets (two-frame confirmation path).
  var k3 = concat(silence(0.25), tone(220, 1.0, { harmonic: true }),
    tone(277.18, 1.0, { harmonic: true }), silence(0.25));
  var rK3 = runChain(registered['autotune'], k3, { retune: 0 });
  var k3a = snapResidual(refYin(rK3.out.subarray(Math.round(0.35 * SR), Math.round(1.15 * SR))), 220);
  var k3b = snapResidual(refYin(rK3.out.subarray(Math.round(1.35 * SR), Math.round(2.15 * SR))), 277.18);
  check(k3a.n >= 10 && k3a.median < 10 && k3b.n >= 10 && k3b.median < 10,
    'real note change retargets: A3 (median ' + f1(k3a.median) + 'c) then C#4 (median ' +
    f1(k3b.median) + 'c)');

  // ------------------------------------------------------------------
  console.log('L. PARAM CHANGES MID-STREAM (key / scale / retune / mix)');
  // ------------------------------------------------------------------
  // Scale change mid-note: chromatic C#4 becomes forbidden in C major ->
  // the engine resnaps to C4 (the key/scale-change branch).
  var l1 = concat(silence(0.25), tone(275, 2.0, { harmonic: true }), silence(0.25));
  var switchBlock = Math.round((0.25 + 1.0) * SR / BLOCK);
  var rL1 = runChain(registered['autotune'], l1, {
    retune: 0, atBlockAt: switchBlock, atBlock: function () { return { scale: 1 }; }
  });
  var l1a = snapResidual(refYin(rL1.out.subarray(Math.round(0.35 * SR), Math.round(1.15 * SR))), 277.18);
  var l1b = snapResidual(refYin(rL1.out.subarray(Math.round(1.45 * SR), Math.round(2.15 * SR))), 261.63);
  check(l1a.n >= 10 && l1a.median < 10 && l1b.n >= 10 && l1b.median < 15,
    'scale change mid-note: C#4 (median ' + f1(l1a.median) + 'c) -> resnap C4 in C major (median ' +
    f1(l1b.median) + 'c)');

  // Key change mid-note: C major's C4 becomes illegal in C# major ->
  // resnaps to C#4.
  var rL2 = runChain(registered['autotune'], l1, {
    scale: 1, retune: 0, atBlockAt: switchBlock, atBlock: function () { return { key: 1, scale: 1 }; }
  });
  var l2a = snapResidual(refYin(rL2.out.subarray(Math.round(0.35 * SR), Math.round(1.15 * SR))), 261.63);
  var l2b = snapResidual(refYin(rL2.out.subarray(Math.round(1.45 * SR), Math.round(2.15 * SR))), 277.18);
  check(l2a.n >= 10 && l2a.median < 10 && l2b.n >= 10 && l2b.median < 15,
    'key change mid-note: C4 in C major (median ' + f1(l2a.median) + 'c) -> resnap C#4 in C# major (median ' +
    f1(l2b.median) + 'c)');

  // Retune Speed: the SAME engine opens up to the slow-correction glide.
  var l3 = concat(silence(0.25), tone(225, 1.2, { harmonic: true }), silence(0.25));
  var rL3a = runChain(registered['autotune'], l3, { retune: 0 });
  var rL3b = runChain(registered['autotune'], l3, { retune: 400 });
  var glideWin = rL3a.out.subarray(Math.round(0.42 * SR), Math.round(0.62 * SR));
  var gA = snapResidual(refYin(glideWin), 220);
  var gB = snapResidual(refYin(rL3b.out.subarray(Math.round(0.42 * SR), Math.round(0.62 * SR))), 220);
  check(gA.n >= 3 && gA.median < 10,
    'retune 0 ms: snapped within 10c by 170-370 ms after onset (median ' + f1(gA.median) + 'c)');
  check(gB.n >= 3 && gB.median > 15,
    'retune 400 ms: still gliding in the same window (median ' + f1(gB.median) +
    'c > 15c — the D2 two-outcome shape on one engine)');

  // Mix mid-stream 1 -> 0: from the switch block on, bit-exact dry.
  var mixSwitch = Math.round((0.25 + 0.6) * SR / BLOCK);
  var rL4 = runChain(registered['autotune'], l3, {
    retune: 0, atBlockAt: mixSwitch, atBlock: function () { return { mix: 0 }; }
  });
  var dryFrom = mixSwitch * BLOCK - D_N + BLOCK; // content emitted post-switch
  var dryExact = true;
  for (var dx = dryFrom; dx < l3.length; dx++) {
    if (rL4.out[dx + D_N] !== l3[dx]) { dryExact = false; break; }
  }
  check(dryExact,
    'mix 1 -> 0 mid-stream: everything emitted after the switch is bit-exact dry');

  // ------------------------------------------------------------------
  console.log('M. MIX = 0 BIT-EXACT DRY, PER CHANNEL (bypass-clean aid)');
  // ------------------------------------------------------------------
  var mSig = concat(silence(0.25), tone(233, 1.2, { harmonic: true }), silence(0.25));
  var rM0 = runChain(registered['autotune'], mSig, { retune: 0, mix: 0 });
  var mExact = true;
  for (var mx = 0; mx < mSig.length; mx++) {
    if (rM0.out[mx + D_N] !== mSig[mx]) { mExact = false; break; }
  }
  check(mExact,
    'mix = 0 over voiced content: output === input delayed by exactly 20 ms, BIT-EXACT');
  var mHead = true;
  for (var mh = 0; mh < D_N; mh++) {
    if (rM0.out[mh] !== 0) { mHead = false; }
  }
  check(mHead, 'mix = 0 keeps the 20 ms warm-up head silent (delay constant on the dry leg too)');

  // Stereo: channel 1 keeps its own bit-exact dry (per-channel rings).
  var stIn1 = concat(silence(0.25), tone(349.23, 1.2, { harmonic: true }), silence(0.25));
  var rMS = runChain(registered['autotune'], mSig, { retune: 0, mix: 0, stereo: stIn1 });
  var s0 = true, s1 = true;
  for (var sx = 0; sx < mSig.length; sx++) {
    if (rMS.out[sx + D_N] !== mSig[sx]) { s0 = false; break; }
  }
  for (var sy = 0; sy < stIn1.length; sy++) {
    if (rMS.out1[sy + D_N] !== stIn1[sy]) { s1 = false; break; }
  }
  check(s0 && s1,
    'stereo bus at mix = 0: BOTH channels bit-exact (no channel-0 collapse)');

  // Empty/absent input handled without dying.
  var emptyOk = true;
  var emptyOut = new Float32Array(BLOCK);
  try {
    var inst = new registered['autotune']();
    var e1 = inst.process([[]], [[emptyOut]], mkParams());
    var e2 = inst.process([], [[emptyOut]], mkParams());
    emptyOk = e1 === true && e2 === true;
    for (var ez = 0; ez < BLOCK; ez++) {
      if (emptyOut[ez] !== 0) emptyOk = false;
    }
  } catch (err) {
    emptyOk = false;
  }
  check(emptyOk,
    'empty/absent input: process() returns true and outputs zeros (no crash, stays alive)');

  // ------------------------------------------------------------------
  console.log('N. CPU PER BLOCK vs SPIKE (bar: p99 <= 25% of the quantum)');
  // ------------------------------------------------------------------
  // JIT warm-up first so one cold-start outlier cannot skew p99.
  runChain(registered['autotune'], silence(0.3), { retune: 0 });

  // Vocal-like load: onsets, gaps, vibrato, a low tone, sustained shifts.
  var vocalLike = concat(
    silence(0.3),
    tone(196, 0.5, { harmonic: true, vibratoCents: 30, vibratoHz: 5 }),
    silence(0.15),
    tone(detune(233, 35), 0.5, { harmonic: true }),
    silence(0.15),
    tone(311, 0.5, { harmonic: true, vibratoCents: 25, vibratoHz: 6 }),
    silence(0.15),
    tone(147, 0.9, { harmonic: true, vibratoCents: 35, vibratoHz: 4 })
  );
  var rN1 = runChain(registered['autotune'], vocalLike, { retune: 0 });
  var st1 = cpuStats(rN1.cpu);
  console.log('  NOTE - CPU vocal-like load: mean ' + st1.mean.toFixed(3) +
    ' ms, p50 ' + st1.p50.toFixed(3) + ' ms, p99 ' + st1.p99.toFixed(3) +
    ' ms, max ' + st1.max.toFixed(3) + ' ms');
  check(st1.p99 <= 0.25 * QUANTUM_MS,
    'vocal-like p99 CPU ' + (100 * st1.p99 / QUANTUM_MS).toFixed(1) +
    '% of the 2.667 ms quantum (D2 bar 25%; spike measured 12.6% on TEST-1)');

  // Max grain rate: ~440 Hz + active shift (the spike's worst case).
  var hiSig = tone(detune(440, 45), 3, { harmonic: true });
  var rN2 = runChain(registered['autotune'], hiSig, { retune: 0 });
  var st2 = cpuStats(rN2.cpu);
  console.log('  NOTE - CPU 440 Hz max grain rate: mean ' + st2.mean.toFixed(3) +
    ' ms, p50 ' + st2.p50.toFixed(3) + ' ms, p99 ' + st2.p99.toFixed(3) +
    ' ms, max ' + st2.max.toFixed(3) + ' ms');
  check(st2.p99 <= 0.25 * QUANTUM_MS,
    '440 Hz p99 CPU ' + (100 * st2.p99 / QUANTUM_MS).toFixed(1) +
    '% of quantum (spike measured 9.2%)');
  var nNoNaN = true;
  for (var nn = 0; nn < rN2.out.length; nn++) {
    if (!isFinite(rN2.out[nn])) { nNoNaN = false; break; }
  }
  check(nNoNaN, 'no NaN under the max-rate sustained shift');
}

// ======================================================================
// Part 3 (optional, machine-local) — TEST-1 slice through the production
// engine. Runs ONLY where the gitignored ffmpeg cache from the AT-0 spike
// (tests/spike/out/test-vocal-48k-mono.f32) already exists; skips cleanly
// on a clean clone. Bars carry honest margins vs AT-0's measured numbers.
// ======================================================================

function vocalSmokeTest() {
  var cache = path.join(ROOT, 'tests', 'spike', 'out', 'test-vocal-48k-mono.f32');
  if (!fs.existsSync(cache)) {
    console.log('O. REAL TEST-VOCAL SLICE — SKIPPED (no local ffmpeg cache; clean clone)');
    return;
  }
  console.log('O. REAL TEST-VOCAL SLICE (production engine, local cache only)');
  var buf = fs.readFileSync(cache);
  var full = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
  // 8 s slice, content-offset 4 s (an interior stretch with real onsets).
  var off = 4 * SR;
  var pcm = full.subarray(off, off + 8 * SR);
  var pcmCopy = new Float32Array(pcm.length);
  pcmCopy.set(pcm);

  var registered = bootProcessorScope();
  runChain(registered['autotune'], silence(0.3), { retune: 0 }); // JIT warm-up
  var r = runChain(registered['autotune'], pcmCopy, { retune: 0 }); // hard-tune chromatic

  var refIn = refYin(pcmCopy);
  var N = Math.min(pcmCopy.length, r.out.length - D_N);
  var outA = new Float32Array(N);
  outA.set(r.out.subarray(D_N, D_N + N));
  var refOut = refYin(outA);
  var D_FRAMES = Math.round(D_N / REF_HOP);

  // Snap residual on voiced frames (output frame i+D_FRAMES <-> input i).
  var resid = [], lost = 0, counted = 0;
  for (var i = 0; i < refIn.length; i++) {
    if (refIn[i].f0 <= 0) continue;
    counted++;
    var of = refOut[i + D_FRAMES];
    if (!of || of.f0 <= 0) { lost++; continue; }
    var midi = 69 + 12 * Math.log(of.f0 / 440) / Math.LN2;
    resid.push(Math.abs((nearestAllowedMidi(midi, 0, 0) - midi) * 100));
  }
  var med = percentile(resid, 0.5), p95 = percentile(resid, 0.95);
  var within10 = resid.filter(function (c) { return c < 10; }).length / resid.length;
  console.log('  NOTE - TEST-1 slice: ' + counted + ' input-voiced frames; residual median ' +
    f1(med) + 'c, p95 ' + f1(p95) + 'c, within-10c ' + (100 * within10).toFixed(1) +
    '%; lost-voiced ' + lost + '/' + counted + ' (spike full-track: 2.5c / 14.8c / 90.9%)');
  check(resid.length >= 100 && med < 10,
    'TEST-1 slice snap residual median ' + f1(med) + 'c (bar < 10c)');
  check(p95 < 45,
    'TEST-1 slice snap residual p95 ' + f1(p95) + 'c (bar < 45c; spike 14.8c full-track)');
  check(within10 > 0.55,
    'TEST-1 slice within-10c ratio ' + (100 * within10).toFixed(1) + '% (bar > 55%; spike 90.9%)');

  // Dropouts + HF-click ratio over voiced spans.
  var spans = [], run = null;
  for (var s2 = 0; s2 < refIn.length; s2++) {
    if (refIn[s2].f0 > 0) {
      if (!run) run = [Math.max(0, Math.round(refIn[s2].t - 0.05 * SR)), Math.round(refIn[s2].t + REF_HOP)];
      run[1] = Math.round(refIn[s2].t + REF_HOP);
    } else if (run) {
      spans.push(run);
      run = null;
    }
  }
  if (run) spans.push(run);
  spans = spans.filter(function (s3) { return s3[1] - s3[0] > SR / 10; });
  var worstDip = Infinity, below20 = 0, dipsTotal = 0;
  spans.forEach(function (sp) {
    var win = Math.round(0.02 * SR), hop = Math.round(0.01 * SR);
    sp[1] = Math.min(sp[1], N);
    for (var st = sp[0]; st + win <= sp[1]; st += hop) {
      var ri = 0, ro = 0;
      for (var i3 = st; i3 < st + win; i3++) {
        ri += pcmCopy[i3] * pcmCopy[i3];
        ro += outA[i3] * outA[i3];
      }
      if (ri > 1e-8) {
        var dip = 10 * Math.log10((ro + 1e-30) / ri);
        dipsTotal++;
        if (dip < worstDip) worstDip = dip;
        if (dip < -20) below20++;
      }
    }
  });
  check(below20 === 0,
    'dropout windows below -20 dB: ' + below20 + '/' + dipsTotal + ' (spike: 0/1469; worst dip ' +
    f1(worstDip) + ' dB)');
  var hfNum = 0, hfDen = 0, hfNumIn = 0, hfDenIn = 0;
  spans.forEach(function (sp) {
    sp[1] = Math.min(sp[1], N);
    for (var i4 = sp[0] + 1; i4 < sp[1]; i4++) {
      hfNum += Math.abs(outA[i4] - outA[i4 - 1]); hfDen += Math.abs(outA[i4]);
      hfNumIn += Math.abs(pcmCopy[i4] - pcmCopy[i4 - 1]); hfDenIn += Math.abs(pcmCopy[i4]);
    }
  });
  var hfRatioOut = hfNum / (hfDen + 1e-30), hfRatioIn = hfNumIn / (hfDenIn + 1e-30);
  check(hfRatioOut / hfRatioIn < 1.35,
    'HF click ratio out/in ' + (hfRatioOut / hfRatioIn).toFixed(3) +
    ' (bar < 1.35; spike 0.974) — artifact review itself stays user-judged (QA-1)');
}

async function main() {
  await nodeLevelTests();
  await processorTests();
  vocalSmokeTest();

  console.log('');
  if (failures.length === 0) {
    console.log('AT-1 autotune node tests: all checks passed');
    process.exit(0);
  }
  console.log('AT-1 autotune node tests: ' + failures.length + ' FAIL');
  process.exit(1);
}

main().catch(function (err) {
  console.error('CRASH:', err);
  process.exit(1);
});
