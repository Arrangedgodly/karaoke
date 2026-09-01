// AUDITION HARNESS — the production Booth (wayfinder #34; the winning
// variant of the #29 three-variant prototype, folded and rewritten to
// house standard). Gives preset candidates their human audition: one
// candidate at a time, full focus, keyboard-first, binary verdicts.
//
// ACTIVATION — exactly src/mcp-harness.js's gate: this module does
// anything at all ONLY when window.location.search CONTAINS the substring
// 'audition' (http://localhost:8000/?audition, ?audition=1, …). Without
// the param: zero elements, zero listeners, zero window export.
//
// STRUCTURE (settled on #29, 2026-09-01):
//   - Booth: one candidate at a time; A = accept, X = reject (keys, or
//     the buttons); verdict auto-advances to the next candidate.
//   - Verdicts are ABSOLUTE and BINARY, bar "usable without edits", with
//     an optional note — recorded in the provenance shape
//     {name, verdict, note, auditionedAt} and exported as JSON for the
//     promotion edit (see src/audition-candidates.js's pipeline note).
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
// (src/audition-candidates.js — the pipeline's pending pen). Verdicts
// live in memory only: reload resets, Export copies the JSON out.
//
// Tested by tests/test-audition-harness.js (session core + load-path
// request shape + gating; the DOM layer is smoke-covered).

(function () {
  'use strict';

  if (!window.location || window.location.search.indexOf('audition') === -1) {
    return; // gated — no elements, listeners, or exports without ?audition
  }

  var VERDICT_VALUES = ['accepted', 'rejected'];
  var BAR_TEXT = 'usable without edits';

  // ---------------------------------------------------------------------
  // Session core — pure, no DOM. Exposed for tests and for the panel's
  // own wiring; everything the audition RECORDS flows through here.
  // ---------------------------------------------------------------------

  function createSession(candidates) {
    var list = Array.isArray(candidates) ? candidates.slice() : [];
    var verdicts = {}; // name -> {name, verdict, note, auditionedAt}

    function findByIndex(i) {
      return i >= 0 && i < list.length ? list[i] : null;
    }

    function counts() {
      var out = { accepted: 0, rejected: 0, pending: 0 };
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
     * Record one binary verdict. Returns {ok, error?} — never throws.
     * `note` is trimmed and stored only when a non-empty string.
     */
    function record(name, verdict, note) {
      var known = list.some(function (entry) { return entry.name === name; });
      if (!known) {
        return { ok: false, error: 'unknown candidate: ' + name };
      }
      if (VERDICT_VALUES.indexOf(verdict) === -1) {
        return { ok: false, error: 'verdict must be accepted or rejected, got: ' + verdict };
      }
      verdicts[name] = {
        name: name,
        verdict: verdict,
        note: typeof note === 'string' && note.trim().length > 0 ? note.trim() : '',
        auditionedAt: new Date().toISOString()
      };
      return { ok: true };
    }

    /**
     * The export: provenance-shaped verdict records in candidate order —
     * what the promotion edit (candidates → factory-library-data.js)
     * consumes.
     */
    function toJSON() {
      return list.map(function (entry) {
        return verdicts[entry.name] || null;
      }).filter(function (v) { return v !== null; });
    }

    return {
      candidates: list,
      index: 0,
      current: function () { return findByIndex(this.index); },
      advance: function () { if (this.index < list.length - 1) { this.index++; } return this.current(); },
      retreat: function () { if (this.index > 0) { this.index--; } return this.current(); },
      record: record,
      counts: counts,
      toJSON: toJSON
    };
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

  var session = createSession(window.AUDITION_CANDIDATES || []);
  var noteInput = null;
  var statusLine = null;

  function engineNoticeText() {
    var started = !!(window.AudioEngine && typeof window.AudioEngine.isStarted === 'function' &&
      window.AudioEngine.isStarted());
    return started
      ? ''
      : 'Engine not started — Start it in the header to hear anything. Headphones required (mic through the chain + open speakers = feedback).';
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

    var counts = session.counts();
    var candidate = session.current();

    if (!candidate) {
      card.appendChild(makeEl('div',
        'No candidates are waiting. The pen (src/audition-candidates.js) is empty — ' +
        'the next batch lands there via PR (pipeline: see that file\u2019s header).',
        'ah-muted'));
      root.appendChild(card);
      document.body.appendChild(root);
      return;
    }

    card.appendChild(makeEl('div', 'AUDITION — candidate ' + (session.index + 1) +
      ' of ' + session.candidates.length, 'ah-muted'));
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
    noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'ah-note';
    noteInput.placeholder = 'optional note (why)';

    var prior = session.toJSON().filter(function (v) { return v.name === candidate.name; })[0];
    if (prior) {
      noteInput.value = prior.note || '';
      (prior.verdict === 'accepted' ? acceptBtn : rejectBtn).classList.add('ah-picked');
    }

    function verdict(verdictValue) {
      var note = noteInput ? noteInput.value : '';
      var res = session.record(candidate.name, verdictValue, note);
      if (res.ok) {
        session.advance();
        renderPanel();
      } else {
        setStatus(res.error);
      }
    }
    acceptBtn.onclick = function () { verdict('accepted'); };
    rejectBtn.onclick = function () { verdict('rejected'); };

    verdictRow.appendChild(acceptBtn);
    verdictRow.appendChild(rejectBtn);
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
      counts.pending + ' pending', 'ah-muted'));
    card.appendChild(nav);

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

    statusLine = makeEl('div', '', 'ah-bar');
    card.appendChild(statusLine);

    card.appendChild(makeEl('div',
      'Bar: "' + BAR_TEXT + '" — absolute, not comparative. Verdicts are in-memory ' +
      '(reload resets); Export carries them into the promotion edit.', 'ah-bar'));

    root.appendChild(card);
    document.body.appendChild(root);
  }

  function setStatus(text) {
    if (statusLine) {
      statusLine.textContent = text || '';
    }
  }

  // Keyboard: A/X verdict the current candidate — never while typing.
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) {
      return;
    }
    var candidate = session.current();
    if (!candidate) {
      return;
    }
    if (e.key === 'a' || e.key === 'A') {
      var resA = session.record(candidate.name, 'accepted', noteInput ? noteInput.value : '');
      if (resA.ok) { session.advance(); renderPanel(); } else { setStatus(resA.error); }
    } else if (e.key === 'x' || e.key === 'X') {
      var resX = session.record(candidate.name, 'rejected', noteInput ? noteInput.value : '');
      if (resX.ok) { session.advance(); renderPanel(); } else { setStatus(resX.error); }
    }
  });

  injectStyles();
  renderPanel();

  window.AuditionHarness = {
    session: session,
    loadToBoard: loadToBoard
  };
})();
