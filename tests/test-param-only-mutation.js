// Test for issue #5 — [P1] parameter-only WebMCP set_param path +
// click-safe ramps.
//
// The two halves of the issue, both exercised through the REAL tool path
// (getTool('set_param').execute(...) — the same call the WebMCP shim and
// the ?dev harness make) on the shipped default chain:
//
//   A. THE FAST PATH. A set_param is a param-only mutation by definition,
//      so it must ride the human slider path's own primitives instead of
//      the full model-loading path:
//        - the live physical instance is the SAME object (===) and its
//          AudioParam carries the new value via SCHEDULED automation
//          (cancel + setValueAtTime + linearRampToValueAtTime over the
//          real AudioParamRamp.RAMP_S — 10-20 ms — never a bare .value
//          write),
//        - NO AudioGraph.buildGraph (counted), NO ChainCanvas.loadModel
//          (stub-recorded), and the chain gate's automation log shows NO
//          duck (buildGraph's ramp-to-0.0001 is exactly what the old path
//          made set_param do),
//        - the chain card is NOT re-rendered — the stub records the card/
//          row update call (ChainCanvas.updateNodeParam) instead, and the
//          REAL src/param-controls.js updateControl() moves the rendered
//          slider + mono value span in place,
//        - persistence runs exactly as a human edit (one
//          Persistence.saveCurrentChain with the updated chain, one
//          PresetsUI.markModified),
//        - toast + undo behave as today (one summary toast, one undo
//          entry; Undo restores — through the full path, which is fine).
//
//   B. THE RAMP. Every registered parameter dispatch branch routes its
//      write through the shared helper with scheduled automation: gain;
//      compressor threshold/ratio/attack/release; EQ low/mid/high; delay
//      time/feedback/mix; reverb mix; and limiter ceiling/release. Unit
//      conversions and both crossfade sides are checked. Each write must
//      preserve its node instance without rebuilding or ducking the graph,
//      and the host-param-ramps 10-20 ms promise is checked against the real
//      RAMP_S constant. A pure-math click-risk
//      probe (the OfflineAudioContext-style discontinuity-energy
//      comparison, computed headlessly) shows the 15 ms linear ramp
//      removes the jump discontinuity a bare .value write leaves.
//
//   C. Refusals stay refusals: an out-of-policy value and a host-owned
//      param still reject with NOTHING applied — no ramp, no model write,
//      no persistence, no undo entry.
//
// Same committed-test convention as the rest of the suite: zero-dependency
// Node harness, stub `window` + the minimal Web Audio/DOM surface, load
// the REAL src files (fs.readFileSync + vm.runInContext). The AudioParam
// stub RECORDS every mutation channel — bare `.value =` writes (via an
// accessor property) and every automation call — so "scheduled, not
// instant" is asserted directly on the physical param object.
//
// Run from a clean clone:  node tests/test-param-only-mutation.js
// (or via the runner:      node tests/run.js param-only-mutation)
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

// ----------------------------------------------------------------------
// Assertions (same harness shape as the other tests).
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

// buildGraph() commits on the deferred rewire (FADE_S*1000 + 5 = ~20ms
// after the call). 60ms is a comfortable settle.
function settle() {
  return sleep(60);
}

// ----------------------------------------------------------------------
// RECORDING Web Audio stubs. Same node shapes as the other tests, except
// every AudioParam is an accessor-backed recorder: a bare `.value =`
// write is distinguishable from a SCHEDULED automation call, and every
// automation call logs { op, target/value, time } into a shared global
// log (automationLog) with the param object itself attached — so tests
// can slice "what happened during this set_param" by log index and ask
// both "was a ramp scheduled?" and "was the gate ducked?".
// ----------------------------------------------------------------------
var automationLog = [];

function makeParam(initial, name) {
  var p = { __paramName: name || '', __automation: [] };
  var stored = initial;
  Object.defineProperty(p, 'value', {
    get: function () {
      return stored;
    },
    set: function (v) {
      stored = v;
      var entry = { param: p, op: 'value', target: v, time: null };
      p.__automation.push(entry);
      automationLog.push(entry);
    },
    configurable: true,
    enumerable: true
  });
  function record(op, target, time) {
    var entry = { param: p, op: op, target: target, time: time };
    p.__automation.push(entry);
    automationLog.push(entry);
  }
  p.cancelScheduledValues = function (t) {
    record('cancelScheduledValues', null, t);
  };
  p.setValueAtTime = function (v, t) {
    stored = v;
    record('setValueAtTime', v, t);
  };
  p.linearRampToValueAtTime = function (v, t) {
    stored = v;
    record('linearRampToValueAtTime', v, t);
  };
  p.setTargetAtTime = function (v, t, tc) {
    record('setTargetAtTime', v, t, tc);
  };
  return p;
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
  node.gain = makeParam(1, 'gain');
  return node;
}

