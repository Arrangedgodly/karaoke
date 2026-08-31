// Tone-backed effects test — the four cycle-4 node types
// (pitchshift/tremolo/bitcrusher/phaser, src/node-*.js registered through
// src/tone-adapter.js): registration shape, factory defaults, param
// mapping, and — the part that matters most for this codebase — the WebMCP
// integration contract (add_node enum, get_capabilities ranges, and the
// set_param fast path reaching the LIVE Tone node with zero graph
// rebuilds, same invariants tests/test-param-only-mutation.js pins for
// native types).
//
// Same committed-test convention as the rest of the suite: a
// ZERO-dependency Node harness with stubbed `window`/Web Audio, loading
// the REAL src files. window.Tone is stubbed with the four effect classes
// shaped like the real Tone.js API surface the adapter and the effect
// files touch (constructor options, rampable Params with recorded ramps,
// plain setters, start()/dispose()) — the real DSP interop is verified in
// headless Chrome (tests/browser-probe.js + the smoke round).
//
// Run from a clean clone:  node tests/test-tone-effects.js
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

function approx(a, b) {
  return Math.abs(a - b) < 1e-9;
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function settle() {
  return sleep(60);
}

// ----------------------------------------------------------------------
// Web Audio stubs (same shapes as the rest of the suite).
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

function makeCompressorNode() {
  var node = makeBaseNode('DynamicsCompressorNode');
  node.threshold = makeParam(-24);
  node.knee = makeParam(30);
  node.ratio = makeParam(12);
  node.attack = makeParam(0.003);
  node.release = makeParam(0.25);
  return node;
}

// A fake Tone Param: records ramps so click-safety (value + 15 ms ramp
// time) is assertable, keeps .value current.
function toneParam(node, name, initial) {
  return {
    value: initial,
    rampTo: function (v, t) {
      node.__ramps.push({ param: name, value: v, rampTime: t });
      this.value = v;
    }
  };
}

// A fake Tone effect node: records constructor options and every param
// ramp; plain-property assignments land directly (phaser octaves/
// baseFrequency, pitchshift pitch) and are readable afterwards.
function makeFakeEffect(name) {
  var node = {
    __fakeToneName: name,
    __ctorOptions: null,
    __ramps: [],
    __disposed: false,
    dispose: function () {
      this.__disposed = true;
    }
  };
  node.wet = toneParam(node, 'wet', 1);
  return node;
}

// The window.Tone stub: context contract + connect recorder + the four
// effect classes with the constructor-option shapes the effect files use.
function installToneStub(sandbox) {
  var calls = { setContext: [], connect: [] };
  var currentRaw = null;

  function ToneEffect(className, wireParams) {
    return function (options) {
      var node = makeFakeEffect(className);
      node.__ctorOptions = Object.assign({}, options);
      if (wireParams) {
        wireParams(node, options || {});
      }
      return node;
    };
  }

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
    },
    PitchShift: ToneEffect('PitchShift', function (node, o) {
      node.pitch = o.pitch || 0;
      node.wet = toneParam(node, 'wet', o.wet === undefined ? 1 : o.wet);
    }),
    Tremolo: ToneEffect('Tremolo', function (node, o) {
      node.frequency = toneParam(node, 'frequency', o.frequency === undefined ? 10 : o.frequency);
      node.depth = toneParam(node, 'depth', o.depth === undefined ? 0.5 : o.depth);
      node.__started = false;
      node.start = function () {
        node.__started = true;
        return node;
      };
      node.wet = toneParam(node, 'wet', o.wet === undefined ? 1 : o.wet);
    }),
    BitCrusher: ToneEffect('BitCrusher', function (node, o) {
      node.bits = toneParam(node, 'bits', o.bits === undefined ? 4 : o.bits);
      node.wet = toneParam(node, 'wet', o.wet === undefined ? 1 : o.wet);
    }),
    Phaser: ToneEffect('Phaser', function (node, o) {
      node.frequency = toneParam(node, 'frequency', o.frequency === undefined ? 0.5 : o.frequency);
      node.octaves = o.octaves === undefined ? 3 : o.octaves;
      node.baseFrequency = o.baseFrequency === undefined ? 350 : o.baseFrequency;
    })
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
      createGain: makeGainNode,
      createDynamicsCompressor: makeCompressorNode
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

// ChainCanvas adapter stub. ChainEditing owns mutation sequencing; this
// keeps only accepted rendered state for the Tone-node assertions.
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
    getCurrentLayout: function () {
      return {};
    },
    renderModel: function (model) {
      canvasModel = copyModel(model);
      return true;
    },
    renderNodeParam: function (nodeId, paramId, value) {
      var entry = null;
      for (var i = 0; i < canvasModel.length; i++) {
        if (canvasModel[i].id === nodeId) {
          entry = canvasModel[i];
          break;
        }
      }
      if (!entry) {
        return false;
      }
      entry.params[paramId] = value;
      return true;
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

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  installToneStub(sandbox);
  loadSrc(sandbox, 'src/agent-ui.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/node-types.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js');
  loadSrc(sandbox, 'src/node-limiter.js'); // terminal limiter for the chain rules
  loadSrc(sandbox, 'src/param-controls.js');
  loadSrc(sandbox, 'src/tone-adapter.js');
  loadSrc(sandbox, 'src/node-pitchshift.js');
  loadSrc(sandbox, 'src/node-tremolo.js');
  loadSrc(sandbox, 'src/node-bitcrusher.js');
  loadSrc(sandbox, 'src/node-phaser.js');
  installChainCanvasStub(sandbox);
  sandbox.Persistence = { saveCurrentChain: function () {} };
  sandbox.PresetsUI = { markModified: function () {} };
  loadSrc(sandbox, 'src/chain-editing.js');
  loadSrc(sandbox, 'src/mcp-tools.js');

  var AG = sandbox.AudioGraph;
  var NT = sandbox.NodeTypes;

  var TYPES = ['pitchshift', 'tremolo', 'bitcrusher', 'phaser'];
  var LABELS = {
    pitchshift: 'Pitch Shift',
    tremolo: 'Tremolo',
    bitcrusher: 'Bitcrusher',
    phaser: 'Phaser'
  };

  // --------------------------------------------------------------------
  console.log('A. registration: four types, right metadata, clean specs');
  // --------------------------------------------------------------------

  TYPES.forEach(function (type) {
    check(NT.getAllTypes().indexOf(type) !== -1, 'A1: ' + type + ' listed in NodeTypes');
    check(NT.getLabel(type) === LABELS[type], 'A1: ' + type + ' label is ' + LABELS[type]);
    // Promoted out of experimental by owner sign-off 2026-08-31 (arrived
    // experimental with the cycle-4 round; autotune stays badged).
    check(!NT.isExperimental(type), 'A1: ' + type + ' is NOT experimental (promoted)');
    var spec = NT.getParamSpec(type);
    check(spec.length > 0, 'A2: ' + type + ' has a non-empty paramSpec');
    check(
      spec.every(function (s) { return typeof s.set !== 'function'; }),
      'A2: ' + type + ' registered spec carries no set functions'
    );
  });

  var psSpec = NT.getParamSpec('pitchshift');
  check(psSpec.length === 2 && psSpec[0].id === 'pitch' && psSpec[0].min === -12 && psSpec[0].max === 12 &&
    psSpec[0].default === 0 && psSpec[0].step === 1 && psSpec[0].unit === 'st', 'A3: pitchshift pitch spec exact');
  check(psSpec[1].id === 'mix' && psSpec[1].min === 0 && psSpec[1].max === 100 && psSpec[1].default === 100,
    'A3: pitchshift mix spec exact');
  var trSpec = NT.getParamSpec('tremolo');
  check(trSpec.length === 2 && trSpec[0].id === 'rateHz' && trSpec[0].default === 5 && trSpec[0].unit === 'Hz' &&
    trSpec[1].id === 'depth' && trSpec[1].default === 50 && trSpec[1].unit === '%', 'A3: tremolo specs exact');
  var bcSpec = NT.getParamSpec('bitcrusher');
  check(bcSpec.length === 2 && bcSpec[0].id === 'bits' && bcSpec[0].min === 1 && bcSpec[0].max === 8 &&
    bcSpec[0].default === 4 && bcSpec[1].id === 'mix' && bcSpec[1].default === 50, 'A3: bitcrusher specs exact');
  var phSpec = NT.getParamSpec('phaser');
  check(phSpec.length === 3 && phSpec[0].id === 'rateHz' && phSpec[0].default === 0.5 &&
    phSpec[1].id === 'depth' && phSpec[1].default === 60 &&
    phSpec[2].id === 'baseHz' && phSpec[2].default === 350, 'A3: phaser specs exact');

  // --------------------------------------------------------------------
  console.log('B. factories: constructor receives resolved defaults, composite wires');
  // --------------------------------------------------------------------

  AG.buildGraph([{ id: 'ps1', type: 'pitchshift', params: {} }]);
  await settle();
  var psComp = AG.getNodeInstance('ps1');
  check(!!psComp && !!psComp.tone && psComp.tone.__fakeToneName === 'PitchShift', 'B1: pitchshift built a Tone PitchShift');
  check(psComp.tone.__ctorOptions.pitch === 0 && approx(psComp.tone.__ctorOptions.wet, 1),
    'B1: defaults resolved — pitch 0, wet 1 (mix 100%)');
  check(
    psComp.input.__nodeTypeName === 'GainNode' && psComp.output.__nodeTypeName === 'GainNode' &&
    sandbox.AudioEngine.sourceNode.__connectsTo(psComp.input) && psComp.output.__connectsTo(AG.getChainGate()),
    'B1: AE-7 composite wired into the chain (sourceNode->input, output->gate)'
  );

  AG.buildGraph([{ id: 'tr1', type: 'tremolo', params: { rateHz: 8, depth: 80 } }]);
  await settle();
  var trComp = AG.getNodeInstance('tr1');
  check(!!trComp && trComp.tone.__fakeToneName === 'Tremolo', 'B2: tremolo built');
  check(trComp.tone.__ctorOptions.frequency === 8 && approx(trComp.tone.__ctorOptions.depth, 0.8),
    'B2: explicit params won over defaults (8 Hz, 80% -> depth 0.8)');
  check(trComp.tone.__started === true, 'B2: tremolo LFO started at creation');
  check(psComp.tone.__disposed === true, 'B2: dropped pitchshift instance disposed by the rebuild');

  AG.buildGraph([
    { id: 'bc1', type: 'bitcrusher', params: {} },
    { id: 'ph1', type: 'phaser', params: {} }
  ]);
  await settle();
  var bcComp = AG.getNodeInstance('bc1');
  var phComp = AG.getNodeInstance('ph1');
  check(!!bcComp && bcComp.tone.__ctorOptions.bits === 4 && approx(bcComp.tone.wet.value, 0.5),
    'B3: bitcrusher defaults (4 bits, wet 0.5)');
  check(!!phComp && phComp.tone.__ctorOptions.frequency === 0.5 && approx(phComp.tone.__ctorOptions.octaves, 3.4) &&
    phComp.tone.__ctorOptions.baseFrequency === 350, 'B3: phaser defaults (0.5 Hz, depth 60% -> octaves 3.4, base 350)');

  // --------------------------------------------------------------------
  console.log('C. live writes: applyParam maps every param onto the Tone node');
  // --------------------------------------------------------------------

  NT.applyParam('pitchshift', psComp, 'pitch', -4);
  NT.applyParam('pitchshift', psComp, 'mix', 40);
  check(psComp.tone.pitch === -4, 'C1: pitch assigned directly (plain setter)');
  check(
    psComp.tone.__ramps.some(function (r) {
      return r.param === 'wet' && approx(r.value, 0.4) && approx(r.rampTime, 0.015);
    }),
    'C1: mix 40% ramped wet to 0.4 over 15 ms'
  );

  NT.applyParam('tremolo', trComp, 'rateHz', 8);
  NT.applyParam('tremolo', trComp, 'depth', 80);
  check(
    trComp.tone.__ramps.some(function (r) { return r.param === 'frequency' && r.value === 8; }) &&
    trComp.tone.__ramps.some(function (r) { return r.param === 'depth' && approx(r.value, 0.8); }),
    'C2: rateHz ramped raw; depth % ramped /100'
  );

  NT.applyParam('bitcrusher', bcComp, 'bits', 6);
  NT.applyParam('bitcrusher', bcComp, 'mix', 25);
  check(
    bcComp.tone.__ramps.some(function (r) { return r.param === 'bits' && r.value === 6; }) &&
    bcComp.tone.__ramps.some(function (r) { return r.param === 'wet' && approx(r.value, 0.25); }),
    'C3: bits ramped raw; mix % ramped /100'
  );

  NT.applyParam('phaser', phComp, 'rateHz', 2);
  NT.applyParam('phaser', phComp, 'depth', 100);
  NT.applyParam('phaser', phComp, 'baseHz', 800);
  check(
    phComp.tone.__ramps.some(function (r) { return r.param === 'frequency' && r.value === 2; }),
    'C4: rateHz ramped'
  );
  check(approx(phComp.tone.octaves, 5) && phComp.tone.baseFrequency === 800,
    'C4: depth 100% -> octaves 5; baseHz assigned directly');

  var rampCountBefore = phComp.tone.__ramps.length;
  NT.applyParam('phaser', phComp, 'nonsense', 1);
  NT.applyParam('phaser', null, 'rateHz', 1);
  check(phComp.tone.__ramps.length === rampCountBefore, 'C5: unknown param / null instance are no-ops');

  // --------------------------------------------------------------------
  console.log('D. WebMCP integration: add_node enum, capabilities, set_param fast path');
  // --------------------------------------------------------------------

  var addNodeDef = getTool(sandbox, 'add_node');
  var enumValues = addNodeDef.inputSchema.properties.type.enum;
  check(
    TYPES.every(function (t) { return enumValues.indexOf(t) !== -1; }),
    'D1: add_node type enum includes all four Tone types (live registry)'
  );

  var caps = await getTool(sandbox, 'get_capabilities').execute({});
  check(
    caps && caps.nodeTypes && caps.nodeTypes.pitchshift && caps.nodeTypes.pitchshift.pitch &&
    caps.nodeTypes.pitchshift.pitch.range[0] === -12 && caps.nodeTypes.pitchshift.pitch.range[1] === 12,
    'D2: get_capabilities reports pitchshift pitch range [-12, 12]'
  );
  check(
    caps && Object.keys(caps.experimental || {}).length === 0,
    'D2: no Tone type carries the experimental flag after promotion (autotune not loaded here)'
  );

  // Seed a chain with the terminal limiter the chain rules require, plus
  // a live pitchshift to mutate.
  await sandbox.ChainEditing.apply({
    source: 'startup',
    candidate: [
      { id: 't1', type: 'pitchshift', params: { pitch: 0, mix: 100 } },
      { id: 'n6', type: 'limiter', params: { ceiling: -1, release: 50 } }
    ],
    forceStructural: true
  });

  var liveComp = AG.getNodeInstance('t1');
  check(!!liveComp && liveComp.tone.__fakeToneName === 'PitchShift', 'D3: live pitchshift instance before set_param');

  var buildGraphCalls = 0;
  var realBuildGraph = AG.buildGraph;
  AG.buildGraph = function () {
    buildGraphCalls += 1;
    return realBuildGraph.apply(AG, arguments);
  };
  var setResult = await getTool(sandbox, 'set_param').execute({
    nodeId: 't1',
    param: 'pitch',
    value: 3
  });
  AG.buildGraph = realBuildGraph;
  await settle();

  check(setResult && setResult.applied === true, 'D4: set_param resolved applied:true');
  check(buildGraphCalls === 0, 'D4: ZERO buildGraph calls — the param-only fast path held');
  check(AG.getNodeInstance('t1') === liveComp, 'D4: same physical instance reused (===)');
  check(liveComp.tone.pitch === 3, 'D4: live Tone node received pitch 3');

  // set_param range honesty: a param with no AGENT_PARAM_POLICY entry
  // falls back to its registered paramSpec range with treatment 'clamp'
  // (the registry-range fallback in planSetParam) — never lands raw.
  var outResult = await getTool(sandbox, 'set_param').execute({
    nodeId: 't1',
    param: 'pitch',
    value: 99
  });
  await settle();
  check(
    outResult && outResult.applied === true &&
    outResult.clamped && outResult.clamped.length === 1 &&
    outResult.clamped[0].requested === 99 && outResult.clamped[0].applied === 12,
    'D5: pitch 99 clamped to the spec max 12 with a clamped[] disclosure'
  );
  check(liveComp.tone.pitch === 12, 'D5: live Tone node received the clamped 12');

  // --------------------------------------------------------------------
  console.log('E. sound-design guide: complete vocabulary for ALL four Tone types');
  // --------------------------------------------------------------------

  var guide = await getTool(sandbox, 'get_capabilities').execute({ focus: 'sound_design' });
  check(guide && guide.focus === 'sound_design', 'E1: guide served for focus sound_design');
  check(
    guide && guide.vocabulary && Array.isArray(guide.vocabulary.transposed) &&
    guide.vocabulary.transposed.indexOf('pitchshift pitch -4..+4 st') !== -1 &&
    guide.vocabulary.transposed.some(function (s) { return /^Negative lowers/.test(s); }),
    'E1: transposed maps to pitchshift pitch + carries the sign advisory'
  );
  check(
    guide && guide.vocabulary && Array.isArray(guide.vocabulary.spacey) &&
    guide.vocabulary.spacey.indexOf('phaser rateHz 0.3..1 Hz') !== -1 &&
    guide.vocabulary.spacey.indexOf('phaser depth 40..70%') !== -1,
    'E1: spacey maps to phaser rate/depth inside the spec ranges'
  );
  check(
    guide && guide.vocabulary && Array.isArray(guide.vocabulary.warble) &&
    guide.vocabulary.warble.indexOf('tremolo rateHz 4..7 Hz') !== -1 &&
    guide.vocabulary.warble.indexOf('tremolo depth 30..60%') !== -1,
    'E1: warble maps to tremolo rate/depth inside the spec ranges'
  );
  check(
    guide && guide.vocabulary && Array.isArray(guide.vocabulary.lofi) &&
    guide.vocabulary.lofi.indexOf('bitcrusher bits 3..5') !== -1 &&
    guide.vocabulary.lofi.indexOf('bitcrusher mix 20..45%') !== -1,
    'E1: lofi maps to bitcrusher bits/mix inside the spec ranges'
  );
  // The coverage property the owner asked for: every one of the four
  // Tone types is reachable by at least one plain-language intent.
  var coveredTypes = [];
  Object.keys(guide.vocabulary).forEach(function (intent) {
    guide.vocabulary[intent].forEach(function (step) {
      var m = step.match(/^([a-z]+) /);
      if (m && TYPES.indexOf(m[1]) !== -1 && coveredTypes.indexOf(m[1]) === -1) {
        coveredTypes.push(m[1]);
      }
    });
  });
  check(
    TYPES.every(function (t) { return coveredTypes.indexOf(t) !== -1; }),
    'E2: all four Tone types have at least one vocabulary entry (' + coveredTypes.join(', ') + ')'
  );
  check(
    JSON.stringify(guide).length <= 2000,
    'E3: guide payload inside the 2026-08-31 ceiling of 2000 (' + JSON.stringify(guide).length + ')'
  );

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: Tone effects (pitchshift/tremolo/bitcrusher/phaser) contract');
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
