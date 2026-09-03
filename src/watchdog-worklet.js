// AudioWorklet module — the audio-thread side of the issue #7 hidden-tab
// watchdog protection. NOT a <script> in index.html: this file is loaded
// BY URL from src/meter-taps.js via
// `audioContext.audioWorklet.addModule('src/watchdog-worklet.js')` (same
// page-relative path convention as every src/*.js script tag and the
// reverb IR fetch 'assets/ir/plate-vocal.mp3' — works unchanged on
// localhost:8000 and on GitHub Pages).
//
// Why a worklet at all: the watchdog's decisions previously lived in the
// ONE requestAnimationFrame loop, and browsers throttle/stop rAF when
// the tab is hidden while native Web Audio processing continues — the
// watchdog went blind exactly when an unattended (backgrounded) karaoke
// rig could howl. This processor runs on the AUDIO THREAD, which never
// pauses for tab visibility: while hidden, the main thread still
// receives this processor's messages (postMessage delivery is not
// rAF-bound) and a lightweight setInterval latch (src/meter-taps.js)
// keeps making the trip decision.
//
// Division of labor (documented in src/meter-taps.js's header too):
//   - THIS FILE: peak across every channel and the strongest channel's
//     RMS of the final-output signal, posted to the main thread at a throttled
//     cadence (every POST_EVERY_BLOCKS blocks ≈ 21 ms @ 48 kHz) —
//     {type:'watchdog-block', peak, rms, blocks, t}. Detection decisions
//     stay main-thread (they must ramp AudioParams and touch the DOM).
//   - Passthrough: input[0] is copied to output[0] UNMODIFIED, so the
//     node is signal-transparent wherever it is tapped. In the app it is
//     wired as a SILENT side-tap (attenuator -> worklet -> zero-gain ->
//     destination): the copy keeps the processor honest/pullable while
//     the zero gain guarantees the destination never hears a duplicate
//     of the program. The analyserOut meter tap is untouched.
//   - Narrowband HOWL detection stays with analyserOut's FFT on the
//     main thread (needs bin resolution this 128-sample block processor
//     does not have); see meter-taps.js for the hidden-cadence howl bar.
//
// Zero dependencies, no build step, ES module scope (AudioWorklet
// modules are loaded as modules — `class`/`const` are fine here even
// though the rest of src/ is ES5 IIFE style).
'use strict';

// 128-sample render quantums; post every 8 => ~1024 samples (~21 ms at
// 48 kHz, ~22 ms at 44.1 kHz) per message. Generous vs the 250 ms peak
// sustain window and sparse enough to cost nothing on the main thread.
const POST_EVERY_BLOCKS = 8;

class WatchdogTapProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._peak = 0; // max |sample| since the last post
    this._sumSq = []; // per-channel sums of squares since the last post
    this._n = 0; // elapsed samples per channel since the last post
    this._blocksSincePost = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    // Count elapsed frames once, including an absent input or a channel
    // disappearing during a reporting window (its remaining samples are
    // silence). Input and output render quanta have the same frame count.
    const frameChannel = input && input[0] ? input[0] : output && output[0];
    this._n += frameChannel ? frameChannel.length : 128;
    if (input && input.length > 0) {
      // Separate channel energy prevents cancellation and dilution by a
      // silent interface channel. Keep the sums for the entire reporting
      // window rather than splicing each block's loudest channel together.
      for (let c = 0; c < input.length; c++) {
        const ch = input[c];
        let sumSq = this._sumSq[c] || 0;
        for (let i = 0; i < ch.length; i++) {
          const v = ch[i];
          const a = v < 0 ? -v : v;
          if (a > this._peak) {
            this._peak = a;
          }
          sumSq += v * v;
        }
        this._sumSq[c] = sumSq;
      }

      // Passthrough: input copied to output UNMODIFIED, channel for
      // channel (up to the output's channel count).
      if (output) {
        for (let c = 0; c < input.length && c < output.length; c++) {
          if (output[c]) {
            output[c].set(input[c]);
          }
        }
      }
    }

    if (++this._blocksSincePost >= POST_EVERY_BLOCKS) {
      let strongestSumSq = 0;
      for (let c = 0; c < this._sumSq.length; c++) {
        strongestSumSq = Math.max(strongestSumSq, this._sumSq[c]);
        this._sumSq[c] = 0;
      }
      this.port.postMessage({
        type: 'watchdog-block',
        peak: this._peak,
        rms: this._n > 0 ? Math.sqrt(strongestSumSq / this._n) : 0,
        blocks: this._blocksSincePost,
        t: currentTime // AudioWorkletGlobalScope clock (seconds)
      });
      this._peak = 0;
      this._n = 0;
      this._blocksSincePost = 0;
    }
    return true; // keep the processor alive (a silent tap never idles out)
  }
}

registerProcessor('watchdog-tap', WatchdogTapProcessor);
