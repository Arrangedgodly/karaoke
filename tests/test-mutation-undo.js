// Test for issue #9 — one valid agent mutation applies to BOTH the model
// and the physical audio graph, is disclosed as a change summary, and
// Undo (the exact code path the toast's Undo button runs) restores BOTH
// exactly, leaving the undo stack empty.
//
// The mutation under test is the canonical harmless edit: set_param
// reverb mix 20 -> 40 on the shipped default chain (n5). The undo path
// is exercised END-TO-END through the real code:
//
//   src/mcp-tools.js  mutationExecute -> planSetParam -> snapshot ->
//                     applyCandidateViaUi (loadModel + live catch-up) ->
//                     AgentUI.pushUndo -> reportMutation (toast)
//   src/agent-ui.js   the REAL module: renders the toast, puts the Undo
//                     button on it, and undo() pops + runs restore()
//   the button       createUndoButton()'s click handler -> undo() — the
//                     test finds the rendered <button> and fires its
//                     click, i.e. the same call a human press makes.
//
// Physical fidelity is asserted directly on the stub AudioParams the real
// src/node-reverb.js factory created: the reverb composite returned by
// AudioGraph.getNodeInstance('n5') must keep its IDENTITY (same object —
// a param tweak must reuse the instance, not rebuild it) while its
// dryGain/wetGain crossfade follows mix 40, then return to the exact
// mix-20 values after Undo.
//
// Same committed-test convention as the other tests: ZERO-dependency
// Node harness, stub `window` + the minimal Web Audio/DOM surface, load
// the REAL src files (fs.readFileSync + vm.runInContext).
//
// Run from a clean clone:  node tests/test-mutation-undo.js
// (or via the runner:      node tests/run.js mutation-undo)
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
// Minimal Web Audio stubs (same shapes as the safety-refusals test: the
// six real node factories' full param surfaces, recorded edges).
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
// build its toast region, render toasts, attach the Undo button, and
// mark a toast undone. Class selectors match by membership (CSS
// semantics) so 'control agent-toast-undo' matches '.agent-toast-undo'.
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
// the DOM stub (a body so the toast region really renders), and a
// STARTED engine exposing every factory the six node files use.
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
    // promise keeps the (silent) convolver wet path from resolving.
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

// ChainCanvas stub — same single-write-path shape as the other tool-path
// tests: loadModel takes ownership of copies and rebuilds the graph.
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

function getTool(sandbox, name) {
  var defs = sandbox.McpTools.getDefs();
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].name === name) {
      return defs[i];
    }
  }
  throw new Error('test bug: tool def not found: ' + name);
}

