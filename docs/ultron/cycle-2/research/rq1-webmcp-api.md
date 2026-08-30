# RQ-1 — WebMCP API mechanics & localhost enablement

Question: exact mechanics to enable WebMCP tool registration on localhost in
current Chrome. Blocks MC-0/1/2. Status: **committed recommendation**.
Researcher: subagent (general-purpose), 2026-08-27; primary sources verified.

## Blunt findings

1. **`navigator.registerMcpServer()` never existed.** Grep of full W3C repo
   history (`webmachinelearning/webmcp`): zero occurrences. Lineage:
   `window.agent.provideContext` (Aug 2025 proposal) →
   `navigator.modelContext.registerTool()` (Chrome 146–149) →
   **`document.modelContext.registerTool()`** (spec draft 2026-07-21;
   `navigator.modelContext` deprecated in Chrome 150). There is **no server
   object, no name/version metadata, no resources/prompts** — per-tool
   registration only. All plan text saying "registerMcpServer" must be
   corrected.
2. **Localhost is fine** (secure context; flags are origin-agnostic). The
   documented local-dev path is the flag; OT token issuance for
   `http://localhost:8000` is unverified (tokens match scheme+host+port
   exactly).

## Exact API (implementation-ready)

```webidl
partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool, optional options = {});
  Promise<sequence<RegisteredTool>> getTools(optional options = {});
  attribute EventHandler ontoolchange;
};
```

- `ModelContextTool`: `name` (1–128 chars, `[A-Za-z0-9_.-]`), `description`
  (≤500 chars; param descriptions ≤150), optional `title`,
  `inputSchema` (JSON-Schema-shaped: `type:"object"`, `properties`,
  `required`), required `execute(inputObject, {signal})`, and
  `annotations: {readOnlyHint, untrustedContentHint}` — hints that steer
  *agent-side* confirmation, not enforced prompts.
- Options: `{exposedTo: [origins], signal}` — aborting the signal
  unregisters; re-register on every page load (no persistence).
- Results: any JSON-serialized value; **errors are best returned as
  descriptive text in the normal result** (spec currently only rejects with
  `UnknownError`; no `isError` field) — return plain strings/objects, verify
  rendering in DevTools pane.
- Requirements: SecureContext (localhost OK); Permissions-Policy feature
  `"tools"` default `'self'`; **origin isolation** must not be disabled (no
  `Origin-Agent-Cluster: ?0` / `document.domain`) — plain `http.server` is
  fine; `InvalidStateError` if document not fully active.
- Feature detection: `'modelContext' in document` (150+) with
  `'modelContext' in navigator` fallback (149), else silent no-op.
- Declarative variant exists (`<form toolname …>`) — not needed; imperative
  tools only.

## Enablement (developer machine)

- Chrome today: stable 152/153, beta 153, dev/canary 154; **OT live in
  stable (149–156)**.
- Local path: `chrome://flags/#enable-webmcp-testing` → Enabled → restart
  (verify present on stable). Alt: `--enable-features=WebMCP` (150+).
- OT path (if flag absent on stable): register at
  `developer.chrome.com/origintrials/#/register_trial/4163014905550602241`;
  token via `<meta http-equiv="origin-trial">` on every page; exact
  scheme+host+port match; localhost issuance unverified → fall back to flag.
- Edge: parallel OT live in 150, expires **2026-11-17**.
- Debugging: **DevTools → Application → WebMCP pane** (tool list "as the AI
  agent sees it", manual Run-tool with inputs, invocation log, schema-error
  display). "Model Context Tool Inspector" extension for NL testing.

## Evidence (all fetched 2026-08-27)

- Spec IDL + rules: https://webmachinelearning.github.io/webmcp/
- Imperative API + rename history:
  https://developer.chrome.com/docs/ai/webmcp/imperative-api
- Flag, OT, isolation, permissions:
  https://developer.chrome.com/docs/ai/webmcp
- OT window/use-counter: https://chromestatus.com/feature/5117755740913664
  (updated 2026-08-12) · OT signup blog 2026-06-09:
  https://developer.chrome.com/blog/ai-webmcp-origin-trial
- Token mechanics: https://developer.chrome.com/docs/web-platform/origin-trials
- DevTools pane: https://developer.chrome.com/docs/devtools/application/webmcp
- Chrome channels: versionhistory.googleapis.com (2026-08-27)
- Security/best practices:
  https://developer.chrome.com/docs/ai/webmcp/secure-tools ·
  https://developer.chrome.com/docs/ai/webmcp/best-practices

## Decision

**Committed recommendation**: build on `document.modelContext.registerTool`
with `navigator.modelContext` fallback; enable locally via flag; return
errors as descriptive result text; re-register per load. Confidence high
(spec+docs+chromestatus triangulate); localhost-token acceptance low
confidence (flag path avoids the question).

**LIVE VERIFIED 2026-08-27 (MC-0, user's flagged Chrome stable):**
registration on localhost:8000 works; tool listed + manually run in the
DevTools WebMCP pane; chip state drove correctly via the FEW-1 contract.
**Contradiction resolved: results render as PLAIN JSON objects, not the
MCP `{content:[…]}` wrapper** — plain values are the correct return shape;
error-as-descriptive-result-text strategy confirmed.

## Plan consequences

MC-1 (shim registers **tools**, not a server; lifecycle events derive from
registration/execute calls), MC-2 (schemas per `ModelContextTool` shape;
descriptions ≤500/≤150 chars), MC-0 (spike via flag + DevTools pane),
FEW-1 chip semantics: "tools ready / acting / unavailable" (no connection
concept in the API).

**Additional live nuance (QA-3, 2026-08-28, Arc/Chromium build)**:
`modelContext.executeTool(tool, args)` rejects the spec's OBJECT form
with `UnknownError: Failed to parse input arguments`; passing the args
as a **JSON string** works. Consumers should try object → string.
