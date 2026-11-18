<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);

// Connect only to this Compose service, even when the copied project has a remote DSN.
$db = new PDO('mysql:host=db;dbname=shopware;charset=utf8mb4', 'shopware', 'shopware', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$tables = $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
if ($argv[1] === 'state') {
    if (!$tables) {
        echo "empty\n";
        exit;
    }
    if (array_diff(['migration', 'sales_channel', 'sales_channel_domain', 'system_config', 'user', 'product', 'theme'], $tables)
        || !$db->query('SELECT 1 FROM user WHERE admin = 1 AND active = 1 LIMIT 1')->fetchColumn()
        || !$db->query('SELECT 1 FROM sales_channel_domain LIMIT 1')->fetchColumn()) {
        throw new RuntimeException('Incomplete local Shopware database. Restore a complete matching backup, then rerun installation.');
    }
    echo "installed\n";
    exit;
}
require getcwd() . '/vendor/autoload.php';
use Shopware\Core\Defaults;

// Reject a different 6.7 schema before adding a domain or compiling themes.
$core = Composer\InstalledVersions::getInstallPath('shopware/core');
$expected = [];
foreach (glob("$core/Migration/V6_7/Migration*.php") as $file) {
    $expected[] = 'Shopware\\Core\\Migration\\V6_7\\' . basename($file, '.php');
}
$applied = array_values(array_filter(
    $db->query('SELECT class FROM migration WHERE `update` IS NOT NULL')->fetchAll(PDO::FETCH_COLUMN),
    static fn ($class) => str_starts_with($class, 'Shopware\\Core\\Migration\\V6_7\\')
));
if (!$expected || array_diff($expected, $applied) || array_diff($applied, $expected)) {
    throw new RuntimeException('The local database migrations differ from the locked Shopware core. Restore the matching database or complete the project upgrade separately.');
}
$origin = getenv('APP_URL');
$columns = $db->query('SHOW COLUMNS FROM sales_channel_domain')->fetchAll(PDO::FETCH_COLUMN);
$internal = in_array('is_external_storefront', $columns, true) ? ' AND d.is_external_storefront = 0' : '';
$query = $db->prepare('SELECT LOWER(HEX(d.id)) id, d.url FROM sales_channel_domain d
    JOIN sales_channel s ON s.id = d.sales_channel_id
    WHERE s.active = 1 AND s.type_id = UNHEX(?)' . $internal . ' ORDER BY d.url');
$query->execute([Defaults::SALES_CHANNEL_TYPE_STOREFRONT]);
$domains = $query->fetchAll(PDO::FETCH_KEY_PAIR);
foreach ($domains as $url) {
    if (rtrim($url, '/') === $origin) {
        exit;
    }
}
$id = $argv[2] ?? '';
if ($id === '' && count($domains) === 1) {
    $id = array_key_first($domains);
}
if (!isset($domains[$id])) {
    foreach ($domains as $key => $url) {
        fwrite(STDERR, "$key  $url\n");
    }
    throw new RuntimeException($domains
        ? 'Choose a local Storefront source with --domain-id ID and rerun.'
        : 'The restored shop needs an active Storefront sales channel with a domain.');
}
// Preserve the original domain, language, currency, snippets and theme assignment.
$copy = implode(', ', array_intersect(
    ['sales_channel_id', 'language_id', 'currency_id', 'snippet_set_id', 'hreflang_use_only_locale', 'custom_fields', 'measurement_units'],
    $columns
));
$sql = "INSERT INTO sales_channel_domain (id, url, $copy, created_at)
    SELECT UNHEX(?), ?, $copy, NOW(3) FROM sales_channel_domain WHERE id = UNHEX(?)";
$db->prepare($sql)->execute([bin2hex(random_bytes(16)), $origin, $id]);
