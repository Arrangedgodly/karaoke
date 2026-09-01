// Test for issue #2 — [P1] Classic Karaoke must conform to the WebMCP
// policy that get_capabilities publishes.
//
// The bug: the shipped default chain ("Classic Karaoke", src/
// default-preset.js, mirrored verbatim as the first factory preset in
// src/factory-presets.js) carried compressor threshold -24 dB and limiter
// ceiling -1 dB. The published policy (src/mcp-tools.js) rejects limiter
// ceilings outside [-12, -3] dB and caps the total gain budget — sum of
// gainDb + 0.57*|threshold| per compressor + 0.57*|ceiling| for the
// limiter — at +12 dB. The old pair estimates 0 + 13.68 + 0.57 = 14.25 dB,
// so passing the EXACT get_chain result back to set_chain on the default
// chain was rejected, and any harmless edit (e.g. a reverb mix tweak)
// failed with it — the unchanged chain was already over budget. Classic
// was the only factory preset failing; the other five (the historical
// QA-3 chains) pass and must stay untouched.
//
// Same committed-test convention as tests/test-node-reuse-type-match.js
// (issue #1): a ZERO-dependency Node harness — no npm install, no build
// step — that stubs `window` plus the globals the src files guard on, then
// loads the REAL src files (fs.readFileSync + vm.runInContext) into that
// sandbox. The policy is NEVER reimplemented here: every range and budget
// number asserted below comes out of the actual validation the tools run
// (get_capabilities' published tables, and set_chain's own
// applyPolicyToNodes + evaluateChainRules pass over the real candidate).
//
//   src/effect-catalog.js    (the complete effect definition registry)
//   src/audio-graph.js       (the runtime graph consumer)
//   src/node-gain.js etc.    (all six node files, so the LIVE catalog is
//                             populated exactly as in index.html)
//   src/default-preset.js    (the shipped default chain under test)
//   src/factory-presets.js   (the shipped factory library under test)
//   src/mcp-tools.js         (the 10 agent tools, incl. get_chain/set_chain)
//
// Budget extraction — why the "+12 dB probe": budgetBreakdown() is internal
// to mcp-tools.js's IIFE and only surfaces on a REJECTION. So per preset
// this test submits the preset's exact nodes PLUS one extra gain node
// (gainDb +12, inserted upstream of the terminal limiter) through the real
// set_chain. Adding that node can only trip gain-budget-12db (counts,
// terminal-limiter, EQ and compound-loop rules are untouched by one
// upstream gain node), and the rejection carries the engine's own itemized
// breakdown. Dropping the probe's own +12 component yields the preset's
// computed budget — every number still produced by the real enforcement
// code, not restated here.
//
// Physical-audio scope: unlike the issue-#1 test, this test asserts the
// POLICY/model layer only. The ChainCanvas stub keeps the single write
// path (loadModel takes ownership of copies) but the engine stub reports
// not-started, so loadModel is the model-only pre-Start behavior the app
// itself has — physical instance reuse/rebuild has its own committed test
// (tests/test-node-reuse-type-match.js).
//
// Run from a clean clone:  node tests/test-factory-presets-policy.js
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

// ----------------------------------------------------------------------
// Assertions: collect failures so one run reports everything, exit 1 at
// the end if any check failed. (Same harness shape as the issue-#1 test.)
// ----------------------------------------------------------------------
var failures = [];

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Order-insensitive structural equality for the plain-JSON shapes the
// preset/model layer uses ({id, type, params} node objects).
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  var ka = Object.keys(a);
  var kb = Object.keys(b);
  if (ka.length !== kb.length) {
    return false;
  }
  for (var i = 0; i < ka.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !deepEqual(a[ka[i]], b[ka[i]])) {
      return false;
    }
  }
  return true;
}

function copyNodes(nodes) {
  return nodes.map(function (entry) {
    return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
  });
}

