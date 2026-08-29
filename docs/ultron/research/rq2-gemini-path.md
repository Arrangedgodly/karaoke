# RQ-2 — Gemini in Chrome consumption path

Question: reproducible path for Gemini in Chrome to discover + invoke a
localhost page's WebMCP tools. Blocks MC-0, QA-3, DOC-1. Status: **needs user
disposition** (changes an acceptance criterion). Researcher: subagent,
2026-08-27, primary sources.

## Blunt finding

**Gemini in Chrome cannot consume a page's WebMCP tools today
(2026-08-27).** Last primary commitment: Chrome I/O blog (2026-05-19):
*"Gemini in Chrome will soon support WebMCP APIs."* Current official WebMCP
docs steer all testing to the DevTools WebMCP pane and the "Model Context
Tool Inspector" extension, and note the Inspector *"is separate from Gemini
in Chrome."* No Google source after May 2026 confirms the integration
shipped. Design for it; do not promise it in docs.

## What exists today (validated interim paths)

1. **DevTools WebMCP pane** — manual tool invocation with inputs, schema
   validation, invocation log. Works on localhost. (Primary QA instrument.)
2. **Model Context Tool Inspector extension** — natural-language agent
   (defaults `gemini-3-flash-preview`) driving registered tools. The closest
   available "prompt an agent" experience.
3. **chrome-devtools-mcp** with `webmcp` option — external coding agents
   (Chrome 150+, `--enable-features=WebMCP`).
4. In-page agents via `getTools`/`executeTool` (spec'd 2026-08-14).

## The agentic surface it will ride on (auto browse)

Official help (support.google.com/chrome/answer/16821166, fetched
2026-08-27): "Ask Gemini" → task tab with **plan review before Start**;
explicit confirmations for sensitive actions; take-over/resume; 20 req/day
(Pro) / 200 (Ultra). Requirements: latest Chrome, personal Google account
signed in, **AI Pro or Ultra subscription, 18+, US-only, English**, not
Incognito. When WebMCP lands, tools become structured steps; exact
presentation undocumented.

## Evidence

- https://developer.chrome.com/blog/chrome-at-io26 (2026-05-19, "soon")
- https://developer.chrome.com/docs/ai/webmcp (2026-08-27, no Gemini path;
  Inspector "separate")
- https://support.google.com/chrome/answer/16821166 (auto browse reqs/UX)
- https://blog.google/products-and-platforms/products/chrome/new-ai-features-for-chrome/
  (2025-09-18 initial availability)
- chrome-ai-dev-preview-discuss (Beaufort, 2026-03-02) + webmcp#51 —
  external-agent access design still open

## Options considered

- (a) **Retarget validation**: QA-3 runs today's path (DevTools pane +
  Inspector NL agent); Gemini live-run becomes a **deferred** gate with a
  revisit trigger (recheck docs before DOC-1/QA-3); README tells the current
  truth. *(recommended)*
- (b) Hold cycle until Gemini ships — unknown date, blocks everything. ✗
- (c) Drop agent acceptance entirely, schema-correctness only — weakens the
  portfolio claim and the "both equally" intent. ✗

## Plan consequences (if option a accepted)

QA-3 retargeted; DOC-1 documents current truth + Gemini readiness
checklist; MC-0 spike validates via DevTools pane + Inspector (not Gemini);
town-hall acceptance criterion 1 amended (agent = Inspector's
gemini-3-flash today, Gemini-in-Chrome when shipped). **Requires revised
plan approval.**
