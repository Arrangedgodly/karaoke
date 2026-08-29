# QA-4 — Latency Measurement & Documentation

Covers plan.md acceptance criterion #6 and task QA-4: "A real, honest latency number is recorded and shared, ideally measured on the actual laptop/interface used at events." **Not gated** — this task's own acceptance bar is documentation, not a pass/fail threshold.

Executed 2026-08-27 against the app as built through QA-3, in Chrome on this development machine.

## The real gap, stated up front

The acceptance criterion's own preference — "ideally measured on the actual laptop/interface used at events" — cannot be fully satisfied here. A true mic-in-to-speaker-out round trip requires a real microphone physically capturing real speaker output in the same room; this dev environment has no physical audio hardware at all (every prior test in this project, including this one, uses a synthetic `getUserMedia` mock). What follows is the most honest number obtainable without that hardware, plus a concrete, simple way for the user or their brother to get the real number later on the actual event setup.

## What was measured

### 1. Browser-reported context latency (real numbers, not estimated)

Read directly from a live `AudioContext` after a real `Start`:

| Property | Value |
|---|---|
| `audioContext.sampleRate` | 44,100 Hz |
| `audioContext.baseLatency` | **10 ms** |
| `audioContext.outputLatency` | **40 ms** (feature-detected per RQ-4's guidance — supported here) |

These are Chrome's own reported figures for this machine's audio output path (driver + OS buffer configuration). They are real, but machine/interface-dependent — the actual event laptop's audio driver and output device (built-in speakers vs. a USB interface vs. Bluetooth) will very likely report different numbers. This is exactly the kind of value QA-4 asks to be re-checked on the real hardware.

### 2. Empirically measured latency added by the app's own effect chain

Since the true acoustic path can't be measured here, the next most useful honest question is: **does this app's own code (the 6-node effect graph, the glitch-free reconnect engine) add meaningful latency on top of whatever the browser/OS/hardware stack already costs?** This was measured directly, not estimated:

**Method:** a single-sample-wide impulse (an `AudioBufferSourceNode`, precisely scheduled via `audioContext.currentTime`-based sample-accurate `.start()`) was injected at the chain's real input point, and a diagnostic `ScriptProcessorNode` tap (connected in parallel off `AudioGraph.getChainGate()` — a one-off measurement tool, not part of the shipped app, which correctly still uses `AudioWorkletNode`-free native nodes throughout) scanned raw output samples for the impulse's arrival, computing latency from `audioContext.currentTime`-based scheduling versus the tap's `playbackTime` at the detected sample. The Delay node's mix was set to 0% first, so its deliberate 300ms creative effect (a user-controlled setting, not unwanted latency) wouldn't be counted.

| Configuration | Measured round-trip (injection point → chain gate output) |
|---|---|
| Empty chain (pure passthrough, isolates this measurement technique's own floor) | 46.4 ms |
| Full default 6-node chain (Gain → Compressor → EQ → Delay [0% mix] → Reverb → Limiter) | 58.4 ms |
| **Latency added by the app's own 6-node effect chain** | **≈ 12 ms** |

The 46.4ms baseline is itself dominated by the diagnostic tap's own 1024-sample `ScriptProcessorNode` buffer (≈23ms at 44.1kHz, chosen for reliable detection in this one-off script, not representative of anything in the shipped app) plus the same `baseLatency`/`outputLatency` budget measured in part 1 — it is not a claim that the app itself has 46ms of built-in latency. The robust, meaningful number here is the **difference**: routing a signal through all 6 Core MVP effect nodes costs roughly **12ms** on top of whatever the browser/OS/hardware stack already costs. That's a small, real number — the app's own processing is not the dominant contributor to whatever total latency a host actually perceives.

## Honest total-latency picture

Real end-to-end mic-to-speaker latency at an actual event = (mic hardware capture: ADC + driver buffer, **not measured here, hardware-dependent**) + (`AudioContext` base/output latency: **measured here as ~10-40ms on this machine, but will differ on the real event laptop/interface**) + (this app's own processing: **measured here as ~12ms, and this part is expected to be stable across machines since it's pure software**) + (speaker/output hardware latency, **not measured here, hardware-dependent**).

The two components genuinely tied to *this app's code* are now real, measured numbers, not guesses. The two components tied to *physical hardware* remain unmeasured and are the ones actually worth checking on the real event laptop.

## Recommended real-world test (for the user or their brother, on actual event hardware)

A simple, no-special-equipment way to get the true acoustic round-trip number: play a short, sharp sound into the mic (a clap, a finger-snap) while recording both the room and the PA output on a phone in **slow-motion video** mode (most phones support 120-240fps). Count the video frames between the visible clap and the audible clap through the speakers in the recording; divide by the frame rate for a millisecond figure. This captures the *entire* real path (mic hardware, this app, speaker hardware) in one honest number, and takes under five minutes to run once at the actual venue with the actual gear.

## Conclusion

This app's own code adds a small, now-measured ~12ms of processing latency across the full 6-node effect chain — not a meaningful contributor to whatever total latency exists. The browser's own reported `baseLatency`/`outputLatency` (10ms/40ms here) give a real, non-fabricated data point, but are specific to this development machine's audio stack, not the event laptop. Per this task's own "documented, not gated" acceptance bar, this is recorded as the honest, currently-available answer, with a concrete, low-effort real-world test recommended above to close the remaining hardware-dependent gap whenever convenient.

## What still needs a human

The acoustic round-trip test above requires a physical mic, physical speakers, and a phone — none of which are available in this environment. This is the one clearly actionable follow-up from this task: a five-minute test at the actual event setup (or even just at home with the same laptop/interface/speakers) would give the real number this task's acceptance criterion ultimately wants.
