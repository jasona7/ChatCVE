# User Guide

This guide covers the main features of ChatCVE: the dashboard, scanning container images, exploring CVEs, and using the AI chat.

## Dashboard

The dashboard provides an at-a-glance view of your security posture.

### Vulnerability Statistics

- **Total Vulnerabilities**: Count across all scanned images
- **Severity Breakdown**: Critical, High, Medium, Low counts
- **Risk Score**: Weighted score (0-100) based on severity distribution

### Recent Activity

Shows your most recent scans with:
- Scan name and timestamp
- Number of images scanned
- Vulnerability counts by severity

## Scanning Container Images

ChatCVE scans container images using Syft (SBOM generation) and Grype (vulnerability detection).

### Starting a Scan

1. Navigate to **Scans** in the sidebar
2. Click **New Scan**
3. Enter a **Scan Name** (e.g., "Production Images Q4")
4. Add container image references, one per line:

```
nginx:latest
postgres:15
redis:7-alpine
myregistry.com/myapp:v1.2.3
```

5. Click **Start Scan**

### Supported Image Formats

| Format | Example |
|--------|---------|
| Official images | `nginx`, `postgres` |
| Tagged images | `nginx:1.25`, `node:18-alpine` |
| Registry images | `gcr.io/project/image:tag` |
| Digest references | `nginx@sha256:abc123...` |

### Scan Progress

While scanning, you'll see:
- Current image being processed
- Progress bar
- Real-time vulnerability counts

### Viewing Results

After a scan completes:
- **Summary**: Total vulnerabilities by severity
- **Risk Score**: Calculated security score
- **Details**: Click to view individual CVEs

## CVE Explorer

Browse and search all discovered vulnerabilities.

### Filtering CVEs

- **Severity**: Filter by Critical, High, Medium, Low
- **Package**: Search by affected package name
- **Image**: Filter by source image
- **CVE ID**: Search by CVE identifier (e.g., CVE-2024-1234)

### CVE Details

Each CVE entry shows:
- **CVE ID**: Links to NVD for full details
- **Severity**: Color-coded badge
- **Package**: Affected package and version
- **Description**: Brief vulnerability description
- **Image**: Which scanned image contains this vulnerability

## AI Chat

Ask questions about your vulnerability data using natural language.

### Example Questions

**Scan-level queries:**
- "How many scans have I run?"
- "What was the risk score for my last scan?"
- "Show me scans with more than 10 critical vulnerabilities"

**Vulnerability queries:**
- "What are the most common critical CVEs?"
- "Which packages have the most vulnerabilities?"
- "Show me all CVEs affecting nginx"

**Comparison queries:**
- "Compare the latest two scans"
- "Which image has the highest risk score?"

### How It Works

The AI chat uses LangChain to:
1. Understand your question intent
2. Generate appropriate SQL queries
3. Execute against your local database
4. Format results in a readable response

### Tips for Better Results

- Be specific about what you're looking for
- Use terms like "critical", "high", "recent", "latest"
- Ask follow-up questions to drill down

## Database Explorer

Advanced users can run direct SQL queries.

### Available Tables

**scan_metadata**
- Scan-level information
- Columns: `id`, `user_scan_name`, `scan_timestamp`, `image_count`, `scan_duration`, `risk_score`, `critical_count`, `high_count`, `medium_count`, `low_count`

**app_patrol**
- Individual vulnerability records
- Columns: `IMAGE_TAG`, `PACKAGE`, `VERSION`, `VULNERABILITY`, `SEVERITY`, `DESCRIPTION`

### Example Queries

```sql
-- Top 10 most vulnerable packages
SELECT PACKAGE, COUNT(*) as vuln_count
FROM app_patrol
GROUP BY PACKAGE
ORDER BY vuln_count DESC
LIMIT 10;

-- Critical vulnerabilities by image
SELECT IMAGE_TAG, COUNT(*) as critical_count
FROM app_patrol
WHERE SEVERITY = 'Critical'
GROUP BY IMAGE_TAG
ORDER BY critical_count DESC;
```

## Settings

Access settings via the gear icon in the header.

### Available Settings

- **API Keys**: Configure OpenAI and NVD API keys
- **Database**: View database statistics
- **User Management**: (Admin only) Manage user accounts

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open search |
| `Ctrl/Cmd + /` | Open AI chat |
| `Esc` | Close modal/dialog |
