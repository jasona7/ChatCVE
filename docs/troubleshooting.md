# Troubleshooting

Common issues and their solutions.

## Installation Issues

### Docker build fails

**Symptom:** `docker-compose up --build` fails during build.

**Solutions:**

1. **Clear Docker cache:**
   ```bash
   docker-compose build --no-cache
   ```

2. **Check disk space:**
   ```bash
   df -h
   docker system df
   ```

3. **Prune unused resources:**
   ```bash
   docker system prune -a
   ```

### npm install fails

**Symptom:** Frontend dependencies fail to install.

**Solutions:**

1. **Clear npm cache:**
   ```bash
   cd frontend-next
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   ```

2. **Use legacy peer deps:**
   ```bash
   npm install --legacy-peer-deps
   ```

### Python dependencies fail

**Symptom:** `pip install -r requirements.txt` fails.

**Solutions:**

1. **Upgrade pip:**
   ```bash
   pip install --upgrade pip
   ```

2. **Install build tools (Linux):**
   ```bash
   sudo apt-get install python3-dev build-essential
   ```

3. **Install specific problem packages separately:**
   ```bash
   pip install tiktoken
   pip install -r requirements.txt
   ```

---

## Authentication Issues

### "Invalid credentials" on login

**Causes:**
- Wrong username or password
- Leading/trailing whitespace
- Case sensitivity

**Solutions:**
1. Verify credentials are correct
2. Try copying password from password manager
3. Check for caps lock

### Redirected to login after refresh

**Cause:** JWT token expired or invalid.

**Solutions:**

1. **Check token expiration:**
   ```bash
   echo $JWT_EXPIRATION_HOURS
   ```

2. **Set persistent secret key:**
   ```bash
   export JWT_SECRET_KEY=your-secure-key
   docker-compose restart backend
   ```

3. **Clear browser storage and login again:**
   - Open DevTools → Application → Local Storage
   - Delete `chatcve_token` and `chatcve_user`
   - Refresh and login

### "Setup already complete" but can't login

**Cause:** Admin exists but credentials unknown.

**Solution (resets all data):**
```bash
docker exec chatcve-backend rm /data/app_patrol.db
docker-compose restart backend
# Visit app to create new admin
```

### Lost admin access

**To reset authentication:**

```bash
# Option 1: Delete just users (keeps scan data)
docker exec chatcve-backend sqlite3 /data/app_patrol.db "DELETE FROM users;"
docker-compose restart backend

# Option 2: Delete entire database
docker exec chatcve-backend rm /data/app_patrol.db
docker-compose restart backend
```

---

## Scanning Issues

### "Image not found"

**Causes:**
- Image doesn't exist in registry
- Typo in image name
- Private registry requires authentication

**Solutions:**

1. **Verify image exists:**
   ```bash
   docker pull nginx:latest
   ```

2. **Check spelling and tag:**
   ```bash
   # Wrong
   ngnix:latest

   # Correct
   nginx:latest
   ```

3. **For private registries:**
   ```bash
   docker login your-registry.com
   ```

### Scan hangs or takes forever

**Causes:**
- Large image
- Slow network
- Docker daemon issues

**Solutions:**

1. **Check Docker status:**
   ```bash
   docker info
   ```

2. **Monitor scan progress in logs:**
   ```bash
   docker-compose logs -f backend
   ```

3. **Pull image manually first:**
   ```bash
   docker pull your-image:tag
   ```

### "Grype not found" or "Syft not found"

**Cause:** Scanning tools not installed in container.

**Solution:** Rebuild with proper Dockerfile:
```bash
docker-compose build --no-cache backend
docker-compose up -d
```

---

## AI Chat Issues

### "OpenAI API key not configured"

**Cause:** Missing or invalid API key.

**Solutions:**

1. **Set environment variable:**
   ```bash
   export OPENAI_API_KEY=sk-your-key-here
   docker-compose up -d
   ```

