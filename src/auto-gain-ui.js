// Simple gets a compact setup status. Advanced uses the real movable card;
// its normal parameter controls own Auto/Manual and manual gain changes.
(function () {
  'use strict';
  var instrument = document.querySelector('.instrument');
  if (!instrument || !window.AutoGain) return;
  var panel = document.createElement('section'); panel.className = 'input-assist';
  panel.setAttribute('aria-label', 'Microphone preparation');
  var status = document.createElement('span'); status.className = 'input-assist-status';
  status.setAttribute('role', 'status');
  var select = document.createElement('select'); select.className = 'control input-channel-select';
  select.setAttribute('aria-label', 'Microphone input channel');
  // Channel routing belongs to the microphone, even when Auto Gain is removed.
  var advancedSelect = select.cloneNode(false);
  advancedSelect.classList.add('input-channel-advanced');
  document.getElementById('input-device-select').insertAdjacentElement('afterend', advancedSelect);
  var channelSelects = [select, advancedSelect];
  var recheck = document.createElement('button'); recheck.type = 'button'; recheck.className = 'control';
  recheck.textContent = 'Recheck microphone';
  panel.appendChild(status); panel.appendChild(select); panel.appendChild(recheck);
  instrument.insertBefore(panel, instrument.querySelector('.deck-seam'));
  var texts = {
    stopped: 'Auto Gain starts with your microphone.',
    listening: 'Auto Gain: speak or sing a few phrases and pause. Pause backing music for setup.',
    'no-signal': 'No input detected. Check your microphone or channel.',
    'needs-channel': 'Multiple inputs detected. Choose the channel for your microphone.',
    'too-noisy': 'Auto Gain is waiting for clear phrases and pauses. Move closer or reduce background sound.',
    clipping: 'Input is clipping. Lower the device input gain, then recheck.',
    unavailable: 'Automatic preparation unavailable. Input is unadjusted.'
  };
  function put(el, value) { if (el.textContent !== value) el.textContent = value; }
  function currentEntry() {
    var graph = window.AudioGraph;
    return graph && graph.getModel().find(function (e) { return e.type === 'autogain'; });
  }
  function describe(s) {
    if (s.state === 'ready' || s.state === 'manual') {
      return 'Auto Gain: ' + (s.gainDb >= 0 ? '+' : '') + s.gainDb.toFixed(1) + ' dB' +
        (s.state === 'manual' ? ' manual' : ' held') + (s.limiting ? ' · peak protection active' : '');
    }
    return texts[s.state] || texts.listening;
  }
  function checkAgain() {
    var entry = currentEntry();
    if (!entry) return;
    var change = entry.params.mode === 'manual'
      ? window.ChainEditing.apply({ source: 'human', change: { nodeId: entry.id, param: 'mode', value: 'auto' } })
      : Promise.resolve();
    change.then(function () { window.InputPreparation.recheck(); window.AutoGain.recheck(); })
      .catch(function (e) { put(status, e.message); });
  }
  recheck.addEventListener('click', checkAgain);
  channelSelects.forEach(function (picker) {
    picker.addEventListener('change', function () {
      window.InputPreparation.setChannel(picker.value === 'auto' ? null : Number(picker.value));
    });
  });
  var optionCount = -1;
  function render() {
    var input = window.InputPreparation.snapshot(), entry = currentEntry();
    var record = entry && window.AudioGraph.getNodeInstance(entry.id);
    var level = window.AutoGain.snapshot(record);
    var live = window.AudioEngine.isStarted;
    var inputProblem = ['needs-channel', 'clipping', 'no-signal', 'unavailable'].indexOf(input.state) !== -1;
    var message = describe(level);
    if (!entry || entry.bypassed) message = 'Auto Gain is off for this chain.';
    if (!entry && window.AudioGraph.getModel().length >= 16) message = 'Auto Gain needs a free effect slot. Remove an effect in Advanced, then add Auto Gain.';
    if (inputProblem) message = texts[input.state];
    if (!live) message = texts.stopped;
    put(status, message);
    panel.hidden = !live;
    recheck.disabled = !live || !entry || entry.bypassed || input.state === 'unavailable';
    channelSelects.forEach(function (picker) {
      picker.hidden = !live || input.channelCount <= 1;
      picker.disabled = !live;
      picker.setAttribute('aria-invalid', String(input.state === 'needs-channel'));
      if (optionCount !== input.channelCount) {
        picker.textContent = '';
        var auto = document.createElement('option'); auto.value = 'auto'; picker.appendChild(auto);
        for (var i = 0; i < input.channelCount; i++) {
          var o = document.createElement('option'); o.value = String(i); o.textContent = 'Input ' + (i + 1); picker.appendChild(o);
        }
      }
      put(picker.options[0], input.state === 'needs-channel' ? 'Choose input channel' : 'Automatic channel');
      picker.value = input.channelMode === 'manual' ? String(input.channel) : 'auto';
    });
    optionCount = input.channelCount;
    document.querySelectorAll('.node-card[data-family="autogain"]').forEach(function (card) {
      var box = card.querySelector('.auto-gain-readout');
      if (!box) {
        box = document.createElement('div'); box.className = 'auto-gain-readout';
        var value = document.createElement('p'); value.className = 'auto-gain-value'; box.appendChild(value);
        var b = document.createElement('button'); b.type = 'button'; b.className = 'control'; b.textContent = 'Recheck';
        b.addEventListener('click', checkAgain); box.appendChild(b);
        var hint = document.createElement('p'); hint.className = 'auto-gain-hint';
        hint.textContent = 'Auto holds the learned level. Recheck after moving it. Manual uses the gain knob. Peak protection stays on.'; box.appendChild(hint);
        var host = card.querySelector('.node-params-inner'); if (host) host.appendChild(box);
      }
      put(box.querySelector('.auto-gain-value'), message);
      box.querySelector('button').disabled = recheck.disabled;
    });
    // Show the effective threshold beside the preset's baseline control.
    document.querySelectorAll('.node-card[data-family="gate"]').forEach(function (card) {
      var node = window.AudioGraph.getNodeInstance(card.getAttribute('data-node-id'));
      var hint = card.querySelector('.gate-calibration-note');
      var adjusted = node && typeof node.effectiveThreshold === 'number' && node.effectiveThreshold !== node.baseThreshold;
      if (!hint && adjusted) { hint = document.createElement('p'); hint.className = 'gate-calibration-note';
        var host = card.querySelector('.node-params-inner'); if (host) host.appendChild(hint); }
      if (hint) { hint.hidden = !adjusted; if (adjusted) put(hint, 'Auto Gain gate threshold: ' + node.effectiveThreshold.toFixed(1) + ' dBFS'); }
    });
  }
  var queued = false;
  function schedule() {
    if (queued) return; queued = true;
    requestAnimationFrame(function () { queued = false; render(); });
  }
  window.AutoGain.subscribe(schedule); window.InputPreparation.subscribe(schedule);
  window.AudioEngine.onLifecycle(schedule);
  document.getElementById('start-button').addEventListener('click', schedule);
  render();
})();
