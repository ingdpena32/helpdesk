import { apiGet, apiPost } from '../../../shared/api/client'
import type { Paginated } from '../../../shared/api/types'
import type { Agent } from '../types/agent.types'

export function listAgents(): Promise<Paginated<Agent>> {
  return apiGet<Paginated<Agent>>('/api/agents')
}

export type CreateAgentPayload = {
  email: string
  password: string
}

export function createAgent(payload: CreateAgentPayload): Promise<Agent> {
  return apiPost<Agent>('/api/agents', payload)
}
