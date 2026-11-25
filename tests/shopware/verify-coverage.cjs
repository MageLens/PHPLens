// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = process.argv[2] || 'coverage';
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
const run = read('run.json');
const summary = read('summary.json');
assert.equal(summary.run, run.id);
assert.equal(fs.readFileSync(path.join(directory, '.published'), 'utf8').trim(), run.id);
assert.deepEqual(summary.collectors, {php: true, js: true, templates: false});
const php = read('php/coverage-summary.json');
assert.equal(php.run, run.id);
assert.ok(php.requests.length > 0);
assert.ok(php.requests.every(request => request.run === run.id && !/unvisited|warmup-only/.test(request.uri)));
const lines = read('php/line-coverage.json');
const controller = Object.entries(lines).find(([file]) => file.endsWith('/Controller/ProbeController.php'))?.[1];
assert.ok(controller, 'Controlled PHP controller missing');
assert.ok(Object.values(controller).some(hit => hit === 1), 'No PHP execution collected');
assert.ok(Object.values(controller).some(hit => hit === 0), 'Unvisited PHP path must remain uncovered');
const controllerSource = fs.readFileSync(path.resolve(directory, '../src/custom/plugins/CoverageProbe/src/Controller/ProbeController.php'), 'utf8').split('\n');
for (const marker of ["return new Response('This endpoint must remain uncovered')", "['warmupOnly' => true]"]) {
    const line = controllerSource.findIndex(source => source.includes(marker)) + 1;
    assert.ok(line > 0);
    assert.equal(controller[line], 0, `Unvisited/warm-up PHP leaked into line ${line}`);
}
const js = read('js/coverage-final.json');
const lookup = suffix => {
    const entry = Object.entries(js).find(([file]) => file.endsWith(suffix));
    assert.ok(entry, `Missing original source: ${suffix}`);
    return entry[1];
};
for (const suffix of ['/storefront/src/main.js', '/storefront/src/lazy.ts', '/administration/src/main.js']) {
    assert.ok(Object.values(lookup(suffix).s).some(hit => hit > 0), `No browser execution for ${suffix}`);
}
assert.ok(Object.values(lookup('/storefront/src/lazy.ts').s).some(hit => hit === 0));
assert.ok(Object.values(lookup('/storefront/src/unvisited.js').s).every(hit => hit === 0));
assert.ok(Object.values(lookup('/storefront/src/warmup-only.js').s).every(hit => hit === 0), 'Warm-up JavaScript leaked into collection');
const warmup = read(run.runner === 'cypress' ? 'warmup-diagnostics.json' : 'warmup-results.json');
assert.ok(warmup.pages.some(page => page.javascriptFiles.some(file => file.endsWith('/storefront/src/warmup-only.js'))), 'The warm-up-only module did not execute during warm-up');
assert.ok(!fs.existsSync(path.join(directory, 'templates')));
assert.ok(!fs.existsSync(path.join(directory, '.active-run')));

// Compare semantic outcomes across runner/container paths, not hit frequencies.
const binary = counters => Object.fromEntries(Object.entries(counters).map(([key, value]) => [key,
    Array.isArray(value) ? value.map(count => Number(count > 0)) : Number(value > 0)]));
const relative = file => {
    const normalized = file.replaceAll('\\', '/');
    for (const prefix of ['/workspace/src/', '/source/', '/var/www/html/']) {
        if (normalized.startsWith(prefix)) return normalized.slice(prefix.length);
    }
    return normalized;
};
const equivalence = {
    php: Object.fromEntries(Object.entries(lines).map(([file, values]) => [relative(file), values]).sort()),
    js: Object.fromEntries(Object.entries(js).map(([file, data]) => [relative(file), {
        statementMap: data.statementMap, fnMap: data.fnMap, branchMap: data.branchMap,
        s: binary(data.s), f: binary(data.f), b: binary(data.b),
    }]).sort()),
    sources: Object.fromEntries(Object.entries(run.sources).map(([file, hash]) => [file.slice(4), hash]).sort()),
};
fs.writeFileSync(path.join(directory, 'equivalence.json'), JSON.stringify(equivalence, null, 2));
console.log(`${run.runner}: original-source PHP, Storefront/Admin JavaScript, lazy chunks and zero-hit files verified.`);
