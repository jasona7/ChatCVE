#!/usr/bin/env python3
"""
Enhanced Flask backend for ChatCVE with REST API endpoints
Extends the existing functionality to support the new Next.js frontend
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from langchain.sql_database import SQLDatabase
from langchain.llms.openai import OpenAI
from langchain.agents import create_sql_agent
from langchain_community.agent_toolkits import SQLDatabaseToolkit
import os
import re
import sqlite3
import json
from datetime import datetime, timedelta
from sqlalchemy.exc import SQLAlchemyError
import subprocess
import threading
import uuid

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js frontend

# Initialize LLM with OpenAI API key
llm = OpenAI(openai_api_key=os.environ.get("OPENAI_API_KEY"))

# Define the SQLDatabaseToolkit connection
db = SQLDatabase.from_uri("sqlite:///app_patrol.db")
toolkit = SQLDatabaseToolkit(db=db, llm=llm)

agent_executor = create_sql_agent(llm=llm, toolkit=toolkit, verbose=True)

# History of questions and answers
chat_history = []

# Active scans tracking
active_scans = {}

def execute_sql_query(query):
    try:
        result = db.session.execute(query)
        return [dict(row) for row in result.fetchall()]
    except SQLAlchemyError as e:
        return str(e)

def get_db_connection():
    """Get SQLite database connection"""
    return sqlite3.connect('app_patrol.db')

# Original route for backward compatibility
@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        user_input = request.form.get('question')
        if user_input:
            guardrails = "Do not use sql LIMIT in the results. the tables in the database are nvd_findings and also app_patrol. Output should only be the SQL query result."
            safe_user_input = guardrails + user_input
            response = agent_executor.run(safe_user_input)

            if re.match(r"\s*SELECT\s+", response, re.IGNORECASE):
                results = execute_sql_query(response)
                formatted_results = ', '.join([str(row) for row in results])
                response = formatted_results

            chat_history.insert(0, (user_input, response))

    return render_template('index.html', history=chat_history)

# API Routes for Next.js frontend

@app.route('/api/chat', methods=['POST'])
def api_chat():
    """Handle chat messages from frontend"""
    try:
        data = request.get_json()
        question = data.get('question', '')
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400

        guardrails = "Do not use sql LIMIT in the results. the tables in the database are nvd_findings and also app_patrol. Output should only be the SQL query result."
        safe_user_input = guardrails + question
        response = agent_executor.run(safe_user_input)

        # Check if the response is a SQL statement and execute it
        if re.match(r"\s*SELECT\s+", response, re.IGNORECASE):
            results = execute_sql_query(response)
            formatted_results = ', '.join([str(row) for row in results])
            response = formatted_results

        # Save to history
        chat_entry = {
            'id': str(uuid.uuid4()),
            'question': question,
            'answer': response,
            'timestamp': datetime.now().isoformat(),
            'saved': False
        }
        chat_history.insert(0, chat_entry)

        return jsonify({'answer': response, 'message_id': chat_entry['id']})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/history', methods=['GET'])
def api_chat_history():
    """Get chat history"""
    return jsonify(chat_history)

@app.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    """Get dashboard statistics"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Total vulnerabilities
        cursor.execute("SELECT COUNT(*) FROM app_patrol")
        total_vulnerabilities = cursor.fetchone()[0]
        
        # Severity counts
        cursor.execute("SELECT SEVERITY, COUNT(*) FROM app_patrol GROUP BY SEVERITY")
        severity_counts = dict(cursor.fetchall())
        
        # Scanned images
        cursor.execute("SELECT COUNT(DISTINCT IMAGE_TAG) FROM app_patrol")
        scanned_images = cursor.fetchone()[0]
        
        # Latest scan date
        cursor.execute("SELECT MAX(DATE_ADDED) FROM app_patrol")
        latest_scan_date = cursor.fetchone()[0] or datetime.now().isoformat()
        
        # Top vulnerable packages
        cursor.execute("""
            SELECT NAME, COUNT(*) as count 
            FROM app_patrol 
            GROUP BY NAME 
            ORDER BY count DESC 
            LIMIT 10
        """)
        top_packages = [{'name': row[0], 'count': row[1]} for row in cursor.fetchall()]
        
        conn.close()
        
        stats = {
            'total_vulnerabilities': total_vulnerabilities,
            'critical_count': severity_counts.get('Critical', 0),
            'high_count': severity_counts.get('High', 0),
            'medium_count': severity_counts.get('Medium', 0),
            'low_count': severity_counts.get('Low', 0),
            'negligible_count': severity_counts.get('Negligible', 0),
            'scanned_images': scanned_images,
            'latest_scan_date': latest_scan_date,
            'top_vulnerable_packages': top_packages
        }
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cves', methods=['GET'])
def api_get_cves():
    """Get CVE records with optional filtering"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Build query with filters
        query = "SELECT * FROM app_patrol WHERE 1=1"
        params = []
        
        # Filter by severity
        severity_filter = request.args.get('severity')
        if severity_filter:
            severities = severity_filter.split(',')
            query += f" AND SEVERITY IN ({','.join(['?' for _ in severities])})"
            params.extend(severities)
        
        # Search filter
        search_term = request.args.get('search')
        if search_term:
            query += " AND (NAME LIKE ? OR VULNERABILITY LIKE ? OR IMAGE_TAG LIKE ?)"
            search_pattern = f"%{search_term}%"
            params.extend([search_pattern, search_pattern, search_pattern])
        
        # Pagination
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        query += " ORDER BY DATE_ADDED DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        columns = [description[0] for description in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scans', methods=['GET', 'POST'])
def api_scans():
    """Get scan history or start new scan"""
    if request.method == 'GET':
        # Return current scans (mock data for now)
        return jsonify(list(active_scans.values()))
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            image_name = data.get('image_name', '')
            
            if not image_name:
                return jsonify({'error': 'Image name is required'}), 400
            
            scan_id = str(uuid.uuid4())
            scan_job = {
                'id': scan_id,
                'image_name': image_name,
                'status': 'pending',
                'started_at': datetime.now().isoformat(),
                'completed_at': None,
                'vulnerabilities_found': None
            }
            
            active_scans[scan_id] = scan_job
            
            # Start scan in background thread
            def run_scan():
                try:
                    active_scans[scan_id]['status'] = 'running'
                    
                    # Run the actual scan using existing scan.py functionality
                    # This is a simplified version - in practice you'd integrate with scan.py
                    result = subprocess.run(['python', 'scan.py', image_name], 
                                          capture_output=True, text=True, timeout=300)
                    
                    if result.returncode == 0:
                        active_scans[scan_id]['status'] = 'completed'
                        active_scans[scan_id]['completed_at'] = datetime.now().isoformat()
                        
                        # Get vulnerability counts
                        conn = get_db_connection()
                        cursor = conn.cursor()
                        cursor.execute("""
                            SELECT SEVERITY, COUNT(*) 
                            FROM app_patrol 
                            WHERE IMAGE_TAG = ? 
                            GROUP BY SEVERITY
                        """, (image_name,))
                        
                        severity_counts = dict(cursor.fetchall())
                        active_scans[scan_id]['vulnerabilities_found'] = sum(severity_counts.values())
                        active_scans[scan_id]['critical_count'] = severity_counts.get('Critical', 0)
                        active_scans[scan_id]['high_count'] = severity_counts.get('High', 0)
                        active_scans[scan_id]['medium_count'] = severity_counts.get('Medium', 0)
                        active_scans[scan_id]['low_count'] = severity_counts.get('Low', 0)
                        
                        conn.close()
                    else:
                        active_scans[scan_id]['status'] = 'failed'
                        
                except Exception as e:
                    active_scans[scan_id]['status'] = 'failed'
                    print(f"Scan failed: {e}")
            
            thread = threading.Thread(target=run_scan)
            thread.start()
            
            return jsonify({'scanId': scan_id})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/scans/<scan_id>/stop', methods=['POST'])
def api_stop_scan(scan_id):
    """Stop a running scan"""
    if scan_id in active_scans:
        active_scans[scan_id]['status'] = 'stopped'
        return jsonify({'message': 'Scan stopped'})
    return jsonify({'error': 'Scan not found'}), 404

@app.route('/api/scans/<scan_id>', methods=['DELETE'])
def api_delete_scan(scan_id):
    """Delete a scan record"""
    if scan_id in active_scans:
        del active_scans[scan_id]
        return jsonify({'message': 'Scan deleted'})
    return jsonify({'error': 'Scan not found'}), 404

@app.route('/api/database/query', methods=['POST'])
def api_database_query():
    """Execute raw SQL query"""
    try:
        data = request.get_json()
        query = data.get('query', '')
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # Basic security check - only allow SELECT statements
        if not re.match(r'\s*SELECT\s+', query, re.IGNORECASE):
            return jsonify({'error': 'Only SELECT queries are allowed'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query)
        
        columns = [description[0] for description in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/database/tables', methods=['GET'])
def api_get_tables():
    """Get list of database tables"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(tables)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/database/tables/<table_name>/schema', methods=['GET'])
def api_get_table_schema(table_name):
    """Get schema for a specific table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name})")
        schema = [{'name': row[1], 'type': row[2], 'not_null': bool(row[3])} for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(schema)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)