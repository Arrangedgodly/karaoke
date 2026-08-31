// Test for redesign item 1 — the PATTERN MACHINE CONTROL LAYER
// (docs/ultron/redesign.md, structure "Single Face Chassis").
//
// Covers the new control surface the redesign shipped, on the REAL
// src/param-controls.js + src/canvas.js loaded into a vm sandbox:
//   A. KNOB COMPONENT WIRING, BOTH DIRECTIONS — a human commit through
//      the native range input's 'input' event and an agent write through
//      ChainCanvas.updateNodeParam (the set_param fast path) move the
//      SAME state: the engine input, the mono .param-value span, the
//      canvas model, and the display register. Plus the committed
//      control-shape allocation (knob vs trim vs pads) and the detent
//      grammar (bipolar params only).
//   B. DISCRETE PAD COMMITS — string values verbatim down the pipeline
//      (AudioGraph.updateNodeParams + NodeTypes.applyParam) from a real
//      pad click, and updateControl moving the pressed pad WITHOUT a
//      commit or a re-render.
//   C. DISPLAY REGISTER CONTRACT — built by canvas.js as the canvas
//      panel's first child, aria-hidden (purely visual redundancy); at
//      rest it carries the ENGINE STATE (boot: STOPPED, live: count);
//      a control event switches it to MODULE · PARAM · VALUE + the
//      plain-language help line (reused from param-controls' map, not
//      duplicated), where it is sticky; the CSS pins fixed geometry so
//      it can never pump layout.
//   D. SECTION FOLD — the collapse button toggles .collapsed + its own
//      aria-expanded; the CSS fold is the 0fr grid with visibility
//      hidden (rows leave the tab order), session-only (rebuild
//      re-expands).
//   E. DRAG-HANDLE SCOPING — the chain Sortable's handle is the explicit
//      grip zone (.node-drag-handle in the family print rail) and NO
//      interactive control (input/button) lives inside it, so knobs,
//      pads, chevron and remove can never start a drag.
//   F. ADJUSTMENT ROUND (gate verdict ADJUST, 2026-08-30) —
//      F1. the VALUE-DISPLAY LADDER: every value/state readout on the
//          canvas surface renders at ONE per-control mono size
//          (0.75rem, tabular numerals, min-width slots), with the
//          display register keeping its own larger instrument tier
//          (0.85rem) and its help line joining the mono face;
//      F2. the knob ARC carries the section's FAMILY color: --knob-arc
//          derives from the rq5 --family-* tokens (the palette flank's
//          own) at the .node-card[data-family] rules — ONE derivation
//          site, no per-control class, no raw hex — and .knob-ring's
//          gradient consumes it, not the system accent.
//   G. ITEM 2 BAKE (2026-08-30 pick: A ENCODER) — the round's variant
//      machinery is GONE: body[data-knob-variant] has no writer anywhere
//      (index.html switcher stripped, src reads nothing), the stylesheet
//      carries zero variant-gated rules, and the picked variant's ONE
//      refinement — the held knob's mono value line lifting to display
//      amber — ships UNGATED; the drag feel is the built ENCODER linear
//      map everywhere.
//
// Same committed-test convention as the rest of the suite: zero-dependency
// Node harness, stub `window` + minimal DOM, load the REAL src files
// (fs.readFileSync + vm.runInContext).
//
// Run from a clean clone:  node tests/test-control-layer-pattern-machine.js
// (or via the runner:      node tests/run.js pattern-machine)
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
// Minimal fake DOM (the palette-cards harness shape: DOM-honest moves,
// class-selector queries, DOM-honest textContent reads).
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
  (this.listeners[evt] || []).forEach(function (fn) {
    fn(ev || STUB_EVENT);
  });
};

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

function deepFind(el, pred) {
  if (pred(el)) {
    return el;
  }
  var found = null;
  el.children.some(function (child) {
    found = deepFind(child, pred);
    return !!found;
  });
  return found;
}

var paletteListEl = new FakeElement('div');
var chainListEl = new FakeElement('div');
var emptyHintEl = new FakeElement('div');
var layoutEl = new FakeElement('div');
var canvasEl = new FakeElement('div');
var panelEl = new FakeElement('div');
panelEl.className = 'canvas-panel';

