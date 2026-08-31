// Test for cycle-4 A11Y-1 — order-based reading + focus rules on the
// free board (PD-4: DOM order = chain order ALWAYS; position is visual
// only).
//
// Scope under test (the REAL src/canvas.js in the FEW-3/FEW-4 vm harness
// — a minimal DOM providing #chain-canvas so the cord layer + jack
// points render — EXTENDED with browser-faithful focus tracking: a
// focus() that records every focus/blur call and dispatches a bubbling
// 'focusin', plus a document.activeElement):
//   (a) DOM/tab order equals CHAIN order across EVERY order-changing
//       gesture: cord relink (all four FEW-4 link-point types), keyboard
//       add with the terminal-limiter insert-before splice, remove x,
//       agent loadModel. The tab order is computed the way a browser
//       computes sequential focus navigation: depth-first DOM walk
//       collecting natively-focusable, non-disabled elements (an SVG
//       circle without tabindex is never one).
//   (b) The cord SVG layer is aria-hidden decorative and POINTER-INERT
//       (CSS pointer-events:none on .cord-layer) while its jack points
//       stay pointer-interactive for cords (.cord-jack turns
//       pointer-events back on, carries a pointerdown listener, and —
//       being focusable-less SVG circles with NO tabindex — sit outside
//       the tab flow entirely).
//   (c) bring-to-front on pointerdown is z-ORDER ONLY: no focus()/blur()
//       call, activeElement untouched, DOM order untouched — across a
//       card press, a full grip position-drag, and a jack grab.
//   (d) The focus-ring z-floor: .node-card carries a z-index FLOOR in
//       styles/main.css (above the cord layer's z-index 0) and a card
//       whose control RECEIVES focus is raised above a previously
//       fronted overlapping card (bring-to-front on focus — the ring
//       can never be occluded by a neighbor's paint).
//
// The keyboard add path's own behavior (chip button semantics, the
// insert-before-limiter policy's commit/autosave/revision consequences)
// is already covered and is NOT duplicated here: see
// tests/test-palette-cards-cycle3.js section D (R2-2 keyboard add) and
// tests/test-cord-layer-few3.js section F (the terminal-limiter splice).
// This file gates only its DOM/tab-order consequence, which is A11Y-1's.
//
// Same committed zero-dependency convention: plain `node`, run via
// `node tests/run.js order-focus`.

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
// Minimal fake DOM — the FEW-3/FEW-4 harness (a minimal DOM providing
// #chain-canvas with index.html's real child order) + focus tracking:
// every focus()/blur() lands in focusLog, focus() dispatches a bubbling
// 'focusin' (the real event's one job — it exists precisely because
// 'focus' itself does not bubble), and document.activeElement moves.
// ----------------------------------------------------------------------
var focusLog = [];
var documentStub; // assigned below — focus() closures read it late

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
  // Browser-faithful focus: record, become activeElement, dispatch a
  // BUBBLING focusin (target stays the focused element; every ancestor
  // listener fires — exactly how the real event reaches the card).
  this.focus = function () {
    if (self.disabled) { return; }
    focusLog.push({ type: 'focus', el: self });
    documentStub.activeElement = self;
    fireBubbling(self, 'focusin');
  };
  this.blur = function () {
    focusLog.push({ type: 'blur', el: self });
    if (documentStub.activeElement === self) { documentStub.activeElement = null; }
  };
  this.querySelectorAll = function (selector) { return queryAll(self, selector); };
  this.querySelector = function (selector) { return queryAll(self, selector)[0] || null; };
  this.__classes = classes;
}

function fireBubbling(el, type) {
  var event = { type: type, target: el };
  var node = el;
  while (node) {
    (node.listeners[type] || []).slice().forEach(function (fn) {
      fn(event);
    });
    node = node.parentNode;
  }
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
// jack coordinates below are the positions map verbatim (FEW-3/4 contract).

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

documentStub = {
  createElement: function (tag) { return new FakeElement(tag); },
  // NO createElementNS — the fallback path a stripped host takes.
  activeElement: null,
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
// Stub collaborators + the REAL canvas.js.
// ----------------------------------------------------------------------
function SortableStub(el, opts) { SortableStub.instances.push({ el: el, opts: opts }); }
SortableStub.instances = [];

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
    buildGraph: function () {},
    getModel: function () { return []; }
  },
  AudioEngine: { isStarted: true },
  Persistence: {
    saveCurrentChain: function () {}
  }
};
sandbox.window = sandbox;
sandbox.window.localStorage = undefined;
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

