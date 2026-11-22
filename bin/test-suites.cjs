// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const fs = require('node:fs');
const path = require('node:path');

const defaults = {
    cypress: ['src/tests/e2e/cypress/**/*.cy.{js,ts}'],
    playwright: ['src/tests/e2e/playwright/**/*.spec.{js,ts}']
};

function configuration(root = process.cwd()) {
    const file = path.join(root, 'coverage.config.json');
    const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('coverage.config.json must contain a JSON object');
    return config;
}

function patterns(runner, config = configuration()) {
    if (!Object.hasOwn(defaults, runner)) throw new Error(`Unknown browser runner: ${runner}`);
    if (config.tests !== undefined && (!config.tests || typeof config.tests !== 'object' || Array.isArray(config.tests))) {
        throw new Error('coverage.config.json tests must be an object keyed by runner');
    }
    for (const key of Object.keys(config.tests || {})) {
        if (!Object.hasOwn(defaults, key)) throw new Error(`Unknown test runner configuration: ${key}`);
    }
    const selected = config.tests && Object.hasOwn(config.tests, runner) ? config.tests[runner] : defaults[runner];
    if (!Array.isArray(selected) || !selected.length) throw new Error(`tests.${runner} must be a nonempty array of glob patterns`);
    for (const pattern of selected) {
        if (typeof pattern !== 'string' || !pattern || pattern.startsWith('/') || /[\\\x00-\x1f:!]/.test(pattern)
            || pattern.split('/').some(part => part === '..' || part === '.' || part === '')
            || /(?:^|[/{,])\.\.(?:[/},]|$)/.test(pattern)) {
            throw new Error(`Invalid test pattern in tests.${runner}: ${JSON.stringify(pattern)}. Use checkout-relative paths.`);
        }
        // Refuse malformed delimiters rather than silently discovering no tests.
        const stack = [];
        for (const character of pattern) {
            if ('[{('.includes(character)) stack.push(character);
            if (']})'.includes(character) && stack.pop() !== ({']': '[', '}': '{', ')': '('})[character]) {
                throw new Error(`Invalid test glob: ${pattern}`);
            }
        }
        if (stack.length) throw new Error(`Invalid test glob: ${pattern}`);
    }
    return [...new Set(selected)];
}

function resolve(runner, {root = process.cwd(), config = configuration(root)} = {}) {
    const base = fs.realpathSync(root);
    const matches = new Set();
    for (const pattern of patterns(runner, config)) {
        for (const file of fs.globSync(pattern, {cwd: root, exclude: ['**/node_modules/**', '.runtime/**']})) {
            const absolute = path.resolve(root, file);
            const real = fs.realpathSync(absolute);
            if (!real.startsWith(base + path.sep) || real !== path.join(base, file)) {
                throw new Error(`Symlinked or escaping browser spec is unsupported: ${file}`);
            }
            if (!fs.statSync(absolute).isFile() || !/\.[cm]?[jt]sx?$/.test(file)) {
                throw new Error(`Test pattern matched an unsupported browser test file: ${file}`);
            }
            matches.add(file.replaceAll(path.sep, '/'));
        }
    }
    if (!matches.size) throw new Error(`No ${runner} browser tests found. Configure tests.${runner} in coverage.config.json.`);
    return [...matches].sort();
}

function directories(config = configuration(), root = process.cwd()) {
    const result = new Set();
    for (const runner of Object.keys(defaults)) {
        for (const pattern of patterns(runner, config)) {
            const parts = pattern.split('/');
            const recursive = parts.indexOf('**');
            const directory = parts.slice(0, recursive < 0 ? -1 : recursive).join('/');
            // A broad src/**/*.spec pattern must not exclude all application source.
            if (!directory || directory === 'src') continue;
            for (const file of fs.globSync(directory, {cwd: root})) {
                if (fs.statSync(path.join(root, file)).isDirectory()) result.add(file.replaceAll(path.sep, '/'));
            }
        }
    }
    return [...result].sort();
}

module.exports = {configuration, patterns, resolve, directories};
