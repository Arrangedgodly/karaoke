// tests/test-power-up-and-cold-face.js — the 2026-09-02 delight round.
//
// Three things landed together, and each one carries a contract that a
// later change could quietly break:
//
//   A. THE MACHINED GUTTER + Simple's content padding. One scrollbar
//      vocabulary for every scroller inside the chassis, and Simple's
//      Sounds body reading with Advanced's own padding instead of being
//      eaten by the scrollbar track.
//
//   B. THE COLD FACE. What Simple's stage prints before Start, built
//      only from reads (the chain Start will commit, a structural match
//      against the factory library, that preset's own description, the
//      library the Sounds panel is listing) — and gone the moment the
//      engine is live.
//
//   C. THE POWER-UP. The meters' lamp test and the gated face's wake,
//      the one sequence DESIGN.md permits past the 150-250 ms answer
//      law. The lamp test is a DISPLAY flourish on a live-audio safety
//      surface, so its honesty rules are the checks that matter most:
//      it may only ADD light, it may never touch a reported number, and
//      it may never latch a clip.
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

const css = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// =====================================================================
// A. The machined gutter, and Simple's padding parity with Advanced.
// =====================================================================
(function sectionA() {
  console.log('A. the machined gutter + Simple/Advanced padding parity');

  // The gutter is described ONCE. Every chassis scroller joins that one
  // selector list; a second copy is exactly the drift this replaced.
  const SCROLLERS = [
    '.presets-panel-content',
    '.effects-panel-content',
    '.simple-library-body',
    '.simple-stage',
    '.canvas',
  ];
  const firefoxRule = css.match(/([^}]*)\{\s*scrollbar-width: thin;\s*scrollbar-color: var\(--pm-key-edge\) transparent;/);
  check(!!firefoxRule, 'A1: one rule declares the Firefox gutter (scrollbar-width + scrollbar-color)');
  if (firefoxRule) {
    SCROLLERS.forEach(function (sel) {
      check(firefoxRule[1].indexOf(sel) !== -1,
        'A1: ' + sel + ' takes the shared Firefox gutter');
    });
  }

  SCROLLERS.forEach(function (sel) {
    const esc = sel.replace('.', '\\.');
    check(new RegExp(esc + '::-webkit-scrollbar-thumb[,\\s]').test(css),
      'A2: ' + sel + ' takes the shared WebKit thumb');
  });

  check(/--pm-key-edge\);\s*border-radius: 6px;\s*border: 2px solid transparent;\s*background-clip: padding-box;/.test(css),
    'A2: the thumb stays the slim floating pill (key-edge, inset by its own border)');
  check(/::-webkit-scrollbar-corner,[\s\S]{0,120}background: transparent;/.test(css),
    'A3: the board corner where two bars meet stays chassis, not a platform square');

  // Simple's Sounds body reads with Advanced's own content padding — the
  // whole point of the round, and the narrow-deck override that used to
  // make them diverge is gone.
  const padRule = css.match(/\.presets-panel-content,\s*\n\.effects-panel-content,\s*\n\.simple-library-body \{[^}]*padding-right: 0\.9rem;/);
  check(!!padRule, 'A4: .simple-library-body shares Advanced’s 0.9rem content padding');
  check(css.indexOf('padding-right: 0.25rem') === -1,
    'A4: no narrow-deck override re-splits Simple from Advanced');
})();

