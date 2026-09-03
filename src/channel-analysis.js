// Meter side-tap: strongest-channel peak/RMS and per-channel clip runs.
// Never sum channels: opposite polarity must not hide live audio.
(function () {
  'use strict';
  function create(context, count) {
    if (!context.createChannelSplitter) return context.createAnalyser();
    count = Math.max(1, Math.min(32, count || 2));
    var splitter = context.createChannelSplitter(count), analysers = [], scratch, bytes, stats;
    for (var c = 0; c < count; c++) {
      var analyser = context.createAnalyser();
      splitter.connect(analyser, c); analysers.push(analyser);
    }
    var tap = { input: splitter };
    tap.dispose = function () { splitter.disconnect(); analysers.forEach(function (a) { a.disconnect(); }); };
    ['fftSize', 'smoothingTimeConstant', 'minDecibels', 'maxDecibels'].forEach(function (key) {
      Object.defineProperty(tap, key, {
        get: function () { return analysers[0][key]; },
        set: function (v) { analysers.forEach(function (a) { a[key] = v; }); }
      });
    });
    tap.getFloatTimeDomainData = function (out) {
      if (!scratch || scratch.length !== out.length) scratch = new Float32Array(out.length);
      out.fill(0); var peak = 0, rms = 0, clip = false;
      analysers.forEach(function (a) {
        a.getFloatTimeDomainData(scratch); var squares = 0, run = 0;
        for (var i = 0; i < scratch.length; i++) {
          var v = Number.isFinite(scratch[i]) ? scratch[i] : 0, abs = Math.abs(v);
          peak = Math.max(peak, abs); squares += v * v;
          run = abs >= 1 ? run + 1 : 0; if (run >= 3) clip = true;
          // Representative envelope for decorative scopes. Numeric RMS
          // below is computed independently for each complete channel.
          if (abs > Math.abs(out[i])) out[i] = v;
        }
        rms = Math.max(rms, Math.sqrt(squares / scratch.length));
      });
      stats = { peakDb: peak > 0 ? 20 * Math.log10(Math.max(peak, 1e-9)) : -Infinity,
        rmsDb: rms > 0 ? 20 * Math.log10(Math.max(rms, 1e-9)) : -Infinity, clipRun: clip };
    };
    tap.getStats = function () { return stats; };
    tap.getByteFrequencyData = function (out) {
      if (!bytes || bytes.length !== out.length) bytes = new Uint8Array(out.length);
      out.fill(0);
      analysers.forEach(function (a) {
        a.getByteFrequencyData(bytes);
        for (var i = 0; i < out.length; i++) out[i] = Math.max(out[i], bytes[i]);
      });
    };
    return tap;
  }
  window.ChannelAnalysis = { create: create };
})();
