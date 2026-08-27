# Node-Based Web Audio Chain Builder — Town Hall Brief

Status: **Approved** (all clusters signed off — see Sign-off Status)

## Problem Statement & Target Users

The user's brother runs locally-hosted karaoke events where the microphone feed is currently completely flat/unprocessed. This app lets the event host build a live vocal effects chain (reverb, delay, compression, and more) by dragging effect nodes into a visual arrangement, processed in real time via the browser's native Web Audio API and sent straight to the room's PA.

The project serves three audiences simultaneously:
- **The builder** — a portfolio/technical showcase of a hard integration (drag-and-drop UI dynamically rewiring a live Web Audio graph).
- **The host (brother)** — the actual operator, who builds/adjusts the chain between or before songs. Singers and guests never interact with the UI directly.
- **Karaoke guests** — general-public listeners who only experience the processed audio output, not the interface.

This is a real, validated need: commercial karaoke hardware commonly includes a fixed echo/reverb dial for exactly this reason. This app's value-add is a flexible, visual, browser-based chain instead of a fixed hardware dial — with no dedicated hardware required.

## Proposed MVP

### Core MVP (v1) — must work end-to-end, proves the concept, usable at a real event
- Mic input via `getUserMedia` → drag-and-drop node graph with correct live audio reconnect on reorder (the central technical challenge) → output.
- Effect nodes: **Gain/Trim, Compressor, EQ, Reverb, Delay, Limiter**, arranged between fixed Mic Input and Output anchor nodes.
- **Emergency Bypass** control — instantly reconnects Mic → Output directly, skipping the entire effect chain (critical since there is no physical audio fallback at the event — see Risks).
- Browser support: Chrome, Edge, Firefox, and Safari desktop (tiered — see Success Measures).
- `localStorage` autosave of the last-used chain, plus basic named preset save/load.

### Fast-Follow — same project, sequenced after Core MVP works
- Additional effect nodes: **Noise Gate, Distortion, Chorus**.
- Preset JSON export/import (portability across devices/backup).
- A small **static, hosted factory-presets JSON file** (curated defaults like "Classic Karaoke", "Radio Voice") fetched by the app — a static asset, not a backend.
- **Autotune / light pitch correction** — explicitly optional and feasibility-gated. The Web Audio API has no native pitch-shift node; this would require an AudioWorklet with custom or WASM-based DSP. Deep-research determines go/no-go; not committed scope.

### Explicit Non-Goals
- Recording or exporting the processed audio (live-monitor only).
- Mobile/tablet support (desktop-only for MVP).
- Multi-user accounts, cloud sync, or a shared/community preset library (the factory-presets file is static and one-directional).
- Full WCAG accessibility compliance (best-effort only — see Role Perspectives).
- Singers/guests operating the UI during a performance (host-only, between/before songs).

## Primary Journey & Important States

1. Host opens the app on the event laptop, grants mic permission, and selects the correct input device if more than one is available.
2. Host clicks **Start Processing** (required — browsers block audio until the AudioContext is resumed by a user gesture).
3. Host drags effect nodes from a palette onto a canvas and arranges/reorders them; the live audio graph reconnects to match with no clicks, pops, or dropouts.
4. Host tunes each node's parameters by ear (reverb mix, delay time, compression ratio, etc.).
5. Host saves the arrangement as a named preset (or relies on autosave) for reuse across songs and future nights.
6. Between songs, host swaps or tweaks presets as needed.
7. If something misbehaves mid-song, host hits **Emergency Bypass** for an instant clean passthrough while investigating — the room is never left silent.
8. The app runs for the full event (multiple hours) without needing a restart.

Important states to design for: no/denied mic permission; multiple input devices requiring a picker; AudioContext suspended vs. running; empty vs. populated chain; mid-drag (audio still flowing on the old arrangement until drop completes); bypass engaged vs. normal processing; unsaved-changes vs. loaded-preset; and recovery behavior if the input device disconnects or the laptop sleeps mid-event.

## Success Measures & Acceptance Criteria

1. Core signal path works and sounds correct: mic → chain (in the visually-arranged order) → output.
2. Reordering nodes live never produces an audible click, pop, or dropout, and never leaks disconnected node references (verified via manual node-count/heap inspection).
3. Emergency Bypass is independently tested as the one must-be-bulletproof path — engages in near-real-time regardless of what state the rest of the chain is in.
4. At least one full event-length (2–4 hour) soak test is run before first real-event use, monitored for memory growth and crashes.
5. Chrome, Edge, and Firefox are held to a full functional + stability bar. Safari is validated for core functionality only (mic in, hear effects, reorder, bypass); any Safari-specific latency/quirk gaps are documented as known issues, not release blockers.
6. Actual round-trip latency (mic-in to speaker-out) is measured and documented on real event hardware — reported transparently, not gated against a hard ceiling.
7. Presets (both autosave and named) round-trip correctly: reloading reconstructs the same node graph and parameter values.

