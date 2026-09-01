// tests/test-horizontal-default.js — the 2026-08-31 horizontal-default
// round's board contract.
//
// The board's DEFAULT reading is now HORIZONTAL: condensed portrait
// sections in a left-to-right row (src/canvas.js + styles/main.css). The
// vertical stacked reading survives as the FLIPPED mode (the FLOW toggle
// reverses it) and keeps its own coverage in test-board-positioning-few2
// / test-cord-layer-few3 / test-cord-editing-few4, which stub an explicit
// stored vertical preference. This file pins the NEW default end to end:
//
//   H1  the board boots horizontal — the ONLY reading (vertical flow was
//       retired 2026-08-31); no FLOW toggle exists anywhere in the chrome
//   H2  absent layout -> the incumbent ROW (x accumulates widths, y fixed)
//   H3  every card paints the FLOOR width (176px — the single-stack default)
//   H4  the board extent maintains minWidth (the row's right edge)
//   H5  a saved per-card width `w` is honored and clamped
//   H6  the corner resize grip adjusts `w` live, snap-quantized, clamped,
//       and persists exactly once on gesture end
//   H7  legacy vertical entries load horizontal (the retirement migration)
//
// Zero-dependency, plain `node`, browser globals stubbed — same harness
// shape as test-board-positioning-few2.js.

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
  CC.CARD_W_DEFAULT_PX === 128 && CC.CARD_W_MIN_PX === 96 && CC.CARD_W_MAX_PX === 384,
  'H1b: the width contract exports (fallback default 128 for layout-less hosts, resize floor 96, ceiling 384 — real browsers hug each card\'s measured content)'
);
check(
  queryAll(canvasPanelEl, '.flow-toggle').length === 0,
  'H1c: the FLOW toggle is GONE from the chrome (vertical flow retired)'
);

CC.renderModel(model3());
check(
  JSON.stringify(CC.currentLayout()) === JSON.stringify({
    n1: { x: 0, y: 16, scale: 1, flow: 'horizontal' },
    n2: { x: 144, y: 16, scale: 1, flow: 'horizontal' },
    n3: { x: 288, y: 16, scale: 1, flow: 'horizontal' }
  }),
  'H2: absent layout -> the incumbent ROW (x accumulates card+pitch at the 176 floor + 16, y fixed at the grid edge)'
);

check(
  cardById('n1').style.width === '128px' &&
    cardById('n2').style.width === '128px' &&
    cardById('n3').style.transform === 'translate(288px, 16px)',
  'H3: every card paints the floor width + its translate seat'
);

check(
  chainListEl.style.minWidth === '432px' && chainListEl.style.minHeight === '176px',
  'H4: the board extent maintains minWidth (row right edge 288+144) alongside minHeight'
);

// ----------------------------------------------------------------------

CC.renderModel(model3(), {
  n1: { x: 0, y: 16, w: 320, flow: 'horizontal' },
  n2: { x: 0, y: 16, w: 5000, flow: 'horizontal' },
  n3: { x: 0, y: 16, flow: 'horizontal' }
});
check(
  cardById('n1').style.width === '320px' &&
    cardById('n2').style.width === '384px' &&
    cardById('n3').style.width === '128px',
  'H5: a saved width is honored, an out-of-range one clamps, a missing one takes the floor default'
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
check(n1.style.width === '384px', 'H6d: the drag clamps at the condensed max (384px)');
documentStub.__fire('pointerup', {});
check(
  CC.isDragActive() === false && saves.length === 1,
  'H6e: gesture end releases the drag gate and persists the layout EXACTLY once (end-only discipline)'
);

// ----------------------------------------------------------------------

// Retirement migration: vertical flow no longer exists, so whatever a
// legacy payload claims, every entry loads horizontal.
CC.renderModel(model3(), {
  n1: { x: 16, y: 0, flow: 'vertical' },
  n2: { x: 16, y: 160 }
});
check(
  CC.currentLayout().n1.flow === 'horizontal' && CC.currentLayout().n2.flow === 'horizontal',
  'H7: legacy vertical entries load horizontal (the retirement migration)'
);

// ----------------------------------------------------------------------
if (failures.length) {
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS: horizontal default board + condensed widths (2026-08-31 round)');
