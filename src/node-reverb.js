// Reverb node factory for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE pattern as the other
// files in this project. Same as src/node-gain.js, src/node-compressor.js,
// src/node-eq.js, and src/node-delay.js, this file doesn't export a new
// `window.X` namespace of its own — its only job is to register one complete
// definition with window.EffectCatalog at load time. The IIFE wrapper is
// kept anyway to match this
// project's file-level convention (every src/*.js file is one), though this
// file DOES have real module-level state that needs the closure this time
// (the IR fetch/decode cache below) — unlike node-delay.js et al., where the
// wrapper is a pure convention with nothing to hide.
//
// AE-9 scope: this is the FIFTH of six planned node-type files (AE-5
// Gain/Trim through AE-10 Limiter — see docs/ultron/plan.md's Task Index),
// and the THIRD composite one (after AE-7's EQ and AE-8's Delay) — built
// from a `ConvolverNode` plus a dry/wet mix pair of `GainNode`s. Structurally
// this is Delay's topology minus the feedback loop (a `ConvolverNode` has no
// analog of Delay's runaway-feedback risk, so there's no clamping story
// here), so it follows the exact same `{input, output, ...}` factory
// contract AE-7 established and AudioGraph.buildGraph() already supports
// (see that file's AE-7 addendum comment and its getNodeInput()/
// getNodeOutput() helpers) — `input` is the connection point for whatever
// comes before this node in the chain, `output` is the connection point for
// whatever comes after it, and they are two DIFFERENT real AudioNode objects
// here (an entry `GainNode` and an exit-sum `GainNode`), same as Delay's
// inputGain/outputSum split. NO CHANGE to audio-graph.js is needed for this
// task.
//
// One complete EffectCatalog definition, same as every other node-type
// file — registering under the permanent, committed
// type name `reverb` is enough on its own for "Reverb" to appear as a real,
// usable palette chip (UI-3's palette, src/canvas.js, builds itself
// dynamically from EffectCatalog.getAllTypes()); no other file needs any change
// for this task beyond the new <script> tag in index.html.
//
// Per docs/ultron/design/px2-node-parameters.md's Reverb section, the ONLY
// exposed param is `mix` (0-100%, default 20%) — the impulse response itself
// defines the reverb character; there's nothing else to tune (multiple
// reverb characters is explicitly out of scope for Core MVP per that doc).
// Same equal-power crossfade as Delay's `mix`: with `m = mix / 100`,
// `dryGain.gain.value = Math.cos(m * Math.PI / 2)` and
// `wetGain.gain.value = Math.sin(m * Math.PI / 2)` — at mix=50 both are
// ≈0.707 (the equal-power midpoint), not a naive linear 0.5/0.5, per
// px2-node-parameters.md's Cross-node notes.
//
// ---------------------------------------------------------------------
// THE REAL WRINKLE: async IR loading vs. a synchronous factory contract.
// ---------------------------------------------------------------------
//
// AudioGraph.buildGraph()'s Phase 1 (src/audio-graph.js) calls every
// registered factory SYNCHRONOUSLY and expects an immediate return value (a
// node, or a composite `{input, output, ...}` object per the AE-7 contract)
// — it never awaits a factory. But populating a `ConvolverNode.buffer`
// requires an impulse-response AUDIO FILE, and getting from "file on disk"
// to "decoded AudioBuffer" is inherently asynchronous: `fetch()` returns a
// Promise, and `AudioContext.decodeAudioData()` returns a Promise too. There
// is no synchronous way to hand a factory a ready-to-use decoded buffer the
// first time it's ever called.
//
// The fix used below has three pieces:
//
//   1. Kick the raw-bytes fetch off at MODULE LOAD TIME (top of this file,
//      runs the instant this <script> tag is parsed) rather than waiting
//      until the first Reverb node is actually added to a chain. `fetch()`
//      needs no AudioContext (none may even exist yet at this point — the
//      user might not have pressed Start), so there's no ordering problem in
//      starting the download immediately, in parallel with whatever else the
//      page is doing. This is what makes the IR "basically already there" by
//      the time anyone drags a Reverb chip onto the canvas.
//   2. A module-level cache (`cachedIrBuffer`, the decoded AudioBuffer once
//      available, and `decodePromise`, the in-flight decode) so that (a) a
//      second, third, ... Reverb node never re-fetches or re-decodes — they
//      just get handed the already-resolved `cachedIrBuffer` — and (b) two
//      Reverb nodes added before the FIRST decode finishes both attach to
//      the SAME in-flight decode Promise rather than each kicking off their
//      own redundant decode of the same bytes.
//   3. The factory itself still returns SYNCHRONOUSLY, satisfying
//      buildGraph()'s contract exactly like every other node type: it builds
//      the `ConvolverNode` and the rest of the dry/wet topology immediately,
//      with the convolver's `.buffer` left unset (null) at first, and
//      separately kicks off `getIrBuffer(audioContext).then(...)` to fill in
//      `.buffer` the moment decoding completes, asynchronously, whenever
//      that turns out to be. A `ConvolverNode` with no buffer yet just
//      outputs silence on its wet path (per the Web Audio spec) — since the
//      dry path is completely unaffected by this, the only user-visible
//      effect of the gap (if any — it should be near-instant after the
//      first-ever Reverb node, and literally instant for every one after
//      that, since `cachedIrBuffer` is already populated by then) is that
//      the reverb hasn't "kicked in" yet for a brief moment on the very
//      first node ever created — not a broken, erroring, or silent-forever
//      state.
//
// ---------------------------------------------------------------------
// Asset note (RQ-3 substitution).
// ---------------------------------------------------------------------
//
// docs/ultron/plan.md's RQ-3 committed to "IR Rollo Transparent Plate.wav"
// (Rollo145, Freesound.org, CC0 1.0) — but that specific WAV file requires a
// free Freesound login to download, which isn't something an automated
// build step can do. The asset actually bundled at assets/ir/plate-vocal.mp3
// is a public-preview MP3 of that SAME underlying CC0 sound (~1.01s,
// stereo, 44.1kHz) — same license, same recording, just the login-free
// preview encode instead of the original login-gated WAV. `decodeAudioData()`
// handles MP3 natively (same as it would the WAV) and the Web Audio API
// auto-resamples to the live context's sample rate regardless of the
// source file's own rate, so no format-handling code above needs to know or
// care which encode it's reading.
//
// IR: "IR Rollo Transparent Plate" by Rollo145, freesound.org, CC0 1.0.
// (Not legally required for CC0, but good practice — see RQ-3.)

