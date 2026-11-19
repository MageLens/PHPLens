// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');

function workspace(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shopware-install-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const repo = path.resolve(__dirname, '../..');
    for (const file of ['bin', 'install.sh', 'bootstrap.sh', 'dependencies.yaml']) {
        fs.cpSync(path.join(repo, file), path.join(root, file), {recursive: true});
    }
    fs.mkdirSync(path.join(root, 'commands'));
    fs.writeFileSync(path.join(root, 'commands/docker'), `#!/usr/bin/env bash
set -eu
case "$1" in
    info) exit 0 ;;
    ps) if [[ -n \${FOREIGN_CHECKOUT:-} ]]; then printf 'db\\t%s\\n' "$FOREIGN_CHECKOUT"; fi ;;
    volume)
        if [[ -n \${FOREIGN_VOLUME:-} ]]; then
            case "$2" in ls) echo shopware_dbdata ;; inspect) echo /other ;; esac
        fi ;;
    compose)
        [[ "$2" == version ]] && echo 2.24.4 || { echo "Unexpected Compose call" >&2; exit 71; } ;;
    run)
        case "\${*: -1}" in
            --version) echo 'shopware-cli version 0.20.0' ;;
            /tools/latest-version.php)
                [[ -z \${LATEST_VERSION_UNAVAILABLE:-} ]] || exit 74
                echo 6.7.20.1 ;;
            /source) echo "\${SCAFFOLD_VERSION:-6.7.16.1}" ;;
            --git=false)
                printf '%s\\n' "$@" > scaffold-args
                [[ -z \${SCAFFOLD_VERSION:-} ]] || exit 0
                echo 'Interrupted scaffold' >&2
                exit 130 ;;
            *) exit 72 ;;
        esac ;;
    *) exit 73 ;;
esac
`, {mode: 0o755});
    const run = (args, env = {}) => spawnSync('bash', ['install.sh', ...args], {
        cwd: root, encoding: 'utf8', env: {
            ...process.env, COMPOSE_PROJECT_NAME: '', APPLICATION_DOMAIN: '', APPLICATION_PORT: '',
            APPLICATION_HTTPS_PORT: '', PATH: path.join(root, 'commands') + ':' + process.env.PATH, ...env,
        },
    });
    return {root, run, exists: file => fs.existsSync(path.join(root, file))};
}

test('foreign source fails before project settings or volumes are created', t => {
    const f = workspace(t);
    fs.mkdirSync(path.join(f.root, 'src'));
    fs.writeFileSync(path.join(f.root, 'src/composer.json'), '{}');
    assert.match(f.run([]).stderr, /complete Shopware project/);
    assert.ok(!f.exists('.runtime') && !f.exists('.env'));
});

test('foreign containers and orphaned volumes are rejected before installation', t => {
    const f = workspace(t);
    for (const env of [{FOREIGN_CHECKOUT: '/other'}, {FOREIGN_VOLUME: 'yes'}]) {
        assert.match(f.run([], env).stderr, /another checkout/);
        assert.ok(!f.exists('.runtime') && !f.exists('.env'));
    }
});

test('failed scaffolding leaves src available for a retry under the saved project', t => {
    const f = workspace(t);
    for (const args of [['--project-name', 'client', 'client.test'], []]) {
        const result = f.run(['--container-only', ...args], {APPLICATION_HTTPS_PORT: '18443'});
        assert.equal(result.status, 130, result.stderr);
        assert.ok(!f.exists('src') && !f.exists('.runtime/installed') && !f.exists('.runtime/workflow.lock'));
        assert.ok(!fs.readdirSync(path.join(f.root, '.runtime')).some(name => name.startsWith('create.')));
    }
    const settings = fs.readFileSync(path.join(f.root, '.env'), 'utf8');
    assert.match(settings, /^APPLICATION_DOMAIN=client.test$/m);
    assert.match(settings, /^APPLICATION_HTTPS_PORT=18443$/m);
    assert.match(settings, /^COMPOSE_PROJECT_NAME=client$/m);
    assert.match(f.run(['--project-name', 'other']).stderr, /refusing to switch/);
});

