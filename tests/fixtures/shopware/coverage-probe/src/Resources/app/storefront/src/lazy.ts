// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

export function message(visited: boolean): string {
    if (visited) return 'Lazy coverage collected';
    return 'This branch must remain uncovered';
}
