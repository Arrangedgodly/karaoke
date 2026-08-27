# PX-2 — Per-Node Parameter UX Spec

Covers plan.md task PX-2. Feeds AE-5–AE-10 (native Web Audio param mapping) and UI-4 (generic parameter control component). Every default below is chosen so the node sounds reasonable **untouched** — a host who adds a node and doesn't tune it shouldn't make the mix worse.

Each parameter is specified as `{id, label, min, max, default, step, unit}` — UI-4 renders one control per entry from this shape; it doesn't need per-node-type UI code.

## Gain / Trim

Native node: `GainNode`. **Note for AE-5: `GainNode.gain.value` is linear amplitude, not dB** — convert with `linear = 10^(dB/20)` when writing the UI's dB value to the AudioParam.

| id | label | min | max | default | step | unit |
|---|---|---|---|---|---|---|
| `gainDb` | Gain | -24 | +24 | 0 | 0.5 | dB |

Default 0dB = unity gain = fully transparent when first added.

## Compressor

Native node: `DynamicsCompressorNode`. Knee is fixed internally at the node's own spec default (30dB, soft knee) and not exposed — keeps the control surface approachable for a non-technical host tuning by ear mid-event.

| id | label | min | max | default | step | unit |
|---|---|---|---|---|---|---|
| `threshold` | Threshold | -60 | 0 | -24 | 1 | dB |
| `ratio` | Ratio | 1 | 20 | 4 | 0.5 | :1 |
| `attack` | Attack | 0 | 1 | 0.01 | 0.001 | s |
| `release` | Release | 0 | 1 | 0.25 | 0.01 | s |

Default (-24dB threshold, 4:1 ratio, 10ms attack, 250ms release) is a gentle, musical vocal-bus compression setting — noticeably tighter and more consistent than raw mic level, without pumping or obviously squashing transients. Threshold/release match `DynamicsCompressorNode`'s own spec defaults; ratio is deliberately lower than the node's native 12:1 default (12:1 reads as limiting, not compression, for an untouched vocal-bus setting) and attack is slowed from the native 3ms to 10ms so vocal consonant transients aren't clipped of their punch.

## EQ

Native nodes: three chained `BiquadFilterNode`s — low-shelf, mid-peaking, high-shelf. Frequencies and Q are fixed internally (not exposed) to keep this a simple 3-slider "tone" control rather than a full parametric EQ:

- Low shelf: frequency fixed 200Hz
- Mid peaking: frequency fixed 1000Hz, Q fixed 1.0
- High shelf: frequency fixed 5000Hz

| id | label | min | max | default | step | unit |
|---|---|---|---|---|---|---|
| `lowGain` | Low | -12 | +12 | 0 | 0.5 | dB |
| `midGain` | Mid | -12 | +12 | 0 | 0.5 | dB |
| `highGain` | High | -12 | +12 | 0 | 0.5 | dB |

All defaults 0dB — flat response, fully transparent untouched (trivially satisfies "sounds reasonable untouched" since it does nothing until adjusted).

## Delay

Native nodes: `DelayNode` + a feedback `GainNode` loop + a wet/dry mix (two `GainNode`s or an `AudioParam`-automated crossfade). **Feedback is capped at 90%, not 100%, to guarantee the loop can't run away even at the max UI setting** (ties to AE-8's "no runaway feedback at max settings" acceptance criterion).

| id | label | min | max | default | step | unit |
|---|---|---|---|---|---|---|
| `timeMs` | Time | 10 | 1000 | 300 | 10 | ms |
| `feedback` | Feedback | 0 | 90 | 25 | 1 | % |
| `mix` | Mix | 0 | 100 | 25 | 1 | % |

Default (300ms, 25% feedback, 25% mix) is a classic slap/echo delay — a few audibly-decaying repeats blended subtly under the dry vocal, in the tradition of karaoke-machine echo effects, without washing out the voice.

**Implementation note for AE-8:** the UI's max Time (1000ms) exactly matches `DelayNode`'s spec default `maxDelayTime` of 1.0s — construct the node explicitly with `maxDelayTime: 1.0` (or higher, with the UI range capped to 1000ms regardless) rather than relying on an unspecified default, since `maxDelayTime` must be fixed at construction time and can't be changed later.

## Reverb

Native node: `ConvolverNode`, loaded with the committed impulse response (RQ-3: "IR Rollo Transparent Plate.wav", CC0). Only a wet/dry mix is exposed — the IR itself defines the reverb character for Core MVP (multiple reverb characters is a Fast-Follow-scale feature, not in scope here).

| id | label | min | max | default | step | unit |
|---|---|---|---|---|---|---|
| `mix` | Mix | 0 | 100 | 20 | 1 | % |

Default 20% keeps the reverb present and flattering without drowning the vocal — appropriate for the bundled plate character.

## Limiter

Native node: a second `DynamicsCompressorNode`, configured as a safety limiter, not a musical effect. **Ratio is fixed internally at 20:1 (the node's max) and attack fixed at the minimum the node allows (~0ms) — neither is exposed**, since this node's job is "catch spikes," not "be tuned by ear."

| id | label | min | max | default | step | unit |
|---|---|---|---|---|---|---|
| `ceiling` | Ceiling | -12 | 0 | -1 | 0.5 | dB |
| `release` | Release | 10 | 500 | 50 | 10 | ms |

Default (-1dB ceiling, 50ms release) is a standard "just under full scale" safety ceiling with a fast-enough release to recover between peaks without audibly pumping — directly serves AE-10's "effectively prevents clipping/spikes under hot input signals" acceptance criterion.

## Cross-node notes for AE-5–AE-10 and UI-4

- All dB-denominated `AudioParam`s that are natively linear (`GainNode.gain`, the wet/dry mix `GainNode`s) need dB↔linear conversion at the factory layer — UI-4 always displays/edits the dB or % value; the factory converts when writing to the actual `AudioParam`.
- Every "Mix"/"Feedback" percentage should be implemented as an equal-power (not linear) crossfade between wet and dry signal paths, standard practice to avoid a perceived volume dip at the 50% mark.
- Every default above was chosen to be safe and pleasant on live vocal input specifically — not necessarily ideal for other program material, which is fine since this app is scoped to vocal processing only.

## Decision priority/status

Design decision, not a research question — informed by standard audio-engineering practice and the native `DynamicsCompressorNode` spec defaults where applicable. No blocking uncertainty; flag to the user for a quick sanity listen once AE-5–AE-10 are built, per each factory task's own acceptance criteria.
