// tests/test-live-signal-surface.js — the 2026-09-02 overdrive round:
// the instrument carries your voice. Two modules, one contract each.
//
//   A. WIRING CONTRACTS (static): the two scripts load in dependency
//      order; main.js drives the lifecycle beside MeterTaps at every
//      hook; ChainEditing's one acceptance choke point reaches the
//      taps; canvas.js pings the lamps' cache invalidation; and the
//      no-agent-surface rule holds (mcp-tools.js contains ZERO
//      references — the meter-taps rule, inherited verbatim).
//
//   B. STAGE TAPS (behavioral): pass-through analysers per audible
//      chain position, re-wired after accepted edits, self-healing
//      against committed-model drift; honesty gates feed DARK while
//      emergency Bypass is engaged or the watchdog mute is latched;
//      the scope feed reads the final output ungated; stop unwires and
//      rests the lamps; nothing throws into a missing consumer.
//
//   C. SIGNAL LAMPS (behavioral): chevrons paint the VU meters' own
//      zone language with luminance-follows-level, fall to rest on
//      silence, re-query their DOM cache when the board rebuilds, and
//      never throw into the producer's frame loop (one-strike); the
//      scope mounts once, before #simple-summary, and paints min/max
//      envelope columns with clip-zone tips.
//
// Same committed convention as every other file here: plain `node`, zero
// dependencies, browser globals stubbed, the REAL src/*.js loaded into a
// vm sandbox, one "  ok - " / "  FAIL - " line per check, exit 1 on any
// failure. Picked up automatically by tests/run.js.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures++;
    console.log('  FAIL - ' + label);
  }
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
const mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
const chainSrc = fs.readFileSync(path.join(ROOT, 'src/chain-editing.js'), 'utf8');
const canvasSrc = fs.readFileSync(path.join(ROOT, 'src/canvas.js'), 'utf8');
const mcpSrc = fs.readFileSync(path.join(ROOT, 'src/mcp-tools.js'), 'utf8');
const tapsSrc = fs.readFileSync(path.join(ROOT, 'src/stage-taps.js'), 'utf8');
const lampsSrc = fs.readFileSync(path.join(ROOT, 'src/signal-lamps.js'), 'utf8');

