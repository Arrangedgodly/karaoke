// Auto Gain is an ordinary movable/bypassable utility. Its calibration is
// session-owned so changing sounds does not discard the learned mic level.
(function () {
  'use strict';
  var calibration = window.InputCalibration.create(), records = [], listeners = [];
  function active(record) {
    var graph = window.AudioGraph;
    if (!graph || !graph.getModel || !graph.getNodeInstance) return !record.disposed;
    return graph.getModel().some(function (entry) {
      return entry.type === 'autogain' && !entry.bypassed && graph.getNodeInstance(entry.id) === record;
    });
  }
  function emit() { listeners.slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function apply(record) {
    if (record.worklet) record.worklet.port.postMessage({ gainDb: record.params.mode === 'manual'
      ? record.params.gainDb : calibration.snapshot().gainDb });
  }
  function create(context, params) {
    var record = { input: context.createGain(), output: context.createGain(), worklet: null,
      params: Object.assign({ mode: 'auto', gainDb: 0 }, params), failed: false, disposed: false, limiting: false };
    records.push(record);
    function insert() {
      if (record.disposed) return;
      var node = new AudioWorkletNode(context, 'auto-gain');
      record.worklet = node;
      node.port.onmessage = function (e) {
        if (record.disposed || !active(record) || !e.data || e.data.type !== 'levels' || !e.data.channels.length) return;
        var previous = calibration.snapshot(), wasLimiting = record.limiting;
        record.limiting = !!e.data.limiting;
        if (record.params.mode === 'auto') {
          var channels = e.data.channels;
          var strongest = { rmsDb: -Infinity, peakDb: -Infinity };
          channels.forEach(function (c) {
            strongest.rmsDb = Math.max(strongest.rmsDb, c.rmsDb);
            strongest.peakDb = Math.max(strongest.peakDb, c.peakDb);
          });
          calibration.feed({ durationMs: e.data.durationMs, channels: [strongest] });
        }
        var next = calibration.snapshot();
        if (previous.gainDb !== next.gainDb) records.forEach(apply);
        if (wasLimiting !== record.limiting || Object.keys(next).some(function (key) { return previous[key] !== next[key]; })) emit();
      };
      record.input.connect(node); node.connect(record.output); apply(record); emit();
    }
    function unavailable(e) {
      if (record.disposed) return;
      record.input.disconnect();
      if (record.worklet) { record.worklet.port.onmessage = null; record.worklet.disconnect(); record.worklet = null; }
      record.failed = true; record.input.connect(record.output); emit();
      console.error('Auto Gain unavailable; using unadjusted input.', e);
    }
    if (window.InputPreparation.isLoaded(context)) {
      try { insert(); } catch (e) { unavailable(e); }
    } else window.InputPreparation.load(context).then(insert).catch(unavailable);
    return record;
  }
  window.AutoGain = {
    reset: function () { calibration = window.InputCalibration.create(); records.forEach(apply); emit(); },
    recheck: function () { calibration.recheck(); records.forEach(apply); emit(); },
    snapshot: function (record) {
      var s = calibration.snapshot();
      if (record && record.params.mode === 'manual') { s.state = 'manual'; s.gainDb = record.params.gainDb; s.locked = true; }
      if (record && record.failed) s.state = 'unavailable';
      s.limiting = !!(record && record.limiting); return s;
    },
    subscribe: function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; },
    // Only adapt downstream gates; moving Auto Gain after a gate must not
    // quietly retune that upstream effect. Manual gain has no noise estimate.
    gateThreshold: function (base, gateRecord) {
      var graph = window.AudioGraph;
      if (!graph || !graph.getModel) return base;
      var upstream = false;
      var model = graph.getModel();
      for (var i = 0; i < model.length; i++) {
        var e = model[i], instance = graph.getNodeInstance(e.id);
        if (instance === gateRecord) return upstream ? calibration.gateThreshold(base) : base;
        if (e.type === 'autogain' && !e.bypassed && instance && instance.params.mode === 'auto' && !instance.failed) upstream = true;
      }
      return base;
    },
    prepareModel: function (model, previous, advanced) {
      if (!model.length || model.some(function (e) { return e.type === 'autogain'; })) return model;
      var previousIndex = (previous || []).findIndex(function (e) { return e.type === 'autogain'; });
      if (advanced && previousIndex < 0) return model;
      if (model.length >= 16) {
        var error = new Error('Auto Gain needs one free effect slot. Remove an effect in Advanced, then load this sound again.');
        error.code = 'node-count-cap'; error.count = model.length + 1; throw error;
      }
      var id = 'auto-gain', n = 1;
      if (previousIndex >= 0) id = previous[previousIndex].id;
      while (model.some(function (e) { return e.id === id; })) id = 'auto-gain-' + n++;
      var entry = previousIndex >= 0 ? Object.assign({}, previous[previousIndex], { id: id })
        : { id: id, type: 'autogain', params: { mode: 'auto', gainDb: 0 } };
      var prepared = model.slice();
      prepared.splice(advanced ? Math.min(previousIndex, model.length - 1) : 0, 0, entry);
      return prepared;
    },
    onChainChanged: emit
  };
  window.EffectCatalog.register('autogain', {
    label: 'Auto Gain', plainLabel: 'Prepares your microphone level', experimental: false,
    // 'Auto Gain' and 'Autotune' both derive AUT; this family takes ATG so
    // the rail never prints one code for two families.
    code: 'ATG',
    // Opens wide enough for the mode pads, the gain knob, and the setup
    // and warning lines to read without a resize (2026-09-03, owner
    // direction): this unit is prose as much as controls, and at the
    // board's shared floor its guidance wrapped to a column.
    defaultWidthPx: 336,
    paramSpec: [
      { id: 'mode', label: 'Mode', values: ['auto', 'manual'], default: 'auto' },
      { id: 'gainDb', label: 'Manual gain', min: -24, max: 24, default: 0, step: 0.5, unit: 'dB' }
    ],
    create: create,
    applyParam: function (record, key, value) { record.params[key] = value; apply(record); emit(); },
    dispose: function (record) {
      record.disposed = true;
      if (record.worklet) { record.worklet.port.onmessage = null; record.worklet.disconnect(); }
      record.input.disconnect(); record.output.disconnect();
      records = records.filter(function (r) { return r !== record; });
    }
  });
})();
