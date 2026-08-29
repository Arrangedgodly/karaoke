# Node-Based Web Audio Chain Builder — Implementation Plan

Source: [town-hall.md](town-hall.md) (approved). This plan covers the **Core MVP** in full bite-sized detail. **Fast-Follow** is sketched at the end as a named later phase, not yet broken down to production-ready granularity.

Status: **Approved.** Research queue resolved and all 6 decisions committed 2026-08-26 (see [research/summary.md](research/summary.md)). Ready for handoff to `$production`.

## Roles / Lanes

| Lane | Prefix | Owns |
|---|---|---|
| Product / UX | `PX` | Layout, interaction design, per-node parameter UX, default content decisions |
| Frontend – Audio Engine | `AE` | Web Audio graph construction, node lifecycle, reconnect logic, bypass routing |
| Frontend – UI/Interaction | `UI` | Drag-and-drop canvas, controls, start/stop, bypass button |
| Frontend – Persistence | `PS` | Serialization, autosave, named presets |
| QA / Reliability | `QA` | Cross-browser validation, soak test, glitch/leak/latency verification |
| Delivery / Setup | `DEL` | Project scaffold, packaging, run instructions |

## Research Queue — RESOLVED, all decisions committed

Full findings: [research/summary.md](research/summary.md) and per-question files under `research/`. All six committed by the user 2026-08-26.

| ID | Question | Blocked | Committed decision |
|---|---|---|---|
| RQ-1 | Live reconnect/rewiring technique (glitch-free, leak-free) | AE-4, AE-5–AE-10, UI-3, QA-1 | Single "chain gate" `GainNode`; duck→splice→un-duck via `AudioParam` ramps; rewire only on drop; reuse node instances |
| RQ-2 | Drag-and-drop: library vs. custom | UI-3 | SortableJS (vanilla JS, `forceFallback:true`), no framework |
| RQ-3 | Reverb impulse-response sourcing/licensing | AE-9 | "IR Rollo Transparent Plate" (Rollo145, Freesound.org, CC0 1.0) — bundled as the public-preview MP3 (`assets/ir/plate-vocal.mp3`), not the login-gated original WAV; see AE-9's production-log entry for the substitution rationale (same CC0 sound, confirmed by user) |
| RQ-4 | Safari-specific quirks | QA-2 (informs), AE-1 (2 new requirements) | See AE-1 and QA-2 task detail below |
| RQ-5 *(Fast-Follow)* | Noise Gate implementation approach | Future Noise Gate task, non-blocking | GO — custom AudioWorklet gate or adapt `@sapphi-red/web-noise-suppressor`; re-sized Small→Small-Medium |
| RQ-6 *(Fast-Follow)* | Autotune feasibility | Future Autotune task, non-blocking | NO-GO for next Fast-Follow pass — demoted to deferred, separately time-boxed future spike, not a scheduled task |

## Task Index (dependency order)

