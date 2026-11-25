# Copyright (c)  MageLens
# SPDX-License-Identifier: Elastic-2.0
# License: see LICENSE in the repository root.

ARG SHOPWARE_IMAGE
FROM ${SHOPWARE_IMAGE}
USER root
ARG PCOV_VERSION
ARG PCOV_SOURCE_SHA256
RUN curl -fsSL --retry 4 "https://codeload.github.com/VitaliyBoyko/pcov/tar.gz/refs/tags/v${PCOV_VERSION}" -o /tmp/pcov.tar.gz \
    && echo "${PCOV_SOURCE_SHA256}  /tmp/pcov.tar.gz" | sha256sum -c \
    && mkdir -p /opt/pcov-source /opt/pcov-tools \
    && tar xzf /tmp/pcov.tar.gz --strip-components=1 -C /opt/pcov-source \
    && cp /opt/pcov-source/tools/* /opt/pcov-tools/ \
    && apk add --no-cache --virtual .pcov-build-deps $PHPIZE_DEPS \
    && cd /opt/pcov-source && phpize && ./configure --enable-pcov && make -j2 && make install \
    && docker-php-ext-enable pcov \
    && php -r 'if (phpversion("pcov") !== $argv[1] || !function_exists("pcov\\export") || extension_loaded("xdebug")) exit(1);' "$PCOV_VERSION" \
    && apk del .pcov-build-deps \
    && rm -rf /tmp/pcov.tar.gz /opt/pcov-source
WORKDIR /opt/report
COPY docker/php/composer.json docker/php/composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress
COPY docker/shopware/coverage.ini /usr/local/etc/php/conf.d/zz-coverage.ini
RUN printf '[www]\nphp_admin_value[auto_prepend_file] = /application/docker/php/collect.php\n' > /usr/local/etc/php-fpm.d/zz-coverage.conf
WORKDIR /var/www/html
