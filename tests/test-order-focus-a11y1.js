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
    // Detach FIRST, then locate the reference — the order the real DOM
    // uses. Reading the index before the detach is stale whenever the
    // moved child already sits BEFORE ref in this same parent (removing
    // it shifts ref down one), which is exactly the case a drag ghost
    // walking rightwards through the row hits on every move.
    if (child.parentNode) { child.parentNode.removeChild(child); }
    var idx = self.children.indexOf(ref);
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
  // Minimal .closest — only what the board redesign's keyboard-reorder
  // handler needs: a single class selector, walking self then ancestors.
  this.closest = function (selector) {
    var cls = selector.charAt(0) === '.' ? selector.slice(1) : selector;
    var node = self;
    while (node) {
      if (node.classList && node.classList.contains(cls)) { return node; }
      node = node.parentNode;
    }
    return null;
  };
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
var boardFrameEl = new FakeElement('div');
boardFrameEl.className = 'board-frame';
var ioRailInEl = new FakeElement('aside');
ioRailInEl.className = 'io-rail io-rail-in';
var ioRailOutEl = new FakeElement('aside');
ioRailOutEl.className = 'io-rail io-rail-out';
var micAnchorEl = new FakeElement('div');
micAnchorEl.className = 'anchor';
var outAnchorEl = new FakeElement('div');
outAnchorEl.className = 'anchor';
// Guided Patchbay round: the rails are FLEX SIBLINGS of #chain-canvas
// inside .board-frame, not children inside the scrolling face.
ioRailInEl.appendChild(micAnchorEl);
ioRailOutEl.appendChild(outAnchorEl);
boardFrameEl.appendChild(ioRailInEl);
boardFrameEl.appendChild(canvasFaceEl);
boardFrameEl.appendChild(ioRailOutEl);
canvasPanelEl.appendChild(boardFrameEl);
canvasFaceEl.appendChild(chainListEl);
canvasFaceEl.appendChild(emptyHintEl);
// No offsetLeft/offsetTop on chainListEl and no getBoundingClientRect
// anywhere in this fake DOM — board origin is {0, 0} and both rail jacks
// take railJackPoint()'s layout-less fallback (FEW-3/4/Guided-Patchbay
// contract).

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
  EffectCatalog: {
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
sandbox.ChainEditing = {
  getModel: function () { return CC.getCurrentModel(); },
  getLayout: function () { return CC.getCurrentLayout(); },
  syncLayout: function () {},
  apply: function (request) {
    if (request.candidate) {
      CC.renderModel(request.candidate, request.layout);
    } else if (request.change) {
      CC.renderNodeParam(request.change.nodeId, request.change.param, request.change.value);
    }
    return Promise.resolve({ applied: true, saved: true });
  }
};

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
// may no longer be at the tidy row after earlier gestures). OQ-9
// geometry: a section's jacks sit ON its border, DIRECTLY ACROSS each
// other over the placeholder card box (160w x 48h) — since vertical
// flow was retired (2026-08-31): IN at the middle of the seat's LEFT
// border, OUT at the middle of its RIGHT.
var CARD_W = 160;
var CARD_H = 48;
// Guided Patchbay round: both panel jacks now read railJackPoint()'s
// layout-less fallback — fixed, distinct constants per side, vertically
// centered on CARD_H_FALLBACK (48) rather than pinned to the pre-rail
// content-top / board-extent-corner geometry these replace. out-in no
// longer depends on the live positions map at all.
var MIC_OUT = { x: 16, y: 24 };
var OUT_IN = { x: 176, y: 24 };

function jackPt(kind, id) {
  if (kind === 'mic-out') { return MIC_OUT; }
  if (kind === 'out-in') { return OUT_IN; }
  var layout = CC.currentLayout();
  var seat = layout[id] || { x: 0, y: 16 };
  return kind === 'section-in'
    ? { x: seat.x, y: seat.y + CARD_H / 2 }
    : { x: seat.x + CARD_W, y: seat.y + CARD_H / 2 };
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

// --- Measurable geometry for the drop gestures -------------------------
// The base harness stubs no getBoundingClientRect, which is a real code
// path (canvas.js must degrade to "the end slot" without geometry) but a
// useless one for testing WHICH slot a pointer names. These helpers paint
// a synthetic row onto the live cards AFTER a render: card i occupies
// [i*ROW_W, (i+1)*ROW_W) at height ROW_H, so its midpoint is a round
// number and every assertion below can name an exact pointer x.
//
// Re-apply after EVERY render — commitStructuralChange() rebuilds each
// card element, and a rebuilt card has no rect again.
var ROW_W = 100;
var ROW_H = 60;

function rectFn(left, width) {
  return function () {
    return {
      left: left, right: left + width, width: width,
      top: 0, bottom: ROW_H, height: ROW_H
    };
  };
}

function layoutRow() {
  cards().forEach(function (card, i) {
    card.getBoundingClientRect = rectFn(i * ROW_W, ROW_W);
  });
  canvasFaceEl.getBoundingClientRect = rectFn(0, ROW_W * 12);
}

/** Every laid-out slot in the row, in DOM order: a card reads as its id,
 *  the ghost reads as 'GHOST'. This is the drop preview the operator
 *  actually sees — cards do NOT move during a drag any more, the ghost
 *  does. */
function slotOrder() {
  return (chainListEl.children || []).filter(function (el) {
    if (!el.classList) { return false; }
    if (el.classList.contains('node-card-placeholder')) { return true; }
    // The HELD card is lifted out of flow (position:fixed) for the whole
    // gesture — it is still in the DOM but it no longer occupies a row
    // slot, so it must not read as one here either.
    return el.classList.contains('node-card') &&
      !el.classList.contains('reorder-chosen');
  }).map(function (el) {
    return el.classList.contains('node-card-placeholder') ?
      'GHOST' : el.attrs['data-node-id'];
  });
}

function ghostEl() {
  return (chainListEl.children || []).filter(function (el) {
    return el.classList && el.classList.contains('node-card-placeholder');
  })[0] || null;
}

function chipEl(type) {
  return paletteListEl.querySelectorAll('.node-chip').filter(function (chip) {
    return chip.attrs['data-node-type'] === type;
  })[0] || null;
}

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
  CC.renderModel(model3());
  focusLog.length = 0;
  documentStub.activeElement = null;
}

/** model3 ends in a LIMITER, which the safe-output clamp locks to the
 *  last slot — useful for testing that clamp, useless for testing plain
 *  slot geometry. This is the same three-card row with the terminal
 *  limiter swapped for a third gain, plus the synthetic rects the drop
 *  gestures measure against. */
function modelOpen3() {
  return [
    { id: 'n1', type: 'gain', params: { level: 1 } },
    { id: 'n2', type: 'gain', params: { level: 2 } },
    { id: 'n3', type: 'gain', params: { level: 3 } }
  ];
}

function resetOpen() {
  CC.renderModel(modelOpen3());
  focusLog.length = 0;
  documentStub.activeElement = null;
  layoutRow();
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
  tabCardOrder().length === 12,
  'A3: every section contributes its controls to the tab flow (3 sections x handle + bypass + collapse + remove — the drag handle joined the tab flow with the board redesign\'s keyboard-reorder equivalent)'
);

// ----------------------------------------------------------------------
console.log('B. drag-to-reorder + its keyboard equivalent keep DOM = tab = chain');
// The gesture previews with a GHOST — a dashed slot reserving the row
// position the held card would land in — NOT by reordering the real
// cards: mid-drag the model, the graph, the accepted render AND the
// cards' own DOM order are all byte-unchanged. Geometry is painted on by
// layoutRow() so every assertion can name an exact pointer x: card i
// spans [100i, 100i+100), midpoint 100i+50.
//
// These cases run on an OPEN row (three gains, no terminal limiter) so
// the slot each pointer names is plain geometry; the safe-output clamp
// gets its own case at the end of the section.
resetOpen();
handleOf('n1').__fire('pointerdown', { clientX: 0, clientY: 30, button: 0 });
check(CC.isDragActive() === true, 'B1: the reorder gesture arms the drag gate (agent mutations queue behind it)');
documentStub.__fire('pointermove', { clientX: 280, clientY: 30 }); // past every midpoint -> the end
check(
  JSON.stringify(slotOrder()) === JSON.stringify(['n2', 'n3', 'GHOST']),
  'B2: past the threshold a GHOST reserves the drop slot — here the end of the row'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']) &&
    JSON.stringify(modelIds()) === JSON.stringify(['n1', 'n2', 'n3']),
  'B2b: ...and the real cards have NOT moved — only the ghost previews (no thrash under the cursor, no commit)'
);
documentStub.__fire('pointermove', { clientX: 120, clientY: 30 }); // left of n2's midpoint (150)
check(
  JSON.stringify(slotOrder()) === JSON.stringify(['GHOST', 'n2', 'n3']) &&
    JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'B2c: sliding left of the first slot midpoint moves the GHOST, and still only the ghost'
);
documentStub.__fire('pointermove', { clientX: 280, clientY: 30 });
documentStub.__fire('pointerup', {});
check(
  CC.isDragActive() === false &&
    JSON.stringify(domOrder()) === JSON.stringify(['n2', 'n3', 'n1']) &&
    JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'B3: dropping seats the card where the ghost stood and commits it — DOM = model, drag gate released'
);
check(ghostEl() === null, 'B3b: the ghost is retired by the drop');
check(tabOrderEqualsDomOrder(), 'B4: the tab order followed the drag');

// Mid-row placement, not just the ends: hold n3 and drop it between n1
// and n2 (pointer past n1's midpoint at 50, short of n2's at 150).
resetOpen();
handleOf('n3').__fire('pointerdown', { clientX: 250, clientY: 30, button: 0 });
documentStub.__fire('pointermove', { clientX: 120, clientY: 30 });
check(
  JSON.stringify(slotOrder()) === JSON.stringify(['n1', 'GHOST', 'n2']),
  'B4b: the ghost lands in the exact mid-row slot the pointer names'
);
documentStub.__fire('pointerup', {});
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n3', 'n2']) &&
    JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'B4c: ...and the drop commits exactly that order'
);

