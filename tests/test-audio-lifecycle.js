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
  el.__focusCount = 0;
  el.focus = function () {
    el.__focusCount += 1;
  };
  return el;
}

// A <dialog> stub with the three members main.js feature-detects and
// uses: showModal(), close() and the `open` property. close() fires the
// real element's 'close' event, so the focus-return path is exercised
// rather than assumed.
function makeDialogElement() {
  var el = makeElement('dialog');
  el.open = false;
  el.__showModalCalls = 0;
  el.showModal = function () {
    if (el.open) {
      throw new Error('InvalidStateError: dialog already open');
    }
    el.__showModalCalls += 1;
    el.open = true;
  };
  el.close = function () {
    if (!el.open) {
      return;
    }
    el.open = false;
    el.__fire('close');
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
var nextAudioContextInitialState = 'suspended';
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
  var resumeWaiters = [];
  var initialState = nextAudioContextInitialState;
  nextAudioContextInitialState = 'suspended';
  var ctx = {
    state: initialState,
    sampleRate: 48000,
    // Refinement entry 5 (P3-5): a REAL browser's resume() settles on its
    // own clock — the state flip and the statechange it fires happen when
    // the promise resolves, NOT synchronously at the call. The old stub
    // flipped synchronously, which is more synchronous than any browser
    // and hid the late-resume wedge section J reproduces: a start that
    // completes while the state is still 'suspended' writes "Stopped",
    // and the 'running' transition that follows must correct it.
    resume: function () {
      if (ctx.state === 'running') {
        return Promise.resolve();
      }
      return new Promise(function (resolve) {
        resumeWaiters.push(resolve);
      });
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
    },
    // Settle a pending resume(): flip to 'running', fire statechange
    // (which drives the engine's emit -> main.js synchronously), then
    // resolve the resume promise itself. Returns whether a resume was
    // actually pending.
    __settleResume: function () {
      var waiters = resumeWaiters.splice(0);
      if (waiters.length === 0) {
        return false;
      }
      ctx.state = 'running';
      stateListeners.slice().forEach(function (fn) {
        fn({ type: 'statechange' });
      });
      waiters.forEach(function (resolve) {
        resolve();
      });
      return true;
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
function createSandbox(opts) {
  var graphBuildBehavior = null;
  var transitionReleases = [];
  var failNextBypassReconnect = false;
  var failNextMeterSwitch = false;
  var els = {
    'start-button': makeElement('button'),
    'input-device-select': makeElement('select'),
    'status': makeElement('span'),
    'status-text': makeElement('span'),
    'start-hint': makeElement('span'),
    'bypass-toggle-button': makeElement('button')
  };
  // The headphone check is OPT-IN in this harness. Without it the sandbox
  // reproduces main.js's documented degradation — markup absent, or no
  // native <dialog>, so Start behaves exactly as it did before the check
  // existed — which is what every lifecycle scenario below wants to
  // exercise. Section N opts in and pins the real gated path; section A9
  // pins that the real index.html ships the markup, so the degradation
  // can never quietly become the shipped behavior.
  if (opts && opts.headphoneCheck) {
    els['headphone-check'] = makeDialogElement();
    els['headphone-check-confirm'] = makeElement('button');
    els['headphone-check-cancel'] = makeElement('button');
  }
  Object.keys(els).forEach(function (id) {
    els[id].id = id;
  });
  // Mirror index.html's pre-Start controls. The lifecycle harness should
  // never get a free pass from permissive synthetic-element defaults.
  els['input-device-select'].disabled = true;
  els['bypass-toggle-button'].disabled = true;

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
      if (failNextMeterSwitch) {
        failNextMeterSwitch = false;
        throw new Error('meter retap failed');
      }
      meterTaps.switched.push(node);
    }
  };

  var chainCanvas = {
    started: 0,
    stopped: 0,
    inert: true,
    onEngineStarted: function () {
      chainCanvas.started += 1;
      chainCanvas.inert = false;
    },
    onEngineStopped: function () {
      chainCanvas.stopped += 1;
      chainCanvas.inert = true;
    }
  };

  var audioBypass = {
    reconnects: 0,
    // Starts disengaged exactly as before, so every existing check that
    // assumed "never engaged" still sees that. What is new is that the
    // state can MOVE, which is what makes the deck's bypass reporting
    // testable (section A2).
    engaged: false,
    reconnectSource: function () {
      if (failNextBypassReconnect) {
        failNextBypassReconnect = false;
        throw new Error('bypass reconnect failed');
      }
      audioBypass.reconnects += 1;
    },
    isEngaged: function () {
      return audioBypass.engaged;
    },
    toggle: function () {
      audioBypass.engaged = !audioBypass.engaged;
    }
  };

  var sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    document: {
      __docListeners: {},
      addEventListener: function (type, fn) {
        var box = sandbox.document.__docListeners;
        (box[type] = box[type] || []).push(fn);
      },
      /** Drive a document-level key handler — the spacebar bypass is
       *  bound here, not on any element, because it is the emergency
       *  control and must work wherever focus happens to be. */
      __fireKeydown: function (ev) {
        var e = ev || {};
        if (typeof e.preventDefault !== 'function') {
          e.preventDefault = function () {};
        }
        (sandbox.document.__docListeners.keydown || []).slice()
          .forEach(function (fn) { fn(e); });
      },
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
        if (graphBuildBehavior) {
          return graphBuildBehavior();
        }
        return Promise.resolve({ committed: true });
      },
      getModel: function () {
        return [];
      }
    },
    ChainEditing: {
      apply: function (request) {
        return Promise.resolve(sandbox.AudioGraph.buildGraph(request.candidate || []));
      },
      beginEngineTransition: function () {
        return {
          ready: Promise.resolve(),
          release: function (engineLive) {
            transitionReleases.push(engineLive);
          }
        };
      }
    },
    MeterTaps: meterTaps,
    ChainCanvas: chainCanvas
  };
  sandbox.window = sandbox;
  sandbox.__els = els;
  sandbox.__meterTaps = meterTaps;
  sandbox.__chainCanvas = chainCanvas;
  sandbox.__setGraphBuildBehavior = function (behavior) {
    graphBuildBehavior = behavior;
  };
  sandbox.__failNextBypassReconnect = function () {
    failNextBypassReconnect = true;
  };
  sandbox.__failNextMeterSwitch = function () {
    failNextMeterSwitch = true;
  };
  sandbox.__transitionReleases = transitionReleases;
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
    // P3-5: settle the context's pending resume() AFTER the start
    // continuation has run — the honest interleaving, where start()
    // completes while the state is still 'suspended' (strip honestly
    // writes "Stopped") and the resume settles a beat later. The late
    // 'running' transition is what must carry the strip to Live; before
    // the fix it no-op'd and every one of these starts would wedge.
    if (createdContexts[createdContexts.length - 1].__settleResume()) {
      await settle();
    }
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
  check((startBtn.textContent === 'Stop' && startBtn.disabled === false), 'A1: the session button becomes an enabled Stop after a successful start');
  check(MT.started === 1, 'A1: MeterTaps.onEngineStarted fired exactly once');
  check(sandbox.__chainCanvas.started === 1, 'A1: ChainCanvas.onEngineStarted unlocked the board exactly once');
  check(
    optionValues(deviceSelect).join(',') === 'd1,d2',
    'A1: the dropdown offers both enumerated devices'
  );
  check(selectorValue(deviceSelect) === 'd1', 'A1: the selector points at the active device');
  check(AE.isTrackLive === true, 'A1: AudioEngine.isTrackLive is true');

  // --------------------------------------------------------------------
  console.log('A2. the deck stops saying LIVE while bypass is engaged');
  // --------------------------------------------------------------------
  // Bypass gates the effect chain to silence and hands the room the
  // independent dry tap. The ENGINE is still live — the lamp keeps
  // saying so — but a header still reading LIVE is the one place this
  // app could tell an operator mid-show that their processing is running
  // when it is not. These pin that the WORD reports the chain, that the
  // colour half of the redundancy travels with it, that the emergency
  // KEYBOARD path reports identically to the button, and that a standing
  // error still outranks a deliberate safe state.
  //
  // Runs here, on section A's clean live session, and returns bypass to
  // OFF before section B — so nothing downstream sees a changed world.
  check(!statusWrap.classList.contains('bypassed'),
    'A2: a live engine with bypass off carries no bypassed marking');

  bypassBtn.__fire('click');
  check(statusText(els) === 'Bypassed \u2014 effects off',
    'A2: engaging bypass replaces the deck sentence — it never keeps saying Live');
  check(statusWrap.classList.contains('bypassed') && isLiveVisible(),
    'A2: copy AND colour — the bypassed marking rides alongside live, because the ENGINE is still live');
  check(bypassBtn.textContent === 'Bypass: ON',
    'A2: the key and the deck describe the one state together');

  bypassBtn.__fire('click');
  check(statusText(els) === 'Live' && !statusWrap.classList.contains('bypassed'),
    'A2: releasing bypass restores the live sentence and drops the marking');

  sandbox.document.__fireKeydown({ code: 'Space', key: ' ' });
  check(statusText(els) === 'Bypassed \u2014 effects off' &&
      statusWrap.classList.contains('bypassed'),
    'A2: the spacebar — the emergency path — reports exactly as the button does');
  sandbox.document.__fireKeydown({ code: 'Space', key: ' ' });
  check(statusText(els) === 'Live' && !statusWrap.classList.contains('bypassed'),
    'A2: and back again');

  // A real failure outranks a deliberate safe state: toggling bypass must
  // not quietly erase an error the operator has not dealt with yet.
  statusWrap.classList.add('error');
  var sentenceUnderError = statusText(els);
  bypassBtn.__fire('click');
  check(statusWrap.classList.contains('error') && statusText(els) === sentenceUnderError,
    'A2: toggling bypass over a standing error leaves both the error sentence and its class alone');
  bypassBtn.__fire('click'); // back to disengaged
  statusWrap.classList.remove('error');
  check(AB.isEngaged() === false && !statusWrap.classList.contains('error'),
    'A2: the section leaves bypass off and the error register clear for the sections below');

  // --------------------------------------------------------------------
  console.log('B. context suspension leaves Live; resume recovers in place');
  // --------------------------------------------------------------------
  var ctx = createdContexts[0];
  var stoppedBefore = MT.stopped;
  var canvasStopsBefore = sandbox.__chainCanvas.stopped;
  ctx.__setState('suspended');
  await settle();

  check(statusText(els) === 'Audio engine paused. Press Stop, then Start to resume.', 'B1: suspension surfaces operator copy');
  check(!isLiveVisible(), 'B1: the strip is NOT Live after suspension');
  check(statusWrap.classList.contains('error'), 'B1: the error register is raised');
  check(startBtn.textContent === 'Stop' && !startBtn.disabled, 'B1: Stop remains available while paused capture is open');
  check(startHint.textContent === 'Press Stop, then Start to resume audio.', 'B1: the hint names the recovery action');
  check(MT.stopped === stoppedBefore + 1, 'B1: MeterTaps.onEngineStopped stopped the loop');
  check(sandbox.__chainCanvas.stopped === canvasStopsBefore + 1,
    'B1: ChainCanvas.onEngineStopped re-gated the board');
  check(deviceSelect.disabled === true, 'B1: suspension disables the microphone selector');
  check(AE.isTrackLive === true, 'B1: the stream itself survived the suspension');

  var startedBefore = MT.started;
  ctx.__setState('running');
  await settle();

  check(statusText(els) === 'Live' && isLiveVisible(), 'B2: resume restores Live (track still live)');
  check((startBtn.textContent === 'Stop' && startBtn.disabled === false), 'B2: Stop stays enabled after in-place recovery');
  check(sandbox.__chainCanvas.started === 2, 'B2: in-place recovery unlocks the board again');
  check(deviceSelect.disabled === false, 'B2: in-place recovery re-enables the microphone selector');
  check(MT.started === startedBefore + 1, 'B2: the meter loop restarted');

  // A source request started before suspension belongs to the lost context
  // generation. Recovery keeps the current d1 stream, but the late d2
  // acquisition must be discarded without touching graph/taps/status.
  deviceSelect.value = 'd2';
  deviceSelect.__fire('change');
  await settle();
  check(gumQueue.length === 1, 'B3: a device replacement is pending before context loss');
  ctx.__setState('suspended');
  await settle();
  ctx.__setState('running');
  await settle();
  await sandbox.ChainEditing.apply({ candidate: [] });
  var buildsAfterContextRecovery = sandbox.AudioGraph.__builds;
  var bypassAfterContextRecovery = AB.reconnects;
  var metersAfterContextRecovery = MT.switched.length;
  resolveGumAt(0, 'd2');
  var staleContextReplacement = lastCreatedTrack;
  await settle();
  check(
    staleContextReplacement.__stopCalls === 1 &&
      AE.currentDeviceId === 'd1' && AE.isStarted === true,
    'B3: the pre-suspension replacement is stopped and cannot replace the recovered source'
  );
  check(
    sandbox.AudioGraph.__builds === buildsAfterContextRecovery &&
      AB.reconnects === bypassAfterContextRecovery &&
      MT.switched.length === metersAfterContextRecovery &&
      statusText(els) === 'Live' && isLiveVisible(),
    'B3: the obsolete replacement performs no graph, bypass, meter, or status finalization'
  );

  // --------------------------------------------------------------------
  console.log('C. track end surfaces loss, stops meters, and Start rebuilds');
  // --------------------------------------------------------------------
  stoppedBefore = MT.stopped;
  var endedTrack = AE.stream.__track;
  endedTrack.__fire('ended'); // exactly what a real unplugged mic fires
  await settle();

  check(statusText(els) === 'Microphone disconnected.', 'C1: track end surfaces operator copy');
  check(!isLiveVisible(), 'C1: the strip is NOT Live after track end');
  check(statusWrap.classList.contains('error'), 'C1: the error register is raised');
  check(startBtn.disabled === false, 'C1: Start is re-enabled as the recovery action');
  check(
    startHint.textContent === 'Reconnect the microphone, then press Start.',
    'C1: the hint names the recovery action'
  );
  check(MT.stopped === stoppedBefore + 1, 'C1: meters stopped');
  check(AE.stream === null && AE.sourceNode === null, 'C1: the dead session was torn down');
  check(AE.isTrackLive === false && AE.isStarted === false, 'C1: the engine no longer claims live');

  // The one-click retry: pressing the (now enabled) Start rebuilds fresh.
  var canvasStartsBeforeTrackRecovery = sandbox.__chainCanvas.started;
  await startWith('d1');
  check(statusText(els) === 'Live' && isLiveVisible(), 'C2: pressing Start after a loss rebuilds and goes Live');
  check((startBtn.textContent === 'Stop' && startBtn.disabled === false), 'C2: Stop is offered after the recovery start');
  check(AE.isTrackLive === true, 'C2: the fresh session is live');
  check(sandbox.__chainCanvas.started === canvasStartsBeforeTrackRecovery + 1,
    'C2: the recovered Start unlocked the board again');

  // --------------------------------------------------------------------
  console.log('D. mute/unmute is a transient note, not a loss');
  // --------------------------------------------------------------------
  lastCreatedTrack.__fire('mute');
  await settle();
  check(statusText(els) === 'Mic muted.' && isLiveVisible(), 'D1: mute shows a note while still Live');
  lastCreatedTrack.__fire('unmute');
  await settle();
  check(statusText(els) === 'Live' && isLiveVisible(), 'D1: unmute returns to Live');
  check((startBtn.textContent === 'Stop' && startBtn.disabled === false), 'D1: mute keeps the session button on Stop');

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
  await settle();
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

  check(statusText(els) === 'Microphone disconnected.', 'F1: device removal surfaces operator copy');
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
  await settle();
  check(gumQueue.length === 1 && requestedDeviceId(gumQueue[0]) === 'd3',
    'G1: the replacement switch is pending when the active track is lost');

  var activeBeforeLoss = AE.stream;
  activeBeforeLoss.__track.__fire('ended');
  await settle();

  check(AE.stream === null && AE.sourceNode === null && AE.isStarted === false,
    'G2: active-track loss tears the engine down while the switch is pending');
  check(statusText(els) === 'Microphone disconnected.' && !isLiveVisible(),
    'G2: the loss state remains visible while the switch is pending');
  check(deviceSelect.disabled === true,
    'G2: the microphone selector is disabled while the engine is stopped');
  check(sandbox.__transitionReleases.indexOf(false) !== -1,
    'G2: lifecycle loss fails the pending ChainEditing transition generation immediately');

  var buildsAfterLoss = sandbox.AudioGraph.__builds;
  var bypassReconnectsAfterLoss = AB.reconnects;
  var meterSwitchesAfterLoss = MT.switched.length;

  // Recover BEFORE the invalidated device request settles. The failed
  // transition generation must not hold this explicit Start hostage.
  startBtn.__fire('click');
  check(gumQueue.length === 2,
    'G3: recovery Start acquires a fresh source while the obsolete switch is still pending');
  resolveGumAt(1, 'd2');
  await settle();
  check(AE.currentDeviceId === 'd2' && AE.isStarted === true && AE.isTrackLive === true,
    'G3: recovery Start becomes live without waiting for the obsolete switch');
  check(deviceSelect.disabled === false,
    'G3: successful recovery re-enables the microphone selector');

  resolveGumAt(0); // the dead session's d3 replacement finally arrives
  var staleReplacementTrack = lastCreatedTrack;
  await settle();

  check(staleReplacementTrack.__stopCalls === 1 && staleReplacementTrack.readyState === 'ended',
    'G4: the late replacement stream is stopped and discarded');
  check(AE.currentDeviceId === 'd2' && AE.isStarted === true && AE.isTrackLive === true,
    'G4: the late replacement cannot disturb the recovered engine');
  check(
    sandbox.AudioGraph.__builds === buildsAfterLoss + 1 &&
      AB.reconnects === bypassReconnectsAfterLoss + 1 &&
      MT.switched.length === meterSwitchesAfterLoss,
    'G4: only recovery Start reconnects graph and bypass; the late switch reconnects nothing'
  );
  check(statusText(els) === 'Live' && isLiveVisible() && (startBtn.textContent === 'Stop' && startBtn.disabled === false),
    'G4: the recovered Live state remains authoritative after the stale completion');

  // --------------------------------------------------------------------
  console.log('H. failed switch keeps the old stream and snaps the selector back');
  // --------------------------------------------------------------------
  deviceSelect.value = 'd1'; // not even in deviceList -> gUM rejects
  deviceSelect.__fire('change');
  await settle();
  check(gumQueue.length === 1, 'H1: the failed switch is pending');
  var notFound = new Error('Requested device not found');
  notFound.name = 'NotFoundError';
  rejectGumAt(0, notFound);
  await settle();

  check(AE.currentDeviceId === 'd2', 'H1: the old stream (d2) is untouched by the failed switch');
  check(!isLiveVisible() === false, 'H1: the engine stays live (dot truthful)');
  check(
    statusWrap.classList.contains('error') &&
      statusText(els) === 'That microphone is unavailable. Choose another.',
    'H1: entry-3 switch failure copy still surfaces'
  );
  check(selectorValue(deviceSelect) === 'd2', 'H1: the selector snapped back to the ACTIVE device');
  check((startBtn.textContent === 'Stop' && startBtn.disabled === false), 'H1: a failed switch keeps Stop available while the engine stays live');

  // --------------------------------------------------------------------
  console.log('I. graph reconnect must commit before switch finalization');
  // --------------------------------------------------------------------
  var finishGraphBuild;
  sandbox.__setGraphBuildBehavior(function () {
    return new Promise(function (resolve) {
      finishGraphBuild = resolve;
    });
  });
  var reconnectsBeforeGraph = AB.reconnects;
  var meterSwitchesBeforeGraph = MT.switched.length;
  var meterStopsBeforeGraph = MT.stopped;
  deviceSelect.value = 'd3';
  deviceSelect.__fire('change');
  await settle();
  check(statusText(els) === 'Switching microphone...' && !isLiveVisible(),
    'I1: a pending switch clears the Live claim');
  resolveGumAt(0, 'd3');
  await settle();
  check(
    AE.currentDeviceId === 'd3' &&
      AB.reconnects === reconnectsBeforeGraph &&
      MT.switched.length === meterSwitchesBeforeGraph,
    'I2: bypass, meters, and Live wait while the replacement graph is pending'
  );
  finishGraphBuild({
    committed: false,
    error: new Error('delayed replacement graph failure'),
    rollback: { attempted: true, succeeded: true }
  });
  await settle();
  check(
    statusText(els) === 'Audio chain did not reconnect.' &&
      !isLiveVisible() && startBtn.disabled === false &&
      AE.isStarted === false && MT.stopped === meterStopsBeforeGraph + 1,
    'I3: a failed replacement graph tears down the incomplete session and offers Start'
  );
  check(
    AB.reconnects === reconnectsBeforeGraph && MT.switched.length === meterSwitchesBeforeGraph,
    'I4: a failed graph never reconnects bypass or meters'
  );

  sandbox.__setGraphBuildBehavior(null);
  await startWith('d2');

  // Once a replacement source is installed, a context loss retires that
  // request's still-staging graph. Its late completion must not finalize
  // over the explicit Start recovery that follows.
  var obsoleteGraphResolve;
  sandbox.__setGraphBuildBehavior(function () {
    return new Promise(function (resolve) {
      obsoleteGraphResolve = resolve;
    });
  });
  deviceSelect.value = 'd3';
  deviceSelect.__fire('change');
  await settle();
  resolveGumAt(0, 'd3');
  await settle();
  createdContexts[createdContexts.length - 1].__setState('suspended');
  await settle();
  check(
    AE.isStarted === false && statusText(els) === 'Audio chain did not reconnect.' &&
      !isLiveVisible() && startBtn.disabled === false,
    'I5: lifecycle loss retires and stops a source whose graph is still staging'
  );

  sandbox.__setGraphBuildBehavior(null);
  await startWith('d2');
  var recoveredStreamAfterGraphLoss = AE.stream;
  var reconnectsAfterGraphRecovery = AB.reconnects;
  var meterSwitchesAfterGraphRecovery = MT.switched.length;
  obsoleteGraphResolve({ committed: true });
  await settle();
  check(
    AE.stream === recoveredStreamAfterGraphLoss && AE.currentDeviceId === 'd2' &&
      statusText(els) === 'Live' && isLiveVisible(),
    'I6: an obsolete graph completion cannot stop or relabel the recovered session'
  );
  check(
    AB.reconnects === reconnectsAfterGraphRecovery &&
      MT.switched.length === meterSwitchesAfterGraphRecovery,
    'I7: an obsolete graph completion performs no bypass or meter finalization'
  );

  // Finalization is part of the device graph transaction. A synchronous
  // exception while reconnecting either side tap must stop the incomplete
  // replacement session instead of exposing a false Live state.
  sandbox.__failNextBypassReconnect();
  deviceSelect.value = 'd3';
  deviceSelect.__fire('change');
  await settle();
  resolveGumAt(0, 'd3');
  await settle();
  check(
    AE.isStarted === false && statusText(els) === 'Audio chain did not reconnect.' &&
      !isLiveVisible() && startBtn.disabled === false,
    'I8: a bypass-finalization exception tears down the incomplete replacement session'
  );

  await startWith('d1');
  sandbox.__failNextMeterSwitch();
  deviceSelect.value = 'd2';
  deviceSelect.__fire('change');
  await settle();
  resolveGumAt(0, 'd2');
  await settle();
  check(
    AE.isStarted === false && statusText(els) === 'Audio chain did not reconnect.' &&
      !isLiveVisible() && startBtn.disabled === false,
    'I9: a meter-finalization exception tears down the incomplete replacement session'
  );

  await startWith('d2');

  // A second successful switch can supersede the first switch's staged
  // graph. The canceled older completion must not stop the newer source.
  var pendingGraphResolve = null;
  sandbox.__setGraphBuildBehavior(function () {
    if (pendingGraphResolve) {
      var superseded = pendingGraphResolve;
      pendingGraphResolve = null;
      superseded({
        committed: false,
        canceled: true,
        error: new Error('superseded device graph'),
        rollback: { attempted: false, succeeded: true }
      });
    }
    return new Promise(function (resolve) {
      pendingGraphResolve = resolve;
    });
  });
  deviceList = [
    { kind: 'audioinput', deviceId: 'd1', label: 'Mic One' },
    { kind: 'audioinput', deviceId: 'd2', label: 'Mic Two' },
    { kind: 'audioinput', deviceId: 'd3', label: 'Mic Three' }
  ];
  deviceSelect.value = 'd3';
  deviceSelect.__fire('change');
  await settle();
  resolveGumAt(0, 'd3');
  await settle();
  deviceSelect.value = 'd1';
  deviceSelect.__fire('change');
  await settle();
  resolveGumAt(0, 'd1');
  await settle();
  check(AE.currentDeviceId === 'd1' && AE.isStarted === true,
    'I10: a superseded device graph does not stop the newer live source');
  pendingGraphResolve({ committed: true });
  pendingGraphResolve = null;
  await settle();
  check(
    AE.currentDeviceId === 'd1' && statusText(els) === 'Live' && isLiveVisible(),
    'I11: only the active request finalizes Live after its graph commits'
  );

  // A newer request that is only ACQUIRING does not yet own the active
  // source. If the active source's graph fails first, it must still stop;
  // the newer acquisition can fail and must never reveal a false Live.
  var failActiveGraph;
  sandbox.__setGraphBuildBehavior(function () {
    return new Promise(function (resolve) {
      failActiveGraph = resolve;
    });
  });
  deviceSelect.value = 'd3';
  deviceSelect.__fire('change');
  await settle();
  resolveGumAt(0, 'd3');
  await settle();
  deviceSelect.value = 'd2';
  deviceSelect.__fire('change');
  await settle();
  failActiveGraph({
    committed: false,
    error: new Error('active source graph failed before newer acquisition'),
    rollback: { attempted: true, succeeded: true }
  });
  await settle();
  check(AE.isStarted === false && !isLiveVisible() && startBtn.disabled === false,
    'I12: an active-source graph failure stops even while a newer mic request is pending');
  var laterNotFound = new Error('newer requested device also failed');
  laterNotFound.name = 'NotFoundError';
  rejectGumAt(0, laterNotFound);
  await settle();
  check(AE.isStarted === false && !isLiveVisible(),
    'I13: the later acquisition failure cannot expose Live over the disconnected source');

  sandbox.__setGraphBuildBehavior(null);
  await startWith('d1');

  // --------------------------------------------------------------------
  console.log('J. no stale-visible-Live anywhere above (aggregate)');
  // --------------------------------------------------------------------
  // Re-checked end-to-end: after the worst case in this suite's flow
  // (live engine -> track end), the strip cannot read Live.
  lastCreatedTrack.__fire('ended');
  await settle();
  check(statusText(els) === 'Microphone disconnected.' && !isLiveVisible(), 'J1: track end on the FINAL live session leaves no Live');
  check(startBtn.disabled === false && MT.stopped > 0, 'J1: recovery (Start) and meters-stopped hold');

  // --------------------------------------------------------------------
  console.log('K. P3-5: a context resuming only after start completion (the late-resume wedge)');
  // --------------------------------------------------------------------
  // The critique's live-run observation, reproduced on a fresh sandbox
  // with the honest deferred-resume context: start() completes while
  // the state is still 'suspended' (the strip honestly writes
  // "Stopped", Start is disabled, meters run) and — because no suspend
  // loss was ever surfaced — contextLost is false, so the 'running'
  // transition that follows used to find handleContextState's recovery
  // branch dark and no-op, wedging the strip at "Stopped" while the
  // engine ran.
  {
    var sandbox2 = createSandbox();
    loadSrc(sandbox2, 'src/audio-engine.js');
    loadSrc(sandbox2, 'src/main.js');
    var els2 = sandbox2.__els;
    var MT2 = sandbox2.__meterTaps;
    var AE2 = sandbox2.AudioEngine;
    var startBtn2 = els2['start-button'];
    var statusWrap2 = els2['status'];
    var statusText2 = els2['status-text'];
    var deviceSelect2 = els2['input-device-select'];
    var bypassBtn2 = els2['bypass-toggle-button'];

    deviceList = [{ kind: 'audioinput', deviceId: 'd1', label: 'Mic One' }];

    // Start and let the start continuation COMPLETE with the resume
    // still pending — deliberately NO settleResume here (the wedge setup).
    startBtn2.__fire('click');
    check(gumQueue.length === 1, 'K1: the start request is pending');
    resolveGumAt(0, 'd1');
    await settle();

    // The wedge state, byte-for-byte the critique's observation: the
    // start SUCCEEDED (Start disabled, meters running, no error) but
    // the context is still 'suspended', so the honest start-time read
    // wrote "Stopped".
    check(
      statusText2.textContent === 'Stopped',
      'K1: start completed with the resume pending — the strip reads "Stopped"'
    );
    check(!statusWrap2.classList.contains('live'), 'K1: the lamp is off');
    check((startBtn2.textContent === 'Stop' && startBtn2.disabled === false), 'K1: Stop is enabled while the successful start awaits context resume');
    check(
      sandbox2.__chainCanvas.started === 0 && sandbox2.__chainCanvas.stopped === 1 &&
        sandbox2.__chainCanvas.inert === true &&
        bypassBtn2.disabled === true,
      'K1: the board and Bypass stay gated while the startup context is suspended'
    );
    check(!statusWrap2.classList.contains('error'), 'K1: no error register — this is not a loss');
    check(MT2.started === 0 && MT2.stopped === 0, 'K1: meters remain gated until the context is running');
    check(AE2.isStarted === true && AE2.isTrackLive === true, 'K1: the engine is started with a live track');

    // The resume settles — 'suspended' -> 'running' fires statechange.
    check(
      createdContexts[createdContexts.length - 1].__settleResume(),
      'K2 setup: the late resume was still pending and has just settled'
    );
    await settle();

    check(statusText2.textContent === 'Live', 'K2: the late running transition corrects the strip to Live');
    check(statusWrap2.classList.contains('live'), 'K2: the lamp is on');
    check(
      sandbox2.__chainCanvas.started === 1 && sandbox2.__chainCanvas.inert === false &&
        bypassBtn2.disabled === false,
      'K2: the late running transition unlocks the board and Bypass'
    );
    check((startBtn2.textContent === 'Stop' && startBtn2.disabled === false), 'K2: Stop remains the session action');
    check(!statusWrap2.classList.contains('error'), 'K2: no error raised');
    check(
      MT2.started === 1 && MT2.stopped === 0,
      'K2: the late running transition starts the meters exactly once'
    );

    // Guard rail 1: a running transition must never DEMOTE a shown loss.
    // Kill the track (engine dead), then fire a spurious 'running'
    // transition — the loss copy and its error register must survive.
    lastCreatedTrack.__fire('ended');
    await settle();
    check(statusText2.textContent === 'Microphone disconnected.', 'K3 setup: the track loss owns the strip');
    createdContexts[createdContexts.length - 1].__setState('running');
    await settle();
    check(
      statusText2.textContent === 'Microphone disconnected.' &&
        statusWrap2.classList.contains('error') &&
        !statusWrap2.classList.contains('live'),
      'K3: a running transition while the engine is dead does NOT demote the loss copy'
    );

    // Guard rail 2: a running transition must never ERASE a shown
    // operator failure while the engine is live (a failed switch).
    startBtn2.__fire('click'); // the one-click recovery
    check(gumQueue.length === 1, 'K4 setup: the recovery start is pending');
    resolveGumAt(0, 'd1');
    await settle();
    createdContexts[createdContexts.length - 1].__settleResume(); // context already 'running' — a no-op
    await settle();
    check(
      statusText2.textContent === 'Live' && statusWrap2.classList.contains('live'),
      'K4 setup: the recovery start is Live again'
    );

    deviceSelect2.value = 'dX'; // not in deviceList -> gUM rejects
    deviceSelect2.__fire('change');
    await settle();
    check(gumQueue.length === 1, 'K4 setup: the doomed switch is pending');
    var nf2 = new Error('Requested device not found');
    nf2.name = 'NotFoundError';
    rejectGumAt(0, nf2);
    await settle();
    check(
      statusWrap2.classList.contains('error') && statusWrap2.classList.contains('live'),
      'K4 setup: a failed switch shows operator error copy while the lamp stays truthful'
    );
    createdContexts[createdContexts.length - 1].__setState('running');
    await settle();
    check(
      statusWrap2.classList.contains('error') &&
        statusText2.textContent === 'That microphone is unavailable. Choose another.',
      'K4: a running transition does NOT erase the shown switch-failure copy'
    );
  }

  // The Web Audio lifecycle also reports `interrupted` (not only
  // `suspended`). Start uses the same late-resume recovery contract.
  {
    nextAudioContextInitialState = 'interrupted';
    var sandboxInterrupted = createSandbox();
    loadSrc(sandboxInterrupted, 'src/audio-engine.js');
    loadSrc(sandboxInterrupted, 'src/main.js');
    var interruptedStart = sandboxInterrupted.__els['start-button'];
    interruptedStart.__fire('click');
    check(gumQueue.length === 1, 'K5: interrupted-context Start is pending');
    resolveGumAt(0, 'd1');
    await settle();
    var interruptedContext = createdContexts[createdContexts.length - 1];
    check(
      sandboxInterrupted.AudioEngine.isStarted === true &&
        sandboxInterrupted.__els['status-text'].textContent === 'Stopped',
      'K5: startup may restore while an interrupted context is still resuming'
    );
    interruptedContext.__settleResume();
    await settle();
    check(
      sandboxInterrupted.__els['status-text'].textContent === 'Live' &&
        sandboxInterrupted.__els['status'].classList.contains('live'),
      'K5: the late interrupted-to-running transition completes recovery'
    );
  }

  // A context may finish resume before the saved-chain transaction does.
  // `running` alone must not expose controls or Live until restoration,
  // bypass, and meter finalization have all completed.
  {
    var sandboxStartupPending = createSandbox();
    var finishStartupRestore;
    sandboxStartupPending.ChainEditing = {
      apply: function () {
        return new Promise(function (resolve) {
          finishStartupRestore = resolve;
        });
      }
    };
    loadSrc(sandboxStartupPending, 'src/audio-engine.js');
    loadSrc(sandboxStartupPending, 'src/main.js');
    var pendingStartButton = sandboxStartupPending.__els['start-button'];
    pendingStartButton.__fire('click');
    check(gumQueue.length === 1, 'K6: startup mic acquisition is pending');
    resolveGumAt(0, 'd1');
    await settle();
    var pendingStartupContext = createdContexts[createdContexts.length - 1];
    check(
      typeof finishStartupRestore === 'function' &&
        sandboxStartupPending.AudioEngine.isStarted === true,
      'K6: the microphone is acquired while startup restoration remains pending'
    );
    pendingStartupContext.__settleResume();
    await settle();
    check(
      sandboxStartupPending.__els['status-text'].textContent === 'Waiting for microphone permission...' &&
        !sandboxStartupPending.__els['status'].classList.contains('live') &&
        sandboxStartupPending.__els['input-device-select'].disabled === true &&
        sandboxStartupPending.__els['bypass-toggle-button'].disabled === true &&
        sandboxStartupPending.__chainCanvas.inert === true &&
        sandboxStartupPending.__chainCanvas.started === 0,
      'K6: a running event cannot publish Live or unlock controls over a staging startup graph'
    );
    finishStartupRestore({ applied: true, saved: true, mode: 'structural' });
    await settle();
    check(
      sandboxStartupPending.__els['status-text'].textContent === 'Live' &&
        sandboxStartupPending.__els['status'].classList.contains('live') &&
        sandboxStartupPending.__els['input-device-select'].disabled === false &&
        sandboxStartupPending.__els['bypass-toggle-button'].disabled === false &&
        sandboxStartupPending.__chainCanvas.inert === false &&
        sandboxStartupPending.__chainCanvas.started === 1,
      'K6: the accepted startup transaction performs the single control unlock'
    );
  }

  // The inverse ordering matters too: if a real suspension is surfaced
  // while restoration is pending, startup completion must not erase that
  // loss token. The later running event owns the recovery and must re-gate
  // Start as well as restoring Live.
  {
    nextAudioContextInitialState = 'running';
    var sandboxStartupSuspended = createSandbox();
    var finishSuspendedStartupRestore;
    var suspendedStartupApplyCount = 0;
    sandboxStartupSuspended.ChainEditing = {
      apply: function () {
        suspendedStartupApplyCount += 1;
        return new Promise(function (resolve) {
          finishSuspendedStartupRestore = resolve;
        });
      }
    };
    loadSrc(sandboxStartupSuspended, 'src/audio-engine.js');
    loadSrc(sandboxStartupSuspended, 'src/main.js');
    var suspendedStartButton = sandboxStartupSuspended.__els['start-button'];
    suspendedStartButton.__fire('click');
    check(gumQueue.length === 1, 'K7: startup mic acquisition is pending');
    resolveGumAt(0, 'd1');
    await settle();
    var suspendedStartupContext = createdContexts[createdContexts.length - 1];
    suspendedStartupContext.__setState('suspended');
    await settle();
    check(
      sandboxStartupSuspended.__els['status-text'].textContent === 'Audio engine paused. Press Stop, then Start to resume.' &&
        (suspendedStartButton.textContent === 'Stop' && suspendedStartButton.disabled === false) &&
        sandboxStartupSuspended.__chainCanvas.inert === true,
      'K7: suspension during restoration stays gated until the startup transaction settles'
    );
    check(
      suspendedStartButton.textContent === 'Stop' && !suspendedStartButton.disabled &&
        gumQueue.length === 0 && suspendedStartupApplyCount === 1,
      'K7: the pending startup offers Stop instead of another Start'
    );
    finishSuspendedStartupRestore({ applied: true, saved: true, mode: 'structural' });
    await settle();
    check(
      sandboxStartupSuspended.__els['status-text'].textContent === 'Audio engine paused. Press Stop, then Start to resume.' &&
        sandboxStartupSuspended.__els['status'].classList.contains('error') &&
        !sandboxStartupSuspended.__els['status'].classList.contains('live') &&
        sandboxStartupSuspended.__chainCanvas.inert === true &&
        sandboxStartupSuspended.__meterTaps.started === 0 &&
        sandboxStartupSuspended.__meterTaps.stopped === 1 &&
        suspendedStartButton.disabled === false,
      'K7: finalization preserves the paused loss and stopped meters until recovery'
    );
    suspendedStartupContext.__setState('running');
    await settle();
    check(
      sandboxStartupSuspended.__els['status-text'].textContent === 'Live' &&
        sandboxStartupSuspended.__els['status'].classList.contains('live') &&
        (suspendedStartButton.textContent === 'Stop' && suspendedStartButton.disabled === false) &&
        sandboxStartupSuspended.__els['input-device-select'].disabled === false &&
        sandboxStartupSuspended.__els['bypass-toggle-button'].disabled === false &&
        sandboxStartupSuspended.__chainCanvas.inert === false &&
        sandboxStartupSuspended.__meterTaps.started === 1,
      'K7: the later running event completes recovery and meters with Stop available'
    );
  }

  // --------------------------------------------------------------------
  console.log('L. startup restore failure falls back safely through the ChainEditing adapter');
  // --------------------------------------------------------------------
  {
    var sandbox3 = createSandbox();
    var startupRequests = [];
    var restoredAutosave = null;
    sandbox3.Persistence = {
      loadInitialModel: function () {
        return [{ id: 'saved', type: 'gain', params: { gainDb: 1 } }];
      },
      loadInitialLayout: function () {
        return { saved: { x: 32, y: 16 } };
      },
      saveCurrentChain: function (model, layout) {
        restoredAutosave = { model: model, layout: layout };
        return { saved: true };
      }
    };
    sandbox3.ChainEditing = {
      apply: function (request) {
        startupRequests.push(request);
        if (request.candidate.length === 0) {
          return Promise.resolve({ applied: true, saved: true, mode: 'structural' });
        }
        var rejection = new Error('saved chain could not become live');
        rejection.code = 'CHAIN_APPLY_FAILED';
        rejection.rollback = { attempted: true, succeeded: true };
        return Promise.reject(rejection);
      }
    };
    loadSrc(sandbox3, 'src/audio-engine.js');
    loadSrc(sandbox3, 'src/main.js');
    var startBtn3 = sandbox3.__els['start-button'];
    startBtn3.__fire('click');
    check(gumQueue.length === 1, 'L1: startup mic acquisition is pending');
    resolveGumAt(0, 'd1');
    await settle();
    check(
      startupRequests[0] && startupRequests[0].source === 'startup' &&
        startupRequests[0].forceStructural === true && startupRequests[0].candidate[0].id === 'saved',
      'L1: the real startup adapter routes the saved chain through ChainEditing'
    );
    check(
      startupRequests.length === 2 && startupRequests[1].candidate.length === 0 &&
        sandbox3.AudioEngine.isStarted === true &&
        sandbox3.__els['status-text'].textContent ===
          'Stopped. Saved chain could not load, so no effects are active.' &&
        !sandbox3.__els['status'].classList.contains('live') &&
        sandbox3.__chainCanvas.inert === true &&
        sandbox3.__els['bypass-toggle-button'].disabled === true &&
        restoredAutosave && restoredAutosave.model[0].id === 'saved',
      'L2: rejected restoration preserves the saved model but stays gated while resume is pending'
    );
    createdContexts[createdContexts.length - 1].__settleResume();
    await settle();
    check(
      sandbox3.__els['status-text'].textContent ===
          'Live. Saved chain could not load, so no effects are active.' &&
        sandbox3.__els['status'].classList.contains('live') &&
        sandbox3.__chainCanvas.inert === false &&
        sandbox3.__els['bypass-toggle-button'].disabled === false,
      'L3: late resume unlocks the session without erasing the startup restore warning'
    );
  }

  // --------------------------------------------------------------------
  console.log('N. headphone check: Start asks BEFORE the microphone opens');
  // --------------------------------------------------------------------
  // The room-feedback hazard is created by getUserMedia, not by anything
  // after it: mic into the system output, output back into the mic. So
  // the check has to sit in FRONT of acquisition — a warning shown after
  // the stream is live is a warning shown after the howl. These checks
  // pin exactly that ordering, plus the two properties that make the
  // dialog safe to put in the Start path at all: a dismissal leaves
  // nothing to undo, and the confirming click still runs the start
  // transaction SYNCHRONOUSLY (Safari's RQ-4 gesture requirement — an
  // await between the click and AudioContext.resume() would break audio
  // on Safari, so this is a real regression risk, not a style point).
  {
    var hpSandbox = createSandbox({ headphoneCheck: true });
    loadSrc(hpSandbox, 'src/audio-engine.js');
    loadSrc(hpSandbox, 'src/main.js');
    var hpStart = hpSandbox.__els['start-button'];
    var hpDialog = hpSandbox.__els['headphone-check'];
    var hpConfirm = hpSandbox.__els['headphone-check-confirm'];
    var hpCancel = hpSandbox.__els['headphone-check-cancel'];
    var gumBefore = gumQueue.length;

    hpStart.__fire('click');
    check(
      hpDialog.open === true && hpDialog.__showModalCalls === 1,
      'N1: the first Start opens the headphone check'
    );
    check(
      gumQueue.length === gumBefore && hpSandbox.AudioEngine.isStarted === false,
      'N1: no microphone is acquired while the question is on screen'
    );
    check(
      hpStart.disabled === false &&
        hpSandbox.__els['status-text'].textContent !== 'Waiting for microphone permission...',
      'N1: Start is not consumed by merely asking'
    );

    hpCancel.__fire('click');
    check(hpDialog.open === false, 'N2: "Not yet" closes the check');
    check(
      gumQueue.length === gumBefore && hpSandbox.AudioEngine.isStarted === false &&
        hpStart.disabled === false,
      'N2: a dismissal leaves nothing acquired and nothing to undo'
    );
    check(
      hpStart.__focusCount === 1,
      'N2: focus goes back to the control the operator pressed'
    );

    // Escape takes the same route (the dialog closes itself, main.js only
    // sees the close event) — assert the recovery, not the browser.
    hpStart.__fire('click');
    check(hpDialog.open === true && hpDialog.__showModalCalls === 2,
      'N3: a declined check does not suppress the next ask');
    hpDialog.close();
    check(hpDialog.open === false && hpStart.__focusCount === 2 &&
        hpSandbox.AudioEngine.isStarted === false,
      'N3: Escape-style close recovers identically to the button');

    hpStart.__fire('click');
    check(hpDialog.open === true, 'N4: the check is up for the confirming click');
    hpConfirm.__fire('click');
    // Synchronously, inside that same click: no await has run yet.
    check(
      gumQueue.length === gumBefore + 1,
      'N4: confirming acquires the microphone SYNCHRONOUSLY in its own click (RQ-4)'
    );
    check(
      (hpStart.textContent === 'Stop' && hpStart.disabled === false) &&
        hpSandbox.__els['status-text'].textContent === 'Waiting for microphone permission...',
      'N4: confirming runs the real start transaction, not a copy of it'
    );
    check(hpDialog.open === false, 'N4: the check closes itself once it has been answered');
    check(
      hpStart.__focusCount === 2,
      'N4: closing after a confirm leaves focus handling to the dialog'
    );

    resolveGumAt(gumQueue.length - 1, 'hp1');
    await settle();
    check(hpSandbox.AudioEngine.isStarted === true, 'N5: the confirmed start completes normally');

    // Asked once per page LOAD: a later Start (after a stop, a lost
    // context, a failed switch) must not re-interrogate the operator
    // about a room that has not changed.
    hpSandbox.AudioEngine.stop('test');
    await settle();
    var showsBefore = hpDialog.__showModalCalls;
    hpStart.disabled = false;
    hpStart.__fire('click');
    check(
      hpDialog.__showModalCalls === showsBefore && hpDialog.open === false,
      'N6: an acknowledged operator is not asked again this page load'
    );
    check(
      hpSandbox.__els['status-text'].textContent === 'Waiting for microphone permission...',
      'N6: that later Start goes straight through to the start transaction'
    );
  }

  // --------------------------------------------------------------------
  console.log('O. the shipped page actually carries the check');
  // --------------------------------------------------------------------
  {
    var indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check(
      /<dialog[^>]*id="headphone-check"/.test(indexHtml),
      'O1: index.html ships #headphone-check as a native <dialog>'
    );
    check(
      /id="headphone-check-confirm"/.test(indexHtml) &&
        /id="headphone-check-cancel"/.test(indexHtml),
      'O1: both answers exist in the shipped markup'
    );
    // DOM order IS the keyboard default: showModal() focuses the first
    // focusable child, and that must be the harmless answer.
    check(
      indexHtml.indexOf('id="headphone-check-cancel"') <
        indexHtml.indexOf('id="headphone-check-confirm"'),
      'O2: "Not yet" precedes the confirm, so the keyboard default is the safe one'
    );
    // The check must not be inside either view container, or switching
    // views could hide the one thing standing between Start and a howl.
    var simpleAt = indexHtml.indexOf('id="simple-layout"');
    var dialogAt = indexHtml.indexOf('id="headphone-check"');
    check(
      simpleAt !== -1 && dialogAt > simpleAt &&
        indexHtml.indexOf('id="headphone-check"', indexHtml.indexOf('</dialog>')) === -1,
      'O3: the check sits outside both view containers, like the rest of the safety floor'
    );
  }

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
