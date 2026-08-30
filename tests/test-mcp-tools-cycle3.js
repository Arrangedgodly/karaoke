// Test for MCP-1 (docs/ultron/plan.md, cycle 3) — agent operability for
// the four shelved effects through the EXISTING tool surface (no new
// tools), and the experimental badge in the capabilities readout.
//
// The contract under test (plan.md MCP-1 + PRE-1's handoff note):
//   - set_chain/add_node/set_param accept DISCRETE string params
//     (autotune Key/Scale) validated against each type's legal value
//     set — the same problem/allowed error style as every other
//     validation; before MCP-1, checkSpecValue was numeric-only and
//     rejected Key/Scale outright (PRE-1 explicitly left that to this
//     task).
//   - Illegal values (key 'H', scale 'Dorian', enum 12/-1/1.5, string on
//     a numeric param, out-of-nominal numbers) reject CLEANLY —
//     descriptive INVALID_ARGUMENTS results, nothing applied, no crash.
//   - get_capabilities marks autotune EXPERIMENTAL (badge + note) from
//     the one source of truth (NodeTypes.isExperimental — the type's own
//     registration; src/canvas.js's badge reads the same lookup).
//   - Raw 0..11 / 0..2 enums are equally legal (preset-schema's PRE-1
//     contract mirrored at the tool layer).
//
// Like tests/test-safety-refusals.js, this drives the REAL mutation
// pipeline (src/mcp-tools.js execute -> validate -> plan -> apply through
// ChainCanvas.loadModel / the issue-#5 param-only fast path), with the
// REAL src/audio-graph.js + all TEN node files so added effects get real
// physical instances (worklet stubs for gate/autotune, native-node stubs
// for distortion/chorus), the REAL src/agent-ui.js for disclosure, and
// the REAL src/preset-schema.js for set_chain's authoritative check.
//
// Run from a clean clone:  node tests/test-mcp-tools-cycle3.js
// (or via the runner:      node tests/run.js mcp-tools-cycle3)
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

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// buildGraph() commits its instance map + model on the deferred rewire
// (~20 ms after the call), and the gate/autotune worklets splice in once
// their (immediately-resolving) addModule promise drains. 80 ms settles
// both comfortably.
function settle() {
  return sleep(80);
}

// Order-insensitive structural equality for plain-JSON shapes.
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
    if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !deepEqual(a[ka[i]], b[ka[i]])) {
      return false;
    }
  }
  return true;
}

