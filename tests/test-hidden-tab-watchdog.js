// Test for issue #7 — [P1] Keep watchdog protection active when the
// tab is hidden.
//
// The bug: the safety watchdog sampled only inside the ONE rAF loop
// (src/meter-taps.js), and browsers stop rAF when a tab is hidden while
// native Web Audio keeps processing — the watchdog went blind exactly
// when an unattended (backgrounded) karaoke rig could howl.
//
// The fix under test (see the #7 section in src/meter-taps.js's header
// and src/watchdog-worklet.js):
//   - An AudioWorkletProcessor ('watchdog-tap', src/watchdog-worklet.js)
//     taps the output attenuator (same final-output point as #3's
//     analyserOut) and posts per-block peaks to the main thread — the
//     audio thread never pauses for visibility.
//   - A setInterval latch makes the trip decision while the page is
//     hidden (or the rAF loop stalled): peak ladder from the worklet's
//     messages, howl band from analyserOut's audio-thread-filled
//     buffer. Same thresholds and latch; reduced ~1 s hidden cadence,
//     documented.
//   - Fallback (addModule missing/failed): rAF-only watchdog + the
//     interim mitigation — a visibilitychange operator warning while
//     hidden with the engine live.
//   - rAF keeps only the METERS (and the visible-cadence watchdog pass
//     for #3 compatibility); decisions must occur with rAF stopped.
//   - Human-only restore is untouched on both paths.
//
// Same committed-test convention as tests/test-watchdog-tap-and-latch.js
// (which this file deliberately reuses as its stub skeleton): ZERO
// dependencies, stub `window` + the minimal Web Audio/DOM surface, load
// the REAL src files (fs.readFileSync + vm.runInContext), drive rAF /
// setInterval / the worklet message port / visibilitychange by hand,
// "  ok - " prints, exit 0/1.
//
// The REAL src/watchdog-worklet.js processor is also executed directly
// in its own vm context (a stubbed AudioWorkletGlobalScope) for the
// passthrough + message-throttling checks.
//
// Run from a clean clone:  node tests/test-hidden-tab-watchdog.js

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

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// ----------------------------------------------------------------------
// Web Audio stubs (same signal model as test-watchdog-tap-and-latch.js:
// nodes carry levels, analysers synthesize windows from their feeders;
// this file adds a __forcedBandByte override so the howl detector's
// input can be driven as a RISING band while hidden).
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
    }
  };
  return param;
}

