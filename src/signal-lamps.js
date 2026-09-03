// Signal lamps for the VOXCHAIN live-signal surface (overdrive round,
// 2026-09-02) — the visual half, pairing src/stage-taps.js (the audio
// half) the same way src/meters.js pairs with src/meter-taps.js: this
// file owns BALLISTICS and PAINT only. It contains zero Web Audio, zero
// graph access, zero localStorage; every method is fed by StageTaps and
// never throws back into its caller's frame loop (one-strike disable,
// the house safe() discipline).
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project.
//
// =====================================================================
// THE TWO LIVE SURFACES (one per view — the same truth, two pictures)
// =====================================================================
//
//   THE STAGE LAMPS (Advanced view) — the drawn chevrons between chain
//   cards (canvas.js#renderChainArrows, .chain-arrow-mark) light at the
//   level actually flowing across each gap, in the VU meters' own lamp
//   language (green -60..-20 / display amber -20..-6 / clip red -6..0 —
//   meters.js's exact zone edges, one lamp vocabulary on the machine).
//   Luminance follows level; geometry never moves. Ballistics: instant
//   attack, 24 dB/s fall — an activity light, deliberately twice the
//   meters' fall so the row reads lively without pretending to be the
//   measuring instrument (the meters stay the reading; this is the
//   glow of signal through the path). Resting ink is the chevron's own
//   --pm-print-dim: pre-Start, stopped, bypassed, watchdog-muted and
//   silent gaps all read as today's board — the addition can only add
//   light, never change the resting face.
//
//   THE SCOPE (Simple view) — the stage's own display slot: a live
//   envelope trace of the FINAL OUTPUT (the same tap point as the OUT
//   meter: after the host attenuator) in dot-matrix amber on register
//   ground, 136 min/max columns over the same 42.7 ms window the meters
//   see. The critique's own line — "the live Simple stage is a prose
//   column where it could be the instrument's display" — made literal.
//   It is a PICTURE, not a second mouth: aria-hidden, no numerals, no
//   labels (the OUT meter strip keeps the numbers); silence paints the
//   honest flat trace; bypass/trip flatten it by themselves because the
//   wet path they gate is what it reads. Pre-Start it is display:none —
//   the cold face owns the stage (CSS below).
//
//   The scope is not Simple's alone. This module BUILDS Simple's slot
//   and ADOPTS every other one from its view's own markup, by canvas
//   class (SCOPE_SELECTOR) — so Advanced's output band is a second VIEW
//   of the one feed, the way the pinned OUT footer is a second view of
//   the OUT meter. One tap, one window, one truth; each slot only ever
//   differs in how big a box it draws that truth into, and a slot that
//   is off screen costs a zero-box test and nothing else.
//
//   THE NAMEPLATE MATRIX (the system deck) — the product name itself,
//   DRAWN as 5x7 display cells rather than set in a typeface, and lit
//   from the baseline up by the same final-output window the scope
//   reads. It is the one place the machine says its OWN name, so it says
//   it in its own display register: unlit cells print bright (the word is
//   always readable, engine or no engine, JS or no JS — see the CSS
//   fallback), and the signal only ADDS light, turning cells from print
//   to lamp amber as the voice fills the word. Clip turns a column's lit
//   cells red, the same red the meters use, at the same threshold.
//   No typeface is involved: this is authored letterform geometry, so
//   the two-register type law (silkscreen sans / mono readout) is
//   untouched — nothing here is text.
//
// MOTION DISCIPLINE: both surfaces are functional metering in the
// documented meter family — per-frame paint like the VU lamps, live
// under prefers-reduced-motion by construction (the same clause
// DESIGN.md's meter ballistics carry). No transitions, no entrance, no
// geometry animation anywhere in this file.
// =====================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Constants — the meters' own scale and zone edges, mirrored so the
  // row and the VU strips can never disagree about what a level means.
  // ---------------------------------------------------------------------

  var SCALE_MIN = -60; // dBFS floor (meters.js SCALE_MIN)
  var ZONE_MID_DB = -20; // green -> amber
  var ZONE_CLIP_DB = -6; // amber -> clip
  var FALL_DB_PER_S = 24; // lamp fall (2x the meters' 12 — an activity light)
  var DT_MAX_S = 0.1;

  var SCOPE_HEIGHT = 72; // CSS px — the slot's fixed logical height
  var DPR_MAX = 3; // meters.js's device-pixel clamp

  // Every scope slot in the document, by canvas class. Simple's slot is
  // BUILT here (ensureScope); any other view's slot is ADOPTED from its
  // own markup, so a second display can be added to a view without this
  // module learning about that view.
  var SCOPE_SELECTOR = '.simple-scope-canvas, .adv-scope-canvas';
  var SCOPE_RESCAN_FRAMES = 30; // re-read the slot list ~twice a second

  // ---------------------------------------------------------------------
  // Module state.
  // ---------------------------------------------------------------------

  // Chevron lamp cache: the .chain-arrow-mark elements in board order
  // (document order IS gap order — renderChainArrows rebuilds them all
  // between cards). Invalidated by onArrowsRendered() and by any
  // feed whose level count disagrees with the cache; re-queried lazily.
  var arrowMarks = null;

  // Ballistics state, one entry per gap, parallel to arrowMarks:
  // displayed dB with instant attack / 24 dB/s fall. Re-allocated when
  // the gap count changes (a structural edit) — never carried across.
  var stageLevels = [];
  var lastT = null;

  // The scope. One paint target per slot canvas, each carrying its own
  // measured box and device ratio, so two slots of different sizes can
  // never share a stale geometry. `null` means the list needs re-reading.
  var scopeEl = null;
  var scopeCanvas = null;
  var scopeMountTried = false;
  var scopeTargets = null; // [{canvas, ctx, w, h, dpr}]
  var scopeRescanIn = 0; // frames left before the next DOM re-read

  // Resolved paint tokens (the meters.js resolution ladder: --pm-*
  // first, DEFAULTS mirrors only when computed styles are unreadable).
  var colors = null;

  var failed = false;
  var warned = {};

  // ---------------------------------------------------------------------
  // Small helpers.
  // ---------------------------------------------------------------------

  function warnOnce(message) {
    if (warned[message]) {
      return;
    }
    warned[message] = true;
    console.warn(message);
  }

  /** Run `fn`; on any throw, log ONE diagnostic and permanently disable
   *  the lamps (no-op forever after) — a paint bug must never kill
   *  StageTaps' measurement loop, which calls into this module every
   *  frame inside its own try. */
  function safe(fn) {
    try {
      fn();
    } catch (err) {
      failed = true;
      console.error(
        'SignalLamps: paint failed — live-signal display disabled; the rest of the app is unaffected.',
        err
      );
    }
  }

  function now() {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
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

  // meters.js's DEFAULT_COLORS mirrors, for runtimes without computed
  // styles (a stripped harness) — never the browser's first answer.
  var DEFAULTS = {
    low: '#4EA96B',
    mid: '#FFD75E',
    clip: '#E4574A',
    tick: '#C9CEDC',
    display: '#FFD75E',
    unlit: '#262933',
    print: '#c9cedc'
  };

  function resolveColors() {
    if (colors) {
      return;
    }
    colors = {
      low: token('--pm-vu-low', DEFAULTS.low),
      mid: token('--pm-vu-mid', DEFAULTS.mid),
      clip: token('--pm-vu-clip', DEFAULTS.clip),
      tick: token('--pm-vu-tick', DEFAULTS.tick),
      display: token('--pm-display', DEFAULTS.display),
      unlit: token('--pm-vu-unlit', DEFAULTS.unlit),
      // The nameplate's UNLIT cell ink. Deliberately not the meters'
      // unlit glass: a dark cell is right for a lamp bar the operator
      // reads by its lit length, and wrong for the product's name, which
      // must be legible on a dead engine in a dark room.
      print: token('--pm-print-hi', DEFAULTS.print)
    };
  }

  /** The zone color for a displayed level — meters.js's own edges. */
  function zoneColor(db) {
    if (db >= ZONE_CLIP_DB) {
      return colors.clip;
    }
    if (db >= ZONE_MID_DB) {
      return colors.mid;
    }
    return colors.low;
  }

  // ---------------------------------------------------------------------
  // Stage lamps (the board chevrons).
  // ---------------------------------------------------------------------

  /** (Re)query the chevron cache from the live DOM. Never throws: a
   *  harness without querySelectorAll simply keeps whatever it had. */
  function refreshArrowCache() {
    if (typeof document === 'undefined' || !document.querySelectorAll) {
      return;
    }
    var found = document.querySelectorAll('#chain-list .chain-arrow-mark');
    arrowMarks = Array.prototype.slice.call(found);
  }

  /** Clear one mark's inline lamp paint back to its resting ink (the
   *  stylesheet's --pm-print-dim border) — the only way anything here
   *  ever "turns off". */
  function restMark(el) {
    if (el.style) {
      if (typeof el.style.removeProperty === 'function') {
        el.style.removeProperty('border-color');
        el.style.removeProperty('opacity');
      } else {
        el.style.borderColor = '';
        el.style.opacity = '';
      }
    }
  }

  /** Advance ballistics and paint. `levels` is StageTaps' raw per-gap
   *  frame peak (dBFS or null for silence / honesty-gated darkness). */
  function feedStages(levels) {
    if (failed || !levels) {
      return;
    }
    safe(function () {
      resolveColors();

      if (!arrowMarks || arrowMarks.length !== levels.length) {
        refreshArrowCache();
        if (stageLevels.length !== (arrowMarks ? arrowMarks.length : 0)) {
          stageLevels = [];
          for (var r = 0; r < (arrowMarks ? arrowMarks.length : 0); r++) {
            stageLevels.push(SCALE_MIN);
          }
        }
      }

      // dt for the fall (clamped — a stalled tab must not dump seconds
      // of fall into one frame).
      var t = now();
      if (lastT === null) {
        lastT = t;
      }
      var dt = (t - lastT) / 1000;
      lastT = t;
      if (!(dt > 0)) {
        dt = 0;
      }
      if (dt > DT_MAX_S) {
        dt = DT_MAX_S;
      }

      var n = Math.min(arrowMarks ? arrowMarks.length : 0, levels.length);
      for (var k = 0; k < n; k++) {
        var inDb = levels[k];
        var shown = stageLevels[k];
        if (typeof inDb === 'number' && isFinite(inDb)) {
          shown = Math.max(inDb, shown - FALL_DB_PER_S * dt);
        } else {
          shown = shown - FALL_DB_PER_S * dt; // silence: pure fall
        }
        stageLevels[k] = shown;

        var el = arrowMarks[k];
        if (shown <= SCALE_MIN + 0.5) {
          restMark(el);
          continue;
        }

        // Luminance follows level (a lamp, not a gauge): opacity maps
        // the dB range onto 0.45..1 so a healthy speech level (-30..-12)
        // already reads clearly while headroom stays visible.
        var unit = (shown - SCALE_MIN) / (0 - SCALE_MIN);
        if (unit > 1) {
          unit = 1;
        }
        el.style.borderColor = zoneColor(shown);
        el.style.opacity = (0.45 + 0.55 * unit).toFixed(3);
      }
    });
  }

  // ---------------------------------------------------------------------
  // The scope (Simple view's display slot).
  // ---------------------------------------------------------------------

  /** Build the scope slot once, lazily: a register-ground div carrying
   *  one canvas, inserted into .simple-stage-inner directly before
   *  #simple-summary (under the sound's name/description, above the
   *  per-effect list — the machine's picture before the verbal one).
   *  CSS (styles/main.css) owns the slot's geometry and the cold-face
   *  display:none; this only creates and mounts. */
  function ensureScope() {
    if (scopeEl || scopeMountTried ||
        typeof document === 'undefined' || !document.createElement) {
      return;
    }
    scopeMountTried = true;
    if (typeof document.querySelector !== 'function') {
      return;
    }
    var inner = document.querySelector('.simple-stage-inner');
    if (!inner) {
      return; // stripped harness — nothing to mount, feeds skip
    }

    scopeEl = document.createElement('div');
    scopeEl.className = 'simple-scope';
    scopeEl.setAttribute('aria-hidden', 'true');

    scopeCanvas = document.createElement('canvas');
    scopeCanvas.className = 'simple-scope-canvas';
    scopeEl.appendChild(scopeCanvas);

    var summary = document.getElementById('simple-summary');
    if (summary && typeof inner.insertBefore === 'function' && summary.parentNode === inner) {
      inner.insertBefore(scopeEl, summary);
    } else if (typeof inner.appendChild === 'function') {
      inner.appendChild(scopeEl);
    } else {
      scopeEl = null;
      scopeCanvas = null;
      return;
    }
    scopeTargets = null; // a slot just appeared — re-read on the next feed
  }

  /** Re-read the scope slots present in the document. Cheap and rare
   *  (twice a second, never per frame): a view switch, a newly mounted
   *  band, or a removed one all land here without the paint path paying
   *  a query every frame. Existing entries are carried across by canvas
   *  identity so a re-read never re-sizes (and so never blanks) a slot
   *  that has not moved. A slot that is off screen keeps its entry and
   *  is skipped at paint time by its own zero box. */
  function collectScopes() {
    var prev = scopeTargets || [];
    var list = [];
    if (typeof document.querySelectorAll !== 'function') {
      scopeTargets = list;
      return;
    }
    var nodes = document.querySelectorAll(SCOPE_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var canvas = nodes[i];
      var kept = null;
      for (var j = 0; j < prev.length; j++) {
        if (prev[j].canvas === canvas) {
          kept = prev[j];
          break;
        }
      }
      if (kept) {
        list.push(kept);
        continue;
      }
      var ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (ctx) {
        list.push({ canvas: canvas, ctx: ctx, w: 0, h: 0, dpr: 1 });
      }
    }
    scopeTargets = list;
  }

  /** (Re)measure + resize the backing store to the slot's current CSS
   *  box (DPR-aware, meters.js's clamp). Returns false when the slot is
   *  not on screen right now (Simple hidden, or the cold face owning
   *  the stage) — the caller skips painting, nothing resizes. */
  function prepareScopeCanvas(t) {
    var w = t.canvas.clientWidth || 0;
    var h = t.canvas.clientHeight || 0;
    if (!(w > 0) || !(h > 0)) {
      return false;
    }
    if (w !== t.w || h !== t.h) {
      var dpr = 1;
      try {
        dpr = Math.max(1, Math.min(DPR_MAX, window.devicePixelRatio || 1));
      } catch (err) {
        dpr = 1;
      }
      t.canvas.width = Math.round(w * dpr);
      t.canvas.height = Math.round(h * dpr);
      t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      t.dpr = dpr;
      t.w = w;
      t.h = h;
    }
    return true;
  }

  /** Alpha for a column by its local amplitude (linear): a sqrt lift so
   *  conversational level (-30..-15 dB) already carries visible ink
   *  while loud passages push to full — luminance as level, honestly. */
  function columnAlpha(amp) {
    var a = amp < 0 ? -amp : amp;
    if (a > 1) {
      a = 1;
    }
    return 0.3 + 0.7 * Math.sqrt(a);
  }

  /** Draw one frame of the output envelope: min/max columns in display
   *  amber over the register ground, a center baseline and ±6 dB guide
   *  hairlines in the unlit tick ink, and a clip-zone tip (>=0.985
   *  linear) painted in the VU clip color — the meters' red means the
   *  same thing three feet away. */
  function feedScope(pairs, columns, peakDb) {
    if (failed || !pairs || !columns) {
      return;
    }
    safe(function () {
      resolveColors();
      ensureScope();
      if (!scopeTargets || scopeRescanIn <= 0) {
        collectScopes();
        scopeRescanIn = SCOPE_RESCAN_FRAMES;
      } else {
        scopeRescanIn--;
      }
      for (var i = 0; i < scopeTargets.length; i++) {
        var t = scopeTargets[i];
        if (prepareScopeCanvas(t)) {
          paintScope(t, pairs, columns);
        }
        // else: not on screen — skip the paint, keep the feed honest
      }
      // The deck's wordmark reads the same window, from the same call —
      // one feed, every live surface, no second measurement anywhere.
      feedNameplate(pairs, columns);
    });
  }

  /** Paint one prepared slot. Every slot reads the SAME window from the
   *  same tap, so two visible slots are two views of one truth — never
   *  two measurements. */
  function paintScope(t, pairs, columns) {
    {
      var w = t.w;
      var h = t.h;
      var cy = h / 2;
      var gain = (h / 2) - 3; // 3px headroom so 0 dBFS never clips the slot
      var ctx = t.ctx;

      ctx.clearRect(0, 0, w, h);

      // Guides: the center line plus ±6 dB (±0.5 linear) hairlines —
      // the scope's own scale, as quiet as the meter scale it mirrors.
      ctx.strokeStyle = colors.unlit;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(cy) + 0.5);
      ctx.lineTo(w, Math.round(cy) + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(cy - 0.5 * gain) + 0.5);
      ctx.lineTo(w, Math.round(cy - 0.5 * gain) + 0.5);
      ctx.moveTo(0, Math.round(cy + 0.5 * gain) + 0.5);
      ctx.lineTo(w, Math.round(cy + 0.5 * gain) + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // The envelope columns. On a fractional device pixel ratio a
      // logical-px stroke lands between device pixels and paints soft —
      // the one place this display would betray its canvas. Snap each
      // column's x and width to the device grid (exact on integer dpr,
      // half-pixel on 1.5, quarter-proof on 2+ where it matters most).
      var colW = w / columns;
      var strokeW = Math.max(1.5, colW * 0.66);
      var clipZone = 0.985;
      for (var c = 0; c < columns; c++) {
        var min = pairs[c * 2];
        var max = pairs[c * 2 + 1];
        var yMin = cy - max * gain;
        var yMax = cy - min * gain;
        if (yMax - yMin < 2) {
          yMin = cy - 1; // a silent column still draws its flat 2px trace
          yMax = cy + 1;
        }
        var amp = Math.max(Math.abs(min), Math.abs(max));
        var x = c * colW + (colW - strokeW) / 2;
        var sw = strokeW;
        if (t.dpr > 1) {
          x = Math.round(x * t.dpr) / t.dpr;
          sw = Math.round(sw * t.dpr) / t.dpr;
        }
        ctx.globalAlpha = columnAlpha(amp);
        ctx.fillStyle = colors.display;
        ctx.fillRect(x, yMin, sw, yMax - yMin);
        if (Math.abs(min) >= clipZone || Math.abs(max) >= clipZone) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = colors.clip;
          var tipY = Math.abs(max) >= Math.abs(min) ? yMin : yMax;
          ctx.fillRect(x, tipY, sw, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------------
  // The nameplate matrix (the system deck's identity).
  // ---------------------------------------------------------------------

  // The wordmark, drawn. Each glyph is a 5x7 cell block; '1' is a cell
  // that exists in the letterform, and a cell that exists is either
  // PRINTED (unlit) or LIT. One column of gap between glyphs, so the
  // word is 8*5 + 7 = 47 cells wide and 7 tall — the grid the CSS box is
  // sized to in whole pixels, which is why the dots stay square and the
  // word never lands on a half pixel.
  var NP_ROWS = 7;
  var NP_GLYPHS = {
    V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    A: ['00100', '01010', '10001', '10001', '11111', '10001', '10001'],
    I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001']
  };
  var NP_WORD = 'VOXCHAIN';

  var npCells = null; // [col][row] booleans, built once
  var npCols = 0;
  var npCanvas = null;
  var npCtx = null;
  var npW = 0;
  var npH = 0;
  var npDpr = 1;
  var npFound = false; // the canvas exists in this document
  var npLive = false;  // a first paint succeeded; the CSS fallback is off

  /** Expand the glyph table into one column-major cell map. */
  function buildNameplateCells() {
    if (npCells) {
      return;
    }
    var cols = [];
    for (var g = 0; g < NP_WORD.length; g++) {
      var rows = NP_GLYPHS[NP_WORD.charAt(g)];
      if (!rows) {
        continue;
      }
      for (var x = 0; x < rows[0].length; x++) {
        var col = [];
        for (var y = 0; y < NP_ROWS; y++) {
          col.push(rows[y].charAt(x) === '1');
        }
        cols.push(col);
      }
      if (g < NP_WORD.length - 1) {
        cols.push([false, false, false, false, false, false, false]);
      }
    }
    npCells = cols;
    npCols = cols.length;
  }

  /** Find the canvas and size its backing store. Returns false when the
   *  matrix is not on screen (no canvas, or a zero box) — the caller
   *  paints nothing and the CSS fallback keeps the word visible. */
  function prepareNameplate() {
    if (!npCanvas) {
      if (npFound || typeof document === 'undefined' ||
          typeof document.querySelector !== 'function') {
        return false;
      }
      npCanvas = document.querySelector('.nameplate-matrix-canvas');
      npFound = true;
      if (!npCanvas) {
        return false;
      }
      npCtx = npCanvas.getContext ? npCanvas.getContext('2d') : null;
      if (!npCtx) {
        npCanvas = null;
        return false;
      }
    }
    var w = npCanvas.clientWidth || 0;
    var h = npCanvas.clientHeight || 0;
    if (!(w > 0) || !(h > 0)) {
      return false;
    }
    if (w !== npW || h !== npH) {
      var dpr = 1;
      try {
        dpr = Math.max(1, Math.min(DPR_MAX, window.devicePixelRatio || 1));
      } catch (err) {
        dpr = 1;
      }
      npCanvas.width = Math.round(w * dpr);
      npCanvas.height = Math.round(h * dpr);
      npCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      npDpr = dpr;
      npW = w;
      npH = h;
    }
    return true;
  }

  /** Paint the word. `pairs`/`columns` absent (or all silence) paints the
   *  resting face: every letterform cell in print, nothing lit. The lit
   *  height of a column is sqrt-lifted like the scope's ink, so
   *  conversational level already climbs a row or two instead of sitting
   *  dark until someone shouts. */
  function drawNameplate(pairs, columns) {
    buildNameplateCells();
    var ctx = npCtx;
    var cell = npW / npCols;
    var dot = Math.max(1, Math.round(cell) - 1);
    ctx.clearRect(0, 0, npW, npH);
    for (var x = 0; x < npCols; x++) {
      var lit = 0;
      var clipped = false;
      if (pairs && columns) {
        var from = Math.floor((x * columns) / npCols);
        var to = Math.floor(((x + 1) * columns) / npCols);
        if (to <= from) {
          to = from + 1;
        }
        var amp = 0;
        for (var i = from; i < to && i < columns; i++) {
          var lo = pairs[i * 2];
          var hi = pairs[i * 2 + 1];
          var a = Math.max(lo < 0 ? -lo : lo, hi < 0 ? -hi : hi);
          if (a > amp) {
            amp = a;
          }
        }
        if (amp > 1) {
          amp = 1;
        }
        if (amp >= 0.985) {
          clipped = true;
        }
        lit = Math.round(Math.sqrt(amp) * NP_ROWS);
      }
      var litFrom = NP_ROWS - lit;
      var colCells = npCells[x];
      for (var y = 0; y < NP_ROWS; y++) {
        if (!colCells[y]) {
          continue;
        }
        var on = lit > 0 && y >= litFrom;
        ctx.fillStyle = on ? (clipped ? colors.clip : colors.mid) : colors.print;
        // Snap every dot to the device grid: at this size a half-pixel
        // edge is the difference between a machined cell and a smudge.
        var px = Math.round((x * cell + (cell - dot) / 2) * npDpr) / npDpr;
        var py = Math.round((y * cell + (cell - dot) / 2) * npDpr) / npDpr;
        ctx.fillRect(px, py, dot, dot);
      }
    }
    if (!npLive && npCanvas.parentNode && npCanvas.parentNode.parentNode &&
        npCanvas.parentNode.parentNode.classList) {
      // The word was drawn at least once, so the text fallback can stand
      // down. Until this moment the CSS nameplate is what the operator
      // sees, which is why a dead paint path can never cost the product
      // its name.
      npCanvas.parentNode.parentNode.classList.add('matrix-live');
      npLive = true;
    }
  }

  /** Paint the resting face — called at load, on resize, and whenever the
   *  engine stops (a frozen last frame would claim a signal that is no
   *  longer there). */
  function restNameplate() {
    if (failed) {
      return;
    }
    safe(function () {
      resolveColors();
      if (prepareNameplate()) {
        drawNameplate(null, 0);
      }
    });
  }

  function feedNameplate(pairs, columns) {
    if (!prepareNameplate()) {
      return;
    }
    drawNameplate(pairs, columns);
  }

  // ---------------------------------------------------------------------
  // Public API (StageTaps is the only producer; canvas.js pings
  // onArrowsRendered after every connector rebuild).
  // ---------------------------------------------------------------------

  /** canvas.js#renderChainArrows hook: the chevron elements were just
   *  rebuilt from scratch — drop the cache so the next feed re-queries.
   *  Ballistics RESTART from rest for the new gap set (a structural
   *  change is a new truth, not a continuation of the old one). */
  function onArrowsRendered() {
    if (failed) {
      return;
    }
    arrowMarks = null;
    stageLevels = [];
  }

  /** StageTaps' engine-stop hook (and any future dark-state owner):
   *  clear every lamp to its resting ink and restart ballistics. */
  function setEngineState(started) {
    if (failed) {
      return;
    }
    if (!started) {
      safe(function () {
        if (arrowMarks) {
          for (var k = 0; k < arrowMarks.length; k++) {
            restMark(arrowMarks[k]);
          }
        }
        arrowMarks = null;
        stageLevels = [];
        lastT = null;
      });
      restNameplate();
    }
  }

  window.SignalLamps = {
    feedStages: feedStages,
    feedScope: feedScope,
    onArrowsRendered: onArrowsRendered,
    setEngineState: setEngineState,
    restNameplate: restNameplate
  };

  // The wordmark is the one surface here that must render with no engine,
  // no feed, and no producer at all, so it starts itself. Everything is
  // guarded: a document without readyState or addEventListener (the test
  // harness) simply paints once and never re-measures, and a document
  // with no matrix canvas does nothing at all.
  try {
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading' &&
          typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', restNameplate);
      } else {
        restNameplate();
      }
      if (typeof window !== 'undefined' &&
          typeof window.addEventListener === 'function') {
        // The cell grid is sized in whole pixels off the CSS box, and the
        // box changes at the 900px breakpoint.
        window.addEventListener('resize', restNameplate);
      }
    }
  } catch (err) {
    // A nameplate that cannot start is a nameplate that stays text.
  }
})();
