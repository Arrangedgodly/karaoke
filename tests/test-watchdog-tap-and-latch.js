// Test for issue #3 — [P1] Correct watchdog tap point and preserve the
// safety latch.
//
// The bug (two halves):
//   1. TAP POINT: FEW-3's OUT analyser tapped AudioGraph.getChainGate() —
//      BEFORE the fixed -6 dBFS MC-4 output attenuator — while the
//      watchdog's trip threshold is derived from
//      AudioGraph.OUTPUT_CEILING_DBFS, which describes the FINAL output.
//      Valid program sitting at the limiter's ceiling (e.g. -3 dBFS after
//      issue #2) is ~-9 dBFS after the attenuator, but the watchdog
//      evaluated the louder pre-attenuated value and muted perfectly
//      legal material.
//   2. LATCH: a graph rebuild's deferred un-duck picked its target from
//      Bypass state alone (`engaged ? 0 : 1`), and Bypass's disengage
//      ramped the chain gate back to 1 unconditionally — either could
//      schedule an UPWARD gate ramp while the watchdog was latched,
//      racing the defend-the-mute loop.
//
// The fix under test:
//   - ensureTaps() connects analyserOut to getOutputAttenuator()'s OUTPUT
//     — the final-output point. The attenuator is persistent (never in
//     buildGraph()'s teardown set), so the connect-once /
//     survives-every-rebuild property is unchanged, and the OUT meter and
//     the howl/peak detectors keep sharing that ONE tap.
//   - MeterTaps.isTripped() exposes the latch READ-ONLY.
//   - buildGraph()'s un-duck and AudioBypass's disengage suppress upward
//     chain-gate ramps while isTripped() (the defend-the-mute loop stays
//     as the backstop); only the human Restore button ramps the gate up
//     after a trip.
//
// Same committed-test convention as tests/test-node-reuse-type-match.js
// and tests/test-factory-presets-policy.js: ZERO-dependency Node harness,
// stub `window` + the minimal Web Audio/DOM surface, load the REAL src
// files (fs.readFileSync + vm.runInContext):
//
//   src/audio-graph.js   (graph model, buildGraph, chain gate, attenuator)
//   src/audio-bypass.js  (the Bypass engage/disengage ramps)
//   src/meter-taps.js    (taps, the watchdog rAF loop, latch, restore)
//
// SIGNAL MODEL — the part that makes the tap point physically matter:
// every stub node carries a nominal output level. Nodes the test FORCES
// own their level (the mic source; the chain delivering limiter-ceiling
// program at the gate); a GainNode without a forced level DERIVES
// output = input + its own gain in dB. The analyser stubs synthesize
// their time/frequency windows FROM whichever node feeds them, so the
// SAME chain state reads ~6 dB different at the two candidate tap
// points. Reverting the tap move (back to a gate feed) therefore changes
// what analyserOut observes and the valid-signal checks below genuinely
// fail — the test bites exactly the issue's mute-valid-material bug.
//
// The rAF loop is driven MANUALLY: requestAnimationFrame is a queue the
// harness controls, so each pumped frame runs one real frame() pass with
// a synthetic timestamp (the peak rule's sustain window — 250 ms in the
// source — is comfortably exceeded by the 800 ms pumped below, so the
// test does not depend on the exact window).
//
// Run from a clean clone:  node tests/test-watchdog-tap-and-latch.js
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

// ----------------------------------------------------------------------
// Assertions: collect failures so one run reports everything, exit 1 at
// the end if any check failed. (Same harness shape as the other tests.)
// ----------------------------------------------------------------------
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

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// buildGraph() commits its instance map + model on the deferred rewire
// (FADE_S*1000 + 5 = ~20ms after the call). 60ms is a comfortable settle.
function settle() {
  return sleep(60);
}

