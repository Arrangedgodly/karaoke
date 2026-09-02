// Regression coverage for the workflow that requests the other CodeBro.
//
// This test reads the committed workflow, checks its GitHub event and token
// contract, then executes the real actions/github-script body with API stubs.
// It needs only Node and is discovered automatically by tests/run.js.

'use strict';

var fs = require('fs');
var path = require('path');

var WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  '.github',
  'workflows',
  'request-codebro-review.yml'
);
var workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
var lines = workflow.split(/\r?\n/);
var failures = [];

function check(condition, label) {
  if (condition) {
    console.log('  ok - ' + label);
  } else {
    failures.push(label);
    console.log('  FAIL - ' + label);
  }
}

function leadingSpaces(line) {
  var match = /^(\s*)/.exec(line);
  return match ? match[1].length : 0;
}

function topLevelBlock(name) {
  var start = lines.indexOf(name + ':');
  if (start === -1) {
    return '';
  }

  var block = [];
  for (var i = start + 1; i < lines.length; i += 1) {
    if (/^\S/.test(lines[i])) {
      break;
    }
    block.push(lines[i]);
  }
  return block.join('\n');
}

function literalBlock(key) {
  var marker = new RegExp('^(\\s*)' + key + ':\\s*\\|\\s*$');
  var start = -1;
  var markerIndent = 0;

  for (var i = 0; i < lines.length; i += 1) {
    var match = marker.exec(lines[i]);
    if (match) {
      start = i + 1;
      markerIndent = match[1].length;
      break;
    }
  }

  if (start === -1) {
    return '';
  }

  var body = [];
  for (var j = start; j < lines.length; j += 1) {
    if (lines[j].trim() && leadingSpaces(lines[j]) <= markerIndent) {
      break;
    }
    body.push(lines[j]);
  }

  var contentIndents = body
    .filter(function (line) { return line.trim(); })
    .map(leadingSpaces);
  var contentIndent = contentIndents.length
    ? Math.min.apply(null, contentIndents)
    : markerIndent + 2;

  return body
    .map(function (line) { return line.slice(contentIndent); })
    .join('\n');
}

function parseFlowList(value) {
  return value
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

function sameList(actual, expected) {
  return actual.length === expected.length && actual.every(function (value, index) {
    return value === expected[index];
  });
}

function parsePermissions(block) {
  var permissions = {};
  block.split('\n').forEach(function (line) {
    var match = /^\s{2}([a-z-]+):\s*([a-z]+)\s*$/.exec(line);
    if (match) {
      permissions[match[1]] = match[2];
    }
  });
  return permissions;
}

var onBlock = topLevelBlock('on');
var eventMatch = /^\s{2}pull_request_target:\s*\n\s{4}types:\s*\[([^\]]+)\]\s*$/m.exec(onBlock);
var eventTypes = eventMatch ? parseFlowList(eventMatch[1]) : [];
check(
  sameList(eventTypes, ['opened', 'ready_for_review', 'reopened']),
  'pull_request_target runs for opened, ready_for_review, and reopened'
);

var permissions = parsePermissions(topLevelBlock('permissions'));
var permissionNames = Object.keys(permissions).sort();
check(
  sameList(permissionNames, ['pull-requests']) &&
    permissions['pull-requests'] === 'write',
  'workflow token has only pull-requests:write'
);

var jobGuardMatch = /^\s{4}if:\s*>-\s*\n((?:\s{6}.*(?:\n|$))+)/m.exec(workflow);
var jobGuard = jobGuardMatch ? jobGuardMatch[1].replace(/\s+/g, ' ').trim() : '';
var expectedJobGuard =
  "!github.event.pull_request.draft && " +
  "(github.event.pull_request.user.login == 'GrantWasil' || " +
  "github.event.pull_request.user.login == 'Arrangedgodly')";
check(
  jobGuard === expectedJobGuard,
  'job guard excludes draft and unrelated-author events'
);
check(
  workflow.indexOf('actions/checkout@') === -1,
  'workflow never checks out pull-request code'
);

var script = literalBlock('script');
check(script.length > 0, 'github-script body can be extracted from the workflow');

var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
var executeScript = new AsyncFunction('github', 'context', 'core', script);

async function runScenario(options) {
  var events = [];
  var getCalls = [];
  var requestCalls = [];
  var notices = [];
  var requestError = options.requestError || null;
  var context = {
    repo: { owner: 'ArtofFish', repo: 'voxchain' },
    payload: {
      pull_request: {
        number: 84,
        draft: false,
        user: { login: options.author }
      }
    }
  };
  var github = {
    rest: {
      pulls: {
        get: async function (params) {
          events.push('get');
          getCalls.push(params);
          return {
            data: {
              number: 84,
              state: options.state || 'open',
              draft: !!options.draft
            }
          };
        },
        requestReviewers: async function (params) {
          events.push('requestReviewers');
          requestCalls.push(params);
          if (requestError) {
            throw requestError;
          }
        }
      }
    }
  };
  var core = {
    notice: function (message) {
      notices.push(message);
    }
  };
  var error = null;

  try {
    await executeScript(github, context, core);
  } catch (caught) {
    error = caught;
  }

  return {
    error: error,
    events: events,
    getCalls: getCalls,
    requestCalls: requestCalls,
    notices: notices
  };
}

function hasCommonCoordinates(call) {
  return call &&
    call.owner === 'ArtofFish' &&
    call.repo === 'voxchain' &&
    call.pull_number === 84;
}

async function main() {
  var grant = await runScenario({ author: 'GrantWasil' });
  check(
    !grant.error && grant.getCalls.length === 1 && grant.requestCalls.length === 1 &&
      hasCommonCoordinates(grant.getCalls[0]) &&
      hasCommonCoordinates(grant.requestCalls[0]) &&
      sameList(grant.requestCalls[0].reviewers || [], ['Arrangedgodly']),
    'GrantWasil pull requests ask Arrangedgodly for review'
  );
  check(
    sameList(grant.events, ['get', 'requestReviewers']),
    'workflow fetches live pull-request state immediately before requesting review'
  );

  var arranged = await runScenario({ author: 'Arrangedgodly' });
  check(
    !arranged.error && arranged.requestCalls.length === 1 &&
      sameList(arranged.requestCalls[0].reviewers || [], ['GrantWasil']),
    'Arrangedgodly pull requests ask GrantWasil for review'
  );

  var draft = await runScenario({
    author: 'GrantWasil',
    state: 'open',
    draft: true
  });
  check(
    !draft.error && draft.getCalls.length === 1 && draft.requestCalls.length === 0 &&
      draft.notices.length === 1 && /draft/.test(draft.notices[0]),
    'a pull request that is currently draft is skipped with a notice'
  );

  var closed = await runScenario({
    author: 'GrantWasil',
    state: 'closed',
    draft: false
  });
  check(
    !closed.error && closed.getCalls.length === 1 && closed.requestCalls.length === 0 &&
      closed.notices.length === 1 && /closed/.test(closed.notices[0]),
    'a pull request that is currently closed is skipped with a notice'
  );

  var rejection = new Error('requestReviewers rejected');
  var rejected = await runScenario({
    author: 'GrantWasil',
    requestError: rejection
  });
  check(
    rejected.error === rejection && rejected.requestCalls.length === 1,
    'requestReviewers rejection remains a visible script failure'
  );

  if (failures.length > 0) {
    console.error('\n' + failures.length + ' workflow check(s) failed.');
    process.exit(1);
  }

  console.log('\nAll request-CodeBro workflow checks passed.');
}

main().catch(function (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
