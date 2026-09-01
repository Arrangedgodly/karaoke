// Test for cycle-4 FEW-1 — layout store seam + schema migration.
//
// Scope under test (src/persistence.js ONLY — the STORE + MIGRATION, not
// the canvas consumer, which is FEW-2's):
//   - The autosave slot becomes this module's own versioned ENVELOPE
//     {autosaveVersion: 2, chain: <PresetSchema wire form>, layout:
//     {<nodeId>: {x, y, scale, flow}}} — same localStorage key
//     ('karaoke-autosave-v1', key discipline: keys are kept for data
//     preservation), PresetSchema/PresetStore byte-untouched.
//   - saveCurrentChain(model, layout): layout object = stored (pruned
//     against the model's node ids, normalized to the 4-field shape);
//     undefined = CARRY FORWARD the stored layout (pruned); null =
//     explicit clear to {}.
//   - Legacy payloads (bare preset shape, no envelope) migrate to the
//     tidy-stack fallback: chain loads exactly, layout is {} (absence of
//     an entry IS the incumbent tidy vertical stack — no coordinates are
//     synthesized). Migration is idempotent.
//   - Hostile layouts fail soft: the chain still loads exactly, the
//     layout degrades to {} / drops the hostile entries; a hostile
//     layout NEVER rejects an otherwise-valid chain.
//   - Preset load leaves layout tidy/absent: presets stay chain-only
//     (PresetStore round-trip carries no layout), and replacing the
//     chain via a layout-less save prunes the stale ids' positions.
//
// Same committed zero-dependency convention as the other suites: plain
// `node`, browser globals stubbed, the REAL src files run in a vm
// sandbox, "  ok - " per check, exit 0 on pass / 1 on any failure.
//
// Run from a clean clone:  node tests/test-autosave-layout-store.js
// (or via the runner:      node tests/run.js autosave-layout)

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var AUTOSAVE_KEY = 'karaoke-autosave-v1';
var PRESET_STORE_KEY = 'karaoke-presets-v1';

var failures = [];

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// The minimal in-memory localStorage stub (getItem/setItem/removeItem,
// plus a parse-everything snapshot helper).
function createStorageStub() {
  var box = {};
  return {
    __box: box,
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(box, key) ? box[key] : null;
    },
    setItem: function (key, value) {
      box[key] = String(value);
    },
    removeItem: function (key) {
      delete box[key];
    },
    __read: function (key) {
      try {
        return JSON.parse(box[key]);
      } catch (err) {
        return '<unparsable>';
      }
    }
  };
}

// Sandbox: window === global, quiet console that RECORDS console.error
// (the recovery paths must log exactly once, never throw), the storage
// stub, and the REAL src files this seam needs — preset-schema (chain
// wire form), default-preset (the fallback chain), preset-store (the
// UNTOUCHED named-preset lane, loaded to prove it carries no layout),
// and persistence itself. A narrow EffectCatalog fixture keeps the
// production registered-type guards active; parameter-contract behavior
// remains the dedicated catalog/schema suites' responsibility.
function createEnv() {
  var storage = createStorageStub();
  var consoleErrors = [];
  var sandbox = {
    console: {
      log: function () {},
      warn: function () {},
      error: function () {
        consoleErrors.push(Array.prototype.slice.call(arguments).join(' '));
      }
    },
    EffectCatalog: {
      getAllTypes: function () { return ['gain', 'delay', 'limiter']; },
      getParamSpec: function () { return []; }
    },
    localStorage: storage
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  [
    'src/preset-schema.js',
    'src/default-preset.js',
    'src/preset-store.js',
    'src/persistence.js'
  ].forEach(function (relPath) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox, {
      filename: relPath
    });
  });
  return { sandbox: sandbox, storage: storage, consoleErrors: consoleErrors };
}

function copyNodes(nodes) {
  return nodes.map(function (entry) {
    return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
  });
}

// A small three-node model with distinct, stable ids.
function chainA() {
  return [
    { id: 'a1', type: 'gain', params: { gainDb: 2 } },
    { id: 'a2', type: 'delay', params: { time: 0.2, feedback: 12, mix: 30 } },
    { id: 'a3', type: 'limiter', params: { threshold: -1 } }
  ];
}