// ----------------------------------------------------------------------
// Minimal Web Audio stubs. AudioParams RECORD every automation call
// ({type, target}) so "did anything schedule an upward ramp" is directly
// assertable; setTargetAtTime deliberately does NOT snap .value (a real
// param glides — the watchdog's defend loop reads the live value).
// connect()/disconnect() record both directions of every edge (__connectionsTo
// / __connectionsFrom) so the analyser stub can derive its signal from
// whichever node feeds it (see the SIGNAL MODEL note in the header).
// ----------------------------------------------------------------------
function makeParam(initial) {
  var param = {
    value: initial,
    __automation: [],
    cancelScheduledValues: function () {
      param.__automation.push({ type: 'cancel', target: null });
    },
    setValueAtTime: function (v) {
      param.__automation.push({ type: 'setValue', target: v });
      param.value = v;
    },
    linearRampToValueAtTime: function (v) {
      param.__automation.push({ type: 'linearRamp', target: v });
      param.value = v;
    },
    setTargetAtTime: function (v) {
      param.__automation.push({ type: 'setTarget', target: v });
      // Real setTargetAtTime GLIDES toward the target; .value has not
      // arrived when the call returns, so the stub leaves it alone.
    }
  };
  return param;
}

function scrubFeeder(dest, src) {
  if (!dest || !dest.__connectionsFrom) {
    return;
  }
  var j = dest.__connectionsFrom.indexOf(src);
  if (j !== -1) {
    dest.__connectionsFrom.splice(j, 1);
  }
}

function makeBaseNode(typeName) {
  var node = {
    __nodeTypeName: typeName,
    __connectionsTo: [],
    __connectionsFrom: [],
    __disconnectCalls: 0,
    __forcedOutDbfs: undefined, // set by the test: a node that OWNS its level
    connect: function (dest) {
      node.__connectionsTo.push(dest);
      if (dest && dest.__connectionsFrom) {
        dest.__connectionsFrom.push(node);
      }
    },
    disconnect: function (dest) {
      node.__disconnectCalls += 1;
      if (dest === undefined) {
        node.__connectionsTo.forEach(function (d) {
          scrubFeeder(d, node);
        });
        node.__connectionsTo = [];
      } else {
        var i = node.__connectionsTo.indexOf(dest);
        if (i !== -1) {
          node.__connectionsTo.splice(i, 1);
        }
        scrubFeeder(dest, node);
      }
    },
    __connectsTo: function (dest) {
      return node.__connectionsTo.indexOf(dest) !== -1;
    }
  };
  return node;
}

function makeGainNode() {
  var node = makeBaseNode('GainNode');
  node.gain = makeParam(1);
  return node;
}

// The stub graph's tiny signal model (see header). A forced level wins;
// otherwise a GainNode derives output = (loudest input) + its gain in dB
// — exactly the physics that make the attenuator matter: the same gate
// level reads ~6 dB louder upstream of it than downstream.
function nodeOutDbfs(node) {
  if (!node) {
    return -Infinity;
  }
  if (typeof node.__forcedOutDbfs === 'number') {
    return node.__forcedOutDbfs;
  }
  if (node.__nodeTypeName === 'GainNode') {
    var inDb = -Infinity;
    (node.__connectionsFrom || []).forEach(function (src) {
      var d = nodeOutDbfs(src);
      if (d > inDb) {
        inDb = d;
      }
    });
    if (inDb === -Infinity) {
      return -Infinity;
    }
    return inDb + 20 * Math.log10(node.gain.value);
  }
  return -Infinity;
}

function feederDbfs(analyser) {
  var best = -Infinity;
  (analyser.__connectionsFrom || []).forEach(function (src) {
    var d = nodeOutDbfs(src);
    if (d > best) {
      best = d;
    }
  });
  return best;
}

function makeAnalyserNode() {
  var node = makeBaseNode('AnalyserNode');
  node.fftSize = 2048;
  node.smoothingTimeConstant = 0.8;
  node.minDecibels = -100;
  node.maxDecibels = -30;
  // Both reads derive from the node(s) feeding THIS analyser: time data
  // is a square wave whose |peak| equals the feeder's level (so peakDb
  // is exact), frequency data is FLAT across bins at the same level on
  // the analyser's byte scale (honest band energy that can never read as
  // a "rising" howl — trips here come from the peak rule only).
  node.getFloatTimeDomainData = function (buf) {
    var db = feederDbfs(node);
    var amp = db === -Infinity ? 0 : Math.pow(10, db / 20);
    for (var i = 0; i < buf.length; i++) {
      buf[i] = i % 64 < 32 ? amp : -amp;
    }
  };
  node.getByteFrequencyData = function (buf) {
    var db = feederDbfs(node);
    var b = db === -Infinity
      ? 0
      : (255 * (db - node.minDecibels)) / (node.maxDecibels - node.minDecibels);
    b = Math.round(b < 0 ? 0 : b > 255 ? 255 : b);
    for (var j = 0; j < buf.length; j++) {
      buf[j] = b;
    }
  };
  return node;
}

