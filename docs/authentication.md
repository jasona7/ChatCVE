# Authentication

ChatCVE uses JWT-based authentication with role-based access control. This guide covers user management, roles, and security configuration.

## Overview

- **First-run setup**: Creates the owner admin account
- **No self-registration**: Only admins can create new users
- **JWT tokens**: 24-hour expiration by default
- **Role-based access**: Three roles with different permissions

## First-Time Setup

When no admin account exists, visiting the application redirects to `/setup`.

1. Navigate to http://localhost:3000
2. You'll be redirected to `/setup`
3. Create your admin account (username + password)
4. You're automatically logged in

This first admin account is marked as the **owner** and cannot be deleted.

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, delete any scan, all settings |
| **User** | Start scans, view own scans, use AI chat, view CVEs |
| **Guest** | Read-only: view stats, CVEs (no scans, no chat) |

### Owner Account

The first admin created during setup is marked as the "owner":
- Displayed with a crown badge in User Management
- Cannot be deleted by any user (including themselves)
- Has full admin permissions

## Managing Users

### Accessing User Management

1. Click your username in the top-right header
2. Select **User Management** from the dropdown
3. (Only visible to admin users)

### Creating a User

1. Click **Add User**
2. Enter username (min 3 characters)
3. Enter password (min 8 characters)
4. Select role: Admin, User, or Guest
5. Click **Create User**

### Deleting a User

1. Find the user in the table
2. Click the trash icon on the right
3. Confirm deletion

**Note**: You cannot delete:
- Your own account
- The owner account

## Login Flow

### Standard Login

1. Navigate to http://localhost:3000
2. If not authenticated, redirected to `/login`
3. Enter username and password
4. Click **Sign In**

### Session Persistence

- JWT token stored in browser localStorage
- Automatically included in API requests
- Token validated on each page load
- Expired tokens redirect to login

### Logout

1. Click your username in the header
2. Click **Sign Out**
3. Token cleared, redirected to login

## API Authentication

All protected API endpoints require a JWT token.

### Obtaining a Token

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "yourpassword"}'
```

Response:
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

### Using the Token

Include the token in the `Authorization` header:

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Token Expiration

Tokens expire after 24 hours by default. Configure with `JWT_EXPIRATION_HOURS`.

When a token expires:
- API returns 401 Unauthorized
- Frontend clears stored token
- User redirected to login

## Security Configuration

### Environment Variables

```bash
# Secret key for signing JWT tokens (required in production)
JWT_SECRET_KEY=your-secure-random-string-here

# Token expiration in hours (default: 24)
JWT_EXPIRATION_HOURS=24
```

### Generating a Secure Secret Key

```bash
# Python
python -c "import secrets; print(secrets.token_hex(32))"

# OpenSSL
openssl rand -hex 32
```

### Production Recommendations

1. **Set a strong JWT_SECRET_KEY**: Never use the default in production
2. **Use HTTPS**: Tokens transmitted in plain HTTP can be intercepted
3. **Reduce token expiration**: For sensitive environments, use shorter expiration
4. **Monitor failed logins**: Check logs for brute-force attempts

## Protected Endpoints

| Endpoint | Required Role |
|----------|---------------|
| `POST /api/chat` | admin, user |
| `POST /api/scans/start` | admin, user |
| `DELETE /api/scans/<id>` | admin |
| `GET /api/auth/users` | admin |
| `POST /api/auth/users` | admin |
| `DELETE /api/auth/users/<id>` | admin |

## Troubleshooting

### "Invalid credentials" on login

- Verify username and password are correct
- Check for leading/trailing spaces
- Passwords are case-sensitive

### Token expired immediately

- Check server and client clocks are synchronized
- Verify `JWT_EXPIRATION_HOURS` is set correctly

### "Cannot delete the owner account"

- The first admin (owner) is protected from deletion
- This is by design to prevent lockout

### Lost admin access

If you lose access to all admin accounts:

```bash
# Delete the database to reset (loses all data)
docker exec chatcve-backend rm /data/app_patrol.db
docker-compose restart backend
```

Then visit the app to create a new admin account.
