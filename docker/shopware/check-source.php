<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);

$source = $argv[1];
foreach (['composer.json', 'composer.lock', 'bin/console', 'public/index.php'] as $file) {
    if (!is_file("$source/$file") || !str_starts_with(realpath("$source/$file"), realpath($source) . '/')) {
        throw new RuntimeException("Expected a complete Shopware project with $file inside src/.");
    }
}
$manifest = json_decode(file_get_contents("$source/composer.json"), true, flags: JSON_THROW_ON_ERROR);
$lock = json_decode(file_get_contents("$source/composer.lock"), true, flags: JSON_THROW_ON_ERROR);
$versions = array_column($lock['packages'] ?? [], 'version', 'name');
if (empty($manifest['require']) || !preg_match('/^v?6\.7\.\d+\.\d+$/D', $versions['shopware/core'] ?? '')
    || !isset($versions['shopware/storefront'], $versions['shopware/administration'])) {
    throw new RuntimeException('Expected a locked Shopware 6.7 project with the Storefront and Administration packages.');
}
echo ltrim($versions['shopware/core'], 'v'), PHP_EOL;
