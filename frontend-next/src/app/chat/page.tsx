'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { ChatInterface } from '@/components/chat/chat-interface'
import { ChatMessage } from '@/types'

// Mock data - in real app this would come from API
const mockMessages: ChatMessage[] = [
  {
    id: '1',
    question: 'Which NAME in app_patrol table has the most CRITICAL Severity records?',
    answer: 'The top 3 Names in the app_patrol table sorted by the top count of critical in the severity column are \'curl\', \'libcurl4\', and \'libpcre2-8-0\'.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    saved: true
  },
  {
    id: '2',
    question: 'What percentage of records are for curl in the app_patrol table?',
    answer: '6.006697362913353% of records in the app_patrol table are for curl.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    saved: false
  }
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages)
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async (question: string) => {
    setIsLoading(true)
    
    // Create user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      question,
      answer: '',
      timestamp: new Date().toISOString(),
      saved: false
    }

    // Simulate API call
    setTimeout(() => {
      const botResponse: ChatMessage = {
        ...userMessage,
        answer: `This is a simulated response to: "${question}". In the real implementation, this would query your CVE database using the Langchain SQL agent.`,
      }
      
      setMessages(prev => [botResponse, ...prev])
      setIsLoading(false)
    }, 2000)
  }

  const handleSaveMessage = (messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, saved: !msg.saved }
          : msg
      )
    )
  }

  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId))
  }

  return (
    <MainLayout>
      <div className="h-[calc(100vh-8rem)] px-6">
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          onSaveMessage={handleSaveMessage}
          onDeleteMessage={handleDeleteMessage}
          isLoading={isLoading}
        />
      </div>
    </MainLayout>
  )
}