// =====================================================================
// A. Wiring contracts (static).
// =====================================================================
(function sectionA() {
  console.log('A. wiring contracts');

  const tag = function (src) { return '<script src="' + src + '"></script>'; };
  const iLamps = html.indexOf(tag('src/signal-lamps.js'));
  const iTaps = html.indexOf(tag('src/stage-taps.js'));
  const iMeterTaps = html.indexOf(tag('src/meter-taps.js'));
  const iMain = html.indexOf(tag('src/main.js'));
  check(iMeterTaps !== -1 && iLamps !== -1 && iMeterTaps < iLamps && iLamps < iTaps && iTaps < iMain,
    'A1: lamps + taps load after meter-taps (the isTripped dependency) and before main.js');

  check((mainSrc.match(/StageTaps\.onEngineStarted\(\)/g) || []).length >= 3,
    'A2: main.js starts the taps at every MeterTaps start site');
  check((mainSrc.match(/StageTaps\.onEngineStopped\(\)/g) || []).length >= 2,
    'A2: main.js stops the taps at every MeterTaps stop site');
  check(/StageTaps\.onDeviceSwitched\(/.test(mainSrc),
    'A2: main.js re-taps the mic source on device switch');

  check(/window\.StageTaps[^.]*\.onChainChanged[\s\S]{0,80}markAcceptedEdit|markAcceptedEdit[\s\S]{0,600}window\.StageTaps && typeof window\.StageTaps\.onChainChanged === 'function'/.test(chainSrc) ||
    chainSrc.indexOf('StageTaps.onChainChanged') > chainSrc.indexOf('SimpleView.onChainChanged') &&
    chainSrc.indexOf('SimpleView.onChainChanged') !== -1,
    'A3: ChainEditing pings StageTaps.onChainChanged at its acceptance choke point');

  check(canvasSrc.indexOf('SignalLamps.onArrowsRendered') > canvasSrc.indexOf('function renderChainArrows'),
    'A4: renderChainArrows invalidates the lamps\' chevron cache');

  const mcpRefs = (mcpSrc.match(/StageTaps|SignalLamps/g) || []).length;
  check(mcpRefs === 0,
    'A5: mcp-tools.js has ZERO references to the live-signal surface (no agent tool can reach it)');
  check(!/localStorage\s*\.\s*(get|set|remove|clear)Item/.test(tapsSrc) &&
    !/localStorage\s*\.\s*(get|set|remove|clear)Item/.test(lampsSrc) &&
    !/\blocalStorage\b\s*=/.test(tapsSrc) && !/\blocalStorage\b\s*=/.test(lampsSrc),
    'A5: neither module touches the localStorage API (comments may say the word; code must not use it)');

  const scopeRule = css.match(/\.simple-scope \{[^}]*\}/);
  check(!!scopeRule, 'A6: the scope slot rule exists');
  if (scopeRule) {
    check(/var\(--pm-register-bg\)/.test(scopeRule[0]),
      'A6: the scope borrows the register\'s inset ground');
    check(!/var\(--pm-accent\)/.test(scopeRule[0]),
      'A6: the scope does NOT borrow the register\'s system-state orange (One Orange Rule)');
    check(/height: 4\.5rem/.test(scopeRule[0]),
      'A6: fixed height — the scope never pumps layout');
  }
  check(/\.simple-stage\.stage-cold \.simple-scope \{\s*display: none;/.test(css),
    'A7: the cold face owns the stage pre-Start (scope display:none)');

  check(!/transition\s*[=:]|animation\s*[=:]|\.transition\b|\.animation\b/.test(lampsSrc),
    'A8: the lamps code never sets a transition or animation (functional metering only; comments may name the ban)');
})();

// =====================================================================
// Shared fake-DOM / fake-audio helpers.
// =====================================================================

/** A fake AudioNode: records outgoing edges, honors targeted disconnect. */
function fakeNode(name) {
  const edges = [];
  return {
    _name: name,
    _edges: edges,
    connect: function (target) { edges.push(target); return target; },
    disconnect: function (target) {
      if (!target) { edges.length = 0; return; }
      const i = edges.indexOf(target);
      if (i !== -1) edges.splice(i, 1);
    },
  };
}

function sandboxBase() {
  const rafQueue = [];
  const pending = new Map();
  let rafId = 0;
  const sandbox = {
    console: {
      log: function () {},
      warn: function (msg) { (sandbox._warns = sandbox._warns || []).push(String(msg)); },
      error: function (msg) { (sandbox._errors = sandbox._errors || []).push(String(msg)); },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    // rAF with REAL cancel semantics — the module under test relies on
    // cancelAnimationFrame actually withdrawing a pending callback.
    requestAnimationFrame: function (fn) {
      rafId += 1;
      pending.set(rafId, fn);
      return rafId;
    },
    cancelAnimationFrame: function (id) { pending.delete(id); },
    performance: { now: function () { return sandbox._nowMs; } },
    _nowMs: 0,
    _rafQueue: rafQueue,
    _pendingFrames: pending,
  };
  sandbox.window = sandbox;
  return sandbox;
}

/** Pump one animation frame through the pending set (a frame re-registers). */
function pumpFrame(sandbox, dtMs) {
  sandbox._nowMs += dtMs === undefined ? 16 : dtMs;
  const fns = Array.from(sandbox._pendingFrames.values());
  sandbox._pendingFrames.clear();
  fns.forEach(function (fn) { fn(sandbox._nowMs); });
}

function loadInSandbox(sandbox, src, filename) {
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: filename });
}

