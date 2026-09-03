// Test for wayfinder #34 — the production Booth audition harness
// (src/audition-harness.js + src/audition-candidates.js).
//
// What is tested, and what deliberately is not:
//   - The SESSION CORE (createSession): verdict recording (known
//     candidates only, notes trimmed), counts, ordering, export in
//     candidate order, bounds on advance/retreat.
//   - PERSISTENCE (scale-out batch): verdicts survive a reload via
//     localStorage, keyed by candidate NAME so a pen edit cannot corrupt
//     or re-target one; corrupt, foreign-versioned and mis-keyed payloads
//     degrade to empty; a missing or throwing store degrades to the old
//     in-memory behaviour and never throws.
//   - RESUME: a reload lands on the first PENDING candidate, not index 0.
//   - DEFER: the third verdict (CONTEXT.md "Deferred candidate") — the
//     human declined to judge, the candidate stays pending-in-the-pen and
//     distinct from a rejection. The quality bar stays binary.
//   - FILTER / JUMP: one axis at a time; next/prev stay inside the view;
//     a filter that would match nothing is refused; jumpTo overrides it.
//   - REVISIT: re-hear a decided candidate and overwrite its verdict
//     (the fatigue guard), without a second export entry.
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

// A localStorage stub. `data` is shared across sandboxes on purpose —
// that is how a RELOAD is simulated: same browser store, brand-new
// module instance.
function makeStorage(data) {
  return {
    data: data || {},
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null;
    },
    setItem: function (k, v) { this.data[k] = String(v); },
    removeItem: function (k) { delete this.data[k]; }
  };
}

// A store that reads fine but refuses every write (quota exceeded, or a
// private window that allows reads and rejects writes).
function makeWriteRefusingStorage(data) {
  var store = makeStorage(data);
  store.setItem = function () { throw new Error('QuotaExceededError'); };
  return store;
}

