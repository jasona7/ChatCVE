#!/usr/bin/env python3
"""
Flask API Backend for ChatCVE Frontend
Provides REST API endpoints for the Next.js frontend
"""

import os
import json
import sqlite3
import asyncio
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, g, Response, stream_with_context
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from scan_service import scanner
from ai_service import (
    AIServiceError,
    build_agent_executor,
    get_provider_info,
    stream_agent_events,
)

app = Flask(__name__)
CORS(app)

# Configuration
DATABASE_PATH = os.getenv('DATABASE_PATH', '../app_patrol.db')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'chatcve-secret-key-change-in-production')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', 24))

# Initialize ChatCVE components
agent_executor = None
ai_model_name = None

def initialize_agent():
    """Initialize the ChatCVE AI agent via the provider-agnostic AI service."""
    global agent_executor, ai_model_name

    provider_info = get_provider_info()
    if not provider_info['configured']:
        print(
            f"Warning: AI provider '{provider_info['provider']}' is not fully "
            "configured. AI features will be disabled."
        )
        return False

    try:
        agent_executor, ai_model_name = build_agent_executor(DATABASE_PATH)
        print(
            f"ChatCVE AI agent initialized successfully "
            f"(provider={provider_info['provider']}, model={ai_model_name})"
        )
        return True
    except AIServiceError as e:
        print(f"Failed to initialize AI agent: {e}")
        return False
    except Exception as e:
        print(f"Failed to initialize AI agent: {e}")
        return False



def get_db_connection():
    """Get database connection"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

# =============================================================================
# Authentication System
# =============================================================================

def init_users_table():
    """Initialize the users table if it doesn't exist"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                is_owner INTEGER DEFAULT 0,
                created_at TEXT,
                last_login TEXT
            )
        """)
        conn.commit()
        conn.close()
        print("Users table initialized")
    except Exception as e:
        print(f"Failed to initialize users table: {e}")

def get_user_by_username(username):
    """Get user by username"""
    conn = get_db_connection()
    if not conn:
        return None
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def get_user_by_id(user_id):
    """Get user by ID"""
    conn = get_db_connection()
    if not conn:
        return None
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def create_user(username, password, role='user', is_owner=False):
    """Create a new user"""
    conn = get_db_connection()
    if not conn:
        return None
    try:
        cursor = conn.cursor()
        password_hash = generate_password_hash(password)
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, is_owner, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (username, password_hash, role, 1 if is_owner else 0, datetime.now().isoformat()))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None  # Username already exists
    except Exception as e:
        print(f"Error creating user: {e}")
        conn.close()
        return None

def admin_exists():
    """Check if any admin user exists"""
    conn = get_db_connection()
    if not conn:
        return False
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
    count = cursor.fetchone()[0]
    conn.close()
    return count > 0

def generate_token(user_id, username, role):
    """Generate JWT token"""
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')

def verify_token(token):
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def require_auth(roles=None):
    """Decorator to require authentication and optionally specific roles"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Authentication required'}), 401

            token = auth_header.split(' ')[1]
            payload = verify_token(token)

            if not payload:
                return jsonify({'error': 'Invalid or expired token'}), 401

            # Check role if specified
            if roles and payload.get('role') not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403

            # Set current user in request context
            g.current_user = payload
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# =============================================================================
# Auth Endpoints
# =============================================================================

@app.route('/api/auth/check-setup', methods=['GET'])
def check_setup():
    """Check if initial setup is complete (admin exists)"""
    try:
        # First ensure users table exists
        init_users_table()
        init_user_preferences_table()
        return jsonify({'setupComplete': admin_exists()})
    except Exception as e:
        print(f"Error checking setup: {e}")
        return jsonify({'setupComplete': False})

