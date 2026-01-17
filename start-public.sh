#!/bin/bash

# Start script for Ishikawa Public Version
# No AI integration - just OSINT data visualization

set -e

echo "🌍 Starting Ishikawa Public Version..."
echo "======================================"
echo ""

# Check if backend is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Backend already running on port 3000"
else
    echo "🔄 Starting backend (incident aggregation)..."
    cd backend
    npm run dev > /tmp/ishikawa-public-backend.log 2>&1 &
    BACKEND_PID=$!
    echo "✅ Backend started (PID: $BACKEND_PID, log: /tmp/ishikawa-public-backend.log)"
    cd ..
fi

# Check if frontend is already running
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Frontend already running on port 5173"
else
    echo "🔄 Starting frontend..."
    npm run dev > /tmp/ishikawa-public-frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "✅ Frontend started (PID: $FRONTEND_PID, log: /tmp/ishikawa-public-frontend.log)"
fi

echo ""
echo "======================================"
echo "✅ Ishikawa Public Version is running!"
echo "======================================"
echo ""
echo "🌐 Frontend: http://localhost:5173"
echo "🔌 Backend API: http://localhost:3000/api/incidents"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/ishikawa-public-backend.log"
echo "   Frontend: tail -f /tmp/ishikawa-public-frontend.log"
echo ""
echo "🛑 To stop: ./stop-public.sh"
echo ""
