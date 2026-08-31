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
console.log('A. wiring (PD-1: chain Sortable retired; palette drag retired 2026-08-31 — zero instances)');
check(
  SortableStub.instances.length === 0,
  'A1: ZERO Sortable instances (the chain instance retired by PD-1; the palette drag retired 2026-08-31 — click/keyboard are the add verbs)'
);
check(
  CC.GRID_PITCH === 16 && typeof CC.snapToGrid === 'function' &&
    typeof CC.currentLayout === 'function',
  'A2: the FEW-2 seams export (GRID_PITCH 16, snapToGrid, currentLayout — the tidy seam is retired with its button)'
);
check(CC.snapToGrid(55) === 48 && CC.snapToGrid(-7) === 0, 'A3: snapToGrid quantizes to the 16px pitch');

// ----------------------------------------------------------------------
console.log('B. loadModel auto-layouts the incumbent ROW when no layout is given (vertical flow retired 2026-08-31)');
CC.loadModel(model());
check(
  JSON.stringify(CC.currentLayout()) === JSON.stringify({
    n1: { x: 0, y: 16, scale: 1, flow: 'horizontal' },
    n2: { x: 144, y: 16, scale: 1, flow: 'horizontal' },
    n3: { x: 288, y: 16, scale: 1, flow: 'horizontal' }
  }),
  'B1: absent layout -> the incumbent ROW (x accumulates the 128px floor + 16 pitch, y at the grid edge)'
);
check(
  cardById('n2').style.transform === 'translate(144px, 16px)' &&
    cardById('n2').style.width === '128px',
  'B2: positions + the floor width are painted as styles on each card'
);
check(
  chainListEl.style.minHeight === '176px' && chainListEl.style.minWidth === '432px',
  'B3: the board extent covers the row\'s right edge (both axes maintained)'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'B4: DOM order equals chain order (PD-4)'
);

// ----------------------------------------------------------------------
console.log('B2. freshSeats (2026-08-31, #16 stale-seats finding): preset loads re-place, agent rebuilds carry forward');
// Move n2 somewhere odd first, so carry-forward vs fresh placement are
// distinguishable on the next load.
CC.loadModel(model());
documentStub.__fire('pointermove', { clientX: 139, clientY: 122 }); // (a live drag arm+move from section C's shape)
documentStub.__fire('pointerup', {});
// The default rule (agent rebuild / startup restore): matching ids KEEP
// their seats.
var carried = JSON.stringify(CC.currentLayout());
CC.loadModel(model());
check(
  JSON.stringify(CC.currentLayout()) === carried,
  'B2-1: default loadModel CARRIES FORWARD the current seats (agent rebuild keeps operator placement)'
);
// freshSeats (preset load): matching ids do NOT inherit — first-free stack.
CC.loadModel(model(), null, { freshSeats: true });
check(
  CC.currentLayout().n1.x === 0 && CC.currentLayout().n2.x === 144 &&
    CC.currentLayout().n3.x === 288 && CC.currentLayout().n1.y === 16,
  'B2-2: freshSeats re-places every section on the incumbent ROW (the documented tidy preset layout)'
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
  CC.currentLayout().n2.x === 176 && CC.currentLayout().n2.y === 32,
  'C3: the move is snap-quantized to the grid (144+39 -> 176, 16+22 -> 32)'
);
check(
  cardById('n2').style.transform === 'translate(176px, 32px)',
  'C4: the snapped seat is painted live during the drag'
);
check(saves.length === savesBefore, 'C5: NO save during pointermove (persist on move-end only)');

documentStub.__fire('pointerup', {});
check(CC.isDragActive() === false, 'C6: the gesture ends the drag flag');
check(
  saves.length === savesBefore + 1 &&
    saves[saves.length - 1].layout &&
    saves[saves.length - 1].layout.n2.x === 176 &&
    saves[saves.length - 1].layout.n2.y === 32,
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
  CC.currentLayout().n2.x === 176 && CC.currentLayout().n2.y === 32 &&
    CC.currentLayout().n1.y === 16 && CC.currentLayout().n3.x === 288,
  'D1: loadModel(model, savedLayout) restores every seat exactly (round-trip)'
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
var idsBefore = domOrder().slice();
CC.addNodeType('gain');
var newId = domOrder().filter(function (id) { return idsBefore.indexOf(id) === -1; })[0];
check(!!newId, 'G1: addNodeType mints and appends a fresh card');
check(
  CC.currentLayout()[newId].x === 320 && CC.currentLayout()[newId].y === TIDY.x,
  'G2: the new section lands at the first free grid slot (320, 16 — right of the row\'s rightmost card)'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(idsBefore.concat([newId])),
  'G3: with no terminal limiter left (removed in F), the add appends at the END of the chain'
);
// The terminal-limiter guard still holds when a limiter IS terminal:
CC.loadModel(model(), null); // n3 (limiter) back, terminal — board tidy
CC.addNodeType('gain');
check(
  domOrder()[domOrder().length - 1] === 'n3',
  'G4: a terminal limiter STAYS terminal across an add (insert-before policy unchanged)'
);

if (failures.length === 0) {
  console.log('PASS: free positioning (FEW-2)');
  process.exit(0);
}
console.log('FAIL: ' + failures.length + ' check(s) failed:');
failures.forEach(function (label) { console.log('  - ' + label); });
process.exit(1);
