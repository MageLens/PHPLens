// Copyright (c)  MageLens
// SPDX-License-Identifier: Elastic-2.0
// License: see LICENSE in the repository root.

Shopware.Component.register('coverage-probe-page', {
    template: '<div id="coverage-probe-admin">Coverage probe ready</div>',
});
Shopware.Module.register('coverage-probe', {
    type: 'plugin',
    title: 'Coverage probe',
    description: 'Controlled Administration coverage fixture',
    color: '#168078',
    icon: 'regular-cog',
    routes: {index: {component: 'coverage-probe-page', path: 'index'}},
});
