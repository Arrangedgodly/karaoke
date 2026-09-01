// AUDITION CANDIDATES — the pipeline's holding pen for chains awaiting
// their human audition (wayfinder #34/#31; map #26). Inert data: nothing
// here renders, loads, or reaches the WebMCP surface. The Booth harness
// (src/audition-harness.js, ?audition-gated) is the only consumer.
//
// PIPELINE (PR-only, per the map's standing rule):
//   1. A pipeline session authors candidates offline (schema-conformant
//      chains in the library entry shape) and lands them HERE via PR.
//   2. An audition session runs the app with ?audition, listens to each
//      candidate through the real load path (live mic; raw test-vocal
//      reference), and records binary verdicts (bar: "usable without
//      edits") with optional notes.
//   3. ACCEPTED candidates are promoted — moved into
//      src/factory-library-data.js's PRESETS with their provenance filled
//      (verdict 'accepted', the real audition date) — and REMOVED from
//      here in the same edit, alongside the same-edit test updates the
//      library conformance test documents. REJECTED candidates are simply
//      removed from here (their verdict lives in the ticket/PR record).
//
// Entry shape = the library's (src/factory-library-data.js), with
// provenance.verdict 'pending' and auditionDate null while waiting:
//   { name, description, tags: ['axis:value', ...], primary,
//     provenance: { origin, auditionDate: null, verdict: 'pending' },
//     nodes: [{id, type, params}] }
//
// CURRENT CONTENT — the #31 seed batch (authored offline 2026-09-01):
// twelve candidates covering the twelve cells #28 fixed, exercising all
// fourteen node types across the batch (the six shipped presets only use
// the six classic types; these add distortion, chorus, gate, autotune,
// phaser, pitchshift, bitcrusher, tremolo). Descriptions follow the #28
// checklist: the sound in user words, artist shorthand where universal,
// and the complaint vocabulary the preset fixes or avoids. Param values
// authored against the live catalog specs; gain budgets kept ≤ ~11.4 dB
// of the published +12 (gainDb + 0.57·|threshold| + 0.57·|ceiling|).

