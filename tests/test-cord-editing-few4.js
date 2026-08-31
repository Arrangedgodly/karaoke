// Test for cycle-4 FEW-4 — cord EDITING semantics: order-by-cord, never
// gating audio.
//
// Scope under test (the REAL src/canvas.js in the FEW-3 vm harness — a
// minimal DOM that provides #chain-canvas, so the cord layer and its
// jack points render):
//   - All FOUR link-point types relink end-to-end (mic-out = FIRST,
//     OUT-end on B's IN = BEFORE B, IN-end on B's OUT = AFTER B,
//     out-anchor IN = LAST), each through exactly ONE buildGraph call
//     and ONE autosave (the single commitStructuralChange chokepoint).
//   - The revert path (drop nowhere, incompatible target, Escape,
//     pointercancel, and a drop that moves nothing) leaves model + DOM
//     + cords BYTE-unchanged and fires ZERO rebuilds — an unplug is an
//     edit, never an audio change.
//   - The deliberate-drag threshold: a sub-threshold press+release is a
//     complete no-op (no ghost, no dragActive, no state).
//   - MC-4 agent queue: isDragActive() goes true only at DETACH and
//     false at gesture end, so a queued set_param applies after the
//     drag's commit (the mcp-tools waitForDragSettle seam, exercised at
//     the flag it polls).
//   - The ghost + hot-target highlight are paint-only and always
//     teardown; the FEW-3 DOM contracts survive (layer last child,
//     nothing cord-related in #chain-list).
//
// Same committed zero-dependency convention: plain `node`, run via
// `node tests/run.js cord-editing`.

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
// Minimal fake DOM — the FEW-3 harness verbatim (the FEW-2 harness plus
// the #chain-canvas face carrying index.html's real child order).
// ----------------------------------------------------------------------
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
  this.setAttribute = function (k, v) {
    self.attrs[k] = String(v);
    // Real DOM sync: setting the class attribute updates className (and
    // classList reads it) — required since production classes SVG
    // elements via setAttribute (SVGElement.className is read-only).
    if (k === 'class' && self.className !== String(v)) { self.className = String(v); }
  };
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

var paletteListEl = new FakeElement('div');
var chainListEl = new FakeElement('div');
var emptyHintEl = new FakeElement('div');
var layoutEl = new FakeElement('div');
var canvasPanelEl = new FakeElement('div');
canvasPanelEl.className = 'canvas-panel';
var canvasFaceEl = new FakeElement('div'); // #chain-canvas — the cord layer's host
var micAnchorEl = new FakeElement('div');
micAnchorEl.className = 'anchor';
var outAnchorEl = new FakeElement('div');
outAnchorEl.className = 'anchor';
var arrowElA = new FakeElement('span');
arrowElA.className = 'arrow';
var arrowElB = new FakeElement('span');
arrowElB.className = 'arrow';
canvasFaceEl.appendChild(micAnchorEl);
canvasFaceEl.appendChild(arrowElA);
canvasFaceEl.appendChild(chainListEl);
canvasFaceEl.appendChild(emptyHintEl);
canvasFaceEl.appendChild(arrowElB);
canvasFaceEl.appendChild(outAnchorEl);
// No offsetLeft/offsetTop on chainListEl — board origin is {0, 0}, so
// the pins below are the positions map verbatim (the FEW-3 contract).

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
  // NO createElementNS — the fallback path a stripped host takes.
  getElementById: function (id) {
    if (id === 'palette-list') { return paletteListEl; }
    if (id === 'chain-list') { return chainListEl; }
    if (id === 'empty-hint') { return emptyHintEl; }
    if (id === 'chain-layout') { return layoutEl; }
    if (id === 'chain-canvas') { return canvasFaceEl; }
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
// Stub collaborators + the REAL canvas.js. Unlike the FEW-3 harness the
// engine IS started here so rebuildGraph() actually reaches
// AudioGraph.buildGraph — the single-rebuild assertions count real calls.
// ----------------------------------------------------------------------
function SortableStub(el, opts) { SortableStub.instances.push({ el: el, opts: opts }); }
SortableStub.instances = [];

var saves = [];
var buildCount = 0;

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
    buildGraph: function (model) {
      buildCount += 1;
      sandbox.__lastBuilt = model;
    },
    getModel: function () { return []; }
  },
  AudioEngine: { isStarted: true },
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
sandbox.__lastBuilt = null;
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

