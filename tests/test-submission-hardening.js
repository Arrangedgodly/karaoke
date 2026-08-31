// Submission-hardening round (2026-08-31, issues #5/#15/#16): one file
// pinning the behaviors the audit findings fixed, in the committed-test
// convention — a zero-dependency Node harness that loads the REAL src
// files into a vm sandbox so the code under test is exactly what ships
// in index.html.
//
// Covered, one section per audit finding:
//
//   A. Pre-Start agent mutations refuse with one stable result
//      (ENGINE_NOT_STARTED) — the human board is gated until Start, so an
//      agent edit must not change state the operator cannot see.
//   B. A mid-apply crash of the WebMCP write path ROLLS BACK the
//      pre-apply snapshot and reports the rollback truthfully — never the
//      old false "Nothing in the app was changed" hint (#16 finding).
//   C. Rapid superseding AudioGraph rebuilds dispose their orphaned
//      factory-fresh Tone-style instances, and a Phase-1 factory throw
//      disposes its partial creations (#16 finding).
//   D. The autosave health latch: failures latch + announce, recovery
//      clears (#16 finding).
//   E. The sound-design guide reports the canonical VOXCHAIN identity,
//      the lo-fi bit-depth direction (fewer bits = more crushed), and
//      per-line filtering against a degraded live registry (#15).
//   F. get_chain exposes the output-authority context (Bypass engagement
//      + watchdog mute) so an agent can explain a silent chain before
//      asking the human to listen (#15).
//
// Run from a clean clone:  node tests/test-submission-hardening.js
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

var failures = [];
var SECTION = '';

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push((SECTION ? SECTION + ': ' : '') + label);
    console.log('  FAIL - ' + label);
  }
}

function section(name) {
  SECTION = name;
  console.log(name);
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// buildGraph() commits on the deferred rewire (~20ms); 60ms is the
// suite's comfortable settle.
function settle() {
  return sleep(60);
}

// ----------------------------------------------------------------------
// Minimal Web Audio stubs (the test-node-reuse-type-match shapes).
// ----------------------------------------------------------------------
function makeParam(initial) {
  return {
    value: initial,
    cancelScheduledValues: function () {},
    setValueAtTime: function (v) { this.value = v; },
    linearRampToValueAtTime: function (v) { this.value = v; }
  };
}

function makeBaseNode(typeName) {
  return {
    __nodeTypeName: typeName,
    __connectionsTo: [],
    connect: function (dest) { this.__connectionsTo.push(dest); },
    disconnect: function () { this.__connectionsTo = []; }
  };
}

function makeGainNode() {
  var node = makeBaseNode('GainNode');
  node.gain = makeParam(1);
  return node;
}

// ----------------------------------------------------------------------
// Sandbox construction.
// ----------------------------------------------------------------------
function createBaseSandbox() {
  var domEvents = [];
  var sandbox = {
    console: console,
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function (id) { return clearTimeout(id); },
    setInterval: function (fn, ms) { return setInterval(fn, ms); },
    clearInterval: function (id) { return clearInterval(id); },
    Date: Date,
    Promise: Promise,
    document: {
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      dispatchEvent: function (ev) {
        domEvents.push(ev.type);
        return true;
      }
    },
    CustomEvent: function (type) { this.type = type; }
  };
  sandbox.window = sandbox;
  sandbox.__domEvents = domEvents;
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

function getTool(sandbox, name) {
  var defs = sandbox.McpTools.getDefs();
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].name === name) {
      return defs[i];
    }
  }
  throw new Error('test bug: tool def not found: ' + name);
}

function copyModel(model) {
  return model.map(function (entry) {
    return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
  });
}

// A minimal started-engine audio context for audio-graph loads (section C).
function installStartedEngine(sandbox) {
  sandbox.AudioEngine = {
    isStarted: true,
    audioContext: {
      currentTime: 0,
      destination: makeBaseNode('AudioDestinationNode'),
      createGain: makeGainNode
    },
    sourceNode: makeBaseNode('MediaStreamAudioSourceNode')
  };
}

