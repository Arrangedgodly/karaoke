// Test for issue #10 — [P2] Honor AbortSignal for queued WebMCP mutations.
//
// The mutation executors now accept execution options and pass
// options.signal into the drag-settle wait, so a mutation cancelled while
// queued behind a human drag can never apply when the drag ends. Five
// cases, all through the REAL tool path (getTool('set_param').execute(...)
// — the same call the WebMCP shim wraps and the ?dev harness makes):
//
//   A. PRE-ABORT — the signal is already aborted when the executor runs
//      (a real Node AbortController AND a stub signal): immediate ABORTED
//      result, zero queue wait, nothing applied/toasted/persisted/undone.
//   B. ABORT DURING DRAG WAIT — a human drag holds the queue (the same
//      ChainCanvas.isDragActive mechanism the other tests use), the call
//      starts, the signal aborts mid-wait: ABORTED, the polling interval
//      was cleared and the abort listener removed (stub records), and the
//      drag settling LATER still applies NOTHING.
//   C. ABORT IMMEDIATELY BEFORE APPLY — the abort fires inside the last
//      poll tick (the isDragActive call that ends the drag also aborts),
//      i.e. in the window after the settle resolves but before the apply
//      line: the TOCTOU recheck catches it, ABORTED, nothing applied.
//   D. NO SIGNAL — options omitted entirely (and options without a
//      signal): the mutation applies exactly as today (applied:true, one
//      toast, one undo entry).
//   E. get_chain (a read tool) takes options harmlessly — an aborted
//      signal changes nothing about a read.
//
// The ABORTED result must be the ONE stable shape — {error:true,
// code:'ABORTED', applied:null, ...} — identical across A/B/C, with no
// toast (ABORTED is not routed through the rejection reporter).
//
// Same committed-test convention as the rest of the suite: zero-dependency
// Node harness, stub `window` + the minimal Web Audio/DOM surface, load
// the REAL src files (fs.readFileSync + vm.runInContext).
//
// Run from a clean clone:  node tests/test-abort-signal.js
// (or via the runner:      node tests/run.js abort-signal)
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

// buildGraph() commits its instance map + model on the deferred rewire
// (FADE_S*1000 + 5 = ~20ms after the call). 60ms is a comfortable settle;
// the drag poll is 50ms, so 130ms comfortably covers two poll ticks.
function settle() {
  return sleep(60);
}
function settlePoll() {
  return sleep(130);
}

// ----------------------------------------------------------------------
// Minimal Web Audio stubs (same shapes as the mutation-undo test).
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
// Minimal DOM element stub (same surface as the mutation-undo test).
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
// A recording AbortSignal-shaped stub: standard surface (aborted, reason,
// addEventListener/removeEventListener('abort')), plus __records so the
// tests can assert the wait cleaned up its listener (and, by the single
// finish() path, its polling interval).
// ----------------------------------------------------------------------
function makeStubSignal() {
  var sig = {
    aborted: false,
    reason: undefined,
    __records: { added: 0, removed: 0, listenersAfter: 0, fired: 0 },
    addEventListener: function (type, fn) {
      if (type === 'abort') {
        sig.__records.added += 1;
        sig.__listeners.push(fn);
        sig.__records.listenersAfter = sig.__listeners.length;
      }
    },
    removeEventListener: function (type, fn) {
      if (type === 'abort') {
        var i = sig.__listeners.indexOf(fn);
        if (i !== -1) {
          sig.__listeners.splice(i, 1);
          sig.__records.removed += 1;
        }
        sig.__records.listenersAfter = sig.__listeners.length;
      }
    },
    __listeners: [],
    __abort: function (reason) {
      if (sig.aborted) {
        return;
      }
      sig.aborted = true;
      sig.reason = reason !== undefined ? reason : 'TestAbort';
      sig.__records.fired += 1;
      sig.__listeners.slice().forEach(function (fn) {
        fn();
      });
    }
  };
  return sig;
}

