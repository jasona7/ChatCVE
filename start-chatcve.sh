#!/bin/bash

# ChatCVE Startup Script
# This script starts both the Flask API backend and Next.js frontend

echo "🚀 Starting ChatCVE..."

# Check if we're in the right directory
if [ ! -f "README.md" ] || ! grep -q "ChatCVE" README.md 2>/dev/null; then
    echo "❌ Please run this script from your ChatCVE directory"
    exit 1
fi

# Quick prerequisites check
echo "🔍 Checking prerequisites..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.10+ first."
    echo "   Run: ./check-prerequisites.sh for detailed setup instructions"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js 18+ first."
    echo "   Run: ./check-prerequisites.sh for detailed setup instructions"
    exit 1
fi

if [ ! -d ".venv" ]; then
    echo "❌ Python virtual environment not found."
    echo "   Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

if [ ! -d "frontend-next/node_modules" ]; then
    echo "❌ Frontend dependencies not installed."
    echo "   Run: cd frontend-next && npm install && cd .."
    exit 1
fi

echo "✅ Prerequisites check passed!"

# Check for required files
if [ ! -d "frontend-next" ]; then
    echo "❌ frontend-next directory not found"
    exit 1
fi

if [ ! -d "api" ]; then
    echo "❌ api directory not found"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo "🛑 Shutting down ChatCVE..."
    jobs -p | xargs -r kill
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

echo "📡 Starting Flask API backend..."
# Activate virtual environment
source .venv/bin/activate
cd api
python3 flask_backend.py &
FLASK_PID=$!

echo "⏳ Waiting for API to start..."
sleep 3

echo "🌐 Starting Next.js frontend..."
cd ../frontend-next
npm run dev &
NEXTJS_PID=$!

echo "✅ ChatCVE is starting up!"
echo ""
echo "📊 Dashboard: http://localhost:3000"
echo "💬 Chat: http://localhost:3000/chat"
echo "🔍 CVE Explorer: http://localhost:3000/cves"
echo "🛡️ Scans: http://localhost:3000/scans"
echo ""
echo "🔧 API Backend: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait
