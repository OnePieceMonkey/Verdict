# syntax=docker/dockerfile:1.7
# Hugging Face Space image: the Next.js app and the KoSIT verifier in one container.
# The verifier listens on localhost only; the Space exposes nothing but the app port (7860).
# Verifier pins must match services/verifier/Dockerfile (deploy/hf-space/push.sh checks this).
ARG KOSIT_VALIDATOR_VERSION=1.6.3
ARG XRECHNUNG_CONFIG_VERSION=xrechnung-3.0.2-validator-configuration-2026-08-31

FROM eclipse-temurin:21-jdk AS verifier
ARG KOSIT_VALIDATOR_VERSION
ARG XRECHNUNG_CONFIG_VERSION
WORKDIR /build
ADD --chmod=644 --checksum=sha256:799e64befca97d4080e03608c80b85dd5a5ecc5f4ae4f35d1116ec2855b9a7c9 \
    https://github.com/itplr-kosit/validator/releases/download/v${KOSIT_VALIDATOR_VERSION}/validator-${KOSIT_VALIDATOR_VERSION}-standalone.jar \
    lib/validator.jar
ADD --checksum=sha256:2530cd107c414511c5d0462ec10f886910395abfca820db82e83d70bf01221a8 \
    https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/${XRECHNUNG_CONFIG_VERSION}.zip \
    config.zip
RUN mkdir config && cd config && jar xf ../config.zip
COPY services/verifier/src ./src
RUN javac --release 21 -cp lib/validator.jar -d classes $(find src -name '*.java')

FROM node:22-bookworm-slim AS web
ENV CI=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY . .
# --ignore-scripts: the root "prepare" hook needs git, and the web build needs no install scripts.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @verdict/web... \
 && node apps/web/scripts/copy-pdf-worker.mjs \
 && pnpm --filter @verdict/web exec next build \
 && cp -r apps/web/public apps/web/.next/standalone/apps/web/public \
 && mkdir -p apps/web/.next/standalone/apps/web/.next \
 && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static

FROM eclipse-temurin:21-jre
ARG KOSIT_VALIDATOR_VERSION
ARG XRECHNUNG_CONFIG_VERSION
ENV KOSIT_VALIDATOR_VERSION=${KOSIT_VALIDATOR_VERSION} \
    XRECHNUNG_CONFIG_VERSION=${XRECHNUNG_CONFIG_VERSION} \
    XRECHNUNG_CONFIG_DIR=/opt/xrechnung-config \
    NODE_ENV=production \
    DAILY_BUDGET_USD=0.50 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=verifier /build/lib/validator.jar /opt/verifier/lib/validator.jar
COPY --from=verifier /build/classes /opt/verifier/classes
COPY --from=verifier /build/config /opt/xrechnung-config
COPY --from=web /repo/apps/web/.next/standalone /app
COPY --chmod=755 deploy/hf-space/start.sh /usr/local/bin/start-verdict
# Spaces run the container as uid 1000.
USER 1000
WORKDIR /app/apps/web
EXPOSE 7860
CMD ["/usr/local/bin/start-verdict"]
