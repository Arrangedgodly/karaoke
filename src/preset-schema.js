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
// (PRE-1, cycle 3: the STORE layers — src/persistence.js's autosave and
// src/preset-store.js's named presets — now additionally consult the LIVE
// NodeTypes registry before handing restored nodes toward buildGraph, so a
// hand-edited preset naming an unregistered type degrades through each
// store's existing recovery path instead of throwing mid-buildGraph. The
// type-known check itself still does not live here — no registry knowledge
// enters this file.)
//
// PRE-1 (cycle 3) addendum — per-type PARAM contracts for the four cycle-3
// node types. deserialize() remains structure-only for every type it has no
// declared contract for (the six cycle-1/2 types included — their presets,
// including any saved before cycle 3 existed, must load byte-unchanged), but
// the four NEW types (distortion, chorus, gate, autotune) carry a declared
// param contract below, and a preset entry of one of those types now has its
// present `params` validated against it: an undeclared param name, a
// non-numeric numeric param, an out-of-nominal-range number, or — the case
// that motivated this — an autotune Key/Scale value outside UI-1's legal
// vocabularies ('C'..'B' / 'Chromatic'..'Minor', or the raw 0..11 / 0..2
// worklet enums src/node-autotune.js documents as equally acceptable) is a
// REJECTION, with a specific error naming the node, param, and legal set.
// Rejected data hits exactly the error-recovery paths that predate this
// change: Persistence falls back to the default chain, PresetStore.load()
// reports the preset as invalid (null) — nothing crashes, nothing silently
// loads with substituted values. The node factories' own clamp-and-fallback
// mapping (e.g. node-autotune.js's keyIndex()) remains as defense-in-depth
// for direct buildGraph callers; it is no longer the only line of defense
// for preset data. Contracts are hand-mirrored from the node files'
// NodeTypes paramSpec registrations — same re-mirror discipline as
// NODE_REGISTRY_SNAPSHOT in src/mcp-tools.js; if a param ever changes
// incompatibly, mirror it here in the same edit (tests/test-preset-cycle3.js
// drift-checks the mirror against the live registry).
//
// Only version 1 has ever existed, so deserialize() has no migration logic
// yet — an unrecognized schemaVersion is just a clear, immediate rejection.
// CURRENT_VERSION exists now purely to establish the convention for whenever
// a future shape change needs one.

