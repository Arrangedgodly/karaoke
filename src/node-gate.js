// Noise Gate node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Like src/node-distortion.js and src/node-chorus.js,
// this file exports no `window.X` namespace of its own — its only job is to
// register one complete definition with window.EffectCatalog at load time.
//
// GATE-1 scope (cycle 3, docs/ultron/plan.md): built exactly per the D1
// research decision (docs/ultron/research/rq1-noise-gate.md, RQ-1 COMMITTED
// 2026-08-29) — a PURE AudioWorklet gate:
//
//   inputGain ──► [AudioWorkletNode 'noise-gate', src/gate-worklet.js]
//             ──► outputSum
//
// All DSP lives on the audio thread in src/gate-worklet.js (per-block RMS
// detector, 6 dB hysteresis, 50 ms hold, 5 ms look-ahead, per-sample
// dB-linear attack/release ramps between Floor and 0 dB) — decisions there
// are sample-accurate and never freeze in a hidden tab (the issue #7
// property the watchdog worklet already proved in production).
//
// Why the wrapper at all: Web Audio has no native gate node (D1's
// evidence). The factory returns a composite
// {input, output, worklet, pendingParams} — the AE-7 composite shape
// EQ/Delay/Reverb/Distortion/Chorus already use. inputGain/outputSum
// are unity GainNodes whose ONLY job is to be stable connect points
// while the worklet itself is inserted between them (see the async
// note below); they add no gain of their own. The four D1 params are REAL
// AudioParams (the worklet's parameterDescriptors), so applyParam follows
// the compressor's click-safe AudioParamRamp shape.
//
// ---------------------------------------------------------------------
// THE WRINKLE: async addModule vs. a synchronous factory contract.
// ---------------------------------------------------------------------
//
// AudioWorkletNode construction requires the module to have been added via
// audioContext.audioWorklet.addModule() first, and addModule is inherently
// asynchronous — but buildGraph() calls every factory SYNCHRONOUSLY and
// expects an immediate return (the exact problem src/node-reverb.js solved
// for its async IR fetch/decode). The same three-piece fix, adapted:
//
//   1. A module-level load cache (per AudioContext, one addModule call —
//      re-adding the same URL would throw on the duplicate
//      registerProcessor), so the worklet module is fetched at most once
//      per context no matter how many gate nodes are created.
//   2. The factory ALWAYS returns synchronously: inputGain -> outputSum is
//      wired as a unity passthrough at construction, so the composite is
//      a valid, chain-ready, click-free gate-in-open-passthrough from the
//      first render quantum.
//   3. Once addModule resolves, the worklet is created, given its initial
//      param values, and spliced in (inputGain's one internal edge moves
//      from outputSum to the worklet; the worklet feeds outputSum).
//      External edges — which buildGraph connects into .input / out of
//      .output — are never touched by the swap. Every gate created AFTER
//      the module has loaded takes the fully synchronous path (no
//      passthrough gap at all); only the FIRST gate in a session ever sees
//      the async splice, and it lasts as long as one local-file fetch.
//
// Failure mode (addModule missing/rejected — old browser, file:// context):
// one console diagnostic per gate node, and the node stays a honest unity
// passthrough (D1: the gate has no safe audio fallback — inert-and-loud
// beats silent-and-dead; Bypass remains the operator escape). Chrome-only
// project per the cycle-2 implementation-variance decision, so in practice
// this path is unreachable.
//
// `pendingParams` on the composite covers applyParam calls that arrive in
// the passthrough window: they are recorded there and written (direct
// creation-style writes) onto the worklet's params the moment it is
// inserted; after insertion, applyParam ramps the real AudioParams live.

