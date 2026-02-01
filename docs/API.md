# Code Executor API Documentation

## Overview

The Code Executor provides a secure, isolated environment for executing user-submitted code in multiple languages with full stdin/stdout/stderr capture.

## Base URL

```
http://localhost:4000
```

## Authentication

The API uses JWT (JSON Web Token) authentication. Most endpoints require a valid access token.

### Getting Started

1. **Register**: Create a new user account at `POST /auth/register`
2. **Login**: Get access and refresh tokens at `POST /auth/login`
3. **Use Token**: Include the access token in the `Authorization` header:
   ```
   Authorization: Bearer <your-access-token>
   ```
4. **Refresh Token**: When access token expires (15 minutes), use refresh token at `POST /auth/refresh`

### Rate Limiting

Rate limits are enforced per user based on tier:
- **free**: 10 requests/minute
- **starter**: 50 requests/minute
- **professional**: 100 requests/minute
- **enterprise**: 500 requests/minute

Rate limit headers are included in all authenticated responses:
- `X-RateLimit-Limit`: Maximum requests per minute
- `X-RateLimit-Remaining`: Remaining requests in current minute
- `X-RateLimit-Reset`: Timestamp when the limit resets

---

## Authentication Endpoints

### 1. Register User

**Endpoint:** `POST /auth/register`

**Description:** Create a new user account.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "secure_password123"
}
```

**Validation:**
- `username`: 3+ characters, unique
- `email`: Valid email format, unique
- `password`: 8+ characters

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "tier": "free",
      "rateLimit": 10,
      "created_at": 1738339200000
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400` - Validation failed (missing/invalid fields)
- `409` - Username or email already exists

**cURL Example:**
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

---

### 2. Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticate with username/email and password.

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "secure_password123"
}
```

Or with email:
```json
{
  "email": "john@example.com",
  "password": "secure_password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "tier": "free",
      "rateLimit": 10
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400` - Missing username/email or password
- `401` - Invalid credentials

**cURL Example (with username):**
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "SecurePass123"
  }'
```

**cURL Example (with email):**
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

---

### 3. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Description:** Get a new access token using a refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400` - Missing refresh token
- `401` - Invalid or expired refresh token

**cURL Example:**
```bash
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

### 4. Get Current User

**Endpoint:** `GET /auth/me`

**Description:** Get the authenticated user's profile.

**Request Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "tier": "free",
    "rateLimit": 10,
    "created_at": 1738339200000
  }
}
```

**Error Responses:**
- `401` - Missing or invalid token
- `404` - User not found

**cURL Example:**
```bash
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Code Execution Endpoints

### 5. Health Check

**Endpoint:** `GET /health`

**Description:** Check if the service is healthy and Redis is accessible. No authentication required.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T14:00:00.000Z",
  "uptime": 123.456
}
```

**Status Codes:**
- `200` - Service is healthy
- `503` - Service unavailable (Redis down)

**cURL Example:**
```bash
curl -X GET http://localhost:4000/health
```

---

### 6. Submit Code for Execution

**Endpoint:** `POST /submit`

**Description:** Submit code for execution in an isolated Docker container. Requires authentication.

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "language": "python",
  "code": "print('Hello, World!')",
  "stdin": "optional input"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `language` | string | Yes | Programming language (`python`, `c`) |
| `code` | string | Yes | Source code to execute (max 100KB) |
| `stdin` | string | No | Standard input for the program |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "QUEUED"
  }
}
```

**Example Requests:**

**cURL Examples:**

**Simple Python (no authentication shown, but required):**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "language": "python",
    "code": "print(\"Hello, World!\")"
  }'
```

**Python with stdin:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "language": "python",
    "code": "name = input(\"Enter your name: \")\nprint(f\"Hello, {name}!\")",
    "stdin": "Alice"
  }'
```

**C with stdin:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "language": "c",
    "code": "#include <stdio.h>\nint main() {\n  int x;\n  scanf(\"%d\", &x);\n  printf(\"%d squared = %d\\\\n\", x, x*x);\n  return 0;\n}",
    "stdin": "5"
  }'
```

**Error Responses:**

- `400 Bad Request` - Missing required fields
  ```json
  {
    "success": false,
    "error": "Missing language or code",
    "code": "VALIDATION_ERROR"
  }
  ```

- `413 Payload Too Large` - Code exceeds 100KB
  ```json
  {
    "success": false,
    "error": "Code too large",
    "code": "VALIDATION_ERROR"
  }
  ```

---

### 7. Get Job Result

**Endpoint:** `GET /result/:id`

**Description:** Poll for the result of a submitted job. Users can only access their own jobs. Requires authentication.

**Request Headers:**
```
Authorization: Bearer <access-token>
```

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID returned from /submit endpoint |

**Response:**

**While executing (QUEUED or RUNNING):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "RUNNING"
  }
}
```

**After completion (ACCEPTED):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ACCEPTED",
    "stdout": "Hello, World!\n",
    "stderr": "",
    "exit_code": 0
  }
}
```