(function () {
  'use strict';

  // Kick off the raw-bytes download immediately at module load time (i.e.
  // the instant this <script> tag is parsed) rather than waiting for the
  // first Reverb node to be added — see the file-level comment above for
  // why this is safe (fetch() needs no AudioContext) and why it matters
  // (this is what makes the IR "basically already there" by the time a host
  // actually drags a Reverb chip onto the canvas). This Promise resolves to
  // the raw ArrayBuffer of assets/ir/plate-vocal.mp3; nothing here decodes
  // it yet, since decoding requires an AudioContext that may not exist yet.
  var irArrayBufferPromise = fetch('assets/ir/plate-vocal.mp3').then(function (r) {
    return r.arrayBuffer();
  });

  // Module-level cache: the DECODED AudioBuffer, once available. Populated
  // exactly once, by the first getIrBuffer() call to actually resolve its
  // decode. Every Reverb node created after that point gets this same
  // object handed back instantly (synchronously wrapped in
  // Promise.resolve()) rather than triggering any further work.
  var cachedIrBuffer = null;

  // The in-flight decode Promise, or null if no decode has been started yet.
  // Exists so that concurrent factory calls (e.g. two Reverb nodes added in
  // quick succession before the very first decode finishes) share the SAME
  // decode attempt instead of each independently calling
  // audioContext.decodeAudioData() on the same bytes.
  var decodePromise = null;

  /**
   * Resolve to the decoded reverb impulse-response AudioBuffer, decoding it
   * (once) if necessary.
   *
   * - If already decoded, returns it immediately via Promise.resolve() — no
   *   redundant work, no re-fetch, no re-decode.
   * - Otherwise, if a decode isn't already in flight, starts one: takes the
   *   raw bytes from `irArrayBufferPromise` (already fetching/fetched since
   *   module load time, per the file-level comment above) and decodes them
   *   via `audioContext.decodeAudioData()`. The `.slice(0)` makes a fresh
   *   copy of the ArrayBuffer for this decode attempt — defensive against
   *   any engine that detaches/consumes the source buffer on decode — though
   *   in practice this should only ever actually decode once, since
   *   `cachedIrBuffer` short-circuits every call after the first.
   * - Either way, concurrent callers before the first decode resolves all
   *   share the one `decodePromise` in flight.
   *
   * @param {AudioContext} audioContext
   * @returns {Promise<AudioBuffer>}
   */
  function getIrBuffer(audioContext) {
    if (cachedIrBuffer) {
      return Promise.resolve(cachedIrBuffer);
    }
    if (!decodePromise) {
      decodePromise = irArrayBufferPromise.then(function (arrayBuffer) {
        return audioContext.decodeAudioData(arrayBuffer.slice(0));
      }).then(function (buffer) {
        cachedIrBuffer = buffer;
        return buffer;
      });
    }
    return decodePromise;
  }

  // Factory called by AudioGraph.buildGraph() (src/audio-graph.js) whenever
  // a model entry has type "reverb" and no existing node instance is being reused
  // for its id. Returns a COMPOSITE value (see file-level comment above),
  // same shape as AE-7's EQ and AE-8's Delay — and, per the file-level
  // comment's async-loading section, returns SYNCHRONOUSLY (satisfying
  // buildGraph()'s contract) even though the convolver's `.buffer` isn't
  // populated until the IR finishes loading/decoding, separately and
  // asynchronously, below.
  function createEffect(audioContext, params) {
    var p = params || {};
    var mixPct = typeof p.mix === 'number' ? p.mix : 20;

    // Entry point — unity gain, fans out to both the dry path and the
    // convolver path below. This is the composite's `input`.
    var inputGain = audioContext.createGain();
    inputGain.gain.value = 1;

    // The reverb itself. Left with no buffer for now — a ConvolverNode with
    // no buffer just outputs silence on this path (per spec), which is fine
    // since the dry path is unaffected — see getIrBuffer().then() below,
    // which fills this in the moment the IR is ready.
    var convolver = audioContext.createConvolver();

    // Dry/wet crossfade pair — equal-power, per px2-node-parameters.md's
    // Cross-node notes (every Mix percentage should be equal-power, not
    // linear), same formula as Delay's mix.
    var dryGain = audioContext.createGain();
    var wetGain = audioContext.createGain();
    var m = mixPct / 100;
    dryGain.gain.value = Math.cos(m * Math.PI / 2);
    wetGain.gain.value = Math.sin(m * Math.PI / 2);

    // Exit point — unity gain. Both dryGain and wetGain connect into this;
    // Web Audio sums multiple inputs into one node automatically. This is
    // the composite's `output`.
    var outputSum = audioContext.createGain();
    outputSum.gain.value = 1;

    // Internal wiring, done ONCE here at construction time and never touched
    // again by buildGraph() (which only ever connects/disconnects the
    // composite's .input/.output edges to the REST of the chain — see its
    // AE-7 addendum comment, still accurate for this composite type).
    inputGain.connect(dryGain);
    inputGain.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(outputSum);
    wetGain.connect(outputSum);

    // Fill in the convolver's buffer asynchronously, the moment the IR is
    // ready — see the file-level comment's async-loading section for the
    // full design. Near-instant after the first Reverb node ever created
    // (the fetch was already kicked off at module load time); effectively
    // instant for every Reverb node after the first (cachedIrBuffer is
    // already populated by then).
    getIrBuffer(audioContext).then(function (buffer) {
      convolver.buffer = buffer;
    }).catch(function (err) {
      console.error('Reverb: failed to load impulse response', err);
    });

    return {
      input: inputGain,
      output: outputSum,
      convolver: convolver,
      dryGain: dryGain,
      wetGain: wetGain,
    };
  }

  // UI-facing metadata rendered generically by src/param-controls.js, plus
  // applyParam (this type's direct
  // AudioParam writes for live slider updates, called by param-controls.js
  // on every `input` event — never routed through AudioGraph.buildGraph(),
  // per that file's own comment on why). `applyParam` is where the
  // composite shape actually gets used: `nodeInstance` here is the SAME
  // `{input, output, convolver, dryGain, wetGain}` object returned by the
  // factory above (AudioGraph.getNodeInstance(id) always returns the
  // original, possibly-composite value — see that function's own comment),
  // so this reaches straight into whichever internal piece the (single)
  // `mix` param targets.
  //
  // Issue #5: both crossfade sides are SCHEDULED over ~15 ms via
  // AudioParamRamp.schedule() (src/audio-param-ramp.js) instead of bare
  // `.value =` assignments — the click-safe form the 'host-param-ramps'
  // capability promise describes (the factory's creation-time writes stay
  // direct: a new node has no live signal to protect yet).
  window.EffectCatalog.register('reverb', {
    label: 'Reverb',
    experimental: false,
    paramSpec: [
      { id: 'mix', label: 'Mix', min: 0, max: 100, default: 20, step: 1, unit: '%' }
    ],
    create: createEffect,
    applyParam: function (nodeInstance, paramId, value) {
      if (paramId === 'mix') {
        var m = value / 100;
        window.AudioParamRamp.schedule(nodeInstance.dryGain.gain, Math.cos(m * Math.PI / 2));
        window.AudioParamRamp.schedule(nodeInstance.wetGain.gain, Math.sin(m * Math.PI / 2));
      }
    }
  });
})();