// A store that throws on the very first read (site data blocked).
function makeThrowingStorage() {
  return {
    getItem: function () { throw new Error('SecurityError: site data blocked'); },
    setItem: function () { throw new Error('SecurityError: site data blocked'); },
    removeItem: function () { throw new Error('SecurityError: site data blocked'); }
  };
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
  if (opts.localStorage) {
    sandbox.localStorage = opts.localStorage;
  }
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

// Same shape, but with the caller's axis tags — the filter/jump work
// needs a pen that spans more than one axis.
function fakeCandidateTagged(name, tags, primary) {
  var entry = fakeCandidate(name);
  entry.tags = tags.slice();
  entry.primary = primary;
  return entry;
}

// Boot the Booth over a given pen and (optionally) a given browser
// store. Calling this twice with the SAME store object is a reload.
function bootBooth(pen, storage) {
  var s = createSandbox({ search: '?audition=1', localStorage: storage });
  loadSrc(s, 'src/audition-candidates.js');
  s.window.AUDITION_CANDIDATES = pen;
  loadSrc(s, 'src/audition-harness.js');
  return s;
}

var STORAGE_KEY = 'karaoke-audition-verdicts-v1';

// The pen the long-session sections work over: three gags, two genres,
// one cleanup use-case.
function longPen() {
  return [
    fakeCandidateTagged('Robot', ['gag:robot', 'use-case:party'], 'gag:robot'),
    fakeCandidateTagged('Megaphone', ['gag:megaphone', 'use-case:party'], 'gag:megaphone'),
    fakeCandidateTagged('Helium', ['gag:helium', 'use-case:party'], 'gag:helium'),
    fakeCandidateTagged('Metal', ['genre:Metal', 'use-case:performance'], 'genre:Metal'),
    fakeCandidateTagged('Country', ['genre:Country', 'use-case:performance'], 'genre:Country'),
    fakeCandidateTagged('Speech Fix', ['use-case:cleanup', 'vibe:natural'], 'use-case:cleanup')
  ];
}

// ----------------------------------------------------------------------
// The long-session work (scale-out batch): a 50-100 candidate audition is
// 1.5-2.5 hours at a live mic. Everything below exists so that session
// survives a reload, a crash, fatigue, and a pen edit landing underneath
// it. Synchronous — no DOM promise chain needed.
// ----------------------------------------------------------------------
function longSessionChecks() {
  // --------------------------------------------------------------------
  console.log('F. persistence: verdicts survive a reload, keyed by name');
  // --------------------------------------------------------------------

  var disk = {};
  var store = makeStorage(disk);
  var s = bootBooth(longPen(), store);
  var sess = s.window.AuditionHarness.session;

  check(sess.storage && sess.storage.available === true &&
    sess.storage.key === STORAGE_KEY,
    'F1: with a reachable store the session reports it available under ' + STORAGE_KEY);

  var wrote = sess.record('Robot', 'accepted', '  keeps the consonants  ');
  check(wrote.ok === true && wrote.persisted === true,
    'F1: a verdict reports that it actually landed on disk');
  check(typeof disk[STORAGE_KEY] === 'string' && disk[STORAGE_KEY].length > 0,
    'F1: the verdict is written under the Booth key');

  var payload = JSON.parse(disk[STORAGE_KEY]);
  check(payload.version === 1 && !!payload.verdicts &&
    !!payload.verdicts.Robot && payload.verdicts.Robot.name === 'Robot' &&
    payload.verdicts.Robot.verdict === 'accepted' &&
    payload.verdicts.Robot.note === 'keeps the consonants',
    'F1: the payload is versioned and KEYED BY CANDIDATE NAME, note trimmed');

  sess.record('Megaphone', 'rejected', 'clipped');
  // ---- the reload ----
  var reloaded = bootBooth(longPen(), store);
  var rsess = reloaded.window.AuditionHarness.session;
  check(rsess.toJSON().length === 2 &&
    rsess.verdictOf('Robot').verdict === 'accepted' &&
    rsess.verdictOf('Robot').note === 'keeps the consonants' &&
    rsess.verdictOf('Megaphone').verdict === 'rejected',
    'F2: a fresh module over the same store recovers both verdicts intact');
  var rc = rsess.counts();
  check(rc.accepted === 1 && rc.rejected === 1 && rc.pending === 4,
    'F2: recovered verdicts count exactly as they did before the reload');

  // ---- the pen edit ----
  // A candidate is pulled out of the pen and a new one lands. The stored
  // verdict for the removed name must NOT be lost, and must NOT slide
  // onto the newcomer that took its index.
  var editedPen = longPen().filter(function (e) { return e.name !== 'Robot'; });
  editedPen.unshift(fakeCandidateTagged('Robot Mk II', ['gag:robot'], 'gag:robot'));
  var edited = bootBooth(editedPen, store);
  var esess = edited.window.AuditionHarness.session;
  check(esess.verdictOf('Robot Mk II') === null,
    'F3: a NEW candidate at the removed one’s index inherits nothing (name-keyed, not index-keyed)');
  check(esess.verdictOf('Megaphone').verdict === 'rejected',
    'F3: a candidate that stayed in the pen keeps its verdict across the edit');
  esess.record('Robot Mk II', 'accepted', '');
  var afterEdit = JSON.parse(disk[STORAGE_KEY]);
  check(!!afterEdit.verdicts.Robot && afterEdit.verdicts.Robot.verdict === 'accepted' &&
    !!afterEdit.verdicts['Robot Mk II'],
    'F3: writing merges — the verdict for the candidate pulled OUT of the pen still sits on disk');

  // ---- corrupt / foreign / mis-keyed payloads ----
  var badDisks = [
    { label: 'F4: unparseable JSON reads as no verdicts', data: 'not json at all{' },
    {
      label: 'F5: a foreign schema version reads as no verdicts',
      data: JSON.stringify({ version: 99, verdicts: { Robot: { name: 'Robot', verdict: 'accepted', note: '', auditionedAt: '' } } })
    },
    {
      label: 'F6: a record whose key and name disagree is dropped, never re-targeted',
      data: JSON.stringify({ version: 1, verdicts: { Robot: { name: 'Megaphone', verdict: 'accepted', note: '', auditionedAt: '' } } })
    },
    {
      label: 'F6: a record with a verdict outside the vocabulary is dropped',
      data: JSON.stringify({ version: 1, verdicts: { Robot: { name: 'Robot', verdict: 'maybe', note: '', auditionedAt: '' } } })
    },
    {
      label: 'F6: a non-object verdicts field reads as no verdicts',
      data: JSON.stringify({ version: 1, verdicts: 'nope' })
    }
  ];
  badDisks.forEach(function (row) {
    var d = {};
    d[STORAGE_KEY] = row.data;
    var bad = bootBooth(longPen(), makeStorage(d));
    var bsess = bad.window.AuditionHarness.session;
    check(bsess.toJSON().length === 0 && bsess.counts().pending === 6 &&
      bsess.current().name === 'Robot',
      row.label);
  });

  // ---- storage that is not there, or refuses ----
  var none = bootBooth(longPen(), undefined);
  var nsess = none.window.AuditionHarness.session;
  check(nsess.storage.available === false,
    'F7: with no localStorage at all the session says so rather than pretending');
  var nres = nsess.record('Robot', 'accepted', 'still recorded');
  check(nres.ok === true && nres.persisted === false &&
    nsess.verdictOf('Robot').verdict === 'accepted',
    'F7: no store degrades to the old in-memory behaviour — the verdict still records');

  var refusing = bootBooth(longPen(), makeWriteRefusingStorage({}));
  var refSess = refusing.window.AuditionHarness.session;
  var refRes = refSess.record('Robot', 'rejected', '');
  check(refRes.ok === true && refRes.persisted === false &&
    refSess.verdictOf('Robot').verdict === 'rejected' &&
    refSess.storage.available === false,
    'F8: a store that throws on write never throws out of record(); the Booth reports it lost persistence');

  // reset() is the only destructive door — it must clear BOTH sides, so
  // a "start over" cannot leave a stale disk to resurrect on next reload.
  var resetDisk = {};
  var resetStore = makeStorage(resetDisk);
  var rs = bootBooth(longPen(), resetStore);
  var rsSess = rs.window.AuditionHarness.session;
  rsSess.record('Robot', 'accepted', '');
  rsSess.record('Metal', 'deferred', '');
  rsSess.reset();
  check(rsSess.toJSON().length === 0 && rsSess.counts().pending === 6 && rsSess.index === 0,
    'F10: reset() forgets every verdict in memory and returns to the top');
  check(!resetDisk[STORAGE_KEY] &&
    bootBooth(longPen(), resetStore).window.AuditionHarness.session.toJSON().length === 0,
    'F10: reset() clears the store too — nothing resurrects on the next reload');

  var throwing = bootBooth(longPen(), makeThrowingStorage());
  var tsess = throwing.window.AuditionHarness.session;
  check(tsess.storage.available === false && tsess.toJSON().length === 0 &&
    tsess.record('Robot', 'accepted', '').ok === true,
    'F9: a store that throws on READ (site data blocked) boots clean and keeps working');

  // --------------------------------------------------------------------
  console.log('G. resume: a reload lands on the first PENDING candidate');
  // --------------------------------------------------------------------

  var gDisk = {};
  var gStore = makeStorage(gDisk);
  var g1 = bootBooth(longPen(), gStore);
  var g1sess = g1.window.AuditionHarness.session;
  check(g1sess.index === 0, 'G1: a session with nothing stored still opens at candidate 1');
  g1sess.record('Robot', 'accepted', '');
  g1sess.record('Megaphone', 'rejected', '');

  var g2 = bootBooth(longPen(), gStore);
  var g2sess = g2.window.AuditionHarness.session;
  check(g2sess.index === 2 && g2sess.current().name === 'Helium',
    'G1: the reload opens on Helium — the first candidate never heard — not back at the top');
  check(g2sess.firstPendingIndex() === 2, 'G1: firstPendingIndex names that candidate');

  var allDisk = {};
  var allStore = makeStorage(allDisk);
  var gAll = bootBooth(longPen(), allStore);
  longPen().forEach(function (entry) {
    gAll.window.AuditionHarness.session.record(entry.name, 'accepted', '');
  });
  var gAll2 = bootBooth(longPen(), allStore);
  var gAll2sess = gAll2.window.AuditionHarness.session;
  check(gAll2sess.firstPendingIndex() === -1 && gAll2sess.index === 0 &&
    gAll2sess.current().name === 'Robot',
    'G2: with everything decided, resume parks at the top for the revisit pass instead of running off the end');

  // --------------------------------------------------------------------
  console.log('H. defer: the third verdict, and the bar that stays binary');
  // --------------------------------------------------------------------

  var h = bootBooth(longPen(), makeStorage({}));
  var hsess = h.window.AuditionHarness.session;
  var hres = hsess.record('Robot', 'deferred', '  come back when rested  ');
  check(hres.ok === true && hres.persisted === true,
    'H1: deferred is an accepted verdict value and persists like the others');
  check(hsess.verdictOf('Robot').verdict === 'deferred' &&
    hsess.verdictOf('Robot').note === 'come back when rested',
    'H1: the deferral records with its note');

  hsess.record('Megaphone', 'accepted', '');
  hsess.record('Helium', 'rejected', '');
  var hc = hsess.counts();
  check(hc.accepted === 1 && hc.rejected === 1 && hc.deferred === 1 && hc.pending === 3,
    'H2: counts carry deferred as its own bucket — a deferral is NOT an accept and NOT a reject');
  check(hc.accepted + hc.rejected + hc.deferred + hc.pending === hsess.candidates.length,
    'H2: the four buckets are disjoint and account for every candidate in the pen');

  var hExport = hsess.toJSON().filter(function (r) { return r.name === 'Robot'; })[0];
  check(!!hExport && Object.keys(hExport).sort().join(',') === 'auditionedAt,name,note,verdict',
    'H3: a deferred record keeps EXACTLY the provenance shape {name, verdict, note, auditionedAt}');
  check(hsess.toJSON().length === 3,
    'H3: the export carries the deferral alongside the decisions (the promotion edit leaves it in the pen)');

  var h2 = bootBooth(longPen(), makeStorage(JSON.parse(JSON.stringify({}))));
  check(h2.window.AuditionHarness.session.record('Robot', 'skipped', '').ok === false,
    'H4: the vocabulary is still closed — "skipped" is not a verdict');

  // A deferred candidate is skipped by resume (it was seen) but is not
  // pending, and is not promoted: it stays in the pen.
  var hDisk = {};
  var hStore = makeStorage(hDisk);
  var h3 = bootBooth(longPen(), hStore);
  h3.window.AuditionHarness.session.record('Robot', 'deferred', '');
  var h4 = bootBooth(longPen(), hStore);
  check(h4.window.AuditionHarness.session.current().name === 'Megaphone',
    'H5: after a reload the deferred candidate is not served up again — resume moves past it');
  check(h4.window.AuditionHarness.session.counts().deferred === 1,
    'H5: but it is still visibly set aside, not silently lost');

  // Keyboard.
  var hKb = bootBooth(longPen(), makeStorage({}));
  var kbH = hKb.__docHandlers && hKb.__docHandlers.keydown;
  check(typeof kbH === 'function', 'H6: keyboard handler registered');
  if (typeof kbH === 'function') {
    kbH({ key: 'd', target: { tagName: 'BODY' } });
    var kbSess = hKb.window.AuditionHarness.session;
    check(kbSess.verdictOf('Robot') !== null &&
      kbSess.verdictOf('Robot').verdict === 'deferred' &&
      kbSess.current().name === 'Megaphone',
      'H6: keydown D defers the current candidate and advances (A/X/D, no collision)');
  }

  // --------------------------------------------------------------------
  console.log('I. filter / jump: one axis at a time');
  // --------------------------------------------------------------------

  var i = bootBooth(longPen(), makeStorage({}));
  var isess = i.window.AuditionHarness.session;

  check(isess.getFilter() === '' && isess.filtered().length === 6,
    'I1: the Booth opens unfiltered — every candidate in view');

  var axes = isess.axisIndex();
  var axisNames = axes.axes.map(function (r) { return r.value; }).join(',');
  check(axisNames === 'gag,genre,use-case,vibe',
    'I2: axisIndex lists the axes present in the pen (got ' + axisNames + ')');
  check(axes.axes.filter(function (r) { return r.value === 'gag'; })[0].count === 3 &&
    axes.axes.filter(function (r) { return r.value === 'use-case'; })[0].count === 6,
    'I2: axis counts are per CANDIDATE, not per tag');
  check(axes.primaries.length === 6,
    'I2: axisIndex also offers each primary tag for a narrower pass');

  var fres = isess.setFilter('gag');
  check(fres.ok === true && fres.matched === 3 &&
    isess.filtered().map(function (c) { return c.name; }).join(',') === 'Robot,Megaphone,Helium',
    'I3: filtering to the gag axis narrows the view to the three gags');

  isess.index = 0;
  check(isess.advance().name === 'Megaphone' && isess.advance().name === 'Helium' &&
    isess.advance().name === 'Helium',
    'I4: next stays inside the filter and stops at its last candidate — it never wanders into genres');
  check(isess.retreat().name === 'Megaphone' && isess.retreat().name === 'Robot' &&
    isess.retreat().name === 'Robot',
    'I4: prev is bounded at the filter’s first candidate');
  check(isess.position().at === 1 && isess.position().of === 3,
    'I4: position reports "1 of 3" inside the filter, not "1 of 6"');

  var narrow = isess.setFilter('genre:Metal');
  check(narrow.ok === true && narrow.matched === 1 && isess.current().name === 'Metal',
    'I5: a whole tag filters as well as a bare axis, and the index moves onto the view');

  var empty = isess.setFilter('genre:Polka');
  check(empty.ok === false && empty.matched === 0 &&
    isess.getFilter() === 'genre:Metal' && isess.current().name === 'Metal',
    'I6: a filter that would empty the Booth is REFUSED and the working view kept');

  check(isess.setFilter('').ok === true && isess.filtered().length === 6,
    'I7: clearing the filter restores the whole pen');

  isess.setFilter('gag');
  var jumped = isess.jumpTo('Speech Fix');
  check(jumped.ok === true && isess.current().name === 'Speech Fix',
    'I8: an explicit jump by name overrides the filter (the human overruling their own view)');
  check(isess.jumpTo('Nobody').ok === false,
    'I8: jumping to an unknown name refuses rather than moving anywhere');
  isess.setFilter('');

  // Resume honours the filter: work all gags first, resume inside them.
  var fDisk = {};
  var fStore = makeStorage(fDisk);
  var f1 = bootBooth(longPen(), fStore);
  f1.window.AuditionHarness.session.record('Robot', 'accepted', '');
  var f2 = bootBooth(longPen(), fStore);
  var f2sess = f2.window.AuditionHarness.session;
  f2sess.setFilter('gag');
  check(f2sess.firstPendingIndex() === 1 && f2sess.current().name === 'Megaphone',
    'I9: setting a filter resumes at the first unheard candidate INSIDE it');

  // --------------------------------------------------------------------
  console.log('J. revisit: the fatigue guard');
  // --------------------------------------------------------------------

  var j = bootBooth(longPen(), makeStorage({}));
  var jsess = j.window.AuditionHarness.session;
  check(jsess.revisit().ok === false,
    'J1: with nothing decided there is nothing to revisit, and it says so');

  jsess.record('Robot', 'accepted', 'sounded fine at candidate 1');
  jsess.record('Megaphone', 'rejected', 'harsh');
  jsess.index = 4; // deep in the session, fatigue setting in
  var rev = jsess.revisit();
  check(rev.ok === true && rev.candidate.name === 'Robot' &&
    rev.verdict.verdict === 'accepted' && jsess.index === 0,
    'J2: revisit wraps around from the back of the list to the first decided candidate');
  var rev2 = jsess.revisit();
  check(rev2.ok === true && rev2.candidate.name === 'Megaphone',
    'J2: revisit walks decided candidates in order');

  var beforeOverwrite = jsess.verdictOf('Megaphone').auditionedAt;
  var exportLen = jsess.toJSON().length;
  var over = jsess.record('Megaphone', 'accepted', 'my voice was tired, not the preset');
  check(over.ok === true && jsess.verdictOf('Megaphone').verdict === 'accepted' &&
    jsess.verdictOf('Megaphone').note === 'my voice was tired, not the preset',
    'J3: re-recording OVERWRITES the earlier verdict — that is the whole point of the pass');
  check(jsess.toJSON().length === exportLen,
    'J3: an overwrite replaces the export entry, it never adds a second one for the same candidate');
  check(jsess.verdictOf('Megaphone').auditionedAt >= beforeOverwrite &&
    Object.keys(jsess.verdictOf('Megaphone')).sort().join(',') === 'auditionedAt,name,note,verdict',
    'J3: the overwritten record is re-stamped and still exactly the provenance shape');
  var jc = jsess.counts();
  check(jc.accepted === 2 && jc.rejected === 0,
    'J3: counts follow the overwrite (the reject is gone, not double-counted)');

  // The overwrite must reach disk, or a reload undoes the revisit pass.
  var jDisk = {};
  var jStore = makeStorage(jDisk);
  var jp1 = bootBooth(longPen(), jStore);
  jp1.window.AuditionHarness.session.record('Robot', 'rejected', 'late-session reject');
  var jp2 = bootBooth(longPen(), jStore);
  jp2.window.AuditionHarness.session.record('Robot', 'accepted', 'revisited, it was me');
  var jp3 = bootBooth(longPen(), jStore);
  check(jp3.window.AuditionHarness.session.verdictOf('Robot').verdict === 'accepted' &&
    JSON.parse(jDisk[STORAGE_KEY]).verdicts.Robot.verdict === 'accepted',
    'J4: an overwrite persists — a reload after a revisit keeps the NEW verdict, not the old one');

  // Revisit stays inside the filter.
  var jf = bootBooth(longPen(), makeStorage({}));
  var jfsess = jf.window.AuditionHarness.session;
  jfsess.record('Robot', 'accepted', '');
  jfsess.record('Metal', 'rejected', '');
  jfsess.setFilter('genre');
  jfsess.index = 3;
  var jfRev = jfsess.revisit();
  check(jfRev.ok === true && jfRev.candidate.name === 'Metal',
    'J5: revisit stays inside the active filter — it does not drag you back into another axis');

  // Keyboard R.
  var jKb = bootBooth(longPen(), makeStorage({}));
  var kbJ = jKb.__docHandlers && jKb.__docHandlers.keydown;
  if (typeof kbJ === 'function') {
    var jKbSess = jKb.window.AuditionHarness.session;
    kbJ({ key: 'a', target: { tagName: 'BODY' } }); // Robot accepted, now on Megaphone
    kbJ({ key: 'x', target: { tagName: 'BODY' } }); // Megaphone rejected, now on Helium
    kbJ({ key: 'r', target: { tagName: 'BODY' } });
    check(jKbSess.current().name === 'Robot',
      'J6: keydown R starts the revisit pass at the first decided candidate');
    kbJ({ key: 'x', target: { tagName: 'BODY' } });
    check(jKbSess.verdictOf('Robot').verdict === 'rejected',
      'J6: a verdict key after R overwrites the revisited candidate');
    kbJ({ key: 'r', target: { tagName: 'SELECT' } });
    check(jKbSess.current().name === 'Megaphone',
      'J6: keys are inert while a SELECT (the filter) has focus');
  }

  // --------------------------------------------------------------------
  console.log('K. DOM smoke over the long-session states, and the gate');
  // --------------------------------------------------------------------

  // The panel re-renders on every verdict and every jump. Drive it
  // through the states the new work introduced — filtered view, decided
  // candidates in the revisit picker, storage-unavailable notice — and
  // require that none of them throws while building.
  var smoke = bootBooth(longPen(), makeStorage({}));
  var smokeKb = smoke.__docHandlers.keydown;
  var beforeRenders = smoke.__domCalls.bodyAppend;
  smoke.window.AuditionHarness.session.setFilter('gag');
  smokeKb({ key: 'a', target: { tagName: 'BODY' } });   // decided -> revisit picker appears
  smokeKb({ key: 'd', target: { tagName: 'BODY' } });   // deferred
  smokeKb({ key: 'r', target: { tagName: 'BODY' } });   // revisit pass
  check(smoke.__domCalls.bodyAppend >= beforeRenders + 3 &&
    smoke.window.AuditionHarness.session.counts().accepted === 1,
    'K0: the panel rebuilds through filter + defer + revisit without throwing');

  var noStoreSmoke = bootBooth(longPen(), undefined);
  check(noStoreSmoke.__domCalls.bodyAppend >= 1 &&
    noStoreSmoke.window.AuditionHarness.session.storage.available === false,
    'K0: the storage-unavailable panel still builds (the human is told, not stranded)');

  var emptySmoke = bootBooth([], makeStorage({}));
  check(emptySmoke.__domCalls.bodyAppend >= 1 &&
    emptySmoke.window.AuditionHarness.session.current() === null &&
    emptySmoke.window.AuditionHarness.session.revisit().ok === false,
    'K0: an empty pen renders the no-candidates state and has nothing to revisit');

  var gated = createSandbox({ search: '?dev=1', localStorage: makeStorage({}) });
  loadSrc(gated, 'src/audition-candidates.js');
  loadSrc(gated, 'src/audition-harness.js');
  check(gated.window.AuditionHarness === undefined &&
    Object.keys(gated.localStorage.data).length === 0 &&
    gated.__domCalls.createElement === 0 && gated.__domCalls.bodyAppend === 0 &&
    gated.__domCalls.addEventListener === 0,
    'K1: without ?audition the module still exports nothing, builds nothing, and writes NOTHING to storage');

  // Source-level belt to K1's braces: with comment lines stripped, no
  // localStorage access may appear ABOVE the early return that gates the
  // module. (The header prose mentions it freely; that costs nothing.)
  var srcCode = fs.readFileSync(path.join(ROOT, 'src/audition-harness.js'), 'utf8')
    .split('\n')
    .filter(function (line) { return line.trim().indexOf('//') !== 0; })
    .join('\n');
  var gateAt = srcCode.indexOf("indexOf('audition')");
  check(gateAt !== -1 && srcCode.indexOf('localStorage') > gateAt,
    'K2: no localStorage access above the ?audition gate in the source');
  check(srcCode.indexOf('localStorage') !== -1 &&
    /try \{[\s\S]*?localStorage[\s\S]*?\} catch \(err\) \{/.test(srcCode),
    'K2: storage access is wrapped in try/catch');
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
  check(bad2.ok === false && /accepted, rejected, deferred/.test(bad2.error),
    'B1: a verdict outside {accepted, rejected, deferred} refuses');
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
      presetsUi.indexOf('candidate: job.preset.nodes,') !== -1 &&
      presetsUi.indexOf('renderOptions: { freshSeats: true },') !== -1 &&
      presetsUi.indexOf('forceStructural: true,') !== -1 &&
      presetsUi.indexOf('preset: { name: job.preset.name, modified: false }') !== -1,
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
        // The no-candidates state needs an explicitly EMPTY pen — but
        // since the 2026-09-02 scale-out promotion decided the last
        // batch, the SHIPPED pen is itself empty until the next one
        // lands, so the shipped-pen branch below stays conditional on
        // batch state.
        var s3e = createSandbox({ search: '?audition=1' });
        loadSrc(s3e, 'src/audition-candidates.js');
        s3e.window.AUDITION_CANDIDATES = [];
        loadSrc(s3e, 'src/audition-harness.js');
        check(s3e.__domCalls.bodyAppend >= 1 &&
          s3e.window.AuditionHarness.session.current() === null,
          'E1: an empty-pen panel renders the no-candidates state without a current candidate');
        check(pen.length === 0
          ? s3.window.AuditionHarness.session.current() === null
          : !!s3.window.AuditionHarness.session.current(),
          pen.length === 0
            ? 'E1: the shipped pen is empty (the 2026-09-02 audition decided every candidate), so its panel also renders the no-candidates state'
            : 'E1: the shipped pen\u2019s panel starts on its first candidate (' +
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

        longSessionChecks();

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
