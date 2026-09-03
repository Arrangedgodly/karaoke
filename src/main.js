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
  // #16 finding: the latched autosave-failure warning. Shown while
  // window.Persistence.isSaveFailed() is true; driven by the module's
  // 'chain-autosave-failed' / 'chain-autosave-recovered' events so the
  // element only ever reflects VERIFIED save outcomes (it clears exactly
  // when a later save succeeds — never on a timer).
  var autosaveWarningEl = document.getElementById('autosave-warning');
  function updateAutosaveWarning() {
    if (!autosaveWarningEl) {
      return;
    }
    var failed = false;
    try {
      failed = !!(window.Persistence &&
        typeof window.Persistence.isSaveFailed === 'function' &&
        window.Persistence.isSaveFailed());
    } catch (err) {
      failed = false;
    }
    autosaveWarningEl.hidden = !failed;
  }
  ['chain-autosave-failed', 'chain-autosave-recovered'].forEach(function (evtName) {
    document.addEventListener(evtName, updateAutosaveWarning);
  });
  // Refinement entry 5: the canvas panel carrying the bypassed indication
  // (class toggled in setBypassButtonLabel below, removed on lifecycle
  // loss — see surfaceLoss). Resolved lazily, not at load: the node-side
  // test harnesses stub `document` as a getElementById-only shim, and the
  // panel is only needed once the engine is live anyway. Null-safe like
  // every other element here.
  var canvasPanel = null;
  function getCanvasPanel() {
    if (!canvasPanel && typeof document.querySelector === 'function') {
      canvasPanel = document.querySelector('.canvas-panel');
    }
    return canvasPanel;
  }

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
  // routing state. Refinement entry 5: the same read now also toggles the
  // canvas panel's `bypassed` class (the chain-region de-emphasis in
  // styles/main.css), so strip button and canvas stay in lockstep too.
  /** The one read of bypass truth outside setBypassButtonLabel's own —
   *  guarded so a stripped harness (or a build without AudioBypass yet)
   *  answers "not engaged" rather than throwing on the status path. */
  function bypassEngaged() {
    return !!(
      window.AudioBypass &&
      typeof window.AudioBypass.isEngaged === 'function' &&
      window.AudioBypass.isEngaged()
    );
  }

  function setBypassButtonLabel() {
    var isEngaged = window.AudioBypass.isEngaged();
    if (bypassButton) {
      bypassButton.textContent = 'Bypass: ' + (isEngaged ? 'ON' : 'OFF');
      bypassButton.classList.toggle('engaged', isEngaged);
    }
    var canvasPanel = getCanvasPanel();
    if (canvasPanel) {
      canvasPanel.classList.toggle('bypassed', isEngaged);
    }
    // The Simple stage carries the same state (harden round, 2026-09-02
    // critique P1): its "what am I hearing" face must not keep naming a
    // sound while the chain is gated to silence. Same seam pattern as
    // renderSimpleEngineState below — an absent SimpleView (a stripped
    // node-side harness) is a no-op, never a throw.
    if (window.SimpleView && typeof window.SimpleView.onBypassChanged === 'function') {
      window.SimpleView.onBypassChanged();
    }
  }

  function toggleBypass() {
    window.AudioBypass.toggle();
    setBypassButtonLabel();
    // liveStatusText() reads bypass, so the same gesture has to re-derive
    // the deck line — nothing else would, and the header would sit on a
    // stale LIVE until the next unrelated lifecycle event.
    //
    // Two guards: only while the engine is actually live (a stopped deck
    // says "Stopped" and bypass is meaningless there), and never over a
    // standing error — setStatus() clears the error class, so refreshing
    // through it would silently erase a failure the operator has not
    // dealt with yet.
    var hasError = !!(statusWrapper && statusWrapper.classList.contains('error'));
    if (isEngineLive() && !hasError) {
      setStatus(liveStatusText(), true);
    }
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
      //    dropdown; also text inputs/textareas, and BUTTON — R2-2: a
      //    focused palette chip's native space-activation must fire the
      //    add-to-chain click, not toggle bypass; the Bypass button itself
      //    is exempted below so its focused-space still toggles exactly
      //    once, via this handler's own preventDefault+toggle). Only body,
      //    the bypass button itself, other non-form-control elements, and
      //    RANGE KNOBS (see the isRangeKnob note below) pass through.
      //  - Skip while the button is disabled — mirrors the button's own
      //    disabled state (bypass is meaningless before AudioEngine.start()
      //    succeeds; there's no live source node to bypass yet).
      document.addEventListener('keydown', function (event) {
        if (event.code !== 'Space' && event.key !== ' ') {
          return;
        }

        var active = document.activeElement;
        var activeTag = active && active.tagName;
        // Harden round (2026-09-02 critique P2): every knob on the board
        // is a clipped input[type=range], and Space has NO native meaning
        // on a range input (arrows move it; Space does nothing) — so the
        // blanket INPUT skip left the emergency shortcut dead across the
        // entire encoder field, exactly where an operator's focus lives
        // mid-show. Range knobs pass through; every other input flavor
        // keeps the skip (there Space types, opens, or activates).
        var activeType = active && active.type !== undefined ? String(active.type) : '';
        var isRangeKnob = activeTag === 'INPUT' &&
          activeType.toLowerCase() === 'range';
        var isFormControl = !isRangeKnob && (
          activeTag === 'SELECT' || activeTag === 'INPUT' ||
          activeTag === 'TEXTAREA' || activeTag === 'BUTTON');
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

  // UI-3 note (superseded by refinement entry 5, 2026-08-29): the
  // dimming of the chain canvas while bypass is engaged — deferred here as
  // out of UI-3's scope — now EXISTS as the `bypassed` class on the
  // .canvas-panel, toggled by setBypassButtonLabel() above. Scope: only
  // the chain region (.chain-list node cards + .flow-toggle) recedes, to
  // the same 0.55 as the engine-not-started gate; anchors, meters, the
  // safe-output note, the watchdog alert, the empty-hint, and the
  // palette/presets flanks stay at full strength — the operator's ground
  // truth (output health, dry-path meters) must stay readable while the
  // dry path is what the room hears. See styles/main.css's entry-5 rules.

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
  //    session-active class, so it shows exactly while pressing Start is the
  //    true next action, which after a failed start is precisely the
  //    case). The hint's title attribute carries the full untruncated
  //    pair for hover.
  //  - Failed SWITCH: engine still live (the button offers Stop, hint
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
      line: 'Microphone access blocked.',
      startAction:
        'Allow Microphone for this page in Chrome site controls, then press Start.',
      switchLine: 'Microphone access is blocked. Allow it in site controls, then try again.',
    },
    NotFoundError: {
      line: 'No microphone found.',
      startAction: 'Connect a microphone, then press Start.',
      switchLine: 'That microphone is unavailable. Choose another.',
    },
    NotReadableError: {
      line: 'Microphone is in use.',
      startAction: 'Close the other app using it, then press Start.',
      switchLine: 'That microphone is in use. Close the other app, then choose it again.',
    },
    OverconstrainedError: {
      line: 'Could not use that microphone.',
      startAction: 'Press Start to try again.',
      switchLine: 'That microphone is unavailable. Choose another.',
    },
    SecurityError: {
      line: 'Browser blocked microphone access.',
      startAction: 'Open Chrome at http://localhost:8000, then press Start.',
      switchLine: 'Browser blocked microphone access. Check site controls, then try again.',
    },
    AbortError: {
      line: 'Microphone did not respond.',
      startAction: 'Press Start to try again.',
      switchLine: 'That microphone did not respond. Choose it again.',
    },
  };

  // audio-engine.js's secure-context guard (served from file:// or a
  // non-localhost origin): only reachable on the Start path — switching
  // devices requires a started engine, which requires getUserMedia.
  var NO_GETUSERMEDIA_COPY = {
    line: 'Microphone unavailable on this page.',
    startAction: 'Run the included start file, open http://localhost:8000 in Chrome, then press Start.',
  };

  // Anything unmapped (TypeError, unknown names, non-Error rejections):
  // name the problem honestly, offer the retry, keep the technical
  // footnote — never a bare exception, never silence.
  var MIC_ERROR_FALLBACK = {
    line: 'Could not start microphone audio.',
    startAction: 'Press Start to try again.',
    switchLine: 'Could not switch microphones. Choose another, then try again.',
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

  function deviceGraphError(cause, graphResult) {
    var err = cause && typeof cause === 'object'
      ? cause
      : new Error(cause ? String(cause) : 'The audio chain did not reconnect to the selected microphone.');
    err.deviceGraphFailure = true;
    if (graphResult) {
      err.graphResult = graphResult;
    }
    return err;
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
      // Copy AND colour, the house rule for every state change: the lamp
      // and the sentence go safety red together, matching the BYPASS key
      // that is lit red at the same moment. Only meaningful while live —
      // a stopped engine's bypass state is not what the deck is reporting.
      statusWrapper.classList.toggle('bypassed', !!isLive && bypassEngaged());
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
  // the button offers Stop, so this text is only seen in the state where
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
    var generation = sessionGeneration;
    return window.AudioEngine.listInputDevices().then(function (devices) {
      if (generation !== sessionGeneration) { return; }
      deviceSelect.innerHTML = '';

      if (devices.length === 0) {
        var emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = 'No microphones found';
        deviceSelect.appendChild(emptyOpt);
        deviceSelect.disabled = true;
        return;
      }

      var anySelected = false;
      devices.forEach(function (device, index) {
        var opt = document.createElement('option');
        opt.value = device.deviceId;
        opt.textContent = device.label || ('Microphone ' + (index + 1));
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
      // Refinement entry 5 (finish-pass defect fix): .children is an
      // HTMLCollection, which has NO .forEach in the DOM spec — the direct
      // call threw on every real-browser Start (the device list rebuild
      // runs inside the Start success path), surfacing as a false "Could
      // not start." after the mic was already granted. Array's generic
      // forEach over the collection is the byte-minimal fix.
      Array.prototype.forEach.call(deviceSelect.children, function (o) {
        if (o.selected) {
          selOpt = o;
        }
      });
      deviceSelect.value = selOpt ? selOpt.value : '';

      deviceSelect.disabled = !isEngineLive();
    });
  }

  // ---------------------------------------------------------------------
  // Issue #4 — audio lifecycle loss detection + recovery. The engine
  // (src/audio-engine.js) watches AudioContext.statechange, the active
  // track's ended/mute/unmute, and mediaDevices.devicechange, and
  // forwards them via AudioEngine.onLifecycle(). Everything below only
  // decides what the OPERATOR sees, reusing entry 3's exact vocabulary
  // (setErrorStatus for the strip, setStartHint for the recovery NEXT
  // ACTION. The session button returns to Start once capture is released).
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
      line: 'Microphone disconnected.',
      action: 'Reconnect the microphone, then press Start.',
    },
    device: {
      line: 'Microphone disconnected.',
      action: 'Connect a microphone, then press Start.',
    },
    context: {
      line: 'Audio engine paused. Press Stop, then Start to resume.',
      action: 'Press Stop, then Start to resume audio.',
    },
    graph: {
      line: 'Audio chain did not reconnect.',
      action: 'Press Start to reconnect the audio chain.',
    },
  };

  // True between a context-suspend loss and its recovery — keeps a
  // resumed context from "recovering" a session that lost its track in
  // the meantime.
  var contextLost = false;
  var startupRestoreFailed = false;
  var startupFinalizationPending = false;
  var startupMetersPending = false;
  var sessionGeneration = 0;

  function requireSession(generation) {
    if (generation !== sessionGeneration) {
      var err = new Error('Audio session stopped or replaced.');
      err.name = 'AbortError';
      err.stale = true;
      throw err;
    }
  }

  function canStopSession() {
    return startupFinalizationPending || window.AudioEngine.isStarted;
  }

  function updateSessionButton() {
    var canStop = canStopSession();
    startButton.disabled = false;
    startButton.textContent = canStop ? 'Stop' : 'Start';
    startButton.title = canStop ? 'Stop microphone and all audio output' : 'Start microphone audio';
    startButton.classList.toggle('session-active', canStop);
    if (typeof startButton.setAttribute === 'function') {
      startButton.setAttribute('aria-describedby', canStop ? 'stop-hint' : 'start-hint');
    }
  }

  function stopSession() {
    sessionGeneration += 1;
    deviceSwitchRequestGeneration += 1;
    activeDeviceSwitchGeneration = 0;
    pendingDeviceGraphGeneration = 0;
    startupFinalizationPending = false;
    if (window.McpTools && typeof window.McpTools.retireSession === 'function') {
      window.McpTools.retireSession();
    }
    startupMetersPending = false;
    contextLost = false;
    window.AudioEngine.stop('stopped');
    window.AudioBypass.stop();
    window.AudioGraph.stop();
    if (window.ChainCanvas) { window.ChainCanvas.onEngineStopped(); }
    window.ChainEditing.retireSession();
    pendingEngineTransitions.slice().forEach(function (transition) {
      transition.release(false);
    });
    pendingEngineTransitions = [];
    if (window.MeterTaps) { window.MeterTaps.onEngineStopped(); }
    if (window.StageTaps) { window.StageTaps.onEngineStopped(); }
    if (window.StatusReadouts) { window.StatusReadouts.stop(); }
    renderSimpleEngineState(false);
    var panel = getCanvasPanel();
    if (panel) { panel.classList.remove('bypassed'); }
    updateSessionButton();
    deviceSelect.disabled = true;
    if (bypassButton) { bypassButton.disabled = true; }
    setStatus('Stopped', false);
    setStartHint('Microphone and output stopped. Press Start to resume.');
    if (typeof startButton.focus === 'function') { startButton.focus(); }
    // Reuse the context on the next user gesture, but pause DSP now.
    // Output edges are already disconnected even if suspension fails.
    var ctx = window.AudioEngine.audioContext;
    if (ctx && typeof ctx.suspend === 'function' && ctx.state !== 'closed') {
      ctx.suspend().catch(function (err) {
        console.warn('Stopped audio context could not suspend:', err);
      });
    }
  }


  /* The deck's engine sentence. BYPASS takes precedence over every other
     live line (2026-09-02): while it is engaged the effect chain is gated
     to silence and the room is hearing the independent dry tap, so a
     header still reading LIVE is the one place this app could tell an
     operator mid-show that their processing is running when it is not.
     The engine genuinely IS live — the lamp keeps saying so — but the
     WORD now reports the chain, which is what the operator is asking the
     header about. "effects off" rides in the same sentence rather than
     the .status-detail span: that span is the demoted technical-footnote
     register, and this is state, not a footnote. */
  function liveStatusText() {
    if (bypassEngaged()) {
      return 'Bypassed \u2014 effects off';
    }
    return startupRestoreFailed
      ? 'Live. Saved chain could not load, so no effects are active.'
      : 'Live';
  }

  function renderSimpleEngineState(engineLive) {
    if (!window.SimpleView) {
      return;
    }
    var method = engineLive ? 'onEngineStarted' : 'onEngineStopped';
    if (typeof window.SimpleView[method] === 'function') {
      window.SimpleView[method]();
    }
  }

  function surfaceLoss(copy) {
    var deviceGraphWasPending = pendingDeviceGraphGeneration !== 0;
    activeDeviceSwitchGeneration = 0;
    pendingDeviceGraphGeneration = 0;
    setErrorStatus(copy.line, null, false);
    setStartHint(copy.action);
    // Capture may still be open while the context is paused. Keep Stop
    // available until the session is released; then offer Start again.
    updateSessionButton();
    deviceSelect.disabled = true;
    if (bypassButton) {
      bypassButton.disabled = true; // no live source to bypass anymore
    }
    // Refinement entry 5: the bypassed canvas indication must not outlive
    // the session it described — with the engine down there is no dry path
    // either, so a dimmed chain would be a stuck lie. The AudioBypass
    // state itself is left untouched (the context may be suspended or
    // closed; ramping it here is neither safe nor meaningful); if the
    // session recovers, recoverFromLoss() re-syncs the class from the
    // same single read below.
    var canvasPanel = getCanvasPanel();
    if (canvasPanel) {
      canvasPanel.classList.remove('bypassed');
    }
    if (window.ChainCanvas && typeof window.ChainCanvas.onEngineStopped === 'function') {
      window.ChainCanvas.onEngineStopped();
    }
    renderSimpleEngineState(false);
    if (
      window.AudioEngine &&
      typeof window.AudioEngine.invalidatePendingSwitches === 'function'
    ) {
      window.AudioEngine.invalidatePendingSwitches();
    }
    // A pending getUserMedia request cannot be canceled portably. Release
    // its ChainEditing generation now so an explicit recovery Start can
    // restore the chain without waiting for that obsolete browser promise.
    pendingEngineTransitions.slice().forEach(function (transition) {
      transition.release(false);
    });
    pendingEngineTransitions = [];
    if (
      deviceGraphWasPending &&
      window.AudioEngine &&
      window.AudioEngine.isStarted &&
      typeof window.AudioEngine.stop === 'function'
    ) {
      // The replacement source is already installed but its graph/taps are
      // not accepted. There is no complete session to resume in place.
      // Stop it; the nested graph-loss lifecycle event owns the final copy
      // and explicit Start recovery.
      window.AudioEngine.stop('graph');
      return;
    }
    if (window.MeterTaps) {
      window.MeterTaps.onEngineStopped(); // stops the loop; KEEPS the #3 latch
    }
    if (window.StageTaps) {
      window.StageTaps.onEngineStopped(); // lamps rest; no latch to keep
    }
  }

  function recoverFromLoss() {
    // The dual of surfaceLoss: a live engine again. Offer Stop and
    // restart the meters/watchdog loop (latch-aware
    // by design; a latched trip keeps defending its mute).
    updateSessionButton();
    deviceSelect.disabled = false;
    if (bypassButton) {
      bypassButton.disabled = false;
    }
    // Refinement entry 5: re-sync the bypassed canvas indication from the
    // same single-source read (if bypass was engaged when the session
    // dropped, it is still engaged now — and the dry path is live again,
    // so the dim honestly returns).
    setBypassButtonLabel();
    if (window.ChainCanvas && typeof window.ChainCanvas.onEngineStarted === 'function') {
      window.ChainCanvas.onEngineStarted();
    }
    renderSimpleEngineState(true);
    if (window.MeterTaps) {
      window.MeterTaps.onEngineStarted();
      startupMetersPending = false;
    }
    if (window.StageTaps) {
      window.StageTaps.onEngineStarted();
    }
    setStatus(isEngineLive() ? liveStatusText() : 'Stopped', isEngineLive());
  }

  function handleContextState(state) {
    if (state === 'running') {
      // AudioEngine marks the stream started as soon as getUserMedia
      // resolves, but startup is not an accepted live session until its
      // saved-chain restore/fallback, bypass tap, and meter taps all
      // finalize. A fast resume event must not unlock controls over that
      // still-staging transaction.
      if (startupFinalizationPending) {
        return;
      }
      if (contextLost) {
        contextLost = false;
        if (isEngineLive()) {
          // The stream survived the suspension (OS interruption, tab
          // throttle): recover in place — no operator action needed.
          recoverFromLoss();
        }
        // else: the track was lost while suspended — the track-lost loss
        // state below already owns the strip and Start; leave it.
        return;
      }
      // Refinement entry 5 (P3-5): a context that only settles to
      // 'running' AFTER start() completed. resume() is fired
      // synchronously inside the Start gesture (the Safari rule on the
      // button handler) but settles on the browser's own clock, so the
      // start-success path above can honestly read state 'suspended'
      // and write "Stopped" — and because no suspend loss was ever
      // surfaced, contextLost is still false, the branch above stays
      // silent, and the strip stays wedged at "Stopped" while the
      // engine runs. This observer is the only one left that can
      // correct it: refresh the sentence from the same authoritative
      // read. The two gates make the refresh strictly an upgrade — a
      // running transition can raise a stale "Stopped" to "Live" but
      // never demote anything: an engine that is not live (track lost,
      // failed start) keeps its sentence, and a shown operator failure
      // (the error register) keeps its recovery copy.
      if (isEngineLive() && !(statusWrapper && statusWrapper.classList.contains('error'))) {
        deviceSelect.disabled = false;
        if (bypassButton) {
          bypassButton.disabled = false;
        }
        setBypassButtonLabel();
        if (window.ChainCanvas && typeof window.ChainCanvas.onEngineStarted === 'function') {
          window.ChainCanvas.onEngineStarted();
        }
        renderSimpleEngineState(true);
        if (startupMetersPending && window.MeterTaps) {
          window.MeterTaps.onEngineStarted();
          startupMetersPending = false;
        }
        if (window.StageTaps) {
          window.StageTaps.onEngineStarted();
        }
        setStatus(liveStatusText(), true);
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
    var generation = sessionGeneration;
    // Re-enumerate; if the ACTIVE device is gone while live, that IS a
    // track loss (the engine tears the stream down and emits track-lost —
    // the handler below surfaces it), and the dropdown must stop offering
    // the dead device either way.
    window.AudioEngine.listInputDevices().then(function (devices) {
      if (generation !== sessionGeneration) { return; }
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
        if (evt.reason === 'stopped') { return; }
        contextLost = false; // a dead track supersedes any suspend state
        surfaceLoss(LOSS_COPY[evt.reason] || LOSS_COPY.ended);
      } else if (evt.type === 'track-muted') {
        // Transient note only — the track is still live, so the dot stays
        // truthful via isEngineLive().
        setStatus('Mic muted.', isEngineLive());
      } else if (evt.type === 'track-unmuted') {
        setStatus(isEngineLive() ? liveStatusText() : 'Stopped', isEngineLive());
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

  /** The whole start transaction, lifted out of the click handler so the
   *  headphone check below can be the thing the FIRST click opens and
   *  this can be what the confirming click runs. Every caller must be a
   *  real user gesture, synchronously — see the RQ-4 note inside. */
  function beginStart() {
    if (startupFinalizationPending) {
      return;
    }
    // AudioEngine.start() is called synchronously, right here, in the
    // click handler. Inside it, the AudioContext is created and
    // .resume()'d synchronously before any `await` (including before
    // `await getUserMedia()`) — see the detailed comment on
    // AudioEngine.start() in src/audio-engine.js. This ordering is what
    // satisfies Safari's "resume() must happen within a user gesture"
    // requirement (RQ-4); do not move this call behind any prior await.
    setStatus('Waiting for microphone permission...', false);
    startupFinalizationPending = true;
    updateSessionButton();
    var generation = ++sessionGeneration;
    var retainedSound = window.ChainEditing && typeof window.ChainEditing.getSnapshot === 'function'
      ? window.ChainEditing.getSnapshot() : null;

    // THE POWER-UP (2026-09-02 delight round). The commit gesture runs
    // the meters' lamp test — both ladders end to end and back — so the
    // machine answers the key immediately, and so the operator watches
    // every segment on both meters prove itself in the one window
    // (setup) where that proof is free.
    //
    // It fills a wait that already exists above (getUserMedia, the
    // worklet fetches, the first graph build) and delays nothing: the
    // engine resolves on its own schedule and the real signal is drawn
    // over the sweep the instant there is one. Display-only and
    // additive by construction — see THE LAMP TEST in src/meters.js for
    // the honesty rules it holds to. Guarded like every other optional
    // feedback component: a missing or older Meters build simply starts
    // the way it always did.
    try {
      if (window.Meters && typeof window.Meters.lampTest === 'function') {
        window.Meters.lampTest();
      }
    } catch (err) {
      console.warn('Meters: power-up lamp test skipped.', err);
    }

    window.AudioEngine.start()
      .then(function (result) {
        requireSession(generation);
        // PS-2: load the initial chain rather than always starting from an
        // empty model. window.Persistence.loadInitialModel() returns
        // whatever was last autosaved, or (nothing saved yet, e.g. first
        // run or cleared localStorage) PX-3's "Classic Karaoke" default —
        // see src/persistence.js and src/default-preset.js. Issue #20 routes
        // restoration through ChainEditing so the live graph commits before
        // cards, autosave, and later lifecycle hooks become visible.
        var initialModel = retainedSound ? retainedSound.model :
          (window.Persistence ? window.Persistence.loadInitialModel() : []);
        // FEW-2: the layout half of the same slot — the saved board
        // positions (FEW-1's store seam). {} (nothing saved, a legacy
        // payload, or a preset-load baseline) means every section takes
        // the incumbent tidy stack; nothing is synthesized here.
        var initialLayout = retainedSound ? retainedSound.layout :
          (window.Persistence ? window.Persistence.loadInitialLayout() : null);
        if (!window.ChainEditing || typeof window.ChainEditing.apply !== 'function') {
          throw new Error('ChainEditing is required for startup restoration.');
        }
        // The restore step is its own failure domain (#16). If a saved
        // node cannot be constructed, commit an empty passthrough through
        // the same transaction seam and keep the microphone session live.
        // The original autosave is then restored so a transient factory
        // failure does not erase the operator's saved chain.
        var restoreFailed = false;
        startupRestoreFailed = false;
        var restore = window.ChainEditing.apply({
          source: 'startup',
          candidate: initialModel,
          layout: initialLayout,
          renderOptions: retainedSound ? { preservePresentation: true } : undefined,
          forceStructural: true
        });

        return Promise.resolve(restore).catch(function (restoreErr) {
          requireSession(generation);
          // A restart must never replace an unsaved accepted sound with
          // the empty startup fallback. Keep it for another Start attempt.
          if (retainedSound) { throw restoreErr; }
          console.error('Saved chain could not be restored; starting with an empty chain:', restoreErr);
          restoreFailed = true;
          return window.ChainEditing.apply({
            source: 'startup',
            candidate: [],
            layout: null,
            forceStructural: true
          }).then(function () {
            requireSession(generation);
            if (window.Persistence && typeof window.Persistence.saveCurrentChain === 'function') {
              window.Persistence.saveCurrentChain(initialModel, initialLayout || {});
            }
          });
        }).then(function () {
          requireSession(generation);
          // AE-3: (re-)establish the independent bypass dry tap now that
          // sourceNode exists. Must be called any time sourceNode changes —
          // see the comment on AudioBypass.reconnectSource() in
          // src/audio-bypass.js.
          window.AudioBypass.reconnectSource();
          var engineLive = isEngineLive();
          if (bypassButton) {
            bypassButton.disabled = !engineLive;
          }
          setBypassButtonLabel();

          // UI-3: gate or un-gate the palette/chain canvas from the
          // complete live predicate. A source can exist while its context
          // is still resuming, which is not yet an editable live session.
          if (window.ChainCanvas) {
            if (engineLive) {
              window.ChainCanvas.onEngineStarted();
            } else if (typeof window.ChainCanvas.onEngineStopped === 'function') {
              window.ChainCanvas.onEngineStopped();
            }
          }
          renderSimpleEngineState(engineLive);

          // FEW-3: meter side-taps + runtime watchdog. Now that
          // audioContext/sourceNode exist AND the first buildGraph() has
          // run (the ChainEditing restore above), create/reconnect the two AnalyserNode
          // taps (IN off AudioEngine.sourceNode, OUT off the persistent
          // chainGate — docs/ultron/research/rq4-meters.md), flip
          // window.Meters live (setEngineState(true)), and start the one
          // shared rAF loop that feeds both meters and the rq3 watchdog
          // every frame. See src/meter-taps.js.
          startupMetersPending = !engineLive;
          if (window.MeterTaps && engineLive) {
            window.MeterTaps.onEngineStarted();
            startupMetersPending = false;
          }
          if (window.StageTaps && engineLive) {
            window.StageTaps.onEngineStarted();
          }

          // FEW-2: fill the VIS-2 status-LCD readouts with real engine
          // values — RATE from context.sampleRate, LATENCY from
          // baseLatency+outputLatency (the context-REPORTED estimate —
          // a different figure from cycle-1 QA-4's slow-mo measured
          // ~12 ms, not a replacement for it) PLUS the live chain's own
          // declared added latency (EffectCatalog.getLatencySeconds() per
          // node, zeroed while Bypass is engaged), and NODES — LATENCY and
          // NODES both refreshed at 1 Hz off ChainCanvas's live model, so
          // adding/removing an effect or toggling Bypass adjusts the
          // readout within a second. window.AudioEngine's audioContext
          // GETTER is the real access path here (same one isEngineLive()
          // above reads) — never the Start result object, which could go
          // stale if the context is ever recreated. See
          // src/status-readouts.js.
          if (window.StatusReadouts) {
            window.StatusReadouts.onEngineStarted(window.AudioEngine.audioContext);
          }

          // The engine remains live after an empty-chain fallback, but the
          // status must say that the saved effect chain did not load.
          startupRestoreFailed = restoreFailed;
          var surfacedLoss = !!(
            statusWrapper && statusWrapper.classList.contains('error')
          );
          if (engineLive) {
            setStatus(liveStatusText(), true);
          } else if (!surfacedLoss) {
            setStatus(
              restoreFailed
                ? 'Stopped. Saved chain could not load, so no effects are active.'
                : 'Stopped',
              false
            );
          }
          // A successful transaction clears only a pre-existing loss when
          // the context is already live. If a real suspension arrived
          // during restoration, preserve contextLost so the later running
          // event takes recoverFromLoss() and re-gates Start correctly.
          if (engineLive) {
            contextLost = false;
          }
          startupFinalizationPending = false;
          updateSessionButton();

          return populateDeviceList(window.AudioEngine.currentDeviceId);
        });
      })
      .catch(function (err) {
        if (generation !== sessionGeneration || (err && err.stale)) { return; }
        startupFinalizationPending = false;
        startupMetersPending = false;
        console.error('AudioEngine failed to start:', err);
        // Issue #20: if mic acquisition succeeded but chain restoration
        // failed, tear the capture session down before surfacing Failed.
        if (
          window.AudioEngine &&
          window.AudioEngine.isStarted &&
          typeof window.AudioEngine.stop === 'function'
        ) {
          window.AudioEngine.stop('startup-chain-failed');
        }
        // Entry 3: the short WHAT HAPPENED sentence alone on the status
        // line (it must read in full even on the tight strip); the NEXT
        // ACTION + demoted technical footnote land in the .start-hint
        // beside Start, which the re-enable below immediately un-hides.
        var copy = micErrorCopy(err, false);
        setErrorStatus(copy.line, null, false);
        setStartHint(copy.action, copy.footnote);
        updateSessionButton();
        if (retainedSound) {
          setErrorStatus('Could not restart current sound.', null, false);
          setStartHint('Your sound is kept here. Press Start to try again.');
        }
      });
  }

  // ---------------------------------------------------------------------
  // HEADPHONE CHECK — the one confirmation between the Start gesture and
  // getUserMedia (index.html's #headphone-check; see its comment for the
  // full rationale). Start opens the mic into the system output, and if
  // that output is a speaker in the same room the mic hears itself and
  // the loop climbs into howling feedback in seconds. The limiter and
  // the howl watchdog hold the level down; they cannot undo a room loop.
  // So the decision is taken BEFORE any microphone is opened: a "Not
  // yet" costs nothing, because nothing has been acquired to undo.
  // ---------------------------------------------------------------------
  var headphoneDialog = document.getElementById('headphone-check');
  var headphoneConfirmBtn = document.getElementById('headphone-check-confirm');
  var headphoneCancelBtn = document.getElementById('headphone-check-cancel');
  // Asked once per page LOAD, not once per Start. The question is about
  // the room the operator is monitoring in, and that does not change
  // when a dropped context, a failed device switch, or a deliberate
  // stop sends them back through Start a second time.
  var headphonesAcknowledged = false;

  /** True only when the real markup is present AND this browser has the
   *  native modal. Anything else (a bare Node harness, an ancient
   *  engine) must leave Start behaving exactly as it did before this
   *  check existed — an unreachable Start is a worse failure than a
   *  missing warning. */
  function headphoneCheckAvailable() {
    return !!(
      headphoneDialog && headphoneConfirmBtn &&
      typeof headphoneDialog.showModal === 'function' &&
      typeof headphoneDialog.close === 'function'
    );
  }

  function closeHeadphoneCheck() {
    try {
      if (headphoneDialog.open) {
        headphoneDialog.close();
      }
    } catch (err) {
      /* already closed or detached — nothing to undo */
    }
  }

  if (headphoneCheckAvailable()) {
    headphoneConfirmBtn.addEventListener('click', function () {
      headphonesAcknowledged = true;
      // beginStart() FIRST, still inside this click: AudioEngine.start()
      // creates and resumes the AudioContext before its first await, and
      // that has to happen inside a user gesture (RQ-4). Moving the
      // gesture from one button to another is the whole trick — never
      // putting an await in front of it. Closing after also means the
      // dialog's own close event sees startupFinalizationPending and
      // leaves focus alone.
      beginStart();
      closeHeadphoneCheck();
    });
    if (headphoneCancelBtn) {
      headphoneCancelBtn.addEventListener('click', closeHeadphoneCheck);
    }
    // Both dismissals land here — the button and Escape (which fires the
    // dialog's own cancel, then close). Nothing was started, so put the
    // operator back on the control they pressed.
    headphoneDialog.addEventListener('close', function () {
      if (!startupFinalizationPending && typeof startButton.focus === 'function') {
        startButton.focus();
      }
    });
  }

  updateSessionButton();
  startButton.addEventListener('click', function () {
    if (canStopSession()) {
      stopSession();
      return;
    }
    if (!headphonesAcknowledged && headphoneCheckAvailable()) {
      if (headphoneDialog.open) {
        return; // already asking
      }
      try {
        headphoneDialog.showModal();
        return;
      } catch (err) {
        // Cannot go modal here (detached, or already open in another
        // form). Fall through and start rather than stranding Start.
        console.error('Headphone check could not open; starting without it:', err);
      }
    }
    beginStart();
  });

  var deviceSwitchRequestGeneration = 0;
  var activeDeviceSwitchGeneration = 0;
  var pendingDeviceGraphGeneration = 0;
  var pendingEngineTransitions = [];

  function releaseEngineTransition(transition, engineLive) {
    var index = pendingEngineTransitions.indexOf(transition);
    if (index !== -1) {
      pendingEngineTransitions.splice(index, 1);
    }
    transition.release(engineLive);
  }

  deviceSelect.addEventListener('change', function () {
    var generation = sessionGeneration;
    var deviceId = deviceSelect.value;
    if (!deviceId) {
      return;
    }
    var requestGeneration = ++deviceSwitchRequestGeneration;
    if (!window.ChainEditing ||
        typeof window.ChainEditing.beginEngineTransition !== 'function') {
      throw new Error('ChainEditing engine-transition barrier is required for device switching.');
    }
    var engineTransition = window.ChainEditing.beginEngineTransition();
    pendingEngineTransitions.push(engineTransition);

    // Once a switch is requested neither the old nor the replacement path
    // is the accepted live path yet. Keep the lamp gray until the new graph,
    // bypass tap, and meters have all reconnected.
    setStatus('Switching microphone...', false);

    Promise.resolve(engineTransition.ready)
      .then(function () {
        requireSession(generation);
        return window.AudioEngine.switchInputDevice(deviceId);
      })
      .then(function () {
        requireSession(generation);
        activeDeviceSwitchGeneration = requestGeneration;
        pendingDeviceGraphGeneration = requestGeneration;
        // A device switch creates a fresh MediaStreamAudioSourceNode (see
        // the comment on switchInputDevice() in audio-engine.js for why),
        // which isn't connected to anything yet — rebuild the graph against
        // the current accepted model so the new source is reconnected
        // through the operator's live chain to destination.
        var rebuild;
        try {
          rebuild = window.AudioGraph.buildGraph(window.AudioGraph.getModel());
        } catch (err) {
          throw deviceGraphError(err);
        }

        return Promise.resolve(rebuild).then(function (graphResult) {
          requireSession(generation);
          if (
            requestGeneration !== activeDeviceSwitchGeneration ||
            requestGeneration !== pendingDeviceGraphGeneration
          ) {
            return;
          }
          if (graphResult && graphResult.committed === false) {
            if (graphResult.canceled &&
                requestGeneration !== activeDeviceSwitchGeneration) {
              return;
            }
            throw deviceGraphError(graphResult.error, graphResult);
          }

          // Another successful input request replaced this request's
          // source while its graph was staging. That newer request owns all
          // finalization; this completion must not retap meters, rewrite the
          // status, or stop anything.
          // AE-3: the new sourceNode also isn't connected to the bypass tap
          // yet — re-establish it only after the graph committed. See the
          // comment on AudioBypass.reconnectSource() in src/audio-bypass.js.
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
          // The stage lamps' mic tap follows the same re-tap moment (the
          // old source node is blanket-disconnected by the switch).
          if (window.StageTaps) {
            window.StageTaps.onDeviceSwitched(window.AudioEngine.sourceNode);
          }

          // A newer request may still be pending (and can still fail while
          // this source remains active). Restore the physical taps now, but
          // leave that newer request's Switching/error sentence intact.
          if (requestGeneration === deviceSwitchRequestGeneration) {
            setStatus(isEngineLive() ? liveStatusText() : 'Stopped', isEngineLive());
          }
          // Issue #4: the selector reflects the ACTIVE stream's device, not
          // merely whatever was last picked.
          reconcileSelector();
          pendingDeviceGraphGeneration = 0;
        }).then(null, function (err) {
          throw err && err.deviceGraphFailure ? err : deviceGraphError(err);
        });
      })
      .catch(function (err) {
        if (generation !== sessionGeneration) { return; }
        if (
          requestGeneration !== activeDeviceSwitchGeneration &&
          err && err.deviceGraphFailure
        ) {
          return;
        }
        // Issue #4: a STALE completion (a newer switch/Start superseded
        // this one — the engine already stopped and discarded its stream)
        // is not an operator-visible failure: the newer request owns the
        // outcome. Only re-anchor the selector to the actually-active
        // device so the strip and dropdown tell one story.
        if (err && err.stale) {
          reconcileSelector();
          return;
        }
        // A graph failure happens after the input stream has switched, so
        // the old-stream-preserved recovery below is no longer true. Tear
        // the incomplete session down; AudioEngine's lifecycle event makes
        // Start the explicit rebuild action and prevents a green Live lamp
        // over a disconnected chain.
        if (err && err.deviceGraphFailure) {
          // A merely-requested newer device does not make this failure
          // harmless: until that request actually replaces the source,
          // this generation still owns the physical session. Stop it now
          // rather than letting a later acquisition failure expose a live
          // lamp over this disconnected graph.
          if (requestGeneration !== activeDeviceSwitchGeneration) {
            return;
          }
          console.error('Failed to reconnect the audio chain after switching input:', err);
          if (window.AudioEngine && typeof window.AudioEngine.stop === 'function') {
            window.AudioEngine.stop('graph');
          }
          reconcileSelector();
          return;
        }
        if (requestGeneration !== deviceSwitchRequestGeneration) {
          return;
        }
        console.error('Failed to switch input device:', err);
        // The old stream/source node is untouched until the new one is
        // successfully obtained (see switchInputDevice() in
        // audio-engine.js), so a failed switch doesn't change whether the
        // engine itself is still live — only the attempted switch failed.
        // Entry 3: while live, the hint region is hidden (the button offers
        // Stop), so the switchLine carries what happened AND the next
        // action; the lamp stays truthful via isEngineLive().
        var copy = micErrorCopy(err, true);
        setErrorStatus(copy.line, copy.footnote, isEngineLive());
        // Issue #4: the failed pick is not the active device — snap the
        // selector back to the stream that is actually live.
        reconcileSelector();
      })
      .then(function () {
        releaseEngineTransition(engineTransition, isEngineLive());
      }, function (err) {
        releaseEngineTransition(engineTransition, isEngineLive());
        console.error('Device-switch transition failed unexpectedly:', err);
      });
  });
})();
