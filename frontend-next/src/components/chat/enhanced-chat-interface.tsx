'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { MotionCard } from '@/components/ui/motion-card'
import { MotionButton } from '@/components/ui/motion-button'
import { MotionContainer } from '@/components/ui/motion-container'
import { ChatMessage } from '@/types'
import { api } from '@/lib/api'
import { 
  Send, 
  Bot, 
  User, 
  Copy, 
  Save, 
  Sparkles,
  Shield,
  Search,
  BarChart3,
  AlertTriangle,
  Database,
  Clock,
  TrendingUp,
  Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

interface PopularQuestion {
  id: string
  question: string
  category: string
  icon: React.ElementType
  description: string
}

const popularQuestions: PopularQuestion[] = [
  {
    id: '1',
    question: 'How many CVEs are HIGH severity?',
    category: 'Analysis',
    icon: AlertTriangle,
    description: 'Get count of high severity vulnerabilities'
  },
  {
    id: '2',
    question: 'How many scans have we performed over entire app history?',
    category: 'Statistics',
    icon: BarChart3,
    description: 'Total scan count across all time'
  },
  {
    id: '3',
    question: 'Show me the most recent critical vulnerabilities',
    category: 'Security',
    icon: Shield,
    description: 'Latest critical security issues'
  },
  {
    id: '4',
    question: 'What are the top 10 most vulnerable packages?',
    category: 'Analysis',
    icon: Database,
    description: 'Packages with most vulnerabilities'
  },
  {
    id: '5',
    question: 'How many scans has the user initiated?',
    category: 'User Activity',
    icon: User,
    description: 'User-initiated scan count'
  },
  {
    id: '6',
    question: 'Show vulnerability trends over the past month',
    category: 'Trends',
    icon: TrendingUp,
    description: 'Monthly vulnerability statistics'
  },
  {
    id: '7',
    question: 'List all containers with critical vulnerabilities',
    category: 'Containers',
    icon: Search,
    description: 'Critical vulnerability container list'
  },
  {
    id: '8',
    question: 'What CVEs were published in the last 7 days?',
    category: 'Recent',
    icon: Clock,
    description: 'Recently published vulnerabilities'
  }
]

interface EnhancedChatInterfaceProps {
  onQuestionSelect?: (question: string) => void
}

export function EnhancedChatInterface({ onQuestionSelect }: EnhancedChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadChatHistory()
  }, [])

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight
      }
    }
  }, [messages])

  const loadChatHistory = async () => {
    try {
      const history = await api.getChatHistory()
      setMessages(history)
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      question: input.trim(),
      response: '',
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await api.sendMessage(input.trim())
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        question: '',
        response: response,
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        question: '',
        response: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearChat = () => {
    if (messages.length === 0) return
    
    if (confirm('Are you sure you want to clear all chat messages? This action cannot be undone.')) {
      setMessages([])
    }
  }

  const copyToClipboard = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      if (id) {
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
      }
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  const handleQuestionClick = (question: string) => {
    setInput(question)
    inputRef.current?.focus()
    onQuestionSelect?.(question)
  }

  const saveToWorkspace = (message: ChatMessage) => {
    console.log('Saving to workspace:', message)
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      'Analysis': 'bg-blue-100 text-blue-800 border-blue-200',
      'Statistics': 'bg-green-100 text-green-800 border-green-200',
      'Security': 'bg-red-100 text-red-800 border-red-200',
      'User Activity': 'bg-purple-100 text-purple-800 border-purple-200',
      'Trends': 'bg-orange-100 text-orange-800 border-orange-200',
      'Containers': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      'Recent': 'bg-pink-100 text-pink-800 border-pink-200'
    }
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <MotionCard className="flex-1 flex flex-col min-h-0" hover={false}>
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
              <MotionContainer className="space-y-6" stagger={0.1}>
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      <div className="relative">
                        <Bot className="h-16 w-16 mx-auto mb-4 text-primary" />
                        <Sparkles className="h-6 w-6 absolute -top-1 -right-1 text-yellow-500" />
                      </div>
                    </motion.div>
                    <h3 className="text-xl font-semibold mb-2">Welcome to ChatCVE AI</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      I'm your intelligent security assistant. Ask me about vulnerabilities, CVEs, scan results, 
                      or any security-related questions about your applications.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Badge variant="secondary" className="gap-1">
                        <Database className="h-3 w-3" />
                        SQL Queries
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Search className="h-3 w-3" />
                        CVE Lookup
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <BarChart3 className="h-3 w-3" />
                        Risk Analysis
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Security Insights
                      </Badge>
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {messages.map((message, index) => (
                    <motion.div 
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {message.question && (
                        <div className="flex justify-end mb-4">
                          <Card className="max-w-[80%] bg-primary text-primary-foreground">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <User className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {message.question}
                                  </p>
                                  <p className="text-xs opacity-70 mt-2">
                                    {format(new Date(message.timestamp), 'MMM d, HH:mm')}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {message.response && (
                        <div className="flex justify-start mb-4">
                          <Card className="max-w-[85%] border-l-4 border-l-primary">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="relative flex-shrink-0">
                                  <Bot className="h-5 w-5 text-primary" />
                                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-medium">ChatCVE Assistant</span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(message.timestamp), 'MMM d, HH:mm')}
                                    </span>
                                  </div>
                                  <div className="prose prose-sm max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/50 p-3 rounded-md overflow-x-auto">
                                      {message.response}
                                    </pre>
                                  </div>
                                  <div className="flex gap-1 mt-3">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(message.response, message.id)}
                                      className="h-8 text-xs"
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      {copiedId === message.id ? 'Copied!' : 'Copy'}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => saveToWorkspace(message)}
                                      className="h-8 text-xs"
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-start"
                  >
                    <Card className="max-w-[60%]">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            <Bot className="h-5 w-5 text-primary" />
                          </motion.div>
                          <div>
                            <span className="text-sm text-muted-foreground">ChatCVE is analyzing...</span>
                            <div className="flex gap-1 mt-1">
                              {[0, 1, 2].map((i) => (
                                <motion.div
                                  key={i}
                                  className="w-2 h-2 bg-primary rounded-full"
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.2
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </MotionContainer>
            </ScrollArea>
          </div>

          {/* Input Area */}
          <div className="border-t p-4 bg-muted/20">
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about vulnerabilities, CVEs, scans, or security analysis..."
                disabled={isLoading}
                className="flex-1 h-12 text-base"
              />
              {messages.length > 0 && (
                <MotionButton
                  onClick={handleClearChat}
                  variant="outline"
                  size="lg"
                  className="px-4"
                  title="Clear all chat messages"
                >
                  <Trash2 className="h-4 w-4" />
                </MotionButton>
              )}
              <MotionButton
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="lg"
                className="px-6"
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </MotionButton>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send • Shift+Enter for new line • Click questions on the right to auto-fill
            </p>
          </div>
        </MotionCard>
      </div>

      {/* Popular Questions Sidebar */}
      <div className="w-80 bg-gradient-to-b from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg border border-yellow-200 dark:border-yellow-800 shadow-lg">
        <div className="p-4 h-full flex flex-col">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                Popular Questions
              </h2>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Click any question to add it to your chat input
            </p>
          </div>
          
          <ScrollArea className="flex-1">
            <MotionContainer className="space-y-3" stagger={0.05}>
              {popularQuestions.map((item) => {
                const IconComponent = item.icon
                return (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card 
                      className="cursor-pointer transition-all duration-200 hover:shadow-md bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-yellow-200/50 hover:border-yellow-300"
                      onClick={() => handleQuestionClick(item.question)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                            <IconComponent className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Badge 
                              variant="outline" 
                              className={`text-xs mb-2 ${getCategoryColor(item.category)}`}
                            >
                              {item.category}
                            </Badge>
                            <p className="text-sm font-medium leading-tight mb-1 text-gray-900 dark:text-gray-100">
                              {item.question}
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                          <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </MotionContainer>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}


