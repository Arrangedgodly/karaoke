// Test for issue #9 — the WebMCP safety REFUSALS hold through the real
// tool path, and every refusal leaves the model AND the physical audio
// graph untouched.
//
// The loudness-safety contract publishes (get_capabilities) that:
//   - the terminal limiter is host-protected — removing it is a hard
//     reject (limiter-required-terminal);
//   - nothing may sit AFTER the limiter (limiter-required-terminal);
//   - the limiter ceiling's agent range is [-12, -3] dB with treatment
//     REJECT (rq3) — an unsafe ceiling is refused, not clamped.
//
// This file drives those refusals through the REAL mutation pipeline
// (src/mcp-tools.js's execute -> validate -> drag-settle -> plan ->
// apply-on-success), exactly like test C of
// tests/test-node-reuse-type-match.js: a live engine stub (started), the
// REAL src/audio-graph.js + all six node files so the seeded chain has
// real physical instances, the REAL src/agent-ui.js so refusals are
// asserted against its operator-disclosure contract, and a ChainCanvas
// stub whose loadModel rebuilds the graph (the single write path).
//
// The seed is the shipped default chain (src/default-preset.js): n1..n6
// with n6 the terminal limiter at its policy-conforming ceiling -3 dB.
// Every refusal is followed by a FULL state comparison — canvas model,
// AudioGraph's committed model, physical instance identity, and the
// limiter's locked/param state — so "refused" can never quietly mean
// "half-applied".
//
// Run from a clean clone:  node tests/test-safety-refusals.js
// (or via the runner:      node tests/run.js safety-refusals)
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
// (FADE_S*1000 + 5 = ~20ms after the call). 60ms is a comfortable settle.
function settle() {
  return sleep(60);
}

// Order-insensitive structural equality for the model layer's plain-JSON
// shapes (same helper as the other tests).
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
// Minimal Web Audio stubs — recording connect/disconnect edges so
// topology is assertable, with the param surfaces the six real node
// factories write (GainNode.gain; DynamicsCompressor threshold/knee/
// ratio/attack/release; BiquadFilter frequency/Q/gain; Delay delayTime;
// Convolver buffer).
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

function makeConvolverNode() {
  var node = makeBaseNode('ConvolverNode');
  node.buffer = null;
  return node;
}

