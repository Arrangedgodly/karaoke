// ToneAdapter contract test — the adapter layer Tone-backed node types
// register through (src/tone-adapter.js), plus the dispose hook it depends
// on in AudioGraph.buildGraph()'s Phase-2 teardown.
//
// Same committed-test convention as the rest of the suite: a
// ZERO-dependency Node harness — no npm install, no build step — that
// stubs `window` plus the minimal Web Audio surface the src files touch,
// then loads the REAL src files (fs.readFileSync + vm.runInContext) into
// that sandbox, so the code under test is exactly what ships in
// index.html:
//
//   src/effect-catalog.js (the complete effect definition registry)
//   src/audio-graph.js    (buildGraph + the dispose teardown hook)
//   src/tone-adapter.js   (the adapter under test)
//
// window.Tone is stubbed to exactly the surface the adapter touches
// (getContext/setContext/connect), so the adapter's Tone interop is
// asserted at the CALL level (who connected what to what) — the DSP side
// of the same interop is verified for real in headless Chrome (see
// tests/browser-probe.js and the smoke round recorded in the repo docs).
//
// Run from a clean clone:  node tests/test-tone-adapter.js
// Exits 0 on pass, 1 on any failure.

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

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// buildGraph() commits on the deferred rewire (FADE_S*1000 + 5 = ~20ms).
function settle() {
  return sleep(60);
}

// ----------------------------------------------------------------------
// Minimal Web Audio stubs (same shapes as the rest of the suite).
// ----------------------------------------------------------------------
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
    __disconnectCalls: 0,
    connect: function (dest) {
      this.__connectionsTo.push(dest);
    },
    disconnect: function (dest) {
      this.__disconnectCalls += 1;
      if (dest === undefined) {
        this.__connectionsTo = [];
      } else {
        var i = this.__connectionsTo.indexOf(dest);
        if (i !== -1) {
          this.__connectionsTo.splice(i, 1);
        }
      }
    },
    __connectsTo: function (dest) {
      return this.__connectionsTo.indexOf(dest) !== -1;
    }
  };
}

function makeGainNode() {
  var node = makeBaseNode('GainNode');
  node.gain = makeParam(1);
  return node;
}

// A fake Tone effect node: what config.create() returns in this test. Its
// dispose() records being called — the assertion the teardown hook cares
// about — and it carries a rampable param so rampParam dispatch is
// observable on it too.
function makeFakeToneNode() {
  var disposed = false;
  var node = {
    __isFakeToneNode: true,
    ramps: [],
    wet: {
      rampTo: function (v, t) {
        node.ramps.push({ param: 'wet', value: v, rampTime: t });
      }
    },
    dispose: function () {
      disposed = true;
    },
    __wasDisposed: function () {
      return disposed;
    }
  };
  return node;
}

// The Tone stub: exactly the adapter's surface. connect() records edges;
// setContext()/getContext() model the rawContext identity contract.
function installToneStub(sandbox) {
  var calls = { setContext: [], connect: [] };
  var currentRaw = null;
  sandbox.Tone = {
    getContext: function () {
      return { rawContext: currentRaw };
    },
    setContext: function (ctx) {
      currentRaw = ctx;
      calls.setContext.push(ctx);
    },
    connect: function (src, dst) {
      calls.connect.push({ src: src, dst: dst });
      return dst;
    }
  };
  sandbox.__toneCalls = calls;
}

