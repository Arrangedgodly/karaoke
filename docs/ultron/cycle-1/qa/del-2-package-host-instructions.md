# DEL-2 — Package + Host Run Instructions

Covers task DEL-2, the final task of Milestone M6 (Core MVP release-ready). Acceptance criterion: "Host can start the app and reach a working state without developer assistance."

Executed 2026-08-27 against the app as built through QA-4.

## A real gap found and fixed before packaging

`index.html` loaded SortableJS from a CDN (`cdn.jsdelivr.net`). This directly conflicts with DEL-1's own acceptance criteria ("no internet dependency assumed... mirrors 'locally hosted' event context") — an empty `vendor/.gitkeep` placeholder from DEL-1 suggests this was anticipated but never followed through. At a real venue with no or unreliable internet, drag-and-drop (the app's core interaction) would have silently failed. Fixed by downloading the exact pinned version (SortableJS 1.15.7, MIT license, verified via its own header comment and a clean file-end) into `vendor/sortable.min.js` and repointing `index.html`'s script tag at the local copy. Re-verified via the real drag-and-drop path (palette → chain add) against the vendored file, served from a real local HTTP server — works identically, zero console errors.

## What was built

1. **`vendor/sortable.min.js`** — SortableJS 1.15.7 vendored locally (see above).
2. **`start.bat`** (Windows) and **`start.command`** (Mac) — double-clickable launchers. Both: `cd` to their own directory (works regardless of where they're launched from), detect `python`/`python3`, start a local static server on port 8000, and open the default browser automatically. Both fail with a clear, plain-language message (pointing to python.org) if no Python is found, rather than a silent/cryptic error. `start.command` has its executable bit set.
3. **`README.md`** — plain-language instructions for the non-technical host (the user's brother), covering: before-the-event setup, starting the app, building/tuning a chain, saving/loading presets, and — given the highest weight, per this whole project's own stated priority — a clearly-flagged section on **Emergency Bypass**, including the spacebar shortcut, framed around the actual failure mode it exists for ("hit it first, figure out the problem after").
4. **`karaoke-chain-builder.zip`** — an actual distributable package (sent to the user directly), containing only what the host needs: `index.html`, `README.md`, `start.bat`, `start.command`, `src/`, `styles/`, `vendor/`, `assets/`. Deliberately excludes `docs/ultron/` (the planning/process trail, valuable for the user's own portfolio use but not for the host) and `.claude/` (dev tooling config).

## Why a local Python server, not `file://`

Opening `index.html` directly via `file://` was considered and rejected: the Reverb node's impulse-response loading uses `fetch()` (see [AE-9's production-log entry]), which browsers block under the `file://` protocol due to CORS — the Reverb effect would silently fail to load its IR. A real local HTTP server is required, which is exactly what the launcher scripts provide without requiring the host to know that.

## Validation evidence

1. **Server command verified directly**: ran the exact command the launchers use (`python -m http.server 8000`) from the project root, confirmed both `index.html` and the newly-vendored `vendor/sortable.min.js` serve with HTTP 200.
2. **Vendored dependency verified functionally, not just by file presence**: loaded the app from that real local server, started the engine (mocked mic), and performed a real drag-and-drop add via the actual registered `Sortable` handlers — `window.Sortable.version` confirmed `"1.15.7"` (matching the previously CDN-pinned version exactly), node count went from 6 to 7 correctly, zero console errors.
3. **`start.bat` logic verified on this machine** (Windows, the only OS directly testable here) by replicating its exact server-start command and confirming it serves correctly. The full double-click launch (including the automatic browser-open step) was not separately fired, to avoid an unprompted browser window popping open on the user's desktop — the underlying command it runs was verified directly instead.
4. **`start.command` could not be executed or tested at all** — this is a Windows machine with no Mac available (the same hard environment constraint already documented for Safari in QA-2). Written carefully, following the same pattern as the verified Windows version, with the executable bit set — but genuinely untested. This is the one real, honestly-flagged gap in this task.
5. Package contents double-checked by listing the actual zip entries — confirms exactly the intended host-facing file set, correctly excluding `docs/ultron/` and `.claude/`.

## Acceptance criteria

- ⚠️ **Likely met on Windows, unverified on Mac.** "Host can start the app and reach a working state without developer assistance" — the Windows path (`start.bat`) was verified as far as directly testable without triggering an unexpected desktop popup; the underlying server command it runs was confirmed working end-to-end through the real app. The Mac path (`start.command`) is untested due to the same hard hardware constraint noted throughout this project's QA phase (no Mac available in this environment) — it should work (same logic, standard macOS shell scripting conventions, executable bit set) but has not been run for real.

## What still needs a human

**Before the first real event, actually double-click `start.command` on a real Mac once**, and `start.bat` on the real Windows laptop that will be used, to confirm both launch cleanly end-to-end (including the automatic browser-open step this task's own testing deliberately avoided triggering here). This is a five-minute check and the single most valuable thing left to do before this app is used live.
