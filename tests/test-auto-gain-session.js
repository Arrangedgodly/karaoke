'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
function load(box, name) { vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/' + name + '.js'), 'utf8'), box); }
function audioNode() { return { edges: [], connect(n) { this.edges.push(n); return n; }, disconnect() { this.edges = []; } }; }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const worklets = [];
class Worklet {
  constructor() { Object.assign(this, audioNode()); this.port = { messages: [], postMessage(m) { this.messages.push(m); } }; worklets.push(this); }
}
function summary(db) { return { data: { type: 'levels', durationMs: 50, channels: [{ rmsDb: db, peakDb: db + 9 }] } }; }
function learn(record) {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 10; j++) record.worklet.port.onmessage(summary(-70));
    for (let j = 0; j < 25; j++) record.worklet.port.onmessage(summary(-42));
  }
}
function check(name, fn) { fn(); console.log('  ok - ' + name); }
async function run() {
  const ctx = { createGain: audioNode, audioWorklet: { addModule: () => Promise.resolve() } };
  const box = vm.createContext({ window: {}, console, AudioWorkletNode: Worklet });
  load(box, 'input-calibration'); load(box, 'input-preparation'); load(box, 'effect-catalog'); load(box, 'node-autogain');
  const { AutoGain: gain, InputPreparation: prep, EffectCatalog: catalog } = box.window;
  await prep.load(ctx);
  const def = catalog.getDefinition('autogain');
  let model = [], instances = {};
  box.window.AudioGraph = { getModel: () => model, getNodeInstance: id => instances[id] };
  function create(id) { const r = def.create(ctx, {}); instances[id] = r; model = [{ id, type: 'autogain' }]; return r; }
  const first = create('first'); learn(first); const held = gain.snapshot().gainDb;
  check('a qualified session learns positive gain', () => assert(held > 0 && gain.snapshot().locked));
  def.dispose(first); const second = create('second');
  check('replacing the preset effect preserves learned gain', () => assert.equal(second.worklet.port.messages.at(-1).gainDb, held));
  check('bypassed and disposed effects cannot learn', () => {
    gain.recheck(); model[0].bypassed = true; learn(second); assert.equal(gain.snapshot().locked, false);
    assert.equal(first.worklet.port.onmessage, null); model[0].bypassed = false;
  });
  learn(second);
  check('only downstream gates adapt; bypass/manual restore the preset threshold', () => {
    const gate = {}; instances.gate = gate; model.push({ id: 'gate', type: 'gate' });
    assert(gain.gateThreshold(-20, gate) < -20);
    model.reverse(); assert.equal(gain.gateThreshold(-20, gate), -20); model.reverse();
    def.applyParam(second, 'mode', 'manual'); def.applyParam(second, 'gainDb', 5);
    assert.equal(gain.snapshot(second).gainDb, 5); assert.equal(gain.gateThreshold(-20, gate), -20);
    def.applyParam(second, 'mode', 'auto'); assert.equal(second.worklet.port.messages.at(-1).gainDb, held);
  });
  check('Simple inserts once and Advanced preserves explicit position and controls', () => {
    const preset = [{ id: 'eq', type: 'eq' }, { id: 'lim', type: 'limiter' }];
    const simple = gain.prepareModel(preset); assert.equal(simple[0].type, 'autogain'); assert.equal(preset.length, 2);
    assert.equal(gain.prepareModel(simple).length, 3);
    assert.equal(gain.prepareModel(preset, [], true), preset);
    const previous = [preset[0], { id: 'custom', type: 'autogain', params: { mode: 'manual', gainDb: 4 }, bypassed: true }, preset[1]];
    const advanced = gain.prepareModel(preset, previous, true);
    assert.equal(advanced[1].id, 'custom'); assert.equal(advanced[1].params.gainDb, 4); assert(advanced[1].bypassed);
    assert.equal(advanced.at(-1).type, 'limiter');
    assert.throws(() => gain.prepareModel(Array.from({ length: 16 }, (_, i) => ({ id: String(i), type: 'gain' }))));
  });
  const input = await prep.start(ctx, audioNode());
  check('new devices clear the learned adjustment', () => assert.equal(gain.snapshot().gainDb, 0));
  input.port.onmessage(summary(0)); assert.equal(prep.snapshot().state, 'clipping'); prep.recheck(); input.port.onmessage(summary(-35));
  check('Recheck clears the raw-input clipping warning', () => assert.equal(prep.snapshot().state, 'ready'));
  prep.stop(); check('stop disconnects input analysis and clears calibration', () => { assert.equal(input.port.onmessage, null); assert.equal(prep.snapshot().state, 'stopped'); });

  const moduleLoad = deferred(), slowContext = { audioWorklet: { addModule: () => moduleLoad.promise } };
  const oldPrep = prep.start(slowContext, audioNode());
  prep.stop(); const freshPrep = prep.start(slowContext, audioNode()); moduleLoad.resolve();
  const oldPrepared = await oldPrep, freshPrepared = await freshPrep;
  check('InputPreparation itself discards an old pending module attachment', () => { assert.equal(oldPrepared, null); assert(freshPrepared); });
  prep.stop(); assert.equal(freshPrepared.port.onmessage, null);
  box.console = { error() {} };
  const failedContext = { audioWorklet: { addModule: () => Promise.reject(new Error('module unavailable')) } };
  const failedInput = await prep.start(failedContext, audioNode());
  check('module load failure reports unavailable with raw input fallback', () => { assert.equal(failedInput, null); assert.equal(prep.snapshot().state, 'unavailable'); });
  box.AudioWorkletNode = class { constructor() { throw new Error('node unavailable'); } };
  const failedNode = await prep.start(ctx, audioNode());
  check('input node construction failure leaves a visible unavailable state', () => { assert.equal(failedNode, null); assert.equal(prep.snapshot().state, 'unavailable'); });
  check('Auto Gain construction failure keeps a usable unadjusted chain', () => {
    const failedGain = def.create(ctx, {});
    assert(failedGain.failed); assert.equal(failedGain.input.edges[0], failedGain.output);
    assert.equal(gain.snapshot(failedGain).state, 'unavailable'); def.dispose(failedGain);
  });
  box.AudioWorkletNode = Worklet;

  // Keep the real engine's generation guards while delaying preparation.
  const pending = [], streams = [];
  function stream() { const track = { stop() { this.stopped = true; }, getSettings: () => ({}) }; const s = { getTracks: () => [track], getAudioTracks: () => [track] }; streams.push(s); return s; }
  const engineBox = vm.createContext({ console, navigator: { mediaDevices: { getUserMedia: async () => stream() } }, window: {
    AudioContext: class { resume() {} createMediaStreamSource() { return audioNode(); } },
    InputPreparation: { stop() {}, start() { const d = deferred(); pending.push(d); return d.promise; } }
  } });
  load(engineBox, 'audio-engine'); const engine = engineBox.window.AudioEngine;
  const oldStart = engine.start().catch(e => e); await new Promise(setImmediate);
  const newStart = engine.start(); await new Promise(setImmediate);
  const fresh = audioNode(); pending[1].resolve(fresh); await newStart;
  pending[0].resolve(audioNode()); const stale = await oldStart;
  check('late preparation cannot overwrite a newer live session', () => { assert(stale.stale); assert.equal(engine.preparedSourceNode, fresh); assert(engine.isStarted); });
  const oldSwitch = engine.switchInputDevice('old').catch(e => e); await new Promise(setImmediate);
  const newSwitch = engine.switchInputDevice('new'); await new Promise(setImmediate);
  const switched = audioNode(); pending[3].resolve(switched); await newSwitch;
  pending[2].resolve(audioNode()); const staleSwitch = await oldSwitch;
  check('late device preparation cannot erase the selected device', () => { assert(staleSwitch.stale); assert.equal(engine.preparedSourceNode, switched); assert.equal(engine.currentDeviceId, 'new'); });
}
run().catch(e => { console.error(e); process.exitCode = 1; });