@app.route('/api/auth/setup', methods=['POST'])
def setup_admin():
    """Create the first admin user (only works if no admin exists)"""
    try:
        init_users_table()
        init_user_preferences_table()

        if admin_exists():
            return jsonify({'error': 'Setup already complete'}), 400

        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters'}), 400

        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

        # First admin is marked as owner (protected from deletion)
        user_id = create_user(username, password, role='admin', is_owner=True)
        if not user_id:
            return jsonify({'error': 'Failed to create admin user'}), 500

        # Generate token for immediate login
        token = generate_token(user_id, username, 'admin')

        return jsonify({
            'message': 'Admin user created successfully',
            'token': token,
            'user': {
                'id': user_id,
                'username': username,
                'role': 'admin',
                'is_owner': True
            }
        })

    except Exception as e:
        print(f"Error in setup: {e}")
        return jsonify({'error': 'Setup failed'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        user = get_user_by_username(username)
        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid credentials'}), 401

        # Update last login
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET last_login = ? WHERE id = ?",
                         (datetime.now().isoformat(), user['id']))
            conn.commit()
            conn.close()

        token = generate_token(user['id'], user['username'], user['role'])

        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role'],
                'is_owner': bool(user.get('is_owner', 0))
            }
        })

    except Exception as e:
        print(f"Error in login: {e}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/api/auth/me', methods=['GET'])
@require_auth()
def get_current_user():
    """Get current authenticated user info"""
    user = get_user_by_id(g.current_user['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'is_owner': bool(user.get('is_owner', 0)),
        'created_at': user['created_at'],
        'last_login': user['last_login']
    })

@app.route('/api/auth/users', methods=['GET'])
@require_auth(roles=['admin'])
def list_users():
    """List all users (admin only)"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, is_owner, created_at, last_login FROM users ORDER BY created_at DESC")
    users = cursor.fetchall()
    conn.close()

    # Convert is_owner to boolean
    result = []
    for user in users:
        user_dict = dict(user)
        user_dict['is_owner'] = bool(user_dict.get('is_owner', 0))
        result.append(user_dict)

    return jsonify(result)

@app.route('/api/auth/users', methods=['POST'])
@require_auth(roles=['admin'])
def create_new_user():
    """Create a new user (admin only)"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'user')

        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters'}), 400

        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

        if role not in ['admin', 'user', 'guest']:
            return jsonify({'error': 'Invalid role'}), 400

        user_id = create_user(username, password, role)
        if not user_id:
            return jsonify({'error': 'Username already exists'}), 400

        return jsonify({
            'message': 'User created successfully',
            'user': {
                'id': user_id,
                'username': username,
                'role': role
            }
        }), 201

    except Exception as e:
        print(f"Error creating user: {e}")
        return jsonify({'error': 'Failed to create user'}), 500

@app.route('/api/auth/users/<int:user_id>', methods=['DELETE'])
@require_auth(roles=['admin'])
def delete_user(user_id):
    """Delete a user (admin only)"""
    try:
        # Prevent deleting yourself
        if g.current_user['user_id'] == user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400

        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Protect the owner account from deletion
        if user.get('is_owner'):
            return jsonify({'error': 'Cannot delete the owner account'}), 403

        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()

        return jsonify({'message': 'User deleted successfully'})

    except Exception as e:
        print(f"Error deleting user: {e}")
        return jsonify({'error': 'Failed to delete user'}), 500

@app.route('/api/auth/users/<int:user_id>/password', methods=['PUT'])
@require_auth(roles=['admin'])
def admin_reset_password(user_id):
    """Reset a user's password (admin only)"""
    try:
        # Prevent admin from using this endpoint for their own password
        if g.current_user['user_id'] == user_id:
            return jsonify({'error': 'Use the change password endpoint for your own password'}), 400

        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        new_password = data.get('new_password', '')

        if len(new_password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        password_hash = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                      (password_hash, user_id))
        conn.commit()
        conn.close()

        return jsonify({'message': f'Password reset successfully for user {user["username"]}'})

    except Exception as e:
        print(f"Error resetting password: {e}")
        return jsonify({'error': 'Failed to reset password'}), 500

@app.route('/api/auth/me/password', methods=['PUT'])
@require_auth()
def change_own_password():
    """Change current user's password (requires current password)"""
    try:
        user = get_user_by_id(g.current_user['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')

        # Verify current password
        if not check_password_hash(user['password_hash'], current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401

        # Validate new password
        if len(new_password) < 8:
            return jsonify({'error': 'New password must be at least 8 characters'}), 400

        # Prevent using same password
        if current_password == new_password:
            return jsonify({'error': 'New password must be different from current password'}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        password_hash = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                      (password_hash, g.current_user['user_id']))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Password changed successfully'})

    except Exception as e:
        print(f"Error changing password: {e}")
        return jsonify({'error': 'Failed to change password'}), 500

# =============================================================================
# User Preferences System
# =============================================================================

def init_user_preferences_table():
    """Initialize the user_preferences table if it doesn't exist"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                preference_key TEXT NOT NULL,
                preference_value TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, preference_key)
            )
        """)
        conn.commit()
        conn.close()
        print("User preferences table initialized")
    except Exception as e:
        print(f"Failed to initialize user preferences table: {e}")

@app.route('/api/user/preferences/<key>', methods=['GET'])
@require_auth()
def get_user_preference(key):
    """Get a user preference by key"""
    try:
        user_id = g.current_user['user_id']
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        cursor.execute(
            "SELECT preference_value FROM user_preferences WHERE user_id = ? AND preference_key = ?",
            (user_id, key)
        )
        result = cursor.fetchone()
        conn.close()

        if result and result['preference_value']:
            try:
                # Try to parse as JSON
                value = json.loads(result['preference_value'])
                return jsonify({'key': key, 'value': value})
            except json.JSONDecodeError:
                # Return as string if not valid JSON
                return jsonify({'key': key, 'value': result['preference_value']})
        else:
            return jsonify({'key': key, 'value': None})

    except Exception as e:
        print(f"Error getting user preference: {e}")
        return jsonify({'error': 'Failed to get preference'}), 500

@app.route('/api/user/preferences/<key>', methods=['PUT'])
@require_auth()
def set_user_preference(key):
    """Set a user preference by key"""
    try:
        user_id = g.current_user['user_id']
        data = request.get_json()
        value = data.get('value')

        # Serialize value to JSON string
        if value is not None:
            value_str = json.dumps(value) if not isinstance(value, str) else value
        else:
            value_str = None

        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        # Upsert: Insert or update if exists
        cursor.execute("""
            INSERT INTO user_preferences (user_id, preference_key, preference_value, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, preference_key)
            DO UPDATE SET preference_value = ?, updated_at = ?
        """, (user_id, key, value_str, datetime.now().isoformat(),
              value_str, datetime.now().isoformat()))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Preference saved', 'key': key})

    except Exception as e:
        print(f"Error setting user preference: {e}")
        return jsonify({'error': 'Failed to save preference'}), 500

@app.route('/api/user/preferences/<key>', methods=['DELETE'])
@require_auth()
def delete_user_preference(key):
    """Delete a user preference by key"""
    try:
        user_id = g.current_user['user_id']
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM user_preferences WHERE user_id = ? AND preference_key = ?",
            (user_id, key)
        )
        conn.commit()
        conn.close()

        return jsonify({'message': 'Preference deleted', 'key': key})

    except Exception as e:
        print(f"Error deleting user preference: {e}")
        return jsonify({'error': 'Failed to delete preference'}), 500

# =============================================================================
# Public Endpoints
# =============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    provider = get_provider_info()
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'ai_enabled': agent_executor is not None,
        'ai_provider': provider['provider'],
        'ai_model': ai_model_name or provider['model'],
    })


# =============================================================================
# Chat Endpoints
# =============================================================================

