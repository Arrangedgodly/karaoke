// Bypass routing for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same pattern as audio-engine.js
// and audio-graph.js: a single IIFE exposing one global namespace,
// `window.AudioBypass`.
//
// AE-3 scope: an independent "dry" mic-to-output path, completely decoupled
// from the health of the effect chain built by AudioGraph.buildGraph(). Per
// the project brief (town-hall.md), this is the app's single most important
// reliability feature — at a real karaoke event there is no physical audio
// fallback, so Bypass is the only way to restore clean audio to the room if
// the effect chain breaks mid-song.
//
// Architecture (independence from the chain, and why it holds):
//   - `bypassGain` is a dedicated GainNode fed directly from
//     AudioEngine.sourceNode and connected straight to
//     AudioEngine.audioContext.destination (see reconnectSource()). This tap
//     is a completely separate outgoing edge off of sourceNode from the one
//     AudioGraph.buildGraph() manages.
//   - AudioGraph.buildGraph() was fixed (see src/audio-graph.js) to only
//     ever disconnect the ONE specific edge it owns
//     (sourceNode -> firstChainNode) instead of a blanket
//     sourceNode.disconnect() — so this tap survives every chain rebuild,
//     and also survives buildGraph() throwing partway through a rebuild
//     (leaving the chain itself in a broken/torn-down state).
//   - Engaging bypass ramps AudioGraph.getChainGate() (the shared gate the
//     effect chain's last node feeds into, right before destination) to 0,
//     silencing whatever the chain is doing however broken it currently is,
//     while ramping bypassGain up to 1 in the same breath — so the room
//     hears a clean mic signal near-instantly, regardless of chain health.
//   - Issue #3: while FEW-3's watchdog latch (src/meter-taps.js) holds,
//     DISENGAGING bypass does NOT ramp the chain gate back up — the
//     watchdog's mute outranks bypass's own gate target, and only the
//     human "Restore output" button may reopen output after a trip. The
//     dry path itself is never touched by the watchdog, so engaging
//     bypass while latched still hands the room the clean mic signal:
//     bypass remains the operator's escape exactly as designed.
(function () {
  'use strict';

  // Short click-avoiding ramp duration. Deliberately shorter than a normal
  // chain-edit fade (see AE-4's RQ-1 research) would use — this is an
  // emergency control, so "near-instant" matters more than "smooth", but 5ms
  // is still enough to avoid an audible click/pop from a hard gain jump.
  var RAMP_S = 0.005;

  // Dedicated dry-path GainNode. Lazily created (needs
  // window.AudioEngine.audioContext to exist first). Initial gain 0 —
  // bypass is OFF by default; the effect chain (or silence, if nothing has
  // been built yet) is what the room hears until bypass is engaged.
  var bypassGain = null;

  // Current bypass state. Starts disengaged.
  var engaged = false;

  /**
   * Get (creating on first call if necessary) the dedicated bypass
   * GainNode. Requires window.AudioEngine.audioContext to already exist.
   *
   * @returns {GainNode}
   */
  function ensureBypassGain() {
    if (!bypassGain) {
      var audioContext = window.AudioEngine && window.AudioEngine.audioContext;
      if (!audioContext) {
        throw new Error(
          'AudioBypass: window.AudioEngine.audioContext must already exist. ' +
          'Call AudioEngine.start() (and await it) first.'
        );
      }
      bypassGain = audioContext.createGain();
      bypassGain.gain.value = 0; // bypass OFF by default
    }
    return bypassGain;
  }

  /**
   * (Re)establish the independent dry tap: sourceNode -> bypassGain ->
   * destination. Safe to call multiple times — connecting an
   * already-connected pair is a harmless no-op per the Web Audio spec, and
   * this creates bypassGain lazily on first call if it doesn't exist yet.
   *
   * Must be (re-)called every time window.AudioEngine's sourceNode changes
   * — after AudioEngine.start() resolves, and after
   * AudioEngine.switchInputDevice() resolves (a device switch creates a
   * brand new MediaStreamAudioSourceNode that isn't connected to anything
   * yet). This exactly parallels why AudioGraph.buildGraph() needs to be
   * re-invoked at those same two points — see src/main.js.
   *
   * Deliberately independent of AudioGraph.buildGraph(): this function never
   * touches the effect chain, the chain gate's routing, or anything
   * buildGraph() manages, and buildGraph() never touches this tap (see the
   * firstChainNode fix in src/audio-graph.js). Whether buildGraph() has
   * ever been called, has thrown, or has left the chain half-built has no
   * effect on this tap.
   */
  function reconnectSource() {
    var audioEngine = window.AudioEngine;
    if (!audioEngine || !audioEngine.audioContext || !audioEngine.sourceNode) {
      throw new Error(
        'AudioBypass.reconnectSource: window.AudioEngine.audioContext and .sourceNode must ' +
        'already exist. Call AudioEngine.start() (and await it) before reconnectSource().'
      );
    }

    var gain = ensureBypassGain();
    audioEngine.sourceNode.connect(gain);
    gain.connect(audioEngine.audioContext.destination);
  }

  /**
   * Ramp an AudioParam to `targetValue` over RAMP_S seconds, starting from
   * `now`, using the standard click-avoiding pattern: cancel any pending
   * automation, pin the param at its current value at `now`, then a linear
   * ramp from there to the target.
   *
   * @param {AudioParam} param
   * @param {number} targetValue
   * @param {number} now - audioContext.currentTime at call time.
   */
  function rampTo(param, targetValue, now) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(targetValue, now + RAMP_S);
  }

  /**
   * Set bypass to the given engaged/disengaged state, ramping the chain
   * gate and the bypass gain in opposite directions in the same call so
   * they cross over together.
   *
   * Issue #3 exception: while FEW-3's watchdog latch holds, the chain
   * gate stays at its mute level in BOTH directions. Disengage's normal
   * job includes ramping the gate back up to 1 — that would reopen
   * output the safety system just muted, so it is suppressed (only the
   * human "Restore output" button in src/meter-taps.js may ramp the gate
   * up after a trip). The dry bypassGain ramp is untouched: that path is
   * wholly Bypass's own and the watchdog never touches it, so engage
   * still opens the dry path while latched, and disengage still closes
   * it. Engage's gate target (0) already matches the mute, so only the
   * disengage direction needs the guard.
   *
   * @param {boolean} nextEngaged
   */
  function setEngaged(nextEngaged) {
    var audioContext = window.AudioEngine && window.AudioEngine.audioContext;
    if (!audioContext) {
      throw new Error(
        'AudioBypass: window.AudioEngine.audioContext must already exist. ' +
        'Call AudioEngine.start() (and await it) first.'
      );
    }

    var gain = ensureBypassGain();
    var chainGate = window.AudioGraph.getChainGate();
    var now = audioContext.currentTime;

    var gateTarget = nextEngaged ? 0 : 1;
    if (
      gateTarget > 0 &&
      window.MeterTaps &&
      typeof window.MeterTaps.isTripped === 'function' &&
      window.MeterTaps.isTripped()
    ) {
      gateTarget = 0;
    }

    rampTo(chainGate.gain, gateTarget, now);
    rampTo(gain.gain, nextEngaged ? 1 : 0, now);

    engaged = nextEngaged;
  }

  /** Engage bypass: chain gate -> 0, bypass gain -> 1. */
  function engage() {
    setEngaged(true);
  }

  /** Disengage bypass: bypass gain -> 0; chain gate -> 1 EXCEPT while the
   *  watchdog latch holds (issue #3 — held at the mute level instead; see
   *  setEngaged). */
  function disengage() {
    setEngaged(false);
  }

  /** Toggle bypass to the opposite of its current state. */
  function toggle() {
    setEngaged(!engaged);
  }

  /**
   * @returns {boolean} true if bypass is currently engaged.
   */
  function isEngaged() {
    return engaged;
  }

  // Preserve the human's bypass choice across Stop/Start, but sever its
  // destination edge now. reconnectSource() restores it on the next Start.
  function stop() {
    if (bypassGain) {
      bypassGain.disconnect();
    }
  }

  window.AudioBypass = {
    stop: stop,
    reconnectSource: reconnectSource,
    engage: engage,
    disengage: disengage,
    toggle: toggle,
    isEngaged: isEngaged,
  };
})();
