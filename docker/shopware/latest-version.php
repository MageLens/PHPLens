<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);

$request = curl_init('https://repo.packagist.org/p2/shopware/core.json');
curl_setopt_array($request, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FAILONERROR => true,
    CURLOPT_TIMEOUT => 30,
]);
$metadata = curl_exec($request);
if ($metadata === false) {
    throw new RuntimeException('Could not read Shopware release metadata from Packagist: ' . curl_error($request));
}

$releases = json_decode($metadata, true, flags: JSON_THROW_ON_ERROR);
$latest = '';
foreach ($releases['packages']['shopware/core'] ?? [] as $release) {
    if (preg_match('/^v?(6\.7\.[0-9]+\.[0-9]+)$/D', $release['version'] ?? '', $matches)
        && ($latest === '' || version_compare($matches[1], $latest, '>'))) {
        $latest = $matches[1];
    }
}
if ($latest === '') {
    throw new RuntimeException('Packagist did not list any stable Shopware 6.7 releases.');
}

echo $latest, PHP_EOL;
