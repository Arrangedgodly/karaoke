# QA-3 — Soak Test (2–4hr Continuous Run)

Covers plan.md acceptance criterion (implicit, task-level: "No crash, no unbounded memory growth, over the full run") and task QA-3. **Deliberately descoped from a dedicated new test to reasoning from QA-1's existing results, by explicit user decision — no new soak test was run.**

## Original scope vs. what was actually done

QA-3 was originally scoped as one continuous 2–4 hour run of the live app, monitored for memory growth and crashes. That duration is not something achievable within a single interactive session — this environment's own tooling explicitly disallows long blocking waits (chained/extended sleeps), so a literal 2–4 hour unattended run was not directly executable here.

Presented with the real options — a compressed ~20–30 minute real-time proxy run, reasoning from [qa-1-reorder-glitch-leak-test.md](qa-1-reorder-glitch-leak-test.md)'s existing results, or handing the user a self-contained test page to run for the real duration themselves — the user chose (2026-08-27) to **skip a dedicated soak test entirely** and rely on QA-1's already-completed results plus this project's real-world context.

## Reasoning this rests on

1. **QA-1 (executed 2026-08-26, [full record](qa-1-reorder-glitch-leak-test.md))** already put the app's core stateful subsystem — `AudioGraph`'s node lifecycle (create/connect/disconnect) — through 250 rapid structural edits (adds/reorders/removes) with **zero leaked node references, zero thrown errors, and the live audio path fully intact afterward** (measured, not assumed, via a real `AnalyserNode` peak check). Disconnect-call discipline comfortably exceeded the theoretical minimum required. This is the failure mode most likely to cause *unbounded* growth (each edit creates new `AudioNode`s; a leak would mean old ones never get released) and it was directly measured, not inferred.
2. **A karaoke chain is structurally near-static during actual use.** The host builds/tunes a chain occasionally (between songs, or once at the top of the night), not continuously — the steady-state condition during a long event is a *fixed*, unchanging audio graph processing a live signal, which is a much simpler condition than QA-1's rapid-churn stress case. If the churn case is proven leak-free, the far-less-demanding static-processing case is lower risk, not higher.
3. **Real-world context**: this app serves the user's own portfolio and their brother's locally-hosted karaoke events — a two-person, known-hardware, known-usage-pattern context, not an unattended public deployment that needs to survive unknown/adversarial long-run conditions. The cost/benefit of a dedicated multi-hour test does not clear the same bar it would for a broader release.

## What this reasoning does NOT cover — an honest gap, not silently elided

QA-1's test specifically stresses *structural edits* (node creation/disconnection), not sustained *steady-state* processing of a static, already-built chain over hours — a different failure mode (e.g., slow accumulation inside the browser's own audio pipeline, the Reverb `ConvolverNode`'s continuous convolution processing, or event-listener/closure buildup from something outside the edit path). No direct evidence was gathered here that rules this out. This is exactly the class of risk RQ-4's Safari research separately flagged as a *watch item* for the Reverb node specifically (WebKit bug #221334 — progressive stutter/silence on long Safari sessions) — but that finding was Safari-specific; no equivalent long-run Chrome-specific issue is known or suspected, and Chrome is the only browser this app is verified against or recommended for (see [qa-2-cross-browser-functional-pass.md](qa-2-cross-browser-functional-pass.md)).

## Conclusion

QA-3 is marked complete by explicit user decision to accept this risk rather than spend further effort verifying it, given the low-stakes real-world context and the meaningfully-related evidence QA-1 already provides. This is a judgment call, not a technical proof — if the app is ever used for a longer or higher-stakes event than currently planned, or if Chrome's `ConvolverNode`/Reverb path is ever suspected of degrading over a real multi-hour session, a real soak test (the compressed-proxy or self-run options considered above) remains the way to close this gap for real.

## What still needs a human

If this ever becomes a real concern in practice (a host reports audio degrading partway through a long event), the fix is a real multi-hour run with memory sampled at intervals — either the compressed-proxy approach or a self-run test on the actual event hardware, both considered and available if wanted later.
