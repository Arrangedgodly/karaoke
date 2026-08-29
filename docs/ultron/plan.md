# Cycle 2 Plan — Agent-Controlled Chains (WebMCP) + Console Re-skin

Source of truth for cycle-2 tasks, dependencies, and status. Scope:
[town-hall.md](town-hall.md) (approved 2026-08-27) · design brief:
`.impeccable/surfaces/index-html.md` (confirmed 2026-08-27) · product truth:
`PRODUCT.md`. Cycle-1 record: [cycle-1/](cycle-1/).

Two tracks share this plan: **Track A (MCP)** and **Track B (console re-skin)**,
merging for acceptance and a final committed polish task (Ultron UI rule).

Statuses: `pending` · `blocked` · `in-progress` · `awaiting-approval` ·
`completed`. RQ-IDs are research questions delegated to `$deep-research`
(mapped from town-hall OQ-1..OQ-8).

---

## Lane MC — MCP / agent integration (Track A)

### MC-0 — Live localhost spike *(medium)* — status: `completed` *(validated by user on flagged Chrome 2026-08-27: chip→AGENT READY, echo listed+run in DevTools WebMCP pane, plain-object result confirmed — RQ-1 contradiction resolved, A-1 confirmed. Inspector-extension NL drive deferred to MC-6/QA-3 where it is already planned)*
Prove the loop before building on it: with RQ-1's enable path applied
(`chrome://flags/#enable-webmcp-testing`), register one trivial `echo` tool
via `document.modelContext.registerTool()` and invoke it through the
**DevTools WebMCP pane** and the **Model Context Tool Inspector extension**
(RQ-2: Gemini in Chrome does not consume WebMCP tools as of 2026-08-27);
document exact enable steps + screenshots in the task record.
- Owner: MCP. Journey: portfolio visit; de-risks entire track.
- Depends: RQ-1, RQ-2. Parallel: none (critical path head).
- Files: `src/mcp-server.js` (spike seed), `index.html` (script tag).
- Accept: DevTools pane lists + runs the tool; Inspector drives it in NL;
  result rendering verified (plain values vs content-wrapper — RQ-1
  contradiction); steps reproducible from a fresh Chrome profile.
  **If impossible → return to town-hall** (assumption A-1).
- Risk: flag not present on current stable → CLI `--enable-features=WebMCP`.

### MC-1 — Shim + feature detection + registration *(small)* — status: `awaiting-approval`
Harden the spike into the permanent shim: `window.McpServer` module,
feature-detect `document.modelContext ?? navigator.modelContext` (RQ-1),
**per-tool registration** (no server object exists), **silent no-op + one
console diagnostic when absent**, emit lifecycle events (tools-ready /
unavailable / acting-on-execute) on the FEW-1 event contract; re-register
on every load.
- Depends: MC-0. Parallel: FEW-1 (contract defined already).
- Accept: app loads identically with WebMCP absent (zero errors, zero visual
  change); tools listed in DevTools pane when enabled.

### MC-2 — Tool schema layer *(medium)* — status: `awaiting-approval`
Define the 8 tool schemas (`get_capabilities`, `get_chain`, `set_chain`,
`add_node`, `remove_node`, `set_param`, `list_presets`, `save_preset`) in
the `ModelContextTool` shape (RQ-1): name rules, descriptions ≤500 chars /
param descriptions ≤150, `inputSchema` JSON-Schema object,
`readOnlyHint`/`untrustedContentHint` annotations, arg validation (reuse
`src/preset-schema.js` patterns). **Errors returned as descriptive result
text** (structured JSON-in-string per RQ-3 shape) — the API has no
`isError` channel. No logic yet.
- Depends: MC-1, RQ-1 (exact signature). 
- Accept: schemas register; invalid args rejected with the RQ-3 error shape
  visible in DevTools pane.

### MC-3 — Read tools *(small)* — status: `awaiting-approval`
Implement `get_chain`, `list_presets`, and `get_capabilities` whose content
encodes domain guidance (per-param unit/range/description, chain-order
conventions, recommended starter chains) **plus the RQ-3 policy as stated
rules** — limiter-required-terminal, +12 dB gain budget, boost/feedback
caps, clamp ranges — so agents pre-comply instead of discovering limits by
rejection. OQ-8 content owner.
- Depends: MC-2. Parallel: VIS-* lanes.
- Accept: harness (MC-6 stub or console) returns correct current state;
  capabilities content reviewed against cycle-1 node registry (all 6 types,
  every param) and consistent with rq3 table verbatim.

