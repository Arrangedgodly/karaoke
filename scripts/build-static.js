'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'dist');
const stagingDirectory = path.join(projectRoot, 'dist.tmp');
const publicFiles = ['index.html'];
const publicDirectories = ['assets', 'src', 'styles', 'vendor'];

function assertBuildTarget(target, expectedName) {
  if (path.dirname(target) !== projectRoot || path.basename(target) !== expectedName) {
    throw new Error(`Refusing to replace unexpected build target: ${target}`);
  }
}

function copyPublicSite() {
  assertBuildTarget(outputDirectory, 'dist');
  assertBuildTarget(stagingDirectory, 'dist.tmp');

  fs.rmSync(stagingDirectory, { recursive: true, force: true });
  fs.mkdirSync(stagingDirectory, { recursive: true });

  for (const file of publicFiles) {
    fs.copyFileSync(path.join(projectRoot, file), path.join(stagingDirectory, file));
  }

  for (const directory of publicDirectories) {
    fs.cpSync(
      path.join(projectRoot, directory),
      path.join(stagingDirectory, directory),
      { recursive: true }
    );
  }

  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.renameSync(stagingDirectory, outputDirectory);
}

function summarizeBuild() {
  let fileCount = 0;
  let byteCount = 0;
  const pending = [outputDirectory];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        fileCount += 1;
        byteCount += fs.statSync(entryPath).size;
      }
    }
  }

  console.log(`Built ${fileCount} public files in dist (${byteCount} bytes).`);
}

copyPublicSite();
summarizeBuild();
