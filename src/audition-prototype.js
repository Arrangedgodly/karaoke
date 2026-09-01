// PROTOTYPE — THROWAWAY. Wayfinder ticket #29 ("Build the audition harness
// v0"). Answers ONE question: what should the preset audition harness look
// and behave like? Three structurally different variants, switchable via
// ?audition&variant=A|B|C with a floating bottom bar (←/→ keys cycle too).
//
// NOT production code: no tests, no error handling beyond runnable, and the
// candidate chains inside are PLACEHOLDER content marked pre-taxonomy — they
// audition the HARNESS, not the library. The winning variant gets rewritten
// properly when folded in; this file's future is a throwaway branch.
//
// House rules it does honor (they're the thing being prototyped):
//   - Every load goes through the REAL path: ChainCanvas.loadModel(nodes,
//     null, {freshSeats:true}) — the same call the factory Load button
//     makes (src/presets-ui.js). No policy side door.
//   - Verdicts are binary accept/reject (bar: "usable without edits") plus
//     an optional note, recorded in the provenance shape. In-memory only —
//     reload resets; Export copies JSON out.
//   - Zero footprint without the gate: like src/mcp-harness.js, this module
//     activates only when location.search contains 'audition'.
//
// KNOWN GAP, deliberately surfaced rather than solved: the test vocal
// (assets/test-vocal.mp3) plays RAW to the speakers, not through the chain —
// the app has no in-app playback wiring today. Through-chain audition is
// live-mic only for now; whether the real harness needs through-chain test
// vocal (engine-side aux input) is an open question for the human to react
// to. Variant C says this out loud on screen.

