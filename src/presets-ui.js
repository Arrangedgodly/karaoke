// Presets panel UI for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends on
// window.PresetStore (src/preset-store.js) and window.ChainCanvas
// (src/canvas.js) — both already loaded by the time this file runs, per
// index.html's script order.
//
// PS-3 scope: wires the real Presets panel markup in index.html
// (#save-preset-btn/#preset-select/#load-preset-btn/#delete-preset-btn/
// #current-preset-name/#unsaved-indicator) up to window.PresetStore
// (named, user-managed saved presets) and window.ChainCanvas
// (getCurrentModel()/loadModel(), the live on-screen chain).
//
// This file owns two independent bits of state, both purely DOM-display
// concerns — neither is persisted anywhere, and both reset to their
// initial "nothing loaded/saved yet" values on every page load:
//   - `currentPresetName`: the name of whichever named preset is currently
//     considered "loaded" (null when nothing named has been saved/loaded
//     yet this session — displayed as "Unsaved chain").
//   - the `#unsaved-indicator` element's visibility: whether the live chain
//     has drifted from `currentPresetName`'s last-saved/loaded state.
//     src/canvas.js calls markModified() (this file's one exported
//     function) at its three user-EDIT chokepoints (onSort, the
//     remove-button handler, and a param-tweak's onParamsChanged callback)
//     — never on a load, which is a clean state by definition, not an
//     edit.
(function () {
  'use strict';

  var presetsPanelEl = document.getElementById('save-preset-btn');
  var currentPresetNameEl = document.getElementById('current-preset-name');
  var unsavedIndicatorEl = document.getElementById('unsaved-indicator');
  var saveBtn = document.getElementById('save-preset-btn');
  var presetSelectEl = document.getElementById('preset-select');
  var loadBtn = document.getElementById('load-preset-btn');
  var deleteBtn = document.getElementById('delete-preset-btn');

  if (!presetsPanelEl || !currentPresetNameEl || !presetSelectEl || !loadBtn || !deleteBtn) {
    // Presets panel markup isn't present (e.g. not yet built, or
    // restructured again by a later task) — nothing to wire up.
    return;
  }

  // `null` means "no named preset is currently considered loaded" — the
  // initial state, matching #current-preset-name's own markup default of
  // "Unsaved chain" in index.html. Kept as a separate variable (rather than
  // re-reading currentPresetNameEl.textContent, which would require
  // special-casing the literal "Unsaved chain" placeholder string) so a
  // preset that happened to be user-named "Unsaved chain" could never be
  // confused with the placeholder.
  var currentPresetName = null;

  /**
   * Rebuild #preset-select's <option> list from PresetStore.listNames().
   * PresetStore.listNames() itself guarantees the list is never empty (it
   * seeds the default preset on a completely fresh/empty store) — the
   * "-- no presets --" placeholder below is defensive only, in case that
   * invariant is ever changed.
   *
   * @param {string} [selectName] - if provided and present in the list,
   *   that option is marked selected; otherwise the browser's own default
   *   (first option) applies.
   */
  function refreshPresetSelect(selectName) {
    var names = window.PresetStore.listNames();
    presetSelectEl.innerHTML = '';

    if (names.length === 0) {
      var emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '-- no presets --';
      presetSelectEl.appendChild(emptyOpt);
      return;
    }

    names.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === selectName) {
        opt.selected = true;
      }
      presetSelectEl.appendChild(opt);
    });
  }

  /**
   * Update both the tracked `currentPresetName` state and its on-screen
   * display in one place, so the two can never drift apart.
   *
   * @param {string|null} name - null displays the "Unsaved chain" placeholder.
   */
  function setCurrentPreset(name) {
    currentPresetName = name;
    currentPresetNameEl.textContent = name || 'Unsaved chain';
  }

  /**
   * Called by src/canvas.js at each of its three user-EDIT chokepoints
   * (onSort, the remove-button handler, a param tweak's onParamsChanged) —
   * never on a load, which is a clean state, not an edit. Exposed on this
   * module's export; nothing else in this file needs to be callable from
   * outside its own IIFE.
   */
  function markModified() {
    if (unsavedIndicatorEl) {
      unsavedIndicatorEl.style.display = '';
    }
  }

  /**
   * The inverse of markModified() — hidden after any action that makes the
   * live chain match a known, named state again (a fresh Save As, or a
   * Load, including reloading the SAME preset that was already current;
   * this deliberately does not special-case that as a no-op).
   */
  function clearModified() {
    if (unsavedIndicatorEl) {
      unsavedIndicatorEl.style.display = 'none';
    }
  }

  saveBtn.addEventListener('click', function () {
    var defaultName = currentPresetName || '';
    var name = window.prompt('Save chain as:', defaultName);
    if (name === null) {
      // User cancelled the prompt.
      return;
    }
    var trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }

    window.PresetStore.save(trimmed, window.ChainCanvas.getCurrentModel());
    refreshPresetSelect(trimmed);
    setCurrentPreset(trimmed);
    clearModified();
  });

  loadBtn.addEventListener('click', function () {
    var name = presetSelectEl.value;
    if (!name) {
      return;
    }

    var result = window.PresetStore.load(name);
    if (!result) {
      // Defensive — shouldn't normally happen since the dropdown only ever
      // lists names PresetStore itself reported as saved, but guards
      // against e.g. another tab having removed it out from under us.
      window.alert('Could not load that preset — it may have been removed.');
      return;
    }

    // ChainCanvas.loadModel() also updates the autosave baseline
    // internally (see src/canvas.js) — nothing extra needed here for that.
    window.ChainCanvas.loadModel(result.nodes);
    setCurrentPreset(result.name);
    clearModified();
  });

  deleteBtn.addEventListener('click', function () {
    var name = presetSelectEl.value;
    if (!name) {
      return;
    }

    if (!window.confirm('Delete preset "' + name + '"?')) {
      return;
    }

    window.PresetStore.remove(name);
    refreshPresetSelect();

    // Deleting a saved preset never touches the live chain itself — only
    // reset the "currently loaded" display if the preset just removed was
    // the one being displayed as current.
    if (currentPresetName === name) {
      setCurrentPreset(null);
    }
  });

  // Populate the dropdown once at script-init time — this is also the very
  // first call to PresetStore.listNames() on a fresh profile, which seeds
  // the store with the default preset (see src/preset-store.js), so the
  // list is never empty even before Start has been clicked.
  refreshPresetSelect();

  window.PresetsUI = {
    markModified: markModified,
  };
})();
