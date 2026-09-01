// localStorage autosave for the Node-Based Web Audio Chain Builder.
//
// Loaded as a plain (non-module) <script> — same IIFE + single
// `window.X` export pattern as the rest of this project. Depends on
// window.AudioGraph (src/audio-graph.js), window.PresetSchema
// (src/preset-schema.js), and window.DEFAULT_PRESET (src/default-preset.js)
// — all already loaded by the time this file runs, per index.html's script
// order.
//
// PS-2 scope: everything under the single localStorage key STORAGE_KEY
// below ('karaoke-autosave-v1'). Two entry points (plus FEW-1's layout
// seam, described further down):
//   - saveCurrentChain() serializes the supplied accepted model (via
//     PresetSchema.serialize()) and writes it to that key. ChainEditing
//     calls it after every accepted logical edit; Canvas calls it after a
//     layout-only move or resize. This is purely event-driven: there is no
//     timer/interval anywhere in this file.
//   - loadInitialModel() is called exactly once, by src/main.js, right
//     after AudioEngine.start() resolves successfully. It reads/validates
//     whatever is under STORAGE_KEY and returns a ready-to-load
//     `{id, type, params}[]` array: the autosaved model if one exists and is
//     well-formed, otherwise a fresh copy of window.DEFAULT_PRESET.nodes
//     (PX-3's "Classic Karaoke" default — see src/default-preset.js and
//     docs/ultron/design/px3-default-chain-and-preset.md's "First-run
//     behavior" section).
//
// Fails safe, always: a missing key, a JSON.parse() failure, a
// PresetSchema.deserialize() validation failure (corrupt/malformed/
// wrong-schemaVersion data — e.g. hand-edited or from an old, incompatible
// build — plus PRE-1's per-type param contracts for the cycle-3 node
// types), or an autosave naming an effect type the live catalog does not know
// (PRE-1, cycle 3 — see unregisteredNodeType below) is caught right here,
// logged via console.error for debuggability, and treated exactly like
// "nothing saved yet" — falling back to the default preset. Nothing in this
// file ever throws up to its caller; main.js's Start handler can call
// loadInitialModel() unconditionally, with no try/catch of its own, and is
// guaranteed to get back a valid model either way.
(function () {
  'use strict';

  var STORAGE_KEY = 'karaoke-autosave-v1';

  // ---------------------------------------------------------------------
  // FEW-1 (cycle 4): the LAYOUT seam. The autosave slot grows from a bare
  // PresetSchema wire object to a versioned ENVELOPE of this module's own:
  //
  //   {
  //     autosaveVersion: 2,                     // THIS module's envelope
  //     chain: { schemaVersion: 1, name: '__autosave__', nodes: [...] },
  //                                             // PresetSchema UNTOUCHED
  //     layout: { <nodeId>: {x, y, scale, flow}, ... }
  //   }
  //
  // Deliberate seams:
  //   - PresetStore / preset schema are NOT extended (plan: "presets stay
  //     chain-only" — a named preset never carries positions; loading one
  //     leaves the board tidy). The chain half of the envelope is exactly
  //     the same PresetSchema.serialize() wire form as before, so preset
  //     data, byte-for-byte, is untouched by this change.
  //   - The localStorage KEY stays 'karaoke-autosave-v1' (the rebrand
  //     decision: keys are kept for data preservation). Versioning rides
  //     the envelope's own `autosaveVersion` field instead.
  //   - LEGACY payloads (everything saved before cycle 4) are the bare
  //     `{schemaVersion, name, nodes}` preset shape — no envelope. They
  //     are detected by the absence of `autosaveVersion` and MIGRATE on
  //     load: chain loads as-is, layout resolves to `{}` — i.e. every
  //     node takes the incumbent tidy vertical stack (the auto-layout
  //     the canvas already computes when no explicit position exists).
  //     No positions are synthesized here; "no entry" IS the tidy stack.
  //     The migration is idempotent: loading a legacy payload twice
  //     yields identical results, and the first save after such a load
  //     rewrites the slot as a v2 envelope with `layout: {}` — the
  //     steady state — which then loads through the v2 path forever.
  //   - An `autosaveVersion` this build does not know (a future shape)
  //     rejects exactly like an unsupported PresetSchema version: clear
  //     error, default-chain fallback, never a misread.
  //   - Layout entries (board redesign, 2026-09-01 — AUTOSAVE_VERSION 3):
  //     the free board's x/y seats, scale, and flow are gone along with
  //     the board itself (chain order is now the model's own array order,
  //     PD-4 — nothing left to store separately). An entry carries just
  //     `w`, an optional finite number (the card's own manually-resized
  //     width, clamped 144..640 px; absent = the 144px minimum default).
  //     sanitizeLayout() normalizes every entry to exactly that
  //     shape, PRUNES entries for node ids the accompanying chain does
  //     not contain (node removed — pruning happens on both save and
  //     load), and drops hostile entries (non-object, a `w` present but
  //     not a finite number) rather than throwing: a corrupt layout must
  //     never take down an otherwise-valid chain. A pre-redesign v2
  //     payload's stray `x`/`y`/`scale`/`flow` keys are simply ignored,
  //     not migrated — the version bump means a v2 slot degrades once
  //     through the "unknown version -> default-chain fallback" path
  //     (layout only; the chain itself is PresetSchema's own wire form,
  //     untouched by this change) and immediately re-saves as v3.
  // ---------------------------------------------------------------------
  var AUTOSAVE_VERSION = 3;

  /**
   * Normalize/prune a candidate layout map against the node ids the
   * accompanying chain actually contains. Never throws — every failure
   * mode degrades to dropping the offending entry (that node falls back
   * to its default width), and a wholesale-hostile `layout`
   * (non-object, throwing getters, ...) degrades to `{}`.
   *
   * @param {*} layout - candidate layout map (any hostility).
   * @param {string[]} knownIds - node ids of the chain being saved/loaded.
   * @returns {Object<string, {w?: number}>}
   */
  function sanitizeLayout(layout, knownIds) {
    var clean = {};
    try {
      if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
        return clean;
      }
      Object.keys(layout).forEach(function (nodeId) {
        var entry;
        try {
          if (knownIds.indexOf(nodeId) === -1) {
            return; // node no longer in the chain — pruned
          }
          entry = layout[nodeId];
        } catch (err) {
          return; // hostile getter on this key — drop just this entry
        }
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return; // hostile entry — dropped, node takes its default width
        }
        // Per-card WIDTH: a finite number clamped into the condensed
        // range (9rem..40rem, mirroring main.css's bounds and
        // canvas.js's CARD_W_MIN_PX/CARD_W_MAX_PX); anything else drops
        // the field entirely rather than storing an empty entry — an
        // entry with no `w` at all is the normal shape now (the node
        // simply has no manual resize on record), not a degraded one.
        if (typeof entry.w === 'number' && isFinite(entry.w)) {
          clean[nodeId] = { w: Math.min(640, Math.max(144, entry.w)) };
        }
      });
    } catch (err) {
      // Throwing getters / prototype mischief — treat as no layout.
      return {};
    }
    return clean;
  }

  /**
   * FEW-1: fail-soft read of JUST the layout currently stored under
   * STORAGE_KEY (any shape — legacy, envelope, corrupt). Used by
   * saveCurrentChain()'s carry-forward default; never throws, never
   * logs (a corrupt slot's diagnosis belongs to the load path).
   * @returns {Object|null} the stored raw layout object, or null.
   */
  function readStoredLayoutRaw() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        parsed.autosaveVersion === undefined
      ) {
        return null; // legacy preset shape (or unparsable) — no layout
      }
      return parsed.layout && typeof parsed.layout === 'object' ? parsed.layout : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Serialize an accepted model and write it to localStorage under
   * STORAGE_KEY. ChainEditing calls this after logical transactions;
   * Canvas calls it after layout-only gestures — never on a timer.
   *
   * FEW-1: the written payload is now the versioned ENVELOPE (see
   * AUTOSAVE_VERSION above) — chain wire form unchanged, plus a pruned,
   * normalized `layout` map. The optional second parameter is the layout
   * seam (each node id's manually-resized width, see sanitizeLayout above):
   *   - `undefined` (the only form today's callers use): CARRY FORWARD
   *     whatever layout is already stored, pruned against the model being
   *     saved. Until FEW-2 wires real positions this is a no-op in
   *     practice (nothing writes a layout yet), but it guarantees a
   *     layout-less save — a param tweak, an agent rebuild — can never
   *     silently wipe positions some other path stored.
   *   - a layout object: normalized + pruned against the model's ids and
   *     stored (entries for removed nodes never linger in the slot).
   *   - `null`: an EXPLICIT clear — the stored layout becomes `{}` (every
   *     node tidy), e.g. a future TIDY reset.
   *
   * @param {Array<{id: string, type: string, params: Object}>} [model] -
   *   optional. When omitted, falls back to window.AudioGraph.getModel().
   *   Production mutation callers pass the authoritative model explicitly;
   *   the fallback remains for standalone consumers.
   * @param {Object<string, {w?: number}>|null} [layout]
   *
   * Wrapped in try/catch: localStorage.setItem() can throw (e.g. quota
   * exceeded, private-browsing mode in some browsers) and this must never
   * take down whatever UI interaction (a slider drag, a drag-and-drop drop)
   * triggered the save. A failed save just means this particular change
   * isn't persisted — the live chain itself is completely unaffected.
   */
  function saveCurrentChain(model, layout) {
    try {
      var modelToSave = model || window.AudioGraph.getModel();
      var serialized = window.PresetSchema.serialize('__autosave__', modelToSave);
      var knownIds = modelToSave.map(function (entry) {
        return entry.id;
      });
      var layoutToSave;
      if (layout === undefined) {
        layoutToSave = readStoredLayoutRaw(); // carry forward (null -> {})
      } else if (layout === null) {
        layoutToSave = {}; // explicit clear — everything tidy
      } else {
        layoutToSave = layout;
      }
      var payload = JSON.stringify({
        autosaveVersion: AUTOSAVE_VERSION,
        chain: serialized,
        layout: sanitizeLayout(layoutToSave, knownIds)
      });
      localStorage.setItem(STORAGE_KEY, payload);

      // Issue #20: setItem returning is not proof of persistence. Some
      // storage shims/privacy modes silently drop a write, so verify the
      // exact bytes through the same slot before reporting saved:true.
      if (localStorage.getItem(STORAGE_KEY) !== payload) {
        throw new Error('Autosave verification failed: storage did not retain the written payload.');
      }
      announceSaveState(true);
      return { saved: true };
    } catch (err) {
      console.error('Persistence: failed to save chain to localStorage', err);
      announceSaveState(false);
      return { saved: false, error: err };
    }
  }

  // ---- Autosave health latch (#16 finding) --------------------------------
  //
  // A failed save used to be console-only: edits looked durable and then
  // silently disappeared after reload. The latch records the last save's
  // outcome, announces transitions on a DOM event (guarded — a harness
  // with no document just skips the event), and exposes the state via
  // isSaveFailed() so the UI can warn the operator for as long as saves
  // keep failing. The LIVE chain is unaffected either way — a storage
  // failure never interrupts audio.

  var lastSaveFailed = false;

  function announceSaveState(succeeded) {
    var was = lastSaveFailed;
    lastSaveFailed = !succeeded;
    try {
      if (typeof document !== 'undefined' && document &&
          typeof document.dispatchEvent === 'function' &&
          typeof CustomEvent === 'function') {
        document.dispatchEvent(
          new CustomEvent(succeeded ? 'chain-autosave-recovered' : 'chain-autosave-failed')
        );
      }
    } catch (err) {
      // Event dispatch is advisory; the latch above is the state.
    }
    if (was !== lastSaveFailed && typeof console !== 'undefined' && console.warn) {
      console.warn(
        succeeded
          ? 'Persistence: autosave recovered — edits are durable again.'
          : 'Persistence: autosave is FAILING — edits will not survive a reload.'
      );
    }
  }

  /**
   * PRE-1 (cycle 3): does `nodes` name an effect type the LIVE catalog does
   * not know? Returns the first offending type name (truthy) or false.
   *
   * deserialize() stays deliberately structural about which types exist
   * (catalog knowledge is not preset-schema's job — see that file's
   * header), but WITHOUT this guard a hand-edited autosave naming a bogus
   * type would sail through deserialize and then die inside
   * AudioGraph.buildGraph()'s synchronous "unknown effect type" throw —
   * mid-loadModel, mid-Start, leaving the canvas half-cleared. Rejecting it
   * HERE routes it through this module's existing recovery (default-chain
   * fallback) instead. The check consults the LIVE EffectCatalog (the same
   * source of truth buildGraph creates effects from), and degrades to "all
   * registered" (today's behavior) whenever the catalog is absent or empty —
   * a bare harness
   * loading this file without the node files, where buildGraph's own
   * unknown-type check remains the backstop.
   *
   * @param {Array<{id: string, type: string, params: Object}>} nodes
   * @returns {string|false}
   */
  function unregisteredNodeType(nodes) {
    try {
      if (!window.EffectCatalog || typeof window.EffectCatalog.getAllTypes !== 'function') {
        return false;
      }
      var known = window.EffectCatalog.getAllTypes();
      if (!known || known.length === 0) {
        return false;
      }
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] && known.indexOf(nodes[i].type) === -1) {
          return nodes[i].type;
        }
      }
    } catch (err) {
      return false;
    }
    return false;
  }

  /**
   * Read and validate whatever is currently under STORAGE_KEY, migrating
   * legacy payloads (FEW-1 — see AUTOSAVE_VERSION above).
   *
   * Envelope v2: `chain` goes through PresetSchema.deserialize() +
   * the unregistered-type guard exactly as before; `layout` goes through
   * sanitizeLayout() against the loaded chain's ids — a hostile layout
   * degrades to `{}` (tidy stack) WITHOUT rejecting the chain.
   *
   * Legacy shape (no `autosaveVersion`): the payload IS the preset wire
   * object — validated through the same deserialize() path it always
   * used, and layout resolves to `{}` (the tidy-stack migration; no
   * positions are synthesized).
   *
   * @returns {{nodes: Array<{id: string, type: string, params: Object}>|null,
   *            layout: Object<string, {w?: number}>}}
   *   nodes is null when nothing valid is saved (the caller falls back to
   *   the default chain — whose layout is likewise `{}`). Never throws.
   */
  function readAutosave() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.error('Persistence: failed to read from localStorage', err);
      return { nodes: null, layout: {} };
    }
    if (!raw) {
      return { nodes: null, layout: {} };
    }
    try {
      var parsed = JSON.parse(raw);
      var chainData = parsed;
      var layoutData = null;
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        parsed.autosaveVersion !== undefined
      ) {
        if (parsed.autosaveVersion !== AUTOSAVE_VERSION) {
          throw new Error(
            'Persistence: unsupported autosave envelope version ' +
              JSON.stringify(parsed.autosaveVersion) +
              ' (expected ' + AUTOSAVE_VERSION + ').'
          );
        }
        chainData = parsed.chain;
        layoutData = parsed.layout;
      }
      var result = window.PresetSchema.deserialize(chainData);
      var unknownType = unregisteredNodeType(result.nodes);
      if (unknownType !== false) {
        throw new Error(
          'autosaved chain names unregistered node type "' + unknownType + '"'
        );
      }
      var knownIds = result.nodes.map(function (entry) {
        return entry.id;
      });
      return { nodes: result.nodes, layout: sanitizeLayout(layoutData, knownIds) };
    } catch (err) {
      console.error('Persistence: autosaved data was invalid/corrupt, falling back to default', err);
      return { nodes: null, layout: {} };
    }
  }

  /**
   * The one function src/main.js calls, once, right after
   * AudioEngine.start() succeeds. Always returns a ready-to-load
   * `{id, type, params}[]` array — either the autosaved chain, or (when
   * nothing valid is saved) a fresh, independent copy of
   * window.DEFAULT_PRESET.nodes so the caller can freely mutate the result
   * (e.g. submit it to ChainEditing.apply(), which will) without risk of
   * mutating the shared DEFAULT_PRESET data itself.
   *
   * FEW-1: unchanged in shape and behavior — layout rides the SEPARATE
   * loadInitialLayout() seam so this function's array contract (main.js,
   * and the committed test suites that drive it) never shifts.
   *
   * @returns {Array<{id: string, type: string, params: Object}>}
   */
  function loadInitialModel() {
    var autosaved = readAutosave();
    if (autosaved.nodes) {
      return autosaved.nodes;
    }
    return window.DEFAULT_PRESET.nodes.map(function (entry) {
      return { id: entry.id, type: entry.type, params: Object.assign({}, entry.params) };
    });
  }

  /**
   * FEW-1: the layout half of the same read — the pruned, normalized
   * per-node position/scale/flow map for the autosaved chain, `{}` when
   * there is no layout (nothing saved, LEGACY payload migrated, preset
   * load's tidy state, or a hostile layout that failed soft). `{}` means
   * "every node takes the incumbent tidy vertical stack" — the consumer
   * (FEW-2, canvas) treats absence-of-entry as auto-layout; nothing here
   * ever synthesizes tidy coordinates. The default-chain fallback (no
   * valid autosave) likewise yields `{}`: the default chain has never
   * carried positions. Re-reads the slot rather than caching, so a caller
   * that runs it after loadInitialModel() sees the same payload both read.
   *
   * @returns {Object<string, {w?: number}>}
   */
  function loadInitialLayout() {
    return readAutosave().layout;
  }

  window.Persistence = {
    saveCurrentChain: saveCurrentChain,
    loadInitialModel: loadInitialModel,
    loadInitialLayout: loadInitialLayout,
    // Autosave health for the operator warning (#16): true while the most
    // recent save failed (latched until a later save succeeds).
    isSaveFailed: function () {
      return lastSaveFailed;
    },
  };
})();
