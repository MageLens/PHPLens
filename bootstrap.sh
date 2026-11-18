#!/usr/bin/env bash
# Copyright (c)  MageLens
# SPDX-License-Identifier: Elastic-2.0
# License: see LICENSE in the repository root.

set -euo pipefail
# A release archive for this fork has not been published. Bootstrap an existing
# checkout only when the caller selected it as the working directory.
script=${BASH_SOURCE[0]:-}
if [[ -z "$script" || ! -f "$script" || ! bootstrap.sh -ef "$script" || ! -x ./install.sh ]]; then
    echo 'Run ./install.sh in the Shopware fork checkout.' >&2
    exit 1
fi
exec ./install.sh "$@"
