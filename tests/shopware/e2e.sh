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
            (cd "$work/$shop" && COMPOSE_PROJECT_NAME="$suffix-$shop" ./bin/application-compose down -v) || return 1
        fi
    done
    rm -rf -- "$work"
}
trap cleanup EXIT
for shop in fresh restored; do
    mkdir "$work/$shop"
    cp -R "$root/bin" "$root/docker" "$root/compose.yaml" "$root/dependencies.yaml" "$root/install.sh" "$work/$shop/"
done
sql() { ./bin/application-compose exec -T db mariadb -ushopware -pshopware --batch --skip-column-names shopware "$@"; }

cd "$work/fresh"
APPLICATION_PORT=18080 APPLICATION_HTTPS_PORT=18443 ./install.sh --container-only --project-name "$suffix-fresh" ci-shop.test
SHOPWARE_ORIGIN=https://ci-shop.test:18443 LOCAL_BROWSER_HOST=127.0.0.1 node "$root/tests/shopware/browser.cjs"
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
export COMPOSE_PROJECT_NAME="$suffix-restored" APPLICATION_PORT=18081 APPLICATION_HTTPS_PORT=18444
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
./bin/application-compose stop app
# This dump comes from the disposable test shop and replaces the test schema's tables.
sql < "$work/backup.sql"
rm .runtime/installed
./install.sh --container-only restore-shop.test
./bin/application-compose stop
./bin/start
./install.sh --container-only
[[ $(sha256sum src/composer.lock | cut -d' ' -f1) == "$lock" ]]
[[ $(cat src/custom/plugins/LocalFixture/README.md) == 'local fixture' ]]
[[ $(sql -e "SELECT COUNT(*) FROM product WHERE product_number='SW-LOCAL-FIXTURE'") == 1 ]]
[[ $(sql -e "SELECT COUNT(*) FROM user WHERE username='local-fixture' AND admin=1") == 1 ]]
[[ $(sql -e "SELECT COUNT(*) FROM sales_channel_domain WHERE url IN ('https://ci-shop.test:18443','https://restore-shop.test:18444')") == 2 ]]
SHOPWARE_ORIGIN=https://restore-shop.test:18444 LOCAL_BROWSER_HOST=127.0.0.1 node "$root/tests/shopware/browser.cjs"
echo 'Copied source, restored data, local domains and administrator login verified.'
