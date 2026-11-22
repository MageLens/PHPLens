#!/usr/bin/env bash
# Copyright (c)  MageLens
# SPDX-License-Identifier: Elastic-2.0
# License: see LICENSE in the repository root.

# Keep Shopware's upstream document root, FastCGI routes and static-file policy.
# Only replace its development listener and set up project-local HTTPS.
set -eu
{
    cat <<EOF
{
    auto_https disable_redirects
    skip_install_trust
}
http://${APPLICATION_DOMAIN}:${APPLICATION_PORT} {
    redir ${APP_URL}{uri} permanent
}
https://${APPLICATION_DOMAIN}:${APPLICATION_HTTPS_PORT} {
    tls internal
    handle_path /coverage/* {
        @published file {
            root /reports
            try_files .published
        }
        handle @published {
            root * /reports
            file_server {
                hide .published raw run.json collector.json project-fixtures.json
            }
        }
        respond 404
    }
EOF
    tail -n +2 /etc/caddy/Caddyfile
    echo '}'
    if [ -n "${RUNNER_VIEW_PORT:-}" ]; then
        printf 'https://%s:%s {\n tls internal\n reverse_proxy runner:6080\n}\n' "$APPLICATION_DOMAIN" "$RUNNER_VIEW_PORT"
    fi
} > /tmp/shopware.Caddyfile
sed 's|/etc/caddy/Caddyfile|/tmp/shopware.Caddyfile|' /etc/supervisord.conf > /tmp/shopware-supervisord.conf
exec /usr/bin/supervisord -c /tmp/shopware-supervisord.conf