(function () {
  'use strict';

  // Page-relative worklet URL — the watchdog-worklet.js convention
  // (fetched via audioWorklet.addModule from src/meter-taps.js; never a
  // <script> tag in index.html).
  var WORKLET_URL = 'src/gate-worklet.js';
  var PROCESSOR_NAME = 'noise-gate';

  // D1 paramSpec defaults — must match the worklet's parameterDescriptors
  // and the EffectCatalog paramSpec below (all three stay in lockstep).
  var DEFAULT_THRESHOLD_DB = -50;
  var DEFAULT_ATTACK_S = 0.005;
  var DEFAULT_RELEASE_S = 0.15;
  var DEFAULT_FLOOR_DB = -40;

  // ---- addModule load cache (node-reverb.js's getIrBuffer shape) --------

  var moduleContext = null; // the AudioContext the cached load belongs to
  var modulePromise = null; // the in-flight/resolved addModule promise
  var moduleLoaded = false; // true once resolved (the sync fast path)

  /**
   * Resolve once the 'noise-gate' processor is registered on THIS context.
   * At most one addModule call per context, shared by every gate node.
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
   * Construct the AudioWorkletNode. The global constructor is the standard
   * form; the context property is the meter-taps.js resolution form — take
   * whichever exists (both are the same class in Chrome).
   * @param {AudioContext} audioContext
   * @returns {AudioWorkletNode}
   */
  function newWorkletNode(audioContext) {
    var Ctor = typeof AudioWorkletNode === 'function'
      ? AudioWorkletNode
      : audioContext.AudioWorkletNode;
    // No outputChannelCount: the node adapts to the chain's channel count
    // like a GainNode (the watchdog tap pins [1] because it is a silent
    // side-tap; a chain node must pass the bus through, e.g. post-chorus
    // stereo).
    return new Ctor(audioContext, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1
    });
  }

  // Factory called by AudioGraph.buildGraph() (src/audio-graph.js) whenever
  // a model entry has type "gate" and no existing node instance is being reused
  // for its id. Returns a COMPOSITE value, same shape as EQ/Delay/Chorus.
  function createEffect(audioContext, params) {
    var p = params || {};

    var threshold = typeof p.threshold === 'number' ? p.threshold : DEFAULT_THRESHOLD_DB;
    var attack = typeof p.attack === 'number' ? p.attack : DEFAULT_ATTACK_S;
    var release = typeof p.release === 'number' ? p.release : DEFAULT_RELEASE_S;
    var floor = typeof p.floor === 'number' ? p.floor : DEFAULT_FLOOR_DB;

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
    };
    composite.baseThreshold = threshold;
    composite.disposed = false;
    function adjustThreshold() {
      var effective = window.AutoGain ? window.AutoGain.gateThreshold(composite.baseThreshold, composite) : composite.baseThreshold;
      if (composite.worklet && effective !== composite.effectiveThreshold) {
        window.AudioParamRamp.schedule(composite.worklet.parameters.get('threshold'), effective);
        composite.effectiveThreshold = effective;
      }
    }
    composite.adjustThreshold = adjustThreshold;
    if (window.AutoGain) composite.unsubscribe = window.AutoGain.subscribe(adjustThreshold);

    /**
     * Create the worklet node, give it its initial param values (direct
     * creation-time writes — a brand-new node has no live signal to
     * protect, same convention as every other factory here), and splice it
     * between the two stable connect points.
     */
    function insertWorklet() {
      if (composite.disposed) return;
      var worklet = newWorkletNode(audioContext);
      worklet.parameters.get('threshold').value = threshold;
      worklet.parameters.get('attack').value = attack;
      worklet.parameters.get('release').value = release;
      worklet.parameters.get('floor').value = floor;
      var ids = Object.keys(composite.pendingParams);
      for (var i = 0; i < ids.length; i++) {
        worklet.parameters.get(ids[i]).value = composite.pendingParams[ids[i]];
      }
      // Move inputGain's ONE internal edge from the passthrough to the
      // worklet. External edges (into .input / out of .output) are
      // untouched — this is the only rewiring this composite ever does.
      inputGain.disconnect(outputSum);
      inputGain.connect(worklet);
      worklet.connect(outputSum);
      composite.worklet = worklet;
      adjustThreshold();
    }

    // Both paths splice the same known edge. A warm factory replaces it
    // synchronously, before AudioGraph can connect this composite live.
    inputGain.connect(outputSum);
    if (moduleLoaded && moduleContext === audioContext) {
      // Every gate after the first (on the SAME context — a recreated
      // AudioContext must re-addModule, which the else path handles):
      // fully synchronous, no passthrough gap.
      insertWorklet();
    } else {
      // The first gate in a session: unity passthrough now, splice in the
      // worklet the moment addModule resolves (reverb's async-fill shape).
      ensureWorkletModule(audioContext).then(insertWorklet).catch(function (err) {
        console.error(
          'Noise Gate: worklet module failed to load — this gate stays open (unity passthrough).',
          err
        );
      });
    }

    return composite;
  }

  // UI-facing metadata plus applyParam. Plain-language labels per the
  // cycle-3 scope table (Threshold / Attack / Release / Floor — the plan's
  // own words); ranges/defaults per D1's paramSpec block:
  //   threshold −80..0 dB, default −50 (open point)
  //   attack    0.001..0.5 s, default 0.005 (matches the 5 ms look-ahead)
  //   release   0.01..2 s, default 0.15
  //   floor     −60..0 dB, default −40 (attenuation when closed;
  //             0 dB = never attenuate = bit-exact passthrough)
  //
  // Issue #5: live writes are SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() (src/audio-param-ramp.js) — the click-safe
  // form. The factory's creation-time writes above stay direct (a new node
  // has no live signal to protect yet), same convention as the compressor.
  window.EffectCatalog.register('gate', {
    label: 'Noise Gate',
    // wayfinder #46 — see docs/ultron/research/plain-effect-labels.md
    plainLabel: 'Cuts background noise',
    experimental: false,
    // Matches LOOKAHEAD_S in src/gate-worklet.js — the fixed 5 ms ring
    // delay every sample rides regardless of param settings. Read by
    // src/status-readouts.js's LATENCY readout.
    latencySeconds: 0.005,
    paramSpec: [
      { id: 'threshold', label: 'Threshold', min: -80, max: 0, default: -50, step: 1, unit: 'dB' },
      { id: 'attack', label: 'Attack', min: 0.001, max: 0.5, default: 0.005, step: 0.001, unit: 's' },
      { id: 'release', label: 'Release', min: 0.01, max: 2, default: 0.15, step: 0.01, unit: 's' },
      { id: 'floor', label: 'Floor', min: -60, max: 0, default: -40, step: 1, unit: 'dB' }
    ],
    create: createEffect,
    dispose: function (node) {
      node.disposed = true;
      if (node.unsubscribe) node.unsubscribe();
      if (node.worklet) node.worklet.disconnect();
      node.input.disconnect(); node.output.disconnect();
    },
    applyParam: function (nodeInstance, paramId, value) {
      if (paramId === 'threshold' || paramId === 'attack' ||
          paramId === 'release' || paramId === 'floor') {
        // Recorded always: if the worklet is not inserted yet (the first
        // gate's addModule window), the value is applied at insertion.
        nodeInstance.pendingParams[paramId] = value;
        if (paramId === 'threshold') {
          nodeInstance.baseThreshold = value;
          nodeInstance.adjustThreshold();
          return;
        }
        if (nodeInstance.worklet) {
          // Real AudioParam — the compressor's exact live-write shape.
          window.AudioParamRamp.schedule(
            nodeInstance.worklet.parameters.get(paramId), value);
        }
      }
    }
  });
})();
