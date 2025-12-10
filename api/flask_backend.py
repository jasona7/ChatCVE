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
from langchain_community.agent_toolkits.sql.base import create_sql_agent
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

def get_contextual_examples(question: str) -> str:
    """Generate contextual SQL examples based on question type"""
    question_lower = question.lower()
    
    examples = ""
    
    if any(word in question_lower for word in ['scan', 'scans', 'when', 'recent']):
        examples += """

🔍 SCAN QUERY EXAMPLES:
Example: "Show me recent scans"
SQL: SELECT user_scan_name, scan_timestamp, total_vulnerabilities_found, scan_status 
     FROM scan_metadata 
     ORDER BY scan_timestamp DESC LIMIT 10;

Example: "Which scans took longer than 5 minutes?"
SQL: SELECT user_scan_name, scan_duration, total_vulnerabilities_found 
     FROM scan_metadata 
     WHERE scan_duration > 300 
     ORDER BY scan_duration DESC;
"""
    
    if any(word in question_lower for word in ['vulnerability', 'vulnerabilities', 'cve', 'critical', 'high']):
        examples += """

🚨 VULNERABILITY QUERY EXAMPLES:
Example: "Show critical vulnerabilities by image"
SQL: SELECT ap.IMAGE_TAG, COUNT(*) as critical_count, GROUP_CONCAT(DISTINCT ap.VULNERABILITY) as cves
     FROM app_patrol ap 
     WHERE ap.SEVERITY = 'CRITICAL' 
     GROUP BY ap.IMAGE_TAG 
     ORDER BY critical_count DESC;

Example: "Compare vulnerability counts across scans"
SQL: SELECT sm.user_scan_name, sm.critical_count, sm.high_count, sm.medium_count, sm.low_count
     FROM scan_metadata sm 
     ORDER BY sm.scan_timestamp DESC;
"""
    
    if any(word in question_lower for word in ['performance', 'duration', 'packages', 'risk']):
        examples += """

⚡ PERFORMANCE QUERY EXAMPLES:
Example: "Show scan performance metrics"
SQL: SELECT user_scan_name, scan_duration, total_packages_scanned, 
            (total_vulnerabilities_found * 1.0 / total_packages_scanned) as vuln_ratio,
            risk_score
     FROM scan_metadata 
     WHERE total_packages_scanned > 0
     ORDER BY risk_score DESC;
"""
    
    return examples

def get_enhanced_database_context():
    """Generate comprehensive database context with schema details and data samples"""
    
    context = """

📊 DATABASE SCHEMA CONTEXT:

🏗️ TABLE: scan_metadata (Primary table for scan-level queries)
├── scan_timestamp (TEXT, PRIMARY KEY) - "2024-01-15 14:30:22"
├── user_scan_name (TEXT) - "Production EKS Cluster Scan" 
├── image_count (INTEGER) - Number of container images scanned
├── scan_duration (INTEGER) - Scan time in seconds
├── total_packages_scanned (INTEGER) - Total packages analyzed
├── total_vulnerabilities_found (INTEGER) - Total vulnerabilities discovered
├── scan_status (TEXT) - SUCCESS/FAILED/PARTIAL
├── scan_type (TEXT) - FULL/INCREMENTAL/RESCAN
├── risk_score (REAL) - 0-100 security risk score
├── critical_count, high_count, medium_count, low_count (INTEGER)
├── exploitable_count (INTEGER) - Exploitable vulnerabilities
├── scan_initiator (TEXT) - Who started the scan
├── project_name (TEXT) - Associated project
└── environment (TEXT) - PRODUCTION/STAGING/DEVELOPMENT

🔍 TABLE: app_patrol (Individual vulnerability records)
├── NAME (TEXT) - Package name (e.g., "nginx", "openssl")
├── INSTALLED (TEXT) - Installed version
├── FIXED_IN (TEXT) - Version that fixes the vulnerability
├── TYPE (TEXT) - Package type
├── VULNERABILITY (TEXT) - CVE identifier (e.g., "CVE-2024-1234")
├── SEVERITY (TEXT) - CRITICAL/HIGH/MEDIUM/LOW
├── IMAGE_TAG (TEXT) - Container image reference
└── DATE_ADDED (TEXT) - When vulnerability was recorded

🔗 JOINING STRATEGY:
- Link tables using: substr(ap.DATE_ADDED, 1, 19) = substr(sm.scan_timestamp, 1, 19)
- This connects vulnerability records to their scan metadata

⚡ QUERY OPTIMIZATION RULES:
1. For scan overview questions → Use scan_metadata only
2. For vulnerability details → Use app_patrol only  
3. For comprehensive analysis → JOIN both tables
4. Always use LIMIT for large result sets
5. Use GROUP BY for aggregations
"""
    return context

