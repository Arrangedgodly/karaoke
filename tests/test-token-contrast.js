// tests/test-token-contrast.js — the token-pair contrast gate.
//
// Born in the 2026-09-02 audit: DESIGN.md's print ladder recorded
// "--pm-print-dim 5.26 on chassis" while the real WCAG math said 4.46
// (4.18 on slab) — a committed AA gate with a drifted audit trail, and
// nothing in the suite re-verified a single recorded pair. This file is
// that re-verification, run on every `node tests/run.js`:
//
//   A. reads the LIVE :root tokens from styles/main.css (never a copied
//      list — a token this test doesn't know about simply isn't pinned)
//      and computes WCAG 2.x contrast ratios for every pairing the
//      design system records as TEXT (print ladder on its grounds,
//      display amber on the register slot, ink on the three accent
//      fills, white on the BYPASS fill, edge red on the etch, both
//      status inks on the etch, all fourteen family silkscreen inks on
//      chassis AND slab) plus the GATED tier's opacity-0.55 composite
//      over slab — the one pair the Gated Print Rule exists for.
//   B. pins CSS↔DESIGN.md parity for the shared color keys, so the
//      frontmatter palette and the shipped stylesheet can never again
//      drift apart silently.
//
// Same committed-test convention as the rest of the suite: zero
// dependencies, plain `node`, per-check "  ok - ..." / "  FAIL - ..."
// output, exit 0 on pass / 1 on any failure.
//
// Run from a clean clone:  node tests/test-token-contrast.js
// (or via the runner:      node tests/run.js token-contrast)

'use strict';

var fs = require('fs');
var path = require('path');

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

