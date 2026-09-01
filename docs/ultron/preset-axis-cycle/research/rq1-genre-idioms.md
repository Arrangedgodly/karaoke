# RQ-1 — Evidence-backed vocal-chain idioms for six genres (live karaoke)

- **Status**: proposed
- **Decision priority**: P0 (blocking GEN-1, per cycle-4 plan)
- **Affected task IDs**: RES-1 (this record), GEN-1 (primary consumer), BEH-1
  (rap sketch assumes its autotune-front insert rule), PEN-1 (policy checks
  run against these sketches), OQ-4 (rap hard-tune defaults resolved here)
- **Date**: 2026-08-29
- **Delegation record**: deep-research track agent, dispatched per
  `docs/ultron/preset-axis-cycle/plan.md` RQ table (RQ-1, blocking GEN-1).
  Codebase evidence read directly: `src/effect-catalog.js`,
  `src/node-{gain,compressor,eq,delay,reverb,limiter,gate,distortion,chorus,autotune,phaser,bitcrusher,tremolo,pitchshift}.js`,
  `src/mcp-tools.js` (AGENT_PARAM_POLICY, CHAIN_LIMITS, CHAIN_RULES),
  `src/factory-library-data.js` (14 shipped presets as precedents),
  `src/autotune-worklet.js` (chromatic/key semantics),
  `src/node-reverb.js` (fixed plate IR). Web evidence: manufacturer
  primary sources (Yamaha Pro Audio hub, Antares/Auto-Tune), Sound on
  Sound, theatre-sound practitioner pages, live-sound community threads;
  full links + dates + the exact claim each supports in the Evidence
  section. Live-context sources preferred wherever they conflicted with
  studio idioms (conflicts called out per genre).

## Question

What are the evidence-backed vocal-chain idioms — EQ tilt, compression
character, reverb/delay amounts, effect use — for Metal, Rap/Hip-Hop,
R&B/Soul, Country, Dance/EDM, and Musicals in LIVE KARAOKE (not studio)
contexts, each expressible as a concrete chain in the app's 14 node types
within the published gain-budget policy?

## Constraints / evaluation criteria

1. **Node vocabulary is FIXED (14 types)** with fixed param ranges read
   from the registrations: gain (`gainDb` −24..24), compressor
   (threshold −60..0, ratio 1..20, attack 0..1 s, release 0..1 s), eq
   (3 FIXED bands: low shelf 200 Hz, mid peak 1 kHz Q1, high shelf 5 kHz;
   each −12..12 dB), delay (timeMs 10..1000, feedback 0..90 %, mix
   0..100 %), reverb (mix ONLY — character is a fixed plate IR,
   `assets/ir/plate-vocal.mp3`, "Rollo Transparent Plate" per RQ-3),
   limiter (ceiling −12..0, release 10..500 ms), gate (threshold −80..0,
   attack 0.001..0.5, release 0.01..2, floor −60..0), distortion (drive
   0..1, tone 0..1 [~1.5→12 kHz], output −24..0 — cut-only), chorus
   (depthMs 0..10, rateHz 0.1..8, mix), autotune (key C..B, scale
   Chromatic/Major/Minor, retune 0..500 ms, mix), phaser, bitcrusher,
   tremolo, pitchshift.
2. **Gain budget (mcp-tools.js, `gain-budget-12db`)**:
   ΣgainDb + 0.57·|threshold| per compressor + 0.57·|ceiling| ≤ +12 dB.
3. **EQ policy**: per-band boost ≤ +9; boost sum ≤ +12; at most ONE band
   ≥ +6; cuts clamp into [−12, 0]; ≤ 2 eq nodes.
4. **Compound-loop guard**: delay feedback ≥ 55 AND EQ boost sum ≥ +6
   together are rejected; feedback param hard-caps at 90 (agent cap 70).
5. **Node counts**: ≤ 16 nodes, ≤ 6 gain-type, ≤ 2 compressor-type
   (i.e. one compressor + the required terminal limiter).
6. **Chain shape**: preset shape `[{id, type, params}]`, terminal limiter
   required; ids per house style (shipped presets use short prefixes:
   `qa-`, `cp-`, `jc-`, `sl-`, …).
7. **Live-karaoke context wins over studio idiom** where they conflict:
   no automation, no sidechain ducking, no multiband, no per-song
   rebalancing operator; singer is untrained and inconsistent; feedback
   and room wash are the standing complaints (#28 complaint vocabulary:
   tunnel, mud, tin can, pumping, boomy).
