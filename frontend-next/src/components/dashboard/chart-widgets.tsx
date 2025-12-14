'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  DonutChart,
  BarChart,
  AreaChart,
  Legend,
  Text,
} from '@tremor/react'
import { api } from '@/lib/api'

// Shared interfaces
interface SeverityData {
  name: string
  value: number
}

interface ImageData {
  image: string
  vulnerabilities: number
}

interface ScanHistoryData {
  name: string
  date: string
  Critical: number
  High: number
  Medium: number
  Low: number
  Total: number
}

interface PackageData {
  package: string
  vulnerabilities: number
  critical: number
}

interface ChartData {
  severityDistribution: SeverityData[]
  topVulnerableImages: ImageData[]
  scanHistory: ScanHistoryData[]
  topVulnerablePackages: PackageData[]
}

// Shared utilities
const severityColors: Record<string, string> = {
  CRITICAL: 'rose',
  HIGH: 'orange',
  MEDIUM: 'yellow',
  LOW: 'emerald',
  Unknown: 'gray'
}

const truncateLabel = (label: string, maxLength: number = 25): string => {
  if (label.length <= maxLength) return label
  return label.substring(0, maxLength - 3) + '...'
}

// Custom hook for chart data
export function useChartData() {
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getChartData()
        setChartData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load charts')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return { chartData, loading, error, refetch: () => setLoading(true) }
}

// Loading skeleton
function ChartSkeleton() {
  return (
    <div className="animate-pulse h-full flex flex-col">
      <div className="h-4 w-24 bg-muted rounded mb-4"></div>
      <div className="flex-1 bg-muted rounded"></div>
    </div>
  )
}

// Empty state
function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <Text>{message}</Text>
    </div>
  )
}

// ============================================================================
// Severity Distribution Chart
// ============================================================================
interface SeverityDistributionChartProps {
  data?: SeverityData[]
  loading?: boolean
}

export function SeverityDistributionChart({ data, loading }: SeverityDistributionChartProps) {
  const { chartData, loading: hookLoading } = useChartData()
  const isLoading = loading ?? hookLoading
  const chartDataToUse = data ?? chartData?.severityDistribution

  const { sortedData, colors } = useMemo(() => {
    if (!chartDataToUse) return { sortedData: [], colors: [] }
    const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'Unknown']
    const sorted = [...chartDataToUse].sort(
      (a, b) => severityOrder.indexOf(a.name) - severityOrder.indexOf(b.name)
    )
    const cols = sorted.map(d => severityColors[d.name] || 'gray')
    return { sortedData: sorted, colors: cols }
  }, [chartDataToUse])

  if (isLoading) return <ChartSkeleton />
  if (!chartDataToUse || chartDataToUse.length === 0) {
    return <EmptyState message="No severity data available" />
  }

  return (
    <div className="h-full flex flex-col">
      <DonutChart
        className="flex-1 min-h-0"
        data={sortedData}
        category="value"
        index="name"
        colors={colors as any}
        showAnimation={true}
        valueFormatter={(value) => value.toLocaleString()}
      />
      <Legend
        className="mt-3 justify-center flex-shrink-0"
        categories={sortedData.map(d => d.name)}
        colors={colors as any}
      />
    </div>
  )
}

// ============================================================================
// Scan History Chart
// ============================================================================
interface ScanHistoryChartProps {
  data?: ScanHistoryData[]
  loading?: boolean
}

