// Autotune node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Like src/node-gate.js, this file exports no
// `window.X` namespace of its own — its only job is to register one complete
// definition with window.EffectCatalog at load time.
//
// AT-1 scope (cycle 3, docs/ultron/plan.md): the Outcome-PASS branch of the
// AT-0 spike (docs/ultron/research/at0-spike-result.md — HARD-TUNE PASS),
// built per the D2 research decision
// (docs/ultron/research/rq2-autotune-feasibility.md): ALL the DSP lives on
// the audio thread in src/autotune-worklet.js — YIN pitch detection +
// TD-PSOLA pitch shifting + scale snap + retune smoothing in ONE
// AudioWorklet processor, zero dependencies, no postMessage on the audio
// path:
//
//   inputGain ──► [AudioWorkletNode 'autotune', src/autotune-worklet.js]
//             ──► outputSum
//
// Hard-tune is the DEFAULT behavior (Retune Speed default 0 ms); slow
// correction is the SAME engine with the retune parameter opened up
// (0–500 ms) — AT-0's finding that both outcomes run on one engine, so
// there is no branch here, just a parameter. Declared internal delay:
// exactly 20 ms on both wet and dry legs (the worklet's fixed constant;
// AT-0 measured it impulse-exact). Experimental status: the node card
// renders a badge via the minimal hook in src/canvas.js (the formal badge
// component is UI-2's); this registration itself carries no UI.
//
// ---------------------------------------------------------------------
// Params: the discrete/continuous split (UI-1's landing surface).
// ---------------------------------------------------------------------
//
// The UI-facing paramSpec carries Key and Scale as DISCRETE string values
// ('C'..'B', 'Chromatic'/'Major'/'Minor') — exactly what UI-1's
// param-controls.js `values:[...]` selects render and commit verbatim
// through EffectCatalog.applyParam, and exactly what presets persist. The
// worklet's REAL AudioParams are the numeric enums (key 0..11, scale 0..2),
// so this file owns the string→enum mapping at every boundary:
//   - the factory maps model params (strings OR numbers — robustness
//     against a hand-edited preset or an agent writing raw enums) onto the
//     worklet's creation-time param values;
//   - applyParam maps each live UI/agent write the same way and hands the
//     NUMBER to AudioParamRamp.schedule() (Issue #5's click-safe form).
//
// ---------------------------------------------------------------------
// The async addModule wrinkle — node-gate.js's exact three-piece fix.
// ---------------------------------------------------------------------
//
// AudioWorkletNode construction requires a prior (inherently async)
// audioContext.audioWorklet.addModule(), but buildGraph() calls factories
// SYNCHRONOUSLY. Same shape as the gate (which took it from reverb):
//   1. module-level load cache — at most ONE addModule per AudioContext;
//   2. the factory ALWAYS returns synchronously with inputGain → outputSum
//      as a unity passthrough (valid, chain-ready, click-free from the
//      first render quantum);
//   3. once addModule resolves, the worklet is created, given its initial
//      (already enum-mapped) params plus any applyParam writes that landed
//      in the window (pendingParams), and spliced between the stable
//      connect points. External edges are never touched.
//
// Failure mode (addModule missing/rejected): one console diagnostic and
// the node stays an honest unity passthrough — an autotune that cannot
// load must pass audio through untouched rather than go silent; Bypass
// remains the operator escape. Chrome-only project, so unreachable in
// practice.

