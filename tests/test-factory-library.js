// Test for wayfinder #30 — the factory library as structured data
// (src/factory-library-data.js behind the thin loader
// src/factory-presets.js). This is the automated conformance pass that
// consciously REPLACES the old "re-mirror BY HAND" discipline (see
// docs/adr/0001-factory-library-as-data.md): every entry is validated
// against the vocabularies + group order it ships with, its provenance,
// the real PresetSchema, and the LIVE EffectCatalog registry — so drift
// (a node type or param changing incompatibly elsewhere in the codebase)
// fails HERE, naming the preset, instead of shipping broken content.
// The map's drift rule rides on this test: an entry the test flags is
// pulled from the library until re-auditioned.
//
// What this test deliberately does NOT duplicate:
//   - WebMCP policy (gain budget, limiter ranges): that's
//     tests/test-factory-presets-policy.js's job, unchanged.
//   - Description quality (user words, artist shorthand, complaint
//     vocabulary): that is checked by a human at audition (Booth, #29) —
//     a regex cannot hear slop; here we only check length/shape.
//
// Same committed-test convention as tests/test-factory-presets-policy.js:
// a zero-dependency Node harness, `window`-shaped sandbox, the REAL src
// files loaded via fs.readFileSync + vm.runInContext. Nothing asserted
// below is restated from the sources — vocabularies, group order, and the
// registry all come from the loaded files.
//
// SEED-BATCH NOTE (#31): when new entries land, add their node types'
// src/node-*.js files to the load list below in the SAME edit, and
// update the count check the same way test-factory-presets-policy.js B1
// is updated. (2026-09-01: eight promoted entries, twelve types.
// 2026-09-02: nineteen more promoted — autotune and bitcrusher join the
// load list, which now covers all fourteen registered types the
// thirty-three entries use.)
//
// Run from a clean clone:  node tests/test-factory-library.js
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

var failures = [];

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

var RANGE_EPS = 1e-9;

function createSandbox() {
  var sandbox = {
    console: console,
    setTimeout: function (fn) { return setTimeout(fn, 0); },
    clearTimeout: clearTimeout,
    document: { getElementById: function () { return null; } },
    // src/node-reverb.js fetches its IR at LOAD time; a never-settling
    // promise is the tolerated "not fetched yet" state (same as the
    // policy test's stub).
    fetch: function () { return new Promise(function () {}); }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function loadSrc(sandbox, relPath) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath
  });
}

// The production load order, exactly as index.html ships it for the files
// this test needs (registry first, then schema, then data, then loader).
function loadLibraryStack(sandbox) {
  loadSrc(sandbox, 'src/effect-catalog.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js');
  loadSrc(sandbox, 'src/node-gain.js');
  loadSrc(sandbox, 'src/node-compressor.js');
  loadSrc(sandbox, 'src/node-eq.js');
  loadSrc(sandbox, 'src/node-delay.js');
  loadSrc(sandbox, 'src/node-reverb.js');
  loadSrc(sandbox, 'src/node-limiter.js');
  // #31 promoted entries add: pitchshift, distortion, chorus, tremolo, phaser, gate.
  // 2026-09-02 promotees add: autotune, bitcrusher. pitchshift/tremolo/
  // phaser/bitcrusher are Tone-backed (register via window.ToneAdapter),
  // so the adapter loads first — same order as tests/test-tone-adapter.js.
  loadSrc(sandbox, 'src/tone-adapter.js');
  loadSrc(sandbox, 'src/node-pitchshift.js');
  loadSrc(sandbox, 'src/node-distortion.js');
  loadSrc(sandbox, 'src/node-chorus.js');
  loadSrc(sandbox, 'src/node-tremolo.js');
  loadSrc(sandbox, 'src/node-bitcrusher.js');
  loadSrc(sandbox, 'src/node-phaser.js');
  loadSrc(sandbox, 'src/node-gate.js');
  loadSrc(sandbox, 'src/node-autotune.js');
  loadSrc(sandbox, 'src/preset-schema.js');
  loadSrc(sandbox, 'src/factory-library-data.js');
  loadSrc(sandbox, 'src/factory-presets.js');
}

function sentenceCount(text) {
  var parts = String(text).split(/[.!?]+/).filter(function (p) {
    return p.trim().length > 0;
  });
  return parts.length;
}

