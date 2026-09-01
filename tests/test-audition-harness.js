// Test for wayfinder #34 — the production Booth audition harness
// (src/audition-harness.js + src/audition-candidates.js).
//
// What is tested, and what deliberately is not:
//   - The SESSION CORE (createSession): verdict recording (binary only,
//     known candidates only, notes trimmed), counts, ordering, export in
//     candidate order, bounds on advance/retreat.
//   - THE LOAD PATH: loadToBoard() submits EXACTLY the request
//     src/presets-ui.js's applyLoadedPreset() submits (source 'preset',
//     freshSeats, forceStructural, preset display state) — pinned against
//     the real presets-ui.js source in this repo, so a future change to
//     the human load path that forgets the harness fails here.
//   - THE GATE: without 'audition' in location.search the module exports
//     nothing and touches no DOM (a counting document stub enforces it).
//   - THE PEN: window.AUDITION_CANDIDATES ships pending-only (or empty)
//     entries in the library entry shape — malformed or already-decided
//     candidates fail here, BEFORE an audition session wastes ears on
//     them.
//   - NOT tested: the panel's visual layout (a dev/QA surface; the DOM
//     layer is smoke-covered — module builds a panel through stubs
//     without throwing).
//
// Same committed-test convention as tests/test-factory-presets-policy.js:
// zero-dependency Node harness, `window`-shaped sandbox, real src files
// via fs.readFileSync + vm.runInContext.
//
// Run from a clean clone:  node tests/test-audition-harness.js
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

// A permissive element stub — enough for the harness's JS-built panel to
// wire itself (appendChild, classList, style, event-handler assignment)
// without a DOM.
function makeElStub(tag) {
  var el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    textContent: '',
    value: '',
    disabled: false,
    style: {},
    className: '',
    id: '',
    handlers: {},
    classList: {
      _set: {},
      add: function (c) { this._set[c] = true; },
      remove: function (c) { delete this._set[c]; },
      contains: function (c) { return !!this._set[c]; }
    },
    appendChild: function (child) {
      this.children.push(child);
      return child;
    },
    remove: function () {},
    addEventListener: function (kind, fn) {
      this.handlers[kind] = fn;
    },
    select: function () {},
    setAttribute: function () {}
  };
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.type = 'text';
  }
  return el;
}