// ----------------------------------------------------------------------
// Minimal Web Audio stubs — recording connect/disconnect edges, with the
// param surfaces the node factories write. Cycle-3 additions over the
// safety-refusals set: WaveShaper (distortion), Oscillator + StereoPanner
// (chorus), AudioWorkletNode with a per-processor parameter map (gate,
// autotune) fed by a resolving audioWorklet.addModule.
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
    },
    setTargetAtTime: function () {}
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
      if (i !== -1) {
        this.__connectionsTo.splice(i, 1);
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

function makeBiquadFilterNode() {
  var node = makeBaseNode('BiquadFilterNode');
  node.type = 'allpass';
  node.frequency = makeParam(350);
  node.Q = makeParam(1);
  node.gain = makeParam(0);
  return node;
}

function makeDelayNode() {
  var node = makeBaseNode('DelayNode');
  node.delayTime = makeParam(0);
  return node;
}

function makeWaveShaperNode() {
  var node = makeBaseNode('WaveShaperNode');
  node.curve = null;
  node.oversample = 'none';
  return node;
}

function makeStereoPannerNode() {
  var node = makeBaseNode('StereoPannerNode');
  node.pan = makeParam(0);
  return node;
}

function makeOscillatorNode() {
  var node = makeBaseNode('OscillatorNode');
  node.type = 'sine';
  node.frequency = makeParam(440);
  node.detune = makeParam(0);
  node.__started = 0;
  node.start = function () {
    node.__started += 1;
  };
  node.stop = function () {};
  return node;
}

// The worklet parameterDescriptors, keyed by processor name (gate =
// 'noise-gate', autotune = 'autotune') — creation-time writes and
// AudioParamRamp.schedule() both land in these params.
var WORKLET_PARAMS = {
  'noise-gate': {
    threshold: -50,
    attack: 0.005,
    release: 0.15,
    floor: -40
  },
  autotune: {
    key: 0,
    scale: 0,
    retune: 0,
    mix: 1
  }
};

var createdWorklets = [];

function WorkletNodeStub(ctx, processorName, nodeOpts) {
  var n = makeBaseNode('AudioWorkletNode');
  n.__processorName = processorName;
  n.__nodeOpts = nodeOpts;
  n.__paramsById = {};
  var descriptors = WORKLET_PARAMS[processorName] || {};
  Object.keys(descriptors).forEach(function (id) {
    n.__paramsById[id] = makeParam(descriptors[id]);
  });
  n.parameters = {
    get: function (id) {
      return n.__paramsById[id];
    }
  };
  n.port = { onmessage: null, postMessage: function () {} };
  createdWorklets.push(n);
  return n;
}

// ----------------------------------------------------------------------
// Minimal DOM element stub — enough for the REAL src/agent-ui.js to
// render toasts (same shape as test-safety-refusals.js).
// ----------------------------------------------------------------------
function makeElement(tag) {
  var el = {
    tagName: tag,
    id: '',
    className: '',
    type: '',
    textContent: '',
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
    insertBefore: function (child, ref) {
      child.parentNode = el;
      var idx = el.children.indexOf(ref);
      if (idx === -1) {
        el.children.push(child);
      } else {
        el.children.splice(idx, 0, child);
      }
      return child;
    },
    removeChild: function (child) {
      var idx = el.children.indexOf(child);
      if (idx !== -1) {
        el.children.splice(idx, 1);
      }
      child.parentNode = null;
      return child;
    },
    get firstChild() {
      return el.children.length > 0 ? el.children[0] : null;
    },
    remove: function () {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    },
    addEventListener: function (type, fn) {
      (el.__listeners[type] = el.__listeners[type] || []).push(fn);
    },
    __fire: function (type) {
      (el.__listeners[type] || []).forEach(function (fn) {
        fn();
      });
    },
    querySelector: function () {
      return null;
    },
    querySelectorAll: function () {
      return [];
    }
  };
  return el;
}

// ----------------------------------------------------------------------
// The sandbox: a vm context whose global IS `window`, with host timers,
// the DOM stub, and a STARTED engine exposing every factory the TEN node
// files use (audioWorklet.addModule resolves immediately).
// ----------------------------------------------------------------------
var domEvents = [];

function createSandbox() {
  var bodyEl = makeElement('body');
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
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = (init && init.detail) || null;
    },
    Float32Array: Float32Array,
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
      addEventListener: function () {},
      dispatchEvent: function (ev) {
        domEvents.push({ type: ev.type, detail: ev.detail });
        return true;
      },
      body: bodyEl
    },
    // src/node-reverb.js fetches its IR at module load; a never-settling
    // promise keeps the (unused) convolver wet path silent.
    fetch: function () {
      return new Promise(function () {});
    }
  };
  sandbox.window = sandbox;
  sandbox.__body = bodyEl;
  sandbox.AudioWorkletNode = WorkletNodeStub;
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: {
      currentTime: 0,
      sampleRate: 48000,
      destination: makeBaseNode('AudioDestinationNode'),
      createGain: makeGainNode,
      createDynamicsCompressor: function () {
        var node = makeBaseNode('DynamicsCompressorNode');
        node.threshold = makeParam(-24);
        node.knee = makeParam(30);
        node.ratio = makeParam(12);
        node.attack = makeParam(0.003);
        node.release = makeParam(0.25);
        return node;
      },
      createBiquadFilter: makeBiquadFilterNode,
      createDelay: makeDelayNode,
      createConvolver: function () {
        var node = makeBaseNode('ConvolverNode');
        node.buffer = null;
        return node;
      },
      createWaveShaper: makeWaveShaperNode,
      createStereoPanner: makeStereoPannerNode,
      createOscillator: makeOscillatorNode,
      audioWorklet: {
        addModule: function () {
          return Promise.resolve();
        }
      }
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

// ----------------------------------------------------------------------
// ChainCanvas stub — the read surface the tools use plus the single
// write path (loadModel) AND the issue-#5 param-only fast-path hook
// (updateNodeParam), so set_param rides the same route the app does.
// ----------------------------------------------------------------------
function installChainCanvasStub(sandbox) {
  var canvasModel = [];
  function copyModel(model) {
    return model.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
  }
  sandbox.ChainCanvas = {
    getCurrentModel: function () {
      return copyModel(canvasModel);
    },
    isDragActive: function () {
      return false;
    },
    loadModel: function (model) {
      canvasModel = copyModel(model);
      if (sandbox.AudioEngine && sandbox.AudioEngine.isStarted) {
        sandbox.AudioGraph.buildGraph(
          canvasModel.map(function (entry) {
            return { id: entry.id, type: entry.type, params: entry.params };
          })
        );
      }
    },
    updateNodeParam: function (nodeId, paramId, value) {
      for (var i = 0; i < canvasModel.length; i++) {
        if (canvasModel[i].id === nodeId) {
          var updated = Object.assign({}, canvasModel[i].params);
          updated[paramId] = value;
          canvasModel[i].params = updated;
          return true;
        }
      }
      return false;
    }
  };
}

function getTool(sandbox, name) {
  var defs = sandbox.McpTools.getDefs();
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].name === name) {
      return defs[i];
    }
  }
  throw new Error('test bug: tool def not found: ' + name);
}

