// Test for cycle-3 QA-2 — REGRESSION: the six legacy effects' behavior is
// unchanged everywhere cycle-3 touched shared code, and the loudness-safety
// net holds with the four new nodes in the chain.
//
// QA-2's regression scope (docs/ultron/plan.md, cycle 3):
//   1. gain/EQ/compressor/limiter/delay/reverb unchanged in behavior.
//   2. watchdog + limiter safety net intact with the new nodes in chain.
//   3. chain-level Bypass still bypasses a chain containing all four.
//
// This file covers the leak surfaces that live in SHARED code, i.e. every
// place a cycle-3 edit could plausibly change a LEGACY type's semantics:
//   A. REGISTRY — with only the six legacy node files loaded (the exact
//      pre-cycle-3 registry shape), getAllTypes()/paramSpec/isExperimental
//      are what they were: six types, all-slider numeric specs, nothing
//      experimental. With all TEN loaded, isExperimental() is true for
//      autotune ONLY (the MCP-1 single source of truth).
//   B. PARAM-CONTROLS — the UI-1 discrete branch is keyed strictly on
//      `spec.values`: every legacy param still renders a range slider and
//      still commits parseFloat(input.value) as a NUMBER through
//      AudioGraph.updateNodeParams + NodeTypes.applyParam (recorded at the
//      registry boundary — the exact pre-cycle-3 pipeline).
//   C. PRESET DATA — preset-schema's PRE-1 validation is scoped to the four
//      declared cycle-3 types: legacy entries keep structure-only treatment
//      (a hostile legacy preset with unknown params / out-of-range numbers
//      / string values still LOADS, while the same abuse on autotune is
//      rejected — the differential proof the tightening is scoped).
//      serialize() emits no new fields for legacy chains (round-trip is
//      JSON-byte-stable), and the shipped DEFAULT_PRESET is still exactly
//      PX-3's committed six-node chain (PRE-1's "default chain UNCHANGED").
//   D. MCP STRING PARAMS — MCP-1 made discrete strings legal; this verifies
//      the OTHER side of that door: a string on a LEGACY numeric param is
//      still refused INVALID_ARGUMENTS through set_param AND set_chain
//      (nothing applied, no undo), while a legal discrete string ('F#' on
//      autotune key) applies in the same boot. The terminal-limiter policy
//      holds on a chain containing ALL FOUR new effects: add-after-limiter,
//      limiter removal, and a non-terminal limiter are all refused with the
//      model, the physical instances, and the undo stack untouched.
//   E. PALETTE/CSS — styles/main.css's six legacy --family-* tokens are
//      byte-identical to the cycle-2 committed values (UI-2 was allowed to
//      ADD four tokens, not retune the existing six); the four new tokens
//      are present.
//
// What is deliberately NOT re-run here, cited instead (the suite's own
// green run is the evidence):
//   - legacy node FACTORIES + buildGraph routing + reuse/type-match:
//     tests/test-node-reuse-type-match.js, tests/test-audio-lifecycle.js;
//   - watchdog tap point + latch + hidden-tab cadence (legacy chain):
//     tests/test-watchdog-tap-and-latch.js, tests/test-hidden-tab-watchdog.js;
//   - safety refusals on the default chain: tests/test-safety-refusals.js;
//   - legacy preset byte-unchanged loads + factory policy:
//     tests/test-preset-cycle3.js, tests/test-factory-presets-policy.js;
//   - legacy chips/cards badge-free rendering: tests/test-palette-cards-
//     cycle3.js (sections B/C/F: no badge on any legacy surface);
//   - AUDIO identity (the six legacy effects' rendered samples bit-exact
//     with vs without the cycle-3 modules loaded) and chain-level BYPASS
//     over an all-ten chain, and the WATCHDOG tripping/latching over a
//     chain containing all four new nodes: these need the offline render
//     harness — tests/qa-out/run-qa2.js (report: tests/qa-out/qa2-report.txt),
//     same convention as QA-1's run-qa1.js.
//
// Same committed-test convention as the rest of the suite: zero-dependency
// Node harness, stub `window` + minimal DOM/Web Audio, load the REAL src
// files (fs.readFileSync + vm.runInContext).
//
// Run from a clean clone:  node tests/test-regression-cycle3.js
// (or via the runner:      node tests/run.js regression-cycle3)
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

// ----------------------------------------------------------------------
// Assertions: collect failures so one run reports everything, exit 1 at
// the end if any check failed. (Same harness shape as the other tests.)
// ----------------------------------------------------------------------
var failures = [];

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

function approx(a, b) {
  return Math.abs(a - b) < 1e-9;
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// buildGraph() commits its instance map + model on the deferred rewire
// (FADE_S*1000 + 5 = ~20ms after the call); the worklet factories'
// placeholder+splice resolves on the same scale. 80ms settles both.
function settle() {
  return sleep(80);
}

function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  var ka = Object.keys(a);
  var kb = Object.keys(b);
  if (ka.length !== kb.length) {
    return false;
  }
  for (var i = 0; i < ka.length; i++) {
    if (!deepEqual(a[ka[i]], b[ka[i]])) {
      return false;
    }
  }
  return true;
}

