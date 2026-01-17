#!/bin/bash

# Stop script for Ishikawa Public Version

echo "🛑 Stopping Ishikawa Public Version..."

# Kill frontend (port 5173)
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Stopping frontend (port 5173)..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    echo "✅ Frontend stopped"
else
    echo "⚠️  Frontend not running"
fi

# Kill backend (port 3000)
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Stopping backend (port 3000)..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    echo "✅ Backend stopped"
else
    echo "⚠️  Backend not running"
fi

echo ""
echo "✅ All services stopped"
