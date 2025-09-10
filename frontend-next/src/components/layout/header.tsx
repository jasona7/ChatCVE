import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Bell,
  Settings,
  User,
  Moon,
  Sun,
  RefreshCw
} from 'lucide-react'

interface HeaderProps {
  onRefresh?: () => void
}

export function Header({ onRefresh }: HeaderProps) {
  const [isDark, setIsDark] = React.useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    // In a real app, you'd implement theme switching here
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="flex items-center justify-end border-b bg-background px-6 py-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="icon">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

