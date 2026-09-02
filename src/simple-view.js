// Simple view — the switch, the shell, and the sound library
// (wayfinder #47 and #48, map #43).
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of this project. Depends on window.AudioEngine
// (src/audio-engine.js), window.AudioGraph (src/audio-graph.js),
// window.EffectCatalog (src/effect-catalog.js),
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
  var libraryGateNoteEl = document.getElementById('simple-library-gate-note');
  var transportEl = document.getElementById('simple-transport');
  var saveBtnEl = document.getElementById('simple-save-btn');
  var saveRowEl = document.getElementById('simple-save-row');

  if (!simpleBtn || !advancedBtn || !nameEl || !descEl || !summaryEl ||
      !libraryBodyEl || !libraryGateNoteEl || !transportEl || !saveBtnEl || !saveRowEl) {
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

  // Match main.js's one truthful live predicate. `isStarted` alone is not
  // enough: a lost track or suspended context cannot accept a human preset
  // load, so Simple must close the same mutation paths Advanced closes.
  function engineIsLive() {
    var engine = window.AudioEngine;
    var audioContext = engine && engine.audioContext;
    var trackLive = !!engine && engine.isTrackLive !== false;
    return !!(
      engine && engine.isStarted && trackLive &&
      audioContext && audioContext.state === 'running'
    );
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
    if (!engineIsLive()) {
      summaryEl.hidden = true;
      return;
    }
    summaryEl.hidden = false;
    if (chain.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'simple-summary-empty';
      empty.textContent = 'No effects in this sound';
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

  // wayfinder #49 — whether the inline "Save this sound" naming row is
  // currently open, and the input it owns (built once, lazily).
  var saveRowOpen = false;
  var saveNameInputEl = null;
  var saveNoteEl = null;

  // An unsaved sound (settled #43): either a named preset that has since
  // drifted (modified), or no preset loaded at all (Custom sound). This
  // is the ONE condition "Save this sound" and the secondary-menu-vs-
  // directly-visible-Delete choice both key off.
  function isUnsaved(state) {
    return !!state.modified || !state.name;
  }

  function closeSaveRow() {
    saveRowOpen = false;
    saveRowEl.hidden = true;
    saveRowEl.innerHTML = '';
    saveNameInputEl = null;
    saveNoteEl = null;
  }

  function commitSaveRow() {
    if (!saveNameInputEl || !window.PresetsUI || typeof window.PresetsUI.saveCurrentChainAs !== 'function') {
      return;
    }
    var result = window.PresetsUI.saveCurrentChainAs(saveNameInputEl.value);
    if (!result.ok) {
      if (saveNoteEl) {
        saveNoteEl.textContent = result.message;
        saveNoteEl.hidden = false;
      }
      return;
    }
    closeSaveRow();
    renderAll();
  }

  // Reuses Advanced's own inline naming-row classes verbatim
  // (.preset-name-row/.preset-name-input/.preset-name-actions,
  // styles/main.css) — the same "no browser prompt()" naming control
  // Save As… already uses, so Simple's own save flow looks and behaves
  // like one app, not two.
  function openSaveRow() {
    var state = displayState();
    saveRowEl.innerHTML = '';
    saveRowEl.className = 'simple-save-row preset-name-row';
    saveRowOpen = true;
    saveRowEl.hidden = false;

    var nameLabel = document.createElement('label');
    nameLabel.className = 'preset-name-label';
    nameLabel.textContent = 'Sound name';
    nameLabel.setAttribute('for', 'simple-sound-name-input');

    saveNameInputEl = document.createElement('input');
    saveNameInputEl.type = 'text';
    saveNameInputEl.id = 'simple-sound-name-input';
    saveNameInputEl.className = 'preset-name-input';
    saveNameInputEl.maxLength = 40;
    saveNameInputEl.value = state.name || '';
    saveNameInputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        commitSaveRow();
      } else if (event.key === 'Escape') {
        closeSaveRow();
      }
    });

    var actions = document.createElement('div');
    actions.className = 'preset-name-actions';

    var confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'control';
    confirmBtn.textContent = 'Save';
    confirmBtn.addEventListener('click', commitSaveRow);

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'control';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', closeSaveRow);

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);

    saveNoteEl = document.createElement('p');
    saveNoteEl.className = 'simple-save-note';
    saveNoteEl.hidden = true;

    saveRowEl.appendChild(nameLabel);
    saveRowEl.appendChild(saveNameInputEl);
    saveRowEl.appendChild(actions);
    saveRowEl.appendChild(saveNoteEl);

    if (typeof saveNameInputEl.focus === 'function') {
      saveNameInputEl.focus();
    }
    if (typeof saveNameInputEl.select === 'function') {
      saveNameInputEl.select();
    }
  }

  saveBtnEl.addEventListener('click', function () {
    if (!engineIsLive()) {
      return;
    }
    if (saveRowOpen) {
      closeSaveRow();
    } else {
      openSaveRow();
    }
  });

  function renderStage() {
    var chain = currentChain();
    var state = displayState();
    var engineLive = engineIsLive();
    var name = engineLive ? (state.name || 'Custom sound') : 'Ready to start';

    nameEl.textContent = '';
    nameEl.appendChild(document.createTextNode(name));
    // Only the reliably-true marker ships here: "unsaved changes" means
    // exactly what presets-ui.js's own modified flag means everywhere
    // else in the app. A fresh, never-named boot chain (name=null,
    // modified=false) is indistinguishable from an agent's freshly-built
    // one at this layer — presets-ui.js tracks no provenance to tell
    // them apart — so it reads plainly as "Custom sound" with no claim
    // about who built it (settled #43: Custom sound's own definition
    // makes the same call — "agent-built, or hand-edited in Advanced,"
    // named the same way either way).
    if (engineLive && state.modified) {
      var marker = document.createElement('span');
      marker.className = 'simple-cs-state';
      marker.textContent = ' · unsaved changes';
      nameEl.appendChild(marker);
    }

    // "Save this sound" beside the name, shown ONLY for an unsaved sound
    // (settled #43) — never in the secondary menu, since stepping away
    // with Previous/Next is what puts an unsaved sound at risk. Closing
    // an open row when the state moves out of "unsaved" on its own
    // (e.g. Undo, or the same preset reloading elsewhere) avoids a stale
    // naming row hanging open over a now-clean sound.
    var unsaved = isUnsaved(state);
    saveBtnEl.disabled = !engineLive;
    saveBtnEl.hidden = !engineLive || !unsaved;
    if ((!engineLive || !unsaved) && saveRowOpen) {
      closeSaveRow();
    }

    var description = engineLive ? factoryDescription(state.name) : '';
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
  // and stored nowhere on presets (settled #43). A filter or search that
  // matches nothing gets its own plain no-results message below.
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
  // wayfinder #49 — which Yours cards currently show their opened
  // secondary menu (Delete) instead of the plain "…" toggle. Keyed by
  // name, not index, so it survives a re-render even if the list's
  // order changes; a deleted preset's own entry is removed explicitly
  // (see the Delete click handler below) rather than lingering forever.
  var openCardMenus = {};
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

  function buildCard(name, description, kind, isActive) {
    var row = document.createElement('div');
    row.className = 'preset-row';
    if (isActive) {
      row.classList.add('preset-row-active');
    }

    var loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'preset-row-load';
    loadBtn.disabled = !engineIsLive();
    if (loadBtn.disabled) {
      loadBtn.setAttribute('aria-describedby', 'simple-library-gate-note');
    }

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

    // "Try a preset" (CONTEXT.md's settled verb): submits through the
    // SAME load path Advanced's own Presets panel rows use — see this
    // file's header and presets-ui.js's export comment.
    loadBtn.addEventListener('click', function () {
      if (!engineIsLive() || !window.PresetsUI) {
        return;
      }
      if (kind === 'factory' && typeof window.PresetsUI.loadFactoryPreset === 'function') {
        window.PresetsUI.loadFactoryPreset(name);
      } else if (kind === 'user' && typeof window.PresetsUI.loadUserPreset === 'function') {
        window.PresetsUI.loadUserPreset(name);
      }
    });

    row.appendChild(loadBtn);

    // wayfinder #49 — "Delete and future transfer actions [go] in a
    // secondary menu so they do not compete with trying presets"
    // (settled #43). A Yours card's second slot is either the plain "…"
    // toggle or, once opened, the real Delete button — never both at
    // once, so it never visually competes with Try the way a directly-
    // visible Delete label would. Delete itself reuses toggleDeleteArm's
    // exact two-step arm/confirm — the same gesture and the same shared
    // armed-button state Advanced's own rows use (presets-ui.js's export
    // comment), so there is still exactly one delete path.
    if (kind === 'user') {
      if (openCardMenus[name]) {
        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'preset-row-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', function () {
          if (!window.PresetsUI || typeof window.PresetsUI.toggleDeleteArm !== 'function') {
            return;
          }
          // toggleDeleteArm mutates deleteBtn's own label/class in place
          // for the arm step and for a failed delete — re-rendering here
          // would just discard that armed state, since a fresh render
          // recreates the button unarmed. Only a confirmed deletion
          // (true) needs a rebuild — and the FULL renderAll(), not just
          // the library list: deleting the sound currently shown as
          // Current sound resets PresetsUI's display state (name to
          // null) without ever touching ChainEditing/the live chain, so
          // this is the one write path that reaches PresetsUI without
          // passing through markAcceptedEdit()'s own SimpleView notify —
          // the stage needs its own explicit refresh here.
          if (window.PresetsUI.toggleDeleteArm(deleteBtn, name)) {
            delete openCardMenus[name];
            renderAll();
          }
        });
        row.appendChild(deleteBtn);
      } else {
        var menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'simple-card-menu-toggle';
        menuBtn.textContent = '⋯';
        menuBtn.setAttribute('aria-label', 'More actions for ' + name);
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.addEventListener('click', function () {
          openCardMenus[name] = true;
          renderLibraryList();
        });
        row.appendChild(menuBtn);
      }
    }

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
    libraryGateNoteEl.hidden = engineIsLive();

    Object.keys(chipEls).forEach(function (id) {
      var on = id === libraryState.filter;
      chipEls[id].classList.toggle('simple-chip-on', on);
      chipEls[id].setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var allFactory = factoryEntries();
    var factory = filteredFactory();
    if (chipCountEl) {
      var narrowed = libraryState.filter !== 'all' || !!libraryState.query.trim();
      chipCountEl.hidden = !narrowed;
      chipCountEl.textContent = narrowed ? factory.length + ' of ' + allFactory.length : '';
    }

    var currentName = displayState().name;

    cardsListEl.innerHTML = '';
    cardsListEl.appendChild(buildGroupLabel('Factory'));
    if (factory.length === 0) {
      var emptyFactoryCopy = libraryState.query.trim()
        ? 'No factory sounds match your search.'
        : (libraryState.filter === 'all'
          ? 'No factory sounds are available.'
          : 'No factory sounds match this filter.');
      cardsListEl.appendChild(buildEmptyNote(
        emptyFactoryCopy
      ));
    } else {
      factory.forEach(function (p) {
        cardsListEl.appendChild(
          buildCard(p.name, p.description, 'factory', p.name === currentName)
        );
      });
    }

    var allUserNames = userNames();
    if (allUserNames.length > 0) {
      cardsListEl.appendChild(buildGroupLabel('Yours'));
      var yours = filteredUserNames();
      if (yours.length === 0) {
        cardsListEl.appendChild(buildEmptyNote('No saved sounds match your search.'));
      } else {
        yours.forEach(function (name) {
          cardsListEl.appendChild(buildCard(name, '', 'user', name === currentName));
        });
      }
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
    if (!engineIsLive()) {
      return;
    }
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
    transportEl.hidden = !engineIsLive();
    if (transportEl.hidden) {
      return;
    }
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
    search.placeholder = 'Search by name, style, or use…';
    search.setAttribute('aria-label', 'Search sounds by name, style, or use');
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
    onChainChanged: renderAll,
    onEngineStarted: renderAll,
    onEngineStopped: renderAll
  };
})();
