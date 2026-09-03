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
// button to "Confirm delete" with the safety-edge bezel; a second click within
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
// Compact-browsing round: the factory-only card grid (#preset-cards) and
// the #preset-select dropdown+Load/Delete pair (the ONLY way user presets
// could be browsed) are both retired in favor of ONE searchable, scrollable
// row list (#preset-list, fed by renderPresetList()) — a real present-day
// defect, not a future one: at just the 6 shipped factory presets the old
// card grid already wrapped awkwardly with a card clipped off-screen, and
// the real "browse everything" surface was a cramped native <select> below
// the fold. renderPresetList(filterText) is now the single render path for
// initial load, every #preset-search-input keystroke, and every
// refreshPresetSelect() call (name kept — src/mcp-tools.js depends on it —
// but it now delegates here instead of rebuilding <option>s). Each preset
// is a row: a .preset-row-load button (name + a family-tag row, and for
// FACTORY rows only — PresetStore carries no description field for user
// presets, a deliberate v1 scope cut — a .preset-row-preview description
// that visually collapses at rest and reveals on hover/focus, borrowing
// .chip-preview's transition from the Effects tab's palette chips but
// deliberately NOT aria-hidden: today's cards always announce their
// description as part of the button's accessible name, and that contract
// must not silently regress just because the visual treatment is
// borrowed) plus, for USER rows only, a sibling .preset-row-delete button.
// Delete's two-step arm (armDeleteButton/disarmDeleteButton below) is the
// same arm-relabel-to-"Confirm delete"-with-an-edge-red-bezel/5s-window/no-
// confirm() contract R2-3 established, generalized off a single constant
// button to a mutable "currently armed" reference so arming any row's
// delete auto-disarms whatever else was armed (only one thing is ever
// mid-delete) — renderPresetList() itself unconditionally disarms first,
// so a re-render (including one triggered by typing a search) can never
// leave a stale armed reference pointing at a detached node.
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
  // Compact-browsing round: the dropdown+Load/Delete pair and the
  // factory-only card grid are both retired in favor of ONE searchable,
  // scrollable row list — see renderPresetList() below. Split-panel round:
  // #presets-panel-content (formerly #build-panel-presets, when Presets
  // was one tab of a shared Effects/Presets panel — renamed now that it's
  // its own dedicated panel) is the naming-row/note anchor, same role
  // #preset-select's .parentNode used to serve before it was retired.
  var presetSearchInputEl = document.getElementById('preset-search-input');
  var presetListEl = document.getElementById('preset-list');
  var presetsPanelRootEl = document.getElementById('presets-panel-content');

  if (!presetsPanelEl || !currentPresetNameEl || !presetListEl || !presetsPanelRootEl) {
    // Presets panel markup isn't present (e.g. not yet built, or
    // restructured again by a later task) — nothing to wire up.
    return;
  }

  // Sharing round: the panel's Copy link key (absent markup — a bare
  // harness — degrades to a no-op inside wireShareButton itself).
  // Declared HERE, above the call, because wireShareButton() assigns
  // shareBtnEl at module load — a mid-file `var x = null` initializer
  // below would reset it right after.
  var activePersonalPreset = null;
  var shareBtnEl = null;
  wireShareButton();

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

  // R2-3, generalized by the compact-browsing round: the two-step Delete
  // arm state — which row's delete button is currently armed (null when
  // none is), and the 5 s window that disarms it again. One button used to
  // be the only Delete button on the panel; now every user preset row has
  // its own, so the armed reference is a mutable pointer rather than a
  // single constant — arming any row's button auto-disarms whatever else
  // was armed (see armDeleteButton), keeping the same "only one thing is
  // ever mid-delete" contract with N possible buttons instead of one.
  var DELETE_ARM_LABEL = 'Confirm delete';
  var DELETE_ARM_WINDOW_MS = 5000;
  var armedDeleteBtn = null;
  var armedDeleteName = null;
  var deleteArmTimer = null;

  // Compact-browsing round: remembers the last preset name/kind passed to
  // refreshPresetSelect(selectName) (in the dropdown/optgroup vocabulary —
  // a plain user name, or 'factory:<name>') so the matching row can be
  // highlighted .preset-row-active — and so that identity SURVIVES a
  // search-only re-render (typing in #preset-search-input calls
  // renderPresetList() directly, without going through
  // refreshPresetSelect(), so it must not reset which row reads as active).
  var lastActivePresetKey = null;

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
    var host = presetsPanelRootEl;
    if (!host || typeof host.appendChild !== 'function') {
      return;
    }
    namingRowEl = document.createElement('div');
    namingRowEl.id = 'preset-name-row';
    namingRowEl.className = 'preset-name-row';
    namingRowEl.style.display = 'none';

    var label = document.createElement('label');
    label.className = 'preset-name-label';
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
  /**
   * The Save As commit's validation + write + state-sync core, extracted
   * (wayfinder #49) so Simple's own "Save this sound" flow
   * (src/simple-view.js) can drive the exact same
   * PresetStore.save() -> refreshPresetSelect/setCurrentPreset/
   * clearModified sequence this panel's naming row already uses — one
   * save path, never two that could drift. Presentation (showing the
   * failure note, collapsing an open row) stays with each caller; this
   * function only validates, writes, and reports what happened.
   *
   * PS-4 note: this ALWAYS writes the USER store (PresetStore.save),
   * even when `name` collides with a factory name — namespaces are
   * separate, so a user "Warm Ballad" simply appears beside the factory
   * one, and refreshPresetSelect(trimmed) selects the USER option.
   *
   * Issue #8: on failure NOTHING downstream runs — no dropdown refresh,
   * no current-preset display change, no clearModified().
   *
   * @param {string} name
   * @returns {{ok: boolean, name?: string, message?: string}}
   */
  function saveCurrentChainAs(name) {
    var trimmed = (name || '').trim();
    if (trimmed.length === 0) {
      return { ok: false, message: 'Give the preset a name first.' };
    }
    if (trimmed.length > 40) {
      // Defensive — the naming row's input maxLength stops typing past
      // 40; a paste path that somehow bypasses it still meets the same
      // bound here.
      return { ok: false, message: 'Enter 1 to 40 characters.' };
    }
    try {
      window.PresetStore.save(trimmed, window.ChainCanvas.getCurrentModel());
    } catch (err) {
      console.error('Presets panel: Save As "' + trimmed + '" failed — nothing was written', err);
      return { ok: false, message: 'Could not save "' + trimmed + '". Your chain is still live, but this preset was not saved. Try again.' };
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
    return { ok: true, name: trimmed };
  }

  function commitNamingRow() {
    if (!namingRowOpen) {
      return;
    }
    var result = saveCurrentChainAs(namingInputEl.value);
    if (!result.ok) {
      showPresetNote(result.message);
      return;
    }
    collapseNamingRow();
  }

  /**
   * R2-3, generalized: disarm the two-step Delete — restore whichever
   * row's button is currently armed to its plain "Delete" label and
   * bezel, cancel the expiry window. Idempotent (a no-op when nothing is
   * armed), and safe to call against a button whose row was since removed
   * from the DOM by a re-render (setting textContent/className on a
   * detached node is harmless).
   */
  function disarmDeleteButton() {
    if (!armedDeleteBtn) {
      return;
    }
    var btn = armedDeleteBtn;
    armedDeleteBtn = null;
    armedDeleteName = null;
    if (deleteArmTimer) {
      window.clearTimeout(deleteArmTimer);
      deleteArmTimer = null;
    }
    btn.textContent = 'Delete';
    btn.className = 'preset-row-delete';
    if (typeof btn.setAttribute === 'function') {
      btn.setAttribute('aria-live', 'off');
    }
  }

  /**
   * R2-3, generalized: arm one row's two-step Delete button. It relabels
   * to Confirm delete with the safety-edge-red bezel (an EDGE, never the
   * Bypass-only red fill), and a 5 s window holds the armed state.
   * Disarms whatever else was armed first, so only one row is EVER
   * mid-delete at a time (arming a second row's button is not a bug —
   * it is how you change your mind about which one you're deleting).
   * Anything else — the window expiring, a press elsewhere, Escape, or a
   * fresh render (a search keystroke) — disarms (see the document
   * listeners wired once below, and renderPresetList()'s own call).
   *
   * @param {HTMLElement} btn
   * @param {string} name
   */
  function armDeleteButton(btn, name) {
    disarmDeleteButton();
    armedDeleteBtn = btn;
    armedDeleteName = name;
    btn.textContent = DELETE_ARM_LABEL;
    btn.className = 'preset-row-delete danger-arm';
    if (typeof btn.setAttribute === 'function') {
      // The relabel is the whole signal — announce it, since styling
      // never carries the meaning alone.
      btn.setAttribute('aria-live', 'polite');
    }
    deleteArmTimer = window.setTimeout(function () {
      deleteArmTimer = null;
      disarmDeleteButton();
    }, DELETE_ARM_WINDOW_MS);
  }

  /**
   * The full two-step Delete gesture for one user preset's button: arms
   * on a first click (or re-arms if a DIFFERENT row was armed), confirms
   * and deletes on a second click on the SAME already-armed button.
   * Extracted from buildPresetRow's own click handler (wayfinder #49) so
   * Simple's own Yours cards (src/simple-view.js) can drive the exact
   * same arm/disarm state and PresetStore.remove() path this panel's
   * rows already use — one delete path, never two that could drift, and
   * arming a delete in one view correctly shows as armed in the other
   * too (they share armedDeleteBtn), rather than each view silently
   * tracking its own.
   *
   * @param {HTMLElement} btn
   * @param {string} name
   */
  /**
   * @returns {boolean} true only when this call actually deleted the
   *   preset (the second, confirming click) — false for the arming
   *   click and for a failed delete. armDeleteButton/disarmDeleteButton
   *   already mutate the SAME button node imperatively (label, class,
   *   aria-live), so neither of those two cases needs — or should
   *   trigger — a caller-side re-render; only a true return does
   *   (src/simple-view.js's card menu relies on exactly this to know
   *   when its OWN list must drop the now-gone card, vs. leaving the
   *   armed/failed button's own DOM node alone).
   */
  function toggleDeleteArm(btn, name) {
    if (armedDeleteBtn !== btn) {
      armDeleteButton(btn, name);
      return false;
    }
    disarmDeleteButton();

    // Issue #8: a delete that could not be persisted throws the typed
    // StorageError — the preset is STILL stored, so it must not vanish
    // from the list. Reconcile from the store (what it truthfully still
    // contains) and say so through the quiet note; the current-preset
    // display is left untouched either way.
    try {
      window.PresetStore.remove(name);
    } catch (err) {
      console.error('Presets panel: Delete "' + name + '" failed — it is still saved', err);
      showPresetNote('Could not delete "' + name + '". It is still saved. Try again.');
      refreshPresetSelect();
      return false;
    }
    refreshPresetSelect();

    // Deleting a saved preset never touches the live chain itself — only
    // reset the "currently loaded" display if the preset just removed was
    // the one being displayed as current.
    if (currentPresetName === name) {
      setCurrentPreset(null);
    }
    // Issue #6: a HUMAN delete — bump the state revision so a stale agent
    // save_preset Undo entry (whose restore re-saves or removes stored
    // content) can no longer auto-apply over the human's newer store
    // state.
    noteHumanEditGuarded();
    return true;
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
   * preset by name and submits it through the same applyLoadedPreset()
   * -> ChainEditing.apply() transaction the dropdown+Load button's
   * factory branch and every user-preset load use (defined further down
   * this file, alongside getDisplayState()). ChainEditing owns the
   * display-state update (the request's `preset` field) as part of the
   * atomic transaction, so a rejected/rolled-back load can never leave
   * the name/unsaved-dot display ahead of what actually committed —
   * this function no longer touches setCurrentPreset/clearModified
   * directly. Shared by BOTH the dropdown+Load button's factory branch
   * and the Presets tab's curated cards, so there is exactly one
   * factory-load code path, never two that could drift.
   *
   * @param {string} name - the preset's plain (unprefixed) name.
   * @returns {boolean} whether a load was submitted.
   */
  function loadFactoryPreset(name) {
    var factoryPreset = findFactoryPreset(name);
    if (!factoryPreset) {
      // Defensive — the dropdown/cards only ever list names the library
      // itself reported, so this needs the library to have changed
      // mid-session. Same quiet-note refusal as every other guard here.
      showPresetNote('That preset is no longer available. Choose another preset.');
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
   * The USER-preset twin of loadFactoryPreset() — resolves a saved preset
   * by name from window.PresetStore and submits it through the same
   * applyLoadedPreset() -> ChainEditing.apply() transaction every other
   * load uses. Previously this body lived inline in the Load button's
   * non-factory branch; now every user row's own click handler calls it
   * directly (there is no separate Load button to click through anymore).
   *
   * @param {string} name
   */
  function loadUserPreset(name) {
    var result = window.PresetStore.load(name);
    if (!result) {
      // Defensive — a row only ever lists names the store itself reported,
      // so this needs the store to have changed since the last render
      // (e.g. another tab removed it). Same quiet-note refusal as every
      // other guard in this file.
      showPresetNote('That preset is no longer available. Choose another preset.');
      return;
    }
    applyLoadedPreset(result);
  }

  // Per-page counter for row-description ids (see buildPresetRow): the
  // list rebuilds wholesale on every refresh, so fresh unique ids per
  // build are sufficient — no name-derived ids that could collide when
  // a user preset shares a factory name.
  var presetRowDescIdCounter = 0;

  /**
   * One preset row: a .preset-row-load button (name, then — FACTORY rows
   * only — a hover/focus-revealed description, then a hidden family-tag
   * row) and, for USER rows only, a sibling .preset-row-delete button.
   * Two real sibling <button>s (never a button nested inside a button —
   * invalid markup and unreachable to assistive tech) inside one
   * non-interactive wrapping <div>, so both stay independently focusable
   * and keyboard-operable with zero custom key handling, the same way the
   * Effects tab's node-chips already are.
   *
   * @param {string} name
   * @param {Array<{type: string}>} nodes
   * @param {'factory'|'user'} kind
   * @param {string} [description] - factory rows only.
   * @param {boolean} isActive - highlight as the currently-loaded preset.
   * @returns {HTMLElement}
   */
  function buildPresetRow(name, nodes, kind, description, isActive) {
    var row = document.createElement('div');
    row.className = 'preset-row' + (isActive ? ' preset-row-active' : '');
    row.setAttribute('data-preset-name', name);
    row.setAttribute('data-preset-kind', kind);

    var loadBtnEl = document.createElement('button');
    loadBtnEl.type = 'button';
    loadBtnEl.className = 'preset-row-load';
    // Same accname contract as Simple's Sounds rows (audit 2026-09-02,
    // P2): the accessible name is the ACTION ("Try <name>"), and the
    // description rides in aria-describedby, available on demand, rather
    // than being read out as part of every row's name.
    loadBtnEl.setAttribute('aria-label', 'Try ' + name);

    var nameEl = document.createElement('span');
    nameEl.className = 'preset-row-name';
    nameEl.textContent = name;
    loadBtnEl.appendChild(nameEl);

    if (description) {
      // Reuses .chip-preview's collapse-at-rest/reveal-on-hover-or-focus
      // CSS transition (styles/main.css) — visual treatment only. The
      // description text itself moves OUT of the button's accessible
      // name and into the aria-describedby chain above (harden round:
      // 33 verbose row names was the audit's P2); it stays fully
      // available to assistive tech, just no longer spoken per row.
      var previewEl = document.createElement('span');
      previewEl.className = 'preset-row-preview';
      presetRowDescIdCounter += 1;
      previewEl.id = 'preset-row-desc-' + presetRowDescIdCounter;
      previewEl.textContent = description;
      loadBtnEl.appendChild(previewEl);
      loadBtnEl.setAttribute('aria-describedby', previewEl.id);
    }

    var tagsEl = document.createElement('span');
    tagsEl.className = 'preset-row-tags';
    tagsEl.setAttribute('aria-hidden', 'true');
    tagsEl.textContent = nodeFamilyTags(nodes);
    loadBtnEl.appendChild(tagsEl);

    loadBtnEl.addEventListener('click', function () {
      if (kind === 'factory') {
        loadFactoryPreset(name);
      } else {
        loadUserPreset(name);
      }
    });
    row.appendChild(loadBtnEl);

    if (kind === 'user') {
      var deleteBtnEl = document.createElement('button');
      deleteBtnEl.type = 'button';
      deleteBtnEl.className = 'preset-row-delete';
      deleteBtnEl.textContent = 'Delete';
      // R2-3, generalized: first click on an unarmed (or differently
      // armed) row's button ARMS this one instead — no browser confirm()
      // anywhere. A second click on the SAME already-armed button, within
      // the window, confirms. See toggleDeleteArm's own comment.
      deleteBtnEl.addEventListener('click', function () {
        toggleDeleteArm(deleteBtnEl, name);
      });
      row.appendChild(deleteBtnEl);
    }

    return row;
  }

  /**
   * Compact-browsing v2 (amended by wayfinder #30/#28): the display order
   * for factory categories (describeAll()'s `category` field — the
   * taxonomy primary tag, humanized). The order is the taxonomy's own
   * group order via FactoryPresets.groupOrder() (cleanup first, then
   * use-case, genre, vibe, gag), replacing v2's hand-assigned
   * Karaoke/Music/Novelty/Speech list — one source of truth. The empty
   * fallback covers bare sandboxes where the loader lacks the taxonomy
   * surface; anything present in the data but not listed still renders,
   * just after these, alphabetically last, rather than being silently
   * dropped (the same no-silent-drop discipline canvas.js's
   * paletteGroupLabel()/familyInitials() already follow).
   */
  var PRESET_CATEGORY_ORDER = (window.FactoryPresets &&
      typeof window.FactoryPresets.groupOrder === 'function')
    ? window.FactoryPresets.groupOrder()
    : [];

  /**
   * Compact-browsing round: the ONE render path for the Presets tab's
   * browse surface — initial load, every #preset-search-input keystroke,
   * and every refreshPresetSelect() call (below) all funnel through this.
   * Merges factoryPresets() + window.PresetStore.listNames() into TWO
   * groups ("Factory" then "Yours", real non-interactive <h3>s — the
   * Effects tab's .palette-group-label vocabulary, reused verbatim);
   * within "Factory", v2 sub-groups by describeAll()'s `category` field
   * (PRESET_CATEGORY_ORDER above) under <h4 class="preset-category-label">
   * sub-headers — "Yours" stays flat, since user-saved presets carry no
   * category data (a deliberate v1 scope cut, same discipline already
   * applied to user rows carrying no description). Filters everything by
   * a live case-insensitive substring match against a preset's name PLUS
   * its own nodes' TYPE strings — not nodeFamilyTags()'s 3-letter rail
   * codes, which "reverb" can't substring-match — so "reverb" surfaces
   * every reverb-heavy preset, not just literal name matches — PLUS its
   * category, so "novelty"/"karaoke" also filter, PLUS its public tags
   * and (factory only) its description, the two fields Simple's Sounds
   * search already matches (2026-09-03 unification: the same word must
   * find the same sounds in both views; the internal technique: axis is
   * stripped on both sides per settled #43). Renders a .preset-row
   * per surviving entry via buildPresetRow().
   *
   * Unconditionally disarms any in-progress two-step Delete first — a
   * re-render (this function wipes and rebuilds #preset-list every call)
   * would otherwise leave armedDeleteBtn pointing at a detached node.
   *
   * Empty states (styles/main.css .preset-list-empty, the panel's shared
   * quiet muted-print tier): "No presets yet" when the merged UNFILTERED
   * library is genuinely empty (both FactoryPresets and PresetStore); a
   * "No presets match…" line when a search simply matched nothing.
   *
   * @param {string} [filterText]
   */
  function renderPresetList(filterText) {
    disarmDeleteButton();

    if (!presetListEl) {
      return;
    }
    presetListEl.innerHTML = '';
    activePersonalPreset = null;
    // A pending shared sound reads FIRST — it is an event the operator
    // just arrived on, not one more row to browse past.
    renderShareArrivalInto(presetListEl);

    var filterNorm = (filterText || '').trim().toLowerCase();
    var descriptions = {};
    var categories = {};
    var tagHaystacks = {};
    try {
      if (window.FactoryPresets && typeof window.FactoryPresets.describeAll === 'function') {
        window.FactoryPresets.describeAll().forEach(function (entry) {
          if (entry && typeof entry.name === 'string') {
            descriptions[entry.name] = entry.description || '';
            categories[entry.name] = entry.category || '';
          }
        });
      }
      // Wayfinder #28: the taxonomy TAGS are search fodder too — "pop",
      // "telephone", "cleanup" reach presets tagged with them even when
      // the word is in neither the name nor the category label.
      // listDetailed() never carries nodes, so this read cannot become a
      // load path. PUBLIC axes only (2026-09-03 vocabulary unification,
      // refinement critique P2 #3): the internal technique: axis is
      // stripped exactly the way Simple's search strips it
      // (simple-view.js publicTags), per settled #43 — it is coverage/
      // dedup vocabulary, never user-facing, and the same word must
      // find the same sounds in both views.
      if (window.FactoryPresets && typeof window.FactoryPresets.listDetailed === 'function') {
        window.FactoryPresets.listDetailed().forEach(function (entry) {
          if (entry && typeof entry.name === 'string' && Array.isArray(entry.tags)) {
            tagHaystacks[entry.name] = entry.tags
              .filter(function (t) { return t.indexOf('technique:') !== 0; })
              .join(' ')
              .toLowerCase();
          }
        });
      }
    } catch (err) {
      /* degrade to description-less, uncategorized rows below */
    }

    var factory = factoryPresets();
    var userNames = window.PresetStore.listNames();

    function matches(name, nodes, category, tagsHaystack, description) {
      if (!filterNorm) {
        return true;
      }
      // Match against the node TYPE strings ('reverb', 'compressor', …),
      // not nodeFamilyTags()'s 3-letter rail codes ('REV', 'COM') — a
      // search for "reverb" must find every reverb-heavy preset, and a
      // substring match against an abbreviation can't do that. Wayfinder
      // #28: taxonomy tags join the haystack ('genre:pop', 'gag:robot',
      // …), so a search for "pop" or "cleanup" reaches tagged presets.
      // 2026-09-03 vocabulary unification: the DESCRIPTION joins too —
      // Simple's search already matches name + description + public
      // tags, and a word that finds a sound in Simple ("arena" → Big
      // Room, a description word) must find it here as well. Node types
      // and category stay Advanced-only fields (the expert vocabulary
      // this panel is for); user presets carry no description by the
      // same v1 scope cut that leaves them uncategorized.
      var typeWords = nodes.map(function (n) { return n.type; }).join(' ');
      var haystack = (name + ' ' + typeWords + ' ' + (category || '') + ' ' +
        (tagsHaystack || '') + ' ' + (description || '')).toLowerCase();
      return haystack.indexOf(filterNorm) !== -1;
    }

    var visibleFactory = factory.filter(function (preset) {
      return matches(preset.name, preset.nodes, categories[preset.name], tagHaystacks[preset.name], descriptions[preset.name]);
    });
    var visibleUser = [];
    userNames.forEach(function (name) {
      var stored = window.PresetStore.load(name);
      var nodes = stored ? stored.nodes : [];
      if (matches(name, nodes, '')) {
        visibleUser.push({ name: name, nodes: nodes });
      }
    });

    if (factory.length === 0 && userNames.length === 0) {
      var emptyAll = document.createElement('p');
      emptyAll.className = 'preset-list-empty';
      emptyAll.textContent = 'No presets are available.';
      presetListEl.appendChild(emptyAll);
      return;
    }

    if (visibleFactory.length === 0 && visibleUser.length === 0) {
      var emptyFiltered = document.createElement('p');
      emptyFiltered.className = 'preset-list-empty';
      emptyFiltered.textContent = 'No presets match "' + (filterText || '') + '". Clear the search to see all presets.';
      presetListEl.appendChild(emptyFiltered);
      return;
    }

    if (visibleFactory.length > 0) {
      var factoryLabel = document.createElement('h3');
      factoryLabel.className = 'preset-group-label';
      factoryLabel.textContent = 'Factory';
      presetListEl.appendChild(factoryLabel);

      // Bucket by category, in PRESET_CATEGORY_ORDER, unrecognized
      // categories last (sorted, never silently dropped).
      var buckets = {};
      var bucketOrder = [];
      visibleFactory.forEach(function (preset) {
        var cat = categories[preset.name] || 'Other';
        if (!buckets[cat]) {
          buckets[cat] = [];
          bucketOrder.push(cat);
        }
        buckets[cat].push(preset);
      });
      bucketOrder.sort(function (a, b) {
        var ai = PRESET_CATEGORY_ORDER.indexOf(a);
        var bi = PRESET_CATEGORY_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) { return a.localeCompare(b); }
        if (ai === -1) { return 1; }
        if (bi === -1) { return -1; }
        return ai - bi;
      });

      bucketOrder.forEach(function (cat) {
        // A sub-group header earns its line only when it GROUPS. A
        // category holding a single VISIBLE row is a search result, not
        // a group — printing "Cleanup" over one row is how 33 presets
        // fragmented under ~27 one-item headers in a 260px column
        // (critique 2026-09-02, P2). The row itself is unchanged and
        // the category stays discoverable through search either way.
        if (buckets[cat].length >= 2) {
          var catLabel = document.createElement('h4');
          catLabel.className = 'preset-category-label';
          catLabel.textContent = cat;
          presetListEl.appendChild(catLabel);
        }
        buckets[cat].forEach(function (preset) {
          var isActive = lastActivePresetKey === FACTORY_VALUE_PREFIX + preset.name;
          presetListEl.appendChild(
            buildPresetRow(preset.name, preset.nodes, 'factory', descriptions[preset.name], isActive)
          );
        });
      });
    }

    if (visibleUser.length > 0) {
      var userLabel = document.createElement('h3');
      userLabel.className = 'preset-group-label';
      userLabel.textContent = 'Yours';
      presetListEl.appendChild(userLabel);
      visibleUser.forEach(function (entry) {
        var isActive = lastActivePresetKey === entry.name;
        if (isActive) {
          activePersonalPreset = entry.name;
        }
        presetListEl.appendChild(
          buildPresetRow(entry.name, entry.nodes, 'user', null, isActive)
        );
      });
    }

    updateShareButton();
  }

  // ---------------------------------------------------------------------
  // SHARING (shape round, 2026-09-02): a personal preset travels as a
  // LINK — the preset itself, deflate-compressed into the URL fragment
  // by src/preset-link.js. Two surfaces here: the panel's Copy link key
  // (enabled exactly when the ACTIVE preset is one of Yours) and the
  // arrival card a #preset= landing renders into whichever panel is
  // showing. Both are quiet-inline by the panel's own rules: no
  // browser dialogs, feedback through the .preset-note line.
  // (activePersonalPreset / shareBtnEl are declared near the module's
  // element wiring, above wireShareButton's load-time call.)
  // ---------------------------------------------------------------------

  function updateShareButton() {
    if (!shareBtnEl) {
      return;
    }
    var ready = !!activePersonalPreset &&
      !!window.PresetLink &&
      typeof window.PresetLink.buildShareUrl === 'function';
    shareBtnEl.disabled = !ready;
    shareBtnEl.title = ready
      ? ''
      : 'Load one of your own sounds to share it';
  }

  /** Copy via the sharing module's own clipboard helper (async API with
   *  the plain-http legacy fallback — one implementation, both panels). */
  function copyTextToClipboard(text, onDone) {
    if (window.PresetLink && typeof window.PresetLink.copyToClipboard === 'function') {
      window.PresetLink.copyToClipboard(text).then(function (ok) {
        if (typeof onDone === 'function') {
          onDone(ok);
        }
      });
      return;
    }
    if (typeof onDone === 'function') {
      onDone(false);
    }
  }

  function wireShareButton() {
    shareBtnEl = document.getElementById('share-preset-btn');
    if (!shareBtnEl || typeof shareBtnEl.addEventListener !== 'function') {
      return;
    }
    shareBtnEl.addEventListener('click', function () {
      if (!activePersonalPreset || !window.PresetLink) {
        return;
      }
      var name = activePersonalPreset;
      var record = window.PresetStore && typeof window.PresetStore.load === 'function'
        ? window.PresetStore.load(name)
        : null;
      if (!record) {
        showPresetNote('Could not read "' + name + '" to share it.');
        return;
      }
      window.PresetLink.buildShareUrl(name, record.nodes).then(function (result) {
        if (!result.ok) {
          showPresetNote(result.message);
          return;
        }
        copyTextToClipboard(result.url, function (ok) {
          showPresetNote(ok
            ? 'Link copied for "' + name + '" — paste it anywhere.'
            : 'Copy failed. Link: ' + result.url);
        });
      });
    });
    updateShareButton();
  }

  // The arrival card's own transient state, held OUTSIDE the rebuilt
  // DOM so a list re-render mid-collision keeps the operator's place.
  var shareCollisionMode = false;
  var shareNote = '';

  function plainSummaryOf(nodes) {
    var parts = [];
    (nodes || []).forEach(function (entry) {
      var label = null;
      try {
        if (window.EffectCatalog && typeof window.EffectCatalog.getPlainLabel === 'function') {
          label = window.EffectCatalog.getPlainLabel(entry.type);
        }
      } catch (err) {
        label = null;
      }
      parts.push(label || entry.type);
    });
    return parts.join(' \u00B7 ');
  }

  function refreshAfterShareChange() {
    try {
      refreshPresetSelect(lastActivePresetKey);
    } catch (err) { /* panel absent in stripped harnesses */ }
    try {
      if (window.SimpleView && typeof window.SimpleView.onChainChanged === 'function') {
        window.SimpleView.onChainChanged();
      }
    } catch (err) { /* Simple absent */ }
  }

  /** Build the arrival card for the pending shared sound (or its
   *  refusal) into `container`. Shared by BOTH panels — Advanced's
   *  #preset-list and Simple's Sounds library — so the arrival
   *  experience is one surface, not two. */
  function renderShareArrivalInto(container) {
    if (!container || typeof container.appendChild !== 'function' || !window.PresetLink) {
      return;
    }
    var pending = window.PresetLink.getPendingShare();
    if (!pending) {
      return;
    }
    var card = document.createElement('div');
    card.className = 'share-arrival-card';
    card.setAttribute('data-share-arrival', 'true');

    var title = document.createElement('p');
    title.className = 'share-arrival-title';
    if (pending.ok) {
      title.textContent = 'A sound was shared with you: ' + pending.name;
    } else {
      title.textContent = 'A sound link arrived';
    }
    card.appendChild(title);

    if (pending.ok) {
      var summary = document.createElement('p');
      summary.className = 'share-arrival-summary';
      summary.textContent = plainSummaryOf(pending.nodes);
      card.appendChild(summary);
    } else {
      var why = document.createElement('p');
      why.className = 'share-arrival-summary';
      why.textContent = pending.message;
      card.appendChild(why);
    }

    if (shareNote) {
      var note = document.createElement('p');
      note.className = 'share-arrival-note';
      note.textContent = shareNote;
      card.appendChild(note);
    }

    var actions = document.createElement('div');
    actions.className = 'share-arrival-actions';

    function key(label, handler, extraClass) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'control' + (extraClass ? ' ' + extraClass : '');
      btn.textContent = label;
      btn.addEventListener('click', handler);
      actions.appendChild(btn);
      return btn;
    }

    function handleSaveResult(result) {
      if (result && result.ok) {
        shareCollisionMode = false;
        shareNote = '';
        window.PresetLink.clearPendingShare();
        showPresetNote((result.replaced ? 'Replaced "' : 'Added "') + result.name +
          (result.replaced ? '" with the shared sound.' : '" to your sounds.'));
        refreshAfterShareChange();
        return;
      }
      if (result && result.code === 'COLLISION') {
        shareCollisionMode = true;
        shareNote = result.message.name ? result.message.message : result.message;
        refreshAfterShareChange();
        return;
      }
      shareNote = (result && result.message) || 'Could not add the shared sound.';
      refreshAfterShareChange();
    }

    if (pending.ok && !shareCollisionMode) {
      key('Add to my sounds', function () {
        handleSaveResult(window.PresetLink.savePendingShare({ mode: 'add' }));
      }, 'share-arrival-primary');
      key('Dismiss', function () {
        window.PresetLink.clearPendingShare();
        shareCollisionMode = false;
        shareNote = '';
        refreshAfterShareChange();
      });
    } else if (pending.ok && shareCollisionMode) {
      // The collision triad: Rename (inline input + Save), Replace,
      // Cancel — explicit keys, no browser dialogs (the house rule).
      var renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.className = 'preset-name-input share-arrival-rename';
      renameInput.value = pending.name + ' (shared)';
      renameInput.setAttribute('aria-label', 'New name for the shared sound');
      actions.appendChild(renameInput);
      key('Save as', function () {
        handleSaveResult(window.PresetLink.savePendingShare({
          mode: 'rename',
          newName: renameInput.value
        }));
      }, 'share-arrival-primary');
      key('Replace', function () {
        handleSaveResult(window.PresetLink.savePendingShare({ mode: 'replace' }));
      });
      key('Cancel', function () {
        shareCollisionMode = false;
        shareNote = '';
        refreshAfterShareChange();
      });
    } else {
      key('Dismiss', function () {
        window.PresetLink.clearPendingShare();
        shareNote = '';
        refreshAfterShareChange();
      });
    }

    card.appendChild(actions);
    container.appendChild(card);
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
    var host = presetsPanelRootEl;
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
   * Rebuild the Presets tab's browse list (name kept — src/mcp-tools.js
   * calls this by name after every agent-driven store change, per its own
   * "presetsUiRefreshPresetSelect" comment — treated as an opaque
   * refresh-the-human-panel call, so the exact rendering underneath is
   * free to change). Delegates to renderPresetList(), reading
   * #preset-search-input's CURRENT value so a save/delete/load never
   * clobbers whatever the operator was mid-typing into the search box.
   *
   * Selection: a USER preset matches `selectName` by its plain name; a
   * FACTORY preset matches only the namespaced 'factory:<name>' form
   * (unchanged convention from the old dropdown's option values) — that
   * keeps refreshPresetSelect('Warm Ballad') deterministic when a user
   * preset shares a factory name, highlighting the just-saved USER row,
   * never the factory look-alike. When provided, `selectName` is also
   * remembered (lastActivePresetKey) so the highlight survives later
   * search-only re-renders that don't pass one.
   *
   * @param {string} [selectName]
   */
  function refreshPresetSelect(selectName) {
    if (typeof selectName !== 'undefined') {
      lastActivePresetKey = selectName;
    }
    renderPresetList(presetSearchInputEl ? presetSearchInputEl.value : '');
  }

  function syncCanvasPresetState() {
    if (!window.CanvasRegister ||
        typeof window.CanvasRegister.showPresetState !== 'function') {
      return;
    }
    window.CanvasRegister.showPresetState(
      currentPresetName,
      !!(unsavedIndicatorEl && unsavedIndicatorEl.style.display !== 'none')
    );
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
    syncCanvasPresetState();
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
    syncCanvasPresetState();
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
    syncCanvasPresetState();
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

  // Compact-browsing round: Load and Delete are no longer shared buttons
  // acting on a dropdown's selection — every row carries its own Load
  // (buildPresetRow's .preset-row-load click handler, which calls
  // loadFactoryPreset()/loadUserPreset()) and, for user rows, its own
  // Delete (buildPresetRow's .preset-row-delete click handler, which
  // carries the SAME #8/PS-4/#6 consequences the old shared Delete button
  // had). Live search-as-you-type re-renders the whole list on every
  // keystroke — cheap at the preset counts this panel deals with, and it
  // is what keeps a search-driven re-render from ever leaving a stale
  // .preset-row-active highlight or an armed-but-now-hidden Delete button
  // around (renderPresetList() disarms unconditionally on every call).
  if (presetSearchInputEl) {
    presetSearchInputEl.addEventListener('input', function () {
      renderPresetList(presetSearchInputEl.value);
    });
  }

  // R2-3, generalized: the disarm observers for the two-step Delete — a
  // press anywhere that is not the currently-armed row's own button, or
  // an Escape, folds the arm back to the plain label. Guarded so a page
  // (or bare test sandbox) without document-level listeners simply keeps
  // the 5 s window as the disarm path.
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('pointerdown', function (event) {
      if (!armedDeleteBtn) {
        return;
      }
      var node = event.target;
      while (node) {
        if (node === armedDeleteBtn) {
          return; // the confirming click itself — not an "elsewhere" press
        }
        node = node.parentNode;
      }
      disarmDeleteButton();
    });
    document.addEventListener('keydown', function (event) {
      if (armedDeleteBtn && event.key === 'Escape') {
        disarmDeleteButton();
      }
    });
  }

  // Populate the browse list once at script-init time. On a fresh profile
  // this shows the factory library only — PresetStore.listNames() is a
  // pure read since issue #11 (no fresh-profile seeding; the "Yours"
  // group fills with the first explicit Save As).
  refreshPresetSelect();
  syncCanvasPresetState();

  // VIS-3: the full preset-display write path is exported, not just
  // markModified. src/mcp-tools.js (save_preset + the MC-5 undo restores)
  // previously MIRRORED these three functions' DOM operations because they
  // were private — which left this file's private `currentPresetName`
  // stale after an agent write (the Save prompt's default suggestion could
  // lag the displayed name). With the real functions exported, agents and
  // the UI buttons now share ONE write path and the private state can
  // never drift. Behavior of each function is unchanged.
  //
  // wayfinder #48: loadFactoryPreset/loadUserPreset join the export for
  // the same reason — "Try a preset" from Simple's own library cards
  // (src/simple-view.js) submits through the EXACT SAME
  // applyLoadedPreset() -> ChainEditing.apply() transaction this panel's
  // own rows already use, so there is still exactly one load path, not
  // two that could drift. Failure notes (a preset removed mid-session)
  // still surface via showPresetNote() into THIS panel's own DOM, even
  // when triggered from Simple — a known, narrow gap while Advanced sits
  // hidden, not a silent one (the load itself still refuses cleanly).
  // wayfinder #49: toggleDeleteArm/disarmDeleteButton join the export for
  // the same reason loadFactoryPreset/loadUserPreset did in #48 — Simple's
  // own Yours cards (src/simple-view.js) drive the EXACT SAME two-step
  // arm/confirm state and PresetStore.remove() path this panel's own
  // rows use, so there remains exactly one delete path.
  window.PresetsUI = {
    markModified: markModified,
    setCurrentPreset: setCurrentPreset,
    clearModified: clearModified,
    refreshPresetSelect: refreshPresetSelect,
    getDisplayState: getDisplayState,
    loadFactoryPreset: loadFactoryPreset,
    loadUserPreset: loadUserPreset,
    toggleDeleteArm: toggleDeleteArm,
    disarmDeleteButton: disarmDeleteButton,
    saveCurrentChainAs: saveCurrentChainAs,
    renderShareArrivalInto: renderShareArrivalInto
  };
})();
