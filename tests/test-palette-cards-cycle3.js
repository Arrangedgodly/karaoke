// Test for cycle-3 UI-2 — palette/card integration for the four shelved
// effects (distortion, chorus, noise gate, autotune) + the formal
// experimental-badge component.
//
// UI-2's scope is render-level: with all four node modules landed and
// registered, this verifies the REAL src/canvas.js against the REAL
// registrations (all ten src/node-*.js files loaded into a vm sandbox,
// same order as index.html) + the REAL src/param-controls.js:
//   A. REGISTRY: the four types are registered with the cycle-3 labels,
//      and the palette renders one chip per registered type (10 today)
//      in index.html's registration order.
//   B. CHIPS: each new type's chip is a real <button> (R2-2 keyboard/SR
//      semantics) with the family/initials hooks (VIS-3), the
//      action-phrase aria-label, and ships disabled pre-Start; the
//      autotune aria-label carries the experimental status pre-add.
//   C. CHIP BADGE: the compact 'EXP' tag renders on the autotune chip
//      only (none of the other nine).
//   D. KEYBOARD ADD (R2-2 pattern): onEngineStarted() enables the chips;
//      firing a chip's click (Enter/Space twin of a drag-add) builds a
//      real card per type, commits through the structural chokepoint
//      (buildGraph + autosave + markModified + noteHumanEdit), and the
//      keyboard-add placement policy keeps a terminal limiter terminal.
//   E. CARDS: per new type — family edge hooks, header anatomy (grip
//      aria-hidden, label, collapse + remove aria-labels), params
//      wrapped for the VIS-7 collapse (one row per paramSpec entry,
//      autotune's Key/Scale as UI-1 <select>s with 12/3 options), and
//      the inherited collapse toggle flipping .collapsed + aria-expanded.
//   F. CARD BADGE: the full 'Experimental' tag on the autotune card only
//      — absent from the other three new cards and every existing type.
//   G. LOADMODEL: preset/autosave restore rebuilds all four cards with
//      exact ids + params (autotune selects restored to saved values).
//   H. HELP LAYER (finishing entry 1, critique P2-1): every param row of
//      ALL TEN types — the four cycle-3 families included — carries the
//      plain-language line exactly the way the cycle-2 layer wires it
//      (row + control title, .sr-only span, same-row aria-describedby);
//      autotune's Key line additionally carries the experimental-status +
//      fixed-20-ms-delay disclosure in operator terms.
//   I. TYPE FLOOR (finishing entry 2, critique P2-2): the experimental
//      badge's ONE shared CSS rule renders BOTH placements (chip 'EXP' +
//      card 'Experimental') at the 11px floor — 0.6875rem, the
//      legend-initials size — with no chip-scoped size override, the
//      quiet tag treatment intact (700 / 0.06em / widened side padding),
//      and all three documentation sources (main.css, DESIGN.md,
//      .impeccable/design.json) agreeing on the corrected value.
//   J. GROUPING (finishing entry 3, critique P2-3): the ten chips chunk
//      under three non-interactive silkscreen <h3> group headers in
//      operator language (shape/polish/safe), interleaved in the FLAT
//      palette list — chips stay direct-children <button>s in DOM order
//      (R2-2 SR flow intact), within-group order stays registration
//      order, every chip remains operative (keyboard add still commits
//      through the shared chokepoint from EACH group), the limiter chip
//      is byte-for-byte the chip it always was, the header rule in
//      main.css matches the optgroup legend register (0.7rem / 700 /
//      uppercase / 0.08em / muted — above the 11px floor), and the
//      palette Sortable scopes its drag items to '.node-chip' so a
//      header can never be grabbed.
//   K. READOUT CONVENTION (finishing entry 4, critique P3-4): distortion
//      Drive/Tone read on the surface's 0-100 % convention ("25%"/"70%",
//      same string shape as Mix "30%") while the slider, the committed
//      model value, the loadModel/preset restore, and the agent
//      set_param canvas half (updateNodeParam) all keep the internal
//      0..1 scale exactly as registered — plus a registry-wide gate (a
//      0..1 % param MUST declare displayScale 100; a 0-100 % param MUST
//      NOT) and a rendered ten-type sweep for any "0.X%" readout.
//
// Browser-use inspection was not exercised in this worker (same honest
// note as TEST-1/UI-1/DIST-1/...): these are DOM-construction checks on
// the real source files — the visual result (badge placement, family
// edge colors) is user-judged at QA-1 alongside the audio bar.
//
// Same committed-test convention as the rest of the suite: zero-dependency
// Node harness, stub `window` + minimal DOM, load the REAL src files
// (fs.readFileSync + vm.runInContext).
//
// Run from a clean clone:  node tests/test-palette-cards-cycle3.js
// (or via the runner:      node tests/run.js palette-cards)
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

// ----------------------------------------------------------------------
// Minimal fake DOM — only what canvas.js + param-controls.js touch.
// textContent is DOM-honest on read (own text + descendants), so a chip
// carrying a badge child reads 'AutotuneEXP' exactly like the real DOM.
// ----------------------------------------------------------------------
function FakeElement(tagName) {
  this.tagName = String(tagName).toUpperCase();
  this.children = [];
  this.listeners = {};
  this.className = '';
  this.id = '';
  this.type = '';
  this.value = '';
  this.title = '';
  this.disabled = false;
  this.style = {};
  this.attrs = {};
  this.parentNode = null;
  this._text = '';
  var self = this;

  this.classList = {
    add: function (c) {
      if (!self.classList.contains(c)) {
        self.className = (self.className ? self.className + ' ' : '') + c;
      }
    },
    remove: function (c) {
      var parts = self.className.split(/\s+/).filter(function (p) {
        return p && p !== c;
      });
      self.className = parts.join(' ');
    },
    toggle: function (c) {
      if (self.classList.contains(c)) {
        self.classList.remove(c);
        return false;
      }
      self.classList.add(c);
      return true;
    },
    contains: function (c) {
      return self.className.split(/\s+/).indexOf(c) !== -1;
    }
  };
}

Object.defineProperty(FakeElement.prototype, 'textContent', {
  get: function () {
    return this._text +
      this.children.map(function (c) { return c.textContent; }).join('');
  },
  set: function (v) {
    this._text = String(v);
    this.children = [];
  }
});

Object.defineProperty(FakeElement.prototype, 'innerHTML', {
  get: function () { return ''; },
  set: function () {
    this.children = [];
    this._text = '';
  }
});

// DOM-honest MOVE semantics: appending/inserting a node that already has
// a parent first removes it from that parent (canvas.js's VIS-7
// wrap-AFTER-render moves the param rows exactly this way).
function detachFromParent(child) {
  if (child.parentNode) {
    var siblings = child.parentNode.children;
    var idx = siblings.indexOf(child);
    if (idx !== -1) {
      siblings.splice(idx, 1);
    }
  }
}

