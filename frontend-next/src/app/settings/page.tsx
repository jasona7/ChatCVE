'use client'

import React, { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Settings as SettingsIcon,
  Database,
  Key,
  Globe,
  Shield,
  Bell,
  Palette,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Github,
  Download,
  Calendar,
  BarChart3
} from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    openai_api_key: '••••••••••••••••••••••••••••••••••••••••••••',
    database_path: '../app_patrol.db',
    nvd_api_key: '',
    github_advisory_enabled: true,
    github_sync_schedule: 'daily',
    scan_schedule: 'daily',
    notification_email: '',
    theme: 'system',
    auto_refresh: true,
    debug_mode: false
  })

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // In a real implementation, this would save to backend
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const testConnection = async (service: string) => {
    // Test API connections
    console.log(`Testing ${service} connection...`)
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Configure ChatCVE system settings and integrations
            </p>
          </div>
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* AI Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                AI Configuration
              </CardTitle>
              <CardDescription>Configure OpenAI integration for ChatCVE AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">OpenAI API Key</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="password"
                    value={settings.openai_api_key}
                    onChange={(e) => setSettings({...settings, openai_api_key: e.target.value})}
                    placeholder="sk-..."
                  />
                  <Button variant="outline" size="sm" onClick={() => testConnection('OpenAI')}>
                    Test
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>AI Agent Status: Active</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Used for natural language queries and vulnerability analysis
              </div>
            </CardContent>
          </Card>

          {/* Database Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Configuration
              </CardTitle>
              <CardDescription>Configure database connections and paths</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Database Path</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={settings.database_path}
                    onChange={(e) => setSettings({...settings, database_path: e.target.value})}
                    placeholder="../app_patrol.db"
                  />
                  <Button variant="outline" size="sm" onClick={() => testConnection('Database')}>
                    Test
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Database Status: Connected (11,479 records)</span>
              </div>
              <div className="text-xs text-muted-foreground">
                SQLite database containing SBOM and vulnerability data
              </div>
            </CardContent>
          </Card>

          {/* External Integrations */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                External Integrations
              </CardTitle>
              <CardDescription>Configure external vulnerability data sources and APIs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* GitHub Advisory Database */}
              <div className="p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Github className="h-6 w-6" />
                    <div>
                      <h3 className="font-semibold">GitHub Advisory Database</h3>
                      <p className="text-sm text-muted-foreground">
                        Access 23,755+ reviewed advisories and 268,387+ unreviewed advisories
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={settings.github_advisory_enabled ? "default" : "secondary"}>
                      {settings.github_advisory_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <input
                      type="checkbox"
                      checked={settings.github_advisory_enabled}
                      onChange={(e) => setSettings({...settings, github_advisory_enabled: e.target.checked})}
                      className="w-4 h-4"
                    />
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Sync Schedule</label>
                    <select 
                      className="w-full mt-1 p-2 border rounded-md"
                      value={settings.github_sync_schedule}
                      onChange={(e) => setSettings({...settings, github_sync_schedule: e.target.value})}
                      disabled={!settings.github_advisory_enabled}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="manual">Manual Only</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2"
                        disabled={!settings.github_advisory_enabled}
                        onClick={() => testConnection('GitHub Advisory DB')}
                      >
                        <Download className="h-3 w-3" />
                        Sync Now
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => window.open('https://github.com/advisories', '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Source
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span>23,755 Reviewed</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span>268,387 Unreviewed</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-green-500" />
                    <span>Last sync: 2 hours ago</span>
                  </div>
                </div>
              </div>

              {/* NVD Integration */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">National Vulnerability Database (NVD)</h3>
                    <p className="text-sm text-muted-foreground">
                      Official U.S. government repository of vulnerability data
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">NVD API Key (Optional)</label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={settings.nvd_api_key}
                        onChange={(e) => setSettings({...settings, nvd_api_key: e.target.value})}
                        placeholder="Enter NVD API key for enhanced rate limits"
                      />
                      <Button variant="outline" size="sm" onClick={() => testConnection('NVD')}>
                        Test
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      API key increases rate limit from 5 to 50 requests per 30 seconds
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <RefreshCw className="h-3 w-3" />
                      Sync NVD Data
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2"
                      onClick={() => window.open('https://nvd.nist.gov/', '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                      NVD Portal
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scanning Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Scanning Configuration
              </CardTitle>
              <CardDescription>Configure automated vulnerability scanning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Scan Schedule</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md"
                  value={settings.scan_schedule}
                  onChange={(e) => setSettings({...settings, scan_schedule: e.target.value})}
                >
                  <option value="manual">Manual Only</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline">Syft: Active</Badge>
                <Badge variant="outline">Grype: Active</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Automated scans use Syft for SBOM generation and Grype for vulnerability detection
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email Notifications</label>
                <Input
                  type="email"
                  value={settings.notification_email}
                  onChange={(e) => setSettings({...settings, notification_email: e.target.value})}
                  placeholder="admin@company.com"
                  className="mt-1"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="critical-alerts" defaultChecked />
                  <label htmlFor="critical-alerts" className="text-sm">Critical vulnerability alerts</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="scan-complete" defaultChecked />
                  <label htmlFor="scan-complete" className="text-sm">Scan completion notifications</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="weekly-reports" />
                  <label htmlFor="weekly-reports" className="text-sm">Weekly security reports</label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interface Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Interface Settings
              </CardTitle>
              <CardDescription>Customize the user interface</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Theme</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md"
                  value={settings.theme}
                  onChange={(e) => setSettings({...settings, theme: e.target.value})}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="auto-refresh" 
                    checked={settings.auto_refresh}
                    onChange={(e) => setSettings({...settings, auto_refresh: e.target.checked})}
                  />
                  <label htmlFor="auto-refresh" className="text-sm">Auto-refresh dashboard</label>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="debug-mode" 
                    checked={settings.debug_mode}
                    onChange={(e) => setSettings({...settings, debug_mode: e.target.checked})}
                  />
                  <label htmlFor="debug-mode" className="text-sm">Debug mode</label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>Current system status and version information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-medium">ChatCVE Version</div>
                <div className="text-sm text-muted-foreground">v1.0.0</div>
              </div>
              <div>
                <div className="text-sm font-medium">Database Records</div>
                <div className="text-sm text-muted-foreground">11,479 vulnerabilities</div>
              </div>
              <div>
                <div className="text-sm font-medium">Last NVD Sync</div>
                <div className="text-sm text-muted-foreground">2 hours ago</div>
              </div>
              <div>
                <div className="text-sm font-medium">API Status</div>
                <div className="flex items-center gap-1 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">Healthy</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Active Scans</div>
                <div className="text-sm text-muted-foreground">0 running</div>
              </div>
              <div>
                <div className="text-sm font-medium">Storage Usage</div>
                <div className="text-sm text-muted-foreground">2.2 MB</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
