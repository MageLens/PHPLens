// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.argv[2] || 'shopware-reports';
for (const installation of ['fresh', 'adopted', 'restored']) {
    const read = runner => JSON.parse(fs.readFileSync(path.join(root, runner, installation, 'equivalence.json')));
    assert.deepEqual(read('cypress'), read('playwright'), `PHP/JavaScript coverage differs between runners: ${installation}`);
}
console.log('Complete PHP/JavaScript source inventories and covered/uncovered outcomes match across both runners.');
