// Node graph data model + passthrough graph-builder for the Node-Based Web
// Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same pattern as audio-engine.js:
// a single IIFE exposing one global namespace, `window.AudioGraph`.
//
// AE-2 scope (Milestone M1 — "prove the thin end-to-end path before adding
// complexity"):
//   - An ordered in-memory node MODEL (`{id, type, params}` entries),
//     intentionally decoupled from the real Web Audio node instances it
//     describes. The model is the thing later UI/undo/persistence code
//     reasons about; `buildGraph()` is the only piece that knows how to turn
//     it into real audio wiring.
//   - `buildGraph()`, the mechanical connector: mic source -> each modeled
//     node's real AudioNode, in order -> AudioContext.destination. With an
//     EMPTY model this reduces to a direct passthrough (source straight to
//     destination), which is exactly the M1 passthrough requirement.
//   - `registerNodeType()` / `nodeFactories`, the registry contract that
//     later tasks (AE-5 through AE-10: Gain, Compressor, EQ, Delay, Reverb,
//     Limiter) will populate. Nothing registers into it yet — that's fine,
//     `buildGraph([])` never consults it.
//
// AE-3 addendum: this file also owns the shared "chain gate" `GainNode` (see
// getChainGate() below). AE-3 (bypass routing) needs a single point after
// the last chain node it can ramp to silence independently of whatever
// AudioBypass's own dry tap is doing. buildGraph() also tracks
// `firstChainNode` — the specific node sourceNode is currently connected to
// — so it can disconnect exactly that one edge on rebuild instead of a
// blanket `sourceNode.disconnect()`, which would also sever AudioBypass's
// independent tap off of sourceNode. See the comments in buildGraph() and
// getChainGate() below.
//
// AE-4 scope (this task) — buildGraph() is now glitch-free and reuse-aware:
//   - Glitch-free live rewiring: a rebuild ramps the shared chain gate down
//     to near-silence, performs the graph surgery while ducked, then ramps
//     back up — no audible pop/click from tearing down and reconnecting live
//     nodes. See rampGateTo() and the FADE_S constant below.
//   - Node-instance reuse across rebuilds: an id present in both the old and
//     new model reuses the SAME AudioNode object (preserving internal DSP
//     state — e.g. a compressor's envelope, a delay's buffer contents —
//     across a pure reorder) instead of recreating it from scratch. Only ids
//     that are actually new call their registered factory.
//   - The rewire itself is deferred (via setTimeout, timed to land after the
//     duck-down fade completes) and debounced: rapid successive buildGraph()
//     calls cancel any not-yet-executed previous rewire, so only the LAST
//     call's model is actually built. Resolving the new model's node
//     instances (including throwing on an unknown type) still happens
//     synchronously, up front, before any ducking — see buildGraph() below
//     for why.
//   These were both explicitly out-of-scope markers left by AE-2/AE-3,
//   deferred to this task. See buildGraph() below for the full algorithm and
//   the specific bugs its design avoids.
//
// AE-7 addendum: extends the factory contract to allow a COMPOSITE return
// value. Before this task every registered factory (Gain, Compressor)
// returned a single plain AudioNode that served as both the connection
// point for whatever comes before it and for whatever comes after it — true
// for one node, but not for EQ (src/node-eq.js), the first type built from
// more than one internal AudioNode (three chained BiquadFilterNodes).
// buildGraph() now identifies each resolved node's real input/output via
// getNodeInput()/getNodeOutput() (defined near rampGateTo() below) instead
// of assuming the resolved value itself is directly connectable in both
// directions. A factory may still return a plain AudioNode (Gain and
// Compressor need zero changes) or, for a composite type, a plain object
// shaped `{ input: AudioNode, output: AudioNode, ...anythingElse }` — the
// `...anythingElse` lets a type also expose its individual internal nodes
// for NodeTypes.applyParam() to reach (e.g. EQ's `.low`/`.mid`/`.high`).
// See the comments at getNodeInput()/getNodeOutput() and inside
// buildGraph()'s deferred rewire for exactly where this matters.
//
// MC-4 addendum — host-owned output attenuator (RQ-3,
// docs/ultron/research/rq3-loudness-policy.md): a SECOND persistent GainNode,
// `outputAttenuator`, permanently inserted between the shared chain gate and
// audioContext.destination (chainGate -> outputAttenuator -> destination).
// Its fixed gain implements rq3's default output ceiling of -6 dBFS (linear
// 10^(-6/20) = 0.5012): the limiter's spec-mandated makeup gain plus its
// 0-1.5 ms attack overshoot plus intersample peaks can sit up to +3-4 dB
// above the ceiling PARAM, so the host adds a margin no chain setting can
// reach. It is HOST-OWNED: created once with the graph, never torn down or
// rewired by buildGraph()'s teardown (the teardown section disconnects only
// nodes in `nodeInstances`; the gate and the attenuator are deliberately
// not in it), never exposed as a param to any agent tool (src/mcp-tools.js
// hard-rejects attempts to address it), and never touched by AudioBypass —
// the bypass dry tap connects sourceNode straight to destination
// independently, so Bypass remains a fully human-controlled pure path.

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Internal state.
  // ---------------------------------------------------------------------

  // Ordered array of {id, type, params}. This is the authoritative model of
  // "what nodes exist and in what order", independent of whether real
  // AudioNode instances currently exist for it. Never hand out this array
  // itself from getModel() — always a copy — so callers can't mutate our
  // internal state by reference.
  var currentModel = [];

  // Map of model entry id -> live AudioNode currently built for it. Only
  // ever populated/cleared inside buildGraph(); always reflects exactly
  // what's wired into the live graph right now (or is empty, between
  // rebuilds/before the first one).
  var nodeInstances = {};

  // Map of type name -> factory function (audioContext, params) => AudioNode.
  // Empty for now; AE-5+ populate this via registerNodeType(). buildGraph()
  // must still work correctly against an empty registry as long as the
  // model passed in is also empty (an empty model never looks anything up
  // here).
  var nodeFactories = {};

  // The specific node that AudioEngine.sourceNode is currently connected to
  // as its first (and only) downstream hop managed by buildGraph() — either
  // the first model node's AudioNode, or `chainGate` directly when the model
  // is empty. `null` until the first successful buildGraph() call. Tracked
  // so buildGraph() can disconnect exactly this one edge on rebuild (via
  // sourceNode.disconnect(firstChainNode)) instead of a blanket
  // sourceNode.disconnect() — the blanket form would also tear down any
  // other independent connection off of sourceNode, such as AudioBypass's
  // dry tap (src/audio-bypass.js), every time the chain is rebuilt (e.g. a
  // future drag-and-drop reorder). See buildGraph() below.
  var firstChainNode = null;

  // Shared "chain gate" GainNode — sits between the last node in the effect
  // chain (or the mic source directly, if the model is empty) and the
  // host-owned outputAttenuator (see the MC-4 addendum in the file header).
  // Created lazily on first need (either the first buildGraph() call, or
  // the first getChainGate() call, whichever comes first) since it requires
  // window.AudioEngine.audioContext to already exist. Steady-state gain is
  // 1 (chain output audible). AE-3's AudioBypass ramps this to 0 when
  // bypass is engaged, independent of whatever buildGraph() has wired
  // downstream of it; AE-4 uses it for glitch-free rewiring ramps.
  var chainGate = null;

  // MC-4: host-owned output attenuator GainNode — chainGate ->
  // outputAttenuator -> destination, gain fixed at OUTPUT_ATTENUATOR_LINEAR
  // (-6 dBFS). Created lazily alongside the chain gate (same
  // audioContext-must-exist contract), connected to destination exactly
  // once at creation, and NEVER disconnected by buildGraph()'s teardown —
  // only the chainGate -> outputAttenuator edge is (idempotently)
  // re-asserted per rebuild. No param exposure: nothing outside this file
  // may write its gain (FEW-3's watchdog reads it via getOutputAttenuator()
  // but is likewise forbidden from re-gaining it — its emergency action is
  // the chainGate it already owns).
  var outputAttenuator = null;

  // MC-4: the rq3 host-attenuator constants. OUTPUT_CEILING_DBFS is the
  // single source of truth for BOTH the attenuator's gain and the on-screen
  // "Safe output" note text (no literal -6 anywhere else); the linear value
  // is derived, never duplicated. Exposed read-only on window.AudioGraph
  // for FEW-3 (watchdog ceiling math) and QA-2/MC-6 (expected test peak).
  var OUTPUT_CEILING_DBFS = -6;
  var OUTPUT_ATTENUATOR_LINEAR = Math.pow(10, OUTPUT_CEILING_DBFS / 20); // = 0.50119... ~= 0.5012

  // MC-4: verifyAttenuatorOffline()'s test fixture — a square wave driven
  // at -1 dBFS (a hot, already-nearly-clipping input, per plan MC-4's
  // acceptance: "attenuator verified with hot signals (square-wave -1 dBFS
  // test input)"). Test-fixture constant, not a policy number.
  var VERIFY_TEST_INPUT_DBFS = -1;
  var VERIFY_TEST_DURATION_S = 0.25;
  var VERIFY_TEST_SAMPLE_RATE = 44100;

  // Fade duration (seconds) used both to duck the chain gate before a
  // rebuild's graph surgery and to un-duck it afterward. 15ms, per the
  // project's committed RQ-1 research — short enough to feel instant,
  // long enough to avoid an audible click/pop from the gain jump.
  var FADE_S = 0.015;

  // Handle for the currently-scheduled-but-not-yet-executed deferred rewire
  // (see buildGraph() below), or null if none is pending. Used to debounce
  // rapid successive buildGraph() calls: a new call cancels whatever rewire
  // an earlier call had scheduled, so only the LAST call's model actually
  // gets built.
  var pendingRewireTimer = null;

  /**
   * Get the shared chain gate GainNode, creating it on first call if it
   * doesn't exist yet. Requires window.AudioEngine.audioContext to already
   * exist (i.e. call after AudioEngine.start() has resolved).
   *
   * @returns {GainNode}
   */
  function getChainGate() {
    if (!chainGate) {
      var audioContext = window.AudioEngine && window.AudioEngine.audioContext;
      if (!audioContext) {
        throw new Error(
          'AudioGraph.getChainGate: window.AudioEngine.audioContext must already exist. ' +
          'Call AudioEngine.start() (and await it) first.'
        );
      }
      chainGate = audioContext.createGain();
      chainGate.gain.value = 1; // normal operation — chain output audible by default
    }
    return chainGate;
  }

  /**
   * MC-4: create (once) the .safe-output-note disclosure element next to
   * the OUT anchor in the canvas panel — the rq3-mandated UI note
   * "Safe output: ON, ceiling -6 dBFS". Created from JS in the same spirit
   * as src/agent-ui.js's components (never hardcoded in index.html), so
   * the note cannot exist without the attenuator feature that justifies
   * it. Idempotent; silently skipped when there is no DOM (e.g. a Node
   * test harness) or no canvas panel — the note is disclosure, not
   * function, and must never be able to throw into the audio path. The
   * text is DERIVED from OUTPUT_CEILING_DBFS so the note and the actual
   * ceiling can never drift apart.
   */
  function ensureSafeOutputNote() {
    try {
      if (document.getElementById('safe-output-note')) {
        return;
      }
      var canvasEl = document.getElementById('chain-canvas');
      if (!canvasEl) {
        return;
      }
      var note = document.createElement('div');
      note.id = 'safe-output-note';
      note.className = 'safe-output-note';
      note.setAttribute('role', 'note');
      note.textContent =
        'Safe output: ON, ceiling ' + OUTPUT_CEILING_DBFS + ' dBFS';
      // 2026-08-31 cord round: the in-flow OUT anchor is retired — the
      // note rides the pinned BASE PLATE next to the OUT meter unit (the
      // operator's output ground truth), never inside the scrolling face.
      var footer = document.querySelector('.canvas-footer');
      if (footer) {
        footer.appendChild(note);
      } else {
        canvasEl.appendChild(note);
      }
    } catch (err) {
      // No DOM here (e.g. a bare Node harness) — purely cosmetic, never fatal.
    }
  }

  /**
   * MC-4: get the host-owned output attenuator GainNode
   * (chainGate -> attenuator -> destination; gain fixed at -6 dBFS),
   * creating it on first call if it doesn't exist yet. Requires
   * window.AudioEngine.audioContext to already exist — the same contract
   * as getChainGate() above. The attenuator is connected to
   * audioContext.destination exactly once, here at creation, and is never
   * disconnected afterwards: buildGraph() only ever (re)connects the
   * chainGate INTO it.
   *
   * Consumers: buildGraph() (wiring), FEW-3's watchdog/QA (read-only tap
   * point — the RQ-3 runtime watchdog monitors downstream of exactly this
   * node). Nothing may write its gain.
   *
   * @returns {GainNode}
   */
  function getOutputAttenuator() {
    if (!outputAttenuator) {
      var audioContext = window.AudioEngine && window.AudioEngine.audioContext;
      if (!audioContext) {
        throw new Error(
          'AudioGraph.getOutputAttenuator: window.AudioEngine.audioContext must already exist. ' +
          'Call AudioEngine.start() (and await it) first.'
        );
      }
      outputAttenuator = audioContext.createGain();
      outputAttenuator.gain.value = OUTPUT_ATTENUATOR_LINEAR; // -6 dBFS
      outputAttenuator.connect(audioContext.destination);
      ensureSafeOutputNote();
    }
    return outputAttenuator;
  }

  /**
   * MC-4 (QA-2/MC-6 callable proof): render a -1 dBFS square wave through
   * the stock limiter configuration + the host attenuator in an
   * OfflineAudioContext and resolve the MEASURED output peak (linear
   * 0..1-ish). This is the offline verification that the -6 dBFS ceiling
   * actually holds for a hot input even with limiter makeup/overshoot.
   *
   * Usage (QA-2 matrix / MC-6 harness):
   *   AudioGraph.verifyAttenuatorOffline().then(function (peak) {
   *     // peak === null -> OfflineAudioContext unavailable in this context.
   *     // Expected: ~OUTPUT_ATTENUATOR_LINEAR (0.5012) plus a few percent
   *     // of limiter overshoot; QA-2 asserts peak < 0.6 (-4.4 dBFS), i.e.
   *     // inside rq3's absolute never-exceed -3 dBFS headroom.
   *   });
   *
   * The limiter is configured exactly like src/node-limiter.js's factory
   * defaults (ceiling -1 dB, ratio 20:1, attack 0, hard knee, 50 ms
   * release) so the measurement exercises the same DSP the live graph
   * uses; the attenuator gain is the SAME OUTPUT_ATTENUATOR_LINEAR
   * constant. Never throws and never rejects: any internal failure
   * (including no OfflineAudioContext in this runtime) resolves null.
   *
   * @param {Object} [options] - { durationS?: number, sampleRate?: number }
   * @returns {Promise<number|null>} the measured linear peak, or null.
   */
  function verifyAttenuatorOffline(options) {
    return new Promise(function (resolve) {
      try {
        var Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (typeof Ctor !== 'function') {
          resolve(null); // No offline rendering in this runtime (e.g. Node).
          return;
        }
        var opts = options || {};
        var sampleRate = opts.sampleRate || VERIFY_TEST_SAMPLE_RATE;
        var durationS =
          typeof opts.durationS === 'number' && opts.durationS > 0
            ? opts.durationS
            : VERIFY_TEST_DURATION_S;
        var ctx = new Ctor(1, Math.max(1, Math.round(durationS * sampleRate)), sampleRate);

        // Hot test signal: square wave at -1 dBFS (VERIFY_TEST_INPUT_DBFS).
        var osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 440;
        var sourceGain = ctx.createGain();
        sourceGain.gain.value = Math.pow(10, VERIFY_TEST_INPUT_DBFS / 20);

        // Stock safety limiter (src/node-limiter.js factory defaults).
        var limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -1;
        limiter.ratio.value = 20;
        limiter.attack.value = 0;
        limiter.knee.value = 0;
        limiter.release.value = 0.05;

        // The host attenuator, at its real fixed gain.
        var attenuator = ctx.createGain();
        attenuator.gain.value = OUTPUT_ATTENUATOR_LINEAR;

        osc.connect(sourceGain);
        sourceGain.connect(limiter);
        limiter.connect(attenuator);
        attenuator.connect(ctx.destination);
        osc.start(0);
        osc.stop(durationS);

        ctx.startRendering().then(
          function (buffer) {
            var data = buffer.getChannelData(0);
            var peak = 0;
            for (var i = 0; i < data.length; i++) {
              var v = Math.abs(data[i]);
              if (v > peak) {
                peak = v;
              }
            }
            resolve(peak);
          },
          function () {
            resolve(null); // Rendering failed — honest null, never a throw.
          }
        );
      } catch (err) {
        resolve(null);
      }
    });
  }

  /**
   * Register a node factory under a type name, for later use by
   * buildGraph() when a model entry has a matching `type`.
   *
   * No caller populates this yet in AE-2 — later tasks (AE-5: Gain, AE-6:
   * Compressor, AE-7: EQ, AE-8: Delay, AE-9: Reverb, AE-10: Limiter) will
   * each call this once to register their node type. The function must
   * exist and work correctly now so those tasks have a stable contract to
   * build against.
   *
   * @param {string} type - unique node type name, e.g. "gain".
   * @param {(audioContext: AudioContext, params: Object) => AudioNode} factory
   */
  function registerNodeType(type, factory) {
    if (!type || typeof type !== 'string') {
      throw new Error('AudioGraph.registerNodeType: type must be a non-empty string.');
    }
    if (typeof factory !== 'function') {
      throw new Error('AudioGraph.registerNodeType: factory must be a function.');
    }
    nodeFactories[type] = factory;
  }

  /**
   * Get a copy of the current node model. Safe for callers to inspect (or
   * even mutate) without affecting AudioGraph's internal state — mutating
   * the returned array/objects does nothing until a caller passes a new
   * model into buildGraph().
   *
   * @returns {Array<{id: string, type: string, params: Object}>}
   */
  function getModel() {
    return currentModel.map(function (entry) {
      return {
        id: entry.id,
        type: entry.type,
        params: Object.assign({}, entry.params || {}),
      };
    });
  }

  /**
   * Look up the live AudioNode currently built for a given model-entry id.
   *
   * UI-4: read-only accessor so a parameter-control component (see
   * src/param-controls.js) can apply a live AudioParam change directly to
   * the real node a slider is bound to, without going through
   * buildGraph()'s structural-rewiring machinery — see updateNodeParams()
   * below for the model-bookkeeping half of that same story.
   *
   * @param {string} id
   * @returns {AudioNode|null} the live node, or null if no node is
   *   currently built for this id (e.g. unknown id, or before the first
   *   buildGraph() call).
   */
  function getNodeInstance(id) {
    return nodeInstances[id] || null;
  }

  /**
   * Update the stored `.params` for one model entry, WITHOUT touching the
   * live audio graph.
   *
   * UI-4: a continuous slider drag needs the model's bookkeeping to stay in
   * sync (so a later preset-save reflects the new value) but must NOT go
   * through buildGraph() — that would duck the shared chain gate and tear
   * down/rebuild the whole chain on every single `input` event fired while
   * dragging. The live-audio side of a param tweak is applied separately,
   * via a direct AudioParam write (see NodeTypes.applyParam() in
   * src/node-types.js and src/param-controls.js) — this function only
   * keeps currentModel's bookkeeping correct for the next getModel()/
   * preset-save call.
   *
   * No-ops (does not throw) if no entry with this id exists in
   * currentModel — defensive, since this could be called in a stale-
   * reference edge case (e.g. a rebuild removed the entry between the
   * slider being rendered and the user moving it).
   *
   * @param {string} id
   * @param {Object} params
   */
  function updateNodeParams(id, params) {
    for (var i = 0; i < currentModel.length; i++) {
      if (currentModel[i].id === id) {
        currentModel[i].params = Object.assign({}, params);
        return;
      }
    }
  }

  /**
   * AE-7 addendum: a factory registered via registerNodeType() may now
   * return EITHER a plain AudioNode (the original contract — Gain and
   * Compressor both still do exactly this, unchanged) OR a plain JS object
   * shaped `{ input: AudioNode, output: AudioNode, ...anythingElse }` for a
   * COMPOSITE type built from more than one internal AudioNode (EQ, the
   * first such type, is three chained BiquadFilterNodes — see
   * src/node-eq.js). buildGraph()'s connect step needs to know which real
   * AudioNode to connect INTO (the chain's input) versus which one to
   * connect FROM (the chain's output) — for a single node those are the
   * same object; for a composite they're two different ones. These two
   * helpers are the one place that distinction is resolved, falling
   * through to the node itself whenever `.input`/`.output` aren't present
   * so single-node types are completely unaffected.
   *
   * @param {AudioNode|{input: AudioNode}} node
   * @returns {AudioNode}
   */
  function getNodeInput(node) {
    return (node && node.input) ? node.input : node;
  }

  /**
   * @param {AudioNode|{output: AudioNode}} node
   * @returns {AudioNode}
   */
  function getNodeOutput(node) {
    return (node && node.output) ? node.output : node;
  }

  /**
   * Ramp `gate`'s gain to `target` over FADE_S seconds, starting from
   * audioContext.currentTime, using the standard click-avoiding pattern:
   * cancel any pending automation, pin the param at its current value at
   * `now`, then a linear ramp from there to the target.
   *
   * @param {GainNode} gate
   * @param {number} target
   * @param {AudioContext} audioContext
   */
  function rampGateTo(gate, target, audioContext) {
    var now = audioContext.currentTime;
    gate.gain.cancelScheduledValues(now);
    gate.gain.setValueAtTime(gate.gain.value, now);
    gate.gain.linearRampToValueAtTime(target, now + FADE_S);
  }

  /**
   * (Re)build the real Web Audio node chain from the mic source through to
   * the AudioContext destination, per `model`.
   *
   * Must be called after AudioEngine.start() has resolved (it requires
   * window.AudioEngine.audioContext and window.AudioEngine.sourceNode to
   * already exist). Also the function to call again after
   * AudioEngine.switchInputDevice() — that call replaces `sourceNode` with
   * a brand new instance that isn't connected to anything yet.
   *
   * AE-4: glitch-free and reuse-aware. Runs in two phases:
   *
   *   Phase 1 (synchronous, immediate): resolve every model entry to an
   *   AudioNode object — reusing the existing instance if its id already
   *   exists (preserving internal DSP state, e.g. a compressor's envelope or
   *   a delay's buffer contents, across a pure reorder), or calling its
   *   registered factory for a new id. This never touches the live graph
   *   (no .connect()/.disconnect() here), so it's safe to do before any
   *   ducking — and it means a bad model (unknown type) throws
   *   SYNCHRONOUSLY, right here, with the old chain completely untouched.
   *
   *   Phase 2 (deferred): duck the shared chain gate toward silence, then —
   *   after the fade completes — disconnect the old topology, connect the
   *   new one (using the node objects already resolved in phase 1), commit
   *   the new model/bookkeeping, and un-duck the gate back to its correct
   *   steady state. Rapid successive calls debounce: a new call cancels any
   *   previous call's not-yet-executed phase 2, so only the LAST call's
   *   model is actually built (the gate is already ducked or ducking from
   *   the earlier call, so re-ducking is harmless).
   *
   * Teardown-then-rebuild happens strictly sequentially, not overlapping —
   * deliberately simpler than connecting the new edges before disconnecting
   * the old ones at the edge level, which has a real collision bug: if the
   * old and new topologies share an edge (e.g. rearranging an already-empty
   * chain, where both old and new first-hop target is the gate itself),
   * connecting "new" while "old" is still connected either no-ops
   * confusingly or the subsequent disconnect of "old" removes the shared
   * edge just added. Since phase 2 runs entirely while the gate is already
   * ducked to near-silence, there's no audible benefit to overlapping old/
   * new — sequential teardown-then-rebuild is exactly as inaudible and
   * avoids that bug entirely.
   *
   * The un-duck at the end does NOT unconditionally ramp to 1.0: if
   * AudioBypass is currently engaged, the chain gate's correct steady state
   * is 0 (muted), not 1 — naively restoring to 1.0 would silently disengage
   * Bypass as a side effect of an unrelated chain edit, which would be a
   * real safety bug (Bypass must stay engaged independent of chain edits,
   * per its own AE-3 design). The un-duck ramps to whatever the currently-
   * correct target actually is.
   *
   * This deliberately does NOT touch any other connection sourceNode may
   * have — notably AudioBypass's independent dry tap (src/audio-bypass.js)
   * — so that tap survives every rebuild. See the firstChainNode comment
   * near the top of this file.
   *
   * With an empty `model`, the result is a direct passthrough: mic source
   * connected straight to the chain gate, then to destination, zero
   * processing nodes in between.
   *
   * @param {Array<{id: string, type: string, params: Object}>} model
   */
  function buildGraph(model) {
    if (!Array.isArray(model)) {
      throw new Error('AudioGraph.buildGraph: model must be an array.');
    }

    var audioContext = window.AudioEngine && window.AudioEngine.audioContext;
    var sourceNode = window.AudioEngine && window.AudioEngine.sourceNode;
    if (!audioContext || !sourceNode) {
      throw new Error(
        'AudioGraph.buildGraph: window.AudioEngine.audioContext and .sourceNode must ' +
        'already exist. Call AudioEngine.start() (and await it) before buildGraph().'
      );
    }

    var gate = getChainGate();
    // MC-4: ensure the host-owned output attenuator exists from the very
    // first build (created once; see getOutputAttenuator()). Resolved here
    // in the synchronous section so the steady-state path
    // chainGate -> attenuator -> destination is established by the same
    // first rebuild that establishes the gate itself.
    var attenuator = getOutputAttenuator();
    var oldNodeInstances = nodeInstances; // current live map, captured now

    // ---- Phase 1 (SYNCHRONOUS, happens immediately, before any ducking) ----
    // Resolve every model entry to an AudioNode object RIGHT NOW: reuse the
    // existing instance if this id already exists AS THE SAME TYPE, or call
    // its registered factory to create a fresh one if the id is new — or
    // has changed type. Creating a node object does NOT touch the live
    // audio graph (no .connect() happens here) so this is safe to do
    // before any muting, and it means a bad model (unknown type) throws
    // SYNCHRONOUSLY, right here, with the old chain completely untouched —
    // exactly like callers could already rely on before this task.

    // id -> type, from the model the CURRENT live instances were built
    // from. currentModel and nodeInstances are only ever swapped together,
    // in the same deferred Phase 2 commit below (and nodeInstances' keys
    // are exactly currentModel's ids — both are derived from the same
    // model in the same synchronous block), so this is always precisely
    // the type each live instance was factoried for, never a stale guess.
    // If the two ever drifted anyway, a missing entry here yields
    // undefined, which equals no model entry's type string and falls
    // through to the factory — the safe direction, never a wrong reuse.
    var oldModelTypes = {};
    currentModel.forEach(function (entry) {
      oldModelTypes[entry.id] = entry.type;
    });

    var resolvedNodes = model.map(function (entry) {
      // Issue #1 (P0): reuse demands an id AND TYPE match against the
      // model the live instances were built from. Id alone is not
      // identity — a live instance is a concrete GainNode or
      // DynamicsCompressorNode, not a label, so "reusing" it for an entry
      // whose type changed would RELABEL a physically wrong node: worst
      // case a GainNode left standing in for the required terminal
      // limiter while the model and every tool result claim a limiter is
      // present. A type-changed id therefore falls through to the factory
      // path below (fresh instance, entry params applied at creation),
      // and Phase 2's teardown then treats its old instance exactly like
      // any dropped node — disconnected, never carried into the new
      // nodeInstances map. Same id + same type remains a genuine reuse:
      // the SAME object is returned, preserving internal DSP state (e.g.
      // a compressor's envelope, a delay's buffer contents) across a pure
      // reorder or param-only change.
      if (
        Object.prototype.hasOwnProperty.call(oldNodeInstances, entry.id) &&
        oldModelTypes[entry.id] === entry.type
      ) {
        return oldNodeInstances[entry.id];
      }
      var factory = nodeFactories[entry.type];
      if (!factory) {
        throw new Error(
          'AudioGraph.buildGraph: unknown node type "' + entry.type + '" ' +
          '(id "' + entry.id + '"). Register it first with AudioGraph.registerNodeType().'
        );
      }
      return factory(audioContext, entry.params || {});
    });

    // ---- Phase 2 (deferred): duck, then perform the actual graph surgery ----
    // Cancel any previously-scheduled-but-not-yet-executed rewire (debounces
    // rapid successive calls — e.g. a user editing quickly — so only the
    // LAST call's model ends up actually built; the gate is already ducked
    // or ducking from the earlier call, so re-ducking here is harmless).
    if (pendingRewireTimer !== null) {
      clearTimeout(pendingRewireTimer);
      pendingRewireTimer = null;
    }

    rampGateTo(gate, 0.0001, audioContext);

    pendingRewireTimer = setTimeout(function () {
      pendingRewireTimer = null;

      // Teardown: fully disconnect the OLD topology. Nodes being reused are
      // only DISCONNECTED here, never destroyed — their object identity and
      // internal state survive; they get reconnected fresh below. Nodes not
      // present in the new model are disconnected and simply not carried
      // forward into the new nodeInstances map, making them GC-eligible.
      if (firstChainNode) {
        try { sourceNode.disconnect(firstChainNode); } catch (e) { /* already gone */ }
      }
      // AE-7: disconnect each entry's OUTPUT specifically, via
      // getNodeOutput() — a composite type (e.g. EQ) only ever has its
      // internal filters wired to each other via their OWN .connect() calls
      // made once at construction time (see src/node-eq.js); the only edge
      // buildGraph() itself ever put on such a node is the one leaving its
      // output into whatever came next, so that's the only edge it needs to
      // (and should) sever here. For a plain single-node type, getNodeOutput()
      // falls through to the node itself, so this is a no-op behavioral
      // change from before.
      //
      // Adapter-backed instances (src/tone-adapter.js composites) also get
      // dispose() called here when their id is NOT carried forward: a Tone
      // node keeps internal nodes and a JS-tick clock alive after a mere
      // disconnect, so dropped instances must be explicitly released.
      // Carried-forward identity is decided by object identity — resolved
      // nodes for reuse ARE the old instance objects (Phase 1) — which also
      // covers the id-same-type-changed case (fresh factory instance, old
      // instance dropped). Plain AudioNodes and native composites have no
      // dispose(): the typeof guard makes this a no-op for every one of
      // them, so existing types' teardown behavior is byte-for-byte what
      // it was before this hook existed.
      var carriedForward = {};
      model.forEach(function (entry, i) {
        if (resolvedNodes[i] === oldNodeInstances[entry.id]) {
          carriedForward[entry.id] = true;
        }
      });
      Object.keys(oldNodeInstances).forEach(function (id) {
        var old = oldNodeInstances[id];
        try { getNodeOutput(old).disconnect(); } catch (e) { /* already gone */ }
        if (!carriedForward[id] && old && typeof old.dispose === 'function') {
          try { old.dispose(); } catch (e) { /* already gone */ }
        }
      });

      // Rebuild: wire the new topology fresh, using the node objects already
      // resolved/created in Phase 1. This happens strictly AFTER teardown
      // (not overlapping it) — see the file-level/function-level comment
      // above about the edge-collision bug this avoids.
      // AE-7: walk the chain using each resolved node's INPUT (the
      // connection point for whatever comes before it) and OUTPUT (the
      // connection point for whatever comes after it) rather than assuming
      // they're the same object — true for a plain single-node type (where
      // getNodeInput()/getNodeOutput() both fall through to the node
      // itself) but false for a composite type like EQ, whose real input
      // (the low-shelf filter) and real output (the high-shelf filter) are
      // two different AudioNode objects. `nodeInstances`/`newNodeInstances`
      // still store the ORIGINAL (possibly composite) value per id — never
      // just its .input or .output — so AudioGraph.getNodeInstance(id)
      // keeps returning something NodeTypes.applyParam can reach every
      // internal piece of (e.g. EQ's .low/.mid/.high — see src/node-eq.js).
      var newNodeInstances = {};
      var newFirstNode = null;
      var previousOutput = sourceNode;
      model.forEach(function (entry, i) {
        var node = resolvedNodes[i];
        var nodeInput = getNodeInput(node);
        var nodeOutput = getNodeOutput(node);
        previousOutput.connect(nodeInput);
        if (previousOutput === sourceNode) {
          newFirstNode = nodeInput;
        }
        newNodeInstances[entry.id] = node;
        previousOutput = nodeOutput;
      });
      previousOutput.connect(gate);
      // MC-4: connect the gate into the host-owned output attenuator (NOT
      // straight to destination — the attenuator is a permanent fixture of
      // the graph shape). Idempotent (a no-op on an already-connected pair,
      // per the Web Audio spec) but must still happen here every rebuild:
      // without a path onward to destination, the audio thread never
      // evaluates the gate's gain automation at all — silent forever, and
      // rampGateTo()/AudioBypass's own ramps on this same node become
      // inert. The attenuator's own ->destination edge was made once, at
      // its creation inside getOutputAttenuator(), and is deliberately NOT
      // touched by this teardown/rebuild: teardown above disconnects only
      // nodes in oldNodeInstances, so chainGate -> attenuator ->
      // destination persists across every rebuild.
      gate.connect(attenuator);
      if (newFirstNode === null) {
        newFirstNode = gate;
      }

      // Commit new state.
      nodeInstances = newNodeInstances;
      firstChainNode = newFirstNode;
      currentModel = model.map(function (entry) {
        return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params || {}) };
      });

      // Un-duck — but NOT unconditionally to 1.0. Two states besides
      // "audible" can own the gate's correct steady state:
      //   - If AudioBypass is currently engaged, the chain gate's
      //     correct steady state is 0 (muted), not 1 — naively restoring
      //     to 1.0 here would silently DISENGAGE Bypass as a side effect
      //     of an unrelated chain edit, which would be a real safety bug
      //     (Bypass must stay engaged independent of chain edits, per
      //     its own AE-3 design).
      //   - If FEW-3's watchdog is latched (issue #3), the gate belongs
      //     at the watchdog's mute level WHATEVER Bypass's state is: a
      //     rebuild racing a live trip must never schedule an upward
      //     ramp that reopens tripped output. Only the human "Restore
      //     output" button (src/meter-taps.js) may lift the latch;
      //     MeterTaps' defend-the-mute loop is the backstop if anything
      //     else tries. The typeof guard keeps this safe in harnesses
      //     that load audio-graph.js without meter-taps.js.
      var watchdogLatched =
        window.MeterTaps &&
        typeof window.MeterTaps.isTripped === 'function' &&
        window.MeterTaps.isTripped();
      var target = watchdogLatched
        ? 0
        : (window.AudioBypass && window.AudioBypass.isEngaged()) ? 0 : 1.0;
      rampGateTo(gate, target, audioContext);
    }, FADE_S * 1000 + 5);
  }

  window.AudioGraph = {
    registerNodeType: registerNodeType,
    getModel: getModel,
    buildGraph: buildGraph,
    getChainGate: getChainGate,
    getNodeInstance: getNodeInstance,
    updateNodeParams: updateNodeParams,
    // MC-4 (host attenuator, RQ-3): read-only access for FEW-3's watchdog
    // tap point and QA; verifyAttenuatorOffline() is the QA-2/MC-6 proof.
    // OUTPUT_CEILING_DBFS / OUTPUT_ATTENUATOR_LINEAR are the single source
    // of truth for the ceiling constant (FEW-3's watchdog derives its
    // ceiling+0.5 dB threshold from them) — treat them as read-only.
    getOutputAttenuator: getOutputAttenuator,
    verifyAttenuatorOffline: verifyAttenuatorOffline,
    OUTPUT_CEILING_DBFS: OUTPUT_CEILING_DBFS,
    OUTPUT_ATTENUATOR_LINEAR: OUTPUT_ATTENUATOR_LINEAR,
  };
})();
