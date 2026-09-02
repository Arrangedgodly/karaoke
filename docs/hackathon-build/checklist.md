# Build checklist

Status: Draft awaiting Grady's workload gut-check.

## Build preferences

- **Build mode:** Autonomous. Codex completes consecutive machine-verifiable tasks without re-asking how to implement them.
- **Comprehension checks:** N/A. Explain only decisions that change product behavior, release scope, or safety.
- **Git:** Use small reviewed commits as revert points after items 1, 6, 9, and 11. Commit only files belonging to the completed item. Do not push until the production task.
- **Verification:** Yes. Pause for Grady at item 6 for the preset-transfer interface, items 8 and 9 for physical audio decisions, and item 11 for the deployed WebMCP judge path. Automated checks do not need approval when green.
- **Check-in cadence:** Speed-run. Report at the named pauses, on a real blocker, or when a failed check requires a product choice.
- **Wow moment:** A home karaoke host gives one plain-language request, watches and hears a complex safe chain appear, then saves and downloads the result as a portable preset.
- **Release boundary:** Keep the current interface, audio engine, ten WebMCP tools, and human safety controls. Do not add an in-app model, preset URLs, accounts, cloud storage, new effects, automatic watchdog recovery, or another redesign.

## Checklist

- [ ] **1. Establish the release baseline and rights files**
  Spec ref: `spec.md > Risks and verification > Automated gate`
  What to build: Restore trustworthy Git inspection with Grady's approval if the safe-directory ownership check still blocks it. Record the current diff without overwriting unrelated work, run the full regression suite, add the complete upstream MIT text at `vendor/Tone.js.LICENSE.txt`, and verify `THIRD_PARTY_NOTICES.md` still names Tone.js 15.1.22 and its role.
  Acceptance: The repository diff is inspectable, all existing tests pass, the vendored Tone banner points to a real full license file, and no application behavior changes in this item.
  Verify: Run `git status --short`, `node tests/run.js`, and `rg -n "Tone.js|15.1.22|MIT|Tone.js.LICENSE.txt" vendor/tone.min.js vendor/Tone.js.LICENSE.txt THIRD_PARTY_NOTICES.md`.

- [ ] **2. Expose one pure preset-policy validator**
  Spec ref: `spec.md > Architecture > Preset file transfer`
  What to build: Add tests first, then expose `McpTools.validatePresetCandidate(nodes)` as a non-mutating helper built from the existing host-owned scan, parameter policy, and full-chain rules. Return `{ ok: true, nodes }` for an unchanged safe candidate or `{ ok: false, error }` with the existing refusal fields. Reject candidates that require clamping. Keep `getDefs()` and the ten registered tool definitions byte-for-byte equivalent in name, order, schema, and annotations.
  Acceptance: Safe preset nodes pass unchanged. Missing or misplaced limiter, unsafe gain, unknown or host-owned parameters, excessive node counts, and clamp-requiring values fail with no graph, canvas, preset, storage, agent feedback, or Undo side effect. Exactly ten tools still register.
  Verify: Run the new focused policy tests, `node tests/run.js safety`, `node tests/run.js tool-registration`, and then `node tests/run.js`.

- [ ] **3. Build deterministic preset downloads**
  Spec ref: `spec.md > Data contracts and state ownership > Portable preset file`
  What to build: Create the download half of `src/preset-transfer.js`. Load only a saved personal preset from `PresetStore`, serialize it through `PresetSchema`, enforce the exact three-key envelope, format JSON with two spaces, sanitize the filename, create an `application/json` Blob, trigger `<safe-name>.voxchain-preset.json`, and revoke the object URL. Keep file and browser adapters injectable so Node tests can inspect the bytes without launching a download.
  Acceptance: The exported file round-trips to the same name, ordered nodes, IDs, types, and parameter values. It contains no layout, microphone, audio, autosave, account, agent, browser, or timestamp data. Missing presets and browser download failures produce truthful errors.
  Verify: Run `node tests/run.js preset-transfer` and inspect one generated fixture as text for the exact envelope and filename.

