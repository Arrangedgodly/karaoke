# QA-1 — Listening Protocol (user-judged audio quality)

Cycle-3 QA-1, per-effect acceptance on the fixed test vocal
(`assets/test-vocal.mp3`, 23.7 s, mono 48 kHz — TEST-1). Audio quality is
**user-judged** (same bar as cycle-2 QA-3): everything checkable without
ears has already been run and is summarized at the bottom; the objective
metric dump is [qa1-report.txt](qa1-report.txt).

## What these files are

Rendered **offline through the real production node code** by
[run-qa1.js](run-qa1.js): chains built through the real
`AudioGraph.buildGraph()` (factory param mapping, chainGate + −6 dB host
attenuator routing included), the real `gate-worklet.js` /
`autotune-worklet.js` driven per 128-sample block through the real async
addModule path of `node-gate.js` / `node-autotune.js`, and the real
`node-distortion.js` / `node-chorus.js` composites executed on a spec-shaped
offline Web Audio runtime. Two fidelity notes (full list in the harness
header): WaveShaper 4x oversampling is approximated by
linear-upsample + binomial decimator (Chrome's exact filter differs
slightly), and AudioParam ramps apply instantly (they are live-use click
safety, irrelevant to static renders).

- All files share identical routing, so **levels are comparable between
  files** (peaks −20 to −4 dBFS; the −6 dB host ceiling is in every path).
- Chorus files (05/06) are **stereo — use headphones**. All others mono.
- Autotune renders lag the dry file by the declared 20 ms engine latency,
  gate renders by 5 ms look-ahead — imperceptible, but a hair of lag when
  A/B-switching.

## How to listen

Play files in the order given, A/B-switching against the dry reference
(00). Same volume for everything; quiet-ish level is fine. Each section
ends with the **pass criteria** — your verdict is the acceptance record.

---

## 1. Noise Gate

| File | Settings |
|---|---|
| `00-dry.wav` | no effect (reference) |
| `01-gate-default.wav` | factory defaults: Thr −50 dB / Att 5 ms / Rel 150 ms / Floor −40 dB |
| `01b-gate-musical.wav` | Thr −45 / Att 5 ms / Rel 300 ms / Floor −40 (a musical setting for this vocal) |
| `02-gate-extreme.wav` | Thr −30 / Att 1 ms / Rel 10 ms / Floor −60 (legal-range stress) |

