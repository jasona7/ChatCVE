export interface CVERecord {
  id: string
  name: string
  installed: string
  fixed_in?: string
  type: string
  vulnerability: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Negligible'
  image_tag: string
  date_added: string
}

export interface NVDRecord {
  cve_id: string
  source_id: string
  published: string
  last_modified: string
  vuln_status: string
  description: string
  cvss_v30_base_score?: number
  cvss_v30_base_severity?: string
  cvss_v2_base_score?: number
  cvss_v2_base_severity?: string
  weakness?: string
  ref_info?: string
}

export interface ChatMessage {
  id: string
  question: string
  answer: string
  timestamp: string
  saved?: boolean
}

export interface ScanJob {
  id: string
  image_name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  vulnerabilities_found?: number
  critical_count?: number
  high_count?: number
  medium_count?: number
  low_count?: number
}

export interface UserWorkspace {
  id: string
  name: string
  description?: string
  saved_queries: string[]
  bookmarked_cves: string[]
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  total_vulnerabilities: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  negligible_count: number
  scanned_images: number
  latest_scan_date: string
  top_vulnerable_packages: { name: string; count: number }[]
}