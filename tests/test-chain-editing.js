// Issue #20 — the deep Chain Editing module.
//
// This is the focused contract test for the one in-process mutation seam.
// It loads the real src/chain-editing.js against small adapters and proves
// transaction ordering, rollback truthfulness, the no-rebuild param path,
// autosave-warning latching, source-specific preset/revision behavior, and
// post-commit Undo ownership. No browser or third-party dependencies.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = 0;

function check(condition, message) {
  if (condition) {
    console.log('  ok - ' + message);
  } else {
    failures += 1;
    console.error('  FAIL - ' + message);
  }
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function node(id, type, params) {
  return { id: id, type: type, params: params || {} };
}

function makeHarness(initial) {
  var records = [];
  var canvasModel = copy(initial);
  var graphModel = copy(initial);
  var layout = { a: { x: 10, y: 20 } };
  var saveResult = { saved: true };
  var graphBehavior = null;
  var presetState = { name: 'Classic', modified: false };
  var undoEntries = [];

  var sandbox = {
    console: console,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    window: null
  };
  sandbox.window = sandbox;

  sandbox.AudioEngine = {
    audioContext: {},
    sourceNode: {}
  };
  sandbox.AudioGraph = {
    getModel: function () { return copy(graphModel); },
    getNodeInstance: function (id) { return { id: id }; },
    updateNodeParams: function (id, params) {
      records.push('graph:param:' + id);
      graphModel.forEach(function (entry) {
        if (entry.id === id) {
          entry.params = copy(params);
        }
      });
    },
    buildGraph: function (model, options) {
      records.push('graph:build:' + model.map(function (entry) { return entry.id; }).join(','));
      if (graphBehavior) {
        return graphBehavior(model, function (next) { graphModel = copy(next); }, options || {});
      }
      graphModel = copy(model);
      return Promise.resolve({ committed: true });
    }
  };
  sandbox.NodeTypes = {
    applyParam: function (type, instance, param, value) {
      records.push('live:param:' + instance.id + ':' + param + ':' + value);
    }
  };
  sandbox.ChainCanvas = {
    getCurrentModel: function () { return copy(canvasModel); },
    getCurrentLayout: function () { return copy(layout); },
    renderModel: function (model, nextLayout) {
      records.push('canvas:render:' + model.map(function (entry) { return entry.id; }).join(','));
      canvasModel = copy(model);
      if (nextLayout) {
        layout = copy(nextLayout);
      }
      return true;
    },
    renderNodeParam: function (id, param, value) {
      records.push('canvas:param:' + id + ':' + param + ':' + value);
      var found = false;
      canvasModel.forEach(function (entry) {
        if (entry.id === id) {
          entry.params[param] = value;
          found = true;
        }
      });
      return found;
    }
  };
  sandbox.Persistence = {
    saveCurrentChain: function (model) {
      records.push('persist:' + model.map(function (entry) { return entry.id; }).join(','));
      return saveResult;
    }
  };
  sandbox.PresetsUI = {
    getDisplayState: function () { return copy(presetState); },
    setCurrentPreset: function (name) {
      records.push('preset:name:' + String(name));
      presetState.name = name;
    },
    markModified: function () {
      records.push('preset:modified');
      presetState.modified = true;
    },
    clearModified: function () {
      records.push('preset:clean');
      presetState.modified = false;
    },
    setPersistenceWarning: function (message) {
      records.push(message ? 'warning:set' : 'warning:clear');
    }
  };
  sandbox.AgentUI = {
    noteHumanEdit: function () { records.push('revision:human'); },
    pushUndo: function (entry) {
      records.push('undo:push:' + entry.label);
      undoEntries.push(entry);
      return true;
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/chain-editing.js'), 'utf8'),
    sandbox,
    { filename: 'src/chain-editing.js' }
  );

  return {
    window: sandbox,
    records: records,
    canvasModel: function () { return copy(canvasModel); },
    graphModel: function () { return copy(graphModel); },
    layout: function () { return copy(layout); },
    presetState: function () { return copy(presetState); },
    undoEntries: undoEntries,
    setSaveResult: function (result) { saveResult = result; },
    setGraphBehavior: function (fn) { graphBehavior = fn; },
    setGraphModel: function (model) { graphModel = copy(model); }
  };
}

async function expectReject(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  return null;
}

async function main() {
  console.log('A. structural commit is ordered and source-aware');
  var h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  var next = [node('a', 'gain', { gainDb: 0 }), node('b', 'limiter', { ceilingDb: -1 })];
  var result = await h.window.ChainEditing.apply({
    source: 'human',
    candidate: next,
    undoLabel: 'must not be used for human'
  });
  check(result.applied === true && result.mode === 'structural' && result.saved === true,
    'A1: structural apply reports committed + saved truthfully');
  check(JSON.stringify(h.window.ChainEditing.getModel()) === JSON.stringify(next),
    'A2: the module owns the accepted logical model');
  check(h.records.indexOf('graph:build:a,b') < h.records.indexOf('canvas:render:a,b') &&
      h.records.indexOf('canvas:render:a,b') < h.records.indexOf('persist:a,b'),
    'A3: live graph commits before rendered state, then autosave follows');
  check(h.records.filter(function (x) { return x === 'revision:human'; }).length === 1,
    'A4: one accepted human edit bumps revision exactly once');
  check(h.records.indexOf('preset:modified') !== -1 && h.undoEntries.length === 0,
    'A5: a human edit marks the preset modified and never creates agent Undo');

  console.log('B. failed structural work rolls back or reports uncertainty');
  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  h.setGraphBehavior(function (model) {
    if (model.length > 1) {
      throw new Error('factory failed');
    }
    return Promise.resolve({ committed: true });
  });
  var err = await expectReject(h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('a', 'gain', { gainDb: 0 }), node('bad', 'unknown')],
    undoLabel: 'Add unknown'
  }));
  check(err && err.code === 'CHAIN_APPLY_FAILED' && err.rollback && err.rollback.succeeded === true,
    'B1: a failed graph factory returns an explicit successful rollback status');
  check(err && /rolled back/i.test(err.message) && JSON.stringify(h.canvasModel()) === JSON.stringify([node('a', 'gain', { gainDb: 0 })]),
    'B2: successful rollback says so and leaves the rendered chain at the accepted model');
  check(h.records.filter(function (x) { return x.indexOf('persist:') === 0; }).length === 0 && h.undoEntries.length === 0,
    'B3: failed work neither autosaves nor pushes Undo');

  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  h.setGraphBehavior(function (model, setGraph) {
    if (model.length > 1) {
      setGraph(model);
      throw new Error('candidate damaged the live graph');
    }
    throw new Error('rollback factory failed');
  });
  err = await expectReject(h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('a', 'gain', { gainDb: 0 }), node('b', 'limiter')],
    undoLabel: 'Add limiter'
  }));
  check(err && err.code === 'CHAIN_ROLLBACK_FAILED' && err.rollback && err.rollback.succeeded === false,
    'B4: rollback failure has a distinct machine status');
  check(err && /may have changed/i.test(err.message) && !/nothing changed/i.test(err.message),
    'B5: uncertain rollback never claims that nothing changed');

  console.log('C. one-param edits keep the no-rebuild path');
  h = makeHarness([node('a', 'gain', { gainDb: 0 }), node('z', 'limiter', { ceilingDb: -1 })]);
  result = await h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('a', 'gain', { gainDb: 3 }), node('z', 'limiter', { ceilingDb: -1 })],
    undoLabel: 'Set gain'
  });
  check(result.mode === 'parameter' && h.records.filter(function (x) { return x.indexOf('graph:build:') === 0; }).length === 0,
    'C1: an exact one-param change performs zero graph rebuilds');
  check(h.records.indexOf('graph:param:a') !== -1 && h.records.indexOf('live:param:a:gainDb:3') !== -1 &&
      h.records.indexOf('canvas:param:a:gainDb:3') !== -1,
    'C2: graph bookkeeping, live node, and visible control all update in place');
  check(h.records.filter(function (x) { return x.indexOf('canvas:render:') === 0; }).length === 0,
    'C3: the parameter path replaces no cards');
  check(h.undoEntries.length === 1 && h.records.indexOf('undo:push:Set gain') > h.records.indexOf('persist:a,z'),
    'C4: agent Undo is pushed only after the live commit and autosave attempt');

  h = makeHarness([node('a', 'gain', { gainDb: 0 }), node('z', 'limiter', { ceilingDb: -1 })]);
  h.setGraphModel([node('a', 'delay', { gainDb: 0 }), node('z', 'limiter', { ceilingDb: -1 })]);
  result = await h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('a', 'gain', { gainDb: 3 }), node('z', 'limiter', { ceilingDb: -1 })],
    undoLabel: 'Repair and set gain'
  });
  check(result.mode === 'structural' && h.records.indexOf('graph:build:a,z') !== -1,
    'C5: a live id/type mismatch refuses the param path and rebuilds safely');

  console.log('D. autosave failure is applied-but-not-saved and latched');
  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  h.setSaveResult({ saved: false, error: new Error('quota') });
  result = await h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('a', 'gain', { gainDb: 1 })],
    undoLabel: 'Set gain'
  });
  check(result.applied === true && result.saved === false && result.warning && result.warning.code === 'AUTOSAVE_FAILED',
    'D1: persistence failure does not roll back a live edit and is returned truthfully');
  check(h.window.ChainEditing.hasPersistenceWarning() === true && h.records.indexOf('warning:set') !== -1,
    'D2: autosave failure latches the operator warning');
  h.setSaveResult({ saved: true });
  result = await h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('a', 'gain', { gainDb: 2 })],
    undoLabel: 'Set gain again'
  });
  check(result.saved === true && h.window.ChainEditing.hasPersistenceWarning() === false && h.records.indexOf('warning:clear') !== -1,
    'D3: only a later verified save clears the warning');

  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  h.window.ChainEditing.syncLayout({ a: { x: 96, y: 48 } });
  h.setGraphBehavior(function (model) {
    if (model.length > 1) {
      throw new Error('structural candidate failed');
    }
    return Promise.resolve({ committed: true });
  });
  err = await expectReject(h.window.ChainEditing.apply({
    source: 'human',
    candidate: [node('a', 'gain', { gainDb: 0 }), node('bad', 'unknown')],
    layout: { a: { x: 96, y: 48 }, bad: { x: 192, y: 48 } },
    forceStructural: true
  }));
  check(err && err.rollback && err.rollback.succeeded === true && h.layout().a.x === 96,
    'D4: a failed structural edit restores the latest accepted layout-only movement');

  console.log('E. preset, startup, cancellation, and Undo cross the same seam');
  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  result = await h.window.ChainEditing.apply({
    source: 'preset',
    candidate: [node('p', 'limiter', { ceilingDb: -1 })],
    forceStructural: true,
    preset: { name: 'Safe Voice', modified: false }
  });
  check(h.presetState().name === 'Safe Voice' && h.presetState().modified === false &&
      h.records.indexOf('preset:clean') > h.records.indexOf('canvas:render:p'),
    'E1: a preset becomes the clean baseline only after its chain commits');
  check(h.records.indexOf('revision:human') !== -1,
    'E2: an accepted human preset load bumps human revision once');

  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  result = await h.window.ChainEditing.apply({
    source: 'startup',
    candidate: [node('s', 'limiter', { ceilingDb: -1 })],
    forceStructural: true
  });
  check(result.applied === true && h.records.indexOf('preset:modified') === -1 && h.records.indexOf('revision:human') === -1,
    'E3: startup restoration commits without pretending to be a human edit');

  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  var signal = { aborted: true };
  err = await expectReject(h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('b', 'limiter')],
    signal: signal,
    undoLabel: 'Cancelled'
  }));
  check(err && err.name === 'AbortError' && h.records.length === 0,
    'E4: a pre-cancelled request performs no graph, canvas, persistence, preset, revision, or Undo work');

  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  var preCommitController = new AbortController();
  h.setGraphBehavior(function (model, setGraph, options) {
    return new Promise(function (resolve) {
      options.signal.addEventListener('abort', function () {
        var abortError = new Error('cancelled while staged');
        abortError.name = 'AbortError';
        resolve({
          committed: false,
          canceled: true,
          error: abortError,
          rollback: { attempted: false, succeeded: true }
        });
      }, { once: true });
    });
  });
  var preCommitApply = h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('b', 'limiter')],
    signal: preCommitController.signal,
    undoLabel: 'Cancelled while staged'
  });
  await Promise.resolve();
  preCommitController.abort();
  err = await expectReject(preCommitApply);
  check(err && err.name === 'AbortError' && err.rollback && err.rollback.succeeded === true,
    'E5: cancellation reaches graph staging and reports the unchanged graph truthfully');
  check(h.records.filter(function (x) { return x.indexOf('graph:build:') === 0; }).length === 1 &&
      h.records.filter(function (x) { return x.indexOf('canvas:') === 0 || x.indexOf('persist:') === 0 || x.indexOf('undo:') === 0; }).length === 0,
    'E5: a staged cancellation performs no rollback rebuild, render, persistence, or Undo work');

  h = makeHarness([node('a', 'gain', { gainDb: 0 })]);
  await h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('a', 'gain', { gainDb: 4 })],
    undoLabel: 'Raise gain'
  });
  check(h.undoEntries.length === 1, 'E6: a committed agent edit creates one Undo snapshot');
  await h.undoEntries[0].restore();
  check(JSON.stringify(h.window.ChainEditing.getModel()) === JSON.stringify([node('a', 'gain', { gainDb: 0 })]),
    'E7: Undo restores the captured pre-state through ChainEditing');
  check(h.undoEntries.length === 1 && h.records.filter(function (x) { return x.indexOf('undo:push:') === 0; }).length === 1,
    'E8: an Undo restore never creates a recursive Undo entry');

  console.log('F. named structural operations share the same interface contract');
  h = makeHarness([node('a', 'gain'), node('b', 'delay'), node('z', 'limiter')]);
  await h.window.ChainEditing.apply({
    source: 'human',
    candidate: [node('a', 'gain'), node('z', 'limiter')]
  });
  check(h.window.ChainEditing.getModel().map(function (entry) { return entry.id; }).join(',') === 'a,z',
    'F1: remove commits through ChainEditing');
  await h.window.ChainEditing.apply({
    source: 'human',
    candidate: [node('z', 'limiter'), node('a', 'gain')]
  });
  check(h.window.ChainEditing.getModel().map(function (entry) { return entry.id; }).join(',') === 'z,a',
    'F2: reorder commits through ChainEditing');
  await h.window.ChainEditing.apply({
    source: 'agent',
    candidate: [node('replacement', 'limiter')],
    undoLabel: 'Replace chain'
  });
  check(h.window.ChainEditing.getModel().map(function (entry) { return entry.id; }).join(',') === 'replacement' &&
      h.canvasModel().map(function (entry) { return entry.id; }).join(',') === 'replacement' &&
      h.graphModel().map(function (entry) { return entry.id; }).join(',') === 'replacement',
    'F3: full replacement leaves accepted, rendered, and live models identical');

  console.log('G. normalized intents serialize without stale-model loss');
  h = makeHarness([
    node('a', 'gain', { gainDb: 0 }),
    node('b', 'delay', { mix: 20 }),
    node('z', 'limiter', { ceilingDb: -1 })
  ]);
  var firstIntent = h.window.ChainEditing.apply({
    source: 'human',
    change: { nodeId: 'a', param: 'gainDb', value: 2 }
  });
  var secondIntent = h.window.ChainEditing.apply({
    source: 'human',
    change: { nodeId: 'b', param: 'mix', value: 35 }
  });
  await Promise.all([firstIntent, secondIntent]);
  var queuedModel = h.window.ChainEditing.getModel();
  check(queuedModel[0].params.gainDb === 2 && queuedModel[1].params.mix === 35,
    'G1: two immediate edits on different nodes both survive queueing');
  check(h.records.filter(function (x) { return x.indexOf('graph:build:') === 0; }).length === 0,
    'G2: both queued one-param intents keep the no-rebuild path');
  check(h.records.filter(function (x) { return x === 'revision:human'; }).length === 2,
    'G3: each accepted human intent bumps revision once, with no duplicate bump');

  console.log('H. production script order installs the seam before consumers');
  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var presetIndex = html.indexOf('<script src="src/presets-ui.js"');
  var editingIndex = html.indexOf('<script src="src/chain-editing.js"');
  var toolsIndex = html.indexOf('<script src="src/mcp-tools.js"');
  var mainIndex = html.indexOf('<script src="src/main.js"');
  check(presetIndex !== -1 && presetIndex < editingIndex && editingIndex < toolsIndex && editingIndex < mainIndex,
    'H1: PresetsUI loads before ChainEditing, which loads before WebMCP and startup');

  var mutationSources = [
    'src/canvas.js',
    'src/param-controls.js',
    'src/presets-ui.js',
    'src/mcp-tools.js',
    'src/main.js'
  ].map(function (relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  }).join('\n');
  check(
    mutationSources.indexOf('legacy harness fallback') === -1 &&
      mutationSources.indexOf('applyCandidateViaUi') === -1 &&
      mutationSources.indexOf('applyParamOnlyViaUi') === -1 &&
      mutationSources.indexOf('assertLegacyMutationHarness') === -1,
    'H2: production callers have no legacy mutation bypass around ChainEditing'
  );

  var fixtureSources = fs.readdirSync(path.join(ROOT, 'tests'))
    .filter(function (name) {
      return /^test-.*\.js$/.test(name) && name !== 'test-chain-editing.js';
    })
    .map(function (name) {
      return fs.readFileSync(path.join(ROOT, 'tests', name), 'utf8');
    })
    .join('\n');
  var retiredFixtureAdapterPattern =
    /(?:^|[,{]\s*)['"]?(?:loadModel|updateNodeParam)['"]?\s*(?::|\([^)]*\)\s*\{)/m;
  check(
    !retiredFixtureAdapterPattern.test(fixtureSources),
    'H3: test fixtures contain no retired direct-mutation adapter implementations'
  );
  check(
    [
      '{ loadModel: function () {} }',
      '{ loadModel: () => {} }',
      '{ updateNodeParam: fixtureHelper }',
      '{ updateNodeParam() {} }'
    ].every(function (sample) {
      return retiredFixtureAdapterPattern.test(sample);
    }),
    'H4: the fixture architecture gate rejects function, arrow, helper, and method syntaxes'
  );
  var architectureHarness = makeHarness([node('gate', 'gain', { gainDb: 0 })]);
  check(
    !Object.prototype.hasOwnProperty.call(architectureHarness.window.ChainCanvas, 'loadModel') &&
      !Object.prototype.hasOwnProperty.call(architectureHarness.window.ChainCanvas, 'updateNodeParam'),
    'H5: this test file\'s ChainCanvas harness exposes no retired mutation adapter'
  );

  if (failures > 0) {
    console.error('\n' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nAll Chain Editing contract checks passed.');
}

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
