<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);

function shopwareCoverageIdentity(): array
{
    require_once __DIR__ . '/deployment.php';
    $deployment = shopwareDeploymentState();
    if (!hash_equals(project()['deploymentId'], $deployment)) {
        throw new RuntimeException('Active Shopware plugins, apps or theme assignments changed. Rerun against a stable deployment.');
    }
    $root = '/var/www/html';
    $run = json_decode(file_get_contents('/coverage/run.json'), true, flags: JSON_THROW_ON_ERROR);
    $files = array_map(static fn(string $file): string => $root . '/' . substr($file, 4), array_keys($run['sources']));
    sort($files, SORT_STRING);
    $scope = array_values(array_filter($files, static fn(string $file): bool => str_ends_with($file, '.php')));
    foreach ($scope as $file) {
        $original = 'src/' . substr($file, strlen($root) + 1);
        if (!is_file($file) || realpath($file) !== $file || !hash_equals($run['sources'][$original], hash_file('sha256', $file))) {
            throw new RuntimeException('Runtime PHP source changed; original bytes and line numbers must be preserved: ' . $original);
        }
        $exclude = (string) ini_get('pcov.exclude');
        $directory = rtrim((string) ini_get('pcov.directory'), '/') . '/';
        if (!str_starts_with($file, $directory) || ($exclude !== '' && preg_match($exclude, $file) !== 0)) {
            throw new RuntimeException('Eligible PHP source is excluded by the PCOV startup filter: ' . $original);
        }
    }
    $digest = static fn(array $inputs): string => hash('sha256', json_encode(pcov_manifest_source_inventory($inputs), JSON_THROW_ON_ERROR));
    return [
        'scope' => pcov_manifest_source_inventory($scope),
        'identity' => pcov_manifest_environment_identity([
            'platform' => 'shopware',
            'application_revision' => hash_file('sha256', "$root/composer.json"),
            'generated_code' => $digest(array_merge(applicationFiles("$root/public/bundles"), applicationFiles("$root/public/theme"))),
            'dependency_lock' => hash_file('sha256', "$root/composer.lock"),
            'source_tree' => $digest($files),
            'extension_state' => $deployment,
            'modules_config' => $digest(array_merge(applicationFiles("$root/config"), array_values(array_filter([
                "$root/composer.json", "$root/.env", "$root/.env.local", "$root/.env.local.php",
                "$root/var/plugins.json", "$root/var/config_js_features.json",
            ], 'is_file')))),
            'coverage_config' => $digest([
                __FILE__, __DIR__ . '/deployment.php', __DIR__ . '/coverage.ini', '/application/coverage.config.json',
                '/project.json', '/application/docker/php/collect.php',
                '/application/docker/php/collection.php', '/application/docker/php/manifest.php',
                '/usr/local/etc/php/conf.d/zzz-coverage-scope.ini',
            ]),
        ]),
    ];
}
