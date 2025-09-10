'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react'

export interface DataTableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (item: T) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  title?: string
  description?: string
  searchable?: boolean
  searchPlaceholder?: string
  pageSize?: number
  loading?: boolean
  onRowClick?: (item: T) => void
  renderActions?: (item: T) => React.ReactNode
  renderExpandedRow?: (item: T) => React.ReactNode
  emptyState?: React.ReactNode
  className?: string
  selectable?: boolean
  selectedItems?: Set<string>
  onSelectionChange?: (selectedItems: Set<string>) => void
  getItemId?: (item: T) => string
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  description,
  searchable = true,
  searchPlaceholder = "Search...",
  pageSize = 10,
  loading = false,
  onRowClick,
  renderActions,
  renderExpandedRow,
  emptyState,
  className = "",
  selectable = false,
  selectedItems = new Set(),
  onSelectionChange,
  getItemId = (item) => item.id || JSON.stringify(item)
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, string>>({})

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    
    if (checked) {
      const allIds = new Set(sortedData.map(item => getItemId(item)))
      onSelectionChange(allIds)
    } else {
      onSelectionChange(new Set())
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (!onSelectionChange) return
    
    const newSelection = new Set(selectedItems)
    if (checked) {
      newSelection.add(itemId)
    } else {
      newSelection.delete(itemId)
    }
    onSelectionChange(newSelection)
  }

  // Filter and search data
  const filteredData = useMemo(() => {
    let result = data

    // Apply search
    if (searchTerm) {
      result = result.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item =>
          String(item[key]).toLowerCase().includes(value.toLowerCase())
        )
      }
    })

    return result
  }, [data, searchTerm, filters])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [filteredData, sortConfig])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return sortedData.slice(startIndex, startIndex + pageSize)
  }, [sortedData, currentPage, pageSize])

  // Selection state calculations
  const isAllSelected = selectable && paginatedData.length > 0 && 
    paginatedData.every(item => selectedItems.has(getItemId(item)))
  const isPartiallySelected = selectable && selectedItems.size > 0 && !isAllSelected

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return { key, direction: 'asc' }
    })
  }

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
    setCurrentPage(1) // Reset to first page when filtering
  }

  const SortIcon = ({ column }: { column: DataTableColumn<T> }) => {
    if (!column.sortable) return null
    
    const key = column.key as string
    if (sortConfig?.key === key) {
      return sortConfig.direction === 'asc' ? 
        <ChevronUp className="h-4 w-4" /> : 
        <ChevronDown className="h-4 w-4" />
    }
    return <ArrowUpDown className="h-4 w-4 opacity-50" />
  }

  if (loading) {
    return (
      <Card className={className}>
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            {searchable && (
              <div className="h-10 bg-muted rounded animate-pulse"></div>
            )}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        {searchable && (
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {columns.some(col => col.filterable) && (
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="border rounded-lg">
          <ScrollArea className="w-full">
            <div className="min-w-full">
              {/* Header */}
              <div className={`grid gap-4 p-4 border-b bg-muted/50 font-medium text-sm ${selectable ? 'grid-cols-[auto_repeat(12,1fr)]' : 'grid-cols-12'}`}>
                {selectable && (
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isPartiallySelected
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                )}
                {columns.map((column, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 ${column.width || 'col-span-2'} ${
                      column.align === 'center' ? 'justify-center' : 
                      column.align === 'right' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{column.label}</span>
                    {column.sortable && (
                      <button
                        onClick={() => handleSort(column.key as string)}
                        className="hover:bg-muted rounded p-1"
                      >
                        <SortIcon column={column} />
                      </button>
                    )}
                  </div>
                ))}
                {renderActions && (
                  <div className="col-span-2 text-right">Actions</div>
                )}
              </div>

              {/* Body */}
              {paginatedData.length === 0 ? (
                <div className="p-8 text-center">
                  {emptyState || (
                    <div>
                      <div className="text-muted-foreground mb-2">No data found</div>
                      {searchTerm && (
                        <div className="text-sm text-muted-foreground">
                          Try adjusting your search criteria
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {paginatedData.map((item, index) => (
                    <React.Fragment key={index}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ 
                          duration: 0.2, 
                          delay: index * 0.02,
                          ease: "easeOut"
                        }}
                        className={`grid gap-4 p-4 border-b hover:bg-muted/25 transition-all duration-200 ${
                          selectable ? 'grid-cols-[auto_repeat(12,1fr)]' : 'grid-cols-12'
                        } ${onRowClick ? 'cursor-pointer hover:shadow-sm' : ''}`}
                        whileHover={onRowClick ? { 
                          scale: 1.005,
                          transition: { duration: 0.1 }
                        } : undefined}
                        onClick={(e) => {
                          // Don't trigger row click if clicking on checkbox or its container
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                              (e.target as HTMLElement).closest('.checkbox-container')) {
                            return
                          }
                          onRowClick?.(item)
                        }}
                      >
                        {selectable && (
                          <div className="flex items-center justify-center checkbox-container">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(getItemId(item))}
                              onChange={(e) => {
                                e.stopPropagation()
                                handleSelectItem(getItemId(item), e.target.checked)
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        {columns.map((column, colIndex) => (
                        <div
                          key={colIndex}
                          className={`${column.width || 'col-span-2'} ${
                            column.align === 'center' ? 'text-center' : 
                            column.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {column.render ? column.render(item) : String(item[column.key])}
                        </div>
                      ))}
                      {renderActions && (
                        <div className="col-span-2 text-right">
                          {renderActions(item)}
                        </div>
                      )}
                      </motion.div>
                      
                      {/* Expanded Row */}
                      {renderExpandedRow && renderExpandedRow(item) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="col-span-12 border-b bg-muted/10"
                        >
                          <div className="p-4">
                            {renderExpandedRow(item)}
                          </div>
                        </motion.div>
                      )}
                    </React.Fragment>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
