// Phaser node — Tone.js-backed, registered through the adapter.
//
// One ToneAdapter.register() call, same pattern as src/node-pitchshift.js
// (see that file's header for the full shape).
//
// DSP: Tone.Phaser — 10-stage stereo allpass bank (L/R LFOs 180° apart,
// Tuna.js topology), the LFO sweeping every allpass's center frequency
// from baseFrequency up over `octaves`. Notch sweeps through the vocal's
// formants read as "spacey", "underwater", "dreamy" — the guide's words.
//
// Param mapping note (the one place this file deviates from pure param
// pass-through): Tone's sweep WIDTH is `octaves` (a plain setter —
// reconfigures the LFO's max), which is not a percent and not rampable.
// The public contract exposes depth 0..100 % and maps it internally to
// octaves 1 + depth/100 × 4 (so 0 % = a gentle 1-octave shimmer even at
// minimum — a true 0-octave phaser is a no-op filter bank, pointless to
// promise). baseFrequency and frequency (rate) map directly. Assigning
// octaves/baseFrequency rescales the LFO output instantly rather than
// ramping — acceptable here because the sweep itself is continuous and
// the affected frequencies move through the sweep within a cycle either
// way (rq4's chorus block-quantization argument, same shape).
//
// Params (the public contract):
//   - rateHz: 0.05..8 Hz, default 0.5 (slow sweep). Ramps `frequency`.
//   - depth: 0..100 %, default 60 → octaves 1..5 (see above).
//   - baseHz: 50..1500 Hz, default 350 — the bottom of the sweep
//     (lower = thicker/darker sweep).

(function () {
  'use strict';

  window.ToneAdapter.register('phaser', {
    label: 'Phaser',
    paramSpec: [
      {
        id: 'rateHz',
        label: 'Rate',
        min: 0.05,
        max: 8,
        default: 0.5,
        step: 0.05,
        unit: 'Hz',
        set: function (toneNode, value) {
          window.ToneAdapter.rampParam(toneNode.frequency, value);
        }
      },
      {
        id: 'depth',
        label: 'Depth',
        min: 0,
        max: 100,
        default: 60,
        step: 1,
        unit: '%',
        set: function (toneNode, value) {
          toneNode.octaves = 1 + (value / 100) * 4;
        }
      },
      {
        id: 'baseHz',
        label: 'Base',
        min: 50,
        max: 1500,
        default: 350,
        step: 10,
        unit: 'Hz',
        set: function (toneNode, value) {
          toneNode.baseFrequency = value;
        }
      }
    ],
    create: function (audioContext, p) {
      var node = new window.Tone.Phaser({
        frequency: p.rateHz,
        octaves: 1 + (p.depth / 100) * 4,
        baseFrequency: p.baseHz
      });
      return node;
    }
  });
})();
