#!/bin/bash
# Development start script for Video LoRA Manager

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "=========================================="
echo "Video LoRA Manager - Development Mode"
echo "=========================================="

# Check if backend dependencies are installed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "Installing backend dependencies..."
    pip install --break-system-packages -r "$BACKEND_DIR/requirements.txt"
fi

# Check if frontend dependencies are installed
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd "$FRONTEND_DIR" && npm install
fi

# Start backend
echo ""
echo "Starting backend on port 8189..."
cd "$BACKEND_DIR"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8189 --reload &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend dev server
echo "Starting frontend on port 3000..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "Services started:"
echo "  Backend API: http://localhost:8189"
echo "  Frontend:    http://localhost:3000"
echo "=========================================="
echo ""
echo "Press Ctrl+C to stop all services"

# Handle shutdown
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
