# Code Executor API Documentation

## Overview

The Code Executor provides a secure, isolated environment for executing user-submitted code in multiple languages with full stdin/stdout/stderr capture.

## Base URL

```
http://localhost:4000
```

## Authentication

Currently no authentication required. In production, implement API key or JWT authentication.

## Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Description:** Check if the service is healthy and Redis is accessible.

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

---

### 2. Submit Code for Execution

**Endpoint:** `POST /submit`

**Description:** Submit code for execution in an isolated Docker container.

**Request Headers:**
```
Content-Type: application/json
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

**Python with stdin:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
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

### 3. Get Job Result

**Endpoint:** `GET /result/:id`

**Description:** Poll for the result of a submitted job.

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

**Last Updated:** January 31, 2026