function domOrder() {
  return cards().map(function (c) { return c.attrs['data-node-id']; });
}

function modelIds() {
  return CC.getCurrentModel().map(function (e) { return e.id; });
}

function cordLayer() {
  var found = queryAll(canvasFaceEl, '.cord-layer');
  return found.length === 1 ? found[0] : null;
}

function cordPaths() {
  var layer = cordLayer();
  return layer ? queryAll(layer, '.cord') : [];
}

function jackEls() {
  var layer = cordLayer();
  return layer ? queryAll(layer, '.cord-jack') : [];
}

function ghostEl() {
  var layer = cordLayer();
  var found = layer ? queryAll(layer, '.cord-ghost') : [];
  return found.length > 0 ? found[0] : null;
}

function segRoute() {
  return cordPaths().map(function (p) {
    return p.attrs['data-from'] + '>' + p.attrs['data-to'];
  });
}

function jackAt(kind, nodeId) {
  var found = null;
  jackEls().some(function (el) {
    if (el.attrs['data-jack-kind'] === kind &&
        (!nodeId || el.attrs['data-node-id'] === nodeId)) {
      found = el;
      return true;
    }
    return false;
  });
  return found;
}

function anyHotJack() {
  return jackEls().filter(function (el) {
    return el.classList.contains('cord-jack-hot');
  });
}

function model3() {
  return [
    { id: 'n1', type: 'gain', params: { level: 1 } },
    { id: 'n2', type: 'gain', params: { level: 2 } },
    { id: 'n3', type: 'limiter', params: { level: 0 } }
  ];
}

// Board-space jack constants (src/canvas.js, OQ-9 geometry): mic
// (16,-32) and out-in (16,176) — the layout-less panel fallbacks; a
// section's jacks sit ON its border, DIRECTLY ACROSS each other over the
// placeholder card box (160w x 48h): since vertical flow was retired
// (2026-08-31) every card reads IN at the middle of its LEFT border, OUT
// at the middle of its RIGHT. Row seats: n1 x=0, n2 x=144, n3 x=288
// (all y=16 — the 128px floor + 16 pitch).
var MIC_OUT = { x: 16, y: -32 };
var OUT_IN = { x: 16, y: 176 };
var CARD_W = 160;
var CARD_H = 48;
var SEAT_X = { n1: 0, n2: 144, n3: 288 };
function seatIn(id) {
  return { x: SEAT_X[id], y: 16 + CARD_H / 2 };
}
function seatOut(id) {
  return { x: SEAT_X[id] + CARD_W, y: 16 + CARD_H / 2 };
}

function grabJack(kind, nodeId) {
  var el = jackAt(kind, nodeId);
  if (!el) {
    return null;
  }
  var pt = kind === 'section-in' ? seatIn(nodeId)
    : kind === 'section-out' ? seatOut(nodeId)
    : kind === 'mic-out' ? MIC_OUT : OUT_IN;
  el.__fire('pointerdown', { clientX: pt.x, clientY: pt.y, button: 0 });
  return el;
}

function move(pt) { documentStub.__fire('pointermove', { clientX: pt.x, clientY: pt.y }); }
function drop(pt) { documentStub.__fire('pointerup', { clientX: pt.x, clientY: pt.y }); }
function dropNowhere() { documentStub.__fire('pointerup', {}); }

function snapshot() {
  return {
    order: domOrder().join('|'),
    route: segRoute().join('|'),
    model: JSON.stringify(CC.getCurrentModel()),
    layout: JSON.stringify(CC.currentLayout())
  };
}

