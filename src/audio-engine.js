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

    // Fire this synchronously, without awaiting it before the getUserMedia
    // call below — see the Safari note above. It's fine that resume()
    // itself returns a promise; what matters is that it is *called*
    // within the gesture's synchronous call stack.
    audioContext.resume();

    // ---- Async continuation: awaiting from here on is fine ----
    var stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });

    mediaStream = stream;

    // RQ-1: create the MediaStreamAudioSourceNode exactly ONCE per
    // session. If start() is ever called again while a session is
    // already active (e.g. a stray double-click before the button was
    // disabled), do NOT create a second source node — keep the existing
    // one. Full device switching is handled separately by
    // switchInputDevice() below, which is a deliberate, documented
    // exception to "create once" (see its comment for why).
    if (!sourceNode) {
      sourceNode = audioContext.createMediaStreamSource(mediaStream);
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
    if (!audioContext) {
      throw new Error('AudioEngine.start() must be called before switching input devices.');
    }

    var constraints = {
      audio: Object.assign({ deviceId: { exact: deviceId } }, AUDIO_CONSTRAINTS),
    };
    var newStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Tear down the previous stream/node now that the replacement is live.
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (track) { track.stop(); });
    }
    if (sourceNode) {
      sourceNode.disconnect();
    }

    mediaStream = newStream;
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    currentDeviceId = getDeviceIdFromStream(mediaStream) || deviceId;

    return sourceNode;
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

    get audioContext() { return audioContext; },
    get sourceNode() { return sourceNode; },
    get stream() { return mediaStream; },
    get currentDeviceId() { return currentDeviceId; },
    get isStarted() { return started; },
  };
})();