(function () {
  'use strict';

  var CURRENT_VERSION = 1;

  // ---------------------------------------------------------------------
  // PRE-1 (cycle 3): per-type PARAM contracts for the four cycle-3 node
  // types, hand-mirrored verbatim from the NodeTypes paramSpec registrations
  // in src/node-distortion.js / node-chorus.js / node-gate.js /
  // node-autotune.js (param ids and nominal min/max — the same fields
  // NODE_REGISTRY_SNAPSHOT mirrors in src/mcp-tools.js; label/step/default
  // stay UI-only and are not mirrored). Types WITHOUT an entry here
  // (the six cycle-1/2 types, and any type a future cycle has not declared
  // yet) keep deserialize()'s original structure-only treatment.
  //
  // Contract shapes:
  //   { kind: 'number', min, max }  — finite number, min <= value <= max
  //                                  (RANGE_EPS below absorbs float fuzz
  //                                  from UI slider strings, e.g. a rateHz
  //                                  committed as 0.7000000000000001).
  //   { kind: 'enum', values, enumMax }
  //                                — a discrete UI-1 vocabulary: either one
  //                                  of the legal STRINGS (the canonical
  //                                  wire form the selects commit and
  //                                  presets persist) or the raw integer
  //                                  enum 0..enumMax the worklet maps
  //                                  (src/node-autotune.js documents both
  //                                  as legitimate inputs at every
  //                                  boundary). Anything else rejects.
  // ---------------------------------------------------------------------
  var RANGE_EPS = 1e-9;

  var KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var SCALE_NAMES = ['Chromatic', 'Major', 'Minor'];

  var TYPE_PARAM_CONTRACTS = {
    // src/node-distortion.js: Drive 0..1, Tone 0..1, Output -24..0 dB.
    distortion: {
      drive: { kind: 'number', min: 0, max: 1 },
      tone: { kind: 'number', min: 0, max: 1 },
      output: { kind: 'number', min: -24, max: 0 }
    },
    // src/node-chorus.js: Depth 0..10 ms, Rate 0.1..8 Hz, Mix 0..100 %.
    chorus: {
      depthMs: { kind: 'number', min: 0, max: 10 },
      rateHz: { kind: 'number', min: 0.1, max: 8 },
      mix: { kind: 'number', min: 0, max: 100 }
    },
    // src/node-gate.js: Threshold -80..0 dB, Attack 0.001..0.5 s,
    // Release 0.01..2 s, Floor -60..0 dB.
    gate: {
      threshold: { kind: 'number', min: -80, max: 0 },
      attack: { kind: 'number', min: 0.001, max: 0.5 },
      release: { kind: 'number', min: 0.01, max: 2 },
      floor: { kind: 'number', min: -60, max: 0 }
    },
    // src/node-autotune.js: Key/Scale are UI-1 discrete strings (raw worklet
    // enums 0..11 / 0..2 equally legal — see the contract-shape note above);
    // Retune Speed 0..500 ms, Mix 0..100 %.
    autotune: {
      key: { kind: 'enum', values: KEY_NAMES, enumMax: 11 },
      scale: { kind: 'enum', values: SCALE_NAMES, enumMax: 2 },
      retune: { kind: 'number', min: 0, max: 500 },
      mix: { kind: 'number', min: 0, max: 100 }
    }
  };

  /**
   * Render a contract's legal values for an error message ("one of ..."
   * for enums, "MIN..MAX" for ranges). Never throws.
   * @param {Object} contract
   * @returns {string}
   */
  function describeContract(contract) {
    if (contract.kind === 'enum') {
      return 'one of ' + JSON.stringify(contract.values) +
        ' (or its 0..' + contract.enumMax + ' enum)';
    }
    return 'a finite number between ' + contract.min + ' and ' + contract.max +
      ' (inclusive)';
  }

  /**
   * Compact, safe rendering of an offending value for error messages
   * (JSON.stringify alone would render NaN as "null" — say what it is).
   * Never throws.
   * @param {*} value
   * @returns {string}
   */
  function displayValue(value) {
    if (typeof value === 'number' && !isFinite(value)) {
      return String(value); // "NaN" / "Infinity" / "-Infinity"
    }
    try {
      var s = JSON.stringify(value);
      return typeof s === 'string' ? s : typeof value; // undefined -> "undefined"
    } catch (err) {
      return typeof value;
    }
  }

  /**
   * Validate one node entry's `params` against its type's declared contract
   * (no-op for types without one). Throws the same specific, debuggable
   * style as every other deserialize() rejection — node index, param name,
   * what's wrong, and the legal set — so a hand-edited preset fails loudly
   * at the schema layer and the store layers' recovery paths take over,
   * instead of the node factories silently substituting defaults.
   * @param {{type: string, params: Object}} entry
   * @param {number} i - the entry's index (for the error message).
   * @param {string} [where] - 'data.nodes' (deserialize) — kept for message
   *   symmetry with the structural checks.
   */
  function validateEntryParams(entry, i, where) {
    var contracts = TYPE_PARAM_CONTRACTS[entry.type];
    if (!contracts) {
      return; // undeclared type — structure-only treatment, unchanged
    }
    var params = entry.params || {};
    var prefix = 'PresetSchema.deserialize: ' + where + '[' + i + '].params.';
    Object.keys(params).forEach(function (key) {
      var contract = contracts[key];
      if (!contract) {
        throw new Error(
          prefix + "unknown param '" + key + "' for type '" + entry.type +
          "' (legal params: " + Object.keys(contracts).join(', ') + ').'
        );
      }
      var value = params[key];
      if (contract.kind === 'enum') {
        var legal =
          (typeof value === 'string' && contract.values.indexOf(value) !== -1) ||
          (typeof value === 'number' && isFinite(value) &&
            Math.floor(value) === value && value >= 0 && value <= contract.enumMax);
        if (!legal) {
          throw new Error(
            prefix + key + ' must be ' + describeContract(contract) +
            '; got ' + displayValue(value) + '.'
          );
        }
      } else {
        if (typeof value !== 'number' || !isFinite(value)) {
          throw new Error(
            prefix + key + ' must be ' + describeContract(contract) +
            '; got ' + displayValue(value) + '.'
          );
        }
        if (value < contract.min - RANGE_EPS || value > contract.max + RANGE_EPS) {
          throw new Error(
            prefix + key + ' must be ' + describeContract(contract) +
            '; got ' + value + '.'
          );
        }
      }
    });
  }

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
   * oversight. (For the four cycle-3 types this extends to individual
   * MISSING params: a contract validates only the params a preset actually
   * carries; absent ones take the node's type-level defaults at build time.)
   *
   * PRE-1 (cycle 3): entries of a type with a declared PARAM contract
   * (TYPE_PARAM_CONTRACTS — distortion/chorus/gate/autotune) additionally
   * have every PRESENT param checked against it: an unknown param name, a
   * wrong value type, an out-of-nominal-range number, or an autotune
   * Key/Scale outside the legal UI-1 vocabularies throws here (same
   * specific-error style as the structural checks), feeding the store
   * layers' existing recovery paths. Types without a contract — the six
   * cycle-1/2 types included — are untouched by this pass, so presets
   * saved before cycle 3 load byte-unchanged.
   *
   * Does NOT check whether each node's `type` is a currently-registered
   * node type — see the file-level comment above for why that check is left
   * to AudioGraph.buildGraph() (with the store layers' live-registry
   * pre-check, added by PRE-1, as the degrade-first guard in front of it).
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
      // PRE-1 (cycle 3): per-type param-contract pass (no-op for types
      // without a declared contract — see TYPE_PARAM_CONTRACTS).
      validateEntryParams(entry, i, 'data.nodes');
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
    // PRE-1 (cycle 3): read-only introspection surface for tests/tools —
    // tests/test-preset-cycle3.js drift-checks this mirror against the LIVE
    // NodeTypes paramSpecs. Treat as read-only (same discipline as
    // NODE_REGISTRY_SNAPSHOT in src/mcp-tools.js).
    TYPE_PARAM_CONTRACTS: TYPE_PARAM_CONTRACTS,
  };
})();
