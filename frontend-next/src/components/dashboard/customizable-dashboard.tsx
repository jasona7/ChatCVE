'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Responsive, WidthProvider, Layout } from 'react-grid-layout'
import { Button } from '@/components/ui/button'
import { WidgetCard } from './widget-card'
import { useDashboardLayout } from '@/hooks/useDashboardLayout'
import {
  WIDGET_REGISTRY,
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN,
} from '@/lib/dashboard-config'
import { Settings2, RotateCcw, Plus, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface CustomizableDashboardProps {
  children: Record<string, React.ReactNode>
}

export function CustomizableDashboard({ children }: CustomizableDashboardProps) {
  const {
    layout,
    hiddenWidgets,
    isLoading,
    isEditMode,
    setEditMode,
    updateLayout,
    hideWidget,
    showWidget,
    resetLayout,
  } = useDashboardLayout()

  const [mounted, setMounted] = useState(false)

  // Handle SSR - only render grid after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle layout change
  const handleLayoutChange = useCallback(
    (currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
      // Only save if in edit mode to prevent accidental saves
      if (isEditMode && mounted) {
        updateLayout(currentLayout)
      }
    },
    [isEditMode, mounted, updateLayout]
  )

  // Filter layout to exclude hidden widgets
  const visibleLayout = useMemo(() => {
    return layout.filter(item => !hiddenWidgets.includes(item.i))
  }, [layout, hiddenWidgets])

  // Get hidden widget options for "Add Widget" menu
  const hiddenWidgetOptions = useMemo(() => {
    return hiddenWidgets
      .map(id => WIDGET_REGISTRY[id])
      .filter(Boolean)
  }, [hiddenWidgets])

  // Loading state
  if (!mounted || isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEditMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={resetLayout}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Layout
              </Button>

              {hiddenWidgetOptions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Widget
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Hidden Widgets</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {hiddenWidgetOptions.map(widget => (
                      <DropdownMenuItem
                        key={widget.id}
                        onClick={() => showWidget(widget.id)}
                      >
                        {widget.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>

        <Button
          variant={isEditMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditMode(!isEditMode)}
          className="gap-2"
        >
          {isEditMode ? (
            <>
              <Check className="h-4 w-4" />
              Done
            </>
          ) : (
            <>
              <Settings2 className="h-4 w-4" />
              Customize
            </>
          )}
        </Button>
      </div>

      {/* Edit mode indicator */}
      {isEditMode && (
        <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3 text-sm text-muted-foreground">
          <strong>Edit Mode:</strong> Drag widgets to rearrange, resize from corners, or click X to hide.
        </div>
      )}

      {/* Grid Layout */}
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: visibleLayout }}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        margin={GRID_MARGIN}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        draggableHandle=".drag-handle"
        useCSSTransforms={mounted}
        compactType="vertical"
        preventCollision={false}
      >
        {visibleLayout.map(item => {
          const widget = WIDGET_REGISTRY[item.i]
          const content = children[item.i]

          if (!widget || !content) return null

          return (
            <div key={item.i} className="widget-container">
              <WidgetCard
                title={widget.title}
                isEditMode={isEditMode}
                onRemove={() => hideWidget(item.i)}
              >
                {content}
              </WidgetCard>
            </div>
          )
        })}
      </ResponsiveGridLayout>
    </div>
  )
}