### MC-4 — Mutation tools + validation + clamps *(medium)* — status: `awaiting-approval`
`set_chain`, `add_node`, `remove_node`, `set_param` wired through the same
model APIs the UI uses (`ChainCanvas`/`AudioGraph` rebuild path); **RQ-3
policy implemented verbatim** (per-param reject/clamp table, chain rules:
limiter-required-terminal, +12 dB total-gain budget incl. estimated makeup,
feedback ≤0.7, boost caps, compound-loop guard, ≤2 compressor nodes, 16-node
cap, host ramps 10–20 ms); add the **host-owned post-limiter output
attenuator** (persistent GainNode, −6 dBFS default, no tool can address it)
with "Safe output" UI note; serialization rule (OQ-7: agent mutations queue
behind an in-progress user drag).
- Depends: MC-3, RQ-3. 
- Accept: valid calls rebuild graph cleanly (no clicks beyond existing
  rebuild behavior); every rq3 clamp/rule enforced and disclosed per its
  reject/clamp treatment; concurrent-drag test passes; attenuator verified
  with hot signals (square-wave −1 dBFS test input).
- Risk: graph-rebuild-on-hot-path — reuse cycle-1 AE-2 reconnect strategy.

### MC-5 — save_preset + change summaries + exact-state undo *(medium)* — status: `completed` *(approved 2026-08-28)*
`save_preset` tool; every mutation emits a human-readable change summary and
pushes a snapshot (nodes, order, params, preset-name/unsaved state — OQ-6
snapshot decision) to a bounded undo stack exposed as one-click undo.
- Depends: MC-4. 
- Accept: any agent batch is undoable to byte-identical model state; undo of
  a save removes the preset only if agent-created in same batch.

### MC-6 — Dev test harness (agent simulator) *(medium)* — status: `completed` *(approved 2026-08-28)*
Standalone dev surface (hidden route or `?dev` page) to list/invoke all 8
tools with editable JSON args, view structured errors + emitted events;
doubles as the portfolio agent-free demo.
- Depends: MC-2 (schemas); useful from MC-3 on.
- Accept: every tool callable; error paths displayable; no harness state
  leaks into app localStorage keys.

---

## Lane VIS — console re-skin (Track B)

### VIS-1 — Theme token foundation *(medium)* — RQ-5 resolved — status: `completed` *(approved 2026-08-27)*
Adopt the **rq5 token table verbatim** as `:root` custom properties: warm
charcoal neutrals (`#1B1917/#292623/#322E29`, hairline `#4C463E`
decorative-only, `line-strong #857C6E` for meaningful outlines), amber
accent set (`#F0A83C`/hover/active/`on-accent`), **split-role safety red**
(`red-edge #E5484D` rings / `red-fill #C93A32`+white text — never swapped),
focus tokens (incl. dark-on-amber variant), 6 family edges w/ silkscreen
initials redundancy, status + meter stops. Refactor `styles/main.css`
`:root`; no component rewrite.
- Accept: tokens match rq5 values exactly; old light values fully replaced
  (no orphan rules); no pairing uses a known-failing combination (rq5 §5).

### VIS-2 — Topbar → status LCD strip *(medium)* — status: `awaiting-approval`
Restructure topbar markup into the status strip: engine-state block, mono
readouts (sample rate, latency, node count), agent chip slot, restyled
Start/device controls; **Bypass as the loudest element** (safety red on
steel, oversized target).
- Depends: VIS-1. Parallel: MC-* lanes.

### VIS-3 — Palette + presets panels *(medium)* — status: `awaiting-approval`
Silkscreen label system, edge-coded palette items (color as edge, never
fill; label always present), preset panel in the same vocabulary; all
component states (hover/focus/active/disabled).
- Depends: VIS-1.

### VIS-4 — Node cards + param controls *(medium)* — status: `awaiting-approval`
Channel-strip node cards: family edge coding, grip handles as physical
grips, sliders as faders (detent feel via CSS only — no custom form
controls), remove ×; every state incl. gated/not-started.
- Depends: VIS-1, FEW-1 (pulse-on-change hook).
- Accept: 6 card types + empty state visually complete; keyboard drag
  behavior unchanged.

