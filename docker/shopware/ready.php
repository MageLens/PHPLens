<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);

$origin = getenv('APP_URL');
$ca = '/state/caddy/pki/authorities/local/root.crt';
// Wait for a verified TLS connection, including initial local certificate issuance.
// HTTP application errors below remain final and are never retried.
$deadline = microtime(true) + 60;
$connected = false;
do {
    if (is_file($ca)) {
        $connection = curl_init($origin);
        curl_setopt_array($connection, [CURLOPT_CAINFO => $ca, CURLOPT_CONNECT_ONLY => true,
            CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 2, CURLOPT_NOPROXY => '*']);
        $connected = curl_exec($connection) !== false;
        if ($connected) break;
    }
    usleep(250000);
} while (microtime(true) < $deadline);
if (!$connected) throw new RuntimeException('The local HTTPS server did not become ready.');

function getLocal(string $url, string $ca): array
{
    $request = curl_init($url);
    curl_setopt_array($request, [
        CURLOPT_CAINFO => $ca,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_NOPROXY => '*',
    ]);
    $body = curl_exec($request);
    $status = curl_getinfo($request, CURLINFO_RESPONSE_CODE);
    if ($status !== 200 || $body === false) {
        throw new RuntimeException("Readiness check failed for $url (HTTP $status). " . curl_error($request));
    }
    return [$body, curl_getinfo($request, CURLINFO_CONTENT_TYPE)];
}

foreach (['/' => 'storefront', '/admin' => 'admin'] as $path => $page) {
    [$html] = getLocal($origin . $path, $ca);
    $dom = new DOMDocument();
    $dom->loadHTML($html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    $xpath = new DOMXPath($dom);
    if ($page === 'storefront') {
        if (!$xpath->query('//main')->length) {
            throw new RuntimeException('The configured domain did not serve the Storefront homepage.');
        }
        foreach ($xpath->query('//script[@src]/@src | //link[@rel="stylesheet"]/@href') as $attribute) {
            $url = $attribute->nodeValue;
            if (str_starts_with($url, '/') && !str_starts_with($url, '//')) $url = $origin . $url;
            if (str_starts_with($url, "$origin/theme/") || str_starts_with($url, "$origin/bundles/")) getLocal($url, $ca);
        }
        continue;
    }
    if (!$dom->getElementById('app')) {
        throw new RuntimeException('The Administration entry point is missing.');
    }
    foreach ($xpath->query('//script[@src]/@src') as $attribute) {
        $url = $attribute->nodeValue;
        if (str_starts_with($url, '/') && !str_starts_with($url, '//')) {
            $url = $origin . $url;
        }
        if (str_starts_with($url, "$origin/bundles/administration/")) {
            [$js, $type] = getLocal($url, $ca);
            if ($js !== '' && str_contains($type, 'javascript')) {
                echo "Storefront and Administration assets verified over HTTPS.\n";
                exit;
            }
        }
    }
    throw new RuntimeException('The Administration JavaScript bundle failed its readiness check.');
}
