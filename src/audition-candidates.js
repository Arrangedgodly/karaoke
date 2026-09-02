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
//   { name, description, summary, tags: ['axis:value', ...], primary,
//     provenance: { origin, auditionDate: null, verdict: 'pending' },
//     nodes: [{id, type, params}] }
//
// `summary` (<= 60 chars, hand-written, the line an agent matches a
// request against) is a LIBRARY conformance requirement, so promotion
// cannot land an entry without one. Candidates authored from here on
// should carry it at authoring time rather than have it invented at
// promotion — the person who wrote the sound knows what request it
// answers. The pen's own conformance pass does not yet require it, so
// the pre-existing entries below are not blocked.
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
// LC-1 CORPUS BATCH (scale-out, appended below the PEN-1 12): eight
// candidates authored offline 2026-09-01 from
// docs/ultron/preset-axis-cycle/request-corpus.md — a 123-request corpus
// built from docs/ultron/research/taxonomy-prior-art.md (six products,
// four communities) and scored against the 26 sounds that exist today
// under the Closeness rule. Verdicts: 74 matched, 21 coverage gaps (14
// authored -> these 8 candidates, 7 deferred), 28 capability gaps LOGGED
// AND NEVER APPROXIMATED (scale-out-plan D-10).
//
// The admission bar these eight cleared (D-3): each names, in its
// provenance.origin, (1) the plain-language request it answers in a real
// singer's words and (2) why the CLOSEST existing preset FAILS that
// request. Cell coverage was evidence, never the bar — four of the seven
// "open cells" the plan listed (use-case:practice, vibe:bright,
// vibe:dark/moody, vibe:lo-fi) were scored as dropdown holes with no
// failing request behind them and are DELIBERATELY still empty.
//
// Why eight and not fifty (D-4, "if the corpus and the bar conflict, the
// bar wins"): 23% of the corpus is unbuildable at the engine ceiling
// (one fixed reverb IR, three fixed EQ bands, no harmony/vocoder/formant
// shift) and 60% is already served. The capability-gap register in the
// corpus doc — formant shift blocks 7 requests, harmony 5, a selectable
// impulse response 4 — is the batch's most valuable output.
//
// No vocabulary append: all eight tag inside the frozen vocabularies
// (src/factory-library-data.js is Lane B's file this batch). Append
// pressure and the axis-level artist: pressure are logged in the corpus
// doc, not acted on. All eight are DOMAIN candidates (no gag primary),
// so the genre-first audition order is preserved batch-wise: the PEN-1
// block still runs domain-then-gags, and this block is all domain.
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
    },
    // ==================================================================
    // LC-1 CORPUS BATCH — eight candidates, all domain (no gag primary).
    // Each provenance.origin carries the D-3 admission evidence: the
    // request in a singer's words, and the closest preset's named
    // failure. Corpus row ids (A1, B7, ...) refer to
    // docs/ultron/preset-axis-cycle/request-corpus.md.
    // ==================================================================
    {
      // Corpus E1 (genre · Pop — an empty primary WITH a real failing
      // request behind it, unlike the four cells scored as dropdown
      // holes). The chain is the modern pop-radio idiom expressed in the
      // three fixed bands: 200 Hz shelf down to de-box, 1 kHz slightly
      // scooped, the 5 kHz shelf carrying real air; a fast 5:1 for
      // record-style density; a whisper of chorus for the sheen a
      // produced record has and a flat default cannot; an eighth-note
      // throw (250 ms) tucked under the words rather than Classic
      // Karaoke's general 300 ms room. Budget 0.57*15 + 0.57*3 =
      // 8.55 + 1.71 = 10.26 dB. EQ boost sum +4, no band >= +6.
      name: 'Chart Topper',
      description: 'Top-40 radio polish — clean lows, real air on top, a touch of width, and an eighth-note echo tucked in behind the words. Produced and bright, never brittle or boxy.',
      tags: ['genre:Pop', 'use-case:performance', 'vibe:bright', 'technique:ambience-short'],
      primary: 'genre:Pop',
      provenance: { origin: 'LC-1 corpus batch, request E1 "I\'m singing a Top-40 pop song — make me sound like the record". CLOSEST FAILS: Classic Karaoke is EQ-flat (0/0/0) by design — it is the neutral default, so no 200 Hz de-box, no 5 kHz air, no width, and its 300 ms/25% delay reads as a general room, not a pop eighth-note; Warm Ballad, the only other genre:Pop-tagged sound, is a slow close-up ballad with no delay and no top end. The request wants a PRODUCED sound; the closest preset\'s whole job is to be unproduced. genre:Pop had no preset at all.', auditionDate: null, verdict: 'pending' },
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
      // Corpus D2/D3 (gentle pitch correction). Autotune is the chain's
      // FIRST node per the BEH-1 rule. Scale Chromatic on purpose — the
      // pen's own standing note: a guessed scale is the #1 artifact
      // source, and under Chromatic the key param is inert, so the
      // preset stays valid whatever key the backing track is in. Retune
      // 250 ms is the catalog's own documented "natural gentle setting"
      // on the same engine that Hard-Tune Hotline runs at 5 ms; mix 85
      // leaves a sliver of the real voice so the correction reads as
      // help rather than as an effect. Everything downstream is
      // deliberately modest so the preset sits under any genre.
      // Budget 0.57*14 + 0.57*6 = 7.98 + 3.42 = 11.40 dB. Audition
      // knobs: retune 250 -> 150 if the correction reads too slow to
      // help, mix 85 -> 92 if it reads too weak.
      name: 'Pitch Safety Net',
      description: 'Pitch correction you feel instead of hear — sour notes slide into tune over a beat rather than snapping, with a light room behind. A safety net, not a T-Pain robot.',
      tags: ['use-case:performance', 'technique:hard-tune', 'vibe:natural', 'genre:Pop'],
      primary: 'use-case:performance',
      provenance: { origin: 'LC-1 corpus batch, requests D2 "The Helicon provides subtle auto tune, not as harsh as T-Pain" (r/karaoke) and D3 Voloco "Natural Tune". CLOSEST FAILS: Hard-Tune Hotline is the ONLY pitch-correction preset in all 26 sounds, and its retune is 5 ms at mix 100 — precisely the T-Pain snap this request explicitly asks NOT to have. There is no gentle setting to load, and Simple view cannot reach the retune knob to make one.', auditionDate: null, verdict: 'pending' },
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
      // Corpus A1/A8/F17 (echo AMOUNT — the most-attested family in the
      // record). The corpus separates echo from reverb explicitly ("33%
      // reverb.. and just 15% echo"), so this preset is echo-forward and
      // deliberately reverb-LIGHT: delay mix 38 at 330 ms with 48%
      // feedback gives repeats a singer can count, and reverb 14 keeps
      // them distinct instead of smearing into the wash the same forum
      // calls a tunnel. Feedback 48 sits under the compound-loop guard's
      // 55 threshold with room to spare, and the EQ boost sum is +1.5,
      // so the guard's second condition is nowhere near either.
      // Budget 0.57*14 + 0.57*6 = 11.40 dB. Audition knob: feedback
      // 48 -> 54 if the repeats die too fast (54 is still legal; 55
      // trips the guard only when EQ boost sum >= 6, which this is not).
      name: 'Noraebang Echo',
      description: 'The karaoke-room echo people actually shout for — repeats you can count trailing every line, with the wash kept low so the words stay words. Big echo, no tunnel.',
      tags: ['use-case:performance', 'vibe:spacious', 'technique:ambience-long'],
      primary: 'use-case:performance',
      provenance: { origin: 'LC-1 corpus batch, requests A1 "Give me some echo!" (Karaoke Scene KJ forum, shouted mid-song), A8 noraebang echo-as-default (r/AskAKorean), F17 "echo but without the wash". CLOSEST FAILS: nothing in the 26 sounds is ABOUT echo — the highest delay mix anywhere is Classic Karaoke\'s 25% at 300 ms/25% feedback, which is exactly the "just enough" setting the singer already has when they shout for MORE. Cathedral Drift and Big Room answer "more reverb", a request the corpus itself distinguishes from echo. Rock Night is the only reverb-free delay and is a bright rock colour, not a neutral echo.', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'ne-e1', type: 'eq', params: { lowGain: -1, midGain: 0.5, highGain: 1 } },
        { id: 'ne-c1', type: 'compressor', params: { threshold: -14, ratio: 3, attack: 0.008, release: 0.18 } },
        { id: 'ne-y1', type: 'delay', params: { timeMs: 330, feedback: 48, mix: 38 } },
        { id: 'ne-r1', type: 'reverb', params: { mix: 14 } },
        { id: 'ne-l1', type: 'limiter', params: { ceiling: -6, release: 150 } }
      ]
    },
    {
      // Corpus F10/C7 (vibe · intimate — an empty primary WITH a real
      // failing request). The mechanism is the inverse of Warm Ballad's:
      // near-dry (reverb 8, no delay at all) so the voice stays at the
      // mic instead of being pushed into a hall, a gate with a SHALLOW
      // floor (-22, not Studio Polish's -40) so room noise drops without
      // clipping the breath tails the request is made of, chest warmth
      // at 200 Hz, and a 4.5:1 lifting quiet detail up over the backing
      // track. Budget 0.57*14 + 0.57*6 = 11.40 dB. Audition knob: gate
      // floor -22 -> -16 if breath tails still get chopped.
      name: 'Close-Up Whisper',
      description: 'Right up against the mic — breathy, quiet singing lifted so every word carries, with barely any room behind it. Close and warm; no hall pushing you to the back of the stage.',
      tags: ['vibe:intimate', 'use-case:performance', 'vibe:warm', 'technique:clean'],
      primary: 'vibe:intimate',
      provenance: { origin: 'LC-1 corpus batch, requests F10 TC-Helicon "CLOSE UP" / whisper-close intimate singing and C7 voicechanger.live "ASMR". CLOSEST FAILS: vibe:intimate has no preset at all; Warm Ballad is the closest slow-song chain and fails twice — its 35% plate pushes the voice back into a hall, the exact opposite of "right next to the mic", and its 2.5:1 at -10 dB leaves genuinely breathy notes under the backing track.', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'cw-n1', type: 'gate', params: { threshold: -50, attack: 0.003, release: 0.25, floor: -22 } },
        { id: 'cw-e1', type: 'eq', params: { lowGain: 1.5, midGain: -0.5, highGain: -1 } },
        { id: 'cw-c1', type: 'compressor', params: { threshold: -14, ratio: 4.5, attack: 0.012, release: 0.3 } },
        { id: 'cw-r1', type: 'reverb', params: { mix: 8 } },
        { id: 'cw-l1', type: 'limiter', params: { ceiling: -6, release: 150 } }
      ]
    },
    {
      // Corpus B7 — an ANTI-PRESET, the one family D-10 approves for
      // authoring rather than logging. HONEST LIMIT, stated up front:
      // the app has no de-esser, so the only tool for sibilance is the
      // FIXED 5 kHz shelf, which trades air for the fix. That trade is
      // the audition question. The complaint pairs hiss WITH too much
      // reverb, so the fix is less of both: shelf -4.5, reverb 10 (not
      // zero — a dead voice is its own complaint), plus the gate and
      // gentle levelling the cleanup use-case already owes.
      // Budget 0.57*14 + 0.57*6 = 11.40 dB. Audition knob: high -4.5 ->
      // -3 if it reads muffled, -6 if the esses still sting.
      name: 'Hiss Rescue',
      description: 'For voices where every s and f hisses: the top end comes down and the wash comes off, so sibilance stops stinging. Softer, not muffled — the words keep their edges.',
      tags: ['use-case:cleanup', 'vibe:warm', 'technique:clean', 'use-case:speech/hosting'],
      primary: 'use-case:cleanup',
      provenance: { origin: 'LC-1 corpus batch, request B7 (verbatim, sing.salon): "the default Studio setting have too much reverb... produces also a lot of hiss sounds, especially with sss or fff components". CLOSEST FAILS: Studio Polish is THE cleanup preset and makes this complaint worse — its 5 kHz shelf is +1.5 dB, so every s and f is lifted, and the hiss it promises to fix is room hiss BETWEEN phrases (a gate job), not sibilance INSIDE words. The only two sounds that cut the 5 kHz shelf are Jazz Cellar (-3, a dark jazz colour riding 30% reverb) and Phone Call Gag (a band-limited gag); neither is a cleanup preset.', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'hr-n1', type: 'gate', params: { threshold: -46, attack: 0.004, release: 0.16, floor: -35 } },
        { id: 'hr-e1', type: 'eq', params: { lowGain: 0.5, midGain: 1, highGain: -4.5 } },
        { id: 'hr-c1', type: 'compressor', params: { threshold: -14, ratio: 2.5, attack: 0.01, release: 0.25 } },
        { id: 'hr-r1', type: 'reverb', params: { mix: 10 } },
        { id: 'hr-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // Corpus C4/C8/I2 (hosting). Loudness here is presence + density +
      // ceiling, the same mechanism Megaphone Rally uses — but WITHOUT
      // the band-limiting that makes that one a gag: the low shelf comes
      // down only -2 (not -12) and the 5 kHz shelf goes UP, so this is a
      // human voice that cuts, not a bullhorn. EQ boost sum +5.5, held
      // deliberately under the compound-loop guard's +6 so the slap is
      // unconditionally safe. A whisper of 90 ms slap keeps it from
      // sounding like a dead PA feed. Budget 0.57*17 + 0.57*3 =
      // 9.69 + 1.71 = 11.40 dB.
      name: 'Room Announcer',
      description: 'The host mic that cuts through a loud room — dense, present and up front, so the next singer\u2019s name lands over the crowd. Clear and human, never a bullhorn.',
      tags: ['use-case:speech/hosting', 'vibe:bright', 'technique:clean'],
      primary: 'use-case:speech/hosting',
      provenance: { origin: 'LC-1 corpus batch, requests C4 voicechanger.live "Announcer", C8 "Streamer Pro", I2 hosting the room (the Karaoke Scene forum, one of the two verbatim sources in the record, is ENTIRELY hosts). CLOSEST FAILS: Clean Speech is the only use-case:speech/hosting preset and is designed to be the exact opposite — "no audible coloring", 2:1 at -10 dB, 5 kHz shelf at -1 dB, ceiling -6; it will not cut through a room because it is not built to. Megaphone Rally does cut through but is a GAG: a band-limited bullhorn honk, not a host\'s voice.', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'ra-n1', type: 'gate', params: { threshold: -42, attack: 0.003, release: 0.12, floor: -30 } },
        { id: 'ra-e1', type: 'eq', params: { lowGain: -2, midGain: 3, highGain: 2.5 } },
        { id: 'ra-c1', type: 'compressor', params: { threshold: -17, ratio: 6, attack: 0.003, release: 0.1 } },
        { id: 'ra-y1', type: 'delay', params: { timeMs: 90, feedback: 6, mix: 8 } },
        { id: 'ra-l1', type: 'limiter', params: { ceiling: -3, release: 60 } }
      ]
    },
    {
      // Corpus C6 (spoken word, rich). The deliberate opposite of Room
      // Announcer on the same axis: chest at the 200 Hz shelf (+3.5),
      // the 1 kHz peak SCOOPED (-1) so the extra low end reads as body
      // rather than box, a slower 3.5:1 that rides a laugh, and reverb 5
      // so it is a room rather than an anechoic booth. EQ boost sum +5,
      // no band >= +6. Budget 0.57*14 + 0.57*6 = 11.40 dB. Audition
      // knob: low +3.5 -> +2.5 if it reads boomy on a close mic.
      name: 'Podcast Warmth',
      description: 'Rich spoken-word warmth for podcasts and streams — chest in the voice, boxiness scooped out, and a steady level from a whisper to a laugh. Broadcast, not boomy.',
      tags: ['use-case:speech/hosting', 'vibe:warm', 'technique:clean'],
      primary: 'use-case:speech/hosting',
      provenance: { origin: 'LC-1 corpus batch, request C6 podcast/streaming voice (vocalpresets.com carries "Podcast" as its own filtered bucket with four presets; Smule "Pro Studio"; the market\'s dominant adjective "radio-ready"). CLOSEST FAILS: Clean Speech\'s whole description is "the voice should just sound like itself" — the opposite ask. Warm Ballad has the warmth but is a SINGING chain wearing a 35% hall, wrong for spoken word. Room Announcer (this same batch) is bright and dense for cutting through a room, not warm and relaxed for headphones.', auditionDate: null, verdict: 'pending' },
      nodes: [
        { id: 'pw-n1', type: 'gate', params: { threshold: -44, attack: 0.004, release: 0.2, floor: -32 } },
        { id: 'pw-e1', type: 'eq', params: { lowGain: 3.5, midGain: -1, highGain: 1.5 } },
        { id: 'pw-c1', type: 'compressor', params: { threshold: -14, ratio: 3.5, attack: 0.01, release: 0.22 } },
        { id: 'pw-r1', type: 'reverb', params: { mix: 5 } },
        { id: 'pw-l1', type: 'limiter', params: { ceiling: -6, release: 120 } }
      ]
    },
    {
      // Corpus H3/H5 (doubling). The classic ADT: a DEEP, SLOW chorus
      // (6 ms at 0.3 Hz — a detuned second take, not the 1.5-3 ms
      // shimmer every other chorus in the pen uses) feeding a 30 ms
      // delay at mix 40 with feedback ZERO, so it is one double rather
      // than repeats. Chorus before delay on purpose: the delayed copy
      // is the chorused one, which is what makes it read as a separate
      // performance. Budget 0.57*13 + 0.57*6 = 7.41 + 3.42 = 10.83 dB.
      // HONEST LIMIT carried in the description: this is unison
      // doubling, NOT harmony or backing singers — the app has neither,
      // and D-10 forbids selling one as the other. Audition knob:
      // chorus depth 6 -> 8 if the double reads as width instead of a
      // second voice.
      name: 'Double Track',
      description: 'Sounds like two of you singing the same line — a wide, thick lead with a second take sitting just behind it. Doubling, not harmony: your voice twice, not backing singers.',
      tags: ['vibe:epic/big', 'use-case:performance', 'technique:modulated/wide', 'genre:Pop'],
      primary: 'vibe:epic/big',
      provenance: { origin: 'LC-1 corpus batch, requests H3 Boss VE-5 "DOUBLE VOICE" / TC-Helicon\'s "Doubling" tag (carried by a majority of its published preset list) / Voloco doubling packs, and H5 "UNISON". CLOSEST FAILS: chorus appears in five of the 26 sounds (Slow Jam Silk 15%, Club Anthem 20%, Cathedral Drift 18%, Space Lounge 25%, Jazz Cellar 10%) but ALWAYS as width texture underneath a genre or a vibe — never at a depth and mix that reads as a second take, and never with the short pre-delay that makes a double a double rather than a shimmer. Big Room, the only vibe:epic/big preset, gets its size from a 50% plate and a 320 ms delay: one voice in a hall, not two voices.', auditionDate: null, verdict: 'pending' },
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
})();
