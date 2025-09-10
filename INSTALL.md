# ChatCVE Installation Guide

This guide provides step-by-step installation instructions for different operating systems.

## 🐳 **Docker-Based Architecture**

ChatCVE uses **Docker** for container scanning - **Docker daemon required**! This provides:
- 🔍 **Complete analysis** - full access to image layers
- 🎯 **Accurate results** - analyzes actual installed packages  
- ⚡ **Reliable detection** - proven Docker + Syft + Grype workflow
- 🛠️ **Industry standard** - uses established container tooling

## 📋 Quick Installation Check

Before starting, run our prerequisites checker:

```bash
./check-prerequisites.sh
```

This will verify all dependencies and guide you through any missing requirements.

## 🐧 Ubuntu/Debian Installation

### 1. Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install System Dependencies (including Docker)
```bash
sudo apt install -y python3 python3-pip python3-venv nodejs npm git sqlite3 curl docker.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (requires logout/login)
sudo usermod -aG docker $USER
```

### 3. Verify Node.js Version
```bash
# Check Node.js version (should be 18+)
node --version

# If Node.js is too old, install latest LTS:
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 4. Clone and Setup ChatCVE
```bash
git clone https://github.com/jasona7/ChatCVE.git
cd ChatCVE

# Create Python virtual environment
python3 -m venv .env
source .env/bin/activate

# Install Python dependencies
pip install flask flask-cors langchain langchain-openai langchain-community

# Install frontend dependencies
cd frontend-next
npm install
cd ..

# Make startup script executable
chmod +x start-chatcve.sh
```

### 5. Start ChatCVE
```bash
./start-chatcve.sh
```

## 🍎 macOS Installation

### 1. Install Homebrew (if not installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Dependencies
```bash
brew install python@3.10 node npm git sqlite
```

### 3. Clone and Setup ChatCVE
```bash
git clone https://github.com/jasona7/ChatCVE.git
cd ChatCVE

# Create Python virtual environment
python3 -m venv .env
source .env/bin/activate

# Install Python dependencies
pip install flask flask-cors langchain langchain-openai langchain-community

# Install frontend dependencies
cd frontend-next
npm install
cd ..

# Make startup script executable
chmod +x start-chatcve.sh
```

### 4. Start ChatCVE
```bash
./start-chatcve.sh
```

## 🐧 CentOS/RHEL/Fedora Installation

### 1. Install System Dependencies
```bash
# For CentOS/RHEL 8+
sudo dnf install -y python3 python3-pip nodejs npm git sqlite

# For older versions, use yum:
# sudo yum install -y python3 python3-pip nodejs npm git sqlite
```

### 2. Install Node.js (if version is too old)
```bash
# Install Node.js 18 LTS
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo dnf install -y nodejs
```

### 3. Clone and Setup ChatCVE
```bash
git clone https://github.com/jasona7/ChatCVE.git
cd ChatCVE

# Create Python virtual environment
python3 -m venv .env
source .env/bin/activate

# Install Python dependencies
pip install flask flask-cors langchain langchain-openai langchain-community

# Install frontend dependencies
cd frontend-next
npm install
cd ..

# Make startup script executable
chmod +x start-chatcve.sh
```

### 4. Start ChatCVE
```bash
./start-chatcve.sh
```

## 🪟 Windows Installation

### 1. Install Prerequisites

**Option A: Using Chocolatey (Recommended)**
```powershell
# Install Chocolatey (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install dependencies
choco install python nodejs git sqlite -y
```

**Option B: Manual Installation**
- Download and install [Python 3.10+](https://www.python.org/downloads/)
- Download and install [Node.js 18+](https://nodejs.org/)
- Download and install [Git](https://git-scm.com/download/win)

### 2. Clone and Setup ChatCVE
```bash
git clone https://github.com/jasona7/ChatCVE.git
cd ChatCVE

# Create Python virtual environment
python -m venv .env
.env\Scripts\activate

# Install Python dependencies
pip install flask flask-cors langchain langchain-openai langchain-community

# Install frontend dependencies
cd frontend-next
npm install
cd ..
```

### 3. Start ChatCVE
```bash
# Windows users: Use the batch file or run commands manually
# Backend (in one terminal)
.env\Scripts\activate
cd api
python flask_backend.py

# Frontend (in another terminal)
cd frontend-next
npm run dev
```

## 🐳 Docker Installation (Alternative)

If you prefer containerized deployment:

### 1. Create Dockerfile
```dockerfile
# This is a sample - you may need to customize
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY frontend-next/package*.json ./
RUN npm ci --only=production

FROM python:3.10-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .
COPY --from=frontend-builder /app/node_modules ./frontend-next/node_modules

EXPOSE 3000 5000

CMD ["./start-chatcve.sh"]
```

### 2. Build and Run
```bash
docker build -t chatcve .
docker run -p 3000:3000 -p 5000:5000 chatcve
```

## 🔧 Post-Installation Configuration

### 1. API Keys (Optional)
Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
NVD_API_KEY=your_nvd_api_key_here
```

### 2. Database Setup
The SQLite database will be created automatically on first run. For existing data:
```bash
# Place your existing app_patrol.db in the root directory
cp /path/to/your/app_patrol.db ./
```

### 3. Firewall Configuration (if needed)
```bash
# Ubuntu/Debian
sudo ufw allow 3000
sudo ufw allow 5000

# CentOS/RHEL
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --reload
```

## ✅ Verification

After installation, verify ChatCVE is working:

1. **Check Prerequisites**: `./check-prerequisites.sh`
2. **Start Services**: `./start-chatcve.sh`
3. **Open Browser**: Navigate to `http://localhost:3000`
4. **Test API**: Visit `http://localhost:5000/health`

## 🆘 Troubleshooting

### Common Issues

**Port Conflicts**
```bash
# Find processes using ports
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:5000 | xargs kill -9
```

**Permission Errors**
```bash
# Fix script permissions
chmod +x start-chatcve.sh
chmod +x check-prerequisites.sh
```

**Python Module Errors**
```bash
# Reinstall in virtual environment
source .env/bin/activate  # Linux/macOS
# or .env\Scripts\activate  # Windows
pip install --upgrade flask flask-cors langchain langchain-openai langchain-community
```

**Node.js Errors**
```bash
# Clear npm cache and reinstall
cd frontend-next
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## 🎯 Next Steps

After successful installation:

1. **Configure API Keys** in Settings (`/settings`)
2. **Run Your First Scan** in Scans (`/scans`)
3. **Explore CVE Database** in CVE Explorer (`/cves`)
4. **Chat with AI** in Chat (`/chat`)

## 📞 Support

If you encounter issues:

1. Run `./check-prerequisites.sh` to diagnose problems
2. Check our [GitHub Issues](https://github.com/jasona7/ChatCVE/issues)
3. Review the main [README.md](README.md) for additional help

Happy scanning! 🛡️

