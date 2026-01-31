# Code-Executor

Secure, isolated code execution service using Docker with gVisor sandbox and comprehensive monitoring.

## Endpoints

### Core Execution
- **POST /submit** - Submit code for execution
- **GET /result/:id** - Poll job result

### Monitoring & Diagnostics  
- **GET /health** - Health check with Redis connectivity
- **GET /status** - Real-time metrics summary (JSON)
- **GET /metrics** - Prometheus-format metrics

## Quick Start

```bash
# 1. Build Docker images
docker build -f deployment/docker/runner-c.Dockerfile -t runner-c .
docker build -f deployment/docker/runner-py.Dockerfile -t runner-py .
docker build -f deployment/docker/runner-runtime.Dockerfile -t runner-runtime .

# 2. Start Redis (if not running)
redis-server

# 3. Start services
npm install
npm run dev

# 4. Run tests
npm run test

# 5. Check status
curl http://localhost:4000/status
```

## Monitoring Stack

```bash
# Start complete stack: Server, Redis, Prometheus, Grafana
docker-compose -f deployment/docker-compose.monitoring.yml up -d

# Access:
# - Code Executor: http://localhost:4000
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3000 (user: admin, pass: admin)
```

See [docs/MONITORING.md](docs/MONITORING.md) for complete guide.

## Documentation

- **[docs/MONITORING.md](docs/MONITORING.md)** - Metrics, dashboards, alerting
- **[docs/DOCKER.md](docs/DOCKER.md)** - Docker images and security
- **[docs/TESTING.md](docs/TESTING.md)** - Testing procedures
- **[docs/GVISOR_FALLBACK.md](docs/GVISOR_FALLBACK.md)** - gVisor setup

## Features

✅ Secure Docker execution with gVisor sandbox  
✅ Support for Python 3 and C (GCC)  
✅ Resource limits (memory, CPU, processes)  
✅ Queue-based job distribution  
✅ Comprehensive metrics & monitoring  
✅ Prometheus integration  
✅ Grafana dashboards  
✅ Health checks and diagnostics  
✅ Redis-backed job persistence  
✅ Graceful shutdown  
✅ Integration tests
