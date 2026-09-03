// Test for redesign item 1b — the TWO-DECK STACK page structure
// (docs/ultron/redesign.md; locked card `two-deck-stack`,
// .impeccable/decision-surface-1b-payload.json).
//
// Covers the structure this build shipped, against the REAL index.html
// + styles/main.css (no fake DOM):
//   A. MARKUP — the chassis wrappers the composition law demands:
//      .instrument (one outer shell) wrapping, in order, the SYSTEM DECK
//      (header.topbar.system-deck — .topbar kept verbatim as agent-ui's
//      chip mount), the MACHINED SEAM (.deck-seam, aria-hidden), and the
//      VOICE DECK (#chain-layout with .voice-deck added, .layout +
//      engine-not-started + id unchanged). The seam SITS BETWEEN the two
//      decks — the joint, not a gap. Nothing else moved: every wiring
//      id survives, #bypass-toggle-button stays the topbar's LAST child
//      (the #agent-chip insertion point), and the deck's child order is
//      identity → system-etch → controls → bypass.
//   B. THE ETCH WRAPPER — .system-etch wraps exactly the status block +
//      the readout group (the one group the <900px rule wraps), inside
//      the topbar, before the controls.
//   C. SEAM VOCABULARY — the deck seam is drawn as a machined joint and
//      is the DEEPEST cut on the page: a 4px cut under a 1px lip, both
//      deeper/brighter than the 1px+1px section grooves (token-level
//      comparison), on the instrument chassis frame.
//   D. SYSTEM DECK TOKENS — the deck's own cast, the etch's register
//      ground, the orange Start key, BYPASS's red-edge/red-fill pairing
//      and its loudness floor, and the global orange focus ring.
//   E. ETCH SUBORDINATION — the system deck's dot-matrix etch stays
//      quieter than the chain face's display register: NEUTRAL print
//      (never the register's amber/orange machine voice) and readouts at
//      the smaller value tier (12px vs the register's 13.6px main line).
//      Since the 2026-09-03 distance-readability step (critique P3 #5):
//      the status SENTENCE alone rides the 13.6px register tier — it is
//      the operator's primary verbal status from across a dark room —
//      while the readouts, the demoted technical footnote, and the
//      neutral ink stay subordinate.
//   F. VOICE-DECK ZONES + SHARED DISABLED GRAMMAR — the three zones sit
//      on one faceplate with groove separators (cut+lip pairs), and the
//      pre-Start gate hatch covers BOTH flanking zones with the exact
//      gradient the canvas face uses (one grammar, three zones).
//   G. VIEWPORT LAW — responsive system-deck grids keep state, controls,
//      and BYPASS in named rows while the voice deck stacks below 901px.
//   H. CHIP KEYS KEEP THE FLAT-BUTTON CONTRACT — chips restyle as panel
//      keys while staying real buttons in the flat DOM order with the
//      catch-all family fallback (the palette suite holds the behavioral
//      half; this pins the restyle's structure).
//
// Same committed-test convention as the rest of the suite: zero-dependency
// Node harness, per-check "  ok - " / "  FAIL - " prints, exit 0 on pass.
//
// Run from a clean clone:  node tests/test-two-deck-stack.js
// (or via the runner:      node tests/run.js two-deck)
// Exits 0 on pass, 1 on any failure.

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

var failures = [];

function check(cond, label) {
  if (cond) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

// ----------------------------------------------------------------------
// Minimal tag-stack parser over the static markup (comments stripped,
// void elements folded in) — enough DOM honesty for structure pins on a
// hand-authored file. Parses ONLY up to the first <script> tag: the
// instrument markup is entirely static, and script source text is not
// markup.
// ----------------------------------------------------------------------
var HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

var VOID_TAGS = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;

function parseAttrs(raw) {
  var attrs = {};
  var re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|[^\s]+)/g;
  var m;
  while ((m = re.exec(raw))) {
    attrs[m[1]] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[2]);
  }
  return attrs;
}

