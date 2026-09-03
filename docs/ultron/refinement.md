# Refinement Checklist — Ultron Impeccable (approval mode)

Source: closing critique snapshot
[`.impeccable/critique/2026-09-03T02-09-28Z__index-html.md`](../../.impeccable/critique/2026-09-03T02-09-28Z__index-html.md)
(36/40, P0=0, P1=0 — trend 36 → 36 → 25 → 35 → 36). The snapshot is the
finding archive; this file is the execution queue.

**Approval-mode note (recorded substitution):** the approval gate probe
(AskUserQuestion, critique closing questions) returned no answer three
times this session. Per the session's autonomy directive the gate answers
below are SUBSTITUTED from PRODUCT.md, DESIGN.md, and the house test
culture — every entry is reversible on the user's word, and each entry's
approval is recorded as `substituted` until then.

| # | Command | Critique finding | Status |
|---|---------|------------------|--------|
| 1 | `$impeccable document` | [P2] README teaches retired interactions (cord reorder, free board, dropdown+Load, "Rock"/"Speech" chips, stale alt text) — heuristic 10 | done (substituted approval — gate probe unanswered; reversible) |
| 2 | `$impeccable harden` | [P2] Human undo invisible at the point of need (silent restores, keyboard-only, README documents it only for agents) — heuristic 3 | done (substituted approval — gate probe unanswered; reversible) |
| 3 | `$impeccable distill` | [P2] Simple's library decision point: 7 filter chips + search vs Advanced's search-only; two narrowing vocabularies — heuristics 4 + cognitive load | done (substituted approval — gate probe unanswered; reversible) |
| 4 | `$impeccable polish` | [P3] Alt+Arrow reorder aria-only (heuristic 6) + deck status sentence at 12px vs the distance-readability gate (heuristic 1) | done (approval — gate probe ANSWERED this entry; reversible) |

## Substituted gate answers (from the brief)

1. **README** — *Rewrite + CI lint.* docs/ACCEPTANCE.md and the WebMCP
   challenge contract make README the operator's manual; the house turns
   contracts into tests (`tests/test-token-contrast.js` precedent, which
   the critique itself cited as the model). A doc-verb lint makes drift
   unable to survive another UI generation.
2. **Undo affordance** — *Toast on human structural edits.* PRODUCT.md's
   own success definition ("understand what changed, undo it") fails for
   anyone who doesn't know Ctrl/Cmd+Z; the toast region and the one
   shared undo stack already exist from the 2026-09-02 harden round.
3. **Filter chips** — *Prune to 4–5 + unify the narrowing vocabulary.*
   The cognitive-load finding (≤4 options per decision point) outranks
   generation: the public tag vocabulary is append-only by design, so
   generated chips grow past the same guidance as coverage grows. The
   prune itself was decided by MEASUREMENT, not taste — see Entry 3's
   coverage table.
4. **P3s** — *Both in one round.* Each is a small, precedent-backed
   change (the register help line exists; the type register is tokens).

## Entry log

(workers append outcomes here)

### Entry 1 — README retired-interaction rewrite + doc-verb lint (2026-09-02)

- **Files changed:** `README.md` (stale passages + screenshot alt text
  rewritten to the shipped surface, operator voice and structure kept);
  `tests/test-readme-gestures.js` (new — zero-dependency doc-verb lint,
  auto-discovered by `tests/run.js`, on the `test-token-contrast.js`
  precedent).
- **Verified against source before writing** (never the README or the
  brief): `src/canvas.js` (drag-to-reorder by grip rail, Alt+ArrowLeft/
  Right keyboard twin, drawn chevron connectors, palette click-to-add +
  drag-to-place, width-only layout persistence), `src/presets-ui.js`
  (searchable preset list, Factory-by-category then Yours, per-row load,
  two-step "Confirm delete" with 5 s window), `src/simple-view.js`
  (PLAIN_FILTERS: All / Warm / Big echo / Deep voices / Robotic / Funny /
  Clean & clear; click-a-card-to-try; Previous/Next), `src/main.js`
  (Start in the top bar, spacebar bypass, device select),
  `src/meters.js` + `src/meter-taps.js` (MIC IN strip above the row, OUT
  strip below, watchdog with human-only Restore output),
  `src/factory-library-data.js` (33 presets; every README-cited name
  exists).
