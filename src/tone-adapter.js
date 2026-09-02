// Tone.js adapter — one-call registration for Tone-backed node types.
//
// Loaded as a plain (non-module) <script> — same IIFE + single `window.X`
// export pattern as the rest of the audio stack. Defines NO effects itself;
// a Tone-backed effect file (e.g. src/node-pitchshift.js) calls
// ToneAdapter.register() once at load time and this file registers one
// complete EffectCatalog definition on its behalf. The generated create
// function wraps the Tone effect node between two native unity GainNodes
// ({input, output, tone, dispose}), so the graph builder needs no Tone
// knowledge. The generated applyParam dispatches to the `set` function each
// paramSpec entry may carry (see below).
//
// The point of the shape: adding a Tone effect is ONE small config file —
// param plumbing, composite wiring, context sharing, and teardown are all
// here, once, instead of per effect.
//
// Contract details the rest of the app relies on:
//
//   - Context: the app's own AudioContext (window.AudioEngine) stays
//     authoritative. Every factory invocation calls ensureToneContext()
//     first, which points Tone's global context at the app's context
//     (no-op when already pointing there) so Tone nodes share it with the
//     mic source, chain gate, bypass tap, watchdog, and meters. A device
//     switch reuses the context; a full context recreation is handled the
//     next time any factory runs.
//   - Click-safety: live param writes ramp over 15 ms — rampParam() is the
//     Tone-side twin of AudioParamRamp.schedule()'s 15 ms house pattern
//     (Tone's Param.rampTo handles the cancel+pin+ramp internally). A `set`
//     helper that writes a NON-rampable plain property (e.g. Phaser's
//     octaves) assigns directly; creation-time values are set through the
//     Tone constructor instead (the same creation-vs-live split the native
//     node files use — factory-time direct writes are the documented
//     exception to ramping).
//   - Teardown: buildGraph()'s Phase-2 teardown calls dispose() on
//     dropped instances when present (added alongside this file); Tone
//     effects with internal LFOs/clocks would otherwise keep their JS
//     timers alive after being disconnected from the graph.
//   - Harness safety: registration NEVER touches window.Tone — test
//     harnesses that load this file (and effect files) without the Tone
//     script still register clean paramSpecs/metadata; only FACTORY
//     invocation requires Tone, failing with a clear error.

