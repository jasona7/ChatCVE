import {
  ChatMessage,
  VulnerabilityStats,
  ScanResult,
  CVEItem,
  CVEDetails,
  NewScanRequest
} from '@/types'

const API_BASE = '/api'

export interface ActivityItem {
  id: number
  type: 'scan' | 'cve' | 'chat'
  description: string
  time: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'error'
}

export interface ScanProgress {
  scan_id: string
  name: string
  status: 'initializing' | 'running' | 'completed' | 'failed'
  progress: number
  current_step: string
  current_image?: string
  images_completed: number
  images_total: number
  vulnerabilities_found: number
  packages_scanned: number
  start_time: string
  end_time?: string
  error?: string
}

export interface ImageVulnerabilities {
  image: string
  vulnerabilities: number
  critical: number
  high: number
  medium: number
  low: number
}

export interface VulnerabilityDetail {
  id: string
  severity: string
  package: string
  version: string
}

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };

  const token = localStorage.getItem('chatcve_token');
  if (token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }
  return { 'Content-Type': 'application/json' };
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  })

  // Handle 401 - redirect to login
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chatcve_token');
      localStorage.removeItem('chatcve_user');
      window.location.href = '/login';
    }
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || error.message || 'Request failed')
  }

  return response.json()
}

export const api = {
  // Chat endpoints
  async sendMessage(question: string): Promise<string> {
    const data = await fetchAPI<{ response: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ question }),
    })
    return data.response
  },

  /**
   * Send a chat message and stream the AI response via Server-Sent Events.
   * Falls back to the non-streaming endpoint if streaming is unavailable.
   */
  async streamMessage(
    question: string,
    callbacks: {
      onToken?: (token: string) => void
      onStep?: (tool: string) => void
      onDone?: (fullResponse: string) => void
      onError?: (message: string) => void
    }
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question }),
      })

      if (!response.ok || !response.body) {
        // Non-streaming fallback (e.g., older backend, proxy buffering)
        const fallback = await this.sendMessage(question)
        callbacks.onToken?.(fallback)
        callbacks.onDone?.(fallback)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          try {
            const event = JSON.parse(line.slice(5).trim())
            switch (event.type) {
              case 'token':
                callbacks.onToken?.(event.content ?? '')
                break
              case 'step':
                callbacks.onStep?.(event.tool ?? '')
                break
              case 'done':
                finalResponse = event.response ?? ''
                callbacks.onDone?.(finalResponse)
                break
              case 'error':
                callbacks.onError?.(event.message ?? 'Unknown error')
                break
            }
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }

      // If the server never sent a done event, treat what we have as final
      if (!finalResponse) {
        callbacks.onDone?.('')
      }
    } catch (error) {
      callbacks.onError?.(
        error instanceof Error ? error.message : 'Request failed'
      )
    }
  },

  async getChatHistory(): Promise<ChatMessage[]> {
    return fetchAPI<ChatMessage[]>('/chat/history')
  },

  async clearChatHistory(): Promise<{ message: string }> {
    return fetchAPI<{ message: string }>('/chat/history', {
      method: 'DELETE',
    })
  },

  // Vulnerability stats
  async getVulnerabilityStats(): Promise<VulnerabilityStats> {
    return fetchAPI<VulnerabilityStats>('/stats/vulnerabilities')
  },

  // Chart data for dashboard
  async getChartData(): Promise<any> {
    return fetchAPI('/stats/charts')
  },

  // Activity
  async getRecentActivity(): Promise<ActivityItem[]> {
    return fetchAPI<ActivityItem[]>('/activity/recent')
  },

  // Scans
  async getScans(): Promise<ScanResult[]> {
    return fetchAPI<ScanResult[]>('/scans')
  },

  async startScan(request: NewScanRequest): Promise<{ scan_id: string; status: string; message: string }> {
    return fetchAPI('/scans/start', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  async getScanProgress(scanId: string): Promise<ScanProgress> {
    return fetchAPI<ScanProgress>(`/scans/${scanId}/progress`)
  },

  async getScanLogs(scanId: string): Promise<{ logs: string[] }> {
    return fetchAPI<{ logs: string[] }>(`/scans/${scanId}/logs`)
  },

  async deleteScan(scanId: string): Promise<{ message: string }> {
    return fetchAPI(`/scans/${scanId}`, {
      method: 'DELETE',
    })
  },

  async getScanImages(scanId: string): Promise<ImageVulnerabilities[]> {
    return fetchAPI<ImageVulnerabilities[]>(`/scans/${scanId}/images`)
  },

  async getImageVulnerabilities(scanId: string, imageName: string): Promise<VulnerabilityDetail[]> {
    return fetchAPI<VulnerabilityDetail[]>(`/scans/${scanId}/images/${encodeURIComponent(imageName)}/vulnerabilities`)
  },

  async getActiveScans(): Promise<{ active_scans: ScanProgress[] }> {
    return fetchAPI<{ active_scans: ScanProgress[] }>('/scans/active')
  },

  // CVEs
  async getCVEs(limit?: number, search?: string, severity?: string): Promise<CVEItem[]> {
    const params = new URLSearchParams()
    if (limit) params.set('limit', limit.toString())
    if (search) params.set('search', search)
    if (severity) params.set('severity', severity)
    const query = params.toString()
    return fetchAPI<CVEItem[]>(`/cves${query ? `?${query}` : ''}`)
  },

  async searchCVEs(query: string): Promise<CVEItem[]> {
    return this.getCVEs(50, query)
  },

  async getCVEDetails(cveId: string): Promise<CVEDetails> {
    return fetchAPI<CVEDetails>(`/cves/${cveId}/details`)
  },

  // Password management
  async adminResetPassword(userId: number, newPassword: string): Promise<{ message: string }> {
    return fetchAPI(`/auth/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ new_password: newPassword }),
    })
  },

  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return fetchAPI('/auth/me/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
  },

  // User preferences
  async getUserPreference<T = any>(key: string): Promise<T | null> {
    try {
      const data = await fetchAPI<{ key: string; value: T | null }>(`/user/preferences/${key}`)
      return data.value
    } catch (error) {
      console.error(`Error getting preference ${key}:`, error)
      return null
    }
  },

  async setUserPreference<T = any>(key: string, value: T): Promise<void> {
    await fetchAPI(`/user/preferences/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    })
  },

  async deleteUserPreference(key: string): Promise<void> {
    await fetchAPI(`/user/preferences/${key}`, {
      method: 'DELETE',
    })
  },

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; ai_enabled: boolean }> {
    return fetchAPI('/health')
  },
}

export default api
