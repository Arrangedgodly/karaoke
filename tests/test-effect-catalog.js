// EffectCatalog's public registration and discovery contract.
//
// The test loads the production global script in a zero-dependency vm sandbox,
// registers fixture effects through the public seam, and observes behavior only
// through window.EffectCatalog.
//
// Run from a clean clone: node tests/test-effect-catalog.js

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];

function check(condition, label) {
  if (condition) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

function deepEqual(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function captureThrow(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

function errorMatches(fn, pattern) {
  var error = captureThrow(fn);
  return !!error && pattern.test(String(error.message));
}

function loadCatalog() {
  return loadEnvironment(['src/effect-catalog.js']).EffectCatalog;
}

function loadEnvironment(relativePaths) {
  var sandbox = { console: console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  relativePaths.forEach(function (relativePath) {
    loadScript(sandbox, relativePath);
  });
  return sandbox;
}

function loadScript(sandbox, relativePath) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
    sandbox,
    { filename: relativePath }
  );
}

function numericDefinition(label, calls, withDispose) {
  var definition = {
    label: label,
    // wayfinder #46: EffectCatalog now requires plainLabel alongside
    // label; a fixed fixture value keeps every C-series validation test
    // below targeting its OWN broken field, not this one.
    plainLabel: 'Test plain label',
    paramSpec: [
      { id: 'mix', label: 'Mix', min: 0, max: 100, default: 40, step: 1, unit: '%' }
    ],
    experimental: false,
    create: function (audioContext, params) {
      var instance = { kind: label, params: params };
      calls.create.push({ audioContext: audioContext, params: params, instance: instance });
      return instance;
    },
    applyParam: function (instance, paramId, value) {
      calls.apply.push({ instance: instance, paramId: paramId, value: value });
    }
  };
  if (withDispose) {
    definition.dispose = function (instance) {
      calls.dispose.push(instance);
    };
  }
  return definition;
}

function discreteDefinition(calls) {
  return {
    label: 'Mode selector',
    plainLabel: 'Test plain label',
    paramSpec: [
      { id: 'mode', label: 'Mode', values: ['Soft', 'Hard'], default: 'Soft' }
    ],
    experimental: true,
    create: function (audioContext, params) {
      calls.create.push({ audioContext: audioContext, params: params });
      return { mode: params.mode };
    },
    applyParam: function (instance, paramId, value) {
      calls.apply.push({ instance: instance, paramId: paramId, value: value });
    }
  };
}

var calls = { create: [], apply: [], dispose: [] };
var catalog = loadCatalog();

console.log('A. registration and deterministic discovery');

check(!!catalog && typeof catalog.register === 'function', 'A1: window.EffectCatalog exports register()');

var numericInput = numericDefinition('Level', calls, true);
catalog.register('level', numericInput);
catalog.register('mode', discreteDefinition(calls));

check(
  deepEqual(catalog.getAllTypes(), ['level', 'mode']),
  'A2: getAllTypes() preserves registration order'
);
check(
  catalog.getDefinition('level').type === 'level' && catalog.getDefinition('level').label === 'Level',
  'A3: getDefinition() includes the registered identity and label'
);
check(
  catalog.hasType('level') === true && catalog.hasType('missing') === false,
  'A3a: hasType() checks catalog membership without exposing a definition'
);
check(catalog.getLabel('mode') === 'Mode selector', 'A4: getLabel() reads the registered label');
check(catalog.isExperimental('level') === false && catalog.isExperimental('mode') === true,
  'A5: isExperimental() reads the one registered state');
check(
  catalog.getParam('level', 'mix').min === 0 && catalog.getParam('level', 'mix').step === 1,
  'A6: getParam() returns the numeric contract'
);
check(
  deepEqual(catalog.getParam('mode', 'mode').values, ['Soft', 'Hard']),
  'A7: getParam() returns the discrete contract'
);
check(
  deepEqual(catalog.getDefaults('level'), { mix: 40 }) &&
    catalog.getDefault('mode', 'mode') === 'Soft',
  'A8: default discovery works per type and per parameter'
);
check(
  catalog.getLatencySeconds('level') === 0 && catalog.getLatencySeconds('mode') === 0,
  'A9: getLatencySeconds() defaults to 0 for a definition that declares none'
);

var latencyCalls = { create: [], apply: [], dispose: [] };
var latencyCatalog = loadCatalog();
var latencyInput = numericDefinition('Delay-ish', latencyCalls, false);
latencyInput.latencySeconds = 0.02;
latencyCatalog.register('delayish', latencyInput);
check(latencyCatalog.getLatencySeconds('delayish') === 0.02, 'A10: getLatencySeconds() reads a declared value');
check(latencyCatalog.getLatencySeconds('missing') === 0, 'A11: getLatencySeconds() is 0 for an unregistered type');

console.log('B. defensive discovery');

var typesCopy = catalog.getAllTypes();
var definitionCopy = catalog.getDefinition('level');
var specCopy = catalog.getParamSpec('mode');
var paramCopy = catalog.getParam('mode', 'mode');
typesCopy.push('fake');
definitionCopy.label = 'Mutated';
definitionCopy.paramSpec[0].default = 99;
specCopy[0].values.push('Broken');
paramCopy.values[0] = 'Broken';
numericInput.label = 'Changed after registration';
numericInput.paramSpec[0].default = 77;

check(deepEqual(catalog.getAllTypes(), ['level', 'mode']), 'B1: returned type arrays cannot mutate registration order');
check(catalog.getLabel('level') === 'Level', 'B2: input and returned definitions cannot mutate the stored label');
check(catalog.getDefault('level', 'mix') === 40, 'B3: input and returned definitions cannot mutate stored defaults');
check(
  deepEqual(catalog.getParam('mode', 'mode').values, ['Soft', 'Hard']),
  'B4: returned value arrays cannot mutate the stored discrete contract'
);
check(
  catalog.getDefinition('missing') === null && catalog.getLabel('missing') === null &&
    deepEqual(catalog.getParamSpec('missing'), []) && catalog.getParam('missing', 'x') === null &&
    catalog.getDefault('missing', 'x') === undefined && deepEqual(catalog.getDefaults('missing'), {}) &&
    catalog.isExperimental('missing') === false,
  'B5: unknown discovery is explicit and safe to inspect'
);

console.log('C. early validation');

check(errorMatches(function () { catalog.register('level', numericDefinition('Duplicate', calls)); }, /already registered/i),
  'C1: duplicate type ids are rejected instead of replaced');
check(errorMatches(function () { catalog.register('', numericDefinition('Blank', calls)); }, /type.*non-empty string/i),
  'C2: type identity must be a non-empty string');
check(errorMatches(function () {
  var definition = numericDefinition('', calls);
  catalog.register('blank-label', definition);
}, /label.*non-empty string/i), 'C3: label is required');
check(errorMatches(function () {
  var definition = numericDefinition('No params', calls);
  definition.paramSpec = [];
  catalog.register('no-params', definition);
}, /paramSpec.*non-empty array/i), 'C4: paramSpec must be non-empty');
check(errorMatches(function () {
  var definition = numericDefinition('No create', calls);
  definition.create = null;
  catalog.register('no-create', definition);
}, /create.*function/i), 'C5: create behavior is required');
check(errorMatches(function () {
  var definition = numericDefinition('No apply', calls);
  definition.applyParam = null;
  catalog.register('no-apply', definition);
}, /applyParam.*function/i), 'C6: live applyParam behavior is required');
check(errorMatches(function () {
  var definition = numericDefinition('No state', calls);
  delete definition.experimental;
  catalog.register('no-state', definition);
}, /experimental.*boolean/i), 'C7: experimental state is required');
check(errorMatches(function () {
  var definition = numericDefinition('Bad numeric', calls);
  delete definition.paramSpec[0].step;
  catalog.register('bad-numeric', definition);
}, /numeric.*min.*max.*step/i), 'C8: numeric params require a complete range and positive step');
check(errorMatches(function () {
  var definition = discreteDefinition(calls);
  definition.paramSpec[0].default = 'Missing';
  catalog.register('bad-discrete', definition);
}, /default.*values/i), 'C9: discrete defaults must belong to their values');
check(errorMatches(function () {
  var definition = numericDefinition('Duplicate params', calls);
  definition.paramSpec.push({ id: 'mix', label: 'Again', min: 0, max: 1, default: 0, step: 1 });
  catalog.register('duplicate-params', definition);
}, /duplicate param/i), 'C10: duplicate parameter ids are rejected');
check(errorMatches(function () {
  var definition = numericDefinition('Negative latency', calls);
  definition.latencySeconds = -0.001;
  catalog.register('negative-latency', definition);
}, /latencySeconds.*non-negative finite number/i), 'C11: negative latencySeconds is rejected');
check(errorMatches(function () {
  var definition = numericDefinition('NaN latency', calls);
  definition.latencySeconds = NaN;
  catalog.register('nan-latency', definition);
}, /latencySeconds.*non-negative finite number/i), 'C12: non-finite latencySeconds is rejected');

console.log('D. defaults, validation, creation, live writes, and disposal');

check(
  deepEqual(catalog.normalizeParams('level', {}), { mix: 40 }) &&
    deepEqual(catalog.normalizeParams('mode', { mode: 'Hard' }), { mode: 'Hard' }),
  'D1: normalizeParams() fills defaults and preserves legal values'
);
check(errorMatches(function () { catalog.normalizeParams('level', { typo: 1 }); }, /unknown param.*typo/i),
  'D2: unknown params are rejected');
check(errorMatches(function () { catalog.normalizeParams('level', { mix: 101 }); }, /mix.*range/i),
  'D3: out-of-range numeric values are rejected');

var boundaryCalls = { create: [], apply: [], dispose: [] };
var boundaryEnvironment = loadEnvironment([
  'src/effect-catalog.js',
  'src/preset-schema.js'
]);
var boundaryCatalog = boundaryEnvironment.EffectCatalog;
var boundarySchema = boundaryEnvironment.PresetSchema;
boundaryCatalog.register('level', numericDefinition('Boundary level', boundaryCalls, false));

function boundaryPreset(value) {
  return {
    schemaVersion: boundarySchema.CURRENT_VERSION,
    name: 'Boundary fuzz',
    nodes: [{ id: 'level-1', type: 'level', params: { mix: value } }]
  };
}

var minFuzz = -0.5e-9;
var minRestored = boundarySchema.deserialize(boundaryPreset(minFuzz));
check(
  minRestored.nodes[0].params.mix === minFuzz &&
    boundaryCatalog.normalizeParams('level', minRestored.nodes[0].params).mix === 0,
  'D3a: deserialize accepts minimum fuzz and normalizeParams() clamps it to the minimum'
);

var maxFuzz = 100 + 0.5e-9;
var maxRestored = boundarySchema.deserialize(boundaryPreset(maxFuzz));
var boundaryInstance = boundaryCatalog.create(
  'level',
  { marker: 'boundary-context' },
  maxRestored.nodes[0].params
);
check(
  maxRestored.nodes[0].params.mix === maxFuzz &&
    boundaryCalls.create[0].params.mix === 100 && boundaryInstance.params.mix === 100,
  'D3b: deserialize accepts maximum fuzz and create() clamps it to the maximum'
);

check(
  errorMatches(function () { boundarySchema.deserialize(boundaryPreset(-2e-9)); }, /mix.*between/i) &&
    errorMatches(function () { boundaryCatalog.normalizeParams('level', { mix: -2e-9 }); }, /mix.*range/i),
  'D3c: schema and catalog reject minimum fuzz beyond the shared tolerance'
);
check(
  errorMatches(function () { boundarySchema.deserialize(boundaryPreset(100 + 2e-9)); }, /mix.*between/i) &&
    errorMatches(function () { boundaryCatalog.create('level', {}, { mix: 100 + 2e-9 }); }, /mix.*range/i),
  'D3d: schema and catalog reject maximum fuzz beyond the shared tolerance'
);

check(errorMatches(function () { catalog.normalizeParams('mode', { mode: 'Loud' }); }, /mode.*values/i),
  'D4: unknown discrete values are rejected');
check(
  deepEqual(catalog.normalizeParams('mode', { mode: 1 }), { mode: 'Hard' }),
  'D5: legacy numeric aliases for string-valued enums normalize to the catalog value'
);

var audioContext = { marker: 'context' };
var instance = catalog.create('level', audioContext, {});
check(
  calls.create.length === 1 && calls.create[0].audioContext === audioContext &&
    calls.create[0].params.mix === 40 && instance === calls.create[0].instance,
  'D6: create() supplies normalized defaults and returns the implementation instance'
);

catalog.applyParam('level', instance, 'mix', 65);
check(
  calls.apply.length === 1 && calls.apply[0].instance === instance &&
    calls.apply[0].paramId === 'mix' && calls.apply[0].value === 65,
  'D7: applyParam() validates then dispatches a live write'
);
check(errorMatches(function () { catalog.applyParam('level', instance, 'missing', 1); }, /unknown param.*missing/i),
  'D8: applyParam() rejects an unknown parameter before dispatch');
check(calls.apply.length === 1, 'D9: rejected live writes never reach the implementation');

catalog.dispose('level', instance);
check(calls.dispose.length === 1 && calls.dispose[0] === instance,
  'D10: dispose() dispatches optional cleanup behavior');
check(catalog.dispose('mode', { marker: 'no-dispose' }) === undefined,
  'D11: dispose() is a safe no-op when an effect has no cleanup behavior');
check(
  errorMatches(function () { catalog.create('missing', audioContext, {}); }, /unknown effect type.*missing/i) &&
    errorMatches(function () { catalog.applyParam('missing', {}, 'x', 1); }, /unknown effect type.*missing/i) &&
    errorMatches(function () { catalog.dispose('missing', {}); }, /unknown effect type.*missing/i),
  'D12: behavioral calls report unknown effect types instead of substituting one'
);

console.log('E. parameter ids remain data keys');

var protoCalls = { create: [], apply: [], dispose: [] };
var protoDefinition = numericDefinition('Prototype key', protoCalls, false);
protoDefinition.paramSpec[0].id = '__proto__';
catalog.register('prototype-key', protoDefinition);

var protoDefaults = catalog.getDefaults('prototype-key');
var protoNormalized = catalog.normalizeParams('prototype-key', {});
var protoInstance = catalog.create('prototype-key', audioContext, {});
check(
  Object.prototype.hasOwnProperty.call(protoDefaults, '__proto__') &&
    protoDefaults.__proto__ === 40,
  'E1: getDefaults() preserves __proto__ as an own data property'
);
check(
  Object.prototype.hasOwnProperty.call(protoNormalized, '__proto__') &&
    protoNormalized.__proto__ === 40,
  'E2: normalizeParams() preserves __proto__ as an own data property'
);
check(
  Object.prototype.hasOwnProperty.call(protoCalls.create[0].params, '__proto__') &&
    protoCalls.create[0].params.__proto__ === 40 && protoInstance === protoCalls.create[0].instance,
  'E3: create() receives the accepted __proto__ parameter and its default'
);

console.log('F. production registry convergence');

var production = {
  console: console,
  fetch: function () {
    return Promise.resolve({
      arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(0)); }
    });
  }
};
production.window = production;
vm.createContext(production);
loadScript(production, 'src/effect-catalog.js');
loadScript(production, 'src/tone-adapter.js');
[
  'gain',
  'compressor',
  'eq',
  'delay',
  'reverb',
  'limiter',
  'distortion',
  'chorus',
  'gate',
  'autotune',
  'pitchshift',
  'tremolo',
  'bitcrusher',
  'phaser'
].forEach(function (type) {
  loadScript(production, 'src/node-' + type + '.js');
});