export function ScanHistoryChart({ data, loading }: ScanHistoryChartProps) {
  const { chartData, loading: hookLoading } = useChartData()
  const isLoading = loading ?? hookLoading
  const chartDataToUse = data ?? chartData?.scanHistory

  // Interactive legend state
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([])

  const categories = ['Critical', 'High', 'Medium', 'Low']
  const colors = ['rose', 'orange', 'yellow', 'emerald']

  const visibleCategories = categories.filter(c => !hiddenSeries.includes(c))
  const visibleColors = colors.filter((_, i) => !hiddenSeries.includes(categories[i]))

  const handleLegendClick = (category: string) => {
    setHiddenSeries(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const truncatedData = useMemo(() => {
    if (!chartDataToUse) return []
    return chartDataToUse.map(d => ({
      ...d,
      name: truncateLabel(d.name, 20)
    }))
  }, [chartDataToUse])

  if (isLoading) return <ChartSkeleton />
  if (!chartDataToUse || chartDataToUse.length === 0) {
    return <EmptyState message="No scan history available" />
  }

  return (
    <div className="h-full flex flex-col">
      <AreaChart
        className="flex-1 min-h-0"
        data={truncatedData}
        index="name"
        categories={visibleCategories}
        colors={visibleColors as any}
        showAnimation={true}
        valueFormatter={(value) => value.toLocaleString()}
        showLegend={false}
        showGridLines={true}
        curveType="monotone"
        yAxisWidth={40}
      />
      <div className="mt-3 flex justify-center gap-4 flex-wrap flex-shrink-0">
        {categories.map((category, i) => (
          <button
            key={category}
            onClick={() => handleLegendClick(category)}
            className={`flex items-center gap-1.5 text-sm transition-opacity ${
              hiddenSeries.includes(category) ? 'opacity-40' : ''
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full bg-${colors[i]}-500`}
              style={{
                backgroundColor: hiddenSeries.includes(category)
                  ? 'gray'
                  : undefined
              }}
            />
            <span className={hiddenSeries.includes(category) ? 'line-through' : ''}>
              {category}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Top Images Chart
// ============================================================================
interface TopImagesChartProps {
  data?: ImageData[]
  loading?: boolean
}

export function TopImagesChart({ data, loading }: TopImagesChartProps) {
  const { chartData, loading: hookLoading } = useChartData()
  const isLoading = loading ?? hookLoading
  const chartDataToUse = data ?? chartData?.topVulnerableImages

  // Transform data to have each image as its own category for unique colors
  const { transformedData, categories, colors } = useMemo(() => {
    if (!chartDataToUse || chartDataToUse.length === 0) {
      return { transformedData: [], categories: [], colors: [] }
    }

    // Color palette from high severity (warm) to low (cool)
    const colorPalette = ['rose', 'orange', 'amber', 'yellow', 'lime', 'emerald', 'teal', 'cyan', 'sky', 'blue']

    const cats: string[] = []
    const cols: string[] = []

    // Each row has its own category so each bar gets a unique color
    const rows = chartDataToUse.map((item, index) => {
      const label = truncateLabel(item.image, 25)
      const catName = `cat_${index}`
      cats.push(catName)
      cols.push(colorPalette[index % colorPalette.length])

      // Each row only has data for its own category
      const row: Record<string, number | string> = { image: label }
      row[catName] = item.vulnerabilities
      return row
    })

    return { transformedData: rows, categories: cats, colors: cols }
  }, [chartDataToUse])

  if (isLoading) return <ChartSkeleton />
  if (!chartDataToUse || chartDataToUse.length === 0) {
    return <EmptyState message="No image data available" />
  }

  return (
    <div className="h-full">
      <BarChart
        className="h-full"
        data={transformedData}
        index="image"
        categories={categories}
        colors={colors as any}
        showAnimation={true}
        valueFormatter={(value) => value.toLocaleString()}
        layout="vertical"
        showLegend={false}
        yAxisWidth={150}
      />
    </div>
  )
}

// ============================================================================
// Top Packages Chart
// ============================================================================
interface TopPackagesChartProps {
  data?: PackageData[]
  loading?: boolean
}

export function TopPackagesChart({ data, loading }: TopPackagesChartProps) {
  const { chartData, loading: hookLoading } = useChartData()
  const isLoading = loading ?? hookLoading
  const chartDataToUse = data ?? chartData?.topVulnerablePackages

  // Transform data to have each package as its own category for unique colors
  const { transformedData, categories, colors } = useMemo(() => {
    if (!chartDataToUse || chartDataToUse.length === 0) {
      return { transformedData: [], categories: [], colors: [] }
    }

    // Color palette - different from images chart for variety
    const colorPalette = ['violet', 'purple', 'fuchsia', 'pink', 'rose', 'red', 'orange', 'amber', 'yellow', 'lime']

    const cats: string[] = []
    const cols: string[] = []

    // Each row has its own category so each bar gets a unique color
    const rows = chartDataToUse.map((item, index) => {
      const label = truncateLabel(item.package, 25)
      const catName = `pkg_${index}`
      cats.push(catName)
      cols.push(colorPalette[index % colorPalette.length])

      // Each row only has data for its own category
      const row: Record<string, number | string> = { package: label }
      row[catName] = item.vulnerabilities
      return row
    })

    return { transformedData: rows, categories: cats, colors: cols }
  }, [chartDataToUse])

  if (isLoading) return <ChartSkeleton />
  if (!chartDataToUse || chartDataToUse.length === 0) {
    return <EmptyState message="No package data available" />
  }

  return (
    <div className="h-full">
      <BarChart
        className="h-full"
        data={transformedData}
        index="package"
        categories={categories}
        colors={colors as any}
        showAnimation={true}
        valueFormatter={(value) => value.toLocaleString()}
        layout="vertical"
        showLegend={false}
        yAxisWidth={120}
      />
    </div>
  )
}
