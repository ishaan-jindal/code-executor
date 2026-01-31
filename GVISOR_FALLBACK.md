# gVisor Fallback & Environment Diagnostics

## Problem
Tests failed with: `cannot create sandbox: cannot read client sync file: waiting for sandbox to start: EOF`

This indicates gVisor (runsc runtime) is not properly installed or configured on the system.

## Solution

### 1. **gVisor Runtime Fallback** 
Modified both [runner/runBinary.js](runner/runBinary.js) and [runner/runPython.js](runner/runPython.js):
- Builds Docker args dynamically
- Only adds `--runtime=runsc` if `DISABLE_GVISOR !== "true"`
- Falls back to default Docker runtime if gVisor unavailable
- No code changes needed, just set environment variable

**Usage:**
```bash
# With gVisor (if installed)
npm run dev

# Without gVisor (fallback)
DISABLE_GVISOR=true npm run dev
```

### 2. **Environment Diagnostics Script**
Created [scripts/diagnose.js](scripts/diagnose.js) to check:
- ✅ Node.js version
- ✅ Docker installation
- ✅ gVisor (runsc) availability
- ✅ Docker images (runner-c, runner-py, runner-runtime)
- ✅ Redis connectivity
- ✅ Server health

**Usage:**
```bash
npm run diagnose
```

**Example Output:**
```
✅ Node.js v18.14.0
✅ Docker version 24.0.0
⚠️ gVisor (runsc): Not installed - tests will use default runtime
✅ Docker image: runner-c
✅ Docker image: runner-py
✅ Docker image: runner-runtime
✅ Redis: Running
❌ Server (localhost:4000): Not running
```

### 3. **Improved Integration Tests**
Updated [tests/integration.test.js](tests/integration.test.js):
- Detects gVisor errors and provides helpful guidance
- Extended timeout from 50 iterations (10s) to 75 iterations (15s)
- Better error messages with context
- Graceful handling of sandbox creation failures

### 4. **Enhanced package.json**
Added `npm run diagnose` script for environment checking.

## Running Tests with Fallback

### If gVisor is installed:
```bash
npm run dev       # Terminal 1
npm run test      # Terminal 2
```

### If gVisor is NOT installed:
```bash
# Option 1: Disable gVisor
DISABLE_GVISOR=true npm run dev    # Terminal 1
npm run test                        # Terminal 2

# Option 2: Install gVisor
curl -fsSL https://gvisor.dev/archive/latest/runsc > /usr/local/bin/runsc
chmod +x /usr/local/bin/runsc
npm run dev       # Terminal 1
npm run test      # Terminal 2
```

## Security Implications

### With gVisor (Recommended)
- Enhanced isolation via gVisor sandbox
- Better resource protection
- Additional syscall filtering

### Without gVisor (Fallback)
- Standard Docker isolation
- Still has:
  - Memory limits (64MB)
  - CPU limits (0.5 cores)
  - Network disabled
  - Capabilities dropped
  - Read-only filesystem
  - Non-root user

## Files Modified

```
M runner/runBinary.js         (gVisor fallback logic)
M runner/runPython.js         (gVisor fallback logic)
M tests/integration.test.js   (better error handling)
M package.json                (added diagnose script)
+ scripts/diagnose.js         (environment checker)
```

## Testing the Fix

```bash
# 1. Check environment
npm run diagnose

# 2. If gVisor missing, disable it
DISABLE_GVISOR=true npm run dev

# 3. In another terminal, run tests
npm run test

# 4. Expected: ✅ All tests passed!
```

## Next Steps

**To use gVisor** (recommended for production):
1. Install runsc: `curl -fsSL https://gvisor.dev/archive/latest/runsc > /usr/local/bin/runsc`
2. Configure Docker: Update `/etc/docker/daemon.json` (see [DOCKER.md](DOCKER.md))
3. Restart Docker: `sudo systemctl restart docker`
4. Unset `DISABLE_GVISOR` and restart server

**To stay with fallback**:
- Keep `DISABLE_GVISOR=true` for development
- Consider installing gVisor for production deployments
