'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/channel-analysis.js'), 'utf8'), box);
function measure(channels) {
  let index = 0;
  const ctx = { createChannelSplitter: () => ({ connect() {}, disconnect() {} }), createAnalyser() {
    const samples = channels[index++];
    return { disconnect() {}, getFloatTimeDomainData(out) { out.set(samples); } };
  } };
  const tap = box.window.ChannelAnalysis.create(ctx, channels.length), out = new Float32Array(channels[0].length);
  tap.getFloatTimeDomainData(out); return { stats: tap.getStats(), out };
}
function check(name, fn) { fn(); console.log('  ok - ' + name); }
const voice = Float32Array.from({ length: 2048 }, (_, i) => 0.1 * Math.sin(2 * Math.PI * i / 128));
check('right-only sine retains -20 dBFS peak and -23.01 dBFS RMS', () => {
  const { stats } = measure([new Float32Array(2048), voice]);
  assert(Math.abs(stats.peakDb + 20) < 0.00001); assert(Math.abs(stats.rmsDb + 23.0103) < 0.0001);
});
check('opposite polarity cannot cancel the meter or decorative scope', () => {
  const { stats, out } = measure([voice, voice.map(v => -v)]);
  assert(Math.abs(stats.peakDb + 20) < 0.00001); assert(out.some(v => Math.abs(v) > 0.09));
});
check('clip runs belong to an individual channel, never a merged envelope', () => {
  assert.equal(measure([[1, 0, 1, 0], [0, 1, 0, 1]]).stats.clipRun, false);
  assert.equal(measure([[0, 0, 0, 0], [1, 1, 1, 0]]).stats.clipRun, true);
});
check('interfaces with more than two channels retain the strongest input', () => {
  const { stats } = measure([[0, 0, 0, 0], [0, 0, 0, 0], [0.1, -0.1, 0.1, -0.1]]);
  assert(Math.abs(stats.rmsDb + 20) < 0.00001);
});
