// StatusReadouts' LATENCY contract — the FEW-2 readout wiring
// (src/status-readouts.js), specifically the "adaptable" LATENCY figure:
// context-reported baseLatency+outputLatency PLUS the live chain's own
// declared added latency (EffectCatalog.getLatencySeconds() per node),
// zeroed while Bypass is engaged.
//
// Same committed-test convention as the rest of the suite: a
// zero-dependency Node harness (fs.readFileSync + vm.runInContext) that
// stubs the minimal DOM/window surface the file touches, loads the REAL
// src/status-readouts.js, and observes behavior only through
// window.StatusReadouts plus the stubbed DOM elements it writes into.
//
// The 1 Hz interval is captured rather than waited on: window.setInterval
// is stubbed to record the callback, and the test invokes it directly —
// deterministic, no real-time sleeps.
//
// Run from a clean clone: node tests/test-status-readouts.js

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

function makeElement() {
  return { textContent: '—' };
}

function createSandbox() {
  var elements = {
    'readout-sample-rate': makeElement(),
    'readout-latency': makeElement(),
    'readout-node-count': makeElement()
  };

  var intervalCalls = [];
  var clearedIds = [];

  var sandbox = {
    console: console,
    document: {
      getElementById: function (id) {
        return Object.prototype.hasOwnProperty.call(elements, id) ? elements[id] : null;
      }
    },
    setInterval: function (fn, ms) {
      var id = intervalCalls.length + 1;
      intervalCalls.push({ id: id, fn: fn, ms: ms });
      return id;
    },
    clearInterval: function (id) {
      clearedIds.push(id);
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  return {
    sandbox: sandbox,
    elements: elements,
    intervalCalls: intervalCalls,
    clearedIds: clearedIds
  };
}

function loadStatusReadouts(sandbox) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/status-readouts.js'), 'utf8'),
    sandbox,
    { filename: 'src/status-readouts.js' }
  );
}

function fakeContext(base, output, sampleRate) {
  return {
    sampleRate: sampleRate === undefined ? 48000 : sampleRate,
    baseLatency: base,
    outputLatency: output
  };
}

function installChain(env, model) {
  env.sandbox.ChainCanvas = {
    getCurrentModel: function () {
      return model;
    }
  };
}

function installCatalog(env, latencyByType) {
  env.sandbox.EffectCatalog = {
    getLatencySeconds: function (type) {
      return Object.prototype.hasOwnProperty.call(latencyByType, type) ? latencyByType[type] : 0;
    }
  };
}

function installBypass(env, engaged) {
  env.sandbox.AudioBypass = {
    isEngaged: function () {
      return engaged;
    }
  };
}

function tick(env) {
  check(env.intervalCalls.length === 1, 'tick(): exactly one interval was ever started');
  env.intervalCalls[0].fn();
}

// ----------------------------------------------------------------------
console.log('A. onEngineStarted: writes RATE/LATENCY/NODES, starts the tick once');
// ----------------------------------------------------------------------
(function () {
  var env = createSandbox();
  loadStatusReadouts(env.sandbox);
  installChain(env, []);
  installCatalog(env, {});
  installBypass(env, false);

  env.sandbox.StatusReadouts.onEngineStarted(fakeContext(0.01, 0.02, 48000));

  check(env.elements['readout-sample-rate'].textContent === '48.0 kHz', 'A1: RATE formatted from sampleRate');
  check(env.elements['readout-latency'].textContent === '30.0 ms', 'A2: LATENCY = (base+output)*1000 with an empty chain');
  check(env.elements['readout-node-count'].textContent === '0', 'A3: NODES from the empty live model');
  check(env.intervalCalls.length === 1 && env.intervalCalls[0].ms === 1000, 'A4: the ONE 1 Hz interval was started');

  env.sandbox.StatusReadouts.onEngineStarted(fakeContext(0.01, 0.02, 48000));
  check(env.intervalCalls.length === 1, 'A5: a second onEngineStarted call does not stack a second interval');

  var warned = false;
  var originalWarn = console.warn;
  console.warn = function () { warned = true; };
  env.sandbox.StatusReadouts.onEngineStarted(null);
  console.warn = originalWarn;
  check(warned && env.elements['readout-sample-rate'].textContent === '48.0 kHz',
    'A6: a bad argument warns once and leaves prior readouts untouched');
})();

// ----------------------------------------------------------------------
console.log('B. chain latency folds into LATENCY, on top of the I/O estimate');
// ----------------------------------------------------------------------
(function () {
  var env = createSandbox();
  loadStatusReadouts(env.sandbox);
  installChain(env, [{ id: 'g1', type: 'gate', params: {} }]);
  installCatalog(env, { gate: 0.005 });
  installBypass(env, false);

  env.sandbox.StatusReadouts.onEngineStarted(fakeContext(0.01, 0.02, 48000));
  check(env.elements['readout-latency'].textContent === '35.0 ms',
    'B1: one gate (5 ms) adds on top of the 30 ms I/O estimate');

  installChain(env, [
    { id: 'g1', type: 'gate', params: {} },
    { id: 'a1', type: 'autotune', params: {} }
  ]);
  installCatalog(env, { gate: 0.005, autotune: 0.020 });
  tick(env);
  check(env.elements['readout-latency'].textContent === '55.0 ms',
    'B2: a second effect (autotune, 20 ms) sums into the total on the next 1 Hz tick — no restart needed');
  check(env.elements['readout-node-count'].textContent === '2', 'B3: NODES also picked up the chain edit on the same tick');

  installChain(env, [{ id: 'a1', type: 'autotune', params: {} }]);
  tick(env);
  check(env.elements['readout-latency'].textContent === '50.0 ms',
    'B4: removing the gate drops LATENCY back down within one tick');
})();

