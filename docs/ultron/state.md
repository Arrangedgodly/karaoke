# Ultron State — Node-Based Web Audio Chain Builder

## Cycle
**Cycle 2** — Agent-Controlled Chains (WebMCP) + Industrial UI Polish.
Cycle 1 (Core MVP) is complete and archived at [cycle-1/](cycle-1/) (28 tasks
approved 2026-08-27; its production-log, QA, research, and design references
remain valid there).

## Current Phase
`impeccable` — **COMPLETE 2026-08-29, awaiting cycle acceptance.** Was POL-1 closer (ultron-impeccable) — **production complete
2026-08-28**: all 22 plan tasks done (QA-3 5/5 PASS, user-judged; QA-1/2/4
user-PASSed; PS-4/VIS-7/VIS-7b committed in 8be184c). `$impeccable document`
ran 2026-08-28: DESIGN.md + .impeccable/design.json generated (scan mode,
user-ratified North Star "The Touring Rack") and **user-accepted**.
`$impeccable critique` ran (first run, **27/40**, snapshot
`.impeccable/critique/2026-08-29T05-41-33Z__index-html.md`); user gate
answers: occlusion first · family edge keep · all 5 issues · include canvas
bypass cue. Executing the refinement checklist one entry at a time, pausing
for user approval after each.

## Active Task
**Cycle acceptance (user's final gate).** The impeccable phase is complete:
round 1 (5 entries: occlusion, plain-language params, error recovery, 11px
floor, bypass indication) + round 2 (3 entries: pinned OUT footer, keyboard
node addition, inline preset dialogs) all landed and user-approved (E5, R2-2
approved by progression). Critique trend 27 → 33 → **35/40 (Good)**, all
Priority Issues resolved, no regressions (snapshots in .impeccable/critique/).
Standing finding recorded as deliberate design: manual +24 dB gain /
limiter removal mid-show is human sovereignty (the human outranks the policy
that binds the agent) — backlog P3s in the closing snapshot. Final document
refresh done (DESIGN.md + sidecar + README operator sections). Ledger:
[refinement.md](refinement.md).

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

## Cycle 2 Acceptance (2026-08-29)
**Cycle 2 ACCEPTED by user** (final gate passed). All 22 tasks done, QA green,
impeccable closed at 35/40 (Good), refinement rounds 1–2 landed and approved.
Cycle 2 is complete.

## Cycle 3 — Shelved Effects (Noise Gate, Distortion, Chorus, Autotune)
**Phase: town-hall.** New scope per user: research into adding the cycle-1
Fast-Follow audio effects that never shipped (noise gate, distortion, chorus,
autotune). Existing nodes: gain, EQ, compressor, limiter, delay, reverb, via
the `registerNodeType()` contract in src/audio-graph.js. Carried-over open
question from cycle 1: noise-gate implementation approach (no native Web
Audio node). Coordinator: ultron-swarm. Next action: run `$town-hall` to
produce docs/ultron/town-hall.md (cycle-3 scope) → plan → deep-research-swarm.

## Cycle 3 — Town Hall Record (2026-08-29)
town-hall.md (cycle 3) assembled at docs/ultron/town-hall.md. All clusters
signed off individually across two grilling rounds (Q1–Q10, all approved as
recommended): hard-tune research-gated with slow-correction fallback,
experimental badge on autotune only, four effects at existing QA bar +
fixed test vocal as universal acceptance input, no new MCP tools, full
preset round-trip. Cycle-2 artifacts archived to cycle-2/. Research queue:
OQ-1 gate approach + OQ-2 hard-tune feasibility (blocking); OQ-3/OQ-4
(inform). Next: present assembled brief for final record confirmation →
$plan-it-out.

### Cycle-3 town-hall: APPROVED 2026-08-29 (final record confirmation, no corrections).
Phase: plan. Next: $plan-it-out on docs/ultron/town-hall.md.

## Cycle 3 — Plan (2026-08-29)
plan.md written via $plan-it-out: 13 tasks, 6 lanes, 4 milestones, research
queue RQ-1 (gate, blocking) / RQ-2 (hard-tune feasibility, blocking) /
RQ-3 (distortion) / RQ-4 (chorus). Phase gate: user plan approval.

### Cycle-3 plan: APPROVED 2026-08-29 (no targeted changes).
Phase: deep-research. Next: $deep-research-swarm on RQ-1..RQ-4 (RQ-1/RQ-2 blocking).

## Cycle 3 — Deep Research Record (2026-08-29)
All four tracks completed; records in research/rq1..rq4*.md. Decisions all
user-COMMITTED (D1–D4): D1 pure AudioWorklet gate (worklet RMS detector,
real AudioParams, internal hysteresis/hold/look-ahead); D2 YIN+TD-PSOLA
single-worklet autotune, conditional PASS for hard-tune, AT-0 spike confirms;
D3 tanh soft-clip + 4x oversample + pre-gain drive + lowpass tone; D4
2-voice L/R phase-opposed chorus, native nodes only. plan.md updated by
subagent: GATE-1/DIST-1/CHOR-1 unblocked; scope/criteria unchanged → no
whole-plan re-approval needed. Phase: production. Next: $production-swarm
starting TEST-1 + UI-1.

## Cycle 3 — Production Record (2026-08-29)
**Active task: DOC-1 — status `awaiting-approval`** (README/DESIGN refresh;
see the DOC-1 record below. TEST-1/UI-1/DIST-1/CHOR-1/GATE-1/AT-0/AT-1/
UI-2/PRE-1/MCP-1/QA-1/QA-2 were approved 2026-08-29; their evidence is in
[production-log.md](production-log.md)).

### TEST-1: APPROVED 2026-08-29 (CC0 test vocal, license recorded). Next dispatch: UI-1.

### UI-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: UI-1 — status `awaiting-approval`** (discrete key/scale param control: native `<select>` param-control type in src/param-controls.js + .param-select styling; 23-check test tests/test-discrete-param-controls.js; full suite 15/15 / 811 checks green; evidence in [production-log.md](production-log.md)). Next unblocked: DIST-1 (TEST-1 approved).

### UI-1: APPROVED 2026-08-29. Next dispatch: DIST-1.

### DIST-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: DIST-1 — status `awaiting-approval`** (distortion node: src/node-distortion.js per D3 — fixed tanh soft-clip curve (N=2047, tanh(1.5x)/tanh(1.5)), WaveShaper oversample '4x', Drive via pre-GainNode (1.0–10 linear), Tone via lowpass biquad (exponential 1.5–12 kHz), unity-capped Output GainNode guard on every write path; downstream limiter untouched; 38-check test tests/test-distortion-node.js; full suite 16/16 / 849 checks green; evidence in [production-log.md](production-log.md)). Audio-quality acceptance (audible/param-reactive/bypass-clean/artifact-free on test-vocal.mp3) is user-judged in QA-1. Next unblocked: CHOR-1 (build order), also GATE-1 and AT-0.

### DIST-1: APPROVED 2026-08-29. Next dispatch: CHOR-1.

### CHOR-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: CHOR-1 — status `awaiting-approval`** (chorus node: src/node-chorus.js per D4 — 2-voice L/R phase-opposed chorus, all native: 2×DelayNode (25 ms baseline, LFO excursion ±Depth), one sine OscillatorNode feeding sign-flipped ±depth GainNodes into both a-rate delayTime params (exact 180° phase opposition), StereoPanner L(-1)/R(+1) per voice into a wetSum, equal-power dry/wet cos/sin Mix exactly as Delay's law; Depth 0–10 ms / Rate 0.1–8 Hz / Mix 0–100 % per D4; 12 native nodes, 0 worklets; 45-check test tests/test-chorus-node.js; full suite 17/17 / 894 checks green; evidence in [production-log.md](production-log.md)). Audio-quality acceptance (audible/param-reactive/bypass-clean/artifact-free on test-vocal.mp3) is user-judged in QA-1. Next unblocked: GATE-1 (also AT-0).

### CHOR-1: APPROVED 2026-08-29. Next dispatch: GATE-1.

### GATE-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: GATE-1 — status `awaiting-approval`** (noise gate node per
D1: src/gate-worklet.js AudioWorklet processor — per-block RMS detector,
one-pole envelope, 6 dB hysteresis, 50 ms hold, 5 ms per-channel
look-ahead ring, per-sample dB-linear Attack/Release ramps between Floor
and 0 dB, real k-rate AudioParams for Threshold/Attack/Release/Floor;
src/node-gate.js registration shim with the reverb-style async addModule
placeholder+splice and AudioParamRamp applyParam; 75-check test
tests/test-gate-node.js incl. the real processor driven in a stubbed
AudioWorkletGlobalScope; full suite 18/18 / 969 checks green; evidence in
[production-log.md](production-log.md)). Audio-quality acceptance
(audible/param-reactive/bypass-clean/artifact-free on test-vocal.mp3) is
user-judged in QA-1. Next unblocked: AT-0 (TEST-1 + RQ-2's D2 conditional
PASS; parallel with remaining node tasks), also UI-2/PRE-1 incrementally
for the landed effects.

