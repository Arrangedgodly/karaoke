# Cycle 3 Plan — Shelved Effects (Noise Gate, Distortion, Chorus, Autotune)

Source: [town-hall.md](town-hall.md) (cycle 3, approved 2026-08-29).
Coordinator: ultron-swarm. Statuses live in the task index below.

## Fixed by scope (do not re-litigate)

- Four effects on the `registerNodeType()` contract (`src/audio-graph.js`),
  conforming to the cycle-2 UI frame (vertical chain, collapse-only cards).
- Param sets: Gate (Threshold/Attack/Release/Floor), Distortion
  (Drive/Tone/Output), Chorus (Depth/Rate/Mix), Autotune (Key+Scale/Retune
  Speed/Mix). Plain-language labels per existing param style.
- Autotune: hard-tune only if RQ-2 feasibility bar passes (artifact-free on
  the test vocal, latency within ~10–20 ms budget); otherwise slow
  retune-speed correction — same engine, different retune parameter.
  Experimental badge on autotune only.
- Scales: Chromatic (default) / Major / Minor × 12 keys.
- No new MCP tools; capabilities readout carries the badge.
- Full preset round-trip for all four, including key/scale.
- Fixed test vocal = universal acceptance input (TEST-1).
- All cycle-2 non-goals carry over.

## Research queue (→ deep-research-swarm)

| RQ | Question (answerable, task-tied) | Ties to | Blocking? | Status |
|----|----------------------------------|---------|-----------|--------|
| RQ-1 | How should a noise gate be built in Web Audio with no native node — AudioWorklet vs scheduled GainNode automation vs hybrid — meeting the artifact-free/bypass-clean bar on the test vocal, and what topology best fits the existing worklet harness (`watchdog-worklet.js` pattern)? | GATE-1 | **yes** | COMMITTED (D1) 2026-08-29 |
| RQ-2 | Can pitch detection + pitch shifting run in one AudioWorklet artifact-free on the test vocal within a ~10–20 ms latency budget, and which approach (autocorrelation/YPASS-family vs ML model like CREPE-tiny vs hybrid) passes the bar? Deliver the pass/fail verdict + chosen approach — this decides AT-1's outcome branch. | AT-1 | **yes** | COMMITTED (D2) 2026-08-29 |
| RQ-3 | Which WaveShaper curve family and tone-stage design gives a musical vocal distortion with Drive/Tone/Output controls and no aliasing artifacts at max drive? | DIST-1 | informs | COMMITTED (D3) 2026-08-29 |
| RQ-4 | Which chorus topology (single vs multi-tap LFO-modulated delay, stereo spread) best fits Depth/Rate/Mix on a mono vocal bus with the existing node contract? | CHOR-1 | informs | COMMITTED (D4) 2026-08-29 |

### Research outcomes (2026-08-29)

- **D1 (RQ-1)**: Pure AudioWorklet gate — `src/gate-worklet.js` + `src/node-gate.js`;
  RMS detector; Threshold/Attack/Release/Floor as real AudioParams; internal
  constants 6 dB hysteresis, 50 ms hold, 5 ms look-ahead. GATE-1 unblocked.
  Record: `research/rq1-noise-gate.md`.
- **D2 (RQ-2)**: Conditional PASS for hard-tune — YIN + TD-PSOLA in one
  AudioWorklet; AT-0 spike confirms on the test vocal before hard-tune AT-1
  tasks run (two-outcome shape unchanged); slow-correction fallback
  near-certainly feasible on the same engine. AT-0/AT-1 remain blocked until
  TEST-1 + AT-0 respectively. Record: `research/rq2-autotune-feasibility.md`.
  **Update 2026-08-29: AT-0 executed — hard-tune PASS empirically confirmed
  on TEST-1 (record: `research/at0-spike-result.md`).**
- **D3 (RQ-3)**: tanh soft-clip fixed curve, WaveShaperNode oversample '4x',
  Drive via pre-GainNode, Tone via BiquadFilter lowpass (exponential
  1.5–12 kHz), guarded Output GainNode. DIST-1 unblocked.
  Record: `research/rq3-distortion-curves.md`.
- **D4 (RQ-4)**: 2-voice L/R phase-opposed chorus — two DelayNodes + one sine
  LFO with ±depth sign-flipped feeds, StereoPanner L/R, equal-power dry/wet,
  ~12 native nodes, no worklet. CHOR-1 unblocked.
  Record: `research/rq4-chorus-topology.md`.

