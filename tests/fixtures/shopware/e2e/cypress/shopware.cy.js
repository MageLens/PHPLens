// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

describe('Shopware coverage', () => {
    it('Storefront executes a lazy module', () => {
        cy.visit('/coverage-probe');
        cy.get('#coverage-probe-button').click();
        cy.get('#coverage-probe-result').should('have.text', 'Lazy coverage collected');
    });
    it('Administration authenticates and executes extension JavaScript', () => {
        cy.visit('/admin');
        cy.get('input[name="sw-field--username"]').type('admin');
        cy.get('input[name="sw-field--password"]').type('shopware');
        cy.intercept('POST', '**/api/oauth/token').as('authentication');
        cy.get('button[type="submit"]').click();
        cy.wait('@authentication').its('response.statusCode').should('equal', 200);
        cy.get('.sw-admin-menu').first().should('be.visible');
        cy.visit('/admin#/coverage/probe/index');
        cy.get('#coverage-probe-admin').should('have.text', 'Coverage probe ready');
    });
});