// =====================================================================
// B. The gated print rule — a gated surface may not be touched, but it
//    must still be readable.
// =====================================================================
(function sectionB() {
  console.log('B. the gated print tier');

  check(/--pm-print-gated:\s*#dde2ee;/.test(css),
    'B1: --pm-print-gated joins the measured --pm-* register');

  const rule = css.match(/([^{}]*)\{\s*color: var\(--pm-print-gated\);/);
  check(!!rule, 'B2: one rule applies the gated tier');
  if (rule) {
    [
      '.layout.engine-not-started .empty-hint',
      '.simple-stage.engine-not-started .simple-cs-name',
      '.simple-stage.engine-not-started .cold-face-line',
      '.simple-stage.engine-not-started .cold-face-desc',
      '.simple-stage.engine-not-started .cold-face-legend',
      '.simple-stage.engine-not-started .cold-face-label',
      '.simple-stage.engine-not-started .cold-face-anchor-legend',
    ].forEach(function (sel) {
      check(rule[1].indexOf(sel) !== -1, 'B2: ' + sel + ' takes the gated tier');
    });
  }

  // The tier is scoped to the gate and nowhere else: off the recede it
  // would outshine the ladder's top rung.
  const uses = css.split('var(--pm-print-gated)').length - 1;
  const gatedScoped = (css.match(/engine-not-started[^{}]*\{[^}]*--pm-print-gated/g) || []).length;
  check(uses > 0 && gatedScoped >= 1,
    'B3: every use of the gated tier sits under an .engine-not-started selector');
  check(!/\.cold-face-line\s*\{[^}]*--pm-print-gated/.test(css),
    'B3: the un-gated cold-face rules do NOT use it');

  // The gate itself is UNCHANGED. The exception must never quietly
  // widen into "the pre-Start recede got softer".
  check(/\.simple-stage\.engine-not-started \{[^}]*opacity: 0\.55/.test(css),
    'B4: Simple’s gate still recedes to exactly 0.55');
  check(/\.layout\.engine-not-started \.canvas \{[^}]*opacity: 0\.55/.test(css),
    'B4: Advanced’s gate still recedes to exactly 0.55');
  check(/\.simple-stage\.engine-not-started::before \{[^}]*repeating-linear-gradient\(\s*\n?\s*-45deg/.test(css),
    'B4: Simple’s gate still paints the -45deg hatch');
})();

// =====================================================================
// C. The power-up's surface half — the wake.
// =====================================================================
(function sectionC() {
  console.log('C. the wake (the power-up’s surface half)');

  const reducedBlocks = css.match(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g) || [];
  const wakeBlock = reducedBlocks.filter(function (b) {
    return b.indexOf('gate-wake-lift') !== -1;
  })[0];
  check(!!wakeBlock,
    'C1: the wake lives INSIDE prefers-reduced-motion: no-preference');
  if (wakeBlock) {
    check(wakeBlock.indexOf('@keyframes gate-wake-lift') !== -1 &&
      wakeBlock.indexOf('@keyframes gate-wake-wipe') !== -1,
      'C1: both keyframes are inside it too — under reduce they do not exist at all');
    check(/\.simple-stage\.stage-waking,\s*\n\s*\.canvas\.face-waking \{/.test(wakeBlock),
      'C2: both gated surfaces share one wake, so the two views cannot drift');
    check(/clip-path: inset\(0 0 0 0\)[\s\S]*clip-path: inset\(0 0 0 100%\)/.test(wakeBlock),
      'C3: the hatch peels off toward OUT (clipped away from the left)');
    check(/animation: gate-wake-lift 420ms/.test(wakeBlock),
      'C4: the wake is 420ms — the Power-Up Exception’s recorded budget');
  }

  // The wake class is applied AFTER the gate comes off, never instead of
  // it: the surface is interactive for every frame of the animation.
  const simpleSrc = fs.readFileSync(path.join(ROOT, 'src/simple-view.js'), 'utf8');
  const canvasSrc = fs.readFileSync(path.join(ROOT, 'src/canvas.js'), 'utf8');
  check(simpleSrc.indexOf("stageEl.classList.toggle('engine-not-started', !engineLive)") <
    simpleSrc.indexOf("wakeSurface(stageEl, 'stage-waking')"),
    'C5: Simple drops the gate before it plays the wake');
  check(canvasSrc.indexOf("layoutEl.classList.remove('engine-not-started')") <
    canvasSrc.indexOf("boardEl.classList.add('face-waking')"),
    'C5: Advanced drops the gate before it plays the wake');
  check(/setTimeout\(unwake, 700\)/.test(canvasSrc) && /setTimeout\(done, 700\)/.test(simpleSrc),
    'C6: both wakes carry a timer belt, so a view that never animates cannot keep the class');

  // DESIGN.md must actually carry the exception this round spent.
  const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  check(design.indexOf('The Power-Up Exception') !== -1,
    'C7: DESIGN.md records the Power-Up Exception rather than the law quietly widening');
  check(design.indexOf('The Gated Print Rule') !== -1,
    'C7: DESIGN.md records the Gated Print Rule');
})();

// =====================================================================
// D. The cold face — index.html contract + what simple-view.js builds.
// =====================================================================
function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    attributes: {},
    listeners: {},
    style: {},
    className: '',
    textContent: '',
    hidden: false,
    disabled: false,
    _innerHTML: '',
  };
  el.classList = {
    _set: [],
    add: function () {
      Array.prototype.forEach.call(arguments, function (c) {
        if (el.classList._set.indexOf(c) === -1) el.classList._set.push(c);
      });
    },
    remove: function () {
      Array.prototype.forEach.call(arguments, function (c) {
        const i = el.classList._set.indexOf(c);
        if (i !== -1) el.classList._set.splice(i, 1);
      });
    },
    contains: function (c) { return el.classList._set.indexOf(c) !== -1; },
    toggle: function (c, on) { if (on) el.classList.add(c); else el.classList.remove(c); },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return el._innerHTML; },
    set: function (v) { el._innerHTML = v; if (v === '') el.children = []; },
  });
  el.appendChild = function (child) { el.children.push(child); return child; };
  el.setAttribute = function (k, v) { el.attributes[k] = String(v); };
  el.getAttribute = function (k) {
    return Object.prototype.hasOwnProperty.call(el.attributes, k) ? el.attributes[k] : null;
  };
  el.addEventListener = function (evt, fn) {
    (el.listeners[evt] = el.listeners[evt] || []).push(fn);
  };
  el.removeEventListener = function () {};
  el.querySelectorAll = function () { return []; };
  el.focus = function () {};
  el.fire = function (evt) { (el.listeners[evt] || []).forEach(function (fn) { fn({ preventDefault: function () {} }); }); };
  return el;
}

