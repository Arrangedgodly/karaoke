// Status readout wiring for the Node-Based Web Audio Chain Builder (FEW-2).
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of this project (see src/meter-taps.js).
// Purely a consumer (AudioEngine's AudioContext + ChainCanvas's live model +
// EffectCatalog's declared per-type latency + AudioBypass's engaged state);
// no localStorage; no agent surface.
//
// =====================================================================
// FEW-2 CONTRACT — window.StatusReadouts
// =====================================================================
//   onEngineStarted(context)
//     main.js Start-success hook, adjacent to MeterTaps'. `context` is
//     the live AudioContext via the window.AudioEngine.audioContext
//     GETTER (never the Start result object — a recreated context can
//     never go stale). Writes #readout-sample-rate
//     ('<sampleRate/1000, 1 decimal> kHz') and #readout-latency
//     ('<(baseLatency+outputLatency+chainLatencySeconds())*1000, 1
//     decimal> ms', undefined I/O parts as 0; BOTH I/O parts undefined ->
//     '—' + ONE console.info, ever), then starts the ONE idempotent 1 Hz
//     interval refreshing #readout-node-count from
//     ChainCanvas.getCurrentModel().length (bare integer — the
//     micro-label says NODES; absent/throwing/non-array model -> last
//     shown value stays) AND re-deriving #readout-latency the same tick,
//     so an added/removed effect or a Bypass toggle shows up within 1 s
//     with no dedicated change-event wire.
//   chainLatencySeconds()
//     Sum of EffectCatalog.getLatencySeconds(entry.type) over the live
//     chain model — every registered effect's OWN declared processing
//     delay (a worklet's fixed look-ahead, a granular engine's window, a
//     compressor-type node's fixed internal look-ahead; 0 for effects
//     that add none). Forced to 0 while AudioBypass.isEngaged(): the room
//     is hearing the independent dry tap, not the chain, so the chain's
//     latency doesn't apply to what's actually heard. This is what turns
//     LATENCY from "mic I/O only" into "adaptable to the current chain".
//   refreshNow()  one-shot manual refresh of all three (tests/dev).
//   stop()        clears the interval — hygiene/tests only (the app has
//                 no stop path; the readouts run for its lifetime).
//
// DOM discipline: every write re-finds its element via getElementById —
// 3 lookups/s are unmeasurable, and a future topbar re-render can never
// strand a cached detached node. Values are assigned only when they
// DIFFER from what the element already shows (zero DOM writes at idle;
// also self-heals an externally reset slot). A missing element is
// skipped with ONE warn per id — never a throw into the host app.
// =====================================================================
(function () {
  'use strict';

  var context = null; // the AudioContext handed to onEngineStarted()
  var intervalHandle = null; // the single 1 Hz NODES refresh
  var saidOnce = {}; // dedupe map for the one-shot console messages

  function warnOnce(message) {
    if (saidOnce[message]) {
      return;
    }
    saidOnce[message] = true;
    console.warn(message);
  }

  function infoOnce(message) {
    if (saidOnce[message]) {
      return;
    }
    saidOnce[message] = true;
    console.info(message);
  }

  /** Write `value` into #`id` only when it differs; missing element ->
   *  silent skip + one warn. */
  function write(id, value) {
    var el = document.getElementById(id);
    if (!el) {
      warnOnce('StatusReadouts: element #' + id + ' not found — readout untouched.');
      return;
    }
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }

  /** Sum of every live chain node's own declared EffectCatalog.
   *  getLatencySeconds() — the effects' disclosed added processing delay
   *  (worklet look-aheads, a granular engine's window, a compressor's
   *  fixed internal look-ahead), on top of the context's I/O estimate.
   *  Zero while Bypass is engaged: the room is hearing the independent dry
   *  tap, not the chain (src/audio-bypass.js), so none of it applies.
   *  Any failure (missing globals, a throwing model getter) yields 0 —
   *  never a throw into the host app, same defensiveness as
   *  refreshNodeCount(). */
  function chainLatencySeconds() {
    try {
      if (window.AudioBypass && typeof window.AudioBypass.isEngaged === 'function' &&
          window.AudioBypass.isEngaged()) {
        return 0;
      }
      if (!window.ChainCanvas || typeof window.ChainCanvas.getCurrentModel !== 'function' ||
          !window.EffectCatalog || typeof window.EffectCatalog.getLatencySeconds !== 'function') {
        return 0;
      }
      var model = window.ChainCanvas.getCurrentModel();
      if (!Array.isArray(model)) {
        return 0;
      }
      var total = 0;
      model.forEach(function (entry) {
        var seconds = window.EffectCatalog.getLatencySeconds(entry && entry.type);
        if (typeof seconds === 'number' && isFinite(seconds)) {
          total += seconds;
        }
      });
      return total;
    } catch (err) {
      return 0;
    }
  }

  /** LATENCY text: (baseLatency + outputLatency + chainLatencySeconds()) *
   *  1000, 1 decimal, undefined I/O parts as 0; BOTH I/O parts undefined ->
   *  chain latency alone isn't a substitute for an unreported I/O estimate. */
  function latencyText() {
    var base = typeof context.baseLatency === 'number' ? context.baseLatency : 0;
    var output = typeof context.outputLatency === 'number' ? context.outputLatency : 0;
    var haveBase = typeof context.baseLatency === 'number';
    var haveOutput = typeof context.outputLatency === 'number';
    if (!haveBase && !haveOutput) {
      infoOnce('StatusReadouts: AudioContext reports neither baseLatency nor outputLatency — LATENCY stays "—".');
      return '—';
    }
    return ((base + output + chainLatencySeconds()) * 1000).toFixed(1) + ' ms';
  }

  function writeRateAndLatency() {
    write('readout-sample-rate', (context.sampleRate / 1000).toFixed(1) + ' kHz');
    write('readout-latency', latencyText());
  }

  /** NODES from the canvas's own live model; any failure keeps whatever
   *  is already on screen ('—' before the first successful read). */
  function refreshNodeCount() {
    var model = null;
    try {
      if (window.ChainCanvas && typeof window.ChainCanvas.getCurrentModel === 'function') {
        model = window.ChainCanvas.getCurrentModel();
      }
    } catch (err) {
      return;
    }
    if (!Array.isArray(model)) {
      return;
    }
    write('readout-node-count', String(model.length));
  }

  /** The 1 Hz tick: NODES off the live model, plus LATENCY (the chain's
   *  declared added latency changes with every node add/remove/Bypass
   *  toggle, so it rides the same cadence instead of a dedicated
   *  change-event wire). */
  function refreshTick() {
    refreshNodeCount();
    if (context) {
      write('readout-latency', latencyText());
    }
  }

  /** The ONE 1 Hz interval — idempotent, never stacks. */
  function startInterval() {
    if (intervalHandle !== null || typeof window.setInterval !== 'function') {
      return;
    }
    intervalHandle = window.setInterval(refreshTick, 1000);
  }

  /** main.js Start-success hook. Bad argument (no context / no numeric
   *  sampleRate) -> one warn, full no-op. */
  function onEngineStarted(ctx) {
    if (!ctx || typeof ctx.sampleRate !== 'number') {
      warnOnce('StatusReadouts.onEngineStarted: expected the live AudioContext — bad argument ignored.');
      return;
    }
    context = ctx;
    writeRateAndLatency();
    refreshNodeCount();
    startInterval();
  }

  function refreshNow() {
    if (context) {
      writeRateAndLatency();
    }
    refreshNodeCount();
  }

  function stop() {
    if (intervalHandle !== null) {
      try {
        window.clearInterval(intervalHandle);
      } catch (err) {
        /* nothing to clear */
      }
      intervalHandle = null;
    }
  }

  window.StatusReadouts = {
    onEngineStarted: onEngineStarted,
    refreshNow: refreshNow,
    stop: stop,
  };
})();
