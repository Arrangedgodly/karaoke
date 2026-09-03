// tests/test-surface-polish.js — the 2026-09-02 polish round (the final
// quality pass over the working tree's changed surfaces).
//
//   A. PRESETS GROUPING (behavioral): a category header earns its line
//      only when it GROUPS — a lone visible row under an <h4> is the
//      fragmentation the critique flagged (33 presets under ~27 one-item
//      headers in a 260px column). The REAL src/presets-ui.js runs in a
//      vm sandbox over a stubbed panel DOM and factory library.
//
//   B. SHAPE SCALE + COPY CONTRACTS (static): the 999px pill is gone
//      (control keys take the 4px key radius — .simple-chip, the
//      watchdog's Restore key, the safety dialog); the machined-gutter
//      scrollbar pill keeps its documented 6px; the cold screen speaks
//      one instruction verb ("Press Start to ...").
//
//   C. The dpr-snapped scope columns live in this round's own file
//      (tests/test-live-signal-surface.js, check C9).
//
// Same committed convention as every other file here: plain `node`, zero
// dependencies, browser globals stubbed, REAL src/*.js in a vm sandbox,
// one "  ok - " / "  FAIL - " per check, exit 1 on any failure. Picked
// up automatically by tests/run.js.

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

// =====================================================================
// Shared fake DOM (the test-power-up-and-cold-face.js shape).
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
    type: '',
    value: '',
    id: '',
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
  el.fire = function (evt) {
    (el.listeners[evt] || []).forEach(function (fn) { fn({ preventDefault: function () {} }); });
  };
  return el;
}

// =====================================================================
// A. Presets grouping — the real renderer over a stub panel.
// =====================================================================
(function sectionA() {
  console.log('A. presets panel: a header groups, or it stays silent');

  const byId = {};
  [
    'save-preset-btn', 'current-preset-name', 'unsaved-indicator',
    'preset-search-input', 'preset-list', 'presets-panel-content', 'share-preset-btn',
  ].forEach(function (id) { byId[id] = makeElement('div'); byId[id].id = id; });

  // A factory library shaped to the fragmentation case: TWO presets in
  // "Cleanup" (a real group) and ONE in "Novelty" (a category that must
  // NOT print its own header over a single row). The tags carry one
  // internal technique: value each so the search checks below can pin
  // the 2026-09-03 vocabulary unification (refinement critique P2 #3):
  // the same word must find the same sounds as Simple's Sounds search —
  // description and PUBLIC tags match there, the technique axis never
  // does (settled #43; simple-view.js publicTags strips it).
  const FACTORY = [
    { name: 'Hiss Rescue', description: 'Tames sibilance.', category: 'Cleanup', nodes: [], tags: ['use-case:cleanup', 'vibe:warm', 'technique:clean'] },
    { name: 'Studio Polish', description: 'Fixes the mic first.', category: 'Cleanup', nodes: [], tags: ['use-case:cleanup', 'vibe:natural', 'technique:clean'] },
    { name: 'Chipmunk Party', description: 'Squeaky gag.', category: 'Novelty', nodes: [], tags: ['gag:chipmunk', 'use-case:performance', 'technique:pitch-gag'] },
  ];

  const sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    document: {
      getElementById: function (id) { return byId[id] || null; },
      createElement: makeElement,
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      documentElement: {},
    },
  };
  sandbox.window = sandbox;
  sandbox.window.FactoryPresets = {
    list: function () { return FACTORY.map(function (p) { return { name: p.name, nodes: p.nodes }; }); },
    describeAll: function () { return FACTORY.map(function (p) {
      return { name: p.name, description: p.description, category: p.category };
    }); },
    listDetailed: function () { return FACTORY.map(function (p) {
      return { name: p.name, tags: p.tags };
    }); },
    groupOrder: function () { return ['Cleanup', 'Novelty']; },
  };
  sandbox.window.PresetStore = {
    listNames: function () { return []; },
  };

  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/presets-ui.js'), 'utf8'),
    sandbox,
    { filename: 'src/presets-ui.js' }
  );

  const list = byId['preset-list'];
  const classNames = function () { return list.children.map(function (c) { return c.className; }); };
  const names = function () {
    return list.children.filter(function (c) { return c.className === 'preset-row'; })
      .map(function (c) { return c.getAttribute('data-preset-name'); });
  };

  // Initial render (presets-ui runs refreshPresetList at load).
  check(classNames()[0] === 'preset-group-label', 'A1: the Factory group label leads the list');
  check(names().length === 3, 'A1: all three factory rows render');
  const catHeaders = classNames().filter(function (c) { return c === 'preset-category-label'; });
  check(catHeaders.length === 1,
    'A1: exactly ONE category header prints (Cleanup groups; Novelty is a lone row and stays bare)');

  // A search narrowing Cleanup to one row must drop its header too.
  byId['preset-search-input'].value = 'hiss';
  byId['preset-search-input'].fire('input');
  check(names().length === 1 && names()[0] === 'Hiss Rescue',
    'A2: a narrowing search still finds the row');
  check(classNames().indexOf('preset-category-label') === -1,
    'A2: a one-row search result carries no category header');
  check(classNames()[0] === 'preset-group-label',
    'A2: the Factory/Yours provenance group survives narrowing');

  // Clearing the search restores the group.
  byId['preset-search-input'].value = '';
  byId['preset-search-input'].fire('input');
  check(classNames().filter(function (c) { return c === 'preset-category-label'; }).length === 1,
    'A3: clearing the search restores the real group');

  // 2026-09-03 vocabulary unification (refinement critique P2 #3): the
  // same word must find the same sounds in both views. Simple's Sounds
  // search matches name + description + PUBLIC tags (test-view-switch
  // E4 pins "arena" finding Big Room by description there), so this
  // panel's search matches those fields too — while the internal
  // technique: axis stays unmatchable on BOTH sides (settled #43).
  byId['preset-search-input'].value = 'sibilance';
  byId['preset-search-input'].fire('input');
  check(names().length === 1 && names()[0] === 'Hiss Rescue',
    'A4: a description-only word finds the row — the haystack matches Simple\'s (description included)');

  byId['preset-search-input'].value = 'cleanup';
  byId['preset-search-input'].fire('input');
  check(names().length === 2,
    'A4: a PUBLIC tag word (cleanup) still reaches tagged presets');

  // "pitch" lives ONLY in Chipmunk Party's technique:pitch-gag tag — no
  // name, description, category, node type, or public tag contains it —
  // so this check flips the moment the internal axis leaks back into
  // the haystack (it would match Chipmunk Party).
  byId['preset-search-input'].value = 'pitch';
  byId['preset-search-input'].fire('input');
  check(names().length === 0 && classNames().some(function (c) { return c === 'preset-list-empty'; }),
    'A4: a technique-axis-only word (pitch) matches nothing — the internal axis is not search fodder in either view');

  byId['preset-search-input'].value = '';
  byId['preset-search-input'].fire('input');
  check(names().length === 3, 'A4: clearing the search restores all rows');
})();

