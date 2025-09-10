#!/bin/bash

# ChatCVE Prerequisites Checker
# This script verifies that all required dependencies are installed

echo "🔍 ChatCVE Prerequisites Checker"
echo "================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ISSUES=0

# Function to check command existence
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed"
        if [ "$2" != "" ]; then
            VERSION=$($1 $2 2>/dev/null | head -1)
            echo "  Version: $VERSION"
        fi
    else
        echo -e "${RED}✗${NC} $1 is NOT installed"
        ISSUES=$((ISSUES + 1))
    fi
}

# Function to check Python version
check_python_version() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
        MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
        MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
        
        if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 10 ]; then
            echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION (meets requirement: 3.10+)"
        else
            echo -e "${RED}✗${NC} Python $PYTHON_VERSION (requires 3.10+)"
            ISSUES=$((ISSUES + 1))
        fi
    else
        echo -e "${RED}✗${NC} Python 3 is NOT installed"
        ISSUES=$((ISSUES + 1))
    fi
}

# Function to check Node.js version
check_node_version() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | sed 's/v//')
        MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
        
        if [ "$MAJOR" -ge 18 ]; then
            echo -e "${GREEN}✓${NC} Node.js v$NODE_VERSION (meets requirement: 18+)"
        else
            echo -e "${RED}✗${NC} Node.js v$NODE_VERSION (requires 18+)"
            ISSUES=$((ISSUES + 1))
        fi
    else
        echo -e "${RED}✗${NC} Node.js is NOT installed"
        ISSUES=$((ISSUES + 1))
    fi
}

# Function to check virtual environment
check_venv() {
    if [ -d ".env" ]; then
        echo -e "${GREEN}✓${NC} Python virtual environment exists (.env/)"
    else
        echo -e "${YELLOW}!${NC} Python virtual environment not found"
        echo "  Run: python3 -m venv .env"
        ISSUES=$((ISSUES + 1))
    fi
}

# Function to check frontend dependencies
check_frontend_deps() {
    if [ -d "frontend-next/node_modules" ]; then
        echo -e "${GREEN}✓${NC} Frontend dependencies installed"
    else
        echo -e "${YELLOW}!${NC} Frontend dependencies not installed"
        echo "  Run: cd frontend-next && npm install"
        ISSUES=$((ISSUES + 1))
    fi
}

# Function to check ports
check_ports() {
    if lsof -i :3000 &> /dev/null; then
        echo -e "${YELLOW}!${NC} Port 3000 is in use"
        echo "  This may cause conflicts. Consider stopping other services."
    else
        echo -e "${GREEN}✓${NC} Port 3000 is available"
    fi
    
    if lsof -i :5000 &> /dev/null; then
        echo -e "${YELLOW}!${NC} Port 5000 is in use"
        echo "  This may cause conflicts. Consider stopping other services."
    else
        echo -e "${GREEN}✓${NC} Port 5000 is available"
    fi
}

echo "🐍 Python Environment"
echo "--------------------"
check_python_version
check_command "pip" "--version"
check_venv
echo ""

echo "🟢 Node.js Environment"
echo "---------------------"
check_node_version
check_command "npm" "--version"
check_frontend_deps
echo ""

echo "🔧 System Tools"
echo "---------------"
check_command "git" "--version"
check_command "sqlite3" "--version"
check_command "docker" "--version"
echo ""

# Check if Docker daemon is running
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker daemon is running"
    else
        echo -e "${YELLOW}!${NC} Docker is installed but daemon not running"
        echo "  Run: sudo systemctl start docker"
        ISSUES=$((ISSUES + 1))
    fi
fi

echo "🌐 Network Ports"
echo "----------------"
check_ports
echo ""

echo "📁 Project Files"
echo "----------------"
if [ -f "start-chatcve.sh" ]; then
    echo -e "${GREEN}✓${NC} start-chatcve.sh exists"
    if [ -x "start-chatcve.sh" ]; then
        echo -e "${GREEN}✓${NC} start-chatcve.sh is executable"
    else
        echo -e "${YELLOW}!${NC} start-chatcve.sh is not executable"
        echo "  Run: chmod +x start-chatcve.sh"
    fi
else
    echo -e "${RED}✗${NC} start-chatcve.sh not found"
    ISSUES=$((ISSUES + 1))
fi

if [ -f "api/flask_backend.py" ]; then
    echo -e "${GREEN}✓${NC} Flask backend exists"
else
    echo -e "${RED}✗${NC} Flask backend not found"
    ISSUES=$((ISSUES + 1))
fi

if [ -f "frontend-next/package.json" ]; then
    echo -e "${GREEN}✓${NC} Frontend package.json exists"
else
    echo -e "${RED}✗${NC} Frontend package.json not found"
    ISSUES=$((ISSUES + 1))
fi

echo ""
echo "📊 Summary"
echo "----------"

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}🎉 All prerequisites are met! You're ready to run ChatCVE.${NC}"
    echo ""
    echo "To start ChatCVE, run:"
    echo "  ./start-chatcve.sh"
else
    echo -e "${RED}⚠️  Found $ISSUES issue(s) that need to be resolved.${NC}"
    echo ""
    echo "Please fix the issues above, then run this script again."
    echo ""
    echo "Quick setup commands:"
    echo "  # Install Python virtual environment"
    echo "  python3 -m venv .env"
    echo "  source .env/bin/activate"
    echo "  pip install flask flask-cors langchain langchain-openai langchain-community"
    echo ""
    echo "  # Install frontend dependencies"
    echo "  cd frontend-next && npm install && cd .."
    echo ""
    echo "  # Make startup script executable"
    echo "  chmod +x start-chatcve.sh"
fi

echo ""
echo "For more help, see: https://github.com/jasona7/ChatCVE#quick-start"

