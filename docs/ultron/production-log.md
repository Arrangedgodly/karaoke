# Production Log — Node-Based Web Audio Chain Builder

## DEL-1 — Project scaffold + static hosting setup

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given the task outcome, required approach (no build step, no ES modules, no framework), and acceptance criteria from plan.md; fallback not needed.

**Changed files** (all new, under project root `C:\Users\arran\Documents\Claude\karaoke`):
- `index.html` — page shell, links `styles/main.css`, loads `src/main.js` via a plain (non-module) `<script>` tag
- `styles/main.css` — minimal reset + readable default font, no elaborate styling (deferred to PX-1)
- `src/main.js` — bootstrap stub, logs `"App scaffold loaded"` to console
- `vendor/.gitkeep`, `assets/.gitkeep` — placeholders for later tasks (SortableJS/CDN reference notes, reverb IR file)

**Validation evidence:**
1. Manual review: well-formed HTML5, script tag confirmed non-module, relative paths verified correct.
2. `node --check src/main.js` — passed, no syntax errors.
3. Live execution test: started a local static server (`python -m http.server`), loaded `index.html` in the Browser tool, confirmed via `read_console_messages` the expected `"App scaffold loaded"` log with **zero errors**, and via `get_page_text` that the title and heading render correctly. Server stopped after validation.
4. `file://` direct-open case validated via static review only — the available browser tooling converts local file:// pages to non-executing static snapshots, so live script execution couldn't be directly observed for that path. The underlying claim (non-module scripts execute normally under `file://`, unlike ES modules which are CORS-blocked) is a well-established browser behavior, not a novel claim being tested here.

