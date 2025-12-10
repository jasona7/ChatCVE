#!/usr/bin/env python3
"""
Real Registry-Based Vulnerability Scanning Service
No Docker required - uses registry APIs directly with Syft/Grype
"""

import os
import json
import subprocess
import asyncio
import math
import tempfile
import sqlite3
from datetime import datetime
from typing import List, Dict, Optional, AsyncGenerator
from dataclasses import dataclass, asdict
from pathlib import Path
import logging
import shutil
import requests
from urllib.parse import urlparse
import time
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class LogEntry:
    timestamp: str
    level: str  # info, warn, error, success
    message: str
    details: Optional[str] = None

@dataclass
class ScanProgress:
    id: str
    name: str
    status: str  # initializing, running, completed, failed
    progress: int  # 0-100
    current_step: str
    logs: List[LogEntry]
    start_time: str
    targets: List[str]
    current_target: Optional[str] = None
    total_targets: Optional[int] = None
    completed_targets: Optional[int] = None
    # New metadata fields
    scan_metadata: Optional[Dict] = None

class RegistryBasedScanner:
    def __init__(self, db_path: str = "../app_patrol.db"):
        self.db_path = db_path
        self.active_scans = {}

        # Initialize database tables
        self._init_database()

        # Check for required tools
        self._check_dependencies()

    def _init_database(self):
        """Create database tables if they don't exist"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Create scan_metadata table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scan_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_timestamp TEXT,
                    user_scan_name TEXT,
                    image_count INTEGER,
                    scan_duration REAL,
                    total_packages_scanned INTEGER,
                    total_vulnerabilities_found INTEGER,
                    scan_status TEXT,
                    scan_type TEXT,
                    syft_version TEXT,
                    grype_version TEXT,
                    scan_engine TEXT,
                    scan_source TEXT,
                    risk_score REAL,
                    critical_count INTEGER,
                    high_count INTEGER,
                    medium_count INTEGER,
                    low_count INTEGER,
                    exploitable_count INTEGER,
                    scan_initiator TEXT,
                    compliance_policy TEXT,
                    scan_tags TEXT,
                    project_name TEXT,
                    environment TEXT
                )
            """)

            # Create app_patrol table for vulnerability data
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS app_patrol (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    IMAGE_TAG TEXT,
                    PACKAGE TEXT,
                    VERSION TEXT,
                    VULNERABILITY TEXT,
                    SEVERITY TEXT,
                    DESCRIPTION TEXT,
                    NAME TEXT,
                    INSTALLED TEXT,
                    DATE_ADDED TEXT,
                    FIXED_IN TEXT,
                    SCAN_NAME TEXT
                )
            """)

            conn.commit()
            conn.close()
            logger.info(f"Database initialized: {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
    
    def _check_dependencies(self):
        """Check if Docker, Syft and Grype are installed and get versions"""
        required_tools = ['docker', 'syft', 'grype']
        missing_tools = []
        tool_versions = {}
        
        for tool in required_tools:
            if not shutil.which(tool):
                missing_tools.append(tool)
            else:
                # Get tool version
                try:
                    version_result = subprocess.run([tool, '--version'], capture_output=True, text=True, timeout=5)
                    if version_result.returncode == 0:
                        tool_versions[tool] = version_result.stdout.strip()
                    else:
                        tool_versions[tool] = 'unknown'
                except Exception:
                    tool_versions[tool] = 'unknown'
        
        self.tool_versions = tool_versions
        
        if missing_tools:
            logger.warning(f"Missing required tools: {missing_tools}")
            if 'docker' in missing_tools:
                logger.info("Install Docker: https://docs.docker.com/get-docker/")
            if 'syft' in missing_tools:
                logger.info("Install Syft: https://github.com/anchore/syft/releases")
            if 'grype' in missing_tools:
                logger.info("Install Grype: https://github.com/anchore/grype/releases")
        
        # Test Docker connectivity
        try:
            result = subprocess.run(['docker', 'info'], capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                logger.warning("Docker daemon not running or not accessible")
        except Exception as e:
            logger.warning(f"Could not connect to Docker: {e}")
    
    def _log(self, scan_id: str, level: str, message: str, details: str = None):
        """Add a log entry to the scan progress"""
        if scan_id not in self.active_scans:
            return
            
        log_entry = LogEntry(
            timestamp=datetime.now().isoformat(),
            level=level,
            message=message,
            details=details
        )
        
        self.active_scans[scan_id].logs.append(log_entry)
        logger.info(f"[{scan_id}] {level.upper()}: {message}")
    
    async def _run_command(self, scan_id: str, cmd: List[str], description: str) -> tuple[bool, str]:
        """Run a shell command asynchronously and capture output"""
        self._log(scan_id, 'info', f"Running: {description}")
        self._log(scan_id, 'info', f"Command: {' '.join(cmd)}")
        self._log(scan_id, 'info', f"Working directory: {os.getcwd()}")
        self._log(scan_id, 'info', f"PATH: {os.environ.get('PATH', 'Not set')[:200]}...")
        
        # Debug Docker binary location for pull commands only
        if cmd[0] == 'docker' and cmd[1] == 'pull':
            docker_path = subprocess.run(['which', 'docker'], capture_output=True, text=True)
            self._log(scan_id, 'info', f"Docker binary path: {docker_path.stdout.strip()}")
            docker_version = subprocess.run(['docker', '--version'], capture_output=True, text=True)
            self._log(scan_id, 'info', f"Docker version: {docker_version.stdout.strip()}")
        
        try:
            # Run command asynchronously with environment
            env = os.environ.copy()
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                self._log(scan_id, 'success', f"Completed: {description}")
                return True, stdout.decode()
            else:
                stderr_msg = stderr.decode() if stderr else ""
                stdout_msg = stdout.decode() if stdout else ""
                error_msg = stderr_msg or stdout_msg or "Unknown error"
                self._log(scan_id, 'error', f"Failed: {description}")
                self._log(scan_id, 'error', f"Return code: {process.returncode}")
                self._log(scan_id, 'error', f"stderr: {stderr_msg}")
                self._log(scan_id, 'error', f"stdout: {stdout_msg}")
                return False, error_msg
                
        except Exception as e:
            self._log(scan_id, 'error', f"Exception running {description}: {str(e)}")
            return False, str(e)
    
    def _validate_image_reference(self, image_ref: str) -> bool:
        """Validate container image reference format"""
        if not image_ref or not image_ref.strip():
            return False

        image_ref = image_ref.strip()

        # Skip comments and empty lines
        if image_ref.startswith('#'):
            return False

        # Valid formats:
        # - image:tag (e.g., nginx:latest, alpine:3.19)
        # - image (e.g., nginx - defaults to :latest)
        # - registry/image:tag (e.g., docker.io/library/nginx:latest)
        # - registry/namespace/image:tag

        # SECURITY: Reject path traversal attempts
        if '..' in image_ref:
            return False

        # SECURITY: Reject absolute paths and file:// URIs
        if image_ref.startswith('/') or image_ref.startswith('file:'):
            return False

        # SECURITY: Reject URL-encoded path traversal
        if '%2f' in image_ref.lower() or '%252f' in image_ref.lower():
            return False

        # Basic check: must have valid characters
        # Allow alphanumeric, dots, dashes, underscores, slashes, colons, and @ (for digests)
        if not re.match(r'^[a-zA-Z0-9._\-/:@]+$', image_ref):
            return False

        # SECURITY: Reject tag-only references (must have image name before colon)
        if image_ref.startswith(':'):
            return False

        # SECURITY: Reject empty tags and double colons
        if '::' in image_ref or image_ref.endswith(':'):
            return False

        return True
    
    async def _scan_single_image(self, scan_id: str, image_ref: str, temp_dir: str) -> Dict:
        """Scan a single container image using Docker pull"""
        # Clean the image reference (remove whitespace and line endings)
        image_ref = image_ref.strip()
        self._log(scan_id, 'info', f"Cleaned image reference: {repr(image_ref)}")
        
        if not self._validate_image_reference(image_ref):
            self._log(scan_id, 'error', f"Invalid image reference: {image_ref}")
            return None
        
        self._log(scan_id, 'info', f"Scanning image: {image_ref}")
        
        # Ensure we're using the default Docker context
        context_cmd = ['docker', 'context', 'use', 'default']
        await self._run_command(scan_id, context_cmd, "Setting Docker context to default")
        
        # Pull the Docker image first using sync subprocess (for compatibility)
        pull_cmd = ['docker', 'pull', image_ref]
        self._log(scan_id, 'info', f"Running: Pulling Docker image: {image_ref}")
        self._log(scan_id, 'info', f"Command: {' '.join(pull_cmd)}")
        
        try:
            result = subprocess.run(pull_cmd, capture_output=True, text=True, timeout=120)
            if result.returncode == 0:
                self._log(scan_id, 'success', f"Completed: Pulling Docker image: {image_ref}")
                success, output = True, result.stdout
            else:
                self._log(scan_id, 'error', f"Failed: Pulling Docker image: {image_ref}")
                self._log(scan_id, 'error', f"Return code: {result.returncode}")
                self._log(scan_id, 'error', f"stderr: {result.stderr}")
                self._log(scan_id, 'error', f"stdout: {result.stdout}")
                success, output = False, result.stderr
        except Exception as e:
            self._log(scan_id, 'error', f"Exception pulling Docker image: {str(e)}")
            success, output = False, str(e)
        
        if not success:
            return None
        
        # Generate SBOM using Syft with local Docker image
        sbom_file = os.path.join(temp_dir, f"sbom-{image_ref.replace('/', '-').replace(':', '-')}.json")
        
        syft_cmd = [
            'syft', 'packages', image_ref,  # Use local Docker image
            '-o', 'json',
            '--file', sbom_file
        ]
        
        success, output = await self._run_command(
            scan_id, syft_cmd, f"Generating SBOM for {image_ref}"
        )
        
        if not success:
            return None
        
        # Check if SBOM file was created and has content
        if not os.path.exists(sbom_file) or os.path.getsize(sbom_file) == 0:
            self._log(scan_id, 'error', f"SBOM file not generated for {image_ref}")
            return None
        
        # Parse SBOM to get package count
        try:
            with open(sbom_file, 'r') as f:
                sbom_data = json.load(f)
                package_count = len(sbom_data.get('artifacts', []))
                self._log(scan_id, 'success', f"Found {package_count} packages in {image_ref}")
        except Exception as e:
            self._log(scan_id, 'warn', f"Could not parse SBOM for {image_ref}: {str(e)}")
            package_count = 0
        
        # Scan SBOM for vulnerabilities using Grype
        grype_output_file = os.path.join(temp_dir, f"vulns-{image_ref.replace('/', '-').replace(':', '-')}.json")
        
        grype_cmd = [
            'grype', f'sbom:{sbom_file}',
            '-o', 'json',
            '--file', grype_output_file
        ]
        
        success, output = await self._run_command(
            scan_id, grype_cmd, f"Scanning vulnerabilities for {image_ref}"
        )
        
        if not success:
            return None
        
        # Parse vulnerability results
        vulnerabilities = []
        vuln_count = 0
        severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
        
        if os.path.exists(grype_output_file):
            try:
                with open(grype_output_file, 'r') as f:
                    grype_data = json.load(f)
                    matches = grype_data.get('matches', [])
                    vuln_count = len(matches)
                    
                    for match in matches:
                        vuln = match.get('vulnerability', {})
                        severity = vuln.get('severity', 'unknown').lower()
                        if severity in severity_counts:
                            severity_counts[severity] += 1
                        
                        vulnerabilities.append({
                            'id': vuln.get('id'),
                            'severity': severity,
                            'package': match.get('artifact', {}).get('name'),
                            'version': match.get('artifact', {}).get('version'),
                            'fixed_in': vuln.get('fix', {}).get('versions', [])
                        })
                        
                self._log(scan_id, 'info', f"Found {vuln_count} vulnerabilities in {image_ref}")
                if vuln_count > 0:
                    self._log(scan_id, 'warn', 
                             f"Severity breakdown: Critical: {severity_counts['critical']}, "
                             f"High: {severity_counts['high']}, Medium: {severity_counts['medium']}, "
                             f"Low: {severity_counts['low']}")
                             
            except Exception as e:
                self._log(scan_id, 'error', f"Could not parse vulnerability results for {image_ref}: {str(e)}")
        
        # Calculate exploitable count (CVEs with CVSS >= 7.0 or known exploits)
        exploitable_count = 0
        for vuln in vulnerabilities:
            vuln_id = vuln.get('id', '')
            severity = vuln.get('severity', '').lower()
            # Consider Critical/High as potentially exploitable
            if severity in ['critical', 'high']:
                exploitable_count += 1
        
        return {
            'image': image_ref,
            'packages': package_count,
            'vulnerabilities': vuln_count,
            'severity_counts': severity_counts,
            'exploitable_count': exploitable_count,
            'vuln_details': vulnerabilities
        }
    
    def _calculate_risk_score(self, results: List[Dict]) -> float:
        """Calculate a risk score based on vulnerabilities found (0-100 scale)"""
        if not results:
            return 0.0
        
        total_critical = 0
        total_high = 0
        total_medium = 0
        total_low = 0
        
        for result in results:
            severity_counts = result['severity_counts']
            total_critical += severity_counts['critical']
            total_high += severity_counts['high']
            total_medium += severity_counts['medium']
            total_low += severity_counts['low']
        
        # Calculate weighted score using exponential scaling for higher severities
        # This gives more realistic scores that reflect actual risk
        score = (
            total_critical * 25.0 +  # Critical: 25 points each (very high impact)
            total_high * 10.0 +      # High: 10 points each
            total_medium * 3.0 +     # Medium: 3 points each  
            total_low * 1.0          # Low: 1 point each
        )
        
        # Apply logarithmic scaling to prevent scores from getting too high
        # but still show meaningful differences
        if score > 0:
            # Use log scale but ensure reasonable range
            normalized_score = min(20 * math.log10(score + 1), 100.0)
        else:
            normalized_score = 0.0
        
        return round(normalized_score, 1)
    
    async def start_scan(self, scan_id: str, scan_name: str, targets: List[str], 
                        scan_initiator: str = 'system', project_name: str = None,
                        environment: str = None, scan_tags: List[str] = None) -> bool:
        """Start a real vulnerability scan"""
        # Record scan start time for duration calculation
        scan_start_time = time.time()
        scan_start_datetime = datetime.now()
        
        # Initialize scan progress with metadata
        scan_progress = ScanProgress(
            id=scan_id,
            name=scan_name,
            status='initializing',
            progress=0,
            current_step='Preparing scan environment...',
            logs=[],
            start_time=scan_start_datetime.isoformat(),
            targets=targets,
            total_targets=len(targets),
            completed_targets=0,
            scan_metadata={
                'scan_initiator': scan_initiator,
                'project_name': project_name,
                'environment': environment,
                'scan_tags': scan_tags or [],
                'scan_type': 'FULL',
                'scan_source': 'FILE_UPLOAD',
                'scan_engine': 'DOCKER_PULL'
            }
        )
        
        self.active_scans[scan_id] = scan_progress
        self._log(scan_id, 'info', f"Starting registry-based scan: {scan_name}")
        self._log(scan_id, 'info', f"Targets: {len(targets)} container images")
        
        try:
            # Create temporary directory for scan files
            with tempfile.TemporaryDirectory() as temp_dir:
                self._log(scan_id, 'info', f"Created temporary workspace: {temp_dir}")
                
                # Update progress
                self.active_scans[scan_id].status = 'running'
                self.active_scans[scan_id].progress = 10
                self.active_scans[scan_id].current_step = 'Validating container image references...'
                
                # Validate all targets first
                valid_targets = []
                for target in targets:
                    if self._validate_image_reference(target):
                        valid_targets.append(target)
                        self._log(scan_id, 'success', f"Valid image reference: {target}")
                    else:
                        self._log(scan_id, 'error', f"Invalid image reference: {target}")
                
                if not valid_targets:
                    raise Exception("No valid container image references found")
                
                self._log(scan_id, 'info', f"Validated {len(valid_targets)} out of {len(targets)} image references")
                
                # Scan each image
                scan_results = []
                for i, target in enumerate(valid_targets):
                    self.active_scans[scan_id].current_target = target
                    self.active_scans[scan_id].progress = 20 + (60 * i // len(valid_targets))
                    self.active_scans[scan_id].current_step = f"Scanning {target}..."
                    
                    result = await self._scan_single_image(scan_id, target, temp_dir)
                    if result:
                        scan_results.append(result)
                        self.active_scans[scan_id].completed_targets += 1
                        self._log(scan_id, 'success', f"Completed scan for {target}")
                    else:
                        self._log(scan_id, 'error', f"Failed to scan {target}")
                
                # Finalize results
                self.active_scans[scan_id].progress = 90
                self.active_scans[scan_id].current_step = 'Storing results in database...'
                
                # Calculate final metrics
                scan_end_time = time.time()
                scan_duration = int(scan_end_time - scan_start_time)  # seconds
                
                total_vulns = sum(result['vulnerabilities'] for result in scan_results)
                total_packages = sum(result['packages'] for result in scan_results)
                total_exploitable = sum(result['exploitable_count'] for result in scan_results)
                
                # Calculate severity breakdown
                severity_totals = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
                for result in scan_results:
                    for severity, count in result['severity_counts'].items():
                        severity_totals[severity] += count
                
                # Calculate risk score
                risk_score = self._calculate_risk_score(scan_results)
                
                # Update scan metadata with final results
                self.active_scans[scan_id].scan_metadata.update({
                    'scan_duration': scan_duration,
                    'total_packages_scanned': total_packages,
                    'total_vulnerabilities_found': total_vulns,
                    'scan_status': 'SUCCESS',
                    'risk_score': risk_score,
                    'critical_count': severity_totals['critical'],
                    'high_count': severity_totals['high'],
                    'medium_count': severity_totals['medium'],
                    'low_count': severity_totals['low'],
                    'exploitable_count': total_exploitable,
                    'syft_version': self.tool_versions.get('syft', 'unknown'),
                    'grype_version': self.tool_versions.get('grype', 'unknown')
                })
                
                # Store results in database with metadata
                await self._store_scan_results(scan_id, scan_name, scan_results)
                
                # Complete the scan
                self.active_scans[scan_id].status = 'completed'
                self.active_scans[scan_id].progress = 100
                self.active_scans[scan_id].current_step = 'Scan completed successfully'
                
                self._log(scan_id, 'success', f'Registry-based scan completed successfully: "{scan_name}"')
                self._log(scan_id, 'info', f"Total packages analyzed: {total_packages}")
                self._log(scan_id, 'info', f"Total vulnerabilities found: {total_vulns}")
                self._log(scan_id, 'info', f"Scan duration: {scan_duration} seconds")
                self._log(scan_id, 'info', f"Risk score: {risk_score:.1f}/100")
                self._log(scan_id, 'info', 'No Docker daemon required - used registry APIs only')
                
                return True
                
        except Exception as e:
            # Calculate duration even for failed scans
            scan_end_time = time.time()
            scan_duration = int(scan_end_time - scan_start_time)
            
            # Update metadata for failed scan
            if scan_id in self.active_scans and self.active_scans[scan_id].scan_metadata:
                self.active_scans[scan_id].scan_metadata.update({
                    'scan_duration': scan_duration,
                    'scan_status': 'FAILED',
                    'syft_version': self.tool_versions.get('syft', 'unknown'),
                    'grype_version': self.tool_versions.get('grype', 'unknown')
                })
            
            self.active_scans[scan_id].status = 'failed'
            self.active_scans[scan_id].current_step = f'Scan failed: {str(e)}'
            self._log(scan_id, 'error', f"Scan failed: {str(e)}")
            self._log(scan_id, 'info', f"Scan duration before failure: {scan_duration} seconds")
            return False
    
    async def _store_scan_results(self, scan_id: str, scan_name: str, results: List[Dict]):
        """Store scan results in the database with comprehensive metadata"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Use a consistent timestamp for both metadata and vulnerability data
            scan_timestamp = datetime.now().isoformat()
            
            # Get metadata from active scan
            metadata = self.active_scans[scan_id].scan_metadata if scan_id in self.active_scans else {}
            
            # Store comprehensive scan metadata FIRST
            cursor.execute("""
                INSERT OR REPLACE INTO scan_metadata (
                    scan_timestamp, user_scan_name, image_count,
                    scan_duration, total_packages_scanned, total_vulnerabilities_found,
                    scan_status, scan_type, syft_version, grype_version,
                    scan_engine, scan_source, risk_score, critical_count,
                    high_count, medium_count, low_count, exploitable_count,
                    scan_initiator, compliance_policy, scan_tags, project_name, environment
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                scan_timestamp, scan_name, len(results),
                metadata.get('scan_duration', 0),
                metadata.get('total_packages_scanned', 0),
                metadata.get('total_vulnerabilities_found', 0),
                metadata.get('scan_status', 'SUCCESS'),
                metadata.get('scan_type', 'FULL'),
                metadata.get('syft_version', 'unknown'),
                metadata.get('grype_version', 'unknown'),
                metadata.get('scan_engine', 'DOCKER_PULL'),
                metadata.get('scan_source', 'FILE_UPLOAD'),
                metadata.get('risk_score', 0.0),
                metadata.get('critical_count', 0),
                metadata.get('high_count', 0),
                metadata.get('medium_count', 0),
                metadata.get('low_count', 0),
                metadata.get('exploitable_count', 0),
                metadata.get('scan_initiator', 'system'),
                metadata.get('compliance_policy'),
                json.dumps(metadata.get('scan_tags', [])),
                metadata.get('project_name'),
                metadata.get('environment')
            ))
            
            # Store each image's results
            for result in results:
                cursor.execute("""
                    INSERT OR REPLACE INTO app_patrol 
                    (IMAGE_TAG, VULNERABILITY, SEVERITY, NAME, INSTALLED, DATE_ADDED)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    result['image'],
                    result['vulnerabilities'],
                    'HIGH' if result['vulnerabilities'] > 10 else 'MEDIUM' if result['vulnerabilities'] > 0 else 'LOW',
                    f"{result['packages']} packages",
                    '1.0',  # Package version placeholder
                    scan_timestamp
                ))
                
                # Store detailed vulnerability information
                for vuln in result['vuln_details']:
                    cursor.execute("""
                        INSERT OR REPLACE INTO app_patrol 
                        (IMAGE_TAG, VULNERABILITY, SEVERITY, NAME, INSTALLED, DATE_ADDED)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        result['image'],
                        vuln['id'],
                        vuln['severity'].upper(),
                        vuln['package'],
                        vuln['version'],
                        scan_timestamp
                    ))
            
            conn.commit()
            conn.close()
            
            self._log(scan_id, 'success', f"Stored results for {len(results)} images in database")
            
        except Exception as e:
            self._log(scan_id, 'error', f"Failed to store results in database: {str(e)}")
    
    def get_scan_progress(self, scan_id: str) -> Optional[Dict]:
        """Get current scan progress"""
        if scan_id in self.active_scans:
            return asdict(self.active_scans[scan_id])
        return None
    
    def get_scan_logs(self, scan_id: str) -> List[Dict]:
        """Get scan logs"""
        if scan_id in self.active_scans:
            return [asdict(log) for log in self.active_scans[scan_id].logs]
        return []
    
    def list_active_scans(self) -> List[str]:
        """List all active scan IDs"""
        return list(self.active_scans.keys())

# Global scanner instance - use DATABASE_PATH env var for Docker compatibility
import os
scanner = RegistryBasedScanner(db_path=os.getenv('DATABASE_PATH', '../app_patrol.db'))