var LEGACY_TYPES = ['gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter'];
var NEW_TYPES = ['distortion', 'chorus', 'gate', 'autotune'];

// ----------------------------------------------------------------------
// Minimal Web Audio / DOM stubs (the suite's shared shapes).
// ----------------------------------------------------------------------

// Automation-recording AudioParam. setValueAtTime/ramps WRITE .value (the
// QA-1 harness convention) so read-backs match what the browser arrives at
// after a ramp; every call is also logged for "was an upward ramp
// scheduled" style assertions.
function makeParam(initial) {
  var param = {
    value: initial,
    __automation: [],
    cancelScheduledValues: function () {
      param.__automation.push({ type: 'cancel', target: null });
    },
    setValueAtTime: function (v) {
      param.__automation.push({ type: 'setValue', target: v });
      param.value = v;
    },
    linearRampToValueAtTime: function (v) {
      param.__automation.push({ type: 'linearRamp', target: v });
      param.value = v;
    },
    setTargetAtTime: function (v) {
      param.__automation.push({ type: 'setTarget', target: v });
      param.value = v;
    },
    exponentialRampToValueAtTime: function (v) {
      param.__automation.push({ type: 'exponentialRamp', target: v });
      param.value = v;
    }
  };
  return param;
}

function makeBaseNode(typeName) {
  var node = {
    __nodeTypeName: typeName,
    __connectionsTo: [],
    __connectionsFrom: [],
    connect: function (dest) {
      node.__connectionsTo.push(dest);
      if (dest && dest.__connectionsFrom) {
        dest.__connectionsFrom.push(node);
      }
      return dest;
    },
    disconnect: function (dest) {
      if (dest === undefined) {
        node.__connectionsTo.forEach(function (d) {
          var j = d.__connectionsFrom ? d.__connectionsFrom.indexOf(node) : -1;
          if (j !== -1) {
            d.__connectionsFrom.splice(j, 1);
          }
        });
        node.__connectionsTo = [];
        return;
      }
      var i = node.__connectionsTo.indexOf(dest);
      if (i !== -1) {
        node.__connectionsTo.splice(i, 1);
      }
      if (dest && dest.__connectionsFrom) {
        var j2 = dest.__connectionsFrom.indexOf(node);
        if (j2 !== -1) {
          dest.__connectionsFrom.splice(j2, 1);
        }
      }
    }
  };
  return node;
}

function makeGainNode() {
  var n = makeBaseNode('GainNode');
  n.gain = makeParam(1);
  return n;
}

function makeBiquadNode() {
  var n = makeBaseNode('BiquadFilterNode');
  n.type = 'lowpass';
  n.frequency = makeParam(350);
  n.Q = makeParam(1);
  n.gain = makeParam(0);
  return n;
}

function makeDelayNode() {
  var n = makeBaseNode('DelayNode');
  n.delayTime = makeParam(0);
  return n;
}

function makeWaveShaperNode() {
  var n = makeBaseNode('WaveShaperNode');
  n.curve = null;
  n.oversample = 'none';
  return n;
}

function makeOscillatorNode() {
  var n = makeBaseNode('OscillatorNode');
  n.type = 'sine';
  n.frequency = makeParam(440);
  n.start = function () { n.__started = true; };
  n.stop = function () {};
  return n;
}

function makePannerNode() {
  var n = makeBaseNode('StereoPannerNode');
  n.pan = makeParam(0);
  return n;
}

function makeCompressorNode() {
  var n = makeBaseNode('DynamicsCompressorNode');
  n.threshold = makeParam(-24);
  n.knee = makeParam(30);
  n.ratio = makeParam(12);
  n.attack = makeParam(0.003);
  n.release = makeParam(0.25);
  return n;
}

function makeConvolverNode() {
  var n = makeBaseNode('ConvolverNode');
  n.buffer = null;
  n.normalize = true;
  return n;
}

// Worklet parameterDescriptors keyed by processor name (node-gate.js
// registers 'noise-gate', node-autotune.js 'autotune') — creation-time
// writes and AudioParamRamp.schedule() both land in these params.
var WORKLET_DEFAULT_PARAMS = {
  'noise-gate': { threshold: -50, attack: 0.005, release: 0.15, floor: -40 },
  autotune: { key: 0, scale: 0, retune: 0, mix: 1 }
};

var createdWorklets = [];

