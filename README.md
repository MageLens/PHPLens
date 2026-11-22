<!--
Copyright (c)  MageLens
SPDX-License-Identifier: Elastic-2.0
License: see LICENSE in the repository root.
-->

# Shopware local development

Run `./install.sh` from this checkout to create a Storefront and Administration using the latest stable Shopware 6.7 release. Docker with Compose 2.24.4 or newer and Bash are required. PHP, Shopware CLI, Composer and Node run in the application container.

```bash
./install.sh shopware.test
```

To install an exact Shopware 6.7 release in a fresh checkout, pass `--version`.

```bash
./install.sh shopware.test --version 6.7.16.1
```

If `src/composer.lock` already exists, the installer uses its Shopware version. Any supplied `--version` must match the lockfile.

Open `https://shopware.test/` or `https://shopware.test/admin`. The fresh-install administrator is `admin` with password `shopware`. Restored shops keep their own users. The installer binds HTTP and HTTPS to loopback, adds the selected hostname to the hosts file, and trusts the checkout's Caddy CA on macOS or Debian/Ubuntu. Keep the private CA files under `.runtime/caddy/` local. Under WSL these host steps apply to the Linux distribution.

For automation, use `--container-only` to perform all HTTPS checks on the Compose network. To run beside Magento or another shop, select a different project, domain and free ports. The installer saves those settings for daily commands.

```bash
APPLICATION_PORT=18080 APPLICATION_HTTPS_PORT=18443 RUNNER_VIEW_PORT=16080 \
  ./install.sh --container-only --project-name client-shop client-shop.test
```

## Work on the shop

Shopware lives in `src/`. Put plugins and themes under `src/custom/plugins/`, and apps under `src/custom/apps/`. Version application source and Composer lockfiles. Keep local environment files, keys, vendor packages, caches, uploads and compiled assets out of Git.

| Command | Purpose |
| --- | --- |
| `./bin/console plugin:refresh` | Discover Shopware plugins |
| `./bin/shopware-cli --version` | Run the pinned Shopware CLI |
| `./bin/composer install` | Install the application's locked dependencies |
| `./bin/application-compose logs app` | Inspect web and PHP logs |
| `./bin/application-compose stop` | Stop this shop and keep its database |
| `./bin/start` | Start the saved project |
| `./install.sh` | Recheck the installation and recompile assets |

## Use an existing project

Copy a complete Shopware 6.7 project into `src/` before installing. Include its `composer.json`, `composer.lock`, `bin/console`, `public/index.php`, project configuration, extensions and any required media and application secrets. The lock must include `shopware/core`, `shopware/storefront` and `shopware/administration`. Supply private package credentials via `COMPOSER_AUTH`. The effective database and application URL for setup and web requests come from this checkout's Compose services.

An empty local database receives the standard Shopware installation. To use a backup, start only the project database and restore the dump into its empty schema **before** installation. Use the same project name for both commands.

```bash
COMPOSE_PROJECT_NAME=client-shop ./bin/application-compose up -d --wait db
COMPOSE_PROJECT_NAME=client-shop ./bin/application-compose exec -T db \
  mariadb -ushopware -pshopware shopware < /path/to/local-shop.sql
./install.sh --project-name client-shop client-shop.test
```

For a restored Storefront the installer adds a local URL while preserving its existing domains. If it lists multiple candidates, repeat the command with `--domain-id ID` to select the source language, currency and sales channel. The database must match the project's locked core migrations. For an interrupted database initialization, restore a complete backup or start a separate checkout with a new project and empty volume. After an interrupted download, reuse the same checkout and command. If a hard interruption left `.runtime/workflow.lock`, check for a running installer and setup container before removing that empty lock directory.

Container and tooling versions are pinned in `dependencies.yaml`. The Shopware coverage path is under qualification; release readiness requires the Shopware coverage workflow to pass for both runners.

## Run browser tests with coverage

Installation provisions Cypress by default. Select Playwright with `./install.sh --runner=playwright`; reinstalling preserves the saved runner. After upgrading tooling, rerun installation before collecting coverage.

```bash
./bin/run-coverage
./bin/run-coverage --start
```

The command runs all configured browser scenarios, collecting HTTP PHP coverage and original-source JavaScript/TypeScript coverage. It builds a disposable application copy and restores the normal application afterward. Twig, inline scripts, Vue/JSX component sources, CLI commands and background workers are not measured. Unsupported component sources are listed in `coverage/javascript-scope.json`.

Application tests default to `src/tests/e2e/cypress/**/*.cy.{js,ts}` and `src/tests/e2e/playwright/**/*.spec.{js,ts}`. Repository `tests/` contains PHPLens tooling checks. Configure alternative project or extension suites in `coverage.config.json`; each runner entry replaces its default. Paths are relative to this checkout and must remain inside it.

Create at least one application spec before running coverage. For a storefront smoke test on a stock Shopware install, visit `/`, check that the main content is visible, and include `vendor/shopware/storefront/Controller` in `vendorRoots` to measure the PHP that handled the request.

```json
{
  "tests": {
    "cypress": ["src/tests/e2e/cypress/**/*.cy.{js,ts}"],
    "playwright": [
      "src/tests/e2e/playwright/**/*.spec.{js,ts}",
      "src/custom/plugins/*/tests/e2e/playwright/**/*.spec.{js,ts}"
    ]
  }
}
```

Playwright scenarios under the default directory import `test` and `expect` from `../../../../playwright/support.cjs`. Existing custom test fixtures can be wrapped with the exported `withCoverage(baseTest)`. Cypress scenarios use the configured root support file automatically. Retain application-specific helpers when integrating an existing suite.

Coverage includes project PHP and active local extensions; third-party source requires `vendorRoots`. JavaScript instrumentation covers standalone source files under extension `Resources/app/storefront/src` and `Resources/app/administration/src`, plus project `assets/`. Eligible files that never execute remain uncovered. Configure exclusions and required JavaScript execution through the existing `javascript` settings in `coverage.config.json`.

Open `https://<domain>:6080/` to watch the browser; set `RUNNER_VIEW_PORT` to choose a different free port. Reports are available at `https://<domain>/coverage/index.html` after successful collection, source verification and cleanup, and locally in `coverage/`. Nondefault HTTPS ports are included in the printed URL. Failed, skipped or interrupted suites do not publish a success report.

`--refresh-cache` clears Shopware caches in the disposable application. `--refresh-assets` forces dependency installation during its asset builds. `--restart-php` restarts the disposable application before collection. Use `./bin/runner COMMAND` to work in the selected browser container.

Optional fixture hooks live in `src/tests/coverage/hooks.php` or an active extension’s `tests/coverage/hooks.php`. Hooks receive `before`, `prepare` or `cleanup`; `prepare` writes one JSON value to stdout, optionally containing `warmupPaths`. Other diagnostics belong on stderr. Hooks and browser scenarios operate on this checkout’s local database. Cleanup runs after failures and interruptions; do not remove the workflow lock while a run remains active.
