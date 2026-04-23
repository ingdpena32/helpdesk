import { useQuery } from '@tanstack/react-query'

import type { Paginated } from '../../../shared/api/types'
import { listAgents } from '../services/agentsApi'
import type { Agent } from '../types/agent.types'

export function useAgentsQuery() {
  return useQuery<Paginated<Agent>>({
    queryKey: ['agents'],
    queryFn: listAgents,
  })
}
