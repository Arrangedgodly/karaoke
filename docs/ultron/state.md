# Ultron State — Node-Based Web Audio Chain Builder

## Current Phase
`production` — **complete**. Whole-plan approved 2026-08-26; all 28 tasks across 6 lanes and 6 milestones executed and approved by 2026-08-27.

## Active Task
None — all tasks complete. Core MVP is release-ready (Milestone M6 done). See "What's next" below for optional, non-blocking follow-ups noted throughout the QA phase.

## Approval Cursor
DEL-1 through DEL-2: all completed and approved by user. Full plan.md task list finished.

## What's next (optional, not blocking — nothing here is a scheduled task)
- **Before the first real event**: double-click `start.command` on an actual Mac once, and `start.bat` on the actual event laptop, to confirm the launchers work end-to-end (DEL-2's one honestly-flagged untested gap — no Mac was available during development).
- **Real acoustic latency check**: the slow-motion-video clap test documented in QA-4, to get a true mic-to-speaker number on the real hardware (the app's own added latency was measured at ~12ms; the hardware-dependent portion wasn't).
- **Cross-browser gap**: only Chrome is verified (QA-2, by explicit user decision). Firefox/Edge/Safari remain untested — [qa-2-cross-browser-functional-pass.md](qa/qa-2-cross-browser-functional-pass.md) has a ready-to-replay test script and RQ-4's Safari checklist if this is ever revisited.
- **Fast-Follow phase** (not yet task-broken): Noise Gate (RQ-5, confirmed GO — custom AudioWorklet or adapt `@sapphi-red/web-noise-suppressor`), Distortion, Chorus, preset JSON export/import, static hosted factory-presets. Autotune (RQ-6) was a NO-GO recommendation for the near term. Would need a `$plan-it-out` pass before starting.

## Known limitations carried forward
- Limiter (AE-10): browser's built-in compressor makeup gain can push output slightly above full scale (0dBFS) on hot signals, despite ceiling setting. User-accepted, documented. **Still only verified in Chrome** — QA-2 was descoped to Chrome-only by explicit user decision (2026-08-27), so this was never re-checked cross-browser as originally planned.
- Cross-browser coverage (QA-2): Safari cannot be tested on this Windows machine at all (WebKit/macOS-only, hard environment constraint). Firefox and Edge are installed locally but untested — user chose to skip the formal cross-browser matrix given the project's real-world two-person use case (portfolio + brother's karaoke events). Chrome is the only browser verified and should be the only one recommended for real events. See [docs/ultron/qa/qa-2-cross-browser-functional-pass.md](qa/qa-2-cross-browser-functional-pass.md).

## Housekeeping flag (not resolved, just noted)
UI-4's implementing subagent ran `taskkill /IM python.exe` for its own cleanup, which could have killed unrelated Python processes on this machine. No Python processes are running now; no baseline exists to confirm nothing else was affected. Flagged to user directly in the UI-4 gate.

## Artifacts
- [town-hall.md](town-hall.md) — approved scoping brief, all clusters signed off, no conditions.
- [plan.md](plan.md) — approved implementation plan (28 Core MVP tasks, 6 lanes, 6 milestones), now updated with committed research decisions (all task statuses pending, no more blocked tasks).
- [research/summary.md](research/summary.md) + `research/rq*.md` — 6 research questions investigated, all committed by user 2026-08-26.

## Approvals
- MVP boundary & non-goals — approved (Core MVP / Fast-Follow split)
- Success measures & acceptance criteria — approved (7 criteria)
- Problem & users + primary journey & states — approved
- Constraints, assumptions, risks & open-question ownership — approved

## Open Decisions Carried Forward (owners set in town-hall.md § Open Questions & Disposition)
- Audio-graph reconnect strategy (avoid clicks/pops/leaks on live reorder) — owner: deep-research, blocks production start
- Drag-and-drop implementation approach (library vs. custom) — owner: deep-research, blocks production start
- Reverb impulse-response asset sourcing/licensing — owner: deep-research, blocks Reverb node only
- Safari-specific Web Audio/getUserMedia quirks — owner: deep-research, informs only
- Noise Gate implementation approach — owner: deep-research, non-blocking (Fast-Follow)
- Autotune/pitch-correction feasibility — owner: deep-research, non-blocking optional stretch
- Exact factory-preset content — owner: production, non-blocking
- Default shipped chain order — owner: production, non-blocking

## Plan Changes
Research resolved all 6 open questions; plan.md task details updated accordingly (no task/dependency/milestone structure changes -- refinements to AE-1, AE-4, AE-5-AE-10, UI-3, AE-9, QA-1, QA-2 task detail, plus the Fast-Follow sketch: Noise Gate confirmed GO, Autotune demoted to deferred spike). All AE/UI tasks that were `blocked` are now `pending`.

## Next Action
`$production` invoked on DEL-1. Will pause for user review/approval after each completed task per production-log.md.