8. **Rap sketch assumes BEH-1** (autotune inserts at chain FRONT) and
   resolves OQ-4 defaults (key/scale/retune) with reasoning.
9. Descriptions follow the #28 checklist: 1–2 sentences, user words,
   artist shorthand only where universal, complaint vocabulary the preset
   fixes/avoids.

## Hard translation limits (apply to every genre — stated once)

- **Reverb SIZE is not parametric.** The only reverb is one fixed vocal
  plate; genre size idioms (hall vs plate vs room) compress to a
  mix-depth choice. This is workable: live-sound guidance already
  prefers plates on vocals (Yamaha: "a plate reverb on vocal can
  emphasize the highs") and country's studio idiom is literally a short
  plate. Musicals' 1.8–2.5 s hall idiom is approximated by a modest mix
  (≈25) — flagged as the weakest translation in this record.
- **EQ bands are fixed** at 200 Hz / 1 kHz / 5 kHz. "Cut 200–400 Hz mud"
  maps to a low-shelf cut; "presence 3–5 kHz" maps to the high shelf;
  "twang 1.5–3 kHz" maps to the mid peak (coarse — audition will tune).
- **No HPF node** — the low shelf at −3..−4 is the closest legal
  approximation of the live-sound 80–200 Hz high-pass idiom.

## Options considered

Per genre, the meaningful axis choices considered (EQ tilt, compressor
character, ambience strategy, effect use) with the live-context decision:

### Metal
- EQ tilt: (a) presence-forward (low cut + high boost) vs (b) mid-forward
  scoop-the-mids. Chose (a): the fixed high shelf (5 kHz) is the closest
  handle to the 3–5 kHz "aggressive bite" idiom; a mid boost would fight
  the wall-of-guitars midrange the sources warn about.
- Compression: (a) fast attack / high ratio (level control for
  inconsistent screaming) vs (b) 10–30 ms attack (consonant punch).
  Chose (a) for karaoke — untrained shouty dynamics need catching — and
  paid for the dulled transients with the presence boost +4. (Studio
  sources split on this; noted as a tradeoff.)
- Effects: (a) distortion grit in chain vs (b) clean + short ambience
  (some pro bands keep it simple live). Chose (a) at moderate drive —
  the genre's signature for karaoke is attitude, and harsh vocals
  "tolerate more compression, distortion, and resonances than clean
  vocals"; ambience kept SHORT and quiet (live rule: fast songs + long
  reverb = mud).
### Rap/Hip-Hop
- Tuning: (a) Chromatic + retune ≈ 5 ms vs (b) song key + retune 0 vs
  (c) Major scale in C. Chose (a); full OQ-4 reasoning below.
- EQ: low cut + mild presence (proximity-effect boom is the karaoke
  close-mic complaint; dry-and-upfront is the genre idiom).
- Ambience: dry — small reverb mix, one moderate quarter-note-ish delay
  (Yamaha live vocal-delay starting point ~250 ms; Antares' Travis-Scott
  treatment: quarter-note delay, 2–3 repeats, 15–20 % feedback, then
  dark reverb). Studio's "throws on aux only" cannot be expressed;
  approximated by low delay mix.
### R&B/Soul
- Compression: gentle 2.5:1 slowish (supportive leveling) vs hard. Chose
  gentle — genre idiom is smooth dynamics, and Warm Ballad (shipped,
  auditioned 5/5) is the in-house precedent for exactly this shape.
- Ambience: warm plate at 35 mix + slap delay (180 ms, low feedback) +
  light chorus for width/doubling (studio doubling idiom approximated by
  chorus; Cathedral Drift and Jazz Cellar precedents use chorus the same
  way at 10–18 mix).
### Country
- EQ: bright-and-natural (small low cut, mild mid "twang", high air) vs
  big scoops. Chose mild — country's live idiom is honest/natural.
- Compression: 3:1, 5 ms attack (Antares stage-1 numbers) — catches
  peaks without squashing the conversational delivery.
- Signature: slapback 100 ms, LOW feedback, prominent mix (80–120 ms,
  "high mix level, little or no feedback" per two sources); short-plate
  reverb rendered as small mix.
### Dance/EDM
- Compression: fast attack / fast release / 4:1 (punchy, dense,
  "serial compression" studio idiom squeezed into the one legal
  compressor) + loud ceiling (−3).