function WorkletNodeStub(ctx, processorName, nodeOpts) {
  var n = makeBaseNode('AudioWorkletNode');
  n.__processorName = processorName;
  n.__nodeOpts = nodeOpts;
  n.__paramsById = {};
  var descriptors = WORKLET_DEFAULT_PARAMS[processorName] || {};
  Object.keys(descriptors).forEach(function (id) {
    n.__paramsById[id] = makeParam(descriptors[id]);
  });
  n.parameters = {
    get: function (id) {
      if (!n.__paramsById[id]) {
        n.__paramsById[id] = makeParam(0);
      }
      return n.__paramsById[id];
    }
  };
  n.port = { onmessage: null, postMessage: function () {} };
  createdWorklets.push(n);
  return n;
}

// Minimal DOM element stub (param-controls render path + the handful of
// properties every test in this suite touches).
function makeElement(tag) {
  var el = {
    tagName: tag,
    id: '',
    className: '',
    type: '',
    value: '',
    min: '',
    max: '',
    step: '',
    textContent: '',
    innerHTML: '',
    parentNode: null,
    children: [],
    __listeners: {},
    setAttribute: function (name, value) {
      el['__attr_' + name] = value;
    },
    getAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(el, '__attr_' + name)
        ? el['__attr_' + name]
        : null;
    },
    appendChild: function (child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    addEventListener: function (type, fn) {
      (el.__listeners[type] = el.__listeners[type] || []).push(fn);
    },
    __fire: function (type) {
      (el.__listeners[type] || []).forEach(function (fn) {
        fn();
      });
    }
  };
  return el;
}

function audioContextStub() {
  return {
    currentTime: 0,
    sampleRate: 48000,
    destination: makeBaseNode('AudioDestinationNode'),
    createGain: makeGainNode,
    createBiquadFilter: makeBiquadNode,
    createDelay: makeDelayNode,
    createWaveShaper: makeWaveShaperNode,
    createOscillator: makeOscillatorNode,
    createStereoPanner: makePannerNode,
    createDynamicsCompressor: makeCompressorNode,
    createConvolver: makeConvolverNode,
    audioWorklet: {
      addModule: function () {
        return Promise.resolve();
      }
    }
  };
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// A sandbox with the shared globals; AudioEngine started, AudioWorkletNode
// stubbed, fetch never settling (reverb's module-load IR fetch stays inert —
// the suite's established convention).
function createSandbox() {
  var sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
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
    Float32Array: Float32Array,
    Uint8Array: Uint8Array,
    document: {
      getElementById: function () {
        return null;
      },
      createElement: function (tag) {
        return makeElement(tag);
      },
      querySelector: function () {
        return null;
      },
      addEventListener: function () {}
    },
    fetch: function () {
      return new Promise(function () {});
    }
  };
  sandbox.window = sandbox;
  sandbox.AudioWorkletNode = WorkletNodeStub;
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: audioContextStub(),
    sourceNode: makeBaseNode('MediaStreamAudioSourceNode')
  };
  vm.createContext(sandbox);
  return sandbox;
}

// The exact src load lists per part. index.html order for the real files.
var CORE_FILES = [
  'src/audio-graph.js',
  'src/node-types.js',
  'src/audio-param-ramp.js'
];
var LEGACY_NODE_FILES = [
  'src/node-gain.js',
  'src/node-compressor.js',
  'src/node-eq.js',
  'src/node-delay.js',
  'src/node-reverb.js',
  'src/node-limiter.js'
];
var NEW_NODE_FILES = [
  'src/node-distortion.js',
  'src/node-chorus.js',
  'src/node-gate.js',
  'src/node-autotune.js'
];

// ======================================================================
// A. REGISTRY — the six legacy types are exactly what they were.
// ======================================================================
function partA() {
  console.log('A. registry: legacy types with only the legacy files loaded');

  var s = createSandbox();
  CORE_FILES.concat(LEGACY_NODE_FILES).forEach(function (f) {
    loadSrc(s, f);
  });

  var NT = s.NodeTypes;
  check(
    deepEqual(NT.getAllTypes(), LEGACY_TYPES),
    'A1: getAllTypes() = exactly the six legacy types, in load order (the pre-cycle-3 registry shape)'
  );

  LEGACY_TYPES.forEach(function (type) {
    var spec = NT.getParamSpec(type);
    check(
      spec.length > 0 && spec.every(function (p) {
        return !Array.isArray(p.values) &&
          typeof p.min === 'number' && typeof p.max === 'number' &&
          typeof p.step === 'number' && typeof p.default === 'number';
        }),
      'A2: ' + type + ' paramSpec is all-numeric sliders (no values list, min/max/step/default numbers)'
    );
    check(
      NT.isExperimental(type) === false,
      'A3: ' + type + ' is NOT experimental'
    );
  });

  // The differential, on the full ten-module registry: the MCP-1 source of
  // truth badges autotune and nothing else.
  var s10 = createSandbox();
  CORE_FILES.concat(LEGACY_NODE_FILES).concat(NEW_NODE_FILES).forEach(function (f) {
    loadSrc(s10, f);
  });
  LEGACY_TYPES.concat(['distortion', 'chorus', 'gate']).forEach(function (type) {
    check(
      s10.NodeTypes.isExperimental(type) === false,
      'A4: with all ten modules loaded, ' + type + ' still reads NOT experimental'
    );
  });
  check(
    s10.NodeTypes.isExperimental('autotune') === true,
    'A4: with all ten modules loaded, autotune alone reads experimental'
  );
}

