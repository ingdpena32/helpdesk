import { useQuery } from '@tanstack/react-query'

import type { Paginated } from '../../../shared/api/types'
import { listAgents, type AgentListFilters } from '../services/agentsApi'
import type { Agent } from '../types/agent.types'

export function useAgentsQuery(filters?: AgentListFilters) {
  const hasSearch = Boolean(filters?.q?.trim())
  return useQuery<Paginated<Agent>>({
    queryKey: ['agents', filters?.q ?? ''] as const,
    queryFn: () => listAgents(filters ?? {}),
    staleTime: hasSearch ? 0 : 30_000,
    placeholderData: undefined,
  })
}
