# RQ-3 — Loudness-safety clamp policy

Question: clamp/validation policy for agent-driven chain mutations. Blocks
MC-4. Status: **committed recommendation**. Researcher: subagent, 2026-08-27;
spec facts verified against Web Audio API spec/MDN; live-sound practice
labeled. Full table in this file is the implementation source.

## Why a policy layer must exist

- `GainNode.gain` unbounded (±3.4e38); `BiquadFilterNode.gain` max ≈
  **+1541 dB** (spec §1.13/§1.20) — engine clamps only nominal-range params.
- DynamicsCompressor makeup is **static gain on all signal**, UA-variable
  (soft-knee curve is UA choice): threshold −12/ratio 20 ⇒ ≈ +6.8 dB;
  threshold −24 ⇒ ≈ +13.7 dB (hard-knee bound, spec formula §1.19.4). The
  cycle-1 "slightly above 0dBFS" limitation is this.
- Feedback cycles are legal Web Audio (DelayNode mandatory in cycle, min
  loop delay 128 samples ≈ 2.7 ms) — runaway is gradual and inevitable at
  loop gain ≥ 1. No engine protection.

## Policy summary (full per-param table below)

Two-tier: **reject** = structured error, nothing applied (wrong model/
intent: structural violations, gain-budget overrun, EQ boost > +9 dB,
delay feedback > 0.7, host-owned writes, negative gain). **Clamp** = apply
saturated value, disclose in result + UI note (legible intent, benign:
Q, times, frequencies, knee, mixes, delayTime).

Chain rules: total direct-path gain budget **+12 dB** (incl. *estimated*
makeup); ≤6 gain-type nodes; ≤6 EQ bands, boost sum ≤ +12 dB, one band
≥ +6 dB max; **compound-loop guard** (feedback ≥ 0.55 AND boost sum ≥ +6 dB
→ reject); **limiter REQUIRED and terminal** (agent may only add upstream;
removal/bypass/reorder = hard reject); ≤2 compressor-type nodes (each adds
fixed ~6 ms look-ahead — disclose); all writes via host ramps (10–20 ms).
Total node cap 16.

**Host-owned output attenuator** (new persistent GainNode after limiter,
no agent tool can address): default ceiling **−6 dBFS**, absolute
never-exceed −3 dBFS; UI shows "Safe output: ON, ceiling −6 dBFS". Rationale:
limiter makeup + 1–3 ms attack overshoot + intersample peaks ≈ up to +3–4 dB
above threshold setting.

**Runtime watchdog** (independent of static validation): output AnalyserNode
(shared with meters per RQ-4); peak > ceiling +0.5 dB sustained >250 ms or
monotonic band-energy rise ~1 s → force master gain 0, UI alert, agent-visible
error; human restores (no auto-recover).

Error strategy: reject with `{error, node, role, param, requested, allowed,
applied, reason, suggestion, rule_id}` — include **remaining budget numbers**
for cumulative constraints; successes return applied state diff + telemetry
(meter reduction, output peak) so the agent observes consequences.

## Per-node table (validation range → treatment)

| Node/param | Nominal (default) | Agent range | Reject/Clamp |
|---|---|---|---|
| Gain (direct) `.gain` | unbounded (1.0) | [0, 4.0] (+12 dB), no negatives | reject |
| Gain (send/wet/feedback) | same | [0, 1.0] | reject |
| Comp `threshold` | [−100,0] (−24) | [−40, −8] dB | reject |
| Comp `knee` | [0,40] (30) | [0, 30] dB | clamp |
| Comp `ratio` | [1,20] (12) | [1.5, 12] | clamp |
| Comp `attack` | [0,1] (0.003) | [0.001, 0.1] s | clamp |
| Comp `release` | [0,1] (0.25) | [0.02, 0.5] s | clamp |
| Comp `reduction` | read-only | writes rejected | — |
| EQ `frequency` | [0,Nyq] | shelves [40,12k]; peak [100,8k] | clamp |
| EQ `Q` (peaking) | ~unbounded (1) | [0.5, 6] | clamp |
| EQ `gain` | ~[−3.4e38,+1541] | cuts [−24,0]; boost (0,+9] | cuts clamp; **boost >+9 reject** |
| Delay `delayTime` | [0, maxDelay] (maxDelay=2) | [0.02, 0.75] s | clamp |
| Delay feedback gain | GainNode | [0, 0.70] | **reject >0.70** (node hard-cap 0.85) |
| Delay wet/dry | GainNodes | each [0,1]; wet+dry ≤1.5 | clamp |
| Reverb wet/dry/out | GainNodes | [0,1] each; sends sum ≤1.2 | clamp |
| Reverb `normalize`/`buffer` | true / AudioBuffer | **host-owned, reject writes** | — |
| Limiter `threshold` | [−100,0] | [−12, −3] dB | reject |
| Limiter `ratio` | [1,20] | locked 20 | — |
| Limiter `attack` | [0,1] | locked 0.001–0.003 s | — |
| Limiter `release` | [0,1] | [0.05, 0.3] s | clamp |
| Limiter structure | — | no remove/bypass/reorder/post-position | **hard reject** |

## Tradeoffs / rejected alternatives

Stricter (−10 dBFS, +6 dB, fb ≤0.5, cut-only): starves quiet mics → humans
raise OS/PA gain outside policy view — worse. Freer (−3 dBFS, +18 dB, fb
0.85): consumes proven overshoot margin. True-peak worklet limiter: deferred
(latency/CPU). Trust DynamicsCompressor alone: rejected (spec-mandated
makeup). Clamp-everything: rejected (silent structural saturation = false
chain model).

## Confidence

High (spec/MDN, fetched 2026-08-27): ranges, clamping, reduction read-only,
~6 ms look-ahead, cycle rules, normalize default, ramp requirement. Medium:
makeup magnitudes (±few dB by browser), −6 dBFS number, 0.7, +12 dB
(conservative). Live-test-only: room gain-before-feedback, real overshoot
distribution, watchdog thresholds vs false positives, 2nd-compressor
audibility.

## Evidence

https://webaudio.github.io/web-audio-api/ (§1.6.3, §1.13, §1.17.2, §1.18,
§1.19.4, §1.20, cycle algorithm) · MDN DynamicsCompressorNode / DelayNode /
GainNode / BiquadFilterNode — fetched 2026-08-27.

## Plan consequences

MC-4 implements this table + host attenuator + serialization; watchdog lands
with FEW-3 meters (shares the OUT analyser); agent-chains require limiter
(get_capabilities content in MC-3 states this so agents pre-comply).
Architecture note: one new persistent host-owned GainNode post-limiter —
cycle-1 graph change, covered inside MC-4.