function main() {
  var sandbox = createSandbox();
  loadLibraryStack(sandbox);

  var lib = sandbox.FACTORY_LIBRARY;
  var fp = sandbox.FactoryPresets;
  var catalog = sandbox.EffectCatalog;

  check(!!lib && Array.isArray(lib.PRESETS), 'Z: window.FACTORY_LIBRARY loads with a PRESETS array');
  check(!!fp && typeof fp.list === 'function', 'Z: thin loader exports list()');
  if (!lib || !fp) {
    console.log('FAIL: harness cannot proceed without the data module + loader');
    return 1;
  }

  var entries = lib.PRESETS;

  // --------------------------------------------------------------------
  console.log('A. structure, vocabularies, and primary tags');
  // --------------------------------------------------------------------

  check(entries.length === 33, 'A1: the library ships thirty-three entries (six original + eight promoted 2026-09-01 + nineteen promoted at the 2026-09-02 scale-out audition)');

  var seenNames = {};
  entries.forEach(function (entry) {
    var p = "'" + entry.name + "'";
    check(typeof entry.name === 'string' && entry.name.length > 0 && !seenNames[entry.name],
      'A1: ' + p + ' has a unique non-empty name');
    seenNames[entry.name] = true;

    check(typeof entry.description === 'string' && entry.description.trim().length > 0,
      'A1: ' + p + ' has a non-empty description');
    check(sentenceCount(entry.description) <= 2,
      'A1: ' + p + ' description is at most two sentences');

    // The agent-matching line (scale-out D-13). Presence and the <=60-char
    // ceiling are both load-bearing: list_presets ships one summary per
    // entry, so a library growing toward 60 presets stays inside the
    // agent's browse budget only while every summary is short. It must
    // also be HAND-WRITTEN, not a truncation of description — checked
    // structurally below (a prefix of the description is a truncation).
    check(typeof entry.summary === 'string' && entry.summary.trim().length > 0,
      'A1: ' + p + ' has a non-empty summary (the <=60-char line an agent matches a request against)');
    if (typeof entry.summary === 'string') {
      check(entry.summary.length <= 60,
        'A1: ' + p + ' summary is at most 60 characters (' + entry.summary.length + ')');
      check(entry.summary === entry.summary.trim(),
        'A1: ' + p + ' summary carries no leading/trailing whitespace');
      check(entry.description.indexOf(entry.summary.replace(/[.…]+$/, '')) !== 0,
        'A1: ' + p + ' summary is hand-written, not a truncation of description (truncation keeps the setup and cuts the payoff)');
    }

    check(Array.isArray(entry.tags) && entry.tags.length > 0,
      'A1: ' + p + ' carries at least one tag');
    var vocab = lib.VOCABULARIES;
    entry.tags.forEach(function (tag) {
      var m = /^([a-z-]+):(.+)$/.exec(tag);
      check(!!m && vocab[m[1]] !== undefined,
        'A1: ' + p + " tag '" + tag + "' names a known axis");
      if (m && vocab[m[1]]) {
        check(vocab[m[1]].indexOf(m[2]) !== -1,
          'A1: ' + p + " tag '" + tag + "' is in that axis's append-only vocabulary");
      }
    });

    check(entry.tags.indexOf(entry.primary) !== -1,
      'A1: ' + p + " primary '" + entry.primary + "' is one of its tags");
    check(entry.primary.indexOf('technique:') !== 0,
      'A1: ' + p + " primary '" + entry.primary + "' is a public axis (technique never groups)");
    check(lib.PRIMARY_GROUP_ORDER.indexOf(entry.primary) !== -1,
      'A1: ' + p + " primary '" + entry.primary + "' has a slot in the group order");
  });

  // Group order: covers only public-axis tags, no duplicates, cleanup first.
  var order = lib.PRIMARY_GROUP_ORDER;
  check(Array.isArray(order) && order.length > 0, 'A2: PRIMARY_GROUP_ORDER is a non-empty array');
  check(order[0] === 'use-case:cleanup', 'A2: cleanup groups before everything (highest-demand cell, #28)');
  var orderSeen = {};
  var allTags = {};
  Object.keys(lib.VOCABULARIES).forEach(function (axis) {
    lib.VOCABULARIES[axis].forEach(function (v) { allTags[axis + ':' + v] = axis; });
  });
  order.forEach(function (tag) {
    check(!orderSeen[tag], 'A2: group order lists ' + tag + ' once');
    orderSeen[tag] = true;
    check(allTags[tag] !== undefined,
      "A2: group order member '" + tag + "' is a real vocabulary tag");
    check(allTags[tag] !== 'technique',
      "A2: group order member '" + tag + "' is not a technique tag");
  });

  // --------------------------------------------------------------------
  console.log('B. provenance: nothing ships unauditioned');
  // --------------------------------------------------------------------

  entries.forEach(function (entry) {
    var p = "'" + entry.name + "'";
    var pr = entry.provenance;
    check(!!pr && typeof pr === 'object', 'B1: ' + p + ' records provenance');
    if (pr) {
      check(typeof pr.origin === 'string' && pr.origin.length > 0, 'B1: ' + p + ' provenance.origin names the material');
      check(typeof pr.auditionDate === 'string' && pr.auditionDate.length > 0, 'B1: ' + p + ' provenance.auditionDate is present');
      check(pr.verdict === 'accepted',
        'B1: ' + p + " provenance.verdict is 'accepted' (anything else belongs in the pipeline, not the library)");
    }
  });

  // --------------------------------------------------------------------
  console.log('C. every entry deserializes through the real PresetSchema');
  // --------------------------------------------------------------------

  entries.forEach(function (entry) {
    var ok = true;
    var err = '';
    try {
      var out = sandbox.PresetSchema.deserialize({
        schemaVersion: 1,
        name: entry.name,
        nodes: entry.nodes.map(function (n) {
          return { id: n.id, type: n.type, params: Object.assign({}, n.params) };
        })
      });
      ok = out.name === entry.name && out.nodes.length === entry.nodes.length;
    } catch (e) {
      ok = false;
      err = String(e && e.message ? e.message : e);
    }
    check(ok, "C1: '" + entry.name + "' passes PresetSchema.deserialize" + (err ? ' — ' + err : ''));
  });

  // --------------------------------------------------------------------
  console.log('D. registry drift: every node and param is legal in the LIVE catalog');
  // --------------------------------------------------------------------

  var types = catalog.getAllTypes();
  entries.forEach(function (entry) {
    var p = "'" + entry.name + "'";
    entry.nodes.forEach(function (node) {
      if (types.indexOf(node.type) === -1) {
        check(false,
          p + ' node ' + node.id + ": type '" + node.type + "' is not in the live catalog — PULL the preset until re-auditioned");
        return;
      }
      var specs = catalog.getParamSpec(node.type);
      var specById = {};
      specs.forEach(function (s) { specById[s.id] = s; });
      Object.keys(node.params || {}).forEach(function (param) {
        var spec = specById[param];
        var value = node.params[param];
        var where = p + ' node ' + node.id + ' (' + node.type + ') param ' + param;
        if (!spec) {
          check(false,
            where + " is unknown to the live registry — PULL the preset until re-auditioned (legal params: " +
            specs.map(function (s) { return s.id; }).join(', ') + ')');
          return;
        }
        if (Array.isArray(spec.values)) {
          check(typeof value === 'string' && spec.values.indexOf(value) !== -1,
            where + " carries canonical string '" + value + "' from the spec's discrete values");
        } else {
          check(typeof value === 'number' && isFinite(value) &&
            value >= spec.min - RANGE_EPS && value <= spec.max + RANGE_EPS,
            where + ' value ' + value + ' is a finite number inside [' + spec.min + ', ' + spec.max + ']');
        }
      });
    });
  });

  // --------------------------------------------------------------------
  console.log('E. loader contracts: exact shapes, fresh copies, no node leakage');
  // --------------------------------------------------------------------

  var listed = fp.list();
  check(listed.length === entries.length, 'E1: list() covers every entry');
  listed.forEach(function (e) {
    check(Object.keys(e).sort().join(',') === 'name,nodes',
      "E1: list() entry '" + e.name + "' has exactly {name, nodes} (metadata never leaks — test-preset-tools deep-equals this shape)");
    e.nodes.forEach(function (n) {
      check(Object.keys(n).sort().join(',') === 'id,params,type',
        'E1: list() node ' + n.id + ' has exactly {id, type, params}');
    });
  });
  // Freshness: mutate a handed-out copy; a second call must be unaffected.
  listed[0].nodes[0].params.guke = 1;
  check(fp.list()[0].nodes[0].params.guke === undefined,
    'E1: list() hands out fresh copies (mutation of one result cannot reach the library)');

  // Independent re-derivation of the loader's humanize rules, so the test
  // asserts the DERIVATION (category === humanized primary) rather than
  // trusting the loader's own copy of the algorithm.
  function humanize(tag) {
    var value = tag.indexOf(':') !== -1 ? tag.slice(tag.indexOf(':') + 1) : tag;
    var out = '';
    var capNext = true;
    for (var i = 0; i < value.length; i++) {
      var ch = value[i];
      if (ch === '/' || ch === '-' || ch === ' ') {
        capNext = true;
        out += ch;
      } else if (capNext) {
        out += ch.toUpperCase();
        capNext = false;
      } else {
        out += ch;
      }
    }
    return out;
  }

  var described = fp.describeAll();
  check(described.length === entries.length, 'E2: describeAll() covers every entry');
  described.forEach(function (e) {
    check(Object.keys(e).sort().join(',') === 'category,description,name',
      "E2: describeAll() entry '" + e.name + "' has exactly {name, description, category}");
  });
  var byName = {};
  entries.forEach(function (entry) { byName[entry.name] = entry; });
  described.forEach(function (e) {
    check(e.category === humanize(byName[e.name].primary),
      "E2: describeAll() entry '" + e.name + "' category '" + e.category +
      "' is the humanized primary tag (derived, never stored per-entry)");
  });

  var detailed = fp.listDetailed();
  check(detailed.length === entries.length, 'E3: listDetailed() covers every entry');
  detailed.forEach(function (e) {
    check(Object.keys(e).sort().join(',') === 'description,name,primary,provenance,summary,tags',
      "E3: listDetailed() entry '" + e.name + "' has exactly {name, summary, description, tags, primary, provenance} — never nodes");
    check(e.summary === byName[e.name].summary && e.description === byName[e.name].description,
      "E3: listDetailed() entry '" + e.name + "' carries the data module's summary AND description verbatim (compact and full are separate fields, not one truncated into the other)");
  });
  detailed[0].tags.push('genre:Sneaky');
  check(fp.listDetailed()[0].tags.indexOf('genre:Sneaky') === -1,
    'E3: listDetailed() tags are fresh copies');
  check(Array.isArray(fp.groupOrder()) && fp.groupOrder()[0] === 'Cleanup',
    'E3: groupOrder() exposes the humanized category order, Cleanup first');
  (function () {
    var seen = {};
    var dup = null;
    fp.groupOrder().forEach(function (label) {
      if (seen[label]) { dup = label; }
      seen[label] = true;
    });
    check(dup === null,
      'E3: humanized group-order labels are unique' + (dup ? " (collision: '" + dup + "' would silently merge groups)" : ''));
  })();

  // Degrade: loader alone (no data module) exports empty everything.
  var bare = createSandbox();
  loadSrc(bare, 'src/factory-presets.js');
  check(bare.FactoryPresets.list().length === 0 &&
    bare.FactoryPresets.describeAll().length === 0 &&
    bare.FactoryPresets.listDetailed().length === 0 &&
    bare.FactoryPresets.groupOrder().length === 0,
    'E4: without the data module every loader export is empty (documented degrade path)');

  // --------------------------------------------------------------------
  console.log('F. index.html wiring: data module loads before the loader');
  // --------------------------------------------------------------------

  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var dataAt = html.indexOf('src/factory-library-data.js');
  var loaderAt = html.indexOf('src/factory-presets.js');
  check(dataAt !== -1 && loaderAt !== -1 && dataAt < loaderAt,
    'F1: index.html loads factory-library-data.js before factory-presets.js');

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: factory library conforms (wayfinder #30) — ' + entries.length + ' auditioned entries, no drift');
    return 0;
  }
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (label) {
    console.log('  - ' + label);
  });
  return 1;
}

process.exit(main());