### VIS-5 — MIC IN / OUT meters *(medium)* — component only — status: `awaiting-approval`
Meter visual components at the canvas anchors per RQ-4/5: **canvas**-rendered
lamp bar (green −60…−20 / amber −20…−6 / red −6…0, rq5 stops) + RMS underlay
+ peak-hold tick (1500 ms hold, 12 dB/s fall) + clip latch (≥3 samples
@ |v|≥1.0, 2 s auto-clear), dB numerals in mono; silent-at-rest rendering;
`role="meter"` + low-frequency `aria-valuenow`.
- Depends: VIS-1, RQ-4 (resolved). Wiring = FEW-3.

### VIS-6 — Agent feedback + global states polish *(medium)* — status: `awaiting-approval`
Toast/summary system styling, one-pulse-amber on agent-changed cards,
agent chip visual states, taught empty state, adversarial-rejection toast,
`prefers-reduced-motion` handling (pulses quiet, meters stay functional).
- Depends: VIS-1..VIS-4, FEW-1 wired by MC-1/MC-4/MC-5 events.

---

## Lane FEW — shared frontend wiring

### FEW-1 — Agent event contract + components *(small)* — **no deps** — status: `completed` *(approved by ordering redirect 2026-08-27: "lets do vis-1 first then test")*
Define `window.AgentUI` event bus (lifecycle: **tools-ready / acting /
unavailable** — RQ-1: no connection concept exists; acting = execute()
invoked; mutation-summary; undo-stack API) as a written contract in
`src/agent-ui.js` with DOM components for chip/toast/undo (unstyled
skeletons). MC and VIS lanes code against this contract, enabling parallel
work.
- Accept: contract doc block in module; components render from synthetic
  events; no MC dependency.

### FEW-2 — Status readouts wiring *(small)* — status: `awaiting-approval`
Feed real values from `AudioEngine`/`AudioGraph` (sample rate, measured
latency, live node count) into the VIS-2 readouts; update cadence bounded.
- Depends: VIS-2.

### FEW-3 — Meter wiring + watchdog *(medium)* — status: `awaiting-approval`
Implement meters per RQ-4 (resolved): **2× AnalyserNode side-taps** — IN off
`AudioEngine.sourceNode`, OUT off persistent `chainGate`, created once per
session outside `buildGraph()` (verified rebuild-safe), float time-domain
reads (`fftSize` 2048, reused buffers), one shared rAF loop with dirty-check,
canvas per meter, IEC ballistics per VIS-5; **RQ-3 runtime watchdog** shares
the OUT analyser: peak > ceiling+0.5 dB sustained >250 ms or ~1 s monotonic
band rise → force master gain 0, UI alert, agent-visible error, human-only
restore.
- Depends: VIS-5, RQ-4 (resolved), MC-4 (attenuator/ceiling constants).

---

### VIS-7 — Vertical canvas + collapsible cards + density *(medium)* — status: `awaiting-approval` *(114/114; board all green; index.html + param-controls byte-identical)*
Deliverables: (a) chain canvas flows top-down — MIC IN (top, w/ IN meter)
→ stacked effect rows → OUT (bottom, w/ OUT meter + safe-output note),
arrows reoriented, empty-hint adapted, SortableJS vertical drag verified;
(b) collapsible FX cards — persistent header row (family chip + name +
grip + chevron + ×), params section toggles via real button w/
aria-expanded, default expanded, session-only state (rebuilds reset —
documented); (c) density pass — ~90% card scale (tighter paddings,
smaller chips/faders; text ≥11px, AA pairs and hit-targets unchanged);
(d) harness board re-verified + ratchets dated; qa4 audit map re-run
(throws on drift — tripwire).
- Depends: VIS-4/5/6 ✓. Parallel: none (touches their surfaces).
- Accept: vertical flow + collapse + density live; drag/keyboard/copy
  unchanged; board green (ratchets dated); qa4 audit PASS on new DOM map.

## Lane QA — acceptance

### VIS-7b — Flow-direction toggle *(small)* — status: `awaiting-approval` *(2026-08-28 user direction at VIS-7 gate: "make it a toggle to swap left-right or top-bottom"; 30/30; board all green)*
Vertical default + persisted horizontal fallback (karaoke-flow-orientation-v1); all orientation CSS scoped under .flow-horizontal; SortableJS untouched (auto-detects direction).

