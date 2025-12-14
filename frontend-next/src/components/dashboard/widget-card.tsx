'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WidgetCardProps {
  title: string
  children: React.ReactNode
  isEditMode?: boolean
  onRemove?: () => void
  className?: string
}

export function WidgetCard({
  title,
  children,
  isEditMode = false,
  onRemove,
  className,
}: WidgetCardProps) {
  return (
    <Card className={cn('h-full flex flex-col overflow-hidden', className)}>
      <CardHeader className={cn(
        'flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-3',
        isEditMode && 'cursor-move'
      )}>
        <div className="flex items-center gap-2">
          {isEditMode && (
            <div className="drag-handle cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        {isEditMode && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-0 overflow-auto">
        {children}
      </CardContent>
    </Card>
  )
}
