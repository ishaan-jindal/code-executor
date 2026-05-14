#!/bin/bash

# Build all Docker images for the Code Executor
set -e

echo "🐳 Building Docker images for Code Executor..."
echo ""

# Build C compiler image
echo "Building runner-c (GCC compiler)..."
docker build -f deployment/docker/runner-c.Dockerfile -t runner-c .
echo "✅ runner-c built"
echo ""

# Build Python image
echo "Building runner-py (Python 3.12)..."
docker build -f deployment/docker/runner-py.Dockerfile -t runner-py .
echo "✅ runner-py built"
echo ""

# Build runtime image
echo "Building runner-runtime (Execution environment)..."
docker build -f deployment/docker/runner-runtime.Dockerfile -t runner-runtime .
echo "✅ runner-runtime built"
echo ""

# Build Java image
echo "Building runner-java (Java 21)..."
docker build -f deployment/docker/runner-java.Dockerfile -t runner-java .
echo "✅ runner-java built"
echo ""

echo "🎉 All Docker images built successfully!"
echo ""
echo "Images:"
docker images | grep -E "runner-(c|py|runtime)|REPOSITORY"
