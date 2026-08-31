// Chain canvas for the VOXCHAIN — drag-and-drop build /
// reorder / remove, the loadModel rebuild, the parameter-only fast path,
// and (redesign item 1) the canvas panel's Pattern Machine chrome: the
// display register and the panel-print SECTION anatomy each chain entry
// renders as (see createNodeCard + buildDisplayRegister below).
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

  // MC-4 (OQ-7 serialization rule): true while a SortableJS drag is in
  // progress on EITHER list (a palette drag targets the chain list too, so
  // both sortables maintain the same single flag — only one drag can be
  // active at a time anyway, since they share the 'chain-group' group).
  // Maintained purely from SortableJS's own onStart/onEnd events below and
  // read via the exported isDragActive() so src/mcp-tools.js can QUEUE
  // agent mutations behind an in-progress user drag instead of racing the
  // drop's onSort commit. Purely additive: nothing in this file branches
  // on it, so drag behavior is bit-for-bit unchanged.
  var dragActive = false;

  // ---------------------------------------------------------------------
  // FEW-2 (cycle 4): FREE POSITIONING. Sections are absolutely
  // positioned inside the bounded canvas panel (the panel keeps internal
  // scrolling via .canvas). The coordinate space is the CHAIN LIST's
  // content box (top-left of .chain-list = {0, 0}); each card is a
  // full-width row translated by `transform: translate(x, y)`, so x/y are
  // STYLE ONLY — the DOM order always equals the chain order (PD-4), and
  // a move can never reorder anything. All logical positions live in the
  // `positions` map below (never read back out of the style), snap-
  // quantized to GRID_PITCH on every write.
  //
  // Persistence rides FEW-1's store seam: saved on MOVE-END (never per
  // pointermove) via saveCurrentChain(chainModel, positions); the store's
  // prune/normalize rules keep the slot garbage-free on removes. (The
  // TIDY key was retired 2026-08-31 — the board is a free canvas.)
  // ---------------------------------------------------------------------
  var GRID_PITCH = 16; // the snap quantum (px) — one shared constant
  var TIDY_X = GRID_PITCH; // the row's top edge (grid-aligned)
  var TIDY_ROW_PITCH = GRID_PITCH * 10; // 160px — the layout-less extent fallback (real cards use measured heights)
  // Per-card WIDTH (2026-08-31 round): a condensed section's own width in
  // px, snap-quantized and clamped. `w` rides the layout entry beside
  // x/y/scale/flow; an absent w means the CSS default (the uniform
  // condensed width every card shares until resized). The clamp bounds
  // mirror main.css's horizontal-mode min/max-width (8rem..24rem).
  // Width floors (2026-08-31 dead-space rounds): every card HUGS its own
  // content — JS measures the widest KNOB row after render (trims/pads
  // stretch to fill whatever width exists, so they never leave dead
  // space) and that measurement is the card's default width. 96px is the
  // resize FLOOR; 128px is the layout-less fallback default (stripped
  // harnesses measure nothing); 384px the ceiling.
  var CARD_W_DEFAULT_PX = 128;
  var CARD_W_MIN_PX = 96; // 6rem
  var CARD_W_MAX_PX = 384; // 24rem
  var cardHugW = {}; // id -> measured content width (real browsers only)
  var positions = {}; // id -> {x, y, w?, scale, flow} (scale/flow carried, FEW-5/6 wire them)
  var zCounter = 0; // bring-to-front counter (pointerdown order)
  var positionDrag = null; // the live grip drag, if any
  var resizeDrag = null; // the live width-resize drag, if any

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

  /** A card's effective width in px: its saved `w` clamped into the
   *  condensed range; else its MEASURED content hug (plus the card's own
   *  side padding and border); else the layout-less default. Single
   *  source for the board-extent math and the width resize. */
  function cardWidth(id) {
    var pos = positions[id];
    if (pos && typeof pos.w === 'number') {
      return clampCardW(pos.w);
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

  /** Paint one layout entry onto its card: the seat (transform) and the
   *  card's own condensed width. Since the vertical reading was retired
   *  (2026-08-31) every card is a width-defined module on the horizontal
   *  board. */
  function applyPositionToCard(card, x, y, id) {
    card.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
    if (id) {
      ensureCardHug(id, card); // first paint after render — the card is live
      card.style.width = cardWidth(id) + 'px';
    }
  }

  function bringCardToFront(card) {
    zCounter += 1;
    card.style.zIndex = String(zCounter);
  }

  /** One card's contribution to the board's vertical rhythm: its MEASURED
   *  height snapped up to the grid plus one grid unit of breathing room
   *  (the console rhythm's own pitch — not an arbitrary gap). A
   *  layout-less host falls back to the fixed 160px pitch. Used by the
   *  extent math. */
  function tidyRowHeight(id) {
    var size = measuredSize(cardElById(id));
    if (size.h) {
      return Math.ceil(size.h / GRID_PITCH) * GRID_PITCH + GRID_PITCH;
    }
    return TIDY_ROW_PITCH;
  }

  /** The horizontal twin: one card's contribution along the row axis —
   *  its effective width snapped up to the grid plus one grid unit of
   *  breathing room. A layout-less host has no measured width, so the
   *  entry's `w` (or the uniform default) carries the math. */
  function tidyRowWidth(id) {
    var size = measuredSize(cardElById(id));
    var w = size.w ? Math.max(size.w, cardWidth(id)) : cardWidth(id);
    return Math.ceil(w / GRID_PITCH) * GRID_PITCH + GRID_PITCH;
  }

  /** First free grid slot along the row: right of the rightmost card's
   *  right edge (new modules join the row's end). */
  function firstFreeSlotX() {
    var maxX = 0;
    Object.keys(positions).forEach(function (id) {
      var right = positions[id].x + tidyRowWidth(id);
      if (right > maxX) {
        maxX = right;
      }
    });
    return snapToGrid(maxX);
  }

  function placeNewNode(id) {
    positions[id] = { x: firstFreeSlotX(), y: TIDY_X, scale: 1, flow: 'horizontal' };
    return positions[id];
  }

  /** The live layout map (passed to the store; the store prunes unknown ids). */
  function currentLayout() {
    return positions;
  }

  /** Keep the list reachable in the panel's internal scroll (absolute
   *  cards do not size their container). Vertical mode maintains the Y
   *  extent (each seat's measured BOTTOM); horizontal mode additionally
   *  maintains the X extent — the row's right edge — so the condensed
   *  sections stay reachable in the face's horizontal scroll. OQ-9: the
   *  extent covers measured edges, never a fixed row pitch. */
  function refreshBoardExtent() {
    var maxY = 0;
    var maxX = 0;
    Object.keys(positions).forEach(function (id) {
      var bottom = positions[id].y + tidyRowHeight(id);
      if (bottom > maxY) {
        maxY = bottom;
      }
      var right = positions[id].x + tidyRowWidth(id);
      if (right > maxX) {
        maxX = right;
      }
    });
    chainListEl.style.minHeight = maxY + 'px';
    chainListEl.style.minWidth = maxX + 'px';
  }

  function applyPositionsToCards() {
    var cardEls = chainListEl.querySelectorAll('.node-card');
    Array.prototype.forEach.call(cardEls, function (card) {
      var pos = positions[card.getAttribute('data-node-id')];
      if (pos) {
        applyPositionToCard(card, pos.x, pos.y, card.getAttribute('data-node-id'));
      }
    });
    refreshBoardExtent();
  }

  // The grip pointer-drag: MOVES POSITION (snap-quantized), never an
  // order. move/up listeners live on document (active only mid-drag) so a
  // drag never dies when the pointer leaves the handle.
  function onPositionPointerMove(event) {
    if (!positionDrag) {
      return;
    }
    var x = snapToGrid(positionDrag.originX + ((event && event.clientX ? event.clientX : 0) - positionDrag.startX));
    var y = snapToGrid(positionDrag.originY + ((event && event.clientY ? event.clientY : 0) - positionDrag.startY));
    // The board has no negative region — a drag past the origin wall
    // clamps at 0 instead of parking a live card off the reachable board.
    if (x < 0) {
      x = 0;
    }
    if (y < 0) {
      y = 0;
    }
    var pos = positions[positionDrag.id];
    if (pos && (pos.x !== x || pos.y !== y)) {
      pos.x = x;
      pos.y = y;
      applyPositionToCard(positionDrag.card, x, y, positionDrag.id);
      positionDrag.moved = true;
      refreshBoardExtent();
      renderCords(); // FEW-3: live re-route while the seat moves
    }
  }

  function onPositionPointerEnd() {
    if (!positionDrag) {
      return;
    }
    var drag = positionDrag;
    positionDrag = null;
    dragActive = false;
    // Persist on MOVE-END only — never per pointermove.
    if (drag.moved && window.Persistence) {
      window.Persistence.saveCurrentChain(chainModel, positions);
    }
  }

  // The width-resize pointer-drag (2026-08-31 round): adjusts ONE card's
  // `w` (snap-quantized, clamped to the condensed range), repaints the
  // width, re-routes the cords (jack geometry reads the live card box),
  // and refreshes the board extent. Never an order, never a sound.
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
    var pos = positions[resizeDrag.id];
    if (pos && pos.w !== w) {
      pos.w = w;
      applyPositionToCard(resizeDrag.card, pos.x, pos.y, resizeDrag.id);
      resizeDrag.moved = true;
      refreshBoardExtent();
      renderCords(); // jacks sit on the border — the border just moved
    }
  }

  function onResizePointerEnd() {
    if (!resizeDrag) {
      return;
    }
    var drag = resizeDrag;
    resizeDrag = null;
    dragActive = false;
    // Same discipline as a seat move: persist on END only.
    if (drag.moved && window.Persistence) {
      window.Persistence.saveCurrentChain(chainModel, positions);
    }
  }

  function initPositionDragWiring() {
    if (typeof document.addEventListener !== 'function' ||
        document.__chainCanvasPointerWired) {
      return;
    }
    document.__chainCanvasPointerWired = true;
    document.addEventListener('pointermove', onPositionPointerMove);
    document.addEventListener('pointerup', onPositionPointerEnd);
    document.addEventListener('pointercancel', onPositionPointerEnd);
    document.addEventListener('pointermove', onResizePointerMove);
    document.addEventListener('pointerup', onResizePointerEnd);
    document.addEventListener('pointercancel', onResizePointerEnd);
    // FEW-4: the cord-edit gesture rides the same document-level wiring
    // (each handler no-ops unless ITS drag is armed). Escape reverts an
    // in-progress cord edit (the keyboard twin of drop-nowhere).
    document.addEventListener('pointermove', onCordPointerMove);
    document.addEventListener('pointerup', onCordPointerEnd);
    document.addEventListener('pointercancel', cancelCordDrag);
    document.addEventListener('keydown', onCordKeyDown);
  }

  initPositionDragWiring();

  // ---------------------------------------------------------------------
  // FEW-3 (cycle 4): the CORD LAYER — read-only signal cords painted from
  // model order over the board. MIC OUT -> each section in DOM order
  // (== chain order, PD-4) -> OUT IN, one bezier per hop, drawn in a
  // single SVG inside the canvas FACE (#chain-canvas, NEVER inside
  // #chain-list — the list's children ARE the chain, and its child count
  // feeds updateEmptyHint; both are DOM contracts other tests pin).
  //
  // Discipline (postmortem of the reverted first attempt):
  //   - INSERTION: the SVG is APPENDED as #chain-canvas's LAST child.
  //     Never a first child (firstChild indexes are pinned elsewhere),
  //     never inside .chain-list (serialized + counted by other tests).
  //     z-order is CSS-only: the layer sits at z-index 0, the absolutely
  //     positioned sections at z-index >= 1 (styles/main.css).
  //   - COORDINATES: every jack point DERIVES from the positions map +
  //     the section list element (offsetLeft/offsetTop when the host
  //     reports them; 0 in a stripped vm harness). No parallel
  //     bookkeeping ever — renderCords() READS the same `positions` map
  //     every position write maintains, and is called from each of the
  //     existing write paths (pointer move, TIDY, loadModel, structural
  //     add/remove). Rebuilding the paths from scratch on every call is
  //     the point: the map is the only state.
  //   - READ-ONLY this task: pointer-events none, aria-hidden decorative.
  //     Cord EDITING (drag-to-relink) is FEW-4's scope.
  //   - OQ-9 (QA-5 element round): jack geometry is the user's exact
  //     across-from spec (see the constants block below) — ON the border,
  //     derived from live card measurements + each card's layout flow
  //     field, with placeholder fallbacks only for a layout-less host.
  // ---------------------------------------------------------------------
  var SVG_NS = 'http://www.w3.org/2000/svg';
  // OQ-9 (QA-5 element round) — JACK GEOMETRY, per the user's exact spec:
  // a card's two jacks sit ON its border, DIRECTLY ACROSS each other.
  //   VERTICAL flow   -> IN at the TOP-CENTER of the border, OUT at the
  //                      BOTTOM-CENTER (the column reads mic -> down
  //                      through the cards -> out);
  //   HORIZONTAL flow -> IN at the MIDDLE of the LEFT border, OUT at the
  //                      MIDDLE of the RIGHT border.
  // Orientation derives from each card's OWN layout flow field (FEW-1's
  // per-entry `flow`) — today that field is uniform, written by the canvas
  // FLOW toggle (see applyFlow); FEW-6's per-card glyph can flip one card
  // and its jacks follow with zero changes here. Panel anchors rhyme with
  // the same across-from logic: MIC IN is the SOURCE (its out-jack on the
  // board-facing edge of its print row), the OUT anchor RECEIVES (its
  // in-jack on the board-facing edge).
  //
  // Fallbacks for a LAYOUT-LESS host (the committed vm harnesses report no
  // offsets): the placeholder card box keeps the historical constants
  // (160px wide, 48px tall) so the pinned tests stay positions-map
  // verbatim; every real browser measures the live card instead.
  var CARD_W_FALLBACK = GRID_PITCH * 10; // 160 — placeholder card width
  var CARD_H_FALLBACK = GRID_PITCH * 3; // 48 — placeholder card height
  var cordSvgEl = null;
  // FEW-4: jack-point geometry + edit-gesture constants. JACK_R is the
  // HIT disc (pointer-events:all makes the whole disc live); the DRAWN
  // ring is smaller and sits half-buried ON the card's border line (the
  // socket reads as machined into the slab's edge). CORD_HIT_SLOP is the
  // geometric drop slop the JS hit-test uses; CORD_DETACH_THRESHOLD is
  // the deliberate-drag guard.
  var JACK_R = 12;
  var JACK_RING_R = 7.5; // 15px outer — the same size as the anchor print rings
  var JACK_SOCKET_R = 2.5; // the dark socket dot inside the ring
  var CORD_HIT_SLOP = 24;
  var CORD_DETACH_THRESHOLD = 6;
  var jackEls = []; // the live jack elements ({el, jack}), rebuilt by renderCords
  var cordDrag = null; // the live cord edit, if any (FEW-4 block below)
  // VERTICAL FLOW IS RETIRED (2026-08-31, user direction): the board has
  // exactly ONE reading — horizontal, condensed modules left-to-right.
  // The FLOW toggle, its preference key, and the vertical geometry
  // branches are deleted; .flow-horizontal is a permanent panel class
  // (the CSS scoping stays so the rules read as the board's own).

  function createSvgEl(tag) {
    if (typeof document.createElementNS === 'function') {
      return document.createElementNS(SVG_NS, tag);
    }
    return document.createElement(tag);
  }

  function buildCordLayer() {
    if (typeof document.createElement !== 'function') {
      return;
    }
    var canvasFace = document.getElementById('chain-canvas');
    if (!canvasFace || typeof canvasFace.appendChild !== 'function') {
      return; // no canvas face (e.g. a stripped harness) — cords simply don't paint
    }
    cordSvgEl = createSvgEl('svg');
    // SVGElement.className is a read-only SVGAnimatedString in real
    // browsers (the vm harness's stub allowed a plain assignment, which
    // is how this shipped) — class goes through setAttribute.
    cordSvgEl.setAttribute('class', 'cord-layer');
    cordSvgEl.setAttribute('aria-hidden', 'true');
    canvasFace.appendChild(cordSvgEl); // LAST child — see insertion note above
    renderCords();
  }

  /** The board origin (chain-list content-box top-left) in the SVG's
   *  coordinate space. Both share .canvas as their positioning context
   *  (made position:relative for the cord layer, styles/main.css), so the
   *  list's live offsets map 1:1; a vm harness without layout reports
   *  none and gets {0, 0} — the positions map alone then defines the
   *  cords, which is exactly the test contract. */
  function boardOrigin() {
    var ox = typeof chainListEl.offsetLeft === 'number' && isFinite(chainListEl.offsetLeft) ? chainListEl.offsetLeft : 0;
    var oy = typeof chainListEl.offsetTop === 'number' && isFinite(chainListEl.offsetTop) ? chainListEl.offsetTop : 0;
    return { x: ox, y: oy };
  }

  /** Measured box of a live element, or {0,0} where the host reports no
   *  layout (the committed vm harnesses) — the caller decides the
   *  fallback. Same defensive register as boardOrigin(). */
  function measuredSize(el) {
    var w = el && typeof el.offsetWidth === 'number' && el.offsetWidth > 0 ? el.offsetWidth : 0;
    var h = el && typeof el.offsetHeight === 'number' && el.offsetHeight > 0 ? el.offsetHeight : 0;
    return { w: w, h: h };
  }

  /** The section's jack pair — ON the border, directly across each other
   *  (the OQ-9 geometry block above). Reads the card's OWN flow field;
   *  measures the live element, placeholder box in a layout-less host. */
  function sectionJackPts(id) {
    var pos = positions[id];
    var origin = boardOrigin();
    var size = measuredSize(cardElById(id));
    var w = size.w || CARD_W_FALLBACK;
    var h = size.h || CARD_H_FALLBACK;
    var x0 = origin.x + pos.x;
    var y0 = origin.y + pos.y;
    // Vertical flow retired: every card's jacks sit at the middles of its
    // LEFT and RIGHT borders (the across-from rule).
    return {
      inPt: { x: x0, y: y0 + h / 2 },
      outPt: { x: x0 + w, y: y0 + h / 2 }
    };
  }

  /** A panel anchor element (the OUT print row in the canvas face and the
   *  MIC IN unit on the register strip, matched by class in document
   *  order — never by text, which is src/meters.js's own contract). The
   *  register precedes the face, so anchors[0] is still MIC IN and the
   *  last is OUT. */
  function panelAnchorEl(which) {
    var panel = document.querySelector('.canvas-panel');
    var anchors = [];
    (function walk(node) {
      if (!node || !node.children) {
        return;
      }
      Array.prototype.forEach.call(node.children, function (child) {
        if (child.classList && child.classList.contains('anchor')) {
          anchors.push(child);
        }
        walk(child);
      });
    })(panel);
    if (anchors.length === 0) {
      return null;
    }
    return which === 'out' ? anchors[anchors.length - 1] : anchors[0];
  }

  /** MIC IN's OUT jack — the cable's DROP POINT at the board's top edge,
   *  directly beneath the fixed header unit's meter (2026-08-31 cord
   *  round). The cord SVG lives inside the scrolling face and cannot
   *  paint above its clip, so the cable starts AT the content top under
   *  the unit — visibly dropping out of the header's port — with its
   *  draggable jack ring drawn there. Real browsers convert the unit's
   *  viewport rect into content space (+ scrollLeft so the point stays
   *  put while the board pans); stripped harnesses take the constant. */
  function micOutPoint() {
    var origin = boardOrigin();
    var el = panelAnchorEl('mic');
    if (el) {
      try {
        if (typeof el.getBoundingClientRect === 'function' &&
            typeof chainListEl.getBoundingClientRect === 'function') {
          var er = el.getBoundingClientRect();
          var lr = chainListEl.getBoundingClientRect();
          if (er && lr && er.width && er.height) {
            var dropX = er.left + er.width / 2 - lr.left +
              (chainListEl.scrollLeft || 0);
            if (dropX < GRID_PITCH) {
              dropX = GRID_PITCH;
            }
            return { x: origin.x + dropX, y: origin.y };
          }
        }
      } catch (err) {
        /* stripped harness — fallback below */
      }
    }
    return { x: origin.x + TIDY_X, y: origin.y };
  }

  /** The chain's OUT jack — the cable's EXIT POINT at the board's
   *  bottom-right corner (2026-08-31 cord round: the in-flow OUT anchor
   *  is retired; the fixed base-plate OUT unit below the face is the
   *  port, and this content-anchored point — one grid unit in from the
   *  board's extent — is where the last cord visibly drops toward it,
   *  jack ring drawn). */
  function outInPoint(maxX, maxY) {
    var origin = boardOrigin();
    return {
      x: origin.x + Math.max(maxX - GRID_PITCH, TIDY_X),
      y: origin.y + Math.max(maxY - GRID_PITCH, 0)
    };
  }

  /** The read-only route: MIC OUT -> each section in DOM order -> OUT IN.
   *  One segment per hop, so the segment count is always nodes + 1 (an
   *  empty chain still shows the direct MIC -> OUT bypass cord). */
  function cordSegments() {
    var ids = domCardIds();
    var maxY = 0;
    var maxX = 0;
    ids.forEach(function (id) {
      var pos = positions[id];
      if (pos && pos.y > maxY) {
        maxY = pos.y;
      }
      if (pos && pos.x > maxX) {
        maxX = pos.x;
      }
    });

    var segments = [];
    var prevId = 'mic';
    var prevPt = micOutPoint();
    var outPt = outInPoint(maxX + (maxX ? CARD_W_FALLBACK : 0), maxY + (maxY ? TIDY_ROW_PITCH : 0));

    ids.forEach(function (id) {
      var pos = positions[id];
      if (!pos) {
        return; // seatless sections never exist on a painted board
      }
      var jacks = sectionJackPts(id);
      segments.push({ from: prevId, to: id, a: prevPt, b: jacks.inPt });
      prevId = id;
      prevPt = jacks.outPt;
    });
    segments.push({ from: prevId, to: 'out', a: prevPt, b: outPt });
    return segments;
  }

  /** Horizontal cubic bezier between two jack points — the classic patch
   *  cord sag, deterministic in x only (tests pin endpoints, not sag). */
  function cordPathD(a, b) {
    var dx = Math.max(GRID_PITCH, Math.min(Math.abs(b.x - a.x) / 2, GRID_PITCH * 4));
    return 'M' + a.x + ' ' + a.y +
      ' C' + (a.x + dx) + ' ' + a.y +
      ', ' + (b.x - dx) + ' ' + b.y +
      ', ' + b.x + ' ' + b.y;
  }

  /** The link POINTS the cord segments terminate at — one per segment
   *  endpoint, DERIVED from the same segments (zero parallel geometry):
   *  mic-out (the first segment's source), each section's IN (a segment's
   *  target) and OUT (a segment's source), and the out anchor's IN (the
   *  last segment's target). FEW-4's editable hit targets. */
  function jackPoints() {
    var pts = [];
    cordSegments().forEach(function (seg) {
      if (seg.from === 'mic') {
        pts.push({ kind: 'mic-out', x: seg.a.x, y: seg.a.y });
      } else {
        pts.push({ kind: 'section-out', nodeId: seg.from, x: seg.a.x, y: seg.a.y });
      }
      if (seg.to === 'out') {
        pts.push({ kind: 'out-in', x: seg.b.x, y: seg.b.y });
      } else {
        pts.push({ kind: 'section-in', nodeId: seg.to, x: seg.b.x, y: seg.b.y });
      }
    });
    return pts;
  }

  /** THE one re-render entry point — rebuilds the cord paths AND the
   *  jack points from the current positions map + DOM order. Called from
   *  each existing position/order write path; never maintains state of
   *  its own beyond the live jack-element registry FEW-4's grabs ride
   *  on (fresh listeners on fresh elements — a rebuild mid-gesture is
   *  therefore always safe). */
  function renderCords() {
    if (!cordSvgEl) {
      return;
    }
    // Array.prototype.slice.call — real DOM children is a live
    // HTMLCollection without array methods (the vm harness's Array
    // children masked this; second hotfix of the same shipping class).
    Array.prototype.slice.call(cordSvgEl.children).forEach(function (child) {
      child.remove();
    });
    cordSegments().forEach(function (seg) {
      var path = createSvgEl('path');
      path.setAttribute('class', 'cord');
      path.setAttribute('d', cordPathD(seg.a, seg.b));
      path.setAttribute('data-from', seg.from);
      path.setAttribute('data-to', seg.to);
      cordSvgEl.appendChild(path);
    });
    // FEW-4 + OQ-9: the JACK POINTS — the layer's ONLY pointer-live
    // children (CSS turns pointer-events on for .cord-jack alone; the
    // paths stay decorative until grabbed). One GROUP per link point:
    // a transparent hit disc (the whole circle grabs, not just the
    // painted stroke), the drawn RING, and the dark SOCKET dot inside it
    // — ring + socket is the same drawn anatomy the anchor prints use,
    // so every jack on the board is one size and one shape, sitting ON
    // the border line it belongs to (half-buried in the slab edge).
    jackEls = [];
    jackPoints().forEach(function (jp) {
      var g = createSvgEl('g');
      g.setAttribute('class', 'cord-jack');
      g.setAttribute('data-jack-kind', jp.kind);
      if (jp.nodeId) {
        g.setAttribute('data-node-id', jp.nodeId);
      }
      g.setAttribute('transform', 'translate(' + jp.x + ', ' + jp.y + ')');
      var hit = createSvgEl('circle');
      hit.setAttribute('class', 'jack-hit');
      hit.setAttribute('r', JACK_R);
      g.appendChild(hit);
      var ring = createSvgEl('circle');
      ring.setAttribute('class', 'jack-ring');
      ring.setAttribute('r', JACK_RING_R);
      g.appendChild(ring);
      var socket = createSvgEl('circle');
      socket.setAttribute('class', 'jack-socket');
      socket.setAttribute('r', JACK_SOCKET_R);
      g.appendChild(socket);
      g.addEventListener('pointerdown', function (event) {
        armCordDrag(jp, event);
      });
      cordSvgEl.appendChild(g);
      jackEls.push({ el: g, jack: jp });
    });
  }

  buildCordLayer();

  // OQ-9: jack points derive from LIVE card geometry (border centers), so
  // a viewport resize re-derives them — the cords stay plugged when the
  // panel's column width changes. Guarded like every panel-level wiring.
  if (typeof window.addEventListener === 'function' &&
      !window.__chainCanvasResizeWired) {
    window.__chainCanvasResizeWired = true;
    window.addEventListener('resize', function () {
      renderCords();
    });
  }

  // ---------------------------------------------------------------------
  // FEW-4 (cycle 4): CORD EDITING — order-by-cord, never gating audio.
  //
  // Fixed semantics (town-hall Q4, unchangeable):
  //   - CORDS EDIT ORDER, NEVER GATE AUDIO. Grabbing a jack starts an
  //     EDIT; audio changes ONLY on a completed relink — a drop on a
  //     compatible point — committed as ONE structural commit through
  //     the existing commitStructuralChange() chokepoint (DOM reorder
  //     -> recompute -> rebuildGraph duck -> autosave -> revision
  //     bump). Unplugging can never remove audio: mid-drag the model,
  //     the DOM, and the painted cords are byte-unchanged, and drop
  //     nowhere (or Escape, or pointercancel) reverts the edit with
  //     ZERO rebuilds. Per-node bypass stays DECLINED elsewhere; a cord
  //     edit never touches bypass state at all.
  //   - ORDER MATH (the four link-point types):
  //       mic-out point            -> the dragged node becomes the
  //                                   FIRST node (its IN takes the mic
  //                                   feed);
  //       a section's OUT end on
  //       section-B's IN jack      -> insert the dragged section
  //                                   BEFORE B;
  //       a section's IN end on
  //       section-B's OUT jack     -> insert the dragged section
  //                                   AFTER B;
  //       the out-anchor IN point  -> the dragged node becomes the LAST
  //                                   node (its OUT feeds the panel).
  //     So an IN end targets mic-out + section OUT jacks; an OUT end
  //     targets section IN jacks + the out anchor. Anything else —
  //     including the dragged node's OWN jacks (a self-link) — is
  //     incompatible and reverts. A computed order identical to the
  //     current one is a NO-OP: revert, zero rebuilds (the retired
  //     SortableJS likewise never fired onSort for a drop that moved
  //     nothing).
  //   - DELIBERATE-DRAG GUARD: the pointer must travel at least
  //     CORD_DETACH_THRESHOLD px before the end detaches — a click on a
  //     jack is not an unplug, and a sub-threshold release leaves no
  //     state at all. dragActive (MC-4) goes true at DETACH and false
  //     at gesture end, so agent mutations QUEUE behind the edit
  //     exactly as they queue behind a palette or grip drag (mcp-tools
  //     already polls isDragActive() — no new seam).
  //   - The commit reorders the DOM (.insertBefore, DOM ORDER = CHAIN
  //     ORDER, PD-4) and then runs the existing downstream machinery
  //     exactly once. The ghost is a lightweight path re-drawn per
  //     pointermove from the cord's still-plugged anchor to the
  //     pointer; the static cords stay untouched until the commit
  //     re-routes them (mid-drag byte-stability is what the revert
  //     path proves).
  //   - The panel anchors (mic-out, out-in) are FIXED HARDWARE: drop
  //     targets only, never drag sources. Only a section's own in/out
  //     jacks can be grabbed.
  // ---------------------------------------------------------------------
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

  function findJack(kind, nodeId) {
    var found = null;
    jackPoints().some(function (jp) {
      if (jp.kind === kind && (!nodeId || jp.nodeId === nodeId)) {
        found = jp;
        return true;
      }
      return false;
    });
    return found;
  }

  function jackKey(jp) {
    return jp ? jp.kind + '|' + (jp.nodeId || '') : '';
  }

  /** Pointer (client space) -> layer space. In a real host the SVG's
   *  own bounding rect does the mapping; a stripped vm harness has no
   *  rects and client coords ARE layer coords — the same identity the
   *  FEW-3 harness pins for board origin {0, 0}. */
  function pointerToLayer(event) {
    var cx = event && typeof event.clientX === 'number' ? event.clientX : 0;
    var cy = event && typeof event.clientY === 'number' ? event.clientY : 0;
    var rect = null;
    if (cordSvgEl && typeof cordSvgEl.getBoundingClientRect === 'function') {
      try {
        rect = cordSvgEl.getBoundingClientRect();
      } catch (err) {
        rect = null;
      }
    }
    if (rect && typeof rect.left === 'number' && isFinite(rect.left) &&
        typeof rect.top === 'number' && isFinite(rect.top)) {
      return { x: cx - rect.left, y: cy - rect.top };
    }
    return { x: cx, y: cy };
  }

  /** Is this link point a legal target for the dragged end? (The order
   *  math's compatibility table — see the block comment above.) */
  function compatibleJack(dragEnd, jack) {
    if (!jack || !cordDrag || jack.nodeId === cordDrag.id) {
      return false; // never a self-link
    }
    if (jack.kind === 'section-in') {
      return dragEnd === 'out'; // an OUT end before B
    }
    if (jack.kind === 'section-out') {
      return dragEnd === 'in'; // an IN end after B
    }
    if (jack.kind === 'mic-out') {
      return dragEnd === 'in'; // the dragged node's IN takes the mic feed
    }
    if (jack.kind === 'out-in') {
      return dragEnd === 'out'; // the dragged node's OUT feeds the panel
    }
    return false;
  }

  /** The nearest COMPATIBLE link point within CORD_HIT_SLOP of a layer
   *  point (geometric hit-test — the drawn ring stays small, the drop
   *  slop is generous patch-cord feel). */
  function resolveTargetJack(pt) {
    if (!pt || !cordDrag) {
      return null;
    }
    var best = null;
    var bestD = CORD_HIT_SLOP;
    jackPoints().forEach(function (jp) {
      if (!compatibleJack(cordDrag.endKind, jp)) {
        return;
      }
      var dx = pt.x - jp.x;
      var dy = pt.y - jp.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d <= bestD) {
        best = jp;
        bestD = d;
      }
    });
    return best;
  }

  /** The still-plugged anchor the ghost dangles from: dragging X's IN
   *  end unplugs the cord that FED X (its source is the predecessor's
   *  OUT jack, or the mic panel); dragging X's OUT end leaves the cord
   *  plugged into X's own IN jack. */
  function anchorPointFor(dragId, endKind) {
    if (endKind === 'out') {
      return findJack('section-in', dragId) || findJack('mic-out');
    }
    var ids = domCardIds();
    var idx = ids.indexOf(dragId);
    if (idx <= 0) {
      return findJack('mic-out');
    }
    return findJack('section-out', ids[idx - 1]);
  }

  /** THE order math: the new linear order a completed relink commits.
   *  Pure — reads DOM order, computes the target order, never mutates. */
  function relinkOrder(dragId, target) {
    var rest = domCardIds().filter(function (id) {
      return id !== dragId;
    });
    if (target.kind === 'mic-out') {
      return [dragId].concat(rest); // FIRST node
    }
    if (target.kind === 'out-in') {
      return rest.concat([dragId]); // LAST node
    }
    var out = [];
    rest.forEach(function (id) {
      if (target.kind === 'section-in' && id === target.nodeId) {
        out.push(dragId); // an OUT end on B's IN: BEFORE B
      }
      out.push(id);
      if (target.kind === 'section-out' && id === target.nodeId) {
        out.push(dragId); // an IN end on B's OUT: AFTER B
      }
    });
    return out;
  }

  /** Commit the new order to the DOM with .insertBefore ONLY (exactly
   *  how the retired SortableJS onSort reorder did it — SortableJS too
   *  pulled the element out before placing it). The cards are detached
   *  first, then inserted walking the target order right-to-left, each
   *  before the already-placed card that must follow it, so the insert
   *  references are never shifted by a concurrent removal. DOM ORDER =
   *  CHAIN ORDER (PD-4); everything downstream is the existing
   *  machinery. Listeners survive — elements are moved, never rebuilt. */
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

  /** Arm (not start) a cord edit from a jack press. The edit only
   *  DETACHES once the deliberate-drag threshold is crossed; nothing is
   *  mutated here. Panel anchors are fixed hardware — drop targets
   *  only. */
  function armCordDrag(jp, event) {
    if (cordDrag || positionDrag) {
      return; // one gesture at a time
    }
    if (jp.kind !== 'section-in' && jp.kind !== 'section-out') {
      return; // mic-out / out-in never drag
    }
    if (!jp.nodeId) {
      return;
    }
    if (event && typeof event.button === 'number' && event.button !== 0) {
      return; // primary pointer only
    }
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    // dragActive from ARM, not from detach-threshold (the #16 race
    // finding): the agent-mutation queue polls this flag, and arming it
    // only after the deliberate-drag threshold left a window where a
    // structural agent edit could replace the board while a cord press
    // was already armed against it. One gesture at a time still holds;
    // every resolution path (drop, revert, cancel, loadModel
    // invalidation) clears it.
    dragActive = true;
    cordDrag = {
      id: jp.nodeId,
      endKind: jp.kind === 'section-in' ? 'in' : 'out',
      startX: event && typeof event.clientX === 'number' ? event.clientX : 0,
      startY: event && typeof event.clientY === 'number' ? event.clientY : 0,
      detached: false,
      anchorPt: null,
      ghostEl: null,
      hotKey: '',
      hotEl: null
    };
  }

  /** The ghost path (created on demand — a renderCords() call mid-gesture
   *  rebuilds the layer, so the ghost must be able to re-attach). */
  function ensureGhost() {
    if (!cordDrag.ghostEl || cordDrag.ghostEl.parentNode !== cordSvgEl) {
      cordDrag.ghostEl = createSvgEl('path');
      cordDrag.ghostEl.setAttribute('class', 'cord-ghost');
      cordDrag.ghostEl.setAttribute('data-drag-node', cordDrag.id);
      cordDrag.ghostEl.setAttribute('data-drag-end', cordDrag.endKind);
      cordSvgEl.appendChild(cordDrag.ghostEl);
    }
    return cordDrag.ghostEl;
  }

  /** Highlight the compatible target under the pointer (paint only). */
  function setHotJack(jp) {
    var key = jackKey(jp);
    if (cordDrag.hotKey === key) {
      return;
    }
    if (cordDrag.hotEl) {
      cordDrag.hotEl.classList.remove('cord-jack-hot');
    }
    cordDrag.hotKey = key;
    cordDrag.hotEl = null;
    if (!jp) {
      return;
    }
    jackEls.some(function (entry) {
      if (jackKey(entry.jack) === key) {
        cordDrag.hotEl = entry.el;
        return true;
      }
      return false;
    });
    if (cordDrag.hotEl) {
      cordDrag.hotEl.classList.add('cord-jack-hot');
    }
  }

  function onCordPointerMove(event) {
    if (!cordDrag) {
      return;
    }
    var cx = event && typeof event.clientX === 'number' ? event.clientX : cordDrag.startX;
    var cy = event && typeof event.clientY === 'number' ? event.clientY : cordDrag.startY;
    if (!cordDrag.detached) {
      var dx = cx - cordDrag.startX;
      var dy = cy - cordDrag.startY;
      if (Math.sqrt(dx * dx + dy * dy) < CORD_DETACH_THRESHOLD) {
        return; // deliberate-drag guard: not yet an unplug
      }
      cordDrag.detached = true;
      dragActive = true; // MC-4: agent mutations now queue behind the edit
      cordDrag.anchorPt = anchorPointFor(cordDrag.id, cordDrag.endKind);
    }
    var pt = pointerToLayer({ clientX: cx, clientY: cy });
    var ghost = ensureGhost();
    ghost.setAttribute('d', cordPathD(cordDrag.anchorPt || pt, pt));
    setHotJack(resolveTargetJack(pt));
  }

  function onCordPointerEnd(event) {
    if (!cordDrag) {
      return;
    }
    var target = null;
    if (cordDrag.detached && event &&
        typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      target = resolveTargetJack(pointerToLayer(event));
    }
    finishCordDrag(target);
  }

  function onCordKeyDown(event) {
    if (cordDrag && event && event.key === 'Escape') {
      cancelCordDrag();
    }
  }

  function cancelCordDrag() {
    finishCordDrag(null); // pointercancel / Escape: the revert path
  }

  /** THE one resolution: teardown the gesture's paint, then either
   *  revert (no target / moved nothing — model, DOM, and cords stay
   *  byte-unchanged, ZERO rebuilds) or commit the relink through the
   *  existing structural chokepoint exactly ONCE. */
  function finishCordDrag(target) {
    var drag = cordDrag;
    if (!drag) {
      return;
    }
    cordDrag = null;
    dragActive = false;
    if (drag.ghostEl && drag.ghostEl.parentNode) {
      drag.ghostEl.remove();
    }
    if (drag.hotEl) {
      drag.hotEl.classList.remove('cord-jack-hot');
    }
    if (!drag.detached || !target) {
      return; // revert: an unplug is an EDIT, never an audio change
    }
    var order = relinkOrder(drag.id, target);
    if (order.join('|') === domCardIds().join('|')) {
      return; // a drop that moves nothing commits nothing (no-op)
    }
    applyDomOrder(order);
    commitStructuralChange(); // DOM reorder -> recompute -> rebuild duck -> autosave -> revision bump, ONCE
  }

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

    // 2026-08-31 (user direction): the register strip is also the fixed
    // home of the MIC IN meter unit. The print row MOVES out of the
    // scrolling face onto the panel's top header (mirroring the base
    // plate's OUT corner at the bottom-right): src/meters.js mounts the
    // input meter inside the anchor wherever it lives, and the cord layer
    // reads the unit's right edge as MIC OUT (see micOutPoint).
    var micPrint = firstAnchorIn(document.getElementById('chain-canvas'));
    if (micPrint && registerEl.insertBefore) {
      registerEl.insertBefore(micPrint, registerEl.firstChild);
    }
  }

  /** The first .anchor inside a subtree (document-order), or null. */
  function firstAnchorIn(root) {
    if (!root || !root.children) {
      return null;
    }
    for (var i = 0; i < root.children.length; i++) {
      var child = root.children[i];
      if (child.classList && child.classList.contains('anchor')) {
        return child;
      }
    }
    return null;
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

  buildDisplayRegister();


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

  // VIS-3 silkscreen initials (rq5 redundant encoding): every family chip
  // carries its 3-letter code alongside the family color, so color is
  // never the only signal. 2026-08-31 (user direction): the code is the
  // first three letters of the module's DISPLAY label, uppercased —
  // derived from the registry's label (single source, no hardcoded map:
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
   * registry-driven loop.
   *
   * @param {string} type
   * @returns {string} 3-letter silkscreen code (GAIN, COM, DEL, NOI...)
   */
  function familyInitials(type) {
    var label = type;
    try {
      if (window.NodeTypes && typeof window.NodeTypes.getLabel === 'function') {
        label = window.NodeTypes.getLabel(type) || type;
      }
    } catch (err) {
      /* stripped harness — the type key is the fallback label */
    }
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
      if (window.NodeTypes && typeof window.NodeTypes.getParamSpec === 'function') {
        var specs = window.NodeTypes.getParamSpec(type);
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
  // 6 → 10 flat chips with no chunking at the add-a-node decision point).
  // Presentation seam ONLY — the registry stays the single source of what
  // renders (renderPalette still iterates getAllTypes()); these lookups
  // only decide which silkscreen group header a chip rides under, in
  // operator (non-engineer) language derived from README.md's own
  // framing: "shape" = what the voice itself sounds like (tone, grit,
  // width, pitch), "polish" = level/evenness/space, "safe" = the two
  // automatic guards. Chips stay DIRECT children of #palette-list (flat
  // DOM order preserved: R2-2 button semantics, tab order, and the
  // SortableJS drag items are untouched); the headers are non-interactive
  // <h3> legends interleaved between groups, never containers.
  //
  // Lookup discipline mirrors FAMILY_INITIALS above: an as-yet-unmapped
  // future type falls back to a trailing catch-all group ("More
  // effects") rather than disappearing or being mis-filed — the group
  // map can never silently drop a registered type.
  // ---------------------------------------------------------------------
  var PALETTE_GROUPS = [
    { id: 'shape', label: 'Shape your voice' },
    { id: 'polish', label: 'Polish your sound' },
    { id: 'safe', label: 'Keep it safe' }
  ];

  var PALETTE_FALLBACK_GROUP = { id: 'more', label: 'More effects' };

  var PALETTE_TYPE_GROUP = {
    // Shape your voice — the voice's own character (README: distortion
    // "adds grit and edge", chorus "thickens and widens the voice",
    // autotune "pulls each note toward the key"; EQ shapes tone).
    eq: 'shape',
    distortion: 'shape',
    chorus: 'shape',
    autotune: 'shape',
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
   * fallback group — never throws, same defensive register as
   * NodeTypes.getLabel).
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
  // EXPERIMENTAL TYPES (cycle 3) — the experimental status is declared at
  // the type's OWN registration (`experimental: true` in
  // NodeTypes.register — node-autotune.js, autotune only, per the
  // cycle-3 scope "experimental badge on autotune only") and read through
  // NodeTypes.isExperimental(): ONE source of truth shared with
  // mcp-tools.js's agent capabilities readout (MCP-1), so the visible
  // badge and the agent-facing disclosure can never drift. The map below
  // is only the guarded FALLBACK for a registry that predates the
  // isExperimental API (a bare harness with an old node-types.js); it
  // must mirror the registrations and is drift-checked by
  // isExperimentalType's live-first lookup below.
  // ---------------------------------------------------------------------
  var EXPERIMENTAL_TYPES = {
    autotune: true
  };

  /**
   * Does this type render the experimental badge? (Data source for both
   * the card badge and the chip badge/aria status below.) The LIVE
   * registry wins whenever it exposes isExperimental (MCP-1); the static
   * map stands only as the pre-API fallback.
   * @param {string} type
   * @returns {boolean}
   */
  function isExperimentalType(type) {
    try {
      if (window.NodeTypes && typeof window.NodeTypes.isExperimental === 'function') {
        return window.NodeTypes.isExperimental(type);
      }
    } catch (err) {
      // Damaged registry object — the static fallback below stands.
    }
    return Object.prototype.hasOwnProperty.call(EXPERIMENTAL_TYPES, type) &&
      !!EXPERIMENTAL_TYPES[type];
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
    badge.title = window.NodeTypes.getLabel(type) +
      ' is experimental — new DSP, still under audio-quality review.';
    return badge;
  }

  function renderPalette() {
    paletteListEl.innerHTML = '';
    var types = window.NodeTypes.getAllTypes();

    // Refinement entry 3 (critique P2-3): bucket the registry's types by
    // group, preserving REGISTRATION ORDER within each bucket (the
    // registry stays the source of chip order; the group map only decides
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
        chip.textContent = window.NodeTypes.getLabel(type);
        // R2-2 action-phrase name; UI-2 (cycle 3): an experimental type
        // appends its status, so a screen-reader user hears it BEFORE the
        // node enters the chain (the chip's visible 'EXP' tag is the
        // sighted twin of this suffix — see createExperimentalBadge).
        chip.setAttribute(
          'aria-label',
          'Add ' + window.NodeTypes.getLabel(type) + ' to chain' +
            (isExperimentalType(type) ? ' (experimental)' : ''));
        // UI-2: the chip-side experimental badge (autotune only) — compact
        // 'EXP' silkscreen abbreviation after the visible label, same single
        // data source and factory as the card's full tag.
        if (isExperimentalType(type)) {
          chip.appendChild(createExperimentalBadge(type, true));
        }
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
          // ever reachable post-Start — the same guarantee the SortableJS
          // pointer path gets from the pointer-events:none panel gate.
          addNodeType(type);
        });
        paletteListEl.appendChild(chip);
      });
    });
  }

  // R2-2: default params for a freshly-added node of `type` — the exact
  // object the SortableJS onAdd handler mints, factored out so the
  // keyboard add path and the drag add path CANNOT drift apart.
  function defaultParamsForType(type) {
    var paramSpec = window.NodeTypes.getParamSpec(type);
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
   * commitStructuralChange() — the SAME chokepoint the SortableJS onSort
   * handler uses — so autosave (PS-2), the unsaved dot (PS-3), and the
   * human-edit revision bump (Issue #6) all fire exactly as they do for a
   * drag-add. No agent toast class: this is a human action.
   *
   * @param {string} type - the node type to add (from the chip's
   *   data-node-type, itself from the registry-driven palette loop).
   */
  function addNodeType(type) {
    var card = createNodeCard(type, defaultParamsForType(type));
    var cards = chainListEl.querySelectorAll('.node-card');
    var lastCard = cards.length > 0 ? cards[cards.length - 1] : null;
    if (lastCard &&
        lastCard.getAttribute('data-family') === 'limiter') {
      // Keep the terminal limiter terminal: insert just before it.
      chainListEl.insertBefore(card, lastCard);
    } else {
      chainListEl.appendChild(card);
    }
    // FEW-2: with the chain Sortable retired (PD-1) this click/keyboard
    // path IS the palette add verb — the new section lands at the FIRST
    // FREE GRID SLOT (palette drag-drops may degrade to the same slot
    // until FEW-7 wires drop-point placement).
    var pos = placeNewNode(card.getAttribute('data-node-id'));
    applyPositionToCard(card, pos.x, pos.y);
    refreshBoardExtent();
    commitStructuralChange();
  }

  /**
   * R2-2 factoring: the SINGLE post-structural-change commit — model
   * recompute, empty-hint flip, graph rebuild, autosave, unsaved dot,
   * human-edit revision bump. Previously the body of the SortableJS onSort
   * handler; now shared verbatim with addNodeType() above so a keyboard
   * add and a drag add are indistinguishable downstream.
   */
  function commitStructuralChange() {
    recomputeModelFromDom();
    updateEmptyHint();
    rebuildGraph();
    renderCords(); // FEW-3: an add (or any order change) re-routes the cords
    // PS-2: persist the chain after every structural add/remove/reorder.
    // Pass chainModel explicitly rather than AudioGraph.getModel() — see
    // the comment on Persistence.saveCurrentChain() for why: AudioGraph's
    // own model commits asynchronously, ~20ms after rebuildGraph()
    // returns, so reading through it right here would silently save the
    // OLD, pre-change model (e.g. a just-dropped-in node would never
    // actually make it into the autosave slot).
    if (window.Persistence) {
      window.Persistence.saveCurrentChain(chainModel, positions);
    }
    // PS-3: a drag-driven add/remove/reorder is a user EDIT — mark unsaved.
    if (window.PresetsUI) {
      window.PresetsUI.markModified();
    }
    // Issue #6: a HUMAN add/reorder (palette drag OR keyboard add — both
    // human actions) — bump the state revision so a stale agent Undo
    // entry can no longer auto-apply over it. The agent write path uses
    // loadModel() directly, never this commit path, so agent edits do
    // not bump.
    if (window.AgentUI && typeof window.AgentUI.noteHumanEdit === 'function') {
      window.AgentUI.noteHumanEdit();
    }
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
  //       .section-foot          <- collapse chevron + remove × (real
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
  // @returns {HTMLElement}
  // ---------------------------------------------------------------------
  function createNodeCard(type, initialParams, explicitId) {
    var id = explicitId || nextNodeId();
    var nodeState = { id: id, type: type, params: Object.assign({}, initialParams || {}) };
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

    // --- The family print block (left rail). ---------------------------
    var rail = document.createElement('div');
    rail.className = 'section-rail';

    var handle = document.createElement('span');
    handle.className = 'node-drag-handle';
    handle.title = 'Drag to move';

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
    code.title = window.NodeTypes.getLabel(type);

    handle.appendChild(gripIcon);
    rail.appendChild(handle);
    rail.appendChild(code);

    // UI-2 (cycle 3): the formal experimental badge on the section of
    // every type in EXPERIMENTAL_TYPES (autotune only, cycle-3 scope) —
    // a silkscreen tag in the rail under the module label. SR-visible by
    // content (see createExperimentalBadge); title carries the why.
    if (isExperimentalType(type)) {
      rail.appendChild(createExperimentalBadge(type, false));
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

    // The collapse chevron — drawn in CSS (a rotated square's edge), no
    // text glyph; aria-expanded is the toggle's OWN state mirror, the
    // visual fold lives on the card (.collapsed). The drawn mark is a
    // child span (referenced directly, never re-queried — minimal DOM
    // stubs in the committed tests carry no firstChild).
    var collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'node-collapse';
    collapseBtn.setAttribute('aria-expanded', 'true');
    collapseBtn.setAttribute('aria-label', 'Toggle parameters for ' + window.NodeTypes.getLabel(type));
    var chevronMark = document.createElement('span');
    chevronMark.className = 'chevron-mark';
    chevronMark.setAttribute('aria-hidden', 'true');
    collapseBtn.appendChild(chevronMark);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'node-remove-btn';
    removeBtn.setAttribute('aria-label', 'Remove ' + window.NodeTypes.getLabel(type));
    // The × is DRAWN (two crossed bars in CSS), not a text glyph.
    var removeMark = document.createElement('span');
    removeMark.className = 'remove-mark';
    removeMark.setAttribute('aria-hidden', 'true');
    removeBtn.appendChild(removeMark);

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
        window.Persistence.saveCurrentChain(chainModel, positions);
      }
      // PS-3: a param tweak is a user EDIT — mark the currently-displayed
      // preset (if any) as having unsaved changes. Unlike the saveCurrentChain()
      // call just above, this is purely a display concern (the "• unsaved
      // changes" indicator), not persistence.
      if (window.PresetsUI) {
        window.PresetsUI.markModified();
      }
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
      // Folding re-boxes the section (the rail becomes the slim row), so
      // the jack points MOVE with it — the cords must re-derive now, not
      // at the next unrelated paint (the stale-cord #16 finding). Same
      // for the board extent, which reads live card geometry.
      renderCords();
      refreshBoardExtent();
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
        window.Persistence.saveCurrentChain(chainModel, positions);
      }
      // PS-3: removing a node is a user EDIT — mark unsaved.
      if (window.PresetsUI) {
        window.PresetsUI.markModified();
      }
      // Issue #6: a HUMAN removal — bump the state revision so a stale
      // agent Undo entry can no longer auto-apply over it.
      if (window.AgentUI && typeof window.AgentUI.noteHumanEdit === 'function') {
        window.AgentUI.noteHumanEdit();
      }
      // FEW-2: drop the removed node's board position too (the store
      // would prune it on save anyway; keeping the live map exact means
      // currentLayout() is always garbage-free).
      delete positions[id];
      delete cardHugW[id];
      renderCords(); // FEW-3: the chain closes over the removed seat
    });

    // FEW-2: pointerdown anywhere on the section brings it to FRONT
    // (z-order only — DOM order still equals chain order, PD-4).
    card.addEventListener('pointerdown', function () {
      bringCardToFront(card);
    });

    // A11Y-1: a control RECEIVING focus raises its section the same way
    // (bubbling focusin — 'focus' itself does not bubble). Z-order only:
    // no focus() call, no DOM move; the ring can never paint beneath a
    // previously fronted overlapping neighbor.
    card.addEventListener('focusin', function () {
      bringCardToFront(card);
    });

    // FEW-2: the GRIP now MOVES POSITION (snap-quantized to GRID_PITCH),
    // never an order. The drag itself resolves on the document-level
    // pointermove/up handlers (initPositionDragWiring); this listener
    // only ARMS it. dragActive goes true for the whole gesture so agent
    // mutations queue behind it (MC-4 discipline, unchanged consumer).
    handle.addEventListener('pointerdown', function (event) {
      if (positionDrag || cordDrag || resizeDrag) {
        return; // one gesture at a time (a cord edit owns the pointer too)
      }
      if (event && typeof event.button === 'number' && event.button !== 0) {
        return; // primary pointer only
      }
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      var pos = positions[id] || placeNewNode(id);
      bringCardToFront(card);
      dragActive = true;
      positionDrag = {
        card: card,
        id: id,
        startX: event && typeof event.clientX === 'number' ? event.clientX : 0,
        startY: event && typeof event.clientY === 'number' ? event.clientY : 0,
        originX: pos.x,
        originY: pos.y,
        moved: false
      };
    });

    // The header band is the card's MOVE grip (2026-08-31 dead-space
    // round, user direction "cards aren't moveable"): pointerdown
    // anywhere on the rail arms the same seat drag the machined grip
    // icon arms — EXCLUDING the real controls that live in the band
    // (collapse, eject) so pressing them never starts a move. The grip
    // icon keeps its own listener for its visual affordance; the guard
    // `if (positionDrag ...) return` makes double-arming impossible.
    rail.addEventListener('pointerdown', function (event) {
      if (positionDrag || cordDrag || resizeDrag) {
        return;
      }
      var target = event && event.target;
      if (target && typeof target.closest === 'function' &&
          target.closest('button, input, label, .node-resize')) {
        return; // a control in the band owns this press
      }
      if (event && typeof event.button === 'number' && event.button !== 0) {
        return; // primary pointer only
      }
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      var pos = positions[id] || placeNewNode(id);
      bringCardToFront(card);
      dragActive = true;
      positionDrag = {
        card: card,
        id: id,
        startX: event && typeof event.clientX === 'number' ? event.clientX : 0,
        startY: event && typeof event.clientY === 'number' ? event.clientY : 0,
        originX: pos.x,
        originY: pos.y,
        moved: false
      };
    });

    // The width-resize grip (2026-08-31 round): a machined corner mark
    // (CSS-drawn dot field, .node-resize) at the card's bottom-right.
    // Pointer-only, like the position grip — the resize is a STYLE edit
    // (w joins x/y in the layout entry), never an order or a sound. The
    // drag resolves on the document-level onResizePointerMove/End pair.
    var resizeGrip = document.createElement('div');
    resizeGrip.className = 'node-resize';
    resizeGrip.setAttribute('aria-hidden', 'true');
    resizeGrip.title = 'Drag to resize';
    resizeGrip.addEventListener('pointerdown', function (event) {
      if (positionDrag || cordDrag || resizeDrag) {
        return; // one gesture at a time
      }
      if (event && typeof event.button === 'number' && event.button !== 0) {
        return; // primary pointer only
      }
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      var pos = positions[id] || placeNewNode(id);
      bringCardToFront(card);
      dragActive = true;
      resizeDrag = {
        card: card,
        id: id,
        startX: event && typeof event.clientX === 'number' ? event.clientX : 0,
        originW: cardWidth(id),
        moved: false
      };
    });
    card.appendChild(resizeGrip);

    return card;
  }

  // ---------------------------------------------------------------------
  // SortableJS wiring (Part E) — RETIRED ENTIRELY (2026-08-31 honesty
  // round, the #16 dead-affordance finding). The chain-side instance was
  // retired by FEW-2/PD-1 (order moves live in cord editing; the grip
  // moves position); the PALETTE instance is now retired too: it dragged
  // a clone with no receiver on the free board, so the gesture could
  // never add anything — a documented verb that cannot work. The
  // committed add verbs are the chip CLICK and keyboard activation (both
  // addNodeType, first-free-slot placement). vendor/sortable.min.js is
  // no longer loaded; SortableJS leaves THIRD_PARTY_NOTICES with it.
  // ---------------------------------------------------------------------

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
      emptyHintEl.textContent = 'Click an effect to add it to the chain';
    }
    // The display register's state line flips at the same transition —
    // ENGINE LIVE with the live module count (mode returns to 'state';
    // by construction no control has been touched yet at this moment,
    // since the whole panel was pointer-locked and chip-disabled before).
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
   * @param {Object<string, {x: number, y: number, scale?: number, flow?: string}>} [layout]
   *   FEW-2: the saved layout (FEW-1's store form). When provided, each
   *   entry is applied EXACTLY (snapped to the grid); nodes WITHOUT an
   *   entry are carried forward if they already sit on the board (an
   *   agent rebuild keeps surviving nodes where the operator left them),
   *   else auto-placed at the first free grid slot. When omitted the same
   *   rules run against an empty saved map — so a fresh preset load ends
   *   tidy while an autosave restore passed its layout round-trips
   *   exactly.
   */
  function loadModel(model, layout) {
    // Chain replacement invalidates every in-flight board gesture (the
    // #16 race finding): a cord edit / seat move / width resize armed
    // against the OLD chain must never commit against the replacement
    // board. finishCordDrag(null) is the REVERT path (no target = no
    // commit), and the seat/resize drags are dropped wholesale — loadModel
    // re-derives every position below, so their pending writes are
    // meaningless. This runs FIRST, before the DOM swap clears the
    // elements those gestures hold.
    if (cordDrag) {
      cancelCordDrag();
    }
    if (positionDrag || resizeDrag) {
      positionDrag = null;
      resizeDrag = null;
      dragActive = false;
    }
    chainListEl.innerHTML = '';
    nodesById = {};

    model.forEach(function (entry) {
      // Discrete-enum canonicalization: the card (and the nodeState it
      // seeds, which recomputeModelFromDom() and the autosave read) gets
      // the canonical STRING for any `values` param, never a raw numeric
      // enum that the visible pad could not display.
      var card = createNodeCard(entry.type, canonicalParams(entry.type, entry.params), entry.id);
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

    // FEW-2: resolve the board's positions for the freshly-loaded chain
    // (saved entry > carried-forward seat > first free slot), then paint.
    // The store already sanitized whatever it handed us; the isFinite
    // guards here keep a hostile DIRECT caller from poisoning the map.
    var previous = positions;
    positions = {};
    chainModel.forEach(function (entry) {
      var saved = layout ? layout[entry.id] : null;
      if (saved && typeof saved.x === 'number' && isFinite(saved.x) &&
          typeof saved.y === 'number' && isFinite(saved.y)) {
        positions[entry.id] = {
          // Math.max(0, ...) — the board has no negative region: a hostile
          // or hand-edited payload with negative seats would otherwise
          // park live cards outside the reachable board (the #16 finding).
          x: Math.max(0, snapToGrid(saved.x)),
          y: Math.max(0, snapToGrid(saved.y)),
          // A saved width rides along clamped (the condensed range is the
          // board's own geometry contract); absent -> the CSS default.
          w: typeof saved.w === 'number' && isFinite(saved.w) ? clampCardW(saved.w) : undefined,
          scale: typeof saved.scale === 'number' && isFinite(saved.scale) ? saved.scale : 1,
          // Vertical flow is retired: whatever a legacy payload says, the
          // entry loads horizontal (the field survives for store-shape
          // compatibility; the store normalizes it on save).
          flow: 'horizontal',
        };
      } else if (previous[entry.id]) {
        positions[entry.id] = previous[entry.id];
      } else {
        placeNewNode(entry.id);
      }
    });
    applyPositionsToCards();
    renderCords(); // FEW-3: re-route onto the freshly-loaded board

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
      window.Persistence.saveCurrentChain(chainModel, positions);
    }
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
   * Issue #5: apply ONE parameter change to an existing node WITHOUT the
   * loadModel() rebuild — the parameter-only write path. This is the
   * canvas-side half of exactly what a human slider move does, split the
   * same way the human path splits it:
   *
   *   human slider move:
   *     src/param-controls.js input handler  -> AudioGraph.updateNodeParams
   *                                            + NodeTypes.applyParam
   *                                            (the live-graph half)
   *     this file's onParamsChanged callback -> nodeState.params
   *                                            + Persistence autosave
   *                                            + PresetsUI.markModified
   *                                            (the canvas half)
   *   agent set_param (parameter-only candidate, src/mcp-tools.js):
   *     the fast path plays the input-handler role (the same
   *     AudioGraph.updateNodeParams + NodeTypes.applyParam calls), then
   *     calls THIS function for the canvas half.
   *
   * What this function owns: the canvas model bookkeeping (nodeState.params
   * — the object getCurrentModel()/recomputeModelFromDom() read), the
   * VISIBLE control (the card's slider position + mono value span via
   * ParamControls.updateControl — the card is never re-rendered, never
   * replaced), the autosave (Persistence.saveCurrentChain — the same call
   * a human param tweak makes, so agent param edits persist identically),
   * and the unsaved dot (PresetsUI.markModified). It deliberately does NOT
   * call buildGraph() (nothing structural changed) and does NOT touch any
   * AudioNode (the caller owns the live write, exactly as param-controls
   * owns it on the human path).
   *
   * @param {string} nodeId - the node whose param changes.
   * @param {string} paramId - the param's registered id.
   * @param {number} value - the new value, already policy-applied.
   * @returns {boolean} true when the node was found and updated; false
   *   when no such node exists in this canvas (the caller falls back to
   *   the full loadModel() write path — safety over elegance).
   */
  function updateNodeParam(nodeId, paramId, value) {
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
    // reflected in chainModel for the persistence read below — no
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

    // PS-2 (same call the human param tweak makes): persist so the
    // autosave slot reflects the tuned value, not the last structural
    // state. chainModel is synchronously current (see above).
    if (window.Persistence) {
      window.Persistence.saveCurrentChain(chainModel, positions);
    }
    // PS-3: an agent param edit is an EDIT of whatever preset was
    // displayed — the same markModified() a human slider move fires.
    if (window.PresetsUI) {
      window.PresetsUI.markModified();
    }
    return true;
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

  window.ChainCanvas = {
    onEngineStarted: onEngineStarted,
    loadModel: loadModel,
    getCurrentModel: getCurrentModel,
    isDragActive: isDragActive,
    // Issue #5: the parameter-only write path (see updateNodeParam above).
    updateNodeParam: updateNodeParam,
    // FEW-2 seams: the grid constants (tests + FEW-5/6/7 consumers), the
    // live layout map (read-only by convention — callers must not mutate),
    // TIDY, and the palette click/keyboard add verb (the drag-add twin
    // with the chain Sortable retired per PD-1).
    GRID_PITCH: GRID_PITCH,
    TIDY_ROW_PITCH: TIDY_ROW_PITCH,
    TIDY_X: TIDY_X,
    // The condensed-width contract (2026-08-31 round) — same role as the
    // grid constants: tests + future consumers read the one source.
    CARD_W_DEFAULT_PX: CARD_W_DEFAULT_PX,
    CARD_W_MIN_PX: CARD_W_MIN_PX,
    CARD_W_MAX_PX: CARD_W_MAX_PX,
    snapToGrid: snapToGrid,
    currentLayout: currentLayout,
    addNodeType: addNodeType
  };

  // The display-register feed consumed by src/param-controls.js (guarded
  // there): showParam for the touched/externally-written control, the
  // internal state line for this file's own engine/structural moments.
  // Exported SEPARATELY from ChainCanvas on purpose — param-controls.js
  // loads before canvas.js and must not need the canvas namespace to
  // render (a bare param-controls harness works with no register at all).
  window.CanvasRegister = {
    showParam: showRegisterParam
  };
})();
