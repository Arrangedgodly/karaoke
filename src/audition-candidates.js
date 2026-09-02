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
// SEED BATCH, CLOSED (#31, authored offline 2026-09-01). The 2026-09-01
// live audition at the ?audition Booth decided all twelve seed
// candidates: EIGHT ACCEPTED and promoted into
// src/factory-library-data.js by step 3 above — Chipmunk Party, Deep
// Narrator, AM Radio Ghost, Cathedral Drift, Jazz Cellar, Rotary
// Nostalgia, Space Lounge, Studio Polish — and FOUR REJECTED
// (Hard-Tune Hotline: 'needs autotune first in chain'; Robot Usher:
// 'too buzzy not robotic enough'; 8-Bit Encore: 'too crushed and hard
// to hear'; Megaphone Rally: 'not quite as loud as you would expect
// from the name'). No seed entry remains here; the four rejection notes
// are answered by the GEN-1/GAG-1 re-authors below, which reuse the
// names.
//
// The seed authoring rules still govern every entry here: descriptions
// follow the #28 checklist (the sound in user words, artist shorthand
// where universal, and the complaint vocabulary the preset fixes or
// avoids); param values authored against the live catalog specs; gain
// budgets inside the published +12 (gainDb + 0.57·|threshold| +
// 0.57·|ceiling|).
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
//
// GAG-1 GAG BATCH (cycle 4, appended below the genre entries): six gag
// candidates — the three re-auditioned gags (robot / megaphone / 8-bit,
// re-authored per D2 to answer their 2026-09-01 rejection notes) and the
// three never-authored cells (helium / darth-vader / monster-demon, per
// D3) — authored offline 2026-09-01 from the RQ-2/RQ-3 record
// (docs/ultron/preset-axis-cycle/research/rq2-gag-reauthoring.md). The
// re-authors SUPERSEDE the #31 cell-4/5/7 drafts, removed in the same
// edit (same rule as the Hard-Tune supersession: name-keyed verdict
// recording cannot hold duplicates); the exact param deltas vs the
// rejected chains are recorded in the per-entry comments. Gain budgets
// 3.42–11.97 dB of the published +12 — megaphone deliberately sits at
// the boundary (PEN-1 verifies the ≤ is inclusive).
//
// PEN-1 ORDER (cycle 4, batch PR): the 12 entries are sequenced
// GENRE-FIRST — the six GEN-1 genre candidates in sketch order
// (Metal → Rap → R&B/Soul → Country → Dance/EDM → Musicals), and only
// then the six GAG-1 gags (the three re-authors, the three new cells)
// — so the user's audition validates domain content before gags. A
// pure data move (no entry bytes changed); the committed conformance
// pass in tests/test-factory-presets-policy.js section F pins the order
// so the batch cannot regress silently. (The eight seed entries the
// order originally interleaved were promoted out on 2026-09-01; the
// order rule is unchanged.)

