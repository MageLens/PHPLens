// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const fs = require('node:fs');
const path = require('node:path');

const excluded = /(?:^|\/)(?:tests?|Test|Tests|node_modules|\.git|dist|build|coverage|var)\//;
function excludedSource(file) {
    return excluded.test(file) || /(?:^|\/)Resources\/public\/(?:administration|storefront)(?:\/|$)/.test(file)
        || /\.(?:cy|spec|test)\.[cm]?[jt]sx?$/.test(file);
}

function project(metadata, source = 'src') {
    if (metadata.platform !== 'shopware' || !Array.isArray(metadata.roots)) throw new Error('Missing Shopware project metadata');
    const roots = [...new Set(metadata.roots)].sort();
    for (const root of roots) {
        if (typeof root !== 'string' || !/^(?:src|assets|custom\/(?:plugins|static-plugins|apps)\/[^/]+|vendor\/[^/]+\/[^/]+)(?:\/[^/]+)*$/.test(root)
            || root.split('/').some(part => part === '.' || part === '..')
            || !fs.statSync(`${source}/${root}`).isDirectory()
            || fs.realpathSync(`${source}/${root}`) !== path.resolve(source, root)) throw new Error(`Invalid Shopware source root: ${root}`);
    }
    return {...metadata, roots: roots.filter(root => !roots.some(other => other !== root && root.startsWith(other + '/')))};
}

function javascript(file) {
    return !excludedSource(file) && !/\.d\.[cm]?ts$/.test(file) && /\.[cm]?[jt]s$/.test(file)
        && (file.startsWith('assets/') || /\/Resources\/app\/(?:storefront|administration)\/src\//.test('/' + file));
}

module.exports = {project, excludedSource, javascript};
