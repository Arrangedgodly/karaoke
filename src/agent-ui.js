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
//     Issue #6: each pushed entry also records the CURRENT state
//     revision at push time (see noteHumanEdit below) — the revision the
//     agent mutation that owns this entry produced. Returns true when
//     pushed; a malformed entry (label must be a non-empty string,
//     restore must be a function) is ignored with one console.warn and
//     returns false.
//   AgentUI.noteHumanEdit()
//     Issue #6: bumps the module's state revision counter. Called at
//     each HUMAN mutation entry point (the param-slider input handler in
//     src/param-controls.js, the drag/remove handlers in src/canvas.js,
//     and the save/load/delete handlers in src/presets-ui.js) — never
//     from the agent write paths, which deliberately share those files'
//     primitives but not their human handlers. Agent-driven mutations
//     therefore do NOT bump the revision, so a pure-agent sequence of
//     edits keeps undoing exactly as before.
//   AgentUI.undo([confirm])
//     Calls the NEWEST entry's restore() and pops it only after restore
//     succeeds. A throwing restore is caught and logged, but the entry
//     stays on the stack for retry. The toast keeps its Undo button,
//     shows an .agent-toast-undo-failed message, and fires
//     'agentui:undo-failed' with detail
//     { label, remaining, confirmed, errorText }. A successful restore
//     marks the entry's associated toast undone (or creates a recovery
//     status if the original expired), then fires event 'agentui:undo'
//     on document with detail
//     { label, remaining, confirmed } (remaining = stack depth after
//     the pop). The toast's Undo button is removed and an
//     "Undone — <label>" note appended. Returns
//     the popped entry, or null when the stack was empty, conflicted, or
//     its restore failed.
//     Issue #6 conflict rule: when the newest entry's recorded revision
//     no longer matches the current state revision — i.e. a HUMAN edited
//     the chain or presets after the agent mutation — undo() does NOT
//     apply or pop anything. Instead it re-renders the entry's own toast
//     (or a new recovery toast if the original expired) as a confirm
//     step: a .agent-toast-conflict
//     note ("You changed the chain or presets after this. Undo
//     anyway?"), the button relabeled "Undo anyway" with
//     data-confirm-undo="true", and an 'agentui:undo-conflict' event
//     ({ label, remaining }). A second press of that same button (or
//     undo(true)) applies the restore over the human's newer state —
//     the explicit confirmation the conflict requires.
//   AgentUI.canUndo() -> boolean (stack non-empty).
//   AgentUI.clearUndo() — empties the stack. No event is fired.
//   Undo affordances: a real "Undo" <button> on the NEWEST entry's
//     associated toast — present while that entry and toast are live, so
//     pushUndo() immediately before OR after reportMutation() both yield
//     the button (visibility re-syncs on every push/clear/undo); only the
//     active entry's toast carries one — and the Ctrl/Cmd+Z
//     shortcut. Issue #6: the shortcut consults the undo STACK, not the
//     toasts, so the recovery path stays available beyond the 6 s toast
//     lifetime; it performs an undo only when the newest entry is NOT
//     conflicted (a conflicted entry needs the toast's explicit
//     "Undo anyway" confirm, so the key recreates that affordance but
//     keeps its native meaning).
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
//     .agent-toast-error / .agent-toast-conflict / .agent-toast-undone
//     / .agent-toast-undo-failed notes, and (per the undo rules above) a
//     keyboard-reachable <button> labeled 'Undo' (relabeled 'Undo
//     anyway' while a conflict confirm is pending — issue #6).
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
  var UNDO_FAILED_EVENT = 'agentui:undo-failed';
  var UNDO_CONFLICT_EVENT = 'agentui:undo-conflict';

  var TOAST_LIFETIME_MS = 6000;
  var TOAST_MAX = 3;
  var UNDO_CAP = 20;

  // Issue #6: the state revision counter. Every pushed undo entry
  // records the revision at push time (the revision the agent mutation
  // produced); every HUMAN mutation entry point bumps it via
  // noteHumanEdit(). A revision mismatch at undo time means a human
  // edited state after the agent's mutation — the restore then needs an
  // explicit confirm instead of applying silently.
  var stateRevision = 0;

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
  // A mutation normally pushes its undo entry immediately before it
  // reports the matching toast. These one-turn handoff slots preserve
  // that association while still supporting the documented reverse
  // order (report first, push immediately afterwards).
  var pendingUndoEntry = null;
  var unclaimedMutationToast = null;

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
    var toastEl = null;
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
      toastEl = createToast(renderDetail);
    }

    if (toastEl && detail.rejected !== true) {
      if (
        pendingUndoEntry &&
        undoStack.indexOf(pendingUndoEntry) !== -1
      ) {
        associateUndoEntryWithToast(pendingUndoEntry, toastEl);
        pendingUndoEntry = null;
      } else {
        // Support reportMutation() immediately before pushUndo(). Do not
        // leave an arbitrary toast claimable after the current turn.
        unclaimedMutationToast = toastEl;
        window.setTimeout(function () {
          if (unclaimedMutationToast === toastEl) {
            unclaimedMutationToast = null;
          }
        }, 0);
      }
      refreshUndoButtons();
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

    // Issue #6: record the state revision this entry was pushed against
    // (callers may pre-set entry.revision; the agent push sites push
    // synchronously right after their apply, so the current counter IS
    // the revision the mutation produced). A later human edit bumps the
    // counter past this value, which is exactly the conflict undo()
    // checks for.
    var storedEntry = {
      label: entry.label,
      restore: entry.restore,
      revision: typeof entry.revision === 'number' ? entry.revision : stateRevision,
      toastEl: null,
      hasToastAssociation: false
    };
    undoStack.push(storedEntry);
    if (undoStack.length > UNDO_CAP) {
      undoStack.shift();
    }

    if (isLiveToast(unclaimedMutationToast)) {
      associateUndoEntryWithToast(storedEntry, unclaimedMutationToast);
      unclaimedMutationToast = null;
    } else {
      pendingUndoEntry = storedEntry;
      window.setTimeout(function () {
        if (pendingUndoEntry === storedEntry) {
          pendingUndoEntry = null;
        }
      }, 0);
    }

    refreshUndoButtons();
    return true;
  }

  /**
   * Issue #6: bump the state revision — called at each HUMAN mutation
   * entry point (param slider input, canvas drag/remove, preset
   * save/load/delete). Agent write paths never call it, so a pure-agent
   * edit sequence keeps today's undo semantics while any human edit
   * afterwards marks every earlier agent undo entry stale.
   */
  function noteHumanEdit() {
    stateRevision += 1;
  }

  /**
   * True when the NEWEST entry's recorded revision no longer matches the
   * current state revision — a human edited state after the agent
   * mutation that pushed it (issue #6).
   *
   * @returns {boolean}
   */
  function newestEntryConflicted() {
    if (undoStack.length === 0) {
      return false;
    }
    var entry = undoStack[undoStack.length - 1];
    return typeof entry.revision === 'number' && entry.revision !== stateRevision;
  }

  /** @returns {HTMLElement|null} the newest toast that has not been undone. */
  function newestActiveToast() {
    var toasts = liveToasts();
    for (var i = toasts.length - 1; i >= 0; i--) {
      if (toasts[i].getAttribute('data-undone') !== 'true') {
        return toasts[i];
      }
    }
    return null;
  }

  /** @returns {boolean} whether toastEl is still attached to the live region. */
  function isLiveToast(toastEl) {
    return !!toastEl && liveToasts().indexOf(toastEl) !== -1;
  }

  /** Keep an undo entry bound to the toast that represents its mutation. */
  function associateUndoEntryWithToast(entry, toastEl) {
    if (!entry || !toastEl) {
      return;
    }
    entry.toastEl = toastEl;
    entry.hasToastAssociation = true;
  }

  /** @returns {HTMLElement|null} the entry's associated toast when still live. */
  function liveToastForEntry(entry) {
    if (
      entry &&
      entry.hasToastAssociation === true &&
      isLiveToast(entry.toastEl) &&
      entry.toastEl.getAttribute('data-undone') !== 'true'
    ) {
      return entry.toastEl;
    }
    return null;
  }

  /**
   * Find the entry's own toast, or create a new status toast when its
   * original notification expired. A never-associated legacy entry may
   * claim the current Undo-button toast; an entry whose known toast died
   * never falls through to an unrelated notification.
   */
  function ensureToastForEntry(entry, summary) {
    var toastEl = liveToastForEntry(entry);
    if (toastEl) {
      return toastEl;
    }

    if (entry && entry.hasToastAssociation !== true) {
      var candidate = newestActiveToast();
      if (candidate && candidate.querySelector('.agent-toast-undo')) {
        associateUndoEntryWithToast(entry, candidate);
        return candidate;
      }
    }

    ensureToastRegion();
    if (!toastRegionEl) {
      return null;
    }
    toastEl = createToast({ summary: summary });
    associateUndoEntryWithToast(entry, toastEl);
    refreshUndoButtons();
    return toastEl;
  }

  /**
   * Issue #6: re-render the entry's associated toast as the undo
   * conflict's confirm step — or create a recovery toast when the
   * original expired. A .agent-toast-conflict note asks the question,
   * and the toast's Undo button is relabeled "Undo anyway" with
   * data-confirm-undo="true" (the button's click handler reads that
   * attribute, so its SECOND press is the explicit confirmation).
   * Extends the toast's content only; role/aria and the Escape/dismiss
   * behavior are untouched. The toast's own status/live semantics
   * announce the conflict text.
   *
   * @returns {boolean} true when a live or recovery toast carries the
   *   conflict; false only when the document has no toast region host.
   */
  function showUndoConflict(entry) {
    var toastEl = ensureToastForEntry(
      entry,
      'Undo needs confirmation — ' + entry.label
    );
    if (!toastEl) {
      return false;
    }
    refreshUndoButtons();
    if (toastEl.getAttribute('data-conflict') !== 'true') {
      toastEl.setAttribute('data-conflict', 'true');
      var noteEl = document.createElement('div');
      noteEl.className = 'agent-toast-conflict';
      noteEl.textContent =
        'You changed the chain or presets after this. Undo anyway? ' +
        'Confirming restores what was there before "' + entry.label + '".';
      toastEl.appendChild(noteEl);
    }
    var undoBtn = toastEl.querySelector('.agent-toast-undo');
    if (undoBtn) {
      undoBtn.textContent = 'Undo anyway';
      undoBtn.setAttribute('data-confirm-undo', 'true');
      undoBtn.setAttribute(
        'aria-label',
        'Undo anyway — you made changes after this agent action; confirming replaces them'
      );
    }
    return true;
  }

  /**
   * Run the newest undo entry's restore(), then pop it only after the
   * restore succeeds. A thrown restore is caught so it cannot take down
   * the app, but it is not converted into success: the entry remains
   * available for retry, the toast reports the failure, and a distinct
   * failure event fires.
   *
   * Issue #6: when the newest entry is conflicted (a human edited state
   * after the mutation that pushed it) and `confirm` is not true,
   * NOTHING is popped or applied — the conflict is surfaced on the
   * entry's associated/recovery toast (see showUndoConflict) and
   * 'agentui:undo-conflict'
   * fires. Only an explicit confirm applies a conflicted restore.
   *
   * @param {boolean} [confirm] - true to apply past a revision conflict
   *   (the toast's second "Undo anyway" press).
   * @returns {Object|null} the popped entry, null when empty, when a
   *   conflict was surfaced, or when restore failed. Nothing is consumed
   *   in any null-return case.
   */
  function undo(confirm) {
    if (undoStack.length === 0) {
      return null;
    }

    var entry = undoStack[undoStack.length - 1];
    var conflicted =
      typeof entry.revision === 'number' && entry.revision !== stateRevision;
    if (conflicted && confirm !== true) {
      showUndoConflict(entry);
      emit(UNDO_CONFLICT_EVENT, {
        label: entry.label,
        remaining: undoStack.length
      });
      return null;
    }

    try {
      entry.restore();
    } catch (err) {
      var errorText = err && err.message ? err.message : String(err);
      console.error(
        'AgentUI.undo: restore() failed for "' + entry.label + '"; the undo entry was retained for retry.',
        err
      );
      showUndoFailure(entry, errorText);
      resetUndoConfirmation(entry);
      emit(UNDO_FAILED_EVENT, {
        label: entry.label,
        remaining: undoStack.length,
        confirmed: conflicted,
        errorText: errorText
      });
      refreshUndoButtons();
      return null;
    }

    undoStack.pop();
    markUndoEntryToastUndone(entry);
    refreshUndoButtons();
    emit(UNDO_EVENT, {
      label: entry.label,
      remaining: undoStack.length,
      confirmed: conflicted
    });
    return entry;
  }

  /** @returns {boolean} true while the undo stack is non-empty. */
  function canUndo() {
    return undoStack.length > 0;
  }

  /** Empty the undo stack. No event fires for this (see contract). */
  function clearUndo() {
    undoStack = [];
    pendingUndoEntry = null;
    refreshUndoButtons();
  }

  /**
   * Add or update the failure note on the entry's associated toast,
   * recreating a recovery toast when the original expired. The undo
   * entry and button remain available for retry.
   *
   * @param {Object} entry
   * @param {string} errorText
   */
  function showUndoFailure(entry, errorText) {
    var toastEl = ensureToastForEntry(
      entry,
      'Undo needs attention — ' + entry.label
    );
    if (!toastEl) {
      return;
    }
    var noteEl = toastEl.querySelector('.agent-toast-undo-failed');
    if (!noteEl) {
      noteEl = document.createElement('div');
      noteEl.className = 'agent-toast-error agent-toast-undo-failed';
      toastEl.appendChild(noteEl);
    }
    noteEl.textContent =
      'Undo failed — ' + entry.label + '. ' + errorText + ' Fix the problem, then retry Undo.';
  }

  /**
   * A failed confirmed restore consumes that confirmation attempt. Reset
   * the visible token so every later try against conflicted state needs
   * another explicit two-step confirmation.
   */
  function resetUndoConfirmation(entry) {
    var toastEl = liveToastForEntry(entry);
    if (!toastEl) {
      return;
    }

    if (typeof toastEl.removeAttribute === 'function') {
      toastEl.removeAttribute('data-conflict');
    } else {
      toastEl.setAttribute('data-conflict', 'false');
    }
    var conflictNote = toastEl.querySelector('.agent-toast-conflict');
    if (conflictNote) {
      conflictNote.remove();
    }

    var undoBtn = toastEl.querySelector('.agent-toast-undo');
    if (undoBtn) {
      undoBtn.textContent = 'Undo';
      if (typeof undoBtn.removeAttribute === 'function') {
        undoBtn.removeAttribute('data-confirm-undo');
        undoBtn.removeAttribute('aria-label');
      } else {
        undoBtn.setAttribute('data-confirm-undo', 'false');
        undoBtn.setAttribute('aria-label', 'Undo');
      }
    }
  }

  /**
   * Mark the entry's associated toast as undone: remove its Undo button,
   * set data-undone="true" (so a second call cannot double-annotate),
   * and append an "Undone — <label>" note. If its original toast has
   * expired, create and mark a new completion toast instead of touching
   * an unrelated notification.
   * The toast's role="status" aria-live="polite" announces the change.
   *
   * @param {Object} entry - the successfully restored undo entry.
   */
  function markUndoEntryToastUndone(entry) {
    var toastEl = ensureToastForEntry(
      entry,
      'Undo completed — ' + entry.label
    );
    if (!toastEl) {
      return;
    }
    if (toastEl.getAttribute('data-undone') === 'true') {
      return;
    }

    var undoBtn = toastEl.querySelector('.agent-toast-undo');
    if (undoBtn) {
      undoBtn.remove();
    }
    toastEl.setAttribute('data-undone', 'true');

    // Issue #6: an applied (confirmed) undo answers the conflict
    // question — retire the question note so the toast reads coherently.
    var conflictNote = toastEl.querySelector('.agent-toast-conflict');
    if (conflictNote) {
      conflictNote.remove();
    }
    var failedNote = toastEl.querySelector('.agent-toast-undo-failed');
    if (failedNote) {
      failedNote.remove();
    }

    var noteEl = document.createElement('div');
    noteEl.className = 'agent-toast-undone';
    noteEl.textContent = 'Undone — ' + entry.label;
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
      // Issue #6: a conflicted entry's first press only surfaces the
      // conflict (undo() re-labels this same button "Undo anyway" and
      // sets data-confirm-undo) — the SECOND press is the explicit
      // confirmation.
      undo(undoBtn.getAttribute('data-confirm-undo') === 'true');
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
    if (undoStack.length > 0) {
      var newestEntry = undoStack[undoStack.length - 1];
      var associatedToast = liveToastForEntry(newestEntry);
      if (associatedToast) {
        targetIndex = toasts.indexOf(associatedToast);
      } else if (newestEntry.hasToastAssociation !== true) {
        for (var i = toasts.length - 1; i >= 0; i--) {
          if (toasts[i].getAttribute('data-undone') !== 'true') {
            targetIndex = i;
            break;
          }
        }
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
   *   - skipped while focus is in a form control or editable target,
   *     where Ctrl+Z is native undo;
   *   - preventDefault() only when an undo is actually performed — with
   *     an empty stack the key keeps its native meaning.
   *
   * Issue #6: the shortcut consults the undo STACK, not the presence of
   * a live toast — the recovery path stays available beyond the toast's
   * 6 s lifetime, with the same conflict rules as the toast button. A
   * CONFLICTED newest entry cannot be confirmed from the keyboard (the
   * confirm affordance is the toast's "Undo anyway" button), so the key
   * surfaces or recreates that button but passes through untouched.
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

    if (newestEntryConflicted()) {
      undo();
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
    // Issue #6: human-edit revision marking + conflict introspection.
    noteHumanEdit: noteHumanEdit,
    hasUndoConflict: newestEntryConflicted,
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
