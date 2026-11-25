// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const fs = require('node:fs');
const path = require('node:path');
const {createHash, randomBytes} = require('node:crypto');
const {createInstrumenter} = require('istanbul-lib-instrument');
const suites = require('../test-suites.cjs');
const adapter = require('../platforms/shopware.cjs');
const {createJavascriptScope} = require('../javascript-scope.cjs');

function inventory(roots, source = 'src') {
    const output = {};
    const testDirectories = suites.directories();
    function visit(relative) {
        if (adapter.excludedSource(relative + '/')) return;
        if (testDirectories.some(directory => `src/${relative}` === directory || `src/${relative}`.startsWith(directory + '/'))) return;
        const file = path.join(source, relative);
        const stat = fs.lstatSync(file);
        if (stat.isSymbolicLink()) throw new Error(`Symlinked source is unsupported: ${file}`);
        if (stat.isDirectory()) {
            for (const entry of fs.readdirSync(file).sort()) visit(`${relative}/${entry}`);
        } else if (stat.isFile()) output[`src/${relative}`] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
    for (const root of roots) visit(root);
    return output;
}

function mirror(source, target) {
    fs.rmSync(target, {recursive: true, force: true});
    const base = fs.realpathSync(source);
    fs.cpSync(source, target, {recursive: true, verbatimSymlinks: true, filter: file => {
        const relative = path.relative(source, file).replaceAll(path.sep, '/');
        if (/(?:^|\/)(?:node_modules|\.git)(?:\/|$)/.test(relative)
            || /^(?:var|public\/(?:bundles|theme))(?:\/|$)/.test(relative)) return false;
        if (fs.lstatSync(file).isSymbolicLink()) {
            const real = fs.realpathSync(file);
            if (!real.startsWith(base + path.sep) || path.isAbsolute(fs.readlinkSync(file))) {
                throw new Error(`Cannot isolate application symlink: ${relative}`);
            }
        }
        return true;
    }});
    fs.mkdirSync(`${target}/var`, {recursive: true});
    fs.mkdirSync(`${target}/public`, {recursive: true});
}

function deploymentSources(source = 'src') {
    const result = {};
    const add = relative => {
        const file = path.join(source, relative);
        if (!fs.existsSync(file)) return;
        if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Symlinked deployment input: ${relative}`);
        if (fs.statSync(file).isDirectory()) {
            for (const entry of fs.readdirSync(file).sort()) add(`${relative}/${entry}`);
        } else result[relative] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    };
    for (const input of ['composer.json', 'composer.lock', 'config', '.env', '.env.local', '.env.local.php']) add(input);
    return result;
}

function prepare() {
    const runner = process.env.MAGELENS_RUNNER || 'cypress';
    const specs = suites.resolve(runner);
    const config = suites.configuration();
    const metadata = adapter.project(JSON.parse(fs.readFileSync('.runtime/shopware-project.json')));
    const sources = inventory(metadata.roots);
    if (!Object.keys(sources).some(file => file.endsWith('.php'))) {
        throw new Error('No eligible PHP application source. Add local application code or configure vendorRoots in coverage.config.json.');
    }
    // Scope and source validation must finish before replacing previous evidence.
    const browserFiles = Object.keys(sources).filter(file => adapter.javascript(file.slice(4)));
    const scope = createJavascriptScope(browserFiles, config.javascript || {});
    mirror('src', '.runtime/coverage-app');
    const baseline = {};
    for (const entry of scope.included) {
        const instrumenter = createInstrumenter({compact: false, preserveComments: true, esModules: true,
            parserPlugins: /\.[cm]?ts$/.test(entry.path) ? ['typescript'] : [],
            coverageGlobalScope: 'globalThis', coverageGlobalScopeFunc: false});
        const original = `src/${entry.path}`;
        const result = instrumenter.instrumentSync(fs.readFileSync(original, 'utf8'), path.resolve(original));
        fs.writeFileSync(`.runtime/coverage-app/${entry.path}`, result);
        baseline[path.resolve(original)] = instrumenter.lastFileCoverage();
    }
    const unsupported = Object.keys(sources).filter(file => /\.(?:vue|jsx|tsx)$/.test(file)
        && /\/Resources\/app\/(?:storefront|administration)\/src\//.test(file))
        .map(file => ({path: file.slice(4), reason: 'Component/JSX source instrumentation is not supported; compiled template code is not measured.'}));
    for (const directory of ['coverage', '.nyc_output', 'cypress/screenshots', 'cypress/videos']) fs.rmSync(directory, {recursive: true, force: true});
    const run = {id: randomBytes(16).toString('hex'), platform: 'shopware', runner, startedAt: new Date().toISOString(),
        collectors: {php: true, js: true, templates: false}, roots: metadata.roots, sources, specs,
        deploymentSources: deploymentSources(),
        configHash: createHash('sha256').update(JSON.stringify(config)).digest('hex'),
        browser: {name: 'chrome-for-testing', version: process.env.CHROME_VERSION}};
    fs.mkdirSync(`coverage/raw/php/${run.id}`, {recursive: true});
    fs.mkdirSync('.runtime/pcov', {recursive: true});
    fs.writeFileSync('coverage/run.json', JSON.stringify(run, null, 2));
    fs.writeFileSync('.runtime/js-baseline.json', JSON.stringify(baseline));
    fs.writeFileSync('coverage/javascript-scope.json', JSON.stringify({run: run.id, ...scope, unsupported}, null, 2));
    fs.writeFileSync('coverage/project-fixtures.json', '{}');
    fs.writeFileSync('.runtime/project.json', JSON.stringify(metadata, null, 2));
    const escape = value => value.replace(/[.*+?^${}()|[\]\\~]/g, '\\$&');
    const allowed = metadata.roots.map(root => escape(`/var/www/html/${root}/`)).join('|') || '(?!)';
    fs.writeFileSync('.runtime/php-scope.ini', `pcov.exclude="~^(?!(?:${allowed}))|/(?:tests?|Test|Tests|node_modules)/~"\n`);
    console.log(`Prepared ${runner} run ${run.id}: ${specs.length} specs, ${scope.included.length} JavaScript/TypeScript files. Templates are not collected.`);
    if (process.env.APPLICATION_DOMAIN) {
        console.log(`Watch tests at https://${process.env.APPLICATION_DOMAIN}:${process.env.RUNNER_VIEW_PORT || process.env.CYPRESS_VIEW_PORT || 6080}/`);
    }
}

if (require.main === module) {
    try {
        prepare();
    } catch (error) {
        if (!(error instanceof suites.NoBrowserTestsError)) throw error;
        console.error(error.message);
        process.exitCode = 1;
    }
}
module.exports = {inventory, mirror, prepare, deploymentSources};
