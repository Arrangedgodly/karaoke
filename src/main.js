// Bootstrap script for the Node-Based Web Audio Chain Builder.
// Loaded as a plain (non-module) script.
//
// UI-1: wires the real top bar in index.html (#start-button,
// #input-device-select, #status/#status-dot/#status-text) up to
// window.AudioEngine, defined in src/audio-engine.js (loaded before this
// file). This replaces the old temporary AE-1 test-harness markup — the
// functional calls below (AudioEngine.start(), AudioGraph.buildGraph(),
// AudioBypass.reconnectSource(), device listing/switching) are unchanged
// from AE-1/AE-2/AE-3; only how status is displayed, and where the controls
// live in the DOM, has changed.
//
// UI-2: the #bypass-toggle-button visual/interaction polish (the .bypass-btn
// / .bypass-btn.engaged styling in styles/main.css, plus the global spacebar
// shortcut below) is this task's scope. The underlying audio routing is
// still AE-3's window.AudioBypass — click and spacebar both just call
// toggle()/isEngaged(), unchanged from AE-3.
//
// UI-3: the real palette + chain canvas (src/canvas.js, wired to
// #palette-list/#chain-list/#empty-hint/#chain-layout in index.html)
// replaces the old temporary AE-5 #ae5-test-harness section entirely. The
// only wiring this file needs to do for it is call
// window.ChainCanvas.onEngineStarted() once AudioEngine.start() succeeds
// (mirrors enabling the Bypass button just below it) — canvas.js owns
// everything else about the palette/canvas itself.

console.log('App scaffold loaded');