## Tasks by role

### Audio DSP (frontend/audio lane)

- **TEST-1 — Fixed test vocal asset** *(small)* — status: `completed`
  Source/commit one fixed test vocal (royalty-free or self-recorded, license
  recorded in THIRD_PARTY_NOTICES.md if external) to `assets/`. Outcome:
  every acceptance check and the demo reference this one file.
  Acceptance: file loads in the app as chain input; license clean.
  Deps: none. *(OQ-6 from the brief.)*

- **DIST-1 — Distortion node** *(medium)* — status: `completed` (built 2026-08-29 per D3)
  `node-distortion.js` on `registerNodeType()`: Drive/Tone/Output params,
  output guarded (Output at max must not slam the chain; downstream limiter
  untouched). Acceptance: audible, param-reactive, bypass-clean,
  artifact-free on TEST-1 asset, presets round-trip.
  Deps: TEST-1, RQ-3.

- **CHOR-1 — Chorus node** *(medium)* — status: `completed` (built 2026-08-29 per D4)
  `node-chorus.js`: Depth/Rate/Mix per RQ-4 topology. Same acceptance bar.
  Deps: TEST-1, RQ-4.

- **GATE-1 — Noise Gate node** *(medium)* — status: `completed` (built 2026-08-29 per D1)
  `node-gate.js` (+ worklet if RQ-1 says so): Threshold/Attack/Release/Floor.
  Acceptance: gate opens on vocal onset without clipping the attack
  consonant, closes on silence without chopping tails, bypass-clean,
  artifact-free on TEST-1. Deps: TEST-1, RQ-1.

- **AT-0 — Autotune feasibility spike** *(medium)* — status: `completed`
  (executed 2026-08-29 — **verdict: HARD-TUNE PASS** on the D2 bar, measured
  on TEST-1: latency exactly 20.0 ms all paths; p99 CPU 12.6% of quantum;
  snap residual median 2.5 c / 90.9% within 10 c; AM depth 0.0 dB; 0 dropout
  windows; slow-correction (250 ms) verified on the same engine. Record:
  `research/at0-spike-result.md`; disposable prototype in `tests/spike/`,
  nothing in src/ or index.html; suite still 18/18 green.)
  Disposable prototype (not shipped): pitch detect + shift in one worklet,
  measured latency and artifact review on TEST-1. Outcome: hard-tune
  PASS/FAIL verdict recorded in plan + state.md → selects AT-1 branch.
  Deps: TEST-1, RQ-2. Parallel with DIST/CHOR/GATE.

- **AT-1 — Autotune engine node** *(large, two-outcome)* — status: `completed` (built 2026-08-29 on the AT-0 hard-tune PASS verdict: `src/autotune-worklet.js` — the ported spike engine, YIN + TD-PSOLA in one AudioWorklet, telemetry-free, allocation-free per block — + `src/node-autotune.js` on the gate's async addModule pattern; Key/Scale flow as UI-1 discrete strings mapped to worklet enums; Retune 0–500 ms spans hard-tune default and slow correction on one engine; Mix 0–100 %; declared 20 ms delay; minimal experimental badge on the node card in `src/canvas.js` (formal badge is UI-2's); 100-check test `tests/test-autotune-node.js` incl. the four AT-0 lessons regress-tested and CPU re-measured (p99 9.8%/8.5% of quantum vs spike 12.6%/9.2%); suite 19/19 / 1069 checks green. Audio-quality artifact review on TEST-1 is user-judged in QA-1.)
  `node-autotune.js` on the AT-0 verdict: hard-tune (retune fast, snap to
  scale) or slow-correction (same engine, slow retune). Experimental badge
  applies either way. Acceptance: pitched test vocal corrects toward the
  selected scale audibly; bypass-clean; no dropouts on sustained notes;
  artifact review on TEST-1. Deps: AT-0, UI-1.

### UI/UX lane

- **UI-1 — Discrete key/scale param control** *(medium)* — status: `completed`
  New param-control type in `param-controls.js` (all 12 keys × Chromatic/
  Major/Minor), keyboard operable, screen-reader labeled, styled to the
  industrial label system. Acceptance: keyboard-only key change reaches
  NodeTypes.applyParam; SR announces value. Deps: none. Parallel with DSP
  lane. *(OQ-5.)*

