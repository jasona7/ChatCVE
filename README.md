# ChatCVE - AI-Powered DevSecOps Vulnerability Management

![Status](https://img.shields.io/badge/Status-Active-green) ![Python](https://img.shields.io/badge/Python-3.10+-blue) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![License](https://img.shields.io/badge/License-MIT-yellow)

ChatCVE is an open-source AI-powered DevSecOps platform that helps security teams triage, analyze, and manage container image vulnerabilities. It scans images directly from container registries with Syft + Grype, and ships a streaming AI security analyst — powered by your choice of LLM (OpenAI, Azure OpenAI, Anthropic, Bedrock, Gemini, or local models via Ollama) — that answers questions about your scan data in plain English.

## 📊 Dashboard

![ChatCVE Dashboard](screenshots/chatcve_dashboard_1.jpg)

## ✨ Features

- **Streaming AI Security Analyst** - Tool-calling SQL agent (LangChain) that queries your scan database and streams answers in real time, rendered as Markdown with tables
- **Bring Your Own LLM** - OpenAI, Azure OpenAI, Anthropic, AWS Bedrock, Google Gemini, or fully offline via Ollama
- **Registry-Direct Scanning** - Scans images straight from Docker Hub, ECR Public, GCR and other registries via Syft (SBOM) + Grype (CVE matching) — no local Docker required
- **Interactive Dashboard** - Real-time security metrics with auto-refresh, weighted risk scores, and exploitable CVE detection
- **CVE Explorer & Scan Management** - Searchable CVE database, scan bundling, live progress/logs, bulk operations, and JSON export
- **Multi-Source Input** - Type image references or upload text files with one image per line
- **User Authentication** - JWT-based auth with role-based access control
- **External Integrations** - GitHub Advisory Database and NVD API support

## 🚀 Quick Start

### Option A: Docker (Recommended)

```bash
git clone https://github.com/jasona7/ChatCVE.git
cd ChatCVE
export OPENAI_API_KEY="your_openai_api_key_here"
docker-compose up --build
```

Access ChatCVE at http://localhost:3000. Docker deployment automatically installs Syft, Grype, and all dependencies.

### Option B: Manual Installation

Requires **Python 3.10+**, **Node.js 18+**, and optionally Docker (for containerized deployment only — not needed for scanning).

```bash
git clone https://github.com/jasona7/ChatCVE.git
cd ChatCVE

# Backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend-next && npm install && cd ..

# Scanning tools (Syft + Grype)
./install-scan-tools.sh

# Optional API keys
export OPENAI_API_KEY="your_openai_api_key_here"
export NVD_API_KEY="your_nvd_api_key_here"   # Optional: raises NVD rate limit from 5 to 50 req/30s

# Verify everything is installed, then start
./check-prerequisites.sh
chmod +x start-chatcve.sh
./start-chatcve.sh
```

> Copy `.env.example` to `.env` for persistent configuration. Keep the virtualenv name distinct from your `.env` config file.

### Accessing ChatCVE

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Dashboard |
| http://localhost:3000/chat | AI Chat |
| http://localhost:3000/cves | CVE Explorer |
| http://localhost:3000/scans | Scan Management |
| http://localhost:3000/database | Database Browser |
| http://localhost:3000/settings | Settings |
| http://localhost:5000 | REST API backend |

## 🔐 Authentication

On first launch you'll be redirected to `/setup` to create an admin account (min 8 character password).

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, delete scans, all settings |
| **User** | Start scans, view scans, use AI chat, view CVEs |
| **Guest** | Read-only: view stats and CVEs (no scans, no chat) |

Only admins can create user accounts (no self-registration); users are managed via the Settings page. For production, set `JWT_SECRET_KEY` to a secure random string.

## 🧠 AI Security Analyst

The chat is backed by a **tool-calling SQL agent** (LangChain) that answers questions by querying your scan database directly:

- **Read-only by design** - connects through SQLite's `PRAGMA query_only`; only `scan_metadata` and `app_patrol` tables are exposed (user credentials are invisible)
- **Real-time streaming** over Server-Sent Events with live agent step indicators
- **Persistent history** stored per-user in SQLite

Example questions:
```
How many critical vulnerabilities do we have?
Which image has the most high-severity CVEs?
Show me high-risk scans from production environment.
What should I patch first?
```

## ⚙️ Configuration

```bash
# Core Configuration
AI_PROVIDER=openai                         # openai | azure-openai | anthropic | bedrock | gemini | ollama
LLM_MODEL=gpt-4o                           # Optional model override (per-provider defaults built in)
OPENAI_API_KEY=your_openai_api_key_here    # Required for OpenAI provider
NVD_API_KEY=your_nvd_api_key_here          # Optional, increases rate limits
DATABASE_PATH=app_patrol.db                # SQLite database location

# Provider-specific (only needed for the chosen AI_PROVIDER)
AZURE_OPENAI_ENDPOINT=                     # Azure OpenAI endpoint URL
AZURE_OPENAI_API_KEY=                      # Azure OpenAI key
AZURE_OPENAI_DEPLOYMENT=                   # Azure deployment name
ANTHROPIC_API_KEY=                         # Anthropic Claude
GOOGLE_API_KEY=                            # Google Gemini
OLLAMA_BASE_URL=http://localhost:11434     # Ollama (local models, no API key)
OPENAI_BASE_URL=                           # Custom OpenAI-compatible endpoint (vLLM, LiteLLM)

# Optional Configuration
LLM_TEMPERATURE=0                          # AI sampling temperature
JWT_SECRET_KEY=change-me                   # JWT signing secret (set in production!)
JWT_EXPIRATION_HOURS=24                    # Token lifetime
FLASK_DEBUG=1                              # Enable debug mode
PORT=5000                                  # Backend port (default: 5000)
FRONTEND_PORT=3000                         # Frontend port (default: 3000)
```

For fully offline / private deployments, set `AI_PROVIDER=ollama`.

### Scan Input

Type image references or upload a text file with one image per line:

```
public.ecr.aws/nginx/nginx:1.28-alpine3.21-slim
public.ecr.aws/docker/library/alpine:3.19
```

Standard Docker notation is supported (`nginx:latest`, `public.ecr.aws/library/alpine:3.19`) across Docker Hub, ECR, GCR, and other public/private registries.

## 📸 Screenshots

| | |
|---|---|
| ![AI Chat](screenshots/chatcve_aichat_1.jpg) | ![Database](screenshots/chatcve_database_1.jpg) |
| ![New Scan](screenshots/chatcve_newscan_1.jpg) | ![Scan History](screenshots/chatcve_scanhistory_3.jpg) |

## 📊 Security Scoring

Each scan receives a risk score on a 0–100 scale, weighted by severity:

| Severity | Points | Risk Category | Score Range |
|----------|--------|---------------|-------------|
| Critical | 10.0 | 🟢 Low | 0–40 |
| High | 7.5 | 🟡 Medium | 40–70 |
| Medium | 5.0 | 🔴 High | 70–100 |
| Low | 2.5 | | |

The total is normalized per package count and scaled to 0–100. Critical and High severity findings are flagged as potentially exploitable. Every scan also captures performance metrics (duration, package/image counts), technical provenance (Syft/Grype versions, scan engine, scan source), and contextual info (initiator, project name, environment, tags).

## 🔍 API Documentation

### Core Endpoints
- `GET /api/stats/vulnerabilities` - Vulnerability statistics
- `POST /api/chat` - AI chat interface
- `GET /api/chat/history` - Chat history
- `GET /api/scans` - Scan results
- `POST /api/scans/start` - Start new scan
- `DELETE /api/scans/{id}` - Delete scan
- `GET /api/activity/recent` - Recent scan activity

### Scan Management
- `GET /api/scans/{id}/progress` - Scan progress with metadata
- `GET /api/scans/{id}/logs` - Real-time scan logs
- `GET /api/scans/{id}/images` - Scan images with vulnerability counts
- `GET /api/scans/{id}/images/{image}/vulnerabilities` - Detailed image vulnerabilities

## 🛠️ Development

### Project Structure
```
ChatCVE/
├── api/                          # Flask backend
│   ├── flask_backend.py          # Main API server
│   ├── scan_service.py           # Scanning logic
│   └── tests/                    # unit/, integration/, conftest.py
├── frontend-next/                # Next.js frontend
│   ├── src/app/                  # App router pages
│   ├── src/components/           # React components
│   ├── src/lib/                  # Utilities and API client
│   └── e2e/                      # E2E tests (Playwright)
├── .github/workflows/            # CI/CD pipelines (test.yml, codeql.yml)
├── docker-compose.yml
├── install-scan-tools.sh         # Installs Syft + Grype
├── start-chatcve.sh              # Startup script
└── check-prerequisites.sh        # Dependency checker
```

### Running Locally
```bash
# Backend
cd api && source ../.venv/bin/activate && python3 flask_backend.py

# Frontend
cd frontend-next && npm run dev
```

## 🧪 Testing

```bash
# Backend (pytest) - run from api/
pip install -r requirements-test.txt
pytest tests/unit -v                        # Unit tests
pytest tests/integration -v                 # Integration tests
pytest tests/ -v --cov=. --cov-report=html  # With coverage

# Frontend (Vitest) - run from frontend-next/
npm run test                                # Interactive mode
npm run test:ci                             # CI mode with coverage

# E2E (Playwright) - run from frontend-next/
npx playwright install
npm run test:e2e
```

## 🔄 CI/CD

GitHub Actions runs pytest, Vitest, Playwright E2E, Trivy filesystem scans, CodeQL analysis, dependency audits, and Docker build verification on every push/PR to `master`. Coverage reports upload to Codecov; security results upload as SARIF to the GitHub Security tab. Coverage gates fail builds below target (backend unit 80%, integration 70%, frontend components 70%, API client 85%).

## 🚨 Troubleshooting

| Issue | Fix |
|-------|-----|
| "Module not found" errors | Activate the virtualenv and `pip install -r requirements.txt` |
| Docker permission issues | `sudo usermod -aG docker $USER`, then log out and back in |
| Port already in use | `./kill-chatcve-processes.sh` |
| Database issues | Check `ls -la app_patrol.db`; delete the file to reset (WARNING: deletes all data) |

Still stuck? Run `./check-prerequisites.sh`, verify Docker is running (`docker ps`), or check the API health endpoint (`curl http://localhost:5000/health`).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Syft & Grype** - Anchore's excellent SBOM and vulnerability scanning tools
- **LangChain** - AI agent capabilities
- **Next.js, Tailwind & Shadcn UI** - Modern frontend stack

---

**Built with ❤️ for DevSecOps teams who need intelligent vulnerability management.**
