// Regression test for GATE-1 — the cycle-3 noise gate
// (src/node-gate.js + src/gate-worklet.js), built per the D1 research
// decision (docs/ultron/research/rq1-noise-gate.md).
//
// Follows the committed zero-dependency Node harness convention (see
// tests/test-chorus-node.js and tests/test-hidden-tab-watchdog.js's
// headers): browser globals stubbed, the REAL src files loaded into vm
// sandboxes, per-check ok/FAIL prints, exit 0 on pass / 1 on any failure.
// Two sandboxes with different jobs:
//
//   1. NODE SANDBOX — effect-catalog.js / audio-graph.js / audio-param-ramp.js
//      / node-gate.js / preset-schema.js with an AudioWorkletNode stub:
//      registration, paramSpec, the async addModule load story (placeholder
//      passthrough -> worklet splice; deferred / failing / context-property
//      constructor variants), real-AudioParam wiring via applyParam, and
//      the PresetSchema round-trip.
//   2. PROCESSOR SCOPE — the REAL src/gate-worklet.js runs in a stubbed
//      AudioWorkletGlobalScope (the test-hidden-tab-watchdog.js testProcessor
//      precedent) and process() is driven BY HAND with synthetic RMS
//      envelopes (constant-amplitude blocks make block RMS exact and gain
//      directly measurable as out/in):
//        - closed at rest at Floor; opens past Threshold
//        - dB-linear Attack ramp of exactly Attack seconds (default 5 ms)
//        - look-ahead = exactly 5 ms (impulse position) and the gain is
//          FULLY OPEN the sample before the transient emerges
//        - hold: no release for >= 40 ms after the last loud sample, then
//          a release ramp of exactly Release seconds down to Floor
//        - 6 dB hysteresis: a band-level signal holds the gate OPEN when
//          open and CLOSED when closed (no chatter), and re-triggers
//        - Floor = 0 dB is bit-exact passthrough (x * 1.0)
//        - multi-channel: one gain, strongest-channel RMS detector
//        - k-rate Threshold changes respected mid-stream
//        - empty/absent input handled without dying
//
// Audio-quality judgments (audible / artifact-free / bypass-clean on
// assets/test-vocal.mp3, plosive onsets, breath tails) are USER-judged in
// QA-1, per the plan — not automatable here.
//
// Run from a clean clone:  node tests/test-gate-node.js

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
var LA_N = 240;      // Math.round(0.005 * 48000) — D1's 5 ms look-ahead

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// ======================================================================
// Shared Web Audio stubs (chorus-test shapes).
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

// ======================================================================
// Part 1 — node sandbox (registration, wiring, async load, presets).
// ======================================================================