def validate_query_intent(question: str) -> dict:
    """Analyze question intent and suggest optimal query approach"""
    question_lower = question.lower()
    
    intent = {
        'primary_table': 'scan_metadata',
        'needs_join': False,
        'query_type': 'overview',
        'suggested_columns': [],
        'filters': []
    }
    
    # Determine primary focus
    if any(word in question_lower for word in ['package', 'cve-', 'vulnerability details', 'fixed in']):
        intent['primary_table'] = 'app_patrol'
        intent['suggested_columns'] = ['NAME', 'VULNERABILITY', 'SEVERITY', 'FIXED_IN']
    
    # Determine if join needed
    if any(word in question_lower for word in ['scan', 'when', 'duration']) and \
       any(word in question_lower for word in ['package', 'vulnerability', 'cve']):
        intent['needs_join'] = True
        intent['query_type'] = 'comprehensive'
    
    # Suggest filters
    if 'critical' in question_lower:
        intent['filters'].append("SEVERITY = 'CRITICAL'")
    if 'production' in question_lower:
        intent['filters'].append("environment = 'PRODUCTION'")
    if 'recent' in question_lower:
        intent['filters'].append("ORDER BY scan_timestamp DESC LIMIT 10")
    
    return intent

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
        
        # Connect to SQLite database - prioritize scan_metadata for scan questions
        db = SQLDatabase.from_uri(f"sqlite:///{DATABASE_PATH}")
        toolkit = SQLDatabaseToolkit(db=db, llm=llm)
        
        # Enhanced prompt with comprehensive database context
        enhanced_prompt = f"""
You are ChatCVE, a security analyst AI assistant specialized in vulnerability management and security analysis.

{get_enhanced_database_context()}

QUERY STRATEGY:
1. Analyze the question intent first
2. Choose the appropriate table(s) based on the context above
3. Explain your approach before writing SQL
4. Provide actionable security insights in your response

MANDATORY RULES:
- Never use app_patrol.NAME for scan names (it's package names!)
- Always use scan_metadata.user_scan_name for scan identification
- Validate your SQL against the schema above
- Include relevant security context in responses
- Use the examples provided as guidance for similar queries
"""

        agent_executor = create_sql_agent(
            llm=llm,
            toolkit=toolkit,
            verbose=True,
            agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
            prefix=enhanced_prompt
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
        
        # Generate contextual examples based on the question
        contextual_examples = get_contextual_examples(question)
        query_intent = validate_query_intent(question)
        
        # Enhanced guardrails with dynamic few-shot prompting
        enhanced_guardrails = f"""
You are ChatCVE, a DevSecOps AI assistant specialized in vulnerability management and security analysis.

QUERY ANALYSIS:
- Primary table focus: {query_intent['primary_table']}
- Needs table join: {query_intent['needs_join']}
- Query type: {query_intent['query_type']}

{contextual_examples}

CRITICAL DATABASE GUIDANCE:
- scan_metadata table: Contains scan-level information (user_scan_name, scan_timestamp, totals, performance)
- app_patrol table: Contains individual vulnerability records (NAME=package name, VULNERABILITY=CVE-ID, SEVERITY, IMAGE_TAG)

Guidelines:
- ALWAYS use scan_metadata for scan names, counts, and metadata queries
- Use app_patrol for detailed vulnerability analysis and package information  
- Join tables when you need both scan context AND vulnerability details
- Explain your SQL approach before executing
- Focus on actionable security insights
- Be concise but thorough
- If asked about non-security topics, politely redirect to security matters

Question: """
        
        full_question = enhanced_guardrails + question
        
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
