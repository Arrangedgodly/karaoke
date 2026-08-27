// Named, multi-preset localStorage for the Node-Based Web Audio Chain
// Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends on
// window.PresetSchema (src/preset-schema.js) and window.DEFAULT_PRESET
// (src/default-preset.js) — both already loaded by the time this file runs,
// per index.html's script order.
//
// PS-3 scope: this is a DIFFERENT thing from src/persistence.js's PS-2
// autosave. Persistence owns exactly ONE implicit slot — "whatever chain I
// last had open" — written on every edit and read back once on page load,
// with no user-visible name attached to it at all. PresetStore, here, owns
// an arbitrary number of NAMED, user-managed presets — each one only
// created/overwritten/removed by an explicit user action (Save As/Delete),
// under its own STORAGE_KEY so the two never collide or interact. A preset
// saved here is never touched by autosave, and the autosave slot is never
// listed here.
//
// Consumed by src/presets-ui.js, which is the only caller:
//   - listNames() populates the `#preset-select` dropdown, both once at
//     script-init time (so the list is visible even before Start is
//     clicked) and again after every Save As/Delete.
//   - save() backs the "Save As…" button, handed whatever
//     window.ChainCanvas.getCurrentModel() returns at that moment.
//   - load() backs the "Load" button; presets-ui.js hands its `.nodes`
//     straight to window.ChainCanvas.loadModel().
//   - remove() backs the "Delete" button.
//
// Fails safe, always, same philosophy as src/persistence.js: corrupt/
// unparsable stored JSON is logged via console.error and treated as if
// nothing were stored at all, never thrown up to the caller.
(function () {
  'use strict';

  var STORAGE_KEY = 'karaoke-presets-v1';

  /**
   * Read and validate the stored `name -> serialized preset` map. Never
   * throws — a missing key, a JSON.parse() failure, or a top-level shape
   * that isn't a plain object are all logged via console.error (except the
   * plain "nothing stored yet" case, which is silent) and treated as an
   * empty map, exactly like a fresh profile.
   *
   * Deliberately does NOT run each individual entry through
   * PresetSchema.deserialize() here — that would mean either throwing away
   * every OTHER, perfectly valid preset just because one entry is corrupt,
   * or building a second, parallel repair strategy on top of the one
   * load() already needs anyway. Per-entry validation is load()'s job.
   *
   * @returns {Object<string, Object>}
   */
  function readStore() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.error('PresetStore: failed to read from localStorage', err);
      return {};
    }
    if (!raw) {
      return {};
    }
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('stored presets value is not a plain object');
      }
      return parsed;
    } catch (err) {
      console.error('PresetStore: stored presets data was invalid/corrupt, treating as empty', err);
      return {};
    }
  }

  /**
   * Persist the given `name -> serialized preset` map. Wrapped in try/catch
   * — localStorage.setItem() can throw (quota exceeded, private-browsing
   * mode in some browsers) — logging via console.error rather than
   * propagating, same as src/persistence.js's saveCurrentChain().
   *
   * @param {Object<string, Object>} store
   */
  function writeStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      console.error('PresetStore: failed to write to localStorage', err);
    }
  }

  /**
   * List every saved preset's name. If the store is completely empty —
   * either a genuinely fresh profile, or corrupt data that readStore()
   * above already reset to {} — seeds it with window.DEFAULT_PRESET under
   * its own name ("Classic Karaoke") before returning, so the Load list is
   * never empty even before a user has explicitly saved anything.
   *
   * @returns {Array<string>}
   */
  function listNames() {
    var store = readStore();
    var names = Object.keys(store);
    if (names.length === 0) {
      var seeded = window.PresetSchema.serialize(window.DEFAULT_PRESET.name, window.DEFAULT_PRESET.nodes);
      store[window.DEFAULT_PRESET.name] = seeded;
      writeStore(store);
      names = Object.keys(store);
    }
    return names;
  }

  /**
   * Save (or overwrite) a named preset from a live model. `name` and
   * `model`'s own shape are validated by PresetSchema.serialize() itself —
   * deliberately not re-checked here, so there is exactly one place that
   * decides what a well-formed name/model looks like. Overwrites silently
   * if `name` already exists — that's the intended "re-save" behavior, not
   * an error case.
   *
   * Wrapped in try/catch, same as src/persistence.js's saveCurrentChain():
   * localStorage can throw, and a failed save must never propagate up into
   * whatever UI interaction (a button click) triggered it. Note this also
   * means a bad `name`/`model` (PresetSchema.serialize() throwing its own
   * validation error) is caught and logged here too, rather than thrown to
   * the caller — presets-ui.js's own Save As handler already guards against
   * ever passing an empty name, so this is a defensive backstop, not the
   * primary validation path.
   *
   * @param {string} name
   * @param {Array<{id: string, type: string, params: Object}>} model
   */
  function save(name, model) {
    try {
      var serialized = window.PresetSchema.serialize(name, model);
      var store = readStore();
      store[name] = serialized;
      writeStore(store);
    } catch (err) {
      console.error('PresetStore: failed to save preset ' + JSON.stringify(name), err);
    }
  }

  /**
   * Load a named preset back out.
   *
   * @param {string} name
   * @returns {{name: string, nodes: Array<{id: string, type: string, params: Object}>}|null}
   *   null if `name` isn't in the store, or if what's stored under it fails
   *   PresetSchema.deserialize()'s structural validation (corrupt/malformed
   *   — e.g. hand-edited localStorage). Never throws.
   */
  function load(name) {
    var store = readStore();
    var entry = store[name];
    if (!entry) {
      return null;
    }
    try {
      var result = window.PresetSchema.deserialize(entry);
      return { name: result.name, nodes: result.nodes };
    } catch (err) {
      console.error('PresetStore: stored preset ' + JSON.stringify(name) + ' was invalid/corrupt', err);
      return null;
    }
  }

  /**
   * Remove a named preset. A no-op (not an error) if `name` isn't in the
   * store — deleting something that's already gone is not exceptional.
   *
   * @param {string} name
   */
  function remove(name) {
    var store = readStore();
    if (Object.prototype.hasOwnProperty.call(store, name)) {
      delete store[name];
      writeStore(store);
    }
  }

  window.PresetStore = {
    listNames: listNames,
    save: save,
    load: load,
    remove: remove,
  };
})();
