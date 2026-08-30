# Cycle 3 Production Log

Evidence trail for cycle-3 production (cycle-1/2 logs archived under
cycle-1/, cycle-2/). Task statuses live in plan.md; approval cursor in
state.md.

---

## TEST-1 — Fixed test vocal asset — `awaiting-approval`

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (TEST-1).

**Changed files**
- `assets/test-vocal.mp3` — NEW, 409 KB (0.4 MB): 23.7 s, 44.1 kHz stereo
  MP3, real sung female vocal ("All in the name of love" melody, 80 bpm,
  amateur home recording — naturally imperfect pitch, which makes the
  autotune acceptance bar meaningful).
- `THIRD_PARTY_NOTICES.md` — new "Test vocal (CC0 1.0)" section.
- `docs/ultron/plan.md` — TEST-1 status → `awaiting-approval`.
- `docs/ultron/state.md` — active-task line updated.

**Validation evidence**
- License verified on the sound page itself: CC0 1.0, no attribution
  obligation (https://freesound.org/people/Ehved/sounds/566926/). Duration
  23.7 s confirmed on page; original WAV is login-gated, so the public HQ
  MP3 preview (direct URL, `cdn.freesound.org/previews/566/566926_12708796-hq.mp3`)
  was bundled — the same substitution precedent as the cycle-1 reverb IR
  (`assets/ir/plate-vocal.mp3`, see AE-9).
- Codec sanity: `file` reports MPEG layer III, 128 kbps, 44.1 kHz,
  JntStereo; `afconvert` decodes it cleanly to 2-ch 16-bit PCM
  (23.72 s); PCM RMS scan confirms real, non-silent sung content
  throughout (peak chunk RMS ≈ 1.0e8 on a 16-bit scale).
- Chain-input compatibility: the app's own asset-loading path is exactly
  this pattern — `src/node-reverb.js` fetches `assets/ir/plate-vocal.mp3`
  and decodes it with `AudioContext.decodeAudioData()` (see its module
  doc-block, lines 58–124); MP3 `decodeAudioData` is proven working in-app
  in Chrome by the shipping reverb node. `src/audio-engine.js` takes mic
  input via `getUserMedia` (no file-input UI by design), so the file is
  consumed by fetch + `decodeAudioData` (reverb-IR pattern) and/or played
  through the mic path during acceptance runs. Browser-use verification
  was not available in this subagent (tool unavailable); decode evidence
  is CoreAudio (`afconvert`/`afinfo`) + the in-app MP3-decode precedent.
- Size: 0.4 MB, well under the 10 MB budget.

**License**: CC0 1.0 (public domain) — recorded in THIRD_PARTY_NOTICES.md.

**Deviations**: none from the task entry. One interpretation: TEST-1 said
"royalty-free or self-recorded" — external CC0 sourced per the worker
contract's priority (a); self-recorded/synthetic was disallowed.

---

## UI-1 — Discrete key/scale param control

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (UI-1, cycle 3).

**Changed files**
- `src/param-controls.js` — new discrete param-control type: a paramSpec
  entry carrying `values: [...]` renders a native `<select class="param-select">`
  (one `<option>` per value) instead of a range slider, commits its STRING
  value through the exact slider pipeline (AudioGraph.updateNodeParams +
  NodeTypes.applyParam, no buildGraph), `formatValue` renders unit-less
  string values verbatim, and `updateControl` (issue #5 agent fast-path
  bridge) moves selects in place alongside sliders.
- `styles/main.css` — `.param-select` styled to the industrial label
  system: mono `--font-readout` value register, silkscreen `.param-label`
  pairing unchanged, hairline/line-strong bezel on `--bg-panel` face,
  `--focus-ring` focus outline. Appearance-only; native select semantics
  untouched.
- `tests/test-discrete-param-controls.js` — NEW, 23 checks (auto-picked-up
  by tests/run.js).

**Design decisions**
- Param shape: two FLAT params — `{id:'key', label:'Key', values:[C..B],
  default:'C'}` and `{id:'scale', label:'Scale', values:[Chromatic, Major,
  Minor], default:'Chromatic'}` — matching the existing flat-param
  convention; applyParam receives (nodeInstance, 'key', 'A') strings.
- Native `<select>` chosen over button-group + roving tabindex: the
  codebase's a11y pattern prefers native form controls (native
  `input type=range`, `title`, `aria-describedby` — no custom widget
  frameworks). Arrow keys, typeahead, and screen-reader value
  announcement on change are native select semantics.
- No autotune node built (per contract); validated against a throwaway
  `test-keys` type, UI-4's throwaway-type precedent.

**Validation evidence**
- `node tests/run.js discrete-param`: 23/23 ok — render (12 key options,
  3 scale options, label[for] binding, numeric sibling unregressed),
  commit (keyboard-style select change reaches NodeTypes.applyParam with
  string 'A'/'Major' + live node instance; model updated; onParamsChanged
  fired), external write (updateControl moves the select; later human
  slider move does not revert it).
- Full suite: **15/15 files, 811 checks, all green** — no regressions.
- Browser-use inspection unavailable in this worker (TEST-1 precedent);
  rendered inspection is via the real renderer's DOM construction in the
  vm harness + code review against the a11y pattern (D-section checks:
  native select element, option text = announced value verbatim,
  label[for] accessible name).

**Deviations**: none from the task entry.

---

## DIST-1 — Distortion node

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (DIST-1, cycle 3).

