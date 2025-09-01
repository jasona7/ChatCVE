'use client'

import React, { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { CVEExplorer } from '@/components/cves/cve-explorer'
import { CVERecord } from '@/types'

// Mock data - in real app this would come from API
const mockCVEs: CVERecord[] = [
  {
    id: '1',
    name: 'curl',
    installed: '7.74.0',
    fixed_in: '7.75.0',
    type: 'deb',
    vulnerability: 'CVE-2021-22876',
    severity: 'Critical',
    image_tag: 'nginx:latest',
    date_added: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  },
  {
    id: '2',
    name: 'libcurl4',
    installed: '7.74.0',
    fixed_in: '7.75.0',
    type: 'deb',
    vulnerability: 'CVE-2021-22876',
    severity: 'Critical',
    image_tag: 'nginx:latest',
    date_added: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  },
  {
    id: '3',
    name: 'openssl',
    installed: '1.1.1n',
    fixed_in: '1.1.1o',
    type: 'deb',
    vulnerability: 'CVE-2022-0778',
    severity: 'High',
    image_tag: 'redis:7.0',
    date_added: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
  },
  {
    id: '4',
    name: 'jetty-setuid-java',
    installed: '1.0.4',
    type: 'java-archive',
    vulnerability: 'CVE-2009-5045',
    severity: 'High',
    image_tag: 'postgres:14',
    date_added: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
  },
  {
    id: '5',
    name: 'libpcre2-8-0',
    installed: '10.36',
    fixed_in: '10.37',
    type: 'deb',
    vulnerability: 'CVE-2022-1586',
    severity: 'Medium',
    image_tag: 'alpine:latest',
    date_added: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString()
  }
]

export default function CVEsPage() {
  const [cves, setCVEs] = useState<CVERecord[]>(mockCVEs)
  const [bookmarkedCVEs, setBookmarkedCVEs] = useState<string[]>([])

  const handleBookmark = (cve: CVERecord) => {
    setBookmarkedCVEs(prev => 
      prev.includes(cve.id)
        ? prev.filter(id => id !== cve.id)
        : [...prev, cve.id]
    )
  }

  const handleFilter = (filters: any) => {
    // In real app, this would trigger API call with filters
    console.log('Filters applied:', filters)
  }

  return (
    <MainLayout>
      <div className="px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">CVE Explorer</h1>
          <p className="text-muted-foreground">
            Browse, search, and analyze vulnerability records
          </p>
        </div>
        
        <CVEExplorer
          cves={cves}
          onBookmark={handleBookmark}
          onFilter={handleFilter}
        />
      </div>
    </MainLayout>
  )
}