function makeBaseNode(typeName) {
  var node = {
    __nodeTypeName: typeName,
    __connectionsTo: [],
    __connectionsFrom: [],
    __forcedOutDbfs: undefined,
    connect: function (dest) {
      node.__connectionsTo.push(dest);
      if (dest && dest.__connectionsFrom) {
        dest.__connectionsFrom.push(node);
      }
    },
    disconnect: function () {
      node.__connectionsTo = [];
      node.__connectionsFrom.forEach(function (d) {
        var j = d.__connectionsFrom.indexOf(node);
        if (j !== -1) {
          d.__connectionsFrom.splice(j, 1);
        }
      });
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
  node.__forcedBandByte = undefined; // this test's howl-drive override
  node.getFloatTimeDomainData = function (buf) {
    var db = feederDbfs(node);
    var amp = db === -Infinity ? 0 : Math.pow(10, db / 20);
    for (var i = 0; i < buf.length; i++) {
      buf[i] = i % 64 < 32 ? amp : -amp;
    }
  };
  node.getByteFrequencyData = function (buf) {
    var b;
    if (typeof node.__forcedBandByte === 'number') {
      b = node.__forcedBandByte;
    } else {
      var db = feederDbfs(node);
      b = db === -Infinity
        ? 0
        : (255 * (db - node.minDecibels)) / (node.maxDecibels - node.minDecibels);
      b = Math.round(b < 0 ? 0 : b > 255 ? 255 : b);
    }
    for (var j = 0; j < buf.length; j++) {
      buf[j] = b;
    }
  };
  return node;
}

// ----------------------------------------------------------------------
// DOM stub (same shape as test-watchdog-tap-and-latch.js).
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
    getAttribute: function (name) {
      return el['__attr_' + name];
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
// The sandbox. `opts.worklet`: 'ok' (addModule resolves), 'fail'
// (addModule rejects), 'no-constructor' (audioWorklet exists but the
// window-global AudioWorkletNode constructor does not), or 'absent' (no
// audioWorklet at all). The fixture mirrors the browser API: audioWorklet
// belongs to the context while AudioWorkletNode belongs to window. The
// interval latch is a CAPTURED callback the harness fires by hand (the hidden
// browser cadence ~1 s is simulated with a controllable performance.now
// cursor, which is what meter-taps's own now() reads).
// ----------------------------------------------------------------------
function createSandbox(opts) {
  var canvasEl = makeElement('div');
  canvasEl.id = 'chain-canvas';
  var destination = makeBaseNode('AudioDestinationNode');
  var sourceNode = makeBaseNode('MediaStreamAudioSourceNode');

  var rafQueue = [];
  var createdAnalysers = [];
  var createdGains = [];
  var createdWorklets = [];
  var addModuleUrls = [];
  var intervalFns = [];
  var visListeners = [];
  var perfNow = 0;
  var meterFeeds = [];

  var ctx = {
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
  };
  if (opts.worklet === 'ok' || opts.worklet === 'fail' || opts.worklet === 'no-constructor') {
    ctx.audioWorklet = {
      addModule: function (url) {
        addModuleUrls.push(url);
        return opts.worklet === 'fail' ? Promise.reject(new Error('stub addModule failure')) : Promise.resolve();
      }
    };
  }

  function AudioWorkletNode(c, name, nodeOpts) {
    var n = makeBaseNode('AudioWorkletNode');
    n.__processorName = name;
    n.__nodeOpts = nodeOpts;
    n.port = { onmessage: null };
    n.port.__deliver = function (msg) {
      if (typeof n.port.onmessage === 'function') {
        n.port.onmessage({ data: msg });
      }
    };
    createdWorklets.push(n);
    return n;
  }

  var sandbox = {
    console: console,
    setTimeout: function (fn, ms) {
      return setTimeout(fn, ms);
    },
    clearTimeout: function (id) {
      return clearTimeout(id);
    },
    setInterval: function (fn) {
      intervalFns.push(fn);
      return intervalFns.length;
    },
    clearInterval: function () {},
    performance: {
      now: function () {
        return perfNow;
      }
    },
    document: {
      hidden: false,
      addEventListener: function (type, fn) {
        if (type === 'visibilitychange') {
          visListeners.push(fn);
        }
      },
      removeEventListener: function () {},
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
  if (opts.worklet === 'ok' || opts.worklet === 'fail') {
    sandbox.AudioWorkletNode = AudioWorkletNode;
  }
  sandbox.__audioContext = ctx;
  sandbox.__canvasEl = canvasEl;
  sandbox.__destination = destination;
  sandbox.__sourceNode = sourceNode;
  sandbox.__rafQueue = rafQueue;
  sandbox.__createdAnalysers = createdAnalysers;
  sandbox.__createdWorklets = createdWorklets;
  sandbox.__addModuleUrls = addModuleUrls;
  sandbox.__intervalFns = intervalFns;
  sandbox.__visListeners = visListeners;
  sandbox.__meterFeeds = meterFeeds;
  sandbox.__setPerfNow = function (v) {
    perfNow = v;
  };
  sandbox.__fireVisibility = function (hidden) {
    sandbox.document.hidden = hidden;
    visListeners.slice().forEach(function (fn) {
      fn();
    });
  };
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: ctx,
    sourceNode: sourceNode
  };
  sandbox.Meters = {
    feed: function (side, stats) {
      meterFeeds.push({ side: side, peakDb: stats.peakDb });
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

/** Boot the app the way main.js does (bypass dry tap + first chain
 *  build + taps), settle the deferred rewire, then let the worklet
 *  promise chain run. Returns the shared handles. */
async function boot(sandbox) {
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/audio-bypass.js');
  loadSrc(sandbox, 'src/meter-taps.js');
  sandbox.AudioBypass.reconnectSource();
  sandbox.AudioGraph.buildGraph([]);
  await sleep(60);
  sandbox.MeterTaps.onEngineStarted();
  await sleep(0); // addModule promise chain (or its rejection handler)
  return {
    AG: sandbox.AudioGraph,
    MT: sandbox.MeterTaps,
    gate: sandbox.AudioGraph.getChainGate(),
    attenuator: sandbox.AudioGraph.getOutputAttenuator()
  };
}

function findEl(sandbox, id) {
  return sandbox.__canvasEl.children.filter(function (c) {
    return c.id === id;
  })[0];
}

function tick(sandbox) {
  if (sandbox.__intervalFns.length === 0) {
    throw new Error('test bug: no watchdog interval was installed (worklet mode never went live?)');
  }
  sandbox.__intervalFns[0]();
}

function linear(db) {
  return Math.pow(10, db / 20);
}

/** The alert element's visible text lives in its .watchdog-alert-text
 *  span child (the stub's textContent does not aggregate children). */
function alertText(el) {
  if (!el) {
    return '';
  }
  var span = el.children.filter(function (c) {
    return c.className === 'watchdog-alert-text';
  })[0];
  return span ? span.textContent : '';
}

// ======================================================================
// G. THE REAL PROCESSOR: passthrough + throttled messages
// ======================================================================
function testProcessor() {
  // A stubbed AudioWorkletGlobalScope. The REAL module file runs in it;
  // the registered class is instantiated and process() is called by
  // hand with controlled inputs/outputs.
  var posted = [];
  var registered = {};
  var scope = {
    console: console,
    AudioWorkletProcessor: function () {},
    registerProcessor: function (name, ctor) {
      registered[name] = ctor;
    },
    currentTime: 7.5
  };
  scope.AudioWorkletProcessor.prototype.port = null;
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/watchdog-worklet.js'), 'utf8'), scope, {
    filename: 'src/watchdog-worklet.js'
  });

  check(typeof registered['watchdog-tap'] === 'function', 'G1: the module registers the \'watchdog-tap\' processor');

  var port = {
    onmessage: null,
    postMessage: function (m) {
      posted.push(m);
    }
  };
  var inst = new registered['watchdog-tap']();
  inst.port = port; // the harness's port (the real base class owns it)

  // One block of 128 samples: a known waveform (peak 0.75 at idx 3,
  // RMS of a two-level square).
  var inL = new Float32Array(128);
  var inR = new Float32Array(128);
  for (var i = 0; i < 128; i++) {
    inL[i] = i === 3 ? 0.75 : i < 64 ? 0.25 : -0.25;
    inR[i] = inL[i];
  }
  var outL = new Float32Array(128);
  var outR = new Float32Array(128);

  for (var b = 0; b < 8; b++) {
    var keepAlive = inst.process([[inL, inR]], [[outL, outR]]);
    if (b === 0) {
      check(keepAlive === true, 'G1: process() returns true (a silent tap never idles out)');
    }
  }

  var passthroughOk = true;
  for (var s = 0; s < 128; s++) {
    if (outL[s] !== inL[s] || outR[s] !== inR[s]) {
      passthroughOk = false;
    }
  }
  check(passthroughOk, 'G1: input is copied to output UNMODIFIED, channel for channel (passthrough tap)');
  check(
    posted.length === 1 && posted[0].type === 'watchdog-block' && Math.abs(posted[0].peak - 0.75) < 1e-9,
    'G1: after 8 blocks exactly one throttled message posted with the block peak (got ' +
      (posted.length ? posted[0].peak : 'none') + ')'
  );
  var wantRms = Math.sqrt((0.75 * 0.75 + 127 * 0.0625) / 128);
  check(
    posted.length === 1 && Math.abs(posted[0].rms - wantRms) < 1e-9,
    'G1: the posted RMS matches the accumulated samples'
  );
  check(posted.length === 1 && posted[0].t === 7.5, 'G1: the message carries the worklet clock');

  function measureChannels(blocks, outputChannels) {
    var messages = [];
    var processor = new registered['watchdog-tap']();
    processor.port = { postMessage: function (message) { messages.push(message); } };
    var lastOutput;
    blocks.forEach(function (channels) {
      lastOutput = [];
      for (var channel = 0; channel < outputChannels; channel++) {
        lastOutput.push(new Float32Array(128));
      }
      processor.process([channels], [lastOutput]);
    });
    return { messages: messages, output: lastOutput, processor: processor };
  }

  var silence = new Float32Array(128);
  var inverse = Float32Array.from(inL, function (sample) { return -sample; });
  var rightOnly = measureChannels(Array(8).fill([silence, inL]), 1);
  check(rightOnly.messages.length === 1 && rightOnly.messages[0].peak === 0.75 &&
    Math.abs(rightOnly.messages[0].rms - wantRms) < 1e-9,
    'G2: right-only peak and RMS match mono, including when the silent tap has only one output channel');
  var opposite = measureChannels(Array(8).fill([inL, inverse]), 2);
  check(opposite.messages.length === 1 && opposite.messages[0].peak === 0.75 &&
    Math.abs(opposite.messages[0].rms - wantRms) < 1e-9,
    'G2: opposite-polarity channels retain their peak and RMS without cancellation');
  check(opposite.output[0].every(function (sample, index) {
    return sample === inL[index] && opposite.output[1][index] === inverse[index];
  }), 'G2: stereo polarity and channel alignment survive passthrough unchanged');

  // The channels trade places halfway through the reporting window.
  // Each contains four loud and four silent blocks; taking the loudest
  // channel every block would incorrectly report a continuously loud RMS.
  var alternatingBlocks = Array(4).fill([inL, silence]).concat(Array(4).fill([silence, inL]));
  var alternating = measureChannels(alternatingBlocks, 2);
  check(alternating.messages.length === 1 && alternating.messages[0].peak === 0.75 &&
    Math.abs(alternating.messages[0].rms - wantRms / Math.sqrt(2)) < 1e-9,
    'G2: RMS is the strongest channel over the whole reporting window, not a per-block channel splice');

  // A missing channel contributes silence for its missing render quanta.
  var disappearingBlocks = Array(4).fill([silence, inL]).concat(Array(4).fill([silence]));
  var disappearing = measureChannels(disappearingBlocks, 2);
  check(disappearing.messages.length === 1 &&
    Math.abs(disappearing.messages[0].rms - wantRms / Math.sqrt(2)) < 1e-9,
    'G2: channel-count changes retain elapsed-time weighting in the reported RMS');
  var noInput = measureChannels(Array(8).fill([]), 1);
  check(noInput.messages.length === 1 && noInput.messages[0].peak === 0 && noInput.messages[0].rms === 0 &&
    noInput.messages[0].blocks === 8,
    'G2: absent input still posts zero peak/RMS at the existing eight-block cadence');

  var resetMessages = [];
  rightOnly.processor.port = { postMessage: function (message) { resetMessages.push(message); } };
  for (var resetBlock = 0; resetBlock < 8; resetBlock++) {
    rightOnly.processor.process([[silence, silence]], [[new Float32Array(128)]]);
  }
  check(resetMessages.length === 1 && resetMessages[0].peak === 0 && resetMessages[0].rms === 0,
    'G2: per-channel peak and RMS history reset after every report');
}

// ======================================================================
// A–D. WORKLET MODE: protection live while hidden, rAF NOT involved
// ======================================================================
async function testWorkletMode() {
  var sandbox = createSandbox({ worklet: 'ok' });
  var handles = await boot(sandbox);
  var AG = handles.AG;
  var MT = handles.MT;
  var gate = handles.gate;
  var attenuator = handles.attenuator;
  var ceilingDb = AG.OUTPUT_CEILING_DBFS;
  var hotLinear = linear(ceilingDb + 2); // final output 2 dB over the ceiling
  var validLinear = linear(ceilingDb - 3); // limiter-level post-attenuation

  // ------------------------------------------------------------------
  console.log('A. WORKLET WIRING: the audio-thread tap is live');
  // ------------------------------------------------------------------
  check(
    sandbox.__audioContext.AudioWorkletNode === undefined &&
      typeof sandbox.AudioWorkletNode === 'function',
    'A1: fixture matches Chrome API shape (constructor is window-global, not an AudioContext property)'
  );
  check(
    sandbox.__addModuleUrls.length === 1 && sandbox.__addModuleUrls[0] === 'src/watchdog-worklet.js',
    'A1: addModule loaded the worklet by page-relative URL (src/watchdog-worklet.js)'
  );
  check(sandbox.__createdWorklets.length === 1, 'A1: one AudioWorkletNode was created');
  var wnode = sandbox.__createdWorklets[0];
  var tail = wnode.__connectionsTo[0];
  check(
    attenuator.__connectsTo(wnode) && wnode.__connectsTo(tail) && tail.__connectsTo(sandbox.__destination),
    'A1: silent side-tap wired attenuator -> worklet -> zero-gain tail -> destination'
  );
  check(
    tail.__nodeTypeName === 'GainNode' && tail.gain.value === 0,
    'A1: the worklet passthrough copy is muted at the tail (destination hears ONE copy of the program)'
  );
  check(
    attenuator.__connectsTo(sandbox.__createdAnalysers[1]) &&
      sandbox.__createdAnalysers[1].__connectionsFrom.length === 1,
    'A1: analyserOut still taps the attenuator exactly once (issue #3 topology untouched)'
  );

  // ------------------------------------------------------------------
  console.log('B. SUSTAINED HOT SIGNAL WHILE HIDDEN (audio still running)');
  // ------------------------------------------------------------------
  sandbox.__fireVisibility(true); // operator switches tabs — rAF now stops
  var rafScheduled = sandbox.__rafQueue.length; // the loop is scheduled...
  sandbox.__meterFeeds.length = 0;
  var snap = gate.gain.__automation.length;
  var t = 0;
  for (var i = 0; i < 4; i++) {
    t += 1000; // the honest hidden-tab interval cadence (>= ~1 s)
    sandbox.__setPerfNow(t);
    wnode.port.__deliver({ type: 'watchdog-block', peak: hotLinear, rms: hotLinear * 0.7, blocks: 8, t: t / 1000 });
    tick(sandbox);
  }

  check(MT.isTripped() === true, 'B1: sustained above-ceiling output WHILE HIDDEN trips (audio thread kept reporting)');
  check(
    gate.gain.__automation.slice(snap).some(function (e) {
      return e.type === 'setTarget' && e.target === 0;
    }),
    'B1: the hidden trip applied the chain-gate 0-ramp (mute)'
  );
  var alertEl = findEl(sandbox, 'watchdog-alert');
  check(
    !!alertEl && alertText(alertEl).indexOf('tab hidden') !== -1,
    'B1: the alert states the trip happened while the tab was hidden'
  );
  var restoreBtn = alertEl
    ? alertEl.children.filter(function (c) {
        return String(c.tagName).toUpperCase() === 'BUTTON';
      })[0]
    : null;
  check(!!restoreBtn, 'B1: the hidden trip alert carries the human Restore output button');

  // ------------------------------------------------------------------
  console.log('C. rAF IS NOT DRIVING WATCHDOG DECISIONS');
  // ------------------------------------------------------------------
  check(
    rafScheduled > 0 && sandbox.__rafQueue.length === rafScheduled,
    'C1: the rAF loop was scheduled but NEVER pumped (hidden tab) — yet the decisions above still occurred'
  );
  check(sandbox.__meterFeeds.length === 0, 'C1: meters received nothing (rAF stopped) — metering and protection are decoupled');
  check(findEl(sandbox, 'watchdog-hidden-warning') === undefined, 'C1: NO fallback warning in worklet mode (protection is active)');

  // ------------------------------------------------------------------
  console.log('D. VALID SIGNAL WHILE HIDDEN + HUMAN-ONLY RESTORE (#3 regression)');
  // ------------------------------------------------------------------
  // Restore by button press (the ONLY path), then keep VALID
  // limiter-level post-attenuation program running hidden — no trip.
  var snapD = gate.gain.__automation.length;
  if (restoreBtn) {
    restoreBtn.__fire('click');
  }
  check(MT.isTripped() === false, 'D1: the human Restore button cleared the hidden-mode latch');
  check(
    gate.gain.__automation.slice(snapD).some(function (e) {
      return e.type === 'setTarget' && e.target === 1;
    }),
    'D1: restore ramped the gate back up (the only upward transition — human-only, #3 semantics intact)'
  );
  check(findEl(sandbox, 'watchdog-alert') === undefined, 'D1: the alert was removed on restore');

  for (var j = 0; j < 12; j++) {
    t += 1000;
    sandbox.__setPerfNow(t);
    wnode.port.__deliver({ type: 'watchdog-block', peak: validLinear, rms: validLinear * 0.7, blocks: 8, t: t / 1000 });
    tick(sandbox);
  }
  check(MT.isTripped() === false, 'D1: 12 s of valid limiter-level output WHILE HIDDEN does NOT trip');

  // ------------------------------------------------------------------
  console.log('E. RISING HOWL WHILE HIDDEN (analyser buffers still audio-filled)');
  // ------------------------------------------------------------------
  var sandbox2 = createSandbox({ worklet: 'ok' });
  var h2 = await boot(sandbox2);
  var analyserOut = sandbox2.__createdAnalysers[1];
  sandbox2.__fireVisibility(true);
  var t2 = 0;
  // 10 hidden ticks of a monotonically rising 1–8 kHz band (values above
  // the −60 dB floor byte ≈ 146 on the stub scale), with the peak path
  // perfectly legal — only the howl detector can trip.
  for (var k = 1; k <= 10; k++) {
    t2 += 1000;
    sandbox2.__setPerfNow(t2);
    analyserOut.__forcedBandByte = 150 + k * 8; // 158 → 230, strictly rising
    sandbox2.__createdWorklets[0].port.__deliver({
      type: 'watchdog-block', peak: linear(-9), rms: 0.1, blocks: 8, t: t2 / 1000
    });
    tick(sandbox2);
  }
  var howlAlert = findEl(sandbox2, 'watchdog-alert');
  check(h2.MT.isTripped() === true, 'E1: a rising 1–8 kHz howl WHILE HIDDEN trips (reduced-cadence bar)');
  check(
    !!howlAlert && alertText(howlAlert).indexOf('howling feedback') !== -1,
    'E1: the hidden trip names the howl reason'
  );

  // Flat band while hidden must NOT trip (the reduced bar still
  // requires monotonic rise + the magnitude floor).
  var sandbox3 = createSandbox({ worklet: 'ok' });
  var h3 = await boot(sandbox3);
  sandbox3.__fireVisibility(true);
  var analyserOut3 = sandbox3.__createdAnalysers[1];
  var t3 = 0;
  for (var m = 0; m < 12; m++) {
    t3 += 1000;
    sandbox3.__setPerfNow(t3);
    analyserOut3.__forcedBandByte = 200; // loud but FLAT
    sandbox3.__createdWorklets[0].port.__deliver({
      type: 'watchdog-block', peak: linear(-9), rms: 0.1, blocks: 8, t: t3 / 1000
    });
    tick(sandbox3);
  }
  check(h3.MT.isTripped() === false, 'E1: a flat (non-rising) band while hidden does NOT trip');

  // ------------------------------------------------------------------
  console.log('F. VISIBLE BUT STALLED rAF: the interval latch still decides');
  // ------------------------------------------------------------------
  var sandbox4 = createSandbox({ worklet: 'ok' });
  var h4 = await boot(sandbox4);
  // Visible page, but the loop stalled (e.g. the frame() error path or a
  // wedged renderer): performance.now races far past the last frame.
  sandbox4.__setPerfNow(5000 + 1); // lastFrameAt was set at engine start (perf 0 → stall)
  sandbox4.__createdWorklets[0].port.__deliver({
    type: 'watchdog-block', peak: hotLinear, rms: 0.5, blocks: 8, t: 5
  });
  tick(sandbox4);
  sandbox4.__setPerfNow(6000);
  sandbox4.__createdWorklets[0].port.__deliver({
    type: 'watchdog-block', peak: hotLinear, rms: 0.5, blocks: 8, t: 6
  });
  tick(sandbox4);
  check(h4.MT.isTripped() === true, 'F1: a sustained hot signal with the rAF loop STALLED (visible) still trips via the interval latch');
}

// ======================================================================
// H. FALLBACK MODE: addModule fails -> rAF-only watchdog + warning
// ======================================================================
async function testFallbackMode(workletOpt, label) {
  var sandbox = createSandbox({ worklet: workletOpt });
  var handles = await boot(sandbox);
  var MT = handles.MT;
  var gate = handles.gate;

  check(sandbox.__createdWorklets.length === 0, 'H1(' + label + '): no AudioWorkletNode was created');
  check(
    sandbox.__intervalFns.length === 0,
    'H1(' + label + '): the interval latch is NOT installed in fallback mode (rAF-only, documented)'
  );

  // Interim mitigation: hidden while live -> warning; visible -> cleared.
  sandbox.__fireVisibility(true);
  var warn = findEl(sandbox, 'watchdog-hidden-warning');
  check(
    !!warn && alertText(warn).indexOf('Keep this tab visible') !== -1,
    'H1(' + label + '): going hidden while live surfaces the non-modal operator warning'
  );
  check(
    !!warn && warn.getAttribute('role') === 'status',
    'H1(' + label + '): the warning is role=status (non-alarming vocabulary, not the trip alert)'
  );
  sandbox.__fireVisibility(false);
  check(findEl(sandbox, 'watchdog-hidden-warning') === undefined, 'H1(' + label + '): becoming visible again clears the warning');

  // #3 regression on the fallback path: the rAF watchdog still trips
  // and the human-only restore still works (visible, pumped frames).
  // Signal model: the attenuator DERIVES final = gate + atten, so force
  // the GATE at (ceiling + 2 − atten) to put the FINAL output 2 dB over.
  var attenDb = 20 * Math.log10(handles.AG.OUTPUT_ATTENUATOR_LINEAR);
  handles.gate.__forcedOutDbfs = handles.AG.OUTPUT_CEILING_DBFS + 2 - attenDb;
  var tsCursor = 0;
  var snap = gate.gain.__automation.length;
  for (var i = 0; i < 16 && !MT.isTripped(); i++) {
    var fn = sandbox.__rafQueue.shift();
    tsCursor += 50;
    fn(tsCursor);
  }
  check(MT.isTripped() === true, 'H1(' + label + '): fallback rAF watchdog still trips on visible sustained above-ceiling output');
  check(
    gate.gain.__automation.slice(snap).some(function (e) {
      return e.type === 'setTarget' && e.target === 0;
    }),
    'H1(' + label + '): the fallback trip applies the chain-gate 0-ramp'
  );
  var alertEl = findEl(sandbox, 'watchdog-alert');
  var restoreBtn = alertEl
    ? alertEl.children.filter(function (c) {
        return String(c.tagName).toUpperCase() === 'BUTTON';
      })[0]
    : null;
  var snapR = gate.gain.__automation.length;
  if (restoreBtn) {
    restoreBtn.__fire('click');
  }
  check(MT.isTripped() === false, 'H1(' + label + '): human Restore clears the fallback latch too');
  check(
    gate.gain.__automation.slice(snapR).some(function (e) {
      return e.type === 'setTarget' && e.target === 1;
    }),
    'H1(' + label + '): restore reopens the gate (human-only path intact, #3)'
  );
}

// ======================================================================
async function main() {
  testProcessor();
  await testWorkletMode();
  await testFallbackMode('fail', 'addModule-rejects');
  await testFallbackMode('no-constructor', 'no-window-AudioWorkletNode');
  await testFallbackMode('absent', 'no-audioWorklet');

  if (failures.length === 0) {
    console.log('PASS: watchdog protection stays active when the tab is hidden (issue #7)');
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
