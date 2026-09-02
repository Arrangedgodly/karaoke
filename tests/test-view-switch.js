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

  // The pre-Start gate paints on the FIRST frame in both views. Advanced
  // ships `engine-not-started` on #chain-layout; Simple ships it on the
  // one surface that is genuinely inert before Start, #simple-stage.
  var simpleStage = byId(instrument, 'simple-stage');
  check(
    !!simpleStage && hasClass(simpleStage, 'engine-not-started'),
    'A8: #simple-stage ships pre-gated, so Simple hatches on first paint like Advanced does'
  );
  check(
    !!chainLayout && hasClass(chainLayout, 'engine-not-started'),
    'A8: #chain-layout still ships pre-gated (Advanced unchanged)'
  );
  // The Sounds library must NOT be swept into the gate: the shared
  // `.layout.engine-not-started .presets-panel` rule pointer-locks the
  // panel it matches, and Simple keeps browse + search live before Start.
  check(
    !!simpleLayout && !hasClass(simpleLayout, 'engine-not-started'),
    'A9: #simple-layout itself is NOT gated, so the Sounds library stays browsable before Start'
  );

  // The paint half of the same grammar: one hatch declaration, sharing
  // the geometry of the Advanced gate it mirrors.
  var css = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
  check(
    /\.simple-stage\.engine-not-started\s*\{[^}]*opacity:\s*0\.55/.test(css),
    'A10: .simple-stage.engine-not-started recedes to the same 0.55 the Advanced gate uses'
  );
  check(
    /\.simple-stage\.engine-not-started::before\s*\{[^}]*repeating-linear-gradient\(\s*-45deg/.test(css),
    'A10: .simple-stage.engine-not-started paints the same -45deg hatch as the Advanced gate'
  );
})();

// ==========================================================================
// H. SIMPLE PRE-START PARITY — browsing stays available while every chain
//    mutation closes until the same live predicate that gates Advanced wins.
// ==========================================================================