// ChainCanvas stub with a controllable loadModel (sections A/B): records
// every call, optionally throws N times before accepting, and mirrors the
// real one's model ownership.
function installChainCanvasStub(sandbox, seedModel, throwTimes) {
  var model = copyModel(seedModel || []);
  var state = { model: model, loadCalls: 0, thrown: 0, throwTimes: throwTimes || 0 };
  sandbox.__canvasState = state;
  sandbox.ChainCanvas = {
    getCurrentModel: function () { return copyModel(state.model); },
    isDragActive: function () { return false; },
    loadModel: function (next) {
      state.loadCalls += 1;
      if (state.thrown < state.throwTimes) {
        state.thrown += 1;
        throw new Error('harnes: loadModel failure #' + state.thrown);
      }
      state.model = copyModel(next);
      if (sandbox.AudioGraph && sandbox.AudioEngine && sandbox.AudioEngine.isStarted) {
        sandbox.AudioGraph.buildGraph(
          state.model.map(function (entry) {
            return { id: entry.id, type: entry.type, params: entry.params };
          })
        );
      }
    }
  };
}

// The minimal valid two-node chain every mutation below edits.
function seedChain() {
  return [
    { id: 'g1', type: 'gain', params: { gainDb: 0 } },
    { id: 'l1', type: 'limiter', params: { ceiling: -6 } }
  ];
}

