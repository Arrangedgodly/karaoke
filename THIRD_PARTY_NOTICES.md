# Third-Party Notices

This project's own code is licensed under the MIT License — see [LICENSE](LICENSE).
The bundled third-party assets below are distributed under their own terms.

(Sortable.js 1.15.7, MIT, was vendored through 2026-08-31 for drag-and-drop
chain building. The palette drag was retired that day — click and keyboard
activation are the add verbs — and the vendored file was removed, so it is
no longer bundled with this project.)

## Tone.js 15.1.22 (MIT)

- **Vendored at:** `vendor/tone.min.js` (upstream `build/Tone.js` UMD bundle,
  license banner retained in the file header; sha256
  `e290952fa43d9a7a780182a83c6fccf44d79cb7ae2cba102ef1f2b9d98124e22`)
- **Upstream:** https://github.com/Tonejs/Tone.js (npm `tone@15.1.22`)
- **License:** MIT — Copyright (c) Yotam Mann. Full text:
  https://github.com/Tonejs/Tone.js/blob/dev/LICENSE.md

Used for the Tone-backed audio effects (pitch shift, tremolo, bitcrusher,
phaser — see `src/tone-adapter.js`), under the project's no-build-step
constraint. Unmodified upstream build.

## Reverb impulse response (CC0 1.0)

- **Bundled at:** `assets/ir/plate-vocal.mp3`
- **Source:** "IR Rollo Transparent Plate" by **Rollo145**, Freesound —
  https://freesound.org/people/Rollo145/sounds/322387/
- **License:** CC0 1.0 (public-domain dedication — copy, modify, distribute,
  even commercially, no permission required; no attribution obligation).
  License text: https://creativecommons.org/publicdomain/zero/1.0/

The bundled file is the public HQ MP3 preview of the same CC0-licensed sound
(1.01 s, stereo — matching the original WAV's documented properties),
downloaded without login rather than via the account-gated original download;
the substitution and its verification are recorded in
`docs/ultron/cycle-1/production-log.md` (AE-9) and researched in
`docs/ultron/cycle-1/research/rq3-reverb-impulse-response.md`. Attribution is
not legally required under CC0; it is given here as good practice.

## Test vocal (CC0 1.0)

- **Bundled at:** `assets/test-vocal.mp3`
- **Source:** "female singing name of love.wav" by **Ehved**, Freesound —
  https://freesound.org/people/Ehved/sounds/566926/
- **License:** CC0 1.0 (public-domain dedication — copy, modify, distribute,
  even commercially, no permission required; no attribution obligation).
  License text: https://creativecommons.org/publicdomain/zero/1.0/

The bundled file is the public HQ MP3 preview of the same CC0-licensed sound
(23.7 s, 44.1 kHz stereo), downloaded without login rather than via the
account-gated original WAV — the same substitution pattern as the reverb IR
above. It serves as the fixed test vocal (universal acceptance input + demo
reference) for cycle 3. Attribution is not legally required under CC0; it is
given here as good practice.

## Everything else

All other code, markup, styles, documentation, and assets in this repository
are the project's own work and fall under the repository [LICENSE](LICENSE).
