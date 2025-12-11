# Architecture

This document describes ChatCVE's system architecture, components, and data flow.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                            │
│                    http://localhost:3000                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Dashboard  │  │   Scans     │  │  AI Chat    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ /api/*
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Flask)                               │
│                    http://localhost:5000                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Auth API   │  │  Scan API   │  │  Chat API   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────┐                │
│  │              SQLite Database                 │                │
│  │  (users, scan_metadata, app_patrol)          │                │
│  └─────────────────────────────────────────────┘                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────┐           ┌─────────────────────┐
│   Docker Engine     │           │   OpenAI API        │
│   (Image Pulling)   │           │   (Chat/SQL Gen)    │
└─────────────────────┘           └─────────────────────┘
              │
              ▼
┌─────────────────────┐
│   Syft + Grype      │
│   (Vulnerability    │
│    Scanning)        │
└─────────────────────┘
```

## Technology Stack

### Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 | React framework with App Router |
| Language | TypeScript | Type-safe JavaScript |
| Styling | Tailwind CSS | Utility-first CSS |
| Components | Shadcn UI | Accessible component library |
| State | React Context | Auth state management |
| HTTP | Fetch API | API communication |

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Flask 2.3.3 | Python web framework |
| Auth | PyJWT | JWT token handling |
| Password | Werkzeug | Secure password hashing |
| AI | LangChain | SQL generation from natural language |
| LLM | OpenAI GPT-4 | Language model |
| Database | SQLite | Data storage |
| CORS | Flask-CORS | Cross-origin requests |

### Scanning

| Component | Technology | Purpose |
|-----------|------------|---------|
| Container | Docker | Image pulling |
| SBOM | Syft | Software Bill of Materials generation |
| Scanner | Grype | Vulnerability detection |

## Directory Structure

```
ChatCVE/
├── api/
│   ├── flask_backend.py      # Main API server (1400+ lines)
│   ├── scan_service.py       # Container scanning logic
│   ├── requirements.txt      # Python dependencies
│   └── tests/                # Backend tests
│       ├── unit/
│       └── integration/
│
├── frontend-next/
│   ├── src/
│   │   ├── app/              # Next.js pages (App Router)
│   │   │   ├── page.tsx      # Dashboard
│   │   │   ├── chat/         # AI chat
│   │   │   ├── scans/        # Scan management
│   │   │   ├── cves/         # CVE explorer
│   │   │   ├── settings/     # Settings & user management
│   │   │   ├── login/        # Login page
│   │   │   └── setup/        # First-run setup
│   │   │
│   │   ├── components/       # React components
│   │   │   ├── layout/       # Header, sidebar, main layout
│   │   │   ├── auth/         # AuthGuard
│   │   │   ├── chat/         # Chat interface
│   │   │   ├── dashboard/    # Dashboard widgets
│   │   │   └── ui/           # Shadcn components
│   │   │
│   │   ├── contexts/         # React contexts
│   │   │   └── AuthContext.tsx
│   │   │
│   │   └── lib/              # Utilities
│   │       └── api.ts        # API client
│   │
│   └── middleware.ts         # Route middleware
│
├── docs/                     # Documentation
├── docker-compose.yml        # Container orchestration
└── README.md
```

## Database Schema

### users

Stores user accounts and authentication data.

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',        -- admin, user, guest
    is_owner INTEGER DEFAULT 0,      -- 1 for first admin
    created_at TEXT,
    last_login TEXT
);
```

### scan_metadata

Stores scan-level summary data.

```sql
CREATE TABLE scan_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_scan_name TEXT,
    scan_timestamp TEXT,
    image_count INTEGER,
    scan_duration REAL,
    risk_score REAL,
    critical_count INTEGER,
    high_count INTEGER,
    medium_count INTEGER,
    low_count INTEGER
);
```

### app_patrol

Stores individual vulnerability records.

```sql
CREATE TABLE app_patrol (
    IMAGE_TAG TEXT,
    PACKAGE TEXT,
    VERSION TEXT,
    VULNERABILITY TEXT,           -- CVE ID
    SEVERITY TEXT,                -- Critical, High, Medium, Low
    DESCRIPTION TEXT
);
```

## Data Flow

### Authentication Flow

```
1. User submits credentials
   └─▶ POST /api/auth/login

2. Backend validates credentials
   └─▶ Check password_hash with werkzeug

3. Generate JWT token
   └─▶ Include user_id, username, role, expiration

4. Frontend stores token
   └─▶ localStorage: chatcve_token, chatcve_user

5. Subsequent requests include token
   └─▶ Authorization: Bearer <token>

6. Backend validates token on protected routes
   └─▶ @require_auth decorator
```

### Scan Flow

```
1. User submits image list
   └─▶ POST /api/scans/start

2. Backend validates image references
   └─▶ Security checks (path traversal, injection)

3. For each image:
   a. Pull image via Docker
   b. Generate SBOM with Syft
   c. Scan SBOM with Grype
   d. Store results in app_patrol

4. Calculate risk score
   └─▶ Weighted formula: critical*25 + high*10 + medium*3 + low*1

5. Store scan summary
   └─▶ Insert into scan_metadata

6. Return results to frontend
```

### AI Chat Flow

```
1. User sends natural language query
   └─▶ POST /api/chat

2. LangChain analyzes query intent
   └─▶ Determine relevant table(s)

3. Dynamic few-shot prompting
   └─▶ Inject relevant SQL examples

4. GPT-4 generates SQL query
   └─▶ Based on schema and examples

5. Execute query against SQLite
   └─▶ Fetch results

6. GPT-4 formats response
   └─▶ Natural language explanation

7. Return to user
   └─▶ Response + generated SQL
```

## Risk Score Calculation

The risk score provides a 0-100 metric of overall vulnerability severity.

### Formula

```python
raw_score = (critical * 25) + (high * 10) + (medium * 3) + (low * 1)
risk_score = min(100, log10(raw_score + 1) * 20)
```

### Rationale

- **Logarithmic scaling**: Prevents scores from being dominated by high counts
- **Weighted severity**: Critical vulnerabilities have 25x the weight of low
- **Capped at 100**: Provides consistent 0-100 range

### Example Calculations

| Critical | High | Medium | Low | Raw Score | Risk Score |
|----------|------|--------|-----|-----------|------------|
| 0 | 0 | 0 | 0 | 0 | 0.0 |
| 1 | 0 | 0 | 0 | 25 | 28.5 |
| 5 | 10 | 15 | 20 | 290 | 49.3 |
| 50 | 100 | 200 | 500 | 3350 | 70.5 |

## Security Considerations

### Authentication

- Passwords hashed with Werkzeug's PBKDF2
- JWT tokens with configurable expiration
- Role-based access control
- Owner account protection

### Input Validation

- Image reference validation (path traversal, injection)
- SQL injection prevention via parameterized queries
- XSS prevention via React's automatic escaping

### Recommendations

- Set `JWT_SECRET_KEY` in production
- Deploy behind HTTPS
- Configure CORS for specific origins
- Implement rate limiting
- Regular database backups