// ======================================================================
// B. PARAM-CONTROLS — the UI-1 discrete branch never touches a legacy row.
// ======================================================================
function partB() {
  console.log('B. param-controls: legacy rows are sliders with numeric commits');

  var s = createSandbox();
  CORE_FILES.concat(LEGACY_NODE_FILES).forEach(function (f) {
    loadSrc(s, f);
  });
  loadSrc(s, 'src/param-controls.js');

  // Record at the two boundaries param-controls commits through (the exact
  // pre-cycle-3 pipeline); the REAL functions still run underneath.
  var applied = [];
  var realApplyParam = s.NodeTypes.applyParam;
  s.NodeTypes.applyParam = function (type, instance, paramId, value) {
    applied.push({ type: type, paramId: paramId, value: value });
    return realApplyParam(type, instance, paramId, value);
  };
  var modelUpdates = [];
  var realUpdate = s.AudioGraph.updateNodeParams;
  s.AudioGraph.updateNodeParams = function (id, params) {
    modelUpdates.push({ id: id, params: params });
    return realUpdate(id, params);
  };
  s.AudioGraph.getNodeInstance = function () {
    return null; // boundary capture only; the real applyParam no-ops on null
  };

  // Fake instances shaped exactly for each legacy type's real applyParam
  // writes (schedule() on the right sub-node AudioParam). The destination
  // + documented conversion per type's FIRST param, asserted after the
  // input event fires — the pre-cycle-3 live-write semantics.
  function p() { return makeParam(0); }
  function fakeInstanceFor(type) {
    if (type === 'gain') return { gain: p() };
    if (type === 'eq') return { low: { gain: p() }, mid: { gain: p() }, high: { gain: p() } };
    if (type === 'compressor') {
      return { threshold: p(), ratio: p(), attack: p(), release: p() };
    }
    if (type === 'delay') {
      return {
        delayNode: { delayTime: p() },
        feedbackGain: { gain: p() },
        dryGain: { gain: p() },
        wetGain: { gain: p() }
      };
    }
    if (type === 'reverb') return { dryGain: { gain: p() }, wetGain: { gain: p() } };
    return { threshold: p(), release: p() }; // limiter
  }
  function firstParamTarget(type, inst) {
    if (type === 'gain') {
      return { param: inst.gain, expected: function (v) { return Math.pow(10, v / 20); } };
    }
    if (type === 'eq') {
      return { param: inst.low.gain, expected: function (v) { return v; } };
    }
    if (type === 'compressor') {
      return { param: inst.threshold, expected: function (v) { return v; } };
    }
    if (type === 'delay') {
      return { param: inst.delayNode.delayTime, expected: function (v) { return v / 1000; } };
    }
    if (type === 'reverb') {
      return {
        param: inst.dryGain.gain,
        expected: function (v) { return Math.cos((v / 100) * Math.PI / 2); }
      };
    }
    return { param: inst.threshold, expected: function (v) { return v; } }; // limiter
  }

  var container = makeElement('div');

  LEGACY_TYPES.forEach(function (type) {
    applied.length = 0;
    modelUpdates.length = 0;
    var inst = fakeInstanceFor(type);
    var target = firstParamTarget(type, inst);
    s.AudioGraph.getNodeInstance = function (id) {
      return id === 'x-' + type ? inst : null;
    };
    container = makeElement('div');
    s.ParamControls.render(container, { id: 'x-' + type, type: type, params: {} });

    var rows = container.children;
    var spec = s.NodeTypes.getParamSpec(type);
    check(
      rows.length === spec.length,
      'B1: ' + type + ' renders one row per paramSpec entry (' + spec.length + ')'
    );

    // Redesign item 1: the engine input is the row's first child on KNOB
    // rows and lives inside .trim-unit on TRIM rows (delay Time) — find
    // it by a deep tag search rather than child index; discrete rows have
    // no input at all (pads), but legacy types are all-numeric.
    function deepInputs(el) {
      var found = [];
      (el.children || []).forEach(function (c) {
        if (c.tagName === 'input' || c.tagName === 'select') {
          found.push(c);
        }
        found = found.concat(deepInputs(c));
      });
      return found;
    }
    var allRanges = true;
    rows.forEach(function (row) {
      var inputs = deepInputs(row);
      if (inputs.length !== 1 || inputs[0].tagName !== 'input' || inputs[0].type !== 'range') {
        allRanges = false;
      }
    });
    check(allRanges, 'B2: ' + type + ': every control is an input[type=range] (no select)');

    // Fire a non-default string value on the FIRST param's slider and
    // verify the exact pre-cycle-1..2 commit semantics: parseFloat to a
    // NUMBER, passed verbatim to applyParam, model updated with numbers.
    var first = spec[0];
    var firstInput = deepInputs(rows[0])[0];
    var probe = String(first.default === 0 ? 7.5 : first.default / 2);
    firstInput.value = probe;
    firstInput.__fire('input');

    check(
      applied.length === 1 &&
        applied[0].type === type &&
        applied[0].paramId === first.id &&
        typeof applied[0].value === 'number' &&
        applied[0].value === parseFloat(probe),
      'B3: ' + type + '.' + first.id + ': input event commits parseFloat(value)=' +
        parseFloat(probe) + ' as a NUMBER to NodeTypes.applyParam'
    );
    check(
      modelUpdates.length === 1 &&
        typeof modelUpdates[0].params[first.id] === 'number' &&
        modelUpdates[0].params[first.id] === parseFloat(probe),
      'B4: ' + type + '.' + first.id + ': AudioGraph.updateNodeParams receives the numeric value'
    );

    // The real applyParam wrote through AudioParamRamp onto the right
    // sub-param with the type's documented conversion (dB->linear, ms->s,
    // %->equal-power) — the live-write path, not just the commit value.
    var expectedValue = target.expected(parseFloat(probe));
    check(
      approx(target.param.value, expectedValue),
      'B5: ' + type + '.' + first.id + ': the real applyParam ramped the destination param to ' +
        expectedValue + ' (documented conversion, AudioParamRamp path)'
    );
  });

  // The discrete branch is keyed on `values` alone: one throwaway discrete
  // type (the UI-4 throwaway-type convention) renders PAD SELECTORS in the
  // SAME render loop, proving the branch selector itself discriminates.
  // (Redesign item 1: the discrete shape is a pad group — real buttons in
  // a radiogroup — no longer a <select>; the branch KEY is unchanged.)
  s.NodeTypes.register('test-discrete-throwaway', {
    label: 'Throwaway',
    paramSpec: [{ id: 'pick', label: 'Pick', values: ['a', 'b', 'c'], default: 'b' }],
    applyParam: function () {}
  });
  container = makeElement('div');
  s.ParamControls.render(container, {
    id: 'x-disc', type: 'test-discrete-throwaway', params: {}
  });
  var padGroup = container.children[0].children.filter(function (c) {
    return c.className === 'pad-group';
  })[0];
  var pressedPads = padGroup
    ? padGroup.children.filter(function (pad) {
        return pad.getAttribute('aria-checked') === 'true';
      })
    : [];
  check(
    !!padGroup &&
      padGroup.children.length === 3 &&
      padGroup.children.every(function (pad) { return pad.tagName === 'button'; }) &&
      pressedPads.length === 1 &&
      pressedPads[0].textContent === 'b',
    'B6: a values-list spec still renders the discrete shape (3 pads, default pressed — branch keyed on spec.values, not on type)'
  );

  // Issue-#5 updateControl on a legacy row moves the slider + display and
  // keeps the working copy in agreement (a later sibling commit carries it).
  container = makeElement('div');
  s.ParamControls.render(container, { id: 'x-rev', type: 'reverb', params: {} });
  var revInput = container.children[0].children.filter(function (c) {
    return c.tagName === 'input';
  })[0];
  check(
    s.ParamControls.updateControl('x-rev', 'mix', 80) === true &&
      revInput.value === 80,
    'B7: updateControl moves a legacy slider (agent fast-path surface unchanged)'
  );
}

