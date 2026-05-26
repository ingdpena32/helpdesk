import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { formatApiError } from '../../../shared/api/formatApiError'
import { fetchAgentBreakdown } from '../services/dashboardApi'
import type { DashboardStatsFilters } from '../types/dashboard.types'
import { toDashboardQueryFilters } from '../utils/dashboardFilters'

export function useAgentStatusChart(filters: DashboardStatsFilters) {
  const enabled = filters.enabled !== false
  const queryFilters = useMemo(() => toDashboardQueryFilters(filters), [filters])
  const key = useMemo(() => JSON.stringify(queryFilters), [queryFilters])

  const query = useQuery({
    queryKey: ['dashboard', 'agent-breakdown', key],
    enabled,
    queryFn: () => fetchAgentBreakdown(queryFilters),
  })

  const maxTotal = useMemo(() => {
    const agents = query.data?.agents ?? []
    return agents.reduce((m, a) => Math.max(m, a.total), 0)
  }, [query.data?.agents])

  return {
    agents: query.data?.agents ?? [],
    statuses: query.data?.statuses ?? [],
    statusLabels: query.data?.status_labels ?? {},
    maxTotal,
    loading: query.isLoading,
    error: formatApiError(query.error),
  }
}
