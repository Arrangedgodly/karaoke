// tests/test-human-undo.js — the human-undo contract (harden round,
// 2026-09-02, the critique's remaining P1).
//
// Every accepted edit that arrives at ChainEditing as source 'human'
// (structural gestures, param fast path) or 'preset' (human Try /
// Previous / Next loads) pushes ONE undo entry onto the SAME stack the
// agent path uses, with an operator-language label derived from the
// edit itself and a restore that routes through the guarded
// source:'undo' transaction. No double push for agent actions (their
// preset-first loads apply as source 'agent'), no push for
// startup/undo/abort paths, and sequential undos of your own edits
// never demand a confirm (the conflict gate stays the agent path's
// protection — pinned end-to-end by test-undo-conflict-safety.js).
//
// Refinement round, 2026-09-03 (critique P2 #2): human undo was
// INVISIBLE at the point of need. Section F loads the REAL
// src/agent-ui.js beside the REAL chain-editing module over a minimal
// DOM and pins the VISIBLE entry point: a human STRUCTURAL edit
// (add/remove/reorder/replace, or a preset try-load) raises exactly ONE
// toast carrying the operator label and a working Undo key; param
// commits and the IN/BYP key raise none; the agent path's toast
// semantics are untouched (its own mouth, no agentui:mutation for
// human edits); undo from the toast pops through the guarded restore
// and the toast stays SILENT (no 'Undone' annotation — the restore
// contract the 2026-09-02 round set).
//
// Same committed-test convention: zero-dependency Node harness, the
// REAL src/chain-editing.js loaded into a vm, per-check ok/FAIL prints,
// exit 0 on pass / 1 on failure.
//
// Run from a clean clone:  node tests/test-human-undo.js
// (or via the runner:      node tests/run.js human-undo)

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

function node(id, type, params) {
  return { id: id, type: type, params: params || {} };
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

// A minimal but faithful chain-editing harness: the REAL module over
// stubbed collaborators, capturing every AgentUI.pushUndo call.
function makeHarness(initial) {
  var pushes = [];
  var revisions = 0;
  var acceptedModel = copy(initial);

  var sandbox = {
    console: console,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  sandbox.window = sandbox;

  sandbox.AudioEngine = { isStarted: true, isTrackLive: true, audioContext: { state: 'running' } };
  sandbox.Persistence = {
    saveCurrentChain: function () { return { saved: true }; },
    isSaveFailed: function () { return false; }
  };
  // Enough catalog for real label derivation: display labels + one
  // param spec with a human label per type used below.
  var LABELS = {
    gain: 'Gain', limiter: 'Limiter', reverb: 'Reverb', eq: 'EQ', delay: 'Delay'
  };
  var PARAM_SPECS = {
    reverb: [{ id: 'mix', label: 'Mix', min: 0, max: 100 }],
    gain: [{ id: 'gainDb', label: 'Level', min: -24, max: 24 }]
  };
  sandbox.EffectCatalog = {
    getLabel: function (type) { return LABELS[type] || type; },
    getParamSpec: function (type) { return PARAM_SPECS[type] || []; },
    getAllTypes: function () { return Object.keys(LABELS); }
  };
  sandbox.AgentUI = {
    pushUndo: function (entry) { pushes.push(entry); return true; },
    noteHumanEdit: function () { revisions += 1; },
    undo: function () {
      var entry = pushes.pop();
      if (!entry) { return null; }
      return entry.restore();
    }
  };
  sandbox.ChainCanvas = {
    renderModel: function (model) { acceptedModel = copy(model); return true; },
    renderParam: function () { return true; },
    renderNodeParam: function () { return true; },
    getLayout: function () { return { v: 1 }; }
  };
  sandbox.AudioGraph = {
    buildGraph: function (model) { return Promise.resolve({ committed: true, model: model }); },
    applyParam: function () { return true; }
  };
  sandbox.PresetsUI = {
    getDisplayState: function () { return { name: null, modified: false }; },
    setCurrentPreset: function () {},
    markModified: function () {},
    clearModified: function () {},
    refreshPresetSelect: function () {}
  };
  sandbox.SimpleView = { onChainChanged: function () {} };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'chain-editing.js'), 'utf8'), sandbox, {
    filename: 'src/chain-editing.js'
  });

  // Seed the accepted model the way a real boot does, so param-change
  // requests resolve against a live accepted chain.
  var ready = sandbox.ChainEditing.apply({
    source: 'startup',
    candidate: copy(initial),
    forceStructural: true
  });
  return {
    window: sandbox,
    pushes: pushes,
    ready: ready,
    apply: function (request) { return sandbox.ChainEditing.apply(request); },
    model: function () { return sandbox.ChainEditing.getModel(); }
  };
}