**Changed files**
- `src/node-distortion.js` — NEW: distortion node per D3
  (research/rq3-distortion-curves.md). Composite factory
  `{input, output, driveGain, shaper, toneFilter, outGain}` on the existing
  `AudioGraph.registerNodeType` / `NodeTypes.register` contract (no changes
  to audio-graph.js or node-types.js — the AE-7 composite shape EQ/Delay
  already use). Signal chain: driveGain (Drive pre-gain, 0→1 maps linear
  gain 1.0→10, i.e. up to +20 dB) → WaveShaperNode with a FIXED normalized
  tanh soft-clip curve `tanh(1.5x)/tanh(1.5)` over N=2047 (odd length,
  symmetric/DC-free, f(1)=1) and `oversample='4x'` → BiquadFilter lowpass
  (Tone 0→1 maps exponentially 1.5 kHz→12 kHz) → outGain (Output dB,
  unity-capped). Live writes all via AudioParamRamp.schedule() (Issue #5).
  Drive never touches the curve (no curve regeneration / re-set hazards —
  D3's explicit tradeoff resolution).
- `index.html` — one new `<script src="src/node-distortion.js">` tag after
  node-limiter.js. Palette chip appears automatically via
  NodeTypes.getAllTypes() (canvas.js) — no other file changed.
- `tests/test-distortion-node.js` — NEW, 38 checks (auto-picked-up by
  tests/run.js).

**Output guard**
`outGain.gain = min(10^(dB/20), 1.0)`, enforced in the factory AND in
applyParam — the stage can never boost past unity on ANY write path (UI,
agent set_param, or hand-edited preset; verified with out-of-spec +6/+12 dB
inputs). Because the curve is normalized to ±1, the shaper's worst-case
peak is 1.0 regardless of drive, so Output-at-max cannot slam the chain.
The downstream limiter and host attenuator are untouched.

**Validation evidence**
- `node tests/test-distortion-node.js`: 38/38 ok — registration + labels +
  defaults; curve construction (length 2047, exact-zero center, odd
  symmetry max-asymmetry 0, f(±1)=±1, monotonic, points match
  tanh formula); oversample '4x'; topology (drive→shaper→tone→outGain, no
  bypass path); param mappings (drive 0/1, tone endpoints 1.5k/12k, output
  dB→linear); guard ceiling at and beyond unity; PresetSchema
  serialize/deserialize round-trip incl. deep-copy isolation.
- Full suite: **16/16 files, 849 checks, all green** — no regressions
  (was 15/15 / 811 before this task).
- Audio-quality acceptance (audible / param-reactive / bypass-clean /
  artifact-free on assets/test-vocal.mp3) is USER-judged in QA-1 —
  not automatable in the Node harness; the node-level slice above is what
  automation can honestly cover.

**Deviations**: none from the task entry or D3.

## CHOR-1 — Chorus node

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (CHOR-1, cycle 3).

**Changed files**
- `src/node-chorus.js` — NEW: chorus node per D4
  (research/rq4-chorus-topology.md). Composite factory
  `{input, output, inputGain, delayL, delayR, lfo, depthGainL, depthGainR,
  panL, panR, wetSum, dryGain, wetGain, outputSum}` on the existing
  `AudioGraph.registerNodeType` / `NodeTypes.register` contract (no changes
  to audio-graph.js, node-types.js, or any bus/channel code). Topology:
  inputGain fans to dryGain and to two DelayNode voices (createDelay(0.06),
  baseline delayTime 25 ms written once at construction, never
  param-driven); each voice → its StereoPannerNode (pan −1 / +1) → wetSum
  → wetGain; dry/wet are the equal-power cos/sin(m·π/2) pair exactly as
  node-delay.js's Mix law. One sine OscillatorNode (started at
  construction) feeds BOTH voices through depth GainNodes whose gains are
  ±depthMs/1000 — the sign flip gives exact 180° LFO phase opposition,
  which anti-correlates the two delay trajectories (near-constant energy
  under mono summing, D4's core rationale) while the default stereo bus
  gets real width from the hard-panned voices. Params per D4 paramSpec:
  Depth 0–10 ms (default 3, step 0.5), Rate 0.1–8 Hz (default 1.5,
  step 0.1), Mix 0–100 % (default 30, step 1). Live writes all via
  AudioParamRamp.schedule() (Issue #5); Depth ramps BOTH sign-flipped
  feeds in one update. Never-reach-zero rule holds with margin
  (min delay = 25−10 = 15 ms) and Depth is defensively clamped to 0–10 on
  every write path; Mix is clamped 0–100 the same way. 12 native nodes,
  0 worklets, no feedback loop (ping-pong rejected by D4).
- `index.html` — one new `<script src="src/node-chorus.js">` tag after
  node-distortion.js. Palette chip appears automatically via
  NodeTypes.getAllTypes() (canvas.js) — no other file changed.
- `tests/test-chorus-node.js` — NEW, 45 checks (auto-picked-up by
  tests/run.js).

**Validation evidence**
- `node tests/test-chorus-node.js`: 45/45 ok — registration + labels +
  D4 paramSpec ranges/defaults; 12-node census; baseline 25 ms both
  delays; LFO sine + started-at-construction; phase opposition
  (depthGainR ≡ −depthGainL at defaults, at max Depth, at Depth 0, and
  under an out-of-spec Depth 99 clamp); LFO → both depth gains → both
  a-rate delayTime params; hard pan ±1; full topology edge checks
  (incl. no un-panned wet tap, no cross-voice feedback); Rate →
  lfo.frequency endpoints; equal-power Mix law (0/50/100 endpoints,
  out-of-spec 200 clamp); PresetSchema round-trip incl. deep-copy
  isolation; explicit-params construction.
- Full suite: **17/17 files, 894 checks, all green** — no regressions
  (was 16/16 / 849 before this task).
- Audio-quality acceptance (audible / param-reactive / bypass-clean /
  artifact-free on assets/test-vocal.mp3) is USER-judged in QA-1 —
  not automatable in the Node harness; the node-level slice above is what
  automation can honestly cover.

**Deviations**: none from the task entry or D4 (topology, node count,
param ranges, and graph sketch followed as written).

---

## GATE-1 — Noise Gate node

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (GATE-1, cycle 3).

**Changed files**
- `src/gate-worklet.js` — NEW: the AudioWorklet processor per D1
  (research/rq1-noise-gate.md), the Option-A pure-worklet gate. Per-block
  RMS detector on channel 0 → one-pole envelope (near-instant ~1 ms rise,
  15 ms fall — decision stabilization only, never audible shaping) →
  hysteresis state machine → per-sample dB-linear gain ramp between Floor
  and 0 dB, applied to a per-channel 5 ms look-ahead ring delay. Internal
  constants exactly per D1, named with rationale at the top of the file:
  HYSTERESIS_DB 6 (close = threshold − 6 dB; the band between holds state —
  no chatter), HOLD_S 0.05 (countdown runs only below the close threshold,
  then release may start), LOOKAHEAD_S 0.005 (decision leads the audio so
  the default 5 ms Attack ramp completes the sample before a transient
  emerges). Threshold/Attack/Release/Floor are REAL AudioParams
  (parameterDescriptors, all k-rate, ranges/defaults = the D1 paramSpec).
  Passthrough aid: at Floor = 0 dB the gain is 1.0 in every state and
  x·1.0 is bit-exact — the only processing left is the fixed 5 ms delay.
  Not a `<script>` — fetched via addModule, the watchdog-worklet.js
  convention.
- `src/node-gate.js` — NEW: registration shim on the existing
  `AudioGraph.registerNodeType` / `NodeTypes.register` contract (no changes
  to audio-graph.js, node-types.js, param-controls.js, or audio-bypass.js).
  Factory returns the AE-7 composite `{input, output, worklet,
  pendingParams}` (unity GainNode connect points). The async addModule vs
  sync-factory wrinkle uses node-reverb.js's pattern adapted: per-context
  load cache (one addModule call), unity placeholder passthrough on the
  first-ever gate until the module resolves, then the worklet is spliced
  between the stable connect points (external edges untouched); every
  later gate is fully synchronous. addModule failure = one console
  diagnostic + honest unity passthrough (loud, not dead). applyParam is
  four `AudioParamRamp.schedule(worklet.parameters.get(id), value)` calls
  (Issue #5 click-safe form); writes during the passthrough window are
  recorded as pendingParams and applied at insertion.
- `index.html` — one new `<script src="src/node-gate.js">` tag after
  node-chorus.js (gate-worklet.js deliberately NOT a script tag). Palette
  chip appears automatically via NodeTypes.getAllTypes() (canvas.js).
- `tests/test-gate-node.js` — NEW, 75 checks (auto-picked-up by
  tests/run.js).

**Validation evidence**
- `node tests/test-gate-node.js`: 75/75 ok —
  registration/labels/paramSpec per D1; worklet wiring (page-relative
  addModule URL once per context, recreated-context re-add, deferred
  placeholder→splice with pending params, addModule-failure passthrough +
  one diagnostic, context-property constructor fallback); real-AudioParam
  applyParam for all four params + unknown-id no-op + explicit
  construction params; PresetSchema round-trip incl. deep-copy isolation
  and default-params entries. The REAL processor driven in a stubbed
  AudioWorkletGlobalScope (testProcessor precedent): closed-at-Floor from
  sample 0; opens past threshold; dB-linear Attack ramp of exactly 5 ms
  (240 samples) with constant slope; look-ahead pinned to exactly 5 ms by
  impulse position AND the onset sample emerges at full gain (ramp beat it
  through the delay); hold keeps the gate fully open 30–40 ms into
  silence, release starts 55–85 ms after the last loud sample, release
  slope exactly 40 dB per Release-seconds, lands on Floor, never
  undershoots; re-trigger from Floor; 6 dB hysteresis band holds OPEN when
  open and CLOSED when closed across five phases (no chatter); Floor
  param honored at any in-range value; Floor 0 = bit-exact passthrough
  (=== against the 5 ms-delayed input); stereo gets identical per-sample
  gain with detection on channel 0; k-rate Threshold changes respected
  mid-stream; empty/absent input survives.
- Full suite: **18/18 files, 969 checks, all green** — no regressions
  (was 17/17 / 894 before this task).
- Audio-quality acceptance (opens on vocal onsets without clipping attack
  consonants, closes without chopping tails, bypass-clean, artifact-free
  on assets/test-vocal.mp3) is USER-judged in QA-1 — not automatable in
  the Node harness; the node-level slice above is what automation can
  honestly cover.

**Deviations**: none from the task entry or D1 (worklet topology, RMS
detector, real AudioParams, 6 dB hysteresis / 50 ms hold / 5 ms
look-ahead, param set and ranges followed as written). One D1-open choice
resolved as it anticipated: the factory's not-yet-loaded handling is the
reverb-style placeholder + splice (the simplest deterministic option that
never throws and never leaves the chain broken), not queue-or-throw.

---

## AT-0 — Autotune feasibility spike — `awaiting-approval`

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (AT-0, cycle 3).

**VERDICT: HARD-TUNE PASS** on the D2 pass bar, measured on TEST-1.
AT-1 builds the Outcome-PASS branch. Full record with method, numbers, and
the four measured design-failure lessons:
[research/at0-spike-result.md](research/at0-spike-result.md).

**Changed files** (all DISPOSABLE — nothing in `src/`, nothing in
`index.html`; `tests/run.js` auto-discovers only `tests/test-*.js` so the
spike is outside the committed gate):
- `tests/spike/at0-autotune-worklet.js` — NEW, the prototype: YIN (FFT
  autocorrelation, shrinking-window formulation, CMND, 0.15 threshold,
  parabolic refine; 5 ms cadence; median-of-3 + 2-of-3 voicing;
  clarity/RMS aperiodicity gate) + scale snap (Chromatic/Major/Minor × 12
  keys, ±6-semitone clamp, stability-gated first lock, ±0.52-semitone
  2-frame retarget) + per-output-epoch retune smoothing (0 ms hard ↔
  250 ms slow on one engine) + TD-PSOLA (peak-picked epoch markers, 2T
  Hann grains, nearest-marker duplication/skipping, window-sum-normalized
  OLA, ~3 ms wet/dry fade) with a DECLARED fixed 20 ms algorithmic delay
  (output content cursor starts at −D; covers the wet path to ~104 Hz).
  AudioWorklet-shaped (registerProcessor/class, k-rate params
  Key/Scale/Retune/Mix) so AT-1 transfers 1:1; spike-only `_dbg*`
  telemetry arrays documented as not-for-ship.
- `tests/spike/run-at0-spike.js` — NEW, offline harness: vm-stubbed
  AudioWorkletGlobalScope (test-gate-node.js precedent), per-block hrtime
  CPU, independent reference YIN oracle, and the D2 §7 measurement
  battery (A detection vs synthetic ground truth; B snap correctness incl.
  forbidden-note masking; C latency impulse/holdback; D AM/SNR artifact
  proxies; E TEST-1 residual/dropout/HF/flux/RMS-step metrics at retune 0
  and 250 ms; F CPU p50/p99 vs the 2.667 ms quantum).
- `tests/spike/.gitignore`, `tests/spike/out/*` (gitignored): ffmpeg-decoded
  PCM cache, listening WAVs (input, chromatic-0 ms, chromatic-250 ms,
  C-major-0 ms), frozen metric dump `at0-spike-report.txt` (113 metrics,
  zero WARN/FAIL).
- `docs/ultron/research/at0-spike-result.md` — NEW, the spike record.
- `docs/ultron/plan.md` — AT-0 → `awaiting-approval` with verdict; AT-1
  annotated with the selected branch; D2 outcome line updated.
- `docs/ultron/state.md` — active task + AT-0 record appended.

**Decisive numbers** (TEST-1 = 23.7 s CC0 vocal, f0 116–350 Hz, 52% voiced):
latency **exactly 20.0 ms** every path (impulse 14400→15360 bit-exact;
constant 960-sample hold-back; wet path starve-free at 113 Hz); p99 CPU
**0.337 ms = 12.6%** of quantum (vocal) / 9.2% (440 Hz max grain rate),
37.6 CPU-ms per audio-second; detection 0.0c median error, 0 octave errors
on 2700 synthetic decisions; snap residual on TEST-1 **median 2.5c, 90.9%
of voiced frames < 10c** (C-major 2.4c; chromatic+major+minor masking
cases 0.9–4.7c); artifacts: AM depth 0.0 dB, worst-window SNR at the input
tone's own harmonic floor, 0/1469 windows below −20 dB, HF ratio 0.97,
flux ratio 1.07, starved samples 0.11%; mix=0 bit-exact dry (D-delayed);
slow-correction variant equal-or-better on every artifact metric.

**Method notes / documented substitution**: the repo has no JS MP3
decoder, so TEST-1 was decoded with ffmpeg (mono 48 kHz f32le) — the
browser app's own path is `AudioContext.decodeAudioData()` (reverb-IR
precedent), unavailable offline. Audibility is NOT claimed by the agent:
objective proxies pass; the four listening WAVs are provided and QA-1's
user-judged bar stands. "Lost voiced frames" (38% of input-voiced frames
drop below the oracle's 0.7 clarity gate on the output) was investigated:
median clarity 0.687 just under the gate, 83% of them audible — a ~0.08
clarity cost of re-splicing on breathy segments, not dropouts.

**Deviations**: none from the task entry (disposable, offline via existing
harness patterns, verdict + records delivered). Interpretations: (a) the
spike measures objective proxies + writes listening artifacts since the
agent cannot audition; (b) D2's bar "≤ 20 ms for f0 ≥ 110 Hz" is met at
exactly 20.0 ms — the prototype sizes D for ~104 Hz support, and the
record documents the D-vs-range trade for AT-1.

---

## AT-1 — Autotune engine node — `awaiting-approval`

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (AT-1, cycle 3).

Outcome-PASS branch of AT-0's HARD-TUNE verdict: the spike engine ported
to production, registered on the existing contract, experimental badge on
the node card. Hard-tune is the default; slow correction is the same
engine with Retune opened up (0–500 ms) — D2's two-outcome shape, no
branch in the code.

**Changed files**
- `src/autotune-worklet.js` — NEW: the engine, a 1:1 port of the measured
  spike prototype (tests/spike/at0-autotune-worklet.js) with three
  production changes: (1) NO `_dbg*` telemetry (AT-0 §5 barred it);
  (2) ALLOCATION-FREE per-block path — the spike's frame/marker object
  arrays (push/shift every 5 ms / every period) are preallocated scalar
  ring buffers, so the audio thread allocates nothing per block;
  (3) per-channel dry rings — mix = 0 is bit-exact per channel even on a
  stereo bus (the spike duplicated channel 0). Algorithm unchanged:
  FFT-autocorrelation YIN (shrinking-window formulation, CMND, 0.15
  threshold, parabolic refine, 5 ms cadence, median-of-3 + 2-of-3 voicing,
  clarity/RMS aperiodicity gate) → scale snap (Chromatic/Major/Minor × 12
  keys, ±6 st clamp, stability-gated first lock, ±0.52 st 2-frame
  retarget, mid-note key/scale resnap) → per-output-epoch retune smoothing
  → TD-PSOLA (peak-picked markers, 2T Hann grains, nearest-marker
  duplication/skipping, window-sum-normalized OLA, ~3 ms wet/dry fade),
  declared FIXED 20 ms algorithmic delay (output content cursor starts at
  −D; wet path feasible to ~104 Hz). The four AT-0 §4 lessons are
  structural in the code and each has a dedicated regression test.
  Real k-rate AudioParams: key 0–11 / scale 0–2 / retune 0–500 ms /
  mix 0–1, with param-read re-clamps.
- `src/node-autotune.js` — NEW: registration shim on the gate's exact
  pattern — `AudioGraph.registerNodeType('autotune')` returns the
  {input, output, worklet, pendingParams} composite with the reverb/gate
  async addModule placeholder+splice (one addModule per context, unity
  passthrough until it resolves, honest passthrough + one console
  diagnostic on failure); `NodeTypes.register('autotune')` carries
  label/paramSpec/applyParam. Key/Scale are UI-1's discrete string selects
  (`values: ['C'..'B'] / ['Chromatic','Major','Minor']`) — this file owns
  the string→enum mapping at every boundary (factory construction,
  applyParam, pendingParams stored enum-mapped), accepts raw numeric
  enums too, and falls back to defaults on unknown strings without
  throwing. Retune Speed 0–500 ms default 0 (hard-tune); Mix 0–100 %
  default 100 (house convention; mapped to the worklet's 0–1). Live
  writes via AudioParamRamp.schedule() (Issue #5 click-safe).
- `index.html` — node-autotune.js script tag (worklet fetched via
  addModule, gate convention; commented).
- `src/canvas.js` + `styles/main.css` — MINIMAL experimental badge on the
  autotune NODE CARD (scope: "experimental badge on autotune only"):
  `EXPERIMENTAL_TYPES` lookup + `isExperimentalType()` hook in
  createNodeCard, amber `.node-experimental-badge` tag after the module
  label (title carries the why). Kept deliberately minimal — the formal
  badge component (palette chip, readouts, capabilities surface) is
  UI-2's, which can consume this lookup as its data source.
- `tests/test-autotune-node.js` — NEW: 100 checks. Part 1 node sandbox
  (registration, discrete paramSpec, string→enum mapping incl. pending
  params during the addModule window, failure/ctor variants, PresetSchema
  round-trip incl. key/scale strings). Part 2 drives the REAL worklet in
  a stubbed AudioWorkletGlobalScope, judged by an INDEPENDENT offline YIN
  oracle (the spike harness's, verbatim — the production node has no
  telemetry by design): 15-case snap/shift exactness (≤6.5c worst median,
  incl. forbidden-note masking and the 113 Hz range floor); the four AT-0
  lessons (impulse bit-exact at +960 early AND late = stall/race-free
  constant D; 3 s sustained shift across 17+ ring wraps = AM 0.0 dB, SNR
  at the input's own harmonic floor, no dropouts, no NaN; biased-onset
  correct lock at 239 Hz; ±40c vibrato never retargets while real note
  changes do); param changes mid-stream (key, scale, retune, mix);
  mix=0 bit-exact dry mono AND stereo; CPU re-measured. Part 3 (optional,
  machine-local, skips on a clean clone): an 8 s TEST-1 slice through the
  PRODUCTION engine vs the gitignored ffmpeg cache.
- `docs/ultron/plan.md` — AT-1 → `awaiting-approval`.
- `docs/ultron/state.md` — active task + AT-1 record appended.

**Decisive numbers** — production engine vs spike prototype:
latency **exactly 20.0 ms** (impulse 14400→15360 bit-exact, early and
after 1.5 s of sustained voiced audio — the L2 constant); synthetic snap
residuals worst median 6.5c / p95 7.0c over 15 targets (spike 0.1–4.7c —
same class); TEST-1 slice (8 s, 554 voiced frames, hard-tune chromatic):
snap residual **median 2.3c / p95 14.8c / 91.2% within 10c**, lost-voiced
135/554 (spike full-track 2.5c / 14.8c / 90.9% — reproduced); dropouts
**0/563 windows below −20 dB** (worst dip −1.7 dB); HF click ratio
**0.972** (spike 0.974); AM depth **0.0 dB** under sustained shift; CPU
p99 **9.8%** of the 2.667 ms quantum on a vocal-like load / **8.5%** at
440 Hz max grain rate (spike 12.6% / 9.2% — the telemetry removal paid;
bar 25%). Full suite: **19/19 files, 1069 checks, all green** (was 18/18 /
969).

**Method notes**: same documented substitution as AT-0 where the real
vocal is exercised offline (ffmpeg-decoded cache; the browser app itself
decodes with decodeAudioData). The committed test is hermetic (synthetic
signals only); Part 3 runs only where the cache exists and quotes its
skip honestly. Audibility is NOT claimed by the agent: objective proxies
match the spike's, and the artifact review on assets/test-vocal.mp3
remains QA-1's user-judged bar (the spike's listening WAVs still stand as
reference material for the prototype; QA-1 should audition the production
node in the app).

**Deviations**: none from the task entry (production node on the existing
contract, params per approved scope, hard-tune default + retune-opened
slow path on one engine, minimal badge with UI-2 handoff noted, AT-0
lessons ported and regress-tested, preset round-trip incl. strings, CPU
re-measured). Scope kept to AT-1: palette labels and the formal badge
component are untouched (UI-2); preset schema/factory presets untouched
(PRE-1 — PresetSchema already round-trips arbitrary param objects, and
the test proves the autotune entry survives save→reload→compare exact).

---

## UI-2 — Palette/card integration, all four effects

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (UI-2, cycle 3).

**Changed files**
- `src/canvas.js` —
  (a) `FAMILY_INITIALS`: deliberate silkscreen mappings for the four new
  types, following the existing label-initials convention (each value is
  the display label's initials, so the gate reads **NG** for "Noise
  Gate", not the type-key fallback GA): distortion **DI**, chorus **CH**,
  gate **NG**, autotune **AU**.
  (b) The AT-1 minimal badge hook formalized into the real component:
  `createExperimentalBadge(type, compact)` — one factory, one data source
  (`EXPERIMENTAL_TYPES`, still autotune-only), two surfaces: the full
  "Experimental" tag after the module label in the card header (same
  slot AT-1 used), and a compact "EXP" tag on the palette chip
  (right-pinned via CSS). SR access is by CONTENT on both surfaces: the
  card badge's text sits in the header flow and is announced with the
  module name; the chip's accessible name carries the status pre-add —
  autotune's aria-label is now "Add Autotune to chain (experimental)"
  (the R2-2 action phrase + status suffix; the other nine chips keep the
  plain phrase). Title carries the why on both.
  No structural/audio changes: chips were already registry-driven
  (`NodeTypes.getAllTypes()`), so all four types appeared automatically;
  this pass makes their family/initials/status encoding deliberate.
- `styles/main.css` —
  (a) Four new family-edge tokens chosen to rq5's family rules (see
  numbers below): `--family-distortion #C0CE97` (mustard),
  `--family-chorus #9E9ED1` (periwinkle), `--family-gate #9AD5B2`
  (spring green), `--family-autotune #D19ED1` (orchid), plus the eight
  one-line `data-family` mappings (4 × `.node-chip`, 4 × `.node-card`)
  so chips and cards share one vocabulary as before.
  (b) `.node-experimental-badge` comment updated AT-1→UI-2 (formal
  component, both placements, SR-by-content rationale); new
  `.node-chip .node-experimental-badge` rule adds ONLY
  `margin-left: auto` — identical tag anatomy/typography on both
  surfaces by construction (one component, one look, placements cannot
  drift apart).
- `tests/test-palette-cards-cycle3.js` — NEW: 152 checks, the committed
  render-level evidence. Loads the REAL canvas.js + param-controls.js +
  node-types.js + ALL TEN node-*.js files (index.html script order) into
  a vm sandbox with a minimal DOM-honest element stub (move-semantics
  appendChild/insertBefore, concatenated textContent reads), and checks:
  A) registry/palette construction (10 chips, registration order =
  index.html order); B) per-new-type chip anatomy (real `<button>`,
  family/initials hooks, R2-2 aria-labels incl. the autotune status
  suffix, disabled pre-Start); C) chip badge presence ("EXP", autotune
  only); D) keyboard add per type (onEngineStarted enables chips; click
  → card built; one buildGraph/autosave/markModified/noteHumanEdit per
  add — the shared structural chokepoint); E) card anatomy (family edge
  hooks, aria-hidden grip, label, collapse/remove aria-labels,
  `.node-params-inner` wrap, one row per paramSpec at spec defaults,
  label[for] bindings, autotune Key/Scale as the UI-1 selects with
  12/3 options at C/Chromatic) + the inherited collapse toggle
  (`.collapsed` + `aria-expanded` both ways, per type); F) card badge
  (exactly one of the four cards, in the handle, after the label);
  G) loadModel restore of all four types (exact ids, badge follows type,
  selects restore saved A/Minor, autosave baseline) + the keyboard-add
  terminal-limiter placement policy.
