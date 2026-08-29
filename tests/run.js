// tests/run.js — the committed regression gate (issue #9).
//
// THE documented test command, runnable from a clean clone with nothing
// but Node installed (zero dependencies, no npm install, no build step):
//
//     node tests/run.js              # run every tests/test-*.js, sorted
//     node tests/run.js <substring>  # only files whose name contains it
//                                    # (e.g. `node tests/run.js node-reuse`)
//
// Each test file is a self-contained zero-dependency script in the
// committed convention (see tests/test-node-reuse-type-match.js's header):
// plain `node`, browser globals stubbed, the REAL src/*.js files loaded
// into a vm sandbox, per-check "  ok - ..." / "  FAIL - ..." prints, exit
// code 0 on pass / 1 on any failure. This runner discovers those files
// AUTOMATICALLY (sorted by name), so a future test file (e.g. the
// issue-#8 save_preset storage-truthfulness suite) is picked up by simply
// existing — no registry to edit.
//
// Isolation: every file runs as its OWN child process
// (child_process.spawnSync(process.execPath, [file])) — one file's crash,
// hung timer, or sabotaged global can neither leak into nor take down the
// others, and the runner keeps going after a failure so a single run
// reports everything. Files run sequentially (sorted); each file's
// captured output is printed in full as soon as that file finishes, then a
// per-file PASS/FAIL table and overall counts are printed at the end.
//
// Exit code: 0 when every ran file exited 0; 1 when any file failed or
// crashed (or when a filter matched nothing — a typo must not read as a
// green run).
//
// Physical, microphone/PA-in-the-room checks are deliberately NOT here —
// automation cannot prove them. Those live in docs/ACCEPTANCE.md.
//
// =====================================================================
// Issue #9 acceptance coverage (printed again at the end of a full run)
// =====================================================================
//   1. Documented command that runs from a clean clone
//        -> this file (`node tests/run.js`)
//   2. All eight WebMCP tools register with intended schemas/annotations
//        -> tests/test-tool-registration.js
//   3. Current chain + every factory preset round-trip set_chain
//        -> tests/test-factory-presets-policy.js (issue #2)
//   4. Same-ID type change creates the correct physical AudioNode
//        -> tests/test-node-reuse-type-match.js (issue #1)
//   5. Limiter removal / node-after-limiter / unsafe ceiling refused
//        -> tests/test-safety-refusals.js
//   6. One valid mutation + exact-state Undo
//        -> tests/test-mutation-undo.js
//   7. save_preset reports storage failures honestly
//        -> tests/test-preset-persistence-honesty.js (issue #8: quota,
//           SecurityError, unavailable storage, serialization failure,
//           overwrite failure, silent-drop-vs-read-back — plus the
//           unchanged happy path and the human Save As/Delete paths)
//   8. Physical mic/PA/audible-DSP/hidden-tab checks
//        -> docs/ACCEPTANCE.md (manual acceptance checklist)
// =====================================================================

'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var TESTS_DIR = __dirname;
var FILTER = process.argv[2] || null;

// Per-check line convention shared by every test file: two leading spaces,
// then "ok - " / "FAIL - ". Counting these (rather than trusting exit
// codes alone) is what lets the summary report a real check total.
var OK_LINE = /^\s{2}ok - /;
var FAIL_LINE = /^\s{2}FAIL - /;

function discover() {
  return fs
    .readdirSync(TESTS_DIR)
    .filter(function (name) {
      return /^test-.*\.js$/.test(name);
    })
    .sort()
    .map(function (name) {
      return path.join(TESTS_DIR, name);
    });
}

function countMatches(text, re) {
  var n = 0;
  String(text).split('\n').forEach(function (line) {
    if (re.test(line)) {
      n += 1;
    }
  });
  return n;
}

