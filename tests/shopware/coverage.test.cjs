// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');
const suites = require('../../bin/test-suites.cjs');
const repo = path.resolve(__dirname, '../..');

function workspace(t) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shopware-coverage-')));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const write = (file, content) => {
        fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
        fs.writeFileSync(path.join(root, file), typeof content === 'string' ? content : JSON.stringify(content));
    };
    return {root, write};
}

test('defaults select application browser suites and never tooling tests', t => {
    const f = workspace(t);
    f.write('src/tests/e2e/cypress/store.cy.ts', '');
    f.write('src/tests/e2e/playwright/admin.spec.ts', '');
    f.write('tests/shopware/tooling.spec.ts', '');
    assert.deepEqual(suites.resolve('cypress', {root: f.root}), ['src/tests/e2e/cypress/store.cy.ts']);
    assert.deepEqual(suites.resolve('playwright', {root: f.root}), ['src/tests/e2e/playwright/admin.spec.ts']);
});

test('coverage preparation reports the paths it searched when the suite is empty', t => {
    const {root} = workspace(t);
    const result = spawnSync(process.execPath, [path.join(repo, 'bin/coverage/prepare.cjs')], {
        cwd: root, encoding: 'utf8', env: {...process.env, MAGELENS_RUNNER: 'cypress'}
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'No cypress browser tests found. Searched: src/tests/e2e/cypress/**/*.cy.{js,ts}\n'
        + 'Add a spec at a matching path or update tests.cypress in coverage.config.json.\n');
});

test('coverage configuration rejects non-object JSON roots', t => {
    const f = workspace(t);
    for (const value of [null, [], true, 42, 'tests']) {
        f.write('coverage.config.json', JSON.stringify(value));
        assert.throws(() => suites.configuration(f.root), /must contain a JSON object/);
    }
});

test('configured suite paths replace defaults, include extensions and deduplicate', t => {
    const f = workspace(t);
    f.write('src/tests/e2e/playwright/default.spec.js', '');
    f.write('src/acceptance/shop.spec.ts', '');
    f.write('src/acceptance/custom-name.test.ts', '');
    f.write('src/custom/plugins/Example/tests/e2e/admin.spec.js', '');
    const config = {tests: {playwright: ['src/acceptance/**/*.spec.ts', 'src/acceptance/shop.spec.ts', 'src/acceptance/custom-name.test.ts', 'src/custom/plugins/*/tests/e2e/*.spec.js']}};
    assert.deepEqual(suites.resolve('playwright', {root: f.root, config}), [
        'src/acceptance/custom-name.test.ts', 'src/acceptance/shop.spec.ts', 'src/custom/plugins/Example/tests/e2e/admin.spec.js'
    ]);
});

test('invalid, empty, escaping and symlinked suite discovery fails explicitly', t => {
    const f = workspace(t);
    for (const patterns of [[], null, 'tests/*.js', ['../outside/*.spec.js'], ['/tmp/*.spec.js'], ['C:/tests/*.spec.js'], ['src/{broken.spec.js'], ['src/**/../*.spec.js']]) {
        assert.throws(() => suites.resolve('playwright', {root: f.root, config: {tests: {playwright: patterns}}}), /test|glob|pattern/i);
    }
    assert.throws(() => suites.resolve('cypress', {root: f.root}), /No cypress browser tests/);
    f.write('outside.spec.js', '');
    fs.mkdirSync(path.join(f.root, 'src/tests/e2e/playwright'), {recursive: true});
    fs.symlinkSync(path.join(f.root, 'outside.spec.js'), path.join(f.root, 'src/tests/e2e/playwright/link.spec.js'));
    assert.throws(() => suites.resolve('playwright', {root: f.root}), /Symlinked/);
});

function prepared(t, runner = 'playwright') {
    const f = workspace(t);
    for (const directory of ['bin', 'playwright', 'cypress', 'assets']) fs.cpSync(path.join(repo, directory), path.join(f.root, directory), {recursive: true});
    fs.symlinkSync(path.join(repo, 'node_modules'), path.join(f.root, 'node_modules'), 'dir');
    f.write('coverage.config.json', {vendorRoots: [], javascript: {requiredExecuted: []}});
    f.write('.runtime/shopware-project.json', {platform: 'shopware', roots: ['custom/plugins/Probe'], hooks: [], modules: []});
    f.write('src/tests/e2e/playwright/app.spec.js', '');
    f.write('src/tests/e2e/cypress/app.cy.js', '');
    f.write('src/composer.json', '{}');
    f.write('src/composer.lock', '{}');
    f.write('src/custom/plugins/Probe/src/Probe.php', '<?php function visited() { return 1; }');
    const source = "globalThis.probe = function(input) { if (input) return 1; return 0; }; probe(true);";
    f.write('src/custom/plugins/Probe/src/Resources/app/storefront/src/main.js', source);
    f.write('src/custom/plugins/Probe/src/Resources/app/storefront/src/lazy.ts', 'export function lazy(x: number): number { return x + 1; }');
    f.write('src/custom/plugins/Probe/src/Resources/app/administration/src/main.js', 'globalThis.adminProbe = 1;');
    f.write('src/custom/plugins/Probe/src/Resources/app/administration/src/component.vue', '<template><p>Ignored</p></template>');
    f.write('src/custom/plugins/Probe/tests/unit/fixture.php', '<?php throw new Exception("not runtime");');
    f.write('src/custom/plugins/Probe/src/Resources/public/administration/assets/generated.js', 'throw new Error("generated output is not source");');
    const env = {...process.env, MAGELENS_RUNNER: runner, CHROME_VERSION: '157.0.8103.78'};
    const execute = file => spawnSync(process.execPath, [file], {cwd: f.root, env, encoding: 'utf8'});
    const preparation = execute('bin/coverage/prepare.cjs');
    assert.equal(preparation.status, 0, preparation.stderr);
    const read = file => JSON.parse(fs.readFileSync(path.join(f.root, file), 'utf8'));
    return {...f, execute, read, source, runner};
}

test('preparation isolates originals, instruments source JS/TS and inventories unsupported components', t => {
    const f = prepared(t);
    const run = f.read('coverage/run.json');
    assert.deepEqual(run.collectors, {php: true, js: true, templates: false});
    assert.ok(!Object.keys(run.sources).some(file => file.includes('/tests/')));
    assert.ok(!Object.keys(run.sources).some(file => file.includes('/Resources/public/administration/')));
    const original = 'src/custom/plugins/Probe/src/Resources/app/storefront/src/main.js';
    assert.equal(fs.readFileSync(path.join(f.root, original), 'utf8'), f.source);
    const sandbox = {};
    vm.runInNewContext(fs.readFileSync(path.join(f.root, '.runtime/coverage-app', original.slice(4)), 'utf8'), sandbox);
    const coverage = sandbox.__coverage__[path.join(f.root, original)];
    assert.ok(Object.values(coverage.s).some(hits => hits > 0));
    assert.ok(Object.values(coverage.s).some(hits => hits === 0));
    assert.ok(f.read('.runtime/js-baseline.json')[path.join(f.root, original)].s);
    const scope = f.read('coverage/javascript-scope.json');
    assert.equal(scope.included.length, 3);
    assert.equal(scope.unsupported.length, 1);
    assert.ok(!fs.existsSync(path.join(f.root, 'coverage/template-manifest.json')));
    const filter = fs.readFileSync(path.join(f.root, '.runtime/php-scope.ini'), 'utf8').match(/pcov.exclude="~(.*)~"/)[1];
    const excluded = new RegExp(filter);
    assert.equal(excluded.test('/var/www/html/custom/plugins/Probe/src/Probe.php'), false, 'The /var runtime prefix must not exclude eligible PHP');
    assert.equal(excluded.test('/var/www/html/custom/plugins/Probe/tests/fixture.php'), true);
    assert.equal(excluded.test('/var/www/html/var/cache/container.php'), true);
    assert.equal(excluded.test('/var/www/html/vendor/unselected/package/Code.php'), true);
});

for (const runner of ['cypress', 'playwright']) test(`${runner}: report succeeds without template artifacts and rejects incomplete evidence`, t => {
    const f = prepared(t, runner);
    const run = f.read('coverage/run.json');
    f.write('coverage/php/index.html', '<html>PHP</html>');
    f.write('coverage/php/coverage-summary.json', {run: run.id, total: 2, covered: 1, percent: 50, requests: [{run: run.id}]});
    f.write(`coverage/${runner}-results.json`, {run: run.id, totalTests: 1, totalPassed: 1, totalFailed: 0,
        totalPending: 0, totalSkipped: 0, specs: runner === 'cypress' ? run.specs.map(file => ({path: file})) : run.specs,
        browser: {name: 'chrome-for-testing', version: run.browser.version}});
    assert.equal(f.execute('bin/report-browser.cjs').status, 0);
    const report = f.execute('bin/finalize.cjs');
    assert.equal(report.status, 0, report.stderr);
    assert.deepEqual(Object.keys(f.read('coverage/summary.json').metrics), ['php', 'js']);
    assert.match(fs.readFileSync(path.join(f.root, 'coverage/index.html'), 'utf8'), /Templates and inline scripts: not collected/);
    assert.match(fs.readFileSync(path.join(f.root, 'coverage/index.html'), 'utf8'), /JavaScript measurement is partial/);
    assert.ok(!fs.existsSync(path.join(f.root, 'coverage/badges/templates.svg')));
    const results = f.read(`coverage/${runner}-results.json`);
    for (const change of [{totalSkipped: 1}, {specs: []}, {browser: {name: 'chromium', version: run.browser.version}}, {run: 'stale'}]) {
        f.write(`coverage/${runner}-results.json`, {...results, ...change});
        assert.notEqual(f.execute('bin/finalize.cjs').status, 0);
    }
    f.write(`coverage/${runner}-results.json`, results);
    const originalPhp = fs.readFileSync(path.join(f.root, 'src/custom/plugins/Probe/src/Probe.php'), 'utf8');
    f.write('src/custom/plugins/Probe/src/Probe.php', '<?php function changed() { return 2; }');
    assert.match(f.execute('bin/finalize.cjs').stderr, /Original sources changed/);
    f.write('src/custom/plugins/Probe/src/Probe.php', originalPhp);
    f.write('src/composer.lock', {packages: []});
    assert.match(f.execute('bin/finalize.cjs').stderr, /Original deployment inputs changed/);
});

test('missing PHP scope fails before replacing previous evidence', t => {
    const f = prepared(t);
    const run = f.read('coverage/run.json');
    fs.rmSync(path.join(f.root, 'src/custom/plugins/Probe/src/Probe.php'));
    assert.match(f.execute('bin/coverage/prepare.cjs').stderr, /No eligible PHP application source/);
    assert.equal(f.read('coverage/run.json').id, run.id);
});
