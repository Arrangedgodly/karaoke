# Deep Research Summary — Node-Based Web Audio Chain Builder

Source plan: [../plan.md](../plan.md). Six research questions investigated by five parallel tracks (RQ-5 and RQ-6 shared one track as both are Fast-Follow DSP feasibility). All primary sources fetched/verified 2026-08-26.

## Decision Matrix

All six rows approved by the user as recommended, in one gate pass following this summary's presentation.

| ID | Track file | Affected tasks | Priority | Recommendation | Confidence | Status |
|---|---|---|---|---|---|---|
| RQ-1 | [rq1-audio-graph-reconnect.md](research/rq1-audio-graph-reconnect.md) | AE-4, AE-5–AE-10, UI-3, QA-1 | P0 | Single dedicated "chain gate" `GainNode`; duck→splice→un-duck on every insert/remove/reorder using `AudioParam` ramps (15–20ms); connect-new-before-disconnect-old; rewire only on drag **drop**, never on drag-move; reuse node instances across reorders (never recreate); explicit dispose (disconnect + dereference) on removal; never recreate the mic source node | Medium-High | **committed** |
| RQ-2 | [rq2-drag-and-drop.md](research/rq2-drag-and-drop.md) | UI-3, (minor note to DEL-1) | P0 | SortableJS (vanilla JS, `forceFallback: true`), no framework adopted | High (ruling out native DnD / node-graph libraries) / Medium-High (vs. custom pointer-events) | **committed** |
| RQ-3 | [rq3-reverb-impulse-response.md](research/rq3-reverb-impulse-response.md) | AE-9 | P1 | Bundle "IR Rollo Transparent Plate.wav" (Rollo145, Freesound.org, CC0 1.0, 284.9KB stereo WAV) | High | **committed** |
| RQ-4 | [rq4-safari-web-audio-quirks.md](research/rq4-safari-web-audio-quirks.md) | QA-2 (checklist), AE-1 (2 new requirements) | P1 | AE-1 must call `resume()` synchronously inside the originating click handler (not after `await getUserMedia()`) and request `{echoCancellation:false, noiseSuppression:false, autoGainControl:false}`; QA-2 gets a 7-point Safari checklist including 2 low-confidence "watch items" (possible audio-pipeline glitch/silence bug, possible >10kHz attenuation) that escalate from known-issue to must-fix if reproduced | High (stable facts) / Low-Medium (2 watch items — most recent evidence is 2022-23) | **committed** |
| RQ-5 | [rq5-rq6-fastfollow-dsp-feasibility.md](research/rq5-rq6-fastfollow-dsp-feasibility.md) | Future Noise Gate task (Fast-Follow) | P2 | GO — custom `AudioWorkletProcessor` (RMS/peak + threshold + hysteresis) or adapt `@sapphi-red/web-noise-suppressor`'s `NoiseGateWorkletNode` (MIT, actively maintained). Re-size from "Small" to "Small-to-Medium"; flag async `addModule()` node-creation lifecycle as a design wrinkle for AE-2/AE-4 to accommodate when this is eventually built | High | **committed** |
| RQ-6 | [rq5-rq6-fastfollow-dsp-feasibility.md](research/rq5-rq6-fastfollow-dsp-feasibility.md) | Future Autotune task (Fast-Follow) | P2 | NO-GO for the next Fast-Follow pass. Building blocks exist (Signalsmith Stretch, MIT, actively maintained) but "autotune" requires assembling pitch detection + shifting + a key/scale quantizer control loop — a qualitatively larger, more open-ended effort than any other node in the app (sized Large vs. Small/Small-Medium elsewhere). Recommend dropping from the near-term roadmap; keep only as a separately time-boxed future spike if revisited | Medium-High | **committed (deferred spike, not scheduled)** |

## Cross-cutting notes

- **No conflicts found between tracks.** RQ-1's "rewire only on drop" requirement is directly corroborated by RQ-2's chosen library exposing an `onEnd`-style commit callback — the two tracks independently converged on the same interaction model.
- **RQ-4 surfaced two concrete requirements for AE-1** even though it was scoped as "informs QA-2 only" — routed to AE-1 below since ignoring them risks a silent Safari failure (audio never starts) that QA-2 would only catch after the fact.
- **RQ-4's two "watch items" are a genuine residual risk**, not resolved by this research: if either reproduces during QA-2 testing on real Safari 26.x, it would cross from "acceptable known issue" into "breaks core-functionality bar" territory. This doesn't change any decision now, but QA-2's task detail should carry an explicit escalation rule (see plan.md update below) — and if it does escalate, that's a signal to revisit, not a town-hall-level scope change on its own, since Safari's tier was always "core-functionality-only," not "full support."
- **RQ-6's NO-GO changes the Fast-Follow sketch** from "6 items to plan later" to "5 items + 1 explicitly deferred spike" — flagged for explicit user disposition since it's a real recommendation to drop something the user asked about, not just a technical fact.

## Plan.md updates applied (pending gate approval below)

- AE-4: status `blocked` → `pending`; task detail replaced with the concrete chain-gate design from RQ-1.
- AE-5–AE-10: status `blocked` → `pending`; task detail notes "create once on add, reuse across reorders, explicit dispose on remove."
- UI-3: status `blocked` → `pending`; task detail specifies SortableJS + `forceFallback:true`, rewire-on-drop only.
- AE-9: status `blocked` → `pending`; task detail specifies the exact IR file and fetch/bundle steps.
- AE-1: task detail gains two explicit requirements (synchronous `resume()`, explicit false audio constraints).
- QA-1: task detail gains the specific RQ-1 leak/glitch test protocol (hundreds of rapid reorders, monitor node count).
- QA-2: task detail gains the 7-point Safari checklist with the 2-item escalation rule.
- Fast-Follow sketch: Noise Gate annotated GO/Small-Medium; Autotune re-labeled "deferred spike, not scheduled" pending user disposition.

## Gate

Every row above needs an explicit user disposition (approve / revise / defer / reject) before plan.md is finalized and handed to `$production`. See the chat message following this summary for the grouped approval questions.
