# QA-5 — Preset Round-Trip Fidelity Test

Covers plan.md acceptance criterion #7 and task QA-5: documented verification that saved/loaded presets (and autosave) reconstruct identical node graphs and parameter values, not just the same node types/order.

Executed 2026-08-27 against the app as built through PS-3, via the real UI paths — actual `<input type="range">` sliders (dispatching a genuine `input` event, the same event a real drag produces), the real "Save As…" button (with `window.prompt` stubbed to supply a name), and the real "Load" button. Synthetic oscillator standing in for the mic, per the project's established technique.

## Method

Every Core MVP node type has at least one parameter; several have four. To make a fidelity failure impossible to miss, every parameter of all 6 node types in the default chain was set to a distinctive, non-default value in one pass:

| Node | Params set |
|---|---|
| Gain (n1) | gainDb: **7.5** |
| Compressor (n2) | threshold: **-18**, ratio: **8**, attack: **0.05**, release: **0.6** |
| EQ (n3) | lowGain: **-6**, midGain: **3.5**, highGain: **9** |
| Delay (n4) | timeMs: **450**, feedback: **60**, mix: **70** |
| Reverb (n5) | mix: **85** |
| Limiter (n6) | ceiling: **-3.5**, release: **200** |

All 14 values are decimals or otherwise distinct from every param's default, specifically to catch a truncation/coercion bug that whole-number test values could hide.

## Test 1 — Autosave path (PS-2), across a real page reload

After setting all 14 values via their real sliders, the raw `karaoke-autosave-v1` localStorage entry was inspected immediately (no reload yet) and already matched all 14 values exactly — confirming every param tweak, not just structural edits, reaches the autosave slot (this exercises the `onParamsChanged` → `Persistence.saveCurrentChain(chainModel)` hook added in PS-2/PS-3).

The page was then **genuinely reloaded** (full navigation, not an in-memory reset) and the engine restarted. `AudioGraph.getModel()` — the live audio graph's own committed model, the strongest possible check since it reflects what's actually wired into the `AudioParam`s, not just UI bookkeeping — was compared against all 14 expected values.

**Result: exact match, 0 mismatches.**

## Test 2 — Named-preset path (PS-3), Save As → diverge → Load

The tuned chain was saved as a named preset ("QA5 Fidelity Test") via the real Save As button. To prove Load genuinely restores the saved values (rather than the check trivially passing because nothing had changed), `n2.threshold` was deliberately diverged to `-40` via its slider before loading the preset back.

**A real finding investigated, not just an initial pass/fail:** immediately after clicking Load and reading `AudioGraph.getModel()` in the same script execution, `n2.threshold` still showed the diverged `-40`, not the saved `-18` — a mismatch. Rather than reporting this as a defect, it was traced to the same async-commit behavior AE-4 and PS-2 already documented and designed around: `AudioGraph.buildGraph()` commits its internal model on a deferred `setTimeout` (~20ms later), so reading `AudioGraph.getModel()` synchronously, in the same tick as the click, reads the stale pre-load model — a timing artifact of the test's own read, not of the Load itself.

**Confirmation this was a test-timing artifact, not a real bug:** `window.ChainCanvas.getCurrentModel()` (the synchronous source of truth `buildGraph()` is built from) already showed the correct restored `-18` at that exact same instant. A follow-up read of `AudioGraph.getModel()` moments later (a second, separate script execution) showed it had caught up and also read `-18` correctly. The full 14-value comparison was then re-run against `AudioGraph.getModel()` with this small delay accounted for.

**Result: exact match, 0 mismatches**, across all 6 node types and all 14 parameters.

## Conclusion

Both persistence paths this project ships — the implicit PS-2 autosave slot and PS-3's named presets — reconstruct byte-identical parameter values, across every Core MVP node type, verified against the live audio graph's own committed model (not just DOM/UI bookkeeping) and across a genuine page reload for the autosave path. The one apparent mismatch encountered during testing was chased to its root cause and confirmed to be the tester reading `AudioGraph.getModel()` before its documented ~20ms async commit had landed — not a product defect — and serves as independent, real-world confirmation that PS-2's and PS-3's design decision to always read `chainModel`/`getCurrentModel()` (never `AudioGraph.getModel()`) at the moment of a save was the correct call. This satisfies acceptance criterion #7.