var documentStub = {
  createElement: function (tag) { return new FakeElement(tag); },
  getElementById: function (id) {
    if (id === 'palette-list') { return paletteListEl; }
    if (id === 'chain-list') { return chainListEl; }
    if (id === 'empty-hint') { return emptyHintEl; }
    if (id === 'chain-layout') { return layoutEl; }
    return null;
  },
  // The display register + flow toggle need it — canvas.js guards with
  // typeof checks, so the palette-cards harness (without querySelector)
  // simply skips them; THIS harness provides one selector.
  querySelector: function (sel) {
    if (sel === '.canvas-panel') { return panelEl; }
    return null;
  }
};

// ----------------------------------------------------------------------
// Stub collaborators + call log.
// ----------------------------------------------------------------------
var calls = {
  buildGraph: [],
  persist: [],
  markModified: 0,
  noteHumanEdit: 0,
  updateNodeParams: [],
  applyParam: []
};

function snapshotModel(model) {
  return model.map(function (e) {
    return { id: e.id, type: e.type, params: Object.assign({}, e.params) };
  });
}

var fakeInstance = { marker: 'fake-live-node' };

var windowStub = {
  document: documentStub,
  AudioGraph: {
    registerNodeType: function () {},
    buildGraph: function (model) { calls.buildGraph.push(snapshotModel(model)); },
    updateNodeParams: function (id, params) {
      calls.updateNodeParams.push({ id: id, params: params });
    },
    getNodeInstance: function () { return fakeInstance; }
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

function loadSrc(file) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src', file), 'utf8'),
    sandbox,
    { filename: file }
  );
}

// Real sources in index.html order (gain + delay carry the knob/trim
// allocation under test; autotune carries the discrete pad shapes).
loadSrc('node-types.js');
loadSrc('param-controls.js');
loadSrc('node-gain.js');
loadSrc('node-delay.js');
loadSrc('node-autotune.js');
loadSrc('canvas.js');

var seamRequests = [];
windowStub.ChainEditing = {
  getModel: function () { return windowStub.ChainCanvas.getCurrentModel(); },
  getLayout: function () { return windowStub.ChainCanvas.getCurrentLayout(); },
  syncLayout: function () {},
  apply: function (request) {
    seamRequests.push(request);
    if (request.candidate) {
      windowStub.ChainCanvas.renderModel(request.candidate, request.layout);
    } else if (request.change) {
      windowStub.ChainCanvas.renderNodeParam(
        request.change.nodeId,
        request.change.param,
        request.change.value
      );
    }
    return Promise.resolve({ applied: true, saved: true });
  }
};

// Record at the REGISTRY BOUNDARY (the committed convention): override
// NodeTypes.applyParam after load so commits are captured without
// needing each type's real AudioNode composite — param-controls resolves
// window.NodeTypes.applyParam at COMMIT time, so the override holds.
windowStub.NodeTypes.applyParam = function (type, node, paramId, value) {
  calls.applyParam.push({ type: type, node: node, paramId: paramId, value: value });
};

// ----------------------------------------------------------------------
// Helpers over the section anatomy.
// ----------------------------------------------------------------------
function cards() {
  return chainListEl.querySelectorAll('.node-card');
}

function paramRows(card) {
  var inner = deepFind(card, function (el) {
    return el.className.split(/\s+/).indexOf('node-params-inner') !== -1;
  });
  return inner ? inner.children : [];
}

function rowFor(card, paramId) {
  var nodeId = card.attrs['data-node-id'];
  var found = null;
  paramRows(card).some(function (row) {
    found = deepFind(row, function (el) {
      return el.tagName === 'INPUT' &&
        el.id === 'param-' + nodeId + '-' + paramId;
    });
    return !!found;
  });
  return found;
}

function rowByParam(card, paramId) {
  var nodeId = card.attrs['data-node-id'];
  var rowFound = null;
  paramRows(card).some(function (row) {
    var has = deepFind(row, function (el) {
      return el.tagName === 'INPUT' &&
        el.id === 'param-' + nodeId + '-' + paramId;
    });
    if (has) {
      rowFound = row;
    }
    return !!has;
  });
  return rowFound;
}

function rowClass(row, cls) {
  return deepFind(row, function (el) {
    return el.className.split(/\s+/).indexOf(cls) !== -1;
  });
}

function registerSpan(cls) {
  return deepFind(panelEl, function (el) {
    return el.className.split(/\s+/).indexOf(cls) !== -1;
  });
}