function createSandbox() {
  var sandbox = {
    console: console,
    setTimeout: function (fn, ms) {
      return setTimeout(fn, ms);
    },
    clearTimeout: function (id) {
      return clearTimeout(id);
    },
    setInterval: function (fn, ms) {
      return setInterval(fn, ms);
    },
    clearInterval: function (id) {
      return clearInterval(id);
    },
    document: {
      getElementById: function () {
        return null;
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: {
      currentTime: 0,
      destination: makeBaseNode('AudioDestinationNode'),
      createGain: makeGainNode
    },
    sourceNode: makeBaseNode('MediaStreamAudioSourceNode')
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// The throw a validation case produced, for assert-threw checks.
function captureThrow(fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return e;
  }
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  // NOTE: no window.Tone yet — section B asserts registration is Tone-free.
  loadSrc(sandbox, 'src/effect-catalog.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/tone-adapter.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js'); // node-gain's applyParam ramps through it
  loadSrc(sandbox, 'src/node-gain.js');

  var AG = sandbox.AudioGraph;
  var catalog = sandbox.EffectCatalog;
  var TA = sandbox.ToneAdapter;

  // --------------------------------------------------------------------
  console.log('A. register(): validation errors (loud, at registration time)');
  // --------------------------------------------------------------------

  check(!!TA && typeof TA.register === 'function', 'A1: ToneAdapter exports register()');
  check(
    captureThrow(function () { TA.register('', {}); }) !== null,
    'A1: empty type rejected'
  );
  check(
    captureThrow(function () { TA.register('x'); }) !== null,
    'A1: missing config rejected'
  );
  check(
    captureThrow(function () { TA.register('x', { label: 'X', paramSpec: [], create: function () {} }); }) !== null,
    'A1: empty paramSpec rejected'
  );
  check(
    captureThrow(function () { TA.register('x', { label: 'X', paramSpec: [{ id: 'a', default: 1 }], create: null }); }) !== null,
    'A1: missing create rejected'
  );

  // --------------------------------------------------------------------
  console.log('B. registration works WITHOUT window.Tone (harness safety)');
  // --------------------------------------------------------------------

  TA.register('probe', {
    label: 'Probe',
    plainLabel: 'Test plain label',
    paramSpec: [
      { id: 'amount', label: 'Amount', min: 0, max: 100, default: 40, step: 1, unit: '%' }
    ],
    create: function () {
      throw new Error('test bug: create must not run in section B');
    }
  });
  check(catalog.getAllTypes().indexOf('probe') !== -1, 'B1: type listed in EffectCatalog without Tone loaded');
  check(catalog.getLabel('probe') === 'Probe', 'B1: label registered');
  check(catalog.getParamSpec('probe').length === 1 && catalog.getParamSpec('probe')[0].id === 'amount', 'B1: paramSpec registered');
  var factoryErr = captureThrow(function () {
    sandbox.AudioGraph; // presence
    // Reach the factory through buildGraph's Phase-1 resolution.
    AG.buildGraph([{ id: 'p1', type: 'probe', params: {} }]);
  });
  // buildGraph defers Phase 2 but Phase 1 throws synchronously without Tone.
  check(factoryErr !== null && /window\.Tone is not loaded/.test(String(factoryErr.message)),
    'B2: factory without Tone throws the clear vendor-script error (got: ' + (factoryErr && factoryErr.message) + ')');

  // --------------------------------------------------------------------
  console.log('C. factory: context sharing + composite shape (stubbed Tone)');
  // --------------------------------------------------------------------

  installToneStub(sandbox);
  var toneCalls = sandbox.__toneCalls;
  var createdWith = [];
  var fakeTone = null;

  TA.register('echo', {
    label: 'Echo',
    plainLabel: 'Test plain label',
    experimental: true,
    paramSpec: [
      { id: 'rate', label: 'Rate', min: 0, max: 10, default: 5, step: 0.5, unit: 'Hz',
        set: function (node, v) { TA.rampParam(node.wet, v); } },
      { id: 'amount', label: 'Amount', min: 0, max: 100, default: 40, step: 1, unit: '%' }
    ],
    create: function (audioContext, resolved) {
      createdWith.push({ audioContext: audioContext, resolved: Object.assign({}, resolved) });
      fakeTone = makeFakeToneNode();
      return fakeTone;
    }
  });

  var ctx = sandbox.AudioEngine.audioContext;
  AG.buildGraph([{ id: 'e1', type: 'echo', params: { amount: 80 } }]);
  await settle();

  check(toneCalls.setContext.length === 1 && toneCalls.setContext[0] === ctx,
    'C1: first factory run pointed Tone at the app AudioContext (exactly once)');
  check(createdWith.length === 1 && createdWith[0].audioContext === ctx,
    'C1: create() received the app AudioContext');
  check(
    createdWith.length === 1 &&
    createdWith[0].resolved.amount === 80 &&
    createdWith[0].resolved.rate === 5,
    'C1: params resolved — present value 80 kept, missing rate defaulted to 5'
  );

  var comp = AG.getNodeInstance('e1');
  check(!!comp && comp.tone === fakeTone, 'C2: composite exposes the Tone node as .tone');
  check(!!comp && comp.input && comp.input.__nodeTypeName === 'GainNode', 'C2: composite .input is a native GainNode');
  check(!!comp && comp.output && comp.output.__nodeTypeName === 'GainNode', 'C2: composite .output is a native GainNode');
  check(comp.input.gain.value === 1 && comp.output.gain.value === 1, 'C2: wrapper gains are unity');
  check(
    toneCalls.connect.some(function (c) { return c.src === comp.input && c.dst === fakeTone; }) &&
    toneCalls.connect.some(function (c) { return c.src === fakeTone && c.dst === comp.output; }),
    'C2: Tone.connect wired input->effect and effect->output'
  );
  check(typeof comp.dispose === 'function', 'C2: composite carries dispose()');
  check(
    sandbox.AudioEngine.sourceNode.__connectsTo(comp.input) && comp.output.__connectsTo(AG.getChainGate()),
    'C2: buildGraph wired sourceNode->composite.input and composite.output->chainGate (AE-7 shape)'
  );
  check(catalog.isExperimental('echo'), 'C3: experimental flag flows to EffectCatalog');
  check(!catalog.isExperimental('gain') && !catalog.isExperimental('probe'), 'C3: absent flag means not experimental');
  check(
    catalog.getLatencySeconds('echo') === 0 && catalog.getLatencySeconds('probe') === 0,
    'C4: latencySeconds defaults to 0 when a Tone-backed type declares none'
  );

  TA.register('granular-echo', {
    label: 'Granular Echo',
    plainLabel: 'Test plain label',
    latencySeconds: 0.1,
    paramSpec: [
      { id: 'amount', label: 'Amount', min: 0, max: 100, default: 40, step: 1, unit: '%' }
    ],
    create: function () {
      return makeFakeToneNode();
    }
  });
  check(
    catalog.getLatencySeconds('granular-echo') === 0.1,
    'C5: a declared latencySeconds flows from ToneAdapter.register into EffectCatalog'
  );

  // --------------------------------------------------------------------
  console.log('D. applyParam dispatch + paramSpec hygiene');
  // --------------------------------------------------------------------

  catalog.applyParam('echo', comp, 'rate', 7);
  check(
    fakeTone.ramps.length === 1 &&
    fakeTone.ramps[0].param === 'wet' &&
    fakeTone.ramps[0].value === 7 &&
    Math.abs(fakeTone.ramps[0].rampTime - 0.015) < 1e-9,
    'D1: set() dispatched with (toneNode, value); rampParam ramped 7 over 15 ms'
  );
  catalog.applyParam('echo', comp, 'amount', 90);
  check(fakeTone.ramps.length === 1, 'D1: param without a set helper is a defensive no-op');
  var unknownParamError = captureThrow(function () {
    catalog.applyParam('echo', comp, 'nonsense', 1);
  });
  check(unknownParamError !== null && /unknown param/.test(unknownParamError.message),
    'D1: unknown paramId is rejected by the catalog boundary');
  catalog.applyParam('echo', null, 'rate', 8);
  check(fakeTone.ramps.length === 1, 'D1: null instance is a defensive no-op');

  var specEcho = catalog.getParamSpec('echo');
  var specHasSet = specEcho.some(function (s) { return typeof s.set === 'function'; });
  check(!specHasSet, 'D2: registered paramSpec carries NO set functions (metadata stays data)');
  check(
    specEcho[0].id === 'rate' && specEcho[0].min === 0 && specEcho[0].max === 10 &&
    specEcho[0].default === 5 && specEcho[0].unit === 'Hz',
    'D2: standard spec fields pass through verbatim'
  );

  // --------------------------------------------------------------------
  console.log('E. ensureToneContext: steady-state no-op, re-point on new context');
  // --------------------------------------------------------------------

  // A rebuild that REUSES the echo instance must not re-point anything.
  AG.buildGraph([{ id: 'e1', type: 'echo', params: { amount: 80 } }]);
  await settle();
  check(toneCalls.setContext.length === 1, 'E1: reuse rebuild did not call setContext again');
  check(AG.getNodeInstance('e1') === comp, 'E1: same composite instance reused (===)');
  check(!fakeTone.__wasDisposed(), 'E1: reused Tone node NOT disposed');

  // A NEW adapter-typed id on the same context: create runs, setContext
  // must NOT (rawContext already matches).
  AG.buildGraph([
    { id: 'e1', type: 'echo', params: {} },
    { id: 'e2', type: 'echo', params: {} }
  ]);
  await settle();
  var comp2 = AG.getNodeInstance('e2');
  check(!!comp2 && comp2 !== comp, 'E2: second echo factory-created a new composite');
  check(createdWith.length === 2, 'E2: second factory run created a new Tone node');
  check(toneCalls.setContext.length === 1, 'E2: same context — setContext stayed a no-op');

  // Context recreation (fresh AudioEngine.start after context loss): the
  // next FACTORY call (fresh id — a reused instance never re-factories)
  // re-points Tone at the NEW context. This rebuild also drops e1/e2, so
  // their composites feed section F's dispose assertions.
  var ctx2 = {
    currentTime: 0,
    destination: makeBaseNode('AudioDestinationNode'),
    createGain: makeGainNode
  };
  sandbox.AudioEngine.audioContext = ctx2;
  AG.buildGraph([{ id: 'e3', type: 'echo', params: {} }]);
  await settle();
  check(
    toneCalls.setContext.length === 2 && toneCalls.setContext[1] === ctx2,
    'E3: context change re-pointed Tone exactly once at the new context'
  );

  // --------------------------------------------------------------------
  console.log('F. buildGraph teardown disposes DROPPED adapter instances only');
  // --------------------------------------------------------------------

  check(comp.tone.__wasDisposed() && comp2.tone.__wasDisposed(),
    'F1: e1 and e2 (dropped by the E3 rebuild) had dispose() called — Tone nodes released');
  var live = AG.getNodeInstance('e3');
  check(live && live !== comp && live !== comp2, 'F1: live instance is the fresh e3 composite');
  check(!live.tone.__wasDisposed(), 'F1: carried-forward/live Tone node NOT disposed');

  // Type-change on the same id: old adapter instance dropped + disposed,
  // fresh factory instance takes its place.
  AG.buildGraph([{ id: 'e3', type: 'gain', params: { gainDb: 0 } }]);
  await settle();
  check(live.tone.__wasDisposed(), 'F2: id-same-type-changed old adapter instance disposed');
  check(
    AG.getNodeInstance('e3') && AG.getNodeInstance('e3').__nodeTypeName === 'GainNode',
    'F2: fresh native instance built in its place'
  );

  // Native-only sanity: the dispose hook is inert for plain AudioNodes
  // (no dispose method exists on them — nothing to call, nothing thrown).
  var gainErr = null;
  try {
    AG.buildGraph([{ id: 'g2', type: 'gain', params: {} }]);
    await settle();
    AG.buildGraph([]);
    await settle();
  } catch (e) {
    gainErr = e;
  }
  check(gainErr === null, 'F3: native teardown path unchanged (no dispose, no error)');

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: ToneAdapter contract (composite/context/dispatch/dispose)');
    return 0;
  }
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (label) {
    console.log('  - ' + label);
  });
  return 1;
}

main().then(
  function (code) {
    process.exit(code);
  },
  function (err) {
    console.error('FAIL: harness threw: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
);