- `docs/ultron/plan.md` — UI-2 → `awaiting-approval`.
- `docs/ultron/state.md` — active task + UI-2 record appended.

**Decisive numbers** — the four family colors, WCAG-computed against the
rq5 token grounds (same formula as rq5-palette.md; the shipped six
families compute ink 6.40–9.82, card 5.04–7.72 — the new four land inside
or above that band):

| token | hex | hsl | ink #241A08 | vs bg-card #322E29 | vs panel/body |
|---|---|---|---|---|---|
| distortion | #C0CE97 | 75°,36%,70% | 10.21 | 8.03 | 8.97 / 10.45 |
| chorus | #9E9ED1 | 240°,36%,72% | 6.74 | 5.30 | 5.92 / 6.90 |
| gate | #9AD5B2 | 144°,41%,72% | 10.22 | 8.04 | 8.98 / 10.46 |
| autotune | #D19ED1 | 300°,36%,72% | 7.77 | 6.11 | 6.82 / 7.95 |

Hue placement: the four sit at the centers of the widest gaps in the
existing family wheel (46/104/184/215/266/335°) — nearest existing family
≥25° away (chorus 25° from EQ, 26° from delay, vs the shipped set's own
tightest family pair at 31° and rq5's accepted 10° amber↔brass
adjacency), muted S36–41 against the blue/violet neighbors' S54–58, and
≥39° from both reserved hues (accent 36°, safety red 358°). Badge
contrast is unchanged from AT-1 (amber-on-card 6.65 per rq5).

