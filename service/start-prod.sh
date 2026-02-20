#!/bin/bash
# Production start script for Video LoRA Manager
# Serves frontend from static build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "=========================================="
echo "Video LoRA Manager - Production Mode"
echo "=========================================="

# Build frontend if not already built
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo "Building frontend..."
    cd "$FRONTEND_DIR"
    npm install
    npm run build
fi

# Copy frontend build to backend static directory
echo "Copying frontend build..."
rm -rf "$BACKEND_DIR/static"
cp -r "$FRONTEND_DIR/dist" "$BACKEND_DIR/static"

# Start backend (serves both API and static files)
echo ""
echo "Starting server on port 8189..."
cd "$BACKEND_DIR"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8189

