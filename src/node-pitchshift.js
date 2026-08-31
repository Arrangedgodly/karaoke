// Pitch Shift node — Tone.js-backed, registered through the adapter.
//
// Loaded as a plain (non-module) <script>. Like the native node-*.js
// files, this file exports no `window.X` namespace of its own — its only
// job is ONE call: window.ToneAdapter.register('pitchshift', {...}) at
// load time. The adapter (src/tone-adapter.js) performs both registry
// registrations, wraps the Tone node in the AE-7 native composite
// ({input, output, tone, dispose}), points Tone at the app's
// AudioContext, and generates the applyParam dispatch from the `set`
// helpers on the paramSpec entries below.
//
// DSP: Tone.PitchShift — granular (dual crossfaded delay lines with
// ratio-tracked read heads). Semitone steps only (step 1), which suits
// karaoke transposition ("take it up 2 semitones") and the plain-language
// guide. Two honest caveats baked into the param choices:
//
//   - Granular shifting is NOT formant-preserving: large shifts change
//     the voice's character (the "chipmunk"/"deep" trade). ±12 st is the
//     full musical range; the guide keeps suggestions inside ±7.
//   - The engine adds latency (~windowSize) even at pitch 0 with Mix
//     100%. That is inherent to the effect class, not a defect; it is why
//     this type is EXPERIMENTAL until the ACCEPTANCE.md listening pass
//     signs off on it mid-chain.
//
// Params (the public contract — mcp-tools.js validates against these,
// presets persist them, the sound-design guide references them):
//   - pitch: semitones −12..12, integer steps, default 0 (no shift).
//     Tone's `pitch` is a plain setter (not a Param) — assigned directly.
//   - mix: 0..100 %, default 100 — ramps Tone's `wet` Param over the
//     house 15 ms.

(function () {
  'use strict';

  window.ToneAdapter.register('pitchshift', {
    label: 'Pitch Shift',
    experimental: true,
    paramSpec: [
      {
        id: 'pitch',
        label: 'Pitch',
        min: -12,
        max: 12,
        default: 0,
        step: 1,
        unit: 'st',
        set: function (toneNode, value) {
          toneNode.pitch = value;
        }
      },
      {
        id: 'mix',
        label: 'Mix',
        min: 0,
        max: 100,
        default: 100,
        step: 1,
        unit: '%',
        set: function (toneNode, value) {
          window.ToneAdapter.rampParam(toneNode.wet, value / 100);
        }
      }
    ],
    create: function (audioContext, p) {
      var node = new window.Tone.PitchShift({
        pitch: p.pitch,
        wet: p.mix / 100
      });
      return node;
    }
  });
})();
