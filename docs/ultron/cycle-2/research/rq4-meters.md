# RQ-4 — Meter implementation

Question: AnalyserNode vs AudioWorklet for MIC IN / OUT meters. Blocks
VIS-5/FEW-3. Status: **committed recommendation**. Researcher: subagent,
2026-08-27; verified against this repo's `src/audio-graph.js` /
`src/audio-engine.js` teardown code + spec/MDN.

## Decision: AnalyserNode pair, side-taps, one rAF loop, canvas render

**Tap points (codebase-verified):** IN analyser off `AudioEngine.sourceNode`;
OUT analyser off the persistent `chainGate` (`AudioGraph.getChainGate()`).
Created once per session, outside `buildGraph()`. Verified decisive fact:
rebuild teardown severs only `sourceNode→firstChainNode` and blanket-
disconnects chain nodes; `chainGate` and other `sourceNode` taps survive
(the AudioBypass dry tap already relies on this) → **meters survive every
chain mutation with zero re-tap/leak/orphan risk**. Re-tap only on
`switchInputDevice()` or context recreation.

Why not AudioWorklet: same topology equally safe, but adds async
`addModule` boot, a second static file, MessagePort lifecycle (`port.close()`
discipline), `processorerror` permanent-silence mode, and ~375 msgs/s
posting cost — for no blocking benefit. Worklet advantages (per-channel
peaks, hidden-tab clip latch) are retrofittable later behind the same
render interface.

## Verified API facts

- AnalyserNode is pass-through and works with output unconnected (MDN) —
  side-taps add no DSP and need no wiring onward.
- `getFloatTimeDomainData` (float, not byte — byte variant floor ≈ −42 dB):
  most recent `fftSize` frames; nominal −1..1 but **can exceed** on
  down-mix → clip math uses `>= 1.0`. Allocate exactly `fftSize` floats,
  reuse.
- `smoothingTimeConstant` applies to frequency data only — do not set;
  ballistics in JS.
- `fftSize` 2048 @ 48 kHz = 42.7 ms window > frame interval (16.7 ms) with
  margin for dropped frames to ~23 fps. Cost per frame per meter: one 8 KB
  copy + O(2048) pass ≈ microseconds; audio thread = native ring buffer,
  zero JS.
- Forced mono down-mix: per-channel peaks impossible with analyser
  (antiphase clip can hide in mono sum; limiter is the real protection —
  accepted advisory risk).
- rAF (not setInterval): paint-synced; freezes when tab hidden (accepted;
  clip-while-hidden invisible — documented limitation).

## Ballistics spec (IEC TR 60268-18 PPM family)

| Element | Spec |
|---|---|
| Scale | −60…0 dBFS linear; `20·log10(max(|v|,ε))` |
| Peak bar | attack ≤5 ms effective; **fall 12 dB/s** (IEC 20 dB/1.7 s) |
| RMS underlay | ~300 ms rectangular integration or 1-pole τ≈50 ms rise / 12 dB/s fall |
| Peak-hold tick | hold 1500 ms → fall 12 dB/s; higher peak restarts |
| Clip | latch on \|sample\| ≥1.0 for ≥3 consecutive samples; auto-clear 2000 ms; tick pinned red at 0 dB |
| Zones | green −60…−20 · amber −20…−6 · red −6…0 (per RQ-5 meter stops) |
| Loop | one shared rAF for both meters; dirty-check identical frames (120/144 Hz cheap) |
| A11y | canvas `role="meter"` + `aria-valuenow` updated few Hz; ballistics functional under `prefers-reduced-motion` (decorative pulses only are disabled) |

Rendering: **canvas**, one per meter (lamp segments + tick + zones in one
pass; no per-frame style recalc over hours-long soak).

## Evidence

Spec https://webaudio.github.io/web-audio-api/ (§AnalyserNode, Time-Domain
Down-Mixing, smoothing scope, AudioNode lifetime/worklet) · MDN AnalyserNode
/ getFloatTimeDomainData / fftSize / AudioWorkletNode / Visualizations /
requestAnimationFrame — fetched 2026-08-27 · IEC TR 60268-18:1995 via
Wikipedia PPM + EBU Tech 3341 cross-check · repo teardown code
(`src/audio-graph.js` L415–429, AE-3 comments L344–347).

## Confidence & verify-at-implementation

High: recommendation, API behavior, rebuild-resilience (read from code),
ballistics (standards). Verify: steady-state CPU in existing soak script;
actual sample rate vs window math; refresh rate; device-switch freeze UX
(decay-to-−∞ vs frozen); stereo/antiphase reality of OUT bus.
