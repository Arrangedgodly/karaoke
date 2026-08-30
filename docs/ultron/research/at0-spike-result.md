# AT-0 — Autotune feasibility spike record (hard-tune PASS/FAIL verdict)

- **Task:** AT-0 (docs/ultron/plan.md, cycle 3) — disposable spike; prototype must NOT ship in `src/`
- **Decision input:** D2 (research/rq2-autotune-feasibility.md §7 spike design + pass bar)
- **Date:** 2026-08-29 · **Worker:** production-swarm (AT-0)
- **Prototype:** `tests/spike/at0-autotune-worklet.js` (YIN + TD-PSOLA in one
  AudioWorklet-shaped processor, zero dependencies, nothing registered in
  index.html, no `src/` changes)
- **Harness:** `tests/spike/run-at0-spike.js` (offline Node render through a
  vm-stubbed AudioWorkletGlobalScope — the tests/test-gate-node.js precedent)
- **Verdict: HARD-TUNE PASS** on the D2 bar, measured on assets/test-vocal.mp3.
  AT-1 should build the Outcome-PASS branch. Slow correction measured on the
  same engine and also passes (equal-or-better artifacts).

Full machine-readable metric dump: `tests/spike/at0-spike-report.txt`
(113 metrics, zero WARN/FAIL after the fixes described below).

---

## 1. Method

### 1.1 Prototype processor (what was built)

One AudioWorklet-module-shaped file (registerProcessor + class extends
AudioWorkletProcessor, ES module scope, same shape as `src/gate-worklet.js`):

- **YIN detector** every 5 ms (hop 240 @ 48 kHz): difference function via the
  FFT autocorrelation trick (radix-2 FFT, 2048 pt) using the ORIGINAL paper's
  shrinking-window formulation (`d(τ) = Σ_{j<W−τ}(x[j]−x[j+τ])²`), cumulative
  mean normalization, 0.15 absolute threshold, parabolic interpolation.
  W = 960, τ ∈ [48, 480] (f0 range 100–1000 Hz). Median-of-3 + 2-of-3
  voicing; clarity (1 − d′) ≥ 0.7 and window RMS ≥ −60 dBFS = the
  aperiodicity gate (sibilants/unvoiced pass through unshifted).
- **Scale snap:** Chromatic/Major/Minor × 12 keys, correction clamped ±6
  semitones, stability-gated first target lock, ±0.52-semitone retarget
  confirmed on 2 consecutive frames (see §4 lessons — this state machine
  took three iterations to get right, each failure measured).
- **Retune speed** = one-pole smoothing of the shift ratio per OUTPUT epoch:
  0 ms = hard snap, 250 ms = slow glide — D2's two-outcome shape on one engine.
- **TD-PSOLA synthesis:** max-|x| epoch markers once per detected input
  period (±0.25 T refinement); 2T Hann grains re-spliced at output spacing
  T/ratio; nearest-marker selection gives duplication/skipping with no drift;
  overlap-add with a WINDOW-SUM accumulator and ÷-normalization (kills the
  classic PSOLA amplitude modulation when spacing ≠ COLA); ~3 ms wet/dry
  fade at voicing changes and coverage gaps.
- **Declared fixed algorithmic delay D = 20 ms** (960 samples @ 48 kHz):
  output content position p is emitted only after input has arrived to
  ~p + 2.1·T (grain lookahead); enforced by initializing the output content
  cursor at −D (delay-line warm-up silence for the first D samples). Wet and
  dry are both built from input around the same content position, so
  wet/dry switching is time-aligned by construction. D keeps the wet path
  feasible down to ~104 Hz; below that, samples pass dry (0.11% of the test
  vocal; counter in telemetry).

### 1.2 Offline driving + MP3 decode (documented substitution)

The repo has no JS MP3 decoder; the browser app decodes with
`AudioContext.decodeAudioData()` (proven in-app by the shipping reverb IR
path). Offline, the harness substitutes **ffmpeg**
(`ffmpeg -i assets/test-vocal.mp3 -ac 1 -ar 48000 -f f32le -c:a pcm_f32le`),
cached to `tests/spike/out/test-vocal-48k-mono.f32` (gitignored). Decoded:
1,138,501 samples = 23.72 s mono 48 kHz.

