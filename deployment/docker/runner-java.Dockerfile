FROM eclipse-temurin:21-jdk-alpine

WORKDIR /app

RUN adduser -D runner
USER runner

CMD []

# Health check: verify Java is available
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD java --version || exit 1
