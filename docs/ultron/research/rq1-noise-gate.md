# RQ-1 — Noise Gate topology in Web Audio (no native gate node)

- **Status**: decided — recommendation accepted for GATE-1 planning
- **Decision priority**: P0 (blocking GATE-1)
- **Affected task IDs**: GATE-1 (primary), TEST-1 (verification plan feeds it)
- **Date**: 2026-08-29
- **Delegation record**: deep-research track agent, prompted by cycle-3 plan (`docs/ultron/plan.md` RQ table, RQ-1 marked blocking GATE-1). Codebase evidence read directly: `src/audio-graph.js` (registerNodeType, ~L377; composite `{input, output}` contract, ~L455), `src/node-compressor.js` (param-holding custom node + `NodeTypes.register`/`applyParam` + `AudioParamRamp.schedule` pattern), `src/watchdog-worklet.js` (existing AudioWorklet precedent: `addModule('src/watchdog-worklet.js')`, ES-module scope worklet posting peak/RMS to main thread), `src/audio-bypass.js` (bypass reroutes audio AROUND the whole chain via `bypassGain`).

## Question

How should a noise gate be built in Web Audio given there is no native gate node — AudioWorklet-based envelope-follower gate vs scheduled GainNode automation vs hybrid? It must expose Threshold/Attack/Release/Floor params, open on vocal onsets without clipping attack consonants, close on silence without chopping tails, be bypass-clean, artifact-free on a test vocal, and fit the existing node contract.

## Constraints / evaluation criteria

1. **Param set is FIXED by scope**: Threshold / Attack / Release / Floor (plan.md "Fixed by scope — do not re-litigate"). Anything else (hysteresis, hold, look-ahead, detector type) must be an internal constant.
2. **Node contract fit** (`src/audio-graph.js` L377, L455): factory `(audioContext, params) -> AudioNode | {input, output}`; `NodeTypes.register(type, {label, paramSpec, applyParam})`; live param changes go through direct AudioParam writes scheduled via `window.AudioParamRamp.schedule()` (`src/node-compressor.js` L91–96). A worklet-based node whose params are real `AudioParam`s (via `parameterDescriptors`) satisfies `applyParam` with ZERO new machinery.
3. **Artifact-free**: no clicks (gain changes must be per-sample ramped, not stepped), no chattering near threshold, no clipped attack consonants (plosives/`t`,`k` onsets), no chopped release tails (breath/decay).
4. **Bypass-clean**: `src/audio-bypass.js` reroutes audio around the entire chain, so the gate only needs deterministic state (open when above-threshold energy present) — but the node must not add disqualifying latency. Look-ahead adds a fixed delay; must stay small (≤ ~10 ms, imperceptible for karaoke monitoring per standard round-trip-latency guidance).
5. **Hidden-tab robustness**: the project ALREADY learned (issue #7, `watchdog-worklet.js` header) that main-thread rAF loops freeze in background tabs while audio keeps playing. A karaoke rig left unattended must not have its gate decisions freeze. This disqualifies any design whose *decisions* depend on main-thread timing loops.
6. **No build step, Chrome-only, offline-first**: a plain extra file `src/gate-worklet.js` loaded via `audioWorklet.addModule()` matches the existing watchdog pattern exactly (page-relative URL, works on `localhost:8000` and GitHub Pages).

## Options considered

### Option A — Pure AudioWorklet gate (RECOMMENDED)

One `AudioWorkletProcessor` does everything per render quantum: RMS envelope detection (per-block or short-window), hysteresis decision (open at Threshold, close a few dB below), hold timer, per-sample attack/release gain ramp between Floor and 1.0, with a small internal look-ahead delay line so the attack ramp starts before the transient arrives. Params (`threshold`, `attack`, `release`, `floor`) declared in `static get parameterDescriptors()` so they are real AudioParams — `AudioParamRamp.schedule()` works unchanged for `applyParam`.

- **Fit**: excellent. Composite `{input, output}` contract already supported (AE-7 addendum). Real AudioParams match the compressor's `applyParam` shape exactly.
- **Effort**: medium — one new worklet file + one `node-gate.js` following `node-compressor.js`'s shape, plus the `addModule()` load (must happen once before graph build; can mirror `meter-taps.js`'s load pattern with a fallback consideration).
- **Maintenance**: single self-contained processor, no cross-thread timing coupling, no scheduled-event bookkeeping to desync.
- **Timing**: sample-accurate; decisions on the audio thread; immune to main-thread jank/hidden-tab throttling (the exact failure mode the watchdog worklet was created to fix).

