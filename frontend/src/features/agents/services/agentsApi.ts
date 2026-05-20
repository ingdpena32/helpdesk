import { apiDelete, apiGet, apiPost, apiPut } from '../../../shared/api/client'
import type { Paginated } from '../../../shared/api/types'
import type { Ticket } from '../../tickets/types/ticket.types'
import type { Agent, Department } from '../types/agent.types'

export type AgentListFilters = {
  q?: string
}

export function listAgents(filters: AgentListFilters = {}): Promise<Paginated<Agent>> {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  const qs = params.toString()
  return apiGet<Paginated<Agent>>(`/api/agents${qs ? `?${qs}` : ''}`)
}

export type CreateAgentPayload = {
  email: string
  password: string
  corporate_email?: string
  full_name?: string
  phone?: string
  document_number?: string
  gender?: string
  department_id?: number | null
  /** Rol de permisos: admin | agent */
  role?: 'admin' | 'agent'
}

export function createAgent(payload: CreateAgentPayload): Promise<Agent> {
  return apiPost<Agent>('/api/agents', payload)
}

export type UpdateAgentPayload = {
  full_name?: string | null
  phone?: string | null
  gender?: string | null
  corporate_email?: string
  document_number?: string | null
  professional_role?: string | null
  department_id?: number | null
  is_active?: boolean
  role?: string
  password?: string
}

export function updateAgent(agentId: number, payload: UpdateAgentPayload): Promise<Agent> {
  return apiPut<Agent>(`/api/agents/${agentId}`, payload)
}

export function deleteAgent(agentId: number): Promise<void> {
  return apiDelete(`/api/agents/${agentId}`)
}

export function listDepartments(): Promise<{ results: Department[] }> {
  return apiGet<{ results: Department[] }>('/api/departments')
}

export function transferTicket(ticketId: number, assigneeId: number): Promise<Ticket> {
  return apiPut<Ticket>(`/api/tickets/${ticketId}/transfer`, { assignee_id: assigneeId })
}