function cardById(id) {
  var found = null;
  cards().some(function (c) {
    if (c.attrs['data-node-id'] === id) { found = c; return true; }
    return false;
  });
  return found;
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

function cordLayer() {
  var found = queryAll(canvasFaceEl, '.cord-layer');
  return found.length === 1 ? found[0] : null;
}

function jackEls() {
  var layer = cordLayer();
  return layer ? queryAll(layer, '.cord-jack') : [];
}

// --- Tab order: sequential focus navigation = depth-first DOM walk of
// natively-focusable, non-disabled elements (SVG circles without a
// tabindex attribute are never stops — how FEW-4 built the jacks).
var NATIVE_FOCUSABLE = { button: true, input: true, select: true, textarea: true };

function isTabStop(el) {
  if (!el || !el.tagName) { return false; }
  var tb = el.getAttribute('tabindex');
  if (tb !== null) {
    var n = parseInt(tb, 10);
    return !isNaN(n) && n >= 0;
  }
  return NATIVE_FOCUSABLE[String(el.tagName).toLowerCase()] === true && !el.disabled;
}

function tabStops(root) {
  var out = [];
  (function walk(el) {
    (el.children || []).forEach(function (child) {
      if (isTabStop(child)) { out.push(child); }
      walk(child);
    });
  })(root);
  return out;
}

/** The chain of owning-card ids in TAB order (stops outside any card —
 *  the anchors — are skipped; the chain's stops are what PD-4 orders). */
function tabCardOrder() {
  var seq = [];
  tabStops(canvasFaceEl).forEach(function (stop) {
    var node = stop.parentNode;
    var owner = null;
    while (node) {
      if (node.classList && node.classList.contains('node-card')) { owner = node; break; }
      node = node.parentNode;
    }
    if (owner) { seq.push(owner.attrs['data-node-id']); }
  });
  return seq;
}

/** The tab order, deduped to card sequence, must EQUAL the DOM card
 *  order — and every card must contribute at least one stop. */
function tabOrderEqualsDomOrder() {
  var dom = domOrder();
  var seq = tabCardOrder();
  var deduped = seq.filter(function (id, i) { return i === 0 || seq[i - 1] !== id; });
  return deduped.length === dom.length && deduped.every(function (id, i) { return id === dom[i]; });
}

// --- Jack coordinates, computed from the LIVE positions map (the board
// may no longer be at the tidy stack after earlier gestures). OQ-9
// geometry: a section's jacks sit ON its border, DIRECTLY ACROSS each
// other over the placeholder card box (160w x 48h) — vertical flow: IN
// at the seat's top-center, OUT at its bottom-center.
var CARD_W = 160;
var CARD_H = 48;
var MIC_OUT = { x: 16, y: -32 };

function jackPt(kind, id) {
  if (kind === 'mic-out') { return MIC_OUT; }
  var layout = CC.currentLayout();
  if (kind === 'out-in') {
    var maxY = 0;
    Object.keys(layout).forEach(function (k) {
      if (layout[k].y > maxY) { maxY = layout[k].y; }
    });
    return { x: 16, y: maxY + 160 };
  }
  var seat = layout[id] || { x: 16, y: 0 };
  return kind === 'section-in'
    ? { x: seat.x + CARD_W / 2, y: seat.y }
    : { x: seat.x + CARD_W / 2, y: seat.y + CARD_H };
}

function grabJack(kind, id) {
  var found = null;
  jackEls().some(function (el) {
    if (el.attrs['data-jack-kind'] === kind &&
        (!id || el.attrs['data-node-id'] === id)) {
      found = el;
      return true;
    }
    return false;
  });
  if (!found) { return null; }
  var pt = jackPt(kind, id);
  found.__fire('pointerdown', { clientX: pt.x, clientY: pt.y, button: 0 });
  return found;
}

function move(pt) { documentStub.__fire('pointermove', { clientX: pt.x, clientY: pt.y }); }
function drop(pt) { documentStub.__fire('pointerup', { clientX: pt.x, clientY: pt.y }); }

/** Drive one complete cord relink: grab a section's jack end, cross the
 *  detach threshold, drop exactly on the target jack point. */
function relink(grabKind, grabId, targetKind, targetId) {
  grabJack(grabKind, grabId);
  var t = jackPt(targetKind, targetId);
  var g = jackPt(grabKind, grabId);
  move({ x: (g.x + t.x) / 2, y: (g.y + t.y) / 2 }); // cross the 6px threshold
  drop(t);
}

function model3() {
  return [
    { id: 'n1', type: 'gain', params: { level: 1 } },
    { id: 'n2', type: 'gain', params: { level: 2 } },
    { id: 'n3', type: 'limiter', params: { level: 0 } }
  ];
}

function resetBoard() {
  CC.loadModel(model3());
  focusLog.length = 0;
  documentStub.activeElement = null;
}

// --- CSS block extraction (the z-floor rules live in styles/main.css).
function cssBlock(selector) {
  var css = fs.readFileSync(path.join(ROOT, 'styles', 'main.css'), 'utf8');
  var needle = selector + ' {';
  var idx = css.indexOf(needle);
  if (idx === -1) {
    needle = selector + '{';
    idx = css.indexOf(needle);
  }
  if (idx === -1) { return null; }
  var open = css.indexOf('{', idx);
  var depth = 1;
  var i = open + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') { depth += 1; }
    else if (css[i] === '}') { depth -= 1; }
    i += 1;
  }
  return css.slice(open + 1, i - 1);
}

