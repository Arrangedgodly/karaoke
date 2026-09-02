# ADR 0002: Failed-startup recovery is one named transaction; a layout read can never become a clear

- **Status**: Proposed (2026-09-01) — becomes Accepted when the inline two-write recovery path in `src/main.js` is replaced by the transaction below and the acceptance matrix passes. Issue [#31](https://github.com/ArtofFish/voxchain/issues/31) controls when that work starts, not what this decision means.
- **Context**: architecture review of 2026-09-01 (candidate 3), grilled to a shared contract the same day.

## Context

Two facts about the pinned baseline (`8d328cd`) motivate this decision.

1. **A caught exception can erase saved card widths.** `Persistence.saveCurrentChain(model, layout)` gives the `layout` argument three meanings: `undefined` carries the stored layout forward, `null` is an intentional clear (three real callers: preset load, the audition harness, the empty startup fallback), and an object is written as-is. `ChainEditing.currentLayout()` converts *any* failure to read the canvas layout — a throwing read, or no canvas adapter at all — into `null`. `persist()` then hands that `null` to storage, so a transient read failure is recorded as "the operator cleared every card width." `persist()` also re-reads the canvas instead of using the layout the transaction already accepted, so the accepted layout and the persisted layout can differ.

2. **Startup recovery is correct but inline and two-step.** When the saved chain cannot become live, `main.js` applies an empty passthrough through `ChainEditing.apply` (which persists the empty chain), then writes the original saved model and layout back to autosave so a transient factory failure does not erase the operator's chain. Lifecycle test L2 covers this. The write is deliberate, not a duplicate of normal autosave. But between the two writes storage holds only the empty chain, and the recovery has no name, no result, and no home in the module that owns accepted state.

## Decision

### 1. Post-recovery state

If the saved startup chain cannot become live, `ChainEditing.restoreFailedStartup(snapshot)` accepts an empty passthrough and restores the snapshot to storage. Afterwards:

| State | Value |
|---|---|
| Live graph | empty passthrough |
| Accepted model | empty chain |
| Accepted layout | empty layout |
| Autosave storage | the original **recovery snapshot** (model and layout that failed to become live) |

Accepted state always describes what the operator is hearing and seeing. Making the accepted model equal the failed snapshot would poison later edits, rollback and Undo with a chain that never became live.

`recovered: true` means *startup recovered to a usable session by accepting the empty passthrough*. It does not mean the saved chain became live.

### 2. Recovery snapshot lifetime

The recovery snapshot lives in the **normal autosave slot** and only until the **next accepted edit**, which replaces it. Recovery does not create a durable backup or history entry. This is a stated limit, not an implied protection; the status line already tells the operator the saved chain failed to load and started empty, and a reload before editing retries.

### 3. One storage write

The recovery transaction makes **exactly one** storage write, and that write contains the recovery snapshot. The empty fallback's own acceptance does **not** first overwrite storage with the empty chain, so a crash, quota failure or verification failure mid-recovery can never leave storage holding only the empty chain.

Persistence suppression is **private to the named recovery operation** (a private `perform` option or a private helper shared by `apply` and `restoreFailedStartup`). There is no public `skipPersistence` option on `ChainEditing.apply()`: arbitrary callers must never be able to accept an edit without durability or a warning.

### 4. Result and failure mode

```
{ recovered: true,  persisted: true  }          // fallback live, snapshot rewritten
{ recovered: true,  persisted: false, error }   // fallback live, snapshot write failed
reject(error)                                   // the empty fallback itself could not become live
```

A failed snapshot write does **not** tear down the usable empty session. `saveCurrentChain` has already latched the autosave-failure warning, dispatched the failure event and exposed it through `isSaveFailed()`; `main.js` adds no operator message, but logs the partial result so diagnostics distinguish "saved chain failed, fallback succeeded, snapshot rewrite failed" from total startup failure. If the empty fallback cannot become live there is no session to report on; the method rejects and the outer startup catch owns teardown and the failed-start UI.

### 5. Layout outcomes in normal persistence

The accepted layout is the **only** layout passed to persistence. `persist()` never re-reads the canvas. Inside `apply`, the sequence is:

1. Render the candidate.
2. Read the resolved canvas layout **once**.
3. If the read succeeds, promote that value to the accepted layout.
4. Persist the accepted model with that exact accepted layout.
5. If the read throws, retain the previous accepted layout, persist the accepted model with that retained layout, and return a `LAYOUT_READ_FAILED` warning.
6. If no canvas adapter exists, pass `undefined` so storage carries its layout forward. Adapter absence is never translated into `null`.

The four spellings, and only these:

| Value passed to persistence | Meaning |
|---|---|
| object | accept and write exactly this layout |
| `null` | intentional clear (preset load, audition load, empty fallback) |
| `undefined` | no layout source; carry storage forward |
| *(never passed)* a read that threw | keep the accepted layout, persist the model with it, warn |

The width-resize path keeps its dependency pointed inward: the canvas reads its own layout once and calls `ChainEditing.syncLayout(layout)`, which persists that same layout and returns a structured result (`{ synced, saved, warning? }`) rather than only a layout copy. If the canvas read throws, the canvas does not call `syncLayout` at all; ChainEditing retains its last accepted layout and no layout-only write occurs.

`syncLayout` receives a layout object and does not read the canvas. It therefore never returns `LAYOUT_READ_FAILED`. Its degraded result carries `AUTOSAVE_FAILED` only when its persistence write fails.

### 6. Two warnings, two diagnoses

| Code | Meaning | Operator alert latch |
|---|---|---|
| `AUTOSAVE_FAILED` | persistence failed; durability unknown | yes (existing `role="alert"`, tied to `Persistence.isSaveFailed()`) |
| `LAYOUT_READ_FAILED` | the layout source failed; the model was persisted with the retained layout | **no** — a transaction-result warning plus `console.error` |

Using the autosave latch for a layout read failure would tell the operator that edits will not survive reload when that is not what happened.

## What is NOT decided

- Where `restoreFailedStartup` sits relative to `apply` internally, beyond "private suppression, shared helper acceptable."
- Exact field names of the `syncLayout` result. The distinction between the two warning codes is the contract, not the field list.
- Candidate 1 (canonical discrete params) and candidate 7 (validation layers) of the same review; they are scoped together later.

## Considered and rejected

- **Accepted model = failed snapshot after recovery.** Rejected: accepted state must equal live state; ChainEditing exists to hold that invariant.
- **A second recovery slot that survives later edits.** Rejected for this decision: a new storage key, a retention policy and a UI moment for offering or discarding the backup. Recorded as the follow-up if a real operator loses a chain to the lifetime limit in §2.
- **Suppressing autosave after recovery until an explicit save or load.** Rejected: it makes otherwise valid edits silently non-durable, recreating the failure class the autosave-warning work (#16) closed.
- **A public `skipPersistence` request option.** Rejected: an attractive path for future callers to accept ordinary edits without durability or a warning.
- **Latching the autosave alert on a layout read failure.** Rejected: wrong diagnosis, sends the operator to the wrong fix.
- **"Persistence has exactly one caller."** Rejected (it was the review's first draft): the recovery write is a distinct, deliberate transaction, not a duplicate of normal autosave. The target is one normal writer plus one named recovery transaction.

## Acceptance matrix

Every row is observed through the storage adapter and the transaction result, not by reading source text. Rows marked *existing* are already asserted and must keep passing.

| # | Scenario | Required outcome |
|---|---|---|
| A1 | Saved chain restores normally | one write; storage holds the saved model and layout *(existing: lifecycle K/L)* |
| A2 | Saved chain cannot become live; empty fallback applies; snapshot write succeeds | live and accepted = empty; **exactly one** write; it contains the original model **and** original layout; result `{recovered: true, persisted: true}` *(extends existing L2)* |
| A3 | As A2 but the snapshot write fails | storage was **never** deliberately replaced with the empty chain; result `{recovered: true, persisted: false, error}`; autosave latch visible via `isSaveFailed()`; session stays live |
| A4 | The empty fallback itself cannot become live | `restoreFailedStartup` rejects; **no** recovery write; outer startup catch runs *(existing failed-start UI)* |
| A5 | First accepted edit after A2 | the write replaces the recovery snapshot in the normal slot (the counter-intuitive row: proves "snapshot" is not a backup) |
| A6 | Normal apply; canvas layout read succeeds | persisted layout equals the accepted layout promoted in that transaction; no second canvas read |
| A7 | Normal apply; canvas layout read throws | model persisted with the **previous** accepted layout; result carries `LAYOUT_READ_FAILED`; `isSaveFailed()` stays false; `console.error` called |
| A8 | Normal apply; no canvas adapter | persistence receives `undefined`; storage carries its layout forward; never `null` |
| A9 | Preset load / audition load / empty fallback | persistence receives `null`; storage layout becomes `{}` *(existing: autosave-layout C4, audition harness pin)* |
| A10 | Width-resize; canvas read succeeds | `syncLayout(layout)` persists that same layout; result `synced: true, saved: true` |
| A11 | Width-resize; canvas read throws | `syncLayout` is not called; accepted layout unchanged; no write |
| A12 | Width-resize; write fails | result `synced: true, saved: false` with `AUTOSAVE_FAILED`; latch set |
| A13 | Architecture gate | no public request option on `ChainEditing.apply()` suppresses persistence (the existing source-scan gate in `tests/test-chain-editing.js` is the natural home) |

## Consequences

- `src/main.js` stops writing autosave directly; its startup path calls `ChainEditing.restoreFailedStartup` and logs the result.
- `ChainEditing.persist()` takes the accepted layout as an argument; `ChainEditing.currentLayout()`'s catch-to-`null` disappears.
- `src/canvas.js` drops its direct `window.Persistence` dependency; the width-resize path becomes a `syncLayout` call.
- `tests/test-audio-lifecycle.js` section L gains A3–A5; `tests/test-autosave-layout-store.js` gains A6–A8 against the real caller.
- Glossary: **Recovery snapshot** added to `CONTEXT.md`.
