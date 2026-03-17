#!/bin/bash

# Development startup script
set -e

echo "🚀 Starting LMS Backend Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose exec lms-backend npm run db:sync

# Show service status
echo "📊 Service status:"
docker-compose ps

echo "✅ Development environment is ready!"
echo "🌐 Backend API: http://localhost:3000"
echo "🗄️ Database: localhost:3306"
echo "🔴 Redis: localhost:6379"
echo "🌐 Nginx: http://localhost"
echo ""
echo "📋 Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Access backend: docker-compose exec lms-backend bash"