async function main() {
  // ====================================================================
  section('A. pre-Start mutations refuse with the stable ENGINE_NOT_STARTED result');
  // ====================================================================
  {
    var sbA = createBaseSandbox();
    sbA.AudioEngine = { isStarted: false };
    loadSrc(sbA, 'src/preset-schema.js');
    installChainCanvasStub(sbA, seedChain(), 0);
    loadSrc(sbA, 'src/mcp-tools.js');

    var setChainA = getTool(sbA, 'set_chain');
    var resA = await setChainA.execute({
      chain: {
        schemaVersion: 1,
        name: 'pre-start attempt',
        nodes: [
          { id: 'x1', type: 'reverb', params: { mix: 20 } },
          { id: 'l1', type: 'limiter', params: { ceiling: -6 } }
        ]
      }
    });
    check(
      resA && resA.error === true && resA.code === 'ENGINE_NOT_STARTED' &&
        resA.retry === true && typeof resA.reason === 'string',
      'A1: set_chain pre-Start resolves the stable ENGINE_NOT_STARTED refusal (retryable)'
    );
    check(
      sbA.__canvasState.loadCalls === 0 &&
        JSON.stringify(sbA.__canvasState.model) === JSON.stringify(seedChain()),
      'A2: NOTHING was applied — loadModel never ran, the model is byte-identical'
    );
    // Reads stay available pre-Start (the parity rule gates MUTATIONS).
    var chainRead = await getTool(sbA, 'get_chain').execute({});
    check(
      chainRead && Array.isArray(chainRead.nodes) && chainRead.nodes.length === 2 &&
        chainRead.engine && chainRead.engine.started === false,
      'A3: get_chain still reads pre-Start (reads are not gated)'
    );
    // Post-Start the same call applies (the refusal is a state, not a lockout).
    sbA.AudioEngine.isStarted = true;
    var resA2 = await setChainA.execute({
      chain: {
        schemaVersion: 1,
        name: 'post-start same call',
        nodes: [
          { id: 'x1', type: 'reverb', params: { mix: 20 } },
          { id: 'l1', type: 'limiter', params: { ceiling: -6 } }
        ]
      }
    });
    check(
      resA2 && resA2.applied === true && sbA.__canvasState.loadCalls === 1,
      'A4: the SAME call applies once the engine has started'
    );
  }

  // ====================================================================
  section('B. a mid-apply crash rolls the snapshot back and says so truthfully');
  // ====================================================================
  {
    // B1: the apply throws, the restore succeeds -> rollback:'restored'.
    var sbB = createBaseSandbox();
    sbA_engine_setup(sbB);
    loadSrc(sbB, 'src/preset-schema.js');
    installChainCanvasStub(sbB, seedChain(), 1); // FIRST loadModel (the apply) throws
    loadSrc(sbB, 'src/mcp-tools.js');

    var setChainB = getTool(sbB, 'set_chain');
    var resB = await setChainB.execute({
      chain: {
        schemaVersion: 1,
        name: 'crashing apply',
        nodes: [
          { id: 'x1', type: 'reverb', params: { mix: 20 } },
          { id: 'l1', type: 'limiter', params: { ceiling: -6 } }
        ]
      }
    });
    check(
      resB && resB.error === true && resB.code === 'SCHEMA_LAYER_FAULT' &&
        resB.rollback === 'restored',
      'B1: the crash resolves SCHEMA_LAYER_FAULT with rollback:"restored"'
    );
    check(
      typeof resB.hint === 'string' && /restored/i.test(resB.hint) &&
        !/Nothing in the app was changed/.test(resB.hint),
      'B2: the hint says the previous chain was RESTORED — the false "nothing changed" claim is gone'
    );
    check(
      sbB.__canvasState.loadCalls === 2 &&
        JSON.stringify(sbB.__canvasState.model) === JSON.stringify(seedChain()),
      'B3: the snapshot restore actually ran (apply attempt + restore) and the model is back to the seed'
    );

    // B2: the apply AND the restore throw -> rollback:'failed' (split state
    // is reported, never hidden behind a clean-looking refusal).
    var sbB2 = createBaseSandbox();
    sbA_engine_setup(sbB2);
    loadSrc(sbB2, 'src/preset-schema.js');
    installChainCanvasStub(sbB2, seedChain(), 2); // apply AND restore throw
    loadSrc(sbB2, 'src/mcp-tools.js');
    var resB2 = await getTool(sbB2, 'set_chain').execute({
      chain: {
        schemaVersion: 1,
        name: 'crashing apply and restore',
        nodes: [
          { id: 'x1', type: 'reverb', params: { mix: 20 } },
          { id: 'l1', type: 'limiter', params: { ceiling: -6 } }
        ]
      }
    });
    check(
      resB2 && resB2.error === true && resB2.rollback === 'failed' &&
        /Reload the page/.test(resB2.hint),
      'B4: when the restore also fails the result says rollback:"failed" and tells the operator to reload'
    );
  }

  // ====================================================================
  section('C. superseded rebuilds + Phase-1 throws dispose orphaned instances');
  // ====================================================================
  {
    var sbC = createBaseSandbox();
    installStartedEngine(sbC);
    loadSrc(sbC, 'src/audio-graph.js');

    // A Tone-shaped type: composite with input/output + dispose() — the
    // adapter contract whose leak the finding described.
    var instances = [];
    var nextTag = 0;
    sbC.AudioGraph.registerNodeType('toneFake', function (audioContext) {
      var inst = {
        tag: ++nextTag,
        input: audioContext.createGain(),
        output: audioContext.createGain(),
        disposed: false,
        dispose: function () { inst.disposed = true; }
      };
      instances.push(inst);
      return inst;
    });

    // Two rapid builds before the ~20ms rewire: the second supersedes the
    // first, orphaning the first build's factory-fresh instance.
    sbC.AudioGraph.buildGraph([{ id: 't1', type: 'toneFake' }]);
    var buildOne = instances[0];
    sbC.AudioGraph.buildGraph([{ id: 't1', type: 'toneFake' }, { id: 't2', type: 'toneFake' }]);
    check(
      buildOne.disposed === true,
      'C1: the superseded build\'s factory-fresh instance is disposed synchronously at supersede'
    );
    await settle();
    var committed = sbC.AudioGraph.getNodeInstance('t1');
    var committed2 = sbC.AudioGraph.getNodeInstance('t2');
    check(
      committed && !committed.disposed && committed2 && !committed2.disposed,
      'C2: the committing build\'s instances survive (reuse + fresh alike)'
    );

    // A Phase-1 factory throw mid-map: earlier creations of THAT build are
    // disposed before the synchronous rethrow.
    sbC.AudioGraph.registerNodeType('toneThrow', function () {
      throw new Error('factory boom');
    });
    var before = instances.length;
    var threw = false;
    try {
      sbC.AudioGraph.buildGraph([
        { id: 't3', type: 'toneFake' },
        { id: 't4', type: 'toneThrow' }
      ]);
    } catch (e) {
      threw = true;
    }
    var partial = instances[before];
    check(
      threw && partial && partial.disposed === true,
      'C3: a Phase-1 factory throw disposes the build\'s partial creations, then rethrows'
    );
    check(
      sbC.AudioGraph.getNodeInstance('t1') === committed &&
        !committed.disposed,
      'C4: the throwing build leaves the live chain untouched (committed instance still current)'
    );
  }

  // ====================================================================
  section('D. the autosave health latch');
  // ====================================================================
  {
    var sbD = createBaseSandbox();
    var store = {};
    var setItemShouldThrow = false;
    sbD.localStorage = {
      getItem: function (k) { return store[k] !== undefined ? store[k] : null; },
      setItem: function (k, v) {
        if (setItemShouldThrow) {
          throw new Error('QuotaExceededError');
        }
        store[k] = String(v);
      },
      removeItem: function (k) { delete store[k]; }
    };
    loadSrc(sbD, 'src/preset-schema.js');
    loadSrc(sbD, 'src/default-preset.js');
    loadSrc(sbD, 'src/preset-store.js');
    loadSrc(sbD, 'src/persistence.js');

    sbD.Persistence.saveCurrentChain(seedChain());
    check(
      sbD.Persistence.isSaveFailed() === false &&
        sbD.__domEvents.indexOf('chain-autosave-failed') === -1,
      'D1: a successful save latches nothing'
    );
    setItemShouldThrow = true;
    sbD.Persistence.saveCurrentChain(seedChain());
    check(
      sbD.Persistence.isSaveFailed() === true &&
        sbD.__domEvents.indexOf('chain-autosave-failed') !== -1,
      'D2: a failed save latches the failure AND announces it'
    );
    setItemShouldThrow = false;
    sbD.Persistence.saveCurrentChain(seedChain());
    check(
      sbD.Persistence.isSaveFailed() === false &&
        sbD.__domEvents.indexOf('chain-autosave-recovered') !== -1,
      'D3: a later VERIFIED save clears the latch and announces recovery'
    );
  }

  // ====================================================================
  section('E. sound-design guide: identity, lo-fi direction, degraded registry');
  // ====================================================================
  {
    // E1/E2/E3: a HEALTHY live registry (all 14 registered types — the
    // real page's shape) serves the full guide under the canonical
    // identity. (A sandbox with NO NodeTypes falls back to the static
    // 10-type snapshot, which legitimately filters the four Tone types —
    // that is a degraded registry, covered by E4.)
    var ALL_TYPES = [
      'gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter',
      'distortion', 'chorus', 'gate', 'autotune',
      'pitchshift', 'tremolo', 'bitcrusher', 'phaser'
    ];
    var sbE = createBaseSandbox();
    loadSrc(sbE, 'src/preset-schema.js');
    sbE.NodeTypes = {
      getAllTypes: function () { return ALL_TYPES.slice(); },
      getLabel: function (t) { return t; },
      getParamSpec: function () { return []; },
      isExperimental: function () { return false; }
    };
    loadSrc(sbE, 'src/mcp-tools.js');
    var guideE = await getTool(sbE, 'get_capabilities').execute({ focus: 'sound_design' });
    check(
      guideE && guideE.app === 'voxchain',
      'E1: the guide reports the canonical VOXCHAIN identity'
    );
    check(
      guideE && Array.isArray(guideE.vocabulary.lofi) &&
        guideE.vocabulary.lofi.indexOf('bitcrusher bits 6..3 (fewer bits = more crushed)') !== -1,
      'E2: lo-fi bit depth runs DESCENDING with the direction spelled out (slight 6 -> strong 3)'
    );
    check(
      guideE && guideE.unavailableEffects === undefined &&
        guideE.vocabulary.ghostly && guideE.vocabulary.ghostly.length === 5,
      'E3: a healthy registry serves the guide unfiltered (ghostly keeps all five lines)'
    );

    // E4: a degraded live registry (chorus + bitcrusher missing) filters
    // per-line and discloses what is gone.
    var sbE2 = createBaseSandbox();
    loadSrc(sbE2, 'src/preset-schema.js');
    sbE2.NodeTypes = {
      getAllTypes: function () {
        // Every type except chorus and bitcrusher.
        return [
          'gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter',
          'distortion', 'gate', 'autotune', 'pitchshift', 'tremolo', 'phaser'
        ];
      },
      getLabel: function (t) { return t; },
      getParamSpec: function () { return []; },
      isExperimental: function () { return false; }
    };
    loadSrc(sbE2, 'src/mcp-tools.js');
    var guideE2 = await getTool(sbE2, 'get_capabilities').execute({ focus: 'sound_design' });
    check(
      guideE2 && Array.isArray(guideE2.vocabulary.ghostly) &&
        guideE2.vocabulary.ghostly.length === 4 &&
        !guideE2.vocabulary.ghostly.some(function (l) { return /^chorus /.test(l); }),
      'E4: ghostly keeps its four installable lines and loses ONLY the chorus line'
    );
    check(
      guideE2 && guideE2.vocabulary.thick === undefined &&
        guideE2.vocabulary.lofi === undefined,
      'E5: adjectives left with nothing installable (thick=chorus, lofi=bitcrusher) are dropped'
    );
    check(
      guideE2 && typeof guideE2.unavailableEffects === 'string' &&
        guideE2.unavailableEffects.indexOf('chorus') !== -1 &&
        guideE2.unavailableEffects.indexOf('bitcrusher') !== -1,
      'E6: the dropped effects are disclosed once via unavailableEffects'
    );
  }

  // ====================================================================
  section('F. get_chain exposes the output-authority context');
  // ====================================================================
  {
    var sbF = createBaseSandbox();
    sbF.AudioEngine = { isStarted: true, audioContext: { state: 'running' } };
    sbF.AudioBypass = { isEngaged: function () { return true; } };
    sbF.MeterTaps = { isTripped: function () { return true; } };
    installChainCanvasStub(sbF, seedChain(), 0);
    loadSrc(sbF, 'src/preset-schema.js');
    loadSrc(sbF, 'src/mcp-tools.js');
    var chainF = await getTool(sbF, 'get_chain').execute({});
    check(
      chainF && chainF.outputAuthority &&
        chainF.outputAuthority.bypass === true &&
        chainF.outputAuthority.outputMuted === true,
      'F1: outputAuthority reads live Bypass + watchdog state (both engaged here)'
    );

    var sbF2 = createBaseSandbox();
    installChainCanvasStub(sbF2, seedChain(), 0);
    loadSrc(sbF2, 'src/preset-schema.js');
    loadSrc(sbF2, 'src/mcp-tools.js');
    var chainF2 = await getTool(sbF2, 'get_chain').execute({});
    check(
      chainF2 && chainF2.outputAuthority &&
        chainF2.outputAuthority.bypass === null &&
        chainF2.outputAuthority.outputMuted === null,
      'F2: absent authorities report honest nulls, never guesses'
    );
  }

  console.log('');
  if (failures.length > 0) {
    console.error('submission-hardening: ' + failures.length + ' FAILED:');
    failures.forEach(function (f) { console.error('  - ' + f); });
    process.exit(1);
  }
  console.log('submission-hardening: all checks passed');
}

// Shared engine setup for the section-B sandboxes: a STARTED engine so the
// pre-Start refusal stays out of the way, with no AudioGraph loaded (the
// canvas stub guards on its presence).
function sbA_engine_setup(sb) {
  sb.AudioEngine = { isStarted: true };
}

main().catch(function (err) {
  console.error('submission-hardening: harness threw:', err);
  process.exit(1);
});
