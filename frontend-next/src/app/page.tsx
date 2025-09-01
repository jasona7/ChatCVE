'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { VulnerabilityStats } from '@/components/dashboard/vulnerability-stats'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Calendar,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { DashboardStats } from '@/types'

// Mock data - in real app this would come from API
const mockStats: DashboardStats = {
  total_vulnerabilities: 1247,
  critical_count: 42,
  high_count: 156,
  medium_count: 389,
  low_count: 492,
  negligible_count: 168,
  scanned_images: 12,
  latest_scan_date: new Date().toISOString(),
  top_vulnerable_packages: [
    { name: 'curl', count: 42 },
    { name: 'libcurl4', count: 42 },
    { name: 'libpcre2-8-0', count: 16 },
    { name: 'libksba8', count: 15 },
    { name: 'jetty-setuid-java', count: 14 }
  ]
}

const recentActivity = [
  {
    id: '1',
    type: 'scan',
    message: 'Completed scan of nginx:latest',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    severity: 'info'
  },
  {
    id: '2',
    type: 'alert',
    message: 'New critical CVE detected: CVE-2024-0001',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    severity: 'critical'
  },
  {
    id: '3',
    type: 'scan',
    message: 'Started scan of redis:7.0',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    severity: 'info'
  },
  {
    id: '4',
    type: 'query',
    message: 'Executed query: "Show critical vulnerabilities"',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    severity: 'info'
  }
]

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(mockStats)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'scan':
        return <Activity className="h-4 w-4" />
      case 'alert':
        return <AlertTriangle className="h-4 w-4" />
      case 'query':
        return <Activity className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getActivityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="critical">Critical</Badge>
      case 'high':
        return <Badge variant="high">High</Badge>
      case 'info':
        return <Badge variant="secondary">Info</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <MainLayout onRefresh={handleRefresh} notifications={3}>
      <div className="space-y-6 px-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your vulnerability management system
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-20 flex-col">
                <Activity className="h-6 w-6 mb-2" />
                <span className="text-sm">Start New Scan</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <AlertTriangle className="h-6 w-6 mb-2" />
                <span className="text-sm">View Critical CVEs</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <TrendingUp className="h-6 w-6 mb-2" />
                <span className="text-sm">Generate Report</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <ExternalLink className="h-6 w-6 mb-2" />
                <span className="text-sm">Export Data</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Vulnerability Stats */}
          <div className="lg:col-span-2">
            <VulnerabilityStats stats={stats} />
          </div>

          {/* Recent Activity */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest scans, alerts, and queries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">{activity.message}</p>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {new Date(activity.timestamp).toLocaleTimeString()}
                            </Badge>
                            {getActivityBadge(activity.severity)}
                          </div>
                        </div>
                      </div>
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