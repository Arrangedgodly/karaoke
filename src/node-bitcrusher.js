// Bitcrusher node — Tone.js-backed, registered through the adapter.
//
// One ToneAdapter.register() call, same pattern as src/node-pitchshift.js
// (see that file's header for the full shape).
//
// DSP: Tone.BitCrusher — an AudioWorklet that quantizes the incoming
// signal to a lower bit depth. Lower bits = more quantization distortion:
// 8 is nearly clean, 4 is gritty, 1-2 is destroyed/apocalyptic. On a
// vocal this reads as "robotic telephone", "lo-fi", "intercom" — the
// plain-language guide maps those words onto the range below. Tone's
// worklet wiring is internal and asynchronous (unity passthrough until
// the worklet module loads); the adapter's synchronous factory contract
// is unaffected.
//
// Params (the public contract):
//   - bits: 1..8, integer steps, default 4. Tone's `bits` is a true
//     Param (k-rate through the worklet) and ramps cleanly — stepping 1
//     bit at a time with the 15 ms house ramp is inaudible as a click.
//     Tone accepts up to 16; this spec caps at 8 because above 8 the
//     quantization is below the output attenuator's noise floor —
//     promise nothing the DSP can't audibly keep.
//   - mix: 0..100 %, default 50 — dry/wet blend, ramps Tone's `wet`.

(function () {
  'use strict';

  window.ToneAdapter.register('bitcrusher', {
    label: 'Bitcrusher',
    // wayfinder #46 — see docs/ultron/research/plain-effect-labels.md
    plainLabel: 'Old video-game sound',
    paramSpec: [
      {
        id: 'bits',
        label: 'Bits',
        min: 1,
        max: 8,
        default: 4,
        step: 1,
        unit: 'bit',
        set: function (toneNode, value) {
          window.ToneAdapter.rampParam(toneNode.bits, value);
        }
      },
      {
        id: 'mix',
        label: 'Mix',
        min: 0,
        max: 100,
        default: 50,
        step: 1,
        unit: '%',
        set: function (toneNode, value) {
          window.ToneAdapter.rampParam(toneNode.wet, value / 100);
        }
      }
    ],
    create: function (audioContext, p) {
      var node = new window.Tone.BitCrusher({
        bits: p.bits
      });
      node.wet.value = p.mix / 100;
      return node;
    }
  });
})();
