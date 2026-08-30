// Test for issue #4 — [P1] Detect audio lifecycle failures and serialize
// device switches.
//
// The bug: the UI could remain visibly "Live" after the mic track ended
// or the AudioContext suspended (nothing listened for statechange /
// track ended / devicechange), Start stayed disabled after the first
// success (no recovery action), and two rapid mic selections could race
// — the OLDER getUserMedia resolving last replaced the newer stream while
// the selector showed the newer device.
//
// The fix under test:
//   - src/audio-engine.js forwards lifecycle events via
//     AudioEngine.onLifecycle(): AudioContext.statechange, the ACTIVE
//     track's ended/mute/unmute, and mediaDevices.devicechange; a track
//     loss tears the stream session down (tracks stopped, listeners
//     removed, sourceNode dropped) so a later Start rebuilds fresh.
//   - switchInputDevice() carries a request-GENERATION token: a
//     completion whose generation is superseded has its stream stopped +
//     discarded and rejects with a tagged {stale:true} AbortError.
//   - a full session teardown also advances that generation, so a device
//     replacement resolving after active-track loss cannot revive or
//     reconnect the stopped engine; only a later Start creates a session.
//   - src/main.js surfaces loss through the EXISTING entry-3 vocabulary
//     (setErrorStatus + setStartHint + the re-enabled Start button),
//     stops meters via MeterTaps.onEngineStopped() (#3 latch preserved),
//     auto-recovers an in-place context resume, and reconciles the
//     selector to the ACTUALLY-active device.
//
// Same committed-test convention as the rest of the suite: zero-dependency
// Node harness, stub `window`/DOM/Web Audio/browser-API surface, load the
// REAL src files in a vm sandbox, per-check "  ok - " prints, exit 0/1.
// The stubs are fully controllable: getUserMedia is a deferred-promise
// QUEUE the test resolves in ANY order (reverse-order switch), the
// AudioContext's state + statechange listeners and the tracks' ended/mute
// listeners are fired by hand, and the device list is a mutable array —
// so every scenario is deterministic.
//
// Run from a clean clone:  node tests/test-audio-lifecycle.js

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

// Microtasks + the enumerateDevices promise need one turn; 20 ms is plenty.
function settle() {
  return sleep(20);
}

// ----------------------------------------------------------------------
// DOM stub. Richer than the watchdog test's element (main.js also needs
// classList, .disabled, .value, and innerHTML as a clearing setter).
// ----------------------------------------------------------------------
function makeElement(tag) {
  var el = {
    tagName: tag,
    type: '',
    id: '',
    className: '',
    textContent: '',
    title: '',
    disabled: false,
    value: '',
    selected: false,
    parentNode: null,
    children: [],
    __listeners: {},
    classList: {
      add: function (c) {
        if (!el.classList.contains(c)) {
          el.className = el.className ? el.className + ' ' + c : c;
        }
      },
      remove: function (c) {
        var parts = el.className ? el.className.split(/\s+/) : [];
        el.className = parts.filter(function (p) { return p && p !== c; }).join(' ');
      },
      toggle: function (c, on) {
        if (on === undefined) {
          on = !el.classList.contains(c);
        }
        if (on) {
          el.classList.add(c);
        } else {
          el.classList.remove(c);
        }
      },
      contains: function (c) {
        return (' ' + el.className + ' ').indexOf(' ' + c + ' ') !== -1;
      }
    }
  };
  Object.defineProperty(el, 'innerHTML', {
    set: function () {
      el.children = []; // the only write main.js makes is the clear-children `= ''`
    },
    get: function () {
      return '';
    }
  });
  el.appendChild = function (child) {
    child.parentNode = el;
    el.children.push(child);
    return child;
  };
  el.addEventListener = function (type, fn) {
    (el.__listeners[type] = el.__listeners[type] || []).push(fn);
  };
  el.__fire = function (type, ev) {
    (el.__listeners[type] || []).slice().forEach(function (fn) {
      fn(ev || { type: type });
    });
  };
  return el;
}

// ----------------------------------------------------------------------
// Web Audio / media-device stubs. Everything the lifecycle touches is
// hand-fired: __setState drives statechange, __fire drives track events,
// fireDeviceChange drives mediaDevices.devicechange, and the getUserMedia
// queue resolves in whatever order the test chooses.
// ----------------------------------------------------------------------
var gumQueue = [];
var deviceList = [];
var deviceChangeListeners = [];
var createdContexts = [];
var lastCreatedTrack = null;