FakeElement.prototype.appendChild = function (child) {
  detachFromParent(child);
  child.parentNode = this;
  this.children.push(child);
  return child;
};

FakeElement.prototype.insertBefore = function (child, ref) {
  detachFromParent(child);
  child.parentNode = this;
  var idx = ref ? this.children.indexOf(ref) : -1;
  if (idx === -1) {
    this.children.push(child);
  } else {
    this.children.splice(idx, 0, child);
  }
  return child;
};

FakeElement.prototype.setAttribute = function (name, val) {
  this.attrs[name] = String(val);
};

FakeElement.prototype.getAttribute = function (name) {
  return Object.prototype.hasOwnProperty.call(this.attrs, name)
    ? this.attrs[name]
    : null;
};

FakeElement.prototype.addEventListener = function (evt, fn) {
  (this.listeners[evt] = this.listeners[evt] || []).push(fn);
};

var STUB_EVENT = {
  stopPropagation: function () {},
  preventDefault: function () {}
};

FakeElement.prototype.fire = function (evt, ev) {
  var args = Array.prototype.slice.call(arguments, 2);
  (this.listeners[evt] || []).forEach(function (fn) {
    fn(ev || STUB_EVENT, args);
  });
};

// Class-selector query over the subtree (canvas.js uses '.node-card' /
// '.node-chip' / '.node-collapse' — simple class selectors only).
FakeElement.prototype.querySelectorAll = function (sel) {
  var cls = sel.replace(/^\./, '');
  var out = [];
  this.children.forEach(function (child) {
    if (child.className.split(/\s+/).indexOf(cls) !== -1) {
      out.push(child);
    }
    out = out.concat(child.querySelectorAll(sel));
  });
  return out;
};

FakeElement.prototype.findByClass = function (cls) {
  var found = null;
  this.children.some(function (child) {
    if (child.className.split(/\s+/).indexOf(cls) !== -1) {
      found = child;
      return true;
    }
    found = child.findByClass(cls);
    return !!found;
  });
  return found;
};

var paletteListEl = new FakeElement('div');
var chainListEl = new FakeElement('div');
var emptyHintEl = new FakeElement('div');
var layoutEl = new FakeElement('div');

var documentStub = {
  createElement: function (tag) { return new FakeElement(tag); },
  getElementById: function (id) {
    if (id === 'palette-list') { return paletteListEl; }
    if (id === 'chain-list') { return chainListEl; }
    if (id === 'empty-hint') { return emptyHintEl; }
    if (id === 'chain-layout') { return layoutEl; }
    return null;
  }
  // Deliberately NO document.querySelector (canvas.js's flow toggle
  // early-returns without it) and NO document.addEventListener (the
  // agent-pulse wiring is a guarded typeof check) — both paths are
  // covered by their own tasks and are out of UI-2's scope here.
};

// ----------------------------------------------------------------------
// Stub collaborators + call log.
// ----------------------------------------------------------------------
var calls = {
  buildGraph: [],
  persist: [],
  markModified: 0,
  noteHumanEdit: 0,
  registeredTypes: []
};

function snapshotModel(model) {
  return model.map(function (e) {
    return { id: e.id, type: e.type, params: Object.assign({}, e.params) };
  });
}

var windowStub = {
  document: documentStub,

  // AudioGraph stub: registration is recorded (the real graph builder is
  // the node tasks' own test subject); buildGraph captures the model each
  // structural commit sends.
  AudioGraph: {
    registerNodeType: function (type) { calls.registeredTypes.push(type); },
    buildGraph: function (model) { calls.buildGraph.push(snapshotModel(model)); },
    updateNodeParams: function () {},
    getNodeInstance: function () { return { marker: 'fake-live-node' }; }
  },
  AudioParamRamp: { schedule: function () {} },
  AudioEngine: { isStarted: true },
  Persistence: {
    saveCurrentChain: function (model) { calls.persist.push(snapshotModel(model)); }
  },
  PresetsUI: {
    markModified: function () { calls.markModified += 1; }
  },
  AgentUI: {
    noteHumanEdit: function () { calls.noteHumanEdit += 1; }
  },
  Sortable: function SortableStub(el, opts) {
    SortableStub.instances.push({ el: el, opts: opts });
  }
};
windowStub.Sortable.instances = [];

var sandbox = {
  window: windowStub,
  document: documentStub,
  console: console
};
sandbox.window.window = windowStub;
vm.createContext(sandbox);

// node-reverb.js kicks off its IR fetch at LOAD time; a forever-pending
// promise keeps it inert in the harness (no unhandled rejection, and the
// reverb factory is never built here anyway — this test renders cards,
// not audio). Set on the CONTEXT object (bare `fetch(...)` inside the
// vm resolves against it) and on window for symmetry.
sandbox.fetch = function () {
  return new Promise(function () {});
};
windowStub.fetch = sandbox.fetch;

function loadSrc(file) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src', file), 'utf8'),
    sandbox,
    { filename: file }
  );
}

// ----------------------------------------------------------------------
// Load the real sources — same order as index.html's <script> tags:
// registries first, then all TEN node modules (so the palette below is
// the production palette, not a synthetic subset), then param-controls,
// then canvas itself.
// ----------------------------------------------------------------------
loadSrc('node-types.js');
loadSrc('param-controls.js');
loadSrc('node-gain.js');
loadSrc('node-compressor.js');
loadSrc('node-eq.js');
loadSrc('node-delay.js');
loadSrc('node-reverb.js');
loadSrc('node-limiter.js');
loadSrc('node-distortion.js');
loadSrc('node-chorus.js');
loadSrc('node-gate.js');
loadSrc('node-autotune.js');
loadSrc('canvas.js');

var NEW_TYPES = [
  { type: 'distortion', label: 'Distortion', initials: 'DI', params: 3 },
  { type: 'chorus', label: 'Chorus', initials: 'CH', params: 3 },
  { type: 'gate', label: 'Noise Gate', initials: 'NG', params: 4 },
  // experimental: true -> the chip/card badge + the aria-label status
  // suffix (cycle-3 scope: autotune only).
  { type: 'autotune', label: 'Autotune', initials: 'AU', params: 4, experimental: true }
];

function chipFor(type) {
  var found = null;
  paletteListEl.children.some(function (chip) {
    if (chip.attrs['data-node-type'] === type) {
      found = chip;
      return true;
    }
    return false;
  });
  return found;
}

function cards() {
  return chainListEl.querySelectorAll('.node-card');
}

// ----------------------------------------------------------------------
// A. Registry + palette construction.
// ----------------------------------------------------------------------
console.log('A. registry + palette');

