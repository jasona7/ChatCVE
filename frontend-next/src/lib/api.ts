// API service layer for connecting to the Python Flask backend

export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

class ApiService {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error) {
      console.error('API request failed:', error)
      return { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }
    }
  }

  // Chat endpoints
  async sendChatMessage(question: string): Promise<ApiResponse<{ answer: string }>> {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ question }),
    })
  }

  async getChatHistory(): Promise<ApiResponse<any[]>> {
    return this.request('/api/chat/history')
  }

  // CVE endpoints
  async getCVEs(filters?: {
    severity?: string[]
    search?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams()
    if (filters?.severity?.length) {
      params.append('severity', filters.severity.join(','))
    }
    if (filters?.search) {
      params.append('search', filters.search)
    }
    if (filters?.limit) {
      params.append('limit', filters.limit.toString())
    }
    if (filters?.offset) {
      params.append('offset', filters.offset.toString())
    }

    return this.request(`/api/cves?${params.toString()}`)
  }

  async getCVEById(cveId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/cves/${cveId}`)
  }

  // Dashboard stats
  async getDashboardStats(): Promise<ApiResponse<any>> {
    return this.request('/api/dashboard/stats')
  }

  // Scan management
  async getScans(): Promise<ApiResponse<any[]>> {
    return this.request('/api/scans')
  }

  async startScan(imageName: string): Promise<ApiResponse<{ scanId: string }>> {
    return this.request('/api/scans', {
      method: 'POST',
      body: JSON.stringify({ image_name: imageName }),
    })
  }

  async stopScan(scanId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/scans/${scanId}/stop`, {
      method: 'POST',
    })
  }

  async deleteScan(scanId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/scans/${scanId}`, {
      method: 'DELETE',
    })
  }

  // Database queries (raw SQL for advanced users)
  async executeQuery(query: string): Promise<ApiResponse<any[]>> {
    return this.request('/api/database/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  }

  async getTables(): Promise<ApiResponse<string[]>> {
    return this.request('/api/database/tables')
  }

  async getTableSchema(tableName: string): Promise<ApiResponse<any>> {
    return this.request(`/api/database/tables/${tableName}/schema`)
  }
}

export const apiService = new ApiService()

// Utility functions for mock data
export function generateMockCVEs(count: number = 100) {
  const packages = ['curl', 'openssl', 'nginx', 'redis', 'postgres', 'alpine', 'ubuntu', 'debian']
  const severities = ['Critical', 'High', 'Medium', 'Low', 'Negligible'] as const
  const types = ['deb', 'rpm', 'java-archive', 'npm', 'python']
  const images = [
    'nginx:latest',
    'redis:7.0',
    'postgres:14',
    'alpine:latest',
    'ubuntu:20.04'
  ]

  return Array.from({ length: count }, (_, i) => ({
    id: (i + 1).toString(),
    name: packages[i % packages.length],
    installed: `${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
    fixed_in: Math.random() > 0.3 ? `${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}` : undefined,
    type: types[i % types.length],
    vulnerability: `CVE-${2020 + Math.floor(Math.random() * 4)}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
    severity: severities[Math.floor(Math.random() * severities.length)],
    image_tag: images[i % images.length],
    date_added: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 30).toISOString()
  }))
}