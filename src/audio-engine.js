// Audio engine for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — there is no bundler or module
// system in this project, so this file defines a single global namespace,
// `window.AudioEngine`, that later scripts (main.js, and later tasks
// AE-2+) read from directly.
//
// AE-1 scope: bootstrap a running AudioContext gated behind a user
// gesture, get a live mic MediaStreamAudioSourceNode, and support
// listing/switching input devices. Later tasks build the rest of the
// audio graph off of `AudioEngine.sourceNode`.

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Internal session state. Not assigned to window directly — exposed
  // read-only via the getters on the AudioEngine object below, so callers
  // always see the live current value instead of a stale snapshot.
  // ---------------------------------------------------------------------
  var audioContext = null;
  var mediaStream = null;
  var sourceNode = null;
  var currentDeviceId = null;
  var started = false;

  // Issue #4 — lifecycle state.
  //  - trackEnded: set by the ACTIVE track's own 'ended' listener (or by
  //    forceStreamLoss()); while true the session is NOT live even though
  //    the AudioContext may still be 'running' — the UI must not show Live.
  //  - switchGeneration: a monotonic request-generation token. Every
  //    device-switch request captures the current value; a completion whose
  //    captured value is no longer current (a NEWER request — or a full
  //    session teardown — happened meanwhile) is STALE: its stream is
  //    stopped and discarded and the completion rejects with a tagged
  //    AbortError, so an older getUserMedia resolving LAST can never
  //    replace a newer or already-ended session.
  //  - trackListeners: the listeners attached to the ACTIVE track, kept so
  //    they can be removed exactly when the stream they belong to stops
  //    being active (switch, teardown) — no dead stream's 'ended' can fire
  //    a live-session loss.
  var trackEnded = false;
  var switchGeneration = 0;
  var trackListeners = null;
  var lifecycleCallbacks = [];

  /** Issue #4: register a lifecycle observer. `cb` is invoked with
   *  {type:'context-state', state} | {type:'track-lost', reason} |
   *  {type:'track-muted'} | {type:'track-unmuted'} | {type:'device-change'}.
   *  A throwing callback can never break the engine (it is isolated and
   *  logged) and can never unregister the others. */
  function onLifecycle(cb) {
    if (typeof cb === 'function') {
      lifecycleCallbacks.push(cb);
    }
  }

  function emit(event) {
    lifecycleCallbacks.slice().forEach(function (cb) {
      try {
        cb(event);
      } catch (err) {
        console.error('AudioEngine lifecycle callback failed:', err);
      }
    });
  }

  function stopStream(stream) {
    if (!stream || typeof stream.getTracks !== 'function') {
      return;
    }
    stream.getTracks().forEach(function (track) {
      try {
        track.stop();
      } catch (err) {
        /* already stopped */
      }
    });
  }

  function detachTrackListeners() {
    if (!trackListeners) {
      return;
    }
    var ref = trackListeners;
    trackListeners = null;
    if (ref.track && typeof ref.track.removeEventListener === 'function') {
      Object.keys(ref.handlers).forEach(function (type) {
        try {
          ref.track.removeEventListener(type, ref.handlers[type]);
        } catch (err) {
          /* track already gone */
        }
      });
    }
  }

  /** Full teardown of the stream session (NOT the AudioContext, which is
   *  reused): invalidate pending device replacements, stop tracks, drop
   *  listeners, and disconnect the source node. Leaves the engine in the
   *  pre-start shape so a subsequent start() builds everything fresh. */
  function teardownSession() {
    // A replacement requested for this session cannot become current after
    // the session has ended. Its continuation observes the newer generation,
    // stops the late stream, and rejects as stale before reconnecting audio.
    invalidatePendingSwitches();
    detachTrackListeners();
    stopStream(mediaStream);
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (err) {
        /* already disconnected */
      }
    }
    mediaStream = null;
    sourceNode = null;
    currentDeviceId = null;
    started = false;
    trackEnded = false;
  }

  /**
   * Retire device acquisitions that belong to the current live-session
   * generation without tearing down that session. Context suspension uses
   * this before recovering in place: a getUserMedia promise cannot be
   * canceled portably, but its late stream can be recognized and stopped.
   */
  function invalidatePendingSwitches() {
    switchGeneration++;
  }

  /** Attach this module's 'ended'/'mute'/'unmute' listeners to `stream`'s
   *  audio track, replacing any listeners belonging to a previous stream.
   *  Each handler guards on `mediaStream === stream` so a STALE stream
   *  (already replaced by a newer switch, then stopped) can never fire a
   *  loss/mute event for the live session. */
  function watchStream(stream) {
    detachTrackListeners();
    trackEnded = false;
    var track = stream && typeof stream.getAudioTracks === 'function'
      ? stream.getAudioTracks()[0]
      : null;
    if (!track || typeof track.addEventListener !== 'function') {
      return;
    }
    var handlers = {
      ended: function () {
        if (mediaStream !== stream) {
          return; // a stale stream's track ended — already discarded
        }
        teardownSession();
        emit({ type: 'track-lost', reason: 'ended' });
      },
      mute: function () {
        if (mediaStream === stream) {
          emit({ type: 'track-muted' });
        }
      },
      unmute: function () {
        if (mediaStream === stream) {
          emit({ type: 'track-unmuted' });
        }
      }
    };
    track.addEventListener('ended', handlers.ended);
    track.addEventListener('mute', handlers.mute);
    track.addEventListener('unmute', handlers.unmute);
    trackListeners = { track: track, handlers: handlers };
  }

  /** Host-event wiring (issue #4): AudioContext.statechange and
   *  navigator.mediaDevices.devicechange, each attached exactly once per
   *  page load. The events are only ever FORWARDED via emit() — the engine
   *  itself takes no action on them; src/main.js decides what the UI does. */
  var contextListenerAttached = false;
  var deviceChangeListenerAttached = false;

  function wireHostListeners() {
    if (audioContext && !contextListenerAttached &&
        typeof audioContext.addEventListener === 'function') {
      audioContext.addEventListener('statechange', function () {
        emit({ type: 'context-state', state: audioContext.state });
      });
      contextListenerAttached = true;
    }
    var md = typeof navigator !== 'undefined' && navigator.mediaDevices;
    if (md && !deviceChangeListenerAttached && typeof md.addEventListener === 'function') {
      md.addEventListener('devicechange', function () {
        emit({ type: 'device-change' });
      });
      deviceChangeListenerAttached = true;
    }
  }

  var AUDIO_CONSTRAINTS = {
    // This app processes music/vocal signal, not voice-call audio, so we
    // explicitly turn off the browser's built-in voice-processing filters
    // (Safari and others apply these by default and they degrade signal
    // quality for musical input). See project research RQ-4.
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };

  /**
   * Start the audio engine: create the AudioContext (or reuse the
   * existing one), request mic access, and create the
   * MediaStreamAudioSourceNode.
   *
   * ==========================================================================
   * IMPORTANT — Safari user-gesture requirement (RQ-4):
   *
   * This function MUST be called synchronously from within a user-gesture
   * event handler (e.g. a button's `click` listener) — not from inside a
   * `setTimeout`, a `.then()` callback, or after any prior `await`.
   *
   * Being declared `async`, this function's body still runs SYNCHRONOUSLY
   * up to its first `await` — that is standard JS semantics, not a bug.
   * The AudioContext is created and `.resume()` is called on it in that
   * synchronous section, before the `await navigator.mediaDevices.
   * getUserMedia(...)` line below. So as long as the caller invokes
   * `AudioEngine.start()` directly and synchronously from the click
   * handler, the resume() call happens within the qualifying gesture.
   *
   * Do NOT change this to await getUserMedia() first and create/resume
   * the AudioContext afterwards — in Safari, a resolved getUserMedia()
   * promise does not count as a user gesture, so a resume() called after
   * that await can silently fail to actually unsuspend the context.
   * ==========================================================================
   *
   * @returns {Promise<{audioContext: AudioContext, sourceNode: MediaStreamAudioSourceNode, stream: MediaStream}>}
   */
  async function start() {
    // ---- Synchronous section: runs inside the caller's call stack ----
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'getUserMedia is not available (requires a secure context — https:// or localhost — in most browsers).'
      );
    }

    if (!audioContext) {
      var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextCtor();
    }

    // Issue #4: forward AudioContext.statechange and
    // navigator.mediaDevices.devicechange from here on.
    wireHostListeners();

    // Fire this synchronously, without awaiting it before the getUserMedia
    // call below — see the Safari note above. It's fine that resume()
    // itself returns a promise; what matters is that it is *called* within
    // the gesture's synchronous call stack.
    audioContext.resume();

    // RQ-1 (start path): if the session is already fully live (a fresh
    // Start press — e.g. the issue-#4 recovery action after a context
    // suspension, where the stream never died), do NOT re-request
    // getUserMedia and do NOT create a second source node: resume the
    // (possibly suspended) context and return the existing session.
    if (started && mediaStream && !trackEnded) {
      return {
        audioContext: audioContext,
        sourceNode: sourceNode,
        stream: mediaStream,
      };
    }

    // Issue #4 (recovery path): a dead or partial session (track ended,
    // device removed, a torn-down stream) must not pin a stale sourceNode
    // — RQ-1's "keep the existing node" would keep a dead one forever.
    // Discard whatever is left so the code below builds everything fresh.
    teardownSession();
    // teardownSession() also invalidated any in-flight device-switch
    // completion: this Start owns the next session, not an older switch.

    // ---- Async continuation: awaiting from here on is fine ----
    var gen = switchGeneration;
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (err) {
      if (gen !== switchGeneration) {
        throw staleSwitchError();
      }
      throw err;
    }
    if (gen !== switchGeneration) {
      stopStream(stream);
      throw staleSwitchError();
    }

    mediaStream = stream;

    // Issue #4: watch THIS stream's track for ended/mute/unmute (see
    // watchStream); replaces any previous listeners (none can be live
    // here — teardownSession() above removed them).
    watchStream(stream);

    // RQ-1: create the MediaStreamAudioSourceNode exactly once per live
    // session — teardownSession() above guarantees sourceNode is null
    // here on the recovery path. Full device switching is handled
    // separately by switchInputDevice() below, a deliberate, documented
    // exception to "create once" (see its comment for why).
    try {
      sourceNode = audioContext.createMediaStreamSource(mediaStream);
    } catch (err) {
      teardownSession();
      throw err;
    }

    started = true;
    currentDeviceId = getDeviceIdFromStream(mediaStream);

    return {
      audioContext: audioContext,
      sourceNode: sourceNode,
      stream: mediaStream,
    };
  }

  /**
   * List available audio input devices.
   *
   * Must be called AFTER getUserMedia() has been granted at least once —
   * before permission is granted, browsers redact device `label`s (and
   * sometimes stable `deviceId`s) for privacy. In practice this means:
   * call this after AudioEngine.start() has resolved successfully.
   *
   * @returns {Promise<MediaDeviceInfo[]>}
   */
  async function listInputDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    var devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(function (d) { return d.kind === 'audioinput'; });
  }

  /**
   * Switch the active input device mid-session.
   *
   * RQ-1 exception, and why: a MediaStreamAudioSourceNode is permanently
   * bound to the MediaStream it was created from — the Web Audio API has
   * no way to repoint an existing source node at a different stream/
   * device. So a genuine device switch has no choice but to obtain a new
   * MediaStream (for the newly chosen device) and create a new
   * MediaStreamAudioSourceNode from it. This is treated as a deliberate,
   * occasional exception to "create the source node once per session" —
   * it is NOT the routine/steady-state path, only what happens on an
   * explicit user-initiated device switch.
   *
   * The old stream's tracks are stopped and the old source node is
   * disconnected before swapping in the new ones. Callers that hold a
   * reference to the graph should reconnect using the fresh
   * `AudioEngine.sourceNode` (the getter below) rather than caching the
   * node reference from an earlier start()/switchInputDevice() call.
   *
   * @param {string} deviceId
   * @returns {Promise<MediaStreamAudioSourceNode>}
   */
  async function switchInputDevice(deviceId) {
    if (!audioContext || !started) {
      throw new Error('AudioEngine.start() must be called before switching input devices.');
    }

    // Issue #4 — request-generation token: capture the generation AT
    // REQUEST START. Any newer switch (or a Start) increments it, so a
    // completion whose `gen` is no longer current was superseded mid-flight
    // and must be DISCARDED (stream stopped, never swapped in) — this is
    // what serializes two rapid mic selections against each other when the
    // older getUserMedia happens to resolve LAST.
    var gen = ++switchGeneration;

    var constraints = {
      audio: Object.assign({ deviceId: { exact: deviceId } }, AUDIO_CONSTRAINTS),
    };
    var newStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (gen !== switchGeneration) {
        throw staleSwitchError();
      }
      throw err;
    }

    if (gen !== switchGeneration) {
      // Superseded: stop and discard the stale stream, never touch the
      // live session, and reject as a tagged stale AbortError (main.js
      // suppresses operator copy for it and only reconciles the selector
      // to the actually-active device).
      stopStream(newStream);
      throw staleSwitchError();
    }

    // Current request — safe to swap. Tear down the previous stream/node
    // now that the replacement is live (listeners of the old track go
    // first, so its 'ended' can never fire against the new session).
    detachTrackListeners();
    stopStream(mediaStream);
    if (sourceNode) {
      sourceNode.disconnect();
    }

    mediaStream = newStream;
    watchStream(newStream);
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    currentDeviceId = getDeviceIdFromStream(mediaStream) || deviceId;

    return sourceNode;
  }

  /** The tagged rejection for a superseded switch completion. `stale` is
   *  the marker main.js keys on; the AbortError name is honest (the
   *  request was cut off by a newer one) and keeps it out of the
   *  operator-copy map's retry advice (stale completions need no retry). */
  function staleSwitchError() {
    var err = new Error('Microphone request superseded by a newer session or selection.');
    err.name = 'AbortError';
    err.stale = true;
    return err;
  }

  /** Issue #4: external loss entry point (used by main.js's devicechange
   *  handler when the ACTIVE device has been removed). Same teardown +
   *  'track-lost' event the track's own 'ended' listener produces; the
   *  `reason` selects the operator copy in main.js. No-op when there is
   *  no live stream (e.g. the loss already happened). */
  function forceStreamLoss(reason) {
    if (!mediaStream) {
      return;
    }
    teardownSession();
    emit({ type: 'track-lost', reason: reason || 'device' });
  }

  /**
   * Explicitly return to the pre-start session shape. Used when startup
   * acquired a microphone but the initial chain could not be restored:
   * the UI must never show a failed start over a still-live capture.
   */
  function stop(reason) {
    var hadSession = !!mediaStream || !!sourceNode || started;
    teardownSession();
    if (hadSession) {
      emit({ type: 'track-lost', reason: reason || 'stopped' });
    }
  }

  function getDeviceIdFromStream(stream) {
    var track = stream.getAudioTracks()[0];
    if (!track) {
      return null;
    }
    var settings = track.getSettings ? track.getSettings() : {};
    return settings.deviceId || null;
  }

  // ---------------------------------------------------------------------
  // Public surface. AudioContext and the current source node are exposed
  // as getters (not plain properties) so downstream code (AE-2+) always
  // reads the live, current value — important for switchInputDevice(),
  // which replaces `sourceNode` with a new instance.
  // ---------------------------------------------------------------------
  window.AudioEngine = {
    start: start,
    listInputDevices: listInputDevices,
    switchInputDevice: switchInputDevice,
    invalidatePendingSwitches: invalidatePendingSwitches,
    stop: stop,

    // Issue #4 lifecycle surface.
    onLifecycle: onLifecycle,
    forceStreamLoss: forceStreamLoss,

    get audioContext() { return audioContext; },
    get sourceNode() { return sourceNode; },
    get stream() { return mediaStream; },
    get currentDeviceId() { return currentDeviceId; },
    get isStarted() { return started; },
    // True only while a session is started AND its stream's track has not
    // ended — the track half of main.js's isEngineLive() (the context half
    // reads audioContext.state === 'running').
    get isTrackLive() { return started && !!mediaStream && !trackEnded; },
  };

  // Attach the devicechange forwarder at LOAD time (there is no context
  // yet, so only that half of wireHostListeners does anything): a device
  // unplug before the first Start still refreshes the dropdown. The
  // AudioContext.statechange half is wired on first start(), when the
  // context exists.
  wireHostListeners();
})();