var allTypes = windowStub.NodeTypes.getAllTypes();
check(allTypes.length === 10, 'ten node types registered (6 existing + 4 new)');
NEW_TYPES.forEach(function (t) {
  check(allTypes.indexOf(t.type) !== -1, t.type + ' is registered');
  check(
    windowStub.NodeTypes.getLabel(t.type) === t.label,
    t.type + ' label is "' + t.label + '"'
  );
});
check(
  allTypes.join(',') ===
    'gain,compressor,eq,delay,reverb,limiter,distortion,chorus,gate,autotune',
  'registration order matches index.html script order (within-group chip order)'
);
check(
  paletteListEl.querySelectorAll('.node-chip').length === 10,
  'palette renders one chip per registered type (10)'
);
check(
  paletteListEl.children.length === 13,
  'flat palette list carries 10 chips + 3 group headers as direct children'
);
check(
  windowStub.Sortable.instances.length === 2,
  'both SortableJS instances wired (palette + chain)'
);

// ----------------------------------------------------------------------
// B. Chips — button semantics, family hooks, aria-labels, pre-Start gate.
// ----------------------------------------------------------------------
console.log('B. palette chips');

NEW_TYPES.forEach(function (t) {
  var chip = chipFor(t.type);
  check(!!chip, t.type + ' has a palette chip');
  if (!chip) { return; }
  check(
    chip.tagName === 'BUTTON' && chip.type === 'button',
    t.type + ' chip is a real <button type="button"> (keyboard + SR)'
  );
  check(chip.className === 'node-chip', t.type + ' chip carries .node-chip');
  check(
    chip.attrs['data-family'] === t.type,
    t.type + ' chip data-family maps its family token (' + t.type + ')'
  );
  check(
    chip.attrs['data-initials'] === t.initials,
    t.type + ' chip silkscreen initials are "' + t.initials + '"'
  );
  check(
    chip.attrs['aria-label'] === 'Add ' + t.label + ' to chain' +
      (t.experimental ? ' (experimental)' : ''),
    t.type + ' chip aria-label is the R2-2 action phrase' +
      (t.experimental ? ' + experimental status' : '')
  );
  check(
    chip.disabled === true,
    t.type + ' chip ships disabled pre-Start (gating pattern)'
  );
});

var autotuneChip = chipFor('autotune');
check(
  autotuneChip.attrs['aria-label'] === 'Add Autotune to chain (experimental)',
  'autotune chip aria-label carries the experimental status pre-add'
);
check(
  chipFor('gain').attrs['aria-label'] === 'Add Gain to chain' &&
    chipFor('gain').findByClass('node-experimental-badge') === null,
  'existing types keep the plain aria-label (no status, no badge)'
);

// ----------------------------------------------------------------------
// C. Chip badge — compact EXP tag, autotune only.
// ----------------------------------------------------------------------
console.log('C. chip badge');

var autotuneChipBadge = autotuneChip.findByClass('node-experimental-badge');
check(
  !!autotuneChipBadge,
  'autotune chip carries the .node-experimental-badge tag'
);
check(
  autotuneChipBadge && autotuneChipBadge.textContent === 'EXP',
  'chip badge is the compact "EXP" abbreviation'
);
check(
  autotuneChipBadge && /experimental/.test(autotuneChipBadge.title),
  'chip badge title explains the status'
);
['distortion', 'chorus', 'gate', 'gain', 'limiter'].forEach(function (type) {
  check(
    chipFor(type).findByClass('node-experimental-badge') === null,
    type + ' chip has NO badge'
  );
});

// ----------------------------------------------------------------------
// D. Keyboard add — the R2-2 path, per new type.
// ----------------------------------------------------------------------
console.log('D. keyboard add');

windowStub.ChainCanvas.onEngineStarted();
check(
  paletteListEl.querySelectorAll('.node-chip')
    .every(function (chip) { return chip.disabled === false; }),
  'onEngineStarted() enables every chip across all three groups (keyboard path goes live)'
);
check(
  emptyHintEl.textContent ===
    'Drag an effect here to start building your chain',
  'empty-hint copy flips at the Start transition'
);

var persistBefore = calls.persist.length;
var graphBefore = calls.buildGraph.length;
var modifiedBefore = calls.markModified;
var humanBefore = calls.noteHumanEdit;

NEW_TYPES.forEach(function (t) {
  chipFor(t.type).fire('click');
});

var builtCards = cards();
check(builtCards.length === 4, 'four keyboard adds built four cards');
check(
  builtCards.map(function (c) { return c.attrs['data-family']; })
    .join(',') === 'distortion,chorus,gate,autotune',
  'cards land in click order (append policy, no terminal limiter present)'
);
check(
  calls.buildGraph.length === graphBefore + 4,
  'one buildGraph commit per keyboard add (shared structural chokepoint)'
);
check(
  calls.buildGraph[calls.buildGraph.length - 1][3].type === 'autotune',
  'last structural commit carries the autotune entry'
);
check(
  calls.persist.length === persistBefore + 4 &&
    calls.persist[calls.persist.length - 1].length === 4,
  'each keyboard add autosaves the chain (PS-2)'
);
check(
  calls.markModified === modifiedBefore + 4,
  'each keyboard add marks unsaved (PS-3)'
);
check(
  calls.noteHumanEdit === humanBefore + 4,
  'each keyboard add bumps the human-edit revision (Issue #6)'
);

// ----------------------------------------------------------------------
// E. Cards — anatomy, params + collapse inherited.
// ----------------------------------------------------------------------
console.log('E. cards + collapse');

NEW_TYPES.forEach(function (t) {
  var card = builtCards.filter(function (c) {
    return c.attrs['data-family'] === t.type;
  })[0];
  check(!!card, t.type + ' card is in the chain');
  if (!card) { return; }
  check(
    card.className.split(/\s+/).indexOf('node-card') !== -1 &&
      !!card.attrs['data-node-id'],
    t.type + ' card has .node-card + a minted data-node-id'
  );
  check(
    card.attrs['data-initials'] === t.initials,
    t.type + ' card edge-codes initials "' + t.initials + '"'
  );

  var header = card.children[0];
  var handle = header.children[0];
  var grip = handle.children[0];
  var labelEl = handle.children[1];
  check(
    grip.className === 'node-drag-icon' &&
      grip.attrs['aria-hidden'] === 'true',
    t.type + ' grip icon is aria-hidden decoration'
  );
  check(
    labelEl.className === 'node-label' && labelEl.textContent === t.label,
    t.type + ' card label reads "' + t.label + '"'
  );

  var collapseBtn = header.children[1];
  var removeBtn = header.children[2];
  check(
    collapseBtn.tagName === 'BUTTON' &&
      collapseBtn.className === 'node-collapse' &&
      collapseBtn.attrs['aria-expanded'] === 'true',
    t.type + ' collapse button is a real button, aria-expanded true'
  );
  check(
    collapseBtn.attrs['aria-label'] ===
      'Toggle parameters for ' + t.label,
    t.type + ' collapse aria-label names the module'
  );
  check(
    removeBtn.attrs['aria-label'] === 'Remove ' + t.label,
    t.type + ' remove aria-label names the module'
  );

  // Params: VIS-7 wrap present, one row per paramSpec entry, at spec
  // defaults; autotune's Key/Scale are UI-1 selects.
  var paramsEl = card.children[1];
  var inner = paramsEl.children[0];
  check(
    paramsEl.className === 'node-params' &&
      inner.className === 'node-params-inner' &&
      paramsEl.children.length === 1,
    t.type + ' params wrapped for the collapse boundary (.node-params-inner)'
  );
  var spec = windowStub.NodeTypes.getParamSpec(t.type);
  check(
    inner.children.length === t.params && spec.length === t.params,
    t.type + ' renders one row per paramSpec entry (' + t.params + ')'
  );
  inner.children.forEach(function (row, i) {
    var control = row.children[1];
    var expected = spec[i].default;
    check(
      control.value === expected,
      t.type + ' "' + spec[i].id + '" control starts at spec default (' +
        expected + ')'
    );
    check(
      row.children[0].attrs['for'] === control.id,
      t.type + ' "' + spec[i].id + '" label[for] binds the control (SR name)'
    );
  });

  // Collapse inherited: toggle hides params (class + aria state; the
  // visual 0fr collapse is CSS driven by exactly this class).
  collapseBtn.fire('click');
  check(
    card.classList.contains('collapsed') &&
      collapseBtn.attrs['aria-expanded'] === 'false',
    t.type + ' collapse toggle collapses the card + mirrors aria-expanded'
  );
  collapseBtn.fire('click');
  check(
    !card.classList.contains('collapsed') &&
      collapseBtn.attrs['aria-expanded'] === 'true',
    t.type + ' collapse toggle re-expands the card'
  );
});

