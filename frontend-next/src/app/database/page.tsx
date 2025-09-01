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
  Table, 
  FileText,
  Copy,
  AlertTriangle
} from 'lucide-react'

export default function DatabasePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [tables, setTables] = useState<string[]>(['app_patrol', 'nvd_cves'])

  const sampleQueries = [
    {
      name: 'Top 10 Critical Vulnerabilities',
      query: "SELECT NAME, VULNERABILITY, SEVERITY, IMAGE_TAG FROM app_patrol WHERE SEVERITY = 'Critical' ORDER BY DATE_ADDED DESC LIMIT 10"
    },
    {
      name: 'Vulnerability Count by Severity',
      query: "SELECT SEVERITY, COUNT(*) as count FROM app_patrol GROUP BY SEVERITY ORDER BY count DESC"
    },
    {
      name: 'Most Vulnerable Images',
      query: "SELECT IMAGE_TAG, COUNT(*) as vuln_count FROM app_patrol GROUP BY IMAGE_TAG ORDER BY vuln_count DESC LIMIT 10"
    },
    {
      name: 'Recent CVEs (Last 7 Days)',
      query: "SELECT * FROM nvd_cves WHERE date(published) >= date('now', '-7 days') ORDER BY published DESC"
    },
    {
      name: 'Packages with Available Fixes',
      query: "SELECT NAME, INSTALLED, FIXED_IN, VULNERABILITY, SEVERITY FROM app_patrol WHERE FIXED_IN IS NOT NULL AND FIXED_IN != ''"
    }
  ]

  const executeQuery = async () => {
    if (!query.trim()) return

    setIsLoading(true)
    setError('')
    
    try {
      // In real app, this would call the API
      // For now, showing mock results
      setTimeout(() => {
        setResults([
          { NAME: 'curl', VULNERABILITY: 'CVE-2021-22876', SEVERITY: 'Critical', IMAGE_TAG: 'nginx:latest' },
          { NAME: 'openssl', VULNERABILITY: 'CVE-2022-0778', SEVERITY: 'High', IMAGE_TAG: 'redis:7.0' }
        ])
        setIsLoading(false)
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed')
      setIsLoading(false)
    }
  }

  const copyQuery = (queryText: string) => {
    setQuery(queryText)
    navigator.clipboard.writeText(queryText)
  }

  const exportResults = () => {
    const csv = results.map(row => Object.values(row).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cve_query_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <MainLayout>
      <div className="px-6 space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Database Access</h1>
          <p className="text-muted-foreground">
            Direct SQL access to vulnerability databases
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Query Interface */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  SQL Query Interface
                </CardTitle>
                <CardDescription>
                  Execute custom SQL queries against the CVE database
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">SQL Query</label>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SELECT * FROM app_patrol WHERE SEVERITY = 'Critical' LIMIT 10"
                    className="w-full min-h-32 p-3 text-sm border rounded-md font-mono"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button onClick={executeQuery} disabled={isLoading || !query.trim()}>
                    <Play className="h-4 w-4 mr-2" />
                    {isLoading ? 'Executing...' : 'Execute Query'}
                  </Button>
                  {results.length > 0 && (
                    <Button variant="outline" onClick={exportResults}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-destructive">{error}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Query Results */}
            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Query Results</CardTitle>
                  <CardDescription>
                    {results.length} rows returned
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            {Object.keys(results[0] || {}).map(key => (
                              <th key={key} className="text-left p-2 font-medium">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((row, index) => (
                            <tr key={index} className="border-b hover:bg-muted/50">
                              {Object.values(row).map((value, i) => (
                                <td key={i} className="p-2">
                                  {typeof value === 'string' && value.startsWith('CVE-') ? (
                                    <Badge variant="outline">{value}</Badge>
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Database Schema */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Table className="h-4 w-4 mr-2" />
                  Database Tables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tables.map(table => (
                    <div key={table} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm font-medium">{table}</span>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sample Queries */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Queries</CardTitle>
                <CardDescription>
                  Common vulnerability analysis queries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {sampleQueries.map((sample, index) => (
                      <Card key={index} className="cursor-pointer hover:bg-muted/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium mb-1">{sample.name}</h4>
                              <code className="text-xs text-muted-foreground block truncate">
                                {sample.query.substring(0, 60)}...
                              </code>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyQuery(sample.query)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}