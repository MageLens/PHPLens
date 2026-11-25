// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const {test, expect} = require('../../../../playwright/support.cjs');

test('Storefront executes a lazy module', async ({page}) => {
    await page.goto('/coverage-probe');
    await page.locator('#coverage-probe-button').click();
    await expect(page.locator('#coverage-probe-result')).toHaveText('Lazy coverage collected');
});

test('Administration authenticates and executes extension JavaScript', async ({page}) => {
    await page.goto('/admin');
    await page.locator('input[name="sw-field--username"]').fill('admin');
    await page.locator('input[name="sw-field--password"]').fill('shopware');
    const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/oauth/token' && response.request().method() === 'POST');
    await page.locator('button[type="submit"]').click();
    expect((await authenticated).status()).toBe(200);
    await expect(page.locator('.sw-admin-menu').first()).toBeVisible();
    await page.goto('/admin#/coverage/probe/index');
    await expect(page.locator('#coverage-probe-admin')).toHaveText('Coverage probe ready');
});
