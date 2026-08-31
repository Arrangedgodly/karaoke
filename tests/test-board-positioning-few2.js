// Test for cycle-4 FEW-2 — free positioning + TIDY (the canvas consumer
// of FEW-1's layout store).
//
// Scope under test (the REAL src/canvas.js in a minimal vm DOM):
//   - Sections are positioned by x/y STYLE ONLY: a grip pointer-drag
//     MOVES POSITION (snap-quantized to GRID_PITCH = 16px) and provably
//     never reorders anything — the chain model AND the DOM order are
//     byte-stable across a drag (PD-4).
//   - The chain-list SortableJS instance is RETIRED (PD-1): exactly one
//     Sortable remains (the palette's).
//   - pointerdown brings the section to front (z-order, DOM untouched).
//   - Position persists on MOVE-END only (never per pointermove) through
//     saveCurrentChain(model, layout) — FEW-1's store seam.
//   - TIDY restores the incumbent vertical stack, rewriting ONLY x/y and
//     preserving each entry's scale/flow.
//   - loadModel(model, layout) applies a saved layout exactly; absent
//     entries auto-place (tidy stack / first free grid slot); removal
//     prunes the live layout map.
//
// Pointer coverage uses the synthetic events the harness already supports
// (a __fire on the fake element/document) — the full pointer-utility
// suite is QA-1's later task, deliberately not built here.
//
// Same committed zero-dependency convention: plain `node`, run via
// `node tests/run.js board-positioning`.

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
// Minimal fake DOM — only what canvas.js touches for this seam.
// ----------------------------------------------------------------------
function FakeElement(tag) {
  var self = this;
  this.tagName = (tag || 'div').toUpperCase();
  this.tagName = tag; // canvas.js never reads tagName; keep raw
  this.children = [];
  this.parentNode = null;
  this.className = '';
  this.attrs = {};
  this.style = {};
  this.textContent = '';
  this.title = '';
  this.disabled = false;
  this.offsetWidth = 0; // the register's reflow guard reads a number
  this.listeners = {};
  var classes = {};
  function classTokens() {
    return self.className ? self.className.split(/\s+/) : [];
  }
  this.classList = {
    add: function (c) {
      if (!this.contains(c)) { self.className = (self.className ? self.className + ' ' : '') + c; }
      classes[c] = true;
    },
    remove: function (c) {
      self.className = classTokens().filter(function (t) { return t !== c; }).join(' ');
      delete classes[c];
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
  this.insertBefore = function (child, ref) {
    var idx = self.children.indexOf(ref);
    if (child.parentNode) { child.parentNode.removeChild(child); }
    child.parentNode = self;
    if (idx === -1) { self.children.push(child); } else { self.children.splice(idx, 0, child); }
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
  this.removeEventListener = function (type, fn) {
    var arr = self.listeners[type] || [];
    var idx = arr.indexOf(fn);
    if (idx !== -1) { arr.splice(idx, 1); }
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
  this.__classes = classes;
}

// Class-selector query over the subtree ('.node-card' / '.node-chip' are
// the only selectors canvas.js runs on these containers).
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

['palette-list', 'chain-list', 'empty-hint', 'chain-layout'].forEach(function (id) {
  FakeElement.prototype['#el-' + id] = null;
});

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
Object.defineProperty(paletteListEl, 'innerHTML', {
  set: function (v) {
    if (v === '') { paletteListEl.children.slice().forEach(function (c) { c.remove(); }); }
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

// ----------------------------------------------------------------------
// Stub collaborators + the REAL canvas.js.
// ----------------------------------------------------------------------
function SortableStub(el, opts) { SortableStub.instances.push({ el: el, opts: opts }); }
SortableStub.instances = [];

var saves = []; // Persistence.saveCurrentChain recordings: {model, layout}
var builds = [];

var sandbox = {
  console: { log: function () {}, warn: function () {}, error: function () {} },
  document: documentStub,
  setTimeout: function () {},
  Sortable: SortableStub,
  NodeTypes: {
    getAllTypes: function () { return ['gain', 'limiter']; },
    getLabel: function (t) { return t === 'limiter' ? 'Limiter' : 'Gain'; },
    getParamSpec: function () { return [{ id: 'level', default: 0 }]; },
    isExperimental: function () { return false; }
  },
  ParamControls: {
    render: function () {},
    updateControl: function () {}
  },
  AudioGraph: {
    buildGraph: function (m) { builds.push(m); },
    getModel: function () { return []; }
  },
  AudioEngine: { isStarted: false },
  Persistence: {
    saveCurrentChain: function (model, layout) { saves.push({ model: model, layout: layout }); }
  }
};
sandbox.window = sandbox;
// Horizontal-default round (2026-08-31): the board's DEFAULT reading is
// now horizontal. These harnesses pin the VERTICAL geometry contracts,
// so they stub an EXPLICIT stored vertical preference (the user has
// clicked the toggle) — readFlowPreference honors it and the vertical
// pins hold verbatim. The horizontal default gets its own coverage
// below / in test-board-positioning-few2.js.
sandbox.window.localStorage = {
  getItem: function (k) { return k === 'karaoke-flow-orientation-v1' ? 'vertical' : null; },
  setItem: function () {},
  removeItem: function () {}
};
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

function handleOf(id) {
  var card = cardById(id);
  var found = null;
  (function walk(el) {
    (el.children || []).some(function (child) {
      if (child.classList.contains('node-drag-handle')) { found = child; return true; }
      walk(child);
      return false;
    });
  })(card);
  return found;
}

function domOrder() {
  return cards().map(function (c) { return c.attrs['data-node-id']; });
}

function removeBtnOf(id) {
  var card = cardById(id);
  var found = null;
  (function walk(el) {
    (el.children || []).some(function (child) {
      if (child.classList.contains('node-remove-btn')) { found = child; return true; }
      walk(child);
      return false;
    });
  })(card);
  return found;
}

function model() {
  return [
    { id: 'n1', type: 'gain', params: { level: 1 } },
    { id: 'n2', type: 'gain', params: { level: 2 } },
    { id: 'n3', type: 'limiter', params: { level: 0 } }
  ];
}

var TIDY = { x: 16, row: 160 };

// ----------------------------------------------------------------------
console.log('A. wiring (PD-1: chain Sortable retired, palette kept)');
check(
  SortableStub.instances.length === 1 &&
    SortableStub.instances[0].el === paletteListEl,
  'A1: exactly ONE Sortable instance — the PALETTE (the chain instance is retired)'
);
check(
  CC.GRID_PITCH === 16 && typeof CC.snapToGrid === 'function' &&
    typeof CC.tidyChain === 'function' && typeof CC.currentLayout === 'function',
  'A2: the FEW-2 seams export (GRID_PITCH 16, snapToGrid, tidyChain, currentLayout)'
);
check(CC.snapToGrid(55) === 48 && CC.snapToGrid(-7) === 0, 'A3: snapToGrid quantizes to the 16px pitch');
check(
  queryAll(canvasPanelEl, '.tidy-toggle').length === 1,
  'A4: the TIDY control is built in the canvas chrome (flow-toggle zone)'
);

// ----------------------------------------------------------------------
console.log('B. loadModel auto-layouts the tidy stack when no layout is given');
CC.loadModel(model());
check(
  JSON.stringify(CC.currentLayout()) === JSON.stringify({
    n1: { x: TIDY.x, y: 0, scale: 1, flow: 'vertical' },
    n2: { x: TIDY.x, y: TIDY.row, scale: 1, flow: 'vertical' },
    n3: { x: TIDY.x, y: 2 * TIDY.row, scale: 1, flow: 'vertical' }
  }),
  'B1: absent layout -> the incumbent vertical stack (x=16, one row pitch per node)'
);
check(
  cardById('n2').style.transform === 'translate(16px, 160px)',
  'B2: positions are painted as translate() style on each card'
);
check(
  chainListEl.style.minHeight === '480px',
  'B3: the board extent covers the lowest seat (scrollable panel)'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'B4: DOM order equals chain order (PD-4)'
);

// ----------------------------------------------------------------------
console.log('C. grip pointer-drag MOVES POSITION — never order');
var modelBefore = JSON.stringify(CC.getCurrentModel());
var domBefore = JSON.stringify(domOrder());
var savesBefore = saves.length;

var h2 = handleOf('n2');
h2.__fire('pointerdown', { clientX: 100, clientY: 100, button: 0 });
check(CC.isDragActive() === true, 'C1: the gesture marks the drag active (agent-queue discipline)');
check(
  parseInt(cardById('n2').style.zIndex, 10) > 0 &&
    parseInt(cardById('n1').style.zIndex || '0', 10) < parseInt(cardById('n2').style.zIndex, 10),
  'C2: pointerdown brings the section to FRONT (z-order only)'
);

documentStub.__fire('pointermove', { clientX: 139, clientY: 122 });
check(
  CC.currentLayout().n2.x === 48 && CC.currentLayout().n2.y === 176,
  'C3: the move is snap-quantized to the grid (16+39 -> 48, 160+22 -> 176)'
);
check(
  cardById('n2').style.transform === 'translate(48px, 176px)',
  'C4: the snapped seat is painted live during the drag'
);
check(saves.length === savesBefore, 'C5: NO save during pointermove (persist on move-end only)');

documentStub.__fire('pointerup', {});
check(CC.isDragActive() === false, 'C6: the gesture ends the drag flag');
check(
  saves.length === savesBefore + 1 &&
    saves[saves.length - 1].layout &&
    saves[saves.length - 1].layout.n2.x === 48 &&
    saves[saves.length - 1].layout.n2.y === 176,
  'C7: move-end persists the layout through the FEW-1 store seam (exactly one save)'
);
check(
  JSON.stringify(CC.getCurrentModel()) === modelBefore &&
    JSON.stringify(domOrder()) === domBefore,
  'C8: ORDER PROVABLY UNTOUCHED — model + DOM byte-stable across the drag'
);
check(builds.length === 0, 'C9: a position move never rebuilds the audio graph (zero buildGraph calls)');

// ----------------------------------------------------------------------
console.log('D. reload round-trip: the saved layout reapplies exactly');
CC.loadModel(model(), saves[saves.length - 1].layout);
check(
  CC.currentLayout().n2.x === 48 && CC.currentLayout().n2.y === 176 &&
    CC.currentLayout().n1.y === 0 && CC.currentLayout().n3.y === 320,
  'D1: loadModel(model, savedLayout) restores every seat exactly (round-trip)'
);

// ----------------------------------------------------------------------
console.log('E. TIDY compacts — a single column collapses to the stack, an arrangement keeps its shape');
CC.tidyChain();
var tidied = CC.currentLayout();
check(
  tidied.n1.x === 16 && tidied.n1.y === 0 &&
    tidied.n2.x === 16 && tidied.n2.y === TIDY.row &&
    tidied.n3.x === 16 && tidied.n3.y === 2 * TIDY.row,
  'E1: TIDY compacts the seats (the near-stack column collapses to the exact incumbent stack)'
);
var tidySave = saves[saves.length - 1];
check(
  !!tidySave.layout && tidySave.layout.n2.x === 16 && tidySave.layout.n2.y === 160,
  'E2: TIDY persists the tidied layout through the store seam'
);
// scale/flow survive TIDY (they are FEW-5/6's fields — TIDY rewrites x/y only)
CC.loadModel(model(), {
  n1: { x: 48, y: 176, scale: 1.5, flow: 'horizontal' },
  n2: { x: 16, y: 0 },
  n3: { x: 16, y: 160 }
});
CC.tidyChain();
// 2026-08-31 compaction round: TIDY no longer re-stacks by chain order —
// it PRESERVES the arrangement. n1 (y=176) genuinely shares n3's band
// (y=160, 16px apart), so compaction keeps it BESIDE n3 in row 2 rather
// than returning it to the stack's top seat.
check(
  CC.currentLayout().n1.scale === 1.5 && CC.currentLayout().n1.flow === 'horizontal' &&
    CC.currentLayout().n1.x === 16 && CC.currentLayout().n1.y === TIDY.row &&
    CC.currentLayout().n2.y === 0 && CC.currentLayout().n3.y === TIDY.row,
  'E3: TIDY preserves each entry\'s scale/flow AND the arrangement (n1 keeps its band beside n3 — no re-stack by chain order)'
);

// ----------------------------------------------------------------------
console.log('E2D. TIDY on a deliberately 2D arrangement preserves the topology');
// A scatter with real dead space: n2 far right of n1, n3 well below.
// Compaction packs each band flush against its predecessor (one tidy
// pitch of air) — the 2D shape survives, the gaps close, and nothing
// collapses into a single chain-ordered line.
CC.loadModel(model(), {
  n1: { x: 16, y: 0 },
  n2: { x: 400, y: 0 },
  n3: { x: 16, y: 400 }
});
CC.tidyChain();
var twoD = CC.currentLayout();
check(
  twoD.n1.x === 16 && twoD.n1.y === 0 &&
    twoD.n2.x === 16 + 240 + 16 && twoD.n2.y === 0 &&
    twoD.n3.x === 16 && twoD.n3.y === TIDY.row,
  'E4: the gaps collapse to exactly one tidy pitch (n2 flush right of n1, n3 one row below) — the arrangement is preserved, never re-stacked'
);

// ----------------------------------------------------------------------
console.log('F. removal prunes the live layout map');
removeBtnOf('n3').__fire('click', {});
check(
  !CC.currentLayout().n3 && Object.keys(CC.currentLayout()).length === 2,
  'F1: removing a node drops its board position (layout garbage-free)'
);
var lastSave = saves[saves.length - 1];
check(
  !!lastSave.layout && !lastSave.layout.n3,
  'F2: the post-removal save carries no position for the removed id'
);

// ----------------------------------------------------------------------
console.log('G. the palette add verb places at the FIRST FREE GRID SLOT');
CC.tidyChain(); // n1@0, n2@160 (n3 removed) — next free row is 320
var idsBefore = domOrder().slice();
CC.addNodeType('gain');
var newId = domOrder().filter(function (id) { return idsBefore.indexOf(id) === -1; })[0];
check(!!newId, 'G1: addNodeType mints and appends a fresh card');
check(
  CC.currentLayout()[newId].x === 16 && CC.currentLayout()[newId].y === TIDY.row,
  'G2: the new section lands at the first free grid slot (16, 160 — the compacted board\'s lowest measured bottom)'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(idsBefore.concat([newId])),
  'G3: with no terminal limiter left (removed in F), the add appends at the END of the chain'
);
// The terminal-limiter guard still holds when a limiter IS terminal:
CC.loadModel(model(), null); // n3 (limiter) back, terminal — board tidy
CC.tidyChain();
CC.addNodeType('gain');
check(
  domOrder()[domOrder().length - 1] === 'n3',
  'G4: a terminal limiter STAYS terminal across an add (insert-before policy unchanged)'
);

if (failures.length === 0) {
  console.log('PASS: free positioning + TIDY (FEW-2)');
  process.exit(0);
}
console.log('FAIL: ' + failures.length + ' check(s) failed:');
failures.forEach(function (label) { console.log('  - ' + label); });
process.exit(1);
