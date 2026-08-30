# RQ-4: Chorus topology for Depth/Rate/Mix on the vocal FX bus

- **Research question:** Which chorus topology best fits Depth/Rate/Mix on the mono vocal bus inside the existing node contract — (A) single LFO-modulated DelayNode, (B) multi-tap (2–3 delayed voices, phase-offset LFOs), or (C) stereo-spreading variants (ping-pong / L/R phase-offset)?
- **Task informed:** CHOR-1 (`src/node-chorus.js`, registered via `registerNodeType()` in `src/audio-graph.js`)
- **Date:** 2026-08-29
- **Decision priority:** P1 (blocks CHOR-1 implementation)
- **Status:** DECIDED — Option C-lite: 2-voice, L/R phase-opposed chorus (Option B's two-voice subset, stereo-placed)

## Constraints / criteria

1. **Node contract:** composite factory returning `{input, output}` (same as `node-delay.js` / `node-reverb.js`); params applied via `NodeTypes.register(type, {label, paramSpec, applyParam})` with `AudioParamRamp.schedule()` for live updates (Issue #5 click-safety pattern).
2. **Bus channel count (verified in code):** `src/audio-engine.js:279` creates the source via `createMediaStreamSource(mediaStream)` — a mono getUserMedia mic track. No `channelCount` overrides anywhere in `src/audio-graph.js` (grep confirms zero hits); Web Audio's default counting (channelCount=2, interpretation "speakers") up-mixes the mono mic to **dual-mono stereo** inside every GainNode/DelayNode and at `audioContext.destination`. So the bus is *mono-content, stereo-capable*: a stereo-placing wet path works with no bus changes, but pure mono-summed voices would collapse the effect.
3. **Native-only preference:** project has exactly one worklet (`watchdog-worklet.js`, non-audio). Chorus must be DelayNode/OscillatorNode/GainNode (+ optionally StereoPannerNode) natives.
4. **Artifact criteria:** avoid excess pitch wobble (warble), avoid comb/cancellation when the chain is later mono-summed (bypass dry tap and destination are stereo, but YouTube-playback karaoke contexts often end mono), keep node count small (chain rebuilt by `buildGraph()`; per-node cost matters for reuse/teardown).
5. Chrome-only: no cross-browser `delayTime`-modulation differences to hedge.

## Options considered

- **A. Single LFO-modulated DelayNode** — 1 delay, 1 sine LFO → delayTime (via a GainNode scaling osc output into the a-rate param, summed with a constant baseline offset). Cheapest (~5 natives) but classic single-voice chorus: periodic pitch wobble is maximally audible on exposed solo vocal, and effect collapses toward flanger-comb if excursion is mistuned.
- **B. Multi-tap 2–3 voices, phase-offset LFOs** — N delays, N LFOs at phase offsets (e.g. 0°, 120°, 240° or 0°/180°), summed mono. Denser, smoother than A; each voice's excursion averages out. But summed in mono the voices can momentarily align → time-varying comb coloration; 3 voices ≈ 12+ natives for marginal gain over 2.
- **C. Stereo-spreading (L/R phase-opposed; ping-pong)** — 2 delays, LFOs at 180° phase offset, each voice panned hard L/R via `StereoPannerNode` (native, Chrome since 42). Two benefits: phase opposition means the two voices' delay trajectories are anti-correlated, so **mono-summing the output yields near-constant total energy and reduced comb cancellation** (while one voice's delay rises the other falls), and the stereo bus (verified criterion 2) gets real width instead of dual-mono. Ping-pong (cross-feedback) adds feedback-loop stability concerns for no vocal benefit — rejected.

## Recommendation + rationale

**2-voice L/R phase-opposed chorus (Option C without ping-pong feedback).**

- Fits the verified bus: source is mono, but the graph renders stereo to `destination` with no overrides, so panned wet voices produce genuine stereo width "for free" — the most improvement per node.
- Phase-opposed voices double the perceived richness while keeping the anti-correlation that protects the mono sum — important because `audio-bypass.js` sums a dry tap and downstream playback may be mono.
- All natives: 2× `createDelay(0.06)`, 2× `createOscillator` (sine, started at construction), 2× depth-scaling `GainNode` (osc → ±depth, sign flipped for the second voice via negative gain), 2× baseline-offset `GainNode`/`ConstantSourceNode`-free constant write, 2× `StereoPannerNode`, plus the standard `inputGain`, `dryGain`/`wetGain` equal-power pair, `outputSum` — ≈ **12 native nodes, no worklet**. (Constant baseline can also be folded by writing `delayTime.value = baseline` once and letting the LFO GainNode sum into the a-rate param — audio-rate sums into AudioParam are spec-legal.)
- `delayTime` is an **a-rate** AudioParam, so audio-rate modulation via a connected OscillatorNode is legal and standard; the spec/MDN caveat is that Chrome samples `delayTime` **once per 128-frame render quantum** and smooths transitions — at chorus Rates (0.1–8 Hz) the modulation is so slow relative to the 2.9 ms block that block quantization is inaudible (a 5 Hz LFO at chorus depths moves delay ≪ 128-sample granularity per block). The caveat only bites for per-sample-accurate flanging/vibrato at audio-rate mod frequencies, which this is not.

## Evidence (primary sources)

| Claim | Source | Date/version |
|---|---|---|
| `delayTime` is an a-rate AudioParam; legal to modulate from another AudioNode; sampled once per 128-frame render quantum (block-quantized, smoothed) | MDN DelayNode, https://developer.mozilla.org/en-US/docs/Web/API/DelayNode | accessed 2026-08-29 |
| Render quantum = 128 frames (~2.9 ms @ 44.1 kHz); delayTime transition must be click-free/smoothed | W3C Web Audio API 1.1, https://www.w3.org/TR/webaudio/1.1/ | accessed 2026-08-29 |
| Per-sample delay modulation under-specified → workarounds only needed for flanger/vibrato-class effects, not slow chorus LFOs | WebAudio/web-audio-api issue #457, https://github.com/WebAudio/web-audio-api/issues/457 | accessed 2026-08-29 |
| Base delay must exceed max LFO excursion so modulated delay never reaches 0 (reaches-0 → zipper/glitch); classic baseline 20–30 ms | r/DSP "Chorus Effect Depth Parameter", https://www.reddit.com/r/DSP/comments/ho3m0q/chorus_effect_depth_parameter/ | accessed 2026-08-29 |
| Concrete vocal-grade mapping example: chorus mid-delay 14 ms, Depth 1.0 → 14 ± 10 ms (4–24 ms) | DunneAudioKit "Modulated Delay Effects", https://www.audiokit.io/DunneAudioKit/documentation/dunneaudiokit/modulateddelayeffects | accessed 2026-08-29 |
| Multi-phase LFOs / phase-offset voices in classic BBD + Dimension-D-style designs; LFO shape and per-voice phase determine density and mono behavior | Electric Druid, https://electricdruid.net/investigations-into-what-a-bbd-chorus-unit-really-does/ | accessed 2026-08-29 |
| Multi-voice phase-offset stereo chorus as studio-standard (Tri-Stereo Chorus class units) | The Gear Page tri-stereo chorus thread, https://www.thegearpage.net/board/index.php?threads/tri-stereo-chorus-lets-get-nerdy.2601448/page-2 | accessed 2026-08-29 |
| Bus is mono mic up-mixed to stereo, no channel overrides; composite `{input, output}` contract and equal-power Mix precedent | Code: `src/audio-engine.js:279`, `src/audio-graph.js` (grep: no channelCount), `src/node-delay.js` (whole file pattern) | repo, current HEAD |

## Tradeoffs / risks / confidence

- **Risk:** Chrome's per-block `delayTime` sampling could theoretically zipper at extreme Depth×Rate; mitigated because chorus ranges keep d(delay)/dt far below one render quantum of change per block, and Chrome additionally smooths transitions. Residual risk low.
- **Risk:** negative-depth GainNode on voice 2 gives exact 180° phase opposition for sine LFOs — if a future triangle LFO shape is wanted, opposition must be exact per-sample (triangle phase-flip is fine too). Low.
- **Tradeoff:** 12 natives vs Option A's ~5; acceptable — `node-reverb.js` already builds comparably sized composites and `buildGraph()` teardown handles them.
- **Tradeoff vs 3-tap mono (B):** slightly less "thickness" but avoids mono-sum comb motion and gains real stereo width; on a solo vocal, 2 opposed voices are the standard studio vocal-chorus configuration.
- **Confidence: high** on topology and param legality (spec + MDN + DSP literature agree); **medium-high** on exact default param values (tuning by ear during CHOR-1 acceptance).

## Implementation consequences (graph sketch for `src/node-chorus.js`)

```
inputGain ──┬─ dryGain ──────────────────────────────┐ → outputSum → {output}
            │                                        │
            ├─ delayL(0.06s) ─ panL(-1) ─ wetGainL ──┤─ (wetGainL/R into wetGain? see note)
            └─ delayR(0.06s) ─ panR(+1) ─ wetGainR ──┘

lfo = OscillatorNode(sine, Rate Hz, started)
lfo → depthGainL (gain = +depthMs/1000) ──────→ delayL.delayTime  (baseline 25 ms written as .value)
lfo → depthGainR (gain = −depthMs/1000) ──────→ delayR.delayTime  (phase opposition via sign flip)
wetGainL/wetGainR → wetSum (GainNode, = equal-power wet coefficient) → outputSum
```

Simplest dry/wet consistent with node-delay.js: keep the existing `dryGain` + single `wetGain` pair fed by a `wetSum` GainNode that the two panned voices connect into (pan before wet sum keeps the equal-power crossfade identical to Delay's Mix implementation, `cos/sin(m·π/2)`).

- **Node count:** inputGain, 2×DelayNode, lfo OscillatorNode, 2×depth GainNodes, 2×StereoPanner, wetSum, dryGain, wetGain, outputSum = **12 native nodes, 0 worklets**.
- **Param ranges (paramSpec):**
  - `depthMs`: **0–10 ms, default 3 ms, step 0.5** (DunneAudioKit-style ±excursion around baseline; baseline fixed at 25 ms internally so min delay = 25−10 = 15 ms ≫ 0, satisfying the never-reach-zero rule with margin).
  - `rateHz`: **0.1–8 Hz, default 1.5 Hz, step 0.1** (typical vocal chorus 0.5–3 Hz; 8 Hz ceiling for special-effect warble).
  - `mix`: **0–100 %, default 30 %, step 1**, equal-power `cos/sin` exactly as `node-delay.js` lines 135–137.
- **applyParam writes:** `rateHz` → `AudioParamRamp.schedule(lfo.frequency, v)`; `depthMs` → ramp BOTH depthGainL.gain (+v/1000) and depthGainR.gain (−v/1000); `mix` → ramp dryGain/wetGain pair (identical to Delay's mix branch). Baseline delayTime is set once at construction and never param-driven.
- **No changes needed** in `audio-graph.js` (composite contract already supports this — same as delay/reverb), `node-types.js`, or any bus/channel code.

## Delegation record

- Researched by: RQ-4 deep-research track agent (ZCode), 2026-08-29.
- Code verification: `src/audio-engine.js` (mic source), `src/audio-graph.js` (buildGraph/registry/channel grep), `src/node-delay.js` (full composite pattern), `src/node-reverb.js` (composite size precedent).
- Web sources as tabled above; all accessed 2026-08-29.
- Consumed by: CHOR-1 implementer.
