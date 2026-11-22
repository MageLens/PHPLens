<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);
$db = new PDO('mysql:host=db;dbname=shopware;charset=utf8mb4', 'shopware', 'shopware', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$condition = "configuration_key = 'storefront.themeSeed' OR configuration_key LIKE 'storefront.themeSeeds.%'";
$state = '/pcov-state/theme-state.json';
$rows = static fn(): array => $db->query("SELECT LOWER(HEX(id)) id, configuration_key, configuration_value,
    LOWER(HEX(sales_channel_id)) channel, created_at, updated_at FROM system_config WHERE $condition
    ORDER BY configuration_key, sales_channel_id")->fetchAll(PDO::FETCH_ASSOC);
switch ($argv[1] ?? '') {
    case 'fingerprint':
        echo hash('sha256', json_encode($rows(), JSON_THROW_ON_ERROR)), "\n";
        break;
    case 'save':
        // Do not overwrite the baseline of an interrupted run.
        if (is_file($state)) throw new RuntimeException('Recover the previous theme state before starting coverage');
        $json = json_encode($rows(), JSON_THROW_ON_ERROR);
        $temporary = tempnam(dirname($state), 'theme-state-');
        if ($temporary === false) throw new RuntimeException('Cannot prepare theme asset state');
        try {
            if (file_put_contents($temporary, $json) !== strlen($json) || !rename($temporary, $state)) {
                throw new RuntimeException('Cannot save theme asset state');
            }
        } finally {
            if (is_file($temporary)) unlink($temporary);
        }
        break;
    case 'restore':
        if (!is_file($state)) break;
        $saved = json_decode(file_get_contents($state), true, flags: JSON_THROW_ON_ERROR);
        $db->beginTransaction();
        try {
            $db->exec("DELETE FROM system_config WHERE $condition");
            $insert = $db->prepare('INSERT INTO system_config (id, configuration_key, configuration_value, sales_channel_id, created_at, updated_at)
                VALUES (UNHEX(?), ?, ?, UNHEX(?), ?, ?)');
            foreach ($saved as $row) $insert->execute([$row['id'], $row['configuration_key'], $row['configuration_value'], $row['channel'], $row['created_at'], $row['updated_at']]);
            $db->commit();
        } catch (Throwable $error) {
            $db->rollBack();
            throw $error;
        }
        if (!unlink($state)) throw new RuntimeException('Cannot remove restored theme state marker');
        break;
    default:
        throw new RuntimeException('Expected fingerprint, save or restore');
}
