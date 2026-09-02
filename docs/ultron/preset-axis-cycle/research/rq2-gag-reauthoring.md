# RQ-2 + RQ-3: Gag re-authoring (robot / megaphone / 8-bit) + never-authored gag cells (helium / darth-vader / monster-demon)

- **Task ID:** informs GAG-1 (gag + vibe candidates, docs/ultron/preset-axis-cycle/plan.md; this record is RES-2's output). Rejection notes per the 2026-09-01 audition, mirrored at src/audition-candidates.js lines 37–39.
- **Decision priority:** P1 (GAG-1 should author against these chains, not guesswork).
- **Status:** Proposed (research complete 2026-08-29; final values confirmed or trimmed at the `?audition`).
- **Delegation record:** Researched by deep-research track agent (RES-2 / RQ-2+RQ-3), 2026-08-29. Primary sources: Wilson & Moore VIHAR 2017 (robot/alien/cartoon voice corpus), UNSW speech acoustics + Belcher 1983 JASA (helium speech), equal-loudness contour literature (Wikipedia/ISO 226 summary), Analog Devices MT-001 (quantization SNR), bullhorn driver spec sheets, SOS/crest-factor compression-loudness literature, BBC Radiophonic Workshop history (Dalek ring mod), Vader production accounts. All chains below checked arithmetically against the published policy in src/mcp-tools.js.

## Question

1. **RQ-2** — For each rejected gag (Robot Usher "too buzzy not robotic enough"; Megaphone Rally "not quite as loud as you would expect from the name"; 8-Bit Encore "too crushed and hard to hear"), what param deltas address the note using only the app's 14 node types?
2. **RQ-3** — What chains make helium, darth-vader, and monster/demon DISTINCT from the covered neighbors (Chipmunk Party at pitch +7, Deep Narrator at pitch −7, AM Radio Ghost)?

## Constraints (verified in code this session)

Catalog param facts (src/node-*.js, src/effect-catalog.js):

- `pitchshift`: pitch −12..+12 st (step 1), mix 0..100 %. Granular (Tone.PitchShift) — **not formant-preserving** (node header: "large shifts change the voice's character"); adds latency even at pitch 0.
- `distortion`: drive 0..1 (→ 10^drive pre-gain: 0.5 = +10 dB, 0.6 = +12 dB), tone 0..1 (post-shaper lowpass, exponential 1.5 kHz..12 kHz; 0.25≈2.5 k, 0.3≈2.8 k, 0.45≈3.8 k Hz), output −24..0 dB **cut-only** (unity-capped in the node — never counts toward the gain budget).
- `bitcrusher`: bits 1..8 (node header: "8 is nearly clean, 4 is gritty, 1-2 is destroyed/apocalyptic"), mix 0..100 %.
- `tremolo`: rateHz 0.1..**14** Hz (hard cap — see RQ-2a finding), depth 0..100 %. L/R LFOs 180° apart: "mono-summed playback keeps near-constant energy" (node header) — i.e., tremolo largely cancels on a true mono system; user's rig demonstrably renders tremolo (Rotary Nostalgia, 5 Hz/45 %, accepted 2026-09-01).
- `chorus`: depthMs 0..10 (delay sweep around 25 ms baseline → a **moving comb filter** at short depths), rateHz 0.1..8, mix 0..100 (equal-power).
- `phaser`: rateHz 0.05..8, depth 0..100 (→ 1+depth/100×4 octaves), baseHz 50..1500.
- `eq`: three fixed bands — low shelf 200 Hz, mid peak 1 kHz (Q 1.0), high shelf 5 kHz; each −12..+12 dB, step 0.5. Max 2 EQ nodes / 6 bands.
- `compressor`: threshold −40..−8, ratio clamp 1.5..12, attack clamp 0.001..0.1 s, release clamp 0.02..0.5 s. Knee fixed 30 dB (soft).
- `limiter`: ceiling −12..−3 dB (agent-rejected outside), release 50..300 ms; ratio 20 / attack 0 / knee 0 fixed; **must be terminal**.
- `gain`: gainDb −24..+12; up to 6 gain nodes.
- Others available: delay (feedback ≤ 70), reverb (mix), gate, autotune (experimental; reserved for the Hard-Tune candidate in this batch).

Published policy (src/mcp-tools.js):

- **gain-budget-12db:** `sum(gainDb) + 0.57·|threshold| per compressor + 0.57·|ceiling| ≤ +12 dB`.
- **EQ:** per-band boost ≤ +9 (reject above), boost sum ≤ +12, at most one band ≥ +6; cuts clamp.
- **Counts:** ≤16 nodes; compressor+limiter together ≤ 2 (so one musical compressor + the terminal limiter).
- **compound-loop-guard:** delay feedback ≥ 55 with EQ boost sum ≥ +6 rejected (no sketch below uses delay feedback).
- Existing 14 library presets byte-stable; vocabulary append-only; every candidate must pass the PEN-1 conformance suite (schema, ranges, budget via the real engine).

Neighbor precedents to stay distinct from (src/factory-library-data.js):

- **Chipmunk Party:** eq(−2, +1, +3) → pitchshift(**+7**, 100) → limiter(−6, 100).
- **Deep Narrator:** pitchshift(**−7**, 100) → eq(low +3, 0, −2) → reverb(30) → limiter(−6, 140).
- **AM Radio Ghost:** eq(−10, +4, −9) → distortion(0.2, 0.3, −14) → compressor(−12, 8, 0.003, 0.1) → limiter(−6, 70).

## RQ-2a — Robot Usher ("too buzzy not robotic enough")

Rejected: eq(−4, +4, −2) → distortion(0.45, 0.25, −12) → bitcrusher(4, 70) → limiter.

**Diagnosis.** Every stage in the rejected chain is *static*: bitcrusher quantization (4 bits ≈ 25.8 dB SNR, harmonically-related buzz), distortion with a dark 2.5 kHz tone lowpass, fixed EQ. Static spectral mangling reads as "buzzy". The literature says robot-character comes from *time-domain structure*: Wilson & Moore's 93-voice corpus found the most common character effects were **echo/delay (66), harmony (45), modulation (40)** — and the single most separating acoustic feature between character voices and human controls was **voice breaks** ("an unusually large number of breaks (often caused by the use of a low frequency modulation effect)… Fig. 4 illustrates an almost complete lack of overlap between the two groups" — E1). The Dalek — the reference robot buzz — is **ring modulation with a 30 Hz sine** (E1, E10), not static distortion.

**Direct answer to "what reads robotic rather than buzzy":** (1) a detuned non-octave double of the voice ("harmony": W&M's robot recipe is "a small increase in pitch, followed by adding back the original", E1 §2.2 — exactly expressible as pitchshift(+3, mix≈45), whose equal-power crossfade blends shifted+original at matched level); (2) amplitude-modulation "voice breaks" from deep low-rate tremolo; (3) a moving comb (short-depth chorus — W&M Table 1 maps "comb filter" and "chorus effect" to robot characters); (4) LESS static crush: fewer buzz harmonics (higher bits, lower mix, or none).

**Catalog limitation (recorded):** true Dalek ring mod at 20–40 Hz is NOT reachable — tremolo caps at 14 Hz, and ring modulation (sideband multiply) is not in the catalog at all. Tremolo 10–14 Hz at depth 60–70 is the closest legal approximation; at 12 Hz it produces ~12 amplitude breaks/s, at or above the corpus's most extreme character (Mechanoids ≈ 8/s, E1 §4.2). The harmony double + comb motion carry the remaining robotic weight.

### Options

| Option | Verdict |
|---|---|
| **A. Harmony double + moving comb + voice-break AM; drop distortion entirely** | **Recommended.** Each addition is one of W&M's top corpus effects; removing distortion removes the buzz source named in the note. |
| B. Minimal delta: keep distortion (drive 0.25, tone 0.5, output −10), bitcrusher 5/40, add tremolo(12, 65) | Fallback if the pen wants continuity with the rejected shape. Weaker: the static-buzz core survives. |
| C. Monotone robot via autotune (retune 0, chromatic, mix 100) + bitcrusher(6, 35) + tremolo | Cylon-style monotone (W&M list Cylon = monotone). Rejected for this batch: autotune is experimental and already reserved for the Hard-Tune candidate (GEN-1/BEH-1); revisit in a later batch. |

### Recommended re-author (preset shape)

```js
{
  name: 'Robot Usher',
  description: 'Deadpan machine voice — a metallic self-duet with stuttering circuit chatter. Every word still lands; tinny, never buzzy mush.',
  tags: ['gag:robot', 'use-case:performance', 'technique:modulated/wide'],
  primary: 'gag:robot',
  nodes: [
    { id: 'ru-e1', type: 'eq',         params: { lowGain: -6, midGain: 4, highGain: 0 } },
    { id: 'ru-p1', type: 'pitchshift', params: { pitch: 3, mix: 45 } },
    { id: 'ru-h1', type: 'chorus',     params: { depthMs: 1.5, rateHz: 6, mix: 30 } },
    { id: 'ru-b1', type: 'bitcrusher', params: { bits: 6, mix: 30 } },
    { id: 'ru-t1', type: 'tremolo',    params: { rateHz: 12, depth: 65 } },
    { id: 'ru-l1', type: 'limiter',    params: { ceiling: -6, release: 60 } }
  ]
}
```

Plain-language read: thin the chest, keep the vowel band, double the voice a minor-third up into a metallic self-duet, sweep a comb through it for machine motion, leave a light digital edge, then stutter the amplitude like a Dalek on a 14 Hz budget.

**Exact deltas vs the rejected chain:**

| Param | Rejected | Proposed | Why |
|---|---|---|---|
| eq lowGain | −4 | **−6** | thinner chest = small-speaker machine (E1 robot table; UNSW "thin" character) |
| eq midGain | +4 | +4 (keep) | 1 kHz vowel/formant energy keeps words intelligible through the mangling (E5) |
| eq highGain | −2 | **0** | reopen the 5 k shelf — the cut muffled consonants and made buzz feel worse |
| distortion | drive 0.45, tone 0.25, output −12 | **REMOVED** | static saturation was the "buzzy" core; nothing else in the note requires it |
| bitcrusher bits | 4 | **6** | quantization SNR 25.8 → 37.9 dB (E7); grit without buzz |
| bitcrusher mix | 70 | **30** | dry voice carries the words; crush is a texture, not the voice |
| pitchshift | — | **ADD pitch +3, mix 45** | W&M robot recipe: small pitch up + original added back = "harmony" double (E1 §2.2) |
| chorus | — | **ADD 1.5 ms / 6 Hz / 30** | short-depth chorus = moving comb filter, a listed robot-character effect (E1 Table 1) |
| tremolo | — | **ADD 12 Hz / 65** | voice-break AM — the corpus's most character-separating feature (E1 §4.2); closest legal stand-in for 30 Hz ring mod |

**Budget:** 0 + 0 + 0.57·6 = 3.42 dB ≤ 12 (margin 8.58). EQ boost sum +4 ≤ 12, no band ≥ +6. 6 nodes. All params on-catalog steps. ✓

## RQ-2b — Megaphone Rally ("not quite as loud as you would expect from the name")

Rejected: eq(−6, +5, +3) → distortion(0.35, 0.4, −10) → compressor(−14, 6) → limiter.

**Diagnosis.** The chain *threw loudness away*: distortion output −10 dB discards 10 dB of level for no character gain (the node is normalized — the shaper peak is 1.0 regardless of drive, so output is a pure safety trim). Meanwhile the real megaphone read was under-built in exactly the two dimensions that produce *perceived* loudness:

1. **Spectral concentration in the ear's sensitive band.** Equal-loudness contours: "the human ear is most sensitive between 2 and 5 kHz, largely due to the resonance of the ear canal" (E4). Real bullhorn drivers are band-limited to ~500 Hz–5 kHz (E8) — i.e., a megaphone is "loud" because it dumps every watt into the presence band. The rejected eq(−6, +5, +3) is a polite tilt, not a horn.
2. **Density from deep, fast compression.** Perceived loudness tracks density more than peak level: compressed audio sounds louder than uncompressed even with peak and RMS matched (E9); each dB of crest-factor reduction raises average level at constant peaks. The rejected compressor (−14, ratio 6) is moderate; the policy allows far more aggression.
3. **Ceiling.** The limiter ceiling is a policy-priced resource: −3 dB (the max) both allows more program level and, at 0.57 dB/dB, spends only 1.71 dB of budget.

**Direct answer:** within the gain-budget policy, perceived megaphone loudness comes from (a) midrange/presence boost + hard band-pass (eq-boost rules), (b) maximum legal density (deep threshold, ratio 12, fast attack/release), (c) zero gratuitous cuts (distortion output 0, not −10), and (d) ceiling at −3. A raw gain node is the *least* efficient use of the budget — the recommended chain spends 100 % of the +12 dB on compressor makeup + ceiling.

### Recommended re-author (max aggression that conforms)

```js
{
  name: 'Megaphone Rally',
  description: 'Squashed, honking bullhorn shout that punches through the room like a protest PA — loud from the name, clear over the noise.',
  tags: ['gag:megaphone', 'use-case:performance'],
  primary: 'gag:megaphone',
  nodes: [
    { id: 'mr-e1', type: 'eq',         params: { lowGain: -12, midGain: 9, highGain: 3 } },
    { id: 'mr-d1', type: 'distortion', params: { drive: 0.5, tone: 0.45, output: 0 } },
    { id: 'mr-c1', type: 'compressor', params: { threshold: -18, ratio: 12, attack: 0.002, release: 0.08 } },
    { id: 'mr-l1', type: 'limiter',    params: { ceiling: -3, release: 50 } }
  ]
}
```

Plain-language read: hard band-pass like a horn driver, overdrive the driver to breakup, then squash everything flat and loud — the shout never gets quieter than the ceiling allows.

**Budget:** 0.57·18 + 0.57·3 = 10.26 + 1.71 = **11.97 ≤ 12** (margin 0.03 dB — this is deliberately the max). EQ: boost sum 9+3 = 12 (at the cap), one band ≥ +6 (mid only), per-band ≤ +9. Compressor+limiter = 2 nodes (cap). ✓

**Exact deltas vs the rejected chain:**

| Param | Rejected | Proposed | Why |
|---|---|---|---|
| eq lowGain | −6 | **−12** | full horn band-pass cut (bullhorn ≈ 500 Hz–5 kHz, E8); lows waste energy the ear barely registers as loud (E4) |
| eq midGain | +5 | **+9** | max legal presence push at 1 kHz — the "honk"; 2–5 kHz is where loudness lives (E4, E5) |
| eq highGain | +3 | +3 (keep) | keeps the shelf into the sensitivity peak |
| distortion drive | 0.35 | **0.5** | more driver-overload breakup → more mid harmonic energy = louder character (adapted from E8's overload behavior) |
| distortion tone | 0.4 | **0.45** | ≈3.8 kHz rolloff — horn-like top, keeps consonant band intact |
| distortion output | −10 | **0** | **the single biggest fix**: buys back 10 dB the rejected chain discarded |
| compressor | −14, ratio 6 | **−18, ratio 12, attack 0.002, release 0.08** | max legal density: deeper threshold eats the full budget, ratio 12 flattens dynamics, fast attack catches every syllable peak, 80 ms release keeps energy up between words (E9) |
| limiter | (unspecified) | **ceiling −3, release 50** | policy-max ceiling = loudest legal program level; fastest release |

**Options considered:** (a) spend leftover budget on a gain node — there is no leftover; and raw gain is dominated by threshold+ceiling spending (above). (b) harder breakup (drive 0.65) — rejected: risks re-triggering a "buzzy" complaint across gags; 0.5 is the safe aggression point. (c) thin the band further (high −2, like a cheap 3 kHz horn) — rejected: loses the 2–5 kHz loudness region the name promises.

**Studio→karaoke adaptation note:** the SOS/crest-factor literature is mastering-oriented (recorded program material, normalized playback). Live karaoke differs in one way that matters: presence boosts raise gain-before-feedback risk. Mitigations already in the system: no delay feedback anywhere in this chain (compound-loop guard cannot trip), the terminal limiter, and the host-owned output attenuator as the final safety. These are short gag bits, not full-set chains — the risk window is seconds, and PEN-1 re-validates through the real engine.

## RQ-2c — 8-Bit Encore ("too crushed and hard to hear")

Rejected: bitcrusher(3, 80) → tremolo(6, 40) → limiter.

**Diagnosis.** Two stacked audibility killers: (1) 3-bit quantization = ~19.8 dB SNR (E7) at 80 % mix — the crushed path is nearly the whole voice, and the node's own header calls 1–2 bits "destroyed/apocalyptic" with 4 "gritty"; (2) tremolo depth 40 % digs amplitude holes 6×/s exactly where melody notes live. No EQ anywhere: nothing holds the 2–4 kHz intelligibility band (E5) up against the quantization noise.

### Options

| Option | Verdict |
|---|---|
| **A. 6 bits / mix 55 + pre-crush presence EQ + gentle wobble** | **Recommended.** +18 dB SNR (37.9 dB, E7), dry core carries melody, pre-emphasis lifts signal above the noise floor in the intelligibility band. |
| B. 8 bits / mix 45 + tremolo(3, 20) + presence EQ | Safest intelligibility, weakest gag read — 8 bits is "nearly clean" per the node header; barely a gag anymore. |
| C. Keep 4 bits, mix 35, + presence EQ | Retains crunch; but the note said "too crushed" and 4 bits keeps the buzz character at any mix. |

### Recommended re-author (preset shape)

```js
{
  name: '8-Bit Encore',
  description: 'Chiptune video-game vocals with the melody still front and center — crunchy, never crushed to mush.',
  tags: ['gag:8-bit', 'technique:lo-fi', 'use-case:performance'],
  primary: 'gag:8-bit',
  nodes: [
    { id: 'ee-e1', type: 'eq',         params: { lowGain: -2, midGain: 1, highGain: 3 } },
    { id: 'ee-b1', type: 'bitcrusher', params: { bits: 6, mix: 55 } },
    { id: 'ee-t1', type: 'tremolo',    params: { rateHz: 4, depth: 25 } },
    { id: 'ee-l1', type: 'limiter',    params: { ceiling: -6, release: 80 } }
  ]
}
```

Plain-language read: brighten the voice before the console quantizes it, keep half the original voice in the blend so the tune survives, and let a slow shallow wobble sell the retro without swallowing notes.

**Exact deltas vs the rejected chain:** bits 3→**6**; mix 80→**55**; tremolo 6 Hz/40 →**4 Hz/25**; **ADD** eq(−2, +1, +3) *before* the crusher. Why pre-crush, not post: quantization SNR is fixed by bit depth (E7), and a post-crush boost lifts the noise floor with the signal; pre-emphasis instead raises the melody/consonant energy *going into* the quantizer, so it dominates the fixed noise. Budget: 0.57·6 = 3.42 ≤ 12. EQ boost sum +4, no band ≥ +6. ✓

## RQ-3 — Three new gag cells, distinct from covered neighbors

### Helium (vs Chipmunk Party at +7)

**What separates helium acoustically:** real helium speech raises **formants, not pitch** — the source-filter model: "the speed of sound is greater, so the resonances occur at higher frequencies… it does not change the pitch" and "there is less power at low frequencies so the sound is thin and squeaky" (E2; Belcher 1983 JASA: formants shift up nonlinearly, bandwidths widen up to 14× — E3). The catalog's granular pitchshift shifts pitch+formants *together* (node header concedes this), so the cell must earn separation two other ways: **register** (clearly above chipmunk's +7) and **thin, body-stripped EQ** vs chipmunk's warm-mid tilt.

```js
{
  name: 'Helium Hangout',
  description: 'Balloon-breath squeak — thin, floaty, silly-high. Words stay squeaky-crisp, not squeaky-mush.',
  tags: ['gag:helium', 'technique:pitch-gag', 'use-case:performance'],
  primary: 'gag:helium',
  nodes: [
    { id: 'hh-e1', type: 'eq',         params: { lowGain: -9, midGain: -1, highGain: 2 } },
    { id: 'hh-p1', type: 'pitchshift', params: { pitch: 10, mix: 100 } },
    { id: 'hh-l1', type: 'limiter',    params: { ceiling: -6, release: 100 } }
  ]
}
```

Distinctness vs Chipmunk Party: pitch **+10 vs +7** (3 st higher register); low **−9 vs −2** (thin vs warm); mid **−1 vs +1** (body scooped vs forward); high **+2 vs +3**. Non-octave shift on purpose — +12 would read as a clean octaver double. Escalation knobs for the audition: pitch +11 if the register gap doesn't read; low → −10 if still too warm. Budget 3.42; EQ boosts +2 only. ✓

### Darth Vader (vs Deep Narrator at −7, vs AM Radio Ghost)

**What separates Vader:** production reality — James Earl Jones's natural deep baritone, *essentially unprocessed* (no pitch shifter; Burtt added the scuba-regulator breathing and "worldizing" for space — E11). So Vader is NOT trailer-deep: a moderate shift (−4, deliberately half of Narrator's −7), and the character comes from a **helmet-intercom** color: dark band-pass + faint grit + bone-dry (no reverb — Deep Narrator owns the cave; AM Radio Ghost owns static-crush at full band-pass with no pitch).

```js
{
  name: 'Dark Helmet Baritone',
  description: 'Masked-villain baritone through a helmet intercom — dark, close, faintly crackling. Menace without the muddy cave.',
  tags: ['gag:darth-vader', 'technique:pitch-gag', 'use-case:performance'],
  primary: 'gag:darth-vader',
  nodes: [
    { id: 'dv-p1', type: 'pitchshift', params: { pitch: -4, mix: 100 } },
    { id: 'dv-e1', type: 'eq',         params: { lowGain: -6, midGain: 4, highGain: -7 } },
    { id: 'dv-d1', type: 'distortion', params: { drive: 0.18, tone: 0.22, output: -12 } },
    { id: 'dv-l1', type: 'limiter',    params: { ceiling: -6, release: 90 } }
  ]
}
```

Distinctness matrix: pitch **−4** (Narrator −7, Radio 0); EQ **(−6, +4, −7)** — a *mid*-centered helmet passband, milder than Radio's (−10, +4, −9) and opposite to Narrator's warm (+3, 0, −2); distortion **0.18 drive, −12 output** = faint intercom crackle vs Radio's heavier 0.2 with more level; **no reverb** (Narrator's signature). Budget 3.42; EQ boost +4, one band. ✓ The iconic mechanical-breath layer is not expressible in the catalog — description carries the read; the voice cell stands on register + intercom color + dryness.

