#!/usr/bin/env bash
# Copyright (c)  MageLens
# SPDX-License-Identifier: Elastic-2.0
# License: see LICENSE in the repository root.

# TO DO [SW-AUDIT-011]: Retain legacy refresh-assets behavior and flags. Replace pub/static cleanup
# and bin/magento cache commands with platform-specific cache/build operations.

set -euo pipefail
cd /var/www/html
# Clear copied/instrumented assets; developer mode generates requested files on demand.
# Keep .htaccess and the deployment version in pub/static.
rm -rf pub/static/frontend pub/static/adminhtml var/view_preprocessed
php bin/magento cache:clean