/** Every text node this subtree would render, flattened. */
function textOf(el) {
  if (!el) return '';
  if (el.nodeType === 3) return String(el.textContent);
  let out = String(el.textContent || '');
  (el.children || []).forEach(function (c) { out += textOf(c); });
  return out;
}

function findByClass(el, cls, out) {
  out = out || [];
  if (!el || !el.children) return out;
  el.children.forEach(function (c) {
    if (c.className === cls || String(c.className).split(' ').indexOf(cls) !== -1) out.push(c);
    findByClass(c, cls, out);
  });
  return out;
}

function makeSimpleSandbox(opts) {
  opts = opts || {};
  const registry = {};
  const ids = ['view-switch-simple', 'view-switch-advanced', 'simple-cs-name', 'simple-desc',
    'simple-summary', 'simple-library-body', 'simple-library-gate-note', 'simple-transport',
    'simple-save-btn', 'simple-save-row', 'simple-stage', 'simple-cold-face'];
  ids.forEach(function (id) {
    registry[id] = makeElement(id === 'simple-summary' ? 'ol' : 'div');
  });
  registry['simple-stage'].classList.add('engine-not-started');

  const sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    document: {
      createElement: makeElement,
      createTextNode: function (t) { return { nodeType: 3, textContent: String(t), children: [] }; },
      getElementById: function (id) {
        return Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null;
      },
      body: makeElement('body'),
    },
  };
  sandbox.window = sandbox;
  sandbox.setTimeout = function () { return 0; };
  sandbox.localStorage = {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {},
  };
  sandbox.AudioEngine = opts.live
    ? { isStarted: true, isTrackLive: true, audioContext: { state: 'running' } }
    : { isStarted: false, isTrackLive: true, audioContext: null };
  sandbox.Persistence = {
    loadInitialModel: function () {
      return (opts.chain || []).map(function (n) {
        return { id: n.id, type: n.type, params: Object.assign({}, n.params) };
      });
    },
  };
  sandbox.FactoryPresets = {
    list: function () { return opts.library || []; },
    listDetailed: function () { return (opts.library || []).map(function (p) { return { name: p.name }; }); },
    describeAll: function () { return opts.described || []; },
  };
  sandbox.PresetStore = { listNames: function () { return opts.userPresets || []; } };
  sandbox.EffectCatalog = {
    getLabel: function (t) { return ({ gain: 'Gain', compressor: 'Compressor', eq: 'EQ', limiter: 'Limiter' })[t] || t; },
    getPlainLabel: function (t) { return t; },
  };
  sandbox.AudioGraph = { getModel: function () { return opts.chain || []; } };
  sandbox.PresetsUI = { getDisplayState: function () { return { name: null, modified: false }; } };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/simple-view.js'), 'utf8'), sandbox, {
    filename: 'src/simple-view.js',
  });
  return { window: sandbox, els: registry };
}

