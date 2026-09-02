// AUDITION HARNESS — the production Booth (wayfinder #34; the winning
// variant of the #29 three-variant prototype, folded and rewritten to
// house standard). Gives preset candidates their human audition: one
// candidate at a time, full focus, keyboard-first.
//
// ACTIVATION — exactly src/mcp-harness.js's gate: this module does
// anything at all ONLY when window.location.search CONTAINS the substring
// 'audition' (http://localhost:8000/?audition, ?audition=1, …). Without
// the param: zero elements, zero listeners, zero window export.
//
// STRUCTURE (settled on #29, 2026-09-01; long-session work added for the
// scale-out batch, 2026-09-01):
//   - Booth: one candidate at a time; A = accept, X = reject, D = defer
//     (keys, or the buttons); a verdict auto-advances to the next
//     candidate.
//   - The QUALITY BAR IS BINARY — "usable without edits", absolute, not
//     comparative. DEFER is not a third tier: it records that the human
//     declined to JUDGE this candidate in this session, so it stays
//     pending in the pen, distinct from a rejection (CONTEXT.md,
//     "Deferred candidate").
//   - Verdicts are recorded in the provenance shape
//     {name, verdict, note, auditionedAt} and exported as JSON for the
//     promotion edit (see src/audition-candidates.js's pipeline note).
//   - PERSISTENCE: verdicts are written to localStorage under
//     STORAGE_KEY, KEYED BY CANDIDATE NAME (names are unique and pinned
//     by tests/test-factory-presets-policy.js), so an edit to the pen can
//     never corrupt or re-target a stored verdict. Every read and write
//     is wrapped — a private window or blocked site data degrades to the
//     old in-memory behaviour, it never throws. Reload resumes at the
//     first PENDING candidate rather than at the top.
//   - FILTER: one axis at a time (all gags, then all genres). Candidate
//     tags are 'axis:value', so a filter is either an axis ('gag') or a
//     whole tag ('gag:robot'). Next/prev stay inside the filter; a filter
//     that would match nothing is refused rather than emptying the Booth.
//   - REVISIT (R): jump to an already-decided candidate, re-hear it, and
//     overwrite its verdict. This is the fatigue guard — a reject given
//     at candidate 80 of 100 may be the singer's voice, not the preset.
//   - Listening: LIVE MIC through the real chain, plus a RAW test-vocal
//     reference button (assets/test-vocal.mp3, straight to the speakers —
//     deliberately NOT through the chain; engine-side playback was ruled
//     out on #29). Start the engine (header Start) to hear anything.
//     Headphones required: mic through chain + open speakers = feedback.
//   - REAL LOAD PATH ONLY: every load submits the EXACT ChainEditing.apply
//     request the Presets tab's own factory load submits (source
//     'preset', freshSeats, forceStructural — see applyLoadedPreset() in
//     src/presets-ui.js). No side door, no second path that could drift.
//
// Candidates come from window.AUDITION_CANDIDATES
// (src/audition-candidates.js — the pipeline's pending pen).
//
// Tested by tests/test-audition-harness.js (session core + persistence +
// resume + filter + defer + revisit + load-path request shape + gating;
// the DOM layer is smoke-covered).

