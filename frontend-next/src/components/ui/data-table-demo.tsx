/**
 * DataTable Component - Reusable Data Table with Sorting, Filtering, and Pagination
 * 
 * This component can be used throughout the ChatCVE application for displaying
 * tabular data with advanced features like:
 * 
 * - Sorting by columns
 * - Search/filtering
 * - Pagination
 * - Custom cell rendering
 * - Row click handlers
 * - Action buttons
 * 
 * Usage Examples:
 * 
 * 1. Basic Usage:
 * <DataTable
 *   data={myData}
 *   columns={columnConfig}
 *   title="My Data"
 * />
 * 
 * 2. With Actions:
 * <DataTable
 *   data={myData}
 *   columns={columnConfig}
 *   renderActions={(item) => <Button>Edit</Button>}
 *   onRowClick={(item) => console.log(item)}
 * />
 * 
 * 3. With Custom Empty State:
 * <DataTable
 *   data={myData}
 *   columns={columnConfig}
 *   emptyState={<CustomEmptyComponent />}
 * />
 * 
 * Column Configuration:
 * const columns = [
 *   {
 *     key: 'name',
 *     label: 'Name',
 *     sortable: true,
 *     render: (item) => <strong>{item.name}</strong>
 *   },
 *   {
 *     key: 'status',
 *     label: 'Status',
 *     sortable: true,
 *     render: (item) => <Badge>{item.status}</Badge>
 *   }
 * ]
 * 
 * This component is used in:
 * - Scan Management (current implementation)
 * - CVE Explorer (potential use)
 * - Workspace items (potential use)
 * - Database query results (potential use)
 * - Any other tabular data display
 */

export { DataTable } from './data-table'
export type { DataTableColumn, DataTableProps } from './data-table'