Full suite: **20/20 files, 1221 checks, all green** (was 19/19 / 1069).

**Method notes**: browser-use inspection was attempted but the browser
tool is unavailable to subagents in this swarm (same honest note as
TEST-1/UI-1); the committed vm-DOM harness above is the render-level
evidence, and the visual result (badge placement/typography, family edge
colors on the rendered surface) is user-judged at QA-1 alongside the
audio bar, per the cycle's QA split. Keyboard-only add + collapse are
verified at the event/listener level (the button semantics that make
Enter/Space work are the checked structure), not via a real key event —
same structural-verification convention as R2-2's committed tests.

**Deviations**: none from the task entry. Two judgment calls inside its
letter: (1) the formal badge component renders on BOTH the autotune card
and the autotune palette chip — the card remains the badge's home per the
plan text ("experimental badge component on the autotune card"), and the
chip carries the compact twin AT-1's handoff note explicitly anticipated
("extend it to the palette chip"), with the aria-label suffix as the SR
channel; no other type gets either. (2) The gate's silkscreen initials
are NG (label-initials convention) rather than the GA the type-key
fallback would produce — documented in the lookup. MCP capabilities
readout badge is NOT touched here (that's MCP-1, which depends on this
task + PRE-1).

## PRE-1 — Preset schema + round-trip, all four cycle-3 effects

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (PRE-1, cycle 3).

**Changed files**
- `src/preset-schema.js` — PRE-1 core. (a) New `TYPE_PARAM_CONTRACTS`:
  hand-mirrored per-type param declarations for exactly the four cycle-3
  types (distortion drive/tone/output, chorus depthMs/rateHz/mix, gate
  threshold/attack/release/floor, autotune key/scale/retune/mix), same
  re-mirror discipline as NODE_REGISTRY_SNAPSHOT in src/mcp-tools.js;
  exported read-only for the test's drift check. Numeric contracts are
  finite-in-[min,max] with a 1e-9 EPS for UI slider float fuzz; the two
  autotune discrete contracts accept either the canonical UI-1 STRINGS
  ('C'..'B', 'Chromatic'/'Major'/'Minor') or the raw integer enums
  0..11 / 0..2 that src/node-autotune.js documents as equally legal at
  every boundary. (b) `deserialize()` gained a per-entry
  `validateEntryParams` pass: for a DECLARED type, every PRESENT param
  must be a declared name with a contract-conforming value — an unknown
  param (typo'd or foreign), a wrong JS type, an out-of-nominal-range
  number, or an illegal key/scale throws the same specific, debuggable
  error style as the structural checks (node index + param + legal set).
  Missing params/params:{} stay legal (defaults apply at build). Types
  WITHOUT a contract — the six legacy ones included — keep the original
  structure-only treatment verbatim, so pre-cycle-3 presets load
  byte-unchanged. serialize() deliberately unchanged (permissive: it
  persists whatever the live model holds; read-side validation +
  recovery is the gate). File-header philosophy comment updated to
  document the additive strictness and the store-layer registry guard.
- `src/persistence.js` — autosave recovery extended by one guard:
  `loadAutosavedModel()` now runs the restored nodes past the LIVE
  NodeTypes registry (`unregisteredNodeType`) before returning them, so a
  hand-edited autosave naming an unregistered type takes the EXISTING
  recovery (console.error + default-chain fallback) instead of throwing
  inside AudioGraph.buildGraph() mid-loadModel/mid-Start. Without the
  guard, deserialize()'s deliberate structural stance let such an entry
  through and Start crashed (verified by trace; now regression-tested).
  Guard degrades to lenient (today's behavior) when the registry is
  absent/empty/throwing — bare harnesses keep buildGraph's own
  unknown-type check as the backstop.
- `src/preset-store.js` — named-preset `load()` gained the same
  live-registry guard (per-file twin, kept on purpose — the two storage
  layers are independent modules): an unregistered type in stored content
  returns null (the panel's existing quiet "Could not load that preset"
  recovery) instead of crashing the Load click handler with the canvas
  half-cleared. Doc comments updated in both stores.
- `src/default-preset.js` — DECISION NOTE only, no data change: the
  default chain does NOT gain any cycle-3 effect. It is PX-3's committed
  first-run vocal sound and all four new effects are character effects
  (even the gate's attack/release shaping is audible on quiet passages);
  first-run sound stays exactly as shipped. Err-toward-no-sound-change
  instruction honored.
- `src/factory-presets.js` — DECISION NOTE only, no content change: no
  cycle-3 showcase preset yet. Reasons in force order: (1) provenance —
  every library entry is user-accepted material (PX-3 default; QA-3 five
  rated 5/5) and the four effects' user-judged acceptance run is QA-1,
  after MCP-1; (2) conformance — tests/test-factory-presets-policy.js
  drives every entry through the real set_chain, whose param validation
  (checkSpecValue in src/mcp-tools.js) currently accepts only finite
  numbers, so a preset carrying autotune's canonical string Key/Scale
  would be rejected by the library's own test — extending that to the
  discrete values-type params is MCP-1's explicit lane; (3) landing point
  — one-entry addition + policy-test update once MCP-1 + QA-1 are in.
- `tests/test-preset-cycle3.js` — NEW: 171 checks, the committed
  chain-level evidence (the four node suites already covered single-entry
  round-trips; this is the plan's formal pass). A) contract/registry
  drift check (ids, numeric ranges, enum vocabularies vs the LIVE
  paramSpecs of all four node files); B) exact save→reload→compare for a
  10-node chain containing ALL FOUR new effects with existing ones —
  every new-type param non-default — through three real layers (bare
  PresetSchema over the JSON wire, PresetStore save/load through
  localStorage, Persistence saveCurrentChain/loadInitialModel), plus the
  numeric-enum autotune form preserved verbatim and the wire-shape proof
  that collapsed-card state does not serialize (session-only by design,
  src/canvas.js VIS-7); C) every contract param at min AND max plus
  params:{} absent deserializes clean (12 keys + 3 scales individually);
  D) legacy pre-cycle-3 presets load byte-unchanged through all three
  layers, including out-of-nominal LEGACY-type params (structure-only
  treatment for undeclared types unchanged); E) 20 hostile-entry recovery
  cases (unknown type, key 'H', scale 'Dorian', enum 12/-1/1.5/3,
  out-of-range drive/output/retune/rateHz/attack/mix/floor, string-typed
  number, null, typo'd param names ×3) — each proven to deserialize-
  REJECT with a message naming node+param+value, autosave-recover to the
  exact DEFAULT chain with one console.error and no throw, and named-
  load-recover to null; F) the registry guard degrades to lenient with
  the registry absent/empty/throwing; G) default chain + six-entry
  factory library unchanged.
