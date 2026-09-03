// Audio-thread channel routing and the movable Auto Gain effect. Summary
// messages contain levels only; microphone samples never leave this thread.
'use strict';
const REPORT_SAMPLES = Math.round(sampleRate * 0.05);
const PREPARED_CEILING = Math.pow(10, -12 / 20);
const RAMP_SAMPLES = Math.round(sampleRate * 0.1);
function finiteSample(v) { return Number.isFinite(v) ? v : 0; }
function db(v) { return v > 0 ? 20 * Math.log10(v) : -Infinity; }

class LevelReporter extends AudioWorkletProcessor {
  constructor() {
    super(); this.samples = 0; this.peaks = []; this.squares = [];
    this.cross = 0; this.limiting = false;
  }
  report(input, length) {
    for (let c = 0; c < input.length; c++) {
      if (this.peaks[c] === undefined) { this.peaks[c] = 0; this.squares[c] = 0; }
      for (let i = 0; i < length; i++) {
        const v = finiteSample(input[c][i]);
        this.peaks[c] = Math.max(this.peaks[c], Math.abs(v));
        this.squares[c] += v * v;
        if (c === 1) this.cross += finiteSample(input[0][i]) * v;
      }
    }
    this.samples += length;
    if (this.samples < REPORT_SAMPLES) return;
    const channels = input.map((_, c) => ({ peakDb: db(this.peaks[c] || 0),
      rmsDb: db(Math.sqrt((this.squares[c] || 0) / this.samples)) }));
    const denominator = Math.sqrt((this.squares[0] || 0) * (this.squares[1] || 0));
    const linked = input.length === 2 && denominator > 0 && this.cross / denominator > 0.999 &&
      Math.abs(channels[0].rmsDb - channels[1].rmsDb) < 0.5;
    this.port.postMessage({ type: 'levels', channels, linked,
      durationMs: this.samples * 1000 / sampleRate, limiting: this.limiting });
    this.samples = 0; this.peaks.fill(0); this.squares.fill(0); this.cross = 0; this.limiting = false;
  }
}

class InputChannelProcessor extends LevelReporter {
  constructor() {
    super(); this.channel = -1; this.previous = -1; this.fade = 1;
    this.port.onmessage = e => {
      const c = e.data && e.data.channel;
      if (!Number.isInteger(c) || c < -1 || c > 31 || c === this.channel) return;
      this.previous = this.channel; this.channel = c; this.fade = 0;
    };
  }
  process(inputs, outputs) {
    const input = inputs[0] || [], output = outputs[0] || [];
    if (!output[0]) return true;
    for (let i = 0; i < output[0].length; i++) {
      const chosen = this.channel === -1 && input.length === 1 ? 0 : this.channel;
      const previous = this.previous === -1 && input.length === 1 ? 0 : this.previous;
      this.fade = Math.min(1, this.fade + 1 / (sampleRate * 0.02));
      const next = input[chosen] ? finiteSample(input[chosen][i]) : 0;
      const old = input[previous] ? finiteSample(input[previous][i]) : 0;
      output[0][i] = old * (1 - this.fade) + next * this.fade;
    }
    this.report(input, output[0].length);
    return true;
  }
}

class AutoGainProcessor extends LevelReporter {
  constructor() {
    super(); this.gain = 1; this.target = 1; this.step = 0; this.remaining = 0; this.safety = 1;
    this.port.onmessage = e => {
      const g = e.data && e.data.gainDb;
      if (!Number.isFinite(g) || g < -24 || g > 24) return;
      const target = Math.pow(10, g / 20);
      if (target === this.target) return;
      this.target = target; this.remaining = RAMP_SAMPLES;
      this.step = (target - this.gain) / RAMP_SAMPLES;
    };
  }
  process(inputs, outputs) {
    const input = inputs[0] || [], output = outputs[0] || [];
    if (!output.length) return true;
    const length = output[0].length;
    for (let i = 0; i < length; i++) {
      if (this.remaining > 0) { this.gain += this.step; if (--this.remaining === 0) this.gain = this.target; }
      let peak = 0;
      for (const channel of input) peak = Math.max(peak, Math.abs(finiteSample(channel[i]) * this.gain));
      const ceilingGain = peak > PREPARED_CEILING ? PREPARED_CEILING / peak : 1;
      // Shared peak limiter: immediate reduction, 250 ms recovery. The
      // -12 dBFS bound is independent of calibration or main-thread stalls.
      this.safety = Math.min(ceilingGain, this.safety + (1 - this.safety) / (sampleRate * 0.25));
      if (this.safety < 0.99) this.limiting = true;
      for (let c = 0; c < output.length; c++) {
        output[c][i] = input[c] ? finiteSample(input[c][i]) * this.gain * this.safety : 0;
      }
    }
    this.report(input, length);
    return true;
  }
}
registerProcessor('input-channel', InputChannelProcessor);
registerProcessor('auto-gain', AutoGainProcessor);