- **UI-2 — Palette/card integration, all four effects** *(small)* — status:
  `completed` (formal pass 2026-08-29: chips/cards were already
  registry-driven, so the pass formalized the encoding — FAMILY_INITIALS
  DI/CH/NG/AU per the label-initials convention; AT-1's minimal hook
  formalized into `createExperimentalBadge()` (one factory, one
  EXPERIMENTAL_TYPES source, two surfaces: full "Experimental" tag on the
  autotune card + compact "EXP" tag on its palette chip with the
  "…(experimental)" aria-label suffix; SR-by-content both places); four
  new rq5-compliant family tokens + chip/card mappings (ink 6.74–10.22,
  card ≥5.30, gap-center hues ≥25° from every existing family);
  collapse inherited + verified per type; keyboard add + terminal-limiter
  policy verified through the shared commit chokepoint; 152-check
  tests/test-palette-cards-cycle3.js on the real ten-module registry;
  suite 20/20 / 1221 checks green. Visual/badge placement is user-judged
  in QA-1.)
  Register labels/palettes; experimental badge component on the autotune
  card; palette chips + collapse behavior inherited. Acceptance: each effect
  addable via palette (mouse + keyboard + SR), badge visible on autotune.
  Deps: each node task (DIST-1/CHOR-1/GATE-1/AT-1) as they land — may be
  executed incrementally per effect.

### Presets/Data lane

- **PRE-1 — Preset schema + round-trip, all four** *(medium)* — status:
  `completed` (formal pass 2026-08-29: `preset-schema.js` gained
  hand-mirrored per-type PARAM contracts for the four cycle-3 types —
  exported as `TYPE_PARAM_CONTRACTS`, drift-checked against the live
  registry in the test — and `deserialize()` now validates every PRESENT
  param of a declared type: unknown param name, wrong type,
  out-of-nominal-range number, or an autotune Key/Scale outside UI-1's
  legal sets ('C'..'B' / 'Chromatic'/'Minor', or the raw 0..11 / 0..2
  enums node-autotune.js documents as equally legal) is a specific
  rejection feeding the store layers' pre-existing recovery paths;
  undeclared types — the six legacy ones included — keep structure-only
  treatment, so pre-cycle-3 presets load byte-unchanged. `persistence.js`
  + `preset-store.js` load paths additionally consult the LIVE NodeTypes
  registry so a hand-edited preset naming an unregistered type degrades
  through the existing default-fallback / load-returns-null recovery
  instead of throwing mid-buildGraph (the guard degrades to lenient when
  the registry is absent/empty/broken). Decisions: default chain UNCHANGED
  (first-run sound stays as shipped; every new effect is a character
  effect — note in default-preset.js) and NO cycle-3 factory preset yet
  (library provenance is user-accepted content pending QA-1, and
  set_chain's numeric-only param validation — MCP-1's lane — would reject
  autotune's string Key/Scale in the library's own conformance test; note
  in factory-presets.js). Evidence: 171-check
  tests/test-preset-cycle3.js — all-four + legacy 10-node exact
  round-trips through PresetSchema, PresetStore, and Persistence (incl.
  key/scale strings, retune, mix, and numeric-enum forms), boundary
  min/max acceptance, legacy byte-unchanged loads, and 20 hostile-entry
  recovery cases; full suite 21/21 / 1392 checks green.)
  Extend `preset-schema.js` / `persistence.js` / `default-preset.js` /
  factory presets: new types serialize (incl. key/scale), old presets
  without them still load. Acceptance: save→reload→compare exact for a
  chain containing all four; legacy preset load unaffected.
  Deps: node tasks landed (can land per-effect incrementally).

### Agent/MCP lane

