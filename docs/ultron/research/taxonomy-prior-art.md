# Research: Taxonomy Prior Art — Vocal Preset Libraries and Karaoke Request Language

Ticket: [#27](https://github.com/Arrangedgodly/voxchain/issues/27). Map: #26. All primary sources fetched and verified 2026-09-01 unless noted.

## Question

What prior art should shape the preset coverage taxonomy? Two veins: (1) how existing vocal-effect products name and organize their preset libraries (hardware vocal pedals, DAW vocal-chain presets, karaoke apps), and (2) what phrasings real karaoke users actually use when asking for a sound. The working split to test is **genre / vibe / use-case / gag**, doubling as a coverage map. Findings feed the taxonomy design ticket directly.

## Vein 1 — How products name and organize preset libraries

### Boss (Roland) VE-5 Vocal Performer: technique-first groups, genre as leaf presets

The VE-5's official manual publishes its 30 factory "sounds" as a **Sound List grouped by what the effect does, not by genre** — with genre names appearing as individual presets inside the first group. The manual's own group headings, verbatim:

- *"Effect sounds for specific musical styles"*: `BRIGHT ECHO`, `DEEP ECHO`, `ARENA`, `CATHEDRAL`, `ENSEMBLE`, `POP`, `BALLAD`, `ROCK`, `JAZZ`, `HIP HOP`, `HARMONICA`, `SAXOPHONE`
- *"Harmony sound that adds a natural harmony / Double-tracking effects that add depth to your voice"*: `5th HARMONY`, `3rd HARMONY`, `DOUBLE VOICE`, `FOUR VOICE`, `UNISON`
- *"Sounds with automatic pitch correction"*: `PitchCorrect`, `CHROMATIC`, `ROBOT`, `ElectricTune`
- *"Special-effect sounds such as radio voice or strobed voice"*: `DISTORTION`, `RADIO`, `STROBE`, `CHORUS`, `FLANGER`, `HEAVY SCREAM`, `SPACE LOUNGE`, `OPERA QUEEN`, `REFRAIN`

Note the mix inside one group: genres (`POP`, `JAZZ`), venue imaging (`ARENA`, `CATHEDRAL`), instrument emulation (`HARMONICA`, `SAXOPHONE`), and character voices (`OPERA QUEEN`, `SPACE LOUNGE`). Source: official VE-5 owner's manual PDF, [static.roland.com/assets/media/pdf/VE-5_OM.pdf](https://static.roland.com/assets/media/pdf/VE-5_OM.pdf) (Sound List page).

Related Boss facts from official manuals: the VE-2 Vocal Harmonist ships only 3 user memories and a 12-type harmony knob — no named library at all ([boss.info/us/products/ve-2](https://www.boss.info/us/products/ve-2/)); the VE-500 calls a stored chain a "patch" (50 preset + 99 user slots) but names none of them in the owner's manual, deferring to a separate Parameter Guide PDF ([VE-500 owner's manual](https://static.roland.com/assets/media/pdf/VE-500_eng03_W.pdf)). The VE-20's genre-labeled memories ("hard rock, pop, ballad…") are only documented in third-party copies of its preset parameters (e.g. [Scribd mirror](https://www.scribd.com/doc/93045725/Boss-Ve-20-Preset-Parameters)) — flagged secondary, not verified against an official Roland PDF.

### TC-Helicon VoiceLive: evocative names + a faceted tag column

TC-Helicon's official **VoiceLive 2 Preset List** document is the single most instructive artifact found. Every preset has a name and an **"Assigned Tags"** column — a machine-applied faceted vocabulary layered on top of the names. Sample rows:

| Preset | Tags |
|---|---|
| `N SYNC POP` | Doubling, Above, Ambience, Pop |
| `KANYE LOCKDOWN` | Hard Tune, Below, Pop |
| `ANOTHER BRICK` | Doubling, Wet, Ambience Short |
| `REHAB DOOET` | Below, Ambience Long |
| `IM N LUV (WIT A STRIPPER)` | Hard Tune, Above |
| `ELVIS RADIO` | Doubling, Dry, Rock |
| `POVICH OPRY` | Choir Enabled, Extreme Correction |
| `CLOSE UP 3RD` | Above & Below, Ambience, Simple |
| `3RDS & 5THS L-R` | Above & Below, Simple, Wet |
| `JAZZ CLOSEUP` | Above, Jazz, Doubling |
| `COUNTRY GIRLS` | Above, Country, Doubling |
| `POP TRIO` | Above & Below, Pop |
| `CHOR CHOPIN` | Choir Enabled, Wet |
| `MOTAOWN MELLEN` | Doubling, R&B |
| `STROBANINE` | Distortion, Rock |

The full tag vocabulary observed: harmony placement (`Above`, `Below`, `Above & Below`), `Doubling`, `Big Vocals`, `Ambience Short`/`Ambience Long`, `Wet`/`Dry`, `Simple`, `Hard Tune`, `Megaphone`, `Distortion`, `Extreme Correction`, `Choir Enabled`, `Octaves`, `Modulation`, `Character`, plus **genre tags** (Pop, Rock, R&B, Country, Jazz, Dance). In other words: **names are flavor (artist/song puns), retrieval is by facets** — and genre is just one facet among ~15. Source: official TC-Helicon *VoiceLive 2 Preset List* document, mirrored at [yumpu.com/en/document/view/23164344/voicelive-2-preset-list-tc-helicon](https://www.yumpu.com/en/document/view/23164344/voicelive-2-preset-list-tc-helicon) (mirror of the tc-helicon.com PDF; brand site retired).

The VoiceLive Touch 2 extends this: its preset browser has a **Genre filter** (Pop, Rock, Jazz, R&B, etc.) over 200 factory presets with pun names like `WE WILL ROK U`, `KATY'S AWAKE`, `I AM EGGMAN`, `JAYLO ON FLOOR`, `BROWN ID GIRL` — again, genre as a *filter*, never as folders. Sources: [Absolute Music VLT2 review](https://community.absolutemusic.co.uk/entries/tc-helicon-voicelive-touch-2-review), VLT2 reference manual mirrors ([Yumpu](https://www.yumpu.com/en/document/view/24237092/voicelive-touch-2-reference-manual-english-tc-helicon), [Scribd](https://www.scribd.com/document/724195513/VoiceLive-Touch-2-Reference-Manual-English-TC-Helicon)).

### Voloco (mobile vocal-FX app — closest living relative to voxchain): packs mix all four buckets, and the official guide offers dual navigation

Voloco ships 70+ vocal effects in named packs. From the official [Complete Voloco Effects Guide](https://help.voloco.com/hc/en-us/articles/36347496022423-Complete-Voloco-Effects-Guide):

- **Pack names span all four working buckets at once**: genre-ish (`Modern Rap I`, `Modern Rap II`, `Jazz`), vibe (`Spooky`, `Expanse`), gag/character (`LOL` pack, `Talkbox Pack`, `8 Bit` pack), artist puns (`P-Tain` = T-Pain, `Bon Hiver` = Bon Iver's "Woods", `Duft Pank` = Daft Punk), and pure novelty (`Sitar Hero`, `Mega Maze`, `Wormhole`, `Super Bloop`).
- **Individual effect names**: `Big Chorus`, `Super Vocoder`, `8 Bit Chip`, `Hard Tune`, `Natural Tune`, `Clean`, `Expanse`, `Bon Hiver`, `Duft Pank`, `Wormhole`, `Mega Maze`, `Super Bloop`, `Sitar Hero`, `P-Tain`.
- **The guide itself navigates two ways**, which is the strongest single validation of the working split: a genre-first section ("What Genre Are You Singing?": Rap, Trap, Pop, R&B, Rock, Metal, Jazz, EDM) **and** a sound-first section ("Find an Effect by the Sound You Want") answering desire-line queries like *"I want a robot voice"*, *"I want to sound like T-Pain"*, *"I want a chipmunk/squeaky voice"*, *"I want a deep voice"*, *"I want my voice to sound like a choir/harmonies"*, *"I want to clean up my voice"*. All four axes exist — but as **parallel entry points over one flat effect pool**, not exclusive folders.

### Smule (karaoke app): short flat lists of evocative names; community adds its own vocabulary

Smule's official 2024 Audio FX announcement lists new effects as a **flat, ungrouped set of vibe/genre-evocative names** with prose guidance: `Old Soul` (classic soul, "Aretha Franklin or Amy Winehouse styles"), `Alchemist` ("a utility knife for your vocals" across any style), `Pro Studio` (successor to the long-running `Super Studio`), `Vibravox` (robotic Kraftwerk/Daft Punk vocoder), `New Wave` (late-70s/80s British chorus/phaser/doubling). Source: [blog.smule.com/sing-with-audio-fx-2024](https://blog.smule.com/sing-with-audio-fx-2024/). Older official FX spotlights include `Ricochet` ("a fast, short echo… give your voice the pop it deserves"), `Clear Verb`, `Center Stage` ([Smule on Facebook](https://www.facebook.com/Smule/posts/10160224086849284/)).

The Smule community forum (sing.salon) shows the names users actually say aloud: `Super Studio` (always abbreviated "SS" with numeric settings, e.g. "SS 15/25"), `Indie`, `Polish`, `SF Opera`, `Hype`, `Double You`, `Magic`, `Pop Star`, `Star Dust`, `Spotlight` — plus **"None/raw" as a first-class, requested choice** ("I prefer raw voice"). Source: [sing.salon "Voice Special Effects" thread](https://sing.salon/forums/topic/744-voice-special-effects/).

### DAW vocal-preset packs: genre as a *filter with counts* (a ready-made coverage map), vibe and artist as differentiators

At [vocalpresets.com](https://vocalpresets.com/) (representative commercial pack store):

- Individual preset naming follows three patterns side by side: **artist-style** ("Fivio Foreign Vocal Preset"), **vibe/style** ("Punchy Trap", "Dark & Moody Rap"), **plain genre** ("Drill").
- Bundles are themed by vibe: "The Dark Pack", "The Atmosphere Pack", "The Pop Starter Pack".
- The main browse axis is a **genre filter of 28 categories, each with a live count**: R&B (21), Trap (18), Hip-Hop (15), Pop (14), Drill (8), Dancehall (6), … Podcast (4), Lo-Fi (4), Jazz (3), Rock (3), Hyperpop (3), Phonk (3), Jersey Club (3), Reggaeton (3), EDM (3), Afrobeats (3), Reggae (3), Latin (3). That count-per-bucket view **is** the coverage map this ticket wants — an exact pattern worth copying.
- Note "Podcast" sitting inside the genre filter: a **use-case smuggled into a genre list**, evidence the buckets leak into each other in commercial practice too.

Around this market, the dominant marketing adjective is "radio-ready" (e.g. [Baywood Audio's Logic Pro preset guides](https://baywoodaudio.com/blog/best-vocal-presets-logic-pro-2026)). Apple ships stock vocal channel-strip presets in Logic/GarageBand but publishes no enumerated list anywhere official; the names people argue about online ("Platinum", "Radio") are almost all third-party pack names, not Apple's — evidence that the *market*, not the DAW, sets this vocabulary.

### Voice-changer apps: the gag bucket has its own mature taxonomy

[voicechanger.live/voices](https://voicechanger.live/voices) organizes character/gag voices into categories: **Robotic** (Robot, Alien, Broken AI, Dalek), **Pitch Shift** (Chipmunk, Pixie, Helium, Deep Voice, Little Kid, Old Man, Deep Narrator), **Monstrous** (Demon, Dragon, Venom), **Spacious** (Cave, Ghost, Stadium, Ethereal), **Utility** (Streamer Pro, Announcer, ASMR, **Crispy Mic**), **Lo-Fi** (Radio, Megaphone, Telephone, 8-Bit Hero, Military Radio, Walkie Talkie), **Special FX** (Possessed, Zombie, Creepy Doll), **Music/FX** (**Auto-Tune** — literally marketed "Sound like T-Pain… for singing, talking, Discord, and streams"; **Harmony** — tagged "Live singing and karaoke," "sing one line and bring your own backup voices into the room"; **Daft Punk**), **Character** (Darth Vader, Mickey Mouse, Anime Girl, Ghostface…). Two observations: the gag space already has consensus vocabulary (chipmunk/helium/deep/robot/radio/telephone/megaphone/cave), and the "Utility" bucket — *mic-quality upgrades as presets* ("Crispy Mic", "Announcer") — confirms that "make my mic sound better" is preset-shaped demand.

## Vein 2 — What users actually say

### Karaoke hosts and singers (Karaoke Scene KJ forum)

From the ["Karaoke and using reverb"](https://www.karaokescene.com/forums/viewtopic.php?f=1&t=21394) thread, verbatim:

- Requests are **literal and amount-focused**: mid-song, *"Give me some echo!"*; *"can I have 33% reverb.. and just 15% echo? Please?"*; *"Stronger voiced seasoned singers prefer lots more reverb and always ask for it."*
- Too much is described **spatially/materially**: "down a tunnel", "singing from down a tunnel or a well", "tin can and string", "sewer pipe reverb", "effects wet to the point of bell ringing", "waaaaay too much. It's criminal."
- Too little is described as **nakedness/repair**: "a straight dry mic", without it "you will hear a lot of stuff you don't want to hear — like the 'poppin' p's'", "totally eschewing reverb is just about as bad as using too much."
- The target is phrased as **subtlety**: "just enough reverb to accent a vocal, not actually 'hear' the effect"; "increase it until you just notice it, then back off a tad."

### Smule singers (sing.salon community)

Verbatim from the [same thread](https://sing.salon/forums/topic/744-voice-special-effects/) as above: "turn up the reverb when I sing… I would sound better"; "try to match your Echo to sound like the original" (fidelity-to-the-record as the goal); "the default Studio setting have too much reverb… produces also a lot of hiss sounds, especially with sss or fff components"; "I find Magic, pop star and star dust very bad"; "I prefer raw voice." A recurring community request is per-section effects ("apply an effect to one portion of the song and another to a different part").

### Artist-shorthand requests

- "T-Pain" is the universal shorthand for hard auto-tune, including at live karaoke: the r/karaoke thread ["Auto Tune T-Pain effect"](https://www.reddit.com/r/karaoke/comments/m73wvl/auto_tune_tpain_effect/) has hosts comparing gear ("The Helicon provides subtle auto tune, not as harsh as T-Pain") and singers asking whether you "actually have to sing bad" to get it. (Thread content verified via search snippets; Reddit blocks direct fetch.)
- Voloco built two pack names out of exactly this pattern (`P-Tain`, `Bon Hiver`), and voicechanger.live markets its Auto-Tune effect as "Sound like T-Pain."
- Noraebang culture treats echo as the default expectation, not an add-on — see [r/AskAKorean: "Why do microphones in Karaoke bars have an echo sound?"](https://www.reddit.com/r/AskAKorean/comments/1ojvsen/why_do_microphones_in_karaoke_bars_have_an_echo/).

### Gag/character request vocabulary

Consensus gag names across voice-changer and music apps: **chipmunk, helium, deep/narrator voice, robot, alien, demon/ghost, cave, radio, telephone, megaphone, walkie-talkie, Darth Vader, Mickey Mouse** (voicechanger.live); Rapchat's vocal FX list adds "Chopped & Screwed" alongside Radio and Chipmunk ([listing](https://www.ldplayer.net/apps/rapchat-auto-tune-music-maker-on-pc.html)); Smule's own `Vibravox` and Voloco's `Super Vocoder`/`8 Bit Chip`/`Sitar Hero` cover the vocoder/chiptune/novelty-instrument corner.

## Synthesis — does the genre / vibe / use-case / gag split survive contact?

**Verdict: all four axes are real and every product contains all four, but no product uses them as exclusive folders.** The consistent prior-art pattern is: **flavorful preset names (puns, vibes, characters) underneath, and facets/filters (genre, technique, vibe, gag) on top for retrieval.** Specifically:

1. **TC-Helicon** runs ~15 machine-assigned tags per preset, of which genre is just one. **VoiceLive Touch 2** adds a Genre *filter*. **Voloco**'s official help offers genre-first and sound-first ("I want a robot voice") navigation over one flat pool. **vocalpresets.com** makes genre the primary filter — with live counts, i.e. a coverage map, not a folder tree.
2. The only product with a single visible hierarchy (**Boss VE-5**) groups **technique/use-case first** ("harmony/doubling", "pitch correction", "special effects", "styles"), with genre names as leaf presets inside — the inverse of genre-first.
3. Genre lists leak: "Podcast" sits in vocalpresets.com's genre filter; genre alone can't differentiate ("Dark & Moody Rap" vs "Punchy Trap" vs "Drill" all exist because genre was insufficient).
4. Gag and mic-fix requests never carry a genre; users reach for characters (T-Pain, chipmunk, Darth Vader), materials (tin can, tunnel, sewer pipe), or repairs (poppin' p's, hiss, dry mic).
5. **One honest amendment to the working split**: "fix my mic / sound clean" is a distinct, high-frequency preset-shaped desire (Voloco `Clean`, Smule `Polish`, voicechanger `Crispy Mic`, KJ "dry mic"/"poppin' p's" complaints) that only survives the split if **use-case explicitly includes a cleanup/repair use-case**. Recommend naming it as a first-class member of use-case in the coverage map.

**Recommendation for the taxonomy design ticket:** keep genre / vibe / use-case / gag as the four **axes** (tags every preset can carry in combination, e.g. a "Radio Preacher" preset = gag + use-case + lo-fi vibe), render the coverage map as axis × preset-count (vocalpresets.com pattern), and treat any of the axes as a browsable filter rather than a folder. This preserves the working split as a coverage checklist while matching how every surveyed product actually organizes retrieval.

### Vocabulary worth stealing

| Concept | Prior-art names | Source |
|---|---|---|
| Lo-fi/lo-fi broadcast gag | Radio, Megaphone, Telephone, Walkie Talkie, 8-Bit | Boss VE-5 `RADIO`; voicechanger.live Lo-Fi; Voloco `8 Bit Chip` |
| Venue/space imaging | Arena, Cathedral, Stadium, Cave, Center Stage | Boss VE-5; voicechanger.live; Smule FX |
| Pitch gags | Chipmunk, Helium, Pixie, Deep Voice, Little Kid, Old Man | voicechanger.live Pitch Shift |
| Hard tune | T-Pain, Hard Tune, P-Tain, ElectricTune | r/karaoke; TC tag; Voloco; Boss VE-5 |
| Robot/synth voice | Robot, Super Vocoder, Vibravox, Daft Punk, Duft Pank | Boss VE-5; Voloco; Smule; voicechanger.live |
| Harmony stack | 5th/3rd Harmony, Double Voice, Four Voice, Unison, Big Chorus, Choir | Boss VE-5; Voloco; TC `Choir Enabled` |
| Grand/character vocals | Opera Queen, SF Opera, Bon Hiver, Old Soul | Boss VE-5; sing.salon; Voloco; Smule |
| Cleanup/repair | Clean, Polish, Crispy Mic, "poppin' p's" fix | Voloco; Smule/sing.salon; voicechanger.live; Karaoke Scene |
| Natural/none | Raw voice, None, Simple, Dry | sing.salon; TC tags (`Simple`, `Dry`) |
| Amount language | "more echo", "33% reverb… 15% echo", SS 15/25, wet/dry | Karaoke Scene; sing.salon; TC tags |
| Complaint metaphors (anti-presets) | tunnel, well, tin can and string, sewer pipe, bell ringing, hiss on sss/fff | Karaoke Scene; sing.salon |

### Counter-evidence against a strict four-way split (as folders)

- TC-Helicon's retrieval tags are technique-driven (harmony placement, doubling, ambience, tune) — a fifth, technical axis no user asks for by name but every taxonomy needs internally.
- Boss VE-5's visible hierarchy is technique-first; genre never gets to be a top-level group even in the one hierarchy that exists.
- The cleanup/repair bucket (see amendment above) doesn't fit genre/vibe/gag at all — it only lands in use-case by fiat, so say so explicitly in the map.
- Community practice treats "no effect" as a named choice ("raw voice", None) — the taxonomy needs an explicit "clean/natural" region or the map undercounts the most-requested preset of all.

## Source list

1. Boss VE-5 owner's manual (official PDF, Sound List): https://static.roland.com/assets/media/pdf/VE-5_OM.pdf
2. Boss VE-2 product page: https://www.boss.info/us/products/ve-2/
3. Boss VE-500 owner's manual (official PDF): https://static.roland.com/assets/media/pdf/VE-500_eng03_W.pdf
4. Boss VE-20 preset parameters (secondary, Scribd): https://www.scribd.com/doc/93045725/Boss-Ve-20-Preset-Parameters
5. TC-Helicon VoiceLive 2 Preset List (official doc, Yumpu mirror): https://www.yumpu.com/en/document/view/23164344/voicelive-2-preset-list-tc-helicon
6. TC-Helicon VoiceLive Touch 2 reference manual (Yumpu mirror): https://www.yumpu.com/en/document/view/24237092/voicelive-touch-2-reference-manual-english-tc-helicon
7. TC-Helicon VoiceLive Touch 2 review (Genre filter): https://community.absolutemusic.co.uk/entries/tc-helicon-voicelive-touch-2-review
8. Voloco Complete Effects Guide (official): https://help.voloco.com/hc/en-us/articles/36347496022423-Complete-Voloco-Effects-Guide
9. Smule Audio FX announcement (official blog): https://blog.smule.com/sing-with-audio-fx-2024/
10. sing.salon "Voice Special Effects" thread: https://sing.salon/forums/topic/744-voice-special-effects/
11. vocalpresets.com storefront: https://vocalpresets.com/
12. Baywood Audio (radio-ready vocabulary): https://baywoodaudio.com/blog/best-vocal-presets-logic-pro-2026
13. voicechanger.live voices page: https://voicechanger.live/voices
14. Karaoke Scene forums, "Karaoke and using reverb": https://www.karaokescene.com/forums/viewtopic.php?f=1&t=21394
15. r/karaoke "Auto Tune T-Pain effect": https://www.reddit.com/r/karaoke/comments/m73wvl/auto_tune_tpain_effect/
16. r/AskAKorean noraebang echo thread: https://www.reddit.com/r/AskAKorean/comments/1ojvsen/why_do_microphones_in_karaoke_bars_have_an_echo/
