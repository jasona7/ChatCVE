'use client'

import React from 'react'
import { Progress } from '@/components/ui/progress'
import { PulseIndicator } from '@/components/ui/page-transition'
import { VulnerabilityStats } from '@/types'
import {
  AlertTriangle,
  Shield,
  TrendingUp,
  Info
} from 'lucide-react'

interface StatWidgetProps {
  stats: VulnerabilityStats
  loading?: boolean
}

// Loading skeleton for stat widgets
function StatSkeleton() {
  return (
    <div className="animate-pulse h-full flex flex-col justify-center">
      <div className="h-10 w-24 bg-muted rounded mb-3"></div>
      <div className="h-3 w-32 bg-muted rounded mb-2"></div>
      <div className="h-2 w-full bg-muted rounded"></div>
    </div>
  )
}

// ============================================================================
// Total Vulnerabilities Widget
// ============================================================================
export function TotalVulnerabilitiesWidget({ stats, loading }: StatWidgetProps) {
  if (loading) return <StatSkeleton />

  return (
    <div className="h-full flex flex-col justify-center">
      <div className="text-3xl font-bold">{stats.total.toLocaleString()}</div>
      <p className="text-xs text-muted-foreground mt-1">
        Across all scanned images
      </p>
      <div className="flex gap-2 mt-3 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {stats.critical} Critical
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
          {stats.high} High
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Critical Issues Widget
// ============================================================================
export function CriticalIssuesWidget({ stats, loading }: StatWidgetProps) {
  if (loading) return <StatSkeleton />

  const criticalPercentage = stats.total > 0 ? (stats.critical / stats.total) * 100 : 0

  return (
    <div className="h-full flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
        {stats.critical > 0 && (
          <PulseIndicator>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </PulseIndicator>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Progress value={criticalPercentage} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground min-w-[40px] text-right">
          {criticalPercentage.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Require immediate attention
      </p>
    </div>
  )
}

// ============================================================================
// High Priority Widget
// ============================================================================
export function HighPriorityWidget({ stats, loading }: StatWidgetProps) {
  if (loading) return <StatSkeleton />

  const highPercentage = stats.total > 0 ? (stats.high / stats.total) * 100 : 0

  return (
    <div className="h-full flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <div className="text-3xl font-bold text-orange-600">{stats.high}</div>
        {stats.high > 0 && (
          <PulseIndicator>
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </PulseIndicator>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Progress value={highPercentage} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground min-w-[40px] text-right">
          {highPercentage.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Should be addressed soon
      </p>
    </div>
  )
}

// ============================================================================
// Security Score Widget
// ============================================================================
export function SecurityScoreWidget({ stats, loading }: StatWidgetProps) {
  if (loading) return <StatSkeleton />

  // Calculate Security Score (0-100): penalize critical/high vulnerabilities more heavily
  const calculateSecurityScore = () => {
    if (stats.total === 0) return 100 // Perfect score with no vulnerabilities

    // Calculate percentage of high-severity vulnerabilities
    const criticalPerc = (stats.critical / stats.total) * 100
    const highPerc = (stats.high / stats.total) * 100
    const mediumPerc = (stats.medium / stats.total) * 100

    // Penalty system: Critical (-30), High (-15), Medium (-5), Low (-1)
    const penalty = (criticalPerc * 0.3) + (highPerc * 0.15) + (mediumPerc * 0.05) + ((stats.low / stats.total) * 100 * 0.01)

    // Base score 100, subtract penalty, minimum 0
    const score = Math.max(0, 100 - penalty)

    return Math.round(score)
  }

  const securityScore = calculateSecurityScore()

  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-green-600', icon: 'text-green-500' }
    if (score >= 60) return { text: 'text-yellow-600', icon: 'text-yellow-500' }
    if (score >= 40) return { text: 'text-orange-600', icon: 'text-orange-500' }
    return { text: 'text-red-600', icon: 'text-red-500' }
  }

  const colors = getScoreColor(securityScore)

  return (
    <div className="h-full flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <div className={`text-3xl font-bold ${colors.text}`}>
          {securityScore}
        </div>
        <Shield className={`h-5 w-5 ${colors.icon}`} />
        <div className="group relative">
          <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Penalty by %: Critical (-30), High (-15), Medium (-5), Low (-1)
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Progress value={securityScore} className="h-2" />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {securityScore >= 80 ? 'Excellent' : securityScore >= 60 ? 'Good' : securityScore >= 40 ? 'Fair' : 'Poor'} security posture
      </p>
    </div>
  )
}

// ============================================================================
// Medium/Low Summary Widget (Bonus - for users who want more detail)
// ============================================================================
export function MediumLowSummaryWidget({ stats, loading }: StatWidgetProps) {
  if (loading) return <StatSkeleton />

  const mediumPercentage = stats.total > 0 ? (stats.medium / stats.total) * 100 : 0
  const lowPercentage = stats.total > 0 ? (stats.low / stats.total) * 100 : 0

  return (
    <div className="h-full flex flex-col justify-center space-y-3">
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-yellow-600 font-medium">{stats.medium} Medium</span>
          <span className="text-xs text-muted-foreground">{mediumPercentage.toFixed(1)}%</span>
        </div>
        <Progress value={mediumPercentage} className="h-2" />
      </div>
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-green-600 font-medium">{stats.low} Low</span>
          <span className="text-xs text-muted-foreground">{lowPercentage.toFixed(1)}%</span>
        </div>
        <Progress value={lowPercentage} className="h-2" />
      </div>
    </div>
  )
}
