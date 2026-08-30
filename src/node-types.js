// UI-facing node-type metadata registry for the Node-Based Web Audio Chain
// Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as audio-engine.js / audio-graph.js /
// audio-bypass.js.
//
// UI-4 scope: this is a SEPARATE registry from AudioGraph.registerNodeType()
// (src/audio-graph.js), which only knows how to build a real AudioNode from
// (audioContext, params) — it has no concept of labels, parameter specs, or
// how to apply a single parameter change to an already-built live node.
// NodeTypes owns exactly that UI-facing metadata, per type:
//   - `label`: display name for the palette/node header (e.g. "Gain").
//   - `paramSpec`: the array of {id, label, min, max, default, step, unit}
//     descriptors this type exposes, exactly the shape defined in
//     docs/ultron/design/px2-node-parameters.md. src/param-controls.js
//     renders one control per entry, generically, for ANY type registered
//     here — it never needs type-specific rendering code.
//   - `applyParam`: a per-type function (nodeInstance, paramId, value) =>
//     void that knows how to map ONE param onto the real Web Audio node(s)
//     factory-built for this type — unit conversion (e.g. dB -> linear
//     gain, per px2-node-parameters.md's note for AE-5), and for composite
//     types (EQ's three chained BiquadFilterNodes, Delay's feedback/mix
//     sub-graph) which internal sub-node/AudioParam a given paramId
//     actually targets. This is where ALL type-specific logic lives, fully
//     encapsulated — src/param-controls.js calls applyParam() generically
//     and never needs to know any of this.
//
// Deliberately independent of src/audio-graph.js: nothing here requires
// AudioGraph, and nothing in AudioGraph requires this file. The two
// registries are keyed by the same `type` string by convention, not by any
// enforced link — a real node-type task (AE-5+) calls both
// AudioGraph.registerNodeType() and NodeTypes.register() once, when it's
// built.
//
// No real node types are registered here yet — AE-5 through AE-10 (Gain,
// Compressor, EQ, Delay, Reverb, Limiter) populate this later. This task
// (UI-4) validates the contract end-to-end against one temporary throwaway
// test type only — nothing registered by this file itself is real DSP.

(function () {
  'use strict';

  // Map of type name -> {label, paramSpec, applyParam}. Empty until a
  // caller populates it via register().
  var registry = {};

  // Registration order, tracked separately from `registry`'s own key order.
  // Object key order for typical string keys (e.g. "gain", "compressor") IS
  // insertion order per the JS spec, so this is technically redundant today
  // — but it's kept explicit rather than relied upon implicitly, so
  // getAllTypes()'s ordering guarantee doesn't quietly depend on an
  // incidental object-key-iteration detail.
  var registrationOrder = [];

  /**
   * Register UI-facing metadata for a node type.
   *
   * MCP-1 (cycle 3): config.experimental (optional boolean) declares the
   * type's experimental status HERE, at its own registration — the single
   * source of truth every consumer reads via isExperimental() below
   * (canvas.js's badge surfaces and mcp-tools.js's capabilities readout
   * both consult it; each keeps only a static fallback mirror for
   * harnesses that never load the node files).
   *
   * @param {string} type - unique node type name, matching the same `type`
   * string used with AudioGraph.registerNodeType() (src/audio-graph.js).
   * @param {{label: string, paramSpec: Array<Object>, applyParam: Function, experimental?: boolean}} config
   *   - label: display name shown in the UI.
   *   - paramSpec: array of {id, label, min, max, default, step, unit}.
   *   - applyParam: (nodeInstance, paramId, value) => void.
   *   - experimental: optional boolean (default false) — true renders the
   *     experimental badge on the type's surfaces.
   */
  function register(type, config) {
    if (!type || typeof type !== 'string') {
      throw new Error('NodeTypes.register: type must be a non-empty string.');
    }
    if (!config || typeof config !== 'object') {
      throw new Error('NodeTypes.register: config must be an object.');
    }
    if (typeof config.applyParam !== 'function') {
      throw new Error('NodeTypes.register: config.applyParam must be a function.');
    }
    if (registrationOrder.indexOf(type) === -1) {
      registrationOrder.push(type);
    }
    registry[type] = {
      label: config.label || type,
      paramSpec: Array.isArray(config.paramSpec) ? config.paramSpec : [],
      applyParam: config.applyParam,
      experimental: !!config.experimental,
    };
  }

  /**
   * List every registered type name, in registration order.
   *
   * UI-3: this is what the palette is built from — one draggable chip per
   * entry in the returned array, via NodeTypes.getLabel(type) for each. As
   * AE-6 through AE-10 land (Compressor, EQ, Delay, Reverb, Limiter), each
   * one calls NodeTypes.register() once at load time, same as AE-5's `gain`
   * already does — the palette grows automatically to match whatever this
   * returns; it is never a hardcoded list of type names anywhere in the UI.
   *
   * @returns {Array<string>} a copy — safe for callers to iterate/mutate
   *   without affecting this registry's internal state.
   */
  function getAllTypes() {
    return registrationOrder.slice();
  }

  /**
   * @param {string} type
   * @returns {string} the registered label, or the type name itself if
   *   unregistered (defensive fallback — never throws).
   */
  function getLabel(type) {
    var entry = registry[type];
    return entry ? entry.label : type;
  }

  /**
   * @param {string} type
   * @returns {Array<Object>} the registered paramSpec array, or an empty
   *   array if the type is unknown/unregistered — callers (e.g.
   *   src/param-controls.js) can always iterate the result without a
   *   separate existence check.
   */
  function getParamSpec(type) {
    var entry = registry[type];
    return entry ? entry.paramSpec : [];
  }

  /**
   * Apply one parameter change to a live node instance, via the target
   * type's registered applyParam function.
   *
   * No-ops (does not throw) if `type` isn't registered or `nodeInstance` is
   * falsy — defensive, since this can be called in edge cases like a stale
   * reference or a param tweak that raced a node's removal.
   *
   * @param {string} type
   * @param {AudioNode|null} nodeInstance
   * @param {string} paramId
   * @param {number} value
   */
  function applyParam(type, nodeInstance, paramId, value) {
    var entry = registry[type];
    if (!entry || !nodeInstance) {
      return;
    }
    entry.applyParam(nodeInstance, paramId, value);
  }

  /**
   * MCP-1 (cycle 3): is this type registered as experimental? The
   * registration itself is the source of truth (register's
   * `experimental: true` — autotune only, cycle-3 scope), so the badge
   * surfaces (canvas.js card/chip) and the agent capabilities readout
   * (src/mcp-tools.js) can never disagree about a type's status.
   *
   * @param {string} type
   * @returns {boolean} true only when the type is registered AND declared
   *   experimental (unregistered types are honestly not-experimental —
   *   they render nowhere to badge).
   */
  function isExperimental(type) {
    var entry = registry[type];
    return !!entry && !!entry.experimental;
  }

  window.NodeTypes = {
    register: register,
    getLabel: getLabel,
    getParamSpec: getParamSpec,
    applyParam: applyParam,
    getAllTypes: getAllTypes,
    isExperimental: isExperimental,
  };
})();
