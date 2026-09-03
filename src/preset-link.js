// preset-link.js — sounds that travel as LINKS (2026-09-02 shape round).
//
// The design brief this implements: sharing a personal preset is a URL
// you paste into any chat, not a file you hand over — the link IS the
// preset. The payload rides in the URL FRAGMENT (#preset=...), so
// nothing is ever sent to a server: the Worker stays a dumb file
// server, the app keeps its zero-runtime-internet, no-account,
// no-cloud constraints, and the fragment never appears in any log.
//
// Wire format (append-only, versioned by prefix):
//   #preset=v1.<base64url(JSON)>            — plain
//   #preset=v1d.<base64url(deflate-raw)>    — compressed, when the
//                                             CompressionStream API is
//                                             available (Chrome-only
//                                             recommendation stands);
//                                             the parser accepts both.
// The JSON is exactly PresetSchema.serialize's own shape — { name,
// schemaVersion, nodes } — chain data only: no audio, no microphone
// identifiers, no local settings.
//
// Three responsibilities, framework-free and unit-testable:
//   1. CODEC — buildShareFragment()/parseShareFragment(), async (the
//      compression path is), never throwing (structured results).
//   2. VALIDATION — deserialize structure + live-catalog type legality
//      + honest caps, with named errors the arrival card prints.
//   3. ARRIVAL STATE — read the fragment ONCE at load, hold the pending
//      share (or its refusal) for the panels to render, and consume the
//      hash (history.replaceState) so a refresh never re-offers it.
//
// Deliberately NOT here: the live chain. Adding a shared sound to the
// store never loads it — the same "transfer feedback must name the
// preset and result without moving or loading the live chain" rule the
// documented transfer contract carries.
//
// Loaded as a plain (non-module) <script> before presets-ui.js and
// simple-view.js, which read window.PresetLink lazily and degrade to a
// no-op when it is absent (stripped harnesses keep working).
(function () {
  'use strict';

  var FRAGMENT_KEY = 'preset';
  var MAX_NAME_CHARS = 80;
  var MAX_NODES = 32;

  // -------------------------------------------------------------------
  // Bytes <-> base64url. btoa/atob exist in every supported Chrome and
  // in the Node versions the test suite runs on; the URL-safe alphabet
  // (- and _, no padding) keeps the payload free of characters that
  // need percent-encoding inside a fragment.
  // -------------------------------------------------------------------
  function bytesToBase64Url(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.slice(i, i + 0x8000));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBytes(text) {
    var normalized = text.replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4 !== 0) {
      normalized += '=';
    }
    var binary = atob(normalized);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function utf8Encode(text) {
    return new TextEncoder().encode(text);
  }

  function utf8Decode(bytes) {
    return new TextDecoder().decode(bytes);
  }

  // -------------------------------------------------------------------
  // Compression (optional, feature-detected). deflate-raw keeps the
  // payload small without a vendored compressor; when the API is
  // missing the plain v1 form is used and the parser accepts both, so
  // old links and new links stay readable forever.
  // -------------------------------------------------------------------
  function canCompress() {
    return typeof CompressionStream === 'function' &&
      typeof DecompressionStream === 'function';
  }

  function compress(bytes) {
    var stream = new CompressionStream('deflate-raw');
    var writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return new Response(stream.readable).arrayBuffer().then(function (buffer) {
      return new Uint8Array(buffer);
    });
  }

  function decompress(bytes) {
    var stream = new DecompressionStream('deflate-raw');
    var writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return new Response(stream.readable).arrayBuffer().then(function (buffer) {
      return new Uint8Array(buffer);
    });
  }

  // -------------------------------------------------------------------
  // Validation — structured refusal, never a throw past this module.
  // -------------------------------------------------------------------
  function refusal(code, message) {
    return { ok: false, code: code, message: message };
  }

  /** Structure + catalog legality for one decoded payload. Returns
   *  {ok:true, name, nodes} or a named refusal for the arrival card. */
  function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return refusal('BAD_LINK', 'This link does not carry a readable sound.');
    }
    try {
      var data = window.PresetSchema.deserialize(payload);
      if (data.name.length > MAX_NAME_CHARS) {
        return refusal('BAD_NAME', 'The sound\u2019s name is too long to import.');
      }
      if (data.nodes.length > MAX_NODES) {
        return refusal('BAD_SIZE', 'The linked sound has too many sections for this app.');
      }
      var catalog = window.EffectCatalog;
      var known = catalog && typeof catalog.getAllTypes === 'function'
        ? catalog.getAllTypes()
        : null;
      if (known) {
        for (var i = 0; i < data.nodes.length; i++) {
          if (known.indexOf(data.nodes[i].type) === -1) {
            return refusal('BAD_TYPE',
              'The linked sound uses "' + data.nodes[i].type +
              '", which this app does not have.');
          }
        }
      }
      return { ok: true, name: data.name, nodes: data.nodes };
    } catch (err) {
      return refusal('BAD_LINK',
        'This link\u2019s sound is not one this version of the app can read.');
    }
  }

  // -------------------------------------------------------------------
  // Codec.
  // -------------------------------------------------------------------

  /** Build the #preset=... fragment for a personal preset. Never
   *  throws; a codec failure degrades to the plain form, and a payload
   *  that cannot even be serialized refuses with the schema's own
   *  message (the caller shows it inline). */
  function buildShareFragment(name, nodes) {
    var payload;
    try {
      payload = window.PresetSchema.serialize(name, nodes);
    } catch (err) {
      return Promise.resolve(refusal('BAD_PRESET',
        'This sound could not be encoded for sharing.'));
    }
    var json = JSON.stringify(payload);
    var plain = '#preset=v1.' + bytesToBase64Url(utf8Encode(json));
    if (!canCompress()) {
      return Promise.resolve({ ok: true, fragment: plain });
    }
    return compress(utf8Encode(json)).then(
      function (bytes) {
        var deflated = '#preset=v1d.' + bytesToBase64Url(bytes);
        // The compressed form wins only while it is genuinely shorter.
        return { ok: true, fragment: deflated.length < plain.length ? deflated : plain };
      },
      function () {
        return { ok: true, fragment: plain };
      }
    );
  }

  /** The full shareable URL on the CURRENT origin (a localhost link
   *  stays local; the deployed origin is the shareable one). */
  function buildShareUrl(name, nodes) {
    return buildShareFragment(name, nodes).then(function (result) {
      if (!result.ok) {
        return result;
      }
      var origin = typeof location !== 'undefined' && location
        ? location.origin + location.pathname
        : '';
      return { ok: true, url: origin + result.fragment };
    });
  }

  /** Parse a #preset=... hash into a validated share (or refusal). */
  function parseShareFragment(hash) {
    var raw = typeof hash === 'string' ? hash : '';
    var match = /^#preset=(v1|v1d)\.([A-Za-z0-9_-]+)$/.exec(raw);
    if (!match) {
      return Promise.resolve(refusal('BAD_LINK', 'This link does not carry a readable sound.'));
    }
    var bytes;
    try {
      bytes = base64UrlToBytes(match[2]);
    } catch (err) {
      return Promise.resolve(refusal('BAD_LINK', 'This link does not carry a readable sound.'));
    }
    var jsonPromise = match[1] === 'v1d' && canCompress()
      ? decompress(bytes).then(function (inflated) { return utf8Decode(inflated); })
      : Promise.resolve(utf8Decode(bytes));
    return jsonPromise.then(
      function (json) {
        var payload;
        try {
          payload = JSON.parse(json);
        } catch (err) {
          return refusal('BAD_LINK', 'This link does not carry a readable sound.');
        }
        return validatePayload(payload);
      },
      function () {
        return refusal('BAD_LINK', 'This link does not carry a readable sound.');
      }
    );
  }

  // -------------------------------------------------------------------
  // Arrival state — read once, consume the hash, hold the result.
  // -------------------------------------------------------------------
  var pendingShare = null; // {ok:true, name, nodes} | {ok:false, ...} | null

  function init() {
    var hash = typeof location !== 'undefined' && location ? location.hash : '';
    if (!/^#preset=/.test(hash)) {
      return;
    }
    // Consume FIRST so a refresh (or a failed parse) never re-offers.
    try {
      if (typeof history !== 'undefined' && history && typeof history.replaceState === 'function') {
        history.replaceState(null, '', (location.pathname || '') + (location.search || ''));
      }
    } catch (err) {
      /* non-fatal: some embedded contexts forbid replaceState */
    }
    parseShareFragment(hash).then(function (result) {
      pendingShare = result;
      // The panels re-render themselves on their own events; nudge both
      // through the one shared notification they already listen to.
      try {
        if (window.PresetsUI && typeof window.PresetsUI.refreshPresetSelect === 'function') {
          window.PresetsUI.refreshPresetSelect();
        }
      } catch (err) { /* panel absent — Simple still reads getPendingShare */ }
      try {
        if (window.SimpleView && typeof window.SimpleView.onChainChanged === 'function') {
          window.SimpleView.onChainChanged();
        }
      } catch (err) { /* Simple absent */ }
    });
  }

  /** The pending share for the panels to render, or null. */
  function getPendingShare() {
    return pendingShare;
  }

  /** Dismiss (or complete) the pending share. */
  function clearPendingShare() {
    pendingShare = null;
  }

  /** Save the pending share into the personal store. `mode`:
   *  'add' (first attempt — refuses with COLLISION when the name
   *  exists), 'rename' with `newName` (refuses when THAT name exists),
   *  'replace' (overwrites deliberately). Never touches the live
   *  chain. Returns the store's own structured result. */
  function savePendingShare(options) {
    var opts = options || {};
    if (!pendingShare || !pendingShare.ok) {
      return refusal('NOTHING_PENDING', 'There is no shared sound to add.');
    }
    var name = pendingShare.name;
    if (opts.mode === 'rename') {
      var trimmed = String(opts.newName || '').trim();
      if (trimmed.length === 0) {
        return refusal('BAD_NAME', 'Give the sound a name.');
      }
      if (trimmed.length > MAX_NAME_CHARS) {
        return refusal('BAD_NAME', 'The sound\u2019s name is too long.');
      }
      name = trimmed;
    }
    var store = window.PresetStore;
    if (!store || typeof store.save !== 'function' || typeof store.load !== 'function') {
      return refusal('NO_STORE', 'Your saved sounds are not available right now.');
    }
    var exists = false;
    try {
      exists = !!store.load(name);
    } catch (err) {
      exists = false;
    }
    if (exists && opts.mode !== 'replace') {
      return refusal('COLLISION', {
        name: name,
        message: 'You already have a sound named "' + name + '".'
      });
    }
    try {
      store.save(name, pendingShare.nodes);
    } catch (err) {
      return refusal('SAVE_FAILED',
        'Could not save "' + name + '". Your other sounds are untouched.');
    }
    var savedName = name;
    clearPendingShare();
    return { ok: true, name: savedName, replaced: exists };
  }

  // Self-initialize at load; any internal failure leaves the module a
  // no-op (the app without sharing is exactly today's app).
  try {
    init();
  } catch (err) {
    if (typeof console !== 'undefined' && console && console.warn) {
      console.warn('PresetLink: initialization failed — link sharing is off; the rest of the app is unaffected.');
    }
  }

  /** Copy text to the clipboard with the legacy fallback plain-http
   *  origins need (no async clipboard API there): textarea + execCommand.
   *  Resolves true/false; never throws — the caller decides how a
   *  failure is surfaced. Shared by both panels' Copy link keys. */
  function copyToClipboard(text) {
    return new Promise(function (resolve) {
      var legacy = function () {
        try {
          var area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.left = '-9999px';
          document.body.appendChild(area);
          area.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(area);
          resolve(!!ok);
        } catch (err) {
          resolve(false);
        }
      };
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(text).then(
            function () { resolve(true); },
            legacy
          );
          return;
        }
      } catch (err) {
        /* fall through to the legacy path */
      }
      legacy();
    });
  }

  window.PresetLink = {
    buildShareFragment: buildShareFragment,
    buildShareUrl: buildShareUrl,
    parseShareFragment: parseShareFragment,
    getPendingShare: getPendingShare,
    clearPendingShare: clearPendingShare,
    savePendingShare: savePendingShare,
    copyToClipboard: copyToClipboard
  };
})();
