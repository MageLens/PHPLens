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
APPLICATION_PORT=18080 APPLICATION_HTTPS_PORT=18443 \
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

Container and tooling versions are pinned in `dependencies.yaml`. The initial milestone covers installation and daily application commands. Shopware-specific browser runners and coverage collection are planned separately.
