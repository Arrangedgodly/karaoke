# QA-2 — Cross-Browser Functional Pass

Covers plan.md acceptance criterion #5 and task QA-2. **Deliberately descoped from its original acceptance bar by explicit user decision — see below.**

## Original scope vs. what was actually done

QA-2 was originally scoped as: full functional + stability bar on Chrome, Edge, Firefox; core-functionality-only bar on Safari (per [research/rq4-safari-web-audio-quirks.md](../research/rq4-safari-web-audio-quirks.md)'s committed checklist).

That scope hit a real, un-workaroundable environment constraint: this project is built and tested on a Windows machine. **Safari is WebKit, macOS/iOS-only — there is no way to run or test it on Windows, full stop**, not a tooling gap that more effort closes. Firefox and Edge are both installed locally, but exercising them would mean driving each via screen/click automation (computer-use) rather than the precise console-reading, JS-evaluating tooling used for every other test in this project (the Browser pane tooling is Chromium-based) — genuine coverage, but slower and less rigorous per browser.

Presented with this tradeoff, the user explicitly chose (2026-08-27) to **skip the formal cross-browser matrix** given the project's real-world context: a two-person use case (the user's own portfolio piece, and their brother's locally-hosted karaoke events), not a broad public release with an unknown audience's browser mix. Decision: verify Chrome thoroughly, document it as the sole actively-recommended browser for real events, and leave Edge/Firefox/Safari explicitly unverified rather than spending effort simulating confidence the project doesn't actually need.

## What was done — a full end-to-end Chrome release-smoke-test

Every prior task in this project verified Chrome per-feature, in isolation. This is the first and only pass that runs one **continuous, single-session user journey** through the whole app, end to end — closer to how a real host would actually use it in one sitting, and more likely to catch an integration issue than N separate feature tests. Executed 2026-08-27 against the app as built through QA-5, mocked mic via `getUserMedia`/`enumerateDevices` per this project's established technique.

| Step | Action | Result |
|---|---|---|
| 1 | Cold load, fresh profile (`localStorage` cleared) | ✅ Status "Stopped", Bypass disabled, canvas gated, Presets dropdown pre-seeded with "Classic Karaoke" |
| 2 | Click Start (real button, mocked mic) | ✅ Status → "Live", `AudioContext.state` → "running", device list populated ("Mock Mic"), canvas un-gated, default 6-node chain loaded |
| 3 | Drag a new Gain node from the palette (real `Sortable` `onAdd`/`onSort` handlers) | ✅ 7th node added, model updated correctly |
| 4 | Reorder — move the new node to the front (real `onSort`) | ✅ Model order updated correctly, no errors |
| 5 | Remove the Limiter node (real remove-button click) | ✅ Node removed from DOM and model, 6 nodes remain |
| 6 | Toggle Emergency Bypass on, then off (real button) | ✅ Label and `AudioBypass.isEngaged()` correct both directions |
| 7 | Tune the Compressor's ratio slider to 12 (real `input` event) | ✅ Model updated; "unsaved changes" indicator appeared |
| 8 | Save the modified chain as a named preset ("Release Smoke Test", real button + stubbed `prompt`) | ✅ Appears in preset list, current-name display updated, unsaved indicator cleared |
| 9 | **Genuine full page reload** + restart | ✅ Exact 7-node chain (with the tuned compressor ratio = 12 and the limiter still removed) restored via autosave; Bypass correctly defaults back to OFF (bypass engagement itself is not meant to persist, only the chain); both presets ("Classic Karaoke" and "Release Smoke Test") still listed |
| 10 | Console check throughout | ✅ **Zero errors, zero warnings, at every step** — checked after the riskiest points (save, and the post-reload restart) |

## Conclusion

Chrome — the browser this project has been built and validated against throughout — passes a full, continuous, real-user-journey smoke test with zero defects and zero console noise, covering every Core MVP surface (start/stop, drag-and-drop add/reorder/remove, param tuning, Emergency Bypass, named presets, autosave-across-reload) in one sitting. This is the strongest single piece of evidence this project has that the app genuinely works end-to-end, not just feature-by-feature.

**Edge, Firefox, and Safari are explicitly unverified — not failing, not passing, simply not tested,** per the user's own scope decision above. Edge shares Chrome's Blink/V8 engine and Web Audio implementation lineage, so it carries comparatively low risk, but this is reasoning from engine equivalence, not a real test. Firefox (Gecko) is a genuinely different engine with no equivalence argument available. Safari carries the specific, evidenced risks already documented in [research/rq4-safari-web-audio-quirks.md](../research/rq4-safari-web-audio-quirks.md) (the gesture/`resume()` ordering trap, the possible >10kHz attenuation, the possible `ConvolverNode` long-session glitch) — none of which have been confirmed or refuted here.

## Recommendation carried forward

**Recommend Chrome as the only browser used at a real karaoke event until/unless Edge, Firefox, or Safari are separately verified.** If broader browser support is ever wanted, RQ-4's committed checklist (research doc above) is the concrete starting point for a real Safari pass, and this document's Chrome journey (steps 1–10) is a ready-made script to replay against Edge/Firefox first, since it's already proven to catch real issues if any exist.

## What still needs a human

Nothing here was gated on this being untestable by me — a human with access to an actual Mac (for Safari) or willing to sit through a manual pass in Firefox/Edge could close this gap directly at any time; it was descoped by choice, not by an unresolvable blocker for a human.