function liveToasts(sandbox) {
  var region = null;
  for (var i = 0; i < sandbox.__body.children.length; i++) {
    if (sandbox.__body.children[i].id === 'agent-toast-region') {
      region = sandbox.__body.children[i];
      break;
    }
  }
  return region ? region.children.slice() : [];
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  loadSrc(sandbox, 'src/agent-ui.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/node-types.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js'); // issue #5: the ramp helper the node applyParam handlers call
  loadSrc(sandbox, 'src/node-gain.js');
  loadSrc(sandbox, 'src/node-compressor.js');
  loadSrc(sandbox, 'src/node-eq.js');
  loadSrc(sandbox, 'src/node-delay.js');
  loadSrc(sandbox, 'src/node-reverb.js');
  loadSrc(sandbox, 'src/node-limiter.js');
  loadSrc(sandbox, 'src/default-preset.js');
  loadSrc(sandbox, 'src/mcp-tools.js');
  installChainCanvasStub(sandbox);

  var AG = sandbox.AudioGraph;
  var DEFAULTS = sandbox.DEFAULT_PRESET.nodes;

  // Count undo pushes by wrapping the REAL AgentUI export (recorder
  // technique; behavior unchanged).
  var undoPushes = 0;
  var realPushUndo = sandbox.AgentUI.pushUndo;
  sandbox.AgentUI.pushUndo = function (entry) {
    undoPushes += 1;
    return realPushUndo(entry);
  };

  // The equal-power crossfade values the physical reverb must show.
  function wetAt(mix) {
    return Math.sin((mix / 100) * Math.PI / 2);
  }
  function dryAt(mix) {
    return Math.cos((mix / 100) * Math.PI / 2);
  }

  // --------------------------------------------------------------------
  console.log('0. seed the live default chain (n5 reverb mix 20)');
  // --------------------------------------------------------------------
  sandbox.ChainCanvas.loadModel(DEFAULTS);
  await settle();

  var reverb0 = AG.getNodeInstance('n5');
  check(
    !!reverb0 && !!reverb0.wetGain && !!reverb0.dryGain &&
      approx(reverb0.wetGain.gain.value, wetAt(20)) &&
      approx(reverb0.dryGain.gain.value, dryAt(20)),
    '0: physical n5 is the reverb composite at mix 20 (wet ' +
      wetAt(20).toFixed(4) + ', dry ' + dryAt(20).toFixed(4) + ')'
  );
  var instances0 = {};
  AG.getModel().forEach(function (entry) {
    instances0[entry.id] = AG.getNodeInstance(entry.id);
  });
  check(
    Object.keys(instances0).length === 6 && sandbox.AgentUI.canUndo() === false,
    '0: 6 live instances and the undo stack starts EMPTY'
  );

  // --------------------------------------------------------------------
  console.log('A. the valid mutation: set_param reverb mix 20 -> 40 on n5');
  // --------------------------------------------------------------------
  domEvents.length = 0;
  var res = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n5',
    param: 'mix',
    value: 40
  });
  await settle();

  check(!!res && res.applied === true, 'A1: set_param resolved applied:true');

  // The result's change summary — the diff the agent (and toast) reads.
  check(
    Array.isArray(res.changes) &&
      res.changes.length === 1 &&
      res.changes[0].node === 'n5' &&
      res.changes[0].change === 'params' &&
      res.changes[0].params.mix && res.changes[0].params.mix.from === 20 &&
      res.changes[0].params.mix.to === 40,
    'A1: changes reports exactly one diff — n5 params.mix 20 -> 40'
  );
  check(
    Array.isArray(res.clamped) && res.clamped.length === 0 &&
      Array.isArray(res.nodeIds) && res.nodeIds.join(',') === 'n5',
    'A1: nothing was clamped (40 is in policy) and nodeIds is [n5]'
  );

  // Model updated.
  var modelA = sandbox.ChainCanvas.getCurrentModel();
  var entryA = modelA.filter(function (e) { return e.id === 'n5'; })[0];
  check(
    !!entryA && entryA.params.mix === 40,
    'A2: the live MODEL updated (n5 params.mix = 40)'
  );

  // Physical updated — SAME instance, crossfade followed.
  var reverbA = AG.getNodeInstance('n5');
  check(
    reverbA === reverb0,
    'A3: the physical reverb instance is REUSED (=== the same object — a param tweak must not rebuild the node)'
  );
  check(
    !!reverbA &&
      approx(reverbA.wetGain.gain.value, wetAt(40)) &&
      approx(reverbA.dryGain.gain.value, dryAt(40)),
    'A3: the physical crossfade followed mix 40 (wet ' + wetAt(40).toFixed(4) +
      ', dry ' + dryAt(40).toFixed(4) + ')'
  );
  var otherNodesUntouched = ['n1', 'n2', 'n3', 'n4', 'n6'].every(function (id) {
    return AG.getNodeInstance(id) === instances0[id];
  });
  check(
    otherNodesUntouched,
    'A3: every OTHER physical instance is untouched (same objects, same positions)'
  );

  // The disclosure: a real toast rendered by the REAL AgentUI, carrying
  // the tool's one-line summary, and exactly ONE undo entry pushed.
  var toastsA = liveToasts(sandbox);
  check(toastsA.length === 1, 'A4: exactly one agent toast is rendered');
  var toastA = toastsA[0];
  check(
    !!toastA &&
      toastA.children.some(function (c) {
        return c.className === 'agent-toast-summary' &&
          c.textContent === 'Agent set Reverb mix to 40% (n5)';
      }),
    'A4: the toast summary is the tool\'s change summary (\'Agent set Reverb mix to 40% (n5)\')'
  );
  var mutEvA = domEvents.filter(function (e) {
    return e.type === 'agentui:mutation';
  })[0];
  check(
    !!mutEvA && mutEvA.detail.source === 'agent' && mutEvA.detail.nodeIds &&
      mutEvA.detail.nodeIds.join(',') === 'n5' && !mutEvA.detail.rejected,
    'A4: the agentui:mutation event fired with source agent, nodeIds [n5], not rejected'
  );
  check(
    undoPushes === 1 && sandbox.AgentUI.canUndo() === true,
    'A5: exactly ONE undo entry was pushed (stack non-empty)'
  );
  var undoBtnA = toastA ? toastA.querySelector('.agent-toast-undo') : null;
  check(
    !!undoBtnA &&
      String(undoBtnA.tagName).toUpperCase() === 'BUTTON' &&
      undoBtnA.textContent === 'Undo',
    'A5: the toast carries the keyboard-reachable Undo button'
  );

  // --------------------------------------------------------------------
  console.log('B. Undo — the exact path the toast button runs');
  // --------------------------------------------------------------------
  domEvents.length = 0;
  if (undoBtnA) {
    undoBtnA.__fire('click'); // createUndoButton()'s own click handler -> undo()
  }
  await settle();

  // The stack: popped, empty, and the event says so.
  var undoEv = domEvents.filter(function (e) {
    return e.type === 'agentui:undo';
  })[0];
  check(
    !!undoEv && undoEv.detail.label === 'set_param n5.mix 40%' &&
      undoEv.detail.remaining === 0,
    'B1: agentui:undo fired for the entry\'s label with remaining 0'
  );
  check(
    sandbox.AgentUI.canUndo() === false,
    'B1: the undo stack is EMPTY afterward'
  );

  // Model restored EXACTLY — the whole chain, not just the touched param.
  check(
    deepEqual(sandbox.ChainCanvas.getCurrentModel(), DEFAULTS),
    'B2: the canvas MODEL is exactly the seeded default chain again (byte-for-byte)'
  );
  check(
    deepEqual(AG.getModel(), DEFAULTS),
    'B2: AudioGraph\'s committed model matches the default chain too'
  );

  // Physical restored EXACTLY — same instance, crossfade back at 20.
  var reverbB = AG.getNodeInstance('n5');
  check(
    reverbB === reverb0,
    'B3: undo restored THROUGH the same instance (=== — no rebuild on restore either)'
  );
  check(
    !!reverbB &&
      approx(reverbB.wetGain.gain.value, wetAt(20)) &&
      approx(reverbB.dryGain.gain.value, dryAt(20)),
    'B3: the physical crossfade is back at mix 20 exactly (wet ' +
      wetAt(20).toFixed(4) + ', dry ' + dryAt(20).toFixed(4) + ')'
  );
  var allSame = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].every(function (id) {
    return AG.getNodeInstance(id) === instances0[id];
  });
  check(
    allSame,
    'B3: every physical instance across the chain is still the same object as before the mutation'
  );

  // The toast was marked undone (button removed, note appended).
  var toastsB = liveToasts(sandbox);
  var toastB = toastsB[toastsB.length - 1];
  check(
    !!toastB &&
      toastB.getAttribute('data-undone') === 'true' &&
      toastB.children.some(function (c) {
        return c.className === 'agent-toast-undone' &&
          c.textContent === 'Undone — set_param n5.mix 40%';
      }),
    'B4: the toast is marked \'Undone — set_param n5.mix 40%\''
  );
  check(
    !!toastB && toastB.querySelector('.agent-toast-undo') === null,
    'B4: the toast\'s Undo button was removed (nothing left to undo)'
  );

  // A second Undo through the same path is a safe no-op (stack empty).
  var undoResult = sandbox.AgentUI.undo();
  check(
    undoResult === null && sandbox.ChainCanvas.getCurrentModel()[4].params.mix === 20,
    'B5: a second undo() resolves null and changes nothing (stack stays honest)'
  );

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: one valid mutation applies to model + physical graph, and Undo restores both exactly (issue #9)');
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
