'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { VulnerabilityStatsComponent } from '@/components/dashboard/vulnerability-stats'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MotionCard } from '@/components/ui/motion-card'
import { MotionContainer } from '@/components/ui/motion-container'
import { MotionButton } from '@/components/ui/motion-button'
import { VulnerabilityStats } from '@/types'
import { api, ActivityItem } from '@/lib/api'
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'

export default function Dashboard() {
  const [stats, setStats] = useState<VulnerabilityStats>({ total: 0, critical: 0, high: 0, medium: 0, low: 0 })
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadDashboardData()
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      const [vulnerabilityStats, activityData] = await Promise.all([
        api.getVulnerabilityStats(),
        api.getRecentActivity()
      ])
      setStats(vulnerabilityStats)
      setRecentActivity(activityData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  // Activity data is now loaded from API

  const quickActions = [
    { title: 'Start New Scan', description: 'Scan container images for vulnerabilities', icon: Activity, href: '/scans' },
    { title: 'Ask ChatCVE', description: 'Query your security data with AI', icon: TrendingUp, href: '/chat' },
    { title: 'Browse CVEs', description: 'Explore vulnerability database', icon: AlertTriangle, href: '/cves' },
    { title: 'View Reports', description: 'Generate security reports', icon: Calendar, href: '/reports' }
  ]

  return (
    <MainLayout onRefresh={handleRefresh}>
      <MotionContainer className="space-y-6" stagger={0.1}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your security posture and recent activity
            </p>
          </div>
          <MotionButton 
            onClick={handleRefresh} 
            disabled={refreshing}
            loading={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </MotionButton>
        </div>

        {/* Vulnerability Stats */}
        <VulnerabilityStatsComponent stats={stats} loading={loading} />

        {/* Dashboard Charts */}
        <DashboardCharts />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Activity */}
          <MotionCard delay={0.2}>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest scans, alerts, and system events</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No recent activity</p>
                      <p className="text-xs">Run some scans to see activity here</p>
                    </div>
                  ) : (
                    recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                      <div className="mt-1">
                        {activity.type === 'scan' && <Activity className="h-4 w-4 text-blue-500" />}
                        {activity.type === 'cve' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {activity.type === 'chat' && <TrendingUp className="h-4 w-4 text-green-500" />}
                        {activity.type === 'scan' && activity.severity === 'error' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none mb-1">
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                      <Badge 
                        variant={
                          activity.severity === 'critical' ? 'destructive' :
                          activity.severity === 'high' ? 'destructive' :
                          activity.severity === 'medium' ? 'secondary' :
                          activity.severity === 'error' ? 'destructive' : 'outline'
                        }
                        className="text-xs"
                      >
                        {activity.severity}
                      </Badge>
                    </div>
                  ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </MotionCard>

          {/* Quick Actions */}
          <MotionCard delay={0.3}>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Button
                      key={action.title}
                      variant="outline"
                      className="h-auto p-4 justify-start"
                      asChild
                    >
                      <a href={action.href}>
                        <Icon className="h-5 w-5 mr-3" />
                        <div className="text-left">
                          <div className="font-medium">{action.title}</div>
                          <div className="text-xs text-muted-foreground">{action.description}</div>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-auto" />
                      </a>
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </MotionCard>
        </div>

        {/* System Status */}
        <MotionCard delay={0.4}>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current status of ChatCVE services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium">AI Assistant</p>
                  <p className="text-xs text-muted-foreground">Operational</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                <div>
                  <p className="font-medium">NVD Sync</p>
                  <p className="text-xs text-muted-foreground">Last updated: {format(new Date(), 'MMM d, HH:mm')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </MotionCard>
      </MotionContainer>
    </MainLayout>
  )
}
