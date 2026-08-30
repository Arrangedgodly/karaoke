// In-page WebMCP registration adapter for the Karaoke Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Only external
// dependency: window.AgentUI (src/agent-ui.js, loaded earlier per
// index.html), and every use of it is guarded so this shim also works
// when AgentUI is absent. No localStorage; no other dependencies.
//
// This file has no server process, protocol transport, manifest, or
// connector. It adapts the app's definitions to the browser's imperative
// WebMCP API; the 10 production tools self-register from src/mcp-tools.js
// at top-level page load.
//
// API facts this shim encodes (RQ-1, docs/ultron/research/
// rq1-webmcp-api.md; live-verified on localhost 2026-08-27):
//   - Entry point: document.modelContext (Chrome 150+), with
//     navigator.modelContext as the deprecated Chrome-149 fallback.
//   - Registration is PER-TOOL (there is no server object / metadata).
//   - Results are plain JSON values (live-verified: NOT the MCP
//     {content:[…]} wrapper); errors have no dedicated channel, so
//     failures are returned as descriptive result objects.
//   - Re-register on every page load (no persistence across loads).
//
// =====================================================================
// WEBMCP REGISTRATION ADAPTER — window.McpServer (legacy public name)
// =====================================================================
//
// Registration
//   McpServer.registerTool(def) -> Promise<boolean>
//     def = {
//       name:         string, 1–128 chars, only [A-Za-z0-9_.-],
//       description:  string,
//       inputSchema:  optional JSON-Schema object — forwarded as-is,
//       execute:      function(input, options) -> value | Promise,
//       annotations:  optional {readOnlyHint, untrustedContentHint} —
//                     forwarded as-is,
//       timeoutMs:    optional shim-only override (positive number) of
//                     the 30000 ms execute timeout — NOT forwarded.
//     }
//     Validation is minimal (the WebMCP API enforces its own description
//     length caps): invalid def shape → ONE console.warn + resolves
//     false, never throws. WebMCP API absent → one console.warn naming
//     the tool + false. mc.registerTool() throwing synchronously OR its
//     promise rejecting → one console.warn naming the tool + false.
//     Success → the name is appended to the shim's registry (first-
//     success order; a re-registered name is never listed twice) and
//     resolves true. A failure here affects only THIS tool — other
//     tools still register (per-tool error isolation). Only the fields
//     above are forwarded: name, description, inputSchema (when
//     present), annotations (when present), and the execute WRAPPER
//     (see below); extra def fields are dropped.
//   McpServer.registerTools(defs) -> Promise<{registered, failed}>
//     Sequential registerTool() per def, order preserved. Resolves with
//     { registered: string[], failed: string[] } using each def's name
//     ('<unnamed>' when the def has no usable name string). Non-array
//     argument → one console.warn + an empty result. When the WebMCP
//     API is absent the whole batch short-circuits to ONE console.warn
//     with every def in `failed` (registerTool would otherwise warn
//     once per tool).
//
// Execute wrapping (applied to EVERY tool registered via the shim)
//   entry        → AgentUI.setState('acting')
//   success      → the inner execute's return value is resolved to the
//                  API UNTOUCHED (plain object per live-verified RQ-1),
//                  then AgentUI.setState('tools-ready')
//   inner throws → a synchronous throw OR promise rejection is CAUGHT
//                  and resolved as a structured result. Domain refusals
//                  also use structured values so corrective detail is
//                  preserved for the calling agent.
//                  as exactly:
//                    { error: true,
//                      tool: <name>,
//                      reason: String(err && err.message || err),
//                      hint: 'The tool failed internally; nothing in
//                           the app was changed.' }
//                  then AgentUI.setState('tools-ready')
//   timeout      → if the inner execute does not settle within
//                  timeoutMs (30000 default, def.timeoutMs override),
//                  resolved as:
//                    { error: true,
//                      tool: <name>,
//                      reason: 'Timed out after N ms without settling.',
//                      hint: 'The tool was abandoned after exceeding its
//                           time budget; nothing else in the app was
//                           changed.' }
//                  then AgentUI.setState('tools-ready'). The abandoned
//                  inner promise is left running; its eventual rejection
//                  is swallowed (already has a catch attached).
//   options      → the API's second execute argument (including any
//                  AbortSignal) is passed through to the inner execute
//                  UNCHANGED — well-behaved tools reject on abort and
//                  take the inner-throw path above; tools that ignore
//                  the signal are bounded by the timeout.
//   concurrency  → each wrapper sets 'acting' on entry and
//                  'tools-ready' on its OWN settle (no reference
//                  counting) — with concurrent invocations the last
//                  settle wins.
//   All AgentUI calls are guarded (AgentUI may be absent or damaged;
//                  the wrapper still resolves normally in that case).
//
// Introspection
//   McpServer.isAvailable() -> boolean — true iff the WebMCP API was
//     found. Detection is lazy (first need) and cached: document
//     .modelContext, falling back to navigator.modelContext, accepted
//     only when it exposes a registerTool function.
//   McpServer.listRegistered() -> string[] — a fresh copy of the
//     registry's names, in registration order.
//
// Lifecycle (self-init at load, DOMContentLoaded-safe)
//   Detect the API as above. Absent → silent no-op for the app plus
//     ONE console.info (the chip already reads 'unavailable' at load).
//     Present → nothing further to register: the 10 real tools self-
//     registered from src/mcp-tools.js at parse time via registerTools
//     (). Registration state is observable via listRegistered() (the
//     dev harness). src/mcp-tools.js publishes the registration promise
//     and marks AgentUI tools-ready after at least one successful tool.
// =====================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Constants — fixed by the contract block above.
  // ---------------------------------------------------------------------
  var NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
  var EXECUTE_TIMEOUT_MS = 30000;

  // ---------------------------------------------------------------------
  // Module state.
  //
  // `modelContext` caches the detected WebMCP entry point (null when
  // absent); `detected` makes detection run at most once, lazily, so
  // registerTool() works even when called before init() fires (e.g. a
  // later <script> at parse time, which is how MC-2 will plug in).
  // `registeredNames` is the shim's own registry, in first-success
  // order.
  // ---------------------------------------------------------------------
  var modelContext = null;
  var detected = false;
  var registeredNames = [];

  /**
   * Detect (once) and return the WebMCP ModelContext, or null when the
   * API is absent, disabled, or fails to expose registerTool.
   *
   * @returns {Object|null}
   */
  function detectModelContext() {
    if (detected) {
      return modelContext;
    }
    detected = true;
    try {
      modelContext = document.modelContext || navigator.modelContext || null;
    } catch (err) {
      modelContext = null;
    }
    if (!modelContext || typeof modelContext.registerTool !== 'function') {
      modelContext = null;
    }
    return modelContext;
  }

  /**
   * AgentUI-aware state transition; safe when AgentUI is absent,
   * damaged, or lacks setState. Never lets UI failure affect the tool
   * result — a throwing setState() is caught and swallowed (the chip is
   * decoration; the tool's outcome is the contract).
   *
   * @param {string} state - 'unavailable' | 'tools-ready' | 'acting'.
   */
  function setStateSafe(state) {
    if (window.AgentUI && typeof window.AgentUI.setState === 'function') {
      try {
        window.AgentUI.setState(state);
      } catch (err) {
        // Swallowed by design — see the contract block's AgentUI guard.
      }
    }
  }

  // ---------------------------------------------------------------------
  // Validation + result shaping.
  // ---------------------------------------------------------------------

  /**
   * Minimal def validation per the contract block. Checks only what the
   * shim itself needs; the WebMCP API enforces its own description
   * length caps.
   *
   * @param {*} def
   * @returns {string|null} a human-readable problem, or null when valid.
   */
  function validationProblem(def) {
    if (!def || typeof def !== 'object') {
      return 'expected a tool definition object';
    }
    if (typeof def.name !== 'string' || !NAME_PATTERN.test(def.name)) {
      return 'name must be a 1-128 char string of [A-Za-z0-9_.-]';
    }
    if (typeof def.description !== 'string') {
      return 'description must be a string';
    }
    if (typeof def.execute !== 'function') {
      return 'execute must be a function';
    }
    return null;
  }

  /**
   * Registry/list label for a def: its name when there is one, else a
   * visible placeholder so `failed` entries always make sense.
   *
   * @param {*} def
   * @returns {string}
   */
  function defLabel(def) {
    if (def && typeof def === 'object' && typeof def.name === 'string' && def.name.length > 0) {
      return def.name;
    }
    return '<unnamed>';
  }

  /**
   * Error-as-result object for a caught inner failure (exact shape from
   * the contract block — the API has no error channel, so the failure
   * travels as descriptive result text per RQ-1).
   *
   * @param {string} name - the tool's registered name.
   * @param {*} err - whatever the inner execute threw/rejected with.
   * @returns {Object}
   */
  function errorResult(name, err) {
    return {
      error: true,
      tool: name,
      reason: String(err && err.message || err),
      hint: 'The tool failed internally; nothing in the app was changed.'
    };
  }

  /**
   * Error-as-result object for an execute that never settled inside its
   * time budget.
   *
   * @param {string} name - the tool's registered name.
   * @param {number} timeoutMs - the budget that was exceeded.
   * @returns {Object}
   */
  function timeoutResult(name, timeoutMs) {
    return {
      error: true,
      tool: name,
      reason: 'Timed out after ' + timeoutMs + ' ms without settling.',
      hint: 'The tool was abandoned after exceeding its time budget; nothing else in the app was changed.'
    };
  }

  // ---------------------------------------------------------------------
  // Execute wrapping — the core hardening (see contract block).
  // ---------------------------------------------------------------------

  /**
   * Build the execute function the WebMCP API receives for `def`. The
   * wrapper owns the FEW-1 lifecycle ('acting' on entry, 'tools-ready'
   * on its own settle), the timeout guard, and rejection capture; on
   * success the inner value passes through untouched.
   *
   * @param {Object} def - an already-validated tool definition.
   * @returns {Function} execute(input, options) -> Promise.
   */
  function wrapExecute(def) {
    var inner = def.execute;
    var name = def.name;
    var timeoutMs =
      typeof def.timeoutMs === 'number' && def.timeoutMs > 0
        ? def.timeoutMs
        : EXECUTE_TIMEOUT_MS;

    return function (input, options) {
      setStateSafe('acting');

      return new Promise(function (resolve) {
        var settled = false;
        var timerId = window.setTimeout(function () {
          if (settled) {
            return;
          }
          settled = true;
          finishWith(timeoutResult(name, timeoutMs));
        }, timeoutMs);

        // Single settle path: clears the guard timer, restores
        // 'tools-ready', and resolves the API-facing promise.
        function finishWith(value) {
          window.clearTimeout(timerId);
          setStateSafe('tools-ready');
          resolve(value);
        }

        // Promise.resolve().then() funnels a synchronous inner throw
        // into the same rejection path as a rejected promise. The catch
        // stays attached even after a timeout settle, so an abandoned
        // inner rejection is swallowed instead of surfacing as an
        // unhandled rejection.
        Promise.resolve()
          .then(function () {
            return inner(input, options);
          })
          .then(function (result) {
            if (settled) {
              return;
            }
            settled = true;
            finishWith(result);
          })
          .catch(function (err) {
            if (settled) {
              return;
            }
            settled = true;
            finishWith(errorResult(name, err));
          });
      });
    };
  }

  /**
   * Project a validated def onto the ModelContextTool object handed to
   * the API: known fields only, execute replaced by wrapExecute()'s
   * wrapper. Extra def fields (e.g. the shim-only timeoutMs) are
   * deliberately dropped.
   *
   * @param {Object} def - an already-validated tool definition.
   * @returns {Object} the ModelContextTool for mc.registerTool().
   */
  function toModelContextTool(def) {
    var tool = {
      name: def.name,
      description: def.description,
      execute: wrapExecute(def)
    };
    if (def.inputSchema) {
      tool.inputSchema = def.inputSchema;
    }
    if (def.annotations) {
      tool.annotations = def.annotations;
    }
    return tool;
  }

  // ---------------------------------------------------------------------
  // Registration API.
  // ---------------------------------------------------------------------

  /**
   * Register exactly one tool through the WebMCP API. Never rejects and
   * never throws: every failure path resolves false after exactly one
   * console diagnostic (per-tool error isolation).
   *
   * @param {*} def - see the contract block for the shape.
   * @returns {Promise<boolean>} true iff the API accepted the tool.
   */
  function registerTool(def) {
    return new Promise(function (resolve) {
      var problem = validationProblem(def);
      if (problem) {
        console.warn(
          '[mcp-server] registerTool: invalid tool definition — ' + problem + '. Not registered.',
          def
        );
        resolve(false);
        return;
      }

      var mc = detectModelContext();
      if (!mc) {
        console.warn(
          "[mcp-server] registerTool: WebMCP API not available — tool '" + def.name + "' not registered."
        );
        resolve(false);
        return;
      }

      var apiPromise;
      try {
        apiPromise = mc.registerTool(toModelContextTool(def));
      } catch (err) {
        console.warn(
          "[mcp-server] registration failed for tool '" + def.name + "': " +
            (err && err.message ? err.message : err)
        );
        resolve(false);
        return;
      }

      apiPromise.then(
        function () {
          if (registeredNames.indexOf(def.name) === -1) {
            registeredNames.push(def.name);
          }
          resolve(true);
        },
        function (err) {
          console.warn(
            "[mcp-server] registration failed for tool '" + def.name + "': " +
              (err && err.message ? err.message : err)
          );
          resolve(false);
        }
      );
    });
  }

  /**
   * Register an ordered batch of tools sequentially. Each def's outcome
   * is collected; one def failing never stops the rest (order in both
   * arrays matches the input order among their members).
   *
   * @param {Array} defs
   * @returns {Promise<{registered: string[], failed: string[]}>}
   */
  function registerTools(defs) {
    if (!Array.isArray(defs)) {
      console.warn('[mcp-server] registerTools: expected an array of tool definitions — nothing registered.');
      return Promise.resolve({ registered: [], failed: [] });
    }

    // One diagnostic for the whole absent-API batch, not one per tool.
    if (!detectModelContext()) {
      console.warn(
        '[mcp-server] registerTools: WebMCP API not available — ' + defs.length + ' tool(s) not registered.'
      );
      return Promise.resolve({ registered: [], failed: defs.map(defLabel) });
    }

    var results = { registered: [], failed: [] };
    var queue = Promise.resolve();
    defs.forEach(function (def) {
      queue = queue.then(function () {
        return registerTool(def).then(function (ok) {
          if (ok) {
            results.registered.push(defLabel(def));
          } else {
            results.failed.push(defLabel(def));
          }
        });
      });
    });
    return queue.then(function () {
      return results;
    });
  }

  /**
   * @returns {boolean} true iff the WebMCP API was detected (lazily,
   *   cached — see the contract block).
   */
  function isAvailable() {
    return detectModelContext() !== null;
  }

  /**
   * @returns {string[]} a fresh copy of the registered tool names, in
   *   registration order.
   */
  function listRegistered() {
    return registeredNames.slice();
  }

  // ---------------------------------------------------------------------
  // Lifecycle.
  // ---------------------------------------------------------------------

  /**
   * Feature-detect WebMCP. Absent → silent no-op for the app (the chip
   * already reads 'unavailable' at load) plus one console diagnostic.
   * Present → nothing to register: the 8 real tools already self-
   * registered from src/mcp-tools.js at parse time, through this
   * module's own public registerTools() API (the MC-0 connectivity
   * canary this used to register was removed at MC-3, per the header's
   * instruction — nothing else in this file referenced it).
   */
  function init() {
    if (!detectModelContext()) {
      console.info(
        '[mcp-server] WebMCP API not available in this browser — ' +
          'agent control disabled (this is expected without ' +
          'chrome://flags/#enable-webmcp-testing).'
      );
      return;
    }

    // Real tools only (src/mcp-tools.js self-registration, already done
    // at parse time). The MC-6 harness reads listRegistered() to see
    // them; the load-time AgentUI 'tools-ready' signal is a known gap
    // noted in the contract block above, landing with MC-4.
  }

  window.McpServer = {
    registerTool: registerTool,
    registerTools: registerTools,
    isAvailable: isAvailable,
    listRegistered: listRegistered
  };

  // DOMContentLoaded-safe self-init: init() runs on every load (the API
  // persists nothing across loads, per RQ-1).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