### GATE-1: APPROVED 2026-08-29. Next dispatch: AT-0 (autotune feasibility spike).

### AT-0 dispatched 2026-08-29 (production-swarm worker)
**Active task: AT-0 — status `awaiting-approval` — VERDICT: HARD-TUNE PASS**
(autotune feasibility spike per D2: disposable YIN + TD-PSOLA prototype in
one AudioWorklet-shaped processor at tests/spike/at0-autotune-worklet.js,
driven offline through a vm-stubbed AudioWorkletGlobalScope by
tests/spike/run-at0-spike.js; TEST-1 decoded via ffmpeg to mono 48 kHz f32 —
documented substitution for decodeAudioData. Decisive numbers on the D2
pass bar: added latency exactly 20.0 ms on all paths (impulse-exact, covers
the wet path to ~104 Hz); p99 CPU 0.337 ms = 12.6% of the 2.667 ms quantum
(~3.8% of a core); synthetic detection 0.0 cents median error, 0 octave
errors; snap residual on TEST-1 median 2.5 cents / 90.9% of voiced frames
within 10 cents (C-major 2.4c); AM depth 0.0 dB, worst-window SNR at the
input's own harmonic floor, 0 dropout windows below -20 dB, HF click ratio
0.97, spectral flux ratio 1.07; slow correction (retune 250 ms) verified on
the same engine with equal-or-better artifacts. Four measured
design-failure lessons for AT-1 recorded (shrinking-window YIN, fixed
declared delay vs adaptive margins, no grain writes into emitted history,
onset-bias-aware snap state machine). Audibility itself remains the user's
QA-1 judgment — listening WAVs in tests/spike/out/. Prototype is DISPOSABLE:
nothing in src/ or index.html; committed suite re-run 18/18 files / 969
checks green. Full record: [research/at0-spike-result.md](research/at0-spike-result.md);
metric dump tests/spike/at0-spike-report.txt.) AT-1 branch selected:
Outcome PASS (hard-tune; slow retune stays a user setting on the same
engine). Next unblocked: AT-1 upon AT-0 approval (UI-1 already approved),
then UI-2/PRE-1 for autotune.

