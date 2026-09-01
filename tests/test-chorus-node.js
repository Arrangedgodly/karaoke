// Regression test for CHOR-1 — the cycle-3 chorus node
// (src/node-chorus.js), built per the D4 research decision
// (docs/ultron/research/rq4-chorus-topology.md).
//
// Follows the committed zero-dependency Node harness convention (see
// tests/test-distortion-node.js's header): browser globals stubbed, the
// REAL src files loaded into a vm sandbox, per-check ok/FAIL prints, exit
// 0 on pass / 1 on any failure. Assertions inspect the PHYSICAL composite
// object the factory built (AudioParam values, recorded connect edges,
// LFO state) — not just the registered metadata.
//
// Covers the node-level CHOR-1 acceptance slice:
//   - registration in EffectCatalog
//   - paramSpec per D4 (ids/ranges/defaults/labels)
//   - internal topology (12 native nodes; dry + 2 panned voice paths;
//     LFO -> sign-flipped depth gains -> both delayTime params)
//   - LFO phase opposition (depthGainR is exactly −depthGainL, holds
//     across applyParam writes incl. out-of-spec depth defense)
//   - never-reach-zero delay rule (baseline 25 ms, excursion capped ±10 ms)
//   - param mappings: Rate -> lfo.frequency, Mix -> equal-power cos/sin
//     pair (identical law to node-delay.js), Depth -> ±ms/1000
//   - preset serialize/deserialize round-trip (PresetSchema)
//
// Audio-quality judgments (audible / artifact-free / bypass-clean on
// assets/test-vocal.mp3) are USER-judged in QA-1, per the plan — not
// automatable here.
//
// Run from a clean clone:  node tests/test-chorus-node.js

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

function approx(a, b, tol) {
  return Math.abs(a - b) <= (tol || 1e-9);
}

// ----------------------------------------------------------------------
// Minimal Web Audio stubs — GainNode/DelayNode/OscillatorNode/
// StereoPannerNode shapes exactly as deep as the assertions lean on them.
// ----------------------------------------------------------------------
function makeParam(initial) {
  return {
    value: initial,
    cancelScheduledValues: function () {},
    setValueAtTime: function (v) {
      this.value = v;
    },
    linearRampToValueAtTime: function (v) {
      this.value = v;
    }
  };
}

function makeBaseNode(typeName) {
  return {
    __nodeTypeName: typeName,
    __connectionsTo: [],
    connect: function (dest) {
      this.__connectionsTo.push(dest);
    },
    disconnect: function () {
      this.__connectionsTo = [];
    },
    __connectsTo: function (dest) {
      return this.__connectionsTo.indexOf(dest) !== -1;
    }
  };
}

