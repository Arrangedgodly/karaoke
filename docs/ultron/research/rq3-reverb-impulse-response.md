# RQ-3: Reverb Node Impulse Response Selection

## Question

Which specific free, redistributable, appropriately-licensed impulse-response (IR) file(s) should be bundled with the Node-Based Web Audio Chain Builder for the Reverb node (built on `ConvolverNode`), and what exactly are the licensing/attribution requirements?

**Affected task IDs:** AE-9 ("Reverb node factory") — blocked until this is resolved.

## Constraints & evaluation criteria

1. **License must unambiguously permit redistribution/bundling** inside a distributed, static-hosted client-side app — not just personal/private use, and not just "use to process audio once." The file itself will ship as a static asset served to every visitor.
2. **Small file size** — this is a "build fast," fully static-hosted site; every KB is part of the page-load budget. Target: well under 1 MB per bundled IR, ideally under 500 KB.
3. **Vocal-appropriate character** — small-to-medium room/plate/hall, not a cavernous cathedral, not a novelty/special-effect space (parking garage, cave, "deep space," etc.).
4. **Currently accessible** — the source must actually be reachable today (2026-08-26), not a dead/parked domain, since a research finding pointing at a dead link is useless to AE-9.
5. **WAV/PCM format** preferred for guaranteed `decodeAudioData` compatibility across browsers without codec ambiguity.

## Options considered