(function () {
  'use strict';

  if (!window.location || window.location.search.indexOf('audition') === -1) {
    return; // gated — no elements, listeners, or exports without ?audition
  }

  // 'deferred' is a SESSION state, not a quality tier: the human declined
  // to judge this candidate now. The bar below stays binary.
  var VERDICT_VALUES = ['accepted', 'rejected', 'deferred'];
  var BAR_TEXT = 'usable without edits';

  // House key naming, alongside 'karaoke-autosave-v1' (src/persistence.js)
  // and 'karaoke-presets-v1' (src/preset-store.js). Booth-only: nothing
  // outside the ?audition gate reads or writes it.
  var STORAGE_KEY = 'karaoke-audition-verdicts-v1';
  var STORAGE_VERSION = 1;

  // ---------------------------------------------------------------------
  // Verdict store — every localStorage touch lives here, and every one of
  // them is wrapped. Unreachable storage is reported, never thrown: the
  // Booth then behaves exactly as it did before persistence existed.
  // ---------------------------------------------------------------------

  function isVerdictRecord(rec) {
    return !!rec && typeof rec === 'object' &&
      typeof rec.name === 'string' && rec.name.length > 0 &&
      VERDICT_VALUES.indexOf(rec.verdict) !== -1 &&
      (rec.note === undefined || typeof rec.note === 'string') &&
      (rec.auditionedAt === undefined || typeof rec.auditionedAt === 'string');
  }

  function normalizeRecord(rec) {
    return {
      name: rec.name,
      verdict: rec.verdict,
      note: typeof rec.note === 'string' ? rec.note : '',
      auditionedAt: typeof rec.auditionedAt === 'string' ? rec.auditionedAt : ''
    };
  }

  function createVerdictStore(key) {
    /**
     * The backing store, or null when there is none. Accessing
     * window.localStorage itself throws in some browsers with site data
     * blocked, so even the lookup is wrapped.
     */
    function backing() {
      try {
        if (typeof localStorage === 'undefined' || !localStorage ||
          typeof localStorage.getItem !== 'function' ||
          typeof localStorage.setItem !== 'function') {
          return null;
        }
        return localStorage;
      } catch (err) {
        return null;
      }
    }

    /**
     * Read the stored name -> record map. Returns
     * {available, verdicts} — `available` says whether storage could be
     * reached at all (so the Booth can tell the human the truth); corrupt
     * or foreign-versioned payloads read as an empty map, never a throw.
     */
    function read() {
      var ls = backing();
      if (!ls) {
        return { available: false, verdicts: {} };
      }
      var raw;
      try {
        raw = ls.getItem(key);
      } catch (err) {
        return { available: false, verdicts: {} };
      }
      if (typeof raw !== 'string' || raw.length === 0) {
        return { available: true, verdicts: {} };
      }
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        return { available: true, verdicts: {} };
      }
      if (!parsed || typeof parsed !== 'object' ||
        parsed.version !== STORAGE_VERSION ||
        !parsed.verdicts || typeof parsed.verdicts !== 'object') {
        return { available: true, verdicts: {} };
      }
      var out = {};
      Object.keys(parsed.verdicts).forEach(function (name) {
        var rec = parsed.verdicts[name];
        // Name-keyed AND name-carrying: a record whose key and name
        // disagree is a corrupted pairing and is dropped, not guessed at.
        if (isVerdictRecord(rec) && rec.name === name) {
          out[name] = normalizeRecord(rec);
        }
      });
      return { available: true, verdicts: out };
    }

    /**
     * Write the session's verdicts, MERGED over whatever is already
     * stored. The merge is why a pen edit cannot lose work: a candidate
     * pulled out of the pen keeps its stored verdict, and a second tab's
     * verdicts survive this tab's write. Returns true only on a write
     * that actually landed.
     */
    function write(verdicts) {
      var ls = backing();
      if (!ls) {
        return false;
      }
      var merged = read().verdicts;
      Object.keys(verdicts).forEach(function (name) {
        merged[name] = verdicts[name];
      });
      try {
        ls.setItem(key, JSON.stringify({
          version: STORAGE_VERSION,
          verdicts: merged
        }));
        return true;
      } catch (err) {
        return false;
      }
    }

    function clear() {
      var ls = backing();
      if (!ls) {
        return false;
      }
      try {
        if (typeof ls.removeItem === 'function') {
          ls.removeItem(key);
        } else {
          ls.setItem(key, '');
        }
        return true;
      } catch (err) {
        return false;
      }
    }

    return { key: key, read: read, write: write, clear: clear };
  }

  // ---------------------------------------------------------------------
  // Session core — pure but for the verdict store, no DOM. Exposed for
  // tests and for the panel's own wiring; everything the audition RECORDS
  // flows through here.
  // ---------------------------------------------------------------------

  function createSession(candidates, store) {
    var list = Array.isArray(candidates) ? candidates.slice() : [];
    var verdicts = {}; // name -> {name, verdict, note, auditionedAt}
    var filter = '';   // '' = every candidate; 'gag' = axis; 'gag:robot' = tag
    var storage = { key: store ? store.key : null, available: false, lastWriteOk: null };

    if (store) {
      var loaded = store.read();
      storage.available = loaded.available;
      // Only names that are IN THE PEN RIGHT NOW come back into the
      // session; the rest stay on disk untouched (write() merges).
      list.forEach(function (entry) {
        var rec = loaded.verdicts[entry.name];
        if (rec) {
          verdicts[entry.name] = rec;
        }
      });
    }

    function persist() {
      if (!store) {
        return false;
      }
      var ok = store.write(verdicts);
      storage.lastWriteOk = ok;
      storage.available = storage.available && ok;
      return ok;
    }

    function findByIndex(i) {
      return i >= 0 && i < list.length ? list[i] : null;
    }

    function indexOfName(name) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].name === name) { return i; }
      }
      return -1;
    }

    /** Every tag a candidate can be filtered by, primary included. */
    function tagsOf(entry) {
      var tags = Array.isArray(entry.tags) ? entry.tags.slice() : [];
      if (typeof entry.primary === 'string' && entry.primary &&
        tags.indexOf(entry.primary) === -1) {
        tags.push(entry.primary);
      }
      return tags;
    }

    /** Does this candidate survive the active filter? */
    function matches(entry) {
      if (!filter) {
        return true;
      }
      return tagsOf(entry).some(function (tag) {
        return tag === filter || tag.indexOf(filter + ':') === 0;
      });
    }

    function matchingIndices() {
      var out = [];
      for (var i = 0; i < list.length; i++) {
        if (matches(list[i])) { out.push(i); }
      }
      return out;
    }

    /** The next index in `step` direction that survives the filter, or -1. */
    function step(from, direction) {
      for (var i = from + direction; i >= 0 && i < list.length; i += direction) {
        if (matches(list[i])) { return i; }
      }
      return -1;
    }

    function counts() {
      // Four disjoint buckets that sum to the pen: a deferred candidate is
      // NOT silently folded into pending here, because the Booth has to be
      // able to say "12 still unheard, 4 you set aside".
      var out = { accepted: 0, rejected: 0, deferred: 0, pending: 0 };
      list.forEach(function (entry) {
        var v = verdicts[entry.name];
        if (v && out[v.verdict] !== undefined) {
          out[v.verdict]++;
        } else {
          out.pending++;
        }
      });
      return out;
    }

    /**
     * Record one verdict — accepted, rejected, or deferred. Returns
     * {ok, error?, persisted?} and never throws. `note` is trimmed and
     * stored only when a non-empty string. Recording over an existing
     * verdict is deliberate and allowed: that is the revisit pass.
     */
    function record(name, verdict, note) {
      var known = indexOfName(name) !== -1;
      if (!known) {
        return { ok: false, error: 'unknown candidate: ' + name };
      }
      if (VERDICT_VALUES.indexOf(verdict) === -1) {
        return {
          ok: false,
          error: 'verdict must be one of accepted, rejected, deferred — got: ' + verdict
        };
      }
      verdicts[name] = {
        name: name,
        verdict: verdict,
        note: typeof note === 'string' && note.trim().length > 0 ? note.trim() : '',
        auditionedAt: new Date().toISOString()
      };
      return { ok: true, persisted: persist() };
    }

    function verdictOf(name) {
      return verdicts[name] || null;
    }

    /**
     * The export: provenance-shaped verdict records in candidate order —
     * what the promotion edit (candidates → factory-library-data.js)
     * consumes. Deferred records ride along so the promotion edit can see
     * which candidates were set aside rather than judged; the record shape
     * itself is unchanged.
     */
    function toJSON() {
      return list.map(function (entry) {
        return verdicts[entry.name] || null;
      }).filter(function (v) { return v !== null; });
    }

    /** First candidate never judged at all (within the filter), or -1. */
    function firstPendingIndex() {
      var idx = matchingIndices();
      for (var k = 0; k < idx.length; k++) {
        if (!verdicts[list[idx[k]].name]) { return idx[k]; }
      }
      return -1;
    }

    /**
     * Where a reload should land: the first pending candidate, or — when
     * everything in view is decided — the first one in view, so the
     * revisit pass has somewhere to start.
     */
    function resume() {
      var pending = firstPendingIndex();
      if (pending !== -1) {
        api.index = pending;
        return api.current();
      }
      var idx = matchingIndices();
      api.index = idx.length > 0 ? idx[0] : 0;
      return api.current();
    }

    /**
     * Set the axis/tag filter. A filter that would match nothing is
     * REFUSED and the previous one kept — an empty Booth is a dead end
     * mid-session. On success the index moves onto a matching candidate
     * (first pending in the new view).
     */
    function setFilter(spec) {
      var next = typeof spec === 'string' ? spec.trim() : '';
      var previous = filter;
      filter = next;
      var matched = matchingIndices();
      if (next && matched.length === 0) {
        filter = previous;
        return { ok: false, error: 'no candidates match filter: ' + next, matched: 0 };
      }
      if (!matches(list[api.index] || {})) {
        resume();
      }
      return { ok: true, filter: filter, matched: matched.length };
    }

    function getFilter() {
      return filter;
    }

    function filtered() {
      return matchingIndices().map(function (i) { return list[i]; });
    }

    /**
     * The axes and primary tags present in the pen, with counts — what the
     * filter control offers. Axis first (work all gags, then all genres),
     * then the individual primaries under them.
     */
    function axisIndex() {
      var axes = {};
      var primaries = {};
      list.forEach(function (entry) {
        var seen = {};
        tagsOf(entry).forEach(function (tag) {
          var colon = tag.indexOf(':');
          var axis = colon > 0 ? tag.slice(0, colon) : tag;
          if (!seen[axis]) {
            seen[axis] = true;
            axes[axis] = (axes[axis] || 0) + 1;
          }
        });
        if (typeof entry.primary === 'string' && entry.primary) {
          primaries[entry.primary] = (primaries[entry.primary] || 0) + 1;
        }
      });
      function toRows(map) {
        return Object.keys(map).sort().map(function (value) {
          return { value: value, count: map[value] };
        });
      }
      return { axes: toRows(axes), primaries: toRows(primaries) };
    }

    /** Jump straight to a candidate by name. Ignores the filter — an
     *  explicit jump is the human overriding their own view. */
    function jumpTo(name) {
      var i = indexOfName(name);
      if (i === -1) {
        return { ok: false, error: 'unknown candidate: ' + name };
      }
      api.index = i;
      return { ok: true, candidate: list[i] };
    }

    /**
     * The revisit pass: move to the next ALREADY-DECIDED candidate in
     * view, wrapping around the end (fatigue shows up late, so the pass
     * usually starts from the bottom of the list). Its verdict is then
     * overwritten by a plain record().
     */
    function revisit() {
      for (var k = 1; k <= list.length; k++) {
        var i = (api.index + k) % list.length;
        if (matches(list[i]) && verdicts[list[i].name]) {
          api.index = i;
          return { ok: true, candidate: list[i], verdict: verdicts[list[i].name] };
        }
      }
      return { ok: false, error: 'nothing decided yet to revisit' };
    }

    /** Position of the current candidate within the filtered view (1-based,
     *  0 when it is outside the view) and the size of that view. */
    function position() {
      var idx = matchingIndices();
      var at = idx.indexOf(api.index);
      return { at: at + 1, of: idx.length };
    }

    /**
     * Forget every verdict, in memory AND on disk. The between-sessions
     * escape hatch for a stale store; the panel puts it behind a
     * confirm-click so a fat finger cannot end a two-hour session.
     */
    function reset() {
      verdicts = {};
      api.index = 0;
      if (!store) {
        return false;
      }
      var ok = store.clear();
      storage.lastWriteOk = ok ? null : false;
      return ok;
    }

    var api = {
      candidates: list,
      index: 0,
      storage: storage,
      current: function () { return findByIndex(this.index); },
      advance: function () {
        var next = step(this.index, 1);
        if (next !== -1) { this.index = next; }
        return this.current();
      },
      retreat: function () {
        var prev = step(this.index, -1);
        if (prev !== -1) { this.index = prev; }
        return this.current();
      },
      record: record,
      verdictOf: verdictOf,
      counts: counts,
      toJSON: toJSON,
      firstPendingIndex: firstPendingIndex,
      resume: resume,
      setFilter: setFilter,
      getFilter: getFilter,
      filtered: filtered,
      axisIndex: axisIndex,
      jumpTo: jumpTo,
      revisit: revisit,
      position: position,
      reset: reset
    };
    return api;
  }

  /**
   * The ONE load path — the exact request src/presets-ui.js's
   * applyLoadedPreset() submits for a factory preset. Deliberately not a
   * shared function call into presets-ui (that panel's module inits only
   * with its markup); the request literal is the contract, and
   * tests/test-audition-harness.js pins it to applyLoadedPreset's shape.
   * Returns {ok, error?}; a rejection from ChainEditing is reported, not
   * swallowed silently.
   */
  function loadToBoard(candidate) {
    if (!window.ChainEditing || typeof window.ChainEditing.apply !== 'function') {
      // Always a promise (the panel wires .then unconditionally) — but
      // never a silent one: the house error text surfaces in the status
      // line exactly like an apply rejection.
      return Promise.resolve({
        ok: false,
        error: 'ChainEditing is required for every preset mutation.'
      });
    }
    return window.ChainEditing.apply({
      source: 'preset',
      candidate: candidate.nodes,
      layout: null,
      renderOptions: { freshSeats: true },
      forceStructural: true,
      preset: { name: candidate.name, modified: false }
    }).then(function () {
      return { ok: true };
    }, function (err) {
      return { ok: false, error: 'load failed: ' + (err && err.message ? err.message : String(err)) };
    });
  }

  // ---------------------------------------------------------------------
  // The Booth panel. Built from JS (no markup in index.html), same as
  // src/mcp-harness.js's panel.
  // ---------------------------------------------------------------------

  function makeEl(tag, text, className) {
    var el = document.createElement(tag);
    if (text !== undefined && text !== null) { el.textContent = text; }
    if (className) { el.className = className; }
    return el;
  }

  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = [
      '.ah-root { position: fixed; top: 96px; left: 50%; transform: translateX(-50%);',
      '  width: 540px; z-index: 9000; font-family: system-ui, sans-serif; }',
      '.ah-card { background: #14161c; color: #e8e8ee; border: 1px solid #3a3f4c;',
      '  border-radius: 12px; padding: 18px 20px; box-shadow: 0 8px 28px rgba(0,0,0,.45); }',
      '.ah-muted { color: #8b93a7; font-size: 13px; }',
      '.ah-name { font-size: 20px; font-weight: 600; margin: 4px 0 2px; }',
      '.ah-desc { color: #c3c9d8; font-size: 14px; max-width: 62ch; }',
      '.ah-chips { color: #8b93a7; font-size: 13px; margin-top: 6px; }',
      '.ah-row { display: flex; gap: 10px; margin-top: 14px; align-items: stretch;',
      '  flex-wrap: wrap; }',
      '.ah-btn { background: #1c2230; color: #cfd6e4; border: 1px solid #3a3f4c;',
      '  border-radius: 8px; padding: 9px 14px; font-size: 14px; cursor: pointer; }',
      '.ah-accept { background: #14532d; color: #b6f2c5; border: 1px solid #1f7a3d; }',
      '.ah-reject { background: #5c1a1a; color: #f2b6b6; border: 1px solid #8a2f2f; }',
      '.ah-defer { background: #2a2f3a; color: #d8c79a; border: 1px solid #6b5c33; }',
      '.ah-select { background: #0c0e12; color: #e8e8ee; border: 1px solid #3a3f4c;',
      '  border-radius: 8px; padding: 8px 10px; font-size: 14px; }',
      '.ah-note { flex: 1; min-width: 160px; background: #0c0e12; color: #e8e8ee;',
      '  border: 1px solid #3a3f4c; border-radius: 8px; padding: 8px 10px; font-size: 14px; }',
      '.ah-picked { outline: 2px solid #fff; }',
      '.ah-progress { font-size: 13px; color: #8b93a7; margin-top: 12px; }',
      '.ah-export { width: 100%; height: 96px; margin-top: 10px; background: #0c0e12;',
      '  color: #9fe0b0; border: 1px solid #3a3f4c; border-radius: 8px; font-size: 11px;',
      '  font-family: ui-monospace, monospace; }',
      '.ah-notice { background: #4a3000; color: #ffd27a; padding: 8px 12px; border-radius: 8px;',
      '  font-size: 13px; margin-bottom: 10px; }',
      '.ah-bar { border-top: 1px solid #2a2f3a; margin-top: 14px; padding-top: 10px;',
      '  font-size: 12px; color: #8b93a7; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  var session = createSession(window.AUDITION_CANDIDATES || [], createVerdictStore(STORAGE_KEY));
  session.resume(); // a reload picks up at the first candidate still unheard
  var noteInput = null;
  var statusLine = null;
  var resetArmed = false;

  function engineNoticeText() {
    var started = !!(window.AudioEngine && typeof window.AudioEngine.isStarted === 'function' &&
      window.AudioEngine.isStarted());
    return started
      ? ''
      : 'Engine not started — Start it in the header to hear anything. Headphones required (mic through the chain + open speakers = feedback).';
  }

  function storageNoticeText() {
    return session.storage.available
      ? 'Verdicts are saved in this browser (' + STORAGE_KEY + ') as you go — a reload ' +
        'resumes at the first candidate you have not heard.'
      : 'STORAGE UNAVAILABLE — verdicts are in memory only this session. Copy the ' +
        'verdict JSON before you reload or close the tab.';
  }

  function addOption(select, value, label, selected) {
    var opt = makeEl('option', label);
    opt.value = value;
    if (selected) {
      opt.selected = true;
      if (typeof opt.setAttribute === 'function') { opt.setAttribute('selected', 'selected'); }
    }
    select.appendChild(opt);
    return opt;
  }

  function buildFilterRow() {
    var row = makeEl('div', null, 'ah-row');
    row.appendChild(makeEl('span', 'Work one axis:', 'ah-muted'));

    var select = document.createElement('select');
    select.className = 'ah-select';
    var active = session.getFilter();
    var index = session.axisIndex();

    addOption(select, '', 'All candidates (' + session.candidates.length + ')', active === '');
    index.axes.forEach(function (row2) {
      addOption(select, row2.value, row2.value + ' — ' + row2.count, active === row2.value);
    });
    index.primaries.forEach(function (row2) {
      addOption(select, row2.value, '  ' + row2.value + ' — ' + row2.count, active === row2.value);
    });
    select.value = active;
    select.onchange = function () {
      var res = session.setFilter(select.value);
      renderPanel();
      if (!res.ok) { setStatus(res.error); }
    };
    row.appendChild(select);
    return row;
  }

  function buildRevisitRow() {
    var row = makeEl('div', null, 'ah-row');
    var decided = session.toJSON();

    var revisitBtn = makeEl('button',
      'Revisit next decided (R)' + (decided.length ? ' — ' + decided.length + ' decided' : ''),
      'ah-btn');
    revisitBtn.disabled = decided.length === 0;
    revisitBtn.onclick = function () {
      var res = session.revisit();
      renderPanel();
      setStatus(res.ok
        ? 'Revisiting "' + res.candidate.name + '" (was ' + res.verdict.verdict +
          ') — re-hear it, then A / X / D overwrites the verdict.'
        : res.error);
    };
    row.appendChild(revisitBtn);

    if (decided.length > 0) {
      var jump = document.createElement('select');
      jump.className = 'ah-select';
      addOption(jump, '', 'jump to a decided candidate…', true);
      decided.forEach(function (rec) {
        addOption(jump, rec.name, rec.verdict.charAt(0).toUpperCase() + ' · ' + rec.name, false);
      });
      jump.onchange = function () {
        if (!jump.value) { return; }
        var res = session.jumpTo(jump.value);
        renderPanel();
        if (!res.ok) { setStatus(res.error); }
      };
      row.appendChild(jump);
    }
    return row;
  }

  function renderPanel() {
    var old = document.getElementById('audition-booth-root');
    if (old) { old.remove(); }

    var root = makeEl('div', null, 'ah-root');
    root.id = 'audition-booth-root';
    var card = makeEl('div', null, 'ah-card');

    var notice = engineNoticeText();
    if (notice) {
      card.appendChild(makeEl('div', notice, 'ah-notice'));
    }
    if (!session.storage.available) {
      card.appendChild(makeEl('div', storageNoticeText(), 'ah-notice'));
    }

    var counts = session.counts();
    var candidate = session.current();

    if (!candidate) {
      card.appendChild(makeEl('div',
        'No candidates are waiting. The pen (src/audition-candidates.js) is empty — ' +
        'the next batch lands there via PR (pipeline: see that file’s header).',
        'ah-muted'));
      root.appendChild(card);
      document.body.appendChild(root);
      return;
    }

    var where = session.position();
    card.appendChild(makeEl('div', 'AUDITION — candidate ' + where.at + ' of ' + where.of +
      (session.getFilter() ? ' in "' + session.getFilter() + '"' : ''), 'ah-muted'));
    card.appendChild(makeEl('div', candidate.name, 'ah-name'));
    if (candidate.description) {
      card.appendChild(makeEl('div', candidate.description, 'ah-desc'));
    }
    card.appendChild(makeEl('div',
      (candidate.nodes || []).map(function (n) { return n.type; }).join(' · '),
      'ah-chips'));
    if (Array.isArray(candidate.tags)) {
      card.appendChild(makeEl('div', candidate.tags.join(' · '), 'ah-chips'));
    }

    card.appendChild(buildFilterRow());

    // Transport.
    var transport = makeEl('div', null, 'ah-row');
    var loadBtn = makeEl('button', 'Load to board (real path)', 'ah-btn');
    loadBtn.onclick = function () {
      loadBtn.disabled = true;
      loadToBoard(candidate).then(function (res) {
        loadBtn.disabled = false;
        setStatus(res.ok
          ? 'Loaded "' + candidate.name + '" — listen on your mic.'
          : res.error);
      });
    };
    transport.appendChild(loadBtn);
    var vocalBtn = makeEl('button', 'Play raw test vocal (not through chain)', 'ah-btn');
    vocalBtn.onclick = function () {
      try {
        new Audio('assets/test-vocal.mp3').play();
      } catch (err) {
        setStatus('test vocal unavailable: ' + err.message);
      }
    };
    transport.appendChild(vocalBtn);
    card.appendChild(transport);

    // Verdict.
    var verdictRow = makeEl('div', null, 'ah-row');
    var acceptBtn = makeEl('button', 'ACCEPT (A) — ' + BAR_TEXT, 'ah-accept');
    var rejectBtn = makeEl('button', 'REJECT (X)', 'ah-reject');
    var deferBtn = makeEl('button', 'DEFER (D) — judge it later', 'ah-defer');
    noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'ah-note';
    noteInput.placeholder = 'optional note (why)';

    var prior = session.verdictOf(candidate.name);
    if (prior) {
      noteInput.value = prior.note || '';
      var pickedBtn = prior.verdict === 'accepted'
        ? acceptBtn
        : (prior.verdict === 'rejected' ? rejectBtn : deferBtn);
      pickedBtn.classList.add('ah-picked');
    }

    function verdict(verdictValue) {
      var note = noteInput ? noteInput.value : '';
      var revising = !!session.verdictOf(candidate.name);
      var res = session.record(candidate.name, verdictValue, note);
      if (res.ok) {
        session.advance();
        renderPanel();
        if (res.persisted === false) {
          setStatus('Verdict recorded IN MEMORY ONLY — storage refused the write. ' +
            'Copy the verdict JSON before reloading.');
        } else if (revising) {
          setStatus('"' + candidate.name + '" overwritten as ' + verdictValue + '.');
        }
      } else {
        setStatus(res.error);
      }
    }
    acceptBtn.onclick = function () { verdict('accepted'); };
    rejectBtn.onclick = function () { verdict('rejected'); };
    deferBtn.onclick = function () { verdict('deferred'); };

    verdictRow.appendChild(acceptBtn);
    verdictRow.appendChild(rejectBtn);
    verdictRow.appendChild(deferBtn);
    verdictRow.appendChild(noteInput);
    card.appendChild(verdictRow);

    // Nav + progress.
    var nav = makeEl('div', null, 'ah-row');
    var prevBtn = makeEl('button', '← prev', 'ah-btn');
    var nextBtn = makeEl('button', 'next →', 'ah-btn');
    prevBtn.onclick = function () { session.retreat(); renderPanel(); };
    nextBtn.onclick = function () { session.advance(); renderPanel(); };
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    nav.appendChild(makeEl('span',
      counts.accepted + ' accepted · ' + counts.rejected + ' rejected · ' +
      counts.deferred + ' deferred · ' + counts.pending + ' pending', 'ah-muted'));
    card.appendChild(nav);

    card.appendChild(buildRevisitRow());

    // Export.
    var exportBox = document.createElement('textarea');
    exportBox.readOnly = true;
    exportBox.className = 'ah-export';
    exportBox.value = session.toJSON().length > 0
      ? JSON.stringify(session.toJSON(), null, 2)
      : '// no verdicts yet — they appear here live';
    card.appendChild(exportBox);
    var copyBtn = makeEl('button', 'Copy verdict JSON', 'ah-btn');
    copyBtn.onclick = function () {
      exportBox.value = JSON.stringify(session.toJSON(), null, 2);
      exportBox.select();
      try { document.execCommand('copy'); } catch (err) { /* selection is visible */ }
    };
    card.appendChild(copyBtn);

    var resetBtn = makeEl('button',
      resetArmed ? 'Click again to ERASE every verdict' : 'Reset stored verdicts',
      'ah-btn');
    resetBtn.onclick = function () {
      if (!resetArmed) {
        resetArmed = true;
        renderPanel();
        setStatus('This erases every verdict, saved ones included. Click again to confirm.');
        return;
      }
      resetArmed = false;
      session.reset();
      session.resume();
      renderPanel();
      setStatus('All verdicts erased — starting over at candidate 1.');
    };
    card.appendChild(resetBtn);

    statusLine = makeEl('div', '', 'ah-bar');
    card.appendChild(statusLine);

    card.appendChild(makeEl('div',
      'Bar: "' + BAR_TEXT + '" — absolute, not comparative, and BINARY. DEFER is not a ' +
      'middle grade: it records that you did not judge this one today, so it stays ' +
      'pending. ' + storageNoticeText(), 'ah-bar'));

    root.appendChild(card);
    document.body.appendChild(root);
  }

  function setStatus(text) {
    if (statusLine) {
      statusLine.textContent = text || '';
    }
  }

  function recordFromKeyboard(candidate, verdictValue) {
    var res = session.record(candidate.name, verdictValue, noteInput ? noteInput.value : '');
    if (res.ok) {
      session.advance();
      renderPanel();
      if (res.persisted === false) {
        setStatus('Verdict recorded IN MEMORY ONLY — storage refused the write. ' +
          'Copy the verdict JSON before reloading.');
      }
    } else {
      setStatus(res.error);
    }
  }

  // Keyboard: A/X/D verdict the current candidate, R starts the revisit
  // pass — never while typing.
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
      return;
    }
    var candidate = session.current();
    if (!candidate) {
      return;
    }
    if (e.key === 'a' || e.key === 'A') {
      recordFromKeyboard(candidate, 'accepted');
    } else if (e.key === 'x' || e.key === 'X') {
      recordFromKeyboard(candidate, 'rejected');
    } else if (e.key === 'd' || e.key === 'D') {
      recordFromKeyboard(candidate, 'deferred');
    } else if (e.key === 'r' || e.key === 'R') {
      var res = session.revisit();
      renderPanel();
      setStatus(res.ok
        ? 'Revisiting "' + res.candidate.name + '" (was ' + res.verdict.verdict +
          ') — re-hear it, then A / X / D overwrites the verdict.'
        : res.error);
    }
  });

  injectStyles();
  renderPanel();

  window.AuditionHarness = {
    session: session,
    loadToBoard: loadToBoard,
    storageKey: STORAGE_KEY
  };
})();
