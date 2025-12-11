"""
Unit tests for risk score calculation.
Tests the _calculate_risk_score method in scan_service.py
"""

import pytest
import math


class TestRiskScoreCalculation:
    """Tests for the _calculate_risk_score function."""

    def test_empty_results_returns_zero(self, scanner):
        """No scan results should return zero risk score."""
        result = scanner._calculate_risk_score([])
        assert result == 0.0

    def test_no_vulnerabilities_returns_zero(self, scanner):
        """Scan with no vulnerabilities should return zero."""
        results = [{
            'image': 'clean-image:latest',
            'packages': 100,
            'vulnerabilities': 0,
            'severity_counts': {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
        }]
        result = scanner._calculate_risk_score(results)
        assert result == 0.0

    def test_single_critical_vulnerability(self, scanner):
        """Single critical vulnerability should produce high score."""
        results = [{
            'image': 'test:latest',
            'packages': 100,
            'vulnerabilities': 1,
            'severity_counts': {'critical': 1, 'high': 0, 'medium': 0, 'low': 0}
        }]
        result = scanner._calculate_risk_score(results)
        # Critical = 25 points, log10(26) * 20 ≈ 28.3
        assert result > 25.0
        assert result < 35.0

    def test_single_high_vulnerability(self, scanner):
        """Single high vulnerability should produce moderate score."""
        results = [{
            'image': 'test:latest',
            'packages': 100,
            'vulnerabilities': 1,
            'severity_counts': {'critical': 0, 'high': 1, 'medium': 0, 'low': 0}
        }]
        result = scanner._calculate_risk_score(results)
        # High = 10 points, log10(11) * 20 ≈ 20.8
        assert result > 15.0
        assert result < 25.0

    def test_single_medium_vulnerability(self, scanner):
        """Single medium vulnerability should produce lower score."""
        results = [{
            'image': 'test:latest',
            'packages': 100,
            'vulnerabilities': 1,
            'severity_counts': {'critical': 0, 'high': 0, 'medium': 1, 'low': 0}
        }]
        result = scanner._calculate_risk_score(results)
        # Medium = 3 points, log10(4) * 20 ≈ 12.0
        assert result > 8.0
        assert result < 18.0

    def test_single_low_vulnerability(self, scanner):
        """Single low vulnerability should produce minimal score."""
        results = [{
            'image': 'test:latest',
            'packages': 100,
            'vulnerabilities': 1,
            'severity_counts': {'critical': 0, 'high': 0, 'medium': 0, 'low': 1}
        }]
        result = scanner._calculate_risk_score(results)
        # Low = 1 point, log10(2) * 20 ≈ 6.0
        assert result > 0.0
        assert result < 10.0

    def test_severity_ordering(self, scanner):
        """Critical > High > Medium > Low in risk contribution."""
        severities = ['critical', 'high', 'medium', 'low']
        scores = []

        for sev in severities:
            counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
            counts[sev] = 1
            results = [{
                'image': 'test:latest',
                'packages': 100,
                'vulnerabilities': 1,
                'severity_counts': counts
            }]
            scores.append(scanner._calculate_risk_score(results))

        # Verify ordering: critical > high > medium > low
        assert scores[0] > scores[1] > scores[2] > scores[3]

    def test_mixed_severities(self, scanner):
        """Mixed vulnerabilities should produce weighted score."""
        results = [{
            'image': 'test:latest',
            'packages': 100,
            'vulnerabilities': 10,
            'severity_counts': {'critical': 2, 'high': 3, 'medium': 3, 'low': 2}
        }]
        result = scanner._calculate_risk_score(results)
        # 2*25 + 3*10 + 3*3 + 2*1 = 50 + 30 + 9 + 2 = 91
        # log10(92) * 20 ≈ 39.3
        assert result > 35.0
        assert result < 45.0

    def test_multiple_images(self, scanner):
        """Multiple images should aggregate vulnerability counts."""
        results = [
            {
                'image': 'nginx:latest',
                'packages': 100,
                'vulnerabilities': 2,
                'severity_counts': {'critical': 1, 'high': 1, 'medium': 0, 'low': 0}
            },
            {
                'image': 'redis:7',
                'packages': 50,
                'vulnerabilities': 3,
                'severity_counts': {'critical': 0, 'high': 1, 'medium': 1, 'low': 1}
            }
        ]
        result = scanner._calculate_risk_score(results)
        # Total: 1 critical, 2 high, 1 medium, 1 low
        # 1*25 + 2*10 + 1*3 + 1*1 = 25 + 20 + 3 + 1 = 49
        assert result > 30.0
        assert result < 40.0

    def test_score_capped_at_100(self, scanner):
        """Score should never exceed 100.0."""
        results = [{
            'image': 'test:latest',
            'packages': 1000,
            'vulnerabilities': 500,
            'severity_counts': {'critical': 100, 'high': 100, 'medium': 150, 'low': 150}
        }]
        result = scanner._calculate_risk_score(results)
        assert result <= 100.0

    def test_many_critical_vulnerabilities(self, scanner):
        """Many critical vulnerabilities should approach but not exceed 100."""
        results = [{
            'image': 'test:latest',
            'packages': 1000,
            'vulnerabilities': 100,
            'severity_counts': {'critical': 100, 'high': 0, 'medium': 0, 'low': 0}
        }]
        result = scanner._calculate_risk_score(results)
        # 100 * 25 = 2500, log10(2501) * 20 ≈ 67.96
        assert result > 60.0
        assert result <= 100.0

    def test_score_is_rounded(self, scanner):
        """Score should be rounded to 1 decimal place."""
        results = [{
            'image': 'test:latest',
            'packages': 100,
            'vulnerabilities': 7,
            'severity_counts': {'critical': 1, 'high': 2, 'medium': 2, 'low': 2}
        }]
        result = scanner._calculate_risk_score(results)
        # Check that it's rounded to 1 decimal
        assert result == round(result, 1)

    def test_score_type_is_float(self, scanner):
        """Score should always be a float."""
        results = [{
            'image': 'test:latest',
            'packages': 100,
            'vulnerabilities': 1,
            'severity_counts': {'critical': 0, 'high': 0, 'medium': 0, 'low': 1}
        }]
        result = scanner._calculate_risk_score(results)
        assert isinstance(result, float)

    @pytest.mark.parametrize("critical,high,medium,low,expected_min,expected_max", [
        (0, 0, 0, 0, 0.0, 0.0),      # No vulns
        (1, 0, 0, 0, 25.0, 35.0),    # Only critical
        (0, 5, 0, 0, 25.0, 35.0),    # Multiple high
        (0, 0, 10, 0, 20.0, 30.0),   # Many medium
        (0, 0, 0, 50, 25.0, 40.0),   # Many low
        (5, 10, 15, 20, 45.0, 55.0), # Mixed realistic (score = log10(291)*20 ≈ 49.3)
    ])
    def test_score_ranges(self, scanner, critical, high, medium, low, expected_min, expected_max):
        """Test various vulnerability combinations produce expected score ranges."""
        results = [{
            'image': 'test:latest',
            'packages': 100,
            'vulnerabilities': critical + high + medium + low,
            'severity_counts': {'critical': critical, 'high': high, 'medium': medium, 'low': low}
        }]
        result = scanner._calculate_risk_score(results)
        if expected_min == 0.0 and expected_max == 0.0:
            assert result == 0.0
        else:
            assert expected_min <= result <= expected_max, f"Score {result} not in range [{expected_min}, {expected_max}]"
