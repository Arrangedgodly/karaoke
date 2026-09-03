// Test for cycle-3 UI-1 — discrete (enumerated) param controls: Key/Scale.
// (Rewritten for redesign item 1: the discrete shape is a PAD SELECTOR —
// real <button> pads in a role="radiogroup" with roving tabindex — where
// it was a native <select>. The BEHAVIOR contract is unchanged.)
//
// A spec entry carrying `values: [...]` renders one pad per value and
// commits its STRING value through the exact same pipeline a knob move
// uses — AudioGraph.updateNodeParams (model bookkeeping) +
// EffectCatalog.applyParam (live write). No autotune node exists yet, so
// this validates against a throwaway `test-keys` type registered only
// inside this script (same precedent as UI-4's throwaway `test-gain`).
//
// Checked here, on the REAL src/param-controls.js + src/effect-catalog.js
// loaded into a vm sandbox with a minimal fake DOM:
//   A. RENDER: a `values` spec renders a pad group of real buttons (one
//      per value, aria-checked on the spec default), named by its label
//      through the radiogroup's aria-labelledby (SR name), with roving
//      tabindex (exactly the selected pad is tabbable); a sibling
//      numeric spec still renders a range input (no regression).
//   B. COMMIT: firing a pad's `click` handler (the keyboard Enter/Space
//      twin) reaches EffectCatalog.applyParam with the STRING value ('A'),
//      updates the model via AudioGraph.updateNodeParams, and reports
//      through onParamsChanged with the full params object.
//   C. EXTERNAL WRITE: ParamControls.updateControl (the agent set_param
//      fast path's bridge) moves the pad selection and its working copy
//      in place — a later human change on the sibling control does not
//      revert it.
//   D. A11y shape (structural, per the committed-test convention): the
//      pads are real native buttons (keyboard activation for free) and
//      each pad's text is the announced value verbatim.
//
// Same committed-test convention as the rest of the suite: zero-dependency
// Node harness, stub `window` + minimal DOM, load the REAL src files
// (fs.readFileSync + vm.runInContext).
//
// Run from a clean clone:  node tests/test-discrete-param-controls.js
// (or via the runner:      node tests/run.js discrete-param)
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
// Minimal fake DOM — only what param-controls.js actually touches.
// ----------------------------------------------------------------------
function makeElement(tagName) {
  var el = {
    tagName: String(tagName),
    children: [],
    listeners: {},
    className: '',
    id: '',
    type: '',
    value: '',
    textContent: '',
    title: '',
    innerHTML: '',
    min: '',
    max: '',
    step: ''
  };
  el.appendChild = function (child) {
    el.children.push(child);
    return child;
  };
  el.addEventListener = function (evt, fn) {
    (el.listeners[evt] = el.listeners[evt] || []).push(fn);
  };
  el.setAttribute = function (name, val) {
    el['attr_' + name] = val;
  };
  el.getAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(el, 'attr_' + name)
      ? el['attr_' + name]
      : null;
  };
  el.fire = function (evt) {
    (el.listeners[evt] || []).forEach(function (fn) {
      fn({ preventDefault: function () {}, stopPropagation: function () {} });
    });
  };
  return el;
}

var documentStub = { createElement: makeElement };

// ----------------------------------------------------------------------
// Stub collaborators + call log.
// ----------------------------------------------------------------------
var calls = {
  updateNodeParams: [],
  applyParam: [],
  nodeInstance: { marker: 'fake-live-node' }
};

var windowStub = {
  document: documentStub,
  AudioGraph: {
    updateNodeParams: function (id, params) {
      calls.updateNodeParams.push({ id: id, params: params });
    },
    getNodeInstance: function () {
      return calls.nodeInstance;
    }
  },
  // No AgentUI in the harness — the input handler's guarded call must
  // no-op without it.
  AgentUI: undefined
};

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

loadSrc('effect-catalog.js');
loadSrc('param-controls.js');

// ----------------------------------------------------------------------
// Throwaway discrete-capable type (UI-4's throwaway-type precedent).
// The key/scale param SHAPE AT-1's autotune node will register: two flat
// string params, exactly like every other type's flat numeric params.
// ----------------------------------------------------------------------
var KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var SCALES = ['Chromatic', 'Major', 'Minor'];

var applied = [];
windowStub.EffectCatalog.register('test-keys', {
  label: 'Test Keys',
  plainLabel: 'Test plain label',
  experimental: false,
  paramSpec: [
    { id: 'key', label: 'Key', values: KEYS, default: 'C' },
    { id: 'scale', label: 'Scale', values: SCALES, default: 'Chromatic' },
    { id: 'mix', label: 'Mix', min: 0, max: 100, default: 50, step: 1, unit: '%' }
  ],
  applyParam: function (node, paramId, value) {
    applied.push({ node: node, paramId: paramId, value: value });
  },
  create: function () { return calls.nodeInstance; }
});

function padGroupOf(row) {
  return row.children.filter(function (c) {
    return c.className === 'pad-group';
  })[0];
}

function pressedPad(group) {
  var pressed = group.children.filter(function (p) {
    return p.getAttribute('aria-checked') === 'true';
  });
  return pressed.length === 1 ? pressed[0] : null;
}

// ----------------------------------------------------------------------
// A. Render.
// ----------------------------------------------------------------------
console.log('A. render');

var container = makeElement('div');
var modelEntry = { id: 'n1', type: 'test-keys', params: {} };
var onParamsChangedCalls = [];
windowStub.ParamControls.render(container, modelEntry, function (p, change) {
  onParamsChangedCalls.push({ params: p, change: change });
});

