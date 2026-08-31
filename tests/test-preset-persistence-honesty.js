// Test for issue #8 — [P1] save_preset / Save As must report preset
// persistence failures truthfully.
//
// The bug: PresetStore.writeStore()/save() caught localStorage failures
// with only a console.error, so BOTH save paths (the human "Save As…"
// button in src/presets-ui.js and the agent save_preset tool in
// src/mcp-tools.js) continued as if the write had succeeded — selector
// updated, current preset renamed, unsaved dot cleared, undo entry
// pushed, `applied: true` returned — while the named preset never
// existed in storage. A live fault test of setItem() throwing produced
// exactly that phantom success.
//
// Every fault below is injected at the STUB localStorage boundary of a
// fresh vm sandbox that loads the REAL src files (same committed-test
// convention as the other suites: zero dependencies, browser globals
// stubbed, real source run in vm, "  ok - " per check, exit 0/1):
//
//   src/audio-graph.js + node-types.js + the six node files
//                            (the registry, exactly as index.html loads it)
//   src/default-preset.js    (the seeded default chain)
//   src/preset-schema.js     (serialization/validation)
//   src/preset-store.js      (the storage layer under test)
//   src/presets-ui.js        (the REAL human Save As/Delete handlers,
//                             wired to a stubbed #preset-* panel DOM)
//   src/mcp-tools.js         (the REAL save_preset tool)
//
// Mandated fault cases (per case: MCP save_preset -> applied:false +
// PRESET_SAVE_FAILED, no undo push, selector/current-preset/unsaved-dot
// unchanged, store content unchanged, and the HUMAN Save As path shows
// the quiet .preset-note failure line):
//   (a) quota exhaustion ........ setItem throws QuotaExceededError
//   (b) SecurityError ........... setItem throws SecurityError
//   (c) storage unavailable ..... the `localStorage` global itself is a
//                                 getter that THROWS (browser-denied
//                                 access), plus the undefined variant
//   (d) serialization failure ... the store DOES serialize caller-
//         controlled content legitimately — PresetSchema.serialize()
//         copies each node's `params` with Object.assign, which copies
//         own enumerable extras too, so a model whose params carry a
//         throwing toJSON() poisons writeStore()'s JSON.stringify(). No
//         stub-boundary hack needed for this one.
//   (e) overwrite failure ....... setItem throws ONLY when the store key
//                                 already exists (re-saving an existing
//                                 preset name)
//   (f) silent drop ............. setItem "succeeds" but persists
//         nothing — caught by writeStore()'s READ-BACK verification
//         (getItem + compare), reported as failure, not success.
//
// Plus the happy path (no fault): success behavior identical to today —
// selector updated + selected, current preset shown, unsaved dot
// cleared, exactly one undo entry pushed (whose restore() still works),
// success toast, preset really in storage. And the delete path: a
// failed remove() keeps the preset listed (reconciled from the store).
//
// Run from a clean clone:  node tests/test-preset-persistence-honesty.js
// (or via the runner:      node tests/run.js preset-persistence)
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var STORAGE_KEY = 'karaoke-presets-v1';

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

function namedError(name, message) {
  var err = new Error(message);
  err.name = name;
  return err;
}