**Context**: this vocal's gaps are *true digital silence*, so at the shipped
default the gate is intentionally near-transparent on it (D1's "open
point"). The audible gating action on this asset lives in quiet syllables
and phrase tails, which is what 01b and 02 exercise.

**Listen for**:
- 01 vs 00 — attack consonants at phrase onsets must be fully intact
  (objective: onset-window delta 0.0 dB median — should sound identical).
- 01b — gentle tail shaping after phrases; natural.
- 02 — obvious, aggressive gating of quiet syllables: the stress demo.

**Pass criteria**:
1. 01 does no damage vs dry (no eaten onsets, no level loss, no pumping).
2. 02 gates clearly but with **no clicks, pops, or zipper noise** — the
   chopping is clean gain movement, not discontinuities.
3. 01b sounds natural — no chopped word-endings, no audible breathing of
   the gain.

---

## 2. Distortion

| File | Settings |
|---|---|
| `03-dist-default.wav` | factory defaults: Drive 25 % / Tone 70 % / Output −3 dB |
| `04-dist-extreme.wav` | Drive 100 % / Tone 100 % / Output 0 dB (max everything) |

**Listen for**:
- 03 vs 00 — subtle warmth/saturation; the vocal stays clear and spoken
  consonants stay intelligible.
- 04 — heavy saturated drive. The character to judge: it should be dense
  "analog-style" soft-clip saturation. Watch specifically for **aliasing
  buzz** — a metallic, inharmonic "fizz" riding on or above the tone — and
  for digital crackle. Some brightness harshness at max drive is expected
  (Tone is at max too); fizz/crackle is not.

**Pass criteria**:
1. 03 is audible but musical — a drive character you would consider
   shipping on a vocal.
2. 04 is obviously distorted, but the buzz quality reads as saturation,
   not digital aliasing fizz or crackle.
3. No dropouts or level instability in either file.

---

## 3. Chorus (stereo — headphones)

| File | Settings |
|---|---|
| `05-chorus-default.wav` | factory defaults: Depth 3 ms / Rate 1.5 Hz / Mix 30 % |
| `06-chorus-extreme.wav` | Depth 10 ms / Rate 8 Hz / Mix 100 % (legal-range stress) |

**Listen for**:
- 05 — subtle stereo widening + slow movement; the dry vocal core still
  solidly centered in the mono-sum sense.
- 06 — obvious, seasick warble with hard-placed L/R voices; this is the
  stress demo, extremes are supposed to sound extreme.
- **Mono-sum safety**: also play 05/06 through a mono speaker (or fold
  down): the voice must not vanish or comb into hollowness (objective:
  worst mono-sum dip −4.5 dB default / −8.4 dB extreme on 50 ms windows).

**Pass criteria**:
1. 05 gives width without uncomfortable warble and without losing the
   vocal's body.
2. 06 warbles hard but stays clean — no clicks at the LFO extremes, no
   dropouts, pitch sense survives to the degree a max-rate chorus allows.
3. Mono-folded, the vocal stays present in both (no cancellation holes).

---

## 4. Autotune (experimental)

| File | Settings |
|---|---|
| `07-at-default.wav` | factory defaults: C / Chromatic / Retune 0 ms / Mix 100 % |
| `08-at-rightkey-major.wav` | **A#** / Major / 0 ms / 100 % — the vocal's measured natural key (median f0 232.7 Hz ≈ A#3; histogram argmax A#) |
| `09-at-wrongkey-major.wav` | **E** / Major / 0 ms / 100 % — tritone off: the WRONG key on purpose |
| `10-at-slow-250ms.wav` | A# / Major / Retune 250 ms / 100 % — slow correction |

**Context**: the vocal is very in-tune (median snap residual 2.5 cents), so
07 is a *subtlety / no-damage* check, and even 08 only corrects the notes
that stray off A#-major. 09 is the demonstrator: it drags every note onto a
grid a tritone away (objective: 99.4 % of output-voiced frames land on
E-major degrees), which is what maximum correction demand sounds like.

**Listen for**:
- 07 vs 00 — nothing should be worse: no artifacts, no dropouts, no added
  coloration (correction is nearly a no-op on this vocal).
- 08 — natural overall; occasional gentle pulls of off-scale notes; on
  **sustained notes**: no warble, no crackle, no periodic level wobble.
- 09 — exaggerated hard-tune character (the "obviously autotuned" sound):
  judge whether the engine stays artifact-free while snapping every note
  ~a semitone; transitions should be steppy by design but clean.
- 10 — gentle corrective glide; more natural than 08's instant snap.

**Pass criteria**:
1. 07 introduces no artifacts vs dry.
2. 08 sounds natural — correction audible on stray notes, zero glitching
   on sustained notes.
3. 09 is clearly wrong-key snapped but clean — no dropouts, no granular
   garbage, no smearing beyond the expected hard-tune stepping.
4. 10 sounds like intentional slow correction, not drift.

---

## Objective results already checked (no ears needed)

From [qa1-report.txt](qa1-report.txt) (re-runnable: `node tests/qa-out/run-qa1.js`):

- **Bypass-clean**: chain-level Bypass with all four effects in circuit is
  bit-exact vs the raw source; gate Floor=0 bit-exact (mod the declared
  5 ms look-ahead); autotune Mix=0 bit-exact (mod the declared 20 ms);
  chorus Mix=0 bit-exact. Distortion has **no bit-exact neutral by design**
  (fixed tanh curve always in circuit, D3): Drive=0 measures −37.9 dBFS
  delta vs dry; its clean path is chain-level Bypass.
- **Param reactivity**: 14/14 params (4 gate, 3 distortion, 3 chorus,
  4 autotune) — min-vs-max renders differ clearly, incl. locally-acting
  params via worst-20 ms-window deltas (gate attack 39 dB, floor 60 dB
  windows; autotune key/scale/retune 1–3 dB windows + ~−33 dBFS total
  diffs).
- **Dropout/glitch proxies** (AT-0's methods): autotune right-key — worst
  voiced-window dip −2.4 dB, 0/1469 windows below −20 dB, HF ratio 0.97,
  spectral flux ratio 1.06 (spike's AT-0 numbers: −2.6 / 0 / 0.97 / 1.07).
  Gate default — onset delta 0.0 dB, 0 windows below −20 dB. Distortion
  default — 0 windows below −20 dB, flux ratio 1.01. Chorus mono-sum dips
  −4.5 dB (default) / −8.4 dB (extreme) with real stereo width (side/mid
  −9.4 dB default / −0.1 dB extreme).
- **Clipping**: no render peaks above 0 dBFS (12 files); distortion's
  unity Output guard verified at exactly 1.0 at max, destination peak
  −4.2 dBFS at max drive ("must not slam the chain" holds). Measured NOTE:
  post-tone-filter transient overshoot +1.8 dB at Drive/Tone max — Q=1
  lowpass step ringing on near-square shaper output (spec biquad physics,
  same in Chrome), caught downstream by the limiter + host ceiling.
- **Snap accuracy** (independent YIN oracle): right-key median residual
  2.3 c / 91.2 % within 10 c; wrong-key 99.4 % of frames on the wrong
  grid (input was 61.6 % by chance).
- **Cited, not re-run**: agent operability + capabilities badge =
  `tests/test-mcp-tools-cycle3.js` (85 checks); preset round-trip =
  `tests/test-preset-cycle3.js` (171 checks); palette/keyboard =
  `tests/test-palette-cards-cycle3.js` (152); node structure =
  `tests/test-{gate,distortion,chorus,autotune}-node.js`. Full suite at
  QA-1 time: **22/22 files, 1477 checks, all green.**

## Verdict (fill in)

- Gate: PASS / FAIL —
- Distortion: PASS / FAIL —
- Chorus: PASS / FAIL —
- Autotune: PASS / FAIL —