### AT-0: APPROVED 2026-08-29 — HARD-TUNE PASS (record research/at0-spike-result.md). AT-1 committed to hard-tune branch (slow retune as user setting). Next dispatch: AT-1.

### AT-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: AT-1 — status `awaiting-approval`** (autotune engine node,
Outcome-PASS branch: `src/autotune-worklet.js` — the AT-0 spike engine
ported 1:1 and productionized (telemetry arrays removed; per-block path
allocation-free via scalar ring buffers; per-channel dry rings so mix=0 is
bit-exact per channel) with the four AT-0 lessons structural and
regression-tested (shrinking-window YIN + swap trick; fixed declared 20 ms
delay — impulse bit-exact early AND late, stall/race-free; no grain writes
into emitted history across 17+ ring wraps; ±0.52 st hysteresis with
stability-gated first lock); `src/node-autotune.js` registers it on the
gate's async addModule placeholder+splice pattern and maps UI-1's discrete
Key/Scale strings to the worklet's numeric enums at every boundary; Retune
0–500 ms = hard-tune default + slow correction on one engine; Mix 0–100 %;
minimal experimental badge on the node card (canvas.js — formal component
is UI-2's). Evidence: 100-check `tests/test-autotune-node.js` (snap
residuals ≤6.5c on 15 synthetic targets incl. forbidden-note masking;
TEST-1 slice through the production engine: median 2.3c / p95 14.8c / 91.2%
within 10c, 0 dropout windows, HF 0.97 — matching AT-0's full-track
numbers; CPU p99 9.8% vocal-like / 8.5% max-grain-rate vs spike 12.6%/9.2%
— telemetry removal paid); full suite 19/19 files / 1069 checks green.
Artifact review on TEST-1 is user-judged in QA-1. Next unblocked: UI-2
full pass (badge + palette for all four), also PRE-1 for autotune.)

### AT-1: APPROVED 2026-08-29 (hard-tune branch, production engine landed). Next dispatch: UI-2.

### UI-2 dispatched 2026-08-29 (production-swarm worker)
**Active task: UI-2 — status `awaiting-approval`** (palette/card
integration, all four effects: chips were already registry-driven so the
pass formalized the encoding — FAMILY_INITIALS DI/CH/NG/AU; the AT-1
minimal hook formalized into `createExperimentalBadge()` in
src/canvas.js, one factory + single EXPERIMENTAL_TYPES source, two
surfaces (full "Experimental" tag on the autotune card header + compact
"EXP" tag right-pinned on its palette chip, autotune aria-label now
"Add Autotune to chain (experimental)", SR-by-content both places);
styles/main.css gains four rq5-compliant family tokens
(distortion #C0CE97 / chorus #9E9ED1 / gate #9AD5B2 / autotune #D19ED1;
ink 6.74–10.22, vs card 5.30–8.04, gap-center hues ≥25° from every
existing family) + the 8 chip/card data-family mappings + the
chip-context badge rule (margin-left only, typography shared by
construction); collapse behavior inherited and verified per type;
keyboard add verified through the shared commit chokepoint incl. the
terminal-limiter policy. Evidence: 152-check
tests/test-palette-cards-cycle3.js over the real ten-module registry in
a vm-DOM harness (browser tool unavailable to subagents — honest note in
the test header + log; rendered visuals are QA-1's user judgment); full
suite 20/20 files / 1221 checks green. See
[production-log.md](production-log.md) UI-2 for the color table.) Next
unblocked: PRE-1 (preset schema + round-trip for all four; node tasks
all landed), then MCP-1 after PRE-1.

### UI-2: APPROVED 2026-08-29. Next dispatch: PRE-1.

### PRE-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: PRE-1 — status `awaiting-approval`** (preset schema +
round-trip, all four cycle-3 effects: `src/preset-schema.js` gains
TYPE_PARAM_CONTRACTS — hand-mirrored param declarations for
distortion/chorus/gate/autotune, drift-checked against the live registry —
and deserialize() now validates every PRESENT param of a declared type
(unknown name, wrong type, out-of-nominal-range number, illegal autotune
Key/Scale string/enum → specific rejection into the existing store-layer
recovery paths); legacy six-type presets keep structure-only treatment and
load byte-unchanged; `persistence.js` + `preset-store.js` load paths guard
against unregistered node types via the LIVE NodeTypes registry
(default-chain fallback / load-returns-null instead of a mid-buildGraph
crash; lenient when the registry is absent). Decisions: default chain
UNCHANGED (first-run sound preserved); NO cycle-3 factory preset yet
(provenance awaits QA-1; set_chain's numeric-only param validation is
MCP-1's lane — notes in both files). Evidence: 171-check
tests/test-preset-cycle3.js — all-four + legacy 10-node exact round-trips
through PresetSchema/PresetStore/Persistence (key/scale strings, retune,
mix, numeric enums), boundary min/max acceptance, legacy byte-unchanged
loads, 20 hostile-entry recovery cases; full suite 21/21 files / 1392
checks green.) Next unblocked: MCP-1 (UI-2 + PRE-1 both done).

### PRE-1: APPROVED 2026-08-29 (default chain unchanged; factory presets deferred pending QA-1 + MCP-1 set_chain string-param fix). Next dispatch: MCP-1.

### MCP-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: MCP-1 — status `awaiting-approval`** (agent operability +
capabilities badge, NO new tools: discrete string params legal through
set_chain/add_node/set_param — a type's UI-1 `values` list (autotune
key/scale) or preset-schema's raw enum form, illegal values → the
standard INVALID_ARGUMENTS problem with the allowed list inline, closing
PRE-1's documented numeric-only gap; the experimental badge's single
source of truth moved to the type's own registration
(`experimental: true` + new NodeTypes.isExperimental() — canvas.js's
badge and the get_capabilities readout both read it, each keeping only a
bare-harness fallback mirror), readout carries per-type `experimental` +
note (autotune only) and the summary names it; the four cycle-3 types
publish real param contracts in the readout (snapshot + TYPE_INFO +
agent policies = nominal ranges/value lists, no more registry-drift
placeholder); string set_param rides the issue-#5 param-only fast path.
Evidence: 85-check tests/test-mcp-tools-cycle3.js driving the REAL tool
pipeline over the real ten-node-file registry — add/update of all four
effects incl. key 'A'/'F#'/'D#' + scale 'Minor'/'Major' verified into
model AND worklet enums, raw enums round-trip, 10 illegal-value cases
rejected cleanly (nothing applied, zero undo), badge verified in
live-registry and bare-harness readouts; full suite 22/22 files / 1477
checks green.) Next unblocked: QA-1 (per-effect acceptance runs — all
node tasks + MCP-1 now done).

