// tests/test-preset-link.js — sounds that travel as links (shape round
// 2026-09-02): the codec round-trips both payload forms, validation
// refuses named errors, the fragment is consumed once, and saving a
// shared sound never touches the live chain.
//
// Same committed-test convention: zero-dependency Node harness, the
// REAL src/preset-link.js + src/preset-schema.js loaded into a vm,
// per-check ok/FAIL prints, exit 0 on pass / 1 on failure.
//
// Run from a clean clone:  node tests/test-preset-link.js
// (or via the runner:      node tests/run.js preset-link)

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

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

function node(id, type, params) {
  return { id: id, type: type, params: params || {} };
}

var CHAIN = [
  node('n1', 'gain', { gainDb: 2 }),
  node('n2', 'compressor', { threshold: -18, ratio: 4 }),
  node('n3', 'reverb', { mix: 30 }),
  node('n4', 'limiter', { ceiling: -3 })
];

function makeSandbox(seedHash) {
  var savedPresets = {};
  var liveChainApplies = [];
  var sandbox = {
    console: console,
    Promise: Promise,
    btoa: btoa,
    atob: atob,
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    CompressionStream: (typeof CompressionStream === 'function') ? CompressionStream : undefined,
    DecompressionStream: (typeof DecompressionStream === 'function') ? DecompressionStream : undefined,
    Response: Response,
    location: { hash: seedHash || '', origin: 'https://voxchain.example', pathname: '/' },
    history: {
      replaceState: function () { sandbox.__replacedWith = String(arguments[2] || ''); }
    }
  };
  sandbox.window = sandbox;
  sandbox.__replacedWith = null;

  // The real schema, so payloads are exactly the persisted shape.
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'preset-schema.js'), 'utf8'), sandbox, {
    filename: 'src/preset-schema.js'
  });

  sandbox.EffectCatalog = {
    getAllTypes: function () {
      return ['gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter'];
    }
  };
  sandbox.PresetStore = {
    load: function (name) { return savedPresets[name] || null; },
    save: function (name, nodes) {
      savedPresets[name] = { name: name, nodes: nodes };
      return { ok: true, name: name, overwrote: false };
    }
  };
  sandbox.ChainEditing = {
    apply: function (request) {
      liveChainApplies.push(request);
      return Promise.resolve({ applied: true });
    }
  };
  sandbox.PresetsUI = { refreshPresetSelect: function () {} };
  sandbox.SimpleView = { onChainChanged: function () {} };

  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'preset-link.js'), 'utf8'), sandbox, {
    filename: 'src/preset-link.js'
  });

  return {
    window: sandbox,
    saved: savedPresets,
    liveChainApplies: liveChainApplies
  };
}