/**
 * A node-level sandbox. opts.module: 'ok' (resolves immediately),
 * 'deferred' (the test resolves it by hand), 'fail' (rejects).
 * opts.ctorSite: 'global' (sandbox.AudioWorkletNode) or 'ctx'
 * (context property only — meter-taps's resolution form).
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
      threshold: makeParam(-50),
      attack: makeParam(0.005),
      release: makeParam(0.15),
      floor: makeParam(-40)
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
  loadSrc(sandbox, 'src/node-gate.js');
}

function settle() {
  return new Promise(function (r) {
    setTimeout(r, 60);
  });
}

async function nodeLevelTests() {
  // ------------------------------------------------------------------
  console.log('A. REGISTRATION + PARAM SPEC (module loads cleanly)');
  // ------------------------------------------------------------------
  var ok = createNodeSandbox({ module: 'ok', ctorSite: 'global' });
  loadNodeSources(ok);
  loadSrc(ok, 'src/preset-schema.js');

  check(ok.EffectCatalog.getAllTypes().indexOf('gate') !== -1,
    'gate registered in EffectCatalog (palette chip source)');
  check(ok.EffectCatalog.getLabel('gate') === 'Noise Gate', 'label is "Noise Gate"');

  var spec = ok.EffectCatalog.getParamSpec('gate');
  check(spec.length === 4, 'paramSpec has exactly 4 params (fixed by scope)');
  var byId = {};
  spec.forEach(function (s) { byId[s.id] = s; });
  check(!!byId.threshold && !!byId.attack && !!byId.release && !!byId.floor,
    'param ids are threshold/attack/release/floor');
  check(byId.threshold.label === 'Threshold' && byId.attack.label === 'Attack' &&
    byId.release.label === 'Release' && byId.floor.label === 'Floor',
    'plain-language labels Threshold/Attack/Release/Floor');
  check(byId.threshold.min === -80 && byId.threshold.max === 0 &&
    byId.threshold.default === -50 && byId.threshold.step === 1 &&
    byId.threshold.unit === 'dB',
    'threshold -80..0 dB, default -50, step 1 (D1 paramSpec)');
  check(byId.attack.min === 0.001 && byId.attack.max === 0.5 &&
    byId.attack.default === 0.005 && byId.attack.step === 0.001 &&
    byId.attack.unit === 's',
    'attack 0.001..0.5 s, default 0.005 (matches the 5 ms look-ahead)');
  check(byId.release.min === 0.01 && byId.release.max === 2 &&
    byId.release.default === 0.15 && byId.release.step === 0.01 &&
    byId.release.unit === 's',
    'release 0.01..2 s, default 0.15');
  check(byId.floor.min === -60 && byId.floor.max === 0 &&
    byId.floor.default === -40 && byId.floor.step === 1 &&
    byId.floor.unit === 'dB',
    'floor -60..0 dB, default -40');

  // ------------------------------------------------------------------
  console.log('B. FACTORY + WORKLET WIRING (module already loadable)');
  // ------------------------------------------------------------------
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "g1", type: "gate", params: {}}]);',
    ok
  );
  await settle();
  var g1 = vm.runInContext('window.AudioGraph.getNodeInstance("g1")', ok);

  check(!!g1 && !!g1.input && !!g1.output && !!g1.worklet,
    'factory returns composite {input, output, worklet}');
  check(g1.input.__nodeTypeName === 'GainNode' &&
    g1.output.__nodeTypeName === 'GainNode' &&
    g1.input.gain.value === 1 && g1.output.gain.value === 1,
    'input/output are UNITY GainNodes (stable connect points, no gain of their own)');
  check(g1.worklet.__processorName === 'noise-gate',
    'worklet node constructed for the "noise-gate" processor');
  check(g1.worklet.__nodeOpts && g1.worklet.__nodeOpts.numberOfInputs === 1 &&
    g1.worklet.__nodeOpts.numberOfOutputs === 1,
    'worklet constructed 1-in / 1-out (bus channel count passes through)');
  check(ok.__addModuleUrls.length === 1 &&
    ok.__addModuleUrls[0] === 'src/gate-worklet.js',
    'addModule fetched the worklet by page-relative URL, exactly once');

  check(g1.input.__connectsTo(g1.worklet) && g1.worklet.__connectsTo(g1.output),
    'topology: inputGain -> worklet -> outputSum');
  check(!g1.input.__connectsTo(g1.output),
    'placeholder edge inputGain -> outputSum is GONE after the splice');

  // A second gate: the cached module load means no second addModule.
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "g1", type: "gate", params: {}}, ' +
    '{id: "g2", type: "gate", params: {}}]);',
    ok
  );
  await settle();
  var g2 = vm.runInContext('window.AudioGraph.getNodeInstance("g2")', ok);
  check(!!g2 && !!g2.worklet && ok.__createdWorklets.length === 2 &&
    ok.__addModuleUrls.length === 1,
    'second gate gets a worklet; addModule still called once (per-context cache)');
  check(g2.input.__connectsTo(g2.worklet) && g2.worklet.__connectsTo(g2.output) &&
    !g2.input.__connectsTo(g2.output),
    'warm second gate replaces its known passthrough edge with the worklet topology');

  // A RECREATED AudioContext must re-addModule (registerProcessor state is
  // per-context); the stale loaded flag must not cause a bare constructor
  // call on the new context.
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
    'window.AudioGraph.buildGraph([{id: "g4", type: "gate", params: {}}]);',
    ok
  );
  await settle();
  var g4 = vm.runInContext('window.AudioGraph.getNodeInstance("g4")', ok);
  check(!!g4 && !!g4.worklet && ok.__addModuleUrls.length === 2,
    'a recreated AudioContext re-adds the module (loaded flag is per-context, no stale sync path)');

  // ------------------------------------------------------------------
  console.log('C. REAL AUDIOPARAM WIRING (applyParam -> AudioParamRamp)');
  // ------------------------------------------------------------------
  function apply(node, paramId, value) {
    ok.EffectCatalog.applyParam('gate', node, paramId, value);
  }

  apply(g1, 'threshold', -30);
  check(g1.worklet.__paramsById.threshold.value === -30,
    'applyParam threshold -> the REAL threshold AudioParam (ramped)');
  apply(g1, 'attack', 0.02);
  check(g1.worklet.__paramsById.attack.value === 0.02,
    'applyParam attack -> the REAL attack AudioParam');
  apply(g1, 'release', 0.4);
  check(g1.worklet.__paramsById.release.value === 0.4,
    'applyParam release -> the REAL release AudioParam');
  apply(g1, 'floor', -10);
  check(g1.worklet.__paramsById.floor.value === -10,
    'applyParam floor -> the REAL floor AudioParam');

  var unknownParamError = null;
  try {
    apply(g1, 'mix', 50);
  } catch (err) {
    unknownParamError = err;
  }
  check(unknownParamError && /unknown param/.test(unknownParamError.message) &&
    g1.worklet.__paramsById.floor.value === -10,
    'catalog rejects an unknown paramId without touching the live node');

  // Construction-time params land on the worklet's AudioParams directly.
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "g3", type: "gate", ' +
    'params: {threshold: -70, attack: 0.02, release: 0.4, floor: -10}}]);',
    ok
  );
  await settle();
  var g3 = vm.runInContext('window.AudioGraph.getNodeInstance("g3")', ok);
  check(g3.worklet.__paramsById.threshold.value === -70 &&
    g3.worklet.__paramsById.attack.value === 0.02 &&
    g3.worklet.__paramsById.release.value === 0.4 &&
    g3.worklet.__paramsById.floor.value === -10,
    'factory honors explicit threshold/attack/release/floor at construction');

  // ------------------------------------------------------------------
  console.log('D. THE ASYNC addModule WINDOW (placeholder -> splice)');
  // ------------------------------------------------------------------
  var df = createNodeSandbox({ module: 'deferred', ctorSite: 'global' });
  loadNodeSources(df);
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "d1", type: "gate", params: {}}]);',
    df
  );
  await settle();
  var d1 = vm.runInContext('window.AudioGraph.getNodeInstance("d1")', df);

  check(!!d1 && d1.worklet === null && d1.input.__connectsTo(d1.output),
    'before the module resolves: composite is a valid UNITY PASSTHROUGH (input -> output, no worklet)');
  check(df.__createdWorklets.length === 0 && df.__consoleErrors.length === 0,
    'no worklet node and no error while the module is in flight');

  // A live param change in the window is recorded and survives insertion.
  df.EffectCatalog.applyParam('gate', d1, 'threshold', -33);
  check(d1.worklet === null && d1.pendingParams.threshold === -33,
    'applyParam during the window is recorded (pending), not dropped');

  df.__resolveModule();
  await settle();
  check(!!d1.worklet && d1.input.__connectsTo(d1.worklet) &&
    d1.worklet.__connectsTo(d1.output) && !d1.input.__connectsTo(d1.output),
    'after resolution: worklet spliced in between the stable connect points');
  check(d1.worklet.__paramsById.threshold.value === -33 &&
    d1.worklet.__paramsById.floor.value === -40,
    'pending threshold applied at insertion; untouched params keep creation defaults');

  // ------------------------------------------------------------------
  console.log('E. FAILURE + CONSTRUCTOR-RESOLUTION VARIANTS');
  // ------------------------------------------------------------------
  var fl = createNodeSandbox({ module: 'fail', ctorSite: 'global' });
  loadNodeSources(fl);
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "f1", type: "gate", params: {}}]);',
    fl
  );
  await settle();
  var f1 = vm.runInContext('window.AudioGraph.getNodeInstance("f1")', fl);
  check(!!f1 && f1.worklet === null && f1.input.__connectsTo(f1.output),
    'addModule failure: gate stays a valid unity passthrough (loud, not dead)');
  check(fl.__consoleErrors.length === 1 && /failed to load/.test(fl.__consoleErrors[0]),
    'addModule failure: exactly one honest console diagnostic');
  var failApplyThrew = false;
  try {
    fl.EffectCatalog.applyParam('gate', f1, 'threshold', -20);
  } catch (err) {
    failApplyThrew = true;
  }
  check(!failApplyThrew && f1.pendingParams.threshold === -20,
    'applyParam in the failed state is still a safe no-throw no-op');

  var cp = createNodeSandbox({ module: 'ok', ctorSite: 'ctx' });
  loadNodeSources(cp);
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "c1", type: "gate", params: {}}]);',
    cp
  );
  await settle();
  var c1 = vm.runInContext('window.AudioGraph.getNodeInstance("c1")', cp);
  check(!!c1 && !!c1.worklet && c1.worklet.__processorName === 'noise-gate',
    'worklet constructor resolved from the context property (meter-taps form) when no global exists');

  // ------------------------------------------------------------------
  console.log('F. PRESET ROUND-TRIP (PresetSchema)');
  // ------------------------------------------------------------------
  var model = [
    { id: 'gn1', type: 'gain', params: { gainDb: -2 } },
    { id: 'gt1', type: 'gate', params: { threshold: -45, attack: 0.01, release: 0.3, floor: -20 } }
  ];
  var serialized = ok.PresetSchema.serialize('gate preset', model);
  var json = JSON.parse(JSON.stringify(serialized)); // wire-format survival
  var restored = ok.PresetSchema.deserialize(json);
  var gt1 = restored.nodes.filter(function (n) { return n.type === 'gate'; })[0];
  check(!!gt1, 'preset round-trip preserves the gate entry');
  check(gt1.params.threshold === -45 && gt1.params.attack === 0.01 &&
    gt1.params.release === 0.3 && gt1.params.floor === -20,
    'preset round-trip preserves threshold/attack/release/floor exactly');
  restored.nodes[1].params.threshold = 0;
  check(json.nodes[1].params.threshold === -45,
    'deserialize deep-copies (no aliasing into the stored preset)');
  var defPres = ok.PresetSchema.deserialize(
    JSON.parse(JSON.stringify(ok.PresetSchema.serialize('defaults', [
      { id: 'gt2', type: 'gate', params: {} }
    ])))
  );
  check(defPres.nodes[0].type === 'gate' && Object.keys(defPres.nodes[0].params).length === 0,
    'a default-params gate entry (params {}) round-trips');
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
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/gate-worklet.js'), 'utf8'), scope, {
    filename: 'src/gate-worklet.js'
  });
  return registered;
}

/** The exact float32 value stored for a dB level (measurement reference). */
function dbAmp(db) {
  return new Float32Array([Math.pow(10, db / 20)])[0];
}

