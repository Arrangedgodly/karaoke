// Test for issue #9 (+ #12's two preset tools) — all ten WebMCP tools
// must REGISTER with the schemas and annotations the code intends,
// through the REAL shim.
//
// What is under test here is the registration SURFACE an agent's host
// actually sees: src/mcp-tools.js builds 10 ModelContextTool defs and
// self-registers them at parse time through src/mcp-server.js (the
// permanent WebMCP shim), which validates each def, WRAPS its execute
// (lifecycle/timeout/rejection capture), forwards only the known fields,
// and hands the result to the browser's modelContext.registerTool().
//
// So this file loads the real src/mcp-server.js, the real
// src/agent-ui.js (the shim and the tool layer both drive its state
// contract), the real node registry (audio-graph + node-types + the six
// node files, so add_node's schema enum comes from the LIVE registry
// exactly as in index.html), and the real src/mcp-tools.js — into the
// same zero-dependency vm sandbox the other committed tests use. In place
// of a browser, `document.modelContext` is a stub WebMCP API that
// accepts every tool and records exactly what it was handed; the
// assertions then run over BOTH sides of the registration:
//
//   A. McpTools.getDefs() — 10 defs, fixed order, well-formed shapes.
//   B. the SHIM's registry (McpServer.listRegistered()) and the stub
//      API's captures — every tool made it through, in order, and what
//      the API received is exactly the five fields the shim forwards
//      (name, description, execute [wrapped], inputSchema, annotations).
//   C. the INTENDED per-tool specifics, read off the real registration
//      code: readOnlyHint true on the four read tools (get_capabilities,
//      get_chain, list_presets, get_preset) and false on the six mutation
//      tools; untrustedContentHint TRUE on the tools whose results return or
//      echo stored/user-/agent-authored content (get_chain's node ids and
//      name, list_presets' user-saved names, save_preset's echoed name)
//      and FALSE on get_capabilities (fully host-authored static text)
//      and the structural mutation tools (issue #11); the published
//      required fields per tool; add_node's type enum mirroring the live
//      registry.
//   D. the registered execute functions are wired to the REAL tools
//      through the shim's wrapper (a plain result object resolves, never
//      a synchronous throw — RQ-1's no-error-channel contract).
//
// The AgentUI side is the REAL src/agent-ui.js against a minimal DOM
// stub, so the load-time 'tools-ready' transition is asserted through
// its actual event contract, not a mock of it.
//
// Run from a clean clone:  node tests/test-tool-registration.js
// (or via the runner:      node tests/run.js tool-registration)
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

// ----------------------------------------------------------------------
// Assertions: collect failures so one run reports everything, exit 1 at
// the end if any check failed. (Same harness shape as the other tests.)
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

// Order-insensitive structural equality for the plain-JSON shapes the
// schema/annotation layer uses (same helper as the presets-policy test).
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

function sameMembers(arr, other) {
  if (!Array.isArray(arr) || !Array.isArray(other) || arr.length !== other.length) {
    return false;
  }
  var rest = other.slice();
  for (var i = 0; i < arr.length; i++) {
    var j = rest.indexOf(arr[i]);
    if (j === -1) {
      return false;
    }
    rest.splice(j, 1);
  }
  return true;
}

function walkSchema(schema, visit) {
  if (!schema || typeof schema !== 'object') {
    return;
  }
  visit(schema);
  if (schema.properties && typeof schema.properties === 'object') {
    Object.keys(schema.properties).forEach(function (name) {
      walkSchema(schema.properties[name], visit);
    });
  }
  if (schema.items) {
    walkSchema(schema.items, visit);
  }
  if (Array.isArray(schema.oneOf)) {
    schema.oneOf.forEach(function (entry) { walkSchema(entry, visit); });
  }
}