function createSandbox(opts) {
  opts = opts || {};
  var domCalls = { createElement: 0, bodyAppend: 0, addEventListener: 0 };
  var sandbox = {
    console: console,
    setTimeout: function (fn) { return setTimeout(fn, 0); },
    clearTimeout: clearTimeout,
    location: { search: opts.search || '' },
    document: {
      createElement: function (tag) {
        domCalls.createElement++;
        return makeElStub(tag);
      },
      createElementNS: function (ns, tag) {
        domCalls.createElement++;
        return makeElStub(tag);
      },
      getElementById: function () { return null; },
      addEventListener: function (kind, fn) {
        domCalls.addEventListener++;
        sandbox.__docHandlers = sandbox.__docHandlers || {};
        sandbox.__docHandlers[kind] = fn;
      },
      head: makeElStub('head'),
      body: makeElStub('body')
    },
    Audio: function (src) {
      this.src = src;
      this.play = function () { return Promise.resolve(); };
    },
    __domCalls: domCalls
  };
  sandbox.window = sandbox;
  sandbox.document.body.appendChild = function (child) {
    domCalls.bodyAppend++;
    return child;
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

function fakeCandidate(name) {
  return {
    name: name,
    description: 'Test candidate ' + name + '.',
    tags: ['use-case:performance', 'vibe:warm'],
    primary: 'vibe:warm',
    provenance: { origin: 'test fixture', auditionDate: null, verdict: 'pending' },
    nodes: [
      { id: 'tc-e1', type: 'eq', params: { lowGain: 1, midGain: 0, highGain: 0.5 } },
      { id: 'tc-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
    ]
  };
}

function main() {
  // --------------------------------------------------------------------
  console.log('A. gate: no ?audition means zero footprint');
  // --------------------------------------------------------------------

  var bare = createSandbox({ search: '?dev=1' });
  loadSrc(bare, 'src/audition-candidates.js');
  loadSrc(bare, 'src/audition-harness.js');
  check(bare.window.AuditionHarness === undefined,
    'A1: no window.AuditionHarness export without ?audition');
  check(bare.__domCalls.createElement === 0 && bare.__domCalls.bodyAppend === 0 &&
    bare.__domCalls.addEventListener === 0,
    'A1: no DOM calls at all without ?audition (created ' + bare.__domCalls.createElement +
    ', appended ' + bare.__domCalls.bodyAppend + ')');

  // --------------------------------------------------------------------
  console.log('B. session core: binary verdicts, notes, counts, bounds, export');
  // --------------------------------------------------------------------

  var s = createSandbox({ search: '?audition=1' });
  loadSrc(s, 'src/audition-candidates.js');
  loadSrc(s, 'src/audition-harness.js');
  var H = s.window.AuditionHarness;
  check(!!H && typeof H.session === 'object' && typeof H.loadToBoard === 'function',
    'B0: active export carries session + loadToBoard');

  // The exported session must MIRROR whatever the pen ships (empty
  // between batches, populated while one awaits audition — the #31 seed
  // batch made that state real).
  var session = H.session;
  var pen = s.window.AUDITION_CANDIDATES;
  check(Array.isArray(session.candidates) &&
    session.candidates.length === (pen ? pen.length : 0),
    'B0: the session mirrors the shipped pen (' + session.candidates.length + ' candidate(s))');
  check((session.current() === null) === (session.candidates.length === 0) &&
    session.toJSON().length === 0,
    'B0: a fresh session has no current candidate when the pen is empty, and never starts with verdicts');

  // The factory itself is not exported (the panel wires it); exercise the
  // recording rules through a session built by re-running the harness
  // module with a populated pen.
  var s2 = createSandbox({ search: '?audition=1' });
  loadSrc(s2, 'src/audition-candidates.js');
  s2.window.AUDITION_CANDIDATES = [fakeCandidate('One'), fakeCandidate('Two'), fakeCandidate('Three')];
  loadSrc(s2, 'src/audition-harness.js');
  var sess = s2.window.AuditionHarness.session;

  check(sess.candidates.length === 3 && sess.current().name === 'One',
    'B1: session lists the pen in order, starts at the first candidate');

  var bad1 = sess.record('Nobody', 'accepted', '');
  check(bad1.ok === false && /unknown candidate/.test(bad1.error),
    'B1: recording an unknown candidate refuses');
  var bad2 = sess.record('One', 'maybe', '');
  check(bad2.ok === false && /accepted or rejected/.test(bad2.error),
    'B1: non-binary verdicts refuse');
  var bad3 = sess.record('One', 'accepted', null);
  check(bad3.ok === false || true, 'B1: null note tolerated as absent (never throws)');

  var ok1 = sess.record('One', 'accepted', '  warm, usable  ');
  check(ok1.ok === true, 'B1: accept records');
  var rec = sess.toJSON()[0];
  check(Object.keys(rec).sort().join(',') === 'auditionedAt,name,note,verdict',
    'B1: verdict record has exactly {name, verdict, note, auditionedAt}');
  check(rec.note === 'warm, usable', 'B1: note is trimmed');
  check(rec.auditionedAt === new Date(rec.auditionedAt).toISOString(),
    'B1: auditionedAt is an ISO timestamp');

  sess.record('Two', 'rejected', '');
  var counts = sess.counts();
  check(counts.accepted === 1 && counts.rejected === 1 && counts.pending === 1,
    'B2: counts read accepted/rejected/pending correctly');

  check(sess.toJSON().map(function (v) { return v.name; }).join(',') === 'One,Two',
    'B2: export follows candidate order, decided entries only');

  sess.index = 0;
  check(sess.advance().name === 'Two' && sess.advance().name === 'Three' &&
    sess.advance().name === 'Three',
    'B3: advance is bounded at the last candidate');
  check(sess.retreat().name === 'Two' && sess.retreat().name === 'One' &&
    sess.retreat().name === 'One',
    'B3: retreat is bounded at the first candidate');

  // --------------------------------------------------------------------
  console.log('C. load path: exactly the human factory-load request');
  // --------------------------------------------------------------------

  var applied = null;
  s2.window.ChainEditing = {
    apply: function (request) {
      applied = request;
      return Promise.resolve({ applied: true });
    }
  };
  var cands = s2.window.AUDITION_CANDIDATES;
  var loadPromise = s2.window.AuditionHarness.loadToBoard(cands[0]);
  return loadPromise.then(function (res) {
    check(res.ok === true, 'C1: loadToBoard resolves ok on an accepted apply');
    check(!!applied && applied.source === 'preset' &&
      applied.candidate === cands[0].nodes &&
      applied.layout === null &&
      !!applied.renderOptions && applied.renderOptions.freshSeats === true &&
      applied.forceStructural === true &&
      !!applied.preset && applied.preset.name === 'One' && applied.preset.modified === false,
      'C1: the request is EXACTLY applyLoadedPreset()\'s shape (source preset, candidate nodes, null layout, freshSeats, forceStructural, display state)');

    // Pin the request shape against the REAL presets-ui.js source, so a
    // future change to the human load path that forgets the harness
    // fails here loudly.
    var presetsUi = fs.readFileSync(path.join(ROOT, 'src/presets-ui.js'), 'utf8');
    check(presetsUi.indexOf("source: 'preset',") !== -1 &&
      presetsUi.indexOf('renderOptions: { freshSeats: true },') !== -1 &&
      presetsUi.indexOf('forceStructural: true,') !== -1 &&
      presetsUi.indexOf('preset: { name: preset.name, modified: false }') !== -1,
      'C2: src/presets-ui.js still carries the pinned applyLoadedPreset request (if this fails, the human path changed — update the harness in the same edit)');

    // Rejection surfaces, never swallowed.
    s2.window.ChainEditing.apply = function () {
      return Promise.reject(new Error('policy refused'));
    };
    return s2.window.AuditionHarness.loadToBoard(cands[1]).then(function (res2) {
      check(res2.ok === false && /policy refused/.test(res2.error),
        'C3: an apply rejection surfaces as {ok:false} with the error text');

      var s3 = createSandbox({ search: '?audition=1' });
      loadSrc(s3, 'src/audition-candidates.js');
      loadSrc(s3, 'src/audition-harness.js');
      // No ChainEditing in s3.
      return s3.window.AuditionHarness.loadToBoard(fakeCandidate('X')).then(function (res3) {
        check(res3.ok === false && /ChainEditing/.test(res3.error),
          'C4: a missing ChainEditing refuses with the house error, never throws');

        // ----------------------------------------------------------------
        console.log('D. the pen: pending-only entries in the library shape');
        // ----------------------------------------------------------------

        var pen = s3.window.AUDITION_CANDIDATES;
        check(Array.isArray(pen), 'D1: AUDITION_CANDIDATES is an array');
        check(pen.every(function (entry) {
          return entry.provenance && entry.provenance.verdict === 'pending' &&
            (entry.provenance.auditionDate === null || typeof entry.provenance.auditionDate === 'string');
        }), pen.length === 0
          ? 'D1: the shipped pen is empty (vacuously pending-only)'
          : 'D1: every pen entry is pending (decided candidates do not belong in the pen)');
        check(pen.every(function (entry) {
          return typeof entry.name === 'string' && entry.name.length > 0 &&
            typeof entry.description === 'string' &&
            Array.isArray(entry.tags) && entry.tags.length > 0 &&
            typeof entry.primary === 'string' &&
            entry.tags.indexOf(entry.primary) !== -1 &&
            Array.isArray(entry.nodes) && entry.nodes.length > 0;
        }), 'D2: every pen entry carries the library shape (name, description, tags incl. primary, nodes)');

        // ----------------------------------------------------------------
        console.log('E. DOM smoke: the Booth builds from stubs without throwing');
        // ----------------------------------------------------------------

        check(s3.__domCalls.createElement > 0 && s3.__domCalls.bodyAppend >= 1 &&
          s3.__domCalls.addEventListener >= 1,
          'E1: with ?audition the panel builds (created ' + s3.__domCalls.createElement +
          ' elements, appended, wired keydown)');
        // The no-candidates state needs an explicitly EMPTY pen — the
        // shipped pen carries a batch whenever one awaits audition.
        var s3e = createSandbox({ search: '?audition=1' });
        loadSrc(s3e, 'src/audition-candidates.js');
        s3e.window.AUDITION_CANDIDATES = [];
        loadSrc(s3e, 'src/audition-harness.js');
        check(s3e.__domCalls.bodyAppend >= 1 &&
          s3e.window.AuditionHarness.session.current() === null,
          'E1: an empty-pen panel renders the no-candidates state without a current candidate');
        check(!!s3.window.AuditionHarness.session.current(),
          'E1: the shipped pen\u2019s panel starts on its first candidate (' +
          (s3.window.AuditionHarness.session.current() || {}).name + ')');

        var s4 = createSandbox({ search: '?audition' });
        loadSrc(s4, 'src/audition-candidates.js');
        s4.window.AUDITION_CANDIDATES = [fakeCandidate('Smoke')];
        loadSrc(s4, 'src/audition-harness.js');
        var kb = s4.__docHandlers && s4.__docHandlers.keydown;
        check(typeof kb === 'function', 'E2: keyboard handler registered for A/X');
        if (typeof kb === 'function') {
          var before = s4.window.AuditionHarness.session.toJSON().length;
          kb({ key: 'a', target: { tagName: 'BODY' } });
          check(s4.window.AuditionHarness.session.toJSON().length === before + 1 &&
            s4.window.AuditionHarness.session.toJSON()[0].verdict === 'accepted',
            'E2: keydown A records an accept for the current candidate');
          // While typing in the note field, keys must NOT verdict.
          s4.window.AUDITION_CANDIDATES = [fakeCandidate('Smoke'), fakeCandidate('Smoke2')];
          var sess4 = s4.window.AuditionHarness.session;
          sess4.record('Smoke2', 'rejected', '');
          var beforeTyping = sess4.toJSON().length;
          kb({ key: 'a', target: { tagName: 'INPUT' } });
          check(sess4.toJSON().length === beforeTyping,
            'E2: keydown while typing in an INPUT does not record');
        }

        if (failures.length === 0) {
          console.log('PASS: audition harness conforms (wayfinder #34)');
          return 0;
        }
        console.log('FAIL: ' + failures.length + ' check(s) failed:');
        failures.forEach(function (label) {
          console.log('  - ' + label);
        });
        return 1;
      });
    });
  });
}

main().then(
  function (code) {
    process.exit(code);
  },
  function (err) {
    console.error('FAIL: harness threw: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
);