| # | Candidate | Source | License (verbatim source) | Redistribution in a bundled app? | Size / format | Vocal suitability |
|---|---|---|---|---|---|---|
| 1 | **"IR Rollo Transparent Plate.wav"** by user *Rollo145* | [freesound.org/people/Rollo145/sounds/322387/](https://freesound.org/people/Rollo145/sounds/322387/) | **CC0 1.0** ("You can copy, modify, distribute and perform the sound, even for commercial purposes, all without asking permission.") | **Yes, unambiguously.** CC0 is a public-domain dedication; no attribution, no share-alike, no field-of-use restriction. | WAV, 48 kHz / 24-bit, **stereo**, **284.9 KB**, ~1.01 s duration | **High.** Creator's own description: emulates an EMT plate "commonly used for vocal processing." Tagged `vocal-plate-reverb`. Purpose-built for exactly this use case. |
| 2 | **"Impulse Response Church"** by user *jmuehlhans* | [freesound.org/people/jmuehlhans/sounds/220752/](https://freesound.org/people/jmuehlhans/sounds/220752/) | **CC0 1.0** (same terms as above) | **Yes, unambiguously.** | WAV, 44.1 kHz / 16-bit, **mono**, **447 KB**, 5.16 s duration | **Medium-low.** Recorded in St. Carolus Church (Karlskirche), Vienna; measured RT60 ≈ 5.0 s — this is the "huge cathedral" character the project explicitly wants to avoid for a default vocal reverb. Included for completeness, not recommended as primary. |
| 3 | **Voxengo "Free Impulse Responses" (IM Reverbs pack)** | [voxengo.com/impulses/](https://www.voxengo.com/impulses/) | **Proprietary free license** (Aleksey Vaneev, verbatim quoted in Evidence below) | **Conditionally yes.** Redistribution of the files "in whole or in part" is allowed only if: (a) the copyright notice + full list of conditions accompany the copy, (b) files are unaltered, (c) **no charge** is associated with the distribution, and (d) ownership is acknowledged. Our app is free/static with no paywall, so bundling one unaltered file with a visible credit line satisfies this. Selling the app or gating the IR behind payment would violate it. | Zip is 6.9 MB for 40+ IRs combined (WAV, 44.1 kHz/16-bit); a single extracted IR is roughly 100–300 KB depending on length | **Medium, unverified by ear.** Pack includes room-scale options (e.g. "Trig Room," "Small Drum Room") that are plausibly vocal-appropriate by name, but many entries are halls/churches/novelty spaces (Musikvereinsaal, Parking Garage, Deep Space) that are not. **I could not listen to the audio** — picking a specific file from this pack needs a human listening pass before shipping. |
| 4 | **EchoThief Impulse Response Library** | [echothief.com/downloads/](https://www.echothief.com/downloads/) | Informal license (verbatim, from [EchoThief License PDF](https://www.cs.bu.edu/faculty/snyder/cs583/Homeworks/ImpulseResponses/EchoThiefImpulseResponseLibrary/EchoThief%20License.pdf)): *"You are welcome to use the EchoThief Impulse Response Library to create derivative work (such as convolving it with other sounds to create reverberation). If you would like to use it in any other way, let's talk."* | **AMBIGUOUS — flagged, not recommended.** This text grants a right to *use the library to convolve sounds* (i.e., process audio through it), which is different from a right to **redistribute the raw IR file itself as a bundled static asset** that every visitor downloads. Shipping the WAV file in the app's codebase is arguably "another way" of using it that the license explicitly says to ask about first. No explicit commercial/redistribution grant exists anywhere on the site. | Not verified (bulk ZIP only; no per-file size shown on the page) | Library is well-regarded and spans "caves, skateparks, stairwells, glaciers, fortresses" — mostly large/novelty spaces, not a natural vocal-plate/small-room match either. |

**Also checked and disqualified / excluded:**

- **OpenAIR / OpenAIRlib (University of York, "Open Acoustic Impulse Response Library")** — historically the most-cited free CC-licensed academic IR collection. As of **2026-08-26**, `https://openairlib.net/` returns a **hosting-account-suspension error page** ("This Account has been suspended"), not the library. The University of York's own project page (`york.ac.uk/.../open-acoustic-impulse-response-library/`) still links out to `openairlib.net` as the access point but the site itself is down. **Disqualified for now: not currently accessible**, so its license terms (Creative Commons, per-file) cannot even be re-verified today, let alone used to source a download. Worth re-checking in the future if the site comes back.
- **Samplicity "Bricasti M7" Impulse Response Library** — free, well-known pack, but distributed as donation-ware ("NewconomyWare") under a restriction that IRs "not be included in any commercial product," per the Bricasti-imposed condition reported by multiple secondary sources. That restriction is exactly the kind of ambiguous/restrictive term this research is told to flag and avoid. **Excluded.**
- **"MTU" (Michigan Tech) impulse response library** — named in the original research prompt as a lead to check; I could not find any such currently-existing, citable resource under that name via direct search. Likely stale/misremembered; **dropped as a candidate**, no live source found.

## Recommendation & rationale

**Bundle "IR Rollo Transparent Plate.wav" by Rollo145, from Freesound.org, CC0 1.0 licensed:**

- Direct file page: **https://freesound.org/people/Rollo145/sounds/322387/**
- Pack context: https://freesound.org/people/Rollo145/packs/18104/

Rationale:
1. **License is the cleanest possible outcome.** CC0 1.0 is a public-domain dedication — no attribution required, no share-alike, no non-commercial clause, no redistribution conditions. It is explicitly safe to embed as a static asset in a shipped, redistributed, even commercial app. There is zero ambiguity to flag.
2. **Purpose-built for this exact use case.** The creator's own description states it emulates an EMT plate reverb "commonly used for vocal processing" — this is a domain match, not a repurposed general-purpose IR.
3. **Tiny footprint.** 284.9 KB for a stereo, 48 kHz/24-bit WAV comfortably clears the "avoid huge multi-megabyte IR files" constraint with headroom to spare for a static, fast-loading page.
4. **Source is live and stable.** Freesound.org is a large, long-running, actively maintained platform (not a personal site at risk of disappearing), which reduces the "currently-accessible" risk that disqualified OpenAIR.

**Optional secondary/stretch option for AE-9** (only if the Reverb node factory wants more than one preset, e.g. a "Plate / Room / Hall" dropdown): pull one additional small-room IR from the Voxengo pack (`voxengo.com/impulses/`) under its documented conditional-redistribution terms — but this needs a human to actually listen to candidate files first (I have no audio-playback capability), and the chosen file must ship with a visible attribution line per license clause 4(a). Do not add a second preset without that listening pass.

Do **not** use EchoThief or Samplicity IRs without first getting explicit written permission from the respective rights holder, given the ambiguity/restriction flagged above.

## Evidence

All sources fetched and license text confirmed directly against primary pages on **2026-08-26**.

- **Rollo145 "IR Rollo Transparent Plate.wav"** — https://freesound.org/people/Rollo145/sounds/322387/ — license shown on page: *"Creative Commons 0 License — You can copy, modify, distribute and perform the sound, even for commercial purposes, all without asking permission."* Format WAV, 48000 Hz, 24-bit, stereo, 284.9 KB, duration 0:01.010.
- **jmuehlhans "Impulse Response Church"** — https://freesound.org/people/jmuehlhans/sounds/220752/ — same CC0 1.0 terms. WAV, 44100 Hz, 16-bit, mono, 447.0 KB, duration 5.158 s, RT60 ≈ 5.0 s (church).
- **Voxengo Free Impulse Responses** — https://www.voxengo.com/impulses/ — full verbatim license text captured:
  > "By downloading and using provided impulse files you signify acceptance of the following terms and conditions: 1. All copyrights to these impulse files are exclusively owned by the Distributor - Aleksey Vaneev... 2. Permission is granted to anyone to use these impulse files royalty-free for any purpose, including commercial usage. 3. You may not sell these impulse files or earn any direct or indirect profit from their distribution. 4. You may not copy and distribute these impulse files in whole or in part unless: a) the copyright notice and this list of conditions appear on all copies; b) copies are complete and unaltered with all messages intact; c) no charge is associated with the distribution of such copies; and d) any distribution made by you hereunder is expressly made subject to an acknowledgment... that Aleksey Vaneev retains exclusive ownership... 5. THESE IMPULSE FILES ARE PROVIDED 'AS IS' WITHOUT WARRANTY OF ANY KIND..."
- **EchoThief** — downloads page https://www.echothief.com/downloads/ and license PDF https://www.cs.bu.edu/faculty/snyder/cs583/Homeworks/ImpulseResponses/EchoThiefImpulseResponseLibrary/EchoThief%20License.pdf — full text captured: *"You are welcome to use the EchoThief Impulse Response Library to create derivative work (such as convolving it with other sounds to create reverberation). If you would like to use it in any other way, let's talk. You can reach me at chris@superhoax.com."* (Note: this PDF is a hosted mirror on a Boston University course page, not EchoThief's own site, but it is the license document EchoThief's own site directs to; content matches what's cited elsewhere for this library.)
- **OpenAIR / openairlib.net** — https://openairlib.net/ fetched 2026-08-26, returned a hosting suspension error page, not library content. University of York project page https://www.york.ac.uk/physics-engineering-technology/research/communication-technologies/projects/open-acoustic-impulse-response-library/ still lists openairlib.net as the access URL but provides no alternate mirror.
- **Samplicity Bricasti M7** — commercial-use restriction reported via secondary sources (rekkerd.org, KVR Audio forum, gearspace.com); no primary Samplicity page was reachable/verifiable with a clean primary-source license statement during this research pass, which is itself part of why it's excluded (can't independently verify terms even setting the restriction aside).

## Tradeoffs, risks, confidence

- **Confidence: High** on the primary recommendation (Rollo145 CC0 plate IR). CC0 is about as legally unambiguous as a license gets, the file was fetched and its metadata read directly from Freesound's own page, and the creator's stated intent matches the use case exactly.
- **Risk — audio character unverified by listening.** I read metadata/descriptions but cannot play audio. The recommended file is described by its creator as a vocal-appropriate 80s-style EMT plate emulation with a "vocal-plate-reverb" tag, which is strong signal, but whoever implements AE-9 should do a quick listening pass before finalizing (5 minutes of work, not a blocker for planning).
- **Risk — Freesound requires a free account login to download** the actual WAV file (confirmed via Freesound's own FAQ/community threads). This is a one-time manual step for whoever implements AE-9 (or any team member with a Freesound account) — not a licensing issue, just a practical fetch step. Once downloaded, the file can be committed directly into the repo/static assets; the CC0 license places no restriction on then serving it from the app's own domain.
- **Flagged ambiguity — EchoThief.** Explicitly called out per the research brief: its license does not clearly extend to redistributing the raw IR file as a bundled static asset. Not recommended without direct clarification from the rights holder.
- **Flagged inaccessibility — OpenAIR.** Formerly the strongest CC-licensed academic option by reputation, but the live site is down as of the access date. Cannot be used today regardless of its historical licensing terms, since terms can't be re-confirmed and no download is currently possible.
- **Minor open question.** If AE-9 wants multiple reverb character presets (not just one default), the Voxengo pack is a legitimate second source under its documented conditional-redistribution terms, but selecting the specific file(s) needs a human listening pass I could not perform — flagged as a to-do rather than treated as resolved.

## Implementation consequences for AE-9

1. **Fetch:** Download `IR Rollo Transparent Plate.wav` from https://freesound.org/people/Rollo145/sounds/322387/ (requires a free Freesound login to download — use any team member's account; the license itself imposes no such requirement, that's purely Freesound's site mechanic).
2. **Bundle as-is:** WAV, 48 kHz/24-bit stereo, 284.9 KB. No format conversion is required for `ConvolverNode` — `AudioContext.decodeAudioData()` decodes WAV/PCM natively across all evergreen browsers, and the Web Audio API automatically resamples the decoded `AudioBuffer` to match the live `AudioContext`'s sample rate at render time if they differ (e.g., a context running at 44.1 kHz will correctly play back a 48 kHz-sourced buffer). No manual resampling or channel-count conversion is needed; a stereo IR works directly with `ConvolverNode` and produces a true stereo reverb tail.
3. **Suggested storage:** commit the WAV into the app's static asset folder (e.g., `/assets/ir/plate-vocal.wav` or similar, per the app's existing asset conventions) and reference it via `fetch()` + `decodeAudioData()` when constructing the Reverb node's `ConvolverNode.buffer`.
4. **Attribution text required: none legally** (CC0 requires no credit), but as good practice, consider a short credits line somewhere in the app (e.g., an "About/Credits" section) such as: *"Reverb impulse response: 'IR Rollo Transparent Plate' by Rollo145, freesound.org, CC0 1.0."* This is optional, not a license obligation.
5. **If a second/third preset is added later:** do not blindly copy a Voxengo file in without (a) a listening pass to confirm vocal suitability and (b) adding the required copyright-notice + conditions text somewhere reachable in the app (e.g., credits section), since that license — unlike CC0 — has real conditions attached.
6. **Do not bundle EchoThief or Samplicity IRs** under the current terms without first getting explicit redistribution permission in writing from the rights holder.

## Decision priority/status

- **Priority:** P1
- **Status:** proposed — awaiting user approval. Not marked committed by this research pass.