// Autotune specifics: Key/Scale rows are the UI-1 discrete selects with
// the full 12-key / 3-scale option sets, restored on the card.
var autotuneCard = builtCards.filter(function (c) {
  return c.attrs['data-family'] === 'autotune';
})[0];
var atInner = autotuneCard.children[1].children[0];
var keySelect = atInner.children[0].children[1];
var scaleSelect = atInner.children[1].children[1];
check(
  keySelect.tagName === 'SELECT' && keySelect.children.length === 12,
  'autotune Key row renders the UI-1 select with all 12 keys'
);
check(
  scaleSelect.tagName === 'SELECT' && scaleSelect.children.length === 3,
  'autotune Scale row renders the UI-1 select with 3 scales'
);
check(
  keySelect.value === 'C' && scaleSelect.value === 'Chromatic',
  'autotune selects start at the registered defaults (C / Chromatic)'
);

// ----------------------------------------------------------------------
// F. Card badge — full tag, autotune only.
// ----------------------------------------------------------------------
console.log('F. card badge');

var autotuneBadge = autotuneCard.findByClass('node-experimental-badge');
check(
  !!autotuneBadge,
  'autotune card carries the .node-experimental-badge component'
);
check(
  autotuneBadge && autotuneBadge.textContent === 'Experimental',
  'card badge text is "Experimental" (SR-visible by content, not title-only)'
);
check(
  autotuneBadge && /Autotune is experimental/.test(autotuneBadge.title),
  'card badge title names the module and the reason'
);
check(
  autotuneBadge && autotuneBadge.parentNode.className === 'node-drag-handle',
  'card badge sits in the header handle, after the module label'
);
var badgeCount = cards().filter(function (c) {
  return c.findByClass('node-experimental-badge') !== null;
}).length;
check(
  badgeCount === 1,
  'exactly one of the four cards carries a badge (autotune only)'
);
['distortion', 'chorus', 'gate'].forEach(function (type) {
  var card = builtCards.filter(function (c) {
    return c.attrs['data-family'] === type;
  })[0];
  check(
    card.findByClass('node-experimental-badge') === null,
    type + ' card has NO badge'
  );
});

// ----------------------------------------------------------------------
// G. loadModel — preset/autosave restore of all four types.
// ----------------------------------------------------------------------
console.log('G. loadModel restore');

windowStub.ChainCanvas.loadModel([
  { id: 'x1', type: 'distortion', params: { drive: 0.5, tone: 0.5, output: -6 } },
  { id: 'x2', type: 'chorus', params: { depthMs: 5, rateHz: 2, mix: 60 } },
  { id: 'x3', type: 'gate', params: { threshold: -40, attack: 0.01, release: 0.2, floor: -30 } },
  { id: 'x4', type: 'autotune', params: { key: 'A', scale: 'Minor', retune: 120, mix: 80 } }
]);

var restored = cards();
check(restored.length === 4, 'loadModel rebuilds four cards');
check(
  restored.map(function (c) { return c.attrs['data-node-id']; })
    .join(',') === 'x1,x2,x3,x4',
  'restored cards keep their exact saved ids'
);
check(
  restored[3].findByClass('node-experimental-badge') !== null &&
    restored[0].findByClass('node-experimental-badge') === null &&
    restored[1].findByClass('node-experimental-badge') === null &&
    restored[2].findByClass('node-experimental-badge') === null,
  'badge presence follows the type through a load (autotune only)'
);
var restoredKey = restored[3].children[1].children[0].children[0].children[1];
var restoredScale = restored[3].children[1].children[0].children[1].children[1];
check(
  restoredKey.value === 'A' && restoredScale.value === 'Minor',
  'autotune selects restore saved Key/Scale (A / Minor)'
);
var lastPersist = calls.persist[calls.persist.length - 1];
check(
  lastPersist.length === 4 && lastPersist[3].params.key === 'A',
  'loadModel persists the restored model as the new autosave baseline'
);

// Keyboard-add placement policy with a terminal limiter: the new-type add
// inserts BEFORE the limiter (the safe-output invariant).
windowStub.ChainCanvas.loadModel([{ id: 'L', type: 'limiter', params: {} }]);
chipFor('autotune').fire('click');
var afterAdd = cards();
check(
  afterAdd.length === 2 &&
    afterAdd[0].attrs['data-family'] === 'autotune' &&
    afterAdd[1].attrs['data-family'] === 'limiter',
  'keyboard autotune add inserts before the terminal limiter'
);

// ----------------------------------------------------------------------
// H. Help layer (finishing entry 1, critique P2-1) — the four cycle-3
// families join the cycle-2 plain-language layer through the IDENTICAL
// mechanism: render all ten types via loadModel, then verify every param
// row for title wiring + the clip-hidden .sr-only description span +
// same-row aria-describedby resolution. This doubles as the completeness
// gate the closing critique asked about: a param row without help fails
// here, so a future family can never silently ship without its lines.
// ----------------------------------------------------------------------
console.log('H. param help layer (finishing entry 1)');

windowStub.ChainCanvas.loadModel(
  allTypes.map(function (type, i) {
    return { id: 'h' + i, type: type, params: {} };
  })
);
var helpCards = cards();
check(helpCards.length === 10, 'help-layer render builds all ten cards');

