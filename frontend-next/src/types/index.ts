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
}

export interface CVEItem {
  id: string
  description: string
  severity: string
  score: number
  published: string
  affected_packages: string[]
}

