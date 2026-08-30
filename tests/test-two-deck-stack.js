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
//      quieter than the chain face's display register: smaller value
//      tier (12px vs the register's 13.6px main line) and NEUTRAL print
//      (never the register's amber/orange machine voice).
//   F. VOICE-DECK ZONES + SHARED DISABLED GRAMMAR — the three zones sit
//      on one faceplate with groove separators (cut+lip pairs), and the
//      pre-Start gate hatch covers BOTH flanking zones with the exact
//      gradient the canvas face uses (one grammar, three zones).
//   G. VIEWPORT LAW — below 900px the voice deck stacks (1fr) with the
//      grooves turned horizontal, and the etch (not BYPASS) is the group
//      that wraps away via order.
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
// joint sits BETWEEN the slabs), and nothing else wraps into the frame.
check(
  !!instrument &&
    instrument.children.length === 3 &&
    instrument.children[0] === deckHeader &&
    instrument.children[1] === seam &&
    instrument.children[2] === layout,
  'instrument children are exactly [system deck, deck seam, voice deck] in order'
);

// The system deck's own child order — identity, etch, controls, BYPASS
// last (the agent chip inserts before BYPASS and after controls).
var deckChildren = deckHeader ? deckHeader.children : [];
var lastDeckChild = deckChildren[deckChildren.length - 1];
check(
  deckChildren.length === 4 &&
    hasClass(deckChildren[0], 'topbar-identity') &&
    hasClass(deckChildren[1], 'system-etch') &&
    hasClass(deckChildren[2], 'topbar-controls') &&
    lastDeckChild.attrs.id === 'bypass-toggle-button',
  'system deck order: identity → system-etch → controls → #bypass-toggle-button (LAST — the #agent-chip insertion point)'
);

// Every wiring id the three UI scripts resolve survives the restructure.
[
  'start-button', 'input-device-select', 'status', 'status-dot', 'status-text',
  'start-hint', 'readout-sample-rate', 'readout-latency', 'readout-node-count',
  'chain-layout', 'palette-list', 'chain-canvas', 'chain-list', 'empty-hint',
  'save-preset-btn', 'preset-select', 'load-preset-btn', 'delete-preset-btn',
  'current-preset-name', 'unsaved-indicator'
].forEach(function (id) {
  check(byId(id) !== null, 'wiring id survives: #' + id);
});

// The voice deck's three zones, in column order, as its direct children.
var zones = layout ? layout.children : [];
check(
  zones.length === 3 &&
    hasClass(zones[0], 'palette') && hasClass(zones[0], 'panel') &&
    hasClass(zones[1], 'canvas-panel') && hasClass(zones[1], 'panel') &&
    hasClass(zones[2], 'presets') && hasClass(zones[2], 'panel'),
  'voice deck zones in order: .palette | .canvas-panel | .presets (one grid, three zones)'
);

