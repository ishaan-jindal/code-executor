# Testing Guide

## Overview

The Code Executor includes comprehensive test suites covering unit tests, integration tests, and load tests.

## Test Structure

```
tests/
├── unit/                      # Unit tests for individual modules
│   ├── metrics.test.ts        # Metrics collection tests
│   ├── webhooks.test.ts       # Webhook store tests
│   ├── language-registry.test.ts  # Language metadata tests
│   └── apikey.test.ts         # API key generation/validation tests
├── integration/               # End-to-end API tests
│   ├── integration.test.ts    # Core functionality tests
│   ├── auth.test.ts           # Authentication flow tests
│   └── advanced-features.test.ts  # Code retrieval, webhooks, language info
└── run-all.ts                 # Test runner script
```

## Running Tests

### Prerequisites

1. **Start Redis:**
   ```bash
   redis-server
   ```

2. **Start the server:**
   ```bash
   npm run dev
   ```

### Run All Tests

```bash
npm test
```

This runs all unit tests followed by all integration tests.

### Run Pure Unit Tests (No Dependencies)

```bash
npm run test:unit:pure
```
These tests use the built-in `node:test` runner and do not require Redis or a running server. They cover core logic like configuration, metrics calculations, API response formatting, and error handling.

### Run Redis-Dependent Unit Tests

```bash
npm run test:unit
```

Individual unit tests:
```bash
npm run test:unit:metrics      # Metrics collection
npm run test:unit:webhooks     # Webhook store
npm run test:unit:language     # Language registry
npm run test:unit:apikey       # API key management
```

### Run Integration Tests Only

```bash
npm run test:integration
```

**Note:** Integration tests automatically create test users and authenticate.

Individual integration tests:
```bash
npm run test:integration:main      # Core API functionality
npm run test:integration:auth      # Authentication flows
npm run test:integration:advanced  # Advanced features (auto-creates API key)
```

You can also provide your own API key to the advanced features test:
```bash
node tests/integration/advanced-features.test.ts sk_live_your_key_here
```

### Run Specific Test File

```bash
node tests/unit/webhooks.test.ts
node tests/integration/auth.test.ts
```

## Test Suites

### Unit Tests

#### Metrics Tests
- Tests Prometheus metrics collection
- Validates job submission/completion metrics
- Checks metrics endpoint format

#### Webhooks Tests
- Webhook CRUD operations
- Delivery tracking
- Failed attempt handling
- Auto-disable after failures
- Invalid URL rejection

#### Language Registry Tests
- Language metadata retrieval
- Alias resolution (py→python, gcc→c)
- Feature flag validation
- Compiler flags for C

#### API Key Tests
- Key generation (sk_live_ format)
- Key validation and hashing
- Revocation
- last_used timestamp updates
- Cross-user protection

### Integration Tests

#### Core Integration Tests
- User registration and login
- JWT token refresh
- Code submission (Python, C)
- Job result retrieval
- Rate limiting
- Error handling

#### Auth Integration Tests
- Complete authentication flow
- JWT access/refresh tokens
- API key generation
- Hybrid authentication (JWT + API keys)
- Token expiration
- Tier-based rate limits

#### Advanced Features Tests
- Language info endpoints
- Code retrieval from jobs
- Job search/filtering
- Webhook registration
- Webhook deliveries
- Webhook deletion

## Load Testing

Load tests use k6 (install separately):

```bash
npm run load:test
```

## Test Coverage

### What's Tested

✅ Authentication (JWT + API keys)
✅ Authorization (role-based access)
✅ Rate limiting (per-tier)
✅ Code execution (Python, C)
✅ Job queue and status
✅ Metrics collection
✅ Webhook delivery
✅ Language metadata
✅ API key management
✅ Error handling

### What's Not Tested

- Docker container isolation (requires Docker)
- gVisor runtime (requires gVisor setup)
- Concurrent load (use k6 for this)
- Redis failure scenarios
- Network timeouts

## Writing New Tests

### Unit Test Template

```javascript
#!/usr/bin/env node

import { redis } from "../../src/infrastructure/redis/redisClient.js";

async function cleanup() {
  // Clean up test data
}

async function runTests() {
  console.log("🧪 My Unit Tests\n");

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    await cleanup();

    // Test 1
    console.log("Test 1: Description");
    // ... test logic
    if (/* success condition */) {
      console.log("✓ Test passed\n");
      testsPassed++;
    } else {
      console.log("✗ Test failed\n");
      testsFailed++;
    }

    await cleanup();

    console.log("\n" + "=".repeat(50));
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsFailed}`);
    console.log("=".repeat(50));

    process.exit(testsFailed > 0 ? 1 : 0);
  } catch (err) {
    console.error("\n❌ Test suite error:", err.message);
    await cleanup();
    process.exit(1);
  }
}

runTests();
```

### Integration Test Template

```javascript
#!/usr/bin/env node

import http from "http";

const BASE_URL = "http://localhost:4000";

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          body: JSON.parse(data),
        });
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log("🧪 My Integration Tests\n");

  try {
    // Test API endpoints
    const res = await makeRequest("GET", "/health");
    console.log("✓ Test passed");

    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  }
}

runTests();
```

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm install
      - run: npm start &
      - run: sleep 5
      - run: npm test
```

## Debugging Tests

### Verbose Output

Add console.log statements in tests to see intermediate values.

### Run Single Test

```bash
node tests/unit/webhooks.test.ts
```

### Check Server Logs

Tests require the server running. Check server output for errors.

### Inspect Redis

```bash
redis-cli
> KEYS *
> GET webhook:wh_123...
```

## Test Data

Tests create temporary data with specific prefixes:
- `test-user-webhook-*` - Webhook test users
- `test-user-apikey-*` - API key test users
- `testuser_*` - Auth test users

All test data is cleaned up after tests complete.

## Performance

Typical test run times:
- Unit tests: ~5-10 seconds
- Integration tests: ~15-30 seconds
- Load tests: ~1-5 minutes (depending on config)

## Troubleshooting

**Tests fail with "Connection refused"**
- Ensure server is running on port 4000
- Check `npm run dev` is active

**Tests fail with "Redis connection error"**
- Ensure Redis is running on port 6379
- Check `redis-cli ping` returns PONG

**Auth tests fail**
- Clear Redis: `redis-cli FLUSHDB`
- Restart server

**Rate limit tests fail**
- Wait 60 seconds between test runs
- Redis keys expire after 1 minute

**Webhook tests timeout**
- Check network connectivity
- Webhook deliveries to httpbin.org may be slow