### Monster / Demon (vs both deep cells)

**What separates a monster:** register *below* Narrator (−10) plus **growl** — high drive into a dark tone lowpass concentrates noisy low-mid energy. The corpus backs the noise link: perceived goodness correlates with harmonics-to-noise ratio (evil = noisy, W&M correlation −0.3568 — E1 §4.4). Order matters: pitch first, *then* distort (growling a deep voice; distorting first would shift the growl harmonics upward into chipmunk territory).

```js
{
  name: 'Demon Growl',
  description: 'Pitch-floor demon snarl — gravel throat over a subterranean chest. Deep and scary while the words survive.',
  tags: ['gag:monster/demon', 'technique:pitch-gag', 'vibe:dark/moody'],
  primary: 'gag:monster/demon',
  nodes: [
    { id: 'mg-p1', type: 'pitchshift', params: { pitch: -10, mix: 100 } },
    { id: 'mg-e1', type: 'eq',         params: { lowGain: 5, midGain: 2, highGain: -2 } },
    { id: 'mg-d1', type: 'distortion', params: { drive: 0.6, tone: 0.18, output: -8 } },
    { id: 'mg-l1', type: 'limiter',    params: { ceiling: -6, release: 80 } }
  ]
}
```

Distinctness: pitch **−10** (Vader −4, Narrator −7 — clearly its own floor); growl distortion **0.6 drive / tone 0.18 (≈2.2 kHz)** appears in no neighbor (Radio 0.2/0.3 = crackle, not growl; Narrator clean); low **+5** adds chest menace (kept under +6 to leave the single-big-boost allowance untouched). Budget 3.42; EQ boost sum +7. ✓ Optional audition variant: + chorus(depthMs 2, 0.3 Hz, 15) for a "demon chorus whisper" — not in the sketch (risks blurring toward the psychedelic vibe presets).

