'use client'

import React from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { CVEExplorer } from '@/components/cves/cve-explorer'

export default function CVEsPage() {
  return (
    <MainLayout>
      <CVEExplorer />
    </MainLayout>
  )
}


