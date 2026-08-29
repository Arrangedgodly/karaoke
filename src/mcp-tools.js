// Tool schema layer (the 8 real agent tools) for the Node-Based Web Audio
// Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of this project. Dependencies, all optional at
// runtime and every use guarded: window.McpServer (src/mcp-server.js,
// loaded earlier per index.html) for self-registration;
// window.NodeTypes + the six src/node-*.js files (loaded earlier) for the
// live node-type registry; window.PresetSchema (src/preset-schema.js,
// loaded earlier) for authoritative chain-shape validation;
// window.ChainCanvas (src/canvas.js) for model access — getCurrentModel
// (read-only; the same source the UI itself uses) and, since MC-4,
// loadModel as THE single write path every mutation applies through;
// window.PresetStore (src/preset-store.js: listNames/load read-only since
// MC-3; save/remove since MC-5 — the same single persistence path the
// UI's Save As/Delete buttons use); window.FactoryPresets
// (src/factory-presets.js, PS-4, read-only and fully guarded — list()
// feeds list_presets' factory group and get_capabilities' factory-library
// disclosure; absent in bare harnesses, where the factory group honestly
// reports empty); window.AudioEngine (read-only:
// isStarted/audioContext state); read-only DOM lookups of the elements
// src/presets-ui.js owns (#current-preset-name, #unsaved-indicator) for
// get_chain's engine/preset context — plus, since VIS-3, preset display
// WRITES through window.PresetsUI's own exports (markModified,
// setCurrentPreset, clearModified, refreshPresetSelect — the same single
// write path the UI's Save As/Load/Delete buttons use; MC-5's temporary
// display mirrors are retired, see the VIS-3 PresetsUI block below);
// window.AgentUI (src/agent-ui.js) for mutation toasts (reportMutation)
// and the bounded undo stack (pushUndo); window.DEFAULT_PRESET (name
// only) for the pre-start note. No DIRECT localStorage access — all
// persistence goes through PresetStore (named presets) or the loadModel
// autosave baseline.
//
// MC-2 scope (docs/ultron/plan.md): the 8 tool DEFINITIONS in the
// ModelContextTool shape (RQ-1, docs/ultron/research/rq1-webmcp-api.md) —
// name/description/inputSchema/annotations — plus STRUCTURAL argument
// validation inside each execute stub. Structural = required fields
// present, right JS types, enum members, known param names for a node
// type, numeric values within the app's own NOMINAL paramSpec ranges.
//
// MC-3 scope: the three READ tools are implemented for real — get_chain
// (the live ChainCanvas model serialized in the exact set_chain shape),
// list_presets (PresetStore's own list API), and get_capabilities (the
// live node registry PLUS the RQ-3 loudness-safety policy stated as
// rules, translated into the app's actual param units — see the MC-3
// policy block below), so agents pre-comply instead of discovering the
// limits by rejection (OQ-8 content owner). MC-4 made the four MUTATION
// tools (set_chain, add_node, remove_node, set_param) live through the
// single UI write path with the full rq3 reject/clamp table enforced.
//
// MC-5 scope (docs/ultron/plan.md task MC-5): save_preset goes live
// (PresetStore save/remove — the UI Save/Delete flows' own persistence
// path); every APPLIED mutation takes a pre-apply exact-state snapshot
// (deep-cloned model + preset display state — the OQ-6 snapshot
// decision) pushed to AgentUI's bounded (20) undo stack with a
// restore() closure that re-applies through the same single write path;
// mutation disclosures upgrade to human-readable one-line summaries
// (MC-4's basic ones are retired); refused mutations additionally toast
// { rejected: true } so the operator sees refusals, not just the agent.
//
// =====================================================================
// MCP-TOOLS LAYER — window.McpTools (AUTHORITATIVE)
// =====================================================================
//
//   McpTools.getDefs() -> array of 8 fresh tool defs, order fixed:
//     get_capabilities, get_chain, set_chain, add_node, remove_node,
//     set_param, list_presets, save_preset
//   Each def = { name, description, inputSchema, annotations, execute }
//   in exactly the shape McpServer.registerTools() accepts (see
//   src/mcp-server.js's contract block). Fresh objects every call, so
//   the MC-6 dev harness can hold/invoke defs without disturbing the
//   registered set.
//
// Result shapes (plain objects per live-verified RQ-1 — the API has no
// error channel, so failures travel as descriptive result text; stubs
// NEVER throw, the shim's wrapper is a last resort only):
//   invalid args -> { error: true,
//                     code: 'INVALID_ARGUMENTS',
//                     tool: <name>,
//                     reason: <one sentence>,
//                     problems: [{ path, message, allowed? }],
//                     suggestion: <nearest fix> }
//     `allowed` appears on a problem only when a known set of permitted
//     values exists (node types, param names); `path` is a dotted/
//     indexed path into the input object ('chain.nodes[2].params.mix').
//   valid args   -> the five MUTATION tools (set_chain, add_node,
//                     remove_node, set_param, save_preset) are live
//                     (MC-4 / MC-5) and resolve either:
//                     SUCCESS: { applied: true, tool, changes: [...],
//                       clamped: [...], nodeIds: [...], note? } where
//                       changes[] is a per-node state diff ({node, type,
//                       change: 'added'|'removed'|'moved'|'params',
//                       params?}), clamped[] entries are {node, param,
//                       requested, applied, unit, rule_id} for every
//                       saturated value (disclosed in the result AND via
//                       window.AgentUI.reportMutation), and note carries
//                       extra host-side disclosures (e.g. the id minted
//                       for add_node). save_preset's success shape is
//                       { applied: true, tool: 'save_preset', saved,
//                         overwrote, nodeCount } (saved = the TRIMMED
//                         name actually stored; overwrote = a preset
//                         already existed under it; see the save_preset
//                         block below).
//                       MC-5 additions on every SUCCESS: a human-readable
//                       one-line summary toast (AgentUI.reportMutation:
//                       'Agent set EQ mid gain to +3 dB (eq1)'-style) and
//                       exactly ONE AgentUI.pushUndo({ label, restore })
//                       entry whose restore() re-applies the pre-apply
//                       snapshot (deep-cloned model + preset display)
//                       through the same write path — exact-state undo,
//                       including user-set values OUTSIDE the agent
//                       policy (a snapshot restores what the human had,
//                       never what an agent may request, so restore
//                       bypasses re-validation by design).
//                     REJECTION (rq3 §error shape — nothing applied,
//                       applied: null): { error: true, code, tool?, node?,
//                       param?, requested?, allowed?: {min, max, unit},
//                       applied: null, reason, suggestion, rule_id, ...}
//                       where code is 'PARAM_OUT_OF_RANGE' (per-param
//                       reject treatment), a CHAIN_RULES id (structural
//                       chain rules — limiter-required-terminal,
//                       gain-budget-12db, ...), 'HOST_OWNED' (writes to
//                       host-owned elements), 'NODE_NOT_FOUND' (unknown
//                       node id, validIds included), or 'BUSY' (a user
//                       drag outlived the ~5 s mutation queue; retry).
//                       Cumulative constraints (gain budget, EQ boost
//                       sum) additionally carry the remaining-budget
//                       numbers and a per-node breakdown so a rejected
//                       call can be corrected in one step.
//                       MC-5: every error result from a MUTATION tool
//                       (runtime rejections, INVALID_ARGUMENTS, BUSY,
//                       SCHEMA_LAYER_FAULT) ALSO toasts via
//                       AgentUI.reportMutation({ source: 'agent',
//                       summary: 'Agent request refused: ...',
//                       rejected: true, errorText: <one-line why> }) so
//                       the operator sees refusals (rejected mutations
//                       push NO undo entry — there is nothing to undo).
//                       The three READ tools are live since MC-3 and return
//                     their payloads:
//   get_chain    -> { schemaVersion: 1, name, nodes: [{id, type,
//                     params}], engine: { started, running },
//                     preset: { name: string|null, unsaved: bool|null },
//                     note? } — ChainCanvas.getCurrentModel() (the UI's
//                     own source) serialized via PresetSchema.serialize;
//                     before the engine starts the app itself shows an
//                     EMPTY canvas, so nodes is [] plus a `note` naming
//                     what Start restores (never an error). `name` is
//                     the preset label presets-ui.js displays;
//                     preset.name null = its 'Unsaved chain'
//                     placeholder; preset.unsaved mirrors the
//                     #unsaved-indicator dot (null when absent).
//   list_presets -> { presets: [{ name, nodeCount }], count,
//                     factory: [{ name, nodeCount }], (PS-4; from
//                     window.FactoryPresets — read-only, never persisted),
//                     currentlyLoaded: string|null, note? } — `presets`/
//                     `count` are the USER store straight from
//                     PresetStore.listNames()/load() (nodeCount null =
//                     entry failed validation; count counts USER presets
//                     only); `factory` is the shipped library grouped
//                     separately (a factory entry's nodeCount is its
//                     static nodes' length); `currentlyLoaded` matches
//                     the preset display name against EITHER group (the
//                     human may have loaded a factory preset); note only
//                     when PresetStore is unavailable/failed.
//   get_capabilities -> the structured capability object (app, summary,
//                     nodeTypes with per-param nominal+agent ranges,
//                     chainRules, orderGuidance, starterChains,
//                     safetyNotes, factoryPresets — PS-4's one-line
//                     disclosure of the factory library names + the
//                     set_chain loading path, no load_preset tool by
//                     design) — see the MC-3 policy block below.
//   validator bug-> { error: true, code: 'SCHEMA_LAYER_FAULT', ... }
//     (a caught internal failure of THIS layer — nothing was applied).
//
// Registry fidelity: the static NODE_REGISTRY_SNAPSHOT below mirrors the
// six src/node-*.js paramSpec registrations verbatim (param ids, units,
// nominal min/max) so this file works with zero dependencies (e.g. in
// Node test harnesses). At runtime the LIVE registry wins whenever it is
// populated: window.NodeTypes.getAllTypes()/getParamSpec() — the snapshot
// is only a fallback, and if the two ever drift the node files are the
// source of truth and the snapshot must be re-mirrored.
//
// Self-init at load: if window.McpServer exists, immediately
// McpServer.registerTools(McpTools.getDefs()). The shim owns the
// absent-API short-circuit (its batch collapses the whole story into one
// console diagnostic, not one per tool) and re-registration per load.
// =====================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Node-type registry snapshot — mirrors src/node-*.js verbatim.
  //
  // One entry per param: { id, unit, min, max, default } — the
  // paramSpec fields validation and get_capabilities' static fallback
  // need (label/step stay UI-only and are not mirrored; get_capabilities
  // falls back to TYPE_INFO's labels instead).
  // Sources, in index.html script order:
  //   gain       <- src/node-gain.js        (gainDb)
  //   compressor <- src/node-compressor.js  (threshold, ratio, attack,
  //                                          release)
  //   eq         <- src/node-eq.js          (lowGain, midGain, highGain)
  //   delay      <- src/node-delay.js       (timeMs, feedback, mix)
  //   reverb     <- src/node-reverb.js      (mix)
  //   limiter    <- src/node-limiter.js     (ceiling, release)
  // Ranges here are the app's OWN nominal slider ranges — NOT RQ-3's
  // tighter agent ranges (those are AGENT_PARAM_POLICY below and MC-4's
  // enforcement; e.g. delay feedback's nominal max is 90, RQ-3's agent
  // cap is 70).
  // ---------------------------------------------------------------------
  var NODE_REGISTRY_SNAPSHOT = {
    gain: [
      { id: 'gainDb', unit: 'dB', min: -24, max: 24, default: 0 }
    ],
    compressor: [
      { id: 'threshold', unit: 'dB', min: -60, max: 0, default: -24 },
      { id: 'ratio', unit: ':1', min: 1, max: 20, default: 4 },
      { id: 'attack', unit: 's', min: 0, max: 1, default: 0.01 },
      { id: 'release', unit: 's', min: 0, max: 1, default: 0.25 }
    ],
    eq: [
      { id: 'lowGain', unit: 'dB', min: -12, max: 12, default: 0 },
      { id: 'midGain', unit: 'dB', min: -12, max: 12, default: 0 },
      { id: 'highGain', unit: 'dB', min: -12, max: 12, default: 0 }
    ],
    delay: [
      { id: 'timeMs', unit: 'ms', min: 10, max: 1000, default: 300 },
      { id: 'feedback', unit: '%', min: 0, max: 90, default: 25 },
      { id: 'mix', unit: '%', min: 0, max: 100, default: 25 }
    ],
    reverb: [
      { id: 'mix', unit: '%', min: 0, max: 100, default: 20 }
    ],
    limiter: [
      { id: 'ceiling', unit: 'dB', min: -12, max: 0, default: -1 },
      { id: 'release', unit: 'ms', min: 10, max: 500, default: 50 }
    ]
  };

  // ---------------------------------------------------------------------
  // Small shared helpers.
  // ---------------------------------------------------------------------

  /**
   * @param {*} value
   * @returns {boolean} true if `value` is a non-null, non-array object —
   *   same test src/preset-schema.js uses.
   */
  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Compact, safe rendering of an offending value for error messages
   * (never throws, truncates long strings).
   *
   * @param {*} value
   * @returns {string}
   */
  function displayValue(value) {
    if (typeof value === 'string') {
      return JSON.stringify(value.length > 30 ? value.slice(0, 30) + '...' : value);
    }
    if (typeof value === 'number' && !isFinite(value)) {
      return String(value);
    }
    try {
      var s = JSON.stringify(value);
      return typeof s === 'string' ? s : typeof value;
    } catch (err) {
      return typeof value;
    }
  }

  /**
   * Build one problems[] entry. `allowed` is attached only when a known
   * set of permitted values exists, so agents get the fix inline.
   *
   * @param {string} path - dotted/indexed path into the input object.
   * @param {string} message - what is wrong at that path.
   * @param {Array<string>} [allowed] - permitted values, when enumerable.
   * @returns {{path: string, message: string}}
   */
  function problem(path, message, allowed) {
    var entry = { path: path, message: message };
    if (allowed && allowed.length > 0) {
      entry.allowed = allowed.slice();
    }
    return entry;
  }

  /**
   * One-sentence reason summarizing the problem list (first problem
   * verbatim, remainder as a count).
   *
   * @param {string} toolName
   * @param {Array<Object>} problems
   * @returns {string}
   */
  function reasonFor(toolName, problems) {
    var extra =
      problems.length > 1
        ? ' (plus ' + (problems.length - 1) + ' more problem' +
          (problems.length > 2 ? 's' : '') + ')'
        : '';
    return toolName + ' rejected the arguments: ' + problems[0].message + extra + '.';
  }

  /**
   * Nearest-fix suggestion derived from the first problem.
   *
   * @param {Array<Object>} problems
   * @returns {string}
   */
  function suggestionFor(problems) {
    var first = problems[0];
    if (first.allowed && first.allowed.length > 0) {
      return 'Use one of: ' + first.allowed.join(', ') + '.';
    }
    if (/is required/.test(first.message)) {
      return 'Provide the missing field(s) and call the tool again.';
    }
    return 'Call get_capabilities first: it lists the valid node types, param names, units, and nominal ranges.';
  }

  /**
   * @param {string} toolName
   * @param {Array<Object>} problems - non-empty.
   * @returns {Object} the INVALID_ARGUMENTS result object.
   */
  function invalidArgumentsResult(toolName, problems) {
    return {
      error: true,
      code: 'INVALID_ARGUMENTS',
      tool: toolName,
      reason: reasonFor(toolName, problems),
      problems: problems,
      suggestion: suggestionFor(problems)
    };
  }

  /**
   * @param {string} toolName
   * @param {*} err - whatever the validator machinery threw.
   * @returns {Object} result for an internal failure of THIS layer.
   */
  function schemaLayerFaultResult(toolName, err) {
    return {
      error: true,
      code: 'SCHEMA_LAYER_FAULT',
      tool: toolName,
      reason:
        'Argument validation failed unexpectedly: ' +
        String(err && err.message ? err.message : err),
      hint: 'Nothing in the app was changed; this is a bug in the tool schema layer — please report it.'
    };
  }

  // ---------------------------------------------------------------------
  // Registry resolution — live window.NodeTypes wins, snapshot falls back.
  // ---------------------------------------------------------------------

  /**
   * @returns {Array<string>} registered node-type names, in registration
   *   order. window.NodeTypes.getAllTypes() when it is populated; the
   *   static snapshot otherwise (empty live registry = node files not
   *   loaded, e.g. a bare test harness).
   */
  function registryTypes() {
    if (window.NodeTypes && typeof window.NodeTypes.getAllTypes === 'function') {
      var live = window.NodeTypes.getAllTypes();
      if (live && live.length > 0) {
        return live.slice();
      }
    }
    return Object.keys(NODE_REGISTRY_SNAPSHOT);
  }

  /**
   * @param {string} type - a node-type name.
   * @returns {Array<Object>} that type's param specs ({id, unit, min, max
   *   shaped}; live paramSpec entries carry extra UI fields, unused
   *   here). Empty array when the type is unknown.
   */
  function paramSpecsFor(type) {
    if (window.NodeTypes && typeof window.NodeTypes.getParamSpec === 'function') {
      var live = window.NodeTypes.getParamSpec(type);
      if (live && live.length > 0) {
        return live;
      }
    }
    var snap = NODE_REGISTRY_SNAPSHOT[type];
    return snap ? snap : [];
  }

  /**
   * @param {Array<Object>} specs
   * @returns {Array<string>} the spec ids, in order.
   */
  function specIds(specs) {
    return specs.map(function (spec) {
      return spec.id;
    });
  }

  /**
   * @param {Array<Object>} specs
   * @param {string} paramId
   * @returns {Object|null} the matching spec, or null.
   */
  function findSpec(specs, paramId) {
    for (var i = 0; i < specs.length; i++) {
      if (specs[i] && specs[i].id === paramId) {
        return specs[i];
      }
    }
    return null;
  }

  /**
   * Look up a live node's type by id — READ-ONLY, via
   * ChainCanvas.getCurrentModel() (src/canvas.js; always a fresh copy, so
   * this can never mutate app state). Used only by set_param's param-name
   * check. Any absence/failure resolves null = "unresolvable here", which
   * skips the name check and falls through to NOT_IMPLEMENTED (the full
   * runtime check is MC-4's, against the real model APIs).
   *
   * @param {string} nodeId
   * @returns {string|null} the node's registered type, or null.
   */
  function resolveNodeType(nodeId) {
    try {
      var canvas = window.ChainCanvas;
      if (!canvas || typeof canvas.getCurrentModel !== 'function') {
        return null;
      }
      var model = canvas.getCurrentModel();
      if (!Array.isArray(model)) {
        return null;
      }
      for (var i = 0; i < model.length; i++) {
        if (model[i] && model[i].id === nodeId && typeof model[i].type === 'string') {
          return model[i].type;
        }
      }
    } catch (err) {
      // Read-only by design; any failure simply leaves the type unknown.
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // MC-3 policy block — RQ-3 (docs/ultron/research/rq3-loudness-policy.md,
  // the committed implementation source) translated into the APP's actual
  // param units. rq3 speaks Web-Audio-native units (linear gain, seconds,
  // 0..1 send gains); this app's params are host-facing units (dB, %, ms,
  // s). Every conversion, verified against the node files' real
  // semantics:
  //
  //   gain.gainDb      rq3 linear [0, 4.0] (direct-path, no negatives)
  //                    -> dB [-24, +12]: 20*log10(4.0) = +12.04 dB ~= +12;
  //                    negative linear gain is NOT expressible in dB
  //                    (src/node-gain.js writes 10^(dB/20), always
  //                    positive), so rq3's "no negatives" holds by
  //                    construction. Values above the agent max reject.
  //   compressor.*     rq3's comp rows are already dB / ratio / seconds
  //                    and src/node-compressor.js writes them straight
  //                    onto the AudioParams — identical numbers, no
  //                    conversion. (rq3's knee row has no app param: the
  //                    knee is deliberately fixed at the Web Audio
  //                    default 30 dB soft knee, per that file's own
  //                    comment.)
  //   eq.*Gain         rq3's EQ gain row is already dB. Cuts: rq3 clamps
  //                    to [-24, 0]; the app's own nominal floor (-12 dB)
  //                    is tighter and wins. Boosts: above +9 dB reject.
  //                    rq3's EQ frequency/Q clamps have no app params —
  //                    src/node-eq.js fixes them (200 Hz low shelf,
  //                    1 kHz peaking Q 1.0, 5 kHz high shelf), all
  //                    inside rq3's clamp ranges.
  //   delay.timeMs     rq3 delayTime [0.02, 0.75] s -> ms [20, 750]
  //                    (src/node-delay.js: delayTime.value = timeMs/1000;
  //                    createDelay(1.0) so the nominal 1000 ms max fits).
  //   delay.feedback   rq3 feedback gain [0, 0.70] linear (node hard-cap
  //                    0.85) -> % [0, 70]: src/node-delay.js writes
  //                    feedbackGain.gain.value = Math.min(feedback, 90)
  //                    /100, so linear = percent/100 and 0.70 linear =
  //                    70 on this param. NOTE: this app's own defensive
  //                    node hard-cap is 90 (0.90 linear), NOT rq3's
  //                    parenthetical 0.85 — the AGENT rule is unchanged
  //                    (0.70 linear = 70, reject above); only the
  //                    disclosed node ceiling differs.
  //   delay.mix /     rq3 bounds each wet/dry gain to [0, 1] with
  //   reverb.mix      wet+dry <= 1.5 (delay) and summed sends <= 1.2
  //                    (reverb). The app's mix is an EQUAL-POWER
  //                    crossfade (dry = cos(m*PI/2), wet = sin(m*PI/2),
  //                    m = mix/100 — src/node-delay.js and
  //                    src/node-reverb.js): each side stays in [0, 1],
  //                    wet+dry peaks at sqrt(2) ~= 1.414 < 1.5 for every
  //                    mix value, and the single reverb send never
  //                    exceeds 1.0 < 1.2 — all three bounds hold
  //                    structurally, so the agent range is the full
  //                    nominal 0-100 % (clamped).
  //   limiter.ceiling rq3 limiter threshold [-12, -3] dB -> same dB
  //                    (src/node-limiter.js writes ceiling straight onto
  //                    .threshold).
  //   limiter.release rq3 [0.05, 0.3] s -> ms [50, 300]
  //                    (src/node-limiter.js: release.value = value/1000).
  //
  // Makeup-gain estimate for the +12 dB budget rule (stated plainly so
  // agents can self-check): estimated makeup dB ~= 0.57 * |threshold| dB
  // — rq3's hard-knee anchors (threshold -12/ratio 20 => ~= +6.8 dB;
  // threshold -24 => ~= +13.7 dB) both sit on that line. Browser-
  // dependent by a few dB (the soft-knee curve is the UA's choice).
  // MC-4's enforcement uses the same constant.
  // ---------------------------------------------------------------------

  var MAKEUP_DB_PER_THRESHOLD_DB = 0.57;

  // ---------------------------------------------------------------------
  // MC-4 statics — the MACHINE-READABLE half of the rq3 policy. Everything
  // the enforcement engine below compares against comes from THIS block
  // (plus AGENT_PARAM_POLICY above and NODE_REGISTRY_SNAPSHOT): no rq3
  // numeric literal is ever re-typed in the enforcement code, so the
  // disclosure (CHAIN_RULES prose, get_capabilities) and the enforcement
  // cannot drift apart silently. If a number here must change, change the
  // matching CHAIN_RULES prose entry in the same edit — they are two views
  // of one table (rq3-loudness-policy.md).
  // ---------------------------------------------------------------------

  /**
   * Chain-level rq3 limits, keyed by the CHAIN_RULES id each enforces.
   * Per-param limits live in AGENT_PARAM_POLICY (min/max per param); the
   * makeup estimate lives in MAKEUP_DB_PER_THRESHOLD_DB. EQ band count
   * per eq node is DERIVED from the registry (paramSpecsFor('eq').length)
   * rather than restated here.
   */
  var CHAIN_LIMITS = {
    MAX_TOTAL_GAIN_DB: 12,         // gain-budget-12db
    MAX_GAIN_NODES: 6,             // gain-node-count
    MAX_COMPRESSOR_NODES: 2,       // compressor-node-count (compressor + limiter)
    MAX_NODES: 16,                 // node-count-cap
    MAX_EQ_BANDS: 6,               // eq-max-bands
    EQ_BOOST_SUM_MAX_DB: 12,       // eq-boost-sum
    EQ_SINGLE_BOOST_FLOOR_DB: 6,   // eq-single-big-boost (at most one band >= this)
    COMPOUND_FEEDBACK_MIN_PCT: 55, // compound-loop-guard (0.55 linear)
    COMPOUND_BOOST_SUM_MIN_DB: 6   // compound-loop-guard
  };

  /**
   * Params and elements that are HOST-OWNED per rq3 — not addressable by
   * any tool; writes are structurally rejected (code 'HOST_OWNED') with
   * the CHAIN_RULES id that discloses the ownership. Names here are
   * deliberately NOT in any paramSpec, so they reach this map only via
   * the host-owned carve-outs in validateParamsForType()/validateSetParam
   * (which let them past the unknown-param check so the rejection can
   * name the owning rule instead of a bare unknown-param error).
   */
  var HOST_OWNED_PARAMS = {
    limiter: {
      ratio: 'host-limiter-locks',
      attack: 'host-limiter-locks',
      knee: 'host-limiter-locks',
      reduction: 'host-limiter-locks'
    },
    reverb: {
      normalize: 'host-reverb-internals',
      buffer: 'host-reverb-internals'
    }
  };

  /**
   * The host-owned output attenuator is not a chain node and has no id,
   * but agents will plausibly guess these names. Matching one resolves
   * the structured HOST_OWNED error naming host-output-attenuator instead
   * of a generic NODE_NOT_FOUND (rq3: "no agent tool can address it").
   */
  var ATTENUATOR_ID_RE = /^(?:output[-_]?attenuator|attenuator|safe[-_]?output)$/i;

  /**
   * OQ-7 serialization bounds: how long a mutation waits behind an
   * in-progress user drag (ChainCanvas.isDragActive()) before resolving
   * BUSY, and how often it re-checks. Not an rq3 number — a queueing
   * policy constant.
   */
  var DRAG_QUEUE_TIMEOUT_MS = 5000;
  var DRAG_POLL_MS = 50;

  /**
   * Counter for the node ids this layer mints on add_node (the tool takes
   * no id). 'agent-N' never collides with the canvas's own 'node-N'
   * scheme (different prefixes — see loadModel()'s counter-scan comment
   * in src/canvas.js) and is bumped past any id already present in the
   * live model before use. In-memory only; never persisted.
   */
  var agentNodeIdCounter = 0;

  /**
   * Per-type display label + live-vocal-oriented description for
   * get_capabilities. Static fallback for labels when the live registry
   * is absent; descriptions are always this static text (they carry the
   * rq3 disclosures, which have no runtime source).
   */
  var TYPE_INFO = {
    gain: {
      label: 'Gain',
      description:
        'Direct-path trim for the whole vocal. Make small moves: every gain node counts toward both the +12 dB total gain budget (including estimated makeup) and the 6-gain-node cap.'
    },
    compressor: {
      label: 'Compressor',
      description:
        "Levels the vocal (threshold/ratio/attack/release). Each compressor-type node adds ~6 ms look-ahead latency, applies a built-in makeup gain that counts toward the +12 dB budget (estimate 0.57 * |threshold|), and counts toward the 2-compressor-type-node cap together with the required limiter. Knee is fixed at the Web Audio default (30 dB soft knee) and gain reduction is read-only — neither is an addressable param."
    },
    eq: {
      label: 'EQ',
      description:
        'Three fixed bands: low shelf 200 Hz, peaking 1 kHz (Q 1.0), high shelf 5 kHz. Frequencies and Q are fixed internally (all within rq3 clamp ranges) — only the three band gains are params. Prefer cuts; boosts are policy-capped (per-band +9 dB hard reject, boost sum <= +12 dB, at most one band >= +6 dB). One eq node = 3 bands, so the 6-band cap means at most 2 eq nodes.'
    },
    delay: {
      label: 'Delay',
      description:
        'Slap-back delay. feedback is the percent of each repeat fed back into the delay (linear gain = feedback/100; rq3 caps it at 0.70 = 70 on this param). mix is an equal-power dry/wet crossfade whose sides never leave [0, 1].'
    },
    reverb: {
      label: 'Reverb',
      description:
        'Plate-style ambience from a fixed bundled impulse response; only the wet/dry mix is exposed. The IR buffer and the convolver normalize flag are host-owned — no tool can address them.'
    },
    limiter: {
      label: 'Limiter',
      description:
        'SAFETY limiter — required in every chain and always terminal (last node, MIC IN to OUT; only upstream additions are allowed). ceiling is its threshold; only ceiling and release are addressable. Locked host-fixed aspects: ratio 20:1, attack (rq3 locks 1-3 ms; this app fixes 0 ms — the node\'s native minimum, even faster), and a 0 dB hard knee. The host-owned output attenuator sits after it and is not a param.'
    }
  };

  /**
   * RQ-3 agent ranges translated into app units (see the conversion
   * table above). Fields per param: { min, max, unit, treatment } where
   * treatment is 'reject' (out-of-range request -> structured error,
   * nothing applied) or 'clamp' (saturate to the range and disclose).
   * The `description` on each entry states the unit semantics and the
   * conversion so the agent can sanity-check its own numbers.
   */
  var AGENT_PARAM_POLICY = {
    gain: {
      gainDb: {
        min: -24, max: 12, unit: 'dB', treatment: 'reject',
        description:
          'Direct-path gain in dB (written as 10^(dB/20) linear). rq3 agent range is linear [0, 4.0] = up to 20*log10(4) = +12.04 dB with no negative linear gain — in this app\'s dB unit that is [-24, +12] (the app nominal floor; negative linear gain is not expressible in dB). Above +12 dB is rejected, and the value counts toward the +12 dB total budget including estimated makeup.'
      }
    },
    compressor: {
      threshold: {
        min: -40, max: -8, unit: 'dB', treatment: 'reject',
        description:
          'Level where compression starts, in dB (same unit rq3 uses — written straight onto the AudioParam). Out-of-range values are rejected. Estimated makeup of 0.57 * |threshold| counts toward the +12 dB budget.'
      },
      ratio: {
        min: 1.5, max: 12, unit: ':1', treatment: 'clamp',
        description:
          'Compression ratio (unitless N:1, written straight through). Out-of-range values are clamped into [1.5, 12].'
      },
      attack: {
        min: 0.001, max: 0.1, unit: 's', treatment: 'clamp',
        description:
          'Ramp-in time in SECONDS (rq3 range unchanged — the app param is already in s). Clamped into [0.001, 0.1] s (1-100 ms).'
      },
      release: {
        min: 0.02, max: 0.5, unit: 's', treatment: 'clamp',
        description:
          'Recovery time in SECONDS. Clamped into [0.02, 0.5] s (20-500 ms).'
      }
    },
    eq: {
      lowGain: {
        min: -12, max: 9, unit: 'dB', treatment: 'reject',
        description:
          'Low shelf (fixed 200 Hz) gain in dB. rq3 treatment for band gains: cuts clamp (into the app nominal [-12, 0]), boosts above +9 dB are REJECTED; boosts count toward the +12 dB boost-sum cap and the one-band->=+6 rule.'
      },
      midGain: {
        min: -12, max: 9, unit: 'dB', treatment: 'reject',
        description:
          'Peaking band (fixed 1 kHz, Q 1.0) gain in dB. Same policy: cuts clamp, boost above +9 dB rejects, boost sum <= +12 dB, at most one band >= +6 dB.'
      },
      highGain: {
        min: -12, max: 9, unit: 'dB', treatment: 'reject',
        description:
          'High shelf (fixed 5 kHz) gain in dB. Same policy: cuts clamp, boost above +9 dB rejects, boost sum <= +12 dB, at most one band >= +6 dB.'
      }
    },
    delay: {
      timeMs: {
        min: 20, max: 750, unit: 'ms', treatment: 'clamp',
        description:
          'Delay time in MILLISECONDS (DelayNode.delayTime is seconds; the app divides by 1000). rq3 agent range [0.02, 0.75] s = 20-750 ms; out-of-range values are clamped.'
      },
      feedback: {
        min: 0, max: 70, unit: '%', treatment: 'reject',
        description:
          'Feedback in PERCENT of each repeat re-fed into the delay (linear gain = feedback/100). rq3 caps the linear feedback gain at 0.70 — i.e. 70 on this param — and values above are REJECTED. The compound-loop guard additionally rejects feedback >= 55 whenever the EQ boost sum is >= +6 dB. (The node\'s own defensive hard cap is 90.)'
      },
      mix: {
        min: 0, max: 100, unit: '%', treatment: 'clamp',
        description:
          "Equal-power dry/wet crossfade in PERCENT (dry = cos, wet = sin of mix/100 * PI/2). Each side stays within [0, 1] and wet+dry peaks at ~1.414, inside rq3's 1.5 bound for every value — the nominal 0-100 % range applies, clamped."
      }
    },
    reverb: {
      mix: {
        min: 0, max: 100, unit: '%', treatment: 'clamp',
        description:
          "Equal-power dry/wet crossfade in PERCENT, same construction as delay's mix. The single reverb send never exceeds 1.0, so rq3's summed-sends bound of 1.2 holds structurally; nominal 0-100 % applies, clamped."
      }
    },
    limiter: {
      ceiling: {
        min: -12, max: -3, unit: 'dB', treatment: 'reject',
        description:
          "Output ceiling in dB (written straight onto the limiter's threshold). rq3 agent range [-12, -3] dB, enforced by rejection. Its estimated makeup (0.57 * |ceiling|) counts toward the +12 dB budget."
      },
      release: {
        min: 50, max: 300, unit: 'ms', treatment: 'clamp',
        description:
          'Release in MILLISECONDS (the AudioParam is seconds; the app divides by 1000). rq3 agent range [0.05, 0.3] s = 50-300 ms; out-of-range values are clamped.'
      }
    }
  };

  /**
   * Every rq3 chain rule, stated as get_capabilities publishes it.
   * { id, rule, enforcement } — the rule text carries the rq3 numbers
   * verbatim-in-substance, including the app-unit translations and the
   * host-owned disclosures (attenuator, reverb internals, limiter
   * locks).
   */
  var CHAIN_RULES = [
    {
      id: 'limiter-required-terminal',
      rule: 'A limiter node is REQUIRED and must be TERMINAL — the last node in the chain, MIC IN to OUT. The agent may only add nodes upstream of it; removing it, bypassing it, reordering it away from the end, or positioning any node after it is rejected.',
      enforcement: 'hard reject (nothing applied)'
    },
    {
      id: 'gain-budget-12db',
      rule: 'Total direct-path gain budget is +12 dB, INCLUDING estimated compressor/limiter makeup gain. Self-check formula: sum of every gain node\'s gainDb, plus 0.57 * |threshold| for each compressor, plus 0.57 * |ceiling| for the limiter, must be <= +12 dB. (rq3 anchors for the estimate, hard-knee bound: threshold -12/ratio 20 => ~= +6.8 dB; threshold -24 => ~= +13.7 dB; browser-dependent by a few dB.)',
      enforcement: 'reject (nothing applied)'
    },
    {
      id: 'negative-gain-rejected',
      rule: 'Negative linear gain (polarity inversion) is rejected. This app enters gain in dB and writes 10^(dB/20), which is always positive — the rule holds structurally, so there is no way to request it.',
      enforcement: 'reject; structurally unreachable in this app'
    },
    {
      id: 'eq-max-bands',
      rule: 'At most 6 EQ bands total. This app\'s eq node has 3 fixed bands (low/mid/high), so that means at most 2 eq nodes.',
      enforcement: 'reject'
    },
    {
      id: 'eq-boost-per-band',
      rule: 'Per-band EQ boost is capped at +9 dB; requests above +9 dB are rejected. Cuts are clamped into the app nominal [-12, 0] dB (rq3\'s -24 dB cut bound is looser than the app\'s own slider floor).',
      enforcement: 'boost above +9 dB: reject; cuts: clamp'
    },
    {
      id: 'eq-boost-sum',
      rule: 'The sum of all EQ band boosts must stay <= +12 dB.',
      enforcement: 'reject'
    },
    {
      id: 'eq-single-big-boost',
      rule: 'At most ONE EQ band may have a boost >= +6 dB.',
      enforcement: 'reject'
    },
    {
      id: 'delay-feedback-cap',
      rule: 'Delay feedback must stay <= 0.70 linear, which is 70 on the app\'s feedback param (percent; linear = feedback/100). Values above 70 are rejected. (The node\'s own defensive hard cap is 90 = 0.90 linear.)',
      enforcement: 'reject above 70'
    },
    {
      id: 'compound-loop-guard',
      rule: 'Compound-loop guard: delay feedback >= 0.55 linear (55 on the app\'s feedback percent param) AND EQ boost sum >= +6 dB together are rejected — high loop gain plus spectral lift is how ringback starts.',
      enforcement: 'reject when both conditions hold'
    },
    {
      id: 'mix-gain-bounds',
      rule: 'rq3 bounds delay wet+dry to <= 1.5 with each mix gain in [0, 1], and reverb sends to a summed <= 1.2. The app\'s equal-power crossfades satisfy all of these structurally (each side in [0, 1]; wet+dry peaks at sqrt(2) ~= 1.414; the single reverb send never exceeds 1.0), so the only enforced bound is the nominal 0-100 % clamp on the mix params.',
      enforcement: 'clamp to nominal 0-100 %; rq3 bounds hold by construction'
    },
    {
      id: 'gain-node-count',
      rule: 'At most 6 gain-type nodes. The param that counts: every gain node\'s gainDb (direct-path gain). Delay/reverb feedback and mix gains are send-path — governed by their own caps, not this count.',
      enforcement: 'reject'
    },
    {
      id: 'compressor-node-count',
      rule: "At most 2 compressor-type nodes total. Both DynamicsCompressorNode-based types count — 'compressor' and the required terminal 'limiter' — so at most one 'compressor' node beyond the limiter. Each adds fixed ~6 ms look-ahead latency (disclosed here).",
      enforcement: 'reject'
    },
    {
      id: 'node-count-cap',
      rule: 'The whole chain is capped at 16 nodes (all types, including the required limiter).',
      enforcement: 'reject'
    },
    {
      id: 'host-param-ramps',
      rule: 'The host ramps every param change over 10-20 ms — no instantaneous jumps, so edits never click.',
      enforcement: 'host behavior (disclosure)'
    },
    {
      id: 'host-output-attenuator',
      rule: 'A host-owned output attenuator (persistent GainNode after the limiter) is ALWAYS on and is NOT a param: default ceiling -6 dBFS, absolute never-exceed -3 dBFS. No tool can address it.',
      enforcement: 'host-owned; not addressable by any tool'
    },
    {
      id: 'host-reverb-internals',
      rule: 'The reverb\'s normalize flag and impulse-response buffer are host-owned; writes are rejected (they are not exposed as params at all).',
      enforcement: 'host-owned; writes rejected'
    },
    {
      id: 'host-limiter-locks',
      rule: 'The limiter\'s ratio is locked at 20:1 and its attack is locked (rq3 policy: 1-3 ms; this app fixes 0 ms — the node\'s native minimum, i.e. even faster), plus a locked 0 dB hard knee. None are addressable params.',
      enforcement: 'host-owned; writes rejected'
    },
    {
      id: 'error-shape',
      rule: 'Validation errors carry the requested value, the allowed range, what was applied (nothing, for rejects), and the remaining budget numbers for cumulative constraints — so a rejected call can be corrected in one step.',
      enforcement: 'host behavior (disclosure)'
    }
  ];

  /** Conventional live-vocal chain order, with one-line whys. */
  var ORDER_GUIDANCE = [
    { order: 'gain (trim) first', why: 'set the level feeding the chain before anything downstream reacts to it' },
    { order: 'EQ before dynamics', why: 'cut rumble and harshness first so the compressor reacts to the voice, not to noise' },
    { order: 'compressor after EQ', why: "evens the vocal's level; remember ~6 ms look-ahead latency per compressor-type node" },
    { order: 'delay before reverb', why: 'delay repeats should feed the space — the reverse order smears the reverb tail' },
    { order: 'reverb as the last effect', why: 'ambience applies to the complete dry + effected vocal' },
    { order: 'limiter always last', why: 'it must catch everything upstream (required-terminal rule); the host output attenuator sits after it' }
  ];

  /**
   * Three modest, feedback-safe starter recipes. Every value sits inside
   * the agent ranges published by get_capabilities (the MC-6/QA harness
   * re-verifies that self-consistency), each ends with the required
   * terminal limiter, and each stays inside the +12 dB budget under the
   * 0.57 * |threshold| makeup estimate.
   */
  var STARTER_CHAINS = [
    {
      name: 'Warm ballad',
      goal: 'Gentle low-mid warmth with space and a soft slap-back delay for slow songs.',
      chain: [
        { type: 'gain', params: { gainDb: 1 } },
        { type: 'eq', params: { lowGain: 3, midGain: 1, highGain: -2 } },
        { type: 'compressor', params: { threshold: -12, ratio: 3, attack: 0.01, release: 0.3 } },
        { type: 'delay', params: { timeMs: 380, feedback: 30, mix: 20 } },
        { type: 'reverb', params: { mix: 30 } },
        { type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      name: 'Clean speech',
      goal: 'Clear, present spoken voice — no delay repeats, minimal ambience, rumble rolled off.',
      chain: [
        { type: 'gain', params: { gainDb: 0 } },
        { type: 'eq', params: { lowGain: -2, midGain: 1, highGain: 3 } },
        { type: 'compressor', params: { threshold: -12, ratio: 2.5, attack: 0.02, release: 0.2 } },
        { type: 'reverb', params: { mix: 10 } },
        { type: 'limiter', params: { ceiling: -6, release: 100 } }
      ]
    },
    {
      name: 'Bright rock',
      goal: 'Forward, energetic vocal that survives a loud mix — top-end lift, firmer compression, a short slap-back delay.',
      chain: [
        { type: 'gain', params: { gainDb: 1 } },
        { type: 'eq', params: { lowGain: -1, midGain: -2, highGain: 4 } },
        { type: 'compressor', params: { threshold: -14, ratio: 4, attack: 0.003, release: 0.15 } },
        { type: 'delay', params: { timeMs: 240, feedback: 35, mix: 15 } },
        { type: 'reverb', params: { mix: 15 } },
        { type: 'limiter', params: { ceiling: -3, release: 60 } }
      ]
    }
  ];

  /** Human-controlled / out-of-app safety context. */
  var SAFETY_NOTES = [
    'Feedback and room gain are ultimately human-controlled: mic placement and the physical distance to speakers dominate; the caps here only cover the app-side contribution.',
    'OS output volume and PA/amplifier gain live outside this app — no chain setting can reach them.',
    'Bypass is human-only and always available (the Bypass button or the spacebar); no tool can engage, defeat, or restore it.',
    'A runtime watchdog watches the output analyser: peak above the ceiling +0.5 dB sustained >250 ms, or ~1 s of monotonic band-energy rise, forces the output to silence with a UI alert — restoring it is human-only.'
  ];

  // ---------------------------------------------------------------------
  // MC-3 read-tool helpers. Every app read here is guarded: an absent or
  // damaged dependency produces honest degraded fields, never a throw
  // and never SCHEMA_LAYER_FAULT (that code stays reserved for bugs in
  // THIS layer).
  // ---------------------------------------------------------------------

  /**
   * @returns {{started: boolean, running: boolean}} engine state.
   *   `running` uses the same derivation src/main.js's isEngineLive()
   *   uses: isStarted AND audioContext.state === 'running'.
   */
  function readEngineState() {
    var started = false;
    var running = false;
    try {
      if (window.AudioEngine && window.AudioEngine.isStarted) {
        started = true;
        var ctx = window.AudioEngine.audioContext;
        running = !!ctx && ctx.state === 'running';
      }
    } catch (err) {
      // Damaged engine object — report the honest default (not started).
    }
    return { started: started, running: running };
  }

  /**
   * Read the preset display state src/presets-ui.js owns. That module
   * keeps `currentPresetName` private; its DOM display is the app's own
   * public face of that state, so this reads the same elements instead
   * of duplicating the state: #current-preset-name ('Unsaved chain' is
   * the placeholder for null) and #unsaved-indicator (visible =
   * modified — markModified()/clearModified() toggle style.display).
   * Inherits the UI's one known caveat: a preset literally named
   * 'Unsaved chain' is indistinguishable from no preset (the placeholder
   * has the same ambiguity on screen).
   *
   * @returns {{displayName: string, name: string|null, unsaved: boolean|null}}
   */
  function readPresetDisplay() {
    var display = 'Unsaved chain';
    var unsaved = null;
    try {
      var nameEl = document.getElementById('current-preset-name');
      if (nameEl && typeof nameEl.textContent === 'string' && nameEl.textContent.length > 0) {
        display = nameEl.textContent;
      }
    } catch (err) {
      // No DOM here (e.g. a bare test harness) — keep the placeholder.
    }
    try {
      var dotEl = document.getElementById('unsaved-indicator');
      if (dotEl && dotEl.style) {
        unsaved = dotEl.style.display !== 'none';
      }
    } catch (err) {
      // Indicator absent — unsaved stays unknown (null).
    }
    return {
      displayName: display,
      name: display === 'Unsaved chain' ? null : display,
      unsaved: unsaved
    };
  }

  /**
   * The live chain model, read-only, from the same source the UI uses:
   * ChainCanvas.getCurrentModel() (already a defensive copy, but this
   * copies again via PresetSchema.serialize below anyway). Any absence
   * or failure resolves the honest empty model — before the engine
   * starts the app itself shows an empty canvas, so [] is the truth,
   * not an error.
   *
   * @returns {Array<{id: string, type: string, params: Object}>}
   */
  function readCurrentModel() {
    try {
      if (window.ChainCanvas && typeof window.ChainCanvas.getCurrentModel === 'function') {
        var model = window.ChainCanvas.getCurrentModel();
        if (Array.isArray(model)) {
          return model;
        }
      }
    } catch (err) {
      // Read-only by design; fall through to the honest empty model.
    }
    return [];
  }

  /**
   * @returns {string} the built-in default preset's name (what a fresh
   *   profile loads at Start per src/persistence.js), 'Classic Karaoke'
   *   when DEFAULT_PRESET isn't loaded.
   */
  function defaultPresetName() {
    try {
      if (window.DEFAULT_PRESET && typeof window.DEFAULT_PRESET.name === 'string') {
        return window.DEFAULT_PRESET.name;
      }
    } catch (err) {
      // Absent — use the known literal.
    }
    return 'Classic Karaoke';
  }

  /**
   * PS-4: the factory preset library (src/factory-presets.js), read-only
   * and guarded — a bare test harness that never loaded the script (or a
   * damaged module) honestly resolves an EMPTY library, exactly like the
   * other guarded reads here; the tool results then simply carry
   * factory: [].
   *
   * @returns {Array<{name: string, nodes: Array<{id, type, params}>}>}
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
      // Static content module damaged — report the honest empty library.
    }
    return [];
  }

  /**
   * get_chain's payload: the live model in the exact PresetSchema/
   * set_chain shape plus engine + preset display context.
   *
   * @returns {Object}
   */
  function buildGetChainResult() {
    var engine = readEngineState();
    var preset = readPresetDisplay();
    var model = readCurrentModel();
    var name = preset.displayName || 'Unsaved chain';
    var result = null;
    try {
      if (window.PresetSchema && typeof window.PresetSchema.serialize === 'function') {
        result = window.PresetSchema.serialize(name, model);
      }
    } catch (err) {
      result = null; // Serialize refused (should not happen) — hand-build.
    }
    if (!result) {
      result = {
        schemaVersion: 1,
        name: name,
        nodes: model.map(function (entry) {
          return {
            id: entry.id,
            type: entry.type,
            params: Object.assign({}, entry.params || {})
          };
        })
      };
    }
    result.engine = engine;
    result.preset = { name: preset.name, unsaved: preset.unsaved };
    if (!engine.started && result.nodes.length === 0) {
      result.note =
        'Engine not started — the app itself shows an empty canvas before Start. ' +
        'When the human presses Start, the app auto-restores the last autosaved chain, ' +
        'or the built-in "' + defaultPresetName() + '" default preset on a fresh profile ' +
        '(src/persistence.js behavior).';
    }
    return result;
  }

  /**
   * list_presets' payload: PresetStore.listNames() is the store's whole
   * list API (names ARE the keys); nodeCount comes from its read-only
   * load() and is null when an entry fails validation. Note:
   * listNames() seeds a fresh/empty store with the default preset —
   * that is the store's own documented behavior, and the UI's dropdown
   * relies on it, so this tool gets it too.
   *
   * PS-4: the result additionally carries `factory` — the shipped
   * factory library (window.FactoryPresets, read-only) grouped
   * separately from the user `presets`, mirroring the dropdown's
   * Factory/Yours optgroups. `count` stays the USER preset count
   * (existing consumers read it as "how many presets can save_preset
   * overwrite"); a factory entry's nodeCount is just its static nodes'
   * length. `currentlyLoaded` matches the display name against EITHER
   * group (user first) — the human may have loaded a factory preset,
   * which never enters the user store.
   *
   * @returns {Object}
   */
  function buildListPresetsResult() {
    var display = readPresetDisplay().displayName;
    var factory = factoryPresets().map(function (preset) {
      return { name: preset.name, nodeCount: preset.nodes.length };
    });
    if (!(window.PresetStore && typeof window.PresetStore.listNames === 'function')) {
      return {
        presets: [],
        count: 0,
        factory: factory,
        currentlyLoaded: null,
        note: 'PresetStore is not available in this context — no saved presets can be listed.'
      };
    }
    var names = [];
    try {
      var listed = window.PresetStore.listNames();
      if (Array.isArray(listed)) {
        names = listed.filter(function (n) {
          return typeof n === 'string';
        });
      }
    } catch (err) {
      return {
        presets: [],
        count: 0,
        factory: factory,
        currentlyLoaded: null,
        note:
          'PresetStore failed to list presets: ' +
          String(err && err.message ? err.message : err)
      };
    }
    var presets = names.map(function (name) {
      var entry = { name: name, nodeCount: null };
      try {
        if (typeof window.PresetStore.load === 'function') {
          var loaded = window.PresetStore.load(name);
          if (loaded && Array.isArray(loaded.nodes)) {
            entry.nodeCount = loaded.nodes.length;
          }
        }
      } catch (err) {
        // Corrupt entry — nodeCount stays null (disclosed as null).
      }
      return entry;
    });
    var currentlyLoaded = null;
    for (var i = 0; i < presets.length; i++) {
      if (presets[i].name === display) {
        currentlyLoaded = display;
        break;
      }
    }
    if (currentlyLoaded === null) {
      for (var j = 0; j < factory.length; j++) {
        if (factory[j].name === display) {
          currentlyLoaded = display;
          break;
        }
      }
    }
    return {
      presets: presets,
      count: presets.length,
      factory: factory,
      currentlyLoaded: currentlyLoaded
    };
  }

  /**
   * Fresh deep copy of a pure-JSON static block, so two get_capabilities
   * results can never share mutable references (same freshness discipline
   * as getDefs()).
   *
   * @param {*} value
   * @returns {*}
   */
  function freshCopy(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return value; // Static data is pure JSON; unreachable in practice.
    }
  }

  /**
   * get_capabilities' payload: the live node registry (falling back to
   * the static snapshot) enriched with the static rq3 agent ranges and
   * descriptions, plus the chain rules / order guidance / starters /
   * safety notes.
   *
   * @returns {Object}
   */
  function buildCapabilitiesResult() {
    var nodeTypes = registryTypes().map(function (type) {
      var info = TYPE_INFO[type] || {};
      var params = paramSpecsFor(type).map(function (spec) {
        var policy =
          (AGENT_PARAM_POLICY[type] && AGENT_PARAM_POLICY[type][spec.id]) || null;
        return {
          name: spec.id,
          unit: spec.unit || '',
          nominal: { min: spec.min, max: spec.max },
          default: spec.default,
          agent: policy
            ? {
                min: policy.min,
                max: policy.max,
                unit: policy.unit,
                treatment: policy.treatment
              }
            : {
                min: spec.min,
                max: spec.max,
                unit: spec.unit || '',
                treatment: 'clamp'
              },
          description: policy
            ? policy.description
            : 'No agent policy is registered for this param (registry drift — the node files and the policy table disagree); the nominal range applies and values are clamped.'
        };
      });
      var label = info.label || type;
      try {
        if (window.NodeTypes && typeof window.NodeTypes.getLabel === 'function') {
          var live = window.NodeTypes.getLabel(type);
          if (typeof live === 'string' && live.length > 0) {
            label = live;
          }
        }
      } catch (err) {
        // Live label unavailable — static fallback stands.
      }
      return {
        type: type,
        label: label,
        description: info.description || '',
        params: params
      };
    });
    // PS-4: one-line disclosure of the factory library — names plus the
    // sanctioned agent loading path. There is deliberately NO load_preset
    // tool (town-hall rejected alternative: it duplicates set_chain's
    // value); loading a factory preset as the agent = set_chain with that
    // preset's nodes. Empty names (bare harness, module absent) still
    // disclose the mechanism honestly.
    var factoryNames = factoryPresets().map(function (preset) {
      return preset.name;
    });
    var factoryNote =
      'Factory preset library (read-only; the human Presets panel lists it under "Factory"): ' +
      (factoryNames.length > 0 ? factoryNames.join(', ') + '. ' : '') +
      'No load_preset tool exists by design — to load one as the agent, call set_chain with that preset\'s nodes ' +
      '(the factory group in list_presets names them; get_chain reveals the exact nodes once the human has loaded one).';
    return {
      app: 'karaoke-chain-builder',
      summary:
        'Live-vocal effect chain builder for karaoke: gain, EQ, compressor, delay, reverb, and a required terminal safety limiter. Read chainRules before mutating — set_chain/add_node/remove_node/set_param validate every change against that loudness-safety policy, and each param\'s agent range is listed under nodeTypes.',
      nodeTypes: nodeTypes,
      chainRules: freshCopy(CHAIN_RULES),
      orderGuidance: freshCopy(ORDER_GUIDANCE),
      starterChains: freshCopy(STARTER_CHAINS),
      safetyNotes: freshCopy(SAFETY_NOTES),
      factoryPresets: { names: factoryNames, note: factoryNote }
    };
  }

  // ---------------------------------------------------------------------
  // MC-4 — enforcement engine + mutation pipeline.
  //
  // Everything below reads its numbers from the statics (AGENT_PARAM_POLICY,
  // CHAIN_LIMITS, MAKEUP_DB_PER_THRESHOLD_DB, HOST_OWNED_PARAMS) so
  // disclosure and enforcement share one source. Pipeline per mutation:
  //   (1) structural validation (the shared validators below),
  //   (2) serialize vs user drags — queue until ChainCanvas reports the
  //       drag done, bounded by DRAG_QUEUE_TIMEOUT_MS (OQ-7),
  //   (3) read the live model (ChainCanvas.getCurrentModel — the UI's own
  //       source, read-only), validate the candidate against the rq3
  //       policy above, and
  //   (4) apply through ChainCanvas.loadModel — the SAME model+rebuild
  //       path src/presets-ui.js's Load button uses; never a parallel
  //       write path — then disclose via AgentUI.reportMutation.
  // ---------------------------------------------------------------------

  /**
   * @param {string} type
   * @param {string} param
   * @returns {string|null} the CHAIN_RULES id owning this host-owned
   *   param, or null when the param is not host-owned.
   */
  function hostOwnedFor(type, param) {
    var owned = HOST_OWNED_PARAMS[type];
    return owned && Object.prototype.hasOwnProperty.call(owned, param)
      ? owned[param]
      : null;
  }

  /**
   * @param {string} type
   * @param {string} param
   * @returns {Object|null} the AGENT_PARAM_POLICY entry, or null.
   */
  function policyFor(type, param) {
    var perType = AGENT_PARAM_POLICY[type];
    return (perType && Object.prototype.hasOwnProperty.call(perType, param))
      ? perType[param]
      : null;
  }

  /**
   * The rule_id reported for a per-param policy decision: the CHAIN_RULES
   * id when a named rule covers the param, else the dotted policy
   * location ('gain.gainDb') — always a stable, greppable string.
   *
   * @param {string} type
   * @param {string} param
   * @returns {string}
   */
  function paramRuleId(type, param) {
    if (type === 'delay' && param === 'feedback') {
      return 'delay-feedback-cap';
    }
    if (type === 'eq' && /Gain$/.test(param)) {
      return 'eq-boost-per-band';
    }
    return type + '.' + param;
  }

  /**
   * @param {string} id - a CHAIN_RULES id.
   * @returns {Object|null} the rule entry, or null (unknown id).
   */
  function ruleById(id) {
    for (var i = 0; i < CHAIN_RULES.length; i++) {
      if (CHAIN_RULES[i].id === id) {
        return CHAIN_RULES[i];
      }
    }
    return null;
  }

  /**
   * @param {number} x
   * @returns {number} x rounded to 2 decimals (display-only; comparisons
   *   always use the unrounded values).
   */
  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  /**
   * A node entry's EFFECTIVE params: registered defaults overlaid with
   * the finite numbers actually stored. Model entries may legitimately
   * carry partial params (a preset node with only overrides), and every
   * cumulative rule (budget, boost sums) must reason about the value the
   * chain will really run with, not the sparse stored object.
   *
   * @param {{id: string, type: string, params?: Object}} entry
   * @returns {Object} fresh params object, fully populated.
   */
  function effectiveParamsFor(entry) {
    var params = {};
    paramSpecsFor(entry.type).forEach(function (spec) {
      params[spec.id] = spec.default;
    });
    var provided = entry.params || {};
    Object.keys(provided).forEach(function (key) {
      if (typeof provided[key] === 'number' && isFinite(provided[key])) {
        params[key] = provided[key];
      }
    });
    return params;
  }

  /**
   * rq3's +12 dB total direct-path gain budget, itemized: every gain
   * node's gainDb plus the estimated makeup (MAKEUP_DB_PER_THRESHOLD_DB *
   * |threshold/ceiling|) for each compressor-type node, per the
   * gain-budget-12db rule's published self-check formula.
   *
   * @param {Array<Object>} model - candidate entries (params may be
   *   partial; effective values are used).
   * @returns {{limitDb: number, estimatedDb: number, remainingDb: number, components: Array<Object>}}
   */
  function budgetBreakdown(model) {
    var components = [];
    var total = 0;
    model.forEach(function (entry) {
      var eff = effectiveParamsFor(entry);
      if (entry.type === 'gain' && typeof eff.gainDb === 'number') {
        total += eff.gainDb;
        components.push({
          node: entry.id, type: 'gain', param: 'gainDb',
          contributionDb: round2(eff.gainDb), detail: 'direct-path gain'
        });
      } else if (entry.type === 'compressor' && typeof eff.threshold === 'number') {
        var makeup = MAKEUP_DB_PER_THRESHOLD_DB * Math.abs(eff.threshold);
        total += makeup;
        components.push({
          node: entry.id, type: 'compressor', param: 'threshold',
          contributionDb: round2(makeup),
          detail: 'estimated makeup ' + MAKEUP_DB_PER_THRESHOLD_DB +
            ' * |threshold ' + eff.threshold + ' dB|'
        });
      } else if (entry.type === 'limiter' && typeof eff.ceiling === 'number') {
        var limiterMakeup = MAKEUP_DB_PER_THRESHOLD_DB * Math.abs(eff.ceiling);
        total += limiterMakeup;
        components.push({
          node: entry.id, type: 'limiter', param: 'ceiling',
          contributionDb: round2(limiterMakeup),
          detail: 'estimated makeup ' + MAKEUP_DB_PER_THRESHOLD_DB +
            ' * |ceiling ' + eff.ceiling + ' dB|'
        });
      }
    });
    return {
      limitDb: CHAIN_LIMITS.MAX_TOTAL_GAIN_DB,
      estimatedDb: round2(total),
      remainingDb: round2(CHAIN_LIMITS.MAX_TOTAL_GAIN_DB - total),
      components: components
    };
  }

  /**
   * Shared builder for chain-rule violation results (code = the rule id).
   *
   * @param {string} ruleId - a CHAIN_RULES id.
   * @param {Object} fields - extra fields merged in (counts, breakdowns).
   * @returns {Object}
   */
  function ruleViolationResult(ruleId, fields) {
    var rule = ruleById(ruleId);
    var result = {
      error: true,
      code: ruleId,
      rule_id: ruleId,
      applied: null
    };
    if (rule) {
      result.reason = fields && fields.reason ? fields.reason : rule.rule;
      result.enforcement = rule.enforcement;
      result.rule_text = rule.rule;
    } else {
      result.reason = fields && fields.reason ? fields.reason : ruleId;
    }
    if (fields) {
      Object.keys(fields).forEach(function (key) {
        result[key] = fields[key];
      });
    }
    return result;
  }

  /**
   * Evaluate EVERY rq3 chain rule against a full candidate model.
   * Returns ALL violations found (callers reject on the first; building
   * them all keeps the engine testable in one pass).
   *
   * @param {Array<Object>} model - the complete candidate chain.
   * @returns {Array<Object>} violation result objects (possibly []).
   */
  function evaluateChainRules(model) {
    var limits = CHAIN_LIMITS;
    var violations = [];
    var i;

    // node-count-cap
    if (model.length > limits.MAX_NODES) {
      violations.push(ruleViolationResult('node-count-cap', {
        count: model.length,
        limit: limits.MAX_NODES,
        suggestion: 'Remove nodes until the chain has at most ' +
          limits.MAX_NODES + ' (all types, including the required limiter).'
      }));
    }

    // limiter-required-terminal (missing / not terminal / duplicated)
    var lastIdx = model.length - 1;
    var terminalIsLimiter = lastIdx >= 0 && model[lastIdx].type === 'limiter';
    if (!terminalIsLimiter) {
      violations.push(ruleViolationResult('limiter-required-terminal', {
        reason: model.length === 0
          ? 'The chain is empty — a limiter is REQUIRED and must be the terminal (last) node.'
          : "The terminal (last) node is a '" + model[lastIdx].type +
            "', but a limiter is REQUIRED and must be terminal (last, MIC IN to OUT).",
        suggestion: 'End the chain with exactly one limiter node; the agent may only add, remove or reorder UPSTREAM of it.'
      }));
    } else {
      for (i = 0; i < lastIdx; i++) {
        if (model[i].type === 'limiter') {
          violations.push(ruleViolationResult('limiter-required-terminal', {
            node: model[i].id,
            position: i,
            reason: "Node '" + model[i].id + "' is a limiter at position " + i +
              ' — nothing may sit after the limiter (it must be TERMINAL), and only one is allowed.',
            suggestion: 'Keep exactly one limiter as the LAST node; remove or move the duplicate.'
          }));
        }
      }
    }

    // gain-node-count / compressor-node-count / eq-max-bands
    var gainNodes = [];
    var compressorNodes = [];
    var eqNodes = [];
    model.forEach(function (entry) {
      if (entry.type === 'gain') { gainNodes.push(entry.id); }
      if (entry.type === 'compressor' || entry.type === 'limiter') {
        compressorNodes.push(entry.id);
      }
      if (entry.type === 'eq') { eqNodes.push(entry.id); }
    });
    if (gainNodes.length > limits.MAX_GAIN_NODES) {
      violations.push(ruleViolationResult('gain-node-count', {
        count: gainNodes.length, limit: limits.MAX_GAIN_NODES, nodes: gainNodes,
        suggestion: 'Remove gain nodes (or fold trims into one node) until there are at most ' +
          limits.MAX_GAIN_NODES + '.'
      }));
    }
    if (compressorNodes.length > limits.MAX_COMPRESSOR_NODES) {
      violations.push(ruleViolationResult('compressor-node-count', {
        count: compressorNodes.length, limit: limits.MAX_COMPRESSOR_NODES,
        nodes: compressorNodes,
        suggestion: "Keep at most one 'compressor' node beyond the required terminal limiter."
      }));
    }
    var eqBandsPerNode = paramSpecsFor('eq').length; // 3 bands per eq node, derived from the registry
    if (eqNodes.length > 0 &&
        eqNodes.length * eqBandsPerNode > limits.MAX_EQ_BANDS) {
      violations.push(ruleViolationResult('eq-max-bands', {
        bands: eqNodes.length * eqBandsPerNode,
        limit: limits.MAX_EQ_BANDS,
        eqNodes: eqNodes,
        bandsPerEqNode: eqBandsPerNode,
        suggestion: 'Keep at most ' + (limits.MAX_EQ_BANDS / eqBandsPerNode) +
          ' eq nodes (' + limits.MAX_EQ_BANDS + ' bands total).'
      }));
    }

    // eq-boost-sum / eq-single-big-boost (+ boost totals for the compound guard)
    var bandParams = paramSpecsFor('eq').map(function (spec) { return spec.id; });
    var boostSum = 0;
    var bigBands = [];
    var boostBreakdown = [];
    model.forEach(function (entry) {
      if (entry.type !== 'eq') { return; }
      var eff = effectiveParamsFor(entry);
      bandParams.forEach(function (band) {
        var value = eff[band];
        if (typeof value !== 'number' || value <= 0) { return; }
        boostSum += value;
        boostBreakdown.push({ node: entry.id, band: band, dB: round2(value) });
        if (value >= limits.EQ_SINGLE_BOOST_FLOOR_DB) {
          bigBands.push({ node: entry.id, band: band, dB: round2(value) });
        }
      });
    });
    if (boostSum > limits.EQ_BOOST_SUM_MAX_DB) {
      violations.push(ruleViolationResult('eq-boost-sum', {
        sumDb: round2(boostSum),
        limit: limits.EQ_BOOST_SUM_MAX_DB,
        remainingDb: round2(limits.EQ_BOOST_SUM_MAX_DB - boostSum),
        breakdown: boostBreakdown,
        suggestion: 'Reduce EQ boosts so their sum is at most +' +
          limits.EQ_BOOST_SUM_MAX_DB + ' dB (per band, at most +9 dB).'
      }));
    }
    if (bigBands.length > 1) {
      violations.push(ruleViolationResult('eq-single-big-boost', {
        bands: bigBands,
        limit: 1,
        suggestion: 'At most ONE EQ band may boost +' +
          limits.EQ_SINGLE_BOOST_FLOOR_DB + ' dB or more; cut the others back.'
      }));
    }

    // compound-loop-guard: feedback >= 0.55 linear (55 %) AND boost sum >= +6 dB
    var maxFeedback = null;
    var maxFeedbackNode = null;
    model.forEach(function (entry) {
      if (entry.type !== 'delay') { return; }
      var eff = effectiveParamsFor(entry);
      if (typeof eff.feedback === 'number' &&
          (maxFeedback === null || eff.feedback > maxFeedback)) {
        maxFeedback = eff.feedback;
        maxFeedbackNode = entry.id;
      }
    });
    if (maxFeedback !== null &&
        maxFeedback >= limits.COMPOUND_FEEDBACK_MIN_PCT &&
        boostSum >= limits.COMPOUND_BOOST_SUM_MIN_DB) {
      violations.push(ruleViolationResult('compound-loop-guard', {
        feedback: { node: maxFeedbackNode, value: maxFeedback, unit: '%' },
        feedbackThreshold: limits.COMPOUND_FEEDBACK_MIN_PCT,
        boostSumDb: round2(boostSum),
        boostSumThreshold: limits.COMPOUND_BOOST_SUM_MIN_DB,
        suggestion: 'High loop gain plus spectral lift is how ringback starts: lower delay feedback below ' +
          limits.COMPOUND_FEEDBACK_MIN_PCT + ' % or reduce the EQ boost sum below +' +
          limits.COMPOUND_BOOST_SUM_MIN_DB + ' dB.'
      }));
    }

    // gain-budget-12db (with per-node breakdown so the agent can trade)
    var budget = budgetBreakdown(model);
    if (budget.estimatedDb > limits.MAX_TOTAL_GAIN_DB) {
      violations.push(ruleViolationResult('gain-budget-12db', {
        budget: budget,
        suggestion: 'Reduce a gain node\'s gainDb, or raise compressor threshold / limiter ceiling ' +
          '(every +1 dB frees ~' + MAKEUP_DB_PER_THRESHOLD_DB +
          ' dB of estimated makeup) until the estimate fits +' +
          limits.MAX_TOTAL_GAIN_DB + ' dB.'
      }));
    }

    return violations;
  }

  /**
   * Structured per-param reject (rq3 treatment 'reject'): nothing applied,
   * allowed range inline, plus remaining-budget numbers when the param
   * feeds a cumulative constraint (gain budget).
   *
   * @param {string} nodeId
   * @param {string} type
   * @param {string} param
   * @param {Object} policy - the AGENT_PARAM_POLICY entry.
   * @param {number} requested
   * @param {Array<Object>} [budgetModel] - candidate entries for the
   *   would-be budget estimate (gain.gainDb / compressor.threshold /
   *   limiter.ceiling rejects only).
   * @returns {Object}
   */
  function paramRejectResult(nodeId, type, param, policy, requested, budgetModel) {
    var result = {
      error: true,
      code: 'PARAM_OUT_OF_RANGE',
      node: nodeId,
      param: param,
      requested: requested,
      allowed: { min: policy.min, max: policy.max, unit: policy.unit },
      applied: null,
      rule_id: paramRuleId(type, param),
      reason: "Node '" + nodeId + "' param '" + param + "': requested " +
        requested + ' ' + policy.unit + ' is outside the agent range [' +
        policy.min + ', ' + policy.max + '] ' + policy.unit +
        ' (rq3 treatment: reject — nothing was applied).',
      suggestion: 'Set ' + param + ' within [' + policy.min + ', ' +
        policy.max + '] ' + policy.unit + '.'
    };
    if (budgetModel &&
        ((type === 'gain' && param === 'gainDb') ||
         (type === 'compressor' && param === 'threshold') ||
         (type === 'limiter' && param === 'ceiling'))) {
      result.budget = budgetBreakdown(budgetModel);
    }
    return result;
  }

  /**
   * Structured HOST_OWNED rejection (rq3: host-owned writes are rejected).
   *
   * @param {string|null} node - owning node id, or a description when the
   *   target is not a chain node.
   * @param {string|null} param
   * @param {string} ruleId - the disclosing CHAIN_RULES id.
   * @param {*} [requested]
   * @returns {Object}
   */
  function hostOwnedResult(node, param, ruleId, requested) {
    var result = {
      error: true,
      code: 'HOST_OWNED',
      node: node || null,
      param: param || null,
      applied: null,
      rule_id: ruleId,
      reason: (param ? "Param '" + param + "' on " : 'Element ') +
        (node ? "'" + node + "' " : '') +
        'is host-owned and not addressable by any tool (rq3: host-owned writes are rejected).',
      suggestion: 'Only the params get_capabilities lists for each node type are addressable.'
    };
    if (requested !== undefined) {
      result.requested = requested;
    }
    var rule = ruleById(ruleId);
    if (rule) {
      result.rule_text = rule.rule;
    }
    return result;
  }

  /**
   * @param {string} toolName
   * @param {string} nodeId - the id that was not found.
   * @param {Array<Object>} model - the live model (for valid ids).
   * @returns {Object}
   */
  function nodeNotFoundResult(toolName, nodeId, model) {
    var validIds = model.map(function (entry) { return entry.id; });
    return {
      error: true,
      code: 'NODE_NOT_FOUND',
      tool: toolName,
      node: nodeId,
      applied: null,
      validIds: validIds,
      reason: "No node with id '" + nodeId + "' exists in the current chain.",
      suggestion: validIds.length > 0
        ? 'Valid node ids right now: ' + validIds.join(', ') + '.'
        : 'The chain is currently empty — use set_chain (or add_node) to build one.'
    };
  }

  /**
   * @param {string} toolName
   * @returns {Object} the BUSY result (drag outlived the queue).
   */
  function busyResult(toolName) {
    return {
      error: true,
      code: 'BUSY',
      tool: toolName,
      applied: null,
      queuedMs: DRAG_QUEUE_TIMEOUT_MS,
      retry: true,
      reason: 'A user drag was still in progress after ' + DRAG_QUEUE_TIMEOUT_MS +
        ' ms; the mutation was queued but never applied.',
      suggestion: 'Wait for the drag to finish and retry the exact same call — nothing was changed.'
    };
  }

  /**
   * Apply the rq3 per-param policy to every PROVIDED param of a candidate
   * node list (omitted params keep the type defaults — a default can never
   * be an agent "request", which is also what keeps get_chain's output
   * round-tripping through set_chain for host-default values like the
   * limiter's factory ceiling). Rejects abort the whole mutation; clamps
   * saturate and are disclosed.
   *
   * @param {Array<Object>} nodes - raw {id, type, params?} entries.
   * @returns {{nodes: Array<Object>, clamped: Array<Object>, reject: Object|null}}
   */
  function applyPolicyToNodes(nodes) {
    var appliedNodes = [];
    var clamped = [];
    for (var i = 0; i < nodes.length; i++) {
      var entry = nodes[i];
      var params = effectiveParamsFor(entry); // defaults first
      var provided = entry.params || {};
      var keys = Object.keys(provided);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var value = provided[key];
        var policy = policyFor(entry.type, key);
        if (!policy) {
          params[key] = value; // no policy registered (registry drift) — nominal bounds already held structurally
          continue;
        }
        if (value < policy.min || value > policy.max) {
          if (policy.treatment === 'reject') {
            return {
              nodes: appliedNodes,
              clamped: clamped,
              reject: paramRejectResult(entry.id, entry.type, key, policy, value, nodes)
            };
          }
          var saturated = value < policy.min ? policy.min : policy.max;
          params[key] = saturated;
          clamped.push({
            node: entry.id,
            param: key,
            requested: value,
            applied: saturated,
            unit: policy.unit,
            rule_id: paramRuleId(entry.type, key)
          });
        } else {
          params[key] = value;
        }
      }
      appliedNodes.push({ id: entry.id, type: entry.type, params: params });
    }
    return { nodes: appliedNodes, clamped: clamped, reject: null };
  }

  /**
   * HOST_OWNED pre-scan of a whole candidate node list (set_chain /
   * add_node): names the first host-owned param attempt.
   *
   * @param {Array<Object>} nodes
   * @param {string} basePath - for the error's path context.
   * @returns {Object|null}
   */
  function findHostOwnedInNodes(nodes, basePath) {
    for (var i = 0; i < nodes.length; i++) {
      var entry = nodes[i];
      var provided = (entry && entry.params) || {};
      var keys = Object.keys(provided);
      for (var k = 0; k < keys.length; k++) {
        var ruleId = hostOwnedFor(entry.type, keys[k]);
        if (ruleId) {
          var result = hostOwnedResult(entry.id, keys[k], ruleId, provided[keys[k]]);
          result.path = basePath + '[' + i + '].params.' + keys[k];
          return result;
        }
      }
    }
    return null;
  }

  /**
   * Per-node state diff between the live model and a candidate (for the
   * success result's changes[]). Order-sensitive by id.
   *
   * @param {Array<Object>} oldModel
   * @param {Array<Object>} newModel
   * @returns {Array<Object>}
   */
  function diffModels(oldModel, newModel) {
    var oldById = {};
    var oldIndex = {};
    oldModel.forEach(function (entry, i) {
      oldById[entry.id] = entry;
      oldIndex[entry.id] = i;
    });
    var newById = {};
    newModel.forEach(function (entry, i) {
      newById[entry.id] = { entry: entry, index: i };
    });
    var changes = [];
    newModel.forEach(function (entry, i) {
      if (!oldById[entry.id]) {
        changes.push({ node: entry.id, type: entry.type, change: 'added', position: i });
        return;
      }
      if (oldIndex[entry.id] !== i) {
        changes.push({
          node: entry.id, type: entry.type, change: 'moved',
          fromIndex: oldIndex[entry.id], toIndex: i
        });
      }
      var oldEff = effectiveParamsFor(oldById[entry.id]);
      var newEff = effectiveParamsFor(entry);
      var paramChanges = {};
      Object.keys(newEff).forEach(function (key) {
        if (newEff[key] !== oldEff[key]) {
          paramChanges[key] = { from: oldEff[key], to: newEff[key] };
        }
      });
      if (Object.keys(paramChanges).length > 0) {
        changes.push({ node: entry.id, type: entry.type, change: 'params', params: paramChanges });
      }
    });
    oldModel.forEach(function (entry) {
      if (!newById[entry.id]) {
        changes.push({ node: entry.id, type: entry.type, change: 'removed' });
      }
    });
    return changes;
  }

  // ---------------------------------------------------------------------
  // Drag serialization (OQ-7) + the single write path + disclosure.
  // ---------------------------------------------------------------------

  /**
   * @returns {boolean} true when ChainCanvas reports a user drag active.
   *   Absent/damaged dependency = false (never blocks a mutation on a
   *   broken read).
   */
  function isDragActiveNow() {
    try {
      return !!(
        window.ChainCanvas &&
        typeof window.ChainCanvas.isDragActive === 'function' &&
        window.ChainCanvas.isDragActive()
      );
    } catch (err) {
      return false;
    }
  }

  /**
   * Queue a mutation behind an in-progress user drag, bounded. The plan is
   * computed AFTER the settle (never from a stale pre-drag model), so a
   * drop that commits mid-queue is always respected.
   *
   * @returns {Promise<boolean>} true = canvas idle (proceed); false =
   *   timed out (resolve BUSY).
   */
  function waitForDragSettle() {
    return new Promise(function (resolve) {
      if (!isDragActiveNow()) {
        resolve(true);
        return;
      }
      var deadline = Date.now() + DRAG_QUEUE_TIMEOUT_MS;
      var timer = setInterval(function () {
        if (!isDragActiveNow()) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() >= deadline) {
          clearInterval(timer);
          resolve(false);
        }
      }, DRAG_POLL_MS);
    });
  }

  /**
   * THE write path: apply a fully-validated candidate through
   * ChainCanvas.loadModel — exactly what src/presets-ui.js's Load button
   * calls — so agent mutations and the UI can never diverge into parallel
   * model owners. loadModel recomputes the canvas model, rebuilds the
   * cards, rebuilds the audio graph (a guarded no-op before Start — the
   * model-only pre-Start behavior the UI itself has) and re-baselines the
   * autosave.
   *
   * Reuse catch-up: AudioGraph.buildGraph() reuses live node instances by
   * id AND TYPE (issue #1 — never on id alone) and deliberately does NOT
   * re-apply params to reused instances, so params that changed on a
   * surviving node are pushed to the live node the same way the UI's own
   * slider path does it (NodeTypes.applyParam direct writes, per
   * src/param-controls.js). New nodes — including ids whose TYPE changed,
   * which get a fresh factory-built replacement — have their params from
   * the factory at creation.
   *
   * @param {Array<Object>} candidate - fully-validated model entries.
   */
  function applyCandidateViaUi(candidate) {
    if (!window.ChainCanvas || typeof window.ChainCanvas.loadModel !== 'function') {
      throw new Error('McpTools: ChainCanvas.loadModel is not available — no write path to the chain model.');
    }
    // Issue #1 (P0): a live instance is a legitimate catch-up target only
    // when it satisfies the SAME id-AND-type guard buildGraph() applies
    // when deciding what to reuse — i.e. when the model the live graph was
    // actually built from still types this entry's id as entry.type.
    // AudioGraph.getModel() is read BEFORE loadModel here on purpose: the
    // graph's model and its instance map commit together on buildGraph()'s
    // deferred rewire (~20ms later), so this pre-apply snapshot types
    // EXACTLY the instances getNodeInstance() hands back below, making
    // this decision mirror the reuse decision the rebuild is about to
    // make. For an id whose type changed, the rebuild factories a fresh
    // instance with the entry's params applied at creation, so pushing
    // params at the old, wrong-typed instance would at best die inside
    // applyParam's per-write try/catch and at worst scribble onto a node
    // the rewire is about to disconnect for good — skip it, exactly like
    // buildGraph skips it.
    var liveTypes = {};
    try {
      if (window.AudioGraph && typeof window.AudioGraph.getModel === 'function') {
        window.AudioGraph.getModel().forEach(function (entry) {
          liveTypes[entry.id] = entry.type;
        });
      }
    } catch (err) {
      // Same best-effort contract as instance capture below: a miss just
      // means no live catch-up.
    }
    var reusable = {};
    candidate.forEach(function (entry) {
      if (liveTypes[entry.id] !== entry.type) {
        return; // New id, or an id whose type changed — fresh instance, no catch-up.
      }
      try {
        var inst =
          window.AudioGraph && typeof window.AudioGraph.getNodeInstance === 'function'
            ? window.AudioGraph.getNodeInstance(entry.id)
            : null;
        if (inst) {
          reusable[entry.id] = inst;
        }
      } catch (err) {
        // Instance capture is best-effort; a miss just means no live catch-up.
      }
    });
    // Deep copy: loadModel takes ownership of the array it is handed (its
    // nodesById stores the very object references) — hand it copies so the
    // enforcement engine's candidate can never be mutated through app state.
    var modelForUi = candidate.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
    window.ChainCanvas.loadModel(modelForUi);
    candidate.forEach(function (entry) {
      var inst = reusable[entry.id];
      if (!inst) {
        return;
      }
      Object.keys(entry.params).forEach(function (key) {
        try {
          if (window.NodeTypes && typeof window.NodeTypes.applyParam === 'function') {
            window.NodeTypes.applyParam(entry.type, inst, key, entry.params[key]);
          }
        } catch (err) {
          // One bad write must not abort the remaining catch-up writes.
        }
      });
    });
    // An agent mutation is an EDIT of whatever preset was displayed — the
    // same markModified() the canvas fires at its own user-edit
    // chokepoints (the preset-name display itself stays host-managed
    // until MC-5's save_preset).
    try {
      if (window.PresetsUI && typeof window.PresetsUI.markModified === 'function') {
        window.PresetsUI.markModified();
      }
    } catch (err) {
      // Display-only.
    }
  }

  /**
   * Success disclosure (FEW-1 contract): one-line summary + affected node
   * ids + clamped param names. Guarded — agent feedback can never fail a
   * mutation. MC-5 upgrades this to full summaries + undo snapshots.
   *
   * @param {string} summary
   * @param {Array<string>} nodeIds
   * @param {Array<Object>} clamped - clamped entries ({node, param, ...}).
   */
  function reportAgentMutation(summary, nodeIds, clamped) {
    try {
      if (window.AgentUI && typeof window.AgentUI.reportMutation === 'function') {
        var detail = { source: 'agent', summary: summary };
        if (nodeIds && nodeIds.length > 0) {
          detail.nodeIds = nodeIds.slice();
        }
        if (clamped && clamped.length > 0) {
          detail.clamped = clamped.map(function (c) { return c.node + '.' + c.param; });
        }
        window.AgentUI.reportMutation(detail);
      }
    } catch (err) {
      // UI feedback is best-effort by contract; never fail the mutation.
    }
  }

  /**
   * Mint a unique id for an add_node-created node: 'agent-N', bumped past
   * anything already in the live model (the canvas's own 'node-N' scheme
   * can never collide — different prefix).
   *
   * @param {Array<Object>} model
   * @returns {string}
   */
  function mintNodeId(model) {
    var existing = {};
    model.forEach(function (entry) { existing[entry.id] = true; });
    var id;
    do {
      agentNodeIdCounter += 1;
      id = 'agent-' + agentNodeIdCounter;
    } while (existing[id]);
    return id;
  }

  /**
   * @param {Array<Object>} clamped
   * @returns {string} '' or ', N value(s) clamped to policy' for summaries.
   */
  function clampSuffix(clamped) {
    return clamped && clamped.length > 0
      ? ', ' + clamped.length + ' value' + (clamped.length > 1 ? 's' : '') + ' clamped to policy'
      : '';
  }

  // ---------------------------------------------------------------------
  // MC-5 — change summaries, exact-state snapshots + undo, save_preset.
  //
  // Three pieces, all layered on the MC-4 machinery above:
  //   (1) summary/label formatters (human-readable one-liners for
  //       reportMutation toasts + the compact undo labels);
  //   (2) the snapshot pipeline: deep clone of the pre-apply model +
  //       preset display state -> AgentUI.pushUndo({label, restore}),
  //       where restore() re-applies through applyCandidateViaUi (the
  //       SAME single write path) and mirrors presets-ui's display
  //       operations; the FEW-1 stack cap (20) is the only bound — this
  //       layer keeps no second undo stack;
  //   (3) save_preset: PresetStore.save through the UI Save flow's own
  //       steps, with undo that deletes (created) or re-saves (overwrote).
  // ---------------------------------------------------------------------

  /**
   * Human label for a node type: the live registry's label, else the
   * static TYPE_INFO label, else the type id itself.
   *
   * @param {string} type
   * @returns {string}
   */
  function typeLabel(type) {
    try {
      if (window.NodeTypes && typeof window.NodeTypes.getLabel === 'function') {
        var live = window.NodeTypes.getLabel(type);
        if (typeof live === 'string' && live.length > 0) {
          return live;
        }
      }
    } catch (err) {
      // Static fallback stands.
    }
    return (TYPE_INFO[type] && TYPE_INFO[type].label) || type;
  }

  /**
   * Param id -> readable words for summaries: 'midGain' -> 'mid gain',
   * 'gainDb' -> 'gain dB', 'timeMs' -> 'time ms', 'mix' -> 'mix'.
   *
   * @param {string} paramId
   * @returns {string}
   */
  function paramWords(paramId) {
    return String(paramId)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(function (part) {
        if (part === 'Db') { return 'dB'; }
        if (part === 'Ms') { return 'ms'; }
        // Lower-case every fragment's head ('Gain' -> 'gain') EXCEPT the
        // unit fragments already mapped above.
        return part.charAt(0).toLowerCase() + part.slice(1);
      })
      .join(' ');
  }

  /**
   * Unit-aware value rendering for summaries: 3 dB -> '+3 dB',
   * -2 dB -> '-2 dB', 30 % -> '30%', 4 ':1' -> '4:1', 300 ms -> '300 ms'.
   * Gains in dB carry an explicit + for boosts (the vocal-EQ convention).
   *
   * @param {number} value
   * @param {string} unit - policy/spec unit ('' when unknown).
   * @returns {string}
   */
  function formatParamValue(value, unit) {
    var v = typeof value === 'number' ? round2(value) : value;
    var s = String(v);
    if (typeof v === 'number' && unit === 'dB' && v > 0) {
      s = '+' + s;
    }
    if (!unit) {
      return s;
    }
    if (unit === '%') {
      return s + '%';
    }
    if (unit === ':1') {
      return s + ':1';
    }
    return s + ' ' + unit;
  }

  /**
   * The unit string a param's summary should use: the agent policy's
   * unit, else the nominal registry spec's, else ''.
   *
   * @param {string} type
   * @param {string} param
   * @returns {string}
   */
  function unitFor(type, param) {
    var policy = policyFor(type, param);
    if (policy) {
      return policy.unit;
    }
    var spec = findSpec(paramSpecsFor(type), param);
    return (spec && spec.unit) || '';
  }

  /**
   * Parenthetical '(key params…)' clause for an added node's summary —
   * at most two provided params spelled out, the rest counted ('+1 more'),
   * '' when the node was created with no params.
   *
   * @param {string} type
   * @param {Object} provided - the input's params object.
   * @param {Object} effective - the applied (clamped) effective params.
   * @returns {string}
   */
  function describeProvidedParams(type, provided, effective) {
    if (!provided) {
      return '';
    }
    var keys = Object.keys(provided);
    if (keys.length === 0) {
      return '';
    }
    var parts = [];
    for (var i = 0; i < keys.length && parts.length < 2; i++) {
      parts.push(
        paramWords(keys[i]) + ' ' + formatParamValue(effective[keys[i]], unitFor(type, keys[i]))
      );
    }
    var clause = ' (' + parts.join(', ');
    if (keys.length > parts.length) {
      clause += ', +' + (keys.length - parts.length) + ' more';
    }
    return clause + ')';
  }

  /**
   * One-line, length-capped rendering of an error reason for the
   * rejected-mutation toast's errorText note (rule texts can run long).
   *
   * @param {*} text
   * @param {number} [max] - character cap (default 160).
   * @returns {string}
   */
  function firstLineForToast(text, max) {
    var cap = typeof max === 'number' ? max : 160;
    var s = String(text === undefined || text === null ? '' : text)
      .replace(/\s+/g, ' ')
      .trim();
    if (s.length <= cap) {
      return s;
    }
    var cut = s.slice(0, cap);
    var sp = cut.lastIndexOf(' ');
    if (sp > cap * 0.6) {
      cut = cut.slice(0, sp);
    }
    return cut.replace(/[,;:.]+$/, '') + '…';
  }

  /**
   * Rejection disclosure (MC-5): a refused mutation already resolves a
   * structured error to the AGENT — this ALSO toasts it so the OPERATOR
   * sees refusals ({ rejected: true } per the FEW-1 contract; VIS-6's
   * adversarial-rejection styling keys on it). Guarded like
   * reportAgentMutation: feedback can never fail the tool result.
   *
   * @param {string} toolName
   * @param {Object} errorResult - the error result being resolved.
   */
  function reportAgentRejection(toolName, errorResult) {
    try {
      if (window.AgentUI && typeof window.AgentUI.reportMutation === 'function') {
        var code = errorResult && errorResult.code ? errorResult.code : 'ERROR';
        var why =
          errorResult && errorResult.reason
            ? errorResult.reason
            : errorResult && errorResult.rule_text
              ? errorResult.rule_text
              : code;
        window.AgentUI.reportMutation({
          source: 'agent',
          summary: 'Agent request refused: ' + toolName + ' (' + code + ')',
          rejected: true,
          errorText: firstLineForToast(why)
        });
      }
    } catch (err) {
      // Best-effort by contract; never fail anything for a toast.
    }
  }

  /**
   * Structure-clone a pure-JSON value through JSON — the ES5-safe
   * equivalent of structuredClone for this app's model data. FULL depth:
   * the result shares no references with the source at any level, so a
   * snapshot taken this way is immune to every later mutation (the model
   * entries are {id, type, params-of-numbers}; JSON round-trips them
   * exactly, and values are primitives so there is no deeper structure
   * to miss).
   *
   * @param {*} value
   * @returns {*}
   */
  function deepCloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * The undo-snapshot copy of a chain model: PresetSchema.serialize (the
   * authoritative shape — the same wire format save_preset persists)
   * followed by a structure clone for full immunity, falling back to a
   * hand-rolled clone when the schema module is absent (e.g. a bare test
   * harness).
   *
   * @param {Array<Object>} model - the pre-apply model (already a fresh
   *   read from ChainCanvas, but cloned again here regardless).
   * @returns {Array<Object>} a fully detached copy.
   */
  function snapshotModelNodes(model) {
    try {
      if (window.PresetSchema && typeof window.PresetSchema.serialize === 'function') {
        return deepCloneJson(window.PresetSchema.serialize('__undo_snapshot__', model).nodes);
      }
    } catch (err) {
      // Serialize refused (should not happen) — hand-clone below.
    }
    return model.map(function (entry) {
      return {
        id: entry.id,
        type: entry.type,
        params: deepCloneJson(entry.params || {})
      };
    });
  }

  /**
   * Capture the full pre-apply undo state for a mutation: the model (as
   * read post-drag-settle, the exact base the plan was computed against)
   * plus the preset display state (name + unsaved dot) read BEFORE the
   * apply's markModified() fires.
   *
   * @param {Array<Object>} model
   * @returns {{nodes: Array<Object>, presetName: string|null, unsaved: boolean|null}}
   */
  function captureUndoSnapshot(model) {
    var display = readPresetDisplay();
    return {
      nodes: snapshotModelNodes(model),
      presetName: display.name,
      unsaved: display.unsaved
    };
  }

  /**
   * Best-effort undo push (AgentUI enforces the {label, restore} shape
   * and the 20-entry cap; FEW-1 owns the only stack).
   *
   * @param {string} label
   * @param {Function} restore
   */
  function pushUndoEntry(label, restore) {
    try {
      if (window.AgentUI && typeof window.AgentUI.pushUndo === 'function') {
        window.AgentUI.pushUndo({ label: label, restore: restore });
      }
    } catch (err) {
      // Undo affordance is best-effort; the mutation itself stands.
    }
  }

  /**
   * The restore() closure for a mutation snapshot: re-applies the
   * snapshotted nodes through applyCandidateViaUi — the SAME single
   * write path the mutation used (loadModel + live-instance catch-up +
   * markModified), deliberately WITHOUT re-running the policy engine: a
   * snapshot restores what the HUMAN had (which may legitimately sit
   * outside the agent ranges — e.g. the factory default's limiter
   * ceiling), never what an agent may request. Then it restores the
   * preset display through the PresetsUI exports (VIS-3: the real single
   * write path — the name display, and the unsaved dot via markModified
   * when the snapshot was modified / clearModified when it was clean).
   * Never throws, whatever is missing or damaged underneath.
   *
   * @param {{nodes: Array<Object>, presetName: string|null, unsaved: boolean|null}} snapshot
   * @returns {Function}
   */
  function makeSnapshotRestore(snapshot) {
    return function () {
      try {
        applyCandidateViaUi(snapshot.nodes);
        presetsUiSetCurrentPreset(snapshot.presetName);
        if (snapshot.unsaved === true) {
          try {
            if (window.PresetsUI && typeof window.PresetsUI.markModified === 'function') {
              window.PresetsUI.markModified();
            }
          } catch (err) {
            // Display-only.
          }
        } else if (snapshot.unsaved === false) {
          presetsUiClearModified();
        }
        // unsaved === null: indicator was absent at snapshot time — leave
        // whatever display state applyCandidateViaUi produced.
      } catch (err) {
        // AgentUI.undo() catches restore() throws; this keeps the console
        // clean for EXPECTED absences (e.g. ChainCanvas gone). The entry
        // stays popped either way — a partial restore is never retried.
      }
    };
  }

  // ---------------------------------------------------------------------
  // VIS-3 — PresetsUI display writes (single write path). src/presets-ui.js
  // now exports its full display write path (setCurrentPreset,
  // clearModified, refreshPresetSelect — alongside the always-exported
  // markModified), so save_preset and the undo restores call THOSE
  // instead of MC-5's temporary DOM mirrors. This closes MC-5's known
  // caveat for real: the exported setCurrentPreset updates presets-ui's
  // private currentPresetName too, so the Save prompt's default
  // suggestion can no longer lag the displayed name after an agent
  // write. Hard dependency by design — when an export is absent (a bare
  // test harness, a damaged page), the call degrades silently after ONE
  // console.warn per export name; there is deliberately NO mirror
  // fallback anymore (a second owner of the display state is exactly
  // what this consolidation removes).
  // ---------------------------------------------------------------------

  /**
   * Resolve one window.PresetsUI export, or null when absent. Warns ONCE
   * per missing export name (never per call) so a long agent session
   * against a damaged page cannot spam the console.
   *
   * @param {string} name - the export's property name.
   * @returns {Function|null}
   */
  var warnedPresetsUiExports = {};
  function presetsUiExport(name) {
    try {
      if (window.PresetsUI && typeof window.PresetsUI[name] === 'function') {
        return window.PresetsUI[name];
      }
    } catch (err) {
      // Fall through to the absent path.
    }
    if (!warnedPresetsUiExports[name]) {
      warnedPresetsUiExports[name] = true;
      try {
        console.warn(
          'McpTools: window.PresetsUI.' + name +
            ' is not available — the preset panel display was not updated.'
        );
      } catch (warnErr) {
        // Console itself unavailable — degrade silently.
      }
    }
    return null;
  }

  /**
   * presets-ui's own setCurrentPreset(): write the preset name display
   * (null/'' -> the 'Unsaved chain' placeholder) AND its private
   * currentPresetName state.
   *
   * @param {string|null} name
   */
  function presetsUiSetCurrentPreset(name) {
    var fn = presetsUiExport('setCurrentPreset');
    if (fn) {
      try {
        fn(name);
      } catch (err) {
        // Display-only — same never-throw contract as the retired mirror.
      }
    }
  }

  /**
   * presets-ui's own clearModified(): hide the unsaved dot.
   */
  function presetsUiClearModified() {
    var fn = presetsUiExport('clearModified');
    if (fn) {
      try {
        fn();
      } catch (err) {
        // Display-only.
      }
    }
  }

  /**
   * presets-ui's own refreshPresetSelect(): rebuild #preset-select's
   * option list from PresetStore.listNames() (the store's own list API),
   * selecting `selectName` when it is present, so the HUMAN's preset
   * dropdown stays in sync with agent-driven store changes (save_preset's
   * own description promises the preset "appears in the app's Presets
   * panel"). No-op when the export is absent.
   *
   * @param {string} [selectName]
   */
  function presetsUiRefreshPresetSelect(selectName) {
    var fn = presetsUiExport('refreshPresetSelect');
    if (fn) {
      try {
        fn(selectName);
      } catch (err) {
        // Display-only.
      }
    }
  }

  // ---------------------------------------------------------------------
  // Per-tool planners: (input, liveModel) -> {error} | success plan.
  // ---------------------------------------------------------------------

  /**
   * set_chain: wholesale replace. All provided params are requests; the
   * full candidate is judged against every chain rule before anything is
   * applied.
   */
  function planSetChain(input, model) {
    var nodes = input.chain.nodes;
    var hostOwned = findHostOwnedInNodes(nodes, 'chain.nodes');
    if (hostOwned) {
      return { error: hostOwned };
    }
    var applied = applyPolicyToNodes(nodes);
    if (applied.reject) {
      return { error: applied.reject };
    }
    var violations = evaluateChainRules(applied.nodes);
    if (violations.length > 0) {
      return { error: violations[0] };
    }
    var nodeIds = applied.nodes.map(function (entry) { return entry.id; });
    var count = applied.nodes.length;
    var nodeWord = count === 1 ? 'node' : 'nodes';
    var chainName = input.chain.name;
    return {
      candidate: applied.nodes,
      clamped: applied.clamped,
      changes: diffModels(model, applied.nodes),
      nodeIds: nodeIds,
      summary: 'Agent replaced chain: ' + count + ' ' + nodeWord + ' (' + chainName + ')' +
        clampSuffix(applied.clamped),
      label: 'set_chain ' + count + ' ' + nodeWord + ' (' + chainName + ')'
    };
  }

  /**
   * add_node: one node inserted at `position` (clamped into range; append
   * when omitted). The id is minted by the host and disclosed in the
   * result note. Appending behind the terminal limiter rejects, per the
   * required-terminal rule.
   */
  function planAddNode(input, model) {
    var id = mintNodeId(model);
    var hostOwned = findHostOwnedInNodes(
      [{ id: id, type: input.type, params: input.params }],
      'params'
    );
    if (hostOwned) {
      return { error: hostOwned };
    }
    var applied = applyPolicyToNodes([{ id: id, type: input.type, params: input.params }]);
    if (applied.reject) {
      return { error: applied.reject };
    }
    var node = applied.nodes[0];
    var requestedPosition =
      input.position === undefined || input.position === null
        ? model.length
        : input.position;
    var position = Math.min(Math.max(0, requestedPosition), model.length);
    var candidate = model.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
    candidate.splice(position, 0, node);
    var violations = evaluateChainRules(candidate);
    if (violations.length > 0) {
      var error = violations[0];
      if (error.code === 'limiter-required-terminal' && requestedPosition >= model.length && model.length > 0) {
        error.reason = "Appending at the end would place the new '" + input.type +
          "' AFTER the terminal limiter — nothing may sit after it. " + error.reason;
        error.suggestion = 'Insert upstream of the limiter instead (position ' +
          (model.length - 1) + ' or less).';
      }
      return { error: error };
    }
    var displayName = typeLabel(input.type);
    var paramsClause = describeProvidedParams(input.type, input.params, node.params);
    return {
      candidate: candidate,
      clamped: applied.clamped,
      changes: [{ node: id, type: input.type, change: 'added', position: position }],
      nodeIds: [id],
      summary: 'Agent added ' + displayName + paramsClause + ' at position ' + position +
        clampSuffix(applied.clamped),
      label: 'add_node ' + displayName + ' (' + id + ') at position ' + position,
      note: "The host assigned id '" + id +
        "' (add_node takes no id argument) — use it for set_param/remove_node." +
        (position !== requestedPosition
          ? ' Requested position ' + requestedPosition +
            ' was out of range; the node was inserted at ' + position + '.'
          : '')
    };
  }

  /**
   * remove_node: limiter removal is a hard reject; unknown ids are
   * structured errors naming the valid ones. Cumulative rules are
   * re-evaluated on the candidate for uniformity (a removal can only
   * loosen them, so this never blocks a legal removal).
   */
  function planRemoveNode(input, model) {
    if (ATTENUATOR_ID_RE.test(input.nodeId)) {
      return {
        error: hostOwnedResult(input.nodeId, null, 'host-output-attenuator')
      };
    }
    var index = -1;
    for (var i = 0; i < model.length; i++) {
      if (model[i].id === input.nodeId) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      return { error: nodeNotFoundResult('remove_node', input.nodeId, model) };
    }
    if (model[index].type === 'limiter') {
      return {
        error: ruleViolationResult('limiter-required-terminal', {
          node: input.nodeId,
          reason: "Node '" + input.nodeId +
            "' is the SAFETY LIMITER — removing it is a hard reject (a limiter is required and must stay terminal).",
          suggestion: 'Remove or rework upstream nodes instead; the limiter is host-protected.'
        })
      };
    }
    var candidate = model
      .slice(0, index)
      .concat(model.slice(index + 1))
      .map(function (entry) {
        return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
      });
    var violations = evaluateChainRules(candidate);
    if (violations.length > 0) {
      return { error: violations[0] };
    }
    var displayName = typeLabel(model[index].type);
    return {
      candidate: candidate,
      clamped: [],
      changes: [{ node: input.nodeId, type: model[index].type, change: 'removed' }],
      nodeIds: [input.nodeId],
      summary: 'Agent removed ' + displayName + ' (' + input.nodeId + ')',
      label: 'remove_node ' + input.nodeId + ' (' + displayName + ')'
    };
  }

  /**
   * set_param: one param on one existing node. The single param gets the
   * per-param policy treatment; the FULL chain is then re-evaluated with
   * the new value (budget and every other cumulative rule).
   */
  function planSetParam(input, model) {
    if (ATTENUATOR_ID_RE.test(input.nodeId)) {
      return {
        error: hostOwnedResult(input.nodeId, null, 'host-output-attenuator', input.value)
      };
    }
    var index = -1;
    for (var i = 0; i < model.length; i++) {
      if (model[i].id === input.nodeId) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      return { error: nodeNotFoundResult('set_param', input.nodeId, model) };
    }
    var entry = model[index];
    var hostRule = hostOwnedFor(entry.type, input.param);
    if (hostRule) {
      return { error: hostOwnedResult(entry.id, input.param, hostRule, input.value) };
    }
    var clamped = [];
    var finalValue = input.value;
    var policy = policyFor(entry.type, input.param);
    if (policy && (input.value < policy.min || input.value > policy.max)) {
      if (policy.treatment === 'reject') {
        // Budget context for the cumulative-feeding params: the would-be
        // candidate (requested value in place) so the agent sees the exact
        // trade in the same error.
        var wouldBe = model.map(function (e) {
          var params = Object.assign({}, e.params);
          if (e.id === entry.id) {
            params[input.param] = input.value;
          }
          return { id: e.id, type: e.type, params: params };
        });
        return {
          error: paramRejectResult(entry.id, entry.type, input.param, policy, input.value, wouldBe)
        };
      }
      finalValue = input.value < policy.min ? policy.min : policy.max;
      clamped.push({
        node: entry.id,
        param: input.param,
        requested: input.value,
        applied: finalValue,
        unit: policy.unit,
        rule_id: paramRuleId(entry.type, input.param)
      });
    }
    var candidate = model.map(function (e, i) {
      var params = Object.assign({}, e.params);
      if (i === index) {
        params[input.param] = finalValue;
      }
      return { id: e.id, type: e.type, params: params };
    });
    var violations = evaluateChainRules(candidate);
    if (violations.length > 0) {
      return { error: violations[0] };
    }
    var fromValue = effectiveParamsFor(entry)[input.param];
    var unit = policy ? policy.unit : unitFor(entry.type, input.param);
    var displayName = typeLabel(entry.type);
    var paramDiff = {};
    paramDiff[input.param] = { from: fromValue, to: finalValue };
    return {
      candidate: candidate,
      clamped: clamped,
      changes: [{
        node: entry.id,
        type: entry.type,
        change: 'params',
        params: paramDiff
      }],
      nodeIds: [entry.id],
      summary: 'Agent set ' + displayName + ' ' + paramWords(input.param) + ' to ' +
        formatParamValue(finalValue, unit) + ' (' + entry.id + ')' + clampSuffix(clamped),
      label: 'set_param ' + entry.id + '.' + input.param + ' ' +
        formatParamValue(finalValue, unit)
    };
  }

  // ---------------------------------------------------------------------
  // Shared validators.
  // ---------------------------------------------------------------------

  /**
   * Root input check shared by every tool: an omitted input is an empty
   * object; a present input must at least be a plain object. Extra
   * top-level properties beyond the schema are tolerated (JSON-Schema
   * default) EXCEPT inside `params` objects, where unknown keys are
   * rejected by name — that asymmetry is deliberate: param keys hit real
   * AudioParams, stray envelope keys don't.
   *
   * @param {*} input
   * @param {Array<Object>} problems
   * @returns {Object} the input, normalized to an object.
   */
  function checkInputObject(input, problems) {
    if (input === undefined || input === null) {
      return {};
    }
    if (!isPlainObject(input)) {
      problems.push(
        problem('(input)', 'input must be an object; got ' + displayValue(input))
      );
      return {};
    }
    return input;
  }

  /**
   * Required-field helpers: each pushes one problem naming the field.
   */
  function requireString(input, key, problems) {
    if (input[key] === undefined) {
      problems.push(problem(key, "'" + key + "' is required and was missing"));
      return false;
    }
    if (typeof input[key] !== 'string' || input[key].length === 0) {
      problems.push(
        problem(key, "'" + key + "' must be a non-empty string; got " + displayValue(input[key]))
      );
      return false;
    }
    return true;
  }

  function requireNumberOrBoolean(input, key, problems) {
    if (input[key] === undefined) {
      problems.push(problem(key, "'" + key + "' is required and was missing"));
      return false;
    }
    var ok =
      typeof input[key] === 'boolean' ||
      (typeof input[key] === 'number' && isFinite(input[key]));
    if (!ok) {
      problems.push(
        problem(key, "'" + key + "' must be a finite number (or boolean); got " + displayValue(input[key]))
      );
    }
    return ok;
  }

  /**
   * Structural check of one param value against its spec: finite number
   * within the app's NOMINAL range (the node file's own min/max). This is
   * the loosest tier — RQ-3's tighter agent ranges/reject-clamp policy
   * are MC-4's and intentionally NOT encoded here.
   *
   * @param {Object} spec - {id, unit, min, max}.
   * @param {*} value
   * @param {string} path
   * @param {Array<Object>} problems
   */
  function checkSpecValue(spec, value, path, problems) {
    if (typeof value !== 'number' || !isFinite(value)) {
      problems.push(
        problem(path, spec.id + ' must be a finite number' +
          (spec.unit ? ' in ' + spec.unit : '') + '; got ' + displayValue(value))
      );
      return;
    }
    if (value < spec.min || value > spec.max) {
      problems.push(
        problem(
          path,
          spec.id + ' must be within its nominal range ' + spec.min + ' to ' +
            spec.max + (spec.unit ? ' ' + spec.unit : '') + '; got ' + value
        )
      );
    }
  }

  /**
   * Validate a params object against a node type's real params: keys must
   * be that type's registered param names (unknown key names the allowed
   * list), values structurally numeric within nominal range. An omitted
   * params object is fine (type defaults — same leniency as
   * preset-schema.js's deserialize).
   *
   * @param {string} type - the node type the params belong to.
   * @param {*} params
   * @param {string} basePath - path prefix for problems ('params' or
   *   'chain.nodes[i].params').
   * @param {Array<Object>} problems
   */
  function validateParamsForType(type, params, basePath, problems) {
    if (params === undefined || params === null) {
      return;
    }
    if (!isPlainObject(params)) {
      problems.push(
        problem(basePath, 'params must be an object keyed by ' + type +
          "'s param names; got " + displayValue(params))
      );
      return;
    }
    var specs = paramSpecsFor(type);
    var allowed = specIds(specs);
    Object.keys(params).forEach(function (key) {
      var spec = findSpec(specs, key);
      if (!spec) {
        // MC-4 carve-out: a HOST_OWNED name (limiter ratio/attack/knee,
        // reverb normalize/buffer) is let through the structural layer so
        // the enforcement engine can reject it with the structured
        // HOST_OWNED error naming the owning rule — a better answer than
        // the generic unknown-param problem for a name the agent will
        // keep guessing otherwise.
        if (hostOwnedFor(type, key)) {
          return;
        }
        problems.push(
          problem(basePath + '.' + key, "unknown param '" + key + "' for type '" +
            type + "'", allowed)
        );
        return;
      }
      checkSpecValue(spec, params[key], basePath + '.' + key, problems);
    });
  }

  /**
   * Structural validation of a set_chain/add_node chain object. Mirrors
   * src/preset-schema.js's deserialize() rules (schemaVersion === 1,
   * non-empty name, nodes array of {id, type, params?}) and adds two
   * checks deserialize deliberately leaves to build time, both structural
   * rather than policy: node types must be registered, and params keys/
   * values must fit the type (same rules add_node applies). Duplicate node
   * ids are also rejected — the app's model is keyed by id, so duplicates
   * would silently drop a node.
   *
   * @param {*} chain
   * @param {Array<Object>} problems
   */
  function validateChainObject(chain, problems) {
    if (!isPlainObject(chain)) {
      problems.push(
        problem('chain', 'chain must be a preset-shaped object ' +
          '{schemaVersion: 1, name, nodes: [{id, type, params}]}; got ' + displayValue(chain))
      );
      return;
    }
    if (chain.schemaVersion !== 1) {
      problems.push(
        problem('chain.schemaVersion', 'must be the number 1 (the only schema version); got ' +
          displayValue(chain.schemaVersion))
      );
    }
    if (typeof chain.name !== 'string' || chain.name.length === 0) {
      problems.push(problem('chain.name', 'must be a non-empty string'));
    } else if (chain.name.length > 80) {
      // QA-2 finding: without a bound, a huge chain.name (1 MB class) would
      // apply and land verbatim in toast/undo labels. 80 chars: generous for
      // a display name, far under save_preset's 40-char stored-preset cap.
      problems.push(
        problem('chain.name', 'must be at most 80 characters (got ' + chain.name.length + ')')
      );
    }
    if (!Array.isArray(chain.nodes)) {
      problems.push(
        problem('chain.nodes', 'must be an array of {id, type, params} node objects, MIC IN to OUT')
      );
      return;
    }
    var types = registryTypes();
    var seenIds = {};
    chain.nodes.forEach(function (entry, i) {
      var nodePath = 'chain.nodes[' + i + ']';
      if (!isPlainObject(entry)) {
        problems.push(problem(nodePath, 'must be an object {id, type, params}; got ' + displayValue(entry)));
        return;
      }
      if (typeof entry.id !== 'string' || entry.id.length === 0) {
        problems.push(problem(nodePath + '.id', 'must be a non-empty string'));
      } else if (seenIds[entry.id]) {
        problems.push(
          problem(nodePath + '.id', "duplicate id '" + entry.id + "' — node ids must be unique within the chain")
        );
      } else {
        seenIds[entry.id] = true;
      }
      if (typeof entry.type !== 'string' || entry.type.length === 0) {
        problems.push(problem(nodePath + '.type', 'must be a non-empty string'));
        return;
      }
      if (types.indexOf(entry.type) === -1) {
        problems.push(
          problem(nodePath + '.type', "unknown node type '" + entry.type + "'", types)
        );
        return;
      }
      validateParamsForType(entry.type, entry.params, nodePath + '.params', problems);
    });
  }

  /**
   * Authoritative reuse of src/preset-schema.js when it is loaded: run
   * deserialize() on the candidate and, if it rejects a chain my mirror
   * walk above found clean (i.e. the two ever drift), surface its message
   * so the stricter of the two always wins. deserialize() throws by
   * design and touches nothing — safe to call on untrusted input.
   *
   * @param {Object} chain - a chain that passed (or will be judged by)
   *   validateChainObject.
   * @param {Array<Object>} problems - the walk's problems, mutated only
   *   when deserialize rejects and the walk found nothing.
   */
  function authoritativeChainCheck(chain, problems) {
    if (!(window.PresetSchema && typeof window.PresetSchema.deserialize === 'function')) {
      return; // Not loaded — the mirror walk above stands on its own.
    }
    try {
      window.PresetSchema.deserialize(chain);
    } catch (err) {
      if (problems.length === 0) {
        problems.push(
          problem('chain', 'rejected by the app preset schema: ' +
            String(err && err.message ? err.message : err))
        );
      }
    }
  }

  /**
   * No-argument tools (get_capabilities, get_chain, list_presets): the
   * only structural rule is input-is-an-object.
   *
   * @param {*} input
   * @param {Array<Object>} problems
   */
  function validateNoArgs(input, problems) {
    checkInputObject(input, problems);
  }

  /**
   * set_chain: chain required, preset-schema-shaped, per-node registry
   * checks included (see validateChainObject).
   *
   * @param {*} input
   * @param {Array<Object>} problems
   */
  function validateSetChain(input, problems) {
    var inputObject = checkInputObject(input, problems);
    if (problems.length > 0) {
      return;
    }
    if (inputObject.chain === undefined) {
      problems.push(problem('chain', "'chain' is required and was missing"));
      return;
    }
    validateChainObject(inputObject.chain, problems);
    authoritativeChainCheck(inputObject.chain, problems);
  }

  /**
   * add_node: type required + registered; optional params keyed by that
   * type's real names; optional 0-based integer position.
   *
   * @param {*} input
   * @param {Array<Object>} problems
   */
  function validateAddNode(input, problems) {
    var inputObject = checkInputObject(input, problems);
    if (problems.length > 0) {
      return;
    }
    var types = registryTypes();
    var typeOk = false;
    if (inputObject.type === undefined) {
      problems.push(problem('type', "'type' is required and was missing"));
    } else if (typeof inputObject.type !== 'string' || inputObject.type.length === 0) {
      problems.push(
        problem('type', "'type' must be a non-empty string; got " + displayValue(inputObject.type))
      );
    } else if (types.indexOf(inputObject.type) === -1) {
      problems.push(
        problem('type', "unknown node type '" + inputObject.type + "'", types)
      );
    } else {
      typeOk = true;
    }

    // params is optional; still shape-check it even when type was bad
    // (but key/value checks need a known type).
    if (typeOk) {
      validateParamsForType(inputObject.type, inputObject.params, 'params', problems);
    } else if (
      inputObject.params !== undefined &&
      inputObject.params !== null &&
      !isPlainObject(inputObject.params)
    ) {
      problems.push(
        problem('params', 'params must be an object keyed by the node type' + "'s param names; got " +
          displayValue(inputObject.params))
      );
    }

    if (inputObject.position !== undefined && inputObject.position !== null) {
      var position = inputObject.position;
      if (typeof position !== 'number' || !isFinite(position)) {
        problems.push(
          problem('position', 'position must be a non-negative integer; got ' + displayValue(position))
        );
      } else if (Math.floor(position) !== position) {
        problems.push(
          problem('position', 'position must be a whole number of slots; got ' + position)
        );
      } else if (position < 0) {
        problems.push(problem('position', 'position must be >= 0; got ' + position));
      }
    }
  }

  /**
   * remove_node: nodeId required, non-empty string. Whether the id exists
   * in the live chain is a runtime concern — MC-4's, against the real
   * model; this layer only checks shape.
   *
   * @param {*} input
   * @param {Array<Object>} problems
   */
  function validateRemoveNode(input, problems) {
    var inputObject = checkInputObject(input, problems);
    if (problems.length > 0) {
      return;
    }
    requireString(inputObject, 'nodeId', problems);
  }

  /**
   * set_param: nodeId/param/value required (value finite number, or
   * boolean for a future boolean param — none of the six committed types
   * has one today). When the live chain resolves the node's type
   * (read-only via ChainCanvas), the param name must be real for that
   * type — the one runtime check the stub can make without touching app
   * state. Range checks (nominal AND RQ-3) are deliberately MC-4's.
   *
   * @param {*} input
   * @param {Array<Object>} problems
   */
  function validateSetParam(input, problems) {
    var inputObject = checkInputObject(input, problems);
    if (problems.length > 0) {
      return;
    }
    var nodeIdOk = requireString(inputObject, 'nodeId', problems);
    var paramOk = requireString(inputObject, 'param', problems);
    var valueOk = requireNumberOrBoolean(inputObject, 'value', problems);

    var nodeType = nodeIdOk ? resolveNodeType(inputObject.nodeId) : null;
    if (nodeType) {
      var specs = paramSpecsFor(nodeType);
      if (specs.length > 0 && paramOk) {
        var spec = findSpec(specs, inputObject.param);
        if (!spec) {
          // MC-4 carve-out: host-owned names pass structurally so the
          // enforcement layer rejects them with the structured HOST_OWNED
          // error (see validateParamsForType's note).
          if (!hostOwnedFor(nodeType, inputObject.param)) {
            problems.push(
              problem('param', "node '" + inputObject.nodeId + "' is of type '" + nodeType +
                "', which has no param '" + inputObject.param + "'", specIds(specs))
            );
          }
        } else if (valueOk && typeof inputObject.value !== 'number') {
          problems.push(
            problem('value', spec.id + ' is numeric; value must be a finite number' +
              (spec.unit ? ' in ' + spec.unit : '') + '; got ' + displayValue(inputObject.value))
          );
        }
      }
    }
  }

  /**
   * save_preset: name required, string, 1-40 characters AFTER TRIMMING
   * (MC-5 — mirrors the UI Save flow, which trims before saving and
   * refuses empty; the trim means a whitespace-only or padded name is
   * judged by its trimmed self, and the trimmed name is what gets
   * stored). The schema carries minLength/maxLength so capable agents
   * pre-validate.
   *
   * @param {*} input
   * @param {Array<Object>} problems
   */
  function validateSavePreset(input, problems) {
    var inputObject = checkInputObject(input, problems);
    if (problems.length > 0) {
      return;
    }
    if (inputObject.name === undefined) {
      problems.push(problem('name', "'name' is required and was missing"));
      return;
    }
    if (typeof inputObject.name !== 'string') {
      problems.push(
        problem('name', 'name must be a string of 1-40 characters (trimmed); got ' + displayValue(inputObject.name))
      );
      return;
    }
    var trimmed = inputObject.name.trim();
    if (trimmed.length < 1 || trimmed.length > 40) {
      problems.push(
        problem('name', 'name must be 1-40 characters after trimming; got ' +
          trimmed.length + ' (' + displayValue(inputObject.name) + ')')
      );
    }
  }

  // ---------------------------------------------------------------------
  // Tool definitions. Each execute validates structurally FIRST, then
  // resolves one of the contract's result objects. Never throws.
  // ---------------------------------------------------------------------

  /**
   * The read-tool body (MC-3): validate structurally, then resolve
   * buildResult()'s payload. `buildResult` guards its own app reads
   * (absent/damaged dependencies -> honest degraded fields), so a throw
   * reaching the catch here really is a bug in THIS layer and resolves
   * SCHEMA_LAYER_FAULT. Never throws either way.
   *
   * @param {string} name - the tool's registered name.
   * @param {Function} validator - (input, problems) => void.
   * @param {Function} buildResult - () => Object.
   * @returns {Function} execute(input, options) -> Promise<Object>.
   */
  function readExecute(name, validator, buildResult) {
    return function (input) {
      try {
        var problems = [];
        validator(input, problems);
        if (problems.length > 0) {
          return Promise.resolve(invalidArgumentsResult(name, problems));
        }
        return Promise.resolve(buildResult());
      } catch (err) {
        return Promise.resolve(schemaLayerFaultResult(name, err));
      }
    };
  }

  /**
   * The mutation-tool body (MC-4 + MC-5): validate structurally, queue
   * behind any in-progress user drag, then plan against the LIVE model
   * (policy enforcement), snapshot the pre-apply state (MC-5), apply
   * through the single UI write path, push the undo entry, disclose
   * (summary toast), and resolve the contract's success/rejection
   * object. Refusals (invalid args, runtime rejections, BUSY, layer
   * faults) additionally toast { rejected: true } and push NO undo
   * entry. Never throws; a caught crash of THIS layer resolves
   * SCHEMA_LAYER_FAULT with nothing applied.
   *
   * @param {string} name - the tool's registered name.
   * @param {Function} validator - (input, problems) => void.
   * @param {Function} planner - (input, liveModel) => {error} |
   *   {candidate, changes, clamped, nodeIds, summary, label, note?}.
   * @returns {Function} execute(input, options) -> Promise<Object>.
   */
  function mutationExecute(name, validator, planner) {
    return function (input) {
      var problems = [];
      try {
        validator(input, problems);
      } catch (err) {
        var fault = schemaLayerFaultResult(name, err);
        reportAgentRejection(name, fault);
        return Promise.resolve(fault);
      }
      if (problems.length > 0) {
        var invalid = invalidArgumentsResult(name, problems);
        reportAgentRejection(name, invalid);
        return Promise.resolve(invalid);
      }
      return waitForDragSettle().then(function (settled) {
        if (!settled) {
          var busy = busyResult(name);
          reportAgentRejection(name, busy);
          return busy;
        }
        try {
          var model = readCurrentModel(); // fresh, post-drag, read-only copy
          var plan = planner(input, model);
          if (plan.error) {
            if (!plan.error.tool) {
              plan.error.tool = name;
            }
            reportAgentRejection(name, plan.error);
            return plan.error;
          }
          // MC-5: the exact-state snapshot — taken AFTER the drag settles
          // (a queued mutation snapshots the state it will actually edit,
          // never a stale pre-drag one) and BEFORE the write, from the
          // same post-settle model read the plan was computed against.
          var snapshot = captureUndoSnapshot(model);
          applyCandidateViaUi(plan.candidate);
          // Pushed only once the apply SUCCEEDED: a thrown write path
          // resolves SCHEMA_LAYER_FAULT below with nothing to undo.
          pushUndoEntry(plan.label, makeSnapshotRestore(snapshot));
          reportAgentMutation(plan.summary, plan.nodeIds, plan.clamped);
          var result = {
            applied: true,
            tool: name,
            changes: plan.changes,
            clamped: plan.clamped || [],
            nodeIds: plan.nodeIds || []
          };
          if (plan.note) {
            result.note = plan.note;
          }
          return result;
        } catch (err) {
          var applyFault = schemaLayerFaultResult(name, err);
          reportAgentRejection(name, applyFault);
          return applyFault;
        }
      });
    };
  }

  /**
   * @returns {Object} the get_capabilities tool def.
   */
  function makeGetCapabilities() {
    return {
      name: 'get_capabilities',
      description:
        "Read this app's agent surface before anything else: the registered node types " +
        '(gain, compressor, eq, delay, reverb, limiter) with every parameter name, unit, ' +
        'range and default, plus chain-order conventions and the loudness rules mutations ' +
        'are held to. Call this first so later calls use real param names and pre-comply ' +
        'with policy.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: readExecute('get_capabilities', validateNoArgs, buildCapabilitiesResult)
    };
  }

  /**
   * @returns {Object} the get_chain tool def.
   */
  function makeGetChain() {
    return {
      name: 'get_chain',
      description:
        'Read the current effect chain as a preset-shaped object: {schemaVersion: 1, name, ' +
        'nodes: [{id, type, params}]} in signal order, MIC IN to OUT. Use before any edit to ' +
        'learn real node ids and current param values; set_param and remove_node address ' +
        'nodes by that id, and the object round-trips into set_chain.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: readExecute('get_chain', validateNoArgs, buildGetChainResult)
    };
  }

  /**
   * @returns {Object} the set_chain tool def.
   */
  function makeSetChain() {
    return {
      name: 'set_chain',
      description:
        'Replace the whole chain with one preset-shaped object: {schemaVersion: 1, name, ' +
        'nodes: [{id, type, params}]} in MIC IN to OUT order. Node ids are yours to assign ' +
        '(unique non-empty strings). This layer validates structure only; loudness policy ' +
        '(limiter terminal, gain budget, feedback caps) is enforced when the change is applied.',
      inputSchema: {
        type: 'object',
        properties: {
          chain: {
            type: 'object',
            description:
              'Preset-shaped chain: {schemaVersion: 1, name, nodes: [{id, type, params}]} in ' +
              'MIC IN to OUT order — the same shape get_chain returns.',
            properties: {
              schemaVersion: {
                type: 'integer',
                enum: [1],
                description: 'Must be 1 (the only schema version).'
              },
              name: {
                type: 'string',
                description: 'Display name for the chain, non-empty.'
              },
              nodes: {
                type: 'array',
                description: 'Ordered node array, MIC IN to OUT.',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      description: "Your unique non-empty id for this node, e.g. 'n1'."
                    },
                    type: {
                      type: 'string',
                      description: 'Registered node type (see add_node.type).'
                    },
                    params: {
                      type: 'object',
                      description: "Param names to values for this type; omit for the type's defaults."
                    }
                  },
                  required: ['id', 'type']
                }
              }
            },
            required: ['schemaVersion', 'name', 'nodes']
          }
        },
        required: ['chain']
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: mutationExecute('set_chain', validateSetChain, planSetChain)
    };
  }

  /**
   * @returns {Object} the add_node tool def.
   */
  function makeAddNode() {
    return {
      name: 'add_node',
      description:
        "Add one node of a registered type, optionally with initial params keyed by that " +
        "type's real param names and units (get_capabilities lists them per type). " +
        'position is the 0-based insert index; omitting it appends at the end — which is ' +
        'rejected when a terminal limiter is present, since nothing may sit after it ' +
        '(insert upstream instead). The host assigns the new node\'s id and returns it in ' +
        'the result; loudness policy is enforced at apply time.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: registryTypes(),
            description: 'Node type: one of ' + registryTypes().join(', ') + '.'
          },
          params: {
            type: 'object',
            description:
              "Initial params keyed by the type's real param names (get_capabilities lists " +
              'them); unknown keys are rejected.'
          },
          position: {
            type: 'integer',
            minimum: 0,
            description: '0-based index in the nodes array to insert at; omit to append at the end.'
          }
        },
        required: ['type']
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: mutationExecute('add_node', validateAddNode, planAddNode)
    };
  }

  /**
   * @returns {Object} the remove_node tool def.
   */
  function makeRemoveNode() {
    return {
      name: 'remove_node',
      description:
        "Remove one node from the chain by its id, exactly as returned by get_chain " +
        "(e.g. 'node-3' or a preset id like 'n1'). The terminal safety limiter is " +
        'protected — policy rejects its removal at apply time. This layer checks argument ' +
        'structure only.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            description: "Id of the node to remove, exactly as get_chain returns it (e.g. 'node-3' or 'n1')."
          }
        },
        required: ['nodeId']
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: mutationExecute('remove_node', validateRemoveNode, planRemoveNode)
    };
  }

  /**
   * @returns {Object} the set_param tool def.
   */
  function makeSetParam() {
    return {
      name: 'set_param',
      description:
        "Set one parameter on one existing node: the node id from get_chain, the param's " +
        "real name for that node's type, and the new value in the param's own unit (dB, %, " +
        'ms, s, or ratio — get_capabilities lists them). Param-name and value-type checks ' +
        'are structural; the published agent range is enforced at apply time (out-of-range ' +
        'values reject or clamp per the param\'s treatment, and the full chain — gain budget ' +
        'included — is re-validated with the new value).',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            description: 'Id of the target node, exactly as get_chain returns it.'
          },
          param: {
            type: 'string',
            description: "Real param name of that node's type, e.g. gainDb, threshold, timeMs, mix, ceiling."
          },
          value: {
            type: 'number',
            description: 'New value as a number in the param\'s own unit (dB, %, ms, s, or ratio).'
          }
        },
        required: ['nodeId', 'param', 'value']
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: mutationExecute('set_param', validateSetParam, planSetParam)
    };
  }

  /**
   * @returns {Object} the list_presets tool def.
   */
  function makeListPresets() {
    return {
      name: 'list_presets',
      description:
        'List saved chain presets (name plus node count) without loading any. Use to find a ' +
        'starting point before set_chain, or to check a name before save_preset — saving ' +
        'under an existing name overwrites that preset. The result separates the user\'s ' +
        'presets ("presets" — the only ones save_preset writes) from the read-only "factory" ' +
        'library shipped with the app.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: readExecute('list_presets', validateNoArgs, buildListPresetsResult)
    };
  }

  /**
   * The save_preset body (MC-5). Mirrors the UI Save As flow's steps
   * exactly (src/presets-ui.js): trim the name (refuse empty),
   * PresetStore.save(name, ChainCanvas.getCurrentModel()) — the SAME
   * single persistence path, so the store serializes/validates it — then
   * the flow's UI state updates (dropdown refresh with the name selected,
   * current-preset-name display, unsaved-dot clear). Name collisions are
   * OVERWRITES, exactly like the UI (no auto-numbering). The undo entry:
   * CREATED -> restore DELETES (the UI Delete flow's store call);
   * OVERWROTE -> restore re-saves the previously stored content (captured
   * pre-save through PresetStore.load, whose deserialize copies make the
   * capture immune to later mutation); both restores then put the preset
   * display back to its pre-save state. No drag queue: like the UI's Save
   * button, this reads whatever model is current at call time and never
   * touches the chain. Note the store swallows its own localStorage
   * failures (console.error, same as the UI path) — the tool mirrors the
   * UI's contract and reports success; the preset panel's next refresh
   * shows the truth.
   *
   * @param {*} input
   * @returns {Promise<Object>}
   */
  function savePresetExecute(input) {
    var problems = [];
    var name = '';
    try {
      var inputObject = checkInputObject(input, problems);
      if (inputObject && typeof inputObject.name === 'string') {
        name = inputObject.name.trim();
      }
      validateSavePreset(input, problems);
    } catch (err) {
      var fault = schemaLayerFaultResult('save_preset', err);
      reportAgentRejection('save_preset', fault);
      return Promise.resolve(fault);
    }
    if (problems.length > 0) {
      var invalid = invalidArgumentsResult('save_preset', problems);
      reportAgentRejection('save_preset', invalid);
      return Promise.resolve(invalid);
    }
    var result;
    try {
      if (!(window.PresetStore &&
            typeof window.PresetStore.save === 'function' &&
            typeof window.PresetStore.listNames === 'function' &&
            typeof window.PresetStore.remove === 'function')) {
        result = {
          error: true,
          code: 'PRESET_STORE_UNAVAILABLE',
          tool: 'save_preset',
          applied: null,
          reason: 'PresetStore is not available in this context — no presets can be saved.',
          suggestion: 'Nothing was changed; use set_chain to apply the chain without saving.'
        };
        reportAgentRejection('save_preset', result);
        return Promise.resolve(result);
      }

      // Prior state, through the store's own APIs (its load() copies are
      // immune to later mutation).
      var existed = false;
      try {
        var listed = window.PresetStore.listNames();
        existed = Array.isArray(listed) && listed.indexOf(name) !== -1;
      } catch (err) {
        existed = false;
      }
      var priorContent = null;
      if (existed) {
        try {
          priorContent = window.PresetStore.load(name);
        } catch (err) {
          priorContent = null; // Corrupt prior entry — see the restore note.
        }
      }

      var model = readCurrentModel(); // ChainCanvas.getCurrentModel(), guarded
      var displayBefore = readPresetDisplay();

      // The save itself — the UI Save As handler's exact store call.
      window.PresetStore.save(name, model);

      // ...and its exact UI state updates, now through PresetsUI's real
      // exports (VIS-3 single write path — the same functions the UI's
      // Save As handler calls; no mirrored DOM writes remain here).
      presetsUiRefreshPresetSelect(name);
      presetsUiSetCurrentPreset(name);
      presetsUiClearModified();

      var undoLabel = 'save_preset "' + name + '"';
      pushUndoEntry(undoLabel, function () {
        try {
          if (!existed) {
            // CREATED by this save: undo deletes it (the UI Delete flow's
            // store call — remove() is already a no-op on a missing name).
            window.PresetStore.remove(name);
          } else if (priorContent) {
            // OVERWROTE: undo restores the previously stored content
            // through the same single persistence path.
            window.PresetStore.save(name, priorContent.nodes);
          } else {
            // The prior entry existed but failed the store's own
            // validation (corrupt localStorage) — its content cannot be
            // re-saved; removing the agent's version is the honest
            // restore. Unreachable short of hand-edited storage.
            window.PresetStore.remove(name);
          }
          presetsUiRefreshPresetSelect(displayBefore.name);
          presetsUiSetCurrentPreset(displayBefore.name);
          if (displayBefore.unsaved === true) {
            try {
              if (window.PresetsUI && typeof window.PresetsUI.markModified === 'function') {
                window.PresetsUI.markModified();
              }
            } catch (err) {
              // Display-only.
            }
          } else if (displayBefore.unsaved === false) {
            presetsUiClearModified();
          }
        } catch (err) {
          // Same never-throw contract as the mutation restores.
        }
      });

      reportAgentMutation(
        'Agent saved preset "' + name + '"' +
          (existed ? ' (overwrote the existing preset)' : ''),
        [],
        []
      );
      return Promise.resolve({
        applied: true,
        tool: 'save_preset',
        saved: name,
        overwrote: existed,
        nodeCount: model.length
      });
    } catch (err) {
      result = schemaLayerFaultResult('save_preset', err);
      reportAgentRejection('save_preset', result);
      return Promise.resolve(result);
    }
  }

  /**
   * @returns {Object} the save_preset tool def.
   */
  function makeSavePreset() {
    return {
      name: 'save_preset',
      description:
        'Save the current chain as a named preset (name is 1-40 characters, trimmed). Saving under an ' +
        "existing preset's name overwrites it (no auto-numbering); presets persist locally and also appear in " +
        "the app's Presets panel for the human host. Undo deletes the preset if this call created it, or " +
        'restores the previous content if it overwrote one.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 40,
            description: 'Preset name, 1-40 characters (trimmed); overwrites an existing preset with the same name.'
          }
        },
        required: ['name']
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: savePresetExecute
    };
  }

  /**
   * Build the 8 tool defs in fixed order. Fresh objects every call —
   * callers (self-init here, the MC-6 harness later) can never receive
   * something another caller already mutated.
   *
   * @returns {Array<Object>}
   */
  function getDefs() {
    return [
      makeGetCapabilities(),
      makeGetChain(),
      makeSetChain(),
      makeAddNode(),
      makeRemoveNode(),
      makeSetParam(),
      makeListPresets(),
      makeSavePreset()
    ];
  }

  window.McpTools = {
    getDefs: getDefs
  };

  // Self-init: hand the defs to the shim the moment this script parses
  // (index.html loads mcp-server.js first). registerTools() is lazy-safe
  // this early per the shim's contract; when the WebMCP API is absent
  // the shim collapses the whole batch into its single diagnostic, and
  // when present the defs register in the order above. Re-run on every
  // load — nothing persists (RQ-1).
  if (window.McpServer && typeof window.McpServer.registerTools === 'function') {
    window.McpServer.registerTools(window.McpTools.getDefs()).then(
      function (result) {
        // Chip contract (FEW-1): 'tools-ready' once at least one tool is
        // actually registered. The MC-0 echo canary used to carry this from
        // the shim's init; with the canary retired (MC-3) this is the
        // load-time transition's new home. Guarded like the shim guards
        // AgentUI — a broken chip must never break registration.
        if (result && result.registered && result.registered.length > 0) {
          try {
            if (window.AgentUI && typeof window.AgentUI.setState === 'function') {
              window.AgentUI.setState('tools-ready');
            }
          } catch (e) {
            /* state display is best-effort; never fail registration for it */
          }
        }
      }
    );
  }
})();