// ----------------------------------------------------------------------
console.log('A. jack points render with the FEW-3 contracts intact');
CC.loadModel(model3());
check(jackEls().length === 8, 'A1: 3 nodes -> 8 jack points (mic-out + out-in + 3 in + 3 out)');
check(
  !!jackAt('mic-out') && !!jackAt('out-in') &&
    !!jackAt('section-in', 'n1') && !!jackAt('section-out', 'n1') &&
    !!jackAt('section-in', 'n3') && !!jackAt('section-out', 'n3'),
  'A2: every jack carries its data-jack-kind (+ data-node-id on sections)'
);
check(cordPaths().length === 4, 'A3: the .cord path count is still nodes + 1 (FEW-3)');
check(
  jackEls().every(function (el) { return el.parentNode === cordLayer(); }) &&
    cordLayer() === canvasFaceEl.children[canvasFaceEl.children.length - 1],
  'A4: jacks live INSIDE the layer; the layer stays the face\'s LAST child'
);
check(
  chainListEl.children.length === 3 && queryAll(chainListEl, '.cord-jack').length === 0,
  'A5: nothing cord-related ever enters #chain-list (DOM order = chain order)'
);
var baseBuild = buildCount;
var baseSaves = saves.length;

// ----------------------------------------------------------------------
console.log('B. deliberate-drag threshold: a click on a jack is not an unplug');
grabJack('section-out', 'n2');
check(CC.isDragActive() === false, 'B1: press alone does not engage the drag flag');
move({ x: seatOut('n2').x + 3, y: seatOut('n2').y }); // 3px past n2's out-jack — sub-threshold
check(CC.isDragActive() === false && !ghostEl(), 'B2: sub-threshold move detaches nothing (no flag, no ghost)');
drop({ x: 99, y: 208 });
check(
  buildCount === baseBuild && saves.length === baseSaves &&
    domOrder().join('|') === 'n1|n2|n3' && !ghostEl() && CC.isDragActive() === false,
  'B3: sub-threshold release is a complete no-op (zero rebuilds, zero saves, no state)'
);

// ----------------------------------------------------------------------
console.log('C. relink 1/4 — a section\'s OUT end on B\'s IN jack inserts BEFORE B');
var before = snapshot();
grabJack('section-out', 'n1');
move({ x: 120, y: 60 }); // detaches (56px travel)
check(CC.isDragActive() === true, 'C1: past the threshold the edit is active (agent mutations queue)');
check(!!ghostEl() && ghostEl().attrs['data-drag-node'] === 'n1' && ghostEl().attrs['data-drag-end'] === 'out',
  'C2: the ghost cord follows the pointer from the still-plugged anchor');
check(
  before.order === domOrder().join('|') && before.route === segRoute().join('|'),
  'C3: mid-drag the DOM + cords are byte-unchanged (an unplug never mutates)'
);
move(seatIn('n3'));
check(
  jackAt('section-in', 'n3').classList.contains('cord-jack-hot') && anyHotJack().length === 1,
  'C4: the compatible target highlights (exactly one hot jack)'
);
drop(seatIn('n3'));
check(domOrder().join('|') === 'n2|n1|n3', 'C5: n1\'s OUT on n3\'s IN -> n1 inserted BEFORE n3 (n2, n1, n3)');
check(buildCount === baseBuild + 1, 'C6: exactly ONE buildGraph per committed relink');
check(saves.length === baseSaves + 1, 'C7: exactly ONE autosave per committed relink');
check(
  segRoute().join('|') === 'mic>n2|n2>n1|n1>n3|n3>out',
  'C8: the cords re-route to the committed order'
);
check(modelIds().join('|') === 'n2|n1|n3', 'C9: the canvas model follows the DOM (recompute ran)');
check(
  JSON.stringify(sandbox.__lastBuilt.map(function (e) { return e.id; })) === '["n2","n1","n3"]',
  'C10: the audio graph was built with the NEW order (the single duck/rebuild)'
);
check(
  !ghostEl() && anyHotJack().length === 0 && CC.isDragActive() === false,
  'C11: ghost + highlight teardown; the flag releases at gesture end'
);

// ----------------------------------------------------------------------
console.log('D. relink 2/4 — a section\'s IN end on B\'s OUT jack inserts AFTER B');
CC.loadModel(model3());
baseBuild = buildCount;
baseSaves = saves.length;
grabJack('section-in', 'n3');
move({ x: 90, y: 400 }); // detach
move(seatOut('n1'));
check(jackAt('section-out', 'n1').classList.contains('cord-jack-hot'),
  'D1: an IN end finds section OUT jacks compatible');
