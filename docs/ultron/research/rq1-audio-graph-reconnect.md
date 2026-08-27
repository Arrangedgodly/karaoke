# RQ-1: Live Audio Graph Reconnect/Rewire Technique (Click-Free, Leak-Free)

## Question

What reconnect/rewiring technique lets the app insert, remove, and reorder Web Audio nodes in a **live** signal chain — while audio is actively flowing through it, as the user drags nodes around on screen — without producing audible clicks/pops ("zipper noise") and without leaking disconnected `AudioNode` references (memory growth) over a multi-hour session?

**Affected task IDs:** AE-4 ("Live reconnect/rewire engine") — P0, critical path — and transitively AE-5 through AE-10 (individual node factories: Gain, Compressor, EQ, Delay, Reverb, Limiter), UI-3 (drag-and-drop canvas mechanics), and QA-1 (validation/QA pass).

---

## Constraints & evaluation criteria

- **Glitch-free**: no audible click, pop, or zipper artifact at the moment of insert/remove/reorder, on Chrome/Edge/Firefox (full support bar) and at least core functionality on Safari.
- **Leak-free over hours**: the app runs continuously for multi-hour live events; any per-edit memory growth (orphaned `AudioNode`s, unbounded `AudioParam` automation event lists, retained closures) must not accumulate into a crash or glitch by hour 3+.
- **No physical fallback**: processed audio drives the PA directly. There is no "just switch to the raw mic" safety net if the graph momentarily produces silence or a bad artifact — every rewire is a live, on-air edit. This raises the stakes of getting the ordering/atomicity of the rewire right versus a studio tool where a glitch is merely annoying.
- **Build-fast constraint**: prefer well-supported, low-complexity native Web Audio API techniques over custom DSP (e.g. AudioWorklet-based crossfading) when the simpler approach is close enough in quality.
- **Continuous operation**: the technique must not degrade in performance or correctness after hundreds of rewires in one session (a host reordering/tweaking the chain repeatedly across a multi-hour show).

---

## Options considered

### 1. RECOMMENDED — Fixed "socket" gain gate + fade→splice→fade, rewired only on drop

A single dedicated `GainNode` ("chain gate") sits at the one point every signal must pass through before reaching `destination`. Any topology edit ducks that gate to near-silence, performs the `connect()`/`disconnect()` surgery while ducked (connecting new edges before removing old ones, exploiting native fan-out), then ramps back up. Detailed in "Recommendation" below.

- **Why it fits:** Uses only native `AudioParam` automation and `connect()`/`disconnect()` — no custom DSP, no AudioWorklet, no extra dependency. One gate node, not one per chain slot, keeping it simple to build.
- **Cost:** ~10–20 ms of near-silence per edit, imperceptible to a live audience and irrelevant since edits are discrete user actions (drag-and-drop), not continuous automation.

### 2. Alternative — Parallel-chain build-and-crossfade

Build the *entire new* graph (mic source → new node order → a fresh output gain) in parallel with the currently-live graph, silent, then crossfade the two output gains (old→0, new→1) over ~20–50 ms, then tear down the old graph.

- **Pros:** Conceptually simpler in one sense — you never mutate a "live" sub-graph in place, you always assemble a new one from scratch and swap wholesale. Avoids any question of "did I duck the right junction for this edit."
- **Cons:** Doubles node count and CPU momentarily (negligible at this scale — 6 node types); requires a second `MediaStreamAudioSourceNode` (or a `ChannelSplitterNode`/manual fan-out) from the same mic `MediaStream`, which is supported behavior but adds bookkeeping; doubles the surface area for the memory-leak discipline in point 3 below since two full graphs briefly co-exist per edit. Reasonable fallback if the single-gate approach proves fiddly in practice, but it is more moving parts for a chain that only has ~6 node slots, so Option 1 is preferred under the build-fast constraint.

### 3. Rejected — Raw instantaneous `disconnect()`/`connect()`, no gain envelope

Just call `disconnect()`/`connect()` directly on the live signal and rely on the render-quantum boundary (128 samples, ~2.7–2.9 ms) being "too fast to hear."

