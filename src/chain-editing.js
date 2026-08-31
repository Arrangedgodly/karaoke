// Transactional chain editing for VoxChain.
//
// This module is the one in-process mutation interface for the accepted
// logical chain. Human gestures, WebMCP tools, preset loads, startup restore,
// and Undo all submit a normalized candidate to ChainEditing.apply(). The
// canvas and AudioGraph are implementation adapters: neither decides that a
// candidate was accepted, owns persistence timing, or updates preset/Undo
// state on its own.
//
// Public interface:
//   ChainEditing.apply({
//     source: 'human' | 'agent' | 'preset' | 'startup' | 'undo',
//     candidate?: [{id, type, params}],
//     change?: {nodeId, param, value},
//     layout?: Object,
//     forceStructural?: boolean,
//     preset?: {name: string|null, modified: boolean},
//     undoLabel?: string,
//     signal?: AbortSignal
//   }) -> Promise<{applied, saved, mode, model, warning?}>
//   ChainEditing.getModel() -> detached accepted-model copy
//   ChainEditing.getLayout() -> detached accepted-layout copy
//   ChainEditing.whenIdle() -> Promise<detached accepted-model copy>
//   ChainEditing.hasPersistenceWarning() -> boolean
//
// Structural work stages/commits the live graph before replacing cards.
// Parameter-only work updates one existing instance and visible control in
// place. A failed apply attempts to restore both adapters to the previously
// accepted model; rollback failure is a distinct error because claiming
// "nothing changed" in that state would be unsafe.