function cssDecl(block, prop) {
  if (!block) { return null; }
  var m = new RegExp(prop + '\\s*:\\s*([^;]+);').exec(block);
  return m ? m[1].trim() : null;
}

function zIndexBlockInt(block) {
  var v = cssDecl(block, 'z-index');
  return v === null ? null : parseInt(v, 10);
}

// ----------------------------------------------------------------------
console.log('A. baseline: DOM order = tab order = chain order (PD-4)');
resetBoard();
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']) &&
    JSON.stringify(modelIds()) === JSON.stringify(['n1', 'n2', 'n3']),
  'A1: loadModel paints DOM order == model order verbatim (n1, n2, n3)'
);
check(
  tabOrderEqualsDomOrder(),
  'A2: the tab order through the board equals the DOM card order (chain order)'
);
check(
  tabCardOrder().length === 6,
  'A3: every section contributes its controls to the tab flow (3 sections x collapse + remove)'
);

// ----------------------------------------------------------------------
console.log('B. cord relinks (FEW-4 machinery) keep DOM = tab = chain');
relink('section-in', 'n3', 'section-out', 'n1'); // n3's IN on n1's OUT: AFTER n1
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n3', 'n2']),
  'B1: IN-end relink on a section OUT jack: DOM order is the new chain order (n1, n3, n2)'
);
check(
  JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'B2: the recomputed model equals the DOM order (relink changed order, nothing else)'
);
check(tabOrderEqualsDomOrder(), 'B3: the tab order followed the relink');

resetBoard();
relink('section-out', 'n1', 'out-in'); // n1's OUT on the out anchor: LAST
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n2', 'n3', 'n1']),
  'B4: OUT-end relink on the out-anchor IN point: the dragged section is LAST in DOM order'
);
check(tabOrderEqualsDomOrder(), 'B5: the tab order followed (n2, n3, n1)');

resetBoard();
relink('section-in', 'n2', 'mic-out'); // n2's IN on the mic panel: FIRST
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n2', 'n1', 'n3']),
  'B6: IN-end relink on the mic-out point: the dragged section is FIRST in DOM order'
);
check(tabOrderEqualsDomOrder(), 'B7: the tab order followed (n2, n1, n3)');

