// Test for issue #6 — [P1] stale agent Undo must not overwrite later
// human edits.
//
// The bug: AgentUI.undo() restored a full pre-mutation snapshot without
// checking whether the HUMAN changed the chain or presets afterwards
// (src/mcp-tools.js snapshot/restore + src/agent-ui.js undo stack).
// None of the human paths (slider, drag, remove, preset save/overwrite,
// preset load, preset delete) invalidated the agent Undo entry, so
// pressing Undo after a later human edit silently erased the human's
// work; a preset Undo could likewise clobber newer stored content.
//
// The fix under test: a state-revision counter owned by src/agent-ui.js
// (AgentUI.noteHumanEdit()), bumped at each HUMAN mutation entry point,
// recorded with every pushed undo entry, and consulted at undo time —
// a mismatch surfaces a toast conflict ("Undo anyway?" two-press
// confirm) instead of auto-applying.
//
// Everything below runs END-TO-END through the REAL modules:
//
//   src/agent-ui.js       the REAL toast UI, undo stack, revision
//                         counter, conflict confirm, Cmd/Ctrl+Z
//   src/param-controls.js the REAL slider input handler (human case a)
//   src/canvas.js         the REAL card/remove/drag handlers — the
//                         SortableJS callbacks are captured from a
//                         Sortable stub and invoked exactly as a real
//                         drop would (human cases b and c)
//   src/presets-ui.js     the REAL Save As / Load / Delete button
//                         handlers (human cases d and e)
//   src/preset-store.js   the REAL store over a stub localStorage
//   src/mcp-tools.js      the REAL set_param / save_preset tools
//
// Mandated conflict cases — between an agent mutation and its Undo:
//   (a) slider change   (b) drag-add   (c) node removal
//   (d) preset overwrite (by the human)   (e) preset deletion (by the
//   human). Per case: first Undo attempt does NOT auto-apply; the
//   conflict is surfaced (toast conflict note + confirm affordance +
//   agentui:undo-conflict event); explicit confirmation applies the
//   restore; without confirmation (toast dismissed) the human state is
//   intact and the entry stays un-consumed.
//
// Regression guards: no human edit in between -> Undo auto-applies
// exactly as today; pure-agent sequences (agent edit after agent edit)
// still undo automatically (agent mutations do NOT bump the revision);
// and the beyond-toast recovery path: Cmd/Ctrl+Z consults the STACK
// after every toast is gone — it applies a NON-conflicted newest entry
// and refuses a conflicted one.
//
// Same committed-test convention as the other suites: zero-dependency
// Node harness, stub browser globals, the REAL src files loaded in a vm.
//
// Run from a clean clone:  node tests/test-undo-conflict-safety.js
// (or via the runner:      node tests/run.js undo-conflict)
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var STORAGE_KEY = 'karaoke-presets-v1';