(function () {
  'use strict';

  var startButton = document.getElementById('start-button');
  var deviceSelect = document.getElementById('input-device-select');
  var statusWrapper = document.getElementById('status');
  var statusTextEl = document.getElementById('status-text');
  var bypassButton = document.getElementById('bypass-toggle-button');

  if (!startButton || !deviceSelect) {
    // Top-bar markup isn't present (e.g. not yet built, or restructured
    // again by a later task) — nothing to wire up.
    return;
  }

  // Single source of truth for the button's visible state: both the text
  // and the `engaged` class (which drives the .bypass-btn.engaged styling
  // in styles/main.css — solid fill + glow, per px1-layout-spec.md) are
  // derived from the same AudioBypass.isEngaged() read, every time, so they
  // can never drift out of sync with each other or with the real audio
  // routing state.
  function setBypassButtonLabel() {
    if (bypassButton) {
      var isEngaged = window.AudioBypass.isEngaged();
      bypassButton.textContent = 'Bypass: ' + (isEngaged ? 'ON' : 'OFF');
      bypassButton.classList.toggle('engaged', isEngaged);
    }
  }

  function toggleBypass() {
    window.AudioBypass.toggle();
    setBypassButtonLabel();
  }

  if (bypassButton) {
    bypassButton.addEventListener('click', toggleBypass);

    // UI-2 keyboard shortcut: spacebar toggles bypass globally (per
    // px1-layout-spec.md: "keyboard shortcut (e.g. spacebar) in addition to
    // click"), without requiring the button itself to be focused — this is
    // the app's emergency control, so it must work no matter where focus
    // happens to be.
    //
    // Two guards keep this from misbehaving:
    //  - Skip when focus is on a form control where space has its own
    //    native meaning (e.g. the device <select>, where space opens the
    //    dropdown; also text inputs/textareas). Only body, the bypass
    //    button itself, or other non-form-control elements pass through.
    //  - Skip while the button is disabled — mirrors the button's own
    //    disabled state (bypass is meaningless before AudioEngine.start()
    //    succeeds; there's no live source node to bypass yet).
    document.addEventListener('keydown', function (event) {
      if (event.code !== 'Space' && event.key !== ' ') {
        return;
      }

      var active = document.activeElement;
      var activeTag = active && active.tagName;
      var isFormControl = activeTag === 'SELECT' || activeTag === 'INPUT' || activeTag === 'TEXTAREA';
      if (isFormControl && active !== bypassButton) {
        return;
      }

      if (bypassButton.disabled) {
        return;
      }

      // Prevent the default spacebar page-scroll (browsers scroll when no
      // form control has focus) now that we're actually handling it.
      event.preventDefault();
      toggleBypass();
    });
  }

  // UI-3 (deferred, out of scope here): dimming/desaturating the chain
  // canvas while bypass is engaged, per px1-layout-spec.md's "Bypass
  // engaged vs. normal" state row. Flagging as still-deferred rather than
  // silently building it — the real canvas exists now (src/canvas.js), but
  // this specific bypass-interaction visual wasn't part of UI-3's own task
  // spec, so it isn't added here as an incidental side effect.

  // Drives the top bar's status dot + text. `text` is the label shown
  // (e.g. "Live", "Stopped", or an error message); `isLive` toggles the
  // `.live` class on the wrapper, which is what turns the dot green (see
  // `.status.live .dot` in styles/main.css) versus its default gray.
  function setStatus(text, isLive) {
    if (statusTextEl) {
      statusTextEl.textContent = text;
    }
    if (statusWrapper) {
      statusWrapper.classList.toggle('live', !!isLive);
    }
  }

  // Derives Live/Stopped from the same underlying state the rest of the
  // app already relies on: AudioEngine.isStarted and the AudioContext's
  // own .state. Not a separate piece of UI state to keep in sync.
  function isEngineLive() {
    var audioContext = window.AudioEngine.audioContext;
    return window.AudioEngine.isStarted && !!audioContext && audioContext.state === 'running';
  }

  function populateDeviceList(selectedDeviceId) {
    return window.AudioEngine.listInputDevices().then(function (devices) {
      deviceSelect.innerHTML = '';

      if (devices.length === 0) {
        var emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- no input devices found --';
        deviceSelect.appendChild(emptyOpt);
        deviceSelect.disabled = true;
        return;
      }

      devices.forEach(function (device, index) {
        var opt = document.createElement('option');
        opt.value = device.deviceId;
        opt.textContent = device.label || ('Input device ' + (index + 1));
        if (device.deviceId === selectedDeviceId) {
          opt.selected = true;
        }
        deviceSelect.appendChild(opt);
      });

      deviceSelect.disabled = false;
    });
  }

  startButton.addEventListener('click', function () {
    // AudioEngine.start() is called synchronously, right here, in the
    // click handler. Inside it, the AudioContext is created and
    // .resume()'d synchronously before any `await` (including before
    // `await getUserMedia()`) — see the detailed comment on
    // AudioEngine.start() in src/audio-engine.js. This ordering is what
    // satisfies Safari's "resume() must happen within a user gesture"
    // requirement (RQ-4); do not move this call behind any prior await.
    startButton.disabled = true;
    setStatus('Requesting mic access...', false);

    window.AudioEngine.start()
      .then(function (result) {
        // PS-2: load the initial chain rather than always starting from an
        // empty model. window.Persistence.loadInitialModel() returns
        // whatever was last autosaved, or (nothing saved yet, e.g. first
        // run or cleared localStorage) PX-3's "Classic Karaoke" default —
        // see src/persistence.js and src/default-preset.js. Routing through
        // window.ChainCanvas.loadModel() (rather than calling
        // AudioGraph.buildGraph() directly) is what actually populates the
        // palette/canvas UI with real node cards for the restored model, in
        // addition to building the live audio graph — loadModel() calls
        // rebuildGraph() (-> AudioGraph.buildGraph()) internally, so this
        // replaces the old direct buildGraph([]) call rather than adding a
        // second graph build alongside it.
        var initialModel = window.Persistence ? window.Persistence.loadInitialModel() : [];
        if (window.ChainCanvas) {
          window.ChainCanvas.loadModel(initialModel);
        } else {
          window.AudioGraph.buildGraph(initialModel);
        }

        // AE-3: (re-)establish the independent bypass dry tap now that
        // sourceNode exists. Must be called any time sourceNode changes —
        // see the comment on AudioBypass.reconnectSource() in
        // src/audio-bypass.js.
        window.AudioBypass.reconnectSource();
        if (bypassButton) {
          bypassButton.disabled = false;
        }
        setBypassButtonLabel();

        // UI-3: un-gate the palette/chain canvas now that there's a live
        // audioContext/sourceNode for AudioGraph.buildGraph() to build
        // against — mirrors how bypassButton is enabled just above.
        if (window.ChainCanvas) {
          window.ChainCanvas.onEngineStarted();
        }

        // FEW-3: meter side-taps + runtime watchdog. Now that
        // audioContext/sourceNode exist AND the first buildGraph() has
        // run (loadModel above), create/reconnect the two AnalyserNode
        // taps (IN off AudioEngine.sourceNode, OUT off the persistent
        // chainGate — docs/ultron/research/rq4-meters.md), flip
        // window.Meters live (setEngineState(true)), and start the one
        // shared rAF loop that feeds both meters and the rq3 watchdog
        // every frame. See src/meter-taps.js.
        if (window.MeterTaps) {
          window.MeterTaps.onEngineStarted();
        }

        // FEW-2: fill the VIS-2 status-LCD readouts with real engine
        // values — RATE from context.sampleRate, LATENCY from
        // baseLatency+outputLatency (the context-REPORTED estimate —
        // a different figure from cycle-1 QA-4's slow-mo measured
        // ~12 ms, not a replacement for it), and NODES, refreshed at
        // 1 Hz off ChainCanvas's live model. window.AudioEngine's
        // audioContext GETTER is the real access path here (same one
        // isEngineLive() above reads) — never the Start result object,
        // which could go stale if the context is ever recreated. See
        // src/status-readouts.js.
        if (window.StatusReadouts) {
          window.StatusReadouts.onEngineStarted(window.AudioEngine.audioContext);
        }

        setStatus(isEngineLive() ? 'Live' : 'Stopped', isEngineLive());

        return populateDeviceList(window.AudioEngine.currentDeviceId);
      })
      .catch(function (err) {
        console.error('AudioEngine failed to start:', err);
        setStatus('Failed to start (' + err.message + ')', false);
        startButton.disabled = false;
      });
  });

  deviceSelect.addEventListener('change', function () {
    var deviceId = deviceSelect.value;
    if (!deviceId) {
      return;
    }

    window.AudioEngine.switchInputDevice(deviceId)
      .then(function () {
        // A device switch creates a fresh MediaStreamAudioSourceNode (see
        // the comment on switchInputDevice() in audio-engine.js for why),
        // which isn't connected to anything yet — rebuild the graph against
        // the current model (still `[]` for now; AE-2 introduces no real
        // nodes) so the new source is reconnected through to destination.
        window.AudioGraph.buildGraph(window.AudioGraph.getModel());

        // AE-3: the new sourceNode also isn't connected to the bypass tap
        // yet — re-establish it, exactly parallel to the buildGraph() call
        // above. See the comment on AudioBypass.reconnectSource() in
        // src/audio-bypass.js.
        window.AudioBypass.reconnectSource();

        // FEW-3: the meter IN tap must follow the new sourceNode too —
        // the old one is dead (switchInputDevice() above stopped its
        // stream and blanket-disconnected it). The OUT tap's chainGate
        // connection survives every rebuild by design, so only the IN
        // side is re-tapped; Meters.reset() clears the visual ballistics
        // for the new input. See src/meter-taps.js.
        if (window.MeterTaps) {
          window.MeterTaps.onDeviceSwitched(window.AudioEngine.sourceNode);
        }

        setStatus(isEngineLive() ? 'Live' : 'Stopped', isEngineLive());
      })
      .catch(function (err) {
        console.error('Failed to switch input device:', err);
        // The old stream/source node is untouched until the new one is
        // successfully obtained (see switchInputDevice() in
        // audio-engine.js), so a failed switch doesn't change whether the
        // engine itself is still live — only the attempted switch failed.
        setStatus('Failed to switch device (' + err.message + ')', isEngineLive());
      });
  });
})();
