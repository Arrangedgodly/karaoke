// MC-6 dev test harness (agent simulator) for the Node-Based Web Audio
// Chain Builder — docs/ultron/plan.md task MC-6.
//
// Loaded as a plain (non-module) <script>; index.html places it right
// after src/mcp-tools.js. Same IIFE + zero-export-unless-active pattern
// as the rest of this project.
//
// ACTIVATION — this module does anything at all ONLY when
// window.location.search CONTAINS the substring 'dev' (e.g.
// http://localhost:8000/?dev, ?dev=1, ?foo&dev). The gate is one cheap
// string parse: without the param there are NO elements, NO listeners,
// NO timers and NO window export — zero DOM footprint. With the param
// the panel below is built synchronously and a small window.McpHarness
// handle is exported (active mode only) so QA-2 can script the panel
// (McpHarness.run(name, args) / .close()).
//
// ROLE — pure CONSUMER:
//   - Tool defs come from ONE fresh McpTools.getDefs() call; Run invokes
//     def.execute(parsedArgs) DIRECTLY — the real validation/enforcement
//     path (MC-2..MC-5 machinery) with no WebMCP dependency. This is the
//     portfolio agent-free demo path: the harness works identically with
//     WebMCP absent. When WebMCP IS present the same 10 tools are also
//     live in the DevTools WebMCP pane; the header states which world
//     the panel itself is driving (McpServer.isAvailable()).
//   - It never registers anything with McpServer (read-only
//     isAvailable()/listRegistered() at build time only).
//   - It never touches localStorage — all harness state (prefills the
//     user edited, run counters, log lines, undo-depth estimate) is
//     in-memory; reload resets everything.
//
// Chip-state note: direct def.execute() calls bypass the shim's execute
// wrapper, which is what sets AgentUI 'acting'/'tools-ready' around
// WebMCP-driven invocations. The chip mirror therefore shows the
// registration-lifecycle state; the EVENT STREAM still records every
// agentui:mutation / agentui:undo the tools emit, which is the part
// that matters for the demo.
//
// CLOSING — the Close button (or Escape) hides the panel for THIS load
// only; there is deliberately no reopen affordance. Reload with ?dev to
// get the panel back (closing logs one console.info saying exactly
// that, and the panel foot repeats it in small print).
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // The gate. One parse of location.search; every remaining line of this
  // file is unreachable without 'dev' in it.
  // ---------------------------------------------------------------------
  var search = '';
  try {
    search = String(window.location && window.location.search ? window.location.search : '');
  } catch (err) {
    search = ''; // No location object at all (bare test context) — stay off.
  }
  if (search.indexOf('dev') === -1) {
    return;
  }

  // ---------------------------------------------------------------------
  // Constants (fixed by the MC-6 task text).
  // ---------------------------------------------------------------------
  var STATE_EVENT = 'agentui:state';
  var MUTATION_EVENT = 'agentui:mutation';
  var UNDO_EVENT = 'agentui:undo';
  var LOG_CAP = 200;
  // Mirrors AgentUI's bounded stack cap (src/agent-ui.js UNDO_CAP = 20):
  // a display clamp for the tracked depth, which is an ESTIMATE (see
  // refreshUndoBar) and could otherwise drift past the cap.
  var UNDO_CAP = 20;

  // ---------------------------------------------------------------------
  // Module state (all in-memory; reload resets).
  // ---------------------------------------------------------------------
  var panelEl = null;
  var panelOpen = false;
  var chipMirrorEl = null;
  var logEl = null;
  var undoBtnEl = null;
  var undoDepthEl = null;
  var toolStates = []; // one {def, argsEl, runBtn, resultEl, runCount} per tool
  // Undo-depth ESTIMATE: MC-5 pushes exactly one undo entry per APPLIED
  // (non-rejected) mutation and every applied mutation also fires
  // agentui:mutation, so counting those tracks pushes; agentui:undo
  // carries the authoritative remaining depth and re-syncs the estimate.
  // AgentUI exposes no depth read otherwise (canUndo() is boolean-only).
  var undoDepth = 0;

  // ---------------------------------------------------------------------
  // Small DOM helper — the agent-ui creation pattern (every element
  // created here; index.html carries only the <script> tag).
  // ---------------------------------------------------------------------

  /**
   * @param {string} tag
   * @param {string} [className]
   * @param {string} [text] - initial textContent.
   * @returns {HTMLElement}
   */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  /**
   * @param {string} s
   * @param {number} n
   * @returns {string} s truncated to n characters with an ellipsis.
   */
  function truncate(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /**
   * JSON.stringify that can never throw on odd tool results.
   *
   * @param {*} value
   * @returns {string}
   */
  function pretty(value) {
    try {
      var s = JSON.stringify(value, null, 2);
      return typeof s === 'string' ? s : String(value);
    } catch (err) {
      return String(value);
    }
  }

  /**
   * @returns {string} HH:MM:SS for the event-stream timestamp.
   */
  function nowStamp() {
    var d = new Date();
    function p2(n) {
      return (n < 10 ? '0' : '') + n;
    }
    return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }

  // ---------------------------------------------------------------------
  // Prefill examples — derived from each tool's inputSchema plus the
  // domain semantics the defs encode (agent ranges, starter chains).
  // Every example is a VALID invocation shape: values sit inside the
  // published agent ranges (see AGENT_PARAM_POLICY in src/mcp-tools.js),
  // the set_chain example ends with the required terminal limiter and
  // stays inside the +12 dB budget (1 dB gain + 0.57 * |-6| limiter
  // makeup = 4.42 dB), and the nodeId placeholders become real ids
  // whenever a live model already has nodes (firstNodeIdHint below).
  // ---------------------------------------------------------------------

  /**
   * The live chain's first node id when one exists — the honest
   * prefill for set_param/remove_node, which address nodes by id.
   * Falls back to a visible placeholder that still parses as JSON and
   * demos the structured NODE_NOT_FOUND error path when run as-is.
   *
   * @returns {string}
   */
  function firstNodeIdHint() {
    try {
      if (window.ChainCanvas && typeof window.ChainCanvas.getCurrentModel === 'function') {
        var model = window.ChainCanvas.getCurrentModel();
        if (Array.isArray(model) && model.length > 0 && model[0] &&
            typeof model[0].id === 'string' && model[0].id.length > 0) {
          return model[0].id;
        }
      }
    } catch (err) {
      // Read-only probe; fall through to the placeholder.
    }
    return '<first node id — see get_chain>';
  }

  /** Known-semantics prefills, keyed by tool name. */
  var EXAMPLE_ARGS = {
    get_capabilities: function () {
      return {};
    },
    get_chain: function () {
      return {};
    },
    set_chain: function () {
      return {
        chain: {
          schemaVersion: 1,
          name: 'Agent demo chain',
          nodes: [
            { id: 'n1', type: 'gain', params: { gainDb: 1 } },
            { id: 'n2', type: 'eq', params: { lowGain: -2, midGain: 1, highGain: 3 } },
            { id: 'n3', type: 'limiter', params: { ceiling: -6, release: 120 } }
          ]
        }
      };
    },
    add_node: function () {
      return { type: 'limiter', position: 0 };
    },
    remove_node: function () {
      return { nodeId: firstNodeIdHint() };
    },
    set_param: function () {
      return { nodeId: firstNodeIdHint(), param: 'mix', value: 30 };
    },
    list_presets: function () {
      return {};
    },
    // Issue #12: the preset-retrieval pair. Both examples name a shipped
    // factory preset, so they are valid invocation shapes out of the box
    // (get_preset returns its nodes; load_preset applies it through the
    // full policy + UI path with a summary toast and Undo).
    get_preset: function () {
      return { name: 'Warm Ballad' };
    },
    load_preset: function () {
      return { name: 'Warm Ballad' };
    },
    save_preset: function () {
      return { name: 'Agent harness demo' };
    }
  };

  /**
   * Schema-derived default args, for any tool this table does not know
   * (future defs): one neutral value per declared property.
   *
   * @param {Object} def
   * @returns {Object}
   */
  function argsFromSchema(def) {
    var out = {};
    var props = (def.inputSchema && def.inputSchema.properties) || {};
    Object.keys(props).forEach(function (key) {
      var prop = props[key] || {};
      if (Array.isArray(prop.enum) && prop.enum.length > 0) {
        out[key] = prop.enum[0];
      } else if (prop.type === 'number' || prop.type === 'integer') {
        out[key] = typeof prop.minimum === 'number' ? prop.minimum : 0;
      } else if (prop.type === 'boolean') {
        out[key] = false;
      } else if (prop.type === 'array') {
        out[key] = [];
      } else {
        out[key] = {};
      }
    });
    return out;
  }

  /**
   * @param {Object} def
   * @returns {Object} the prefill args object for the tool.
   */
  function exampleArgsFor(def) {
    var builder = EXAMPLE_ARGS[def.name];
    if (typeof builder === 'function') {
      try {
        return builder();
      } catch (err) {
        // Fall through to the schema-derived shape.
      }
    }
    return argsFromSchema(def);
  }

  /**
   * Inline summary of a tool's inputSchema: one `param: type — hint`
   * line per property (hint clipped to 60 chars per the MC-6 spec),
   * `*` marking required params.
   *
   * @param {Object} def
   * @returns {string[]} one line per declared param ([] for no-arg tools).
   */
  function summarizeParams(def) {
    var schema = def.inputSchema || {};
    var props = schema.properties || {};
    var required = Array.isArray(schema.required) ? schema.required : [];
    return Object.keys(props).map(function (key) {
      var prop = props[key] || {};
      var type = prop.type || '?';
      if (Array.isArray(prop.enum) && prop.enum.length > 0) {
        type += ' enum';
      }
      var hint = typeof prop.description === 'string' ? truncate(prop.description, 60) : '';
      var star = required.indexOf(key) !== -1 ? '*' : ' ';
      return star + ' ' + key + ': ' + type + (hint ? ' — ' + hint : '');
    });
  }

  // ---------------------------------------------------------------------
  // Event stream — one line per agentui:* event on document, newest at
  // the bottom, capped at LOG_CAP lines.
  // ---------------------------------------------------------------------

  /**
   * Compact one-line rendering of an event detail per its kind.
   *
   * @param {string} kind - the event name.
   * @param {Object} [detail]
   * @returns {string}
   */
  function compactDetail(kind, detail) {
    if (!detail || typeof detail !== 'object') {
      return kind === UNDO_EVENT ? '(no detail)' : '';
    }
    if (kind === STATE_EVENT) {
      return 'state → ' + detail.state + ' (was ' + detail.previous + ')';
    }
    if (kind === MUTATION_EVENT) {
      var text = (detail.rejected ? '[rejected] ' : '') + (detail.summary || '');
      if (Array.isArray(detail.clamped) && detail.clamped.length > 0) {
        text += ' · clamped: ' + detail.clamped.join(', ');
      }
      return truncate(text, 160);
    }
    if (kind === UNDO_EVENT) {
      return '"' + detail.label + '" · ' + detail.remaining + ' left on stack';
    }
    try {
      return truncate(JSON.stringify(detail), 200);
    } catch (err) {
      return '(unserializable detail)';
    }
  }

  /**
   * Append one log line and enforce the 200-line cap.
   *
   * @param {string} kind
   * @param {Object} [detail]
   */
  function logEvent(kind, detail) {
    if (!logEl) {
      return;
    }
    var line = el('div', 'mcp-harness-log-line');
    line.setAttribute('data-kind', kind);
    line.appendChild(el('span', 'mcp-harness-log-time', nowStamp()));
    line.appendChild(el('span', 'mcp-harness-log-type', kind));
    line.appendChild(el('span', 'mcp-harness-log-detail', compactDetail(kind, detail)));
    logEl.appendChild(line);
    while (logEl.children.length > LOG_CAP) {
      logEl.removeChild(logEl.children[0]);
    }
    // Latest at bottom: keep the log scrolled to the newest line.
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---------------------------------------------------------------------
  // Undo bar. Enablement is ALWAYS AgentUI.canUndo() (authoritative);
  // the depth shown is the tracked estimate, clamped to the stack cap
  // and floored at 1 while canUndo() is true — an untracked push (a
  // direct AgentUI.pushUndo outside any observed event) still reads as
  // "at least one". No clear-stack button: an accidental mass-drop of
  // the operator's undo history is exactly the kind of accident this
  // dev panel must not invite (MC-6 spec).
  // ---------------------------------------------------------------------

  /**
   * Re-sync the undo button's disabled state, label and depth readout
   * with AgentUI. Called from every agentui:* listener and after every
   * harness Run (all the places canUndo() can flip in practice).
   */
  function refreshUndoBar() {
    if (!undoBtnEl || !undoDepthEl) {
      return;
    }
    var canUndo = false;
    try {
      canUndo = !!(
        window.AgentUI &&
        typeof window.AgentUI.canUndo === 'function' &&
        window.AgentUI.canUndo()
      );
    } catch (err) {
      canUndo = false; // Damaged AgentUI — show the honest disabled state.
    }
    var shown = undoDepth;
    if (canUndo && shown < 1) {
      shown = 1;
    }
    if (shown > UNDO_CAP) {
      shown = UNDO_CAP;
    }
    undoBtnEl.disabled = !canUndo;
    undoBtnEl.textContent = 'Undo last (' + shown + ')';
    undoDepthEl.textContent = 'stack depth: ' + shown;
  }

  // ---------------------------------------------------------------------
  // agentui:* listeners — chip mirror, event stream, undo-bar refresh.
  // ---------------------------------------------------------------------

  /**
   * @param {string} kind - event name.
   * @param {Object} [detail] - the CustomEvent detail.
   */
  function handleAgentEvent(kind, detail) {
    if (kind === STATE_EVENT) {
      var state = (detail && detail.state) || '';
      if (!state) {
        try {
          if (window.AgentUI && typeof window.AgentUI.getState === 'function') {
            state = window.AgentUI.getState();
          }
        } catch (err) {
          state = '';
        }
      }
      if (chipMirrorEl) {
        chipMirrorEl.textContent = 'chip: ' + (state || '(unknown)');
      }
    } else if (kind === MUTATION_EVENT) {
      if (!(detail && detail.rejected)) {
        undoDepth += 1; // MC-5: every applied mutation pushes exactly one entry.
      }
    } else if (kind === UNDO_EVENT) {
      if (detail && typeof detail.remaining === 'number') {
        undoDepth = detail.remaining; // Authoritative post-pop depth.
      }
    }
    logEvent(kind, detail);
    refreshUndoBar();
  }

  // ---------------------------------------------------------------------
  // Panel.
  // ---------------------------------------------------------------------

  /**
   * Hide the panel for this load. No reopen affordance — reload with
   * ?dev (stated in the console diagnostic and the panel foot).
   */
  function closePanel() {
    if (!panelOpen) {
      return;
    }
    panelOpen = false;
    if (panelEl && panelEl.style) {
      panelEl.style.display = 'none';
    }
    console.info(
      '[mcp-harness] Panel closed for this load — reload the page with ?dev to reopen it.'
    );
  }

  /**
   * Render one tool result into its <pre>. `flagged` true prefixes the
   * [error] marker line and sets the data-error styling hook (accent
   * flag per the MC-6 style spec).
   *
   * @param {Object} state - the tool's harness state.
   * @param {boolean} flagged - error-path flag.
   * @param {string} note - one-line prefix above the JSON (parse errors).
   * @param {*} result - the value to pretty-print.
   */
  function renderResult(state, flagged, note, result) {
    var pre = state.resultEl;
    pre.setAttribute('data-error', flagged ? 'true' : 'false');
    var text = flagged ? '[error] ' + note + '\n' : note ? note + '\n' : '';
    text += result === undefined ? '' : pretty(result);
    pre.textContent = text;
    if (pre.style) {
      pre.style.display = ''; // Show (initially hidden until first Run).
    }
  }

  /**
   * Run one tool: parse the args textarea (or take `argsOverride` for
   * the scripted window.McpHarness.run path), then invoke
   * def.execute(args) DIRECTLY — no shim wrapper, no WebMCP. The defs
   * layer never throws (errors travel as {error:true} results), but a
   * throw is caught and surfaced the same way so the harness itself can
   * never hang a Run in a broken state.
   *
   * @param {Object} state - the tool's harness state.
   * @param {*} [argsOverride] - skip the textarea when provided.
   * @returns {Promise<*>} the tool's result object.
   */
  function runTool(state, argsOverride) {
    var args;
    if (argsOverride !== undefined) {
      args = argsOverride;
    } else {
      try {
        args = JSON.parse(state.argsEl.value);
      } catch (err) {
        renderResult(
          state,
          true,
          'Arguments are not valid JSON: ' +
            String(err && err.message ? err.message : err) +
            ' — fix the JSON; nothing was invoked.',
          undefined
        );
        return Promise.resolve(null);
      }
    }

    state.runCount += 1;
    state.runBtn.textContent = 'Run (' + state.runCount + ')';

    return Promise.resolve()
      .then(function () {
        return state.def.execute(args);
      })
      .then(function (result) {
        renderResult(state, !!(result && result.error === true), '', result);
        refreshUndoBar(); // A successful mutation pushed undo (MC-5).
        return result;
      })
      .catch(function (err) {
        var synthetic = {
          error: true,
          tool: state.def.name,
          reason: String(err && err.message ? err.message : err),
          hint: 'execute() threw — the defs layer should never throw; this is a harness-visible fault.'
        };
        renderResult(state, true, 'execute() threw:', synthetic);
        refreshUndoBar();
        return synthetic;
      });
  }

  /**
   * Build one tool card (name + badge + description + param summary +
   * args textarea + Run + result <pre>) and return its state object.
   *
   * @param {Object} def - a fresh def from McpTools.getDefs().
   * @returns {Object} harness state for the tool.
   */
  function buildToolCard(def) {
    var card = el('article', 'mcp-harness-tool');
    card.setAttribute('data-tool', def.name);

    var head = el('div', 'mcp-harness-tool-head');
    head.appendChild(el('code', 'mcp-harness-tool-name', def.name));
    var annotations = def.annotations || {};
    if (annotations.readOnlyHint) {
      head.appendChild(el('span', 'mcp-harness-badge', 'read-only'));
    }
    card.appendChild(head);

    var desc = el('p', 'mcp-harness-tool-desc', def.description || '');
    card.appendChild(desc);

    var paramLines = summarizeParams(def);
    var params = el('div', 'mcp-harness-params');
    if (paramLines.length === 0) {
      params.appendChild(el('div', 'mcp-harness-param', '(no arguments — run as {})'));
    } else {
      paramLines.forEach(function (line) {
        params.appendChild(el('div', 'mcp-harness-param', line));
      });
    }
    card.appendChild(params);

    var argsEl = el('textarea', 'mcp-harness-args');
    argsEl.setAttribute('rows', '6');
    argsEl.setAttribute('spellcheck', 'false');
    argsEl.setAttribute('aria-label', 'JSON arguments for ' + def.name);
    argsEl.value = JSON.stringify(exampleArgsFor(def), null, 2);
    card.appendChild(argsEl);

    var runRow = el('div', 'mcp-harness-runrow');
    var runBtn = el('button', 'control mcp-harness-run', 'Run (0)');
    runBtn.type = 'button';
    var state = { def: def, argsEl: argsEl, runBtn: runBtn, resultEl: null, runCount: 0 };
    runBtn.addEventListener('click', function () {
      runTool(state);
    });
    runRow.appendChild(runBtn);
    card.appendChild(runRow);

    var resultEl = el('pre', 'mcp-harness-result');
    resultEl.setAttribute('data-error', 'false');
    resultEl.setAttribute('aria-label', 'Result of ' + def.name);
    if (resultEl.style) {
      resultEl.style.display = 'none'; // Hidden until the first Run.
    }
    state.resultEl = resultEl;
    card.appendChild(resultEl);

    return { card: card, state: state };
  }

  /**
   * Build the whole panel and attach it to <body>. Runs once, at load,
   * only when the ?dev gate passed.
   */
  function buildPanel() {
    panelEl = el('section', 'mcp-harness');
    panelEl.id = 'mcp-harness';
    panelEl.setAttribute('role', 'region');
    panelEl.setAttribute('aria-label', 'Agent harness (dev)');

    // --- Header: title, WebMCP status, chip mirror, Close. ---
    var header = el('header', 'mcp-harness-header');
    var titlebar = el('div', 'mcp-harness-titlebar');
    titlebar.appendChild(el('h2', 'mcp-harness-title', 'AGENT HARNESS (dev)'));
    var closeBtn = el('button', 'control mcp-harness-close', 'Close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close the agent harness panel');
    closeBtn.addEventListener('click', closePanel);
    titlebar.appendChild(closeBtn);
    header.appendChild(titlebar);

    var webmcpOn = false;
    var registeredCount = 0;
    try {
      webmcpOn = !!(
        window.McpServer &&
        typeof window.McpServer.isAvailable === 'function' &&
        window.McpServer.isAvailable()
      );
    } catch (err) {
      webmcpOn = false;
    }
    try {
      var registered = window.McpServer && window.McpServer.listRegistered
        ? window.McpServer.listRegistered()
        : [];
      if (Array.isArray(registered)) {
        registeredCount = registered.length;
      }
    } catch (err) {
      registeredCount = 0;
    }
    var statusText = webmcpOn
      ? 'WebMCP: on — tools also live in DevTools pane'
      : 'WebMCP: off — invoking defs directly';
    if (webmcpOn && registeredCount > 0) {
      statusText += ' · ' + registeredCount + ' registered';
    }
    header.appendChild(el('div', 'mcp-harness-statusline', statusText));

    var initialChipState = 'unavailable';
    try {
      if (window.AgentUI && typeof window.AgentUI.getState === 'function') {
        var s = window.AgentUI.getState();
        if (typeof s === 'string' && s.length > 0) {
          initialChipState = s;
        }
      }
    } catch (err) {
      // Honest default stands.
    }
    chipMirrorEl = el('div', 'mcp-harness-chipmirror', 'chip: ' + initialChipState);
    header.appendChild(chipMirrorEl);
    panelEl.appendChild(header);

    // --- Tool list: one card per def from ONE fresh getDefs() call. ---
    var toolsSection = el('section', 'mcp-harness-section');
    toolsSection.setAttribute('aria-label', 'Tools');
    var defs = [];
    try {
      if (window.McpTools && typeof window.McpTools.getDefs === 'function') {
        defs = window.McpTools.getDefs();
      }
    } catch (err) {
      defs = [];
    }
    toolsSection.appendChild(
      el(
        'h3',
        'mcp-harness-section-title',
        'TOOLS — ' + (Array.isArray(defs) ? defs.length : 0) + ' agent tools'
      )
    );
    if (!Array.isArray(defs) || defs.length === 0) {
      toolsSection.appendChild(
        el(
          'div',
          'mcp-harness-param',
          'McpTools.getDefs() returned no tools — is src/mcp-tools.js loaded before this file?'
        )
      );
    } else {
      defs.forEach(function (def) {
        var built = buildToolCard(def);
        toolStates.push(built.state);
        toolsSection.appendChild(built.card);
      });
    }
    panelEl.appendChild(toolsSection);

    // --- Event stream: scrolling mono log + Clear. ---
    var eventsSection = el('section', 'mcp-harness-section');
    eventsSection.setAttribute('aria-label', 'Event stream');
    var eventsHead = el('div', 'mcp-harness-events-head');
    eventsHead.appendChild(el('h3', 'mcp-harness-section-title', 'EVENTS — agentui:* stream'));
    var clearBtn = el('button', 'control mcp-harness-clear', 'Clear');
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', function () {
      if (!logEl) {
        return;
      }
      while (logEl.children.length > 0) {
        logEl.removeChild(logEl.children[0]);
      }
    });
    eventsHead.appendChild(clearBtn);
    eventsSection.appendChild(eventsHead);
    logEl = el('div', 'mcp-harness-log');
    logEl.setAttribute('role', 'log');
    logEl.setAttribute('aria-label', 'AgentUI event log');
    eventsSection.appendChild(logEl);
    panelEl.appendChild(eventsSection);

    // --- Undo bar (sticky foot). NO clear-stack button (MC-6 spec). ---
    var undoBar = el('footer', 'mcp-harness-undo');
    undoBtnEl = el('button', 'control mcp-harness-undo-btn', 'Undo last (0)');
    undoBtnEl.type = 'button';
    undoBtnEl.disabled = true;
    undoBtnEl.addEventListener('click', function () {
      try {
        if (window.AgentUI && typeof window.AgentUI.undo === 'function') {
          window.AgentUI.undo(); // The real path; fires agentui:undo.
        }
      } catch (err) {
        // Never let a broken undo take the panel down.
      }
      refreshUndoBar();
    });
    undoBar.appendChild(undoBtnEl);
    undoDepthEl = el('span', 'mcp-harness-undo-depth', 'stack depth: 0');
    undoBar.appendChild(undoDepthEl);
    undoBar.appendChild(
      el('span', 'mcp-harness-undo-hint', 'close hides for this load · reload ?dev to reopen')
    );
    panelEl.appendChild(undoBar);

    // Attach. document.body always exists here (index.html loads this
    // script at the end of <body>); a missing body means no DOM at all,
    // in which case there is nothing to attach to and we stay inert.
    if (document.body && typeof document.body.appendChild === 'function') {
      document.body.appendChild(panelEl);
      panelOpen = true;
    } else {
      panelEl = null;
      return;
    }

    // --- Listeners (only ever attached on the active path). ---
    [STATE_EVENT, MUTATION_EVENT, UNDO_EVENT].forEach(function (name) {
      document.addEventListener(name, function (event) {
        handleAgentEvent(name, event && event.detail);
      });
    });

    // Escape closes the panel (toast-level Escape handlers stop
    // propagation, so a focused toast's Escape stays the toast's own).
    document.addEventListener('keydown', function (event) {
      if (panelOpen && event && event.key === 'Escape') {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        closePanel();
      }
    });

    refreshUndoBar();
  }

  buildPanel();

  // Active-mode export (absent entirely without ?dev): a QA-2 hook for
  // driving the adversarial matrix through the same panel path, and the
  // close control for scripted demos. run(name, args) resolves with the
  // tool's result object after rendering it in the panel.
  window.McpHarness = {
    run: function (toolName, args) {
      for (var i = 0; i < toolStates.length; i++) {
        if (toolStates[i].def.name === toolName) {
          return runTool(toolStates[i], args);
        }
      }
      console.warn('[mcp-harness] run(): unknown tool "' + toolName + '"');
      return Promise.resolve(null);
    },
    close: closePanel
  };
})();
