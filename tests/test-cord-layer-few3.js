// Test for cycle-4 FEW-3 — the read-only SVG cord layer (mic -> sections
// in chain order -> out), painted from the positions map.
//
// Scope under test (the REAL src/canvas.js in a minimal vm DOM that, unlike
// the FEW-2 harness, DOES provide #chain-canvas — the cord layer's host):
//   - The layer is appended as #chain-canvas's LAST child (never a first
//     child, never inside #chain-list) — the DOM contracts other tests
//     pin stay byte-stable.
//   - Jack coordinates DERIVE from the positions map (the postmortem's
//     B6 fix): endpoints are board-space values, no parallel bookkeeping.
//   - Cords track order changes from every existing path: keyboard add
//     (incl. the terminal-limiter insert-before splice), remove x, agent
//     loadModel.
//   - Re-route on move (pointer drag) and TIDY.
//   - Segment count is always nodes + 1 (empty chain shows the direct
//     MIC -> OUT bypass cord).
//
// Same committed zero-dependency convention: plain `node`, run via
// `node tests/run.js cord-layer`.

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
// Minimal fake DOM — the FEW-2 harness plus the canvas FACE (#chain-canvas)
// carrying index.html's real Guided Patchbay structure: .canvas-panel >
// .board-frame > [Voice In rail (.anchor "MIC IN"), #chain-canvas
// (chain-list, empty-hint only), Voice Out rail (.anchor "OUT")]. Those
// first children are pinned below.
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
// index.html's real Guided Patchbay structure: the rails are FLEX
// SIBLINGS of #chain-canvas inside .board-frame, not children inside the
// scrolling face — #chain-canvas itself carries only chain-list +
// empty-hint.
ioRailInEl.appendChild(micAnchorEl);
ioRailOutEl.appendChild(outAnchorEl);
boardFrameEl.appendChild(ioRailInEl);
boardFrameEl.appendChild(canvasFaceEl);
boardFrameEl.appendChild(ioRailOutEl);
canvasPanelEl.appendChild(boardFrameEl);
canvasFaceEl.appendChild(chainListEl);
canvasFaceEl.appendChild(emptyHintEl);
// NOTE: no offsetLeft/offsetTop on chainListEl and no getBoundingClientRect
// anywhere in this fake DOM — the board origin resolves to {0, 0} and
// every rail-jack lookup takes railJackPoint()'s layout-less fallback, so
// the pins below are that fallback's constants, not a live measurement.

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

// Browser-faithful SVG elements (2026-08-30 hotfix regression gate): in
// a REAL browser, SVGElement.className is a read-only SVGAnimatedString
// getter — a strict-mode assignment throws TypeError (the exact bug that
// shipped: canvas.js set .className on cord-layer and crashed every real
// browser while this harness's plain-FakeElement fallback let it pass).
// createElementNS therefore returns elements whose className is
// getter-only, backed by the class attribute; production code must use
// setAttribute('class', ...) on SVG elements.
function makeSvgElement(tag) {
  var el = new FakeElement(tag);
  delete el.className;
  Object.defineProperty(el, 'className', {
    get: function () { return el.getAttribute('class') || ''; },
    configurable: true
  });
  return el;
}

