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
// Consumed by src/presets-ui.js (the human panel) and src/mcp-tools.js's
// save_preset (the agent path, since MC-5):
//   - listNames() populates the `#preset-select` dropdown, both once at
//     script-init time (so the list is visible even before Start is
//     clicked) and again after every Save As/Delete.
//   - save() backs the "Save As…" button (and save_preset), handed
//     whatever window.ChainCanvas.getCurrentModel() returns at that
//     moment.
//   - load() backs the "Load" button; presets-ui.js hands its `.nodes`
//     straight to window.ChainCanvas.loadModel().
//   - remove() backs the "Delete" button (and save_preset's undo).
//
// Persistence contract (issue #8 — report preset persistence failures
// truthfully):
//   - READS (listNames/load) still fail safe, same philosophy as
//     src/persistence.js: corrupt/unparsable stored JSON is logged via
//     console.error and treated as if nothing were stored at all, never
//     thrown up to the caller.
//   - MUTATIONS (save/remove) are TRUTHFUL: each either returns a
//     structured success result — save(): {ok: true, name, overwrote},
//     remove(): {ok: true, name, removed} (removed:false when the name
//     wasn't stored; deleting something already gone is not exceptional)
//     — or throws the typed window.PresetStore.StorageError carrying the
//     underlying error (its `cause`) and the failing step (`operation`:
//     'serialize' | 'write' | 'verify' | 'read'). No silent
//     console.error-and-pretend-success catches remain.
//   - VERIFIED WRITES: writeStore() (internal) serializes, setItem()s,
//     then READS THE STORE BACK with getItem() and compares before
//     reporting success — a storage layer that silently truncates or
//     drops the write (quota edge behavior) is reported as a failure,
//     not a success.
//   - listNames() itself still never throws: its default-preset seeding
//     stays best-effort (a failed seed write is logged and the names are
//     still returned — the seeding policy is issue #11's scope).
(function () {
  'use strict';

  var STORAGE_KEY = 'karaoke-presets-v1';

  /**
   * The typed persistence error every mutating operation throws on
   * failure (see the contract block in the file header). An Error
   * subclass in spirit: `name` identifies it, `operation` names the
   * failing step ('serialize' | 'write' | 'verify' | 'read'), and
   * `cause` carries the underlying error (quota/SecurityError/TypeError
   * from localStorage or JSON, or null when there is none — e.g. the
   * read-back mismatch). Exported as window.PresetStore.StorageError so
   * callers can `instanceof` it.
   *
   * @param {string} operation - the failing step.
   * @param {string} message - human-readable context (the cause's own
   *   message is appended when present).
   * @param {*} [cause] - the underlying error, or null.
   * @constructor
   */
  function StorageError(operation, message, cause) {
    this.name = 'PresetStore.StorageError';
    this.operation = operation;
    this.message = cause && cause.message
      ? message + ': ' + cause.message
      : message;
    this.cause = cause || null;
  }
  StorageError.prototype = Object.create(Error.prototype);
  StorageError.prototype.constructor = StorageError;

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
   * The strict variant of readStore() below, used ONLY by remove(): a
   * failing/corrupt read THROWS the typed StorageError instead of
   * degrading to {}. remove() needs this because "the store read as
   * empty" and "the store could not be read at all" must not share an
   * answer — reporting removed:false while storage is unreadable could
   * vanish a preset that is still stored (issue #8's delete-truthfulness
   * criterion). save() deliberately keeps the lenient readStore():
   * treating corrupt stored data as {} when SAVING is the documented
   * PS-3 recovery behavior (a fresh write over the corrupt blob), and
   * the write itself is verified by writeStore() either way.
   *
   * @returns {Object<string, Object>}
   * @throws {StorageError} operation 'read' when localStorage is
   *   unreadable or the stored value is corrupt.
   */
  function readStoreStrict() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      throw new StorageError(
        'read',
        'PresetStore: could not read the preset store from localStorage',
        err
      );
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
      throw new StorageError(
        'read',
        'PresetStore: stored presets data is invalid/corrupt',
        err
      );
    }
  }

  /**
   * Persist the given `name -> serialized preset` map, VERIFIED: after
   * setItem() the store is read back with getItem() and compared against
   * exactly what was written — a storage layer that silently truncates
   * or drops the write is a failure, not a success (issue #8). Every
   * failure mode throws the typed StorageError with the underlying error
   * carried (quota exhaustion, SecurityError, storage unavailable,
   * serialization failure); there is deliberately no silent catch.
   *
   * @param {Object<string, Object>} store
   * @returns {{ok: true, bytes: number}} the truthy success result
   *   (bytes = the persisted payload's length).
   * @throws {StorageError} operation 'serialize', 'write', or 'verify'.
   */
  function writeStore(store) {
    var payload;
    try {
      payload = JSON.stringify(store);
    } catch (err) {
      throw new StorageError(
        'serialize',
        'PresetStore: the preset store could not be serialized',
        err
      );
    }
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (err) {
      throw new StorageError(
        'write',
        'PresetStore: localStorage.setItem() failed for the preset store',
        err
      );
    }
    var readBack;
    try {
      readBack = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      throw new StorageError(
        'verify',
        'PresetStore: could not read the preset store back after writing it',
        err
      );
    }
    if (readBack !== payload) {
      throw new StorageError(
        'verify',
        'PresetStore: the preset store read back from localStorage does not ' +
          'match what was written (silent truncation or drop) — the save did not persist',
        null
      );
    }
    return { ok: true, bytes: payload.length };
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
      // Best-effort seed (issue #8 contract keeps listNames itself
      // non-throwing — the seeding POLICY is issue #11's scope): a failed
      // seed write is logged and the names are still returned, exactly
      // the pre-issue-#8 behavior.
      try {
        writeStore(store);
      } catch (err) {
        console.error('PresetStore: failed to seed the default preset into localStorage', err);
      }
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
   * Issue #8 contract: TRUTHFUL — either the structured success result
   * ({ok: true, name, overwrote}) or the typed StorageError; a preset
   * that could not be persisted is never reported as saved. That
   * includes PresetSchema.serialize()'s own validation throw (operation
   * 'serialize') — presets-ui.js guards against an empty name before
   * calling and mcp-tools validates the name/model first, so that path
   * is a defensive backstop, but if it ever fires the caller now HEARS
   * about it instead of a console.error and a phantom success.
   *
   * @param {string} name
   * @param {Array<{id: string, type: string, params: Object}>} model
   * @returns {{ok: true, name: string, overwrote: boolean}}
   * @throws {StorageError} operation 'serialize', 'write', or 'verify'.
   */
  function save(name, model) {
    var serialized;
    try {
      serialized = window.PresetSchema.serialize(name, model);
    } catch (err) {
      throw new StorageError(
        'serialize',
        'PresetStore: preset ' + JSON.stringify(name) +
          ' failed schema validation and was not saved',
        err
      );
    }
    var store = readStore();
    var overwrote = Object.prototype.hasOwnProperty.call(store, name);
    store[name] = serialized;
    writeStore(store); // throws StorageError on any persistence failure
    return { ok: true, name: name, overwrote: overwrote };
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
   * Remove a named preset. A success (not an error) when `name` isn't in
   * the store — deleting something that's already gone is not exceptional
   * — reported as removed:false so callers can tell the difference.
   *
   * Issue #8 contract: TRUTHFUL — a removal that could not be persisted
   * throws the typed StorageError rather than pretending the entry is
   * gone (the entry still lives in storage, so the UI must keep listing
   * it). The read is the STRICT variant on purpose: an unreadable store
   * must not degrade to "nothing was there" here (see readStoreStrict).
   *
   * @param {string} name
   * @returns {{ok: true, name: string, removed: boolean}}
   * @throws {StorageError} operation 'read', 'write', or 'verify'.
   */
  function remove(name) {
    var store = readStoreStrict();
    if (!Object.prototype.hasOwnProperty.call(store, name)) {
      return { ok: true, name: name, removed: false };
    }
    delete store[name];
    writeStore(store); // throws StorageError on any persistence failure
    return { ok: true, name: name, removed: true };
  }

  window.PresetStore = {
    listNames: listNames,
    save: save,
    load: load,
    remove: remove,
    StorageError: StorageError,
  };
})();
