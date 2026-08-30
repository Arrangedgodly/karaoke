# Town Hall — Cycle 2: Agent-Controlled Chains (WebMCP) + Industrial UI Polish

Cycle 2 of the Node-Based Web Audio Chain Builder. Cycle 1 shipped the complete
Core MVP (28 tasks, approved 2026-08-27 — see [cycle-1/](cycle-1/)). This brief
scopes the two upgrade tracks requested by the user on 2026-08-27:

1. **WebMCP**: expose the app's chain-building capabilities as MCP tools via the
   proposed `navigator.registerMcpServer()` web standard, so an in-browser AI
   agent (primary test agent: **Gemini in Chrome**) can build and edit audio
   chains from natural-language prompts.
2. **Industrial UI pass**: re-skin the current basic-functional light theme into
   an industrial polished utility look (direction: **dark pro-audio console**),
   plus light structural upgrades (meters, status readouts, refined panels) —
   no new pages or flows.

**Meeting mode note:** the user did not answer the interactive grilling rounds;
all decisions below were taken on the facilitator's stated recommendations and
were marked **[provisional]**. The user reviewed the assembled brief at the
gate and approved all clusters in one clear natural-language approval
("approved", 2026-08-27) without amendments — that approval covers every
[provisional] marker in this document.

---

## Problem statement & target users

Same product, same users as cycle 1 — this is an upgrade, not a pivot:

- **Users**: (a) the developer (portfolio / tech credibility) and (b) the
  brother (karaoke-event operator, non-audio-engineer).

Two new jobs-to-be-done:

- **Setup barrier**: building a good-sounding chain today means dragging nodes
  and tweaking ~15 sliders with live audio vocabulary the operator doesn't
  have. Job: *describe the desired vocal sound in plain language and get a
  working, tweakable chain* — at event setup time, not mid-performance.
- **Look vs. trust**: the app works but reads as a generic web demo. Job: *look
  and read like trusted pro-audio hardware* — an industrial polished utility
  that a room of karaoke singers believes is "real gear", and that portfolio
  visitors read as production-grade tooling.

Live-show safety posture is unchanged and non-negotiable: emergency bypass
stays human-triggerable in one action, always.

## Proposed MVP

### Track A — WebMCP agent control

- **`mcp-server` shim** (vanilla JS, no build step): feature-detect
  `navigator.registerMcpServer`; register the app as an MCP server when
  available; **silent no-op when not** (the app must work identically offline,
  with no agent, zero regressions — this is the load-bearing fallback).
- **Tool surface (8 tools)** — recommended set [provisional]:
  - Read: `get_capabilities` (self-describing: node types, every param with
    range/unit/description, chain-order guidance, current chain), `get_chain`.
  - Mutate: `set_chain` (full validated replace), `add_node`, `remove_node`,
    `set_param`.
  - Presets: `list_presets`, `save_preset`.
  - **Excluded by design**: bypass control, engine start/stop, mic device
    switching — safety and audio I/O remain human-only.
- **Validation & safety layer** on every mutation: schema/range validation,
  loudness-aware clamps; adversarial or nonsense tool input is rejected with a
  machine-readable error, never crashes the audio graph.
- **Agent-edit UX — auto-apply + undo** [provisional]: agent changes apply
  immediately to the canvas; a change summary (what the agent did) is shown;
  one-click undo restores the exact prior chain state.
- **Agent-activity indicator** in the UI (topbar chip): "agent connected /
  acting / idle" so the operator always knows when the page is being driven.
- **README "Agent control" section**: how to enable (flag/origin-trial steps),
  how to connect Gemini in Chrome, example prompts.
- **Dev test harness** (the "agent simulator"): a small hidden/dev page or
  console API to invoke the registered tools directly without a live agent —
  required for automated QA and doubles as the portfolio fallback demo.
- **Acceptance-tested against Gemini in Chrome** on localhost.

### Track B — Industrial UI pass (re-skin + light structure)

- **Direction: dark pro-audio console** [provisional]: near-black/charcoal
  panels, hairline borders, amber/orange signal accents, per-effect-family
  accent coding, glowing meter aesthetics. Rationale: karaoke venues are dark
  rooms — today's white theme fights the environment; dark console reads as
  pro hardware and makes meters legible.
