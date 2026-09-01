// PRE-1 (cycle 3) — preset schema + round-trip for all four cycle-3
// effects (Noise Gate, Distortion, Chorus, Autotune).
//
// The individual node suites (test-distortion-node.js, test-chorus-node.js,
// test-gate-node.js, test-autotune-node.js) each already round-trip ONE
// new-type entry through PresetSchema; this is the formal CHAIN-level pass
// the plan's acceptance names:
//
//   A. catalog-backed validation — PresetSchema reads the LIVE
//      EffectCatalog param specs with no exported metadata mirror.
//   B. save -> reload -> EXACT compare for one chain containing ALL FOUR
//      new effects together with existing ones (every new-type param at a
//      non-default value: key/scale, retune, mix, threshold/attack/release/
//      floor, drive/tone/output, depth/rate/mix) — through three real
//      layers: bare PresetSchema, the PresetStore named-preset store, and
//      the Persistence autosave slot. Plus the numeric-enum autotune
//      variant and the wire-format shape (collapsed-card state is
//      session-only by design — src/canvas.js VIS-7 — so the wire carries
//      exactly {id, type, params} per node).
//   C. boundary acceptance — every contract param at its min and max (and
//      params:{} entirely absent) deserializes clean.
//   D. legacy — valid presets saved before cycle 3 (six legacy types, no
//      new-type entries) load byte-unchanged, while corrupted values on a
//      registered legacy effect use the same live catalog validation.
//   E. hostile entries hit the EXISTING error-recovery paths — never a
//      crash, never a silent substitution: unknown node type, bad key
//      ('H'), bad scale ('Dorian'), out-of-enum/non-integer key numbers,
//      out-of-range drive/retune/rate/attack, wrong-typed params (string
//      number, null), typo'd param name. Autosave => Persistence falls
//      back to the default chain; named preset => PresetStore.load()
//      returns null; both log via console.error and never throw.
//   F. the live-catalog guard degrades to lenient when the catalog is
//      absent/empty/broken (bare-harness behavior unchanged).
//   G. factory library + default chain unchanged by this task (the PRE-1
//      decisions: no cycle-3 content in either, notes in both files).
//
// Same committed-test convention as every other suite: zero dependencies,
// plain `node`, browser globals stubbed, the REAL src files loaded into a
// vm sandbox (window === global), per-check "  ok - " prints, exit 0/1.
//
// Run from a clean clone:  node tests/test-preset-cycle3.js
// (or via the runner:      node tests/run.js preset-cycle3)

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var AUTOSAVE_KEY = 'karaoke-autosave-v1';
var PRESETS_KEY = 'karaoke-presets-v1';

var failures = [];

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

// Order-insensitive structural equality for the plain-JSON shapes the
// preset/model layer uses (same helper as tests/test-factory-presets-
// policy.js).
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  var ka = Object.keys(a);
  var kb = Object.keys(b);
  if (ka.length !== kb.length) {
    return false;
  }
  for (var i = 0; i < ka.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !deepEqual(a[ka[i]], b[ka[i]])) {
      return false;
    }
  }
  return true;
}

function copyNodes(nodes) {
  return nodes.map(function (entry) {
    return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
  });
}