## Evidence

| # | Source (link, date) | Exact claim it supports |
|---|---|---|
| E1 | Wilson & Moore, "Robot, Alien and Cartoon Voices: Implications for Speech-Enabled Systems", VIHAR 2017 — https://vihar-2017.vihar.org/assets/papers/VIHAR-2017_paper_1.pdf | Corpus of 93 character voices vs 71 controls: most common effects "echo or delay (66), followed by harmony (45), some form of modulation (40), slowing down (15) and speeding up (4)". §2.2: "an effective robot voice can be achieved by a small increase in pitch, followed by adding back the original (c.f. 'harmony') and introducing some echo"; cartoon = "large pitch increase followed by a chorus effect and added tremolo". §3: Dalek = "ring modulation using a 30Hz LFO" applied to stilted monotone speech. §4.2: characters have "an unusually large number of breaks (often caused by the use of a low frequency modulation effect)… Fig. 4 illustrates an almost complete lack of overlap between the two groups"; Mechanoids (tremolo) most extreme (~8 breaks/s). §4.4: goodness correlates with HNR (−0.3568) — evil/noisy. |
| E2 | UNSW (Joe Wolfe), "Helium speech and a brief introduction to speech acoustics" — https://www.phys.unsw.edu.au/jw/speechmodel.html | Source-filter: helium raises resonances/formants, "it does not change the pitch, which is determined by the tension, mass and geometry of vocal folds"; "There is less power at low frequencies so the sound is thin and squeaky." |
| E3 | Belcher, "Formant frequencies, bandwidths, and Qs in helium speech", JASA 74(2):428, 1983 — https://pubmed.ncbi.nlm.nih.gov/6619420/ | Helium formant frequencies shift upward nonlinearly; formant bandwidths increase by as much as 14× air values (thin/harsh character). |
| E4 | Wikipedia, "Equal-loudness contour" (ISO 226 summary) — https://en.wikipedia.org/wiki/Equal-loudness_contour | "the human ear is most sensitive between 2 and 5 kHz, largely due to the resonance of the ear canal" — energy moved into this band raises perceived loudness at equal SPL. |
| E5 | DPA Microphones, "Facts About Speech Intelligibility" — https://dpamicrophones.com/mic-university/background-knowledge/facts-about-speech-intelligibility/ | The 2–4 kHz range is critical for speech intelligibility (consonant/presence band). Studio guides concur: iZotope recommends 1.5–5 kHz boosts for vocal presence/intelligibility (https://izotope.com/community/blog/how-to-eq-vocals); Avid cites 1.5–4.5 kHz (https://www.avid.com/resource-center/how-to-eq-vocals). |
| E6 | Analog Devices MT-001 (Walt Kester) — https://www.analog.com/mt-001 | Ideal quantizer SNR = 6.02N + 1.76 dB → 3 bits ≈ 19.8 dB, 4 ≈ 25.8, 6 ≈ 37.9, 8 ≈ 49.9. Each bit ≈ 6 dB of crush-vs-clean trade. |
| E7 | 5Core HW-508 bullhorn driver spec — https://www.5core.com/products/5core-driver-siren-outdoor-indoor-waterproof-8-power-horn-hw-508 | Commercial horn drivers band-limited to 500 Hz–5 kHz — the megaphone band IS the speech-presence band; the "loud" identity is spectral concentration (+ driver overload), not level. |
| E8 | Perceived loudness vs density: Sound On Sound, Hugh Robjohns, "The Psychology Of Loudness", SOS Nov 2016 (original article URL now 410; claim surfaced via indexed summaries) — https://www.soundonsound.com/sos/nov16/articles/loudness.htm; Campbell, Toulson & Paterson, "The effect of dynamic range compression on the psychoacoustic quality and loudness of commercial music" — https://core.ac.uk/download/pdf/46597832.pdf; "The effect of dynamic range compression on loudness and quality perception in relation to crest factor" — https://www.researchgate.net/publication/287018283 | Compressed audio is perceived louder than uncompressed even when peak and RMS levels are matched; crest-factor reduction (density) drives perceived loudness more than peak level. Supports: megaphone loudness = deep fast compression + presence band, not raw gain. |
| E9 | Intelligent Sound Engineering (Brechbühl et al. blog), "Ring modulation in science fiction", 2016 — https://intelligentsoundengineering.wordpress.com/2016/04/04/ring-modulation-in-science-fiction/ | Dalek voice = ring modulator (passive: 2 transformers + 4 diodes) driven by a 30 Hz sine from a tape loop, BBC Radiophonic Workshop (Brian Hodgson, 1963). |
| E10 | Vader production accounts: Inverse (worldizing) — https://www.inverse.com/entertainment/james-earl-jones-recording-darth-vader-voice; Smithsonian (scuba-regulator breathing) — https://www.smithsonianmag.com/smart-news/darth-vader-didnt-come-alive-until-james-earl-jones-gave-him-a-voice-180985054/; Bold Entrance — https://boldentrance.com/darth-vader-james-earl-jones-ben-burtt/ | Jones's baritone largely used as recorded (no pitch processing); breathing is a separate sound layer; space added via worldizing. Justifies −4 (not −7) and dry intercom color. |
| E11 | Codebase: src/node-*.js (param specs and header notes: pitchshift not formant-preserving; bitcrusher "8 nearly clean / 4 gritty / 1-2 destroyed"; tremolo 0.1–14 Hz + mono-cancellation note; distortion tone map + unity-capped output), src/mcp-tools.js (gain-budget-12db, eq-boost rules, ranges), src/factory-library-data.js (Chipmunk Party / Deep Narrator / AM Radio Ghost exact params), src/audition-candidates.js lines 37–39 (rejection notes). | Every numeric constraint and neighbor param cited above. |

