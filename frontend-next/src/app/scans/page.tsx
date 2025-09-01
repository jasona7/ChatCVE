'use client'

import React, { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { ScanManagement } from '@/components/scans/scan-management'
import { ScanJob } from '@/types'

// Mock data - in real app this would come from API
const mockScans: ScanJob[] = [
  {
    id: '1',
    image_name: 'nginx:latest',
    status: 'completed',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    vulnerabilities_found: 23,
    critical_count: 2,
    high_count: 5,
    medium_count: 8,
    low_count: 8
  },
  {
    id: '2',
    image_name: 'redis:7.0',
    status: 'running',
    started_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '3',
    image_name: 'postgres:14',
    status: 'failed',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  }
]

export default function ScansPage() {
  const [scans, setScans] = useState<ScanJob[]>(mockScans)

  const handleStartScan = (imageName: string) => {
    const newScan: ScanJob = {
      id: Date.now().toString(),
      image_name: imageName,
      status: 'pending',
      started_at: new Date().toISOString(),
    }
    setScans(prev => [newScan, ...prev])
    
    // Simulate scan progression
    setTimeout(() => {
      setScans(prev => 
        prev.map(scan => 
          scan.id === newScan.id 
            ? { ...scan, status: 'running' }
            : scan
        )
      )
    }, 1000)
  }

  const handleStopScan = (scanId: string) => {
    setScans(prev => 
      prev.map(scan => 
        scan.id === scanId 
          ? { ...scan, status: 'pending' }
          : scan
      )
    )
  }

  const handleDeleteScan = (scanId: string) => {
    setScans(prev => prev.filter(scan => scan.id !== scanId))
  }

  return (
    <MainLayout>
      <div className="px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Scan Management</h1>
          <p className="text-muted-foreground">
            Manage container image scans and SBOM generation
          </p>
        </div>
        
        <ScanManagement
          scans={scans}
          onStartScan={handleStartScan}
          onStopScan={handleStopScan}
          onDeleteScan={handleDeleteScan}
        />
      </div>
    </MainLayout>
  )
}