<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);
$action = $argv[1] ?? '';
if (!in_array($action, ['before', 'prepare', 'cleanup'], true)) throw new RuntimeException('Expected before, prepare or cleanup');
$project = json_decode(file_get_contents('/project.json'), true, flags: JSON_THROW_ON_ERROR);
$fixtures = [];
$failed = [];
foreach ($project['hooks'] as $relative) {
    $hook = '/var/www/html/' . $relative;
    if (!is_file($hook) || realpath($hook) !== $hook) throw new RuntimeException("Missing or symlinked fixture hook: $relative");
    $process = proc_open([PHP_BINARY, '-d', 'error_reporting=-1', '-d', 'display_errors=stderr', '-d', 'log_errors=0', $hook, $action], [0 => STDIN, 1 => ['pipe', 'w'], 2 => STDERR], $pipes);
    if (!is_resource($process)) throw new RuntimeException("Cannot run fixture hook: $relative");
    $output = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    if (proc_close($process) !== 0) {
        if ($action !== 'cleanup') throw new RuntimeException("Fixture hook failed: $relative ($action)");
        $failed[] = $relative;
        continue;
    }
    if ($action === 'prepare') $fixtures[$relative] = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
    else echo $output;
}
if ($failed) throw new RuntimeException('Fixture cleanup failed: ' . implode(', ', $failed));
if ($action === 'prepare') echo json_encode((object) $fixtures, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), "\n";