function nodeById(model, id) {
  for (var i = 0; i < model.length; i++) {
    if (model[i].id === id) {
      return model[i];
    }
  }
  return null;
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  loadSrc(sandbox, 'src/agent-ui.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/node-types.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js');
  loadSrc(sandbox, 'src/node-gain.js');
  loadSrc(sandbox, 'src/node-compressor.js');
  loadSrc(sandbox, 'src/node-eq.js');
  loadSrc(sandbox, 'src/node-delay.js');
  loadSrc(sandbox, 'src/node-reverb.js');
  loadSrc(sandbox, 'src/node-limiter.js');
  loadSrc(sandbox, 'src/node-distortion.js');
  loadSrc(sandbox, 'src/node-chorus.js');
  loadSrc(sandbox, 'src/node-gate.js');
  loadSrc(sandbox, 'src/node-autotune.js');
  loadSrc(sandbox, 'src/preset-schema.js');
  loadSrc(sandbox, 'src/mcp-tools.js');
  installChainCanvasStub(sandbox);

  var AG = sandbox.AudioGraph;
  var setChain = getTool(sandbox, 'set_chain');
  var addNode = getTool(sandbox, 'add_node');
  var setParam = getTool(sandbox, 'set_param');
  var getChain = getTool(sandbox, 'get_chain');
  var getCapabilities = getTool(sandbox, 'get_capabilities');

  var undoPushes = 0;
  var realPushUndo = sandbox.AgentUI.pushUndo;
  sandbox.AgentUI.pushUndo = function (entry) {
    undoPushes += 1;
    return realPushUndo(entry);
  };

  function modelSnapshot() {
    return sandbox.ChainCanvas.getCurrentModel();
  }

  function untouched(before, label) {
    var after = modelSnapshot();
    check(deepEqual(after, before), label + ': canvas model untouched');
  }

  // ====================================================================
  console.log('A. capabilities readout: cycle-3 types + experimental badge');
  // ====================================================================
  var caps = await getCapabilities.execute({});
  // Merged contract (PR #18 compact shape + cycle-3 disclosure):
  //   nodeTypes.<type>.<param> = {unit, range, action} | {unit, values, action}
  //   experimental.<type> = disclosure note (autotune only)
  var byType = caps.nodeTypes;
  var typeKeys = Object.keys(byType);
  check(typeKeys.length === 10, 'A1: readout lists all 10 registered types');
  check(!!byType.autotune && !!byType.gate && !!byType.distortion && !!byType.chorus,
    'A2: gate/distortion/chorus/autotune all present in the readout');
  check(caps.experimental && typeof caps.experimental.autotune === 'string' &&
    /EXPERIMENTAL/i.test(caps.experimental.autotune),
    'A3: autotune carries the experimental disclosure note');
  check(Object.keys(caps.experimental || {}).length === 1 &&
    caps.experimental.gate === undefined,
    'A4: autotune is the ONLY badged type');
  check(sandbox.NodeTypes.isExperimental('autotune') === true &&
    sandbox.NodeTypes.isExperimental('gate') === false,
    'A5: the registry itself is the badge source (NodeTypes.isExperimental)');
  var atParams = byType.autotune;
  check(atParams.key && Array.isArray(atParams.key.values) &&
    atParams.key.values.length === 12 && atParams.key.values[9] === 'A' &&
    atParams.key.action === 'reject',
    'A6: key publishes its 12-value discrete list (C..B), action reject');
  check(atParams.scale && deepEqual(atParams.scale.values, ['Chromatic', 'Major', 'Minor']),
    'A7: scale publishes its 3-value discrete list');
  check(atParams.key.range === undefined,
    'A8: discrete params carry no numeric range (the list IS the range)');
  check(atParams.retune && deepEqual(atParams.retune.range, [0, 500]),
    'A9: autotune numeric params still publish ranges (retune 0-500)');
  ['gate', 'distortion', 'chorus'].forEach(function (t) {
    var pids = Object.keys(byType[t]);
    check(pids.length >= 3 && pids.every(function (pid) {
      return byType[t][pid].range || byType[t][pid].values;
    }),
      'A10: ' + t + ' params all publish a range or value list');
  });
  check(byType.gate.threshold && deepEqual(byType.gate.threshold.range, [-80, 0]) &&
    byType.gate.threshold.action === 'reject',
    'A11: gate threshold publishes range [-80, 0] reject');
  var capsLen = JSON.stringify(caps).length;
  check(capsLen < 4000,
    'A12: compact payload held (' + capsLen + ' chars — PR #18 ceiling discipline)');
  check(caps.summary === undefined,
    'A13: no prose summary in the compact readout (disclosure rides experimental + chainRules)');
  var soundGuide = await getCapabilities.execute({ focus: 'sound_design' });
  check(soundGuide.focus === 'sound_design' &&
    soundGuide.vocabulary.deeper.some(function (step) { return /does not lower pitch/i.test(step); }),
    'A14: deeper guidance is honest about timbre shaping rather than pitch shifting');
  check(soundGuide.vocabulary.ghostly.some(function (step) { return /reverb/i.test(step); }) &&
    soundGuide.vocabulary.ghostly.some(function (step) { return /delay/i.test(step); }),
    'A15: ghostly guidance combines space and echo without requiring a named tool');
  check(soundGuide.intensity && /first listed/i.test(soundGuide.intensity.slight) &&
    /last listed/i.test(soundGuide.intensity.strong),
    'A16: intensity follows each mild-to-strong listed range, including cuts');
  var guideSteps = [];
  Object.keys(soundGuide.vocabulary).forEach(function (intent) {
    soundGuide.vocabulary[intent].forEach(function (step) {
      var match = step.match(/^([a-z]+) ([A-Za-z][A-Za-z0-9]*)\b/);
      if (match) {
        guideSteps.push({ intent: intent, step: step, type: match[1], param: match[2] });
      }
    });
  });
  check(guideSteps.length === 24 && guideSteps.every(function (entry) {
    return byType[entry.type] && byType[entry.type][entry.param];
  }), 'A17: every actionable guide step names a registered node parameter');
  check(guideSteps.every(function (entry) {
    var policy = byType[entry.type][entry.param];
    var range = entry.step.match(/([+-]?\d+(?:\.\d+)?)\.\.([+-]?\d+(?:\.\d+)?)/);
    if (range) {
      var a = Number(range[1]);
      var b = Number(range[2]);
      return policy.range && a >= policy.range[0] && a <= policy.range[1] &&
        b >= policy.range[0] && b <= policy.range[1];
    }
    return policy.values && policy.values.some(function (value) {
      return entry.step.indexOf(String(value)) !== -1;
    });
  }), 'A18: every guide range/value stays inside the published policy');
  check(soundGuide.vocabulary.robotic.some(function (step) {
    return /EXPERIMENTAL/i.test(step) && /verify by ear/i.test(step);
  }), 'A19: robotic guidance carries the autotune experimental disclosure');
  check(JSON.stringify(soundGuide).length <= 1500,
    'A20: sound-design payload held (' + JSON.stringify(soundGuide).length + ' chars)');

  // ====================================================================
  console.log('B. set_chain: all four effects, incl. key "A" / scale "Minor"');
  // ====================================================================
  var chainResult = await setChain.execute({
    chain: {
      schemaVersion: 1,
      name: 'cycle-3 agent chain',
      nodes: [
        { id: 'g1', type: 'gain', params: { gainDb: 2 } },
        { id: 'ng1', type: 'gate', params: { threshold: -45, attack: 0.004, release: 0.2, floor: -30 } },
        { id: 'd1', type: 'distortion', params: { drive: 0.4, tone: 0.8, output: -6 } },
        { id: 'ch1', type: 'chorus', params: { depthMs: 4, rateHz: 1.2, mix: 25 } },
        { id: 'at1', type: 'autotune', params: { key: 'A', scale: 'Minor', retune: 250, mix: 90 } },
        { id: 'lim1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    }
  });
  check(chainResult.applied === true && chainResult.error !== true,
    'B1: set_chain with all four effects applied');
  await settle();
  var model = modelSnapshot();
  check(model.length === 6, 'B2: 6 nodes live');
  var at1 = nodeById(model, 'at1');
  check(at1 && at1.params.key === 'A' && at1.params.scale === 'Minor' &&
    at1.params.retune === 250 && at1.params.mix === 90,
    'B3: autotune params land verbatim — key "A", scale "Minor" (strings)');
  var ng1 = nodeById(model, 'ng1');
  check(ng1 && ng1.params.threshold === -45 && ng1.params.floor === -30,
    'B4: gate params land verbatim');
  var d1 = nodeById(model, 'd1');
  check(d1 && d1.params.drive === 0.4 && d1.params.output === -6,
    'B5: distortion params land verbatim');
  var ch1 = nodeById(model, 'ch1');
  check(ch1 && ch1.params.rateHz === 1.2 && ch1.params.mix === 25,
    'B6: chorus params land verbatim');
  // Physical: the autotune worklet received the ENUM forms of the strings.
  var atInstance = AG.getNodeInstance('at1');
  check(!!atInstance && !!atInstance.worklet &&
    atInstance.worklet.__processorName === 'autotune',
    'B7: autotune built a real worklet instance');
  check(atInstance && atInstance.worklet &&
    atInstance.worklet.parameters.get('key').value === 9,
    'B8: worklet key param = 9 (enum for "A")');
  check(atInstance && atInstance.worklet &&
    atInstance.worklet.parameters.get('scale').value === 2,
    'B9: worklet scale param = 2 (enum for "Minor")');
  var ngInstance = AG.getNodeInstance('ng1');
  check(!!ngInstance && !!ngInstance.worklet &&
    ngInstance.worklet.parameters.get('threshold').value === -45,
    'B10: gate worklet got its threshold');
  var chInstance = AG.getNodeInstance('ch1');
  check(!!chInstance && !!chInstance.lfo && chInstance.lfo.__started === 1 &&
    chInstance.lfo.frequency.value === 1.2,
    'B11: chorus built its LFO at rate 1.2 Hz (started once)');
  var dInstance = AG.getNodeInstance('d1');
  check(!!dInstance && !!dInstance.shaper && dInstance.shaper.oversample === '4x',
    'B12: distortion built its oversampled shaper');
  // get_chain round-trip keeps the strings.
  var read = await getChain.execute({});
  var readAt = nodeById(read.nodes, 'at1');
  check(readAt && readAt.params.key === 'A' && readAt.params.scale === 'Minor',
    'B13: get_chain round-trips the string params');

  // ====================================================================
  console.log('C. set_param: tune each of the four (string + numeric)');
  // ====================================================================
  undoPushes = 0;

  var keyRes = await setParam.execute({ nodeId: 'at1', param: 'key', value: 'F#' });
  check(keyRes.applied === true && keyRes.error !== true,
    'C1: set_param key "F#" applied');
  check(keyRes.changes && keyRes.changes[0] && keyRes.changes[0].params &&
    keyRes.changes[0].params.key && keyRes.changes[0].params.key.from === 'A' &&
    keyRes.changes[0].params.key.to === 'F#',
    'C2: disclosed as key A -> F# (string diff)');
  check(nodeById(modelSnapshot(), 'at1').params.key === 'F#',
    'C3: model holds key "F#"');
  await settle();
  atInstance = AG.getNodeInstance('at1');
  check(atInstance && atInstance.worklet &&
    atInstance.worklet.parameters.get('key').value === 6,
    'C4: live worklet key ramped to 6 (enum for "F#")');

  var scaleRes = await setParam.execute({ nodeId: 'at1', param: 'scale', value: 'Major' });
  check(scaleRes.applied === true &&
    nodeById(modelSnapshot(), 'at1').params.scale === 'Major',
    'C5: set_param scale "Major" applied (string)');

  var retuneRes = await setParam.execute({ nodeId: 'at1', param: 'retune', value: 0 });
  check(retuneRes.applied === true &&
    nodeById(modelSnapshot(), 'at1').params.retune === 0,
    'C6: set_param retune 0 (numeric) applied — hard-tune');

  var gateRes = await setParam.execute({ nodeId: 'ng1', param: 'threshold', value: -42 });
  check(gateRes.applied === true &&
    nodeById(modelSnapshot(), 'ng1').params.threshold === -42,
    'C7: set_param gate threshold applied');

  var distRes = await setParam.execute({ nodeId: 'd1', param: 'drive', value: 0.9 });
  check(distRes.applied === true &&
    nodeById(modelSnapshot(), 'd1').params.drive === 0.9,
    'C8: set_param distortion drive applied');

  var chorRes = await setParam.execute({ nodeId: 'ch1', param: 'rateHz', value: 2.5 });
  check(chorRes.applied === true &&
    nodeById(modelSnapshot(), 'ch1').params.rateHz === 2.5,
    'C9: set_param chorus rate applied');
  await settle();
  chInstance = AG.getNodeInstance('ch1');
  check(chInstance && chInstance.lfo && chInstance.lfo.frequency.value === 2.5,
    'C10: chorus LFO ramped to 2.5 Hz');

  check(undoPushes === 6, 'C11: each applied set_param pushed exactly one undo entry');

  // ====================================================================
  console.log('D. add_node: each of the four, with initial params');
  // ====================================================================
  await setChain.execute({
    chain: {
      schemaVersion: 1,
      name: 'seed',
      nodes: [
        { id: 's1', type: 'gain', params: { gainDb: 0 } },
        { id: 's2', type: 'limiter', params: { ceiling: -3, release: 100 } }
      ]
    }
  });
  await settle();

  var adds = [
    { type: 'gate', params: { threshold: -55, floor: -50 } },
    { type: 'distortion', params: { drive: 0.2, tone: 0.6, output: -3 } },
    { type: 'chorus', params: { depthMs: 2.5, rateHz: 0.8, mix: 20 } },
    { type: 'autotune', params: { key: 'D#', scale: 'Major', retune: 120, mix: 100 } }
  ];
  var addedIds = [];
  for (var a = 0; a < adds.length; a++) {
    var res = await addNode.execute({ type: adds[a].type, params: adds[a].params, position: 1 });
    check(res.applied === true && res.error !== true && res.nodeIds && res.nodeIds.length === 1,
      'D' + (a + 1) + ': add_node ' + adds[a].type + ' applied (id minted + disclosed)');
    addedIds.push(res.nodeIds[0]);
  }
  await settle();
  model = modelSnapshot();
  check(model.length === 6 && model[5].type === 'limiter',
    'D5: all four added upstream of the terminal limiter');
  var addedAt = nodeById(model, addedIds[3]);
  check(addedAt && addedAt.type === 'autotune' &&
    addedAt.params.key === 'D#' && addedAt.params.scale === 'Major',
    'D6: add_node autotune carried key "D#" / scale "Major" strings');
  var addedGate = nodeById(model, addedIds[0]);
  check(addedGate && addedGate.params.threshold === -55,
    'D7: add_node gate carried its initial params');

  // ====================================================================
  console.log('E. illegal values rejected cleanly (nothing applied)');
  // ====================================================================
  var before = modelSnapshot();
  undoPushes = 0;

  var illegal = [];
  illegal.push({
    label: 'set_chain key "H"',
    run: function () {
      return setChain.execute({
        chain: {
          schemaVersion: 1,
          name: 'bad key',
          nodes: [
            { id: 'x1', type: 'autotune', params: { key: 'H' } },
            { id: 'x2', type: 'limiter' }
          ]
        }
      });
    },
    pathTest: function (r) {
      return r.code === 'INVALID_ARGUMENTS' && r.problems[0].path === 'chain.nodes[0].params.key' &&
        /discrete param/.test(r.problems[0].message) &&
        deepEqual(r.problems[0].allowed, atParams.key.values);
    }
  });
  illegal.push({
    label: 'set_chain scale "Dorian"',
    run: function () {
      return setChain.execute({
        chain: {
          schemaVersion: 1,
          name: 'bad scale',
          nodes: [
            { id: 'x1', type: 'autotune', params: { scale: 'Dorian' } },
            { id: 'x2', type: 'limiter' }
          ]
        }
      });
    },
    pathTest: function (r) {
      return r.code === 'INVALID_ARGUMENTS' && r.problems[0].path === 'chain.nodes[0].params.scale' &&
        deepEqual(r.problems[0].allowed, ['Chromatic', 'Major', 'Minor']);
    }
  });
  illegal.push({
    label: 'add_node autotune key "H"',
    run: function () {
      return addNode.execute({ type: 'autotune', params: { key: 'H' }, position: 0 });
    },
    pathTest: function (r) {
      return r.code === 'INVALID_ARGUMENTS' && r.problems[0].path === 'params.key';
    }
  });
  illegal.push({
    label: 'set_param key "H"',
    run: function () {
      return setParam.execute({ nodeId: addedIds[3], param: 'key', value: 'H' });
    },
    pathTest: function (r) {
      return r.code === 'INVALID_ARGUMENTS' && r.problems[0].path === 'value' &&
        deepEqual(r.problems[0].allowed, atParams.key.values);
    }
  });
  illegal.push({
    label: 'set_param key enum 12 (past the 0..11 enum)',
    run: function () {
      return setParam.execute({ nodeId: addedIds[3], param: 'key', value: 12 });
    },
    pathTest: function (r) {
      return r.code === 'INVALID_ARGUMENTS' && r.problems[0].path === 'value';
    }
  });
  illegal.push({
    label: 'set_param key enum 1.5 (non-integer)',
    run: function () {
      return setParam.execute({ nodeId: addedIds[3], param: 'key', value: 1.5 });
    },
    pathTest: function (r) {
      return r.code === 'INVALID_ARGUMENTS' && r.problems[0].path === 'value';
    }
  });
  illegal.push({
    label: 'set_param gate threshold "loud" (string on a numeric param)',
    run: function () {
      return setParam.execute({ nodeId: addedIds[0], param: 'threshold', value: 'loud' });
    },
    pathTest: function (r) {
      return r.code === 'INVALID_ARGUMENTS' && r.problems[0].path === 'value' &&
        /is numeric/.test(r.problems[0].message);
    }
  });
  illegal.push({
    label: 'set_param chorus rateHz 99 (outside nominal)',
    run: function () {
      return setParam.execute({ nodeId: addedIds[2], param: 'rateHz', value: 99 });
    },
    // set_param's structural layer is type-only by design (the MC-4
    // comment); RANGE enforcement is the apply-time policy layer's —
    // which rejects out-of-range with PARAM_OUT_OF_RANGE, nothing
    // applied. Equally clean; different code than set_chain's.
    pathTest: function (r) {
      return r.code === 'PARAM_OUT_OF_RANGE' && r.applied === null &&
        r.allowed && r.allowed.min === 0.1 && r.allowed.max === 8;
    }
  });
  illegal.push({
    label: 'set_param distortion output +3 (outside nominal)',
    run: function () {
      return setParam.execute({ nodeId: addedIds[1], param: 'output', value: 3 });
    },
    pathTest: function (r) {
      return r.code === 'PARAM_OUT_OF_RANGE' && r.applied === null &&
        r.allowed && r.allowed.min === -24 && r.allowed.max === 0;
    }
  });
  illegal.push({
    label: 'set_param value {bad: true} (wrong shape)',
    run: function () {
      return setParam.execute({ nodeId: addedIds[3], param: 'retune', value: { bad: true } });
    },
    pathTest: function (r) {
      return r.code === 'INVALID_ARGUMENTS' && r.problems[0].path === 'value';
    }
  });

  for (var e = 0; e < illegal.length; e++) {
    var case_ = illegal[e];
    var r = await case_.run();
    check(r && r.error === true && case_.pathTest(r),
      'E' + (e + 1) + ': ' + case_.label + ' -> structured rejection, allowed set inline');
    check(typeof r.reason === 'string' && r.reason.length > 0,
      'E' + (e + 1) + 'b: descriptive reason present');
  }
  check(deepEqual(modelSnapshot(), before),
    'E11: every illegal call left the model untouched');
  check(undoPushes === 0,
    'E12: refused mutations pushed no undo entries');

  // ====================================================================
  console.log('F. raw enum forms are equally legal (preset-schema contract)');
  // ====================================================================
  var enumRes = await setParam.execute({ nodeId: addedIds[3], param: 'key', value: 9 });
  check(enumRes.applied === true &&
    nodeById(modelSnapshot(), addedIds[3]).params.key === 9,
    'F1: set_param key 9 (raw enum) applied — preserved as the enum form');
  var enumChain = await setChain.execute({
    chain: {
      schemaVersion: 1,
      name: 'enum forms',
      nodes: [
        { id: 'e1', type: 'autotune', params: { key: 5, scale: 1 } },
        { id: 'e2', type: 'limiter' }
      ]
    }
  });
  check(enumChain.applied === true, 'F2: set_chain with raw enums key 5 / scale 1 applied');
  var eModel = nodeById(modelSnapshot(), 'e1');
  check(eModel && eModel.params.key === 5 && eModel.params.scale === 1,
    'F3: enum forms preserved verbatim in the model');
  await settle();
  var eInstance = AG.getNodeInstance('e1');
  check(eInstance && eInstance.worklet &&
    eInstance.worklet.parameters.get('key').value === 5 &&
    eInstance.worklet.parameters.get('scale').value === 1,
    'F4: worklet received enums 5 / 1 at creation');

  // ====================================================================
  console.log('G. bare harness: snapshot registry + badge fallback hold');
  // ====================================================================
  var bare = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    document: { getElementById: function () { return null; } }
  };
  bare.window = bare;
  vm.createContext(bare);
  loadSrc(bare, 'src/mcp-tools.js');
  var bareCaps = await getTool(bare, 'get_capabilities').execute({});
  check(Object.keys(bareCaps.nodeTypes).length === 10,
    'G1: bare harness (no node files): snapshot still lists 10 types');
  check(bareCaps.experimental && typeof bareCaps.experimental.autotune === 'string' &&
    /EXPERIMENTAL/.test(bareCaps.experimental.autotune) &&
    Object.keys(bareCaps.experimental).length === 1,
    'G2: bare harness: autotune still badged via the snapshot fallback (only autotune)');
  check(bareCaps.nodeTypes.autotune.key && Array.isArray(bareCaps.nodeTypes.autotune.key.values) &&
    bareCaps.nodeTypes.autotune.key.values.length === 12,
    'G3: bare harness: key value list mirrored in the snapshot');
  check(bareCaps.experimental.gate === undefined,
    'G4: bare harness: gate not badged');
  var addDef = getTool(bare, 'add_node');
  check(addDef.inputSchema.properties.type.enum.length === 10,
    'G5: bare harness: add_node type enum = the 10 snapshot types');

  // ------------------------------------------------------------------
  console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : 'FAILURES: ' + failures.length);
  if (failures.length > 0) {
    failures.forEach(function (f) {
      console.error('  - ' + f);
    });
    process.exit(1);
  }
  process.exit(0);
}

main().catch(function (err) {
  console.error('test crashed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
