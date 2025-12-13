'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Title,
  DonutChart,
  BarChart,
  AreaChart,
  Legend,
  Flex,
  Text,
  Bold,
  Grid
} from '@tremor/react'
import { getAuthHeaders } from '@/contexts/AuthContext'

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

const severityColors: Record<string, string> = {
  CRITICAL: 'rose',
  HIGH: 'orange',
  MEDIUM: 'yellow',
  LOW: 'emerald',
  Unknown: 'gray'
}

// Consistent color mapping for scan history legend
const scanHistoryColors: Record<string, string> = {
  Critical: 'rose',
  High: 'orange',
  Medium: 'yellow',
  Low: 'emerald'
}

// Truncate long labels for better display
const truncateLabel = (label: string, maxLength: number = 25): string => {
  if (label.length <= maxLength) return label
  return label.substring(0, maxLength - 3) + '...'
}

export function DashboardCharts() {
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await fetch('/api/stats/charts', {
          headers: getAuthHeaders()
        })
        if (!response.ok) {
          throw new Error('Failed to fetch chart data')
        }
        const data = await response.json()
        setChartData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load charts')
      } finally {
        setLoading(false)
      }
    }

    fetchChartData()
  }, [])

  if (loading) {
    return (
      <Grid numItemsSm={2} numItemsLg={2} className="gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-4 w-32 bg-muted rounded mb-4"></div>
            <div className="h-48 bg-muted rounded"></div>
          </Card>
        ))}
      </Grid>
    )
  }

  if (error || !chartData) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <Text>{error || 'No chart data available'}</Text>
      </Card>
    )
  }

  // Sort severity data in consistent order and map colors
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'Unknown']
  const sortedSeverityData = [...chartData.severityDistribution].sort(
    (a, b) => severityOrder.indexOf(a.name) - severityOrder.indexOf(b.name)
  )
  const donutColors = sortedSeverityData.map(
    d => severityColors[d.name] || 'gray'
  )

  // Truncate image names for bar chart
  const truncatedImageData = chartData.topVulnerableImages.map(d => ({
    ...d,
    image: truncateLabel(d.image, 30)
  }))

  // Truncate package names for bar chart
  const truncatedPackageData = chartData.topVulnerablePackages.map(d => ({
    ...d,
    package: truncateLabel(d.package, 25)
  }))

  // Truncate scan names for area chart
  const truncatedScanHistory = chartData.scanHistory.map(d => ({
    ...d,
    name: truncateLabel(d.name, 20)
  }))

  // Check if we have data
  const hasData = chartData.severityDistribution.length > 0 ||
                  chartData.topVulnerableImages.length > 0 ||
                  chartData.scanHistory.length > 0

  if (!hasData) {
    return (
      <Card className="p-8 text-center">
        <Text className="text-muted-foreground">
          No vulnerability data yet. Run some scans to see charts here.
        </Text>
      </Card>
    )
  }

  return (
    <Grid numItemsSm={2} numItemsLg={2} className="gap-6">
      {/* Severity Distribution Donut */}
      <Card className="p-6">
        <Title>Severity Distribution</Title>
        <Text className="text-muted-foreground">Vulnerabilities by severity level</Text>
        <DonutChart
          className="mt-4 h-60"
          data={sortedSeverityData}
          category="value"
          index="name"
          colors={donutColors as any}
          showAnimation={true}
          valueFormatter={(value) => value.toLocaleString()}
        />
        <Legend
          className="mt-3 justify-center"
          categories={sortedSeverityData.map(d => d.name)}
          colors={donutColors as any}
        />
      </Card>

      {/* Scan History Area Chart */}
      <Card className="p-6">
        <Title>Scan History</Title>
        <Text className="text-muted-foreground">Vulnerability trends across recent scans</Text>
        {chartData.scanHistory.length > 0 ? (
          <>
            <AreaChart
              className="mt-4 h-64"
              data={truncatedScanHistory}
              index="name"
              categories={['Critical', 'High', 'Medium', 'Low']}
              colors={['rose', 'orange', 'yellow', 'emerald']}
              showAnimation={true}
              valueFormatter={(value) => value.toLocaleString()}
              showLegend={false}
              showGridLines={true}
              curveType="monotone"
              yAxisWidth={40}
            />
            <Legend
              className="mt-3 justify-center"
              categories={['Critical', 'High', 'Medium', 'Low']}
              colors={['rose', 'orange', 'yellow', 'emerald']}
            />
          </>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Text>No scan history available</Text>
          </div>
        )}
      </Card>

      {/* Top Vulnerable Images Bar Chart */}
      <Card className="p-6">
        <Title>Top Vulnerable Images</Title>
        <Text className="text-muted-foreground">Container images with most vulnerabilities</Text>
        {chartData.topVulnerableImages.length > 0 ? (
          <BarChart
            className="mt-4 h-72"
            data={truncatedImageData}
            index="image"
            categories={['vulnerabilities']}
            colors={['blue']}
            showAnimation={true}
            valueFormatter={(value) => value.toLocaleString()}
            layout="vertical"
            showLegend={false}
            yAxisWidth={180}
          />
        ) : (
          <div className="h-72 flex items-center justify-center text-muted-foreground">
            <Text>No image data available</Text>
          </div>
        )}
      </Card>

      {/* Top Vulnerable Packages */}
      <Card className="p-6">
        <Title>Top Vulnerable Packages</Title>
        <Text className="text-muted-foreground">Packages with most vulnerabilities</Text>
        {chartData.topVulnerablePackages.length > 0 ? (
          <>
            <BarChart
              className="mt-4 h-64"
              data={truncatedPackageData}
              index="package"
              categories={['vulnerabilities', 'critical']}
              colors={['blue', 'rose']}
              showAnimation={true}
              valueFormatter={(value) => value.toLocaleString()}
              layout="vertical"
              showLegend={false}
              stack={false}
              yAxisWidth={150}
            />
            <Legend
              className="mt-3 justify-center"
              categories={['Total Vulnerabilities', 'Critical']}
              colors={['blue', 'rose']}
            />
          </>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Text>No package data available</Text>
          </div>
        )}
      </Card>
    </Grid>
  )
}