**On error (RUNTIME_ERROR):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "RUNTIME_ERROR",
    "stdout": "",
    "stderr": "Traceback (most recent call last):\n  File \"main.py\", line 1, in <module>\n    1/0\nZeroDivisionError: division by zero\n",
    "exit_code": 1
  }
}
```

**Job Status Values:**

| Status | Meaning |
|--------|---------|
| `QUEUED` | Waiting to be executed |
| `RUNNING` | Currently executing |
| `ACCEPTED` | Completed successfully (exit code 0) |
| `RUNTIME_ERROR` | Runtime error or non-zero exit |
| `COMPILE_ERROR` | Compilation failed (C only) |
| `TIME_LIMIT_EXCEEDED` | Execution exceeded timeout (2s default) |
| `SYSTEM_ERROR` | System/infrastructure error |

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Job not found",
  "code": "JOB_NOT_FOUND"
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:4000/result/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Polling for Result (with loop):**
```bash
#!/bin/bash

JOB_ID="550e8400-e29b-41d4-a716-446655440000"
TOKEN="YOUR_ACCESS_TOKEN"

# Poll for 30 seconds
for i in {1..30}; do
  RESULT=$(curl -s -X GET http://localhost:4000/result/$JOB_ID \
    -H "Authorization: Bearer $TOKEN")
  
  STATUS=$(echo $RESULT | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  
  if [[ $STATUS == "ACCEPTED" ]] || [[ $STATUS == "RUNTIME_ERROR" ]]; then
    echo $RESULT | jq .
    break
  fi
  
  echo "Still running... (attempt $i/30)"
  sleep 1
done
```

---

### 4. Prometheus Metrics

**Endpoint:** `GET /metrics`

**Description:** Get application metrics in Prometheus/OpenMetrics format.

**Response:** Text format (Prometheus compatible)
```
# HELP jobs_submitted_total Total jobs submitted
# TYPE jobs_submitted_total counter
jobs_submitted_total{language="python"} 42
jobs_submitted_total{language="c"} 18
...
```

**cURL Example:**
```bash
curl -X GET http://localhost:4000/metrics
```

**cURL Example (with formatting):**
```bash
curl -s http://localhost:4000/metrics | grep -E "^(# |[a-z])"
```

**Usage:**
```bash
curl http://localhost:4000/metrics
```

---

### 5. Status & Metrics Summary

**Endpoint:** `GET /status`

**Description:** Get real-time metrics summary as JSON.

**Response:**
```json
{
  "timestamp": "2026-01-31T14:00:00.000Z",
  "redis": {
    "connected": true
  },
  "submissions": {
    "total": 150,
    "by_language": {
      "python": 100,
      "c": 50
    }
  },
  "queue": {
    "depth": 5,
    "processing": 2
  },
  "performance": {
    "p50": 245,
    "p95": 1200,
    "p99": 1850,
    "avg": 450,
    "min": 50,
    "max": 2000
  },
  "success_rate": 0.98,
  "throughput": 12.5
}
```

---

## Supported Languages

### Python 3.12
- Supports all standard library features
- Security: Runs in Docker with limited resources (64MB memory, 0.5 CPU)
- Timeout: 2 seconds (configurable via `EXEC_TIMEOUT_MS`)

### C (GCC 13)
- Requires explicit compilation step
- Security: Same as Python
- Example:
  ```c
  #include <stdio.h>
  int main() {
    printf("Hello, World!\n");
    return 0;
  }
  ```

---

## Request/Response Examples

### Complete Workflow Example

**1. Submit code:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "import sys\nfor i in range(3):\n  line = input()\n  print(f\"Line {i+1}: {line}\")",
    "stdin": "first\nsecond\nthird"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "status": "QUEUED"
  }
}
```

**2. Poll for result (may need multiple attempts):**
```bash
curl http://localhost:4000/result/abc123
```

**Response (still running):**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "status": "RUNNING"
  }
}
```

**Response (completed):**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "status": "ACCEPTED",
    "stdout": "Line 1: first\nLine 2: second\nLine 3: third\n",
    "stderr": "",
    "exit_code": 0
  }
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created (job submitted)
- `400` - Bad Request (validation error)
- `404` - Not Found (job not found)
- `413` - Payload Too Large (code too large)
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## Rate Limiting

Currently no rate limiting. Implement in production:
- Per-IP rate limits
- Per-API-key quotas
- Queue-based backpressure

---

## Security Considerations

1. **Code Isolation**: All code runs in isolated Docker containers with:
   - 64MB memory limit
   - 0.5 CPU cores limit
   - No network access
   - Read-only filesystem (except /tmp)
   - Dropped privileges (non-root user)
   - gVisor sandbox (if available)

2. **Input Validation**:
   - Code limited to 100KB
   - Language restricted to whitelist (python, c)
   - Stdin size reasonable

3. **Timeouts**:
   - Default 2 seconds per execution
   - Configurable via `EXEC_TIMEOUT_MS`

4. **Output Limits**:
   - Stdout/stderr truncated to prevent memory exhaustion

---

## Configuration

Environment variables:
- `PORT` - Server port (default: 4000)
- `WORKERS` - Number of parallel workers (default: 2)
- `REDIS_URL` - Redis connection URL
- `EXEC_TIMEOUT_MS` - Execution timeout in ms (default: 2000)
- `DISABLE_GVISOR` - Disable gVisor sandbox (default: false)

---

## Monitoring

See [docs/MONITORING.md](../MONITORING.md) for:
- Prometheus metrics setup
- Grafana dashboard configuration
- Alert rules
- Performance metrics

---

## cURL Cheat Sheet

Quick reference for all endpoints with cURL commands.

### Authentication

**Register:**
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "myuser",
    "email": "user@example.com",
    "password": "SecurePass123"
  }' | jq .
```

