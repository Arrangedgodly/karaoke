# RQ-6: WebMCP competition and judge-client contract

**Research date:** 2026-08-29

**Scope:** Devpost WebMCP Challenge requirements, the ChatGPT/Codex built-in browser client, Chrome's WebMCP implementation, the WebMCP draft specification, and this repository's current implementation.

**Baseline inspected:** `origin/main` at `4cbea4d`. Measurements below labelled baseline describe that commit before this branch's follow-through changes.

**Source rule:** Primary sources only. Devpost is authoritative for the competition, OpenAI for the ChatGPT/Codex client, Chrome for Chrome's implementation guidance, and the WebMCP Community Group draft for the platform API.

## Decision

This project does **not** need a side-loaded MCP server, MCP package, manifest, local process, JSON-RPC transport, API key, or separate connection for the competition's ChatGPT/Codex judge path. The deployed page itself must register tools through the top-level page's `document.modelContext.registerTool(...)` API. That is already the architecture in this repository.

The main finding is therefore not “replace MCP with WebMCP.” The repository's `McpServer` name sounds like a conventional MCP server, but the code is an in-page WebMCP registration adapter. It has no server process or MCP transport. Rebuilding it as a conventional MCP server would move the project away from the competition contract.

The most important improvements are smaller and more concrete:

1. Reduce tool metadata and outputs. On the baseline, `get_capabilities` serialized to about 15,243 characters in the repository harness, while Chrome's preliminary security guidance recommends about 1,500 characters per tool output. Three tool descriptions were also over Chrome's suggested 500-character budget.
2. Make the human and agent control surfaces agree before audio starts. The agent can change the in-memory chain while the human's palette, canvas, and presets panels are visibly gated. That is a product-control mismatch, not an API failure.
3. Make the real ChatGPT/Codex built-in browser the primary acceptance path. Chrome DevTools, the Chrome testing flag, the Inspector extension, and the `?dev` harness are useful diagnostics, but none is the judge runtime or a substitute for an end-to-end built-in-browser test.
4. Tighten the schemas at object boundaries and rewrite descriptions around purpose and selection instead of forced call order.
5. Clarify naming and documentation so a reviewer cannot mistake `src/mcp-server.js` for a conventional MCP server or the optional Chrome Inspector extension for a competition prerequisite.

## Branch follow-through

This branch applies the low-risk, judge-facing parts of the recommendation:

- `get_capabilities` is now a 1,463-character compact policy index while retaining every node type, agent-facing parameter range, range action, core aggregate rule, and human-only control category.
- Deterministic registration tests now enforce Chrome's preliminary budgets for tool names, parameter names, tool descriptions, parameter descriptions, and the `get_capabilities` result.
- Every top-level input object and the fixed `set_chain` chain/node objects now declare `additionalProperties: false`; type-dependent `params` objects remain intentionally open in the schema and strictly validated in application code.
- Forced-order wording was removed, the over-budget descriptions were shortened, and registration exposes one awaitable aggregate lifecycle promise.
- The optional `?dev` harness now waits for registration and reports the settled count. In-app-browser verification showed `WebMCP: on · 10 registered`.
- The README and acceptance checklist now lead with the built-in-browser judge path and label Chrome flags, DevTools, the Inspector extension, and `?dev` as optional diagnostics.

The branch does not resolve the pre-Start human/agent control mismatch. In-app-browser testing reproduced it: `load_preset` visibly built a five-node Warm Ballad chain before Start while the human palette controls remained disabled. That remains the next product decision and implementation slice.

## What the competition actually requires

