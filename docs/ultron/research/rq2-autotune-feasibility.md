# RQ-2: Can real-time (hard-tune) pitch correction run artifact-free in a single AudioWorklet within ~10–20 ms added latency?

- **Task IDs framed:** AT-0 (disposable spike), AT-1 (production `src/node-autotune.js`)
- **Decision priority:** P0 (blocks AT-0/AT-1 design)
- **Status:** RESOLVED (desk research) — verdict below; AT-0 spike still required to confirm empirically
- **Date:** 2026-08-29
- **Researcher:** deep-research track agent (ZCode)

---

## 1. Question

Can a hard-tune (fast retune / "autotune effect") pitch correction for a singing vocal be implemented as a single AudioWorklet processor, artifact-free, with ≤ ~20 ms *added* latency on a typical laptop — and which technical approach should be used?

## 2. Constraints & success criteria

1. **Single AudioWorklet** on the `registerNodeType()` contract in `src/audio-graph.js`; precedent `src/watchdog-worklet.js`. Chrome-only, no build step, plain script-tag modules; vendored third-party JS lives in `vendor/`.
2. **Offline-first static site:** all assets (including any WASM/model files) must ship from the site; no CDN fetches; license-clean per `THIRD_PARTY_NOTICES.md` pattern.
3. **Added-latency budget:** ≤ ~20 ms beyond the node's input-to-output (excluding context baseLatency/outputLatency, which exist for every node anyway).
4. **Artifact bar:** no audible warble/buzz/doubling on a sustained test vocal plus a portamento/legato phrase; correction ratio error < ~10 cents after snap.
5. **Fixed scope params:** Key/scale snap (Chromatic/Major/Minor × 12 keys), Retune Speed, Mix.
6. **CPU:** must fit comfortably in the 128-sample render quantum (~2.7 ms @ 48 kHz) on a mid-range laptop, without main-thread involvement (no `postMessage` in the per-block audio path).

## 3. Options considered