**Login:**
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "myuser",
    "password": "SecurePass123"
  }' | jq '.data.accessToken' -r
```

**Store token in variable:**
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"SecurePass123"}' \
  | jq '.data.accessToken' -r)

echo "Token: $TOKEN"
```

**Refresh token:**
```bash
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }' | jq .
```

**Get current user profile:**
```bash
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Code Execution

**Health check (no auth needed):**
```bash
curl http://localhost:4000/health | jq .
```

**Simple Python:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "language": "python",
    "code": "print(\"Hello, World!\")"
  }' | jq .
```

**Python with stdin:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "language": "python",
    "code": "name = input(\"Enter name: \")\\nprint(f\"Hello, {name}!\")",
    "stdin": "Alice"
  }' | jq .
```

**C program:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "language": "c",
    "code": "#include <stdio.h>\\nint main() {\\n  printf(\"Hello!\\\\n\");\\n  return 0;\\n}"
  }' | jq .
```

**Get job result:**
```bash
curl -X GET http://localhost:4000/result/YOUR_JOB_ID \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Poll for result (until complete):**
```bash
#!/bin/bash
JOB_ID="$1"
TOKEN="$2"

while true; do
  RESULT=$(curl -s -X GET http://localhost:4000/result/$JOB_ID \
    -H "Authorization: Bearer $TOKEN")
  
  STATUS=$(echo $RESULT | jq '.data.status' -r)
  
  if [[ $STATUS != "QUEUED" && $STATUS != "RUNNING" ]]; then
    echo $RESULT | jq .
    break
  fi
  
  echo "Status: $STATUS (waiting...)"
  sleep 1
done
```

**Metrics (Prometheus):**
```bash
curl http://localhost:4000/metrics | head -20
```

### Complete Workflow Script

```bash
#!/bin/bash

echo "=== Code Executor API Test ==="
echo

# Step 1: Register
echo "1. Registering user..."
REGISTER=$(curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_'$(date +%s)'",
    "email": "test_'$(date +%s)'@example.com",
    "password": "TestPass123"
  }')

TOKEN=$(echo $REGISTER | jq '.data.accessToken' -r)
echo "   Token: ${TOKEN:0:20}..."
echo

# Step 2: Submit code
echo "2. Submitting Python code..."
SUBMIT=$(curl -s -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "language": "python",
    "code": "print(\"Hello from Code Executor!\")"
  }')

JOB_ID=$(echo $SUBMIT | jq '.data.id' -r)
echo "   Job ID: $JOB_ID"
echo

# Step 3: Poll for result
echo "3. Waiting for execution..."
for i in {1..10}; do
  RESULT=$(curl -s -X GET http://localhost:4000/result/$JOB_ID \
    -H "Authorization: Bearer $TOKEN")
  
  STATUS=$(echo $RESULT | jq '.data.status' -r)
  
  if [[ $STATUS == "ACCEPTED" ]]; then
    echo "   Status: $STATUS ✓"
    echo "   Output: $(echo $RESULT | jq '.data.stdout' -r)"
    break
  elif [[ $STATUS == "RUNTIME_ERROR" ]]; then
    echo "   Status: $STATUS ✗"
    echo "   Error: $(echo $RESULT | jq '.data.stderr' -r)"
    break
  else
    echo "   Status: $STATUS (attempt $i/10)"
  fi
  
  sleep 1
done
```

### Using with jq for JSON parsing

**Pretty print response:**
```bash
curl -s http://localhost:4000/health | jq .
```

**Extract specific field:**
```bash
curl -s http://localhost:4000/health | jq '.status'
```

**Extract nested field:**
```bash
curl -s http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.data.username'
```

**Extract array:**
```bash
curl -s http://localhost:4000/metrics | jq -s .
```

### Useful curl options

```bash
# Save response to file
curl ... -o response.json

# Follow redirects
curl -L ...

# Include response headers
curl -i ...

# Verbose (show request/response details)
curl -v ...

# Add custom header
curl -H "Custom-Header: value" ...

# Add authentication
curl -H "Authorization: Bearer TOKEN" ...

# Data from file
curl -d @data.json ...

# Timeout (seconds)
curl --max-time 5 ...

# Show only response headers
curl -I ...
```

---

**Last Updated:** February 1, 2026
