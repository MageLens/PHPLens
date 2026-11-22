<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);
$request = curl_init(getenv('APP_URL') . '/coverage/index.html');
curl_setopt_array($request, [CURLOPT_CAINFO => '/state/caddy/pki/authorities/local/root.crt',
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_NOPROXY => '*']);
$body = curl_exec($request);
$status = curl_getinfo($request, CURLINFO_RESPONSE_CODE);
$expected = (int) (getenv('EXPECTED_REPORT_STATUS') ?: '200');
if ($body === false || $status !== $expected || ($expected === 200 && !str_contains($body, 'Templates and inline scripts: not collected'))) {
    throw new RuntimeException("Public coverage report returned HTTP $status; expected $expected. " . curl_error($request));
}
echo "Public coverage route verified (HTTP $status).\n";
