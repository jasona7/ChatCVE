'use client'

import React from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { EnhancedChatInterface } from '@/components/chat/enhanced-chat-interface'

export default function ChatPage() {
  return (
    <MainLayout>
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground">
            Chat with ChatCVE AI for vulnerability analysis and security insights
          </p>
        </div>
        
        <div className="flex-1 min-h-0">
          <EnhancedChatInterface />
        </div>
      </div>
    </MainLayout>
  )
}