- **Checks run:** `node tests/test-readme-gestures.js` → 15 ok / 0 FAIL,
  exit 0; `node tests/run.js readme` → 1/1 file(s), 15 check(s) ok; full
  `node tests/run.js` → **47/47 file(s) passed — 5443 check(s) ok — all
  green**, exit 0. Flip-proofed on /tmp scratch copies (nothing left in
  the repo): reintroducing "Reorder by cord", "jack point", the
  "Rock"/"Speech" chip list, or "dropdown + Load" each flips the test to
  exit 1; the honest mic-picker "dropdown" prose does not false-positive.
- **Corrections the verification forced past the brief:** palette
  drag-to-place is LIVE in `src/canvas.js` (re-added in the 2026-09-01
  round; `index.html`'s "palette drag is retired" comment is the stale
  side) — the README now teaches click-to-add AND drag-to-place.
- **Flagged, deliberately not fixed here (outside the critique finding,
  no new claims permitted):** README does not yet document Copy-link
  preset sharing (`src/preset-link.js`); `docs/screenshot.png` pixels are
  one generation old (cord-era capture) — the alt text now describes the
  current surface per this entry's directive, and regenerating the image
  is a separate owner decision.

### Entry 2 — visible human undo: structural-edit toast (2026-09-03)

- **Finding addressed:** critique 2026-09-03T02-09-28Z P2 #2 — human
  undo worked (the 2026-09-02 one-shared-stack round) but was INVISIBLE
  at the point of need: silent entries, a keyboard-only entry point, and
  README prose that documented Undo only for agents. PRODUCT.md's
  "understand what changed, undo it" failed for anyone who did not know
  Ctrl/Cmd+Z.