// The fixed def order McpTools.getDefs() promises (its contract block).
var EXPECTED_ORDER = [
  'get_capabilities',
  'get_chain',
  'set_chain',
  'add_node',
  'remove_node',
  'set_param',
  'list_presets',
  'get_preset',
  'load_preset',
  'save_preset'
];

// The INTENDED annotations, transcribed from the make*Tool() registration
// code in src/mcp-tools.js: the four read tools publish a read-only
// hint, the six mutation tools do not. untrustedContentHint is true for
// the tools whose results carry stored or user-/agent-authored content
// (issue #11): get_chain (the model incl. agent-assigned node ids and the
// stored chain name), list_presets (user-saved preset names),
// save_preset (its success echoes the caller-provided name), and — issue
// #12 — get_preset (returns stored/user-authored preset names + nodes)
// and load_preset (its success and toast echo the requested preset
// name). It is false for get_capabilities (fully host-authored static
// text) and the four structural mutation tools, whose results carry only
// host-authored diagnostics and host-assigned ids.
var EXPECTED_ANNOTATIONS = {
  get_capabilities: { readOnlyHint: true, untrustedContentHint: false },
  get_chain: { readOnlyHint: true, untrustedContentHint: true },
  list_presets: { readOnlyHint: true, untrustedContentHint: true },
  get_preset: { readOnlyHint: true, untrustedContentHint: true },
  set_chain: { readOnlyHint: false, untrustedContentHint: false },
  add_node: { readOnlyHint: false, untrustedContentHint: false },
  remove_node: { readOnlyHint: false, untrustedContentHint: false },
  set_param: { readOnlyHint: false, untrustedContentHint: false },
  load_preset: { readOnlyHint: false, untrustedContentHint: true },
  save_preset: { readOnlyHint: false, untrustedContentHint: true }
};

// ----------------------------------------------------------------------
// Minimal DOM element stub — only what the REAL src/agent-ui.js touches
// on its no-chip/no-body path (element creation, attribute set/get,
// appendChild). Torn down from tests/test-watchdog-tap-and-latch.js's
// richer stub; kept minimal here because registration never renders a
// toast (see the mutation-undo test for the full toast path).
// ----------------------------------------------------------------------
function makeElement(tag) {
  var el = {
    tagName: tag,
    id: '',
    className: '',
    textContent: '',
    children: [],
    parentNode: null,
    setAttribute: function (name, value) {
      el['__attr_' + name] = value;
    },
    getAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(el, '__attr_' + name)
        ? el['__attr_' + name]
        : null;
    },
    appendChild: function (child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    removeChild: function (child) {
      var i = el.children.indexOf(child);
      if (i !== -1) {
        el.children.splice(i, 1);
      }
      child.parentNode = null;
      return child;
    },
    addEventListener: function () {},
    querySelector: function () {
      return null;
    }
  };
  return el;
}

// The stub WebMCP API: accepts every tool (as chrome://flags/#enable-
// webmcp-testing Chrome would), records exactly what it was handed.
// registerTool must return a promise — the shim's contract.
var apiRegisterCalls = [];

// Document-level event capture for the REAL AgentUI contract.
var domEvents = [];
var domListeners = {};

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
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = (init && init.detail) || null;
    },
    document: {
      // No readyState -> the shim's init() runs at load (its
      // DOMContentLoaded-safe path), like a real end-of-body <script>.
      getElementById: function () {
        return null;
      },
      createElement: function (tag) {
        return makeElement(tag);
      },
      querySelector: function () {
        return null; // no .topbar -> AgentUI skips the chip, stays functional
      },
      addEventListener: function (type, fn) {
        (domListeners[type] = domListeners[type] || []).push(fn);
      },
      dispatchEvent: function (ev) {
        domEvents.push({ type: ev.type, detail: ev.detail });
        (domListeners[ev.type] || []).forEach(function (fn) {
          fn(ev);
        });
        return true;
      },
      modelContext: {
        registerTool: function (tool) {
          apiRegisterCalls.push(tool);
          return Promise.resolve(true);
        }
      }
    },
    navigator: {},
    // src/node-reverb.js fetches its IR at module load; a never-settling
    // promise is the honest "IR not fetched yet" state it tolerates.
    fetch: function () {
      return new Promise(function () {});
    },
    AudioEngine: { isStarted: false }
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

