<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);
$domain = getenv('APPLICATION_DOMAIN') ?: 'shopware.test';
$port = getenv('RUNNER_VIEW_PORT') ?: '6080';
$origin = "https://$domain:$port";
$request = static function (string $url): array {
    $headers = [];
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_CAINFO => '/state/caddy/pki/authorities/local/root.crt',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_NOPROXY => '*',
        CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$headers): int {
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) {
                $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return strlen($line);
        },
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    if ($body === false) {
        throw new RuntimeException("Viewer request $url failed: $error");
    }
    return [$status, $headers, $body];
};
[$rootStatus, $rootHeaders] = $request("$origin/");
$expectedLocation = '/vnc.html?autoconnect=1&resize=scale&view_only=1&reconnect=1&reconnect_delay=1000';
if ($rootStatus !== 302 || ($rootHeaders['location'] ?? '') !== $expectedLocation || ($rootHeaders['cache-control'] ?? '') !== 'no-cache') {
    throw new RuntimeException("Viewer root returned HTTP $rootStatus (Location: " . ($rootHeaders['location'] ?? 'none') . ', Cache-Control: ' . ($rootHeaders['cache-control'] ?? 'none') . ').');
}
[$vncStatus, $vncHeaders, $vncBody] = $request("$origin$expectedLocation");
if ($vncStatus !== 200 || ($vncHeaders['cache-control'] ?? '') !== 'no-cache' || !str_contains($vncBody, 'noVNC')) {
    throw new RuntimeException("Viewer page returned HTTP $vncStatus (Cache-Control: " . ($vncHeaders['cache-control'] ?? 'none') . ').');
}
echo "Public viewer route verified (HTTP $rootStatus -> HTTP $vncStatus).\n";