// =====================================================================
// B. StageTaps — behavioral.
// =====================================================================
async function sectionB() {
  console.log('B. stage taps');

  const s = sandboxBase();

  // The fake audio world.
  const analysers = [];
  const attenuator = fakeNode('attenuator');
  function makeAnalyser() {
    const a = {
      fftSize: 0,
      fill: null, // test-set: fn(buf) writing the window
      getFloatTimeDomainData: function (buf) {
        for (let i = 0; i < buf.length; i++) buf[i] = 0;
        if (a.fill) a.fill(buf);
      },
    };
    analysers.push(a);
    return a;
  }
  const context = { createAnalyser: makeAnalyser, sampleRate: 48000 };
  s.window.AudioEngine = { audioContext: context, sourceNode: fakeNode('source') };

  let model = [];
  const instances = {};
  s.window.AudioGraph = {
    getModel: function () { return model.map(function (e) { return Object.assign({}, e); }); },
    getNodeInstance: function (id) { return instances[id] || null; },
    getOutputAttenuator: function () { return attenuator; },
  };

  let bypassOn = false;
  s.window.AudioBypass = { isEngaged: function () { return bypassOn; } };
  let watchdogTripped = false;
  s.window.MeterTaps = { isTripped: function () { return watchdogTripped; } };

  const feeds = { stages: [], scopes: [], engineStates: [] };
  s.window.SignalLamps = {
    feedStages: function (levels) { feeds.stages.push(levels.slice()); },
    feedScope: function (pairs, columns, peakDb) { feeds.scopes.push({ columns: columns, len: pairs.length, peakDb: peakDb }); },
    setEngineState: function (on) { feeds.engineStates.push(on); },
  };

  loadInSandbox(s, tapsSrc, 'src/stage-taps.js');
  const Taps = s.window.StageTaps;
  check(!!Taps && typeof Taps.onEngineStarted === 'function', 'B1: exports the lifecycle hooks');

  // A committed three-node model with the middle one locally bypassed.
  const nA = fakeNode('A-out'); nA.output = fakeNode('A-real-out');
  const nC = fakeNode('C-out');
  instances.a = nA; instances.b = fakeNode('B'); instances.c = nC;
  model = [
    { id: 'a', type: 'gain', params: {} },
    { id: 'b', type: 'delay', params: {}, bypassed: true },
    { id: 'c', type: 'eq', params: {} },
  ];

  Taps.onEngineStarted();
  pumpFrame(s);

  // Wiring: source tap (0) + audible outputs A and C (1, 2); gaps before
  // card b and card c both read A's output (b is bypassed — no edge, no
  // tap, exactly like buildGraph's audible walk). Counted as live EDGES,
  // so the scope's own analyser (also fftSize 2048) cannot confuse it.
  const wiredCount =
    s.window.AudioEngine.sourceNode._edges.length +
    nA.output._edges.length + nC._edges.length;
  check(wiredCount === 3, 'B2: one tap per audible stage + the source (3, not 4 — bypassed b adds none)');
  check(attenuator._edges.length === 1,
    'B2: the scope analyser is tapped off the host attenuator exactly once');
  check(feeds.stages.length === 1 && feeds.stages[0].length === 2,
    'B2: one level per chain-arrow gap (2 gaps for 3 cards)');

  // A speaks at -6.02 dBFS (0.5 linear); the wiring's first tap is the
  // SOURCE, the second is A's real output (the composite's .output).
  const bySrc = {};
  check(nA._edges.length === 0 && nA.output._edges.length === 1,
    'B2: a composite instance taps its real OUTPUT node, never the composite');
  bySrc[1] = nA.output._edges[0];
  bySrc[0] = s.window.AudioEngine.sourceNode._edges[0];
  bySrc[1].fill = function (buf) { for (let i = 0; i < buf.length; i++) buf[i] = 0.5; };
  pumpFrame(s);
  check(feeds.stages.length === 2 &&
    Math.abs(feeds.stages[1][0] - (-6.02)) < 0.1 &&
    Math.abs(feeds.stages[1][1] - (-6.02)) < 0.1,
    'B3: both gaps read the level actually flowing there (0.5 linear ≈ -6 dBFS)');

  // Honesty gate 1: emergency Bypass engaged — the chain is NOT what the
  // room hears, so the lamps go dark even though the signal keeps
  // flowing inside the chain.
  bypassOn = true;
  pumpFrame(s);
  check(feeds.stages.length === 3 && feeds.stages[2][0] === null && feeds.stages[2][1] === null,
    'B4: engaged Bypass feeds DARK (nulls) — the dry room never sees these stages');
  bypassOn = false;

  // Honesty gate 2: the watchdog mute latch.
  watchdogTripped = true;
  pumpFrame(s);
  check(feeds.stages.length === 4 && feeds.stages[3][0] === null && feeds.stages[3][1] === null,
    'B4: a latched watchdog mute feeds DARK too');
  watchdogTripped = false;

  // Silence crosses the contract as null, never -Infinity.
  bySrc[1].fill = null;
  pumpFrame(s);
  check(feeds.stages.length === 5 && feeds.stages[4][0] === null && feeds.stages[4][1] === null,
    'B5: digital silence is null at the contract (lamps rest, they do not parse -Infinity)');

  // The scope feed: ungated, honest, 136 columns of min/max pairs.
  check(feeds.scopes.length === 5,
    'B6: the scope is fed EVERY frame (silence included — a flat trace is the truth)');
  const sc = feeds.scopes[4];
  check(sc.columns === 136 && sc.len === 272,
    'B6: the envelope is decimated to 136 draw columns (272 min/max pairs)');
  check(sc.peakDb === null || sc.peakDb === -Infinity || typeof sc.peakDb === 'number',
    'B6: the window peak rides along for the lamps\' own decisions');

  // A structural edit re-plans the wiring (signature drift self-heal,
  // even with no onChainChanged ping).
  model = [
    { id: 'a', type: 'gain', params: {} },
    { id: 'c', type: 'eq', params: {} },
  ];
  pumpFrame(s); // notices drift, schedules the debounced rewire
  await sleep(60);
  pumpFrame(s);
  const activeTaps = [s.window.AudioEngine.sourceNode, nA.output, nC].reduce(function (n, src) {
    return n + src._edges.length;
  }, 0);
  check(activeTaps === 3 && feeds.stages[feeds.stages.length - 1].length === 1,
    'B7: a committed model change re-wires (source + 2 audibles) and re-maps the gaps');

  // The ChainEditing ping path is the same rewire, debounced.
  Taps.onChainChanged();
  await sleep(10);
  check(true, 'B7: onChainChanged returns without throwing');

  // Device switch: only the source tap re-follows.
  const oldSource = s.window.AudioEngine.sourceNode;
  s.window.AudioEngine.sourceNode = fakeNode('source2');
  Taps.onDeviceSwitched(s.window.AudioEngine.sourceNode);
  check(oldSource._edges.length === 0 && s.window.AudioEngine.sourceNode._edges.length === 1,
    'B8: a device switch moves the mic tap to the new source alone');

  // Stop: loop halts, lamps rested, taps unwired.
  Taps.onEngineStopped();
  check(feeds.engineStates.length === 1 && feeds.engineStates[0] === false,
    'B9: stop rests the lamps exactly once');
  const framesBefore = feeds.stages.length;
  pumpFrame(s);
  pumpFrame(s);
  check(feeds.stages.length === framesBefore,
    'B9: the loop is dead after stop (no more feeds)');

  // A missing consumer must never break the loop.
  const s2 = sandboxBase();
  const attenuator2 = fakeNode('att2');
  const analysers2 = [];
  s2.window.AudioEngine = {
    audioContext: { createAnalyser: function () { const a = { fftSize: 0, getFloatTimeDomainData: function (b) { for (let i = 0; i < b.length; i++) b[i] = 0; } }; analysers2.push(a); return a; } },
    sourceNode: fakeNode('src2'),
  };
  s2.window.AudioGraph = {
    getModel: function () { return [{ id: 'x', type: 'gain', params: {} }]; },
    getNodeInstance: function () { return fakeNode('x'); },
    getOutputAttenuator: function () { return attenuator2; },
  };
  s2.window.AudioBypass = { isEngaged: function () { return false; } };
  s2.window.MeterTaps = { isTripped: function () { return false; } };
  // NOTE: no window.SignalLamps at all.
  loadInSandbox(s2, tapsSrc, 'src/stage-taps.js');
  s2.window.StageTaps.onEngineStarted();
  let threw = false;
  try {
    pumpFrame(s2);
    pumpFrame(s2);
  } catch (err) {
    threw = true;
  }
  check(!threw && (s2._errors || []).length === 0,
    'B10: frames with no lamps consumer run clean (guarded feed, loop intact)');

  // Restart after stop works (a second engine start re-wires).
  Taps.onEngineStarted();
  pumpFrame(s);
  check(feeds.stages.length > framesBefore,
    'B10: a restart revives the feeds');
  Taps.onEngineStopped();
}

