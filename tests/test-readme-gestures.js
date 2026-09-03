// tests/test-readme-gestures.js — the README interaction-verb lint.
//
// Born in the 2026-09-03 refinement round (critique P2 #1): README.md is
// the operator's printed manual (docs/ACCEPTANCE.md and
// docs/WEBMCP-CHALLENGE.md both treat it as required reading), and it
// had drifted a full UI generation behind the shipped surface — it was
// still teaching the retired patch-cord reorder, the free board, the
// preset dropdown+Load flow, and "Rock"/"Speech" filter chips that do
// not exist. An operator following it in the before-doors window would
// be hunting for controls that are not on the instrument.
//
// This file is the CI half of the fix, on the tests/test-token-contrast
// precedent (a committed contract re-verified on every run): it lints
// README.md for RETIRED interaction vocabulary (must be absent) and
// SHIPPED interaction verbs (must be present), so the manual cannot
// silently drift through the next UI generation either.
//
// Truth sources for the shipped verbs (if the UI changes, the UI and
// this list change in the same commit — that is the point):
//   - drag-to-reorder + Alt+Arrow keyboard twin ... src/canvas.js
//     (the REORDER block and onReorderKeyboardMove)
//   - searchable preset list ........................ src/presets-ui.js
//     (renderPresetList over #preset-list / #preset-search-input)
//   - Sounds filter chips ........................... src/simple-view.js
//     (PLAIN_FILTERS)
//   - Start/Bypass and the spacebar .................. src/main.js
//
// Same committed-test convention as the rest of the suite: zero
// dependencies, plain `node`, per-check "  ok - ..." / "  FAIL - ..."
// output, exit 0 on pass / 1 on any failure.
//
// Run from a clean clone:  node tests/test-readme-gestures.js
// (or via the runner:      node tests/run.js readme-gestures)

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

var readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

// -----------------------------------------------------------------------
// RETIRED vocabulary — exact phrases, never bare words.
//
// Each phrase names a control or gesture that is no longer on the
// instrument. They are matched as EXACT STRINGS so legitimate prose
// keeps passing: "dropdown" alone is still the honest word for the MIC
// PICKER (README: "pick the right mic from the dropdown next to Start"),
// and the preset-flow check below pairs "dropdown" with "Load" for the
// same reason.
// -----------------------------------------------------------------------
var BANNED_PHRASES = [
  // The cable-drawn reorder gesture and the board it lived on, retired
  // with the 2026-09-01 board redesign (src/canvas.js's own header:
  // "the free 2D board — x/y seats, patch cords, jack anchors — is
  // RETIRED"). Order is now a drag over the row itself.
  ['patch cord', 'retired reorder-by-cable gesture'],
  ['by cord', 'the reorder-by-cable gesture as the old README heading spelled it ("Reorder by cord") — no innocuous use of this phrase exists'],
  ['cord board', 'the cord-drawn board, retired with the same redesign'],
  ['jack point', 'the jack anchors cords plugged into; both are gone'],
  ['free board', 'the free 2D x/y-seated layout; the chain is an ordered row now'],
  ['free-form', 'the same retired layout, as its spec prose spelled it']
];

BANNED_PHRASES.forEach(function (pair) {
  check(readme.indexOf(pair[0]) === -1,
    'retired phrase "' + pair[0] + '" is absent (' + pair[1] + ')');
});

// The retired PRESET flow: choose in a dropdown, then press a separate
// Load button (src/presets-ui.js replaced #preset-select + Load/Delete
// with the searchable #preset-list — clicking a row loads it). Matched
// as a PAIR on one line so the mic picker's honest "dropdown" prose,
// which never pairs with Load, cannot trip it.
check(!/dropdown[^.\n]*\+[^.\n]*Load/i.test(readme),
  'retired preset "dropdown + Load" flow is absent (rows in the searchable list load on click)');

// -----------------------------------------------------------------------
// SHIPPED verbs — the manual must keep teaching these.
// -----------------------------------------------------------------------