var helpRowCount = 0;
helpCards.forEach(function (card) {
  var type = card.attrs['data-family'];
  var nodeId = card.attrs['data-node-id'];
  var inner = card.children[1].children[0];
  var spec = windowStub.NodeTypes.getParamSpec(type);
  inner.children.forEach(function (row, i) {
    helpRowCount += 1;
    var control = row.children[1];
    var helpSpan = row.children[3];
    check(
      !!helpSpan &&
        helpSpan.className === 'sr-only' &&
        helpSpan.textContent.length > 0,
      type + ' "' + spec[i].id + '" row carries a non-empty .sr-only help span'
    );
    check(
      helpSpan && helpSpan.id === 'param-help-' + nodeId + '-' + spec[i].id,
      type + ' "' + spec[i].id + '" help span id is the row-scoped convention'
    );
    check(
      row.title === helpSpan.textContent && control.title === helpSpan.textContent,
      type + ' "' + spec[i].id + '" title set on row AND control with the same line'
    );
    check(
      control.attrs['aria-describedby'] === helpSpan.id,
      type + ' "' + spec[i].id + '" aria-describedby resolves to the same-row span'
    );
  });
});
check(helpRowCount === 28, '28 param rows across all ten types, every one helped (14 original + 14 cycle-3)');

// The critique-named risky controls are outcome-framed with direction
// clauses (structural: the line contains an explicit "= " clause).
[['gate', 'threshold'], ['gate', 'floor'], ['distortion', 'drive'],
  ['distortion', 'output'], ['autotune', 'retune']].forEach(function (p) {
  var idx = helpCards.map(function (c) { return c.attrs['data-family']; }).indexOf(p[0]);
  var spec = windowStub.NodeTypes.getParamSpec(p[0]);
  var row = helpCards[idx].children[1].children[0].children[
    spec.map(function (s) { return s.id; }).indexOf(p[1])
  ];
  check(/ [=] /.test(row.title), p[0] + ' ' + p[1] + ' carries a direction clause');
});

// Autotune's first row (Key — first tab stop) additionally carries the
// required operator disclosure: experimental status + the accepted fixed
// 20 ms engine delay.
var atIdx = helpCards.map(function (c) { return c.attrs['data-family']; }).indexOf('autotune');
var atKeyRow = helpCards[atIdx].children[1].children[0].children[0];
check(
  /Experimental/.test(atKeyRow.title) && /20 ms/.test(atKeyRow.title),
  'autotune Key line discloses experimental status + the fixed 20 ms delay'
);
check(
  !/Experimental/.test(helpCards[atIdx].children[1].children[0].children[1].title),
  'the status sentence rides the FIRST row only (said once per card)'
);

// ----------------------------------------------------------------------
// I. Type floor (finishing entry 2, critique P2-2) — the EXP badge was
// shipped at 0.625rem (computed 10px) on BOTH placements, under the
// system's 11px floor, while the CSS comment + DESIGN.md claimed
// compliance. The fix is one line in styles/main.css (both placements
// share the single .node-experimental-badge rule; the chip-scoped rule
// below it only adds margin-left:auto), so this section guards the REAL
// stylesheet (parsed from styles/main.css, comments stripped) instead of
// a fake DOM getComputedStyle: rule present, size at the floor, no
// placement override, tag treatment quiet, and every documentation
// source agreeing. A future re-shrink of the badge fails here.
// ----------------------------------------------------------------------
console.log('I. badge type floor (finishing entry 2)');

