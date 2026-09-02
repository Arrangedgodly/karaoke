// Test for wayfinder #46 — plain-language labels in the effect catalog.
//
// Every registered effect type must carry a `plainLabel` (the Simple
// view's "Evens out loudness" half of "Evens out loudness · Compressor")
// alongside its existing technical `label`. src/effect-catalog.js's
// validateDefinition() already REFUSES to register a type with no
// plainLabel (fails fast, at load time, for any future effect); this
// test is the drift guard test-factory-library.js's header describes —
// it pins the actual agreed wording from
// docs/ultron/research/plain-effect-labels.md (wayfinder #44) against the
// LIVE registry, so a label quietly changed or a new type added without
// updating the research-backed table fails HERE, naming the type,
// instead of shipping unnoticed.
//
// Same committed-test convention as the rest of the suite: a
// zero-dependency Node harness, `window`-shaped sandbox, the REAL src
// files loaded via fs.readFileSync + vm.runInContext. No Tone.js stub is
// needed — every Tone-backed node-*.js file only touches `window.Tone`
// inside its lazy `create` factory, never at registration time, so the
// four adapter-backed types register cleanly with `window.Tone` entirely
// absent (registering never calls `create`).
//
// Run from a clean clone:  node tests/test-effect-plain-labels.js
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

var failures = [];

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

function createSandbox() {
  var sandbox = {
    console: console,
    setTimeout: function (fn) { return setTimeout(fn, 0); },
    clearTimeout: clearTimeout,
    // src/node-reverb.js fetches its IR at LOAD time; a never-settling
    // promise is the tolerated "not fetched yet" state (same stub
    // tests/test-factory-library.js uses).
    fetch: function () { return new Promise(function () {}); }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// The production load order, exactly as index.html ships it, for every
// file that touches window.EffectCatalog.register — registry, ramp
// helper, the Tone adapter, then all fourteen node-*.js files (ten
// native, four Tone-backed).
function loadFullRegistry(sandbox) {
  loadSrc(sandbox, 'src/effect-catalog.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js');
  loadSrc(sandbox, 'src/tone-adapter.js');
  loadSrc(sandbox, 'src/node-gain.js');
  loadSrc(sandbox, 'src/node-compressor.js');
  loadSrc(sandbox, 'src/node-eq.js');
  loadSrc(sandbox, 'src/node-delay.js');
  loadSrc(sandbox, 'src/node-reverb.js');
  loadSrc(sandbox, 'src/node-limiter.js');
  loadSrc(sandbox, 'src/node-distortion.js');
  loadSrc(sandbox, 'src/node-chorus.js');
  loadSrc(sandbox, 'src/node-gate.js');
  loadSrc(sandbox, 'src/node-autotune.js');
  loadSrc(sandbox, 'src/node-pitchshift.js');
  loadSrc(sandbox, 'src/node-tremolo.js');
  loadSrc(sandbox, 'src/node-bitcrusher.js');
  loadSrc(sandbox, 'src/node-phaser.js');
}

// The agreed wording, pinned from the synthesis table in
// docs/ultron/research/plain-effect-labels.md. Update this table in the
// SAME commit as any deliberate wording change, never silently.
var EXPECTED_PLAIN_LABELS = {
  gain: 'Adjusts your volume',
  compressor: 'Evens out loudness',
  eq: 'Shapes your tone',
  delay: 'Adds an echo',
  reverb: 'Puts you in a room',
  limiter: 'Caps how loud it gets',
  gate: 'Cuts background noise',
  autotune: 'Keeps you on pitch',
  distortion: 'Dirties up the sound',
  chorus: 'Thickens your voice',
  tremolo: 'Adds a volume wobble',
  phaser: 'Adds a sweeping swirl',
  pitchshift: 'Raises or lowers your voice',
  bitcrusher: 'Old video-game sound'
};

// Jargon the research explicitly ruled out ("no jargon ... never appear
// in the candidates" — plain-effect-labels.md's synthesis header). Kept
// as a live regex guard (not just the pinned table above) so a FUTURE
// effect type — one this test's author never anticipated — still gets
// caught if its plain label reaches for engineering vocabulary instead
// of consumer wording.
var JARGON = /\b(dynamics?|transient|attenuat\w*|DSP|frequenc\w*|decibel|hertz|milliseconds?|threshold|ratio|envelope)\b/i;

function main() {
  var sandbox = createSandbox();
  loadFullRegistry(sandbox);

  var catalog = sandbox.EffectCatalog;
  check(!!catalog && typeof catalog.getPlainLabel === 'function',
    'Z: EffectCatalog loads with getPlainLabel()');
  if (!catalog) {
    console.log('FAIL: harness cannot proceed without the catalog');
    return 1;
  }

  var types = catalog.getAllTypes();

  // --------------------------------------------------------------------
  console.log('A. every registered type carries a plain label');
  // --------------------------------------------------------------------

  check(types.length === 14, 'A1: the registry carries all fourteen node types (' + types.length + ' found)');

  types.forEach(function (type) {
    var plain = catalog.getPlainLabel(type);
    check(typeof plain === 'string' && plain.trim().length > 0,
      "A2: '" + type + "' has a non-empty plainLabel");
    if (typeof plain !== 'string' || !plain.trim()) {
      return;
    }
    check(plain !== catalog.getLabel(type),
      "A3: '" + type + "'s plainLabel reads differently from its technical label");
    var words = plain.trim().split(/\s+/).length;
    check(words >= 2 && words <= 6,
      "A4: '" + type + "'s plainLabel is a short phrase (" + words + " word(s): \"" + plain + '")');
    check(!JARGON.test(plain),
      "A5: '" + type + "'s plainLabel avoids engineering jargon (\"" + plain + '")');
  });

  // --------------------------------------------------------------------
  console.log('B. wording matches the research-agreed table (docs/ultron/research/plain-effect-labels.md)');
  // --------------------------------------------------------------------

  Object.keys(EXPECTED_PLAIN_LABELS).forEach(function (type) {
    check(types.indexOf(type) !== -1,
      "B1: expected type '" + type + "' is registered");
    check(catalog.getPlainLabel(type) === EXPECTED_PLAIN_LABELS[type],
      "B2: '" + type + "'s plainLabel is \"" + EXPECTED_PLAIN_LABELS[type] +
      '" (got "' + catalog.getPlainLabel(type) + '")');
  });

  types.forEach(function (type) {
    check(Object.prototype.hasOwnProperty.call(EXPECTED_PLAIN_LABELS, type),
      "B3: registered type '" + type + "' has an entry in this test's pinned table " +
      '(add one, sourced from the research doc, in the same commit)');
  });

  // --------------------------------------------------------------------
  console.log('C. registering a type with no plainLabel is refused (validateDefinition)');
  // --------------------------------------------------------------------

  var refusalSandbox = createSandbox();
  loadSrc(refusalSandbox, 'src/effect-catalog.js');
  var threw = null;
  try {
    refusalSandbox.window.EffectCatalog.register('no-plain-label-test', {
      label: 'Test Effect',
      paramSpec: [{ id: 'x', label: 'X', min: 0, max: 1, default: 0, step: 0.1 }],
      experimental: false,
      create: function () { return {}; },
      applyParam: function () {}
    });
  } catch (err) {
    threw = err;
  }
  check(!!threw && /plainLabel/.test(threw.message),
    'C1: EffectCatalog.register refuses a definition with no plainLabel');

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: every registered effect carries a research-backed plain label (wayfinder #46) — ' +
      types.length + ' types, no drift');
    return 0;
  }
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (label) {
    console.log('  - ' + label);
  });
  return 1;
}

process.exit(main());