- [ ] **4. Build hostile-safe preset import parsing**
  Spec ref: `spec.md > Data flow > Preset sharing flow`
  What to build: Add the import parser to `src/preset-transfer.js`. Reject files over 65,536 bytes before reading. Parse JSON, reject unknown top-level fields, deserialize through `PresetSchema`, detect duplicate node IDs and unavailable node types, then call `McpTools.validatePresetCandidate()`. Return a preview containing only the validated name, effect count, and nodes. Do not write storage or touch live audio in this item.
  Acceptance: Valid files reach preview unchanged. Malformed JSON, oversized files, unsupported schema versions, unknown fields, duplicate IDs, hidden effects, bad parameters, and every chain-policy violation return a specific error and no side effect.
  Verify: Run `node tests/run.js preset-transfer` with fixtures for every rejection listed in `prd.md > Edge cases`, then run `node tests/run.js preset`.

- [ ] **5. Commit imported presets without phantom success**
  Spec ref: `spec.md > Architecture > Preset file transfer`
  What to build: Add the import commit state machine. A unique name saves through `PresetStore.save()`. A collision stops at an explicit Rename, Replace, or Cancel decision. Rename revalidates the non-empty name, Replace is the only overwrite path, and Cancel is byte-stable. Refresh `PresetsUI` only after write and read-back verification succeed. Import never loads the chain or creates chain Undo.
  Acceptance: Every successful import appears once under personal presets. Rename preserves the existing entry, Replace changes only the named entry, and Cancel changes nothing. Storage read, write, serialization, quota, and verification failures show an error and create no partial or phantom preset.
  Verify: Run `node tests/run.js preset-transfer`, `node tests/run.js preset-persistence-honesty`, and `node tests/run.js preset-cycle3`.

- [ ] **6. Integrate accessible Import and Download controls**
  Spec ref: `spec.md > Architecture > Chain and studio interface`
  What to build: Add `preset-transfer.js` after `mcp-tools.js` in `index.html`. Put Import beside the existing Presets actions and show Download only for a selected personal preset. Keep import preview, Rename, Replace, Cancel, success, and error feedback inline in the Presets panel. Preserve the startup gate, native file picker, keyboard order, visible focus, status announcements, and the existing warm hardware-control vocabulary. Do not use browser prompt or confirm dialogs.
  Acceptance: Controls are unavailable before Start, work with mouse and keyboard after Start, expose clear accessible names and state, and fit the current panel at desktop and stacked widths. Import never moves or loads the chain. Download never appears for a missing selection. The normal page still registers exactly ten WebMCP tools.
  Verify: Run `node tests/run.js preset-transfer`, `node tests/run.js order-focus-a11y1`, and `node tests/run.js tool-registration`. Pause for Grady to review the panel at desktop and narrow widths and approve the wording and collision flow.

- [ ] **7. Complete the preset-file round trip and documentation**
  Spec ref: `spec.md > Demo and submission flow > Submission evidence`
  What to build: Finish `tests/test-preset-transfer.js`, update `docs/ACCEPTANCE.md` if implementation details changed, and add end-user Import and Download instructions to `README.md` only after the feature works. Test an export from a prompted personal preset, import it into a fresh storage profile, then load it through the existing policy-checked preset path.
  Acceptance: The fresh profile reproduces the exact safe chain only after Load. Transfer does not change Bypass, engine state, the current chain, autosave, or Undo. The public instructions match the shipped controls and do not promise preset links or cloud sharing.
  Verify: Run `node tests/run.js preset-transfer`, `node tests/run.js preset-tools`, and the complete `node tests/run.js`, then walk `docs/ACCEPTANCE.md > 10. Portable preset sharing` through the load step.

- [ ] **8. Polish chain readability without redesigning the board**
  Spec ref: `spec.md > Architecture > Chain and studio interface`
  What to build: Inspect the current page at the production desktop and stacked breakpoints. Make the smallest HTML and CSS changes needed for effect order, module names, terminal limiter, current values, input and output state, agent activity, and Bypass to read clearly. Preserve every functional ID, script contract, free-board interaction, cord reorder rule, and tested focus order. Do not rebuild MIC IN, OUT, cables, cards, or the two-deck structure unless a reproducible judge-path defect requires a narrow fix.
  Acceptance: A first-time viewer can point out signal direction, the last limiter, the agent's changed modules, Live or Bypass state, and preset-transfer controls without explanation. The interface keeps WCAG AA text contrast, visible focus, reduced-motion behavior, and usable stacked layout.
  Verify: Run the full `node tests/run.js`, the browser accessibility checks in `docs/ACCEPTANCE.md`, and a desktop/narrow visual comparison. Pause for Grady's visual approval before code freeze.

