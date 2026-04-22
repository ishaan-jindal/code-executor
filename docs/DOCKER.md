# Docker Images Documentation

This document describes how to build and manage the Docker images used by the code executor.

## Available Images

### 1. `runner-c` (C Compilation Environment)
Dockerfile: `docker/runner-c.Dockerfile`

**Purpose**: Compiles C code using GCC with optimization flags
**Base**: Alpine Linux
**Key packages**: gcc, musl-dev
**Build command**:
```bash
docker build -f docker/runner-c.Dockerfile -t runner-c .
```

### 2. `runner-py` (Python Runtime)
Dockerfile: `docker/runner-py.Dockerfile`

**Purpose**: Executes Python 3 code
**Base**: Alpine Linux with Python 3
**Key packages**: python3
**Build command**:
```bash
docker build -f docker/runner-py.Dockerfile -t runner-py .
```

### 3. `runner-runtime` (Execution Runtime)
Dockerfile: `docker/runner-runtime.Dockerfile`

**Purpose**: Final execution environment for compiled binaries and Python scripts
**Base**: Alpine Linux with gVisor support
**Key features**: Non-root user, minimal attack surface, seccomp support
**Build command**:
```bash
docker build -f docker/runner-runtime.Dockerfile -t runner-runtime .
```

## Building All Images

```bash
# Build all images at once
docker build -f docker/runner-c.Dockerfile -t runner-c .
docker build -f docker/runner-py.Dockerfile -t runner-py .
docker build -f docker/runner-runtime.Dockerfile -t runner-runtime .
```

## Runtime Requirements

### gVisor
The executor uses gVisor (`runsc` runtime) for enhanced container isolation:

```bash
# Install runsc on Linux
curl -fsSL https://gvisor.dev/archive/latest/runsc > /usr/local/bin/runsc
chmod +x /usr/local/bin/runsc

# Verify installation
runsc --version
```

If `runsc` is properly registered with Docker, the code executor will detect it on startup automatically using `docker info`. If you wish to disable gVisor despite having it installed, you can set `DISABLE_GVISOR=true` in your `.env` file.

### Docker Configuration
Ensure Docker daemon can use gVisor runtime by configuring `/etc/docker/daemon.json`:

```json
{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc"
    }
  }
}
```

Restart Docker: `sudo systemctl restart docker`

### Seccomp Profile
The executor includes a seccomp profile at `seccomp-runtime.json` for syscall filtering. Ensure this file exists in the project root.

## Security Considerations

1. **Minimal Images**: All images use Alpine Linux to minimize attack surface
2. **Non-root User**: Execution runs as `runner` user, not root
3. **Read-only Filesystem**: `/` is read-only except for `/tmp`
4. **No Network**: `--network=none` for all containers
5. **Dropped Capabilities**: All Linux capabilities are dropped
6. **Resource Limits**:
   - Memory: 64MB
   - CPU: 0.5 cores
   - Processes: 32

## Customization

### Adding New Languages

1. Create new Dockerfile in `docker/runner-<lang>.Dockerfile`
2. Use Alpine Linux base
3. Install language runtime/compiler
4. Copy to `runner-runtime` for execution
5. Add handler in `runner/run<Lang>.js`
6. Update `runner/runCode.js` to dispatch to new runner

Example template:
```dockerfile
FROM alpine:latest

RUN apk add --no-cache <language-packages>

WORKDIR /app
```

Edit the centralized limits in `src/config/index.js` under the `sandbox` section, which applies to all runners automatically:
```javascript
  sandbox: Object.freeze({
    memoryLimit: "64m",
    cpuLimit: "0.5",
    pidsLimit: "32",
    // ...
  }),
```

## Troubleshooting

### Image Build Failures
```bash
# Check Docker logs
docker build --progress=plain -f docker/runner-c.Dockerfile -t runner-c .

# Verify base image availability
docker pull alpine:latest
```

### gVisor Runtime Errors
```bash
# Verify runsc is available
which runsc
runsc --version

# Check Docker daemon logs
journalctl -u docker -n 50
```

### Execution Failures
```bash
# Test image directly
docker run --rm -it runner-runtime /bin/sh

# Test with explicit runtime
docker run --runtime=runsc --rm alpine echo "test"
```

## Maintenance

### Image Updates
Regularly rebuild images to include security patches:

```bash
# Update base images
docker pull alpine:latest

# Rebuild all images
docker build --no-cache -f docker/runner-c.Dockerfile -t runner-c .
docker build --no-cache -f docker/runner-py.Dockerfile -t runner-py .
docker build --no-cache -f docker/runner-runtime.Dockerfile -t runner-runtime .
```

### Image Size Optimization
Current image sizes:
- `runner-c`: ~200MB
- `runner-py`: ~150MB
- `runner-runtime`: ~10MB

Optimize with:
1. Multi-stage builds
2. Alpine Linux (already used)
3. Minimal package installations
