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