- **Why rejected:** This confuses *processing latency* with *waveform discontinuity*. The click is not caused by how long the switch takes — it's caused by the sample value jumping abruptly from whatever nonzero amplitude it was at to silence (or vice versa). That jump is a broadband transient regardless of how many microseconds the engine takes to apply it. Confirmed directly by MDN and by Alex Lemangui's dedicated write-up on this exact failure mode (see Evidence). Setting an `AudioParam`'s `.value` directly — or, equivalently, letting a connection snap on/off — is spec-defined as exactly equivalent to `setValueAtTime(value, currentTime)`: an instantaneous step, not a smoothed transition. No modern browser auto-smooths this for you.

### 4. Rejected (over-engineering for this project) — AudioWorklet-based custom mixer/router

Implement all routing and crossfading inside a custom `AudioWorkletProcessor` operating on raw sample buffers.

- **Why rejected:** Technically capable of arbitrary sample-accurate crossfades, but requires a separate worklet module file, async `audioWorklet.addModule()` loading, message-passing for parameter control, and materially more testing surface — directly against the stated build-fast/low-complexity constraint, for a 6-node chain where native `AudioParam` ramps plus native `connect()`/`disconnect()` already solve the problem cleanly. Also adds risk on the Safari "core-functionality-only" bar, where a hand-rolled worklet pipeline is more likely to hit an edge case than composing already-battle-tested native nodes.

---

## Recommendation & rationale

**Use one dedicated "chain gate" `GainNode`, placed immediately before the shared tail of the graph (after the full effect chain, right before `destination`, or before any final safety Limiter if you want the Limiter always active during the fade — placing it at the very last position covers every possible edit anywhere upstream in the chain with a single node).** Every insert/remove/reorder is performed as: duck this one gate → do all the graph surgery for the new order (new edges connected before old ones are torn down, exploiting native multi-output fan-out) → un-duck. Rewiring is triggered only on drag **drop**, never on intermediate drag-move events.

### Why this specific design