| ID | Task | Owner | Depends on | Status |
|---|---|---|---|---|
| DEL-1 | Project scaffold + static hosting setup | DEL | — | completed |
| PX-1 | Screen layout & visual design (palette, canvas, bypass placement, start/stop) | PX | — | completed |
| PX-2 | Per-node parameter UX (params/ranges/defaults, all 6 node types) | PX | — | completed |
| AE-1 | Mic input + AudioContext bootstrap | AE | DEL-1 | completed |
| AE-2 | Node graph data model + passthrough graph-builder | AE | AE-1 | completed |
| AE-3 | Bypass routing (independent dry path + toggle) | AE | AE-2 | completed |
| UI-1 | Start/Stop control + input device picker | UI | AE-1, PX-1 | completed |
| UI-2 | Bypass control UI | UI | AE-3, PX-1 | completed |
| QA-6 | Bypass independent reliability test | QA | AE-3, UI-2 | completed |
| PX-3 | Default shipped chain order + initial preset content | PX | PX-2 | completed |
| AE-4 | Live reconnect/rewire engine | AE | AE-2 | completed |
| UI-4 | Generic parameter control component | UI | AE-2, PX-2 | completed |
| UI-3 | Drag-and-drop canvas mechanics | UI | AE-4, PX-1 | completed |
| AE-5 | Gain/Trim node factory | AE | AE-4, PX-2 | completed |
| AE-6 | Compressor node factory | AE | AE-4, PX-2 | completed |
| AE-7 | EQ node factory | AE | AE-4, PX-2 | completed |
| AE-8 | Delay node factory | AE | AE-4, PX-2 | completed |
| AE-9 | Reverb node factory | AE | AE-4, PX-2 | completed |
| AE-10 | Limiter node factory | AE | AE-4, PX-2 | completed |
| QA-1 | Reorder glitch/leak test | QA | UI-3, AE-5 (min. one node type) | completed |
| PS-1 | Serialization schema | PS | AE-2 | completed |
| PS-2 | localStorage autosave | PS | PS-1, PX-3, AE-5–AE-10 | completed |
| PS-3 | Named preset save/load UI + storage | PS | PS-2, UI-3, UI-4 | completed |
| QA-5 | Preset round-trip fidelity test | QA | PS-3 | completed |
| QA-2 | Cross-browser functional pass | QA | AE-5–AE-10, UI-3, PS-3 | completed (descoped to Chrome-only, by user decision) |
| QA-3 | Soak test (2–4hr continuous run) | QA | QA-2 | completed (descoped to reasoning-from-QA-1, by user decision — no new test run) |
| QA-4 | Latency measurement & documentation | QA | AE-5–AE-10, UI-3 | completed |
| DEL-2 | Package + host run instructions | DEL | QA-2, QA-3 | completed |

## Milestones

- **M1 — Passthrough proven** (DEL-1, AE-1, AE-2): first audible mic→speaker round trip through the browser, zero effects. Validates the riskiest basic assumptions (permissions, output routing, browser audio stack) before any DnD complexity is added.
- **M2 — Bypass safety net operational** (AE-3, UI-1, UI-2, QA-6): the single most safety-critical feature works and is independently verified reliable, ahead of the harder work.
- **M3 — First effect node end-to-end** (AE-4 + UI-3 unblocked by research, UI-4, one node factory — recommend Gain first as simplest — QA-1 passing for that case): proves the central technical bet (live glitch-free, leak-free reconnect) before scaling to all 6 node types.
- **M4 — All Core MVP effect nodes live** (AE-5–AE-10 complete, each validated by ear).
- **M5 — Persistence complete** (PS-1–PS-3): autosave + named presets working, round-trip verified.
- **M6 — Core MVP release-ready** (QA-2, QA-3, QA-4, QA-5, DEL-2): ready for first real event use.

## Task Detail

### DEL-1 — Project scaffold + static hosting setup
- **Owner / Status:** Delivery / pending
- **Scope:** Enables all other work; no user journey step yet.
- **Input → Output:** Empty directory → runnable static-site skeleton (plain JS or minimal bundler), locally servable.
- **Depends on:** —  **Parallel with:** PX-1, PX-2
- **Files/surfaces:** project root, build config
- **Acceptance criteria:** `index.html` loads in target browsers with no console errors; project runs from a local file path or simple static server (mirrors "locally hosted" event context — confirm no internet dependency assumed).
- **Risks/assumptions:** Assumes no bundler complexity is needed given single-page scope; keep this minimal to protect the "build fast" constraint.
- **Size:** Small