(function () {
  'use strict';

  if (window.location.search.indexOf('audition') === -1) {
    return; // gated — zero elements, listeners, or exports without ?audition
  }

  // ---------------------------------------------------------------------
  // Placeholder candidates (pre-taxonomy). Param shapes copied from the
  // proven factory/QA-3 material in src/factory-presets.js so every chain
  // is schema-legal on first load. Real candidates come from the seed
  // batch ticket (#31) after the taxonomy lands (#28).
  // ---------------------------------------------------------------------
  var CANDIDATES = [
    {
      name: 'Stadium Anthem',
      description: 'Big crowd energy: bright lift, wide slap, long hall. PLACEHOLDER — harness test content.',
      tags: ['pre:genre-anthem', 'pre:vibe-epic'],
      nodes: [
        { id: 'ap-g1', type: 'gain',       params: { gainDb: 2 } },
        { id: 'ap-e1', type: 'eq',         params: { lowGain: 1, midGain: 0.5, highGain: 2 } },
        { id: 'ap-c1', type: 'compressor', params: { threshold: -12, ratio: 3, attack: 0.008, release: 0.2 } },
        { id: 'ap-d1', type: 'delay',      params: { timeMs: 380, feedback: 30, mix: 24 } },
        { id: 'ap-r1', type: 'reverb',     params: { mix: 55 } },
        { id: 'ap-l1', type: 'limiter',    params: { ceiling: -4, release: 150 } }
      ]
    },
    {
      name: 'Robot Wedding Singer',
      description: 'Gag chain: hard-tuned, buzzy, ceremonial. PLACEHOLDER — harness test content.',
      tags: ['pre:gag-robot', 'pre:use-performance'],
      nodes: [
        { id: 'ap-e2', type: 'eq',         params: { lowGain: -2, midGain: 3, highGain: -1 } },
        { id: 'ap-t2', type: 'autotune',   params: { key: 'C', scale: 'Chromatic', retune: 0, mix: 100 } },
        { id: 'ap-x2', type: 'distortion', params: { drive: 0.45, tone: 0.3, output: -10 } },
        { id: 'ap-h2', type: 'chorus',     params: { depthMs: 2.5, rateHz: 0.4, mix: 20 } },
        { id: 'ap-l2', type: 'limiter',    params: { ceiling: -6, release: 100 } }
      ]
    },
    {
      name: 'Smoky Jazz Club',
      description: 'Late-night warmth: rounded edges, slow level, subtle width. PLACEHOLDER — harness test content.',
      tags: ['pre:vibe-warm', 'pre:genre-jazz'],
      nodes: [
        { id: 'ap-e3', type: 'eq',         params: { lowGain: 2, midGain: 1, highGain: -2 } },
        { id: 'ap-c3', type: 'compressor', params: { threshold: -14, ratio: 2, attack: 0.02, release: 0.35 } },
        { id: 'ap-h3', type: 'chorus',     params: { depthMs: 1.5, rateHz: 0.3, mix: 12 } },
        { id: 'ap-r3', type: 'reverb',     params: { mix: 40 } },
        { id: 'ap-l3', type: 'limiter',    params: { ceiling: -6, release: 180 } }
      ]
    }
  ];

  var verdicts = {}; // name -> {name, verdict:'accepted'|'rejected', note, auditionedAt}
  var cursor = 0;    // Variant A's current candidate index
  var lastLoadedNodes = null; // Variant C's "previous candidate" reference

  // ------------------------------------------------------------------ utils

  function makeEl(tag, text, className) {
    var el = document.createElement(tag);
    if (text !== undefined && text !== null) { el.textContent = text; }
    if (className) { el.className = className; }
    return el;
  }

  function nodeChips(preset) {
    return preset.nodes.map(function (n) { return n.type; }).join(' · ');
  }

  // The REAL load path — identical call to the factory Load button
  // (src/presets-ui.js). No shortcut, no side door.
  function loadToBoard(preset) {
    lastLoadedNodes = preset.nodes;
    window.ChainCanvas.loadModel(preset.nodes, null, { freshSeats: true });
  }

  function recordVerdict(preset, verdict, note) {
    verdicts[preset.name] = {
      name: preset.name,
      verdict: verdict,
      note: note || '',
      auditionedAt: new Date().toISOString()
    };
  }

  function verdictCount(verdict) {
    return Object.keys(verdicts).filter(function (k) {
      return verdicts[k].verdict === verdict;
    }).length;
  }

  function provenanceJSON() {
    return JSON.stringify(Object.keys(verdicts).map(function (k) { return verdicts[k]; }), null, 2);
  }

  function playRawTestVocal() {
    var a = new Audio('assets/test-vocal.mp3');
    a.play(); // RAW — straight to speakers, NOT through the chain (see header)
    return a;
  }

  function engineNotice() {
    var started = !!(window.AudioEngine && window.AudioEngine.isStarted &&
      window.AudioEngine.isStarted());
    return started
      ? null
      : 'Engine not started — Loads still work, but HEARING anything needs the header Start button. Wear headphones (mic through chain + speakers = feedback).';
  }

  function refreshEngineNotice(container) {
    var msg = engineNotice();
    container.textContent = msg || '';
    container.style.display = msg ? 'block' : 'none';
  }

  // ------------------------------------------------------------- the variants

  function teardown() {
    var old = document.getElementById('audition-proto-root');
    if (old) { old.remove(); }
  }

  function root() {
    teardown();
    var r = makeEl('div', null, null);
    r.id = 'audition-proto-root';
    document.body.appendChild(r);
    return r;
  }

  // Shared: verdict buttons + note, calling back with (verdict, note).
  function verdictRow(preset, onChange) {
    var row = makeEl('div', null, 'ap-verdict-row');
    var accept = makeEl('button', 'ACCEPT — usable without edits', 'ap-accept');
    var reject = makeEl('button', 'REJECT', 'ap-reject');
    var note = document.createElement('input');
    note.type = 'text';
    note.className = 'ap-note';
    note.placeholder = 'optional note (why)';
    var existing = verdicts[preset.name];
    if (existing) {
      note.value = existing.note || '';
      (existing.verdict === 'accepted' ? accept : reject).classList.add('ap-picked');
    }
    accept.onclick = function () {
      recordVerdict(preset, 'accepted', note.value);
      if (onChange) { onChange('accepted'); }
    };
    reject.onclick = function () {
      recordVerdict(preset, 'rejected', note.value);
      if (onChange) { onChange('rejected'); }
    };
    note.onchange = function () {
      var v = verdicts[preset.name];
      if (v) { v.note = note.value; }
    };
    row.appendChild(accept);
    row.appendChild(reject);
    row.appendChild(note);
    return row;
  }

  function sharedStyles() {
    var s = document.createElement('style');
    s.textContent = [
      '#audition-proto-root { position: fixed; inset: 0; pointer-events: none; z-index: 9000;',
      '  font-family: system-ui, sans-serif; }',
      '#audition-proto-root > * { pointer-events: auto; }',
      '.ap-notice { background: #4a3000; color: #ffd27a; padding: 8px 12px; border-radius: 6px;',
      '  font-size: 13px; position: fixed; top: 90px; left: 50%; transform: translateX(-50%);',
      '  max-width: 640px; text-align: center; }',
      '.ap-card { background: #14161c; color: #e8e8ee; border: 1px solid #3a3f4c;',
      '  border-radius: 12px; padding: 20px; }',
      '.ap-verdict-row { display: flex; gap: 10px; margin-top: 14px; align-items: stretch; }',
      '.ap-accept { background: #14532d; color: #b6f2c5; border: 1px solid #1f7a3d; }',
      '.ap-reject { background: #5c1a1a; color: #f2b6b6; border: 1px solid #8a2f2f; }',
      '.ap-picked { outline: 2px solid #fff; }',
      '.ap-note { flex: 1; background: #0c0e12; color: #e8e8ee; border: 1px solid #3a3f4c;',
      '  border-radius: 6px; padding: 6px 10px; font-size: 14px; }',
      'button.ap-accept, button.ap-reject, .ap-btn { padding: 10px 16px; border-radius: 8px;',
      '  font-size: 14px; cursor: pointer; }',
      '.ap-btn { background: #1c2230; color: #cfd6e4; border: 1px solid #3a3f4c; }',
      '.ap-chips { color: #8b93a7; font-size: 13px; margin-top: 6px; }',
      '.ap-muted { color: #8b93a7; font-size: 13px; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  // VARIANT A — "The Booth": one candidate at a time, full focus, keyboard-first.
  function renderBooth() {
    var r = root();
    var preset = CANDIDATES[cursor];

    var wrap = makeEl('div', null, null);
    wrap.style.cssText = 'position:fixed; top:110px; left:50%; transform:translateX(-50%); width:520px;';
    var card = makeEl('div', null, 'ap-card');

    var progress = makeEl('div',
      'Candidate ' + (cursor + 1) + ' / ' + CANDIDATES.length +
      ' — accepted ' + verdictCount('accepted') + ', rejected ' + verdictCount('rejected'),
      'ap-muted');

    var name = makeEl('h2', preset.name, null);
    name.style.margin = '6px 0 2px';
    var desc = makeEl('div', preset.description, null);
    desc.style.cssText = 'color:#c3c9d8; font-size:15px; max-width:60ch;';
    var chips = makeEl('div', nodeChips(preset), 'ap-chips');
    var tags = makeEl('div', preset.tags.join(' · '), 'ap-chips');

    var transport = makeEl('div', null, null);
    transport.style.cssText = 'display:flex; gap:10px; margin-top:16px;';
    var loadBtn = makeEl('button', 'Load to board (real path)', 'ap-btn');
    loadBtn.onclick = function () { loadToBoard(preset); };
    var vocalBtn = makeEl('button', 'Play raw test vocal', 'ap-btn');
    vocalBtn.onclick = function () { playRawTestVocal(); };
    transport.appendChild(loadBtn);
    transport.appendChild(vocalBtn);

    card.appendChild(progress);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(chips);
    card.appendChild(tags);
    card.appendChild(transport);
    card.appendChild(verdictRow(preset, function () {
      if (cursor < CANDIDATES.length - 1) { cursor++; }
      renderBooth(); // auto-advance and re-render
    }));

    var nav = makeEl('div', null, null);
    nav.style.cssText = 'display:flex; gap:10px; margin-top:10px;';
    var prev = makeEl('button', '← prev', 'ap-btn');
    var next = makeEl('button', 'next →', 'ap-btn');
    prev.onclick = function () { if (cursor > 0) { cursor--; renderBooth(); } };
    next.onclick = function () { if (cursor < CANDIDATES.length - 1) { cursor++; renderBooth(); } };
    nav.appendChild(prev);
    nav.appendChild(next);
    card.appendChild(nav);

    var hint = makeEl('div', 'Keyboard on this variant: A = accept, X = reject (advances).', 'ap-muted');
    hint.style.marginTop = '8px';
    card.appendChild(hint);

    wrap.appendChild(card);
    r.appendChild(wrap);

    document.onkeydown = function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) { return; }
      var current = CANDIDATES[cursor];
      if (e.key === 'a' || e.key === 'A') {
        var an = wrap.querySelector('.ap-note');
        recordVerdict(current, 'accepted', an ? an.value : '');
        if (cursor < CANDIDATES.length - 1) { cursor++; }
        renderBooth();
      } else if (e.key === 'x' || e.key === 'X') {
        var xn = wrap.querySelector('.ap-note');
        recordVerdict(current, 'rejected', xn ? xn.value : '');
        if (cursor < CANDIDATES.length - 1) { cursor++; }
        renderBooth();
      }
    };
  }

  // VARIANT B — "The Sheet": batch manager, every candidate visible, inline verdicts.
  function renderSheet() {
    var r = root();
    var panel = makeEl('div', null, 'ap-card');
    panel.style.cssText = 'position:fixed; top:90px; right:16px; width:460px; max-height:calc(100vh - 220px); overflow:auto;';

    var title = makeEl('h2', 'Audition sheet', null);
    title.style.margin = '2px 0 8px';
    panel.appendChild(title);

    var table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:13px;';
    CANDIDATES.forEach(function (preset) {
      var tr = document.createElement('tr');
      tr.style.cssText = 'border-top:1px solid #2a2f3a; vertical-align:top;';

      var tdMain = document.createElement('td');
      tdMain.style.padding = '8px 6px';
      var nm = makeEl('div', preset.name, null);
      nm.style.cursor = 'pointer';
      nm.style.fontWeight = '600';
      nm.title = 'Click to load to board (real path)';
      nm.onclick = function () { loadToBoard(preset); };
      var ch = makeEl('div', nodeChips(preset), 'ap-chips');
      var st = verdicts[preset.name]
        ? (verdicts[preset.name].verdict === 'accepted' ? '✓ accepted' : '✗ rejected')
        : '· pending';
      var stEl = makeEl('div', st, 'ap-chips');
      tdMain.appendChild(nm);
      tdMain.appendChild(ch);
      tdMain.appendChild(stEl);

      var tdVerdict = document.createElement('td');
      tdVerdict.style.padding = '8px 2px';
      var ok = makeEl('button', '✓', 'ap-accept');
      ok.style.cssText = 'padding:4px 10px; margin:2px; display:block;';
      var no = makeEl('button', '✗', 'ap-reject');
      no.style.cssText = 'padding:4px 10px; margin:2px; display:block;';
      ok.onclick = function () { recordVerdict(preset, 'accepted', (verdicts[preset.name] || {}).note || ''); renderSheet(); };
      no.onclick = function () { recordVerdict(preset, 'rejected', (verdicts[preset.name] || {}).note || ''); renderSheet(); };
      tdVerdict.appendChild(ok);
      tdVerdict.appendChild(no);

      var tdNote = document.createElement('td');
      tdNote.style.padding = '8px 2px';
      var note = document.createElement('input');
      note.type = 'text';
      note.placeholder = 'note';
      note.value = verdicts[preset.name] ? (verdicts[preset.name].note || '') : '';
      note.style.cssText = 'width:90px; background:#0c0e12; color:#e8e8ee; border:1px solid #3a3f4c; border-radius:4px; padding:4px 6px; font-size:12px;';
      note.onchange = function () {
        if (verdicts[preset.name]) { verdicts[preset.name].note = note.value; }
      };
      tdNote.appendChild(note);

      tr.appendChild(tdMain);
      tr.appendChild(tdVerdict);
      tr.appendChild(tdNote);
      table.appendChild(tr);
    });
    panel.appendChild(table);

    var vocalBtn = makeEl('button', 'Play raw test vocal', 'ap-btn');
    vocalBtn.style.marginTop = '10px';
    vocalBtn.onclick = function () { playRawTestVocal(); };
    panel.appendChild(vocalBtn);

    var out = document.createElement('textarea');
    out.readOnly = true;
    out.style.cssText = 'width:100%; height:110px; margin-top:10px; background:#0c0e12; color:#9fe0b0;' +
      'border:1px solid #3a3f4c; border-radius:6px; font-size:11px; font-family:ui-monospace,monospace;';
    out.value = provenanceJSON() || '// no verdicts yet — they appear here live';
    panel.appendChild(out);

    var copy = makeEl('button', 'Copy provenance JSON', 'ap-btn');
    copy.style.marginTop = '6px';
    copy.onclick = function () {
      out.value = provenanceJSON();
      out.select();
      try { document.execCommand('copy'); } catch (err) { /* prototype */ }
    };
    panel.appendChild(copy);

    r.appendChild(panel);
    document.onkeydown = null;
  }

  // VARIANT C — "The Duel": current candidate vs. a reference, comparative verdict.
  function renderDuel() {
    var r = root();
    var preset = CANDIDATES[cursor];
    var wrap = makeEl('div', null, null);
    wrap.style.cssText = 'position:fixed; top:110px; left:50%; transform:translateX(-50%); width:640px;';

    var card = makeEl('div', null, 'ap-card');
    var title = makeEl('h2', 'Audition duel', null);
    title.style.margin = '2px 0 10px';
    card.appendChild(title);

    var grid = makeEl('div', null, null);
    grid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:14px;';

    // LEFT: reference slot — any factory preset, or the previous candidate.
    var left = makeEl('div', null, null);
    left.style.cssText = 'border:1px dashed #3a3f4c; border-radius:8px; padding:12px;';
    left.appendChild(makeEl('div', 'REFERENCE', 'ap-muted'));
    var sel = document.createElement('select');
    sel.style.cssText = 'margin:8px 0; width:100%; background:#0c0e12; color:#e8e8ee; border:1px solid #3a3f4c; border-radius:6px; padding:6px;';
    var factory = (window.FactoryPresets && window.FactoryPresets.list()) || [];
    factory.forEach(function (fp) {
      var o = document.createElement('option');
      o.value = 'factory:' + fp.name;
      o.textContent = 'factory · ' + fp.name;
      sel.appendChild(o);
    });
    if (lastLoadedNodes) {
      var po = document.createElement('option');
      po.value = 'prev';
      po.textContent = 'previously loaded chain';
      sel.appendChild(po);
    }
    left.appendChild(sel);
    var loadRef = makeEl('button', 'Load reference to board', 'ap-btn');
    loadRef.style.marginTop = '6px';
    loadRef.onclick = function () {
      if (sel.value === 'prev' && lastLoadedNodes) {
        window.ChainCanvas.loadModel(lastLoadedNodes, null, { freshSeats: true });
        return;
      }
      var fname = sel.value.replace(/^factory:/, '');
      factory.forEach(function (fp) {
        if (fp.name === fname) { loadToBoard(fp); }
      });
    };
    left.appendChild(loadRef);
    grid.appendChild(left);

    // RIGHT: the candidate under judgment.
    var right = makeEl('div', null, null);
    right.style.cssText = 'border:1px solid #3a3f4c; border-radius:8px; padding:12px;';
    right.appendChild(makeEl('div', 'CANDIDATE', 'ap-muted'));
    var nm = makeEl('div', preset.name, null);
    nm.style.cssText = 'font-weight:600; font-size:18px; margin:6px 0 2px;';
    right.appendChild(nm);
    right.appendChild(makeEl('div', preset.description, 'ap-muted'));
    right.appendChild(makeEl('div', nodeChips(preset), 'ap-chips'));
    var loadCand = makeEl('button', 'Load candidate to board', 'ap-btn');
    loadCand.style.marginTop = '8px';
    loadCand.onclick = function () { loadToBoard(preset); };
    right.appendChild(loadCand);
    right.appendChild(verdictRow(preset, function () {
      if (cursor < CANDIDATES.length - 1) { cursor++; }
      renderDuel();
    }));
    grid.appendChild(right);

    card.appendChild(grid);

    var transport = makeEl('div', null, null);
    transport.style.cssText = 'display:flex; gap:10px; margin-top:14px; align-items:center;';
    var vocalBtn = makeEl('button', 'Play raw test vocal', 'ap-btn');
    vocalBtn.onclick = function () { playRawTestVocal(); };
    var step = makeEl('button', 'next candidate →', 'ap-btn');
    step.onclick = function () { if (cursor < CANDIDATES.length - 1) { cursor++; renderDuel(); } };
    transport.appendChild(vocalBtn);
    transport.appendChild(step);
    var score = makeEl('div',
      'accepted ' + verdictCount('accepted') + ' · rejected ' + verdictCount('rejected'),
      'ap-muted');
    transport.appendChild(score);
    card.appendChild(transport);

    var open = makeEl('div',
      'OPEN QUESTIONS this variant poses: (1) the test vocal plays RAW, not through the chain — ' +
      'does the real harness need through-chain playback (engine aux input), or is live mic + ' +
      'raw reference enough? (2) is auditioning comparative (vs a reference) or absolute?',
      'ap-muted');
    open.style.cssText = 'margin-top:14px; border-top:1px solid #2a2f3a; padding-top:10px; max-width:70ch;';
    card.appendChild(open);

    wrap.appendChild(card);
    r.appendChild(wrap);
    document.onkeydown = null;
  }

  // ------------------------------------------------------------- switcher bar

  var VARIANTS = [
    { key: 'A', name: 'Booth — one at a time, keyboard-first', render: renderBooth },
    { key: 'B', name: 'Sheet — batch manager, inline verdicts', render: renderSheet },
    { key: 'C', name: 'Duel — candidate vs reference', render: renderDuel }
  ];

  function currentVariantKey() {
    var m = window.location.search.match(/[?&]variant=([ABC])/);
    return m ? m[1] : 'A';
  }

  function setVariant(key) {
    var search = window.location.search.replace(/[?&]variant=[ABC]/, '');
    var q = (search.indexOf('?') === 0 ? search.slice(1) : search.replace(/^\?/, ''));
    var params = [];
    if (window.location.search.indexOf('audition') !== -1) { params.push('audition=1'); }
    if (q) { params.push(q); }
    params.push('variant=' + key);
    window.history.replaceState(null, '', window.location.pathname + '?' + params.join('&'));
    render();
  }

  function render() {
    var key = currentVariantKey();
    var def = VARIANTS.filter(function (v) { return v.key === key; })[0] || VARIANTS[0];
    def.render();

    var bar = document.getElementById('audition-proto-switcher') || makeEl('div', null, null);
    bar.id = 'audition-proto-switcher';
    bar.textContent = '';
    bar.style.cssText = 'position:fixed; bottom:18px; left:50%; transform:translateX(-50%);' +
      'background:#000; color:#fff; border:1px solid #666; border-radius:999px;' +
      'padding:10px 16px; display:flex; gap:14px; align-items:center; z-index:9100;' +
      'font-size:14px; box-shadow:0 4px 16px rgba(0,0,0,.5);';
    var left = makeEl('button', '←', null);
    var label = makeEl('span', key + ' · ' + def.name, null);
    var right = makeEl('button', '→', null);
    [left, right].forEach(function (b) {
      b.style.cssText = 'background:none; border:none; color:#fff; font-size:18px; cursor:pointer;';
    });
    left.onclick = function () {
      var i = VARIANTS.indexOf(def);
      setVariant(VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length].key);
    };
    right.onclick = function () {
      var i = VARIANTS.indexOf(def);
      setVariant(VARIANTS[(i + 1) % VARIANTS.length].key);
    };
    bar.appendChild(left);
    bar.appendChild(label);
    bar.appendChild(right);
    document.body.appendChild(bar);

    var notice = document.getElementById('audition-proto-notice') || makeEl('div', null, 'ap-notice');
    notice.id = 'audition-proto-notice';
    refreshEngineNotice(notice);
    document.body.appendChild(notice);
  }

  sharedStyles();
  render();

  // Arrow keys cycle variants (never while typing — UI.md rule).
  window.addEventListener('keydown', function (e) {
    if (e.target && (/INPUT|TEXTAREA/.test(e.target.tagName) ||
        (e.target.getAttribute && e.target.getAttribute('contenteditable')))) { return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      var key = currentVariantKey();
      var i = VARIANTS.indexOf(VARIANTS.filter(function (v) { return v.key === key; })[0]);
      var nextKey = e.key === 'ArrowRight'
        ? VARIANTS[(i + 1) % VARIANTS.length].key
        : VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length].key;
      setVariant(nextKey);
    }
  });

  window.AuditionPrototype = {
    variant: currentVariantKey,
    verdicts: verdicts,
    provenanceJSON: provenanceJSON
  };
})();
