# API Reference

ChatCVE exposes a REST API for all functionality. Base URL: `http://localhost:5000`

## Authentication Endpoints

### Check Setup Status

Check if initial admin setup has been completed.

```
GET /api/auth/check-setup
```

**Response:**
```json
{
  "setupComplete": true
}
```

---

### Initial Setup

Create the first admin account. Only works when no admin exists.

```
POST /api/auth/setup
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "Admin user created successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "is_owner": true
  }
}
```

**Errors:**
- `400` - Username/password validation failed
- `400` - Setup already complete

---

### Login

Authenticate and receive a JWT token.

```
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "is_owner": true
  }
}
```

**Errors:**
- `400` - Missing username or password
- `401` - Invalid credentials

---

### Get Current User

Get the authenticated user's information.

```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "is_owner": true,
  "created_at": "2024-01-15T10:30:00",
  "last_login": "2024-01-15T14:22:00"
}
```

---

### List Users

Get all users. Admin only.

```
GET /api/auth/users
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "is_owner": true,
    "created_at": "2024-01-15T10:30:00",
    "last_login": "2024-01-15T14:22:00"
  },
  {
    "id": 2,
    "username": "analyst",
    "role": "user",
    "is_owner": false,
    "created_at": "2024-01-15T11:00:00",
    "last_login": null
  }
]
```

---

### Create User

Create a new user account. Admin only.

```
POST /api/auth/users
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "username": "newuser",
  "password": "password123",
  "role": "user"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 3,
    "username": "newuser",
    "role": "user"
  }
}
```

**Errors:**
- `400` - Validation failed (username/password length, invalid role)
- `400` - Username already exists

---

### Delete User

Delete a user account. Admin only.

```
DELETE /api/auth/users/<user_id>
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

**Errors:**
- `400` - Cannot delete your own account
- `403` - Cannot delete the owner account
- `404` - User not found

---

## Scan Endpoints

### Start Scan

Initiate a container image scan.

```
POST /api/scans/start
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "scan_name": "Production Scan",
  "images": ["nginx:latest", "postgres:15", "redis:7"]
}
```

**Response:**
```json
{
  "scan_id": "abc123",
  "status": "started",
  "image_count": 3
}
```

---

### Get Scan Progress

Get real-time progress of a running scan.

```
GET /api/scans/<scan_id>/progress
```

**Response:**
```json
{
  "scan_id": "abc123",
  "status": "in_progress",
  "current_image": "postgres:15",
  "images_completed": 1,
  "images_total": 3,
  "vulnerabilities_found": 42
}
```

---

### List Scans

Get all completed scans.

```
GET /api/scans
```

**Response:**
```json
[
  {
    "id": 1,
    "user_scan_name": "Production Scan",
    "scan_timestamp": "2024-01-15T10:30:00",
    "image_count": 3,
    "scan_duration": 45.2,
    "risk_score": 67.5,
    "critical_count": 5,
    "high_count": 12,
    "medium_count": 25,
    "low_count": 18
  }
]
```

---

### Delete Scan

Delete a scan and its associated data. Admin only.

```
DELETE /api/scans/<scan_id>
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Scan deleted successfully"
}
```

---

## Statistics Endpoints

### Vulnerability Statistics

Get aggregated vulnerability statistics.

```
GET /api/stats/vulnerabilities
```

**Response:**
```json
{
  "total": 156,
  "critical": 12,
  "high": 34,
  "medium": 67,
  "low": 43,
  "by_package": [
    {"package": "openssl", "count": 15},
    {"package": "curl", "count": 12}
  ]
}
```

---

### Recent Activity

Get recent scan activity.

```
GET /api/activity/recent
```

**Response:**
```json
[
  {
    "id": 1,
    "scan_name": "Production Scan",
    "timestamp": "2024-01-15T10:30:00",
    "image_count": 3,
    "total_vulnerabilities": 60
  }
]
```

---

## Chat Endpoint

### AI Chat

Send a natural language query about your vulnerability data.

```
POST /api/chat
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "message": "What are the most critical vulnerabilities?"
}
```

**Response:**
```json
{
  "response": "Based on your scan data, here are the top critical vulnerabilities...",
  "sql_query": "SELECT * FROM app_patrol WHERE SEVERITY = 'Critical' LIMIT 10"
}
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently no rate limiting is implemented. For production deployments, consider adding rate limiting via a reverse proxy (nginx, Traefik) or API gateway.

---

## CORS

CORS is enabled for all origins in development. For production, configure allowed origins appropriately.
