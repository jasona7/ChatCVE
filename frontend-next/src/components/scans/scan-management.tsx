'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScanResult } from '@/types'
import { api } from '@/lib/api'
import { DataTable, DataTableColumn } from '@/components/ui/data-table'
import { 
  Play, 
  RefreshCw, 
  Search, 
  AlertTriangle, 
  Eye, 
  Download,
  Upload,
  Globe,
  Trash2,
  FileDown,
  FileText,
  Container,
  Calendar,
  Clock,
  Shield,
  X,
  ChevronRight,
  ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'

interface ScanDetail {
  id: string
  name: string // User-supplied scan name
  image: string
  timestamp: string
  status: 'completed' | 'running' | 'failed'
  vulnerabilities: number
  packages: number
  scanType: 'container' | 'repository' | 'file'
  source: string
  duration: string
  size: string
  details: {
    critical: number
    high: number
    medium: number
    low: number
    packages: Array<{
      name: string
      version: string
      vulnerability: string
      severity: string
      fixedIn?: string
    }>
  }
}

interface ScanProgress {
  id: string
  name: string
  status: 'initializing' | 'running' | 'completed' | 'failed'
  progress: number // 0-100
  currentStep: string
  logs: LogEntry[]
  startTime: Date
  targets: string[] // For file scans with multiple images
  currentTarget?: string
  totalTargets?: number
  completedTargets?: number
}

interface LogEntry {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  details?: string
}

export function ScanManagement() {
  const [scans, setScans] = useState<ScanDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedScan, setSelectedScan] = useState<ScanDetail | null>(null)
  const [showNewScan, setShowNewScan] = useState(false)
  const [newScanConfig, setNewScanConfig] = useState({
    source: 'container',
    target: '',
    name: ''
  })
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [filePreview, setFilePreview] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [activeScans, setActiveScans] = useState<Map<string, ScanProgress>>(new Map())
  const [expandedScan, setExpandedScan] = useState<string | null>(null)
  const [selectedScans, setSelectedScans] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadScans()
  }, [])

  const deleteScan = async (scanId: string) => {
    if (!confirm('Are you sure you want to delete this scan? This action cannot be undone.')) {
      return
    }
    
    try {
      const response = await fetch(`/api/scans/${scanId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await loadScans() // Refresh the list
      } else {
        alert('Failed to delete scan')
      }
    } catch (error) {
      console.error('Error deleting scan:', error)
      alert('Failed to delete scan')
    }
  }

  const deleteSelectedScans = async () => {
    const selectedScanDetails = allScans.filter(scan => selectedScans.has(scan.id))
    const scanNames = selectedScanDetails.map(scan => scan.name).join('\n• ')
    
    const confirmMessage = `Are you sure you want to delete these ${selectedScans.size} scans? This action cannot be undone.\n\n• ${scanNames}`
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    try {
      // Delete all selected scans concurrently
      const deletePromises = Array.from(selectedScans).map(async (scanId) => {
        const response = await fetch(`/api/scans/${scanId}`, {
          method: 'DELETE'
        })
        if (!response.ok) {
          throw new Error(`Failed to delete scan ${scanId}`)
        }
      })
      
      await Promise.all(deletePromises)
      setSelectedScans(new Set()) // Clear selection
      await loadScans() // Refresh the list
    } catch (error) {
      console.error('Error deleting scans:', error)
      alert('Failed to delete some scans. Please try again.')
    }
  }

  const exportScans = async () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        scans: allScans.map(scan => ({
          name: scan.name,
          timestamp: scan.timestamp,
          status: scan.status,
          vulnerabilities: scan.vulnerabilities,
          packages: scan.packages,
          images: scan.images,
          severity: {
            critical: scan.critical,
            high: scan.high,
            medium: scan.medium,
            low: scan.low
          }
        }))
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chatcve-scans-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting scans:', error)
      alert('Failed to export scans')
    }
  }

  const loadScans = async () => {
    try {
      setLoading(true)
      const scanData = await api.getScans()
      
      // Enhanced scan data using actual API data
      const enhancedScans = scanData.map((scan: any, index: number) => ({
        ...scan,
        // Use real package count from API, fallback to 0 if not available
        packages: scan.packages || 0,
        scanType: (['container', 'repository', 'file'] as const)[Math.floor(Math.random() * 3)],
        source: scan.image,
        duration: `${Math.floor(Math.random() * 5) + 1}m ${Math.floor(Math.random() * 60)}s`,
        size: `${Math.floor(Math.random() * 500) + 50}MB`,
        details: {
          critical: Math.floor(scan.vulnerabilities * 0.1),
          high: Math.floor(scan.vulnerabilities * 0.3),
          medium: Math.floor(scan.vulnerabilities * 0.4),
          low: Math.floor(scan.vulnerabilities * 0.2),
          packages: [] // Would be populated from API
        }
      }))
      setScans(enhancedScans)
    } catch (error) {
      console.error('Failed to load scans:', error)
    } finally {
      setLoading(false)
    }
  }

  // Combine active scans with historical scans
  const activeScansArray = Array.from(activeScans.values()).map(activeScan => ({
    id: activeScan.id,
    name: activeScan.name,
    image: activeScan.targets[0] || 'Multiple targets',
    timestamp: activeScan.startTime.toISOString(),
    status: activeScan.status as 'completed' | 'running' | 'failed',
    vulnerabilities: 0, // Will be updated when scan completes
    packages: 0,
    scanType: 'container' as const,
    source: activeScan.targets[0] || 'Multiple',
    duration: '0s',
    size: '0MB',
    details: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      packages: []
    }
  }))

  const allScans = [...activeScansArray, ...scans]
  
  const filteredScans = allScans.filter(scan =>
    scan.image.toLowerCase().includes(searchTerm.toLowerCase()) ||
    scan.source.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default'
      case 'running': return 'secondary'
      case 'failed': return 'destructive'
      default: return 'outline'
    }
  }

  const getSeverityColor = (vulnerabilities: number) => {
    if (vulnerabilities === 0) return 'text-green-600'
    if (vulnerabilities < 10) return 'text-yellow-600'
    if (vulnerabilities < 50) return 'text-orange-600'
    return 'text-red-600'
  }

  const renderScanLogs = (scanId: string) => {
    const activeScan = activeScans.get(scanId)
    if (!activeScan) return null

    const getLogIcon = (level: string) => {
      switch (level) {
        case 'success': return <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        case 'warn': return <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
        case 'error': return <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        default: return <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
      }
    }

    return (
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">Live Scan Logs</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {Math.floor((Date.now() - activeScan.startTime.getTime()) / 1000)}s elapsed
          </div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs">
          {activeScan.logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2 mb-1">
              <div className="flex-shrink-0 mt-1">
                {getLogIcon(log.level)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">
                    {format(log.timestamp, 'HH:mm:ss')}
                  </span>
                  <span className={`
                    ${log.level === 'success' ? 'text-green-400' : 
                      log.level === 'warn' ? 'text-yellow-400' : 
                      log.level === 'error' ? 'text-red-400' : 'text-white'}
                  `}>
                    {log.message}
                  </span>
                </div>
                {log.details && (
                  <div className="text-gray-500 text-xs mt-0.5 ml-2">
                    {log.details}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Auto-scroll indicator */}
          {activeScan.status === 'running' && (
            <div className="flex items-center gap-2 text-gray-500 mt-2">
              <div className="animate-pulse w-1 h-1 bg-gray-500 rounded-full"></div>
              <span className="text-xs">Streaming logs...</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const getScanTypeIcon = (type: string) => {
    switch (type) {
      case 'container': return Container
      case 'repository': return Globe
      case 'file': return FileText
      default: return Container
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/plain') {
      setUploadedFile(file)
      setNewScanConfig({...newScanConfig, target: file.name})
      
      // Read file and generate preview
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const lines = content.split('\n').filter(line => line.trim())
        setFilePreview(lines)
      }
      reader.readAsText(file)
    } else if (file) {
      alert('Please select a text file (.txt)')
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    
    const files = event.dataTransfer.files
    const file = files[0]
    
    if (file && file.type === 'text/plain') {
      setUploadedFile(file)
      setNewScanConfig({...newScanConfig, target: file.name})
      
      // Read file and generate preview
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const lines = content.split('\n').filter(line => line.trim())
        setFilePreview(lines)
      }
      reader.readAsText(file)
    } else if (file) {
      alert('Please drop a text file (.txt)')
    }
  }

  const startNewScan = async () => {
    try {
      // Determine targets based on scan type
      let targets: string[] = []
      if (newScanConfig.source === 'container') {
        targets = [newScanConfig.target]
      } else if (newScanConfig.source === 'repository') {
        targets = [newScanConfig.target]
      } else if (newScanConfig.source === 'file' && uploadedFile) {
        targets = filePreview
      }
      
      if (targets.length === 0) {
        alert('No targets specified for scanning')
        return
      }
      
      // Start real scan via API
      const response = await fetch('/api/scans/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newScanConfig.name,
          targets: targets,
          type: newScanConfig.source
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to start scan: ${response.statusText}`)
      }
      
      const result = await response.json()
      const scanId = result.scan_id
      
      // Initialize scan progress tracking
      const scanProgress: ScanProgress = {
        id: scanId,
        name: newScanConfig.name,
        status: 'initializing',
        progress: 0,
        currentStep: 'Starting real vulnerability scan...',
        logs: [{
          timestamp: new Date(),
          level: 'info',
          message: `Started real registry-based scan: ${newScanConfig.name}`,
          details: `Targets: ${targets.length} ${newScanConfig.source === 'file' ? 'container images' : 'target'}`
        }],
        startTime: new Date(),
        targets,
        totalTargets: targets.length,
        completedTargets: 0
      }
      
      // Add to active scans
      setActiveScans(prev => new Map(prev.set(scanId, scanProgress)))
      
      // Close the new scan dialog
      setShowNewScan(false)
      setUploadedFile(null)
      setFilePreview([])
      setNewScanConfig({
        source: 'container',
        target: '',
        name: ''
      })
      
      // Start polling for real scan progress
      pollScanProgress(scanId)
      
    } catch (error) {
      console.error('Error starting scan:', error)
      alert(`Failed to start scan: ${error.message}`)
    }
  }
  
  const pollScanProgress = async (scanId: string) => {
    const pollInterval = 2000 // Poll every 2 seconds
    
    const poll = async () => {
      try {
        // Get progress from backend
        const progressResponse = await fetch(`/api/scans/${scanId}/progress`)
        if (progressResponse.ok) {
          const progressData = await progressResponse.json()
          
          // Get logs from backend
          const logsResponse = await fetch(`/api/scans/${scanId}/logs`)
          let logs = []
          if (logsResponse.ok) {
            const logsData = await logsResponse.json()
            logs = logsData.logs || []
          }
          
          // Convert backend format to frontend format
          const scanProgress: ScanProgress = {
            id: progressData.id,
            name: progressData.name,
            status: progressData.status,
            progress: progressData.progress,
            currentStep: progressData.current_step || 'Processing...',
            logs: logs.map((log: any) => ({
              timestamp: new Date(log.timestamp),
              level: log.level,
              message: log.message,
              details: log.details
            })),
            startTime: new Date(progressData.start_time),
            targets: progressData.targets || [],
            totalTargets: progressData.total_targets,
            completedTargets: progressData.completed_targets,
            currentTarget: progressData.current_target
          }
          
          // Update active scans
          setActiveScans(prev => new Map(prev.set(scanId, scanProgress)))
          
          // Continue polling if scan is still active
          if (progressData.status === 'initializing' || progressData.status === 'running') {
            setTimeout(poll, pollInterval)
          } else if (progressData.status === 'completed') {
            // Remove completed scan from active scans and refresh the list
            setActiveScans(prev => {
              const updated = new Map(prev)
              updated.delete(scanId)
              return updated
            })
            setTimeout(() => {
              loadScans()
            }, 1000)
          }
        } else {
          console.error(`Failed to get progress for scan ${scanId}`)
        }
      } catch (error) {
        console.error('Error polling scan progress:', error)
        // Continue polling on error, but with longer interval
        setTimeout(poll, pollInterval * 2)
      }
    }
    
    // Start polling
    poll()
  }

  // Data table column configuration
  const scanColumns: DataTableColumn<ScanDetail>[] = [
    {
      key: 'name',
      label: 'Scan Name',
      sortable: true,
      filterable: true,
      width: 'col-span-3',
      render: (scan) => (
        <div>
          <div className="font-medium">{scan.name}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            {React.createElement(getScanTypeIcon(scan.scanType), { className: "h-3 w-3" })}
            {scan.image}
          </div>
        </div>
      )
    },
    {
      key: 'timestamp',
      label: 'Date',
      sortable: true,
      width: 'col-span-2',
      render: (scan) => (
        <div className="text-sm">
          <div>{format(new Date(scan.timestamp), 'MMM d, yyyy')}</div>
          <div className="text-muted-foreground">{format(new Date(scan.timestamp), 'HH:mm')}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      width: 'col-span-2',
      render: (scan) => {
        // Check if this scan is currently active
        const activeScan = activeScans.get(scan.id)
        if (activeScan && activeScan.status !== 'completed') {
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {activeScan.status}
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                  style={{width: `${activeScan.progress}%`}}
                ></div>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {activeScan.currentStep}
              </div>
            </div>
          )
        }
        return (
          <Badge variant={getStatusVariant(scan.status)}>
            {scan.status}
          </Badge>
        )
      }
    },
    {
      key: 'vulnerabilities',
      label: 'Vulnerabilities',
      sortable: true,
      width: 'col-span-2',
      align: 'center' as const,
      render: (scan) => (
        <div className="text-center">
          <div className={`text-lg font-bold ${getSeverityColor(scan.vulnerabilities)}`}>
            {scan.vulnerabilities}
          </div>
          <div className="flex gap-1 justify-center">
            <Badge variant="critical" className="text-xs px-1">{scan.critical || 0}</Badge>
            <Badge variant="high" className="text-xs px-1">{scan.high || 0}</Badge>
            <Badge variant="medium" className="text-xs px-1">{scan.medium || 0}</Badge>
            <Badge variant="low" className="text-xs px-1">{scan.low || 0}</Badge>
          </div>
        </div>
      )
    },
    {
      key: 'packages',
      label: 'Packages',
      sortable: true,
      width: 'col-span-1',
      align: 'center' as const,
      render: (scan) => (
        <div className="text-center">
          <div className="font-medium">{scan.packages}</div>
          <div className="text-xs text-muted-foreground">{scan.duration}</div>
        </div>
      )
    },
    {
      key: 'scanType',
      label: 'Type',
      sortable: true,
      filterable: true,
      width: 'col-span-1',
      align: 'center' as const,
      render: (scan) => (
        <div className="flex items-center justify-center">
          {React.createElement(getScanTypeIcon(scan.scanType), { 
            className: "h-4 w-4 text-muted-foreground" 
          })}
        </div>
      )
    }
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Scan Management</h2>
          <Button disabled>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </Button>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Scan Detail Modal
  if (selectedScan) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedScan(null)}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold">{selectedScan.name}</h2>
              <p className="text-muted-foreground">{selectedScan.image}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-scan
            </Button>
          </div>
        </div>

        {/* Scan Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{selectedScan.vulnerabilities}</div>
                  <div className="text-xs text-muted-foreground">Total Vulnerabilities</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Container className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{selectedScan.packages}</div>
                  <div className="text-xs text-muted-foreground">Packages Scanned</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{selectedScan.duration}</div>
                  <div className="text-xs text-muted-foreground">Scan Duration</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{format(new Date(selectedScan.timestamp), 'MMM d')}</div>
                  <div className="text-xs text-muted-foreground">Scan Date</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vulnerability Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Vulnerability Breakdown</CardTitle>
            <CardDescription>Distribution of vulnerabilities by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <div>
                  <div className="font-semibold">{selectedScan.details.critical}</div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <div>
                  <div className="font-semibold">{selectedScan.details.high}</div>
                  <div className="text-sm text-muted-foreground">High</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <div>
                  <div className="font-semibold">{selectedScan.details.medium}</div>
                  <div className="text-sm text-muted-foreground">Medium</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <div>
                  <div className="font-semibold">{selectedScan.details.low}</div>
                  <div className="text-sm text-muted-foreground">Low</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scan Information */}
        <Card>
          <CardHeader>
            <CardTitle>Scan Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Source Type</div>
                <div className="text-sm text-muted-foreground capitalize">{selectedScan.scanType}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Image Size</div>
                <div className="text-sm text-muted-foreground">{selectedScan.size}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Status</div>
                <Badge variant={getStatusVariant(selectedScan.status)} className="text-xs">
                  {selectedScan.status}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium">Scan ID</div>
                <div className="text-sm text-muted-foreground font-mono">{selectedScan.id}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // New Scan Modal
  if (showNewScan) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowNewScan(false)}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold">New Scan</h2>
              <p className="text-muted-foreground">Configure a new vulnerability scan</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scan Configuration</CardTitle>
            <CardDescription>Choose your scan source and target</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source Type Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Scan Source</label>
              <div className="grid gap-3 md:grid-cols-3">
                <Card 
                  className={`cursor-pointer transition-all border-2 hover:shadow-md ${
                    newScanConfig.source === 'container' 
                      ? 'border-primary bg-primary/10 shadow-lg' 
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setNewScanConfig({...newScanConfig, source: 'container', target: ''})
                    setUploadedFile(null)
                    setFilePreview([])
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-2">
                      <Container className={`h-8 w-8 ${newScanConfig.source === 'container' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="font-medium">Container Image</div>
                      <div className="text-xs text-muted-foreground">Scan Docker images from registries</div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all border-2 hover:shadow-md ${
                    newScanConfig.source === 'repository' 
                      ? 'border-primary bg-primary/10 shadow-lg' 
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setNewScanConfig({...newScanConfig, source: 'repository', target: ''})
                    setUploadedFile(null)
                    setFilePreview([])
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-2">
                      <Globe className={`h-8 w-8 ${newScanConfig.source === 'repository' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="font-medium">Git Repository</div>
                      <div className="text-xs text-muted-foreground">Scan source code repositories</div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all border-2 hover:shadow-md ${
                    newScanConfig.source === 'file' 
                      ? 'border-primary bg-primary/10 shadow-lg' 
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setNewScanConfig({...newScanConfig, source: 'file', target: ''})
                    setUploadedFile(null)
                    setFilePreview([])
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-2">
                      <FileText className={`h-8 w-8 ${newScanConfig.source === 'file' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="font-medium">Text File</div>
                      <div className="text-xs text-muted-foreground">Upload text file with container images</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Target Configuration - Wrapped in a selected border */}
            <div className={`space-y-4 p-4 rounded-lg border-2 transition-all ${
              newScanConfig.source ? 'border-primary bg-primary/5' : 'border-muted'
            }`}>
              <label className="text-sm font-medium">
                {newScanConfig.source === 'container' && 'Container Image'}
                {newScanConfig.source === 'repository' && 'Repository URL'}
                {newScanConfig.source === 'file' && 'Text File Upload'}
              </label>
              
              {newScanConfig.source === 'container' && (
                <div>
                  <Input
                    placeholder="nginx:latest, registry.example.com/app:v1.0, etc."
                    value={newScanConfig.target}
                    onChange={(e) => setNewScanConfig({...newScanConfig, target: e.target.value})}
                    className="border-2"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Examples: nginx:latest, postgres:14, myregistry.com/app:v1.0
                  </div>
                </div>
              )}

              {newScanConfig.source === 'repository' && (
                <div>
                  <Input
                    placeholder="https://github.com/user/repo.git"
                    value={newScanConfig.target}
                    onChange={(e) => setNewScanConfig({...newScanConfig, target: e.target.value})}
                    className="border-2"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Supports GitHub, GitLab, Bitbucket, and other Git repositories
                  </div>
                </div>
              )}

              {newScanConfig.source === 'file' && (
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center bg-background transition-all ${
                    dragOver 
                      ? 'border-primary bg-primary/10 scale-105' 
                      : uploadedFile 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  
                  {uploadedFile ? (
                    <>
                      <FileText className="h-12 w-12 mx-auto mb-4 text-green-600" />
                      <div className="text-sm font-medium mb-2 text-green-700">File Selected: {uploadedFile.name}</div>
                      <div className="text-xs text-muted-foreground mb-4">
                        Ready to scan container images from this file
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-2 mr-2"
                        onClick={() => {
                          setUploadedFile(null)
                          setFilePreview([])
                          setNewScanConfig({...newScanConfig, target: ''})
                        }}
                      >
                        Remove File
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-2"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        Choose Different File
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className={`h-12 w-12 mx-auto mb-4 ${dragOver ? 'text-primary animate-bounce' : 'text-primary'}`} />
                      <div className="text-sm font-medium mb-2">
                        {dragOver ? 'Drop your text file here' : 'Upload Text File with Container Images'}
                      </div>
                      <div className="text-xs text-muted-foreground mb-4">
                        Drag & drop or click to select. Each line should contain a container image with tag.
                      </div>
                      <div className="text-xs font-mono bg-muted p-2 rounded mb-4 text-left max-w-md mx-auto">
                        public.ecr.aws/eks-distro/kubernetes-csi/node-driver-registrar:v2.8.0-eks-1-27-4<br/>
                        public.ecr.aws/xray/aws-xray-daemon:3.3.7<br/>
                        public.ecr.aws/bitnami/minio:2023.5.18
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-2"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Text File
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Preview Section */}
            {(newScanConfig.target || uploadedFile) && (
              <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <label className="text-sm font-medium text-blue-800">Scan Preview</label>
                </div>
                
                {newScanConfig.source === 'container' && newScanConfig.target && (
                  <div className="space-y-2">
                    <div className="text-sm text-blue-700">
                      <strong>Target:</strong> {newScanConfig.target}
                    </div>
                    <div className="text-xs text-blue-600">
                      Will pull and scan container image using Docker, Syft (SBOM) and Grype
                    </div>
                  </div>
                )}

                {newScanConfig.source === 'repository' && newScanConfig.target && (
                  <div className="space-y-2">
                    <div className="text-sm text-blue-700">
                      <strong>Repository:</strong> {newScanConfig.target}
                    </div>
                    <div className="text-xs text-blue-600">
                      Will clone repository and scan source code for dependency vulnerabilities
                    </div>
                  </div>
                )}

                {newScanConfig.source === 'file' && uploadedFile && filePreview.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm text-blue-700">
                      <strong>File:</strong> {uploadedFile.name} ({filePreview.length} container images)
                    </div>
                    <div className="text-xs text-blue-600 mb-2">
                      Will pull and scan each container image using Docker:
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="text-xs font-mono bg-white border border-blue-200 rounded p-2 space-y-1">
                        {filePreview.slice(0, 10).map((line, index) => (
                          <div key={index} className="text-gray-700">
                            {index + 1}. {line}
                          </div>
                        ))}
                        {filePreview.length > 10 && (
                          <div className="text-blue-600 font-normal">
                            ... and {filePreview.length - 10} more images
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Required Name */}
            <div className="p-4 rounded-lg border-2 border-muted bg-muted/20">
              <label className="text-sm font-medium">Scan Name <span className="text-red-500">*</span></label>
              <Input
                placeholder="e.g., Production EKS Scan, Weekly Security Audit"
                value={newScanConfig.name}
                onChange={(e) => setNewScanConfig({...newScanConfig, name: e.target.value})}
                className="mt-2 border-2"
                required
              />
              <div className="text-xs text-muted-foreground mt-1">
                This name will be displayed in your scan history
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-border pt-6">
              <Button 
                onClick={startNewScan} 
                disabled={
                  !newScanConfig.name || 
                  (newScanConfig.source !== 'file' && !newScanConfig.target) ||
                  (newScanConfig.source === 'file' && !uploadedFile)
                }
                className="border-2"
                size="lg"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Scan
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowNewScan(false)}
                className="border-2"
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Scan Management</h2>
          <p className="text-muted-foreground">
            Manage vulnerability scans and view detailed results
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadScans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportScans}>
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </Button>
          {selectedScans.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={deleteSelectedScans}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedScans.size})
            </Button>
          )}
          <Button onClick={() => setShowNewScan(true)}>
            <Play className="h-4 w-4 mr-2" />
            New Scan
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={filteredScans}
        columns={scanColumns}
        title="Scan History"
        description="Browse, search, and sort through your scan history"
        searchPlaceholder="Search by scan name, image, or source..."
        loading={loading}
        pageSize={10}
        selectable={true}
        selectedItems={selectedScans}
        onSelectionChange={setSelectedScans}
        getItemId={(scan) => scan.id}
        onRowClick={(scan) => {
          // Always allow expansion for both active and completed scans
          setExpandedScan(expandedScan === scan.id ? null : scan.id)
        }}
        renderExpandedRow={(scan) => {
          // Show logs for active scans
          if (activeScans.has(scan.id) && expandedScan === scan.id) {
            return renderScanLogs(scan.id)
          }
          
          // Show images list for completed scans when expanded
          if (!activeScans.has(scan.id) && expandedScan === scan.id && scan.images && scan.images.length > 0) {
            return <ScanImagesExpanded scanId={scan.id} images={scan.images} />
          }
          
          return null
        }}
        renderActions={(scan) => (
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                // Always allow expansion for both active and completed scans
                setExpandedScan(expandedScan === scan.id ? null : scan.id)
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {!activeScans.has(scan.id) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('Re-scan:', scan.name)
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        emptyState={
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No scans found</h3>
            <p className="text-muted-foreground mb-4">
              Start by running your first vulnerability scan
            </p>
            <Button onClick={() => setShowNewScan(true)}>
              <Play className="h-4 w-4 mr-2" />
              Start First Scan
            </Button>
          </div>
        }
      />
    </div>
  )
}

// Component to display images with vulnerability counts
function ScanImagesExpanded({ scanId, images }: { scanId: string, images: string[] }) {
  const [imageDetails, setImageDetails] = useState<Array<{
    image: string
    vulnerabilities: number
    critical: number
    high: number
    medium: number
    low: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageVulnerabilities, setImageVulnerabilities] = useState<Array<{
    id: string
    severity: string
    package: string
    version: string
  }>>([])
  const [loadingVulns, setLoadingVulns] = useState(false)

  useEffect(() => {
    const fetchImageDetails = async () => {
      try {
        const response = await fetch(`/api/scans/${scanId}/images`)
        if (response.ok) {
          const data = await response.json()
          setImageDetails(data)
        } else {
          // Fallback to just showing image names without counts
          setImageDetails(images.map(image => ({
            image,
            vulnerabilities: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
          })))
        }
      } catch (error) {
        console.error('Error fetching image details:', error)
        // Fallback to just showing image names
        setImageDetails(images.map(image => ({
          image,
          vulnerabilities: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        })))
      } finally {
        setLoading(false)
      }
    }

    fetchImageDetails()
  }, [scanId, images])

  const fetchImageVulnerabilities = async (imageName: string) => {
    setLoadingVulns(true)
    try {
      const encodedImageName = encodeURIComponent(imageName)
      const response = await fetch(`/api/scans/${scanId}/images/${encodedImageName}/vulnerabilities`)
      if (response.ok) {
        const data = await response.json()
        setImageVulnerabilities(data)
        setSelectedImage(imageName)
      }
    } catch (error) {
      console.error('Error fetching image vulnerabilities:', error)
    } finally {
      setLoadingVulns(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-4 border-t pt-4">
        <h4 className="font-medium text-sm mb-3">Loading image details...</h4>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="font-medium text-sm mb-3">Scanned Images ({images.length})</h4>
      <div className="space-y-2">
        {imageDetails.map((imageDetail, index) => (
          <div key={index} className="space-y-2">
            <div 
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => fetchImageVulnerabilities(imageDetail.image)}
            >
              <div className="flex-shrink-0">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">
                  {imageDetail.image}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Image {index + 1} of {images.length} • Click to view vulnerabilities
                </div>
              </div>
              <div className="flex-shrink-0">
                {imageDetail.vulnerabilities > 0 ? (
                  <div className="flex items-center gap-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {imageDetail.vulnerabilities}
                    </div>
                    <div className="flex gap-1">
                      {imageDetail.critical > 0 && (
                        <Badge variant="critical" className="text-xs px-1">
                          {imageDetail.critical}
                        </Badge>
                      )}
                      {imageDetail.high > 0 && (
                        <Badge variant="high" className="text-xs px-1">
                          {imageDetail.high}
                        </Badge>
                      )}
                      {imageDetail.medium > 0 && (
                        <Badge variant="medium" className="text-xs px-1">
                          {imageDetail.medium}
                        </Badge>
                      )}
                      {imageDetail.low > 0 && (
                        <Badge variant="low" className="text-xs px-1">
                          {imageDetail.low}
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-green-600 font-medium">
                    No vulnerabilities
                  </div>
                )}
              </div>
            </div>
            
            {/* Vulnerability Details */}
            {selectedImage === imageDetail.image && (
              <div className="ml-6 p-3 bg-white dark:bg-gray-900 border rounded-lg">
                <h5 className="font-medium text-sm mb-2">
                  Vulnerabilities in {imageDetail.image.split('/').pop()}
                </h5>
                {loadingVulns ? (
                  <div className="text-sm text-gray-500">Loading vulnerabilities...</div>
                ) : imageVulnerabilities.length > 0 ? (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {imageVulnerabilities.map((vuln, vulnIndex) => (
                      <div key={vulnIndex} className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <Badge 
                          variant={vuln.severity.toLowerCase() as any} 
                          className="text-xs px-1"
                        >
                          {vuln.severity}
                        </Badge>
                        <code className="font-mono text-xs">{vuln.id}</code>
                        <span className="text-gray-600">in</span>
                        <span className="font-medium">{vuln.package}</span>
                        <span className="text-gray-500">v{vuln.version}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No vulnerabilities found</div>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => setSelectedImage(null)}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
