// Simple view — the switch, the shell, and the sound library
// (wayfinder #47 and #48, map #43).
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of this project. Depends on window.AudioGraph
// (src/audio-graph.js), window.EffectCatalog (src/effect-catalog.js),
// window.PresetsUI (src/presets-ui.js), window.FactoryPresets
// (src/factory-presets.js), and window.PresetStore (src/preset-store.js)
// — all already loaded by the time this file runs, per index.html's script
// order. Every dependency is read defensively (typeof checks) so a
// bare-harness load or a future restructuring degrades to an empty/neutral
// render rather than throwing.
//
// THREE responsibilities:
//
//   1. The Simple/Advanced switch. Presentation-only, exactly as settled on
//      map #43: switchTo() only ever touches document.body's class list and
//      the two button's aria-checked state — it never calls
//      ChainEditing.apply, never touches AudioGraph, never reloads a
//      preset. The persisted preference lives under its own localStorage
//      key (VIEW_KEY below), read once at load; absent or unrecognized
//      means Simple (settled #43). Agent actions never call switchTo() —
//      there is no code path from src/mcp-tools.js into this file at all.
//
//   2. The Simple shell's Current-sound stage. Reads the SAME live state
//      Advanced already tracks — window.AudioGraph.getModel() for the
//      chain, window.PresetsUI.getDisplayState() for the name/unsaved
//      state presets-ui.js already maintains — rather than re-deriving
//      any of it. renderStage() is called once at load and again every
//      time window.SimpleView.onChainChanged() fires (src/chain-editing.js
//      calls it from markAcceptedEdit(), the ONE choke point every
//      accepted edit — human, agent, preset load, structural or the
//      param-only fast path — already passes through), so the stage stays
//      live even while Simple sits in the background behind Advanced, or
//      while an agent is the one making the edit (the map's own scene: "an
//      agent building a chain while the user sits in Simple leaves them in
//      Simple, watching Current sound become Custom sound").
//
//   3. The Sounds library (wayfinder #48): plain filter chips as named
//      queries over the SAME tags #26/#28's taxonomy already carries on
//      factory presets — stored nowhere new, defined once in
//      PLAIN_FILTERS below — plus a name/description/tag search, Factory
//      and Yours as separate card groups, and the stage's Previous/Next
//      transport stepping the filtered factory list. A card's Try button
//      submits through window.PresetsUI.loadFactoryPreset/loadUserPreset
//      — the SAME applyLoadedPreset() -> ChainEditing.apply() transaction
//      Advanced's own Presets panel rows already use (presets-ui.js's own
//      export comment), so there remains exactly one load path.
//
// "Save this sound" and Custom-sound save flow are #49's. This file does
// not reach into either.
(function () {
  'use strict';

  var VIEW_KEY = 'karaoke-view-v1';

  var simpleBtn = document.getElementById('view-switch-simple');
  var advancedBtn = document.getElementById('view-switch-advanced');
  var nameEl = document.getElementById('simple-cs-name');
  var descEl = document.getElementById('simple-desc');
  var summaryEl = document.getElementById('simple-summary');
  var libraryBodyEl = document.getElementById('simple-library-body');
  var transportEl = document.getElementById('simple-transport');

  if (!simpleBtn || !advancedBtn || !nameEl || !descEl || !summaryEl ||
      !libraryBodyEl || !transportEl) {
    // Shell markup isn't present (e.g. not yet built, or restructured
    // again by a later task) — nothing to wire up.
    return;
  }

  // -----------------------------------------------------------------
  // The switch.
  // -----------------------------------------------------------------

  function readStoredView() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(VIEW_KEY) : null;
      return raw === 'advanced' ? 'advanced' : 'simple';
    } catch (err) {
      // Storage unavailable (private browsing, disabled cookies) —
      // degrade to the settled default rather than throwing.
      return 'simple';
    }
  }

  function writeStoredView(view) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(VIEW_KEY, view);
      }
    } catch (err) {
      // Write failed (quota, disabled storage) — the switch still applies
      // for this session; it just won't survive reload. Never block the
      // switch itself on a storage failure.
    }
  }

  function applyView(view) {
    document.body.classList.toggle('view-advanced', view === 'advanced');
    simpleBtn.setAttribute('aria-checked', view === 'simple' ? 'true' : 'false');
    advancedBtn.setAttribute('aria-checked', view === 'advanced' ? 'true' : 'false');
  }

  function switchTo(view) {
    applyView(view);
    writeStoredView(view);
  }

  simpleBtn.addEventListener('click', function () {
    switchTo('simple');
  });
  advancedBtn.addEventListener('click', function () {
    switchTo('advanced');
  });

  applyView(readStoredView());

  // -----------------------------------------------------------------
  // The Current-sound stage.
  // -----------------------------------------------------------------

  function currentChain() {
    return (window.AudioGraph && typeof window.AudioGraph.getModel === 'function')
      ? window.AudioGraph.getModel()
      : [];
  }

  function displayState() {
    return (window.PresetsUI && typeof window.PresetsUI.getDisplayState === 'function')
      ? window.PresetsUI.getDisplayState()
      : { name: null, modified: false };
  }

  // A named preset's own one-line description, by exact name match
  // against the SAME factory list the Advanced Presets panel reads — this
  // file adds no description text of its own. User presets carry no
  // description field (a deliberate v1 scope cut, presets-ui.js's own
  // header note), so a Yours name simply shows no description line here.
  function factoryDescription(name) {
    if (!name || !window.FactoryPresets || typeof window.FactoryPresets.describeAll !== 'function') {
      return '';
    }
    var entries = window.FactoryPresets.describeAll();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].name === name) {
        return entries[i].description || '';
      }
    }
    return '';
  }

  function plainLabel(type) {
    if (window.EffectCatalog && typeof window.EffectCatalog.getPlainLabel === 'function') {
      var label = window.EffectCatalog.getPlainLabel(type);
      if (label) {
        return label;
      }
    }
    return type;
  }

  function technicalLabel(type) {
    if (window.EffectCatalog && typeof window.EffectCatalog.getLabel === 'function') {
      var label = window.EffectCatalog.getLabel(type);
      if (label) {
        return label;
      }
    }
    return type;
  }

  function familyVars(type) {
    return '--fam:var(--family-' + type + ');--famPrint:var(--pm-family-' + type + ')';
  }

  function renderSummary(chain) {
    summaryEl.innerHTML = '';
    if (chain.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'simple-summary-empty';
      empty.textContent = 'Press Start to power on';
      summaryEl.appendChild(empty);
      return;
    }
    chain.forEach(function (node) {
      var row = document.createElement('li');
      row.setAttribute('style', familyVars(node.type));

      var legend = document.createElement('span');
      legend.className = 'simple-summary-legend';
      legend.setAttribute('aria-hidden', 'true');

      var plain = document.createElement('span');
      plain.className = 'simple-summary-plain';
      plain.textContent = plainLabel(node.type);

      var tech = document.createElement('span');
      tech.className = 'simple-summary-tech';
      tech.textContent = technicalLabel(node.type);

      row.appendChild(legend);
      row.appendChild(plain);
      row.appendChild(tech);
      summaryEl.appendChild(row);
    });
  }

  function renderStage() {
    var chain = currentChain();
    var state = displayState();
    var name = state.name || 'Custom sound';

    nameEl.textContent = '';
    nameEl.appendChild(document.createTextNode(name));
    // Only the reliably-true marker ships here: "unsaved changes" means
    // exactly what presets-ui.js's own modified flag means everywhere
    // else in the app. A fresh, never-named boot chain (name=null,
    // modified=false) is indistinguishable from an agent's freshly-built
    // one at this layer — presets-ui.js tracks no provenance to tell
    // them apart — so it reads plainly as "Custom sound" with no claim
    // about who built it. Naming that distinction (and any "built by
    // your agent" framing) is wayfinder #49's job, not this shell's.
    if (state.modified) {
      var marker = document.createElement('span');
      marker.className = 'simple-cs-state';
      marker.textContent = ' · unsaved changes';
      nameEl.appendChild(marker);
    }

    var description = factoryDescription(state.name);
    if (description) {
      descEl.textContent = description;
      descEl.hidden = false;
    } else {
      descEl.textContent = '';
      descEl.hidden = true;
    }

    renderSummary(chain);
  }

  // -----------------------------------------------------------------
  // The Sounds library (wayfinder #48).
  // -----------------------------------------------------------------

  // Plain filters — named queries over the SAME public tags #26/#28's
  // taxonomy already carries (factory-library-data.js), defined HERE
  // and stored nowhere on presets (settled #43). A filter that matches
  // nothing is a visible coverage gap, rendered as such below — not a
  // bug to fix in this file.
  var PLAIN_FILTERS = [
    { id: 'all', label: 'All', test: function () { return true; } },
    { id: 'warm', label: 'Warm', test: function (tags) { return tags.indexOf('vibe:warm') !== -1; } },
    { id: 'rock', label: 'Rock', test: function (tags) { return tags.indexOf('genre:Rock') !== -1; } },
    { id: 'funny', label: 'Funny', test: function (tags) {
      return tags.some(function (t) { return t.indexOf('gag:') === 0; });
    } },
    { id: 'speech', label: 'Speech', test: function (tags) { return tags.indexOf('use-case:speech/hosting') !== -1; } }
  ];

  var libraryState = { filter: 'all', query: '' };
  var chipEls = {};
  var cardsListEl = null;
  var chipCountEl = null;

  function factoryEntries() {
    return (window.FactoryPresets && typeof window.FactoryPresets.listDetailed === 'function')
      ? window.FactoryPresets.listDetailed()
      : [];
  }

  function userNames() {
    var names = (window.PresetStore && typeof window.PresetStore.listNames === 'function')
      ? window.PresetStore.listNames()
      : [];
    return names.slice().sort();
  }

  // The public taxonomy axes only (genre/vibe/use-case/gag) — the
  // internal technique axis is for coverage/dedup, never user-facing
  // (settled #43's Technique axis entry), so it never reaches a card.
  function publicTags(tags) {
    return (tags || []).filter(function (t) { return t.indexOf('technique:') !== 0; });
  }

  function activeFilter() {
    var match = PLAIN_FILTERS.filter(function (f) { return f.id === libraryState.filter; })[0];
    return match || PLAIN_FILTERS[0];
  }

  function matchesQuery(haystack) {
    var q = libraryState.query.trim().toLowerCase();
    return !q || haystack.toLowerCase().indexOf(q) !== -1;
  }

  function filteredFactory() {
    var filter = activeFilter();
    return factoryEntries().filter(function (p) {
      if (!filter.test(p.tags || [])) {
        return false;
      }
      return matchesQuery([p.name, p.description, publicTags(p.tags).join(' ')].join(' '));
    });
  }

  // Yours is unfiltered by the plain-filter chips (settled #43 / the #45
  // spec) — search still narrows it, since the ticket asks for search
  // "across name / description / tags" on the whole library.
  function filteredUserNames() {
    return userNames().filter(function (name) { return matchesQuery(name); });
  }

  function buildCard(name, description, tags, kind, isActive) {
    var row = document.createElement('div');
    row.className = 'preset-row';
    if (isActive) {
      row.classList.add('preset-row-active');
    }

    var loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'preset-row-load';

    var nameSpan = document.createElement('span');
    nameSpan.className = 'preset-row-name';
    nameSpan.textContent = name;
    loadBtn.appendChild(nameSpan);

    if (description) {
      var previewSpan = document.createElement('span');
      previewSpan.className = 'preset-row-preview';
      previewSpan.textContent = description;
      loadBtn.appendChild(previewSpan);
    }

    if (tags && tags.length) {
      var tagsSpan = document.createElement('span');
      tagsSpan.className = 'preset-row-tags';
      tagsSpan.setAttribute('aria-hidden', 'true');
      tagsSpan.textContent = tags.map(function (t) {
        var i = t.indexOf(':');
        return i === -1 ? t : t.slice(i + 1);
      }).join(' · ');
      loadBtn.appendChild(tagsSpan);
    }

    // "Try a preset" (CONTEXT.md's settled verb): submits through the
    // SAME load path Advanced's own Presets panel rows use — see this
    // file's header and presets-ui.js's export comment. No Delete or
    // other secondary action here yet (wayfinder #49's job).
    loadBtn.addEventListener('click', function () {
      if (!window.PresetsUI) {
        return;
      }
      if (kind === 'factory' && typeof window.PresetsUI.loadFactoryPreset === 'function') {
        window.PresetsUI.loadFactoryPreset(name);
      } else if (kind === 'user' && typeof window.PresetsUI.loadUserPreset === 'function') {
        window.PresetsUI.loadUserPreset(name);
      }
    });

    row.appendChild(loadBtn);
    return row;
  }

  function buildGroupLabel(text) {
    var label = document.createElement('div');
    label.className = 'preset-group-label';
    label.textContent = text;
    return label;
  }

  function buildEmptyNote(text) {
    var note = document.createElement('p');
    note.className = 'preset-list-empty';
    note.textContent = text;
    return note;
  }

  function renderLibraryList() {
    Object.keys(chipEls).forEach(function (id) {
      var on = id === libraryState.filter;
      chipEls[id].classList.toggle('simple-chip-on', on);
      chipEls[id].setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var allFactory = factoryEntries();
    var factory = filteredFactory();
    if (chipCountEl) {
      chipCountEl.textContent = factory.length + ' of ' + allFactory.length;
    }

    var currentName = displayState().name;

    cardsListEl.innerHTML = '';
    cardsListEl.appendChild(buildGroupLabel('Factory'));
    if (factory.length === 0) {
      cardsListEl.appendChild(buildEmptyNote(
        'No factory sounds match — a coverage gap for the library to fill, not a Simple-view bug.'
      ));
    } else {
      factory.forEach(function (p) {
        cardsListEl.appendChild(
          buildCard(p.name, p.description, publicTags(p.tags), 'factory', p.name === currentName)
        );
      });
    }

    cardsListEl.appendChild(buildGroupLabel('Yours'));
    var allUserNames = userNames();
    var yours = filteredUserNames();
    if (yours.length === 0) {
      cardsListEl.appendChild(buildEmptyNote(
        allUserNames.length === 0 ? 'Sounds you save will show up here.' : 'Nothing of yours matches that search.'
      ));
    } else {
      yours.forEach(function (name) {
        cardsListEl.appendChild(buildCard(name, '', [], 'user', name === currentName));
      });
    }

    renderTransport();
  }

  function currentFactoryPosition(list) {
    var currentName = displayState().name;
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === currentName) {
        return i;
      }
    }
    return -1;
  }

  function stepFactory(direction) {
    var list = filteredFactory();
    if (list.length === 0) {
      return;
    }
    var pos = currentFactoryPosition(list);
    var nextIndex = pos < 0
      ? (direction > 0 ? 0 : list.length - 1)
      : (pos + direction + list.length) % list.length;
    if (window.PresetsUI && typeof window.PresetsUI.loadFactoryPreset === 'function') {
      window.PresetsUI.loadFactoryPreset(list[nextIndex].name);
    }
  }

  function renderTransport() {
    transportEl.innerHTML = '';
    var list = filteredFactory();
    var pos = currentFactoryPosition(list);

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'control';
    prevBtn.textContent = '◀ Previous';
    prevBtn.disabled = list.length < 2;
    prevBtn.addEventListener('click', function () { stepFactory(-1); });

    var posSpan = document.createElement('span');
    posSpan.className = 'simple-transport-pos';
    posSpan.textContent = list.length === 0 ? '–' : (pos < 0 ? '·' : (pos + 1) + ' / ' + list.length);

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'control';
    nextBtn.textContent = 'Next ▶';
    nextBtn.disabled = list.length < 2;
    nextBtn.addEventListener('click', function () { stepFactory(1); });

    transportEl.appendChild(prevBtn);
    transportEl.appendChild(posSpan);
    transportEl.appendChild(nextBtn);
  }

  function buildLibraryShell() {
    var chipsRow = document.createElement('div');
    chipsRow.className = 'simple-chips';
    chipsRow.setAttribute('role', 'group');
    chipsRow.setAttribute('aria-label', 'Plain filters');

    PLAIN_FILTERS.forEach(function (f) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'simple-chip';
      chip.textContent = f.label;
      chip.setAttribute('aria-pressed', f.id === libraryState.filter ? 'true' : 'false');
      chip.addEventListener('click', function () {
        libraryState.filter = f.id;
        renderLibraryList();
      });
      chipEls[f.id] = chip;
      chipsRow.appendChild(chip);
    });

    chipCountEl = document.createElement('span');
    chipCountEl.className = 'simple-chip-count';
    chipsRow.appendChild(chipCountEl);
    libraryBodyEl.appendChild(chipsRow);

    var search = document.createElement('input');
    search.type = 'text';
    search.className = 'control preset-search';
    search.placeholder = 'Search sounds…';
    search.setAttribute('aria-label', 'Search sounds');
    search.addEventListener('input', function () {
      libraryState.query = search.value;
      renderLibraryList();
    });
    libraryBodyEl.appendChild(search);

    cardsListEl = document.createElement('div');
    cardsListEl.className = 'preset-list';
    libraryBodyEl.appendChild(cardsListEl);
  }

  function renderAll() {
    renderStage();
    renderLibraryList();
  }

  buildLibraryShell();
  renderAll();

  window.SimpleView = {
    onChainChanged: renderAll
  };
})();
