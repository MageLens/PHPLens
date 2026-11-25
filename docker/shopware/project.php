<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);

use Shopware\Core\Framework\Adapter\Kernel\KernelFactory;
use Symfony\Component\Dotenv\Dotenv;

require_once __DIR__ . '/deployment.php';
$root = '/var/www/html';
$loader = require "$root/vendor/autoload.php";
(new Dotenv())->bootEnv("$root/.env");
$kernel = KernelFactory::create(environment: 'dev', debug: false, classLoader: $loader);
$kernel->boot();
$config = json_decode(file_get_contents('/coverage-config.json'), true, flags: JSON_THROW_ON_ERROR);
$roots = [];
$modules = [];
foreach (['src', 'assets'] as $path) if (is_dir("$root/$path")) $roots[] = $path;
foreach ($kernel->getBundles() as $name => $bundle) {
    $directory = $bundle->getPath();
    while (str_starts_with($directory, "$root/") && !is_file("$directory/composer.json")) $directory = dirname($directory);
    $relative = substr($directory, strlen($root) + 1);
    if (preg_match('~^custom/(?:plugins|static-plugins)/[^/]+$~D', $relative)) {
        $roots[] = $relative;
        $modules[] = ['name' => $name, 'root' => $relative];
    }
}
// Apps do not provide Symfony bundles. Only enabled, locally installed apps are scoped.
$connection = $kernel->getContainer()->get(\Doctrine\DBAL\Connection::class);
foreach ($connection->fetchFirstColumn('SELECT name FROM app WHERE active = 1') as $name) {
    if (preg_match('/^[A-Za-z0-9_-]+$/D', $name) && is_dir("$root/custom/apps/$name")) $roots[] = "custom/apps/$name";
}
foreach ($config['vendorRoots'] ?? [] as $relative) {
    if (!is_string($relative) || !preg_match('~^vendor/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_-]+)*$~D', $relative)
        || in_array('..', explode('/', $relative), true) || !is_dir("$root/$relative")) throw new RuntimeException('Invalid or missing vendor coverage root');
    $roots[] = $relative;
}
$roots = array_values(array_unique($roots));
sort($roots);
$hooks = [];
foreach (array_merge(['tests'], array_map(static fn(array $module): string => $module['root'] . '/tests', $modules)) as $tests) {
    if (is_file("$root/$tests/coverage/hooks.php")) $hooks[] = "$tests/coverage/hooks.php";
}
echo json_encode(['platform' => 'shopware', 'roots' => $roots, 'modules' => $modules, 'hooks' => $hooks,
    'deploymentId' => shopwareDeploymentState()], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), "\n";