test('a fresh install scaffolds the latest resolved stable version by default', t => {
    const f = workspace(t);
    const result = f.run(['shopware.test']);
    assert.equal(result.status, 130, result.stderr);
    assert.match(fs.readFileSync(path.join(f.root, 'scaffold-args'), 'utf8'),
        /project\ncreate\nshopware\n6\.7\.20\.1\n/);
});

test('an explicit version bypasses the latest lookup and reaches the scaffold exactly', t => {
    const f = workspace(t);
    for (const args of [['shopware.test', '--version', '6.7.15.1'], ['--version=v6.7.15.1', 'shopware.test']]) {
        const result = f.run(args, {LATEST_VERSION_UNAVAILABLE: 'yes'});
        assert.equal(result.status, 130, result.stderr);
        assert.match(fs.readFileSync(path.join(f.root, 'scaffold-args'), 'utf8'),
            /project\ncreate\nshopware\n6\.7\.15\.1\n/);
    }
});

test('invalid version arguments and unavailable metadata fail before saving settings', t => {
    const f = workspace(t);
    for (const args of [['--version'], ['--version='], ['--version', '6.6.10.32'],
        ['--version', '6.7.16.1-rc1']]) {
        const result = f.run(args);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /--version/);
        assert.ok(!f.exists('.runtime') && !f.exists('.env'));
    }
    const result = f.run(['shopware.test'], {LATEST_VERSION_UNAVAILABLE: 'yes'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Could not resolve the latest stable Shopware 6.7 release/);
    assert.ok(!f.exists('scaffold-args') && !f.exists('src') && !f.exists('.env'));
});

test('a scaffold that locks a different version is discarded', t => {
    const f = workspace(t);
    const result = f.run(['--version', '6.7.15.1'], {SCAFFOLD_VERSION: '6.7.16.1'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Requested Shopware 6.7.15.1, but the scaffold locked 6.7.16.1/);
    assert.ok(!f.exists('src') && !f.exists('.runtime/workflow.lock'));
});

test('an existing project uses its locked version and rejects a conflicting selection', t => {
    const f = workspace(t);
    for (const file of ['composer.json', 'composer.lock', 'bin/console', 'public/index.php']) {
        const target = path.join(f.root, 'src', file);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, '');
    }
    const conflict = f.run(['--version', '6.7.15.1', 'shopware.test']);
    assert.equal(conflict.status, 1);
    assert.match(conflict.stderr, /src\/composer.lock uses Shopware 6.7.16.1/);
    assert.ok(!f.exists('.env') && !f.exists('scaffold-args'));

    for (const args of [['shopware.test'], ['--version', '6.7.16.1', 'shopware.test']]) {
        const result = f.run(args, {LATEST_VERSION_UNAVAILABLE: 'yes'});
        assert.equal(result.status, 71, result.stderr);
        assert.match(result.stdout, /Preparing local Shopware 6.7.16.1/);
        assert.ok(!f.exists('scaffold-args'));
    }
});

test('an active workflow lock protects source and readiness state', t => {
    const f = workspace(t);
    fs.mkdirSync(path.join(f.root, '.runtime/workflow.lock'), {recursive: true});
    fs.writeFileSync(path.join(f.root, '.runtime/installed'), 'previous');
    assert.match(f.run([]).stderr, /installation is active/);
    assert.ok(f.exists('.runtime/installed') && f.exists('.runtime/workflow.lock') && !f.exists('.env'));
});

test('checkout bootstrap forwards arguments only inside its selected checkout', t => {
    const f = workspace(t);
    const entry = path.join(f.root, 'bootstrap.sh');
    const args = [entry, '--help'];
    const inside = spawnSync('bash', args, {cwd: f.root, encoding: 'utf8'});
    assert.equal(inside.status, 0, inside.stderr);
    assert.match(inside.stdout, /--container-only/);
    assert.match(inside.stdout, /--version/);
    const outside = spawnSync('bash', args, {cwd: path.dirname(f.root), encoding: 'utf8'});
    assert.notEqual(outside.status, 0);
    assert.match(outside.stderr, /in the Shopware fork checkout/);
    assert.ok(!f.exists('.runtime'));
});
