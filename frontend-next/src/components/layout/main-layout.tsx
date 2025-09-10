import React from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { PageTransition } from '@/components/ui/page-transition'

interface MainLayoutProps {
  children: React.ReactNode
  onRefresh?: () => void
}

export function MainLayout({ children, onRefresh }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onRefresh={onRefresh} />
        <main className="flex-1 overflow-auto p-6">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