function main() {
  var files = discover();
  if (FILTER) {
    files = files.filter(function (f) {
      return path.basename(f).indexOf(FILTER) !== -1;
    });
  }

  if (files.length === 0) {
    console.error(
      'run.js: no tests/test-*.js files matched' +
        (FILTER ? " filter '" + FILTER + "'" : '') +
        ' — nothing ran.'
    );
    process.exit(1);
  }

  console.log('run.js: running ' + files.length + ' test file(s)' +
    (FILTER ? " (filter '" + FILTER + "')" : '') + ' with ' + process.version);
  console.log('');

  var rows = [];
  var totalOk = 0;
  var totalFailChecks = 0;
  var failed = 0;

  files.forEach(function (file) {
    var name = path.basename(file);
    var res = cp.spawnSync(process.execPath, [file], {
      cwd: path.dirname(file),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024
    });

    // Echo everything the file printed (stdout then stderr) before the
    // next file starts, so a full run reads exactly like running the
    // files by hand, in order.
    if (res.stdout) {
      process.stdout.write(res.stdout);
    }
    if (res.stderr) {
      process.stdout.write(res.stderr);
    }

    var ok = countMatches(res.stdout || '', OK_LINE);
    var bad = countMatches(res.stdout || '', FAIL_LINE);
    var crashed = !!res.error || typeof res.status !== 'number';
    var status = crashed ? 'CRASH' : res.status === 0 ? 'PASS' : 'FAIL';

    if (status !== 'PASS') {
      failed += 1;
    }
    totalOk += ok;
    totalFailChecks += bad;
    rows.push({
      name: name,
      status: status,
      ok: ok,
      bad: bad,
      code: crashed ? (res.error ? String(res.error.message || res.error) : 'signal') : res.status
    });
  });

  // ---------------------------------------------------------------------
  // Summary table.
  // ---------------------------------------------------------------------
  console.log('');
  console.log('─'.repeat(72));
  var nameWidth = Math.max.apply(
    null,
    rows.map(function (r) { return r.name.length; }).concat([10])
  );
  console.log(
    padRight('file', nameWidth) + '  result  checks        exit'
  );
  rows.forEach(function (r) {
    console.log(
      padRight(r.name, nameWidth) + '  ' + padRight(r.status, 6) + '  ' +
        padRight(r.ok + ' ok' + (r.bad > 0 ? ', ' + r.bad + ' FAIL' : ''), 12) + '  ' +
        String(r.code)
    );
  });
  console.log('─'.repeat(72));
  console.log(
    rows.length - failed + '/' + rows.length + ' file(s) passed — ' +
      totalOk + ' check(s) ok' +
      (totalFailChecks > 0 ? ', ' + totalFailChecks + ' check(s) FAILED' : '') +
      (failed > 0 ? ' — FAILURES PRESENT' : ' — all green')
  );

  // ---------------------------------------------------------------------
  // Coverage table (issue #9's acceptance rows -> what proves them). Only
  // printed on a FULL run — a filtered run is a developer iteration, not a
  // submission gate.
  // ---------------------------------------------------------------------
  if (!FILTER) {
    console.log('');
    console.log('Issue #9 acceptance coverage:');
    console.log('  1. documented clean-clone command ............ node tests/run.js (this runner)');
    console.log('  2. 8 tools register, schemas + annotations ... tests/test-tool-registration.js');
    console.log('  3. chain + factory presets round-trip ........ tests/test-factory-presets-policy.js');
    console.log('  4. same-ID type change -> right AudioNode .... tests/test-node-reuse-type-match.js');
    console.log('  5. limiter/after-limiter/ceiling refused ..... tests/test-safety-refusals.js');
    console.log('  6. one valid mutation + Undo ................ tests/test-mutation-undo.js');
    console.log('  7. save_preset storage failures honest ....... tests/test-preset-persistence-honesty.js');
    console.log('  8. physical mic/PA/DSP/hidden-tab ............ docs/ACCEPTANCE.md (manual checklist)');
  }

  process.exit(failed > 0 ? 1 : 0);
}

function padRight(s, width) {
  s = String(s);
  while (s.length < width) {
    s += ' ';
  }
  return s;
}

main();