- Full re-skin of every existing surface: topbar, palette, chain canvas, node
  cards, param controls, presets panel, empty/disabled/error states, focus
  states.
- **Light structural upgrades** [provisional set]:
  - Input & output level meters (live, visible while running).
  - Topbar status readouts: engine state, sample rate, latency/node count.
  - Agent-activity chip (shared with Track A).
  - Refined panel/spacing/typography hierarchy (industrial label system).
- **No new pages or flows**; existing interactions (drag-drop, reorder,
  sliders, presets, spacebar bypass) keep their wiring and keyboard behavior.

## Non-goals

- **No LLM inside the app**: no API keys, no cloud calls, no built-in chat
  box. Intelligence lives in the user's agent; the app stays offline-first.
- **No agent control of safety/audio I/O** (bypass, start/stop, device).
- **No new audio effect nodes** (noise gate, distortion, chorus, autotune
  remain the cycle-1 Fast-Follow backlog, unstarted here).
- **No cross-browser expansion**: Chrome-only stance stands (Edge's parallel
  WebMCP origin trial is research-informs only, not a target).
- **No live-performance prompt UX**: agent control targets setup time; the
  operator never needs to prompt mid-song.
- **No user accounts, sync, telemetry, i18n.**
- **No layout/IA redesign**: the 3-column arrangement and all flows persist.

**AMENDED 2026-08-28 (user-directed mid-cycle, during QA lane):** the
"no layout redesign" non-goal is narrowed to *"the 3-column arrangement,
all flows, and one-page constraint persist"* — the user explicitly
directed three presentation changes (recorded as decision, not
re-interview): (1) FX cards become **collapsible** (params hideable,
device always visible in chain — collapse ONLY, no per-node audio bypass:
that option was offered and declined); (2) the chain canvas flows
**top-down** (MIC IN top → OUT bottom) inside the unchanged 3-column
frame, freeing horizontal screen room; (3) **denser card scale**. The
app stays **one page** — recorded as a durable product principle in
PRODUCT.md. Task VIS-7 carries the work; automated QA artifacts were
still green at amendment time and re-verify after.

## Primary journeys & important states

1. **Prompted setup (happy path)**: Start engine → invoke Gemini in Chrome →
   user prompts ("warm ballad vocal, light hall reverb, keep it safe") → agent
   calls `get_capabilities` → `get_chain` → `set_chain`/`add_node`+`set_param`
   → chain appears on canvas with per-change summary toasts → user tweaks
   sliders → "save as Ballad" via prompt (`save_preset`) or UI. Sound is
   audible throughout; undo available at each step.
2. **Undo journey**: after any agent batch, one click (or shortcut) restores
   the exact prior chain (nodes, order, params, preset-name/unsaved state).
3. **Agent unavailable**: no WebMCP in the browser → app identical to cycle 1
   (no error, no dead UI; agent chip shows "not available").
4. **Adversarial/broken agent**: out-of-range params, unknown node types,
   malformed chains → tool returns structured error; audio graph untouched or
   safely rebuilt; never a silent bad sound.
5. **Dark-room operation**: meters/status readable at distance; bypass button
   remains the highest-contrast element on screen; keyboard flows unchanged.
6. **Portfolio visit**: README → enable flag → localhost demo with Gemini (or
   dev harness) → self-describing `get_capabilities` impresses on its own.

## Success measures & acceptance criteria

*Challenger:* "novice prompt → good chain" couples success to Gemini's
planning quality we don't control, and "industrial polished" is subjective —
neither is a hard gate as stated. *Advocate:* gate only on what we control
(tool mechanics, safety, zero-regression, a11y) and make chain quality a fixed
user-judged script; UI acceptance is explicit user sign-off plus objective
contrast/keyboard checks. That keeps the gate honest. [provisional]

1. **Fixed 5-prompt acceptance script** (e.g. warm ballad / rock shout /
  phone-filter gag / big-room epic / clean speech) run with Gemini in Chrome:
  ≥4/5 produce chains the user rates "usable without edits"; every applied
  change is undoable to the exact prior state.
2. All 8 tools listed and callable by the agent; every adversarial tool call
  in the QA matrix is rejected with a structured error and leaves the audio
  graph valid; bypass/spacebar behavior never affected by agent activity.