function parseMarkup(html) {
  var bodyStart = html.indexOf('<body');
  var scriptAt = html.indexOf('<script', bodyStart);
  var region = html.slice(bodyStart, scriptAt === -1 ? undefined : scriptAt);

  var root = { tag: '#root', attrs: {}, children: [] };
  var stack = [root];
  var re = /<!--[\s\S]*?-->|<(\/?)(\w+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  var m;
  while ((m = re.exec(region))) {
    if (m[0].charAt(1) === '!') {
      continue; // comment
    }
    var tag = m[2].toLowerCase();
    if (m[1] === '/') {
      for (var i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    var node = { tag: tag, attrs: parseAttrs(m[3] || ''), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!VOID_TAGS.test(tag)) {
      stack.push(node);
    }
  }
  return root;
}

var tree = parseMarkup(HTML);

function classesOf(node) {
  return node && node.attrs['class'] ? node.attrs['class'].split(/\s+/) : [];
}

function hasClass(node, cls) {
  return classesOf(node).indexOf(cls) !== -1;
}

function descendants(node, pred, acc) {
  acc = acc || [];
  (node.children || []).forEach(function (child) {
    if (pred(child)) {
      acc.push(child);
    }
    descendants(child, pred, acc);
  });
  return acc;
}

function childByClass(node, cls) {
  var found = null;
  (node.children || []).some(function (c) {
    if (hasClass(c, cls)) {
      found = c;
      return true;
    }
    return false;
  });
  return found;
}

function byId(id) {
  return descendants(tree, function (n) { return n.attrs.id === id; })[0] || null;
}

var bodyEl = descendants(tree, function (n) { return n.tag === 'body'; })[0];

// ----------------------------------------------------------------------
console.log('A. markup — the chassis wrappers (system deck / seam / voice deck)');

var instrument = childByClass(bodyEl, 'instrument');
check(!!instrument, '.instrument exists as a direct child of <body> (one outer shell)');

var deckHeader = instrument && childByClass(instrument, 'topbar');
check(
  !!deckHeader && deckHeader.tag === 'header' &&
    hasClass(deckHeader, 'system-deck') &&
    hasClass(deckHeader, 'topbar'),
  'the system deck is header.topbar.system-deck (.topbar kept verbatim — agent-ui chip mount)'
);

var seam = instrument && childByClass(instrument, 'deck-seam');
check(
  !!seam && seam.children.length === 0 && seam.attrs['aria-hidden'] === 'true',
  '.deck-seam exists, empty and aria-hidden (purely decorative geometry)'
);

var layout = instrument && childByClass(instrument, 'layout');
check(
  !!layout && layout.attrs.id === 'chain-layout' &&
    hasClass(layout, 'voice-deck') &&
    hasClass(layout, 'engine-not-started'),
  'the voice deck is #chain-layout with .voice-deck added; .layout + engine-not-started + id unchanged'
);

// DOM order inside the instrument: system deck → seam → voice deck (the
// joint sits BETWEEN the slabs) → the Simple shell (wayfinder #47's
// #simple-layout, a sibling of #chain-layout — styles/main.css shows
// exactly one at a time; both exist in the DOM from page load).
var simpleLayout = instrument && instrument.children.filter(function (c) {
  return c.attrs && c.attrs.id === 'simple-layout';
})[0];
check(
  !!instrument &&
    instrument.children.length === 4 &&
    instrument.children[0] === deckHeader &&
    instrument.children[1] === seam &&
    instrument.children[2] === layout &&
    instrument.children[3] === simpleLayout,
  'instrument children are exactly [system deck, deck seam, voice deck, simple shell] in order (wayfinder #47)'
);

// The system deck's own child order — identity, the view switch
// (wayfinder #47 — its own topbar-section, not packed inside identity;
// see that section's own comment), etch, controls, BYPASS last (the
// agent chip inserts before BYPASS and after controls).
var deckChildren = deckHeader ? deckHeader.children : [];
var lastDeckChild = deckChildren[deckChildren.length - 1];
check(
  deckChildren.length === 5 &&
    hasClass(deckChildren[0], 'topbar-identity') &&
    hasClass(deckChildren[1], 'topbar-viewswitch') &&
    hasClass(deckChildren[2], 'system-etch') &&
    hasClass(deckChildren[3], 'topbar-controls') &&
    lastDeckChild.attrs.id === 'bypass-toggle-button',
  'system deck order: identity → view switch (#47) → system-etch → controls → #bypass-toggle-button (LAST — the #agent-chip insertion point)'
);

var viewSwitchSection = deckChildren[1];
check(
  !!viewSwitchSection && descendants(viewSwitchSection, function (n) { return n.attrs.id === 'view-switch-simple'; }).length === 1 &&
    descendants(viewSwitchSection, function (n) { return n.attrs.id === 'view-switch-advanced'; }).length === 1,
  'the view switch carries both #view-switch-simple and #view-switch-advanced (wayfinder #47)'
);

// Every wiring id the three UI scripts resolve survives the restructure.
[
  'start-button', 'input-device-select', 'status', 'status-dot', 'status-text',
  'start-hint', 'readout-sample-rate', 'readout-latency', 'readout-node-count',
  'chain-layout', 'palette-list', 'chain-canvas', 'chain-list', 'empty-hint',
  'save-preset-btn', 'preset-search-input', 'preset-list',
  'current-preset-name', 'unsaved-indicator'
].forEach(function (id) {
  check(byId(id) !== null, 'wiring id survives: #' + id);
});

// The voice deck's direct children (split-panel round, 2026-09-01 user
// direction: the old shared Effects/Presets .build panel is retired —
// Presets stays the left sidebar (.presets-panel, FIRST child, same
// position .build held), Effects moves back underneath the board as its
// OWN panel, a new third child of .voice-deck-face after .canvas-panel
// and .signal-order. .layout itself runs as a row at >=901px and reverts
// to a plain stacked column below that — see the flex-direction check
// further down).
var zones = layout ? layout.children : [];
check(
  zones.length === 2 &&
    hasClass(zones[0], 'presets-panel') && hasClass(zones[0], 'panel') &&
    hasClass(zones[1], 'voice-deck-face'),
  'voice deck top-level children in order: .presets-panel | .voice-deck-face'
);
// Live round 2026-09-03: the OUTPUT SCOPE BAND joins the face between the
// board and the strip — the Simple stage's scope as a second VIEW on this
// deck, directly under the board's OUT meter, which is the tap it reads.
// It is NOT a .panel: it is a printed band on the chassis in the strip's
// own vocabulary, so the panel checks below deliberately skip it.
var faceZones = zones[1] ? zones[1].children : [];
check(
  faceZones.length === 5 &&
    hasClass(faceZones[0], 'canvas-panel') && hasClass(faceZones[0], 'panel') &&
    hasClass(faceZones[1], 'adv-scope') &&
    hasClass(faceZones[2], 'signal-order') && hasClass(faceZones[2], 'panel') &&
    hasClass(faceZones[3], 'effects-panel') && hasClass(faceZones[3], 'panel') &&
    hasClass(faceZones[4], 'view-logo-mark'),
  '.voice-deck-face keeps the four workflow zones in order, followed only by the decorative logo mark'
);
check(
  /<div class="adv-scope" aria-hidden="true">\s*<canvas class="adv-scope-canvas">/.test(HTML),
  'the scope band is aria-hidden and carries the adopted canvas — a redundant picture; the OUT meter keeps the numbers'
);

// Live direction 2026-09-03: one horizontal workflow wraps the existing
// scrolling canvas in fixed MIC IN / OUT hosts. The cards keep their exact
// drag surface; the endpoint meters stay visible at both edges.
var canvasFlow = byId('canvas-flow');
var flowChildren = canvasFlow ? canvasFlow.children : [];
check(
  flowChildren.length === 3 &&
    hasClass(flowChildren[0], 'flow-endpoint-host-in') && flowChildren[0].attrs.id === 'advanced-meter-in' &&
    flowChildren[1].attrs.id === 'chain-canvas' &&
    hasClass(flowChildren[2], 'flow-endpoint-host-out') && flowChildren[2].attrs.id === 'advanced-meter-out',
  'canvas flow is MIC IN host | scrolling chain | OUT host'
);

// The canvas itself still contains only the flow list + state hint; meter
// mounting cannot change the drop-zone or chain DOM order.
var canvasEl = byId('chain-canvas');
var flowTags = canvasEl ? descendants(canvasEl, function () { return true; }).map(function (n) {
  return n.tag + (n.attrs.class ? '.' + n.attrs.class.split(/\s+/)[0] : '');
}) : [];
check(
  canvasEl !== null &&
    JSON.stringify(flowTags) === JSON.stringify(['div.chain-list', 'div.empty-hint']),
  'scrolling canvas internals remain chain-list → empty-hint only'
);

// ----------------------------------------------------------------------
console.log('B. the system-etch wrapper (the one group that wraps below 900px)');

var etch = deckHeader ? childByClass(deckHeader, 'system-etch') : null;
check(!!etch, '.system-etch exists inside the system deck');
check(
  !!etch && etch.children.length === 2 &&
    hasClass(etch.children[0], 'topbar-status') &&
    hasClass(etch.children[1], 'readout-group') &&
    etch.children[1].attrs.role === 'group',
  'system-etch wraps exactly .topbar-status + .readout-group[role=group] (no reordering)'
);
check(
  !!etch && etch.children[0].children.length === 1 &&
    etch.children[0].children[0].attrs.id === 'status',
  '#status (role=status, aria-live) rides inside the etch, still the topbar-status block'
);

// ----------------------------------------------------------------------
// CSS pins — same comment-stripping helpers as the palette suite.
// ----------------------------------------------------------------------
var RAW_CSS = '\n' + fs.readFileSync(path.join(ROOT, 'styles', 'main.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function cssRule(selector) {
  var idx = RAW_CSS.indexOf('\n' + selector + ' {');
  if (idx === -1) { return null; }
  var open = RAW_CSS.indexOf('{', idx);
  var depth = 1;
  var i = open + 1;
  while (i < RAW_CSS.length && depth > 0) {
    if (RAW_CSS[i] === '{') { depth += 1; }
    else if (RAW_CSS[i] === '}') { depth -= 1; }
    i += 1;
  }
  return depth === 0 ? RAW_CSS.slice(open + 1, i - 1) : null;
}

/* The type register (2026-09-02 typeset round): sizes, leadings and
   tracking are token references now, not literals. These assertions pin
   the value that actually RENDERS, so resolve one level of var()
   through :root before answering — an assertion for '0.75rem' keeps
   meaning "12px", and now fails if EITHER the rule or the token moves.
   Deliberately scoped to --type-/--leading-/--track-: font-family and
   colour assertions pin the token REFERENCE on purpose (that is the
   "no raw hex" contract), so those must come back unresolved. */
function resolveToken(value) {
  var m = /^var\(\s*(--(?:type|leading|track)-[\w-]+)\s*\)$/.exec(String(value).trim());
  if (!m) { return value; }
  var decl = RAW_CSS.match(new RegExp('(?:^|[;\\s])' + m[1] + '\\s*:\\s*([^;]+)'));
  return decl ? decl[1].trim() : value;
}

function cssDecl(body, prop) {
  var m = body.match(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*([^;]+)'));
  return m ? resolveToken(m[1].trim()) : null;
}

/* Extract a rule body from the position of any occurrence of a selector
   fragment — handles grouped selectors (`.a,\n.b {`) that cssRule's
   exact-line match cannot see. */
function ruleFromIndex(idx) {
  if (idx === -1) { return null; }
  var open = RAW_CSS.indexOf('{', idx);
  var depth = 1;
  var i = open + 1;
  while (i < RAW_CSS.length && depth > 0) {
    if (RAW_CSS[i] === '{') { depth += 1; }
    else if (RAW_CSS[i] === '}') { depth -= 1; }
    i += 1;
  }
  return depth === 0 ? RAW_CSS.slice(open + 1, i - 1) : null;
}

function ruleContaining(fragments) {
  for (var i = 0; i < fragments.length; i++) {
    var idx = RAW_CSS.indexOf(fragments[i]);
    while (idx !== -1) {
      var head = RAW_CSS.slice(idx, RAW_CSS.indexOf('{', idx));
      if (fragments.every(function (f) { return head.indexOf(f) !== -1; })) {
        return ruleFromIndex(idx);
      }
      idx = RAW_CSS.indexOf(fragments[i], idx + 1);
    }
  }
  return null;
}

function cssToken(name) {
  var m = RAW_CSS.match(new RegExp('--' + name + ':\\s*([^;]+)'));
  return m ? m[1].trim() : null;
}

// ----------------------------------------------------------------------
console.log('C. seam vocabulary — a machined joint, the deepest cut on the page');

var seamRule = cssRule('.deck-seam');
check(seamRule !== null, 'styles/main.css carries the .deck-seam rule');

var seamCut = cssToken('pm-seam-cut');
var seamLip = cssToken('pm-seam-lip');
var grooveCut = cssToken('pm-groove-cut');
var grooveLip = cssToken('pm-groove-lip');
check(!!seamCut && !!seamLip, 'the seam tokens exist: --pm-seam-cut / --pm-seam-lip');
check(
  seamRule && cssDecl(seamRule, 'height') === '4px' &&
    cssDecl(seamRule, 'background') === 'var(--pm-seam-cut)' &&
    cssDecl(seamRule, 'border-top') === '1px solid var(--pm-seam-lip)',
  'the seam is a 4px deep cut under a 1px light lip (dark cut UNDER a light lip — the locked materials list)'
);

// Deeper than every groove on the page: the seam's cut band is 4px vs
// the grooves' 1px border cuts, and its lip is BRIGHTER than the
// groove lip (0.30 vs 0.14 alpha) — the join reads as under load.
function lipAlpha(v) {
  var m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(v || '');
  return m ? parseFloat(m[1]) : null;
}
check(
  lipAlpha(seamLip) > lipAlpha(grooveLip),
  'seam lip is brighter than the groove lip (' + seamLip + ' vs ' + grooveLip + ') — the deepest cut reads brightest at its edge'
);
check(
  !!grooveCut && !!seamCut && seamCut !== grooveCut,
  'the seam cut is its own deeper value (' + seamCut + ', vs the section groove ' + grooveCut + ')'
);
var nodeCardRule = cssRule('.node-card');
var slabLip = cssToken('pm-slab-lip');
check(
  nodeCardRule !== null &&
    cssDecl(nodeCardRule, 'border') === '1px solid var(--pm-groove-cut)' &&
    cssDecl(nodeCardRule, 'background') === 'var(--pm-slab)' &&
    cssDecl(nodeCardRule, 'box-shadow') === 'inset 0 1px 0 var(--pm-slab-lip)',
  'the canvas sections are slabs on the chassis: 1px groove-cut edge, slab face, machined top lip (OQ-9 vocabulary)'
);
check(
  !!slabLip && lipAlpha(slabLip) < lipAlpha(seamLip) && lipAlpha(slabLip) > lipAlpha(grooveLip),
  'the slab lip sits BETWEEN the groove lip and the seam lip (' + slabLip + ') — the seam stays the deepest, brightest cut on the page'
);

var frameRule = cssRule('.instrument');
check(
  frameRule !== null &&
    cssDecl(frameRule, 'background') === 'var(--pm-chassis)' &&
    cssDecl(frameRule, 'border') === '1px solid var(--pm-face-edge)' &&
    cssDecl(frameRule, 'margin') === '-1rem',
  '.instrument is the one full-bleed chassis frame (bench-clearing margin, face-edge shell, chassis ground)'
);
check(
  frameRule && cssDecl(frameRule, 'overflow') === null,
  'the frame never clips (the sticky system deck must keep its pin)'
);

// ----------------------------------------------------------------------
console.log('D. system deck tokens — cast, keys, BYPASS pairing, focus');

var topbarRule = cssRule('.topbar');
check(
  topbarRule && cssDecl(topbarRule, 'background') === 'var(--pm-system-deck)' &&
    cssDecl(topbarRule, 'position') === 'sticky',
  'the system deck is its own cast (--pm-system-deck) and stays the sticky top'
);
check(!!cssToken('pm-system-deck'), '--pm-system-deck exists (two castings, one instrument)');

var etchRule = cssRule('.system-etch');
check(
  etchRule && cssDecl(etchRule, 'background') === 'var(--pm-register-bg)' &&
    cssDecl(etchRule, 'box-shadow') === 'inset 0 1px 0 var(--pm-groove-lip)',
  'the etch is an inset register slot (register ground + machined lip), rhyming with the display register'
);
check(
  cssDecl(cssRule('body:not(.view-advanced) .readout-group'), 'display') === 'none',
  'Simple hides diagnostic engine readouts while Advanced keeps their base display rule'
);

var startRule = cssRule('#start-button:not(:disabled)');
check(
  startRule && cssDecl(startRule, 'background') === 'var(--pm-accent)' &&
    cssDecl(startRule, 'color') === 'var(--pm-ink)',
  'Start is the ONE orange key: signal-orange fill, chassis ink'
);
check(
  !!cssToken('pm-accent-hi') && !!cssToken('pm-accent-lo'),
  'the orange key\'s hover/press tints are tokens (--pm-accent-hi / --pm-accent-lo)'
);

var bypassRule = cssRule('.bypass-btn');
check(
  bypassRule && cssDecl(bypassRule, 'border') === '2px solid var(--red-edge)' &&
    cssDecl(bypassRule, 'background') === 'var(--pm-key)',
  'BYPASS at rest: the 2px red-edge ring on a key ground (the deck\'s red-ringed END key)'
);
check(
  bypassRule && cssDecl(bypassRule, 'min-height') === '3rem' &&
    cssDecl(bypassRule, 'font-size') === '1.05rem' &&
    cssDecl(bypassRule, 'font-weight') === '700',
  'BYPASS keeps its loudness floor: 3rem target, 1.05rem/700 — the heaviest type on the deck'
);
var bypassEngaged = cssRule('.bypass-btn.engaged');
check(
  bypassEngaged && cssDecl(bypassEngaged, 'background') === 'var(--red-fill)' &&
    cssDecl(bypassEngaged, 'color') === '#FFFFFF',
  'BYPASS engaged: red-fill ground + white text (split-role safety red, never swapped)'
);

var focusRule = cssRule(':focus-visible');
check(
  focusRule && cssDecl(focusRule, 'outline') === '2px solid var(--pm-accent)',
  'the global focus ring is the orange system-state token'
);

// ----------------------------------------------------------------------
console.log('E. etch subordination — one machine voice (the canvas register)');

var readoutValueRule = cssRule('.readout-value');
var registerMainRule = cssRule('.register-main');
function remPx(v) {
  return /rem$/.test(v || '') ? parseFloat(v) * 16 : NaN;
}
check(
  readoutValueRule && cssDecl(readoutValueRule, 'font-size') === '0.75rem' &&
    cssDecl(readoutValueRule, 'font-family') === 'var(--font-readout)' &&
    cssDecl(readoutValueRule, 'font-variant-numeric') === 'tabular-nums',
  'the etch values render at the 12px mono tabular tier (the ladder\'s per-control value tier)'
);
check(
  registerMainRule && cssDecl(registerMainRule, 'font-size') === '0.85rem' &&
    remPx(cssDecl(readoutValueRule, 'font-size')) < remPx(cssDecl(registerMainRule, 'font-size')),
  'the etch stays one tier BELOW the chain register\'s 13.6px main line (13.6 > 12 — one mouth)'
);
check(
  readoutValueRule && cssDecl(readoutValueRule, 'color') === 'var(--pm-print-hi)' &&
    cssDecl(readoutValueRule, 'color') !== 'var(--pm-display)' &&
    cssDecl(readoutValueRule, 'color') !== 'var(--pm-accent)',
  'the etch values are NEUTRAL print — never the register\'s amber or the signal orange'
);

// The status SENTENCE's distance-readability step (2026-09-03, critique
// P3 #5): one type tier up from the 12px it shared with the readouts,
// because it is the operator's primary VERBAL status, read mid-show
// from across a dark room — distance readability is a functional a11y
// requirement (PRODUCT.md), not a nicety. Everything that makes the etch
// subordinate stays: readouts one tier down, the technical footnote
// demoted at 12px, neutral ink, and BYPASS's loudness floor untouched.
var statusRule = cssRule('.status');
check(
  statusRule && cssDecl(statusRule, 'font-size') === '0.85rem',
  'the deck status sentence rides the register tier (0.85rem, one step up from 12px — distance readability)'
);
check(
  statusRule && registerMainRule &&
    cssDecl(statusRule, 'font-size') === cssDecl(registerMainRule, 'font-size'),
  'the sentence matches the chain register main line\'s SIZE ROLE (same ladder step, still not the amber machine voice)'
);
check(
  statusRule && readoutValueRule &&
    remPx(cssDecl(readoutValueRule, 'font-size')) < remPx(cssDecl(statusRule, 'font-size')),
  'RATE/LAT/NODES stay one tier BELOW the sentence (readouts subordinate by design)'
);
check(
  cssDecl(cssRule('.status-detail'), 'font-size') === '0.75rem',
  'the demoted technical footnote is PINNED at the 12px value tier (one rank below the sentence, either host)'
);
check(
  cssDecl(cssRule('.topbar-status'), 'max-width') === '22.5rem',
  'the sentence cap grew with the tier (22.5rem) — every WHAT-HAPPENED mic error sentence still reads in full'
);
check(
  statusRule && bypassRule &&
    remPx(cssDecl(statusRule, 'font-size')) < remPx(cssDecl(bypassRule, 'font-size')),
  'BYPASS still out-sizes the sentence (the deck\'s loudness floor holds)'
);

// ----------------------------------------------------------------------
console.log('F. voice-deck zones + the one shared disabled grammar');

var presetsPanelRule = cssRule('.presets-panel');
var effectsPanelRule = cssRule('.effects-panel');
var canvasPanelRule = cssRule('.canvas-panel');
var signalOrderRule = cssRule('.signal-order');
check(
  presetsPanelRule && cssDecl(presetsPanelRule, 'background') === 'transparent' &&
    effectsPanelRule && cssDecl(effectsPanelRule, 'background') === 'transparent' &&
    signalOrderRule && cssDecl(signalOrderRule, 'background') === 'transparent' &&
    canvasPanelRule && cssDecl(canvasPanelRule, 'background') === 'var(--pm-chassis)',
  'all four zones are print on the ONE faceplate (transparent zones over the chassis ground)'
);
check(
  canvasPanelRule && cssDecl(canvasPanelRule, 'border-bottom') === '1px solid var(--pm-groove-cut)' &&
    signalOrderRule && cssDecl(signalOrderRule, 'border-bottom') === '1px solid var(--pm-groove-cut)' &&
    signalOrderRule && cssDecl(signalOrderRule, 'box-shadow') === 'inset 0 1px 0 var(--pm-groove-lip)' &&
    effectsPanelRule && cssDecl(effectsPanelRule, 'border-top') === '1px solid var(--pm-groove-cut)' &&
    cssDecl(effectsPanelRule, 'box-shadow') === 'inset 0 1px 0 var(--pm-groove-lip)',
  '.voice-deck-face zone separators are HORIZONTAL groove pairs (cut then lip, top to bottom — the stacked twin of the sections\' own grooves): canvas-panel -> signal-order -> effects-panel'
);
check(
  presetsPanelRule && cssDecl(presetsPanelRule, 'border-right') === '1px solid var(--pm-groove-cut)' &&
    cssDecl(presetsPanelRule, 'box-shadow') === 'inset -1px 0 0 var(--pm-groove-lip)',
  'split-panel round: .presets-panel\'s own separator from the board is a VERTICAL groove pair (cut + lip both on its right edge, the same self-contained pattern .io-rail-in/.io-rail-out already use) — it sits BESIDE the board, not above it'
);

// The hatch: the canvas face's exact gradient, now on the strip and both
// collapsible panels (the old flanking zones' twin).
function hatchOf(selector) {
  var body = ruleContaining([selector]);
  if (!body) { return null; }
  var m = body.match(/background:\s*(repeating-linear-gradient\([^;]+)/);
  return m ? m[1].trim() : null;
}
var canvasHatch = hatchOf('.layout.engine-not-started .canvas::before');
var presetsPanelHatch = hatchOf('.layout.engine-not-started .presets-panel::before');
var effectsPanelHatch = hatchOf('.layout.engine-not-started .effects-panel::before');
var signalOrderHatch = hatchOf('.layout.engine-not-started .signal-order::before');
check(!!canvasHatch, 'the canvas pre-Start hatch rule exists');
check(
  !!presetsPanelHatch && !!effectsPanelHatch && !!signalOrderHatch &&
    presetsPanelHatch === canvasHatch && effectsPanelHatch === canvasHatch &&
    signalOrderHatch === canvasHatch,
  'the presets panel, the effects panel, and the signal-order strip all gate with the IDENTICAL hatch gradient as the canvas face (one disabled grammar)'
);
var gatePresets = ruleContaining(['.layout.engine-not-started .presets-panel']);
var gateEffects = ruleContaining(['.layout.engine-not-started .effects-panel']);
check(
  gatePresets && cssDecl(gatePresets, 'opacity') === '0.55' &&
    cssDecl(gatePresets, 'pointer-events') === 'none' &&
    gateEffects && cssDecl(gateEffects, 'opacity') === '0.55' &&
    cssDecl(gateEffects, 'pointer-events') === 'none',
  'the pre-Start zone gate keeps the functional lock on both panels (opacity + pointer-events, unchanged semantics)'
);

// ----------------------------------------------------------------------
console.log('G. viewport law — the deck uses explicit responsive grids; the voice deck runs as a row only at >=901px');

// One 900px media block remains — the system deck's compact grid. The
// voice deck's OWN narrow-viewport collapse is back (left-sidebar round,
// 2026-08-31 user direction): .layout is a plain stacked column at its
// base (unscoped) rule, and only becomes a row — .presets-panel beside
// .voice-deck-face — inside the existing @media (min-width: 901px) block,
// so "below 901px the zones stack" holds again, this time by the
// mobile-first default rather than a dedicated collapse rule.
function mediaBlockAfterIndex(idx) {
  var open = RAW_CSS.indexOf('{', idx);
  var depth = 1;
  var i = open + 1;
  while (i < RAW_CSS.length && depth > 0) {
    if (RAW_CSS[i] === '{') { depth += 1; }
    else if (RAW_CSS[i] === '}') { depth -= 1; }
    i += 1;
  }
  return RAW_CSS.slice(open + 1, i - 1);
}
function ruleInBlock(block, selector) {
  var at = block.indexOf(selector);
  if (at === -1) { return null; }
  var open = block.indexOf('{', at);
  if (open === -1) { return null; }
  var depth = 1;
  var i = open + 1;
  while (i < block.length && depth > 0) {
    if (block[i] === '{') { depth += 1; }
    else if (block[i] === '}') { depth -= 1; }
    i += 1;
  }
  return depth === 0 ? block.slice(open + 1, i - 1) : null;
}
var narrowIdx = RAW_CSS.indexOf('@media (max-width: 900px)');
var deckMedia = narrowIdx !== -1 ? mediaBlockAfterIndex(narrowIdx) : '';
check(
  narrowIdx !== -1 && RAW_CSS.indexOf('@media (max-width: 900px)', narrowIdx + 1) === -1,
  'exactly one <900px block remains (the system deck\'s compact grid) — the voice-deck grid collapse is gone with the grid itself'
);
check(
  /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/.test(deckMedia) &&
    /'identity views'\s*'agent bypass'\s*'controls controls'\s*'etch etch'/.test(deckMedia) &&
    cssDecl(ruleInBlock(deckMedia, '.system-etch'), 'grid-area') === 'etch',
  'below 900px the compact grid keeps identity/view, agent/Bypass, controls, and etch in four deliberate rows'
);
check(
  cssDecl(ruleInBlock(deckMedia, '.bypass-btn'), 'grid-area') === 'bypass' &&
    cssDecl(ruleInBlock(deckMedia, '.topbar-controls'), 'grid-area') === 'controls' &&
    /flex-wrap:\s*wrap/.test(deckMedia.slice(deckMedia.indexOf('.topbar-controls'))),
  'below 900px BYPASS owns the safety-row end while controls wrap inside their full-width grid row'
);

var phoneIdx = RAW_CSS.indexOf('@media (max-width: 480px)');
var phoneMedia = phoneIdx !== -1 ? mediaBlockAfterIndex(phoneIdx) : '';
check(
  phoneIdx !== -1 &&
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(phoneMedia) &&
    /grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/.test(
      ruleInBlock(phoneMedia, '.topbar-controls') || ''
    ),
  'phone widths use shrinkable deck columns and a bounded Start/microphone control row'
);
check(
  cssDecl(ruleInBlock(phoneMedia, '#input-device-select'), 'width') === '100%' &&
    cssDecl(ruleInBlock(phoneMedia, '#input-device-select'), 'min-width') === '0' &&
    cssDecl(ruleInBlock(phoneMedia, '.start-hint'), 'display') === 'none',
  'phone widths keep the microphone inside the frame and remove the duplicated Start hint'
);

var intermediateIdx = RAW_CSS.indexOf('@media (min-width: 901px) and (max-width: 1500px)');
var intermediateMedia = intermediateIdx !== -1 ? mediaBlockAfterIndex(intermediateIdx) : '';
check(
  intermediateIdx !== -1 &&
    /'identity views etch etch'\s*'controls controls agent bypass'/.test(intermediateMedia),
  '901–1500px uses a deliberate two-row system deck instead of allowing an accidental flex wrap'
);
check(
  cssDecl(ruleInBlock(intermediateMedia, '.system-etch'), 'grid-area') === 'etch' &&
    cssDecl(ruleInBlock(intermediateMedia, '.agent-chip'), 'grid-area') === 'agent' &&
    cssDecl(ruleInBlock(intermediateMedia, '.bypass-btn'), 'grid-area') === 'bypass',
  'the intermediate grid keeps engine state, agent state, and Bypass in named stable areas'
);

var layoutRule = cssRule('.layout');
check(
  layoutRule && cssDecl(layoutRule, 'display') === 'flex' &&
    cssDecl(layoutRule, 'flex-direction') === 'column',
  '.layout\'s BASE (mobile-first, unscoped) rule is a flex column — below 901px .presets-panel stacks above .voice-deck-face, same as every other zone pairing on this page'
);

// Left-sidebar round: find the SPECIFIC @media (min-width: 901px) block
// that carries .layout's row override — this file (main.css) has several
// separate blocks sharing that exact condition text (one per feature
// area), so a plain RAW_CSS.indexOf('@media (min-width: 901px)') would
// only ever find the FIRST one, which may not be the one that matters
// here. Scans every same-condition block and returns the body of the
// first one containing `selector`.
function cssRuleInMedia(mediaCondition, selector) {
  var marker = '@media (' + mediaCondition + ') {';
  var searchFrom = 0;
  while (true) {
    var atIdx = RAW_CSS.indexOf(marker, searchFrom);
    if (atIdx === -1) { return null; }
    var block = mediaBlockAfterIndex(atIdx);
    var selIdx = block.indexOf('\n  ' + selector + ' {');
    if (selIdx !== -1) {
      var selOpen = block.indexOf('{', selIdx);
      var selDepth = 1;
      var j = selOpen + 1;
      while (j < block.length && selDepth > 0) {
        if (block[j] === '{') { selDepth += 1; }
        else if (block[j] === '}') { selDepth -= 1; }
        j += 1;
      }
      if (selDepth === 0) {
        return block.slice(selOpen + 1, j - 1);
      }
    }
    searchFrom = atIdx + marker.length;
  }
}
// .layout.voice-deck, not bare .layout: this rule sits EARLIER in the
// source than the unscoped base .layout rule this test just checked
// above, so at equal specificity a bare-.layout media rule would LOSE
// every shared property (flex-direction, min-height) to that later base
// rule regardless of whether the media query matches — a real bug this
// round's own implementation surfaced and fixed via the same specificity
// bump the .preset-search sticky-input fix already used this session.
var layoutWideRule = cssRuleInMedia('min-width: 901px', '.layout.voice-deck');
check(
  layoutWideRule && cssDecl(layoutWideRule, 'flex-direction') === 'row' &&
    cssDecl(layoutWideRule, 'min-height') === '0',
  'at 901px+ .layout.voice-deck becomes a ROW with min-height: 0 (the specificity bump that actually wins over the later base rule) — .presets-panel (collapsible) beside .voice-deck-face (the board + signal-order strip + the effects panel, all stacked together)'
);

// ----------------------------------------------------------------------
console.log('H. chip keys — restyled as panel keys, flat-button contract intact');

var chipRule = cssRule('.node-chip');
check(
  chipRule && cssDecl(chipRule, 'background') === 'var(--pm-key)' &&
    cssDecl(chipRule, 'border') === '1px solid var(--pm-key-edge)',
  'chips restyle as panel keys (--pm-key ground, cut-edge bezel) — sizes unchanged for drag geometry'
);
var chipBefore = cssRule('.node-chip::before');
check(
  chipBefore && cssDecl(chipBefore, 'font-size') === '0.6875rem' &&
    cssDecl(chipBefore, 'color') === 'var(--pm-ink)',
  'the family legend square keeps the 11px initials floor, now in chassis ink on the family fill'
);
[
  'gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter',
  'distortion', 'chorus', 'gate', 'autotune',
  'phaser', 'tremolo', 'pitchshift', 'bitcrusher'
].forEach(function (fam) {
  var rule = cssRule(".node-chip[data-family='" + fam + "']");
  check(
    rule !== null && cssDecl(rule, '--chip-family') === 'var(--family-' + fam + ')',
    'chip family mark maps to the saturated --family-' + fam + ' token (the arcs\' own color)'
  );
});
// .node-chip.sortable-chosen (and its .sortable-drag/.sortable-ghost
// siblings) removed as dead CSS (2026-09-01): SortableJS has been fully
// retired since 2026-08-31 — nothing in canvas.js has applied these
// classes since, and the board redesign's own drag-to-reorder is a
// hand-rolled gesture with its own .reorder-chosen class (see
// styles/main.css's board-redesign block).

console.log('I. per-card meter groove — accepted live treatment');
var cardMeterRule = cssRule('.canvas-panel.flow-horizontal .node-meter');
check(
  cardMeterRule !== null &&
    cssDecl(cardMeterRule, 'position') === 'absolute' &&
    cssDecl(cardMeterRule, 'right') === '0.375rem' &&
    cssDecl(cardMeterRule, 'left') === '0.375rem' &&
    cssDecl(cardMeterRule, 'bottom') === '0' &&
    cssDecl(cardMeterRule, 'height') === '0.375rem' &&
    cssDecl(cardMeterRule, 'opacity') === '0.5',
  'card IN/OUT traces are machined into a 6px bottom groove, inset 6px and held at 50% intensity'
);

// ----------------------------------------------------------------------
console.log('');
if (failures.length === 0) {
  console.log('two-deck-stack: ALL CHECKS PASS');
} else {
  console.log('two-deck-stack: ' + failures.length + ' FAILURE(S)');
  failures.forEach(function (f) { console.log('  FAIL - ' + f); });
  process.exit(1);
}
