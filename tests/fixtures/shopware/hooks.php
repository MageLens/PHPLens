<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);
if (($argv[1] ?? '') === 'prepare') echo json_encode(['warmupPaths' => ['/coverage-probe', '/coverage-probe/warmup-only', '/admin']], JSON_THROW_ON_ERROR);
