import type { TicketPriority } from '../../tickets/types/ticket.types'

export type DashboardStatsFilters = {
  assignedTo?: number
  category?: string
  priority?: TicketPriority
  createdFrom?: string
  createdTo?: string
  enabled?: boolean
}

export type DashboardQueryFilters = {
  assigned_to?: number
  category?: string
  priority?: TicketPriority
  created_from?: string
  created_to?: string
}

export type DashboardStatsResponse = {
  total: number
  open: number
  in_progress: number
  closed: number
  high_priority: number
  avg_resolution_hours: number | null
}

export type AgentBreakdownAgent = {
  agent_id: number | null
  agent_name: string
  by_status: Record<string, number>
  total: number
}

export type AgentBreakdownResponse = {
  agents: AgentBreakdownAgent[]
  statuses: string[]
  status_labels: Record<string, string>
}

export type RecentActivityItem = {
  id: string
  ticket_id: number
  event_type: string
  occurred_at: string
  actor_name: string
  ticket_title: string
  summary: string
}

export type RecentActivityResponse = {
  results: RecentActivityItem[]
}
