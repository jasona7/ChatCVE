'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout } from 'react-grid-layout'
import { api } from '@/lib/api'
import {
  DEFAULT_LAYOUT,
  DEFAULT_VISIBLE_WIDGETS,
  STORAGE_KEYS,
  PREFERENCE_KEYS,
} from '@/lib/dashboard-config'

interface UseDashboardLayoutReturn {
  layout: Layout[]
  hiddenWidgets: string[]
  isLoading: boolean
  isEditMode: boolean
  setEditMode: (mode: boolean) => void
  updateLayout: (newLayout: Layout[]) => void
  hideWidget: (widgetId: string) => void
  showWidget: (widgetId: string) => void
  resetLayout: () => void
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function useDashboardLayout(): UseDashboardLayoutReturn {
  const [layout, setLayout] = useState<Layout[]>(DEFAULT_LAYOUT)
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const isMounted = useRef(false)

  // Debounced save to backend
  const debouncedSaveLayout = useRef(
    debounce(async (newLayout: Layout[]) => {
      try {
        await api.setUserPreference(PREFERENCE_KEYS.LAYOUT, newLayout)
      } catch (error) {
        console.error('Failed to save layout to backend:', error)
      }
    }, 1000)
  ).current

  const debouncedSaveHiddenWidgets = useRef(
    debounce(async (hidden: string[]) => {
      try {
        await api.setUserPreference(PREFERENCE_KEYS.HIDDEN_WIDGETS, hidden)
      } catch (error) {
        console.error('Failed to save hidden widgets to backend:', error)
      }
    }, 1000)
  ).current

  // Load layout on mount
  useEffect(() => {
    const loadLayout = async () => {
      // First, try localStorage for fast load
      try {
        const cachedLayout = localStorage.getItem(STORAGE_KEYS.LAYOUT)
        const cachedHidden = localStorage.getItem(STORAGE_KEYS.HIDDEN_WIDGETS)

        if (cachedLayout) {
          setLayout(JSON.parse(cachedLayout))
        }
        if (cachedHidden) {
          setHiddenWidgets(JSON.parse(cachedHidden))
        }
      } catch (error) {
        console.error('Failed to load from localStorage:', error)
      }

      // Then fetch from backend and update if different
      try {
        const [serverLayout, serverHidden] = await Promise.all([
          api.getUserPreference<Layout[]>(PREFERENCE_KEYS.LAYOUT),
          api.getUserPreference<string[]>(PREFERENCE_KEYS.HIDDEN_WIDGETS),
        ])

        if (serverLayout && Array.isArray(serverLayout)) {
          setLayout(serverLayout)
          localStorage.setItem(STORAGE_KEYS.LAYOUT, JSON.stringify(serverLayout))
        }
        if (serverHidden && Array.isArray(serverHidden)) {
          setHiddenWidgets(serverHidden)
          localStorage.setItem(STORAGE_KEYS.HIDDEN_WIDGETS, JSON.stringify(serverHidden))
        }
      } catch (error) {
        console.error('Failed to load from backend:', error)
      }

      setIsLoading(false)
      isMounted.current = true
    }

    loadLayout()
  }, [])

  // Update layout
  const updateLayout = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout)
    // Save to localStorage immediately
    localStorage.setItem(STORAGE_KEYS.LAYOUT, JSON.stringify(newLayout))
    // Debounced save to backend
    if (isMounted.current) {
      debouncedSaveLayout(newLayout)
    }
  }, [debouncedSaveLayout])

  // Hide widget
  const hideWidget = useCallback((widgetId: string) => {
    setHiddenWidgets(prev => {
      const newHidden = [...prev, widgetId]
      localStorage.setItem(STORAGE_KEYS.HIDDEN_WIDGETS, JSON.stringify(newHidden))
      if (isMounted.current) {
        debouncedSaveHiddenWidgets(newHidden)
      }
      return newHidden
    })
  }, [debouncedSaveHiddenWidgets])

  // Show widget
  const showWidget = useCallback((widgetId: string) => {
    setHiddenWidgets(prev => {
      const newHidden = prev.filter(id => id !== widgetId)
      localStorage.setItem(STORAGE_KEYS.HIDDEN_WIDGETS, JSON.stringify(newHidden))
      if (isMounted.current) {
        debouncedSaveHiddenWidgets(newHidden)
      }
      return newHidden
    })
  }, [debouncedSaveHiddenWidgets])

  // Reset to default layout
  const resetLayout = useCallback(async () => {
    setLayout(DEFAULT_LAYOUT)
    setHiddenWidgets([])
    localStorage.setItem(STORAGE_KEYS.LAYOUT, JSON.stringify(DEFAULT_LAYOUT))
    localStorage.setItem(STORAGE_KEYS.HIDDEN_WIDGETS, JSON.stringify([]))

    try {
      await Promise.all([
        api.setUserPreference(PREFERENCE_KEYS.LAYOUT, DEFAULT_LAYOUT),
        api.setUserPreference(PREFERENCE_KEYS.HIDDEN_WIDGETS, []),
      ])
    } catch (error) {
      console.error('Failed to reset layout on backend:', error)
    }
  }, [])

  const setEditMode = useCallback((mode: boolean) => {
    setIsEditMode(mode)
  }, [])

  return {
    layout,
    hiddenWidgets,
    isLoading,
    isEditMode,
    setEditMode,
    updateLayout,
    hideWidget,
    showWidget,
    resetLayout,
  }
}
