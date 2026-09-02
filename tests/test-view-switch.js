// Test for wayfinder #47 — the Simple/Advanced view switch and the
// Simple shell.
//
// The ticket's own acceptance line: "Pin that with a test asserting no
// reconnect, no preset reload, and no ChainEditing.apply on a view
// change — that test is what keeps presentation-only true six commits
// from now." Section C below is that pin. The rest of this file covers
// the switch's persistence contract, the shell's structural placement
// (the safety floor lives OUTSIDE both view containers, so it never gets
// hidden by either), and that every accepted chain edit — including the
// param-only fast path chain-editing.js's own header calls out — reaches
// the Simple stage's re-render.
//
// Same committed-test convention as the rest of the suite: a
// zero-dependency Node harness. Section A reads the REAL index.html with
// the tag-stack parser test-two-deck-stack.js already established (no
// fake DOM needed for static structure). Sections B-D load the REAL
// src/simple-view.js into a vm sandbox with a minimal fake DOM (the
// makeElement/documentStub pattern tests/test-discrete-param-controls.js
// already established) plus small controllable mocks for its
// collaborators (AudioGraph/EffectCatalog/PresetsUI/FactoryPresets).
// Section E loads the REAL src/chain-editing.js with the adapter-mock
// harness tests/test-chain-editing.js already established, extended with
// a window.SimpleView spy.
//
// Run from a clean clone:  node tests/test-view-switch.js
// (or via the runner:      node tests/run.js view-switch)
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

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function node(id, type, params) {
  return { id: id, type: type, params: params || {} };
}

// ==========================================================================
// A. STATIC STRUCTURE — the real index.html, no fake DOM.
// ==========================================================================

(function sectionA() {
  console.log('A. static structure: the switch, the shell, and the shared safety floor');

  var VOID_TAGS = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;

  function parseAttrs(raw) {
    var attrs = {};
    var re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|[^\s]+)/g;
    var m;
    while ((m = re.exec(raw))) {
      attrs[m[1]] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[2]);
    }
    return attrs;
  }

  function parseMarkup(html) {
    var bodyStart = html.indexOf('<body');
    var scriptAt = html.indexOf('<script', bodyStart);
    var region = html.slice(bodyStart, scriptAt === -1 ? undefined : scriptAt);
    var root = { tag: '#root', attrs: {}, children: [] };
    var stack = [root];
    var re = /<!--[\s\S]*?-->|<(\/?)(\w+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
    var m;
    while ((m = re.exec(region))) {
      if (m[0].charAt(1) === '!') {
        continue;
      }
      var tag = m[2].toLowerCase();
      if (m[1] === '/') {
        for (var i = stack.length - 1; i > 0; i--) {
          if (stack[i].tag === tag) {
            stack.length = i;
            break;
          }
        }
        continue;
      }
      var elNode = { tag: tag, attrs: parseAttrs(m[3] || ''), children: [] };
      stack[stack.length - 1].children.push(elNode);
      if (!VOID_TAGS.test(tag)) {
        stack.push(elNode);
      }
    }
    return root;
  }

  function classesOf(n) {
    return n && n.attrs['class'] ? n.attrs['class'].split(/\s+/) : [];
  }

  function hasClass(n, cls) {
    return classesOf(n).indexOf(cls) !== -1;
  }

  function descendants(n, pred, acc) {
    acc = acc || [];
    (n.children || []).forEach(function (child) {
      if (pred(child)) {
        acc.push(child);
      }
      descendants(child, pred, acc);
    });
    return acc;
  }

  function byId(root, id) {
    return descendants(root, function (n) { return n.attrs.id === id; })[0] || null;
  }

  function isDescendantOf(root, ancestorId, id) {
    var ancestor = byId(root, ancestorId);
    if (!ancestor) {
      return false;
    }
    return descendants(ancestor, function (n) { return n.attrs.id === id; }).length > 0;
  }

  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var tree = parseMarkup(html);
  var bodyEl = descendants(tree, function (n) { return n.tag === 'body'; })[0];
  var instrument = bodyEl && (descendants(bodyEl, function (n) { return hasClass(n, 'instrument'); })[0]);

  var viewSwitch = instrument && descendants(instrument, function (n) { return hasClass(n, 'view-switch'); })[0];
  check(!!viewSwitch, 'A1: .view-switch exists');
  check(
    !!viewSwitch && !isDescendantOf(instrument, 'chain-layout', 'view-switch-simple') &&
      !isDescendantOf(instrument, 'simple-layout', 'view-switch-simple'),
    'A2: the switch itself lives OUTSIDE both view containers (available from both views — settled #43)'
  );

  var simpleLayout = byId(instrument, 'simple-layout');
  var chainLayout = byId(instrument, 'chain-layout');
  check(!!simpleLayout && !!chainLayout, 'A3: #simple-layout and #chain-layout both exist');
  check(
    !!simpleLayout && !!chainLayout && simpleLayout !== chainLayout &&
      instrument.children.indexOf(simpleLayout) !== -1 && instrument.children.indexOf(chainLayout) !== -1,
    'A4: #simple-layout is a SIBLING of #chain-layout inside .instrument, not nested inside it'
  );

  // The safety floor (Start, mic select, Bypass, the readouts) lives in
  // the topbar — a sibling of both view containers — so neither view's
  // CSS display:none can ever hide it, regardless of which is active.
  ['start-button', 'input-device-select', 'bypass-toggle-button'].forEach(function (id) {
    check(
      !isDescendantOf(instrument, 'chain-layout', id) && !isDescendantOf(instrument, 'simple-layout', id),
      'A5: safety-floor control #' + id + ' lives outside both view containers'
    );
  });

  // Simple's OWN meter mount points exist inside its stage face — the
  // OTHER half of "the safety floor renders identically": src/meters.js's
  // mountSimpleUnit() finds these by id and appends the same strip
  // markup Advanced gets, fed by the same ballistics.
  check(
    isDescendantOf(instrument, 'simple-layout', 'simple-meter-in') &&
      isDescendantOf(instrument, 'simple-layout', 'simple-meter-out'),
    'A6: #simple-meter-in / #simple-meter-out mount points exist inside the Simple shell'
  );

  // Advanced's own meter mount anchor (.canvas-panel/#chain-canvas) is
  // unchanged and still inside #chain-layout — meters.js's Advanced path
  // (buildFooterUnit) is untouched by this ticket.
  check(
    isDescendantOf(instrument, 'chain-layout', 'chain-canvas'),
    'A7: #chain-canvas (Advanced meters own anchor) is unchanged, inside #chain-layout'
  );
})();

