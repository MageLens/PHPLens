// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function workflow(t, {runner = 'cypress', failure = '', args = [], interrupted = false, profile = true} = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shopware-workflow-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    for (const name of ['bin', '.runtime', '.runtime/pcov', 'coverage']) fs.mkdirSync(path.join(root, name));
    fs.copyFileSync(path.join(__dirname, '../bin/run-coverage'), path.join(root, 'bin/run-coverage'));
    fs.writeFileSync(path.join(root, '.runtime/installed'), '6.7.16.1\n');
    if (profile) fs.writeFileSync(path.join(root, '.runtime/coverage-profile'), `1 ${runner} current\n`);
    fs.writeFileSync(path.join(root, 'coverage/.published'), 'old');
    if (interrupted) for (const file of ['hooks-active', 'coverage-override-active']) fs.writeFileSync(path.join(root, '.runtime', file), '');
    if (interrupted) fs.writeFileSync(path.join(root, '.runtime/pcov/theme-state.json'), '[]');
    fs.writeFileSync(path.join(root, 'bin/common'), `
set -euo pipefail
ROOT=$PWD
SHOPWARE_ORIGIN=https://custom.test:18443
APPLICATION_DOMAIN=custom.test
RUNNER_VIEW_PORT=16081
MAGELENS_RUNNER=${runner}
preflight() { :; }
coverage_fingerprint() { echo current; }
say() { printf '%s\\n' "$*"; }
fail() { echo "$*" >&2; exit 1; }
lock_workflow() { mkdir .runtime/workflow.lock; }
dc() { execute normal "$@"; }
coverage_dc() { execute coverage "$@"; }
execute() {
    printf '%s\\n' "$*" >> calls
    case "$*" in
        *runner\\ true) [[ "$TEST_FAILURE" != stopped ]] || return 1 ;;
        *project.php) [[ "$TEST_FAILURE" != metadata ]] || return 1; echo '{}' ;;
        *prepare.cjs)
            [[ "$TEST_FAILURE" != prepare ]] || return 1
            rm -rf coverage; mkdir coverage
            printf '{"id":"0123456789abcdef0123456789abcdef"}' > coverage/run.json ;;
        *hooks.php\\ cleanup) [[ "$TEST_FAILURE" != cleanup ]] || return 1 ;;
        *hooks.php\\ before) [[ "$TEST_FAILURE" != hook ]] || return 1 ;;
        *hooks.php\\ prepare) echo '{}' ;;
        *theme-state.php\\ save) [[ "$TEST_FAILURE" != theme-save ]] || return 1; echo '[]' > .runtime/pcov/theme-state.json ;;
        *theme-state.php\\ restore) [[ "$TEST_FAILURE" != theme-restore ]] || return 1; rm -f .runtime/pcov/theme-state.json ;;
        *storefront-build*) [[ "$TEST_FAILURE" != build ]] || return 1 ;;
        *collection.php\\ start) touch coverage/.active-run ;;
        *collection.php\\ stop) rm -f coverage/.active-run ;;
        *run-browser.cjs\\ --warmup|*run-playwright.cjs\\ --warmup) [[ "$TEST_FAILURE" != warmup ]] || return 124 ;;
        *run-browser.cjs|*run-playwright.cjs)
            [[ "$TEST_FAILURE" != signal ]] || kill -TERM $$
            [[ "$TEST_FAILURE" != tests ]] || return 23 ;;
        *report.php) [[ "$TEST_FAILURE" != php-report ]] || return 1; rm -f coverage/.active-run ;;
        *report-browser.cjs*) [[ "$TEST_FAILURE" != finalize ]] || return 1; echo '<html>current</html>' > coverage/index.html ;;
        *normal\\ up*) [[ "$TEST_FAILURE" != restore ]] || return 1 ;;
        *runner\\ node\\ -p*) [[ "$TEST_FAILURE" != publish ]] || return 1; echo 0123456789abcdef0123456789abcdef ;;
    esac
    return 0
}
`);
    const result = spawnSync('bash', ['bin/run-coverage', ...args], {cwd: root, encoding: 'utf8', env: {...process.env, TEST_FAILURE: failure}});
    const calls = fs.existsSync(path.join(root, 'calls')) ? fs.readFileSync(path.join(root, 'calls'), 'utf8') : '';
    const exists = file => fs.existsSync(path.join(root, file));
    assert.equal(exists('.runtime/workflow.lock'), false);
    assert.equal(exists('coverage/.active-run'), false);
    if (result.status) {
        assert.doesNotMatch(result.stdout, /Open the combined coverage report/);
        // An incompatible installation fails before acquiring the lock or invalidating reports.
        if (profile) assert.equal(exists('coverage/.published'), false);
    }
    return {...result, root, calls, exists};
}