// File contents are read once and reused by every sandbox.
var SRC_CACHE = {};
function src(relPath) {
  if (!Object.prototype.hasOwnProperty.call(SRC_CACHE, relPath)) {
    SRC_CACHE[relPath] = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  }
  return SRC_CACHE[relPath];
}

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
// (~20ms after the call). 60ms is a comfortable settle.
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
// Minimal Web Audio stubs (same shapes as the mutation-undo test: the
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
    connect: function (dest) {
      this.__connectionsTo.push(dest);
    },
    disconnect: function (dest) {
      if (dest === undefined) {
        this.__connectionsTo = [];
      }
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
// DOM element stub — rich enough for the REAL src/agent-ui.js (toast
// region, toasts, undo/conflict buttons), src/param-controls.js (slider
// rows), src/canvas.js (palette + cards + Sortable wiring) and
// src/presets-ui.js (panel). Class selectors match by membership (CSS
// semantics). __fire passes a minimal event object with
// stopPropagation/preventDefault no-ops, as the real handlers expect.
// ----------------------------------------------------------------------
function classList(el) {
  return String(el.className).split(/\s+/).filter(Boolean);
}

function makeElement(tag) {
  var el = {
    tagName: tag,
    id: '',
    className: '',
    type: '',
    textContent: '',
    title: '',
    label: '',
    selected: false,
    disabled: false,
    parentNode: null,
    children: [],
    style: {},
    __listeners: {},
    __value: ''
  };
  el.setAttribute = function (name, value) {
    el['__attr_' + name] = value;
  };
  el.getAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(el, '__attr_' + name)
      ? el['__attr_' + name]
      : null;
  };
  el.appendChild = function (child) {
    child.parentNode = el;
    el.children.push(child);
    return child;
  };
  el.insertBefore = function (child, ref) {
    child.parentNode = el;
    var idx = el.children.indexOf(ref);
    if (idx === -1) {
      el.children.push(child);
    } else {
      el.children.splice(idx, 0, child);
    }
    return child;
  };
  el.removeChild = function (child) {
    var idx = el.children.indexOf(child);
    if (idx !== -1) {
      el.children.splice(idx, 1);
    }
    child.parentNode = null;
  };
  el.replaceWith = function (next) {
    next.parentNode = el.parentNode;
    if (el.parentNode) {
      var idx = el.parentNode.children.indexOf(el);
      if (idx !== -1) {
        el.parentNode.children[idx] = next;
      }
    }
  };
  Object.defineProperty(el, 'firstChild', {
    get: function () {
      return el.children.length > 0 ? el.children[0] : null;
    }
  });
  el.remove = function () {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  };
  el.addEventListener = function (type, fn) {
    (el.__listeners[type] = el.__listeners[type] || []).push(fn);
  };
  el.removeEventListener = function (type, fn) {
    var list = el.__listeners[type] || [];
    var idx = list.indexOf(fn);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
  };
  el.__fire = function (type, ev) {
    var event = ev || {
      stopPropagation: function () {},
      preventDefault: function () {}
    };
    (el.__listeners[type] || []).forEach(function (fn) {
      fn(event);
    });
  };
  el.classList = {
    add: function (c) {
      var list = classList(el);
      if (list.indexOf(c) === -1) {
        list.push(c);
        el.className = list.join(' ');
      }
    },
    remove: function (c) {
      el.className = classList(el)
        .filter(function (x) {
          return x !== c;
        })
        .join(' ');
    },
    contains: function (c) {
      return classList(el).indexOf(c) !== -1;
    },
    toggle: function (c) {
      if (this.contains(c)) {
        this.remove(c);
      } else {
        this.add(c);
      }
    }
  };
  el.querySelector = function (selector) {
    if (selector.charAt(0) === '.') {
      var cls = selector.slice(1);
      for (var i = 0; i < el.children.length; i++) {
        if (classList(el.children[i]).indexOf(cls) !== -1) {
          return el.children[i];
        }
      }
    }
    return null;
  };
  el.querySelectorAll = function (selector) {
    if (selector === '.node-card') {
      return el.children.filter(function (child) {
        return classList(child).indexOf('node-card') !== -1;
      });
    }
    return [];
  };
  Object.defineProperty(el, 'innerHTML', {
    configurable: true,
    get: function () {
      return '';
    },
    set: function () {
      el.children.forEach(function (child) {
        child.parentNode = null;
      });
      el.children = [];
    }
  });
  Object.defineProperty(el, 'value', {
    configurable: true,
    get: function () {
      if (String(el.tagName).toLowerCase() === 'select') {
        for (var i = 0; i < el.children.length; i++) {
          if (el.children[i].selected) {
            return el.children[i].value;
          }
        }
        return el.children.length > 0 ? el.children[0].value : '';
      }
      return el.__value;
    },
    set: function (v) {
      el.__value = String(v);
    }
  });
  return el;
}

// Depth-first id search (R2-3 — for the dynamically created naming row).
function findByIdIn(el, id) {
  return findIn(el, function (node) {
    return node.id === id;
  });
}

// Depth-first search over an element's subtree.
function findIn(el, predicate) {
  if (predicate(el)) {
    return el;
  }
  for (var i = 0; i < el.children.length; i++) {
    var hit = findIn(el.children[i], predicate);
    if (hit) {
      return hit;
    }
  }
  return null;
}