(function () {
  'use strict';

  window.AUDITION_CANDIDATES = [
    {
      // Cell 1: rap · hard-tune ("the T-Pain sound").
      name: 'Hard-Tune Hotline',
      description: 'The T-Pain sound: every note snaps hard to the grid for rap and hook nights. Tight, bright, and punchy — no drifting flat notes, no muddy low end.',
      tags: ['genre:Rap/Hip-Hop', 'use-case:performance', 'technique:hard-tune', 'vibe:bright'],
      primary: 'genre:Rap/Hip-Hop',
      provenance: { origin: '#31 seed batch cell 1 (rap · hard-tune), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'ht-g1', type: 'gain', params: { gainDb: 0 } },
        { id: 'ht-e1', type: 'eq', params: { lowGain: 1, midGain: 0, highGain: 2 } },
        { id: 'ht-t1', type: 'autotune', params: { key: 'C', scale: 'Chromatic', retune: 0, mix: 100 } },
        { id: 'ht-c1', type: 'compressor', params: { threshold: -12, ratio: 4, attack: 0.005, release: 0.15 } },
        { id: 'ht-l1', type: 'limiter', params: { ceiling: -6, release: 80 } }
      ]
    },
    {
      // Cell 2: gag · chipmunk.
      name: 'Chipmunk Party',
      description: 'Squeaky chipmunk voice — the birthday-party gag that gets a laugh every line. Words stay crisp, never squeaky mush.',
      tags: ['gag:chipmunk', 'use-case:performance', 'technique:pitch-gag'],
      primary: 'gag:chipmunk',
      provenance: { origin: '#31 seed batch cell 2 (gag · chipmunk), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'cp-e1', type: 'eq', params: { lowGain: -2, midGain: 1, highGain: 3 } },
        { id: 'cp-p1', type: 'pitchshift', params: { pitch: 7, mix: 100 } },
        { id: 'cp-l1', type: 'limiter', params: { ceiling: -6, release: 100 } }
      ]
    },
    {
      // Cell 3: gag · deep-voice.
      name: 'Deep Narrator',
      description: 'Movie-trailer depth with a cave behind it — dramatic readings, Darth Vader bits, "in a world…". Deep without turning to mud, never boomy over the words.',
      tags: ['gag:deep-voice', 'vibe:dark/moody', 'technique:pitch-gag'],
      primary: 'gag:deep-voice',
      provenance: { origin: '#31 seed batch cell 3 (gag · deep-voice), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'dn-p1', type: 'pitchshift', params: { pitch: -7, mix: 100 } },
        { id: 'dn-e1', type: 'eq', params: { lowGain: 3, midGain: 0, highGain: -2 } },
        { id: 'dn-r1', type: 'reverb', params: { mix: 30 } },
        { id: 'dn-l1', type: 'limiter', params: { ceiling: -6, release: 140 } }
      ]
    },
    {
      // Cell 4: gag · robot.
      name: 'Robot Usher',
      description: 'A buzzy synthetic talker — greet the room like a machine. Metallic and deadpan, still intelligible through the buzz.',
      tags: ['gag:robot', 'technique:lo-fi'],
      primary: 'gag:robot',
      provenance: { origin: '#31 seed batch cell 4 (gag · robot), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'ru-e1', type: 'eq', params: { lowGain: -4, midGain: 4, highGain: -2 } },
        { id: 'ru-d1', type: 'distortion', params: { drive: 0.45, tone: 0.25, output: -12 } },
        { id: 'ru-b1', type: 'bitcrusher', params: { bits: 4, mix: 70 } },
        { id: 'ru-l1', type: 'limiter', params: { ceiling: -6, release: 90 } }
      ]
    },
    {
      // Cell 5: gag · 8-bit.
      name: '8-Bit Encore',
      description: 'Video-game chipvoice: sing your encore like a 90s cartridge. Crunchy, chirpy, charming — the bit-crush never buries the melody.',
      tags: ['gag:8-bit', 'technique:lo-fi'],
      primary: 'gag:8-bit',
      provenance: { origin: '#31 seed batch cell 5 (gag · 8-bit), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'eb-b1', type: 'bitcrusher', params: { bits: 3, mix: 80 } },
        { id: 'eb-t1', type: 'tremolo', params: { rateHz: 6, depth: 40 } },
        { id: 'eb-l1', type: 'limiter', params: { ceiling: -6, release: 90 } }
      ]
    },
    {
      // Cell 6: gag · radio.
      name: 'AM Radio Ghost',
      description: 'Vintage AM broadcast — tinny, warm, slightly haunted. The old-radio gag with every word still coming through the static.',
      tags: ['gag:radio', 'technique:lo-fi', 'vibe:lo-fi'],
      primary: 'gag:radio',
      provenance: { origin: '#31 seed batch cell 6 (gag · radio), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'ar-e1', type: 'eq', params: { lowGain: -10, midGain: 4, highGain: -9 } },
        { id: 'ar-d1', type: 'distortion', params: { drive: 0.2, tone: 0.3, output: -14 } },
        { id: 'ar-c1', type: 'compressor', params: { threshold: -12, ratio: 8, attack: 0.003, release: 0.1 } },
        { id: 'ar-l1', type: 'limiter', params: { ceiling: -6, release: 70 } }
      ]
    },
    {
      // Cell 7: gag · megaphone.
      name: 'Megaphone Rally',
      description: 'Shouted through a cone at a rally — honking midrange, clipped edges, zero subtlety. Loud and pushy without tipping into pain.',
      tags: ['gag:megaphone', 'vibe:bright'],
      primary: 'gag:megaphone',
      provenance: { origin: '#31 seed batch cell 7 (gag · megaphone), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'mr-e1', type: 'eq', params: { lowGain: -6, midGain: 5, highGain: 3 } },
        { id: 'mr-d1', type: 'distortion', params: { drive: 0.35, tone: 0.4, output: -10 } },
        { id: 'mr-c1', type: 'compressor', params: { threshold: -14, ratio: 6, attack: 0.004, release: 0.12 } },
        { id: 'mr-l1', type: 'limiter', params: { ceiling: -6, release: 80 } }
      ]
    },
    {
      // Cell 8: vibe · spacious + ambience-long.
      name: 'Cathedral Drift',
      description: 'Dreamy and wide — every held note drifts off into a long hall with the voice floating up front. Space for slow songs: air, not tunnel.',
      tags: ['vibe:spacious', 'use-case:performance', 'technique:ambience-long', 'vibe:epic/big'],
      primary: 'vibe:spacious',
      provenance: { origin: '#31 seed batch cell 8 (vibe · spacious, ambience-long), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
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
      // Cell 9: jazz · dark/moody.
      name: 'Jazz Cellar',
      description: 'Late-night club warmth — rounded edges, slow leveling, a haze of hall around the voice. For standards and slow swings; mellow never means muffled.',
      tags: ['genre:Jazz', 'vibe:dark/moody', 'use-case:performance', 'vibe:warm'],
      primary: 'genre:Jazz',
      provenance: { origin: '#31 seed batch cell 9 (jazz · dark/moody), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'jc-e1', type: 'eq', params: { lowGain: 2, midGain: 1, highGain: -3 } },
        { id: 'jc-c1', type: 'compressor', params: { threshold: -14, ratio: 2, attack: 0.02, release: 0.35 } },
        { id: 'jc-h1', type: 'chorus', params: { depthMs: 1.5, rateHz: 0.3, mix: 10 } },
        { id: 'jc-r1', type: 'reverb', params: { mix: 30 } },
        { id: 'jc-l1', type: 'limiter', params: { ceiling: -6, release: 160 } }
      ]
    },
    {
      // Cell 10: vibe · retro.
      name: 'Rotary Nostalgia',
      description: 'Warbling stage nostalgia — the wobble of an old rotating speaker behind a crooner\u2019s mic. Vintage flutter without tape hiss or a muddy bottom.',
      tags: ['vibe:retro', 'use-case:performance', 'vibe:lo-fi'],
      primary: 'vibe:retro',
      provenance: { origin: '#31 seed batch cell 10 (vibe · retro), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'rn-e1', type: 'eq', params: { lowGain: 1, midGain: 1, highGain: -1 } },
        { id: 'rn-t1', type: 'tremolo', params: { rateHz: 5, depth: 45 } },
        { id: 'rn-y1', type: 'delay', params: { timeMs: 160, feedback: 18, mix: 18 } },
        { id: 'rn-r1', type: 'reverb', params: { mix: 22 } },
        { id: 'rn-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // Cell 11: vibe · psychedelic "space lounge".
      name: 'Space Lounge',
      description: 'Swooshy, floating, holographic — a slow sweep gliding under everything. Spacey interludes and psychedelic moments; seasick swirl without losing the vocal.',
      tags: ['vibe:psychedelic', 'vibe:spacious', 'use-case:performance', 'technique:modulated/wide'],
      primary: 'vibe:psychedelic',
      provenance: { origin: '#31 seed batch cell 11 (vibe · psychedelic "space lounge"), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'sl-f1', type: 'phaser', params: { rateHz: 0.6, depth: 70, baseHz: 350 } },
        { id: 'sl-h1', type: 'chorus', params: { depthMs: 3, rateHz: 0.5, mix: 25 } },
        { id: 'sl-y1', type: 'delay', params: { timeMs: 300, feedback: 28, mix: 20 } },
        { id: 'sl-r1', type: 'reverb', params: { mix: 40 } },
        { id: 'sl-l1', type: 'limiter', params: { ceiling: -6, release: 150 } }
      ]
    },
    {
      // Cell 12: use-case · cleanup + natural ("Studio Polish" — the cell
      // added at #28 recording to restore gate + the top-demand request).
      name: 'Studio Polish',
      description: 'Fixes the mic first: hiss gone between phrases, poppin\u2019 p\u2019s tamed, room hum quieted — a clean, natural voice with nothing you can hear working. No tunnel, no pumping, no tin can.',
      tags: ['use-case:cleanup', 'vibe:natural', 'technique:clean', 'use-case:speech/hosting'],
      primary: 'use-case:cleanup',
      provenance: { origin: '#31 seed batch cell 12 (use-case · cleanup + natural), authored offline 2026-09-01', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'sp-n1', type: 'gate', params: { threshold: -45, attack: 0.005, release: 0.15, floor: -40 } },
        { id: 'sp-e1', type: 'eq', params: { lowGain: -1, midGain: 0.5, highGain: 1.5 } },
        { id: 'sp-c1', type: 'compressor', params: { threshold: -14, ratio: 2.5, attack: 0.01, release: 0.25 } },
        { id: 'sp-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    }
  ];
})();