// A REPLACEMENT chain (the preset-load shape: same types, fresh ids).
function chainB() {
  return [
    { id: 'b1', type: 'gain', params: { gainDb: 0 } },
    { id: 'b2', type: 'limiter', params: { threshold: -1 } }
  ];
}

function seedRaw(env, value) {
  env.storage.__box[AUTOSAVE_KEY] =
    typeof value === 'string' ? value : JSON.stringify(value);
}

function main() {
  var LAYOUT_FULL = {
    a1: { x: 12, y: 40, scale: 1.25, flow: 'horizontal' },
    a2: { x: 12, y: 260, scale: 1, flow: 'horizontal' },
    a3: { x: 96, y: 520, scale: 0.75, flow: 'horizontal' }
  };

  // Issue #20: autosave is part of ChainEditing's result, so this adapter
  // must distinguish a verified write from a silent storage drop.
  console.log('0. save result truthfulness');
  {
    var truthEnv = createEnv();
    var healthy = truthEnv.sandbox.Persistence.saveCurrentChain(chainA(), LAYOUT_FULL);
    check(healthy && healthy.saved === true,
      '0A: a write whose exact payload reads back reports saved:true');

    var droppedEnv = createEnv();
    droppedEnv.storage.setItem = function () { /* browser silently dropped the write */ };
    var dropped = droppedEnv.sandbox.Persistence.saveCurrentChain(chainA(), LAYOUT_FULL);
    check(dropped && dropped.saved === false && dropped.error,
      '0B: a silent storage drop reports saved:false with an error');
  }

  // ----------------------------------------------------------------
  console.log('A. round-trip: save with layout, reload keeps it exactly');
  // ----------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;

    sandbox.Persistence.saveCurrentChain(chainA(), LAYOUT_FULL);
    var stored = env.storage.__read(AUTOSAVE_KEY);
    check(stored.autosaveVersion === 2, 'A1: the slot is the v2 envelope (autosaveVersion 2)');
    check(
      stored.chain &&
        stored.chain.schemaVersion === 1 &&
        stored.chain.name === '__autosave__' &&
        stored.chain.nodes.length === 3,
      'A1: the chain half is the UNCHANGED PresetSchema wire form'
    );
    check(deepEqual(stored.layout, LAYOUT_FULL), 'A1: the layout map is stored verbatim (all 4 fields)');

    var reloaded = sandbox.Persistence.loadInitialModel();
    var relayout = sandbox.Persistence.loadInitialLayout();
    check(deepEqual(reloaded, chainA()), 'A2: loadInitialModel round-trips the chain EXACTLY');
    check(deepEqual(relayout, LAYOUT_FULL), 'A2: loadInitialLayout round-trips the layout EXACTLY');
    check(
      env.consoleErrors.length === 0,
      'A2: the healthy round-trip logs ZERO console.error'
    );

    // Defaults normalize: missing scale -> 1, missing/illegal flow ->
    // 'horizontal' (the board's default reading since the 2026-08-31
    // horizontal-default round) — stored normalized, reloaded normalized.
    // The same pass exercises the per-card width field `w`: a finite
    // number clamps into the condensed range (176..384 px); anything else
    // drops the field (the card takes the uniform CSS default).
    sandbox.Persistence.saveCurrentChain(chainA(), {
      a1: { x: 0, y: 0 },
      a2: { x: 5, y: 5, scale: 2, flow: 'DIAGONAL' },
      a3: { x: 9, y: 9, w: 5000 }
    });
    check(
      deepEqual(sandbox.Persistence.loadInitialLayout(), {
        a1: { x: 0, y: 0, scale: 1, flow: 'horizontal' },
        a2: { x: 5, y: 5, scale: 2, flow: 'horizontal' },
        a3: { x: 9, y: 9, w: 384, scale: 1, flow: 'horizontal' }
      }),
      'A3: omitted scale defaults to 1, illegal flow defaults to horizontal (the default reading), and a width clamps into the condensed range (normalized on save)'
    );

    // Width bounds + garbage: below-min clamps up, non-finite drops.
    sandbox.Persistence.saveCurrentChain(chainA(), {
      a1: { x: 0, y: 0, w: 10 },
      a2: { x: 5, y: 5, w: 'wide' }
    });
    check(
      deepEqual(sandbox.Persistence.loadInitialLayout(), {
        a1: { x: 0, y: 0, w: 96, scale: 1, flow: 'horizontal' },
        a2: { x: 5, y: 5, scale: 1, flow: 'horizontal' }
      }),
      'A3b: a sub-minimum width clamps to 96px and a non-numeric width drops (CSS default)'
    );

    // Prune on save: entries for ids the model does not contain never
    // reach the slot.
    sandbox.Persistence.saveCurrentChain(chainB(), {
      b1: { x: 10, y: 10, scale: 1, flow: 'vertical' },
      a1: { x: 12, y: 40, scale: 1.25, flow: 'horizontal' },
      ghost: { x: 1, y: 1, scale: 1, flow: 'vertical' }
    });
    check(
      deepEqual(sandbox.Persistence.loadInitialLayout(), {
        // flow normalizes to 'horizontal' on save (vertical retired)
        b1: { x: 10, y: 10, scale: 1, flow: 'horizontal' }
      }),
      'A4: unknown node ids in a saved layout are PRUNED (removed node, stale ghost)'
    );
  }

  // ----------------------------------------------------------------
  console.log('B. legacy autosave (no layout) migrates to the tidy-stack fallback');
  // ----------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;

    // Exactly what every pre-cycle-4 build wrote: the bare preset wire
    // object under the same key.
    seedRaw(env, {
      schemaVersion: 1,
      name: '__autosave__',
      nodes: chainA()
    });
    var first = sandbox.Persistence.loadInitialModel();
    var firstLayout = sandbox.Persistence.loadInitialLayout();
    check(deepEqual(first, chainA()), 'B1: the legacy CHAIN loads EXACTLY as before');
    check(
      firstLayout !== null && typeof firstLayout === 'object' && Object.keys(firstLayout).length === 0,
      'B1: the legacy payload migrates to layout {} (absent entry = the tidy stack)'
    );
    check(env.consoleErrors.length === 0, 'B1: legacy migration is not an error (zero console.error)');

    // Idempotent: a second load of the same legacy slot is identical.
    check(
      deepEqual(sandbox.Persistence.loadInitialModel(), first) &&
        deepEqual(sandbox.Persistence.loadInitialLayout(), firstLayout),
      'B2: migration is IDEMPOTENT (re-loading the legacy slot gives the identical result)'
    );

    // The first save after the migration rewrites the slot as a steady-
    // state v2 envelope with layout {} — which then loads the same.
    sandbox.Persistence.saveCurrentChain(chainA()); // today's caller form: no layout arg
    var stored = env.storage.__read(AUTOSAVE_KEY);
    check(
      stored.autosaveVersion === 2 && deepEqual(stored.layout, {}),
      'B3: the first post-migration save rewrites the slot as v2 with layout {}'
    );
    check(
      deepEqual(sandbox.Persistence.loadInitialModel(), chainA()) &&
        Object.keys(sandbox.Persistence.loadInitialLayout()).length === 0,
      'B3: the rewritten slot loads identically (chain exact, layout still tidy)'
    );

    // Legacy hostile chains still recover to the default chain exactly
    // as before (the envelope change added no leniency to the chain —
    // distortion's PRE-1 param contract rejects the out-of-range drive).
    seedRaw(env, {
      schemaVersion: 1,
      name: '__autosave__',
      nodes: [{ id: 'x', type: 'distortion', params: { drive: 5, tone: 0.7, output: -3 } }]
    });
    env.consoleErrors.length = 0;
    check(
      deepEqual(sandbox.Persistence.loadInitialModel(), sandbox.DEFAULT_PRESET.nodes) &&
        Object.keys(sandbox.Persistence.loadInitialLayout()).length === 0,
      'B4: a hostile LEGACY chain still falls back to the default chain, layout {} '
    );
    check(
      env.consoleErrors.length === 2,
      'B4: one console.error per read that recovers (model + layout re-reads)'
    );
  }

  // ----------------------------------------------------------------
  console.log('C. carry-forward, explicit clear, and the preset-load tidy state');
  // ----------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;

    // Save with layout, then a layout-LESS save of the SAME chain (a
    // param tweak / agent rebuild — today's only caller form): the
    // stored positions must survive, not be wiped.
    sandbox.Persistence.saveCurrentChain(chainA(), LAYOUT_FULL);
    sandbox.Persistence.saveCurrentChain(chainA());
    check(
      deepEqual(sandbox.Persistence.loadInitialLayout(), LAYOUT_FULL),
      'C1: a layout-less save of the same chain CARRIES FORWARD the stored positions'
    );

    // The preset-load shape: PresetStore stays chain-only; loading a
    // preset replaces the chain (fresh ids) and the autosave that
    // follows prunes the old positions — the board is tidy again.
    var saved = sandbox.PresetStore.save('Board Preset', chainB());
    check(!!saved && saved.ok === true, 'C2 setup: PresetStore.save works (store untouched)');
    var storedPreset = env.storage.__read(PRESET_STORE_KEY)['Board Preset'];
    check(
      storedPreset.schemaVersion === 1 &&
        storedPreset.nodes.length === 2 &&
        !('layout' in storedPreset),
      'C2: the named preset carries NO layout — presets stay chain-only (schema untouched)'
    );
    var loaded = sandbox.PresetStore.load('Board Preset');
    check(
      !!loaded && deepEqual(loaded.nodes, chainB()) && !('layout' in loaded),
      'C2: PresetStore.load round-trips the chain only (byte-nothing extra)'
    );
    // The chain replacement's autosave (canvas calls saveCurrentChain
    // with the new model and, pre-FEW-2, no layout arg):
    sandbox.Persistence.saveCurrentChain(chainB());
    check(
      Object.keys(sandbox.Persistence.loadInitialLayout()).length === 0,
      'C3: preset load -> autosave prunes the replaced chain\'s positions (layout tidy/absent)'
    );

    // Explicit null clears: the TIDY-reset seam.
    sandbox.Persistence.saveCurrentChain(chainB(), { b1: { x: 9, y: 9, scale: 1, flow: 'vertical' } });
    sandbox.Persistence.saveCurrentChain(chainB(), null);
    check(
      Object.keys(sandbox.Persistence.loadInitialLayout()).length === 0,
      'C4: saveCurrentChain(model, null) explicitly CLEARS the layout ({} stored)'
    );
  }

  // ----------------------------------------------------------------
  console.log('D. hostile layouts fail soft (never take down a valid chain)');
  // ----------------------------------------------------------------
  {
    var cases = [
      { label: 'layout is an array', layout: [{ x: 1, y: 1 }] },
      { label: 'layout is a string', layout: 'everywhere' },
      { label: 'layout is a number', layout: 42 },
      { label: 'entry is a string', layout: { a1: 'top-left' } },
      { label: 'entry is null', layout: { a1: null } },
      { label: 'x is NaN', layout: { a1: { x: NaN, y: 10, scale: 1, flow: 'vertical' } } },
      { label: 'y is Infinity', layout: { a1: { x: 10, y: Infinity, scale: 1, flow: 'vertical' } } },
      { label: 'x is a string', layout: { a1: { x: '10', y: 10, scale: 1, flow: 'vertical' } } }
    ];
    cases.forEach(function (hostile) {
      var env = createEnv();
      var sandbox = env.sandbox;
      seedRaw(env, {
        autosaveVersion: 2,
        chain: { schemaVersion: 1, name: '__autosave__', nodes: chainA() },
        layout: hostile.layout
      });
      env.consoleErrors.length = 0;
      var threw = null;
      var nodes = null;
      var layout = null;
      try {
        nodes = sandbox.Persistence.loadInitialModel();
        layout = sandbox.Persistence.loadInitialLayout();
      } catch (err) {
        threw = err;
      }
      check(!threw, 'D: hostile layout (' + hostile.label + ') NEVER throws');
      check(
        deepEqual(nodes, chainA()),
        'D: hostile layout (' + hostile.label + ') — the CHAIN still loads EXACTLY'
      );
      check(
        layout !== null && typeof layout === 'object' && Object.keys(layout).length === 0,
        'D: hostile layout (' + hostile.label + ') degrades to layout {} (tidy)'
      );
      check(
        env.consoleErrors.length === 0,
        'D: hostile layout (' + hostile.label + ') is silent fail-soft (not a chain-level error)'
      );
    });

    // Mixed hostility: the GOOD entry survives, the bad ones drop.
    {
      var env = createEnv();
      var sandbox = env.sandbox;
      seedRaw(env, {
        autosaveVersion: 2,
        chain: { schemaVersion: 1, name: '__autosave__', nodes: chainA() },
        layout: {
          a1: { x: 12, y: 40, scale: 1.25, flow: 'horizontal' },
          a2: { x: NaN, y: 5 },
          a3: 'floating'
        }
      });
      check(
        deepEqual(sandbox.Persistence.loadInitialLayout(), { a1: LAYOUT_FULL.a1 }),
        'D: a mixed layout keeps the valid entry and drops only the hostile ones'
      );
    }

    // A throwing getter can't live in a real slot (storage is inert
    // JSON) — the only live-object hostility is a CALLER handing one to
    // saveCurrentChain(). That save must fail soft too: no throw, the
    // poisoned entry simply never reaches the slot.
    {
      var env = createEnv();
      var sandbox = env.sandbox;
      var trap = {
        a1: { x: 12, y: 40, scale: 1.25, flow: 'horizontal' }
      };
      Object.defineProperty(trap, 'a2', {
        enumerable: true,
        get: function () {
          throw new Error('hostile getter');
        }
      });
      var threw = null;
      try {
        sandbox.Persistence.saveCurrentChain(chainA(), trap);
      } catch (err) {
        threw = err;
      }
      check(!threw, 'D: a throwing getter in the SAVED layout never escapes saveCurrentChain');
      check(
        deepEqual(sandbox.Persistence.loadInitialLayout(), { a1: LAYOUT_FULL.a1 }),
        'D: the throwing-getter save fails soft to the entries that were readable'
      );
    }

    // Envelope-level hostility: unsupported future version and a
    // missing/invalid chain reject through the DEFAULT-CHAIN fallback
    // (never a misread), exactly like an unsupported PresetSchema version.
    [
      { label: 'unsupported future autosaveVersion', payload: { autosaveVersion: 3, chain: { schemaVersion: 1, name: '__autosave__', nodes: chainA() }, layout: {} } },
      { label: 'envelope without a chain', payload: { autosaveVersion: 2, layout: { a1: { x: 1, y: 1 } } } },
      { label: 'envelope chain fails schema', payload: { autosaveVersion: 2, chain: { schemaVersion: 9, name: '__autosave__', nodes: chainA() }, layout: {} } },
      { label: 'unparsable slot', payload: 'not json {{{' }
    ].forEach(function (hostile) {
      var env = createEnv();
      var sandbox = env.sandbox;
      seedRaw(env, hostile.payload);
      env.consoleErrors.length = 0;
      var threw = null;
      var nodes = null;
      try {
        nodes = sandbox.Persistence.loadInitialModel();
      } catch (err) {
        threw = err;
      }
      check(!threw, 'E: hostile envelope (' + hostile.label + ') NEVER throws');
      check(
        deepEqual(nodes, sandbox.DEFAULT_PRESET.nodes),
        'E: hostile envelope (' + hostile.label + ') falls back to the DEFAULT chain exactly'
      );
      check(
        env.consoleErrors.length === 1,
        'E: hostile envelope (' + hostile.label + ') logs ONE console.error for the model read'
      );
      check(
        Object.keys(sandbox.Persistence.loadInitialLayout()).length === 0,
        'E: hostile envelope (' + hostile.label + ') yields layout {}'
      );
    });
  }

  // ----------------------------------------------------------------
  console.log('F. key discipline: the localStorage key is unchanged');
  // ----------------------------------------------------------------
  {
    var env = createEnv();
    var sandbox = env.sandbox;
    sandbox.Persistence.saveCurrentChain(chainA(), LAYOUT_FULL);
    check(
      env.storage.__box.hasOwnProperty(AUTOSAVE_KEY) &&
        Object.keys(env.storage.__box).length === 1,
      'F1: the v2 envelope still lives under the ONE key karaoke-autosave-v1 (data preserved across the upgrade)'
    );
  }

  if (failures.length === 0) {
    console.log('PASS: autosave layout store seam + schema migration (FEW-1)');
    return 0;
  }
  console.log('FAIL: ' + failures.length + ' check(s) failed:');
  failures.forEach(function (label) {
    console.log('  - ' + label);
  });
  return 1;
}

process.exit(main());
