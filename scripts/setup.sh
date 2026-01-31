#!/bin/bash

# Code Executor Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Setting up Code Executor..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi
echo "✅ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis CLI not found - install Redis or use Docker"
else
    echo "✅ Redis CLI available"
fi

# Install dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Check for .env file
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file (edit as needed)"
fi

# Build Docker images
echo ""
echo "🐳 Building Docker images..."
docker build -f deployment/docker/runner-c.Dockerfile -t runner-c . || echo "⚠️  Failed to build runner-c"
docker build -f deployment/docker/runner-py.Dockerfile -t runner-py . || echo "⚠️  Failed to build runner-py"
docker build -f deployment/docker/runner-runtime.Dockerfile -t runner-runtime . || echo "⚠️  Failed to build runner-runtime"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start Redis: redis-server"
echo "  2. Start server: npm run dev"
echo "  3. Run tests: npm test"
echo "  4. Check diagnostics: npm run diagnose"
echo ""
