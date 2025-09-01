'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Bell, 
  Search, 
  Settings, 
  User,
  Moon,
  Sun,
  Refresh
} from 'lucide-react'

interface HeaderProps {
  onRefresh?: () => void
  notifications?: number
}

export function Header({ onRefresh, notifications = 0 }: HeaderProps) {
  const [isDark, setIsDark] = React.useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-6">
        <div className="flex flex-1 items-center space-x-4">
          {/* Global Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search CVEs, packages, or ask a question..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Refresh Button */}
          <Button variant="ghost" size="icon" onClick={onRefresh}>
            <Refresh className="h-4 w-4" />
          </Button>

          {/* Theme Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {notifications > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 text-xs flex items-center justify-center p-0"
              >
                {notifications > 99 ? '99+' : notifications}
              </Badge>
            )}
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>

          {/* User Menu */}
          <Button variant="ghost" size="icon">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}