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
  var startHintEl = document.getElementById('start-hint');
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

  // ---------------------------------------------------------------------
  // Refinement entry 3 ($impeccable harden, 2026-08-28) — operator-voice
  // error copy for mic failures. getUserMedia rejections (a failed Start
  // or a failed device switch) arrive as DOMExceptions whose `.name` is
  // the stable machine identity of the failure; the map below turns that
  // name into a plain WHAT HAPPENED sentence plus a concrete NEXT ACTION,
  // instead of the old dead-end "Failed to start (Permission denied)"
  // (critique P1 #3). The raw technical string (name: message) is kept
  // but DEMOTED to a muted mono footnote — the developer persona keeps
  // it, the operator no longer has to read it. Nothing is swallowed:
  // every path also console.error()s the full exception.
  //
  // Where each piece renders (the strip is geometrically tight — its
  // fixed blocks leave ~560px for status + hint copy, so long text is
  // budgeted, front-loaded, and capped in styles/main.css so an error
  // can never wrap the strip out of its one-row rhythm):
  //  - Failed START: WHAT HAPPENED (alone) on the strip status line —
  //    short enough to always read in full — and NEXT ACTION + the
  //    demoted footnote in the .start-hint beside Start (refinement
  //    entry 2's element; its visibility is CSS-keyed to Start's own
  //    disabled state, so it shows exactly while pressing Start is the
  //    true next action, which after a failed start is precisely the
  //    case). The hint's title attribute carries the full untruncated
  //    pair for hover.
  //  - Failed SWITCH: engine still live (Start stays disabled, hint
  //    hidden), so the status line itself carries WHAT HAPPENED + NEXT
  //    ACTION in one front-loaded sentence, with the footnote demoted
  //    inline.
  //
  // The two mappings that are NOT DOMExceptions: audio-engine.js's own
  // secure-context guard is a plain Error('getUserMedia is not
  // available (…)') — plain Errors share the name 'Error' with every
  // unmapped failure, so it is matched by its stable message text; and
  // anything unrecognized falls to an honest generic that still names a
  // retry step.
  // ---------------------------------------------------------------------
  var MIC_ERROR_COPY = {
    NotAllowedError: {
      line: 'Mic was blocked.',
      startAction:
        'Click the camera icon in the address bar \u2192 Microphone \u2192 Allow, then press Start.',
      switchLine: 'Mic blocked. Re-allow from the address-bar icon, then pick again.',
    },
    NotFoundError: {
      line: 'No mic was found.',
      startAction: 'Plug a mic in, then press Start.',
      switchLine: 'That mic is gone. Pick another from the dropdown.',
    },
    NotReadableError: {
      line: 'Mic is busy.',
      startAction: 'Close the other app using the mic, then press Start.',
      switchLine: 'That mic is busy. Close its app, then pick again.',
    },
    OverconstrainedError: {
      line: 'Could not start the engine.',
      startAction: 'Press Start to try again.',
      switchLine: 'That mic is gone. Pick another from the dropdown.',
    },
    SecurityError: {
      line: 'Mic blocked by browser.',
      startAction: 'Open Chrome at http://localhost:8000, then press Start.',
      switchLine: 'Browser blocked that mic. Pick another.',
    },
    AbortError: {
      line: 'Mic request cut off.',
      startAction: 'Press Start to try again.',
      switchLine: 'That mic did not respond. Pick it again.',
    },
  };

  // audio-engine.js's secure-context guard (served from file:// or a
  // non-localhost origin): only reachable on the Start path — switching
  // devices requires a started engine, which requires getUserMedia.
  var NO_GETUSERMEDIA_COPY = {
    line: 'Mic not available here.',
    startAction: 'Open Chrome at http://localhost:8000 (use the start file), then press Start.',
  };

  // Anything unmapped (TypeError, unknown names, non-Error rejections):
  // name the problem honestly, offer the retry, keep the technical
  // footnote — never a bare exception, never silence.
  var MIC_ERROR_FALLBACK = {
    line: 'Could not start.',
    startAction: 'Press Start to try again.',
    switchLine: 'Could not switch. Pick another mic, then try again.',
  };

  // The demoted footnote: "Name: message" in the mono register.
  function errorFootnote(err) {
    if (!err) {
      return '';
    }
    var name = err.name || 'Error';
    return err.message ? name + ': ' + err.message : name;
  }

  /** Map a mic failure to operator copy. `forSwitch` selects the
   *  device-switch variant (next action folded into the line, since the
   *  start-hint is hidden while the engine is live). */
  function micErrorCopy(err, forSwitch) {
    var entry = null;
    if (err && err.name === 'Error' && String(err.message).indexOf('getUserMedia is not available') !== -1) {
      entry = NO_GETUSERMEDIA_COPY;
    } else if (err) {
      entry = MIC_ERROR_COPY[err.name] || null;
    }
    if (!entry) {
      entry = MIC_ERROR_FALLBACK;
    }
    return {
      line: forSwitch ? (entry.switchLine || entry.line) : entry.line,
      action: entry.startAction,
      footnote: errorFootnote(err),
    };
  }

  // Drives the top bar's status dot + text. `text` is the label shown
  // (e.g. "Live", "Stopped", or an operator error sentence); `isLive`
  // toggles the `.live` class on the wrapper, which is what turns the
  // dot green (see `.status.live .dot` in styles/main.css) versus its
  // default gray. `detail` (entry 3), when present, is appended as a
  // demoted mono footnote span (.status-detail) — the technical string
  // riding along at lowered rank, not replacing the operator sentence.
  // Any non-error call also clears a stale `.error` class, so the error
  // register lasts exactly until the next state change.
  function setStatus(text, isLive, detail) {
    if (statusTextEl) {
      statusTextEl.textContent = text;
      if (detail) {
        var detailEl = document.createElement('span');
        detailEl.className = 'status-detail';
        detailEl.textContent = ' (' + detail + ')';
        statusTextEl.appendChild(detailEl);
      }
    }
    if (statusWrapper) {
      statusWrapper.classList.toggle('live', !!isLive);
      statusWrapper.classList.remove('error');
    }
  }

  // Entry 3: error variant of setStatus. Raises the sentence to the
  // status-error register (rq5's Error Coral) while the DOT keeps
  // telling the engine truth — `isLive` is preserved, because a failed
  // device switch does not stop a running engine.
  function setErrorStatus(line, detail, isLive) {
    setStatus(line, isLive, detail);
    if (statusWrapper) {
      statusWrapper.classList.add('error');
    }
  }

  // Entry 3: after a failed Start, the recovery NEXT ACTION (with the
  // demoted technical footnote appended) replaces entry 2's default hint
  // copy ("Press Start to power on") — the hint region is hidden while
  // Start is disabled, so this text is only ever seen in the state where
  // acting on it is possible. The default copy needs no restore path: it
  // matters only before the first attempt, and every later failure
  // overwrites it with that failure's action. The element's width is
  // capped in styles/main.css, so the full pair also goes into its title
  // attribute (hover/long-press — the same native mechanism entry 2 uses
  // on param rows).
  function setStartHint(text, footnote) {
    if (!startHintEl) {
      return;
    }
    startHintEl.textContent = text;
    if (footnote) {
      var detailEl = document.createElement('span');
      detailEl.className = 'status-detail';
      detailEl.textContent = ' (' + footnote + ')';
      startHintEl.appendChild(detailEl);
    }
    startHintEl.title = footnote ? text + ' (' + footnote + ')' : text;
  }

  // Derives Live/Stopped from the same underlying state the rest of the
  // app already relies on: AudioEngine.isStarted, the AudioContext's own
  // .state, and (issue #4) the live track itself — a track that ended, or
  // a session torn down after device removal, is NOT live no matter what
  // the context says. Not a separate piece of UI state to keep in sync.
  function isEngineLive() {
    var engine = window.AudioEngine;
    var audioContext = engine.audioContext;
    // (isTrackLive is a GETTER on AudioEngine; a value of undefined —
    // e.g. an older engine — falls back to the pre-#4 meaning of started.)
    var trackLive = engine.isTrackLive !== false;
    return engine.isStarted && trackLive && !!audioContext && audioContext.state === 'running';
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

      var anySelected = false;
      devices.forEach(function (device, index) {
        var opt = document.createElement('option');
        opt.value = device.deviceId;
        opt.textContent = device.label || ('Input device ' + (index + 1));
        if (device.deviceId === selectedDeviceId) {
          opt.selected = true;
          anySelected = true;
        }
        deviceSelect.appendChild(opt);
      });

      // Issue #4: the selector must reflect the stream that is actually
      // active — write .value too (not just the option's .selected), so a
      // rebuild after a loss/device removal moves it off a dead device.
      if (!anySelected && devices.length) {
        deviceSelect.children[0].selected = true;
      }
      var selOpt = null;
      deviceSelect.children.forEach(function (o) {
        if (o.selected) {
          selOpt = o;
        }
      });
      deviceSelect.value = selOpt ? selOpt.value : '';

      deviceSelect.disabled = false;
    });
  }

  // ---------------------------------------------------------------------
  // Issue #4 — audio lifecycle loss detection + recovery. The engine
  // (src/audio-engine.js) watches AudioContext.statechange, the active
  // track's ended/mute/unmute, and mediaDevices.devicechange, and
  // forwards them via AudioEngine.onLifecycle(). Everything below only
  // decides what the OPERATOR sees, reusing entry 3's exact vocabulary
  // (setErrorStatus for the strip, setStartHint for the recovery NEXT
  // ACTION — the hint is CSS-keyed to Start's disabled state, so
  // re-enabling Start below is what surfaces the instruction; no new UI).
  //
  // Every loss path ends with the strip provably NOT reading Live: the
  // .live class comes off (setErrorStatus's isLive argument is false) and
  // the .error register goes on. Meters/watchdog stop via the EXISTING
  // MeterTaps.onEngineStopped() hook — which preserves the #3 latch by
  // design (a latched trip survives and only the human Restore button
  // clears it).
  // ---------------------------------------------------------------------

  // Recovery copy in the entry-3 operator voice: WHAT HAPPENED on the
  // strip, NEXT ACTION in the start-hint (visible exactly because Start
  // is re-enabled).
  var LOSS_COPY = {
    ended: {
      line: 'Mic was unplugged.',
      action: 'Pick another mic from the dropdown, then press Start.',
    },
    device: {
      line: 'Mic was unplugged.',
      action: 'Pick another mic from the dropdown, then press Start.',
    },
    context: {
      line: 'Audio engine paused.',
      action: 'Press Start to resume audio.',
    },
  };

  // True between a context-suspend loss and its recovery — keeps a
  // resumed context from "recovering" a session that lost its track in
  // the meantime.
  var contextLost = false;

  function surfaceLoss(copy) {
    setErrorStatus(copy.line, null, false);
    setStartHint(copy.action);
    // The gating recovery action: with Start re-enabled, the hint above
    // is visible and pressing Start is the one-click retry (start()
    // rebuilds the session fresh — see its recovery path in
    // audio-engine.js).
    startButton.disabled = false;
    if (bypassButton) {
      bypassButton.disabled = true; // no live source to bypass anymore
    }
    if (window.MeterTaps) {
      window.MeterTaps.onEngineStopped(); // stops the loop; KEEPS the #3 latch
    }
  }

  function recoverFromLoss() {
    // The dual of surfaceLoss: a live engine again — re-gate Start (which
    // re-hides the hint) and restart the meters/watchdog loop (latch-aware
    // by design; a latched trip keeps defending its mute).
    startButton.disabled = true;
    if (bypassButton) {
      bypassButton.disabled = false;
    }
    if (window.MeterTaps) {
      window.MeterTaps.onEngineStarted();
    }
    setStatus(isEngineLive() ? 'Live' : 'Stopped', isEngineLive());
  }

  function handleContextState(state) {
    if (state === 'running') {
      if (contextLost) {
        contextLost = false;
        if (isEngineLive()) {
          // The stream survived the suspension (OS interruption, tab
          // throttle): recover in place — no operator action needed.
          recoverFromLoss();
        }
        // else: the track was lost while suspended — the track-lost loss
        // state below already owns the strip and Start; leave it.
      }
      return;
    }
    if (state !== 'suspended' && state !== 'interrupted' && state !== 'closed') {
      return;
    }
    // Only a session that WOULD otherwise read Live is a visible loss; a
    // suspended context before the first start (or after a track loss)
    // must not stomp the existing status.
    if (window.AudioEngine.isStarted && !contextLost) {
      contextLost = true;
      surfaceLoss(LOSS_COPY.context);
    }
  }

  function handleDeviceChange() {
    // Re-enumerate; if the ACTIVE device is gone while live, that IS a
    // track loss (the engine tears the stream down and emits track-lost —
    // the handler below surfaces it), and the dropdown must stop offering
    // the dead device either way.
    window.AudioEngine.listInputDevices().then(function (devices) {
      var activeId = window.AudioEngine.currentDeviceId;
      var activeGone =
        !!activeId &&
        window.AudioEngine.isStarted &&
        !devices.some(function (d) { return d.deviceId === activeId; });
      if (activeGone) {
        window.AudioEngine.forceStreamLoss('device'); // emits track-lost
      }
      var selectId = activeGone ? (devices.length ? devices[0].deviceId : null) : activeId;
      return populateDeviceList(selectId);
    });
  }

  if (typeof window.AudioEngine.onLifecycle === 'function') {
    window.AudioEngine.onLifecycle(function (evt) {
      if (!evt) {
        return;
      }
      if (evt.type === 'context-state') {
        handleContextState(evt.state);
      } else if (evt.type === 'track-lost') {
        contextLost = false; // a dead track supersedes any suspend state
        surfaceLoss(LOSS_COPY[evt.reason] || LOSS_COPY.ended);
      } else if (evt.type === 'track-muted') {
        // Transient note only — the track is still live, so the dot stays
        // truthful via isEngineLive().
        setStatus('Mic muted.', isEngineLive());
      } else if (evt.type === 'track-unmuted') {
        setStatus(isEngineLive() ? 'Live' : 'Stopped', isEngineLive());
      } else if (evt.type === 'device-change') {
        handleDeviceChange();
      }
    });
  }

  /** Issue #4: snap the dropdown to the stream that is ACTUALLY active
   *  (AudioEngine.currentDeviceId) — the selector's truth source after a
   *  switch completes (fresh or stale) or fails, so a stale completion can
   *  never leave the UI showing a device whose stream is not live. */
  function reconcileSelector() {
    var activeId = window.AudioEngine.currentDeviceId;
    if (activeId && deviceSelect.value !== activeId) {
      deviceSelect.value = activeId;
    }
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
        contextLost = false; // issue #4: a fresh start clears any suspend state

        return populateDeviceList(window.AudioEngine.currentDeviceId);
      })
      .catch(function (err) {
        console.error('AudioEngine failed to start:', err);
        // Entry 3: the short WHAT HAPPENED sentence alone on the status
        // line (it must read in full even on the tight strip); the NEXT
        // ACTION + demoted technical footnote land in the .start-hint
        // beside Start, which the re-enable below immediately un-hides.
        var copy = micErrorCopy(err, false);
        setErrorStatus(copy.line, null, false);
        setStartHint(copy.action, copy.footnote);
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
        // Issue #4: the selector reflects the ACTIVE stream's device, not
        // merely whatever was last picked.
        reconcileSelector();
      })
      .catch(function (err) {
        // Issue #4: a STALE completion (a newer switch/Start superseded
        // this one — the engine already stopped and discarded its stream)
        // is not an operator-visible failure: the newer request owns the
        // outcome. Only re-anchor the selector to the actually-active
        // device so the strip and dropdown tell one story.
        if (err && err.stale) {
          reconcileSelector();
          return;
        }
        console.error('Failed to switch input device:', err);
        // The old stream/source node is untouched until the new one is
        // successfully obtained (see switchInputDevice() in
        // audio-engine.js), so a failed switch doesn't change whether the
        // engine itself is still live — only the attempted switch failed.
        // Entry 3: while live, the hint region is hidden (Start stays
        // disabled), so the switchLine carries what happened AND the next
        // action; the lamp stays truthful via isEngineLive().
        var copy = micErrorCopy(err, true);
        setErrorStatus(copy.line, copy.footnote, isEngineLive());
        // Issue #4: the failed pick is not the active device — snap the
        // selector back to the stream that is actually live.
        reconcileSelector();
      });
  });
})();