- `docs/ultron/plan.md` — PRE-1 → `awaiting-approval`.
- `docs/ultron/state.md` — active task + PRE-1 record appended.

**Decisive numbers** — full suite: **21/21 files, 1392 checks, all green**
(was 20/20 / 1221; +1 file, +171 checks). Hostile recovery: 20/20 cases
recover (autosave → exact default fallback; named → null), 0 throws.
Legacy: 3/3 layers byte-unchanged on the pre-cycle-3 default preset.

**Method notes**: serialize() kept permissive deliberately — the live
model can only hold contract-conformant new-type params (UI/agent write
paths clamp; loads validate), so a save-time gate would add a failure
mode (silently skipped autosaves) without a real vector; read-side
validation + the pre-existing fallbacks are the recovery seam. The
unknown-type check lives in the STORE layers against the LIVE registry
(no third mirrored type list; preset-schema stays registry-free per its
documented philosophy — the drift-checkable mirror there covers only
param contracts). MCP interactions verified by trace: mcp-tools'
validateChainObject already runs its own live-registry type check and
reuses deserialize() authoritatively, so the new param validation makes
set_chain STRICTER-consistent (an autotune key 'H' candidate now also
fails there); making set_chain ACCEPT the legal string forms is MCP-1's
task, not smuggled into this one.

**Deviations**: none from the task entry. Two judgment calls inside its
letter: (1) numeric key/scale enums are accepted alongside the canonical
strings — node-autotune.js documents both as legitimate at every
boundary, and rejecting a form the engine itself maps would be
gratuitous strictness; non-integer/out-of-range enums still reject.
(2) The default chain and factory library are intentionally UNCHANGED
(notes in both files) per the err-toward-no-sound-change instruction and
the library's user-accepted-content provenance — the showcase factory
preset is queued behind MCP-1 (param validation for discrete types) +
QA-1 (audio acceptance), both noted in factory-presets.js's header.

## MCP-1 — Agent operability + capabilities badge

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (MCP-1, cycle 3).

**Changed files**
- `src/mcp-tools.js` — MCP-1 core; the 10-tool surface itself UNCHANGED
  (no new tools, no renamed tools; plan's "existing 8-tool surface"
  wording predates issue #12's get_preset/load_preset — the surface is
  whatever ships, and nothing was added). Five additive changes:
  (a) DISCRETE PARAMS legal through every param-taking tool —
  `checkSpecValue` gained a `values`-spec branch (a legal string from
  the type's UI-1 value list, or preset-schema's equally-legal raw
  integer enum 0..values.length-1; anything else → the standard
  INVALID_ARGUMENTS problem with the `allowed` list inline, same style
  as unknown-param errors). This closes PRE-1's documented gap
  ("set_chain's numeric-only param validation would reject autotune's
  string Key/Scale"). `validateSetParam`'s value gate reworked from
  number/boolean-only to number/boolean/string with per-kind checking
  against the resolved node type's spec (discrete membership for
  key/scale; "is numeric" rejection for strings on numeric params);
  the old `requireNumberOrBoolean` helper retired. (b)
  `effectiveParamsFor` keeps a legal discrete STRING overlay (a key
  'C'→'A' change previously diffed as no-change since both read back as
  the default); `applyPolicyToNodes` + `planSetParam` membership-check
  discrete policies via the new `paramIllegalValueResult` (PARAM_OUT_OF
  _RANGE with `allowed.values`) — structural validation catches these
  first on set_chain/add_node/set_param; the re-check is the policy
  layer's defense on the one path that skips structural validation
  (load_preset applies store nodes directly). (c) The issue-#5
  param-only fast path (`paramOnlyChange`) accepts a single STRING
  param change — the human select-commit path pushes the same string
  through the same primitives (NodeTypes.applyParam maps it;
  ParamControls' row.apply sets the select), so string set_param rides
  the no-rebuild route like a number. (d) Capabilities readout: each
  type carries `experimental` (boolean) + `experimentalNote` when true
  (autotune only — badge + "verify by ear" guidance), the summary names
  autotune as experimental, and DISCRETE params publish
  `discrete:true`/`values`/`accepts`/`default` with
  `agent:{values, treatment:'reject'}` instead of a numeric range.
  (e) The four cycle-3 types publish REAL contracts everywhere the six
  legacy types do: NODE_REGISTRY_SNAPSHOT extended to all ten types
  (bare-harness fallback; live registry still wins), TYPE_INFO entries
  (labels + agent-facing descriptions), and AGENT_PARAM_POLICY entries
  (agent range == nominal range, treatment reject — rq3 does not govern
  these types: none adds linear gain above unity or a feedback loop;
  distortion Output is capped at 0 dB by the node itself and can only
  cut), replacing the misleading "registry drift" placeholder text.
- `src/node-types.js` — the EXPERIMENTAL badge's single source of truth
  moved into the registry itself: `register()` accepts optional
  `experimental: true` (stored per type), new export
  `NodeTypes.isExperimental(type)` (unregistered types honestly
  false). Rationale: canvas.js's badge surfaces and mcp-tools.js's
  agent readout are two consumers of one fact; the registration is the
  only place the fact lives once.
- `src/node-autotune.js` — declares `experimental: true` at its
  NodeTypes.register call (one line + comment; the status is data at
  the type, not a lookup entry in a second file).
- `src/canvas.js` — `isExperimentalType()` consults the live
  `NodeTypes.isExperimental()` first; the local EXPERIMENTAL_TYPES map
  is demoted to the guarded fallback for a registry predating the API
  (comment rewritten to name the registration as the source). Badge
  rendering (UI-2's two surfaces) unchanged.
- `src/factory-presets.js` — PRE-1's decision note updated: the
  conformance gate (reason 2) is RESOLVED by this task (set_chain now
  accepts the discrete strings/enums); the showcase preset stays queued
  on provenance alone (QA-1). No content change.
- `tests/test-mcp-tools-cycle3.js` — NEW: 85 checks, the agent-script
  acceptance path. Drives the REAL tool pipeline (validate → plan →
  apply through ChainCanvas.loadModel / the issue-#5 fast path) over
  the REAL ten-node-file registry with worklet stubs for gate/autotune
  and native-node stubs for distortion/chorus. A) capabilities readout:
  10 types; autotune badged + noted, the other nine explicitly not;
  key/scale discrete lists (12 + 3) with reject treatment; gate/
  distortion/chorus real agent ranges; registry is the badge source.
  B) set_chain with ALL FOUR effects incl. key 'A' / scale 'Minor'
  strings — applied, strings land verbatim in the model, worklet
  receives enums 9/2, gate/chorus/distortion physical instances
  verified (threshold on the gate worklet, LFO at 1.2 Hz started once,
  4x-oversampled shaper), get_chain round-trips the strings. C)
  set_param tunes each of the four — key 'F#' disclosed as 'A'→'F#'
  (string diff) and ramped to worklet enum 6, scale 'Major', retune 0,
  gate threshold, distortion drive, chorus rate (LFO ramp verified);
  exactly one undo entry per applied call. D) add_node for each of the
  four with initial params incl. key 'D#'/'Major', all upstream of the
  terminal limiter. E) 10 illegal-value cases (key 'H', scale 'Dorian',
  add_node key 'H', set_param key 'H'/enum 12/enum 1.5, string on
  numeric threshold, rateHz 99, output +3, object value) — each a
  structured rejection with the allowed set inline, model untouched,
  zero undo pushes. F) raw enums (key 9 via set_param; key 5/scale 1
  via set_chain) legal and preserved verbatim, worklet receives 5/1.
  G) bare harness (mcp-tools only): snapshot registry lists all ten
  types, badge + value lists hold via the fallback, add_node enum = 10.