The [challenge overview](https://webmcp.devpost.com/) and [official rules](https://webmcp.devpost.com/rules) require:

- A working live URL that judges can access using the ChatGPT in-app browser or Chrome with WebMCP enabled.
- A public source repository with the code, assets, setup instructions, and a visible open-source license.
- In-page WebMCP use. The rules show the required shape as `document.modelContext.registerTool({ name, description, inputSchema, execute })`.
- A public YouTube demonstration under three minutes with audio, plus the written submission material.
- For a project that existed before the contest period, a meaningful WebMCP extension created during the contest period and documentation that distinguishes new competition work from prior work.

The rules say judges **may** test the live app with either supported client, but they are not required to do so. They may judge from the description, repository, images, and video. The submission therefore has to make the WebMCP interaction legible in all four places: the live app, repository, written entry, and video.

The Devpost criteria give equal weight to WebMCP leverage, execution, potential impact, and creativity or ambition. “WebMCP leverage” explicitly rewards tools that are useful, well designed, and composable. Registering tools is the entry gate; the quality of their selection, arguments, results, and visible effect is the scored work.

The [official resources page](https://webmcp.devpost.com/resources) confirms the same two test paths. It does not require an MCP server, SDK, package, or manifest. The Devpost Plugin is optional submission assistance under the rules, not a runtime requirement and not required to enter or win.

## Conventional MCP and WebMCP are different architectures

OpenAI's [Site tools documentation](https://learn.chatgpt.com/docs/webmcp) makes the distinction directly: conventional MCP connects an agent application to a local or remote server and can work without an open web page; WebMCP exposes capabilities from a website that the agent is currently visiting. Chrome's [WebMCP and MCP comparison](https://developer.chrome.com/docs/ai/webmcp/compare-mcp) likewise describes WebMCP as a browser-facing, frontend interface inspired by MCP, not an extension or replacement of MCP.

| Concern | Conventional MCP | In-page WebMCP | This repository |
| --- | --- | --- | --- |
| Runtime owner | Local or remote MCP server | The open top-level web page | The deployed karaoke page |
| Discovery | Configured server connection | Browser discovers tools while visiting the page | Scripts register on every page load |
| Transport | MCP protocol, commonly JSON-RPC over a supported transport | Browser-mediated JavaScript calls | Direct `document.modelContext.registerTool(...)` calls |
| State | Server or connected service state | Current page, DOM, session, and visible app state | `ChainCanvas`, presets, audio graph, toast, and Undo state |
| Installation | May require a server package and connection configuration | No separate MCP server or connection for the OpenAI client | No runtime dependency or side package |
| Result shape | MCP protocol result structures | JSON-serializable return value | Plain JavaScript objects |

`src/mcp-server.js:155-168` detects `document.modelContext` first, with the old `navigator.modelContext` location as a compatibility fallback. `src/mcp-server.js:344-356` projects a tool definition onto the browser's `ModelContextTool` shape, and `src/mcp-server.js:371-419` calls the browser's `registerTool`. `src/mcp-tools.js:4547-4572` registers the ten tools as the page parses. These are WebMCP client-side operations despite the `McpServer` global and filename.

There is no MCP SDK, stdio service, HTTP MCP endpoint, server manifest, or connection bootstrap in this path. The wrapper's use of plain JSON values also matches the [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/), whose execute callback resolves to a JSON-serializable value rather than an MCP `{content: [...]}` envelope.

## The judge-client discovery contract

### What OpenAI publicly guarantees

OpenAI calls its WebMCP implementation “Site tools.” Its [official Site tools documentation](https://learn.chatgpt.com/docs/webmcp) states, “For now, tools must be registered through JavaScript in the top-level page,” and separately says iframe-registered tools are not discovered. In full, the documented client contract is:

- ChatGPT Work and Codex can discover and use WebMCP tools in the built-in browser when tools are available on the page.
- People do not need to install a separate MCP server or configure another connection.
- Site tools belong to the current page. They are not a global catalog detached from the open site.
- The built-in browser can show available and recently used site tools from the address bar.
- The current client supports imperative JavaScript registration in the top-level page.
- It currently does not discover declarative WebMCP tools or tools registered inside iframes, including same-origin iframes.
- Calls are safety reviewed. Tool names, annotations, and returned content are treated as untrusted signals, not as authority.

The accompanying [OpenAI Help Center article](https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app) confirms that discovery is automatic when the account, model, and page support Site tools, that no separate connection is required, and that the tools work with the user's current live page and session. The [built-in browser article](https://help.openai.com/en/articles/20001277-using-the-built-in-browser-in-the-chatgpt-desktop-app) explains that the browser is opened from a Work or Codex task in the desktop app.

As of this research date, OpenAI says to use an up-to-date desktop app and GPT-5.6 Sol or GPT-5.6 Terra for Site tools; GPT-5.6 Luna currently has WebMCP disabled. Availability is also account and rollout dependent. This is a test-readiness condition, not an application package requirement.

### What OpenAI does not publicly specify

OpenAI publishes the high-level discovery contract above, but it does **not** publish a lower-level Codex discovery algorithm. The public documentation does not define a scan deadline, polling interval, retry cadence, a contract for late registration, a private manifest, or a callable client-discovery endpoint.

The WebMCP draft is equally careful here. Its `getTools()` method is for in-page agents, while a browser agent uses a separate internal mechanism. The draft does not standardize that browser-internal discovery mechanism.

The practical consequence is:

- Register the stable tool set in the top-level page during normal load.
- Await and report registration promises so failures are observable.
- Do not hide registration behind `?dev`, a user gesture, an iframe, or a separate extension.
- Verify discovery with the actual ChatGPT/Codex built-in browser rather than assuming that a DevTools listing proves the client path.

The repository already satisfies the first and third points. Its remaining acceptance evidence should prove the second and fourth.

## Current WebMCP best practices

### Registration and lifecycle

The [imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api) and the [draft specification](https://webmachinelearning.github.io/webmcp/) define the core tool fields as `name`, optional `title`, `description`, optional JSON Schema `inputSchema`, `execute`, and optional annotations. The execute callback receives the parsed input and an options object with an `AbortSignal`.

Best practice for this app:

- Keep the ten stable tools registered statically on every load. Chrome's [best-practices guide](https://developer.chrome.com/docs/ai/webmcp/best-practices) recommends static registration by default and dynamic registration only when page state truly changes whether a tool exists.
- Continue passing the execution `AbortSignal` into tool logic. The current wrapper does this.
- Keep mutation tools available based on product intent, not audio-engine implementation convenience. If a mutation is available before Start, the human UI should provide the equivalent model edit. If the product decides mutations must wait for Start, the tool must refuse with a clear recoverable result or be registered only in that state.
- Optional human-readable `title` values could improve the built-in browser's visible tool list. They are a quality enhancement, not a requirement. The current adapter would need to forward `title`; it currently drops fields other than name, description, schema, annotations, and execute.

The `webmcp-types` npm package mentioned in Chrome's guide contains optional TypeScript types. It is not a runtime dependency and is irrelevant to this plain-JavaScript application unless the project later adopts a TypeScript build.

### Schemas and validation

Tool schemas are part of tool selection and argument construction, not only runtime validation. They should be narrow enough to make valid calls likely while application code remains the authority.

The baseline was strong on required fields, numeric types, enums, length constraints, and strict application-side validation. This branch additionally closes top-level and fixed `set_chain` objects. Future schema work should:

- Treat type-dependent `params` carefully. A generic open object is understandable but does not teach the model which keys and ranges belong to each node type. A discriminated `oneOf` per node type, or a much smaller focused capability response, would make the contract more self-contained.
- Keep dynamic checks in code. The app's safety policy, node-id existence, aggregate gain limits, terminal limiter rule, persistence success, and shared-state application cannot be delegated to JSON Schema.
- Return stable codes and corrective details for expected refusals. The app already does this well.

### Names, descriptions, and selection

Chrome recommends single-purpose tools, action-oriented names, positive descriptions of what and when, and minimal overlap. It advises against rigid prompt instructions that tell the model to follow a fixed tool sequence.

The ten names are concise and map cleanly to karaoke-chain tasks. The biggest description problems are size and forced-order language:

- `get_capabilities` says “before anything else” and “Call this first.”
- `get_chain` says to use it before any edit.
- Several mutation descriptions route the agent through `get_capabilities` even when the user's request and schema may already be sufficient.

Those phrases spend context and can make simple requests take unnecessary calls. Describe selection conditions instead, such as “Returns supported node types, parameter names, ranges, and safety constraints when a caller needs to construct or diagnose a chain.”

Chrome's [secure-tools guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools) lists “Tool description: up to 500 characters” and “Tool output: up to 1.5K characters,” alongside 30-character tool or parameter names and 150-character parameter descriptions. These are preliminary recommendations, not specification conformance limits. Current-checkout measurements found:

| Item | Current size | Suggested budget | Finding |
| --- | ---: | ---: | --- |
| `get_preset` description | 545 characters | 500 | Reduce |
| `load_preset` description | 656 characters | 500 | Reduce |
| `save_preset` description | 569 characters | 500 | Reduce |
| `get_preset.namespace` description | 154 characters | 150 | Slightly reduce |
| `load_preset.namespace` description | 159 characters | 150 | Slightly reduce |
| Serialized `get_capabilities` success result | 15,243 characters | 1,500 | High-priority reduction |

Description sizes were measured as JavaScript string lengths on the ten baseline definitions returned by `McpTools.getDefs()`. The baseline output size is `JSON.stringify(await get_capabilities.execute({})).length` in the repository's test sandbox with all six real node types loaded. These are serialized character counts, so actual model token cost will vary, but the comparison is like-for-like with Chrome's character guidance.

All baseline tool and parameter names fit the suggested name budget. The capability output was the material risk because it republished broad host-authored tables on every call, increased model context cost, and encouraged an extra prerequisite call. This branch addresses that P1 with a compact index that retains node types, parameter identifiers and units, ranges, and hard chain rules.

### Annotations and security

The current WebMCP draft defines `readOnlyHint` and `untrustedContentHint`, both defaulting to false. They are hints to the client, not authorization or enforcement.

The repository's annotation matrix is sound:

- `get_capabilities`, `get_chain`, `list_presets`, and `get_preset` are marked read-only.
- Results containing user-, caller-, or stored preset content are marked untrusted.
- Mutation tools are not marked read-only.
- Human-only Start, input selection, Bypass, and watchdog restore are not exposed as tools.

Keep those annotations, but continue enforcing policy in application code. The browser does not treat an annotation as proof that a tool is safe. The app's visible refusal, no-partial-apply policy, one-click Undo, terminal limiter rule, output attenuation, watchdog, and human-only emergency controls are stronger competition evidence than the annotation alone.

Expected policy refusals should continue to resolve as structured JSON with stable codes, reasons, and recovery suggestions. The draft allows a rejected execute promise, but converts callback failures to a generic `UnknownError` at the API boundary. The comment in `src/mcp-server.js:71-79` that the API has “no error channel” is therefore too absolute. Structured successful refusal results are still the better domain contract because they preserve corrective detail. Unexpected internal failures should not expose sensitive exception details to an agent or user.

### Shared state and human control

Chrome's [overview](https://developer.chrome.com/docs/ai/webmcp) and [workflow guide](https://developer.chrome.com/docs/ai/webmcp/build-tools) emphasize visible execution, shared state, and a normal human interface. Tool completion should leave the page visibly synchronized so the person can understand, continue, or recover from the action.

This is the project's strongest design choice. Mutation tools use the same `ChainCanvas`, preset store, preset UI, audio graph, toast, and Undo paths as human actions. Accepted calls visibly update the page; rejected calls leave the model unchanged and explain why; human-only emergency controls remain outside the agent surface.

There is one important asymmetry. `index.html:122-170` and `src/canvas.js:204-221` deliberately gate the human palette, canvas, and presets controls until the audio engine starts. WebMCP registration, however, occurs at page parse time, and model mutation paths can update the chain before the human grants microphone access. This does not violate the WebMCP API, and the resulting canvas can still be visible, but it weakens the claim that the human and agent have equivalent control of shared state.

The clean product direction is to allow both human and agent to edit the chain model before Start while keeping only audio-dependent controls gated. Starting the engine would then attach the existing model to Web Audio. If the product intentionally keeps the model locked before Start, agent mutations should follow the same lock and return a clear “start required” refusal. The current mixed behavior should not be left implicit.

### HTTPS, origins, and page placement

The draft makes `document.modelContext` a secure-context, origin-keyed API. Chrome's [overview](https://developer.chrome.com/docs/ai/webmcp) says WebMCP is subject to the `tools` Permissions Policy, whose default allowlist is `self`, and is disabled for pages that opt out of origin-keyed agent clustering. Cross-origin exposure must be explicit and should be limited to trusted secure origins.

The deployed URL, [https://karaoke.arrangedgodly.com/](https://karaoke.arrangedgodly.com/), is a secure top-level origin. A 2026-08-29 response-header check found no `Permissions-Policy: tools=()` denial and no `Origin-Agent-Cluster: ?0` opt-out. The app registers from top-level scripts, not an iframe. It has no need for cross-origin `exposedTo` configuration, and it should not add one.

The response currently includes `Access-Control-Allow-Origin: *`, but CORS does not grant WebMCP tool access. WebMCP exposure is governed by the page, secure-context and origin rules, and any explicit `exposedTo` policy. The wildcard is not a substitute for WebMCP configuration.

For Chrome-only testing, the competition and Chrome docs allow `chrome://flags/#enable-webmcp-testing`. Chrome also documents an origin trial for ordinary deployed Chrome use during the trial window. Neither is needed for the ChatGPT/Codex built-in-browser path. The Model Context Tool Inspector extension is an optional diagnostic client and is separate from Gemini; it is not a judge prerequisite.

### Evaluation

Chrome's [WebMCP evaluation guide](https://developer.chrome.com/docs/ai/webmcp/evals) separates deterministic tool tests from model-behavior evaluations. Both matter:

- Deterministic tests should verify schemas, application validation, result shapes, UI side effects, safety refusals, and Undo. This repository already has strong coverage here.
- Agent evaluations should test tool discovery, selection, arguments, recovery, and final visible state from direct and ambiguous natural-language requests with the complete relevant tool set available.
- Evaluation should check the user journey, not only whether a tool was invoked. For this app, that means the right chain, visible summary, preserved limiter, recoverable Undo, and continued human authority.

Recommended prompts include a direct preset load, a natural-language sound goal that can be solved more than one way, a parameter adjustment requiring a node lookup, a protected-limiter removal, an unsafe ceiling request, an ambiguous preset namespace, and a correction after an invalid parameter. Run them through the actual built-in browser on the normal deployed URL, without `?dev`.

## Repository comparison

| Area | Current implementation | Verdict | Recommended action |
| --- | --- | --- | --- |
| WebMCP architecture | `src/mcp-server.js` calls the page's model context; `src/mcp-tools.js` self-registers ten tools | Correct architecture | Keep the imperative in-page path. Do not add a conventional MCP server or manifest. |
| Top-level discovery | Scripts are loaded directly by `index.html`; no iframe | Matches the OpenAI client subset | Preserve top-level registration and test in the real client. |
| Runtime package | No SDK or runtime package | Correct | Keep zero-runtime-dependency delivery. Treat `webmcp-types` as optional typings only. |
| Registration lifecycle | Ten stable tools register during parse, sequentially, on every load | Reasonable and aligned with static-registration guidance | Surface aggregate success or failure clearly in test evidence. Do not invent client timing guarantees. |
| Result shape | Plain objects, structured policy refusals, AbortSignal passed through | Correct and robust | Correct the “no error channel” comment; sanitize unexpected internal failures. |
| Schemas | Typed, required fields and enums, strict runtime validation; baseline fixed objects were open | Known boundaries closed on this branch | Consider type-specific parameter schemas after built-in-browser evaluation. |
| Descriptions | Baseline had three over-budget descriptions and forced-order language | Addressed with deterministic budget checks | Keep descriptions focused on purpose and selection. |
| Tool output | Baseline `get_capabilities` was about 15.2K characters | Highest baseline tool-contract risk; addressed on this branch at 1,463 characters | Keep the compact index under its deterministic budget. |
| Annotations | Read-only and untrusted-content hints match actual behavior | Strong | Preserve and test the matrix; never rely on hints for enforcement. |
| Visible shared state | Same model/UI path, change toast, refusal toast, Undo | Competition strength | Feature this explicitly in the demo and written submission. |
| Pre-Start control | Agent model writes are available while the human editing surface is gated | Product-control mismatch | Prefer pre-Start model editing for both; otherwise refuse agent mutations until Start. |
| Origin | Live HTTPS top-level page; no observed header opt-out | Ready in current deployment snapshot | Add a release header check so CDN changes cannot silently disable tools. |
| Judge documentation | Baseline Chrome extension instructions could look like a prerequisite | Addressed on this branch | Keep optional diagnostics clearly separated from judge setup. |
| Acceptance | Baseline led with Chrome DevTools rather than the competition client | Reordered on this branch | Execute and record the built-in-browser checklist on the deployed URL. |
| Inline documentation | Baseline described an echo canary, eight tools, stubs, and an eight-tool harness | Addressed on this branch | Keep shipped tool counts and lifecycle comments current. |
| Human-readable titles | Tool definitions omit optional `title`; adapter drops it | Optional polish | Add concise titles only if the real built-in browser shows a meaningful UX gain. |
| Agent evals | Strong deterministic suite, no documented probabilistic selection corpus | Missing judge-like evidence | Add a small direct-plus-ambiguous prompt corpus and record model/client/date with results. |

## Recommended implementation sequence

1. **Correct the mental model and judge path.** Rename or clearly describe the in-page adapter, remove stale eight-tool and canary comments, and label Inspector/DevTools/harness steps as diagnostics. Make the built-in browser the first acceptance section.
2. **Optimize the tool contract.** Slim `get_capabilities`, shorten the three long tool descriptions, remove forced sequencing, and close fixed schemas. Add deterministic budgets to registration tests so metadata does not grow back.
3. **Resolve pre-Start parity.** Let both actors edit the non-audio model before microphone permission, or gate both consistently. Keep Start, microphone choice, Bypass, and watchdog restore human-only.
4. **Add judge-like evaluation.** Test the normal deployed URL in the current ChatGPT/Codex built-in browser with supported models. Capture discovery count, direct and ambiguous selection, accepted mutation, refusal, visible state, Undo, and human Bypass evidence.
5. **Finish submission evidence.** The current `README.md:133-145` still contains a video placeholder. Confirm the repository license and Devpost entry, then record the under-three-minute public demonstration. Document which WebMCP work was added during the contest period.

## Acceptance criteria for the next branch

- Opening the normal deployed URL in a supported ChatGPT/Codex built-in browser exposes exactly ten page-scoped tools without an extension, flag, `?dev`, side server, manifest, or connection setup.
- The address-bar Site tools view shows the expected tools, and one tool can be called from a normal Codex task.
- Tool registration remains top-level and imperative; no tool is registered inside an iframe.
- Every fixed-shape input schema rejects undeclared properties both declaratively and in runtime validation.
- Tool and parameter metadata stays within Chrome's preliminary character guidance unless a documented evaluation proves a justified exception.
- Typical success, refusal, and recovery outputs stay close to the 1.5K guidance. Any larger read output has an explicit reason and evaluation evidence.
- A human can see and continue from every agent-applied state. Before Start, human and agent model-edit permissions are consistent.
- Direct and ambiguous prompts select the intended tools, invalid calls return corrective structured results, safety requests refuse without partial application, and Undo restores the prior visible state.
- The deployed response remains HTTPS and does not disable the `tools` permission or origin-keyed agent clustering.
- The README, acceptance checklist, video, and Devpost entry describe the same judge path and do not present Chrome diagnostics as prerequisites.

## Primary sources

- [WebMCP Challenge overview](https://webmcp.devpost.com/)
- [WebMCP Challenge official rules](https://webmcp.devpost.com/rules)
- [WebMCP Challenge resources](https://webmcp.devpost.com/resources)
- [OpenAI Site tools for ChatGPT Work and Codex](https://learn.chatgpt.com/docs/webmcp)
- [OpenAI Help Center: Using Site tools in the ChatGPT desktop app](https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app)
- [OpenAI Help Center: Using the built-in browser](https://help.openai.com/en/articles/20001277-using-the-built-in-browser-in-the-chatgpt-desktop-app)
- [Chrome: WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome: WebMCP and MCP](https://developer.chrome.com/docs/ai/webmcp/compare-mcp)
- [Chrome: Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome: Best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Chrome: Secure your tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome: Build AI-friendly workflows](https://developer.chrome.com/docs/ai/webmcp/build-tools)
- [Chrome: Evaluate WebMCP tools](https://developer.chrome.com/docs/ai/webmcp/evals)
- [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/)
- [WebMCP proposal repository](https://github.com/webmachinelearning/webmcp)