3. **Zero-regression**: with WebMCP absent/disabled, the app passes the
  cycle-1 core QA script (chain build, presets, persistence, bypass).
4. **UI**: full dark-console re-skin shipped; in/out meters animate with
  signal; WCAG AA contrast for all text labels; keyboard/spacebar flows
  unchanged; user explicitly accepts the look as "industrial polished
  utility".
5. **Portfolio**: README agent section + dev harness let a fresh Chrome
  profile reproduce the agent demo end-to-end.

## Constraints, assumptions, dependencies & risks

- **Constraints**: vanilla JS, no build step, zero runtime internet
  dependency, localStorage persistence, Chrome-only recommendation,
  existing module wiring (`window.AudioEngine`, `AudioGraph`, `PresetStore`,
  `ChainCanvas`) reused, not rewritten.
- **Assumptions**: WebMCP origin trial / flag access in current Chrome is
  workable on localhost (verification owned by research); Gemini in Chrome is
  available to the user with a Google account; brother's events have setup
  time before doors.
- **Dependencies**: WebMCP spec/origin-trial mechanics; Gemini in Chrome's
  WebMCP consumption path (permission UX, tool invocation surface).
- **Risks**:
  - *Experimental API flux / trial expiry* → demo breaks in a Chrome update.
    Mitigation: feature-detect + graceful no-op; document exact enable steps;
    accepted as inherent.
  - *Agent makes bad-sounding chains* → user blames app. Mitigation:
    domain-encoded tool descriptions + validation clamps + undo; acceptance
    script keeps us honest.
  - *Loudness/feedback from agent-set gain* → mitigation: output-side clamps
    + guidance steering agents toward limiter-inclusive chains.
  - *Dark theme a11y regression* → mitigation: contrast audit gates the
    design brief (impeccable), keyboard/focus states re-done, not dropped.
  - *Operator confusion from auto-apply* → mitigation: agent-activity chip +
    per-change summaries + undo; agent path never required for the show to
    run (README keeps manual path primary for events).

## Role perspectives

- **Product/user value** — Supports: collapses the slider-blindness barrier
  for the brother; portfolio demonstrates agent-controllable web apps on a
  real shipped product (rare as of 2026). Concern: headline feature rides an
  origin-trial API; a Chrome update can break the demo. Cost: ongoing fragility
  accepted in exchange for being genuinely early. Experiment: prove the
  localhost→Gemini loop with one trivial tool before any UI work (research
  spike, blocking).
- **UX/UI** — Supports: prompting is setup-time; live show untouched. Concern:
  agent edits that land invisibly destroy the operator's mental model of
  their own signal path; industrial dark themes trend low-contrast. Cost:
  change-summaries/undo/chip + a contrast-audited palette. Experiment: paper
  prototype of the "agent is driving" state; mood-board the console direction
  in the design phase.
- **Frontend** — Supports: `registerMcpServer` is plain JS; tool functions map
  1:1 onto existing `AudioGraph`/`PresetStore` modules; no build stack needed.
  Concern: API signature still in flux; no official types in a no-build
  vanilla setup → hand-rolled schemas + a thin adapter so call sites don't
  churn. Cost: shim + schema discipline. Experiment: adapter prototype behind
  feature detection.
- **Backend/data/integrations** — Supports: none needed — the page *is* the
  server; static `http.server` unchanged. Concern: origin-trial token vs
  localhost-exemption mechanics unknown (fact, not decision). Experiment:
  research verifies the cheapest reliable enable path.
- **Quality/reliability** — Supports: WebMCP layer is additive; core audio
  path untouched → bypass/mic safety preserved by construction. Concern:
  nonsense chains (five limiters), concurrent user-drag vs agent-write races,
  adversarial input. Cost: validation layer + serialization rule + adversarial
  QA matrix. Experiment: tool-call fuzzing in the QA task.
- **Security/privacy** — Supports: no data leaves the page; tools never touch
  the mic stream itself. Concern: an agent with `set_param` can seek
  ear-damage levels; tool over-exposure invites misuse. Cost: loudness clamps
  + explicit allowlist (nothing that reads raw audio or clears storage).
  Experiment: define clamp policy in research, verify in QA.
