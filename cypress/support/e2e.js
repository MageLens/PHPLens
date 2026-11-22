// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

// Template collection is retained for inherited Magento runs and disabled for Shopware.

require('./javascript-coverage');
if (Cypress.expose('platform') !== 'shopware') {
    const {registerTemplateCoverage} = require('@vitaliiboiko/magento-template-coverage/cypress');
    registerTemplateCoverage({outputDir: 'coverage/raw/templates'});
}

const {disablePageTransitions} = require('../../bin/browser-navigation.cjs');
Cypress.on('window:before:load', disablePageTransitions);

beforeEach(() => {
    const run = Cypress.expose('coverageRun');
    expect(run, 'current PHP collection token').to.match(/^[a-f0-9]{32}$/);
    // Avoid intercepting multipart bodies: header mutation can corrupt binary uploads.
    cy.setCookie('application_coverage', run, {
        domain: new URL(Cypress.config('baseUrl')).hostname, path: '/', sameSite: 'lax', httpOnly: true
    });
});
