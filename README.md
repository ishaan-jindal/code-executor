# Code-Executor

Secure, isolated code execution service with JWT authentication, user-based rate limiting, Docker + gVisor sandbox, and comprehensive monitoring.

## Endpoints

### Authentication
- **POST /auth/register** - Register new user
- **POST /auth/login** - Login and get JWT tokens
- **POST /auth/refresh** - Refresh access token
- **GET /auth/me** - Get current user profile
- **POST /auth/api-keys** - Generate API key (JWT required)
- **GET /auth/api-keys** - List API keys
- **DELETE /auth/api-keys/:keyId** - Revoke API key

### Admin (Requires Admin Role)
- **POST /admin/users/:userId/upgrade** - Upgrade user tier
- **GET /admin/users/:userId** - View user details
- **POST /admin/users/:userId/make-admin** - Grant admin role
- **POST /admin/users/:userId/revoke-admin** - Revoke admin role

### Core Execution (Requires Authentication)
- **POST /submit** - Submit code for execution (rate limited by tier)
- **GET /result/:id** - Poll job result (only your jobs)

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

# 3. Configure environment
cp .env.example .env
# Edit .env and set JWT_SECRET to a secure random value

# 4. Start services
npm install
npm run dev

# 5. Seed database with test users (optional)
npm run seed

# 6. Test authentication
npm run test:auth

# 7. Run integration tests
npm run test
```

## Authentication & Usage

### 1. Register a User

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

Response includes `accessToken` (15min) and `refreshToken` (7 days).

### 2. Submit Code with Authentication

```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "language": "python",
    "code": "print(\"Hello, World!\")"
  }'
```

### 3. Rate Limiting

Rate limits based on user tier:
- **free**: 10 requests/minute
- **starter**: 50 requests/minute
- **professional**: 100 requests/minute
- **enterprise**: 500 requests/minute

Headers returned with each authenticated request:
- `X-RateLimit-Limit`: Your tier's limit
- `X-RateLimit-Remaining`: Remaining requests this minute
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Test Users & Admin Access

Run the seeding script to populate the database with test users:

```bash
npm run seed
```

This creates:
- **admin** / AdminPass123! - Admin user (enterprise tier)
- **alice** / AlicePass123! - Free tier user
- **bob** / BobPass123! - Starter tier user
- **charlie** / CharliePass123! - Professional tier user
- **diana** / DianaPass123! - Enterprise tier user

### Admin Operations

With admin credentials, you can:
- Upgrade user tiers
- View user details
- Grant/revoke admin privileges
- View admin statistics

Example:
```bash
# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AdminPass123!"}' | jq '.data.accessToken' -r)

# Upgrade a user to professional tier
curl -X POST http://localhost:4000/admin/users/USER_ID/upgrade \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newTier":"professional"}'
```

See [docs/API.md](docs/API.md) for complete admin API documentation.

---

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

## Project Structure

```
src/
├── api/                    # API layer
│   └── routes/            # Express route handlers (auth, jobs, health)
├── core/                  # Business logic
│   ├── auth/             # User management, JWT utils
│   ├── jobs/             # Job management
│   ├── limits/           # Execution limiting
│   ├── runner/           # Code execution
│   └── workers/          # Worker processes
├── infrastructure/        # Infrastructure concerns
│   ├── logs/            # Logging
│   ├── metrics/         # Metrics collection
│   └── redis/           # Redis client
├── middleware/           # Express middleware (auth, rate limiting, errors)
└── utils/               # Utility functions

config/                   # Configuration files
deployment/              # Docker & orchestration
docs/                    # Documentation
tests/                   # Test suites
```

## Documentation

- **[docs/API.md](docs/API.md)** - Complete API documentation with examples
- **[docs/MONITORING.md](docs/MONITORING.md)** - Metrics, dashboards, alerting
- **[docs/DOCKER.md](docs/DOCKER.md)** - Docker images and security
- **[docs/TESTING.md](docs/TESTING.md)** - Testing procedures

## Features

✅ **Authentication & Authorization**
  - JWT-based authentication (access + refresh tokens)
  - User registration and login
  - Bcrypt password hashing
  - User-based rate limiting by tier

✅ **Security**
  - Docker isolation with gVisor sandbox
  - Resource limits (64MB memory, 0.5 CPU)
  - Seccomp filtering
  - User isolation (users can only access their own jobs)

✅ **Code Execution**
  - Python 3.12 and C (GCC 13) support
  - stdin/stdout/stderr capture
  - Timeout protection (2s default)
  - Queue-based job distribution

✅ **Monitoring & Observability**
  - Comprehensive metrics collection
  - Prometheus integration
  - Grafana dashboards (11 panels)
  - Health checks and diagnostics
  - Request logging with correlation IDs

✅ **Performance & Reliability**
  - Redis-backed persistence
  - Graceful shutdown
  - Rate limiting with sliding window
  - Integration tests
  - Load testing with k6