// ----------------------------------------------------------------------
console.log('C. Bypass engaged: chain latency is ignored, only I/O remains');
// ----------------------------------------------------------------------
(function () {
  var env = createSandbox();
  loadStatusReadouts(env.sandbox);
  installChain(env, [
    { id: 'p1', type: 'pitchshift', params: {} },
    { id: 'c1', type: 'compressor', params: {} }
  ]);
  installCatalog(env, { pitchshift: 0.1, compressor: 0.006 });
  installBypass(env, false);

  env.sandbox.StatusReadouts.onEngineStarted(fakeContext(0.01, 0.02, 48000));
  check(env.elements['readout-latency'].textContent === '136.0 ms',
    'C1: pitchshift (100 ms) + compressor (6 ms) + 30 ms I/O, chain live');

  installBypass(env, true);
  tick(env);
  check(env.elements['readout-latency'].textContent === '30.0 ms',
    'C2: engaging Bypass drops LATENCY to the mic-I/O-only figure within one tick');

  installBypass(env, false);
  tick(env);
  check(env.elements['readout-latency'].textContent === '136.0 ms',
    'C3: disengaging Bypass restores the chain total');
})();

// ----------------------------------------------------------------------
console.log('D. defensive fallbacks — never a throw into the host app');
// ----------------------------------------------------------------------
(function () {
  var env = createSandbox();
  loadStatusReadouts(env.sandbox);
  // No ChainCanvas, no EffectCatalog, no AudioBypass installed at all.
  env.sandbox.StatusReadouts.onEngineStarted(fakeContext(0.01, 0.02, 48000));
  check(env.elements['readout-latency'].textContent === '30.0 ms',
    'D1: missing ChainCanvas/EffectCatalog/AudioBypass falls back to I/O-only, no throw');

  installChain(env, [{ id: 'g1', type: 'gate', params: {} }]);
  installCatalog(env, { gate: 0.005 });
  // EffectCatalog present but getCurrentModel throws.
  env.sandbox.ChainCanvas = {
    getCurrentModel: function () {
      throw new Error('boom');
    }
  };
  var threw = null;
  try {
    env.sandbox.StatusReadouts.refreshNow();
  } catch (e) {
    threw = e;
  }
  check(threw === null, 'D2: a throwing getCurrentModel() is caught — refreshNow() does not propagate it');
  check(env.elements['readout-latency'].textContent === '30.0 ms',
    'D3: latency falls back to I/O-only when the model getter throws');

  // getCurrentModel returns something non-array.
  env.sandbox.ChainCanvas = { getCurrentModel: function () { return null; } };
  env.sandbox.StatusReadouts.refreshNow();
  check(env.elements['readout-latency'].textContent === '30.0 ms',
    'D4: a non-array model is treated as an empty chain, not a throw');

  // A model entry with an unregistered type contributes 0, not NaN.
  installCatalog(env, {});
  installChain(env, [{ id: 'x1', type: 'unregistered-type', params: {} }]);
  env.sandbox.StatusReadouts.refreshNow();
  check(env.elements['readout-latency'].textContent === '30.0 ms',
    'D5: an unregistered/unknown type contributes 0 latency, never NaN');
})();

// ----------------------------------------------------------------------
console.log('E. neither baseLatency nor outputLatency reported -> —, chain latency does not override it');
// ----------------------------------------------------------------------
(function () {
  var env = createSandbox();
  loadStatusReadouts(env.sandbox);
  installChain(env, [{ id: 'g1', type: 'gate', params: {} }]);
  installCatalog(env, { gate: 0.005 });
  installBypass(env, false);

  env.sandbox.StatusReadouts.onEngineStarted(fakeContext(undefined, undefined, 48000));
  check(env.elements['readout-latency'].textContent === '—',
    'E1: both I/O fields unreported stays — even with a nonzero declared chain latency');

  var infoCount = 0;
  var originalInfo = console.info;
  console.info = function () { infoCount += 1; };
  env.sandbox.StatusReadouts.refreshNow();
  env.sandbox.StatusReadouts.refreshNow();
  console.info = originalInfo;
  check(infoCount === 0, 'E2: the one-shot info message fired at most once total (already said before this block)');
})();

// ----------------------------------------------------------------------
console.log('F. stop() clears the interval');
// ----------------------------------------------------------------------
(function () {
  var env = createSandbox();
  loadStatusReadouts(env.sandbox);
  installChain(env, []);
  installCatalog(env, {});
  installBypass(env, false);

  env.sandbox.StatusReadouts.onEngineStarted(fakeContext(0.01, 0.02, 48000));
  var startedId = env.intervalCalls[0].id;
  env.sandbox.StatusReadouts.stop();
  check(env.clearedIds.indexOf(startedId) !== -1, 'F1: stop() clears the interval that onEngineStarted started');
})();

if (failures.length > 0) {
  console.error('\nStatusReadouts LATENCY contract: ' + failures.length + ' failure(s)');
  failures.forEach(function (failure) {
    console.error('  - ' + failure);
  });
  process.exit(1);
}

console.log('\nStatusReadouts LATENCY contract: all checks passed');