- **Accessibility** — Supports: natural-language control is itself an
  accessibility win; re-skin is the moment to fix contrast/focus properly.
  Concern: "industrial" aesthetics (tiny stencil labels, dark-on-dark,
  glow-noise) fight WCAG and distance readability. Cost: AA-checked palette,
  oversized bypass target, visible focus. Experiment: contrast audit in the
  design brief.
- **Audio-domain accuracy** — Supports: agents reason well when tools encode
  domain knowledge — param units/ranges/descriptions, chain-order conventions
  (EQ→comp→delay/reverb, limiter last), recommended starting chains.
  Concern: without guidance, agents emit plausible-but-bad chains and the app
  takes the blame. Cost: carefully authored `get_capabilities` content.
  Experiment: same prompt across two description styles; compare chains.

## Open questions & disposition

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| OQ-1 | WebMCP enable mechanics on localhost in current Chrome (flag vs origin-trial token vs exemption); exact `registerMcpServer` signature & required UI affordances | deep-research | **Blocks** Track-A production start |
| OQ-2 | Gemini in Chrome consumption path: availability, permission/confirmation UX, how tools surface to the agent | deep-research | **Blocks** Track-A acceptance testing |
| OQ-3 | Loudness-safety clamp policy (which params clamped, output ceiling strategy, limiter steering) | deep-research → production implements | Blocks safety-signoff of mutation tools |
| OQ-4 | Meter implementation (AnalyserNode vs AudioWorklet; CPU on event laptop; decay/peak ballistics) | deep-research | Informs UI meter task |
| OQ-5 | Dark-console palette contrast audit (AA for all text; focus/bypass visibility) | deep-research (a11y) → feeds design brief | Informs impeccable shape |
| OQ-6 | Undo mechanism (snapshot vs reverse-diff) & interaction with autosave/persistence | production | Non-blocking implementation detail |
| OQ-7 | User-drag vs agent-mutation serialization rule | production | Non-blocking implementation detail |
| OQ-8 | `get_capabilities` domain content authoring (guidance depth, starting-chain recipes) | production | Non-blocking; quality-critical |

## Decisions & rationale (rejected alternatives)

- **App = MCP server via WebMCP; no LLM in-app** — rejected: built-in prompt
  box calling an LLM API (violates offline-first/no-keys constraint; WebMCP is
  the actual differentiator and keeps intelligence in the agent).
- **Tool set: recommended 8** — rejected: minimal 4-tool set (loses cheap
  iterative edits), extended 11-tool set (adds move/load/delete — load_preset
  duplicates set_chain value; can add later if agents ask for it).
- **Auto-apply + undo** — rejected: preview/confirm queue (friction; Gemini
  already surfaces its own tool-call review; undo preserves safety).
- **Dark pro-audio console direction** — rejected: blueprint lab (light theme
  fights dark venues), field hardware olive (stronger costume, weaker pro-audio
  credibility; per-effect color coding fits console idiom better).
- **Agent path optional-by-construction** — the show must never depend on an
  experimental flag or a Google account; manual path stays primary in event
  docs.

## Sign-off status

All clusters **approved by user, 2026-08-27** (single clear approval at the
assembled-brief gate, no amendments):

1. Problem & users — approved
2. MVP boundary & non-goals — approved (Challenger/Advocate recorded above
   in success-measures note and decisions)
3. Journeys, states, success measures & acceptance criteria — approved
4. Constraints, assumptions, risks — approved
5. Open-question disposition — approved

## Handoff note for `plan-it-out`

Two parallel tracks (A: WebMCP, B: UI) with shared touchpoints (agent chip,
theme must restyle Track-A surfaces). UI track feeds the `impeccable` design
phase (surface brief: dark console, meters, status readouts) — this product
has a UI surface, so impeccable runs between town-hall and plan-it-out.
Track-A tasks start only after OQ-1/OQ-2 research lands; Track-B design work
can proceed in parallel. Plan must end with a committed polish/critique task
over the assembled surface per Ultron's UI rule, and include the fixed
5-prompt acceptance script + zero-regression QA pass as explicit tasks.

**AMENDED 2026-08-28 (3rd, user-directed at QA-3 close):** ship a small
FACTORY PRESET LIBRARY before initial release (non-technical users get
instant good starting points; content = the QA-3 five + Classic Karaoke
default). Task PS-4. No new pages/flows; dropdown grouping + load-only
factory entries.
