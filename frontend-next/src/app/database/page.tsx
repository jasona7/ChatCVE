'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Database,
  Play,
  Download,
  Upload,
  RefreshCw,
  Search,
  Table,
  BarChart3,
  FileText,
  Copy,
  Save,
  AlertTriangle,
  CheckCircle,
  Terminal
} from 'lucide-react'

export default function DatabasePage() {
  const [query, setQuery] = useState('SELECT * FROM app_patrol LIMIT 10;')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sampleQueries = [
    {
      name: 'Critical Vulnerabilities',
      description: 'Show all critical severity vulnerabilities',
      query: "SELECT IMAGE_TAG, VULNERABILITY, SEVERITY FROM app_patrol WHERE SEVERITY = 'Critical' LIMIT 20;"
    },
    {
      name: 'Vulnerability Summary',
      description: 'Count vulnerabilities by severity',
      query: "SELECT SEVERITY, COUNT(*) as count FROM app_patrol WHERE VULNERABILITY IS NOT NULL GROUP BY SEVERITY ORDER BY count DESC;"
    },
    {
      name: 'Recent Scans',
      description: 'Show most recently scanned images',
      query: "SELECT IMAGE_TAG, COUNT(*) as vulnerabilities, MAX(DATE_ADDED) as last_scan FROM app_patrol GROUP BY IMAGE_TAG ORDER BY last_scan DESC LIMIT 10;"
    },
    {
      name: 'Package Vulnerabilities',
      description: 'Show vulnerable packages and their fixes',
      query: "SELECT NAME, VULNERABILITY, INSTALLED, FIXED_IN FROM app_patrol WHERE FIXED_IN IS NOT NULL LIMIT 15;"
    }
  ]

  const executeQuery = async () => {
    setLoading(true)
    setError('')
    
    try {
      // In a real implementation, this would call the API
      // For now, simulate with sample data
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (query.toLowerCase().includes('count')) {
        setResults([
          { SEVERITY: 'Critical', count: 671 },
          { SEVERITY: 'High', count: 3339 },
          { SEVERITY: 'Medium', count: 3353 },
          { SEVERITY: 'Low', count: 922 },
          { SEVERITY: 'Negligible', count: 2814 },
          { SEVERITY: 'Unknown', count: 380 }
        ])
      } else {
        setResults([
          { 
            IMAGE_TAG: 'nginx:latest', 
            VULNERABILITY: 'CVE-2023-44487', 
            SEVERITY: 'Critical',
            NAME: 'nginx',
            INSTALLED: '1.21.0',
            FIXED_IN: '1.21.6'
          },
          { 
            IMAGE_TAG: 'postgres:14', 
            VULNERABILITY: 'CVE-2023-39417', 
            SEVERITY: 'High',
            NAME: 'postgresql',
            INSTALLED: '14.2',
            FIXED_IN: '14.9'
          }
        ])
      }
    } catch (err) {
      setError('Query execution failed')
    } finally {
      setLoading(false)
    }
  }

  const exportResults = () => {
    const csv = results.map(row => Object.values(row).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'query_results.csv'
    a.click()
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Database Access</h1>
            <p className="text-muted-foreground">
              Direct SQL access to your vulnerability database
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Database Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">2</div>
                  <div className="text-xs text-muted-foreground">Tables</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">11,479</div>
                  <div className="text-xs text-muted-foreground">Total Records</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">2.2 MB</div>
                  <div className="text-xs text-muted-foreground">Database Size</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">Active</div>
                  <div className="text-xs text-muted-foreground">Connection</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Query Interface */}
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  SQL Query Interface
                </CardTitle>
                <CardDescription>Execute SQL queries against your vulnerability database</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full h-32 p-3 font-mono text-sm border rounded-md resize-none"
                    placeholder="Enter your SQL query..."
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={executeQuery} disabled={loading} className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    {loading ? 'Executing...' : 'Execute Query'}
                  </Button>
                  <Button variant="outline" onClick={() => setQuery('')}>
                    Clear
                  </Button>
                  {results.length > 0 && (
                    <Button variant="outline" onClick={exportResults} className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Query Results */}
            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Query Results</CardTitle>
                  <CardDescription>{results.length} rows returned</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            {Object.keys(results[0]).map((key) => (
                              <th key={key} className="text-left p-2 font-medium">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((row, i) => (
                            <tr key={i} className="border-b hover:bg-muted/50">
                              {Object.values(row).map((value: any, j) => (
                                <td key={j} className="p-2">
                                  {typeof value === 'string' && value.startsWith('CVE-') ? (
                                    <Badge variant="outline">{value}</Badge>
                                  ) : typeof value === 'string' && ['Critical', 'High', 'Medium', 'Low'].includes(value) ? (
                                    <Badge variant={
                                      value === 'Critical' ? 'critical' :
                                      value === 'High' ? 'high' :
                                      value === 'Medium' ? 'medium' :
                                      value === 'Low' ? 'low' : 'outline'
                                    }>
                                      {value}
                                    </Badge>
                                  ) : (
                                    String(value)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sample Queries & Schema */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Sample Queries
                </CardTitle>
                <CardDescription>Common queries to get you started</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {sampleQueries.map((sample, i) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="font-medium text-sm">{sample.name}</div>
                        <div className="text-xs text-muted-foreground mb-2">{sample.description}</div>
                        <div className="relative">
                          <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                            {sample.query}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={() => setQuery(sample.query)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database Schema</CardTitle>
                <CardDescription>Available tables and columns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="font-medium text-sm mb-2">app_patrol</div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <div>• NAME (Package name)</div>
                      <div>• INSTALLED (Version)</div>
                      <div>• FIXED_IN (Fix version)</div>
                      <div>• TYPE (Package type)</div>
                      <div>• VULNERABILITY (CVE ID)</div>
                      <div>• SEVERITY (Risk level)</div>
                      <div>• IMAGE_TAG (Container)</div>
                      <div>• DATE_ADDED (Scan date)</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-sm mb-2">nvd_cves</div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <div>• cve_id (Primary key)</div>
                      <div>• description (CVE details)</div>
                      <div>• cvss_v30_base_score</div>
                      <div>• cvss_v30_base_severity</div>
                      <div>• published (Date)</div>
                      <div>• last_modified</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}