// ----------------------------------------------------------------------
// The sandbox: a vm context whose global IS `window` (host timers, a quiet
// console that RECORDS console.error, a plain localStorage box, the
// never-settling fetch src/node-reverb.js tolerates, no DOM — none of the
// files under test needs one at load time). The full ten-module effect
// catalog is loaded exactly as index.html orders it, so validation reads
// the same live paramSpecs as every other production consumer.
// ----------------------------------------------------------------------
function createEnv() {
  var storageBox = {};
  var env = { consoleErrors: [] };
  var sandbox = {
    console: {
      log: function () {},
      warn: function () {},
      error: function () {
        env.consoleErrors.push(Array.prototype.slice.call(arguments).map(String).join(' '));
      }
    },
    setTimeout: function (fn, ms) {
      return setTimeout(fn, ms);
    },
    clearTimeout: function (id) {
      return clearTimeout(id);
    },
    setInterval: function (fn, ms) {
      return setInterval(fn, ms);
    },
    clearInterval: function (id) {
      return clearInterval(id);
    },
    fetch: function () {
      return new Promise(function () {});
    },
    localStorage: {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(storageBox, key) ? storageBox[key] : null;
      },
      setItem: function (key, value) {
        storageBox[key] = String(value);
      },
      removeItem: function (key) {
        delete storageBox[key];
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.AudioEngine = { isStarted: false };
  vm.createContext(sandbox);
  env.sandbox = sandbox;
  env.storageBox = storageBox;

  [
    'src/effect-catalog.js',
    'src/audio-graph.js',
    'src/audio-param-ramp.js',
    'src/node-gain.js',
    'src/node-compressor.js',
    'src/node-eq.js',
    'src/node-delay.js',
    'src/node-reverb.js',
    'src/node-limiter.js',
    'src/node-distortion.js',
    'src/node-chorus.js',
    'src/node-gate.js',
    'src/node-autotune.js',
    'src/preset-schema.js',
    'src/default-preset.js',
    'src/factory-library-data.js',
    'src/factory-presets.js',
    'src/preset-store.js',
    'src/persistence.js'
  ].forEach(function (relPath) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
      filename: relPath
    });
  });
  return env;
}

// Seed the autosave slot the way a hand-edit would: a raw JSON string under
// the storage key, never routed through serialize().
function seedAutosaveRaw(env, presetObject) {
  env.storageBox[AUTOSAVE_KEY] = JSON.stringify(presetObject);
}

function wirePreset(name, nodes) {
  return { schemaVersion: 1, name: name, nodes: nodes };
}

// One hostile autosave case: deserialize/store-layer recovers to the
// DEFAULT chain, never throws, logs one console.error.
function assertAutosaveRecovery(env, caseLabel, nodes) {
  seedAutosaveRaw(env, wirePreset('__autosave__', nodes));
  var errorsBefore = env.consoleErrors.length;
  var result = null;
  var threw = null;
  try {
    result = env.sandbox.Persistence.loadInitialModel();
  } catch (err) {
    threw = err;
  }
  check(!threw, caseLabel + ': loadInitialModel NEVER throws (recovery, not crash)');
  check(
    !!result && deepEqual(result, env.sandbox.DEFAULT_PRESET.nodes),
    caseLabel + ': autosave falls back to the DEFAULT chain exactly'
  );
  check(
    env.consoleErrors.length === errorsBefore + 1,
    caseLabel + ': the fallback was LOGGED via console.error'
  );
}