// A drag that never crosses a midpoint is a no-op — the ghost stays in
// the held card's own slot and the drop commits nothing.
resetOpen();
handleOf('n2').__fire('pointerdown', { clientX: 150, clientY: 30, button: 0 });
documentStub.__fire('pointermove', { clientX: 160, clientY: 30 });
check(
  JSON.stringify(slotOrder()) === JSON.stringify(['n1', 'GHOST', 'n3']),
  'B4d: a drag that crosses no midpoint keeps the ghost in the held card\'s own slot'
);
documentStub.__fire('pointerup', {});
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']) &&
    JSON.stringify(modelIds()) === JSON.stringify(['n1', 'n2', 'n3']),
  'B4e: ...and dropping there commits nothing (moved nothing -> commits nothing)'
);

resetOpen();
handleOf('n1').__fire('pointerdown', { clientX: 0, clientY: 30, button: 0 });
documentStub.__fire('pointermove', { clientX: 2, clientY: 30 }); // inside the 4px guard
check(
  ghostEl() === null,
  'B5a: a move inside the deliberate-drag threshold opens no ghost at all'
);
documentStub.__fire('pointerup', {});
check(
  CC.isDragActive() === false &&
    JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'B5: a sub-threshold press-release commits nothing (a press on a section is not a drag)'
);