(function () {
  'use strict';

  // Page-relative worklet URL — the watchdog/gate worklet convention
  // (fetched via audioWorklet.addModule; never a <script> tag).
  var WORKLET_URL = 'src/autotune-worklet.js';
  var PROCESSOR_NAME = 'autotune';

  // The discrete param vocabularies (UI-1) — index == the worklet's enum.
  var KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var SCALE_NAMES = ['Chromatic', 'Major', 'Minor'];

  // Defaults (must match the worklet's parameterDescriptors): hard-tune
  // chromatic in C, fully wet — the AT-0 Outcome-PASS default behavior.
  var DEFAULT_KEY = 'C';
  var DEFAULT_SCALE = 'Chromatic';
  var DEFAULT_RETUNE_MS = 0;
  var DEFAULT_MIX_PCT = 100;

  /**
   * Map a Key param value (UI string 'C'..'B', or a raw 0..11 enum from a
   * hand-edited preset / agent write) to the worklet's numeric enum.
   * Unknown values fall back to the default key — applyParam must never
   * throw onto a live slider move.
   * @param {string|number} v
   * @returns {number} 0..11
   */
  function keyIndex(v) {
    if (typeof v === 'number' && isFinite(v)) {
      return Math.max(0, Math.min(11, Math.round(v)));
    }
    var i = KEY_NAMES.indexOf(String(v));
    return i === -1 ? KEY_NAMES.indexOf(DEFAULT_KEY) : i;
  }

  /**
   * Map a Scale param value ('Chromatic'/'Major'/'Minor' or 0..2) to the
   * worklet's numeric enum. Same contract as keyIndex.
   * @param {string|number} v
   * @returns {number} 0..2
   */
  function scaleIndex(v) {
    if (typeof v === 'number' && isFinite(v)) {
      return Math.max(0, Math.min(2, Math.round(v)));
    }
    var i = SCALE_NAMES.indexOf(String(v));
    return i === -1 ? SCALE_NAMES.indexOf(DEFAULT_SCALE) : i;
  }

  /**
   * Mix percent (UI convention, 0..100 like Delay/Chorus) → the worklet's
   * 0..1 linear mix. Non-numeric input falls back to the default.
   * @param {number} v
   * @returns {number} 0..1
   */
  function mixLinear(v) {
    var pct = typeof v === 'number' && isFinite(v) ? v : DEFAULT_MIX_PCT;
    return Math.max(0, Math.min(100, pct)) / 100;
  }

  /**
   * Retune Speed in ms, clamped to the worklet's 0..500 range.
   * @param {number} v
   * @returns {number} 0..500
   */
  function retuneMs(v) {
    var ms = typeof v === 'number' && isFinite(v) ? v : DEFAULT_RETUNE_MS;
    return Math.max(0, Math.min(500, ms));
  }

  // ---- addModule load cache (node-gate.js's exact shape) ------------------

  var moduleContext = null; // the AudioContext the cached load belongs to
  var modulePromise = null; // the in-flight/resolved addModule promise
  var moduleLoaded = false; // true once resolved (the sync fast path)

  /**
   * Resolve once the 'autotune' processor is registered on THIS context.
   * At most one addModule call per context, shared by every autotune node.
   * @param {AudioContext} audioContext
   * @returns {Promise<void>}
   */
  function ensureWorkletModule(audioContext) {
    if (modulePromise && moduleContext === audioContext) {
      return modulePromise;
    }
    var aw = audioContext && audioContext.audioWorklet;
    moduleContext = audioContext;
    moduleLoaded = false;
    modulePromise = aw && typeof aw.addModule === 'function'
      ? aw.addModule(WORKLET_URL).then(function () {
          moduleLoaded = true;
        })
      : Promise.reject(new Error('AudioWorklet is unavailable in this browser/context.'));
    return modulePromise;
  }

  /**
   * Construct the AudioWorkletNode (global constructor first, context
   * property fallback — the meter-taps/gate resolution form).
   * @param {AudioContext} audioContext
   * @returns {AudioWorkletNode}
   */
  function newWorkletNode(audioContext) {
    var Ctor = typeof AudioWorkletNode === 'function'
      ? AudioWorkletNode
      : audioContext.AudioWorkletNode;
    // No outputChannelCount: the node adapts to the chain's channel count
    // (the wet path is mono-derived; the dry path keeps per-channel
    // integrity — mix = 0 is bit-exact per channel, see the worklet).
    return new Ctor(audioContext, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1
    });
  }

  // Factory returns a COMPOSITE value, same shape as EQ/Delay/Chorus/Gate.
  function createEffect(audioContext, params) {
    var p = params || {};

    // Enum-mapped creation values (strings OR numbers accepted — see the
    // param-mapping block in the file header).
    var key = keyIndex(p.key);
    var scale = scaleIndex(p.scale);
    var retune = retuneMs(p.retune);
    var mix = mixLinear(p.mix);

    // Stable composite connect points (AE-7). Unity gain — they never
    // shape audio, they only anchor the edges buildGraph connects.
    var inputGain = audioContext.createGain();
    inputGain.gain.value = 1;
    var outputSum = audioContext.createGain();
    outputSum.gain.value = 1;

    var composite = {
      input: inputGain,
      output: outputSum,
      worklet: null, // the AudioWorkletNode, once inserted
      pendingParams: {} // applyParam writes that predate insertion
      // (stored ENUM-MAPPED — insertion writes them straight onto the
      // worklet's numeric AudioParams)
    };

    /**
     * Create the worklet node, give it its initial param values (direct
     * creation-time writes — a brand-new node has no live signal to
     * protect, same convention as every other factory here), and splice it
     * between the two stable connect points.
     */
    function insertWorklet() {
      var worklet = newWorkletNode(audioContext);
      worklet.parameters.get('key').value = key;
      worklet.parameters.get('scale').value = scale;
      worklet.parameters.get('retune').value = retune;
      worklet.parameters.get('mix').value = mix;
      var ids = Object.keys(composite.pendingParams);
      for (var i = 0; i < ids.length; i++) {
        worklet.parameters.get(ids[i]).value = composite.pendingParams[ids[i]];
      }
      // Move inputGain's ONE internal edge from the passthrough to the
      // worklet. External edges (into .input / out of .output) are
      // untouched — the only rewiring this composite ever does.
      inputGain.disconnect(outputSum);
      inputGain.connect(worklet);
      worklet.connect(outputSum);
      composite.worklet = worklet;
    }

    if (moduleLoaded && moduleContext === audioContext) {
      // Every autotune after the first (on the SAME context): fully
      // synchronous, no passthrough gap.
      insertWorklet();
    } else {
      // The first autotune in a session: unity passthrough now, splice in
      // the worklet the moment addModule resolves (reverb/gate shape).
      inputGain.connect(outputSum);
      ensureWorkletModule(audioContext).then(insertWorklet).catch(function (err) {
        console.error(
          'Autotune: worklet module failed to load — this node stays a unity passthrough.',
          err
        );
      });
    }

    return composite;
  }

  // UI-facing metadata plus applyParam. Plain-language labels per the
  // cycle-3 scope table (Key+Scale / Retune Speed / Mix — the plan's own
  // words). Key/Scale are the UI-1 discrete `values` selects (strings); the
  // numeric params follow the house conventions (Retune in ms like the
  // gate's Attack/Release in s — time as the natural unit; Mix 0..100 %,
  // exactly Delay/Chorus's law).
  //
  // Hard-tune default: Retune 0 ms (snap within one epoch) — the AT-0
  // Outcome-PASS behavior; larger values open the slow-correction glide on
  // the same engine.
  //
  // Issue #5: live writes are SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() — click-safe. The ramp rides the enum
  // params between two integers; the worklet rounds on read, so a key
  // change lands atomically at one block boundary mid-ramp (a ~15 ms
  // crossfade of two snap grids is inaudible next to the retune glide).
  window.EffectCatalog.register('autotune', {
    label: 'Autotune',
    // wayfinder #46 — see docs/ultron/research/plain-effect-labels.md
    plainLabel: 'Keeps you on pitch',
    // MCP-1 (cycle 3): the experimental status declared at the type's own
    // registration — the single source canvas.js's badge and mcp-tools.js's
    // capabilities readout both read via EffectCatalog.isExperimental().
    experimental: true,
    // Matches DELAY_S in src/autotune-worklet.js — the fixed 20 ms
    // algorithmic delay on both the wet and dry legs (L2), independent of
    // Retune/Mix. Read by src/status-readouts.js's LATENCY readout.
    latencySeconds: 0.020,
    paramSpec: [
      { id: 'key', label: 'Key', values: KEY_NAMES.slice(), default: DEFAULT_KEY },
      { id: 'scale', label: 'Scale', values: SCALE_NAMES.slice(), default: DEFAULT_SCALE },
      { id: 'retune', label: 'Retune Speed', min: 0, max: 500, default: DEFAULT_RETUNE_MS, step: 5, unit: 'ms' },
      { id: 'mix', label: 'Mix', min: 0, max: 100, default: DEFAULT_MIX_PCT, step: 1, unit: '%' }
    ],
    create: createEffect,
    applyParam: function (nodeInstance, paramId, value) {
      if (paramId === 'key' || paramId === 'scale' ||
          paramId === 'retune' || paramId === 'mix') {
        // Map FIRST (strings→enums, %→linear, clamps), record the mapped
        // NUMBER, then ramp the real AudioParam if the worklet is in.
        // Recorded always: if the worklet is not inserted yet (the first
        // autotune's addModule window), the value is applied at insertion.
        var mapped = paramId === 'key' ? keyIndex(value)
          : paramId === 'scale' ? scaleIndex(value)
          : paramId === 'retune' ? retuneMs(value)
          : mixLinear(value);
        nodeInstance.pendingParams[paramId] = mapped;
        if (nodeInstance.worklet) {
          window.AudioParamRamp.schedule(
            nodeInstance.worklet.parameters.get(paramId), mapped);
        }
      }
    }
  });
})();
