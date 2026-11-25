#!/usr/bin/env bash
# Copyright (c)  MageLens
# SPDX-License-Identifier: Elastic-2.0
# License: see LICENSE in the repository root.

# CI runs this in disposable project directories with their own ports and volumes.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d)
suffix="sw-accept-$(date +%s)-$$"
cleanup() {
    local shop
    for shop in fresh restored; do
        if [[ -d "$work/$shop" ]]; then
            (cd "$work/$shop" && COMPOSE_PROJECT_NAME="$suffix-$shop" ./bin/application-compose --profile coverage down -v) || return 1
        fi
    done
    rm -rf -- "$work"
}
trap cleanup EXIT
for shop in fresh restored; do
    mkdir "$work/$shop"
    cp -R "$root/bin" "$root/docker" "$root/assets" "$root/cypress" "$root/playwright" "$root/cypress.config.cjs" "$root/playwright.config.cjs" "$root/compose.yaml" "$root/compose.coverage.yaml" "$root/dependencies.yaml" "$root/install.sh" "$root/package.json" "$root/package-lock.json" "$root/coverage.config.json" "$root/.dockerignore" "$work/$shop/"
done
sql() { ./bin/application-compose exec -T db mariadb -ushopware -pshopware --batch --skip-column-names shopware "$@"; }

qualify_coverage() {
    local label=$1
    local theme_state
    theme_state=$(./bin/application-compose exec -T app php /tools/theme-state.php fingerprint)
    ./bin/run-coverage --refresh-assets
    [[ $(./bin/application-compose exec -T app php /tools/theme-state.php fingerprint) == "$theme_state" ]]
    node "$root/tests/shopware/verify-coverage.cjs"
    mkdir -p "$root/shopware-reports/$MAGELENS_RUNNER/$label"
    cp -R coverage/. "$root/shopware-reports/$MAGELENS_RUNNER/$label/"
    [[ ! -f .runtime/coverage-override-active && ! -f .runtime/hooks-active ]]
    # The normal application must still work after coverage restores its mounts.
    ./bin/application-compose exec -T app php /tools/ready.php
    ./bin/application-compose exec -T app php < "$root/tests/shopware/report-url.php"
    ./bin/application-compose exec -T app php < "$root/tests/shopware/viewer-url.php"
}
version=()
[[ -z ${SHOPWARE_TEST_VERSION:-} ]] || version=(--version "$SHOPWARE_TEST_VERSION")
cd "$work/fresh"
APPLICATION_PORT=18080 APPLICATION_HTTPS_PORT=18443 RUNNER_VIEW_PORT=16080 ./install.sh --container-only --project-name "$suffix-fresh" ${version[@]+"${version[@]}"} ci-shop.test \
    | tee "$work/fresh-install.log"
[[ $(tail -n 3 "$work/fresh-install.log") == $'Administration  https://ci-shop.test:18443/admin\nUsername  admin\nPassword  shopware' ]]
SHOPWARE_ORIGIN=https://ci-shop.test:18443 LOCAL_BROWSER_HOST=127.0.0.1 node "$root/tests/shopware/browser.cjs"
if [[ ${SHOPWARE_COVERAGE_ACCEPTANCE:-0} == 1 ]]; then
    runner_image=$(./bin/application-compose images -q runner)
    [[ -n "$runner_image" ]]
    bash "$root/tests/runner-container.sh" "$runner_image"
    if [[ "$MAGELENS_RUNNER" == cypress ]]; then
        mkdir -p tests/fixtures
        cp "$root/tests/cypress-regressions.cjs" tests/
        cp -R "$root/tests/fixtures/cypress-runner" tests/fixtures/
        ./bin/runner node tests/cypress-regressions.cjs
        mkdir -p "$root/shopware-reports/$MAGELENS_RUNNER"
        cp coverage/cypress-runner-results.json "$root/shopware-reports/$MAGELENS_RUNNER/"
    fi
    mkdir -p src/custom/plugins src/tests/e2e src/tests/coverage
    cp -R "$root/tests/fixtures/shopware/coverage-probe" src/custom/plugins/CoverageProbe
    cp -R "$root/tests/fixtures/shopware/e2e/." src/tests/e2e/
    cp "$root/tests/fixtures/shopware/hooks.php" src/tests/coverage/hooks.php
    ./bin/console plugin:refresh --no-interaction
    ./bin/console plugin:install --activate CoverageProbe --no-interaction
    ./bin/shopware-cli project storefront-build --no-interaction
    ./bin/shopware-cli project admin-build --no-interaction
    qualify_coverage fresh
    first_run=$(node -p "require('./coverage/run.json').id")
    if [[ "$MAGELENS_RUNNER" == cypress ]]; then
        failing_spec=src/tests/e2e/cypress/failure.cy.js
        printf "it('deliberate acceptance failure', () => { throw new Error('controlled failure'); });\n" > "$failing_spec"
    else
        failing_spec=src/tests/e2e/playwright/failure.spec.js
        printf "const {test} = require('../../../../playwright/support.cjs'); test('deliberate acceptance failure', () => { throw new Error('controlled failure'); });\n" > "$failing_spec"
    fi
    if ./bin/run-coverage; then
        echo 'A failing browser suite published success' >&2
        exit 1
    fi
    [[ ! -f coverage/.published && ! -f coverage/.active-run && ! -f .runtime/coverage-override-active && ! -f .runtime/hooks-active ]]
    ./bin/application-compose exec -T -e EXPECTED_REPORT_STATUS=404 app php < "$root/tests/shopware/report-url.php"
    rm "$failing_spec"
    # A real source edit must produce fresh instrumentation and evidence.
    printf '\n// Repeated-run acceptance source edit.\n' >> src/custom/plugins/CoverageProbe/src/Resources/app/storefront/src/lazy.ts
    qualify_coverage fresh
    [[ $(node -p "require('./coverage/run.json').id") != "$first_run" ]]