// ----------------------------------------------------------------------
// The sandbox: a vm context whose global IS `window`, with host timers,
// the full DOM stub (canvas lists + preset panel + body), a stub
// localStorage, prompt/confirm recorders, a Sortable capturer, a
// STARTED engine, and the never-settling fetch src/node-reverb.js
// tolerates.
// ----------------------------------------------------------------------
function createEnv() {
  var env = {
    domEvents: [],
    domListeners: {},
    promptResponse: '',
    confirmResponse: true,
    sortables: []
  };

  var byId = {
    'palette-list': makeElement('ul'),
    'chain-list': makeElement('ul'),
    'empty-hint': makeElement('p'),
    'chain-layout': makeElement('div'),
    'save-preset-btn': makeElement('button'),
    'current-preset-name': makeElement('span'),
    'unsaved-indicator': makeElement('span'),
    'preset-select': makeElement('select'),
    'load-preset-btn': makeElement('button'),
    'delete-preset-btn': makeElement('button')
  };
  byId['current-preset-name'].textContent = 'Unsaved chain';
  byId['unsaved-indicator'].style.display = 'none';
  var presetHost = makeElement('div');
  presetHost.appendChild(byId['preset-select']);
  env.presetHost = presetHost;
  env.byId = byId;

  var bodyEl = makeElement('body');
  var storageBox = {};

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
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = (init && init.detail) || null;
    },
    document: {
      getElementById: function (id) {
        // R2-3: fall back to a subtree search so the dynamically created
        // inline naming row (appended to the select's host) is findable.
        return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : findByIdIn(presetHost, id);
      },
      createElement: function (tag) {
        return makeElement(tag);
      },
      querySelector: function () {
        return null; // no .topbar/.canvas-panel -> chip/flow toggle skipped
      },
      addEventListener: function (type, fn) {
        (env.domListeners[type] = env.domListeners[type] || []).push(fn);
      },
      dispatchEvent: function (ev) {
        env.domEvents.push({ type: ev.type, detail: ev.detail });
        (env.domListeners[ev.type] || []).forEach(function (fn) {
          fn(ev);
        });
        return true;
      },
      body: bodyEl
    },
    localStorage: {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(storageBox, key) ? storageBox[key] : null;
      },
      setItem: function (key, value) {
        storageBox[key] = String(value);
      },
      removeItem: function (key) {
        delete storageBox[key];
      }
    },
    prompt: function () {
      return env.promptResponse;
    },
    confirm: function () {
      return env.confirmResponse;
    },
    alert: function () {},
    fetch: function () {
      return new Promise(function () {});
    },
    Sortable: function Sortable(el, opts) {
      env.sortables.push({ el: el, opts: opts });
      return { destroy: function () {} };
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
  env.sandbox = sandbox;

  [
    'src/agent-ui.js',
    'src/audio-graph.js',
    'src/node-types.js',
    'src/audio-param-ramp.js',
    'src/node-gain.js',
    'src/node-compressor.js',
    'src/node-eq.js',
    'src/node-delay.js',
    'src/node-reverb.js',
    'src/node-limiter.js',
    'src/default-preset.js',
    'src/preset-schema.js',
    'src/preset-store.js',
    'src/presets-ui.js',
    'src/param-controls.js',
    'src/canvas.js',
    'src/chain-editing.js',
    'src/mcp-tools.js'
  ].forEach(function (relPath) {
    vm.runInContext(src(relPath), sandbox, { filename: relPath });
  });

  return env;
}

// ----------------------------------------------------------------------
// Shared helpers over an env.
// (FEW-2/PD-1 note: the chain-list Sortable no longer exists — the human
// add verb is ChainCanvas.addNodeType, used directly by case (b) below.)
// ----------------------------------------------------------------------

function modelOf(env) {
  return env.sandbox.ChainCanvas.getCurrentModel();
}

function paramOf(env, nodeId, param) {
  var model = modelOf(env);
  for (var i = 0; i < model.length; i++) {
    if (model[i].id === nodeId) {
      return model[i].params[param];
    }
  }
  return undefined;
}

function liveToasts(env) {
  var region = null;
  var kids = env.sandbox.__body.children;
  for (var i = 0; i < kids.length; i++) {
    if (kids[i].id === 'agent-toast-region') {
      region = kids[i];
      break;
    }
  }
  return region ? region.children.slice() : [];
}

function newestToast(env) {
  var toasts = liveToasts(env);
  return toasts.length > 0 ? toasts[toasts.length - 1] : null;
}

function undoButton(toast) {
  return toast ? toast.querySelector('.agent-toast-undo') : null;
}

function dismissAllToasts(env) {
  var toasts = liveToasts(env);
  toasts.forEach(function (toast) {
    toast.remove();
  });
}

function eventsOfType(env, type) {
  return env.domEvents.filter(function (e) {
    return e.type === type;
  });
}

function fireKeyboardUndo(env) {
  var prevented = false;
  (env.domListeners.keydown || []).forEach(function (fn) {
    fn({
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      key: 'z',
      preventDefault: function () {
        prevented = true;
      }
    });
  });
  return prevented;
}

function cardFor(env, nodeId) {
  var cards = env.byId['chain-list'].children.filter(function (c) {
    return classList(c).indexOf('node-card') !== -1;
  });
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].getAttribute('data-node-id') === nodeId) {
      return cards[i];
    }
  }
  return null;
}

function getTool(env, name) {
  var defs = env.sandbox.McpTools.getDefs();
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].name === name) {
      return defs[i];
    }
  }
  throw new Error('test bug: tool def not found: ' + name);
}

function cloneNodes(nodes) {
  return nodes.map(function (entry) {
    return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
  });
}

// The agent mutation every chain conflict case starts from: set_param
// reverb mix 20 -> 40 on n5 (the canonical harmless edit).
function agentSetParamMix40(env) {
  return getTool(env, 'set_param').execute({ nodeId: 'n5', param: 'mix', value: 40 });
}

function seedDefault(env) {
  return env.sandbox.ChainEditing.apply({
    source: 'startup',
    candidate: env.sandbox.DEFAULT_PRESET.nodes,
    forceStructural: true
  });
}

