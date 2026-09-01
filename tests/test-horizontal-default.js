// tests/test-horizontal-default.js — the board's condensed-width contract.
//
// The board's ONLY reading is a horizontal row of condensed cards
// (src/canvas.js + styles/main.css); vertical flow and free x/y
// positioning were both retired (2026-08-31, then the free board itself
// on 2026-09-01 — see canvas.js's own board-redesign comment). This file
// pins the surviving per-card WIDTH contract end to end — order is no
// longer a layout concern at all, since DOM order IS chain order (PD-4)
// and a card's only remaining layout fact is its own width:
//
//   H1  the board carries .flow-horizontal (the one reading, permanent
//       class) and the FLOW toggle is gone from the chrome
//   H2  absent layout -> cards render in the model's own order, no
//       card has a manual width on record
//   H3  every unresized card paints the 144px safe expanded minimum
//   H4  folding paints a separate compact width and expanding restores
//       the card's saved/default expanded width
//   H5  a saved per-card width `w` is honored and clamped
//   H6  the corner resize grip adjusts a card's width live,
//       snap-quantized, clamped, and persists exactly once on gesture end
//   H7  a legacy (pre-redesign) x/y/flow-shaped entry carries no `w` and
//       is simply ignored, not migrated — every card falls back to its
//       default width instead of crashing on the unrecognized shape
//
// Zero-dependency, plain `node`, browser globals stubbed.

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
// Minimal fake DOM — only what canvas.js touches for this seam (the same
// shape as test-board-positioning-few2.js's harness).
// ----------------------------------------------------------------------
function queryAll(root, selector) {
  var cls = selector.slice(1);
  var out = [];
  (function walk(el) {
    (el.children || []).forEach(function (child) {
      if (child.classList && child.classList.contains(cls)) { out.push(child); }
      walk(child);
    });
  })(root);
  return out;
}

function FakeElement(tag) {
  var self = this;
  this.tagName = tag;
  this.children = [];
  this.parentNode = null;
  this.className = '';
  this.attrs = {};
  this.style = {};
  this.textContent = '';
  this.title = '';
  this.disabled = false;
  this.offsetWidth = 0;
  this.offsetHeight = 0;
  this.listeners = {};
  function classTokens() {
    return self.className ? self.className.split(/\s+/) : [];
  }
  this.classList = {
    add: function (c) {
      if (!this.contains(c)) { self.className = (self.className ? self.className + ' ' : '') + c; }
    },
    remove: function (c) {
      self.className = classTokens().filter(function (t) { return t !== c; }).join(' ');
    },
    contains: function (c) {
      return classTokens().indexOf(c) !== -1;
    },
    toggle: function (c) {
      if (this.contains(c)) { this.remove(c); return false; }
      this.add(c); return true;
    }
  };
  this.setAttribute = function (k, v) { self.attrs[k] = String(v); };
  this.getAttribute = function (k) {
    return Object.prototype.hasOwnProperty.call(self.attrs, k) ? self.attrs[k] : null;
  };
  this.appendChild = function (child) {
    if (child.parentNode) { child.parentNode.removeChild(child); }
    child.parentNode = self;
    self.children.push(child);
    return child;
  };
  this.removeChild = function (child) {
    var idx = self.children.indexOf(child);
    if (idx !== -1) { self.children.splice(idx, 1); }
    child.parentNode = null;
  };
  this.remove = function () {
    if (self.parentNode) { self.parentNode.removeChild(self); }
  };
  this.addEventListener = function (type, fn) {
    (self.listeners[type] = self.listeners[type] || []).push(fn);
  };
  this.__fire = function (type, props) {
    var event = Object.assign(
      { type: type, target: self, stopPropagation: function () {}, preventDefault: function () {} },
      props || {}
    );
    (self.listeners[type] || []).slice().forEach(function (fn) {
      fn(event);
    });
    return event;
  };
  this.querySelectorAll = function (selector) { return queryAll(self, selector); };
  this.querySelector = function (selector) { return queryAll(self, selector)[0] || null; };
}

var paletteListEl = new FakeElement('div');
var chainListEl = new FakeElement('div');
var emptyHintEl = new FakeElement('div');
var layoutEl = new FakeElement('div');
var canvasPanelEl = new FakeElement('div');
canvasPanelEl.className = 'canvas-panel';

