// Regression test for issue #1 — [P0] AudioNode reuse must require an ID
// AND TYPE match before a live instance can be carried into a new build.
//
// The bug: AudioGraph.buildGraph()'s Phase-1 resolution loop reused a live
// node whenever the ID matched, even when the requested TYPE changed — so a
// valid set_chain could relabel a live GainNode as the required terminal
// limiter. The model and the tool result then claimed a limiter existed
// while the physical audio graph still contained the old GainNode. The
// WebMCP catch-up path (src/mcp-tools.js applyCandidateViaUi) had the
// matching hole: it pre-captured instances by id alone and pushed param
// writes at whatever it captured.
//
// This file starts the committed-test convention (issue #9 formalizes the
// rest of the suite): a ZERO-dependency Node harness — no npm install, no
// build step — that stubs `window` plus the minimal Web Audio surface the
// src files touch, then loads the REAL src files (fs.readFileSync +
// vm.runInContext) into that sandbox, so the code under test is exactly
// what ships in index.html:
//
//   src/audio-graph.js   (graph model, buildGraph, getNodeInstance)
//   src/node-types.js    (UI metadata registry — applyParam dispatch)
//   src/node-gain.js     (real `gain` factory + applyParam)
//   src/node-limiter.js  (real `limiter` factory + applyParam)
//   src/mcp-tools.js     (the 8 agent tools, incl. set_chain/set_param)
//
// ChainCanvas/AudioEngine/AgentUI-shaped globals the tools guard on are
// stubbed to the minimum the mutation path reads; everything absent is an
// honest absence the tool layer already tolerates (that is its documented
// zero-dependency contract for Node harnesses).
//
// Assertions deliberately inspect the PHYSICAL instance objects the stub
// factories constructed (node shape + AudioParam values + recorded
// connect/disconnect edges), not only the serialized model — the bug's
// whole point was that the model lied while the physical graph was wrong.
//
// Run from a clean clone:  node tests/test-node-reuse-type-match.js
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

// ----------------------------------------------------------------------
// Assertions: collect failures so one run reports everything, exit 1 at
// the end if any check failed.
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
// (FADE_S*1000 + 5 = ~20ms after the call). 60ms is a comfortable settle
// for that timer on any machine; every "await settle()" below is waiting
// for exactly that commit.
function settle() {
  return sleep(60);
}

// ----------------------------------------------------------------------
// Minimal Web Audio stubs. Shapes mirror the real spec'd nodes closely
// where the assertions lean on them: a GainNode has `.gain` and NO
// `.threshold`; a DynamicsCompressorNode has `.threshold/.knee/.ratio/
// .attack/.release` and NO `.gain`. AudioParams support exactly the
// automation surface rampGateTo() drives. connect/disconnect are recorded
// so teardown/rewire topology is assertable.
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
  // Native spec defaults for the params, so a factory that failed to write
  // would be distinguishable from one that wrote the right value.
  node.threshold = makeParam(-24);
  node.knee = makeParam(30);
  node.ratio = makeParam(12);
  node.attack = makeParam(0.003);
  node.release = makeParam(0.25);
  return node;
}

// ----------------------------------------------------------------------
// The sandbox: a vm context whose global IS `window` (the src files are
// plain <script> IIFEs that read/write window.X), with host timers and a
// no-DOM document stub passed through — everything the loaded files need
// and nothing they merely tolerate.
// ----------------------------------------------------------------------
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
    // ensureSafeOutputNote() probes for a DOM; no DOM here (its own
    // try/catch also tolerates that, this just keeps the probe quiet).
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

// ----------------------------------------------------------------------
// ChainCanvas stub — just enough of src/canvas.js's exported surface for
// the mutation tools: getCurrentModel (read-only copy), isDragActive
// (always idle — no drag queue), and loadModel, which mirrors the real
// one's essentials for this test: take ownership of copies, then rebuild
// the audio graph via the same guarded call rebuildGraph() makes.
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
    }
  };
}