// ==========================================================================
// B-D. src/simple-view.js against a minimal fake DOM.
// ==========================================================================

function makeElement(tagName) {
  var el = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    listeners: {},
    attrs: {},
    _classes: [],
    hidden: false,
    _text: ''
  };
  // Real textContent reads the concatenation of every descendant text
  // node — simple-view.js relies on that (it sets textContent='' to
  // clear, then appendChild()s a mix of text nodes and element spans).
  function flattenText(node) {
    if (node.nodeType === 3) {
      return node.textContent;
    }
    return (node.children || []).map(flattenText).join('');
  }
  Object.defineProperty(el, 'textContent', {
    get: function () { return el.children.length ? flattenText(el) : el._text; },
    set: function (v) { el._text = String(v); el.children = []; }
  });
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return ''; },
    set: function () { el.children = []; }
  });
  el.classList = {
    add: function (c) { if (el._classes.indexOf(c) === -1) { el._classes.push(c); } },
    remove: function (c) { var i = el._classes.indexOf(c); if (i !== -1) { el._classes.splice(i, 1); } },
    contains: function (c) { return el._classes.indexOf(c) !== -1; },
    toggle: function (c, force) {
      var has = el._classes.indexOf(c) !== -1;
      var want = force === undefined ? !has : !!force;
      if (want && !has) { el._classes.push(c); }
      if (!want && has) { el._classes.splice(el._classes.indexOf(c), 1); }
      return want;
    }
  };
  el.appendChild = function (child) { el.children.push(child); return child; };
  el.addEventListener = function (evt, fn) { (el.listeners[evt] = el.listeners[evt] || []).push(fn); };
  el.setAttribute = function (name, val) { el.attrs[name] = String(val); };
  el.getAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(el.attrs, name) ? el.attrs[name] : null;
  };
  el.fire = function (evt) { (el.listeners[evt] || []).forEach(function (fn) { fn({}); }); };
  return el;
}

function makeStorage() {
  var box = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(box, k) ? box[k] : null; },
    setItem: function (k, v) { box[k] = String(v); },
    removeItem: function (k) { delete box[k]; }
  };
}

