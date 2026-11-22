<!--
Copyright (c)  MageLens
SPDX-License-Identifier: Elastic-2.0
License: see LICENSE in the repository root.
-->

# Shopware transition audit

Audit date: 2026-11-20. Baseline: `859a8ced8f2978b3e03534cc1f24e2b0a1fe7cb5`.

## Outcome and boundaries

The working application path is the Shopware 6.7 installer and its daily commands. Inherited Magento/Mage-OS browser, coverage, image and release flows are retained for a later port. Their presence does **not** mean that they work against Shopware. This change adds migration annotations and removes misleading metadata/documentation only; it does not implement runners, Twig instrumentation, shared-core extraction or Magento installation compatibility.

The audit covers the baseline's 268 tracked files, including license sidecars, source, configuration, scripts, Docker recipes, tests, patches, workflows, documentation and assets. Searches included Magento/Mage-OS, Mark Shust, Hyva/Luma, ObjectManager/bootstrap, RequireJS/Knockout, PHTML, module/theme registration, source/static/media paths and hardcoded service assumptions. Consumers were traced through imports, shell commands, generated scripts, mounts, package scripts, Docker COPY inputs and CI. Generated `src/`, vendor packages, `.runtime/`, caches and local application data are excluded.

The direction follows the [Symfony platform proposal](https://github.com/MageLens/MageLens/wiki/Symfony-Commerce-Platform-Support): share proven generic collection/reporting behavior and keep application and template-engine integration in adapters. No proposed replacement package is assumed to exist.

### Classification and safe cleanup

| Classification | Decision and evidence |
| --- | --- |
| Remove safely | Replaced the package description claiming Magento bootstrapping with the actual Shopware milestone. Removed the dangling Blog README link from `AGENTS.md`; that demo is absent from tracked source. |
| Keep reusable | Istanbul instrumentation/merging, source hashes, run isolation, PCOV record processing, JavaScript scope validation, navigation helpers, browser identity/provenance, desktop tooling, escaping, badge/report mechanics, resource isolation and artifact validation remain useful. Some live inside files that also need platform adapters. |
| Retain pending replacement | The numbered findings below identify assumptions that prevent running inherited flows on Shopware. Comments sit at cohesive file/function boundaries rather than repeating on every coupled line. |
| Legitimate platform-specific integration | Existing Shopware scaffolding, locked-source validation, database/migration checks, sales-channel domains, readiness, Caddy serving and CLI wrappers stay Shopware-specific. Magento fixtures, package identities, third-party patches, namespaces, XML schemas and theme packages stay authentic legacy inputs until their consuming flows are replaced. |

No whole dependency or executable file was proven removable while preserving all retained flows. Being unreachable from the **current installer** does not make a coverage, recovery, test or release consumer redundant. In particular, do not delete the retired patch, Hyva repository, template package, fixtures or legacy scripts simply to reduce search matches. No versions, lockfiles, command names, CLI flags, executable statements or CI assertions were changed. Existing `.gitignore` contents were left intact.

## Commands and flows preserved

| Surface | Baseline behavior and retained contract |
| --- | --- |
| `install.sh`, `bootstrap.sh`, `bin/install` | Shopware installation; checkout-only bootstrap; exact/latest version resolution; fresh/adopted/restored source; saved project/domain/ports; local DB protection; interruption recovery. All current arguments remain, including `--version`, `--container-only`, `--project-name` and `--domain-id`. |
| `bin/application-compose`, `bin/start` | Root Shopware Compose services `app` and `db`; saved settings and checkout/volume ownership. |
| `bin/console`, `bin/composer`, `bin/shopware-cli` | Application-container execution, argument forwarding, noninteractive stdin and Composer authentication forwarding through `app_exec`. |
| `bin/application-domain`, `bin/setup-domain`, `bin/compose-project`, `bin/common`, `bin/dependencies` | Saved settings, domain/certificate handling, local project isolation, workflow locks and the strict Shopware dependency mapping. |
| `bin/run-coverage`; npm `coverage`, `cy:coverage` | Retained legacy lifecycle and refresh/start/restart/runner flags. Not operational on the Shopware service topology; see SW-AUDIT-001/009/011. |
| `bin/runner`, `bin/expose-tools` | Retained browser command forwarding and generated upstream tool exposure; migration blockers in SW-AUDIT-001/002. |
| `bin/build-php-image`, `bin/prepare-images`, `bin/image-inputs.cjs`, `bin/sync-runner-dependencies`, `bin/sync-dependencies.cjs` | Legacy build, digest/provenance, fallback and dependency-lock synchronization interfaces retained; missing inputs in SW-AUDIT-003/007. |
| `bin/project.cjs`, `bin/prepare.cjs`, `bin/javascript-scope.cjs`, `bin/run-browser.cjs`, `bin/run-playwright.cjs` | Discovery, instrumentation, source preservation, warm-up and runner result contracts retained. Discovery and engine assumptions require replacement. |
| `bin/report-browser.cjs`, `bin/report-index.cjs`, `bin/finalize.cjs`, `bin/badges.cjs`, `bin/browser-navigation.cjs` | Report aggregation, validation, navigation and badge interfaces retained. No replacement measurement semantics are invented. |
| npm `test:integration`, `test:e2e`, `test:e2e:matrix`, `check:copyright` | Scripts unchanged. Root integration glob covers `tests/*.test.cjs`, not `tests/shopware/installer.test.cjs`; the Shopware workflow invokes that file separately. |
| `.github/workflows/*`, `tests/ci/*`, `tests/release/*` | Shopware installer acceptance workflow and inherited nine-case qualification/publication safeguards retained. Legacy qualification remains blocked, not repurposed to claim Shopware coverage. |

The `bin/` inventory and package-script mapping were captured before edits and compared afterward. Existing generated command names in `bin/expose-tools` are also preserved.

## Retained migration findings

Each identifier below appears in legal source comments as `TO DO [SW-AUDIT-NNN]`. Comments state the retention reason and replacement condition. JSON/lockfile references are annotated at executable consumers; those formats remain valid. These are migration tasks, not requests to delete working platform-specific integration.

### SW-AUDIT-001 — Runner and coverage orchestration

**Evidence:** `bin/run-coverage` calls `db redis opensearch phpfpm app runner`, expects an integer legacy runtime marker `4`/`5` and runner selection, and invokes `/application/docker/php/*`. Current Compose has only `app`/`db`; Shopware installation writes its version into `.runtime/installed`. `bin/runner` executes `bin/docker-compose`, which is absent from tracked source and only generated by the legacy exposer.

**Keep:** public command names, options, failure propagation, workflow lock, warm-up exclusion and cleanup. **Replace:** platform service/collector lifecycle and installed-state interpretation; qualify browser services before wiring these commands into Shopware. Do not create an alias and assume the missing runner now works.

### SW-AUDIT-002 — Upstream command generation can overwrite Shopware tools

**Evidence:** `bin/expose-tools` requires `.runtime/docker-magento/compose`, copies its tools/lib/env, and writes `bin/start`, `bin/docker-compose` and `bin/setup-domain`. Its exclusion list does not protect all current Shopware wrappers, including `composer`, `console` and `shopware-cli`. Generated start assumes Magento services; generated domain setup takes a different certificate flow than the Shopware helper. Runner/bootstrap/project tests still invoke the exposer.

**Keep:** inherited generation entry point and fixtures. **Replace:** platform-owned command exposure with explicit ownership before reconnecting it to installation. The active Shopware installer does not invoke it; do not run it in a working Shopware checkout as a repair step.

### SW-AUDIT-003 — Image recipes, pins and fork ownership

**Evidence:** legacy PHP build reads `.runtime/docker-magento/images/php/$series`; image preparation builds `phpfpm`/`runner` and creates overlays for `workspace`. The source/release builders expect `PHP_VERSION`, `PHP_IMAGE`, `APPLICATION_PHP_IMAGE`, `MARKSHUST_DOCKER_MAGENTO_VERSION`, `PCOV_VERSION`, `PIE_VERSION`, browser/runner pins and `download_with_retry`. Legacy runtime tests additionally expect `start_dependencies` and `start_php_for_setup`, also absent from current `bin/common`. Current `bin/dependencies` accepts only the Shopware image/CLI, database and Linux x64 Chrome pins; current `bin/common` has no download retry helper. Runner recipes also expect a Chrome arm64 digest and staged template package. `bin/image-inputs.cjs` fixes repository/registry ownership to MageLens/MageLens and its image kinds.

**Keep:** both Docker targets, provenance, digest selection, native builds, source fallback checks and regression inputs. **Replace:** image/pin and service integration for the platform, then define fork-owned distribution without weakening the existing publication restrictions. Image recipe/comment changes also affect provenance hashes; they are not release qualification.

### SW-AUDIT-004 — Source staging, installation and adoption

**Evidence:** `download-magento.sh` selects Magento/Mage-OS Composer projects and Marketplace/public repositories. `install-magento.sh` uses `bin/magento`, Magento DB defaults, module activation and indexing. `expose-source.sh`/`sync-source.php` depend on product packages, `app/bootstrap.php`, `app/etc`, protected Magento paths and `.magelens-source.json` compatibility.

**Keep:** these legacy consumers and inventory protections; deleting protected paths risks user files. **Replace:** source lifecycle policy per platform. Shopware already uses `shopware-cli project create`, `docker/shopware/check-source.php` and locked Composer source; reuse those rather than routing it through the Magento updater.

### SW-AUDIT-005 — Configuration, Admin authentication and theme installation

**Evidence:** PHP configurators use Magento Bootstrap/ObjectManager, website/store tables, deployment config and Admin services. `env.php.sample` changes Magento cache/asset settings. `install-dev-tools.sh` installs `markshust/magento2-module-disabletwofactorauth`, enabled during setup. `install-hyva.php` consumes `hyva-packages.json`; `configure-theme.php` registers/selects Magento themes.

**Keep:** authentication and theme behavior for retained flows; the JSON repository and its package names are real dependencies, not labels. **Replace:** platform configuration, authentication fixtures and theme/build operations. Shopware's installer/domain helpers and browser Admin login are the current reference; Magento production-development settings cannot be copied into Symfony wholesale.

### SW-AUDIT-006 — Application and theme discovery

**Evidence:** `bin/project.cjs` discovers `app/code`, `app/design/{frontend,adminhtml}`, `etc/module.xml`, `Test/Cypress`/`Test/Playwright` and `theme.xml`; runtime generation binds instrumented sources to `phpfpm`/`app` and renders Magento nginx configuration. `project.php` lists modules through ComponentRegistrar; `theme-scope.php` uses Magento stores and theme registration. Runner configs and instrumentation consume these exports.

**Keep:** explicit vendor roots, deterministic inventories, symlink/overlap checks, inactive-theme handling and exported interfaces. **Replace:** extension/source/theme discovery and runtime mounting via platform integration. Shopware `custom/plugins`/`custom/apps` and Twig roots need actual platform discovery; a global path substitution would miss dependencies and template inheritance.

### SW-AUDIT-007 — Template dependency and browser instrumentation

**Evidence:** `@vitaliiboiko/magento-template-coverage` is imported by preparation and Cypress/Playwright support, synchronized into manifests/locks, installed for warm-up and invoked by `bin/report-browser.cjs`. `prepare.cjs` selects `.js`, `.html` and `.phtml`; it does not instrument Twig. Cypress configuration/support additionally uses Hyva selection and Magento initializer/RequireJS readiness.

**Keep:** the installed package and exact import/CLI identifiers while those consumers remain. Keep Istanbul JavaScript reporting independently reusable. **Replace:** template-engine discovery, instrumentation, runtime observation and reporting together. Qualify Shopware/Twig inheritance, includes, overrides, compiled-cache mapping and unsupported evidence. No verified drop-in Twig replacement was established by this audit.

### SW-AUDIT-008 — Active patches and retired-patch recovery

**Evidence:** `docker/php/cypress-patches.sh` applies the session patch, remaps Magento/Mage-OS vendor paths, and scans `patches/cypress/retired/*.patch` to restore interrupted older runs. `manifest.php` fingerprints patch inputs; patch regression tests exercise recovery/conflicting edits. The retired Admin form patch is not applied for new runs but is still read during recovery.

**Keep:** both active and retired patch files, third-party patch contents, provenance and recovery tests. **Replace/remove:** only when the Magento integration no longer needs those patches or old-run recovery, with retained source-preservation checks. They must not run against Shopware.

### SW-AUDIT-009 — PHP collector scope and deployment identity

**Evidence:** `coverage.ini` contains `pcov.request_magento_cache=1` and Magento source/exclusion paths. `manifest.php` fingerprints `app/etc`, generated DI metadata, session/form patch targets and the runtime source inventory. `collect.php`, `report.php` and collection locks depend on native PCOV export and validated identity/manifest records, with FPM-specific request capture.

**Keep:** native records, run isolation, stale-evidence rejection, zero-hit inventory, original-source verification and the PHP report library. **Replace:** platform identity/filter/cache inputs and image/SAPI setup; do not remove them and silently weaken stale-report detection. Qualify the PCOV fork with the Shopware runtime before deciding whether its Magento optimization can be disabled or replaced.

### SW-AUDIT-010 — Fixture lifecycle

**Evidence:** `project-hooks.php` iterates discovered Magento modules and executes `Test/MageLens/hooks.php` for `before`, `prepare` and `cleanup`; runners consume fixture JSON and warm-up paths. Generic `warmupPaths` validation remains reusable.

**Keep:** cleanup, subprocess failures, fixture JSON and lock ordering. **Replace:** extension discovery and hook location/fixture setup through platform integration. Merely removing hooks would lose the real application preparation and cleanup flow.

### SW-AUDIT-011 — Cache/assets, report URLs and serving

**Evidence:** `refresh-assets.sh` deletes Magento static/preprocessed output and calls `bin/magento cache:clean`; `run-coverage` publishes `src/pub/media/coverage`. `report-url.php` bootstraps Magento store configuration. `docker/nginx.conf` includes `nginx.conf.sample` with `MAGE_ROOT`/`MAGE_MODE`, proxies the runner viewer and serves media reports. Shopware uses `public/`, Caddy and `bin/console` build/cache operations instead.

**Keep:** refresh flags, safe symlink ownership, successful-run-only publication and explicit URLs. **Replace:** cache/build operations, report path/URL and web/viewer serving as one platform contract. Preserve PHP/report locks and failed-run cleanup when porting.

### SW-AUDIT-012 — Template report semantics

**Evidence:** `finalize.cjs` validates `.html`/browser `.phtml` and current template schema. `report-index.cjs` labels template lines, inline scripts, functions/branches and DOM presence using that schema. These assertions are correct for current consumers; deleting PHTML wording alone would falsely imply Twig support.

**Keep:** evidence validation, source mapping, warnings and distinct PHP/JS/template/DOM metrics. **Replace:** engine-specific schema validation and descriptions only alongside a qualified Twig collector. Rendered-template presence must not be presented as executable Twig line coverage.

### SW-AUDIT-013 — CI, dependency updates and publishing

**Evidence:** legacy workflows/case definitions require eight Linux combinations and Windows Mage-OS/Luma/Cypress, 63 acceptance scenarios, report equality and image qualification. Gates still read Magento version pins; Marketplace credentials and preview allowlists are platform-specific. Release workflow/repository checks target MageLens/MageLens; this checkout's origin is MageLens/PHPLens. Dependabot covers root npm, legacy report Composer and Actions manifests; the separate Shopware acceptance npm manifest is outside that root npm entry.

**Keep:** all existing checks, credential masking, preview pinning, source provenance, comparison strictness and publication restrictions. **Replace:** platform case/evidence contracts and fork release ownership after implementation. Configure package update coverage when package boundaries settle; do not rename allowlisted upstream repositories. The separate Shopware installer workflow verifies its own installation milestone, not PHP/JS/Twig coverage.

### SW-AUDIT-014 — Legacy tests and missing demo inputs

**Evidence:** E2E/source-adoption/Todo/compatibility harnesses use Magento flags, modules, layout XML, PHTML, Luma/Hyva, Admin selectors and the Blog acceptance contract. `tests/playwright.test.cjs` imports `src/app/code/Application/Blog/Test/storefront-readiness.cjs`, absent from tracked source. Root integration failures also expect old bootstrap behavior, project defaults, service helpers and pins replaced during the earlier installer transition.

**Keep:** test assertions and fixture source as behavior references, including Magento namespaces/schema URLs. **Replace:** platform fixtures and representative journeys before porting those harnesses. Do not delete failing tests or change expected values simply to report a passing transition. Shopware-specific product/Admin/restore fixtures remain the current installation reference.

### SW-AUDIT-015 — Descriptions, documentation and identity

**Evidence:** package description claimed Magento bootstrapping; `AGENTS.md` linked an absent Blog README. Inherited coverage/tests/patch documentation still describes authentic Magento behavior, paths and flags. `magelens` package identity, report branding, assets, headers, registry names and third-party attribution have compatibility/ownership consumers.

**Removed safely:** the inaccurate package description and dangling reference. **Keep:** package/version identity, historical changelog, artwork, attribution, legacy command reference and docs until replacement flows exist. **Replace later:** inherited usage sections together with qualified platform behavior; avoid a bulk Magento-to-Shopware rename.

## Dependency decisions

| Dependency/configuration | Consumer and action |
| --- | --- |
| `@vitaliiboiko/magento-template-coverage` and transitive packages in root npm lock | Retain for prepare/report/support imports; engine adapter replacement required (007/012). JSON annotations are at `bin/sync-dependencies.cjs`, `bin/prepare.cjs` and `bin/report-browser.cjs`. |
| `@cypress/code-coverage`, Cypress, Istanbul libraries, `nyc` | Retain: Cypress tasks/support, instrumentation, reporting, runner build and CLI paths still consume them. Runner/profile integration needs work; these are not all Magento-specific packages. |
| Playwright | Retain selected-runner synchronization and `tests/shopware/package.json`'s separate acceptance dependency. Root manifest need not install both legacy runners simultaneously. |
| `phpunit/php-code-coverage` and `docker/php/composer.lock` | Retain generic PHP report generation via `report.php`/`report-data.php`; platform changes belong in discovery/identity/runtime, not a package rename. |
| `VitaliyBoyko/pcov`, PIE and native report tools | Retain custom `pcov\export`/manifest record requirements; stock PCOV is not assumed interchangeable. Shopware image integration and cache qualification required (003/009). |
| Mark Shust Docker Magento | Replace as the Shopware runtime provider; already absent from active installer pins but still required by legacy builders/exposer and their tests (002/003). |
| Magento/Mage-OS Composer projects and Marketplace auth | Keep genuine identities inside legacy install/CI consumers; select Shopware CLI/Composer credentials via platform setup (004/013). |
| `markshust/magento2-module-disabletwofactorauth` | Legacy Admin fixture dependency; replace with platform authentication preparation, not a Symfony package of a similar name (005). |
| `hyva-packages.json`, Luma, Magento module/schema identifiers | Keep for legacy theme and fixture consumers; no valid generic rename or deletion (005/014). |
| Shopware development image, CLI, MariaDB and pinned Chrome | Keep active installer/acceptance pins and digest validation. Shopware defaults, DB schema and sales-channel queries are legitimate adapter-specific code. No upgrades required. |

## Verification

| Check actually executed | Result |
| --- | --- |
| `npm run test:integration`, before and after edits | Both runs: **325 tests; 241 pass, 78 fail, 6 skip, 0 cancelled, 0 todo**. Sorted named outcomes match exactly after removing timing data; no new pass/fail/skip differences. Both commands exit 1. |
| `node --test tests/shopware/installer.test.cjs`, final | **10/10 pass**, no skips. These are orchestration checks using a Docker command fixture, not real browser/container acceptance. |
| Tracked-script syntax | `bash -n` passes for all 50 Bash scripts; `node --check` passes for all 99 JavaScript scripts. |
| JSON/lockfile parsing | All 10 tracked JSON/lockfiles parse. Manifest/lock root dependency maps and identity are unchanged; no lock regeneration is needed for a description-only change. |
| Command/interface comparison against baseline | All 29 tracked `bin/` entry points and six npm scripts preserved. Removing only the added annotations and required notice updates reproduces the original content of all 52 changed source/config files exactly. |
| `npm run check:copyright` | Passed after updating the notice sidecar belonging to the changed UID Dockerfile. The new report was added with intent-to-add so this check includes it; its content is not staged. |
| `git diff --check` | Passed. `.gitignore` and both dependency lockfiles are byte-identical to baseline. |

The 78 pre-existing failures concern old archive bootstrap behavior; removed Magento pins in dependency/Compose/image/qualification checks; changed project/domain/profile defaults; missing retry/startup helpers; runner/exposer topology; absent Blog readiness source; and legacy image publication assumptions. Six download checks skip because the host PHP CLI is unavailable. These outcomes are migration blockers, not a passing full integration qualification. Existing assertions and tests were not modified to hide them.

**Not executed:** PHP lint/unit/report checks (no host PHP CLI); real Shopware Storefront/authenticated Administration/adoption/restore browser acceptance; and the full inherited nine-case E2E/release qualification. Browser/E2E qualification must run in GitHub Actions against the eventual pushed candidate. This local audit has no pushed candidate or triggered Actions run, and no GitHub CLI is installed. No local full E2E matrix, host DNS/certificate changes, application setup or database mutation was performed. Release qualification remains blocked.

The remaining port should first establish platform service/pin/discovery contracts (001–006), then qualify fixture and PHP/browser/template collection (007–010), then publication/measurement semantics and platform CI evidence (011–014). Documentation can claim each capability only after its corresponding real journey is qualified (015).

## Annotation locations

The following index links retained boundaries to the numbered findings above. Adjacent platform-specific literals covered by a file-level annotation do not each need a duplicate comment.

| Finding | Annotated boundary |
| --- | --- |
| SW-AUDIT-001 | [bin/run-coverage](../../bin/run-coverage#L6) |
| SW-AUDIT-001 | [bin/runner](../../bin/runner#L6) |
| SW-AUDIT-002 | [bin/expose-tools](../../bin/expose-tools#L6) |
| SW-AUDIT-003 | [bin/build-php-image](../../bin/build-php-image#L6) |
| SW-AUDIT-003 | [bin/image-inputs.cjs](../../bin/image-inputs.cjs#L5) |
| SW-AUDIT-003 | [bin/prepare-images](../../bin/prepare-images#L6) |
| SW-AUDIT-003 | [bin/sync-runner-dependencies](../../bin/sync-runner-dependencies#L6) |
| SW-AUDIT-003 | [docker/php/Dockerfile](../../docker/php/Dockerfile#L5) |
| SW-AUDIT-003 | [docker/php/uid.Dockerfile](../../docker/php/uid.Dockerfile#L5) |
| SW-AUDIT-003 | [docker/runner/Dockerfile](../../docker/runner/Dockerfile#L5) |
| SW-AUDIT-004 | [docker/php/download-magento.sh](../../docker/php/download-magento.sh#L6) |
| SW-AUDIT-004 | [docker/php/expose-source.sh](../../docker/php/expose-source.sh#L6) |
| SW-AUDIT-004 | [docker/php/install-magento.sh](../../docker/php/install-magento.sh#L6) |
| SW-AUDIT-004 | [docker/php/sync-source.php](../../docker/php/sync-source.php#L8) |
| SW-AUDIT-005 | [docker/php/configure-admin.php](../../docker/php/configure-admin.php#L8) |
| SW-AUDIT-005 | [docker/php/configure-env.php](../../docker/php/configure-env.php#L8) |
| SW-AUDIT-005 | [docker/php/configure-theme.php](../../docker/php/configure-theme.php#L8) |
| SW-AUDIT-005 | [docker/php/env.php.sample](../../docker/php/env.php.sample#L8) |
| SW-AUDIT-005 | [docker/php/install-dev-tools.sh](../../docker/php/install-dev-tools.sh#L6) |
| SW-AUDIT-005 | [docker/php/install-hyva.php](../../docker/php/install-hyva.php#L8) |
| SW-AUDIT-006 | [bin/project.cjs](../../bin/project.cjs#L5) |
| SW-AUDIT-006 | [docker/php/project.php](../../docker/php/project.php#L8) |
| SW-AUDIT-006 | [docker/php/theme-scope.php](../../docker/php/theme-scope.php#L8) |
| SW-AUDIT-007 | [bin/prepare.cjs](../../bin/prepare.cjs#L5) |
| SW-AUDIT-007 | [bin/report-browser.cjs](../../bin/report-browser.cjs#L5) |
| SW-AUDIT-007 | [bin/run-playwright.cjs](../../bin/run-playwright.cjs#L5) |
| SW-AUDIT-007 | [bin/sync-dependencies.cjs](../../bin/sync-dependencies.cjs#L5) |
| SW-AUDIT-007 | [cypress/support/e2e.js](../../cypress/support/e2e.js#L5) |
| SW-AUDIT-007 | [cypress/support/warmup.js](../../cypress/support/warmup.js#L5) |
| SW-AUDIT-007 | [playwright/support.cjs](../../playwright/support.cjs#L5) |
| SW-AUDIT-008 | [docker/php/cypress-patches.sh](../../docker/php/cypress-patches.sh#L6) |
| SW-AUDIT-009 | [docker/php/coverage.ini](../../docker/php/coverage.ini#L5) |
| SW-AUDIT-009 | [docker/php/manifest.php](../../docker/php/manifest.php#L8) |
| SW-AUDIT-010 | [docker/php/project-hooks.php](../../docker/php/project-hooks.php#L8) |
| SW-AUDIT-011 | [docker/nginx.conf](../../docker/nginx.conf#L5) |
| SW-AUDIT-011 | [docker/php/refresh-assets.sh](../../docker/php/refresh-assets.sh#L6) |
| SW-AUDIT-011 | [docker/php/report-url.php](../../docker/php/report-url.php#L8) |
| SW-AUDIT-012 | [bin/finalize.cjs](../../bin/finalize.cjs#L5) |
| SW-AUDIT-012 | [bin/report-index.cjs](../../bin/report-index.cjs#L5) |
| SW-AUDIT-013 | [.github/dependabot.yml](../../.github/dependabot.yml#L5) |
| SW-AUDIT-013 | [.github/workflows/ci.yml](../../.github/workflows/ci.yml#L5) |
| SW-AUDIT-013 | [.github/workflows/e2e-case.yml](../../.github/workflows/e2e-case.yml#L5) |
| SW-AUDIT-013 | [.github/workflows/release.yml](../../.github/workflows/release.yml#L5) |
| SW-AUDIT-013 | [tests/ci/cases.cjs](../../tests/ci/cases.cjs#L5) |
| SW-AUDIT-013 | [tests/ci/credentials.cjs](../../tests/ci/credentials.cjs#L5) |
| SW-AUDIT-013 | [tests/ci/dependency-previews.cjs](../../tests/ci/dependency-previews.cjs#L5) |
| SW-AUDIT-013 | [tests/ci/gate.cjs](../../tests/ci/gate.cjs#L5) |
| SW-AUDIT-013 | [tests/ci/report-equivalence.cjs](../../tests/ci/report-equivalence.cjs#L5) |
| SW-AUDIT-013 | [tests/release/build-images.sh](../../tests/release/build-images.sh#L6) |
| SW-AUDIT-014 | [tests/e2e-isolated.sh](../../tests/e2e-isolated.sh#L6) |
| SW-AUDIT-014 | [tests/playwright.test.cjs](../../tests/playwright.test.cjs#L5) |
| SW-AUDIT-014 | [tests/verify-demo.cjs](../../tests/verify-demo.cjs#L5) |
| SW-AUDIT-015 | [AGENTS.md](../../AGENTS.md#L13) |

## Required actions

- **Decouple or clean up [`docker/php/project.php`](../../docker/php/project.php) (SW-AUDIT-006):** Do not delete this file while Shopware coverage is active—[`docker/php/manifest.php`](../../docker/php/manifest.php#L13) (and [`docker/php/report.php`](../../docker/php/report.php#L10)) require it for the shared `project()` metadata reader (`COVERAGE_PROJECT_FILE` / `/project.json`). Shopware source discovery runs from [`docker/shopware/project.php`](../../docker/shopware/project.php) (mounted as `/tools/project.php`). Remove the legacy Magento `ComponentRegistrar` CLI block ([`docker/php/project.php`](../../docker/php/project.php#L18-L31)) only when retiring its remaining Magento consumers ([`docker/php/install-magento.sh`](../../docker/php/install-magento.sh#L38), [`docker/php/configure-theme.php`](../../docker/php/configure-theme.php#L74), and [`docker/php/project-hooks.php`](../../docker/php/project-hooks.php#L12)), keeping `project()` available to `manifest.php` or moving it into a shared helper.