// ======================================================================
// C. PRESET DATA — validation scoped, serialize shape unchanged,
//    DEFAULT_PRESET still the committed six-node chain.
// ======================================================================
function partC() {
  console.log('C. preset data: legacy lenience + shape + default chain');

  var s = createSandbox();
  loadSrc(s, 'src/preset-schema.js');
  loadSrc(s, 'src/default-preset.js');
  var PS = s.PresetSchema;

  // Round-trip a six-type chain at corner params: JSON-byte-stable and
  // param-exact, with NO new fields (no experimental/status leakage).
  var legacyModel = [
    { id: 'n1', type: 'gain', params: { gainDb: -24 } },
    { id: 'n2', type: 'compressor', params: { threshold: -60, ratio: 20, attack: 1, release: 1 } },
    { id: 'n3', type: 'eq', params: { lowGain: 12, midGain: -12, highGain: 12 } },
    { id: 'n4', type: 'delay', params: { timeMs: 990, feedback: 60, mix: 100 } },
    { id: 'n5', type: 'reverb', params: { mix: 100 } },
    { id: 'n6', type: 'limiter', params: { ceiling: -12, release: 500 } }
  ];
  var once = PS.serialize('legacy-corners', legacyModel);
  var roundTripped = PS.deserialize(once);
  var twice = PS.serialize('legacy-corners', roundTripped.nodes);
  check(
    JSON.stringify(once) === JSON.stringify(twice),
    'C1: six-type preset serialize -> deserialize -> serialize is JSON-byte-stable'
  );
  check(
    deepEqual(once, {
      schemaVersion: PS.CURRENT_VERSION,
      name: 'legacy-corners',
      nodes: legacyModel.map(function (e) {
        return { id: e.id, type: e.type, params: Object.assign({}, e.params) };
      })
    }),
    'C2: legacy serialize emits exactly {schemaVersion, name, nodes[{id,type,params}]} — no cycle-3 fields'
  );

  // Structure-only lenience for legacy types (the pre-cycle-3 contract):
  // unknown param names, out-of-range numbers, and string values all LOAD.
  var hostileLegacy = {
    schemaVersion: PS.CURRENT_VERSION,
    name: 'hostile-legacy',
    nodes: [
      { id: 'h1', type: 'gain', params: { gainDb: 999, zzz: 'weird' } },
      { id: 'h2', type: 'limiter', params: { ceiling: 'loud' } }
    ]
  };
  var loaded = null;
  var loadErr = null;
  try {
    loaded = PS.deserialize(hostileLegacy);
  } catch (err) {
    loadErr = err;
  }
  check(
    loadErr === null && loaded !== null &&
      loaded.nodes[0].params.gainDb === 999 &&
      loaded.nodes[0].params.zzz === 'weird' &&
      loaded.nodes[1].params.ceiling === 'loud',
    'C3: hostile LEGACY preset still loads verbatim (structure-only treatment unchanged)'
  );

  // The differential: the same abuse on a DECLARED cycle-3 type rejects.
  var hostileNew = {
    schemaVersion: PS.CURRENT_VERSION,
    name: 'hostile-new',
    nodes: [{ id: 'h3', type: 'autotune', params: { key: 'H#' } }]
  };
  var rejected = false;
  try {
    PS.deserialize(hostileNew);
  } catch (err) {
    rejected = true;
  }
  check(rejected, 'C4: the same abuse on autotune (key \'H#\') is rejected — the tightening is scoped to declared types');

  // DEFAULT_PRESET is still exactly PX-3's committed chain (PRE-1's
  // "default chain UNCHANGED" decision, regression-guarded).
  check(
    deepEqual(s.DEFAULT_PRESET, {
      name: 'Classic Karaoke',
      nodes: [
        { id: 'n1', type: 'gain', params: { gainDb: 0 } },
        { id: 'n2', type: 'compressor', params: { threshold: -16, ratio: 4, attack: 0.01, release: 0.25 } },
        { id: 'n3', type: 'eq', params: { lowGain: 0, midGain: 0, highGain: 0 } },
        { id: 'n4', type: 'delay', params: { timeMs: 300, feedback: 25, mix: 25 } },
        { id: 'n5', type: 'reverb', params: { mix: 20 } },
        { id: 'n6', type: 'limiter', params: { ceiling: -3, release: 50 } }
      ]
    }),
    'C5: DEFAULT_PRESET is still the committed six-node Classic Karaoke chain (first-run sound unchanged)'
  );
}

