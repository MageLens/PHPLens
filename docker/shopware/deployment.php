<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);

function shopwareDeploymentState(): string
{
    // Match the installer: never use a restored application's remote DSN.
    $db = new PDO('mysql:host=db;dbname=shopware;charset=utf8mb4', 'shopware', 'shopware', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $state = [];
    foreach ([
        'plugins' => 'SELECT name, version, active FROM plugin ORDER BY name',
        'apps' => 'SELECT name, version, active FROM app ORDER BY name',
        'themes' => 'SELECT LOWER(HEX(sales_channel_id)) channel, LOWER(HEX(theme_id)) theme FROM theme_sales_channel ORDER BY sales_channel_id, theme_id',
    ] as $key => $query) {
        $state[$key] = $db->query($query)->fetchAll(PDO::FETCH_ASSOC);
    }
    return hash('sha256', json_encode($state, JSON_THROW_ON_ERROR));
}
