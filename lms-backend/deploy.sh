#!/bin/bash

# Production Deployment Script
set -e

echo "🚀 Starting LMS Backend Deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Pull latest image
echo "📦 Pulling latest Docker image..."
docker-compose -f docker-compose.prod.yml pull

# Stop existing 
echo "🛑 Stopping existing services..."
docker-compose -f docker-compose.prod.yml down

# Start services
echo "🔄 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check health
echo "🏥 Checking service health..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Deployment successful! Services are healthy."
else
    echo "❌ Health check failed. Checking logs..."
    docker-compose -f docker-compose.prod.yml logs --tail=50
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo "🌐 Application is available at: http://localhost"
