'use client';

import React from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { PageTransition } from '@/components/ui/page-transition'
import { AuthGuard } from '@/components/auth/AuthGuard'

interface MainLayoutProps {
  children: React.ReactNode
  onRefresh?: () => void
  requiredRoles?: ('admin' | 'user' | 'guest')[]
}

export function MainLayout({ children, onRefresh, requiredRoles }: MainLayoutProps) {
  return (
    <AuthGuard requiredRoles={requiredRoles}>
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
    </AuthGuard>
  )
}
