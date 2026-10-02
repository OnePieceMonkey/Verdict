# syntax=docker/dockerfile:1.7
# Pinned versions (VER-02). Bump all three values together and record the change.
ARG KOSIT_VALIDATOR_VERSION=1.6.3
ARG XRECHNUNG_CONFIG_VERSION=xrechnung-3.0.2-validator-configuration-2026-08-31

FROM eclipse-temurin:21-jdk AS build
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
COPY src ./src
RUN javac --release 21 -cp lib/validator.jar -d classes $(find src -name '*.java')

FROM eclipse-temurin:21-jre
ARG KOSIT_VALIDATOR_VERSION
ARG XRECHNUNG_CONFIG_VERSION
ENV KOSIT_VALIDATOR_VERSION=${KOSIT_VALIDATOR_VERSION} \
    XRECHNUNG_CONFIG_VERSION=${XRECHNUNG_CONFIG_VERSION} \
    XRECHNUNG_CONFIG_DIR=/opt/xrechnung-config \
    PORT=8081
COPY --from=build /build/lib/validator.jar /opt/verifier/lib/validator.jar
COPY --from=build /build/classes /opt/verifier/classes
COPY --from=build /build/config /opt/xrechnung-config
USER 10001
EXPOSE 8081
CMD ["java", "-XX:MaxRAMPercentage=75", "-cp", "/opt/verifier/classes:/opt/verifier/lib/validator.jar", "app.verdict.verifier.VerifierServer"]
