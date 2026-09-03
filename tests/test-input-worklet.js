'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const registry = {}, messages = [];
const scope = { sampleRate: 48000, currentTime: 0, AudioWorkletProcessor: class {
  constructor() { this.port = { postMessage: m => messages.push(m) }; }
}, registerProcessor: (n, c) => registry[n] = c };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/input-worklet.js'), 'utf8'), scope);
function block(proc, levels, channels = levels.length, count = 100) {
  let out;
  for (let n = 0; n < count; n++) {
    const input = levels.map(x => new Float32Array(128).fill(x));
    out = Array.from({ length: channels }, () => new Float32Array(128));
    proc.process([input], [out]);
    out.forEach(a => assert(a.every(Number.isFinite)));
  }
  return out;
}
function check(name, fn) { fn(); console.log('  ok - ' + name); }
check('automatic channel routing waits on stereo choice; mono passes', () => {
  const p = new registry['input-channel']();
  assert.equal(block(p, [0, 0.1], 1)[0][127], 0);
  p.port.onmessage({ data: { channel: 1 } });
  assert(Math.abs(block(p, [0, 0.1], 1)[0][127] - 0.1) < 1e-6);
  const mono = new registry['input-channel']();
  assert(Math.abs(block(mono, [0.1], 1)[0][127] - 0.1) < 1e-6);
});
check('Auto Gain preserves stereo polarity and caps all channel peaks', () => {
  const p = new registry['auto-gain']();
  p.port.onmessage({ data: { gainDb: 24 } });
  const out = block(p, [0.9, -0.9]);
  assert(out[0][127] > 0 && out[1][127] < 0);
  out.forEach(a => assert(Math.max(...a.map(Math.abs)) <= Math.pow(10, -12 / 20) + 1e-7));
});
check('gain changes ramp instead of stepping and invalid commands are ignored', () => {
  const p = new registry['auto-gain'](); block(p, [0.001]);
  p.port.onmessage({ data: { gainDb: 12 } });
  const early = block(p, [0.001], 1, 1)[0];
  assert(early[0] < 0.0011 && early[127] < 0.002);
  const settled = block(p, [0.001], 1, 100)[0][127];
  assert(Math.abs(settled - 0.00398107) < 1e-6);
  p.port.onmessage({ data: { gainDb: Infinity } });
  assert(Math.abs(block(p, [0.001], 1)[0][127] - settled) < 1e-6);
});
check('analysis reports raw channels and never cancels opposite polarity', () => {
  messages.length = 0; const p = new registry['input-channel'](); block(p, [0.1, -0.1], 1);
  const m = messages[messages.length - 1];
  assert.equal(m.channels.length, 2); assert.equal(m.linked, false);
  assert(Math.abs(m.channels[1].peakDb + 20) < 0.00001);
});
check('silence and nonfinite input never become nonfinite output', () => {
  const p = new registry['auto-gain']();
  assert.equal(block(p, [NaN], 1)[0][127], 0);
  assert.equal(block(p, [0], 1)[0][127], 0);
});