resetBoard();
relink('section-out', 'n2', 'section-in', 'n3'); // n2's OUT on n3's IN: BEFORE n3
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']) &&
    JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'B8: OUT-end relink onto its own successor\'s IN jack computes the SAME order — a no-op (moves nothing, commits nothing), DOM = model still holds'
);
check(
  jackEls().length === 8 &&
    jackEls().every(function (el) { return !isTabStop(el); }),
  'B9: after relinks the jack points are still 8 and still NEVER tab stops'
);

// ----------------------------------------------------------------------
console.log('C. keyboard add (terminal-limiter splice), remove, agent loadModel');
resetBoard();
var idsBefore = domOrder().slice();
CC.addNodeType('gain'); // insert-before-terminal-limiter policy (R2-2)
var order = domOrder();
var newId = order.filter(function (id) { return idsBefore.indexOf(id) === -1; })[0];
check(
  JSON.stringify(order) === JSON.stringify(['n1', 'n2', newId, 'n3']),
  'C1: the keyboard add splices BEFORE the terminal limiter — DOM order is the new chain order'
);
check(tabOrderEqualsDomOrder(), 'C2: the tab order followed the splice');
check(
  JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'C3: the model equals the DOM order after the keyboard add'
);

removeBtnOf(newId).__fire('click', {});
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'C4: remove x closes the chain — DOM order is the shortened chain order'
);
check(tabOrderEqualsDomOrder(), 'C5: the tab order followed the removal');
check(
  JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'C6: the model equals the DOM order after the removal'
);

CC.loadModel([
  { id: 'z9', type: 'gain', params: { level: 1 } },
  { id: 'a1', type: 'gain', params: { level: 2 } },
  { id: 'm5', type: 'limiter', params: { level: 0 } }
]);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['z9', 'a1', 'm5']) &&
    JSON.stringify(modelIds()) === JSON.stringify(['z9', 'a1', 'm5']),
  'C7: agent loadModel rebuilds DOM order == model order verbatim (position never leaks into order)'
);
check(tabOrderEqualsDomOrder(), 'C8: the tab order equals the agent-loaded chain order');

// ----------------------------------------------------------------------
console.log('D. cord layer + jack points: aria-hidden, pointer-inert to AT, pointer-live for cords');
resetBoard();
var layer = cordLayer();
check(
  !!layer && layer.attrs['aria-hidden'] === 'true',
  'D1: the cord SVG layer is aria-hidden decorative (AT never reads cords or jacks)'
);
check(
  jackEls().every(function (el) { return el.getAttribute('tabindex') === null; }),
  'D2: every jack point carries NO tabindex — the SVG circles FEW-4 built are outside the tab flow as-built'
);
check(
  jackEls().every(function (el) {
    return (el.listeners.pointerdown || []).length >= 1;
  }),
  'D3: every jack point carries its pointerdown grab listener (pointer-interactive for cords)'
);
check(
  tabStops(layer).length === 0,
  'D4: the ENTIRE cord layer contributes zero tab stops'
);
check(
  cssDecl(cssBlock('.cord-layer'), 'pointer-events') === 'none',
  'D5: CSS .cord-layer is pointer-events:none — the layer is pointer-inert'
);
check(
  cssDecl(cssBlock('.cord-jack'), 'pointer-events') === 'all',
  'D6: CSS .cord-jack turns pointer-events back ON — jacks alone are grabbable'
);

// ----------------------------------------------------------------------
console.log('E. bring-to-front on pointerdown: z-order only, focus + order untouched');
resetBoard();
var n1Remove = removeBtnOf('n1');
n1Remove.focus(); // a control inside n1 currently holds focus
focusLog.length = 0; // only gesture-driven focus moves count from here
var n2Card = cardById('n2');
n2Card.__fire('pointerdown', { button: 0 });
check(
  focusLog.length === 0,
  'E1: a card-body pointerdown makes NO focus()/blur() call (bring-to-front never steals focus)'
);
check(
  documentStub.activeElement === n1Remove,
  'E2: activeElement is unchanged — focus stays where it was (n1\'s remove button)'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'E3: the DOM order is untouched (bring-to-front reorders PAINT, never the chain)'
);
check(
  parseInt(n2Card.style.zIndex, 10) > parseInt(cardById('n1').style.zIndex || '0', 10),
  'E4: the pressed section is raised above its neighbors (the z-order lift happened)'
);