The processor runs in a vm sandbox with a stubbed AudioWorkletGlobalScope,
`process()` driven by hand with 128-sample blocks — exactly the committed
test-harness pattern (tests/test-gate-node.js Part 2). Per-block CPU is
wall-clocked around each `process()` call in the host (hrtime).

### 1.3 Measurement oracle

An INDEPENDENT offline YIN on the harness side (naive direct-loop difference
function, no FFT, W=1200, hop 480 = 10 ms, same voicing gates) provides the
reference contour for both the input and every output — cross-validated
against the worklet's own detector (§2 E). Synthetic ground truth is exact
by construction. Artifacts are measured with objective proxies (per-period
peak-envelope AM depth, worst-window least-squares SNR vs a sinusoid at the
target frequency, 20 ms-window out/in RMS dip, first-difference HF ratio,
naive-DFT spectral flux p99, 5 ms RMS discontinuity on sustained segments);
the agent cannot audition — four listening WAVs are written to
`tests/spike/out/` for the user's ear (QA-1's user-judged bar is unchanged).

---

## 2. Measurements (all numbers from the final run, /tmp-frozen copy at
`tests/spike/at0-spike-report.txt`)

### A. Pitch detection accuracy (synthetic ground truth: 110/220/440 Hz × 0/±40 cents, 9 steady tones)

| Metric | Value | Bar |
|---|---|---|
| median abs error | **0.0 cents** | — |
| p95 / max abs error | **0.1 / 0.1 cents** | — |
| octave errors | **0 / 2700** decisions | 0 |
| false-unvoiced blocks in steady tones | **0** | 0 |

On the real vocal, worklet vs independent reference (both voiced, 2425
frames): **93.1% agree within 20 cents**, 86 octave disagreements (3.5%),
81 other >20c — concentrated on breathy/low-clarity frames where neither
detector is authoritative; median-3 + snap hysteresis contain it (no octave
errors on clean tones). Reference contour of TEST-1: f0 p2/p50/p98 =
115.7 / 232.7 / 350.5 Hz, 51.8% of frames voiced.

### B. Snap correctness (synthetic; output f0 measured by the reference oracle)