function makeCompressorNode() {
  var node = makeBaseNode('DynamicsCompressorNode');
  node.threshold = makeParam(-24, 'threshold');
  node.knee = makeParam(30, 'knee');
  node.ratio = makeParam(12, 'ratio');
  node.attack = makeParam(0.003, 'attack');
  node.release = makeParam(0.25, 'release');
  return node;
}

function makeBiquadFilterNode() {
  var node = makeBaseNode('BiquadFilterNode');
  node.type = 'allpass';
  node.frequency = makeParam(350, 'frequency');
  node.Q = makeParam(1, 'Q');
  node.gain = makeParam(0, 'filter.gain');
  return node;
}

function makeDelayNode() {
  var node = makeBaseNode('DelayNode');
  node.delayTime = makeParam(0, 'delayTime');
  return node;
}

function makeConvolverNode() {
  var node = makeBaseNode('ConvolverNode');
  node.buffer = null;
  return node;
}

// ----------------------------------------------------------------------
// Minimal DOM element stub — the same surface the other tool-path tests
// use, plus a settable innerHTML (ParamControls.render clears its
// container with innerHTML = '') and classList, so the REAL
// src/param-controls.js can render real slider rows into it.
// ----------------------------------------------------------------------
function makeElement(tag) {
  var el = {
    tagName: tag,
    id: '',
    className: '',
    type: '',
    title: '',
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
    },
    classList: {
      add: function () {},
      remove: function () {},
      toggle: function () {},
      contains: function () {
        return false;
      }
    }
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () {
      return '';
    },
    set: function (v) {
      if (v === '') {
        el.children.length = 0;
        el.children.forEach(function (c) {
          c.parentNode = null;
        });
      }
    },
    configurable: true
  });
  return el;
}

