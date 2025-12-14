import { Layout } from 'react-grid-layout'

export interface WidgetConfig {
  id: string
  title: string
  description: string
  minW: number
  minH: number
  maxW?: number
  maxH?: number
  component: string
}

// Define available widgets
export const WIDGET_REGISTRY: Record<string, WidgetConfig> = {
  'total-vulnerabilities': {
    id: 'total-vulnerabilities',
    title: 'Total Vulnerabilities',
    description: 'Total count of all vulnerabilities',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    component: 'TotalVulnerabilities',
  },
  'critical-issues': {
    id: 'critical-issues',
    title: 'Critical Issues',
    description: 'Critical severity vulnerabilities requiring immediate attention',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    component: 'CriticalIssues',
  },
  'high-priority': {
    id: 'high-priority',
    title: 'High Priority',
    description: 'High severity vulnerabilities to address soon',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    component: 'HighPriority',
  },
  'security-score': {
    id: 'security-score',
    title: 'Security Score',
    description: 'Overall security posture score',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    component: 'SecurityScore',
  },
  'severity-distribution': {
    id: 'severity-distribution',
    title: 'Severity Distribution',
    description: 'Donut chart showing vulnerabilities by severity level',
    minW: 3,
    minH: 4,
    maxH: 8,
    component: 'SeverityDistributionChart',
  },
  'scan-history': {
    id: 'scan-history',
    title: 'Scan History',
    description: 'Area chart showing vulnerability trends over time',
    minW: 4,
    minH: 4,
    maxH: 8,
    component: 'ScanHistoryChart',
  },
  'top-images': {
    id: 'top-images',
    title: 'Top Vulnerable Images',
    description: 'Bar chart of container images with most vulnerabilities',
    minW: 3,
    minH: 5,
    maxH: 10,
    component: 'TopImagesChart',
  },
  'top-packages': {
    id: 'top-packages',
    title: 'Top Vulnerable Packages',
    description: 'Bar chart of packages with most vulnerabilities',
    minW: 3,
    minH: 5,
    maxH: 10,
    component: 'TopPackagesChart',
  },
  'recent-activity': {
    id: 'recent-activity',
    title: 'Recent Activity',
    description: 'List of recent scan activity and events',
    minW: 3,
    minH: 4,
    maxH: 8,
    component: 'RecentActivity',
  },
  'quick-actions': {
    id: 'quick-actions',
    title: 'Quick Actions',
    description: 'Shortcuts to common actions',
    minW: 3,
    minH: 3,
    maxH: 5,
    component: 'QuickActions',
  },
}

// Default layout (12-column grid)
export const DEFAULT_LAYOUT: Layout[] = [
  // Top row: 4 stat cards
  { i: 'total-vulnerabilities', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'critical-issues', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'high-priority', x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'security-score', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  // Charts row
  { i: 'severity-distribution', x: 0, y: 3, w: 6, h: 5, minW: 3, minH: 4 },
  { i: 'scan-history', x: 6, y: 3, w: 6, h: 5, minW: 4, minH: 4 },
  { i: 'top-images', x: 0, y: 8, w: 6, h: 6, minW: 3, minH: 5 },
  { i: 'top-packages', x: 6, y: 8, w: 6, h: 6, minW: 3, minH: 5 },
  { i: 'recent-activity', x: 0, y: 14, w: 6, h: 5, minW: 3, minH: 4 },
  { i: 'quick-actions', x: 6, y: 14, w: 6, h: 5, minW: 3, minH: 3 },
]

// Default visible widgets
export const DEFAULT_VISIBLE_WIDGETS = Object.keys(WIDGET_REGISTRY)

// Responsive breakpoints for react-grid-layout
export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }
export const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }
export const GRID_ROW_HEIGHT = 50
export const GRID_MARGIN: [number, number] = [16, 16]

// localStorage keys
export const STORAGE_KEYS = {
  LAYOUT: 'chatcve_dashboard_layout',
  HIDDEN_WIDGETS: 'chatcve_dashboard_hidden_widgets',
}

// Preference keys for backend
export const PREFERENCE_KEYS = {
  LAYOUT: 'dashboard_layout',
  HIDDEN_WIDGETS: 'dashboard_hidden_widgets',
}