### QA-1 — Zero-regression pass *(medium)* — status: `completed` *(user PASS both flag modes 2026-08-28)*
Re-run the cycle-1 core QA script (chain build/reorder/remove, presets
save/load/delete, autosave/restore, bypass + spacebar) twice: WebMCP absent,
and present-but-idle. Both must be indistinguishable from cycle-1 behavior.
- Depends: all MC + VIS + FEW complete.
- Acceptance criterion source: town-hall success measure 3.

### QA-2 — Adversarial tool matrix *(medium)* — status: `completed` *(220/220 + user console step peak 0.476 PASS, 2026-08-28)*
Via MC-6 harness: out-of-range params, unknown node types, malformed
chains, 5-limiter stacks, rapid-fire concurrent calls, calls mid-drag,
undo-stack exhaustion, **watchdog triggers** (sustained hot signal → forced
mute + alert; human restore path). Every case → structured error or clamped
valid result per rq3 treatment; audio graph always valid; bypass never
affected.
- Depends: MC-5, MC-6, FEW-3. 
- Source: town-hall measure 2.

### QA-3 — Live-agent acceptance (5-prompt script) *(medium)* — status: `completed` *(5/5 PASS 2026-08-28; string-args finding + fingerprint-verified undo; rerun details in qa record)*
**Retargeted per RQ-2/D2** (Gemini in Chrome does not consume WebMCP as of
2026-08-27): run the fixed script (warm ballad / rock shout / phone-filter
gag / big-room epic / clean speech) through the **Model Context Tool
Inspector** NL agent (gemini-3-flash), with DevTools WebMCP pane as
instrumentation; user rates each "usable without edits"; ≥4/5 gate; undo
exact-state verified per prompt. **Gemini-in-Chrome live run = deferred
gate**: before executing QA-3 and DOC-1, recheck
developer.chrome.com/docs/ai/webmcp for a Gemini testing section; if
shipped, run the same script there too and record both.
- Depends: MC-5, MC-6, DOC-1, RQ-2, QA-2.
- Source: town-hall measure 1 (amended by D2 at research gate).

### PS-4 — Factory preset library *(medium)* — status: `completed` *(approved 2026-08-28)* *(2026-08-28 user-directed amendment 3: ship a small library of factory presets for non-technical users before initial release; QA-3's five chains volunteered as content)*
Static FACTORY_PRESETS (Warm Ballad / Rock Night / Phone Call Gag / Big
Room / Clean Speech + the Classic Karaoke default), grouped in the preset
dropdown (Factory / Yours optgroups), factory entries load-only (Delete
blocked + no shadowing), Save As… always creates user presets, MCP
list_presets/get_capabilities disclose the factory set; harness coverage
+ board re-run.
- Depends: MC-5 ✓, VIS-3 ✓. Accept: dropdown shows grouped library;
  factory Load works incl. via agent; Delete refuses factory entries;
  fresh profile sees full library; QA-3 chains verbatim.

### QA-4 — Accessibility verification *(small)* — status: `completed` *(automated PASS + user three-check PASS, 2026-08-28)*
Contrast audit on the *rendered* surface (not tokens alone), keyboard-only
pass (incl. spacebar bypass), focus visibility, reduced-motion check,
distance-readability spot check.
- Depends: VIS complete. Source: town-hall measure 4, design brief §7.

---

## Lane DOC — documentation

### DOC-1 — README agent section + demo script *(small)* — status: `completed` *(approved by progression 2026-08-28 — user proceeded to QA-3 using it)*
"Agent control" README section: enable steps (from MC-0 record: flag +
DevTools pane + Inspector extension), example prompts, harness demo path,
**current honest status of Gemini-in-Chrome** (not yet consuming WebMCP as
of 2026-08-27 + readiness checklist for when it ships, per RQ-2); manual
path stays primary for events.
- Depends: MC-0 record, MC-6, RQ-2. Source: town-hall measure 5 (amended by
  D2: README reproduces the agent demo via Inspector/DevTools today).

---

## POL-1 — Final polish/critique over assembled surface *(medium)*
Ultron-mandated closer: full-surface critique against the design brief and
direction (impeccable critique/audit/polish discipline), side-by-side with
town-hall acceptance criteria; one bounded fix round; detector pass
(`detect.mjs`) over changed targets; screenshots to `.impeccable/review/`.
- Depends: QA-1..QA-4, DOC-1.
- Accept: user accepts the delivered upgrade (town-hall measure 4) — this
  is the cycle's final gate.

---

## Dependency-ordered task index

