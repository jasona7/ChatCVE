#!/bin/bash

# ChatCVE Frontend Setup Script
# This script sets up the new Next.js frontend for ChatCVE

echo "🚀 Setting up ChatCVE Modern Frontend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to frontend directory
cd frontend-next

echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "📝 Created .env.local file. Please configure your environment variables."
fi

echo "🔧 Installing additional required packages..."
npm install @radix-ui/react-scroll-area @radix-ui/react-progress

echo "✅ Frontend setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Configure your .env.local file with the correct API URL"
echo "2. Ensure the Python backend is running on http://localhost:5000"
echo "3. Start the frontend development server:"
echo "   cd frontend-next && npm run dev"
echo ""
echo "🌐 The application will be available at http://localhost:3000"
echo ""
echo "📚 Features included:"
echo "   • Modern dashboard with vulnerability statistics"
echo "   • Enhanced AI chat interface with history management"
echo "   • Advanced CVE explorer with filtering and search"
echo "   • Scan management with real-time progress tracking"
echo "   • Personal workspace for saved queries and bookmarks"
echo "   • Direct database access for power users"
echo ""
echo "🔗 Backend API endpoints:"
echo "   • /api/chat - AI chat interface"
echo "   • /api/dashboard/stats - Dashboard statistics"
echo "   • /api/cves - CVE data with filtering"
echo "   • /api/scans - Scan management"
echo "   • /api/database/query - Direct SQL access"