<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);

// Called only by the acceptance fixture inside its disposable application container.
require 'vendor/autoload.php';
use Shopware\Core\Defaults;
use Shopware\Core\Framework\Adapter\Kernel\KernelFactory;
use Shopware\Core\Framework\Context;
use Symfony\Component\Dotenv\Dotenv;

(new Dotenv())->bootEnv('.env');
$kernel = KernelFactory::create(environment: 'dev', debug: false, classLoader: require 'vendor/autoload.php');
$kernel->boot();
$container = $kernel->getContainer();
$context = Context::createDefaultContext();
$taxId = $container->get('tax.repository')->searchIds(new Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria(), $context)->firstId();
$container->get('product.repository')->create([[
    'name' => 'Local restoration fixture',
    'productNumber' => 'SW-LOCAL-FIXTURE',
    'stock' => 4,
    'taxId' => $taxId,
    'price' => [['currencyId' => Defaults::CURRENCY, 'net' => 10, 'gross' => 12, 'linked' => false]],
]], $context);
