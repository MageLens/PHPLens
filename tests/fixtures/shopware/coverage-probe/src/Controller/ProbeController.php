<?php
/*
 * Copyright (c)  MageLens
 * SPDX-License-Identifier: Elastic-2.0
 * License: see LICENSE in the repository root.
 */

declare(strict_types=1);
namespace CoverageProbe\Controller;

use Shopware\Storefront\Controller\StorefrontController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route(defaults: ['_routeScope' => ['storefront']])]
class ProbeController extends StorefrontController
{
    #[Route(path: '/coverage-probe', name: 'frontend.coverage.probe', methods: ['GET'])]
    public function visited(): Response
    {
        return $this->renderStorefront('@CoverageProbe/storefront/probe.html.twig');
    }

    #[Route(path: '/coverage-probe/unvisited', name: 'frontend.coverage.probe.unvisited', methods: ['GET'])]
    public function unvisited(): Response
    {
        return new Response('This endpoint must remain uncovered');
    }

    #[Route(path: '/coverage-probe/warmup-only', name: 'frontend.coverage.probe.warmup', methods: ['GET'])]
    public function warmupOnly(): Response
    {
        return $this->renderStorefront('@CoverageProbe/storefront/probe.html.twig', ['warmupOnly' => true]);
    }
}
