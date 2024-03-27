import unittest
from unittest.mock import patch
from scan import syft_scan

class TestSyftScan(unittest.TestCase):
    @patch('scan.subprocess.run')
    def test_syft_scan_success(self, mock_run):
        # Mock subprocess.run to simulate syft command success
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = '{"vulnerabilities": []}'  # Example JSON output

        result = syft_scan("dummy_image")
        self.assertIsNotNone(result)
        self.assertEqual(result, {"vulnerabilities": []})

    @patch('scan.subprocess.run')
    def test_syft_scan_failure(self, mock_run):
        # Mock subprocess.run to simulate syft command failure
        mock_run.return_value.returncode = 1
        mock_run.return_value.stderr = "error message"

        result = syft_scan("dummy_image")
        self.assertIsNone(result)

if __name__ == '__main__':
    unittest.main()
