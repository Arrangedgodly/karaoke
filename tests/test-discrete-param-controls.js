// Test for cycle-3 UI-1 — discrete (enumerated) param controls: Key/Scale.
//
// UI-1 adds a second param-control shape to src/param-controls.js: a spec
// entry carrying `values: [...]` renders a native <select> (one <option>
// per value) instead of a range slider, and commits its STRING value
// through the exact same pipeline a slider move uses —
// AudioGraph.updateNodeParams (model bookkeeping) + NodeTypes.applyParam
// (live write). No autotune node exists yet, so this validates against a
// throwaway `test-keys` type registered only inside this script (same
// precedent as UI-4's throwaway `test-gain`).
//
// Checked here, on the REAL src/param-controls.js + src/node-types.js
// loaded into a vm sandbox with a minimal fake DOM:
//   A. RENDER: a `values` spec renders a <select> with one <option> per
//      value, a label[for] bound to its id (SR name), and NO unit
//      formatting on the value display; a sibling numeric spec still
//      renders a range slider (no regression).
//   B. COMMIT: firing the select's `input` handler after a keyboard-style
//      value change reaches NodeTypes.applyParam with the STRING value
//      ('A'), updates the model via AudioGraph.updateNodeParams, and
//      reports through onParamsChanged with the full params object.
//   C. EXTERNAL WRITE: ParamControls.updateControl (the agent set_param
//      fast path's bridge) moves the select and its working copy in place
//      — a later human change on the sibling slider does not revert it.
//   D. A11y shape (structural, per the committed-test convention):
//      element is a native <select> (keyboard arrows + SR value
//      announcement are native semantics, not custom ARIA) and each
//      option's text is the announced value verbatim.
//
// Browser-use inspection was not available in this worker (same as
// TEST-1's precedent); the DOM-structure + pipeline checks below are the
// committed evidence.
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
    tagName: String(tagName).toUpperCase(),
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
  el.fire = function (evt) {
    (el.listeners[evt] || []).forEach(function (fn) {
      fn();
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

loadSrc('node-types.js');
loadSrc('param-controls.js');

// ----------------------------------------------------------------------
// Throwaway discrete-capable type (UI-4's throwaway-type precedent).
// The key/scale param SHAPE AT-1's autotune node will register: two flat
// string params, exactly like every other type's flat numeric params.
// ----------------------------------------------------------------------
var KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var SCALES = ['Chromatic', 'Major', 'Minor'];

var applied = [];
windowStub.NodeTypes.register('test-keys', {
  label: 'Test Keys',
  paramSpec: [
    { id: 'key', label: 'Key', values: KEYS, default: 'C' },
    { id: 'scale', label: 'Scale', values: SCALES, default: 'Chromatic' },
    { id: 'mix', label: 'Mix', min: 0, max: 100, default: 50, step: 1, unit: '%' }
  ],
  applyParam: function (node, paramId, value) {
    applied.push({ node: node, paramId: paramId, value: value });
  }
});

// ----------------------------------------------------------------------
// A. Render.
// ----------------------------------------------------------------------
console.log('A. render');

var container = makeElement('div');
var modelEntry = { id: 'n1', type: 'test-keys', params: {} };
var onParamsChangedCalls = [];
windowStub.ParamControls.render(container, modelEntry, function (p) {
  onParamsChangedCalls.push(p);
});

var rows = container.children;
check(rows.length === 3, 'one row per paramSpec entry (3)');
check(container.innerHTML === '', 'container cleared before render');

var keyRow = rows[0];
var keySelect = keyRow.children[1];
var keyLabel = keyRow.children[0];
check(
  keySelect.tagName === 'SELECT',
  'values spec renders a native <select>, not a range input'
);
check(keySelect.className === 'param-select', 'select carries the .param-select class');
check(keySelect.children.length === 12, 'key select has all 12 options (C..B)');
check(
  keySelect.children.every(function (o, i) {
    return o.value === KEYS[i] && o.textContent === KEYS[i];
  }),
  'each option value+text is the announced value verbatim (C, C#, ... B)'
);
check(keySelect.value === 'C', 'select initial value is the spec default (C)');
check(
  keyLabel.tagName === 'LABEL' && keyLabel['attr_for'] === keySelect.id,
  'label[for] binds to the select id (SR accessible name)'
);

var scaleSelect = rows[1].children[1];
check(scaleSelect.children.length === 3, 'scale select has 3 options (Chromatic/Major/Minor)');
check(scaleSelect.value === 'Chromatic', 'scale default is Chromatic');

var mixInput = rows[2].children[1];
check(
  mixInput.tagName === 'INPUT' && mixInput.type === 'range',
  'sibling numeric spec still renders a range slider (no regression)'
);
check(
  rows[2].children[2].textContent === '50%',
  'numeric value display still unit-formatted (50%)'
);

// ----------------------------------------------------------------------
// B. Commit — keyboard-style select change reaches applyParam as a string.
// ----------------------------------------------------------------------
console.log('B. commit');

// A keyboard user changes Key C -> A: the select's value moves, then the
// browser fires `input` (and `change`). param-controls listens on the
// same `input` event the slider path uses.
keySelect.value = 'A';
keySelect.fire('input');

check(applied.length === 1, 'one applyParam call for the change');
check(
  applied[0] &&
    applied[0].paramId === 'key' &&
    applied[0].value === 'A' &&
    typeof applied[0].value === 'string',
  'applyParam received paramId "key" with STRING value "A"'
);
check(
  applied[0] && applied[0].node === calls.nodeInstance,
  'applyParam received the live node instance from AudioGraph.getNodeInstance'
);
check(
  calls.updateNodeParams.length === 1 &&
    calls.updateNodeParams[0].id === 'n1' &&
    calls.updateNodeParams[0].params.key === 'A' &&
    calls.updateNodeParams[0].params.scale === 'Chromatic' &&
    calls.updateNodeParams[0].params.mix === 50,
  'model updated via AudioGraph.updateNodeParams with full params (key A, scale Chromatic, mix 50)'
);
check(
  onParamsChangedCalls.length === 1 && onParamsChangedCalls[0].key === 'A',
  'onParamsChanged fired with the updated params object'
);

scaleSelect.value = 'Major';
scaleSelect.fire('input');
check(
  applied.length === 2 && applied[1].paramId === 'scale' && applied[1].value === 'Major',
  'scale change reaches applyParam with STRING value "Major"'
);

// ----------------------------------------------------------------------
// C. External write via updateControl + no-revert on later human change.
// ----------------------------------------------------------------------
console.log('C. external write');

check(
  windowStub.ParamControls.updateControl('n1', 'key', 'E') === true,
  'updateControl finds the rendered key row and reports success'
);
check(keySelect.value === 'E', 'updateControl moves the select to E in place');
check(
  windowStub.ParamControls.updateControl('n1', 'nope', 'X') === false,
  'updateControl returns false for an unknown param'
);
check(
  windowStub.ParamControls.updateControl('other', 'key', 'E') === false,
  'updateControl returns false for an unknown node id'
);

// A later HUMAN move on the sibling slider must not revert the agent's
// key write (the workingParams re-sync the slider handler does).
mixInput.value = '75';
mixInput.fire('input');
var lastModel = calls.updateNodeParams[calls.updateNodeParams.length - 1];
check(
  lastModel.params.key === 'E' && lastModel.params.mix === 75,
  'later human slider move keeps the externally-set key (E) and applies mix 75'
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