function constDbBlock(db) {
  var amp = dbAmp(db);
  var a = new Float32Array(BLOCK);
  for (var i = 0; i < BLOCK; i++) {
    a[i] = amp;
  }
  return a;
}

function mkParams(o) {
  o = o || {};
  return {
    threshold: new Float32Array([o.threshold !== undefined ? o.threshold : -50]),
    attack: new Float32Array([o.attack !== undefined ? o.attack : 0.005]),
    release: new Float32Array([o.release !== undefined ? o.release : 0.15]),
    floor: new Float32Array([o.floor !== undefined ? o.floor : -40])
  };
}

/** Run blocks through the processor; returns per-block output arrays.
 *  A block is either an array of channel Float32Arrays (stereo) or a bare
 *  Float32Array (mono, normalized to one channel here). */
function drive(inst, blocks, params) {
  var outs = [];
  for (var b = 0; b < blocks.length; b++) {
    var inChs = Array.isArray(blocks[b]) ? blocks[b] : [blocks[b]];
    var output = [];
    for (var c = 0; c < inChs.length; c++) {
      output.push(new Float32Array(BLOCK));
    }
    inst.process([inChs], [output], params);
    outs.push(output);
  }
  return outs;
}

function outAt(outs, t, c) {
  return outs[Math.floor(t / BLOCK)][c || 0][t % BLOCK];
}