// Record every NodeTypes.applyParam dispatch so the catch-up guard is
// directly observable: the regression must show that NO param write ever
// targets an instance whose type no longer matches the entry. The wrapper
// records BEFORE delegating, so a call that throws inside the real
// applyParam (what the unguarded code did to the stale GainNode —
// `node.threshold` is undefined there) is still captured.
function installApplyParamRecorder(sandbox) {
  var calls = [];
  var real = sandbox.NodeTypes.applyParam;
  sandbox.NodeTypes.applyParam = function (type, node, paramId, value) {
    calls.push({ type: type, node: node, paramId: paramId, value: value });
    return real(type, node, paramId, value);
  };
  return calls;
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
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/node-types.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js'); // issue #5: the ramp helper the node applyParam handlers call
  loadSrc(sandbox, 'src/node-gain.js');
  loadSrc(sandbox, 'src/node-limiter.js');
  loadSrc(sandbox, 'src/mcp-tools.js');
  installChainCanvasStub(sandbox);
  var applyParamCalls = installApplyParamRecorder(sandbox);

  var AG = sandbox.AudioGraph;

  // --------------------------------------------------------------------
  console.log('A. buildGraph: an id that CHANGES TYPE gets a fresh instance');
  // --------------------------------------------------------------------

  AG.buildGraph([{ id: 'n1', type: 'gain', params: { gainDb: 6 } }]);
  await settle();

  var gainInst = AG.getNodeInstance('n1');
  check(!!gainInst, 'A1: live instance exists for n1 after the first build');
  check(
    gainInst && gainInst.__nodeTypeName === 'GainNode',
    'A1: physical node is a GainNode'
  );
  check(
    gainInst && !('threshold' in gainInst),
    'A1: the GainNode has no limiter threshold param'
  );
  check(
    gainInst && approx(gainInst.gain.value, Math.pow(10, 6 / 20)),
    'A1: factory applied gainDb=6 to the physical .gain param'
  );
  var modelA = AG.getModel();
  check(
    modelA.length === 1 && modelA[0].id === 'n1' && modelA[0].type === 'gain',
    'A1: serialized model says one gain node'
  );

  // The issue's exact shape: a valid model in which the gain id becomes
  // the SOLE TERMINAL LIMITER.
  AG.buildGraph([{ id: 'n1', type: 'limiter', params: { ceiling: -6, release: 100 } }]);
  await settle();

  var limInst = AG.getNodeInstance('n1');
  check(
    limInst !== gainInst,
    'A2: type change created a FRESH instance (old GainNode not relabeled)'
  );
  check(
    limInst && limInst.__nodeTypeName === 'DynamicsCompressorNode',
    'A2: physical node is a DynamicsCompressorNode'
  );
  check(
    limInst && !('gain' in limInst),
    'A2: physical node has no GainNode-style .gain param'
  );
  check(
    limInst && 'threshold' in limInst && approx(limInst.threshold.value, -6),
    'A2: ceiling applied to the physical .threshold (-6 dB)'
  );
  check(
    limInst && 'release' in limInst && approx(limInst.release.value, 0.1),
    'A2: release applied ms->s on the physical node (100 ms -> 0.1 s)'
  );
  check(
    limInst &&
      limInst.ratio !== undefined &&
      limInst.ratio.value === 20 &&
      limInst.attack.value === 0 &&
      limInst.knee.value === 0,
    'A2: limiter fixed safety params intact (ratio 20, attack 0, knee 0)'
  );
  var modelA2 = AG.getModel();
  check(
    modelA2.length === 1 &&
      modelA2[0].type === 'limiter' &&
      modelA2[0].params.ceiling === -6 &&
      modelA2[0].params.release === 100,
    'A2: serialized model says one limiter with the requested params'
  );
  check(
    gainInst.__connectionsTo.length === 0,
    'A2: the replaced GainNode was disconnected in teardown'
  );
  check(
    sandbox.AudioEngine.sourceNode.__connectsTo(limInst),
    'A2: sourceNode now feeds the fresh limiter'
  );
  check(
    limInst.__connectsTo(AG.getChainGate()),
    'A2: the fresh limiter feeds the chain gate'
  );

  // --------------------------------------------------------------------
  console.log('B. buildGraph: same id + same type still REUSES the instance');
  // --------------------------------------------------------------------

  AG.buildGraph([{ id: 'n1', type: 'limiter', params: { ceiling: -3, release: 200 } }]);
  await settle();

  check(
    AG.getNodeInstance('n1') === limInst,
    'B1: instance identity preserved (=== the same object across the rebuild)'
  );
  // buildGraph deliberately does NOT re-apply params to a reused instance
  // (documented in src/audio-graph.js; the param-apply half of a mutation
  // lives in the tool/UI catch-up path, asserted in D). So "state
  // preserved" here means the DSP state the instance was created with is
  // still intact after the rebuild — nothing was reset, nothing clobbered.
  check(
    limInst &&
      'threshold' in limInst &&
      approx(limInst.threshold.value, -6) &&
      'release' in limInst &&
      approx(limInst.release.value, 0.1),
    'B1: internal state intact across the rebuild (threshold -6, release 0.1 s from creation)'
  );
  check(
    sandbox.AudioEngine.sourceNode.__connectsTo(limInst) &&
      limInst.__connectsTo(AG.getChainGate()),
    'B1: reused instance rewired into the chain'
  );

  // --------------------------------------------------------------------
  console.log('C. the set_chain reproduction through the real tool (issue payload)');
  // --------------------------------------------------------------------

  // Seed a default-chain-shaped live graph (src/default-preset.js's ids):
  // n1 a live GainNode, n6 the terminal limiter.
  sandbox.ChainCanvas.loadModel([
    { id: 'n1', type: 'gain', params: { gainDb: 0 } },
    { id: 'n6', type: 'limiter', params: { ceiling: -1, release: 50 } }
  ]);
  await settle();

  var oldGain = AG.getNodeInstance('n1');
  var oldN6 = AG.getNodeInstance('n6');
  check(
    oldGain &&
      oldGain.__nodeTypeName === 'GainNode' &&
      oldN6 &&
      oldN6.__nodeTypeName === 'DynamicsCompressorNode',
    'C1: seeded — n1 is a live GainNode, n6 a live limiter'
  );

  applyParamCalls.length = 0;
  var setResult = await getTool(sandbox, 'set_chain').execute({
    chain: {
      schemaVersion: 1,
      name: 'agent chain',
      nodes: [{ id: 'n1', type: 'limiter', params: { ceiling: -6, release: 100 } }]
    }
  });
  await settle();

  check(
    setResult && setResult.applied === true,
    'C2: tool resolved applied:true (as in the issue)'
  );
  var newInst = AG.getNodeInstance('n1');
  check(
    newInst !== oldGain && newInst.__nodeTypeName === 'DynamicsCompressorNode',
    'C2: physical n1 is a fresh limiter — NOT the relabeled old GainNode'
  );
  check(
    newInst !== oldN6,
    'C2: fresh limiter is not the dropped n6 instance either'
  );
  check(
    newInst &&
      'threshold' in newInst &&
      approx(newInst.threshold.value, -6) &&
      'release' in newInst &&
      approx(newInst.release.value, 0.1),
    'C2: factory params landed on the physical node (ceiling -6, release 0.1 s)'
  );
  check(
    oldGain.__connectionsTo.length === 0 && oldN6.__connectionsTo.length === 0,
    'C2: both old instances disconnected from the live graph'
  );
  // The mcp-tools half of the guard: the parameter catch-up must never
  // write onto an instance whose type no longer matches the entry.
  var staleWrites = applyParamCalls.filter(function (call) {
    return call.node === oldGain || call.node === oldN6;
  });
  check(
    staleWrites.length === 0,
    'C2: catch-up wrote no params onto stale/wrong-typed instances'
  );
  var modelC = AG.getModel();
  check(
    modelC.length === 1 &&
      modelC[0].id === 'n1' &&
      modelC[0].type === 'limiter' &&
      modelC[0].params.ceiling === -6,
    'C2: committed model is exactly the one limiter node'
  );

  // --------------------------------------------------------------------
  console.log('D. same-type param tweak through set_param: reuse + applied state');
  // --------------------------------------------------------------------

  applyParamCalls.length = 0;
  var paramResult = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n1',
    param: 'ceiling',
    value: -3
  });
  await settle();

  check(paramResult && paramResult.applied === true, 'D1: set_param resolved applied:true');
  check(
    AG.getNodeInstance('n1') === newInst,
    'D1: same id + same type still reuses the SAME instance (===)'
  );
  check(
    newInst &&
      'threshold' in newInst &&
      approx(newInst.threshold.value, -3),
    'D1: catch-up applied ceiling -3 to the live physical node'
  );
  var sawWrite = applyParamCalls.some(function (call) {
    return (
      call.node === newInst &&
      call.paramId === 'ceiling' &&
      call.value === -3
    );
  });
  check(
    sawWrite,
    'D1: the apply went through NodeTypes.applyParam on the reused instance'
  );

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: node reuse requires id AND type match (issue #1)');
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
