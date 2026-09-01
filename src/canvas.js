// Chain canvas for the VOXCHAIN — drag-and-drop build /
// reorder / remove, accepted-model rendering, in-place parameter rendering,
// and (redesign item 1) the canvas panel's Pattern Machine chrome: the
// display register and the panel-print SECTION anatomy each chain entry
// renders as (see createNodeCard + buildDisplayRegister below).
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends on
// window.EffectCatalog (src/effect-catalog.js), window.ParamControls
// (src/param-controls.js), window.AudioGraph (src/audio-graph.js), and
// window.AudioEngine (src/audio-engine.js) — all already loaded by the time
// this file runs, per index.html's script order. (SortableJS is RETIRED —
// 2026-08-31: no drag library remains; see the wiring note below.)
//
// UI-3 scope: this is where AE-4's glitch-free rewiring engine and UI-4's
// generic parameter controls come together into a real, usable feature for
// the first time. The add verbs are the palette chip CLICK and keyboard
// activation (both addNodeType); order changes are CORD EDITS (FEW-4);
// the grip/header drags MOVE POSITION (FEW-2).
//
// Model bookkeeping (Part D of the task spec): `chainModel`/`nodesById`
// are the Canvas adapter's accepted rendered copy. Human gestures produce
// normalized candidates/intents for ChainEditing; only that module commits
// the live graph, accepts logical state, persists, updates preset state,
// and records revision/Undo. ChainEditing calls renderModel or
// renderNodeParam only after acceptance, keeping this file presentational.
(function () {
  'use strict';

  var paletteListEl = document.getElementById('palette-list');
  var chainListEl = document.getElementById('chain-list');
  // The scrolling board region AROUND the row — the palette drag's drop
  // zone (a chip released outside it is not an add; see armPaletteDrag).
  var boardEl = document.getElementById('chain-canvas');
  var emptyHintEl = document.getElementById('empty-hint');
  var layoutEl = document.getElementById('chain-layout');
  var signalOrderEl = document.getElementById('signal-order-panel');

  if (!paletteListEl || !chainListEl) {
    // Palette/canvas markup isn't present (e.g. not yet built, or
    // restructured again by a later task) — nothing to wire up.
    return;
  }

  // (SortableJS is RETIRED — 2026-08-31: the chain-side instance left
  // with PD-1's cord editing, and the palette drag left with the
  // dead-affordance round the same day. This file has no drag library
  // dependency anymore; there is deliberately no window.Sortable guard
  // here.)

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

  // MC-4 (OQ-7 serialization rule): true while ANY board gesture is in
  // progress — a cord edit (armed at press since the 2026-08-31 race fix),
  // a seat drag, or a width-resize drag; one gesture owns the pointer at a
  // time. Read via the exported isDragActive() so src/mcp-tools.js can
  // QUEUE agent mutations behind an in-progress user gesture instead of
  // racing its commit; loadModel() cancels any armed gesture before
  // replacing the board so a stale gesture can never commit afterward.
  var dragActive = false;

  // ---------------------------------------------------------------------
  // Board redesign (2026-09-01, user direction): the free 2D board (x/y
  // seats, patch cords, jack anchors) is RETIRED — "an okay experiment
  // but ultimately not great." The chain is now a plain ordered ROW:
  // cards lay out in normal CSS flex flow (styles/main.css's
  // .chain-list), so DOM ORDER ALONE decides visual position — the same
  // PD-4 invariant the free board already kept (DOM order = chain order),
  // just with nothing left to keep it in sync WITH anymore. A card's only
  // remaining per-id layout fact is its manually-resized WIDTH
  // (cardWidths below); reordering is a drag gesture over the row itself
  // (see the REORDER block further down), not a cord edit.
  //
  // Persistence rides the same FEW-1 store seam as before: saved on
  // resize-END (never per pointermove) via
  // saveCurrentChain(chainModel, currentLayout()) — currentLayout() now
  // returns {id: {w}} instead of {id: {x,y,w,scale,flow}}; the store's
  // prune/normalize rules still keep the slot garbage-free on removes.
  // ---------------------------------------------------------------------
  var GRID_PITCH = 16; // the snap quantum (px) for width-resize only now
  // Per-card WIDTH: a condensed section's own width in px, snap-quantized
  // and clamped. The clamp bounds mirror main.css's horizontal-mode
  // min/max-width (13rem..24rem).
  //
  // Width floors: every card HUGS its own content — JS measures the
  // widest KNOB row after render (trims/pads stretch to fill whatever
  // width exists, so they never leave dead space) and that measurement is
  // the card's default width. 128px is the layout-less fallback default
  // (stripped harnesses measure nothing); 384px the ceiling.
  //
  // 208px is the resize FLOOR (2026-09-01, raised from 112px alongside
  // the new per-card BYPASS button — a third button now shares the rail's
  // foot with fold/remove, and the hug measurement only ever reads the
  // BODY's widest knob row, never the header band's own content). Worst
  // case measured live: Autotune's rail (3-letter code + its
  // "Experimental" badge) needed 184px once the badge switched to its
  // already-compact palette-chip form ("EXP" — see createExperimentalBadge
  // below, a real bugfix, not a width carve-out); the floor carries one
  // grid tick of headroom above that. CARD_W_DEFAULT_PX matches the floor
  // exactly — clampCardW's no-value branch must never resolve BELOW its
  // own minimum.
  var CARD_W_DEFAULT_PX = 208;
  var CARD_W_MIN_PX = 208; // 13rem
  var CARD_W_MAX_PX = 384; // 24rem
  var cardHugW = {}; // id -> measured content width (real browsers only)
  var cardWidths = {}; // id -> manually-resized width (px); absent = hug/default
  var resizeDrag = null; // the live width-resize drag, if any
  var reorderDrag = null; // the live drag-to-reorder gesture, if any
  var paletteDrag = null; // the live drag-an-effect-in-from-the-palette gesture

  function requireChainEditing() {
    if (!window.ChainEditing || typeof window.ChainEditing.apply !== 'function') {
      throw new Error('ChainEditing is required for every chain mutation.');
    }
    return window.ChainEditing;
  }

  function snapToGrid(v) {
    return Math.round(v / GRID_PITCH) * GRID_PITCH;
  }

  /** Clamp a candidate width into the condensed range (the board's own
   *  geometry contract, mirrored in main.css's horizontal min/max). */
  function clampCardW(w) {
    if (typeof w !== 'number' || !isFinite(w)) {
      return CARD_W_DEFAULT_PX;
    }
    if (w < CARD_W_MIN_PX) {
      return CARD_W_MIN_PX;
    }
    if (w > CARD_W_MAX_PX) {
      return CARD_W_MAX_PX;
    }
    return w;
  }

  /** A card's effective width in px: its manually-resized width clamped
   *  into the condensed range; else its MEASURED content hug (plus the
   *  card's own side padding and border); else the layout-less default.
   *  Single source for the width-resize gesture and every repaint. */
  function cardWidth(id) {
    if (typeof cardWidths[id] === 'number') {
      return clampCardW(cardWidths[id]);
    }
    if (typeof cardHugW[id] === 'number') {
      return clampCardW(cardHugW[id] + 15); // + 2x0.4rem padding + 2px border
    }
    return clampCardW(undefined);
  }

  /** Measure a LIVE card's widest intrinsic control row (the content
   *  hug). Trim and pad rows stretch to the available width by
   *  construction, so they are skipped — only knob rows define the hug.
   *  Must run AFTER the card is in the document (offsetWidth is 0
   *  otherwise — the creation-time measurement always read zero, which
   *  is why the hug never landed until this fix). Stripped harnesses
   *  report no widths and simply keep the default. */
  function ensureCardHug(id, card) {
    if (cardHugW[id] !== undefined || !card || typeof card.querySelector !== 'function') {
      return;
    }
    try {
      var inner = card.querySelector('.node-params-inner');
      if (!inner || !inner.children) {
        return;
      }
      var hug = 0;
      Array.prototype.forEach.call(inner.children, function (row) {
        if (!row.classList || row.classList.contains('trim-row') ||
            row.classList.contains('pad-row')) {
          return;
        }
        var w = row.offsetWidth;
        if (w > hug) {
          hug = w;
        }
      });
      if (hug > 0) {
        cardHugW[id] = hug;
      }
    } catch (err) {
      /* measurement is a real-browser nicety only */
    }
  }

  /** Paint one card's own width (the only per-id layout fact left — see
   *  the board-redesign comment above). Position is now free: normal
   *  flex flow places the card, nothing here ever touches transform. */
  function applyCardWidth(card, id) {
    if (!id) {
      return;
    }
    ensureCardHug(id, card); // first paint after render — the card is live
    card.style.width = cardWidth(id) + 'px';
  }

  /** Repaint every card's width from the current cardWidths/cardHugW
   *  state — used after a full model render (renderModel below). */
  function applyCardWidths() {
    var cardEls = chainListEl.querySelectorAll('.node-card');
    Array.prototype.forEach.call(cardEls, function (card) {
      applyCardWidth(card, card.getAttribute('data-node-id'));
    });
  }

  /** The live layout map (passed to the store; the store prunes unknown
   *  ids) — {id: {w}} now that x/y/scale/flow have nothing left to mean. */
  function currentLayout() {
    var out = {};
    Object.keys(cardWidths).forEach(function (id) {
      out[id] = { w: cardWidths[id] };
    });
    return out;
  }

  // The width-resize pointer-drag: adjusts ONE card's width
  // (snap-quantized, clamped to the condensed range) and repaints it.
  // Never an order, never a sound.
  function onResizePointerMove(event) {
    if (!resizeDrag) {
      return;
    }
    var dx = ((event && typeof event.clientX === 'number' ? event.clientX : 0) - resizeDrag.startX);
    var w = snapToGrid(resizeDrag.originW + dx);
    if (w < CARD_W_MIN_PX) {
      w = CARD_W_MIN_PX;
    }
    if (w > CARD_W_MAX_PX) {
      w = CARD_W_MAX_PX;
    }
    if (cardWidths[resizeDrag.id] !== w) {
      cardWidths[resizeDrag.id] = w;
      resizeDrag.card.style.width = w + 'px';
      resizeDrag.moved = true;
    }
  }

  function onResizePointerEnd() {
    if (!resizeDrag) {
      return;
    }
    var drag = resizeDrag;
    resizeDrag = null;
    dragActive = false;
    // Persist on END only — never per pointermove.
    if (drag.moved) {
      if (window.ChainEditing && typeof window.ChainEditing.syncLayout === 'function') {
        window.ChainEditing.syncLayout(currentLayout());
      }
      if (window.Persistence) {
        window.Persistence.saveCurrentChain(chainModel, currentLayout());
      }
    }
  }

  // ---------------------------------------------------------------------
  // DRAG-TO-REORDER (board redesign, 2026-09-01 user direction — "like
  // Ableton's workflow"): replaces the retired cord-edit gesture as the
  // chain's one reorder mechanism. Fixed semantics carried over verbatim
  // from the cord gesture it replaces (town-hall Q4, unchangeable):
  //   - THE DRAG EDITS ORDER, NEVER GATES AUDIO. Grabbing a section
  //     starts an edit; audio changes ONLY on a completed drop, submitted
  //     as ONE candidate through the existing commitStructuralChange() ->
  //     ChainEditing chokepoint. Mid-drag the live model, the graph, the
  //     accepted render AND the real cards' DOM order are all
  //     byte-unchanged; a canceled drag (Escape, pointercancel, or
  //     onEngineStopped mid-gesture) commits nothing and has nothing to
  //     put back.
  //   - GRAB SURFACE: the whole section is the grip, minus the controls
  //     that own their own press (NO_DRAG_SELECTOR below) — knobs, pads,
  //     trims, the bypass/fold/eject keys, the resize corner. The rail
  //     and its machined grip dots remain the ADVERTISED grip (cursor,
  //     tooltip, tab stop); they are no longer the only one, because a
  //     6.5rem rail is a smaller target than the gesture deserves.
  //   - DELIBERATE-DRAG GUARD: the pointer must travel at least
  //     REORDER_DRAG_THRESHOLD px before the gesture DETACHES — a click
  //     on a section is not a drag, and a sub-threshold release commits
  //     nothing (the same guard the cord gesture used).
  //   - GHOST PREVIEW: past the threshold the held card LIFTS out of flow
  //     and a dashed ghost slot (see THE GHOST below) reserves the row
  //     position it would land in; every later pointermove just moves the
  //     ghost. The operator sees the destination before committing to it,
  //     and the real cards never move under the cursor.
  //   - A drop that lands back at the arm-time order is a NO-OP: retire
  //     the ghost, zero rebuilds (the retired SortableJS, and the cord
  //     gesture after it, both held this same "moved nothing -> commits
  //     nothing" rule).
  // ---------------------------------------------------------------------
  // 4px, not the cord gesture's 6: a section is a big, heavy target that
  // an operator expects to answer the moment it is pulled, and there is
  // no longer a competing click verb on the grab surface for a low
  // threshold to steal from (the section's real controls are excluded
  // from arming outright rather than disambiguated by distance).
  var REORDER_DRAG_THRESHOLD = 4;

  // Anything matching this owns its own press and can never START a drag.
  // Everything ELSE on a section is grab surface: the rail, the header
  // band, the printed labels, the encoder field's whitespace.
  var NO_DRAG_SELECTOR = 'button, input, select, textarea, label, a, ' +
    '.param-row, .node-resize, [role="slider"], [role="radio"], [role="radiogroup"]';

  /** All node-card ids in current DOM order (== chain order, PD-4). */
  function domCardIds() {
    var cardEls = chainListEl.querySelectorAll('.node-card');
    return Array.prototype.map.call(cardEls, function (el) {
      return el.getAttribute('data-node-id');
    });
  }

  function cardElById(id) {
    var found = null;
    var cardEls = chainListEl.querySelectorAll('.node-card');
    Array.prototype.some.call(cardEls, function (el) {
      if (el.getAttribute('data-node-id') === id) {
        found = el;
        return true;
      }
      return false;
    });
    return found;
  }

  /** Commit an id order to the DOM with .insertBefore ONLY (exactly how
   *  the retired SortableJS onSort reorder — and the cord gesture after
   *  it — did it: pull every named card out, then reinsert walking the
   *  target order right-to-left, each before the already-placed card that
   *  must follow it, so insert references are never shifted by a
   *  concurrent removal). DOM ORDER = CHAIN ORDER (PD-4). Listeners
   *  survive — elements are moved, never rebuilt. */
  function applyDomOrder(ids) {
    var els = [];
    ids.forEach(function (id) {
      var card = cardElById(id);
      if (card) {
        els.push(card);
      }
    });
    els.forEach(function (card) {
      card.remove();
    });
    var ref = null;
    for (var k = els.length - 1; k >= 0; k--) {
      chainListEl.insertBefore(els[k], ref);
      ref = els[k];
    }
  }

  /** A drag-time SNAPSHOT of where every slot sits: [{ id, mid }], mid
   *  null when the harness exposes no geometry. The gesture reads this
   *  ONCE, at detach, and never re-measures — the drop slot has to be a
   *  STABLE function of the pointer's x. The pre-ghost build recomputed
   *  it from LIVE midpoints AFTER reordering the real cards on every
   *  pointermove, so choosing a slot moved the very midpoints that chose
   *  it: cards thrashed under the cursor and every boundary oscillated.
   *  That feedback loop was the drag's "sensitivity". Taking the ghost's
   *  box from the card it stands in for keeps the row's layout
   *  byte-identical across the detach, so a snapshot measured here stays
   *  true for the whole gesture.
   *
   *  @param {string[]} ids - card ids in chain order
   *  @param {string} [excludeId] - the held card, left out of the slots
   *  @returns {Array<{id: string, mid: (number|null)}>}
   */
  function slotMidpoints(ids, excludeId) {
    return ids.filter(function (id) {
      return id !== excludeId;
    }).map(function (id) {
      var el = cardElById(id);
      var rect = el && typeof el.getBoundingClientRect === 'function' ?
        el.getBoundingClientRect() : null;
      return { id: id, mid: rect ? rect.left + rect.width / 2 : null };
    });
  }

  /** Which slot does pointerX name? The index of the first snapshot entry
   *  whose midpoint sits to the RIGHT of the pointer (drop BEFORE it);
   *  past every midpoint, the end. Pure. An unmeasurable entry is never a
   *  boundary, so a geometry-less harness always resolves to the end. */
  function slotIndexAt(mids, pointerX) {
    for (var i = 0; i < mids.length; i++) {
      if (mids[i].mid !== null && pointerX < mids[i].mid) {
        return i;
      }
    }
    return mids.length;
  }

  /** The safe-output clamp, shared by both drop gestures: a limiter
   *  sitting LAST stays last (the same invariant addNodeType() already
   *  holds for the click add), so no drop may name the slot behind it.
   *
   *  @param {Array<{id: string}>} mids - the slot snapshot
   *  @param {number} index
   *  @returns {number}
   */
  function clampBehindTerminalLimiter(mids, index) {
    if (mids.length === 0 || index < mids.length) {
      return index;
    }
    var last = nodesById[mids[mids.length - 1].id];
    return last && last.type === 'limiter' ? mids.length - 1 : index;
  }

  /** The full new order: draggedId spliced into the OTHER cards' current
   *  order at targetIndex. Pure. */
  function reorderedIds(ids, draggedId, targetIndex) {
    var others = ids.filter(function (id) {
      return id !== draggedId;
    });
    others.splice(targetIndex, 0, draggedId);
    return others;
  }

  // ---------------------------------------------------------------------
  // THE GHOST — DESIGN.md's Sections drag spec, verbatim: "the ghost is a
  // dashed print slot — a groove reservation, not a section". It is built
  // to the exact box of whatever it stands in for, so putting it in the
  // row costs ZERO layout, and MOVING it is the entire drop preview.
  // Nothing else previews: the model, the graph, the accepted render —
  // and, unlike the build this replaces, even the real cards' DOM order —
  // stay byte-unchanged until the drop commits.
  // ---------------------------------------------------------------------

  /** @param {number} width @param {number} height @param {string} label */
  function makeGhost(width, height, label) {
    var ghost = document.createElement('div');
    ghost.className = 'node-card-placeholder';
    ghost.setAttribute('aria-hidden', 'true');
    if (label) {
      ghost.setAttribute('data-ghost-label', label);
    }
    if (ghost.style) {
      if (width) {
        ghost.style.width = width + 'px';
      }
      if (height) {
        ghost.style.minHeight = height + 'px';
      }
    }
    return ghost;
  }

  /** Move a gesture's ghost to `index` among the slots its snapshot named
   *  (past them = the end of the row). Idempotent: naming the slot the
   *  ghost already holds re-renders nothing. */
  function moveGhostTo(drag, index) {
    if (!drag.ghost || drag.slotIndex === index ||
        typeof chainListEl.insertBefore !== 'function') {
      return;
    }
    drag.slotIndex = index;
    var ref = index < drag.mids.length ? cardElById(drag.mids[index].id) : null;
    if (ref) {
      chainListEl.insertBefore(drag.ghost, ref);
    } else {
      chainListEl.appendChild(drag.ghost);
    }
    renderChainArrows();
  }

  function removeGhost(drag) {
    if (drag.ghost && typeof drag.ghost.remove === 'function') {
      drag.ghost.remove();
    }
    drag.ghost = null;
    drag.slotIndex = -1;
  }

  /** Pointer capture keeps the gesture alive when the pointer rides off
   *  the row (or off the window) — the document-level handlers still see
   *  every move and, crucially, the terminating pointerup. Guarded: a
   *  stripped harness has neither method. */
  function capturePointer(el, pointerId) {
    if (pointerId === null || pointerId === undefined || !el ||
        typeof el.setPointerCapture !== 'function') {
      return;
    }
    try {
      el.setPointerCapture(pointerId);
    } catch (err) {
      /* capture is an optimization, never load-bearing */
    }
  }

  function releasePointer(el, pointerId) {
    if (pointerId === null || pointerId === undefined || !el ||
        typeof el.releasePointerCapture !== 'function') {
      return;
    }
    try {
      el.releasePointerCapture(pointerId);
    } catch (err) {
      /* already released with the pointer */
    }
  }

  /** One body-level flag for BOTH drop gestures: kills text selection and
   *  puts the grabbing cursor on everything for the gesture's duration
   *  (styles/main.css). Without it a drag that crosses a printed label
   *  paints a selection highlight across the chassis. */
  function setBodyDragging(on) {
    var body = document.body;
    if (!body || !body.classList) {
      return;
    }
    if (on) {
      body.classList.add('chain-dragging');
    } else {
      body.classList.remove('chain-dragging');
    }
  }

  /** Take the held card OUT OF FLOW so the row can close around its
   *  ghost: fixed to the exact box it occupied, then translated by the
   *  pointer delta on every move. DESIGN.md's Elevation section names the
   *  drag lift the one real shadow in this world — the held card is the
   *  one thing on the chassis allowed to look picked up. */
  function liftCard(drag) {
    var card = drag.card;
    if (!drag.rect || !card || !card.style) {
      return;
    }
    card.style.position = 'fixed';
    card.style.left = drag.rect.left + 'px';
    card.style.top = drag.rect.top + 'px';
    card.style.width = drag.rect.width + 'px';
    card.style.height = drag.rect.height + 'px';
    card.style.margin = '0';
  }

  /** Put the lifted card back into flow. The WIDTH is restored to its own
   *  persisted layout value rather than cleared — it is a real card
   *  property (cardWidths), not part of the lift, and clearing it would
   *  silently drop the operator's resize on every drop. */
  function dropCardBackIntoFlow(drag) {
    var card = drag.card;
    if (!card || !card.style) {
      return;
    }
    card.style.position = '';
    card.style.left = '';
    card.style.top = '';
    card.style.height = '';
    card.style.margin = '';
    card.style.transform = '';
    card.style.width = cardWidth(drag.id) + 'px';
  }

  /** Arm (not start) a reorder from a press on a section — mirrors the
   *  retired cord gesture's armCordDrag: nothing lifts, nothing detaches,
   *  and no ghost exists until the deliberate-drag threshold is crossed. */
  function armReorderDrag(card, id, event) {
    if (reorderDrag || resizeDrag || paletteDrag) {
      return; // one gesture at a time
    }
    if (event && typeof event.button === 'number' && event.button !== 0) {
      return; // primary pointer only
    }
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    dragActive = true;
    reorderDrag = {
      card: card,
      id: id,
      startX: event && typeof event.clientX === 'number' ? event.clientX : 0,
      startY: event && typeof event.clientY === 'number' ? event.clientY : 0,
      pointerId: event && event.pointerId !== undefined ? event.pointerId : null,
      detached: false,
      armOrder: domCardIds(),
      mids: [],
      ghost: null,
      slotIndex: -1,
      rect: null
    };
  }

  /** Cross the threshold: measure, reserve the ghost slot the card is
   *  leaving, and lift the card. Every measurement happens BEFORE
   *  anything moves. */
  function detachReorderDrag(drag) {
    drag.detached = true;
    var card = drag.card;
    drag.rect = card && typeof card.getBoundingClientRect === 'function' ?
      card.getBoundingClientRect() : null;
    drag.mids = slotMidpoints(drag.armOrder, drag.id);
    var node = nodesById[drag.id];
    drag.ghost = makeGhost(
      drag.rect ? drag.rect.width : 0,
      drag.rect ? drag.rect.height : 0,
      node ? effectLabel(node.type) : ''
    );
    if (typeof chainListEl.insertBefore === 'function') {
      chainListEl.insertBefore(drag.ghost, card);
    }
    // The ghost opens exactly where the card sat: among the OTHER cards,
    // that is the card's own arm-time index.
    drag.slotIndex = drag.armOrder.indexOf(drag.id);
    liftCard(drag);
    if (card && card.classList) {
      card.classList.add('reorder-chosen');
    }
    capturePointer(chainListEl, drag.pointerId);
    setBodyDragging(true);
    renderChainArrows();
  }

  function onReorderPointerMove(event) {
    if (!reorderDrag) {
      return;
    }
    var drag = reorderDrag;
    var cx = event && typeof event.clientX === 'number' ? event.clientX : drag.startX;
    var cy = event && typeof event.clientY === 'number' ? event.clientY : drag.startY;
    if (!drag.detached) {
      var dx0 = cx - drag.startX;
      var dy0 = cy - drag.startY;
      if (Math.sqrt(dx0 * dx0 + dy0 * dy0) < REORDER_DRAG_THRESHOLD) {
        return; // deliberate-drag guard: a press on a section is not a drag
      }
      detachReorderDrag(drag);
    }
    if (drag.card && drag.card.style) {
      drag.card.style.transform =
        'translate(' + (cx - drag.startX) + 'px, ' + (cy - drag.startY) + 'px)';
    }
    moveGhostTo(drag, clampBehindTerminalLimiter(drag.mids, slotIndexAt(drag.mids, cx)));
  }

  /** Undo the visual half of a reorder — shared by the drop and the
   *  cancel, which differ only in what they do with the ghost's slot. */
  function endReorderVisuals(drag) {
    dropCardBackIntoFlow(drag);
    if (drag.card && drag.card.classList) {
      drag.card.classList.remove('reorder-chosen');
    }
    releasePointer(chainListEl, drag.pointerId);
    setBodyDragging(false);
  }

  function onReorderPointerEnd() {
    if (!reorderDrag) {
      return;
    }
    var drag = reorderDrag;
    reorderDrag = null;
    dragActive = false;
    if (!drag.detached) {
      return; // sub-threshold press-release: not a drag, nothing to commit
    }
    endReorderVisuals(drag);
    // The ghost NAMES the drop slot: seat the held card exactly where it
    // stands, then retire it. This is the first and only moment in the
    // whole gesture that the real cards' DOM order changes.
    if (drag.ghost && drag.ghost.parentNode &&
        typeof chainListEl.insertBefore === 'function') {
      chainListEl.insertBefore(drag.card, drag.ghost);
    }
    removeGhost(drag);
    renderChainArrows();
    if (domCardIds().join('|') === drag.armOrder.join('|')) {
      return; // dropped back where it started: no-op, zero rebuilds
    }
    commitStructuralChange(); // DOM order -> one ChainEditing transaction
  }

  /** Escape / pointercancel / a chain replacement mid-gesture: retire the
   *  ghost and set the held card back down. The card never left its
   *  arm-time DOM slot (only the ghost moved), so a cancel has nothing to
   *  put back and can never commit. */
  function cancelReorderDrag() {
    if (!reorderDrag) {
      return;
    }
    var drag = reorderDrag;
    reorderDrag = null;
    dragActive = false;
    if (!drag.detached) {
      return;
    }
    endReorderVisuals(drag);
    removeGhost(drag);
    renderChainArrows();
  }

  function onReorderKeyDown(event) {
    if (!event || event.key !== 'Escape') {
      return;
    }
    // Escape abandons whichever drop gesture is live — both revert to
    // "nothing happened", neither commits.
    cancelReorderDrag();
    cancelPaletteDrag();
  }

  /** Keyboard equivalent (2026-09-01, accessibility commitment — see
   *  PRODUCT.md's non-negotiable keyboard-flow gate): with a card's drag
   *  handle focused, Alt+ArrowLeft/Right moves it one slot toward the
   *  front/back of the chain, clamped at the ends (no wraparound). Each
   *  press is an atomic, immediately-committed move through the SAME
   *  reorderedIds -> applyDomOrder -> commitStructuralChange pipeline the
   *  mouse gesture uses — there is no pending/uncommitted state for
   *  Escape to cancel here, unlike the mouse drag. Focus follows the
   *  moved card so repeated presses walk it down the row. */
  function onReorderKeyboardMove(event) {
    if (!event || !event.altKey) {
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    var target = event.target;
    var handle = target && typeof target.closest === 'function' ?
      target.closest('.node-drag-handle') : null;
    if (!handle) {
      return;
    }
    var card = handle.closest('.node-card');
    var id = card && card.getAttribute('data-node-id');
    if (!id) {
      return;
    }
    var ids = domCardIds();
    var idx = ids.indexOf(id);
    if (idx === -1) {
      return;
    }
    var newIdx = event.key === 'ArrowLeft' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ids.length) {
      return; // clamp at the ends — no wraparound
    }
    event.preventDefault();
    applyDomOrder(reorderedIds(ids, id, newIdx));
    renderChainArrows();
    // commitStructuralChange() synchronously restores the last-accepted
    // render BEFORE the new candidate is even submitted (its own
    // documented "put the accepted render back before graph staging"
    // step), then ASYNCHRONOUSLY re-renders again once ChainEditing
    // accepts the candidate — two rebuilds, not one, so the
    // `card`/`handle` references captured above are detached after the
    // FIRST and refocusFor(id) below runs again after the SECOND. Re-find
    // by id against the live DOM every time, never a captured element.
    function refocusFor(nodeId) {
      var movedCard = cardElById(nodeId);
      var movedHandle = movedCard && movedCard.querySelector &&
        movedCard.querySelector('.node-drag-handle');
      if (movedHandle && typeof movedHandle.focus === 'function') {
        try {
          movedHandle.focus();
        } catch (err) {
          /* stripped harness */
        }
      }
    }
    var accepted = commitStructuralChange();
    refocusFor(id); // immediate: survives until acceptance resolves
    if (accepted && typeof accepted.then === 'function') {
      accepted.then(function () {
        refocusFor(id); // re-affirm once the accepted render replaces the DOM again
      });
    }
  }

  function initBoardDragWiring() {
    if (typeof document.addEventListener !== 'function' ||
        document.__chainCanvasPointerWired) {
      return;
    }
    document.__chainCanvasPointerWired = true;
    document.addEventListener('pointermove', onResizePointerMove);
    document.addEventListener('pointerup', onResizePointerEnd);
    document.addEventListener('pointercancel', onResizePointerEnd);
    document.addEventListener('pointermove', onReorderPointerMove);
    document.addEventListener('pointerup', onReorderPointerEnd);
    document.addEventListener('pointercancel', cancelReorderDrag);
    document.addEventListener('pointermove', onPalettePointerMove);
    document.addEventListener('pointerup', onPalettePointerEnd);
    document.addEventListener('pointercancel', cancelPaletteDrag);
    document.addEventListener('keydown', onReorderKeyDown);
    document.addEventListener('keydown', onReorderKeyboardMove);
  }

  initBoardDragWiring();

  /** The drawn signal-flow connectors between adjacent cards (board
   *  redesign, 2026-09-01): a small CSS-drawn chevron in the gap between
   *  each pair of cards, replacing the retired patch-cord line — order
   *  alone carries the signal path now, this is only a legibility aid.
   *  Same drawn-mark discipline as the fold chevron (.chevron-mark) and
   *  every other on-board glyph in this file: never a Unicode arrow.
   *  Rebuilds ALL connectors from scratch on every call — cheap (N-1 tiny
   *  spans) and guarantees they can never drift out of sync with DOM
   *  order, the same "the map is the only state" philosophy the retired
   *  renderCords() documented for the cord layer it replaces. Called from
   *  every DOM-order write path (commitStructuralChange, renderModel). */
  function renderChainArrows() {
    // Paint-only — a stripped harness's minimal DOM stub may carry
    // querySelectorAll/appendChild (enough for renderModel's own card
    // insertion) without insertBefore/remove; this must degrade to a
    // no-op there rather than throw out of a render path other tests
    // exercise for unrelated reasons (same discipline every other
    // real-browser-only paint in this file already follows).
    if (typeof chainListEl.querySelectorAll !== 'function' ||
        typeof chainListEl.insertBefore !== 'function') {
      return;
    }
    Array.prototype.slice.call(chainListEl.querySelectorAll('.chain-arrow')).forEach(function (el) {
      if (typeof el.remove === 'function') {
        el.remove();
      }
    });
    // The connectors follow the ROW AS LAID OUT, which during a drag is
    // not the same list as "every .node-card": a ghost slot is a position
    // in the row and earns its arrows, while the held card is lifted out
    // of flow and must not. Read children (not a selector) so both
    // element kinds come back in one pass, in document order.
    var slotEls = Array.prototype.slice.call(chainListEl.children || []).filter(function (el) {
      if (!el.classList) {
        return false;
      }
      if (el.classList.contains('node-card-placeholder')) {
        return true;
      }
      return el.classList.contains('node-card') && !el.classList.contains('reorder-chosen');
    });
    slotEls.forEach(function (card, i) {
      if (i === 0) {
        return; // no arrow before the first slot
      }
      var arrow = document.createElement('span');
      arrow.className = 'chain-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      var mark = document.createElement('span');
      mark.className = 'chain-arrow-mark';
      mark.setAttribute('aria-hidden', 'true');
      arrow.appendChild(mark);
      chainListEl.insertBefore(arrow, card);
    });
  }

  renderChainArrows();
  renderSignalOrderStrip(); // initial "Mic in -> Safe out" before any load

  // ---------------------------------------------------------------------
  // DISPLAY REGISTER (redesign item 1, Single Face Chassis) — the
  // dot-matrix line etched along the canvas panel's TOP EDGE: one
  // accent-marked machine line ("MODULE · PARAM · VALUE", displayScale
  // honored, tabular numerals) plus the param's plain-language help line
  // beneath it. Built HERE (canvas.js owns the panel chrome; same
  // JS-built pattern as the OUT footer mirror in src/meters.js) as the
  // panel's FIRST child, before the scrolling .canvas.
  //
  // Discipline:
  //   - PURELY VISUAL REDUNDANCY: aria-hidden — every semantic (name,
  //     value, description) stays on the control itself, so assistive
  //     tech never hears the register double-announce.
  //   - NEVER PUMPS LAYOUT: fixed height, single-line clipping (CSS).
  //   - AT REST it carries the ENGINE STATE (boot: "ENGINE · STOPPED";
  //     live: "ENGINE · LIVE · N MODULES"). Once an operator touches a
  //     control it shows THAT control's exact value and KEEPS it (the
  //     groovebox rule: the display answers the last encoder you held)
  //     until another control is touched — engine-state lines only
  //     re-assert through onEngineStarted, which by construction cannot
  //     happen after a touch (the panel is pointer-locked pre-Start).
  //   - FED BY src/param-controls.js through window.CanvasRegister
  //     .showParam() on commit / focus / external agent write, and by
  //     this file's state lines. The help copy is passed THROUGH from
  //     param-controls' PLAIN_LANGUAGE_HELP map — never duplicated here.
  // Guarded like everything panel-level: a harness without
  // document.querySelector (the committed tests) skips the register and
  // param-controls' guarded feed calls no-op.
  // ---------------------------------------------------------------------
  var registerEl = null;
  var registerModuleEl = null;
  var registerParamEl = null;
  var registerValueEl = null;
  var registerHelpEl = null;

  function buildDisplayRegister() {
    if (typeof document.querySelector !== 'function' ||
        typeof document.createElement !== 'function') {
      return;
    }
    var panel = document.querySelector('.canvas-panel');
    if (!panel || !panel.insertBefore) {
      return;
    }

    registerEl = document.createElement('div');
    registerEl.className = 'display-register';
    registerEl.setAttribute('aria-hidden', 'true');

    var main = document.createElement('div');
    main.className = 'register-main';

    var mark = document.createElement('span');
    mark.className = 'register-mark';
    registerModuleEl = document.createElement('span');
    registerModuleEl.className = 'register-module';
    registerParamEl = document.createElement('span');
    registerParamEl.className = 'register-param';
    registerValueEl = document.createElement('span');
    registerValueEl.className = 'register-value';
    main.appendChild(mark);
    main.appendChild(registerModuleEl);
    main.appendChild(registerParamEl);
    main.appendChild(registerValueEl);

    registerHelpEl = document.createElement('div');
    registerHelpEl.className = 'register-help';

    registerEl.appendChild(main);
    registerEl.appendChild(registerHelpEl);
    panel.insertBefore(registerEl, panel.firstChild);
  }

  function setRegisterText(module, param, value, help) {
    if (!registerEl) {
      return;
    }
    registerModuleEl.textContent = module;
    registerParamEl.textContent = param;
    registerValueEl.textContent = value;
    registerHelpEl.textContent = help;
  }

  function showRegisterParam(module, param, value, help) {
    // A touch WINS THE DISPLAY but does not OWN it (2026-09-01 user
    // direction: "we only favor hovers and don't retain the tooltip on
    // click"). Earlier this emptied the preview stack outright, so a
    // clicked knob's value stayed on the register after the pointer left
    // the card and sat over nothing — a tooltip pinned by a click, which
    // is exactly the behavior being removed. Leaving the stack intact
    // means the value shows while the pointer is still on the control
    // that produced it, and every mouseleave on the way out unwinds back
    // to what the register held before the hover began.
    //
    // A touch with NO hover under it (keyboard focus, an agent write)
    // finds an empty stack and simply stands until something else writes
    // — those paths have no pointer to leave, so nothing would ever
    // restore them.
    setRegisterText(module, param, value, help);
    // ONE blink marks the live control (the direction contract's palette
    // economy): retrigger the value segment's blink by dropping and
    // re-adding the class across a forced reflow. Guarded — under
    // prefers-reduced-motion the CSS keyframe never exists, and a
    // stripped harness has no offsetWidth to force.
    try {
      registerValueEl.classList.remove('register-blink');
      if (typeof registerValueEl.offsetWidth === 'number') {
        void registerValueEl.offsetWidth; // reflow so the animation restarts
      }
      registerValueEl.classList.add('register-blink');
    } catch (err) {
      /* animation-only */
    }
  }

  // Hover-preview round (2026-08-31 user direction, refined 2026-09-01):
  // hovering a node card shows a transient preview in the register — never
  // a committed touch, so it must revert to whatever the register showed
  // the instant before the hover, and must never disturb showRegisterParam's
  // own "keeps the last touched control's value" memory.
  //
  // Two nesting depths now exist on the SAME card: hovering anywhere on the
  // card that is NOT a param row (the rail, the drag handle, the fold/
  // remove buttons, plain card whitespace) shows the module's general
  // info; hovering a param row (the knob/pad/trim OR its label/value —
  // src/param-controls.js's own .param-row, entered via the CanvasRegister
  // bridge below) shows THAT control's current value instead, while the
  // pointer is over it. Because .param-row lives inside the card, both
  // handlers can be hovering at once — a single snapshot can only unwind
  // one level, so this is a STACK: each showRegisterPreview call pushes
  // whatever the register displayed a moment ago, each hideRegisterPreview
  // pops back to it. Leaving a knob while still over its card therefore
  // restores the card's OWN general-info preview, not the pre-hover state
  // two levels up — and leaving the card afterward pops that.
  //
  // HOVER OWNS THE REGISTER (2026-09-01 user direction). A touch
  // (showRegisterParam) writes over whatever the register currently
  // shows, but it does NOT take the stack away from the hover that is
  // still in progress — so leaving the control unwinds past the touched
  // value, and leaving the card unwinds back to rest. Nothing a pointer
  // can reach stays on the register once the pointer is over nothing.
  var registerPreviewStack = [];

  function showRegisterPreview(module, param, value, help) {
    if (!registerEl) {
      return;
    }
    registerPreviewStack.push({
      module: registerModuleEl.textContent,
      param: registerParamEl.textContent,
      value: registerValueEl.textContent,
      help: registerHelpEl.textContent
    });
    // Never showRegisterParam() here — this is a passive preview, not a
    // committed value; it must not blink.
    setRegisterText(module, param, value, help);
  }

  /** Unwind the WHOLE stack at once, back to whatever the register held
   *  before the outermost hover began. For the one case a mouseleave
   *  cannot cover: an element destroyed while the pointer is still over
   *  it (renderModel replaces every card) never fires its own leave, so
   *  its pushed preview would sit on the register forever. */
  function resetRegisterPreviews() {
    if (registerPreviewStack.length === 0) {
      return;
    }
    var base = registerPreviewStack[0];
    registerPreviewStack.length = 0;
    setRegisterText(base.module, base.param, base.value, base.help);
  }

  function hideRegisterPreview() {
    if (registerPreviewStack.length === 0) {
      // Either no preview was ever pushed here, or a real touch happened
      // while it was active (showRegisterParam already emptied the stack
      // and is now the truthful display) — nothing to restore, and
      // restoring would stomp that newer value.
      return;
    }
    var snap = registerPreviewStack.pop();
    setRegisterText(snap.module, snap.param, snap.value, snap.help);
  }

  buildDisplayRegister();

  /** Split-panel round (2026-09-01 user direction): Presets (left,
   *  width-axis) and Effects (under the board, height-axis) are two
   *  SEPARATE, independently collapsible panels now — the Guided
   *  Patchbay-era shared Effects/Presets tab bar is retired along with it
   *  (nothing switches visibility between them anymore, so there is
   *  nothing left for role="tab"/role="tabpanel" to describe honestly;
   *  each panel's disclosure toggle uses the same aria-expanded +
   *  aria-controls pattern .node-collapse already uses for a per-card
   *  fold). Collapsing is purely visual — CSS-only
   *  (.presets-panel.collapsed .presets-panel-content{display:none}, the
   *  .effects-panel twin — see styles/main.css's own @media block) — this
   *  function never touches any other element's `hidden` attribute.
   *
   *  @param {HTMLElement} panelEl
   *  @param {HTMLElement} toggleEl
   *  @param {boolean} collapsed
   *  @param {string} expandedLabel
   *  @param {string} collapsedLabel
   */
  function setPanelCollapsed(panelEl, toggleEl, collapsed, expandedLabel, collapsedLabel) {
    if (panelEl.classList.contains('collapsed') === collapsed) {
      return; // already in the requested state — no-op, no focus churn
    }
    if (collapsed) {
      // Collapsing hides the panel's content via CSS; a focused control
      // inside it would otherwise silently drop focus to <body> (browsers
      // do not auto-recover focus from a display:none ancestor) — rescue
      // it onto the toggle, which stays visible and interactive either way.
      var active = document.activeElement;
      if (active && panelEl.contains(active) && active !== toggleEl &&
          typeof toggleEl.focus === 'function') {
        toggleEl.focus();
      }
      panelEl.classList.add('collapsed');
    } else {
      panelEl.classList.remove('collapsed');
    }
    toggleEl.setAttribute('aria-expanded', String(!collapsed));
    toggleEl.setAttribute('aria-label', collapsed ? collapsedLabel : expandedLabel);
  }

  /** Wires one panel's own toggle button. Pre-Start, both panels
   *  (toggles included) are already fully inert via the shared
   *  engine-not-started gate (pointer-events: none + the hatch overlay),
   *  so no extra guard is needed here. Guarded like every other
   *  panel-level init: a harness missing either element simply has
   *  nothing to wire.
   *
   *  @param {string} panelId
   *  @param {string} toggleId
   *  @param {string} expandedLabel
   *  @param {string} collapsedLabel
   */
  function initPanelCollapse(panelId, toggleId, expandedLabel, collapsedLabel) {
    var panelEl = document.getElementById(panelId);
    var toggleEl = document.getElementById(toggleId);
    if (!panelEl || !toggleEl) {
      return;
    }
    toggleEl.addEventListener('click', function () {
      setPanelCollapsed(panelEl, toggleEl, !panelEl.classList.contains('collapsed'), expandedLabel, collapsedLabel);
    });
  }
  initPanelCollapse('presets-panel', 'presets-collapse-toggle', 'Collapse Presets panel', 'Expand Presets panel');
  initPanelCollapse('effects-panel', 'effects-collapse-toggle', 'Collapse Effects panel', 'Expand Effects panel');


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

  /** The signal-order strip: one readable line, "Mic in -> each section
   *  in DOM order -> Safe out", with a terminal limiter marked locked.
   *  Purely presentational (aria-hidden — every semantic already lives on
   *  the board's own cards); reads chainModel via domCardIds()/nodesById
   *  so it can never drift from what's actually on screen. Called from
   *  renderModel() alongside renderChainArrows() — the one place
   *  ChainEditing repaints an accepted model, so the strip updates on
   *  every source (human/agent/preset/startup/undo), not just a human
   *  commit. */
  function effectLabel(type) {
    return window.EffectCatalog.getLabel(type) || type;
  }

  function renderSignalOrderStrip() {
    if (!signalOrderEl) {
      return;
    }
    signalOrderEl.textContent = '';
    signalOrderEl.setAttribute('aria-hidden', 'true');

    function addStep(text, cls) {
      var span = document.createElement('span');
      if (cls) {
        span.className = cls;
      }
      span.textContent = text;
      signalOrderEl.appendChild(span);
    }
    function addArrow() {
      var arrow = document.createElement('b');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      signalOrderEl.appendChild(arrow);
    }

    addStep('Mic in');
    var ids = domCardIds();
    ids.forEach(function (id, index) {
      addArrow();
      var node = nodesById[id];
      var type = node && node.type;
      var label = effectLabel(type);
      var isTerminalLimiter = type === 'limiter' && index === ids.length - 1;
      var stateLabel = label + (node && node.bypassed ? ' · bypassed' : '');
      addStep(isTerminalLimiter ? stateLabel + ' · locked last' : stateLabel,
        isTerminalLimiter ? 'signal-order-lock' : null);
    });
    addArrow();
    addStep('Safe out', 'signal-order-safe');
  }

  // ---------------------------------------------------------------------
  // Palette (Part B) — one chip per EffectCatalog.getAllTypes() entry, built
  // once at load time. Populated dynamically, never a hardcoded type list:
  // as AE-6 through AE-10 each register a new type (same one-call pattern
  // AE-5's src/node-gain.js already uses), this loop picks them up
  // automatically the next time the page loads.
  // ---------------------------------------------------------------------

  // VIS-3 silkscreen initials (rq5 redundant encoding): every family chip
  // carries its 3-letter code alongside the family color, so color is
  // never the only signal. 2026-08-31 (user direction): the code is the
  // first three letters of the module's DISPLAY label, uppercased —
  // derived from the catalog's label (single source, no hardcoded map:
  // a future type codes itself), spaces skipped so "Noise Gate" reads
  // NOI. VIS-4: familyInitials() is the single shared source for BOTH
  // surfaces — palette chips (VIS-3) and node cards (VIS-4) render from
  // the same lookup, so the two can never drift apart.

  /**
   * VIS-4: the one shared family-initials lookup (single source — never
   * duplicated elsewhere). Used by renderPalette() for palette chips and
   * createNodeCard() for node cards. The code is the first three LETTERS
   * of the module's display label, uppercased (spaces and punctuation
   * skipped); a type with no label falls back to its own type key — the
   * same no-hardcoded-type-list discipline as renderPalette()'s
   * catalog-driven loop.
   *
   * @param {string} type
   * @returns {string} 3-letter silkscreen code (GAIN, COM, DEL, NOI...)
   */
  function familyInitials(type) {
    var label = effectLabel(type);
    return String(label).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || String(type).slice(0, 3).toUpperCase();
  }

  /**
   * Discrete-enum canonicalization (2026-08-31 honesty round): a param
   * whose registered spec declares `values` (autotune key/scale) accepts
   * BOTH wire forms — the UI strings and the raw 0..N enums preset-schema
   * blesses — but the MODEL, the visible pads, and the autosave carry one
   * truth: the canonical string. A numeric enum that slipped through (an
   * agent write, a hand-edited payload) would otherwise update the model
   * and the audio while the visible pad sat on the old value — the pad
   * can only match strings. Numbers map by index; every other value (and
   * every non-discrete param) passes through untouched, so validation
   * behavior elsewhere is unchanged.
   *
   * @param {string} type
   * @param {string} paramId
   * @param {*} value
   * @returns {*} the canonical value (the matching string for a legal
   *   numeric enum; the input otherwise).
   */
  function canonicalParamValue(type, paramId, value) {
    try {
      if (window.EffectCatalog && typeof window.EffectCatalog.getParamSpec === 'function') {
        var specs = window.EffectCatalog.getParamSpec(type);
        if (specs) {
          for (var i = 0; i < specs.length; i++) {
            var spec = specs[i];
            if (spec && spec.id === paramId && Array.isArray(spec.values) &&
                typeof value === 'number' && isFinite(value) &&
                Math.floor(value) === value &&
                value >= 0 && value <= spec.values.length - 1) {
              return spec.values[value];
            }
          }
        }
      }
    } catch (err) {
      /* stripped harness — the raw value passes through */
    }
    return value;
  }

  /** canonicalParamValue over a whole params object (fresh copy). */
  function canonicalParams(type, params) {
    var out = {};
    Object.keys(params || {}).forEach(function (key) {
      out[key] = canonicalParamValue(type, key, params[key]);
    });
    return out;
  }

  // ---------------------------------------------------------------------
  // PALETTE GROUPS (refinement entry 3, critique P2-3: the palette went
  // 6 → 10 flat chips with no chunking at the add-a-node decision point;
  // re-categorized 2026-09-01, user direction, once the catalog grew to
  // 14 with the Tone.js effects — see the group-count note below).
  // Presentation seam ONLY — the catalog stays the single source of what
  // renders (renderPalette still iterates getAllTypes()); these lookups
  // only decide which silkscreen group header a chip rides under, in
  // operator (non-engineer) language derived from README.md's own
  // framing. Chips stay DIRECT children of #palette-list (flat DOM order
  // preserved: R2-2 button semantics, tab order, and the SortableJS drag
  // items are untouched); the headers are non-interactive <h3> legends
  // interleaved between groups, never containers.
  //
  // 2026-09-01 re-categorization: the original three groups (shape/
  // polish/safe) held 10 types comfortably at 4/4/2, but the four Tone.js
  // additions (pitch shift, tremolo, bitcrusher, phaser) had no group
  // mapping at all and fell through to the trailing "More effects"
  // catch-all — exactly the undifferentiated dead-end the fallback group
  // exists to make VISIBLE rather than silently mis-file, per the
  // discipline below. Folding all four into "shape" would have made it
  // an 8-chip wall while the other groups stayed small — worse
  // scannability than the flat-10 problem this grouping originally
  // fixed. Splitting shape's own character-effects premise in two reads
  // better AND matches a real, pre-existing distinction: "shape" is now
  // strictly TONE/TIMBRE (EQ, Distortion, Bitcrusher — what the voice is
  // made of), a new "movement" group is MODULATION (Chorus, Tremolo,
  // Phaser — literally the standard "modulation" pedal/plugin category:
  // an LFO wobbling pitch, amplitude, or a filter sweep), and a new
  // "pitch" group is the PITCH domain specifically (Autotune, Pitch
  // Shift — correcting vs. transposing). Five groups of 2-4 chips each,
  // none of them a dumping ground.
  // ---------------------------------------------------------------------
  var PALETTE_GROUPS = [
    { id: 'shape', label: 'Shape your voice' },
    { id: 'movement', label: 'Add movement' },
    { id: 'pitch', label: 'Change your pitch' },
    { id: 'polish', label: 'Polish your sound' },
    { id: 'safe', label: 'Keep it safe' }
  ];

  var PALETTE_FALLBACK_GROUP = { id: 'more', label: 'More effects' };

  var PALETTE_TYPE_GROUP = {
    // Shape your voice — the voice's own TONE/TIMBRE (README: distortion
    // "adds grit and edge", bitcrusher is lo-fi digital grunge; EQ shapes
    // tone directly). What the voice is made of, not how it moves.
    eq: 'shape',
    distortion: 'shape',
    bitcrusher: 'shape',
    // Add movement — modulation effects: an LFO wobbling pitch (chorus:
    // "thickens and widens the voice with two drifting copies"),
    // amplitude (tremolo: "volume wobble"), or a filter sweep (phaser:
    // "a sweeping, spacey filter sweep"). The standard modulation
    // grouping any pedalboard or DAW uses, not an invented one.
    chorus: 'movement',
    tremolo: 'movement',
    phaser: 'movement',
    // Change your pitch — the pitch domain specifically: correcting
    // (autotune: "pulls each note toward a key and scale you pick") vs.
    // transposing (pitch shift: "moves the whole voice up or down in
    // semitones"). Split out of "shape" — pitch tools answer a different
    // question than tone tools do.
    autotune: 'pitch',
    pitchshift: 'pitch',
    // Polish your sound — level, evenness, and space.
    gain: 'polish',
    compressor: 'polish',
    delay: 'polish',
    reverb: 'polish',
    // Keep it safe — the automatic guards. Presentational grouping only:
    // the limiter chip is exactly the chip it always was (same button,
    // same aria-label, same enabled-after-Start gating, same human add
    // path); the terminal-limiter policy lives in addNodeType() /
    // mcp-tools.js and is deliberately untouched by this map.
    limiter: 'safe',
    gate: 'safe'
  };

  // ---------------------------------------------------------------------
  // Guided Patchbay round: the Effects tab's hover/focus preview line —
  // "what this does" in one short phrase, condensed from README.md's own
  // per-effect copy (never invented fresh, so the chip and the docs never
  // tell a different story). Purely presentational, read by
  // paletteTypePreview() below with the same no-silent-drop discipline as
  // paletteGroupLabel(): an unmapped future type gets a generic line
  // instead of rendering blank.
  // ---------------------------------------------------------------------
  var PALETTE_TYPE_PREVIEW = {
    gain: 'A clean level trim for the whole chain.',
    compressor: 'Keeps the vocal at a steady, even level.',
    eq: 'Shapes tone — warmer, brighter, or more telephonic.',
    delay: 'Short echo repeats for depth without mush.',
    reverb: 'A sense of room, from close and dry to wide and wet.',
    limiter: 'The last line of defense on the output ceiling.',
    gate: 'Turns the mic down automatically between phrases.',
    distortion: 'Adds grit and edge — a turned-up-too-loud character.',
    chorus: 'Thickens and widens the voice with two drifting copies.',
    autotune: 'Pulls each note toward a key and scale you pick.',
    pitchshift: 'Moves the whole voice up or down in semitones.',
    tremolo: 'Volume wobble — amplitude dips and swells.',
    bitcrusher: 'Lo-fi digital grunge — fewer bits, more crunch.',
    phaser: 'A sweeping, spacey filter sweep.'
  };
  var PALETTE_PREVIEW_FALLBACK = 'Adds this effect to the chain.';

  /**
   * The Effects tab chip's hover/focus preview line. Same defensive
   * register as paletteGroupLabel()/familyInitials(): a type this map
   * hasn't caught up with yet gets a generic line, never a blank one.
   * @param {string} type
   * @returns {string}
   */
  function paletteTypePreview(type) {
    return Object.prototype.hasOwnProperty.call(PALETTE_TYPE_PREVIEW, type) ?
      PALETTE_TYPE_PREVIEW[type] : PALETTE_PREVIEW_FALLBACK;
  }

  /**
   * Which palette group does this type ride under? (Data source for
   * renderPalette's interleaved headers.) Unmapped types fall back to
   * the trailing catch-all group so a future registration always
   * renders — same no-silent-drop discipline as familyInitials().
   * @param {string} type
   * @returns {string} group id
   */
  function paletteGroupId(type) {
    return PALETTE_TYPE_GROUP[type] || PALETTE_FALLBACK_GROUP.id;
  }

  /**
   * The display label for a group id (PALETTE_GROUPS first, then the
   * fallback group — never throws.
   * @param {string} id
   * @returns {string}
   */
  function paletteGroupLabel(id) {
    for (var i = 0; i < PALETTE_GROUPS.length; i++) {
      if (PALETTE_GROUPS[i].id === id) {
        return PALETTE_GROUPS[i].label;
      }
    }
    return PALETTE_FALLBACK_GROUP.label;
  }

  // ---------------------------------------------------------------------
  // EXPERIMENTAL TYPES (cycle 3) — the experimental status is declared by
  // the type's own EffectCatalog registration (`experimental: true` in
  // node-autotune.js, autotune only, per the cycle-3 scope "experimental
  // badge on autotune only") and read through EffectCatalog.isExperimental():
  // one source of truth shared with mcp-tools.js's agent capabilities readout
  // (MCP-1), so the visible badge and the agent-facing disclosure cannot drift.
  // ---------------------------------------------------------------------
  /**
   * Does this type render the experimental badge? (Data source for both
   * the card badge and the chip badge/aria status below.)
   * @param {string} type
   * @returns {boolean}
   */
  function isExperimentalType(type) {
    return window.EffectCatalog.isExperimental(type);
  }

  /**
   * UI-2 (cycle 3): the formal experimental-badge component — one factory,
   * two surfaces in the industrial label system:
   *   - the NODE CARD: a full 'Experimental' silkscreen tag placed after
   *     the module label inside the drag handle (same slot AT-1's minimal
   *     hook used);
   *   - the PALETTE CHIP: a compact 'EXP' abbreviation at chip density
   *     (styles/main.css scopes the size variant to .node-chip context).
   * Not a control: no focus, no pointer affordance — a status tag, so it
   * is a <span>, never a button. Screen-reader access is by CONTENT, not
   * title-only: on the card the badge's text sits in the header flow and
   * is announced with the module name; on the chip the status is part of
   * the chip's aria-label (renderPalette), so it is heard BEFORE the node
   * is added. The title carries the why for sighted hover, as a bonus.
   *
   * @param {string} type - the node type (for the title's label).
   * @param {boolean} compact - chip variant ('EXP') vs card ('Experimental').
   * @returns {HTMLElement} the badge span.
   */
  function createExperimentalBadge(type, compact) {
    var badge = document.createElement('span');
    badge.className = 'node-experimental-badge';
    badge.textContent = compact ? 'EXP' : 'Experimental';
    badge.title = effectLabel(type) +
      ' is experimental — new DSP, still under audio-quality review.';
    return badge;
  }

  function renderPalette() {
    paletteListEl.innerHTML = '';
    var types = window.EffectCatalog.getAllTypes();

    // Refinement entry 3 (critique P2-3): bucket the catalog's types by
    // group, preserving REGISTRATION ORDER within each bucket (the
    // catalog stays the source of chip order; the group map only decides
    // which header a chip rides under). Group order is the declared
    // PALETTE_GROUPS order, with the fallback group appended last and
    // rendered only if some type actually fell into it — an empty group
    // never renders a header.
    var buckets = {};
    var groupOrder = PALETTE_GROUPS.map(function (g) { return g.id; });
    types.forEach(function (type) {
      var groupId = paletteGroupId(type);
      if (!buckets[groupId]) {
        buckets[groupId] = [];
        if (groupOrder.indexOf(groupId) === -1) {
          groupOrder.push(groupId);
        }
      }
      buckets[groupId].push(type);
    });

    groupOrder.forEach(function (groupId) {
      var groupTypes = buckets[groupId];
      if (!groupTypes || groupTypes.length === 0) {
        return;
      }

      // The silkscreen group header — a real <h3> (h1 app title → h2
      // Palette → h3 groups: a navigable heading outline for screen
      // readers, the flat-list twin of the preset select's optgroup
      // legends). NON-interactive by construction: no listener, no
      // focus, no pointer affordance — grouping is visual/SR context
      // only. Interleaved as a sibling BEFORE its chips so reading
      // order and tab order both stay exactly chip-button flow.
      var header = document.createElement('h3');
      header.className = 'palette-group-label';
      header.setAttribute('data-group', groupId);
      header.textContent = paletteGroupLabel(groupId);
      paletteListEl.appendChild(header);

      groupTypes.forEach(function (type) {
        // R2-2 (a11y critique P2): the chip is a real <button>, not a div —
        // tab-focusable in DOM order (palette before canvas), Enter/Space
        // activates addNodeType() below, and the screen reader gets an
        // action-phrase accessible name ("Add Reverb to chain") while the
        // visible silkscreen label stays exactly as designed. SortableJS's
        // drag wiring is element-agnostic (forceFallback on), so converting
        // div→button does not touch the drag path.
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'node-chip';
        chip.setAttribute('data-node-type', type);
        // VIS-3: family edge-coding hooks — data-family maps the chip's
        // legend square to its --family-* token in styles/main.css;
        // data-initials is that square's silkscreen text (rendered via CSS
        // attr(data-initials), never a second copy in the DOM text).
        chip.setAttribute('data-family', type);
        chip.setAttribute('data-initials', familyInitials(type));
        chip.textContent = effectLabel(type);
        // R2-2 action-phrase name; UI-2 (cycle 3): an experimental type
        // appends its status, so a screen-reader user hears it BEFORE the
        // node enters the chain (the chip's visible 'EXP' tag is the
        // sighted twin of this suffix — see createExperimentalBadge).
        chip.setAttribute(
          'aria-label',
          'Add ' + effectLabel(type) + ' to chain' +
            (isExperimentalType(type) ? ' (experimental)' : ''));
        // UI-2: the chip-side experimental badge (autotune only) — compact
        // 'EXP' silkscreen abbreviation after the visible label, same single
        // data source and factory as the card's full tag.
        if (isExperimentalType(type)) {
          chip.appendChild(createExperimentalBadge(type, true));
        }
        // Guided Patchbay round: the hover/focus preview line — revealed
        // by CSS only (:hover/:focus-visible, styles/main.css), so a
        // sighted user previews "what this does" before adding it.
        // aria-hidden: the chip's aria-label already carries the full
        // accessible name; this is a sighted-only convenience, not a
        // second announcement.
        var preview = document.createElement('span');
        preview.className = 'chip-preview';
        preview.setAttribute('aria-hidden', 'true');
        preview.textContent = paletteTypePreview(type);
        chip.appendChild(preview);
        // Gating: chips ship DISABLED, mirroring the Start/Bypass
        // disabled-until-start pattern (the .engine-not-started panel gate
        // is pointer-events:none, which says nothing to a keyboard or a
        // screen reader — a focusable inert chip would be a focus trap of
        // nothing-doing). A real disabled attribute removes the chip from
        // the tab order and announces "unavailable" honestly;
        // onEngineStarted() (below) enables them at the exact transition
        // where dragging also unlocks. Note the #4 lifecycle-loss path
        // deliberately does NOT re-gate the flanks (main.js's surfaceLoss
        // leaves the panels un-dimmed; only Start/Bypass flip), so chips
        // stay enabled after a loss — matching what the region already
        // does today.
        chip.disabled = true;
        chip.addEventListener('click', function () {
          // A disabled <button> never fires click, so this handler is only
          // ever reachable post-Start — the same guarantee the pointer
          // path gets from the pointer-events:none panel gate.
          if (suppressChipClick) {
            // This "click" is the tail of a completed chip DRAG that
            // happened to release back over its own chip; the drop
            // already placed (or deliberately did not place) the module.
            suppressChipClick = false;
            return;
          }
          addNodeType(type);
        });
        // ...and the same chip is the handle for the placement-aware DRAG
        // add (see the PALETTE DRAG block above). Arming only: the
        // gesture resolves on the document-level handlers, and a
        // sub-threshold press-release falls through to the click above
        // with nothing armed. Deliberately does NOT preventDefault — the
        // chip is a real <button> and must still take focus on press;
        // text selection is handled by body.chain-dragging instead.
        chip.addEventListener('pointerdown', function (event) {
          armPaletteDrag(chip, type, event);
        });
        paletteListEl.appendChild(chip);
      });
    });
  }

  // R2-2: default params for a freshly-added node of `type` — the exact
  // object the SortableJS onAdd handler mints, factored out so the
  // keyboard add path and the drag add path CANNOT drift apart.
  function defaultParamsForType(type) {
    var paramSpec = window.EffectCatalog.getParamSpec(type);
    var defaultParams = {};
    paramSpec.forEach(function (spec) {
      defaultParams[spec.id] = spec.default;
    });
    return defaultParams;
  }

  /**
   * R2-2: keyboard-activation add path — the button-semantics twin of a
   * palette drag-drop. Placement policy: a HUMAN adding a node by keyboard
   * behaves like the human drag it is — append to the END of the chain,
   * except a terminal limiter must stay terminal (the default preset's
   * safe-output invariant), so the card is inserted immediately BEFORE a
   * limiter that currently occupies the last position. With no terminal
   * limiter (or an empty chain) it appends at the end. Commits through
   * commitStructuralChange() — the SAME ChainEditing adapter the cord and
   * removal gestures use — so graph acceptance, autosave (PS-2), the
   * unsaved dot (PS-3), and the human-edit revision bump (Issue #6) stay
   * one transaction. No agent toast class: this is a human action.
   *
   * @param {string} type - the node type to add (from the chip's
   *   data-node-type, itself from the catalog-driven palette loop).
   */
  function addNodeType(type) {
    var cards = chainListEl.querySelectorAll('.node-card');
    var lastCard = cards.length > 0 ? cards[cards.length - 1] : null;
    // Keep the terminal limiter terminal: seat just before it, else
    // append. The same rule the DRAG add reaches through
    // clampBehindTerminalLimiter(), so the two verbs cannot disagree
    // about where the end of the chain is.
    var ref = lastCard && lastCard.getAttribute('data-family') === 'limiter' ?
      lastCard : null;
    seatNewNode(type, ref);
    commitStructuralChange();
  }

  /** Build a card for `type` at its catalog defaults and seat it in the
   *  row immediately before `refEl` (append when null), painting its own
   *  width. Shared by the palette CLICK add and the palette DRAG add so
   *  the two verbs cannot drift. Does NOT commit — the caller owns the
   *  single commitStructuralChange() its gesture is allowed.
   *
   *  @param {string} type
   *  @param {HTMLElement|null} refEl
   *  @returns {HTMLElement}
   */
  function seatNewNode(type, refEl) {
    var card = createNodeCard(type, defaultParamsForType(type));
    if (refEl && typeof chainListEl.insertBefore === 'function') {
      chainListEl.insertBefore(card, refEl);
    } else {
      chainListEl.appendChild(card);
    }
    applyCardWidth(card, card.getAttribute('data-node-id'));
    return card;
  }

  // ---------------------------------------------------------------------
  // DRAG AN EFFECT IN FROM THE PALETTE (2026-09-01 user direction: "I
  // expect to be able to drag and drop a plugin to a specific position in
  // the chain, or if you click to add it it will snap at the end before
  // the limiter"). The CLICK verb is addNodeType() above, unchanged and
  // still the keyboard-equivalent add; this is its placement-aware twin.
  //
  // It reuses the reorder gesture's ENTIRE vocabulary rather than
  // inventing a second one: the same ghost, the same slot snapshot, the
  // same safe-output clamp, the same body flag, the same "audio changes
  // only on a completed drop, through commitStructuralChange()" rule. The
  // only thing it adds is a DROP ZONE. A chip dragged anywhere off the
  // board is not an add: the ghost opens only while the pointer is over
  // #chain-canvas, and a release with no ghost showing commits nothing —
  // so a chip pulled sideways inside the Effects panel, or dropped on the
  // presets rail, quietly does nothing instead of silently appending a
  // module the operator never aimed at the chain.
  // ---------------------------------------------------------------------

  // Firmer than a section's 4px: unlike the board, a chip keeps a real
  // CLICK verb on the very same pixels, so the pull has to be unambiguous
  // before it stops being a click.
  var PALETTE_DRAG_THRESHOLD = 6;

  // A completed chip drag ends with a pointerup that, when it lands back
  // on the chip it started from, would ALSO fire that chip's click — and
  // add the module a second time. Set on detach, spent by the next click.
  var suppressChipClick = false;

  function pointerOverBoard(cx, cy) {
    if (!boardEl || typeof boardEl.getBoundingClientRect !== 'function') {
      return false;
    }
    var r = boardEl.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  /** The ghost's box for an effect that has no card yet: the default card
   *  width, and the height of the row it is joining (the tallest card, so
   *  the reservation reads as a real slot rather than a sliver). */
  function incomingGhostBox() {
    var h = 0;
    Array.prototype.forEach.call(
      chainListEl.querySelectorAll('.node-card'),
      function (el) {
        if (typeof el.getBoundingClientRect === 'function') {
          h = Math.max(h, el.getBoundingClientRect().height);
        }
      }
    );
    return { w: CARD_W_DEFAULT_PX, h: h };
  }

  /** The dragged chip's own image, following the pointer — the palette's
   *  equivalent of the reorder gesture's lifted card. Purely decorative
   *  (aria-hidden, pointer-inert, disabled): the real chip stays in the
   *  panel, dimmed, so the palette never develops a hole mid-drag. */
  function makeChipTrail(chip, rect) {
    if (!chip || typeof chip.cloneNode !== 'function' || !rect ||
        !document.body || typeof document.body.appendChild !== 'function') {
      return null;
    }
    var trail = chip.cloneNode(true);
    trail.disabled = true;
    trail.setAttribute('aria-hidden', 'true');
    trail.setAttribute('tabindex', '-1');
    if (trail.classList) {
      trail.classList.add('chip-trail');
    }
    if (trail.style) {
      trail.style.position = 'fixed';
      trail.style.left = rect.left + 'px';
      trail.style.top = rect.top + 'px';
      trail.style.width = rect.width + 'px';
      trail.style.margin = '0';
    }
    document.body.appendChild(trail);
    return trail;
  }

  function armPaletteDrag(chip, type, event) {
    if (reorderDrag || resizeDrag || paletteDrag) {
      return; // one gesture at a time
    }
    if (chip && chip.disabled) {
      return; // pre-Start: the chip has no add verb to drag either
    }
    if (event && typeof event.button === 'number' && event.button !== 0) {
      return; // primary pointer only
    }
    suppressChipClick = false;
    dragActive = true;
    paletteDrag = {
      chip: chip,
      type: type,
      startX: event && typeof event.clientX === 'number' ? event.clientX : 0,
      startY: event && typeof event.clientY === 'number' ? event.clientY : 0,
      pointerId: event && event.pointerId !== undefined ? event.pointerId : null,
      detached: false,
      mids: [],
      ghost: null,
      slotIndex: -1,
      rect: null,
      trail: null
    };
  }

  function detachPaletteDrag(drag) {
    drag.detached = true;
    // A chip drag can never be a chip click as well.
    suppressChipClick = true;
    var chip = drag.chip;
    drag.rect = chip && typeof chip.getBoundingClientRect === 'function' ?
      chip.getBoundingClientRect() : null;
    // No card is leaving the row, so every card is a slot boundary.
    drag.mids = slotMidpoints(domCardIds());
    drag.trail = makeChipTrail(chip, drag.rect);
    if (chip && chip.classList) {
      chip.classList.add('chip-dragging');
    }
    capturePointer(paletteListEl, drag.pointerId);
    setBodyDragging(true);
  }

  function onPalettePointerMove(event) {
    if (!paletteDrag) {
      return;
    }
    var drag = paletteDrag;
    var cx = event && typeof event.clientX === 'number' ? event.clientX : drag.startX;
    var cy = event && typeof event.clientY === 'number' ? event.clientY : drag.startY;
    if (!drag.detached) {
      var dx0 = cx - drag.startX;
      var dy0 = cy - drag.startY;
      if (Math.sqrt(dx0 * dx0 + dy0 * dy0) < PALETTE_DRAG_THRESHOLD) {
        return; // still a click, not yet a drag
      }
      detachPaletteDrag(drag);
    }
    if (drag.trail && drag.trail.style) {
      drag.trail.style.transform =
        'translate(' + (cx - drag.startX) + 'px, ' + (cy - drag.startY) + 'px)';
    }
    if (!pointerOverBoard(cx, cy)) {
      // Off the board: withdraw the reservation. The gesture stays live
      // (the operator can still swing back onto the row) but a release
      // from here adds nothing.
      if (drag.ghost) {
        removeGhost(drag);
        renderChainArrows();
      }
      return;
    }
    if (!drag.ghost) {
      var box = incomingGhostBox();
      drag.ghost = makeGhost(box.w, box.h, effectLabel(drag.type));
      drag.slotIndex = -1;
    }
    moveGhostTo(drag, clampBehindTerminalLimiter(drag.mids, slotIndexAt(drag.mids, cx)));
  }

  function endPaletteVisuals(drag) {
    if (drag.trail && typeof drag.trail.remove === 'function') {
      drag.trail.remove();
    }
    drag.trail = null;
    if (drag.chip && drag.chip.classList) {
      drag.chip.classList.remove('chip-dragging');
    }
    releasePointer(paletteListEl, drag.pointerId);
    setBodyDragging(false);
  }

  function onPalettePointerEnd() {
    if (!paletteDrag) {
      return;
    }
    var drag = paletteDrag;
    paletteDrag = null;
    dragActive = false;
    if (!drag.detached) {
      return; // sub-threshold: this was a click, and the click add owns it
    }
    endPaletteVisuals(drag);
    var ghost = drag.ghost;
    // The ghost NAMES the drop slot: seat the new module exactly where it
    // stands (before it, then retire it — the same handoff the reorder
    // drop uses), and only then commit.
    var seated = ghost && ghost.parentNode ? seatNewNode(drag.type, ghost) : null;
    removeGhost(drag);
    renderChainArrows();
    if (!seated) {
      return; // released off the board: no reservation, no add
    }
    commitStructuralChange();
  }

  function cancelPaletteDrag() {
    if (!paletteDrag) {
      return;
    }
    var drag = paletteDrag;
    paletteDrag = null;
    dragActive = false;
    if (!drag.detached) {
      return;
    }
    endPaletteVisuals(drag);
    removeGhost(drag);
    renderChainArrows();
  }

  /**
   * R2-2 factoring: the SINGLE human structural adapter. It translates the
   * provisional DOM gesture into a candidate, restores the accepted render,
   * and submits the candidate to ChainEditing. Keyboard add, drag reorder,
   * and removal are therefore indistinguishable downstream.
   */
  function commitStructuralChange() {
    recomputeModelFromDom();
    updateEmptyHint();
    renderChainArrows(); // an add (or any order change) redraws the connectors
    // NOTE: this function's own line below synchronously renders the DOM
    // BACK to the last-accepted state before submitting the new
    // candidate — a caller that needs to act on the eventual ACCEPTED
    // render (e.g. onReorderKeyboardMove's focus restoration) must chain
    // onto the returned promise, never read the DOM synchronously right
    // after calling this function: the DOM at that point is still the
    // OLD state, one render away from the new one.
    // Issue #20: in the production page, the gesture stops here. The
    // ChainEditing module decides whether the candidate is accepted and
    // owns graph commit, persistence, preset dirtiness, and the one human
    // revision bump. The DOM is provisional until that promise settles;
    // ChainEditing renders the accepted candidate on success and restores
    // the previous accepted model on failure.
    var editing = requireChainEditing();
    var candidateModel = getCurrentModel();
    var candidateLayout = currentLayout();
    // The gesture may have provisionally reordered/added/removed DOM in
    // order to express its candidate. Put the last accepted render back
    // synchronously, before graph staging begins, so an operator never
    // sees a chain that has not yet become live.
    renderModel(
      editing.getModel(),
      typeof editing.getLayout === 'function' ? editing.getLayout() : null
    );
    return editing.apply({
      source: 'human',
      candidate: candidateModel,
      layout: candidateLayout,
      forceStructural: true
    }).catch(function (err) {
      console.error('ChainCanvas: human structural edit was not accepted', err);
    });
  }

  // ---------------------------------------------------------------------
  // Node card construction (Part C).
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // Node card construction (Part C) — redesigned item 1: the card is a
  // panel-print SECTION of the Single Face Chassis, not a floating card.
  // Class names from the card era SURVIVE on purpose (.node-card is the
  // SortableJS item, the agent-pulse target, the bypass-dim scope, and
  // the selector this file's own recompute/commit paths read), while the
  // inner anatomy is the locked rail + field structure:
  //
  //   .node-card[data-node-id][data-family][data-initials]
  //     .section-rail            <- the FAMILY PRINT BLOCK (left): grip
  //                                 zone, family code, module label, the
  //                                 experimental badge, and the section's
  //                                 header-zone controls (collapse +
  //                                 remove) at the rail's foot. The rail
  //                                 is the section's persistent header —
  //                                 it is exactly what remains visible
  //                                 when the section folds.
  //       .node-drag-handle      <- ONLY this drives SortableJS's
  //                                 `handle: '.node-drag-handle'` (the
  //                                 explicit GRIP ZONE the locked card's
  //                                 risk line demands — knobs, pads,
  //                                 chevron and × can never start a drag).
  //         .node-drag-icon      <- CSS-drawn grip dots (aria-hidden).
  //       .section-code          <- the 2-letter family silkscreen code
  //                               (title = the full module name).
  //       .section-foot          <- per-effect bypass, collapse chevron,
  //                                 and remove × (real
  //                                 buttons, the section's header-zone
  //                                 parts; siblings of the handle, never
  //                                 nested in it).
  //     .section-main            <- the ENCODER FIELD (right).
  //       .node-params           <- the 0fr collapsible boundary.
  //         .node-params-inner   <- wrap-AFTER-render: rows ParamControls
  //                                 rendered are moved here in one pass.
  //
  // Machined grooves between sections, the focus lift, and the folded
  // (collapsed) slim row are all CSS on this structure — see main.css's
  // Pattern Machine block.
  //
  // Collapse state is SESSION-ONLY and never persisted: a folded section
  // re-expands whenever the card element is rebuilt — agent/preset loads
  // through loadModel() replace every card, and a structural drag/remove
  // only touches other cards. Default is EXPANDED; reset-on-rebuild is
  // the accepted v1 behavior (per the 2026-08-28 amendment).
  //
  // @param {string} type
  // @param {Object} initialParams
  // @param {string} [explicitId] - when provided, use this exact id instead
  //   of minting a new one via nextNodeId(). Used by loadModel() (below) to
  //   restore a saved/preset model's ORIGINAL ids verbatim, rather than
  //   silently reassigning fresh ones on every reload.
  // @param {boolean} [initiallyBypassed] - true keeps the section in the
  //   chain while routing audio around its effect instance.
  // @returns {HTMLElement}
  // ---------------------------------------------------------------------
  function createNodeCard(type, initialParams, explicitId, initiallyBypassed) {
    var id = explicitId || nextNodeId();
    var nodeState = { id: id, type: type, params: Object.assign({}, initialParams || {}) };
    if (initiallyBypassed === true) {
      nodeState.bypassed = true;
    }
    nodesById[id] = nodeState;

    var card = document.createElement('div');
    card.className = 'node-card';
    card.setAttribute('data-node-id', id);
    // Family identity (VIS-4's data hooks, kept verbatim): data-family
    // maps the rail's family print (code + tick) to its --pm-family token
    // in styles/main.css; data-initials is that code's text source. Both
    // come from the same familyInitials() lookup the palette uses, so
    // section and palette legends share one vocabulary and can never
    // drift.
    card.setAttribute('data-family', type);
    card.setAttribute('data-initials', familyInitials(type));
    if (nodeState.bypassed === true) {
      card.classList.add('node-bypassed');
    }
    card.setAttribute('data-bypassed', nodeState.bypassed === true ? 'true' : 'false');

    // --- The family print block (left rail). ---------------------------
    var rail = document.createElement('div');
    rail.className = 'section-rail';

    var handle = document.createElement('span');
    handle.className = 'node-drag-handle';
    handle.title = 'Drag to reorder';
    // Keyboard equivalent (board redesign, 2026-09-01 — see
    // onReorderKeyboardMove): tabindex makes the grip reachable, and the
    // label states the mechanism directly since there is no simpler
    // standard role for "focus this, then hold a modifier+arrow to move
    // it" — a plain "button" role would promise a single-press activation
    // this control does not have.
    handle.setAttribute('tabindex', '0');
    handle.setAttribute('aria-label', 'Move ' + effectLabel(type) + ' — Alt+Left or Alt+Right reorders it in the chain');

    var gripIcon = document.createElement('span');
    gripIcon.className = 'node-drag-icon';
    gripIcon.setAttribute('aria-hidden', 'true');
    // The grip is DRAWN (CSS dot field in main.css), not a text glyph —
    // a Unicode glyph standing in for an icon is refused by the craft
    // floor, and the machined grip zone is exactly the kind of drawn
    // hardware mark the chassis world wants. No text content here.

    var code = document.createElement('span');
    code.className = 'section-code';
    code.setAttribute('aria-hidden', 'true');
    code.textContent = familyInitials(type);
    // 2026-08-31 (user direction): the header prints ONLY the 2-letter
    // family code — the full module name rides as the code's hover
    // tooltip. The section's accessible naming lives on its controls
    // (the collapse/remove buttons' aria-labels carry the module name).
    code.title = effectLabel(type);

    handle.appendChild(gripIcon);
    rail.appendChild(handle);
    rail.appendChild(code);

    // UI-2 (cycle 3): the formal experimental badge on the section of
    // every catalog-declared experimental type (autotune only, cycle-3 scope) —
    // a silkscreen tag in the rail under the module label. SR-visible by
    // content (see createExperimentalBadge); title carries the why.
    // Compact form (2026-09-01, width-floor fix): the rail badge used the
    // spelled-out 'Experimental' while the palette chip's own badge
    // already used the compact 'EXP' abbreviation — an inconsistency
    // between the two badge call sites, not a deliberate width choice.
    // The condensed header band has to fit this badge alongside the
    // family code and the rail's three footer buttons; the compact form
    // is the one that already matched the chip, so this is the fix, not
    // the width math.
    if (isExperimentalType(type)) {
      rail.appendChild(createExperimentalBadge(type, true));
    }

    // The header-zone controls at the rail's foot: the collapse chevron
    // and the remove ×. Real buttons (keyboard-operable for free,
    // announced by their aria-labels), siblings of the handle — never
    // nested inside it — so pressing them can never be mistaken for a
    // grip-zone press. Expanded, they sit at the rail's bottom edge
    // (margin-top:auto in CSS); folded, they ride the slim row's right
    // end.
    var foot = document.createElement('div');
    foot.className = 'section-foot';

    // Per-effect bypass is a real audio-state toggle. The node remains in
    // order, keeps its parameters and live instance, and is persisted with
    // the chain. The short IN/BYP labels match the hardware register and
    // stay distinct from the red emergency Bypass control.
    var bypassBtn = document.createElement('button');
    bypassBtn.type = 'button';
    bypassBtn.className = 'node-bypass';
    bypassBtn.textContent = nodeState.bypassed === true ? 'BYP' : 'IN';
    bypassBtn.setAttribute('aria-label', 'Bypass ' + effectLabel(type) + ' effect');
    bypassBtn.setAttribute('aria-pressed', nodeState.bypassed === true ? 'true' : 'false');
    bypassBtn.title = nodeState.bypassed === true
      ? 'Return ' + effectLabel(type) + ' to the signal path'
      : 'Route around ' + effectLabel(type) + ' without removing it';

    // The collapse chevron — drawn in CSS (a rotated square's edge), no
    // text glyph; aria-expanded is the toggle's OWN state mirror, the
    // visual fold lives on the card (.collapsed). The drawn mark is a
    // child span (referenced directly, never re-queried — minimal DOM
    // stubs in the committed tests carry no firstChild).
    var collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'node-collapse';
    collapseBtn.setAttribute('aria-expanded', 'true');
    collapseBtn.setAttribute('aria-label', 'Toggle parameters for ' + effectLabel(type));
    var chevronMark = document.createElement('span');
    chevronMark.className = 'chevron-mark';
    chevronMark.setAttribute('aria-hidden', 'true');
    collapseBtn.appendChild(chevronMark);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'node-remove-btn';
    removeBtn.setAttribute('aria-label', 'Remove ' + effectLabel(type));
    // The × is DRAWN (two crossed bars in CSS), not a text glyph.
    var removeMark = document.createElement('span');
    removeMark.className = 'remove-mark';
    removeMark.setAttribute('aria-hidden', 'true');
    removeBtn.appendChild(removeMark);

    foot.appendChild(bypassBtn);
    foot.appendChild(collapseBtn);
    foot.appendChild(removeBtn);
    rail.appendChild(foot);

    // --- The encoder field (right). ------------------------------------
    var main = document.createElement('div');
    main.className = 'section-main';

    var paramsContainer = document.createElement('div');
    paramsContainer.className = 'node-params';
    main.appendChild(paramsContainer);

    card.appendChild(rail);
    card.appendChild(main);

    // Render this node's controls inline (knobs / pads / trims). The
    // onParamsChanged callback keeps OUR in-memory copy (nodeState.params)
    // current, so a later structural rebuild (add/remove/reorder elsewhere
    // in the chain) passes along whatever this node's CURRENT tuned values
    // are — reordering must never reset an already-tuned param back to its
    // type default.
    window.ParamControls.render(paramsContainer, nodeState, function (_updatedParams, change) {
      // Issue #20: ParamControls supplies a normalized one-param intent.
      // ChainEditing applies it against the accepted model when its queue
      // reaches this edit, so two fast edits on different cards cannot
      // overwrite one another with stale whole-model candidates.
      if (change) {
        requireChainEditing().apply({
          source: 'human',
          change: {
            nodeId: nodeState.id,
            param: change.param,
            value: change.value
          }
        }).catch(function (err) {
          console.error('ChainCanvas: human parameter edit was not accepted', err);
        });
        return;
      }
      throw new Error('ParamControls must provide a normalized change intent.');
    });

    // Wrap-AFTER-render: ParamControls has by now placed its .param-row
    // children directly inside paramsContainer; move them verbatim into
    // one .node-params-inner wrapper. DOM nodes are MOVED, not rebuilt,
    // so every listener ParamControls attached survives untouched. This
    // is the ONLY place .node-params ever gains an inner wrapper, and it
    // runs once per card — ParamControls.render() (which clears its
    // container) is never called again on a live card.
    var paramsInner = document.createElement('div');
    paramsInner.className = 'node-params-inner';
    var renderedRows = Array.prototype.slice.call(paramsContainer.children);
    renderedRows.forEach(function (row) {
      paramsInner.appendChild(row);
    });
    paramsContainer.appendChild(paramsInner);

    // Chevron toggle. Flips the card's .collapsed class (CSS folds the
    // encoder field away and lays the rail out as the slim groove row)
    // and mirrors the state into the button's own aria-expanded —
    // everything CSS or an assistive technology needs, nothing more.
    // stopPropagation for the same defensive reason as the remove button
    // (the button is a rail sibling of the SortableJS handle, so it can
    // never start a drag anyway). Presentation-ONLY: no model, no graph,
    // no persistence — folding a section changes nothing but how much of
    // it is visible.
    collapseBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      card.classList.toggle('collapsed');
      // Read the class back rather than trusting toggle()'s return value —
      // some minimal DOM stubs return undefined from toggle().
      var collapsed = card.classList.contains('collapsed');
      collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      // Folding re-boxes the section (the rail becomes the slim row) —
      // normal flex reflow handles this for free now that cards sit in
      // ordinary DOM flow instead of absolute position; nothing here
      // needs to re-derive anything.
    });

    bypassBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      var editing = requireChainEditing();
      var candidate = editing.getModel();
      var found = false;
      var shouldBypass = nodeState.bypassed !== true;
      candidate.forEach(function (entry) {
        if (entry.id !== id) {
          return;
        }
        found = true;
        if (shouldBypass) {
          entry.bypassed = true;
        } else {
          delete entry.bypassed;
        }
      });
      if (!found) {
        return;
      }
      // Avoid queuing two clicks against the same accepted state while the
      // graph is fading and rewiring. The accepted render replaces this
      // button on success; a rejection re-enables the existing control.
      bypassBtn.disabled = true;
      editing.apply({
        source: 'human',
        candidate: candidate,
        forceStructural: true
      }).then(function () {
        bypassBtn.disabled = false;
      }, function (err) {
        bypassBtn.disabled = false;
        console.error('ChainCanvas: effect bypass change was not accepted', err);
      });
    });

    removeBtn.addEventListener('click', function (event) {
      // Stop the click from bubbling to anything that might reinterpret it
      // (defensive; the button lives outside .node-drag-handle so
      // SortableJS was never going to treat this as a drag start anyway).
      event.stopPropagation();
      card.remove();
      delete nodesById[id];
      // Drop the removed node's own width too (the store would prune it
      // on save anyway; keeping the live map exact means currentLayout()
      // is always garbage-free).
      delete cardWidths[id];
      delete cardHugW[id];
      // Same one structural gesture adapter used by add and drag reorder.
      commitStructuralChange();
    });

    // Hover-preview round (2026-08-31, refined 2026-09-01 user direction):
    // hovering anywhere on the card shows the module's general info
    // (name + plain-language blurb — the same line the Effects tab's chip
    // hover shows) in the display register. A param row inside the card
    // (src/param-controls.js's own listener, reached through the
    // CanvasRegister bridge) pushes a MORE specific preview — that
    // control's current value — while the pointer sits over it, and pops
    // back to this card-level preview on leaving the row without needing
    // to know it exists; see the registerPreviewStack comment above.
    // Mouse-only, same as the retired code-badge tooltip it replaces: no
    // keyboard-equivalent path to invent (the card itself carries no
    // accessible name of its own — its controls remain the announced
    // truth). Naturally gated pre-Start: .canvas is pointer-events:none
    // until the engine runs, so these never fire before then.
    card.addEventListener('mouseenter', function () {
      showRegisterPreview(effectLabel(type), '', '', paletteTypePreview(type));
    });
    card.addEventListener('mouseleave', function () {
      hideRegisterPreview();
    });

    // The GRIP arms a DRAG-TO-REORDER (board redesign, 2026-09-01 — see
    // the REORDER block above): the drag itself resolves on the
    // document-level pointermove/up handlers (initBoardDragWiring); this
    // listener only ARMS it. dragActive goes true for the whole gesture
    // so agent mutations queue behind it (MC-4 discipline, unchanged
    // consumer).
    handle.addEventListener('pointerdown', function (event) {
      armReorderDrag(card, id, event);
    });

    // ...and so is the SECTION ITSELF (2026-09-01 user direction: "cards
    // don't want to drag as easily as they should"). The rail alone was
    // a 6.5rem strip on a 208px card — the advertised grip, but far too
    // small to be the only one. Pressing anywhere on the section arms the
    // same gesture, EXCLUDING every control that owns its own press
    // (NO_DRAG_SELECTOR: knobs, pads, trims, the bypass/fold/eject keys,
    // the resize corner). The grip icon keeps its own listener for its
    // affordance; armReorderDrag's own
    // `if (reorderDrag || resizeDrag || paletteDrag) return` guard makes
    // double-arming impossible either way.
    card.addEventListener('pointerdown', function (event) {
      var target = event && event.target;
      if (target && typeof target.closest === 'function' &&
          target.closest(NO_DRAG_SELECTOR)) {
        return; // a real control owns this press
      }
      armReorderDrag(card, id, event);
    });

    // The width-resize grip: a machined corner mark (CSS-drawn dot field,
    // .node-resize) at the card's bottom-right. Pointer-only, like the
    // reorder grip — the resize is a STYLE edit (width), never an order
    // or a sound. The drag resolves on the document-level
    // onResizePointerMove/End pair.
    var resizeGrip = document.createElement('div');
    resizeGrip.className = 'node-resize';
    resizeGrip.setAttribute('aria-hidden', 'true');
    resizeGrip.title = 'Drag to resize';
    resizeGrip.addEventListener('pointerdown', function (event) {
      if (reorderDrag || resizeDrag) {
        return; // one gesture at a time
      }
      if (event && typeof event.button === 'number' && event.button !== 0) {
        return; // primary pointer only
      }
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      dragActive = true;
      resizeDrag = {
        card: card,
        id: id,
        startX: event && typeof event.clientX === 'number' ? event.clientX : 0,
        originW: cardWidth(id),
        hadStoredWidth: Object.prototype.hasOwnProperty.call(cardWidths, id),
        originStoredW: cardWidths[id],
        moved: false
      };
    });
    card.appendChild(resizeGrip);

    return card;
  }

  // ---------------------------------------------------------------------
  // SortableJS wiring (Part E) — RETIRED ENTIRELY (2026-08-31 honesty
  // round, the #16 dead-affordance finding). The chain-side instance was
  // retired by FEW-2/PD-1 (order moves eventually landed on the board
  // redesign's own drag-to-reorder above); the PALETTE instance is
  // retired too: it dragged a clone with no receiver on the board, so the
  // gesture could never add anything — a documented verb that cannot
  // work. The committed add verbs are the chip CLICK and keyboard
  // activation (both addNodeType). vendor/sortable.min.js is no longer
  // loaded; SortableJS leaves THIRD_PARTY_NOTICES with it.
  // ---------------------------------------------------------------------

  /**
   * Called once by src/main.js right after AudioEngine.start() resolves
   * successfully. Removes the "not started yet" gating class so the
   * palette/canvas read as active instead of dimmed/inert. The control is
   * also a real disabled button before this transition, so a human gesture
   * cannot submit a mutation before the audio lifecycle is ready.
   */
  function onEngineStarted() {
    if (layoutEl) {
      layoutEl.classList.remove('engine-not-started');
      layoutEl.inert = false;
    }
    // R2-2: unlock the palette chips at the exact same transition — real
    // disabled attributes come OFF here (they shipped ON in
    // renderPalette), so the keyboard add path goes live precisely when
    // the pointer drag path does. Purely the gating flip; addNodeType()
    // itself commits through the same chokepoint as a drag.
    var chips = paletteListEl.querySelectorAll('.node-chip');
    Array.prototype.forEach.call(chips, function (chip) {
      chip.disabled = false;
    });
    // Refinement entry 2 ($impeccable clarify): the empty-hint's copy is
    // STATE-AWARE. Pre-Start, index.html's static default teaches the true
    // first action ("Press Start to power on") because the palette is
    // pointer-locked and adding is impossible in that state. Flipped HERE,
    // at the exact transition where the palette un-locks, to the working
    // add verbs — click / keyboard activation. (The retired palette DRAG
    // had no receiver on the free board, so teaching "drag" here was an
    // invitation the surface could not honor.) updateEmptyHint() only ever
    // toggles display, so the live copy persists across every later
    // empty/populated state (e.g. removing the last node re-shows it).
    if (emptyHintEl) {
      emptyHintEl.textContent =
        'Click an effect to add it at the end — or drag one here to place it';
    }
    // The display register's state line flips at the same transition —
    // ENGINE LIVE with the live module count (mode returns to 'state';
    // by construction no control has been touched yet at this moment,
    // since the whole panel was pointer-locked and chip-disabled before).
  }

  /**
   * Re-gate the board when the live source or audio context is lost. Any
   * gesture armed against the old session is paint-only from this point:
   * cancel it without committing or persisting, then disable every human
   * entry point until main.js reports a successful Start again.
   */
  function onEngineStopped() {
    if (reorderDrag) {
      cancelReorderDrag();
    }
    if (paletteDrag) {
      cancelPaletteDrag();
    }
    if (resizeDrag) {
      if (resizeDrag.hadStoredWidth) {
        cardWidths[resizeDrag.id] = resizeDrag.originStoredW;
      } else {
        delete cardWidths[resizeDrag.id];
      }
      resizeDrag.card.style.width = cardWidth(resizeDrag.id) + 'px';
      resizeDrag = null;
    }
    dragActive = false;
    if (layoutEl) {
      layoutEl.classList.add('engine-not-started');
      // Native inert removes every descendant control from focus and event
      // targeting. The CSS class remains the visual gate; this is its
      // keyboard and assistive-technology equivalent.
      layoutEl.inert = true;
    }
    var chips = paletteListEl.querySelectorAll('.node-chip');
    Array.prototype.forEach.call(chips, function (chip) {
      chip.disabled = true;
    });
    if (emptyHintEl) {
      emptyHintEl.textContent = 'Press Start to power on';
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
   * @param {Object<string, {w?: number}>} [layout]
   *   the saved layout (FEW-1's store form, board-redesign shape). When
   *   an entry carries a `w`, that width is applied EXACTLY (clamped);
   *   nodes without one are carried forward at their current width if
   *   already on the board (an agent rebuild keeps a human's manual
   *   resize), else default to the content hug. When omitted the same
   *   rules run against an empty saved map. Order is no longer a layout
   *   concern — the array's own order IS the chain order.
   * @param {{freshSeats?: boolean}} [options]
   *   freshSeats (#16 stale-seats finding): skip the carry-forward
   *   branch entirely — every entry takes its saved/default width.
   *   stack. Preset loads (src/presets-ui.js) set it: a preset REPLACES
   *   the board, so matching node ids must not inherit their current
   *   manual resize (the documented tidy default). Agent rebuilds and
   *   startup restores leave it unset and keep the carry-forward rule.
   */
  function renderModel(model, layout, options) {
    // Chain replacement invalidates every in-flight board gesture (the
    // #16 race finding): a reorder drag / width resize armed against the
    // OLD chain must never commit against the replacement board.
    // cancelReorderDrag() is the REVERT path (no commit), and the resize
    // drag is dropped wholesale — the width resolution below re-derives
    // every card's width anyway, so its pending write is meaningless.
    // This runs FIRST, before the DOM swap clears the elements those
    // gestures hold.
    if (reorderDrag) {
      cancelReorderDrag();
    }
    if (paletteDrag) {
      cancelPaletteDrag();
    }
    if (resizeDrag) {
      resizeDrag = null;
      dragActive = false;
    }
    // Every card about to be destroyed may be sitting UNDER the pointer,
    // and a destroyed element never fires its mouseleave — so the hover
    // previews those cards pushed would otherwise stay on the register
    // forever. Unwind them here, at the one place the whole row is
    // replaced (see the registerPreviewStack comment).
    resetRegisterPreviews();
    chainListEl.innerHTML = '';
    nodesById = {};

    model.forEach(function (entry) {
      // Discrete-enum canonicalization: the card (and the nodeState it
      // seeds, which recomputeModelFromDom() and the autosave read) gets
      // the canonical STRING for any `values` param, never a raw numeric
      // enum that the visible pad could not display.
      var card = createNodeCard(
        entry.type,
        canonicalParams(entry.type, entry.params),
        entry.id,
        entry.bypassed === true
      );
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

    // Resolve each card's WIDTH for the freshly-loaded chain (saved entry
    // > carried-forward manual resize > content hug/default), then paint.
    // Order needs no resolution at all — model.forEach above already
    // appended every card in the model's own order, and DOM order IS
    // chain order (PD-4).
    var previousWidths = cardWidths;
    // options.freshSeats (#16 stale-seats finding, name carried forward
    // from the free-board era): a PRESET LOAD replaces the whole board,
    // so a matching node id does NOT inherit its old manual resize —
    // every card takes its saved width or the content hug (the
    // documented tidy default). Agent rebuilds and startup restores leave
    // it unset and keep the carry-forward rule.
    var freshSeats = !!(options && options.freshSeats);
    cardWidths = {};
    chainModel.forEach(function (entry) {
      var saved = layout ? layout[entry.id] : null;
      if (saved && typeof saved.w === 'number' && isFinite(saved.w)) {
        cardWidths[entry.id] = clampCardW(saved.w);
      } else if (!freshSeats && typeof previousWidths[entry.id] === 'number') {
        cardWidths[entry.id] = previousWidths[entry.id];
      }
    });
    applyCardWidths();
    renderChainArrows(); // re-draw the connectors onto the freshly-loaded row
    renderSignalOrderStrip();

    updateEmptyHint();
    return true;
  }

  /** Public full-model mutation entry point; always delegates to the sole seam. */
  function loadModel(model, layout, options) {
    return requireChainEditing().apply({
      source: 'startup',
      candidate: model,
      layout: layout,
      renderOptions: options,
      forceStructural: true
    });
  }

  /**
   * MC-4: is a user drag currently in progress (a palette clone drag or,
   * since FEW-2, a grip POSITION drag)? Maintained exclusively by the
   * gesture start/end handlers above; read by src/mcp-tools.js to
   * serialize agent mutations behind user drags (OQ-7). Pure read — never
   * mutates anything.
   *
   * @returns {boolean}
   */
  function isDragActive() {
    return dragActive;
  }

  /**
   * Render one already-accepted parameter change without replacing its
   * card. ChainEditing has already updated graph bookkeeping, the live
   * AudioNode, persistence, preset state, and Undo/revision as applicable.
   * This adapter owns only Canvas bookkeeping and the visible control.
   *
   * @param {string} nodeId - the node whose param changes.
   * @param {string} paramId - the param's registered id.
   * @param {number} value - the new value, already policy-applied.
   * @returns {boolean} true when the node was found and rendered.
   */
  function renderNodeParam(nodeId, paramId, value) {
    if (typeof nodeId !== 'string') {
      return false;
    }
    var nodeState = nodesById[nodeId];
    if (!nodeState) {
      return false;
    }
    var updated = Object.assign({}, nodeState.params);
    // Canonical STRING for a discrete param (autotune key/scale): a legal
    // raw numeric enum written by an agent or a hand-edited payload maps
    // to its declared value here, so the model, the visible pad, and the
    // autosave below all hold ONE truth (the pad matches strings only).
    updated[paramId] = canonicalParamValue(nodeState.type, paramId, value);
    // nodeState is the SAME object reference chainModel holds for this id
    // (file-level model-bookkeeping comment), so this assignment is already
    // reflected in chainModel for later rendering/readback — no
    // recomputeModelFromDom() needed, same as the human onParamsChanged
    // path.
    nodeState.params = updated;

    // Visible control: move the rendered slider + value span in place.
    // Guarded: a bare harness (or a card-less node) simply skips the
    // display update — the model bookkeeping above is still correct.
    try {
      if (window.ParamControls && typeof window.ParamControls.updateControl === 'function') {
        window.ParamControls.updateControl(nodeId, paramId, value);
      }
    } catch (err) {
      // Display-only — never fail the param write for it.
    }

    return true;
  }

  /** Public one-param mutation entry point; always delegates to the sole seam. */
  function updateNodeParam(nodeId, paramId, value) {
    return requireChainEditing().apply({
      source: 'agent',
      change: { nodeId: nodeId, param: paramId, value: value }
    });
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
      var copy = { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
      if (entry.bypassed === true) {
        copy.bypassed = true;
      }
      return copy;
    });
  }

  renderPalette();
  updateEmptyHint();

  // ---------------------------------------------------------------------
  // VIS-6 (A) — agent mutation pulse wiring. Purely additive: this block
  // only ever adds/removes the .agent-pulse class VIS-4's (already
  // shipped, reduced-motion-guarded) rule animates; no DOM restructuring,
  // no inline styles, so SortableJS's drag machinery on these same cards
  // is untouched.
  //
  // FEW-1's contract fires 'agentui:mutation' on document after each
  // reportMutation(), with the caller's exact detail object. Rules here:
  //   - detail.rejected === true → NO work at all (nothing was applied,
  //     so no card should answer; the toast carries the refusal);
  //   - nodeIds are matched by scanning .node-card once and comparing
  //     data-node-id — equivalent to querying
  //     .node-card[data-node-id="<id>"] per id, but immune to selector
  //     metacharacters in an id, deduping a repeated id in one event to
  //     a single pulse (each card is visited exactly once), and never
  //     throwing on unknown ids (they simply match nothing);
  //   - the class comes off on animationend (once), with a 600 ms
  //     fallback timeout in case animation events are suppressed —
  //     REQUIRED under prefers-reduced-motion, where the guarded
  //     keyframe never runs and animationend therefore never fires;
  //     without the fallback the class would stick forever (harmless
  //     there, since no unguarded rule styles it, but untidy).
  //
  // The double-init guard lives as an expando on `document` (not in this
  // IIFE's scope) so re-evaluating this file against the same document
  // can never attach a second listener. Nothing is added to the public
  // window.ChainCanvas surface.
  // ---------------------------------------------------------------------
  function onAgentMutation(event) {
    var detail = event && event.detail;
    if (!detail || detail.rejected) {
      return;
    }
    var nodeIds = detail.nodeIds;
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
      return;
    }

    var wanted = {};
    nodeIds.forEach(function (id) {
      if (typeof id === 'string') {
        wanted[id] = true;
      }
    });

    var cardEls = chainListEl.querySelectorAll('.node-card');
    Array.prototype.forEach.call(cardEls, function (card) {
      if (wanted[card.getAttribute('data-node-id')]) {
        pulseNodeCard(card);
      }
    });
  }

  function pulseNodeCard(card) {
    card.classList.add('agent-pulse');
    var settled = false;

    function settle() {
      if (settled) {
        return;
      }
      settled = true;
      card.removeEventListener('animationend', onPulseEnd);
      card.classList.remove('agent-pulse');
    }

    function onPulseEnd(event) {
      // Only the pulse animation owns the removal; an animationend from
      // any other animation (or bubbling up from a child) is ignored.
      // Events without an animationName (minimal stubs) are accepted.
      if (event && typeof event.animationName === 'string' &&
          event.animationName !== 'node-card-agent-pulse') {
        return;
      }
      settle();
    }

    card.addEventListener('animationend', onPulseEnd);
    window.setTimeout(settle, 600);
  }

  if (typeof document.addEventListener === 'function' &&
      !document.__chainCanvasAgentPulseWired) {
    document.__chainCanvasAgentPulseWired = true;
    document.addEventListener('agentui:mutation', onAgentMutation);
  }

  // ---------------------------------------------------------------------
  // BOARD CHROME. Vertical flow is RETIRED (2026-08-31, user direction):
  // the board has one reading — horizontal, condensed modules in a
  // left-to-right row — so the FLOW toggle, its preference key, and every
  // vertical geometry branch are deleted. The panel carries
  // .flow-horizontal permanently (the CSS scoping stays so the rules read
  // as the board's own). The TIDY key is retired too (same day, user
  // direction: not helpful) — the board is a free canvas; nothing moves
  // the operator's cards but the operator.
  // ---------------------------------------------------------------------
  function initBoardChrome() {
    if (typeof document.querySelector !== 'function') {
      return;
    }
    var flowPanel = document.querySelector('.canvas-panel');
    if (!flowPanel) {
      return;
    }
    flowPanel.classList.add('flow-horizontal');
  }

  initBoardChrome();
  if (layoutEl && layoutEl.classList.contains('engine-not-started')) {
    onEngineStopped();
  }

  window.ChainCanvas = {
    onEngineStarted: onEngineStarted,
    onEngineStopped: onEngineStopped,
    loadModel: loadModel,
    // Issue #20 implementation adapters. Production mutation sources do
    // not call these directly; ChainEditing owns their sequencing.
    renderModel: renderModel,
    renderNodeParam: renderNodeParam,
    getCurrentModel: getCurrentModel,
    isDragActive: isDragActive,
    // Public mutation wrapper; accepted rendering stays in renderNodeParam.
    updateNodeParam: updateNodeParam,
    // The grid constant (tests + the width-resize consumer), the live
    // layout map (read-only by convention — callers must not mutate), and
    // the palette click/keyboard add verb (the drag-add twin with the
    // chain Sortable retired per PD-1).
    GRID_PITCH: GRID_PITCH,
    // The condensed-width contract — same role as the grid constant:
    // tests + future consumers read the one source.
    CARD_W_DEFAULT_PX: CARD_W_DEFAULT_PX,
    CARD_W_MIN_PX: CARD_W_MIN_PX,
    CARD_W_MAX_PX: CARD_W_MAX_PX,
    snapToGrid: snapToGrid,
    currentLayout: currentLayout,
    // ChainEditing's own currentLayout() helper (src/chain-editing.js)
    // reads the accepted layout through this exact name.
    getCurrentLayout: currentLayout,
    addNodeType: addNodeType,
    // Guided Patchbay round: the Presets tab's factory cards derive their
    // family-tag row from a preset's own node types (src/presets-ui.js),
    // reusing this file's one 3-letter-code function rather than a second
    // copy that could drift from the palette chip / card rail's own tags.
    familyInitials: familyInitials
  };

  // The display-register feed consumed by src/param-controls.js (guarded
  // there): showParam for the touched/externally-written control, the
  // internal state line for this file's own engine/structural moments,
  // and showPreview/hidePreview so a param row's OWN hover can push/pop
  // the same nested preview stack a card-level hover pushes onto (see the
  // registerPreviewStack comment above) — the row is the more specific,
  // inner hover, so it always renders on top of the card's general one
  // and falls back to it on mouseleave. Exported SEPARATELY from
  // ChainCanvas on purpose — param-controls.js loads before canvas.js and
  // must not need the canvas namespace to render (a bare param-controls
  // harness works with no register at all).
  window.CanvasRegister = {
    showParam: showRegisterParam,
    showPreview: showRegisterPreview,
    hidePreview: hideRegisterPreview
  };
})();