// One hostile named-preset case: save() still succeeds (serialize() is
// permissive), load() recovers to null, never throws, logs.
function assertNamedRecovery(env, caseLabel, name, nodes) {
  var sandbox = env.sandbox;
  var saved = sandbox.PresetStore.save(name, nodes);
  check(!!saved && saved.ok === true, caseLabel + ': save() of the hostile model still persists (serialize stays permissive)');
  var errorsBefore = env.consoleErrors.length;
  var loaded = null;
  var threw = null;
  try {
    loaded = sandbox.PresetStore.load(name);
  } catch (err) {
    threw = err;
  }
  check(!threw, caseLabel + ': load() NEVER throws (recovery, not crash)');
  check(loaded === null, caseLabel + ': load() returns null (the "could not load" recovery path)');
  check(
    env.consoleErrors.length === errorsBefore + 1,
    caseLabel + ': the rejection was LOGGED via console.error'
  );
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var env = createEnv();
  var sandbox = env.sandbox;
  var PresetSchema = sandbox.PresetSchema;
  var KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var SCALE_NAMES = ['Chromatic', 'Major', 'Minor'];

  // ------------------------------------------------------------------
  console.log('A. preset validation reads the live EffectCatalog without a metadata mirror');
  // ------------------------------------------------------------------
  {
    check(
      deepEqual(Object.keys(PresetSchema).sort(), ['CURRENT_VERSION', 'deserialize', 'serialize']),
      'A: PresetSchema exports behavior only, with no metadata mirror'
    );

    ['distortion', 'chorus', 'gate', 'autotune'].forEach(function (type) {
      var spec = sandbox.EffectCatalog.getParamSpec(type);
      check(
        spec.length > 0,
        'A: ' + type + ' exposes its validation contract through the live catalog'
      );
    });

    // The two vocabularies the scope fixed: 12 keys x 3 scales.
    var autotuneSpec = sandbox.EffectCatalog.getParamSpec('autotune');
    var keySpec = autotuneSpec.filter(function (entry) { return entry.id === 'key'; })[0];
    var scaleSpec = autotuneSpec.filter(function (entry) { return entry.id === 'scale'; })[0];
    check(
      !!keySpec && deepEqual(keySpec.values, KEY_NAMES) && keySpec.values.length === 12,
      'A: the live autotune key vocabulary is the 12 musical keys C..B'
    );
    check(
      !!scaleSpec && deepEqual(scaleSpec.values, SCALE_NAMES),
      'A: the live autotune scale vocabulary is Chromatic/Major/Minor'
    );

    sandbox.EffectCatalog.register('schema-live-probe', {
      label: 'Schema live probe',
      paramSpec: [{ id: 'amount', label: 'Amount', min: 0, max: 1, step: 0.1, default: 0.5 }],
      experimental: false,
      create: function () { return {}; },
      applyParam: function () {}
    });
    check(
      PresetSchema.deserialize(wirePreset('probe', [
        { id: 'probe-1', type: 'schema-live-probe', params: { amount: 0.7 } }
      ])).nodes[0].params.amount === 0.7,
      'A: a type registered after PresetSchema loads validates through the live catalog'
    );
    var liveRangeError = null;
    try {
      PresetSchema.deserialize(wirePreset('probe', [
        { id: 'probe-2', type: 'schema-live-probe', params: { amount: 2 } }
      ]));
    } catch (err) {
      liveRangeError = err;
    }
    check(!!liveRangeError, 'A: the live catalog range rejects an out-of-range probe value');

    sandbox.EffectCatalog.register('schema-reserved-key-probe', {
      label: 'Schema reserved-key probe',
      paramSpec: [{ id: '__proto__', label: 'Reserved key', min: 0, max: 1, step: 0.1, default: 0.4 }],
      experimental: false,
      create: function () { return {}; },
      applyParam: function () {}
    });
    var reservedInput = JSON.parse(
      '{"schemaVersion":1,"name":"reserved key","nodes":[' +
        '{"id":"reserved-1","type":"schema-reserved-key-probe","params":{"__proto__":0.8}}]}'
    );
    var reservedRestored = PresetSchema.deserialize(reservedInput);
    var reservedSerialized = PresetSchema.serialize(
      reservedRestored.name,
      reservedRestored.nodes
    );
    var reservedWire = JSON.parse(JSON.stringify(reservedSerialized));
    var reservedNormalized = sandbox.EffectCatalog.normalizeParams(
      'schema-reserved-key-probe',
      reservedWire.nodes[0].params
    );
    check(
      [
        reservedInput.nodes[0].params,
        reservedRestored.nodes[0].params,
        reservedSerialized.nodes[0].params,
        reservedWire.nodes[0].params,
        reservedNormalized
      ].every(function (params) {
        return Object.prototype.hasOwnProperty.call(params, '__proto__') &&
          params.__proto__ === 0.8;
      }),
      'A: a non-default __proto__ param survives JSON input, schema reload/save, and catalog normalization'
    );
  }

  // ------------------------------------------------------------------
  console.log('B. full-chain round-trip: all four new effects + existing ones');
  // ------------------------------------------------------------------
  var ALL_TEN_MODEL = [
    { id: 'n1', type: 'gain',       params: { gainDb: -2 } },
    { id: 'n2', type: 'gate',       params: { threshold: -52, attack: 0.01, release: 0.3, floor: -30 } },
    { id: 'n3', type: 'autotune',   params: { key: 'A', scale: 'Minor', retune: 120, mix: 45 } },
    { id: 'n4', type: 'compressor', params: { threshold: -16, ratio: 4, attack: 0.01, release: 0.25 } },
    { id: 'n5', type: 'eq',         params: { lowGain: 0, midGain: 1, highGain: -1 } },
    { id: 'n6', type: 'distortion', params: { drive: 0.8, tone: 0.4, output: -6 } },
    { id: 'n7', type: 'chorus',     params: { depthMs: 6, rateHz: 2.5, mix: 55 } },
    { id: 'n8', type: 'delay',      params: { timeMs: 260, feedback: 20, mix: 18 } },
    { id: 'n9', type: 'reverb',     params: { mix: 24 } },
    { id: 'n10', type: 'limiter',   params: { ceiling: -3, release: 60 } }
  ];
  {
    // (1) Bare schema layer, through the JSON wire.
    var serialized = PresetSchema.serialize('cycle 3 all four', ALL_TEN_MODEL);
    var wire = JSON.parse(JSON.stringify(serialized));
    var restored = PresetSchema.deserialize(wire);
    check(restored.name === 'cycle 3 all four', 'B1: name survives the wire');
    check(
      restored.nodes.length === 10 && deepEqual(restored.nodes, ALL_TEN_MODEL),
      'B1: schema serialize->JSON->deserialize round-trips the 10-node chain EXACTLY'
    );
    var at = restored.nodes[2];
    check(
      at.type === 'autotune' && at.params.key === 'A' && at.params.scale === 'Minor' &&
        at.params.retune === 120 && at.params.mix === 45,
      'B1: autotune key/scale STRINGS + retune + mix survive exactly'
    );
    check(
      deepEqual(restored.nodes[1].params, { threshold: -52, attack: 0.01, release: 0.3, floor: -30 }) &&
        deepEqual(restored.nodes[5].params, { drive: 0.8, tone: 0.4, output: -6 }) &&
        deepEqual(restored.nodes[6].params, { depthMs: 6, rateHz: 2.5, mix: 55 }),
      'B1: gate/distortion/chorus params survive exactly'
    );

    // Wire shape: exactly {id, type, params} per node — collapsed-card state
    // is session-only by design (src/canvas.js VIS-7: "never persisted"), so
    // there is no collapse field to round-trip.
    var shapeOk = wire.nodes.every(function (entry) {
      return deepEqual(Object.keys(entry).sort(), ['id', 'params', 'type']);
    });
    check(shapeOk, 'B1: wire nodes carry exactly {id, type, params} (collapse state is session-only, not serialized)');

    // Deep-copy discipline still holds with contracts in place.
    restored.nodes[2].params.key = 'corrupted';
    check(wire.nodes[2].params.key === 'A', 'B1: deserialize deep-copies (no aliasing into stored preset)');

    // (2) Named-preset store: real save() -> load() through localStorage.
    var storeSaved = sandbox.PresetStore.save('All Four', ALL_TEN_MODEL);
    check(!!storeSaved && storeSaved.ok === true, 'B2: PresetStore.save accepts the all-four chain');
    var storeLoaded = sandbox.PresetStore.load('All Four');
    check(
      !!storeLoaded && storeLoaded.name === 'All Four' &&
        deepEqual(storeLoaded.nodes, ALL_TEN_MODEL),
      'B2: PresetStore save->localStorage->load round-trips EXACTLY'
    );

    // (3) Autosave slot: real saveCurrentChain() -> loadInitialModel().
    sandbox.Persistence.saveCurrentChain(copyNodes(ALL_TEN_MODEL));
    var initial = sandbox.Persistence.loadInitialModel();
    check(
      !!initial && deepEqual(initial, ALL_TEN_MODEL),
      'B3: Persistence saveCurrentChain->loadInitialModel round-trips EXACTLY'
    );

    // (4) The numeric-enum autotune form (a hand-edited preset or agent raw
    // enum write — src/node-autotune.js documents both as legitimate) is
    // equally legal and survives VERBATIM (no string coercion).
    var enumModel = [
      { id: 'x1', type: 'autotune', params: { key: 9, scale: 1, retune: 250, mix: 100 } },
      { id: 'x2', type: 'limiter', params: { ceiling: -6, release: 120 } }
    ];
    var enumRestored = PresetSchema.deserialize(
      JSON.parse(JSON.stringify(PresetSchema.serialize('enum form', enumModel)))
    );
    check(
      enumRestored.nodes[0].params.key === 9 && enumRestored.nodes[0].params.scale === 1,
      'B4: numeric-enum key/scale (9 / 1) accepted and preserved verbatim'
    );
  }

  // ------------------------------------------------------------------
  console.log('C. boundary acceptance: every contract param at min and max');
  // ------------------------------------------------------------------
  {
    var bounds = {
      distortion: { drive: [0, 1], tone: [0, 1], output: [-24, 0] },
      chorus: { depthMs: [0, 10], rateHz: [0.1, 8], mix: [0, 100] },
      gate: { threshold: [-80, 0], attack: [0.001, 0.5], release: [0.01, 2], floor: [-60, 0] },
      autotune: { retune: [0, 500], mix: [0, 100] }
    };
    Object.keys(bounds).forEach(function (type) {
      var params = {};
      Object.keys(bounds[type]).forEach(function (paramId) {
        params[paramId] = bounds[type][paramId][0]; // all mins at once
      });
      var atMin = PresetSchema.deserialize(
        wirePreset('bounds min', [{ id: 'b1', type: type, params: params }])
      );
      check(!!atMin, 'C: ' + type + ' at ALL param MINIMUMS deserializes clean');
      Object.keys(bounds[type]).forEach(function (paramId) {
        params[paramId] = bounds[type][paramId][1]; // now all maxs
      });
      var atMax = PresetSchema.deserialize(
        wirePreset('bounds max', [{ id: 'b1', type: type, params: params }])
      );
      check(!!atMax, 'C: ' + type + ' at ALL param MAXIMUMS deserializes clean');
    });
    // Both string-vocabulary extremes plus every scale, and params absent.
    KEY_NAMES.forEach(function (key) {
      var r = PresetSchema.deserialize(
        wirePreset('keys', [{ id: 'k1', type: 'autotune', params: { key: key, scale: 'Major' } }])
      );
      check(!!r, 'C: autotune key "' + key + '" is legal');
    });
    SCALE_NAMES.forEach(function (scale) {
      var r = PresetSchema.deserialize(
        wirePreset('scales', [{ id: 's1', type: 'autotune', params: { key: 'C', scale: scale } }])
      );
      check(!!r, 'C: autotune scale "' + scale + '" is legal');
    });
    var emptyParams = PresetSchema.deserialize(
      wirePreset('empty', [
        { id: 'e1', type: 'distortion', params: {} },
        { id: 'e2', type: 'autotune' }
      ])
    );
    check(
      emptyParams.nodes.length === 2 && deepEqual(emptyParams.nodes[0].params, {}) &&
        deepEqual(emptyParams.nodes[1].params, {}),
      'C: params:{} and params ABSENT both stay legal (defaults apply at build time)'
    );
  }

  // ------------------------------------------------------------------
  console.log('D. legacy: pre-cycle-3 presets load byte-unchanged');
  // ------------------------------------------------------------------
  var LEGACY_MODEL = copyNodes(sandbox.DEFAULT_PRESET.nodes);
  {
    var legacyWire = JSON.parse(JSON.stringify(PresetSchema.serialize('legacy', LEGACY_MODEL)));
    var legacyBack = PresetSchema.deserialize(legacyWire);
    check(
      deepEqual(legacyBack.nodes, sandbox.DEFAULT_PRESET.nodes),
      'D1: the pre-cycle-3 default-chain preset deserializes byte-unchanged'
    );

    sandbox.Persistence.saveCurrentChain(copyNodes(LEGACY_MODEL));
    var legacyInitial = sandbox.Persistence.loadInitialModel();
    check(
      deepEqual(legacyInitial, LEGACY_MODEL),
      'D2: a legacy autosave loads through Persistence UNCHANGED (no default fallback)'
    );

    sandbox.PresetStore.save('Legacy Six', copyNodes(LEGACY_MODEL));
    var legacyLoaded = sandbox.PresetStore.load('Legacy Six');
    check(
      !!legacyLoaded && deepEqual(legacyLoaded.nodes, LEGACY_MODEL),
      'D3: a legacy named preset loads through PresetStore UNCHANGED'
    );

    // Every registered type now shares the catalog-backed validation path.
    // Valid legacy presets still round-trip unchanged, while corrupted
    // hand-edited values are rejected consistently with newer effects.
    var outOfRangeLegacyError = null;
    try {
      PresetSchema.deserialize(
        wirePreset('legacy hostile', [{ id: 'h1', type: 'gain', params: { gainDb: 999 } }])
      );
    } catch (err) {
      outOfRangeLegacyError = err;
    }
    check(
      !!outOfRangeLegacyError,
      'D4: a corrupted legacy-type value is rejected by the same live catalog contract'
    );
  }

  // ------------------------------------------------------------------
  console.log('E. hostile entries hit the existing error-recovery paths');
  // ------------------------------------------------------------------
  {
    // (1) Unknown node type: deserialize stays structural (by documented
    // design — the check belongs to the catalog), and the STORE layers'
    // live-catalog guard routes it to recovery.
    var unknownTypeNodes = [
      { id: 'u1', type: 'gain', params: { gainDb: 0 } },
      { id: 'u2', type: 'fluxcapacitor', params: { joules: 1.21 } },
      { id: 'u3', type: 'limiter', params: { ceiling: -6, release: 120 } }
    ];
    var unknownDeser = null;
    try {
      unknownDeser = PresetSchema.deserialize(wirePreset('unknown', unknownTypeNodes));
    } catch (err) {
      unknownDeser = err;
    }
    check(
      !!unknownDeser && Array.isArray(unknownDeser.nodes) && unknownDeser.nodes.length === 3,
      'E1: deserialize itself stays structural about unknown types (no throw — registry knowledge stays out)'
    );
    assertAutosaveRecovery(env, 'E1 unknown type', unknownTypeNodes);
    assertNamedRecovery(env, 'E1 unknown type', 'Hostile Unknown', unknownTypeNodes);

    // (2) Bad key/scale STRINGS — the case that motivated the contracts.
    var badKeyNodes = [{ id: 'b1', type: 'autotune', params: { key: 'H', scale: 'Minor', retune: 0, mix: 100 } }];
    var badKeyErr = null;
    try {
      PresetSchema.deserialize(wirePreset('bad key', badKeyNodes));
    } catch (err) {
      badKeyErr = err;
    }
    check(!!badKeyErr, 'E2: autotune key "H" is REJECTED by deserialize');
    check(
      !!badKeyErr && badKeyErr.message.indexOf('nodes[0].params.key') !== -1 &&
        badKeyErr.message.indexOf('"H"') !== -1,
      'E2: the rejection names the node, param, and offending value'
    );
    assertAutosaveRecovery(env, 'E2 bad key', badKeyNodes);
    assertNamedRecovery(env, 'E2 bad key', 'Hostile Key', badKeyNodes);

    var badScaleNodes = [{ id: 'b1', type: 'autotune', params: { key: 'C', scale: 'Dorian', retune: 0, mix: 100 } }];
    var badScaleErr = null;
    try {
      PresetSchema.deserialize(wirePreset('bad scale', badScaleNodes));
    } catch (err) {
      badScaleErr = err;
    }
    check(
      !!badScaleErr && badScaleErr.message.indexOf('scale') !== -1,
      'E2: autotune scale "Dorian" is REJECTED, naming the param'
    );
    assertAutosaveRecovery(env, 'E2 bad scale', badScaleNodes);
    assertNamedRecovery(env, 'E2 bad scale', 'Hostile Scale', badScaleNodes);

    // (3) Bad numeric-enum forms: out of range, negative, non-integer.
    [
      { label: 'key 12 (past B)', params: { key: 12, scale: 'Chromatic', retune: 0, mix: 100 } },
      { label: 'key -1', params: { key: -1, scale: 'Chromatic', retune: 0, mix: 100 } },
      { label: 'key 1.5 (non-integer)', params: { key: 1.5, scale: 'Chromatic', retune: 0, mix: 100 } },
      { label: 'scale 3', params: { key: 'C', scale: 3, retune: 0, mix: 100 } }
    ].forEach(function (hostile) {
      var nodes = [{ id: 'b1', type: 'autotune', params: hostile.params }];
      var err = null;
      try {
        PresetSchema.deserialize(wirePreset('bad enum', nodes));
      } catch (e) {
        err = e;
      }
      check(!!err, 'E3: autotune ' + hostile.label + ' is REJECTED by deserialize');
      assertAutosaveRecovery(env, 'E3 ' + hostile.label, nodes);
    });

    // (4) Out-of-range and wrong-typed numeric params on the new types.
    [
      { label: 'drive 5 (over max 1)', nodes: [{ id: 'd1', type: 'distortion', params: { drive: 5, tone: 0.7, output: -3 } }] },
      { label: 'drive -0.5 (under min 0)', nodes: [{ id: 'd1', type: 'distortion', params: { drive: -0.5, tone: 0.7, output: -3 } }] },
      { label: 'output +3 (over max 0 dB)', nodes: [{ id: 'd1', type: 'distortion', params: { drive: 0.5, tone: 0.7, output: 3 } }] },
      { label: 'retune 900 (over max 500)', nodes: [{ id: 'a1', type: 'autotune', params: { key: 'C', scale: 'Chromatic', retune: 900, mix: 100 } }] },
      { label: 'rateHz 0 (under min 0.1)', nodes: [{ id: 'c1', type: 'chorus', params: { depthMs: 3, rateHz: 0, mix: 30 } }] },
      { label: 'gate attack 0.0005 (under min 0.001)', nodes: [{ id: 'g1', type: 'gate', params: { threshold: -50, attack: 0.0005, release: 0.15, floor: -40 } }] },
      { label: 'chorus mix 101', nodes: [{ id: 'c1', type: 'chorus', params: { depthMs: 3, rateHz: 1.5, mix: 101 } }] },
      { label: 'gate floor -70 (under min -60)', nodes: [{ id: 'g1', type: 'gate', params: { threshold: -50, attack: 0.005, release: 0.15, floor: -70 } }] },
      { label: "drive '0.5' (string, not number)", nodes: [{ id: 'd1', type: 'distortion', params: { drive: '0.5', tone: 0.7, output: -3 } }] },
      { label: 'key null', nodes: [{ id: 'a1', type: 'autotune', params: { key: null, scale: 'Chromatic', retune: 0, mix: 100 } }] },
      { label: 'retune null (JSON NaN round-trip)', nodes: [{ id: 'a1', type: 'autotune', params: { key: 'C', scale: 'Chromatic', retune: null, mix: 100 } }] },
      { label: "typo'd param name 'drivee'", nodes: [{ id: 'd1', type: 'distortion', params: { drivee: 0.5, tone: 0.7, output: -3 } }] },
      { label: "gate param 'sustain' (not a gate param)", nodes: [{ id: 'g1', type: 'gate', params: { threshold: -50, sustain: 2 } }] },
      { label: 'autotune param "detune" (not an autotune param)', nodes: [{ id: 'a1', type: 'autotune', params: { detune: 30 } }] }
    ].forEach(function (hostile) {
      var err = null;
      try {
        PresetSchema.deserialize(wirePreset('hostile', hostile.nodes));
      } catch (e) {
        err = e;
      }
      check(!!err, 'E4: ' + hostile.label + ' is REJECTED by deserialize');
      assertAutosaveRecovery(env, 'E4 ' + hostile.label, hostile.nodes);
    });

    // One named-store pass for the drive case (the plan's named example).
    assertNamedRecovery(
      env, 'E4 out-of-range drive', 'Hostile Drive',
      [{ id: 'd1', type: 'distortion', params: { drive: 5, tone: 0.7, output: -3 } }]
    );

    // The all-four chain from B must NOT be collateral damage: it still
    // loads after the hostile barrage (recovery never poisoned the stores).
    sandbox.Persistence.saveCurrentChain(copyNodes(ALL_TEN_MODEL));
    check(
      deepEqual(sandbox.Persistence.loadInitialModel(), ALL_TEN_MODEL),
      'E5: after the hostile barrage, the healthy all-four autosave loads EXACTLY'
    );
  }

  // ------------------------------------------------------------------
  console.log('F. the live-catalog guard degrades to lenient without a catalog');
  // ------------------------------------------------------------------
  {
    // Simulate a bare harness: catalog absent, then empty, then broken.
    var realEffectCatalog = sandbox.EffectCatalog;
    delete sandbox.EffectCatalog;
    check(
      deepEqual(sandbox.Persistence.loadInitialModel(), ALL_TEN_MODEL) ||
        deepEqual(sandbox.Persistence.loadInitialModel(), sandbox.DEFAULT_PRESET.nodes),
      'F: no-catalog sandbox still returns a valid model (guard skips, no throw)'
    );
    // With the registry ABSENT the guard must not reject a legacy load:
    sandbox.PresetStore.save('No Registry', copyNodes(LEGACY_MODEL));
    check(
      !!sandbox.PresetStore.load('No Registry'),
      'F: with EffectCatalog absent, a legacy preset loads (guard degrades to lenient)'
    );
    sandbox.EffectCatalog = {
      getAllTypes: function () { return []; },
      getParamSpec: function () { return []; }
    };
    check(
      !!sandbox.PresetStore.load('No Registry'),
      'F: with an EMPTY catalog, load still degrades to lenient (no false rejections)'
    );
    sandbox.EffectCatalog = {
      getAllTypes: function () { throw new Error('broken catalog'); },
      getParamSpec: function () { throw new Error('broken catalog'); }
    };
    check(
      !!sandbox.PresetStore.load('No Registry'),
      'F: with a THROWING catalog, load still degrades to lenient (never crashes on the guard)'
    );
    sandbox.EffectCatalog = realEffectCatalog;
    check(
      !!sandbox.PresetStore.load('No Registry'),
      'F: catalog restored, the same legacy preset still loads'
    );
  }

  // ------------------------------------------------------------------
  console.log('G. default chain + factory library unchanged (PRE-1 decisions)');
  // ------------------------------------------------------------------
  {
    check(
      sandbox.DEFAULT_PRESET.nodes.length === 6 &&
        sandbox.DEFAULT_PRESET.nodes.every(function (entry) {
          return ['gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter'].indexOf(entry.type) !== -1;
        }),
      'G1: the default chain is unchanged — no cycle-3 types (decision: first-run sound stays as shipped)'
    );
    var factory = sandbox.FactoryPresets.list();
    check(
      Array.isArray(factory) && factory.length === 6,
      'G2: the factory library still lists exactly six presets (no cycle-3 showcase yet — see factory-presets.js header)'
    );
    check(
      factory.length > 0 && deepEqual(factory[0].nodes, sandbox.DEFAULT_PRESET.nodes),
      'G2: factory Classic Karaoke remains byte-identical to DEFAULT_PRESET'
    );
    var allFactoryLoad = factory.every(function (preset) {
      try {
        return !!PresetSchema.deserialize(
          JSON.parse(JSON.stringify(PresetSchema.serialize(preset.name, preset.nodes)))
        );
      } catch (err) {
        return false;
      }
    });
    check(allFactoryLoad, 'G2: every factory entry round-trips through the schema clean');
  }

  // ------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: preset schema + round-trip for all four cycle-3 effects (PRE-1)');
    return 0;
  }
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (label) {
    console.log('  - ' + label);
  });
  return 1;
}

main().then(
  function (code) {
    process.exit(code);
  },
  function (err) {
    console.error('FAIL: harness threw: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
);
