# Ultron State — Node-Based Web Audio Chain Builder

## Cycle
**Cycle 2** — Agent-Controlled Chains (WebMCP) + Industrial UI Polish.
Cycle 1 (Core MVP) is complete and archived at [cycle-1/](cycle-1/) (28 tasks
approved 2026-08-27; its production-log, QA, research, and design references
remain valid there).

## Current Phase
`production` — research gate **passed 2026-08-27**: D1–D5 all committed by
user + revised plan re-approved as a whole (D2 acceptance-criteria change
covered). Executing plan.md task index one task at a time, pausing for user
review after each completed task.

## Active Task
**QA-3 — the live 5-prompt judgment run (user's).** Run sheet:
[qa/qa-3-live-agent-acceptance.md](qa/qa-3-live-agent-acceptance.md) —
Inspector extension as agent, DevTools pane as instrument, per-prompt
get_chain capture + rating + exact-undo check; gate ≥4/5. Completed and
user-PASSed: QA-1, QA-2 (peak 0.476), QA-4, DOC-1. After QA-3: POL-1
finish review → cycle acceptance.

## Open Decisions (owners set in town-hall.md § Open questions)
- OQ-1 WebMCP localhost enable mechanics + API signature — deep-research, **blocks Track-A**
- OQ-2 Gemini-in-Chrome consumption path — deep-research, **blocks Track-A**
- OQ-3 Loudness clamp policy — deep-research → production, blocks safety sign-off
- OQ-4 Meter implementation — deep-research, informs UI
- OQ-5 Dark palette contrast audit — deep-research, feeds impeccable
- OQ-6/OQ-7/OQ-8 undo/serialization/capabilities content — production, non-blocking

## Artifacts
- [town-hall.md](town-hall.md) — cycle-2 scoping brief (approved)
- [plan.md](plan.md) — cycle-2 implementation plan (awaiting approval)
- `PRODUCT.md` + `.impeccable/surfaces/index-html.md` — impeccable native
  artifacts (design brief confirmed)
- [cycle-1/](cycle-1/) — archived cycle-1 artifacts

## Approvals
- Cycle-1 approvals: see [cycle-1/](cycle-1/) records.
- Cycle-2 town-hall: **all five clusters approved 2026-08-27** (clear
  natural-language approval at assembled-brief gate, no amendments). Covers
  the previously-provisional decisions: 8-tool MCP surface (no
  bypass/engine/device control), auto-apply + undo, dark pro-audio console
  direction, re-skin + light structure, Gemini in Chrome as test agent.
- Cycle-2 design brief: **confirmed 2026-08-27** (one-word confirmation,
  no correction round used).
- Cycle-2 plan: **approved 2026-08-27** (clear natural-language approval,
  no targeted changes — 22 tasks, 6 milestones, RQ-1..5 queue as written).

## Plan Changes
2026-08-27, research-driven (structure unchanged, task details revised):
API corrected to `document.modelContext.registerTool` throughout (MC-0/1/2,
FEW-1 chip semantics); MC-0 validation path = flag + DevTools pane +
Inspector (not Gemini); MC-3 capabilities carry the stated RQ-3 rules;
MC-4 gains host-owned −6 dBFS attenuator; FEW-3 gains the RQ-3 watchdog
and became medium; QA-2 adds watchdog tests; **QA-3 + DOC-1 retargeted per
D2 (acceptance-criteria change → whole-plan re-approval required)**;
VIS-1 adopts rq5 token table; VIS-5/FEW-3 carry the RQ-4 meter spec.

## Next Action
Write plan.md via `$plan-it-out` → user approves plan (gate) →
`$deep-research` for OQ-1..OQ-5 (OQ-1/OQ-2 block Track-A tasks) →
`$production`.

## Plan Changes (amendment 2, 2026-08-28)
User-directed mid-QA scope amendment (recorded in town-hall.md §Non-goals
AMENDED, surface brief §3/§4, PRODUCT.md principle 6): VIS-7 added —
vertical top-down chain in the 3-col frame, collapse-only FX cards (per-
node audio bypass OFFERED AND DECLINED — no new audio behavior), ~90%
density pass. Sequenced BEFORE the user's pending browser batch (QA-1
Part B / QA-2 console step / QA-4 checks) so manual QA validates the
final surface once. Board was fully green pre-amendment; re-verify after.