function makeSimpleViewSandbox(collaborators) {
  var registry = {};
  ['view-switch-simple', 'view-switch-advanced', 'simple-cs-name', 'simple-desc', 'simple-summary'].forEach(function (id) {
    var tag = id === 'simple-summary' ? 'ol' : (id.indexOf('view-switch') === 0 ? 'button' : 'div');
    registry[id] = makeElement(tag);
  });
  var bodyEl = makeElement('body');
  var documentStub = {
    createElement: makeElement,
    createTextNode: function (text) { return { nodeType: 3, textContent: String(text) }; },
    getElementById: function (id) { return Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null; },
    body: bodyEl
  };

  var sandbox = {
    console: console,
    document: documentStub
  };
  sandbox.window = sandbox;
  sandbox.localStorage = makeStorage();
  Object.keys(collaborators || {}).forEach(function (key) {
    sandbox[key] = collaborators[key];
  });
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/simple-view.js'), 'utf8'), sandbox, {
    filename: 'src/simple-view.js'
  });
  return { window: sandbox, els: registry, body: bodyEl, storage: sandbox.localStorage };
}

(function sectionB() {
  console.log('B. the switch: default, persistence, aria-checked');

  var h = makeSimpleViewSandbox({});
  check(!h.body.classList.contains('view-advanced'), 'B1: absent preference means Simple (no body.view-advanced)');
  check(h.els['view-switch-simple'].getAttribute('aria-checked') === 'true', 'B1: Simple key starts checked');
  check(h.els['view-switch-advanced'].getAttribute('aria-checked') === 'false', 'B1: Advanced key starts unchecked');

  h.els['view-switch-advanced'].fire('click');
  check(h.body.classList.contains('view-advanced'), 'B2: clicking Advanced adds body.view-advanced');
  check(h.els['view-switch-advanced'].getAttribute('aria-checked') === 'true', 'B2: Advanced key flips to checked');
  check(h.els['view-switch-simple'].getAttribute('aria-checked') === 'false', 'B2: Simple key flips to unchecked');
  check(h.storage.getItem('karaoke-view-v1') === 'advanced', 'B2: the choice persists to localStorage');

  h.els['view-switch-simple'].fire('click');
  check(!h.body.classList.contains('view-advanced'), 'B3: clicking Simple removes body.view-advanced');
  check(h.storage.getItem('karaoke-view-v1') === 'simple', 'B3: the choice persists back to simple');

  // Reload-persistence: a fresh sandbox reading a PRE-SET 'advanced'
  // preference from the START (the "choice persists alongside the
  // autosave slot" requirement — a second page load honors what was
  // chosen before). localStorage must be seeded before simple-view.js
  // runs, since it reads the preference once at load.
  var seeded = makeStorage();
  seeded.setItem('karaoke-view-v1', 'advanced');
  var reload2 = (function () {
    var registry = {};
    ['view-switch-simple', 'view-switch-advanced', 'simple-cs-name', 'simple-desc', 'simple-summary'].forEach(function (id) {
      registry[id] = makeElement(id.indexOf('view-switch') === 0 ? 'button' : 'div');
    });
    var bodyEl = makeElement('body');
    var sandbox = {
      console: console,
      document: {
        createElement: makeElement,
        createTextNode: function (t) { return { nodeType: 3, textContent: String(t) }; },
        getElementById: function (id) { return registry[id] || null; },
        body: bodyEl
      },
      localStorage: seeded
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/simple-view.js'), 'utf8'), sandbox, {
      filename: 'src/simple-view.js'
    });
    return { body: bodyEl, els: registry };
  })();
  check(reload2.body.classList.contains('view-advanced'), 'B4: a stored "advanced" preference is honored on the next load');
  check(reload2.els['view-switch-advanced'].getAttribute('aria-checked') === 'true', 'B4: aria-checked matches the restored view');
})();

