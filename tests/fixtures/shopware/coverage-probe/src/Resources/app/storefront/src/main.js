// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

class CoverageProbe extends window.PluginBaseClass {
    init() {
        this.el.querySelector('button').addEventListener('click', async () => {
            const {message} = await import('./lazy');
            this.el.querySelector('p').textContent = message(true);
        });
    }
}
window.PluginManager.register('CoverageProbe', CoverageProbe, '[data-coverage-probe]');
if (document.querySelector('[data-coverage-warmup-only]')) {
    import('./warmup-only').then(module => module.warmupOnly());
}