var RAW_CSS = '\n' + fs.readFileSync(path.join(ROOT, 'styles', 'main.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments — declarations only

function cssRule(selector) {
  var idx = RAW_CSS.indexOf('\n' + selector + ' {');
  if (idx === -1) { return null; }
  var open = RAW_CSS.indexOf('{', idx);
  var depth = 1;
  var i = open + 1;
  while (i < RAW_CSS.length && depth > 0) {
    if (RAW_CSS[i] === '{') { depth += 1; }
    else if (RAW_CSS[i] === '}') { depth -= 1; }
    i += 1;
  }
  return depth === 0 ? RAW_CSS.slice(open + 1, i - 1) : null;
}

function cssDecl(body, prop) {
  var m = body.match(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : null;
}

var REM_ROOT_PX = 16; // root html font-size (unchanged by this entry)
var badgeRule = cssRule('.node-experimental-badge');
check(badgeRule !== null, 'styles/main.css carries the .node-experimental-badge rule');

var badgeSize = badgeRule && cssDecl(badgeRule, 'font-size');
var badgePx = badgeSize && /rem$/.test(badgeSize)
  ? parseFloat(badgeSize) * REM_ROOT_PX
  : NaN;
check(
  badgePx === 11,
  'badge font-size is 0.6875rem (computed ' + badgePx + 'px = the 11px floor)'
);
check(
  badgePx >= 11,
  'badge font-size meets the 11px floor (was 0.625rem/10px, critique P2-2)'
);

// The chip placement's scoped rule must not reset the size — the two
// placements render identical type from the one rule above.
var chipBadgeRule = cssRule('.node-chip .node-experimental-badge');
check(
  chipBadgeRule !== null && cssDecl(chipBadgeRule, 'font-size') === null,
  'chip-scoped rule adds no font-size (both placements share the 11px size)'
);

// The floor precedent: the legend initials (.node-card::before /
// .node-chip::before) are the declared 0.6875rem floor the badge joins.
 ['.node-card::before', '.node-chip::before'].forEach(function (sel) {
  var initials = cssRule(sel);
  check(
    initials !== null && cssDecl(initials, 'font-size') === '0.6875rem',
    sel + ' initials stay at 0.6875rem (the badge joins the same floor)'
  );
});

// Quiet status marker, unchanged: weight/tracking per the existing tag
// treatment, padding widened (not shrunk) to compensate the size lift,
// amber-on-card colors untouched.
check(
  badgeRule && cssDecl(badgeRule, 'font-weight') === '700' &&
    cssDecl(badgeRule, 'letter-spacing') === '0.06em',
  'tag treatment unchanged: 700 weight, 0.06em tracking'
);
var badgePadding = badgeRule && cssDecl(badgeRule, 'padding');
check(
  badgePadding === '0.1rem 0.35rem',
  'side padding widened to 0.35rem (proportions held at the larger size)'
);
check(
  badgeRule && cssDecl(badgeRule, 'color') === 'var(--accent)' &&
    cssDecl(badgeRule, 'background') === 'var(--bg-card)',
  'amber text on Module Card ground unchanged (no new loudness)'
);

// The DOM end of the same guarantee: both live placements wear the one
// class the rule governs (chip badge from section C, card badge from the
// section H render — one class, one rule, two placements).
var liveChipBadge = chipFor('autotune').findByClass('node-experimental-badge');
var liveCardBadge = helpCards[atIdx].findByClass('node-experimental-badge');
check(
  !!liveChipBadge && !!liveCardBadge &&
    liveChipBadge.className === liveCardBadge.className &&
    liveCardBadge.className.indexOf('node-experimental-badge') !== -1,
  'both placements render through the one .node-experimental-badge class'
);

// Documentation agrees with the stylesheet (the critique's misstatements):
// DESIGN.md's badge spec and the design.json sidecar component snippet.
var designMd = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
var badgeSpecLine = (designMd.split('\n').filter(function (l) {
  return l.indexOf('**Experimental badge') !== -1;
})[0]) || '';
check(
  badgeSpecLine.indexOf('0.6875rem/700') !== -1 &&
    badgeSpecLine.indexOf('0.625rem') === -1,
  'DESIGN.md badge spec documents 0.6875rem (misstatement corrected)'
);
var designJson = JSON.parse(
  fs.readFileSync(path.join(ROOT, '.impeccable', 'design.json'), 'utf8')
);
var sidecar = designJson.components.filter(function (c) {
  return c.name === 'Experimental Badge';
})[0];
check(
  !!sidecar &&
    sidecar.css.indexOf('font-size: 0.6875rem') !== -1 &&
    sidecar.css.indexOf('0.625rem') === -1,
  'design.json sidecar css matches the stylesheet (0.6875rem)'
);
check(
  !!sidecar && sidecar.description.indexOf('0.6875rem') !== -1 &&
    sidecar.description.indexOf('0.625rem') === -1,
  'design.json sidecar description matches the stylesheet (0.6875rem)'
);

// ----------------------------------------------------------------------
// J. Grouping (finishing entry 3, critique P2-3) — the ten chips chunk
// under three operator-language silkscreen headers, INTERLEAVED in the
// flat palette list. Everything the critique demanded is guarded here:
// group structure + membership (registry-driven within groups), the
// legend register of the header rule (the optgroup precedent), chips
// staying direct-children buttons in DOM order (R2-2 keyboard/SR flow
// unchanged, no new interactive layer), every chip still operative
// through the shared commit chokepoint, the limiter chip preserved
// exactly (terminal policy untouched), and the palette Sortable scoping
// its drag items to '.node-chip' so headers are inert to the pointer.
// This doubles as a grouping-completeness gate: a future type without a
// group mapping falls into the 'more' fallback and FAILS the
// exactly-3-headers check, forcing a deliberate grouping decision the
// same way section H forces a help-lines decision.
// ----------------------------------------------------------------------
console.log('J. palette grouping (finishing entry 3)');

var GROUP_HEADERS = [
  { id: 'shape', label: 'Shape your voice', members: ['eq', 'distortion', 'chorus', 'autotune'] },
  { id: 'polish', label: 'Polish your sound', members: ['gain', 'compressor', 'delay', 'reverb'] },
  { id: 'safe', label: 'Keep it safe', members: ['limiter', 'gate'] }
];

var headerEls = paletteListEl.querySelectorAll('.palette-group-label');
check(
  headerEls.length === 3,
  'exactly three group headers render (no fallback group — every type mapped)'
);
check(
  headerEls.every(function (h) { return h.tagName === 'H3'; }),
  'group headers are real <h3> elements (h1 title → h2 Palette → h3 groups)'
);
check(
  headerEls.map(function (h) { return h.attrs['data-group']; }).join(',') ===
    GROUP_HEADERS.map(function (g) { return g.id; }).join(','),
  'group order is shape → polish → safe'
);
GROUP_HEADERS.forEach(function (g, gi) {
  var h = headerEls[gi];
  check(
    h.textContent === g.label,
    g.id + ' header reads "' + g.label + '" (operator language, CSS uppercases)'
  );
  check(
    (h.listeners.click || []).length === 0 &&
      !h.attrs.tabindex && !h.attrs.role,
    g.id + ' header is non-interactive (no listener, no focus/role hooks)'
  );
});

// Flat interleaving: the exact child sequence is header, its chips (in
// registration order), header, ... — chips stay DIRECT children of the
// palette list, so DOM order, tab order, and the SortableJS items are
// the same flat chip flow R2-2 built.
var childSequence = paletteListEl.children.map(function (child) {
  if (child.className.split(/\s+/).indexOf('palette-group-label') !== -1) {
    return 'H3:' + child.attrs['data-group'];
  }
  return child.attrs['data-node-type'];
});
var expectedSequence = [];
GROUP_HEADERS.forEach(function (g) {
  expectedSequence.push('H3:' + g.id);
  expectedSequence = expectedSequence.concat(g.members);
});
check(
  childSequence.join('|') === expectedSequence.join('|'),
  'palette DOM is header-then-chips interleaved flat: ' + expectedSequence.join(', ')
);
check(
  paletteListEl.children
    .filter(function (c) { return c.tagName === 'BUTTON'; })
    .length === 10,
  'the only interactive palette elements are the ten chip buttons (no new layer)'
);

// Within-group order is registration order (section A's registry check):
// each group's members appear in getAllTypes() order.
GROUP_HEADERS.forEach(function (g) {
  var regPositions = g.members.map(function (t) {
    return allTypes.indexOf(t);
  });
  check(
    regPositions.every(function (p, i) { return i === 0 || p > regPositions[i - 1]; }),
    g.id + ' group preserves registration order within the group'
  );
});

// The limiter chip is preserved EXACTLY: same button, same aria-label,
// no badge, enabled post-Start — the grouping is presentational and the
// terminal-limiter policy (addNodeType's insert-before + the agent-side
// refusal) is untouched by it.
var limiterChip = chipFor('limiter');
check(
  !!limiterChip &&
    limiterChip.tagName === 'BUTTON' &&
    limiterChip.attrs['aria-label'] === 'Add Limiter to chain' &&
    limiterChip.findByClass('node-experimental-badge') === null &&
    limiterChip.disabled === false,
  'limiter chip in the safe group is byte-for-byte the chip it always was'
);

// Every chip remains operative through the shared chokepoint: one click
// per group (eq from shape, gain from polish, gate from safe) commits
// buildGraph + autosave + markModified + noteHumanEdit exactly like a
// drag-add.
windowStub.ChainCanvas.loadModel([]);
var jGraphBefore = calls.buildGraph.length;
var jPersistBefore = calls.persist.length;
var jModifiedBefore = calls.markModified;
var jHumanBefore = calls.noteHumanEdit;
['eq', 'gain', 'gate'].forEach(function (type) {
  chipFor(type).fire('click');
});
var jCards = cards();
check(
  jCards.length === 3 &&
    jCards.map(function (c) { return c.attrs['data-family']; }).join(',') === 'eq,gain,gate',
  'one keyboard add from EACH group builds its card (append policy)'
);
check(
  calls.buildGraph.length === jGraphBefore + 3 &&
    calls.persist.length === jPersistBefore + 3 &&
    calls.markModified === jModifiedBefore + 3 &&
    calls.noteHumanEdit === jHumanBefore + 3,
  'keyboard adds from every group commit through the shared structural chokepoint'
);

// Limiter add policy unchanged with the grouping: a keyboard limiter add
// against a terminal limiter still inserts BEFORE it (terminal stays
// terminal) — the pre-existing addNodeType behavior, byte-identical.
windowStub.ChainCanvas.loadModel([{ id: 'L', type: 'limiter', params: {} }]);
chipFor('limiter').fire('click');
var jAfterLimiter = cards();
check(
  jAfterLimiter.length === 2 &&
    jAfterLimiter[0].attrs['data-family'] === 'limiter' &&
    jAfterLimiter[1].attrs['data-family'] === 'limiter',
  'keyboard limiter add still inserts before the terminal limiter (policy untouched)'
);

// The header rule follows the optgroup legend register (the in-house
// grouped-options precedent, #preset-select optgroup): uppercase,
// tracked, muted, 0.7rem = 11.2px — above the 11px floor.
var groupLabelRule = cssRule('.palette-group-label');
check(
  groupLabelRule !== null,
  'styles/main.css carries the .palette-group-label rule'
);
check(
  groupLabelRule && cssDecl(groupLabelRule, 'font-size') === '0.7rem',
  'group label font-size is 0.7rem (11.2px, the optgroup legend size — above the 11px floor)'
);
check(
  groupLabelRule &&
    cssDecl(groupLabelRule, 'font-weight') === '700' &&
    cssDecl(groupLabelRule, 'text-transform') === 'uppercase' &&
    cssDecl(groupLabelRule, 'letter-spacing') === '0.08em' &&
    cssDecl(groupLabelRule, 'color') === 'var(--text-muted)',
  'group label register matches the silkscreen legend (700 / uppercase / 0.08em / muted)'
);
check(
  groupLabelRule && cssDecl(groupLabelRule, 'margin') === '0.9rem 0 0.35rem',
  'group label rhythm: generous space above, tight below (craft floor)'
);
var firstHeaderRule = cssRule('.palette-group-label:first-child');
check(
  firstHeaderRule !== null &&
    cssDecl(firstHeaderRule, 'margin-top') === '0',
  'first group header drops its top margin (the panel h2 already separates it)'
);

// The palette Sortable scopes drag items to the chips: with headers
// interleaved, the default '>*' would make a header grabbable. The chain
// instance keeps its default (no draggable override).
var paletteSortableInstance = null;
var chainSortableInstance = null;
windowStub.Sortable.instances.forEach(function (inst) {
  if (inst.el === paletteListEl) { paletteSortableInstance = inst; }
  if (inst.el === chainListEl) { chainSortableInstance = inst; }
});
check(
  !!paletteSortableInstance &&
    paletteSortableInstance.opts.draggable === '.node-chip',
  'palette Sortable restricts drag items to .node-chip (headers are pointer-inert)'
);
check(
  !!chainSortableInstance &&
    chainSortableInstance.opts.draggable === undefined,
  'chain Sortable keeps its default drag items (drag path untouched)'
);

// ----------------------------------------------------------------------
// K. READOUT CONVENTION (finishing entry 4, critique P3-4) — distortion
// Drive/Tone render on the surface's 0-100 % readout convention ("25%"/
// "70%", the same string shape as Mix "30%") while EVERYTHING behind the
// string keeps the internal 0..1 scale exactly as registered: the slider
// min/max/step/default, the parsed model value a human drag commits, the
// loadModel/preset restore path (a saved drive 0.25 still means the same
// sound), and the agent set_param canvas half (ChainCanvas.updateNodeParam
// — the exact call MCP's parameter-only fast path makes — still receives
// and stores 0..1). Also a registry-wide gate: a % param on a 0..1 scale
// MUST declare the displayScale 100 readout conversion, and a % param
// already on 0..100 MUST NOT — so the next 0..1+% param of this family
// fails here instead of shipping "0.25%".
// ----------------------------------------------------------------------
console.log('K. readout convention 0-100 % (finishing entry 4)');

function cardById(id) {
  var found = null;
  cards().some(function (c) {
    if (c.attrs['data-node-id'] === id) {
      found = c;
      return true;
    }
    return false;
  });
  return found;
}

function paramRow(card, paramId) {
  var nodeId = card.attrs['data-node-id'];
  var inner = card.children[1].children[0];
  var found = null;
  inner.children.some(function (row) {
    if (row.children[1] && row.children[1].id === 'param-' + nodeId + '-' + paramId) {
      found = row;
      return true;
    }
    return false;
  });
  return found;
}

function rowValueSpan(card, paramId) {
  var row = paramRow(card, paramId);
  // Row anatomy: [label, control, .param-value span, (.sr-only help span)]
  return row ? row.children[2] : null;
}

// K1. Defaults: the mono readout reads 0-100 %, the slider stays 0..1.
windowStub.ChainCanvas.loadModel([
  { id: 'k1', type: 'distortion', params: { drive: 0.25, tone: 0.7, output: -3 } },
  { id: 'k2', type: 'chorus', params: { depthMs: 3, rateHz: 1.5, mix: 30 } }
]);
var kDist = cardById('k1');
var kChorus = cardById('k2');
check(
  rowValueSpan(kDist, 'drive').textContent === '25%',
  'distortion Drive readout is "25%" at the 0.25 default (was "0.25%")'
);
check(
  rowValueSpan(kDist, 'tone').textContent === '70%',
  'distortion Tone readout is "70%" at the 0.7 default (was "0.7%")'
);
check(
  rowValueSpan(kDist, 'output').textContent === '-3 dB',
  'distortion Output readout unchanged ("-3 dB" — non-% params untouched)'
);
check(
  rowValueSpan(kChorus, 'mix').textContent === '30%',
  'chorus Mix still reads "30%" (the convention reference, untouched)'
);
check(
  rowValueSpan(kChorus, 'depthMs').textContent === '3 ms' &&
    rowValueSpan(kChorus, 'rateHz').textContent === '1.5 Hz',
  'chorus Depth/Rate still render their documented units (3 ms / 1.5 Hz)'
);
check(
  rowValueSpan(kDist, 'drive').className === 'param-value' &&
    rowValueSpan(kChorus, 'mix').className === 'param-value',
  'both readouts ride the same .param-value mono register (tabular rhythm unchanged)'
);
var kDriveControl = paramRow(kDist, 'drive').children[1];
check(
  kDriveControl.min === 0 && kDriveControl.max === 1 &&
    kDriveControl.step === 0.01 && kDriveControl.value === 0.25,
  'Drive slider stays on the internal 0..1 scale (min/max/step/value untouched)'
);

// K2. Min/mid/max through the HUMAN slider path: the readout scales, the
// committed model value does not.
var kCapturedParams = null;
windowStub.AudioGraph.updateNodeParams = function (id, params) {
  if (id === 'k1') {
    kCapturedParams = Object.assign({}, params);
  }
};
windowStub.AudioGraph.getNodeInstance = function () {
  // Distortion-shaped fake so the real NodeTypes.applyParam ramp call
  // finds the internal nodes it addresses (driveGain/toneFilter/outGain).
  return {
    driveGain: { gain: {} },
    toneFilter: { frequency: {} },
    outGain: { gain: {} }
  };
};
[
  { raw: '0', display: '0%', model: 0 },
  { raw: '0.5', display: '50%', model: 0.5 },
  { raw: '1', display: '100%', model: 1 },
  { raw: '0.25', display: '25%', model: 0.25 }
].forEach(function (c) {
  kDriveControl.value = c.raw;
  kDriveControl.fire('input');
  check(
    rowValueSpan(kDist, 'drive').textContent === c.display,
    'human drag to ' + c.raw + ' reads "' + c.display + '"'
  );
  check(
    kCapturedParams && kCapturedParams.drive === c.model,
    'human drag to ' + c.raw + ' commits the INTERNAL value ' + c.model + ' (scale unchanged)'
  );
});
// Float-noise case: 0.33 * 100 === 33.000000000000004 in binary float —
// the readout must round it away, the model must keep the exact 0.33.
var kToneControl = paramRow(kDist, 'tone').children[1];
kToneControl.value = '0.33';
kToneControl.fire('input');
check(
  rowValueSpan(kDist, 'tone').textContent === '33%',
  'tone 0.33 reads "33%" (no binary-float tails in the readout)'
);
check(
  kCapturedParams && kCapturedParams.tone === 0.33,
  'tone 0.33 commits the internal 0.33 verbatim'
);

// K3. Preset/autosave restore path: values from a saved preset render on
// the 0-100 convention and the model serialization source is unchanged.
windowStub.ChainCanvas.loadModel([
  { id: 'k3', type: 'distortion', params: { drive: 0.42, tone: 0.06, output: -12 } }
]);
var kRestored = cardById('k3');
check(
  rowValueSpan(kRestored, 'drive').textContent === '42%' &&
    rowValueSpan(kRestored, 'tone').textContent === '6%',
  'restored preset drive 0.42 / tone 0.06 read "42%" / "6%"'
);
var kRestoredModel = windowStub.ChainCanvas.getCurrentModel();
check(
  kRestoredModel[0].params.drive === 0.42 && kRestoredModel[0].params.tone === 0.06,
  'getCurrentModel (the persistence/preset read) still carries 0.42/0.06 — round-trip unchanged'
);

// K4. Agent set_param canvas half: ChainCanvas.updateNodeParam — the exact
// call MCP's parameter-only fast path makes after AudioGraph/
// NodeTypes.applyParam — still receives 0..1 and converts the readout the
// same way. (The MCP-side 0..1 contract itself is pinned by
// tests/test-mcp-tools-cycle3.js C8: set_param drive 0.9 -> model 0.9.)
var kPersistBefore = calls.persist.length;
check(
  windowStub.ChainCanvas.updateNodeParam('k3', 'drive', 0.5) === true,
  'updateNodeParam (set_param canvas half) applies drive 0.5'
);
check(
  rowValueSpan(kRestored, 'drive').textContent === '50%',
  'agent-written drive 0.5 reads "50%" on the card without a re-render'
);
check(
  paramRow(kRestored, 'drive').children[1].value === 0.5,
  'agent-written drive keeps the slider at the internal 0.5 position'
);
check(
  windowStub.ChainCanvas.getCurrentModel()[0].params.drive === 0.5,
  'agent-written drive stores the internal 0.5 in the model'
);
check(
  calls.persist.length === kPersistBefore + 1 &&
    calls.persist[calls.persist.length - 1][0].params.drive === 0.5,
  'agent param edit autosaves the internal 0.5 (PS-2 persistence unchanged)'
);

// K5. Registry-wide convention gate: every % param either already lives on
// 0-100 (no displayScale — renders raw, like Mix/Feedback) or declares
// displayScale 100 for its 0..1 scale. A future 0..1+% param without the
// scale fails here; a 0-100 % param that gains one fails here too.
var kPercentSpecs = 0;
allTypes.forEach(function (type) {
  windowStub.NodeTypes.getParamSpec(type).forEach(function (s) {
    if (s.unit === '%' && !Array.isArray(s.values)) {
      kPercentSpecs += 1;
      if (s.max <= 1) {
        check(
          s.displayScale === 100,
          type + '.' + s.id + ' is a 0..1 % param and declares displayScale 100 (0-100 readout)'
        );
      } else {
        check(
          s.displayScale === undefined,
          type + '.' + s.id + ' is already 0-100 % and renders raw (no displayScale)'
        );
      }
    }
  });
});
check(
  kPercentSpecs === 7,
  'seven % params across the ten types (delay x2, reverb, chorus, autotune, distortion x2)'
);

// K6. Rendered sweep over ALL TEN types at once: no % readout anywhere on
// the surface matches the "0.X%" fraction pattern the critique flagged.
windowStub.ChainCanvas.loadModel([
  { id: 's1', type: 'gain', params: { gainDb: 0 } },
  { id: 's2', type: 'compressor', params: { threshold: -24, ratio: 4, attack: 0.01, release: 0.25 } },
  { id: 's3', type: 'eq', params: { lowGain: 0, midGain: 0, highGain: 0 } },
  { id: 's4', type: 'delay', params: { timeMs: 300, feedback: 25, mix: 25 } },
  { id: 's5', type: 'reverb', params: { mix: 20 } },
  { id: 's6', type: 'limiter', params: { ceiling: -1, release: 50 } },
  { id: 's7', type: 'distortion', params: { drive: 0.25, tone: 0.7, output: -3 } },
  { id: 's8', type: 'chorus', params: { depthMs: 3, rateHz: 1.5, mix: 30 } },
  { id: 's9', type: 'gate', params: { threshold: -50, attack: 0.005, release: 0.15, floor: -40 } },
  { id: 's10', type: 'autotune', params: { key: 'C', scale: 'Chromatic', retune: 0, mix: 100 } }
]);
var kPercentReadouts = [];
cards().forEach(function (card) {
  var inner = card.children[1].children[0];
  inner.children.forEach(function (row) {
    var span = row.children[2];
    if (span && /%$/.test(span.textContent)) {
      kPercentReadouts.push(span.textContent);
    }
  });
});
check(
  kPercentReadouts.length === 7 &&
    kPercentReadouts.indexOf('25%') !== -1 &&
    kPercentReadouts.indexOf('70%') !== -1 &&
    kPercentReadouts.indexOf('100%') !== -1,
  'all seven % readouts render across the ten mounted cards (Drive 25%, Tone 70%, autotune Mix 100%)'
);
check(
  kPercentReadouts.every(function (t) { return !/^0\.\d/.test(t); }),
  'no % readout anywhere matches the "0.X%" fraction pattern (critique P3-4)'
);

// ----------------------------------------------------------------------
// Summary.
// ----------------------------------------------------------------------
console.log('');
if (failures.length === 0) {
  console.log('palette-cards-cycle3: ALL PASS');
  process.exit(0);
} else {
  console.log('palette-cards-cycle3: ' + failures.length + ' FAILURE(S)');
  process.exit(1);
}
