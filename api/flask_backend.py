#!/usr/bin/env python3
"""
Flask API Backend for ChatCVE Frontend
Provides REST API endpoints for the Next.js frontend
"""

import os
import json
import sqlite3
import asyncio
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from scan_service import scanner
from langchain_openai import ChatOpenAI
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_community.utilities import SQLDatabase
from langchain.agents import create_sql_agent
from langchain.agents.agent_types import AgentType

app = Flask(__name__)
CORS(app)

# Configuration
DATABASE_PATH = os.getenv('DATABASE_PATH', '../app_patrol.db')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Initialize ChatCVE components
llm = None
agent_executor = None
chat_history = []

def initialize_agent():
    """Initialize the ChatCVE AI agent"""
    global llm, agent_executor
    
    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY not set. AI features will be disabled.")
        return False
    
    try:
        llm = ChatOpenAI(
            model="gpt-4",
            temperature=0,
            openai_api_key=OPENAI_API_KEY
        )
        
        # Connect to SQLite database
        db = SQLDatabase.from_uri(f"sqlite:///{DATABASE_PATH}")
        toolkit = SQLDatabaseToolkit(db=db, llm=llm)
        
        agent_executor = create_sql_agent(
            llm=llm,
            toolkit=toolkit,
            verbose=True,
            agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
            handle_parsing_errors=True
        )
        
        print("ChatCVE AI agent initialized successfully")
        return True
        
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

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'ai_enabled': agent_executor is not None
    })

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """Get chat history"""
    return jsonify(chat_history)

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat messages"""
    try:
        data = request.get_json()
        question = data.get('question', '').strip()
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        if not agent_executor:
            return jsonify({'error': 'AI agent not available'}), 503
        
        # Prepare the question with guardrails
        guardrails = """
        You are ChatCVE, a DevSecOps AI assistant specialized in vulnerability management and security analysis.
        
        Guidelines:
        - Focus on security, vulnerability, and DevSecOps topics
        - Provide accurate, actionable information
        - When querying databases, explain your SQL queries
        - Prioritize critical security issues
        - Be concise but thorough
        - If asked about non-security topics, politely redirect to security matters
        
        Database Schema Context:
        - app_patrol table: Contains SBOM and vulnerability data from container scans
        - nvd_cves table: Contains CVE information from the National Vulnerability Database
        
        Question: """
        
        full_question = guardrails + question
        
        # Get response from agent
        response = agent_executor.run(full_question)
        
        # Store in history
        chat_message = {
            'id': str(len(chat_history) + 1),
            'question': question,
            'response': response,
            'timestamp': datetime.now().isoformat()
        }
        chat_history.append(chat_message)
        
        return jsonify({'response': response})
        
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
            LEFT JOIN app_patrol ap ON substr(ap.DATE_ADDED, 1, 15) = substr(sm.scan_timestamp, 1, 15)
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

@app.route('/api/scans', methods=['GET'])
def get_scans():
    """Get scan results"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # First get scan metadata
        cursor.execute("""
            SELECT scan_timestamp, user_scan_name 
            FROM scan_metadata 
            ORDER BY scan_timestamp DESC
        """)
        metadata_results = cursor.fetchall()
        scan_names_map = {row[0][:15]: row[1] for row in metadata_results}
        
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
            GROUP BY substr(ap.DATE_ADDED, 1, 15)
            ORDER BY scan_date DESC
            LIMIT 50
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        scans = []
        for row in results:
            scan_date, images, vulnerabilities, critical, high, medium, low, image_count, total_packages, total_records = row
            # Look up user-supplied name from the map
            time_key = scan_date[:15]
            user_scan_name = scan_names_map.get(time_key)
            # Use user-supplied name if available, otherwise fall back to auto-generated name
            scan_name = user_scan_name if user_scan_name else f"Scan {scan_date[:10]} {scan_date[11:16]} - {image_count} images"
            # Get the first image for display
            first_image = images.split(',')[0] if images else 'Unknown'
            scans.append({
                'id': f"scan_{hash(scan_date)}",
                'image': first_image,
                'images': images.split(',') if images else [],
                'timestamp': scan_date,
                'status': 'completed',
                'vulnerabilities': vulnerabilities or 0,
                'critical': critical or 0,
                'high': high or 0,
                'medium': medium or 0,
                'low': low or 0,
                'image_count': image_count,
                'packages': total_packages or 0,  # Real package count
                'name': scan_name,
                'user_scan_name': user_scan_name  # For debugging
            })
        
        return jsonify(scans)
        
    except Exception as e:
        print(f"Error getting scans: {e}")
        return jsonify({'error': 'Failed to retrieve scans'}), 500

@app.route('/api/scans/<scan_id>', methods=['DELETE'])
def delete_scan(scan_id):
    """Delete a scan and all its associated data"""
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
            GROUP BY substr(ap.DATE_ADDED, 1, 15)
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
            WHERE substr(DATE_ADDED, 1, 15) = ?
        """, (target_timestamp,))
        
        # Delete from scan_metadata table
        cursor.execute("""
            DELETE FROM scan_metadata 
            WHERE substr(scan_timestamp, 1, 15) = ?
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
                substr(ap.DATE_ADDED, 1, 15) as time_group
            FROM app_patrol ap
            WHERE ap.DATE_ADDED IS NOT NULL
            GROUP BY substr(ap.DATE_ADDED, 1, 15)
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
            WHERE substr(ap.DATE_ADDED, 1, 15) = ?
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
                substr(ap.DATE_ADDED, 1, 15) as time_group
            FROM app_patrol ap
            WHERE ap.DATE_ADDED IS NOT NULL
            GROUP BY substr(ap.DATE_ADDED, 1, 15)
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
            WHERE substr(ap.DATE_ADDED, 1, 15) = ?
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

@app.route('/cves', methods=['GET'])
def get_cves():
    """Get CVE information"""
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
def start_scan():
    """Start a real vulnerability scan"""
    try:
        data = request.json
        scan_name = data.get('name', 'Untitled Scan')
        targets = data.get('targets', [])
        scan_type = data.get('type', 'container')
        
        if not targets:
            return jsonify({'error': 'No targets provided'}), 400
        
        # Generate unique scan ID
        scan_id = f"scan-{int(datetime.now().timestamp())}"
        
        print(f"Starting real scan: {scan_name} with {len(targets)} targets")
        
        # Start the scan asynchronously
        def run_scan():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(scanner.start_scan(scan_id, scan_name, targets))
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

if __name__ == '__main__':
    print("Starting ChatCVE API Backend...")
    
    # Initialize the AI agent
    agent_initialized = initialize_agent()
    
    if not agent_initialized:
        print("Running without AI capabilities")
    
    # Check database connection
    conn = get_db_connection()
    if conn:
        print(f"Database connection successful: {DATABASE_PATH}")
        conn.close()
    else:
        print(f"Warning: Could not connect to database: {DATABASE_PATH}")
    
    print("API Backend ready!")
    app.run(host='0.0.0.0', port=5000, debug=True)
