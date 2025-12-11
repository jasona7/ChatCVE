/**
 * MSW (Mock Service Worker) handlers for API mocking in tests.
 * These handlers intercept API requests and return mock responses.
 */

import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Sample mock data
const mockScans = [
  {
    id: 'scan-1',
    name: 'Production Scan',
    image_name: 'nginx:latest',
    images: ['nginx:latest', 'redis:7'],
    status: 'completed',
    risk_score: 35.5,
    created_at: '2024-01-15T10:00:00Z',
    scan_duration: 45,
    total_packages_scanned: 150,
    total_vulnerabilities_found: 10,
    critical_count: 2,
    high_count: 3,
    medium_count: 3,
    low_count: 2,
  },
  {
    id: 'scan-2',
    name: 'Dev Environment',
    image_name: 'python:3.10-slim',
    images: ['python:3.10-slim'],
    status: 'running',
    risk_score: null,
    created_at: '2024-01-15T11:00:00Z',
    scan_duration: null,
    total_packages_scanned: null,
    total_vulnerabilities_found: null,
    critical_count: null,
    high_count: null,
    medium_count: null,
    low_count: null,
  },
];

const mockCVEs = [
  {
    id: 'CVE-2024-1234',
    severity: 'CRITICAL',
    package: 'openssl',
    affected_images: ['nginx:latest', 'redis:7'],
    total_occurrences: 3,
    cvss_score: 9.8,
    first_seen: '2024-01-10T00:00:00Z',
    last_seen: '2024-01-15T00:00:00Z',
  },
  {
    id: 'CVE-2024-5678',
    severity: 'HIGH',
    package: 'curl',
    affected_images: ['nginx:latest'],
    total_occurrences: 1,
    cvss_score: 8.1,
    first_seen: '2024-01-12T00:00:00Z',
    last_seen: '2024-01-15T00:00:00Z',
  },
  {
    id: 'CVE-2024-9012',
    severity: 'MEDIUM',
    package: 'zlib',
    affected_images: ['python:3.10-slim'],
    total_occurrences: 2,
    cvss_score: 5.3,
    first_seen: '2024-01-14T00:00:00Z',
    last_seen: '2024-01-15T00:00:00Z',
  },
];

const mockChatHistory = [
  {
    id: 1,
    question: 'What are the critical vulnerabilities?',
    response: 'There are 2 critical vulnerabilities: CVE-2024-1234 affecting openssl and CVE-2024-5678 affecting curl.',
    timestamp: '2024-01-15T10:00:00Z',
  },
];

