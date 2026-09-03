// Per-stage signal taps for the VOXCHAIN live-signal surface (overdrive
// round, 2026-09-02) — the audio half of "the instrument carries your
// voice", pairing src/signal-lamps.js (the visual half) the same way
// src/meter-taps.js pairs with src/meters.js: this file owns ANALYSERS
// and the measurement loop; the lamps own ballistics and paint.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends (all
// read lazily and defensively) on window.AudioGraph, window.AudioEngine,
// window.AudioBypass and window.MeterTaps, all loaded earlier per
// index.html's script order — and every one of those references is
// guarded, so a stripped harness loads this file as a harmless no-op.
//
// =====================================================================
// WHAT THIS ADDS (and deliberately does not)
// =====================================================================
//
// The two MIC IN / OUT meters (meter-taps.js) already show the ends of
// the path. These taps show the MIDDLE: one pass-through AnalyserNode
// per audible chain position, so the board's drawn chevrons between
// cards can light at the level actually flowing at that point. An
// operator watching from across a dark room sees compression pull the
// row down stage by stage — the chain working, not a diagram of it.
//
//   ZERO DSP: every tap is a side-tap AnalyserNode (pass-through,
//   connected NOWHERE downstream — the exact pattern meter-taps.js
//   established for analyserIn/analyserOut). No gain node, no routing
//   change, no edge on the audible path is added or removed. The audio
//   graph's safety properties (gate, attenuator, bypass dry tap,
//   watchdog) are untouched by construction.
//
//   ZERO AGENT SURFACE: src/mcp-tools.js contains no reference to
//   StageTaps, the taps, or any level they produce — exactly the
//   meter-taps rule. No localStorage; nothing persists.
//
//   HONESTY GATES (the one place this file makes a judgment): while
//   emergency Bypass is engaged or the watchdog mute is latched, the
//   chain is not what the room hears — the stage levels feed NULL
//   (lamps dark) even though the chain's internal signal keeps flowing.
//   The SCOPE feed is NOT gated: it taps the final output after the
//   gate, so it flattens to the truth on its own (bypass mutes the wet
//   path; the dry path never passes through this analyser).
//
// =====================================================================
// WIRING MODEL (why rewire-on-change, and the self-heal)
// =====================================================================
//
// buildGraph() (src/audio-graph.js) tears down and reconnects node
// outputs on every accepted structural edit, and AudioBypass/device
// switches replace the source node — so any tap edge hanging off a node
// output is severed by the NEXT rebuild. Rather than touch the core
// graph builder, this module re-wires itself AFTER changes, from the
// same public state everyone else reads:
//
//   - ChainEditing's one acceptance choke point (markAcceptedEdit — the
//     same hook SimpleView.onChainChanged rides) calls
//     StageTaps.onChainChanged(); main.js calls onEngineStarted /
//     onEngineStopped / onDeviceSwitched alongside MeterTaps' own hooks.
//   - onChainChanged() DEBOUNCES (~40 ms) so the deferred, debounced
//     buildGraph commit (FADE_S 15 ms + 5) has landed before the taps
//     read the committed nodeInstances map.
//   - Belt to that braces: every frame compares a signature of
//     AudioGraph.getModel() (ids+types+bypassed) against the signature
//     the current wiring was built for; any drift schedules a rewire.
//     A tap wired one commit late can only ever be briefly stale, never
//     silently wrong forever.
//
// A stale wiring is also HARMLESS by construction: it reads whatever the
// analyser sees (silence after a disconnect), and the next event
// re-wires. Nothing here can throw into the audio path — the house
// safe()/one-strike discipline (see meter-taps.js) applies: any failure
// logs exactly ONE diagnostic and disables StageTaps forever while the
// host app runs on unaffected.
//
// =====================================================================
// FEED CONTRACT — what the visual half receives per frame
// =====================================================================
//
//   SignalLamps.feedStages(levels)
//     levels: Array<number|null> — ONE entry per chain-arrow gap, in
//     board order (levels[k] belongs to the chevron before card k+1).
//     The value is that position's RAW frame peak in dBFS (-Infinity
//     silence arrives as null); null also carries the honesty gates
//     above (bypass engaged / watchdog tripped). Ballistics live in the
//     lamps, not here — same division as Meters.
//
//   SignalLamps.feedChain(levels)
//     levels: Array<number|null> — the chain's BOUNDARIES, nodes+1 of
//     them: levels[0] is the microphone arriving, levels[k+1] is what
//     leaves card k. So card k's own pair is (levels[k], levels[k+1]) —
//     what reached it and what left it — and the distance between the
//     two IS the effect that card is having, read as two real
//     measurements rather than as a derived claim. Same dBFS convention,
//     same null-for-silence and honesty gates as feedStages; a bypassed
//     card reports the level physically crossing it, which is its input
//     unchanged, because that is the truth.
//
//   SignalLamps.feedScope(pairs, columns, peakDb)
//     pairs: Float32Array of length 2*columns (min,max interleaved,
//     linear -1..1) — the current 2048-sample window of the FINAL
//     output (same tap point as analyserOut: after the -6 dBFS host
//     attenuator), decimated to draw-resolution columns. peakDb is the
//     window's peak for the lamps' own decisions. Silence is an all-zero
//     pair set at -Infinity, NOT a withheld frame — the scope paints a
//     flat dark line, the honest picture of a silent output.
//
//   SignalLamps.setEngineState(false) on stop — the lamps clear to
//     their resting ink; nothing stays lit from a dead engine.
// =====================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Constants.
  // ---------------------------------------------------------------------

  // Same window size as the meter taps (42.7 ms @ 48 kHz): one shared
  // read buffer serves every tap sequentially per frame.
  var FFT_SIZE = 2048;

  // 20*log10 floor per the house convention; digital silence reports
  // -Infinity and crosses the feed contract as null.
  var DB_FLOOR_LINEAR = 1e-9;

  // Rewire debounce: comfortably past buildGraph's deferred commit
  // (FADE_S*1000 + 5 ms) while still feeling immediate to an operator.
  var REWIRE_DEBOUNCE_MS = 40;

  // ---------------------------------------------------------------------
  // Module state.
  // ---------------------------------------------------------------------

  var audioContext = null; // captured once at first engine start

  // The tap pool: AnalyserNodes created on demand and REUSED across
  // rewires (an unwired analyser costs nothing). Each entry records the
  // source it is currently connected to so a rewire can sever exactly
  // its own edges — never a blanket disconnect that could touch an edge
  // the graph owns.
  var tapPool = [];
  // tapPool[i].src — the AudioNode feeding tapPool[i].node, or null.
  // All writes go through wireTap()/unwireTaps() so the bookkeeping and
  // the edges can never drift.

  // The current wiring, as plan arrays parallel to the pool's live
  // prefix: stageOutputs[i] is the resolved OUTPUT AudioNode of audible
  // chain node i (never the composite), and gapToTap[k] maps chain-arrow
  // gap k to the pool index feeding it (0 = the mic source tap, 1+i =
  // audible node i's output). Rebuilt whole by rewire().
  var stageOutputs = [];
  var gapToTap = [];
  // Chain boundary k -> tap index (nodes+1 entries; [0] is the mic).
  var chainToTap = [];

  // Signature of AudioGraph.getModel() the current wiring was built for
  // (ids + types + bypassed flags, joined). Compared every frame.
  var wiredSignature = null;

  // The scope's own analyser — the FINAL-OUTPUT tap point (the host
  // attenuator's output, the same edge semantics as meter-taps'
  // analyserOut). Connected exactly once per session; the attenuator is
  // persistent across every rebuild, so the edge survives by design.
  var scopeAnalyser = null;
  var scopeConnected = false;
  var scopeSourceRef = null; // the attenuator the edge hangs off

  // The mic-source tap's current source (device switches replace the
  // source node; MeterTaps.onDeviceSwitched's exact re-tap moment).
  var sourceRef = null;

  // One reused read buffer per purpose (allocated with the context).
  var floatBuf = null; // Float32Array(FFT_SIZE) — taps + scope windows
  var scopePairs = null; // Float32Array(2 * MAX_SCOPE_COLUMNS)

  var rafHandle = null;
  var loopRunning = false;
  var engineLive = false;

  var rewireTimer = null;

  var failed = false; // one-strike disable (safe() below)
  var warned = {};

  // ---------------------------------------------------------------------
  // Small helpers (the meter-taps discipline, verbatim in spirit).
  // ---------------------------------------------------------------------

  function warnOnce(message) {
    if (warned[message]) {
      return;
    }
    warned[message] = true;
    console.warn(message);
  }

  /** Run `fn`; on any throw, log ONE diagnostic and permanently disable
   *  StageTaps (a harmless no-op forever after) — live-signal wiring can
   *  never break the host app or its audio path. */
  function safe(fn) {
    try {
      fn();
    } catch (err) {
      failed = true;
      stopLoop();
      console.error(
        'StageTaps: wiring failed — live-signal feeds disabled; the rest of the app (and all audio) is unaffected.',
        err
      );
    }
  }

  function getLamps() {
    return typeof window !== 'undefined' ? window.SignalLamps : undefined;
  }

  function now() {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  // ---------------------------------------------------------------------
  // Tap pool management.
  // ---------------------------------------------------------------------

  /** Ensure the pool holds at least `count` analysers; existing entries
   *  are reused, new ones are created on the live context. fftSize
   *  matches the meter taps so one shared read buffer serves all. */
  function ensurePool(count) {
    while (tapPool.length < count) {
      var node = audioContext.createAnalyser();
      node.fftSize = FFT_SIZE;
      tapPool.push({ node: node, src: null });
    }
  }

  /** (Re)connect pool entry `i` to `src`, severing any previous edge of
   *  THIS tap only (a tap has exactly one source at a time). */
  function wireTap(i, src) {
    var tap = tapPool[i];
    if (tap.src === src) {
      return;
    }
    if (tap.src) {
      try {
        tap.src.disconnect(tap.node);
      } catch (err) {
        /* the old source is already gone (teardown / device switch) */
      }
    }
    src.connect(tap.node);
    tap.src = src;
  }

  /** Sever every pool edge, leaving the analysers themselves alive for
   *  the next wiring (pool reuse — no per-rewire allocation churn). */
  function unwireTaps() {
    tapPool.forEach(function (tap) {
      if (tap.src) {
        try {
          tap.src.disconnect(tap.node);
        } catch (err) {
          /* already severed by a graph teardown */
        }
        tap.src = null;
      }
    });
  }

  /** A model entry's real OUTPUT AudioNode — the same composite
   *  resolution AudioGraph.getNodeInput/getNodeOutput performs
   *  internally ({input,output} composites vs plain nodes). That helper
   *  is not exported, so the two-line rule lives here, next to its only
   *  consumer; AudioGraph.getNodeInstance() still provides the
   *  (possibly composite) instance this resolves. */
  function outputOf(instance) {
    return instance && instance.output ? instance.output : instance;
  }

  /** The wiring signature: the committed model facts the tap plan
   *  depends on (which ids exist, their types, which are audible). A
   *  rebuild that changes any of these must re-plan; a param-only
   *  change (same signature) reuses the wiring untouched. */
  function signatureOf(model) {
    return model.map(function (entry) {
      return entry.id + ':' + entry.type + ':' + (entry.bypassed ? 'b' : 'a');
    }).join('|');
  }

  /** Build the tap plan from the COMMITTED public state:
   *    - one source tap (pool 0) off AudioEngine.sourceNode;
   *    - one tap per AUDIBLE node output (pool 1+i) — bypassed entries
   *      contribute no edge in buildGraph(), so they are skipped here
   *      exactly as the audible path skips them;
   *    - gapToTap: chain-arrow gap k (the chevron before model card k+1)
   *      is fed by the most recent audible stage at-or-before card k —
   *      the source when every earlier card is bypassed. The final
   *      card's own output is the OUT meter's story, not a chevron's.
   *    Returns false when the plan cannot be built yet (no live
   *    instances for a committed id — e.g. mid-teardown); the caller
   *    treats that as "leave the old wiring, try again on the next
   *    signature drift". */
  function planFromModel() {
    var model = window.AudioGraph.getModel();
    var source = window.AudioEngine.sourceNode;
    if (!source) {
      return false;
    }

    var audible = [];
    for (var i = 0; i < model.length; i++) {
      var entry = model[i];
      if (entry.bypassed === true) {
        continue;
      }
      var instance = window.AudioGraph.getNodeInstance(entry.id);
      if (!instance) {
        return false; // committed model, uncommitted instances — retry later
      }
      audible.push(outputOf(instance));
    }

    ensurePool(1 + audible.length);
    stageOutputs = audible;

    // Gap k sits before model card k (k >= 1) — EVERY such card earns its
    // chevron in the DOM (renderChainArrows keys on card position, never
    // on audibility), so the push happens for bypassed cards too: their
    // gap reads the latest audible stage at-or-before them, exactly the
    // signal physically crossing that gap (buildGraph wires the audible
    // neighbors straight together). audibleSeen counts audibles among
    // cards 0..k-1; tap 0 (the mic source) covers "everything upstream
    // is bypassed".
    gapToTap = [];
    // The boundary list starts at the microphone and gains one entry per
    // card: after card k it holds the latest audible stage at-or-before
    // it, which for a bypassed card is its own input unchanged — the
    // signal physically leaving that seat.
    chainToTap = [0];
    var audibleSeen = 0;
    for (var k = 0; k < model.length; k++) {
      if (k > 0) {
        gapToTap.push(audibleSeen > 0 ? audibleSeen : 0);
      }
      if (model[k].bypassed !== true) {
        audibleSeen++;
      }
      chainToTap.push(audibleSeen);
    }
    return signatureOf(model);
  }

  /** The debounced rewire itself: plan from committed state, then swap
   *  the edges. Runs OUTSIDE the frame loop's try (its own safe()). */
  function rewire() {
    rewireTimer = null;
    if (failed || !engineLive || !audioContext) {
      return;
    }
    safe(function () {
      var signature = planFromModel();
      if (signature === false) {
        // Instances not committed yet — force the per-frame signature
        // check to keep retrying by "forgetting" the wired signature.
        wiredSignature = null;
        return;
      }
      unwireTaps();
      wireTap(0, window.AudioEngine.sourceNode);
      for (var i = 0; i < stageOutputs.length; i++) {
        wireTap(1 + i, stageOutputs[i]);
      }
      sourceRef = window.AudioEngine.sourceNode;
      wiredSignature = signature;
    });
  }

  function scheduleRewire() {
    if (failed || rewireTimer !== null) {
      return;
    }
    if (typeof setTimeout !== 'function') {
      rewire(); // bare harness with timers stubbed away — wire now
      return;
    }
    rewireTimer = setTimeout(rewire, REWIRE_DEBOUNCE_MS);
  }

  // ---------------------------------------------------------------------
  // Per-frame measurement.
  // ---------------------------------------------------------------------

  /** Peak dBFS of the window currently in floatBuf (-Infinity on
   *  digital silence) — the chevron lamps consume peaks only; RMS is
   *  the meters' business. */
  function peakDbOfWindow() {
    var maxAbs = 0;
    for (var i = 0; i < FFT_SIZE; i++) {
      var v = floatBuf[i];
      var a = v < 0 ? -v : v;
      if (a > maxAbs) {
        maxAbs = a;
      }
    }
    return maxAbs > 0
      ? 20 * Math.log10(maxAbs > DB_FLOOR_LINEAR ? maxAbs : DB_FLOOR_LINEAR)
      : -Infinity;
  }

  /** Decimate the scope window (floatBuf) into min/max envelope columns.
   *  Reuses scopePairs; returns the column count actually filled. */
  function envelopeColumns(columns) {
    var per = FFT_SIZE / columns;
    for (var c = 0; c < columns; c++) {
      var start = Math.floor(c * per);
      var end = Math.min(FFT_SIZE, Math.floor((c + 1) * per));
      var min = 0;
      var max = 0;
      for (var i = start; i < end; i++) {
        var v = floatBuf[i];
        if (v < min) {
          min = v;
        }
        if (v > max) {
          max = v;
        }
      }
      scopePairs[c * 2] = min;
      scopePairs[c * 2 + 1] = max;
    }
    return columns;
  }

  /** True while the chain is not what the room hears — emergency Bypass
   *  engaged (dry path live, chain gated) or the watchdog mute latched.
   *  Guarded reads: either module may be absent in a harness. */
  function chainInaudible() {
    if (window.AudioBypass && typeof window.AudioBypass.isEngaged === 'function' &&
        window.AudioBypass.isEngaged()) {
      return true;
    }
    if (window.MeterTaps && typeof window.MeterTaps.isTripped === 'function' &&
        window.MeterTaps.isTripped()) {
      return true;
    }
    return false;
  }

  function frame() {
    try {
      // Self-heal: any committed structural change we were not told
      // about (or told about before its commit landed) re-plans here.
      var currentSig;
      try {
        currentSig = signatureOf(window.AudioGraph.getModel());
      } catch (sigErr) {
        currentSig = wiredSignature; // no model readable — leave as-is
      }
      if (currentSig !== wiredSignature) {
        scheduleRewire();
      }

      var lamps = getLamps();

      // Stage levels — RAW peaks, nulls for silence and for the honesty
      // gates. gapToTap's length is the arrow count the wiring knows
      // about; the lamps reconcile it against the DOM they hold.
      var levels = [];
      var i;
      if (chainInaudible()) {
        for (i = 0; i < gapToTap.length; i++) {
          levels.push(null);
        }
      } else {
        for (i = 0; i < gapToTap.length; i++) {
          var tap = tapPool[gapToTap[i]];
          var db = null;
          if (tap && tap.src) {
            tap.node.getFloatTimeDomainData(floatBuf);
            var peak = peakDbOfWindow();
            if (peak > -Infinity) {
              db = peak;
            }
          }
          levels.push(db);
        }
      }
      if (lamps && typeof lamps.feedStages === 'function') {
        lamps.feedStages(levels);
      }

      // The same taps, read once more as the chain's own boundaries —
      // the per-card strips need what ARRIVED at a card as well as what
      // left it, and both are already in the pool. Gated exactly like
      // the chevrons: a chain the room cannot hear reports nothing.
      if (lamps && typeof lamps.feedChain === 'function' && chainToTap.length) {
        var chainLevels = [];
        for (i = 0; i < chainToTap.length; i++) {
          if (chainInaudible()) {
            chainLevels.push(null);
            continue;
          }
          var ctap = tapPool[chainToTap[i]];
          var cdb = null;
          if (ctap && ctap.src) {
            ctap.node.getFloatTimeDomainData(floatBuf);
            var cpeak = peakDbOfWindow();
            if (cpeak > -Infinity) {
              cdb = cpeak;
            }
          }
          chainLevels.push(cdb);
        }
        lamps.feedChain(chainLevels);
      }

      // The scope window — always the honest final output, never gated
      // (see the header: it flattens by itself when the wet path mutes).
      if (scopeAnalyser) {
        scopeAnalyser.getFloatTimeDomainData(floatBuf);
        var peakDb = peakDbOfWindow();
        var columns = envelopeColumns(SCOPE_COLUMNS);
        if (lamps && typeof lamps.feedScope === 'function') {
          lamps.feedScope(scopePairs, columns, peakDb);
        }
      }
    } catch (err) {
      // House precedent (meter-taps.js's frame): one diagnostic, then
      // stop the loop — the lamps fall to rest, the graph untouched.
      loopRunning = false;
      rafHandle = null;
      console.error(
        'StageTaps: sample loop failed — live-signal feeds stopped; the rest of the app is unaffected.',
        err
      );
      return;
    }
    if (loopRunning && typeof window.requestAnimationFrame === 'function') {
      rafHandle = window.requestAnimationFrame(frame);
    }
  }

  // Scope draw resolution: enough columns for a truthful envelope at the
  // slot's width, few enough that per-column min/max stays honest on a
  // 42.7 ms window (2048 samples / 136 ≈ 15 samples per column).
  var SCOPE_COLUMNS = 136;

  function startLoop() {
    if (loopRunning || typeof window === 'undefined' ||
        typeof window.requestAnimationFrame !== 'function') {
      return;
    }
    loopRunning = true;
    rafHandle = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    loopRunning = false;
    if (rafHandle !== null) {
      try {
        if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
          window.cancelAnimationFrame(rafHandle);
        }
      } catch (err) {
        /* nothing to cancel */
      }
      rafHandle = null;
    }
  }

  /** Create the shared buffers + the scope analyser on first engine
   *  start. The scope tap hangs off the PERSISTENT host attenuator (the
   *  same final-output point analyserOut uses), so this edge is made
   *  exactly once per session and survives every chain rebuild. */
  function ensureInfrastructure() {
    var ctx = window.AudioEngine && window.AudioEngine.audioContext;
    if (!ctx) {
      throw new Error('StageTaps: AudioEngine.audioContext does not exist — start the engine first.');
    }
    audioContext = ctx;
    if (!floatBuf) {
      floatBuf = new Float32Array(FFT_SIZE);
      scopePairs = new Float32Array(SCOPE_COLUMNS * 2);
    }
    if (!scopeAnalyser) {
      scopeAnalyser = window.ChannelAnalysis ? window.ChannelAnalysis.create(ctx, 2) : ctx.createAnalyser();
      scopeAnalyser.fftSize = FFT_SIZE;
    }
    if (!scopeConnected) {
      var attenuator = window.AudioGraph.getOutputAttenuator();
      attenuator.connect(scopeAnalyser.input || scopeAnalyser);
      scopeConnected = true;
      scopeSourceRef = attenuator;
    }
  }

  // ---------------------------------------------------------------------
  // Public API — lifecycle hooks main.js calls (alongside MeterTaps'),
  // the chain-changed hook ChainEditing's choke point calls, and the
  // read-only test probe. Nothing else is public; no agent tool reaches
  // any of it.
  // ---------------------------------------------------------------------

  /** main.js Start-success hook: infrastructure up, wired, loop live. */
  function onEngineStarted() {
    if (failed) {
      return;
    }
    safe(function () {
      ensureInfrastructure();
      engineLive = true;
      rewireTimer = null;
      rewire();
      startLoop();
    });
  }

  /** main.js teardown hook: loop stopped, lamps cleared to rest. */
  function onEngineStopped() {
    if (failed) {
      return;
    }
    stopLoop();
    engineLive = false;
    if (rewireTimer !== null && typeof clearTimeout === 'function') {
      clearTimeout(rewireTimer);
      rewireTimer = null;
    }
    unwireTaps();
    stageOutputs = [];
    gapToTap = [];
    wiredSignature = null;
    sourceRef = null;
    var lamps = getLamps();
    if (lamps && typeof lamps.setEngineState === 'function') {
      try {
        lamps.setEngineState(false);
      } catch (err) {
        warnOnce('StageTaps: SignalLamps.setEngineState(false) threw; ignored.');
      }
    }
  }

  /** ChainEditing markAcceptedEdit hook (beside SimpleView's own): any
   *  accepted edit may have re-plumbed the chain — re-plan, debounced
   *  past buildGraph's deferred commit. */
  function onChainChanged() {
    if (failed || !engineLive) {
      return;
    }
    scheduleRewire();
  }

  /** main.js device-switch hook: the mic-source tap follows the new
   *  source node (the old one is blanket-disconnected by the switch —
   *  the same re-tap moment MeterTaps has). */
  function onDeviceSwitched(newSourceNode) {
    if (failed || !engineLive) {
      return;
    }
    safe(function () {
      var src = newSourceNode || (window.AudioEngine && window.AudioEngine.sourceNode);
      if (!src) {
        return;
      }
      // The stage plan itself survives a device switch (same model);
      // only the source tap's edge needs re-making.
      ensurePool(1);
      wireTap(0, src);
      sourceRef = src;
    });
  }

  window.StageTaps = {
    onEngineStarted: onEngineStarted,
    onEngineStopped: onEngineStopped,
    onChainChanged: onChainChanged,
    onDeviceSwitched: onDeviceSwitched,
  };
})();