var BASE = [node('n1', 'gain', { gainDb: 2 }), node('n2', 'limiter', { ceiling: -3 })];

// ----------------------------------------------------------------------
// REAL-AgentUI harness (section F): the REAL src/agent-ui.js loaded
// beside the REAL chain-editing module over the same collaborator
// stubs, with the minimal DOM element stub (the test-mutation-undo.js
// shape — class selectors match by membership) so toasts actually
// render. What each part records:
//   pushes   every AgentUI.pushUndo entry (recorder around the real fn)
//   rendered every model ChainEditing rendered through the canvas stub
//            (proof a restore went THROUGH the transaction, not around)
//   events   every CustomEvent dispatched on document
//   toasts() the live toast cards, oldest first
// ----------------------------------------------------------------------
function makeRealElement(tag) {
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
    removeAttribute: function (name) {
      delete el['__attr_' + name];
    },
    appendChild: function (child) {
      child.parentNode = el;
      el.children.push(child);
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
          if (String(el.children[i].className).split(/\s+/).indexOf(cls) !== -1) {
            return el.children[i];
          }
        }
      }
      return null;
    }
  };
  return el;
}

function makeRealHarness(initial) {
  var pushes = [];
  var rendered = [];
  var domEvents = [];
  var domListeners = {};
  var bodyEl = makeRealElement('body');

  var sandbox = {
    console: console,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = (init && init.detail) || null;
    },
    document: {
      getElementById: function () { return null; },
      createElement: function (tag) { return makeRealElement(tag); },
      querySelector: function () { return null; }, // no .topbar -> chip skipped
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
    }
  };
  sandbox.window = sandbox;

  sandbox.AudioEngine = { isStarted: true, isTrackLive: true, audioContext: { state: 'running' } };
  sandbox.Persistence = {
    saveCurrentChain: function () { return { saved: true }; },
    isSaveFailed: function () { return false; }
  };
  var LABELS = { gain: 'Gain', limiter: 'Limiter', reverb: 'Reverb', eq: 'EQ', delay: 'Delay' };
  var PARAM_SPECS = {
    reverb: [{ id: 'mix', label: 'Mix', min: 0, max: 100 }],
    gain: [{ id: 'gainDb', label: 'Level', min: -24, max: 24 }]
  };
  sandbox.EffectCatalog = {
    getLabel: function (type) { return LABELS[type] || type; },
    getParamSpec: function (type) { return PARAM_SPECS[type] || []; },
    getAllTypes: function () { return Object.keys(LABELS); }
  };
  sandbox.ChainCanvas = {
    getCurrentModel: function () { return []; },
    renderModel: function (model) { rendered.push(copy(model)); return true; },
    renderNodeParam: function () { return true; },
    getLayout: function () { return { v: 1 }; }
  };
  sandbox.AudioGraph = {
    buildGraph: function (model) { return Promise.resolve({ committed: true, model: model }); },
    applyParam: function () { return true; }
  };
  sandbox.PresetsUI = {
    getDisplayState: function () { return { name: null, modified: false }; },
    setCurrentPreset: function () {},
    markModified: function () {},
    clearModified: function () {},
    refreshPresetSelect: function () {}
  };
  sandbox.SimpleView = { onChainChanged: function () {} };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'agent-ui.js'), 'utf8'), sandbox, {
    filename: 'src/agent-ui.js'
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'chain-editing.js'), 'utf8'), sandbox, {
    filename: 'src/chain-editing.js'
  });

  // Recorder around the REAL pushUndo export — behavior unchanged.
  var realPushUndo = sandbox.AgentUI.pushUndo;
  sandbox.AgentUI.pushUndo = function (entry) {
    pushes.push(entry);
    return realPushUndo(entry);
  };

  function toasts() {
    for (var i = 0; i < bodyEl.children.length; i++) {
      if (bodyEl.children[i].id === 'agent-toast-region') {
        return bodyEl.children[i].children.slice();
      }
    }
    return [];
  }

  function events(type) {
    return domEvents.filter(function (ev) { return ev.type === type; });
  }

  var ready = sandbox.ChainEditing.apply({
    source: 'startup',
    candidate: copy(initial),
    forceStructural: true
  });

  return {
    window: sandbox,
    pushes: pushes,
    rendered: rendered,
    ready: ready,
    apply: function (request) { return sandbox.ChainEditing.apply(request); },
    model: function () { return sandbox.ChainEditing.getModel(); },
    toasts: toasts,
    events: events,
    undo: function () { return sandbox.AgentUI.undo(); },
    canUndo: function () { return sandbox.AgentUI.canUndo(); }
  };
}

