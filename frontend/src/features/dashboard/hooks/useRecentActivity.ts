import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { formatApiError } from '../../../shared/api/formatApiError'
import { fetchRecentActivity } from '../services/dashboardApi'
import type { DashboardStatsFilters } from '../types/dashboard.types'
import { toDashboardQueryFilters } from '../utils/dashboardFilters'

export function useRecentActivity(filters: DashboardStatsFilters, limit = 15) {
  const enabled = filters.enabled !== false
  const queryFilters = useMemo(() => toDashboardQueryFilters(filters), [filters])
  const key = useMemo(() => JSON.stringify({ ...queryFilters, limit }), [queryFilters, limit])

  const query = useQuery({
    queryKey: ['dashboard', 'recent-activity', key],
    enabled,
    queryFn: () => fetchRecentActivity(queryFilters, limit),
  })

  return {
    items: query.data?.results ?? [],
    loading: query.isLoading,
    error: formatApiError(query.error),
  }
}