## Constraints, Assumptions, Dependencies, Risks

**Constraints**
- Fully client-side, static-hosted app. The only exception is a static factory-presets JSON file (Fast-Follow) — not a real backend, no accounts, no server-side storage.
- Must survive multi-hour live sessions with **zero physical audio fallback** — if the app fails, the room loses sound unless the software itself recovers or the host hits Bypass.
- Desktop-only for MVP.

**Assumptions**
- The event laptop has adequate CPU headroom to run several real-time Web Audio nodes without dropouts (reasonable for modern hardware; a risk on older machines).
- Any standard input device (built-in mic, USB mic, or audio interface) works via `getUserMedia`; a device picker handles selection when multiple are present. Exact hardware at the events wasn't fully specified and doesn't change the build.

**Risks**
- **Latency**: Browser Web Audio latency (~20–150ms) is real and is *accepted as a known limitation*, not gated — could read as slapback/doubling to a sensitive singer, mitigated by minimizing where cheap and reporting actual measured latency honestly.
- **No fallback**: The app is the room's only audio path. Mitigated primarily by the Emergency Bypass control, the soak-test requirement, and the tiered browser reliability bar.
- **Safari quirks**: Historical Web Audio/AudioContext/getUserMedia quirks in Safari may surface unexpected issues; scoped to a core-functionality-only bar so this can't block release.
- **Live graph reconnect**: The central technical risk named in the original idea — clicks/pops/leaks when dynamically rewiring the audio graph during drag-and-drop. Directly covered by acceptance criterion #2 and owned by deep-research for architecture.
- **Autotune feasibility**: Genuinely unknown/unproven within reasonable effort; treated as optional and research-gated, never committed scope.
- **Reverb realism**: Depends on sourcing a decent, appropriately-licensed impulse-response sample for the `ConvolverNode`; a poor IR will sound obviously wrong.

## Role Perspectives

**Product / User Value** — Supports: solves a validated real need with more flexibility than a fixed hardware dial, while doubling as a strong portfolio piece. Concern: serving three audiences at once could pull the design in different directions; resolved by keeping the UI's actual audience singular (host-only operation). Opportunity/risk: real-event validation is rare for a portfolio piece, but a bad first impression at a real event has real social cost. Smallest experiment: use Core MVP at one actual karaoke night before adding Fast-Follow features.

**UX / UI** — Supports: node-based drag-and-drop is intuitive for arranging a signal chain and visually compelling for the portfolio angle. Concern: the host operates under real-time pressure between songs, so speed of use matters as much as visual appeal — drag targets, parameter controls, and Bypass all need to be fast to hit. Risk: a 6-9 node palette could slow the host down if not organized well. Smallest decision: Emergency Bypass must be the single most prominent, hardest-to-miss control in the UI.

**Frontend / Technical** — Supports: the live graph-rewiring challenge is exactly the "unique spin" that makes this worth building. Concern: genuinely hard to make glitch-free and leak-free over a multi-hour session — this is the project's central risk. Dependency: needs deep-research to settle the reconnect strategy (e.g., gain-ramp crossfades, node lifecycle/cleanup) and the drag-and-drop approach before production starts. Smallest experiment: a throwaway two-node reorder prototype verifying no click/pop and no leaked references, before committing to an architecture.

**Backend / Data / Integrations** — Supports: staying fully client-side keeps this fast to build and ship as a static site. Concern: the one exception (static factory-presets file) must stay bounded to a static asset and not drift into a real shared/dynamic backend. Decision: no server, database, or accounts, for MVP or Fast-Follow.

**Quality / Reliability** — Supports: the soak-test + Emergency-Bypass approach gives a concrete, testable reliability bar instead of an open-ended "must never crash" promise. Concern: with no physical fallback, software reliability directly determines whether a real room goes silent — the highest-stakes risk in the project. Dependency: at least one full event-length soak test before first real use. Smallest decision: build and test the Bypass path first and independently, since it must work even if everything else fails.

**Security / Privacy** — Supports: all processing happens locally in-browser; no mic audio is ever transmitted or stored (live-monitor-only, no recording), a strong and simple privacy story for a room of guests. Concern: minimal — standard `getUserMedia` permission prompts, no accounts, no PII collected.