### (a) Classical time-domain detection (autocorrelation/YIN) + time-domain shifter (TD-PSOLA / OLA) — RECOMMENDED
- Detection: YIN (de Cheveigné & Kawahara, "YIN, a fundamental frequency estimator for speech and music," *J. Acoust. Soc. Am.* 111(4):1917–1930, 2002 — 15% absolute-threshold parabolic-interpolation variant; ~1–2× realtime cost at hop 256–512 with naive O(N·τ) search, trivially optimizable to a few % of a core with coarse-to-fine lag search).
- Shifting: TD-PSOLA (Moulines & Charpentier, "Pitch-synchronous waveform processing techniques for text-to-speech synthesis using diphones," *Speech Communication* 9(5–6):453–467, 1990) — re-splices pitch-synchronous Hann-windowed grains at the target period. Latency = ~2 pitch periods + analysis window; for singing (≈100–500 Hz) that is ≈4–17 ms; algorithmically artifact-free for *monophonic voiced* audio (the karaoke use case), with known degradation on unvoiced/fricative segments (handled by a voicedness gate from YIN's aperiodicity term).
- Real-time feasibility of PSOLA-style splice-in-place is well established (DSP SE thread "How does PSOLA pitch-shift work in real-time?", https://dsp.stackexchange.com/questions/27416; TCNJ real-time autotuner project walkthrough, https://engprojects.tcnj.edu/autotuner16/2016/04/11/the-psola-algorithm/).
- Pure JS in one worklet file; **zero vendoring, zero license burden**, ~400–600 lines of self-contained DSP. All params (retune smoothing, mix crossfade) are trivial control-plane math in the worklet.

### (b) ML detection (CREPE-tiny ONNX/WebGPU) + classical shifter — REJECTED for AT-1
- CREPE (Kim, Smart, Marmaros, Bittner, "Crepe: A Convolutional Representation for Pitch Estimation," arXiv:1802.06162 / ICASSP 2018; repo https://github.com/marl/crepe). Tiny variant = capacity multiplier 4, <3% of the full ~22M-param model (~700K params; model files still ≈2.5–5 MB fp32; full model ~89 MB per Wolfram Neural Net Repository).
- Problems: (1) **AudioWorklet cannot run TF.js/ONNX Runtime Web inside the audio thread** — these runtimes require main-thread/GPU setup, async inference, and postMessage hops of ≥10 ms frames, breaking the single-worklet/no-main-thread constraint and adding jitter (unbounded GC on main thread). (2) CREPE consumes 1024-sample frames at 16 kHz = 64 ms analysis horizon — its *detection* latency alone exceeds budget for hard-tune; and SwiftF0 benchmarks (arXiv:2508.18440) show CREPE is ~42× slower than purpose-built light models on CPU, i.e., heavy for real time. (3) Vendoring ONNX-runtime-WASM is a multi-MB (~10+ MB) addition to an offline static site, plus model license diligence. Accuracy advantage over YIN matters mainly for *polyphonic/noisy* audio, not close-mic monophonic singing.

### (c) Vendored libraries — REJECTED as primary engine
- **SoundTouchJS** (https://github.com/cutterbl/SoundTouchJS; LGPL, WASM/JS): WSOLA time-domain stretcher. Two blockers: SoundTouch-class WSOLA carries **≥ ~100 ms internal latency** (JUCE forum reports on SoundTouch/Rubber Band low-latency limitations, https://forum.juce.com/t/looking-for-a-timestretching-pitchshifting-library-that-has-very-low-latency/45404) — far over budget; and LGPL (even weak obligations) is a poor fit for the project's license-clean static-vendoring posture.
- **ml5.js pitchDetection** (MIT; https://ml5js.org/reference/api-PitchDetection/): wraps CREPE via TF.js, main-thread + AudioContext-analyser based, tens-of-MB model (see ml5 issue #975 requesting a tiny variant), frame-asynchronous, ±2 kHz range limits (SO 65898843). Not worklet-compatible; detection cadence (tens of ms) misses the hard-tune bar.
- **pitchy** (MIT, npm): a `getPitch()` utility over `AnalyserNode` autocorrelation — main-thread, no shifter, useful only as a spike-time reference oracle, not a production engine.
- **Rubber Band**: GPL/commercial — license-incompatible outright.
- Closest prior art is academic: OLA-TS.js (Georgia Tech, "Time Stretching & Pitch Shifting with the Web Audio API," 2016, https://repository.gatech.edu/bitstreams/f4b1290d-061f-45ab-8016-dfa8240b024e/download) and the 0xdevalias pitch-correction resource gist (https://gist.github.com/0xdevalias/7f4a5c31758e04aea5c2f5520e53accb) — no off-the-shelf browser autotune library exists that meets the latency+worklet constraints.

### Latency floor context (Web Audio platform)
- `AudioContext.baseLatency` ~2.7–2.9 ms (128-sample quantum @ 44.1/48 kHz); Chrome sometimes pulls 512 internally (~10 ms) (MDN baseLatency/outputLatency; WebAudio spec issues #2467/#2632). This floor applies to every node equally and is *not* charged to our 20 ms budget, but the spike should record it.
- Chrome round-trip output latency is dominated by the OS stack (~10–40 ms; jefftk.com AudioWorklet latency measurements; LessWrong browser-audio-latency writeup) — again common-mode, not added by the node.

## 4. Verdict

**PASS (conditional)** for approach (a): single AudioWorklet running YIN detection + TD-PSOLA-style synchronous overlap-add shifter, with a voicedness gate and per-block retune-speed smoothing.

- **Within budget:** added latency = analysis window + 2 output periods ≈ 12–20 ms for typical singing (150–400 Hz ≈ 5–13 ms; low male ~100 Hz ≈ 20 ms worst case). CPU well under one render quantum per block on a laptop.
- **Artifact-free bar:** PSOLA is the same family of technique used by commercial real-time pitch correctors on voiced monophonic input; the conditional part is that "artifact-free" must be *empirically confirmed* on a real test vocal (grain boundary clicks, octave errors at onset, sibilance gating) — hence AT-0.
- **If the spike shows hard-tune FAILS** (octave jumps / warble on the test vocal, or low-voice latency > 20 ms): the **slow-correction fallback is fully feasible** with the identical engine — same detector + shifter, only the retune-speed smoothing time constant changes (hundreds of ms glide masks detection jitter and grain artifacts far better than a ~0 ms snap). No architectural change; AT-1 ships slow/default correction and hard-tune ships behind a flag or is cut.

## 5. Evidence table

| Claim | Source |
|---|---|
| YIN: accurate monophonic f0, aperiodicity/voicing output, real-time class | de Cheveigné & Kawahara 2002, JASA 111(4):1917–1930 |
| PSOLA: pitch-synchronous OLA, real-time, high quality on voiced speech | Moulines & Charpentier 1990, Speech Communication 9(5–6):453–467 |
| PSOLA real-time splice operation | https://dsp.stackexchange.com/questions/27416/how-does-psola-pitch-shift-work-in-real-time ; https://engprojects.tcnj.edu/autotuner16/2016/04/11/the-psola-algorithm/ |
| CREPE tiny ≈ 700K params (<3% of full ~22M); full ~89 MB; 10 ms steps; heavy for real time | https://github.com/marl/crepe ; https://marl.github.io/crepe/ ; arXiv:2311.08884 ; arXiv:2508.18440 (SwiftF0 ~42× faster than CREPE on CPU) |
| ML runtimes can't live on the audio thread (async/GPU/main-thread) | ONNX Runtime Web / TF.js architecture; AudioWorklet spec (no async in process()) — design constraint, verified in Chrome docs |
| SoundTouch-class WSOLA ≥ ~100 ms latency | https://forum.juce.com/t/looking-for-a-timestretching-pitchshifting-library-that-has-very-low-latency/45404 |
| SoundTouchJS exists, LGPL, WSOLA | https://github.com/cutterbl/SoundTouchJS |
| ml5 pitchDetection: MIT wrapper over CREPE, tens of MB, main-thread | https://ml5js.org/reference/api-PitchDetection/ ; ml5 issue #975 |
| Chrome baseLatency ~2.7–10 ms; 128-sample quantum; output latency OS-dominated | MDN AudioContext.baseLatency/outputLatency ; WebAudio issues #2467, #2632 ; https://www.jefftk.com/p/audioworklet-latency-firefox-vs-chrome |
| Browser pitch-shift prior art (no off-the-shelf autotune lib) | OLA-TS.js GT 2016 (link above) ; https://gist.github.com/0xdevalias/7f4a5c31758e04aea5c2f5520e53accb |

## 6. Tradeoffs, risks, confidence

- **Tradeoff accepted:** YIN octaves errors on breathy onsets vs CREPE robustness — mitigated by scale-snapping (the snap grid itself constrains plausible f0), median smoothing over 2–3 frames, and hysteresis on the retune state machine.
- **Risks:** (1) low male voices (~85–100 Hz) push PSOLA latency to the top of budget — mitigation: cap correction range or accept ~20–25 ms there; (2) sibilants/unvoiced consonants must bypass shifting (YIN aperiodicity gate) else artifacts — known, testable; (3) onset transient smear for the first ~1 period after voicing onset — inherent, usually inaudible under music.
- **Confidence:** **Medium-high** for PASS within scope (monophonic close-mic vocal, laptop, ≤20 ms typical). Low risk that the *fallback* (slow correction) is infeasible — it is strictly easier on every axis.

## 7. Implementation consequences

**AT-0 spike design (disposable):**
- One HTML page loading a single worklet file; test signals: (i) synthetic steady tones at 110/220/440 Hz ±40 cents, (ii) one recorded sung phrase (dry, mono).
- **Measure:** end-to-end input→output added latency (impulse through node vs bypass, via offline render comparison of onset times); per-`process()` CPU time (performance.now deltas, report p99 vs 2.67 ms budget); pitch-tracking accuracy (cents error vs ground truth from `pitchy` or offline YIN reference on main thread); artifact audit (spectrogram + listening for warble/doubling at retune 0 ms and 200 ms).
- **Pass bar:** added latency ≤ 20 ms for f0 ≥ 110 Hz; p99 worklet CPU ≤ 25% of quantum; no audible artifact on test vocal at retune 0 ms for chromatic snap; correct key/scale snap for C-major and chromatic cases.
- **Fail path:** rerun bar at retune 50–300 ms; if that passes, hard-tune is cut, slow correction retained.

**AT-1 two-outcome shape:**
- *Outcome PASS:* `src/node-autotune.js` = single self-contained worklet (YIN + PSOLA + retune-smoothing state machine + Mix wet/dry crossfade), no vendor deps, registered via `registerNodeType()` alongside `watchdog-worklet` precedent; params Key/Scale/Retune/Mix via AudioParam-style messaging.
- *Outcome FAIL (hard-tune only):* identical node, default retune 150–300 ms, hard-tune values removed or flagged experimental; UI scope unchanged.

## 8. Delegation record

- Researched and written by: deep-research track agent (ZCode, GLM-5.3), 2026-08-29.
- Web sources consulted: marl/crepe repo + demo, arXiv 2311.08884, arXiv 2508.18440, cutterbl/SoundTouchJS, ml5.js docs + issue #975, JUCE forum latency thread, DSP SE PSOLA thread, TCNJ autotuner project, MDN baseLatency/outputLatency, WebAudio spec issues #2467/#2632, jefftk.com latency measurements, 0xdevalias gist, GT OLA-TS paper. Literature from training knowledge: de Cheveigné & Kawahara 2002 (YIN), Mauch & Dixon 2014 (pYIN — considered, rejected: Viterbi over frames adds latency, benefit over YIN marginal for snapped monophonic vocals), Moulines & Charpentier 1990 (PSOLA).