### PX-1 — Screen layout & visual design
- **Owner / Status:** Product/UX / pending
- **Scope:** Journey steps 1–7 (overall screen).
- **Input → Output:** Node set + journey from brief → layout spec (palette position, canvas area, start/stop control, bypass control placement/sizing) covering all identified states (permission states, empty/populated chain, bypass engaged/normal, unsaved-changes indicator).
- **Depends on:** —  **Parallel with:** DEL-1, PX-2
- **Files/surfaces:** design spec (doc or quick mockup), informs all UI-* tasks
- **Acceptance criteria:** Spec covers every state listed in town-hall.md § Important States; Bypass is specified as the single most prominent control on screen (per brief's UX role perspective).
- **Risks/assumptions:** None blocking.
- **Size:** Small

### PX-2 — Per-node parameter UX
- **Owner / Status:** Product/UX / pending
- **Scope:** Feeds AE-5–AE-10 and UI-4.
- **Input → Output:** Node set (Gain, Compressor, EQ, Delay, Reverb, Limiter) → for each, the exposed parameters, their ranges, defaults, and labels (e.g. Compressor: threshold/ratio/attack/release; Delay: time/feedback/mix).
- **Depends on:** —  **Parallel with:** DEL-1, PX-1
- **Files/surfaces:** design spec, consumed as data by AE and UI tasks
- **Acceptance criteria:** Every Core MVP node type has a complete, sane default parameter set that sounds reasonable untouched (important since the host may not tune every node every time).
- **Risks/assumptions:** Domain-accuracy risk from the brief (Reverb IR quality, realistic compressor/limiter defaults) — lean on RQ-3 output for Reverb once available.
- **Size:** Medium (6 node types)

### AE-1 — Mic input + AudioContext bootstrap
- **Owner / Status:** Audio Engine / pending
- **Scope:** Journey steps 1–2.
- **Input → Output:** Mic permission + device list → running `AudioContext` with a live `MediaStreamAudioSourceNode`, gated behind a user-gesture "Start Processing" action.
- **Depends on:** DEL-1  **Parallel with:** PX-1, PX-2
- **Files/surfaces:** audio engine module
- **Acceptance criteria:** Permission prompt appears; device picker lists and correctly switches between available inputs; `audioContext.state` reaches `running` only after the user gesture; raw mic audio is audible when temporarily wired straight to destination for this task's own validation. **Create the `AudioContext` and call `resume()` synchronously inside the "Start" button's click handler itself — before any `await`, including `await getUserMedia()`** (RQ-4: Safari does not treat a resolved `getUserMedia()` promise as a qualifying user gesture, so an `await` in between silently breaks `resume()` on Safari only — passes unnoticed on Chrome/Firefox). **Request `getUserMedia` audio constraints with `{echoCancellation:false, noiseSuppression:false, autoGainControl:false}`** (RQ-4: avoids Safari's non-optional voice-processing pipeline attenuating content above ~10kHz; good practice on all browsers regardless). Create the mic `MediaStreamAudioSourceNode` exactly once per session — never recreate it later (RQ-1: unresolved cross-browser leak/release issue if recreated).
- **Risks/assumptions:** Standard `getUserMedia` behavior otherwise assumed. Two Safari "watch items" from RQ-4 (a possible audio-pipeline glitch/silence bug on sustained playback, possible >10kHz attenuation even with constraints set) are not resolved by research — verified empirically in QA-2/QA-3, not here.
- **Size:** Medium

### AE-2 — Node graph data model + passthrough graph-builder
- **Owner / Status:** Audio Engine / pending
- **Scope:** Establishes the core contract every later task depends on.
- **Input → Output:** none → an ordered in-memory model (`{id, type, params}[]`) decoupled from actual Web Audio node instances, plus a builder function that (re)creates the real node chain from Mic Input through Output given that model. Empty model = direct passthrough.
- **Depends on:** AE-1
- **Files/surfaces:** audio engine module (graph model + builder)
- **Acceptance criteria:** With an empty model, mic audio passes through to output correctly (M1). This is the thin end-to-end slice referenced in the milestone view.
- **Risks/assumptions:** This is the contract UI, PS, and AE-4 all build on — get the shape right before fanning out to consumers.
- **Size:** Medium

### AE-3 — Bypass routing
- **Owner / Status:** Audio Engine / pending
- **Scope:** Journey step 7 (Emergency Bypass) — planned early per its role as the primary reliability safety net.
- **Input → Output:** running graph → an independent "dry" Mic→Output connection that can be toggled on/off without depending on the health of the effect chain.
- **Depends on:** AE-2
- **Files/surfaces:** audio engine module
- **Acceptance criteria:** Toggling bypass reconnects Mic directly to Output near-instantly, regardless of what state the effect chain is in (including a broken/partially-built chain).
- **Risks/assumptions:** Must remain correct even after AE-4/reconnect-engine work lands later — flag as a regression-risk area for QA-6 to re-check once the full chain exists.
- **Size:** Small

### UI-1 — Start/Stop control + input device picker
- **Owner / Status:** UI / pending
- **Scope:** Journey steps 1–2.
- **Input → Output:** AE-1's engine API → visible Start button and device-selector control.
- **Depends on:** AE-1, PX-1
- **Files/surfaces:** UI shell
- **Acceptance criteria:** Matches PX-1 spec; Start button resumes the AudioContext; device picker updates the active input.
- **Size:** Small

### UI-2 — Bypass control UI
- **Owner / Status:** UI / pending
- **Scope:** Journey step 7.
- **Input → Output:** AE-3's toggle API → the most visually prominent control in the app.
- **Depends on:** AE-3, PX-1
- **Files/surfaces:** UI shell
- **Acceptance criteria:** Visually dominant per PX-1; single click/keypress engages/disengages bypass with immediate audible effect.
- **Size:** Small

### QA-6 — Bypass independent reliability test
- **Owner / Status:** QA / pending
- **Scope:** Acceptance criterion #3.
- **Input → Output:** UI-2 built → confirmed test evidence that Bypass works correctly under adverse conditions (mid-chain-build, with a deliberately broken/unusual model state).
- **Depends on:** AE-3, UI-2
- **Acceptance criteria:** Bypass engages correctly in every tested state; documented as the one path independently verified bulletproof, ahead of the rest of the build.
- **Size:** Small

### PX-3 — Default shipped chain order + initial preset content
- **Owner / Status:** Product/UX / pending
- **Scope:** Feeds PS-2 (autosave needs a default when nothing is saved yet).
- **Input → Output:** PX-2's node/param specs → a concrete recommended default chain (e.g. Input→Compressor→EQ→Reverb→Delay→Limiter→Output) and at least one named starter preset.
- **Depends on:** PX-2
- **Acceptance criteria:** A first-run user (no saved state) gets a sensible, ready-to-use chain rather than an empty canvas.
- **Size:** Small

### AE-4 — Live reconnect/rewire engine
- **Owner / Status:** Audio Engine / pending
- **Scope:** The project's central technical risk, named in the original idea.
- **Input → Output:** An updated ordered node-model (post drag reorder/add/remove) → the actual Web Audio graph rewired to match, with no audible click/pop and no leaked node references.
- **Depends on:** AE-2
- **Committed design (RQ-1, [research/rq1-audio-graph-reconnect.md](research/rq1-audio-graph-reconnect.md)):** One dedicated "chain gate" `GainNode`, created once at session start, positioned as the last node before `destination`. Every insert/remove/reorder: `cancelScheduledValues` → anchor with `setValueAtTime` → `linearRampToValueAtTime(0.0001, ~15ms)` to duck → perform graph surgery (connect new edges before disconnecting stale ones, exploiting native fan-out) → drop references/listeners for any removed node → `cancelScheduledValues` → anchor → `linearRampToValueAtTime(1.0, ~15ms)` to un-duck. `rewireChain()` is the *only* code path allowed to call `connect()`/`disconnect()` on chain nodes. Maintain a single source-of-truth edge list; guard every `disconnect()` in try/catch (throws `InvalidAccessError` on an already-disconnected pair).
- **Acceptance criteria:** Matches acceptance criterion #2 exactly — verified by QA-1. Recommend a brief empirical listening-test pass (a few dozen rapid reorders on real hardware) during implementation before treating the design as fully validated (research confidence is Medium-High on the composed recipe, High on each individual technique).
- **Risks/assumptions:** Compressor/Limiter detector state could show a brief pumping artifact if a node is recreated rather than reordered — mitigated by the reuse-not-recreate rule in AE-5–AE-10. Fade duration (15-20ms default) is a tuning parameter to validate on real output hardware, not a proven constant.
- **Size:** Split-required (this is deliberately the smallest possible slice of "make reconnection work," not bundled with any specific node type)

### UI-3 — Drag-and-drop canvas mechanics
- **Owner / Status:** UI / pending
- **Scope:** Journey steps 3–4.
- **Input → Output:** Node palette + AE-4's rewire API → working drag-to-add and drag-to-reorder canvas, calling AE-4 on every change.
- **Depends on:** AE-4, PX-1
- **Committed approach (RQ-2, [research/rq2-drag-and-drop.md](research/rq2-drag-and-drop.md)):** SortableJS (vanilla JS/npm, no framework), `forceFallback: true` on all instances (avoids native-HTML5-DnD ghost-image/cursor/scroll quirks). Two connected instances: a `group`-linked pull-clone palette list (Gain/Compressor/EQ/Delay/Reverb/Limiter) and a sortable chain list. Implement an `onAdd` handler to replace the cloned palette DOM node with a real, stateful chain-node component. Wire `onSort`/`onEnd` to write the resulting order into the JS array that is the single source of truth for the audio graph — **call `AE-4.rewireChain()` exactly once, from that callback, never during drag-move.** No Web Audio calls during `pointermove`/`dragover` — visual-only feedback (CSS transform, placeholder) until drop.
- **Acceptance criteria:** Dragging a node from the palette adds it to the chain; dragging within the chain reorders it; every change reflects live in the audio graph with no glitch (validated jointly with QA-1).
- **Risks/assumptions:** Adds one ~18KB gzipped, zero-dependency, MIT-licensed npm package to DEL-1's scaffold — does not require a framework. Low integration risk (Medium-High confidence per research) — mapping SortableJS's DOM order onto the JS data model needs one clear single source of truth (the JS array, not the DOM).
- **Size:** Split-required (this task is deliberately DnD-mechanics-only; per-node-type visuals are covered under each AE-5–AE-10 task's "register node type" step)

### UI-4 — Generic parameter control component
- **Owner / Status:** UI / pending
- **Scope:** Reusable across all 6 node types.
- **Input → Output:** PX-2's param specs + AE-2's model → a data-driven slider/knob component bound to a node's params, updating the model (and live `AudioParam`s) on change.
- **Depends on:** AE-2, PX-2
- **Acceptance criteria:** One component correctly renders and drives controls for every node type's param spec without per-type UI code.
- **Size:** Medium

All six factories below share a committed lifecycle rule from RQ-1: **create a node exactly once per user-added instance, only on explicit add — a pure reorder must never call the factory again for a node that already exists.** Explicit remove = explicit dispose (disconnect, delete from registry, detach listeners). This preserves Compressor/Limiter detector state and avoids re-decoding the Reverb IR on every drag.

### AE-5 — Gain/Trim node factory
- **Owner / Status:** Audio Engine / pending
- **Input → Output:** PX-2 spec → `GainNode` factory + param mapping, registered into the shared node-type registry (palette entry, param spec, factory) consumed by UI-3/UI-4.
- **Depends on:** AE-4, PX-2
- **Acceptance criteria:** Adjusting gain audibly changes level in real time; validated by ear against expected dB range.
- **Size:** Small — recommended as the **first** node type built (simplest), to prove the end-to-end pattern for M3 before the rest.

### AE-6 — Compressor node factory
- **Owner / Status:** Audio Engine / pending
- **Input → Output:** PX-2 spec → `DynamicsCompressorNode` factory + param mapping (threshold/ratio/attack/release), registered into the node-type registry.
- **Depends on:** AE-4, PX-2
- **Acceptance criteria:** Adjusting each param audibly changes compression behavior as expected.
- **Size:** Small

### AE-7 — EQ node factory
- **Owner / Status:** Audio Engine / pending
- **Input → Output:** PX-2 spec → `BiquadFilterNode`-based EQ factory + param mapping, registered into the node-type registry.
- **Depends on:** AE-4, PX-2
- **Acceptance criteria:** Frequency/gain adjustments audibly shape tone as expected.
- **Size:** Small

### AE-8 — Delay node factory
- **Owner / Status:** Audio Engine / pending
- **Input → Output:** PX-2 spec → `DelayNode` + feedback loop + wet/dry mix factory, registered into the node-type registry.
- **Depends on:** AE-4, PX-2
- **Acceptance criteria:** Time/feedback/mix params behave correctly and audibly; no runaway feedback at max settings (safety-check as part of validation).
- **Size:** Small

### AE-9 — Reverb node factory
- **Owner / Status:** Audio Engine / pending
- **Input → Output:** PX-2 spec + the committed IR asset → `ConvolverNode` factory + wet/dry mix, registered into the node-type registry.
- **Depends on:** AE-4, PX-2
- **Committed asset (RQ-3, [research/rq3-reverb-impulse-response.md](research/rq3-reverb-impulse-response.md)):** Bundle "IR Rollo Transparent Plate.wav" (Rollo145, freesound.org/people/Rollo145/sounds/322387/, CC0 1.0, 48kHz/24-bit stereo WAV, 284.9KB). Download requires a free Freesound login (one-time manual step). No format conversion needed — `decodeAudioData()` handles WAV natively and the Web Audio API auto-resamples to the live context's sample rate. Store as a static asset (e.g. `/assets/ir/plate-vocal.wav`), fetched + decoded into `ConvolverNode.buffer`. No attribution legally required (CC0) but an optional credits line is good practice.
- **Acceptance criteria:** Sounds like a plausible room/plate reverb, not obviously synthetic or mismatched (domain-accuracy check from the brief) — do a quick listening pass on the bundled file before finalizing.
- **Size:** Small

### AE-10 — Limiter node factory
- **Owner / Status:** Audio Engine / pending
- **Input → Output:** PX-2 spec → a second `DynamicsCompressorNode` tuned as a fast-attack, high-ratio brickwall limiter, registered into the node-type registry.
- **Depends on:** AE-4, PX-2
- **Acceptance criteria:** Effectively prevents clipping/spikes at the output stage under hot input signals.
- **Size:** Small

### QA-1 — Reorder glitch/leak test
- **Owner / Status:** QA / pending
- **Scope:** Acceptance criterion #2, directly validates AE-4.
- **Input → Output:** Working reorder mechanism (UI-3 + at least AE-5) → documented test run of many reorder operations, checked by ear for clicks/pops and by node-count/heap inspection for leaks.
- **Depends on:** UI-3, AE-5 (minimum one node type; re-run informally as more node types land)
- **Committed test protocol (RQ-1):** Perform dozens-to-hundreds of rapid reorder/insert/remove operations in one session (simulating a multi-hour show's worth of host fiddling) while monitoring `performance.memory` / DevTools' WebAudio panel / manual node-count tracking, confirming no orphaned-node growth and no audible degradation late in the run.
- **Acceptance criteria:** Zero audible glitches and zero leaked node references across a sustained sequence of reorder operations.
- **Size:** Medium

### PS-1 — Serialization schema
- **Owner / Status:** Persistence / pending
- **Input → Output:** AE-2's model shape → a versioned JSON schema for a saved chain (nodes, order, params).
- **Depends on:** AE-2
- **Acceptance criteria:** Schema round-trips the in-memory model losslessly.
- **Size:** Small

### PS-2 — localStorage autosave
- **Owner / Status:** Persistence / pending
- **Input → Output:** PS-1 schema + PX-3 default → auto-save on every model change, auto-load on page init, falling back to the PX-3 default chain when nothing is saved.
- **Depends on:** PS-1, PX-3, AE-5–AE-10 (needs the full node-type registry to load arbitrary saved chains correctly)
- **Acceptance criteria:** Reloading the page restores the exact prior chain; a fresh browser/profile gets the PX-3 default instead of an empty canvas.
- **Size:** Small

### PS-3 — Named preset save/load UI + storage
- **Owner / Status:** Persistence / pending
- **Input → Output:** PS-2's storage layer → UI to save the current chain as a named preset, list saved presets, and load one.
- **Depends on:** PS-2, UI-3, UI-4
- **Acceptance criteria:** Saving, listing, and loading named presets all work correctly; loading a preset fully replaces the live chain via AE-4.
- **Size:** Medium

### QA-5 — Preset round-trip fidelity test
- **Owner / Status:** QA / pending
- **Scope:** Acceptance criterion #7.
- **Input → Output:** PS-3 → documented verification that saved/loaded presets (and autosave) reconstruct identical node graphs and parameter values.
- **Depends on:** PS-3
- **Size:** Small

### QA-2 — Cross-browser functional pass
- **Owner / Status:** QA / pending
- **Scope:** Acceptance criterion #5.
- **Input → Output:** Feature-complete Core MVP → pass/fail + known-issues report across Chrome, Edge, Firefox (full bar) and Safari (core-functionality bar).
- **Depends on:** AE-5–AE-10, UI-3, PS-3
- **Committed Safari checklist (RQ-4, [research/rq4-safari-web-audio-quirks.md](research/rq4-safari-web-audio-quirks.md)):**
  1. Confirm `resume()` fires synchronously in the Start click handler and audio is actually audible on Safari (verifies AE-1's requirement).
  2. Confirm mic permission + `getUserMedia()` succeed without relying on the Permissions API (unsupported in Safari for mic).
  3. **Watch item — escalates if reproduced:** with the chain bypassed, feed full-spectrum audio through Safari and check for content loss above ~10kHz despite AE-1's constraints. If reproduced, escalate from known-issue to must-fix and re-open AE-1.
  4. **Watch item — escalates if reproduced:** run the full chain including the Reverb `ConvolverNode` continuously for 15–30+ minutes on Safari, listening for progressive delay/stutter/silence. If reproduced, this is a functionality-breaking finding ("hearing effects" fails), not just a known issue.
  5. Guard any use of `audioContext.outputLatency` with a feature check (Safari support only since 18.4).
  6. If a device picker exists, call `getUserMedia()` before `enumerateDevices()` so labels populate on Safari (and Chrome).
  7. Sanity-check node reordering and Emergency Bypass on Safari — no Safari-specific risk was identified for these, include as a basic check only.
- **Acceptance criteria:** Chrome/Edge/Firefox pass full functional + stability checks; Safari passes core functionality (mic in, hear effects, reorder, bypass) with any gaps documented, not blocking — **except** items 3 and 4 above, which are must-fix if reproduced, not documentable-as-known-issue.
- **Size:** Medium

### QA-3 — Soak test
- **Owner / Status:** QA / pending
- **Scope:** Acceptance criterion #4.
- **Input → Output:** Passing QA-2 build → one continuous 2–4 hour run, monitored for memory growth and crashes, documented result.
- **Depends on:** QA-2
- **Acceptance criteria:** No crash, no unbounded memory growth, over the full run.
- **Size:** Medium (mostly elapsed time, light active effort)

### QA-4 — Latency measurement & documentation
- **Owner / Status:** QA / pending
- **Scope:** Acceptance criterion #6.
- **Input → Output:** Feature-complete build on real event hardware → measured mic-in-to-speaker-out round-trip latency, documented (not gated).
- **Depends on:** AE-5–AE-10, UI-3
- **Acceptance criteria:** A real, honest latency number is recorded and shared, ideally measured on the actual laptop/interface used at events.
- **Size:** Small

### DEL-2 — Package + host run instructions
- **Owner / Status:** Delivery / pending
- **Input → Output:** QA-passed build → a packaged/deployed static app plus plain-language run instructions for the non-technical host (brother) to launch it on event night.
- **Depends on:** QA-2, QA-3
- **Acceptance criteria:** Host can start the app and reach a working state without developer assistance.
- **Size:** Small

## Fast-Follow (Phase 2 — sketch only, not yet task-broken)

Sequenced strictly after Core MVP milestone M6. To be planned in detail in a future `plan-it-out` pass:
- **Noise Gate node** — GO (RQ-5, committed). Build a custom `AudioWorkletProcessor` (RMS/peak envelope + threshold + attack/release + hysteresis) or adapt `@sapphi-red/web-noise-suppressor`'s `NoiseGateWorkletNode` (MIT, actively maintained) — decide build-vs-adapt via a quick prototype-and-listen comparison when this phase is planned. Re-sized **Small-to-Medium** (more than the native-node effects, well short of Large). Design note for the future planning pass: `AudioWorklet` requires an async `addModule()` load before the node can be constructed — a different lifecycle than every Core MVP node type; confirm AE-2/AE-4 accommodate one async node-type without rework.
- Distortion node
- Chorus node
- Preset JSON export/import
- Static hosted factory-presets file
- **Autotune — NO-GO for the next Fast-Follow pass** (RQ-6, committed). Building blocks exist (Signalsmith Stretch, MIT, actively maintained, first-party real-time Web Audio support) but "autotune" requires assembling pitch detection + shifting + a key/scale quantizer — sized **Large**, a qualitatively bigger effort than every other node in the app. **Demoted to a deferred, separately time-boxed future spike — not a scheduled Fast-Follow task.** If revisited: prototype Pitchy (pitch detection) + Signalsmith Stretch (shifting), measure actual added latency/CPU on real hardware, and decide productionization only after that measurement — do not schedule as a normal-sized task.

## Handoff

**Proposed build order:** DEL-1 → (PX-1, PX-2 in parallel) → AE-1 → AE-2 (M1) → AE-3 → UI-1, UI-2 (M2) → QA-6 → PX-3 → [deep-research resolves RQ-1–RQ-4] → AE-4 → UI-3, UI-4 → AE-5 (M3) → AE-6…AE-10 (M4) → PS-1…PS-3 (M5) → QA-1, QA-5, QA-2, QA-3, QA-4 → DEL-2 (M6).

**Decisions already fixed by scope (not open for research or re-litigation):** Core MVP node set (Gain, Compressor, EQ, Delay, Reverb, Limiter); host-only operator, no singer-facing controls; live-monitor only, no recording/export; no backend/accounts; desktop-only with tiered browser support; Emergency Bypass as a first-class, earliest-built feature; localStorage autosave + basic named presets in Core MVP.

**Decisions delegated to `$deep-research`:** RQ-1 through RQ-6 — all resolved and committed. See Research Queue table above and [research/summary.md](research/summary.md) for the full decision matrix and evidence.

**Assumptions that would send this back to Town Hall if they change:** the host remains the sole UI operator; live-monitor-only remains the output model (no recording); desktop-only remains sufficient (no mobile requirement emerges); and that "accept latency as a known limitation" holds up once QA-4 produces a real measured number — if real-event testing shows the latency is actually unusable, that reopens the "processed audio drives the room directly" decision itself, which is a Town Hall-level call, not an implementation detail.

**Approval needed to proceed:** sign-off on this task breakdown, sizing, critical path, and the RQ-1–RQ-6 research queue as a whole. Once approved, hand off to `$deep-research`.
