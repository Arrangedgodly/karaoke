#!/usr/bin/env node
// Zero-dependency real-browser probe driver (Chrome via the DevTools
// Protocol). NOT part of the auto-discovered suite (run.js picks up
// tests/test-*.js only); invoke directly:
//
//   node tests/browser-probe.js <url> <expression-file> [WxH]
//   node tests/browser-probe.js <url> --screenshot [png-path] [WxH]
//
// The expression file's contents are evaluated in the page with
// Runtime.evaluate { awaitPromise: true, returnByValue: true } — write the
// file as the body of an async function that returns a JSON-serializable
// value (throw to fail). Viewport defaults to 1440x900; pass e.g. 390x844
// for the mobile breakpoint. Mirrors the documented manual CDP procedure
// (docs/ultron/redesign.md "real-browser verification"): fresh profile,
// fake-mic flags so getUserMedia succeeds without prompts, autoplay allowed
// so AudioContext starts without a gesture.
//
// Page console errors/warnings while the expression runs are captured and
// reported alongside the result (the QA-5 empty-console gate).

'use strict';

var http = require('http');
var { spawn } = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

var CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
var DEBUG_PORT = 9333;
var PAGE_LOAD_TIMEOUT_MS = 30000;
var EVAL_TIMEOUT_MS = 60000;

function fail(message) {
  console.error('browser-probe: ' + message);
  process.exit(1);
}

function httpGetJson(url) {
  return new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function waitForDebugEndpoint() {
  var url = 'http://127.0.0.1:' + DEBUG_PORT + '/json/version';
  for (var i = 0; i < 100; i++) {
    try { return await httpGetJson(url); } catch (e) { await sleep(100); }
  }
  throw new Error('Chrome debug endpoint never came up on port ' + DEBUG_PORT);
}

function cdpCall(ws, id, method, params) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error('CDP call timed out: ' + method));
    }, EVAL_TIMEOUT_MS);
    ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    // Response routed by the message pump below.
    pendingCalls[id] = { resolve: resolve, reject: reject, timer: timer };
  });
}

var pendingCalls = {};
var nextId = 1;
var consoleEvents = [];

function pump(ws) {
  ws.onmessage = function (ev) {
    var msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.id && pendingCalls[msg.id]) {
      var call = pendingCalls[msg.id];
      delete pendingCalls[msg.id];
      clearTimeout(call.timer);
      if (msg.error) call.reject(new Error(msg.error.message || 'CDP error'));
      else call.resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      var text = (msg.params.args || []).map(function (a) {
        return a.value !== undefined ? a.value : (a.description || a.type);
      }).join(' ');
      consoleEvents.push({ type: msg.params.type, text: text });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      var d = msg.params.exceptionDetails;
      consoleEvents.push({
        type: 'exception',
        text: (d.exception && (d.exception.description || d.exception.value)) || d.text || 'exception'
      });
    }
  };
}

async function main() {
  var args = process.argv.slice(2);
  if (args.length < 2) {
    fail('usage: node tests/browser-probe.js <url> <expression-file | --screenshot> [png-path]');
  }
  var targetUrl = args[0];
  var mode = args[1];
  var expr = null;
  var shotPath = null;
  var viewport = '1440,900';
  var rest = args.slice(2);
  if (rest.length && /^\d+x\d+$/.test(rest[rest.length - 1])) {
    viewport = rest.pop().replace('x', ',');
  }
  if (mode === '--screenshot') {
    shotPath = rest[0] || fail('--screenshot needs a png path');
  } else {
    expr = fs.readFileSync(mode, 'utf8');
    // Optional trailing png path: capture AFTER the expression ran, so the
    // raster shows the state the expression drove the page to.
    if (rest.length && /\.png$/.test(rest[0])) {
      shotPath = rest.shift();
    }
  }
  if (!fs.existsSync(CHROME)) fail('Chrome not found at ' + CHROME);

  var profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-probe-'));
  var chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--user-data-dir=' + profileDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=' + viewport,
    targetUrl
  ], { stdio: 'ignore' });

  var exitCode = 0;
  try {
    await waitForDebugEndpoint();
    var targets = await httpGetJson('http://127.0.0.1:' + DEBUG_PORT + '/json/list');
    var page = targets.filter(function (t) { return t.type === 'page' && t.webSocketDebuggerUrl; })[0];
    if (!page) throw new Error('no page target found');
    var ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(function (resolve, reject) {
      ws.onopen = resolve;
      ws.onerror = function () { reject(new Error('websocket connect failed')); };
    });
    pump(ws);

    await cdpCall(ws, nextId++, 'Runtime.enable');
    await cdpCall(ws, nextId++, 'Page.enable');

    // Wait for the page's load event, then give scripts a beat to run.
    await sleep(1500);

    if (expr === null) {
      // Screenshot-only mode: capture the freshly loaded page.
      var shot = await cdpCall(ws, nextId++, 'Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
      console.log(JSON.stringify({ ok: true, screenshot: shotPath }, null, 2));
    } else {
      var result = await cdpCall(ws, nextId++, 'Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true
      });
      if (result.exceptionDetails) {
        var d = result.exceptionDetails;
        console.error('page exception: ' + ((d.exception && d.exception.description) || d.text));
        exitCode = 1;
      } else {
        console.log(JSON.stringify(result.result.value, null, 2));
        if (shotPath) {
          // Post-expression raster: the state the expression drove to.
          var shot2 = await cdpCall(ws, nextId++, 'Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(shotPath, Buffer.from(shot2.data, 'base64'));
          console.log('raster: ' + shotPath);
        }
      }
    }
    ws.close();
  } catch (e) {
    console.error('browser-probe: ' + (e && e.message ? e.message : e));
    exitCode = 1;
  } finally {
    chrome.kill('SIGTERM');
    await sleep(300);
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
  if (consoleEvents.length) {
    console.error('--- page console (' + consoleEvents.length + ') ---');
    consoleEvents.forEach(function (c) { console.error('[' + c.type + '] ' + c.text); });
  }
  process.exit(exitCode);
}

main().catch(function (e) { fail(e && e.message ? e.message : String(e)); });