**Acceptance criteria:**
- ✅ `index.html` loads with no console errors — confirmed live via static server.
- ✅ Runs from a local file path or a simple static server — static server case confirmed live; local file path case confirmed via structural review (no modules, no absolute paths, no fetch calls that would behave differently under file://).

**Deviations:** None from the approved approach.

**Follow-up tasks:** None generated. Next unblocked tasks: PX-1 (Screen layout & visual design) and PX-2 (Per-node parameter UX), both dependency-free and can run in parallel.

**Approval status:** Approved by user. Status set to `completed`.

---

## PX-1 — Screen layout & visual design

- **Status:** awaiting-approval
- **Delegation:** Implemented directly (not delegated) — primarily a design/writing task where the production agent already had the necessary product context from planning; no subagent fallback needed.

**Changed files** (all new, under `docs/ultron/design/`):
- `px1-layout-spec.md` — written layout spec: screen regions (top bar, palette, canvas, presets panel), visual prominence hierarchy (Bypass first), and a state-by-state table covering all 8 states from town-hall.md § Important States.
- `px1-mockup.html` — static visual reference mockup with interactive toggles (not part of the real app) to demonstrate Live/Stopped, empty/populated chain, Bypass engaged/normal, device-disconnect banner, and unsaved-changes indicator states.

**Validation evidence:**
1. Structural check via the Browser tool's accessibility tree and page text — confirmed all expected elements present (top bar controls, 6-node palette including EQ, populated chain canvas, presets panel), no console errors on load.
2. **Interactive test caught a real bug**: all 5 design-reference toggle buttons were exercised via `element.click()` in the page's own JS context, comparing full before/after state. Two buttons ("Toggle Live/Stopped", "Toggle Empty/Populated chain") had a duplicate-wiring bug — an inline `onclick` plus a mismatched `nth-child`-selector `addEventListener` on the *same* element caused a double-toggle that canceled itself out (no visible effect on click). A third handler was attached to the wrong button entirely via an off-by-one `nth-child` index, so "Toggle Device-disconnect banner" silently also toggled the unsaved-changes indicator, while "Toggle Unsaved-changes indicator" itself did nothing.
3. **Fix applied**: removed all inline `onclick` attributes, gave every toggle button a stable `id`, and rewired each via a single `getElementById(...).addEventListener(...)` — one handler per button, no ambiguous selectors.
4. **Re-tested after fix**: clicked all 5 buttons via the page's own JS and diffed full state before/after — all 5 independent boolean flags (running, chain-empty, bypass-engaged, banner-shown, unsaved-shown) flipped exactly once each, no cross-talk, no console errors.

**Acceptance criteria:**
- ✅ Spec covers every state listed in town-hall.md § Important States — all 8 addressed in the state-by-state table.
- ✅ Bypass specified as the single most prominent control — documented as #1 in the prominence hierarchy, given a fixed top-bar position, largest/highest-contrast styling, and a distinct "engaged" visual state; verified working correctly in the mockup.

**Deviations:** None from the task's scope. The mockup (with interactive state toggles) goes slightly beyond a static "quick mockup" as literally described in plan.md, but plan.md's own task detail explicitly allows "doc or quick mockup" — the interactive version was chosen because it made verifying full state coverage possible at all (and caught a real bug in the process), at negligible extra cost for a Small task.

**Follow-up tasks:** None generated beyond what's already in plan.md. Next unblocked task: PX-2 (Per-node parameter UX) — dependency-free.

**Approval status:** Approved by user. Status set to `completed`.

---

## PX-2 — Per-node parameter UX

- **Status:** awaiting-approval
- **Delegation:** Implemented directly — domain-knowledge design task (audio engineering parameter ranges/defaults), same rationale as PX-1.

**Changed files:**
- `docs/ultron/design/px2-node-parameters.md` — full parameter spec for all 6 Core MVP node types (Gain, Compressor, EQ, Delay, Reverb, Limiter): each parameter's id/label/min/max/default/step/unit, plus cross-node implementation notes for AE-5–AE-10 (dB↔linear conversion, equal-power crossfade for mix/feedback controls, `DelayNode.maxDelayTime` construction note).

**Validation evidence:**
1. Every parameter range checked against the underlying native Web Audio node's actual allowed range (`DynamicsCompressorNode` ratio 1-20 native max, `DelayNode` default `maxDelayTime` 1.0s, etc.) — no UI range exceeds what the node natively supports.
2. Every default deliberately chosen against standard audio-engineering practice for gentle, transparent-until-tuned vocal processing (documented rationale per node in the spec) rather than picked arbitrarily — e.g. Compressor ratio defaults to 4:1 (musical) rather than the node's own native 12:1 spec default (which reads as limiting, not compression, for an untouched setting).
3. Cross-checked feedback/mix parameters are capped in a way that structurally prevents runaway (Delay feedback capped at 90%, not 100%) rather than relying on later code discipline.

**Acceptance criteria:**
- ✅ Every Core MVP node type has a complete, sane default parameter set that sounds reasonable untouched — all 6 covered with documented rationale.

**Deviations:** None.

**Follow-up tasks:** None generated. Next unblocked task: AE-1 (Mic input + AudioContext bootstrap) — the last dependency-free task before the critical path proper begins.

**Approval status:** Approved by user. Status set to `completed`.

---

## AE-1 — Mic input + AudioContext bootstrap

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given the task outcome, the three non-negotiable committed-research requirements (RQ-1 node lifecycle, RQ-4 gesture ordering, RQ-4 audio constraints) verbatim, and acceptance criteria; no fallback needed.

**Changed files:**
- `src/audio-engine.js` — new. `window.AudioEngine` namespace (IIFE, non-module): `start()`, `listInputDevices()`, `switchInputDevice(deviceId)`, plus getters for `audioContext`, `sourceNode`, `stream`, `currentDeviceId`, `isStarted`.
- `index.html` — added a clearly-commented temporary test harness (`#ae1-test-harness`: Start button, device `<select>`, status line), explicitly marked for replacement by UI-1. Added the new script tag before `main.js`.
- `src/main.js` — wires the harness to `AudioEngine`; includes a temporary direct mic-to-destination connection for this task's own validation, clearly commented as to-be-replaced by AE-2.

**Validation evidence (independently re-verified, not just taken from the subagent's report):**
1. Read all three changed files myself and traced the click-handler ordering line by line: `new AudioContext()` and `.resume()` both execute in `start()`'s synchronous section (before its first `await`, which is `getUserMedia()`) — confirmed this satisfies RQ-4's gesture-ordering requirement exactly, not just per the subagent's claim.
2. Re-ran `node --check` on both new/changed JS files myself — passed.
3. **Independently reproduced the live browser test** (I did not just trust the subagent's report of this): served the app locally, confirmed via `AudioEngine.audioContext` that no `AudioContext` exists before Start is clicked, clicked Start, and observed: mic access was denied (expected — no real microphone hardware in this sandboxed tool, confirmed by the Browser tool's own note that device capture is blocked here), **but `audioContext.state` was `"running"` regardless** — direct proof `resume()` took effect synchronously within the gesture, independent of whether mic permission succeeded. No unexpected console errors (only the expected `NotAllowedError` from the environment's lack of mic hardware). Confirmed the Start button correctly re-enables after a failed attempt, and status text reflects the failure clearly.
4. `AUDIO_CONSTRAINTS` (`echoCancellation/noiseSuppression/autoGainControl: false`) confirmed applied in both `start()` and `switchInputDevice()`.
5. Device enumeration confirmed gated correctly — `listInputDevices()` is only called after `start()` resolves successfully, matching the "labels are redacted before permission" requirement from RQ-4.

**Residual note (not a blocker, flagging for transparency):** `switchInputDevice()` necessarily creates a fresh `MediaStreamAudioSourceNode` on every device switch — the Web Audio API has no way to repoint an existing source node to a new stream, so this is technically unavoidable, and the code documents it as a deliberate exception to RQ-1's "create once" rule. This means each *manual device switch* (not the routine chain-editing RQ-1 was primarily worried about) carries a small chance of hitting the known unresolved browser bug about `MediaStreamAudioSourceNode` not always releasing cleanly. Given device switching is a rare, occasional action (not exercised hundreds of times per session like chain reordering), this is a low-severity, acceptable residual risk — noting it here rather than treating it as silently resolved.

**What I could NOT validate:** whether raw mic audio is actually audible. This sandboxed environment has no real microphone hardware, so mic permission is denied outright and no real audio path can be exercised end-to-end. **This needs to be confirmed on your own machine**: open the app, click Start, grant mic permission, and confirm you can hear your own voice (likely through headphones to avoid feedback) — the wiring is code-reviewed and structurally correct, but only real hardware can confirm audio is actually flowing.

**Acceptance criteria:**
- ✅ Permission prompt appears (confirmed — `getUserMedia` call fires correctly).
- ✅ Device picker lists/switches inputs correctly (code-reviewed, correctly gated on permission; **not exercisable end-to-end without real hardware**).
- ✅ `audioContext.state` reaches `running` only after the gesture, never automatically (confirmed both by code trace and live reproduction).
- ⚠️ Raw mic audio audible when wired to destination — wiring is correct and reviewed; **actual audibility unconfirmed, needs your hardware**.

**Deviations:** None from the specified requirements. One incidental addition: `start()` throws a descriptive error if `getUserMedia` is unavailable at all (e.g. insecure context) rather than a raw `TypeError`.

**Follow-up tasks:** None generated. Next unblocked task: AE-2 (Node graph data model + passthrough graph-builder), which will replace this task's temporary direct-to-destination wiring.

**Approval status:** Approved by user — confirmed working on real hardware ("it looks like it worked no problem"). Status set to `completed`. **Milestone M1 (Passthrough proven) is now substantively validated** — mic audio audibly reaches output through the browser, on real hardware, with zero effects, confirming the riskiest basic assumptions (permissions, output routing, browser audio stack) ahead of any drag-and-drop complexity.

---

## AE-2 — Node graph data model + passthrough graph-builder

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given the task outcome, the explicit AE-2/AE-4 scope boundary (establish the model+registry contract and a simple tear-down-and-rebuild connector; do NOT add AE-4's glitch-free fade/chain-gate sophistication here), and acceptance criteria; no fallback needed.

**Changed files:**
- `src/audio-graph.js` — new. `window.AudioGraph = { registerNodeType, getModel, buildGraph }`. Ordered `{id, type, params}` model, a `nodeInstances` map (id → live AudioNode), and an empty `nodeFactories` registry that AE-5–AE-10 will populate later. `buildGraph(model)` tears down everything downstream of the mic source and rebuilds from scratch per the model; with an empty model this reduces to `sourceNode.connect(destination)` — the M1 passthrough case. Commits the new model only after a successful rebuild.
- `src/main.js` — removed AE-1's temporary direct `sourceNode.connect(destination)` calls (both in the Start success handler and the device-switch handler); both now call `window.AudioGraph.buildGraph(...)` instead.
- `index.html` — added the `audio-graph.js` script tag.

**Validation evidence (independently re-verified, not just taken from the subagent's report):**
1. Read `audio-graph.js` and the changed parts of `main.js` myself line by line — confirmed the teardown-then-rebuild logic, the registry contract shape, and that `main.js` no longer contains any direct-connect call.
2. Re-ran `node --check` on both changed files myself — passed.
3. **Independently reproduced the synthetic-source test** (not just trusting the subagent's report): in a real browser, created a throwaway `AudioContext` + `OscillatorNode`, temporarily substituted it for `AudioEngine.sourceNode`, instrumented `.connect()` to log every call, and ran `AudioGraph.buildGraph([])`. Result: no exception, **exactly one `connect()` call, to `audioContext.destination`** — direct proof the passthrough wiring is correct, without needing real mic hardware.
4. **Independently reproduced the error-path tests**: an unknown node type throws a clear, correctly-worded error and leaves `getModel()` unchanged (still empty) rather than corrupting state; calling `buildGraph()` before `AudioEngine.start()` has run throws a clear, correctly-worded error rather than a confusing crash.
5. Confirmed a fresh page load shows only the expected `App scaffold loaded` log, no new/unexpected console errors.

**Residual note (not a blocker, flagging for transparency):** if `buildGraph()` is ever called with a non-empty model and a factory throws partway through (unreachable in practice right now, since nothing registers a factory until AE-5+), the mic source is left disconnected from *any* destination — not silently reverted to the previous working chain, since teardown happens before the rebuild loop. This is consistent with this task's explicit scope ("simple tear-down-and-rebuild, not glitch-free — AE-4 wraps this"), but worth AE-4 keeping in mind when it adds the duck/splice/unduck logic, since that's also the natural place to make a failed rebuild fail safe rather than fail silent.

**Acceptance criteria:**
- ✅ With an empty model, mic audio passes through to output correctly (Milestone M1) — verified structurally via the synthetic-source test (exactly one connect call, to destination); real-hardware re-confirmation requested from user below since this replaces AE-1's already-approved working audio path.

**Deviations:** None from scope. Minor additions within stated scope: input-type validation on `buildGraph()`'s `model` argument, and defensive copying in `getModel()`/model-commit so internal state can't be mutated by reference from outside.

**Follow-up tasks:** None generated. Next unblocked task: AE-3 (Bypass routing) — the primary reliability safety net, planned early per its own priority in the brief.

**Approval status:** Approved by user — confirmed working on real hardware ("confirmed audio is coming through properly"). Status set to `completed`.

---

## AE-3 — Bypass routing

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given a fully worked-out architecture (specified in advance, precisely, since this is the app's single most safety-critical feature); no fallback needed.

**A real cross-task bug was found and fixed during design, before implementation:** AE-2's `buildGraph()` did a blanket `sourceNode.disconnect()` on every rebuild. Once Bypass adds its own independent connection off the same `sourceNode`, that blanket disconnect would silently kill the Bypass tap on every future chain edit (e.g. AE-4's drag-and-drop rewiring). Fixed by making `buildGraph()` track and disconnect only the one specific edge it owns (`sourceNode.disconnect(firstChainNode)`), leaving any other connection off `sourceNode` untouched. This is a behavior-preserving correctness fix to AE-2, not a scope change — verified explicitly (see below) that it doesn't alter AE-2's already-approved behavior.

**Changed files:**
- `src/audio-graph.js` — added the `firstChainNode`-based surgical disconnect (see above) and a new shared "chain gate" `GainNode` (`getChainGate()`), sitting right before `destination`. This is the same node the project's committed RQ-1 research design calls for AE-4 to use for glitch-free rewiring — introduced here so AE-4 reuses it rather than creating a duplicate.
- `src/audio-bypass.js` — new. `window.AudioBypass = { reconnectSource, engage, disengage, toggle, isEngaged }`. An independent `bypassGain` node tapped directly off `sourceNode`, ramped opposite to the chain gate (5ms click-avoiding ramps) on engage/disengage.
- `src/main.js` — calls `AudioBypass.reconnectSource()` after both `AudioEngine.start()` and `switchInputDevice()` (parallel to why `buildGraph()` needs recalling at those points); wires a temporary Bypass toggle button.
- `index.html` — added the bypass script tag and a temporary, clearly-commented Bypass test button.

**Validation evidence (independently re-verified, not just taken from the subagent's report):**
1. Read all changed/new files myself — confirmed the surgical-disconnect fix, the chain-gate design, and the bypass tap's complete independence from anything `buildGraph()` touches.
2. Re-ran `node --check` on all four files myself — passed.
3. **Independently reproduced the core correctness tests** (not trusting the subagent's report alone): using a synthetic oscillator standing in for the mic, I (a) built an empty chain + established the bypass tap, (b) **deliberately broke the chain** by calling `buildGraph()` with an unregistered node type (confirmed it threw as expected), (c) called `AudioBypass.engage()` against that broken chain — no exception, `isEngaged()` correctly flipped to `true`, (d) **investigated the one non-obvious observation from the subagent's report myself**: `chainGate.gain.value` read `1` (not the expected `0`) immediately after engaging, while the chain was disconnected. Traced this to a real, benign browser behavior: a `GainNode` with no active input doesn't re-render its `AudioParam` value in real time — and it's audibly irrelevant regardless, since silence-in produces silence-out no matter what the gain value reads. Proved this is safe, not a bug, by then healing the chain (`buildGraph([])` again) and confirming `chainGate.gain.value` **immediately resolved to `0`** — proof the ramp was correctly scheduled the entire time, and critically, that the chain doesn't come back at unexpected full volume if it self-heals while bypass is still engaged.
4. Confirmed `disengage()` correctly ramps back (chain gate → 1, bypass gain → 0, `isEngaged()` → `false`).
5. Confirmed a fresh page load shows zero unexpected console errors, and the Bypass button is correctly disabled until Start succeeds.

**Acceptance criteria:**
- ✅ Toggling bypass reconnects mic directly to output near-instantly, regardless of chain state — proven directly, including the hardest case (chain actively broken/throwing).
- ✅ Independent of whatever `AudioGraph.buildGraph()` is doing — proven by the surgical-disconnect fix plus the broken-chain test above.

**Deviations:** None from the specified architecture.

**Recommended (not blocking) real-hardware check:** the routing logic is now rigorously proven synthetically, so this doesn't need another full audibility round-trip — but since this is the app's single most safety-critical control, it's worth a quick real click: reload the app, Start, click the temporary "Bypass: OFF" button once or twice, and confirm it toggles cleanly with no audible glitch.

**Follow-up tasks:** None generated. Next unblocked task: UI-1 (Start/Stop control + input device picker), then UI-2 (Bypass control UI) — both feed Milestone M2.

**Approval status:** Approved by user. Status set to `completed`. Note: user correctly observed bypassed vs. normal sound identical right now — expected, since no real effect nodes exist yet (AE-5+ not built), so both states are currently raw passthrough. Full audible A/B confirmation of Bypass deferred to after AE-5 lands.

---

## UI-1 — Start/Stop control + input device picker

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent, after resolving one real interpretation ambiguity with the user first (see below); no fallback needed.

**Scope clarification resolved before implementation:** PX-1's spec labels this "Start/Stop control," but no task (including AE-1) built real stop/suspend capability, and the approved journey never calls for a deliberate mid-event stop. Asked the user directly rather than guessing: confirmed to build a one-way Start action + Live/Stopped status indicator only, matching what `AudioEngine` actually supports — not new stop/pause scope.

**Changed files:**
- `index.html` — replaced the temporary `#ae1-test-harness` section with a real `<header class="topbar">` (app title, status dot/text, Start button, device picker) per the approved PX-1 mockup. The Bypass button was relocated into this bar as-is, explicitly marked as still unstyled/pending UI-2.
- `styles/main.css` — added top-bar styling adapted from the approved `px1-mockup.html` (same CSS variable names, so UI-2/UI-3/PS-3 can reuse the palette rather than inventing a second one).
- `src/main.js` — display logic only: status is now driven by a dot + text (green/gray) instead of a prose string, derived from the same `AudioEngine.isStarted`/`audioContext.state` already in use. Every functional call (`AudioEngine.start()`, `AudioGraph.buildGraph()`, `AudioBypass.reconnectSource()`, device listing/switching) is untouched from AE-1/AE-2/AE-3.
- `.claude/launch.json` — added by the subagent purely as local dev-server tooling to enable browser-based validation (not app code); flagged transparently rather than silently included.

**Validation evidence (independently re-verified):**
1. Read all three changed app files myself — confirmed the functional wiring is unchanged (same calls, same order), only the DOM elements and status-display mechanism changed.
2. Re-ran `node --check` on all four JS files myself — passed.
3. **Independently reproduced the live test**: loaded the app fresh, confirmed via the accessibility tree that all five controls (title, status, Start, device picker, Bypass) render correctly in one bar with "Stopped" as the initial state. Clicked Start myself: status text became `"Failed to start (Permission denied)"` (expected — no real mic in this sandbox), no `.live` class applied, Start button re-enabled, device picker and Bypass button correctly stayed disabled. Console showed only the same single expected `NotAllowedError`, no new errors.

**What I could not validate:** the success path (Live status turning green, device list populating) can't be exercised end-to-end without real mic permission. The underlying logic is unchanged from what you already confirmed working in AE-1/AE-2/AE-3 — only the display target and styling changed — but a visual confirmation on your end is worth doing since this is the first task with real visible UI polish.

**Acceptance criteria:**
- ✅ Matches PX-1 spec structurally and visually (adapted styling from the approved mockup).
- ✅ Start button still resumes the AudioContext — functional wiring unchanged, independently re-verified.
- ✅ Device picker still updates the active input — wiring unchanged from AE-1/AE-2, code-reviewed.

**Deviations:** Added a visually-hidden `<label>` for the device select (accessibility preservation, no visual change) and kept `<h1>` for the title for document structure — both minor, non-behavioral. `.claude/launch.json` added as dev tooling, not app code.

**Follow-up tasks:** None generated. Next unblocked task: UI-2 (Bypass control UI) — gives the Bypass button its real, visually-dominant treatment per the brief.

**Approval status:** Approved by user. Status set to `completed`.

---

## UI-2 — Bypass control UI

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent; no fallback needed. The subagent found a way to mock `getUserMedia`/`enumerateDevices` with a synthetic oscillator-driven `MediaStream`, letting it exercise the actual real Start→Live→Bypass flow end to end in validation, not just isolated function calls — a stronger test than prior tasks managed.

**Changed files:**
- `styles/main.css` — `.bypass-btn`/`.bypass-btn.engaged`/`.bypass-btn:disabled` rules, copied directly from the approved `px1-mockup.html` (same selectors/values — exact styling source of truth, not a reinterpretation). Off-state: red outline/text on light tint. Engaged: solid red fill, white text, glow box-shadow.
- `index.html` — added `class="bypass-btn"` to the button.
- `src/main.js` — `setBypassButtonLabel()` now toggles the `engaged` CSS class in the same call that sets the ON/OFF text, both from one `AudioBypass.isEngaged()` read (can't drift out of sync). Added a global spacebar shortcut, guarded against hijacking the device `<select>`'s native space-opens-dropdown behavior, and against firing while the button is disabled. Canvas-dimming-on-bypass (from the PX-1 spec) explicitly deferred with a comment, since no canvas exists yet (UI-3) — not faked.

**Validation evidence (independently re-verified, and I re-ran the subagent's stronger test technique myself):**
1. Read the full diff myself — confirmed single-source-of-truth styling logic and the keyboard guard.
2. Re-ran `node --check` — passed.
3. **Reproduced the mocked-mic technique independently**: substituted `getUserMedia`/`enumerateDevices` with a synthetic oscillator-backed `MediaStream`, clicked the real Start button, and confirmed the full real flow completes (`status: "Live"`, Bypass button enabled) — this is the first task where I could exercise success-path behavior end-to-end without needing your hardware.
4. **Confirmed visual prominence directly via computed styles**: Bypass renders at 16px/700-weight/12px×24px padding in saturated red, versus Start's 14.4px/400-weight/8px×16px padding in neutral gray — measurably, not just visually, the most dominant control in the bar.
5. **Confirmed click and spacebar both toggle correctly and stay in sync**: text, `engaged` class, and `AudioBypass.isEngaged()` all flipped together; engaged computed style showed the solid red fill + glow exactly matching the mockup.
6. **Confirmed the keyboard guard works correctly in both directions**: spacebar with body focused toggled bypass and prevented default (no page scroll); spacebar with the device `<select>` focused left bypass state unchanged and did NOT prevent default (native dropdown behavior preserved).
7. Zero console errors throughout.

**Acceptance criteria:**
- ✅ Visually dominant per PX-1 spec — confirmed via direct style comparison, not just visual impression.
- ✅ Single click or spacebar engages/disengages with immediate effect — confirmed end-to-end via the mocked-mic real flow.

**Deviations:** None.

**Follow-up tasks:** None generated. **Milestone M2 (Bypass safety net operational) is now nearly complete** — only QA-6 (Bypass independent reliability test) remains, which formally validates this control as the one thing that must be bulletproof. Next unblocked task: QA-6.

**Approval status:** Approved by user. Status set to `completed`.

---

## QA-6 — Bypass independent reliability test

- **Status:** awaiting-approval
- **Delegation:** Executed directly (no subagent) — this is pure test execution + a written QA record, no new application code involved.

**Deliverable:** [docs/ultron/qa/qa-6-bypass-reliability.md](qa/qa-6-bypass-reliability.md) — an 8-condition test matrix, executed live against the real app (via mocked mic/device infrastructure, same technique UI-2's validation used).

**Conditions tested, beyond what AE-3/UI-2 already incidentally covered:**
- Chain actively broken, then healed while still engaged (re-confirmed from AE-3 for the formal record).
- **New**: 12 rapid back-to-back toggles — no throw, correct final state, correct final gain values.
- **New**: a live device switch (via the real `<select>` + `change` event, going through the full `switchInputDevice → buildGraph → reconnectSource` path) while bypass is engaged — engaged state survived the switch correctly, and disengaging afterward still worked.
- **New**: calling `engage()` before `AudioEngine.start()` has ever run — throws a clear, descriptive error rather than a confusing crash.
- **New, closes a gap from AE-3**: calling `AudioEngine.start()` + `AudioBypass.reconnectSource()` directly, deliberately skipping `AudioGraph.buildGraph()` entirely (so the chain gate has never been created by anything) — `engage()` still works correctly, creating the chain gate on-demand.

**Result:** All 8 conditions pass. Zero console errors across the entire matrix.

**Acceptance criteria:**
- ✅ Bypass engages correctly in every tested state.
- ✅ Documented as the one path independently verified bulletproof, ahead of the rest of the build.

**Deviations:** None.

**Follow-up tasks:** None generated. **Milestone M2 (Bypass safety net operational) is now complete.** Next unblocked task: PX-3 (default shipped chain order + initial preset content) — the last task before deep-research's committed decisions (RQ-1/RQ-2) get exercised in AE-4 and UI-3.

**Approval status:** Approved by user. Status set to `completed`.

---

## PX-3 — Default shipped chain order + initial preset content

- **Status:** awaiting-approval
- **Delegation:** Implemented directly — design/content decision task, same rationale as PX-1/PX-2.

**Changed files:**
- `docs/ultron/design/px3-default-chain-and-preset.md` — default chain order (Input→Gain→Compressor→EQ→Delay→Reverb→Limiter→Output, with rationale per position) and one starter preset, "Classic Karaoke" (consistent with the name already shown in the approved PX-1 mockup), using PX-2's already-validated default parameters unchanged. Includes the exact serialized `{name, nodes}` JSON contract PS-2/PS-3 and the AE-5–AE-10 node-type registry strings (`gain`, `compressor`, `eq`, `delay`, `reverb`, `limiter`) should follow.

**Validation evidence:**
1. Order rationale checked against standard live-vocal signal-chain practice (gain-stage first, compression before EQ/time-based effects, limiter always last as the safety ceiling) — consistent with the domain-accuracy reasoning already established in PX-2.
2. **Verified the embedded JSON model is syntactically valid** by extracting and parsing it programmatically (via Node, not just eyeballing it) — confirmed 6 nodes in the intended `gain → compressor → eq → delay → reverb → limiter` sequence.
3. Confirmed the `nodes` array shape matches exactly what `AudioGraph.buildGraph(model)` (built in AE-2) already expects — this preset's node list is directly usable once AE-5–AE-10 register their factories under the specified type strings.

**Acceptance criteria:**
- ✅ A first-run user gets a sensible, ready-to-use chain rather than an empty canvas — the "Classic Karaoke" preset, once PS-2 loads it by default.

**Deviations:** None.

**Follow-up tasks:** None generated. Next unblocked task: AE-4 (Live reconnect/rewire engine) — the project's central technical risk, now unblocked by the committed RQ-1 research decision.

**Approval status:** Approved by user. Status set to `completed`.

---

## AE-4 — Live reconnect/rewire engine

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given a fully worked-out algorithm (precise pseudocode specified in advance — this is the project's central technical risk, so it got the most design care of any task so far).

**Design work done before implementation, and one real gap the subagent caught in it:** working out RQ-1's committed pseudocode precisely (rather than translating it literally) surfaced two real bugs, fixed in the design itself:
1. A literal "connect new edges before disconnecting old ones" at the Web Audio edge level has a genuine collision bug: if old and new topologies happen to share an edge (e.g. rearranging an already-empty chain, where both resolve to `source → gate` directly), the two operations step on each other. Resolved by moving all fallible work (node creation, unknown-type validation) to a **synchronous phase up front** — this also restores synchronous, immediately-catchable errors for bad input, better than a naive deferred-everything approach — followed by simple sequential teardown-then-rebuild during the muted window, which is exactly as inaudible and avoids the collision entirely.
2. If Bypass is engaged while the chain gets edited, naively un-ducking the shared gate back to full volume afterward would silently **disengage Bypass** — unmuting the chain gate as a side effect of an unrelated edit. Fixed so the post-edit gain target is read from `AudioBypass.isEngaged()` rather than hardcoded.

**A third, genuine gap — my own mistake, caught by the implementing subagent, not silently worked around:** my specified pseudocode never included the line connecting the shared gate to `audioContext.destination`. Implemented literally, this would have made the gate a permanent dead end — silent forever, and both the rewire's own un-duck and Bypass's ramps on that same node would become inert (a `GainNode` with no path to destination never has its automation evaluated by the audio thread). The subagent caught this via its own validation (test 8 failed until fixed), restored the one line the pre-AE-4 code already had, flagged it explicitly rather than silently patching around it, and re-ran the full validation suite afterward. Read the final file myself to confirm the fix is exactly right and well-commented on *why* it's needed.

**Changed files:**
- `src/audio-graph.js` — `buildGraph()` rewritten as a two-phase process: synchronous node resolution/creation (reuse-by-id or fresh-factory-call, throws immediately on an unknown type) followed by a deferred, debounced graph surgery (duck → teardown old → rebuild new → commit → un-duck-to-the-bypass-aware-target). No other files touched.

**Validation evidence (independently re-verified myself, not just taken from the subagent's report):**
1. Read the entire changed function myself — confirmed both design fixes and the restored destination-connect line, with accurate comments explaining each.
2. Re-ran `node --check` — passed.
3. **Independently reproduced the two most critical tests**:
   - **Reuse/no-recreate**: registered a factory that counts its own calls; reordering two existing ids triggered **zero** factory calls (pure reorder, both instances reused); adding one new id alongside them triggered **exactly one** call (only the genuinely new node was created).
   - **Empty-to-empty edge-collision case**: called `buildGraph([])` twice in a row and confirmed — via an independent `AnalyserNode` tap, not just connection bookkeeping — that a real oscillator signal still flows all the way through the chain gate afterward. Audio path survives the exact scenario the design was built to protect against.
   - **Bypass-interaction (the critical fix)**: engaged Bypass, then edited the chain. Confirmed the gate's gain stayed pinned near `0` throughout and correctly kept ramping toward `0` (not `1`) after the edit, `isEngaged()` remained `true`, and disengaging afterward correctly restored gain to `1`.
   - **Unknown type**: confirmed the throw is synchronous and catchable in a plain `try/catch`, with the model completely unchanged afterward.
   - **Debounce**: fired three rapid `buildGraph()` calls with different models; confirmed only the final one was actually built.
4. One error appeared in my own final ad-hoc test — traced it to my own test script reusing `AudioBypass`'s cached gain node across two different fake `AudioContext` instances (a test-harness artifact impossible in the real app, which only ever has one real `AudioContext` per session) — not an application defect.

**Acceptance criteria:**
- ✅ No audible click/pop — the duck/un-duck ramp pattern is in place and independently confirmed to schedule correctly; full by-ear confirmation still awaits real effect nodes (AE-5+), consistent with the same limitation noted since AE-3.
- ✅ No leaked node references — reused nodes are never destroyed/recreated; removed nodes are disconnected and dropped from tracking, confirmed via the factory-call-count test.

**Deviations:** The destination-connect fix described above (a correction of my own specification, not a subagent design choice). No other deviations.

**Follow-up tasks:** None generated. Next unblocked task: UI-4 (generic parameter control component) and UI-3 (drag-and-drop canvas mechanics, now unblocked by the committed RQ-2 research decision) — both feed Milestone M3, along with the first real effect node (AE-5, recommended to build first as the simplest).

**Approval status:** Approved by user. Status set to `completed`.

---

## UI-4 — Generic parameter control component

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given a fully specified registry contract (a new `NodeTypes` registry for UI-facing metadata, two small additive accessors on the already-approved `AudioGraph`, and the rendering component itself); no fallback needed.

**⚠️ Housekeeping flag, not an app defect:** the subagent's own test-server cleanup ran `taskkill /IM python.exe`, which stops **every** Python process on the machine by image name, not just its own throwaway server. I checked immediately afterward — no Python processes are currently running — but I have no baseline from before the task to confirm nothing else was affected. Flagging this directly to you rather than assuming it's fine. Future delegations will be instructed to track and kill their own server by PID only, as I did for my own validation server this task.

**Changed files:**
- `src/node-types.js` — new. `window.NodeTypes = {register, getLabel, getParamSpec, applyParam}` — a UI-facing metadata registry (label, param spec, and a per-type `applyParam` function), deliberately separate from `AudioGraph`'s audio-factory registry. AE-5–AE-10 will each register into both registries when built.
- `src/audio-graph.js` — two small additive accessors only: `getNodeInstance(id)` (live node lookup) and `updateNodeParams(id, params)` (model bookkeeping only, no rebuild). Zero changes to any existing logic.
- `src/param-controls.js` — new. `window.ParamControls.render(container, modelEntry, onParamsChanged)` — one labeled slider per param-spec entry, driving both the model (`updateNodeParams`) and the live node (`NodeTypes.applyParam`) directly on every `input` event, deliberately never touching `buildGraph()`.
- `index.html`, `styles/main.css` — script tags and minimal slider-row styling added.

**Validation evidence (independently re-verified myself, not just taken from the subagent's report):**
1. Read all three files in full — confirmed the registry separation, the two additive-only `AudioGraph` accessors (verified via `grep` that nothing else in that file changed), and that `param-controls.js` never references `buildGraph`.
2. Re-ran `node --check` on all three files myself — passed.
3. **Independently reproduced the core proof**: registered a throwaway `test-gain` type mirroring PX-2's real Gain spec (dB→linear conversion), built a one-node chain, rendered controls, and moved the slider programmatically. Confirmed: the live `GainNode.gain.value` updated to the exact dB-converted value (float32-precision match against `Math.pow(10, 12/20)`); the model's stored params updated to match; and — spying on `AudioGraph.buildGraph` directly, not just watching the chain gate — **confirmed `buildGraph` was never called** and the chain gate's gain stayed pinned at its steady state throughout, proving the continuous-slider-drag path is fully decoupled from the structural rewrite machinery.

**Acceptance criteria:**
- ✅ One component correctly renders and drives controls for any node type's param spec, with no per-type UI code — proven against a representative test type; the real node types (AE-5+) will exercise the identical, unmodified path.

**Deviations:** None from the specified contract.

**Follow-up tasks:** None generated. Next unblocked task: UI-3 (drag-and-drop canvas mechanics) or AE-5 (Gain node factory, recommended first per the plan's own milestone note) — both now unblocked.

**Approval status:** Approved by user. Status set to `completed`.

---

## AE-5 — Gain/Trim node factory

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given the exact registration pattern UI-4 already proved out, this time as the real, permanent `gain` type; PID-based server cleanup was explicitly required this time (following the UI-4 housekeeping flag) and correctly followed.

**Changed files:**
- `src/node-gain.js` — new. Registers the real `gain` type into both `AudioGraph` (factory) and `NodeTypes` (label/paramSpec/applyParam), exactly per PX-2's spec (-24..+24dB, default 0, step 0.5), with the dB→linear conversion applied both at creation and on live updates. First of six planned node-type files (AE-5–AE-10), establishing the one-file-per-type pattern.
- `index.html`, `src/main.js` — a temporary test harness (button + rendered slider), same pattern as every prior AE task, since no drag-and-drop canvas exists yet to add a real node through. Clearly marked for deletion once UI-3 lands.

**Validation evidence (independently re-verified myself, including chasing down a confusing result in my own testing):**
1. Read both new/changed files — confirmed correct registration into both registries and the correct conversion formula in both places (factory + applyParam).
2. Re-ran `node --check` — passed.
3. **Hit a real discrepancy in my own first reproduction attempt** and didn't wave it away: an amplitude measurement via an `AnalyserNode` showed no change at all between 0dB and -24dB, even though the live `gain.value` clearly updated correctly. Traced this to my own test methodology, not the app: I was reusing a page session across several separate script executions, and an earlier script had closed the mock `AudioContext` feeding the test signal, leaving later measurements reading a dead/contaminated stream. Re-ran a single, fully self-contained test (clicking the real Start and test buttons, all in one script execution, mirroring the subagent's own approach) and got a clean result: peak amplitude ratio between 0dB and -24dB was **15.8489**, matching the expected `10^(24/20) = 15.8489` almost exactly — confirming the real audio path scales correctly, not just the stored parameter number.
4. Confirmed the live `GainNode.gain.value` matches the expected float32-precision conversion at both settings.
5. Zero console errors.

**Acceptance criteria:**
- ✅ Adjusting gain changes level in real time, with the correct dB scaling — confirmed via real signal amplitude measurement, independently reproduced after resolving a self-inflicted test artifact.
- ⚠️ "Validated by ear" — genuinely needs your hardware; the temporary test harness (a button + slider) is in place for you to try.

**What I could not validate:** actual audible confirmation with your ears and a real microphone — everything else (registration, conversion math, real signal-path amplitude scaling, no errors) is now rigorously confirmed synthetically.

**Deviations:** None from the specified contract.

**Follow-up tasks:** None generated. Next unblocked task: AE-6 (Compressor), continuing the same pattern, or UI-3 (drag-and-drop canvas) — both now unblocked.

**Approval status:** Approved by user — confirmed working by ear on real hardware ("everything worked perfectly as far as i can tell"). Status set to `completed`.

---

## UI-3 — Drag-and-drop canvas mechanics

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent, resolving two spec gaps with the user first (node removal, drag-handle isolation), and given the exact committed SortableJS approach from RQ-2.

**Changed files:**
- `src/node-types.js` — one additive function, `getAllTypes()` (registration-order list), so the palette is always driven by whatever's actually registered, never a hardcoded type list.
- `src/canvas.js` — new. The real palette (dynamic, from `NodeTypes.getAllTypes()`) and chain canvas, wired via two SortableJS instances per the committed research (`forceFallback: true` on both; palette is clone-source-only; chain list uses `handle: '.node-drag-handle'` so a card's slider/remove button can never start a drag). `onAdd` swaps a cloned palette chip for a real, stateful node card (label, drag handle, remove button, inline `ParamControls`); `onSort` is the single chokepoint that recomputes the model from DOM order and calls `AudioGraph.buildGraph()` — exactly once per structural change, gated on `AudioEngine.isStarted` so a stray interaction before Start can't throw.
- `index.html`, `styles/main.css` — the real three-region layout (minus the presets column, PS-3's scope) replacing the temporary AE-5 harness; SortableJS pulled from CDN pinned to v1.15.7 per the committed research.
- `src/main.js` — minimal: removed the old AE-5 test-harness wiring, added one call to `ChainCanvas.onEngineStarted()` alongside the existing Bypass-enabling line.

**Validation evidence — independently re-verified with a different technique than the subagent used, after their approach didn't reproduce in my environment:**
1. Read `canvas.js`, the `node-types.js` diff, `main.js` diff, and `index.html` in full — confirmed the architecture matches the design exactly (dynamic palette, handle isolation, single rebuild chokepoint, pre-start guard).
2. Re-ran `node --check` on all changed files — passed.
3. **The subagent validated via real simulated pointer-event drags; that didn't reproduce for me** — this environment's Browser pane isn't compositing frames right now (confirmed via a failed screenshot attempt), and neither `PointerEvent` nor `MouseEvent` sequences I dispatched triggered SortableJS's fallback drag recognition. Rather than accept an unverified result, I used a different, still-legitimate technique: SortableJS exposes `Sortable.get(element)` to retrieve a bound instance, so I invoked the actual registered `onAdd`/`onSort` handlers directly with realistic event objects — this tests 100% of the custom application logic (everything actually written for this task), while trusting SortableJS's own internal drag-recognition mechanics as already-vetted third-party code (per RQ-2's research, not something this project wrote or needs to re-prove).
4. **Confirmed add**: two drops correctly built a 2-node chain, `buildGraph`/`createGain` call counts incremented by exactly 1 each time.
5. **Confirmed reorder + reuse**: reordering two existing nodes changed `getModel()`'s order, incremented `buildGraph` by 1, but **did not increment `createGain` at all** — both node instances reused, not recreated — and direct object-identity checks confirmed the same instances survived.
6. **Confirmed param-survives-reorder**: tuned one node's slider to a non-default value, reordered, and confirmed the tuned value was still there afterward (not reset to default).
7. **Confirmed removal and empty-state recovery**: removed both nodes via their real remove buttons; chain returned to empty, hint reappeared. Hit one confusing result on my first attempt (a removal appeared to silently no-op) — traced it to my own test chaining too many rapid structural operations with only 50ms between them, well within AE-4's ~20ms debounce window; a slower, more generously-paced re-run of the identical sequence (150ms between steps) completed perfectly, confirming this was a test-timing artifact, not an application defect.
8. **Confirmed drag-handle isolation** (partially — see limitation below): moving a card's slider did not increment the `buildGraph` call count, confirming a param tweak alone never triggers a rebuild. I did not independently re-verify that a raw pointer/mouse sequence on the slider fails to register as a card-drag (the subagent's own report covers this specifically), since the same pane-compositing limitation applies — I'm relying on `handle: '.node-drag-handle'` being a well-documented, standard SortableJS option (confirmed present in the code) rather than re-proving the library's own behavior.
9. Zero console errors across every test.

**Acceptance criteria:**
- ✅ Drag-to-add and drag-to-reorder both work, reflecting live in the audio graph exactly once per change — confirmed via the real registered handlers, not a bypass of the application logic.
- Full glitch/leak validation under sustained real-world use is QA-1's job next, per the plan.

**Known limitation of this validation pass:** the Browser pane wasn't compositing frames during this session, so neither I nor a literal reproduction of the subagent's pointer-event technique could exercise a genuine end-to-end mouse drag in this environment. Every piece of custom logic this task actually wrote has been verified through direct invocation of the real registered callbacks; the one thing not independently re-confirmed here is SortableJS's own internal recognition of a raw drag gesture, which is well-established third-party behavior, not new code.

**Deviations:** None from the agreed scope (removal button, drag handle) beyond what was already confirmed with the user before implementation.

**Follow-up tasks:** None generated. Next unblocked task: QA-1 (reorder glitch/leak test), which formally completes Milestone M3, or AE-6 (Compressor) to continue toward Milestone M4.

**Approval status:** Approved by user — confirmed working live ("i am able to add multiple gains, edit and move independently and device removal works perfectly"). Status set to `completed`.

---

## QA-1 — Reorder glitch/leak test

- **Status:** awaiting-approval
- **Delegation:** Executed directly (no subagent) — pure test execution + a written QA record.

**Deliverable:** [docs/ultron/qa/qa-1-reorder-glitch-leak-test.md](qa/qa-1-reorder-glitch-leak-test.md) — 250 randomized add/remove/reorder operations executed via the real registered handlers (not a bypass), simulating a multi-hour show's worth of host fiddling.

**Results:** zero errors; final model exactly matched the final DOM; the live audio path was still fully intact (full-amplitude signal) after the storm; disconnect-call counts comfortably exceeded the theoretical minimum required for leak-free operation.

**One real finding, chased down rather than waved away:** `createGain` was called 611 times against only 111 logical "add" operations. Isolated a rapid 5-add burst (zero delay between adds) and found 15 nodes created but only 5 ever connected — the other 10 were created by AE-4's debounce mechanism resolving nodes for rewires that got superseded before ever executing. Confirmed via direct connect-call tracking that every "extra" node was **never connected to the live graph at all** — not a leak, just wasted factory calls under a stress pattern (multiple structural commits within one ~20ms window) that real human drag-and-drop physically cannot produce.

**Acceptance criteria:**
- ✅ Zero audible glitches and zero leaked node references across a sustained sequence of reorder operations — leak-freedom directly measured (not just inferred from no errors); audible smoothness at human drag speed already informally confirmed via the user's own UI-3 testing.

**Deviations:** None.

**Follow-up tasks:** None generated. **Milestone M3 (first effect node end-to-end) is now complete** — AE-4's glitch-free rewiring, UI-3's canvas, UI-4's param controls, and AE-5's real Gain node all work together, validated under both normal and stress conditions. Next unblocked task: AE-6 (Compressor) — begins Milestone M4 (all Core MVP effect nodes).

**Approval status:** Approved by user. Status set to `completed`. Milestone M3 complete.

---

## AE-6 — Compressor node factory

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent following AE-5's exact registration pattern; no fallback needed. Confirmed no temporary test harness was needed this time — UI-3's palette already picks up new registrations automatically.

**Changed files:**
- `src/node-compressor.js` — new. Registers the real `compressor` type: a `DynamicsCompressorNode` factory and `NodeTypes` metadata (Threshold, Ratio, Attack, Release — all direct 1:1 AudioParam writes, no unit conversion needed, unlike Gain's dB→linear). Knee left at the node's native default (30dB), not exposed, per PX-2.
- `index.html` — one script tag added.

**Validation evidence (independently re-verified, including chasing down a second stale-state artifact):**
1. Read the file and confirmed it matches PX-2's spec exactly, with correct reasoning for why no conversion is needed here (unlike Gain).
2. Re-ran `node --check` — passed.
3. **Confirmed the palette is now fully dynamic in practice, not just in theory**: reloaded the app and saw exactly two chips, "Gain" and "Compressor," with zero changes to `canvas.js` — proving UI-3's registry-driven design works as intended for a second real type.
4. **Independently reproduced the compression measurement**, using the node's own `.reduction` metering property (the clean way to isolate compression-driven gain reduction from `DynamicsCompressorNode`'s built-in automatic makeup gain — the subagent's own finding, which I confirmed rather than took on faith). My first attempt gave confusing results (near-zero reduction across settings that should clearly compress) — traced this to the same root cause as an earlier AE-5 hiccup: I hadn't reloaded the page between script executions, so a stale leftover node from a prior test was being measured instead of the fresh one. A clean reload plus a properly long settle window (envelope release needs several hundred ms past the nominal release time to fully settle, not just wait exactly the release value) gave a clean, unambiguous result: **-20.1dB reduction on a loud signal, dropping to essentially 0 (-0.05dB) on a quiet signal**, and cleanly re-engaging when the loud signal returned. This directly proves the compressor is both real and level-dependent, exactly as it should be.
5. Zero console errors.

**Acceptance criteria:**
- ✅ Adjusting each param audibly changes compression behavior — proven via direct, level-dependent gain-reduction measurement, not just confirming the AudioParam number changed.

**Deviations:** None.

**Note for future reference:** this is the second time in this session that reusing a page across multiple separate script executions (without reloading) produced a confusing false result. Worth defaulting to a fresh reload before any new independent test rather than continuing on the same page state.

**Follow-up tasks:** None generated. Next unblocked task: AE-7 (EQ) — continues Milestone M4.

**Approval status:** Approved by user. Status set to `completed`.

---

## AE-7 — EQ node factory

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given a fully worked-out architecture change to `AudioGraph.buildGraph()` (specified in advance, precisely, since this touches AE-4's already-approved core rewiring engine).

**Real architecture gap found and resolved before implementation:** EQ is the first node type built from more than one internal Web Audio node (three chained `BiquadFilterNode`s). `buildGraph()` assumed every factory returns a single node serving as both its own input and output connection point — true for Gain/Compressor, false for a 3-filter chain (input = low-shelf, output = high-shelf, two different objects). Resolved by extending the factory contract: a factory may return a plain node (unchanged, zero impact on Gain/Compressor) or `{input, output, ...}` for composite types, with two small new helpers (`getNodeInput`/`getNodeOutput`) that fall through to the node itself when `.input`/`.output` aren't present. Confirmed this preserves every one of AE-4's existing guarantees (sequential teardown-then-rebuild avoiding the edge-collision bug, synchronous Phase 1 validation, debounce, bypass-aware un-duck) — nothing about those changed, only how a resolved node's connection points are identified.

**Changed files:**
- `src/audio-graph.js` — the two new helper functions plus two small, precisely-scoped edits inside `buildGraph()`'s teardown and rebuild steps (disconnect/connect via input/output now, not the raw node). Every other function (`registerNodeType`, `getModel`, `getChainGate`, Phase 1 resolution, debounce, bypass-aware target) untouched.
- `src/node-eq.js` — new. Registers `eq`: three fixed-frequency `BiquadFilterNode`s (low-shelf 200Hz, peaking 1000Hz/Q1, high-shelf 5000Hz) returned as `{input: low, output: high, low, mid, high}`; `NodeTypes` metadata exposes Low/Mid/High gain sliders (-12..+12dB), `applyParam` reaching directly into whichever internal filter a param targets.
- `index.html` — one script tag added.

**Validation evidence (independently re-verified myself, prioritizing the two properties most likely to reveal a real problem):**
1. Read the entire modified `audio-graph.js` and the new `node-eq.js` in full — confirmed the input/output distinction is applied correctly and consistently, and that the edge-collision and bypass-interaction protections from AE-4 are untouched.
2. Re-ran `node --check` on both files — passed.
3. **Independently reproduced the most critical regression + new-behavior test in one combined run**: added a Gain, a Compressor, and an EQ; reordered all three at once; confirmed via factory-call counters that **zero** new `GainNode`s, `DynamicsCompressorNode`s, or `BiquadFilterNode`s were created by the reorder (counts stayed at 1/1/3 throughout) — proving both the existing single-node types and the new composite type all correctly preserve their internal state across a reorder, with no regression from the `buildGraph()` change.
4. **Confirmed EQ's structure directly**: `.input`/`.output`/`.low`/`.mid`/`.high` all present and correctly typed/tuned (low-shelf@200Hz, peaking@1000Hz/Q=1, high-shelf@5000Hz), and object identity for all three internal filters survived the reorder untouched.
5. **Independently reproduced the frequency-shaping measurement**: fed a 100Hz tone through a fresh EQ node, measured RMS before and after boosting the low band to +12dB — **+11.03dB measured real gain**, closely matching the subagent's own independent measurement (+11.09dB) and physically sensible for a shelf filter at that frequency.
6. Zero console errors.

**Acceptance criteria:**
- ✅ Frequency/gain adjustments audibly shape tone as expected — proven via direct RMS measurement at a real frequency, not just an AudioParam value change.

**Deviations:** The `buildGraph()` extension described above — a necessary, pre-agreed architecture change, not a silent scope expansion.

**Follow-up tasks:** None generated. Next unblocked task: AE-8 (Delay) — continues Milestone M4, and will also be a composite type (delay + feedback + mix), directly exercising the same input/output contract this task established.

**Approval status:** Approved by user. Status set to `completed`.

---

## AE-8 — Delay node factory

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent using AE-7's established composite `{input, output, ...}` contract; no `audio-graph.js` changes needed this time.

**Changed files:**
- `src/node-delay.js` — new. Registers `delay`: input gain → dry/wet split → `DelayNode` (constructed with `maxDelayTime: 1.0` per PX-2's note) → feedback loop → equal-power mix → output sum. Feedback defensively clamped to 90% in code (not just the UI slider), both at construction and in `applyParam`, so the loop can never reach unity gain regardless of where a param value comes from.
- `index.html` — one script tag added.

**Validation evidence (independently re-verified, prioritizing the safety-critical claim):**
1. Read the full file — confirmed the topology, the equal-power crossfade formula, and that the 90% clamp is applied in both places the spec required.
2. Re-ran `node --check` — passed.
3. **Independently reproduced the safety/stability proof myself**, since this is the one property with real consequences if wrong: set feedback to 90 via a real slider event (clamped to 0.9 correctly), then called `NodeTypes.applyParam('delay', node, 'feedback', 150)` directly — **bypassing the UI entirely** — and confirmed it was still clamped to 0.9, not 1.5. Then ran a sustained loud-input test at feedback=90%/mix=100% for 3 seconds, sampling RMS every 500ms: values stayed bounded (fluctuating ~0.22–0.35, no growth trend), zero NaN/Infinity — direct confirmation the feedback loop cannot run away, independent of the subagent's own (more extensive, ~2.8s) version of the same test.
4. Zero console errors.

**Not independently re-verified this task, but no cause for concern:** the subagent's precise delay-timing measurement (197ms measured for a 200ms setting, dual-channel capture) and the geometric-decay echo-train measurement (5 echoes each exactly half the last) — both are consistent with the code's correctness on inspection and don't carry the same safety stakes as the feedback-clamp property, so I focused my own re-verification there instead of duplicating every measurement.

**Acceptance criteria:**
- ✅ Time/feedback/mix all behave correctly and audibly (subagent's measurements: real ~200ms delay, real geometric echo decay, correct equal-power mix curve).
- ✅ No runaway feedback at max settings — independently re-confirmed via a direct code-level bypass of the UI, not just the slider's own max attribute.

**Deviations:** None.

**Follow-up tasks:** None generated. Next unblocked task: AE-9 (Reverb) — needs the committed IR asset from RQ-3 research (already resolved: "IR Rollo Transparent Plate.wav", CC0).

**Approval status:** Approved by user. Status set to `completed`.

---

## AE-9 — Reverb node factory

- **Status:** awaiting-approval
- **Delegation:** Asset sourcing handled directly (real-world web research + an explicit user decision, not a coding task); node factory implemented by a general-purpose subagent using the established composite contract.

**Real-world obstacle found and resolved before implementation:** RQ-3's committed IR file requires a Freesound login to download — not something to do on the user's behalf (account credentials/login are off-limits). Investigated via the real browser and found Freesound also serves a public, no-login HQ MP3 preview of the exact same CC0-licensed sound (confirmed via a plain unauthenticated `curl` request — HTTP 200, no cookies). Presented this to the user with the tradeoff (same CC0 license covers any reproduction, negligible fidelity difference for a 1-second tail, but not byte-identical to the committed asset) rather than silently substituting or blocking on a login step. **User chose the public MP3 preview.** Downloaded it to `assets/ir/plate-vocal.mp3` and independently confirmed it decodes correctly (1.01s duration, stereo, 44.1kHz — matching the original file's documented properties exactly) before handing off to the factory-implementation subagent.

**Changed files:**
- `assets/ir/plate-vocal.mp3` — new static asset (CC0, ~26KB).
- `src/node-reverb.js` — new. Registers `reverb`: input → dry/wet split → `ConvolverNode` → output sum, single `mix` param (equal-power, matching Delay's formula). Solves a real architectural wrinkle: `buildGraph()`'s factory contract is synchronous, but loading the IR is inherently async. Fixed by kicking off the fetch at module-load time (before any node is even added), caching the decoded buffer so every node after the first attaches instantly, and having the factory return synchronously with the convolver's buffer filled in moments later — a `ConvolverNode` with no buffer yet is silent on its wet path, not broken.
- `index.html` — one script tag added.

**Validation evidence (independently re-verified, focusing on the two properties specific to this task's new async-loading design):**
1. Read the full file — confirmed the fetch/cache/decode design matches the plan exactly, and the CC0 substitution is documented with a credit line.
2. Re-ran `node --check` — passed.
3. **Independently reproduced the caching proof**: added two Reverb nodes in one session and confirmed both ended up with the exact same decoded `AudioBuffer` object reference (not just equal values) — and cross-checked against the browser's own network log, which showed exactly one fetch to `plate-vocal.mp3` for the session, not one per node.
4. **Independently reproduced the real reverb-tail proof**, using an `OfflineAudioContext` for a clean deterministic render: fed a single-sample impulse through the actual topology with the real decoded IR. At full wet, the 200–500ms window (well past where a dry click would have ended) showed real, measurable energy (0.0284); at fully dry, that same window was exactly silent. This is genuine convolution, not a wired-but-inert node.
5. Zero console errors, including no fetch failures.

**Acceptance criteria:**
- ✅ Sounds like a plausible plate reverb, not obviously synthetic or mismatched — the IR itself is a purpose-built, creator-described vocal plate emulation (per RQ-3's research), and the tail-energy measurement confirms it's genuinely applying, not just present in name.

**Deviations:** The WAV→MP3 asset substitution described above — a real, user-approved deviation from the literal committed research artifact, same underlying license and sound.

**Follow-up tasks:** None generated. Next unblocked task: AE-10 (Limiter) — the last Core MVP effect node, completing Milestone M4.

**Approval status:** Approved by user. Status set to `completed`.

---

## AE-10 — Limiter node factory

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent following AE-6's single-node pattern, with one additional engineering call (hard knee = 0, opposite of Compressor's soft default) reasoned through and documented.

**⚠️ Known limitation found and independently confirmed — shipped by explicit user decision, not silently accepted:** `DynamicsCompressorNode` (the only native node available for this job — there's no true lookahead/brickwall limiter in the Web Audio API) applies its own internal automatic makeup gain that isn't controllable via any exposed or fixed param. With a hot input signal (2x/+6dBFS) and the default -1dB ceiling, the settled output peak is a stable **+0.23dBFS — slightly above full scale**, not below the configured ceiling. I independently reproduced this myself (not just trusting the subagent's number): 10 samples over 1.5s settled at 1.0268 amplitude, matching the subagent's 1.026 almost exactly. Real audio hardware hard-clips anything above full scale, so this is a genuine gap in exactly what this node exists to prevent, not a cosmetic mismatch between the displayed ceiling and the true output level.

**Options presented to the user:** (1) add a small fixed safety-pad gain stage (~2dB) after the limiter to build in margin against the overshoot, at the cost of the true output being somewhat quieter than the displayed ceiling number, or (2) document as a known limitation and ship as-is. **User chose option 2** — ship as-is, documented here and worth re-checking during QA-2 (cross-browser pass), since this automatic-makeup-gain behavior is a browser-engine characteristic that may differ across Chrome/Firefox/Safari and hasn't been tested outside Chrome.

**Changed files:**
- `src/node-limiter.js` — new. Registers `limiter`: a second `DynamicsCompressorNode` (ratio fixed 20:1, attack fixed 0, knee fixed 0/hard — reasoned through explicitly since PX-2 didn't spell this one out), with Ceiling and Release exposed.
- `index.html` — one script tag added. **This completes the six-node-type file set (AE-5–AE-10).**

**Validation evidence (independently re-verified, prioritizing the safety claim):**
1. Read the full file — confirmed the fixed-param reasoning (ratio/attack/knee) and the ms↔s conversion for `release`.
2. Re-ran `node --check` — passed.
3. **Independently reproduced the sustained hot-signal safety test myself** (see the known-limitation note above) rather than accepting the subagent's numbers at face value — confirmed the overshoot is real, stable (not a settling transient), and reproducible.
4. Did not separately re-run the ceiling-tracks-correctly test (-1dB vs -6dB) or the reuse-on-reorder test — both are straightforward, low-stakes checks consistent with every prior single-node-type task's pattern, and the subagent's reported methodology for them matches what's already been independently validated multiple times this session (AE-6's `.reduction` pattern, AE-4/UI-3/QA-1's reuse-counting pattern).
5. Zero console errors.

**Acceptance criteria:**
- ⚠️ Effectively prevents clipping/spikes under hot input signals — **substantially yes** (a 2x/+6dBFS hot signal is reduced to near-unity, a ~15dB real reduction), but not perfectly — output can still slightly exceed full scale due to the browser's built-in, non-configurable makeup gain. Accepted as a known limitation by explicit user decision rather than fully satisfied.

**Deviations:** None beyond the documented, user-approved known limitation.

**Follow-up tasks:** Re-verify this behavior during QA-2 (cross-browser pass) — the makeup-gain characteristic is Chrome-only confirmed so far. Flagged, not yet a separate tracked task.

**Milestone M4 (all Core MVP effect nodes live) is now complete** — Gain, Compressor, EQ, Delay, Reverb, and Limiter are all real, registered, and independently validated.

**Approval status:** Approved by user. Status set to `completed`. Milestone M4 complete.

---

## PS-1 — Serialization schema

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent — pure data/utility logic, no Web Audio involved.

**Changed files:**
- `src/preset-schema.js` — new. `window.PresetSchema = {CURRENT_VERSION, serialize, deserialize}`. Wraps `AudioGraph.getModel()`'s `{id,type,params}[]` shape with a `schemaVersion` tag and a `name`, deep-copying `params` in both directions so serialized/deserialized results can never be mutated by reference. `deserialize` validates structure only (not whether node types are registered — that's left to `buildGraph()`'s own error, deliberately not duplicated here) and throws specific, debuggable errors naming exactly what's wrong.
- `index.html` — one script tag added.

**Validation evidence (independently re-verified myself, directly in Node — no browser needed for this task):**
1. Read the full file — confirmed the validation logic, the deliberate scope boundary (structure only, not type-registry checks), and deep-copying in both directions.
2. Re-ran `node --check` — passed.
3. **Independently re-ran the actual round-trip test myself**: serialized a representative 2-node model (including decimal params like `3.5` and `0.01`), forced it through a real `JSON.stringify`/`JSON.parse` cycle (simulating genuine localStorage storage, not just an in-memory reference), deserialized it, and confirmed via `assert.deepStrictEqual` it matches the original exactly — plus the empty-model case round-trips to `nodes: []` correctly.
4. **Independently re-ran 5 of the rejection tests** (missing/wrong schemaVersion, missing name, non-array nodes, node missing id) — all threw with the exact specific, debuggable error messages reported.
5. Confirmed the missing-`params` leniency case deserializes to `{}` rather than erroring, and confirmed mutation safety (mutating the original model after serializing doesn't affect the already-serialized snapshot).

**Acceptance criteria:**
- ✅ Schema round-trips the in-memory model losslessly — independently confirmed via a real stringify/parse cycle, not just object-reference equality.

**Deviations:** None.

**Follow-up tasks:** None generated. Next unblocked task: PS-2 (localStorage autosave), which will be the first real consumer of this schema.

**Approval status:** Approved by user. Status set to `completed`.

---

## PS-2 — localStorage autosave

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given a precise design (including a real ID-collision handling scheme worked out in advance); the subagent additionally found and fixed a genuine race-condition bug beyond the literal spec.

**A real race-condition bug found and fixed during implementation, not just the pre-planned design work:** the literal spec had the save hook read `AudioGraph.getModel()` — but `buildGraph()` commits its internal model **asynchronously** (~20ms later, part of AE-4's glitch-free duck/rewire design), so reading it immediately after triggering a rebuild returns the stale, pre-change model. Every structural edit would have silently autosaved the OLD chain — a reload right after adding/removing/reordering a node would have lost that exact change. Fixed by having `canvas.js` pass its own synchronously-current `chainModel` directly into `saveCurrentChain()` instead of relying on `AudioGraph`'s lagging getter.

**Changed files:**
- `src/canvas.js` — `createNodeCard` accepts an optional explicit id (for restoring saved ids verbatim); new `loadModel(model)` rebuilds the whole canvas from an arbitrary saved array and bumps the id counter past any restored `node-N` ids to prevent future collisions; save hooks added at all three points the model can change (structural add/remove/reorder, and per-node param tweaks).
- `src/default-preset.js` — new. PX-3's "Classic Karaoke" preset instantiated as real, loadable data for the first time (previously only a design doc).
- `src/persistence.js` — new. `saveCurrentChain(model)` / `loadInitialModel()`, fails safe on any corrupt/missing data (falls back to the default preset, logs but never throws).
- `src/main.js` — Start handler now loads the persisted-or-default initial model via `ChainCanvas.loadModel()` instead of always starting empty.
- `index.html` — two script tags added.

**Validation evidence (independently re-verified, prioritizing the two properties most likely to reveal a real problem):**
1. Read all four changed/new files in full — confirmed the race-condition fix is applied consistently at all three save call sites, and the id-collision counter-bump logic is correct.
2. Re-ran `node --check` on all four files — passed.
3. **Independently reproduced the exact race condition and its fix, mechanistically**: cleared `localStorage`, started fresh (confirmed the 6-node default loads correctly), added a node, and — with zero wait — read `localStorage` and `AudioGraph.getModel()` at the *same instant*. Result: the saved data already showed **7 nodes** while `AudioGraph.getModel()` still showed the stale **6** at that exact moment — direct, timestamped proof both that the bug is real and that the fix (reading `chainModel` instead) correctly avoids it.
4. **Independently reproduced the id-collision proof across a real page reload** (not just in-memory): reloaded the page against the localStorage state from step 3, confirmed the full 7-node chain (6 defaults + the `node-1` added earlier) was correctly restored, then added one more node via the real drag handlers and confirmed it received `node-2` — no collision with the just-restored `node-1` — with all ids unique in both the model and the DOM.
5. Zero console errors.

**Acceptance criteria:**
- ✅ Reloading the page restores the exact prior chain — independently confirmed across a real reload, including the specific race-condition case (reload immediately after a structural edit).
- ✅ A fresh browser/profile gets the PX-3 default instead of an empty canvas — confirmed.

**Deviations:** The race-condition fix (an optional `model` parameter on `saveCurrentChain`, with `canvas.js` always passing its own current model explicitly) — a necessary correctness fix discovered during implementation, not a design change requested in advance.

**Follow-up tasks:** None generated. Next unblocked task: PS-3 (named preset save/load UI) — the last task before Milestone M5 is complete.

**Approval status:** Approved by user. Status set to `completed`.

---

## PS-3 — Named preset save/load UI + storage

- **Status:** awaiting-approval
- **Delegation:** Implemented by a general-purpose subagent given a precise design (storage API contract, exact panel markup/ids, the `chainModel`-not-`AudioGraph.getModel()` reasoning carried over from PS-2, and the modified-indicator lifecycle rules). User explicitly confirmed in advance (via AskUserQuestion) that Delete should be included in this task's scope, same pattern as UI-3's node-removal gap.

**Changed files:**
- `src/preset-store.js` — new. `window.PresetStore = {listNames, save, load, remove}`, storage key `karaoke-presets-v1`, a name-keyed map of `PresetSchema`-serialized presets — deliberately separate from PS-2's single implicit autosave slot. `listNames()` seeds the store with `DEFAULT_PRESET` under "Classic Karaoke" whenever it's empty (fresh profile, or corrupt data reset to empty), so the Load list is never empty.
- `src/presets-ui.js` — new. Wires the real Presets panel (Save As/Load/Delete, current-name display, unsaved-changes indicator) to `PresetStore` and `ChainCanvas`. Exposes `window.PresetsUI = {markModified}` for `canvas.js` to call at its edit chokepoints.
- `src/canvas.js` — added `getCurrentModel()` (reads `chainModel` directly, same async-lag reasoning as `Persistence.saveCurrentChain()` — `AudioGraph.getModel()` still lags ~20ms after a structural change); `loadModel()` now also updates the autosave baseline after a load (so loading a named preset persists as the new "current chain" too, without marking it as modified — a load is a clean state by definition); added `PresetsUI.markModified()` calls at the three existing edit chokepoints (`onSort`, remove-button, `onParamsChanged`).
- `index.html` — real third `.panel.presets` column added (PX-1's 3-column layout, deliberately deferred by UI-3 until this task); two new script tags.
- `styles/main.css` — `.layout` grid extended to 3 columns; `.presets`/`.preset-current`/`.preset-name`/`.unsaved-dot`/`.preset-actions` rules adapted from the approved PX-1 mockup, reused as the styling source of truth.

**Validation evidence (independently re-verified myself, prioritizing the two properties most likely to reveal a real problem — load not fully replacing the live chain, and the autosave-on-load addition not actually taking effect):**
1. Read all five changed/new files in full — confirmed the storage contract, the `chainModel`-not-`AudioGraph.getModel()` reasoning is applied consistently, and the modified-indicator lifecycle (marked on edits, cleared on Save/Load, never marked by `loadModel()` itself) is correct.
2. Re-ran `node --check` on `preset-store.js`, `presets-ui.js`, and `canvas.js` — passed.
3. **Fresh profile seeding**: cleared `localStorage`, reloaded — confirmed `#preset-select` shows exactly "Classic Karaoke" and the raw stored JSON matches `DEFAULT_PRESET` serialized under that name, before Start was even clicked.
4. **Save As, via the real button + a stubbed `prompt`**: started the engine (mocked `getUserMedia`), removed the limiter node via its real remove button (5 nodes left), saved as "My Test Preset" — confirmed it appears in `PresetStore.listNames()`, the dropdown, `#current-preset-name`, and the unsaved indicator clears.
5. **Load fully replaces (not merges) the chain — the highest-risk case**: removed a second node (4 nodes, indicator correctly showing "unsaved"), then selected and Loaded "My Test Preset" back — confirmed the live model reverted to exactly the saved 5-node state (`n1`–`n5`), not a merge of the 4-node in-progress state with the saved one, DOM card count matched, indicator cleared, current-name updated.
6. **Autosave baseline updates on Load — the other highest-risk case**: checked raw `localStorage['karaoke-autosave-v1']` immediately after the Load in step 5 — it already held the loaded 5-node preset. Then did a **real, full page reload** (not just in-memory) and re-started the engine — `AudioGraph.getModel()` confirmed the restored chain matched the loaded preset exactly, not the earlier 6-node default or the 4-node divergent edit.
7. **Cancel/empty-name handling**: stubbed `prompt` to return `null`, then `'   '` — confirmed both are no-ops (preset list unchanged).
8. **Delete**: selected "My Test Preset" (also the currently-displayed preset), confirmed via stubbed `window.confirm`, clicked Delete — confirmed it's gone from `PresetStore.listNames()` and `#current-preset-name` reset to "Unsaved chain".
9. Zero unexpected console errors throughout.
10. Test server stopped by its specific PID (48584), not a broad image-name kill.

**Acceptance criteria:**
- ✅ Saving, listing, and loading named presets all work correctly — independently confirmed via the real UI, including the full load-fully-replaces case.
- ✅ Loading a preset fully replaces the live chain via AE-4 — independently confirmed both immediately and after a genuine page reload.

**Deviations:** None from the finalized design. (The design itself extended the literal task description with the user-approved Delete capability, and with the autosave-baseline-on-load behavior reasoned through during design — both were decided/flagged before delegation, not found mid-implementation.)

**Follow-up tasks:** None generated. This was the last task in Milestone M5 (persistence) — completing it. Next unblocked tasks: QA-5 (preset round-trip fidelity test) and QA-2 (cross-browser functional pass), both now unblocked; QA-4 (latency measurement) was already unblocked.

**Approval status:** Approved by user. Status set to `completed`.

---

## QA-5 — Preset round-trip fidelity test

- **Status:** awaiting-approval
- **Delegation:** Performed directly (no subagent) — a small, self-contained verification task, not a build task; I already had the browser environment and mocking pattern set up from PS-3's own verification.

**Method:** Set every parameter of all 6 Core MVP node types (14 params total) to distinctive, non-default decimal values via their real `<input type="range">` sliders (genuine `input` events, same code path a real drag produces). Verified both persistence paths this project ships:
1. **Autosave (PS-2)** — checked the raw `localStorage` autosave entry immediately after the slider changes (exact match), then did a **genuine full page reload** and restart, and compared `AudioGraph.getModel()` (the live audio graph's own committed model — the strongest possible check, since it reflects what's actually wired into the `AudioParam`s) against all 14 expected values.
2. **Named presets (PS-3)** — saved the tuned chain as "QA5 Fidelity Test" via the real Save As button, deliberately diverged one param (`n2.threshold` to `-40`) to make a false-positive pass impossible, then Loaded the preset back and re-compared against `AudioGraph.getModel()`.

**A real finding investigated, not just an initial pass/fail:** the first read of `AudioGraph.getModel()` immediately after clicking Load (same script execution/tick) still showed the diverged `-40`, not the restored `-18` — a mismatch. Traced to the same async-commit behavior AE-4/PS-2 already documented: `buildGraph()` commits its internal model on a deferred `setTimeout` (~20ms later), so reading `AudioGraph.getModel()` synchronously in the same tick as the click reads the stale pre-load model. Confirmed this was a test-timing artifact, not a product defect, by checking `window.ChainCanvas.getCurrentModel()` (the synchronous source of truth) at that same instant — already correct — and by re-reading `AudioGraph.getModel()` moments later in a separate script execution, which had by then caught up. Full QA record: [docs/ultron/qa/qa-5-preset-round-trip-fidelity.md](qa/qa-5-preset-round-trip-fidelity.md).

**Validation evidence:**
1. All 14 slider-set values confirmed exactly reflected in `window.ChainCanvas.getCurrentModel()` immediately after setting them.
2. Autosave path: exact match (0 mismatches) against `AudioGraph.getModel()` after a genuine page reload.
3. Named-preset path: exact match (0 mismatches) against `AudioGraph.getModel()` after Save As → deliberate divergence → Load, once the async-commit timing artifact above was accounted for.
4. Test server stopped by its specific PID (88604), not a broad image-name kill.

**Acceptance criteria:**
- ✅ Saved/loaded presets (and autosave) reconstruct identical node graphs and parameter values — independently confirmed across all 6 node types and all 14 parameters, via both persistence paths, against the live audio graph's own committed model.

**Deviations:** None.

**Follow-up tasks:** None generated. Next unblocked task: QA-2 (cross-browser functional pass) — also needs to re-check AE-10's known limiter-overshoot limitation and RQ-4's Safari watch items, both only tested in Chrome so far.

**Approval status:** Approved by user. Status set to `completed`.

---

## QA-2 — Cross-browser functional pass

- **Status:** awaiting-approval
- **Delegation:** Performed directly (no subagent). **A real scope decision was surfaced to the user before doing any work**, not silently resolved: this Windows machine cannot run Safari at all (WebKit/macOS-only — an environment constraint, not a tooling gap), and testing Firefox/Edge would mean driving them via computer-use screen automation rather than this project's established precise console/JS tooling. Presented via AskUserQuestion with three options (full computer-use pass on Firefox+Edge / Chrome-only with Chromium-equivalence reasoning for Edge / skip the formal matrix entirely). **User chose to skip the formal cross-browser matrix**, given the project's real-world context (portfolio piece + the user's brother's karaoke events — a two-person use case, not a broad public release).

**What was actually done:** one full, continuous, end-to-end user journey in Chrome (the only browser this project has been built/tested against throughout) — cold load → Start → drag-add a node → reorder → remove → toggle Bypass → tune a param → save a named preset → **genuine full page reload** → restart → verify exact restoration. This is the first pass in the whole project that runs one unbroken session rather than isolated per-feature tests, specifically to catch integration issues per-feature testing could miss.

**Changed files:** None — this was a verification task. New file: [docs/ultron/qa/qa-2-cross-browser-functional-pass.md](qa/qa-2-cross-browser-functional-pass.md) (full step-by-step table + the scope-decision writeup).

**Validation evidence:**
1. 10-step Chrome journey (see QA record for full table) — every step passed, including the two highest-value checks: the post-reload restoration (7-node chain, tuned compressor ratio, removed limiter, all correct) and Bypass correctly defaulting back to OFF after a fresh Start (bypass engagement itself is not meant to persist, only the chain — confirmed it doesn't).
2. Console checked after the two riskiest points (Save, and the post-reload restart) — zero errors, zero warnings, throughout.
3. Test server stopped by its specific PID (48800), not a broad image-name kill.

**Acceptance criteria:**
- ⚠️ **Partially met, by explicit user decision.** The original criterion (full bar on Chrome/Edge/Firefox, core bar on Safari) is not fully satisfied — Edge, Firefox, and Safari remain genuinely unverified, not passing. Chrome itself is verified thoroughly via a real end-to-end journey, not just isolated feature checks, and is documented as the sole recommended browser for real events going forward.

**Deviations:** Scope reduced from the original 4-browser matrix to Chrome-only verification, by explicit user decision after being presented with the real environment constraint (no Safari possible on Windows) and the tooling tradeoff (Firefox/Edge only reachable via slower, less rigorous computer-use automation). Not a deviation discovered mid-implementation — surfaced and decided before any testing work began.

**Follow-up tasks:** If broader browser support is ever wanted, [research/rq4-safari-web-audio-quirks.md](../research/rq4-safari-web-audio-quirks.md)'s committed checklist is the concrete starting point for Safari, and this task's Chrome journey is a ready-made script to replay against Firefox/Edge. Not scheduled as a task — noted for future reference only. Next unblocked task: QA-3 (soak test, depends on QA-2) and QA-4 (latency measurement, already unblocked) remain.

**Approval status:** Approved by user. Status set to `completed`.

---

## QA-3 — Soak test (2–4hr continuous run)

- **Status:** awaiting-approval
- **Delegation:** N/A — no new test was run. **A real tooling constraint was surfaced to the user before proceeding**: this environment cannot block-wait 2–4 hours (long sleep-chains are explicitly disallowed by this session's own tooling), so the task's literal spec wasn't directly executable here. Presented via AskUserQuestion with three options (a ~20-30min compressed real-time proxy run / reasoning from QA-1's existing results / handing the user a self-contained test to run themselves for the real duration). **User chose to skip a dedicated soak test and rely on QA-1's already-completed results**, given this project's real-world context (portfolio piece + the user's brother's karaoke events).

**Reasoning basis (documented in full in [docs/ultron/qa/qa-3-soak-test.md](qa/qa-3-soak-test.md)):** QA-1 already put `AudioGraph`'s node lifecycle through 250 rapid structural edits with zero leaked references and the live audio path measurably intact afterward — the failure mode most likely to cause unbounded growth. A static, already-built chain processing continuously (the real steady-state condition during an event) is a less demanding condition than that rapid-churn stress case. Honestly noted as a gap, not elided: this does NOT directly cover sustained steady-state processing over real elapsed hours (e.g., possible slow accumulation inside the browser's own audio pipeline, or the Reverb `ConvolverNode`'s continuous processing) — a different failure mode than QA-1 tested, called out explicitly in the QA record rather than silently assumed covered.

**Changed files:** None — no test was executed. New file: [docs/ultron/qa/qa-3-soak-test.md](qa/qa-3-soak-test.md) (full reasoning writeup, including the explicit gap this doesn't cover).

**Acceptance criteria:**
- ⚠️ **Not directly verified — accepted by explicit user decision, not proven.** "No crash, no unbounded memory growth over the full run" was not measured; the user chose to accept this risk given the low-stakes real-world context rather than spend further effort testing it.

**Deviations:** Full task scope (dedicated 2-4hr run) not executed. Explicit, informed user decision made before any work began, not a shortcut taken mid-task.

**Follow-up tasks:** None scheduled. If this ever becomes a real concern (a host reports audio degrading during a long event), the QA record documents two ready options (compressed-proxy run, or a self-run test on real event hardware) to close the gap for real. Next unblocked task: QA-4 (latency measurement) — already unblocked, was never gated on QA-2/QA-3.

**Approval status:** Approved by user. Status set to `completed`.

---

## QA-4 — Latency measurement & documentation

- **Status:** awaiting-approval
- **Delegation:** Performed directly (no subagent) — a measurement task.

**The real gap, stated up front (same honesty standard as QA-2/QA-3):** a true mic-to-speaker round trip needs physical audio hardware in the same room, which this dev environment doesn't have — every test in this project, this one included, uses a synthetic mocked `getUserMedia`. Unlike QA-2/QA-3, this wasn't put to the user as a scope choice — there's a real, achievable measurement to do regardless (see below), so it was just done and the gap documented rather than asked about.

**What was measured, all real numbers, none fabricated:**
1. **Browser-reported context latency** from a live `AudioContext`: `baseLatency` = 10ms, `outputLatency` = 40ms (feature-detected per RQ-4's guidance) — real for this dev machine's audio stack, expected to differ on the actual event laptop/interface.
2. **Latency added by the app's own 6-node effect chain, measured empirically**: a single-sample impulse was injected at the chain's real input (via `AudioGraph.getNodeInstance('n1')`) and detected at the chain gate's output via a one-off diagnostic `ScriptProcessorNode` tap (sample-accurate timing via `audioContext.currentTime` scheduling vs. the tap's `playbackTime`) — a legitimate, precise, one-time diagnostic use, not a re-introduction of `ScriptProcessorNode` into the shipped app (RQ-5's deprecation guidance was about production code, not a throwaway measurement script). Delay's mix was zeroed first so its deliberate 300ms creative effect wouldn't be counted as unwanted latency. Result: empty-chain baseline 46.4ms (dominated by the diagnostic tap's own buffer size, not the app) vs. full 6-node chain 58.4ms → **≈12ms genuinely added by the app's own processing**, isolated by taking the difference rather than trusting either absolute number.

**Changed files:** None — measurement only. New file: [docs/ultron/qa/qa-4-latency-measurement.md](qa/qa-4-latency-measurement.md), including a concrete, low-effort real-world test (slow-motion-video clap test) recommended for the user/brother to get the true acoustic number on actual event hardware.

**Validation evidence:**
1. Both measurements re-derived from real, live `AudioContext` state and a genuine sample-accurate impulse-detection test — not estimated or looked up.
2. Console checked after the diagnostic test — only the two expected `ScriptProcessorNode` deprecation warnings from the one-off tap itself, zero actual errors.
3. Test server stopped by its specific PID (68544), not a broad image-name kill.

**Acceptance criteria:**
- ✅ A real, honest latency number is recorded and shared — satisfied for the software-controllable component (≈12ms app-added latency, plus real browser-reported baseLatency/outputLatency). The hardware-dependent component (true acoustic round-trip) remains unmeasured, honestly flagged, with a concrete follow-up test provided — consistent with this task's own "documented, not gated" bar.

**Deviations:** None from the finalized approach — the empirical impulse-injection method was designed specifically to give a real (not estimated) number for the one thing actually measurable in this environment, rather than reporting only the passive `baseLatency`/`outputLatency` readout.

**Follow-up tasks:** The slow-motion-video clap test documented in the QA record is the concrete way to close the remaining hardware-dependent gap — not scheduled as a task, left for the user/brother to run whenever convenient. Next unblocked task: DEL-2 (package + host run instructions) — the last task in Milestone M6, now unblocked (QA-2 and QA-3 both resolved, even if by descope).

**Approval status:** Approved by user. Status set to `completed`.

---

## DEL-2 — Package + host run instructions

- **Status:** awaiting-approval
- **Delegation:** Performed directly (no subagent) — the last task of the whole Core MVP build.

**A real gap found and fixed, not just packaged around:** `index.html` was loading SortableJS from a CDN — directly conflicting with DEL-1's own acceptance criteria ("no internet dependency assumed... mirrors 'locally hosted' event context"). An empty `vendor/.gitkeep` from DEL-1 suggests this was anticipated but never followed through on. At a venue with no/unreliable internet, drag-and-drop would have silently failed. Fixed by vendoring the exact pinned version (SortableJS 1.15.7, MIT) into `vendor/sortable.min.js` and repointing the script tag — re-verified functionally via a real drag-and-drop add against the vendored file, not just confirmed by file presence.

**Changed/new files:**
- `vendor/sortable.min.js` — new. Vendored dependency (see above).
- `index.html` — one script tag repointed from the CDN URL to the local vendor file.
- `start.bat` / `start.command` — new. Double-clickable launchers (Windows/Mac) that `cd` to their own directory, detect `python`/`python3`, start a local static server on port 8000, and auto-open the browser — with a clear, plain-language error if Python isn't found, rather than a cryptic failure.
- `README.md` — new. Plain-language host instructions (the user's brother, non-technical), covering setup through troubleshooting, with **Emergency Bypass** (including its spacebar shortcut) given deliberately prominent, "hit it first, ask questions later" treatment, consistent with this whole project's own stated priority on that control.
- `karaoke-chain-builder.zip` — new, sent directly to the user. A real distributable package containing only what the host needs (excludes `docs/ultron/` and `.claude/`, which are for the user's own portfolio/dev use, not the host).

**Why a local server, not `file://`:** deliberately considered and rejected — the Reverb node's IR loading uses `fetch()`, which `file://` blocks via CORS, so opening `index.html` directly would silently break Reverb. The launcher scripts provide a real local server without requiring the host to know why.

**Validation evidence:**
1. Ran the exact server command the launchers use directly from the project root — confirmed both `index.html` and the newly-vendored SortableJS file serve correctly (HTTP 200).
2. Re-verified the vendored dependency **functionally**, not just by file presence: loaded the app from that real server, started the engine, performed a real drag-and-drop add via the actual `Sortable` handlers — `window.Sortable.version` confirmed `"1.15.7"` (matching the prior CDN-pinned version exactly), zero console errors.
3. `start.bat`'s underlying logic verified directly (the only OS testable on this machine); the double-click launch itself (including the auto-browser-open step) was not separately fired, to avoid popping an unprompted browser window on the user's desktop — the command it runs was confirmed working end-to-end instead.
4. Package contents double-checked by listing the actual zip entries — confirms the correct host-facing file set.
5. **Honestly flagged gap**: `start.command` could not be executed or tested at all — same hard environment constraint as Safari in QA-2 (no Mac available). Written carefully, mirroring the verified Windows logic, executable bit set, but genuinely untested.

**Acceptance criteria:**
- ⚠️ **Likely met on Windows, unverified on Mac.** Full record and reasoning: [docs/ultron/qa/del-2-package-host-instructions.md](qa/del-2-package-host-instructions.md).

**Deviations:** Scope expanded beyond the literal task description to fix the CDN-dependency gap found during this task — a necessary correctness fix for the "no internet dependency" requirement DEL-1 already committed to, not a design change requested in advance.

**Follow-up tasks:** Before the first real event, actually double-click `start.command` on a real Mac once (and `start.bat` on the real event laptop), to confirm the full launch — including the auto-browser-open step this task's own testing deliberately avoided triggering — works end-to-end. This is the single most valuable remaining check before live use. No task scheduled for it; left for the user/brother to run whenever convenient, same pattern as QA-4's real-hardware latency test.

**Approval status:** Approved by user. Status set to `completed`. **This was the final task in plan.md — the whole Core MVP task list (28 tasks, 6 lanes, 6 milestones) is now complete.**
