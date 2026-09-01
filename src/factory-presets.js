// FACTORY PRESET LIBRARY — thin loader over src/factory-library-data.js
// (wayfinder #30; map #26). The CONTENT — names, descriptions, tags,
// provenance, chains — lives in that data module; this file only hands out
// fresh copies under a stable contract. Amdocs of the old regime: this file
// used to hold the six presets as hand-mirrored literals with a
// "re-mirror BY HAND" discipline; that discipline is consciously amended
// (data + automated conformance test replaces hand-mirroring — see
// docs/adr/0001-factory-library-as-data.md). The audition rule is NOT
// amended: every entry is human-auditioned material, recorded in its
// provenance.
//
// Loaded as a plain (non-module) <script>, immediately AFTER
// src/factory-library-data.js per index.html's script order. IIFE-wrapped
// with a single `window.FactoryPresets` export. Fresh deep copies every
// call: ChainEditing.apply takes ownership of the arrays it is handed, so
// handing out shared references would let app state silently edit the
// "library".
//
// Exports and their consumers:
//   list()          {name, nodes}[] — the preset dropdown's factory path,
//                   mcp-tools.js's list_presets/get_preset factory group.
//                   Shape is EXACTLY two keys: tests/test-preset-tools.js
//                   deep-equals it strictly, so metadata NEVER leaks here.
//   describeAll()   {name, description, category}[] — the Presets tab's
//                   searchable list (UI-only, never nodes). `category` is
//                   the entry's primary tag humanized (#28 taxonomy, one
//                   source of truth — it absorbed compact-browsing v2's
//                   hand-assigned categories).
//   listDetailed()  {name, description, tags, primary, provenance}[] —
//                   additive (wayfinder #30): everything except nodes, so
//                   it can never become a second load path. presets-ui.js
//                   feeds its search from these tags; #32's metadata
//                   exposure reads the same entries.
//   groupOrder()    the category display order (data module's
//                   PRIMARY_GROUP_ORDER, humanized — cleanup first, then
//                   use-case, genre, vibe, gag; technique never groups).
//
// Degrade path: if src/factory-library-data.js failed to load (or a bare
// test sandbox loads only this file), every export returns EMPTY and the
// consumers' documented empty-library behavior takes over (flat user list
// in the dropdown, empty factory group in list_presets).
//
// Factory presets are NEVER persisted: the library is merged into the
// dropdown at RUNTIME, so a fresh profile sees the whole library with zero
// localStorage seeding, and PresetStore's 'karaoke-presets-v1' store stays
// exclusively the USER's namespace (PS-3 semantics untouched).
(function () {
  'use strict';

  function data() {
    return (window.FACTORY_LIBRARY && Array.isArray(window.FACTORY_LIBRARY.PRESETS))
      ? window.FACTORY_LIBRARY.PRESETS
      : [];
  }

  function copyProvenance(p) {
    var out = {
      origin: p.origin,
      auditionDate: p.auditionDate,
      verdict: p.verdict
    };
    if (p.note !== undefined) {
      out.note = p.note;
    }
    return out;
  }

  /**
   * The policy-relevant listing: EXACTLY {name, nodes} per entry, nodes
   * freshly deep-copied (params by Object.assign — params are flat).
   *
   * @returns {Array<{name: string, nodes: Array<{id: string, type: string, params: Object}>}>}
   */
  function list() {
    return data().map(function (preset) {
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
   * UI-only browse listing for the Presets tab's searchable list — never
   * nodes. `category` is DERIVED: the entry's primary tag from the #28
   * taxonomy, humanized ('use-case:speech/hosting' -> 'Speech/Hosting'),
   * so the browsing vocabulary has exactly one source of truth (the data
   * module's tags/primary) and can never drift from it. This absorbed the
   * compact-browsing v2 round's hand-assigned Karaoke/Music/Novelty/Speech
   * categories, which #28's decision supersedes.
   *
   * @returns {Array<{name: string, description: string, category: string}>}
   */
  function describeAll() {
    return data().map(function (preset) {
      return {
        name: preset.name,
        description: preset.description,
        category: humanizeTag(preset.primary)
      };
    });
  }

  /**
   * Humanize a taxonomy tag for display: the value half of 'axis:value',
   * each word (split on '/', '-', ' ') capitalized — 'gag:8-bit' ->
   * '8-Bit', 'vibe:epic/big' -> 'Epic/Big'. Presentation lives here in the
   * loader, never in the data module.
   *
   * @param {string} tag
   * @returns {string}
   */
  function humanizeTag(tag) {
    var value = tag.indexOf(':') !== -1 ? tag.slice(tag.indexOf(':') + 1) : tag;
    var out = '';
    var capNext = true;
    for (var i = 0; i < value.length; i++) {
      var ch = value[i];
      if (ch === '/' || ch === '-' || ch === ' ') {
        capNext = true;
        out += ch;
      } else if (capNext) {
        out += ch.toUpperCase();
        capNext = false;
      } else {
        out += ch;
      }
    }
    return out;
  }

  /**
   * Additive metadata listing (wayfinder #30): everything except nodes, all
   * freshly copied. The one hard rule: NO `nodes` key, ever — the load path
   * stays list() alone.
   *
   * @returns {Array<{name: string, description: string, tags: string[], primary: string, provenance: Object}>}
   */
  function listDetailed() {
    return data().map(function (preset) {
      return {
        name: preset.name,
        description: preset.description,
        tags: preset.tags.slice(),
        primary: preset.primary,
        provenance: copyProvenance(preset.provenance)
      };
    });
  }

  /**
   * The display order for primary-tag categories, from the data module's
   * PRIMARY_GROUP_ORDER, HUMANIZED to match describeAll()'s category
   * strings ('use-case:cleanup' -> 'Cleanup' first, then the rest of
   * use-case, genre, vibe, gag — technique never appears).
   *
   * @returns {string[]}
   */
  function groupOrder() {
    return (window.FACTORY_LIBRARY && Array.isArray(window.FACTORY_LIBRARY.PRIMARY_GROUP_ORDER))
      ? window.FACTORY_LIBRARY.PRIMARY_GROUP_ORDER.map(humanizeTag)
      : [];
  }

  window.FactoryPresets = {
    list: list,
    describeAll: describeAll,
    listDetailed: listDetailed,
    groupOrder: groupOrder
  };
})();