resetOpen();
handleOf('n2').__fire('pointerdown', { clientX: 150, clientY: 30, button: 0 });
documentStub.__fire('pointermove', { clientX: 40, clientY: 30 });
documentStub.__fire('keydown', { key: 'Escape' });
check(
  CC.isDragActive() === false &&
    ghostEl() === null &&
    JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'B6: Escape mid-drag retires the ghost and commits nothing'
);

// The grab surface is the whole section now, not just the rail grip
// (2026-09-01: "cards don't want to drag as easily as they should").
resetOpen();
var bodyCard = cardById('n1');
bodyCard.__fire('pointerdown', { clientX: 0, clientY: 30, button: 0, target: bodyCard });
documentStub.__fire('pointermove', { clientX: 280, clientY: 30 });
check(
  JSON.stringify(slotOrder()) === JSON.stringify(['n2', 'n3', 'GHOST']),
  'B6b: a press on the SECTION BODY (not just the rail grip) arms the same drag'
);
documentStub.__fire('keydown', { key: 'Escape' });
check(ghostEl() === null, 'B6c: ...and Escape cleans it up the same way');

// The safe-output clamp: with a limiter sitting LAST (the default
// preset's invariant, and what addNodeType's click add already honors),
// no drop may name the slot behind it. The operator SEES this in the
// ghost before releasing — it simply refuses to open past the limiter.
resetBoard(); // n3 is a limiter, and it is last
layoutRow();
handleOf('n1').__fire('pointerdown', { clientX: 0, clientY: 30, button: 0 });
documentStub.__fire('pointermove', { clientX: 400, clientY: 30 }); // way past the end
check(
  JSON.stringify(slotOrder()) === JSON.stringify(['n2', 'GHOST', 'n3']),
  'B6d: a terminal limiter is locked last — the ghost stops in front of it however far right the pointer goes'
);
documentStub.__fire('pointerup', {});
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n2', 'n1', 'n3']) &&
    JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'B6e: ...and the drop commits what the ghost showed, limiter still terminal'
);