| # | Task | Depends on | Blocked by research |
|---|------|-----------|---------------------|
| 1 | FEW-1 event contract | — | — |
| 2 | MC-0 live spike | RQ-1, RQ-2 | yes |
| 3 | MC-1 shim | MC-0 | — |
| 4 | VIS-1 theme tokens | RQ-5 | yes |
| 5 | MC-2 schemas | MC-1 | — |
| 6 | VIS-2 status strip | VIS-1 | — |
| 7 | VIS-3 panels | VIS-1 | — |
| 8 | MC-3 read tools | MC-2 | — |
| 9 | VIS-4 node cards | VIS-1, FEW-1 | — |
| 10 | VIS-5 meters (component) | VIS-1, RQ-4 | yes |
| 11 | MC-4 mutations + clamps | MC-3, RQ-3 | yes |
| 12 | FEW-2 readout wiring | VIS-2 | — |
| 13 | FEW-3 meter wiring | VIS-5, RQ-4 | yes |
| 14 | MC-6 dev harness | MC-2 | — |
| 15 | MC-5 save + summaries + undo | MC-4 | — |
| 16 | VIS-6 agent feedback polish | VIS-2..4, FEW-1 (+MC events) | — |
| 17 | DOC-1 README agent section | MC-0, MC-6, RQ-2 | — |
| 18 | QA-1 zero-regression | all MC/VIS/FEW | — |
| 19 | QA-2 adversarial matrix | MC-5, MC-6 | — |
| 20 | QA-3 live 5-prompt acceptance | MC-5, MC-6, DOC-1, QA-2 | — |
| 21 | QA-4 a11y verification | VIS complete | — |
| 22 | POL-1 final polish/critique | QA-1..4, DOC-1 | — |

Critical path: RQ-1/2 → MC-0 → MC-1 → MC-2 → MC-4 → MC-5 → QA-2 → QA-3 →
POL-1. Track B runs parallel from RQ-5/VIS-1; merge at QA-1.

## Milestones

- **M1 — Foundations proven**: RQ-1..5 decided; MC-0 spike passes (the
  mistaken-assumption killer); FEW-1 contract + VIS-1 tokens exist.
- **M2 — MCP functional core**: MC-2/3/4 + MC-6 harness demoing validated
  mutations without a live agent.
- **M3 — Agent UX complete**: MC-5 + VIS-6; prompted edits land with
  summaries + exact-state undo end-to-end (harness-driven).
- **M4 — Console assembled**: VIS-2..5 + FEW-2/3; full re-skin live.
- **M5 — Acceptance**: QA-1..4 + DOC-1; all town-hall measures evidenced.
- **M6 — Delivered**: POL-1 critique closed; user accepts.

## Research queue — **resolved 2026-08-27 (records in `research/`)**

RQ-1..RQ-5 all investigated and committed into task details above (API
correction → MC-0/1/2; Gemini gap + retarget → QA-3/DOC-1; loudness policy
→ MC-3/4 + FEW-3 watchdog; meter spec → VIS-5/FEW-3; palette table → VIS-1).
Decision matrix + user dispositions: `research/summary.md`. D2 changed an
acceptance criterion → whole-plan re-approval required at this gate.

## Handoff

- **Build order**: M1 → (M2→M3 ∥ M4) → M5 → M6, per index above.
- **Fixed by scope**: 8-tool surface; no bypass/engine/device tools;
  auto-apply + undo; dark console world (design brief); 3-column layout and
  all flows persist; no webfonts; copy verbatim; working title; Chrome-only;
  no new effect nodes; no in-app LLM.
- **Research (resolved)**: API = `document.modelContext.registerTool`;
  loudness policy incl. host attenuator −6 dBFS + watchdog; AnalyserNode
  side-tap meters w/ IEC ballistics; rq5 AA palette. D2 retarget of QA-3 is
  the one acceptance-criteria change.
- **Assumptions that return to town-hall if broken**: (A-1, amended by D1)
  WebMCP per-tool registration is viable on localhost in the user's Chrome
  (MC-0 falsifies or confirms via flag + DevTools/Inspector); (A-2, amended
  by D2) an NL-agent validation path (Inspector) stands in for Gemini until
  Google ships WebMCP consumption; (A-3) event setup time exists for the
  prompted workflow.
- **Approval needed now**: research decision matrix (D1–D5) + this revised
  plan as a whole (D2 changed QA-3/DOC-1 + measure 1/5 wording).