for (const runner of ['cypress', 'playwright']) {
    test(`${runner}: publishes only after fixture cleanup and normal application restoration`, t => {
        const r = workflow(t, {runner});
        assert.equal(r.status, 0, r.stderr);
        assert.match(r.stdout, /https:\/\/custom.test:18443\/coverage\/index.html/);
        assert.ok(r.exists('coverage/.published'));
        assert.ok(!r.exists('.runtime/hooks-active') && !r.exists('.runtime/coverage-override-active'));
        assert.ok(r.calls.indexOf('hooks.php cleanup') < r.calls.lastIndexOf('normal up'));
        assert.ok(r.calls.lastIndexOf('normal up') < r.calls.indexOf('runner node -p'));
        assert.match(r.calls, /normal exec -T -e APPLICATION_DOMAIN=custom\.test -e RUNNER_VIEW_PORT=16081 runner node bin\/coverage\/prepare\.cjs/);
        assert.doesNotMatch(r.calls, /phpfpm|bin\/magento|template|theme-scope/);
    });
    for (const failure of ['stopped', 'metadata', 'prepare', 'theme-save', 'theme-restore', 'hook', 'build', 'warmup', 'tests', 'php-report', 'finalize', 'cleanup', 'restore', 'publish', 'signal']) {
        test(`${runner}: ${failure} leaves no public success and releases the lock`, t => {
            const r = workflow(t, {runner, failure});
            assert.notEqual(r.status, 0, r.stdout);
            if (failure === 'cleanup') assert.ok(r.exists('.runtime/hooks-active'));
            if (failure === 'restore') assert.ok(r.exists('.runtime/coverage-override-active'));
            if (failure === 'theme-restore') assert.ok(r.exists('.runtime/coverage-override-active') && r.exists('.runtime/pcov/theme-state.json'));
            if (failure === 'signal') assert.equal(r.status, 143);
        });
    }
    test(`${runner}: interrupted hooks recover before replacing the disposable application`, t => {
        const r = workflow(t, {runner, interrupted: true});
        assert.equal(r.status, 0, r.stderr);
        assert.ok(r.calls.indexOf('hooks.php cleanup') < r.calls.indexOf('prepare.cjs'));
        assert.ok(r.calls.indexOf('theme-state.php restore') < r.calls.indexOf('prepare.cjs'));
        assert.equal(r.exists('.runtime/hooks-active'), false);
        assert.equal(r.exists('.runtime/pcov/theme-state.json'), false);
    });
    test(`${runner}: refresh and startup flags use Shopware services and native commands`, t => {
        const r = workflow(t, {runner, args: ['--start', '--refresh-cache', '--refresh-assets', '--restart-php']});
        assert.equal(r.status, 0, r.stderr);
        assert.match(r.calls, /normal --profile coverage up.*app runner/);
        assert.match(r.calls, /bin\/console cache:clear/);
        assert.match(r.calls, /storefront-build --no-interaction --force-install-dependencies/);
        assert.match(r.calls, /coverage restart -t 60 app/);
    });
}

test('missing coverage installation directs existing shops to reinstall before any execution', t => {
    const r = workflow(t, {profile: false});
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /install the coverage runtime/);
    assert.equal(r.calls, '');
});