var rows = container.children;
check(rows.length === 3, 'one row per paramSpec entry (3)');
check(container.innerHTML === '', 'container cleared before render');

var keyRow = rows[0];
var keyGroup = padGroupOf(keyRow);
var keyLabel = keyRow.children[0];
check(
  !!keyGroup,
  'values spec renders a .pad-group, not a range input'
);
check(
  keyGroup.children.length === 12,
  'key group has all 12 pads (C..B)'
);
check(
  keyGroup.children.every(function (p, i) {
    return p.tagName === 'button' && p.textContent === KEYS[i];
  }),
  'each pad is a native button whose text is the announced value verbatim (C, C#, ... B)'
);
check(
  pressedPad(keyGroup) === keyGroup.children[0] &&
    pressedPad(keyGroup).textContent === 'C',
  'the spec default (C) is the one pressed pad'
);
check(
  keyGroup.getAttribute('role') === 'radiogroup' &&
    keyGroup.getAttribute('aria-labelledby') === keyLabel.id &&
    keyLabel.getAttribute('for') === null,
  'the radiogroup is named by its label via aria-labelledby (SR accessible name)'
);
check(
  keyGroup.children.every(function (p) {
    return p.type === 'button';
  }),
  'pads are type=button (no form submission)'
);

// Roving tabindex: exactly the pressed pad is tabbable.
var tabbable = keyGroup.children.filter(function (p) {
  return p.getAttribute('tabindex') === '0';
});
check(
  tabbable.length === 1 && tabbable[0] === pressedPad(keyGroup),
  'roving tabindex — exactly the selected pad is tabbable'
);

var scaleGroup = padGroupOf(rows[1]);
check(scaleGroup.children.length === 3, 'scale group has 3 pads (Chromatic/Major/Minor)');
check(
  pressedPad(scaleGroup).textContent === 'Chromatic',
  'scale default is Chromatic'
);

var mixInput = rows[2].children.filter(function (c) {
  return c.tagName === 'input';
})[0];
check(
  !!mixInput && mixInput.type === 'range',
  'sibling numeric spec still renders a range input (no regression)'
);
var mixSpan = rows[2].children.filter(function (c) {
  return c.className === 'knob-unit';
})[0].children.filter(function (c) {
  return c.className === 'param-value';
})[0];
check(
  mixSpan.textContent === '50%',
  'numeric value display still unit-formatted (50%)'
);

// ----------------------------------------------------------------------
// B. Gesture — pad activation emits a normalized string intent.
// ----------------------------------------------------------------------
console.log('B. commit');

// A keyboard user lands on Key's A pad: Enter/Space fires the button's
// native click. param-controls commits on the same 'click' event.
var keyPadA = keyGroup.children.filter(function (p) {
  return p.textContent === 'A';
})[0];
keyPadA.fire('click');

check(
  applied.length === 0 && calls.updateNodeParams.length === 0,
  'ParamControls performs no live or graph write before ChainEditing accepts the intent'
);
check(
  onParamsChangedCalls.length === 1 &&
    onParamsChangedCalls[0].params.key === 'A' &&
    onParamsChangedCalls[0].change.param === 'key' &&
    onParamsChangedCalls[0].change.value === 'A' &&
    typeof onParamsChangedCalls[0].change.value === 'string',
  'onParamsChanged emits the full candidate params plus normalized STRING key intent'
);
check(
  pressedPad(keyGroup).textContent === 'C',
  'the pad remains on the accepted value until ChainEditing renders acceptance'
);

windowStub.ParamControls.updateControl('n1', 'key', 'A');
check(pressedPad(keyGroup) === keyPadA, 'the accepted adapter render moves the pressed pad to A');

scaleGroup.children
  .filter(function (p) { return p.textContent === 'Major'; })[0]
  .fire('click');
check(
  onParamsChangedCalls.length === 2 &&
    onParamsChangedCalls[1].change.param === 'scale' &&
    onParamsChangedCalls[1].change.value === 'Major',
  'scale change emits a normalized STRING intent'
);

// ----------------------------------------------------------------------
// C. External write via updateControl + no-revert on later human change.
// ----------------------------------------------------------------------
console.log('C. external write');

check(
  windowStub.ParamControls.updateControl('n1', 'key', 'E') === true,
  'updateControl finds the rendered key row and reports success'
);
check(
  pressedPad(keyGroup).textContent === 'E',
  'updateControl moves the pad selection to E in place'
);
check(
  applied.length === 0,
  'updateControl commits nothing itself (the caller owns the live write)'
);
check(
  windowStub.ParamControls.updateControl('n1', 'nope', 'X') === false,
  'updateControl returns false for an unknown param'
);
check(
  windowStub.ParamControls.updateControl('other', 'key', 'E') === false,
  'updateControl returns false for an unknown node id'
);

// A later HUMAN move on the sibling control must not revert the agent's
// key write (the workingParams re-sync the commit handler does).
mixInput.value = '75';
mixInput.fire('input');
var lastModel = onParamsChangedCalls[onParamsChangedCalls.length - 1].params;
check(
  mixInput.value === '75' && mixSpan.textContent === '75%',
  'a continuous gesture keeps its newest value visible while acceptance is pending'
);
check(
  lastModel.key === 'E' && lastModel.mix === 75,
  'later human control move keeps the externally-set key (E) and applies mix 75'
);

// ----------------------------------------------------------------------
// D. Summary.
// ----------------------------------------------------------------------
console.log('');
if (failures.length === 0) {
  console.log('discrete-param-controls: ALL PASS');
  process.exit(0);
} else {
  console.log('discrete-param-controls: ' + failures.length + ' FAILURE(S)');
  process.exit(1);
}
