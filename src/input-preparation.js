// Session-owned input channel selection. Raw capture remains available to
// meters and emergency Bypass; only the effect chain receives this output.
(function () {
  'use strict';
  var modules = new WeakMap(), current = null, generation = 0, listeners = [];
  var state = { state: 'stopped', channelCount: 0, channel: null };
  function emit() { listeners.slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function load(context) {
    if (!modules.has(context)) {
      var entry = { loaded: false };
      entry.promise = context.audioWorklet.addModule('src/input-worklet.js').then(function () { entry.loaded = true; });
      modules.set(context, entry);
      entry.promise.catch(function () { modules.delete(context); });
    }
    return modules.get(context).promise;
  }
  function stop() {
    generation++;
    if (current) {
      current.node.port.onmessage = null;
      try { current.source.disconnect(current.node); } catch (e) { /* already gone */ }
      current.node.disconnect(); current = null;
    }
    state = { state: 'stopped', channelCount: 0, channel: null };
    if (window.AutoGain) window.AutoGain.reset();
    emit();
  }
  async function start(context, source) {
    stop(); var gen = generation;
    state = { state: 'listening', channelCount: 0, channel: null }; emit();
    try {
      await load(context);
      if (gen !== generation) return null;
      var node = new AudioWorkletNode(context, 'input-channel', { outputChannelCount: [1] });
      var calibration = window.InputCalibration.create({ channelsOnly: true });
      current = { node: node, source: source, calibration: calibration };
      node.port.onmessage = function (e) {
        if (!current || current.node !== node || !e.data || e.data.type !== 'levels') return;
        var previous = state;
        state = calibration.feed(e.data);
        if (previous.channel !== state.channel) {
          node.port.postMessage({ channel: state.channel === null ? -1 : state.channel });
          if (window.AutoGain) window.AutoGain.reset();
        }
        if (previous.state !== state.state || previous.channel !== state.channel ||
            previous.channelCount !== state.channelCount || previous.channelMode !== state.channelMode) emit();
      };
      source.connect(node);
      return node;
    } catch (e) {
      if (gen === generation) { state = { state: 'unavailable', channelCount: 0, channel: null }; emit(); }
      console.error('Input channel preparation unavailable; raw capture remains available.', e);
      return null;
    }
  }
  window.InputPreparation = {
    start: start, stop: stop, load: load,
    isLoaded: function (ctx) { return !!(modules.get(ctx) && modules.get(ctx).loaded); },
    snapshot: function () { return Object.assign({}, state); },
    recheck: function () {
      if (!current) return;
      current.calibration.recheck(); state = current.calibration.snapshot(); emit();
    },
    subscribe: function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; },
    setChannel: function (channel) {
      if (!current) return;
      current.calibration.setChannel(channel); state = current.calibration.snapshot();
      current.node.port.postMessage({ channel: channel === null ? -1 : channel });
      if (window.AutoGain) window.AutoGain.reset(); emit();
    }
  };
})();
