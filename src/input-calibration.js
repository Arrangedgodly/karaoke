// Bounded, session-only level estimation. No audio, timers, DOM or storage.
(function () {
  'use strict';
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function percentile(values, p) {
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor((sorted.length - 1) * p)];
  }
  function create(options) {
    options = options || {};
    var channelMode = null, channel = null, count = 0, history = [], channelHistory = [];
    var elapsed = 0, quietMs = 0, locked = false, manual = false, clipped = false, needsChannel = false;
    var gain = 0, noise = null, voice = null, peak = null, state = 'listening';
    function recheck() {
      history = []; elapsed = 0; quietMs = 0; locked = false; manual = false;
      clipped = false; gain = 0; noise = null; voice = null; peak = null; state = 'listening';
    }
    function snapshot() {
      return { state: state, locked: locked, gainDb: gain, noiseDb: noise, voiceDb: voice,
        peakDb: peak, channel: channel, channelCount: count, channelMode: channelMode === null ? 'auto' : 'manual' };
    }
    function feed(frame) {
      if (!frame || !Array.isArray(frame.channels) || !frame.channels.length ||
          !Number.isFinite(frame.durationMs) || frame.durationMs <= 0) return snapshot();
      if (frame.channels.some(function (c) {
        return !c || !(Number.isFinite(c.rmsDb) || c.rmsDb === -Infinity) ||
          !(Number.isFinite(c.peakDb) || c.peakDb === -Infinity);
      })) return snapshot();
      var dt = clamp(frame.durationMs, 1, 250);
      if (count !== frame.channels.length) {
        count = frame.channels.length; channel = null; channelMode = null; channelHistory = []; needsChannel = false; recheck();
      }
      channelHistory.push(frame);
      if (channelHistory.length > 10) channelHistory.shift();
      var previousChannel = channel;
      if (channelMode !== null) channel = channelMode;
      else if (count === 1) channel = 0;
      else if (channelHistory.length === 10) {
        var active = [];
        for (var c = 0; c < count; c++) {
          if (channelHistory.some(function (f) { return f.channels[c].peakDb > -65; })) active.push(c);
        }
        var linked = count === 2 && channelHistory.every(function (f) {
          return f.linked || f.channels.every(function (c) { return c.peakDb <= -65; });
        });
        // A pause does not mean the microphone moved to another input.
        if (!active.length) channel = previousChannel;
        else if (active.length === 1) channel = active[0];
        else if (linked) channel = previousChannel === null ? 0 : previousChannel;
        else channel = null;
        // A later source on another input must not steal the selected mic
        // just because the singer paused. Only an explicit choice unlocks it.
        if ((active.length > 1 && !linked) ||
            (previousChannel !== null && channel !== null && channel !== previousChannel)) needsChannel = true;
        if (needsChannel) {
          if (previousChannel !== null) recheck();
          channel = null;
          state = 'needs-channel'; return snapshot();
        }
      }
      if (previousChannel !== channel && previousChannel !== null) recheck();
      elapsed += dt;
      if (channel === null) { state = elapsed >= 3000 ? 'no-signal' : 'listening'; return snapshot(); }
      var sample = frame.channels[channel];
      quietMs = sample.peakDb < -65 ? quietMs + dt : 0;
      if (sample.peakDb >= -0.05) { clipped = true; gain = Math.min(0, gain); }
      if (clipped) { state = 'clipping'; return snapshot(); }
      if (options.channelsOnly) {
        state = quietMs >= 3000 ? 'no-signal' : 'ready'; return snapshot();
      }
      if (locked) {
        state = quietMs >= 3000 ? 'no-signal' : manual ? 'manual' : 'ready'; return snapshot();
      }
      history.push({ rmsDb: Math.max(-100, sample.rmsDb), peakDb: sample.peakDb });
      if (history.length > 160) history.shift();
      if (quietMs >= 3000) { state = 'no-signal'; return snapshot(); }
      state = 'listening';
      if (elapsed < 3000 || history.length < 40) return snapshot();
      var floor = percentile(history.map(function (s) { return s.rmsDb; }), 0.15);
      var useful = history.filter(function (s) { return s.rmsDb >= floor + 12 && s.rmsDb > -60; });
      var pauses = history.filter(function (s) { return s.rmsDb <= floor + 3; });
      // Require phrases and pauses. Constant noise or a constant tone cannot
      // qualify. This is a level-confidence heuristic, not source separation.
      if (useful.length < 30 || pauses.length < 8) {
        if (elapsed >= 8000) state = 'too-noisy';
        return snapshot();
      }
      noise = floor;
      voice = percentile(useful.map(function (s) { return s.rmsDb; }), 0.75);
      peak = Math.max.apply(null, history.map(function (s) { return s.peakDb; }));
      gain = Math.floor(clamp(Math.min(-24 - voice, -12 - peak), -24, 24) * 2) / 2;
      locked = true; state = 'ready';
      return snapshot();
    }
    return {
      feed: feed, snapshot: snapshot, recheck: recheck,
      setChannel: function (value) {
        if (value !== null && (!Number.isInteger(value) || value < 0 || value >= count)) throw new RangeError('Choose an available input channel.');
        channelMode = value; channel = value; channelHistory = []; needsChannel = false; recheck();
      },
      setManualGain: function (value) {
        if (!Number.isFinite(value) || value < -24 || value > 24) throw new RangeError('Gain must be between -24 and +24 dB.');
        gain = value; locked = true; manual = true; clipped = false; state = 'manual';
      },
      gateThreshold: function (base) {
        if (noise === null || voice === null || !locked) return base;
        return clamp(Math.min(Math.max(base, noise + gain + 6), voice + gain - 8), -80, 0);
      }
    };
  }
  window.InputCalibration = { create: create };
})();