// ----------------------------------------------------------------------
// DOM element stub — enough for the REAL src/presets-ui.js: addEventListener
// + __fire (button clicks), style, textContent, appendChild, and an
// innerHTML setter that clears children (refreshPresetSelect rebuilds
// the <option> list through it). `value` is an accessor: options store
// theirs; a select computes its value from the selected option, which is
// what the Load/Delete handlers read.
// ----------------------------------------------------------------------
function makeElement(tag) {
  var el = {
    tagName: tag,
    id: '',
    className: '',
    type: '',
    textContent: '',
    label: '',
    selected: false,
    parentNode: null,
    children: [],
    style: {},
    __listeners: {},
    __attrs: {},
    __value: '',
    appendChild: function (child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    insertBefore: function (child, ref) {
      child.parentNode = el;
      var index = el.children.indexOf(ref);
      if (index === -1) {
        el.children.push(child);
      } else {
        el.children.splice(index, 0, child);
      }
      return child;
    },
    removeChild: function (child) {
      var index = el.children.indexOf(child);
      if (index !== -1) {
        el.children.splice(index, 1);
      }
      child.parentNode = null;
      return child;
    },
    setAttribute: function (name, value) {
      el.__attrs[name] = String(value);
    },
    getAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(el.__attrs, name)
        ? el.__attrs[name]
        : null;
    },
    remove: function () {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    },
    querySelector: function (selector) {
      var className = selector.charAt(0) === '.' ? selector.slice(1) : null;
      for (var i = 0; i < el.children.length; i++) {
        var child = el.children[i];
        if (className && String(child.className).split(/\s+/).indexOf(className) !== -1) {
          return child;
        }
        var nested = child.querySelector(selector);
        if (nested) {
          return nested;
        }
      }
      return null;
    }
  };
  el.addEventListener = function (type, fn) {
    (el.__listeners[type] = el.__listeners[type] || []).push(fn);
  };
  el.__fire = function (type, ev) {
    var event = ev || { preventDefault: function () {}, stopPropagation: function () {} };
    (el.__listeners[type] || []).forEach(function (fn) {
      fn(event);
    });
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
  Object.defineProperty(el, 'firstChild', {
    configurable: true,
    get: function () {
      return el.children.length > 0 ? el.children[0] : null;
    }
  });
  return el;
}

// Depth-first id search over an element's subtree — lets
// document.getElementById find the elements src/presets-ui.js creates
// dynamically (the R2-3 inline naming row's input/buttons).
function findByIdIn(node, id) {
  if (node.id === id) {
    return node;
  }
  for (var i = 0; i < node.children.length; i++) {
    var hit = findByIdIn(node.children[i], id);
    if (hit) {
      return hit;
    }
  }
  return null;
}

// ----------------------------------------------------------------------
// The fault-injectable localStorage stub. All faults are knobs on
// `stub.fault`, armed by each test case AFTER the env is built and
// seeded with a healthy write.
// ----------------------------------------------------------------------
function createStorageStub() {
  var box = {};
  var stub = {
    __box: box,
    __setItemCalls: 0,
    fault: {
      setItemError: null,            // thrown from EVERY setItem
      setItemErrorIfKeyPresent: null,// thrown only when the key is already stored (overwrite)
      silentDrop: false,             // setItem "succeeds" but persists nothing
      getItemError: null             // thrown from getItem (read-back failure)
    }
  };
  stub.getItem = function (key) {
    if (stub.fault.getItemError) {
      throw stub.fault.getItemError;
    }
    return Object.prototype.hasOwnProperty.call(box, key) ? box[key] : null;
  };
  stub.setItem = function (key, value) {
    stub.__setItemCalls += 1;
    if (stub.fault.setItemErrorIfKeyPresent &&
        Object.prototype.hasOwnProperty.call(box, key)) {
      throw stub.fault.setItemErrorIfKeyPresent;
    }
    if (stub.fault.setItemError) {
      throw stub.fault.setItemError;
    }
    if (stub.fault.silentDrop) {
      return; // records nothing — exactly the silent drop the read-back must catch
    }
    box[key] = String(value);
  };
  stub.removeItem = function (key) {
    delete box[key];
  };
  return stub;
}

// ----------------------------------------------------------------------
// The preset panel DOM (#save-preset-btn/#preset-select/#load-preset-btn/
// #delete-preset-btn/#current-preset-name/#unsaved-indicator), with the
// same initial display states index.html ships: "Unsaved chain" text and
// a hidden unsaved dot. The <select> lives in a container so the lazily
// created .preset-note line has a parent to anchor to.
// ----------------------------------------------------------------------
function buildPanel() {
  var container = makeElement('div');
  var select = makeElement('select');
  container.appendChild(select);
  var current = makeElement('span');
  current.textContent = 'Unsaved chain';
  var dot = makeElement('span');
  dot.style.display = 'none';
  var byId = {
    'save-preset-btn': makeElement('button'),
    'current-preset-name': current,
    'unsaved-indicator': dot,
    'preset-select': select,
    'load-preset-btn': makeElement('button'),
    'delete-preset-btn': makeElement('button')
  };
  return { container: container, byId: byId };
}

// ----------------------------------------------------------------------
// The sandbox: a vm context whose global IS `window` (host timers, a
// quiet console that still RECORDS console.error, the panel DOM, the
// localStorage stub, prompt/confirm/alert recorders, a not-started
// engine, and the never-settling fetch src/node-reverb.js tolerates).
// window.AgentUI is a recorder (undo pushes + mutation toasts), so the
// "no undo entry / no success toast" checks observe the real calls
// mcp-tools makes.
// ----------------------------------------------------------------------
function createEnv(options) {
  options = options || {};
  var storage = createStorageStub();
  var panel = buildPanel();
  var body = makeElement('body');
  var domListeners = {};
  var env = {
    storage: storage,
    panel: panel,
    body: body,
    promptCalls: [],
    promptResponse: '',
    confirmResponse: true,
    confirmCalls: 0,
    alertCalls: 0,
    consoleErrors: 0,
    domEvents: []
  };
  var sandbox = {
    console: {
      log: function () {},
      warn: function () {},
      error: function () {
        env.consoleErrors += 1;
      }
    },
    setTimeout: function (fn, ms) {
      var timer = setTimeout(fn, ms);
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }
      return timer;
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
      getElementById: function (id) {
        return panel.byId[id] || findByIdIn(panel.container, id) || null;
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
      dispatchEvent: function (event) {
        env.domEvents.push({ type: event.type, detail: event.detail });
        (domListeners[event.type] || []).forEach(function (fn) {
          fn(event);
        });
        return true;
      },
      activeElement: null,
      body: body
    },
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
    // src/node-reverb.js fetches its IR at module load; a never-settling
    // promise is the tolerated not-fetched-yet state (no live reverb is
    // ever built here — the engine stub reports not-started).
    fetch: function () {
      return new Promise(function () {});
    },
    prompt: function (message, suggestion) {
      env.promptCalls.push({ message: message, suggestion: suggestion });
      return env.promptResponse;
    },
    confirm: function () {
      env.confirmCalls += 1; // R2-3: must stay 0 — Delete is two-step in-panel
      return env.confirmResponse;
    },
    // P3-5: must stay 0 everywhere — the Load defensive guards ride the
    // quiet .preset-note line since refinement entry 5; a recorded call
    // means a browser dialog crept back into the panel.
    alert: function () {
      env.alertCalls += 1;
    },
    localStorage: storage
  };
  sandbox.window = sandbox;
  sandbox.AudioEngine = { isStarted: false };
  vm.createContext(sandbox);
  env.sandbox = sandbox;

  var sourceFiles = [
    'src/audio-graph.js',
    'src/node-types.js',
    'src/audio-param-ramp.js', // issue #5: the ramp helper the node applyParam handlers call
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
    'src/mcp-tools.js'
  ];
  if (options.realAgentUi) {
    sourceFiles.unshift('src/agent-ui.js');
  }
  sourceFiles.forEach(function (relPath) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
      filename: relPath
    });
  });

  // ChainCanvas stub: the read surface save_preset uses (fresh copies of
  // a settable model; isDragActive idle). setModel() lets the
  // serialization-failure case hand the tool a poisoned chain.
  var canvasModel = [];
  env.installModel = function (model) {
    canvasModel = model.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
  };
  sandbox.ChainCanvas = {
    getCurrentModel: function () {
      return canvasModel.map(function (entry) {
        return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
      });
    },
    isDragActive: function () {
      return false;
    },
    loadModel: function (model) {
      env.installModel(model);
    }
  };

  // AgentUI recorder: most storage cases need only the call seam. The
  // transactional undo cases load the real module, then wrap its public
  // methods so the same observations remain available.
  env.agentUi = { undoPushes: [], mutations: [] };
  if (options.realAgentUi) {
    var realPushUndo = sandbox.AgentUI.pushUndo;
    var realReportMutation = sandbox.AgentUI.reportMutation;
    sandbox.AgentUI.pushUndo = function (entry) {
      env.agentUi.undoPushes.push(entry);
      return realPushUndo(entry);
    };
    sandbox.AgentUI.reportMutation = function (detail) {
      env.agentUi.mutations.push(detail);
      return realReportMutation(detail);
    };
  } else {
    sandbox.AgentUI = {
      pushUndo: function (entry) {
        env.agentUi.undoPushes.push(entry);
        return true;
      },
      canUndo: function () {
        return env.agentUi.undoPushes.length > 0;
      },
      reportMutation: function (detail) {
        env.agentUi.mutations.push(detail);
      },
      undo: function () {
        var entry = env.agentUi.undoPushes.pop() || null;
        if (entry && typeof entry.restore === 'function') {
          entry.restore();
        }
        return entry;
      }
    };
  }

  return env;
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
// State observation helpers — every "unchanged" check compares a full
// before/after snapshot of exactly the things a phantom success would
// have touched.
// ----------------------------------------------------------------------
function optionValues(env) {
  return env.panel.byId['preset-select'].children.map(function (opt) {
    return opt.value;
  });
}