### Option B — JS-side analyzer + scheduled GainNode automation

`AnalyserNode` polled on main thread (rAF or `setInterval`); when level crosses threshold, schedule `setValueAtTime`/`linearRampToValueAtTime` ramps on a GainNode.

- **Fit**: uses only native nodes; but `applyParam`-style live threshold changes are trivial while the *gate behavior* becomes scheduling code on the main thread.
- **Effort**: medium-low to prototype, HIGH to make robust.
- **Fatal flaws**: (1) analyser polling cadence (rAF ≈ 16 ms, and rAF STOPS when hidden — the documented issue #7 failure mode) makes onset detection late by 10–30 ms+, clipping attack consonants; (2) `linearRampToValueAtTime` events compete with live param ramps and rapid re-decisions cause ramp-stacking glitches; (3) chattering requires debouncing in JS with wall-clock timers that also throttle in background tabs.
- **Maintenance**: high — event scheduling state machine, cancel-and-reschedule races, two clocks (AudioContext time vs `performance.now()`).

### Option C — Hybrid: worklet envelope detector posts level to main thread; main thread schedules GainNode ramps

Splits detection (audio thread, robust) from gain shaping (native GainNode).

- **Fit**: works with existing patterns, but inherits Option B's scheduling races and the ~21 ms message cadence (watchdog posts every 8 blocks) delays onset response — enough to audibly clip consonant attacks without look-ahead.
- **Effort/maintenance**: highest of the three — two files of coupled state, message protocol, and ramp bookkeeping; postMessage round-trip latency makes sample-accurate open timing impossible.

## Recommendation

**Option A: a pure AudioWorklet gate** — new `src/gate-worklet.js` (processor) + `src/node-gate.js` (registration shim), following the `watchdog-worklet.js` + `node-compressor.js` precedents.

### Rationale

1. **No native node exists and none is coming soon**: the Web Audio API issue proposing a NoiseGate/Expander node (WebAudio/web-audio-api#2395, opened 2023, still open as of Aug 2026) lists exactly the controls we need (threshold, attack, release, hold, attenuation, hysteresis) — confirming both the gap and the canonical param model.
2. **Sample accuracy where it matters**: attack consonants are 5–20 ms transients; only per-sample gain on the audio thread can ramp open fast enough without clicks. Main-thread designs are structurally 10–30 ms late.
3. **Hidden-tab robustness is a project requirement already paid for**: the watchdog worklet exists because rAF freezes in background tabs (`src/watchdog-worklet.js` header, issue #7). Option B/C put gate decisions back on that frozen path.
4. **Contract fit is nearly free**: `parameterDescriptors` AudioParams mean `applyParam` is four `AudioParamRamp.schedule()` calls, identical in shape to the compressor's.

### Param topology (concrete plan update for GATE-1)

Exposed params (fixed set, registered via `NodeTypes.register`, sliders rendered generically):

| id | range | default | unit | AudioParam? |
|---|---|---|---|---|
| `threshold` | -80..0 | -50 | dB | yes (k-rate) |
| `attack` | 0.001..0.5 | 0.005 | s | yes (k-rate) |
| `release` | 0.01..2 | 0.15 | s | yes (k-rate) |
| `floor` | -60..0 | -40 | dB (attenuation when closed) | yes (k-rate) |

Internal constants (NOT exposed — param set is fixed):

- **Detector**: per-block RMS over the 128-sample render quantum, smoothed with a one-pole envelope follower (attack-fast/release-slow). Rationale: RMS gives stable gating decisions (Q-Sys DSP gate uses RMS detection); pure peak chatters on transients.
- **Hysteresis**: close threshold = open threshold − 6 dB. Rationale: standard practice (Wikipedia noise gate; Sound on Sound "Advanced Gating") — prevents chattering on signals hovering at threshold.
- **Hold time**: 50 ms minimum-open after level falls below the close threshold, before release ramp starts. Rationale: bridges gaps between consonant peaks and breath tails; ~100 ms commonly cited as a starting point (ProSoundWeb Noise Gates 101; mastering.com), 50 ms is conservative for sung vocals with a 150 ms release.
- **Look-ahead**: 5 ms internal delay line, matching the max default attack ramp so the gain is already fully open when the transient arrives. Rationale: look-ahead ≈ attack time is the standard pairing (Logic Pro Help / r/audioengineering practitioner guidance). 5 ms added latency is imperceptible and bypass reroutes around the whole chain anyway (`src/audio-bypass.js`).
- **Gain curve**: per-sample linear interpolation of gain in dB-domain between Floor and 0 dB over attack/release windows (dB-linear ramps avoid the level-dependent speed error of linear-in-gain ramps).

`node-gate.js` shape: factory creates `new AudioWorkletNode(audioContext, 'noise-gate', {numberOfInputs:1, numberOfOutputs:1})` after ensuring `addModule('src/gate-worklet.js')` resolved (await/promise handled at graph-build time or pre-loaded at app start like meter-taps does); node has `.input`/`.output` (AudioWorkletNode is itself an AudioNode, so it satisfies both contract forms directly); `applyParam` = four `AudioParamRamp.schedule(node.parameters.get(id), value)` calls.

## Evidence

| Claim | Source | Version/date |
|---|---|---|
| No native noise gate/expander node; proposed controls are threshold/attack/release/hold/attenuation/hysteresis | [WebAudio/web-audio-api issue #2395](https://github.com/WebAudio/web-audio-api/issues/2395) | opened 2023, open as of Aug 2026 |
| Gates implement hysteresis: open threshold + a second, few-dB-lower close threshold to prevent chattering | [Wikipedia — Noise gate](https://en.wikipedia.org/wiki/Noise_gate) | live, accessed 2026-08-29 |
| Hysteresis avoids gate "flutter" on fluctuating near-threshold signals | [Sound on Sound — Advanced Gating Techniques](https://www.soundonsound.com/techniques/advanced-gating-techniques-part-1) | long-standing article, accessed 2026-08-29 |
| Hold time = minimum fully-open time after level drops below threshold; too short clips tails; RMS-based gate in shipping DSP | [QSC Q-Sys Gate block docs](https://help.qsys.com/Content/Schematic_Library/gate.htm), [ProSoundWeb — Noise Gates 101](https://www.prosoundweb.com/noise-gates-101-what-they-do-how-to-use-them-to-their-fullest/) | vendor docs, accessed 2026-08-29 |
| Look-ahead triggers the gate N ms early; match look-ahead to attack time | [Logic Pro Help forum](https://www.logicprohelp.com/forums/topic/31513-what-exactly-should-lookahead-be-doing-for-a-noise-gate/), [r/audioengineering](https://www.reddit.com/r/audioengineering/comments/1j2pf3l/how_does_lookahaed_work_on_gate/) | practitioner consensus, accessed 2026-08-29 |
| RMS detection = stable average-energy decisions; peak = fast but chatter-prone | [Mini-Circuits peak vs RMS detectors](https://blog.minicircuits.com/peak-and-rms-power-detectors-for-high-frequency-signal-measurement/), [DSPRelated comp.dsp thread](https://www.dsprelated.com/showthread/comp.dsp/110034-1.php) | accessed 2026-08-29 |
| Envelope attack/release smoothing model (envelope rate from attack/release params) | [W3C Web Audio API 1.1 — DynamicsCompressorNode](https://www.w3.org/TR/webaudio-1.1/) | W3C spec, 1.1 |
| AudioParam ramp scheduling patterns (setValueAtTime/ramps) for envelopes | [MDN — Advanced techniques: sequencing audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques), [Chris Lowis — Envelopes](https://chrislowis.co.uk/2013/06/17/synthesis-web-audio-api-envelopes) | MDN live; Lowis 2013 |
| Main-thread rAF freezes in hidden tabs while audio-thread processing continues; AudioWorklet is the project's established fix | `src/watchdog-worklet.js` header (issue #7) | local source, cycle 2 |
| Composite `{input, output}` factory return already supported by buildGraph | `src/audio-graph.js` ~L455 (AE-7 addendum) | local source |
| Live param writes go through `AudioParamRamp.schedule()` in each type's `applyParam` | `src/node-compressor.js` L91–96, `src/node-types.js` `applyParam` | local source |
| Bypass reroutes audio around the whole chain (gate latency irrelevant while bypassed) | `src/audio-bypass.js` | local source |

## Tradeoffs / risks / confidence

- **Risk: `addModule` is async** — a graph build before the module resolves can't create the worklet node. Mitigate: kick off `addModule('src/gate-worklet.js')` at app start (same as meter-taps) and have the factory fall back gracefully or the build await a shared promise. Note meter-taps already handles addModule-missing fallback (rAF mode) — the gate has no safe fallback; Chrome-only target makes availability near-certain.
- **Risk: fixed 5 ms look-ahead latency** in the monitor path. Acceptable (<10 ms is generally imperceptible in monitored live vocals); if TEST-1 flags it, drop look-ahead to 0 and rely on fast default attack (5 ms) — consonant clipping is then bounded by attack time.
- **Risk: internal constants may misfit unusual voices.** Mitigation: keep them as named constants at the top of `gate-worklet.js` with rationale comments; they are tunable in one place without touching the fixed UI param set.
- **Tradeoff vs Option C**: worklet does marginally more per-sample math (one-pole follower + gain multiply + delay line) — trivial CPU vs reverb/convolver already in the chain.
- **Confidence: high** on topology (worklet vs scheduling — decisive, structurally determined by timing + hidden-tab constraints); **medium-high** on the specific constant values (6 dB hysteresis / 50 ms hold / 5 ms look-ahead), which TEST-1 on the test vocal should confirm/adjust.

## Implementation consequences / plan update for GATE-1

1. New file `src/gate-worklet.js`: `registerProcessor('noise-gate', ...)` with `parameterDescriptors` = threshold (dB, k-rate), attack (s, k-rate), release (s, k-rate), floor (dB, k-rate); internal RMS one-pole detector, 6 dB hysteresis, 50 ms hold, 5 ms look-ahead delay line, dB-domain per-sample ramps; passthrough-exact when gain ≡ 0 dB (helps bypass-clean verification).
2. New file `src/node-gate.js`: IIFE calling `AudioGraph.registerNodeType('gate', factory)` + `NodeTypes.register('gate', {...})` with the four-param spec above and `applyParam` using `AudioParamRamp.schedule(node.parameters.get(id), value)`.
3. Worklet module load: add a one-time `addModule` at startup (mirror `src/meter-taps.js`'s WORKLET_URL pattern); factory must handle not-yet-loaded (queue or throw-once-retry) — pick the simplest deterministic option during GATE-1.
4. TEST-1 update: verification should include (a) onset test — plosive-rich vocal phrase, check first 10 ms of each phrase not attenuated; (b) tail test — sustained note release, no abrupt cutoff; (c) chatter test — signal hovering at threshold, no gain flutter; (d) bypass A/B null test with gate in chain; (e) hidden-tab test — gate still operates with tab backgrounded.
5. No changes to `audio-graph.js`, `node-types.js`, `param-controls.js`, or `audio-bypass.js` — the existing contract absorbs the new type whole.
