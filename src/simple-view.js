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
  // The stage element itself, so renderStage() can carry the pre-Start
  // gate on it (the shared hatch + recede — styles/main.css's DISABLED
  // TEXTURE block). Read defensively and kept OUT of the bail check
  // below: a missing stage wrapper costs the visual gate, nothing
  // functional, so it must not take the whole view down with it.
  var stageEl = document.getElementById('simple-stage');
  // The cold face's mount point (index.html's #simple-cold-face). Read
  // defensively and kept OUT of the bail check below for the same reason
  // stageEl is: a missing mount costs the pre-Start print, nothing
  // functional, so it must not take the whole view down with it.
  var coldFaceEl = document.getElementById('simple-cold-face');

  // The gate note's SHIPPED copy, captured once so the click feedback
  // below can name a specific sound and then put the standing sentence
  // back. Reading it from the element keeps the default wording in
  // index.html — one place, not two that can drift.
  var DEFAULT_GATE_NOTE = libraryGateNoteEl.textContent;
  // Cleared on every re-render and whenever the engine goes live, so a
  // flash can never outlive the state that caused it.
  var gateFlashTimer = null;

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
    // Roving tabindex — the keyboard half of the radiogroup contract the
    // role above declares: Tab reaches the group once, landed on its
    // checked member; the unchecked member is reached with the arrow
    // keys below, not another tab stop.
    simpleBtn.setAttribute('tabindex', view === 'simple' ? '0' : '-1');
    advancedBtn.setAttribute('tabindex', view === 'advanced' ? '0' : '-1');
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

  // Arrow keys, the other keyboard half: ARIA radios are selected with
  // arrows and selection follows focus, exactly as a native two-radio
  // group behaves (every arrow moves to the other member, wrapping
  // included — with two options Up/Left and Down/Right all cross the
  // same one gap). preventDefault keeps the arrows from scrolling the
  // page under the operator instead of working the switch.
  [simpleBtn, advancedBtn].forEach(function (btn) {
    btn.addEventListener('keydown', function (event) {
      var key = event && event.key;
      if (key !== 'ArrowLeft' && key !== 'ArrowRight' &&
          key !== 'ArrowUp' && key !== 'ArrowDown') {
        return;
      }
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      var target = btn === simpleBtn ? 'advanced' : 'simple';
      switchTo(target);
      var next = target === 'advanced' ? advancedBtn : simpleBtn;
      if (next && typeof next.focus === 'function') {
        next.focus();
      }
    });
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

  // Emergency-bypass truth, from the same single source the deck key and
  // the Advanced canvas read (window.AudioBypass.isEngaged) — guarded so
  // a stripped harness answers "not engaged" rather than throwing on the
  // stage path.
  function bypassEngaged() {
    try {
      return !!(
        window.AudioBypass &&
        typeof window.AudioBypass.isEngaged === 'function' &&
        window.AudioBypass.isEngaged()
      );
    } catch (err) {
      return false;
    }
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

  // -----------------------------------------------------------------
  // THE COLD FACE (2026-09-02 delight round).
  //
  // Before Start the stage has no live sound to name, and it used to say
  // so with three grey words alone in the middle of a hatched
  // rectangle. This is what stands there instead: the instrument's own
  // COLD FACEPLATE, printed with the chain that is already loaded and
  // waiting for the engine — a machined patchbay strip running MIC IN to
  // OUT with one silkscreen plate per section, in that section's family
  // ink.
  //
  // It is not a degraded copy of the live face. The live face answers
  // "what am I hearing"; the cold face answers "what is this machine
  // holding" — a question that HAS a true answer before Start, which is
  // why the stage no longer has to stand empty. The pre-Start hatch
  // stays exactly where the gate round put it: the recede over this
  // print IS the powered-down reading, and Start lifting it is the
  // power-up.
  //
  // Everything on it is READ, never invented:
  //   - the chain is window.Persistence.loadInitialModel() — the exact
  //     array src/main.js hands to ChainEditing the moment Start
  //     resolves, so the strip is a promise the next second keeps. That
  //     call is a pure read (src/persistence.js writes nothing and
  //     documents itself as re-readable), and its answer cannot change
  //     before Start because nothing writes the autosave slot until the
  //     engine is live — so it is read ONCE and cached, and the cache is
  //     dropped when the engine goes live so a stop/restart re-reads.
  //   - the NAME is a structural match against the factory library (same
  //     types, same params, same order). A match names the sound; no
  //     match is honestly "your last chain". A never-run profile matches
  //     Classic Karaoke by construction, since loadInitialModel()
  //     returns exactly DEFAULT_PRESET.nodes then.
  //   - the count is the library the Sounds panel is showing, factory
  //     plus Yours.
  // Nothing here claims a sound is playing. Nothing is.
  // -----------------------------------------------------------------

  // ---------------------------------------------------------------
  // THE ARMED SOUND (2026-09-02, user direction).
  //
  // Before Start, reaching for a sound used to be answered with words
  // alone: a note naming what you touched, and a highlight on Start.
  // The stage behind it went on printing whatever the autosave held, so
  // the one surface big enough to SHOW you the sound you just picked
  // showed you a different one.
  //
  // Now a pre-Start click ARMS that sound. The cold face prints ITS
  // chain, ITS description and "Press Start to try <name>", the row
  // marks itself, and the engine loads exactly that sound the moment it
  // comes up — through loadFactoryPreset/loadUserPreset, the same
  // guarded transaction the live Try button uses.
  //
  // The mutation guard has NOT moved. A pre-Start click still commits
  // NOTHING: arming writes one UI variable and repaints. The load
  // happens later, from onEngineStarted, after engineIsLive() is true —
  // so a synthetic click on a gated row still cannot reach the audio
  // graph, which is the property the pre-Start gate round pinned.
  //
  // It is also the only reading that stays honest: the cold face may
  // only ever promise what Start will actually do, and Start now does
  // this.
  // ---------------------------------------------------------------
  var armedSound = null; // {name, kind} until Start consumes it

  // Read once (see above); null means "not read yet this cold period".
  var coldChainCache = null;

  function coldChain() {
    if (coldChainCache) {
      return coldChainCache;
    }
    var nodes = [];
    try {
      if (window.Persistence && typeof window.Persistence.loadInitialModel === 'function') {
        nodes = window.Persistence.loadInitialModel() || [];
      }
    } catch (err) {
      // loadInitialModel() is documented never to throw, but the cold
      // face is print over a safety surface: it degrades to "no chain to
      // print" rather than taking the stage down with it.
      nodes = [];
    }
    coldChainCache = Array.isArray(nodes) ? nodes : [];
    return coldChainCache;
  }

  /** Same params, compared the way the preset wire form stores them —
   *  key for key, with numbers compared numerically so a 0 that
   *  round-tripped through JSON as "0" still matches. */
  function sameParams(a, b) {
    var av = a || {};
    var bv = b || {};
    var keys = Object.keys(av);
    if (keys.length !== Object.keys(bv).length) {
      return false;
    }
    return keys.every(function (key) {
      if (!Object.prototype.hasOwnProperty.call(bv, key)) {
        return false;
      }
      var l = av[key];
      var r = bv[key];
      if (typeof l === 'number' || typeof r === 'number') {
        return Number(l) === Number(r);
      }
      return l === r;
    });
  }

  /** The factory preset this chain IS, or '' when it is none of them.
   *  Structural on purpose: a chain restored from the autosave slot
   *  carries no preset name of its own, so the only honest way to name
   *  it is to recognize it. */
  function coldChainName(chain) {
    var library = [];
    try {
      library = (window.FactoryPresets && typeof window.FactoryPresets.list === 'function')
        ? window.FactoryPresets.list()
        : [];
    } catch (err) {
      library = [];
    }
    for (var i = 0; i < library.length; i++) {
      var nodes = library[i].nodes || [];
      if (nodes.length !== chain.length) {
        continue;
      }
      var match = true;
      for (var n = 0; n < nodes.length; n++) {
        if (nodes[n].type !== chain[n].type || !sameParams(nodes[n].params, chain[n].params)) {
          match = false;
          break;
        }
      }
      if (match) {
        return library[i].name;
      }
    }
    return '';
  }

  /** The armed sound's own chain, from the same two sources the library
   *  lists. Empty array when it cannot be resolved (a preset deleted in
   *  another tab between arming and reading) — the caller then falls
   *  back to the waiting chain rather than printing an empty promise. */
  function armedChain() {
    if (!armedSound) {
      return [];
    }
    try {
      if (armedSound.kind === 'factory') {
        var lib = (window.FactoryPresets && typeof window.FactoryPresets.list === 'function')
          ? window.FactoryPresets.list()
          : [];
        for (var i = 0; i < lib.length; i++) {
          if (lib[i].name === armedSound.name) {
            return lib[i].nodes || [];
          }
        }
        return [];
      }
      var saved = (window.PresetStore && typeof window.PresetStore.load === 'function')
        ? window.PresetStore.load(armedSound.name)
        : null;
      return (saved && saved.nodes) || [];
    } catch (err) {
      return [];
    }
  }

  /** Arm a sound from a pre-Start click: repaint the stage so it shows
   *  what was just reached for, and re-mark the list. Deliberately does
   *  NOT rebuild the library — the click came from a row button, and
   *  re-rendering would drop focus off it mid-gesture. */
  function armSound(name, kind) {
    armedSound = { name: name, kind: kind };
    renderStage();
    markArmedRows();
  }

  /** Load the armed sound now that the engine is live, through the same
   *  path a live Try uses. Consumed exactly once. */
  function consumeArmedSound() {
    var armed = armedSound;
    armedSound = null;
    if (!armed || !engineIsLive() || !window.PresetsUI) {
      return;
    }
    if (armed.kind === 'factory' && typeof window.PresetsUI.loadFactoryPreset === 'function') {
      window.PresetsUI.loadFactoryPreset(armed.name);
    } else if (armed.kind === 'user' && typeof window.PresetsUI.loadUserPreset === 'function') {
      window.PresetsUI.loadUserPreset(armed.name);
    }
  }

  /** Mark whichever row is armed, in place. Rows carry their own name in
   *  data-preset so this needs no map to fall out of date. */
  function markArmedRows() {
    if (!cardsListEl || !cardsListEl.children) {
      return;
    }
    for (var i = 0; i < cardsListEl.children.length; i++) {
      var row = cardsListEl.children[i];
      if (!row || !row.classList || typeof row.getAttribute !== 'function') {
        continue;
      }
      var rowName = row.getAttribute('data-preset');
      row.classList.toggle(
        'preset-row-armed',
        !!rowName && !!armedSound && rowName === armedSound.name
      );
    }
  }

  /** How many sounds the Sounds panel beside this stage is listing — the
   *  same two sources it renders from, never a hardcoded number. */
  function libraryCount() {
    return factoryEntries().length + userNames().length;
  }

  /** The 3-letter silkscreen code, from the ONE function the palette
   *  chips, node-card rails and preset family rows already share. */
  function familyInitials(type) {
    try {
      if (window.ChainCanvas && typeof window.ChainCanvas.familyInitials === 'function') {
        return window.ChainCanvas.familyInitials(type);
      }
    } catch (err) {
      /* stripped harness — the type key's own initials are the fallback */
    }
    return String(type || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  }

  /** The house jack: one 15px ring with a dark socket dot, the drawn
   *  vocabulary the board's cord layer uses at every endpoint. Authored
   *  SVG rather than a glyph, and skipped entirely where createElementNS
   *  is absent (the committed test harness) — the anchor's silkscreen
   *  word carries the meaning on its own. */
  function jackPrint() {
    if (typeof document.createElementNS !== 'function') {
      return null;
    }
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'cold-face-jack');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('cx', '8');
    ring.setAttribute('cy', '8');
    ring.setAttribute('r', '6.75');
    ring.setAttribute('class', 'cold-face-jack-ring');
    var socket = document.createElementNS(NS, 'circle');
    socket.setAttribute('cx', '8');
    socket.setAttribute('cy', '8');
    socket.setAttribute('r', '2.5');
    socket.setAttribute('class', 'cold-face-jack-socket');
    svg.appendChild(ring);
    svg.appendChild(socket);
    return svg;
  }

  function coldAnchor(word) {
    var anchor = document.createElement('div');
    anchor.className = 'cold-face-anchor';
    var jack = jackPrint();
    if (jack) {
      anchor.appendChild(jack);
    }
    var legend = document.createElement('span');
    legend.className = 'cold-face-anchor-legend';
    legend.textContent = word;
    anchor.appendChild(legend);
    return anchor;
  }

  /** One section's plate on the strip: the family tick, the 3-letter
   *  code and the module's own label, all in that family's desaturated
   *  silkscreen ink — the rail-print vocabulary, standing cold. */
  function coldPlate(node) {
    var plate = document.createElement('li');
    plate.className = 'cold-face-plate';
    plate.setAttribute('style', familyVars(node.type));

    var code = document.createElement('span');
    code.className = 'cold-face-code';
    code.textContent = familyInitials(node.type);

    var label = document.createElement('span');
    label.className = 'cold-face-label';
    label.textContent = technicalLabel(node.type);

    plate.appendChild(code);
    plate.appendChild(label);
    return plate;
  }

  /** The one sentence under the heading. Split into subject + rest so
   *  the sound's own name can carry the lifted print without the copy
   *  living in two places. */
  function coldSubject(chain, name) {
    if (chain.length === 0) {
      return 'No effects are loaded yet.';
    }
    return name || 'Your last chain';
  }

  function coldRest(chain, count) {
    var opener = chain.length === 0 ? '' : ' is loaded and waiting.';
    if (count > 0) {
      // No direction word: the Sounds library sits beside the stage on a
      // wide deck and stacks ABOVE it below 901px, so "on the left" was
      // only true at one breakpoint.
      return opener + ' Press Start to hear it, or pick any of the ' +
        count + ' sounds.';
    }
    return opener + ' Press Start to hear it.';
  }

  function renderColdFace(engineLive) {
    if (!coldFaceEl) {
      return;
    }
    if (engineLive) {
      // Live: the cold face has nothing true left to say, and the
      // Current-sound face below it answers the same question better.
      // Drop the cached read too, so a later stop/restart re-reads
      // whatever the session actually left in the slot.
      coldChainCache = null;
      // NOT armedSound: the startup restore commits through
      // ChainEditing -> markAcceptedEdit -> onChainChanged -> renderAll,
      // which lands HERE with the engine already live — a moment BEFORE
      // main.js calls onEngineStarted. Clearing the arm here consumed it
      // into nothing, and Start silently kept the old chain. The arm has
      // exactly one consumer, consumeArmedSound(), and it nulls it there.
      coldFaceEl.hidden = true;
      coldFaceEl.innerHTML = '';
      return;
    }

    // An armed sound wins the stage: it is what Start is about to load,
    // so it is what the cold face must show. Falling back to the waiting
    // chain if it cannot be resolved keeps the strip truthful.
    var armedNodes = armedSound ? armedChain() : [];
    var armed = !!armedSound;
    // Armed but unresolvable prints the promise with NO strip, rather
    // than the promise over someone else's chain. Start still loads the
    // armed sound — consumeArmedSound() reads the name, not the nodes.
    var chain = armedNodes.length > 0 ? armedNodes : (armed ? [] : coldChain());
    var name = armed ? armedSound.name : coldChainName(chain);
    var count = libraryCount();

    coldFaceEl.innerHTML = '';
    coldFaceEl.hidden = false;

    var line = document.createElement('p');
    line.className = 'cold-face-line';
    if (armed) {
      // The armed reading: one promise, and Start keeps it.
      line.appendChild(document.createTextNode('Press Start to try '));
      var armedSubject = document.createElement('strong');
      armedSubject.className = 'cold-face-subject';
      armedSubject.textContent = name;
      line.appendChild(armedSubject);
      line.appendChild(document.createTextNode('.'));
    } else {
      var subject = document.createElement('strong');
      subject.className = 'cold-face-subject';
      subject.textContent = coldSubject(chain, name);
      line.appendChild(subject);
      line.appendChild(document.createTextNode(coldRest(chain, count)));
    }
    coldFaceEl.appendChild(line);

    // The waiting sound's OWN description, from the same factory record
    // the library card beside it reads — the single most useful sentence
    // a first-timer can have before Start, and not one word of it
    // written here. A chain that matches no preset has no description to
    // borrow and simply goes without.
    var description = factoryDescription(name);
    if (description) {
      var desc = document.createElement('p');
      desc.className = 'cold-face-desc';
      desc.textContent = description;
      coldFaceEl.appendChild(desc);
    }

    if (chain.length === 0) {
      // Nothing to print. The sentence above already says so, and a
      // strip with no sections on it would be an empty promise.
      return;
    }

    var strip = document.createElement('div');
    strip.className = 'cold-face-strip';
    strip.setAttribute('aria-hidden', 'true');

    strip.appendChild(coldAnchor('Mic in'));

    var plates = document.createElement('ol');
    plates.className = 'cold-face-plates';
    chain.forEach(function (node) {
      plates.appendChild(coldPlate(node));
    });
    strip.appendChild(plates);

    strip.appendChild(coldAnchor('Out'));
    coldFaceEl.appendChild(strip);

    // The strip is a redundant PICTURE of the sentence above, so it is
    // aria-hidden and this legend carries the same fact as text — the
    // section count a screen reader would otherwise have to count.
    var legend = document.createElement('p');
    legend.className = 'cold-face-legend';
    // 'Held' is what the machine is sitting on; 'queued' is what Start
    // will put there instead. The strip means a different thing in each
    // case and the legend has to say which.
    legend.textContent = (armed ? 'Queued · mic in through ' : 'Chain held · mic in through ') +
      chain.length + (chain.length === 1 ? ' section' : ' sections') + ' to out';
    coldFaceEl.appendChild(legend);
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

  // -----------------------------------------------------------------
  // THE WAKE (2026-09-02 delight round) — the surface half of the
  // power-up. The gate class has just come off; this plays the one
  // animation that carries the moment (the print rising to full while
  // the hatch peels off toward OUT — styles/main.css's THE WAKE block)
  // and takes itself off again the instant it ends.
  //
  // Purely additive: the class is applied AFTER the gate is already
  // gone, so the surface is fully interactive for every frame of it,
  // and a browser that never fires animationend still drops the class
  // on the timer. Under `prefers-reduced-motion` the keyframes do not
  // exist at all — the class lands, animates nothing, and is removed.
  // -----------------------------------------------------------------
  function wakeSurface(el, className) {
    if (!el || !el.classList) {
      return;
    }
    el.classList.add(className);
    var done = function () {
      el.classList.remove(className);
      if (typeof el.removeEventListener === 'function') {
        el.removeEventListener('animationend', done);
      }
    };
    if (typeof el.addEventListener === 'function') {
      el.addEventListener('animationend', done);
    }
    if (typeof window.setTimeout === 'function') {
      // The belt to that braces: an element that never animates (reduced
      // motion, a stripped harness, a browser that swallowed the event)
      // must not keep the class forever.
      window.setTimeout(done, 700);
    }
  }

  // The stage's emergency-bypass line: the deck sentence's own words on
  // the surface an operator actually reads mid-show. Built lazily and
  // managed by hidden-ness (not rebuilt) so re-renders can't churn it.
  // aria-hidden because the deck's role="status" sentence already
  // announces the state ONCE — a second live region would announce it
  // twice; this line is the stage's redundant picture, the same
  // discipline the cold-face strip's legend carries. Sits OUTSIDE
  // .simple-stage-inner so the recede never dims it.
  var bypassLineEl = null;

  function ensureBypassLine() {
    if (bypassLineEl || !stageEl || typeof document.createElement !== 'function') {
      return bypassLineEl;
    }
    bypassLineEl = document.createElement('p');
    bypassLineEl.className = 'simple-stage-bypass-line';
    bypassLineEl.setAttribute('aria-hidden', 'true');
    bypassLineEl.textContent = 'Bypassed — effects off';
    bypassLineEl.hidden = true;
    if (typeof stageEl.insertBefore === 'function' && stageEl.firstChild) {
      stageEl.insertBefore(bypassLineEl, stageEl.firstChild);
    } else if (typeof stageEl.appendChild === 'function') {
      stageEl.appendChild(bypassLineEl);
    } else {
      bypassLineEl = null;
    }
    return bypassLineEl;
  }

  function renderStage() {
    var chain = currentChain();
    var state = displayState();
    var engineLive = engineIsLive();
    var name = engineLive ? (state.name || 'Custom sound') : 'Ready to start';

    // Pre-Start, the stage wears the SAME gate Advanced's canvas face
    // wears — one diagonal hatch + recede for "not interactive yet",
    // driven by the same engineIsLive() predicate every other gate in
    // this file reads, so the paint can never disagree with the Try /
    // transport / Save buttons beside it. The Sounds library is not
    // gated: browse and search stay live before Start.
    if (stageEl) {
      var wasGated = stageEl.classList.contains('engine-not-started');
      stageEl.classList.toggle('engine-not-started', !engineLive);
      // The stage carries a different composition in each state (the
      // cold faceplate vs. the live Current-sound face), and the cold
      // one is a wide strip — the class lets the stage widen for it
      // without the live face losing its reading measure.
      stageEl.classList.toggle('stage-cold', !engineLive);
      if (wasGated && engineLive) {
        wakeSurface(stageEl, 'stage-waking');
      }
    }

    // The emergency-bypass reading (harden round, 2026-09-02 critique
    // P1): while the engine is live AND bypass is engaged, the stage
    // must answer "what is the room hearing" — receding its content and
    // printing the state — instead of silently naming a sound whose
    // processing is gated off. Only ever true on a LIVE engine: a
    // stopped engine has no bypass meaning, and the pre-Start gate
    // above owns the stage then. Derived here, on every render, so the
    // class can never drift from the same truth the deck key reads.
    var bypassed = engineLive && bypassEngaged();
    if (stageEl) {
      stageEl.classList.toggle('stage-bypassed', bypassed);
    }
    var bypassLine = ensureBypassLine();
    if (bypassLine) {
      bypassLine.hidden = !bypassed;
    }

    // What stands on the stage before Start (see THE COLD FACE above).
    renderColdFace(engineLive);

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
  // The plain filters (2026-09-02 regrouping): the original four were
  // named against the six-sound seed library — at 33 sounds "Rock"
  // caught exactly ONE preset and "Speech" four, while the asks a
  // karaoke operator actually makes ("more echo", "sound deeper", "the
  // robot voice", "fix my mic") had no chip at all. Each filter below
  // is still a named query over EXISTING tags (stored nowhere new, the
  // settled contract): cross-axis queries compose several tags because
  // one ask legitimately spans them — "Big echo" is long-ambience OR
  // spacious (whichever axis the audition tagged), "Funny" the whole
  // gag axis, "Clean & clear" the cleanup use-case CONTEXT.md calls
  // first-class plus its speech and clean-technique neighbors
  // (absorbing the old "Speech" chip).
  // The 2026-09-03 prune (refinement critique P2 #3, distill round):
  // seven content-plus-reset chips exceeded the <=4-options-per-
  // decision-point guidance, and the row was pruned by MEASUREMENT, not
  // taste — each filter's catch over the 33-sound factory library:
  //   Funny 10 · Big echo 7 · Warm 5 · Clean & clear 5 · Deep voices 4 · Robotic 4
  // The four broadest survived (no tie-break needed: everything at 5+
  // stayed, both 4s left, and no survivor's catch is a subset of
  // another's). "Deep voices" and "Robotic" are REMOVED, not renamed —
  // their sounds stay findable by search in BOTH views ("robot" hits
  // Robot Usher's name and gag:robot tag; "deep" hits Deep Narrator's
  // and Demon Growl's names), and their queries die with the chips.
  // activeFilter() falls back to 'All' for any id no longer here, so a
  // mid-session re-render can never reference a removed chip.
  var PLAIN_FILTERS = [
    { id: 'all', label: 'All', test: function () { return true; } },
    { id: 'warm', label: 'Warm', test: function (tags) { return tags.indexOf('vibe:warm') !== -1; } },
    {
      id: 'echo',
      label: 'Big echo',
      test: function (tags) {
        return tags.indexOf('technique:ambience-long') !== -1 ||
          tags.indexOf('vibe:spacious') !== -1;
      }
    },
    {
      id: 'funny',
      label: 'Funny',
      test: function (tags) {
        return tags.some(function (t) { return t.indexOf('gag:') === 0; });
      }
    },
    {
      id: 'clean',
      label: 'Clean & clear',
      test: function (tags) {
        return tags.indexOf('use-case:cleanup') !== -1 ||
          tags.indexOf('use-case:speech/hosting') !== -1 ||
          tags.indexOf('technique:clean') !== -1;
      }
    }
  ];

  var libraryState = { filter: 'all', query: '' };
  // wayfinder #49 — which Yours cards currently show their opened
  // secondary menu (Delete) instead of the plain "…" toggle. Keyed by
  // name, not index, so it survives a re-render even if the list's
  // order changes; a deleted preset's own entry is removed explicitly
  // (see the Delete click handler below) rather than lingering forever.
  var openCardMenus = {};
  // Sharing round: a transient per-row note (Copy feedback) rendered in
  // place of the open menu's keys for ~1.8s — the same flash pattern
  // the gate note uses, cleared on a timer and by every rebuild.
  var menuNotes = {};
  var menuNoteTimers = {};
  var chipEls = {};
  var cardsListEl = null;
  var chipCountEl = null;

  function flashMenuNote(name, text) {
    menuNotes[name] = text;
    if (menuNoteTimers[name] && typeof clearTimeout === 'function') {
      clearTimeout(menuNoteTimers[name]);
    }
    if (typeof setTimeout === 'function') {
      menuNoteTimers[name] = setTimeout(function () {
        delete menuNotes[name];
        renderLibraryList();
      }, 1800);
    }
    renderLibraryList();
  }

  function copyShareUrl(name, url) {
    if (!window.PresetLink || typeof window.PresetLink.copyToClipboard !== 'function') {
      return;
    }
    window.PresetLink.copyToClipboard(url).then(function (ok) {
      flashMenuNote(name, ok ? 'Link copied' : 'Copy failed — try again');
    });
  }

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

  // The Try button pre-Start is `aria-disabled`, NOT natively disabled:
  // a natively disabled button swallows the click, and a click that
  // produces no answer at all is the dead affordance this surface keeps
  // trying to avoid. The mutation guard has not moved — it lives in the
  // click handler below, which checks the same engineIsLive() predicate
  // before it will call PresetsUI — so a synthetic click still commits
  // nothing. What the click buys is the ANSWER: the standing note names
  // the sound the operator just reached for and points at the one
  // control that unblocks it, and Start itself takes a brief highlight
  // so the eye lands on it.
  var FLASH_MS = 1600;

  function clearFlash() {
    if (gateFlashTimer !== null && typeof clearTimeout === 'function') {
      clearTimeout(gateFlashTimer);
    }
    gateFlashTimer = null;
    libraryGateNoteEl.classList.remove('gate-note-flash');
    var startButton = document.getElementById('start-button');
    if (startButton) {
      startButton.classList.remove('needs-attention');
    }
  }

  function answerGatedTry(name) {
    libraryGateNoteEl.hidden = false;
    // Naming the sound also makes the text CHANGE, which is what makes
    // the aria-live="polite" region announce again — an identical string
    // re-assigned announces nothing. The sentence then STAYS as the
    // standing instruction (only the highlight is temporary): the note
    // is still true, and swapping copy back under the reader a second
    // later would announce a second time for no new information.
    libraryGateNoteEl.textContent =
      'Press Start to switch the microphone on — then Try "' + name + '".';

    // Drop any highlight still running and re-arm it on the NEXT tick, so
    // a second click on the same card replays the flash instead of
    // landing on an already-present class and doing nothing visible.
    clearFlash();
    if (typeof setTimeout !== 'function') {
      return;
    }
    // Held in the SAME handle clearFlash() cancels, so a re-render landing
    // inside this tick cannot leave an orphaned flash behind it.
    gateFlashTimer = setTimeout(function () {
      libraryGateNoteEl.classList.add('gate-note-flash');
      var startButton = document.getElementById('start-button');
      // Only when Start is actually pressable — highlighting a disabled
      // Start (mid-startup, or already live) would point at a dead end.
      if (startButton && !startButton.disabled) {
        startButton.classList.add('needs-attention');
      }
      gateFlashTimer = setTimeout(clearFlash, FLASH_MS);
    }, 0);
  }

  // Put the standing sentence back and drop any in-flight highlight —
  // called from every re-render, so the moment the engine goes live (or
  // the list rebuilds for any other reason) the surface stops shouting.
  function resetGateNote() {
    clearFlash();
    libraryGateNoteEl.textContent = DEFAULT_GATE_NOTE;
  }

  // Per-page counter for row-description ids: rows rebuild wholesale on
  // every renderLibraryList(), so a fresh unique id per build is enough —
  // no name-derived ids that could collide when a Yours preset shares a
  // factory name.
  var rowDescIdCounter = 0;

  function buildCard(name, description, kind, isActive) {
    var row = document.createElement('div');
    row.className = 'preset-row';
    // markArmedRows() re-marks in place off this, so the armed row never
    // needs a parallel index that could fall out of date.
    row.setAttribute('data-preset', name);
    if (isActive) {
      row.classList.add('preset-row-active');
    }
    if (armedSound && armedSound.name === name) {
      row.classList.add('preset-row-armed');
    }

    var loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'preset-row-load';
    // The accessible name is the ACTION, never the whole card: 33 rows
    // whose names each swallowed a full two-line description was
    // punishing verbosity for a screen-reader operator walking the
    // library (audit 2026-09-02, P2). The description stays available
    // ON DEMAND through aria-describedby below — the same
    // action-phrase-name pattern the palette chips carry ("Add EQ to
    // chain" over the visible "EQ").
    loadBtn.setAttribute('aria-label', 'Try ' + name);
    var describedBy = [];
    var gated = !engineIsLive();
    if (gated) {
      // Stays focusable and clickable on purpose — see answerGatedTry().
      loadBtn.setAttribute('aria-disabled', 'true');
      describedBy.push('simple-library-gate-note');
    }

    var nameSpan = document.createElement('span');
    nameSpan.className = 'preset-row-name';
    nameSpan.textContent = name;
    loadBtn.appendChild(nameSpan);

    if (description) {
      var previewSpan = document.createElement('span');
      previewSpan.className = 'preset-row-preview';
      previewSpan.textContent = description;
      // The description rides OUT of the accessible name and INTO the
      // describedby chain (first, before the gate note when both are
      // present) — visible print unchanged.
      rowDescIdCounter += 1;
      previewSpan.id = 'preset-row-desc-' + rowDescIdCounter;
      describedBy.unshift(previewSpan.id);
      loadBtn.appendChild(previewSpan);
    }
    if (describedBy.length > 0) {
      loadBtn.setAttribute('aria-describedby', describedBy.join(' '));
    }

    // "Try a preset" (CONTEXT.md's settled verb): submits through the
    // SAME load path Advanced's own Presets panel rows use — see this
    // file's header and presets-ui.js's export comment.
    loadBtn.addEventListener('click', function () {
      if (!engineIsLive()) {
        // Arm FIRST, then answer: armSound() repaints the stage and the
        // row marks, and answerGatedTry() then writes the aria-live note
        // — which markArmedRows()/renderStage() must not overwrite.
        armSound(name, kind);
        answerGatedTry(name);
        return;
      }
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
      if (menuNotes[name]) {
        // Copy feedback occupies the menu slot for its flash, then the
        // normal rebuild restores the keys.
        var noteSpan = document.createElement('span');
        noteSpan.className = 'simple-card-note';
        noteSpan.textContent = menuNotes[name];
        row.appendChild(noteSpan);
      } else if (openCardMenus[name]) {
        // Sharing round: the open menu carries BOTH actions — Copy link
        // (the preset travels as a URL fragment via src/preset-link.js)
        // and the two-step Delete. Copy answers inline: a transient
        // "Link copied" label replaces the menu keys for a beat (the
        // flash pattern the gate note already uses), never a dialog.
        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'simple-card-copy';
        copyBtn.textContent = 'Copy link';
        copyBtn.addEventListener('click', function () {
          if (!window.PresetLink || !window.PresetStore ||
              typeof window.PresetStore.load !== 'function') {
            return;
          }
          var record = window.PresetStore.load(name);
          if (!record) {
            return;
          }
          window.PresetLink.buildShareUrl(name, record.nodes).then(function (result) {
            if (!result.ok) {
              flashMenuNote(name, result.message);
              return;
            }
            copyShareUrl(name, result.url);
          });
        });
        row.appendChild(copyBtn);

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
    resetGateNote();
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
    // A pending shared sound reads FIRST (sharing round, 2026-09-02) —
    // it is the event the operator just arrived on. One card builder
    // for both views: PresetsUI owns it, so the arrival reads the same
    // in Simple as in the Advanced panel.
    if (window.PresetsUI && typeof window.PresetsUI.renderShareArrivalInto === 'function') {
      try {
        window.PresetsUI.renderShareArrivalInto(cardsListEl);
      } catch (err) {
        /* the library stays a library — sharing never takes it down */
      }
    }
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

  /** The transport's direction mark: the board's own drawn chevron
   *  (.chain-arrow-mark's square-corner geometry), rotated per
   *  direction in CSS. aria-hidden — the button's word is the label. */
  function transportMark(dir) {
    var wrap = document.createElement('span');
    wrap.className = 'simple-transport-mark simple-transport-mark-' + dir;
    wrap.setAttribute('aria-hidden', 'true');
    var mark = document.createElement('span');
    mark.className = 'chain-arrow-mark';
    wrap.appendChild(mark);
    return wrap;
  }

  function renderTransport() {
    transportEl.innerHTML = '';
    transportEl.hidden = !engineIsLive();
    if (transportEl.hidden) {
      return;
    }
    var list = filteredFactory();
    var pos = currentFactoryPosition(list);

    // The direction marks are DRAWN, not typed (2026-09-02 typeset
    // round). These were the last two Unicode glyphs standing in for
    // this app's icon system: a filled triangle renders at whatever
    // weight and baseline each platform's emoji-or-symbol fallback
    // happens to pick, next to a board whose every other mark is the
    // same authored square-corner chevron. The button keeps its word —
    // the mark is decoration beside a real label, never the label.
    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'control simple-transport-key';
    prevBtn.appendChild(transportMark('prev'));
    prevBtn.appendChild(document.createTextNode('Previous'));
    prevBtn.disabled = list.length < 2;
    prevBtn.addEventListener('click', function () { stepFactory(-1); });

    var posSpan = document.createElement('span');
    posSpan.className = 'simple-transport-pos';
    posSpan.textContent = list.length === 0 ? '–' : (pos < 0 ? '·' : (pos + 1) + ' / ' + list.length);

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'control simple-transport-key';
    nextBtn.appendChild(document.createTextNode('Next'));
    nextBtn.appendChild(transportMark('next'));
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

    // Live round 2026-09-03: the filters print as one group — a
    // silkscreen legend over the 2-column key grid (.simple-chips in
    // main.css owns the geometry).
    var legend = document.createElement('span');
    legend.className = 'simple-chips-legend';
    legend.textContent = 'Filter';
    chipsRow.appendChild(legend);

    PLAIN_FILTERS.forEach(function (f) {
      var chip = document.createElement('button');
      chip.type = 'button';
      // A label too long for a half-width cell spans the full row
      // instead of truncating ("Clean & clear").
      chip.className = 'simple-chip' + (f.label.length > 10 ? ' simple-chip-wide' : '');
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

  /* Distinct from the plain re-render the other two hooks are: this is
     the one edge where a sound armed before Start becomes the live
     chain. consumeArmedSound() runs the ordinary guarded load, which
     re-enters through markAcceptedEdit -> onChainChanged and repaints
     on its own; the renderAll() after it covers the no-armed-sound case
     and any state the load path did not touch. */
  function onEngineStarted() {
    consumeArmedSound();
    renderAll();
  }

  window.SimpleView = {
    onChainChanged: renderAll,
    onEngineStarted: onEngineStarted,
    onEngineStopped: renderAll,
    // The emergency-bypass notification (harden round): main.js's
    // setBypassButtonLabel() — the one choke point every bypass state
    // change already passes through — calls this so the stage re-derives
    // its bypassed reading from live truth. renderStage alone (not
    // renderAll): the library list has nothing to say about bypass, and
    // rebuilding it would churn the gate note for nothing.
    onBypassChanged: renderStage
  };
})();
