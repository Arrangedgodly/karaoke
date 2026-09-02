// Human Stop: real engine, graph, bypass, editing and main.js with controlled
// browser promises and graph timers. Run with node tests/test-session-stop.js.
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var checks = 0;
function check(value, label) { assert.ok(value, label); checks++; console.log('  ok - ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
async function drain() { for (var i = 0; i < 40; i++) { await Promise.resolve(); } }
function deferred() {
  var resolve, reject;
  var promise = new Promise(function (a, b) { resolve = a; reject = b; });
  return { promise: promise, resolve: resolve, reject: reject };
}
function element(tag) {
  var listeners = {}, classes = new Set();
  return {
    tagName: tag || 'BUTTON', children: [], disabled: false, hidden: true, value: '', textContent: '',
    classList: { add: function (c) { classes.add(c); }, remove: function (c) { classes.delete(c); },
      contains: function (c) { return classes.has(c); },
      toggle: function (c, on) { if (on) { classes.add(c); } else { classes.delete(c); } } },
    set innerHTML(v) { this.children = []; },
    appendChild: function (child) { this.children.push(child); },
    addEventListener: function (name, fn) { listeners[name] = fn; },
    fire: function (name) { if (!this.disabled) { return listeners[name]({}); } },
    focus: function () { this.focused = true; }
  };
}
function audioNode() {
  return { connections: new Set(), gain: { value: 1, cancelScheduledValues: function () {},
    setValueAtTime: function (v) { this.value = v; }, linearRampToValueAtTime: function (v) { this.value = v; } },
    connect: function (n) { this.connections.add(n); },
    disconnect: function (n) { if (n) { this.connections.delete(n); } else { this.connections.clear(); } } };
}
function stream(id) {
  var listeners = {};
  var track = { readyState: 'live', stops: 0, getSettings: function () { return { deviceId: id }; },
    stop: function () { this.stops++; this.readyState = 'ended'; },
    addEventListener: function (name, fn) { listeners[name] = fn; },
    removeEventListener: function (name) { delete listeners[name]; }, listeners: listeners };
  return { track: track, getTracks: function () { return [track]; }, getAudioTracks: function () { return [track]; } };
}
function harness() {
  var ids = ['start-button', 'input-device-select', 'status', 'status-text', 'start-hint', 'bypass-toggle-button', 'autosave-warning'];
  var els = {}, gum = [], timers = new Map(), intervals = new Map(), timerId = 0, events = {}, logs = [];
  ids.forEach(function (id) { els[id] = element(); });
  els['input-device-select'].disabled = els['bypass-toggle-button'].disabled = true;
  var context, model = [], layout = {}, saved = [{ id: 'a', type: 'effect', params: { mix: 0.2 } }];
  var savedLayout = { a: { w: 288 } }, saveFailed = false, failSave = false, failFactory = false;
  var made = [], saves = 0, live = false, simpleLive = false, meterRunning = false, readoutsRunning = false, dragging = false;
  var s = { console: { log: function () {}, error: function () { logs.push(Array.from(arguments)); }, warn: function () {} },
    document: { getElementById: function (id) { return els[id] || null; }, createElement: element,
      addEventListener: function (name, fn) { events[name] = fn; } },
    setTimeout: function (fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout: function (id) { timers.delete(id); },
    setInterval: function (fn) { intervals.set(++timerId, fn); return timerId; }, clearInterval: function (id) { intervals.delete(id); },
    navigator: { mediaDevices: {
      getUserMedia: function () { var d = deferred(); gum.push(d); return d.promise; },
      enumerateDevices: function () { return Promise.resolve([{ kind: 'audioinput', deviceId: 'mic', label: 'Test mic' }]); },
      addEventListener: function () {}
    } },
    AudioContext: function () {
      var stateListener;
      context = { state: 'suspended', currentTime: 0, destination: audioNode(), resumeCalls: 0,
        resume: function () { this.resumeCalls++; this.setState('running'); return Promise.resolve(); },
        suspend: function () { this.setState('suspended'); return Promise.resolve(); },
        setState: function (state) { this.state = state; if (stateListener) { stateListener(); } },
        addEventListener: function (name, fn) { stateListener = fn; },
        createGain: audioNode, createMediaStreamSource: audioNode };
      return context;
    },
    EffectCatalog: {
      hasType: function () { return true; }, getParamSpec: function () { return []; },
      create: function () { if (failFactory) { throw new Error('factory unavailable'); } var n = audioNode(); made.push(n); return n; },
      applyParam: function () {}, dispose: function (type, n) { n.disposed = (n.disposed || 0) + 1; }
    },
    ChainCanvas: { getCurrentModel: function () { return copy(model); }, getCurrentLayout: function () { return copy(layout); },
      renderModel: function (m, l) { model = copy(m); layout = copy(l || {}); }, renderNodeParam: function () {},
      isDragActive: function () { return dragging; },
      onEngineStarted: function () { live = true; }, onEngineStopped: function () { live = false; dragging = false; } },
    SimpleView: { onChainChanged: function () {}, onEngineStarted: function () { simpleLive = true; }, onEngineStopped: function () { simpleLive = false; } },
    MeterTaps: { onEngineStarted: function () { meterRunning = true; }, onEngineStopped: function () { meterRunning = false; }, onDeviceSwitched: function () {}, isTripped: function () { return false; } },
    StatusReadouts: { onEngineStarted: function () { readoutsRunning = true; }, stop: function () { readoutsRunning = false; } },
    Persistence: { loadInitialModel: function () { return copy(saved); }, loadInitialLayout: function () { return copy(savedLayout); },
      saveCurrentChain: function (m, l) {
        saves++; saveFailed = failSave;
        if (!failSave) { saved = copy(m); savedLayout = copy(l); }
        var fn = events[failSave ? 'chain-autosave-failed' : 'chain-autosave-recovered']; if (fn) { fn(); }
        return { saved: !failSave };
      }, isSaveFailed: function () { return saveFailed; } }
  };
  s.window = s; vm.createContext(s);
  ['audio-engine', 'audio-graph', 'audio-bypass', 'chain-editing', 'main'].forEach(function (name) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/' + name + '.js'), 'utf8'), s, { filename: name });
  });
  return { s: s, els: els, gum: gum, timers: timers, intervals: intervals, made: made, logs: logs,
    get context() { return context; }, get saved() { return saved; }, get saves() { return saves; },
    get model() { return model; }, get layout() { return layout; },
    get bothViewsLive() { return live && simpleLive; }, get bothViewsStopped() { return !live && !simpleLive; },
    get loopsStopped() { return !meterRunning && !readoutsRunning; },
    failSave: function (v) { failSave = v; }, failFactory: function (v) { failFactory = v; },
    drag: function (v) { dragging = v; },
    flush: async function () { await drain(); var todo = Array.from(timers.values()); timers.clear(); todo.forEach(function (fn) { fn(); }); await drain(); },
    start: async function () {
      els['start-button'].fire('click'); var st = stream('mic'); gum.shift().resolve(st); await this.flush(); return st;
    },
    stop: function () { els['start-button'].fire('click'); }
  };
}
async function main() {
  console.log('Human Stop and restart');
  var h = harness(), s = h.s;
  var first = await h.start(), source = s.AudioEngine.sourceNode, effect = s.AudioGraph.getNodeInstance('a');
  check(h.bothViewsLive && (h.els['start-button'].textContent === 'Stop' && !h.els['start-button'].disabled), 'both view adapters become live with Stop enabled');
  var accepted = [{ id: 'a', type: 'effect', params: { mix: 0.7 } }, { id: 'b', type: 'effect', params: {} }];
  var layout = { a: { w: 344 }, b: { w: 300 } };
  h.failSave(true);
  var edit = s.ChainEditing.apply({ source: 'human', candidate: accepted, layout: layout, forceStructural: true });
  await h.flush(); check((await edit).saved === false, 'accepted edit reports failed autosave');
  var beforeSaves = h.saves;
  s.AudioBypass.engage();
  var bypass = Array.from(source.connections).filter(function (n) { return n !== effect; })[0];
  h.stop(); await drain();
  check(first.track.stops === 1 && first.track.readyState === 'ended' && Object.keys(first.track.listeners).length === 0,
    'Stop releases the microphone track and removes its listeners');
  check(source.connections.size === 0 && bypass.connections.size === 0 && s.AudioGraph.getChainGate().connections.size === 0,
    'Stop disconnects capture, dry output and effect-tail output');
  check(h.made.every(function (n) { return n.disposed === 1; }), 'every live effect is disposed exactly once');
  check(h.context.state === 'suspended' && h.loopsStopped, 'Stop suspends DSP and stops meter/watchdog and readout hooks');
  check(h.els['status-text'].textContent === 'Stopped' && !h.els.status.classList.contains('error') && h.bothViewsStopped,
    'Stop shows normal Stopped and gates both view adapters');
  check(!h.els['start-button'].disabled && h.els['start-button'].textContent === 'Start' && h.els['bypass-toggle-button'].disabled && h.els['start-button'].focused,
    'Stop leaves Start focused and available, with Bypass disabled');
  check(h.saves === beforeSaves && !h.els['autosave-warning'].hidden, 'Stop makes no storage write and keeps the autosave warning');
  check(JSON.stringify(h.model) === JSON.stringify(accepted) && JSON.stringify(h.layout) === JSON.stringify(layout), 'accepted unsaved sound and layout remain visible');
  var resumes = h.context.resumeCalls;
  h.els['start-button'].fire('click');
  check(h.context.resumeCalls === resumes + 1, 'restart resumes the context synchronously in the Start gesture');
  h.gum.shift().resolve(stream('mic')); await h.flush();
  check(JSON.stringify(s.AudioGraph.getModel()) === JSON.stringify(accepted) && JSON.stringify(h.layout) === JSON.stringify(layout),
    'restart restores accepted memory state even though storage still contains the older sound');
  check(s.AudioGraph.getNodeInstance('a') !== effect && h.bothViewsLive && s.AudioBypass.isEngaged(), 'restart uses fresh effects and preserves human Bypass choice');
  check(!h.els['autosave-warning'].hidden, 'a failed restart autosave keeps its warning visible');

  h.stop(); h.failFactory(true); await h.start();
  check(!s.AudioEngine.isStarted && /Could not restart/.test(h.els['status-text'].textContent), 'failed restart stops capture and reports the failure');
  check(JSON.stringify(h.model) === JSON.stringify(accepted), 'failed restart never replaces an unsaved accepted sound with empty fallback');
  h.failFactory(false); await h.start();
  check(JSON.stringify(s.AudioGraph.getModel()) === JSON.stringify(accepted), 'another Start retries the retained sound after a failed restart');
  h.stop();

  console.log('Retired asynchronous work');
  h = harness(); s = h.s;
  h.els['start-button'].fire('click'); var oldRequest = h.gum.shift();
  check((h.els['start-button'].textContent === 'Stop' && !h.els['start-button'].disabled), 'Stop is available while microphone permission is pending');
  h.stop(); await h.start(); var newSource = s.AudioEngine.sourceNode;
  var lateStream = stream('old'); oldRequest.resolve(lateStream); await h.flush();
  check(lateStream.track.stops === 1 && s.AudioEngine.sourceNode === newSource && h.bothViewsLive, 'late startup stream is stopped without replacing the restarted session');
  h.stop();
  h.els['start-button'].fire('click'); oldRequest = h.gum.shift(); h.stop();
  oldRequest.reject(new Error('permission denied after Stop')); await h.flush();
  check(h.els['status-text'].textContent === 'Stopped' && h.logs.length === 0, 'late startup rejection cannot replace Stopped with an error');

  h = harness(); s = h.s;
  h.els['start-button'].fire('click'); h.gum.shift().resolve(stream('mic')); await drain();
  check(h.timers.size === 1, 'startup graph is staged before its deferred rewire');
  h.stop(); await h.start(); await h.flush();
  check(h.bothViewsLive && h.made[0].disposed === 1 && h.logs.length === 0, 'Stop during startup graph staging cancels it and allows a clean restart');

  var stable = copy(h.model), saveCount = h.saves;
  var pending = s.ChainEditing.apply({ source: 'agent', candidate: [{ id: 'stale', type: 'effect', params: {} }] }).catch(function (e) { return e; });
  var queued = s.ChainEditing.apply({ source: 'human', candidate: [] }).catch(function (e) { return e; });
  await drain(); h.stop(); await h.start();
  check((await pending).stale && (await queued).stale, 'Stop retires both in-flight and queued edits');
  check(JSON.stringify(h.model) === JSON.stringify(stable) && h.saves === saveCount + 1, 'stale edit completion cannot render or autosave over the restart');

  // A switch waiting behind a chain transaction must not even acquire a mic.
  var pendingEdit = s.ChainEditing.apply({ source: 'human', candidate: [] }).catch(function (e) { return e; });
  await drain(); h.els['input-device-select'].value = 'other'; h.els['input-device-select'].fire('change');
  await drain(); h.stop(); await h.start(); await pendingEdit; await drain();
  check(h.gum.length === 0 && h.bothViewsLive, 'Stop retires a device switch still waiting on the edit barrier');

  h.els['input-device-select'].value = 'other'; h.els['input-device-select'].fire('change'); await drain();
  var switchRequest = h.gum.shift(); h.stop(); await h.start(); newSource = s.AudioEngine.sourceNode;
  lateStream = stream('other'); switchRequest.resolve(lateStream); await h.flush();
  check(lateStream.track.stops === 1 && s.AudioEngine.sourceNode === newSource, 'late device acquisition cannot replace a restarted microphone');

  h.els['input-device-select'].value = 'other'; h.els['input-device-select'].fire('change'); await drain();
  var replacement = stream('other'); h.gum.shift().resolve(replacement); await drain();
  check(h.timers.size === 1, 'device graph rewire is pending');
  h.stop(); await h.start(); await h.flush();
  check(replacement.track.stops === 1 && h.bothViewsLive && h.logs.length === 0, 'Stop during device graph staging cannot retap or tear down a restart');
  h.context.setState('suspended');
  check((h.els['start-button'].textContent === 'Stop' && !h.els['start-button'].disabled), 'Stop remains available when the context is paused but capture is still open');
  h.stop();
  check(h.els['status-text'].textContent === 'Stopped' && h.loopsStopped, 'Stop from a paused session is a normal stop');

  // Delay the caller's completion after a real physical graph commit.
  // This simulates a late adapter completion that cancellation cannot recall.
  h = harness(); s = h.s; await h.start();
  var originalBuild = s.AudioGraph.buildGraph, late = deferred();
  s.AudioGraph.buildGraph = function (model, options) {
    return originalBuild(model, options).then(function () { return late.promise; });
  };
  pending = s.ChainEditing.apply({ source: 'agent', candidate: [{ id: 'late', type: 'effect', params: {} }] }).catch(function (e) { return e; });
  await h.flush(); h.stop(); s.AudioGraph.buildGraph = originalBuild;
  await h.start(); stable = copy(h.model); saveCount = h.saves;
  late.resolve({ committed: true }); await h.flush();
  check((await pending).stale && JSON.stringify(h.model) === JSON.stringify(stable) && h.saves === saveCount,
    'late committed graph completion cannot roll back, render or persist over a restart');
  h.stop();

  // Even a broken renderer must not strand Stop before its loop/UI cleanup.
  h = harness(); s = h.s; await h.start();
  var render = s.ChainCanvas.renderModel;
  s.ChainCanvas.renderModel = function () { throw new Error('renderer unavailable'); };
  h.stop();
  check(h.loopsStopped && h.bothViewsStopped && !h.els['start-button'].disabled && s.ChainEditing.getSnapshot(),
    'renderer failure during Stop retains accepted state and still completes cleanup');
  s.ChainCanvas.renderModel = render; await h.start();
  check(h.bothViewsLive, 'Start can retry the accepted sound after renderer recovery');
  h.stop();

  console.log('Agent work waiting outside the chain transaction');
  h = harness(); s = h.s; await h.start();
  s.EffectCatalog.getAllTypes = function () { return ['limiter']; };
  s.EffectCatalog.getParamSpec = function () { return [
    { id: 'ceiling', min: -12, max: 0, default: -1, step: 0.5 },
    { id: 'release', min: 10, max: 500, default: 50, step: 10 }
  ]; };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/mcp-tools.js'), 'utf8'), s, { filename: 'mcp-tools' });
  var setChain = s.McpTools.getDefs().find(function (tool) { return tool.name === 'set_chain'; });
  var agentInput = { chain: { schemaVersion: 1, name: 'Queued sound',
    nodes: [{ id: 'agent-limiter', type: 'limiter', params: { ceiling: -3, release: 50 } }] } };
  stable = copy(h.model); h.drag(true);
  var abortListeners = new Set();
  var signal = { aborted: false, addEventListener: function (name, fn) { abortListeners.add(fn); },
    removeEventListener: function (name, fn) { abortListeners.delete(fn); } };
  pending = setChain.execute(agentInput, { signal: signal });
  queued = setChain.execute(agentInput);
  await drain();
  check(h.intervals.size === 1 && abortListeners.size === 1, 'first agent edit waits for drag while a second waits in the outer queue');
  var oldPoll = Array.from(h.intervals.values())[0];
  h.stop();
  check(h.intervals.size === 0 && abortListeners.size === 0, 'Stop immediately clears the agent drag poll and its abort listener');
  await h.start(); saveCount = h.saves; oldPoll(); await h.flush();
  check((await pending).code === 'ABORTED' && (await queued).code === 'ABORTED', 'Stop aborts both the drag waiter and the queued agent edit');
  check(JSON.stringify(h.model) === JSON.stringify(stable) && h.saves === saveCount,
    'a retired drag callback cannot overwrite or autosave the restarted sound');

  pending = setChain.execute(agentInput); h.stop(); await h.start(); await h.flush();
  check((await pending).code === 'ABORTED', 'Stop aborts an agent request before its outer queue callback begins');

  var originalIdle = s.ChainEditing.whenIdle, heldIdle = deferred();
  s.ChainEditing.whenIdle = function () { return heldIdle.promise; };
  pending = setChain.execute(agentInput); await drain();
  h.stop(); s.ChainEditing.whenIdle = originalIdle; await h.start();
  var freshEdit = setChain.execute(agentInput); await h.flush();
  check((await freshEdit).applied === true, 'a new session can accept agent edits while the retired queue remains blocked');
  stable = copy(h.model); saveCount = h.saves;
  heldIdle.resolve(); await h.flush();
  check((await pending).code === 'ABORTED' && JSON.stringify(h.model) === JSON.stringify(stable) && h.saves === saveCount,
    'an agent request waiting for ChainEditing idle cannot apply after Stop and restart');
  h.stop();

  h = harness(); s = h.s;
  h.els['start-button'].fire('click');
  h.context.createMediaStreamSource = function () { throw new Error('source unavailable'); };
  var failedSourceStream = stream('mic'); h.gum.shift().resolve(failedSourceStream); await h.flush();
  check(failedSourceStream.track.stops === 1 && Object.keys(failedSourceStream.track.listeners).length === 0 &&
    !s.AudioEngine.isStarted && !s.AudioEngine.sourceNode,
    'source construction failure releases the acquired track and its listeners');
  console.log('PASS: ' + checks + ' Stop checks');
}
main().catch(function (err) { console.error('  FAIL - ' + err.stack); process.exitCode = 1; });
