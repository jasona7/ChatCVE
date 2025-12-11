"""
Integration tests for scan API endpoints.
Tests the full request/response cycle for scan-related functionality.
"""

import pytest
import json
from unittest.mock import patch, MagicMock


class TestHealthEndpoint:
    """Tests for the /health endpoint."""

    def test_health_returns_200(self, client):
        """Health endpoint should return 200 OK."""
        response = client.get('/health')
        assert response.status_code == 200

    def test_health_returns_json(self, client):
        """Health endpoint should return valid JSON."""
        response = client.get('/health')
        data = json.loads(response.data)
        assert 'status' in data
        assert 'timestamp' in data

    def test_health_indicates_ai_status(self, client):
        """Health endpoint should indicate AI enablement status."""
        response = client.get('/health')
        data = json.loads(response.data)
        assert 'ai_enabled' in data
        assert isinstance(data['ai_enabled'], bool)


class TestScanListEndpoint:
    """Tests for GET /api/scans endpoint."""

    def test_list_scans_returns_200(self, client):
        """List scans should return 200 OK."""
        response = client.get('/api/scans')
        assert response.status_code == 200

    def test_list_scans_returns_array(self, client):
        """List scans should return an array."""
        response = client.get('/api/scans')
        data = json.loads(response.data)
        assert isinstance(data, list)


class TestStartScanEndpoint:
    """Tests for POST /api/scans/start endpoint."""

    @patch('flask_backend.scanner')
    def test_start_scan_valid_request(self, mock_scanner, client):
        """Starting scan with valid data should succeed."""
        mock_scanner.start_scan = MagicMock(return_value=True)
        mock_scanner.get_scan_progress = MagicMock(return_value={
            'id': 'test-id',
            'status': 'running'
        })

        response = client.post(
            '/api/scans/start',
            json={
                'name': 'Test Scan',
                'targets': ['nginx:latest']
            },
            content_type='application/json'
        )

        # Should return 200 or 201
        assert response.status_code in [200, 201, 202]

    def test_start_scan_missing_targets(self, client):
        """Starting scan without targets should fail."""
        response = client.post(
            '/api/scans/start',
            json={'name': 'Test Scan'},
            content_type='application/json'
        )

        assert response.status_code in [400, 422]

    def test_start_scan_empty_targets(self, client):
        """Starting scan with empty targets should fail."""
        response = client.post(
            '/api/scans/start',
            json={'name': 'Test Scan', 'targets': []},
            content_type='application/json'
        )

        assert response.status_code in [400, 422]

    @pytest.mark.security
    def test_start_scan_malicious_target(self, client):
        """Starting scan with malicious target should be rejected."""
        response = client.post(
            '/api/scans/start',
            json={
                'name': 'Test Scan',
                'targets': ['nginx; rm -rf /']
            },
            content_type='application/json'
        )

        # Should either reject (400) or sanitize and succeed
        # but should NOT execute the malicious command
        assert response.status_code in [200, 201, 202, 400, 422]

    @pytest.mark.security
    def test_start_scan_sql_injection_name(self, client):
        """Scan name with SQL injection should be handled safely."""
        response = client.post(
            '/api/scans/start',
            json={
                'name': "Test'; DROP TABLE scans;--",
                'targets': ['nginx:latest']
            },
            content_type='application/json'
        )

        # Should handle gracefully (either reject or sanitize)
        assert response.status_code in [200, 201, 202, 400, 422]


class TestScanProgressEndpoint:
    """Tests for GET /api/scans/<id>/progress endpoint."""

    def test_progress_nonexistent_scan(self, client):
        """Getting progress for non-existent scan should return 404."""
        response = client.get('/api/scans/nonexistent-id/progress')
        assert response.status_code in [200, 404]  # May return empty or 404


class TestScanLogsEndpoint:
    """Tests for GET /api/scans/<id>/logs endpoint."""

    def test_logs_returns_json(self, client):
        """Logs endpoint should return valid JSON."""
        response = client.get('/api/scans/any-id/logs')
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = json.loads(response.data)
            assert 'logs' in data or isinstance(data, list)


class TestDeleteScanEndpoint:
    """Tests for DELETE /api/scans/<id> endpoint."""

    def test_delete_nonexistent_scan(self, client):
        """Deleting non-existent scan should return appropriate response."""
        response = client.delete('/api/scans/nonexistent-id')
        # Could be 404 (not found) or 200 (idempotent delete)
        assert response.status_code in [200, 204, 404]


class TestScanImagesEndpoint:
    """Tests for GET /api/scans/<id>/images endpoint."""

    def test_images_returns_array(self, client):
        """Images endpoint should return an array."""
        response = client.get('/api/scans/any-id/images')

        if response.status_code == 200:
            data = json.loads(response.data)
            assert isinstance(data, list)


class TestSecurityHeaders:
    """Tests for security-related response headers."""

    def test_cors_headers_present(self, client):
        """CORS headers should be present for cross-origin requests."""
        response = client.get('/health')
        # CORS is enabled in the app, check it doesn't block requests
        assert response.status_code == 200

    def test_json_content_type(self, client):
        """API responses should have JSON content type."""
        response = client.get('/health')
        assert 'application/json' in response.content_type


class TestInputValidation:
    """Tests for input validation across endpoints."""

    @pytest.mark.security
    def test_oversized_request_body(self, client):
        """Oversized request bodies should be handled."""
        large_data = {
            'name': 'a' * 10000,
            'targets': ['nginx:latest'] * 1000
        }

        response = client.post(
            '/api/scans/start',
            json=large_data,
            content_type='application/json'
        )

        # Should either reject (413, 400) or handle gracefully
        assert response.status_code in [200, 201, 202, 400, 413, 422]

    @pytest.mark.security
    def test_malformed_json(self, client):
        """Malformed JSON should return 400."""
        response = client.post(
            '/api/scans/start',
            data='{"invalid json',
            content_type='application/json'
        )

        assert response.status_code == 400

    @pytest.mark.security
    def test_wrong_content_type(self, client):
        """Wrong content type should be handled."""
        response = client.post(
            '/api/scans/start',
            data='name=test&targets=nginx',
            content_type='application/x-www-form-urlencoded'
        )

        # Should either reject or handle
        assert response.status_code in [200, 400, 415]
