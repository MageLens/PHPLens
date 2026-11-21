# Copyright (c)  MageLens
# SPDX-License-Identifier: Elastic-2.0
# License: see LICENSE in the repository root.

# TO DO [SW-AUDIT-003]: Retain the portable PHP ownership layer for prebuilt-image consumers.
# Replace it when the Shopware coverage image and local-user contract are qualified.

ARG PHP_IMAGE
FROM ${PHP_IMAGE}
USER root
# Bind-mounted Magento files must remain editable by the host developer.
ARG APPLICATION_UID=1000
ARG APPLICATION_GID=1000
RUN bash /opt/application/configure-user.sh
USER app:app
RUN php-fpm -tt
