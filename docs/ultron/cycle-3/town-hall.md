# Town Hall — Cycle 3: Shelved Effects (Noise Gate, Distortion, Chorus, Autotune)

Coordinator: ultron-swarm · Meeting date: 2026-08-29 · Status: **assembled, awaiting final record confirmation**
(Prior cycle briefs: [cycle-1/](cycle-1/town-hall.md), [cycle-2/](cycle-2/town-hall.md), both approved.)

## Problem statement & target users

The cycle-1 Fast-Follow backlog lists four audio effects that were scoped,
confirmed as genuinely wanted, and then never built: **noise gate,
distortion, chorus, autotune**. The app currently ships gain, EQ,
compressor, limiter, delay, and reverb on the `registerNodeType()` contract
(`src/audio-graph.js`). The vocal chain is missing exactly these four slots.

Target users: unchanged — the host/operator running karaoke nights, plus
(since cycle 2) the operator's agent driving setup over WebMCP.
Motivation this cycle is **dual**: real-show utility and portfolio value,
weighted equally. A demoable hard-tune autotune is explicitly recognized as
a marquee portfolio feature.

## MVP boundary

All four effects are in scope this cycle:

1. **Noise Gate** — Threshold, Attack, Release, Floor. (No native Web Audio
   node; implementation approach is a carried-over cycle-1 open question,
   research-owned and blocking.)
2. **Distortion** — Drive, Tone, Output Level (output guarded; the existing
   limiter stays downstream as the safety net).
3. **Chorus** — Depth, Rate, Mix.
4. **Autotune** — Key + Scale (new discrete param type), Retune Speed, Mix.
   **Hard-tune is the goal, research-gated**: hard-tune tasks enter
   production only if the deep-research spike passes the feasibility bar —
   pitch detection + shifting inside one AudioWorklet, artifact-free on the
   test vocal, latency within a ~10–20 ms budget. If the bar is not met,
   the sanctioned fallback ships: **slow retune-speed audio correction**
   (same engine, different retune parameter — the "subtle studio autotune"
   sound). The pure pitch-display-only version was considered and rejected
   as barely autotune.

Autotune ships behind an **experimental badge**; gate, distortion, and
chorus ship as first-class effects.

Scales: **Chromatic (default), Major, Minor** in all 12 keys. Exotic modes
are a non-goal.

Agent surface: gate/distortion/chorus/autotune all agent-operable through
the existing 8-tool MCP surface (registry generalizes; no new tools); the
experimental badge carries into the capabilities readout.

Presets/serialization: full round-trip through preset save/load and the
default-preset system for all four effects, including autotune key/scale.
Silently dropped preset state is a data-loss bug, not a nicety.

## Non-goals

- All cycle-2 non-goals carry over unchanged: no LLM inside the app, no
  agent control of safety/audio I/O (bypass, start/stop, device),
  Chrome-only, no user accounts/sync/telemetry/i18n.
- No effects beyond the four listed (no vocoder, harmony, pitch display as
  a standalone feature — a pitch readout exists only as part of autotune).
- No autotune automation: no mid-song key detection; key/scale is set
  manually or by the agent at setup time.
- No exotic scales/modes.

## Journeys & states

- **Palette add** (existing journey, extended): palette chip → node card in
  the vertical chain, collapsible, keyboard/screen-reader addable — all
  inherited from the existing node system; new types appear via
  `NodeTypes.getAllTypes()`.
- **Param tuning**: sliders per the param sets above; autotune's key/scale
  is a discrete selector (new param-control type) that must be keyboard
  operable and serialized into presets.
- **Bypass**: per existing chain-level behavior; each effect must be
  bypass-clean (audible difference only when engaged).
- **Agent setup**: agent adds/tunes any of the four via existing MCP tools;
  capabilities readout reflects the experimental badge on autotune.
- **Failure states**: hard-tune feasibility failure → gentle-correction
  fallback (recorded as a decision, not a surprise); malformed preset
  entries for new types → existing preset error-recovery path.

## Success measures & acceptance criteria

- Each of gate/distortion/chorus passes the existing QA bar: audible,
  param-reactive, bypass-clean, **artifact-free on the fixed test vocal**,
  keyboard- and agent-operable, preset round-trip verified.
- At least one autotune variant shipped and demoable (hard-tune if the
  feasibility bar passes, slow-correction otherwise).
- One **fixed test vocal** committed to the repo (or licensed sample) is
  the standard input for every effect's acceptance check and the demo, so
  "artifact-free" is judged against identical input every time.

## Constraints, assumptions, risks

