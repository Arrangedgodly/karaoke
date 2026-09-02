// MIC IN / OUT level meter components for the Node-Based Web Audio Chain
// Builder (VIS-5 — console re-skin lane).
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of this project (see src/agent-ui.js).
//
// Scope: PURE VISUAL + BALLISTICS. This module contains ZERO Web Audio API
// usage, zero AnalyserNodes and zero localStorage — FEW-3 owns the two
// analyser side-taps (IN off AudioEngine.sourceNode, OUT off
// AudioGraph.getChainGate(), per docs/ultron/research/rq4-meters.md) and
// pushes per-frame measurements into feed(). Everything that moves on
// screen — attack, decay, RMS smoothing, peak-hold, clip latching — is
// computed HERE, inside the component.
//
// =====================================================================
// VIS-5 CONTRACT — window.Meters (AUTHORITATIVE)
// =====================================================================
//
// Meters.init() -> boolean
//   Idempotent; also self-runs at load inside try/catch (any failure logs
//   exactly ONE console diagnostic and leaves the module a harmless no-op
//   — meters can never break the host app).
//
// Board redesign (2026-09-01, user direction): the free board's jack-print
// `.anchor` elements are gone (patch cords retired for an ordered,
// drag-to-reorder chain — see src/canvas.js), so both meters now build as
// PANEL-level strips instead of nesting inside an anchor: a "MIC IN" strip
// immediately ABOVE the scrolling #chain-canvas, a mirrored "OUT" strip
// immediately BELOW it — never inside #chain-canvas itself, so neither the
// board's own scroll nor a card drag can move or clip either meter. One
// shared builder (buildFooterUnit(side)) makes both; each strip is:
//
//     <div class="canvas-footer canvas-footer-in|out" data-meter-footer="in|out">
//       <span class="canvas-footer-legend">MIC IN|OUT</span>
//       <div class="meter-unit canvas-footer-unit" data-meter="in|out">
//         <canvas class="meter-canvas" width=96*dpr height=26*dpr
//                 role="meter" aria-valuemin="-60" aria-valuemax="0"
//                 aria-valuenow aria-valuetext aria-label>  (lamp bar + tick
//                                                            + clip dot +
//                                                            dB scale, all
//                                                            canvas-drawn)
//         <div class="meter-readout">                        (mono dB text)
//         <span class="sr-only">Input level|Output level</span>
//       </div>
//     </div>
//
//   Skipped silently when .canvas-panel or #chain-canvas cannot be found
//   (bare-harness safety) or when this side's strip already exists
//   (idempotence).
//
// Meters.feed(side, stats)          <- THE FEW-3 CALL CONTRACT
//   side:  'in' | 'out'.
//   stats: { peakDb:  number,   // dBFS peak of this frame's analyser
//                          window (20*log10(max|v|)); -Infinity for
//                          silence is accepted and expected.
//            rmsDb:  number,   // dBFS RMS of the same window; may exceed
//                          nothing (rms <= peak); -Infinity for silence.
//            clipRun: boolean  // true when this frame's window contained
//                          a run of >= 3 consecutive samples with
//                          |v| >= 1.0 (rq4's clip-detect criterion).
//          }
//   Call once per animation frame per side, from FEW-3's ONE shared rAF
//   loop, ALWAYS — including silence frames (feed -Infinity; the bars
//   must be told about silence, they do not infer it). All ballistics
//   live here, not in the caller:
//
//     Peak bar    attack: instant (per-frame window max, <= 5 ms
//                        effective); fall 12 dB/s (rq4/IEC PPM family).
//     RMS underlay  rise: 1-pole tau ~= 50 ms; fall 12 dB/s. Drawn as a
//                        dimmer segment set under the peak segments.
//     Peak-hold tick  hold 1500 ms at the highest recent peak, then fall
//                        12 dB/s; a strictly HIGHER peak restarts the
//                        hold. Never drawn below the current peak bar.
//     Clip latch    on clipRun === true: latch for >= 2000 ms — tick
//                        pinned at 0 dB in --meter-clip red, a 4 px clip
//                        dot at the bar's top-right, and the readout
//                        shows 'CLIP'; auto-clears after 2000 ms of no
//                        re-trigger (a re-trigger restarts the 2000 ms).
//
//   Defensive by contract: feed() before init(), an unknown side, or a
//   missing/malformed stats object never throws (each distinct problem
//   warns exactly once on the console, then stays silent). Non-numeric
//   or non-finite peak/rms values are treated as silence.
//
// Meters.setEngineState(started)
//   started === false (the default): meters render silent-at-rest DARK —
//   the dB scale visible as dark hardware, bars empty, readout '-INF';
//   incoming feed() values are ignored (nothing is live). transitioning
//   to false also clears all ballistics/clip state, so a stopped engine
//   can never leave a latched CLIP or a frozen bar on screen.
//   started === true: feeds are honored; meters go live.
//   FEW-3 calls this true once AudioEngine.start() resolves and false on
//   any teardown path.
//
// Meters.reset()
//   Clears all ballistics + clip latch + last-fed input on BOTH meters
//   and repaints once. FEW-3 calls this on input-device switch
//   (AudioEngine.switchInputDevice) or AudioContext recreation — the two
//   re-tap moments in rq4's design. Does NOT change the engine state.
//
// Rendering (canvas, DPR-aware, fixed logical size set once — the panel
// is fixed, so no resize handling exists by design):
//   - 96 x 26 CSS px logical canvas (bar strip 96 x 10 + 4 px clip-dot
//     row above + 9 px scale label row beneath); backing store is
//     logical x devicePixelRatio (clamped 1..3) for crisp 2x rendering.
//     ONE logical size serves both meters, so the CSS lockstep contract
//     in styles/main.css (.meter-canvas width/height) stays a single
//     96 x 26 pair.
//   - 19 lamp segments (4 px segment + 1 px gap): unlit segments in the
//     unlit-glass token (the visible-at-rest dark scale), lit segments in
//     the VU stops by zone — green --pm-vu-low (-60..-20), display amber
//     --pm-vu-mid (-20..-6), safety red --pm-vu-clip (-6..0) — with NO
//     shadowBlur: the Pattern Machine world's rule is brightness from
//     saturation on matte, never glow (redesign item 1; LAMP_GLOW_PX is
//     pinned to 0 at its definition).
//   - RMS underlay: same segments at 50% alpha, no glow.
//   - Peak-hold tick: 2 px, --text-primary; clip pin: 2 px at 0 dB in
//     --meter-clip + 4 px clip dot top-right, latched.
//   - Scale labels -60/-40/-20/-6/0: canvas-drawn (NOT DOM spans) so
//     they land at the exact x the bar maps dB through (guaranteed zone
//     alignment), repaint in the same single dirty-checked pass, and add
//     zero DOM. 9 px --font-readout mono in --text-muted.
//   - Dirty-check: a frame repaints only when peak/rms/hold moved
//     >= 0.25 dB or clip/engine state changed; at rest, zero repaints.
//   - No CSS animation/transitions exist on the meters at all, so
//     prefers-reduced-motion needs no special handling here: metering is
//     functional motion and stays live for everyone (VIS-6's rule).
//
// Accessibility: each canvas carries role="meter" with aria-valuemin="-60"
// / aria-valuemax="0"; aria-valuenow/-valuetext refresh at ~4 Hz (never
// per frame), only when the announced value actually changed. Values:
// "-12 dB"-style text, "silence" at/below the floor, "CLIP" while
// latched. The .sr-only span inside each unit carries the human label
// ("Input level" / "Output level").
// =====================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Constants (rq4 ballistics table + rq5 stops + VIS-5 sizing).
  // ---------------------------------------------------------------------

  var SIDE_IN = 'in';
  var SIDE_OUT = 'out';
  var SIDES = [SIDE_IN, SIDE_OUT];

  // Scale: -60..0 dBFS linear (rq4).
  var SCALE_MIN = -60;
  var SCALE_MAX = 0;
  // Internal silence sentinel: comfortably below the scale floor so a
  // decaying bar/rms/hold slides the whole way to "empty" and then parks
  // (constant value => dirty-check goes quiet).
  var SILENT_DB = -120;

  // Ballistics (rq4 table verbatim).
  var FALL_DB_PER_S = 12; // peak bar / rms / peak-hold fall rate
  var RMS_TAU_S = 0.05; // rms underlay 1-pole rise constant
  var HOLD_MS = 1500; // peak-hold before its 12 dB/s fall
  var CLIP_LATCH_MS = 2000; // clip latch duration (>= per rq4/plan)

  // A11y + dirty-check cadence.
  var ARIA_INTERVAL_MS = 250; // ~4 Hz announce ceiling
  var DIRTY_EPS_DB = 0.25; // repaint threshold on displayed values
  var DT_MAX_S = 0.25; // per-advance dt clamp (tab-hidden resume etc.)

  // A feed older than this is treated as silence (defensive only — FEW-3
  // feeds every frame including silence, so this never engages in normal
  // operation; it exists so a dead wiring loop leaves the meters falling
  // to dark instead of frozen mid-level).
  var FEED_STALE_MS = 500;

  // Logical layout (CSS px; .meter-canvas in styles/main.css MUST match).
  var CANVAS_W = 96;
  var CANVAS_H = 26;
  var BAR_TOP = 6;
  var BAR_H = 10;
  var SEG_COUNT = 19;
  var SEG_PITCH = 5; // 4 px lamp + 1 px gap
  var SEG_W = 4;
  var SEG_X0 = 1;
  var SEG_SPAN = SEG_COUNT * SEG_PITCH - 1; // 94 px of lit-able span
  var DB_PER_SEG = (SCALE_MAX - SCALE_MIN) / SEG_COUNT;
  var TICK_W = 2;
  var CLIP_DOT_X = 92;
  var CLIP_DOT_S = 4;
  var LABEL_BASE_Y = 24;
  var LABELS = [
    { db: -60, align: 'left', text: '−60' },
    { db: -40, align: 'center', text: '−40' },
    { db: -20, align: 'center', text: '−20' },
    { db: -6, align: 'center', text: '−6' },
    { db: 0, align: 'right', text: '0' },
  ];

  // Zone edges (rq4/rq5): green -60..-20, amber -20..-6, red -6..0.
  var ZONE_MID_EDGE = -20;
  var ZONE_CLIP_EDGE = -6;

  // ---------------------------------------------------------------------
  // THE LAMP TEST (2026-09-02 delight round) — the power-up.
  //
  // Pressing Start is the one moment this instrument comes alive, and it
  // used to happen in silence: a status sentence changed, and the two
  // lamp bars sat dark until the first frame of real audio. Real gear
  // does not do that. It runs its lamps end to end on the way up, which
  // is both the moment you feel the machine wake AND the only honest
  // proof that every segment on both meters can still light — the thing
  // an operator most wants confirmed before a show, in the one window
  // (setup) where confirming it is free.
  //
  // Called by src/main.js#beginStart() at the commit gesture, so it
  // fills a wait that ALREADY EXISTS (getUserMedia, the worklet module
  // fetches, the first graph build). It never delays anything: the
  // engine comes up on its own schedule, and if that beats the sweep the
  // real signal is simply drawn over it (see the max() in drawScene).
  //
  // THE HONESTY RULES, which are what make a display flourish
  // acceptable on a live-audio safety surface:
  //   - The sweep can only ever ADD light, never remove it. Every drawn
  //     level is max(real, sweep), so a bar can never under-report a
  //     signal that is actually there.
  //   - It touches the LAMPS only. The dB readout, the CLIP latch, the
  //     clip dot and every aria value stay wired to the real feed for
  //     the whole sequence, so the machine's numbers never lie — the
  //     readout reads −∞ under a full ladder, which is exactly what a
  //     lamp test looks like on hardware.
  //   - It runs once per engine start and then never again.
  //
  // This is one of the two halves of DESIGN.md's Power-Up Exception (the
  // other is the face wake in styles/main.css) — the single sequence
  // permitted past the 150-250 ms answer law.
  //
  // Reduced motion: no sweep. The ladders light full-scale for one short
  // hold and release — the same proof, as a state rather than a motion.
  // ---------------------------------------------------------------------
  var LAMP_RISE_MS = 260; // floor to full, exponential ease-out
  var LAMP_HOLD_MS = 120; // every segment lit
  var LAMP_FALL_MS = 320; // linear release, the way a ladder drops
  var LAMP_SWEEP_MS = LAMP_RISE_MS + LAMP_HOLD_MS + LAMP_FALL_MS;
  var LAMP_STATIC_MS = 200; // reduced-motion: one lit hold, no sweep

  var lampStartT = 0;
  var lampEndT = 0;
  var lampStatic = false;

  /** True only when the runtime can answer, and the operator has asked
   *  for less motion. Anything unreadable means "no preference" — the
   *  same direction every other guarded animation in this app takes. */
  function prefersReducedMotion() {
    try {
      return !!(
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    } catch (err) {
      return false;
    }
  }

  /** The sweep's level at time t, or SILENT_DB when no test is running.
   *  Pure: no state is written here, so a stalled or replayed frame
   *  cannot desynchronize the two meters from each other. */
  function lampLevel(t) {
    if (!(lampEndT > 0) || t >= lampEndT || t < lampStartT) {
      return SILENT_DB;
    }
    if (lampStatic) {
      return SCALE_MAX;
    }
    var e = t - lampStartT;
    var span = SCALE_MAX - SCALE_MIN;
    if (e < LAMP_RISE_MS) {
      var p = e / LAMP_RISE_MS;
      // Exponential ease-out: the ladder slams up and settles, the way a
      // needle does, rather than crawling linearly to the top.
      return SCALE_MIN + span * (1 - Math.pow(1 - p, 3));
    }
    if (e < LAMP_RISE_MS + LAMP_HOLD_MS) {
      return SCALE_MAX;
    }
    var f = (e - LAMP_RISE_MS - LAMP_HOLD_MS) / LAMP_FALL_MS;
    return SCALE_MIN + span * (1 - f);
  }

  // RMS underlay brightness relative to the peak pass (dimmer hardware,
  // and no glow — brightness is saturation on matte in this world).
  var RMS_ALPHA = 0.5;
  // Redesign item 1 (Pattern Machine): NO lamp glow. Lit segments are
  // saturated color on the matte unlit glass — brightness comes from
  // saturation, never blur (the world's no-glow rule). The constant
  // stays (resolved to 0) so the no-glow decision is documented at the
  // single paint site that used it.
  var LAMP_GLOW_PX = 0;

  // Fallback palette + font: the Pattern Machine VU tokens' values
  // VERBATIM (see the --pm-vu-* register in styles/main.css — green low
  // zone, display-amber mid zone, safety-red clip, matte unlit glass).
  // Used ONLY when CSS custom properties cannot be read (e.g. a
  // canvas-only test embed with no stylesheet); in the browser the live
  // tokens below always win, so these mirrors can never override a real
  // theme decision. NOT new colors — do not treat as a palette source.
  var DEFAULT_COLORS = {
    low: '#4EA96B', // --pm-vu-low
    mid: '#FFD75E', // --pm-vu-mid
    clip: '#E4574A', // --pm-vu-clip
    tick: '#C9CEDC', // --pm-vu-tick (peak-hold tick)
    unlit: '#262933', // --pm-vu-unlit (unlit lamp glass)
    label: '#9EA4B8', // --pm-vu-label (scale numerals)
    font: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', // --font-readout
  };

  // ---------------------------------------------------------------------
  // Module state.
  // ---------------------------------------------------------------------

  var units = {}; // side -> unit state (missing side = strip not built)
  var engineStarted = false; // setEngineState()'s flag (default: dark)
  var initialized = false;
  var loopRunning = false;
  var rafHandle = null;
  var colors = null; // resolved token map (see resolveColors)
  var warned = {}; // one console.warn per distinct defensive message

  // ---------------------------------------------------------------------
  // Small helpers.
  // ---------------------------------------------------------------------

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function clampNum(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

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

  function eachUnit(fn) {
    for (var i = 0; i < SIDES.length; i++) {
      var u = units[SIDES[i]];
      if (u) {
        fn(u, SIDES[i]);
      }
    }
  }

  /** Normalize a caller-supplied dB value; anything not a finite number
   *  (including -Infinity, undefined, NaN, strings) becomes silence. */
  function normDb(v) {
    if (!isNum(v)) {
      return SILENT_DB;
    }
    return clampNum(v, SILENT_DB, SCALE_MAX);
  }

  /** Exact x (logical px) a dB value maps to on the segment span. */
  function dbToX(db) {
    return SEG_X0 + ((db - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * SEG_SPAN;
  }

  /** dB at the center of segment i (its zone color comes from this). */
  function segCenterDb(i) {
    return SCALE_MIN + (i + 0.5) * DB_PER_SEG;
  }

  /** rq5 meter stop for a dB position: green below -20, amber -20..-6,
   *  red above -6. */
  function zoneColor(db) {
    return db < ZONE_MID_EDGE ? colors.low : db < ZONE_CLIP_EDGE ? colors.mid : colors.clip;
  }

  /** How many of the 19 lamp segments are lit for a level (a segment is
   *  lit when its center sits at or below the level). */
  function litCount(level) {
    if (!(level > SCALE_MIN)) {
      return 0;
    }
    var n = Math.ceil((level - SCALE_MIN) / DB_PER_SEG - 0.5);
    return clampNum(n, 0, SEG_COUNT);
  }

  function readoutText(u) {
    if (u.clip) {
      return 'CLIP';
    }
    if (u.peak > SCALE_MIN + 0.5) {
      return u.peak === 0 ? '0.0' : '−' + Math.abs(u.peak).toFixed(1);
    }
    return '−∞';
  }

  function ariaValueText(u) {
    if (u.clip) {
      return 'CLIP';
    }
    if (u.peak > SCALE_MIN + 0.5) {
      return u.peak === 0 ? '0 dB' : '-' + Math.round(Math.abs(u.peak)) + ' dB';
    }
    return 'silence';
  }

  function ariaValueNow(u) {
    return u.clip ? 0 : Math.round(clampNum(u.peak, SCALE_MIN, SCALE_MAX));
  }

  // ---------------------------------------------------------------------
  // Color/token resolution.
  // ---------------------------------------------------------------------

  /** Resolve the VU tokens the meter paints with from the live
   *  stylesheet — the Pattern Machine --pm-vu-* register first (redesign
   *  item 1), falling back to the legacy rq5 meter tokens, then to the
   *  DEFAULT_COLORS mirrors only when CSS custom properties are
   *  unreadable in this runtime. */
  function resolveColors() {
    if (colors) {
      return;
    }
    function token(name, fallback) {
      try {
        if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
          var v = getComputedStyle(document.documentElement).getPropertyValue(name);
          if (v && v.replace(/^\s+|\s+$/g, '')) {
            return v.replace(/^\s+|\s+$/g, '');
          }
        }
      } catch (err) {
        /* no computed styles here — use the mirror */
      }
      return fallback;
    }
    colors = {
      low: token('--pm-vu-low', token('--meter-low', DEFAULT_COLORS.low)),
      mid: token('--pm-vu-mid', token('--meter-mid', DEFAULT_COLORS.mid)),
      clip: token('--pm-vu-clip', token('--meter-clip', DEFAULT_COLORS.clip)),
      tick: token('--pm-vu-tick', token('--text-primary', DEFAULT_COLORS.tick)),
      unlit: token('--pm-vu-unlit', token('--hairline', DEFAULT_COLORS.unlit)),
      label: token('--pm-vu-label', token('--text-muted', DEFAULT_COLORS.label)),
      font: token('--font-readout', DEFAULT_COLORS.font),
    };
  }

  // ---------------------------------------------------------------------
  // Ballistics — advance one unit to time t (ms) with its current input.
  // ---------------------------------------------------------------------

  function advance(u, t) {
    if (u.lastT === null) {
      u.lastT = t;
    }
    var dt = (t - u.lastT) / 1000;
    u.lastT = t;
    if (!(dt > 0)) {
      dt = 0;
    }
    if (dt > DT_MAX_S) {
      dt = DT_MAX_S;
    }

    // Current input: the last feed, honored only while the engine is
    // started and the feed is fresh (see FEED_STALE_MS).
    var live = engineStarted && u.feed && t - u.feed.at <= FEED_STALE_MS;
    var inPeak = live ? u.feed.peakDb : SILENT_DB;
    var inRms = live ? u.feed.rmsDb : SILENT_DB;

    // Peak bar: instant attack to any higher input, 12 dB/s fall below
    // it (the per-frame window max FEW-3 feeds IS the attack).
    u.peak = Math.max(inPeak, u.peak - FALL_DB_PER_S * dt);

    // RMS underlay: 1-pole rise (tau = 50 ms) toward a higher input,
    // never falling faster than 12 dB/s below one.
    var decayedRms = u.rms - FALL_DB_PER_S * dt;
    if (inRms > decayedRms) {
      var alpha = 1 - Math.exp(-dt / RMS_TAU_S);
      u.rms = Math.max(u.rms + (inRms - u.rms) * alpha, decayedRms);
    } else {
      u.rms = decayedRms;
    }

    // Peak-hold tick: a strictly higher peak restarts the 1500 ms hold;
    // after expiry it falls at 12 dB/s, and it never renders below the
    // current peak bar (a constant signal re-anchors it to the bar
    // instead of sinking beneath it).
    if (inPeak > u.hold) {
      u.hold = inPeak;
      u.holdUntil = t + HOLD_MS;
    } else if (t > u.holdUntil && u.hold > SILENT_DB) {
      u.hold = Math.max(u.hold - FALL_DB_PER_S * dt, SILENT_DB);
    }
    if (u.hold < u.peak) {
      u.hold = u.peak;
    }

    // Clip latch: any clipRun frame (re)starts the 2000 ms latch; the
    // latch state itself is time-based so it auto-clears with no input.
    // Driven by the REAL feed alone — the power-up sweep below never
    // reaches it, so the machine can never latch a CLIP it did not hear.
    if (live && u.feed.clipRun) {
      u.clipUntil = t + CLIP_LATCH_MS;
    }
    u.clip = t < u.clipUntil;

    // The power-up sweep, kept beside the ballistics rather than folded
    // into them: drawScene reads max(real, lamp) so the test can only add
    // light, and everything that reports a NUMBER keeps reading u.peak.
    u.lamp = lampLevel(t);
  }

  // ---------------------------------------------------------------------
  // Rendering.
  // ---------------------------------------------------------------------

  function drawScene(ctx, u) {
    ctx.setTransform(u.dpr, 0, 0, u.dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // THE LAMP TEST's one and only reach into the render: the drawn
    // ladder is the BRIGHTER of the real level and the power-up sweep,
    // so the sweep can add light but never hide a signal. Outside a
    // power-up u.lamp is SILENT_DB and all three of these are exactly
    // the ballistics values, unchanged.
    var drawnPeak = u.peak > u.lamp ? u.peak : u.lamp;
    var drawnRms = u.rms > u.lamp ? u.rms : u.lamp;
    var drawnHold = u.hold > u.lamp ? u.hold : u.lamp;

    // 1) Unlit lamp glass — the dark hardware scale visible at rest.
    //    No glow ever lands here (lamp-light discipline).
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.unlit;
    for (var i = 0; i < SEG_COUNT; i++) {
      ctx.fillRect(SEG_X0 + i * SEG_PITCH, BAR_TOP, SEG_W, BAR_H);
    }

    // 2) RMS underlay — same lamp geometry, dimmer, no glow.
    var litRms = litCount(drawnRms);
    if (litRms > 0) {
      ctx.globalAlpha = RMS_ALPHA;
      for (var r = 0; r < litRms; r++) {
        ctx.fillStyle = zoneColor(segCenterDb(r));
        ctx.fillRect(SEG_X0 + r * SEG_PITCH, BAR_TOP, SEG_W, BAR_H);
      }
      ctx.globalAlpha = 1;
    }

    // 3) Peak lamps — full brightness, one restrained same-color glow.
    var litPeak = litCount(drawnPeak);
    if (litPeak > 0) {
      ctx.shadowBlur = LAMP_GLOW_PX * u.dpr; // blur applies in device px
      for (var p = 0; p < litPeak; p++) {
        var segColor = zoneColor(segCenterDb(p));
        ctx.fillStyle = segColor;
        ctx.shadowColor = segColor;
        ctx.fillRect(SEG_X0 + p * SEG_PITCH, BAR_TOP, SEG_W, BAR_H);
      }
      ctx.shadowBlur = 0;
    }

    // 4) Peak-hold tick — or, while latched, the red 0 dB clip pin.
    if (u.clip || drawnHold > SCALE_MIN + 0.5) {
      var level = u.clip ? SCALE_MAX : clampNum(drawnHold, SCALE_MIN, SCALE_MAX);
      var tx = clampNum(dbToX(level), SEG_X0, SEG_X0 + SEG_SPAN);
      ctx.fillStyle = u.clip ? colors.clip : colors.tick;
      ctx.fillRect(tx - TICK_W / 2, BAR_TOP, TICK_W, BAR_H);
    }

    // 5) Clip dot — 4 px, bar's top-right corner, latched.
    if (u.clip) {
      ctx.fillStyle = colors.clip;
      ctx.fillRect(CLIP_DOT_X, 0, CLIP_DOT_S, CLIP_DOT_S);
    }

    // 6) Scale numerals — canvas-drawn so they sit at the exact x the
    //    bar maps dB through (see the contract block for why not spans).
    ctx.fillStyle = colors.label;
    ctx.font = '9px ' + colors.font;
    ctx.textBaseline = 'alphabetic';
    for (var l = 0; l < LABELS.length; l++) {
      ctx.textAlign = LABELS[l].align;
      ctx.fillText(LABELS[l].text, dbToX(LABELS[l].db), LABEL_BASE_Y);
    }
  }

  /** Paint the unit's scene onto every mounted target (wayfinder #47: a
   *  side may carry more than one — the Advanced board's strip plus
   *  Simple's own stage-framing strip, both fed by this ONE ballistics
   *  state so the two views can never show different numbers). Views
   *  without a 2d context are skipped (state stays correct, per the
   *  stripped-embed note above). */
  function paint(u) {
    u.lastPaint = {
      peak: u.peak,
      rms: u.rms,
      hold: u.hold,
      lamp: u.lamp,
      clip: u.clip,
      started: engineStarted,
    };

    u.targets.forEach(function (target) {
      if (target.ctx) {
        drawScene(target.ctx, u);
      }
    });
  }

  /** DOM-facing outputs, written to every mounted target: the mono
   *  readout (updated whenever its text actually changes; the data-clip
   *  flag lets styles/main.css render the latched 'CLIP' in the
   *  --meter-clip stop) and the ~4 Hz throttled aria attributes. */
  function updateOutputs(u, t) {
    var txt = readoutText(u);
    if (txt !== u.readoutText) {
      u.readoutText = txt;
      u.targets.forEach(function (target) {
        if (target.readoutEl) {
          target.readoutEl.textContent = txt;
          target.readoutEl.setAttribute('data-clip', u.clip ? 'true' : 'false');
        }
      });
    }
    var ariaTxt = ariaValueText(u);
    if (ariaTxt !== u.lastAriaText && t - u.lastAriaT >= ARIA_INTERVAL_MS) {
      u.lastAriaText = ariaTxt;
      u.lastAriaT = t;
      u.targets.forEach(function (target) {
        if (target.canvas) {
          target.canvas.setAttribute('aria-valuenow', String(ariaValueNow(u)));
          target.canvas.setAttribute('aria-valuetext', ariaTxt);
        }
      });
    }
  }

  /** Dirty-check: repaint only when a displayed value moved >= 0.25 dB
   *  or a boolean state (clip / engine) flipped. At rest this converges
   *  to zero paint work per frame. */
  function considerPaint(u, t) {
    var lp = u.lastPaint;
    var dirty =
      !lp ||
      Math.abs(u.peak - lp.peak) >= DIRTY_EPS_DB ||
      Math.abs(u.rms - lp.rms) >= DIRTY_EPS_DB ||
      Math.abs(u.hold - lp.hold) >= DIRTY_EPS_DB ||
      Math.abs(u.lamp - lp.lamp) >= DIRTY_EPS_DB ||
      u.clip !== lp.clip ||
      engineStarted !== lp.started;
    if (dirty) {
      paint(u);
    }
    updateOutputs(u, t);
  }

  // ---------------------------------------------------------------------
  // Unit construction.
  // ---------------------------------------------------------------------

  // Legend text for each side's footer strip — the ONLY place "MIC IN"
  // ships as UI copy now that the free-board's jack-print anchors are
  // gone (board redesign, 2026-09-01 user direction): "OUT" keeps the
  // established short form, "MIC IN" keeps the established long form —
  // no reason to shorten a term the rest of the app (README, presets,
  // the signal-order strip) already uses verbatim.
  var FOOTER_LEGEND = {};
  FOOTER_LEGEND[SIDE_IN] = 'MIC IN';
  FOOTER_LEGEND[SIDE_OUT] = 'OUT';

  /**
   * Board redesign (2026-09-01): both meters live in a full-width PANEL
   * strip (never inside #chain-canvas, so neither the board's own scroll
   * nor a card drag can move or clip them) — IN as a strip immediately
   * ABOVE the scrolling row of cards, OUT as a strip immediately BELOW
   * it, one shared builder parameterized by side. This replaces the
   * former pair of mechanisms (a "MIC IN"/"OUT" jack-print `.anchor`
   * nested inside a narrow `.io-rail` side column, each holding its own
   * meter, plus a separate OUT-only fallback that only ever existed for
   * a since-reverted "in-flow OUT anchor retired" round and had
   * accumulated no CSS of its own, since the live OUT anchor always won
   * first) — one mechanism, two sides, neither dependent on the free
   * board's jack anatomy the rest of this refactor removes.
   * Silently skipped when the panel or #chain-canvas cannot be found
   * (bare-harness safety) or when this side's strip already exists
   * (idempotence).
   * @param {string} side - SIDE_IN or SIDE_OUT.
   * @returns {boolean} true when the strip was built (or already existed
   *   with a live unit — see the idempotence guard below).
   */
  function currentDpr() {
    return clampNum(
      (typeof window !== 'undefined' && isNum(window.devicePixelRatio)) ? window.devicePixelRatio : 1,
      1,
      3
    );
  }

  /** The ballistics state for `side`, created on first mount (Advanced's
   *  buildFooterUnit or Simple's mountSimpleUnit — whichever runs first).
   *  `targets` starts empty; every mount function below pushes one entry
   *  ({canvas, ctx, readoutEl}) rather than replacing this object, so a
   *  side already fed once by advance()/paint() keeps its exact ballistics
   *  (peak/rms/hold/clip) when a second view's strip mounts — nothing
   *  resets or double-computes just because Simple joins Advanced. */
  function ensureUnit(side) {
    if (units[side]) {
      return units[side];
    }
    units[side] = {
      side: side,
      targets: [],
      dpr: currentDpr(),
      lastT: null,
      feed: null, // last fed {peakDb, rmsDb, clipRun, at}
      peak: SILENT_DB,
      rms: SILENT_DB,
      hold: SILENT_DB,
      holdUntil: 0,
      clipUntil: 0,
      clip: false,
      // The power-up sweep's contribution to THIS unit's drawn level,
      // recomputed every advance() and never mixed into the ballistics
      // above — the real state stays real (see THE LAMP TEST).
      lamp: SILENT_DB,
      lastPaint: null,
      readoutText: '−∞',
      lastAriaT: 0,
      lastAriaText: 'silence',
    };
    return units[side];
  }

  /** Build one <div class="canvas-footer ...">...</div> strip (the
   *  contract block's markup, verbatim) for `side`, sized at the current
   *  device pixel ratio. Pure DOM construction — no insertion, no unit
   *  bookkeeping — so both mount paths below share exactly one markup
   *  source. */
  function createFooterStrip(side, dpr) {
    var footer = document.createElement('div');
    footer.className = 'canvas-footer canvas-footer-' + side;
    footer.setAttribute('data-meter-footer', side);

    var legend = document.createElement('span');
    legend.className = 'canvas-footer-legend';
    legend.textContent = FOOTER_LEGEND[side];

    var unit = document.createElement('div');
    unit.className = 'meter-unit canvas-footer-unit';
    unit.setAttribute('data-meter', side);

    var canvas = document.createElement('canvas');
    canvas.className = 'meter-canvas';
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.setAttribute('role', 'meter');
    canvas.setAttribute('aria-valuemin', String(SCALE_MIN));
    canvas.setAttribute('aria-valuemax', String(SCALE_MAX));
    canvas.setAttribute('aria-valuenow', String(SCALE_MIN));
    canvas.setAttribute('aria-valuetext', 'silence');
    canvas.setAttribute('aria-label', side === SIDE_IN ? 'Input level' : 'Output level');

    var readout = document.createElement('div');
    readout.className = 'meter-readout';
    readout.textContent = '−∞';

    var srLabel = document.createElement('span');
    srLabel.className = 'sr-only';
    srLabel.textContent = side === SIDE_IN ? 'Input level' : 'Output level';

    unit.appendChild(canvas);
    unit.appendChild(readout);
    unit.appendChild(srLabel);
    footer.appendChild(legend);
    footer.appendChild(unit);

    var ctx = null;
    try {
      ctx = canvas.getContext ? canvas.getContext('2d') : null;
    } catch (err) {
      ctx = null;
    }

    return { footer: footer, canvas: canvas, readoutEl: readout, ctx: ctx };
  }

  function buildFooterUnit(side) {
    if (typeof document.createElement !== 'function' ||
        typeof document.querySelector !== 'function') {
      return false;
    }
    var panel = document.querySelector('.canvas-panel');
    var canvasEl = document.getElementById('chain-canvas');
    // #chain-canvas is .canvas-panel's own direct child (the free
    // board's .board-frame wrapper that used to sit between them is
    // retired along with the rest of the free board), so canvasEl is a
    // valid insertBefore reference node directly.
    if (!panel || !canvasEl || !panel.insertBefore ||
        panel.querySelector('.canvas-footer[data-meter-footer="' + side + '"]')) {
      return false;
    }

    var u = ensureUnit(side);
    var strip = createFooterStrip(side, u.dpr);
    // A PANEL child, never inside #chain-canvas — IN goes immediately
    // BEFORE it (a header strip), OUT immediately after (a footer
    // strip); .canvas-panel is a flex column, so DOM position alone
    // decides visual position — no scroll or insertion-point impact
    // either way.
    if (side === SIDE_IN) {
      panel.insertBefore(strip.footer, canvasEl);
    } else {
      panel.insertBefore(strip.footer, canvasEl.nextSibling);
    }
    u.targets.push({ canvas: strip.canvas, ctx: strip.ctx, readoutEl: strip.readoutEl });
    return true;
  }

  /** wayfinder #47 — Simple's own MIC IN / OUT strips, framing its
   *  Current-sound stage exactly as the map's safety floor requires
   *  ("renders identically in both views"). Mounts the SAME markup as
   *  buildFooterUnit into Simple's own empty host elements
   *  (#simple-meter-in / #simple-meter-out — index.html, present from
   *  page load, hidden by CSS while Advanced is active) as an ADDITIONAL
   *  paint target on the side's existing ballistics unit, so both
   *  strips always show the exact same numbers — one feed, one set of
   *  ballistics, painted twice. Advanced's own mount (buildFooterUnit)
   *  is completely unaffected: same function, same call, same behavior.
   *  Silently skipped when the host element is absent (bare-harness
   *  safety, and pre-#47 index.html) or already has a mounted strip. */
  function mountSimpleUnit(side) {
    if (typeof document.getElementById !== 'function') {
      return false;
    }
    var host = document.getElementById(side === SIDE_IN ? 'simple-meter-in' : 'simple-meter-out');
    if (!host || !host.appendChild || host.querySelector('.canvas-footer')) {
      return false;
    }
    var u = ensureUnit(side);
    var strip = createFooterStrip(side, u.dpr);
    host.appendChild(strip.footer);
    u.targets.push({ canvas: strip.canvas, ctx: strip.ctx, readoutEl: strip.readoutEl });
    return true;
  }

  /** Clear all ballistics + input on one unit (reset() and the
   *  setEngineState(false) transition both route through here). */
  function clearUnit(u) {
    u.feed = null;
    u.lamp = SILENT_DB;
    u.peak = SILENT_DB;
    u.rms = SILENT_DB;
    u.hold = SILENT_DB;
    u.holdUntil = 0;
    u.clipUntil = 0;
    u.clip = false;
    u.lastPaint = null; // force one at-rest repaint
  }

  // ---------------------------------------------------------------------
  // Shared rAF loop (the component-side driver: advances ballistics and
  // repaints dirty meters even on frames FEW-3 feeds silence — and keeps
  // decay alive should FEW-3's own loop ever stall).
  // ---------------------------------------------------------------------

  function frame(ts) {
    rafHandle = null;
    if (!loopRunning) { return; }
    try {
      var t = isNum(ts) ? ts : now();
      eachUnit(function (u) {
        advance(u, t);
        considerPaint(u, t);
      });
    } catch (err) {
      // Never let a per-frame failure spam the console forever: log once
      // and stop the loop (feed() remains a complete driver on its own).
      loopRunning = false;
      console.error(
        'Meters: render loop failed — metering falls back to feed()-driven updates; the rest of the app is unaffected.',
        err
      );
      return;
    }
    if (loopRunning && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
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
    if (rafHandle !== null && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(rafHandle);
    }
    rafHandle = null;
  }

  // ---------------------------------------------------------------------
  // Public API.
  // ---------------------------------------------------------------------

  /** Build both meter strips. Idempotent; returns whether at least one
   *  unit exists after the call. Safe with no DOM at all. */
  function init() {
    if (initialized) {
      return true;
    }
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
      return false;
    }
    var builtIn = buildFooterUnit(SIDE_IN);
    var builtOut = buildFooterUnit(SIDE_OUT);
    // wayfinder #47: Simple's strips mount alongside Advanced's — both
    // present in index.html from page load, one hidden by CSS depending
    // on the active view (see mountSimpleUnit's own comment).
    var builtSimpleIn = mountSimpleUnit(SIDE_IN);
    var builtSimpleOut = mountSimpleUnit(SIDE_OUT);
    if (!builtIn && !builtOut && !builtSimpleIn && !builtSimpleOut) {
      return false;
    }
    resolveColors();
    initialized = true;
    if (engineStarted) { startLoop(); }
    // One immediate silent-at-rest paint per unit (scale + numerals
    // visible as dark hardware from load; engineStarted defaults false).
    var t = now();
    eachUnit(function (u) {
      if (u.lastT === null) {
        u.lastT = t;
      }
      considerPaint(u, t);
    });
    return true;
  }

  /** FEW-3's per-frame input (see the contract block). Defensive: never
   *  throws — before init, unknown sides, and malformed stats are
   *  dropped (one console.warn per distinct problem, then silent). */
  function feed(side, stats) {
    if (side !== SIDE_IN && side !== SIDE_OUT) {
      warnOnce('Meters.feed: side must be "in" or "out" — call ignored.');
      return;
    }
    var u = units[side];
    if (!u) {
      // Not initialized (or this side's strip failed to build) — nothing
      // to feed; deliberately silent so a no-DOM context stays quiet.
      return;
    }
    if (!stats || typeof stats !== 'object') {
      warnOnce('Meters.feed: expected a stats object { peakDb, rmsDb, clipRun } — call ignored.');
      return;
    }
    u.feed = {
      peakDb: normDb(stats.peakDb),
      rmsDb: normDb(stats.rmsDb),
      clipRun: stats.clipRun === true,
      at: now(),
    };
    advance(u, u.feed.at);
    considerPaint(u, u.feed.at);
  }

  /** Engine liveness gate (see the contract block). */
  function setEngineState(started) {
    var next = started === true;
    if (next === engineStarted) {
      return;
    }
    engineStarted = next;
    if (engineStarted) { startLoop(); } else { stopLoop(); }
    if (!engineStarted) {
      // Stopped: clear everything so no latched CLIP or frozen bar can
      // outlive the signal, and repaint the at-rest dark render.
      eachUnit(clearUnit);
    }
    var t = now();
    eachUnit(function (u) {
      considerPaint(u, t);
    });
  }

  /** Run the power-up lamp test on both meters (see THE LAMP TEST).
   *  Display-only and additive: it cannot hide a signal, cannot latch a
   *  clip, and cannot change a single reported number. Called by
   *  src/main.js at the Start commit; safe before init (no-op), safe to
   *  call again (the later call simply restarts the sweep).
   *
   *  @returns {boolean} whether a sweep is now running */
  function lampTest() {
    if (!initialized) {
      return false;
    }
    lampStatic = prefersReducedMotion();
    lampStartT = now();
    lampEndT = lampStartT + (lampStatic ? LAMP_STATIC_MS : LAMP_SWEEP_MS);
    // The shared loop is already running from init(), but a runtime that
    // stopped it (the one-shot failure guard in frame()) would otherwise
    // leave the sweep frozen on its first frame.
    startLoop();
    eachUnit(function (u) {
      if (u.lastT === null) {
        u.lastT = lampStartT;
      }
      advance(u, lampStartT);
      considerPaint(u, lampStartT);
    });
    return true;
  }

  /** Clear ballistics/clip on both meters (FEW-3's device-switch /
   *  context-recreation hook). Engine state is untouched. */
  function reset() {
    eachUnit(clearUnit);
    var t = now();
    eachUnit(function (u) {
      considerPaint(u, t);
    });
  }

  window.Meters = {
    init: init,
    feed: feed,
    setEngineState: setEngineState,
    lampTest: lampTest,
    reset: reset,
  };

  // Self-initialize at load. Any internal failure logs exactly one
  // console diagnostic and leaves the module a no-op — the same hard
  // guarantee src/agent-ui.js makes: feedback components can never break
  // the host app.
  try {
    init();
  } catch (err) {
    console.error(
      'Meters: initialization failed — meters disabled; the rest of the app is unaffected.',
      err
    );
  }
})();