var n3YBefore = CC.currentLayout().n3.y;
var n3Handle = handleOf('n3');
n3Handle.__fire('pointerdown', { clientX: 100, clientY: 100, button: 0 });
documentStub.__fire('pointermove', { clientX: 132, clientY: 148 });
documentStub.__fire('pointerup', {});
check(
  focusLog.length === 0 && documentStub.activeElement === n1Remove,
  'E5: a full grip position-drag never touches focus (focus stays on n1\'s control)'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']) &&
    CC.currentLayout().n3.y === n3YBefore + CC.snapToGrid(148 - 100),
  'E6: the grip drag moved the SEAT only (snap-quantized dy, GRID_PITCH) — order byte-stable'
);

grabJack('section-in', 'n2');
documentStub.__fire('pointerup', {}); // sub-threshold release: complete no-op
check(
  focusLog.length === 0 && documentStub.activeElement === n1Remove,
  'E7: a jack grab never touches focus (armCordDrag preventDefaults — the grab cannot move focus)'
);

// ----------------------------------------------------------------------
console.log('F. the focus-ring z-floor: floor rule + bring-to-front on focus');
var cardBlock = cssBlock('.node-card');
check(
  zIndexBlockInt(cardBlock) !== null && zIndexBlockInt(cardBlock) >= 1,
  'F1: CSS .node-card carries a z-index FLOOR >= 1 (every section paints above the cord layer)'
);
check(
  zIndexBlockInt(cssBlock('.cord-layer')) === 0,
  'F2: CSS .cord-layer sits at z-index 0 — below every section (the floor\'s other edge)'
);
check(
  cssBlock('.node-card:focus-within') !== null,
  'F3: CSS .node-card:focus-within exists (the focus LIFT is styled on the touched section)'
);

// n2 was fronted by the E-section pointerdown (inline zIndex); n1 sits
// UNDER it. Focus now lands in n1 — n1 must rise above n2 or its focus
// ring paints beneath n2's overlap (bring-to-front on focus, A11Y-1).
var n1Card = cardById('n1');
var n2ZBefore = n2Card.style.zIndex;
removeBtnOf('n1').focus(); // dispatches the bubbling focusin n1's card hears
check(
  parseInt(n1Card.style.zIndex, 10) > parseInt(n2ZBefore || '0', 10),
  'F4: a control RECEIVING focus raises its section above the previously fronted card (the ring can never be occluded)'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'F5: the focus raise is z-order only — the DOM order (chain order) is untouched'
);
check(tabOrderEqualsDomOrder(), 'F6: the tab order is still exactly the chain order');

// Focusing deeper inside the same FRONT card just re-raises it — no
// neighbor is lowered below the floor and nothing reorders.
var n1Collapse = null;
(function walk(el) {
  (el.children || []).some(function (child) {
    if (child.classList.contains('node-collapse')) { n1Collapse = child; return true; }
    walk(child);
    return false;
  });
})(n1Card);
var n1ZBefore = n1Card.style.zIndex;
n1Collapse.focus();
check(
  parseInt(n1Card.style.zIndex, 10) >= parseInt(n1ZBefore || '0', 10) &&
    parseInt(n1Card.style.zIndex, 10) > parseInt(n2Card.style.zIndex, 10),
  'F7: focus moving WITHIN the front section keeps it on top (re-raise is monotonic, no lowering)'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']) &&
    tabOrderEqualsDomOrder(),
  'F8: final state — DOM order = tab order = chain order, focus raised, nothing reordered'
);

if (failures.length === 0) {
  console.log('PASS: order + focus rules (A11Y-1)');
  process.exit(0);
}
console.log('FAIL: ' + failures.length + ' check(s) failed:');
failures.forEach(function (label) { console.log('  - ' + label); });
process.exit(1);