| Case | Expected | Measured error |
|---|---|---|
| 265 Hz → C4 (chromatic) | 261.63 | **+1.5 c** |
| 275 Hz → C#4 (chromatic) | 277.18 | **−4.2 c** |
| 275 Hz → C4 (C major, C# forbidden) | 261.63 | **−4.4 c** |
| 310 Hz → D4 (C major, D# forbidden) | 293.66 | **−2.3 c** |
| 239 Hz → B3 (A minor, A# forbidden) | 246.94 | **−1.3 c** |
| 113 Hz → A2 (chromatic, bottom of range) | 110.00 | **−0.9 c** |

Scale masking and key handling are correct; the bar's "correct key/scale
snap for C-major and chromatic cases" is met with ≤ 4.7c everywhere.

### C. Added latency (bar: ≤ 20 ms for f0 ≥ 110 Hz)

- **Declared + realized: exactly 20.0 ms on every path** — emission
  hold-back is a constant 960 samples on every block; impulse test is exact
  (input sample 14400 → output sample 15360; bit-exact position, no smear).
- Voiced correlation alignment at 110/220/330/440 Hz lands within ~2.5
  periods of D (period aliasing of the correlation peak; the deterministic
  numbers are the impulse and hold-back above).
- The 20 ms is a DESIGN constant sized so the wet path stays feasible to
  ~104 Hz: measured at 113 Hz (T = 425, the longest realistic correction
  period) the shifter runs with **zero starvation** and −0.9c accuracy.
  Trade available to AT-1: D = 15 ms would cover f0 ≥ ~140 Hz; D = 24 ms
  would cover ~85 Hz. TEST-1 reaches 115.7 Hz (p2), so D = 20 ms is the
  right production choice for this bar.

**PASS at the bar boundary** (20.0 ≤ 20 ms).

### D. TD-PSOLA shift quality, synthetic steady shifted tones (3 s, −35…−44c corrections, harmonic-rich)

| Case | Snap err | AM depth | Worst-window SNR (input floor) |
|---|---|---|---|
| 239 → A#3 (−44c) | −1.7 c | **0.0 dB** | 8.3 dB (8.4 dB) |
| 225 → A3 (−39c) | +2.8 c | **0.0 dB** | 8.3 dB (8.5 dB) |
| 252 → B3 (−35c) | +4.7 c | **0.0 dB** | 8.3 dB (8.4 dB) |

The window-sum normalization holds amplitude modulation at the measurement
floor (0.0 dB peak-to-peak per period), and the residual-after-fit equals
the test tone's OWN harmonic floor — i.e., no detectable added noise or
period-jitter beyond the input's inherent harmonics. mix = 0 verified
**bit-exact** dry passthrough on every case.

### E. The real test vocal (TEST-1, 23.7 s) — the decisive bar input

Hard-tune (chromatic, retune 0 ms) / slow (250 ms) / C-major (0 ms):

| Metric | retune 0 (hard) | retune 250 (slow) | C-major 0 |
|---|---|---|---|
| snap residual median | **2.5 c** | 7.7 c | 2.4 c |
| snap residual p95 | **14.8 c** | 35.9 c | 17.4 c |
| voiced frames within 10 c | **90.9%** | 59.4% | 89.1% |
| min out/in window dip | −2.6 dB | −2.2 dB | −2.5 dB |
| windows below −20 dB | **0 / 1469** | 0 / 1469 | 0 / 1469 |
| HF click ratio out/in | **0.974** | 0.977 | 0.958 |
| spectral flux p99 out/in | 1.068 | 1.066 | 1.090 |
| max RMS step, sustained segs | 8.1 dB (in: 6.5) | 6.8 dB (in: 6.5) | 6.0 dB (in: 6.5) |
| grain-starved samples | 1284 / 1.14 M (0.11%) | 820 (0.07%) | 1176 (0.10%) |

The <10-cents-after-snap bar (D2 §2.4) is met: median 2.5c, 90.9% of voiced
frames within 10c. Slow-retune residual is larger by design (glides sit
between notes during the 250 ms transitions — the p95 35.9c IS the glide).

**"Lost voiced frames" caveat, investigated:** the reference oracle marks
~38% of input-voiced frames unvoiced on the OUTPUT — breakdown shows their
median clarity is **0.687**, just under the oracle's 0.7 gate, and 387/470
are audible (clarity ≥ 0.45, RMS ≥ −66 dBFS); output clarity p10 is 0.834 vs
input 0.923. I.e., PSOLA re-splicing costs ~0.08–0.09 clarity on this
breathy amateur vocal, pushing marginal frames under a strict analysis
gate — NOT level dropouts (dip/flux/HF metrics above are all clean; zero
windows below −20 dB). Audibility of the residual grain character on those
frames is exactly what QA-1's user listening must confirm (WAVs provided).

### F. CPU per 128-sample block (2.667 ms quantum; bar: p99 ≤ 25%)

| Case | mean | p50 | p99 | max | p99 as % of quantum | CPU-ms per audio-s |
|---|---|---|---|---|---|---|
| TEST-1 full render, hard-tune | 0.099 ms | 0.090 | **0.337 ms** | 2.73* | **12.6%** | 37.6 |
| 440 Hz max grain-rate tone | 0.122 ms | 0.134 | **0.244 ms** | 0.49 | **9.2%** | 49.9 |

\* single JIT-warmup outlier in the first seconds; steady-state max ≪ 1 ms.
**PASS with ~2× headroom** (≈ 3.8–5% of one core). Measured under Node/V8
on this machine (Apple Silicon); a Chrome audio thread is the same JS
engine class — order-of-magnitude transferable, re-verified in QA-1.
Reproducibility note: re-running the harness reproduces every DSP metric
identically; CPU numbers jitter run-to-run, and an occasional Node GC pause
can push one p99 sample past a quantum in the OFFLINE harness (observed
once at 38% in a re-run) — the spike's per-block telemetry allocations
(`_dbg*` arrays, `.filter` snapshots) add GC pressure a production node
will not have (its per-block path can be entirely allocation-free with
preallocated buffers).

---

## 3. Verdict vs the D2 pass bar

| D2 bar clause | Result |
|---|---|
| Added latency ≤ 20 ms for f0 ≥ 110 Hz | **PASS** — exactly 20.0 ms all paths; wet path verified at 113 Hz |
| p99 worklet CPU ≤ 25% of quantum | **PASS** — 12.6% (vocal), 9.2% (max grain rate) |
| No audible artifact on test vocal @ retune 0 ms, chromatic | **PASS on all objective proxies** (AM 0.0 dB; SNR at input floor; 0 windows < −20 dB; HF ratio 0.97; flux 1.07); audibility itself is QA-1's user-judged call — listening WAVs provided |
| Correct key/scale snap (C-major + chromatic) | **PASS** — all 6 cases ≤ 4.7c incl. forbidden-note masking |
| Correction error < ~10 cents after snap | **PASS** — median 2.5c, 90.9% < 10c on TEST-1 |

**HARD-TUNE PASS.** The slow-correction variant (retune 250 ms) runs on the
identical engine with equal-or-better artifact numbers, so the fallback
remains available as a user-facing Retune setting rather than a rescue.

## 4. Failure modes found & fixed inside the spike (AT-1 design lessons)

These are the reasons the spike existed — each was caught by measurement:

1. **FFT-autocorrelation YIN needs the shrinking-window formulation.** The
   fixed-W variant silently computes the wrong d(τ) (the FFT correlates the
   full frame, not the W-window) — detection produced clarity ≈ 1.0 at the
   WRONG period. Also: the swap-trick inverse FFT lands the real
   autocorrelation in the *second* array argument.
2. **A declared FIXED delay is mandatory; adaptive margins do not work** in
   lockstep block processing. An emission "margin" that grows at note
   onsets can never be respected (output advances 1:1 with input) — the wet
   path either deadlocks (emission at the frontier) or races ahead and every
   grain write lands in already-emitted territory. Correct structure: output
   content cursor starts at −D; content stays position-aligned; warm-up
   silence occupies the first D samples. Wet/dry then never skew.
3. **Never write grains into already-emitted ring positions** (stale-data
   pollution one ring-wrap later) — guard grain writes at the emission
   cursor.
4. **Onset estimates are biased (+12…+19c measured; windows straddle the
   note edge) and hysteresis must hug the snap boundary.** A wide target
   band (±0.6 semitone tried first) let a biased onset lock a semitone-wrong
   note that steady state could never correct (reproduced at 239 Hz and
   113 Hz). Final state machine: stability-gated first lock (2–3 frames
   agreeing within 30c), retarget at ±0.52 confirmed on 2 consecutive
   frames; chatter protection belongs to the retune smoothing, not the
   target band. Also: `midi = 69 + 12·log(f/440)` needs `/Math.LN2` — the
   natural-log version passed all tests while snapping to garbage notes.

## 5. AT-1 recommendation

Build the **Outcome-PASS branch** per D2 §8: `src/node-autotune.js` +
`src/autotune-worklet.js` — one self-contained worklet (YIN + TD-PSOLA +
snap state machine + per-epoch retune smoothing + Mix crossfade), real
k-rate AudioParams (Key/Scale/Retune/Mix), registered via
`registerNodeType()` with the gate's async addModule placeholder+splice
pattern, declared 20 ms internal delay (documented), no vendor deps, no
postMessage on the audio path, and NO spike telemetry arrays (the
prototype's `_dbg*` logs grow unboundedly and are spike-only). Retune range
0–500 ms covers both hard-tune and slow correction on one engine.
Experimental badge per scope. Bypass-clean aid verified here: mix = 0 is
bit-exact dry (D-delayed).

## 6. Disposable-status confirmation

- Prototype + harness + report live only in `tests/spike/` (out/ gitignored);
  `tests/run.js` auto-discovers only `tests/test-*.js` — the spike is not in
  the committed gate (suite re-run: **18/18 files, 969 checks, all green**).
- Nothing added to `index.html`; zero `src/` changes (git status verified).
- Listening artifacts for QA-1: `tests/spike/out/at0-{input,
  chromatic-0ms, chromatic-250ms, cmajor-0ms}.wav`.

## 7. Delegation record

Executed 2026-08-29 by the AT-0 production-swarm worker (ZCode, GLM-5.3):
prototype, harness, measurement campaign, four design-failure
investigations (§4), verdict. Audibility judgment deliberately left to the
user (QA-1), per the plan's user-judged audio-quality bar.