var expectedProductionTypes = [
  'gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter',
  'distortion', 'chorus', 'gate', 'autotune',
  'pitchshift', 'tremolo', 'bitcrusher', 'phaser'
];
check(
  deepEqual(production.EffectCatalog.getAllTypes(), expectedProductionTypes),
  'F1: every production effect registers once through EffectCatalog in script order'
);
check(
  production.NodeTypes === undefined && production.AudioGraph === undefined,
  'F2: effect registration needs no legacy registry global'
);

var expectedLatencySeconds = {
  gain: 0, compressor: 0.006, eq: 0, delay: 0, reverb: 0, limiter: 0.006,
  distortion: 0, chorus: 0, gate: 0.005, autotune: 0.020,
  pitchshift: 0.1, tremolo: 0, bitcrusher: 0, phaser: 0
};
check(
  expectedProductionTypes.every(function (type) {
    return production.EffectCatalog.getLatencySeconds(type) === expectedLatencySeconds[type];
  }),
  'F2a: every production effect declares its disclosed added latency (gate 5ms, autotune 20ms, ' +
    'compressor/limiter 6ms, pitchshift 100ms; everything else 0)'
);

var productionSources = [
  'index.html',
  'src/audio-graph.js',
  'src/canvas.js',
  'src/chain-editing.js',
  'src/mcp-tools.js',
  'src/param-controls.js',
  'src/persistence.js',
  'src/preset-schema.js',
  'src/preset-store.js',
  'src/tone-adapter.js'
].map(function (relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}).join('\n');
check(
  !fs.existsSync(path.join(ROOT, 'src/node-types.js')) &&
    productionSources.indexOf('NodeTypes') === -1 &&
    productionSources.indexOf('AudioGraph.registerNodeType') === -1,
  'F3: production carries no legacy registry module or compatibility references'
);
check(
  productionSources.indexOf('NODE_REGISTRY_SNAPSHOT') === -1 &&
    productionSources.indexOf('TYPE_PARAM_CONTRACTS') === -1,
  'F4: MCP and preset validation carry no effect metadata mirrors'
);

if (failures.length > 0) {
  console.error('\nEffectCatalog contract: ' + failures.length + ' failure(s)');
  failures.forEach(function (failure) {
    console.error('  - ' + failure);
  });
  process.exit(1);
}

console.log('\nEffectCatalog contract: all checks passed');
