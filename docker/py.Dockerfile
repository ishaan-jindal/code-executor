FROM python:3.12-alpine
WORKDIR /app
RUN adduser -D runner
USER runner
CMD ["python", "main.py"]

