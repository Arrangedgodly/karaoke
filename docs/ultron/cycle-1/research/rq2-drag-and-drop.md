# RQ-2: Drag-and-Drop Node Canvas — Library vs. Custom Pointer Events

## Question

Should the drag-and-drop node canvas (palette → drag node onto canvas → drag to reorder within the chain) be built using an existing library, or with custom pointer-event handling (`pointerdown`/`pointermove`/`pointerup`)?

**Affected task IDs:** UI-3 ("Drag-and-drop canvas mechanics") — critical path, blocked pending this decision.

Also touches **DEL-1** (project scaffold, currently scoped "plain JS or minimal bundler"): the recommendation below adds one small dependency but does **not** require adopting a framework, so DEL-1's framing survives largely intact — see "Implementation consequences."

---

## Constraints & evaluation criteria

- **Desktop-only.** No mobile/tablet requirement — touch support, multi-touch gestures, and inertia/momentum are not decision factors.
- **Single operator** (the host), not a multi-user or performer-facing surface — no need for real-time sync, undo-stack collaboration, or accessibility-for-many-input-types beyond normal desktop mouse use.
- **Linear/chain-shaped arrangement, not a freeform graph.** The canvas is a reorderable sequence of nodes (Gain → Compressor → EQ → Delay → Reverb → Limiter, in some host-chosen order) with fixed, implicit input/output anchors — not arbitrary many-to-many wiring between nodes.
- **Build-fast constraint.** The team wants a working demo quickly.
- **Prefer well-supported, low-complexity approaches over exotic ones when the tradeoff is close.** This governs the recommendation below: avoid both platform-quirk-heavy native APIs and heavyweight/over-scoped libraries when a simpler well-maintained option fits the actual problem shape.
- Currency requirement: prefer actively-maintained libraries (checked last release/commit and open-issue health as of 2026-08-26); do not recommend an abandoned package.

---

## Options considered

### 1. Native HTML5 Drag and Drop API