- **Gate answer implemented (substituted, per this file's note):** a
  transient toast carrying the operator label plus an Undo key appears
  on human STRUCTURAL edits — add / remove / reorder / same-seat
  replacement, and preset try-loads (source `'preset'` = Try, Previous/
  Next, and the armed cold-face load) — reusing the existing
  `.agent-toast` machinery and the one shared undo stack. NOT on
  param-only commits, the per-effect IN/BYP key, or no-op candidates.
- **Files changed:** `src/chain-editing.js` (`humanEditAnnounces` +
  `chainCompositionChanged` decide announcement from the edit itself,
  next to the ONE label derivation; `pushHumanUndo` passes `announce`;
  HUMAN UNDO comment block extended); `src/agent-ui.js`
  (`announceHumanEdit` renders the entry's own label as a
  `data-human-edit` toast inside `pushUndo`; `isHumanToast` keeps
  foreign keys/recovery notes off the human card; contract block
  updated; toast-region aria-label 'Agent activity notifications' →
  'Change notifications'); `tests/test-human-undo.js` (section F: real
  agent-ui + real chain-editing over a minimal DOM — 23 new checks);
  `tests/test-undo-conflict-safety.js` (Part 2 of `chainEditCase` now
  finds the button-BEARING toast instead of assuming the newest toast
  carries the key — intent assertions unchanged); `DESIGN.md` (one
  sentence added to the Undo bullet: the visible entry point, its scope,
  and that restores stay silent); `README.md` (the "Two views →
  Advanced" list gains the nothing-is-a-one-way-door bullet; the undo
  invariant line now covers human structural edits and the shared
  Ctrl/Cmd+Z stack).
- **DESIGN.md amendment (surgical, disclosed):** the Components → Undo
  bullet gained one sentence recording the entry point. The SILENT-
  restore contract is unchanged and re-pinned by test F6: no 'Undone'
  annotation for human entries, the toast's Undo key never relabels
  (human entries skip the conflict gate, as before).
- **Contracts preserved:** `reportMutation` untouched (agent mutations,
  watchdog, refusals keep their semantics — no `agentui:mutation` fires
  for human edits, pinned F1/F5); restores route only through the
  guarded source:'undo' transaction (pinned F6: the rollback render went
  through ChainEditing and pushed nothing); one label vocabulary (the
  toast renders `entry.label`, pinned F1); no new CSS, no dialogs, no
  browser notification APIs, `src/mcp-tools.js` untouched;
  `tests/test-mutation-undo.js` unchanged and green.
- **Checks run:** `node tests/test-human-undo.js` → ALL OK (25 new F
  checks); full `node tests/run.js` → **47/47 file(s) passed — 5466
  check(s) ok — all green**, exit 0 (baseline before the change:
  47/47, 5443). `node tests/test-readme-gestures.js` still passes
  (README edits add verbs, remove none). Detector:
  `node …/detect.mjs --json src/agent-ui.js src/chain-editing.js` →
  `[]` (no findings). Flip-proofed on /tmp scratch copies (nothing left
  in the repo): announcing param tweaks flips F2/F3/F4 to FAIL;
  annotating human restores flips F6; allowing foreign keys on the
  human card flips F7/F8.
- **Disclosure — shared-region label:** the toast region's aria-label
  changed from 'Agent activity notifications' to 'Change notifications'
  because an operator's own "Add Reverb" card must not be announced as
  agent activity; agent toast content, ordering, bezels, and undo
  semantics are untouched.

### Entry 3 — chip prune + search-vocabulary unification (2026-09-03)

- **Finding addressed:** critique 2026-09-03T02-09-28Z P2 #3 — Simple's
  Sounds library offered 7 filter chips plus search while Advanced's
  presets panel offered search only: two narrowing vocabularies forcing
  relearning across views, and 7 chips exceeding the
  ≤4-options-per-decision-point guidance (heuristics 4 + cognitive
  load).
- **The prune, decided from data (not taste):** each filter's match
  count was computed over the full 33-sound factory library
  (src/factory-library-data.js loaded in a vm; the tag predicates run
  verbatim from PLAIN_FILTERS's definitions):

  | Chip | Catch (of 33) | Verdict |
  |---|---|---|
  | Funny | 10 | kept (broadest) |
  | Big echo | 7 | kept |
  | Warm | 5 | kept |
  | Clean & clear | 5 | kept |
  | Deep voices | 4 | cut (tied-lowest) |
  | Robotic | 4 | cut (tied-lowest) |

  No survivor's catch is a strict subset of another's (checked
  pairwise), so no redundancy tiebreak applied; keeping everything at
  ≥5 and cutting both 4s needs no tie-break at all. The row is now
  All + 4 content chips. The cut sounds stay findable by SEARCH in both
  views ("robot" hits Robot Usher's name and gag:robot tag; "deep"
  hits Deep Narrator's and Demon Growl's names) — the README now says
  so where it teaches the chips. Surviving queries' semantics are
  untouched (#43/#48 contract: filters remain named queries stored
  nowhere on presets); activeFilter()'s existing fallback to 'All'
  covers any stale id.
- **The vocabulary unification, verified against source first:** Simple's
  search matches name + description + PUBLIC tags (technique axis
  stripped); Advanced's renderPresetList matched name + node types +
  category + ALL tags (technique included) and collected descriptions
  it never matched. Two changes in src/presets-ui.js: (a) the factory
  DESCRIPTION joined the haystack — a Simple word like "arena" (Big
  Room's description) now finds the sound in Advanced too; (b) the
  technique: axis is now stripped from Advanced's tag fodder exactly as
  simple-view.js's publicTags strips it, closing a small leak of the
  settled-#43 internal axis and making the shared tag vocabulary
  identical. Advanced keeps its own expert fields (node TYPE strings,
  category) — one-way unification, no chips added to Advanced (the
  rejected option).
- **Files changed:** `src/simple-view.js` (PLAIN_FILTERS pruned to
  All/Warm/Big echo/Funny/Clean & clear; regrouping comment extended
  with the 2026-09-03 measurement table and the search-reachability
  note); `src/presets-ui.js` (description in the search haystack,
  technique-axis strip, JSDoc updated); `index.html` (the wayfinder-#48
  mount-point comment's chip list, comment-only); `README.md` (chip
  parenthetical + one search clause); `CONTEXT.md` (the Plain-filter
  entry's example "Speech" → "Clean & clear" — Speech never shipped in
  the current set); `tests/test-view-switch.js` (E1/E2 chip-count
  indexes and reasoning; section K re-pinned to the pruned row and
  gains K4, the prune's own guard: cut chips stay cut and every
  survivor's real catch ≥ each cut chip's recomputed would-be catch);
  `tests/test-readme-gestures.js` (SHIPPED_FILTERS pruned;
  REQUIRED_FILTERS Warm+Robotic → Warm+Funny with the reasoning
  recorded — Robotic no longer exists, Funny is the broadest survivor
  and the whole-gag-axis chip); `tests/test-surface-polish.js`
  (section A stub gains tags + listDetailed; A4 pins the unification:
  a description-only word finds the row, a public tag word still
  reaches tagged presets, and "pitch" — a technique-axis-only word —
  matches nothing).
- **A11y floor:** chips remain real buttons with aria-pressed
  semantics; chip rendering, styling, and hit geometry untouched
  (removal of entries only — nothing about the surviving chips'
  rendering changed).
- **Checks run:** `node tests/test-view-switch.js` (incl. new K1/K4)
  PASS; `node tests/test-readme-gestures.js` PASS;
  `node tests/test-surface-polish.js` (incl. new A4) PASS; full
  `node tests/run.js` → **47/47 file(s) passed — 5470 check(s) ok —
  all green**, exit 0 (one earlier full run tripped the AT-1 autotune
  p99-CPU timing check at 125.3% of quantum under suite load — it
  passes standalone and on the re-run; machine-timing flake, untouched
  by this diff). Detector
  `node …/detect.mjs --json src/simple-view.js src/presets-ui.js` →
  `[]`; on `index.html` it reports 4 advisory findings that predate
  this diff (verified by re-running it on a before-edit copy of
  index.html placed in-repo for asset resolution, then deleted) — no
  NEW findings introduced.
- **DESIGN.md:** amended nothing — its Simple-library prose never
  names the filter chips (the "Chips" section is the Advanced palette,
  untouched by this round).

### Entry 4 — Alt+Arrow discoverability + deck sentence distance step (2026-09-03)

- **Findings addressed:** critique 2026-09-03T02-09-28Z P3 #4 (the
  Alt+ArrowLeft/Right board reorder existed only inside the grip's
  aria-label — invisible to sighted keyboard operators, heuristic 6) and
  P3 #5 (the deck's status sentence rendered at the 12px value tier, the
  smallest prose on the deck, against the product's distance-readability
  gate, heuristic 1) — plus the comment-hygiene fold-in entry 1's worker
  flagged.
- **Gate answers (ANSWERED — the first probe this session to return;
  both recommendations taken as offered):** (1) the sentence cap grows
  20rem → 22.5rem with the tier step, keeping "every WHAT-HAPPENED
  sentence reads in full" true at 13.6px while still bounding the flex
  base; (2) the hint's words are the aria-label's own, verbatim, shown
  on grip focus and popped on blur via the existing preview stack.
- **Finding A (src/canvas.js):** a single-sourced `REORDER_KEY_HINT`
  constant ('Alt+Left or Alt+Right reorders it in the chain') now feeds
  BOTH mouths — the grip's aria-label is built from it, and focusing the
  grip pushes ONE micro-hint onto the register's help line (the
  established 12px teaching surface) through `showRegisterPreview`, with
  blur popping via `hideRegisterPreview` — the SAME nested preview stack
  card and param-row hovers use, so the hint composes with them instead
  of fighting them (verified live: hover-under-focus layers correctly in
  both directions). Repeated Alt+Arrow presses keep the hint on the
  line: each accepted render unwinds the stack (`resetRegisterPreviews`)
  and the follow-focus on the rebuilt grip re-pushes it. No new chrome,
  no DOM tooltips, no dialogs; the hint commits nothing and never blinks.
