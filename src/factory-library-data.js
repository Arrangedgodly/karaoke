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
//   description  1–2 sentences, the full account of the sound — user words,
//                artist shorthand where universal, complaint vocabulary the
//                preset fixes/avoids (checked at audition, per #28). This is
//                what get_preset carries; it is NOT what a browse listing
//                carries.
//   summary      <= 60 characters, HAND-WRITTEN, one line: the
//                agent-matching surface. This is the string an AI agent
//                matches a plain-language user request against in
//                list_presets, so the library can be scanned in one call
//                instead of rebuilt from scratch (scale-out D-12/D-13;
//                docs/adr/0003-preset-first-agent-strategy.md). It is NOT
//                derived by truncating `description` — truncation keeps the
//                setup and cuts the payoff (Studio Polish's description
//                opens on what it fixes and closes on the clean voice that
//                results, which is the half a request matches). Write the
//                request, not the recipe: what a person would ask for.
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
      summary: 'All-purpose karaoke vocal — the safe starting point.',
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
      summary: 'Soft, warm and close-up for slow ballads.',
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
      summary: 'Bright, punchy rock vocal that cuts a loud room.',
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
      summary: 'Tinny phone-call voice — the calling-in bit.',
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
      summary: 'Huge arena echo — an epic, stadium-sized space.',
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
      summary: 'Plain, uncolored voice for hosting and speech.',
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
      summary: 'Squeaky high chipmunk voice — the party gag.',
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
      summary: 'Deep movie-trailer voice with cave echo behind it.',
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
      summary: 'Tinny old AM radio — vintage and a bit haunted.',
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
      summary: 'Dreamy long cathedral hall for slow songs.',
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
      summary: 'Late-night jazz club warmth for standards.',
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
      summary: 'Wobbly vintage rotating-speaker warble.',
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
      summary: 'Swooshy floating sweep — spacey and psychedelic.',
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
      summary: 'Cleans up a noisy mic: hiss, pops and room hum.',
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
    },
    // ==================================================================
    // 2026-09-02 PROMOTION — the scale-out batch's live audition decided
    // all twenty pen candidates: NINETEEN ACCEPTED (the six GEN-1 genre
    // chains, the six GAG-1 gags, and seven of the eight LC-1 corpus
    // chains) and ONE REJECTED (Podcast Warmth: 'too much reverb' —
    // verdict recorded in the pen header, src/audition-candidates.js).
    // Nodes are VERBATIM from the pen; provenance is filled (verdict
    // 'accepted', auditionDate 2026-09-02). These twenty predate the
    // summary requirement, so each entry's hand-written summary was
    // composed at promotion from the entry's own request evidence (the
    // RQ-1/RQ-2 sketches, the corpus rows its provenance names).
    // ==================================================================
    {
      // GEN-1 genre batch (Metal), PROMOTED at the 2026-09-02 audition.
      name: 'Metal Mayhem',
      description: 'Aggressive bite for screaming along with the heavy stuff — edge and grit that cuts through the wall of guitars, without turning to mud or a boomy wash.',
      summary: 'Aggressive metal bite and grit for the heavy stuff.',
      tags: ['genre:Metal', 'use-case:performance', 'vibe:bright', 'technique:ambience-short'],
      primary: 'genre:Metal',
      provenance: {
        origin: 'GEN-1 genre batch (genre · Metal), authored offline 2026-09-01 from the RQ-1 metal sketch (D1); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'mt-e1', type: 'eq', params: { lowGain: -4, midGain: -1, highGain: 4 } },
        { id: 'mt-d1', type: 'distortion', params: { drive: 0.35, tone: 0.5, output: -6 } },
        { id: 'mt-c1', type: 'compressor', params: { threshold: -14, ratio: 6, attack: 0.003, release: 0.12 } },
        { id: 'mt-y1', type: 'delay', params: { timeMs: 90, feedback: 10, mix: 12 } },
        { id: 'mt-r1', type: 'reverb', params: { mix: 12 } },
        { id: 'mt-l1', type: 'limiter', params: { ceiling: -3, release: 60 } }
      ]
    },
    {
      // GEN-1 genre batch (Rap/Hip-Hop re-author), PROMOTED 2026-09-02.
      name: 'Hard-Tune Hotline',
      description: 'Hard-tune snap, dry and up front — the modern trap sound. Off-key lines lock onto pitch and every word stays crisp, never swimming in echo.',
      summary: 'Hard-tune snap — the modern trap autotune sound.',
      tags: ['genre:Rap/Hip-Hop', 'use-case:performance', 'technique:hard-tune', 'vibe:bright'],
      primary: 'genre:Rap/Hip-Hop',
      provenance: {
        origin: 'GEN-1 genre batch (genre · Rap/Hip-Hop; re-author of the #31 Hard-Tune Hotline draft per its 2026-09-01 note + BEH-1), from the RQ-1 rap sketch (D1); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'rp-a1', type: 'autotune', params: { key: 'C', scale: 'Chromatic', retune: 5, mix: 100 } },
        { id: 'rp-e1', type: 'eq', params: { lowGain: -3, midGain: 0, highGain: 2.5 } },
        { id: 'rp-c1', type: 'compressor', params: { threshold: -16, ratio: 5, attack: 0.004, release: 0.15 } },
        { id: 'rp-y1', type: 'delay', params: { timeMs: 250, feedback: 20, mix: 18 } },
        { id: 'rp-r1', type: 'reverb', params: { mix: 10 } },
        { id: 'rp-l1', type: 'limiter', params: { ceiling: -3, release: 50 } }
      ]
    },
    {
      // GEN-1 genre batch (R&B/Soul), PROMOTED 2026-09-02.
      name: 'Slow Jam Silk',
      description: 'Smooth and silky for slow jams — warm lows, gentle leveling, a soft plate and slap echo sitting behind the voice. Lush, never washed out.',
      summary: 'Smooth, warm and silky for slow R&B jams.',
      tags: ['genre:R&B/Soul', 'use-case:performance', 'vibe:warm', 'technique:ambience-long'],
      primary: 'genre:R&B/Soul',
      provenance: {
        origin: 'GEN-1 genre batch (genre · R&B/Soul), authored offline 2026-09-01 from the RQ-1 r&b/soul sketch (D1); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'rb-g1', type: 'gain', params: { gainDb: 1 } },
        { id: 'rb-e1', type: 'eq', params: { lowGain: 1.5, midGain: 0.5, highGain: 1 } },
        { id: 'rb-c1', type: 'compressor', params: { threshold: -12, ratio: 2.5, attack: 0.012, release: 0.3 } },
        { id: 'rb-h1', type: 'chorus', params: { depthMs: 2, rateHz: 0.5, mix: 15 } },
        { id: 'rb-y1', type: 'delay', params: { timeMs: 180, feedback: 12, mix: 18 } },
        { id: 'rb-r1', type: 'reverb', params: { mix: 35 } },
        { id: 'rb-l1', type: 'limiter', params: { ceiling: -6, release: 150 } }
      ]
    },
    {
      // GEN-1 genre batch (Country), PROMOTED 2026-09-02.
      name: 'Nashville Nights',
      description: 'Honest and twangy, bright and natural like a country radio mix — the slap-back echo fans expect, with the voice staying up front. Present, never piercing.',
      summary: 'Twangy country slap-back — bright and natural.',
      tags: ['genre:Country', 'use-case:performance', 'vibe:natural', 'technique:ambience-short'],
      primary: 'genre:Country',
      provenance: {
        origin: 'GEN-1 genre batch (genre · Country), authored offline 2026-09-01 from the RQ-1 country sketch (D1); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'cn-e1', type: 'eq', params: { lowGain: -1, midGain: 1.5, highGain: 2 } },
        { id: 'cn-c1', type: 'compressor', params: { threshold: -13, ratio: 3, attack: 0.005, release: 0.2 } },
        { id: 'cn-y1', type: 'delay', params: { timeMs: 100, feedback: 8, mix: 20 } },
        { id: 'cn-r1', type: 'reverb', params: { mix: 18 } },
        { id: 'cn-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // GEN-1 genre batch (Dance/EDM), PROMOTED 2026-09-02.
      name: 'Club Anthem',
      description: 'Big, bright and club-loud — pumping energy, wide sheen on the hook, and echo throws that land on the beat. Punchy, never buried by the track.',
      summary: 'Big, bright and club-loud with on-beat echo throws.',
      tags: ['genre:Dance/EDM', 'use-case:performance', 'vibe:bright', 'technique:modulated/wide'],
      primary: 'genre:Dance/EDM',
      provenance: {
        origin: 'GEN-1 genre batch (genre · Dance/EDM), authored offline 2026-09-01 from the RQ-1 dance/edm sketch (D1; delay 375→380 ms, step-grid); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'dm-e1', type: 'eq', params: { lowGain: -2, midGain: -0.5, highGain: 3 } },
        { id: 'dm-c1', type: 'compressor', params: { threshold: -16, ratio: 4, attack: 0.003, release: 0.1 } },
        { id: 'dm-h1', type: 'chorus', params: { depthMs: 2.5, rateHz: 1.2, mix: 20 } },
        { id: 'dm-y1', type: 'delay', params: { timeMs: 380, feedback: 30, mix: 22 } },
        { id: 'dm-r1', type: 'reverb', params: { mix: 30 } },
        { id: 'dm-l1', type: 'limiter', params: { ceiling: -3, release: 60 } }
      ]
    },
    {
      // GEN-1 genre batch (Musicals), PROMOTED 2026-09-02.
      name: 'West End Nights',
      description: 'Showtune treatment — clear diction over the pit, light compression that rides the quiet-to-belt swings, and just enough hall around the voice. Every word lands, no tunnel.',
      summary: 'Showtune diction with just enough theatre hall.',
      tags: ['genre:Musicals', 'use-case:performance', 'vibe:spacious', 'technique:ambience-long'],
      primary: 'genre:Musicals',
      provenance: {
        origin: 'GEN-1 genre batch (genre · Musicals), authored offline 2026-09-01 from the RQ-1 musicals sketch (D1); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'mu-n1', type: 'gate', params: { threshold: -48, attack: 0.005, release: 0.2, floor: -35 } },
        { id: 'mu-e1', type: 'eq', params: { lowGain: -3, midGain: 1, highGain: 2 } },
        { id: 'mu-c1', type: 'compressor', params: { threshold: -13, ratio: 3, attack: 0.006, release: 0.25 } },
        { id: 'mu-y1', type: 'delay', params: { timeMs: 200, feedback: 15, mix: 12 } },
        { id: 'mu-r1', type: 'reverb', params: { mix: 25 } },
        { id: 'mu-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // GAG-1 gag batch (robot re-author), PROMOTED 2026-09-02.
      name: 'Robot Usher',
      description: 'Deadpan machine voice — a metallic self-duet with stuttering circuit chatter. Every word still lands; tinny, never buzzy mush.',
      summary: 'Deadpan metallic robot voice — a machine duet.',
      tags: ['gag:robot', 'use-case:performance', 'technique:modulated/wide'],
      primary: 'gag:robot',
      provenance: {
        origin: 'GAG-1 gag batch (gag · robot; re-author of the #31 seed cell 4 per its 2026-09-01 note), authored offline 2026-09-01 from the RQ-2 robot sketch (D2); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'ru-e1', type: 'eq', params: { lowGain: -6, midGain: 4, highGain: 0 } },
        { id: 'ru-p1', type: 'pitchshift', params: { pitch: 3, mix: 45 } },
        { id: 'ru-h1', type: 'chorus', params: { depthMs: 1.5, rateHz: 6, mix: 30 } },
        { id: 'ru-b1', type: 'bitcrusher', params: { bits: 6, mix: 30 } },
        { id: 'ru-t1', type: 'tremolo', params: { rateHz: 12, depth: 65 } },
        { id: 'ru-l1', type: 'limiter', params: { ceiling: -6, release: 60 } }
      ]
    },
    {
      // GAG-1 gag batch (megaphone re-author), PROMOTED 2026-09-02. The
      // +12 dB budget boundary case the policy test characterizes (F8).
      name: 'Megaphone Rally',
      description: 'Squashed, honking bullhorn shout that punches through the room like a protest PA — loud from the name, clear over the noise.',
      summary: 'Squashed bullhorn shout that punches through.',
      tags: ['gag:megaphone', 'use-case:performance'],
      primary: 'gag:megaphone',
      provenance: {
        origin: 'GAG-1 gag batch (gag · megaphone; re-author of the #31 seed cell 7 per its 2026-09-01 note), authored offline 2026-09-01 from the RQ-2 megaphone sketch (D2); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'mr-e1', type: 'eq', params: { lowGain: -12, midGain: 9, highGain: 3 } },
        { id: 'mr-d1', type: 'distortion', params: { drive: 0.5, tone: 0.45, output: 0 } },
        { id: 'mr-c1', type: 'compressor', params: { threshold: -18, ratio: 12, attack: 0.002, release: 0.08 } },
        { id: 'mr-l1', type: 'limiter', params: { ceiling: -3, release: 50 } }
      ]
    },
    {
      // GAG-1 gag batch (8-bit re-author), PROMOTED 2026-09-02.
      name: '8-Bit Encore',
      description: 'Chiptune video-game vocals with the melody still front and center — crunchy, never crushed to mush.',
      summary: 'Chiptune video-game vocals with the tune intact.',
      tags: ['gag:8-bit', 'technique:lo-fi', 'use-case:performance'],
      primary: 'gag:8-bit',
      provenance: {
        origin: 'GAG-1 gag batch (gag · 8-bit; re-author of the #31 seed cell 5 per its 2026-09-01 note), authored offline 2026-09-01 from the RQ-2 8-bit sketch (D2); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'eb-e1', type: 'eq', params: { lowGain: -2, midGain: 1, highGain: 3 } },
        { id: 'eb-b1', type: 'bitcrusher', params: { bits: 6, mix: 55 } },
        { id: 'eb-t1', type: 'tremolo', params: { rateHz: 4, depth: 25 } },
        { id: 'eb-l1', type: 'limiter', params: { ceiling: -6, release: 80 } }
      ]
    },
    {
      // GAG-1 gag batch (helium), PROMOTED 2026-09-02.
      name: 'Helium Hangout',
      description: 'Balloon-breath squeak — thin, floaty, silly-high. Words stay squeaky-crisp, not squeaky-mush.',
      summary: 'Balloon-breath squeak — silly-high and crisp.',
      tags: ['gag:helium', 'technique:pitch-gag', 'use-case:performance'],
      primary: 'gag:helium',
      provenance: {
        origin: 'GAG-1 gag batch (gag · helium), authored offline 2026-09-01 from the RQ-3 helium sketch (D3); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'hh-e1', type: 'eq', params: { lowGain: -9, midGain: -1, highGain: 2 } },
        { id: 'hh-p1', type: 'pitchshift', params: { pitch: 10, mix: 100 } },
        { id: 'hh-l1', type: 'limiter', params: { ceiling: -6, release: 100 } }
      ]
    },
    {
      // GAG-1 gag batch (darth-vader), PROMOTED 2026-09-02.
      name: 'Dark Helmet Baritone',
      description: 'Masked-villain baritone through a helmet intercom — dark, close, faintly crackling. Menace without the muddy cave.',
      summary: 'Masked-villain menace — dark intercom baritone.',
      tags: ['gag:darth-vader', 'technique:pitch-gag', 'use-case:performance'],
      primary: 'gag:darth-vader',
      provenance: {
        origin: 'GAG-1 gag batch (gag · darth-vader), authored offline 2026-09-01 from the RQ-3 darth-vader sketch (D3); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'dv-p1', type: 'pitchshift', params: { pitch: -4, mix: 100 } },
        { id: 'dv-e1', type: 'eq', params: { lowGain: -6, midGain: 4, highGain: -7 } },
        { id: 'dv-d1', type: 'distortion', params: { drive: 0.18, tone: 0.22, output: -12 } },
        { id: 'dv-l1', type: 'limiter', params: { ceiling: -6, release: 90 } }
      ]
    },
    {
      // GAG-1 gag batch (monster/demon), PROMOTED 2026-09-02.
      name: 'Demon Growl',
      description: 'Pitch-floor demon snarl — gravel throat over a subterranean chest. Deep and scary while the words survive.',
      summary: 'Pitch-floor demon snarl — deep and gravelly.',
      tags: ['gag:monster/demon', 'technique:pitch-gag', 'vibe:dark/moody'],
      primary: 'gag:monster/demon',
      provenance: {
        origin: 'GAG-1 gag batch (gag · monster/demon), authored offline 2026-09-01 from the RQ-3 monster/demon sketch (D3); promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'mg-p1', type: 'pitchshift', params: { pitch: -10, mix: 100 } },
        { id: 'mg-e1', type: 'eq', params: { lowGain: 5, midGain: 2, highGain: -2 } },
        { id: 'mg-d1', type: 'distortion', params: { drive: 0.6, tone: 0.18, output: -8 } },
        { id: 'mg-l1', type: 'limiter', params: { ceiling: -6, release: 80 } }
      ]
    },
    {
      // LC-1 corpus batch (corpus E1, genre · Pop), PROMOTED 2026-09-02.
      name: 'Chart Topper',
      description: 'Top-40 radio polish — clean lows, real air on top, a touch of width, and an eighth-note echo tucked in behind the words. Produced and bright, never brittle or boxy.',
      summary: 'Top-40 radio polish — produced, clean and bright.',
      tags: ['genre:Pop', 'use-case:performance', 'vibe:bright', 'technique:ambience-short'],
      primary: 'genre:Pop',
      provenance: {
        origin: 'LC-1 corpus batch, request E1 "I\'m singing a Top-40 pop song — make me sound like the record". CLOSEST FAILS: Classic Karaoke is EQ-flat (0/0/0) by design — it is the neutral default, so no 200 Hz de-box, no 5 kHz air, no width, and its 300 ms/25% delay reads as a general room, not a pop eighth-note; Warm Ballad, the only other genre:Pop-tagged sound, is a slow close-up ballad with no delay and no top end. The request wants a PRODUCED sound; the closest preset\'s whole job is to be unproduced. genre:Pop had no preset at all.; promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'ct-e1', type: 'eq', params: { lowGain: -2.5, midGain: -1, highGain: 4 } },
        { id: 'ct-c1', type: 'compressor', params: { threshold: -15, ratio: 5, attack: 0.004, release: 0.12 } },
        { id: 'ct-h1', type: 'chorus', params: { depthMs: 1.5, rateHz: 0.6, mix: 12 } },
        { id: 'ct-y1', type: 'delay', params: { timeMs: 250, feedback: 18, mix: 14 } },
        { id: 'ct-r1', type: 'reverb', params: { mix: 22 } },
        { id: 'ct-l1', type: 'limiter', params: { ceiling: -3, release: 60 } }
      ]
    },
    {
      // LC-1 corpus batch (corpus D2/D3, gentle pitch correction),
      // PROMOTED 2026-09-02.
      name: 'Pitch Safety Net',
      description: 'Pitch correction you feel instead of hear — sour notes slide into tune over a beat rather than snapping, with a light room behind. A safety net, not a T-Pain robot.',
      summary: 'Gentle pitch correction you feel, not hear.',
      tags: ['use-case:performance', 'technique:hard-tune', 'vibe:natural', 'genre:Pop'],
      primary: 'use-case:performance',
      provenance: {
        origin: 'LC-1 corpus batch, requests D2 "The Helicon provides subtle auto tune, not as harsh as T-Pain" (r/karaoke) and D3 Voloco "Natural Tune". CLOSEST FAILS: Hard-Tune Hotline is the ONLY pitch-correction preset in all 26 sounds, and its retune is 5 ms at mix 100 — precisely the T-Pain snap this request explicitly asks NOT to have. There is no gentle setting to load, and Simple view cannot reach the retune knob to make one.; promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'ps-a1', type: 'autotune', params: { key: 'C', scale: 'Chromatic', retune: 250, mix: 85 } },
        { id: 'ps-e1', type: 'eq', params: { lowGain: -1.5, midGain: 0.5, highGain: 1.5 } },
        { id: 'ps-c1', type: 'compressor', params: { threshold: -14, ratio: 3, attack: 0.008, release: 0.2 } },
        { id: 'ps-y1', type: 'delay', params: { timeMs: 220, feedback: 14, mix: 12 } },
        { id: 'ps-r1', type: 'reverb', params: { mix: 24 } },
        { id: 'ps-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // LC-1 corpus batch (corpus A1/A8/F17, echo amount), PROMOTED
      // 2026-09-02.
      name: 'Noraebang Echo',
      description: 'The karaoke-room echo people actually shout for — repeats you can count trailing every line, with the wash kept low so the words stay words. Big echo, no tunnel.',
      summary: 'Karaoke-room echo — big repeats, no tunnel.',
      tags: ['use-case:performance', 'vibe:spacious', 'technique:ambience-long'],
      primary: 'use-case:performance',
      provenance: {
        origin: 'LC-1 corpus batch, requests A1 "Give me some echo!" (Karaoke Scene KJ forum, shouted mid-song), A8 noraebang echo-as-default (r/AskAKorean), F17 "echo but without the wash". CLOSEST FAILS: nothing in the 26 sounds is ABOUT echo — the highest delay mix anywhere is Classic Karaoke\'s 25% at 300 ms/25% feedback, which is exactly the "just enough" setting the singer already has when they shout for MORE. Cathedral Drift and Big Room answer "more reverb", a request the corpus itself distinguishes from echo. Rock Night is the only reverb-free delay and is a bright rock colour, not a neutral echo.; promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'ne-e1', type: 'eq', params: { lowGain: -1, midGain: 0.5, highGain: 1 } },
        { id: 'ne-c1', type: 'compressor', params: { threshold: -14, ratio: 3, attack: 0.008, release: 0.18 } },
        { id: 'ne-y1', type: 'delay', params: { timeMs: 330, feedback: 48, mix: 38 } },
        { id: 'ne-r1', type: 'reverb', params: { mix: 14 } },
        { id: 'ne-l1', type: 'limiter', params: { ceiling: -6, release: 150 } }
      ]
    },
    {
      // LC-1 corpus batch (corpus F10/C7, intimate), PROMOTED 2026-09-02.
      name: 'Close-Up Whisper',
      description: 'Right up against the mic — breathy, quiet singing lifted so every word carries, with barely any room behind it. Close and warm; no hall pushing you to the back of the stage.',
      summary: 'Breathy, up-close mic voice with no hall.',
      tags: ['vibe:intimate', 'use-case:performance', 'vibe:warm', 'technique:clean'],
      primary: 'vibe:intimate',
      provenance: {
        origin: 'LC-1 corpus batch, requests F10 TC-Helicon "CLOSE UP" / whisper-close intimate singing and C7 voicechanger.live "ASMR". CLOSEST FAILS: vibe:intimate has no preset at all; Warm Ballad is the closest slow-song chain and fails twice — its 35% plate pushes the voice back into a hall, the exact opposite of "right next to the mic", and its 2.5:1 at -10 dB leaves genuinely breathy notes under the backing track.; promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'cw-n1', type: 'gate', params: { threshold: -50, attack: 0.003, release: 0.25, floor: -22 } },
        { id: 'cw-e1', type: 'eq', params: { lowGain: 1.5, midGain: -0.5, highGain: -1 } },
        { id: 'cw-c1', type: 'compressor', params: { threshold: -14, ratio: 4.5, attack: 0.012, release: 0.3 } },
        { id: 'cw-r1', type: 'reverb', params: { mix: 8 } },
        { id: 'cw-l1', type: 'limiter', params: { ceiling: -6, release: 150 } }
      ]
    },
    {
      // LC-1 corpus batch (corpus B7, sibilance anti-preset), PROMOTED
      // 2026-09-02. The library's second cleanup entry.
      name: 'Hiss Rescue',
      description: 'For voices where every s and f hisses: the top end comes down and the wash comes off, so sibilance stops stinging. Softer, not muffled — the words keep their edges.',
      summary: 'Tames hissing esses and harsh top end.',
      tags: ['use-case:cleanup', 'vibe:warm', 'technique:clean', 'use-case:speech/hosting'],
      primary: 'use-case:cleanup',
      provenance: {
        origin: 'LC-1 corpus batch, request B7 (verbatim, sing.salon): "the default Studio setting have too much reverb... produces also a lot of hiss sounds, especially with sss or fff components". CLOSEST FAILS: Studio Polish is THE cleanup preset and makes this complaint worse — its 5 kHz shelf is +1.5 dB, so every s and f is lifted, and the hiss it promises to fix is room hiss BETWEEN phrases (a gate job), not sibilance INSIDE words. The only two sounds that cut the 5 kHz shelf are Jazz Cellar (-3, a dark jazz colour riding 30% reverb) and Phone Call Gag (a band-limited gag); neither is a cleanup preset.; promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'hr-n1', type: 'gate', params: { threshold: -46, attack: 0.004, release: 0.16, floor: -35 } },
        { id: 'hr-e1', type: 'eq', params: { lowGain: 0.5, midGain: 1, highGain: -4.5 } },
        { id: 'hr-c1', type: 'compressor', params: { threshold: -14, ratio: 2.5, attack: 0.01, release: 0.25 } },
        { id: 'hr-r1', type: 'reverb', params: { mix: 10 } },
        { id: 'hr-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // LC-1 corpus batch (corpus C4/C8/I2, hosting), PROMOTED 2026-09-02.
      name: 'Room Announcer',
      description: 'The host mic that cuts through a loud room — dense, present and up front, so the next singer\u2019s name lands over the crowd. Clear and human, never a bullhorn.',
      summary: 'Host mic that cuts through a loud room.',
      tags: ['use-case:speech/hosting', 'vibe:bright', 'technique:clean'],
      primary: 'use-case:speech/hosting',
      provenance: {
        origin: 'LC-1 corpus batch, requests C4 voicechanger.live "Announcer", C8 "Streamer Pro", I2 hosting the room (the Karaoke Scene forum, one of the two verbatim sources in the record, is ENTIRELY hosts). CLOSEST FAILS: Clean Speech is the only use-case:speech/hosting preset and is designed to be the exact opposite — "no audible coloring", 2:1 at -10 dB, 5 kHz shelf at -1 dB, ceiling -6; it will not cut through a room because it is not built to. Megaphone Rally does cut through but is a GAG: a band-limited bullhorn honk, not a host\'s voice.; promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'ra-n1', type: 'gate', params: { threshold: -42, attack: 0.003, release: 0.12, floor: -30 } },
        { id: 'ra-e1', type: 'eq', params: { lowGain: -2, midGain: 3, highGain: 2.5 } },
        { id: 'ra-c1', type: 'compressor', params: { threshold: -17, ratio: 6, attack: 0.003, release: 0.1 } },
        { id: 'ra-y1', type: 'delay', params: { timeMs: 90, feedback: 6, mix: 8 } },
        { id: 'ra-l1', type: 'limiter', params: { ceiling: -3, release: 60 } }
      ]
    },
    {
      // LC-1 corpus batch (corpus H3/H5, doubling), PROMOTED 2026-09-02.
      name: 'Double Track',
      description: 'Sounds like two of you singing the same line — a wide, thick lead with a second take sitting just behind it. Doubling, not harmony: your voice twice, not backing singers.',
      summary: 'Two of you singing — a wide, doubled lead.',
      tags: ['vibe:epic/big', 'use-case:performance', 'technique:modulated/wide', 'genre:Pop'],
      primary: 'vibe:epic/big',
      provenance: {
        origin: 'LC-1 corpus batch, requests H3 Boss VE-5 "DOUBLE VOICE" / TC-Helicon\'s "Doubling" tag (carried by a majority of its published preset list) / Voloco doubling packs, and H5 "UNISON". CLOSEST FAILS: chorus appears in five of the 26 sounds (Slow Jam Silk 15%, Club Anthem 20%, Cathedral Drift 18%, Space Lounge 25%, Jazz Cellar 10%) but ALWAYS as width texture underneath a genre or a vibe — never at a depth and mix that reads as a second take, and never with the short pre-delay that makes a double a double rather than a shimmer. Big Room, the only vibe:epic/big preset, gets its size from a 50% plate and a 320 ms delay: one voice in a hall, not two voices.; promoted at the live ?audition Booth',
        auditionDate: '2026-09-02',
        verdict: 'accepted',
        note: "auditioned live 2026-09-02, verdict accepted at the \"usable without edits\" bar (no note recorded)"
      },
      nodes: [
        { id: 'dt-e1', type: 'eq', params: { lowGain: -1, midGain: 0, highGain: 1.5 } },
        { id: 'dt-c1', type: 'compressor', params: { threshold: -13, ratio: 3, attack: 0.008, release: 0.2 } },
        { id: 'dt-h1', type: 'chorus', params: { depthMs: 6, rateHz: 0.3, mix: 45 } },
        { id: 'dt-y1', type: 'delay', params: { timeMs: 30, feedback: 0, mix: 40 } },
        { id: 'dt-r1', type: 'reverb', params: { mix: 18 } },
        { id: 'dt-l1', type: 'limiter', params: { ceiling: -6, release: 140 } }
      ]
    }
  ];

  window.FACTORY_LIBRARY = {
    VOCABULARIES: VOCABULARIES,
    PRIMARY_GROUP_ORDER: PRIMARY_GROUP_ORDER,
    PRESETS: PRESETS
  };
})();
