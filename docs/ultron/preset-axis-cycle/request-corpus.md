# Request Corpus — every plausible karaoke request, scored against the library

Lane C of the scale-out batch ([scale-out-plan.md](scale-out-plan.md), decisions
D-3, D-4, D-7, D-8, D-10). Built 2026-09-01.

**Primary source:** [`docs/ultron/research/taxonomy-prior-art.md`](../research/taxonomy-prior-art.md)
— a six-product survey (Boss VE-5, TC-Helicon VoiceLive 2 / Touch 2, Voloco,
Smule, vocalpresets.com, voicechanger.live) plus verbatim room language from
the Karaoke Scene KJ forum, the sing.salon Smule community, r/karaoke and
r/AskAKorean. Every request below is traceable to that record; quoted strings
are verbatim from it. Nothing here is invented to fill a cell.

## What this document is for

`CONTEXT.md` defines the library as **coverage-driven**: sized by "every
plausible karaoke request finds a close preset", never by a target count. That
definition is untestable without a written list of the plausible requests. This
is that list, scored.

## Method

Each request is scored against **the 26 sounds that exist today** — the 6
shipped factory presets plus the 20 candidates in the audition pen — under the
**Closeness rule**: *a request is close enough to a preset when any of its tags
matches the request's dominant intent; a request that matches nothing is a
coverage gap.*

Lane B's promotion moves 8 of those 26 between two files (pen 20 → 12, library
6 → 14). It does not change what a singer can load, so it does not change a
single verdict here.

| The 26 sounds scored against | |
|---|---|
| **Library (6)** | Classic Karaoke, Warm Ballad, Rock Night, Phone Call Gag, Big Room, Clean Speech |
| **Pen, domain (11)** | Metal Mayhem, Hard-Tune Hotline, Slow Jam Silk, Nashville Nights, Club Anthem, West End Nights, Jazz Cellar, Cathedral Drift, Rotary Nostalgia, Space Lounge, Studio Polish |
| **Pen, gags (9)** | Chipmunk Party, Deep Narrator, AM Radio Ghost, Robot Usher, Megaphone Rally, 8-Bit Encore, Helium Hangout, Dark Helmet Baritone, Demon Growl |

### The verdicts

- **MATCHED** — an existing sound serves it. Author nothing.
- **COVERAGE GAP** — no sound serves it and the engine could. Author one
  candidate. Several requests may share one candidate; the candidate is named.
