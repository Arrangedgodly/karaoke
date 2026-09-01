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
//
// GEN-1 GENRE BATCH (cycle 4, appended below the seed entries): six
// genre candidates — Metal / Rap-Hip-Hop / R&B-Soul / Country /
// Dance-EDM / Musicals — authored offline 2026-09-01 from the RQ-1 chain
// sketches (D1 disposition; docs/ultron/preset-axis-cycle/research/
// rq1-genre-idioms.md). Catalog-forced adjustments are recorded in the
// per-entry comments; gain budgets 9.69–11.26 dB of the published +12.
// The rap candidate RE-AUTHORS the seed batch's Hard-Tune Hotline (its
// audition note — autotune belongs first — is answered by BEH-1's
// front-insert rule, honored as the chain's leading node); the #31
// cell-1 draft was removed in the same edit so the cell is not
// double-covered or name-duplicated in the pen.

(function () {
  'use strict';

  window.AUDITION_CANDIDATES = [
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
    },
    {
      // GEN-1 cell: genre · Metal. RQ-1 metal sketch (D1) translated
      // verbatim: low-shelf cut stands in for the live HPF idiom, the
      // 5 kHz shelf carries the 3–5 kHz "aggressive bite", fast 6:1
      // catches karaoke screaming, in-chain grit at moderate drive keeps
      // the attitude (distortion output is cut-only, never budgeted),
      // and the near-slap ambience stays short and quiet — fast songs +
      // long reverb = mud. Budget 0 + 0.57·14 + 0.57·3 = 9.69 dB.
      name: 'Metal Mayhem',
      description: 'Aggressive bite for screaming along with the heavy stuff — edge and grit that cuts through the wall of guitars, without turning to mud or a boomy wash.',
      tags: ['genre:Metal', 'use-case:performance', 'vibe:bright', 'technique:ambience-short'],
      primary: 'genre:Metal',
      provenance: { origin: 'GEN-1 genre batch (genre · Metal), authored offline 2026-09-01 from the RQ-1 metal sketch (D1)', auditionDate: null, verdict: 'pending' },
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
      // GEN-1 cell: genre · Rap/Hip-Hop — the Hard-Tune re-author (OQ-4
      // resolved; BEH-1 honored): autotune is the FIRST node, key C /
      // scale Chromatic (the nearest-semitone grid stays musically valid
      // whatever the backing track's key — under Chromatic the key param
      // is inert; a guessed scale is the #1 artifact source), retune
      // 5 ms (inside Antares' 0–5 hard-tune band but with one detector
      // epoch of settle — 0 is the audition fallback knob if the snap
      // reads subtle), mix 100 (insert effect, not a parallel blend).
      // Supersedes the #31 cell-1 draft, whose audition note asked for
      // autotune-first. Budget 0 + 0.57·16 + 0.57·3 = 10.83 dB — the
      // same budget as Classic Karaoke.
      name: 'Hard-Tune Hotline',
      description: 'Hard-tune snap, dry and up front — the modern trap sound. Off-key lines lock onto pitch and every word stays crisp, never swimming in echo.',
      tags: ['genre:Rap/Hip-Hop', 'use-case:performance', 'technique:hard-tune', 'vibe:bright'],
      primary: 'genre:Rap/Hip-Hop',
      provenance: { origin: 'GEN-1 genre batch (genre · Rap/Hip-Hop; re-author of the #31 Hard-Tune Hotline draft per its 2026-09-01 note + BEH-1), from the RQ-1 rap sketch (D1)', auditionDate: null, verdict: 'pending' },
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
      // GEN-1 cell: genre · R&B/Soul. RQ-1 sketch verbatim: gentle 2.5:1
      // leveling on Warm Ballad's auditioned shape, a warm three-band
      // tilt (no band anywhere near the +6 single-boost rule), chorus at
      // 15 for the studio doubling/width idiom, 180 ms low-feedback
      // slap, plate at Warm Ballad's auditioned 35. Budget
      // 1 + 0.57·12 + 0.57·6 = 11.26 dB — the batch's closest fit to
      // the +12 policy (margin 0.74).
      name: 'Slow Jam Silk',
      description: 'Smooth and silky for slow jams — warm lows, gentle leveling, a soft plate and slap echo sitting behind the voice. Lush, never washed out.',
      tags: ['genre:R&B/Soul', 'use-case:performance', 'vibe:warm', 'technique:ambience-long'],
      primary: 'genre:R&B/Soul',
      provenance: { origin: 'GEN-1 genre batch (genre · R&B/Soul), authored offline 2026-09-01 from the RQ-1 r&b/soul sketch (D1)', auditionDate: null, verdict: 'pending' },
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
      // GEN-1 cell: genre · Country. RQ-1 sketch verbatim: compressor =
      // Antares' country stage-1 numbers (3:1, 5 ms attack, ~0.2 s
      // release), 100 ms slapback with feedback 8 and a prominent mix
      // (slapback = short + little feedback + up-front level), short
      // plate at 18, and the fixed 1 kHz mid band carrying the 1.5–3 kHz
      // twang lift (coarse by construction — audition tunes it). Budget
      // 0 + 0.57·13 + 0.57·6 = 10.83 dB.
      name: 'Nashville Nights',
      description: 'Honest and twangy, bright and natural like a country radio mix — the slap-back echo fans expect, with the voice staying up front. Present, never piercing.',
      tags: ['genre:Country', 'use-case:performance', 'vibe:natural', 'technique:ambience-short'],
      primary: 'genre:Country',
      provenance: { origin: 'GEN-1 genre batch (genre · Country), authored offline 2026-09-01 from the RQ-1 country sketch (D1)', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'cn-e1', type: 'eq', params: { lowGain: -1, midGain: 1.5, highGain: 2 } },
        { id: 'cn-c1', type: 'compressor', params: { threshold: -13, ratio: 3, attack: 0.005, release: 0.2 } },
        { id: 'cn-y1', type: 'delay', params: { timeMs: 100, feedback: 8, mix: 20 } },
        { id: 'cn-r1', type: 'reverb', params: { mix: 18 } },
        { id: 'cn-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // GEN-1 cell: genre · Dance/EDM. RQ-1 sketch with ONE
      // catalog-forced adjustment: the dotted-eighth throw is 380 ms,
      // not the sketch's exact 375 (dotted eighth at 120 BPM) — delay
      // timeMs steps by 10 ms, so 375 sits off the catalog grid; 380 is
      // the nearest legal value (~1.3% of tempo, under the tuning
      // audition will do anyway). Otherwise verbatim: fast 4:1 punch
      // (the studio serial-compression idiom in the one legal
      // compressor), chorus width on the hook, ceiling −3 for club
      // loudness within policy, mix depths held moderate because the
      // studio's sidechain duck cannot be expressed here. Budget
      // 0 + 0.57·16 + 0.57·3 = 10.83 dB.
      name: 'Club Anthem',
      description: 'Big, bright and club-loud — pumping energy, wide sheen on the hook, and echo throws that land on the beat. Punchy, never buried by the track.',
      tags: ['genre:Dance/EDM', 'use-case:performance', 'vibe:bright', 'technique:modulated/wide'],
      primary: 'genre:Dance/EDM',
      provenance: { origin: 'GEN-1 genre batch (genre · Dance/EDM), authored offline 2026-09-01 from the RQ-1 dance/edm sketch (D1; delay 375→380 ms, step-grid)', auditionDate: null, verdict: 'pending' },
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
      // GEN-1 cell: genre · Musicals. RQ-1 sketch verbatim: gate first
      // (theatre channel tidiness; floor −35 keeps trail-offs natural),
      // low-shelf cut ≈ the 150–200 Hz radio-mic HPF idiom, diction
      // presence, light 3:1 riding quiet-to-belt swings, faint 200 ms
      // throw over a modest plate. Known translation limit (flagged in
      // the sketch, D1's caveat): the fixed plate IR cannot reach a real
      // theatre hall's 1.8–2.5 s, so hall size compresses to mix depth —
      // AUD-1 audition decides if mix 25 reads "just enough hall".
      // Budget 0 + 0.57·13 + 0.57·6 = 10.83 dB.
      name: 'West End Nights',
      description: 'Showtune treatment — clear diction over the pit, light compression that rides the quiet-to-belt swings, and just enough hall around the voice. Every word lands, no tunnel.',
      tags: ['genre:Musicals', 'use-case:performance', 'vibe:spacious', 'technique:ambience-long'],
      primary: 'genre:Musicals',
      provenance: { origin: 'GEN-1 genre batch (genre · Musicals), authored offline 2026-09-01 from the RQ-1 musicals sketch (D1)', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'mu-n1', type: 'gate', params: { threshold: -48, attack: 0.005, release: 0.2, floor: -35 } },
        { id: 'mu-e1', type: 'eq', params: { lowGain: -3, midGain: 1, highGain: 2 } },
        { id: 'mu-c1', type: 'compressor', params: { threshold: -13, ratio: 3, attack: 0.006, release: 0.25 } },
        { id: 'mu-y1', type: 'delay', params: { timeMs: 200, feedback: 15, mix: 12 } },
        { id: 'mu-r1', type: 'reverb', params: { mix: 25 } },
        { id: 'mu-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    }
  ];
})();