(function sectionH() {
  console.log('H. Simple pre-Start controls fail closed and explain the recovery');

  var loadCalls = [];
  var engine = {
    isStarted: false,
    isTrackLive: false,
    audioContext: null
  };
  var entries = [
    { name: 'Warm Ballad', description: 'Warm and close.', tags: ['vibe:warm'] },
    { name: 'Rock Night', description: 'Forward rock vocal.', tags: ['genre:Rock'] }
  ];
  var h = makeSimpleViewSandbox({
    AudioEngine: engine,
    AudioGraph: { getModel: function () { return []; } },
    PresetsUI: {
      getDisplayState: function () { return { name: null, modified: false }; },
      loadFactoryPreset: function (name) { loadCalls.push(name); },
      saveCurrentChainAs: function () { return { ok: true }; }
    },
    FactoryPresets: {
      listDetailed: function () { return entries; },
      describeAll: function () { return entries; },
      // list() carries the NODES — the armed cold face resolves the
      // picked sound's own chain through it (2026-09-02).
      list: function () {
        return [
          { name: 'Warm Ballad', nodes: [
            { id: 'n1', type: 'compressor', params: { threshold: -20 } },
            { id: 'n2', type: 'reverb', params: { mix: 22 } }
          ] },
          { name: 'Rock Night', nodes: [
            { id: 'n1', type: 'compressor', params: { threshold: -18 } },
            { id: 'n2', type: 'delay', params: { timeMs: 120 } },
            { id: 'n3', type: 'limiter', params: { ceiling: -3 } }
          ] }
        ];
      }
    },
    PresetStore: { listNames: function () { return []; } }
  });

  var cards = h.els['simple-library-body'].children[2];
  var firstTry = cards.children[1].children[0];
  check(h.els['simple-cs-name'].textContent === 'Ready to start',
    'H1: the stopped stage names the real state instead of claiming Custom sound');
  check(h.els['simple-summary'].hidden === true && h.els['simple-summary'].children.length === 0,
    'H1: the stopped stage does not repeat the Start instruction');
  check(h.els['simple-library-gate-note'].hidden === false,
    'H1: the library shows a visible pre-Start explanation');
  check(h.els['simple-stage'].classList.contains('engine-not-started'),
    'H1: the stopped stage wears the shared hatch-and-recede gate');
  // Try is aria-disabled, NOT natively disabled: a native `disabled`
  // swallows the click, and the click is how the operator gets told what
  // to do about it (H6 below). The guard that matters is the handler's,
  // pinned by H3.
  check(firstTry.getAttribute('aria-disabled') === 'true' && firstTry.disabled !== true &&
      h.els['simple-transport'].hidden === true &&
      h.els['simple-transport'].children.length === 0,
    'H2: Try reads unavailable to AT before Start, and Previous/Next stay hidden');
  check(firstTry.getAttribute('aria-describedby') === 'simple-library-gate-note',
    'H2: the gated Try points at the note that explains the recovery');
  check(h.els['simple-save-btn'].hidden === true && h.els['simple-save-btn'].disabled === true,
    'H2: Save this sound is hidden and disabled before Start');

  var standingNote = h.els['simple-library-gate-note'].textContent;
  firstTry.fire('click');
  h.els['simple-save-btn'].fire('click');
  check(loadCalls.length === 0 && h.els['simple-save-row'].children.length === 0,
    'H3: even a synthetic click cannot bypass the pre-Start guards');

  // H6: the click is not swallowed — it ANSWERS. The note names the sound
  // that was just reached for and points at Start.
  var answered = h.els['simple-library-gate-note'].textContent;
  check(answered !== standingNote && answered.indexOf('Warm Ballad') !== -1,
    'H6: a gated Try rewrites the live note to name the sound just clicked');
  check(answered.indexOf('Press Start') === 0,
    'H6: the answer names Start — the one control that unblocks the surface');
  check(h.els['simple-library-gate-note'].hidden === false,
    'H6: the answer is visible (the note cannot be answering from behind hidden)');

  // H7 (2026-09-02): the gated click also ARMS that sound. The stage
  // behind the note stops printing the waiting chain and prints the one
  // just reached for, with the promise Start is about to keep. Still
  // nothing committed — H3 above pinned that, and it ran after this same
  // click.
  var armedRow = h.els['simple-library-body'].children[2].children[1];
  check(armedRow.classList.contains('preset-row-armed'),
    'H7: the row just clicked marks itself armed');
  var coldText = (function collect(el) {
    var out = String(el.textContent || '');
    (el.children || []).forEach(function (c) { out += collect(c); });
    return out;
  })(h.els['simple-cold-face']);
  check(coldText.indexOf('Press Start to try') !== -1 && coldText.indexOf('Warm Ballad') !== -1,
    'H7: the cold face promises exactly the armed sound');
  check(coldText.indexOf('Queued') !== -1,
    'H7: and its legend says queued, not held — the machine is still sitting on the other chain');

  engine.isStarted = true;
  engine.isTrackLive = true;
  engine.audioContext = { state: 'running' };
  h.window.SimpleView.onEngineStarted();
  cards = h.els['simple-library-body'].children[2];
  firstTry = cards.children[1].children[0];
  var prev = h.els['simple-transport'].children[0];
  var next = h.els['simple-transport'].children[2];
  check(h.els['simple-library-gate-note'].hidden === true &&
      firstTry.getAttribute('aria-disabled') === null,
    'H4: a live engine hides the gate note and un-gates Try');
  check(h.els['simple-library-gate-note'].textContent === standingNote,
    'H4: going live restores the standing note — the answer never outlives the gate');
  check(!h.els['simple-stage'].classList.contains('engine-not-started'),
    'H4: a live engine lifts the stage gate at the same transition');
  check(h.els['simple-transport'].hidden === false && prev.disabled === false &&
      next.disabled === false && h.els['simple-save-btn'].hidden === false,
    'H4: transport and Save become available with the live engine');
  // The arm is consumed exactly once, by Start, through the same guarded
  // path a live Try uses — this is what makes "Press Start to try X"
  // true rather than a caption.
  check(loadCalls.length === 1 && loadCalls[0] === 'Warm Ballad',
    'H7: Start loads the sound that was armed before it, exactly once');
  var coldAfter = h.els['simple-cold-face'];
  check(coldAfter.hidden === true,
    'H7: and the cold face is gone the moment the engine is live');
  loadCalls.length = 0;

  firstTry.fire('click');
  check(loadCalls.length === 1 && loadCalls[0] === 'Warm Ballad',
    'H4: the shared preset load path works after Start');

  h.els['simple-save-btn'].fire('click');
  check(h.els['simple-save-row'].hidden === false,
    'H5: the naming row can open while live');
  engine.isTrackLive = false;
  h.window.SimpleView.onEngineStopped();
  check(h.els['simple-save-row'].hidden === true && h.els['simple-save-btn'].hidden === true,
    'H5: engine loss closes the naming row and re-gates Save');
  check(h.els['simple-library-gate-note'].hidden === false,
    'H5: engine loss restores the visible recovery instruction');
  check(h.els['simple-stage'].classList.contains('engine-not-started'),
    'H5: engine loss re-hatches the stage — the paint can never outlive the live engine');
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
  el.fire = function (evt, data) {
    var event = data ? Object.assign({}, data) : {};
    if (event.preventDefault === undefined) {
      event.preventDefault = function () {};
    }
    (el.listeners[evt] || []).forEach(function (fn) { fn(event); });
  };
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
  ['view-switch-simple', 'view-switch-advanced', 'simple-cs-name', 'simple-desc', 'simple-summary', 'simple-library-body', 'simple-library-gate-note', 'simple-transport', 'simple-save-btn', 'simple-save-row', 'simple-stage', 'simple-cold-face'].forEach(function (id) {
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
  sandbox.AudioEngine = {
    isStarted: true,
    isTrackLive: true,
    audioContext: { state: 'running' }
  };
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
    ['view-switch-simple', 'view-switch-advanced', 'simple-cs-name', 'simple-desc', 'simple-summary', 'simple-library-body', 'simple-library-gate-note', 'simple-transport', 'simple-save-btn', 'simple-save-row', 'simple-stage', 'simple-cold-face'].forEach(function (id) {
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
      localStorage: seeded,
      AudioEngine: {
        isStarted: true,
        isTrackLive: true,
        audioContext: { state: 'running' }
      }
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
  check(empty.rows.length === 1 && empty.rows[0].textContent === 'No effects in this sound',
    'D4: a live empty chain names the sound state instead of repeating the Start instruction');
})();

// ==========================================================================
// E. THE SOUNDS LIBRARY (wayfinder #48) — plain filters, search, Factory/
//    Yours, and the Previous/Next transport over the filtered factory list.
// ==========================================================================

(function sectionE() {
  console.log('E. the sounds library: plain filters, search, Factory/Yours, transport');

  var FACTORY = [
    { name: 'Warm Ballad', description: 'Gentle warmth.', tags: ['use-case:performance', 'genre:Pop', 'vibe:warm'] },
    { name: 'Rock Night', description: 'Cuts through.', tags: ['use-case:performance', 'genre:Rock', 'vibe:bright'] },
    { name: 'Phone Call Gag', description: 'Calling from a phone.', tags: ['gag:telephone', 'use-case:performance'] },
    { name: 'Clean Speech', description: 'Just the voice.', tags: ['use-case:speech/hosting', 'vibe:natural'] },
    { name: 'Big Room', description: 'Arena-sized space.', tags: ['use-case:performance', 'vibe:epic/big'] }
  ];

  function harness(userPresetNames) {
    var loadCalls = [];
    var collaborators = {
      AudioGraph: { getModel: function () { return []; } },
      PresetsUI: {
        getDisplayState: function () { return { name: 'Warm Ballad', modified: false }; },
        loadFactoryPreset: function (name) { loadCalls.push({ kind: 'factory', name: name }); },
        loadUserPreset: function (name) { loadCalls.push({ kind: 'user', name: name }); }
      },
      EffectCatalog: { getPlainLabel: function (t) { return t; }, getLabel: function (t) { return t; } },
      FactoryPresets: { listDetailed: function () { return copy(FACTORY); } },
      PresetStore: { listNames: function () { return (userPresetNames || []).slice(); } }
    };
    var h = makeSimpleViewSandbox(collaborators);
    return {
      h: h,
      loadCalls: loadCalls,
      chips: h.els['simple-library-body'].children[0].children,
      search: h.els['simple-library-body'].children[1],
      cardsList: h.els['simple-library-body'].children[2],
      transport: h.els['simple-transport']
    };
  }

  function groupCards(cardsList, groupLabelText) {
    var rows = cardsList.children;
    var start = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].textContent === groupLabelText && rows[i].className === 'preset-group-label') {
        start = i + 1;
        break;
      }
    }
    if (start === -1) {
      return [];
    }
    var end = rows.length;
    for (var j = start; j < rows.length; j++) {
      if (rows[j].className === 'preset-group-label') {
        end = j;
        break;
      }
    }
    return rows.slice(start, end);
  }

  console.log('  E1: default filter lists every factory entry and any existing user presets');
  var f1 = harness(['My Stage Set', 'Sunday Hosting']);
  check(f1.chips.length === 6, 'E1: five plain filter chips plus the count readout exist (All/Warm/Rock/Funny/Speech + count)');
  check(f1.chips[0].classList.contains('simple-chip-on'), 'E1: All starts active');
  check(f1.chips[5].hidden === true && f1.chips[5].textContent === '',
    'E1: the result count stays hidden when All already shows the full library');
  var factoryRows = groupCards(f1.cardsList, 'Factory');
  check(factoryRows.length === 5, 'E1: All lists every factory entry (' + factoryRows.length + ')');
  check(factoryRows.every(function (row) {
    return row.children[0].children.every(function (child) {
      return child.className !== 'preset-row-tags';
    });
  }), 'E1: Simple cards omit repeated taxonomy tags while search still indexes them');
  var yoursRows = groupCards(f1.cardsList, 'Yours');
  check(yoursRows.length === 2 && yoursRows[0].children[0].children[0].textContent === 'My Stage Set',
    'E1: Yours lists the user\'s own saved sounds');

  console.log('  E2: each plain filter resolves the settled tag, storing nothing new');
  var cases = [
    { label: 'Warm', expectNames: ['Warm Ballad'] },
    { label: 'Rock', expectNames: ['Rock Night'] },
    { label: 'Funny', expectNames: ['Phone Call Gag'] },
    { label: 'Speech', expectNames: ['Clean Speech'] }
  ];
  cases.forEach(function (c) {
    var f = harness([]);
    var chip = f.chips.filter(function (el) { return el.textContent === c.label; })[0];
    chip.fire('click');
    var rows = groupCards(f.cardsList, 'Factory');
    var names = rows.map(function (r) { return r.children[0].children[0].textContent; });
    check(JSON.stringify(names) === JSON.stringify(c.expectNames),
      'E2: "' + c.label + '" resolves to exactly ' + JSON.stringify(c.expectNames) + ' (got ' + JSON.stringify(names) + ')');
    check(chip.classList.contains('simple-chip-on'), 'E2: "' + c.label + '" shows as the active chip');
    check(f.chips[5].hidden === false && f.chips[5].textContent === c.expectNames.length + ' of 5',
      'E2: "' + c.label + '" reveals the narrowed result count only when it adds information');
  });

  console.log('  E3: a filter matching nothing gets a user-facing empty state');
  var f3 = harness([]);
  // No factory entry in this fixture carries a Rock genre AND a warm vibe
  // at once — force an empty result by searching for something no entry's
  // name/description/tags contain.
  f3.search.value = 'xyz-nonexistent';
  f3.search.fire('input');
  var f3Factory = groupCards(f3.cardsList, 'Factory');
  check(f3Factory.length === 1 && f3Factory[0].className === 'preset-list-empty' &&
      f3Factory[0].textContent === 'No factory sounds match your search.',
    'E3: an empty factory result explains that the current search has no matches');

  console.log('  E4: search matches name, description, and tags — Yours included, chips unaffected');
  var f4 = harness(['Warm Ballad Take Two']);
  f4.search.value = 'arena';
  f4.search.fire('input');
  var f4Factory = groupCards(f4.cardsList, 'Factory').map(function (r) { return r.children[0].children[0].textContent; });
  check(JSON.stringify(f4Factory) === JSON.stringify(['Big Room']),
    'E4: searching a description word ("arena") matches by description, not just name');
  f4.search.value = 'warm';
  f4.search.fire('input');
  var f4Yours = groupCards(f4.cardsList, 'Yours').map(function (r) { return r.children[0].children[0].textContent; });
  check(f4Yours.indexOf('Warm Ballad Take Two') !== -1, 'E4: search also narrows Yours (settled #43/#45 spec)');

  console.log('  E5: an empty user namespace adds no empty group to the default library');
  var f5 = harness([]);
  var f5Empty = groupCards(f5.cardsList, 'Yours');
  check(f5Empty.length === 0,
    'E5: Yours stays absent until at least one user preset exists');

  console.log('  E6: a card click "tries" the preset through the shared PresetsUI load path');
  var f6 = harness(['My Stage Set']);
  var f6FactoryRows = groupCards(f6.cardsList, 'Factory');
  f6FactoryRows[0].children[0].fire('click');
  var f6YoursRows = groupCards(f6.cardsList, 'Yours');
  f6YoursRows[0].children[0].fire('click');
  check(
    f6.loadCalls.length === 2 &&
      f6.loadCalls[0].kind === 'factory' && f6.loadCalls[0].name === 'Warm Ballad' &&
      f6.loadCalls[1].kind === 'user' && f6.loadCalls[1].name === 'My Stage Set',
    'E6: Factory cards call loadFactoryPreset, Yours cards call loadUserPreset, with the right name'
  );

  console.log('  E7: the active preset (PresetsUI.getDisplayState) is highlighted in the list');
  var f7 = harness([]);
  var f7Rows = groupCards(f7.cardsList, 'Factory');
  var activeNames = f7Rows.filter(function (r) { return r.classList.contains('preset-row-active'); })
    .map(function (r) { return r.children[0].children[0].textContent; });
  check(JSON.stringify(activeNames) === JSON.stringify(['Warm Ballad']),
    'E7: exactly the current preset (Warm Ballad, from getDisplayState) is marked active');

  console.log('  E8: Previous/Next step the FILTERED factory list, wrap, and load through PresetsUI');
  var f8 = harness([]);
  // All 5 factory entries, current = Warm Ballad (index 0). Next should
  // load index 1 (Rock Night); Previous from index 0 should wrap to the
  // LAST entry (Big Room).
  var buttons = f8.transport.children;
  // The key's WORD is its own text nodes; the direction mark beside it is
  // the app's drawn chevron, not a typed glyph (2026-09-02 typeset round —
  // '\u25c0 Previous' and 'Next \u25b6' were the last two Unicode marks
  // standing in for this icon system, rendering at whatever weight and
  // baseline each platform's symbol fallback picked).
  function keyWord(btn) {
    return btn.children.map(function (c) {
      return c.nodeType === 3 ? c.textContent : '';
    }).join('');
  }
  function keyMark(btn) {
    return btn.children.filter(function (c) {
      return String(c.className || '').indexOf('simple-transport-mark') !== -1;
    })[0] || null;
  }
  check(buttons.length === 3 &&
    keyWord(buttons[0]) === 'Previous' && keyWord(buttons[2]) === 'Next',
    'E8: the transport renders Previous, a position readout, and Next');
  check(!!keyMark(buttons[0]) && !!keyMark(buttons[2]) &&
    keyMark(buttons[0]).children[0].className === 'chain-arrow-mark' &&
    keyMark(buttons[2]).children[0].className === 'chain-arrow-mark' &&
    keyMark(buttons[0]).getAttribute('aria-hidden') === 'true',
    'E8: each transport key carries the board\'s own DRAWN chevron beside its word, aria-hidden');
  check(!/[\u25c0\u25b6\u2192\u2190]/.test(keyWord(buttons[0]) + keyWord(buttons[2])),
    'E8: and no Unicode direction glyph is left standing in for it');
  check(buttons[1].textContent === '1 / 5', 'E8: the position readout is "n of m" over the filtered factory list');
  buttons[2].fire('click');
  check(f8.loadCalls.length === 1 && f8.loadCalls[0].name === 'Rock Night',
    'E8: Next loads the entry right after the current one');
  var f8b = harness([]);
  f8b.transport.children[0].fire('click');
  check(f8b.loadCalls.length === 1 && f8b.loadCalls[0].name === 'Big Room',
    'E8: Previous from the first entry wraps to the last');

  console.log('  E9: fewer than two results disables both transport buttons');
  var f9 = harness([]);
  var warmChip = f9.chips.filter(function (el) { return el.textContent === 'Warm'; })[0];
  warmChip.fire('click');
  check(f9.transport.children[0].disabled === true && f9.transport.children[2].disabled === true,
    'E9: Previous/Next are disabled when the filtered list has fewer than two entries');
  check(f9.transport.children[1].textContent === '1 / 1', 'E9: the single match still reads "1 / 1"');

  console.log('  E10: window.SimpleView.onChainChanged() also refreshes the library (active row + transport position)');
  var f10 = harness([]);
  var displayName = 'Warm Ballad';
  f10.h.window.PresetsUI.getDisplayState = function () { return { name: displayName, modified: false }; };
  displayName = 'Rock Night';
  f10.h.window.SimpleView.onChainChanged();
  var f10Active = groupCards(f10.cardsList, 'Factory').filter(function (r) {
    return r.classList.contains('preset-row-active');
  }).map(function (r) { return r.children[0].children[0].textContent; });
  check(JSON.stringify(f10Active) === JSON.stringify(['Rock Night']),
    'E10: onChainChanged moves the active-row highlight to the new current preset');
  check(f10.transport.children[1].textContent === '2 / 5',
    'E10: onChainChanged updates the transport position too (' + f10.transport.children[1].textContent + ')');
})();

// ==========================================================================
// F. src/chain-editing.js's real markAcceptedEdit() reaches SimpleView.
// ==========================================================================

(function sectionF() {
  console.log('F. every accepted edit mode notifies window.SimpleView.onChainChanged');

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

// ==========================================================================
// G. SAVE THIS SOUND + THE SECONDARY MENU (wayfinder #49) — unsaved-sound
//    detection, the naming row, and the Yours card's Delete-behind-menu.
// ==========================================================================

(function sectionG() {
  console.log('G. Save this sound and the secondary menu');

  function harness(displayState, presetStoreOverrides) {
    var saveCalls = [];
    var deleteCalls = [];
    var deleteReturns = [];
    var collaborators = {
      AudioGraph: { getModel: function () { return [node('a', 'gain', {})]; } },
      PresetsUI: {
        getDisplayState: function () { return displayState; },
        saveCurrentChainAs: function (name) {
          saveCalls.push(name);
          return (presetStoreOverrides && presetStoreOverrides.saveResult) || { ok: true, name: name };
        },
        toggleDeleteArm: function (btn, name) {
          deleteCalls.push(name);
          return deleteReturns.length ? deleteReturns.shift() : false;
        }
      },
      EffectCatalog: { getPlainLabel: function (t) { return t; }, getLabel: function (t) { return t; } },
      FactoryPresets: { listDetailed: function () { return []; } },
      PresetStore: { listNames: function () { return ['My Stage Set']; } }
    };
    var h = makeSimpleViewSandbox(collaborators);
    return {
      h: h,
      saveCalls: saveCalls,
      deleteCalls: deleteCalls,
      queueDeleteReturn: function (v) { deleteReturns.push(v); },
      saveBtn: h.els['simple-save-btn'],
      saveRow: h.els['simple-save-row']
    };
  }

  console.log('  G1: "Save this sound" visibility follows isUnsaved (modified OR unnamed)');
  var clean = harness({ name: 'Warm Ballad', modified: false });
  check(clean.saveBtn.hidden === true, 'G1: a clean, named preset hides Save this sound');

  var modifiedState = harness({ name: 'Warm Ballad', modified: true });
  check(modifiedState.saveBtn.hidden === false, 'G1: a modified preset shows Save this sound');

  var customState = harness({ name: null, modified: false });
  check(customState.saveBtn.hidden === false, 'G1: an unnamed (Custom sound) chain shows Save this sound');

  console.log('  G2: the button opens a naming row pre-filled with the current name');
  var g2 = harness({ name: 'Warm Ballad', modified: true });
  g2.saveBtn.fire('click');
  check(g2.saveRow.hidden === false, 'G2: clicking Save this sound opens the naming row');
  var input = g2.saveRow.children[1];
  check(input.value === 'Warm Ballad', 'G2: the input is pre-filled with the sound\'s current name');

  console.log('  G3: confirming submits through PresetsUI.saveCurrentChainAs and closes on success');
  input.value = 'My Warm Take';
  var confirmBtn = g2.saveRow.children[2].children[0];
  confirmBtn.fire('click');
  check(g2.saveCalls.length === 1 && g2.saveCalls[0] === 'My Warm Take',
    'G3: Save submits the input\'s current value through saveCurrentChainAs');
  check(g2.saveRow.hidden === true, 'G3: a successful save closes the naming row');

  console.log('  G4: Enter confirms, Escape cancels, a failure keeps the row open with a note');
  var g4 = harness({ name: null, modified: false }, { saveResult: { ok: false, message: 'Give the preset a name first.' } });
  g4.saveBtn.fire('click');
  var g4Input = g4.saveRow.children[1];
  g4Input.value = '';
  g4Input.fire('keydown', { key: 'Enter' });
  check(g4.saveCalls.length === 1, 'G4: Enter submits the row exactly like clicking Save');
  check(g4.saveRow.hidden === false, 'G4: a failed save keeps the naming row open (so the operator can retry)');
  var noteEl = g4.saveRow.children[3];
  check(noteEl.hidden === false && noteEl.textContent === 'Give the preset a name first.',
    'G4: the failure message shows in the row\'s own note');

  var g4b = harness({ name: null, modified: false });
  g4b.saveBtn.fire('click');
  g4b.saveRow.children[1].fire('keydown', { key: 'Escape' });
  check(g4b.saveRow.hidden === true && g4b.saveCalls.length === 0,
    'G4: Escape cancels without ever calling saveCurrentChainAs');

  console.log('  G5: a Yours card shows the quiet secondary-menu toggle, not a directly-visible Delete');
  var g5 = harness({ name: null, modified: false });
  // Factory is empty in this fixture, so cardsList children are:
  // [0]=Factory label, [1]=factory empty note, [2]=Yours label, [3]=My Stage Set row
  var cardsList = g5.h.els['simple-library-body'].children[2];
  check(cardsList.children[0].textContent === 'Factory', 'G5: sanity — Factory group label is first');
  var myStageSetRow = cardsList.children[3];
  check(myStageSetRow.children.length === 2, 'G5: a Yours row carries Try + exactly one secondary control');
  var secondSlot = myStageSetRow.children[1];
  check(secondSlot.className === 'simple-card-menu-toggle',
    'G5: the second slot starts as the quiet menu toggle, not a Delete label');
  check(secondSlot.textContent !== 'Delete',
    'G5: Delete does not compete directly with Try — it is not the visible label');

  console.log('  G6: opening the menu swaps the toggle for the real Delete button in the SAME slot');
  secondSlot.fire('click');
  var reRenderedRow = g5.h.els['simple-library-body'].children[2].children[3];
  var deleteSlot = reRenderedRow.children[1];
  check(deleteSlot.className === 'preset-row-delete' && deleteSlot.textContent === 'Delete',
    'G6: the same row now shows a real Delete button in the second slot');

  console.log('  G7: Delete submits through the shared toggleDeleteArm, and only a confirmed delete refreshes the list');
  g5.queueDeleteReturn(false); // arm step
  deleteSlot.fire('click');
  check(g5.deleteCalls.length === 1 && g5.deleteCalls[0] === 'My Stage Set',
    'G7: Delete calls toggleDeleteArm with the right name');
  var stillFourChildren = g5.h.els['simple-library-body'].children[2].children.length === 4;
  check(stillFourChildren, 'G7: an arm-only click (false) leaves the list exactly as it was — no premature rebuild');

  console.log('  G8: a confirmed delete (true) rebuilds the list');
  var g8 = harness({ name: null, modified: false });
  var g8CardsList = g8.h.els['simple-library-body'].children[2];
  g8CardsList.children[3].children[1].fire('click'); // open the menu
  var g8DeleteBtn = g8.h.els['simple-library-body'].children[2].children[3].children[1];
  g8.queueDeleteReturn(true); // confirmed delete
  g8DeleteBtn.fire('click');
  check(g8.deleteCalls.length === 1, 'G8: the confirming click also goes through toggleDeleteArm');
  // The mock PresetStore.listNames() is static in this harness (always
  // returns ['My Stage Set']), so a real deletion elsewhere would not
  // reflect here — what this proves is that a TRUE return triggers
  // renderLibraryList() at all, observable as the card menu state
  // resetting (a fresh render always starts a Yours row back at the
  // quiet toggle, never a leftover armed Delete button).
  var g8Row = g8.h.els['simple-library-body'].children[2].children[3];
  check(g8Row.children[1].className === 'simple-card-menu-toggle',
    'G8: a confirmed delete rebuilds the list, resetting the row back to its quiet toggle');

  console.log('  G9: deleting the CURRENTLY DISPLAYED sound refreshes the stage name too');
  // Regression case found live in-browser: toggleDeleteArm's real
  // implementation calls PresetsUI.setCurrentPreset(null) when the
  // deleted preset is the one on stage, but never touches
  // ChainEditing — the one write path that reaches PresetsUI's display
  // state WITHOUT passing through markAcceptedEdit()'s SimpleView
  // notify. A plain renderLibraryList() after a confirmed delete looked
  // sufficient (G8's own checks above still pass with it) but silently
  // left the stage name showing the just-deleted preset.
  var displayState = { name: 'My Stage Set', modified: false };
  var g9Collaborators = {
    AudioGraph: { getModel: function () { return [node('a', 'gain', {})]; } },
    PresetsUI: {
      getDisplayState: function () { return displayState; },
      toggleDeleteArm: function () {
        displayState = { name: null, modified: false }; // setCurrentPreset(null)'s real effect
        return true;
      }
    },
    EffectCatalog: { getPlainLabel: function (t) { return t; }, getLabel: function (t) { return t; } },
    FactoryPresets: { listDetailed: function () { return []; } },
    PresetStore: { listNames: function () { return ['My Stage Set']; } }
  };
  var g9 = makeSimpleViewSandbox(g9Collaborators);
  check(g9.els['simple-cs-name'].textContent === 'My Stage Set', 'G9: starts showing the about-to-be-deleted sound\'s name');
  var g9CardsList = g9.els['simple-library-body'].children[2];
  // Factory empty note takes slot 1 in this fixture too — Yours starts
  // at slot 3, same layout G8 already established.
  g9CardsList.children[3].children[1].fire('click'); // open the menu
  var g9DeleteBtn = g9.els['simple-library-body'].children[2].children[3].children[1];
  g9DeleteBtn.fire('click'); // confirming click -> toggleDeleteArm returns true above
  check(g9.els['simple-cs-name'].textContent === 'Custom sound',
    'G9: the stage name updates to "Custom sound" in the SAME tick the deletion completes');

  // No process.exit() here, deliberately: section G is fully synchronous
  // and runs to completion in the SAME tick as section F's own
  // synchronous portion, before F's awaited ChainEditing.apply() calls
  // ever resolve. Exiting here would end the process before F's checks
  // (queued on the microtask queue) get a chance to run at all. Section
  // F's own async completion — the ONLY async work in this file — stays
  // the one place that reads the shared `failures` array and exits.
})();
