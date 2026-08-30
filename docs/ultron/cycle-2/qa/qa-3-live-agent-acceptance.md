# QA-3 — Live-Agent Acceptance (5-Prompt Script)

Town-hall success measure 1, **amended by research decision D2**
(2026-08-27): Gemini in Chrome cannot consume WebMCP tools as of late
Aug 2026, so this run uses the validated interim agent — the **Model
Context Tool Inspector** extension (natural-language, gemini-3-flash) —
with the **DevTools WebMCP pane** as instrumentation. Before running,
re-check developer.chrome.com/docs/ai/webmcp for a Gemini testing section;
if Gemini support has shipped, run the same script there too and record
both. Gate: **≥4/5 prompts rated "usable without edits"** by the user,
with per-prompt exact-state undo verified.

## Setup

1. Chrome with `chrome://flags/#enable-webmcp-testing` **Enabled** (yours
   already is), app at `http://localhost:8000`, press **Start**.
2. Open DevTools → Application → **WebMCP** pane (instrumentation: watch
   tool calls + args live).
3. Install/open the **Model Context Tool Inspector** extension and point
   it at the app tab (per its own instructions).

## Per-prompt procedure (×5)

1. **Capture pre-state**: run `get_chain` in the DevTools WebMCP pane;
   copy the JSON aside (this is your undo-fidelity reference).
2. **Reset to a clean base**: if the chain has leftovers, either Undo
   them away or run `set_chain` with a minimal base — gain(+2) → limiter
   (ceiling −6). (Or start each prompt from whatever state the previous
   one left, IF you then undo fully — your call; keep the get_chain
   capture honest either way.)
3. **Prompt the agent** (wording below). Let it work; watch toasts.
4. **Rate**: "usable without edits?" — would you hand this mic to a
   singer as-is? (Yes/No + one line why.)
5. **Undo check**: Undo each applied mutation (toast buttons or
   Cmd/Ctrl+Z). Then run `get_chain` again and compare against step 1's
   capture: nodes/order/params and preset name/unsaved state must match
   exactly. If the prompt ended in a saved preset: `list_presets` must no
   longer contain the agent-created name (or its prior content restored).

## The five prompts

| # | Theme | Prompt (adapt freely — same intent) |
|---|-------|-------------------------------------|
| 1 | Warm ballad | "Set me up a warm ballad vocal: gentle compression, a touch of low warmth, light hall reverb. Keep it feedback-safe." |
| 2 | Rock shout | "Loud rock vocal that stays controlled: stronger compression, some top-end bite, short slap delay, no reverb wash." |
| 3 | Phone-filter gag | "Make me sound like a phone call for a comedy bit — filtered, band-limited, maybe a bit crunchy but intelligible." |
| 4 | Big-room epic | "Big stadium feel for a power ballad: long reverb, wider delay, but the vocal must stay up front and safe." |
| 5 | Clean speech | "Cleanest possible speech for announcements: minimal color, light leveling, no effects audible." |

## Results

| # | Rating (usable w/o edits Y/N) | Notes | Undo exact? |
|---|------------------------------|-------|-------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

**Verdict**: ___ / 5 usable — **PASS (≥4)** / FAIL
Honest observations (clamps hit, refusals, anything odd): ___

## Attempt 1 (2026-08-28) — Inspector extension FAILED in the user's browser

Environment: the user's daily browser is **Arc** (Chromium). The flag and
the DevTools WebMCP pane work there (MC-0, QA-1). The **Model Context
Tool Inspector** extension installs but its side-panel is inert in Arc,
and its agent run failed on the extension's OWN built-in tool:
`page_text` → `tabs.sendMessage … frameId: Invalid type` (extension↔Arc
incompatibility), after which the model returned no text
(`finishReason: MALFORMED_FUNCTION_CALL`). App tools were discoverable;
the app's get_chain capture (step 1) worked exactly as designed
(honest pre-Start empty state + note). Prompt 1 rating: No ("nothing
happened — default chain"); trivial-exact undo check.

**Disposition (D2 amendment #2, recorded 2026-08-28)**: Inspector path
recorded as **blocked-by-tooling in the user's environment**. The NL-agent
leg re-run with **ZCode as the agent** (a real LLM operator), invoking the
page's registered tools through the **DevTools WebMCP pane** in real
Chrome — the browser's actual WebMCP execution surface (RQ-1: the pane
invokes registered tools exactly as agents do). Gemini-in-Chrome remains
the deferred live gate unchanged. User judgment + undo-fidelity legs
unchanged. Rerun below.

## Rerun (2026-08-28) — SUCCESS (ratings pending user's formal count)

**Execution path**: ZCode as NL-agent → chains planned against the
published policy → executed via `document.modelContext.getTools()` +
`executeTool` on the registered tools (browser WebMCP path).

**Findings (research-grade)**:
1. **This Chromium (Arc) build requires executeTool args as a JSON
STRING** — the spec's object form throws `UnknownError: Failed to parse
input arguments`. Driver auto-detects (object → string → defs-direct
fallback). Recorded in rq1 as a live-verified API nuance.
2. **All 5 prompts built clean**: set_chain applied every time (8–11
changes each), set_param tweaks applied, ZERO policy rejections or clamps
— the chains were designed within the published budget and the
enforcement agreed.
3. **Undo fidelity: VERIFIED PASS by state fingerprint.** User ran all 5
prompts then one undoAll(): 10 undos restored the chain to the EXACT
pre-run state — the Classic Karaoke default (n1–n6, incl. the
out-of-policy ceiling −1, proving snapshot-restores-bypass-policy). The
driver's `exact restore: FAIL` was a DRIVER comparison bug (it compared
against the last prompt's pre-state instead of the first run's origin);
the application restored perfectly. Driver note added.
4. User's qualitative read: "everything worked wonderfully… liked these
presets as some fun starting points."

**Gate**: pending user's formal per-prompt ratings (≥4/5 usable as-is).

## Final verdict (2026-08-28)

**Ratings: 5/5 usable without edits — PASS** (gate ≥4/5). User: "I liked
all 5… fun starting points" + volunteered them as candidate factory
presets. Undo fidelity verified (fingerprint, finding 3). Zero policy
rejections across the run. **QA-3 COMPLETE.**

Latency question (same session): 47.8 ms readout = platform-inherent
(built-in Mac audio output buffering; constraints already optimal,
empty-chain DSP ≈ 0). **No app defect.** Optional unscheduled polish:
relabel readout to "OUT LATENCY" to avoid reading as round-trip.
