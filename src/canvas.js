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
  // carries its 2-letter code alongside the family color, so color is
  // never the only signal. A lookup (not a type list — the palette loop
  // below still iterates whatever the registry holds): a future
  // as-yet-unmapped type falls back to the first two letters of its own
  // type name, uppercased. VIS-4: familyInitials() makes this map the
  // single shared source for BOTH surfaces — palette chips (VIS-3) and
  // node cards (VIS-4) render their legend squares from the same lookup,
  // so the two can never drift apart.
  var FAMILY_INITIALS = {
    gain: 'GN',
    compressor: 'CP',
    eq: 'EQ',
    delay: 'DL',
    reverb: 'RV',
    limiter: 'LM',
    // UI-2 (cycle 3): the four shelved effects, same label-initials
    // convention as the six above (each value is the first letters of the
    // DISPLAY label, not the type key — so the gate reads NG for its
    // "Noise Gate" label, not GA).
    distortion: 'DI',
    chorus: 'CH',
    gate: 'NG',
    autotune: 'AU'
  };

  /**
   * VIS-4: the one shared family-initials lookup (single source:
   * FAMILY_INITIALS directly above — never duplicated elsewhere). Used by
   * renderPalette() for palette chips and createNodeCard() for node
   * cards. An as-yet-unmapped future type falls back to the first two
   * letters of its own type name, uppercased — same no-hardcoded-type-
   * list discipline as renderPalette()'s registry-driven loop.
   *
   * @param {string} type
   * @returns {string} 2-letter silkscreen initials
   */
  function familyInitials(type) {
    return FAMILY_INITIALS[type] || type.slice(0, 2).toUpperCase();
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
    // PS-2: persist the chain after every structural add/remove/reorder.
    // Pass chainModel explicitly rather than AudioGraph.getModel() — see
    // the comment on Persistence.saveCurrentChain() for why: AudioGraph's
    // own model commits asynchronously, ~20ms after rebuildGraph()
    // returns, so reading through it right here would silently save the
    // OLD, pre-change model (e.g. a just-dropped-in node would never
    // actually make it into the autosave slot).
    if (window.Persistence) {
      window.Persistence.saveCurrentChain(chainModel);
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

  /**
   * Build a real, stateful node-card element for one chain entry.
   *
   * Structure (see styles/main.css for the visual rules):
   *   .node-card[data-node-id][data-family][data-initials]
   *     .node-card-header
   *       .node-drag-handle          <- ONLY this drives SortableJS's
   *                                     `handle: '.node-drag-handle'` on the
   *                                     chain list, so grabbing the slider,
   *                                     the collapse chevron or the remove
   *                                     button can never start a card drag.
   *         .node-drag-icon
   *         .node-label
   *       .node-collapse             <- VIS-7: real <button> toggling
   *                                     .node-card.collapsed + its own
   *                                     aria-expanded. Sibling of the
   *                                     handle, NOT nested inside it — same
   *                                     press-mistake reasoning as the
   *                                     remove button below.
   *       .node-remove-btn           <- sibling of the handle, NOT nested
   *                                     inside it — clicking it can't be
   *                                     mistaken for a handle-area press.
   *     .node-params                 <- ParamControls.render() target
   *                                     (still the render container — the
   *                                     ParamControls contract is
   *                                     untouched).
   *       .node-params-inner         <- VIS-7 wrap-AFTER-render: the rows
   *                                     ParamControls rendered into
   *                                     .node-params are moved into this
   *                                     inner wrapper in one pass, so
   *                                     src/param-controls.js stays
   *                                     byte-identical while CSS gets an
   *                                     animatable 0fr-collapse boundary.
   *
   * VIS-7 collapse state is SESSION-ONLY and never persisted: a collapsed
   * card re-expands whenever the card element is rebuilt — agent/preset
   * loads through loadModel() replace every card, and a structural
   * drag/remove only touches other cards. Default is EXPANDED; reset-on-
   * rebuild is the accepted v1 behavior (per the 2026-08-28 amendment).
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
    // VIS-4 channel-strip legend hooks, mirroring the palette chips'
    // data-family/data-initials pair one column to the left: data-family
    // maps the card's 3px family top edge + header legend square to its
    // --family-* token in styles/main.css; data-initials is that square's
    // silkscreen text (rendered via CSS attr(data-initials) — never a
    // second copy in the DOM text). Both come from the same
    // familyInitials() lookup the palette uses, so card and palette
    // legends share one vocabulary and can never drift. Additive only —
    // no element, class, or text changes here.
    card.setAttribute('data-family', type);
    card.setAttribute('data-initials', familyInitials(type));

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

    // UI-2 (cycle 3): the formal experimental badge on the card of every
    // type in EXPERIMENTAL_TYPES (autotune only, cycle-3 scope) — the
    // amber tag after the silkscreen label. SR-visible by content (see
    // createExperimentalBadge); title carries the why.
    if (isExperimentalType(type)) {
      handle.appendChild(createExperimentalBadge(type, false));
    }

    // VIS-7: the collapse chevron — a real button (keyboard-operable for
    // free, announced by its aria-label) between the handle and the remove
    // button. aria-expanded is the toggle's OWN state mirror; the visual
    // state lives on the card (.collapsed), which is the only thing CSS
    // needs. Session-only: nothing here persists (see the doc block above).
    var collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'node-collapse';
    collapseBtn.setAttribute('aria-expanded', 'true');
    collapseBtn.setAttribute('aria-label', 'Toggle parameters for ' + window.NodeTypes.getLabel(type));
    collapseBtn.textContent = '▾'; // chevron, points down at the visible params

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'node-remove-btn';
    removeBtn.setAttribute('aria-label', 'Remove ' + window.NodeTypes.getLabel(type));
    removeBtn.textContent = '×'; // ×

    header.appendChild(handle);
    header.appendChild(collapseBtn);
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

    // VIS-7 wrap-AFTER-render (see the doc block above): ParamControls has
    // by now placed its .param-row children directly inside
    // paramsContainer; move them verbatim into one .node-params-inner
    // wrapper. DOM nodes are MOVED, not rebuilt, so every listener
    // ParamControls attached to its sliders survives untouched. This is the
    // ONLY place .node-params ever gains an inner wrapper, and it runs once
    // per card — ParamControls.render() (which clears its container) is
    // never called again on a live card.
    var paramsInner = document.createElement('div');
    paramsInner.className = 'node-params-inner';
    var renderedRows = Array.prototype.slice.call(paramsContainer.children);
    renderedRows.forEach(function (row) {
      paramsInner.appendChild(row);
    });
    paramsContainer.appendChild(paramsInner);

    // VIS-7: chevron toggle. Flips the card's .collapsed class and mirrors
    // the state into the button's own aria-expanded — everything CSS or an
    // assistive tech needs, nothing more. stopPropagation for the same
    // defensive reason as the remove button (the button is a header sibling
    // of the SortableJS handle, so it can never start a drag anyway).
    // Presentation-ONLY: no model, no graph, no persistence — collapsing a
    // card changes nothing but how much of it is visible.
    collapseBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      card.classList.toggle('collapsed');
      // Read the class back rather than trusting toggle()'s return value —
      // some minimal DOM stubs return undefined from toggle().
      var collapsed = card.classList.contains('collapsed');
      collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
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
      // Issue #6: a HUMAN removal — bump the state revision so a stale
      // agent Undo entry can no longer auto-apply over it.
      if (window.AgentUI && typeof window.AgentUI.noteHumanEdit === 'function') {
        window.AgentUI.noteHumanEdit();
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
  // order never changes via drag. onStart/onEnd maintain the MC-4 drag flag
  // (see `dragActive` above) — a palette drag is heading for the chain
  // list, so agent mutations must queue behind it too.
  //
  // Refinement entry 3: `draggable: '.node-chip'` scopes the drag ITEMS to
  // the chips now that the palette list also carries interleaved group
  // headers — SortableJS resolves the drag target with
  // closest(target, options.draggable, el), so a press on a header matches
  // nothing and never starts a drag, while a press on a chip resolves to
  // exactly the element the default '>*' selector would have picked
  // (chips are direct children). Chip drag behavior is unchanged; the
  // headers are inert to the pointer.
  var paletteSortable = new window.Sortable(paletteListEl, {
    group: { name: 'chain-group', pull: 'clone', put: false },
    sort: false,
    draggable: '.node-chip',
    forceFallback: true,
    animation: 150,
    onStart: function () { dragActive = true; },
    onEnd: function () { dragActive = false; },
  });

  // Chain list: the real signal chain. `handle` restricts drag-initiation
  // to each card's .node-drag-handle (Part C) so the slider and remove
  // button never trigger a reorder. onStart/onEnd maintain the MC-4 drag
  // flag (see `dragActive` above). onEnd is SortableJS's canonical
  // drag-finished event (it fires after the drop's onAdd/onSort commit
  // handlers, on drop anywhere including a cancelled-outside drop), so the
  // flag going false means both the DOM and `chainModel` are already final
  // — a mutation that was queued behind the drag can safely read/replace
  // the model at that point.
  var chainSortable = new window.Sortable(chainListEl, {
    group: { name: 'chain-group', pull: true, put: true },
    handle: '.node-drag-handle',
    forceFallback: true,
    animation: 150,
    onStart: function () { dragActive = true; },
    onEnd: function () { dragActive = false; },

    // A palette item was dropped in. Replace the cloned palette DOM node
    // with a real, stateful node-card (Part C) — NOT a model
    // recompute/buildGraph call; that happens in onSort below, which fires
    // right after this for the same drop (see the file-level comment on
    // why the two are split like this).
    onAdd: function (evt) {
      var clonedItem = evt.item;
      var type = clonedItem.getAttribute('data-node-type');
      var card = createNodeCard(type, defaultParamsForType(type));
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
    // commit). R2-2: the body now lives in commitStructuralChange()
    // (shared verbatim with the keyboard add path addNodeType()).
    onSort: function () {
      commitStructuralChange();
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
    // pointer-locked and dragging is impossible in that state — the old
    // always-drag default was an invitation the gated surface could not
    // honor (critique P2). Flipped HERE, at the exact transition where the
    // palette un-locks, to the cycle-1 drag teaching copy (verbatim — the
    // only place that string lives now). updateEmptyHint() only ever
    // toggles display, so the live copy persists across every later
    // empty/populated state (e.g. removing the last node re-shows it).
    if (emptyHintEl) {
      emptyHintEl.textContent = 'Drag an effect here to start building your chain';
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
   * MC-4: is a user drag (palette or chain list) currently in progress?
   * Maintained exclusively by the SortableJS onStart/onEnd handlers above;
   * read by src/mcp-tools.js to serialize agent mutations behind user
   * drags (OQ-7). Pure read — never mutates anything.
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
    updated[paramId] = value;
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
      window.Persistence.saveCurrentChain(chainModel);
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
  // VIS-7b (2026-08-28 user direction) — flow-direction toggle. The chain
  // canvas ships TOP-DOWN (VIS-7) with LEFT→RIGHT kept one click away:
  // a class flip on the canvas panel (all orientation styling is scoped
  // under .flow-horizontal in main.css) plus a persisted preference under
  // this app's own localStorage key (karaoke-*-v1 naming, same try/catch
  // discipline as preset-store/persistence). SortableJS needs no config
  // change in either mode — its detectDirection reads the container's
  // computed flex-direction, exactly the property the class flip changes.
  // ---------------------------------------------------------------------
  var FLOW_KEY = 'karaoke-flow-orientation-v1';
  var flowPanel = null;
  var flowButton = null;

  function readFlowPreference() {
    var stored = null;
    try {
      stored = window.localStorage.getItem(FLOW_KEY);
    } catch (e) {
      /* private mode / storage disabled — default below, one-time warn on write */
    }
    return stored === 'horizontal' ? 'horizontal' : 'vertical';
  }

  function writeFlowPreference(mode) {
    try {
      window.localStorage.setItem(FLOW_KEY, mode);
    } catch (e) {
      console.warn('ChainCanvas: could not persist flow orientation (storage unavailable)');
    }
  }

  function applyFlow(mode) {
    if (flowPanel) {
      if (mode === 'horizontal') {
        flowPanel.classList.add('flow-horizontal');
      } else {
        flowPanel.classList.remove('flow-horizontal');
      }
    }
    if (flowButton) {
      flowButton.textContent = mode === 'horizontal' ? 'FLOW: HORIZONTAL' : 'FLOW: VERTICAL';
      flowButton.setAttribute('aria-pressed', mode === 'vertical' ? 'true' : 'false');
    }
  }

  function initFlowToggle() {
    if (typeof document.querySelector !== 'function' ||
        typeof document.createElement !== 'function') {
      return;
    }
    flowPanel = document.querySelector('.canvas-panel');
    if (!flowPanel) {
      return;
    }
    flowButton = document.createElement('button');
    flowButton.type = 'button';
    flowButton.className = 'control flow-toggle';
    flowButton.setAttribute('aria-label', 'Toggle chain flow direction');
    flowButton.addEventListener('click', function () {
      var next = flowPanel.classList.contains('flow-horizontal') ? 'vertical' : 'horizontal';
      writeFlowPreference(next);
      applyFlow(next);
    });
    flowPanel.appendChild(flowButton);
    applyFlow(readFlowPreference());
  }

  initFlowToggle();

  window.ChainCanvas = {
    onEngineStarted: onEngineStarted,
    loadModel: loadModel,
    getCurrentModel: getCurrentModel,
    isDragActive: isDragActive,
    // Issue #5: the parameter-only write path (see updateNodeParam above).
    updateNodeParam: updateNodeParam,
  };
})();