(function () {
  'use strict';

  // The ramp every live Tone Param write funnels through — 15 ms, matching
  // AudioParamRamp's RAMP_SECONDS (src/audio-param-ramp.js).
  var RAMP_SECONDS = 0.015;

  /**
   * Point Tone's global context at the app's AudioContext, if it isn't
   * already. Safe to call on every factory invocation: the identity check
   * keeps it a no-op in the steady state (one context per session —
   * AudioEngine reuses its AudioContext across stops), and only a genuine
   * context recreation (fresh AudioEngine.start after context loss) makes
   * it re-point, after which every node created afterwards follows the new
   * context.
   *
   * @param {AudioContext} audioContext
   */
  function ensureToneContext(audioContext) {
    var Tone = window.Tone;
    if (!Tone || typeof Tone.setContext !== 'function') {
      throw new Error(
        'ToneAdapter: window.Tone is not loaded. A Tone-backed node type ' +
        'was built without vendor/tone.min.js (see index.html script order).'
      );
    }
    var current = Tone.getContext();
    if (!current || current.rawContext !== audioContext) {
      Tone.setContext(audioContext);
    }
  }

  /**
   * Ramp a Tone Param to `value` over the house 15 ms — the Tone-side
   * twin of AudioParamRamp.schedule(). For Tone properties that are plain
   * setters rather than Params, assign directly instead (the effect file's
   * `set` helper decides which to use).
   *
   * @param {Object} toneParam - a Tone Param/Signal (has .rampTo)
   * @param {number} value
   */
  function rampParam(toneParam, value) {
    toneParam.rampTo(value, RAMP_SECONDS);
  }

  /**
   * Build the AE-7 composite around a constructed Tone node: native unity
   * GainNodes at both ends so buildGraph()'s plain .connect() topology
   * works unchanged, wired through Tone's connect() (the native<->Tone
   * interop — Tone nodes are not AudioNodes, so native .connect() can't
   * target them directly). `dispose` severs the wrapper and releases the
   * Tone node's internal nodes/clocks (called by buildGraph()'s teardown
   * for dropped instances).
   */
  function wrapToneNode(audioContext, toneNode) {
    var input = audioContext.createGain();
    var output = audioContext.createGain();
    input.gain.value = 1;
    output.gain.value = 1;
    window.Tone.connect(input, toneNode);
    window.Tone.connect(toneNode, output);
    return {
      input: input,
      output: output,
      tone: toneNode,
      dispose: function () {
        try { input.disconnect(); } catch (e) { /* already gone */ }
        try { output.disconnect(); } catch (e) { /* already gone */ }
        try {
          if (typeof toneNode.dispose === 'function') {
            toneNode.dispose();
          }
        } catch (e) { /* already gone */ }
      }
    };
  }

  /**
   * Register one complete Tone-backed effect definition.
   *
   * @param {string} type - unique effect type name.
   * @param {{label: string, paramSpec: Array<Object>, create: Function, experimental?: boolean, latencySeconds?: number}} config
   *   - label / paramSpec / experimental / latencySeconds: catalog
   *     metadata. latencySeconds is the effect's own declared added
   *     latency (e.g. pitchshift's fixed granular-window delay) — omit it
   *     when the effect adds none; EffectCatalog defaults it to 0. paramSpec
   *     entries are the standard
   *     {id, label, min, max, default, step, unit} descriptors and may
   *     additionally carry `set: (toneNode, value, composite) => void` —
   *     the LIVE-write mapping for that param (ramp a Tone Param, or
   *     assign a plain property). Entry `set` functions are stripped
   *     before registration so nothing executable rides in paramSpec.
   *   - create: (audioContext, resolvedParams) => Tone node — constructs
   *     the Tone effect with its initial values already applied (Tone
   *     constructors take values, avoiding birth-time ramps), and starts
   *     any internal LFO (e.g. Tremolo's .start()).
   */
  function register(type, config) {
    if (!type || typeof type !== 'string') {
      throw new Error('ToneAdapter.register: type must be a non-empty string.');
    }
    if (!config || typeof config !== 'object') {
      throw new Error('ToneAdapter.register: config must be an object.');
    }
    if (!Array.isArray(config.paramSpec) || config.paramSpec.length === 0) {
      throw new Error('ToneAdapter.register: config.paramSpec must be a non-empty array.');
    }
    if (typeof config.create !== 'function') {
      throw new Error('ToneAdapter.register: config.create must be a function.');
    }

    // The catalog spec: verbatim entries minus the adapter-private `set`
    // helpers (paramSpec is metadata — read by ParamControls,
    // mcp-tools.js's capabilities readout, and preset persistence — and
    // none of them should ever see a function in it).
    var cleanSpec = config.paramSpec.map(function (spec) {
      var entry = {};
      ['id', 'label', 'min', 'max', 'default', 'step', 'unit', 'values', 'displayScale'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(spec, key)) {
          entry[key] = spec[key];
        }
      });
      return entry;
    });

    // Live-write dispatch by paramId, from the ORIGINAL spec entries (the
    // ones still carrying `set`). Unknown paramId: no-op, defensive — the
    // same stale-reference/edge-case philosophy as catalog dispatch.
    var setters = {};
    config.paramSpec.forEach(function (spec) {
      if (typeof spec.set === 'function') {
        setters[spec.id] = spec.set;
      }
    });

    // The catalog create function. Synchronous by requirement — Tone effect
    // constructors are synchronous. Anything genuinely async (worklet-backed
    // effects like BitCrusher finish wiring internally when the worklet loads) needs
    // the unity-passthrough-then-splice pattern instead, which Tone's own
    // worklet nodes already implement internally.
    function factory(audioContext, params) {
      ensureToneContext(audioContext);
      var toneNode = config.create(audioContext, params);
      var composite = wrapToneNode(audioContext, toneNode);
      return composite;
    }

    window.EffectCatalog.register(type, {
      label: config.label,
      plainLabel: config.plainLabel,
      paramSpec: cleanSpec,
      experimental: !!config.experimental,
      latencySeconds: config.latencySeconds,
      create: factory,
      applyParam: function (composite, paramId, value) {
        if (!composite || !composite.tone) {
          return;
        }
        var setter = setters[paramId];
        if (setter) {
          setter(composite.tone, value, composite);
        }
      },
      dispose: function (composite) {
        if (composite && typeof composite.dispose === 'function') {
          composite.dispose();
        }
      }
    });
  }

  window.ToneAdapter = {
    register: register,
    ensureToneContext: ensureToneContext,
    rampParam: rampParam,
  };
})();
