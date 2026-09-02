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
// PEN SECTION (cycle 4, PEN-1): section F is the COMMITTED conformance
// pass over the audition pen (src/audition-candidates.js) — the same
// checks GEN-1/GAG-1 ran as disposable at-authoring probes, now pinned
// at suite time so the batch cannot regress silently between PRs: every
// pen entry schema-round-trips, sits on the catalog grid, carries only
// vocabulary-legal tags, owns a unique name, and passes the REAL
// set_chain with an engine-itemized gain budget. The megaphone boundary
// (the +12 dB cap is INCLUSIVE — exactly 12.00 applies, 12.01 rejects)
// and the genre-first audition order are pinned here too. When PRO-1
// promotes/rejects entries, update the pen count in the SAME edit.
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
  // PEN-1: the pen's candidates use all fourteen node types, so the eight
  // non-classic node files join the load list (same order index.html /
  // tests/test-mcp-tools-cycle3.js ship: tone-adapter before pitchshift).
  loadSrc(sandbox, 'src/node-distortion.js');
  loadSrc(sandbox, 'src/node-chorus.js');
  loadSrc(sandbox, 'src/node-gate.js');
  loadSrc(sandbox, 'src/node-autotune.js');
  loadSrc(sandbox, 'src/tone-adapter.js');
  loadSrc(sandbox, 'src/node-pitchshift.js');
  loadSrc(sandbox, 'src/node-tremolo.js');
  loadSrc(sandbox, 'src/node-bitcrusher.js');
  loadSrc(sandbox, 'src/node-phaser.js');
  loadSrc(sandbox, 'src/preset-schema.js');
  loadSrc(sandbox, 'src/default-preset.js');
  loadSrc(sandbox, 'src/factory-library-data.js');
  loadSrc(sandbox, 'src/factory-presets.js');
  loadSrc(sandbox, 'src/audition-candidates.js');
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
  console.log('B. the shipped library: fourteen presets, Classic byte-identical to DEFAULT_PRESET');
  // --------------------------------------------------------------------

  var factory = sandbox.FactoryPresets.list();
  check(Array.isArray(factory) && factory.length === 14, 'B1: factory library lists fourteen presets (six original + eight promoted 2026-09-01)');
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
  console.log('F. the audition pen (cycle 4 PEN-1): every candidate policy-conformant');
  // --------------------------------------------------------------------

  // The committed version of the disposable at-authoring checks GEN-1 and
  // GAG-1 ran (see docs/ultron/preset-axis-cycle/production-log.md): the
  // batch this PR ships is pinned here so it cannot regress silently.
  var pen = sandbox.AUDITION_CANDIDATES;
  // 20 -> 12 at the 2026-09-01 promotion: the eight audition-accepted seed
  // candidates left the pen for src/factory-library-data.js in the same
  // edit that moved B1's library count 6 -> 14.
  var EXPECTED_PEN = 12;
  check(Array.isArray(pen) && pen.length === EXPECTED_PEN,
    'F1: the pen ships ' + EXPECTED_PEN + ' candidates (update here in the SAME edit when PRO-1 promotes/rejects entries or a next batch lands)');

  var factoryNames = {};
  factory.forEach(function (p) {
    factoryNames[p.name] = true;
  });
  var penSeen = {};
  pen.forEach(function (entry) {
    var p = "pen '" + entry.name + "'";
    check(typeof entry.name === 'string' && entry.name.length > 0 && !penSeen[entry.name],
      'F1: ' + p + ' has a unique non-empty name (verdict recording is name-keyed — duplicates break it)');
    penSeen[entry.name] = true;
    check(!factoryNames[entry.name],
      'F1: ' + p + ' does not collide with a shipped library name (promotion moves it there)');
    check(!!entry.provenance && entry.provenance.verdict === 'pending' &&
      entry.provenance.auditionDate === null,
      'F1: ' + p + " is pending (verdict 'pending', auditionDate null — decided entries leave the pen)");
  });

  // Tags: the frozen append-only vocabularies and the dropdown group order
  // are read from the loaded factory-library-data.js, never restated here.
  var vocab = sandbox.FACTORY_LIBRARY.VOCABULARIES;
  var groupOrder = sandbox.FACTORY_LIBRARY.PRIMARY_GROUP_ORDER;
  pen.forEach(function (entry) {
    var p = "pen '" + entry.name + "'";
    entry.tags.forEach(function (tag) {
      var m = /^([a-z-]+):(.+)$/.exec(tag);
      check(!!m && vocab[m[1]] !== undefined && vocab[m[1]].indexOf(m[2]) !== -1,
        'F2: ' + p + " tag '" + tag + "' is vocabulary-legal (frozen, append-only)");
    });
    check(entry.tags.indexOf(entry.primary) !== -1 &&
      groupOrder.indexOf(entry.primary) !== -1 &&
      entry.primary.indexOf('technique:') !== 0,
      'F2: ' + p + " primary '" + entry.primary + "' is one of its tags and a legal dropdown group");
  });

  // Schema round-trip: serialize → JSON string → parse → deserialize, then
  // deep-equal the authored nodes (the exact trip a saved/exported preset
  // takes through the app's own serialization).
  pen.forEach(function (entry) {
    var wire = sandbox.PresetSchema.serialize(entry.name, entry.nodes);
    var back = sandbox.PresetSchema.deserialize(JSON.parse(JSON.stringify(wire)));
    check(back.name === entry.name && deepEqual(back.nodes, entry.nodes),
      "F3: pen '" + entry.name + "' PresetSchema round-trips (serialize → JSON → parse → deserialize → nodes deep-equal)");
  });

  // Catalog grid: every node live-registered, every param exactly the
  // authored set (normalizeParams fills nothing), every numeric value on
  // its spec's step grid, discrete values canonical, ids unique, counts
  // inside the chain rules the engine enforces.
  var GRID_EPS = 1e-6;
  var liveTypes = sandbox.EffectCatalog.getAllTypes();
  pen.forEach(function (entry) {
    var p = "pen '" + entry.name + "'";
    var idsInChain = {};
    entry.nodes.forEach(function (node) {
      check(liveTypes.indexOf(node.type) !== -1,
        'F4: ' + p + ' node ' + node.id + " type '" + node.type + "' is live-registered");
      var specs = sandbox.EffectCatalog.getParamSpec(node.type);
      var specById = {};
      specs.forEach(function (s) {
        specById[s.id] = s;
      });
      var normalized = sandbox.EffectCatalog.normalizeParams(node.type, node.params);
      check(!!normalized &&
        Object.keys(normalized).sort().join(',') === Object.keys(node.params).sort().join(','),
        'F4: ' + p + ' node ' + node.id + ' params are EXACTLY the authored set (nothing unknown, no defaults silently filled)');
      Object.keys(node.params).forEach(function (param) {
        var spec = specById[param];
        var value = node.params[param];
        var where = 'F4: ' + p + ' node ' + node.id + ' (' + node.type + ') ' + param;
        check(!!spec, where + ' is a known catalog param');
        if (!spec) {
          return;
        }
        if (Array.isArray(spec.values)) {
          check(typeof value === 'string' && spec.values.indexOf(value) !== -1,
            where + " discrete value '" + value + "' is canonical in the spec's values");
        } else {
          var stepsFromMin = (value - spec.min) / spec.step;
          check(typeof value === 'number' && isFinite(value) &&
            value >= spec.min - 1e-9 && value <= spec.max + 1e-9 &&
            Math.abs(stepsFromMin - Math.round(stepsFromMin)) < GRID_EPS,
            where + ' value ' + value + ' is on the catalog grid (' + spec.min + ' + ' + spec.step + '-steps, inside [' + spec.min + ', ' + spec.max + '])');
        }
      });
      check(!idsInChain[node.id], 'F4: ' + p + ' node id ' + node.id + ' is unique in its chain');
      idsInChain[node.id] = true;
    });
    var dynCount = entry.nodes.filter(function (n) {
      return n.type === 'compressor' || n.type === 'limiter';
    }).length;
    check(entry.nodes.length <= 16 && dynCount <= 2,
      'F4: ' + p + ' chain counts are rule-legal (' + entry.nodes.length + ' nodes of max 16, ' + dynCount + ' compressor+limiter of max 2)');
  });

  // The REAL policy engine over every candidate's exact nodes + the budget
  // probe (same technique as section C: one +12 dB gain node upstream of
  // the terminal limiter can only trip gain-budget-12db, and the rejection
  // carries the engine's own itemized breakdown).
  for (var f = 0; f < pen.length; f++) {
    var candidate = pen[f];
    var label = "pen '" + candidate.name + "'";

    var penApply = await setChain.execute({
      chain: { schemaVersion: 1, name: candidate.name, nodes: copyNodes(candidate.nodes) }
    });
    check(penApply && penApply.applied === true,
      'F5: ' + label + ' passes the REAL set_chain (applied:true — counts, terminal limiter, EQ rules, compound-loop guard, agent param ranges)');

    var penProbeNodes = copyNodes(candidate.nodes);
    penProbeNodes.splice(penProbeNodes.length - 1, 0, {
      id: 'pen-budget-probe',
      type: 'gain',
      params: { gainDb: 12 }
    });
    var penProbeRes = await setChain.execute({
      chain: { schemaVersion: 1, name: candidate.name + ' budget probe', nodes: penProbeNodes }
    });
    var penProbeOk = penProbeRes && penProbeRes.error === true && penProbeRes.code === 'gain-budget-12db';
    check(penProbeOk, 'F6: ' + label + ' probe rejects as gain-budget-12db');
    if (penProbeOk && penProbeRes.budget) {
      var candidateIds = {};
      candidate.nodes.forEach(function (n) {
        candidateIds[n.id] = true;
      });
      var penOwnSum = 0;
      penProbeRes.budget.components.forEach(function (comp) {
        if (candidateIds[comp.node]) {
          penOwnSum += comp.contributionDb;
        }
      });
      check(penOwnSum <= penProbeRes.budget.limitDb + 1e-9,
        'F6: ' + label + ' engine-itemized gain budget ' + round2(penOwnSum).toFixed(2) +
          ' dB <= +' + penProbeRes.budget.limitDb + ' dB (margin ' +
          round2(penProbeRes.budget.limitDb - penOwnSum).toFixed(2) + ' dB)');
      console.log(
        '       budget ' + label + ': ' + penProbeRes.budget.components
          .filter(function (comp) { return candidateIds[comp.node]; })
          .map(function (comp) {
            return comp.node + ' +' + comp.contributionDb.toFixed(2) + ' (' + comp.detail + ')';
          })
          .join(', ')
      );
    } else {
      check(false, 'F6: ' + label + ' budget breakdown unavailable (probe did not reject as budget)');
    }
  }

  // Genre-first audition order (PEN-1's data move, pinned): the GEN-1 genre
  // run in RQ-1 sketch order opens the pen, and every domain candidate
  // (genre/vibe/use-case primary) precedes every gag.
  var penNames = pen.map(function (e) {
    return e.name;
  });
  var GENRE_RUN = ['Metal Mayhem', 'Hard-Tune Hotline', 'Slow Jam Silk', 'Nashville Nights', 'Club Anthem', 'West End Nights'];
  check(penNames.slice(0, GENRE_RUN.length).join(',') === GENRE_RUN.join(','),
    'F7: the pen opens with the GEN-1 genre run in sketch order (Metal -> ... -> Musicals)');
  var firstGagIdx = -1;
  var lastDomainIdx = -1;
  pen.forEach(function (e, i) {
    if (e.primary.split(':')[0] === 'gag') {
      if (firstGagIdx === -1) {
        firstGagIdx = i;
      }
    } else {
      lastDomainIdx = i;
    }
  });
  check(firstGagIdx > lastDomainIdx,
    'F7: every domain candidate precedes every gag (' + (lastDomainIdx + 1) + ' domain, then ' +
      (pen.length - firstGagIdx) + ' gags — the audition validates domain content early)');

  // The megaphone boundary, committed (plan PEN-1 note): the +12 dB cap is
  // INCLUSIVE. Authored 11.97 dB applies (F5 above); pushed to EXACTLY
  // 12.00 dB it still applies; one centistep over (12.01) rejects.
  var megaphone = null;
  pen.forEach(function (e) {
    if (e.name === 'Megaphone Rally') {
      megaphone = e;
    }
  });
  check(!!megaphone, 'F8: Megaphone Rally is present for the boundary characterization');
  if (megaphone) {
    var atCapNodes = copyNodes(megaphone.nodes);
    atCapNodes.splice(atCapNodes.length - 1, 0, {
      id: 'pen-cap-probe',
      type: 'gain',
      params: { gainDb: 0.03 }
    });
    var atCapRes = await setChain.execute({
      chain: { schemaVersion: 1, name: 'Megaphone Rally cap probe', nodes: atCapNodes }
    });
    check(atCapRes && atCapRes.applied === true,
      'F8: megaphone pushed to EXACTLY the +12.00 dB cap still applies (cap is inclusive — 11.97 is legal with margin)');
    var overCapNodes = copyNodes(megaphone.nodes);
    overCapNodes.splice(overCapNodes.length - 1, 0, {
      id: 'pen-over-probe',
      type: 'gain',
      params: { gainDb: 0.04 }
    });
    var overCapRes = await setChain.execute({
      chain: { schemaVersion: 1, name: 'Megaphone Rally over probe', nodes: overCapNodes }
    });
    check(overCapRes && overCapRes.error === true && overCapRes.code === 'gain-budget-12db',
      'F8: one step over the cap (12.01 dB) rejects as gain-budget-12db (violation predicate is > 12, not >=)');
  }

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: factory presets conform to the WebMCP policy (issue #2) — pen batch of ' + pen.length + ' candidates conform');
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
