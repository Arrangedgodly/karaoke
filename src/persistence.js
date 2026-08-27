// localStorage autosave for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends on
// window.AudioGraph (src/audio-graph.js), window.PresetSchema
// (src/preset-schema.js), and window.DEFAULT_PRESET (src/default-preset.js)
// — all already loaded by the time this file runs, per index.html's script
// order.
//
// PS-2 scope: everything under the single localStorage key STORAGE_KEY
// below ('karaoke-autosave-v1'). Two entry points:
//   - saveCurrentChain() serializes AudioGraph's current model (via
//     PresetSchema.serialize()) and writes it to that key. It is called by
//     src/canvas.js on EVERY change to the chain — structural (add/remove/
//     reorder, via the onSort/remove-button chokepoints) AND a plain param
//     tweak (via each card's onParamsChanged callback) — so the autosave
//     slot always reflects exactly what's currently on screen. This is
//     purely event-driven: there is no timer/interval anywhere in this
//     file, and nothing here calls setInterval/setTimeout. If canvas.js
//     never calls saveCurrentChain(), nothing is ever (re)saved.
//   - loadInitialModel() is called exactly once, by src/main.js, right
//     after AudioEngine.start() resolves successfully. It reads/validates
//     whatever is under STORAGE_KEY and returns a ready-to-load
//     `{id, type, params}[]` array: the autosaved model if one exists and is
//     well-formed, otherwise a fresh copy of window.DEFAULT_PRESET.nodes
//     (PX-3's "Classic Karaoke" default — see src/default-preset.js and
//     docs/ultron/design/px3-default-chain-and-preset.md's "First-run
//     behavior" section).
//
// Fails safe, always: a missing key, a JSON.parse() failure, or a
// PresetSchema.deserialize() validation failure (corrupt/malformed/
// wrong-schemaVersion data — e.g. hand-edited or from an old, incompatible
// build) is caught right here, logged via console.error for debuggability,
// and treated exactly like "nothing saved yet" — falling back to the
// default preset. Nothing in this file ever throws up to its caller;
// main.js's Start handler can call loadInitialModel() unconditionally, with
// no try/catch of its own, and is guaranteed to get back a valid model
// either way.
(function () {
  'use strict';

  var STORAGE_KEY = 'karaoke-autosave-v1';

  /**
   * Serialize the current model and write it to localStorage under
   * STORAGE_KEY. Called by src/canvas.js after every structural change and
   * every param tweak (see file-level comment above) — never on its own
   * timer.
   *
   * @param {Array<{id: string, type: string, params: Object}>} [model] -
   *   optional. When omitted, falls back to window.AudioGraph.getModel().
   *   canvas.js always passes its OWN `chainModel` explicitly instead of
   *   relying on that fallback, and this is deliberate, not a redundant
   *   belt-and-suspenders: AudioGraph.buildGraph() commits a structural
   *   change to its internal model ASYNCHRONOUSLY (glitch-free rewiring
   *   ducks the chain gate, then finishes the swap ~20ms later on a
   *   setTimeout — see buildGraph()'s own comments in src/audio-graph.js),
   *   so AudioGraph.getModel() still reflects the OLD, pre-change model for
   *   a brief window immediately after rebuildGraph() returns. canvas.js's
   *   own `chainModel`, by contrast, is recomputed synchronously from the
   *   DOM (recomputeModelFromDom()) before rebuildGraph() is even called,
   *   so it is already exactly right at the moment saveCurrentChain() runs.
   *   Reading through AudioGraph.getModel() at that same moment would
   *   silently persist the WRONG (stale) model — e.g. a just-added node
   *   would never make it into the autosave slot at all unless some later,
   *   unrelated change happened to trigger another save afterward. The
   *   optional param exists so a future/standalone caller with no fresher
   *   model already in hand still has a sane default to fall back on.
   *
   * Wrapped in try/catch: localStorage.setItem() can throw (e.g. quota
   * exceeded, private-browsing mode in some browsers) and this must never
   * take down whatever UI interaction (a slider drag, a drag-and-drop drop)
   * triggered the save. A failed save just means this particular change
   * isn't persisted — the live chain itself is completely unaffected.
   */
  function saveCurrentChain(model) {
    try {
      var modelToSave = model || window.AudioGraph.getModel();
      var serialized = window.PresetSchema.serialize('__autosave__', modelToSave);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (err) {
      console.error('Persistence: failed to save chain to localStorage', err);
    }
  }

  /**
   * Read and validate whatever is currently under STORAGE_KEY.
   *
   * @returns {Array<{id: string, type: string, params: Object}>|null} the
   *   saved model, or null if there's nothing saved, the saved JSON is
   *   unparsable, or it fails PresetSchema.deserialize()'s structural
   *   validation. Never throws.
   */
  function loadAutosavedModel() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.error('Persistence: failed to read from localStorage', err);
      return null;
    }
    if (!raw) {
      return null;
    }
    try {
      var parsed = JSON.parse(raw);
      var result = window.PresetSchema.deserialize(parsed);
      return result.nodes;
    } catch (err) {
      console.error('Persistence: autosaved data was invalid/corrupt, falling back to default', err);
      return null;
    }
  }

  /**
   * The one function src/main.js calls, once, right after
   * AudioEngine.start() succeeds. Always returns a ready-to-load
   * `{id, type, params}[]` array — either the autosaved chain, or (when
   * nothing valid is saved) a fresh, independent copy of
   * window.DEFAULT_PRESET.nodes so the caller can freely mutate the result
   * (e.g. hand it straight to ChainCanvas.loadModel(), which will) without
   * risk of mutating the shared DEFAULT_PRESET data itself.
   *
   * @returns {Array<{id: string, type: string, params: Object}>}
   */
  function loadInitialModel() {
    var autosaved = loadAutosavedModel();
    if (autosaved) {
      return autosaved;
    }
    return window.DEFAULT_PRESET.nodes.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
  }

  window.Persistence = {
    saveCurrentChain: saveCurrentChain,
    loadInitialModel: loadInitialModel,
  };
})();