**Accessibility** — Supports: deliberately scoped to best-effort (semantic HTML, labeled controls where cheap), matching the single-operator, build-fast context. Concern: pure drag-and-drop with no keyboard alternative is a known, accepted gap — a conscious trade-off, not an oversight. Disposition: explicit non-goal for MVP; revisit only if the portfolio angle later requires it.

**Domain Accuracy (Pro-Audio)** — Supports: the Core MVP node set (Gain, Compressor, EQ, Reverb, Delay, Limiter) mirrors a realistic live-vocal chain, lending the demo real credibility. Concern: Reverb realism depends on impulse-response quality; browser latency is a step down from what audiences expect from dedicated hardware echo units (already priced in as an accepted risk). Dependency: IR asset sourcing/licensing is a deep-research item. Smallest decision: source 2-3 small, well-regarded free/CC-licensed IR samples rather than producing original ones.

## Decisions & Rationale

1. **Core MVP / Fast-Follow split**, not building everything at once. Rejected: shipping all 9 node types + full preset system + 4-browser QA simultaneously (unrealistic against "build fast"); rejected: trimming the node set down (the user confirmed real desire for the fuller set — sequencing resolves the tension without cutting).
2. **Host-only operator**, not singer-adjustable. Rejected: allowing performers to adjust live (unneeded complexity; the host is confirmed as sole operator).
3. **Live-monitor only**, no recording/export.
4. **Fully client-side**, no backend except a static presets file. Rejected: a dynamic/shared community preset library (too much scope for MVP; revisit later if desired).
5. **Desktop-only**, tiered browser support (Chrome/Edge/Firefox full bar, Safari core-functionality bar). Rejected: mobile/tablet support (not needed for a single-laptop, host-operated venue setup).
6. **Latency accepted as a known limitation**, not gated by a hard ceiling. Rejected: a hard latency requirement (disproportionate engineering risk; comparable hardware also adds latency and audiences are generally forgiving).
7. **No physical audio fallback exists** — the Emergency Bypass control is the primary software mitigation, backed by a mandatory soak test.
8. **Autotune is optional and research-gated**, not committed scope. Rejected: committing to it now (native feasibility is genuinely unproven; don't block MVP on an unresolved technical bet).
9. **Accessibility: best-effort only.** Rejected: full WCAG compliance in MVP (disproportionate given the single-operator, build-fast context).

## Open Questions & Disposition

| Question | Owner | Blocking? |
|---|---|---|
| Live audio-graph reconnect strategy (avoiding clicks/pops/leaks on reorder) | deep-research | Blocks production start |
| Drag-and-drop implementation approach (library vs. custom) | deep-research | Blocks production start |
| Reverb impulse-response asset sourcing/licensing | deep-research | Blocks only the Reverb node |
| Safari-specific Web Audio/getUserMedia quirks | deep-research | Informs only, non-blocking |
| Noise Gate implementation approach (no native Web Audio node) | deep-research | Non-blocking (Fast-Follow item) |
| Autotune/pitch-correction feasibility | deep-research | Non-blocking, optional stretch |
| Exact factory-preset content (names/values) | production | Non-blocking (implementation detail) |
| Default shipped chain order (e.g., Input→Compressor→EQ→Reverb→Delay→Limiter→Output) | production | Non-blocking (implementation detail) |

## Sign-off Status

All clusters individually confirmed by the user in this session:
- ✅ MVP boundary & non-goals (Core MVP / Fast-Follow split accepted as proposed)
- ✅ Success measures & acceptance criteria (all 7 criteria accepted as proposed)
- ✅ Problem & users + primary journey & states (confirmed, no changes)
- ✅ Constraints, assumptions, risks & open-question ownership (confirmed, no changes)

No conditions attached to approval.

## Handoff Note for Plan-It-Out

Organize the Core MVP into bite-sized, dependency-aware tasks by role (frontend/audio-graph, UX/drag-and-drop, reliability/bypass, cross-browser QA). Note that the audio-graph reconnect strategy and drag-and-drop library choice are **not yet decided** — deep-research resolves those after planning, before production begins — so plan tasks at a feature/role level without assuming a specific technical approach. Fast-Follow items (Noise Gate, Distortion, Chorus, JSON export/import, static factory presets, autotune) should appear in the plan as a clearly sequenced later phase, not interleaved with Core MVP tasks. The Emergency Bypass control should be planned as an early, standalone task given its role as the primary reliability safety net.