(function sectionC() {
  console.log('C. THE PIN — a view change never reconnects, never reloads a preset, never calls ChainEditing.apply');

  var calls = { buildGraph: 0, chainEditingApply: 0, renderModel: 0, renderNodeParam: 0, setCurrentPreset: 0 };
  var collaborators = {
    AudioGraph: {
      getModel: function () { return [node('a', 'gain', { gainDb: 0 })]; },
      buildGraph: function () { calls.buildGraph += 1; return Promise.resolve({ committed: true }); }
    },
    ChainEditing: {
      apply: function () { calls.chainEditingApply += 1; return Promise.resolve({ applied: true }); }
    },
    ChainCanvas: {
      renderModel: function () { calls.renderModel += 1; return true; },
      renderNodeParam: function () { calls.renderNodeParam += 1; return true; }
    },
    PresetsUI: {
      getDisplayState: function () { return { name: 'Warm Ballad', modified: false }; },
      setCurrentPreset: function () { calls.setCurrentPreset += 1; }
    },
    EffectCatalog: {
      getPlainLabel: function (t) { return 'plain:' + t; },
      getLabel: function (t) { return 'Tech:' + t; }
    }
  };
  var h = makeSimpleViewSandbox(collaborators);

  // Flip the switch several times, each direction, plus re-render the
  // stage explicitly (as chain-editing.js's hook would on an edit) —
  // NONE of it may touch the audio graph or reload anything.
  h.els['view-switch-advanced'].fire('click');
  h.els['view-switch-simple'].fire('click');
  h.els['view-switch-advanced'].fire('click');
  h.window.SimpleView.onChainChanged();
  h.els['view-switch-simple'].fire('click');

  check(calls.buildGraph === 0, 'C1: no AudioGraph.buildGraph call (no reconnect)');
  check(calls.chainEditingApply === 0, 'C2: no ChainEditing.apply call (no mutation)');
  check(calls.renderModel === 0 && calls.renderNodeParam === 0, 'C3: no ChainCanvas render call (no preset reload / re-render)');
  check(calls.setCurrentPreset === 0, 'C4: no PresetsUI write call — the stage only READS getDisplayState');
})();

(function sectionD() {
  console.log('D. the stage renders the live chain and PresetsUI state honestly');

  function harnessWith(model, displayState) {
    var summaryFrame;
    var collaborators = {
      AudioGraph: { getModel: function () { return model; } },
      PresetsUI: { getDisplayState: function () { return displayState; } },
      EffectCatalog: {
        getPlainLabel: function (t) { return { gain: 'Adjusts your volume', eq: 'Shapes your tone' }[t] || t; },
        getLabel: function (t) { return { gain: 'Gain', eq: 'EQ' }[t] || t; }
      },
      FactoryPresets: {
        describeAll: function () { return [{ name: 'Warm Ballad', description: 'Gentle warmth.' }]; }
      }
    };
    var h = makeSimpleViewSandbox(collaborators);
    summaryFrame = h.els['simple-summary'].children;
    return { nameEl: h.els['simple-cs-name'], descEl: h.els['simple-desc'], rows: summaryFrame };
  }

  var named = harnessWith(
    [node('a', 'gain', {}), node('b', 'eq', {})],
    { name: 'Warm Ballad', modified: false }
  );
  check(named.nameEl.textContent === 'Warm Ballad', 'D1: a named, clean preset shows its own name with no marker');
  check(named.descEl.hidden === false && named.descEl.textContent === 'Gentle warmth.',
    'D1: its factory description shows');
  check(named.rows.length === 2, 'D1: one summary row per chain node');
  check(named.rows[0].children[1].textContent === 'Adjusts your volume' &&
      named.rows[0].children[2].textContent === 'Gain',
    'D1: row order follows signal order; plain phrase then technical name');

  var unsaved = harnessWith(
    [node('a', 'gain', {})],
    { name: 'Warm Ballad', modified: true }
  );
  // children[0] is always the name's own text node; a modified preset
  // appends the marker span as children[1].
  check(unsaved.nameEl.children.length === 2 && unsaved.nameEl.children[1].textContent === ' · unsaved changes',
    'D2: a modified preset shows the unsaved marker');

  var custom = harnessWith([node('a', 'gain', {})], { name: null, modified: false });
  check(custom.nameEl.textContent === 'Custom sound', 'D3: no named preset reads as "Custom sound"');
  check(custom.descEl.hidden === true, 'D3: no description for an unnamed chain');
  check(custom.nameEl.children.length === 1, 'D3: no overclaiming marker — presets-ui.js tracks no provenance to name it');

  var empty = harnessWith([], { name: null, modified: false });
  check(empty.rows.length === 1 && empty.rows[0].textContent === 'Press Start to power on',
    'D4: an empty chain (pre-Start) shows the same instruction Advanced\'s own empty-hint gives');
})();

// ==========================================================================
// E. src/chain-editing.js's real markAcceptedEdit() reaches SimpleView.
// ==========================================================================

