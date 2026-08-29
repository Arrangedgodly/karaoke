// Agent-feedback event contract + DOM skeletons for the Node-Based Web
// Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends on
// nothing: every DOM component it renders is created by this file itself
// (never hardcoded in index.html), it uses no localStorage, and it is
// deliberately free of any WebMCP/registration logic.
//
// FEW-1 scope: define the SHARED EVENT CONTRACT both cycle-2 tracks code
// against — the MCP lane (src/mcp-server.js, MC-1+) drives it with real
// lifecycle/mutation events; the visual lane (VIS-2/VIS-6) themes the
// skeletons rendered here. The block below is the authoritative version
// of that contract: if the implementation and this block ever disagree,
// both are wrong and both must be fixed together.
//
// =====================================================================
// FEW-1 CONTRACT — window.AgentUI (AUTHORITATIVE)
// =====================================================================
//
// Lifecycle / state
//   AgentUI.setState(state)
//     `state` is exactly one of: 'unavailable' | 'tools-ready' |
//     'acting'.
//       'unavailable' — no agent tools registered. This is the state at
//                       page load (WebMCP absent or nothing registered).
//       'tools-ready' — tools registered; an agent may operate the app.
//       'acting'      — an agent execute() invocation is in flight.
//     No "connection" state exists — per RQ-1 (docs/ultron/research/
//     rq1-webmcp-api.md), the WebMCP API has no connection concept;
//     'acting' simply means a registered tool's execute() was invoked.
//     Re-setting the CURRENT state is a no-op (no event, no DOM change).
//     Any other value is ignored with one console.warn.
//   AgentUI.getState() -> the current state string.
//   Event 'agentui:state' — fired on document (CustomEvent) whenever the
//     state actually changes. detail: { state, previous, at } where `at`
//     is Date.now() at the transition.
//
// Mutation summaries
//   AgentUI.reportMutation(detail)
//     detail = {
//       source:    'agent'                    (defaulted when omitted),
//       summary:   string, REQUIRED — one-line human-readable text
//                  describing what the agent changed (or attempted),
//       nodeIds:   optional string[] — model ids of affected nodes.
//                  Carried on the event for listeners (e.g. VIS-6's
//                  pulse-on-change); NOT rendered in the toast itself,
//       clamped:   optional string[] — params clamped rather than
//                  rejected; rendered as a note in the toast,
//       rejected:  optional boolean  — true when the mutation was
//                  refused outright,
//       errorText: optional string   — why it was refused; rendered as
//                  a note in the toast when present.
//     }.
//     Renders an agent toast (see Components) FIRST, then fires event
//     'agentui:mutation' on document whose detail is the EXACT object
//     passed in (same reference, not a copy). A detail without a
//     non-empty string `summary` is ignored with one console.warn (no
//     toast, no event).
//   Toast behavior (all toasts created by reportMutation):
//     - auto-dismisses after 6 s; the timer pauses while the pointer
//       hovers the toast and resumes on mouseleave;
//     - at most 3 toasts stack — when a 4th arrives the OLDEST is
//       removed;
//     - Escape dismisses the toast that currently contains focus
//       (the toast div or anything inside it, e.g. the Undo button).
//
// Undo stack
//   AgentUI.pushUndo(entry)
//     entry = { label: string, restore: function() }. The stack is
//     capped at 20 entries (oldest dropped when the cap is exceeded).
//     Returns true when pushed; a malformed entry (label must be a
//     non-empty string, restore must be a function) is ignored with one
//     console.warn and returns false.
//   AgentUI.undo()
//     Pops the NEWEST entry, calls its restore() — a throwing restore()
//     is caught and logged, never propagated to the caller — fires
//     event 'agentui:undo' on document with detail
//     { label, remaining } (remaining = stack depth after the pop), and
//     marks the most recent toast undone (its Undo button removed, an
//     "Undone — <label>" note appended). Returns the popped entry, or
//     null when the stack was empty (no event fired in that case).
//   AgentUI.canUndo() -> boolean (stack non-empty).
//   AgentUI.clearUndo() — empties the stack. No event is fired.
//   Undo affordances: a real "Undo" <button> on the MOST RECENT toast —
//     present exactly while the undo stack is non-empty, so pushUndo()
//     before OR after reportMutation() both yield the button (button
//     visibility re-syncs on every push/clear/undo); only the newest
//     not-yet-undone toast ever carries one — and the Ctrl/Cmd+Z
//     shortcut, active ONLY while at least one agent toast is present.
//     Keyboard coexistence guarantee: src/main.js owns the global
//     spacebar bypass shortcut; this module's document-level keydown
//     handler only inspects z/Z with Ctrl or Cmd held (Shift/Alt
//     variants such as Cmd+Shift+Z pass through untouched), skips form
//     controls and editable targets exactly like main.js's spacebar
//     guard, and calls preventDefault() only when it actually performs
//     an undo. Space is never intercepted, so the bypass shortcut's
//     behavior is bit-for-bit unchanged.
//
// Components (created dynamically by this module — NEVER in index.html)
//   #agent-chip.agent-chip[data-state]
//     Inserted into the .topbar, immediately before
//     #bypass-toggle-button when that button exists, else appended as
//     the topbar's last child. Shows short text per state
//     ('AGENT —' / 'AGENT READY' / 'AGENT ACTING') plus an .sr-only
//     explanation (reusing the .sr-only class styles/main.css already
//     defines) for assistive tech. If no .topbar exists the chip is
//     skipped; toasts and events remain fully functional.
//   #agent-toast-region.agent-toast-region
//     Appended as the LAST child of <body>. Each toast inside is a
//     div.agent-toast with role="status" aria-live="polite", containing
//     a .agent-toast-summary, optional .agent-toast-clamped /
//     .agent-toast-error / .agent-toast-undone notes, and (per the undo
//     rules above) a keyboard-reachable <button> labeled 'Undo'.
//
// Initialization
//   AgentUI.init() — idempotent; builds the components and attaches the
//     keyboard listener. The module also self-initializes at load inside
//     a try/catch: any internal failure logs exactly one console
//     diagnostic and leaves the module a no-op, so agent feedback can
//     never break the host app. Components are additionally created
//     lazily on first use if init() has not (or failed to) run.
// =====================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Constants — every value here is fixed by the contract block above.
  // ---------------------------------------------------------------------
  var VALID_STATES = ['unavailable', 'tools-ready', 'acting'];
  var STATE_EVENT = 'agentui:state';
  var MUTATION_EVENT = 'agentui:mutation';
  var UNDO_EVENT = 'agentui:undo';

  var TOAST_LIFETIME_MS = 6000;
  var TOAST_MAX = 3;
  var UNDO_CAP = 20;

  // Per-state chip copy: `label` is the short visible text (fixed by the
  // contract), `sr` the .sr-only explanation for assistive tech.
  var CHIP_COPY = {
    'unavailable': {
      label: 'AGENT —',
      sr: 'Agent control unavailable: no agent tools are registered, so no agent can drive this app.',
    },
    'tools-ready': {
      label: 'AGENT READY',
      sr: 'Agent control ready: agent tools are registered and an agent may operate the audio chain.',
    },
    'acting': {
      label: 'AGENT ACTING',
      sr: 'An agent action is in progress and may change the audio chain.',
    },
  };

  // Module state. `currentState` starts at 'unavailable' per the contract
  // (page load = nothing registered), matching RQ-1's finding that no
  // connection concept exists to be "open" before registration.
  var chipEl = null;
  var chipLabelEl = null;
  var chipSrEl = null;
  var toastRegionEl = null;
  var currentState = 'unavailable';
  var initialized = false;
  var undoStack = [];

  /**
   * Fire a CustomEvent on document with the given detail object.
   *
   * @param {string} eventName
   * @param {Object} detail - passed through as the event's .detail
   *   (same reference, never copied — see the contract block).
   */
  function emit(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
  }

  /** @returns {HTMLElement[]} live toast elements, oldest first. */
  function liveToasts() {
    if (!toastRegionEl) {
      return [];
    }
    return Array.prototype.slice.call(toastRegionEl.children);
  }

  // ---------------------------------------------------------------------
  // Chip (lifecycle display).
  // ---------------------------------------------------------------------

  /**
   * Create #agent-chip in the .topbar (before #bypass-toggle-button when
   * present, else appended) if it doesn't exist yet. Idempotent.
   *
   * @returns {HTMLElement|null} the chip element, or null when no
   *   .topbar exists to host it (chip skipped; rest of the module stays
   *   functional — see the contract block).
   */
  function ensureChip() {
    if (chipEl) {
      return chipEl;
    }

    var topbarEl = document.querySelector('.topbar');
    if (!topbarEl) {
      return null;
    }

    chipEl = document.createElement('div');
    chipEl.id = 'agent-chip';
    chipEl.className = 'agent-chip';

    chipLabelEl = document.createElement('span');
    chipLabelEl.className = 'agent-chip-label';
    chipSrEl = document.createElement('span');
    chipSrEl.className = 'sr-only';
    chipEl.appendChild(chipLabelEl);
    chipEl.appendChild(chipSrEl);

    var bypassButton = document.getElementById('bypass-toggle-button');
    if (bypassButton && bypassButton.parentNode === topbarEl) {
      topbarEl.insertBefore(chipEl, bypassButton);
    } else {
      topbarEl.appendChild(chipEl);
    }

    renderChip();
    return chipEl;
  }

  /**
   * Sync the chip's data-state attribute, visible short label, and
   * sr-only explanation with `currentState`. Safe to call before the
   * chip exists (creates it lazily) and when it never can be created.
   */
  function renderChip() {
    if (!chipEl) {
      ensureChip();
    }
    if (!chipEl) {
      return;
    }
    var copy = CHIP_COPY[currentState];
    chipEl.setAttribute('data-state', currentState);
    chipLabelEl.textContent = copy.label;
    chipSrEl.textContent = copy.sr;
  }

  // ---------------------------------------------------------------------
  // Toast region + toasts (mutation summaries).
  // ---------------------------------------------------------------------

  /**
   * Create #agent-toast-region as the last child of <body> if it doesn't
   * exist yet. Idempotent.
   *
   * @returns {HTMLElement|null} the region element, or null when no
   *   <body> exists (not reachable with this file loaded from
   *   index.html's end-of-body script position).
   */
  function ensureToastRegion() {
    if (toastRegionEl || !document.body) {
      return toastRegionEl;
    }
    toastRegionEl = document.createElement('div');
    toastRegionEl.id = 'agent-toast-region';
    toastRegionEl.className = 'agent-toast-region';
    toastRegionEl.setAttribute('role', 'region');
    toastRegionEl.setAttribute('aria-label', 'Agent activity notifications');
    document.body.appendChild(toastRegionEl);
    return toastRegionEl;
  }

  /**
   * Build one agent toast from the render-relevant parts of a
   * reportMutation() detail and append it to the region, enforcing the
   * 3-toast cap (oldest removed). Timer behavior per the contract:
   * 6 s auto-dismiss, paused while hovered; Escape (handled below)
   * dismisses immediately when the toast contains focus.
   *
   * @param {{summary: string, clamped?: string[], errorText?: string}} detail
   * @returns {HTMLElement} the toast element.
   */
  function createToast(detail) {
    var toastEl = document.createElement('div');
    toastEl.className = 'agent-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');

    var summaryEl = document.createElement('div');
    summaryEl.className = 'agent-toast-summary';
    summaryEl.textContent = detail.summary;
    toastEl.appendChild(summaryEl);

    if (detail.clamped && detail.clamped.length > 0) {
      var clampedEl = document.createElement('div');
      clampedEl.className = 'agent-toast-clamped';
      clampedEl.textContent = 'Clamped: ' + detail.clamped.join(', ');
      toastEl.appendChild(clampedEl);
    }

    if (detail.errorText) {
      var errorEl = document.createElement('div');
      errorEl.className = 'agent-toast-error';
      errorEl.textContent = detail.errorText;
      toastEl.appendChild(errorEl);
    }

    // 6 s auto-dismiss with hover-pause. `dismissAt` tracks when the
    // timer would have fired so a mouseenter -> mouseleave cycle can
    // resume with exactly the time that was left, never a fresh 6 s.
    var dismissAt = Date.now() + TOAST_LIFETIME_MS;
    var remainingMs = TOAST_LIFETIME_MS;
    var timeoutId = window.setTimeout(dismiss, TOAST_LIFETIME_MS);

    function dismiss() {
      window.clearTimeout(timeoutId);
      toastEl.remove();
    }

    toastEl.addEventListener('mouseenter', function () {
      window.clearTimeout(timeoutId);
      remainingMs = Math.max(0, dismissAt - Date.now());
    });

    toastEl.addEventListener('mouseleave', function () {
      window.clearTimeout(timeoutId);
      dismissAt = Date.now() + remainingMs;
      timeoutId = window.setTimeout(dismiss, remainingMs);
    });

    // Escape dismisses the FOCUSED toast — this handler lives on the
    // toast itself, so it only runs for keydowns on the toast or
    // something inside it (e.g. the Undo button). stopPropagation keeps
    // the document-level handler from also seeing an Escape it doesn't
    // consume anyway.
    toastEl.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismiss();
      }
    });

    toastRegionEl.appendChild(toastEl);

    // Cap the stack at 3 — the oldest toast is removed to make room.
    while (toastRegionEl.children.length > TOAST_MAX) {
      toastRegionEl.removeChild(toastRegionEl.firstChild);
    }

    refreshUndoButtons();
    return toastEl;
  }

  /**
   * Contract: render the toast first, THEN fire the mutation event with
   * the caller's exact detail object.
   *
   * @param {Object} detail - see the contract block for the shape.
   */
  function reportMutation(detail) {
    if (!detail || typeof detail.summary !== 'string' || detail.summary.length === 0) {
      console.warn(
        'AgentUI.reportMutation: expected a detail object with a non-empty string `summary` — ignored.',
        detail
      );
      return;
    }

    ensureToastRegion();
    if (toastRegionEl) {
      // The toast only renders a subset of the detail; build that subset
      // here so the rendering path can never mutate the caller's object.
      var renderDetail = { summary: detail.summary };
      if (Array.isArray(detail.clamped)) {
        renderDetail.clamped = detail.clamped.slice();
      }
      if (typeof detail.errorText === 'string' && detail.errorText.length > 0) {
        renderDetail.errorText = detail.errorText;
      }
      createToast(renderDetail);
    }

    emit(MUTATION_EVENT, detail);
  }

  // ---------------------------------------------------------------------
  // Undo stack.
  // ---------------------------------------------------------------------

  /**
   * Push an undo entry; the stack is capped at 20 (oldest dropped).
   * Re-syncs the toast Undo buttons so the button appears on the most
   * recent toast whether this call came before or after its
   * reportMutation().
   *
   * @param {{label: string, restore: Function}} entry
   * @returns {boolean} true when pushed, false when malformed/ignored.
   */
  function pushUndo(entry) {
    if (
      !entry ||
      typeof entry.label !== 'string' ||
      entry.label.length === 0 ||
      typeof entry.restore !== 'function'
    ) {
      console.warn(
        'AgentUI.pushUndo: expected { label: non-empty string, restore: function } — ignored.',
        entry
      );
      return false;
    }

    undoStack.push({ label: entry.label, restore: entry.restore });
    if (undoStack.length > UNDO_CAP) {
      undoStack.shift();
    }

    refreshUndoButtons();
    return true;
  }

  /**
   * Pop the newest undo entry and run its restore(). Errors thrown by
   * restore() are caught and logged — the entry stays popped and the
   * error never reaches the caller, so a bad restore can't take the app
   * down with it.
   *
   * @returns {Object|null} the popped entry, or null when empty.
   */
  function undo() {
    if (undoStack.length === 0) {
      return null;
    }

    var entry = undoStack.pop();
    try {
      entry.restore();
    } catch (err) {
      console.error(
        'AgentUI.undo: restore() threw for "' + entry.label + '" — entry stays popped; error not propagated.',
        err
      );
    }

    markMostRecentToastUndone(entry.label);
    emit(UNDO_EVENT, { label: entry.label, remaining: undoStack.length });
    return entry;
  }

  /** @returns {boolean} true while the undo stack is non-empty. */
  function canUndo() {
    return undoStack.length > 0;
  }

  /** Empty the undo stack. No event fires for this (see contract). */
  function clearUndo() {
    undoStack = [];
    refreshUndoButtons();
  }

  /**
   * Mark the most recent toast as undone: remove its Undo button, set
   * data-undone="true" (so a second undo() with this toast still newest
   * doesn't double-annotate), and append an "Undone — <label>" note.
   * The toast's role="status" aria-live="polite" announces the change.
   *
   * @param {string} label - the undone entry's label.
   */
  function markMostRecentToastUndone(label) {
    var toasts = liveToasts();
    if (toasts.length === 0) {
      return;
    }

    var toastEl = toasts[toasts.length - 1];
    if (toastEl.getAttribute('data-undone') === 'true') {
      return;
    }

    var undoBtn = toastEl.querySelector('.agent-toast-undo');
    if (undoBtn) {
      undoBtn.remove();
    }
    toastEl.setAttribute('data-undone', 'true');

    var noteEl = document.createElement('div');
    noteEl.className = 'agent-toast-undone';
    noteEl.textContent = 'Undone — ' + label;
    toastEl.appendChild(noteEl);
  }

  /**
   * Build the toast Undo button. A real, keyboard-reachable <button>
   * (contract): it also carries .control so it inherits the app's
   * standard button styling until VIS-6 themes it properly.
   *
   * @returns {HTMLButtonElement}
   */
  function createUndoButton() {
    var undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'control agent-toast-undo';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('click', function () {
      undo();
    });
    return undoBtn;
  }

  /**
   * Re-sync Undo buttons across all live toasts to the contract
   * invariant: exactly ONE button, on the NEWEST not-yet-undone toast,
   * and only while the undo stack is non-empty. Called from every place
   * the invariant's inputs change (reportMutation, pushUndo, undo,
   * clearUndo).
   */
  function refreshUndoButtons() {
    var toasts = liveToasts();

    var targetIndex = -1;
    for (var i = toasts.length - 1; i >= 0; i--) {
      if (toasts[i].getAttribute('data-undone') !== 'true') {
        targetIndex = i;
        break;
      }
    }

    toasts.forEach(function (toastEl, index) {
      var undoBtn = toastEl.querySelector('.agent-toast-undo');
      var shouldHave = index === targetIndex && undoStack.length > 0;
      if (shouldHave && !undoBtn) {
        toastEl.appendChild(createUndoButton());
      } else if (!shouldHave && undoBtn) {
        undoBtn.remove();
      }
    });
  }

  // ---------------------------------------------------------------------
  // Keyboard.
  // ---------------------------------------------------------------------

  /**
   * Document-level Ctrl/Cmd+Z handler — the ONLY global key this module
   * consumes. Coexistence with src/main.js's spacebar bypass shortcut is
   * structural, not incidental: main.js's handler tests only
   * event.code === 'Space' || event.key === ' ', this one only
   * (ctrlKey || metaKey) && key z/Z, so neither can ever consume the
   * other's key. Guards, mirroring main.js's own form-control guard:
   *   - Shift/Alt combos (e.g. Cmd+Shift+Z redo) pass through untouched;
   *   - active only while at least one agent toast is present;
   *   - skipped while focus is in a form control or editable target,
   *     where Ctrl+Z is native undo;
   *   - preventDefault() only when an undo is actually performed — with
   *     an empty stack the key keeps its native meaning.
   *
   * @param {KeyboardEvent} event
   */
  function onGlobalKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
      return;
    }
    if (event.key !== 'z' && event.key !== 'Z') {
      return;
    }

    if (!toastRegionEl || toastRegionEl.children.length === 0) {
      return;
    }

    var active = document.activeElement;
    var activeTag = active && active.tagName;
    if (
      activeTag === 'SELECT' ||
      activeTag === 'INPUT' ||
      activeTag === 'TEXTAREA' ||
      (active && active.isContentEditable)
    ) {
      return;
    }

    if (undoStack.length === 0) {
      return;
    }

    event.preventDefault();
    undo();
  }

  // ---------------------------------------------------------------------
  // Lifecycle + init.
  // ---------------------------------------------------------------------

  /**
   * @param {string} nextState - 'unavailable' | 'tools-ready' | 'acting'.
   */
  function setState(nextState) {
    if (VALID_STATES.indexOf(nextState) === -1) {
      console.warn(
        'AgentUI.setState: unknown state "' + nextState + '" — expected one of ' +
          VALID_STATES.join(', ') + '. Ignored.'
      );
      return;
    }
    if (nextState === currentState) {
      return;
    }

    var previous = currentState;
    currentState = nextState;
    renderChip();
    emit(STATE_EVENT, { state: currentState, previous: previous, at: Date.now() });
  }

  /** @returns {string} the current state. */
  function getState() {
    return currentState;
  }

  /**
   * Build the DOM components and attach the keyboard listener.
   * Idempotent — safe to call any number of times.
   */
  function init() {
    if (initialized) {
      return;
    }
    ensureChip();
    ensureToastRegion();
    document.addEventListener('keydown', onGlobalKeydown);
    initialized = true;
  }

  window.AgentUI = {
    init: init,
    setState: setState,
    getState: getState,
    reportMutation: reportMutation,
    pushUndo: pushUndo,
    undo: undo,
    canUndo: canUndo,
    clearUndo: clearUndo,
  };

  // Self-initialize at load. Any internal failure logs exactly one
  // console diagnostic and leaves the module a no-op — FEW-1's hard
  // guarantee that agent feedback can never break the host app.
  try {
    init();
  } catch (err) {
    console.error(
      'AgentUI: initialization failed — agent feedback disabled; the rest of the app is unaffected.',
      err
    );
  }
})();
