'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const logo = fs.readFileSync(path.join(root, 'assets', 'voxchain-logo-grayscale.svg'), 'utf8');

let failed = 0;
function check(condition, message) {
  if (condition) {
    console.log('  ok - ' + message);
  } else {
    failed += 1;
    console.error('  FAIL - ' + message);
  }
}

console.log('brand logo');

check(/<link rel="icon" type="image\/svg\+xml" href="assets\/voxchain-logo-grayscale\.svg">/.test(html),
  'the favicon uses the grayscale logo asset');

const marks = html.match(/<img class="view-logo-mark" src="assets\/voxchain-logo-grayscale\.svg"[^>]*>/g) || [];
check(marks.length === 2, 'Simple and Advanced each render the same logo asset');
check(marks.every(function (mark) { return /alt=""/.test(mark) && /aria-hidden="true"/.test(mark); }),
  'both decorative marks stay out of the accessibility tree');

const advancedStart = html.indexOf('<div class="voice-deck-face">');
const simpleShell = html.indexOf('SIMPLE VIEW SHELL', advancedStart);
const simpleStart = html.indexOf('<div class="voice-deck-face" id="simple-stage-face">', simpleShell);
const dialogStart = html.indexOf('HEADPHONE CHECK', simpleStart);
check((html.slice(advancedStart, simpleShell).match(/class="view-logo-mark"/g) || []).length === 1,
  'the Advanced view owns one bottom-right mark');
check((html.slice(simpleStart, dialogStart).match(/class="view-logo-mark"/g) || []).length === 1,
  'the Simple view owns one bottom-right mark');

check(/fill="#([0-9a-fA-F]{2})\1\1"/.test(logo),
  'the logo fill is a neutral grayscale value');
check(/\.view-logo-mark\s*\{[^}]*position:\s*absolute[^}]*right:\s*0\.75rem[^}]*bottom:\s*0\.65rem[^}]*opacity:\s*0\.2/s.test(css),
  'the view marks sit quietly at the bottom-right');

if (failed) {
  console.error('\nbrand-logo: ' + failed + ' check(s) failed');
  process.exit(1);
}

console.log('brand-logo: all checks passed');
