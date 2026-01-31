FROM python:3.12-alpine

WORKDIR /app

RUN adduser -D runner
USER runner

ENTRYPOINT ["python3"]

# Health check: verify Python is available
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python3 --version || exit 1
