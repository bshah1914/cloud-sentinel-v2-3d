#!/bin/bash

echo ""
echo "  ============================================="
echo "    CloudSentinel v3.0 - One Click Deployment"
echo "    Enterprise Multi-Cloud Security Platform"
echo "  ============================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "  [ERROR] Docker is not installed!"
    echo "  Install: curl -fsSL https://get.docker.com | sh"
    exit 1
fi
echo "  [OK] Docker found"

# Check Docker running
if ! docker info &> /dev/null; then
    echo "  [ERROR] Docker is not running! Start it with: sudo systemctl start docker"
    exit 1
fi
echo "  [OK] Docker is running"

# Build and deploy
echo ""
echo "  [1/3] Building containers..."
docker-compose build --no-cache
if [ $? -ne 0 ]; then
    echo "  [ERROR] Build failed!"
    exit 1
fi
echo "  [OK] Build complete"

echo ""
echo "  [2/3] Starting CloudSentinel..."
docker-compose up -d
echo "  [OK] Containers started"

echo ""
echo "  [3/3] Waiting for services..."
sleep 5

echo ""
echo "  ============================================="
echo "    CloudSentinel is LIVE!"
echo "  ============================================="
echo ""
echo "    URL:    http://localhost:7001"
echo "    Login:  admin / admin123"
echo ""
echo "    Commands:"
echo "      docker-compose logs -f    View logs"
echo "      docker-compose stop       Stop app"
echo "      docker-compose start      Start app"
echo "      docker-compose down       Remove containers"
echo ""
echo "  ============================================="
