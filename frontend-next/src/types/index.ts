export interface ChatMessage {
  id: string
  question: string
  response: string
  timestamp: string
}

export interface VulnerabilityStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

export interface ScanResult {
  id: string
  image: string
  images?: string[]
  image_count?: number
  name?: string
  timestamp: string
  status: 'completed' | 'running' | 'failed'
  vulnerabilities: number
  critical?: number
  high?: number
  medium?: number
  low?: number
  packages?: number
  user_scan_name?: string
  
  // Performance & Statistics
  scan_duration?: number  // seconds
  total_packages_scanned?: number
  total_vulnerabilities_found?: number
  scan_status?: string
  scan_type?: string
  
  // Technical Details
  syft_version?: string
  grype_version?: string
  scan_engine?: string
  scan_source?: string
  
  // Security Insights
  risk_score?: number
  critical_count?: number
  high_count?: number
  medium_count?: number
  low_count?: number
  exploitable_count?: number
  
  // Compliance & Tracking
  scan_initiator?: string
  compliance_policy?: string
  scan_tags?: string[]
  project_name?: string
  environment?: string
  created_at?: string
}

export interface CVEItem {
  id: string
  description: string
  severity: string
  score: number
  published: string
  affected_packages: string[]
}

export interface ScanMetadata {
  // Performance & Statistics
  scan_duration: number  // seconds
  total_packages_scanned: number
  total_vulnerabilities_found: number
  scan_status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  scan_type: 'FULL' | 'INCREMENTAL' | 'RESCAN'
  
  // Technical Details
  syft_version: string
  grype_version: string
  scan_engine: 'DOCKER_PULL' | 'REGISTRY_API'
  scan_source: 'FILE_UPLOAD' | 'MANUAL_INPUT' | 'API'
  
  // Security Insights
  risk_score: number  // 0-100
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  exploitable_count: number
  
  // Compliance & Tracking
  scan_initiator: string
  compliance_policy?: string
  scan_tags: string[]
  project_name?: string
  environment?: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'
}

export interface CVEItem {
  id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  affected_images: number
  affected_packages: number
  total_occurrences: number
  first_seen: string
  last_seen: string
  cvss_score?: number
  description?: string
  published?: string
  score?: number
}

export interface CVEDetails {
  id: string
  severity: string
  affected_images: string[]
  affected_packages: number
  total_occurrences: number
  scans: {
    scan_name: string
    scan_timestamp: string
    images: string[]
    packages: {
      name: string
      version: string
      fixed_in?: string
      type: string
      image: string
    }[]
  }[]
  packages: {
    name: string
    version: string
    fixed_in?: string
    type: string
    image: string
    scan_name?: string
  }[]
}

export interface NewScanRequest {
  name: string
  targets: string[]
  type?: string
  
  // Optional metadata
  scan_initiator?: string
  project_name?: string
  environment?: string
  scan_tags?: string[]
  compliance_policy?: string
}

