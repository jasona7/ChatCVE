'use client';

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import {
  Bell,
  Settings,
  User,
  Moon,
  Sun,
  RefreshCw,
  LogOut,
  Shield,
  ChevronDown
} from 'lucide-react'

interface HeaderProps {
  onRefresh?: () => void
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  user: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  guest: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export function Header({ onRefresh }: HeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [isDark, setIsDark] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
          <Settings className="h-4 w-4" />
        </Button>

        {/* User Menu Dropdown */}
        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-3"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
              <User className="h-4 w-4 text-white" />
            </div>
            {user && (
              <>
                <span className="text-sm font-medium hidden sm:inline">{user.username}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </>
            )}
          </Button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && user && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-popover shadow-lg z-50">
              {/* User Info */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{user.username}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${roleColors[user.role] || roleColors.guest}`}>
                      <Shield className="h-3 w-3" />
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                {user.role === 'admin' && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      router.push('/settings')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    User Management
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