(function sectionE() {
  console.log('E. every accepted edit mode notifies window.SimpleView.onChainChanged');

  function makeChainEditingHarness(initial) {
    var canvasModel = copy(initial);
    var graphModel = copy(initial);
    var presetState = { name: 'Classic', modified: false };
    var notifyCount = 0;

    var sandbox = {
      console: console,
      Promise: Promise,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout
    };
    sandbox.window = sandbox;
    sandbox.AudioEngine = { audioContext: {}, sourceNode: {} };
    sandbox.AudioGraph = {
      getModel: function () { return copy(graphModel); },
      getNodeInstance: function (id) { return { id: id }; },
      updateNodeParams: function (id, params) {
        graphModel.forEach(function (entry) {
          if (entry.id === id) { entry.params = copy(params); }
        });
      },
      buildGraph: function (model) {
        graphModel = copy(model);
        return Promise.resolve({ committed: true });
      }
    };
    sandbox.EffectCatalog = {
      getParamSpec: function () { return []; },
      applyParam: function () {}
    };
    sandbox.ChainCanvas = {
      getCurrentModel: function () { return copy(canvasModel); },
      getCurrentLayout: function () { return {}; },
      renderModel: function (model) { canvasModel = copy(model); return true; },
      renderNodeParam: function (id, param, value) {
        var found = false;
        canvasModel.forEach(function (entry) {
          if (entry.id === id) { entry.params[param] = value; found = true; }
        });
        return found;
      }
    };
    sandbox.Persistence = {
      saveCurrentChain: function () { return { saved: true }; },
      isSaveFailed: function () { return false; }
    };
    sandbox.PresetsUI = {
      getDisplayState: function () { return copy(presetState); },
      setCurrentPreset: function (name) { presetState.name = name; },
      markModified: function () { presetState.modified = true; },
      clearModified: function () { presetState.modified = false; }
    };
    sandbox.SimpleView = {
      onChainChanged: function () { notifyCount += 1; }
    };

    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/chain-editing.js'), 'utf8'), sandbox, {
      filename: 'src/chain-editing.js'
    });

    return {
      window: sandbox,
      notifyCount: function () { return notifyCount; }
    };
  }

  (async function () {
    // Structural human edit.
    var h1 = makeChainEditingHarness([node('a', 'gain', { gainDb: 0 })]);
    await h1.window.ChainEditing.apply({
      source: 'human',
      candidate: [node('a', 'gain', { gainDb: 0 }), node('b', 'limiter', { ceilingDb: -1 })]
    });
    check(h1.notifyCount() === 1, 'E1: a structural human edit notifies SimpleView exactly once');

    // Param-only fast path.
    var h2 = makeChainEditingHarness([node('a', 'gain', { gainDb: 0 })]);
    await h2.window.ChainEditing.apply({
      source: 'human',
      candidate: [node('a', 'gain', { gainDb: 6 })]
    });
    check(h2.notifyCount() === 1, 'E2: a param-only fast-path edit ALSO notifies SimpleView (the ticket\'s own "stays live" scene)');

    // Preset load.
    var h3 = makeChainEditingHarness([node('a', 'gain', { gainDb: 0 })]);
    await h3.window.ChainEditing.apply({
      source: 'preset',
      candidate: [node('a', 'gain', { gainDb: 0 }), node('b', 'reverb', { mix: 20 })],
      layout: null,
      forceStructural: true,
      preset: { name: 'Warm Ballad', modified: false }
    });
    check(h3.notifyCount() === 1, 'E3: a preset load notifies SimpleView too');

    // Without window.SimpleView present at all (pre-#47 harness, or a
    // bare test sandbox) — chain-editing.js must not throw.
    var h4 = makeChainEditingHarness([node('a', 'gain', { gainDb: 0 })]);
    delete h4.window.SimpleView;
    var threw = null;
    try {
      await h4.window.ChainEditing.apply({
        source: 'human',
        candidate: [node('a', 'gain', { gainDb: 6 })]
      });
    } catch (err) {
      threw = err;
    }
    check(threw === null, 'E4: chain-editing.js degrades safely when window.SimpleView is absent');

    // ------------------------------------------------------------------
    if (failures.length === 0) {
      console.log('PASS: the view switch is presentation-only and the Simple stage stays live (wayfinder #47)');
      process.exit(0);
    }
    console.log('FAIL: ' + failures.length + ' check(s) failed:');
    failures.forEach(function (label) {
      console.log('  - ' + label);
    });
    process.exit(1);
  })();
})();
