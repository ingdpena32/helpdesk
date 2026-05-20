import type { DashboardQueryFilters, DashboardStatsFilters } from '../types/dashboard.types'

export function toDashboardQueryFilters(f: DashboardStatsFilters): DashboardQueryFilters {
  return {
    assigned_to: f.assignedTo,
    category: f.category?.trim() || undefined,
    priority: f.priority,
    created_from: f.createdFrom,
    created_to: f.createdTo,
  }
}
