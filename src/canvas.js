// Drag-and-drop chain canvas for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends on
// SortableJS (loaded via CDN in index.html, immediately before this file),
// window.NodeTypes (src/node-types.js), window.ParamControls
// (src/param-controls.js), window.AudioGraph (src/audio-graph.js), and
// window.AudioEngine (src/audio-engine.js) — all already loaded by the time
// this file runs, per index.html's script order.
//
// UI-3 scope: this is where AE-4's glitch-free rewiring engine and UI-4's
// generic parameter controls come together into a real, usable feature for
// the first time. Two connected SortableJS instances (RQ-2's committed
// research decision, forceFallback:true on both — see
// docs/ultron/research/rq2-drag-and-drop.md):
//   - A PALETTE list: one chip per type currently in NodeTypes.getAllTypes()
//     (today just "gain"; grows automatically as AE-6+ register more types
//     — never a hardcoded type list here), configured to CLONE into the
//     chain list on drop (palette itself is not reorderable/droppable-into).
//   - A CHAIN list: the real signal chain — sortable within itself, and able
//     to receive clones from the palette.
//
// Model bookkeeping (Part D of the task spec): `chainModel`/`nodesById`
// below are THIS file's own source of truth for "what nodes exist, in what
// order, with what params" — kept in sync with the DOM (via the Sortable
// callbacks) and with each node's live params (via each card's
// ParamControls onParamsChanged callback). Every STRUCTURAL change (add,
// remove, reorder) calls AudioGraph.buildGraph() with the fresh array,
// exactly once, from exactly one place each. A plain param tweak (a slider
// move on an already-placed node) never calls buildGraph() — that's UI-4's
// existing contract (AudioGraph.updateNodeParams()/NodeTypes.applyParam()
// handle that path directly, see src/param-controls.js) and this file
// doesn't change it.
(function () {
  'use strict';

  var paletteListEl = document.getElementById('palette-list');
  var chainListEl = document.getElementById('chain-list');
  var emptyHintEl = document.getElementById('empty-hint');
  var layoutEl = document.getElementById('chain-layout');

  if (!paletteListEl || !chainListEl) {
    // Palette/canvas markup isn't present (e.g. not yet built, or
    // restructured again by a later task) — nothing to wire up.
    return;
  }

  if (typeof window.Sortable === 'undefined') {
    // SortableJS failed to load (e.g. CDN unreachable). Fail loud in the
    // console rather than silently leaving a non-functional, unlabeled
    // palette/canvas on screen.
    console.error('ChainCanvas: SortableJS (window.Sortable) is not available — check the CDN <script> tag in index.html.');
    return;
  }

  // ---------------------------------------------------------------------
  // Model bookkeeping (Part D).
  //
  // `nodesById` holds the actual {id, type, params} objects — the SAME
  // object references get mutated in place by a card's onParamsChanged
  // callback (see createNodeCard() below), so a later structural rebuild
  // always picks up each node's current, possibly-tuned params rather than
  // stale defaults. `chainModel` is just an ordered array of those same
  // object references, rebuilt from DOM order on every structural change —
  // never hand-maintained independently of the DOM, so it can't drift out
  // of sync with what's actually on screen.
  // ---------------------------------------------------------------------
  var nodesById = {};
  var chainModel = [];
  var nodeIdCounter = 0;

  function nextNodeId() {
    nodeIdCounter += 1;
    return 'node-' + nodeIdCounter;
  }

  /**
   * Recompute `chainModel` from the chain list's current DOM order. Reads
   * each `.node-card`'s `data-node-id` attribute and looks up the
   * corresponding (already up-to-date) entry in `nodesById`.
   *
   * @returns {Array<{id: string, type: string, params: Object}>}
   */
  function recomputeModelFromDom() {
    var cardEls = chainListEl.querySelectorAll('.node-card');
    var ids = Array.prototype.map.call(cardEls, function (el) {
      return el.getAttribute('data-node-id');
    });
    chainModel = ids
      .map(function (id) { return nodesById[id]; })
      .filter(function (entry) { return !!entry; });
    return chainModel;
  }

  /**
   * Show the "drag an effect here" hint exactly when the chain list has no
   * cards in it, per px1-layout-spec.md's empty-vs-populated state row.
   */
  function updateEmptyHint() {
    if (!emptyHintEl) {
      return;
    }
    var hasNodes = chainListEl.children.length > 0;
    emptyHintEl.style.display = hasNodes ? 'none' : '';
  }

  /**
   * Rebuild the live audio graph from the current `chainModel`, exactly
   * once, via AudioGraph.buildGraph(). No-ops (does not throw) if the
   * engine hasn't started yet — buildGraph() requires a live
   * AudioContext/sourceNode (see src/audio-graph.js), and there is nothing
   * to build against before AudioEngine.start() has resolved. This is the
   * ONE guarded chokepoint every structural change (add/remove/reorder)
   * routes through — never called from anywhere else in this file, and
   * never called merely because a pointer moved during a drag (SortableJS
   * only fires the callbacks that call this on an actual committed change,
   * not on every dragover/pointermove).
   */
  function rebuildGraph() {
    if (!window.AudioEngine || !window.AudioEngine.isStarted) {
      return;
    }
    var modelForBuild = chainModel.map(function (entry) {
      return { id: entry.id, type: entry.type, params: entry.params };
    });
    window.AudioGraph.buildGraph(modelForBuild);
  }

  // ---------------------------------------------------------------------
  // Palette (Part B) — one chip per NodeTypes.getAllTypes() entry, built
  // once at load time. Populated dynamically, never a hardcoded type list:
  // as AE-6 through AE-10 each register a new type (same one-call pattern
  // AE-5's src/node-gain.js already uses), this loop picks them up
  // automatically the next time the page loads.
  // ---------------------------------------------------------------------
  function renderPalette() {
    paletteListEl.innerHTML = '';
    var types = window.NodeTypes.getAllTypes();
    types.forEach(function (type) {
      var chip = document.createElement('div');
      chip.className = 'node-chip';
      chip.setAttribute('data-node-type', type);
      chip.textContent = window.NodeTypes.getLabel(type);
      paletteListEl.appendChild(chip);
    });
  }

  // ---------------------------------------------------------------------
  // Node card construction (Part C).
  // ---------------------------------------------------------------------

  /**
   * Build a real, stateful node-card element for one chain entry.
   *
   * Structure (see styles/main.css for the visual rules):
   *   .node-card[data-node-id]
   *     .node-card-header
   *       .node-drag-handle          <- ONLY this drives SortableJS's
   *                                     `handle: '.node-drag-handle'` on the
   *                                     chain list, so grabbing the slider
   *                                     or the remove button can never
   *                                     start a card drag.
   *         .node-drag-icon
   *         .node-label
   *       .node-remove-btn           <- sibling of the handle, NOT nested
   *                                     inside it — clicking it can't be
   *                                     mistaken for a handle-area press.
   *     .node-params                 <- ParamControls.render() target.
   *
   * @param {string} type
   * @param {Object} initialParams
   * @param {string} [explicitId] - when provided, use this exact id instead
   *   of minting a new one via nextNodeId(). Used by loadModel() (below) to
   *   restore a saved/preset model's ORIGINAL ids verbatim, rather than
   *   silently reassigning fresh ones on every reload.
   * @returns {HTMLElement}
   */
  function createNodeCard(type, initialParams, explicitId) {
    var id = explicitId || nextNodeId();
    var nodeState = { id: id, type: type, params: Object.assign({}, initialParams || {}) };
    nodesById[id] = nodeState;

    var card = document.createElement('div');
    card.className = 'node-card';
    card.setAttribute('data-node-id', id);

    var header = document.createElement('div');
    header.className = 'node-card-header';

    var handle = document.createElement('span');
    handle.className = 'node-drag-handle';
    handle.title = 'Drag to reorder';

    var gripIcon = document.createElement('span');
    gripIcon.className = 'node-drag-icon';
    gripIcon.setAttribute('aria-hidden', 'true');
    gripIcon.textContent = '⋮⋮'; // vertical ellipsis pair, a small grip glyph

    var label = document.createElement('span');
    label.className = 'node-label';
    label.textContent = window.NodeTypes.getLabel(type);

    handle.appendChild(gripIcon);
    handle.appendChild(label);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'node-remove-btn';
    removeBtn.setAttribute('aria-label', 'Remove ' + window.NodeTypes.getLabel(type));
    removeBtn.textContent = '×'; // ×

    header.appendChild(handle);
    header.appendChild(removeBtn);

    var paramsContainer = document.createElement('div');
    paramsContainer.className = 'node-params';

    card.appendChild(header);
    card.appendChild(paramsContainer);

    // Render this node's sliders inline, per Part C. onParamsChanged keeps
    // OUR in-memory copy (nodeState.params) current, so a later structural
    // rebuild (add/remove/reorder elsewhere in the chain) passes along
    // whatever this node's CURRENT tuned values are — reordering must never
    // reset an already-tuned param back to its type default.
    window.ParamControls.render(paramsContainer, nodeState, function (updatedParams) {
      nodeState.params = updatedParams;
      // Deliberately no rebuildGraph() call here — a plain param tweak is
      // not a structural change (see file-level comment above and Part D
      // of the task spec). ParamControls itself already applies the live
      // AudioParam change directly; this callback only needs to keep this
      // card's bookkeeping current for the next structural rebuild.
      //
      // PS-2: a param tweak DOES still need to be persisted, though — the
      // autosave slot must reflect the node's current tuned value, not just
      // its value as of the last structural change. Saving here is separate
      // from (and never triggers) rebuildGraph()/buildGraph() above.
      //
      // Pass chainModel explicitly rather than letting Persistence fall
      // back to AudioGraph.getModel(): nodeState is the SAME object
      // reference chainModel already holds for this id (see the file-level
      // model-bookkeeping comment above), so the `nodeState.params =
      // updatedParams` assignment just above is already reflected in
      // chainModel with zero extra work — no recompute needed here.
      if (window.Persistence) {
        window.Persistence.saveCurrentChain(chainModel);
      }
      // PS-3: a param tweak is a user EDIT — mark the currently-displayed
      // preset (if any) as having unsaved changes. Unlike the saveCurrentChain()
      // call just above, this is purely a display concern (the "• unsaved
      // changes" indicator), not persistence.
      if (window.PresetsUI) {
        window.PresetsUI.markModified();
      }
    });

    removeBtn.addEventListener('click', function (event) {
      // Stop the click from bubbling to anything that might reinterpret it
      // (defensive; the button lives outside .node-drag-handle so
      // SortableJS was never going to treat this as a drag start anyway).
      event.stopPropagation();
      card.remove();
      delete nodesById[id];
      recomputeModelFromDom();
      updateEmptyHint();
      // Structural change (Part D) — recompute then rebuild, exactly once,
      // immediately (not deferred to some other event).
      rebuildGraph();
      // PS-2: persist the chain after this structural change too. Pass
      // chainModel explicitly (already recomputed above) rather than
      // AudioGraph.getModel() — see the comment on
      // Persistence.saveCurrentChain() for why: AudioGraph's own model
      // commits asynchronously, ~20ms after rebuildGraph() returns, so
      // reading through it right here would silently save the OLD,
      // pre-removal model.
      if (window.Persistence) {
        window.Persistence.saveCurrentChain(chainModel);
      }
      // PS-3: removing a node is a user EDIT — mark unsaved.
      if (window.PresetsUI) {
        window.PresetsUI.markModified();
      }
    });

    return card;
  }

  // ---------------------------------------------------------------------
  // SortableJS wiring (Part E).
  // ---------------------------------------------------------------------

  // Palette list: source-only. `pull: 'clone'` leaves the original chip in
  // place and drags out a clone; `put: false` means nothing can ever be
  // dropped INTO the palette; `sort: false` means the palette's own item
  // order never changes via drag.
  var paletteSortable = new window.Sortable(paletteListEl, {
    group: { name: 'chain-group', pull: 'clone', put: false },
    sort: false,
    forceFallback: true,
    animation: 150,
  });

  // Chain list: the real signal chain. `handle` restricts drag-initiation
  // to each card's .node-drag-handle (Part C) so the slider and remove
  // button never trigger a reorder.
  var chainSortable = new window.Sortable(chainListEl, {
    group: { name: 'chain-group', pull: true, put: true },
    handle: '.node-drag-handle',
    forceFallback: true,
    animation: 150,

    // A palette item was dropped in. Replace the cloned palette DOM node
    // with a real, stateful node-card (Part C) — NOT a model
    // recompute/buildGraph call; that happens in onSort below, which fires
    // right after this for the same drop (see the file-level comment on
    // why the two are split like this).
    onAdd: function (evt) {
      var clonedItem = evt.item;
      var type = clonedItem.getAttribute('data-node-type');
      var paramSpec = window.NodeTypes.getParamSpec(type);
      var defaultParams = {};
      paramSpec.forEach(function (spec) {
        defaultParams[spec.id] = spec.default;
      });
      var card = createNodeCard(type, defaultParams);
      clonedItem.replaceWith(card);
    },

    // Fires for ANY committed change to this list's contents/order — both
    // a palette drop (alongside onAdd, which runs first) and a pure
    // in-list reorder (alongside onUpdate). This is the SINGLE place model
    // recompute + AudioGraph.buildGraph() happen for drag-driven changes,
    // so a drop-and-reorder-in-one-drag never double-fires buildGraph.
    // SortableJS only fires this on an actual committed DOM-order change —
    // never during pointermove/dragover, and not at all for a drag that's
    // picked up and dropped back in its original position (no reorder to
    // commit).
    onSort: function () {
      recomputeModelFromDom();
      updateEmptyHint();
      rebuildGraph();
      // PS-2: persist the chain after every structural add/remove/reorder
      // that flows through this single chokepoint. Pass chainModel
      // explicitly rather than AudioGraph.getModel() — see the comment on
      // Persistence.saveCurrentChain() for why: AudioGraph's own model
      // commits asynchronously, ~20ms after rebuildGraph() returns, so
      // reading through it right here would silently save the OLD,
      // pre-change model (e.g. a just-dropped-in node would never actually
      // make it into the autosave slot).
      if (window.Persistence) {
        window.Persistence.saveCurrentChain(chainModel);
      }
      // PS-3: a drag-driven add/remove/reorder is a user EDIT — mark unsaved.
      if (window.PresetsUI) {
        window.PresetsUI.markModified();
      }
    },
  });

  /**
   * Called once by src/main.js right after AudioEngine.start() resolves
   * successfully. Removes the "not started yet" gating class so the
   * palette/canvas read as active instead of dimmed/inert. Purely visual —
   * rebuildGraph()'s own window.AudioEngine.isStarted check (above) is the
   * actual functional guard against building a graph with no audioContext/
   * sourceNode to build against, so a stray drag that somehow completes
   * before this is called still can't throw.
   */
  function onEngineStarted() {
    if (layoutEl) {
      layoutEl.classList.remove('engine-not-started');
    }
  }

  /**
   * PS-2: rebuild the ENTIRE chain canvas from an arbitrary
   * `{id, type, params}[]` array — e.g. a saved autosave slot restored via
   * window.Persistence, or (eventually) a named preset. Unlike the
   * drag-and-drop path above (onAdd/onSort), this replaces the whole chain
   * list in one shot rather than reacting to a single incremental change.
   *
   * Every restored card is built with its EXACT saved id, via
   * createNodeCard()'s explicitId param (Part A.1) — not a freshly-minted
   * one — so ids stay stable across a save/reload round trip (e.g. so a
   * future feature that remembers "which card was selected" by id keeps
   * working after a reload). That stability creates one bookkeeping hazard
   * this function has to close: nodeIdCounter (used by nextNodeId() for
   * every NEW node added after this load) starts back at wherever it last
   * was, with no knowledge of the ids we just restored. If a saved model
   * contained "node-7" and nodeIdCounter was still sitting at 3, the very
   * next drag-and-drop add would mint "node-4" — which is fine, that's
   * still unused — but the counter would keep climbing 4, 5, 6, 7 and
   * eventually mint "node-7" again, COLLIDING with the restored card's id.
   * Two entries would then share one nodesById slot, silently corrupting
   * lookups (recomputeModelFromDom() would resolve both DOM cards'
   * data-node-id to whichever entry happened to be written last). The fix
   * is the second forEach below: after loading, scan the restored ids for
   * this canvas's own "node-N" naming scheme and fast-forward
   * nodeIdCounter past the highest N found, so the next nextNodeId() call
   * is guaranteed fresh.
   *
   * That scan only ever matches OUR OWN "node-N" scheme on purpose. A
   * preset's ids don't need to follow that format at all — PX-3's default
   * preset (src/default-preset.js) ships ids "n1".."n6", which never match
   * /^node-(\d+)$/ and are simply skipped by the counter scan. That's
   * correct, not a gap: ids are opaque bookkeeping keys used only for
   * DOM/model lookups (data-node-id, nodesById) and are never shown to the
   * user, so nothing requires every id in the app to share one format — the
   * "n1".."n6" ids can never collide with a "node-N" id going forward
   * anyway, since the two prefixes are different strings.
   *
   * @param {Array<{id: string, type: string, params: Object}>} model
   */
  function loadModel(model) {
    chainListEl.innerHTML = '';
    nodesById = {};

    model.forEach(function (entry) {
      var card = createNodeCard(entry.type, entry.params, entry.id);
      chainListEl.appendChild(card);
    });

    // Bump nodeIdCounter past any loaded "node-N" ids so a freshly-added
    // node after a load can never collide with a restored one. Ids from a
    // different scheme (e.g. the PX-3 default preset's "n1".."n6") simply
    // don't match this pattern and are correctly ignored — they can never
    // collide with this canvas's own "node-N" ids anyway, since the
    // prefixes differ.
    model.forEach(function (entry) {
      var match = /^node-(\d+)$/.exec(entry.id);
      if (match) {
        var n = parseInt(match[1], 10);
        if (n > nodeIdCounter) {
          nodeIdCounter = n;
        }
      }
    });

    recomputeModelFromDom();
    updateEmptyHint();
    rebuildGraph();

    // PS-3: persist the newly-loaded state as the new autosave baseline.
    // This makes "load a named preset" (or the initial autosaved/default
    // load on page open) immediately become what a page reload restores
    // too, not just what's currently on screen. chainModel is already
    // synchronously current at this point (recomputeModelFromDom() ran just
    // above), so this is safe to read right here — same reasoning as every
    // other saveCurrentChain() call site in this file. Deliberately NOT
    // paired with a PresetsUI.markModified() call: a load is by definition
    // a CLEAN state matching whatever was just loaded, not a modification.
    if (window.Persistence) {
      window.Persistence.saveCurrentChain(chainModel);
    }
  }

  /**
   * PS-3: a defensive copy of the current `chainModel` — each entry's
   * `params` object is copied too, so a caller can't mutate this file's own
   * internal bookkeeping by mutating the returned array/objects. Used by
   * src/presets-ui.js's "Save As…" handler to grab exactly what's on screen
   * right now, to hand to PresetStore.save().
   *
   * Deliberately reads `chainModel` directly, NOT window.AudioGraph.getModel()
   * — same reasoning already documented on Persistence.saveCurrentChain() in
   * src/persistence.js: AudioGraph.buildGraph() commits its own internal
   * model asynchronously (glitch-free rewiring finishes the swap ~20ms
   * later on a setTimeout — see src/audio-graph.js), so
   * AudioGraph.getModel() can still reflect the OLD, pre-change model for a
   * brief window right after a structural change. chainModel, by contrast,
   * is recomputed synchronously from the DOM (recomputeModelFromDom()) on
   * every structural change, so it is always exactly current the instant
   * this is called.
   *
   * @returns {Array<{id: string, type: string, params: Object}>}
   */
  function getCurrentModel() {
    return chainModel.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
  }

  renderPalette();
  updateEmptyHint();

  window.ChainCanvas = {
    onEngineStarted: onEngineStarted,
    loadModel: loadModel,
    getCurrentModel: getCurrentModel,
  };
})();
