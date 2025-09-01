'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Plus, 
  Play, 
  Pause, 
  RotateCcw, 
  FileImage, 
  Activity, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { ScanJob } from '@/types'

interface ScanManagementProps {
  scans: ScanJob[]
  onStartScan: (imageName: string) => void
  onStopScan: (scanId: string) => void
  onDeleteScan: (scanId: string) => void
}

export function ScanManagement({ 
  scans, 
  onStartScan, 
  onStopScan, 
  onDeleteScan 
}: ScanManagementProps) {
  const [newImageName, setNewImageName] = useState('')
  const [isAddingImage, setIsAddingImage] = useState(false)

  const handleAddImage = () => {
    if (newImageName.trim()) {
      onStartScan(newImageName.trim())
      setNewImageName('')
      setIsAddingImage(false)
    }
  }

  const getStatusIcon = (status: ScanJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'running':
        return <Activity className="h-4 w-4 text-blue-600 animate-spin" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: ScanJob['status']) => {
    const variants = {
      completed: 'default',
      running: 'secondary',
      failed: 'destructive',
      pending: 'outline'
    } as const

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add New Scan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileImage className="h-5 w-5 mr-2" />
            Container Image Scanning
          </CardTitle>
          <CardDescription>
            Scan container images for vulnerabilities using Syft and Grype
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isAddingImage ? (
            <Button onClick={() => setIsAddingImage(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Image Scan
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Input
                placeholder="Enter image name (e.g., nginx:latest, public.ecr.aws/repo/image:tag)"
                value={newImageName}
                onChange={(e) => setNewImageName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddImage()}
                className="flex-1"
              />
              <Button onClick={handleAddImage} disabled={!newImageName.trim()}>
                <Play className="h-4 w-4 mr-2" />
                Start Scan
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddingImage(false)
                  setNewImageName('')
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan History */}
      <Card>
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
          <CardDescription>
            Recent and ongoing vulnerability scans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {scans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No scans yet. Add an image to get started.</p>
                </div>
              ) : (
                scans.map((scan) => (
                  <Card key={scan.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(scan.status)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {scan.image_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Started: {new Date(scan.started_at).toLocaleString()}
                            </p>
                            {scan.completed_at && (
                              <p className="text-xs text-muted-foreground">
                                Completed: {new Date(scan.completed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(scan.status)}
                          
                          {scan.status === 'completed' && scan.vulnerabilities_found !== undefined && (
                            <div className="flex space-x-1">
                              {scan.critical_count && scan.critical_count > 0 && (
                                <Badge variant="critical" className="text-xs">
                                  C: {scan.critical_count}
                                </Badge>
                              )}
                              {scan.high_count && scan.high_count > 0 && (
                                <Badge variant="high" className="text-xs">
                                  H: {scan.high_count}
                                </Badge>
                              )}
                              {scan.medium_count && scan.medium_count > 0 && (
                                <Badge variant="medium" className="text-xs">
                                  M: {scan.medium_count}
                                </Badge>
                              )}
                              {scan.low_count && scan.low_count > 0 && (
                                <Badge variant="low" className="text-xs">
                                  L: {scan.low_count}
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          <div className="flex space-x-1">
                            {scan.status === 'running' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onStopScan(scan.id)}
                              >
                                <Pause className="h-3 w-3" />
                              </Button>
                            )}
                            {scan.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onStartScan(scan.image_name)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onDeleteScan(scan.id)}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {scan.status === 'completed' && scan.vulnerabilities_found !== undefined && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Total vulnerabilities found:
                            </span>
                            <span className="font-medium">
                              {scan.vulnerabilities_found}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}