// ----------------------------------------------------------------------
// The sandbox: same shape as the mutation-undo test, except the host
// interval functions are wrapped so the tests can see the drag-settle
// polling interval being created and (critically) cleared.
// ----------------------------------------------------------------------
var domEvents = [];
var domListeners = {};
var intervalRecords = { set: [], cleared: [] };

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
      var id = setInterval(fn, ms);
      intervalRecords.set.push(id);
      return id;
    },
    clearInterval: function (id) {
      intervalRecords.cleared.push(id);
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
// ChainCanvas stub — same single-write-path shape as the mutation-undo
// test, plus a controllable isDragActive (the mechanism that holds the
// drag-settle queue) with a one-shot release hook: __setReleaseHook(fn,
// afterCalls) arms the hook to fire on the isDragActive call AFTER the
// next `afterCalls` calls (so the wait's INITIAL drag check can be told
// apart from the POLL tick's check) — the hook (which may abort the
// signal) runs inside that poll tick, and the drag then reports ended.
// ----------------------------------------------------------------------
function installChainCanvasStub(sandbox, drag) {
  var canvasModel = [];
  var releaseHook = null;
  var hookPendingCalls = 0;
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
      if (!drag.active) {
        return false;
      }
      if (hookPendingCalls > 0) {
        hookPendingCalls -= 1;
        return true;
      }
      if (releaseHook) {
        var hook = releaseHook;
        releaseHook = null;
        hook(); // may abort the signal — inside the poll tick, before settle
        return false; // the drag just ended
      }
      return true;
    },
    __setReleaseHook: function (fn, afterCalls) {
      releaseHook = fn;
      hookPendingCalls = afterCalls || 0;
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

// The one stable ABORTED shape — asserted identical in every abort case.
function isAbortedResult(res, toolName) {
  return (
    !!res &&
    res.error === true &&
    res.code === 'ABORTED' &&
    res.tool === toolName &&
    res.applied === null &&
    res.retry === true &&
    typeof res.reason === 'string' &&
    res.reason.length > 0 &&
    typeof res.suggestion === 'string' &&
    res.suggestion.length > 0
  );
}

// The full "nothing happened" battery: no model write, no physical write,
// no toast, no mutation event, no undo entry, no persistence write.
function assertNothingApplied(sandbox, ctx, tag) {
  var entry = sandbox.ChainCanvas.getCurrentModel().filter(function (e) {
    return e.id === 'n5';
  })[0];
  check(entry.params.mix === 20, tag + ': the model still holds n5 mix 20 (no write)');
  check(
    approx(ctx.reverb.wetGain.gain.value, ctx.wet20) &&
      approx(ctx.reverb.dryGain.gain.value, ctx.dry20),
    tag + ': the physical reverb still sits at mix 20 (no write)'
  );
  check(liveToasts(sandbox).length === 0, tag + ': NO toast was rendered');
  check(ctx.undoPushes === 0, tag + ': NO undo entry was pushed');
  check(
    domEvents.filter(function (e) {
      return e.type === 'agentui:mutation';
    }).length === 0,
    tag + ': NO agentui:mutation event fired (not even a rejected one)'
  );
  check(ctx.persistenceWrites === 0, tag + ': NO persistence write happened');
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
  loadSrc(sandbox, 'src/default-preset.js');
  loadSrc(sandbox, 'src/mcp-tools.js');
  var drag = { active: false };
  installChainCanvasStub(sandbox, drag);

  var AG = sandbox.AudioGraph;
  var DEFAULTS = sandbox.DEFAULT_PRESET.nodes;

  // Persistence: the fast path's ChainCanvas.updateNodeParam /
  // applyCandidateViaUi route through Persistence.saveCurrentChain when
  // the module is present — count writes through a recorder stub.
  var ctx = {
    undoPushes: 0,
    persistenceWrites: 0,
    presetSaves: 0,
    presetRemoves: 0,
    presetUiWrites: 0
  };
  var realPushUndo = sandbox.AgentUI.pushUndo;
  sandbox.AgentUI.pushUndo = function (entry) {
    ctx.undoPushes += 1;
    return realPushUndo(entry);
  };
  sandbox.Persistence = {
    saveCurrentChain: function () {
      ctx.persistenceWrites += 1;
    }
  };
  sandbox.PresetStore = {
    save: function () {
      ctx.presetSaves += 1;
      return { ok: true, overwrote: false };
    },
    listNames: function () {
      return [];
    },
    remove: function () {
      ctx.presetRemoves += 1;
      return { ok: true, removed: true };
    }
  };
  sandbox.PresetsUI = {
    refreshPresetSelect: function () {
      ctx.presetUiWrites += 1;
    },
    setCurrentPreset: function () {
      ctx.presetUiWrites += 1;
    },
    clearModified: function () {
      ctx.presetUiWrites += 1;
    },
    markModified: function () {
      ctx.presetUiWrites += 1;
    }
  };

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

  ctx.reverb = AG.getNodeInstance('n5');
  ctx.wet20 = wetAt(20);
  ctx.dry20 = dryAt(20);
  check(
    !!ctx.reverb &&
      approx(ctx.reverb.wetGain.gain.value, ctx.wet20) &&
      approx(ctx.reverb.dryGain.gain.value, ctx.dry20),
    '0: physical n5 is the reverb composite at mix 20'
  );
  check(
    sandbox.AgentUI.canUndo() === false && liveToasts(sandbox).length === 0,
    '0: undo stack empty, no toasts before any mutation'
  );

  var intervalBase = intervalRecords.set.length;

  // The canonical harmless edit every case below attempts.
  function editInput() {
    return { nodeId: 'n5', param: 'mix', value: 40 };
  }

  // --------------------------------------------------------------------
  console.log('A. PRE-ABORT: the signal is already aborted when the executor runs');
  // --------------------------------------------------------------------
  // (a1) a REAL Node AbortController, aborted before the call.
  var ctrl = new AbortController();
  ctrl.abort();
  var t0 = Date.now();
  var resA1 = await getTool(sandbox, 'set_param').execute(editInput(), {
    signal: ctrl.signal
  });
  var elapsedA1 = Date.now() - t0;
  check(
    isAbortedResult(resA1, 'set_param'),
    'A1: a real AbortController signal aborted before the call resolves the stable ABORTED refusal'
  );
  check(
    elapsedA1 < 50,
    'A1: it returned immediately (' + elapsedA1 + ' ms — never queued, never waited)'
  );
  assertNothingApplied(sandbox, ctx, 'A1');

  // (a2) a stub signal, already aborted — same result, byte-for-byte.
  var preAbortStub = makeStubSignal();
  preAbortStub.__abort();
  var resA2 = await getTool(sandbox, 'set_param').execute(editInput(), {
    signal: preAbortStub
  });
  check(
    isAbortedResult(resA2, 'set_param') &&
      JSON.stringify(resA2) === JSON.stringify(resA1),
    'A2: a stub signal already aborted resolves the IDENTICAL ABORTED result'
  );
  assertNothingApplied(sandbox, ctx, 'A2');
  check(
    intervalRecords.set.length === intervalBase,
    'A2: pre-abort created NO polling interval at all'
  );

  // (a3) save_preset has its own synchronous persistence path. It must
  // honor the same execution-options contract before touching storage.
  var saveCtrl = new AbortController();
  saveCtrl.abort();
  var saveBefore = {
    saves: ctx.presetSaves,
    removes: ctx.presetRemoves,
    uiWrites: ctx.presetUiWrites,
    undoPushes: ctx.undoPushes,
    toasts: liveToasts(sandbox).length,
    events: domEvents.length
  };
  var resA3 = await getTool(sandbox, 'save_preset').execute(
    { name: 'Cancelled Save' },
    { signal: saveCtrl.signal }
  );
  check(
    isAbortedResult(resA3, 'save_preset'),
    'A3: pre-aborted save_preset resolves the stable ABORTED refusal'
  );
  check(
    ctx.presetSaves === saveBefore.saves &&
      ctx.presetRemoves === saveBefore.removes &&
      ctx.presetUiWrites === saveBefore.uiWrites &&
      ctx.undoPushes === saveBefore.undoPushes &&
      liveToasts(sandbox).length === saveBefore.toasts &&
      domEvents.length === saveBefore.events,
    'A3: pre-aborted save_preset performs NO store write, UI refresh, toast, event, or undo push'
  );

  // (a4) The first aborted read is false and the second is true. This
  // models cancellation after the reversible reads but at the final
  // boundary immediately before PresetStore.save().
  var boundaryChecks = 0;
  var boundarySignal = {};
  Object.defineProperty(boundarySignal, 'aborted', {
    get: function () {
      boundaryChecks += 1;
      return boundaryChecks >= 2;
    }
  });
  var resA4 = await getTool(sandbox, 'save_preset').execute(
    { name: 'Boundary Save' },
    { signal: boundarySignal }
  );
  check(
    boundaryChecks === 2 && isAbortedResult(resA4, 'save_preset'),
    'A4: save_preset rechecks cancellation at the last safe boundary before persistence'
  );
  check(
    ctx.presetSaves === saveBefore.saves &&
      ctx.presetRemoves === saveBefore.removes &&
      ctx.presetUiWrites === saveBefore.uiWrites &&
      ctx.undoPushes === saveBefore.undoPushes &&
      liveToasts(sandbox).length === saveBefore.toasts &&
      domEvents.length === saveBefore.events,
    'A4: last-boundary abort performs NO store write, UI refresh, toast, event, or undo push'
  );

  // Keep later set_param cases independent when this new contract is
  // red. A broken save_preset currently leaves success UI behind.
  sandbox.AgentUI.clearUndo();
  liveToasts(sandbox).forEach(function (toast) {
    toast.remove();
  });
  domEvents.length = 0;
  ctx.undoPushes = 0;

  // --------------------------------------------------------------------
  console.log('B. ABORT DURING DRAG WAIT: cancelled while queued behind a human drag');
  // --------------------------------------------------------------------
  drag.active = true; // the human drag that holds the queue
  var sigB = makeStubSignal();
  var intervalBaseB = intervalRecords.set.length;
  var promiseB = getTool(sandbox, 'set_param').execute(editInput(), {
    signal: sigB
  });
  await sleep(70); // past one 50ms poll tick — the wait is genuinely queued
  check(
    sigB.__records.added === 1 && sigB.__listeners.length === 1,
    'B1: the drag-settle wait registered exactly ONE abort listener while queued'
  );
  check(
    intervalRecords.set.length === intervalBaseB + 1,
    'B1: exactly one polling interval was created for the queued wait'
  );
  var lastInterval = intervalRecords.set[intervalRecords.set.length - 1];

  sigB.__abort(); // the client cancels mid-wait
  var resB = await promiseB;

  check(isAbortedResult(resB, 'set_param'), 'B2: abort mid-wait resolves the stable ABORTED refusal');
  check(
    JSON.stringify(resB) === JSON.stringify(resA1),
    'B2: byte-identical to the pre-abort result (one stable shape)'
  );
  check(
    sigB.__records.removed === 1 && sigB.__listeners.length === 0,
    'B2: the abort listener was REMOVED on completion (no dangling listener)'
  );
  check(
    intervalRecords.cleared.indexOf(lastInterval) !== -1,
    'B2: the polling interval was CLEARED on completion (no leaked timer)'
  );

  // The drag settles LATER — the cancelled mutation must stay dead.
  drag.active = false;
  await settlePoll();
  assertNothingApplied(sandbox, ctx, 'B3 (after the drag settled)');
  check(
    sandbox.AgentUI.canUndo() === false,
    'B3: the undo stack is still empty after the drag settled'
  );

  // --------------------------------------------------------------------
  console.log('C. ABORT IMMEDIATELY BEFORE APPLY: cancelled in the settle->apply window');
  // --------------------------------------------------------------------
  // The one-shot release hook: the isDragActive call that ENDS the drag
  // (the last poll tick, the same call that resolves the settle wait)
  // also aborts the signal. The settle therefore resolves "idle" while
  // the signal is already aborted — exactly the TOCTOU window between
  // the wait resolving and the apply line. Only the immediate recheck
  // can stop the apply here.
  drag.active = true;
  var sigC = makeStubSignal();
  // afterCalls: 1 — skip the wait's INITIAL drag check, fire inside the
  // first POLL tick (the last isDragActive call before the settle).
  sandbox.ChainCanvas.__setReleaseHook(
    function () {
      sigC.__abort();
    },
    1
  );
  var resC = await getTool(sandbox, 'set_param').execute(editInput(), {
    signal: sigC
  });
  await settlePoll();

  check(isAbortedResult(resC, 'set_param'), 'C1: abort inside the last poll tick resolves ABORTED (recheck guard held)');
  check(
    JSON.stringify(resC) === JSON.stringify(resA1),
    'C1: byte-identical to the other abort results (one stable shape)'
  );
  check(
    sigC.__records.removed === 1 && sigC.__listeners.length === 0,
    'C1: the abort listener was removed on this path too'
  );
  assertNothingApplied(sandbox, ctx, 'C2 (the settle->apply window)');
  drag.active = false; // the consumed hook must not linger as a live drag

  // (C3) The recheck guard DIRECTLY: a signal-shaped object with only the
  // `aborted` flag (no add/removeEventListener — the wait can attach no
  // listener, so nothing resolves the wait "aborted"). The release hook
  // flips aborted=true inside the very isDragActive call that ends the
  // drag: the settle resolves "idle", and ONLY the immediate
  // recheck-between-settle-and-apply can stop the write. If the recheck
  // were missing, this mutation would apply.
  drag.active = true;
  var sigC3 = { aborted: false };
  sandbox.ChainCanvas.__setReleaseHook(
    function () {
      sigC3.aborted = true;
    },
    1
  );
  var resC3 = await getTool(sandbox, 'set_param').execute(
    { nodeId: 'n5', param: 'mix', value: 55 },
    { signal: sigC3 }
  );
  await settlePoll();
  check(
    isAbortedResult(resC3, 'set_param'),
    'C3: a signal aborted between the settle and the apply is caught by the recheck (ABORTED, nothing applied)'
  );
  var entryC3 = sandbox.ChainCanvas.getCurrentModel().filter(function (e) {
    return e.id === 'n5';
  })[0];
  check(
    entryC3.params.mix === 20 &&
      liveToasts(sandbox).length === 0 &&
      ctx.undoPushes === 0,
    'C3: mix 55 was never written, no toast, no undo (the TOCTOU guard held)'
  );
  drag.active = false;

  // --------------------------------------------------------------------
  console.log('D. NO SIGNAL: options omitted (and optionless) — behavior byte-identical');
  // --------------------------------------------------------------------
  var resD1 = await getTool(sandbox, 'set_param').execute(editInput());
  await settle();
  check(resD1 && resD1.applied === true, 'D1: no options at all — set_param applies as today');
  var entryD = sandbox.ChainCanvas.getCurrentModel().filter(function (e) {
    return e.id === 'n5';
  })[0];
  check(entryD.params.mix === 40, 'D1: the model carries n5 mix 40');
  check(
    approx(ctx.reverb.wetGain.gain.value, wetAt(40)) &&
      AG.getNodeInstance('n5') === ctx.reverb,
    'D1: the physical reverb followed to mix 40 on the same instance'
  );
  check(liveToasts(sandbox).length === 1, 'D1: exactly one toast rendered');
  check(ctx.undoPushes === 1 && sandbox.AgentUI.canUndo() === true, 'D1: exactly one undo entry pushed');

  // Options present but signal-less (the ?dev harness / plain objects).
  var resD2 = await getTool(sandbox, 'set_param').execute(
    { nodeId: 'n5', param: 'mix', value: 30 },
    { signal: null, other: true }
  );
  await settle();
  check(resD2 && resD2.applied === true, 'D2: options without a signal apply as today');
  check(liveToasts(sandbox).length === 2, 'D2: a second toast for the second mutation');
  check(ctx.undoPushes === 2, 'D2: a second undo entry');

  // --------------------------------------------------------------------
  console.log('E. get_chain ignores options harmlessly (a read tool)');
  // --------------------------------------------------------------------
  var readCtrl = new AbortController();
  readCtrl.abort();
  var chainRes = await getTool(sandbox, 'get_chain').execute({}, {
    signal: readCtrl.signal
  });
  check(
    !!chainRes && !chainRes.error && Array.isArray(chainRes.nodes)
      ? chainRes.nodes.filter(function (n) {
          return n.id === 'n5';
        })[0].params.mix === 30
      : false,
    'E: get_chain with an (aborted) signal option still returns the live chain — reads never abort'
  );
  check(liveToasts(sandbox).length === 2 && ctx.undoPushes === 2,
    'E: the read changed nothing (same toasts, same undo count)');

  // --------------------------------------------------------------------
  console.log('F. rollback failure outranks a late abort signal');
  // --------------------------------------------------------------------
  var splitSignal = { aborted: false };
  sandbox.ChainEditing = {
    getModel: function () { return sandbox.ChainCanvas.getCurrentModel(); },
    whenIdle: function () { return Promise.resolve(); },
    apply: function () {
      splitSignal.aborted = true;
      var splitError = new Error('candidate failed and rollback failed');
      splitError.code = 'CHAIN_ROLLBACK_FAILED';
      splitError.rollback = { attempted: true, succeeded: false };
      return Promise.reject(splitError);
    }
  };
  var splitResult = await getTool(sandbox, 'set_param').execute(
    { nodeId: 'n5', param: 'mix', value: 35 },
    { signal: splitSignal }
  );
  check(splitResult && splitResult.code === 'SCHEMA_LAYER_FAULT' &&
      splitResult.rollback && splitResult.rollback.succeeded === false,
    'F1: a failed rollback remains a structured fault even when the signal is now aborted');
  check(!isAbortedResult(splitResult, 'set_param'),
    'F2: split live state is never flattened into the harmless ABORTED result');

  // --------------------------------------------------------------------
  console.log('G. production WebMCP mutations fail closed without ChainEditing');
  // --------------------------------------------------------------------
  delete sandbox.ChainEditing;
  vm.runInContext('document.defaultView = window;', sandbox);
  var beforeFailClosed = sandbox.ChainCanvas.getCurrentModel();
  var failClosedResult = await getTool(sandbox, 'set_param').execute({
    nodeId: 'n5',
    param: 'mix',
    value: 35
  });
  check(failClosedResult && failClosedResult.code === 'SCHEMA_LAYER_FAULT',
    'G1: a production-like page reports dependency failure instead of using the legacy write path');
  check(JSON.stringify(sandbox.ChainCanvas.getCurrentModel()) === JSON.stringify(beforeFailClosed),
    'G2: the missing-seam failure performs no logical mutation');

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: AbortSignal is honored for queued WebMCP mutations (issue #10)');
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