def init_chat_history_table():
    """Create the per-user persistent chat history table if needed"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                response TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_history_user "
            "ON chat_history(user_id, created_at)"
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error initializing chat_history table: {e}")


def save_chat_message(user_id: int, question: str, response: str) -> int:
    """Persist a chat exchange for a user. Returns the new row id."""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO chat_history (user_id, question, response, created_at) "
            "VALUES (?, ?, ?, ?)",
            (user_id, question, response, datetime.now().isoformat())
        )
        conn.commit()
        row_id = cursor.lastrowid
        conn.close()
        return row_id or 0
    except Exception as e:
        print(f"Error saving chat message: {e}")
        return 0


@app.route('/api/chat/history', methods=['GET'])
@require_auth(roles=['admin', 'user', 'guest'])
def get_chat_history():
    """Get the current user's chat history (persisted in SQLite)"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, question, response, created_at FROM chat_history "
            "WHERE user_id = ? ORDER BY id ASC",
            (g.current_user.get('user_id'),)
        )
        rows = cursor.fetchall()
        conn.close()

        return jsonify([
            {
                'id': str(row[0]),
                'question': row[1],
                'response': row[2],
                'timestamp': row[3],
            }
            for row in rows
        ])
    except Exception as e:
        print(f"Error loading chat history: {e}")
        return jsonify({'error': 'Failed to load chat history'}), 500


@app.route('/api/chat', methods=['POST'])
@require_auth(roles=['admin', 'user'])
def chat():
    """Handle chat messages (non-streaming fallback)"""
    try:
        data = request.get_json()
        question = (data.get('question') or '').strip() if data else ''

        if not question:
            return jsonify({'error': 'Question is required'}), 400

        if not agent_executor:
            return jsonify({'error': 'AI agent not available'}), 503

        response = agent_executor.invoke({'input': question})
        if isinstance(response, dict):
            output = response.get('output', '')
            response_text = output if isinstance(output, str) else str(output)
        else:
            response_text = str(response)

        save_chat_message(g.current_user.get('user_id'), question, response_text)

        return jsonify({'response': response_text})

    except Exception as e:
        import traceback
        error_msg = f"Error processing chat request: {str(e)}"
        stack_trace = traceback.format_exc()
        print(f"Chat Error: {error_msg}")
        print(f"Stack trace: {stack_trace}")

        # Return more specific error information in development
        return jsonify({
            'error': 'Internal server error',
            'message': str(e),
            'details': 'Check server logs for more information'
        }), 500


@app.route('/api/chat/stream', methods=['POST'])
@require_auth(roles=['admin', 'user'])
def chat_stream():
    """
    Handle chat messages with Server-Sent Events streaming.

    Emits JSON events:
        {"type": "step",  "tool": "<tool_name>"}   - agent invoked a tool
        {"type": "token", "content": "<text>"}     - streamed answer token
        {"type": "done",  "response": "<full>"}    - final complete answer
        {"type": "error", "message": "<reason>"}   - failure occurred
    """
    data = request.get_json()
    question = (data.get('question') or '').strip() if data else ''

    if not question:
        return jsonify({'error': 'Question is required'}), 400

    if not agent_executor:
        return jsonify({'error': 'AI agent not available'}), 503

    user_id = g.current_user.get('user_id')

    def generate():
        loop = asyncio.new_event_loop()
        final_response = ''
        try:
            agen = stream_agent_events(agent_executor, question)
            try:
                while True:
                    event = loop.run_until_complete(agen.__anext__())
                    if event.get('type') == 'done':
                        final_response = event.get('response', '')
                    yield f"data: {json.dumps(event)}\n\n"
            except StopAsyncIteration:
                pass
            finally:
                loop.run_until_complete(agen.aclose())

            if final_response:
                save_chat_message(user_id, question, final_response)
        except Exception as e:
            print(f"Chat stream error: {e}")
            try:
                payload = json.dumps({'type': 'error', 'message': str(e)})
                yield f"data: {payload}\n\n"
            except Exception:
                pass
        finally:
            loop.close()

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        },
    )



@app.route('/api/chat/history', methods=['DELETE'])
@require_auth(roles=['admin', 'user'])
def clear_chat_history():
    """Clear the current user's chat history"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.execute(
            "DELETE FROM chat_history WHERE user_id = ?",
            (g.current_user.get('user_id'),)
        )
        conn.commit()
        conn.close()
        return jsonify({'message': 'Chat history cleared'})
    except Exception as e:
        print(f"Error clearing chat history: {e}")
        return jsonify({'error': 'Failed to clear chat history'}), 500



@app.route('/api/stats/vulnerabilities', methods=['GET'])
def get_vulnerability_stats():
    """Get vulnerability statistics"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Query vulnerability statistics from app_patrol table
        cursor.execute("""
            SELECT 
                COUNT(CASE WHEN VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%' THEN 1 END) as total,
                SUM(CASE WHEN SEVERITY = 'CRITICAL' AND (VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%') THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN SEVERITY = 'HIGH' AND (VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%') THEN 1 ELSE 0 END) as high,
                SUM(CASE WHEN SEVERITY = 'MEDIUM' AND (VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%') THEN 1 ELSE 0 END) as medium,
                SUM(CASE WHEN SEVERITY = 'LOW' AND (VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%') THEN 1 ELSE 0 END) as low
            FROM app_patrol 
            WHERE VULNERABILITY IS NOT NULL AND VULNERABILITY != ''
        """)
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return jsonify({
                'total': result[0] or 0,
                'critical': result[1] or 0,
                'high': result[2] or 0,
                'medium': result[3] or 0,
                'low': result[4] or 0
            })
        else:
            return jsonify({
                'total': 0, 'critical': 0, 'high': 0, 'medium': 0, 'low': 0
            })
            
    except Exception as e:
        print(f"Error getting vulnerability stats: {e}")
        return jsonify({'error': 'Failed to retrieve statistics'}), 500

