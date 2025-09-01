'use client'

import React from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface MainLayoutProps {
  children: React.ReactNode
  onRefresh?: () => void
  notifications?: number
}

export function MainLayout({ children, onRefresh, notifications }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
          <div className="flex-1 flex flex-col min-h-0 border-r bg-background">
            <Sidebar />
          </div>
        </div>

        {/* Main content */}
        <div className="md:pl-64 flex flex-col flex-1">
          <Header onRefresh={onRefresh} notifications={notifications} />
          <main className="flex-1">
            <div className="py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}