'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Send, 
  Bookmark, 
  Copy, 
  Trash2, 
  MessageSquare,
  Bot,
  User,
  Star,
  Download,
  Filter
} from 'lucide-react'
import { ChatMessage } from '@/types'
import { cn } from '@/lib/utils'

interface ChatInterfaceProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  onSaveMessage: (messageId: string) => void
  onDeleteMessage: (messageId: string) => void
  isLoading?: boolean
}

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onSaveMessage, 
  onDeleteMessage, 
  isLoading = false 
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<'all' | 'saved'>('all')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim())
      setInputValue('')
    }
  }

  const filteredMessages = filter === 'saved' 
    ? messages.filter(msg => msg.saved)
    : messages

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const suggestedQueries = [
    "What are the critical vulnerabilities in my scanned images?",
    "Which packages have the most vulnerabilities?",
    "Show me recent CVEs from the last 24 hours",
    "What containers have OpenSSL vulnerabilities?",
    "Give me a summary of high severity issues"
  ]

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">AI CVE Assistant</h2>
          <p className="text-sm text-muted-foreground">
            Ask questions about your vulnerability data in natural language
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'saved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('saved')}
          >
            <Star className="h-4 w-4 mr-1" />
            Saved
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
              <p className="text-muted-foreground mb-6">
                Ask questions about your CVE data using natural language
              </p>
              
              {/* Suggested Queries */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQueries.map((query) => (
                    <Button
                      key={query}
                      variant="outline"
                      size="sm"
                      onClick={() => setInputValue(query)}
                      className="text-xs"
                    >
                      {query}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div key={message.id} className="space-y-4">
                {/* User Question */}
                <div className="flex items-start space-x-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm">{message.question}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex items-start space-x-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Card>
                      <CardContent className="p-4">
                        <div className="prose prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap text-sm">{message.answer}</pre>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </Badge>
                            {message.saved && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Saved
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(message.answer)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onSaveMessage(message.id)}
                            >
                              <Bookmark className={cn("h-3 w-3", message.saved && "fill-current")} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onDeleteMessage(message.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question about your CVE data..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}