// ======================================================================
// D. MCP — legacy numeric semantics + the safety net over an all-four
//    chain, through the REAL mutation pipeline.
// ======================================================================
async function partD() {
  console.log('D. mcp pipeline: string doors + terminal-limiter policy (all-four chain)');

  var s = createSandbox();
  CORE_FILES.concat(LEGACY_NODE_FILES).concat(NEW_NODE_FILES).forEach(function (f) {
    loadSrc(s, f);
  });
  loadSrc(s, 'src/mcp-tools.js');

  // Fake AgentUI (the pipeline typeof-guards it): undo/mutation recorders.
  var undoPushes = 0;
  s.AgentUI = {
    pushUndo: function () {
      undoPushes += 1;
    },
    reportMutation: function () {},
    noteHumanEdit: function () {}
  };

  // ChainCanvas stub: the read surface + the single write path.
  var canvasModel = [];
  function copyModel(model) {
    return model.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
  }
  s.ChainCanvas = {
    getCurrentModel: function () {
      return copyModel(canvasModel);
    },
    isDragActive: function () {
      return false;
    },
    loadModel: function (model) {
      canvasModel = copyModel(model);
      if (s.AudioEngine && s.AudioEngine.isStarted) {
        s.AudioGraph.buildGraph(canvasModel);
      }
    }
  };

  function getTool(name) {
    var defs = s.McpTools.getDefs();
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].name === name) {
        return defs[i];
      }
    }
    throw new Error('test bug: tool def not found: ' + name);
  }

  var AG = s.AudioGraph;
  function snapshot() {
    var instances = {};
    AG.getModel().forEach(function (entry) {
      instances[entry.id] = AG.getNodeInstance(entry.id);
    });
    return {
      canvas: s.ChainCanvas.getCurrentModel(),
      graph: AG.getModel(),
      instances: instances,
      undoPushes: undoPushes
    };
  }
  function untouched(before, label) {
    var after = snapshot();
    check(deepEqual(after.canvas, before.canvas), label + ': canvas model untouched');
    check(deepEqual(after.graph, before.graph), label + ': AudioGraph model untouched');
    check(
      Object.keys(before.instances).every(function (id) {
        return after.instances[id] === before.instances[id];
      }),
      label + ': every physical instance is the SAME object'
    );
    check(after.undoPushes === before.undoPushes, label + ': no undo entry pushed');
  }

  // -- Seed: a legal chain containing ALL FOUR new effects + a terminal
  //    limiter, with a discrete string param in the payload.
  var seed = [
    { id: 'm1', type: 'gain', params: { gainDb: 0 } },
    { id: 'm2', type: 'gate', params: {} },
    { id: 'm3', type: 'distortion', params: {} },
    { id: 'm4', type: 'chorus', params: {} },
    { id: 'm5', type: 'autotune', params: { key: 'A', scale: 'Minor' } },
    { id: 'm6', type: 'limiter', params: { ceiling: -3, release: 50 } }
  ];
  var resSeed = await getTool('set_chain').execute({
    chain: {
      schemaVersion: 1, // the preset wire format (PresetSchema.CURRENT_VERSION)
      name: 'qa2-all-four',
      nodes: seed.map(function (e) {
        return { id: e.id, type: e.type, params: e.params };
      })
    }
  });
  await settle();
  check(
    !!resSeed && resSeed.error !== true,
    'D1: set_chain seeds the all-four chain (gain, gate, distortion, chorus, autotune[key A / Minor], terminal limiter)'
  );
  check(
    deepEqual(AG.getModel(), [
      { id: 'm1', type: 'gain', params: { gainDb: 0 } },
      { id: 'm2', type: 'gate', params: { threshold: -50, attack: 0.005, release: 0.15, floor: -40 } },
      { id: 'm3', type: 'distortion', params: { drive: 0.25, tone: 0.7, output: -3 } },
      { id: 'm4', type: 'chorus', params: { depthMs: 3, rateHz: 1.5, mix: 30 } },
      { id: 'm5', type: 'autotune', params: { key: 'A', scale: 'Minor', retune: 0, mix: 100 } },
      { id: 'm6', type: 'limiter', params: { ceiling: -3, release: 50 } }
    ]),
    'D1: the committed model is exact — omitted params normalized to defaults, discrete strings verbatim'
  );

  // -- Legacy numeric param semantics through the issue-#5 fast path.
  var resGain = await getTool('set_param').execute({ nodeId: 'm1', param: 'gainDb', value: 6 });
  await settle();
  check(
    !!resGain && resGain.error !== true &&
      AG.getModel()[0].params.gainDb === 6,
    'D2: set_param(gain.gainDb, 6 NUMBER) applies to the model'
  );
  var gainInstance = AG.getNodeInstance('m1');
  check(
    !!gainInstance && approx(gainInstance.gain.value, Math.pow(10, 6 / 20)),
    'D2: the live gain node carries 10^(6/20) (dB->linear via AudioParamRamp — legacy write path)'
  );

  // -- MCP-1's string door, both directions.
  var snapS1 = snapshot();
  var resStr = await getTool('set_param').execute({ nodeId: 'm1', param: 'gainDb', value: '6' });
  await settle();
  check(
    !!resStr && resStr.error === true && resStr.code === 'INVALID_ARGUMENTS',
    'D3: set_param(gain.gainDb, \'6\' STRING) is refused INVALID_ARGUMENTS (legacy params stay numeric-only)'
  );
  untouched(snapS1, 'D3');

  var snapS2 = snapshot();
  var resStrChain = await getTool('set_chain').execute({
    chain: {
      schemaVersion: 1,
      name: 'string-legacy-param',
      nodes: [
        { id: 'm1', type: 'gain', params: { gainDb: 'six' } },
        { id: 'm6', type: 'limiter', params: { ceiling: -3, release: 50 } }
      ]
    }
  });
  await settle();
  check(
    !!resStrChain && resStrChain.error === true && resStrChain.code === 'INVALID_ARGUMENTS',
    'D4: set_chain with a STRING legacy param is refused INVALID_ARGUMENTS'
  );
  untouched(snapS2, 'D4');

  var resKey = await getTool('set_param').execute({ nodeId: 'm5', param: 'key', value: 'F#' });
  await settle();
  var atWorklets = createdWorklets.filter(function (w) {
    return w.__processorName === 'autotune';
  });
  check(
    !!resKey && resKey.error !== true &&
      atWorklets.some(function (w) {
        return w.__paramsById.key.value === 6;
      }),
    'D5: the differential in the same boot — set_param(autotune.key, \'F#\') applies the string as worklet enum 6'
  );

  // -- Terminal-limiter policy with all four new nodes in the chain.
  var snapA = snapshot();
  var resAfter = await getTool('add_node').execute({ type: 'delay', position: 6 });
  await settle();
  check(
    !!resAfter && resAfter.error === true && resAfter.code === 'limiter-required-terminal',
    'D6: add_node AFTER the limiter (with all four new nodes upstream) refused limiter-required-terminal'
  );
  untouched(snapA, 'D6');

  var snapR = snapshot();
  var resRm = await getTool('remove_node').execute({ nodeId: 'm6' });
  await settle();
  check(
    !!resRm && resRm.error === true && resRm.code === 'limiter-required-terminal',
    'D7: remove_node(the limiter) refused — the safety net holds with the new nodes in the chain'
  );
  untouched(snapR, 'D7');

  var snapM = snapshot();
  var resMid = await getTool('set_chain').execute({
    chain: {
      schemaVersion: 1,
      name: 'limiter-mid',
      nodes: [
        { id: 'm1', type: 'gain', params: { gainDb: 0 } },
        { id: 'm6', type: 'limiter', params: { ceiling: -3, release: 50 } },
        { id: 'm2', type: 'gate', params: {} },
        { id: 'm3', type: 'distortion', params: {} },
        { id: 'm4', type: 'chorus', params: {} },
        { id: 'm5', type: 'autotune', params: { key: 'A', scale: 'Minor' } }
      ]
    }
  });
  await settle();
  check(
    !!resMid && resMid.error === true && resMid.code === 'limiter-required-terminal',
    'D8: set_chain reordering the limiter to the middle refused limiter-required-terminal'
  );
  untouched(snapM, 'D8');

  var snapC = snapshot();
  var resCeil = await getTool('set_param').execute({ nodeId: 'm6', param: 'ceiling', value: -2 });
  await settle();
  check(
    !!resCeil && resCeil.error === true,
    'D9: set_param(limiter.ceiling, -2 dB — outside the agent range [-12,-3]) refused'
  );
  untouched(snapC, 'D9');

  // The live limiter instance still holds its locked safety params.
  var limiter = AG.getNodeInstance('m6');
  check(
    !!limiter &&
      approx(limiter.ratio.value, 20) &&
      approx(limiter.attack.value, 0) &&
      approx(limiter.knee.value, 0),
    'D10: the live limiter keeps its locked safety params (ratio 20, attack 0, knee 0) with the new nodes upstream'
  );
  check(
    limiter.__connectionsTo.indexOf(AG.getChainGate()) !== -1,
    'D10: the limiter still feeds the chain gate (terminal wiring intact)'
  );
}

