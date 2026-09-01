// PS-4's FACTORY PRESET LIBRARY — static, shipped-with-the-app starting
// points for non-technical hosts (2026-08-28 user-directed amendment 3 at
// the QA-3 gate: "ship a small library of factory presets before initial
// release"; the QA-3 five volunteered as content).
//
// Loaded as a plain (non-module) <script>, immediately after
// src/default-preset.js per index.html's script order. IIFE-wrapped with a
// single `window.FactoryPresets` export — unlike default-preset.js's bare
// static literal, because the export is a FUNCTION: list() must hand every
// caller fresh, deep-copied nodes (ChainEditing.apply takes ownership
// of the array it is handed, so handing out the shared literal would let
// app state silently edit the "library").
//
// Content provenance — COPY VERBATIM, do not re-derive:
//   - 'Classic Karaoke' is window.DEFAULT_PRESET's chain verbatim
//     (src/default-preset.js — PX-3's committed default, ids 'n1'..'n6',
//     including that file's issue-#2 policy amendment of n2's threshold
//     and n6's ceiling — amended in both copies in the same edit).
//   - The other five are the QA-3 live-agent acceptance chains verbatim
//     (docs/ultron/qa/qa3-driver.js CHAINS 1-5 — all five rated 5/5
//     "usable without edits" 2026-08-28, zero policy rejections in the
//     run). Only each chain's `name` differs from the driver ('QA3 warm
//     ballad' -> 'Warm Ballad', 'QA3 rock shout' -> 'Rock Night', 'QA3
//     phone call' -> 'Phone Call Gag', 'QA3 big room' -> 'Big Room',
//     'QA3 clean speech' -> 'Clean Speech'); node ids ('qa-*'), param
//     values, order, and key order are byte-identical to the driver.
//
// Registry-driven honesty note: unlike the palette (populated at runtime
// from EffectCatalog.getAllTypes()), this library is NOT catalog-driven
// — it is fixed, QA-verified CONTENT, not a generated set. The registry
// governs which node types/params EXIST and validates these chains at
// load time (every factory Load applies through the same
// ChainEditing transaction user presets use), but nothing here is
// derived from the registry at runtime. If a node type or param ever
// changes incompatibly, these content literals must be updated deliberately.
//
// Consumed by:
//   - src/presets-ui.js — the preset dropdown's "Factory" <optgroup>, the
//     Load button's factory path (load-only: Delete refuses, Save As…
//     always writes the USER store — separate namespaces, no shadowing).
//   - src/mcp-tools.js — list_presets' factory group and
//     get_capabilities' factory-library disclosure.
//
// Factory presets are NEVER persisted: the library is merged into the
// dropdown at RUNTIME, so a fresh profile sees all six with zero
// localStorage seeding, and PresetStore's 'karaoke-presets-v1' store stays
// exclusively the USER's namespace (PS-3 semantics untouched).
//
// PRE-1 decision (cycle 3, 2026-08-29): no cycle-3 showcase preset is added
// yet. Three reasons, in force order:
//   1. Provenance: every entry above is user-accepted material (PX-3's
//      committed default; the QA-3 five, each rated 5/5 "usable without
//      edits"). The four new effects' user-judged acceptance run is QA-1,
//      which runs after MCP-1 — shipping unauditioned chains into the
//      library would break the provenance discipline that file documents.
//   2. Conformance gate: RESOLVED by MCP-1 (2026-08-29) — set_chain's
//      param validation (checkSpecValue in src/mcp-tools.js) now accepts
//      the discrete values-type params (autotune's canonical string
//      Key/Scale and their raw enums are legal through every
//      param-taking tool), so a preset carrying them passes the
//      library's own conformance test. Only provenance (reason 1) keeps
//      the showcase preset queued.
//   3. Landing point: once QA-1 (effects user-accepted) is in, a showcase
//      preset is a one-entry addition here plus the policy test's
//      count/node-file update in the same edit.
(function () {
  'use strict';

  var FACTORY_PRESETS = [
    {
      // Verbatim from src/default-preset.js (window.DEFAULT_PRESET) —
      // including its issue-#2 policy amendment, applied to both copies in
      // the same edit so they stay byte-identical: n2 threshold -16 dB
      // (was -24) and n6 ceiling -3 dB (was -1) are the loudest/closest
      // legal pair, with gain budget 0 + 0.57*|-16| + 0.57*|-3| = 10.83 dB
      // <= +12 dB (margin 1.17 dB) and the ceiling inside the published
      // [-12, -3] dB limiter range. Every other param is the original PX-3
      // value.
      name: 'Classic Karaoke',
      description: 'The all-purpose starting point: gentle leveling, a warm-neutral EQ, a short slap-back delay, and a light room reverb.',
      nodes: [
        { id: 'n1', type: 'gain',       params: { gainDb: 0 } },
        { id: 'n2', type: 'compressor', params: { threshold: -16, ratio: 4, attack: 0.01, release: 0.25 } },
        { id: 'n3', type: 'eq',         params: { lowGain: 0, midGain: 0, highGain: 0 } },
        { id: 'n4', type: 'delay',      params: { timeMs: 300, feedback: 25, mix: 25 } },
        { id: 'n5', type: 'reverb',     params: { mix: 20 } },
        { id: 'n6', type: 'limiter',    params: { ceiling: -3, release: 50 } }
      ]
    },
    {
      // QA-3 CHAINS[1] verbatim (name adjusted to the library's friendly
      // name). Warm ballad: gentle compression, low warmth, light hall.
      name: 'Warm Ballad',
      description: 'Gentle compression, a touch of low-end warmth, and a light hall reverb for slow, close-up songs.',
      nodes: [
        { id: 'qa-g1', type: 'gain', params: { gainDb: 1 } },
        { id: 'qa-e1', type: 'eq', params: { lowGain: 1, midGain: 0, highGain: 0.5 } },
        { id: 'qa-c1', type: 'compressor', params: { threshold: -10, ratio: 2.5, attack: 0.02, release: 0.3 } },
        { id: 'qa-r1', type: 'reverb', params: { mix: 35 } },
        { id: 'qa-l1', type: 'limiter', params: { ceiling: -6, release: 150 } }
      ]
    },
    {
      // QA-3 CHAINS[2] verbatim. Rock shout: stronger compression,
      // top-end bite, short slap, dry.
      name: 'Rock Night',
      description: 'Stronger compression and top-end bite with a short, dry slap delay — built to cut through a loud room.',
      nodes: [
        { id: 'qa-g2', type: 'gain', params: { gainDb: 0 } },
        { id: 'qa-e2', type: 'eq', params: { lowGain: -1, midGain: 0, highGain: 2 } },
        { id: 'qa-c2', type: 'compressor', params: { threshold: -11, ratio: 4, attack: 0.004, release: 0.18 } },
        { id: 'qa-d2', type: 'delay', params: { timeMs: 110, feedback: 15, mix: 18 } },
        { id: 'qa-l2', type: 'limiter', params: { ceiling: -6, release: 100 } }
      ]
    },
    {
      // QA-3 CHAINS[3] verbatim. Phone-filter gag: band-limited, slightly
      // crushed, intelligible.
      name: 'Phone Call Gag',
      description: 'Band-limited and lightly crushed for the classic "calling from a phone" bit — still fully intelligible.',
      nodes: [
        { id: 'qa-e3', type: 'eq', params: { lowGain: -10, midGain: 2, highGain: -8 } },
        { id: 'qa-c3', type: 'compressor', params: { threshold: -10, ratio: 8, attack: 0.002, release: 0.12 } },
        { id: 'qa-l3', type: 'limiter', params: { ceiling: -6, release: 80 } }
      ]
    },
    {
      // QA-3 CHAINS[4] verbatim. Big-room epic: long reverb, wide delay,
      // vocal up front.
      name: 'Big Room',
      description: 'Long reverb and a wide delay for an epic, arena-sized space, with the vocal still riding up front.',
      nodes: [
        { id: 'qa-g4', type: 'gain', params: { gainDb: 1 } },
        { id: 'qa-e4', type: 'eq', params: { lowGain: 0.5, midGain: 0, highGain: 1 } },
        { id: 'qa-c4', type: 'compressor', params: { threshold: -8, ratio: 2.5, attack: 0.015, release: 0.35 } },
        { id: 'qa-d4', type: 'delay', params: { timeMs: 320, feedback: 30, mix: 22 } },
        { id: 'qa-r4', type: 'reverb', params: { mix: 50 } },
        { id: 'qa-l4', type: 'limiter', params: { ceiling: -6, release: 180 } }
      ]
    },
    {
      // QA-3 CHAINS[5] verbatim. Clean speech: light leveling, no audible
      // effects.
      name: 'Clean Speech',
      description: 'Light leveling with no audible coloring — for hosting, announcements, or anywhere the voice should just sound like itself.',
      nodes: [
        { id: 'qa-e5', type: 'eq', params: { lowGain: -1, midGain: 0, highGain: -1 } },
        { id: 'qa-c5', type: 'compressor', params: { threshold: -10, ratio: 2, attack: 0.005, release: 0.2 } },
        { id: 'qa-l5', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    }
  ];

  /**
   * List the factory library, in display order (Classic Karaoke first,
   * then the QA-3 five in prompt order). Every call returns FRESH objects
   * with freshly copied params — callers may take ownership of the nodes
   * (ChainEditing.apply does) without any risk of mutating the library
   * itself.
   *
   * @returns {Array<{name: string, nodes: Array<{id: string, type: string, params: Object}>}>}
   */
  function list() {
    return FACTORY_PRESETS.map(function (preset) {
      return {
        name: preset.name,
        nodes: preset.nodes.map(function (entry) {
          return {
            id: entry.id,
            type: entry.type,
            params: Object.assign({}, entry.params)
          };
        })
      };
    });
  }

  /**
   * ADDITIVE, UI-only export for the Presets tab's curated browse cards.
   * Returns just {name, description} — never `nodes` — so this can never
   * become a second load-path or drift from list()'s policy-relevant
   * shape. list() itself is untouched by this addition: existing
   * consumers (the preset dropdown, mcp-tools.js's list_presets/
   * get_preset, tests/test-preset-tools.js's strict {name, nodes}
   * deepEqual) see zero change.
   *
   * @returns {Array<{name: string, description: string}>}
   */
  function describeAll() {
    return FACTORY_PRESETS.map(function (preset) {
      return { name: preset.name, description: preset.description };
    });
  }

  window.FactoryPresets = {
    list: list,
    describeAll: describeAll
  };
})();
