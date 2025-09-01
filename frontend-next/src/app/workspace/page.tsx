'use client'

import React, { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { SavedWorkspace } from '@/components/workspace/saved-workspace'
import { UserWorkspace, ChatMessage, CVERecord } from '@/types'

// Mock data - in real app this would come from API
const mockWorkspaces: UserWorkspace[] = [
  {
    id: '1',
    name: 'Critical Issues Q1 2024',
    description: 'High priority vulnerabilities for quarterly review',
    saved_queries: ['query1', 'query2'],
    bookmarked_cves: ['cve1', 'cve2', 'cve3'],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  {
    id: '2',
    name: 'Web App Security Audit',
    description: 'Focus on web application security vulnerabilities',
    saved_queries: ['query3'],
    bookmarked_cves: ['cve4'],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString()
  }
]

const mockSavedQueries: ChatMessage[] = [
  {
    id: '1',
    question: 'Show me all critical vulnerabilities in production containers',
    answer: 'Found 42 critical vulnerabilities across 8 production containers...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    saved: true
  },
  {
    id: '2',
    question: 'Which packages need immediate patching?',
    answer: 'Based on CVSS scores, the following packages require immediate attention...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    saved: true
  }
]

const mockBookmarkedCVEs: CVERecord[] = [
  {
    id: '1',
    name: 'curl',
    installed: '7.74.0',
    fixed_in: '7.75.0',
    type: 'deb',
    vulnerability: 'CVE-2021-22876',
    severity: 'Critical',
    image_tag: 'nginx:latest',
    date_added: new Date().toISOString()
  },
  {
    id: '2',
    name: 'openssl',
    installed: '1.1.1n',
    fixed_in: '1.1.1o',
    type: 'deb',
    vulnerability: 'CVE-2022-0778',
    severity: 'High',
    image_tag: 'redis:7.0',
    date_added: new Date().toISOString()
  }
]

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<UserWorkspace[]>(mockWorkspaces)
  const [savedQueries, setSavedQueries] = useState<ChatMessage[]>(mockSavedQueries)
  const [bookmarkedCVEs, setBookmarkedCVEs] = useState<CVERecord[]>(mockBookmarkedCVEs)

  const handleCreateWorkspace = (name: string, description?: string) => {
    const newWorkspace: UserWorkspace = {
      id: Date.now().toString(),
      name,
      description,
      saved_queries: [],
      bookmarked_cves: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setWorkspaces(prev => [newWorkspace, ...prev])
  }

  const handleDeleteWorkspace = (workspaceId: string) => {
    setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId))
  }

  const handleSaveQuery = (query: ChatMessage) => {
    setSavedQueries(prev => [query, ...prev])
  }

  const handleBookmarkCVE = (cve: CVERecord) => {
    setBookmarkedCVEs(prev => [cve, ...prev])
  }

  return (
    <MainLayout>
      <div className="px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Workspace</h1>
          <p className="text-muted-foreground">
            Manage your saved work, queries, and bookmarks
          </p>
        </div>
        
        <SavedWorkspace
          workspaces={workspaces}
          savedQueries={savedQueries}
          bookmarkedCVEs={bookmarkedCVEs}
          onCreateWorkspace={handleCreateWorkspace}
          onDeleteWorkspace={handleDeleteWorkspace}
          onSaveQuery={handleSaveQuery}
          onBookmarkCVE={handleBookmarkCVE}
        />
      </div>
    </MainLayout>
  )
}