### MCP-1: APPROVED 2026-08-29. Next dispatch: QA-1 (user-judged audio acceptance).

### QA-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: QA-1 — status `awaiting-approval`** (per-effect acceptance
runs on TEST-1. Objective slice complete: `tests/qa-out/run-qa1.js` renders
12 listening WAVs through the REAL production node code offline — buildGraph-
routed composites with a spec-shaped Web Audio runtime for distortion/chorus,
the real gate/autotune worklets through the real async addModule path — and
runs the earless checks: bypass-clean (chain bypass bit-exact vs source; gate
Floor=0 / autotune Mix=0 / chorus Mix=0 all bit-exact mod declared latencies;
distortion honestly reported as no-bit-exact-neutral by design, Drive=0
−37.9 dB, clean path = Bypass), param reactivity 14/14 (incl. worst-window
deltas for locally-acting params), dropout/glitch proxies matching AT-0
(autotune 0/1469 windows < −20 dB, HF 0.97, flux 1.06), clipping 0/12 files
with the distortion unity guard at exactly 1.0 and destination −4.2 dBFS at
max drive. Natural key measured A# (median f0 232.7 Hz); wrong-key demo E
(tritone) snaps 99.4% of output frames onto the wrong grid. Agent
operability + preset round-trip cited from MCP-1/PRE-1 tests; suite 22/22 /
1477 green. Listening protocol at `tests/qa-out/LISTENING.md` — **the user's
listening verdict completes the acceptance (audio quality is user-judged,
same bar as cycle-2 QA-3; verdict not yet given)**.) Next unblocked upon
approval: QA-2 (regression: existing six effects + safety net).

### QA-1: APPROVED 2026-08-29 — all four effects user-PASSED on the test vocal.
Verdicts: gate clean onsets/tails; distortion both approved as-is; chorus
extreme enthusiastically approved ("wild"); autotune liked, perceived
"slightly laggy" in A/B — recorded as the accepted 20 ms declared delay
(passed the D2 bar at the boundary), not a defect. Objective slice in
tests/qa-out/qa1-report.txt; protocol in tests/qa-out/LISTENING.md.
Next dispatch: QA-2.

### QA-2 dispatched 2026-08-29 (production-swarm worker)
**Active task: QA-2 — status `awaiting-approval`** (regression: existing
six effects + safety net. (1) Full suite 23/23 files / 1584 checks green,
now including the new committed 107-check tests/test-regression-cycle3.js
covering every shared-code leak surface: registry shape legacy-only vs
ten-module, legacy param rows still sliders with numeric parseFloat
commits through the real applyParam/AudioParamRamp conversions, hostile
legacy presets still load while declared-type abuse rejects, DEFAULT_PRESET
still the committed six-node chain, string-on-legacy-param refused
INVALID_ARGUMENTS through set_param AND set_chain, legacy --family-* CSS
tokens byte-identical to cycle-2. (2) Offline render harness
tests/qa-out/run-qa2.js (report tests/qa-out/qa2-report.txt): the shipped
AND corner-params six-node chains render BIT-IDENTICAL with all ten
modules loaded vs only the six legacy modules (sensitivity-guarded); the
REAL MeterTaps watchdog over chains containing all four new nodes — valid
ten-node program no-trip, limiter-less hot all-four chain trips+latches
(exact post-trip silence), rebuild-while-latched schedules no upward
chain-gate ramp and un-ducks to mute level, latch holds through quiet
program, human Restore alone reopens, restored chain no re-trip; agent
terminal-limiter refusals over an all-four chain in part D. (3) Bypass:
QA-1's four-new-chain bit-exact cited and extended to an ALL-TEN chain —
bit-exact vs raw source. No regressions found; nothing in src/ changed.
Note: an earlier dispatch was interrupted mid-task; this one re-verified
everything from scratch and regenerated the stale report.) Next unblocked
upon approval: DOC-1 (README/DESIGN refresh — QA-1 approved).