- **COVERAGE GAP (deferred)** — the engine could serve it, but the candidate is
  **not authored this batch** and the reason is stated. Two reasons occur:
  *vocabulary-blocked* (the tag it needs does not exist and
  `src/factory-library-data.js` is Lane B's file this batch, per D-8), and
  *approximation refused* (D-10 — see H7).
- **CAPABILITY GAP** — the effect catalog lacks the node type, so no preset can
  ever serve it. **Logged, never approximated** (D-10). These are the most
  valuable rows in this document: they name which node type to build next.

### The admission bar (D-3), applied

Cell coverage is **evidence**, never the bar. A candidate earns its slot only
when both of these can be written down and checked at PR review:

1. the plain-language request it answers, in a real singer's words, and
2. why the closest existing preset **fails** that request.

Both are recorded in each candidate's `provenance.origin` in
`src/audition-candidates.js`. Where the closest preset merely *lacks a
dropdown group*, that is not a failure and the row is MATCHED — see I1, F8,
F11, E15 for the four cells that fell exactly this way.

## The engine ceiling — what bounds every verdict below

Three hard limits do most of the work in this document. They are why the
capability-gap column is long and the coverage-gap column is short.

1. **Reverb exposes only `mix`.** The impulse response is host-owned and fixed
   (`src/mcp-tools.js`, rule `host-reverb-internals`). Cathedral, Arena,
   Stadium, Cave and Big Room are *the same plate at different wet
   percentages*. There is one venue and a wetness knob.
2. **EQ is three fixed bands** — 200 Hz shelf, 1 kHz peak at Q 1.0, 5 kHz
   shelf. No sweepable band-pass, so telephone, megaphone, walkie-talkie,
   radio and military radio all reach for the same three knobs; three of them
   are already spent.
3. **No harmony, no vocoder, no formant shift.** The prior art's entire
   "Harmony stack" family is unbuildable. Without formant shift, helium,
   chipmunk, little-kid, old-man, Mickey Mouse and "make me sound like a woman"
   are *one pitchshift at different amounts* — and two of those amounts are
   already taken.

Honest ceiling at the "usable without edits" bar: **40–60 audibly distinct
presets.** This batch takes the library-plus-pen from 26 to 34.

---

# The corpus

123 requests, in nine families.

## A. Amount and intensity — the most-attested family in the whole record

The KJ forum's requests are literal and amount-focused; the Smule community's
are comparative. The corpus separates *echo* (countable repeats) from *reverb*
(a wash) explicitly, and so does this scoring.

| # | Request (user's words) | Verdict | Evidence |
|---|---|---|---|
| A1 | "Give me some echo!" — shouted mid-song | **COVERAGE GAP** → *Noraebang Echo* | Nothing in the 26 is *about* echo. The highest delay mix anywhere is Classic Karaoke's 25 % at 300 ms / 25 % feedback — which is precisely the "just enough" setting the singer already has when they shout for more. Cathedral Drift and Big Room answer *more reverb*, a different request the corpus itself distinguishes (A2). |
| A2 | "can I have 33% reverb.. and just 15% echo? Please?" | MATCHED | Two numbers on the closest preset — exactly the load-and-tweak the Closeness rule prescribes, and exactly what `set_param` is for. Not preset-shaped. |
| A3 | "Stronger voiced seasoned singers prefer lots more reverb and always ask for it." | MATCHED | Cathedral Drift (reverb 60) and Big Room (50) are the top of the one axis reverb has. |
| A4 | "just enough reverb to accent a vocal, not actually 'hear' the effect" | MATCHED | Classic Karaoke (reverb 20, delay 25) is this setting; the KJ names it as the target and the preset is the default. |
| A5 | "totally eschewing reverb is just about as bad as using too much" | MATCHED | Same. The request is *some*, and the default is some. |
| A6 | "turn up the reverb when I sing… I would sound better" | MATCHED | Warm Ballad (35) → Big Room (50) → Cathedral Drift (60) is a usable ladder. |
| A7 | "try to match your Echo to sound like the original" | MATCHED | Fidelity to a specific record is per-song tuning, not a preset. Load the genre preset, tweak the delay. |
| A8 | Noraebang culture treats echo as the default expectation, not an add-on | **COVERAGE GAP** → *Noraebang Echo* | Same gap as A1, from an independent source. The app's default (Classic Karaoke) is a Western studio slap-back, not a Korean karaoke-room echo. |
| A9 | "I prefer raw voice" / "None" as a first-class choice | MATCHED | Bypass is the **safety floor** — shown at equal prominence in both views — and Clean Speech is its preset form. |
| A10 | "apply an effect to one portion of the song and another to a different part" | **CAPABILITY GAP** | Automation / scene switching. Not a node type and not a preset: a surface capability the app does not have. |
| A11 | "I can't hear myself over the track — make me louder" | MATCHED | Level, not tone. The output attenuator is host-owned and the +12 dB gain budget is a policy floor, not a preset choice. |

## B. Complaint metaphors — the anti-presets

D-10's approved exception: these are the one family where a *complaint* is
authorable, because the house description style already promises to avoid the
thing. Most turn out to be already-answered.

| # | Request (user's words) | Verdict | Evidence |
|---|---|---|---|
| B1 | "singing from down a tunnel or a well" | MATCHED | The complaint is *too much reverb*. Classic Karaoke is the answer, and eight existing descriptions already say "no tunnel" / "not tunnel". |
| B2 | "tin can and string" | MATCHED | The complaint is *thin and boxy*. Warm Ballad restores the low end; Studio Polish's description already promises "no tin can". |
| B3 | "sewer pipe reverb" | MATCHED | Same complaint as B1 with a coarser metaphor. |
| B4 | "effects wet to the point of bell ringing" | MATCHED | Ringing is loop gain. The `compound-loop-guard` rule makes a ringing preset **unauthorable** — feedback ≥ 55 % with an EQ boost sum ≥ +6 dB is rejected by the engine. Every one of the 26 is structurally under it. |
| B5 | "a straight dry mic" | MATCHED | Bypass, or Clean Speech. |
| B6 | "you will hear a lot of stuff you don't want to hear — like the 'poppin' p's'" | MATCHED | Studio Polish, whose description names plosives explicitly. |
| B7 | "the default Studio setting have too much reverb… produces also a lot of hiss sounds, especially with sss or fff components" | **COVERAGE GAP** → *Hiss Rescue* | Studio Polish is the cleanup preset and it makes this complaint **worse**: its 5 kHz shelf is **+1.5 dB**, so every *s* and *f* is lifted, and the hiss it promises to fix is room hiss *between* phrases (a gate job), not sibilance *inside* words. The only two presets that cut the 5 kHz shelf are Jazz Cellar (−3, a dark jazz colour riding 30 % reverb) and Phone Call Gag (a band-limited gag). Neither is a cleanup preset. |
| B8 | "waaaaay too much. It's criminal." | MATCHED | Restatement of B1. |
| B9 | Room noise and breaths audible between phrases | MATCHED | Studio Polish's gate (threshold −45, floor −40). |

## C. Cleanup and utility — "fix my mic" is preset-shaped demand

The prior art's amendment to the working split: Voloco `Clean`, Smule `Polish`,
voicechanger.live `Crispy Mic` / `Announcer` / `Streamer Pro` / `ASMR`, and
"Podcast" smuggled into a commercial *genre* filter with its own preset count.

| # | Request (user's words) | Verdict | Evidence |
|---|---|---|---|
| C1 | "make my mic sound better" (`Crispy Mic`) | MATCHED | Studio Polish. |
| C2 | "I want to clean up my voice" (Voloco `Clean`) | MATCHED | Studio Polish. |
| C3 | `Polish` (Smule) | MATCHED | Studio Polish. |
| C4 | `Announcer` — "I'm the host, I need to be heard over a loud room" | **COVERAGE GAP** → *Room Announcer* | Clean Speech is the only `use-case:speech/hosting` preset and is designed to be the exact opposite: "no audible coloring", 2:1 at −10 dB, 5 kHz shelf at **−1 dB**, ceiling −6. It will not cut through a room; it is not built to. Megaphone Rally does cut through, but it is a **gag** — a band-limited bullhorn honk, not a host's voice. The KJ forum, one of the two verbatim sources in the record, is *entirely* hosts. |
| C5 | "Pro Studio" / "radio-ready" | MATCHED | Studio Polish, or Classic Karaoke. |
| C6 | Podcast / streaming voice — rich and broadcast-y | **COVERAGE GAP** → *Podcast Warmth* | Clean Speech's whole description is "the voice should just sound like itself" — the opposite ask. Warm Ballad has the warmth but is a *singing* chain wearing a 35 % hall, wrong for spoken word. Room Announcer (this batch) is bright and dense for cutting through a room, not warm and relaxed for headphones. vocalpresets.com carries Podcast as its own filtered bucket with four presets in it. |
| C7 | `ASMR` — whisper-close, very quiet | **COVERAGE GAP** → *Close-Up Whisper* | Same candidate as F10. |
| C8 | `Streamer Pro` | **COVERAGE GAP** → *Room Announcer* | Same candidate as C4. |

## D. Artist and technique shorthand

"T-Pain" is the universal shorthand for hard auto-tune, including at live
karaoke. Voloco built two pack names out of exactly this pattern (`P-Tain`,
`Bon Hiver`).

| # | Request (user's words) | Verdict | Evidence |
|---|---|---|---|
| D1 | "I want to sound like T-Pain" | MATCHED | Hard-Tune Hotline (`technique:hard-tune`, autotune at retune 5 ms / mix 100). |
| D2 | "The Helicon provides subtle auto tune, not as harsh as T-Pain" | **COVERAGE GAP** → *Pitch Safety Net* | Hard-Tune Hotline is the only pitch-correction preset in all 26, and its retune is 5 ms at mix 100 — **the T-Pain snap this request explicitly asks not to have**. There is no gentle setting to load, and Simple view cannot reach the retune knob to make one. The catalog itself documents 250 ms as "a natural gentle setting" on the same engine; nothing uses it. |
| D3 | `Natural Tune` (Voloco) | **COVERAGE GAP** → *Pitch Safety Net* | Same candidate as D2, from an independent product. |
| D4 | `Bon Hiver` — Bon Iver's stacked, vocoded "Woods" sound | **CAPABILITY GAP** | Vocoder **and** harmony. Two missing node types in one request. |
| D5 | `Duft Pank` / Daft Punk | **CAPABILITY GAP** | Vocoder / talkbox. |
| D6 | `KANYE LOCKDOWN` — hard tune, below | MATCHED | Hard-Tune Hotline. The "below" is harmony placement (see H2) but the hard-tune read is the dominant intent. |
| D7 | "Chopped & Screwed" (Rapchat) | **CAPABILITY GAP** | Needs time-stretch / varispeed. `pitchshift` moves pitch without touching time, which is the half that is *not* the effect. |
| D8 | `ELVIS RADIO` — slapback | MATCHED | Nashville Nights (100 ms slap) and Rock Night (110 ms). |
| D9 | `Old Soul` — "Aretha Franklin or Amy Winehouse styles" | MATCHED | Slow Jam Silk (`genre:R&B/Soul`, warm, plate at 35). |
| D10 | `New Wave` — late-70s/80s British chorus/phaser/doubling | MATCHED | `vibe:retro` (Rotary Nostalgia) matches the dominant intent; Space Lounge holds the phaser. |

## E. Genre

vocalpresets.com's 28-category genre filter with live counts is the closest
thing the market has to a published coverage map. Our frozen `genre` vocabulary
holds nine values.

| # | Request | Verdict | Evidence |
|---|---|---|---|
| E1 | "I'm singing a Top-40 pop song — make me sound like the record" | **COVERAGE GAP** → *Chart Topper* | `genre:Pop` has **no preset at all** and, unusually for an empty cell, a real failing request behind it. Classic Karaoke is EQ-**flat** (0 / 0 / 0) by design — it is the neutral default, so it offers no 200 Hz de-boxing, no 5 kHz air and no width, and its 300 ms / 25 % delay reads as a general room rather than a pop eighth-note. Warm Ballad, the only other `genre:Pop`-tagged sound, is a slow close-up ballad with no delay and no top end. The request is for a *produced* sound; the closest preset's entire job is to be unproduced. |
| E2 | Rock | MATCHED | Rock Night. |
| E3 | Metal | MATCHED | Metal Mayhem. |
| E4 | Rap / Hip-Hop | MATCHED | Hard-Tune Hotline. |
| E5 | Trap | MATCHED | Hard-Tune Hotline (its description names the modern trap sound). |
| E6 | Drill | MATCHED | Hard-Tune Hotline. |
| E7 | R&B | MATCHED | Slow Jam Silk. |
| E8 | Country | MATCHED | Nashville Nights. |
| E9 | Jazz | MATCHED | Jazz Cellar. |
| E10 | Dance / EDM | MATCHED | Club Anthem. |
| E11 | Musicals / showtunes | MATCHED | West End Nights. |
| E12 | Reggae / dancehall / dub | **COVERAGE GAP (deferred — vocabulary-blocked)** | A dub chain is genuinely buildable and genuinely distinct: a long delay at 60–65 % feedback with a dark repeat colour is a sound nothing in the 26 makes (highest feedback anywhere is Cathedral Drift's 35 %). It needs `genre:Reggae`, and `src/factory-library-data.js` is Lane B's file this batch. **The single strongest append candidate — see the vocabulary log.** |
| E13 | Latin / reggaeton | **COVERAGE GAP (deferred — vocabulary-blocked)** | Needs `genre:Latin`. Weaker than E12: the chain would sit close to Chart Topper. |
| E14 | Afrobeats | **COVERAGE GAP (deferred — vocabulary-blocked)** | Needs `genre:Afrobeats`. Same weakness as E13. |
| E15 | Lo-fi | MATCHED | `vibe:lo-fi` is carried by Rotary Nostalgia and AM Radio Ghost. Empty **primary** group, non-empty tag — a dropdown hole, not a coverage gap. |
| E16 | Hyperpop | MATCHED | Hard-Tune Hotline plus Club Anthem. |
| E17 | Opera / classical (`OPERA QUEEN`, `SF Opera`) | MATCHED | `vibe:epic/big` (Big Room). |
| E18 | Ballad | MATCHED | Warm Ballad. |
| E19 | Gospel / choir | **CAPABILITY GAP** | Harmony. The request *is* the missing node type. |
| E20 | Blues | **COVERAGE GAP (deferred — vocabulary-blocked)** | Needs `genre:Blues`. The chain (light grit over a warm, slapped, dark-ish voice) sits between Metal Mayhem's distortion and Jazz Cellar's warmth and would be distinct from both — but marginally. |
| E21 | Phonk / Jersey Club | MATCHED | Club Anthem. |

## F. Vibe and space

| # | Request | Verdict | Evidence |
|---|---|---|---|
| F1 | `ARENA` | **CAPABILITY GAP** | One fixed impulse response. Arena is Big Room at a different `mix`, and the difference between an arena and a plate is the IR, which is host-owned. |
| F2 | `CATHEDRAL` | **CAPABILITY GAP** | Same. (Cathedral Drift is named for the *feeling*; it is the plate at 60 %.) |
| F3 | `Stadium` | **CAPABILITY GAP** | Same. |
| F4 | `Cave` | **CAPABILITY GAP** | Same. Deep Narrator already borrows the word in its description at 30 % — that is the whole cave the engine has. |
| F5 | Big room | MATCHED | Big Room. |
| F6 | `Expanse` (Voloco) | MATCHED | Cathedral Drift. |
| F7 | `Spooky` (Voloco) | MATCHED | Deep Narrator, Space Lounge, Demon Growl. |
| F8 | "Dark & Moody Rap" (vocalpresets.com) | MATCHED | `vibe:dark/moody` is carried by Jazz Cellar and Demon Growl; the dominant intent matches. Empty primary group, non-empty tag — a dropdown hole. |
| F9 | "Punchy Trap" | MATCHED | Rock Night, Hard-Tune Hotline. |
| F10 | `CLOSE UP 3RD` / whisper-close intimate singing | **COVERAGE GAP** → *Close-Up Whisper* | `vibe:intimate` has **no preset at all**. Warm Ballad is the closest slow-song chain and fails twice: its 35 % plate pushes the voice back into a hall — the exact opposite of "right next to the mic" — and its 2.5:1 at −10 dB leaves genuinely breathy notes under the backing track. (The harmony half of TC's preset name is E-family capability gap; the *close-up* half is this.) |
| F11 | Bright / airy / `Crispy Mic` | MATCHED | `vibe:bright` is carried by Rock Night, Metal Mayhem, Club Anthem and Hard-Tune Hotline; as a *cleanup* request it is Studio Polish. Dropdown hole. |
| F12 | Retro | MATCHED | Rotary Nostalgia. |
| F13 | Psychedelic | MATCHED | Space Lounge. |
| F14 | `Center Stage` (Smule) | MATCHED | Big Room. |
| F15 | Warm | MATCHED | Warm Ballad. |
| F16 | "like singing in the shower" | MATCHED | Cathedral Drift. |
| F17 | "echo, but without the wash" | **COVERAGE GAP** → *Noraebang Echo* | Same candidate as A1. Rock Night is the only reverb-free sound with a delay, and it is a bright rock colour, not a neutral echo. |

## G. Gag and character

The gag space has the maturest consensus vocabulary in the record —
and it is where the engine ceiling bites hardest.

| # | Request | Verdict | Evidence |
|---|---|---|---|
| G1 | Robot | MATCHED | Robot Usher. |
| G2 | Chipmunk | MATCHED | Chipmunk Party (+7 st). |
| G3 | Helium | MATCHED | Helium Hangout (+10 st). |
| G4 | Deep voice / narrator | MATCHED | Deep Narrator (−7 st). |
| G5 | Radio | MATCHED | AM Radio Ghost. |
| G6 | Telephone | MATCHED | Phone Call Gag. |
| G7 | Megaphone | MATCHED | Megaphone Rally. |
| G8 | Walkie-talkie / military radio | **CAPABILITY GAP** | The three fixed EQ bands are the *only* band-limiting tool, and G5, G6 and G7 have already spent them at three settings. A fourth would be the same three knobs at a fourth position — a param variation, which fails D-3. What a walkie-talkie actually needs is a squelch/noise-burst generator and a narrow sweepable band-pass; neither exists. |
| G9 | Darth Vader | MATCHED | Dark Helmet Baritone. |
| G10 | Mickey Mouse | **CAPABILITY GAP** | Formant shift. Without it, this is `pitchshift` up — Chipmunk Party and Helium Hangout already hold +7 and +10. |
| G11 | Demon | MATCHED | Demon Growl. |
| G12 | Zombie / possessed | MATCHED | Demon Growl. |
| G13 | Ghost | MATCHED | Deep Narrator, Cathedral Drift. |
| G14 | Alien | **CAPABILITY GAP** | Ring modulator. The closest legal stand-in is tremolo, whose 14 Hz ceiling Robot Usher already sits against at 12 Hz. |
| G15 | Dalek / `Broken AI` | **CAPABILITY GAP** | The Dalek is a 30 Hz ring modulator — more than twice the tremolo ceiling. Documented in the GAG-1 record as unreachable and still unreachable. |
| G16 | 8-Bit | MATCHED | 8-Bit Encore. |
| G17 | Little kid | **CAPABILITY GAP** | Formant shift. Pitch-only lands between Chipmunk Party and the dry voice — a param variation. |
| G18 | Old man | **CAPABILITY GAP** | Formant shift. Pitch-only lands on Dark Helmet Baritone's −4. |
| G19 | Pixie | MATCHED | Helium Hangout. |
| G20 | Vocoder / `Vibravox` / `Super Vocoder` | **CAPABILITY GAP** | No vocoder, no carrier oscillator. |
| G21 | Talkbox | **CAPABILITY GAP** | Same family as G20. |
| G22 | Anime girl | **CAPABILITY GAP** | Formant shift. |
| G23 | Creepy doll | **CAPABILITY GAP** | Formant shift. |
| G24 | Dragon / Venom | MATCHED | Demon Growl. |
| G25 | `Sitar Hero` / `HARMONICA` / `SAXOPHONE` — instrument emulation | **CAPABILITY GAP** | Resonator / formant modelling. |
| G26 | `STROBE` (Boss VE-5) / EDM vocal chop | **COVERAGE GAP (deferred — vocabulary-blocked)** | Buildable as deep fast tremolo alone, and the request is distinct from "robot" — but there is no `gag` value for it, and the mechanism collides with Robot Usher's 12 Hz tremolo, so distinctness at the audition is genuinely uncertain. Logged, not authored. |
| G27 | `OPERA QUEEN` | MATCHED | Big Room. |
| G28 | Underwater | **COVERAGE GAP (deferred — vocabulary-blocked)** | Buildable (dark EQ + slow deep phaser + chorus) and distinct from Space Lounge's bright swoosh, but there is no `gag` value for it. Logged, not authored. |
| G29 | `Wormhole` / `Mega Maze` / `Super Bloop` — pure novelty | MATCHED | Space Lounge. These are product names, not requests a singer makes; the nearest real request is "something weird and spacey". |
| G30 | "make me sound like a woman" / "like a man" | **CAPABILITY GAP** | Formant shift. This is the single clearest statement of why formant shift is the highest-value missing node: pitch alone changes the *note*, not the *voice*. |

## H. Harmony and doubling — the biggest single gap in the record

Boss VE-5 gives this family its own top-level group (five of thirty presets).
TC-Helicon tags harmony placement on the majority of its preset list
(`Above`, `Below`, `Above & Below`, `Doubling`, `Choir Enabled`, `Octaves`).
Voloco's official guide answers "I want my voice to sound like a choir" as a
first-class desire line. voicechanger.live markets Harmony as "Live singing and
karaoke — sing one line and bring your own backup voices into the room."

| # | Request | Verdict | Evidence |
|---|---|---|---|
| H1 | "sing one line and bring your own backup voices into the room" | **CAPABILITY GAP** | Harmony. |
| H2 | 3rd / 5th harmony, above / below | **CAPABILITY GAP** | Harmony with key- and pitch-tracking. |
| H3 | `DOUBLE VOICE` / TC's `Doubling` tag / ADT — "sound like two of me" | **COVERAGE GAP** → *Double Track* | Chorus appears in five of the 26 (Slow Jam Silk 15 %, Club Anthem 20 %, Cathedral Drift 18 %, Space Lounge 25 %, Jazz Cellar 10 %) but **always as width texture underneath a genre or a vibe** — never at a depth and mix that reads as a second take, and never with the short pre-delay that makes a double a double rather than a shimmer. Big Room, the only `vibe:epic/big` preset, gets its size from a 50 % plate and a 320 ms delay: one voice in a hall, not two voices. |
| H4 | Choir | **CAPABILITY GAP** | Harmony. Explicitly **not** approximated (D-10): a fake choir built from chorus and delay is the exact fluff this batch exists to prevent. |
| H5 | `UNISON` / `FOUR VOICE` | MATCHED (by H3's candidate) | Unison doubling is precisely what the engine *can* do, and Double Track does it. |
| H6 | `Big Chorus` (Voloco) | MATCHED | Chorus is present in five of the 26. |
| H7 | TC's `Octaves` tag | **COVERAGE GAP (deferred — approximation refused)** | Buildable: `pitchshift` at ±12 semitones with `mix` well under 100 puts an octave *behind* the dry voice, and an octave is key-independent so it stays musically valid on any song. Nothing in the 26 does it (Robot Usher's +3 at 45 % is a robot texture, not an octave). **Deliberately not authored.** It is a granular octave with ~100 ms of latency and audible artefacts, and describing it in the language this family actually uses — "backing voices", "big vocals" — would be selling an approximation as the missing capability. D-10 says log it; this is logged. If a future batch wants it, it must be named and described as *an octave*, and it must earn its slot against Double Track. |

## I. Use-case and session shape

| # | Request | Verdict | Evidence |
|---|---|---|---|
| I1 | Practice / warm-up — "let me hear myself honestly while I learn the song" | MATCHED | `use-case:practice` is an empty primary group, and it stays empty. Studio Polish (gate + gentle level + no ambience) and Clean Speech (light level, no colour) already *are* the honest-monitoring chain; a practice preset would be those chains with the EQ nudged. **A dropdown hole is not a coverage gap** (D-3) — there is no request here that the engine can serve differently from what already exists. This row is the clearest example of cell coverage being evidence and not the bar. |
| I2 | Hosting the room / KJ mic | **COVERAGE GAP** → *Room Announcer* | Same candidate as C4. |
| I3 | Duet — two singers, two mics | **CAPABILITY GAP** | Single input path. Not a node type; a routing capability. |
| I4 | Group / party sing-along on one mic | MATCHED | Classic Karaoke. |
| I5 | "I want to keep this take" | **CAPABILITY GAP** | No recording surface. |
| I6 | "I go from a whisper to a belt in one song" | MATCHED | West End Nights, whose description names exactly this. |
| I7 | "Rap, but without the autotune" | MATCHED — **with a surface finding** | Hard-Tune Hotline minus one node. Under the Closeness rule the `genre:Rap/Hip-Hop` tag matches, so an *agent* serves this in one edit. A **Simple view** user cannot: Simple hides chain construction, so they cannot remove the autotune node. The gap is a surface affordance, not a preset — logged for Lane B rather than papered over with a near-duplicate of Rock Night. |
| I8 | "my mic is howling / squealing" | MATCHED | Gain staging and the safety floor, not a preset. |
| I9 | Vibrato on held notes | **CAPABILITY GAP** | No LFO on pitch. `tremolo` modulates amplitude; `pitchshift` has no rate. |
| I10 | De-esser — dynamic control of one band | **CAPABILITY GAP** (partially served) | The true node does not exist. B7's candidate does what the fixed 5 kHz shelf can do, and its description says plainly that it trades air for the fix. |

---

# Results

| Verdict | Requests | Share |
|---|---:|---:|
| **MATCHED** | 74 | 60 % |
| **COVERAGE GAP — authored** | 14 | 11 % |
| **COVERAGE GAP — deferred** | 7 | 6 % |
| **CAPABILITY GAP — logged, never approximated** | 28 | 23 % |
| **Total** | **123** | |

**14 coverage-gap requests resolve to 8 candidates**, because several requests
are the same gap seen from different sources — which is itself evidence: a gap
three products and a forum all describe independently is a real one.

| Candidate | Answers | Primary |
|---|---|---|
| Chart Topper | E1 | `genre:Pop` |
| Pitch Safety Net | D2, D3 | `use-case:performance` |
| Noraebang Echo | A1, A8, F17 | `use-case:performance` |
| Close-Up Whisper | F10, C7 | `vibe:intimate` |
| Hiss Rescue | B7 | `use-case:cleanup` |
| Room Announcer | C4, C8, I2 | `use-case:speech/hosting` |
| Podcast Warmth | C6 | `use-case:speech/hosting` |
| Double Track | H3 | `vibe:epic/big` |

## Why 8 and not 50

D-4 settled this in advance: *if the corpus and the bar conflict, the bar
wins.* The corpus is not short — 123 requests is a thorough sweep of six
products and four communities. What is short is the list of requests that (a)
no existing sound serves and (b) the engine can actually make a *different
noise* for.

The arithmetic, plainly:

- **28 requests (23 %) are capability gaps.** Nearly a quarter of everything a
  karaoke singer plausibly asks for cannot be built at all with the fourteen
  node types the app has. Twelve of those 28 are gags, and the gag family is
  where a preset library normally grows fastest.
- **74 requests (60 %) are already served.** 26 sounds covering 74 of 123
  plausible requests is a library working as designed. Four of the seven
  "open cells" the plan listed turned out to be **dropdown holes, not coverage
  gaps** — `use-case:practice`, `vibe:bright`, `vibe:dark/moody` and
  `vibe:lo-fi` are all reachable as tags on existing presets, and none has a
  request behind it that the engine can answer differently. Under D-3, an
  empty optgroup is not admission evidence.
- **Of the 21 real coverage gaps, 7 are deferred** — six of them because they
  need a vocabulary value in a file another lane owns this batch, one (H7)
  because authoring it would mean selling an approximation as a capability.

Every one of the 8 authored candidates has a named request in a real singer's
words and a named, checkable failure in the closest existing preset. None of
them is a param variation of something already in the pen. That is the whole
of the bar, and 8 is what cleared it.

# Capability-gap register

The most valuable output of this document. Sorted by how many corpus requests
each missing node type unblocks — i.e. by what to build next.

| Rank | Missing capability | Requests blocked | Which |
|---:|---|---:|---|
| 1 | **Formant shift** | 7 | G10 Mickey Mouse, G17 little kid, G18 old man, G22 anime girl, G23 creepy doll, G30 "sound like a woman/man", and it is half of G25 |
| 2 | **Harmony** (pitch-tracked, key-aware) | 5 | H1 backing voices, H2 3rd/5th above/below, H4 choir, E19 gospel, D4 Bon Iver |
| 3 | **Selectable reverb impulse response** | 4 | F1 arena, F2 cathedral, F3 stadium, F4 cave — one fixed plate is one venue |
| 4 | **Vocoder / carrier oscillator** | 3 | G20 vocoder, G21 talkbox, D5 Daft Punk (and half of D4) |
| 5 | **Ring modulator** | 2 | G14 alien, G15 Dalek — the tremolo ceiling is 14 Hz, a Dalek needs 30 |
| 6 | **Sweepable band-pass + noise/squelch generator** | 1 | G8 walkie-talkie — three fixed EQ bands are already spent on radio, telephone and megaphone |
| 7 | **Time-stretch / varispeed** | 1 | D7 chopped & screwed |
| 8 | **Pitch LFO (vibrato)** | 1 | I9 |
| 9 | **Dynamic band processing (de-esser)** | 1 | I10 — partially served by Hiss Rescue's static shelf |
| 10 | **Resonator / instrument modelling** | 1 | G25 harmonica, saxophone, sitar |
| — | *Surface capabilities, not node types* | 3 | A10 per-section automation, I3 second input for duets, I5 recording the take |

**Read this table as a build order.** Formant shift alone unblocks seven
requests and re-opens the gag family, which is the family that grows a karaoke
preset library fastest. Harmony unblocks five and is the one family every
surveyed product has and this app does not. Between them, two node types would
lift the honest ceiling by more than any number of new presets against the
current catalog.

# Vocabulary pressure log

Per D-8: values may be appended to existing axes when the corpus proves a real
request fails to match; **no new axes this batch.**

## Values this batch would have appended, and did not

`src/factory-library-data.js` is Lane B's file for the duration of this batch,
and Lane B's promotion has not merged. **No vocabulary append was made and none
of the 8 candidates needs one** — all 8 tag entirely inside the frozen
vocabulary. The following are handed to Lane B (or the next batch) with the
corpus evidence attached:

| Axis | Value | Corpus evidence | Strength |
|---|---|---|---|
| `genre` | `Reggae` | E12. A dub delay at 60–65 % feedback is a sound none of the 26 makes; highest feedback anywhere is 35 %. | **Strong — recommend appending.** |
| `gag` | `strobe` (or `vocal-chop`) | G26, Boss VE-5 ships `STROBE` as a named factory sound. | Medium — mechanism collides with Robot Usher's tremolo. |
| `gag` | `underwater` | G28. | Medium. |
| `genre` | `Blues` | E20. | Medium — sits between Metal Mayhem and Jazz Cellar. |
| `genre` | `Latin`, `Afrobeats` | E13, E14. | Weak — the chains would land near Chart Topper. |

## Values the prior art suggested that the corpus then killed

The plan named five `gag` values to consider — `alien`, `cave`,
`walkie-talkie`, `old-man`, `little-kid`. **Every one is blocked by a
capability gap**, so appending any of them would create a vocabulary value no
preset can ever legitimately fill:

- `alien` → ring modulator (G14)
- `cave` → selectable impulse response (F4)
- `walkie-talkie` → sweepable band-pass + squelch (G8)
- `old-man`, `little-kid` → formant shift (G17, G18)

This is the append-only rule working exactly as designed: the corpus was the
proof it demands, and the proof came back negative. **Do not append these until
the node type exists.**

## Axis-level pressure — logged for the next batch, not acted on

- **`artist:`** — D1–D9. Artist shorthand is how singers actually ask ("I want
  to sound like T-Pain"), every surveyed product monetises it (`P-Tain`,
  `Bon Hiver`, `Duft Pank`, `KANYE LOCKDOWN`, `ELVIS RADIO`, `REHAB DOOET`),
  and it is orthogonal to all four existing axes. **This is the strongest
  axis-level pressure in the corpus.** It is also the one most likely to be
  blocked on capability rather than taxonomy — four of the nine artist requests
  scored here are capability gaps (D4, D5, D7 and half of D6's "below"), so an
  `artist:` axis added today would ship mostly unfillable. Recommend
  re-scoring it *after* formant shift and harmony exist.
- **`technique:doubling`** — H3, H5. The internal technique axis has no value
  for doubling; Double Track takes `technique:modulated/wide`, which is
  accurate but coarse. Low urgency: the technique axis is internal, used for
  coverage and dedup only, never user-facing.

# Surface findings handed to other lanes

Not preset problems, found while scoring:

1. **I7 — Simple view cannot subtract.** "Rap, but without the autotune" is
   one node deletion away from a preset we already ship, and a Simple-view user
   cannot make it. Authoring a near-duplicate of Hard-Tune Hotline to route
   around a missing affordance would be exactly the padding D-3 forbids. Lane B
   / the surface work should know this is a real request the library
   deliberately did not answer.
2. **A2 is the shape of a well-served request.** "33 % reverb and 15 % echo" is
   two `set_param` calls on the closest preset — the preset-first strategy
   (D-2) working. It is worth noting that the corpus's most *precise* request
   is also the one that needs the library least.