(function sectionD() {
  console.log('D. the cold face');

  // The mount point ships in the markup, empty — so the first paint is a
  // cold face or nothing, never a flash of placeholder.
  check(/<div class="simple-cold-face" id="simple-cold-face" hidden><\/div>/.test(html),
    'D1: #simple-cold-face ships present and hidden in index.html');

  const CK = [
    { id: 'n1', type: 'gain', params: { gainDb: 0 } },
    { id: 'n2', type: 'compressor', params: { threshold: -16, ratio: 4 } },
    { id: 'n3', type: 'eq', params: { lowGain: 0 } },
    { id: 'n4', type: 'limiter', params: { ceiling: -3 } },
  ];
  const library = [{ name: 'Classic Karaoke', nodes: CK.map(function (n) {
    return { id: n.id, type: n.type, params: Object.assign({}, n.params) };
  }) }];

  // --- a chain that IS a factory preset -----------------------------
  let h = makeSimpleSandbox({
    chain: CK,
    library: library,
    described: [{ name: 'Classic Karaoke', description: 'The all-purpose starting point.' }],
  });
  let face = h.els['simple-cold-face'];
  check(face.hidden === false, 'D2: the cold face shows before Start');
  check(textOf(face).indexOf('Classic Karaoke is loaded and waiting') !== -1,
    'D2: a chain that structurally matches a factory preset is named');
  check(textOf(face).indexOf('The all-purpose starting point.') !== -1,
    'D2: it borrows that preset’s OWN description, never writing one');
  check(textOf(face).indexOf('pick any of the 1 sounds') !== -1,
    'D2: the count is the library the Sounds panel is listing');

  const plates = findByClass(face, 'cold-face-plate');
  check(plates.length === CK.length,
    'D3: one plate per section (' + plates.length + ' of ' + CK.length + ')');
  check(textOf(plates[1]).indexOf('COM') !== -1 && textOf(plates[1]).indexOf('Compressor') !== -1,
    'D3: a plate carries the 3-letter code AND the module label');
  check(String(plates[0].getAttribute('style')).indexOf('--famPrint:var(--pm-family-gain)') !== -1,
    'D3: a plate carries its family ink through the shared familyVars()');

  const strip = findByClass(face, 'cold-face-strip')[0];
  check(!!strip && strip.getAttribute('aria-hidden') === 'true',
    'D4: the strip is aria-hidden — a redundant picture of the sentence above it');
  const legend = findByClass(face, 'cold-face-legend')[0];
  check(!!legend && textOf(legend).indexOf('4 sections') !== -1,
    'D4: the legend carries the same fact as text for a screen reader');
  const anchors = findByClass(face, 'cold-face-anchor-legend');
  check(anchors.length === 2 && textOf(anchors[0]) === 'Mic in' && textOf(anchors[1]) === 'Out',
    'D4: both panel termini are printed');

  // --- a chain that matches nothing ---------------------------------
  h = makeSimpleSandbox({
    chain: [{ id: 'n1', type: 'gain', params: { gainDb: 3 } }],
    library: library,
  });
  face = h.els['simple-cold-face'];
  check(textOf(face).indexOf('Your last chain is loaded and waiting') !== -1,
    'D5: a chain that matches no preset is honestly unnamed, never guessed');
  check(findByClass(face, 'cold-face-desc').length === 0,
    'D5: with no matching preset there is no description to borrow, so none is shown');

  // A one-param difference must NOT match — the whole point of matching
  // structurally rather than by shape.
  h = makeSimpleSandbox({
    chain: CK.map(function (n, i) {
      return i === 1 ? { id: n.id, type: n.type, params: { threshold: -20, ratio: 4 } } : n;
    }),
    library: library,
  });
  check(textOf(h.els['simple-cold-face']).indexOf('Your last chain') !== -1,
    'D5: one changed param is enough to stop it claiming the preset’s name');

  // --- empty chain ---------------------------------------------------
  h = makeSimpleSandbox({ chain: [], library: library });
  face = h.els['simple-cold-face'];
  check(textOf(face).indexOf('No effects are loaded yet.') !== -1,
    'D6: an empty chain says so');
  check(findByClass(face, 'cold-face-strip').length === 0,
    'D6: and prints no strip — a strip with no sections would be an empty promise');

  // --- live ----------------------------------------------------------
  h = makeSimpleSandbox({ live: true, chain: CK, library: library });
  face = h.els['simple-cold-face'];
  check(face.hidden === true && face.innerHTML === '',
    'D7: the moment the engine is live the cold face is gone, not stale');
  check(!h.els['simple-stage'].classList.contains('stage-cold'),
    'D7: the stage drops the cold composition class with it');
  check(h.els['simple-stage'].classList.contains('stage-waking'),
    'D7: and plays the wake, because it was gated a moment ago');
})();