## Tradeoffs / risks / confidence

- **Robot: no true ring mod / AM capped at 14 Hz.** The Dalek signature rate (30 Hz) is unreachable; tremolo at 12 Hz/65 % is the closest legal character and sits at/above the corpus's most extreme character. On mono-summed playback the tremolo largely cancels (node design) — the harmony double and comb chorus must carry the read on such systems (they are full-band and mono-safe). Confidence: medium-high on direction, medium on exact rate/depth (audition-tunable between 10–14 Hz / 60–70).
- **Robot chain is 6 nodes** — the longest of the batch; each stage is single-duty and individually trimmable at the pen if the read is too layered. Dropping the bitcrusher first is the pre-planned simplification (it is the least load-bearing).
- **Megaphone runs the budget to 0.03 dB and the EQ boost sum to exactly the +12 cap, and uses boundary values (mid +9, ceiling −3, ratio 12).** All are legal per the published rules (≤ comparisons), but PEN-1 must confirm the suite treats the boundaries as inclusive; if it doesn't, the pre-planned give-back is high +3 → +2.5 (boost sum 11.5) and/or threshold −18 → −17. Confidence: high that this is the max-legal chain; medium on whether max-legal is *pleasant* — the audition may prefer threshold −16 (budget 10.83) with a touch less squash.
- **8-bit: mix 55 at 6 bits is a deliberate compromise** between gag-read (Option C's crunch) and the note's "hard to hear" (Option B's cleanliness). If the audition still says crushed, the delta path is bits 6→7 or mix 55→45, not more EQ.
- **Helium separation rests on register + EQ**, because the catalog cannot shift formants independently of pitch (E2's actual helium mechanism is inexpressible). If +10 vs +7 doesn't read as distinct at audition, escalation is +11 (then +12, accepting the octaver-ish cleanliness). Confidence: medium.
- **Vader is defined as much by absence (no reverb, no deep shift) as by presence** — the weakest intrinsic signature of the three new cells; the faint-drive distortion is the tiebreaker knob (0.15–0.25 range) if it reads as "bland deep radio" vs Narrator. Confidence: medium.
- **Monster growl at drive 0.6** is the only sketch above the rejected robot's drive 0.45 — growl is *wanted* here (noise = evil per E1), but if words smear, tone 0.18 → 0.22 re-opens the consonant band first. Confidence: medium-high.
- **Studio→live adaptation** (stated for the whole record): presence-region and density claims (E4, E5, E8) come from mixing/mastering literature on recorded, level-normalized playback; live karaoke adds feedback exposure and mono-summing possibilities. Mitigations: no delay feedback in any sketch, terminal limiter everywhere, host-owned attenuator downstream, and PEN-1's real-engine conformance run. All six sketches leave ≥ 8.5 dB of unspent gain budget except Megaphone (0.03 dB by design).

## Implementation consequences for GAG-1

1. Author the six candidates exactly as the preset-shape blocks above (house-style descriptions included; provenance/auditionDate filled by PRO-1 after the `?audition`). Node ids are suggestions — follow the pen's id convention.
2. PEN-1: run the conformance suite; watch the two boundary cases flagged in tradeoffs (Megaphone's budget/boost caps; inclusive-≤ semantics).
3. Pre-planned audition fallbacks (single-knob deltas, no re-architecture): robot tremolo 10–14 Hz / 60–70, or drop bitcrusher; megaphone threshold −18 → −16 or −17 if over-squashed; 8-bit bits/mix 6/55 → 7/45; helium pitch +10 → +11; vader drive 0.18 → 0.15–0.25; monster tone 0.18 → 0.22.
4. No code changes required: every param is within existing catalog ranges; no new vocabulary values needed (all tags already exist in the append-only vocabularies; Megaphone Rally carries no technique tag — none of the existing values fits, and adding one speculatively is forbidden).
5. Do not add a raw gain node to Megaphone to chase loudness — the record's position is that density + presence + ceiling is the loudness mechanism; PEN-1's budget breakdown will show the chain is already at the ceiling.

## Delegation record

- Researched by deep-research track agent (RES-2 = RQ-2 + RQ-3), 2026-08-29. Sources E1–E11 above; catalog/policy/precedent numbers verified directly in src/ this session. Record file: docs/ultron/preset-axis-cycle/research/rq2-gag-reauthoring.md. Return line delivered to coordinator: recommendation (six chains as specified — robot = harmony-double + comb + voice-break AM with distortion removed; megaphone = max-legal presence + density chain at 11.97 dB budget; 8-bit = 6 bits / mix 55 + pre-crush presence EQ; helium +10 thin; vader −4 dry intercom; monster −10 growl), strongest caveat (no ring mod / AM capped at 14 Hz — the robot's Dalek signature rate is unreachable and mono playback cancels tremolo, so the harmony double must carry the read), decisive evidence (Wilson & Moore VIHAR 2017 §2.2/§4.2 robot recipe + voice-breaks separation), affected task GAG-1 (PEN-1 boundary checks), confidence medium-high.