@app.route('/api/stats/charts', methods=['GET'])
def get_chart_data():
    """Get data formatted for dashboard charts"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()

        # Severity distribution for donut chart
        cursor.execute("""
            SELECT SEVERITY, COUNT(*) as count
            FROM app_patrol
            WHERE VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%'
            GROUP BY SEVERITY
            ORDER BY
                CASE SEVERITY
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END
        """)
        severity_data = [{'name': row[0] or 'Unknown', 'value': row[1]} for row in cursor.fetchall()]

        # Top 10 vulnerable images for bar chart
        cursor.execute("""
            SELECT IMAGE_TAG, COUNT(*) as vulnerability_count
            FROM app_patrol
            WHERE VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%'
            GROUP BY IMAGE_TAG
            ORDER BY vulnerability_count DESC
            LIMIT 10
        """)
        top_images = [{'image': row[0], 'vulnerabilities': row[1]} for row in cursor.fetchall()]

        # Scan history for area chart (last 10 scans)
        cursor.execute("""
            SELECT
                user_scan_name,
                scan_timestamp,
                critical_count,
                high_count,
                medium_count,
                low_count,
                total_vulnerabilities_found
            FROM scan_metadata
            ORDER BY scan_timestamp DESC
            LIMIT 10
        """)
        scan_history = []
        for row in cursor.fetchall():
            scan_history.append({
                'name': row[0] or 'Unnamed',
                'date': row[1],
                'Critical': row[2] or 0,
                'High': row[3] or 0,
                'Medium': row[4] or 0,
                'Low': row[5] or 0,
                'Total': row[6] or 0
            })
        # Reverse to show oldest first for timeline
        scan_history.reverse()

        # Top vulnerable packages
        cursor.execute("""
            SELECT NAME, COUNT(*) as vuln_count,
                   SUM(CASE WHEN SEVERITY = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count
            FROM app_patrol
            WHERE (VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%')
              AND NAME IS NOT NULL AND NAME != ''
            GROUP BY NAME
            ORDER BY vuln_count DESC
            LIMIT 10
        """)
        top_packages = [{'package': row[0], 'vulnerabilities': row[1], 'critical': row[2]} for row in cursor.fetchall()]

        conn.close()

        return jsonify({
            'severityDistribution': severity_data,
            'topVulnerableImages': top_images,
            'scanHistory': scan_history,
            'topVulnerablePackages': top_packages
        })

    except Exception as e:
        print(f"Error getting chart data: {e}")
        return jsonify({'error': 'Failed to retrieve chart data'}), 500

@app.route('/api/activity/recent', methods=['GET'])
def get_recent_activity():
    """Get recent scan activity"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        
        # Get recent scans with their metadata
        cursor.execute("""
            SELECT 
                sm.user_scan_name,
                sm.image_count,
                MIN(ap.DATE_ADDED) as scan_date,
                COUNT(CASE WHEN ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%' THEN 1 END) as vulnerabilities,
                COUNT(CASE WHEN ap.SEVERITY = 'CRITICAL' AND (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') THEN 1 END) as critical,
                COUNT(CASE WHEN ap.SEVERITY = 'HIGH' AND (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') THEN 1 END) as high
            FROM scan_metadata sm
            LEFT JOIN app_patrol ap ON substr(ap.DATE_ADDED, 1, 19) = substr(sm.scan_timestamp, 1, 19)
            GROUP BY sm.scan_timestamp, sm.user_scan_name, sm.image_count
            ORDER BY sm.scan_timestamp DESC
            LIMIT 10
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        activities = []
        for row in results:
            user_scan_name, image_count, scan_date, vulnerabilities, critical, high = row
            
            # Determine severity based on vulnerabilities found
            if critical > 0:
                severity = 'critical'
                description = f"Scan '{user_scan_name}' found {critical} critical vulnerabilities"
            elif high > 0:
                severity = 'high'
                description = f"Scan '{user_scan_name}' found {high} high-priority vulnerabilities"
            elif vulnerabilities > 0:
                severity = 'medium'
                description = f"Scan '{user_scan_name}' found {vulnerabilities} vulnerabilities"
            else:
                severity = 'info'
                description = f"Scan '{user_scan_name}' completed successfully - no vulnerabilities found"
            
            # Calculate time ago (simplified)
            from datetime import datetime
            try:
                scan_time = datetime.strptime(scan_date, '%Y-%m-%d %H:%M:%S')
                time_diff = datetime.now() - scan_time
                if time_diff.days > 0:
                    time_ago = f"{time_diff.days} day{'s' if time_diff.days > 1 else ''} ago"
                elif time_diff.seconds > 3600:
                    hours = time_diff.seconds // 3600
                    time_ago = f"{hours} hour{'s' if hours > 1 else ''} ago"
                elif time_diff.seconds > 60:
                    minutes = time_diff.seconds // 60
                    time_ago = f"{minutes} minute{'s' if minutes > 1 else ''} ago"
                else:
                    time_ago = "Just now"
            except:
                time_ago = "Recently"
            
            activities.append({
                'id': len(activities) + 1,
                'type': 'scan',
                'description': description,
                'time': time_ago,
                'severity': severity
            })
        
        return jsonify(activities)
        
    except Exception as e:
        print(f"Error getting recent activity: {e}")
        return jsonify([]), 500

@app.route('/api/database/query', methods=['POST'])
@require_auth(roles=['admin'])
def execute_database_query():
    """Execute a read-only SQL query against the database (admin only)"""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()

        if not query:
            return jsonify({'error': 'Query is required'}), 400

        # Security: Only allow SELECT queries
        query_upper = query.upper().strip()
        if not query_upper.startswith('SELECT'):
            return jsonify({'error': 'Only SELECT queries are allowed'}), 403

        # Security: Block dangerous keywords
        dangerous_keywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE', '--', ';--']
        for keyword in dangerous_keywords:
            if keyword in query_upper:
                return jsonify({'error': f'Query contains forbidden keyword: {keyword}'}), 403

        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        cursor.execute(query)

        # Get column names
        columns = [description[0] for description in cursor.description] if cursor.description else []

        # Fetch results
        rows = cursor.fetchall()
        conn.close()

        # Convert to list of dicts
        results = []
        for row in rows:
            results.append(dict(zip(columns, row)))

        return jsonify({
            'columns': columns,
            'rows': results,
            'count': len(results)
        })

    except Exception as e:
        print(f"Error executing query: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/database/stats', methods=['GET'])
@require_auth(roles=['admin'])
def get_database_stats():
    """Get database statistics (admin only)"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()

        # Get table count
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        table_count = cursor.fetchone()[0]

        # Get total records in app_patrol
        cursor.execute("SELECT COUNT(*) FROM app_patrol")
        app_patrol_count = cursor.fetchone()[0]

        # Get total records in scan_metadata
        cursor.execute("SELECT COUNT(*) FROM scan_metadata")
        scan_metadata_count = cursor.fetchone()[0]

        conn.close()

        return jsonify({
            'tables': table_count,
            'total_records': app_patrol_count + scan_metadata_count,
            'app_patrol_records': app_patrol_count,
            'scan_metadata_records': scan_metadata_count
        })

    except Exception as e:
        print(f"Error getting database stats: {e}")
        return jsonify({'error': 'Failed to retrieve database statistics'}), 500

@app.route('/api/scans', methods=['GET'])
def get_scans():
    """Get scan results"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # First get comprehensive scan metadata
        cursor.execute("""
            SELECT
                scan_timestamp, user_scan_name, image_count,
                scan_duration, total_packages_scanned, total_vulnerabilities_found,
                scan_status, scan_type, syft_version, grype_version,
                scan_engine, scan_source, risk_score, critical_count,
                high_count, medium_count, low_count, exploitable_count,
                scan_initiator, compliance_policy, scan_tags, project_name, environment
            FROM scan_metadata
            ORDER BY scan_timestamp DESC
        """)
        metadata_results = cursor.fetchall()
        
        # Create comprehensive metadata map
        metadata_map = {}
        for row in metadata_results:
            timestamp = row[0][:19]  # Use 19 chars for better precision
            metadata_map[timestamp] = {
                'user_scan_name': row[1],
                'image_count': row[2],
                'scan_duration': row[3],
                'total_packages_scanned': row[4],
                'total_vulnerabilities_found': row[5],
                'scan_status': row[6],
                'scan_type': row[7],
                'syft_version': row[8],
                'grype_version': row[9],
                'scan_engine': row[10],
                'scan_source': row[11],
                'risk_score': row[12],
                'critical_count': row[13],
                'high_count': row[14],
                'medium_count': row[15],
                'low_count': row[16],
                'exploitable_count': row[17],
                'scan_initiator': row[18],
                'compliance_policy': row[19],
                'scan_tags': json.loads(row[20]) if row[20] else [],
                'project_name': row[21],
                'environment': row[22]
            }
        
        # Then get scan sessions 
        cursor.execute("""
            SELECT 
                MIN(ap.DATE_ADDED) as scan_date,
                GROUP_CONCAT(DISTINCT ap.IMAGE_TAG) as images,
                COUNT(CASE WHEN ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%' THEN 1 END) as vulnerabilities,
                COUNT(CASE WHEN (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') AND ap.SEVERITY = 'CRITICAL' THEN 1 END) as critical,
                COUNT(CASE WHEN (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') AND ap.SEVERITY = 'HIGH' THEN 1 END) as high,
                COUNT(CASE WHEN (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') AND ap.SEVERITY = 'MEDIUM' THEN 1 END) as medium,
                COUNT(CASE WHEN (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') AND ap.SEVERITY = 'LOW' THEN 1 END) as low,
                COUNT(DISTINCT ap.IMAGE_TAG) as image_count,
                SUM(CASE WHEN ap.NAME LIKE '% packages' THEN CAST(SUBSTR(ap.NAME, 1, INSTR(ap.NAME, ' ') - 1) AS INTEGER) ELSE 0 END) as total_packages,
                COUNT(*) as total_records
            FROM app_patrol ap
            WHERE ap.DATE_ADDED IS NOT NULL
            GROUP BY substr(ap.DATE_ADDED, 1, 19)
            ORDER BY scan_date DESC
            LIMIT 50
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        scans = []
        for row in results:
            scan_date, images, vulnerabilities, critical, high, medium, low, image_count, total_packages, total_records = row
            # Look up comprehensive metadata
            time_key = scan_date[:19]
            metadata = metadata_map.get(time_key, {})
            
            # Use metadata values if available, otherwise fall back to calculated values
            user_scan_name = metadata.get('user_scan_name')
            scan_name = user_scan_name if user_scan_name else f"Scan {scan_date[:10]} {scan_date[11:16]} - {image_count} images"
            
            # Get the first image for display
            first_image = images.split(',')[0] if images else 'Unknown'
            
            # Use metadata counts if available, otherwise use calculated values
            final_critical = metadata.get('critical_count', critical or 0)
            final_high = metadata.get('high_count', high or 0)
            final_medium = metadata.get('medium_count', medium or 0)
            final_low = metadata.get('low_count', low or 0)
            final_vulns = metadata.get('total_vulnerabilities_found', vulnerabilities or 0)
            final_packages = metadata.get('total_packages_scanned', total_packages or 0)
            
            scans.append({
                'id': f"scan_{hash(scan_date)}",
                'image': first_image,
                'images': images.split(',') if images else [],
                'timestamp': scan_date,
                'status': metadata.get('scan_status', 'completed').lower(),
                'vulnerabilities': final_vulns,
                'critical': final_critical,
                'high': final_high,
                'medium': final_medium,
                'low': final_low,
                'image_count': image_count,
                'packages': final_packages,
                'name': scan_name,
                'user_scan_name': user_scan_name,
                # New metadata fields
                'scan_duration': metadata.get('scan_duration', 0),
                'scan_type': metadata.get('scan_type', 'FULL'),
                'syft_version': metadata.get('syft_version'),
                'grype_version': metadata.get('grype_version'),
                'scan_engine': metadata.get('scan_engine', 'DOCKER_PULL'),
                'scan_source': metadata.get('scan_source', 'FILE_UPLOAD'),
                'risk_score': metadata.get('risk_score', 0.0),
                'exploitable_count': metadata.get('exploitable_count', 0),
                'scan_initiator': metadata.get('scan_initiator', 'system'),
                'compliance_policy': metadata.get('compliance_policy'),
                'scan_tags': metadata.get('scan_tags', []),
                'project_name': metadata.get('project_name'),
                'environment': metadata.get('environment')
            })
        
        return jsonify(scans)
        
    except Exception as e:
        print(f"Error getting scans: {e}")
        return jsonify({'error': 'Failed to retrieve scans'}), 500

@app.route('/api/scans/<scan_id>', methods=['DELETE'])
@require_auth(roles=['admin'])
def delete_scan(scan_id):
    """Delete a scan and all its associated data (admin only)"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        
        # Find the timestamp for this scan_id
        cursor.execute("""
            SELECT MIN(ap.DATE_ADDED) as scan_date
            FROM app_patrol ap
            WHERE ap.DATE_ADDED IS NOT NULL
            GROUP BY substr(ap.DATE_ADDED, 1, 19)
            ORDER BY scan_date DESC
            LIMIT 50
        """)
        
        scan_mappings = cursor.fetchall()
        target_timestamp = None
        
        for scan_date in scan_mappings:
            if f"scan_{hash(scan_date[0])}" == scan_id:
                target_timestamp = scan_date[0][:15]
                break
        
        if not target_timestamp:
            return jsonify({'error': 'Scan not found'}), 404
        
        # Delete from app_patrol table
        cursor.execute("""
            DELETE FROM app_patrol 
            WHERE substr(DATE_ADDED, 1, 19) = ?
        """, (target_timestamp,))
        
        # Delete from scan_metadata table
        cursor.execute("""
            DELETE FROM scan_metadata 
            WHERE substr(scan_timestamp, 1, 19) = ?
        """, (target_timestamp,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Scan deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting scan: {e}")
        return jsonify({'error': 'Failed to delete scan'}), 500

@app.route('/api/scans/<scan_id>/images', methods=['GET'])
def get_scan_images(scan_id):
    """Get vulnerability breakdown per image for a specific scan"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        
        # First, get all scans with their hash IDs to find the matching timestamp
        cursor.execute("""
            SELECT 
                MIN(ap.DATE_ADDED) as scan_date,
                substr(ap.DATE_ADDED, 1, 19) as time_group
            FROM app_patrol ap
            WHERE ap.DATE_ADDED IS NOT NULL
            GROUP BY substr(ap.DATE_ADDED, 1, 19)
            ORDER BY scan_date DESC
            LIMIT 50
        """)
        
        scan_mappings = cursor.fetchall()
        
        # Find the timestamp group that matches our scan_id
        target_time_group = None
        for scan_date, time_group in scan_mappings:
            if f"scan_{hash(scan_date)}" == scan_id:
                target_time_group = time_group
                break
        
        if not target_time_group:
            return jsonify([])
        
        # Get vulnerability breakdown for all images in this scan
        cursor.execute("""
            SELECT 
                ap.IMAGE_TAG,
                COUNT(CASE WHEN ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%' THEN 1 END) as vulnerabilities,
                COUNT(CASE WHEN (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') AND ap.SEVERITY = 'CRITICAL' THEN 1 END) as critical,
                COUNT(CASE WHEN (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') AND ap.SEVERITY = 'HIGH' THEN 1 END) as high,
                COUNT(CASE WHEN (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') AND ap.SEVERITY = 'MEDIUM' THEN 1 END) as medium,
                COUNT(CASE WHEN (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%') AND ap.SEVERITY = 'LOW' THEN 1 END) as low
            FROM app_patrol ap
            WHERE substr(ap.DATE_ADDED, 1, 19) = ?
            GROUP BY ap.IMAGE_TAG
        """, (target_time_group,))
        
        results = cursor.fetchall()
        conn.close()
        
        # Format results
        images_data = []
        for row in results:
            image_tag, vulnerabilities, critical, high, medium, low = row
            images_data.append({
                'image': image_tag,
                'vulnerabilities': vulnerabilities or 0,
                'critical': critical or 0,
                'high': high or 0,
                'medium': medium or 0,
                'low': low or 0
            })
        
        return jsonify(images_data)
        
    except Exception as e:
        print(f"Error getting scan images: {e}")
        return jsonify({'error': 'Failed to retrieve scan images'}), 500

@app.route('/api/scans/<scan_id>/images/<path:image_name>/vulnerabilities', methods=['GET'])
def get_image_vulnerabilities(scan_id, image_name):
    """Get detailed vulnerability information for a specific image in a scan"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        
        # Find the timestamp group that matches our scan_id
        cursor.execute("""
            SELECT 
                MIN(ap.DATE_ADDED) as scan_date,
                substr(ap.DATE_ADDED, 1, 19) as time_group
            FROM app_patrol ap
            WHERE ap.DATE_ADDED IS NOT NULL
            GROUP BY substr(ap.DATE_ADDED, 1, 19)
            ORDER BY scan_date DESC
            LIMIT 50
        """)
        
        scan_mappings = cursor.fetchall()
        target_time_group = None
        
        for scan_date, time_group in scan_mappings:
            if f"scan_{hash(scan_date)}" == scan_id:
                target_time_group = time_group
                break
        
        if not target_time_group:
            return jsonify([])
        
        # Get detailed vulnerabilities for the specific image
        cursor.execute("""
            SELECT 
                ap.VULNERABILITY,
                ap.SEVERITY,
                ap.NAME as package_name,
                ap.INSTALLED as package_version
            FROM app_patrol ap
            WHERE substr(ap.DATE_ADDED, 1, 19) = ?
            AND ap.IMAGE_TAG = ?
            AND (ap.VULNERABILITY LIKE 'CVE-%' OR ap.VULNERABILITY LIKE 'GHSA-%')
            ORDER BY ap.SEVERITY DESC, ap.VULNERABILITY
        """, (target_time_group, image_name))
        
        results = cursor.fetchall()
        conn.close()
        
        # Format results
        vulnerabilities = []
        for row in results:
            vulnerability, severity, package_name, package_version = row
            vulnerabilities.append({
                'id': vulnerability,
                'severity': severity,
                'package': package_name,
                'version': package_version
            })
        
        return jsonify(vulnerabilities)
        
    except Exception as e:
        print(f"Error getting image vulnerabilities: {e}")
        return jsonify({'error': 'Failed to retrieve image vulnerabilities'}), 500

# Old CVE endpoints removed to avoid conflicts
# Using new /api/cves endpoints instead

# Real Scanning Endpoints
    try:
        limit = request.args.get('limit', 50, type=int)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Try to get CVEs from nvd_cves table, fallback to app_patrol
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nvd_cves'")
        has_nvd_table = cursor.fetchone() is not None
        
        if has_nvd_table:
            cursor.execute("""
                SELECT cve_id, description, cvss_v30_base_severity, cvss_v30_base_score, published
                FROM nvd_cves
                ORDER BY published DESC, cvss_v30_base_score DESC
                LIMIT ?
            """, (limit,))
        else:
            # Fallback to app_patrol table
            cursor.execute("""
                SELECT DISTINCT 
                    VULNERABILITY as cve_id,
                    VULNERABILITY as description,
                    SEVERITY,
                    0 as cvss_score,
                    DATE_ADDED as published_date
                FROM app_patrol
                WHERE VULNERABILITY IS NOT NULL AND VULNERABILITY != ''
                ORDER BY DATE_ADDED DESC
                LIMIT ?
            """, (limit,))
        
        results = cursor.fetchall()
        conn.close()
        
        cves = []
        for row in results:
            cves.append({
                'id': row[0] or f"UNKNOWN-{len(cves)}",
                'description': row[1] or 'No description available',
                'severity': row[2] or 'UNKNOWN',
                'score': float(row[3]) if row[3] else 0.0,
                'published': row[4] or datetime.now().isoformat(),
                'affected_packages': []  # Could be populated from package data
            })
        
        return jsonify(cves)
        
    except Exception as e:
        print(f"Error getting CVEs: {e}")
        return jsonify({'error': 'Failed to retrieve CVEs'}), 500

@app.route('/cves/search', methods=['GET'])
def search_cves():
    """Search CVEs"""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify([])
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Search in available tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nvd_cves'")
        has_nvd_table = cursor.fetchone() is not None
        
        if has_nvd_table:
            cursor.execute("""
                SELECT cve_id, description, cvss_v30_base_severity, cvss_v30_base_score, published
                FROM nvd_cves
                WHERE cve_id LIKE ? OR description LIKE ?
                ORDER BY cvss_v30_base_score DESC
                LIMIT 25
            """, (f'%{query}%', f'%{query}%'))
        else:
            cursor.execute("""
                SELECT DISTINCT 
                    VULNERABILITY as cve_id,
                    VULNERABILITY as description,
                    SEVERITY,
                    0 as cvss_score,
                    DATE_ADDED as published_date
                FROM app_patrol
                WHERE VULNERABILITY LIKE ? OR VULNERABILITY LIKE ?
                ORDER BY DATE_ADDED DESC
                LIMIT 25
            """, (f'%{query}%', f'%{query}%'))
        
        results = cursor.fetchall()
        conn.close()
        
        cves = []
        for row in results:
            cves.append({
                'id': row[0] or f"UNKNOWN-{len(cves)}",
                'description': row[1] or 'No description available',
                'severity': row[2] or 'UNKNOWN',
                'score': float(row[3]) if row[3] else 0.0,
                'published': row[4] or datetime.now().isoformat(),
                'affected_packages': []
            })
        
        return jsonify(cves)
        
    except Exception as e:
        print(f"Error searching CVEs: {e}")
        return jsonify({'error': 'Search failed'}), 500

# Real Scanning Endpoints
@app.route('/api/scans/start', methods=['POST'])
@require_auth(roles=['admin', 'user'])
def start_scan():
    """Start a real vulnerability scan"""
    try:
        data = request.json
        scan_name = data.get('name', 'Untitled Scan')
        targets = data.get('targets', [])
        scan_type = data.get('type', 'container')
        
        # Extract additional metadata from request
        scan_initiator = data.get('scan_initiator', 'user')
        project_name = data.get('project_name')
        environment = data.get('environment')
        scan_tags = data.get('scan_tags', [])
        compliance_policy = data.get('compliance_policy')
        
        if not targets:
            return jsonify({'error': 'No targets provided'}), 400
        
        # Check if scan name already exists (skip if table doesn't exist yet)
        try:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            # Check if table exists first
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scan_metadata'")
            if cursor.fetchone():
                cursor.execute("SELECT COUNT(*) FROM scan_metadata WHERE user_scan_name = ?", (scan_name,))
                count = cursor.fetchone()[0]
                if count > 0:
                    conn.close()
                    return jsonify({'error': f'Scan name "{scan_name}" already exists. Please choose a different name.'}), 400
            conn.close()
        except Exception as e:
            print(f"Error checking scan name: {e}")
            # Don't block scan if validation fails - table might not exist yet
            pass
        
        # Generate unique scan ID
        scan_id = f"scan-{int(datetime.now().timestamp())}"
        
        print(f"Starting real scan: {scan_name} with {len(targets)} targets")
        
        # Start the scan asynchronously with metadata
        def run_scan():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(scanner.start_scan(
                scan_id, scan_name, targets,
                scan_initiator=scan_initiator,
                project_name=project_name,
                environment=environment,
                scan_tags=scan_tags
            ))
            loop.close()
        
        import threading
        scan_thread = threading.Thread(target=run_scan)
        scan_thread.daemon = True
        scan_thread.start()
        
        return jsonify({
            'scan_id': scan_id,
            'status': 'started',
            'message': f'Started scan: {scan_name}'
        })
        
    except Exception as e:
        print(f"Error starting scan: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans/<scan_id>/progress', methods=['GET'])
def get_scan_progress(scan_id):
    """Get scan progress"""
    try:
        progress = scanner.get_scan_progress(scan_id)
        if progress:
            return jsonify(progress)
        else:
            return jsonify({'error': 'Scan not found'}), 404
            
    except Exception as e:
        print(f"Error getting scan progress: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans/<scan_id>/logs', methods=['GET'])
def get_scan_logs(scan_id):
    """Get scan logs"""
    try:
        logs = scanner.get_scan_logs(scan_id)
        return jsonify({'logs': logs})
        
    except Exception as e:
        print(f"Error getting scan logs: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans/active', methods=['GET'])
def get_active_scans():
    """Get list of active scans"""
    try:
        active_scan_ids = scanner.list_active_scans()
        active_scans = []
        
        for scan_id in active_scan_ids:
            progress = scanner.get_scan_progress(scan_id)
            if progress:
                active_scans.append(progress)
        
        return jsonify({'active_scans': active_scans})
        
    except Exception as e:
        print(f"Error getting active scans: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cves', methods=['GET'])
def get_cves():
    """Get list of CVEs with counts and severity info"""
    try:
        limit = request.args.get('limit', 50, type=int)
        search = request.args.get('search', '', type=str)
        severity_filter = request.args.get('severity', '', type=str)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Build WHERE clause
        where_conditions = []
        params = []
        
        # Filter by search term
        if search:
            where_conditions.append("(VULNERABILITY LIKE ? OR NAME LIKE ?)")
            params.extend([f'%{search}%', f'%{search}%'])
        
        # Filter by severity
        if severity_filter:
            where_conditions.append("SEVERITY = ?")
            params.append(severity_filter.upper())
        
        # Only include actual CVEs/GHSAs
        where_conditions.append("(VULNERABILITY LIKE 'CVE-%' OR VULNERABILITY LIKE 'GHSA-%')")
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        # Get CVE summary data
        cursor.execute(f"""
            SELECT 
                VULNERABILITY,
                SEVERITY,
                COUNT(DISTINCT IMAGE_TAG) as affected_images,
                COUNT(DISTINCT NAME) as affected_packages,
                COUNT(*) as total_occurrences,
                MIN(DATE_ADDED) as first_seen,
                MAX(DATE_ADDED) as last_seen
            FROM app_patrol 
            WHERE {where_clause}
            GROUP BY VULNERABILITY, SEVERITY
            ORDER BY 
                CASE SEVERITY 
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END,
                total_occurrences DESC
            LIMIT ?
        """, params + [limit])
        
        results = cursor.fetchall()
        conn.close()
        
        cves = []
        for row in results:
            vulnerability, severity, affected_images, affected_packages, total_occurrences, first_seen, last_seen = row
            cves.append({
                'id': vulnerability,
                'severity': severity,
                'affected_images': affected_images,
                'affected_packages': affected_packages,
                'total_occurrences': total_occurrences,
                'first_seen': first_seen,
                'last_seen': last_seen,
                'cvss_score': None  # Could be enhanced later
            })
        
        return jsonify(cves)
        
    except Exception as e:
        print(f"Error getting CVEs: {e}")
        return jsonify({'error': 'Failed to retrieve CVEs'}), 500

@app.route('/api/cves/<cve_id>/details', methods=['GET'])
def get_cve_details(cve_id):
    """Get detailed information about a specific CVE"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Get detailed CVE information
        cursor.execute("""
            SELECT DISTINCT
                ap.VULNERABILITY,
                ap.SEVERITY,
                ap.NAME as package_name,
                ap.INSTALLED as package_version,
                ap.FIXED_IN as fixed_version,
                ap.TYPE as package_type,
                ap.IMAGE_TAG as image,
                ap.DATE_ADDED,
                sm.user_scan_name,
                sm.scan_timestamp
            FROM app_patrol ap
            LEFT JOIN scan_metadata sm ON substr(ap.DATE_ADDED, 1, 19) = substr(sm.scan_timestamp, 1, 19)
            WHERE ap.VULNERABILITY = ?
            ORDER BY ap.DATE_ADDED DESC
        """, (cve_id,))
        
        results = cursor.fetchall()
        conn.close()
        
        if not results:
            return jsonify({'error': 'CVE not found'}), 404
        
        # Group by scan and image
        scans = {}
        packages = []
        images = set()
        
        for row in results:
            vulnerability, severity, pkg_name, pkg_version, fixed_version, pkg_type, image, date_added, scan_name, scan_timestamp = row
            
            # Track unique images
            images.add(image)
            
            # Group by scan
            scan_key = scan_timestamp or date_added[:19]
            if scan_key not in scans:
                scans[scan_key] = {
                    'scan_name': scan_name or f"Scan {date_added[:10]}",
                    'scan_timestamp': scan_timestamp or date_added,
                    'images': set(),
                    'packages': []
                }
            
            scans[scan_key]['images'].add(image)
            scans[scan_key]['packages'].append({
                'name': pkg_name,
                'version': pkg_version,
                'fixed_in': fixed_version,
                'type': pkg_type,
                'image': image
            })
            
            # Track all packages
            packages.append({
                'name': pkg_name,
                'version': pkg_version,
                'fixed_in': fixed_version,
                'type': pkg_type,
                'image': image,
                'scan_name': scan_name
            })
        
        # Convert sets to lists for JSON serialization
        for scan in scans.values():
            scan['images'] = list(scan['images'])
        
        cve_details = {
            'id': cve_id,
            'severity': results[0][1],
            'affected_images': list(images),
            'affected_packages': len(set((p['name'], p['version']) for p in packages)),
            'total_occurrences': len(packages),
            'scans': list(scans.values()),
            'packages': packages
        }
        
        return jsonify(cve_details)
        
    except Exception as e:
        print(f"Error getting CVE details: {e}")
        return jsonify({'error': 'Failed to retrieve CVE details'}), 500

# =============================================================================
# Startup Initialization
# =============================================================================
# Runs at import time so the app is fully initialized under both
# `python flask_backend.py` and gunicorn (which imports the module
# without executing __main__). Safe to call multiple times.

_bootstrap_done = False


def bootstrap_app():
    """Initialize AI agent and database tables."""
    global _bootstrap_done
    if _bootstrap_done:
        return
    _bootstrap_done = True

    agent_initialized = initialize_agent()
    if not agent_initialized:
        print("Running without AI capabilities")

    init_chat_history_table()
    init_user_preferences_table()


bootstrap_app()


if __name__ == '__main__':
    print("Starting ChatCVE API Backend...")

    # Check database connection
    conn = get_db_connection()
    if conn:
        print(f"Database connection successful: {DATABASE_PATH}")
        conn.close()
    else:
        print(f"Warning: Could not connect to database: {DATABASE_PATH}")

    print("API Backend ready!")
    app.run(host='0.0.0.0', port=5000, debug=True)
