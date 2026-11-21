// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

// TO DO [SW-AUDIT-013]: Retain Magento Marketplace credential validation for inherited cases.
// Select credentials per platform; Shopware setup must not require repo.magento.com auth.

const fs = require('fs');
if (!process.env.COMPOSER_AUTH) throw new Error('INCOMPLETE: missing COMPOSER_AUTH');
let auth;
try { auth = JSON.parse(process.env.COMPOSER_AUTH); }
catch { throw new Error('Invalid COMPOSER_AUTH JSON'); }
for (const value of Object.values(auth['http-basic']?.['repo.magento.com'] || {})) {
  if (typeof value === 'string') console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}
if (!auth['http-basic']?.['repo.magento.com']?.username || !auth['http-basic']['repo.magento.com'].password) {
  throw new Error('INCOMPLETE: Marketplace credentials absent');
}
fs.writeFileSync(process.env.RUNNER_TEMP + '/auth.json', JSON.stringify({'http-basic': {'repo.magento.com': auth['http-basic']['repo.magento.com']}}), {mode: 0o600});
