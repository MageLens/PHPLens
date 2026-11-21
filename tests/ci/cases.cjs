// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

// TO DO [SW-AUDIT-013]: Retain the nine-case legacy qualification contract. Add a separately
// qualified platform profile rather than relabeling Magento cases as Shopware.

const linux = ['magento', 'mageos'].flatMap(platform => ['luma', 'hyva'].flatMap(theme =>
    ['cypress', 'playwright'].map(runner => ({os: 'ubuntu-latest', platform, theme, runner}))));
const cases = [...linux,
    {os: 'windows-latest', platform: 'mageos', theme: 'luma', runner: 'cypress'}
].map(entry => ({...entry, id: `${entry.os}-${entry.platform}-${entry.theme}-${entry.runner}`}));
module.exports = {cases};
