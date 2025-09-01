'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Search, 
  Shield, 
  FileText, 
  Settings,
  Bookmark,
  Activity,
  Database
} from 'lucide-react'

interface SidebarProps {
  className?: string
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Overview and analytics'
  },
  {
    name: 'AI Chat',
    href: '/chat',
    icon: MessageSquare,
    description: 'Query CVEs with natural language'
  },
  {
    name: 'CVE Explorer',
    href: '/cves',
    icon: Search,
    description: 'Browse and search vulnerabilities'
  },
  {
    name: 'Scan Management',
    href: '/scans',
    icon: Shield,
    description: 'Manage image scans and SBOMs'
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: FileText,
    description: 'Generate and view reports'
  },
  {
    name: 'Workspace',
    href: '/workspace',
    icon: Bookmark,
    description: 'Saved queries and bookmarks'
  },
  {
    name: 'Activity',
    href: '/activity',
    icon: Activity,
    description: 'Scan history and logs'
  },
  {
    name: 'Database',
    href: '/database',
    icon: Database,
    description: 'Raw data access'
  }
]

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn("pb-12 w-64", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center mb-6">
            <Shield className="h-8 w-8 text-primary mr-3" />
            <div>
              <h2 className="text-xl font-bold text-foreground">ChatCVE</h2>
              <p className="text-xs text-muted-foreground">AI Vulnerability Management</p>
            </div>
          </div>
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  <div className="flex-1">
                    <div>{item.name}</div>
                    <div className="text-xs opacity-70">{item.description}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}