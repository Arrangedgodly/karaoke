// Preset serialization schema for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as every other
// file in this project — exposing one global namespace, `window.PresetSchema`.
// Pure data/utility module: no Web Audio API, no AudioContext, nothing that
// requires a live audio engine. Testable directly in Node or a browser
// console with zero setup.
//
// PS-1 scope: formalizes the `{name, nodes}` JSON shape already sketched in
// docs/ultron/design/px3-default-chain-and-preset.md's "Classic Karaoke"
// starter preset into a real, versioned, validated schema that PS-2
// (autosave) and PS-3 (named presets) will both depend on directly — neither
// exists yet, but their expected usage is:
//   - PS-2 will call serialize() on every model change and write the result
//     to localStorage as the autosave slot, then call deserialize() once on
//     page load to restore the last-used chain (falling back to the Classic
//     Karaoke default per px3 when nothing is saved yet).
//   - PS-3 will do the same for named, user-triggered saves/loads — one
//     serialize() call per "Save preset" action, one deserialize() call per
//     "Load preset" action, keyed by name in some list of saved presets.
// This file only needs to give them a stable, tested contract to build
// against.
//
// `nodes` here is deliberately just the wire format for
// AudioGraph.getModel()'s `{id, type, params}[]` shape (src/audio-graph.js) —
// see that file's own getModel()/buildGraph() comments for why the model is
// shaped the way it is. serialize()/deserialize() add exactly two things on
// top of the bare model: a `schemaVersion` tag (so a future shape change can
// detect and migrate old saved data instead of silently misreading it) and a
// `name` (which the bare model has no concept of). Both functions deep-copy
// every entry's `params` object — never just reference the caller's/stored
// object — so a serialized snapshot can't be mutated by later changes to the
// live model, and a deserialized result can't be mutated by later changes to
// whatever `data` object the caller passed in (e.g. something PS-2's
// localStorage-read code might still hold a reference to).
//
// deserialize() deliberately validates only STRUCTURE (right fields, right
// types) — it does NOT check whether each node's `type` is a currently-
// registered node type. That's already AudioGraph.buildGraph()'s job: it
// throws its own clear, specific "unknown node type" error the moment a
// caller actually tries to build the restored model (see src/audio-graph.js).
// Duplicating that check here would mean either pulling registry knowledge
// into a module that otherwise doesn't need Web Audio at all, or maintaining
// two separate "is this type known" checks that could drift out of sync.
// This function's only job is "is this well-formed preset data."
//
// Only version 1 has ever existed, so deserialize() has no migration logic
// yet — an unrecognized schemaVersion is just a clear, immediate rejection.
// CURRENT_VERSION exists now purely to establish the convention for whenever
// a future shape change needs one.

(function () {
  'use strict';

  var CURRENT_VERSION = 1;

  /**
   * @param {*} value
   * @returns {boolean} true if `value` is a non-null, non-array object.
   */
  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Build a plain, JSON-serializable preset object from a display name and
   * an AudioGraph.getModel()-shaped array. The result is safe to
   * JSON.stringify() directly (e.g. for localStorage) and contains no
   * references back into `model` — every entry's `params` is a fresh copy,
   * so later mutation of the live model cannot alter an already-serialized
   * snapshot.
   *
   * @param {string} name - the preset's display name (non-empty string).
   * @param {Array<{id: string, type: string, params: Object}>} model - exactly
   *   the shape AudioGraph.getModel() returns.
   * @returns {{schemaVersion: number, name: string, nodes: Array<{id: string, type: string, params: Object}>}}
   */
  function serialize(name, model) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('PresetSchema.serialize: name must be a non-empty string.');
    }
    if (!Array.isArray(model)) {
      throw new Error('PresetSchema.serialize: model must be an array.');
    }
    return {
      schemaVersion: CURRENT_VERSION,
      name: name,
      nodes: model.map(function (entry) {
        return {
          id: entry.id,
          type: entry.type,
          params: Object.assign({}, entry.params || {}),
        };
      }),
    };
  }

  /**
   * Validate and unwrap candidate preset data (e.g. straight out of
   * JSON.parse() on a localStorage string) back into a {name, nodes} pair.
   * `nodes` is ready to hand to AudioGraph.buildGraph(result.nodes) as-is.
   *
   * Validates structurally before returning anything — throws a specific,
   * debuggable Error naming exactly what's wrong for the first problem it
   * finds, rather than returning something silently broken:
   *   - data isn't a plain object
   *   - data.schemaVersion doesn't match CURRENT_VERSION (names both the
   *     found and expected version — no migration logic exists yet, since
   *     only version 1 has ever shipped, so a mismatch is just rejected)
   *   - data.name isn't a non-empty string
   *   - data.nodes isn't an array
   *   - any data.nodes[i] isn't an object, or is missing a string `id`, is
   *     missing a string `type`, or has a `params` that isn't a plain object
   *     when present
   * A missing/undefined `params` on a node entry is explicitly NOT an error
   * — it's treated as `{}`. That's a common, legitimate case (e.g. a node
   * just dragged in from the palette with only its type-level defaults, no
   * per-node overrides yet), so leniency there is deliberate, not an
   * oversight.
   *
   * Does NOT check whether each node's `type` is a currently-registered
   * node type — see the file-level comment above for why that check is left
   * to AudioGraph.buildGraph() instead.
   *
   * @param {*} data - candidate preset data.
   * @returns {{name: string, nodes: Array<{id: string, type: string, params: Object}>}}
   */
  function deserialize(data) {
    if (!isPlainObject(data)) {
      throw new Error('PresetSchema.deserialize: data must be a plain object.');
    }
    if (data.schemaVersion !== CURRENT_VERSION) {
      throw new Error(
        'PresetSchema.deserialize: unsupported schemaVersion ' +
        JSON.stringify(data.schemaVersion) + ' (expected ' + CURRENT_VERSION + ').'
      );
    }
    if (typeof data.name !== 'string' || data.name.length === 0) {
      throw new Error('PresetSchema.deserialize: data.name must be a non-empty string.');
    }
    if (!Array.isArray(data.nodes)) {
      throw new Error('PresetSchema.deserialize: data.nodes must be an array.');
    }
    data.nodes.forEach(function (entry, i) {
      if (!isPlainObject(entry)) {
        throw new Error('PresetSchema.deserialize: data.nodes[' + i + '] must be an object.');
      }
      if (typeof entry.id !== 'string' || entry.id.length === 0) {
        throw new Error('PresetSchema.deserialize: data.nodes[' + i + '].id must be a non-empty string.');
      }
      if (typeof entry.type !== 'string' || entry.type.length === 0) {
        throw new Error('PresetSchema.deserialize: data.nodes[' + i + '].type must be a non-empty string.');
      }
      if (entry.params !== undefined && !isPlainObject(entry.params)) {
        throw new Error('PresetSchema.deserialize: data.nodes[' + i + '].params must be a plain object when present.');
      }
    });
    return {
      name: data.name,
      nodes: data.nodes.map(function (entry) {
        return {
          id: entry.id,
          type: entry.type,
          params: Object.assign({}, entry.params || {}),
        };
      }),
    };
  }

  window.PresetSchema = {
    CURRENT_VERSION: CURRENT_VERSION,
    serialize: serialize,
    deserialize: deserialize,
  };
})();
