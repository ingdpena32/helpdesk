import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import type { Paginated } from '../../../shared/api/types'
import { listTickets } from '../../tickets/services/ticketsApi'
import type { Ticket, TicketPriority } from '../../tickets/types/ticket.types'

export type DashboardStatsFilters = {
  /** Si se omite, la API cuenta todos los tickets del resto de filtros. */
  assignedTo?: number
  category?: string
  priority?: TicketPriority
  enabled?: boolean
}

function avgResolutionHoursFromClosed(tickets: Ticket[]): number | null {
  let sumH = 0
  let n = 0
  for (const t of tickets) {
    if (!t.closed_at) continue
    const a = new Date(t.created_at).getTime()
    const b = new Date(t.closed_at).getTime()
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      sumH += (b - a) / 3_600_000
      n += 1
    }
  }
  return n > 0 ? sumH / n : null
}

function baseListArgs(f: DashboardStatsFilters) {
  return {
    assigned_to: f.assignedTo,
    category: f.category?.trim() || undefined,
    priority: f.priority,
    page: 1,
  }
}

/**
 * KPIs derivados de la API de listado de tickets: recalculan al cambiar filtros (misma queryKey).
 */
export function useDashboardStats(filters: DashboardStatsFilters) {
  const enabled = filters.enabled !== false
  const key = useMemo(
    () =>
      JSON.stringify({
        a: filters.assignedTo,
        c: filters.category,
        p: filters.priority,
      }),
    [filters.assignedTo, filters.category, filters.priority],
  )

  const queries = useQueries({
    queries: [
      {
        queryKey: ['dashboard', 'count', 'open', key],
        enabled,
        queryFn: () =>
          listTickets({
            ...baseListArgs(filters),
            status: 'open',
            page_size: 1,
          }),
        select: (d: Paginated<Ticket>) => d.count,
      },
      {
        queryKey: ['dashboard', 'count', 'in_progress', key],
        enabled,
        queryFn: () =>
          listTickets({
            ...baseListArgs(filters),
            status: 'in_progress',
            page_size: 1,
          }),
        select: (d: Paginated<Ticket>) => d.count,
      },
      {
        queryKey: ['dashboard', 'count', 'closed', key],
        enabled,
        queryFn: () =>
          listTickets({
            ...baseListArgs(filters),
            status: 'closed',
            page_size: 1,
          }),
        select: (d: Paginated<Ticket>) => d.count,
      },
      {
        queryKey: ['dashboard', 'count', 'total', key],
        enabled,
        queryFn: () =>
          listTickets({
            ...baseListArgs(filters),
            page_size: 1,
          }),
        select: (d: Paginated<Ticket>) => d.count,
      },
      {
        queryKey: ['dashboard', 'closed-sample', key],
        enabled,
        queryFn: () =>
          listTickets({
            ...baseListArgs(filters),
            status: 'closed',
            page_size: 100,
          }),
        select: (d: Paginated<Ticket>) => ({
          avgHours: avgResolutionHoursFromClosed(d.results),
          closedTotal: d.count,
          sampleSize: d.results.length,
        }),
      },
    ],
  })

  const [openQ, inProgressQ, closedQ, totalQ, closedSampleQ] = queries

  const loading = queries.some((q) => q.isLoading)
  const error = queries.find((q) => q.error)?.error as Error | undefined

  return {
    openCount: openQ.data ?? null,
    inProgressCount: inProgressQ.data ?? null,
    closedCount: closedQ.data ?? null,
    totalCount: totalQ.data ?? null,
    avgResolutionHours: closedSampleQ.data?.avgHours ?? null,
    closedPopulation: closedSampleQ.data?.closedTotal ?? null,
    sampleSize: closedSampleQ.data?.sampleSize ?? 0,
    loading,
    error: error?.message ?? null,
  }
}
