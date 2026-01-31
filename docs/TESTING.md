# Testing Guide

This guide explains how to test the code executor locally and in CI/CD.

## Prerequisites

- Node.js 18+
- Docker with gVisor runtime (runsc)
- Redis server running on `localhost:6379`
- Built Docker images: `runner-c`, `runner-py`, `runner-runtime`

## Local Testing

### 1. Start Services

```bash
# Terminal 1: Start Redis (if not running as daemon)
redis-server

# Terminal 2: Start the server
npm run dev
```

Expected output:
```
[2026-01-31T07:12:47.470Z] [INFO] [REQ:-] [JOB:-] server started on port 4000
[WORKER 1] started
[WORKER 2] started
[REDIS] connected
[REDIS-BLOCKING] connected
```

### 2. Run Integration Tests

In a new terminal:
```bash
npm run test
```

Expected result:
```
🧪 Starting integration tests...

✓ Test 1: Health Check
  Status: healthy

✓ Test 2: Submit Python Code
  Job ID: <uuid>

✓ Test 3: Poll Job Status (Queued)
  Status: QUEUED

✓ Test 4: Wait for Execution (max 10 seconds)
  Status: ACCEPTED
  Output: Hello, World!

✓ Test 5: Submit C Code
  C Job ID: <uuid>

✓ Test 6: Wait for C Execution
  Status: ACCEPTED
  Output: C works!

✓ Test 7: Invalid Job ID
  Status Code: 404

✓ Test 8: Missing Language/Code
  Status Code: 400

✓ Test 9: Code Too Large
  Status Code: 413

✓ Test 10: Runtime Error
  Status: RUNTIME_ERROR
  Error: ZeroDivisionError: division by zero

✅ All tests passed!
```

### 3. Manual Testing with cURL

Submit a job:
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(2 + 2)",
    "stdin": ""
  }'
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "QUEUED"
}
```

Poll result:
```bash
curl http://localhost:4000/result/550e8400-e29b-41d4-a716-446655440000
```

Response (pending):
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "RUNNING"
}
```

Response (completed):
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ACCEPTED",
  "stdout": "4\n",
  "stderr": "",
  "exit_code": 0
}
```

Check health:
```bash
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T07:12:47.470Z",
  "uptime": 123.456
}
```

## Test Scenarios

### Scenario 1: Simple Python
```python
print("Hello, World!")
```
Expected: `ACCEPTED` with output "Hello, World!"

### Scenario 2: Python with Input
```python
import sys
name = sys.stdin.read().strip()
print(f"Hello, {name}!")
```
Submit with stdin: `"Alice"`
Expected: `ACCEPTED` with output "Hello, Alice!"

### Scenario 3: C Program
```c
#include <stdio.h>
int main() {
    for (int i = 1; i <= 5; i++) {
        printf("%d\n", i);
    }
    return 0;
}
```
Expected: `ACCEPTED` with output "1\n2\n3\n4\n5\n"

### Scenario 4: Timeout
```python
while True:
    pass
```
Expected: `TIME_LIMIT_EXCEEDED` (after ~2 seconds)

### Scenario 5: Compilation Error
```c
#include <stdio.h>
int main() {
    printf("Missing semicolon")
    return 0;
}
```
Expected: `COMPILE_ERROR` with GCC error message

### Scenario 6: Runtime Error
```python
1 / 0
```
Expected: `RUNTIME_ERROR` with ZeroDivisionError

### Scenario 7: Large Output
```python
for i in range(50000):
    print("x" * 100)
```
Expected: `ACCEPTED` with output truncated at 100KB

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:latest
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Docker images
        run: |
          docker build -f docker/runner-c.Dockerfile -t runner-c .
          docker build -f docker/runner-py.Dockerfile -t runner-py .
          docker build -f docker/runner-runtime.Dockerfile -t runner-runtime .
      
      - name: Start server
        run: npm run dev &
        env:
          REDIS_URL: redis://localhost:6379
      
      - name: Wait for server
        run: sleep 2
      
      - name: Run tests
        run: npm run test
```

## Debugging

### Check if server is running
```bash
curl http://localhost:4000/health
```

### Check Redis connection
```bash
redis-cli ping
```

### View server logs
```bash
# With npm run dev, logs print to stdout
# With npm start in background, check system logs
journalctl -u code-executor -f
```

### Check worker logs
```bash
# Workers log to console
# Look for [WORKER X] messages
```

### Test Docker images directly
```bash
# Test Python runner
docker run --rm -it runner-runtime python3 -c "print('works')"

# Test C runner
echo 'int main() { return 0; }' > test.c
docker run --rm -v $PWD:/app runner-c gcc /app/test.c
```

### Test with gVisor directly
```bash
docker run --runtime=runsc --rm -it runner-runtime python3 -c "print('works')"
```

## Performance Baselines

Expected timings (on modern hardware):
- Python job execution: 100-500ms
- C compilation: 200-800ms
- C execution: 100-500ms
- Job polling: <5ms

## Troubleshooting

### Tests hang on execution
- Check if Docker can run containers: `docker run --rm alpine echo test`
- Check if gVisor is installed: `runsc --version`
- Check worker logs for errors

### Tests fail on timeout
- Increase timeout in test file (currently 10 seconds)
- Check system load: `top`
- Check Docker daemon status: `docker stats`

### Connection refused errors
- Verify server is running: `curl http://localhost:4000/health`
- Check port is not in use: `lsof -i :4000`
- Verify Redis is running: `redis-cli ping`
