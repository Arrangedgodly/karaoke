// FACTORY LIBRARY DATA — the structured content of the shipped preset
// library (wayfinder #30; taxonomy per #28; map #26). Pure data, no logic:
// loaded as a plain (non-module) <script> immediately BEFORE
// src/factory-presets.js (the thin loader), per index.html's script order.
// IIFE-wrapped with a single `window.FACTORY_LIBRARY` export.
//
// This file consciously AMENDS the hand-mirror discipline that lived at the
// top of src/factory-presets.js ("re-mirror BY HAND"): the library is now
// DATA validated by an automated conformance test
// (tests/test-factory-library.js) against the LIVE EffectCatalog registry
// and PresetSchema — see docs/adr/0001-factory-library-as-data.md. What is
// NOT amended: the audition rule. Every entry here is human-auditioned
// material (provenance records it); nothing enters unauditioned, and drift
// (a node type/param changing incompatibly) pulls the affected preset from
// the library until it is re-auditioned — the test fails naming the preset.
//
// Entry shape:
//   name         display name (unique, non-empty)
//   description  1–2 sentences, the agent-matching surface — user words,
//                artist shorthand where universal, complaint vocabulary the
//                preset fixes/avoids (checked at audition, per #28)
//   tags         combinable 'axis:value' tags; vocabularies are APPEND-ONLY
//                (a tag is added only when a real user request fails to
//                match — never speculatively)
//   primary      the ONE tag the preset groups under in the dropdown
//                (optgroup order: PRIMARY_GROUP_ORDER, cleanup first)
//   provenance   {origin, auditionDate, verdict, note?} — verdict is
//                'accepted' or the entry does not belong here
//   nodes        the chain, PRESIDED over by the schema: byte-identical
//                QA-verified content, do not re-derive (see per-entry
//                comments; node param values stay verbatim)
(function () {
  'use strict';

  // The four PUBLIC axes plus the internal technique axis (coverage/dedup
  // only — never a dropdown group, never steering copy). Values are the
  // exact legal tag strings; membership is exact-match.
  var VOCABULARIES = {
    // Append-only in action: 'retro' and 'psychedelic' joined vibe on
    // 2026-09-01 when the #31 seed batch filled the #28 cells "vibe ·
    // retro" and "vibe · psychedelic space lounge" — the first real
    // requests those cells exist to answer.
    genre: ['Pop', 'Rock', 'Metal', 'Rap/Hip-Hop', 'R&B/Soul', 'Country', 'Jazz', 'Dance/EDM', 'Musicals'],
    vibe: ['natural', 'warm', 'bright', 'dark/moody', 'epic/big', 'intimate', 'spacious', 'lo-fi', 'retro', 'psychedelic'],
    'use-case': ['performance', 'speech/hosting', 'cleanup', 'practice'],
    gag: ['robot', 'chipmunk', 'helium', 'deep-voice', 'radio', 'telephone', 'megaphone', 'darth-vader', '8-bit', 'monster/demon'],
    technique: ['hard-tune', 'pitch-gag', 'lo-fi', 'ambience-short', 'ambience-long', 'modulated/wide', 'clean']
  };

  // Dropdown optgroup order for primary tags: use-case first (cleanup
  // before all — the highest-demand cell per the #27 research), then
  // genre, vibe, gag. Every legal primary tag appears exactly once;
  // technique-axis tags are deliberately ABSENT (internal axis, #28).
  var PRIMARY_GROUP_ORDER = [
    'use-case:cleanup',
    'use-case:performance',
    'use-case:speech/hosting',
    'use-case:practice',
    'genre:Pop',
    'genre:Rock',
    'genre:Metal',
    'genre:Rap/Hip-Hop',
    'genre:R&B/Soul',
    'genre:Country',
    'genre:Jazz',
    'genre:Dance/EDM',
    'genre:Musicals',
    'vibe:natural',
    'vibe:warm',
    'vibe:bright',
    'vibe:dark/moody',
    'vibe:epic/big',
    'vibe:intimate',
    'vibe:spacious',
    'vibe:lo-fi',
    'vibe:retro',
    'vibe:psychedelic',
    'gag:robot',
    'gag:chipmunk',
    'gag:helium',
    'gag:deep-voice',
    'gag:radio',
    'gag:telephone',
    'gag:megaphone',
    'gag:darth-vader',
    'gag:8-bit',
    'gag:monster/demon'
  ];

  var PRESETS = [
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
      tags: ['use-case:performance', 'vibe:natural', 'technique:ambience-short'],
      primary: 'use-case:performance',
      provenance: {
        origin: "window.DEFAULT_PRESET verbatim — PX-3's committed default incl. the issue-#2 policy amendment (src/default-preset.js)",
        auditionDate: 'PX-3 gate (pre-library)',
        verdict: 'accepted',
        note: "the app default that became the library's first entry at the PS-4 QA-3 gate"
      },
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
      tags: ['use-case:performance', 'genre:Pop', 'vibe:warm', 'technique:ambience-long'],
      primary: 'vibe:warm',
      provenance: {
        origin: 'QA-3 CHAINS[1] verbatim (docs/ultron/qa/qa3-driver.js), name adjusted from "QA3 warm ballad"',
        auditionDate: '2026-08-28',
        verdict: 'accepted',
        note: 'rated 5/5 "usable without edits", zero policy rejections in the QA-3 run'
      },
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
      tags: ['use-case:performance', 'genre:Rock', 'vibe:bright', 'technique:ambience-short'],
      primary: 'genre:Rock',
      provenance: {
        origin: 'QA-3 CHAINS[2] verbatim (docs/ultron/qa/qa3-driver.js), name adjusted from "QA3 rock shout"',
        auditionDate: '2026-08-28',
        verdict: 'accepted',
        note: 'rated 5/5 "usable without edits", zero policy rejections in the QA-3 run'
      },
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
      tags: ['gag:telephone', 'use-case:performance', 'technique:lo-fi'],
      primary: 'gag:telephone',
      provenance: {
        origin: 'QA-3 CHAINS[3] verbatim (docs/ultron/qa/qa3-driver.js), name adjusted from "QA3 phone call"',
        auditionDate: '2026-08-28',
        verdict: 'accepted',
        note: 'rated 5/5 "usable without edits", zero policy rejections in the QA-3 run'
      },
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
      tags: ['use-case:performance', 'vibe:epic/big', 'technique:ambience-long'],
      primary: 'vibe:epic/big',
      provenance: {
        origin: 'QA-3 CHAINS[4] verbatim (docs/ultron/qa/qa3-driver.js), name adjusted from "QA3 big room"',
        auditionDate: '2026-08-28',
        verdict: 'accepted',
        note: 'rated 5/5 "usable without edits", zero policy rejections in the QA-3 run'
      },
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
      tags: ['use-case:speech/hosting', 'vibe:natural', 'technique:clean'],
      primary: 'use-case:speech/hosting',
      provenance: {
        origin: 'QA-3 CHAINS[5] verbatim (docs/ultron/qa/qa3-driver.js), name adjusted from "QA3 clean speech"',
        auditionDate: '2026-08-28',
        verdict: 'accepted',
        note: 'rated 5/5 "usable without edits", zero policy rejections in the QA-3 run'
      },
      nodes: [
        { id: 'qa-e5', type: 'eq', params: { lowGain: -1, midGain: 0, highGain: -1 } },
        { id: 'qa-c5', type: 'compressor', params: { threshold: -10, ratio: 2, attack: 0.005, release: 0.2 } },
        { id: 'qa-l5', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // #31 seed batch cell 2, PROMOTED at the 2026-09-01 audition (8 of 12
      // accepted). Nodes verbatim from the pen; only provenance was filled.
      name: 'Chipmunk Party',
      description: 'Squeaky chipmunk voice — the birthday-party gag that gets a laugh every line. Words stay crisp, never squeaky mush.',
      tags: ['gag:chipmunk', 'use-case:performance', 'technique:pitch-gag'],
      primary: 'gag:chipmunk',
      provenance: {
        origin: '#31 seed batch cell 2 (gag · chipmunk), authored offline 2026-09-01; promoted at the live ?audition Booth',
        auditionDate: '2026-09-01',
        verdict: 'accepted',
        note: 'auditioned live 2026-09-01, verdict accepted at the "usable without edits" bar (no note recorded)'
      },
      nodes: [
        { id: 'cp-e1', type: 'eq', params: { lowGain: -2, midGain: 1, highGain: 3 } },
        { id: 'cp-p1', type: 'pitchshift', params: { pitch: 7, mix: 100 } },
        { id: 'cp-l1', type: 'limiter', params: { ceiling: -6, release: 100 } }
      ]
    },
    {
      // #31 seed batch cell 3, PROMOTED at the 2026-09-01 audition.
      name: 'Deep Narrator',
      description: 'Movie-trailer depth with a cave behind it — dramatic readings, Darth Vader bits, "in a world…". Deep without turning to mud, never boomy over the words.',
      tags: ['gag:deep-voice', 'vibe:dark/moody', 'technique:pitch-gag'],
      primary: 'gag:deep-voice',
      provenance: {
        origin: '#31 seed batch cell 3 (gag · deep-voice), authored offline 2026-09-01; promoted at the live ?audition Booth',
        auditionDate: '2026-09-01',
        verdict: 'accepted',
        note: 'auditioned live 2026-09-01, verdict accepted at the "usable without edits" bar (no note recorded)'
      },
      nodes: [
        { id: 'dn-p1', type: 'pitchshift', params: { pitch: -7, mix: 100 } },
        { id: 'dn-e1', type: 'eq', params: { lowGain: 3, midGain: 0, highGain: -2 } },
        { id: 'dn-r1', type: 'reverb', params: { mix: 30 } },
        { id: 'dn-l1', type: 'limiter', params: { ceiling: -6, release: 140 } }
      ]
    },
    {
      // #31 seed batch cell 6, PROMOTED at the 2026-09-01 audition.
      name: 'AM Radio Ghost',
      description: 'Vintage AM broadcast — tinny, warm, slightly haunted. The old-radio gag with every word still coming through the static.',
      tags: ['gag:radio', 'technique:lo-fi', 'vibe:lo-fi'],
      primary: 'gag:radio',
      provenance: {
        origin: '#31 seed batch cell 6 (gag · radio), authored offline 2026-09-01; promoted at the live ?audition Booth',
        auditionDate: '2026-09-01',
        verdict: 'accepted',
        note: 'auditioned live 2026-09-01, verdict accepted at the "usable without edits" bar (no note recorded)'
      },
      nodes: [
        { id: 'ar-e1', type: 'eq', params: { lowGain: -10, midGain: 4, highGain: -9 } },
        { id: 'ar-d1', type: 'distortion', params: { drive: 0.2, tone: 0.3, output: -14 } },
        { id: 'ar-c1', type: 'compressor', params: { threshold: -12, ratio: 8, attack: 0.003, release: 0.1 } },
        { id: 'ar-l1', type: 'limiter', params: { ceiling: -6, release: 70 } }
      ]
    },
    {
      // #31 seed batch cell 8, PROMOTED at the 2026-09-01 audition.
      name: 'Cathedral Drift',
      description: 'Dreamy and wide — every held note drifts off into a long hall with the voice floating up front. Space for slow songs: air, not tunnel.',
      tags: ['vibe:spacious', 'use-case:performance', 'technique:ambience-long', 'vibe:epic/big'],
      primary: 'vibe:spacious',
      provenance: {
        origin: '#31 seed batch cell 8 (vibe · spacious, ambience-long), authored offline 2026-09-01; promoted at the live ?audition Booth',
        auditionDate: '2026-09-01',
        verdict: 'accepted',
        note: 'auditioned live 2026-09-01, verdict accepted at the "usable without edits" bar (no note recorded)'
      },
      nodes: [
        { id: 'cd-g1', type: 'gain', params: { gainDb: 1 } },
        { id: 'cd-e1', type: 'eq', params: { lowGain: 0.5, midGain: 0, highGain: 1.5 } },
        { id: 'cd-c1', type: 'compressor', params: { threshold: -12, ratio: 2.5, attack: 0.015, release: 0.3 } },
        { id: 'cd-h1', type: 'chorus', params: { depthMs: 2, rateHz: 0.4, mix: 18 } },
        { id: 'cd-y1', type: 'delay', params: { timeMs: 420, feedback: 35, mix: 24 } },
        { id: 'cd-r1', type: 'reverb', params: { mix: 60 } },
        { id: 'cd-l1', type: 'limiter', params: { ceiling: -6, release: 180 } }
      ]
    },
    {
      // #31 seed batch cell 9, PROMOTED at the 2026-09-01 audition.
      name: 'Jazz Cellar',
      description: 'Late-night club warmth — rounded edges, slow leveling, a haze of hall around the voice. For standards and slow swings; mellow never means muffled.',
      tags: ['genre:Jazz', 'vibe:dark/moody', 'use-case:performance', 'vibe:warm'],
      primary: 'genre:Jazz',
      provenance: {
        origin: '#31 seed batch cell 9 (jazz · dark/moody), authored offline 2026-09-01; promoted at the live ?audition Booth',
        auditionDate: '2026-09-01',
        verdict: 'accepted',
        note: 'auditioned live 2026-09-01, verdict accepted at the "usable without edits" bar (no note recorded)'
      },
      nodes: [
        { id: 'jc-e1', type: 'eq', params: { lowGain: 2, midGain: 1, highGain: -3 } },
        { id: 'jc-c1', type: 'compressor', params: { threshold: -14, ratio: 2, attack: 0.02, release: 0.35 } },
        { id: 'jc-h1', type: 'chorus', params: { depthMs: 1.5, rateHz: 0.3, mix: 10 } },
        { id: 'jc-r1', type: 'reverb', params: { mix: 30 } },
        { id: 'jc-l1', type: 'limiter', params: { ceiling: -6, release: 160 } }
      ]
    },
    {
      // #31 seed batch cell 10, PROMOTED at the 2026-09-01 audition.
      name: 'Rotary Nostalgia',
      description: 'Warbling stage nostalgia — the wobble of an old rotating speaker behind a crooner\u2019s mic. Vintage flutter without tape hiss or a muddy bottom.',
      tags: ['vibe:retro', 'use-case:performance', 'vibe:lo-fi'],
      primary: 'vibe:retro',
      provenance: {
        origin: '#31 seed batch cell 10 (vibe · retro), authored offline 2026-09-01; promoted at the live ?audition Booth',
        auditionDate: '2026-09-01',
        verdict: 'accepted',
        note: 'auditioned live 2026-09-01, verdict accepted at the "usable without edits" bar (no note recorded)'
      },
      nodes: [
        { id: 'rn-e1', type: 'eq', params: { lowGain: 1, midGain: 1, highGain: -1 } },
        { id: 'rn-t1', type: 'tremolo', params: { rateHz: 5, depth: 45 } },
        { id: 'rn-y1', type: 'delay', params: { timeMs: 160, feedback: 18, mix: 18 } },
        { id: 'rn-r1', type: 'reverb', params: { mix: 22 } },
        { id: 'rn-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // #31 seed batch cell 11, PROMOTED at the 2026-09-01 audition.
      name: 'Space Lounge',
      description: 'Swooshy, floating, holographic — a slow sweep gliding under everything. Spacey interludes and psychedelic moments; seasick swirl without losing the vocal.',
      tags: ['vibe:psychedelic', 'vibe:spacious', 'use-case:performance', 'technique:modulated/wide'],
      primary: 'vibe:psychedelic',
      provenance: {
        origin: '#31 seed batch cell 11 (vibe · psychedelic "space lounge"), authored offline 2026-09-01; promoted at the live ?audition Booth',
        auditionDate: '2026-09-01',
        verdict: 'accepted',
        note: 'auditioned live 2026-09-01, verdict accepted at the "usable without edits" bar (no note recorded)'
      },
      nodes: [
        { id: 'sl-f1', type: 'phaser', params: { rateHz: 0.6, depth: 70, baseHz: 350 } },
        { id: 'sl-h1', type: 'chorus', params: { depthMs: 3, rateHz: 0.5, mix: 25 } },
        { id: 'sl-y1', type: 'delay', params: { timeMs: 300, feedback: 28, mix: 20 } },
        { id: 'sl-r1', type: 'reverb', params: { mix: 40 } },
        { id: 'sl-l1', type: 'limiter', params: { ceiling: -6, release: 150 } }
      ]
    },
    {
      // #31 seed batch cell 12, PROMOTED at the 2026-09-01 audition.
      name: 'Studio Polish',
      description: 'Fixes the mic first: hiss gone between phrases, poppin\u2019 p\u2019s tamed, room hum quieted — a clean, natural voice with nothing you can hear working. No tunnel, no pumping, no tin can.',
      tags: ['use-case:cleanup', 'vibe:natural', 'technique:clean', 'use-case:speech/hosting'],
      primary: 'use-case:cleanup',
      provenance: {
        origin: '#31 seed batch cell 12 (use-case · cleanup + natural), authored offline 2026-09-01; promoted at the live ?audition Booth',
        auditionDate: '2026-09-01',
        verdict: 'accepted',
        note: 'auditioned live 2026-09-01, verdict accepted at the "usable without edits" bar (no note recorded)'
      },
      nodes: [
        { id: 'sp-n1', type: 'gate', params: { threshold: -45, attack: 0.005, release: 0.15, floor: -40 } },
        { id: 'sp-e1', type: 'eq', params: { lowGain: -1, midGain: 0.5, highGain: 1.5 } },
        { id: 'sp-c1', type: 'compressor', params: { threshold: -14, ratio: 2.5, attack: 0.01, release: 0.25 } },
        { id: 'sp-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    }
  ];

  window.FACTORY_LIBRARY = {
    VOCABULARIES: VOCABULARIES,
    PRIMARY_GROUP_ORDER: PRIMARY_GROUP_ORDER,
    PRESETS: PRESETS
  };
})();