function getTool(sandbox, name) {
  var defs = sandbox.McpTools.getDefs();
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].name === name) {
      return defs[i];
    }
  }
  throw new Error('test bug: tool def not found: ' + name);
}

function byName(list, name) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === name) {
      return list[i];
    }
  }
  return null;
}

// ----------------------------------------------------------------------
// The test itself.
// ----------------------------------------------------------------------
async function main() {
  var sandbox = createSandbox();
  // index.html order: AgentUI first (both the shim and the tool layer
  // guard on it), then the shim, then the node registry the tools read.
  loadSrc(sandbox, 'src/agent-ui.js');
  loadSrc(sandbox, 'src/mcp-server.js');
  loadSrc(sandbox, 'src/audio-graph.js');
  loadSrc(sandbox, 'src/node-types.js');
  loadSrc(sandbox, 'src/audio-param-ramp.js'); // issue #5: the ramp helper the node applyParam handlers call
  loadSrc(sandbox, 'src/node-gain.js');
  loadSrc(sandbox, 'src/node-compressor.js');
  loadSrc(sandbox, 'src/node-eq.js');
  loadSrc(sandbox, 'src/node-delay.js');
  loadSrc(sandbox, 'src/node-reverb.js');
  loadSrc(sandbox, 'src/node-limiter.js');
  loadSrc(sandbox, 'src/mcp-tools.js'); // self-registers through the shim at parse

  // Await the public lifecycle promise instead of sleeping and sampling
  // while the browser may still be accepting the sequential batch.
  check(
    sandbox.McpTools.registrationReady &&
      typeof sandbox.McpTools.registrationReady.then === 'function',
    'A0: McpTools exposes the asynchronous registration lifecycle'
  );
  var registrationResult = await sandbox.McpTools.registrationReady;
  check(
    registrationResult.registered.join(',') === EXPECTED_ORDER.join(',') &&
      registrationResult.failed.length === 0,
    'A0: registrationReady resolves with all 10 tools accepted and no failures'
  );

  // --------------------------------------------------------------------
  console.log('A. the 10 defs McpTools.getDefs() returns');
  // --------------------------------------------------------------------
  var defs = sandbox.McpTools.getDefs();
  check(Array.isArray(defs) && defs.length === 10, 'A1: getDefs() returns exactly 10 defs');
  check(
    defs.map(function (d) { return d.name; }).join(',') === EXPECTED_ORDER.join(','),
    'A1: def order is the fixed contract order (' + EXPECTED_ORDER.join(', ') + ')'
  );
  var allDefsWellFormed = defs.every(function (d) {
    return (
      typeof d.name === 'string' && d.name.length > 0 &&
      typeof d.description === 'string' && d.description.length > 0 &&
      d.inputSchema && typeof d.inputSchema === 'object' && !Array.isArray(d.inputSchema) &&
      d.annotations && typeof d.annotations === 'object' && !Array.isArray(d.annotations) &&
      typeof d.execute === 'function'
    );
  });
  check(allDefsWellFormed, 'A1: every def has a name, a non-empty description, an inputSchema object, an annotations object, and an execute function');

  check(
    defs.every(function (d) { return d.name.length <= 30; }),
    'A2: every tool name stays within Chrome\'s preliminary 30-character guidance'
  );
  check(
    defs.every(function (d) { return d.description.length <= 500; }),
    'A2: every tool description stays within Chrome\'s preliminary 500-character guidance'
  );
  var parameterDescriptionsWithinBudget = true;
  var parameterNamesWithinBudget = true;
  defs.forEach(function (d) {
    walkSchema(d.inputSchema, function (schema) {
      if (typeof schema.description === 'string' && schema.description.length > 150) {
        parameterDescriptionsWithinBudget = false;
      }
      if (schema.properties) {
        Object.keys(schema.properties).forEach(function (name) {
          if (name.length > 30) {
            parameterNamesWithinBudget = false;
          }
        });
      }
    });
  });
  check(
    parameterDescriptionsWithinBudget,
    'A2: every parameter description stays within Chrome\'s preliminary 150-character guidance'
  );
  check(
    parameterNamesWithinBudget,
    'A2: every parameter name stays within Chrome\'s preliminary 30-character guidance'
  );

  // getDefs() promises FRESH objects — a caller mutating one result must
  // never poison the next registration.
  var defs2 = sandbox.McpTools.getDefs();
  check(
    defs.every(function (d, i) { return d !== defs2[i]; }) &&
      defs.length === defs2.length,
    'A1: getDefs() returns fresh objects on every call (no shared def state)'
  );

  // --------------------------------------------------------------------
  console.log('B. registration through the REAL shim into the stub WebMCP API');
  // --------------------------------------------------------------------
  check(
    sandbox.McpServer.isAvailable() === true,
    'B1: the shim detected the WebMCP API (document.modelContext with registerTool)'
  );
  check(
    sandbox.McpServer.listRegistered().join(',') === EXPECTED_ORDER.join(','),
    'B1: the shim\'s registry lists all 10 tools in registration order'
  );
  check(
    apiRegisterCalls.length === 10 &&
      apiRegisterCalls.map(function (t) { return t.name; }).join(',') === EXPECTED_ORDER.join(','),
    'B1: the WebMCP API received exactly 10 registerTool calls, same names, same order'
  );

  apiRegisterCalls.forEach(function (tool) {
    var keys = Object.keys(tool).sort().join(',');
    check(
      keys === 'annotations,description,execute,inputSchema,name',
      'B2: ' + tool.name + ' — the API saw exactly the 5 forwarded fields (name, description, execute, inputSchema, annotations; def extras dropped)'
    );
    check(
      typeof tool.execute === 'function',
      'B2: ' + tool.name + ' — the API received a callable execute (the shim\'s wrapper)'
    );
    var s = tool.inputSchema;
    check(
      !!s &&
        s.type === 'object' &&
        s.properties && typeof s.properties === 'object' && !Array.isArray(s.properties) &&
        Array.isArray(s.required) &&
        s.required.every(function (r) { return typeof r === 'string'; }) &&
        s.additionalProperties === false,
      'B2: ' + tool.name + ' — inputSchema is a closed object schema (plain properties, string[] required)'
    );
    check(
      deepEqual(tool.annotations, EXPECTED_ANNOTATIONS[tool.name]),
      'B3: ' + tool.name + ' — annotations are exactly ' +
        JSON.stringify(EXPECTED_ANNOTATIONS[tool.name])
    );
  });

  // --------------------------------------------------------------------
  console.log('C. the intended per-tool schemas (read vs mutation)');
  // --------------------------------------------------------------------
  ['get_capabilities', 'get_chain', 'list_presets'].forEach(function (name) {
    var tool = byName(apiRegisterCalls, name);
    check(
      !!tool &&
        Object.keys(tool.inputSchema.properties).length === 0 &&
        tool.inputSchema.required.length === 0,
      'C1: ' + name + ' takes no arguments (empty properties, empty required)'
    );
    check(
      !!tool && tool.annotations.readOnlyHint === true,
      'C1: ' + name + ' publishes readOnlyHint: true (a read tool)'
    );
  });

  // Issue #12: get_preset is a read tool that TAKES arguments (name +
  // optional namespace) — its schema specifics are C8 below; here just
  // the read-only hint, alongside the three no-arg reads.
  check(
    byName(apiRegisterCalls, 'get_preset').annotations.readOnlyHint === true,
    'C1: get_preset publishes readOnlyHint: true (a read tool)'
  );

  // Issue #11's explicit matrix (+ #12's two preset tools): untrusted-
  // content hint TRUE exactly on the tools that return/echo stored or
  // user-/agent-authored content.
  ['get_chain', 'list_presets', 'get_preset', 'load_preset', 'save_preset'].forEach(function (name) {
    check(
      byName(apiRegisterCalls, name).annotations.untrustedContentHint === true,
      'C1: ' + name + ' publishes untrustedContentHint: true (returns/echoes user- or agent-authored content)'
    );
  });
  ['get_capabilities', 'set_chain', 'add_node', 'remove_node', 'set_param'].forEach(function (name) {
    check(
      byName(apiRegisterCalls, name).annotations.untrustedContentHint === false,
      'C1: ' + name + ' publishes untrustedContentHint: false (host-authored result content)'
    );
  });

  ['set_chain', 'add_node', 'remove_node', 'set_param', 'load_preset', 'save_preset'].forEach(function (name) {
    check(
      byName(apiRegisterCalls, name).annotations.readOnlyHint === false,
      'C2: ' + name + ' publishes readOnlyHint: false (a mutation tool)'
    );
  });

  var setChain = byName(apiRegisterCalls, 'set_chain').inputSchema;
  check(
    sameMembers(setChain.required, ['chain']),
    'C3: set_chain requires [chain]'
  );
  check(
    setChain.properties.chain &&
      sameMembers(setChain.properties.chain.required, ['schemaVersion', 'name', 'nodes']) &&
      setChain.properties.chain.additionalProperties === false &&
      setChain.properties.chain.properties.nodes.items.additionalProperties === false,
    'C3: set_chain\'s fixed chain and node objects reject undeclared properties'
  );

  var addNode = byName(apiRegisterCalls, 'add_node').inputSchema;
  var liveTypes = sandbox.NodeTypes.getAllTypes();
  check(
    sameMembers(addNode.required, ['type']),
    'C4: add_node requires [type]'
  );
  check(
    sameMembers(addNode.properties.type.enum, liveTypes) && liveTypes.length === 6,
    'C4: add_node\'s type enum mirrors the LIVE node registry (' + liveTypes.join(', ') + ')'
  );

  check(
    sameMembers(byName(apiRegisterCalls, 'remove_node').inputSchema.required, ['nodeId']),
    'C5: remove_node requires [nodeId]'
  );

  check(
    sameMembers(byName(apiRegisterCalls, 'set_param').inputSchema.required, [
      'nodeId',
      'param',
      'value'
    ]),
    'C6: set_param requires [nodeId, param, value]'
  );

  var savePreset = byName(apiRegisterCalls, 'save_preset').inputSchema;
  check(
    sameMembers(savePreset.required, ['name']),
    'C7: save_preset requires [name]'
  );
  check(
    savePreset.properties.name &&
      savePreset.properties.name.minLength === 1 &&
      savePreset.properties.name.maxLength === 40,
    'C7: save_preset\'s name carries the published 1-40 character bounds'
  );

  // Issue #12: the two preset tools share one selector shape — name
  // required, optional namespace enum ['factory', 'user'].
  ['get_preset', 'load_preset'].forEach(function (name) {
    var schema = byName(apiRegisterCalls, name).inputSchema;
    check(
      sameMembers(schema.required, ['name']),
      'C8: ' + name + ' requires [name]'
    );
    check(
      schema.properties.namespace &&
        sameMembers(schema.properties.namespace.enum, ['factory', 'user']),
      'C8: ' + name + '\'s namespace is the optional [factory, user] enum'
    );
    check(
      schema.properties.namespace &&
        schema.required.indexOf('namespace') === -1,
      'C8: ' + name + '\'s namespace is OPTIONAL (required is [name] only)'
    );
  });

  // --------------------------------------------------------------------
  console.log('D. the registered execute functions run the REAL tools');
  // --------------------------------------------------------------------
  var capsResult = await byName(apiRegisterCalls, 'get_capabilities').execute({});
  check(
    !!capsResult &&
      capsResult.app === 'voxchain' &&
      capsResult.nodeTypes &&
      Object.keys(capsResult.nodeTypes).length === 6,
    'D1: get_capabilities resolves the compact policy for all 6 live node types'
  );
  check(
    JSON.stringify(capsResult).length <= 1500,
    'D1: get_capabilities stays within Chrome\'s preliminary 1,500-character output guidance (' +
      JSON.stringify(capsResult).length + ' characters)'
  );

  var chainResult = await byName(apiRegisterCalls, 'get_chain').execute({});
  check(
    !!chainResult &&
      chainResult.schemaVersion === 1 &&
      Array.isArray(chainResult.nodes) &&
      chainResult.nodes.length === 0 &&
      typeof chainResult.note === 'string' &&
      chainResult.note.length > 0,
    'D1: the registered get_chain resolves the honest pre-start shape (nodes [] + the Start note)'
  );

  // A mutation tool through its wrapper: an error travels as a RESULT
  // object (the API has no error channel — RQ-1), never a throw.
  var removeResult = await byName(apiRegisterCalls, 'remove_node').execute({ nodeId: 'nope' });
  check(
    !!removeResult &&
      removeResult.error === true &&
      removeResult.code === 'NODE_NOT_FOUND' &&
      Array.isArray(removeResult.validIds),
    'D1: the registered remove_node resolves a structured NODE_NOT_FOUND result (errors are values, not throws)'
  );

  // Issue #12's read tool through its wrapper: this sandbox loaded no
  // factory library and no PresetStore, so get_preset honestly resolves
  // the stable PRESET_NOT_FOUND refusal (available names both empty) —
  // never a throw and never a layer fault.
  var presetResult = await byName(apiRegisterCalls, 'get_preset').execute({ name: 'Classic Karaoke' });
  check(
    !!presetResult &&
      presetResult.error === true &&
      presetResult.code === 'PRESET_NOT_FOUND' &&
      presetResult.available &&
      Array.isArray(presetResult.available.factory) &&
      Array.isArray(presetResult.available.user),
    'D1: the registered get_preset resolves the structured PRESET_NOT_FOUND result in a bare harness (available names labelled by namespace)'
  );

  // The load-time lifecycle: registration success flips the REAL
  // AgentUI's state to 'tools-ready' (mcp-tools.js's self-init callback).
  var stateEvents = domEvents.filter(function (e) {
    return e.type === 'agentui:state';
  });
  check(
    sandbox.AgentUI.getState() === 'tools-ready',
    'D2: AgentUI state is \'tools-ready\' after the batch registration (was ' +
      (stateEvents.length > 0 ? "'" + stateEvents[0].detail.previous + "'" : '?') + ')'
  );
  check(
    stateEvents.length > 0 &&
      stateEvents[stateEvents.length - 1].detail.state === 'tools-ready',
    'D2: the \'agentui:state\' event fired the tools-ready transition through the real AgentUI'
  );

  // The refusal above also went to the operator through the real
  // AgentUI's mutation channel (rejected: true).
  var mutEvents = domEvents.filter(function (e) {
    return e.type === 'agentui:mutation';
  });
  check(
    mutEvents.length > 0 &&
      mutEvents[mutEvents.length - 1].detail.rejected === true &&
      typeof mutEvents[mutEvents.length - 1].detail.summary === 'string',
    'D2: the refused remove_node was disclosed to the operator via agentui:mutation (rejected: true)'
  );

  // --------------------------------------------------------------------
  if (failures.length === 0) {
    console.log('PASS: all 10 WebMCP tools register with the intended schemas and annotations (issues #9 + #12)');
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
