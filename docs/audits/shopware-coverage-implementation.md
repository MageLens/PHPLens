<!--
Copyright (c)  MageLens
SPDX-License-Identifier: Elastic-2.0
License: see LICENSE in the repository root.
-->

# Shopware browser coverage implementation

Status: implementation and focused local verification complete; GitHub Actions qualification remains incomplete. This report complements the historical [transition audit](shopware-transition.md).

## Implemented behavior

- The installer provisions the selected Cypress or Playwright runner, a pinned Chrome build and the Shopware PHP coverage image. Runner selection and viewer ports survive reinstall/startup. Coverage compatibility is recorded separately from the installed Shopware version.
- `bin/run-coverage` discovers active local source, validates configured browser suites, builds instrumented disposable application copies, warms pages without collecting, runs the complete selected suite and generates PHP/JavaScript reports. Cleanup restores native theme asset seeds and the normal application, then checks its HTTPS readiness before publishing `/coverage/index.html`.
- `coverage.config.json` accepts runner-specific `tests.cypress` and `tests.playwright` patterns. Application defaults are under `src/tests/e2e/`; extension suites are opt-in. Test/support code is excluded from application coverage. Repository tooling checks remain separate.
- Source hashes, deployment files, local extension/theme state, collector filters, build identity, test completeness, runner identity and current-run evidence are checked. Original PHP bytes and line numbers are preserved. Unvisited eligible PHP and JavaScript files remain in the denominator.
- Shopware native builds consume instrumented JavaScript/TypeScript copies. Twig, inline scripts and Vue/JSX component sources are not instrumented. Unsupported component sources appear in the scope inventory and report warning. CLI/background execution is outside collection.
- The new Shopware coverage workflow covers both runners, fresh/adopted/restored projects, deliberate browser failure, publication guards, repeat runs with a source edit, desktop/browser recovery and retained Cypress regressions. It compares full source inventories and covered/uncovered PHP/JavaScript outcomes, normalizing paths and repeated hit counts. Artifacts are isolated by workflow attempt.

## Verification performed

- `npm run test:shopware`: **56 passed**, no failures or skips. Covers installer selection/ports, configured discovery, source isolation, JavaScript/TypeScript counters, PCOV filter scope, optional template reporting, evidence validation and workflow failure/recovery paths.
- `node --test tests/finalize.test.cjs tests/report-browser.test.cjs tests/javascript-scope.test.cjs tests/project.test.cjs`: **19 passed**, no failures or skips.
- PHP lint executed inside the Shopware coverage image for the Shopware helpers, controlled plugin and report-route verifier. Bash/Node syntax checks and copyright validation passed. The Shopware workflows passed Actionlint; Caddy accepted the report/viewer configuration.
- The PHP coverage, Cypress and Playwright runner images built successfully. The Cypress image retains the pinned source build, patches and upstream build checks. The PCOV source archive is checksum-pinned and the extension/native export API is checked during image construction.
- Focused local Shopware 6.7.16.1/Chrome for Testing 157.0.8103.78 verification passed both Storefront lazy-module and authenticated Administration extension journeys through **each runner (2/2 each)**. PHP and original-source JavaScript execution, unvisited code, dedicated warm-up-only PHP/JavaScript exclusion, report integrity and public HTTPS publication were verified. Complete source inventories, PHP lines and JavaScript statement/function/branch maps and covered/uncovered outcomes matched between Cypress and Playwright; comparison used binary outcomes rather than percentages or hit frequency. Both runs preserved the original theme-seed fingerprint, and cleanup fetched the restored Storefront scripts/styles and Administration assets successfully. This is focused local evidence, not full CI qualification.
- `npm run test:integration`: **320 tests, 236 passed, 78 failed, 6 skipped**. Failures remain in inherited Magento bootstrap/dependency/image/orchestration expectations and the missing legacy Blog fixture. These match the migration blockers recorded by the transition audit; the complete integration suite is not passing.

Local application/browser work uses the isolated `phplens-coverage-dev` project under `.runtime/coverage-development`, separate ports and its own database. Application, runner and database resources are bounded; existing application containers, databases, host DNS and trust stores are not changed. Logs are under `.runtime/`; retained coverage evidence is under `.runtime/verification/shopware/`. Generated evidence is excluded from Git. The disposable application containers, database and dependency volumes are removed after verification.

## Remaining qualification

The final candidate still requires the complete Shopware coverage workflow in GitHub Actions, including both runners and all installation cases, plus the repository's inherited release gates. No remote workflow was dispatched from this session: there is no submitted candidate or GitHub Actions connector/CLI available. No merge or release was performed. Release readiness remains blocked until the required checks complete successfully.
