#!/usr/bin/env bash
# Copyright (c)  MageLens
# SPDX-License-Identifier: Elastic-2.0
# License: see LICENSE in the repository root.

# TO DO [SW-AUDIT-005]: Retain the Magento two-factor-auth module required by inherited setup.
# Replace authentication fixtures per platform rather than installing this in Shopware.

set -euo pipefail
# Match Mark Shust's bin/init development dependency, keeping it in vendor/.
if ! composer show markshust/magento2-module-disabletwofactorauth >/dev/null 2>&1; then
    composer require --dev markshust/magento2-module-disabletwofactorauth --prefer-dist --no-interaction --no-progress
fi