**What it is:** `draggable="true"` + `dragstart`/`dragenter`/`dragover`/`drop`/`dragend` events, with data passed via `DataTransfer`. Spec: [WHATWG HTML Living Standard §Drag and Drop](https://html.spec.whatwg.org/multipage/dnd.html). Reference: [MDN — HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API).

**Suitability for this use case:** Poor-to-mediocre fit even setting touch aside. It was designed primarily for dragging files/links/selections in and out of the browser, not for building a polished in-app reorderable list.

**Known quirks/limitations** (per MDN and [sam.today — "HTML5 Drag & Drop: Not the API You're Looking For"](https://www.sam.today/blog/html5-dnd-the-api-that-is-gaslighting-you)):
- **Inconsistent drag-image rendering across browsers** — Chrome renders the drag image at full opacity, Firefox renders it translucent, WebKit offsets it; `setDragImage()` only fires once at `dragstart` and can't be updated mid-drag.
- **No scroll-while-dragging** — described as a "table-stakes feature" that the native API simply doesn't provide.
- **Cursor customization is limited to four native cursor states**, which most designers find visually unattractive/uncustomizable.
- **Can't reliably read the dragged payload during `dragover`** in Chrome and Safari — data is only readable at `drop`, forcing developers to keep a parallel piece of state in JS anyway (which undercuts the API's main selling point of carrying data for you).
- Safari has additional quirks around requiring MIME data to be set at drag start.
- The author's explicit recommendation: *"Don't use the HTML5 DnD API, unless you're implementing a file upload widget... or have a passion for frustration."* — reserve it for cross-window/cross-application drags, which is the one thing it genuinely does that nothing else can.
- Note: this app is desktop-only, so the native API's well-known lack of touch support is not itself a disqualifier here — but the drag-image/scroll/styling quirks above apply regardless of input device and are the real reasons to avoid it for this feature.

**Verdict:** Not recommended as the direct implementation mechanism. (It's relevant only as the substrate some libraries, e.g. SortableJS, optionally use — see below.)

---

### 2. SortableJS

- **Repo:** [github.com/SortableJS/Sortable](https://github.com/SortableJS/Sortable) — 31,172 stars, MIT license.
- **Maintenance:** Latest npm release **v1.15.7**. Last push to the repo: **2026-03-24**; repo metadata last updated 2026-08-25. 524 open issues — high in absolute terms but typical for a decade-old library with very broad adoption (not a sign of abandonment; contrast with the ~2-year-stale repos below).
- **Bundle size:** ~45.8 KB minified / **~18.3 KB gzipped**, zero runtime dependencies (confirmed via npm registry + Bundlephobia).
- **What it is:** Purpose-built reorderable-list/drag-and-drop library. "No jQuery or framework required" — works as a plain `<script>` include or npm package with no build step.
- **Fit for this problem:** Very close to 1:1. SortableJS's core feature — dragging items within a list, plus dragging items *between two connected lists* via its `group`/`pull`/`clone` options — maps directly onto "drag from palette list → clone/instantiate into chain list → drag to reorder within chain list."
- **Important nuance:** SortableJS is *"Built using native HTML5 drag and drop API"* by default, meaning it can inherit some of the ghost-image/cursor quirks described above. It ships a `forceFallback: true` option that switches it to a custom mouse/pointer-based implementation instead, giving full control over the drag visual (avoiding native drag-image quirks entirely) while keeping all of SortableJS's already-solved reorder/swap/animation/nested-list logic. This should be set explicitly rather than relying on the native-DnD default.
- **Framework path stays open:** official wrappers exist (Vue.Draggable, React wrappers, Angular, Ember, Knockout, etc.) if the project later adopts a framework — using it now in vanilla JS is not a dead end.

### 3. interact.js

- **Repo:** [github.com/taye/interact.js](https://github.com/taye/interact.js) — 12,925 stars, MIT license.
- **Maintenance:** Latest npm release **v1.10.28**, published ~2026-08-16 (10 days before this research date). Last push 2026-08-01. 95 open issues. Very actively maintained — the most recently-touched of all the libraries evaluated here.
- **Bundle size:** ~97.3 KB minified / **~28.7 KB gzipped**. TypeScript source, ships its own types.
- **What it is:** General-purpose drag/resize/gesture library — inertia physics, snap-to-grid, multi-touch, rotate/resize modifiers.
- **Fit for this problem:** Weaker than SortableJS. interact.js gives you normalized drag primitives (pointer deltas, snapping, inertia) but has **no built-in list-reordering/swap-detection logic** — you would still hand-roll the "which slot does this drop into" and DOM-reordering logic yourself, on top of the library. Its standout features (inertia, multi-touch, resize/rotate) are aimed at freeform canvas manipulation, none of which this desktop-only, fixed-node-shape feature needs. It's a fine library, just aimed at a different problem than "reorder a list."

### 4. Node-graph / visual-editor libraries

Evaluated because the feature is described as a "node canvas," but the RQ correctly flags that this app's shape (linear chain, fixed anchors) is much narrower than what these libraries are built for (arbitrary many-to-many wiring, like a shader graph or Blueprint editor).

| Library | Stars | Last push | Open issues | Bundle (gzip) | Notes |
|---|---|---|---|---|---|
| [LiteGraph.js](https://github.com/jagenjo/litegraph.js) | 8,114 | **2024-08-01** | 146 | — | ~2 years stale as of Aug 2026; low weekly downloads (~1.8k/wk per npmtrends). **Maintenance risk.** |
| [Drawflow](https://github.com/jerosoler/Drawflow) | 6,106 | **2024-10-19** | 272 | ~8.7 KB | Vanilla JS, no deps, lightweight — but ~22 months stale as of Aug 2026. **Maintenance risk.** |
| [Rete.js](https://github.com/retejs/rete) | 12,226 | 2026-07-24 | 14 (well-triaged) | — | Actively maintained. Plugin architecture: core + area-plugin (pan/zoom) + connection-plugin (wiring) + a render plugin per framework (React/Vue/Angular/Svelte/vanilla) — several packages to assemble, real integration/learning overhead. |
| [React Flow / @xyflow](https://github.com/xyflow/xyflow) | 38,154 | **2026-08-26 (today)** | 126 | ~59.8 KB (package only) | Most popular and best-maintained of the group, commercially backed. `@xyflow/react` v12.11.5 requires **React ≥17 / ReactDOM ≥17** as peer deps (plus ships zustand, classcat, @xyflow/system) — adopting it means adopting React. `@xyflow/svelte` is the Svelte equivalent, same tradeoff with Svelte. |

**Verdict on this whole category:** all four are engineered to solve arbitrary-graph wiring (multiple typed ports, many-to-many connections, live dataflow execution, minimap/pan/zoom over a large canvas). Using any of them here means either (a) fighting the library to *constrain* it down to "always exactly one linear chain, fixed order, no branching" — extra integration work for capability you're actively suppressing — or (b) accepting a stale/higher-risk dependency (LiteGraph, Drawflow) or a much larger footprint plus a new framework dependency not currently in the plan (Rete's multi-plugin setup, or React Flow/Svelte Flow's framework requirement). This category is overkill for a reorderable linear chain.

### 5. Custom pointer-events implementation

**Mechanism:** `pointerdown`/`pointermove`/`pointerup`/`pointercancel` with `setPointerCapture()`, per [MDN — Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) (Baseline/widely available since July 2020 — unified mouse/pen/touch model, though touch is moot here given desktop-only scope).

**Realistic scope for this specific feature** (linear chain, ~6 fixed node types, single short list, no nested lists, no cross-window drag, no touch):
1. Palette → canvas: `pointerdown` on a palette item creates an absolute-positioned "ghost" that tracks `clientX/clientY` on `pointermove`; `pointerup` over the chain container instantiates a real chain-node at the drop index.
2. In-chain reorder: `pointerdown` on a chain node captures the pointer; `pointermove` translates the dragged node and compares its center against sibling midpoints to decide when to swap; `pointerup` commits the final array order and clears capture.
3. Visual feedback: a dragged-state class (opacity/scale) plus an insertion-line/placeholder to show the target slot.

**Real-world complexity signal:** a walkthrough of building drag-and-drop from scratch with pointer events ([dev.to/childrentime — "React Drag and Drop Without External Libraries"](https://dev.to/childrentime/react-drag-and-drop-without-external-libraries-1bof)) shows that even the *simple* single-drag case needs meaningful state management (position, dragging flag, delta), `getBoundingClientRect` math for bounds, careful listener cleanup, and pointer-type filtering — and explicitly notes real-world requirements (bounds clamping, drag-handle separation, drop-zone coordination) "quickly pile on more complexity" beyond that baseline.

**Estimate for this app's narrower shape:** roughly 150–300 lines of vanilla JS/CSS for a robust version with swap-detection and simple FLIP-style reanimation — smaller than a general-purpose implementation because there's no nested-list support, no cross-window drag, no touch/pen handling, and only two containers (one palette, one chain) to coordinate. Realistically well under a day of focused work for an experienced developer, but every edge case (click-vs-drag threshold, Escape-to-cancel, auto-scroll if the chain overflows the viewport, re-entrant pointer capture bugs) is hand-built and hand-tested rather than already solved and battle-tested by thousands of other consumers.

---

## Recommendation & rationale

**Use SortableJS (vanilla JS, no framework), with `forceFallback: true`.**

- It is the only option evaluated whose core purpose — reorder-in-place plus drag-between-two-connected-lists — is a near-exact match for "palette → drag node onto canvas → drag to reorder within the chain," via its `group`/`pull`/`clone` options (palette list configured to clone/pull into the chain list, chain list sortable within itself).
- It is actively maintained by the standard reasonable to apply to a mature, feature-complete library (v1.15.7 on npm, MIT, 31k stars, still receiving pushes in 2026, zero runtime deps) — not abandoned, unlike LiteGraph.js and Drawflow (~2 years without a push each).
- Small, dependency-free footprint (~18 KB gzipped) that drops into a plain-JS or minimal-bundler setup with zero friction, keeping DEL-1's "plain JS or minimal bundler" framing intact.
- `forceFallback: true` sidesteps every native-HTML5-DnD quirk flagged in this RQ (drag-image inconsistency, no scroll-while-dragging, limited cursor styling) by switching SortableJS to its pointer/mouse-based fallback mode — so you get full custom visual control *and* reuse SortableJS's already-solved, cross-tested swap/animation/list logic instead of hand-rolling it.
- Against custom pointer-events: building this by hand is entirely feasible at this small scale (only ~6 node types, one short chain, desktop-only) and is a legitimate close second — in fact `forceFallback` mode is functionally what SortableJS does internally. But re-solving swap-detection, ghost rendering, and cross-list palette→chain dragging from scratch duplicates work a free, well-supported library has already solved and battle-tested, which cuts against the "build fast" and "prefer well-supported over exotic when close" constraints for no real benefit — this app doesn't need to avoid all dependencies, only heavy/exotic ones, and an 18 KB, zero-dependency, purpose-built library is neither.
- Against interact.js: better-maintained on paper (more recent push) but not purpose-built for reordering — you'd still write the reorder/swap logic yourself on top of it, making it strictly more work than SortableJS for this specific need with none of its snapping/inertia/multi-touch strengths being relevant on a desktop-only, single-operator app.
- Against the node-graph libraries: all four are solving a materially bigger problem (arbitrary graph wiring) than this app has, and two of the four (LiteGraph, Drawflow) also carry real staleness risk. Even the best-maintained one (React Flow/@xyflow) would force a framework adoption decision that the "build fast," framework-agnostic-so-far plan doesn't currently need.

**No framework is needed for this feature.** SortableJS works standalone in vanilla JS. Adopting React or Svelte specifically to unlock React Flow or dnd-kit (a React-only sortable/DnD toolkit that also came up in research) would add a framework dependency and meaningfully more bundle weight for capability (arbitrary graph UI, React ecosystem conveniences) this feature doesn't need. If the wider app adopts a framework later for unrelated reasons, SortableJS's official wrappers (Vue.Draggable, react-sortablejs, ngx-sortablejs, etc.) mean this choice isn't a dead end.

---

## Evidence

| Source | What it establishes |
|---|---|
| [MDN — HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) | Native DnD event model, `DataTransfer` semantics, spec reference |
| [WHATWG HTML spec §dnd](https://html.spec.whatwg.org/multipage/dnd.html) | Authoritative spec for native DnD behavior |
| [sam.today — "HTML5 Drag & Drop: Not the API You're Looking For"](https://www.sam.today/blog/html5-dnd-the-api-that-is-gaslighting-you) | Concrete, named quirks (drag-image inconsistency, no scroll-while-dragging, 4-cursor limit, dragover data-read restrictions in Chrome/Safari) and explicit "avoid it outside file upload / cross-window" recommendation |
| [MDN — Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) | Pointer Events model, Baseline since July 2020, `setPointerCapture` pattern for custom drag |
| [dev.to/childrentime — custom pointer-events drag and drop](https://dev.to/childrentime/react-drag-and-drop-without-external-libraries-1bof) | Real-world account of custom-implementation complexity/scope |
| [github.com/SortableJS/Sortable](https://github.com/SortableJS/Sortable) + [npm sortablejs](https://www.npmjs.com/package/sortablejs) | 31,172 stars, MIT, v1.15.7, last push 2026-03-24, 524 open issues, zero runtime deps, "Built using native HTML5 drag and drop API" + `forceFallback` option confirmed from README |
| Bundlephobia API (`bundlephobia.com/api/size?package=sortablejs`) | ~18.3 KB gzip / ~45.8 KB min for sortablejs |
| [github.com/taye/interact.js](https://github.com/taye/interact.js) | 12,925 stars, MIT, latest v1.10.28 (published ~2026-08-16), last push 2026-08-01, 95 open issues |
| Bundlephobia API (`interactjs`) | ~28.7 KB gzip / ~97.3 KB min |
| [github.com/jagenjo/litegraph.js](https://github.com/jagenjo/litegraph.js) (GitHub API) | 8,114 stars, MIT, last push 2024-08-01, 146 open issues — staleness signal |
| [github.com/jerosoler/Drawflow](https://github.com/jerosoler/Drawflow) (GitHub API) | 6,106 stars, MIT, last push 2024-10-19, 272 open issues — staleness signal; Bundlephobia ~8.7 KB gzip |
| [github.com/retejs/rete](https://github.com/retejs/rete) (GitHub API) | 12,226 stars, MIT, last push 2026-07-24, 14 open issues — actively maintained, plugin architecture confirmed |
| [github.com/xyflow/xyflow](https://github.com/xyflow/xyflow) (GitHub API) + [npm @xyflow/react](https://registry.npmjs.org/@xyflow/react/latest) | 38,154 stars, MIT, last push 2026-08-26, 126 open issues, v12.11.5, peer deps react/react-dom ≥17, deps zustand/classcat/@xyflow-system; Bundlephobia ~59.8 KB gzip (package only, excludes React) |
| npmtrends (`drawflow-vs-litegraph.js-vs-rete`) | Weekly download comparison: Rete ~53.5k/wk, Drawflow ~19.1k/wk, LiteGraph.js ~1.8k/wk — corroborates LiteGraph's comparatively low current adoption |

All GitHub star/issue/push-date figures captured 2026-08-26 via the GitHub REST API; all npm version figures captured the same day via the npm registry API; all bundle sizes via the Bundlephobia API.

---

## Tradeoffs, risks, confidence

**Tradeoffs of the recommendation:**
- Adds one small (~18 KB gzip), zero-dependency, MIT-licensed runtime dependency to an otherwise dependency-light plan — a minor, low-risk addition, not a framework commitment.
- SortableJS's palette→chain pattern clones/pulls a DOM node between lists; the app needs an `onAdd`/`onClone`-style handler to swap the cloned palette DOM element for a real instantiated effect-node (with its own controls/state), rather than just cloning markup. This is normal, documented SortableJS usage but should be called out explicitly as part of UI-3's scope so it isn't discovered mid-implementation.
- `forceFallback: true` must be set deliberately; left at the default, SortableJS falls back to native-HTML5-DnD-backed dragging on desktop browsers and would reintroduce the ghost-image/cursor quirks this research flags.

**Risks:**
- Low risk overall — SortableJS is a widely-adopted, long-lived library with a huge base of real-world reorder-plus-clone-between-lists usage, so the palette→chain pattern is well-trodden, not novel.
- The main residual risk is integration shape, not the library: mapping SortableJs's DOM-order-of-truth model onto the app's actual JS data model (an ordered array of effect-node configs feeding the Web Audio graph) needs a clear single source of truth (recommend: DOM order via SortableJS's `onSort`/`onEnd` callbacks writes back to the JS array immediately, and the JS array is what actually rebuilds the audio node chain — never let the two drift).

**Confidence:** **High** on the two clearest calls — avoid native HTML5 DnD directly, and avoid the node-graph-editor libraries (over-scoped for a linear chain, and two of the four candidates show real staleness). **Medium-high** on SortableJS specifically over hand-rolled custom pointer-events — both are legitimate at this app's small scale, and the "which is genuinely faster to build" answer depends somewhat on the implementer's familiarity with SortableJS's API vs. raw pointer-event plumbing; the recommendation leans on "well-supported over exotic/hand-built when the tradeoff is close" as the explicit tie-breaker per the stated evaluation criteria.

---

## Implementation consequences

**For UI-3 ("Drag-and-drop canvas mechanics"):**
- Add `sortablejs` (vanilla, no wrapper package) as a project dependency — works via `<script>` tag/CDN or npm import with no build-step requirement, compatible with a "plain JS or minimal bundler" scaffold.
- Configure two connected Sortable instances: a `group`-linked, pull-clone palette list (Gain/Compressor/EQ/Delay/Reverb/Limiter) and a sortable chain list on the canvas.
- Set `forceFallback: true` on both instances so dragging is pointer/mouse-driven rather than native-HTML5-DnD-driven, avoiding the drag-image/cursor/scroll quirks documented above.
- Implement an `onAdd` handler on the chain list to replace the cloned palette DOM node with a real, stateful chain-node component/element (not just reuse the clone), and wire `onSort`/`onEnd` to write the resulting DOM order back into the JS array that drives the actual Web Audio node graph rebuild — that array, not the DOM, should remain the single source of truth for audio wiring.
- Style the dragged/ghost element and an insertion placeholder for clear visual feedback during drag (addressing the RQ's usability concern directly, since `forceFallback` mode gives full control over both).

**Knock-on effect on DEL-1 (project scaffold):** Minimal. This adds one small, framework-agnostic, zero-dependency runtime library — it does **not** require adopting React, Svelte, or any other framework, so DEL-1's "plain JS or minimal bundler" scoping stands. The only scaffold-level change is ensuring the build/script setup can load one additional npm package (or CDN script) — a trivial addition regardless of whether DEL-1 ends up using a bundler or plain `<script>` tags.

---

## Decision priority/status

- **Priority:** P0 (blocks UI-3, critical path)
- **Status:** Proposed — awaiting user approval. Not committed.