// CSS structural guards (the section-I convention from
// test-palette-cards-cycle3.js: parse the REAL stylesheet, comments
// stripped, declarations only).
var RAW_CSS = '\n' + fs.readFileSync(path.join(ROOT, 'styles', 'main.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function cssRule(selector) {
  // FEW-2: selector GROUPS — a rule may LEAD with this selector followed by
  // more selectors (e.g. the flow-toggle + tidy-toggle chrome rule). Search
  // both forms and take the EARLIEST hit so the first authored rule wins.
  var idxExact = RAW_CSS.indexOf('\n' + selector + ' {');
  var idxGroup = RAW_CSS.indexOf('\n' + selector + ',');
  var idx;
  if (idxExact === -1) { idx = idxGroup; }
  else if (idxGroup === -1) { idx = idxExact; }
  else { idx = Math.min(idxExact, idxGroup); }
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

// ----------------------------------------------------------------------
// A. Knob component wiring, both directions.
// ----------------------------------------------------------------------
console.log('A. knob wiring (human path + agent fast path)');

windowStub.ChainCanvas.renderModel([
  { id: 'g0', type: 'gain', params: { gainDb: 0 } }
]);
// Structural refresh of the state line happens in STATE mode (before any
// touch): 1 module, then 2 after a second load.
windowStub.ChainCanvas.renderModel([
  { id: 'g1', type: 'gain', params: { gainDb: 0 } },
  { id: 'd1', type: 'delay', params: { timeMs: 300, feedback: 25, mix: 25 } }
]);
// (The ENGINE-state rest line is retired — 2026-08-31, user direction:
// the register speaks only when a control is touched.)

var gainCard = cards().filter(function (c) {
  return c.attrs['data-node-id'] === 'g1';
})[0];
var gainRow = rowByParam(gainCard, 'gainDb');
var gainInput = rowFor(gainCard, 'gainDb');
var gainKnob = rowClass(gainRow, 'knob');
var gainValueSpan = rowClass(gainRow, 'param-value');

check(
  !!gainKnob && !!gainInput && gainInput.type === 'range',
  'a continuous param renders the native range engine + a .knob visual'
);
check(
  gainInput.className === 'knob-input' &&
    gainKnob.children.length === 3 &&
    !!rowClass(gainRow, 'knob-ring') &&
    !!rowClass(gainRow, 'knob-cap') &&
    !!rowClass(gainRow, 'knob-pointer'),
  'knob anatomy: ring + cap + pointer over the clipped engine input'
);
check(
  gainKnob.getAttribute('data-detent') === 'true',
  'bipolar param (gainDb -24..24) prints the unity detent (data-detent true)'
);

// Delay allocation: Time is the committed TRIM; Feedback/Mix are knobs.
var delayCard = cards().filter(function (c) {
  return c.attrs['data-node-id'] === 'd1';
})[0];
check(
  rowFor(delayCard, 'timeMs').className === 'trim-slider' &&
    rowClass(rowByParam(delayCard, 'timeMs'), 'trim-unit') !== null,
  'delay Time renders the TRIM shape (wide linear range demands throw)'
);
check(
  rowFor(delayCard, 'feedback').className === 'knob-input' &&
    rowFor(delayCard, 'mix').className === 'knob-input',
  'delay Feedback/Mix render KNOBs'
);
check(
  rowClass(rowByParam(delayCard, 'feedback'), 'knob').getAttribute('data-detent') === 'false',
  'unipolar param (feedback 0..90) has NO detent'
);

// A1. HUMAN PATH: keyboard-style value change on the engine input
// commits through the pipeline and moves the visible span.
calls.applyParam.length = 0;
calls.updateNodeParams.length = 0;
gainInput.value = '12';
gainInput.fire('input');
check(
  seamRequests.length === 1 &&
    seamRequests[0].change.param === 'gainDb' &&
    seamRequests[0].change.value === 12,
  'human knob gesture emits one normalized ChainEditing intent (12)'
);
check(
  calls.updateNodeParams.length === 0 && calls.applyParam.length === 0,
  'the control and Canvas adapters perform no graph or live-node write'
);
check(
  gainValueSpan.textContent === '12 dB',
  'the mono value span reads "12 dB" after the human commit'
);

// A2. AGENT FAST PATH: ChainCanvas.updateNodeParam moves the SAME state
// without a re-render and without a commit (the caller owns the live
// write).
var persistBefore = calls.persist.length;
calls.applyParam.length = 0;
check(
  windowStub.ChainCanvas.renderNodeParam('g1', 'gainDb', -6) === true,
  'updateNodeParam (set_param canvas half) applies gainDb -6'
);
check(
  Number(gainInput.value) === -6,
  'the engine input moved to -6 in place (no re-render)'
);
check(
  gainValueSpan.textContent === '-6 dB',
  'the mono span moved to "-6 dB" in place'
);
check(
  calls.applyParam.length === 0,
  'the fast-path move issues NO commit of its own (display + bookkeeping only)'
);
check(
  windowStub.ChainCanvas.getCurrentModel()[0].params.gainDb === -6,
  'the canvas model carries -6 after the fast-path move'
);
check(
  calls.persist.length === persistBefore,
  'the accepted render adapter performs no persistence write itself'
);

// A3. Both directions stay in agreement: a LATER human move on the same
// control builds on the agent value (no revert), and a later agent move
// overrides the human one.
gainInput.value = '3';
gainInput.fire('input');
check(
  windowStub.ChainCanvas.getCurrentModel()[0].params.gainDb === 3,
  'a later human move on the same knob supersedes cleanly (3)'
);
windowStub.ChainCanvas.renderNodeParam('g1', 'gainDb', 24);
gainInput.value = '10';
gainInput.fire('input');
check(
  windowStub.ChainCanvas.getCurrentModel()[0].params.gainDb === 10 &&
    Number(gainInput.value) === 10,
  'a later accepted write then human move land on the human value (model=' +
    windowStub.ChainCanvas.getCurrentModel()[0].params.gainDb + ', input=' + gainInput.value + ')'
);

// ----------------------------------------------------------------------
// B. Discrete pad commits (string values verbatim).
// ----------------------------------------------------------------------
console.log('B. pad commits');

windowStub.ChainCanvas.renderModel([
  { id: 'a1', type: 'autotune', params: { key: 'C', scale: 'Chromatic', retune: 0, mix: 100 } }
]);
var atCard = cards()[0];
var atRows = paramRows(atCard);
var keyGroup = rowClass(atRows[0], 'pad-group');
var scaleGroup = rowClass(atRows[1], 'pad-group');

check(
  !!keyGroup && keyGroup.children.length === 12 &&
    keyGroup.children.every(function (p) { return p.tagName === 'BUTTON'; }),
  'autotune Key renders 12 real pad buttons'
);
check(
  keyGroup.getAttribute('role') === 'radiogroup' &&
    keyGroup.getAttribute('aria-labelledby') === atRows[0].children[0].id,
  'the pad group is a radiogroup named by its label'
);

function pressed(group) {
  var p = group.children.filter(function (pad) {
    return pad.getAttribute('aria-checked') === 'true';
  });
  return p.length === 1 ? p[0] : null;
}

check(
  pressed(keyGroup).textContent === 'C' && pressed(scaleGroup).textContent === 'Chromatic',
  'pads start at the saved values (C / Chromatic)'
);

// Tab stop: exactly the pressed pad.
check(
  keyGroup.children.filter(function (p) {
    return p.getAttribute('tabindex') === '0';
  }).length === 1,
  'roving tabindex: exactly one tab stop in the key group'
);

calls.applyParam.length = 0;
calls.updateNodeParams.length = 0;
scaleGroup.children.filter(function (p) {
  return p.textContent === 'Minor';
})[0].fire('click');

check(
  seamRequests[seamRequests.length - 1].change.param === 'scale' &&
    seamRequests[seamRequests.length - 1].change.value === 'Minor' &&
    typeof seamRequests[seamRequests.length - 1].change.value === 'string',
  'pad click emits the STRING value verbatim as a ChainEditing intent'
);
check(
  calls.applyParam.length === 0 && calls.updateNodeParams.length === 0,
  'pad gesture performs no live/model graph write in ParamControls or Canvas'
);
check(
  pressed(scaleGroup).textContent === 'Minor',
  'the pressed pad moved to Minor'
);

// Fast path on a discrete param: moves the pad, no commit.
calls.applyParam.length = 0;
windowStub.ChainCanvas.renderNodeParam('a1', 'key', 'F#');
check(
  pressed(keyGroup).textContent === 'F#' &&
    keyGroup.children.filter(function (p) {
      return p.getAttribute('tabindex') === '0';
    })[0].textContent === 'F#',
  'fast-path pad write moves the pressed pad AND the tab stop (F#)'
);
check(
  calls.applyParam.length === 0,
  'fast-path pad write issues no commit (caller owns the live write)'
);
check(
  windowStub.ChainCanvas.getCurrentModel()[0].params.key === 'F#',
  'the model carries the string F# (verbatim, no coercion)'
);

// ----------------------------------------------------------------------
// C. Display register contract.
// ----------------------------------------------------------------------
console.log('C. display register');

var registerEl = panelEl.children.filter(function (c) {
  return c.className.split(/\s+/).indexOf('display-register') !== -1;
})[0];

check(
  !!registerEl && panelEl.children[0] === registerEl,
  'the register is built as the canvas panel\'s FIRST child (top edge)'
);
check(
  registerEl.getAttribute('aria-hidden') === 'true',
  'the register is aria-hidden (purely visual redundancy — controls carry semantics)'
);

var regModule = registerSpan('register-module');
var regParam = registerSpan('register-param');
var regValue = registerSpan('register-value');
var regHelp = registerSpan('register-help');
check(
  !!regModule && !!regParam && !!regValue && !!regHelp,
  'the register carries the module/param/value/help slots'
);

// A control event switches it to MODULE · PARAM · VALUE + the help line.
windowStub.ChainCanvas.renderModel([
  { id: 'g2', type: 'gain', params: { gainDb: 0 } }
]);
var g2 = cards()[0];
var g2Input = rowFor(g2, 'gainDb');
g2Input.value = '7.5';
g2Input.fire('input');
check(
  regModule.textContent === 'Gain' &&
    regParam.textContent === 'Gain' &&
    regValue.textContent === '7.5 dB',
  'a knob commit answers on the register: Gain · Gain · 7.5 dB'
);
check(
  regHelp.textContent === 'Overall mic volume. Higher = louder.',
  'the register reuses param-controls\' PLAIN_LANGUAGE_HELP line verbatim (no duplicated copy)'
);
check(
  regValue.className.split(/\s+/).indexOf('register-blink') !== -1,
  'the live-control blink class lands on the value segment'
);

// The focus feed: focusing a control answers on the register BEFORE it
// moves (no commit fired).
calls.applyParam.length = 0;
windowStub.ChainCanvas.renderModel([
  { id: 'g3', type: 'gain', params: { gainDb: 0 } }
]);
var g3 = cards()[0];
var g3Input = rowFor(g3, 'gainDb');
g3Input.fire('focus');
check(
  regModule.textContent === 'Gain' && regValue.textContent === '0 dB',
  'focus feeds the register with the current value (0 dB) before any move'
);
check(
  calls.applyParam.length === 0,
  'the focus feed commits nothing'
);

// Sticky: a structural change after a touch does not overwrite the
// touched control's line (the groovebox rule).
windowStub.ChainCanvas.onEngineStarted();
check(
  regModule.textContent === 'Gain' && regValue.textContent === '0 dB',
  'the touched-control line is STICKY (engine-state refresh does not overwrite it)'
);

// Fixed geometry: the CSS pins the height (the register never pumps
// layout) and tabular numerals on the value line.
var registerRule = cssRule('.display-register');
check(
  registerRule !== null && cssDecl(registerRule, 'height') === '3rem' &&
    cssDecl(registerRule, 'overflow') === 'hidden',
  'CSS pins the register geometry (height 3rem, overflow hidden — no layout pumping)'
);
var registerMainRule = cssRule('.register-main');
check(
  registerMainRule !== null &&
    cssDecl(registerMainRule, 'font-variant-numeric') === 'tabular-nums',
  'the register value line uses tabular numerals'
);

// ----------------------------------------------------------------------
// D. Section fold.
// ----------------------------------------------------------------------
console.log('D. section fold');

var foldCard = cards()[0]; // g3
var foot = deepFind(foldCard, function (el) {
  return el.className.split(/\s+/).indexOf('section-foot') !== -1;
});
var collapseBtn = foot.children[0];

check(
  collapseBtn.getAttribute('aria-expanded') === 'true' &&
    !foldCard.classList.contains('collapsed'),
  'section starts expanded (aria-expanded true)'
);
collapseBtn.fire('click');
check(
  foldCard.classList.contains('collapsed') &&
    collapseBtn.getAttribute('aria-expanded') === 'false',
  'fold toggle flips .collapsed + mirrors aria-expanded false'
);
collapseBtn.fire('click');
check(
  !foldCard.classList.contains('collapsed') &&
    collapseBtn.getAttribute('aria-expanded') === 'true',
  'fold toggle re-expands'
);

// Session-only: a rebuild (loadModel) re-creates sections expanded.
collapseBtn.fire('click');
check(foldCard.classList.contains('collapsed'), 'section folded before the rebuild');
windowStub.ChainCanvas.renderModel([
  { id: 'g4', type: 'gain', params: { gainDb: 0 } }
]);
var rebuilt = cards()[0];
check(
  rebuilt !== foldCard && !rebuilt.classList.contains('collapsed'),
  'rebuild re-expands (fold is session-only, never persisted)'
);

// The CSS fold: 0fr grid + visibility hidden (tab-order removal), with
// the reduced-motion instant fallback carried by the media guard.
var foldRule = cssRule('.node-card.collapsed .node-params');
var foldInnerRule = cssRule('.node-card.collapsed .node-params-inner');
check(
  foldRule !== null && cssDecl(foldRule, 'grid-template-rows') === '0fr',
  'CSS folds the field to 0fr'
);
check(
  foldInnerRule !== null && cssDecl(foldInnerRule, 'visibility') === 'hidden',
  'CSS hides the folded rows (visibility hidden removes them from tab order)'
);
var foldTransitionRule = cssRule('.node-params');
check(
  foldTransitionRule !== null &&
    RAW_CSS.indexOf('prefers-reduced-motion: no-preference') !== -1,
  'the fold animation is reduced-motion guarded (instant fallback under reduce)'
);

// ----------------------------------------------------------------------
// E. Drag-handle scoping.
// ----------------------------------------------------------------------
console.log('E. drag-handle scoping');

var chainInstance = null;
windowStub.Sortable.instances.forEach(function (inst) {
  if (inst.el === chainListEl) { chainInstance = inst; }
});
check(
  chainInstance === null,
  'FEW-2/PD-1: NO chain-list Sortable exists — the grip is a POSITION drag (scoped to .node-drag-handle in src/canvas.js), never a reorder'
);

var handle = deepFind(rebuilt, function (el) {
  return el.className.split(/\s+/).indexOf('node-drag-handle') !== -1;
});
check(
  !!handle &&
    !!deepFind(handle, function (el) {
      return el.className.split(/\s+/).indexOf('node-drag-icon') !== -1;
    }),
  'the grip dot field lives inside the handle (a visible panel part)'
);

function subtreeHas(el, pred) {
  if (pred(el)) { return true; }
  return el.children.some(function (c) { return subtreeHas(c, pred); });
}
check(
  !subtreeHas(handle, function (el) {
    return el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'SELECT';
  }),
  'NO interactive control lives inside the handle (knobs/pads/chevron/remove can never start a drag)'
);

// And the controls DO exist elsewhere in the section (the scoping is not
// vacuous).
check(
  subtreeHas(rebuilt, function (el) { return el.tagName === 'INPUT'; }) &&
    subtreeHas(rebuilt, function (el) { return el.tagName === 'BUTTON'; }),
  'the section carries its input + header-zone buttons OUTSIDE the handle'
);

// ----------------------------------------------------------------------
// F. Adjustment round — display ladder + family-colored knob arcs.
// ----------------------------------------------------------------------
console.log('F. adjustment round: display ladder + family arcs');

// F1. The display ladder: every value/state readout shares ONE per-control
// mono tier (0.75rem / tabular / slot min-width); the register keeps its
// instrument tier (0.85rem); the register help line joins the mono face.
var VALUE_TIER = '0.75rem';
var REGISTER_TIER = '0.85rem';

var paramValueRule = cssRule('.param-value');
check(
  paramValueRule !== null &&
    cssDecl(paramValueRule, 'font-size') === VALUE_TIER &&
    cssDecl(paramValueRule, 'font-variant-numeric') === 'tabular-nums' &&
    cssDecl(paramValueRule, 'min-width') === '6ch',
  'per-control values (.param-value): ' + VALUE_TIER + ' mono, tabular, 6ch min-width slot (knob + trim share the rule)'
);
var padRule = cssRule('.pad');
check(
  padRule !== null &&
    cssDecl(padRule, 'font-size') === VALUE_TIER &&
    cssDecl(padRule, 'font-variant-numeric') === 'tabular-nums',
  'pad legends ride the same per-control value tier (' + VALUE_TIER + ', tabular — the pressed pad IS the value display)'
);
var meterReadoutRule = cssRule('.meter-readout');
check(
  meterReadoutRule !== null &&
    cssDecl(meterReadoutRule, 'font-size') === VALUE_TIER &&
    cssDecl(meterReadoutRule, 'font-weight') === '400' &&
    cssDecl(meterReadoutRule, 'font-variant-numeric') === 'tabular-nums',
  'meter dB readout: value tier with weight pinned 400 (it inherits through two 700-weight ancestors otherwise)'
);
var registerHelpRule = cssRule('.register-help');
check(
  registerHelpRule !== null &&
    cssDecl(registerHelpRule, 'font-family') === 'var(--font-readout)' &&
    cssDecl(registerHelpRule, 'font-size') === VALUE_TIER &&
    cssDecl(registerHelpRule, 'font-variant-numeric') === 'tabular-nums',
  'register help line: mono face + tabular numerals at the value tier (register segments internally consistent)'
);
var registerMainRule2 = cssRule('.register-main');
check(
  registerMainRule2 !== null &&
    cssDecl(registerMainRule2, 'font-size') === REGISTER_TIER &&
    cssDecl(registerMainRule2, 'font-variant-numeric') === 'tabular-nums',
  'register value line keeps the panel-instrument tier (' + REGISTER_TIER + ', tabular — one tier up by direction)'
);
// The ladder is CLOSED: no other rule re-sizes a ladder element away
// from its tier (the ten value/state selectors carry exactly the two
// documented sizes between them).
var LADDER_SELECTORS = [
  '.param-value', '.pad', '.meter-readout', '.register-help', '.register-main'
];
var ladderSizes = LADDER_SELECTORS.map(function (sel) {
  return cssDecl(cssRule(sel) || '', 'font-size');
});
check(
  ladderSizes.every(function (s) {
    return s === VALUE_TIER || s === REGISTER_TIER;
  }) &&
    ladderSizes.indexOf(VALUE_TIER) !== -1 &&
    ladderSizes.indexOf(REGISTER_TIER) !== -1,
  'the display ladder is two tiers exactly (' + VALUE_TIER + ' values / ' + REGISTER_TIER + ' register), nothing in between'
);

// F2. Family-colored arcs: the ten data-family rules are the ONE
// derivation site — each sets --knob-arc from the rq5 --family-* token
// (the palette flank's own vocabulary; never raw hex, never a per-control
// class) and .knob-ring consumes it instead of the system accent.
var FAMILIES = [
  'gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter',
  'distortion', 'chorus', 'gate', 'autotune'
];
var arcDerivationsOk = true;
var arcTokenSourcesOk = true;
FAMILIES.forEach(function (fam) {
  var body = cssRule(".node-card[data-family='" + fam + "']");
  var arc = body ? cssDecl(body, '--knob-arc') : null;
  if (arc !== 'var(--family-' + fam + ')') {
    arcDerivationsOk = false;
  }
  // The referenced token is a real :root definition (derivation resolves).
  if (RAW_CSS.indexOf('--family-' + fam + ':') === -1) {
    arcTokenSourcesOk = false;
  }
  // No raw hex ever rides the derivation rule (token-only discipline).
  if (body && /#[0-9a-fA-F]{3,8}\b/.test(body)) {
    arcDerivationsOk = false;
  }
});
check(
  arcDerivationsOk,
  'all ten .node-card[data-family] rules derive --knob-arc from their rq5 --family-* token (one source, no raw hex)'
);
check(
  arcTokenSourcesOk,
  'every referenced --family-* token is defined in the stylesheet (the derivation resolves)'
);
var knobRingRule = cssRule('.knob-ring');
check(
  knobRingRule !== null &&
    knobRingRule.indexOf('var(--knob-arc') !== -1 &&
    knobRingRule.indexOf('var(--pm-accent') === -1,
  '.knob-ring consumes var(--knob-arc) — the arc is family-colored, NOT the system accent'
);
// Structural single-source: a rendered knob is a DESCENDANT of the
// data-family card, so the cascade (not any per-control class) carries
// the arc color; both the drag path and the fast path write --knob-pos
// through syncKnobVisual, re-rendering the same family arc.
check(
  (function () {
    var knob = deepFind(rebuilt, function (el) {
      return el.className.split(/\s+/).indexOf('knob') !== -1;
    });
    return !!knob && rebuilt.getAttribute('data-family') === 'gain';
  })(),
  'the .knob visual renders INSIDE its data-family section (arc color arrives by cascade — no per-control class to drift)'
);
// The neutral choice is recorded where it is enforced: detent tick and
// trim cap stay neutral print (family color lives on the arc alone).
var detentRule = cssRule(".knob[data-detent='true']::after");
var trimThumbRule = cssRule('.trim-slider::-webkit-slider-thumb');
check(
  detentRule !== null &&
    cssDecl(detentRule, 'background') === 'var(--pm-print)' &&
    trimThumbRule !== null &&
    cssDecl(trimThumbRule, 'background') === 'var(--pm-print-hi)',
  'detent ticks and trim caps stay NEUTRAL print (family color on arcs only — the recorded calm choice)'
);
// The system accent keeps its reserved knob-side duties: the focus ring.
var focusRingRule = cssRule('.knob-input:focus-visible ~ .knob-unit .knob');
check(
  focusRingRule !== null &&
    cssDecl(focusRingRule, 'outline').indexOf('var(--pm-accent)') !== -1,
  'the knob focus ring stays SIGNAL ORANGE (accent reserved for system states)'
);

// ----------------------------------------------------------------------
// G. Item 2 bake (2026-08-30 pick: A ENCODER) — variant machinery gone,
//    the picked refinement shipped ungated, the built feel everywhere.
// ----------------------------------------------------------------------
console.log('');
console.log('G. item 2 bake: no variant machinery, encoder feel + amber value lift');

// The feel switch is gone with the round's switcher (FEW-0): nothing in
// src reads a body attribute anymore, so a plain body stub suffices.
documentStub.body = {};

// Fresh fixtures (section D re-rendered the canvas as one g4 gain
// card): the CURRENT gain card's engine input + knob visual.
var gCard2 = cards()[0];
var gInput2 = rowFor(gCard2, 'gainDb');
var gKnob2 = rowClass(rowByParam(gCard2, 'gainDb'), 'knob');

function dragKnob(moves) {
  gKnob2.fire('pointerdown', {
    clientY: 200, pointerId: 1, shiftKey: false,
    preventDefault: function () {}
  });
  // Each move is a DELTA from the previous pointer position (real
  // pointer semantics — the handler reads clientY, not per-move dy).
  var y = 200;
  moves.forEach(function (m) {
    y -= m.dy;
    gKnob2.fire('pointermove', {
      clientY: y, shiftKey: !!m.shift,
      preventDefault: function () {}
    });
  });
  gKnob2.fire('pointerup', {});
}

function wheelKnob(deltaY, shift) {
  gKnob2.fire('wheel', {
    deltaY: deltaY, deltaX: 0, shiftKey: !!shift,
    preventDefault: function () {}
  });
}

function setGain(v) {
  gInput2.value = String(v);
}

// G1. The built ENCODER linear feel, exactly (60px up from 0:
// (60/150)*48 = 19.2 -> 19.0 on the 0.5 grid).
setGain(0);
dragKnob([{ dy: 60 }]);
check(
  Number(gInput2.value) === 19,
  'the built ENCODER linear drag is untouched (60px -> 19 dB)'
);
setGain(0);
wheelKnob(-100, false);
check(
  Number(gInput2.value) === 0.5,
  'wheel: unchanged one-spec-step-per-notch regression (0.5 dB)'
);

// G2. The variant machinery is GONE: body[data-knob-variant] appears
// nowhere in the stylesheet, the page, or src (no writer, no reader,
// no gated rules — the unpicked variants never ship, the picked one
// needs no gate).
var gateUses = RAW_CSS.split('data-knob-variant').length - 1;
var RAW_HTML = '\n' + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var SRC_DIR = path.join(ROOT, 'src');
var srcVariantUses = fs.readdirSync(SRC_DIR).filter(function (f) {
  return /\.js$/.test(f);
}).reduce(function (n, f) {
  return n + (fs.readFileSync(path.join(SRC_DIR, f), 'utf8')
    .split('data-knob-variant').length - 1);
}, 0);
check(
  gateUses === 0 &&
    RAW_HTML.split('data-knob-variant').length - 1 === 0 &&
    RAW_HTML.split('item2-variant-switcher').length - 1 === 0 &&
    srcVariantUses === 0,
  'no data-knob-variant anywhere (css ' + gateUses + ', html/src 0) and no switcher in the served page'
);

// G3. The picked variant's ONE refinement, baked ungated: the held
// knob's mono value line answers amber.
var liveValue = cssRule(".knob[data-live='true'] ~ .param-value");
check(
  liveValue !== null &&
    cssDecl(liveValue, 'color') === 'var(--pm-display)',
  'the held knob\u2019s mono value line lifts to display amber (the picked A refinement, gate dropped)'
);

// ----------------------------------------------------------------------
// Summary.
// ----------------------------------------------------------------------
console.log('');
if (failures.length === 0) {
  console.log('control-layer-pattern-machine: ALL PASS');
  process.exit(0);
} else {
  console.log('control-layer-pattern-machine: ' + failures.length + ' FAILURE(S)');
  process.exit(1);
}