async function main() {
  console.log('A. label derivation — operator language, one entry per edit');

  // A1: param fast path names module, param, and both values.
  var h = makeHarness(BASE);
  await h.ready;
  await h.apply({
    source: 'human',
    change: { nodeId: 'n1', param: 'gainDb', value: 9 }
  });
  check(h.pushes.length === 1 && h.pushes[0].kind === 'human' &&
      h.pushes[0].label === 'Gain Level 2 → 9',
    'A1: a param edit pushes one human entry labeled "Gain Level 2 → 9"');

  // A2: structural add / remove / move / same-ID type change.
  h = makeHarness(BASE);
  await h.apply({
    source: 'human',
    candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]]
  });
  check(h.pushes.length === 1 && h.pushes[0].label === 'Add Reverb',
    'A2: an add labels "Add Reverb"');

  await h.apply({
    source: 'human',
    candidate: [BASE[0], BASE[1]]
  });
  check(h.pushes.length === 2 && h.pushes[1].label === 'Remove Reverb',
    'A2: a removal labels "Remove Reverb"');

  await h.apply({
    source: 'human',
    candidate: [BASE[1], BASE[0]]
  });
  check(h.pushes.length === 3 && h.pushes[2].label === 'Move Limiter to the start',
    'A2: a move to the front labels "Move Limiter to the start"');

  // A same-ID type change, on a fresh harness (the move above flipped
  // the accepted order, and a Replace reads against matching positions).
  var h2 = makeHarness(BASE);
  await h2.ready;
  await h2.apply({
    source: 'human',
    candidate: [node('n1', 'reverb', { mix: 30 }), BASE[1]]
  });
  check(h2.pushes.length === 1 && h2.pushes[0].label === 'Replace Gain with Reverb',
    'A2: a same-ID type change labels "Replace Gain with Reverb"');

  // A3: a human preset load names the sound.
  h = makeHarness(BASE);
  await h.apply({
    source: 'preset',
    candidate: [node('q', 'eq', { lowGain: 1 })],
    forceStructural: true,
    preset: { name: 'Warm Ballad', modified: false }
  });
  check(h.pushes.length === 1 && h.pushes[0].label === "Try 'Warm Ballad'",
    'A3: a preset load labels "Try \'Warm Ballad\'"');

  // A4: fallback label when the catalog is absent.
  h = makeHarness(BASE);
  h.window.EffectCatalog = undefined;
  await h.apply({
    source: 'human',
    candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]]
  });
  check(h.pushes.length === 1 && h.pushes[0].label === 'Add reverb',
    'A4: without a catalog the type key stands in ("Add reverb")');

  console.log('B. restore fidelity — the guarded undo route');

  h = makeHarness(BASE);
  await h.apply({
    source: 'human',
    candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]]
  });
  var entry = h.pushes[0];
  await entry.restore();
  check(JSON.stringify(h.model()) === JSON.stringify(BASE),
    'B1: restoring the add returns the exact pre-edit model');
  check(h.pushes.length === 1,
    'B2: a restore (source \'undo\') pushes nothing — no undo loops');

  console.log('C. sources that must NOT push');

  h = makeHarness(BASE);
  await h.apply({ source: 'startup', candidate: BASE, forceStructural: true });
  check(h.pushes.length === 0, 'C1: startup restore pushes nothing');

  await h.apply({ source: 'agent', candidate: BASE, forceStructural: true });
  check(h.pushes.length === 0,
    'C2: an agent edit without undoLabel pushes no HUMAN entry (its own path owns that)');

  console.log('D. sequential undos of your own edits never confirm');

  h = makeHarness(BASE);
  await h.apply({ source: 'human', candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]] });
  await h.apply({
    source: 'human',
    change: { nodeId: 'n1', param: 'gainDb', value: 12 }
  });
  check(h.pushes.length === 2, 'D0: two human edits, two entries');
  await h.window.AgentUI.undo();
  check(JSON.stringify(h.model()).indexOf('"reverb"') !== -1 && h.pushes.length === 1,
    'D1: first undo reverted the param edit only (the add survives)');
  await h.window.AgentUI.undo();
  check(JSON.stringify(h.model()) === JSON.stringify(BASE) && h.pushes.length === 0,
    'D2: second undo reverted the add — no confirm anywhere in the sequence');

  console.log('E. entry shape');

  h = makeHarness(BASE);
  await h.apply({ source: 'human', candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]] });
  var e = h.pushes[0];
  check(typeof e.label === 'string' && e.label.length > 0 && typeof e.restore === 'function',
    'E1: the entry carries the pushUndo contract (label + restore)');
  check(e.kind === 'human',
    'E1: and kind \'human\', the flag agent-ui\'s conflict gate reads');

  // =====================================================================
  console.log('F. the visible entry point — REAL agent-ui toasts (2026-09-03, critique P2 #2)');
  // =====================================================================

  function toastSummary(t) {
    for (var i = 0; i < t.children.length; i++) {
      if (t.children[i].className === 'agent-toast-summary') {
        return t.children[i].textContent;
      }
    }
    return null;
  }

  function isHumanToastCard(t) {
    return t.getAttribute('data-human-edit') === 'true';
  }

  function undoBtnOf(t) {
    return t.querySelector('.agent-toast-undo');
  }

  function settleReal() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 20);
    });
  }

  // F1: a human STRUCTURAL edit raises exactly one labeled toast with a
  // working Undo key — and does not fire the agent mutation event.
  var r = makeRealHarness(BASE);
  await r.ready;
  await r.apply({ source: 'human', candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]] });
  var fToasts = r.toasts();
  check(fToasts.length === 1,
    'F1: a structural add raises exactly ONE toast');
  check(fToasts.length === 1 && isHumanToastCard(fToasts[0]) && toastSummary(fToasts[0]) === 'Add Reverb',
    'F1: it is tagged data-human-edit and carries the operator label "Add Reverb" (one vocabulary)');
  var fBtn = fToasts.length === 1 ? undoBtnOf(fToasts[0]) : null;
  check(!!fBtn && String(fBtn.tagName).toUpperCase() === 'BUTTON' && fBtn.textContent === 'Undo',
    'F1: it carries the keyboard-reachable Undo key');
  check(r.pushes.length === 1 && r.canUndo() === true,
    'F1: exactly one undo entry backs it (the one shared stack)');
  check(r.events('agentui:mutation').length === 0,
    'F1: the human path is not the agent mouth — no agentui:mutation fired');

  // F2: a param-only commit raises NO toast (still only the F1 card).
  await r.apply({ source: 'human', change: { nodeId: 'n1', param: 'gainDb', value: 9 } });
  check(r.toasts().length === 1,
    'F2: a param-only commit raises NO toast');
  check(r.pushes.length === 2,
    'F2: but its silent undo entry still pushed (Ctrl/Cmd+Z path unchanged)');

  // F3: the IN/BYP key (a bypass-flag-only candidate) raises NO toast.
  var fBypassed = copy(r.model());
  fBypassed[0].bypassed = true;
  await r.apply({ source: 'human', candidate: fBypassed, forceStructural: true });
  check(r.toasts().length === 1,
    'F3: a bypass-flag-only edit (the IN/BYP key) raises NO toast');
  check(r.pushes.length === 3 && r.pushes[2].label === 'Edit chain',
    'F3: and still pushed its silent entry, labeled by the same derivation');

  // F4: a preset try-load announces with the sound's name.
  await r.apply({
    source: 'preset',
    candidate: [node('q', 'eq', { lowGain: 1 })],
    forceStructural: true,
    preset: { name: 'Warm Ballad', modified: false }
  });
  var f4Toasts = r.toasts();
  check(f4Toasts.length === 2 && isHumanToastCard(f4Toasts[1]) &&
      toastSummary(f4Toasts[1]) === "Try 'Warm Ballad'",
    'F4: a preset try-load raises one toast labeled "Try \'Warm Ballad\'"');
  check(f4Toasts.length === 2 && !!undoBtnOf(f4Toasts[1]) && undoBtnOf(f4Toasts[0]) === null,
    'F4: the Undo key moved to the newest entry\'s toast (the one-button invariant holds)');

  // F5: the agent path's toast behavior is unchanged.
  r.window.AgentUI.reportMutation({
    source: 'agent',
    summary: 'Agent set Reverb mix to 40% (n5)',
    nodeIds: ['x']
  });
  var f5Toasts = r.toasts();
  var f5Mut = r.events('agentui:mutation');
  check(f5Toasts.length === 3 && !isHumanToastCard(f5Toasts[2]) &&
      String(toastSummary(f5Toasts[2])).indexOf('Agent set') === 0,
    'F5: reportMutation still raises its own toast — untagged, in its own summary voice');
  check(f5Mut.length === 1 && f5Mut[0].detail.source === 'agent',
    'F5: agentui:mutation fired exactly once, only for the agent report');
  check(f5Toasts.length === 3 && !!undoBtnOf(f5Toasts[1]) && undoBtnOf(f5Toasts[2]) === null,
    'F5: the agent toast does not take the Undo key — it stays on the newest entry\'s own card');

  // F6: undo FROM the human toast routes through the guarded pop path
  // and restores silently (fresh harness, one edit, one click).
  var g = makeRealHarness(BASE);
  await g.ready;
  await g.apply({ source: 'human', candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]] });
  var gToast = g.toasts()[0];
  var gBtn = gToast ? undoBtnOf(gToast) : null;
  if (gBtn) {
    gBtn.__fire('click'); // createUndoButton()'s own click handler -> undo()
  }
  await settleReal();
  var gUndo = g.events('agentui:undo');
  check(gUndo.length === 1 && gUndo[0].detail.label === 'Add Reverb' && gUndo[0].detail.remaining === 0,
    'F6: the toast\'s Undo key popped through the guarded undo() (agentui:undo, remaining 0)');
  check(JSON.stringify(g.model()) === JSON.stringify(BASE),
    'F6: the restore re-applied the exact pre-edit model');
  var baseRenders = g.rendered.filter(function (m) {
    return JSON.stringify(m) === JSON.stringify(BASE);
  }).length;
  check(baseRenders === 2 && g.pushes.length === 1 && g.canUndo() === false,
    'F6: the restore went THROUGH ChainEditing (seed + rollback renders), pushing nothing');
  var gToastsAfter = g.toasts();
  check(gToastsAfter.length === 1 &&
      gToastsAfter[0].getAttribute('data-undone') !== 'true' &&
      gToastsAfter[0].querySelector('.agent-toast-undone') === null,
    'F6: the restore stayed SILENT — no Undone annotation on the human toast');
  check(gToastsAfter.length === 1 && undoBtnOf(gToastsAfter[0]) === null,
    'F6: the toast\'s Undo key retired with its entry (stack empty)');

  // F7: a human card never lends its key to a LATER silent entry. The
  // param entry below pushes no toast of its own; without the human
  // skip in refreshUndoButtons' fallback it would adopt the live human
  // card — whose label names a different edit.
  var p = makeRealHarness(BASE);
  await p.ready;
  await p.apply({ source: 'human', candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]] });
  await p.apply({ source: 'human', change: { nodeId: 'n1', param: 'gainDb', value: 9 } });
  check(p.toasts().length === 1 && undoBtnOf(p.toasts()[0]) === null,
    'F7: a silent param entry (newest, toastless) borrows NO key — not the human card\'s');
  await p.undo(); // pops the param entry; the add is newest again
  await settleReal();
  check(p.toasts().length === 1 && !!undoBtnOf(p.toasts()[0]),
    'F7: its own entry restored, the human card carries the key again');

  // F8: an agent entry's conflict question never lands on a human card.
  // Direct agent push (no reportMutation -> no toast association), then
  // a human structural edit on top: when the human entry pops and the
  // conflicted agent entry surfaces, the confirm goes to a RECOVERY
  // toast — the human card is left untouched.
  var q = makeRealHarness(BASE);
  await q.ready;
  q.window.AgentUI.pushUndo({
    label: 'set_param n5.mix 40%',
    restore: function () {
      return q.apply({ source: 'undo', candidate: copy(BASE), forceStructural: true });
    }
  });
  await q.apply({ source: 'human', candidate: [BASE[0], node('x', 'reverb', { mix: 30 }), BASE[1]] });
  await q.undo(); // pops the human add (silent)
  await settleReal();
  await q.undo(); // the agent entry underneath — conflicted, must confirm
  await settleReal();
  var qToasts = q.toasts();
  var qHuman = qToasts.filter(function (t) { return isHumanToastCard(t); })[0];
  var qConflict = qToasts.filter(function (t) {
    return t.getAttribute('data-conflict') === 'true';
  })[0];
  check(!!qHuman &&
      qHuman.getAttribute('data-conflict') !== 'true' &&
      qHuman.querySelector('.agent-toast-conflict') === null,
    'F8: the human card carries no conflict question');
  check(!!qConflict && !isHumanToastCard(qConflict) &&
      qConflict.children.some(function (c) {
        return c.className === 'agent-toast-conflict';
      }),
    'F8: the conflicted agent entry surfaced its confirm on its own recovery toast');
}

main().then(
  function () {
    console.log(failures.length === 0
      ? 'human-undo: ALL OK'
      : 'human-undo: ' + failures.length + ' FAIL');
    process.exit(failures.length === 0 ? 0 : 1);
  },
  function (err) {
    console.error('FAIL: harness threw: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
);