### QA-2: APPROVED 2026-08-29 — zero regressions (bit-identical legacy renders, safety net intact, all-ten bypass bit-exact). Next dispatch: DOC-1 (final task).

### DOC-1 dispatched 2026-08-29 (production-swarm worker)
**Active task: DOC-1 — status `awaiting-approval`** (README/DESIGN refresh:
README gains the "The four newer effects — what they're for" operator
section — gate/distortion/chorus in plain language with when-to-reach
guidance, autotune with the Experimental badge AND the accepted 20 ms
declared delay framed as expected behavior — plus the reproducible demo
pointer (assets/test-vocal.mp3, CC0, credited in THIRD_PARTY_NOTICES.md;
`node tests/qa-out/run-qa1.js` → tests/qa-out/LISTENING.md); its intro
effect list, operator effects list, sliders/selects claim, and
Verification coverage line updated. DESIGN.md extended in the cycle-2
fold-in style, no redesign: four family tokens in the frontmatter +
ten-family-edges bullet (distortion #C0CE97 / chorus #9E9ED1 /
gate #9AD5B2 / autotune #D19ED1, rq5 rules), experimental-badge treatment
under Cards, discrete param select under Inputs/Fields, faders scoped to
continuous params. Stale claims fixed: PRODUCT.md 6→10 node types,
8→10 tools, sliders+selects; docs/ACCEPTANCE.md eight→ten tools (×3),
six→ten node handlers, select step on the click-check line, cycle-3
effects pointed at LISTENING.md. Docs only — nothing in src/, styles, or
preset data changed. Evidence in [production-log.md](production-log.md).)
Next: none — DOC-1 is the final cycle-3 task; cycle acceptance follows.

### DOC-1: APPROVED 2026-08-29 — all 13 cycle-3 tasks COMPLETE. Finishing
phase deferred: user directs a PR first — brother submitted major changes to
the project; reconcile discrepancies before $ultron-impeccable.

### Production commit (2026-08-29): all cycle-3 work committed atomically on
branch cycle-3-shelved-effects (3bf16c2, 66 files) and pushed to origin.
PR to open: https://github.com/Arrangedgodly/karaoke/pull/new/cycle-3-shelved-effects
BLOCKED on: brother's "submitted major changes" — not found on origin (no
new commits on origin/main, no other branches, no forks visible). Awaiting
user input on where they live (fork? patch? unpushed?) before reconciliation.

### PR reconciliation (2026-08-29): brother's PR #17 (7 commits — truthful
preset mutations/undo/storage-failure reporting, ordered tool registration,
watchdog worklet protection restore, stale device-switch invalidation,
agent-ui toast refactor) merged into cycle-3-shelved-effects (27e3f99).
Only docs/ACCEPTANCE.md conflicted; resolved preserving both intents.
Full suite 23/23 files / 1702 checks green post-merge. Branch pushed.
Finishing phase ($ultron-impeccable) unblocked pending user go.

## Cycle 3 — Finishing Phase (2026-08-29)
Production complete + PR #17 reconciled. Phase: ultron-impeccable (approval
mode) — document + critique passes over the ten-effect surface, then gated
refinements. Surface artifacts exist from cycle 2 (PRODUCT.md,
.impeccable/surfaces/index-html.md, .impeccable/design.json).

### Finishing (2026-08-29): document pass done (DESIGN.md confirmed current;
sidecar regenerated with cycle-3 colorMeta + badge/param-select components).
Critique 32/40 (snapshot 2026-08-30T04-01-50Z__index-html.md; trend
27→33→35→32, polish-layer dip). Gate answers: help-layer first · Drive/Tone
normalize 0–100 · all issues. Checklist: refinement.md entries 1–5 queued.
**Entry 1 (clarify, P2-1 help gap) landed 2026-08-29 — awaiting user
approval**: 14 plain-language lines for gate/distortion/chorus/autotune in
src/param-controls.js (28/28 params helped across all ten types, same
mechanism/register/a11y as the cycle-2 layer; autotune Key line carries the
experimental + accepted-20-ms disclosure). New help-completeness gate in
tests/test-palette-cards-cycle3.js §H; suite 23/23 / 1823 green. Next:
entry 2 (typeset, EXP badge 11px floor).

### FIN-1 (clarify): APPROVED 2026-08-29. Next: entry 2 (typeset).

**Entry 2 (typeset, P2-2 EXP badge floor) landed 2026-08-29 — awaiting
user approval**: badge raised 0.625→0.6875rem (computed 11px, the
legend-initials floor) on BOTH placements through the one shared CSS
rule (chip rule never set a size — cannot drift); side padding
0.3→0.35rem; CSS comment + DESIGN.md spec + design.json sidecar
corrected to match the stylesheet. New §I floor gate in
tests/test-palette-cards-cycle3.js; headless-Chrome render check: no
wrap/overflow at the real 200px palette flank (or a 220px variant) or at
production card width; header rhythm, chip density, aria-label unchanged.
Detector 13→12 (badge off-ramp advisory gone). Suite 23/23 / 1836 green.
Residual (pre-existing, disclosed): sub-~680px-window card squeeze.
Next: entry 3 (layout, palette grouping).

### FIN-2 (typeset): APPROVED 2026-08-29. Next: entry 3 (layout).