// ----------------------------------------------------------------------
// WCAG 2.x relative luminance / contrast, implemented inline (the suite
// runs with zero dependencies by charter).
// ----------------------------------------------------------------------
function luminance(hex) {
  var channels = [1, 3, 5].map(function (i) {
    var v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(fg, bg) {
  var a = luminance(fg);
  var b = luminance(bg);
  var hi = Math.max(a, b);
  var lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** The color a translucent fg actually paints over bg (alpha composite,
 *  the math the Gated Print Rule's 0.55 recede is measured through). */
function composite(fg, bg, alpha) {
  var mix = function (i) {
    return Math.round(
      parseInt(fg.slice(i, i + 2), 16) * alpha +
      parseInt(bg.slice(i, i + 2), 16) * (1 - alpha)
    );
  };
  return '#' + [1, 3, 5].map(mix).map(function (v) {
    return v.toString(16).padStart(2, '0');
  }).join('');
}

function normalizeHex(value) {
  var m = /^\s*#([0-9a-fA-F]{6})\s*$/.exec(String(value));
  if (!m) {
    return null;
  }
  return '#' + m[1].toLowerCase();
}

// ----------------------------------------------------------------------
// Parse the LIVE tokens: every --name: #hex declaration in main.css's
// :root block(s), comments already stripped so a hex inside a comment
// can never satisfy a lookup.
// ----------------------------------------------------------------------
var RAW_CSS = '\n' + fs.readFileSync(path.join(ROOT, 'styles', 'main.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

var TOKENS = {};
var tokenRe = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
var m;
while ((m = tokenRe.exec(RAW_CSS))) {
  TOKENS[m[1]] = normalizeHex(m[2]);
}

function token(name) {
  return TOKENS[name] || null;
}

var AA = 4.5;

function pairCheck(fgName, bgName, label) {
  var fg = token(fgName);
  var bg = token(bgName);
  if (!fg || !bg) {
    check(false, label + ' (missing token ' + (!fg ? fgName : bgName) + ')');
    return;
  }
  var r = contrast(fg, bg);
  check(r >= AA, label + ' — ' + r.toFixed(2) + ' on ' + bgName +
    ' (floor ' + AA + ')');
}

// ======================================================================
console.log('A. recorded text pairs, recomputed from the live :root tokens');

check(token('pm-print') && token('pm-chassis'), 'A0: the token floor — the shared register parses from styles/main.css');

pairCheck('pm-print', 'pm-chassis', 'A1: print (silkscreen labels) on chassis');
pairCheck('pm-print', 'pm-slab', 'A1: print on slab (sections print on the lighter ground)');
pairCheck('pm-print-hi', 'pm-chassis', 'A1: print-hi (lifted print, values) on chassis');
pairCheck('pm-print-hi', 'pm-slab', 'A1: print-hi on slab');
pairCheck('pm-print-dim', 'pm-chassis', 'A1: print-dim (receding print, flow marks) on chassis — the rung the 2026-09-02 audit caught at 4.46');
pairCheck('pm-print-dim', 'pm-slab', 'A1: print-dim on slab (was 4.18 — the deeper miss)');

// The GATED tier: not a raw pair — the rule is that #dde2ee print must
// still clear AA AFTER the pre-Start recede composites it at 0.55 over
// the slab it sits on. Raw ratios run ~14; the composite is the contract.
(function gatedTier() {
  var gated = token('pm-print-gated');
  var slab = token('pm-slab');
  if (!gated || !slab) {
    check(false, 'A2: the gated tier (missing token)');
    return;
  }
  var r = contrast(composite(gated, slab, 0.55), slab);
  check(r >= AA, 'A2: the GATED tier survives the 0.55 recede over slab — ' + r.toFixed(2) +
    ' (the Gated Print Rule\'s own measurement)');
})();

pairCheck('pm-display', 'pm-register-bg', 'A3: display amber (machine values) on the register slot');
pairCheck('pm-accent', 'pm-register-bg', 'A3: the register\'s signal-orange module segment on the register slot');
pairCheck('pm-ink', 'pm-accent', 'A4: ink on the Start key\'s accent fill');
pairCheck('pm-ink', 'pm-accent-hi', 'A4: ink on accent-hi (hover)');
pairCheck('pm-ink', 'pm-accent-lo', 'A4: ink on accent-lo (press)');
// red-fill is a FILL, never text: it must clear the 3.0 graphical-object
// floor against the chassis (its TEXT pairing — white on the fill — is
// the check below). The edge ring (red-edge) carries the 4.5 text duty.
(function fillSanity() {
  var fill = token('red-fill');
  var chassis = token('pm-chassis');
  if (!fill || !chassis) {
    check(false, 'A5: the red-fill fill-sanity (missing token)');
    return;
  }
  var r = contrast(fill, chassis);
  check(r >= 3.0, 'A5: the engaged BYPASS fill reads against chassis as a shape — ' +
    r.toFixed(2) + ' (graphical floor 3.0; its text pairing is white-on-fill, below)');
})();

// White on the engaged BYPASS fill: the one place white text sits on
// safety red (split-role rule). The CSS writes #FFFFFF literally.
(function bypassFill() {
  var fill = token('red-fill');
  check(!!fill, 'A5: the red-fill token parses');
  if (fill) {
    var r = contrast('#ffffff', fill);
    check(r >= AA, 'A5: white on the engaged BYPASS fill — ' + r.toFixed(2));
  }
})();

pairCheck('red-edge', 'pm-register-bg', 'A6: edge red on the etch slot (the deck\'s BYPASSED sentence)');
pairCheck('status-live', 'pm-system-deck', 'A6: status-live on the etch');
pairCheck('status-error', 'pm-system-deck', 'A6: status-error on the etch');

// All fourteen family silkscreen inks, on both grounds the rail prints on.
var FAMILY_KEYS = Object.keys(TOKENS).filter(function (name) {
  return /^pm-family-/.test(name);
});
check(FAMILY_KEYS.length === 14,
  'A7: fourteen family silkscreen inks present (found ' + FAMILY_KEYS.length + ')');
FAMILY_KEYS.forEach(function (name) {
  pairCheck(name, 'pm-chassis', 'A7: ' + name + ' on chassis');
  pairCheck(name, 'pm-slab', 'A7: ' + name + ' on slab');
});

// ======================================================================
console.log('B. CSS ↔ DESIGN.md palette parity (the frontmatter is the documented register)');

var RAW_DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
var designColors = {};
var designRe = /([a-z0-9-]+)\s*:\s*"(#[0-9a-fA-F]{6})"/g;
while ((m = designRe.exec(RAW_DESIGN))) {
  designColors[m[1]] = normalizeHex(m[2]);
}

// Frontmatter color key -> the CSS custom property carrying the same
// value. The legacy-named tokens (--red-*, --status-*) are the canonical
// values the audit measured; they map by value, not name.
var PARITY_MAP = [
  ['chassis', 'pm-chassis'],
  ['system-deck', 'pm-system-deck'],
  ['slab', 'pm-slab'],
  ['face-edge', 'pm-face-edge'],
  ['register-bg', 'pm-register-bg'],
  ['key', 'pm-key'],
  ['key-edge', 'pm-key-edge'],
  ['ring-track', 'pm-ring-track'],
  ['cap', 'pm-cap'],
  ['ink', 'pm-ink'],
  ['print', 'pm-print'],
  ['print-hi', 'pm-print-hi'],
  ['print-dim', 'pm-print-dim'],
  ['print-gated', 'pm-print-gated'],
  ['accent', 'pm-accent'],
  ['accent-hi', 'pm-accent-hi'],
  ['accent-lo', 'pm-accent-lo'],
  ['display', 'pm-display'],
  ['red-edge', 'red-edge'],
  ['red-fill', 'red-fill'],
  ['status-live', 'status-live'],
  ['status-error', 'status-error'],
  ['family-gain', 'family-gain'],
  ['family-compressor', 'family-compressor'],
  ['family-eq', 'family-eq'],
  ['family-delay', 'family-delay'],
  ['family-reverb', 'family-reverb'],
  ['family-limiter', 'family-limiter'],
  ['family-distortion', 'family-distortion'],
  ['family-chorus', 'family-chorus'],
  ['family-gate', 'family-gate'],
  ['family-autotune', 'family-autotune'],
  ['family-phaser', 'family-phaser'],
  ['family-tremolo', 'family-tremolo'],
  ['family-pitchshift', 'family-pitchshift'],
  ['family-bitcrusher', 'family-bitcrusher'],
  ['pm-family-gain', 'pm-family-gain'],
  ['pm-family-compressor', 'pm-family-compressor'],
  ['pm-family-eq', 'pm-family-eq'],
  ['pm-family-delay', 'pm-family-delay'],
  ['pm-family-reverb', 'pm-family-reverb'],
  ['pm-family-limiter', 'pm-family-limiter'],
  ['pm-family-distortion', 'pm-family-distortion'],
  ['pm-family-chorus', 'pm-family-chorus'],
  ['pm-family-gate', 'pm-family-gate'],
  ['pm-family-autotune', 'pm-family-autotune'],
  ['pm-family-phaser', 'pm-family-phaser'],
  ['pm-family-tremolo', 'pm-family-tremolo'],
  ['pm-family-pitchshift', 'pm-family-pitchshift'],
  ['pm-family-bitcrusher', 'pm-family-bitcrusher']
];

var parityChecked = 0;
PARITY_MAP.forEach(function (pair) {
  var designKey = pair[0];
  var cssKey = pair[1];
  if (!designColors[designKey]) {
    check(false, 'B: DESIGN.md frontmatter is missing color key "' + designKey + '"');
    return;
  }
  parityChecked += 1;
  check(designColors[designKey] === token(cssKey),
    'B: ' + designKey + ' — DESIGN.md ' + designColors[designKey] +
    ' === CSS --' + cssKey + ' ' + (token(cssKey) || '(missing)'));
});
check(parityChecked === PARITY_MAP.length,
  'B: every mapped palette key was compared (' + parityChecked + ' of ' + PARITY_MAP.length + ')');

// ----------------------------------------------------------------------
console.log((failures.length === 0)
  ? 'token-contrast: ALL OK'
  : 'token-contrast: ' + failures.length + ' FAIL');
process.exit(failures.length === 0 ? 0 : 1);