Object.defineProperty(chainListEl, 'innerHTML', {
  set: function (v) {
    if (v === '') { chainListEl.children.slice().forEach(function (c) { c.remove(); }); }
  },
  get: function () { return ''; }
});

var documentStub = {
  createElement: function (tag) { return new FakeElement(tag); },
  getElementById: function (id) {
    if (id === 'palette-list') { return paletteListEl; }
    if (id === 'chain-list') { return chainListEl; }
    if (id === 'empty-hint') { return emptyHintEl; }
    if (id === 'chain-layout') { return layoutEl; }
    return null;
  },
  querySelector: function (sel) {
    return sel === '.canvas-panel' ? canvasPanelEl : null;
  },
  addEventListener: function (type, fn) {
    documentStub.__listeners[type] = (documentStub.__listeners[type] || []).concat(fn);
  },
  __listeners: {},
  __fire: function (type, props) {
    (documentStub.__listeners[type] || []).slice().forEach(function (fn) {
      fn(Object.assign({ type: type }, props || {}));
    });
  }
};

function SortableStub() {}
SortableStub.instances = [];

var saves = [];
var flowWrites = [];

// The localStorage stub of the round: NOTHING stored yet (getItem null)
// and setItem RECORDED — exactly the fresh-profile host the horizontal
// default targets.
var storageStub = {
  getItem: function () { return null; },
  setItem: function (key, value) { flowWrites.push({ key: key, value: value }); },
  removeItem: function () {}
};

var sandbox = {
  console: { log: function () {}, warn: function () {}, error: function () {} },
  document: documentStub,
  setTimeout: function () {},
  Sortable: SortableStub,
  EffectCatalog: {
    getAllTypes: function () { return ['gain', 'limiter']; },
    getLabel: function (t) { return t === 'limiter' ? 'Limiter' : 'Gain'; },
    getParamSpec: function () { return [{ id: 'level', default: 0 }]; },
    isExperimental: function () { return false; }
  },
  ParamControls: { render: function () {}, updateControl: function () {} },
  AudioGraph: {
    buildGraph: function (m) {},
    getModel: function () { return []; }
  },
  AudioEngine: { isStarted: false },
  Persistence: {
    saveCurrentChain: function (model, layout) { saves.push({ model: model, layout: layout }); }
  }
};
sandbox.window = sandbox;
sandbox.window.localStorage = storageStub;
vm.createContext(sandbox);

vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'src', 'canvas.js'), 'utf8'),
  sandbox,
  { filename: 'src/canvas.js' }
);

var CC = sandbox.ChainCanvas;

// ----------------------------------------------------------------------
// Helpers.
// ----------------------------------------------------------------------
function cards() { return queryAll(chainListEl, '.node-card'); }

function cardById(id) {
  var found = null;
  cards().some(function (c) {
    if (c.attrs['data-node-id'] === id) { found = c; return true; }
    return false;
  });
  return found;
}

function descendFind(el, cls) {
  var found = null;
  (function walk(node) {
    (node.children || []).some(function (child) {
      if (child.classList.contains(cls)) { found = child; return true; }
      walk(child);
      return false;
    });
  })(el);
  return found;
}

function model3() {
  return [
    { id: 'n1', type: 'gain', params: {} },
    { id: 'n2', type: 'gain', params: {} },
    { id: 'n3', type: 'gain', params: {} }
  ];
}

// ----------------------------------------------------------------------
console.log('H. horizontal is the DEFAULT board reading (2026-08-31 round)');
// ----------------------------------------------------------------------

check(
  canvasPanelEl.classList.contains('flow-horizontal'),
  'H1: a host with NO stored preference boots the board HORIZONTAL (panel carries .flow-horizontal)'
);

check(
  CC.CARD_W_DEFAULT_PX === 144 && CC.CARD_W_MIN_PX === 144 &&
    CC.CARD_W_COLLAPSED_PX === 56 && CC.CARD_W_MAX_PX === 640,
  'H1b: the width contract exports (144px default/floor, 56px folded rail, 640px ceiling)'
);
check(
  queryAll(canvasPanelEl, '.flow-toggle').length === 0,
  'H1c: the FLOW toggle is GONE from the chrome (vertical flow retired)'
);