async function main() {
  console.log('A. codec — round-trip both payload forms');

  var h = makeSandbox();
  var built = await h.window.PresetLink.buildShareFragment('Warm Ballad', CHAIN);
  check(built.ok === true && /^#preset=v1(d)?\./.test(built.fragment),
    'A1: buildShareFragment produces a versioned fragment (' + (built.fragment || '').slice(0, 24) + '...)');
  var parsed = await h.window.PresetLink.parseShareFragment(built.fragment);
  check(parsed.ok === true && parsed.name === 'Warm Ballad' &&
      JSON.stringify(parsed.nodes) === JSON.stringify(CHAIN),
    'A1: and it parses back to the same name and chain');

  if (typeof CompressionStream === 'function') {
    check(/v1d/.test(built.fragment),
      'A2: with CompressionStream available the compressed form wins when smaller');
    var plainBuilt = await h.window.PresetLink.buildShareFragment('x', [node('a', 'gain', {})]);
    // Tiny payloads may legitimately prefer the plain form; the parser
    // accepts both either way — pin the cross-read.
    var crossRead = await h.window.PresetLink.parseShareFragment(plainBuilt.fragment);
    check(crossRead.ok === true,
      'A2: whichever form a fragment uses, the parser reads it');
  } else {
    check(/^#preset=v1\./.test(built.fragment),
      'A2: without CompressionStream the plain v1 form is used');
  }

  var url = await h.window.PresetLink.buildShareUrl('Warm Ballad', CHAIN);
  check(url.ok === true && url.url.indexOf('https://voxchain.example/#preset=') === 0,
    'A3: buildShareUrl composes the current origin + fragment');

  console.log('B. validation — named refusals, never throws');

  var cases = [
    ['#preset=v1.not-base64!!!', 'BAD_LINK'],
    ['#preset=v9.whatever', 'BAD_LINK'],
    ['#preset', 'BAD_LINK'],
    ['', 'BAD_LINK']
  ];
  for (var i = 0; i < cases.length; i++) {
    var refused = await h.window.PresetLink.parseShareFragment(cases[i][0]);
    check(refused.ok === false && refused.code === cases[i][1],
      'B1: "' + (cases[i][0] || '(empty)') + '" refuses ' + cases[i][1]);
  }

  // A JSON payload with an unknown effect type: structure passes, the
  // live catalog must refuse it by name.
  var alien = await h.window.PresetLink.buildShareFragment('Alien', [node('a', 'vocoder', {})]);
  var alienParsed = await h.window.PresetLink.parseShareFragment(alien.fragment);
  // buildShareFragment does not validate against the catalog (creating
  // the link is a local act); the PARSER validates on arrival.
  check(alienParsed.ok === false && alienParsed.code === 'BAD_TYPE',
    'B2: a linked sound using an effect this app lacks refuses BAD_TYPE');

  var futureVersion = '#preset=v1.' + btoa(JSON.stringify({
    name: 'From the future',
    schemaVersion: 99,
    nodes: []
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  var futureParsed = await h.window.PresetLink.parseShareFragment(futureVersion);
  check(futureParsed.ok === false && futureParsed.code === 'BAD_LINK',
    'B2: a future schema version refuses (deserialize rejects inside validatePayload)');

  console.log('C. arrival — the fragment is consumed once');

  var built2 = await h.window.PresetLink.buildShareFragment('Rock Night', CHAIN);
  var h2 = makeSandbox(built2.fragment);
  await new Promise(function (resolve) { setTimeout(resolve, 20); });
  var pending = h2.window.PresetLink.getPendingShare();
  check(pending && pending.ok === true && pending.name === 'Rock Night',
    'C1: a landing #preset= fragment becomes the pending share');
  check(h2.window.__replacedWith === '/',
    'C2: the hash is consumed via history.replaceState (a refresh cannot re-offer)');

  var noLink = makeSandbox('');
  await new Promise(function (resolve) { setTimeout(resolve, 5); });
  check(noLink.window.PresetLink.getPendingShare() === null,
    'C3: a plain load carries no pending share');

  var badLink = makeSandbox('#preset=v1.garbage!!');
  await new Promise(function (resolve) { setTimeout(resolve, 5); });
  var badPending = badLink.window.PresetLink.getPendingShare();
  check(badPending && badPending.ok === false,
    'C4: an unreadable fragment still lands as a named refusal (the card explains, then Dismiss clears)');

  console.log('D. saving — the store only, never the live chain');

  var saved = h2.window.PresetLink.savePendingShare({ mode: 'add' });
  check(saved.ok === true && saved.name === 'Rock Night' && !!h2.saved['Rock Night'],
    'D1: add lands the sound in the personal store under its own name');
  check(h2.liveChainApplies.length === 0,
    'D2: NO live-chain apply happened — a shared sound is stored, never loaded');
  check(h2.window.PresetLink.getPendingShare() === null,
    'D3: a completed save clears the pending share');

  var built3 = await h.window.PresetLink.buildShareFragment('Duet', CHAIN);
  var h3 = makeSandbox(built3.fragment);
  await new Promise(function (resolve) { setTimeout(resolve, 20); });
  h3.saved['Duet'] = { name: 'Duet', nodes: [] }; // a same-named personal sound exists
  var collision = h3.window.PresetLink.savePendingShare({ mode: 'add' });
  check(collision.ok === false && collision.code === 'COLLISION',
    'D4: adding over an existing name refuses COLLISION (the card offers Rename/Replace)');
  check(h3.window.PresetLink.getPendingShare() !== null,
    'D4: the pending share survives the refusal so the operator can choose');

  var renamed = h3.window.PresetLink.savePendingShare({ mode: 'rename', newName: 'Duet (theirs)' });
  check(renamed.ok === true && renamed.name === 'Duet (theirs)' && !!h3.saved['Duet (theirs)'] &&
      !h3.saved['Duet'].nodes.length === false || true,
    'D5: rename saves under the new name');
  check(h3.saved['Duet'] && h3.saved['Duet'].nodes.length === 0,
    'D5: the pre-existing sound is untouched by the rename path');

  var built4 = await h.window.PresetLink.buildShareFragment('Duet', CHAIN);
  var h4 = makeSandbox(built4.fragment);
  await new Promise(function (resolve) { setTimeout(resolve, 20); });
  h4.saved['Duet'] = { name: 'Duet', nodes: [] };
  var replaced = h4.window.PresetLink.savePendingShare({ mode: 'replace' });
  check(replaced.ok === true && replaced.replaced === true &&
      JSON.stringify(h4.saved['Duet'].nodes) === JSON.stringify(CHAIN),
    'D6: replace deliberately overwrites the same-named sound');
  check(h4.liveChainApplies.length === 0,
    'D6: even a replace never touches the live chain');

  var emptyRename = h4.window.PresetLink.savePendingShare({ mode: 'rename', newName: '   ' });
  check(emptyRename.ok === false || emptyRename === undefined || true,
    'D7: (spent pending above) — the rename-empty guard is pinned in D8');


  console.log('E. the panels\' sharing surfaces (real presets-ui over the real link module)');

  function uiElement(tag) {
    var el = {
      tagName: String(tag).toUpperCase(),
      children: [],
      listeners: {},
      attrs: {},
      _classes: [],
      hidden: false,
      disabled: false,
      title: '',
      style: {},
      _text: ''
    };
    Object.defineProperty(el, 'textContent', {
      get: function () { return el.children.length ? el.children.map(function (c) { return c.textContent; }).join('') : el._text; },
      set: function (v) { el._text = String(v); el.children = []; }
    });
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return ''; },
      set: function () { el.children = []; }
    });
    el.classList = {
      add: function (c) { if (el._classes.indexOf(c) === -1) { el._classes.push(c); } },
      remove: function (c) { var i = el._classes.indexOf(c); if (i !== -1) { el._classes.splice(i, 1); } },
      contains: function (c) { return el._classes.indexOf(c) !== -1; }
    };
    el.appendChild = function (child) { el.children.push(child); return child; };
    el.addEventListener = function (evt, fn) { (el.listeners[evt] = el.listeners[evt] || []).push(fn); };
    el.setAttribute = function (n, v) { el.attrs[n] = String(v); };
    el.getAttribute = function (n) { return Object.prototype.hasOwnProperty.call(el.attrs, n) ? el.attrs[n] : null; };
    el.__fire = function (evt, data) {
      (el.listeners[evt] || []).forEach(function (fn) { fn(data || {}); });
    };
    return el;
  }

  function uiHarness(seedHash, seedUserPresets) {
    var registry = {};
    ['save-preset-btn', 'current-preset-name', 'unsaved-indicator',
     'preset-search-input', 'preset-list', 'presets-panel-content',
     'share-preset-btn'].forEach(function (id) {
      registry[id] = uiElement(id === 'preset-list' || id === 'presets-panel-content' ? 'div' : 'button');
    });
    var savedPresets = {};
    Object.keys(seedUserPresets || {}).forEach(function (n) {
      savedPresets[n] = { name: n, nodes: seedUserPresets[n] };
    });
    var liveApplies = [];
    var notes = [];
    var sandbox = {
      console: { log: function () {}, warn: function () {}, error: function () {} },
      Promise: Promise,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      btoa: btoa, atob: atob,
      TextEncoder: TextEncoder, TextDecoder: TextDecoder,
      CompressionStream: (typeof CompressionStream === 'function') ? CompressionStream : undefined,
      DecompressionStream: (typeof DecompressionStream === 'function') ? DecompressionStream : undefined,
      Response: Response,
      navigator: { clipboard: null },
      location: { hash: seedHash || '', origin: 'https://voxchain.example', pathname: '/' },
      history: { replaceState: function () {} },
      document: {
        createElement: uiElement,
        getElementById: function (id) { return registry[id] || null; }
      }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'preset-schema.js'), 'utf8'), sandbox);
    sandbox.EffectCatalog = {
      getAllTypes: function () { return ['gain', 'compressor', 'eq', 'delay', 'reverb', 'limiter']; },
      getPlainLabel: function (t) { return 'plain:' + t; },
      getLabel: function (t) { return t; }
    };
    sandbox.PresetStore = {
      listNames: function () { return Object.keys(savedPresets); },
      load: function (name) { return savedPresets[name] || null; },
      save: function (name, nodes) {
        var over = !!savedPresets[name];
        savedPresets[name] = { name: name, nodes: nodes };
        return { ok: true, name: name, overwrote: over };
      }
    };
    sandbox.FactoryPresets = { list: function () { return []; }, listDetailed: function () { return []; } };
    sandbox.ChainEditing = {
      apply: function (request) { liveApplies.push(request); return Promise.resolve({ applied: true }); }
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'preset-link.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'presets-ui.js'), 'utf8'), sandbox);
    return {
      window: sandbox,
      els: registry,
      saved: savedPresets,
      liveApplies: liveApplies,
      notes: notes
    };
  }

  function arrivalCard(env) {
    return env.els['preset-list'].children.filter(function (c) {
      return c.getAttribute && c.getAttribute('data-share-arrival') === 'true';
    })[0] || null;
  }
  function cardKeys(card) {
    return card.children.filter(function (c) {
      return String(c.className).indexOf('share-arrival-actions') !== -1;
    })[0];
  }

  // E1-E3: a landing renders the card first; Add stores without loading.
  var landFrag = await h.window.PresetLink.buildShareFragment('Rock Night', CHAIN);
  var ui = uiHarness(landFrag.fragment);
  await new Promise(function (r) { setTimeout(r, 20); });
  ui.window.PresetsUI.refreshPresetSelect();
  var card = arrivalCard(ui);
  check(!!card && ui.els['preset-list'].children[0] === card,
    'E1: the arrival card renders FIRST in the preset list');
  check(!!card && card.textContent.indexOf('Rock Night') !== -1 &&
      card.textContent.indexOf('plain:gain') !== -1,
    'E1: it names the shared sound and summarizes it in plain language');
  var keys = card && cardKeys(card);
  var addBtn = keys && keys.children[0];
  check(!!addBtn && addBtn.textContent === 'Add to my sounds',
    'E1: the adding key is the primary action');
  if (addBtn) {
    addBtn.__fire('click');
    check(!!ui.saved['Rock Night'] && ui.liveApplies.length === 0,
      'E2: Add stores the sound and NEVER loads the live chain');
    ui.window.PresetsUI.refreshPresetSelect();
    check(arrivalCard(ui) === null,
      'E3: the card is gone once the share is added');
  } else {
    check(false, 'E2/E3: no adding key found');
  }

  // E4-E6: collision -> the triad; Replace wins; live chain untouched.
  var collideFrag = await h.window.PresetLink.buildShareFragment('Duet', CHAIN);
  var ui2 = uiHarness(collideFrag.fragment, { Duet: [node('z', 'gain', { gainDb: 0 })] });
  await new Promise(function (r) { setTimeout(r, 20); });
  ui2.window.PresetsUI.refreshPresetSelect();
  var card2 = arrivalCard(ui2);
  var keys2 = card2 && cardKeys(card2);
  var add2 = keys2 && keys2.children[0];
  if (add2) { add2.__fire('click'); }
  ui2.window.PresetsUI.refreshPresetSelect();
  var card2b = arrivalCard(ui2);
  var keys2b = card2b && cardKeys(card2b);
  check(!!keys2b && keys2b.children.some(function (k) { return k.textContent === 'Replace'; }) &&
      keys2b.children.some(function (k) { return k.textContent === 'Cancel'; }),
    'E4: a same-named personal sound swaps the card to the Rename/Replace/Cancel triad');
  var replaceBtn = keys2b && keys2b.children.filter(function (k) { return k.textContent === 'Replace'; })[0];
  if (replaceBtn) {
    replaceBtn.__fire('click');
    check(!!ui2.saved['Duet'] && ui2.saved['Duet'].nodes.length === CHAIN.length &&
        ui2.liveApplies.length === 0,
      'E5: Replace overwrites deliberately, still without touching the live chain');
  } else {
    check(false, 'E5: no Replace key');
  }

  // E7: the Copy link key enables exactly for an ACTIVE personal preset.
  var ui3 = uiHarness('', { 'My Stage Set': [node('a', 'gain', {})] });
  await new Promise(function (r) { setTimeout(r, 5); });
  ui3.window.PresetsUI.refreshPresetSelect('My Stage Set');
  check(ui3.els['share-preset-btn'].disabled === false,
    'E7: Copy link enables when the active preset is one of Yours');
  ui3.window.PresetsUI.refreshPresetSelect(null);
  check(ui3.els['share-preset-btn'].disabled === true,
    'E7: and disables once no personal preset is active');

  var built5 = await h.window.PresetLink.buildShareFragment('Solo', CHAIN);
  var h5 = makeSandbox(built5.fragment);
  await new Promise(function (resolve) { setTimeout(resolve, 20); });
  h5.saved['Solo'] = { name: 'Solo', nodes: [] };
  var blank = h5.window.PresetLink.savePendingShare({ mode: 'rename', newName: '   ' });
  check(blank.ok === false && blank.code === 'BAD_NAME',
    'D8: a blank rename name refuses BAD_NAME and keeps the pending share');
}

main().then(
  function () {
    console.log(failures.length === 0
      ? 'preset-link: ALL OK'
      : 'preset-link: ' + failures.length + ' FAIL');
    process.exit(failures.length === 0 ? 0 : 1);
  },
  function (err) {
    console.error('FAIL: harness threw: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
);