**Entry 3 (layout, P2-3 palette chunking) landed 2026-08-29 — awaiting
user approval**: the ten palette chips chunk under three operator-language
silkscreen group headers — "Shape your voice" (EQ/Distortion/Chorus/
Autotune), "Polish your sound" (Gain/Compressor/Delay/Reverb), "Keep it
safe" (Limiter/Noise Gate) — in the optgroup legend register (0.7rem/700/
uppercase/0.08em/muted), real non-focus h3s interleaved in the FLAT list:
chips stay direct-children buttons (R2-2 keyboard/SR flow + DOM order
unchanged, no new interactive layer), within-group order is registration
order, and the group map carries a fallback so a future type can never
vanish (unmapped type fails the new test gate). Limiter semantics
preserved exactly (chip byte-identical; terminal-limiter policy untouched;
"Keep it safe" is presentational). Palette Sortable scopes drag items to
'.node-chip' so headers are pointer-inert (chip drag unchanged, verified
against vendored SortableJS). New §J in tests/test-palette-cards-cycle3.js
(+26 checks); headless-Chrome render check: headers single-line at 11.2px,
zero overflow, chips 167×38px at the real 200px flank (187×38 at a 220px
variant), 10 focusables all BUTTON. Detector 4 findings (standing
adjudicated set, unchanged). Suite 23/23 / 1862 green. Residual:
design.json group labels await the post-loop document refresh. Next:
entry 4 (polish, Drive/Tone 0–100 normalization).

### FIN-3 (layout): APPROVED 2026-08-29 (user inspected in live browser).
Next: entry 4 (polish).

**Entry 4 (polish, P3-4 Drive/Tone readout) landed 2026-08-29 — awaiting
user approval**: distortion Drive/Tone now read "25%"/"70%" on the
surface's 0–100 % convention (the Mix "30%" string shape, same mono
tabular register) via a display-only `displayScale: 100` field on the
two paramSpec entries that the generic formatter in
src/param-controls.js multiplies into the rendered string ONLY — slider
min/max/step, model values, AudioGraph bookkeeping, preset
serialization (saved drive 0.25 = same sound), audio mapping, and the
agent set_param 0..1 contract (capabilities readout keeps truthfully
publishing 0..1) all unchanged. Sweep: distortion drive/tone were the
only 0–1+% mismatches — all other % params are already 0–100 (delay
Feedback/Mix, reverb/chorus/autotune Mix), and gate/chorus/autotune/
compressor params render their documented units (dB, s, ms, Hz, :1);
now suite-enforced by a registry gate + ten-type "0.X%" readout scan
(new §K in tests/test-palette-cards-cycle3.js, +34 checks; headless-
Chrome render check over http confirms the live card, drag values,
agent-path 0.5 → "50%", and the mono register). Suite 23/23 / 1896
green. No residuals. Next: entry 5 (harden, the two window.alerts +
late-context-resume strip wedge).

### FIN-4 (polish): APPROVED 2026-08-29. Next: entry 5 (harden).

**Entry 5 (harden, P3-5 partial) landed 2026-08-29 — awaiting user
approval**: (1) the two latent PS-3-era browser dialogs in
presets-ui.js's Load defensive guards (factory entry / user preset
vanishing between dropdown render and click) now route through the
panel's established quiet .preset-note line, sentence verbatim — the
surface ships zero alert/confirm/prompt calls, enforced by a new
source gate (§M test-preset-persistence-honesty.js: zero alert call
tokens across src) and §L behavioral repros of both guards. (2) The
late-context-resume wedge: handleContextState's 'running' branch only
acted when contextLost was set, so a context settling after start
completion (resume() fires in the gesture, resolves on the browser's
clock) left the strip wedged at "Stopped" while the engine ran — it now
refreshes the sentence from the same authoritative isEngineLive() read,
gated so a running transition can only raise the strip (never demotes a
shown loss or erases an operator error); Start/meters/bypass were
already correct, the fix is sentence-only. The lifecycle harness's
resume() stub is now honestly deferred (the synchronous flip hid the
bug): §J reproduces the exact interleaving + both guard rails (+20
checks; §L/§M +12). Regression proof: new checks fail against pre-fix
sources and pass with the fixes. No audio-path changes; the +24 dB /
limiter-removal sovereignty finding stays deliberate design, untouched.
Suite 23/23 / 1928 green. All five checklist entries landed — next:
closing critique + final document refresh per the trigger note.

### FIN-5 (harden): APPROVED 2026-08-29 — all five refinements done.
Pending: closing critique + final document refresh. DEFERRED: user reports
another PR/merge landed — reconcile first.

### PR #18 reconciliation (2026-08-29): compact WebMCP contract merged;
cycle-3 experimental + discrete disclosures preserved inside it; suite
23/23 / 1927 green; branch pushed. Remaining finishing work: closing
critique + final document refresh.

### Consolidation to main (2026-08-30): cycle-3-shelved-effects fast-forward
merged into main and pushed — main now carries cycle 3 (four effects),
finishing refinements R1–R5, PR #17, and PR #18 together. Finishing phase
still owes the closing critique (prior run cancelled by user mid-flight;
scratch 2026-08-30T05-10-A remains) + final document refresh.