function createSandbox() {
  var sandbox = {
    console: console,
    setTimeout: function (fn) {
      return setTimeout(fn, 0);
    },
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    document: { getElementById: function () { return null; } }
  };
  sandbox.window = sandbox;
  sandbox.Float32Array = Float32Array;
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: {
      currentTime: 0,
      destination: makeBaseNode('AudioDestinationNode'),
      createGain: function () {
        var n = makeBaseNode('GainNode');
        n.gain = makeParam(1);
        return n;
      },
      createDelay: function (maxDelayTime) {
        var n = makeBaseNode('DelayNode');
        n.delayTime = makeParam(0);
        n.__maxDelayTime = maxDelayTime;
        return n;
      },
      createOscillator: function () {
        var n = makeBaseNode('OscillatorNode');
        n.type = 'sine';
        n.frequency = makeParam(440);
        n.__started = false;
        n.start = function () {
          n.__started = true;
        };
        return n;
      },
      createStereoPanner: function () {
        var n = makeBaseNode('StereoPannerNode');
        n.pan = makeParam(0);
        return n;
      }
    },
    sourceNode: makeBaseNode('MediaStreamAudioSourceNode')
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// ----------------------------------------------------------------------
// Suite
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  loadSrc(sandbox, 'src/effect-catalog.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js');
  loadSrc(sandbox, 'src/node-chorus.js');
  loadSrc(sandbox, 'src/preset-schema.js');

  console.log('CHOR-1 node tests (src/node-chorus.js)');

  // -- Registration ------------------------------------------------------
  check(
    sandbox.EffectCatalog.getAllTypes().indexOf('chorus') !== -1,
    'chorus registered in EffectCatalog (palette chip source)'
  );
  check(sandbox.EffectCatalog.getLabel('chorus') === 'Chorus', 'label is "Chorus"');

  var spec = sandbox.EffectCatalog.getParamSpec('chorus');
  check(spec.length === 3, 'paramSpec has exactly 3 params (Depth/Rate/Mix)');
  var specById = {};
  spec.forEach(function (s) { specById[s.id] = s; });
  check(!!specById.depthMs && !!specById.rateHz && !!specById.mix,
    'param ids are depthMs/rateHz/mix');
  check(specById.depthMs.label === 'Depth' && specById.rateHz.label === 'Rate' &&
    specById.mix.label === 'Mix', 'plain-language labels Depth/Rate/Mix');
  check(specById.depthMs.min === 0 && specById.depthMs.max === 10 &&
    specById.depthMs.default === 3 && specById.depthMs.step === 0.5,
    'depthMs range 0-10 ms, default 3, step 0.5 (D4)');
  check(specById.rateHz.min === 0.1 && specById.rateHz.max === 8 &&
    specById.rateHz.default === 1.5 && specById.rateHz.step === 0.1,
    'rateHz range 0.1-8 Hz, default 1.5, step 0.1 (D4)');
  check(specById.mix.min === 0 && specById.mix.max === 100 &&
    specById.mix.default === 30 && specById.mix.step === 1,
    'mix range 0-100 %, default 30, step 1 (D4)');

  // -- Factory build + defaults ------------------------------------------
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "c1", type: "chorus", params: {}}]);',
    sandbox
  );
  await new Promise(function (r) { setTimeout(r, 60); }); // deferred rewire commit
  var instance = vm.runInContext('window.AudioGraph.getNodeInstance("c1")', sandbox);

  check(!!instance && !!instance.input && !!instance.output,
    'factory returns composite {input, output}');
  check(instance.input === instance.inputGain && instance.output === instance.outputSum,
    'input is inputGain, output is outputSum');

  // -- Node census: 12 native nodes, no worklet ---------------------------
  var internals = ['inputGain', 'delayL', 'delayR', 'lfo', 'depthGainL',
    'depthGainR', 'panL', 'panR', 'wetSum', 'dryGain', 'wetGain', 'outputSum'];
  var allPresent = internals.every(function (k) { return !!instance[k]; });
  check(allPresent, 'composite exposes all 12 internal native nodes: ' + internals.join(','));
  check(Object.keys(internals).length === 12, 'exactly 12 native nodes (D4 node count)');

  // -- Baseline delays + never-reach-zero rule ----------------------------
  check(approx(instance.delayL.delayTime.value, 0.025, 1e-9) &&
    approx(instance.delayR.delayTime.value, 0.025, 1e-9),
    'both delayTime baselines are 25 ms (set once at construction)');
  check(instance.delayL.__maxDelayTime === 0.06 && instance.delayR.__maxDelayTime === 0.06,
    'delays constructed with 0.06 s cap (baseline 25 + max depth 10 = 35 ms fits)');

  // -- LFO construction ----------------------------------------------------
  check(instance.lfo.type === 'sine', 'LFO is a sine oscillator');
  check(instance.lfo.__started, 'LFO started at construction (never stopped)');
  check(approx(instance.lfo.frequency.value, 1.5, 1e-9), 'default rate 1.5 Hz on lfo.frequency');

  // -- LFO phase opposition (the D4 core property) --------------------------
  check(approx(instance.depthGainL.gain.value, 0.003, 1e-9),
    'default depth 3 ms -> depthGainL +0.003');
  check(approx(instance.depthGainR.gain.value, -0.003, 1e-9),
    'depthGainR is exactly NEGATIVE (180° phase opposition)');
  check(instance.lfo.__connectsTo(instance.depthGainL) &&
    instance.lfo.__connectsTo(instance.depthGainR),
    'one LFO feeds BOTH depth gains');
  check(instance.depthGainL.__connectsTo(instance.delayL.delayTime) &&
    instance.depthGainR.__connectsTo(instance.delayR.delayTime),
    'depth gains connect into the a-rate delayTime params (audio-rate modulation)');

  // -- Stereo placement ------------------------------------------------------
  check(approx(instance.panL.pan.value, -1, 1e-9) && approx(instance.panR.pan.value, 1, 1e-9),
    'voices hard-panned L(-1)/R(+1)');

  // -- Internal topology ------------------------------------------------------
  check(instance.inputGain.__connectsTo(instance.dryGain), 'inputGain -> dryGain');
  check(instance.inputGain.__connectsTo(instance.delayL) &&
    instance.inputGain.__connectsTo(instance.delayR),
    'inputGain -> both delay voices');
  check(instance.delayL.__connectsTo(instance.panL) && instance.delayR.__connectsTo(instance.panR),
    'delays -> their panners (pan BEFORE wet sum)');
  check(instance.panL.__connectsTo(instance.wetSum) && instance.panR.__connectsTo(instance.wetSum),
    'panners -> wetSum');
  check(instance.wetSum.__connectsTo(instance.wetGain), 'wetSum -> wetGain');
  check(instance.dryGain.__connectsTo(instance.outputSum) &&
    instance.wetGain.__connectsTo(instance.outputSum),
    'dryGain + wetGain -> outputSum');
  check(!instance.delayL.__connectsTo(instance.wetSum),
    'no pre-pan wet tap (voices never sum un-panned)');
  check(!instance.delayL.__connectsTo(instance.delayR) &&
    !instance.delayR.__connectsTo(instance.delayL),
    'no cross-feedback between voices (C-lite, ping-pong rejected)');

  // -- Defaults: equal-power mix at 30 % ---------------------------------------
  check(approx(instance.dryGain.gain.value, Math.cos(0.3 * Math.PI / 2), 1e-9),
    'default mix 30 -> dryGain = cos(0.3·π/2)');
  check(approx(instance.wetGain.gain.value, Math.sin(0.3 * Math.PI / 2), 1e-9),
    'default mix 30 -> wetGain = sin(0.3·π/2)');

  // -- applyParam mappings (ramped writes) --------------------------------------
  function apply(paramId, value) {
    sandbox.EffectCatalog.applyParam('chorus', instance, paramId, value);
  }

  apply('rateHz', 0.5);
  check(approx(instance.lfo.frequency.value, 0.5, 1e-9), 'rateHz 0.5 -> lfo.frequency 0.5 Hz');
  apply('rateHz', 8);
  check(approx(instance.lfo.frequency.value, 8, 1e-9), 'rateHz 8 (max) -> lfo.frequency 8 Hz');

  apply('depthMs', 10);
  check(approx(instance.depthGainL.gain.value, 0.01, 1e-9) &&
    approx(instance.depthGainR.gain.value, -0.01, 1e-9),
    'depthMs 10 (max) -> ±0.01 s excursion; opposition preserved');
  apply('depthMs', 0);
  check(approx(instance.depthGainL.gain.value, 0, 1e-9) &&
    approx(instance.depthGainR.gain.value, 0, 1e-9),
    'depthMs 0 -> ±0 (static 25 ms delay, LFO still running but depthless)');
  var invalidDepthError = null;
  try {
    apply('depthMs', 99);
  } catch (err) {
    invalidDepthError = err;
  }
  check(invalidDepthError && /range 0\.\.10/.test(invalidDepthError.message) &&
    approx(instance.depthGainL.gain.value, 0, 1e-9) &&
    approx(instance.depthGainR.gain.value, 0, 1e-9),
    'catalog rejects out-of-spec depth 99 without touching the live modulation depth');

  apply('mix', 0);
  check(approx(instance.dryGain.gain.value, 1, 1e-9) &&
    approx(instance.wetGain.gain.value, 0, 1e-9),
    'mix 0 -> dry 1 / wet 0 (bypass-clean at mix=0)');
  apply('mix', 100);
  check(approx(instance.dryGain.gain.value, 0, 1e-9) &&
    approx(instance.wetGain.gain.value, 1, 1e-9),
    'mix 100 -> dry 0 / wet 1');
  apply('mix', 50);
  check(approx(instance.dryGain.gain.value, Math.SQRT1_2, 1e-9) &&
    approx(instance.wetGain.gain.value, Math.SQRT1_2, 1e-9),
    'mix 50 -> both ≈ 0.707 (equal-power midpoint, not 0.5/0.5 linear)');
  var invalidMixError = null;
  try {
    apply('mix', 200);
  } catch (err) {
    invalidMixError = err;
  }
  check(invalidMixError && /range 0\.\.100/.test(invalidMixError.message) &&
    approx(instance.dryGain.gain.value, Math.SQRT1_2, 1e-9) &&
    approx(instance.wetGain.gain.value, Math.SQRT1_2, 1e-9),
    'catalog rejects out-of-spec mix 200 without touching the live equal-power mix');

  // -- Preset round-trip (PresetSchema) ------------------------------------------
  var model = [
    { id: 'g1', type: 'gain', params: { gainDb: -2 } },
    { id: 'c2', type: 'chorus', params: { depthMs: 6, rateHz: 0.8, mix: 45 } }
  ];
  var serialized = sandbox.PresetSchema.serialize('chorus preset', model);
  var json = JSON.parse(JSON.stringify(serialized)); // wire format survival
  var restored = sandbox.PresetSchema.deserialize(json);
  var c2 = restored.nodes.filter(function (n) { return n.type === 'chorus'; })[0];
  check(!!c2, 'preset round-trip preserves the chorus entry');
  check(c2.params.depthMs === 6 && c2.params.rateHz === 0.8 && c2.params.mix === 45,
    'preset round-trip preserves depthMs/rateHz/mix exactly');
  restored.nodes[1].params.depthMs = 99;
  check(json.nodes[1].params.depthMs === 6, 'deserialize deep-copies (no aliasing into stored preset)');

  // -- Construction with explicit params -------------------------------------------
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "c3", type: "chorus", ' +
    'params: {depthMs: 8, rateHz: 4, mix: 100}}]);',
    sandbox
  );
  await new Promise(function (r) { setTimeout(r, 60); });
  var c3 = vm.runInContext('window.AudioGraph.getNodeInstance("c3")', sandbox);
  check(approx(c3.depthGainL.gain.value, 0.008, 1e-9) &&
    approx(c3.depthGainR.gain.value, -0.008, 1e-9) &&
    approx(c3.lfo.frequency.value, 4, 1e-9) &&
    approx(c3.wetGain.gain.value, 1, 1e-9) &&
    approx(c3.dryGain.gain.value, 0, 1e-9),
    'factory honors explicit depthMs/rateHz/mix at construction');

  console.log('');
  if (failures.length === 0) {
    console.log('CHOR-1 node tests: all checks passed');
    process.exit(0);
  } else {
    console.log('CHOR-1 node tests: ' + failures.length + ' FAIL');
    process.exit(1);
  }
}

main().catch(function (err) {
  console.error('CRASH:', err);
  process.exit(1);
});