// Drag-to-reorder of the ordered row, or its Alt+Arrow keyboard twin
// (src/canvas.js onReorderKeyboardMove). The task contract says either
// name satisfies this; the shipped README teaches both.
check(/reorder[^.\n]*drag|drag[^.\n]*reorder/i.test(readme) ||
        /Alt\+Left|Alt\+Right|Alt\+Arrow/i.test(readme),
  'drag-to-reorder of the row (or its Alt+Arrow keyboard twin) is documented');

// The searchable preset list (src/presets-ui.js renderPresetList). The
// phrase is pinned exactly because it IS the shipped surface's name for
// the thing; a rename here should be a deliberate README+test edit.
check(readme.indexOf('searchable preset list') !== -1,
  'the searchable preset list is documented');

// The Simple view's Sounds filter chips, verbatim from src/simple-view.js's
// PLAIN_FILTERS — the single source. The README's chip parenthetical must
// name ONLY chips that actually exist (this is what catches "Rock" and
// "Speech", which never shipped in the current set). Updated 2026-09-03
// for the data-driven prune (refinement critique P2 #3): the row was cut
// from seven chips to five by measured coverage over the 33-sound
// factory library — Funny 10, Big echo 7, Warm 5, Clean & clear 5
// stayed; Deep voices 4 and Robotic 4 (tied-lowest, no subset
// redundancy among survivors) left. Their sounds remain reachable
// through SEARCH in both views ("robot" hits Robot Usher's name and
// gag:robot tag), which is why the manual can stop teaching them as
// chips without losing the sounds.
var SHIPPED_FILTERS = ['All', 'Warm', 'Big echo', 'Funny', 'Clean & clear'];

// Representative chips the manual must actually teach. "Warm" still
// anchors PRODUCT.md's own plain-language example ("make me sound
// warmer"). "Robotic" anchored the other example ("a restrained robotic
// effect") but was pruned 2026-09-03 on the coverage measurement above
// — keeping it required here would have forced the manual to teach a
// chip that no longer exists. "Funny" takes its place as the second
// taught representative because it is the broadest-coverage survivor
// (10 of 33), the ask the regrouping was named for, and the one chip
// whose removal would strand the whole gag axis. The pairing is
// deliberate: one PRODUCT.md-anchored vibe word + one whole-axis word,
// so a future prune that drops either end of that range has to update
// the README in the same commit.
var REQUIRED_FILTERS = ['Warm', 'Funny'];

var chipMatch = /filter chips\s*\(([^)]*)\)/.exec(readme);
check(!!chipMatch,
  'the Simple view documents its filter chips as a "filter chips (...)" list');

var namedChips = [];
if (chipMatch) {
  namedChips = chipMatch[1].split(',').map(function (raw) {
    return raw.replace(/\*/g, '').trim();
  }).filter(function (raw) {
    return raw.length > 0;
  });
  var unknown = namedChips.filter(function (chip) {
    return SHIPPED_FILTERS.indexOf(chip) === -1;
  });
  check(unknown.length === 0,
    'every named filter chip exists in src/simple-view.js PLAIN_FILTERS' +
      (unknown.length ? ' — unknown: ' + unknown.join(', ') : ''));

  REQUIRED_FILTERS.forEach(function (chip) {
    check(namedChips.indexOf(chip) !== -1,
      'shipped Sounds filter chip "' + chip + '" is named in the chips list');
  });
}

// The safety floor's own verbs (src/main.js): Start and the Bypass key.
check(readme.indexOf('Start') !== -1 && readme.indexOf('Bypass') !== -1,
  'Start and Bypass are documented (the safety floor)');

// The spacebar emergency bypass (src/main.js's global Space handler) —
// the one keyboard escape an operator must be able to find in the dark.
check(/spacebar/i.test(readme),
  'the spacebar emergency bypass is documented');

console.log('');
if (failures.length > 0) {
  console.log('test-readme-gestures: ' + failures.length + ' check(s) FAILED — README teaches interactions that do not match the shipped surface.');
  process.exit(1);
}
console.log('test-readme-gestures: all checks passed — README interaction verbs match the shipped surface.');
process.exit(0);
