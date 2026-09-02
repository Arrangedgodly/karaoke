// Tremolo node — Tone.js-backed, registered through the adapter.
//
// One ToneAdapter.register() call, same pattern as src/node-pitchshift.js
// (see that file's header for the full shape — adapter performs both
// registry registrations, wraps in the AE-7 composite, shares the app's
// AudioContext, generates applyParam from the `set` helpers).
//
// DSP: Tone.Tremolo — stereo amplitude modulation, L/R LFOs
// phase-opposed (spread 180°), sine type. The same anti-correlated-voices
// reasoning as the native chorus (src/node-chorus.js D4): mono-summed
// playback keeps near-constant energy instead of pumping. The LFO must be
// started explicitly — create() owns that, so a live instance always
// modulates.
//
// Params (the public contract):
//   - rateHz: 0.1..14 Hz, default 5 — the modulation speed (below ~1 Hz
//     it reads as a slow swell; 5-8 Hz is the classic vocal shudder).
//     Ramps Tone's `frequency` Signal.
//   - depth: 0..100 %, default 50 — how far the amplitude dips.
//     Ramps Tone's `depth` Signal (normalRange 0..1 internally, so the
//     setter divides by 100 — the UI/MCP/preset surface stays whole-number
//     percent, matching every other mix-style param in the app).

(function () {
  'use strict';

  window.ToneAdapter.register('tremolo', {
    label: 'Tremolo',
    // wayfinder #46 — see docs/ultron/research/plain-effect-labels.md
    plainLabel: 'Adds a volume wobble',
    paramSpec: [
      {
        id: 'rateHz',
        label: 'Rate',
        min: 0.1,
        max: 14,
        default: 5,
        step: 0.1,
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
        default: 50,
        step: 1,
        unit: '%',
        set: function (toneNode, value) {
          window.ToneAdapter.rampParam(toneNode.depth, value / 100);
        }
      }
    ],
    create: function (audioContext, p) {
      var node = new window.Tone.Tremolo({
        frequency: p.rateHz,
        depth: p.depth / 100,
        spread: 180
      });
      node.start();
      return node;
    }
  });
})();