resetBoard();
var n2Handle = handleOf('n2');
documentStub.__fire('keydown', {
  key: 'ArrowRight', altKey: true, target: n2Handle, preventDefault: function () {}
});
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n3', 'n2']) &&
    JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'B7: Alt+ArrowRight on a focused handle moves that card one slot toward the end and commits immediately'
);
check(tabOrderEqualsDomOrder(), 'B8: the tab order followed the keyboard move');
check(
  documentStub.activeElement === handleOf('n2'),
  'B9: focus follows the moved card\'s (re-rendered) handle'
);
documentStub.__fire('keydown', {
  key: 'ArrowRight', altKey: true, target: handleOf('n2'), preventDefault: function () {}
});
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n3', 'n2']),
  'B10: Alt+ArrowRight at the row\'s end clamps — no wraparound, no-op'
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

CC.renderModel([
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
console.log('D. the palette\'s two add verbs: click adds at the end, a drag places it');
// The chip keeps its click add (append, or just before a terminal
// limiter) AND gains a placement-aware drag that reuses the reorder
// gesture's whole vocabulary — same ghost, same slot snapshot, same
// safe-output clamp, same "commits only on the drop" rule. The only
// thing the drag adds is a DROP ZONE: released off the board, it adds
// nothing at all.
//
// This harness's catalog stub registers two types (gain, limiter), so
// the added module is identified by WHERE it landed among the seeded
// ids, not by a family the row does not otherwise carry.
CC.onEngineStarted(); // chips ship disabled; this is the transition that arms them

function familyOrder() {
  return cards().map(function (c) { return c.attrs['data-family']; });
}

/** The seeded ids in row order, with any card this section just added
 *  reading as 'NEW' — the shape assertion each add is checked against. */
function addedShape(seeded) {
  return domOrder().map(function (id) {
    return seeded.indexOf(id) === -1 ? 'NEW' : id;
  });
}

resetBoard(); // n3 is a limiter, and it is last
layoutRow();
chipEl('gain').__fire('click', {});
check(
  JSON.stringify(addedShape(['n1', 'n2', 'n3'])) ===
    JSON.stringify(['n1', 'n2', 'NEW', 'n3']) &&
    JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'D1: a chip CLICK appends at the end of the chain, in front of the terminal limiter'
);

resetOpen();
chipEl('gain').__fire('pointerdown', { clientX: 500, clientY: 400, button: 0 });
documentStub.__fire('pointermove', { clientX: 300, clientY: 200 }); // detached, still off the board
check(
  ghostEl() === null,
  'D2: a chip pulled off the board opens no ghost — there is no slot to reserve out there'
);
documentStub.__fire('pointermove', { clientX: 120, clientY: 30 }); // onto the row, before n2
check(
  JSON.stringify(slotOrder()) === JSON.stringify(['n1', 'GHOST', 'n2', 'n3']),
  'D3: dragged onto the board, the ghost reserves the exact slot the pointer names'
);
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'D3b: ...and nothing has been added yet — the ghost is the whole preview'
);
documentStub.__fire('pointerup', {});
check(
  JSON.stringify(addedShape(['n1', 'n2', 'n3'])) ===
    JSON.stringify(['n1', 'NEW', 'n2', 'n3']) &&
    JSON.stringify(modelIds()) === JSON.stringify(domOrder()),
  'D4: dropping seats the new module in the ghost\'s slot and commits it — DOM = model'
);
check(
  ghostEl() === null && CC.isDragActive() === false,
  'D4b: the ghost is retired and the drag gate released'
);
// The pointerup that ends the drag can land back on the chip and fire
// its click; that click must NOT add a second copy.
chipEl('gain').__fire('click', {});
check(
  cards().length === 4,
  'D5: the click that trails a completed chip drag is swallowed — one gesture, one module'
);

// Released off the board: no reservation was standing, so nothing is added.
resetOpen();
chipEl('gain').__fire('pointerdown', { clientX: 500, clientY: 400, button: 0 });
documentStub.__fire('pointermove', { clientX: 120, clientY: 30 }); // over the row
documentStub.__fire('pointermove', { clientX: 120, clientY: 400 }); // back off it
check(ghostEl() === null, 'D6: leaving the board withdraws the reservation');
documentStub.__fire('pointerup', {});
check(
  JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'D6b: ...and releasing out there adds nothing'
);

// Escape abandons a chip drag exactly as it abandons a reorder.
resetOpen();
chipEl('gain').__fire('pointerdown', { clientX: 500, clientY: 400, button: 0 });
documentStub.__fire('pointermove', { clientX: 120, clientY: 30 });
documentStub.__fire('keydown', { key: 'Escape' });
check(
  ghostEl() === null &&
    CC.isDragActive() === false &&
    JSON.stringify(domOrder()) === JSON.stringify(['n1', 'n2', 'n3']),
  'D7: Escape mid chip-drag retires the ghost and adds nothing'
);

// The safe-output clamp is ONE rule shared by both drop gestures.
resetBoard(); // n3 is a limiter, and it is last
layoutRow();
chipEl('gain').__fire('pointerdown', { clientX: 500, clientY: 400, button: 0 });
documentStub.__fire('pointermove', { clientX: 400, clientY: 30 }); // way past the end of the row
check(
  JSON.stringify(slotOrder()) === JSON.stringify(['n1', 'n2', 'GHOST', 'n3']),
  'D8: a chip dropped past the end stops in front of a terminal limiter, same clamp the reorder drag uses'
);
documentStub.__fire('pointerup', {});
check(
  JSON.stringify(addedShape(['n1', 'n2', 'n3'])) ===
    JSON.stringify(['n1', 'n2', 'NEW', 'n3']) &&
    familyOrder()[3] === 'limiter',
  'D8b: ...and the committed chain keeps the limiter terminal'
);

if (failures.length === 0) {
  console.log('PASS: order + focus rules (A11Y-1)');
  process.exit(0);
}
console.log('FAIL: ' + failures.length + ' check(s) failed:');
failures.forEach(function (label) { console.log('  - ' + label); });
process.exit(1);