- [ ] **9. Freeze live-audio behavior and decide the Tone.js four**
  Spec ref: `spec.md > Risks and verification > Physical gate`
  What to build: Make no new DSP changes. Walk the real microphone and PA checks for startup, input and output meters, manual edits, preset load, cord reorder, Bypass, limiter, watchdog latch, and hidden-tab behavior. Test Pitch Shift, Tremolo, Bitcrusher, and Phaser one at a time at the documented settings. If an effect fails, remove only its production script include from `index.html`, keep its source and tests, confirm no factory preset depends on it, and rerun registry-driven checks.
  Acceptance: Core audio and safety checks pass at the intended volume. Each Tone.js effect has a recorded Ship or Hide result. Every shipped effect is audible, controllable, click-safe enough for release, protected by Bypass and limiter, and visible to the palette and agent. Hidden effects disappear from both.
  Verify: Date `docs/ACCEPTANCE.md` sections 1 through 3 and the Tone.js line in section 2. Run `node tests/run.js` after any script-include change. Pause for Grady or his brother to provide the physical results.

- [ ] **10. Run the release regression and update public instructions**
  Spec ref: `spec.md > Risks and verification`
  What to build: Run the unfiltered suite from a clean page state, walk startup denial and Retry, autosave restoration, preset transfer, accepted WebMCP mutation, refusal, Undo, and Bypass locally, then update `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/WEBMCP-CHALLENGE.md`, and `docs/ACCEPTANCE.md` to describe only the behavior that actually ships. Remove stale claims about hidden Tone effects or retired interactions encountered in the judge path.
  Acceptance: All automated checks pass. Public instructions name the exact ten tools, deployed URL, accepted prompt, preset file suffix, safety boundaries, and human-only controls. No document claims an unverified effect, link-sharing feature, or automatic watchdog recovery.
  Verify: Run `node tests/run.js`, search public docs for stale feature names and placeholders with `rg`, and replay the README judge steps locally.

- [ ] **11. Deploy `main` and prove the production judge path**
  Spec ref: `spec.md > Data flow > Deployment flow`
  What to build: Review the release diff and commits, push the approved `main` state, wait for the existing Cloudflare Git deployment, and test `https://voxchain.arrangedgodly.com/` over HTTPS. In the supported built-in browser, discover exactly ten page tools on the normal URL, run the accepted karaoke prompt, save and download the preset, show Undo, request limiter removal, and use Bypass. Record client version, model, date, tool count, prompts, and results.
  Acceptance: Production matches the tested checkout, has no relevant console or request failures, starts a real microphone, restores or loads a valid chain, completes preset download and import, and passes the full WebMCP judge sequence without `?dev`, an extension, account, API key, or separate MCP server.
  Verify: Complete and date `docs/ACCEPTANCE.md > 4. Competition client`, `7. Live-deployment smoke`, and `10. Portable preset sharing`. Pause for Grady to approve the live judge path and supply any browser-account actions Codex cannot perform.

- [ ] **12. Prepare the Devpost handoff**
  Spec ref: `prd.md > Submission proof points`
  What to build: Gather the final project story, public repository link, live URL, tested client and model, exact judge steps, accepted and refusal prompts, rights and license proof, dated acceptance results, screenshot list, and a sub-three-minute video shot plan. Center the story on a home karaoke host turning plain language into a visible and audible chain, then downloading that result as a preset. Record what existed before August 25 and what WebMCP work changed during the contest.
  Acceptance: The handoff names every required deliverable, uses only verified claims, includes owned or spoken demo audio, and contains enough material to run `$prepare-submission` without reconstructing technical facts from the repository.
  Verify: Review the handoff materials against `docs/WEBMCP-CHALLENGE.md`, confirm README and production behavior match, and confirm the next command is `$prepare-submission`.