// ----------------------------------------------------------------------
// Minimal DOM element stub — enough for the REAL src/agent-ui.js to
// render toasts (so refusal disclosures are asserted on real output):
// element creation/attributes, appendChild/removeChild/firstChild, class
// queries, click listeners the test can fire.
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
    querySelector: function (selector) {
      if (selector.charAt(0) === '.') {
        var cls = selector.slice(1);
        for (var i = 0; i < el.children.length; i++) {
          var classes = String(el.children[i].className).split(/\s+/);
          if (classes.indexOf(cls) !== -1) {
            return el.children[i];
          }
        }
      }
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
// the DOM stub above (a body so toasts really render), and a STARTED
// engine exposing the full set of factories the six node files use.
// ----------------------------------------------------------------------
var domEvents = [];
var domListeners = {};

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
    document: {
      getElementById: function () {
        return null;
      },
      createElement: function (tag) {
        return makeElement(tag);
      },
      querySelector: function () {
        return null; // no .topbar -> AgentUI skips the chip, stays functional
      },
      addEventListener: function (type, fn) {
        (domListeners[type] = domListeners[type] || []).push(fn);
      },
      dispatchEvent: function (ev) {
        domEvents.push({ type: ev.type, detail: ev.detail });
        (domListeners[ev.type] || []).forEach(function (fn) {
          fn(ev);
        });
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
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: {
      currentTime: 0,
      destination: makeBaseNode('AudioDestinationNode'),
      createGain: makeGainNode,
      createDynamicsCompressor: makeCompressorNode,
      createBiquadFilter: makeBiquadFilterNode,
      createDelay: makeDelayNode,
      createConvolver: makeConvolverNode
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
// ChainCanvas adapter stub. ChainEditing is the only graph/model writer.
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
    getCurrentLayout: function () {
      return {};
    },
    renderModel: function (model) {
      canvasModel = copyModel(model);
      return true;
    },
    renderNodeParam: function (id, param, value) {
      for (var i = 0; i < canvasModel.length; i++) {
        if (canvasModel[i].id === id) {
          canvasModel[i].params[param] = value;
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

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  loadSrc(sandbox, 'src/agent-ui.js');
  loadSrc(sandbox, 'src/effect-catalog.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js'); // issue #5: the ramp helper the node applyParam handlers call
  loadSrc(sandbox, 'src/node-gain.js');
  loadSrc(sandbox, 'src/node-compressor.js');
  loadSrc(sandbox, 'src/node-eq.js');
  loadSrc(sandbox, 'src/node-delay.js');
  loadSrc(sandbox, 'src/node-reverb.js');
  loadSrc(sandbox, 'src/node-limiter.js');
  loadSrc(sandbox, 'src/default-preset.js');
  installChainCanvasStub(sandbox);
  loadSrc(sandbox, 'src/chain-editing.js');
  loadSrc(sandbox, 'src/mcp-tools.js');

  var AG = sandbox.AudioGraph;

  // Count undo pushes by wrapping the REAL AgentUI export (the recorder
  // technique the issue-#1 test uses for EffectCatalog.applyParam).
  var undoPushes = 0;
  var realPushUndo = sandbox.AgentUI.pushUndo;
  sandbox.AgentUI.pushUndo = function (entry) {
    undoPushes += 1;
    return realPushUndo(entry);
  };

  function lastMutationEvent() {
    var muts = domEvents.filter(function (e) {
      return e.type === 'agentui:mutation';
    });
    return muts.length > 0 ? muts[muts.length - 1].detail : null;
  }

  // Full observable state, for before/after refusal comparisons.
  function snapshot() {
    var instances = {};
    AG.getModel().forEach(function (entry) {
      instances[entry.id] = AG.getNodeInstance(entry.id);
    });
    return {
      canvas: sandbox.ChainCanvas.getCurrentModel(),
      graph: AG.getModel(),
      instances: instances,
      undoPushes: undoPushes
    };
  }

  function untouched(before, label) {
    var after = snapshot();
    check(
      deepEqual(after.canvas, before.canvas),
      label + ': canvas model untouched (still the exact seeded chain)'
    );
    check(
      deepEqual(after.graph, before.graph),
      label + ': AudioGraph\'s committed model untouched'
    );
    var sameIds = Object.keys(before.instances).every(function (id) {
      return after.instances[id] === before.instances[id];
    });
    check(
      sameIds,
      label + ': every physical instance is the SAME object (no rebuild, no swap)'
    );
    check(
      after.undoPushes === before.undoPushes,
      label + ': NO undo entry was pushed (there is nothing to undo)'
    );
    return after;
  }

  // --------------------------------------------------------------------
  console.log('0. seed the live default chain (n6 = terminal limiter @ -3 dB)');
  // --------------------------------------------------------------------
  await sandbox.ChainEditing.apply({
    source: 'startup',
    candidate: sandbox.DEFAULT_PRESET.nodes,
    forceStructural: true
  });

  var seedSnap = snapshot();
  check(
    seedSnap.canvas.length === 6 && seedSnap.canvas[5].id === 'n6' &&
      seedSnap.canvas[5].type === 'limiter',
    '0: seeded — 6 live nodes, n6 the terminal limiter'
  );
  var n6 = seedSnap.instances.n6;
  check(
    !!n6 &&
      n6.__nodeTypeName === 'DynamicsCompressorNode' &&
      approx(n6.threshold.value, -3) &&
      approx(n6.release.value, 0.05),
    '0: physical n6 is the limiter (ceiling -3 dB on .threshold, release 50 ms)'
  );
  var n5 = seedSnap.instances.n5;
  check(
    !!n5 && !!n5.wetGain && approx(n5.wetGain.gain.value, Math.sin((20 / 100) * Math.PI / 2)),
    '0: physical n5 is the reverb composite (wet gain = mix 20%)'
  );

  // The published policy this whole test enforces against, read from the
  // real tool (never restated): limiter ceiling [-12, -3] dB, reject.
  var caps = await getTool(sandbox, 'get_capabilities').execute({});
  var ceilingCaps = caps.nodeTypes && caps.nodeTypes.limiter
    ? caps.nodeTypes.limiter.ceiling
    : null;
  check(
    !!ceilingCaps &&
      ceilingCaps.range[0] === -12 &&
      ceilingCaps.range[1] === -3 &&
      ceilingCaps.action === 'reject',
    '0: get_capabilities publishes limiter ceiling [-12, -3] dB with treatment reject'
  );

  // --------------------------------------------------------------------
  console.log('A. remove_node on the terminal limiter is a hard refuse');
  // --------------------------------------------------------------------
  var snapA = snapshot();
  var resA = await getTool(sandbox, 'remove_node').execute({ nodeId: 'n6' });
  await settle();

  check(
    !!resA && resA.error === true && resA.code === 'limiter-required-terminal',
    'A1: remove_node(n6) refused with code limiter-required-terminal'
  );
  check(
    !!resA && resA.applied === null && /SAFETY LIMITER/.test(resA.reason || ''),
    'A1: the refusal says applied: null and names the SAFETY LIMITER'
  );
  var afterA = untouched(snapA, 'A2');
  check(
    afterA.instances.n6 === n6 &&
      approx(n6.threshold.value, -3) &&
      approx(n6.ratio.value, 20) &&
      approx(n6.attack.value, 0) &&
      approx(n6.knee.value, 0),
    'A2: the live limiter instance still exists with its locked safety params (ratio 20, attack 0, knee 0)'
  );
  check(
    n6.__connectionsTo.indexOf(AG.getChainGate()) !== -1,
    'A2: the limiter is still wired into the chain (feeds the chain gate)'
  );
  var evA = lastMutationEvent();
  check(
    !!evA && evA.rejected === true && /remove_node/.test(evA.summary || ''),
    'A3: the operator saw the refusal (agentui:mutation, rejected: true)'
  );

  // --------------------------------------------------------------------
  console.log('B. nothing may sit AFTER the limiter');
  // --------------------------------------------------------------------
  // (1) set_chain that keeps n6 but appends a gain node behind it.
  var snapB = snapshot();
  var nodesAfter = sandbox.ChainCanvas.getCurrentModel().concat([
    { id: 'after', type: 'gain', params: { gainDb: 0 } }
  ]);
  var resB = await getTool(sandbox, 'set_chain').execute({
    chain: { schemaVersion: 1, name: 'node after limiter', nodes: nodesAfter }
  });
  await settle();
  check(
    !!resB && resB.error === true && resB.code === 'limiter-required-terminal' &&
      resB.applied === null,
    'B1: set_chain with a node AFTER the limiter refused (limiter-required-terminal, nothing applied)'
  );
  untouched(snapB, 'B1');

  // (2) set_chain that moves the limiter mid-chain (duplicate position).
  var nodesMid = sandbox.ChainCanvas.getCurrentModel().slice();
  nodesMid.splice(5, 1); // take n6 out
  nodesMid.splice(4, 0, { id: 'n6', type: 'limiter', params: { ceiling: -3, release: 50 } });
  nodesMid.push({ id: 'tail', type: 'eq', params: { lowGain: 0, midGain: 0, highGain: 0 } });
  var resB2 = await getTool(sandbox, 'set_chain').execute({
    chain: { schemaVersion: 1, name: 'limiter mid-chain', nodes: nodesMid }
  });
  await settle();
  check(
    !!resB2 && resB2.error === true && resB2.code === 'limiter-required-terminal',
    'B2: set_chain moving the limiter out of the terminal slot refused'
  );

  // (3) add_node appending at the end (position omitted).
  var snapB3 = snapshot();
  var resB3 = await getTool(sandbox, 'add_node').execute({ type: 'gain' });
  await settle();
  check(
    !!resB3 && resB3.error === true && resB3.code === 'limiter-required-terminal' &&
      /AFTER the terminal limiter/.test(resB3.reason || ''),
    'B3: add_node with no position refused — appending would sit AFTER the terminal limiter'
  );
  untouched(snapB3, 'B3');

  // (4) add_node with an explicit past-the-limiter position.
  var resB4 = await getTool(sandbox, 'add_node').execute({ type: 'delay', position: 6 });
  await settle();
  check(
    !!resB4 && resB4.error === true && resB4.code === 'limiter-required-terminal',
    'B3: add_node at explicit position 6 (behind the limiter) refused'
  );
  untouched(snapB3, 'B3');

  // --------------------------------------------------------------------
  console.log('C. an unsafe limiter ceiling is refused, not clamped');
  // --------------------------------------------------------------------
  // -1 dB: inside the app's nominal range but above the published agent
  // max (-3) — exactly the old issue-#2 default that shipped unsafely.
  var snapC = snapshot();
  var resC1 = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n6',
    param: 'ceiling',
    value: -1
  });
  await settle();
  check(
    !!resC1 && resC1.error === true && resC1.code === 'PARAM_OUT_OF_RANGE' &&
      resC1.applied === null,
    'C1: set_param ceiling -1 dB refused with PARAM_OUT_OF_RANGE (nothing applied)'
  );
  check(
    !!resC1 && resC1.allowed &&
      resC1.allowed.min === -12 && resC1.allowed.max === -3 && resC1.allowed.unit === 'dB',
    'C1: the refusal carries the published allowed range [-12, -3] dB'
  );
  var afterC1 = untouched(snapC, 'C2');
  check(
    afterC1.instances.n6 === n6 && approx(n6.threshold.value, -3),
    'C2: the live limiter still sits at ceiling -3 dB (the unsafe value never reached the AudioParam)'
  );

  // -20 dB: below the published agent min (-12) — refused the same way.
  var resC2 = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n6',
    param: 'ceiling',
    value: -20
  });
  await settle();
  check(
    !!resC2 && resC2.error === true && resC2.code === 'PARAM_OUT_OF_RANGE' &&
      resC2.allowed.min === -12 && resC2.allowed.max === -3,
    'C3: set_param ceiling -20 dB refused with the same allowed range'
  );

  // The same unsafe ceiling smuggled in via a whole-chain payload.
  var nodesBadCeiling = sandbox.ChainCanvas.getCurrentModel().map(function (entry) {
    if (entry.id === 'n6') {
      return { id: 'n6', type: 'limiter', params: { ceiling: -1, release: 50 } };
    }
    return entry;
  });
  var resC4 = await getTool(sandbox, 'set_chain').execute({
    chain: { schemaVersion: 1, name: 'unsafe ceiling payload', nodes: nodesBadCeiling }
  });
  await settle();
  check(
    !!resC4 && resC4.error === true && resC4.code === 'PARAM_OUT_OF_RANGE',
    'C4: set_chain carrying an unsafe ceiling (-1 dB) refused too'
  );
  var afterC4 = untouched(snapC, 'C4');

  // --------------------------------------------------------------------
  console.log('D. control: a VALID mutation on the same setup applies (the refusals above are refusals, not a dead path)');
  // --------------------------------------------------------------------
  var resD = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n5',
    param: 'mix',
    value: 25
  });
  await settle();
  check(
    !!resD && resD.applied === true,
    'D1: control set_param (reverb mix 20 -> 25) applied'
  );
  var modelD = sandbox.ChainCanvas.getCurrentModel();
  check(
    modelD.length === 6 && modelD[4].params.mix === 25,
    'D1: the control edit landed in the live model (n5 mix 25)'
  );
  check(
    afterC4.instances.n5 !== AG.getNodeInstance('n5') ||
      approx(AG.getNodeInstance('n5').wetGain.gain.value, Math.sin((25 / 100) * Math.PI / 2)),
    'D1: the physical reverb wet gain followed (25%) — the write path is alive'
  );
  sandbox.AgentUI.undo();
  await settle();
  check(
    sandbox.ChainCanvas.getCurrentModel()[4].params.mix === 20 &&
      sandbox.AgentUI.canUndo() === false,
    'D1: control undone — back to mix 20, undo stack empty again'
  );

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: safety refusals hold and leave model + physical graph untouched (issue #9)');
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