// ----------------------------------------------------------------------
// The sandbox.
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
        return null;
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
  // A NON-zero currentTime so ramp end times are visibly anchored to the
  // context clock (now + RAMP_S), not to a suspicious-looking 0.
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: {
      currentTime: 100,
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
// ChainCanvas adapter stub. ChainEditing owns graph/persistence/preset/Undo;
// these render methods only copy accepted state into the canvas model and
// move a visible control in place. Calls are recorded so the test can prove
// parameter edits do not replace cards.
// ----------------------------------------------------------------------
function installChainCanvasStub(sandbox, records) {
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
      records.loadModelCalls += 1;
      records.loadModelModels.push(copyModel(model));
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
      records.updateNodeParamCalls.push({ nodeId: nodeId, paramId: paramId, value: value });
      try {
        if (sandbox.ParamControls && typeof sandbox.ParamControls.updateControl === 'function') {
          sandbox.ParamControls.updateControl(nodeId, paramId, value);
        }
      } catch (err) {
        // Display-only in the real canvas too — never fails the write.
      }
      return true;
    },
    // Compatibility methods remain in the stub only so older assertions
    // can distinguish them; the production WebMCP path must not call them.
    loadModel: function (model) {
      records.loadModelCalls += 1;
      records.loadModelModels.push(copyModel(model));
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
      records.updateNodeParamCalls.push({ nodeId: nodeId, paramId: paramId, value: value });
      // The real canvas delegates the visible-control move to the REAL
      // ParamControls.updateControl (slider + mono span in place, no card
      // re-render); mirror that delegation so the component is exercised
      // through the same chain of calls the app makes.
      try {
        if (sandbox.ParamControls && typeof sandbox.ParamControls.updateControl === 'function') {
          sandbox.ParamControls.updateControl(nodeId, paramId, value);
        }
      } catch (err) {
        // Display-only in the real canvas too — never fails the write.
      }
      if (sandbox.Persistence) {
        records.persistenceCalls.push(copyModel(canvasModel));
        sandbox.Persistence.saveCurrentChain(canvasModel);
      }
      if (sandbox.PresetsUI) {
        sandbox.PresetsUI.markModified();
      }
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

// One scheduled-ramp assertion, shared by every param check below: the
// param's automation record (sliced from a baseline) must contain a
// ramp-style SCHEDULE to `target` spanning 10-20 ms from the context's
// currentTime — and must NOT contain any bare `.value` write.
function sawScheduledRamp(param, baseline, target, nowTime, rampS) {
  var ops = param.__automation.slice(baseline);
  var scheduled = ops.filter(function (e) {
    var durOk =
      typeof e.time === 'number' &&
      e.time >= nowTime + 0.010 - 1e-9 &&
      e.time <= nowTime + 0.020 + 1e-9;
    return (
      (e.op === 'linearRampToValueAtTime' || e.op === 'setTargetAtTime') &&
      approx(e.target, target) &&
      durOk
    );
  });
  var bareWrites = ops.filter(function (e) {
    return e.op === 'value';
  });
  return {
    ok: scheduled.length > 0 && bareWrites.length === 0,
    scheduled: scheduled,
    bareWrites: bareWrites,
    expectedRampS: rampS
  };
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
  loadSrc(sandbox, 'src/param-controls.js');
  loadSrc(sandbox, 'src/default-preset.js');

  var records = {
    loadModelCalls: 0,
    loadModelModels: [],
    updateNodeParamCalls: [],
    persistenceCalls: []
  };
  installChainCanvasStub(sandbox, records);

  var markModifiedCalls = 0;
  sandbox.PresetsUI = {
    getDisplayState: function () { return { name: 'Classic', modified: markModifiedCalls > 0 }; },
    markModified: function () {
      markModifiedCalls += 1;
    },
    setPersistenceWarning: function () {}
  };
  sandbox.Persistence = {
    saveCurrentChain: function (model) {
      records.persistenceCalls.push(model.map(function (entry) {
        return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
      }));
      return { saved: true };
    }
  };
  loadSrc(sandbox, 'src/chain-editing.js');
  loadSrc(sandbox, 'src/mcp-tools.js');

  var AG = sandbox.AudioGraph;
  var DEFAULTS = sandbox.DEFAULT_PRESET.nodes;
  var RAMP_S = sandbox.AudioParamRamp.RAMP_S;
  var NOW = sandbox.AudioEngine.audioContext.currentTime;

  // Count undo pushes by wrapping the REAL AgentUI export (recorder
  // technique; behavior unchanged).
  var undoPushes = 0;
  var realPushUndo = sandbox.AgentUI.pushUndo;
  sandbox.AgentUI.pushUndo = function (entry) {
    undoPushes += 1;
    return realPushUndo(entry);
  };

  // Count buildGraph calls by wrapping the REAL export (the fast path
  // must add ZERO).
  var buildGraphCalls = 0;
  var realBuildGraph = AG.buildGraph;
  AG.buildGraph = function (model, options) {
    buildGraphCalls += 1;
    return realBuildGraph(model, options);
  };

  // The equal-power crossfade values the reverb/delay mixes must show.
  function wetAt(mix) {
    return Math.sin((mix / 100) * Math.PI / 2);
  }
  function dryAt(mix) {
    return Math.cos((mix / 100) * Math.PI / 2);
  }

  // --------------------------------------------------------------------
  console.log('0. constants + seed the live default chain');
  // --------------------------------------------------------------------
  check(
    RAMP_S >= 0.010 && RAMP_S <= 0.020,
    '0: the shared ramp constant is inside the published 10-20 ms window (RAMP_S = ' +
      RAMP_S + ' s)'
  );

  await sandbox.ChainEditing.apply({
    source: 'startup',
    candidate: DEFAULTS,
    forceStructural: true
  });

  var instances0 = {};
  AG.getModel().forEach(function (entry) {
    instances0[entry.id] = AG.getNodeInstance(entry.id);
  });
  check(
    Object.keys(instances0).length === 6 &&
      Object.keys(instances0).every(function (id) {
        return !!instances0[id];
      }),
    '0: 6 live physical instances seeded from the default chain'
  );
  var reverb0 = instances0.n5;
  check(
    !!reverb0 &&
      approx(reverb0.wetGain.gain.value, wetAt(20)) &&
      approx(reverb0.dryGain.gain.value, dryAt(20)),
    '0: physical n5 reverb seeded at mix 20'
  );

  var gate = AG.getChainGate();
  var gateBase = gate.gain.__automation.length; // duck-detection baseline
  check(buildGraphCalls === 1 && records.loadModelCalls === 1,
    '0: the seed used exactly one ChainEditing graph commit + canvas render');

  // --------------------------------------------------------------------
  console.log('A. set_param reverb mix 20 -> 40 on n5 takes the FAST path');
  // --------------------------------------------------------------------
  // Per-mutation baselines: automation log index per param, buildGraph
  // count, stub records, undo/toast counts.
  var base = {
    buildGraph: buildGraphCalls,
    loadModel: records.loadModelCalls,
    updateNodeParam: records.updateNodeParamCalls.length,
    persistence: records.persistenceCalls.length,
    markModified: markModifiedCalls,
    undoPushes: undoPushes,
    wet: reverb0.wetGain.gain.__automation.length,
    dry: reverb0.dryGain.gain.__automation.length
  };

  var res = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n5',
    param: 'mix',
    value: 40
  });
  await settle();

  check(!!res && res.applied === true, 'A1: set_param resolved applied:true');
  check(
    Array.isArray(res.changes) &&
      res.changes.length === 1 &&
      res.changes[0].node === 'n5' &&
      res.changes[0].change === 'params' &&
      res.changes[0].params.mix.from === 20 &&
      res.changes[0].params.mix.to === 40 &&
      Array.isArray(res.clamped) &&
      res.clamped.length === 0,
    'A1: changes reports exactly one diff — n5 params.mix 20 -> 40, nothing clamped'
  );

  // (a) The authoritative models updated — canvas AND AudioGraph.
  var canvasEntry = sandbox.ChainCanvas.getCurrentModel().filter(function (e) {
    return e.id === 'n5';
  })[0];
  var graphEntry = AG.getModel().filter(function (e) {
    return e.id === 'n5';
  })[0];
  check(
    !!canvasEntry && canvasEntry.params.mix === 40,
    'A2: the canvas MODEL updated without loadModel (n5 params.mix = 40)'
  );
  check(
    !!graphEntry && graphEntry.params.mix === 40,
    'A2: AudioGraph\'s model bookkeeping updated via updateNodeParams (n5 params.mix = 40)'
  );

  // (b) Same physical instance, new value via SCHEDULED automation.
  var reverbA = AG.getNodeInstance('n5');
  check(
    reverbA === reverb0,
    'A3: the physical reverb instance is the SAME object (===) — no rebuild'
  );
  check(
    !!reverbA &&
      approx(reverbA.wetGain.gain.value, wetAt(40)) &&
      approx(reverbA.dryGain.gain.value, dryAt(40)),
    'A3: the physical crossfade now carries mix 40 (wet ' + wetAt(40).toFixed(4) +
      ', dry ' + dryAt(40).toFixed(4) + ')'
  );
  var wetRamp = sawScheduledRamp(reverb0.wetGain.gain, base.wet, wetAt(40), NOW, RAMP_S);
  var dryRamp = sawScheduledRamp(reverb0.dryGain.gain, base.dry, dryAt(40), NOW, RAMP_S);
  check(
    wetRamp.ok,
    'A3: wetGain.gain moved by SCHEDULED automation (ramp to ' + wetAt(40).toFixed(4) +
      ' over ' + RAMP_S + ' s at t=' + NOW + ') — not a bare .value write'
  );
  check(
    dryRamp.ok,
    'A3: dryGain.gain moved by SCHEDULED automation (ramp to ' + dryAt(40).toFixed(4) +
      ' over ' + RAMP_S + ' s at t=' + NOW + ') — not a bare .value write'
  );
  var otherUntouched = ['n1', 'n2', 'n3', 'n4', 'n6'].every(function (id) {
    return AG.getNodeInstance(id) === instances0[id];
  });
  check(otherUntouched, 'A3: every OTHER physical instance is the same, untouched object');

  // (c) No buildGraph, no loadModel, and NO duck on the chain gate.
  check(
    buildGraphCalls === base.buildGraph,
    'A4: ZERO buildGraph calls during set_param (was ' + base.buildGraph +
      ', still ' + buildGraphCalls + ')'
  );
  check(
    records.loadModelCalls === base.loadModel,
    'A4: ZERO canvas model renders during set_param (no card rebuild)'
  );
  var gateDuringSetParam = gate.gain.__automation.slice(gateBase);
  check(
    gateDuringSetParam.length === 0,
    'A4: the chain gate\'s automation log shows NO new duck/ramp during set_param (' +
      gateDuringSetParam.length + ' entries — the old path logged a ramp to 0.0001 here)'
  );

  // (d) The card/row update function was called instead of a re-render.
  check(
    records.updateNodeParamCalls.length === base.updateNodeParam + 1 &&
      records.updateNodeParamCalls[records.updateNodeParamCalls.length - 1].nodeId === 'n5' &&
      records.updateNodeParamCalls[records.updateNodeParamCalls.length - 1].paramId === 'mix' &&
      records.updateNodeParamCalls[records.updateNodeParamCalls.length - 1].value === 40,
    'A5: ChainCanvas.renderNodeParam was called exactly once with (n5, mix, 40) — the card/row update path, cards not replaced'
  );

  // (e) Persistence + unsaved state exactly as a human edit.
  check(
    records.persistenceCalls.length === base.persistence + 1 &&
      records.persistenceCalls[records.persistenceCalls.length - 1].filter(function (e) {
        return e.id === 'n5';
      })[0].params.mix === 40,
    'A6: Persistence.saveCurrentChain ran exactly ONCE, with the updated chain (autosave as a human edit)'
  );
  check(
    markModifiedCalls === base.markModified + 1,
    'A6: PresetsUI.markModified ran exactly once (unsaved dot as a human edit)'
  );

  // (f) Toast + undo behave as today.
  var toastsA = liveToasts(sandbox);
  check(toastsA.length === 1, 'A7: exactly one agent toast is rendered');
  check(
    !!toastsA[0] &&
      toastsA[0].children.some(function (c) {
        return c.className === 'agent-toast-summary' &&
          c.textContent === 'Agent set Reverb mix to 40% (n5)';
      }),
    'A7: the toast summary is the tool\'s change summary (\'Agent set Reverb mix to 40% (n5)\')'
  );
  check(
    undoPushes === base.undoPushes + 1 && sandbox.AgentUI.canUndo() === true,
    'A7: exactly ONE undo entry was pushed'
  );

  // Undo (the toast button's own click path) restores through the full
  // write path — allowed by design; the model + physical param come back.
  var undoBtn = toastsA[0] ? toastsA[0].querySelector('.agent-toast-undo') : null;
  if (undoBtn) {
    undoBtn.__fire('click');
  }
  await settle();
  var canvasEntryAfterUndo = sandbox.ChainCanvas.getCurrentModel().filter(function (e) {
    return e.id === 'n5';
  })[0];
  check(
    !!canvasEntryAfterUndo &&
      canvasEntryAfterUndo.params.mix === 20 &&
      approx(reverb0.wetGain.gain.value, wetAt(20)) &&
      AG.getNodeInstance('n5') === reverb0,
    'A8: Undo restored mix 20 in the model AND on the same physical instance'
  );

  // --------------------------------------------------------------------
  console.log('B. the shared ramp: every registered parameter dispatch branch schedules its writes');
  // --------------------------------------------------------------------
  // Every registered param through the real tool, each asserting (i) the
  // fast path was taken with no rebuild or gate duck, (ii) the physical
  // instance survived (===), and (iii) the write reached the right
  // AudioParam as a 10-20 ms schedule with the unit-converted target,
  // never a bare .value write.
  var cases = [
    {
      // +1 dB stays inside the +12 dB budget on the default chain (the
      // compressor+limiter makeup estimate already spends ~10.8 dB of it).
      label: 'gain gainDb 0 -> +1 (n1, dB->linear conversion)',
      type: 'gain',
      nodeId: 'n1',
      param: 'gainDb',
      value: 1,
      getParam: function () {
        return instances0.n1.gain;
      },
      target: Math.pow(10, 1 / 20)
    },
    {
      // Raising the threshold LOWERS the estimated makeup, so -8 is the
      // budget-safe direction from the default -16 (and inside the agent
      // range [-40, -8]).
      label: 'compressor threshold -16 -> -8 (n2)',
      type: 'compressor',
      nodeId: 'n2',
      param: 'threshold',
      value: -8,
      getParam: function () {
        return instances0.n2.threshold;
      },
      target: -8
    },
    {
      label: 'compressor ratio 4 -> 5 (n2)',
      type: 'compressor',
      nodeId: 'n2',
      param: 'ratio',
      value: 5,
      getParam: function () {
        return instances0.n2.ratio;
      },
      target: 5
    },
    {
      label: 'compressor attack 0.01 -> 0.02 s (n2)',
      type: 'compressor',
      nodeId: 'n2',
      param: 'attack',
      value: 0.02,
      getParam: function () {
        return instances0.n2.attack;
      },
      target: 0.02
    },
    {
      label: 'compressor release 0.25 -> 0.3 s (n2)',
      type: 'compressor',
      nodeId: 'n2',
      param: 'release',
      value: 0.3,
      getParam: function () {
        return instances0.n2.release;
      },
      target: 0.3
    },
    {
      label: 'eq lowGain 0 -> -3 dB (n3)',
      type: 'eq',
      nodeId: 'n3',
      param: 'lowGain',
      value: -3,
      getParam: function () {
        return instances0.n3.low.gain;
      },
      target: -3
    },
    {
      label: 'eq midGain 0 -> +3 dB (n3)',
      type: 'eq',
      nodeId: 'n3',
      param: 'midGain',
      value: 3,
      getParam: function () {
        return instances0.n3.mid.gain;
      },
      target: 3
    },
    {
      label: 'eq highGain 0 -> -2 dB (n3)',
      type: 'eq',
      nodeId: 'n3',
      param: 'highGain',
      value: -2,
      getParam: function () {
        return instances0.n3.high.gain;
      },
      target: -2
    },
    {
      label: 'delay timeMs 300 -> 420 ms (n4, ms->s conversion)',
      type: 'delay',
      nodeId: 'n4',
      param: 'timeMs',
      value: 420,
      getParam: function () {
        return instances0.n4.delayNode.delayTime;
      },
      target: 0.42
    },
    {
      label: 'delay feedback 25 -> 45% (n4, percent->linear conversion)',
      type: 'delay',
      nodeId: 'n4',
      param: 'feedback',
      value: 45,
      getParam: function () {
        return instances0.n4.feedbackGain.gain;
      },
      target: 0.45
    },
    {
      label: 'delay mix 25 -> 60 (n4, both crossfade sides)',
      type: 'delay',
      nodeId: 'n4',
      param: 'mix',
      value: 60,
      getParam: function () {
        return instances0.n4.wetGain.gain; // dry side checked separately
      },
      target: wetAt(60),
      extraParam: function () {
        return instances0.n4.dryGain.gain;
      },
      extraTarget: dryAt(60)
    },
    {
      label: 'reverb mix 20 -> 65 (n5)',
      type: 'reverb',
      nodeId: 'n5',
      param: 'mix',
      value: 65,
      getParam: function () {
        return instances0.n5.wetGain.gain;
      },
      target: wetAt(65),
      extraParam: function () {
        return instances0.n5.dryGain.gain;
      },
      extraTarget: dryAt(65)
    },
    {
      label: 'limiter ceiling -3 -> -4 dB (n6)',
      type: 'limiter',
      nodeId: 'n6',
      param: 'ceiling',
      value: -4,
      getParam: function () {
        return instances0.n6.threshold;
      },
      target: -4
    },
    {
      label: 'limiter release 50 -> 150 ms (n6, ms->s conversion)',
      type: 'limiter',
      nodeId: 'n6',
      param: 'release',
      value: 150,
      getParam: function () {
        return instances0.n6.release;
      },
      target: 0.15
    }
  ];

  var registeredBranches = [];
  sandbox.NodeTypes.getAllTypes().forEach(function (type) {
    sandbox.NodeTypes.getParamSpec(type).forEach(function (spec) {
      registeredBranches.push(type + '.' + spec.id);
    });
  });
  var coveredBranches = cases.map(function (tc) {
    return tc.type + '.' + tc.param;
  });
  check(
    registeredBranches.slice().sort().join(',') === coveredBranches.slice().sort().join(','),
    'B: the table covers every registered branch exactly once (' +
      coveredBranches.length + ' cases)'
  );

  for (var c = 0; c < cases.length; c++) {
    var tc = cases[c];
    var param = tc.getParam();
    var before = {
      buildGraph: buildGraphCalls,
      loadModel: records.loadModelCalls,
      gateAutomation: gate.gain.__automation.length,
      automation: param.__automation.length,
      instance: AG.getNodeInstance(tc.nodeId),
      extraAutomation: tc.extraParam ? tc.extraParam().__automation.length : 0
    };
    var r = await getTool(sandbox, 'set_param').execute({
      nodeId: tc.nodeId,
      param: tc.param,
      value: tc.value
    });
    await settle();

    var ramp = sawScheduledRamp(param, before.automation, tc.target, NOW, RAMP_S);
    check(
      !!r && r.applied === true,
      tc.label + ': applied:true through the real tool'
    );
    check(ramp.ok,
      tc.label + ': the AudioParam write was SCHEDULED (ramp to ' + tc.target +
        ' over ' + RAMP_S + ' s) — not a bare .value write');
    check(
      approx(param.value, tc.target),
      tc.label + ': the param now carries the new value'
    );
    if (tc.extraParam) {
      var extraRamp = sawScheduledRamp(
        tc.extraParam(),
        before.extraAutomation,
        tc.extraTarget,
        NOW,
        RAMP_S
      );
      check(extraRamp.ok,
        tc.label + ': the second crossfade side was scheduled too (dry to ' +
          tc.extraTarget.toFixed(4) + ')');
    }
    check(
      AG.getNodeInstance(tc.nodeId) === before.instance,
      tc.label + ': the SAME physical instance (===) served the write'
    );
    check(
      buildGraphCalls === before.buildGraph,
      tc.label + ': ZERO buildGraph calls — fast path taken'
    );
    check(
      records.loadModelCalls === before.loadModel,
      tc.label + ': ZERO ChainCanvas.loadModel calls — cards were not rebuilt'
    );
    check(
      gate.gain.__automation.length === before.gateAutomation,
      tc.label + ': ZERO chain-gate automation — output was not ducked'
    );
  }

  // A clamped value rides the same fast path and the SAME ramp math.
  var delayTimeParam = instances0.n4.delayNode.delayTime;
  var delayTimeBefore = {
    automation: delayTimeParam.__automation.length,
    buildGraph: buildGraphCalls
  };
  var clampRes = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n4',
    param: 'timeMs',
    value: 2000 // agent policy clamps to 750
  });
  await settle();
  var clampRamp = sawScheduledRamp(delayTimeParam, delayTimeBefore.automation, 0.75, NOW, RAMP_S);
  check(
    !!clampRes && clampRes.applied === true &&
      Array.isArray(clampRes.clamped) &&
      clampRes.clamped.length === 1 &&
      clampRes.clamped[0].param === 'timeMs' &&
      clampRes.clamped[0].requested === 2000 &&
      clampRes.clamped[0].applied === 750,
    'B: an out-of-nominal timeMs is clamped to 750 and disclosed'
  );
  check(clampRamp.ok,
    'B: the clamped delayTime write was SCHEDULED to 0.75 s over ' + RAMP_S +
      ' s (delay-length changes ramp — no buffer-offset zip)');
  check(
    buildGraphCalls === delayTimeBefore.buildGraph,
    'B: the clamped edit still took the fast path (no buildGraph)'
  );

  // --------------------------------------------------------------------
  console.log('C. refusals still refuse, with NOTHING applied');
  // --------------------------------------------------------------------
  var gainParam = instances0.n1.gain;
  var refuseBase = {
    automation: gainParam.__automation.length,
    buildGraph: buildGraphCalls,
    loadModel: records.loadModelCalls,
    updateNodeParam: records.updateNodeParamCalls.length,
    persistence: records.persistenceCalls.length,
    markModified: markModifiedCalls,
    undoPushes: undoPushes,
    model: sandbox.ChainCanvas.getCurrentModel().filter(function (e) {
      return e.id === 'n1';
    })[0].params.gainDb
  };

  var outOfRange = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n1',
    param: 'gainDb',
    value: 13 // agent policy max is +12, treatment 'reject'
  });
  await settle();
  check(
    !!outOfRange && outOfRange.error === true &&
      outOfRange.code === 'PARAM_OUT_OF_RANGE' &&
      outOfRange.applied === null &&
      outOfRange.allowed.max === 12,
    'C1: gainDb 13 (above the +12 dB agent range) is REFUSED with the allowed range'
  );
  check(
    gainParam.__automation.length === refuseBase.automation &&
      buildGraphCalls === refuseBase.buildGraph &&
      records.loadModelCalls === refuseBase.loadModel &&
      records.updateNodeParamCalls.length === refuseBase.updateNodeParam &&
      records.persistenceCalls.length === refuseBase.persistence &&
      markModifiedCalls === refuseBase.markModified &&
      undoPushes === refuseBase.undoPushes &&
      sandbox.ChainCanvas.getCurrentModel().filter(function (e) {
        return e.id === 'n1';
      })[0].params.gainDb === refuseBase.model,
    'C1: the refusal touched NOTHING — no ramp, no model write, no rebuild, no persistence, no undo'
  );

  var hostOwned = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n6',
    param: 'ratio', // host-locked on the limiter
    value: 10
  });
  await settle();
  check(
    !!hostOwned && hostOwned.error === true &&
      hostOwned.code === 'HOST_OWNED' &&
      hostOwned.applied === null &&
      hostOwned.rule_id === 'host-limiter-locks',
    'C2: a host-owned limiter param (ratio) is still refused with HOST_OWNED'
  );

  // --------------------------------------------------------------------
  console.log('D. the visible control: real ParamControls rows move in place');
  // --------------------------------------------------------------------
  // Render the REAL param-controls rows for n3 (eq — three params) into a
  // stub container, exactly as createNodeCard does, then verify the fast
  // path's updateControl moves the slider + mono span WITHOUT re-rendering
  // and WITHOUT letting a later human slider move revert an agent value.
  var cardParamsEl = makeElement('div');
  var humanEdits = [];
  var n3Entry = { id: 'n3', type: 'eq', params: { lowGain: 0, midGain: 0, highGain: 0 } };
  sandbox.ParamControls.render(cardParamsEl, n3Entry, function (updated) {
    humanEdits.push(updated);
  });
  var rows = cardParamsEl.children;
  check(rows.length === 3, 'D1: the REAL ParamControls rendered 3 eq rows');

  // The agent move (midGain was set to +6 in section B): route it through
  // the same delegation the canvas makes.
  // Redesign item 1: the row anatomy is [input, .knob-unit(label, knob,
  // value span), help span] — find the engine input by id and the mono
  // span by class instead of child indexes.
  function findRowParts(row, paramId) {
    var input = null;
    var span = null;
    function walk(el) {
      (el.children || []).forEach(function (child) {
        if (String(child.tagName).toUpperCase() === 'INPUT' && child.id === 'param-n3-' + paramId) {
          input = child;
        }
        if (String(child.tagName).toUpperCase() === 'SPAN' && child.className === 'param-value') {
          span = child;
        }
        walk(child);
      });
    }
    walk(row);
    return { input: input, span: span };
  }
  var midInput = null;
  var midSpan = null;
  rows.forEach(function (row) {
    var parts = findRowParts(row, 'midGain');
    if (parts.input) {
      midInput = parts.input;
      midSpan = parts.span;
    }
  });
  check(
    !!midInput && !!midSpan && midInput.value === 0 && midSpan.textContent === '0 dB',
    'D1: the midGain row rendered at its current model value (0 dB)'
  );
  var moved = sandbox.ParamControls.updateControl('n3', 'midGain', 6);
  check(
    moved === true &&
      Number(midInput.value) === 6 &&
      midSpan.textContent === '6 dB',
    'D2: updateControl moved the rendered slider to 6 and the mono span to \'6 dB\' in place'
  );
  check(
    cardParamsEl.children.length === 3 &&
      cardParamsEl.children[0] === rows[0],
    'D2: no re-render — the same three row elements are still the container\'s children'
  );
  check(
    sandbox.ParamControls.updateControl('n3', 'nope', 1) === false &&
      sandbox.ParamControls.updateControl('ghost', 'mix', 1) === false,
    'D2: updateControl is honest about unknown params/ids (returns false, touches nothing)'
  );

  // A later HUMAN slider move on a sibling row must not revert the agent
  // value (the working-copy re-sync added with issue #5).
  var lowInput = null;
  rows.forEach(function (row) {
    var parts = findRowParts(row, 'lowGain');
    if (parts.input) {
      lowInput = parts.input;
    }
  });
  n3Entry.params = { lowGain: 0, midGain: 6, highGain: 0 }; // what canvas bookkeeping now holds
  if (lowInput) {
    lowInput.value = 3; // the human drags Low to +3
    lowInput.__fire('input');
  }
  check(
    humanEdits.length === 1 &&
      humanEdits[0].lowGain === 3 &&
      humanEdits[0].midGain === 6,
    'D3: a human slider move after an agent edit builds on the agent\'s value (midGain stays 6 — no silent revert)'
  );
  var lowSpan = null;
  rows.forEach(function (row) {
    var parts = findRowParts(row, 'lowGain');
    if (parts.input) {
      lowSpan = parts.span;
    }
  });
  check(
    Number(lowInput.value) === 0 && lowSpan && lowSpan.textContent === '0 dB',
    'D4: a queued human candidate leaves the last accepted control value visible'
  );
  sandbox.ParamControls.updateControl('n3', 'lowGain', 3);
  check(
    Number(lowInput.value) === 3 && lowSpan.textContent === '3 dB',
    'D4: the control changes only when the accepted-state adapter renders it'
  );

  // --------------------------------------------------------------------
  console.log('E. click-risk probe: the real ramp math vs a bare jump');
  // --------------------------------------------------------------------
  // OfflineAudioContext does not exist in this Node harness, so the probe
  // evaluates the REAL helper's math headlessly: a 440 Hz sine through a
  // gain that changes 0.5 -> 2.0 mid-buffer, three ways — constant gain
  // (baseline), a bare instant jump (the pre-#5 write), and the linear
  // ramp over the real RAMP_S. Discontinuity energy = the largest
  // sample-to-sample delta. A click IS a large inter-sample step; the
  // assertion is that the ramp keeps the worst step within a small factor
  // of the UNCHANGED signal's own slope, while the jump is far larger.
  // (This stands in for the OfflineAudioContext render; the physical
  // listen stays a human acceptance step — docs/ACCEPTANCE.md.)
  var SR = 44100;
  var N = 4096;
  var K0 = 1024; // change point, samples
  var G0 = 0.5;
  var G1 = 2.0;
  function maxDelta(gainAt) {
    var maxD = 0;
    var prev = G0 * Math.sin((2 * Math.PI * 440 * 0) / SR);
    for (var n = 1; n < N; n++) {
      var s = Math.sin((2 * Math.PI * 440 * n) / SR);
      var x = gainAt(n) * s;
      var d = Math.abs(x - prev);
      if (d > maxD) {
        maxD = d;
      }
      prev = x;
    }
    return maxD;
  }
  var rampSamples = Math.round(RAMP_S * SR);
  // The honest slope references: the SAME signal at constant start gain
  // and constant end gain. The end gain here is 4x the start, so its own
  // legitimate slope is 4x larger — the ramp must add essentially NOTHING
  // beyond the louder signal's own slope, while the bare jump is in a
  // different league entirely.
  var steadySlope0 = maxDelta(function () {
    return G0;
  });
  var steadySlope1 = maxDelta(function () {
    return G1;
  });
  var steadyMax = Math.max(steadySlope0, steadySlope1);
  var jumpDelta = maxDelta(function (n) {
    return n < K0 ? G0 : G1;
  });
  var rampDelta = maxDelta(function (n) {
    if (n < K0) {
      return G0;
    }
    var t = (n - K0) / rampSamples;
    return t >= 1 ? G1 : G0 + (G1 - G0) * t;
  });
  check(
    jumpDelta > steadyMax * 5,
    'E: a bare .value jump leaves a discontinuity ~' +
      (jumpDelta / steadyMax).toFixed(1) + 'x the signal\'s own worst slope (' +
      jumpDelta.toFixed(4) + ' vs ' + steadyMax.toFixed(4) + ') — the click'
  );
  check(
    rampDelta <= steadyMax * 1.05 && rampDelta < jumpDelta / 3,
    'E: the real ' + RAMP_S + ' s ramp keeps the worst step at ' +
      (rampDelta / steadyMax).toFixed(2) +
      'x the signal\'s own worst slope — no jump-sized discontinuity'
  );

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log(
      'PASS: set_param rides the parameter-only path (no rebuild, no duck) with click-safe scheduled ramps (issue #5)'
    );
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