- Ambience: dotted-eighth feel — 375 ms (dotted 8th at 120 BPM), mix 22
  — plus moderate plate; studio's sidechain-ducked FX cannot be
  expressed, so mix depths stay modest to keep the vocal on top
  (live-context preference overriding studio's bigger-wet-bigger-duck).
- Effect: chorus at 1.2 Hz for hook-width (widened vocal idiom).
### Musicals
- Compression: light 3:1 with threshold engaging at singing level
  (theatre FOH idiom: 3:1; "light compression at normal singing volume"
  for dialogue-to-song swings).
- EQ: low cut (radio-mic HPF idiom ~150–200 Hz → low shelf −3) +
  diction presence (mid +1, high +2) — intelligibility over the pit is
  the theatre prime directive.
- Ambience: modest plate mix + faint 200 ms delay (reverb ON the vocal
  at all times but low level; hall sizes from real theatre rigs are
  unreachable — see translation limit above).
- Extra: gate first (theatre's "keep the channel tidy" / line-by-line
  discipline approximated by the gate; Studio Polish is the in-house
  gate precedent).

## Recommendation — six chain sketches (GEN-1 authoring input)

Every sketch: terminal limiter, ≤ 16 nodes, one compressor + limiter
(= the 2 compressor-type cap), one eq node, params on catalog steps,
delay feedback far below the compound guard, gain budget computed with
the 0.57 makeup rule and ≤ +12 dB with margin. Ids use short house-style
prefixes (GEN-1 may rename; keep prefix-unique).

### 1. Metal — "Metal Mayhem" (working name)

Description (house style, #28): *Aggressive bite for screaming along
with the heavy stuff — edge and grit that cuts through the wall of
guitars, without turning to mud or a boomy wash.*

```js
[
  { id: 'mt-e1', type: 'eq',         params: { lowGain: -4, midGain: -1, highGain: 4 } },
  { id: 'mt-d1', type: 'distortion', params: { drive: 0.35, tone: 0.5, output: -6 } },
  { id: 'mt-c1', type: 'compressor', params: { threshold: -14, ratio: 6, attack: 0.003, release: 0.12 } },
  { id: 'mt-y1', type: 'delay',      params: { timeMs: 90, feedback: 10, mix: 12 } },
  { id: 'mt-r1', type: 'reverb',     params: { mix: 12 } },
  { id: 'mt-l1', type: 'limiter',    params: { ceiling: -3, release: 60 } }
]
```

Budget: 0 + 0.57·14 + 0.57·3 = **9.69 dB ≤ 12** (margin 2.31). EQ boost
sum +4; no band ≥ +6. Idiom: low-shelf cut ≈ HPF + 200–400 Hz mud cut;
5 kHz shelf ≈ 3–5 kHz bite; fast 6:1 catches karaoke screaming;
90 ms near-slap and mix 12 ambience = "short effects, dry-ish" live
rule; distortion output −6 keeps the grit from eating headroom
(cut-only param never counts toward budget).

### 2. Rap/Hip-Hop — "Hard-Tune Hotline" re-author (assumes BEH-1 autotune-first)

Description: *Hard-tune snap, dry and up front — the modern trap sound.
Off-key lines lock onto pitch and every word stays crisp, never
swimming in echo.*

```js
[
  { id: 'rp-a1', type: 'autotune',   params: { key: 'C', scale: 'Chromatic', retune: 5, mix: 100 } },
  { id: 'rp-e1', type: 'eq',         params: { lowGain: -3, midGain: 0, highGain: 2.5 } },
  { id: 'rp-c1', type: 'compressor', params: { threshold: -16, ratio: 5, attack: 0.004, release: 0.15 } },
  { id: 'rp-y1', type: 'delay',      params: { timeMs: 250, feedback: 20, mix: 18 } },
  { id: 'rp-r1', type: 'reverb',     params: { mix: 10 } },
  { id: 'rp-l1', type: 'limiter',    params: { ceiling: -3, release: 50 } }
]
```

Budget: 0 + 0.57·16 + 0.57·3 = **10.83 dB ≤ 12** (margin 1.17 — exactly
Classic Karaoke's budget). EQ boost sum +2.5.

**OQ-4 defaults, reasoned (resolves the task note):**
- **Scale = Chromatic**: karaoke's song key is unknown and changes per
  track, and no operator will re-key between songs. Chromatic (all 12
  semitones valid) snaps to the NEAREST semitone — always musically
  valid regardless of the backing track's key; a Major scale guessed
  wrong snaps flat/sharp notes to wrong pitches. Antares states
  chromatic gives "maximum melodic freedom" while a wrong key/scale is
  the #1 artifact source (SoundOracle). In this app's worklet the
  Chromatic set is all 12 offsets, so under Chromatic the key param is
  inert — **key 'C' is the neutral default, not a musical claim.**
- **Retune = 5 ms (fast but NOT 0)**: Antares' own bands put the hard
  trap effect at retune 0–5, so 5 ms stays fully inside the hard-tune
  idiom (this is the Travis-Scott zone, T-Pain at 0). Reasons not to use
  0 in THIS app: (1) karaoke singers slide into notes; instantaneous
  quantization of every glide reads as chirp/warble on unpitched
  material — 5 ms is one detector epoch of settle that the ear still
  registers as "snapped"; (2) the worklet is a homemade detector whose
  stability gate (onset transients don't snap, two-epoch confirm at the
  ±0.5-semitone boundary) is the artifact defense — retune 0 bypasses
  per-epoch smoothing entirely ("retune 0 → snap within one epoch"),
  5 ms exercises it. Audition note for GEN-1: if the snap reads too
  subtle at audition, 0 is the one-knob fallback (param step is 5).
- **Mix = 100**: hard-tune is an insert effect here, not a parallel
  blend; the wet/dry blend idiom belongs to the gag axis.

### 3. R&B/Soul — "Slow Jam Silk" (working name)

Description: *Smooth and silky for slow jams — warm lows, gentle
leveling, a soft plate and slap echo sitting behind the voice. Lush,
never washed out.*

```js
[
  { id: 'rb-g1', type: 'gain',       params: { gainDb: 1 } },
  { id: 'rb-e1', type: 'eq',         params: { lowGain: 1.5, midGain: 0.5, highGain: 1 } },
  { id: 'rb-c1', type: 'compressor', params: { threshold: -12, ratio: 2.5, attack: 0.012, release: 0.3 } },
  { id: 'rb-h1', type: 'chorus',     params: { depthMs: 2, rateHz: 0.5, mix: 15 } },
  { id: 'rb-y1', type: 'delay',      params: { timeMs: 180, feedback: 12, mix: 18 } },
  { id: 'rb-r1', type: 'reverb',     params: { mix: 35 } },
  { id: 'rb-l1', type: 'limiter',    params: { ceiling: -6, release: 150 } }
]
```

Budget: 1 + 0.57·12 + 0.57·6 = **11.26 dB ≤ 12** (margin 0.74). EQ
boost sum +3 (warm tilt, three small boosts — no band ≥ +6). Idiom:
gentle 2.5:1 leveling; 180 ms low-feedback slap for depth; plate 35 =
"lush plate" at Warm Ballad's auditioned level; chorus at 15 for the
doubling/width idiom.

### 4. Country — "Nashville Nights" (working name)

Description: *Honest and twangy, bright and natural like a country
radio mix — the slap-back echo fans expect, with the voice staying
up front. Present, never piercing.*

```js
[
  { id: 'cn-e1', type: 'eq',         params: { lowGain: -1, midGain: 1.5, highGain: 2 } },
  { id: 'cn-c1', type: 'compressor', params: { threshold: -13, ratio: 3, attack: 0.005, release: 0.2 } },
  { id: 'cn-y1', type: 'delay',      params: { timeMs: 100, feedback: 8, mix: 20 } },
  { id: 'cn-r1', type: 'reverb',     params: { mix: 18 } },
  { id: 'cn-l1', type: 'limiter',    params: { ceiling: -6, release: 120 } }
]
```

Budget: 0 + 0.57·13 + 0.57·6 = **10.83 dB ≤ 12** (margin 1.17). EQ
boost sum +3.5. Idiom: 100 ms slapback with feedback 8 and a prominent
mix 20 (slapback = short + little/no feedback + upfront level);
compressor = Antares' country stage-1 numbers verbatim (3:1, 5 ms,
~80–120 ms release); plate 18 ≈ "short plate, tasteful"; mid +1.5 is
the fixed-band approximation of the 1.5–3 kHz twang lift (coarse —
tune at audition).

### 5. Dance/EDM — "Club Anthem" (working name)

Description: *Big, bright and club-loud — pumping energy, wide sheen on
the hook, and echo throws that land on the beat. Punchy, never buried
by the track.*

```js
[
  { id: 'dm-e1', type: 'eq',         params: { lowGain: -2, midGain: -0.5, highGain: 3 } },
  { id: 'dm-c1', type: 'compressor', params: { threshold: -16, ratio: 4, attack: 0.003, release: 0.1 } },
  { id: 'dm-h1', type: 'chorus',     params: { depthMs: 2.5, rateHz: 1.2, mix: 20 } },
  { id: 'dm-y1', type: 'delay',      params: { timeMs: 375, feedback: 30, mix: 22 } },
  { id: 'dm-r1', type: 'reverb',     params: { mix: 30 } },
  { id: 'dm-l1', type: 'limiter',    params: { ceiling: -3, release: 60 } }
]
```

Budget: 0 + 0.57·16 + 0.57·3 = **10.83 dB ≤ 12** (margin 1.17). EQ
boost sum +3. Idiom: fast attack + fast release + 4:1 = dense/pumping
(the studio serial-compression idiom squeezed into one legal
compressor); 375 ms = dotted-eighth at 120 BPM (the throw rhythm);
ceiling −3 for club loudness within policy; bright tilt with low cut.
Deliberately NOT the studio's big-wet-with-sidechain-duck (inexpressible
here — no sidechain), so mix depths are held moderate to keep the vocal
on top; the live-context rule wins.

### 6. Musicals — "West End Nights" (working name)

Description: *Showtune treatment — clear diction over the pit, light
compression that rides the quiet-to-belt swings, and just enough hall
around the voice. Every word lands, no tunnel.*

```js
[
  { id: 'mu-n1', type: 'gate',       params: { threshold: -48, attack: 0.005, release: 0.2, floor: -35 } },
  { id: 'mu-e1', type: 'eq',         params: { lowGain: -3, midGain: 1, highGain: 2 } },
  { id: 'mu-c1', type: 'compressor', params: { threshold: -13, ratio: 3, attack: 0.006, release: 0.25 } },
  { id: 'mu-y1', type: 'delay',      params: { timeMs: 200, feedback: 15, mix: 12 } },
  { id: 'mu-r1', type: 'reverb',     params: { mix: 25 } },
  { id: 'mu-l1', type: 'limiter',    params: { ceiling: -6, release: 120 } }
]
```

Budget: 0 + 0.57·13 + 0.57·6 = **10.83 dB ≤ 12** (margin 1.17). EQ
boost sum +3. Idiom: 3:1 light compression engaging at singing level
(theatre FOH practice); low cut ≈ the 150–200 Hz radio-mic HPF; diction
presence (mid +1 / high +2); plate at 25 with a faint 200 ms throw —
"reverb on the vocal, low level, intelligibility first"; gate up front
approximates the theatre channel-tidiness discipline (Studio Polish
precedent, floor −35 keeps trail-offs natural).

## Evidence

Each source: link, date (published, or accessed 2026-08-29 where undated),
and the exact claim(s) it supports.

1. **Yamaha Pro Audio Hub — Steve La Cerra, "Tools of the Trade: Using
   Reverb and Delay in Live Sound, Part 2"**
   https://hub.yamaha.com/proaudio/livesound/using-reverb-and-delay-part-2/
   (published June 15, 2018). Claims: use short reverbs/delays on fast
   songs, long on slow — long reverb/delay at fast tempo "will make the
   mix 'muddy' and reduce the clarity"; ballads → hall program on lead
   vocal; small-room program for intimacy; "a plate reverb on vocal can
   emphasize the highs" (watch sibilants); vocal delay start "around
   250 ms, with enough feedback to get two or three repeats"; ~30 ms
   short delay doubles vocals. Supports: Metal/Dance short-ambience
   rule, Rap 250 ms / feedback 20 (≈2–3 repeats), R&B/Musicals
   slower-song deeper-plate logic, plate-character suitability.
2. **Antares (Auto-Tune manufacturer) — "AutoTune for Rap & Hip-Hop: How
   Trap Producers Use Pitch Correction"**
   https://www.antarestech.com/blog/auto-tune-for-rap-hip-hop-how-trap-producers-use-pitch-correction
   (published August 20, 2026). Claims: retune speed 0–5 = hard,
   obvious effect (Travis Scott zone; T-Pain at 0); 10–25 = softer
   melodic correction; 20–40 "sounds like an accident rather than an
   effect"; ≥50 effectively invisible; chromatic scale = "maximum
   melodic freedom", song key = tighter/more obviously pitched; wrong
   key/scale input is the #1 artifact cause (per their FAQ/SoundOracle);
   Travis-Scott-style treatment = quarter-note delay (2–3 repeats,
   15–20 % feedback) + a second shorter delay, then dark long reverb.
   Supports: Rap sketch retune 5, Chromatic, delay 250/20, reverb-low,
   dry-upfront idiom. (Studio source; delay/reverb depths cross-checked
   against source 1's live guidance.)
3. **Antares — "How to Record Country Vocals"**
   https://www.antarestech.com/blog/how-to-record-country-vocals
   (published April 27, 2026). Claims: HPF 80–100 Hz; cut 400–600 Hz
   nasal honk; "2 to 4 dB lift between 1.5 and 3 kHz for twang"; air
   shelf above 10 kHz; compression stage 1 "around 5 ms attack, 80 to
   120 ms release, and 3:1 ratio" reducing 3–5 dB; "short plate reverb
   with a decay between 0.8 and 1.4 seconds"; "a subtle slapback delay
   between 80 and 120 ms" with low feedback; country retune target
   20–40 ms ("faster than 15 ms starts sounding like the modern
   hip-hop sound"). Supports: Country sketch whole-chain (EQ tilt,
   3:1/5 ms comp, 100 ms slap, small plate mix, no autotune).
4. **Nail The Mix — "The Modern Metal Vocal EQ Cheat Sheet"**
   https://www.nailthemix.com/vocal-eq-cheat-sheet (accessed 2026-08-29).
   Claim: "a broad boost anywhere from 3 kHz to 5 kHz will add that
   aggressive bite and presence that defines a modern metal vocal";
   scoop low mids. Supports: Metal highGain +4 at the 5 kHz shelf,
   low −4 / mid −1.
5. **Mastr.io — "How to Mix Vocals That Cut Through a Wall of Guitars"**
   https://www.maastr.io/blog/how-to-mix-vocals-that-cut-through-a-wall-of-guitars
   (accessed 2026-08-29). Claims: ratio 4:1–8:1 for up-front vocals;
   attack 10–30 ms keeps consonants; quick release keeps it alive.
   Supports: Metal ratio 6; the attack TRADEOFF (we chose 3 ms for
   level control of untrained screaming — documented divergence with
   reason, presence boost compensates).
6. **Reddit r/audioengineering — "What production techniques and
   effects are common among harsh vocals?"**
   https://www.reddit.com/r/audioengineering/comments/1mbqaeq/what_production_techniques_and_effects_are_common/
   (accessed 2026-08-29). Claims: harsh vocals tolerate MORE
   compression, distortion, and resonance than clean vocals; clean-vocal
   principles otherwise hold; live rigs for extreme metal often just
   reverb + delay + saturation pedals/preamps. Supports: Metal
   distortion-in-chain at moderate drive + short ambience.
7. **ProSoundWeb forums — "Vocal Compressor Settings for Theater"**
   https://forums.prosoundweb.com/index.php?topic=170970.0
   (accessed 2026-08-29). Claim: theatre engineers recommend a 3:1 ratio
   with threshold engaging during singing/loud dialogue. Supports:
   Musicals 3:1, threshold −13.
8. **Reddit r/livesound — "Mixing musical theatre"**
   https://www.reddit.com/r/livesound/comments/uhgu6c/mixing_musical_theatre/
   (accessed 2026-08-29). Claim: set thresholds for "a little bit of
   light compression at normal singing volume" to control
   dialogue-to-song dynamic swings. Supports: Musicals light-compression
   character and the quiet-to-belt description.
9. **Alex Hawthorn (theatre sound designer) — Evita Act II design archive**
   https://alexhawthorn.com/archive/design-for-evita-act-ii-gt58p
   (accessed 2026-08-29; production Kansas City Rep, year not stated).
   Claims: four reverbs per show incl. "a long (2.5 second-ish) hall
   reverb for the vocals" and "a short (1.8–2s) hall reverb for the
   vocals"; longer halls for slow/legato numbers, shorter for up-tempo
   because long reverb on fast material muddies; ~500 ms tap delay +
   distortion used for speech-through-PA scenes. Supports: Musicals
   always-on-but-modest vocal reverb and faint delay; size-limit caveat
   (our fixed plate cannot reach 1.8–2.5 s halls — approximated by mix
   25).
10. **Soundforums.net — "Tips/Tutorials for theatre vocal mic
    EQ/dynamics"**
    https://soundforums.net/community/threads/tips-tutorials-for-theatre-vocal-mic-eq-dynamics.13491/
    (accessed 2026-08-29). Claim: HPF around 150–200 Hz on
    headset/cheek-taped radio mics. Supports: Musicals lowGain −3 (the
    legal approximation).
11. **Sound on Sound — "How To Make Your Vocals Twice As Good! Part 2"**
    https://www.soundonsound.com/techniques/how-make-your-vocals-twice-good-part-2
    (accessed 2026-08-29). Claims: HPF with moderate slope tames
    proximity-effect bass boost; room surfaces shape reverb tails.
    Supports: low-shelf cuts in Rap/Country/Metal/Dance sketches.
12. **Sound on Sound — "How To Optimise Your Reverb Treatments"** and
    **"Using Reverb & Delay"**
    https://www.soundonsound.com/techniques/how-to-optimise-your-reverb-treatments /
    https://www.soundonsound.com/techniques/using-reverb-delay
    (accessed 2026-08-29). Claims: reverb builds "mud" in low/low-mid
    frequencies; keep vocals clear of clouded washes. Supports: modest
    reverb mix values across all six sketches (12–35).
13. **Audio-Technica — "Understanding Proximity Effect"** and mic guide
    https://www.audio-technica.com/en-gb/support/understanding-proximity-effect /
    https://www.audio-technica.com/en-us/blog/at-s-microphone-guide-for-recording-vocals
    (accessed 2026-08-29). Claims: cardioid close-miking exaggerates
    lows; too close sounds "boomy or uneven". Supports: the karaoke
    close-mic boom complaint → low-shelf cut as the universal first
    move (Rap −3, Metal −4, Musicals −3).
14. **Rysup Audio — "How to Mix Hip-Hop Vocals"** and **The Pro Audio
    Files — "Mixing Rap Vocals Pt 2: EQ"**
    https://rysupudio.com/blogs/news/how-to-mix-hip-hop-vocals /
    https://theproaudiofiles.com/mixing-rap-vocals-part-2-eq/
    (accessed 2026-08-29). Claims: keep rap vocals dry/subtle-effects;
    cut 2–3 dB around 200–400 Hz proximity mud; presence for
    intelligibility; controlled (serial) compression rather than
    flattening. Supports: Rap EQ tilt, dry ambience, 5:1 character.
    (Studio sources; depths reconciled with the live rule from source 1.)
15. **MixingandMastering.ca — "How to Mix R&B Vocals: Smooth, Warm &
    Intimate"**
    https://mixingandmastering.ca/blog/how-to-mix-r-b-vocals-smooth-warm-and-intimate
    (accessed 2026-08-29). Claims: supportive gentle compression,
    warmth-focused EQ, doubling, lush reverb. Supports: R&B 2.5:1 slow
    comp, warm tilt, chorus-doubling, plate 35.
16. **Waves — "What Is Sidechain Compression? 5 Top Production Tips"**
    https://www.waves.com/what-is-sidechain-compression-5-top-sidechaining-tips
    (accessed 2026-08-29). Claim: ducking reverbs/delays behind the dry
    vocal is the standard EDM technique for big-but-clear spaces.
    Supports: the EDM translation LIMIT (no sidechain exists here →
    hold mix depths moderate instead; live-context preference).
17. **Gearsupply — "How to EQ Live Vocals"**
    https://gearsupply.com/blog/how-to-eq-live-vocals
    (accessed 2026-08-29). Claim: live HPF starting point 80–100 Hz,
    adjusted per voice/room. Supports: low-shelf cuts as the live
    first-move.
18. **Music Guy Mixing — "Slapback Delay"** and **Kemper forum —
    "Country slapback delay settings"**
    https://www.musicguymixing.com/slapback-delay/ /
    https://forum.kemper-amps.com/forum/thread/47775-country-slapback-delay-settings/
    (accessed 2026-08-29). Claims: slapback = 60–200 ms (country
    typically 40–120), high mix, little/no feedback, bright. Supports:
    Country 100 ms / feedback 8 / mix 20.
19. **In-house precedents** (`src/factory-library-data.js`, audition
    dates 2026-08-28 / 2026-09-01): Warm Ballad (gentle 2.5:1 + plate 35
    → R&B), Rock Night (fast-ish 4:1 attack 4 ms, high bite +2, slap
    110 ms → Metal's structure), Studio Polish (gate-first cleanup →
    Musicals), Classic Karaoke (budget 10.83 dB → Rap/Musicals/Country/
    Dance budgets). Not external evidence, but auditioned param
    precedents inside the same engine.

### Live vs studio conflicts (and how resolved)

- **Rap/EDM studio FX are send-based with automation/sidechain** —
  inexpressible; resolved by low mix depths + live "short beats long"
  rule (sources 1, 16).
- **Metal studio attack split (10–30 ms for punch)** — resolved toward
  fast attack for karaoke level control, compensation documented
  (source 5 vs source 6).
- **Musicals real rigs use multiple hall programs per song** — resolved
  to one fixed plate at modest mix; flagged as weakest translation
  (source 9).
- **Country/Antares is a RECORDING source** — its comp/EQ/delay numbers
  were cross-checked against live guidance (source 1's tempo rule,
  source 17's HPF) and matched; adopted (source 3).

## Tradeoffs / risks / confidence

- **Risks**: (1) Metal distortion on an untrained karaoke voice can read
  fizzy — drive 0.35 is mid-range and audition tuning is expected
  (fallback 0.2–0.3); (2) Musicals plate-only ambience cannot reproduce
  hall size — the honest fallback is "low-level always-on plate", which
  the theatre sources endorse in spirit (intelligibility first); (3)
  Rap retune 5 is one epoch, not 0 — if audition reads "not snapped
  enough", retune 0 is the sanctioned one-knob fallback; (4) fixed EQ
  band centers make genre tilts coarse — mid-band "twang"/"honk" moves
  are approximations to be tuned by ear at audition; (5) live feedback
  risk from boost shelves: all boosts are modest (max +4) and the
  host-owned output attenuator stands behind everything.
- **Confidence**: HIGH on idiom direction and character per genre
  (multiple corroborating sources including two dated manufacturer
  primary sources for the two hardest cells, Rap and Country; in-house
  auditioned precedents for the shapes). MEDIUM on exact param values —
  translations into fixed-band EQ and a size-less plate are
  approximations by construction; the pen → audition loop (AUD-1) is
  the designed correction mechanism.
- **No scope/policy conflict found**: all six idioms are expressible
  within the published gain-budget/EQ/node-count policy with margin ≥
  0.74 dB — the town-hall return trigger ("genre cell cannot be
  expressed within policy") is NOT met.

## Implementation consequences

- GEN-1 can author all six candidates directly from the sketches above:
  preset shape, house-style ids, terminal limiters, budgets 9.69–11.26 dB
  (all ≤ +12), EQ boost sums ≤ +4, single-band boosts ≤ +4 (no band
  ≥ +6 anywhere), feedback ≤ 30 (compound guard unreachable).
- Rap candidate = the Hard-Tune re-author: autotune first (BEH-1
  landed before the batch PR per plan), OQ-4 defaults fixed as
  key C / Chromatic / retune 5 / mix 100 with the reasoning above
  recorded for the PR description.
- PEN-1 conformance: every sketch already sits inside AGENT_PARAM_POLICY
  ranges (thresholds −12..−16 within [−40,−8]; ratios 2.5–6 within
  [1.5,12]; attacks 3–12 ms within [1,100] ms; releases 0.1–0.3 s
  within [0.02,0.5]; ceilings −3/−6 within [−12,−3]; gainDb 0/+1) —
  the engine-side check should pass first try.
- Tags (per factory-library vocabularies, for GEN-1's reference):
  Metal `genre:Metal`, Rap `genre:Rap/Hip-Hop` +
  `technique:hard-tune`, R&B `genre:R&B/Soul` + `vibe:warm`, Country
  `genre:Country`, Dance/EDM `genre:Dance/EDM` + `vibe:bright`,
  Musicals `genre:Musicals`; all `use-case:performance` primary or
  genre-primary per the dropdown order (final tagging is GEN-1/PRO-1's
  call, vocabulary is frozen).
- Working names above are placeholders — naming is GEN-1's, subject to
  the #28 description checklist already baked into each sketch.