(function () {
  'use strict';

  window.AUDITION_CANDIDATES = [
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
    },
    {
      // GAG-1 cell: gag · robot — the re-author (D2). Note answered:
      // "too buzzy not robotic enough" → the robot read is now carried by
      // the harmony double + voice-break AM, NOT saturation (Wilson &
      // Moore VIHAR 2017: the character corpus's top effects are
      // echo/delay 66, harmony 45, modulation 40; voice breaks were the
      // single most separating feature vs human controls; the Dalek's
      // 30 Hz ring mod is unreachable — tremolo caps at 14 Hz — so
      // 12 Hz/65 is the closest legal stand-in and the double must carry
      // mono rigs). Exact deltas vs the rejected chain: distortion
      // REMOVED (the static "buzzy" core), bitcrusher 4/70 → 6/30
      // (25.8 → 37.9 dB SNR; grit as texture, dry voice carries words),
      // eq −4/+4/−2 → −6/+4/0 (thinner chest, vowel band kept, 5 k shelf
      // reopened so consonants stop feeling muffled), ADDED pitchshift
      // +3/mix 45 (W&M's robot recipe: small pitch up + original back =
      // "harmony"), ADDED chorus 1.5 ms/6 Hz/30 (short-depth chorus = a
      // moving comb filter, a listed robot-character effect), ADDED
      // tremolo 12 Hz/65 (AM voice breaks). Pre-planned audition
      // fallbacks: tremolo 10–14 Hz / 60–70, or drop the bitcrusher
      // (least load-bearing). Budget 0 + 0.57·6 = 3.42 dB.
      name: 'Robot Usher',
      description: 'Deadpan machine voice — a metallic self-duet with stuttering circuit chatter. Every word still lands; tinny, never buzzy mush.',
      tags: ['gag:robot', 'use-case:performance', 'technique:modulated/wide'],
      primary: 'gag:robot',
      provenance: { origin: 'GAG-1 gag batch (gag · robot; re-author of the #31 seed cell 4 per its 2026-09-01 note), authored offline 2026-09-01 from the RQ-2 robot sketch (D2)', auditionDate: null, verdict: 'pending' },
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
      // GAG-1 cell: gag · megaphone — the re-author (D2). Note answered:
      // "not quite as loud as you would expect from the name" → perceived
      // loudness comes from presence + density, not level (equal-loudness
      // contours peak 2–5 kHz; bullhorn drivers are band-limited there;
      // compressed audio reads louder at matched peak/RMS). Exact deltas
      // vs the rejected chain: eq −6/+5/+3 → −12/+9/+3 (full horn
      // band-pass; +9 is the per-band legal max), distortion 0.35/0.4/−10
      // → 0.5/0.45/0 (the −10 output was 10 dB thrown away — the single
      // biggest fix), compressor −14/6/4 ms/0.12 → −18/12/2 ms/0.08 (max
      // legal density: deepest threshold, ratio 12, fastest legal attack,
      // 80 ms release keeps energy up between words), ceiling −6 → −3
      // (policy max). Deliberate boundary case, flagged for PEN-1: budget
      // 0.57·18 + 0.57·3 = 10.26 + 1.71 = 11.97 dB of +12 (0.03 margin),
      // EQ boost sum +12 exactly at the cap, one band ≥ +6. No technique
      // tag — none of the frozen values fits (adding one speculatively is
      // forbidden). Pre-planned audition fallback: threshold −18 → −16/−17
      // if over-squashed (budget 10.83/10.26). No raw gain node by design:
      // density + presence + ceiling IS the loudness mechanism here.
      name: 'Megaphone Rally',
      description: 'Squashed, honking bullhorn shout that punches through the room like a protest PA — loud from the name, clear over the noise.',
      tags: ['gag:megaphone', 'use-case:performance'],
      primary: 'gag:megaphone',
      provenance: { origin: 'GAG-1 gag batch (gag · megaphone; re-author of the #31 seed cell 7 per its 2026-09-01 note), authored offline 2026-09-01 from the RQ-2 megaphone sketch (D2)', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'mr-e1', type: 'eq', params: { lowGain: -12, midGain: 9, highGain: 3 } },
        { id: 'mr-d1', type: 'distortion', params: { drive: 0.5, tone: 0.45, output: 0 } },
        { id: 'mr-c1', type: 'compressor', params: { threshold: -18, ratio: 12, attack: 0.002, release: 0.08 } },
        { id: 'mr-l1', type: 'limiter', params: { ceiling: -3, release: 50 } }
      ]
    },
    {
      // GAG-1 cell: gag · 8-bit — the re-author (D2). Note answered:
      // "too crushed and hard to hear" → melody intelligibility: 6 bits
      // lifts quantization SNR 19.8 → 37.9 dB, mix 55 keeps a dry core
      // carrying the tune, tremolo 4 Hz/25 stops digging amplitude holes
      // where notes live, and the presence EQ goes BEFORE the crusher —
      // pre-emphasis raises melody/consonant energy into the quantizer so
      // it dominates the fixed noise floor (a post-crush boost would lift
      // the noise with the signal). Exact deltas vs the rejected chain:
      // bits 3 → 6, mix 80 → 55, tremolo 6 Hz/40 → 4 Hz/25, ADDED eq
      // (−2/+1/+3) pre-crush. Pre-planned audition fallback: bits/mix
      // 6/55 → 7/45 if still crushed. Budget 0.57·6 = 3.42 dB.
      name: '8-Bit Encore',
      description: 'Chiptune video-game vocals with the melody still front and center — crunchy, never crushed to mush.',
      tags: ['gag:8-bit', 'technique:lo-fi', 'use-case:performance'],
      primary: 'gag:8-bit',
      provenance: { origin: 'GAG-1 gag batch (gag · 8-bit; re-author of the #31 seed cell 5 per its 2026-09-01 note), authored offline 2026-09-01 from the RQ-2 8-bit sketch (D2)', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'eb-e1', type: 'eq', params: { lowGain: -2, midGain: 1, highGain: 3 } },
        { id: 'eb-b1', type: 'bitcrusher', params: { bits: 6, mix: 55 } },
        { id: 'eb-t1', type: 'tremolo', params: { rateHz: 4, depth: 25 } },
        { id: 'eb-l1', type: 'limiter', params: { ceiling: -6, release: 80 } }
      ]
    },
    {
      // GAG-1 cell: gag · helium (D3, never authored). Real helium raises
      // FORMANTS, not pitch — inexpressible here (the granular pitchshift
      // moves pitch+formants together), so the cell earns separation two
      // ways: register +10 vs Chipmunk Party's +7 (non-octave on purpose —
      // +12 would read as a clean octaver double) and a thin, body-stripped
      // EQ (−9/−1/+2) vs chipmunk's warm tilt (−2/+1/+3). Escalation
      // knobs for the audition: pitch +10 → +11 if the register gap
      // doesn't read; low −9 → −10 if still too warm. Budget
      // 0.57·6 = 3.42 dB; EQ boost +2 only.
      name: 'Helium Hangout',
      description: 'Balloon-breath squeak — thin, floaty, silly-high. Words stay squeaky-crisp, not squeaky-mush.',
      tags: ['gag:helium', 'technique:pitch-gag', 'use-case:performance'],
      primary: 'gag:helium',
      provenance: { origin: 'GAG-1 gag batch (gag · helium), authored offline 2026-09-01 from the RQ-3 helium sketch (D3)', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'hh-e1', type: 'eq', params: { lowGain: -9, midGain: -1, highGain: 2 } },
        { id: 'hh-p1', type: 'pitchshift', params: { pitch: 10, mix: 100 } },
        { id: 'hh-l1', type: 'limiter', params: { ceiling: -6, release: 100 } }
      ]
    },
    {
      // GAG-1 cell: gag · darth-vader (D3, never authored). Production
      // reality: Jones's baritone was essentially unprocessed — so this is
      // NOT trailer-deep: pitch −4 (deliberately half of Deep Narrator's
      // −7), character from a helmet-INTERCOM color instead: mid-centered
      // band-pass (−6/+4/−7 — milder than AM Radio Ghost's −10/+4/−9, and
      // opposite to Narrator's warm +3/0/−2), faint 0.18-drive grit with
      // output −12 (crackle, not growl), bone-DRY (no reverb — Narrator
      // owns the cave, Radio owns static-crush at full band-pass with no
      // pitch). The iconic mechanical-breath layer is inexpressible in the
      // catalog — the description carries that read. Tiebreaker knob if it
      // reads as "bland deep radio": drive 0.18 → 0.15–0.25. Budget
      // 0.57·6 = 3.42 dB; EQ boost +4, one band.
      name: 'Dark Helmet Baritone',
      description: 'Masked-villain baritone through a helmet intercom — dark, close, faintly crackling. Menace without the muddy cave.',
      tags: ['gag:darth-vader', 'technique:pitch-gag', 'use-case:performance'],
      primary: 'gag:darth-vader',
      provenance: { origin: 'GAG-1 gag batch (gag · darth-vader), authored offline 2026-09-01 from the RQ-3 darth-vader sketch (D3)', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'dv-p1', type: 'pitchshift', params: { pitch: -4, mix: 100 } },
        { id: 'dv-e1', type: 'eq', params: { lowGain: -6, midGain: 4, highGain: -7 } },
        { id: 'dv-d1', type: 'distortion', params: { drive: 0.18, tone: 0.22, output: -12 } },
        { id: 'dv-l1', type: 'limiter', params: { ceiling: -6, release: 90 } }
      ]
    },
    {
      // GAG-1 cell: gag · monster/demon (D3, never authored). Distinct
      // from BOTH deep cells: register BELOW Narrator (−10 vs −7; Vader
      // sits at −4) plus GROWL — drive 0.6 into a dark 0.18 tone lowpass
      // (≈2.2 kHz) concentrates noisy low-mid energy; noise = evil per the
      // VIHAR corpus (goodness correlates −0.36 with harmonics-to-noise
      // ratio). Drive 0.6 is the only sketch above the rejected robot's
      // 0.45 — growl is WANTED here. Order matters: pitch first, THEN
      // distort (distorting first would shift the growl harmonics up into
      // chipmunk territory). Low +5 adds chest menace while staying under
      // the +6 single-big-boost floor; EQ boost sum +7. If words smear:
      // tone 0.18 → 0.22 re-opens the consonant band first. Budget
      // 0.57·6 = 3.42 dB.
      name: 'Demon Growl',
      description: 'Pitch-floor demon snarl — gravel throat over a subterranean chest. Deep and scary while the words survive.',
      tags: ['gag:monster/demon', 'technique:pitch-gag', 'vibe:dark/moody'],
      primary: 'gag:monster/demon',
      provenance: { origin: 'GAG-1 gag batch (gag · monster/demon), authored offline 2026-09-01 from the RQ-3 monster/demon sketch (D3)', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'mg-p1', type: 'pitchshift', params: { pitch: -10, mix: 100 } },
        { id: 'mg-e1', type: 'eq', params: { lowGain: 5, midGain: 2, highGain: -2 } },
        { id: 'mg-d1', type: 'distortion', params: { drive: 0.6, tone: 0.18, output: -8 } },
        { id: 'mg-l1', type: 'limiter', params: { ceiling: -6, release: 80 } }
      ]
    }
  ];
})();