// =====================================================================
// E. The lamp test — the power-up's meter half, and its honesty rules.
// =====================================================================
function makeMetersSandbox() {
  const ops = [];
  function makeCtx() {
    const ctx = {
      globalAlpha: 1,
      shadowBlur: 0,
      shadowColor: '',
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      setTransform: function () {},
      clearRect: function () { ops.length = 0; },
      fillRect: function (x, y, w, h) {
        ops.push({ x: x, y: y, w: w, h: h, fill: ctx.fillStyle, alpha: ctx.globalAlpha });
      },
      fillText: function () {},
    };
    return ctx;
  }

  const els = {};
  function mk(tag) {
    const el = makeElement(tag);
    el.querySelector = function () { return null; };
    el.insertBefore = function (child) { el.children.push(child); return child; };
    if (String(tag).toLowerCase() === 'canvas') {
      el.getContext = makeCtx;
    }
    return el;
  }
  const panel = mk('div');
  const board = mk('div');
  els['chain-canvas'] = board;
  els['simple-meter-in'] = mk('div');
  els['simple-meter-out'] = mk('div');

  let clock = 1000;
  const sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    performance: { now: function () { return clock; } },
    document: {
      createElement: mk,
      querySelector: function (sel) { return sel === '.canvas-panel' ? panel : null; },
      getElementById: function (id) { return els[id] || null; },
      documentElement: mk('html'),
    },
  };
  sandbox.window = sandbox;
  // No requestAnimationFrame on purpose: the shared loop never starts, so
  // every paint in this file is one this test drove deliberately.
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/meters.js'), 'utf8'), sandbox, {
    filename: 'src/meters.js',
  });
  return {
    window: sandbox,
    ops: ops,
    setClock: function (v) { clock = v; },
    advanceTo: function (v) { clock = v; },
    setReducedMotion: function (on) {
      sandbox.matchMedia = function (q) {
        return { matches: on && /prefers-reduced-motion/.test(q), media: q };
      };
    },
    /** Lamp segments the LAST paint actually lit (the peak pass: full
     *  alpha, lamp geometry, not the unlit glass). */
    litLamps: function () {
      return ops.filter(function (o) {
        return o.y === 6 && o.w === 4 && o.h === 10 && o.alpha === 1 && o.fill !== '#262933';
      }).length;
    },
    readouts: function () {
      const out = [];
      (function walk(el) {
        (el.children || []).forEach(function (c) {
          if (c.className === 'meter-readout') out.push(String(c.textContent));
          walk(c);
        });
      })(panel);
      return out;
    },
  };
}