### Final document refresh (2026-08-30): finishing phase COMPLETE. User
closed the cycle at 36/40 — no trim to capabilities; badge geometry kept
with a documented detector exemption (nested-cards flags the widened EXP
tag ~100.6×16px as a false positive — tag, not card; adjudicated keep
2026-08-30, recorded in DESIGN.md with the badge bullet). DESIGN.md
refreshed in place, no regeneration: badge spec now states the R2 reality
(0.6875rem both placements + 0.35rem side padding), the palette fallback
group is named ("More effects"), and the R4 displayScale readout (0–100 %
Drive/Tone, display-only) is documented. Sidecar synced: badge
description/css carry 0.35rem + the exemption, Palette Chip description
names the three group legends, new Palette Group Label component
(ds-prefixed, from .palette-group-label), generatedAt bumped; JSON
round-trip OK, all 24 var(--…) refs resolve in styles/main.css, all 26
narrative strings verbatim vs DESIGN.md. Cycle-3 finishing phase closed —
cycle acceptance is the remaining gate.

## Cycle 3 — Finishing COMPLETE (2026-08-30)
Closing critique 36/40 (best score; no P2+ findings, no regressions),
final document refresh landed, all work consolidated to main. Finishing
phase closed per user gate. REMAINING: final cycle acceptance (user).

## Cycle 3 — ACCEPTED (2026-08-30)
User accepted the delivered cycle (final gate passed): four effects incl.
hard-tune autotune, user-passed QA, 36/40 closing critique, all work
consolidated on main (97d6f6e). Cycle 3 is COMPLETE. Deferred work is
recorded above and in the closing critique snapshot — no scope expansion.
Artifacts stay in place; archive to cycle-3/ when cycle 4 opens (the
cycle-1/2 convention). The ultron-swarm run for this cycle is finished.

## Redesign Pass — Node Cards (2026-08-30)
converted: ultron-swarm → ultron-redesign at phase=intake. Targeted
look-and-feel pass on the node-card control layer (the FX "plugins"):
today's fader-everything rows are too wide and monotonous; the user wants
an Ableton-effect-chain feel — mixed input types (knobs et al.) and a
condensed, fluid card. Town-hall product facts carry over unchanged
(param model, presets, MCP contract, safety policy, a11y bar). Baseline =
the closing critique 36/40 (.impeccable/critique/2026-08-30T05-59-04Z).

### Intake answers (2026-08-30, user)
- Driver: node-card controls far too wide; fader-everything monotony; not
  fluid enough. Steer: Ableton-effect-chain feel — mixed input types,
  knobs, condensed cards.
- Direction: **full direction round** (7 grounded systems, script deals,
  user locks) — the Ableton steer rides as a candidate/steer, not a lock.
- Scope: cards are the main focus, but the user is "open to any other
  changes as well" once the world is locked (consistent with the full
  direction round; whole surface is in play, cards carry priority).
- Fluidity = all three: control response (drag physics, value tracking),
  motion polish (150–250ms guarded transitions), layout rhythm (snug
  chain, condensed heights, consistent control alignment).
- Off-limits / product facts that survive: param model + ranges, preset
  round-trip, 8+2 MCP tool contract incl. 0..1 agent scale, per-node
  audio bypass still DECLINED (collapse-only cards), terminal-limiter
  policy, safety net, keyboard/SR operability, 11px floor, no-runtime-
  internet, no build step, single page.
- Build path: code-led (no image generation in this harness; stated, not
  asked).

Phase: baseline → direction.

### Direction LOCKED (2026-08-30): Pattern Machine
User locked the assigned card (optionId "assigned", no steer, buildPath
code-led untouched). Seed 2a363f1b; direction contract + schedule in
[redesign.md](redesign.md). Alternates shown: Pedalboard (model pick),
One-Bit Desktop + Teletext (competitive), 4 declined w/ kept lines.
Phase: execute — item 1 (chain-canvas surface round) dispatched first.

### Surface structure LOCKED (2026-08-30): Single Face Chassis
User locked the dealt lead (seed 2e642e38, dealt 4/7/3), steer empty.
One continuous faceplate; sections as panel-print blocks + encoder
fields split by machined grooves; display register on the top edge.
Item-1 BUILD dispatched (code-led; craft floor; contract comment; tests
green; detector + screenshots).

### Change-control event (2026-08-30): patch-chain editor routed to $ultron
User directive mid-redesign: free-canvas plugins + draggable patch cords
(in/out jack points, MIC IN one out, master OUT one in) + tiny snap
grid; FLOW toggle becomes per-card content-flow. This is a product
BEHAVIOR change → new $ultron cycle (town-hall → plan → production)
building it inside the locked Pattern Machine world; ultron-redesign
stays open (item 1b flanks round pending user pick; items 2–8 queued)
and owns the patch system's visual layer. Sequencing recommendation
given to user: open the town-hall now; both tracks can run.

### Item 1b built (2026-08-30): Two-Deck Stack — awaiting user gate
System deck (etch/lamp/Start/BYPASS end key) + machined seam + voice
deck (palette | chain face | presets as printed zones); canvas internals
untouched; wiring sync fixes: none; suite 25 files / 2072 checks green;
detector deltas = --pm-* tokens pending finish-phase DESIGN.md refresh.
Town hall (cycle 4): all clusters signed off; assembled brief awaiting
final record confirmation → then $plan-it-out.

## Cycle 4 — Town Hall APPROVED (2026-08-30)
Final record confirmed by user, no corrections. Scope: free-canvas
patch-cord chain editing (cords edit order, never gate audio; linear
topology; bounded panel; snap grid; TIDY) + continuous clamped card
resize + per-card flow glyph (canvas FLOW retired) + autosave-only
layout with legacy migration. Non-goals per brief (incl. per-node bypass
stays DECLINED, no human-edit undo, no agent positioning). OQ-1..8
production/planning-owned; OQ-9 (cord/jack/grid visual) stays with the
ultron-redesign run. Phase: plan. Next: $plan-it-out on
docs/ultron/town-hall.md → user plan-approval gate → production.