function snapshot(env) {
  var box = env.storage.__box;
  return {
    raw: Object.prototype.hasOwnProperty.call(box, STORAGE_KEY) ? box[STORAGE_KEY] : null,
    options: optionValues(env).join('|'),
    current: env.panel.byId['current-preset-name'].textContent,
    dotVisible: env.panel.byId['unsaved-indicator'].style.display !== 'none',
    undoPushes: env.agentUi.undoPushes.length,
    mutations: env.agentUi.mutations.length
  };
}

function storedNames(env) {
  var raw = env.storage.__box[STORAGE_KEY];
  if (!raw) {
    return [];
  }
  try {
    return Object.keys(JSON.parse(raw));
  } catch (err) {
    return ['<unparsable>'];
  }
}

function noteElement(env) {
  var kids = env.panel.container.children;
  for (var i = 0; i < kids.length; i++) {
    if (kids[i].className === 'preset-note') {
      return kids[i];
    }
  }
  return null;
}

// ----------------------------------------------------------------------
// Build a fresh env, seed it HEALTHILY (a real 'Baseline' preset + the
// live default chain as the current model), mark the chain modified
// (unsaved dot visible — the exact state a phantom save would wrongly
// clear), and leave it armed for the case to fault-inject.
// ----------------------------------------------------------------------
function freshSeededEnv(options) {
  var env = createEnv(options);
  var sandbox = env.sandbox;
  var seeded = sandbox.PresetStore.save('Baseline', sandbox.DEFAULT_PRESET.nodes);
  check(
    !!seeded && seeded.ok === true && seeded.overwrote === false,
    'seed: PresetStore.save("Baseline") returns the structured success {ok:true, overwrote:false}'
  );
  env.installModel(sandbox.DEFAULT_PRESET.nodes);
  sandbox.PresetsUI.refreshPresetSelect('Baseline');
  sandbox.PresetsUI.markModified(); // unsaved dot visible, as a dirty chain is
  return env;
}

// Arm the "localStorage global itself is broken" variants: the page-level
// getter throws (or resolves undefined). configurable so later cases can
// re-arm on their own env.
function breakLocalStorageGlobal(sandbox, mode) {
  Object.defineProperty(sandbox, 'localStorage', {
    configurable: true,
    get: function () {
      if (mode === 'throw') {
        throw namedError('SecurityError', 'Access to localStorage is denied for this document');
      }
      return undefined;
    }
  });
}

// ----------------------------------------------------------------------
// The mandated per-case fault assertions: MCP save_preset honesty, then
// the human Save As path honesty, against one env. `isOverwrite` marks
// the case where the failing save targeted an EXISTING preset name —
// there the name legitimately remains listed/stored (the point is that
// the OLD content survives untouched), so the "not listed" assertions
// apply to fresh-name cases only.
// ----------------------------------------------------------------------
function assertMcpFailure(env, caseLabel, name, isOverwrite) {
  var sandbox = env.sandbox;
  var before = snapshot(env);

  var res = getTool(sandbox, 'save_preset').execute({ name: name });
  return res.then(function (r) {
    var after = snapshot(env);
    var prefix = caseLabel + ' MCP:';

    check(
      !!r && r.error === true && r.code === 'PRESET_SAVE_FAILED' && r.tool === 'save_preset',
      prefix + ' save_preset resolves the stable PRESET_SAVE_FAILED refusal'
    );
    check(
      !!r && r.applied === false,
      prefix + ' applied is FALSE (never the phantom applied:true)'
    );
    check(
      !!r && typeof r.reason === 'string' &&
        r.reason.indexOf('PRESET_SAVE_FAILED') !== -1 &&
        r.reason.indexOf(name) !== -1 &&
        typeof r.suggestion === 'string' && r.suggestion.length > 0,
      prefix + ' the refusal carries a reason naming the preset and a suggestion'
    );
    check(
      after.undoPushes === before.undoPushes,
      prefix + ' NO undo entry was pushed for the failed write'
    );
    check(
      after.options === before.options &&
        (isOverwrite || optionValues(env).indexOf(name) === -1),
      prefix + ' the preset selector is unchanged' +
        (isOverwrite ? ' (the existing entry untouched)' : ' and the preset is NOT listed')
    );
    check(
      after.current === before.current && before.current !== name,
      prefix + ' the displayed current preset is unchanged (still "' + before.current + '")'
    );
    check(
      after.dotVisible === true,
      prefix + ' the unsaved indicator is STILL SHOWN (modified state preserved)'
    );
    check(
      after.raw === before.raw && (isOverwrite || storedNames(env).indexOf(name) === -1),
      prefix + ' stored content is byte-identical' +
        (isOverwrite ? ' (the old content preserved)' : ' and the preset does not exist in storage')
    );
    check(
      env.agentUi.mutations.length === before.mutations + 1 &&
        env.agentUi.mutations[env.agentUi.mutations.length - 1].rejected === true &&
        String(env.agentUi.mutations[env.agentUi.mutations.length - 1].summary)
          .indexOf('PRESET_SAVE_FAILED') !== -1,
      prefix + ' the operator toast is the REFUSAL toast (rejected:true), not a success toast'
    );
    return { before: before, after: after };
  });
}