- Offline-first, static-hosted, client-side only — unchanged.
- No native Web Audio nodes for gate or autotune; both need custom DSP
  (gate likely AudioWorklet or scheduled gain automation; autotune needs
  pitch detection + shifting in one worklet within a ~10–20 ms latency
  budget). **Risk (accepted): autotune is a different class of difficulty
  than the other three combined** — mitigated by the research gate and the
  sanctioned fallback.
- Mid-show artifact risk from a buggy pitch shifter is real; mitigated by
  the experimental badge, the fixed test-vocal bar, and the downstream
  limiter/watchdog safety net.
- Cycle-2 UI frame (3-column, vertical chain, collapse-only cards) is the
  fixed presentation surface; new cards conform to it.

## Role Perspectives

- **Product/User Value** — Supports: cycle-1-confirmed desire; completes a
  real vocal chain; hard-tune autotune is a marquee portfolio feature.
  Dissent: autotune can silently consume the cycle. Resolution: research
  gate + sanctioned fallback (Q1/Q2). Smallest experiment: timeboxed
  pitch-detect+shift latency spike.
- **UX/UI** — Supports: palette/card/param system extends mechanically;
  collapse-only cards already exist. Concern: key/scale is a new discrete
  param type; MCP surface grows. Resolution: discrete selector, keyboard
  operable (Q6); no new MCP tools, badge in capabilities readout (Q8).
- **Frontend/Audio** — Supports: gate/distortion/chorus map to
  well-understood Web Audio patterns. Concern: gate has no native node
  (carried OQ); hard-tune DSP budget is tight. Resolution: both
  research-owned (see dispositions).
- **Quality/Reliability** — Supports: limiter/watchdog safety net exists
  downstream. Concern: pitch-shifter artifacts mid-show. Resolution:
  experimental badge (Q3), fixed test-vocal bar (Q10).
- **Security/Privacy** — No new surfaces; offline-first stands. No concerns.
- **Accessibility** — Keyboard/screen-reader node addition already works;
  new obligation: key/scale selector must be keyboard operable (in
  acceptance criteria).

## Open questions & disposition

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-1 | Noise-gate implementation approach (worklet vs gain automation) | deep-research | **blocking** (gate tasks) |
| OQ-2 | Hard-tune feasibility: pitch detect + shift in one AudioWorklet, artifact-free, ≤~20 ms | deep-research | **blocking** (hard-tune vs fallback decision) |
| OQ-3 | Distortion curve design (WaveShaper curve family, tone stage) | deep-research | informs |
| OQ-4 | Chorus modulation approach (LFO-modulated delay(s), stereo width) | deep-research | informs |
| OQ-5 | Key/scale discrete param-control component + a11y pattern | planning | informs |
| OQ-6 | Test vocal sourcing (committed file vs licensed sample) | planning | informs |

## Decisions & rationale

- **All four effects in MVP** (user) — completes the cycle-1 Fast-Follow
  list; autotune included despite difficulty because portfolio value is a
  co-equal motivation.
- **Hard-tune research-gated, slow-correction fallback** (Q1/Q2) — caps the
  schedule risk without giving up the goal; fallback shares the engine so
  it's a parameter change, not a second build. Rejected: pitch-display-only
  fallback (barely autotune).
- **Experimental badge on autotune only** (Q3) — sets operator/agent
  expectations; the other three are low-risk, well-understood DSP.
- **Success = four effects at the existing QA bar + ≥1 autotune variant
  demoable** (Q4).
- **Non-goals carried over + three new** (Q5).
- **Param sets adopted as listed** (Q6); ranges tuned in production.
- **Chromatic/Major/Minor × 12 keys** (Q7).
- **No new MCP tools; badge in capabilities readout** (Q8).
- **Full preset round-trip, no exceptions** (Q9).
- **Fixed test vocal as universal acceptance input** (Q10).

## Sign-off record

- Round 1 (Q1–Q5: autotune tiering, fallback definition, experimental
  labeling, success measures, non-goals): **approved as recommended**.
- Round 2 (Q6–Q10: param sets, scales, MCP surface, presets, test vocal):
  **approved as recommended**.
- Cluster mapping: problem & users — plain confirm via Q1 context;
  MVP boundary & non-goals — Q1/Q2/Q3/Q5 (Challenger/Advocate framing in
  Role Perspectives); journeys/measures — Q4/Q10; open questions —
  disposition table above.

## Handoff to plan-it-out

Plan the four effects as role-organized tasks on the `registerNodeType()`
contract. Sequence: research-feeding effects (gate, distortion, chorus) can
plan at feature level now; autotune tasks must be written in the two-outcome
form (hard-tune if OQ-2 bar passes, slow-correction otherwise) with the
feasibility spike first. New UI work is limited to the discrete key/scale
param control (OQ-5). Preset round-trip and the test vocal are tasks, not
assumptions. Research queue: OQ-1 and OQ-2 block; OQ-3/OQ-4 inform.
