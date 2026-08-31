// Presets panel UI for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends on
// window.PresetStore (src/preset-store.js), window.ChainEditing
// (src/chain-editing.js), window.ChainCanvas (read-only Save As snapshots),
// and window.FactoryPresets (src/factory-presets.js,
// PS-4 — optional at runtime, see factoryPresets() below) — all already
// loaded by the time this file runs, per index.html's script order.
//
// PS-3 scope: wires the real Presets panel markup in index.html
// (#save-preset-btn/#preset-select/#load-preset-btn/#delete-preset-btn/
// #current-preset-name/#unsaved-indicator) up to window.PresetStore
// (named, user-managed saved presets), ChainCanvas.getCurrentModel() for
// Save As, and ChainEditing.apply() for every preset load.
//
// PS-4 scope: the dropdown gains two <optgroup> groups — "Factory"
// (window.FactoryPresets' six shipped presets, first) and "Yours"
// (PresetStore's user presets). The merge happens HERE, at the dropdown,
// deliberately NOT inside PresetStore: the store owns exactly one thing
// (the user's named presets under 'karaoke-presets-v1'), and the factory
// library is static runtime content that is never persisted — merging at
// the presentation seam keeps both owners single-purpose and means a
// fresh profile sees the full factory group with ZERO localStorage
// seeding. Factory entries are namespaced in the dropdown's option values
// ('factory:Warm Ballad') so they can never collide with — or shadow — a
// user preset of the same name (the optgroups also separate them
// visually). Factory semantics: Load applies the factory nodes through
// the SAME ChainEditing transaction a user-preset Load uses (the store is
// never consulted for factory content); Delete refuses factory
// selections with a quiet inline note (never a modal, never
// store.remove); Save As… is unchanged and always writes the USER store —
// saving under a factory name creates a separate user preset beside it.
//
// Issue #8 scope: PresetStore's mutating ops now THROW their typed
// StorageError when a write/delete did not persist (verified by
// read-back) instead of swallowing it. Both handlers here honor that:
// a failed Save As changes NO display state (no dropdown entry, no
// current-preset rename, no unsaved-dot clear) and a failed Delete
// keeps the preset listed; both surface the failure through the same
// quiet inline .preset-note line PS-4 introduced (showPresetNote).
//
// R2-3 scope: the panel's two remaining browser dialogs are gone —
// Save As… names IN-PANEL through a lazily built inline naming row
// (#preset-name-row: input + Save + Cancel; Enter confirms, Escape
// cancels, blur never auto-commits; 1-40-char name bound mirroring
// save_preset's), and Delete is TWO-STEP in-panel (first click arms the
// button to "DELETE?" with the safety-edge bezel; a second click within
// 5 s deletes; expiry, an elsewhere press, or Escape disarms). The
// #8 failure consequences, the .preset-note quiet refusals, and the
// overwrite-on-collision semantics are unchanged from the dialog era.
//
// Refinement entry 5 (P3-5, 2026-08-29): the LAST two browser dialogs —
// latent PS-3-era alert calls in the Load handler's defensive guards (a
// factory entry or user preset that vanished between the dropdown render
// and the click) — now route through the same quiet .preset-note line.
// The surface ships zero alert/confirm/prompt calls (suite-enforced by
// tests/test-preset-persistence-honesty.js section M).
//
// This file owns two independent bits of state, both purely DOM-display
// concerns — neither is persisted anywhere, and both reset to their
// initial "nothing loaded/saved yet" values on every page load:
//   - `currentPresetName`: the name of whichever named preset is currently
//     considered "loaded" (null when nothing named has been saved/loaded
//     yet this session — displayed as "Unsaved chain").
//   - the `#unsaved-indicator` element's visibility: whether the live chain
//     has drifted from `currentPresetName`'s last-saved/loaded state.
//     ChainEditing.markAcceptedEdit() calls this module's markModified()
//     only after an accepted human or agent edit. Preset loads instead set
//     the named clean baseline after their transaction commits.
(function () {
  'use strict';

  var presetsPanelEl = document.getElementById('save-preset-btn');
  var currentPresetNameEl = document.getElementById('current-preset-name');
  var unsavedIndicatorEl = document.getElementById('unsaved-indicator');
  var saveBtn = document.getElementById('save-preset-btn');
  var presetSelectEl = document.getElementById('preset-select');
  var loadBtn = document.getElementById('load-preset-btn');
  var deleteBtn = document.getElementById('delete-preset-btn');
  // Guided Patchbay round: the Presets tab's curated browse cards (JS-built
  // below by renderPresetCards()). Optional — a harness/markup without it
  // simply never renders cards; the dropdown+Load path is unaffected.
  var presetCardsEl = document.getElementById('preset-cards');

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

  // PS-4: dropdown option-value prefix marking a FACTORY entry. Namespaced
  // so 'factory:Warm Ballad' can never collide with a user preset whose
  // plain name happens to be 'Warm Ballad' — the Load/Delete handlers
  // branch on this prefix, and Save As… never generates it.
  var FACTORY_VALUE_PREFIX = 'factory:';

  // PS-4: the inline refusal note element (lazily created on first use —
  // see showPresetNote) and the timer hiding it again.
  var presetNoteEl = null;
  var presetNoteTimer = null;
  // R2-3: the inline Save As naming row (lazily created on first use —
  // see openNamingRow) and its pieces. `namingRowOpen` mirrors the row's
  // display state so the Enter/Escape keydown handler only ever acts
  // while the row is actually showing.
  var namingRowEl = null;
  var namingInputEl = null;
  var namingConfirmBtnEl = null;
  var namingCancelBtnEl = null;
  var namingRowOpen = false;

  // R2-3: the two-step Delete arm state — the armed flag, the relabelled
  // button text, and the 5 s window that disarms it again.
  var DELETE_ARM_LABEL = 'DELETE?';
  var DELETE_ARM_WINDOW_MS = 5000;
  var deleteArmed = false;
  var deleteArmTimer = null;

  /**
   * R2-3: lazily build the inline Save As naming row and append it to
   * the panel (the select's parent — the .presets column). The panel's
   * mid-show vocabulary is in-panel: no browser prompt() dialogs, so
   * naming happens in a text input right where Save As… sits, in the
   * shared .control vocabulary. The row starts hidden; openNamingRow()
   * shows it, collapseNamingRow() hides it (display:none removes the
   * input from the tab order — no dead tab stops after collapse).
   *
   * Best-effort by construction, same as showPresetNote: with no parent
   * to anchor to (a bare harness DOM) openNamingRow() is a no-op.
   */
  function ensureNamingRow() {
    if (namingRowEl) {
      return;
    }
    var host = presetSelectEl.parentNode;
    if (!host || typeof host.appendChild !== 'function') {
      return;
    }
    namingRowEl = document.createElement('div');
    namingRowEl.id = 'preset-name-row';
    namingRowEl.className = 'preset-name-row';
    namingRowEl.style.display = 'none';

    var label = document.createElement('label');
    label.className = 'sr-only';
    label.textContent = 'Preset name';
    if (typeof label.setAttribute === 'function') {
      label.setAttribute('for', 'preset-name-input');
    }
    namingRowEl.appendChild(label);

    namingInputEl = document.createElement('input');
    namingInputEl.type = 'text';
    namingInputEl.id = 'preset-name-input';
    namingInputEl.className = 'control preset-name-input';
    // The same 1-40-character bound save_preset enforces (mcp-tools.js
    // validates names as 1-40 after trimming) — maxlength stops typing
    // past it; commitNamingRow() still re-checks defensively.
    namingInputEl.maxLength = 40;
    if (typeof namingInputEl.setAttribute === 'function') {
      namingInputEl.setAttribute('autocomplete', 'off');
    }
    namingInputEl.addEventListener('keydown', function (event) {
      if (!namingRowOpen) {
        return;
      }
      if (event.key === 'Enter') {
        if (event.preventDefault) {
          event.preventDefault();
        }
        commitNamingRow();
      } else if (event.key === 'Escape') {
        // Scoped: stop the Escape here so no document-level listener
        // (e.g. a toast's) reacts to a keypress that only closed the
        // naming row.
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        if (event.preventDefault) {
          event.preventDefault();
        }
        collapseNamingRow();
      }
    });
    namingRowEl.appendChild(namingInputEl);

    // Save + Cancel share their own sub-row beneath the input (the
    // Load/Delete pairing) — a measured fit at the 220px flank, where
    // input + two buttons side by side cannot fit without squeezing the
    // input unreadable.
    var actionsEl = document.createElement('div');
    actionsEl.className = 'preset-name-actions';

    namingConfirmBtnEl = document.createElement('button');
    namingConfirmBtnEl.type = 'button';
    namingConfirmBtnEl.id = 'preset-name-confirm';
    namingConfirmBtnEl.className = 'control control-primary';
    namingConfirmBtnEl.textContent = 'Save';
    namingConfirmBtnEl.addEventListener('click', function () {
      commitNamingRow();
    });
    actionsEl.appendChild(namingConfirmBtnEl);

    namingCancelBtnEl = document.createElement('button');
    namingCancelBtnEl.type = 'button';
    namingCancelBtnEl.id = 'preset-name-cancel';
    namingCancelBtnEl.className = 'control';
    namingCancelBtnEl.textContent = 'Cancel';
    namingCancelBtnEl.addEventListener('click', function () {
      collapseNamingRow();
    });
    actionsEl.appendChild(namingCancelBtnEl);
    namingRowEl.appendChild(actionsEl);

    host.appendChild(namingRowEl);
  }

  /**
   * R2-3: open the inline naming row, pre-filled with the current
   * preset's name (the old prompt()'s suggestion, same re-save affordance)
   * and focused. Blur deliberately does NOT commit or collapse — the
   * operator's mid-show attention may wander; only an explicit Save,
   * Enter, Cancel, or Escape closes the row.
   */
  function openNamingRow() {
    ensureNamingRow();
    if (!namingRowEl) {
      return;
    }
    namingInputEl.value = currentPresetName || '';
    namingRowEl.style.display = '';
    namingRowOpen = true;
    if (typeof namingInputEl.focus === 'function') {
      namingInputEl.focus();
    }
    if (typeof namingInputEl.select === 'function') {
      namingInputEl.select();
    }
  }

  /**
   * R2-3: hide the naming row and hand focus back to Save As… — the row
   * (and its input) leaves the tab order with it.
   */
  function collapseNamingRow() {
    if (!namingRowEl) {
      return;
    }
    namingRowEl.style.display = 'none';
    namingRowOpen = false;
    if (typeof saveBtn.focus === 'function') {
      saveBtn.focus();
    }
  }

  /**
   * R2-3: the Save As commit — the old prompt()-path body, unchanged in
   * its semantics, driven by the inline input instead. Validation mirrors
   * save_preset's bound: trim, 1-40 characters. Empty refuses quietly
   * through the .preset-note line and keeps the row open (retry is the
   * point of an inline row); a collision keeps today's overwrite
   * semantics — save() overwrites silently, exactly as the prompt path
   * did. On a StorageError the row also stays open (nothing downstream
   * changed — same #8 consequences as before) so the operator can retry;
   * on success the row collapses.
   */
  function commitNamingRow() {
    if (!namingRowOpen) {
      return;
    }
    var trimmed = (namingInputEl.value || '').trim();
    if (trimmed.length === 0) {
      showPresetNote('Give the preset a name first.');
      return;
    }
    if (trimmed.length > 40) {
      // Defensive — the input's maxLength stops typing past 40; a paste
      // path that somehow bypasses it still meets the same bound here.
      showPresetNote('Preset names are 1-40 characters.');
      return;
    }

    // PS-4 note: this ALWAYS writes the USER store (PresetStore.save),
    // even when `trimmed` collides with a factory name — namespaces are
    // separate, so a user "Warm Ballad" simply appears beside the factory
    // one, and refreshPresetSelect(trimmed) selects the USER option.
    //
    // Issue #8: on failure NOTHING downstream may run — no dropdown
    // refresh, no current-preset display change, no clearModified() —
    // and the failure is surfaced through the panel's quiet inline note.
    try {
      window.PresetStore.save(trimmed, window.ChainCanvas.getCurrentModel());
    } catch (err) {
      console.error('Presets panel: Save As "' + trimmed + '" failed — nothing was written', err);
      showPresetNote('Could not save "' + trimmed + '" — nothing was written (storage failure)');
      return;
    }
    refreshPresetSelect(trimmed);
    setCurrentPreset(trimmed);
    clearModified();
    // Issue #6: a HUMAN save/overwrite — bump the state revision so a
    // stale agent save_preset Undo entry can no longer auto-apply over
    // the human's newer stored content.
    if (window.AgentUI && typeof window.AgentUI.noteHumanEdit === 'function') {
      window.AgentUI.noteHumanEdit();
    }
    collapseNamingRow();
  }

  /**
   * R2-3: disarm the two-step Delete — restore the plain label and
   * bezel, cancel the expiry window. Idempotent.
   */
  function disarmDelete() {
    if (!deleteArmed) {
      return;
    }
    deleteArmed = false;
    if (deleteArmTimer) {
      window.clearTimeout(deleteArmTimer);
      deleteArmTimer = null;
    }
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'control';
    if (typeof deleteBtn.setAttribute === 'function') {
      deleteBtn.setAttribute('aria-live', 'off');
    }
  }

  /**
   * R2-3: arm the two-step Delete — the button relabels to DELETE? with
   * the safety-edge-red bezel (an EDGE, never the Bypass-only red fill),
   * and a 5 s window holds the armed state. Anything else — the window
   * expiring, a press elsewhere, Escape — disarms (see the document
   * listeners wired once below).
   */
  function armDelete() {
    deleteArmed = true;
    deleteBtn.textContent = DELETE_ARM_LABEL;
    deleteBtn.className = 'control danger-arm';
    if (typeof deleteBtn.setAttribute === 'function') {
      // The relabel is the whole signal — announce it, since styling
      // never carries the meaning alone.
      deleteBtn.setAttribute('aria-live', 'polite');
    }
    if (deleteArmTimer) {
      window.clearTimeout(deleteArmTimer);
    }
    deleteArmTimer = window.setTimeout(function () {
      deleteArmTimer = null;
      disarmDelete();
    }, DELETE_ARM_WINDOW_MS);
  }

  /**
   * PS-4: read the factory library, guarded. An absent or damaged
   * window.FactoryPresets (its script failed to load, or a bare test
   * sandbox that never loaded it) degrades honestly to an empty library —
   * the dropdown then renders PS-3's flat user list, exactly as before
   * PS-4 existed.
   *
   * @returns {Array<{name: string, nodes: Array<{id: string, type: string, params: Object}>}>}
   */
  function factoryPresets() {
    try {
      if (window.FactoryPresets && typeof window.FactoryPresets.list === 'function') {
        var listed = window.FactoryPresets.list();
        if (Array.isArray(listed)) {
          return listed.filter(function (preset) {
            return !!preset && typeof preset.name === 'string' && Array.isArray(preset.nodes);
          });
        }
      }
    } catch (err) {
      // Static content module damaged — fall through to the empty library.
    }
    return [];
  }

  /**
   * PS-4: find one factory preset by its friendly name. Returns a FRESH
   * entry (FactoryPresets.list() deep-copies per call), or null.
   *
   * @param {string} name
   * @returns {{name: string, nodes: Array<{id: string, type: string, params: Object}>}|null}
   */
  function findFactoryPreset(name) {
    var library = factoryPresets();
    for (var i = 0; i < library.length; i++) {
      if (library[i].name === name) {
        return library[i];
      }
    }
    return null;
  }

  /**
   * PS-4/Guided Patchbay: the ONE factory-load path — resolves a factory
   * preset by name and submits it through the same ChainEditing transaction
   * as the dropdown's user-preset path. The accepted transaction owns the
   * clean display state and human-edit revision. Shared by BOTH the
   * dropdown+Load button's factory branch and the Presets tab's curated
   * cards, so there is exactly one factory-load code path, never two
   * that could drift.
   *
   * @param {string} name - the preset's plain (unprefixed) name.
   * @returns {boolean} whether the load applied.
   */
  function loadFactoryPreset(name) {
    var factoryPreset = findFactoryPreset(name);
    if (!factoryPreset) {
      // Defensive — the dropdown/cards only ever list names the library
      // itself reported, so this needs the library to have changed
      // mid-session. Same quiet-note refusal as every other guard here.
      showPresetNote('Could not load that preset — it may have been removed.');
      return false;
    }
    applyLoadedPreset(factoryPreset);
    return true;
  }

  /**
   * Guided Patchbay: a preset's family-tag row ("GATE · EQ · COMP · REV ·
   * LIM"), derived at render time from its own node types via
   * ChainCanvas.familyInitials — the same 3-letter-code function the
   * palette chips and node-card rails use, so this can never hand-
   * maintain a second copy that drifts from the real chain.
   *
   * @param {Array<{type: string}>} nodes
   * @returns {string}
   */
  function nodeFamilyTags(nodes) {
    return nodes.map(function (entry) {
      try {
        if (window.ChainCanvas && typeof window.ChainCanvas.familyInitials === 'function') {
          return window.ChainCanvas.familyInitials(entry.type);
        }
      } catch (err) {
        /* stripped harness — the type key's own initials are the fallback */
      }
      return String(entry.type || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    }).join(' · ');
  }

  /**
   * Guided Patchbay: the Presets tab's curated browse cards — one per
   * factory preset, name + description (FactoryPresets.describeAll(),
   * additive and separate from list()'s policy-relevant shape) + a
   * family-tag row, clicking through loadFactoryPreset(). Rendered ONCE
   * at script-init time (the factory library is static content, same
   * render-once contract renderPalette() has for the registry). Guarded:
   * missing #preset-cards markup, a missing/damaged FactoryPresets, or a
   * missing describeAll() all degrade to a silently empty (or
   * description-less) card set — never a thrown error.
   */
  function renderPresetCards() {
    if (!presetCardsEl) {
      return;
    }
    presetCardsEl.innerHTML = '';
    var descriptions = {};
    try {
      if (window.FactoryPresets && typeof window.FactoryPresets.describeAll === 'function') {
        window.FactoryPresets.describeAll().forEach(function (entry) {
          if (entry && typeof entry.name === 'string') {
            descriptions[entry.name] = entry.description || '';
          }
        });
      }
    } catch (err) {
      /* degrade to description-less cards below */
    }

    factoryPresets().forEach(function (preset) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'preset-card';
      card.setAttribute('data-preset-name', preset.name);
      card.setAttribute('aria-label', 'Load ' + preset.name + ' preset');

      var title = document.createElement('strong');
      title.textContent = preset.name;
      card.appendChild(title);

      var description = descriptions[preset.name];
      if (description) {
        var small = document.createElement('small');
        small.textContent = description;
        card.appendChild(small);
      }

      var tags = document.createElement('span');
      tags.className = 'preset-card-tags';
      tags.setAttribute('aria-hidden', 'true');
      tags.textContent = nodeFamilyTags(preset.nodes);
      card.appendChild(tags);

      card.addEventListener('click', function () {
        loadFactoryPreset(preset.name);
      });
      presetCardsEl.appendChild(card);
    });
  }

  /**
   * Show the quiet inline note under the preset controls (created
   * lazily on first use, auto-hidden again after 4 s — a note, not a
   * modal). PS-4 introduced it for factory-refusal notes; issue #8
   * reused the SAME element/vehicle for persistence failure notes
   * ("Could not save/delete …"); refinement entry 5 (P3-5) moved the two
   * remaining PS-3 defensive Load guards onto it as well, so every quiet
   * refusal in this panel reads identically and the surface opens no
   * browser dialogs at all — the R2-3 rule, finally held everywhere.
   * Best-effort by construction: with no parent to anchor it to (a bare
   * harness DOM) it is a silent no-op, never a thrown error out of a
   * click handler.
   *
   * @param {string} text
   */
  function showPresetNote(text) {
    var host = presetSelectEl.parentNode;
    if (!host || typeof host.appendChild !== 'function') {
      return;
    }
    if (!presetNoteEl) {
      presetNoteEl = document.createElement('p');
      presetNoteEl.id = 'preset-note';
      presetNoteEl.className = 'preset-note';
      presetNoteEl.style.display = 'none';
      host.appendChild(presetNoteEl);
    }
    presetNoteEl.textContent = text;
    presetNoteEl.style.display = '';
    if (presetNoteTimer) {
      window.clearTimeout(presetNoteTimer);
    }
    presetNoteTimer = window.setTimeout(function () {
      presetNoteEl.style.display = 'none';
    }, 4000);
  }

  /**
   * Rebuild #preset-select's <option> list: PS-4's two groups — a
   * "Factory" <optgroup> (window.FactoryPresets' library, first) and a
   * "Yours" <optgroup> (PresetStore.listNames()' user presets). Since
   * issue #11 listNames() is a pure read (the PS-3-era fresh-profile
   * seeding was removed — it duplicated the factory Classic Karaoke),
   * so a fresh profile shows ONLY the factory group until the first
   * explicit save; the "-- no presets --" placeholder below now covers
   * the genuinely empty-store case (reachable only when the factory
   * library is also absent).
   *
   * Degrade path: when the factory library is empty/absent (script failed
   * to load, or a bare test sandbox), the dropdown renders PS-3's flat
   * user list unchanged — the panel stays usable and old sandboxes see
   * byte-identical behavior.
   *
   * Selection: a USER option matches `selectName` by its plain name; a
   * FACTORY option matches only the namespaced 'factory:<name>' form.
   * That keeps refreshPresetSelect('Warm Ballad') deterministic when a
   * user preset shares a factory name — the just-saved USER entry is the
   * one selected, never the factory look-alike.
   *
   * @param {string} [selectName] - if provided and present in a group,
   *   that option is marked selected; otherwise the browser's own default
   *   (first option) applies.
   */
  function refreshPresetSelect(selectName) {
    var names = window.PresetStore.listNames();
    var factory = factoryPresets();
    presetSelectEl.innerHTML = '';

    if (names.length === 0 && factory.length === 0) {
      var emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '-- no presets --';
      presetSelectEl.appendChild(emptyOpt);
      return;
    }

    if (factory.length === 0) {
      // Degrade path — PS-3's flat user list, byte-identical behavior.
      names.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === selectName) {
          opt.selected = true;
        }
        presetSelectEl.appendChild(opt);
      });
      return;
    }

    var factoryGroup = document.createElement('optgroup');
    factoryGroup.label = 'Factory';
    factory.forEach(function (preset) {
      var opt = document.createElement('option');
      opt.value = FACTORY_VALUE_PREFIX + preset.name;
      opt.textContent = preset.name;
      if (selectName === FACTORY_VALUE_PREFIX + preset.name) {
        opt.selected = true;
      }
      factoryGroup.appendChild(opt);
    });
    presetSelectEl.appendChild(factoryGroup);

    if (names.length > 0) {
      var userGroup = document.createElement('optgroup');
      userGroup.label = 'Yours';
      names.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === selectName) {
          opt.selected = true;
        }
        userGroup.appendChild(opt);
      });
      presetSelectEl.appendChild(userGroup);
    }
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
   * Called by ChainEditing after an accepted human or agent edit — never
   * while a candidate is merely staged, and never for a preset load (which
   * establishes a clean named baseline). Exposed on this module's export.
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

  function getDisplayState() {
    return {
      name: currentPresetName,
      modified: !!(unsavedIndicatorEl && unsavedIndicatorEl.style.display !== 'none')
    };
  }

  function applyLoadedPreset(preset) {
    if (!window.ChainEditing || typeof window.ChainEditing.apply !== 'function') {
      throw new Error('ChainEditing is required for every preset mutation.');
    }
    window.ChainEditing.apply({
      source: 'preset',
      candidate: preset.nodes,
      layout: null,
      renderOptions: { freshSeats: true },
      forceStructural: true,
      preset: { name: preset.name, modified: false }
    }).catch(function (err) {
      console.error('Presets panel: load failed', err);
      showPresetNote('Could not apply that preset. The previous chain was restored when possible.');
    });
  }

  /**
   * Issue #6: bump the agent-undo state revision after a successful human
   * Delete. Load revisions now belong to ChainEditing, while Save As owns
   * its successful-write callback in commitNamingRow(). The agent
   * save_preset path never reaches this button handler, so pure-agent undo
   * sequences keep today's semantics. Guarded: a page (or test sandbox)
   * without window.AgentUI simply skips it.
   */
  function noteHumanEditGuarded() {
    if (window.AgentUI && typeof window.AgentUI.noteHumanEdit === 'function') {
      window.AgentUI.noteHumanEdit();
    }
  }

  // R2-3: Save As… opens the inline naming row (openNamingRow /
  // commitNamingRow above) — no browser prompt(). The commit body and
  // its #8/PS-4/#6 consequences live in commitNamingRow, verbatim from
  // the old prompt path.
  saveBtn.addEventListener('click', function () {
    openNamingRow();
  });

  loadBtn.addEventListener('click', function () {
    var value = presetSelectEl.value;
    if (!value) {
      return;
    }

    // PS-4: factory selections resolve from window.FactoryPresets — the
    // user store is never consulted — then apply through the SAME
    // ChainEditing transaction a user-preset Load uses. This is also the
    // Presets tab's card-click path: one factory-load code path, not two.
    if (value.indexOf(FACTORY_VALUE_PREFIX) === 0) {
      loadFactoryPreset(value.slice(FACTORY_VALUE_PREFIX.length));
      return;
    }

    var name = value;
    var result = window.PresetStore.load(name);
    if (!result) {
      // Defensive — shouldn't normally happen since the dropdown only ever
      // lists names PresetStore itself reported as saved, but guards
      // against e.g. another tab having removed it out from under us.
      // Refinement entry 5 (P3-5): the quiet note, same as the factory
      // guard above — no browser dialog anywhere on the surface.
      showPresetNote('Could not load that preset — it may have been removed.');
      return;
    }

    // ChainEditing updates the accepted graph, board, and autosave baseline
    // as one transaction — nothing extra is needed here.
    applyLoadedPreset(result);
  });

  // R2-3: Delete is two-step in-panel — no browser confirm(). The first
  // click arms the button (relabel + safety-edge bezel + a 5 s window,
  // see armDelete/disarmDelete); the second click inside the window
  // deletes. Everything from the name check onward is the old
  // confirm()-path body, unchanged in its #8/PS-4/#6 consequences.
  deleteBtn.addEventListener('click', function () {
    var value = presetSelectEl.value;
    if (!value) {
      return;
    }

    // PS-4: factory entries are load-only shipped content, not user data —
    // a quiet inline refusal (no store.remove, the dropdown selection
    // left exactly as it was).
    if (value.indexOf(FACTORY_VALUE_PREFIX) === 0) {
      showPresetNote("Factory presets can't be deleted");
      return;
    }

    if (!deleteArmed) {
      armDelete();
      return;
    }
    disarmDelete();

    var name = value;

    // Issue #8: a delete that could not be persisted throws the typed
    // StorageError — the preset is STILL stored, so it must not vanish
    // from the list. Reconcile the dropdown from the store (what it
    // truthfully still contains) and say so through the quiet note; the
    // current-preset display is left untouched either way.
    try {
      window.PresetStore.remove(name);
    } catch (err) {
      console.error('Presets panel: Delete "' + name + '" failed — it is still saved', err);
      showPresetNote('Could not delete "' + name + '" — it is still saved (storage failure)');
      refreshPresetSelect();
      return;
    }
    refreshPresetSelect();

    // Deleting a saved preset never touches the live chain itself — only
    // reset the "currently loaded" display if the preset just removed was
    // the one being displayed as current.
    if (currentPresetName === name) {
      setCurrentPreset(null);
    }
    // Issue #6: a HUMAN delete — bump the state revision so a stale
    // agent save_preset Undo entry (whose restore re-saves or removes
    // stored content) can no longer auto-apply over the human's newer
    // store state.
    noteHumanEditGuarded();
  });

  // R2-3: the disarm observers for the two-step Delete — a press
  // anywhere that is not the Delete button itself, or an Escape, folds
  // the arm back to the plain label. Guarded so a page (or bare test
  // sandbox) without document-level listeners simply keeps the 5 s
  // window as the disarm path.
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('pointerdown', function (event) {
      if (!deleteArmed) {
        return;
      }
      var node = event.target;
      while (node) {
        if (node === deleteBtn) {
          return; // the confirming click itself — not an "elsewhere" press
        }
        node = node.parentNode;
      }
      disarmDelete();
    });
    document.addEventListener('keydown', function (event) {
      if (deleteArmed && event.key === 'Escape') {
        disarmDelete();
      }
    });
  }

  // Populate the dropdown once at script-init time. On a fresh profile
  // this shows the factory library only — PresetStore.listNames() is a
  // pure read since issue #11 (no fresh-profile seeding; the user
  // "Yours" group fills with the first explicit Save As).
  refreshPresetSelect();
  // Guided Patchbay: the curated browse cards render once too — the
  // factory library is static content, same render-once contract as the
  // dropdown's Factory optgroup above.
  renderPresetCards();

  // VIS-3: the full preset-display write path is exported, not just
  // markModified. src/mcp-tools.js (save_preset + the MC-5 undo restores)
  // previously MIRRORED these three functions' DOM operations because they
  // were private — which left this file's private `currentPresetName`
  // stale after an agent write (the Save prompt's default suggestion could
  // lag the displayed name). With the real functions exported, agents and
  // the UI buttons now share ONE write path and the private state can
  // never drift. Behavior of each function is unchanged.
  window.PresetsUI = {
    markModified: markModified,
    setCurrentPreset: setCurrentPreset,
    clearModified: clearModified,
    refreshPresetSelect: refreshPresetSelect,
    getDisplayState: getDisplayState
  };
})();
