// Regression test for DIST-1 — the cycle-3 distortion node
// (src/node-distortion.js), built per the D3 research decision
// (docs/ultron/research/rq3-distortion-curves.md).
//
// Follows the committed zero-dependency Node harness convention (see
// tests/test-node-reuse-type-match.js's header): browser globals stubbed,
// the REAL src files loaded into a vm sandbox, per-check ok/FAIL prints,
// exit 0 on pass / 1 on any failure. Assertions inspect the PHYSICAL
// composite object the factory built (curve array, AudioParam values,
// recorded connect edges) — not just the registered metadata.
//
// Covers the node-level DIST-1 acceptance slice:
//   - registration in EffectCatalog
//   - curve construction per D3 (odd length, symmetric/DC-free,
//     normalized f(1)=1, monotonic, near-linear at center)
//   - internal topology (driveGain -> shaper -> tone -> outGain)
//   - param application: Drive->pre-gain map, Tone->exponential Hz map,
//     Output->dB->linear with the UNITY output guard, ramped via
//     AudioParamRamp
//   - output guard ceiling holds even for out-of-spec dB (hand-edited
//     preset defense)
//   - preset serialize/deserialize round-trip (PresetSchema) for a
//     distortion entry
//
// Audio-quality judgments (audible / artifact-free / bypass-clean on
// assets/test-vocal.mp3) are USER-judged in QA-1, per the plan — not
// automatable here.
//
// Run from a clean clone:  node tests/test-distortion-node.js

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
// Minimal Web Audio stubs — GainNode/WaveShaperNode/BiquadFilterNode
// shapes exactly as deep as the assertions lean on them.
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
      createWaveShaper: function () {
        var n = makeBaseNode('WaveShaperNode');
        n.curve = null;
        n.oversample = 'none';
        return n;
      },
      createBiquadFilter: function () {
        var n = makeBaseNode('BiquadFilterNode');
        n.type = 'lowpass';
        n.frequency = makeParam(350);
        n.Q = makeParam(1);
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
  loadSrc(sandbox, 'src/node-distortion.js');
  loadSrc(sandbox, 'src/preset-schema.js');

  console.log('DIST-1 node tests (src/node-distortion.js)');

  // -- Registration ------------------------------------------------------
  check(
    sandbox.EffectCatalog.getAllTypes().indexOf('distortion') !== -1,
    'distortion registered in EffectCatalog (palette chip source)'
  );
  check(sandbox.EffectCatalog.getLabel('distortion') === 'Distortion', 'label is "Distortion"');

  var spec = sandbox.EffectCatalog.getParamSpec('distortion');
  check(spec.length === 3, 'paramSpec has exactly 3 params (Drive/Tone/Output)');
  var specById = {};
  spec.forEach(function (s) { specById[s.id] = s; });
  check(!!specById.drive && !!specById.tone && !!specById.output, 'param ids are drive/tone/output');
  check(specById.drive.label === 'Drive' && specById.tone.label === 'Tone' &&
    specById.output.label === 'Output', 'plain-language labels Drive/Tone/Output');
  check(specById.drive.default === 0.25 && specById.tone.default === 0.7 &&
    specById.output.default === -3, 'defaults per D3 (0.25 / 0.7 / -3 dB)');
  check(specById.output.max === 0, 'Output slider capped at 0 dB (unity)');

  // -- Factory build + defaults ------------------------------------------
  // Drive the factory the way the app does: buildGraph with one model entry.
  vm.runInContext(
    'window.AudioGraph.buildGraph([{id: "d1", type: "distortion", params: {}}]);',
    sandbox
  );
  await new Promise(function (r) { setTimeout(r, 60); }); // deferred rewire commit
  var instance = vm.runInContext('window.AudioGraph.getNodeInstance("d1")', sandbox);

  check(!!instance && !!instance.input && !!instance.output, 'factory returns composite {input, output}');
  check(instance.input === instance.driveGain && instance.output === instance.outGain,
    'input is driveGain, output is outGain');

  // -- Curve construction (D3) --------------------------------------------
  var curve = instance.shaper.curve;
  check(curve instanceof Float32Array || Array.isArray(curve), 'curve is a Float32Array');
  check(curve.length === 2047, 'curve length 2047 (odd — exact center at 0)');
  check(instance.shaper.oversample === '4x', "oversample is '4x' (E1)");
  var mid = (curve.length - 1) / 2;
  check(approx(curve[mid], 0, 1e-7), 'curve[center] = 0 (symmetric, DC-free)');
  var maxAsym = 0;
  for (var i = 1; i <= mid; i++) {
    maxAsym = Math.max(maxAsym, Math.abs(curve[mid + i] + curve[mid - i]));
  }
  check(maxAsym < 1e-6, 'curve is odd-symmetric (no DC per E2 note), max asym ' + maxAsym);
  check(approx(curve[curve.length - 1], 1, 1e-6), 'curve normalized f(1) = 1 (bounded output)');
  check(approx(curve[0], -1, 1e-6), 'curve f(-1) = -1');
  var monotonic = true;
  for (var j = 1; j < curve.length; j++) {
    if (curve[j] < curve[j - 1]) { monotonic = false; break; }
  }
  check(monotonic, 'curve is monotonically non-decreasing');
  check(approx(curve[mid + 1], Math.tanh(1.5 * (1 / 2046 * 2)) / Math.tanh(1.5), 1e-6),
    'curve points match tanh(1.5x)/tanh(1.5)');

  // -- Defaults applied at construction -----------------------------------
  check(approx(instance.driveGain.gain.value, Math.pow(10, 0.25), 1e-6),
    'default drive 0.25 -> pre-gain 10^0.25 (~+5 dB)');
  check(instance.toneFilter.type === 'lowpass', 'tone stage is a lowpass biquad');
  check(approx(instance.toneFilter.frequency.value, 1500 * Math.pow(8, 0.7), 0.5),
    'default tone 0.7 -> ~6.3 kHz exponential-map cutoff');
  check(approx(instance.outGain.gain.value, Math.pow(10, -3 / 20), 1e-6),
    'default output -3 dB -> linear 10^(-3/20)');

  // -- Internal topology ---------------------------------------------------
  check(instance.driveGain.__connectsTo(instance.shaper), 'driveGain -> shaper');
  check(instance.shaper.__connectsTo(instance.toneFilter), 'shaper -> toneFilter');
  check(instance.toneFilter.__connectsTo(instance.outGain), 'toneFilter -> outGain');
  check(!instance.driveGain.__connectsTo(instance.toneFilter), 'no shaper bypass path');

  // -- applyParam mappings (ramped writes) ----------------------------------
  function apply(paramId, value) {
    sandbox.EffectCatalog.applyParam('distortion', instance, paramId, value);
  }
  apply('drive', 1);
  check(approx(instance.driveGain.gain.value, 10, 1e-6), 'drive 1 -> pre-gain 10 (+20 dB)');
  apply('drive', 0);
  check(approx(instance.driveGain.gain.value, 1, 1e-6), 'drive 0 -> pre-gain 1 (near-transparent)');
  apply('tone', 0);
  check(approx(instance.toneFilter.frequency.value, 1500, 0.5), 'tone 0 -> 1.5 kHz');
  apply('tone', 1);
  check(approx(instance.toneFilter.frequency.value, 12000, 0.5), 'tone 1 -> 12 kHz');
  apply('output', -24);
  check(approx(instance.outGain.gain.value, Math.pow(10, -24 / 20), 1e-6), 'output -24 dB -> 10^(-24/20)');

  // -- Output guard ceiling --------------------------------------------------
  apply('output', 0);
  check(approx(instance.outGain.gain.value, 1.0, 1e-9), 'output 0 dB (max) -> exactly unity, never above');
  var liveRangeError = null;
  try {
    apply('output', 6);
  } catch (err) {
    liveRangeError = err;
  }
  check(liveRangeError && /range -24\.\.0/.test(liveRangeError.message) &&
    approx(instance.outGain.gain.value, 1.0, 1e-9),
    'catalog rejects out-of-spec output +6 dB and preserves the unity ceiling');
  var createRangeError = null;
  try {
    vm.runInContext(
      'window.AudioGraph.buildGraph([{id: "d2", type: "distortion", params: {output: 12}}]);',
      sandbox
    );
  } catch (err) {
    createRangeError = err;
  }
  check(createRangeError && /range -24\.\.0/.test(createRangeError.message) &&
    vm.runInContext('window.AudioGraph.getNodeInstance("d1")', sandbox) === instance,
    'catalog rejects hostile construction params before replacing the live graph');

  // -- Preset round-trip (PresetSchema) --------------------------------------
  var model = [
    { id: 'g1', type: 'gain', params: { gainDb: -2 } },
    { id: 'd3', type: 'distortion', params: { drive: 0.8, tone: 0.4, output: -6 } }
  ];
  var serialized = sandbox.PresetSchema.serialize('dist preset', model);
  var json = JSON.parse(JSON.stringify(serialized)); // wire format survival
  var restored = sandbox.PresetSchema.deserialize(json);
  var d3 = restored.nodes.filter(function (n) { return n.type === 'distortion'; })[0];
  check(!!d3, 'preset round-trip preserves the distortion entry');
  check(d3.params.drive === 0.8 && d3.params.tone === 0.4 && d3.params.output === -6,
    'preset round-trip preserves drive/tone/output exactly');
  restored.nodes[1].params.drive = 99;
  check(json.nodes[1].params.drive === 0.8, 'deserialize deep-copies (no aliasing into stored preset)');

  // -- Limiter untouched -------------------------------------------------------
  // The distortion node wires nothing into any limiter; guard is purely the
  // outGain unity cap. Structural proxy: outGain has no threshold param and
  // the composite exposes no limiter references.
  check(instance.outGain.threshold === undefined, 'output guard is a plain GainNode (no limiter changes)');

  console.log('');
  if (failures.length === 0) {
    console.log('DIST-1 node tests: all checks passed');
    process.exit(0);
  } else {
    console.log('DIST-1 node tests: ' + failures.length + ' FAIL');
    process.exit(1);
  }
}

main().catch(function (err) {
  console.error('CRASH:', err);
  process.exit(1);
});