(function () {
  'use strict';

  var acceptedModel = null;
  var acceptedLayout;
  var persistenceWarning = false;
  var queue = Promise.resolve();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cloneModel(model) {
    return (model || []).map(function (entry) {
      return {
        id: entry.id,
        type: entry.type,
        params: Object.assign({}, entry.params || {})
      };
    });
  }

  function currentAcceptedModel() {
    if (acceptedModel === null) {
      var initial = [];
      if (window.ChainCanvas && typeof window.ChainCanvas.getCurrentModel === 'function') {
        initial = window.ChainCanvas.getCurrentModel();
      }
      acceptedModel = cloneModel(initial);
    }
    return cloneModel(acceptedModel);
  }

  function currentLayout() {
    if (window.ChainCanvas && typeof window.ChainCanvas.getCurrentLayout === 'function') {
      try {
        return clone(window.ChainCanvas.getCurrentLayout());
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  function currentAcceptedLayout() {
    if (acceptedLayout === undefined) {
      acceptedLayout = currentLayout();
    }
    return acceptedLayout === null ? null : clone(acceptedLayout);
  }

  function currentPresetState() {
    if (window.PresetsUI && typeof window.PresetsUI.getDisplayState === 'function') {
      try {
        var state = window.PresetsUI.getDisplayState();
        return {
          name: state && state.name !== undefined ? state.name : null,
          modified: !!(state && state.modified)
        };
      } catch (err) {
        // Display state is not required to make the live chain safe.
      }
    }
    return { name: null, modified: false };
  }

  function makeAbortError() {
    var err = new Error('Chain edit was cancelled before it could be accepted.');
    err.name = 'AbortError';
    err.code = 'ABORTED';
    return err;
  }

  function ensureRequest(request) {
    if (!request || (!Array.isArray(request.candidate) && !request.change)) {
      throw new TypeError(
        'ChainEditing.apply: provide request.candidate or one request.change.'
      );
    }
    var source = request.source;
    if (['human', 'agent', 'preset', 'startup', 'undo'].indexOf(source) === -1) {
      throw new TypeError(
        'ChainEditing.apply: request.source must be human, agent, preset, startup, or undo.'
      );
    }
    if (Array.isArray(request.candidate)) {
      request.candidate.forEach(function (entry) {
        if (!entry || typeof entry.id !== 'string' || typeof entry.type !== 'string') {
          throw new TypeError('ChainEditing.apply: each candidate entry needs string id and type.');
        }
      });
    } else if (
      !request.change ||
      typeof request.change.nodeId !== 'string' ||
      typeof request.change.param !== 'string'
    ) {
      throw new TypeError(
        'ChainEditing.apply: request.change needs string nodeId and param.'
      );
    }
  }

  function candidateFor(request, previous) {
    if (Array.isArray(request.candidate)) {
      return cloneModel(request.candidate);
    }
    var found = false;
    var candidate = cloneModel(previous);
    candidate.forEach(function (entry) {
      if (entry.id === request.change.nodeId) {
        entry.params[request.change.param] = request.change.value;
        found = true;
      }
    });
    if (!found) {
      throw new Error(
        'ChainEditing: accepted model no longer contains node "' +
        request.change.nodeId + '".'
      );
    }
    return candidate;
  }

  function singleParamChange(previous, candidate) {
    if (previous.length !== candidate.length || candidate.length === 0) {
      return null;
    }
    var change = null;
    for (var i = 0; i < candidate.length; i++) {
      var before = previous[i];
      var after = candidate[i];
      if (before.id !== after.id || before.type !== after.type) {
        return null;
      }
      var beforeParams = before.params || {};
      var afterParams = after.params || {};
      var keys = Object.keys(beforeParams).concat(Object.keys(afterParams));
      var seen = {};
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (seen[key]) {
          continue;
        }
        seen[key] = true;
        if (beforeParams[key] === afterParams[key]) {
          continue;
        }
        if (change) {
          return null;
        }
        var value = afterParams[key];
        if (!(
          (typeof value === 'number' && isFinite(value)) ||
          typeof value === 'string'
        )) {
          return null;
        }
        change = {
          id: after.id,
          type: after.type,
          param: key,
          value: value,
          previousValue: beforeParams[key],
          params: Object.assign({}, afterParams),
          previousParams: Object.assign({}, beforeParams)
        };
      }
    }
    return change;
  }

  function liveGraphAvailable() {
    return !!(
      window.AudioEngine &&
      window.AudioEngine.audioContext &&
      window.AudioEngine.sourceNode &&
      window.AudioGraph &&
      typeof window.AudioGraph.buildGraph === 'function'
    );
  }

  function paramPathMatchesLiveGraph(change) {
    if (!change || !liveGraphAvailable()) {
      return true;
    }
    if (!(
      window.AudioGraph &&
      typeof window.AudioGraph.getModel === 'function' &&
      typeof window.AudioGraph.getNodeInstance === 'function'
    )) {
      return false;
    }
    var liveType = null;
    try {
      window.AudioGraph.getModel().forEach(function (entry) {
        if (entry.id === change.id) {
          liveType = entry.type;
        }
      });
      return liveType === change.type && !!window.AudioGraph.getNodeInstance(change.id);
    } catch (err) {
      return false;
    }
  }

  function graphFailure(result) {
    if (!result || result.committed !== false) {
      return null;
    }
    var err = result.error instanceof Error
      ? result.error
      : new Error(result.error ? String(result.error) : 'The live graph did not commit.');
    if (result.error && result.error.name) {
      err.name = result.error.name;
    }
    if (result.error && result.error.code) {
      err.code = result.error.code;
    }
    err.graphResult = result;
    return err;
  }

  function buildGraph(model, signal) {
    if (!liveGraphAvailable()) {
      return Promise.resolve({ committed: true, skipped: true });
    }
    var returned;
    try {
      returned = window.AudioGraph.buildGraph(cloneModel(model), { signal: signal });
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(returned).then(function (result) {
      var failure = graphFailure(result);
      if (failure) {
        throw failure;
      }
      return result || { committed: true };
    });
  }

  function applyReusedParams(previous, candidate) {
    if (!(
      window.AudioGraph &&
      typeof window.AudioGraph.getNodeInstance === 'function' &&
      window.NodeTypes &&
      typeof window.NodeTypes.applyParam === 'function'
    )) {
      return;
    }
    var oldTypes = {};
    previous.forEach(function (entry) {
      oldTypes[entry.id] = entry.type;
    });
    candidate.forEach(function (entry) {
      if (oldTypes[entry.id] !== entry.type) {
        return;
      }
      var instance = window.AudioGraph.getNodeInstance(entry.id);
      if (!instance) {
        return;
      }
      Object.keys(entry.params || {}).forEach(function (param) {
        window.NodeTypes.applyParam(entry.type, instance, param, entry.params[param]);
      });
    });
  }

  function renderModel(model, layout) {
    if (!window.ChainCanvas || typeof window.ChainCanvas.renderModel !== 'function') {
      throw new Error('ChainEditing: ChainCanvas.renderModel adapter is unavailable.');
    }
    if (window.ChainCanvas.renderModel(cloneModel(model), layout === null ? undefined : clone(layout)) === false) {
      throw new Error('ChainEditing: canvas refused the candidate model.');
    }
  }

  function renderParam(change) {
    if (!window.ChainCanvas || typeof window.ChainCanvas.renderNodeParam !== 'function') {
      throw new Error('ChainEditing: ChainCanvas.renderNodeParam adapter is unavailable.');
    }
    if (window.ChainCanvas.renderNodeParam(change.id, change.param, change.value) !== true) {
      throw new Error('ChainEditing: canvas no longer contains node "' + change.id + '".');
    }
  }

  function applyParamToGraph(change) {
    if (!window.AudioGraph) {
      return;
    }
    if (typeof window.AudioGraph.updateNodeParams === 'function') {
      window.AudioGraph.updateNodeParams(change.id, change.params);
    }
    if (
      liveGraphAvailable() &&
      typeof window.AudioGraph.getNodeInstance === 'function' &&
      window.NodeTypes &&
      typeof window.NodeTypes.applyParam === 'function'
    ) {
      var instance = window.AudioGraph.getNodeInstance(change.id);
      if (!instance) {
        throw new Error('ChainEditing: live node "' + change.id + '" is unavailable.');
      }
      window.NodeTypes.applyParam(change.type, instance, change.param, change.value);
    }
  }

  function applyPresetState(state) {
    if (!state || !window.PresetsUI) {
      return;
    }
    if (typeof window.PresetsUI.setCurrentPreset === 'function') {
      window.PresetsUI.setCurrentPreset(state.name === undefined ? null : state.name);
    }
    if (state.modified) {
      if (typeof window.PresetsUI.markModified === 'function') {
        window.PresetsUI.markModified();
      }
    } else if (typeof window.PresetsUI.clearModified === 'function') {
      window.PresetsUI.clearModified();
    }
  }

  function markAcceptedEdit(request) {
    if (request.preset) {
      applyPresetState(request.preset);
    } else if (request.source === 'human' || request.source === 'agent') {
      if (window.PresetsUI && typeof window.PresetsUI.markModified === 'function') {
        window.PresetsUI.markModified();
      }
    }
    if (
      (request.source === 'human' || request.source === 'preset') &&
      window.AgentUI &&
      typeof window.AgentUI.noteHumanEdit === 'function'
    ) {
      window.AgentUI.noteHumanEdit();
    }
  }

  function setPersistenceWarning(message) {
    if (window.PresetsUI && typeof window.PresetsUI.setPersistenceWarning === 'function') {
      try {
        window.PresetsUI.setPersistenceWarning(message || null);
      } catch (err) {
        // A display failure must not change the storage result.
      }
    }
  }

  function persist(model) {
    if (!window.Persistence || typeof window.Persistence.saveCurrentChain !== 'function') {
      return { saved: true };
    }
    var result;
    try {
      result = window.Persistence.saveCurrentChain(cloneModel(model), currentLayout());
    } catch (err) {
      result = { saved: false, error: err };
    }
    if (result && result.saved === false) {
      persistenceWarning = true;
      setPersistenceWarning(
        'Autosave failed. The live chain is applied, but this change may be lost on reload.'
      );
      return {
        saved: false,
        warning: {
          code: 'AUTOSAVE_FAILED',
          message: 'The live chain is applied, but autosave could not be verified.'
        }
      };
    }
    if (persistenceWarning) {
      persistenceWarning = false;
      setPersistenceWarning(null);
    }
    return { saved: true };
  }

  function pushAgentUndo(request, snapshot) {
    if (
      request.source !== 'agent' ||
      typeof request.undoLabel !== 'string' ||
      request.undoLabel.length === 0 ||
      !window.AgentUI ||
      typeof window.AgentUI.pushUndo !== 'function'
    ) {
      return;
    }
    window.AgentUI.pushUndo({
      label: request.undoLabel,
      restore: function () {
        return apply({
          source: 'undo',
          candidate: snapshot.model,
          layout: snapshot.layout,
          forceStructural: true,
          preset: snapshot.preset
        });
      }
    });
  }

  function rollbackParam(change) {
    var rollbackChange = {
      id: change.id,
      type: change.type,
      param: change.param,
      value: change.previousValue,
      params: change.previousParams
    };
    applyParamToGraph(rollbackChange);
    renderParam(rollbackChange);
  }

  function rollbackStructural(previous, previousLayout, candidate) {
    return buildGraph(previous).then(function () {
      applyReusedParams(candidate, previous);
      renderModel(previous, previousLayout);
      return { attempted: true, succeeded: true };
    });
  }

  function failureWithRollback(cause, rollback) {
    if (cause && cause.name === 'AbortError' && rollback.succeeded) {
      cause.rollback = rollback;
      return cause;
    }
    var err;
    if (rollback.succeeded) {
      err = new Error(
        'Chain edit failed and was rolled back to the previously accepted state: ' +
        (cause && cause.message ? cause.message : String(cause))
      );
      err.code = 'CHAIN_APPLY_FAILED';
    } else {
      err = new Error(
        'Chain edit failed; rollback also failed and the live state may have changed: ' +
        (cause && cause.message ? cause.message : String(cause))
      );
      err.code = 'CHAIN_ROLLBACK_FAILED';
    }
    err.cause = cause;
    err.rollback = rollback;
    return err;
  }

  function perform(request) {
    ensureRequest(request);
    if (request.signal && request.signal.aborted) {
      return Promise.reject(makeAbortError());
    }

    var previous = currentAcceptedModel();
    var candidate;
    try {
      candidate = candidateFor(request, previous);
    } catch (err) {
      return Promise.reject(err);
    }
    var previousLayout = currentAcceptedLayout();
    var snapshot = {
      model: previous,
      layout: previousLayout,
      preset: currentPresetState()
    };
    var change = request.forceStructural ? null : singleParamChange(previous, candidate);
    if (change && !paramPathMatchesLiveGraph(change)) {
      change = null;
    }
    var mode = change ? 'parameter' : 'structural';
    var liveCommitted = false;

    var commit;
    if (change) {
      commit = Promise.resolve().then(function () {
        applyParamToGraph(change);
        liveCommitted = true;
        renderParam(change);
      });
    } else {
      commit = buildGraph(candidate, request.signal).then(function () {
        liveCommitted = true;
        if (request.signal && request.signal.aborted) {
          throw makeAbortError();
        }
        applyReusedParams(previous, candidate);
        renderModel(candidate, request.layout === undefined ? previousLayout : request.layout);
      });
    }

    return commit.then(function () {
      acceptedModel = cloneModel(candidate);
      if (mode === 'structural') {
        acceptedLayout = request.layout === undefined
          ? (previousLayout === null ? null : clone(previousLayout))
          : clone(request.layout);
      }
      markAcceptedEdit(request);
      var saved = persist(candidate);
      pushAgentUndo(request, snapshot);
      var result = {
        applied: true,
        saved: saved.saved,
        mode: mode,
        model: cloneModel(candidate)
      };
      if (saved.warning) {
        result.warning = saved.warning;
      }
      return result;
    }).catch(function (cause) {
      var rollbackPromise;
      if (
        mode === 'structural' &&
        cause &&
        cause.graphResult &&
        cause.graphResult.canceled &&
        cause.graphResult.rollback &&
        cause.graphResult.rollback.succeeded
      ) {
        rollbackPromise = Promise.resolve(cause.graphResult.rollback);
      } else if (mode === 'parameter') {
        rollbackPromise = Promise.resolve().then(function () {
          rollbackParam(change);
          return { attempted: true, succeeded: true };
        });
      } else {
        rollbackPromise = rollbackStructural(previous, previousLayout, candidate);
      }
      return rollbackPromise.catch(function (rollbackError) {
        return {
          attempted: true,
          succeeded: false,
          error: rollbackError,
          liveCommitStarted: liveCommitted
        };
      }).then(function (rollback) {
        if (rollback.succeeded) {
          acceptedModel = cloneModel(previous);
          acceptedLayout = previousLayout === null ? null : clone(previousLayout);
        }
        throw failureWithRollback(cause, rollback);
      });
    });
  }

  function apply(request) {
    var run = queue.then(function () {
      return perform(request);
    });
    queue = run.catch(function () {
      // Keep later independent edits usable after a failed transaction.
    });
    return run;
  }

  window.ChainEditing = {
    apply: apply,
    getModel: currentAcceptedModel,
    getLayout: currentAcceptedLayout,
    whenIdle: function () {
      return queue.then(function () { return currentAcceptedModel(); });
    },
    hasPersistenceWarning: function () { return persistenceWarning; }
  };
})();
