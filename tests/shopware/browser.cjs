// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');

async function main() {
    const origin = process.env.SHOPWARE_ORIGIN;
    const browser = await chromium.launch({
        executablePath: process.env.CHROME_BIN,
        args: process.env.LOCAL_BROWSER_HOST
            ? [`--host-resolver-rules=MAP ${new URL(origin).hostname} ${process.env.LOCAL_BROWSER_HOST}`] : [],
    });
    try {
        assert.equal(browser.version(), process.env.CHROME_VERSION);
        console.log(`Google Chrome for Testing ${browser.version()}`);
        // The installer separately verifies the project's local CA. CI uses container-only HTTPS.
        const page = await browser.newPage({ignoreHTTPSErrors: true});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        assert.equal((await page.goto(origin)).status(), 200);
        await page.locator('main').waitFor();
        await page.goto(origin + '/admin');
        await page.locator('input[name="sw-field--username"]').fill('admin');
        await page.locator('input[name="sw-field--password"]').fill('shopware');
        const authenticated = page.waitForResponse(response =>
            new URL(response.url()).pathname === '/api/oauth/token' && response.request().method() === 'POST');
        await page.locator('button[type="submit"]').click();
        assert.equal((await authenticated).status(), 200);
        await page.waitForURL(url => url.hash.includes('/sw/dashboard/'), {timeout: 60000});
        await page.locator('.sw-admin-menu').first().waitFor();
        assert.deepEqual(errors, []);
        console.log('Storefront rendered and administrator reached the dashboard.');
    } finally {
        await browser.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
