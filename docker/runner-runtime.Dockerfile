FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    libstdc++6 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m runner

USER runner

CMD []

# Health check: verify the container can execute basic operations
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python3 -c "print('healthy')" || exit 1