- **MCP-1 — Agent operability + capabilities badge** *(small)* — status:
  `completed` (completed 2026-08-29: the 10-tool surface
  unchanged — no new tools. (1) Discrete string params are legal through
  every param-taking tool: checkSpecValue/validateSetParam accept a
  UI-1 `values` param's legal strings AND preset-schema's raw 0..N enum
  form (illegal values → the standard INVALID_ARGUMENTS problem with the
  allowed list inline — PRE-1's documented numeric-only gap closed);
  effectiveParamsFor keeps legal strings so diffs disclose key 'C'→'A'
  correctly; the policy layer membership-checks discrete params
  (defense on the load_preset path); the issue-#5 param-only fast path
  rides string set_param writes through the human select-commit
  primitives. (2) Experimental badge in the get_capabilities readout —
  ONE source of truth: the type's own registration
  (`experimental: true` on NodeTypes.register, set in node-autotune.js;
  new NodeTypes.isExperimental() reads it; canvas.js's badge surfaces
  consult the same lookup with its map demoted to a pre-API fallback;
  mcp-tools keeps only a bare-harness snapshot mirror). Readout carries
  per-type `experimental` + note (autotune only) and the summary names
  it. (3) The four cycle-3 types publish real param contracts in the
  readout (snapshot registry + TYPE_INFO + agent policies = nominal
  ranges / value lists, replacing the registry-drift placeholder).
  Evidence: 85-check tests/test-mcp-tools-cycle3.js driving the REAL
  mutation pipeline with all ten node files — set_chain/add_node/set_param
  for all four effects incl. key 'A'/'F#'/'D#' + scale 'Minor'/'Major'
  strings verified into model AND worklet enums, raw-enum forms
  round-trip, 10 illegal-value cases rejected cleanly with nothing
  applied + no undo, badge in both live-registry and bare-harness
  readouts; full suite 22/22 / 1477 checks green.)
  Verify add/update of all four via existing 8-tool surface; capabilities
  readout marks autotune experimental. Acceptance: agent script adds+tunes
  each effect; readout shows badge. Deps: UI-2, PRE-1.

### QA lane

- **QA-1 — Per-effect acceptance runs** *(medium)* — status: `completed`
  (user-PASSED 2026-08-29: gate clean onsets/tails; distortion both approved
  as-is; chorus enthusiastically approved; autotune liked with slight A/B lag
  recorded as the accepted 20 ms declared delay. Objective pass complete 2026-08-29: offline harness `tests/qa-out/run-qa1.js`
  renders 12 listening WAVs + runs the earless checks through the REAL node
  code — buildGraph-routed composites, real worklets. Bypass-clean: chain
  bypass bit-exact vs source; gate Floor=0 bit-exact mod 5 ms look-ahead;
  autotune Mix=0 bit-exact mod 20 ms; chorus Mix=0 bit-exact; distortion has
  no bit-exact neutral by design (Drive=0 = −37.9 dB delta; clean path is
  Bypass). Reactivity 14/14 params. Dropout proxies match AT-0 (autotune 0/1469
  windows < −20 dB, flux 1.06). No render >0 dBFS; distortion unity guard
  exactly 1.0 at max, destination −4.2 dBFS at max drive. Agent-operability +
  preset round-trip cited from MCP-1/PRE-1 tests; suite 22/22 / 1477 green.
  **The user's listening verdict on tests/qa-out/LISTENING.md completes this
  acceptance — audio quality is user-judged, not yet given.**)
  For each effect on TEST-1: audible / param-reactive / bypass-clean /
  artifact-free / keyboard + agent operable / preset round-trip. User judges
  audio quality (same user-judged bar as cycle 2 QA-3).
  Deps: all node tasks, MCP-1.

- **QA-2 — Regression: existing six effects + safety net** *(medium)* — status:
  `completed` (complete 2026-08-29. (1) Legacy six unchanged: full
  suite green INCLUDING the new committed 107-check
  `tests/test-regression-cycle3.js` (registry shape with legacy-only load;
  legacy param rows still sliders with numeric parseFloat commits through
  the real applyParam/AudioParamRamp conversions; preset-schema lenience
  still scoped — hostile legacy presets load verbatim, same abuse on a
  declared type rejects; DEFAULT_PRESET still the committed six-node chain;
  legacy `--family-*` tokens byte-identical to cycle-2), plus the offline
  render harness `tests/qa-out/run-qa2.js`: the shipped six-node chain AND
  a corner-params variant render BIT-IDENTICAL with all ten modules loaded
  vs only the six legacy modules (sensitivity-guarded) — report
  `tests/qa-out/qa2-report.txt`. (2) Safety net: existing
  watchdog/limiter tests green in-suite, and the harness runs the REAL
  MeterTaps watchdog over chains containing all four new nodes — valid
  ten-node program does not trip (3 s, OUT tap on the attenuator verified);
  limiter-less hot all-four chain trips + latches (post-trip render exact
  silence); rebuild-while-latched schedules no upward chain-gate ramp and
  un-ducks to the mute level; latch holds through quiet program; only the
  human Restore button reopens; restored chain does not re-trip. Agent
  terminal-limiter refusals over an all-four chain verified in
  test-regression-cycle3.js part D. (3) Bypass: QA-1's bit-exact
  four-new-chain result cited (qa1-report.txt A.bypass_chain) and extended
  to an ALL-TEN chain — bit-exact vs raw source. Suite 23/23 files / 1584
  checks green; harness ALL CHECKS PASS, exit 0. No regressions found.)
  Gain/EQ/comp/limiter/delay/reverb unchanged; watchdog + limiter behavior
  intact with new nodes in chain; bypass still bypasses a chain containing
  all four. Deps: QA-1.

### Docs lane

- **DOC-1 — README/DESIGN refresh** *(small)* — status: `completed`
  (completed 2026-08-29: (1) README operator section "The four newer
  effects — what they're for" — per-effect plain-language what-it-does /
  params / when-to-reach-for-it (gate for noisy rooms between singers,
  distortion incl. the no-clean-zero → Bypass honesty note, chorus
  stereo-best/mono-safe, autotune with the Experimental badge AND the
  accepted 20 ms declared delay explained as expected behavior), plus the
  demo pointer on the TEST-1 asset (CC0, source credited in
  THIRD_PARTY_NOTICES.md) with the reproducible path
  `node tests/qa-out/run-qa1.js` → tests/qa-out/LISTENING.md; intro
  effect list, operator effects list, sliders claim (now selects for
  Key/Scale), and the Verification coverage line all updated. (2) DESIGN.md
  modest extension in the cycle-2 fold-in style — no redesign: the four
  family tokens added to the frontmatter, "Six family edges" → "Ten"
  (Distortion #C0CE97 / Chorus #9E9ED1 / Noise Gate #9AD5B2 /
  Autotune #D19ED1 per rq5's rules), the experimental-badge treatment
  documented under Cards, the discrete param select under Inputs/Fields,
  and the faders bullet scoped to continuous params. (3) Stale claims
  fixed: PRODUCT.md 6→10 node types, per-node sliders → sliders + selects,
  8→10 tools (with the cycle-3 string-param/badge note);
  docs/ACCEPTANCE.md eight→ten tools (registration table, §4 title and
  tool list, plus new get_preset/load_preset and string-param walk
  lines), six→ten node handlers, the slider-drag line gains the select
  step, and §2 points the four cycle-3 effects at LISTENING.md. Docs
  only — no src/, styles, or preset data touched.)
  New effects in operator docs; autotune experimental note; demo pointer
  using TEST-1. Deps: QA-1.

## Dependency-ordered task index

| Order | Task | Deps | Size |
|---|---|---|---|
| 1 | TEST-1 | — | small |
| 2 | UI-1 | — | medium |
| 3 | DIST-1 | TEST-1, RQ-3 | medium |
| 4 | CHOR-1 | TEST-1, RQ-4 | medium |
| 5 | GATE-1 | TEST-1, RQ-1 | medium |
| 6 | AT-0 | TEST-1, RQ-2 | medium |
| 7 | AT-1 | AT-0, UI-1 | large |
| 8 | UI-2 (per-effect) | node tasks | small |
| 9 | PRE-1 (per-effect) | node tasks | medium |
| 10 | MCP-1 | UI-2, PRE-1 | small |
| 11 | QA-1 | all above | medium |
| 12 | QA-2 | QA-1 | medium |
| 13 | DOC-1 | QA-1 | small |

## Milestones

- **M1 — First effect end-to-end**: TEST-1 + UI-1 + DIST-1 (+UI-2/PRE-1 for
  distortion) demoable. Exposes mistaken assumptions about param style,
  worklet harness, and test-vocal workflow early.
- **M2 — Gate + chorus landed**: three of four first-class effects live.
- **M3 — Autotune verdict lands**: AT-0 outcome recorded; AT-1 in the
  chosen branch; experimental badge visible.
- **M4 — Closeout**: MCP-1, QA-1, QA-2, DOC-1; cycle acceptance.

## Handoff

- **Build order**: as the index; DIST first (simplest DSP) to prove the
  pattern, autotune spike runs parallel so its verdict doesn't gate the
  easy wins.
- **Fixed by scope**: listed above.
- **Delegated to deep-research**: RQ-1..RQ-4 (RQ-1/RQ-2 blocking).
- **Return-to-town-hall assumptions**: if RQ-2 fails *and* the slow-
  correction fallback also proves infeasible (both branches die), autotune
  scope reopens; if the test-vocal sourcing can't be done license-clean
  (OQ-6), the acceptance bar changes and returns to town-hall.
- **Approval needed before research begins**: approval of this plan (or
  targeted changes), then RQ-1..RQ-4 go to deep-research-swarm.