- `docs/ultron/plan.md` — MCP-1 → `awaiting-approval`.
- `docs/ultron/state.md` — active task + MCP-1 record appended.

**Decisive numbers** — full suite: **22/22 files, 1477 checks, all
green** (was 21/21 / 1392; +1 file, +85 checks). Illegal-value
rejections: 10/10 structured + model-untouched + zero undo. Applied
mutations: 6 set_param (2 string) + 4 add_node + 3 set_chain, every
one disclosed with correct from/to (strings included).

**Method notes**: set_param's structural layer stays type-only by
design (the pre-existing MC-4 split — ranges are the apply-time policy
layer's), so out-of-nominal set_param numbers reject as PARAM_OUT_OF_RANGE at plan time, not INVALID_ARGUMENTS; the test documents both
codes. The experimental badge consumed mcp-tools' own live-wins/static-
fallback discipline rather than a new cross-module import: canvas.js
and mcp-tools.js each keep a guarded lookup with a mirrored fallback,
and both fallbacks plus node-autotune's registration are drift-checked
by test section A/G (live) and the palette-cards suite (badge
surfaces). Autotune's numeric policies carry "Experimental type." in
their descriptions so even the per-param readout says it.

**Deviations**: none from the task entry. Two judgment calls inside its
letter: (1) raw enum forms (key 9, scale 1) are accepted alongside the
canonical strings — preset-schema (PRE-1) documents both as equally
legal at every boundary, and node-autotune.js maps both; rejecting a
form the engine itself accepts would be gratuitous strictness.
(2) Treatment for the four types' numeric params is published as
'reject' (agent range == nominal range, so there is no clamp window —
out-of-range is already the structural/plan-time rejection), which
keeps the readout's stated treatment equal to the enforced behavior.

## QA-1 — Per-effect acceptance runs (objective slice) — `awaiting-approval`

**Status**: objective checks complete and passing; **audio quality is
user-judged and NOT yet given** — the listening protocol at
`tests/qa-out/LISTENING.md` (12 WAVs alongside it) is the acceptance
instrument. Same user-judged bar as cycle-2 QA-3.

**What was built** (all new files under `tests/qa-out/`, WAV/f32 gitignored
like the spike's):

- `run-qa1.js` — the offline acceptance harness. NOT a reimplementation:
  distortion/chorus run as the REAL `node-distortion.js`/`node-chorus.js`
  composites inside a vm sandbox whose AudioContext stub actually renders
  (spec-shaped Gain/WaveShaper(4x-oversampled)/Biquad/Delay(a-rate
  delayTime sampled per render quantum, fractional reads)/Oscillator/
  StereoPanner — the stub is the Web Audio runtime the way the vm-stubbed
  AudioWorkletGlobalScope is for worklets), chains built through the REAL
  `AudioGraph.buildGraph()` with chainGate + MC-4 attenuator routing.
  Gate/autotune run as the REAL `gate-worklet.js`/`autotune-worklet.js`
  through the REAL `node-gate.js`/`node-autotune.js` async addModule
  placeholder+splice path (stubbed addModule loads the real worklet file
  into its own vm scope; AudioWorkletNode drives process() per 128-sample
  block with k-rate params). TEST-1 decoded via ffmpeg (documented
  decodeAudioData substitution, spike precedent). Documented approximations:
  4x oversampling via linear-upsample + [1,3,3,1]/8 decimator; AudioParam
  ramps apply instantly (live-use click safety only).
- `qa1-report.txt` — committed metric dump (AT-0 report style).
- `LISTENING.md` — the user's per-effect protocol: files, settings, what to
  listen FOR, pass criteria phrased for human judgment, plus the objective
  summary. Verdict block at the bottom for the user.
- Listening set: `00-dry`, `01-gate-default`, `01b-gate-musical` (Thr −45/
  Rel 300 ms — this asset's gaps are true digital silence, so the shipped
  default is near-transparent by design and the musical demo needs a tuned
  threshold), `02-gate-extreme` (−30/1 ms/10 ms/−60), `03-dist-default`,
  `04-dist-extreme` (Drive 1/Tone 1/Output 0), `05-chorus-default`,
  `06-chorus-extreme` (10 ms/8 Hz/100 %, stereo), `07-at-default` (C
  chromatic 0 ms), `08-at-rightkey-major` (A# — measured natural key,
  median f0 232.7 Hz, histogram argmax), `09-at-wrongkey-major` (E, tritone
  off — the make-snapping-obvious demo), `10-at-slow-250ms`.

**Decisive numbers** (qa1-report.txt):

- Bypass-clean: chain-level `audio-bypass.js` engage with ALL FOUR effects
  in circuit = bit-exact vs the raw source. Gate Floor=0 bit-exact vs dry
  delayed by the declared 5 ms look-ahead; autotune Mix=0 bit-exact mod the
  declared 20 ms; chorus Mix=0 bit-exact. Distortion has NO bit-exact
  neutral by design (fixed tanh curve always in circuit, D3): Drive=0
  measures −37.9 dBFS delta; its operator-clean path is chain Bypass.
- Param reactivity: 14/14 params (gate×4, distortion×3, chorus×3,
  autotune×4). Total-diff plus worst-20 ms-window deltas so locally-acting
  params are judged fairly: gate attack 39 dB / floor 60 dB / threshold
  40 dB worst windows; autotune key/scale/retune ~−33 dBFS total diffs
  (1–1.5 dB windows — pitch params, not level params).
- Dropout/glitch proxies (AT-0's methods): autotune right-key — worst
  voiced dip −2.4 dB, 0/1469 windows < −20 dB, HF ratio 0.971, flux 1.064
  (AT-0 spike: −2.6 / 0 / 0.974 / 1.068). Gate default — onset-window delta
  0.0 dB median (attack consonants fully preserved), 0 windows < −20 dB,
  silence-gap residue −101.7 dBFS. Distortion — 0 windows < −20 dB, flux
  1.008. Chorus mono-sum worst dips −4.5 dB (default) / −8.4 dB (extreme)
  with genuine width (side/mid −9.4 dB / −0.1 dB).
- Clipping: 0 of 12 renders above 0 dBFS. Distortion unity guard exactly
  1.0 at Output max; destination −4.2 dBFS at max drive ("must not slam
  the chain" holds). Honest NOTE: post-tone-filter transient overshoot
  +1.8 dB at Drive/Tone max — Q=1 lowpass step ringing on near-square
  shaper output (spec biquad physics, same in Chrome), caught downstream
  by limiter + host ceiling; not a gain-cap defect.
- Snap accuracy (independent YIN oracle): right-key median residual
  2.3 c / 91.2 % within 10 c (node-test full-track: 2.3 c / 91.2 %);
  wrong-key histogram: 99.4 % of output-voiced frames on E-major degrees
  (input 61.6 % by chance) — the wrong-key file demonstrably snaps.
- Cited, not re-run: agent operability = tests/test-mcp-tools-cycle3.js
  (85 checks); preset round-trip = tests/test-preset-cycle3.js (171);
  palette/keyboard = tests/test-palette-cards-cycle3.js (152); node
  structure = the four node tests. Full suite at QA-1 time: 22/22 files,
  1477 checks, all green.

**Method notes**: two harness bugs found and fixed during the run, both in
the STUB (not production code): (1) disconnect() consulted the wrong edge
list so the worklet splice left a double path — every symptom (renders
louder than dry, failed bit-exacts) traced to it; (2) AudioParams were not
flagged as connect targets, killing the chorus LFO→delayTime feeds. One
measurement-honesty pass: reactivity judged by worst-window deltas, not
total diff, for locally-acting params; the gate silence metric reports
gap counts because this asset's gaps are true digital silence; the
distortion guard check separates the gain cap (verified = 1.0) from
post-filter ringing (measured, NOTE).

**Deviations**: none from the task entry. The 01b gate render is an
addition inside its letter ("musical default settings" — the factory
default is deliberately near-transparent on a digitally-silent-gap vocal,
per D1's open-point default, so a tuned musical setting was added for the
demonstration while 01 keeps the honest shipped-default render).

## QA-2 — Regression: existing six effects + safety net — `awaiting-approval`

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (QA-2).

**Changed files**
- `tests/test-regression-cycle3.js` — NEW: 107-check committed regression
  test for the shared-code leak surfaces (registry / param-controls /
  preset data / MCP string doors + terminal-limiter policy / palette CSS).
- `tests/qa-out/run-qa2.js` — NEW: offline render harness extending QA-1's
  machinery (compressor + convolver node kinds, real-block analysers) for
  the audio-identity, all-ten bypass, and watchdog/safety-net checks.
- `tests/qa-out/qa2-report.txt` — NEW: committed evidence report.
- `docs/ultron/plan.md` — QA-2 status → `awaiting-approval`.
- `docs/ultron/state.md` — active-task line updated.

**Scope vs plan** (three regression bars, all met):

1. **Legacy six unchanged** — two independent layers:
   - *Committed suite*: `node tests/run.js` → **23/23 files / 1584 checks
     green**, now including the new 107-check `test-regression-cycle3.js`:
     (A) with only the six legacy node files loaded, `getAllTypes()` is
     exactly the pre-cycle-3 shape and every legacy paramSpec is an
     all-numeric slider; with all ten loaded, `isExperimental()` is true
     for autotune alone. (B) legacy param rows still render
     `input[type=range]` and commit `parseFloat(value)` as a NUMBER through
     the REAL `NodeTypes.applyParam` + `AudioParamRamp` path (dB→linear,
     ms→s, %→equal-power conversions re-verified live); the UI-1 discrete
     branch is keyed on `spec.values` alone (throwaway discrete type
     renders a select in the same loop); `updateControl` fast path intact.
     (C) hostile LEGACY presets still load verbatim (structure-only
     treatment) while the same abuse on a declared type rejects — the
     PRE-1 tightening is scoped; legacy serialize is JSON-byte-stable with
     no new fields; `DEFAULT_PRESET` is still the committed six-node
     Classic Karaoke chain. (D) a string on a legacy numeric param is
     refused INVALID_ARGUMENTS through set_param AND set_chain (nothing
     applied, no undo, same physical instances) while 'F#' on autotune
     applies in the same boot. (E) the six legacy `--family-*` CSS tokens
     are byte-identical to the cycle-2 committed values; the four new
     tokens exist.
   - *Offline render identity* (`run-qa2.js` section A): the shipped
     DEFAULT six-node chain AND a corner-params variant rendered through
     the REAL `AudioGraph.buildGraph()` + node files twice — all ten
     modules loaded vs only the six legacy modules — are **BIT-IDENTICAL**
     (peaks −21.9 / −17.9 dBFS; sensitivity checks prove the comparison
     bites: default vs stressed differ by 32 dBFS). Registering the four
     cycle-3 types changed no legacy sample.
2. **Watchdog + limiter safety net with the new nodes** — existing tests
   green in-suite (`test-watchdog-tap-and-latch.js` 35, `test-hidden-tab-
   watchdog.js` 44, `test-safety-refusals.js` 46); harness section C runs
   the REAL `src/meter-taps.js` watchdog over REAL rendered audio of
   chains containing gate+distortion+chorus+autotune: OUT analyser taps
   the output attenuator (C1); valid full ten-node program does NOT trip
   over 3 s (last OUT feed −12.5 dBFS) (C2); the human-sovereignty
   scenario (limiter removed by hand, +6 dB input, +24 dB gain) TRIPS and
   latches with all four new nodes upstream — post-trip render is exact
   silence, alert + Restore button created (C3); rebuilding the all-four
   chain while latched schedules NO upward chain-gate ramp and un-ducks
   to the mute level 0, not the Bypass-derived 1.0 — the issue-#3 fix
   re-proven with worklet/composite nodes in the teardown set (C4); the
   latch holds through 1 s of normal-level program, only the human
   Restore button reopens (gate→1.00), and the restored limiter-terminal
   chain does not re-trip (C5). Agent-lane terminal-limiter refusals over
   an all-four chain (add-after-limiter, limiter removal, mid-chain
   reorder, out-of-range ceiling — all with model/instances/undo
   untouched, live limiter still ratio 20 / attack 0 / knee 0 and still
   feeding the chain gate) are test-regression-cycle3.js part D.
3. **Bypass over an all-four chain** — QA-1's bit-exact result cited
   (qa1-report.txt `A.bypass_chain=true`); extended to a new angle: an
   ALL-TEN chain (legacy + four new interleaved, terminal limiter) is
   BIT-EXACT vs the raw source under chain-level Bypass (harness
   section B).

**Results**: suite 23/23 files / 1584 checks green; harness ALL CHECKS
PASS (exit 0), report `tests/qa-out/qa2-report.txt`.

**Method notes**: the offline substitutions mirror QA-1/AT-0 and are
documented in the harness header (ffmpeg decode; spec-draft compressor
detector; FFT overlap-add convolver with energy-normalized IR; real-FFT
analysers; instant param automation with full call recording; synchronous
worklet port messages). Both sides of every comparison use the same
runtime, so identity/trip conclusions are Chrome-independent. Cited, not
re-run: node factories/reuse (`test-node-reuse-type-match.js`,
`test-audio-lifecycle.js`), legacy-chain watchdog cadence
(`test-watchdog-tap-and-latch.js`, `test-hidden-tab-watchdog.js`),
factory-preset policy, legacy chip/card rendering.

**Interruption note**: an earlier dispatch of this task was interrupted
after writing the two test artifacts but before verifying/doc-updating;
this dispatch re-ran everything from scratch (full suite + both artifacts
fresh), found the on-disk qa2-report.txt one summary revision stale
(pre-final edit), and regenerated it — all checks pass in the recorded
run. No regressions found in production code; nothing in src/ changed.

## DOC-1 — README/DESIGN refresh — `awaiting-approval`

**Date**: 2026-08-29 · **Delegation**: production-swarm worker (DOC-1).

**Changed files**
- `README.md` — operator docs for the four cycle-3 effects + demo pointer
  + stale-claim updates (details below).
- `DESIGN.md` — modest fold-in extension: family tokens, experimental
  badge, discrete param select (details below).
- `PRODUCT.md` — stale counts corrected (6→10 node types, 8→10 tools,
  sliders → sliders + selects; cycle-3 MCP note).
- `docs/ACCEPTANCE.md` — stale counts corrected (eight→ten tools in three
  places, six→ten node handlers) + cycle-3 walk additions.
- `docs/ultron/plan.md` — DOC-1 status → `awaiting-approval`.
- `docs/ultron/state.md` — active-task line updated.

**Scope vs plan** (four deliverables, all met):

1. **README operator docs, four new effects** — new section "The four
   newer effects — what they're for" inside the operator manual, house
   voice (plain language, bold control names, when-to-reach guidance):
   Noise Gate (auto-ducks between singers; Threshold/Attack/Release/Floor
   explained as "how loud to count as singing / how fast it opens /
   closes / how far down it ducks"; noisy-rooms use case; gentle-default
   + lengthen-Release tip), Distortion (Drive/Tone/Output with the unity
   cap stated in operator terms; rock numbers; the honest no-clean-zero
   note — Drive 0 still colors by design, clean comparison is Bypass),
   Chorus (Depth/Rate/Mix; ballads/one-singer-sounds-like-two; stereo
   best, mono-safe), Autotune (Key/Scale dropdowns, Retune Speed 0 ms
   hard-tune → 500 ms gentle glide, Mix; deliberate-effect framing with
   the wrong-key warning) carrying BOTH required notes: the Experimental
   badge (EXP on the chip, Experimental on the card, not in factory
   presets, rehearse first) and the 20 ms declared delay (a fiftieth of a
   second; imperceptible while singing, a hair late in A/B — expected
   behavior, not a fault; QA-1's accepted verdict reflected).
2. **Demo pointer** — closing "Want to hear all four before a show?"
   paragraph: the fixed test vocal `assets/test-vocal.mp3` (CC0, source
   credited in THIRD_PARTY_NOTICES.md) + the reproducible path
   `node tests/qa-out/run-qa1.js` (Node + ffmpeg) followed by the guided
   A/B order in `tests/qa-out/LISTENING.md` — the exact QA-1 harness,
   same node code the app runs.
3. **DESIGN.md extension** (cycle-2 amendment style: folded into the
   existing sections, no new sections beyond component bullets, no
   redesign): frontmatter gains family-distortion #C0CE97 /
   family-chorus #9E9ED1 / family-gate #9AD5B2 / family-autotune #D19ED1;
   "Six family edges" → "Ten family edges" with the cycle-3 four's rq5
   numbers (ink 6.74–10.22, ≥5.30 on card, hues ≥25° clear); new
   **Experimental badge** bullet under Cards (one factory, two
   placements — "Experimental" tag in the card header, compact "EXP"
   right-pinned on the chip; amber bezel + amber text on card ground
   6.65; status tag not control, no focus/pointer; SR-by-content incl.
   the chip aria-label; driven by the type registration so the visible
   badge and the agent capabilities readout cannot drift); new
   **Param select (discrete params)** bullet under Inputs/Fields (native
   `<select>` for autotune Key/Scale, Faceplate ground + Bezel border +
   mono readout register, option text IS the value, native semantics
   untouched, fader row rhythm); the Faders bullet scoped to continuous
   params.
4. **Stale claims cycle 3 (and the late-cycle-2 tool count) invalidated**:
   README intro effect list + operator effects list now name all ten and
   the Key/Scale selects ("Use the sliders" no longer universal);
   README Verification line names the cycle-3 coverage; PRODUCT.md
   "Confirmed functionality" 6→10 node types, param sliders → sliders +
   discrete selects, cycle-2 "8 tools" → 10 (naming get_preset/
   load_preset as late-cycle-2 additions, plus one sentence for cycle-3
   string params + capabilities badge, no new tools);
   docs/ACCEPTANCE.md registration table and §4 title/list "all eight
   tools" → "all ten tools" (three places), §2 click check "six node
   handlers" → "all ten", the min→max slider-drag line gains the
   Key/Scale select step, §2 gains a cycle-3 effects item pointing at
   tests/qa-out/LISTENING.md, §4 gains get_preset/load_preset and a
   discrete-string set_param walk line (legal `A`/`Minor` applies,
   illegal key refused with the allowed list).

**Results**: docs only — no src/, styles, index.html, tests, or preset
data touched; `node tests/run.js` re-run as a docs-change sanity gate:
23/23 files / 1584 checks green.

**Method notes**: param names/ranges/defaults in the README copy were
taken verbatim from the paramSpec registrations in src/node-{gate,
distortion,chorus,autotune}.js; badge/select treatment wording follows
src/canvas.js (createExperimentalBadge) and styles/main.css
(.param-select, .node-experimental-badge); the 20 ms and
no-bit-exact-neutral facts follow QA-1's accepted record (qa1-report.txt,
LISTENING.md). DESIGN.md deliberately records no new named rules and
changes no existing rule — the four tokens, one badge, one control enter
through the documented extension points ("Do extend the token set").

## FINISH-1 — Plain-language help for the four cycle-3 effects — `awaiting-approval`

Refinement entry 1 (`$impeccable clarify`, critique P2-1): the four
cycle-3 families (noise gate, distortion, chorus, autotune) shipped with
zero plain-language param help while the original six had the cycle-2
round-1 layer.

**What changed** (`src/param-controls.js` +39/−6, nothing else in src/):

1. `PLAIN_LANGUAGE_HELP` gains 14 lines (gate Threshold/Attack/Release/
   Floor, distortion Drive/Tone/Output, chorus Depth/Rate/Mix, autotune
   Key/Scale/Retune Speed/Mix) — 28 of 28 params across all ten types
   now helped. Same map, same per-row mechanism (title on row + control,
   `.sr-only` span, same-row `aria-describedby`), same operator register,
   no label prefixes, no em-dashes, no markup/CSS/dialogs.
2. The critique-named risky controls carry outcome-framed direction
   clauses: gate Threshold ("How quiet a sound can be before the gate
   closes on it. Higher = the gate closes on more sounds."), gate Floor,
   distortion Drive, distortion Output ("…never louder than the clean
   signal." — the unity cap in operator terms), autotune Retune Speed
   ("Smaller = instant robot snap, bigger = a smoother glide."). Copy
   substance follows README.md's own operator disclosures.
3. Autotune's required disclosure — experimental status + the accepted
   fixed 20 ms engine delay — rides the Key line (the card's first param
   row / first tab stop): "Experimental: the newest engine, and it adds
   a fixed 20 ms delay (a fiftieth of a second) to the vocal." Said once
   per card, not four times; the card badge + chip aria-label (single
   source `NodeTypes.isExperimental()`) remain the primary status
   disclosure.

**Evidence**: `tests/test-palette-cards-cycle3.js` +83 lines — new
section H renders ALL TEN types through the real registry + real
param-controls.js in the vm-DOM harness and checks per row: non-empty
`.sr-only` span, row-scoped id convention, title on row AND control,
resolvable same-row `aria-describedby`; risky-line direction clauses;
the autotune Key disclosure; first-row-only status. Doubles as a
help-completeness gate (a future family without lines fails the suite).
Render-level spot check printed the verbatim gate + autotune card help
wiring (titles/spans/describedby all match). Full suite 23/23 files /
1823 checks green. Ledger: [refinement.md](refinement.md) entry 1.

## FINISH-2 — EXP badge raised to the 11px floor — `awaiting-approval`

Refinement entry 2 (`$impeccable typeset`, critique P2-2): the
experimental badge rendered at 0.625rem (computed 10px) on BOTH
placements (card header "Experimental" tag + palette chip "EXP" tag),
under the design system's own 11px floor — while the CSS comment and
DESIGN.md claimed it compliant.

**What changed** (appearance-only; `styles/main.css` + docs + test):

1. `.node-experimental-badge` font-size 0.625rem → **0.6875rem** (11px
   computed — the legend-initials floor precedent; DESIGN.md's 11px
   Floor Rule). One rule fixes both placements: the chip-scoped rule has
   never set a size, so card + chip render identical type and cannot
   drift.
2. Side padding 0.3rem → **0.35rem** (the critique's fix note — hold the
   tag's optical proportions at the larger size). Weight 700, 0.06em
   tracking, amber-on-Module-Card (6.65) unchanged: still a quiet status
   tag, no new loudness.
3. Both misstatements corrected: the CSS comment now states the floor
   honestly (and names the old false claim); DESIGN.md's badge spec and
   the `.impeccable/design.json` sidecar (description + css snippet)
   carry the corrected 0.6875rem.

**Evidence**: `tests/test-palette-cards-cycle3.js` +138 lines — new
section I parses the real main.css (comments stripped) and asserts the
floor on the shared rule (0.6875rem = 11px ≥ floor), no chip-scoped size
override, the initials rules at the same 0.6875rem, the quiet tag
treatment intact, both live placements wearing the one class, and
DESIGN.md + design.json agreeing with the stylesheet (re-shrink or doc
drift fails the suite). Render-level worst case (headless Chrome, real
stylesheet, canvas.js-faithful DOM): computed 11px on both placements;
chip badge 35×16.2px single-line, zero overflow in the real 200px
palette flank (167px chip) and a 220px-flank variant (187px chip), chip
height 38px unchanged; card badge 100.6×16.2px single-line, header one
24px row, no chevron overlap at production width (939px card at
1440×900); chip aria-label unchanged ("Add Autotune to chain
(experimental)"). Detector type scan 13 → 12 findings (the badge's
0.625rem off-ramp advisory gone; remainder the standing adjudicated
set). Full suite 23/23 files / 1836 checks green. Residual (disclosed,
pre-existing): below a ~680px window the squeezed card's badge overlaps
the chevron — measured at the old 10px too. Ledger:
[refinement.md](refinement.md) entry 2.

## FINISH-3 — Palette grouped into three operator chunks — `awaiting-approval`

Refinement entry 3 (`$impeccable layout`, critique P2-3): the add-a-node
decision point had grown to ten flat, ungrouped chips (was six at design
time) — a working-memory/chunking violation exactly where the operator
stands under pre-show pressure.

**What changed** (presentation seam; `src/canvas.js` +
`styles/main.css` + DESIGN.md bullet + test):

1. The ten chips chunk under three silkscreen group headers in
   non-engineer operator language, derived from README/PRODUCT framing:
   **Shape your voice** (EQ, Distortion, Chorus, Autotune — the voice's
   own character), **Polish your sound** (Gain, Compressor, Delay,
   Reverb — level, evenness, space), **Keep it safe** (Limiter, Noise
   Gate — the two automatic guards). Headers follow the surface's
   grouped-options legend register (the preset/device optgroup
   precedent): 0.7rem = 11.2px (above the 11px floor), 700, uppercase,
   0.08em tracking, muted; generous space above (0.9rem) / tight below
   (0.35rem), first header's top margin dropped under the panel h2's
   rule.
2. Structure only, no new interactive layer: headers are real non-focus
   `<h3>`s (h1 title → h2 Palette → h3 groups — SR users can navigate
   the chunking) INTERLEAVED between chips; chips stay flat
   direct-children `<button>`s in DOM order, so the cycle-2 R2-2
   keyboard/SR node-addition flow, tab order, and aria-labels are
   unchanged. Within-group order stays registration order; the group
   map is a lookup (FAMILY_INITIALS discipline) with a trailing "More
   effects" fallback so a future registration can never silently vanish
   — and the test fails on any unmapped type, forcing an explicit
   grouping decision.
3. Limiter semantics preserved exactly: the "Keep it safe" header is
   adjacent text, nothing more — the limiter chip keeps its button,
   aria-label, gating, and human add path, and the terminal-limiter
   policy (addNodeType's insert-before + the agent-side removal
   refusal) is untouched. The palette Sortable gains
   `draggable: '.node-chip'` so headers can never be grabbed (verified
   against the vendored SortableJS 1.15.7 source: drag targets resolve
   via closest(target, draggable, el); chip drag is unchanged).

**Evidence**: `tests/test-palette-cards-cycle3.js` section J (+26
checks): group structure/membership/order, header non-interactivity,
flat interleaved child sequence, only-ten-buttons-focusable, limiter
chip preserved byte-for-byte, keyboard adds from EACH group committing
through the shared chokepoint, insert-before-terminal-limiter intact,
the CSS legend register + rhythm, and the Sortable drag scoping. Full
suite 23/23 files / 1862 checks green. Render-level check (headless
Chrome, real app over http, 1440×900): at the production 200px flank —
headers 11.2px single-line (1 client rect, scrollWidth === clientWidth
167px), zero overflow anywhere, ten chips 167×38px (geometry identical
to entry 2's record), 10 focusables all BUTTON; at a 220px-flank
variant — same (187px, no wrap/overflow). Detector full-parser scan: 4
findings, byte-identical to the standing adjudicated set. Residual
(disclosed): design.json sidecar's group labels await the planned
post-loop document refresh. Ledger: [refinement.md](refinement.md)
entry 3.