drop(seatOut('n1'));
check(domOrder().join('|') === 'n1|n3|n2', 'D2: n3\'s IN on n1\'s OUT -> n3 inserted AFTER n1 (n1, n3, n2)');
check(buildCount === baseBuild + 1 && saves.length === baseSaves + 1,
  'D3: one rebuild, one autosave (chokepoint discipline holds)');

// ----------------------------------------------------------------------
console.log('E. relink 3/4 — the mic-out point links the dragged node FIRST');
CC.loadModel(model3());
baseBuild = buildCount;
baseSaves = saves.length;
grabJack('section-in', 'n2');
move({ x: 60, y: 240 }); // detach
move(MIC_OUT);
check(jackAt('mic-out').classList.contains('cord-jack-hot'),
  'E1: the mic-out point highlights for an IN end');
drop(MIC_OUT);
check(domOrder().join('|') === 'n2|n1|n3', 'E2: mic-out links n2 as the FIRST node');
check(buildCount === baseBuild + 1 && saves.length === baseSaves + 1,
  'E3: one rebuild, one autosave');

// ----------------------------------------------------------------------
console.log('F. relink 4/4 — the out-anchor IN point links the dragged node LAST');
CC.loadModel(model3());
baseBuild = buildCount;
baseSaves = saves.length;
grabJack('section-out', 'n1');
move({ x: 120, y: 120 }); // detach
move(OUT_IN);
check(jackAt('out-in').classList.contains('cord-jack-hot'),
  'F1: the out-anchor IN point highlights for an OUT end');
drop(OUT_IN);
check(domOrder().join('|') === 'n2|n3|n1', 'F2: out-in links n1 as the LAST node');
check(buildCount === baseBuild + 1 && saves.length === baseSaves + 1,
  'F3: one rebuild, one autosave');

// ----------------------------------------------------------------------
console.log('G. revert — drop nowhere leaves model + DOM + cords byte-unchanged');
CC.loadModel(model3());
baseBuild = buildCount;
baseSaves = saves.length;
var g0 = snapshot();
grabJack('section-out', 'n2');
move({ x: 300, y: 300 }); // detach, hover over no jack
drop({ x: 300, y: 300 });
var g1 = snapshot();
check(
  g0.order === g1.order && g0.route === g1.route && g0.model === g1.model && g0.layout === g1.layout,
  'G1: drop nowhere -> DOM, cords, model, layout all byte-unchanged'
);
check(buildCount === baseBuild && saves.length === baseSaves,
  'G2: the revert fires ZERO rebuilds and ZERO saves');
check(!ghostEl() && anyHotJack().length === 0 && CC.isDragActive() === false,
  'G3: the gesture paints teardown completely');

// ----------------------------------------------------------------------
console.log('H. revert — incompatible targets and self-links');
// An IN end on a section IN jack is incompatible (order math has no such link).
grabJack('section-in', 'n2');
move({ x: 90, y: 240 }); // detach
move(seatIn('n3'));
check(anyHotJack().length === 0, 'H1: an IN end over a section IN jack highlights nothing');
drop(seatIn('n3'));
check(domOrder().join('|') === 'n1|n2|n3' && buildCount === baseBuild && saves.length === baseSaves,
  'H2: incompatible drop reverts (zero rebuilds, zero saves)');
// A self-link (own jacks) is never compatible.
grabJack('section-out', 'n2');
move({ x: 220, y: 240 }); // detach
drop(seatIn('n2'));
check(domOrder().join('|') === 'n1|n2|n3' && buildCount === baseBuild && saves.length === baseSaves,
  'H3: dropping on the node\'s own jack reverts (no self-link)');
// A drop that computes the SAME order commits nothing (SortableJS parity).
grabJack('section-out', 'n2');
move({ x: 220, y: 240 }); // detach
move(seatIn('n3'));
drop(seatIn('n3'));
check(
  domOrder().join('|') === 'n1|n2|n3' && buildCount === baseBuild && saves.length === baseSaves,
  'H4: n2 dropped where it already is (before n3) -> no-op, zero rebuilds'
);