## Cycle 4 — Plan (2026-08-30)
plan.md written via $plan-it-out from the approved brief: 16 tasks, 5
lanes, 4 milestones, NO research queue (all open questions in-house).
Critical path FEW-4 (cord editing semantics). Planning decisions PD-1
(chain SortableJS retired; grip-drag = position move only), PD-2
(continuous card scale with STEPPED text at the 11px floor — flagged
for user approval), PD-3 (SVG cord layer), PD-4 (DOM order = chain
order). Phase gate: user plan approval → $production (M1 first).

### Rebrand (2026-08-30, user): VOXCHAIN
Display name swapped across index.html (title + identity print),
README/PRODUCT/DESIGN, src comment headers, MCP capabilities app id
('voxchain', test pin synced), design.json title. Kept: localStorage
keys (data preservation), repo/CNAME (owner's infra call), genre prose.
Rode no schedule item — mechanical coordinator task between gates.

### Cycle-4 plan APPROVED (2026-08-30) — PD-2 as proposed
User approved the plan incl. stepped-text-within-continuous-scale.
Production dispatch serialized behind the redesign item-2 element round
(single working tree, single writer): M1 (FEW-1 + QA-1 + DAT-1) goes
first-dispatch after the element round lands.

### Rebrand follow-on: item 1b APPROVED (2026-08-30); VOXCHAIN name in
the shipped Two-Deck build. Item 2 element round dispatched.

## OVERLORD TAKEOVER (2026-08-30)
converted: ultron-redesign (+ open cycle-4 ultron run) → ultron-overlord
at phase=production-cycle-4 + redesign-execute, next task FEW-1.
Clock: restarted at takeover (no prior overlord clock). Checkpoint
committed pre-takeover (approved item 1 + adjustment + 1b + rebrand;
item-2 switcher pending pick, suite 25 files green at stop). Element
worker hard-stopped at ~4.9h overrun — wrap-up: variants preserved
behind the page switcher, pick batched into the conversion sitting.

### Overlord sitting (2026-08-30, batched) — answers recorded
Item-2 control anatomy: A ENCODER (current) — unpicked variants to be
stripped (FEW-0). Sheds accepted: items 5–7 (agent-side P3s) + item 3
(chrome taste round) defer first; protected: cycle-4 M1–M4, item 4
extract, finish phase. Auto-approval: ON with evidence paths; final
acceptance stays user-owned. Clock started at sitting end.

FEW-0 auto-approved (ultron-overlord) — evidence: production-log.md FEW-0 verify (grep-clean + suite exit 0) — budget 5:00, actual 4:24 + wrap-up verify

### FEW-1 dispatched 2026-08-30 (production-overlord worker)
**Active task: FEW-1 — status `awaiting-approval`** (layout store seam + schema
migration: src/persistence.js autosave slot becomes a versioned envelope
`{autosaveVersion: 2, chain: <PresetSchema wire form unchanged>, layout:
{<nodeId>: {x, y, scale, flow}}}` under the SAME key; legacy slots (no
envelope) migrate to the tidy-stack fallback `layout: {}` idempotently;
sanitizeLayout prunes unknown node ids on save AND load and fails soft on
hostile entries (a corrupt layout never rejects a valid chain);
`saveCurrentChain(model, layout)` seam: object=pruned+normalized,
undefined=carry-forward, null=explicit clear (TIDY); new
`loadInitialLayout()` export, `loadInitialModel()` array contract
unchanged; PresetStore/preset schema UNTOUCHED (presets chain-only — preset
replacement leaves layout tidy via the prune rule); canvas consumer NOT
wired (FEW-2). Evidence: 74-check tests/test-autosave-layout-store.js;
suite 26/26 files / 2150 checks green.) Next unblocked: FEW-2 (after
approval), QA-1 + DAT-1 parallel per M1.
FEW-1 auto-approved (ultron-overlord) — evidence: tests/test-autosave-layout-store.js — budget 5:00, actual ~5:07 + verify

### FEW-2 dispatched 2026-08-30 (production-overlord worker; wrapped by wrap-up worker)
**Active task: FEW-2 — status `awaiting-approval`** (free positioning + TIDY:
sections absolutely positioned inside the bounded canvas panel, grip
pointer-drag MOVES POSITION snap-quantized to GRID_PITCH=16 with persistence
on MOVE-END only via saveCurrentChain(model, layout); pointerdown brings to
front as JS zIndex (paint, never DOM — DOM order = chain order, PD-4);
chain-list Sortable RETIRED per PD-1 (palette's remains, exactly one
instance); TIDY control in the flow-toggle chrome zone rewrites ONLY x/y
(preserving scale/flow); loadModel(model, layout) applies saved layouts with
tidy-stack/first-free-slot auto-place and removal prunes the layout map.
Worker stopped at its 10-min budget mid-task; wrap-up verified the tree
meets every acceptance criterion and is green. Evidence: 27-check
tests/test-board-positioning-few2.js (sections A–G); suite 27/27 files /
2177 checks green.) Next unblocked after approval: FEW-3, FEW-5, FEW-6,
FEW-8 (FEW-7 additionally after FEW-3); QA-1 + DAT-1 still parallel.
FEW-2 auto-approved (ultron-overlord) — evidence: tests/test-board-positioning-few2.js — budget 10:00, actual ~10:07 + wrap 2:38 + verify