// ----------------------------------------------------------------------
// The sandbox: a vm context whose global IS `window` (the src files are
// plain <script> files/IIFEs that read/write window.X), with host timers
// and a no-DOM document stub passed through. The engine stub reports
// not-started (the model-only pre-Start behavior — see the header).
// ----------------------------------------------------------------------
function createSandbox() {
  var sandbox = {
    console: console,
    setTimeout: function (fn, ms) {
      return setTimeout(fn, ms);
    },
    clearTimeout: function (id) {
      return clearTimeout(id);
    },
    setInterval: function (fn, ms) {
      return setInterval(fn, ms);
    },
    clearInterval: function (id) {
      return clearInterval(id);
    },
    document: {
      getElementById: function () {
        return null;
      }
    },
    // src/node-reverb.js kicks off its impulse-response fetch at LOAD
    // time (module scope). A never-settling promise is exactly the
    // "IR not fetched yet" state that file is built to tolerate, and no
    // live Reverb node is ever created in this test — the registry entry
    // (the only thing this harness wants from the file) is unaffected.
    fetch: function () {
      return new Promise(function () {});
    }
  };
  sandbox.window = sandbox;
  sandbox.AudioEngine = { isStarted: true };
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// ----------------------------------------------------------------------
// ChainCanvas adapter stub. ChainEditing owns accepted model changes; the
// policy suite runs pre-Start, so only the rendered model matters here.
// ----------------------------------------------------------------------
function installChainCanvasStub(sandbox) {
  var canvasModel = [];
  sandbox.ChainCanvas = {
    getCurrentModel: function () {
      return copyNodes(canvasModel);
    },
    isDragActive: function () {
      return false;
    },
    getCurrentLayout: function () {
      return {};
    },
    renderModel: function (model) {
      canvasModel = copyNodes(model);
      return true;
    },
    renderNodeParam: function (id, param, value) {
      for (var i = 0; i < canvasModel.length; i++) {
        if (canvasModel[i].id === id) {
          canvasModel[i].params[param] = value;
          return true;
        }
      }
      return false;
    }
  };
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

function limiterOf(nodes) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'limiter') {
      return nodes[i];
    }
  }
  return null;
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  loadSrc(sandbox, 'src/effect-catalog.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js'); // issue #5: the ramp helper the node applyParam handlers call
  loadSrc(sandbox, 'src/node-gain.js');
  loadSrc(sandbox, 'src/node-compressor.js');
  loadSrc(sandbox, 'src/node-eq.js');
  loadSrc(sandbox, 'src/node-delay.js');
  loadSrc(sandbox, 'src/node-reverb.js');
  loadSrc(sandbox, 'src/node-limiter.js');
  loadSrc(sandbox, 'src/default-preset.js');
  loadSrc(sandbox, 'src/factory-library-data.js');
  loadSrc(sandbox, 'src/factory-presets.js');
  installChainCanvasStub(sandbox);
  loadSrc(sandbox, 'src/chain-editing.js');
  loadSrc(sandbox, 'src/mcp-tools.js');

  var setChain = getTool(sandbox, 'set_chain');
  var getChain = getTool(sandbox, 'get_chain');
  var getCapabilities = getTool(sandbox, 'get_capabilities');

  // --------------------------------------------------------------------
  console.log('A. the published policy, read from the real get_capabilities');
  // --------------------------------------------------------------------

  var caps = await getCapabilities.execute({});
  check(
    !!caps && caps.nodeTypes && typeof caps.nodeTypes === 'object',
    'A1: capabilities publish the nodeTypes policy index'
  );

  var ceilingCaps = caps.nodeTypes && caps.nodeTypes.limiter
    ? caps.nodeTypes.limiter.ceiling
    : null;
  check(
    !!ceilingCaps && ceilingCaps.action === 'reject',
    'A1: limiter ceiling carries a published agent range with treatment reject'
  );
  check(
    !!ceilingCaps && ceilingCaps.range[0] === -12 && ceilingCaps.range[1] === -3,
    'A1: published limiter ceiling range is [-12, -3] dB'
  );
  var CEIL_MIN = ceilingCaps ? ceilingCaps.range[0] : -12;
  var CEIL_MAX = ceilingCaps ? ceilingCaps.range[1] : -3;

  var budgetRule = caps.chainRules && caps.chainRules['gain-budget-12db'];
  check(
    !!budgetRule,
    'A1: the gain-budget-12db rule is published (the +12 dB limit is asserted from the engine below)'
  );

  // --------------------------------------------------------------------
  console.log('B. the shipped library: six presets, Classic byte-identical to DEFAULT_PRESET');
  // --------------------------------------------------------------------

  var factory = sandbox.FactoryPresets.list();
  check(Array.isArray(factory) && factory.length === 6, 'B1: factory library lists six presets');
  check(
    factory.length > 0 && factory[0].name === 'Classic Karaoke',
    "B1: the first factory preset is 'Classic Karaoke'"
  );
  check(
    factory.length > 0 &&
      deepEqual(factory[0].nodes, sandbox.DEFAULT_PRESET.nodes),
    'B1: factory Classic Karaoke is window.DEFAULT_PRESET\'s chain byte-identical (PS-4)'
  );

  // --------------------------------------------------------------------
  console.log('C. every preset passes set_chain unchanged; budgets from the real engine');
  // --------------------------------------------------------------------

  // DEFAULT_PRESET itself plus all six factory presets — the acceptance
  // criteria name both. Labels distinguish the two Classic copies.
  var underTest = [{ source: 'default-preset.js', preset: sandbox.DEFAULT_PRESET }].concat(
    factory.map(function (p) {
      return { source: 'factory', preset: p };
    })
  );

  for (var t = 0; t < underTest.length; t++) {
    var source = underTest[t].source;
    var preset = underTest[t].preset;
    var label = source + " '" + preset.name + "'";

    // (1) The exact shipped nodes must apply through the real set_chain —
    // the same validation an agent loading the preset runs.
    var applyRes = await setChain.execute({
      chain: { schemaVersion: 1, name: preset.name, nodes: copyNodes(preset.nodes) }
    });
    check(
      applyRes && applyRes.applied === true,
      'C: ' + label + ' passes set_chain unchanged (applied:true)'
    );

    // (2) The limiter ceiling sits inside the PUBLISHED range (read from
    // get_capabilities in A, not restated here).
    var limiter = limiterOf(preset.nodes);
    check(
      !!limiter &&
        typeof limiter.params.ceiling === 'number' &&
        limiter.params.ceiling >= CEIL_MIN &&
        limiter.params.ceiling <= CEIL_MAX,
      'C: ' + label + ' limiter ceiling ' +
        (limiter ? limiter.params.ceiling : 'MISSING') +
        ' dB inside published [' + CEIL_MIN + ', ' + CEIL_MAX + '] dB'
    );

    // (3) Computed gain budget, from the engine's own rejection breakdown
    // (see the header's probe note). The +12 dB probe node goes upstream
    // of the terminal limiter, so it can only trip gain-budget-12db.
    var probeNodes = copyNodes(preset.nodes);
    probeNodes.splice(probeNodes.length - 1, 0, {
      id: 'zz-budget-probe',
      type: 'gain',
      params: { gainDb: 12 }
    });
    var probeRes = await setChain.execute({
      chain: { schemaVersion: 1, name: preset.name + ' budget probe', nodes: probeNodes }
    });
    var probeOk =
      probeRes && probeRes.error === true && probeRes.code === 'gain-budget-12db';
    check(probeOk, 'C: ' + label + ' probe rejects as gain-budget-12db');

    var presetIds = {};
    preset.nodes.forEach(function (entry) {
      presetIds[entry.id] = true;
    });
    var budgetDb = null;
    var marginDb = null;
    if (probeOk && probeRes.budget) {
      check(
        probeRes.budget.limitDb === 12,
        'C: ' + label + ' engine-reported budget limit is +12 dB'
      );
      var probeComponents = [];
      var ownSum = 0;
      probeRes.budget.components.forEach(function (comp) {
        if (presetIds[comp.node]) {
          ownSum += comp.contributionDb;
        } else {
          probeComponents.push(comp);
        }
      });
      check(
        probeComponents.length === 1 &&
          probeComponents[0].contributionDb === 12 &&
          probeComponents[0].type === 'gain',
        'C: ' + label + ' probe added exactly one +12 dB gain component'
      );
      budgetDb = round2(ownSum);
      marginDb = round2(probeRes.budget.limitDb - ownSum);
      check(
        ownSum <= probeRes.budget.limitDb + 1e-9,
        'C: ' + label + ' gain budget ' + budgetDb.toFixed(2) +
          ' dB <= +' + probeRes.budget.limitDb + ' dB (margin ' + marginDb.toFixed(2) + ' dB)'
      );
      console.log(
        '       budget ' + label + ': ' + budgetDb.toFixed(2) + ' dB of +' +
          probeRes.budget.limitDb + ' dB — ' +
          probeRes.budget.components
            .map(function (comp) {
              return comp.node + ' +' + comp.contributionDb.toFixed(2) + ' (' + comp.detail + ')';
            })
            .join(', ')
      );
    } else {
      check(false, 'C: ' + label + ' budget breakdown unavailable (probe did not reject as budget)');
    }
  }

  // --------------------------------------------------------------------
  console.log('D. round-trip: exact get_chain result back into set_chain, fresh profile');
  // --------------------------------------------------------------------

  // A fresh profile gets the default chain (src/persistence.js's fallback
  // — loadInitialModel() uses window.DEFAULT_PRESET.nodes when nothing is
  // autosaved yet). Seed the canvas the same way, then round-trip.
  await sandbox.ChainEditing.apply({
    source: 'startup',
    candidate: copyNodes(sandbox.DEFAULT_PRESET.nodes),
    forceStructural: true
  });

  var readRes = await getChain.execute({});
  check(
    !!readRes && readRes.schemaVersion === 1 && Array.isArray(readRes.nodes) &&
      deepEqual(readRes.nodes, sandbox.DEFAULT_PRESET.nodes),
    'D1: get_chain reveals the seeded default chain unchanged'
  );

  var roundTripRes = await setChain.execute({ chain: readRes });
  check(
    roundTripRes && roundTripRes.applied === true,
    'D1: the EXACT get_chain result fed back to set_chain resolves applied:true'
  );
  check(
    roundTripRes && Array.isArray(roundTripRes.changes) && roundTripRes.changes.length === 0,
    'D1: the round-trip changed nothing (changes is empty)'
  );
  check(
    deepEqual(sandbox.ChainCanvas.getCurrentModel(), sandbox.DEFAULT_PRESET.nodes),
    'D1: live model after the round-trip is still exactly the default chain'
  );

  // --------------------------------------------------------------------
  console.log('E. a harmless edit on the default chain applies (reverb mix 20 -> 25)');
  // --------------------------------------------------------------------

  var editedNodes = copyNodes(sandbox.DEFAULT_PRESET.nodes);
  var reverbNode = null;
  for (var e = 0; e < editedNodes.length; e++) {
    if (editedNodes[e].id === 'n5' && editedNodes[e].type === 'reverb') {
      reverbNode = editedNodes[e];
      break;
    }
  }
  check(!!reverbNode && reverbNode.params.mix === 20, 'E1: default reverb mix starts at 20');
  if (reverbNode) {
    reverbNode.params.mix = 25;
  }
  var editRes = await setChain.execute({
    chain: { schemaVersion: 1, name: sandbox.DEFAULT_PRESET.name, nodes: editedNodes }
  });
  check(
    editRes && editRes.applied === true,
    'E1: harmless edit (reverb mix 20 -> 25) resolves applied:true'
  );
  var editChanges = (editRes && editRes.changes) || [];
  check(
    editChanges.length === 1 &&
      editChanges[0].node === 'n5' &&
      editChanges[0].params &&
      editChanges[0].params.mix &&
      editChanges[0].params.mix.from === 20 &&
      editChanges[0].params.mix.to === 25,
    'E1: the only reported change is n5 reverb mix 20 -> 25'
  );
  var liveAfter = sandbox.ChainCanvas.getCurrentModel();
  var liveReverb = null;
  for (var l = 0; l < liveAfter.length; l++) {
    if (liveAfter[l].id === 'n5') {
      liveReverb = liveAfter[l];
      break;
    }
  }
  check(
    !!liveReverb && liveReverb.params.mix === 25,
    'E1: the edit landed in the live model (n5 mix 25)'
  );

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: factory presets conform to the WebMCP policy (issue #2)');
    return 0;
  }
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (label) {
    console.log('  - ' + label);
  });
  return 1;
}

main().then(
  function (code) {
    process.exit(code);
  },
  function (err) {
    console.error('FAIL: harness threw: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
);