export const handlers = [
  // =========================================================================
  // Health Check
  // =========================================================================
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ai_enabled: true,
    });
  }),

  // =========================================================================
  // Scan Endpoints
  // =========================================================================
  http.get(`${API_BASE}/api/scans`, () => {
    return HttpResponse.json(mockScans);
  }),

  http.post(`${API_BASE}/api/scans/start`, async ({ request }) => {
    const body = await request.json() as { name?: string; targets?: string[] };

    if (!body.targets || body.targets.length === 0) {
      return HttpResponse.json(
        { error: 'At least one target image is required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      scan_id: `scan-${Date.now()}`,
      status: 'running',
      message: 'Scan started successfully',
    }, { status: 201 });
  }),

  http.get(`${API_BASE}/api/scans/:scanId/progress`, ({ params }) => {
    const { scanId } = params;
    return HttpResponse.json({
      id: scanId,
      name: 'Test Scan',
      status: 'running',
      progress: 65,
      current_step: 'Scanning vulnerabilities...',
      logs: [
        { timestamp: '2024-01-15T10:00:00Z', level: 'info', message: 'Scan started' },
        { timestamp: '2024-01-15T10:00:30Z', level: 'info', message: 'Pulling image...' },
        { timestamp: '2024-01-15T10:01:00Z', level: 'success', message: 'Image pulled successfully' },
      ],
      start_time: '2024-01-15T10:00:00Z',
      targets: ['nginx:latest'],
      current_target: 'nginx:latest',
      total_targets: 1,
      completed_targets: 0,
    });
  }),

  http.get(`${API_BASE}/api/scans/:scanId/logs`, ({ params }) => {
    return HttpResponse.json({
      logs: [
        { timestamp: '2024-01-15T10:00:00Z', level: 'info', message: 'Scan initialized' },
        { timestamp: '2024-01-15T10:00:30Z', level: 'info', message: 'Pulling nginx:latest...' },
        { timestamp: '2024-01-15T10:01:00Z', level: 'success', message: 'Pull complete' },
        { timestamp: '2024-01-15T10:01:30Z', level: 'info', message: 'Generating SBOM...' },
        { timestamp: '2024-01-15T10:02:00Z', level: 'warn', message: 'Found 10 vulnerabilities' },
      ],
    });
  }),

  http.delete(`${API_BASE}/api/scans/:scanId`, ({ params }) => {
    const { scanId } = params;
    const scanExists = mockScans.some(s => s.id === scanId);

    if (!scanExists) {
      return HttpResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ message: 'Scan deleted successfully' });
  }),

  http.get(`${API_BASE}/api/scans/:scanId/images`, ({ params }) => {
    return HttpResponse.json([
      {
        image: 'nginx:latest',
        vulnerabilities: 7,
        critical: 1,
        high: 2,
        medium: 2,
        low: 2,
      },
      {
        image: 'redis:7',
        vulnerabilities: 3,
        critical: 1,
        high: 1,
        medium: 1,
        low: 0,
      },
    ]);
  }),

  http.get(`${API_BASE}/api/scans/:scanId/images/:imageName/vulnerabilities`, ({ params }) => {
    return HttpResponse.json([
      { id: 'CVE-2024-1234', severity: 'CRITICAL', package: 'openssl', version: '1.1.1' },
      { id: 'CVE-2024-5678', severity: 'HIGH', package: 'curl', version: '7.88.0' },
      { id: 'CVE-2024-9012', severity: 'MEDIUM', package: 'zlib', version: '1.2.11' },
    ]);
  }),

  http.get(`${API_BASE}/api/scans/active`, () => {
    return HttpResponse.json({
      active_scans: ['scan-2'],
    });
  }),

  // =========================================================================
  // Chat Endpoints
  // =========================================================================
  http.post(`${API_BASE}/api/chat`, async ({ request }) => {
    const body = await request.json() as { question?: string };

    if (!body.question || body.question.trim() === '') {
      return HttpResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Simulate AI response based on question
    let response = 'Based on the vulnerability data in your scans, ';

    if (body.question.toLowerCase().includes('critical')) {
      response += 'there are 2 critical vulnerabilities that need immediate attention.';
    } else if (body.question.toLowerCase().includes('recent')) {
      response += 'the most recent scan was "Production Scan" completed on January 15, 2024.';
    } else {
      response += 'I can help you analyze your container security posture.';
    }

    return HttpResponse.json({
      response,
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/api/chat/history`, () => {
    return HttpResponse.json(mockChatHistory);
  }),

  // =========================================================================
  // CVE Endpoints
  // =========================================================================
  http.get(`${API_BASE}/api/cves`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const severity = url.searchParams.get('severity_filter');

    let filtered = [...mockCVEs];

    if (search) {
      filtered = filtered.filter(cve =>
        cve.id.toLowerCase().includes(search.toLowerCase()) ||
        cve.package.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (severity && severity !== 'all') {
      filtered = filtered.filter(cve => cve.severity === severity.toUpperCase());
    }

    return HttpResponse.json(filtered);
  }),

  http.get(`${API_BASE}/api/cves/:cveId/details`, ({ params }) => {
    const { cveId } = params;
    const cve = mockCVEs.find(c => c.id === cveId);

    if (!cve) {
      return HttpResponse.json(
        { error: 'CVE not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      ...cve,
      description: 'A vulnerability was discovered that could allow remote code execution.',
      remediation: 'Update to the latest version of the affected package.',
      references: [
        'https://nvd.nist.gov/vuln/detail/' + cveId,
      ],
      scans: ['scan-1'],
      packages: [{ name: cve.package, version: '1.0.0', fixed_in: '1.0.1' }],
    });
  }),

  http.get(`${API_BASE}/cves/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    const results = mockCVEs.filter(cve =>
      cve.id.toLowerCase().includes(query.toLowerCase()) ||
      cve.package.toLowerCase().includes(query.toLowerCase())
    );

    return HttpResponse.json(results);
  }),

  // =========================================================================
  // Statistics Endpoints
  // =========================================================================
  http.get(`${API_BASE}/api/stats/vulnerabilities`, () => {
    return HttpResponse.json({
      total: 150,
      critical: 10,
      high: 35,
      medium: 60,
      low: 45,
    });
  }),

  http.get(`${API_BASE}/api/activity/recent`, () => {
    return HttpResponse.json([
      {
        id: 1,
        type: 'scan_completed',
        description: 'Scan "Production Scan" completed successfully',
        time: '2024-01-15T10:05:00Z',
        severity: 'info',
      },
      {
        id: 2,
        type: 'critical_found',
        description: 'Critical vulnerability CVE-2024-1234 found in nginx:latest',
        time: '2024-01-15T10:04:00Z',
        severity: 'critical',
      },
      {
        id: 3,
        type: 'scan_started',
        description: 'Scan "Dev Environment" started',
        time: '2024-01-15T11:00:00Z',
        severity: 'info',
      },
    ]);
  }),
];

// Export individual handler groups for selective use in tests
export const scanHandlers = handlers.filter(h =>
  h.info.path.toString().includes('/scans')
);

export const chatHandlers = handlers.filter(h =>
  h.info.path.toString().includes('/chat')
);

export const cveHandlers = handlers.filter(h =>
  h.info.path.toString().includes('/cves') || h.info.path.toString().includes('/cve')
);

export const statsHandlers = handlers.filter(h =>
  h.info.path.toString().includes('/stats') || h.info.path.toString().includes('/activity')
);