(function sectionE() {
  console.log('E. the lamp test (the power-up’s meter half)');

  const h = makeMetersSandbox();
  h.setReducedMotion(false);
  check(typeof h.window.Meters.lampTest === 'function',
    'E1: Meters exposes lampTest()');

  // At rest, dark.
  h.window.Meters.feed('in', { peakDb: -120, rmsDb: -120, clipRun: false });
  check(h.litLamps() === 0, 'E1: nothing is lit before the test runs');

  // The sweep: up, hold at full scale, back down, gone.
  const t0 = 1000;
  h.setClock(t0);
  h.window.Meters.lampTest();
  const at = function (ms) {
    h.setClock(t0 + ms);
    h.window.Meters.feed('in', { peakDb: -120, rmsDb: -120, clipRun: false });
    return h.litLamps();
  };
  const rise1 = at(60);
  const rise2 = at(160);
  const full = at(300);
  const falling = at(500);
  const done = at(760);

  check(rise1 > 0 && rise2 > rise1, 'E2: the ladder rises (' + rise1 + ' -> ' + rise2 + ')');
  check(full === 19, 'E2: it reaches full scale — every one of the 19 segments lights');
  check(falling > 0 && falling < 19, 'E2: it releases (' + falling + ' of 19 at 500ms)');
  check(done === 0, 'E2: and is completely gone by 760ms');

  // THE HONESTY RULES.
  check(h.readouts().every(function (t) { return t === '−∞'; }),
    'E3: the dB readout stayed on the REAL feed for the whole sweep (−∞ under a full ladder)');
  check(h.readouts().every(function (t) { return t !== 'CLIP'; }),
    'E3: a full-scale sweep never latches a CLIP the machine did not hear');

  // The sweep may only ADD light. Feed a real -12 dB while the sweep has
  // already fallen below it and confirm the real level still shows.
  h.setClock(2000);
  h.window.Meters.lampTest();
  h.window.Meters.setEngineState(true);
  h.setClock(2000 + 600); // deep into the release
  h.window.Meters.feed('in', { peakDb: -12, rmsDb: -18, clipRun: false });
  const sweepTail = h.litLamps();
  h.setClock(2000 + 900); // sweep over
  h.window.Meters.feed('in', { peakDb: -12, rmsDb: -18, clipRun: false });
  const realOnly = h.litLamps();
  check(realOnly > 0 && sweepTail >= realOnly,
    'E4: the drawn ladder is max(real, sweep) — the test can add light, never hide a signal');
  check(h.readouts().indexOf('−12.0') !== -1,
    'E4: and the readout reports the real level, unchanged by the sweep');

  // Reduced motion: a state, not a motion.
  const r = makeMetersSandbox();
  r.setReducedMotion(true);
  const r0 = 1000;
  r.setClock(r0);
  r.window.Meters.lampTest();
  const rAt = function (ms) {
    r.setClock(r0 + ms);
    r.window.Meters.feed('in', { peakDb: -120, rmsDb: -120, clipRun: false });
    return r.litLamps();
  };
  const early = rAt(20);
  const mid = rAt(150);
  const after = rAt(260);
  check(early === 19 && mid === 19,
    'E5: under reduced motion the ladder is simply LIT — no rise, no ramp');
  check(after === 0, 'E5: and released after the short hold, well before the sweep would have ended');
})();

// =====================================================================
console.log('');
if (failures) {
  console.log(failures + ' check(s) FAILED');
  process.exit(1);
}
console.log('all checks ok');
