import { apiGet } from '../../../shared/api/client'
import type {
  AgentBreakdownResponse,
  DashboardQueryFilters,
  DashboardStatsResponse,
  RecentActivityResponse,
} from '../types/dashboard.types'

function toSearchParams(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function fetchDashboardStats(filters: DashboardQueryFilters = {}): Promise<DashboardStatsResponse> {
  const qs = toSearchParams(filters)
  return apiGet<DashboardStatsResponse>(`/api/dashboard/stats${qs}`)
}

export function fetchAgentBreakdown(filters: DashboardQueryFilters = {}): Promise<AgentBreakdownResponse> {
  const qs = toSearchParams(filters)
  return apiGet<AgentBreakdownResponse>(`/api/dashboard/agent-breakdown${qs}`)
}

export function fetchRecentActivity(
  filters: DashboardQueryFilters = {},
  limit = 15,
): Promise<RecentActivityResponse> {
  const qs = toSearchParams({ ...filters, limit })
  return apiGet<RecentActivityResponse>(`/api/dashboard/recent-activity${qs}`)
}