// ======================================================================
// E. PALETTE/CSS — the six legacy family tokens are byte-identical to the
//    cycle-2 committed values; the four new tokens exist.
// ======================================================================
function partE() {
  console.log('E. palette css: legacy family tokens unchanged');

  // Provenance: styles/main.css as committed at cycle-2 close (git 18e505f,
  // "impeccable closing-critique snapshots") — VIS-3's rq5 family edges.
  var CYCLE2_FAMILY = {
    gain: '#D9C37A',
    compressor: '#8CC079',
    eq: '#82A9DE',
    delay: '#B18FDE',
    reverb: '#6FC2C8',
    limiter: '#DE8FB0'
  };
  var css = fs.readFileSync(path.join(ROOT, 'styles', 'main.css'), 'utf8');
  Object.keys(CYCLE2_FAMILY).forEach(function (type) {
    var m = css.match(new RegExp('--family-' + type + ':\\s*(#[0-9A-Fa-f]{6})'));
    check(
      !!m && m[1].toLowerCase() === CYCLE2_FAMILY[type].toLowerCase(),
      'E1: --family-' + type + ' is still ' + CYCLE2_FAMILY[type] + ' (cycle-2 committed value)'
    );
  });
  ['distortion', 'chorus', 'gate', 'autotune'].forEach(function (type) {
    var m = css.match(new RegExp('--family-' + type + ':\\s*(#[0-9A-Fa-f]{6})'));
    check(!!m, 'E2: --family-' + type + ' token present (UI-2 addition)');
  });
}

// ----------------------------------------------------------------------
// Main.
// ----------------------------------------------------------------------
async function main() {
  partA();
  partB();
  partC();
  await partD();
  partE();

  console.log('');
  if (failures.length === 0) {
    console.log('PASS: cycle-3 regression — legacy effects + safety net unchanged (' +
      'audio-identity/bypass/watchdog renders: tests/qa-out/run-qa2.js)');
    process.exit(0);
  } else {
    console.log('FAIL: ' + failures.length + ' check(s) failed:');
    failures.forEach(function (f) {
      console.log('  - ' + f);
    });
    process.exit(1);
  }
}

main().catch(function (err) {
  console.error('test crash:', err);
  process.exit(1);
});