// ----------------------------------------------------------------------
// Minimal DOM stub — just enough for meter-taps.js's JS-created watchdog
// alert (#chain-canvas lookup, element creation, appendChild /
// removeChild, class-name querySelector, click listeners so the test can
// press the Restore button exactly like a human).
// ----------------------------------------------------------------------
function makeElement(tag) {
  var el = {
    tagName: tag,
    type: '',
    id: '',
    className: '',
    textContent: '',
    parentNode: null,
    children: [],
    __listeners: {},
    setAttribute: function (name, value) {
      el['__attr_' + name] = value;
    },
    appendChild: function (child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    insertBefore: function (child, ref) {
      child.parentNode = el;
      var idx = el.children.indexOf(ref);
      if (idx === -1) {
        el.children.push(child);
      } else {
        el.children.splice(idx, 0, child);
      }
      return child;
    },
    removeChild: function (child) {
      var idx = el.children.indexOf(child);
      if (idx !== -1) {
        el.children.splice(idx, 1);
      }
      child.parentNode = null;
      return child;
    },
    addEventListener: function (type, fn) {
      (el.__listeners[type] = el.__listeners[type] || []).push(fn);
    },
    __fire: function (type) {
      (el.__listeners[type] || []).forEach(function (fn) {
        fn();
      });
    },
    // Only the selector meter-taps.js actually uses on its alert.
    querySelector: function (selector) {
      if (selector.charAt(0) === '.') {
        var cls = selector.slice(1);
        for (var i = 0; i < el.children.length; i++) {
          if (el.children[i].className === cls) {
            return el.children[i];
          }
        }
      }
      return null;
    },
    querySelectorAll: function () {
      return [];
    }
  };
  return el;
}

// ----------------------------------------------------------------------
// The sandbox: a vm context whose global IS `window`, with host timers,
// a manual rAF queue, and the DOM stub above. The engine stub reports a
// live 48 kHz context + source (the harness "starts" it before any src
// file is asked to build).
// ----------------------------------------------------------------------
var rafQueue = [];
var createdAnalysers = [];
var createdGains = [];
var meterFeeds = [];

function createSandbox() {
  var canvasEl = makeElement('div');
  canvasEl.id = 'chain-canvas';
  var destination = makeBaseNode('AudioDestinationNode');
  var sourceNode = makeBaseNode('MediaStreamAudioSourceNode');

  var sandbox = {
    console: console,
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
    document: {
      getElementById: function (id) {
        return id === 'chain-canvas' ? canvasEl : null;
      },
      createElement: function (tag) {
        return makeElement(tag);
      }
    },
    requestAnimationFrame: function (fn) {
      rafQueue.push(fn);
      return rafQueue.length;
    },
    cancelAnimationFrame: function () {}
  };
  sandbox.window = sandbox;
  sandbox.__canvasEl = canvasEl;
  sandbox.__destination = destination;
  sandbox.__sourceNode = sourceNode;
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: {
      currentTime: 0,
      sampleRate: 48000,
      destination: destination,
      createGain: function () {
        var g = makeGainNode();
        createdGains.push(g);
        return g;
      },
      createAnalyser: function () {
        var a = makeAnalyserNode();
        createdAnalysers.push(a);
        return a;
      }
    },
    sourceNode: sourceNode
  };
  // Meters stub: record every feed so the OUT METER's tap point is
  // assertable, not just the detector's.
  sandbox.Meters = {
    feed: function (side, stats) {
      meterFeeds.push({ side: side, peakDb: stats.peakDb, rmsDb: stats.rmsDb });
    },
    setEngineState: function () {},
    reset: function () {}
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// Drive the real rAF loop by hand: each pumped timestamp runs one real
// frame() pass (which re-schedules the next frame, same as a browser).
var tsCursor = 0;

function pumpFrames(count, stepMs) {
  for (var i = 0; i < count; i++) {
    if (rafQueue.length === 0) {
      throw new Error(
        'test bug: the rAF loop stopped scheduling frames (a stub threw inside frame())'
      );
    }
    var fn = rafQueue.shift();
    tsCursor += stepMs;
    fn(tsCursor);
  }
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/audio-bypass.js');
  loadSrc(sandbox, 'src/meter-taps.js');

  var AG = sandbox.AudioGraph;
  var AB = sandbox.AudioBypass;
  var MT = sandbox.MeterTaps;

  // Real constants the scenario math derives from (never restated here).
  var ceilingDb = AG.OUTPUT_CEILING_DBFS;
  var attenDb = 20 * Math.log10(AG.OUTPUT_ATTENUATOR_LINEAR);

  // Scenario levels. VALID: program at the limiter's policy ceiling
  // (issue #2's published range top, -3 dB) as delivered at the chain
  // gate — after the real attenuator that is ~-9 dBFS at the FINAL
  // output, below the watchdog's final-output threshold. EXCESSIVE: a
  // final output 2 dB ABOVE the final-output ceiling whatever the chain
  // was doing upstream.
  var LIMITER_CEILING_DBFS = -3;
  var validGateDb = LIMITER_CEILING_DBFS;
  var validFinalDb = validGateDb + attenDb;
  var excessiveFinalDb = ceilingDb + 2;
  var excessiveGateDb = excessiveFinalDb - attenDb;

  // An automation entry "schedules an upward transition" when it is an
  // actual ramp/target (a setValueAtTime merely PINS the current value —
  // not a transition) whose target is meaningfully above mute level:
  // buildGraph's duck ramps to 0.0001 and every latch-aware target is 0,
  // while the buggy un-duck/disengage targets were 1.0.
  var MUTE_TOLERANCE = 0.001;

  function upward(entries) {
    return entries.filter(function (e) {
      return (
        (e.type === 'linearRamp' || e.type === 'setTarget') &&
        e.target > MUTE_TOLERANCE
      );
    });
  }

  // --------------------------------------------------------------------
  console.log('0. scenario sanity, derived from the real constants');
  // --------------------------------------------------------------------
  check(
    typeof MT.isTripped === 'function',
    '0: MeterTaps.isTripped is exported as a function (read-only latch probe)'
  );
  check(
    validFinalDb <= ceilingDb,
    '0: valid scenario — limiter-ceiling program after attenuation (' +
      validFinalDb.toFixed(2) + ' dBFS) is at/below the final-output ceiling (' +
      ceilingDb + ' dBFS)'
  );
  check(
    excessiveFinalDb > ceilingDb,
    '0: excessive scenario — final output (' + excessiveFinalDb.toFixed(2) +
      ' dBFS) is above the final-output ceiling (' + ceilingDb + ' dBFS)'
  );

  // main.js's start order (minus the engine itself, stubbed started):
  // bypass dry tap first, then the first chain build, then the taps.
  AB.reconnectSource();
  AG.buildGraph([]); // passthrough chain: source -> gate -> attenuator -> destination
  await settle();
  MT.onEngineStarted(); // creates the taps, starts the ONE rAF loop

  var gate = AG.getChainGate();
  var attenuator = AG.getOutputAttenuator();
  var sourceNode = sandbox.AudioEngine.sourceNode;
  var destination = sandbox.__destination;
  var analyserIn = createdAnalysers[0];
  var analyserOut = createdAnalysers[1];

  // --------------------------------------------------------------------
  console.log('A. TOPOLOGY: the OUT analyser taps the final output');
  // --------------------------------------------------------------------
  check(MT.isTripped() === false, 'A1: watchdog not tripped on a fresh start');
  check(
    createdAnalysers.length === 2,
    'A1: exactly two analysers were created (the IN and OUT taps)'
  );
  check(
    attenuator.__connectsTo(analyserOut),
    'A1: analyserOut is connected to the ATTENUATOR output (final output, after the fixed -6 dBFS)'
  );
  check(
    !gate.__connectsTo(analyserOut),
    'A1: the pre-attenuator chain gate does NOT feed the OUT tap'
  );
  check(
    analyserOut.__connectionsFrom.length === 1 &&
      analyserOut.__connectionsFrom[0] === attenuator,
    'A1: analyserOut has exactly one feeder — the attenuator'
  );
  check(
    gate.__connectsTo(attenuator) && attenuator.__connectsTo(destination),
    'A1: steady path is still chainGate -> attenuator -> destination'
  );
  check(
    approx(attenuator.gain.value, AG.OUTPUT_ATTENUATOR_LINEAR),
    'A1: attenuator gain is the real OUTPUT_ATTENUATOR_LINEAR (' +
      AG.OUTPUT_ATTENUATOR_LINEAR.toFixed(5) + ')'
  );
  check(
    sourceNode.__connectsTo(analyserIn) &&
      analyserIn.__connectionsFrom.length === 1 &&
      analyserIn.__connectionsFrom[0] === sourceNode,
    'A1: the IN tap is unchanged (still exactly off AudioEngine.sourceNode)'
  );

  // --------------------------------------------------------------------
  console.log('B. SIGNAL: valid limiter-ceiling output does NOT trip after attenuation');
  // --------------------------------------------------------------------
  sourceNode.__forcedOutDbfs = validGateDb; // mic driving the chain at ceiling level
  gate.__forcedOutDbfs = validGateDb; // the chain delivers ceiling program at the gate
  meterFeeds.length = 0;
  var snapB = gate.gain.__automation.length;
  pumpFrames(16, 50); // 800 ms of sustained valid program — >3x the peak sustain window

  check(
    MT.isTripped() === false,
    'B1: valid program (' + validFinalDb.toFixed(2) + ' dBFS final vs ' + ceilingDb +
      ' dBFS ceiling) sustained 800 ms does NOT trip'
  );
  check(
    upward(gate.gain.__automation.slice(snapB)).length === 0 &&
      !gate.gain.__automation
        .slice(snapB)
        .some(function (e) {
          return e.type === 'setTarget' && e.target === 0;
        }),
    'B1: no mute was scheduled (gate automation untouched by the watchdog)'
  );
  var outFeeds = meterFeeds.filter(function (f) {
    return f.side === 'out';
  });
  check(
    outFeeds.length > 0 && approx(outFeeds[outFeeds.length - 1].peakDb, validFinalDb, 1e-3),
    'B1: the OUT METER paints the final-output tap too (last OUT feed peak ' +
      (outFeeds.length ? outFeeds[outFeeds.length - 1].peakDb.toFixed(2) : 'none') +
      ' dBFS ~= ' + validFinalDb.toFixed(2) + ' dBFS post-attenuation)'
  );

  // --------------------------------------------------------------------
  console.log('C. SIGNAL: genuinely excessive FINAL output DOES trip and latch');
  // --------------------------------------------------------------------
  gate.__forcedOutDbfs = excessiveGateDb; // final point now reads ceiling + 2 dB
  meterFeeds.length = 0;
  var snapC = gate.gain.__automation.length;
  pumpFrames(16, 50);

  check(MT.isTripped() === true, 'C1: watchdog TRIPPED on sustained above-ceiling final output');
  check(
    gate.gain.__automation
      .slice(snapC)
      .some(function (e) {
        return e.type === 'setTarget' && e.target === 0;
      }),
    'C1: the trip applied the chain-gate 0-ramp (setTargetAtTime mute)'
  );
  var alertEl = sandbox.__canvasEl.children.filter(function (c) {
    return c.id === 'watchdog-alert';
  })[0];
  check(!!alertEl, 'C1: the watchdog alert element was created');
  var restoreBtn = alertEl
    ? alertEl.children.filter(function (c) {
        return String(c.tagName).toUpperCase() === 'BUTTON';
      })[0]
    : null;
  check(
    !!restoreBtn && restoreBtn.textContent === 'Restore output',
    'C1: the alert carries the human Restore output button'
  );

  // --------------------------------------------------------------------
  console.log('D. LATCH: a graph rebuild schedules no upward gate ramp while tripped');
  // --------------------------------------------------------------------
  var snapD = gate.gain.__automation.length;
  AG.buildGraph([]); // rebuild while the latch holds
  await settle();
  var sinceD = gate.gain.__automation.slice(snapD);

  check(MT.isTripped() === true, 'D1: still tripped after the rebuild');
  check(
    sinceD.length > 0 && upward(sinceD).length === 0,
    'D1: rebuild duck/un-duck scheduled NO upward ramp while latched (all targets <= mute level)'
  );
  check(
    sinceD.some(function (e) {
      return e.type === 'linearRamp' && e.target === 0;
    }),
    'D1: the rebuild un-duck actively targeted the mute level (0), not Bypass-derived 1.0'
  );

  // --------------------------------------------------------------------
  console.log('E. LATCH: Bypass engage/disengage while tripped');
  // --------------------------------------------------------------------
  // The bypass dry gain is identified structurally: the GainNode fed by
  // sourceNode and feeding destination (the chain gate feeds the
  // attenuator, the attenuator is fed by the gate — only the bypass gain
  // matches).
  var bypassGain = createdGains.filter(function (g) {
    return g.__connectionsFrom.indexOf(sourceNode) !== -1 &&
      g.__connectionsTo.indexOf(destination) !== -1;
  })[0];
  check(!!bypassGain, 'E1: found the bypass dry-path gain node');

  var snapE = gate.gain.__automation.length;
  AB.engage();
  check(AB.isEngaged() === true, 'E1: bypass engaged while latched');
  check(
    upward(gate.gain.__automation.slice(snapE)).length === 0,
    'E1: engage schedules no upward chain-gate ramp (its target 0 is mute-consistent)'
  );
  check(
    !!bypassGain &&
      bypassGain.gain.__automation.some(function (e) {
        return e.type === 'linearRamp' && e.target === 1;
      }),
    'E1: the DRY path still opened (bypass remains the operator escape while latched)'
  );

  var snapE2 = gate.gain.__automation.length;
  AB.disengage();
  check(AB.isEngaged() === false, 'E2: bypass disengaged while latched');
  check(
    upward(gate.gain.__automation.slice(snapE2)).length === 0,
    'E2: DISENGAGE scheduled no upward chain-gate ramp while latched (gate held at mute, not ramped to 1)'
  );
  check(
    !!bypassGain &&
      bypassGain.gain.__automation
        .slice()
        .reverse()
        .some(function (e) {
          return e.type === 'linearRamp' && e.target === 0;
        }),
    'E2: the dry path closed on disengage (that ramp is Bypass\'s own)'
  );
  check(MT.isTripped() === true, 'E2: still tripped after bypass cycling');

  // --------------------------------------------------------------------
  console.log('F. LATCH: isTripped is read-only — assignment cannot change the latch');
  // --------------------------------------------------------------------
  // Let the defend loop observe the current (muted) value first, then
  // sabotage the exported property and climb the gate out-of-band: the
  // defend-the-mute backstop firing proves the INTERNAL latch held.
  pumpFrames(1, 50);
  var realIsTripped = MT.isTripped;
  MT.isTripped = function () {
    return false;
  };
  var snapF = gate.gain.__automation.length;
  gate.gain.value = 0.9; // a foreign writer climbing the gate, ignoring the API
  pumpFrames(1, 50);

  check(
    gate.gain.__automation
      .slice(snapF)
      .some(function (e) {
        return e.type === 'setTarget' && e.target === 0;
      }),
    'F1: with MeterTaps.isTripped overwritten, the latch STILL held — the defend loop re-applied the 0-ramp'
  );
  MT.isTripped = realIsTripped; // repair the property
  check(
    typeof realIsTripped === 'function' && realIsTripped() === true,
    'F1: the real probe still reports tripped — assignment changed only the property, never the latch'
  );
  gate.gain.value = 0; // let the mute stand for the restore check

  // --------------------------------------------------------------------
  console.log('G. RESTORE: only the human button reopens output');
  // --------------------------------------------------------------------
  var snapG = gate.gain.__automation.length;
  if (restoreBtn) {
    restoreBtn.__fire('click'); // exactly what a human press runs
  }
  check(MT.isTripped() === false, 'G1: restore cleared the latch');
  check(
    gate.gain.__automation
      .slice(snapG)
      .some(function (e) {
        return e.type === 'setTarget' && e.target === 1;
      }),
    'G1: restore ramped the chain gate back up (the ONLY upward transition after a trip)'
  );
  check(
    sandbox.__canvasEl.children.filter(function (c) {
      return c.id === 'watchdog-alert';
    }).length === 0,
    'G1: the alert was removed'
  );

  gate.__forcedOutDbfs = validGateDb; // valid program again
  pumpFrames(12, 50);
  check(
    MT.isTripped() === false,
    'G1: subsequent valid program does not re-trip'
  );

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: watchdog taps the final output and the latch holds (issue #3)');
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
