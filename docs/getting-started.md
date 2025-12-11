# Getting Started

This guide walks you through installing and running ChatCVE for the first time.

## Prerequisites

- **Docker** and **Docker Compose** (recommended)
- **OpenAI API Key** (for AI chat features)
- **NVD API Key** (optional, increases rate limits for CVE lookups)

### Without Docker (Local Development)

- Python 3.10+
- Node.js 18+
- Syft and Grype (vulnerability scanning tools)

## Installation

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/jasona7/ChatCVE.git
cd ChatCVE

# Set environment variables
export OPENAI_API_KEY=your_openai_key_here

# Start all services
docker-compose up --build -d
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### Option 2: Local Development

```bash
# Clone and enter directory
git clone https://github.com/jasona7/ChatCVE.git
cd ChatCVE

# Set up Python environment
python3 -m venv .env
source .env/bin/activate
pip install -r requirements.txt

# Install frontend dependencies
cd frontend-next && npm install && cd ..

# Install scanning tools
./install-scan-tools.sh

# Set environment variables
export OPENAI_API_KEY=your_openai_key_here

# Start both services
./start-chatcve.sh
```

## First-Time Setup

When you first visit ChatCVE, you'll be guided through creating an admin account.

### Step 1: Open the Application

Navigate to http://localhost:3000 in your browser.

### Step 2: Create Admin Account

You'll be automatically redirected to the setup page (`/setup`).

Enter:
- **Username**: Minimum 3 characters
- **Password**: Minimum 8 characters
- **Confirm Password**: Must match

### Step 3: Start Using ChatCVE

After creating your admin account, you'll be logged in and redirected to the dashboard.

From here you can:
- View vulnerability statistics
- Start container image scans
- Use the AI chat to query your data
- Create additional user accounts

## Verifying Installation

### Check Services Are Running

```bash
# Docker
docker-compose ps

# Expected output:
# NAME               STATUS
# chatcve-backend    Up (healthy)
# chatcve-frontend   Up (healthy)
```

### Check API Health

```bash
curl http://localhost:5000/api/stats/vulnerabilities
```

### Check Setup Status

```bash
curl http://localhost:5000/api/auth/check-setup
# Returns: {"setupComplete": true} after admin creation
```

## Next Steps

- [User Guide](./user-guide.md) - Learn how to scan images and use AI chat
- [Authentication](./authentication.md) - Set up additional users
- [Configuration](./configuration.md) - Customize settings
