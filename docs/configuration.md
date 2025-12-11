# Configuration

ChatCVE is configured through environment variables. This guide covers all available settings.

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for AI chat features | `sk-...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NVD_API_KEY` | NVD API key for increased rate limits | None |
| `DATABASE_PATH` | Path to SQLite database | `../app_patrol.db` |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens | Random (insecure) |
| `JWT_EXPIRATION_HOURS` | Token expiration time | `24` |

## Setting Environment Variables

### Docker Compose

Edit `docker-compose.yml` or create a `.env` file:

```bash
# .env file in project root
OPENAI_API_KEY=sk-your-key-here
NVD_API_KEY=your-nvd-key
JWT_SECRET_KEY=your-secure-random-string
```

Or set directly in `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET_KEY=your-secure-key
```

### Local Development

```bash
# Export before running
export OPENAI_API_KEY=sk-your-key-here
export JWT_SECRET_KEY=your-secure-key

# Or inline
OPENAI_API_KEY=sk-... python3 api/flask_backend.py
```

## Configuration Details

### OpenAI API Key

Required for the AI chat feature. Get one at https://platform.openai.com/api-keys

The chat uses GPT-4 by default for SQL generation and natural language responses.

### NVD API Key

Optional but recommended. Without it, NVD lookups are rate-limited to 5 requests per 30 seconds.

Get one at https://nvd.nist.gov/developers/request-an-api-key

### Database Path

SQLite database location. Default is `../app_patrol.db` relative to the `api/` directory.

In Docker, the database is stored at `/data/app_patrol.db` and persisted via a volume.

### JWT Secret Key

**Critical for production security.**

If not set, a random key is generated at startup. This means:
- Tokens become invalid after restart
- All users must re-authenticate

For production, always set a persistent secret:

```bash
# Generate a secure key
python -c "import secrets; print(secrets.token_hex(32))"

# Set it
export JWT_SECRET_KEY=your-generated-key
```

### JWT Expiration

How long tokens remain valid. Default is 24 hours.

For higher security environments:
```bash
export JWT_EXPIRATION_HOURS=8  # 8-hour workday
```

For convenience (development):
```bash
export JWT_EXPIRATION_HOURS=168  # 1 week
```

## Docker Configuration

### Ports

Default port mappings in `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "5000:5000"  # API
  frontend:
    ports:
      - "3000:3000"  # Web UI
```

Change host ports if needed:
```yaml
ports:
  - "8080:3000"  # Access frontend on port 8080
```

### Volumes

Database persistence:

```yaml
volumes:
  - chatcve-data:/data
```

To use a host directory instead:
```yaml
volumes:
  - ./data:/data
```

### Resource Limits

Add resource constraints for production:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Frontend Configuration

### API Base URL

The frontend expects the API at `/api`, proxied by Next.js.

In `frontend-next/next.config.js`:

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://backend:5000/api/:path*',
    },
  ]
}
```

For different backend URLs, modify this configuration.

## Production Recommendations

### 1. Set Secure JWT Secret

```bash
JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
```

### 2. Use HTTPS

Deploy behind a reverse proxy with TLS:

```nginx
server {
    listen 443 ssl;
    server_name chatcve.example.com;

    ssl_certificate /etc/ssl/certs/chatcve.crt;
    ssl_certificate_key /etc/ssl/private/chatcve.key;

    location / {
        proxy_pass http://localhost:3000;
    }

    location /api {
        proxy_pass http://localhost:5000;
    }
}
```

### 3. Restrict CORS

Currently CORS allows all origins. For production, modify `flask_backend.py`:

```python
CORS(app, origins=['https://chatcve.example.com'])
```

### 4. Enable Logging

Add logging configuration:

```python
import logging
logging.basicConfig(level=logging.INFO)
```

### 5. Database Backups

Schedule regular backups of the SQLite database:

```bash
# Cron job example
0 2 * * * cp /data/app_patrol.db /backups/app_patrol_$(date +\%Y\%m\%d).db
```

## Troubleshooting Configuration

### API key not working

- Verify the key is set: `echo $OPENAI_API_KEY`
- Check for trailing whitespace
- Ensure the key is valid at platform.openai.com

### Database not persisting

- Check Docker volume is configured
- Verify volume permissions
- Use `docker volume inspect chatcve-data`

### Tokens expiring unexpectedly

- Set a persistent `JWT_SECRET_KEY`
- Check `JWT_EXPIRATION_HOURS` setting
- Verify server clock is accurate