/** Measured gain in dB at global output index t against a known amplitude. */
function gainDbAt(outs, t, amp, c) {
  var v = outAt(outs, t, c);
  return v === 0 ? -Infinity : 20 * Math.log10(v / amp);
}

async function processorTests() {
  var registered = bootProcessorScope();

  // ------------------------------------------------------------------
  console.log('G. MODULE REGISTRATION + PARAMETER DESCRIPTORS');
  // ------------------------------------------------------------------
  check(typeof registered['noise-gate'] === 'function',
    'the module registers the "noise-gate" processor');
  var desc = registered['noise-gate'].parameterDescriptors;
  check(Array.isArray(desc) && desc.length === 4 &&
    desc[0].name === 'threshold' && desc[1].name === 'attack' &&
    desc[2].name === 'release' && desc[3].name === 'floor',
    'parameterDescriptors: exactly threshold/attack/release/floor');
  check(desc[0].defaultValue === -50 && desc[1].defaultValue === 0.005 &&
    desc[2].defaultValue === 0.15 && desc[3].defaultValue === -40,
    'descriptor defaults match D1 (-50 dB / 0.005 s / 0.15 s / -40 dB)');
  check(desc.every(function (d) { return d.automationRate === 'k-rate'; }),
    'all four params are k-rate (decision-grade constants)');
  check(desc[0].minValue === -80 && desc[0].maxValue === 0 &&
    desc[1].minValue === 0.001 && desc[1].maxValue === 0.5 &&
    desc[2].minValue === 0.01 && desc[2].maxValue === 2 &&
    desc[3].minValue === -60 && desc[3].maxValue === 0,
    'descriptor min/max match the D1 UI ranges');

  var ampL = dbAmp(-12.0412); // 0.25 nominal "loud vocal" level
  var ampT = dbAmp(-70);      // "silence" (room noise) tail level
  var stepDb = 40 / (0.005 * SR); // default attack slope, dB/sample

  // ------------------------------------------------------------------
  console.log('H. CLOSED AT REST + OPENS PAST THRESHOLD + ATTACK RAMP');
  // ------------------------------------------------------------------
  var inst1 = new registered['noise-gate']();
  var rest = drive(inst1, constBlocks(constDbBlock(-70), 40), mkParams());
  check(approx(gainDbAt(rest, 10 * BLOCK + 60, ampT), -40, 0.05),
    'a below-threshold signal is attenuated to exactly Floor (gate starts CLOSED; measured after delay wash-in)');

  var inst2 = new registered['noise-gate']();
  var opened = drive(inst2, constBlocks(constDbBlock(-12.0412), 20), mkParams());
  check(opened.length === 20, 'process() runs and returns (kept alive)');
  var openIdx = -1;
  for (var t = 0; t < 20 * BLOCK; t++) {
    if (gainDbAt(opened, t, ampL) >= -0.01) {
      openIdx = t;
      break;
    }
  }
  check(openIdx >= 239 && openIdx <= 241,
    'default attack reaches 0 dB in exactly 5 ms (' + 240 + ' samples; first-open index ' + openIdx + ')');
  check(approx(gainDbAt(opened, 20 * BLOCK - 1, ampL), 0, 0.005),
    'gate holds fully open on a sustained above-threshold signal');

  // ------------------------------------------------------------------
  console.log('I. LOOK-AHEAD: 5 ms DELAY + FULLY OPEN BEFORE THE TRANSIENT');
  // ------------------------------------------------------------------
  var imp = new Float32Array(BLOCK);
  imp[5] = 1.0;
  var inst3 = new registered['noise-gate']();
  var impOut = drive(inst3, [
    imp, constDbBlock(-Infinity), constDbBlock(-Infinity),
    constDbBlock(-Infinity), constDbBlock(-Infinity), constDbBlock(-Infinity)
  ], mkParams());
  var hits = [];
  for (var u = 0; u < 6 * BLOCK; u++) {
    if (Math.abs(outAt(impOut, u)) > 1e-9) {
      hits.push({ t: u, v: outAt(impOut, u) });
    }
  }
  check(hits.length === 1 && hits[0].t === 5 + LA_N,
    'a single impulse at input sample 5 emerges at output sample ' + (5 + LA_N) + ' (look-ahead = 5 ms exactly)');
  check(hits.length === 1 && approx(hits[0].v, 1.0, 1e-6),
    'the impulse passes at UNITY — the attack ramp beat it through the delay');

  // Silence, then onset: the ramp starts when DETECTED (block 1), so it
  // has the full 240-sample look-ahead lead and is complete one sample
  // before the onset emerges.
  var inst4 = new registered['noise-gate']();
  var onsetBlocks = [constDbBlock(-Infinity)];
  for (var ob = 0; ob < 30; ob++) {
    onsetBlocks.push(constDbBlock(-12.0412));
  }
  var onsetOut = drive(inst4, onsetBlocks, mkParams());
  var emergeT = 1 * BLOCK + LA_N; // input sample 128 emerges here
  check(outAt(onsetOut, emergeT - 1) === 0,
    'the sample before emergence is still the (silent) delayed input');
  check(approx(outAt(onsetOut, emergeT), ampL, 1e-6),
    'the onset sample emerges at FULL GAIN (gain hit 0 dB one sample earlier)');
  check(approx(gainDbAt(onsetOut, emergeT + 500, ampL), 0, 0.005),
    'gate stays open through the sustained note');

  // ------------------------------------------------------------------
  console.log('J. HOLD + RELEASE: closes on silence without chopping tails');
  // ------------------------------------------------------------------
  var inst5 = new registered['noise-gate']();
  var seq = [];
  for (var l = 0; l < 12; l++) {
    seq.push(constDbBlock(-12.0412));
  }
  for (var q = 0; q < 130; q++) {
    seq.push(constDbBlock(-70));
  }
  var tailOut = drive(inst5, seq, mkParams());
  var lastLoud = 12 * BLOCK - 1; // global index of the last loud sample

  check(gainDbAt(tailOut, lastLoud + Math.round(30 * SR / 1000), ampT) > -0.5,
    'gain is STILL FULLY OPEN 30 ms into silence (hold active, no chopped tail)');
  check(gainDbAt(tailOut, lastLoud + Math.round(40 * SR / 1000), ampT) > -0.5,
    '...and still open at 40 ms (envelope fall + hold both contribute)');
  var fallIdx = -1;
  for (var ft = lastLoud + LA_N; ft < 142 * BLOCK; ft++) {
    if (gainDbAt(tailOut, ft, ampT) < -0.5) {
      fallIdx = ft;
      break;
    }
  }
  check(fallIdx >= lastLoud + Math.round(55 * SR / 1000) &&
    fallIdx <= lastLoud + Math.round(85 * SR / 1000),
    'release starts 55-85 ms after the last loud sample (50 ms hold after the envelope crosses close)');
  var s1 = gainDbAt(tailOut, 6000, ampT);
  var s2 = gainDbAt(tailOut, 7000, ampT);
  check(approx(Math.abs(s2 - s1), 1000 * (40 / (0.15 * SR)), 1.5),
    'release ramp is dB-linear at the Release-param rate (~5.6 dB per 1000 samples; measured ' +
    Math.abs(s2 - s1).toFixed(2) + ')');
  check(approx(gainDbAt(tailOut, 13000, ampT), -40, 0.5),
    'gain lands exactly on Floor (-40 dB) after the release window');
  var minGain = 0;
  for (var mt = lastLoud + LA_N; mt < 142 * BLOCK; mt++) {
    var g = gainDbAt(tailOut, mt, ampT);
    if (g !== -Infinity && g < minGain) {
      minGain = g;
    }
  }
  check(minGain >= -40.5,
    'gain never overshoots below Floor (clamped at ' + minGain.toFixed(2) + ' dB)');

  // Re-open after a full close (re-trigger from Floor).
  var inst6 = new registered['noise-gate']();
  var reseq = [];
  for (var l2 = 0; l2 < 12; l2++) {
    reseq.push(constDbBlock(-12.0412));
  }
  for (var q2 = 0; q2 < 100; q2++) {
    reseq.push(constDbBlock(-70));
  }
  for (var l3 = 0; l3 < 20; l3++) {
    reseq.push(constDbBlock(-12.0412));
  }
  var reOut = drive(inst6, reseq, mkParams());
  var reOnset = (12 + 100) * BLOCK;
  check(approx(gainDbAt(reOut, reOnset - 640, ampT), -40, 0.5),
    'before the re-onset the gate sits at Floor');
  // The attack ramp is directly measurable HERE: while it runs, the
  // (delayed) audio is still the tail, so gain = out/tailAmp per sample.
  check(approx(gainDbAt(reOut, reOnset + 120, ampT), -40 + 121 * stepDb, 0.2),
    'attack ramp is dB-linear: halfway in time = halfway in dB (~-20 dB at 2.5 ms into the ramp)');
  check(approx(
    Math.abs(gainDbAt(reOut, reOnset + 180, ampT) - gainDbAt(reOut, reOnset + 60, ampT)),
    120 * stepDb, 0.2),
    'attack slope is constant (120*step dB over 120 samples, no level-dependent speed error)');
  check(gainDbAt(reOut, reOnset + 800, ampL) > -0.05,
    'a new onset re-opens the gate from Floor (attack ramp, no latch-out)');

  // ------------------------------------------------------------------
  console.log('K. HYSTERESIS: the 6 dB band holds state (no chatter)');
  // ------------------------------------------------------------------
  // Threshold -20: open at -20, close below -26. Band signal = -22 dB.
  var inst7 = new registered['noise-gate']();
  var ampA = dbAmp(-12);
  var ampB = dbAmp(-22);
  var ampC = dbAmp(-30);
  var hBlocks = [];
  var phaseStart = {};
  function pushPhase(name, db, n) {
    phaseStart[name] = hBlocks.length * BLOCK;
    for (var i = 0; i < n; i++) {
      hBlocks.push(constDbBlock(db));
    }
  }
  pushPhase('A', -12, 30);
  pushPhase('B', -22, 40);
  pushPhase('C', -30, 120);
  pushPhase('D', -22, 40);
  pushPhase('E', -12, 30);
  var hOut = drive(inst7, hBlocks, mkParams({ threshold: -20 }));

  function phaseGainRange(name, amp) {
    var lo = Infinity;
    var hi = -Infinity;
    var from = phaseStart[name] + LA_N; // delayed audio washed in
    var to = (name === 'E' ? hBlocks.length * BLOCK : phaseStartNext(name)) - 1;
    for (var t = from; t <= to; t++) {
      var g = gainDbAt(hOut, t, amp);
      if (g === -Infinity) {
        continue;
      }
      if (g < lo) {
        lo = g;
      }
      if (g > hi) {
        hi = g;
      }
    }
    return { lo: lo, hi: hi };
  }
  function phaseStartNext(name) {
    var order = ['A', 'B', 'C', 'D', 'E'];
    return phaseStart[order[order.indexOf(name) + 1]];
  }

  check(phaseGainRange('A', ampA).hi > -0.05 && phaseGainRange('A', ampA).hi < 0.05,
    'phase A (-12 dB, above threshold): gate opens to unity');
  var rngB = phaseGainRange('B', ampB);
  check(rngB.lo > -0.05,
    'phase B (-22 dB, INSIDE the hysteresis band): an OPEN gate STAYS OPEN (min ' + rngB.lo.toFixed(3) + ' dB — no chatter)');
  var rngC = phaseGainRange('C', ampC);
  check(approx(rngC.lo, -40, 0.5) && approx(rngC.hi, 0, 0.5),
    'phase C (-30 dB, below close): gate closes to Floor after hold+release');
  var rngD = phaseGainRange('D', ampB);
  check(rngD.hi < -39.5,
    'phase D (-22 dB, band again, from CLOSED): gate STAYS CLOSED (max ' + rngD.hi.toFixed(2) + ' dB)');
  check(approx(phaseGainRange('E', ampA).hi, 0, 0.05),
    'phase E (-12 dB): gate re-opens (re-trigger works after a band-close cycle)');

  // ------------------------------------------------------------------
  console.log('L. FLOOR PARAM + BIT-EXACT PASSTHROUGH AT FLOOR 0');
  // ------------------------------------------------------------------
  var inst8 = new registered['noise-gate']();
  var fOut = drive(inst8, constBlocks(constDbBlock(-70), 40), mkParams({ floor: -55 }));
  check(approx(gainDbAt(fOut, 39 * BLOCK + 60, ampT), -55, 0.05),
    'Floor -55: closed attenuation is exactly -55 dB (any in-range Floor)');

  var inst9 = new registered['noise-gate']();
  var total = 60 * BLOCK;
  var waveIn = new Float32Array(total);
  for (var w = 0; w < total; w++) {
    waveIn[w] = 0.6 * Math.sin(0.05 * w) + 0.3 * Math.sin(0.013 * w);
  }
  var waveBlocks = [];
  for (var wb = 0; wb < 60; wb++) {
    waveBlocks.push(waveIn.subarray(wb * BLOCK, (wb + 1) * BLOCK));
  }
  var pOut = drive(inst9, waveBlocks, mkParams({ floor: 0 }));
  var bitwise = true;
  for (var pt = LA_N; pt < total; pt++) {
    if (outAt(pOut, pt) !== waveIn[pt - LA_N]) {
      bitwise = false;
      break;
    }
  }
  check(bitwise,
    'Floor 0 dB: output === input delayed by exactly 5 ms, BIT-EXACT (x * 1.0; bypass-clean aid)');
  var headZero = true;
  for (var hz = 0; hz < LA_N; hz++) {
    if (outAt(pOut, hz) !== 0) {
      headZero = false;
    }
  }
  check(headZero, 'the first 5 ms of output is the (zero) delay-line warm-up, unity gain throughout');

  // ------------------------------------------------------------------
  console.log('M. MULTI-CHANNEL + STRONGEST-CHANNEL DETECTOR');
  // ------------------------------------------------------------------
  var inst10 = new registered['noise-gate']();
  var stereoBlocks = [];
  for (var sb = 0; sb < 30; sb++) {
    stereoBlocks.push([constDbBlock(-12.0412), constDbBlock(-26.0206)]); // 0.25 / 0.05
  }
  var stOut = drive(inst10, stereoBlocks, mkParams());
  var ratioOk = true;
  for (var st = LA_N; st < 30 * BLOCK; st += 7) {
    var a0 = outAt(stOut, st, 0);
    var a1 = outAt(stOut, st, 1);
    if (a0 === 0 || Math.abs(a1 / a0 - 0.2) > 1e-6) {
      ratioOk = false;
      break;
    }
  }
  check(ratioOk,
    'both channels get the IDENTICAL per-sample gain (stereo stays time/level aligned)');

  var inst11 = new registered['noise-gate']();
  var detBlocks = [];
  for (var db2 = 0; db2 < 30; db2++) {
    detBlocks.push([constDbBlock(-70), constDbBlock(-12.0412)]); // ch0 silent-ish, ch1 loud
  }
  var detOut = drive(inst11, detBlocks, mkParams());
  check(approx(gainDbAt(detOut, 29 * BLOCK + 60, 0.25, 1), 0, 0.1),
    'a loud right channel opens the gate even when the left channel is quiet');

  var rightOnlyBlocks = [];
  var monoReferenceBlocks = [];
  var oppositeBlocks = [];
  for (var channelBlock = 0; channelBlock < 30; channelBlock++) {
    var voice = constDbBlock(channelBlock === 0 ? -Infinity : -18);
    var inverseVoice = Float32Array.from(voice, function (sample) { return -sample; });
    monoReferenceBlocks.push(voice);
    rightOnlyBlocks.push([constDbBlock(-Infinity), voice]);
    oppositeBlocks.push([voice, inverseVoice]);
  }
  var channelParams = mkParams({ threshold: -20 });
  var monoReference = drive(new registered['noise-gate'](), monoReferenceBlocks, channelParams);
  var rightOnly = drive(new registered['noise-gate'](), rightOnlyBlocks, channelParams);
  var opposite = drive(new registered['noise-gate'](), oppositeBlocks, channelParams);
  var rightMatchesMono = true;
  var oppositeMatchesMono = true;
  var silentLeft = true;
  for (var channelSample = 0; channelSample < 30 * BLOCK; channelSample++) {
    var monoSample = outAt(monoReference, channelSample);
    rightMatchesMono = rightMatchesMono && outAt(rightOnly, channelSample, 1) === monoSample;
    silentLeft = silentLeft && outAt(rightOnly, channelSample, 0) === 0;
    oppositeMatchesMono = oppositeMatchesMono && outAt(opposite, channelSample, 0) === monoSample &&
      outAt(opposite, channelSample, 1) === -monoSample;
  }
  check(rightMatchesMono && gainDbAt(rightOnly, 29 * BLOCK + 60, dbAmp(-18), 1) > -0.05,
    'right-only input near threshold has the same onset, look-ahead, and gain as mono (no 6 dB dilution)');
  check(silentLeft, 'right-only input leaves the silent left channel silent');
  check(oppositeMatchesMono && gainDbAt(opposite, 29 * BLOCK + 60, dbAmp(-18), 0) > -0.05,
    'opposite-polarity channels open without cancellation and retain one identical gain');

  // ------------------------------------------------------------------
  console.log('N. K-RATE PARAM CHANGES + EMPTY INPUT');
  // ------------------------------------------------------------------
  var inst12 = new registered['noise-gate']();
  var kAmp = dbAmp(-42);
  var kOut1 = drive(inst12, constBlocks(constDbBlock(-42), 40), mkParams());
  check(gainDbAt(kOut1, 39 * BLOCK + 60, kAmp) > -0.05,
    'at threshold -50 a -42 dB signal opens the gate');
  var kOut2 = drive(inst12, constBlocks(constDbBlock(-42), 120), mkParams({ threshold: -30 }));
  check(approx(gainDbAt(kOut2, 119 * BLOCK + 60, kAmp), -40, 0.5),
    'raising threshold to -30 mid-stream closes it (hold + release respected)');
  var kOut3 = drive(inst12, constBlocks(constDbBlock(-42), 40), mkParams());
  check(gainDbAt(kOut3, 39 * BLOCK + 60, kAmp) > -0.05,
    'lowering threshold back to -50 re-opens it (k-rate value read every block)');

  var emptyOk = true;
  var emptyOut = new Float32Array(BLOCK);
  try {
    var r1 = inst12.process([[]], [[emptyOut]], mkParams());
    var r2 = inst12.process([], [[emptyOut]], mkParams());
    emptyOk = r1 === true && r2 === true;
    for (var ez = 0; ez < BLOCK; ez++) {
      if (emptyOut[ez] !== 0) {
        emptyOk = false;
      }
    }
  } catch (err) {
    emptyOk = false;
  }
  check(emptyOk,
    'empty/absent input: process() returns true and outputs zeros (no crash, stays alive)');
}

/** N copies of one block (constant-level phase helper). */
function constBlocks(block, n) {
  var arr = [];
  for (var i = 0; i < n; i++) {
    arr.push(block);
  }
  return arr;
}

async function main() {
  await nodeLevelTests();
  await processorTests();

  console.log('');
  if (failures.length === 0) {
    console.log('GATE-1 node tests: all checks passed');
    process.exit(0);
  }
  console.log('GATE-1 node tests: ' + failures.length + ' FAIL');
  process.exit(1);
}

main().catch(function (err) {
  console.error('CRASH:', err);
  process.exit(1);
});
