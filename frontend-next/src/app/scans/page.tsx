'use client'

import React from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { ScanManagement } from '@/components/scans/scan-management'

export default function ScansPage() {
  return (
    <MainLayout>
      <ScanManagement />
    </MainLayout>
  )
}


