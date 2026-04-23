import { apiGet } from '../../../shared/api/client'
import type { Paginated } from '../../../shared/api/types'
import type { Agent } from '../types/agent.types'

export function listAgents(): Promise<Paginated<Agent>> {
  return apiGet<Paginated<Agent>>('/api/agents/')
}