- **Finding B (styles/main.css):** `.status` font-size
  `var(--type-value)` → `var(--type-register)` (12 → 13.6px — the
  sentence is the operator's primary verbal status from across a dark
  room; distance readability is a functional a11y requirement);
  `.topbar-status` max-width 20rem → 22.5rem ('Microphone unavailable
  on this page.' measures 338px in full at the new size); `.status-detail`
  PINNED at `var(--type-value)` so the demoted technical footnote keeps
  its rank below the sentence (same 12px as its .start-hint host — one
  footnote size, two hosts); RATE/LAT/NODES readouts untouched at 12px;
  the `.system-etch` and BYPASS-loudness comments updated to the new
  enumeration.
- **DESIGN.md amendments (surgical, disclosed):** Typography's
  Register-line bullet records the sentence's step and why; the
  Value-tier bullet adds the footnote and names the sentence as the one
  prose exception; the Layout System-deck bullet, the Navigation etch
  bullet, and the "machine speak twice" Don't each now read
  "readouts/values 12px, sentence at the register tier". Frontmatter
  untouched (no palette/size tokens changed).
- **Fold-in (comment-only, no behavior change):** `index.html`'s
  empty-hint comment now quotes the real live copy ("Click an effect to
  add it at the end — or drag one here to place it") and states BOTH
  palette verbs — click AND drag-to-place, re-added 2026-09-01 — instead
  of asserting "palette drag is retired"; the same stale parenthetical
  inside `src/canvas.js`'s onEngineStarted comment corrected with it.
- **Verification (live, deterministic — fake-mic Playwright at
  /tmp/vox-verify/entry4-*.js, house server on :8000):** sentence
  computes 13.6px and readouts 12px in both views; the single-row deck
  at 1600px measures exactly 64px (4rem — no layout pump); zero
  horizontal overflow at 1280 and 390; the <900px compact grid holds
  (BYPASS in the top rows, the etch on its own full-width row below);
  the longest WHAT-HAPPENED sentence reads IN FULL (scrollWidth 338 =
  clientWidth 338 under the 360px cap); the grip focus hint verified in
  the real browser; zero console errors/pageerrors across the walk.
- **Contrast (house measured-pair discipline; 13.6px/700 is below the
  14pt-bold large-text bar, so the 4.5 floor still applies):** sentence
  inks on the etch ground #0b0c10 — print 7.87 (Stopped), print-hi 12.42
  (Live), red-edge 4.99 (Bypassed), status-error 7.97 (error), footnote
  7.87 at 12px. All AA with margin; values match DESIGN.md's existing
  records (the size step changed no ink, and larger size only relaxes
  nothing here).
- **Flagged, deliberately not fixed (outside the finding,
  pre-existing):** on a 390px ADVANCED deck the etch's status slot is
  squeezed to ~67px by the RATE/LAT/NODES group, so the sentence
  ellipsizes there — A/B measured IDENTICAL truncation at 12px (187 >
  67) and 13.6px (207 > 67), so this round did not introduce it; Simple
  (the default view, readouts hidden) reads "Bypassed — effects off" in
  full at 390 (207 = 207). Also unchanged by design: mouse-entering a
  card while its grip is focused temporarily layers the card's hover
  preview over the hint until the pointer leaves — the shipped
  hover-owns-the-register discipline.
- **Tests:** `tests/test-order-focus-a11y1.js` new section E (12
  checks: aria/hint single source, teach-on-focus, restore-on-blur,
  hover composition both directions, no stale snapshot across the
  Alt+Arrow accepted re-render, re-teach on follow-focus);
  `tests/test-two-deck-stack.js` section E gains 6 checks (sentence at
  0.85rem, register size-role parity, readouts one tier below, footnote
  pinned 0.75rem, cap 22.5rem, BYPASS loudness floor). Full
  `node tests/run.js` → **47/47 file(s) passed — 5488 check(s) ok — all
  green**, exit 0 (entry-3 baseline: 47/47, 5470).
- **Detector:** `detect.mjs --json index.html src/canvas.js
  styles/main.css` → 12 findings, ALL pre-existing, zero NEW from this
  diff: index.html's 4 are the advisories the closing critique itself
  judged false positives against DESIGN.md's documented exceptions;
  styles/main.css's 8 verified pre-existing by re-running the detector
  on a before-edit reconstruction of this round's declarations placed
  in-repo for asset resolution (8 before = 8 after; temp copy deleted);
  src/canvas.js → no findings.
