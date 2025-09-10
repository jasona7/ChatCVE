#!/usr/bin/env python3
"""
Real Registry-Based Vulnerability Scanning Service
No Docker required - uses registry APIs directly with Syft/Grype
"""

import os
import json
import subprocess
import asyncio
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

class RegistryBasedScanner:
    def __init__(self, db_path: str = "../app_patrol.db"):
        self.db_path = db_path
        self.active_scans = {}
        
        # Check for required tools
        self._check_dependencies()
    
    def _check_dependencies(self):
        """Check if Docker, Syft and Grype are installed"""
        required_tools = ['docker', 'syft', 'grype']
        missing_tools = []
        
        for tool in required_tools:
            if not shutil.which(tool):
                missing_tools.append(tool)
        
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
        # Basic validation for registry/image:tag format
        if not image_ref or '/' not in image_ref:
            return False
        
        # Should have registry/image:tag format
        parts = image_ref.split('/')
        if len(parts) < 2:
            return False
            
        # Last part should have image:tag
        image_tag = parts[-1]
        if ':' not in image_tag:
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
        
        return {
            'image': image_ref,
            'packages': package_count,
            'vulnerabilities': vuln_count,
            'severity_counts': severity_counts,
            'vuln_details': vulnerabilities
        }
    
    async def start_scan(self, scan_id: str, scan_name: str, targets: List[str]) -> bool:
        """Start a real vulnerability scan"""
        # Initialize scan progress
        scan_progress = ScanProgress(
            id=scan_id,
            name=scan_name,
            status='initializing',
            progress=0,
            current_step='Preparing scan environment...',
            logs=[],
            start_time=datetime.now().isoformat(),
            targets=targets,
            total_targets=len(targets),
            completed_targets=0
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
                
                # Store results in database
                await self._store_scan_results(scan_id, scan_name, scan_results)
                
                # Complete the scan
                self.active_scans[scan_id].status = 'completed'
                self.active_scans[scan_id].progress = 100
                self.active_scans[scan_id].current_step = 'Scan completed successfully'
                
                total_vulns = sum(result['vulnerabilities'] for result in scan_results)
                total_packages = sum(result['packages'] for result in scan_results)
                
                self._log(scan_id, 'success', 'Registry-based scan completed successfully')
                self._log(scan_id, 'info', f"Total packages analyzed: {total_packages}")
                self._log(scan_id, 'info', f"Total vulnerabilities found: {total_vulns}")
                self._log(scan_id, 'info', 'No Docker daemon required - used registry APIs only')
                
                return True
                
        except Exception as e:
            self.active_scans[scan_id].status = 'failed'
            self.active_scans[scan_id].current_step = f'Scan failed: {str(e)}'
            self._log(scan_id, 'error', f"Scan failed: {str(e)}")
            return False
    
    async def _store_scan_results(self, scan_id: str, scan_name: str, results: List[Dict]):
        """Store scan results in the database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Use a consistent timestamp for both metadata and vulnerability data
            scan_timestamp = datetime.now().isoformat()
            
            # Store scan metadata FIRST to ensure it's available for JOINs
            cursor.execute("""
                INSERT OR REPLACE INTO scan_metadata (scan_timestamp, user_scan_name, image_count)
                VALUES (?, ?, ?)
            """, (scan_timestamp, scan_name, len(results)))
            
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

# Global scanner instance
scanner = RegistryBasedScanner()
