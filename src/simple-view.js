// Simple view — the switch and the shell (wayfinder #47, map #43).
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of this project. Depends on window.AudioGraph
// (src/audio-graph.js), window.EffectCatalog (src/effect-catalog.js),
// window.PresetsUI (src/presets-ui.js), and window.FactoryPresets
// (src/factory-presets.js) — all already loaded by the time this file runs,
// per index.html's script order. Every dependency is read defensively
// (typeof checks) so a bare-harness load or a future restructuring degrades
// to an empty/neutral render rather than throwing.
//
// TWO responsibilities, both scoped to ticket #47:
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
// The Sounds library panel (#simple-library-body) is a STATED PLACEHOLDER
// here — real browsing (plain filters, search, Factory/Yours cards,
// Previous/Next) is wayfinder #48's job, landing inside that same element.
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

  if (!simpleBtn || !advancedBtn || !nameEl || !descEl || !summaryEl) {
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

  renderStage();

  window.SimpleView = {
    onChainChanged: renderStage
  };
})();