// =====================================================================
// C. SignalLamps — behavioral.
// =====================================================================
function sectionC() {
  console.log('C. signal lamps');

  const s = sandboxBase();

  // Fake marks with real-enough style objects.
  function makeMark() {
    const style = {};
    // Real DOM behavior: removeProperty('border-color') clears the
    // camelCase borderColor too — the fake must agree or "rest" checks
    // lie about the module.
    style.removeProperty = function (k) {
      delete style[k];
      delete style[k.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); })];
    };
    return { className: 'chain-arrow-mark', style: style };
  }
  let marks = [makeMark(), makeMark(), makeMark()];
  let queryCount = 0;

  // Fake scope mount targets.
  const summary = { id: 'simple-summary', parentNode: null };
  const inserted = [];
  const inner = {
    insertBefore: function (el, ref) { inserted.push({ el: el, ref: ref }); summary.parentNode = inner; },
    appendChild: function (el) { inserted.push({ el: el, ref: null }); },
  };
  summary.parentNode = inner;

  // Fake canvas recording draws.
  const draws = { rects: [], clears: 0, resized: 0 };
  const ctx = {
    fillStyle: '', globalAlpha: 1, lineWidth: 1,
    setTransform: function () { draws.resized++; },
    clearRect: function () { draws.clears++; },
    beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, stroke: function () {},
    fillRect: function (x, y, w, h) { draws.rects.push({ x: x, y: y, w: w, h: h, fill: ctx.fillStyle, alpha: ctx.globalAlpha }); },
  };
  const canvas = {
    className: '', clientWidth: 600, clientHeight: 72, width: 0, height: 0,
    getContext: function () { return ctx; },
  };

  s.document = {
    querySelectorAll: function (sel) {
      queryCount++;
      return sel === '#chain-list .chain-arrow-mark' ? marks.slice() : [];
    },
    querySelector: function (sel) {
      return sel === '.simple-stage-inner' ? inner : null;
    },
    getElementById: function (id) {
      return id === 'simple-summary' ? summary : null;
    },
    createElement: function (tag) {
      if (tag === 'canvas') return canvas;
      return { className: '', children: [], _aria: {}, appendChild: function (c) { this.children.push(c); }, setAttribute: function (k, v) { this._aria[k] = v; } };
    },
    documentElement: {},
  };
  s.getComputedStyle = function () {
    return {
      getPropertyValue: function (name) {
        const map = {
          '--pm-vu-low': '#4ea96b', '--pm-vu-mid': '#ffd75e', '--pm-vu-clip': '#e4574a',
          '--pm-vu-tick': '#c9cedc', '--pm-display': '#ffd75e', '--pm-vu-unlit': '#262933',
        };
        return map[name] || '';
      },
    };
  };

  loadInSandbox(s, lampsSrc, 'src/signal-lamps.js');
  const Lamps = s.window.SignalLamps;
  check(!!Lamps, 'C1: exports the feed contract');

  // Zone language: the meters' exact edges.
  Lamps.feedStages([-30, -10, -5]);
  check(marks[0].style.borderColor === '#4ea96b', 'C1: -30 dB paints the green zone');
  check(marks[1].style.borderColor === '#ffd75e', 'C1: -10 dB paints the amber zone');
  check(marks[2].style.borderColor === '#e4574a', 'C1: -5 dB paints the clip zone');
  check(marks.every(function (m) { return typeof m.style.opacity === 'string'; }),
    'C1: luminance follows level (opacity set on every lit mark)');

  // Monotonic luminance.
  const op = function (m) { return parseFloat(m.style.opacity); };
  check(op(marks[0]) < op(marks[1]) && op(marks[1]) < op(marks[2]),
    'C2: louder is brighter, monotonically');
  check(op(marks[0]) >= 0.45 && op(marks[2]) <= 1,
    'C2: the luminance band is 0.45..1');

  // Silence falls to rest (the 24 dB/s lamp fall).
  for (let f = 0; f < 50; f++) {
    Lamps.feedStages([null, null, null]);
    s._nowMs += 50; // 50ms per fed frame — 50 frames ≫ the -60 dB floor
  }
  check(marks.every(function (m) { return m.style.borderColor === undefined; }),
    'C3: sustained silence rests every mark to the stylesheet ink');

  // Bright again, then a cache rebuild: the DOM changed under us.
  Lamps.feedStages([-12, -12, -12]);
  marks = [makeMark(), makeMark(), makeMark(), makeMark()]; // a 4th card appeared
  const before = queryCount;
  Lamps.feedStages([-12, -12, -12, -12]);
  check(queryCount > before && marks.every(function (m) { return m.style.borderColor === '#ffd75e'; }),
    'C4: a changed DOM re-queries and paints the new gap set');

  Lamps.onArrowsRendered();
  marks = [makeMark(), makeMark()];
  Lamps.feedStages([-8, -8]);
  check(marks[0].style.borderColor === '#ffd75e',
    'C4: onArrowsRendered drops the cache so the next feed re-queries');

  // Engine off rests everything at once.
  Lamps.feedStages([-3, -3]);
  Lamps.setEngineState(false);
  check(marks.every(function (m) { return m.style.borderColor === undefined; }),
    'C5: setEngineState(false) rests every lamp in one call');

  // The scope: mounts once, before #simple-summary, and paints.
  const pairs = new Float32Array(272);
  for (let c = 0; c < 136; c++) {
    const v = c === 10 ? 0.995 : 0.2; // one column into the clip zone
    pairs[c * 2] = -v * 0.8;
    pairs[c * 2 + 1] = v;
  }
  Lamps.feedScope(pairs, 136, -0.04);
  Lamps.feedScope(pairs, 136, -0.04);
  check(inserted.length === 1 && inserted[0].ref === summary,
    'C6: the scope mounts ONCE, directly before #simple-summary');
  check(inserted[0].el.children[0] === canvas && inserted[0].el._aria['aria-hidden'] === 'true',
    'C6: the slot is aria-hidden and carries the canvas');
  check(draws.clears === 2 && draws.rects.length === 2 * (136 + 1),
    'C6: every frame clears and paints all 136 columns (the one clip column paints body + tip)');
  const clipTips = draws.rects.filter(function (r) { return r.fill === '#e4574a'; });
  check(clipTips.length === 2,
    'C6: only the clip-zone column tips paint the VU clip color');
  check(draws.rects.some(function (r) { return r.fill === '#ffd75e'; }),
    'C6: the working columns paint display amber');

  // Off-screen (Simple hidden / cold face): no paint, no resize churn.
  canvas.clientWidth = 0;
  canvas.clientHeight = 0;
  const clearsBefore = draws.clears;
  Lamps.feedScope(pairs, 136, -1);
  check(draws.clears === clearsBefore,
    'C7: a hidden scope skips the paint entirely');

  // Polish round (2026-09-02): on a fractional device pixel ratio the
  // columns snap to the device grid — x*2 lands on integers at dpr 2, so
  // a Retina trace paints crisp 2-device-px strokes, not soft ones.
  // (Runs BEFORE the one-strike check below: that check deliberately
  // disables the module, and a disabled module paints nothing.)
  s.devicePixelRatio = 2; // the sandbox IS window; the dpr read follows it
  canvas.clientWidth = 601; // prime width — nothing snaps by accident
  canvas.clientHeight = 72;
  draws.rects.length = 0;
  Lamps.feedScope(pairs, 136, -1);
  const unsnapped = draws.rects.filter(function (r) {
    return Math.round(r.x * 2) !== r.x * 2;
  });
  check(draws.rects.length === 136 + 1 && unsnapped.length === 0,
    'C9: every scope column snaps to the device-pixel grid at dpr 2 (the clip column\'s tip included)');

  // One-strike: a throwing style disables the module; the producer's
  // call must never see the throw.
  const bad = makeMark();
  Object.defineProperty(bad.style, 'borderColor', {
    set: function () { throw new Error('style refused'); },
    get: function () { return ''; },
  });
  marks = [bad];
  Lamps.onArrowsRendered();
  let sawThrow = false;
  try {
    Lamps.feedStages([-10]);
  } catch (err) {
    sawThrow = true;
  }
  check(!sawThrow && (s._errors || []).length === 1,
    'C8: a paint failure is swallowed, logged once, and the module disables (one-strike)');
}

(async function main() {
  await sectionB();
  sectionC();
  if (failures === 0) {
    console.log('live-signal-surface: all checks passed');
  } else {
    console.log('live-signal-surface: ' + failures + ' failure(s)');
    process.exit(1);
  }
})().catch(function (err) {
  console.error('live-signal-surface: harness crashed', err);
  process.exit(1);
});