// ----------------------------------------------------------------------
// Per-case conflict runner. `humanEdit` performs the human mutation
// (through its REAL entry point) and returns a label; `humanState`
// asserts the human's state is present; `restoredState` asserts the
// snapshot's state after an explicit confirm; `undoTarget` selects
// which pushed entry the conflict is asserted against (default: the
// newest toast's button + AgentUI.undo()).
// ----------------------------------------------------------------------
async function conflictCase(caseLabel, humanEdit, assertHumanState, assertRestoredState) {
  // -- Part 1: the conflict is surfaced, NOT applied. ------------------
  var env = createEnv();
  var sandbox = env.sandbox;
  await seedDefault(env);
  await settle();

  var res = await agentSetParamMix40(env);
  check(!!res && res.applied === true, caseLabel + ' seed: agent set_param applied');
  await settle();

  var editLabel = humanEdit(env);
  await settle();
  assertHumanState(env, editLabel);

  var toast = newestToast(env);
  var btn = undoButton(toast);
  check(!!btn && btn.textContent === 'Undo', caseLabel + ': the toast carries the Undo button');
  check(
    sandbox.AgentUI.canUndo() === true,
    caseLabel + ': the undo stack is non-empty before the attempt'
  );

  env.domEvents.length = 0;
  btn.__fire('click'); // FIRST press — must NOT auto-apply.
  await settle();

  var conflictEvents = eventsOfType(env, 'agentui:undo-conflict');
  var undoEvents = eventsOfType(env, 'agentui:undo');
  check(
    undoEvents.length === 0,
    caseLabel + ': first Undo press applied NOTHING (no agentui:undo fired)'
  );
  check(
    conflictEvents.length === 1 && typeof conflictEvents[0].detail.label === 'string',
    caseLabel + ': agentui:undo-conflict fired exactly once'
  );
  check(
    sandbox.AgentUI.canUndo() === true,
    caseLabel + ': the entry is NOT consumed by the refused attempt'
  );
  var toastAfter = newestToast(env);
  check(
    !!toastAfter &&
      toastAfter.getAttribute('data-conflict') === 'true' &&
      toastAfter.children.some(function (c) {
        return classList(c).indexOf('agent-toast-conflict') !== -1 &&
          c.textContent.indexOf('Undo anyway?') !== -1;
      }),
    caseLabel + ': the toast shows the conflict note ("…Undo anyway?")'
  );
  var confirmBtn = undoButton(toastAfter);
  check(
    !!confirmBtn &&
      confirmBtn.textContent === 'Undo anyway' &&
      confirmBtn.getAttribute('data-confirm-undo') === 'true',
    caseLabel + ': the button became the "Undo anyway" confirm affordance'
  );
  if (!confirmBtn) {
    return; // Nothing to confirm through — the remaining checks need it.
  }

  // -- Part 2: explicit confirmation applies the restore. --------------
  confirmBtn.__fire('click'); // SECOND press — the explicit confirm.
  await settle();
  check(
    eventsOfType(env, 'agentui:undo').length === 1,
    caseLabel + ': confirmed Undo fired agentui:undo'
  );
  check(
    sandbox.AgentUI.canUndo() === false,
    caseLabel + ': the entry was consumed by the confirmed Undo'
  );
  assertRestoredState(env, editLabel);

  // -- Part 3: without confirmation (toast dismissed) the human state
  //    survives and the entry stays available-but-unapplied. ----------
  var env2 = createEnv();
  var sandbox2 = env2.sandbox;
  await seedDefault(env2);
  await settle();
  await agentSetParamMix40(env2);
  await settle();
  humanEdit(env2);
  await settle();
  dismissAllToasts(env2);

  var direct = sandbox2.AgentUI.undo();
  check(
    direct === null && sandbox2.AgentUI.canUndo() === true,
    caseLabel + ': undo() with no live toast resolves null WITHOUT consuming the entry'
  );
  var prevented = fireKeyboardUndo(env2);
  check(
    prevented === false,
    caseLabel + ': Cmd/Ctrl+Z on a conflicted entry does not consume the key'
  );
  assertHumanState(env2, editLabel);
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  // (a) slider change -------------------------------------------------
  function humanSlider(env) {
    var card = cardFor(env, 'n5');
    var input = findIn(card, function (el) {
      return el.id === 'param-n5-mix';
    });
    if (!input) {
      throw new Error('test bug: n5 mix slider not rendered');
    }
    input.value = '80';
    input.__fire('input'); // the REAL param-controls input handler
    return 'slider n5.mix 80';
  }
  await conflictCase(
    '(a) slider',
    humanSlider,
    function (env, label) {
      check(
        paramOf(env, 'n5', 'mix') === 80,
        label + ': the human slider value 80 is live in the model'
      );
    },
    function (env, label) {
      check(
        paramOf(env, 'n5', 'mix') === 20,
        label + ': confirmed Undo restored the pre-agent snapshot (mix 20)'
      );
    }
  );

  // (b) palette-add through the REAL add verb (FEW-2/PD-1: the chain
  // Sortable is retired; the chip click/keyboard path addNodeType IS the
  // human add — same commit chokepoint, same revision bump) ------------
  function humanDragAdd(env) {
    env.sandbox.ChainCanvas.addNodeType('gain'); // the REAL add verb: card + commit + bump
    return 'palette-add gain';
  }
  await conflictCase(
    '(b) drag',
    humanDragAdd,
    function (env, label) {
      check(
        modelOf(env).length === 7 &&
          modelOf(env)[5].type === 'gain' &&
          modelOf(env)[6].type === 'limiter',
        label + ': the human palette-add is live (7 nodes; the terminal limiter STAYS terminal per the add policy)'
      );
    },
    function (env, label) {
      check(
        modelOf(env).length === 6,
        label + ': confirmed Undo restored the 6-node pre-agent chain'
      );
    }
  );

  // (c) node removal through the REAL remove-button handler ------------
  function humanRemove(env) {
    var card = cardFor(env, 'n3');
    var btn = findIn(card, function (el) {
      return classList(el).indexOf('node-remove-btn') !== -1;
    });
    if (!btn) {
      throw new Error('test bug: n3 remove button not rendered');
    }
    btn.__fire('click');
    return 'remove n3';
  }
  await conflictCase(
    '(c) removal',
    humanRemove,
    function (env, label) {
      check(
        modelOf(env).length === 5 &&
          modelOf(env).filter(function (n) { return n.id === 'n3'; }).length === 0,
        label + ': the human removal is live (5 nodes, n3 gone)'
      );
    },
    function (env, label) {
      check(
        modelOf(env).length === 6 &&
          modelOf(env).filter(function (n) { return n.id === 'n3'; }).length === 1,
        label + ': confirmed Undo restored the 6-node pre-agent chain (n3 back)'
      );
    }
  );

  // (d) preset overwrite by the human Save As handler ------------------
  async function presetOverwriteCase() {
    var caseLabel = '(d) preset overwrite';
    var run = async function (withConfirm) {
      var env = createEnv();
      var sandbox = env.sandbox;
      // A pre-existing stored preset whose content differs from the chain
      // the agent will save (mix 50 vs the live mix 40 after set_param).
      var variant = cloneNodes(sandbox.DEFAULT_PRESET.nodes);
      variant.forEach(function (entry) {
        if (entry.id === 'n5') {
          entry.params.mix = 50;
        }
      });
      sandbox.PresetStore.save('Stage', variant); // test seeding — no bump
      await seedDefault(env);
      await settle();
      await agentSetParamMix40(env);
      await settle();
      var saved = await getTool(env, 'save_preset').execute({ name: 'Stage' });
      check(
        !!saved && saved.applied === true && saved.overwrote === true,
        caseLabel + ' seed: agent save_preset overwrote "Stage"'
      );

      // The HUMAN overwrites the same preset through the real Save As —
      // R2-3: the inline naming row (Save As… opens it, the row's Save
      // commits), no browser prompt().
      env.byId['save-preset-btn'].__fire('click');
      var nameInput = sandbox.document.getElementById('preset-name-input');
      nameInput.value = 'Stage';
      sandbox.document.getElementById('preset-name-confirm').__fire('click');
      var humanStored = sandbox.PresetStore.load('Stage');
      var humanMix = humanStored.nodes.filter(function (n) { return n.id === 'n5'; })[0].params.mix;
      return { env: env, sandbox: sandbox, humanMix: humanMix, withConfirm: withConfirm };
    };

    var part1 = await run(false);
    check(
      part1.humanMix === 40,
      '(d) human overwrite: the HUMAN\'s stored content (mix 40) is in the store'
    );
    var toast = newestToast(part1.env);
    var btn = undoButton(toast);
    part1.env.domEvents.length = 0;
    btn.__fire('click'); // first press — must not clobber the store
    var storedAfterRefusal = part1.sandbox.PresetStore.load('Stage');
    var mixAfterRefusal = storedAfterRefusal.nodes.filter(function (n) { return n.id === 'n5'; })[0].params.mix;
    check(
      eventsOfType(part1.env, 'agentui:undo').length === 0 &&
        eventsOfType(part1.env, 'agentui:undo-conflict').length === 1,
      '(d) first Undo press surfaced the conflict, applied nothing'
    );
    check(
      mixAfterRefusal === 40,
      '(d) without confirmation the human\'s stored preset is INTACT (mix 40)'
    );
    var confirmBtn = undoButton(newestToast(part1.env));
    check(
      !!confirmBtn && confirmBtn.textContent === 'Undo anyway',
      '(d) the preset toast shows the confirm affordance'
    );
    if (confirmBtn) {
      confirmBtn.__fire('click');
    }
    var storedAfterConfirm = part1.sandbox.PresetStore.load('Stage');
    var mixAfterConfirm = storedAfterConfirm.nodes.filter(function (n) { return n.id === 'n5'; })[0].params.mix;
    check(
      mixAfterConfirm === 50,
      '(d) confirmed Undo restored the agent\'s prior stored content (mix 50)'
    );

    // Toast-dismissed variant: entry survives, store keeps human content.
    var part2 = await run(false);
    dismissAllToasts(part2.env);
    var direct = part2.sandbox.AgentUI.undo();
    check(
      direct === null && part2.sandbox.AgentUI.canUndo() === true,
      '(d) with the toast gone, undo() refuses without consuming'
    );
    var storedFinal = part2.sandbox.PresetStore.load('Stage');
    var mixFinal = storedFinal.nodes.filter(function (n) { return n.id === 'n5'; })[0].params.mix;
    check(mixFinal === 40, '(d) the human\'s stored content survives the unconfirmed attempt');
  }
  await presetOverwriteCase();

  // (e) preset deletion by the human Delete handler --------------------
  async function presetDeletionCase() {
    var caseLabel = '(e) preset deletion';
    var run = async function () {
      var env = createEnv();
      var sandbox = env.sandbox;
      var variant = cloneNodes(sandbox.DEFAULT_PRESET.nodes);
      variant.forEach(function (entry) {
        if (entry.id === 'n5') {
          entry.params.mix = 50;
        }
      });
      sandbox.PresetStore.save('Del Target', variant); // test seeding
      await seedDefault(env);
      await settle();
      await agentSetParamMix40(env);
      await settle();
      var saved = await getTool(env, 'save_preset').execute({ name: 'Del Target' });
      check(
        !!saved && saved.applied === true && saved.overwrote === true,
        caseLabel + ' seed: agent save_preset overwrote "Del Target"'
      );

      // The HUMAN deletes the preset through the real Delete handler.
      sandbox.PresetsUI.refreshPresetSelect('Del Target');
      env.byId['preset-select'].children.forEach(function (opt) {
        opt.selected = opt.value === 'Del Target';
      });
      env.confirmResponse = true;
      // R2-3: two-step Delete — arm, then confirm. No browser confirm().
      env.byId['delete-preset-btn'].__fire('click');
      env.byId['delete-preset-btn'].__fire('click');
      return { env: env, sandbox: sandbox };
    };

    var part1 = await run();
    check(
      part1.sandbox.PresetStore.listNames().indexOf('Del Target') === -1,
      '(e) human delete: the preset is GONE from the store'
    );
    var toast = newestToast(part1.env);
    var btn = undoButton(toast);
    part1.env.domEvents.length = 0;
    btn.__fire('click'); // first press — must not silently resurrect
    check(
      eventsOfType(part1.env, 'agentui:undo').length === 0 &&
        eventsOfType(part1.env, 'agentui:undo-conflict').length === 1,
      '(e) first Undo press surfaced the conflict, applied nothing'
    );
    check(
      part1.sandbox.PresetStore.listNames().indexOf('Del Target') === -1,
      '(e) without confirmation the store stays without "Del Target"'
    );
    var confirmBtn = undoButton(newestToast(part1.env));
    check(
      !!confirmBtn && confirmBtn.textContent === 'Undo anyway',
      '(e) the preset toast shows the confirm affordance'
    );
    if (confirmBtn) {
      confirmBtn.__fire('click');
    }
    var restored = part1.sandbox.PresetStore.load('Del Target');
    var restoredMix = restored
      ? restored.nodes.filter(function (n) { return n.id === 'n5'; })[0].params.mix
      : null;
    check(
      part1.sandbox.PresetStore.listNames().indexOf('Del Target') !== -1 &&
        restoredMix === 50,
      '(e) confirmed Undo re-saved the agent\'s prior content (preset back, mix 50)'
    );

    var part2 = await run();
    dismissAllToasts(part2.env);
    var direct = part2.sandbox.AgentUI.undo();
    check(
      direct === null && part2.sandbox.AgentUI.canUndo() === true,
      '(e) with the toast gone, undo() refuses without consuming'
    );
    check(
      part2.sandbox.PresetStore.listNames().indexOf('Del Target') === -1,
      '(e) the human deletion survives the unconfirmed attempt'
    );
  }
  await presetDeletionCase();

  // --------------------------------------------------------------------
  console.log('R1. regression: NO human edit -> Undo auto-applies as today');
  // --------------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;
    await seedDefault(env);
    await settle();
    await agentSetParamMix40(env);
    await settle();

    var toast = newestToast(env);
    var btn = undoButton(toast);
    env.domEvents.length = 0;
    btn.__fire('click'); // ONE press, no conflict
    await settle();
    check(
      eventsOfType(env, 'agentui:undo').length === 1 &&
        eventsOfType(env, 'agentui:undo-conflict').length === 0,
      'R1: a single press applied the undo (no conflict surfaced)'
    );
    check(
      sandbox.AgentUI.canUndo() === false &&
        paramOf(env, 'n5', 'mix') === 20 &&
        deepEqual(modelOf(env), sandbox.DEFAULT_PRESET.nodes),
      'R1: model restored exactly, stack empty — today\'s behavior unchanged'
    );
    check(
      (toast.getAttribute('data-conflict') || null) === null,
      'R1: no conflict markup was ever added to the toast'
    );
  }

  // --------------------------------------------------------------------
  console.log('R2. regression: pure-AGENT sequence still auto-undoes');
  // --------------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;
    await seedDefault(env);
    await settle();
    var r1 = await agentSetParamMix40(env);
    var r2 = await getTool(env, 'set_param').execute({ nodeId: 'n5', param: 'mix', value: 60 });
    check(
      !!r1 && r1.applied === true && !!r2 && r2.applied === true,
      'R2: two agent set_param calls both applied'
    );
    await settle();
    check(
      sandbox.AgentUI.hasUndoConflict() === false,
      'R2: agent mutations do NOT bump the revision (newest entry not conflicted)'
    );

    var btn = undoButton(newestToast(env));
    env.domEvents.length = 0;
    btn.__fire('click'); // undo of the SECOND (later) agent entry
    await settle();
    check(
      eventsOfType(env, 'agentui:undo-conflict').length === 0 &&
        eventsOfType(env, 'agentui:undo').length === 1 &&
        paramOf(env, 'n5', 'mix') === 40,
      'R2: undo of the LATER agent entry auto-applied (restored the mid-sequence state, mix 40)'
    );
    // Today's post-undo toast invariant leaves no button on the older
    // toast, so the second undo goes through the module API — the same
    // restore path the button runs.
    sandbox.AgentUI.undo();
    await settle();
    check(
      eventsOfType(env, 'agentui:undo').length === 2 &&
        paramOf(env, 'n5', 'mix') === 20 &&
        sandbox.AgentUI.canUndo() === false,
      'R2: undo of the EARLIER agent entry also auto-applied (mix 20, stack empty)'
    );
  }

  // --------------------------------------------------------------------
  console.log('R3. beyond-toast recovery: Cmd/Ctrl+Z after the toasts die');
  // --------------------------------------------------------------------
  {
    // Non-conflicted: the keyboard path finds the latest entry.
    var env = createEnv();
    var sandbox = env.sandbox;
    await seedDefault(env);
    await settle();
    await agentSetParamMix40(env);
    await settle();
    dismissAllToasts(env);
    check(liveToasts(env).length === 0, 'R3a: every toast is gone');
    var prevented = fireKeyboardUndo(env);
    await settle();
    check(
      prevented === true &&
        paramOf(env, 'n5', 'mix') === 20 &&
        sandbox.AgentUI.canUndo() === false,
      'R3a: Cmd/Ctrl+Z STILL recovered the undo beyond the toast lifetime (non-conflicted)'
    );
  }
  {
    // Conflicted: the keyboard path refuses (confirm lives on the toast).
    var env = createEnv();
    var sandbox = env.sandbox;
    await seedDefault(env);
    await settle();
    await agentSetParamMix40(env);
    await settle();
    humanSliderGlobal(env);
    await settle();
    dismissAllToasts(env);
    var prevented = fireKeyboardUndo(env);
    await settle();
    var recoveryToast = newestToast(env);
    var recoveryBtn = undoButton(recoveryToast);
    check(
      prevented === false &&
        paramOf(env, 'n5', 'mix') === 80 &&
        sandbox.AgentUI.canUndo() === true &&
        !!recoveryToast &&
        recoveryToast.querySelector('.agent-toast-conflict') !== null &&
        !!recoveryBtn &&
        recoveryBtn.textContent === 'Undo anyway',
      'R3b: Cmd/Ctrl+Z REFUSED the conflicted entry and recreated its confirm affordance'
    );
  }

  // --------------------------------------------------------------------
  console.log('R4. failed confirmed restore requires a fresh confirmation');
  // --------------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;
    var restoreAttempts = 0;
    var shouldFail = true;
    var operatorState = 'agent result';

    sandbox.AgentUI.pushUndo({
      label: 'test conflicted restore',
      restore: function () {
        restoreAttempts += 1;
        if (shouldFail) {
          throw new Error('injected restore failure');
        }
        operatorState = 'restored snapshot';
      }
    });
    sandbox.AgentUI.reportMutation({
      source: 'agent',
      summary: 'Agent applied test conflicted restore'
    });

    operatorState = 'human edit one';
    sandbox.AgentUI.noteHumanEdit();
    var btn = undoButton(newestToast(env));
    btn.__fire('click'); // surface the conflict
    btn.__fire('click'); // confirm, but restore throws

    var retainedToast = newestToast(env);
    var retryBtn = undoButton(retainedToast);
    check(
      restoreAttempts === 1 &&
        operatorState === 'human edit one' &&
        sandbox.AgentUI.canUndo() === true,
      'R4a: the failed confirmed restore left human state intact and retained the entry'
    );
    check(
      !!retryBtn &&
        retryBtn.textContent === 'Undo' &&
        retryBtn.getAttribute('data-confirm-undo') !== 'true' &&
        retainedToast.querySelector('.agent-toast-undo-failed') !== null,
      'R4a: restore failure resets the stale confirmation token and leaves an explicit retry'
    );

    shouldFail = false;
    operatorState = 'human edit two';
    sandbox.AgentUI.noteHumanEdit();
    retryBtn.__fire('click'); // must only ask again, not restore
    check(
      restoreAttempts === 1 &&
        operatorState === 'human edit two' &&
        sandbox.AgentUI.canUndo() === true &&
        retryBtn.textContent === 'Undo anyway' &&
        retryBtn.getAttribute('data-confirm-undo') === 'true',
      'R4b: after another human edit, the first retry only asks for fresh confirmation'
    );

    retryBtn.__fire('click'); // fresh explicit confirmation
    check(
      restoreAttempts === 2 &&
        operatorState === 'restored snapshot' &&
        sandbox.AgentUI.canUndo() === false &&
        retainedToast.getAttribute('data-undone') === 'true',
      'R4c: the second retry confirmation restores and consumes the retained entry'
    );
  }

  // --------------------------------------------------------------------
  console.log('R5. a keyboard restore failure recreates visible recovery UI');
  // --------------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;
    var restoreAttempts = 0;
    var shouldFail = true;

    sandbox.AgentUI.pushUndo({
      label: 'test expired toast restore',
      restore: function () {
        restoreAttempts += 1;
        if (shouldFail) {
          throw new Error('injected keyboard restore failure');
        }
      }
    });
    sandbox.AgentUI.reportMutation({
      source: 'agent',
      summary: 'Agent applied test expired toast restore'
    });
    dismissAllToasts(env);

    var prevented = fireKeyboardUndo(env);
    var recoveryToast = newestToast(env);
    var recoveryBtn = undoButton(recoveryToast);
    check(
      prevented === true &&
        restoreAttempts === 1 &&
        sandbox.AgentUI.canUndo() === true &&
        !!recoveryToast &&
        recoveryToast.querySelector('.agent-toast-undo-failed') !== null &&
        !!recoveryBtn,
      'R5a: failed Cmd/Ctrl+Z recreates a visible failure toast with a retry button'
    );

    shouldFail = false;
    if (recoveryBtn) {
      recoveryBtn.__fire('click');
    }
    check(
      restoreAttempts === 2 &&
        sandbox.AgentUI.canUndo() === false &&
        !!recoveryToast &&
        recoveryToast.getAttribute('data-undone') === 'true' &&
        recoveryToast.querySelector('.agent-toast-undo-failed') === null,
      'R5b: retry from the recovery toast succeeds and clears its failure state'
    );
  }

  // --------------------------------------------------------------------
  console.log('R6. retry stays associated with its mutation toast');
  // --------------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;
    var shouldFail = true;

    sandbox.AgentUI.pushUndo({
      label: 'test associated restore',
      restore: function () {
        if (shouldFail) {
          throw new Error('injected associated restore failure');
        }
      }
    });
    sandbox.AgentUI.reportMutation({
      source: 'agent',
      summary: 'Agent applied test associated restore'
    });
    var mutationToast = newestToast(env);
    sandbox.AgentUI.undo();

    sandbox.AgentUI.reportMutation({
      source: 'agent',
      summary: 'Agent request refused: unrelated test request',
      rejected: true,
      errorText: 'Unrelated refusal'
    });
    var refusalToast = newestToast(env);
    var associatedRetry = undoButton(mutationToast);
    check(
      refusalToast !== mutationToast &&
        !!associatedRetry &&
        undoButton(refusalToast) === null,
      'R6a: an intervening refusal does not steal the retained entry retry button'
    );

    shouldFail = false;
    if (associatedRetry) {
      associatedRetry.__fire('click');
    }
    check(
      mutationToast.getAttribute('data-undone') === 'true' &&
        mutationToast.querySelector('.agent-toast-undone') !== null &&
        refusalToast.getAttribute('data-undone') !== 'true' &&
        refusalToast.querySelector('.agent-toast-undone') === null,
      'R6b: retry success updates only the associated mutation toast, never the refusal'
    );
  }

  if (failures.length === 0) {
    console.log(
      'PASS: stale agent Undo never overwrites later human edits without an explicit confirm (issue #6)'
    );
    return 0;
  }
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (label) {
    console.log('  - ' + label);
  });
  return 1;
}

// R3b reuses the slider edit; keep a module-level twin of the closure.
function humanSliderGlobal(env) {
  var card = cardFor(env, 'n5');
  var input = findIn(card, function (el) {
    return el.id === 'param-n5-mix';
  });
  input.value = '80';
  input.__fire('input');
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
