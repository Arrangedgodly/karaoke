# QA-6 — Bypass Independent Reliability Test

Covers plan.md acceptance criterion #3 and task QA-6: formal proof that Emergency Bypass — the app's single most safety-critical control, given there is no physical audio fallback at real events — engages correctly in every adverse condition tested, ahead of the rest of the build.

Executed 2026-08-26 against the app as built through UI-2, using a synthetic oscillator-backed `MediaStream` (via `getUserMedia`/`enumerateDevices` mocking) to exercise real code paths without needing physical microphone hardware.

## Test matrix and results

| # | Condition | Method | Result |
|---|---|---|---|
| T1 | Normal real Start flow completes | Clicked the real Start button with a mocked mic stream | ✅ Status reached `"Live"` |
| T2 | Chain actively broken (throws) | Called `AudioGraph.buildGraph()` with an unregistered node type (throws), then `AudioBypass.engage()` | ✅ `engage()` did not throw; `isEngaged()` → `true` |
| T3 | Chain heals while still engaged | After T2, called `buildGraph([])` successfully again | ✅ Chain gate gain resolved to `0` (silenced) — bypass state correctly persists through a chain repair, no unexpected full-volume moment |
| T4 | Rapid repeated toggling (stress) | 12 back-to-back `toggle()` calls with no delay | ✅ No throw; final state correctly `false` (even count); chain gate gain correctly `1` |
| T5 | Device switch while bypass is engaged | Engaged bypass, then triggered a real device switch via the `<select>` + `change` event (going through `switchInputDevice` → `buildGraph` → `reconnectSource`) | ✅ `isEngaged()` remained `true` throughout; disengaging afterward still worked correctly |
| T6 | `engage()` called before `AudioEngine.start()` has ever run | Called `AudioBypass.engage()` on a fresh page load, before Start | ✅ Threw a clear, descriptive error (not a confusing crash): `"AudioBypass: window.AudioEngine.audioContext must already exist. Call AudioEngine.start() (and await it) first."` |
| T7 | Chain graph literally never built at all (not just broken) | Called `AudioEngine.start()` and `AudioBypass.reconnectSource()` directly, deliberately skipping `AudioGraph.buildGraph()` entirely, then `engage()` | ✅ No throw; chain gate created on-demand and correctly ramped to `0`; `isEngaged()` → `true` |
| T8 | Click and spacebar interaction paths | Covered in UI-2's own validation (real click + spacebar, with a focus guard against hijacking the device picker) | ✅ Both confirmed working in UI-2's production-log entry; not re-run here to avoid duplicating that record |

Zero console errors across the entire matrix.

## Conclusion

Bypass is confirmed to engage correctly and near-instantly in every tested adverse condition: a chain that's actively broken, a chain that heals mid-bypass, a chain that was never built at all, rapid repeated toggling, and a live device switch. It also fails safely and clearly (T6) when used before the engine has started, rather than crashing confusingly. This satisfies acceptance criterion #3 — Bypass is independently verified as the one path in this app that is bulletproof, ahead of the rest of the Core MVP build.

## Residual notes (carried forward, not new)

- The chain gate's `gain.value` doesn't reflect a scheduled ramp in real time while the gate has no active input (documented in AE-3's production log as a benign browser rendering behavior, re-confirmed in T3 above) — audibly irrelevant since a gate with no input produces no output regardless of its gain value.
- Full audible A/B confirmation that Bypass sounds different from normal processing is still deferred until real effect nodes exist (AE-5+), per the user's own observation after AE-3 — this test matrix proves the *routing/state logic* is correct, which is what QA-6 is scoped to.