// =====================================================================
// B. Shape scale + copy contracts (static).
// =====================================================================
(function sectionB() {
  console.log('B. shapes and copy');

  const css = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const simpleSrc = fs.readFileSync(path.join(ROOT, 'src/simple-view.js'), 'utf8');

  check(!/border-radius:\s*999px/.test(css), 'B1: no RULE declares a pill radius (comments may name the ban)');

  const chipRule = css.match(/\.simple-chip \{[^}]*\}/);
  check(!!chipRule && /border-radius: 4px;/.test(chipRule[0]),
    'B1: the Sounds filter chips read as control keys (4px)');
  const dlgRule = css.match(/\.safety-dialog \{[^}]*\}/);
  check(!!dlgRule && /border-radius: 4px;/.test(dlgRule[0]),
    'B1: the safety dialog takes the key radius (its lifted shadow stays — the toast-family modal lift)');
  const restoreRule = css.match(/\.watchdog-alert \.watchdog-restore \{[^}]*\}/);
  check(!!restoreRule && /border-radius: 4px;/.test(restoreRule[0]),
    'B1: the watchdog Restore key takes the key radius');

  // The documented 6px survivors: the machined-gutter scrollbar pill and
  // the off-chassis ?dev harness — nothing else.
  const sixPx = (css.match(/border-radius: 6px;/g) || []).length;
  check(sixPx === 2,
    'B2: exactly two 6px sites remain (the gutter pill + the dev harness) — no third stray');

  check(html.indexOf('Press Start to try a sound.') !== -1,
    'B3: the Sounds gate note says "Press Start to try a sound."');
  check(simpleSrc.indexOf('Press Start to hear it') !== -1,
    'B3: the stage\'s loaded-sound promise keeps its own verb ("Press Start to hear it")');
  check(html.indexOf('>Start to try a sound.</p>') === -1,
    'B3: the old clipped verb form is gone');
})();

if (failures === 0) {
  console.log('surface-polish: all checks passed');
} else {
  console.log('surface-polish: ' + failures + ' failure(s)');
  process.exit(1);
}