function prefix0(caseLabel) {
  return caseLabel + ' human:';
}

function assertHumanSaveAsFailure(env, caseLabel, name, isOverwrite) {
  var sandbox = env.sandbox;
  var before = snapshot(env);

  // R2-3: drive the real Save As handler through the INLINE naming row —
  // Save As… opens it, the name goes into #preset-name-input, the row's
  // Save button commits. No prompt() anywhere.
  env.panel.byId['save-preset-btn'].__fire('click');
  var input = env.sandbox.document.getElementById('preset-name-input');
  check(!!input, prefix0(caseLabel) + ' the inline naming row opened (input present)');
  input.value = name;
  env.sandbox.document.getElementById('preset-name-confirm').__fire('click');
  var after = snapshot(env);
  var note = noteElement(env);
  var prefix = caseLabel + ' human:';

  check(
    env.promptCalls.length === 0,
    prefix + ' window.prompt was NEVER called (R2-3: naming is in-panel)'
  );
  check(
    !!note && note.style.display !== 'none' &&
      note.textContent.indexOf('Could not save') !== -1 &&
      note.textContent.indexOf(name) !== -1,
    prefix + ' the quiet .preset-note failure line is shown ("Could not save …")'
  );
  check(
    after.options === before.options && (isOverwrite || optionValues(env).indexOf(name) === -1),
    prefix + ' the dropdown was NOT updated with the phantom save'
  );
  check(
    after.current === before.current,
    prefix + ' the current-preset display was NOT renamed'
  );
  check(
    after.dotVisible === true,
    prefix + ' the unsaved dot was NOT cleared'
  );
  check(
    after.raw === before.raw && (isOverwrite || storedNames(env).indexOf(name) === -1),
    prefix + ' nothing was persisted'
  );
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  // ------------------------------------------------------------------
  console.log('A. store-level contract: typed StorageError, verified writes');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    var sandbox = env.sandbox;
    var SE = sandbox.PresetStore.StorageError;
    check(typeof SE === 'function', 'A1: PresetStore.StorageError is exported (the typed error)');

    env.storage.fault.setItemError = namedError('QuotaExceededError', 'The quota has been exceeded.');
    var thrown = null;
    try {
      sandbox.PresetStore.save('Never Lands', sandbox.DEFAULT_PRESET.nodes);
    } catch (err) {
      thrown = err;
    }
    check(!!thrown, 'A1: save() THROWS on a failed write instead of returning undefined');
    check(
      !!thrown && thrown.name === 'PresetStore.StorageError' &&
        (!!SE && thrown instanceof SE) &&
        thrown.operation === 'write' &&
        !!thrown.cause && thrown.cause.name === 'QuotaExceededError' &&
        thrown.message.indexOf('quota has been exceeded') !== -1,
      'A1: the throw is the typed StorageError (operation "write", cause carried, message honest)'
    );

    var removed = null;
    try {
      removed = sandbox.PresetStore.remove('Baseline');
    } catch (err) {
      removed = err;
    }
    // NOTE: no host `instanceof Error` — the error was minted inside the
    // vm context, whose intrinsics are a different realm's; the typed
    // error's own name + the exported class are the reliable identity.
    check(
      !!removed && removed.name === 'PresetStore.StorageError' &&
        (!!SE && removed instanceof SE) && removed.operation === 'write',
      'A1: remove() THROWS the typed StorageError on a failed delete (the preset is still stored)'
    );
    check(
      storedNames(env).indexOf('Baseline') !== -1,
      'A1: the failed delete left "Baseline" in storage'
    );

    env.storage.fault.setItemError = null;
    var gone = sandbox.PresetStore.remove('Baseline');
    var absent = sandbox.PresetStore.remove('Nothing Stored');
    check(
      !!gone && gone.ok === true && gone.removed === true &&
        !!absent && absent.ok === true && absent.removed === false &&
        storedNames(env).indexOf('Baseline') === -1,
      'A1: healthy remove returns {ok:true, removed:true}; a missing name is {ok:true, removed:false}'
    );

    // Silent drop: setItem succeeds but persists nothing — the read-back
    // must turn that into a failure too ("verify stored content before
    // reporting success").
    env.storage.fault.silentDrop = true;
    var dropped = null;
    try {
      sandbox.PresetStore.save('Ghost', sandbox.DEFAULT_PRESET.nodes);
    } catch (err) {
      dropped = err;
    }
    check(
      !!dropped && dropped.name === 'PresetStore.StorageError' && dropped.operation === 'verify',
      'A1: a SILENTLY DROPPED write fails the read-back verification (operation "verify")'
    );

    // listNames never throws, even on a broken store — and since issue
    // #11 it is a PURE READ: a corrupt store degrades to [] with zero
    // writes (the PS-3-era seeding was removed; fresh-profile listing
    // is the factory library's job, src/factory-presets.js).
    env.storage.__box[STORAGE_KEY] = 'not json at all';
    var setItemBefore = env.storage.__setItemCalls;
    var listed = null;
    try {
      listed = sandbox.PresetStore.listNames();
    } catch (err) {
      listed = err;
    }
    check(
      Array.isArray(listed) && listed.length === 0,
      'A1: listNames() still never throws on a broken store (issue #11: pure read, corrupt -> [])'
    );
    check(
      env.storage.__setItemCalls === setItemBefore,
      'A1: listNames() performed ZERO storage writes on the broken store (issue #11 purity)'
    );
  }

  // ------------------------------------------------------------------
  console.log('B. (a) quota exhaustion — setItem throws QuotaExceededError');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    env.storage.fault.setItemError = namedError('QuotaExceededError', 'The quota has been exceeded.');
    var seq = await assertMcpFailure(env, 'B quota', 'Quota Full');
    check(seq !== undefined, 'B: MCP fault case completed');
    assertHumanSaveAsFailure(env, 'B quota', 'Quota Full');
  }

  // ------------------------------------------------------------------
  console.log('C. (b) SecurityError — setItem throws SecurityError');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    env.storage.fault.setItemError = namedError('SecurityError', 'The operation is insecure.');
    var seq = await assertMcpFailure(env, 'C security', 'Locked Down');
    check(seq !== undefined, 'C: MCP fault case completed');
    assertHumanSaveAsFailure(env, 'C security', 'Locked Down');
  }

  // ------------------------------------------------------------------
  console.log('D. (c) storage unavailable — the localStorage global itself is broken');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    breakLocalStorageGlobal(env.sandbox, 'throw');
    var seq = await assertMcpFailure(env, 'D unavailable(getter throws)', 'No Storage');
    check(seq !== undefined, 'D: MCP fault case completed');
    assertHumanSaveAsFailure(env, 'D unavailable(getter throws)', 'No Storage');
  }
  {
    var env = freshSeededEnv();
    breakLocalStorageGlobal(env.sandbox, 'undefined');
    var res = await getTool(env.sandbox, 'save_preset').execute({ name: 'Ghost Storage' });
    check(
      !!res && res.error === true && res.code === 'PRESET_SAVE_FAILED' && res.applied === false,
      'D unavailable(undefined): save_preset still resolves PRESET_SAVE_FAILED / applied:false'
    );
    check(
      storedNames(env).indexOf('Ghost Storage') === -1 && env.agentUi.undoPushes.length === 0,
      'D unavailable(undefined): nothing persisted, no undo entry'
    );
  }

  // ------------------------------------------------------------------
  console.log('E. (d) serialization failure — poisoned params (throwing toJSON)');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    // PresetSchema.serialize() copies `params` with Object.assign — own
    // enumerable extras ride along — so a model whose params carry a
    // throwing toJSON() legitimately poisons writeStore()'s
    // JSON.stringify(store). This is caller-controlled content reaching
    // the store's serialization, not a stub-boundary hack.
    env.installModel([
      {
        id: 'p1',
        type: 'gain',
        params: {
          gainDb: 0,
          toJSON: function () {
            throw new Error('poisoned toJSON — serialization must fail');
          }
        }
      }
    ]);
    var seq = await assertMcpFailure(env, 'E serialize', 'Poison Pill');
    check(seq !== undefined, 'E: MCP fault case completed');
    assertHumanSaveAsFailure(env, 'E serialize', 'Poison Pill');
  }

  // ------------------------------------------------------------------
  console.log('F. (e) overwrite failure — setItem throws only when the key exists');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    env.storage.fault.setItemErrorIfKeyPresent =
      namedError('QuotaExceededError', 'The quota has been exceeded (overwriting an existing store).');
    var seq = await assertMcpFailure(env, 'F overwrite', 'Baseline', true); // the EXISTING preset name
    check(seq !== undefined, 'F: MCP fault case completed');
    assertHumanSaveAsFailure(env, 'F overwrite', 'Baseline', true);
    check(
      storedNames(env).indexOf('Baseline') !== -1 &&
        JSON.parse(env.storage.__box[STORAGE_KEY])['Baseline'].nodes.length === 6,
      'F overwrite: the previously stored "Baseline" content survived the failed overwrite intact'
    );
  }

  // ------------------------------------------------------------------
  console.log('G. (f) silent drop — setItem "succeeds" but persists nothing');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    env.storage.fault.silentDrop = true;
    var seq = await assertMcpFailure(env, 'G silent-drop', 'Silent Drop');
    check(seq !== undefined, 'G: MCP fault case completed');
    assertHumanSaveAsFailure(env, 'G silent-drop', 'Silent Drop');
    check(
      env.storage.__setItemCalls > 0,
      'G: the stub really let setItem "succeed" (' + env.storage.__setItemCalls +
        ' call(s)) — only the read-back caught the drop'
    );
  }

  // ------------------------------------------------------------------
  console.log('H. happy path — success behavior identical to today (PS-3/PS-4 semantics)');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    var sandbox = env.sandbox;
    var before = snapshot(env);

    var res = await getTool(sandbox, 'save_preset').execute({ name: 'Happy Path' });
    var after = snapshot(env);

    check(
      !!res && res.applied === true && res.tool === 'save_preset' &&
        res.saved === 'Happy Path' && res.overwrote === false && res.nodeCount === 6,
      'H1: save_preset resolves the exact success shape {applied:true, saved, overwrote:false, nodeCount:6}'
    );
    check(
      optionValues(env).indexOf('Happy Path') !== -1,
      'H1: the selector now lists "Happy Path"'
    );
    var selectedOpt = null;
    env.panel.byId['preset-select'].children.forEach(function (opt) {
      if (opt.selected && opt.value === 'Happy Path') {
        selectedOpt = opt;
      }
    });
    check(!!selectedOpt, 'H1: the "Happy Path" option is the SELECTED one');
    check(
      env.panel.byId['current-preset-name'].textContent === 'Happy Path',
      'H1: the current-preset display shows "Happy Path"'
    );
    check(
      env.panel.byId['unsaved-indicator'].style.display === 'none',
      'H1: the unsaved dot is cleared'
    );
    check(
      after.undoPushes === before.undoPushes + 1,
      'H1: exactly ONE undo entry was pushed'
    );
    var toast = env.agentUi.mutations[env.agentUi.mutations.length - 1];
    check(
      !!toast && !toast.rejected && toast.summary === 'Agent saved preset "Happy Path"',
      'H1: the success toast reads \'Agent saved preset "Happy Path"\''
    );
    var stored = sandbox.PresetStore.load('Happy Path');
    check(
      !!stored && stored.name === 'Happy Path' && stored.nodes.length === 6,
      'H1: the preset REALLY exists in storage afterward (verified through load())'
    );
    check(noteElement(env) === null, 'H1: no failure note was created on success');

    // The CREATED save's undo entry: captured before H2 so we restore the
    // create entry (whose restore DELETES the preset), not the H2
    // overwrite entry (whose restore would legitimately re-save it).
    var entry = env.agentUi.undoPushes[env.agentUi.undoPushes.length - 1];
    check(
      !!entry && entry.label === 'save_preset "Happy Path"',
      'H3: the undo entry is labeled \'save_preset "Happy Path"\''
    );

    // Overwrite happy variant: same name again -> overwrote:true.
    var res2 = await getTool(sandbox, 'save_preset').execute({ name: 'Happy Path' });
    check(
      !!res2 && res2.applied === true && res2.overwrote === true,
      'H2: re-saving the same name succeeds with overwrote:true (unchanged semantics)'
    );

    entry.restore();
    check(
      storedNames(env).indexOf('Happy Path') === -1,
      'H3: undo restore() removed the created preset from storage'
    );
    check(
      env.panel.byId['current-preset-name'].textContent === 'Unsaved chain' &&
        env.panel.byId['unsaved-indicator'].style.display !== 'none',
      'H3: undo restore() put the display back (name + unsaved dot restored)'
    );
  }

  // ------------------------------------------------------------------
  console.log('I. delete path — a failed remove keeps the preset listed (truthful UI)');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    var sandbox = env.sandbox;
    env.storage.fault.setItemError = namedError('QuotaExceededError', 'The quota has been exceeded.');

    env.confirmResponse = true;
    // R2-3: two-step in-panel Delete — first click ARMS (relabel to
    // "DELETE?"), second click confirms. No confirm() anywhere.
    env.panel.byId['delete-preset-btn'].__fire('click'); // arm
    var deleteBtnEl = env.panel.byId['delete-preset-btn'];
    check(
      deleteBtnEl.textContent === 'DELETE?',
      'I1: the first Delete click ARMS the button (relabelled "DELETE?")'
    );
    env.panel.byId['delete-preset-btn'].__fire('click'); // confirm
    check(env.confirmCalls === 0, 'I1: window.confirm was NEVER called (two-step in-panel)');
    var note = noteElement(env);
    check(
      !!note && note.style.display !== 'none' &&
        note.textContent.indexOf('Could not delete') !== -1 &&
        note.textContent.indexOf('Baseline') !== -1,
      'I1: the human Delete path shows the quiet failure note ("Could not delete …")'
    );
    check(
      optionValues(env).indexOf('Baseline') !== -1,
      'I1: "Baseline" is STILL LISTED in the dropdown (reconciled from the store — no phantom vanish)'
    );
    check(
      storedNames(env).indexOf('Baseline') !== -1,
      'I1: "Baseline" is still in storage'
    );

    // Healthy delete still works end-to-end. Re-select 'Baseline' first:
    // the failed delete's refresh left the dropdown at its default
    // selection ('Classic Karaoke').
    env.storage.fault.setItemError = null;
    sandbox.PresetsUI.refreshPresetSelect('Baseline');
    env.panel.byId['delete-preset-btn'].__fire('click'); // arm
    env.panel.byId['delete-preset-btn'].__fire('click'); // confirm
    check(
      optionValues(env).indexOf('Baseline') === -1 &&
        storedNames(env).indexOf('Baseline') === -1,
      'I2: with storage healthy again, Delete really removes the preset'
    );
  }

  // ------------------------------------------------------------------
  console.log('J. R2-3 inline naming row — in-panel Save As semantics');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    var sandbox = env.sandbox;
    var doc = sandbox.document;

    // Empty name: quiet refusal, row stays open for the retry.
    env.panel.byId['save-preset-btn'].__fire('click');
    var input = doc.getElementById('preset-name-input');
    check(!!input, 'J1: Save As… opens the inline naming row (input present)');
    var row = input.parentNode;
    check(row.style.display !== 'none', 'J1: the naming row is VISIBLE while open');
    input.value = '   ';
    doc.getElementById('preset-name-confirm').__fire('click');
    var note = noteElement(env);
    check(
      !!note && note.style.display !== 'none' &&
        note.textContent.indexOf('Give the preset a name first.') !== -1,
      'J1: an empty (all-whitespace) name is refused quietly via .preset-note'
    );
    check(row.style.display !== 'none', 'J1: the row STAYS OPEN after the refusal');

    // Escape cancels cleanly — row hidden (out of the tab order).
    input.__fire('keydown', { key: 'Escape', preventDefault: function () {}, stopPropagation: function () {} });
    check(row.style.display === 'none', 'J2: Escape collapses the naming row');

    // Enter commits: same observable outcomes as the old prompt flow.
    env.panel.byId['save-preset-btn'].__fire('click');
    input = doc.getElementById('preset-name-input');
    input.value = 'Typed Name';
    input.__fire('keydown', { key: 'Enter', preventDefault: function () {}, stopPropagation: function () {} });
    check(
      optionValues(env).indexOf('Typed Name') !== -1 &&
        env.panel.byId['current-preset-name'].textContent === 'Typed Name' &&
        env.panel.byId['unsaved-indicator'].style.display === 'none',
      'J3: Enter saves — preset listed+selected semantics, display renamed, dot cleared'
    );
    check(
      input.parentNode.style.display === 'none',
      'J3: the naming row collapses after a successful save'
    );
    check(
      env.promptCalls.length === 0 && env.confirmCalls === 0,
      'J3: prompt()/confirm() were NEVER called by the whole flow'
    );

    // Collision keeps the dialog-era semantics: silent overwrite.
    env.panel.byId['save-preset-btn'].__fire('click');
    input = doc.getElementById('preset-name-input');
    input.value = 'Typed Name';
    doc.getElementById('preset-name-confirm').__fire('click');
    check(
      sandbox.PresetStore.load('Typed Name') !== null &&
        optionValues(env).filter(function (v) { return v === 'Typed Name'; }).length === 1,
      'J4: saving under an EXISTING name overwrites silently (prompt-era semantics kept)'
    );
  }

  // ------------------------------------------------------------------
  console.log('K. save_preset undo is retryable when persistence restore fails');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv({ realAgentUi: true });
    var sandbox = env.sandbox;
    var saved = await getTool(sandbox, 'save_preset').execute({ name: 'Retry Created' });
    var toastRegion = env.body.querySelector('.agent-toast-region');
    var toast = toastRegion && toastRegion.children[toastRegion.children.length - 1];
    check(
      !!saved && saved.applied === true && sandbox.AgentUI.canUndo() === true && !!toast,
      'K1: a created preset has a real AgentUI undo entry and success toast'
    );

    env.storage.fault.setItemError = namedError(
      'QuotaExceededError',
      'The quota has been exceeded while deleting the created preset.'
    );
    var undoEventsBefore = env.domEvents.filter(function (event) {
      return event.type === 'agentui:undo';
    }).length;
    var failedEventsBefore = env.domEvents.filter(function (event) {
      return event.type === 'agentui:undo-failed';
    }).length;
    var failedUndo = sandbox.AgentUI.undo();
    var failedNote = toast.querySelector('.agent-toast-undo-failed');
    var failedEvents = env.domEvents.filter(function (event) {
      return event.type === 'agentui:undo-failed';
    });

    check(
      failedUndo === null && sandbox.AgentUI.canUndo() === true,
      'K2 remove failure: undo returns null and RETAINS the entry for retry'
    );
    check(
      storedNames(env).indexOf('Retry Created') !== -1,
      'K2 remove failure: the created preset remains stored'
    );
    check(
      toast.getAttribute('data-undone') !== 'true' &&
        toast.querySelector('.agent-toast-undone') === null &&
        !!toast.querySelector('.agent-toast-undo'),
      'K2 remove failure: the toast is NOT marked Undone and keeps its Undo button'
    );
    check(
      !!failedNote && failedNote.textContent.indexOf('Undo failed') !== -1 &&
        failedNote.textContent.indexOf('quota has been exceeded') !== -1,
      'K2 remove failure: the toast shows an explicit failure message with the storage cause'
    );
    check(
      failedEvents.length === failedEventsBefore + 1 &&
        failedEvents[failedEvents.length - 1].detail.label === 'save_preset "Retry Created"' &&
        failedEvents[failedEvents.length - 1].detail.remaining === 1 &&
        failedEvents[failedEvents.length - 1].detail.errorText.indexOf('quota has been exceeded') !== -1,
      'K2 remove failure: one agentui:undo-failed event carries the label, stack depth, and cause'
    );
    check(
      env.domEvents.filter(function (event) {
        return event.type === 'agentui:undo';
      }).length === undoEventsBefore,
      'K2 remove failure: NO success agentui:undo event fired'
    );

    env.storage.fault.setItemError = null;
    var retriedUndo = sandbox.AgentUI.undo();
    check(
      !!retriedUndo && retriedUndo.label === 'save_preset "Retry Created"' &&
        sandbox.AgentUI.canUndo() === false &&
        storedNames(env).indexOf('Retry Created') === -1,
      'K3 remove retry: the same entry succeeds, is consumed, and removes the preset'
    );
    check(
      toast.getAttribute('data-undone') === 'true' &&
        toast.querySelector('.agent-toast-undone') !== null &&
        toast.querySelector('.agent-toast-undo-failed') === null &&
        toast.querySelector('.agent-toast-undo') === null,
      'K3 remove retry: only success marks Undone and clears the prior failure message'
    );
    check(
      env.domEvents.filter(function (event) {
        return event.type === 'agentui:undo';
      }).length === undoEventsBefore + 1,
      'K3 remove retry: exactly one success agentui:undo event fired'
    );
  }

  {
    var env = freshSeededEnv({ realAgentUi: true });
    var sandbox = env.sandbox;
    var changed = sandbox.DEFAULT_PRESET.nodes.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
    changed[0].params.gainDb = 3;
    env.installModel(changed);
    var saved = await getTool(sandbox, 'save_preset').execute({ name: 'Baseline' });
    var toastRegion = env.body.querySelector('.agent-toast-region');
    var toast = toastRegion && toastRegion.children[toastRegion.children.length - 1];
    check(
      !!saved && saved.applied === true && saved.overwrote === true &&
        sandbox.PresetStore.load('Baseline').nodes[0].params.gainDb === 3,
      'K4: overwrite setup persisted the changed gain before undo'
    );

    env.storage.fault.setItemError = namedError(
      'SecurityError',
      'Storage access was denied while restoring overwritten content.'
    );
    var failedUndo = sandbox.AgentUI.undo();
    var failedNote = toast.querySelector('.agent-toast-undo-failed');
    check(
      failedUndo === null && sandbox.AgentUI.canUndo() === true &&
        sandbox.PresetStore.load('Baseline').nodes[0].params.gainDb === 3,
      'K5 save failure: undo retains the entry and leaves the overwritten content intact'
    );
    check(
      toast.getAttribute('data-undone') !== 'true' &&
        !!failedNote && failedNote.textContent.indexOf('Storage access was denied') !== -1 &&
        env.domEvents.filter(function (event) { return event.type === 'agentui:undo'; }).length === 0 &&
        env.domEvents.filter(function (event) { return event.type === 'agentui:undo-failed'; }).length === 1,
      'K5 save failure: the UI/event state reports failure, never success'
    );

    env.storage.fault.setItemError = null;
    var retriedUndo = sandbox.AgentUI.undo();
    check(
      !!retriedUndo && sandbox.AgentUI.canUndo() === false &&
        sandbox.PresetStore.load('Baseline').nodes[0].params.gainDb === 0,
      'K6 save retry: the retained entry restores the prior preset content and is consumed'
    );
    check(
      toast.getAttribute('data-undone') === 'true' &&
        toast.querySelector('.agent-toast-undo-failed') === null &&
        env.domEvents.filter(function (event) { return event.type === 'agentui:undo'; }).length === 1,
      'K6 save retry: only the successful retry marks and emits undo success'
    );
  }

  // ------------------------------------------------------------------
  console.log('L. P3-5: Load defensive paths — the quiet note, never a browser dialog');
  // ------------------------------------------------------------------
  {
    var env = freshSeededEnv();
    var sandbox = env.sandbox;
    env.installModel(sandbox.DEFAULT_PRESET.nodes);
    function liveChainIds() {
      return sandbox.ChainCanvas.getCurrentModel().map(function (n) {
        return n.id;
      }).join('|');
    }
    var modelBefore = liveChainIds();

    // The user-preset guard: "Baseline" is listed and selected, but the
    // store loses it behind the UI's back — exactly another tab having
    // removed it out from under us (the guard's own comment scenario).
    delete env.storage.__box[STORAGE_KEY];
    env.panel.byId['load-preset-btn'].__fire('click');
    var note = noteElement(env);
    check(
      !!note && note.style.display !== 'none' &&
        note.textContent === 'Could not load that preset — it may have been removed.',
      'L1: a vanished USER preset surfaces the quiet .preset-note refusal (exact sentence)'
    );
    check(env.alertCalls === 0, 'L1: the browser alert was NEVER called (the PS-3 remnant is gone)');
    check(
      env.panel.byId['current-preset-name'].textContent === 'Unsaved chain' &&
        env.panel.byId['unsaved-indicator'].style.display !== 'none',
      'L1: no load happened — display state untouched (still unsaved/modified)'
    );
    check(liveChainIds() === modelBefore, 'L1: the live chain was NOT replaced');

    // The factory guard: the dropdown lists a factory entry whose name the
    // library no longer reports (it changed mid-session — the guard's own
    // comment scenario).
    var factoryStub = {
      payload: [{ name: 'Warm Ballad', nodes: [] }],
      list: function () {
        return factoryStub.payload;
      }
    };
    sandbox.FactoryPresets = factoryStub;
    sandbox.PresetsUI.refreshPresetSelect('factory:Warm Ballad');
    var groupEl = env.panel.byId['preset-select'].children[0];
    check(
      String(groupEl.tagName).toLowerCase() === 'optgroup' && groupEl.label === 'Factory' &&
        groupEl.children.length === 1 && groupEl.children[0].selected === true,
      'L2 setup: the factory group rendered with "Warm Ballad" listed+selected'
    );
    // The stub select computes .value from DIRECT children only — surface
    // the nested selection the way a real <select> would.
    groupEl.selected = true;
    groupEl.__value = 'factory:Warm Ballad';
    factoryStub.payload = []; // the library changed mid-session
    env.panel.byId['load-preset-btn'].__fire('click');
    note = noteElement(env);
    check(
      !!note && note.style.display !== 'none' &&
        note.textContent === 'Could not load that preset — it may have been removed.',
      'L2: a vanished FACTORY preset surfaces the same quiet refusal'
    );
    check(env.alertCalls === 0, 'L2: the browser alert was NEVER called');
    check(liveChainIds() === modelBefore, 'L2: the live chain was NOT replaced');
    check(
      env.promptCalls.length === 0 && env.confirmCalls === 0 && env.alertCalls === 0,
      'L2: the whole panel flow stays dialog-free (prompt/confirm/alert all zero)'
    );

    // Issue #20: a real preset selection delegates to ChainEditing and a
    // rejected transaction cannot replace the canvas or establish a clean
    // preset display baseline.
    factoryStub.payload = [{
      name: 'Warm Ballad',
      nodes: [{ id: 'warm-limiter', type: 'limiter', params: { ceiling: -6, release: 150 } }]
    }];
    sandbox.PresetsUI.refreshPresetSelect('factory:Warm Ballad');
    groupEl = env.panel.byId['preset-select'].children[0];
    groupEl.selected = true;
    groupEl.__value = 'factory:Warm Ballad';
    var presetApplyRequest = null;
    sandbox.ChainEditing = {
      apply: function (request) {
        presetApplyRequest = request;
        var rejection = new Error('preset graph rejected');
        rejection.code = 'CHAIN_APPLY_FAILED';
        rejection.rollback = { attempted: true, succeeded: true };
        return Promise.reject(rejection);
      }
    };
    modelBefore = liveChainIds();
    env.panel.byId['load-preset-btn'].__fire('click');
    await Promise.resolve();
    check(
      presetApplyRequest && presetApplyRequest.source === 'preset' &&
        presetApplyRequest.forceStructural === true &&
        presetApplyRequest.preset.name === 'Warm Ballad',
      'L3: the real preset adapter submits its normalized load through ChainEditing'
    );
    check(
      liveChainIds() === modelBefore &&
        env.panel.byId['current-preset-name'].textContent === 'Unsaved chain' &&
        env.panel.byId['unsaved-indicator'].style.display !== 'none',
      'L3: rejected preset work preserves the previous canvas and dirty display baseline'
    );
  }

  // ------------------------------------------------------------------
  console.log('M. P3-5 source gate: zero browser alert calls in shipped src');
  // ------------------------------------------------------------------
  {
    // The R2-3 "no browser dialogs" rule, now enforced surface-wide for
    // alert: no src file may carry an alert CALL (the bare token with a
    // call paren) or a window.alert reference at all. Comments that
    // MENTION the rule spell the other dialogs without these tokens, so
    // the gate needs no comment-stripping and cannot be silenced by one.
    var srcDir = path.join(ROOT, 'src');
    var files = fs.readdirSync(srcDir).filter(function (f) {
      return /\.js$/.test(f);
    }).sort();
    var offenders = [];
    files.forEach(function (file) {
      var text = fs.readFileSync(path.join(srcDir, file), 'utf8');
      if (/(?:\bwindow\s*\.\s*alert\b|\balert\s*\()/.test(text)) {
        offenders.push(file);
      }
    });
    check(files.length >= 30, 'M1: scanned the whole src directory (' + files.length + ' files)');
    check(
      offenders.length === 0,
      'M1: zero alert call tokens across shipped src (offenders: ' +
        (offenders.join(', ') || 'none') + ')'
    );
  }

  // ------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: preset persistence failures are reported truthfully by both save paths (issue #8)');
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