function makeTrack(deviceId) {
  var listeners = {};
  var track = {
    kind: 'audio',
    label: 'mic-' + deviceId,
    readyState: 'live',
    __deviceId: deviceId,
    __stopCalls: 0,
    getSettings: function () {
      return { deviceId: track.__deviceId };
    },
    stop: function () {
      track.__stopCalls += 1;
      track.readyState = 'ended';
    },
    addEventListener: function (type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener: function (type, fn) {
      var arr = listeners[type] || [];
      var i = arr.indexOf(fn);
      if (i !== -1) {
        arr.splice(i, 1);
      }
    },
    __fire: function (type) {
      (listeners[type] || []).slice().forEach(function (fn) {
        fn({ type: type });
      });
    }
  };
  return track;
}

function makeStream(deviceId) {
  var track = makeTrack(deviceId);
  lastCreatedTrack = track;
  var tracks = [track];
  return {
    __track: track,
    getTracks: function () {
      return tracks.slice();
    },
    getAudioTracks: function () {
      return tracks.slice();
    }
  };
}

function makeAudioContext() {
  var stateListeners = [];
  var ctx = {
    state: 'suspended',
    sampleRate: 48000,
    resume: function () {
      ctx.state = 'running';
      return Promise.resolve();
    },
    addEventListener: function (type, fn) {
      if (type === 'statechange') {
        stateListeners.push(fn);
      }
    },
    createMediaStreamSource: function (stream) {
      return {
        __stream: stream,
        __disconnects: 0,
        disconnect: function () {
          this.__disconnects += 1;
        }
      };
    },
    __setState: function (state) {
      ctx.state = state;
      stateListeners.slice().forEach(function (fn) {
        fn({ type: 'statechange' });
      });
    }
  };
  createdContexts.push(ctx);
  return ctx;
}

// The id a queued request asked for (null = Start's constraint-free call).
function requestedDeviceId(entry) {
  var c = entry.constraints || {};
  return (c.audio && c.audio.deviceId && c.audio.deviceId.exact) || null;
}

function resolveGumAt(index, deviceId) {
  var entry = gumQueue[index];
  gumQueue.splice(index, 1);
  entry.resolve(makeStream(deviceId || requestedDeviceId(entry) || 'default-mic'));
}

function rejectGumAt(index, err) {
  var entry = gumQueue[index];
  gumQueue.splice(index, 1);
  entry.reject(err);
}

function fireDeviceChange() {
  deviceChangeListeners.slice().forEach(function (fn) {
    fn({ type: 'devicechange' });
  });
}

// ----------------------------------------------------------------------
// Sandbox: DOM ids main.js wires + the sibling globals it reaches that
// the real page supplies (AudioBypass/AudioGraph unguarded; MeterTaps /
// ChainCanvas / Persistence / StatusReadouts optional — MeterTaps is
// stubbed as a RECORDER so loss paths are assertable).
// ----------------------------------------------------------------------
function createSandbox() {
  var els = {
    'start-button': makeElement('button'),
    'input-device-select': makeElement('select'),
    'status': makeElement('span'),
    'status-text': makeElement('span'),
    'start-hint': makeElement('span'),
    'bypass-toggle-button': makeElement('button')
  };
  Object.keys(els).forEach(function (id) {
    els[id].id = id;
  });

  var meterTaps = {
    started: 0,
    stopped: 0,
    switched: [],
    onEngineStarted: function () {
      meterTaps.started += 1;
    },
    onEngineStopped: function () {
      meterTaps.stopped += 1;
    },
    onDeviceSwitched: function (node) {
      meterTaps.switched.push(node);
    }
  };

  var audioBypass = {
    reconnects: 0,
    reconnectSource: function () {
      audioBypass.reconnects += 1;
    },
    isEngaged: function () {
      return false;
    }
  };

  var sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    document: {
      addEventListener: function () {},
      getElementById: function (id) {
        return els[id] || null;
      },
      createElement: function (tag) {
        return makeElement(tag);
      }
    },
    navigator: {
      mediaDevices: {
        getUserMedia: function (constraints) {
          return new Promise(function (resolve, reject) {
            gumQueue.push({ constraints: constraints, resolve: resolve, reject: reject });
          });
        },
        enumerateDevices: function () {
          return Promise.resolve(deviceList.slice());
        },
        addEventListener: function (type, fn) {
          if (type === 'devicechange') {
            deviceChangeListeners.push(fn);
          }
        }
      }
    },
    AudioContext: makeAudioContext,
    AudioBypass: audioBypass,
    AudioGraph: {
      __builds: 0,
      buildGraph: function () {
        sandbox.AudioGraph.__builds += 1;
      },
      getModel: function () {
        return [];
      }
    },
    MeterTaps: meterTaps
  };
  sandbox.window = sandbox;
  sandbox.__els = els;
  sandbox.__meterTaps = meterTaps;
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// The option values currently offered by the dropdown.
function optionValues(selectEl) {
  return selectEl.children.map(function (opt) {
    return opt.value;
  });
}

// What the selector points at: the explicit .value reconcileSelector()
// writes, else the option marked selected by populateDeviceList().
function selectorValue(selectEl) {
  if (selectEl.value) {
    return selectEl.value;
  }
  var sel = selectEl.children.filter(function (opt) {
    return opt.selected;
  })[0];
  return sel ? sel.value : '';
}

function statusText(els) {
  // Strip the demoted detail span's text by reading only the first child
  // node main.js produced: status-text holds text + optional span; the
  // stub's textContent is the concatenation, which is fine for prefix
  // checks — return it raw.
  return els['status-text'].textContent;
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  loadSrc(sandbox, 'src/audio-engine.js');
  loadSrc(sandbox, 'src/main.js');

  var els = sandbox.__els;
  var MT = sandbox.__meterTaps;
  var AE = sandbox.AudioEngine;
  var AB = sandbox.AudioBypass;
  var startBtn = els['start-button'];
  var deviceSelect = els['input-device-select'];
  var statusWrap = els['status'];
  var startHint = els['start-hint'];
  var bypassBtn = els['bypass-toggle-button'];

  function isLiveVisible() {
    return statusWrap.classList.contains('live');
  }

  async function startWith(deviceId) {
    startBtn.__fire('click');
    if (gumQueue.length !== 1) {
      throw new Error('test bug: expected exactly one pending getUserMedia');
    }
    resolveGumAt(0, deviceId);
    await settle();
  }

  // --------------------------------------------------------------------
  console.log('A. regression: normal start is unchanged');
  // --------------------------------------------------------------------
  deviceList = [
    { kind: 'audioinput', deviceId: 'd1', label: 'Mic One' },
    { kind: 'audioinput', deviceId: 'd2', label: 'Mic Two' }
  ];
  await startWith('d1');

  check(statusText(els) === 'Live', 'A1: status reads Live after a normal start');
  check(isLiveVisible(), 'A1: the .live class (green dot) is on');
  check(startBtn.disabled === true, 'A1: Start is disabled after a successful start');
  check(MT.started === 1, 'A1: MeterTaps.onEngineStarted fired exactly once');
  check(
    optionValues(deviceSelect).join(',') === 'd1,d2',
    'A1: the dropdown offers both enumerated devices'
  );
  check(selectorValue(deviceSelect) === 'd1', 'A1: the selector points at the active device');
  check(AE.isTrackLive === true, 'A1: AudioEngine.isTrackLive is true');

  // --------------------------------------------------------------------
  console.log('B. context suspension leaves Live; resume recovers in place');
  // --------------------------------------------------------------------
  var ctx = createdContexts[0];
  var stoppedBefore = MT.stopped;
  ctx.__setState('suspended');
  await settle();

  check(statusText(els) === 'Audio engine paused.', 'B1: suspension surfaces operator copy');
  check(!isLiveVisible(), 'B1: the strip is NOT Live after suspension');
  check(statusWrap.classList.contains('error'), 'B1: the error register is raised');
  check(startBtn.disabled === false, 'B1: Start is re-enabled (the recovery action)');
  check(startHint.textContent === 'Press Start to resume audio.', 'B1: the hint names the recovery action');
  check(MT.stopped === stoppedBefore + 1, 'B1: MeterTaps.onEngineStopped stopped the loop');
  check(AE.isTrackLive === true, 'B1: the stream itself survived the suspension');

  var startedBefore = MT.started;
  ctx.__setState('running');
  await settle();

  check(statusText(els) === 'Live' && isLiveVisible(), 'B2: resume restores Live (track still live)');
  check(startBtn.disabled === true, 'B2: Start re-disabled after in-place recovery');
  check(MT.started === startedBefore + 1, 'B2: the meter loop restarted');

  // --------------------------------------------------------------------
  console.log('C. track end surfaces loss, stops meters, and Start rebuilds');
  // --------------------------------------------------------------------
  stoppedBefore = MT.stopped;
  var endedTrack = lastCreatedTrack;
  endedTrack.__fire('ended'); // exactly what a real unplugged mic fires
  await settle();

  check(statusText(els) === 'Mic was unplugged.', 'C1: track end surfaces operator copy');
  check(!isLiveVisible(), 'C1: the strip is NOT Live after track end');
  check(statusWrap.classList.contains('error'), 'C1: the error register is raised');
  check(startBtn.disabled === false, 'C1: Start is re-enabled as the recovery action');
  check(
    startHint.textContent === 'Pick another mic from the dropdown, then press Start.',
    'C1: the hint names the recovery action'
  );
  check(MT.stopped === stoppedBefore + 1, 'C1: meters stopped');
  check(AE.stream === null && AE.sourceNode === null, 'C1: the dead session was torn down');
  check(AE.isTrackLive === false && AE.isStarted === false, 'C1: the engine no longer claims live');

  // The one-click retry: pressing the (now enabled) Start rebuilds fresh.
  await startWith('d1');
  check(statusText(els) === 'Live' && isLiveVisible(), 'C2: pressing Start after a loss rebuilds and goes Live');
  check(startBtn.disabled === true, 'C2: Start is gated again after the recovery start');
  check(AE.isTrackLive === true, 'C2: the fresh session is live');

  // --------------------------------------------------------------------
  console.log('D. mute/unmute is a transient note, not a loss');
  // --------------------------------------------------------------------
  lastCreatedTrack.__fire('mute');
  await settle();
  check(statusText(els) === 'Mic muted.' && isLiveVisible(), 'D1: mute shows a note while still Live');
  lastCreatedTrack.__fire('unmute');
  await settle();
  check(statusText(els) === 'Live' && isLiveVisible(), 'D1: unmute returns to Live');
  check(startBtn.disabled === true, 'D1: mute never re-enabled Start (no loss happened)');

  // --------------------------------------------------------------------
  console.log('E. reverse-order switch: the NEWER request wins');
  // --------------------------------------------------------------------
  deviceList = [
    { kind: 'audioinput', deviceId: 'd1', label: 'Mic One' },
    { kind: 'audioinput', deviceId: 'd2', label: 'Mic Two' },
    { kind: 'audioinput', deviceId: 'd3', label: 'Mic Three' }
  ];

  // Switch A (to d2), then — before A resolves — switch B (to d3).
  deviceSelect.value = 'd2';
  deviceSelect.__fire('change');
  deviceSelect.value = 'd3';
  deviceSelect.__fire('change');
  check(gumQueue.length === 2, 'E1: both switch requests are pending');
  var reqA = gumQueue[0];
  var reqB = gumQueue[1];
  check(requestedDeviceId(reqA) === 'd2' && requestedDeviceId(reqB) === 'd3', 'E1: requests A(d2) then B(d3)');

  // Resolve B FIRST, then A LAST (the issue's exact race).
  resolveGumAt(1); // B -> d3
  await settle();
  check(AE.currentDeviceId === 'd3', 'E2: after B resolves, d3 is active');

  var streamB = AE.stream;
  resolveGumAt(0); // A -> d2 resolves LAST
  await settle();

  check(AE.currentDeviceId === 'd3', 'E3: the stale A completion did NOT replace the newer stream (still d3)');
  check(AE.stream === streamB, 'E3: the active stream is still B\'s stream object');
  check(
    gumQueue.length === 0 && statusText(els) === 'Live' && isLiveVisible(),
    'E3: the strip still reads Live after the stale completion'
  );
  check(!statusWrap.classList.contains('error'), 'E3: a stale completion raises no operator error');
  check(lastCreatedTrack.__stopCalls === 1 && lastCreatedTrack.readyState === 'ended',
    'E3: the STALE stream was stopped and discarded');
  check(selectorValue(deviceSelect) === 'd3', 'E3: the selector reflects the actually-active device (d3)');

  // --------------------------------------------------------------------
  console.log('F. device removal while live: loss + dropdown refreshed');
  // --------------------------------------------------------------------
  stoppedBefore = MT.stopped;
  deviceList = [{ kind: 'audioinput', deviceId: 'd2', label: 'Mic Two' }]; // d3 (active) is gone
  fireDeviceChange();
  await settle();

  check(statusText(els) === 'Mic was unplugged.', 'F1: device removal surfaces operator copy');
  check(!isLiveVisible(), 'F1: the strip is NOT Live after device removal');
  check(startBtn.disabled === false, 'F1: Start is re-enabled as the recovery action');
  check(MT.stopped === stoppedBefore + 1, 'F1: meters stopped');
  check(
    optionValues(deviceSelect).join(',') === 'd2',
    'F1: the dropdown was refreshed WITHOUT the dead device'
  );
  check(selectorValue(deviceSelect) === 'd2', 'F1: the selector moved off the dead device');

  // A devicechange with the active device STILL PRESENT must not be a loss.
  await startWith('d2');
  var liveNow = statusText(els);
  deviceList = [{ kind: 'audioinput', deviceId: 'd2', label: 'Mic Two' }];
  fireDeviceChange();
  await settle();
  check(statusText(els) === liveNow && isLiveVisible(), 'F2: devicechange with the active device present keeps Live');

  // --------------------------------------------------------------------
  console.log('G. active-track loss invalidates a pending device switch');
  // --------------------------------------------------------------------
  // Leave a switch unresolved, then lose the ACTIVE track before that
  // replacement arrives. The late replacement belongs to the dead session:
  // it must be stopped/discarded and must never reconnect any audio path.
  deviceList = [
    { kind: 'audioinput', deviceId: 'd2', label: 'Mic Two' },
    { kind: 'audioinput', deviceId: 'd3', label: 'Mic Three' }
  ];
  deviceSelect.value = 'd3';
  deviceSelect.__fire('change');
  check(gumQueue.length === 1 && requestedDeviceId(gumQueue[0]) === 'd3',
    'G1: the replacement switch is pending when the active track is lost');

  var activeBeforeLoss = AE.stream;
  activeBeforeLoss.__track.__fire('ended');
  await settle();

  check(AE.stream === null && AE.sourceNode === null && AE.isStarted === false,
    'G2: active-track loss tears the engine down while the switch is pending');
  check(statusText(els) === 'Mic was unplugged.' && !isLiveVisible(),
    'G2: the loss state remains visible while the switch is pending');

  var buildsAfterLoss = sandbox.AudioGraph.__builds;
  var bypassReconnectsAfterLoss = AB.reconnects;
  var meterSwitchesAfterLoss = MT.switched.length;
  resolveGumAt(0); // the dead session's d3 replacement arrives late
  var staleReplacementTrack = lastCreatedTrack;
  await settle();

  check(staleReplacementTrack.__stopCalls === 1 && staleReplacementTrack.readyState === 'ended',
    'G3: the late replacement stream is stopped and discarded');
  check(AE.stream === null && AE.sourceNode === null && AE.isStarted === false,
    'G3: the late replacement cannot revive the torn-down engine');
  check(
    sandbox.AudioGraph.__builds === buildsAfterLoss &&
      AB.reconnects === bypassReconnectsAfterLoss &&
      MT.switched.length === meterSwitchesAfterLoss,
    'G3: the late replacement reconnects no graph, bypass, or meter path'
  );
  check(statusText(els) === 'Mic was unplugged.' && !isLiveVisible() && startBtn.disabled === false,
    'G3: the operator stays stopped until explicitly pressing Start');

  await startWith('d2');
  check(AE.currentDeviceId === 'd2' && AE.isStarted === true && AE.isTrackLive === true,
    'G4: explicit Start creates the next live session');
  check(
    sandbox.AudioGraph.__builds === buildsAfterLoss + 1 && AB.reconnects === bypassReconnectsAfterLoss + 1,
    'G4: only explicit Start reconnects the graph and bypass path'
  );

  // --------------------------------------------------------------------
  console.log('H. failed switch keeps the old stream and snaps the selector back');
  // --------------------------------------------------------------------
  deviceSelect.value = 'd1'; // not even in deviceList -> gUM rejects
  deviceSelect.__fire('change');
  check(gumQueue.length === 1, 'H1: the failed switch is pending');
  var notFound = new Error('Requested device not found');
  notFound.name = 'NotFoundError';
  rejectGumAt(0, notFound);
  await settle();

  check(AE.currentDeviceId === 'd2', 'H1: the old stream (d2) is untouched by the failed switch');
  check(!isLiveVisible() === false, 'H1: the engine stays live (dot truthful)');
  check(
    statusWrap.classList.contains('error') && statusText(els).indexOf('gone') !== -1,
    'H1: entry-3 switch failure copy still surfaces'
  );
  check(selectorValue(deviceSelect) === 'd2', 'H1: the selector snapped back to the ACTIVE device');
  check(startBtn.disabled === true, 'H1: a failed switch never re-enables Start (engine still live)');

  // --------------------------------------------------------------------
  console.log('I. no stale-visible-Live anywhere above (aggregate)');
  // --------------------------------------------------------------------
  // Re-checked end-to-end: after the worst case in this suite's flow
  // (live engine -> track end), the strip cannot read Live.
  lastCreatedTrack.__fire('ended');
  await settle();
  check(statusText(els) === 'Mic was unplugged.' && !isLiveVisible(), 'I1: track end on the FINAL live session leaves no Live');
  check(startBtn.disabled === false && MT.stopped > 0, 'I1: recovery (Start) and meters-stopped hold');

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: lifecycle losses detected, device switches serialized (issue #4)');
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
