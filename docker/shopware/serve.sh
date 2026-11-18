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
EOF
    tail -n +2 /etc/caddy/Caddyfile
    echo '}'
} > /tmp/shopware.Caddyfile
sed 's|/etc/caddy/Caddyfile|/tmp/shopware.Caddyfile|' /etc/supervisord.conf > /tmp/shopware-supervisord.conf
exec /usr/bin/supervisord -c /tmp/shopware-supervisord.conf