CC.renderModel(model3());
check(
  cards().map(function (c) { return c.attrs['data-node-id']; }).join(',') === 'n1,n2,n3',
  'H2: absent layout -> cards render in the model\'s own order (DOM order IS chain order now, no seat math)'
);
check(
  JSON.stringify(CC.currentLayout()) === JSON.stringify({}),
  'H2b: no card has a manual width on record -> currentLayout() is empty (every card takes the uniform default)'
);

check(
  cardById('n1').style.width === '144px' &&
    cardById('n2').style.width === '144px' &&
    cardById('n3').style.width === '144px',
  'H3: every unresized card paints the smallest safe expanded width (144px)'
);

// ----------------------------------------------------------------------

CC.renderModel(model3(), {
  n1: { w: 320 },
  n2: { w: 5000 },
  n3: {}
});
check(
  cardById('n1').style.width === '320px' &&
    cardById('n2').style.width === '640px' &&
    cardById('n3').style.width === '144px',
  'H5: a saved width is honored, an out-of-range one clamps, a missing one takes the safe minimum default'
);

var foldedN1 = cardById('n1');
var foldButton = descendFind(foldedN1, 'node-collapse');
foldButton.__fire('click');
check(
  foldedN1.style.width === '56px' && foldButton.attrs['aria-expanded'] === 'false' &&
    CC.currentLayout().n1.w === 320,
  'H4a: folding paints a 56px vertical rail without overwriting the saved 320px expanded width'
);
foldButton.__fire('click');
check(
  foldedN1.style.width === '320px' && foldButton.attrs['aria-expanded'] === 'true',
  'H4b: expanding restores the saved expanded width'
);

// ----------------------------------------------------------------------

var n1 = cardById('n1');
var grip = descendFind(n1, 'node-resize');
check(!!grip, 'H6a: every expanded card carries the corner resize grip (.node-resize)');

saves.length = 0;
grip.__fire('pointerdown', { clientX: 100, clientY: 50, button: 0 });
check(CC.isDragActive() === true, 'H6b: the resize gesture arms the drag gate (agent mutations queue behind it)');
documentStub.__fire('pointermove', { clientX: 148, clientY: 50 }); // +48 -> 320+48=368 (grid-aligned)
check(
  n1.style.width === '368px' && CC.currentLayout().n1.w === 368,
  'H6c: the live drag repaints the width snap-quantized into the layout entry (320+48 -> 368)'
);
documentStub.__fire('pointermove', { clientX: 1000, clientY: 50 }); // far right -> clamp at max
check(n1.style.width === '640px', 'H6d: the drag clamps at the wide one-line ceiling (640px)');
documentStub.__fire('pointermove', { clientX: -1000, clientY: 50 }); // far left -> clamp at min
check(n1.style.width === '144px', 'H6d2: the drag clamps at the readable expanded minimum (144px)');
documentStub.__fire('pointerup', {});
check(
  CC.isDragActive() === false && saves.length === 1,
  'H6e: gesture end releases the drag gate and persists the layout EXACTLY once (end-only discipline)'
);

// ----------------------------------------------------------------------

// Retirement migration: a pre-board-redesign entry's x/y/flow fields
// carry no `w` at all, so they're simply ignored (not migrated to
// anything) rather than crashing on the unrecognized shape — every card
// falls back to its default width. freshSeats:true rules out the
// (separately-covered, H5/H6) carry-forward path so this isolates
// exactly the legacy-shape behavior, not leftover state from earlier
// checks in this same file.
CC.renderModel(model3(), {
  n1: { x: 16, y: 0, flow: 'vertical' },
  n2: { x: 16, y: 160 }
}, { freshSeats: true });
check(
  JSON.stringify(CC.currentLayout()) === JSON.stringify({}) &&
    cardById('n1').style.width === '144px' &&
    cardById('n2').style.width === '144px',
  'H7: a legacy x/y/flow-shaped entry carries no `w` and is ignored -- every card falls back to its default width, not a crash'
);

// ----------------------------------------------------------------------
if (failures.length) {
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS: horizontal default board + condensed widths (2026-08-31 round)');