// The canvas markup itself is untouched (flow sequence verbatim).
var canvasEl = byId('chain-canvas');
var flowTags = canvasEl ? descendants(canvasEl, function () { return true; }).map(function (n) {
  return n.tag + (n.attrs.class ? '.' + n.attrs.class.split(/\s+/)[0] : '');
}) : [];
check(
  canvasEl !== null &&
    JSON.stringify(flowTags) ===
      JSON.stringify(['div.anchor', 'span.arrow', 'div.chain-list', 'div.empty-hint', 'span.arrow', 'div.anchor']),
  'canvas internals untouched: anchor → arrow → chain-list → empty-hint → arrow → anchor'
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

function cssDecl(body, prop) {
  var m = body.match(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : null;
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
check(
  nodeCardRule !== null &&
    cssDecl(nodeCardRule, 'border-top') === '1px solid var(--pm-groove-cut)' &&
    cssDecl(nodeCardRule, 'box-shadow') === 'inset 0 1px 0 var(--pm-groove-lip)',
  'the canvas sections keep their 1px groove (the seam stays deeper than every section groove)'
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

// ----------------------------------------------------------------------
console.log('F. voice-deck zones + the one shared disabled grammar');

var paletteRule = cssRule('.palette');
var canvasPanelRule = cssRule('.canvas-panel');
var presetsRule = cssRule('.presets');
check(
  paletteRule && cssDecl(paletteRule, 'background') === 'transparent' &&
    presetsRule && cssDecl(presetsRule, 'background') === 'transparent' &&
    canvasPanelRule && cssDecl(canvasPanelRule, 'background') === 'var(--pm-chassis)',
  'all three zones are print on the ONE faceplate (transparent zones over the chassis ground)'
);
check(
  paletteRule && cssDecl(paletteRule, 'border-right') === '1px solid var(--pm-groove-cut)' &&
    canvasPanelRule && cssDecl(canvasPanelRule, 'border-left') === '1px solid var(--pm-groove-lip)' &&
    cssDecl(canvasPanelRule, 'border-right') === '1px solid var(--pm-groove-cut)' &&
    presetsRule && cssDecl(presetsRule, 'border-left') === '1px solid var(--pm-groove-lip)',
  'zone separators are groove pairs (cut then lip, left to right) — the same grammar the sections use'
);

// The hatch: the canvas face's exact gradient, now on both flanking zones.
function hatchOf(selector) {
  var body = ruleContaining([selector]);
  if (!body) { return null; }
  var m = body.match(/background:\s*(repeating-linear-gradient\([^;]+)/);
  return m ? m[1].trim() : null;
}
var canvasHatch = hatchOf('.layout.engine-not-started .canvas::before');
var paletteHatch = hatchOf('.layout.engine-not-started .palette::before');
var presetsHatch = hatchOf('.layout.engine-not-started .presets::before');
check(!!canvasHatch, 'the canvas pre-Start hatch rule exists');
check(
  !!paletteHatch && !!presetsHatch &&
    paletteHatch === canvasHatch && presetsHatch === canvasHatch,
  'both flanking zones gate with the IDENTICAL hatch gradient as the canvas face (one disabled grammar)'
);
var gatePalette = ruleContaining(['.layout.engine-not-started .palette']);
check(
  gatePalette && cssDecl(gatePalette, 'opacity') === '0.55' &&
    cssDecl(gatePalette, 'pointer-events') === 'none',
  'the pre-Start zone gate keeps the functional lock (opacity + pointer-events, unchanged semantics)'
);

// ----------------------------------------------------------------------
console.log('G. viewport law — below 900px');

// Both 900px media blocks: the deck wraps the etch by order; the voice
// deck stacks 1fr with horizontal grooves. Two blocks share the marker —
// collect every occurrence and pick by content.
function mediaBlocks(marker) {
  var blocks = [];
  var idx = RAW_CSS.indexOf(marker);
  while (idx !== -1) {
    blocks.push(mediaBlockAfterIndex(idx));
    idx = RAW_CSS.indexOf(marker, idx + 1);
  }
  return blocks;
}

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

var allNarrowBlocks = mediaBlocks('@media (max-width: 900px)');
var deckMedia = allNarrowBlocks.filter(function (b) { return b.indexOf('.system-etch') !== -1; })[0] || '';
var layoutMedia = allNarrowBlocks.filter(function (b) { return b.indexOf('.layout') !== -1; })[0] || '';
check(allNarrowBlocks.length >= 2, 'two <900px blocks exist (deck wrap + voice-deck stack)');
check(
  deckMedia.indexOf('.system-etch') !== -1 &&
    /order:\s*9/.test(deckMedia.slice(deckMedia.indexOf('.system-etch'))),
  'below 900px the ETCH is the group that wraps LAST (order 9)'
);
function orderOf(block, selector) {
  var at = block.indexOf(selector);
  if (at === -1) { return null; }
  var m = block.slice(at).match(/order:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
var bypassOrder = orderOf(deckMedia, '.bypass-btn');
var controlsOrder = orderOf(deckMedia, '.topbar-controls');
check(
  bypassOrder !== null && bypassOrder < controlsOrder &&
    bypassOrder < 9 &&
    /flex-basis:\s*100%/.test(deckMedia.slice(deckMedia.indexOf('.topbar-controls'))),
  'below 900px BYPASS keeps a row-1 order (ahead of the controls block and the etch), and the controls block wraps INTERNALLY at full width — BYPASS never leaves the visible top, nothing overflows the deck'
);

var stackedMediaFound = /grid-template-columns:\s*1fr/.test(layoutMedia);
check(
  stackedMediaFound,
  'below 900px the voice deck stacks to one column (palette → face → presets)'
);
check(
  layoutMedia.indexOf('border-bottom: 1px solid var(--pm-groove-cut)') !== -1 &&
    layoutMedia.indexOf('border-top: 1px solid var(--pm-groove-lip)') !== -1,
  'the stacked zones carry HORIZONTAL grooves (cut below a zone, lip above the next)'
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
  'distortion', 'chorus', 'gate', 'autotune'
].forEach(function (fam) {
  var rule = cssRule(".node-chip[data-family='" + fam + "']");
  check(
    rule !== null && cssDecl(rule, '--chip-family') === 'var(--family-' + fam + ')',
    'chip family mark maps to the saturated --family-' + fam + ' token (the arcs\' own color)'
  );
});
var chosenRule = cssRule('.node-chip.sortable-chosen');
check(
  chosenRule && cssDecl(chosenRule, 'border-color') === 'var(--pm-accent)',
  'the drag-origin chip bezel is the signal orange (SortableJS wiring untouched)'
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
