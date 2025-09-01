# ChatCVE Frontend

A modern Next.js frontend for the ChatCVE vulnerability management platform.

## Features

### 🎯 Core Functionality
- **AI-Powered Chat Interface**: Natural language queries for CVE data
- **Comprehensive Dashboard**: Vulnerability statistics and trends
- **Scan Management**: Container image scanning with real-time status
- **CVE Explorer**: Advanced filtering and search capabilities
- **User Workspace**: Saved queries, bookmarks, and personal organization
- **Database Access**: Direct SQL query interface for power users

### 🎨 UI/UX Features
- **Modern Design**: Built with Next.js 14, TypeScript, and Tailwind CSS
- **Responsive Layout**: Mobile-first design that works on all devices
- **Dark/Light Mode**: Theme switching for user preference
- **Real-time Updates**: Live scan status and notification system
- **Accessibility**: WCAG-compliant components using Radix UI
- **Fast Performance**: Server-side rendering and optimized loading

### 🛡️ Security Features
- **Secure API Integration**: Connects to existing Python backend
- **Query Validation**: SQL injection protection for database access
- **Role-based Access**: Different views for different user types
- **Data Export**: Secure export of vulnerability reports

## Architecture

```
frontend-next/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx         # Dashboard
│   │   ├── chat/            # AI Chat Interface
│   │   ├── cves/            # CVE Explorer
│   │   ├── scans/           # Scan Management
│   │   ├── workspace/       # User Workspace
│   │   └── database/        # SQL Query Interface
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # Base Shadcn/Radix components
│   │   ├── layout/          # Layout components
│   │   ├── dashboard/       # Dashboard-specific components
│   │   ├── chat/            # Chat interface components
│   │   ├── cves/            # CVE management components
│   │   ├── scans/           # Scan management components
│   │   └── workspace/       # Workspace components
│   ├── lib/                 # Utilities and API services
│   ├── types/               # TypeScript type definitions
│   └── hooks/               # Custom React hooks
└── api/
    └── flask_backend.py     # Enhanced Flask API for frontend integration
```

## User Personas

### 🔍 Security Analysts
- **Dashboard**: Quick overview of critical vulnerabilities
- **Chat Interface**: Natural language queries for investigation
- **CVE Explorer**: Detailed vulnerability analysis and filtering
- **Workspace**: Save important findings and create investigation workflows

### 👥 Audit Teams
- **Reports**: Generate compliance and audit reports
- **Database Access**: Direct SQL queries for detailed analysis
- **Export Features**: Extract data for external audit tools
- **History Tracking**: Maintain audit trails of investigations

### 📋 Compliance Teams
- **Workspace**: Organize compliance-related vulnerabilities
- **Scan Management**: Ensure all required images are scanned
- **Documentation**: Track remediation efforts and timelines
- **Reporting**: Generate compliance reports and attestations

### 💻 Development Teams
- **Scan Integration**: Monitor builds and container registries
- **Remediation Tracking**: Track which vulnerabilities need fixing
- **Package Analysis**: Understand vulnerable dependencies
- **Fix Validation**: Verify that updates resolve vulnerabilities

## Getting Started

1. **Install Dependencies**:
   ```bash
   cd frontend-next
   npm install
   ```

2. **Set up Environment**:
   ```bash
   cp .env.example .env.local
   # Configure API endpoint and other settings
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Start Backend API**:
   ```bash
   cd ../api
   python flask_backend.py
   ```

5. **Access the Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Integration with Existing Backend

The new frontend integrates with the existing ChatCVE Python backend through:

- **API Adapter**: `api/flask_backend.py` extends the existing Flask app with REST endpoints
- **Database Access**: Direct connection to the existing SQLite databases
- **Scan Integration**: Leverages existing `scan.py` and CVE fetching scripts
- **AI Chat**: Uses the same Langchain SQL agent for natural language queries

## Key UI Improvements

### From Current Flask UI:
- ✅ Basic chat interface with history
- ✅ Simple question/answer format

### To Modern Next.js UI:
- 🎯 **Comprehensive Dashboard** with vulnerability metrics and trends
- 🎯 **Enhanced Chat Experience** with message management, saving, and categorization
- 🎯 **Visual CVE Management** with advanced filtering and search
- 🎯 **Scan Orchestration** with real-time progress tracking
- 🎯 **Personal Workspace** for organizing security work
- 🎯 **Professional Design** suitable for enterprise security teams
- 🎯 **Mobile Responsiveness** for field work and mobile devices
- 🎯 **Accessibility** meeting enterprise accessibility requirements

## Deployment

The frontend can be deployed alongside the existing Python backend or as a separate service:

1. **Same Server**: Deploy Next.js build to serve static files from Flask
2. **Separate Deployment**: Deploy to Vercel/Netlify with API proxy
3. **Container Deployment**: Use the provided Dockerfile for containerized deployment

## Extensibility

The modular design allows easy extension:
- **New Data Sources**: Add support for additional CVE databases
- **Custom Visualizations**: Create domain-specific dashboard widgets
- **Integration Points**: Connect with existing security tools
- **Workflow Automation**: Build automated remediation workflows