- **Why a gain-ramp, not a raw jump:** A "click" is a broadband transient produced by any sudden, large sample-to-sample discontinuity in the signal. This is true whether the discontinuity comes from writing a new `AudioParam` value directly, or from a `disconnect()` that makes a downstream input drop instantly from its current amplitude to zero. Historically this class of artifact was called "zipper noise" specifically for the staircase/buzz produced by naive per-block parameter updates (e.g. old `ScriptProcessorNode` code re-writing `.value` once per callback); the same underlying cause — an un-ramped step — also produces a single audible click for a one-off change like a rewire. The universally recommended mitigation (MDN, the W3C spec's `AudioParam` automation methods, and the dedicated "ugly click" write-up cited below) is: never let a value or a connection that's carrying nonzero signal change abruptly. Always anchor the current value with `setValueAtTime(currentValue, now)` and then move to the new value via `linearRampToValueAtTime`, `exponentialRampToValueAtTime`, or `setTargetAtTime` over a short window (commonly cited figures: ~15 ms time-constant for `setTargetAtTime`, ~30 ms for an exponential ramp down to a small epsilon like `0.0001`, since exponential ramps can't target exactly 0).
- **Why one global gate instead of per-junction gates:** Because it sits downstream of the entire effect chain, ducking it silences the output no matter *where* in the chain the edit happens (start, middle, end), so one node handles every edit case — simpler to build and reason about than instrumenting every possible junction with its own gain node.
- **Why connect-new-before-disconnect-old:** Web Audio natively supports fan-out — one output can feed multiple inputs simultaneously, and calling `connect()` again on an already-connected pair is a harmless no-op, not an error. This means the new routing can be established while the old routing still technically exists, so there is never an instant where a node has literally nowhere to send its signal. This matters less than the gain gate for *audibility* (since the gate is already muting everything during the edit) but it avoids relying on exact ordering/timing of multiple `disconnect()` calls to avoid a transient dead end, and it's the same "sockets don't move, only the wires between them do" pattern found in real pedalboard-style libraries (see Evidence).
- **Why rewire only on drop, not on every drag-move:** Two independent reasons converge on the same answer. (a) Correctness/UX: a drag is provisional — the user may pass over several slots before releasing — so committing real audio-graph surgery per intermediate position does unnecessary work for a result that's likely to be superseded within milliseconds, and each edit carries a (small but nonzero) click-risk window even with fades. (b) Performance: most engines re-run graph-ordering/topology-sort work when the graph's connections change (Firefox/Gecko specifically optimizes to only do this when topology actually changed; other engines were noted to re-traverse every render quantum regardless), so firing this dozens of times per second during a fast drag is wasted work for no user-visible benefit. Standard practice — confirmed by this project's own UI-3 drag-and-drop research (`rq2-drag-and-drop.md`), which settles on a library-driven drag mechanic with reordering committed on drop — is to keep all drag-move handling purely visual/DOM (CSS transform, placeholder highlighting) and touch the Web Audio graph exactly once, in the drop/`onEnd` handler.

### Concrete sequence (pseudocode)

```js
// Persistent graph shape:
//   micSource -> [node1] -> [node2] -> ... -> [nodeN] -> chainGate -> destination
// chainGate is a GainNode dedicated ONLY to click-free rewiring — never
// touched by any user-facing "master volume" control, so its steady-state
// target is always a known constant (1.0).

const FADE_S = 0.015; // 15ms; tune 10-20ms empirically during prototyping

function rewireChain(newOrderedNodes) {
  const ctx = audioContext;
  const gate = chainGate.gain;
  const now = ctx.currentTime;

  // 1. Duck the single shared junction — covers an edit anywhere upstream.
  gate.cancelScheduledValues(now);          // prevent event-list buildup
  gate.setValueAtTime(gate.value, now);     // anchor current value (no jump)
  gate.linearRampToValueAtTime(0.0001, now + FADE_S);

  // 2. Perform graph surgery once the duck has had time to reach silence.
  setTimeout(() => {
    // Connect new edges first (fan-out makes this safe/idempotent),
    // then disconnect edges that no longer exist.
    let prev = micSource;
    for (const node of newOrderedNodes) {
      prev.connect(node);
      prev = node;
    }
    prev.connect(chainGate);

    for (const { from, to } of edgesNoLongerNeeded(currentEdges, newOrderedNodes)) {
      try { from.disconnect(to); } catch (e) { /* already gone */ }
    }
    currentEdges = edgesFor(newOrderedNodes);

    // 3. Drop references to any node removed from the chain (see leak
    //    pattern below) so it becomes GC-eligible.
    for (const removed of nodesRemovedFrom(previousNodes, newOrderedNodes)) {
      removed.disconnect();
      nodeRegistry.delete(removed.id);
      detachUiListeners(removed);
    }
    previousNodes = newOrderedNodes;

    // 4. Un-duck.
    const now2 = ctx.currentTime;
    gate.cancelScheduledValues(now2);
    gate.setValueAtTime(gate.value, now2);
    gate.linearRampToValueAtTime(1.0, now2 + FADE_S);
  }, FADE_S * 1000 + 5); // small safety margin past the scheduled ramp
}

// UI-3 integration:
// - pointermove/dragover: DOM-only reordering, zero Web Audio calls.
// - drop/dragend: compute newOrderedNodes from final order, call
//   rewireChain(newOrderedNodes) exactly once.
```

### Memory-leak-free cleanup pattern

- **Never retain a JS reference to a node after it's removed from the chain.** Per the Web Audio spec discussion of `AudioNode` lifetime (WebAudio/web-audio-api#1471), a node with no outstanding JS references and no pending audio work (no tail, not an active source) is GC-eligible — but holding it in an undo stack, a closure/event-listener, or a stale UI-to-node lookup map keeps it alive indefinitely (the general "lapsed listener" anti-pattern). AE-4's cleanup step must: call `disconnect()` on it, delete it from every registry/map, remove any listeners bound to it, and null local references.
- **Never recreate the persistent mic source node.** `MediaStreamAudioSourceNode` has an open, unresolved spec issue (WebAudio/web-audio-api#2484) where disconnecting/stopping tracks does not reliably release the node in some engines. Sidestep this entirely: create the mic source **once** per session at app start and never tear it down or recreate it; only rewire nodes *downstream* of it.
- **Don't re-schedule `AudioParam` ramps without clearing old ones first.** Per Paul Adenot's (Web Audio spec editor / Firefox implementer) performance notes, an `AudioParam`'s internal automation event list can grow unboundedly if you keep adding events without cancelling old ones, and "scanning through the list starts to take a non-trivial amount of time" — directly relevant to a multi-hour show where the host might rewire the chain hundreds of times. Always call `cancelScheduledValues(now)` immediately before scheduling a new ramp from the live value (done in the pseudocode above).
- **Nodes with tail-time (DelayNode, ConvolverNode for reverb) are not actually leaking** — per the same implementation notes, the engine keeps such a node processing internally until its buffered tail finishes even after `disconnect()`, then releases it. This is expected, self-resolving behavior as long as you've also dropped your own JS reference to it — you do not need to manually wait for the tail before dereferencing.
- **Reuse node instances across reorders; only create/destroy on explicit add/remove.** A rewire that only changes *order* should never call a node factory again for nodes that already exist — see Implementation consequences for AE-5–AE-10 below.

---

## Evidence

- [MDN — `AudioParam`](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam) — full list of automation methods (`setValueAtTime`, `linearRampToValueAtTime`, `exponentialRampToValueAtTime`, `setTargetAtTime`, `setValueCurveAtTime`, `cancelScheduledValues`, `cancelAndHoldAtTime`); establishes the standard toolkit for smooth parameter changes.
- [MDN — `AudioParam.value`](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/value) and [Chromium Intent to Ship: "WebAudio: AudioParam Setter is setValueAtTime"](https://groups.google.com/a/chromium.org/g/blink-dev/c/y4s3-aXbMOw/m/9s34pPQVBgAJ) / [Firefox bug 1308435](https://bugzilla.mozilla.org/show_bug.cgi?id=1308435) — establish that direct `.value =` assignment is spec-standardized to be exactly equivalent to `setValueAtTime(value, currentTime)` — an instantaneous step, with no automatic browser-side smoothing to rely on. This is the core fact underpinning "why abrupt changes click."
- [Alex Lemangui — "Web Audio: the ugly click and the human ear"](http://alemangui.github.io/ramp-to-value) — a focused write-up specifically on this failure mode; explains the discontinuity mechanism and recommends `setTargetAtTime(0, now, 0.015)` (15ms time constant) or `setValueAtTime` + `exponentialRampToValueAtTime(0.0001, now + 0.03)` (30ms) as concrete, field-tested fade windows. Source for the specific millisecond figures used in the recommendation above.
- [MDN — `AudioNode.connect()`](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/connect) — confirms fan-out is native (one output to many inputs via repeated `connect()` calls) and that reconnecting an already-connected pair is silently ignored, not an error — the basis for the "connect new before disconnect old" ordering.
- [MDN — `AudioNode.disconnect()`](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/disconnect) — documents all disconnect overloads (whole-node, by output index, by destination node/param, by output+input) and that `InvalidAccessError` is thrown if called on a pair that isn't connected — informs defensive `try/catch` around disconnects in the pseudocode.
- [W3C — Web Audio API spec](https://www.w3.org/TR/webaudio/) — the current Recommendation-track spec; §"AudioNode Lifetime" and the `AudioParam` automation sections are the normative basis for everything above. No changes found in 2025–2026 searches that alter this guidance — `connect()`/`disconnect()` fundamentals and the automation methods have been Baseline-stable (widely available since ~2015) for a decade; this is confirmed by the absence of any relevant recent spec-change discussion turned up in search.
- [GitHub WebAudio/web-audio-api#1471 — "AudioNode Lifetime section seems to attempt to make garbage collection observable"](https://github.com/WebAudio/web-audio-api/issues/1471) — spec-editor-level discussion of exactly when/why an `AudioNode` becomes GC-eligible; basis for "drop every reference, including closures and registries" as the correct cleanup discipline.
- [GitHub WebAudio/web-audio-api#2484 — "MediaStreamAudioSourceNode memory leak, OR no way to destroy node"](https://github.com/WebAudio/web-audio-api/issues/2484) — open issue documenting that disconnect + stop-tracks does not reliably free this specific node type in some engines; basis for the "create the mic source once, never recreate it" recommendation.
- [GitHub WebAudio/web-audio-api#904 — "AudioNode stop / disconnect doesn't free memory"](https://github.com/WebAudio/web-audio-api/issues/904) — a second, independent report of the same broad class of node-lifetime/memory concern; corroborates treating explicit dereferencing (not just `disconnect()`/`stop()`) as necessary.
- [Paul Adenot — Web Audio API performance and debugging notes](https://padenot.github.io/web-audio-perf/) — written by a Web Audio spec editor/Firefox audio engine implementer. Establishes: (a) graph topology recomputation cost differs by engine but is triggered by connection changes, informing "don't rewire on every drag-move"; (b) `AudioParam` automation event lists can grow and slow down over a long-running session if not periodically cleared via `cancelScheduledValues`, directly relevant to this app's multi-hour requirement; (c) tail-time nodes (Delay/Convolver) are deliberately kept alive by the engine until their buffered output finishes, which is expected behavior, not a leak.
- [web.dev — "A tale of two clocks" (Chris Wilson, W3C Web Audio spec editor)](https://web.dev/articles/audio-scheduling) — establishes the general lookahead-scheduling discipline (don't drive audio timing off `setTimeout` alone; schedule against `AudioContext.currentTime`) that reinforces why the rewire's fade timing should be anchored to the audio clock (`ctx.currentTime`) rather than assumed from wall-clock `setTimeout` alone.
- [Tone.js docs — `dispose()` pattern](https://tonejs.github.io/docs/15.0.4/classes/Channel.html) and [Tonejs/Tone.js#43 — "Why disconnect sources only on dispose?"](https://github.com/Tonejs/Tone.js/issues/43) — real-world prior art: Tone.js's documented convention is that stopping playback and freeing a node's underlying Web Audio resources are two separate, deliberate concerns — `dispose()` explicitly disconnects everything and frees it for GC, and is never implicit on `stop()`. This validates treating node teardown as an explicit step in AE-4 rather than something that "just happens" when a node stops being audible.
- [dashersw/pedalboard.js](https://github.com/dashersw/pedalboard.js) — an open-source Web Audio guitar-pedal chain library. Its `Board`/`Box` architecture wraps every pedal in fixed input/output buffer nodes and wires pedals together via those buffers rather than rewiring each effect's internals directly — the same "stable sockets, only the wires between them move" pattern recommended above, found independently in production code rather than a tutorial.

---

## Tradeoffs, risks, confidence

**Tradeoffs:**
- The single-gate design trades a small, fixed per-edit latency (~2× the fade duration, ~30ms total) for simplicity. This is inaudible/irrelevant for a discrete drag-drop action but would be the wrong choice if the app ever needed continuous, high-frequency graph mutation (it doesn't, per the "rewire on drop only" decision).
- Ducking the *entire* chain output on every edit (rather than only the affected segment) is a deliberate simplicity-over-precision tradeoff: a full-chain duck is coarser than a per-junction duck but requires only one node and no per-junction bookkeeping, matching the build-fast constraint. If future requirements demand truly gapless (zero attenuation anywhere) editing, a per-junction gate design (more nodes, more bookkeeping) would be the fallback — see Option 2.

**Risks:**
- **Compressor/Limiter envelope discontinuity:** `DynamicsCompressorNode` maintains internal attack/release detector state. Splicing a *freshly created* compressor/limiter into a live chain means its detector starts from an idle/default state, which could theoretically produce a brief pumping artifact distinct from a click. This is naturally covered by the recommended pattern since insertion happens under the same gain duck as any other edit — but it reinforces the reuse-not-recreate rule below for AE-5–AE-10 (only reordering an *existing* compressor's position preserves its state cleanly).
- **Exact fade duration is a tuning parameter, not a proven constant.** 10–20 ms is well-supported by the cited sources as a safe default, but should be validated empirically on real hardware/output devices during AE-4 prototyping (some audio interfaces/Bluetooth PA links add their own latency/buffering that could interact with very short fades) rather than treated as final.
- **No single source documents this exact end-to-end recipe.** Every individual ingredient (AudioParam ramping, fan-out-based connect-before-disconnect, explicit dispose, fixed-socket architecture) is independently well-established in primary sources or real production code, but the composed "duck-splice-unduck, gated to drop only" sequence is a synthesis for this project's specific constraint (continuous live, no-fallback audio) rather than a copy of one canonical tutorial — because most Web Audio tutorials and DAW-style tools rewire while a transport is stopped or between discrete musical events, not while an unstoppable live line is flowing.

**Confidence: Medium-High overall** — **High** confidence on the individual mitigation techniques (AudioParam ramping to avoid clicks, explicit disconnect+dereference to avoid leaks, avoiding `MediaStreamAudioSourceNode` recreation) since these are corroborated by MDN, the W3C spec, browser-vendor implementation notes, and independent production libraries. **Medium-High** confidence on the specific composed recipe (single global gate, connect-before-disconnect, rewire-on-drop) since it is a well-grounded synthesis rather than a verbatim industry-standard tutorial — recommend a short empirical listening-test pass during AE-4 implementation (a few dozen rapid reorders while monitoring output on real speakers/headphones) to confirm no audible artifact before treating it as validated.

---

## Implementation consequences

**For AE-4 (Live reconnect/rewire engine):**
- Implement exactly one dedicated `chainGate` `GainNode`, created once at session start, positioned as the last node before `destination` (after any final Limiter). Its steady-state value is always `1.0`; nothing else should ever set its gain except the rewire routine.
- Implement `rewireChain(newOrderedNodes)` as the *only* code path allowed to call `connect()`/`disconnect()` on chain nodes. All insert/remove/reorder operations funnel through it.
- Every call must: `cancelScheduledValues` → anchor with `setValueAtTime` → ramp down → (after ~fade duration) perform surgery (connect new edges before disconnecting stale ones) → drop references/listeners for any removed node → `cancelScheduledValues` → anchor → ramp back up to `1.0`.
- Maintain a single source of truth for "current edge list" so `edgesNoLongerNeeded`/`edgesFor` can be computed by diffing old vs. new order, rather than blindly disconnecting everything and rebuilding (blind rebuild is simpler code but means every edit — even moving one node one slot — touches every edge in the chain; diffing is a reasonable refinement but not a correctness requirement).
- Guard every `disconnect()` call in a `try/catch` (or check the edge list) since disconnecting a non-connected pair throws `InvalidAccessError`.

**For AE-5–AE-10 (Gain, Compressor, EQ, Delay, Reverb, Limiter node factories):**
- **Factories create a node exactly once per user-added instance, and only on explicit add.** A pure reorder (drag to a new position) must never call a factory again for a node that already exists — it only changes what it's connected to. This preserves compressor/limiter detector state and avoids needless reverb impulse-response re-decoding across reorders.
- **Explicit remove = explicit dispose.** When the user deletes a node from the canvas (not just reorders it), the factory layer must be the one place that both creates and tears down a given node type, mirroring Tone.js's explicit-`dispose()` discipline: disconnect, delete from any registry, detach UI-bound listeners, null references. Do not keep "for later reuse" caches of live, disconnected node instances (undo should store serializable parameter state and re-run the factory on undo, not resurrect an old disconnected `AudioNode`).
- **New-node defaults are non-neutral for some types** (e.g. `DynamicsCompressorNode`'s spec defaults are not audio-transparent — meaningful threshold/ratio out of the box). Because insertion is just another rewire under the same fade-gate, this is already masked at the moment of insertion; no extra handling is required in AE-4, but factories should still choose sensible starting parameter values for a good first impression once the fade completes.

**For UI-3 (drag-and-drop canvas mechanics):**
- **Rewiring must happen only on drop, never on every drag-move event.** During `pointermove`/`dragover`, only update the DOM/visual placeholder position — zero Web Audio API calls. On `drop`/`dragend` (or the equivalent library callback — this project's companion research `rq2-drag-and-drop.md` settles on a library with an `onEnd`-style commit callback), compute the final node order and call `rewireChain()` exactly once. This avoids both the audible risk of rewiring a provisional, likely-to-change position and the performance cost of triggering graph-topology recomputation dozens of times per second during a fast drag.

**For QA-1 (validation/QA pass):**
- Add a specific test: perform dozens-to-hundreds of rapid reorders/inserts/removals in a session (simulating a multi-hour show's worth of host fiddling) while monitoring `performance.memory` / DevTools' WebAudio panel / manual node-count tracking, to confirm no orphaned-node growth and no audible degradation late in the run — this directly targets the "multi-hour session" reliability requirement this technique is chosen to satisfy.

---

## Decision priority/status

- **Priority:** P0
- **Status:** proposed (awaiting user approval — not committed)