var documentStub = {
  createElement: function (tag) { return new FakeElement(tag); },
  createElementNS: function (ns, tag) { return makeSvgElement(tag); },
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

var saves = [];

var sandbox = {
  console: { log: function () {}, warn: function () {}, error: function () {} },
  document: documentStub,
  setTimeout: function () {},
  Sortable: SortableStub,
  EffectCatalog: {
    getAllTypes: function () { return ['gain', 'limiter']; },
    getLabel: function (t) { return t === 'limiter' ? 'Limiter' : 'Gain'; },
    getParamSpec: function () { return [{ id: 'level', default: 0 }]; },
    isExperimental: function () { return false; },
    // BEH-1 (cycle 4): mirrors the real catalog's autotune-first rule
    // (src/effect-catalog.js insertsAtFront) so this harness exercises
    // the same front-insert default the live page gets.
    insertsAtFront: function (t) { return t === 'autotune'; }
  },
  ParamControls: {
    render: function () {},
    updateControl: function () {}
  },
  AudioGraph: {
    buildGraph: function () {},
    getModel: function () { return []; }
  },
  AudioEngine: { isStarted: false },
  Persistence: {
    saveCurrentChain: function (model, layout) { saves.push({ model: model, layout: layout }); }
  }
};
sandbox.window = sandbox;
// Vertical flow is RETIRED (2026-08-31): nothing reads a flow preference
// anymore; the stub stays only to prove a stale legacy key is inert.
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

function cordLayer() {
  var found = queryAll(canvasFaceEl, '.cord-layer');
  return found.length === 1 ? found[0] : null;
}

function cordPaths() {
  var layer = cordLayer();
  return layer ? queryAll(layer, '.cord') : [];
}

function segRoute() {
  return cordPaths().map(function (p) {
    return p.attrs['data-from'] + '>' + p.attrs['data-to'];
  });
}

function dOf(i) { return cordPaths()[i] ? cordPaths()[i].attrs['d'] : null; }

function endPoint(d) {
  var m = /, (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)$/.exec(d || '');
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

function startPoint(d) {
  var m = /^M(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)$|^M(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/.exec(d || '');
  if (!m) { return null; }
  return m[1] !== undefined
    ? { x: parseFloat(m[1]), y: parseFloat(m[2]) }
    : { x: parseFloat(m[3]), y: parseFloat(m[4]) };
}

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

function model3() {
  return [
    { id: 'n1', type: 'gain', params: { level: 1 } },
    { id: 'n2', type: 'gain', params: { level: 2 } },
    { id: 'n3', type: 'limiter', params: { level: 0 } }
  ];
}

// Board-space jack constants (src/canvas.js, OQ-9 geometry + the Guided
// Patchbay rail rewrite): with no live getBoundingClientRect anywhere in
// this fake DOM, railJackPoint()'s layout-less fallback fires for BOTH
// rails — a stable, distinct constant per side (16, 24) for mic and
// (176, 24) for out, vertically centered on CARD_H_FALLBACK (48) rather
// than pinned to the content top the way the pre-rail MIC-only fallback
// was. A section's jacks sit ON its border, DIRECTLY ACROSS each other
// (IN at the middle of the LEFT border, OUT at the middle of the RIGHT)
// over the placeholder card box (160 wide, 48 tall — real browsers
// measure the live card).
var MIC = { x: 16, y: 24 };
var OUT = { x: 176, y: 24 };
var CARD_W = 160;
var CARD_H = 48;
function seatIn(seat) { return { x: seat.x, y: seat.y + CARD_H / 2 }; }
function seatOut(seat) { return { x: seat.x + CARD_W, y: seat.y + CARD_H / 2 }; }

// ----------------------------------------------------------------------
console.log('A. layer construction + the pinned DOM contracts');
var layer = cordLayer();
check(!!layer, 'A1: exactly ONE .cord-layer is built (in #chain-canvas)');
check(
  !!layer && canvasFaceEl.children[canvasFaceEl.children.length - 1] === layer,
  'A2: the layer is #chain-canvas\'s LAST child — never a first child (no firstChild index shifts)'
);
check(
  micAnchorEl.parentNode && micAnchorEl.parentNode.classList.contains('io-rail-in') &&
    outAnchorEl.parentNode && outAnchorEl.parentNode.classList.contains('io-rail-out'),
  'A3: MIC IN lives on the fixed Voice In rail, OUT on the fixed Voice Out rail (Guided Patchbay round — both anchors are real, flanking .canvas as siblings)'
);
check(
  !!layer && layer.attrs['aria-hidden'] === 'true',
  'A4: the layer is aria-hidden decorative'
);
check(
  chainListEl.children.length === 0 && queryAll(chainListEl, 'cord-layer').length === 0,
  'A5: NOTHING cord-related ever enters #chain-list (its children ARE the chain)'
);

// ----------------------------------------------------------------------
console.log('B. loadModel routes cords FROM MODEL ORDER with positions-map coords');
CC.renderModel(model3());
check(
  JSON.stringify(segRoute()) === JSON.stringify(['mic>n1', 'n1>n2', 'n2>n3', 'n3>out']),
  'B1: mic -> n1 -> n2 -> n3 -> out (segments = nodes + 1)'
);
check(cordPaths().length === 4, 'B2: 3 nodes -> exactly 4 cord segments');
check(
  cordPaths().every(function (p) { return p.attrs['data-from'] && p.attrs['data-to']; }),
  'B3: every cord carries data-from/data-to (FEW-4\'s future hit targets)'
);
var d01 = dOf(0);
check(
  !!d01 && startPoint(d01).x === MIC.x && startPoint(d01).y === MIC.y,
  'B4: the first cord leaves the Voice In rail\'s jack (16, 24 — the layout-less fallback, vertically centered)'
);
var d12 = dOf(1);
check(
  !!d12 && startPoint(d12).x === seatOut({ x: 0, y: 16 }).x && startPoint(d12).y === seatOut({ x: 0, y: 16 }).y &&
    endPoint(d12).x === seatIn({ x: 144, y: 16 }).x && endPoint(d12).y === seatIn({ x: 144, y: 16 }).y,
  'B5: mid-chain endpoints derive from the row seats (n1 out-jack 160,40 -> n2 in-jack 144,40 — ON the border, across from each other)'
);
var dLast = dOf(3);
check(
  !!dLast && endPoint(dLast).x === OUT.x && endPoint(dLast).y === OUT.y,
  'B6: the chain\'s OUT exits at the Voice Out rail\'s jack (176, 24) — a FIXED rail point now, independent of the rightmost card\'s position (contrast the pre-rail board-extent geometry this constant replaces)'
);
check(
  !!d01 && d01.indexOf(' C') !== -1,
  'B7: cords are beziers (a C segment), not polylines'
);

// ----------------------------------------------------------------------
console.log('C. a grip MOVE re-routes the cords live (positions map only)');
var micToN1Before = dOf(0);
var h2 = handleOf('n2');
h2.__fire('pointerdown', { clientX: 100, clientY: 100, button: 0 });
documentStub.__fire('pointermove', { clientX: 139, clientY: 122 }); // n2 -> (176, 32)
documentStub.__fire('pointerup', {});
check(
  CC.currentLayout().n2.x === 176 && CC.currentLayout().n2.y === 32,
  'C1: the drag moved n2\'s seat (176, 32) — snap-quantized'
);
var intoN2 = dOf(1);
var outOfN2 = dOf(2);
check(
  !!intoN2 && endPoint(intoN2).x === seatIn({ x: 176, y: 32 }).x && endPoint(intoN2).y === seatIn({ x: 176, y: 32 }).y,
  'C2: the cord INTO n2 now ends at its moved in-jack (176, 56 — middle of the left border)'
);
check(
  !!outOfN2 && startPoint(outOfN2).x === seatOut({ x: 176, y: 32 }).x && startPoint(outOfN2).y === seatOut({ x: 176, y: 32 }).y,
  'C3: the cord OUT OF n2 now starts at its moved out-jack (336, 56 — middle of the right border, directly across)'
);
check(
  dOf(0) === micToN1Before,
  'C4: the untouched mic->n1 cord is byte-stable across n2\'s move'
);

// ----------------------------------------------------------------------
console.log('E. remove x closes the chain over the removed seat');
removeBtnOf('n3').__fire('click', {});
check(
  JSON.stringify(segRoute()) === JSON.stringify(['mic>n1', 'n1>n2', 'n2>out']),
  'E1: removal re-routes: mic -> n1 -> n2 -> out (no n3 reference survives)'
);
check(cordPaths().length === 3, 'E2: 2 nodes -> 3 segments (nodes + 1 holds)');

// ----------------------------------------------------------------------
console.log('F. keyboard add SPLICES the cord before a terminal limiter');
CC.renderModel(model3()); // n3 (limiter) terminal, board tidy
var idsBefore = domOrder().slice();
CC.addNodeType('gain'); // insert-before-limiter policy (R2-2)
var order = domOrder();
var newId = order.filter(function (id) { return idsBefore.indexOf(id) === -1; })[0];
check(
  order[order.length - 1] === 'n3' && order.indexOf(newId) === order.length - 2,
  'F1: the add splices the new section immediately BEFORE the terminal limiter'
);
check(
  JSON.stringify(segRoute()) === JSON.stringify([
    'mic>n1', 'n1>n2', 'n2>' + newId, newId + '>n3', 'n3>out'
  ]),
  'F2: the cords follow the splice — order change from the keyboard path re-routes'
);
check(cordPaths().length === 5, 'F3: 4 nodes -> 5 segments');

// ----------------------------------------------------------------------
console.log('F4. autotune add lands at the FRONT (BEH-1, cycle 4)');
// The autotune-first default: EffectCatalog.insertsAtFront is the one
// rule both add paths share. Against the same terminal-limiter chain,
// autotune goes BEFORE EVERY effect node (index 0), not before the
// limiter — and a limiter-only chain still gets the autotune upstream.
CC.renderModel(model3()); // n1, n2, n3 (limiter terminal), board tidy
var idsF4 = domOrder().slice();
CC.addNodeType('autotune');
var orderF4 = domOrder();
var autoIdF4 = orderF4.filter(function (id) { return idsF4.indexOf(id) === -1; })[0];
check(
  orderF4[0] === autoIdF4 && orderF4.join('|') === autoIdF4 + '|n1|n2|n3',
  'F4a: the autotune add lands at index 0, before every effect node'
);
check(
  orderF4[orderF4.length - 1] === 'n3',
  'F4b: the terminal limiter stays terminal (the limiter policy is untouched)'
);
check(
  JSON.stringify(segRoute()) === JSON.stringify([
    'mic>' + autoIdF4, autoIdF4 + '>n1', 'n1>n2', 'n2>n3', 'n3>out'
  ]) && cordPaths().length === 5,
  'F4c: the cords follow the front splice (5 segments still)'
);
CC.renderModel([{ id: 'x1', type: 'limiter', params: { level: 0 } }]);
CC.addNodeType('autotune');
check(
  domOrder().length === 2 && domOrder()[domOrder().length - 1] === 'x1',
  'F4d: a limiter-only chain still gets the autotune BEFORE the limiter'
);

// ----------------------------------------------------------------------
console.log('G. empty chain + final DOM-contract pins');
CC.renderModel([]);
check(
  JSON.stringify(segRoute()) === JSON.stringify(['mic>out']),
  'G1: an empty chain shows the direct MIC -> OUT bypass cord (0 nodes -> 1 segment)'
);
check(
  chainListEl.children.length === 0,
  'G2: #chain-list still carries ONLY sections (empty here) — the layer lives in the face'
);
check(
  micAnchorEl.parentNode && micAnchorEl.parentNode.classList.contains('io-rail-in') &&
    outAnchorEl.parentNode && outAnchorEl.parentNode.classList.contains('io-rail-out') &&
    canvasFaceEl.children[canvasFaceEl.children.length - 1] === cordLayer(),
  'G3: after every operation both rail anchors stay on their fixed rails and the layer stays the face\'s last child'
);
check(
  emptyHintEl.style.display === '' || emptyHintEl.style.display === 'none',
  'G4: the empty-hint flip still reads #chain-list\'s children (unaffected by the layer)'
);

// ----------------------------------------------------------------------
console.log('H. browser-faithful SVG contract (hotfix regression gate)');
check(
  cordLayer().getAttribute('class') === 'cord-layer',
  'H1: the layer element carries its class via the class ATTRIBUTE (real SVGElement.className is read-only)'
);
check(
  cordPaths().every(function (p) { return p.getAttribute('class') === 'cord'; }),
  'H2: every cord path classes via the attribute'
);
var threwReadOnly = false;
try {
  'use strict';
  cordLayer().className = 'would-throw';
} catch (err) {
  threwReadOnly = err instanceof TypeError;
}
check(
  threwReadOnly,
  'H3: this harness is faithful — assigning className on an SVG element throws TypeError, so a reintroduced .className assignment fails the suite at load'
);

// H4 (source gate): no direct array-method calls on live DOM collections
// anywhere in src/ — the HTMLCollection-vs-Array divergence that shipped
// twice today. Array.prototype.*.call is the only legal form.
var fsMod = require('fs');
var pathMod = require('path');
var srcDir = pathMod.join(__dirname, '..', 'src');
var offenders = [];
fsMod.readdirSync(srcDir).forEach(function (f) {
  if (!/\.js$/.test(f)) { return; }
  var body = fsMod.readFileSync(pathMod.join(srcDir, f), 'utf8');
  var lines = body.split('\n');
  lines.forEach(function (line, i) {
    if (/\.children\.(slice|forEach|map|filter|indexOf|some|every|reduce)\(/.test(line)) {
      offenders.push(f + ':' + (i + 1) + ' ' + line.trim());
    }
  });
});
check(offenders.length === 0, 'H4: zero direct array-method calls on .children in src/ (offenders: ' + (offenders.join(' | ') || 'none') + ')');

if (failures.length === 0) {
  console.log('PASS: cord layer (FEW-3)');
  process.exit(0);
}
console.log('FAIL: ' + failures.length + ' check(s) failed:');
failures.forEach(function (label) { console.log('  - ' + label); });
process.exit(1);
