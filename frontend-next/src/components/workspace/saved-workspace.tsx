'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Plus, 
  Star, 
  Bookmark, 
  Search, 
  Trash2, 
  Edit3,
  Calendar,
  Tags,
  MessageSquare,
  Shield,
  Download,
  Share
} from 'lucide-react'
import { UserWorkspace, ChatMessage, CVERecord } from '@/types'

interface SavedWorkspaceProps {
  workspaces: UserWorkspace[]
  savedQueries: ChatMessage[]
  bookmarkedCVEs: CVERecord[]
  onCreateWorkspace: (name: string, description?: string) => void
  onDeleteWorkspace: (workspaceId: string) => void
  onSaveQuery: (query: ChatMessage) => void
  onBookmarkCVE: (cve: CVERecord) => void
}

export function SavedWorkspace({ 
  workspaces,
  savedQueries,
  bookmarkedCVEs,
  onCreateWorkspace,
  onDeleteWorkspace,
  onSaveQuery,
  onBookmarkCVE
}: SavedWorkspaceProps) {
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('')
  const [activeTab, setActiveTab] = useState<'workspaces' | 'queries' | 'bookmarks'>('workspaces')

  const handleCreateWorkspace = () => {
    if (newWorkspaceName.trim()) {
      onCreateWorkspace(newWorkspaceName.trim(), newWorkspaceDesc.trim() || undefined)
      setNewWorkspaceName('')
      setNewWorkspaceDesc('')
      setIsCreatingWorkspace(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Workspace Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Workspace</CardTitle>
              <CardDescription>
                Manage your saved work, queries, and bookmarks
              </CardDescription>
            </div>
            <div className="flex space-x-1">
              <Button
                variant={activeTab === 'workspaces' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('workspaces')}
              >
                <Bookmark className="h-4 w-4 mr-2" />
                Workspaces
              </Button>
              <Button
                variant={activeTab === 'queries' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('queries')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Saved Queries
              </Button>
              <Button
                variant={activeTab === 'bookmarks' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('bookmarks')}
              >
                <Star className="h-4 w-4 mr-2" />
                CVE Bookmarks
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Workspaces Tab */}
          {activeTab === 'workspaces' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Workspaces</h3>
                {!isCreatingWorkspace && (
                  <Button onClick={() => setIsCreatingWorkspace(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Workspace
                  </Button>
                )}
              </div>

              {isCreatingWorkspace && (
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <Input
                      placeholder="Workspace name"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newWorkspaceDesc}
                      onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                    />
                    <div className="flex space-x-2">
                      <Button onClick={handleCreateWorkspace} size="sm">
                        Create
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setIsCreatingWorkspace(false)
                          setNewWorkspaceName('')
                          setNewWorkspaceDesc('')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {workspaces.map((workspace) => (
                    <Card key={workspace.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium">{workspace.name}</h4>
                            {workspace.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {workspace.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(workspace.created_at).toLocaleDateString()}
                              </span>
                              <span className="flex items-center">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {workspace.saved_queries.length} queries
                              </span>
                              <span className="flex items-center">
                                <Shield className="h-3 w-3 mr-1" />
                                {workspace.bookmarked_cves.length} CVEs
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Share className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => onDeleteWorkspace(workspace.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Saved Queries Tab */}
          {activeTab === 'queries' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Saved Queries</h3>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {savedQueries.map((query) => (
                    <Card key={query.id}>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{query.question}</p>
                              <div className="flex items-center mt-2 space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {new Date(query.timestamp).toLocaleDateString()}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Saved
                                </Badge>
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                            <div className="max-h-20 overflow-y-auto">
                              {query.answer.substring(0, 200)}...
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* CVE Bookmarks Tab */}
          {activeTab === 'bookmarks' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Bookmarked CVEs</h3>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {bookmarkedCVEs.map((cve) => (
                    <Card key={cve.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium">{cve.vulnerability}</p>
                              <Badge variant={cve.severity.toLowerCase() as any}>
                                {cve.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {cve.name} v{cve.installed} in {cve.image_tag}
                            </p>
                          </div>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Search className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}