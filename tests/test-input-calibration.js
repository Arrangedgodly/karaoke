'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/input-calibration.js'), 'utf8'), box);
const create = () => box.window.InputCalibration.create();
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('  ok - ' + name); }
function feed(c, levels, count = 1, linked = false) {
  for (let i = 0; i < count; i++) c.feed({ durationMs: 50, channels: levels.map(x => ({ rmsDb: x, peakDb: x === -Infinity ? x : x + 9 })), linked });
  return c.snapshot();
}
function phrases(c) {
  for (let i = 0; i < 4; i++) { feed(c, [-70], 10); feed(c, [-42], 20); feed(c, [-36], 10); }
  return c.snapshot();
}
check('silence never accumulates gain', () => {
  const c = create(); const s = feed(c, [-Infinity], 400);
  assert.equal(s.gainDb, 0); assert.equal(s.state, 'no-signal'); assert.equal(s.locked, false);
});
check('steady noise cannot qualify as useful phrases', () => {
  const c = create(); const s = feed(c, [-35], 400);
  assert.equal(s.gainDb, 0); assert.equal(s.locked, false); assert.equal(s.state, 'too-noisy');
});
check('phrases produce a bounded fixed adjustment with peak headroom', () => {
  const c = create(); const s = phrases(c);
  assert.equal(s.state, 'ready'); assert(s.gainDb > 0 && s.gainDb <= 24);
  assert(s.peakDb + s.gainDb <= -12.001 + 0.01); assert(s.locked);
  const held = s.gainDb;
  assert.equal(feed(c, [-Infinity], 300).gainDb, held);
  assert.equal(feed(c, [-45], 100).gainDb, held);
});
check('two different sources require a choice even when one is louder', () => {
  const c = create(); const s = feed(c, [-25, -45], 100);
  assert.equal(s.state, 'needs-channel'); assert.equal(s.channel, null); assert.equal(s.gainDb, 0);
  c.setChannel(1); assert.equal(feed(c, [-25, -45], 1).channel, 1);
});
check('right-only and identical dual mono select one channel without averaging', () => {
  const c = create(); assert.equal(feed(c, [-Infinity, -35], 12).channel, 1);
  const d = create(); assert.equal(feed(d, [-35, -35], 12, true).channel, 0);
});
check('a second source appearing invalidates automatic channel selection', () => {
  const c = create(); feed(c, [-Infinity, -35], 12);
  const s = feed(c, [-30, -35], 12); assert.equal(s.state, 'needs-channel'); assert.equal(s.channel, null);
  assert.equal(feed(c, [-30, -Infinity], 50).state, 'needs-channel');
  c.setChannel(1); assert.equal(feed(c, [-30, -35], 1).channel, 1);
});
check('a source on another input cannot take over after the singer pauses', () => {
  const c = create(); feed(c, [-35, -Infinity], 12); feed(c, [-Infinity, -Infinity], 30);
  const s = feed(c, [-Infinity, -30], 30);
  assert.equal(s.state, 'needs-channel'); assert.equal(s.channel, null);
  c.setChannel(null); assert.equal(feed(c, [-Infinity, -30], 12).channel, 1);
});
check('silence preserves an automatically selected interface channel', () => {
  const c = create(); feed(c, [-Infinity, -35], 12);
  const s = feed(c, [-Infinity, -Infinity], 100);
  assert.equal(s.channel, 1); assert.equal(s.state, 'no-signal');
});
check('identical dual mono keeps its channel through zero-valued pauses', () => {
  const c = create(); feed(c, [-35, -35], 12, true);
  for (let i = 0; i < 100; i++) assert.equal(feed(c, [-Infinity, -Infinity], 1, false).channel, 0);
  assert.equal(feed(c, [-35, -35], 1, true).channel, 0);
});
check('manual adjustment validates range and recheck starts from unity', () => {
  const c = create(); feed(c, [-35], 1); c.setManualGain(8);
  assert.equal(feed(c, [-40], 80).gainDb, 8); assert.equal(c.snapshot().state, 'manual');
  assert.throws(() => c.setManualGain(25)); assert.throws(() => c.setManualGain(NaN));
  c.recheck(); assert.equal(c.snapshot().gainDb, 0); assert.equal(c.snapshot().locked, false);
});
check('capture clipping removes boost and asks for hardware correction', () => {
  const c = create(); phrases(c); const s = feed(c, [-9], 1);
  assert.equal(s.state, 'clipping'); assert(s.gainDb <= 0);
});
check('gate threshold adapts within the measured voice/noise gap', () => {
  const c = create(); phrases(c); const s = c.snapshot(); const t = c.gateThreshold(-45);
  assert(t >= s.noiseDb + s.gainDb + 6); assert(t <= s.voiceDb + s.gainDb - 8);
});
check('malformed stats cannot create a gain adjustment', () => {
  const c = create(); c.feed({ durationMs: NaN, channels: [{ rmsDb: NaN, peakDb: Infinity }] });
  assert.equal(c.snapshot().gainDb, 0); assert.equal(c.snapshot().locked, false);
});
console.log(checks + ' calibration scenarios passed');