2. **Verify key is passed to container:**
   ```bash
   docker exec chatcve-backend printenv | grep OPENAI
   ```

### Chat returns errors or nonsense

**Causes:**
- Database is empty (no scan data)
- API rate limits
- Model confusion

**Solutions:**

1. **Run a scan first** to populate data

2. **Be specific in questions:**
   ```
   # Too vague
   "Tell me about vulnerabilities"

   # Better
   "How many critical CVEs are in the nginx image?"
   ```

3. **Check for rate limits:**
   ```bash
   docker-compose logs backend | grep -i "rate"
   ```

### Chat is slow

**Cause:** OpenAI API latency.

**Solutions:**
- This is normal; GPT-4 queries take 3-10 seconds
- Consider using GPT-3.5-turbo for faster (but less accurate) responses

---

## Database Issues

### "Database is locked"

**Cause:** Multiple processes accessing SQLite.

**Solutions:**

1. **Restart backend:**
   ```bash
   docker-compose restart backend
   ```

2. **Check for zombie processes:**
   ```bash
   docker exec chatcve-backend ps aux
   ```

### Data not persisting after restart

**Cause:** Volume not configured properly.

**Solutions:**

1. **Check volume exists:**
   ```bash
   docker volume ls | grep chatcve
   ```

2. **Verify docker-compose.yml has volumes:**
   ```yaml
   volumes:
     - chatcve-data:/data
   ```

3. **Inspect volume:**
   ```bash
   docker volume inspect chatcve_chatcve-data
   ```

### Corrupted database

**Symptoms:** Random errors, inconsistent data.

**Solutions:**

1. **Check integrity:**
   ```bash
   docker exec chatcve-backend sqlite3 /data/app_patrol.db "PRAGMA integrity_check;"
   ```

2. **Export and reimport:**
   ```bash
   docker exec chatcve-backend sqlite3 /data/app_patrol.db ".dump" > backup.sql
   docker exec chatcve-backend rm /data/app_patrol.db
   docker exec -i chatcve-backend sqlite3 /data/app_patrol.db < backup.sql
   ```

---

## Frontend Issues

### Blank page / white screen

**Causes:**
- JavaScript error
- Build failure

**Solutions:**

1. **Check browser console** for errors (F12 → Console)

2. **Rebuild frontend:**
   ```bash
   docker-compose up --build -d frontend
   ```

3. **Check frontend logs:**
   ```bash
   docker-compose logs frontend
   ```

### "Network Error" or "Failed to fetch"

**Causes:**
- Backend not running
- CORS issues
- Wrong API URL

**Solutions:**

1. **Verify backend is running:**
   ```bash
   docker-compose ps
   curl http://localhost:5000/api/stats/vulnerabilities
   ```

2. **Check browser network tab** for specific errors

3. **Restart all services:**
   ```bash
   docker-compose restart
   ```

### Styles broken / layout issues

**Cause:** Tailwind CSS not built properly.

**Solution:**
```bash
cd frontend-next
npm run build
docker-compose up --build -d frontend
```

---

## Performance Issues

### High memory usage

**Solutions:**

1. **Add resource limits in docker-compose.yml:**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

2. **Check for memory leaks:**
   ```bash
   docker stats
   ```

### Slow dashboard loading

**Causes:**
- Large database
- Too many vulnerabilities to load

**Solutions:**

1. **Add pagination (requires code changes)**

2. **Delete old scans:**
   ```bash
   # Via API
   curl -X DELETE http://localhost:5000/api/scans/1 \
     -H "Authorization: Bearer <token>"
   ```

---

## Getting Help

If your issue isn't covered here:

1. **Check logs:**
   ```bash
   docker-compose logs -f
   ```

2. **Search existing issues:**
   https://github.com/jasona7/ChatCVE/issues

3. **Open a new issue** with:
   - Steps to reproduce
   - Error messages
   - Environment details (OS, Docker version)
   - Relevant logs
