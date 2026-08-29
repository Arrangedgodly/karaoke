// Meter wiring + runtime watchdog for the Node-Based Web Audio Chain
// Builder (FEW-3).
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of this project (see src/agent-ui.js,
// src/meters.js). No localStorage; no agent tool can reach anything in
// here (src/mcp-tools.js contains zero references to the taps, the
// chainGate, or window.MeterTaps — the ONLY restore path is the human
// "Restore output" button below).
//
// =====================================================================
// FEW-3 WIRING DIAGRAM (rq4-meters.md topology, all side-taps; issue #3
// moved the OUT tap to the final-output point)
// =====================================================================
//
//   AudioEngine.sourceNode ──┬──────────────────────────────► [chain
//   (mic; replaced by        │                                nodes] ─►
//    switchInputDevice)      │                                        │
//                            ▼                                        ▼
//                     analyserIn (fftSize 2048)              AudioGraph.chainGate ─►
//                            │        ▲                       (persistent; survives   outputAttenuator
//                            │        │                        every buildGraph())    (MC-4; persistent,
//                            │        └── created ONCE per              ▲              fixed -6 dBFS)
//                            │            session, OUTSIDE                │                 │
//                            │            buildGraph()                    │                 ▼
//                            ▼                                           │           destination
//                     analyserOut (fftSize 2048) ◄───────────────────────┘
//                            │        ▲
//                            │        └── FINAL-OUTPUT tap, connected EXACTLY ONCE
//                            │            (issue #3): analyserOut hangs off the
//                            │            OUTPUT ATTENUATOR's own output — AFTER
//                            │            the fixed -6 dBFS attenuation, one node
//                            │            before destination — never off the
//                            │            pre-attenuation chainGate. The
//                            │            attenuator is never disconnected by
//                            │            buildGraph()'s teardown, so this edge
//                            │            persists across every chain rebuild by
//                            │            design (verified against the teardown
//                            │            code in src/audio-graph.js).
//                            ▼
//                     (analyser outputs connect NOWHERE — AnalyserNode is
//                      a pass-through side-tap; per rq4 this adds no DSP
//                      and needs no wiring onward)
//
//   analyserIn is the one edge that must be re-made: on
//   AudioEngine.switchInputDevice() the old sourceNode is dead (stream
//   stopped + blanket-disconnected), so onDeviceSwitched() reconnects
//   analyserIn to the NEW sourceNode. Meters.reset() clears the visual
//   ballistics at the same moment (the two re-tap moments in rq4's
//   design: device switch and context recreation).
//
//   Issue #3 — why the OUT tap is AFTER the attenuator: BOTH consumers
//   of analyserOut (the OUT meter painted from time-domain data and the
//   watchdog's howl/peak detectors below) must reason about what the
//   LISTENER hears, i.e. the final output. The watchdog's trip threshold
//   is derived from AudioGraph.OUTPUT_CEILING_DBFS, which describes the
//   FINAL output; tapping upstream of the -6 dBFS attenuator had it
//   comparing a pre-attenuation signal against a final-output ceiling —
//   perfectly valid limiter-ceiling program sat ~6 dB "over" the
//   threshold and got muted. One tap serves both consumers, so the meter
//   and the detector are guaranteed to observe the same (this) point.
//
// =====================================================================
// LIFECYCLE (called from src/main.js — additive hook calls only)
// =====================================================================
//
//   MeterTaps.onEngineStarted()
//     After AudioEngine.start() resolves (audioContext + sourceNode
//     exist; main.js calls this AFTER the first buildGraph() so the
//     chainGate exists too). Creates the two taps lazily on first call
//     (idempotent on later calls: analyserIn is (re)connected only when
//     the live sourceNode differs from the one it's attached to;
//     analyserOut's output-attenuator connection is made exactly once
//     per session), flips Meters.setEngineState(true), and starts the
//     ONE shared rAF loop.
//   MeterTaps.onEngineStopped()
//     Cancels the loop and Meters.setEngineState(false). (main.js has no
//     stop path today — the app runs until close — but the hook exists
//     and is correct if one is ever added.) Detector TIMING state (peak
//     sustain window, howl ring) is cleared; a latched watchdog trip is
//     deliberately KEPT — a trip can only be cleared by the human
//     Restore button, never by an engine restart.
//   MeterTaps.onDeviceSwitched(newSourceNode)
//     Reconnects analyserIn (old source disconnected from the tap, new
//     source connected), recomputes nothing else (the OUT tap and the
//     band-bin math survive — same context), and calls Meters.reset().
//
// =====================================================================
// THE LOOP (rAF now drives ONLY the meters; watchdog detection moved
// OFF the paint loop — issue #7)
// =====================================================================
//
//   Per frame, per side: analyser.getFloatTimeDomainData(floatBuf) into
//   ONE REUSED Float32Array(2048); compute peakDb / rmsDb
//   (20*log10(max(v, 1e-9)) dBFS; explicit -Infinity on digital
//   silence) and clipRun (>= 3 consecutive samples with |v| >= 1.0 —
//   rq4's down-mix note is why >=, not >). Then
//   Meters.feed(side, {...}) — BOTH sides, EVERY frame, including
//   silence frames (the meters' contract: they must be TOLD about
//   silence; they do not infer it).
//
//   document.hidden: rAF auto-pauses when the tab is hidden, so the
//   METERS fall/decay to dark via their own component-side loop — that
//   is fine (hidden means nothing to paint). Issue #7 removed the old
//   "watchdog simply stops sampling while hidden" limitation: while
//   visible, the frame ALSO runs the watchdog checks at full cadence
//   (kept for issue #3 compatibility and immediacy), but the DECISIONS
//   no longer depend on rAF — see the #7 section below.
//
//   analyserOut.smoothingTimeConstant is set to 0. rq4's "do not set"
//   note concerns meter ballistics — smoothing applies to FREQUENCY
//   data only and the meters read time-domain data, so they are
//   unaffected either way. The watchdog, however, needs RAW per-frame
//   band energy: with the default 0.8 smoothing a sustained howl's
//   byte-quantized band average stops strictly rising after a handful
//   of frames and the monotonicity detector below would never fire.
//
// =====================================================================
// ISSUE #7 — protection stays live when the tab is HIDDEN
// =====================================================================
//
//   The watchdog used to sample only inside the rAF loop; rAF stops
//   when the tab is hidden while native Web Audio keeps running — the
//   watchdog went blind exactly when an unattended rig could howl. The
//   sampling now rides an AudioWorkletProcessor on the audio thread
//   (src/watchdog-worklet.js, registered as 'watchdog-tap'), which
//   never pauses for visibility:
//
//     WORKLET (audio thread): tapped off the output attenuator (the
//     same final-output point as analyserOut — issue #3's tap
//     semantics), computes per-block peak/RMS, posts a throttled
//     {peak,...} message every ~21 ms. Wired as a SILENT side-tap:
//     attenuator -> workletNode -> zero-gain -> destination (the
//     processor passes input through to its output, the zero gain
//     guarantees the destination never hears a duplicate; the
//     destination edge is what keeps process() pulled).
//
//     INTERVAL LATCH (main thread): one setInterval
//     (WATCH_INTERVAL_MS, 250 ms visible-intent). On each tick, IF the
//     worklet is live AND the page is hidden (or the rAF loop has
//     stalled > WATCHDOG_STALL_MS), the tick makes the trip decision
//     from the LATEST worklet peak (message delivery is not rAF-bound)
//     and from analyserOut's frequency buffer (the AUDIO thread keeps
//     filling an AnalyserNode's buffers while hidden — a main-thread
//     read on a timer still sees fresh data). While tripped, the tick
//     also runs the defend-the-mute backstop. Browsers throttle
//     background-tab intervals to >= ~1 s (pages PLAYING audio are
//     exempt from intensive throttling, and this app is) — HONEST
//     cadence disclosure: while hidden the peak rule evaluates at
//     ~1 s granularity instead of ~16 ms, so a sustained hot signal
//     trips in ~1–2 s instead of ~250 ms. Same thresholds, same
//     latch, same human-only restore; only the sampling cadence drops.
//
//     HOWL while hidden: the monotonicity window is 60 frames at
//     ~16 ms cadence (~1 s) — meaningless at 1 tick/s. The hidden bar
//     is therefore HIDDEN_HOWL_MIN_RISING (8) strictly rising steps
//     over the last HIDDEN_HOWL_WINDOW (10) ticks (~10 s of sustained
//     monotonic 1–8 kHz rise, same −60 dB floor). A howl that
//     saturates in <10 s parks the final output above the ceiling and
//     is caught by the hidden peak rule at the same ~1 s cadence — the
//     howl bar is the belt to that braces. Documented, deliberately
//     reduced, never silently equivalent.
//
//     FALLBACK (rAF-only mode): if audioWorklet.addModule is missing
//     or fails (old browser, file:// context), the watchdog stays on
//     the old rAF-only sampling — hidden protection is NOT available —
//   and the INTERIM MITIGATION from the issue fires: a
//   visibilitychange listener surfaces a non-modal operator warning
//   ("Keep this tab visible during the show — protection is reduced
//   while hidden.") for exactly as long as the page is hidden while
//   the engine is live, and docs/ACCEPTANCE.md §3 tells the operator
//   to keep the tab visible in that mode. When the worklet is live
//   there is NO warning (protection is active; only the cadence is
//   reduced, disclosed in the docs instead).
//
// =====================================================================
// WATCHDOG (rq3-loudness-policy.md §2 rule 8 — shares analyserOut)
// =====================================================================
//
//   ACTIVE only while the engine is running (the loop only runs then).
//   Samples the FINAL OUTPUT — analyserOut hangs off the output
//   attenuator, the same tap the OUT meter paints (see the wiring
//   diagram), so the threshold math below finally compares like with
//   like: final output vs final-output ceiling. ALL thresholds are
//   DERIVED from AudioGraph.OUTPUT_CEILING_DBFS — read LIVE every
//   frame, never re-typed as a literal (change the constant and the
//   watchdog follows):
//
//     Peak rule: OUT peakDb > (OUTPUT_CEILING_DBFS + PEAK_OVERHEAD_DB)
//     continuously for > PEAK_SUSTAIN_MS (250) ms → trip.
//
//     Howl rule: mean byte energy of the FFT bins covering ~1–8 kHz
//     (bin indices computed from audioContext.sampleRate at engine
//     start: binHz = sampleRate / fftSize) evaluated over a sliding
//     window of HOWL_WINDOW_FRAMES (60) consecutive frames; when the
//     window is full and >= HOWL_MIN_INCREASING (55) of its 59
//     frame-to-frame steps are strictly increasing AND the latest band
//     average is above a small magnitude floor (HOWL_FLOOR_DB = −60 dB,
//     converted to the analyser's byte scale via minDecibels/
//     maxDecibels) → trip. Flat signals give ~0 increasing steps and
//     noise gives ~half — both far below the bar.
//
//   TRIP (latches — NO auto-recover anywhere):
//     - chainGate.gain ramped to 0 over ~20 ms: cancelScheduledValues +
//       setValueAtTime(pin) + setTargetAtTime(0, now, MUTE_TC_S). The
//       watchdog NEVER touches the bypass dry path or the host
//       attenuator — mute is chainGate only, so Bypass remains the
//       operator's true escape at all times.
//     - a .watchdog-alert element is created (JS-only, agent-ui
//       pattern) after the OUT anchor / safe-output-note: 'OUTPUT
//       MUTED — <reason>' plus a real 'Restore output' <button>.
//     - AgentUI.reportMutation({source:'watchdog', summary:'Watchdog
//       tripped — output muted (<reason>)', errorText: <threshold +
//       duration>, nodeIds: []}) so agents/events observe the mute.
//     - While latched, the loop DEFENDS the mute as a BACKSTOP (issue
//       #3) — and so does the #7 interval tick while the tab is hidden
//       (worklet mode), when rAF is stopped: buildGraph()'s un-duck and
//       AudioBypass's disengage are
//       themselves latch-aware — they consult MeterTaps.isTripped() and
//       leave the gate at the mute level instead of ramping up — but any
//       foreign writer that still climbs the gate is caught here: if the
//       observed gain.value RISES while tripped, the 0-ramp is
//       re-applied. No rebuild or tool call can out-wait the latch.
//
//   RESTORE (human-only — the button click is the ONLY path; no agent
//   tool, feed value, or meter state restores it):
//     click → chainGate.gain ramped to its correct steady state
//     (0 while Bypass is engaged — mirrors buildGraph()'s own
//     un-duck target so restore can never un-mute the chain out from
//     under an engaged bypass — otherwise 1) over ~50 ms
//     (setTargetAtTime, RESTORE_TC_S); alert removed; detector state
//     reset; a second toast 'Output restored by operator'.
//
// Everything below is defensive in the house style: any failure (no
// AudioEngine, getChainGate() throwing, no DOM, no rAF) logs at most
// ONE console diagnostic and leaves MeterTaps a harmless no-op — meter
// wiring can never break the host app.
// =====================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Constants.
  // ---------------------------------------------------------------------

  var SIDE_IN = 'in';
  var SIDE_OUT = 'out';

  // rq4: fftSize 2048 @ 48 kHz = 42.7 ms window — comfortably larger
  // than the frame interval, margin for dropped frames to ~23 fps.
  var FFT_SIZE = 2048;
  var FREQ_BINS = FFT_SIZE / 2; // 1024 bins for getByteFrequencyData

  // dB conversion floor per the task spec: 20*log10(max(v, 1e-9)); an
  // all-zero (digital silence) window is reported as -Infinity.
  var DB_FLOOR_LINEAR = 1e-9;

  // rq4 clip criterion: a run of >= 3 consecutive samples at |v| >= 1.0
  // (>= because the analyser's forced mono down-mix can exceed 1.0).
  var CLIP_RUN_LEN = 3;
  var CLIP_LEVEL = 1.0;

  // ---- Watchdog (rq3 §2 rule 8). Every threshold derived, no -6 here. ----
  var PEAK_OVERHEAD_DB = 0.5; // trip above ceiling + 0.5 dB
  var PEAK_SUSTAIN_MS = 250; // ... continuously for > 250 ms
  var HOWL_BAND_LOW_HZ = 1000; // ~1–8 kHz howl band
  var HOWL_BAND_HIGH_HZ = 8000;
  var HOWL_WINDOW_FRAMES = 60; // ~1 s at 60 fps
  var HOWL_MIN_INCREASING = 55; // >= 55 of the window's 59 steps rising
  var HOWL_FLOOR_DB = -60; // "meaningful magnitude" band-average floor

  // ---- Issue #7: hidden-tab watchdog cadence / worklet wiring. ----
  // The worklet module's URL — page-relative, matching every other
  // src/*.js reference and the 'assets/ir/...' fetch convention.
  var WORKLET_URL = 'src/watchdog-worklet.js';
  // The interval latch's requested interval (250 ms, the peak sustain
  // window). While HIDDEN, browsers clamp intervals to >= ~1 s; the
  // detector code does not assume 250 — it measures elapsed time.
  var WATCH_INTERVAL_MS = 250;
  // A worklet peak older than this is stale (context suspended?) — the
  // tick falls back to sampling analyserOut directly.
  var WORKLET_FRESH_MS = 3000;
  // While visible the rAF loop drives detection; the tick takes over
  // only when the page is hidden or the loop stalled this long.
  var WATCHDOG_STALL_MS = 500;
  // Reduced hidden howl bar (see the #7 header section for the honest
  // cadence math: ~1 tick/s, so 10 ticks ~= 10 s of monotonic rise).
  var HIDDEN_HOWL_WINDOW = 10;
  var HIDDEN_HOWL_MIN_RISING = 8;

  // setTargetAtTime reaches ~95% of target at 3 time constants: these
  // give the spec's ~20 ms mute ramp and ~50 ms restore ramp.
  var MUTE_TC_S = 0.02 / 3;
  var RESTORE_TC_S = 0.05 / 3;

  // Latched-mute defense: re-apply the mute only when the observed
  // gain.value RISES by more than this while tripped (a foreign writer
  // — buildGraph's un-duck, Bypass disengage — is climbing the gate
  // back up). Measuring the RISE, not the absolute, keeps the defense
  // from fighting its own in-flight ramp.
  var GAIN_RISE_EPS = 0.05;

  // ---------------------------------------------------------------------
  // Module state.
  // ---------------------------------------------------------------------

  var analyserIn = null; // tap off AudioEngine.sourceNode
  var analyserOut = null; // FINAL-OUTPUT tap off AudioGraph.getOutputAttenuator() (issue #3)
  var currentSourceNode = null; // source analyserIn is connected to
  var outConnected = false; // attenuator -> analyserOut made exactly once

  // REUSED read buffers (single allocations for the whole session).
  var floatBuf = null; // Float32Array(FFT_SIZE)
  var freqBuf = null; // Uint8Array(FREQ_BINS)

  var rafHandle = null;
  var loopRunning = false;

  // ---- Issue #7 state: worklet tap, interval latch, fallback warning. ----
  var engineLive = false; // onEngineStarted..onEngineStopped
  var workletSetupDone = false; // setupWorklet runs at most once/session
  var workletMode = false; // true once 'watchdog-tap' posts messages
  var workletNode = null;
  var workletTapTail = null; // zero-gain node: worklet -> tail -> destination
  var workletPeakLinear = 0; // latest posted block-peak (linear)
  var workletPeakAt = -Infinity; // when it arrived (performance/DAT ms)
  var lastFrameAt = -Infinity; // last rAF watchdog pass (stall detection)
  var watchTimerHandle = null;
  var fallbackMode = false; // addModule missing/failed -> rAF-only + warning
  var hiddenWarnEl = null;

  // Howl band bin indices (computed from the context sample rate).
  var bandBinLo = 1;
  var bandBinHi = FREQ_BINS - 1;

  // Detector state.
  var overSince = null; // first timestamp OUT peak was over threshold
  var howlWindow = []; // sliding frame energies (band byte averages)

  // Watchdog latch.
  var tripped = false;
  var lastSeenGain = 0; // chainGate gain as of the previous latched frame
  var alertEl = null;

  var failed = false; // one-strike disable (see safe())
  var warned = {};

  // ---------------------------------------------------------------------
  // Small helpers.
  // ---------------------------------------------------------------------

  function now() {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  function warnOnce(message) {
    if (warned[message]) {
      return;
    }
    warned[message] = true;
    console.warn(message);
  }

  /** Run `fn`; on any throw, log ONE diagnostic and permanently disable
   *  MeterTaps (harmless no-op forever after) — the hard guarantee that
   *  meter wiring can never break the host app. */
  function safe(fn) {
    try {
      fn();
    } catch (err) {
      failed = true;
      stopLoop();
      console.error(
        'MeterTaps: wiring failed — meters/watchdog disabled; the rest of the app is unaffected.',
        err
      );
    }
  }

  function getMeters() {
    return typeof window !== 'undefined' ? window.Meters : undefined;
  }

  /** Live ceiling read — the single source of truth lives in
   *  AudioGraph.OUTPUT_CEILING_DBFS; the fallback only covers a stub
   *  environment that never defined it. */
  function ceilingDb() {
    var g = typeof window !== 'undefined' ? window.AudioGraph : undefined;
    if (g && typeof g.OUTPUT_CEILING_DBFS === 'number') {
      return g.OUTPUT_CEILING_DBFS;
    }
    return -6;
  }

  // ---------------------------------------------------------------------
  // Per-frame measurement (fills floatBuf first via the analyser).
  // ---------------------------------------------------------------------

  /** Compute the Meters.feed stats for the window currently in
   *  `floatBuf`: peak/rms in dBFS with explicit -Infinity on digital
   *  silence, plus rq4's >= 3-sample clip run. */
  function computeStats() {
    var maxAbs = 0;
    var sumSq = 0;
    var run = 0;
    var clipRun = false;
    for (var i = 0; i < FFT_SIZE; i++) {
      var v = floatBuf[i];
      var a = v < 0 ? -v : v;
      if (a > maxAbs) {
        maxAbs = a;
      }
      sumSq += v * v;
      if (a >= CLIP_LEVEL) {
        run++;
        if (run >= CLIP_RUN_LEN) {
          clipRun = true;
        }
      } else {
        run = 0;
      }
    }
    var peakDb = maxAbs > 0 ? 20 * Math.log10(maxAbs > DB_FLOOR_LINEAR ? maxAbs : DB_FLOOR_LINEAR) : -Infinity;
    var rms = Math.sqrt(sumSq / FFT_SIZE);
    var rmsDb = rms > 0 ? 20 * Math.log10(rms > DB_FLOOR_LINEAR ? rms : DB_FLOOR_LINEAR) : -Infinity;
    return { peakDb: peakDb, rmsDb: rmsDb, clipRun: clipRun };
  }

  /** Read one side's analyser into the SHARED reused buffer and feed
   *  the meters. Returns the computed stats (the watchdog reuses the
   *  OUT read rather than touching the analyser twice). */
  function readAndFeed(side, analyser) {
    analyser.getFloatTimeDomainData(floatBuf);
    var stats = computeStats();
    var Meters = getMeters();
    if (Meters && typeof Meters.feed === 'function') {
      Meters.feed(side, stats);
    }
    return stats;
  }

  // ---------------------------------------------------------------------
  // Watchdog.
  // ---------------------------------------------------------------------

  /** Ramp chainGate.gain to `target` with setTargetAtTime, replacing
   *  any pending automation first (the standard click-avoiding pattern
   *  used by AudioBypass/AudioGraph's own ramps). */
  function rampGate(target, timeConstant) {
    var ctx = window.AudioEngine && window.AudioEngine.audioContext;
    var gate = window.AudioGraph.getChainGate();
    var t = ctx.currentTime;
    gate.gain.cancelScheduledValues(t);
    gate.gain.setValueAtTime(gate.gain.value, t);
    gate.gain.setTargetAtTime(target, t, timeConstant);
  }

  /** Byte value HOWL_FLOOR_DB maps to on the analyser's byte scale
   *  (getByteFrequencyData maps minDecibels..maxDecibels to 0..255). */
  function howlFloorByte() {
    var minDb = typeof analyserOut.minDecibels === 'number' ? analyserOut.minDecibels : -100;
    var maxDb = typeof analyserOut.maxDecibels === 'number' ? analyserOut.maxDecibels : -30;
    var b = (255 * (HOWL_FLOOR_DB - minDb)) / (maxDb - minDb);
    return b < 0 ? 0 : b > 255 ? 255 : b;
  }

  /** Latch the trip: mute via chainGate only, show the alert, tell
   *  agents/events why. Idempotent (the first reason wins). */
  function trip(reason, errorText) {
    if (tripped) {
      return;
    }
    tripped = true;
    overSince = null;
    howlWindow = [];

    rampGate(0, MUTE_TC_S);
    try {
      lastSeenGain = window.AudioGraph.getChainGate().gain.value;
    } catch (err) {
      lastSeenGain = 1;
    }

    ensureAlert(reason);

    if (window.AgentUI && typeof window.AgentUI.reportMutation === 'function') {
      try {
        window.AgentUI.reportMutation({
          source: 'watchdog',
          summary: 'Watchdog tripped — output muted (' + reason + ')',
          errorText: errorText,
          nodeIds: [],
        });
      } catch (err) {
        warnOnce('MeterTaps: AgentUI.reportMutation failed on watchdog trip.');
      }
    }
  }

  /** While latched, hold the mute against foreign writers (buildGraph's
   *  un-duck ramp, Bypass disengage). Only re-fires when the observed
   *  gain RISES — see GAIN_RISE_EPS. */
  function defendMute() {
    var gain = window.AudioGraph.getChainGate().gain;
    var v = gain.value;
    if (v > GAIN_RISE_EPS && v > lastSeenGain + GAIN_RISE_EPS) {
      rampGate(0, MUTE_TC_S);
    }
    lastSeenGain = v;
  }

  /** Peak rule (threshold derived live from OUTPUT_CEILING_DBFS). Same
   *  threshold and sustain shape for the visible (rAF) and hidden
   *  (#7 tick) callers — `hidden` only annotates the trip text, because
   *  the honest difference is the sampling CADENCE (see the #7 header),
   *  never the bar itself. `t` is ms on the now()/rAF clock. */
  function peakCheck(t, peakDb, hidden) {
    var threshold = ceilingDb() + PEAK_OVERHEAD_DB;
    if (peakDb > threshold) {
      if (overSince === null) {
        overSince = t;
      } else if (t - overSince > PEAK_SUSTAIN_MS) {
        trip(
          'output peak above ceiling' + (hidden ? ' (tab hidden)' : ''),
          'OUT peak ' + peakDb.toFixed(1) + ' dBFS > ' +
            ceilingDb() + ' + ' + PEAK_OVERHEAD_DB + ' dB threshold for ' +
            Math.round(t - overSince) + ' ms (> ' + PEAK_SUSTAIN_MS + ' ms)' +
            (hidden ? ', sampled at the reduced hidden-tab cadence' : '')
        );
      }
    } else {
      overSince = null;
    }
  }

  /** Read analyserOut's frequency buffer (the AUDIO thread keeps it
   *  fresh even while the tab is hidden) and append ONE band-average
   *  sample to the howl window (smoothingTimeConstant is 0 — see the
   *  header). */
  function howlSample() {
    analyserOut.getByteFrequencyData(freqBuf);
    var sum = 0;
    for (var i = bandBinLo; i <= bandBinHi; i++) {
      sum += freqBuf[i];
    }
    howlWindow.push(sum / (bandBinHi - bandBinLo + 1));
    if (howlWindow.length > HOWL_WINDOW_FRAMES) {
      howlWindow.shift();
    }
  }

  /** Monotonic-rise check over the howl window. Visible cadence: the
   *  full 60-frame / 55-rising rq3 rule. Hidden cadence (#7): the
   *  reduced HIDDEN_* bar over the window's TAIL — at ~1 tick/s the
   *  60-frame window would take a minute; 8 rising steps of the last
   *  10 ticks is ~10 s of sustained rise, with the hidden peak rule as
   *  the faster brace for howls that saturate (see the #7 header). */
  function howlCheck(hidden) {
    var win = howlWindow;
    var windowLen = HOWL_WINDOW_FRAMES;
    var minRising = HOWL_MIN_INCREASING;
    var label = 'consecutive frames (~1 s)';
    if (hidden) {
      windowLen = HIDDEN_HOWL_WINDOW;
      minRising = HIDDEN_HOWL_MIN_RISING;
      label = 'consecutive samples at the reduced hidden-tab cadence (~10 s)';
    }
    if (howlWindow.length < windowLen) {
      return;
    }
    var tail = howlWindow.slice(howlWindow.length - windowLen);
    var rising = 0;
    for (var s = 1; s < tail.length; s++) {
      if (tail[s] > tail[s - 1]) {
        rising++;
      }
    }
    if (rising >= minRising && tail[tail.length - 1] > howlFloorByte()) {
      trip(
        'howling feedback (1\u20138 kHz rise)' + (hidden ? ' (tab hidden)' : ''),
        '1\u20138 kHz band average rose in ' + rising + ' of ' +
          (windowLen - 1) + ' ' + label + ', band level above the ' +
          HOWL_FLOOR_DB + ' dB floor'
      );
    }
  }

  /** The watchdog's per-frame OUT-side checks (detection only — mute
   *  action lives in trip()). `t` is the rAF timestamp in ms. */
  function watchOut(t, outStats) {
    peakCheck(t, outStats.peakDb, false);
    howlSample();
    howlCheck(false);
  }

  function resetDetectors() {
    overSince = null;
    howlWindow = [];
  }

  // ---------------------------------------------------------------------
  // Issue #7 — the worklet tap, the interval latch, the fallback warning.
  // ---------------------------------------------------------------------

  /** True when the page is hidden. Defensive: a bare harness (or an
   *  ancient browser) may not define document.hidden at all. */
  function pageHidden() {
    return typeof document !== 'undefined' && document && document.hidden === true;
  }

  /** The interval tick: the hidden/stalled-tab watchdog decision pass.
   *  Runs ONLY in worklet mode (the fallback keeps the watchdog on rAF
   *  alone, per the #7 ladder) and only when rAF is not already doing
   *  the job (page hidden, or the loop stalled/failed). */
  function watchTick() {
    if (!workletMode || !engineLive || failed) {
      return;
    }
    try {
      var t = now();
      if (tripped) {
        // Backstop keeps working while hidden — rAF is stopped.
        defendMute();
        return;
      }
      if (!pageHidden() && t - lastFrameAt < WATCHDOG_STALL_MS) {
        return; // the rAF loop is alive and visible — it decides
      }

      // Peak: prefer the worklet's audio-thread block peak (fresh from
      // the message port); a stale one means the context itself went
      // quiet — sample the analyser directly as the belt.
      var peakLinear = workletPeakLinear;
      if (t - workletPeakAt > WORKLET_FRESH_MS && analyserOut) {
        analyserOut.getFloatTimeDomainData(floatBuf);
        peakLinear = 0;
        for (var i = 0; i < FFT_SIZE; i++) {
          var a = floatBuf[i] < 0 ? -floatBuf[i] : floatBuf[i];
          if (a > peakLinear) {
            peakLinear = a;
          }
        }
      }
      var peakDb = peakLinear > 0
        ? 20 * Math.log10(peakLinear > DB_FLOOR_LINEAR ? peakLinear : DB_FLOOR_LINEAR)
        : -Infinity;
      peakCheck(t, peakDb, true);
      if (tripped) {
        return;
      }
      howlSample();
      howlCheck(true);
    } catch (err) {
      // Same one-diagnostic discipline as the rAF loop: a wedged tick
      // stops the timer; the graph (and the rAF path) are untouched.
      stopWatchTimer();
      console.error(
        'MeterTaps: hidden-tab watchdog tick failed — interval latch stopped; the rest of the app is unaffected.',
        err
      );
    }
  }

  function startWatchTimer() {
    if (watchTimerHandle !== null || typeof setInterval !== 'function') {
      return;
    }
    watchTimerHandle = setInterval(watchTick, WATCH_INTERVAL_MS);
  }

  function stopWatchTimer() {
    if (watchTimerHandle !== null) {
      try {
        if (typeof clearInterval === 'function') {
          clearInterval(watchTimerHandle);
        }
      } catch (err) {
        /* nothing to clear */
      }
      watchTimerHandle = null;
    }
  }

  /** Attempt the worklet tap once per session. Any miss (no
   *  audioWorklet, addModule rejection — old browser, file:// context)
   *  drops to fallbackMode: rAF-only watchdog + the interim
   *  visibilitychange warning. */
  function setupWorklet() {
    if (workletSetupDone) {
      return;
    }
    workletSetupDone = true;
    var ctx = window.AudioEngine && window.AudioEngine.audioContext;
    var aw = ctx && ctx.audioWorklet;
    if (!aw || typeof aw.addModule !== 'function') {
      enableFallback();
      return;
    }
    aw.addModule(WORKLET_URL)
      .then(function () {
        var node = new ctx.AudioWorkletNode(ctx, 'watchdog-tap', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        node.port.onmessage = function (ev) {
          if (ev && ev.data && ev.data.type === 'watchdog-block') {
            workletPeakLinear = ev.data.peak > 0 ? ev.data.peak : 0;
            workletPeakAt = now();
          }
        };
        // Silent side-tap at the SAME final-output point as
        // analyserOut: attenuator -> worklet (passthrough) -> zero-gain
        // tail -> destination. The destination edge keeps process()
        // pulled; the zero gain means the destination never hears the
        // passthrough copy on top of the program.
        var tail = ctx.createGain();
        tail.gain.value = 0;
        window.AudioGraph.getOutputAttenuator().connect(node);
        node.connect(tail);
        tail.connect(ctx.destination);
        workletNode = node;
        workletTapTail = tail;
        workletMode = true;
        hideHiddenWarning(); // protection active — no interim warning
        if (engineLive) {
          startWatchTimer();
        }
      })
      .catch(function (err) {
        console.warn(
          'MeterTaps: audio worklet unavailable — watchdog falls back to rAF-only sampling with NO hidden-tab protection (issue #7 interim mitigation active).',
          err
        );
        enableFallback();
      });
  }

  /** Interim mitigation: watch visibility, and while the engine is live
   *  in rAF-only mode, hold a non-modal operator warning on screen. */
  function enableFallback() {
    if (fallbackMode) {
      return;
    }
    fallbackMode = true;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
      return; // bare harness — nothing to warn on, nothing breaks
    }
    document.addEventListener('visibilitychange', function () {
      if (pageHidden()) {
        if (fallbackMode && engineLive && !tripped) {
          showHiddenWarning();
        }
      } else {
        hideHiddenWarning();
      }
    });
  }

  /** The warning element (JS-created, same creation pattern as the
   *  trip alert; styled by .watchdog-alert.watchdog-hint — the calm
   *  amber vocabulary, NOT the safety-red alert). Non-modal, no
   *  button: the remedy is "bring the tab back", not a click. */
  function showHiddenWarning() {
    if (hiddenWarnEl && hiddenWarnEl.parentNode) {
      return;
    }
    var canvasEl = document.getElementById('chain-canvas');
    if (!canvasEl) {
      return;
    }
    var el = document.createElement('div');
    el.id = 'watchdog-hidden-warning';
    el.className = 'watchdog-alert watchdog-hint';
    el.setAttribute('role', 'status');
    var text = document.createElement('span');
    text.className = 'watchdog-alert-text';
    text.textContent = 'Keep this tab visible during the show — protection is reduced while hidden.';
    el.appendChild(text);
    var note = document.getElementById('safe-output-note');
    var anchors = canvasEl.querySelectorAll && canvasEl.querySelectorAll('.anchor');
    var outAnchor = anchors && anchors.length ? anchors[anchors.length - 1] : null;
    if (note && note.parentNode === canvasEl) {
      canvasEl.insertBefore(el, note.nextSibling);
    } else if (outAnchor && outAnchor.parentNode === canvasEl) {
      canvasEl.insertBefore(el, outAnchor.nextSibling);
    } else {
      canvasEl.appendChild(el);
    }
    hiddenWarnEl = el;
  }

  function hideHiddenWarning() {
    if (hiddenWarnEl) {
      try {
        if (hiddenWarnEl.parentNode) {
          hiddenWarnEl.parentNode.removeChild(hiddenWarnEl);
        }
      } catch (err) {
        /* already detached */
      }
      hiddenWarnEl = null;
    }
  }

  // ---------------------------------------------------------------------
  // Alert element (JS-created, agent-ui pattern; styled by the
  //  .watchdog-alert block in styles/main.css).
  // ---------------------------------------------------------------------

  /** Create (once per trip) the alert: 'OUTPUT MUTED — <reason>' + a
   *  real 'Restore output' <button>. Inserted after the OUT anchor /
   *  safe-output-note in #chain-canvas (the same insertion convention
   *  AudioGraph.ensureSafeOutputNote() uses). */
  function ensureAlert(reason) {
    if (alertEl && alertEl.parentNode) {
      var textEl = alertEl.querySelector('.watchdog-alert-text');
      if (textEl) {
        textEl.textContent = 'OUTPUT MUTED — ' + reason;
      }
      return;
    }
    var canvasEl = document.getElementById('chain-canvas');
    if (!canvasEl) {
      return; // no DOM (e.g. a bare Node harness) — the MUTE still holds
    }
    var el = document.createElement('div');
    el.id = 'watchdog-alert';
    el.className = 'watchdog-alert';
    el.setAttribute('role', 'alert');

    var text = document.createElement('span');
    text.className = 'watchdog-alert-text';
    text.textContent = 'OUTPUT MUTED — ' + reason;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'control watchdog-restore';
    btn.textContent = 'Restore output';
    btn.addEventListener('click', function () {
      safe(restore);
    });

    el.appendChild(text);
    el.appendChild(btn);

    // Position: near the OUT anchor, below/after MC-4's safe-output-note
    // (which itself sits immediately after the OUT anchor — see
    // ensureSafeOutputNote() in src/audio-graph.js).
    var note = document.getElementById('safe-output-note');
    var anchors = canvasEl.querySelectorAll('.anchor');
    var outAnchor = anchors && anchors.length ? anchors[anchors.length - 1] : null;
    if (note && note.parentNode === canvasEl) {
      canvasEl.insertBefore(el, note.nextSibling);
    } else if (outAnchor && outAnchor.parentNode === canvasEl) {
      canvasEl.insertBefore(el, outAnchor.nextSibling);
    } else {
      canvasEl.appendChild(el);
    }
    alertEl = el;
  }

  function hideAlert() {
    if (alertEl) {
      try {
        if (alertEl.parentNode) {
          alertEl.parentNode.removeChild(alertEl);
        }
      } catch (err) {
        /* already detached */
      }
      alertEl = null;
    }
  }

  // ---------------------------------------------------------------------
  // Restore — HUMAN-ONLY. The button's click listener above is the only
  // caller; nothing else in the app (and no agent tool) reaches it.
  // ---------------------------------------------------------------------

  function restore() {
    if (!tripped) {
      return;
    }
    tripped = false;
    resetDetectors();

    // Correct steady state, mirroring buildGraph()'s own un-duck target:
    // while Bypass is engaged the chain gate belongs at 0 — restoring it
    // to 1 here would put dry+wet on top of each other.
    var bypassEngaged =
      window.AudioBypass && typeof window.AudioBypass.isEngaged === 'function' &&
      window.AudioBypass.isEngaged();
    rampGate(bypassEngaged ? 0 : 1, RESTORE_TC_S);

    hideAlert();

    if (window.AgentUI && typeof window.AgentUI.reportMutation === 'function') {
      try {
        window.AgentUI.reportMutation({
          source: 'watchdog',
          summary: 'Output restored by operator',
          nodeIds: [],
        });
      } catch (err) {
        warnOnce('MeterTaps: AgentUI.reportMutation failed on restore.');
      }
    }
  }

  // ---------------------------------------------------------------------
  // The ONE shared rAF loop.
  // ---------------------------------------------------------------------

  function frame(ts) {
    var t = typeof ts === 'number' && isFinite(ts) ? ts : now();
    try {
      if (analyserIn) {
        readAndFeed(SIDE_IN, analyserIn);
      }
      if (analyserOut) {
        var outStats = readAndFeed(SIDE_OUT, analyserOut);
        if (tripped) {
          defendMute();
        } else {
          watchOut(t, outStats);
        }
        lastFrameAt = t; // #7: stall detection for the interval latch
      }
    } catch (err) {
      // House precedent (src/meters.js): log once and stop the loop — a
      // wedged loop must never spam the console forever. The meters fall
      // back to their own decay loop; the watchdog stops sampling (the
      // graph is untouched).
      loopRunning = false;
      rafHandle = null;
      console.error(
        'MeterTaps: sample loop failed — meter feed stopped; the rest of the app is unaffected.',
        err
      );
      return;
    }
    if (loopRunning && typeof window.requestAnimationFrame === 'function') {
      rafHandle = window.requestAnimationFrame(frame);
    }
  }

  function startLoop() {
    if (loopRunning || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
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

  // ---------------------------------------------------------------------
  // Tap creation / connection.
  // ---------------------------------------------------------------------

  /** Compute the howl band's bin indices from the live context sample
   *  rate (binHz = sampleRate / fftSize; e.g. 48 kHz → bins 42..342). */
  function computeBandBins() {
    var ctx = window.AudioEngine && window.AudioEngine.audioContext;
    var sr = ctx && typeof ctx.sampleRate === 'number' ? ctx.sampleRate : 48000;
    var binHz = sr / FFT_SIZE;
    var lo = Math.floor(HOWL_BAND_LOW_HZ / binHz);
    var hi = Math.ceil(HOWL_BAND_HIGH_HZ / binHz);
    bandBinLo = lo < 1 ? 1 : lo;
    bandBinHi = hi > FREQ_BINS - 1 ? FREQ_BINS - 1 : hi;
  }

  /** Connect analyserIn to `src` exactly once per source node (device
   *  switch reconnects; same-node restarts do not re-connect). */
  function connectInTap(src) {
    if (!src || src === currentSourceNode) {
      return;
    }
    if (currentSourceNode) {
      try {
        currentSourceNode.disconnect(analyserIn);
      } catch (err) {
        /* old source already gone (switchInputDevice's blanket disconnect) */
      }
    }
    src.connect(analyserIn);
    currentSourceNode = src;
  }

  /** Create the two analysers on first engine start (lazily, OUTSIDE
   *  buildGraph()) and allocate the reused read buffers once. */
  function ensureTaps() {
    var ctx = window.AudioEngine && window.AudioEngine.audioContext;
    if (!ctx) {
      throw new Error('MeterTaps: AudioEngine.audioContext does not exist — start the engine first.');
    }
    if (!analyserIn || !analyserOut) {
      analyserIn = ctx.createAnalyser();
      analyserOut = ctx.createAnalyser();
      analyserIn.fftSize = FFT_SIZE;
      analyserOut.fftSize = FFT_SIZE;
      // Raw per-frame frequency data for the howl detector (see the
      // header for why this does not affect the meters).
      analyserOut.smoothingTimeConstant = 0;
      floatBuf = new Float32Array(FFT_SIZE);
      freqBuf = new Uint8Array(FREQ_BINS);
      computeBandBins();
    }
    connectInTap(window.AudioEngine.sourceNode);
    if (!outConnected) {
      // Issue #3: the OUT tap belongs at the FINAL OUTPUT — the output
      // attenuator's own output, AFTER the fixed -6 dBFS attenuation, so
      // the meters and the watchdog below observe exactly what the
      // listener hears and the ceiling-derived threshold compares final
      // output against final-output ceiling. The attenuator is
      // persistent (like the chainGate, it is deliberately not in
      // buildGraph()'s teardown set), so this single connection survives
      // every rebuild exactly the way the old chainGate edge did. This
      // runs on the FIRST engine start of a session, which also covers
      // an engine already started on an older build: the taps are
      // created lazily here, never carried over from a previous page
      // load, so there is no stale gate-fed analyser to clean up.
      window.AudioGraph.getOutputAttenuator().connect(analyserOut);
      outConnected = true;
    }
  }

  // ---------------------------------------------------------------------
  // Public API — the three lifecycle hooks main.js calls, plus the
  // read-only watchdog-latch probe (issue #3).
  // ---------------------------------------------------------------------

  /** main.js Start-success hook: taps live, meters live, loop running. */
  function onEngineStarted() {
    if (failed) {
      return;
    }
    safe(function () {
      ensureTaps();
      resetDetectors();
      var Meters = getMeters();
      if (Meters && typeof Meters.setEngineState === 'function') {
        Meters.setEngineState(true);
      }
      startLoop();
      // Issue #7: audio-thread watchdog tap (or the fallback ladder).
      // Async by nature (addModule); the rAF path above covers the gap.
      engineLive = true;
      lastFrameAt = now();
      setupWorklet();
      if (workletMode) {
        startWatchTimer();
      }
      if (fallbackMode && pageHidden()) {
        showHiddenWarning(); // restarted while already hidden (rAF-only)
      }
    });
  }

  /** main.js teardown hook (no stop path exists today; correct if one
   *  is added): loop cancelled, meters dark. A latched trip survives. */
  function onEngineStopped() {
    if (failed) {
      return;
    }
    stopLoop();
    stopWatchTimer();
    hideHiddenWarning(); // nothing to protect while stopped
    engineLive = false;
    resetDetectors();
    var Meters = getMeters();
    if (Meters && typeof Meters.setEngineState === 'function') {
      Meters.setEngineState(false);
    }
  }

  /** main.js device-switch hook: re-tap the IN side, reset meters. */
  function onDeviceSwitched(newSourceNode) {
    if (failed) {
      return;
    }
    safe(function () {
      if (analyserIn) {
        connectInTap(newSourceNode || window.AudioEngine.sourceNode);
      }
      var Meters = getMeters();
      if (Meters && typeof Meters.reset === 'function') {
        Meters.reset();
      }
    });
  }

  /** Issue #3: read-only latch probe. TRUE while the watchdog mute is
   *  latched (from trip() until the human Restore button's restore()).
   *  Consumers: AudioGraph's deferred un-duck and AudioBypass's
   *  disengage both consult this to suppress any upward chain-gate ramp
   *  while latched (the defend-the-mute loop remains the backstop).
   *  Read-only by construction — the latch itself (`tripped`) is closed
   *  over in this IIFE; nothing outside can write it, and overwriting
   *  this property only blinds the caller's own reference, never the
   *  latch or the loop. */
  function isTripped() {
    return tripped;
  }

  window.MeterTaps = {
    onEngineStarted: onEngineStarted,
    onEngineStopped: onEngineStopped,
    onDeviceSwitched: onDeviceSwitched,
    isTripped: isTripped,
  };
})();
