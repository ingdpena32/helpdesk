import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { formatApiError } from '../../../shared/api/formatApiError'
import { fetchDashboardStats } from '../services/dashboardApi'
import { toDashboardQueryFilters } from '../utils/dashboardFilters'
import type { DashboardStatsFilters } from '../types/dashboard.types'

export type { DashboardStatsFilters } from '../types/dashboard.types'

/**
 * KPIs del dashboard vía endpoint agregado (una petición, filtros incl. rango de fechas).
 */
export function useDashboardStats(filters: DashboardStatsFilters) {
  const enabled = filters.enabled !== false
  const queryFilters = useMemo(() => toDashboardQueryFilters(filters), [filters])

  const key = useMemo(
    () => JSON.stringify(queryFilters),
    [queryFilters],
  )

  const query = useQuery({
    queryKey: ['dashboard', 'stats', key],
    enabled,
    queryFn: () => fetchDashboardStats(queryFilters),
  })

  return {
    totalCount: query.data?.total ?? null,
    openCount: query.data?.open ?? null,
    inProgressCount: query.data?.in_progress ?? null,
    closedCount: query.data?.closed ?? null,
    highPriorityCount: query.data?.high_priority ?? null,
    avgResolutionHours: query.data?.avg_resolution_hours ?? null,
    closedPopulation: query.data?.closed ?? null,
    sampleSize: query.data?.closed ?? 0,
    loading: query.isLoading,
    error: formatApiError(query.error),
  }
}