fi
./bin/application-compose exec -T app php -d error_reporting=-1 -d display_errors=stderr < "$root/tests/shopware/product.php"
./bin/console user:create local-fixture --email fixture@shopware.test --admin --password="test-fixture-password" --no-interaction
./bin/application-compose exec -T db mariadb-dump --single-transaction -ushopware -pshopware shopware > "$work/backup.sql"
lock=$(sha256sum src/composer.lock | cut -d' ' -f1)
# Copy application source and secrets as a developer would. Generated dependencies are reinstalled.
(cd src && tar --exclude=vendor --exclude=var --exclude=public/bundles --exclude=public/theme -cf "$work/source.tar" .)
cd "$work/restored"
mkdir src
tar -xf "$work/source.tar" -C src
mkdir -p src/custom/plugins/LocalFixture
printf 'local fixture\n' > src/custom/plugins/LocalFixture/README.md
# This unreachable host must never win over the local DB for Composer, console or web.
printf '\nDATABASE_URL=mysql://fixture:fixture@remote.invalid/shop\n' >> src/.env.local
export COMPOSE_PROJECT_NAME="$suffix-restored" APPLICATION_PORT=18081 APPLICATION_HTTPS_PORT=18444 RUNNER_VIEW_PORT=16081
./bin/application-compose up -d --wait db
sql -e 'CREATE TABLE incomplete_fixture(id INT)'
if ./install.sh --container-only restore-shop.test > "$work/partial.log" 2>&1; then
    echo 'Accepted a partial database' >&2
    exit 1
fi
grep -F 'Incomplete local Shopware database' "$work/partial.log"
[[ ! -f .runtime/installed && $(sql -e 'SHOW TABLES') == incomplete_fixture ]]
sql -e 'DROP TABLE incomplete_fixture'
# Prove the copied code can independently install against an empty database.
./install.sh --container-only restore-shop.test
[[ $(sql -e "SELECT COUNT(*) FROM product WHERE product_number='SW-LOCAL-FIXTURE'") == 0 ]]
if [[ ${SHOPWARE_COVERAGE_ACCEPTANCE:-0} == 1 ]]; then
    ./bin/console plugin:refresh --no-interaction
    ./bin/console plugin:install --activate CoverageProbe --no-interaction
    ./bin/shopware-cli project storefront-build --no-interaction
    ./bin/shopware-cli project admin-build --no-interaction
    qualify_coverage adopted
fi
./bin/application-compose stop app
# This dump comes from the disposable test shop and replaces the test schema's tables.
sql < "$work/backup.sql"
rm .runtime/installed
./install.sh --container-only restore-shop.test | tee "$work/restored-install.log"
[[ $(tail -n 1 "$work/restored-install.log") == 'Administration  https://restore-shop.test:18444/admin' ]]
./bin/application-compose stop
./bin/start
./install.sh --container-only
[[ $(sha256sum src/composer.lock | cut -d' ' -f1) == "$lock" ]]
[[ $(cat src/custom/plugins/LocalFixture/README.md) == 'local fixture' ]]
[[ $(sql -e "SELECT COUNT(*) FROM product WHERE product_number='SW-LOCAL-FIXTURE'") == 1 ]]
[[ $(sql -e "SELECT COUNT(*) FROM user WHERE username='local-fixture' AND admin=1") == 1 ]]
[[ $(sql -e "SELECT COUNT(*) FROM sales_channel_domain WHERE url IN ('https://ci-shop.test:18443','https://restore-shop.test:18444')") == 2 ]]
SHOPWARE_ORIGIN=https://restore-shop.test:18444 LOCAL_BROWSER_HOST=127.0.0.1 node "$root/tests/shopware/browser.cjs"
if [[ ${SHOPWARE_COVERAGE_ACCEPTANCE:-0} == 1 ]]; then qualify_coverage restored; fi
echo 'Copied source, restored data, local domains and administrator login verified.'