// ----------------------------------------------------------------------
console.log('I. revert — Escape and pointercancel (the mid-show safety valves)');
grabJack('section-in', 'n1');
move({ x: 90, y: 60 }); // detach
documentStub.__fire('keydown', { key: 'Escape' });
check(
  domOrder().join('|') === 'n1|n2|n3' && buildCount === baseBuild && saves.length === baseSaves &&
    !ghostEl() && CC.isDragActive() === false,
  'I1: Escape mid-edit reverts with zero rebuilds'
);
grabJack('section-out', 'n3');
move({ x: 220, y: 400 }); // detach
documentStub.__fire('pointercancel', {});
check(
  domOrder().join('|') === 'n1|n2|n3' && buildCount === baseBuild && saves.length === baseSaves &&
    !ghostEl() && anyHotJack().length === 0,
  'I2: pointercancel reverts with zero rebuilds'
);
// A non-Escape key never cancels.
grabJack('section-out', 'n3');
move({ x: 220, y: 400 }); // detach
documentStub.__fire('keydown', { key: 'a' });
check(CC.isDragActive() === true, 'I3: a non-Escape key does not cancel the edit');
dropNowhere();
check(CC.isDragActive() === false, 'I4: the flag releases after the drop-nowhere end');

// ----------------------------------------------------------------------
console.log('J. agent queue — a queued set_param applies only after the gesture');
CC.loadModel(model3());
baseBuild = buildCount;
baseSaves = saves.length;
grabJack('section-out', 'n1');
move({ x: 120, y: 60 }); // detach
check(CC.isDragActive() === true, 'J1: isDragActive() is true mid-edit (the mcp-tools queue engages)');
// The mcp-tools waitForDragSettle seam, exercised at the flag it polls:
// while the flag stands the mutation is NOT applied; it applies after.
var queuedWhileDragging = CC.isDragActive();
var appliedEarly = false;
if (!queuedWhileDragging) {
  CC.updateNodeParam('n1', 'level', 9);
  appliedEarly = true;
}
check(queuedWhileDragging && !appliedEarly, 'J2: the mutation stays queued while the drag is live');
move(seatIn('n3'));
drop(seatIn('n3')); // commits n2, n1, n3
check(CC.isDragActive() === false, 'J3: the flag releases at the drag\'s end (the queue drains)');
CC.updateNodeParam('n1', 'level', 9); // the drained queued write
var applied = CC.getCurrentModel().filter(function (e) { return e.id === 'n1'; })[0];
check(!!applied && applied.params.level === 9, 'J4: the queued set_param applies AFTER the commit');
check(domOrder().join('|') === 'n2|n1|n3', 'J5: the committed order survived the queued write');

// ----------------------------------------------------------------------
console.log('K. final DOM contracts + the empty board');
check(
  // 2026-08-31: the MIC IN print row MOVED onto the display-register
  // strip (its fixed header home), so the face's first child is the
  // leading arrow — wait, the leading arrow is hidden by CSS but still
  // first in DOM order.
  canvasFaceEl.children[0] !== micAnchorEl &&
    micAnchorEl.parentNode && micAnchorEl.parentNode.classList.contains('display-register') &&
    canvasFaceEl.children[canvasFaceEl.children.length - 1] === cordLayer(),
  'K1: MIC IN lives on the register strip (not in the face); the layer is still the face\'s last child'
);
CC.loadModel([]);
check(cordPaths().length === 1 && jackEls().length === 2,
  'K2: empty chain -> the bypass cord + exactly the two PANEL jacks (mic-out, out-in) — nothing draggable'
);
check(jackAt('section-in', 'n1') === null && jackAt('section-out', 'n1') === null,
  'K3: no section jacks survive their sections (garbage-free hit targets)');
grabJack('mic-out'); // panel anchors are fixed hardware, never drag sources
move({ x: 100, y: 100 });
drop({ x: 100, y: 100 });
check(buildCount > 0 && domOrder().length === 0, 'K4: grabbing a panel anchor edits nothing (drop targets only)');

if (failures.length === 0) {
  console.log('PASS: cord editing (FEW-4)');
  process.exit(0);
}
console.log('FAIL: ' + failures.length + ' check(s) failed:');
failures.forEach(function (label) { console.log('  - ' + label); });
process.exit(1);
