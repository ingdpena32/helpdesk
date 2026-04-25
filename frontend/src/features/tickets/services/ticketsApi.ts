import { apiDelete, apiGet, apiPatch, apiPost } from '../../../shared/api/client'
import type { Paginated } from '../../../shared/api/types'
import type {
  CreateTicketPayload,
  PatchTicketPayload,
  Ticket,
  TicketComment,
  TicketFilters,
} from '../types/ticket.types'

function toSearchParams(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function listTickets(filters: TicketFilters = {}): Promise<Paginated<Ticket>> {
  const qs = toSearchParams(filters)
  return apiGet<Paginated<Ticket>>(`/api/tickets${qs}`)
}

export function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  return apiPost<Ticket>('/api/tickets', payload)
}

export function getTicket(id: number): Promise<Ticket> {
  return apiGet<Ticket>(`/api/tickets/${id}`)
}

export function patchTicket(id: number, payload: PatchTicketPayload): Promise<Ticket> {
  return apiPatch<Ticket>(`/api/tickets/${id}`, payload)
}

export type TicketCommentsResponse = { results: TicketComment[] }

export function listTicketComments(id: number): Promise<TicketCommentsResponse> {
  return apiGet<TicketCommentsResponse>(`/api/tickets/${id}/comments`)
}

export function postTicketComment(id: number, content: string): Promise<TicketComment> {
  return apiPost<TicketComment>(`/api/tickets/${id}/comments`, { content })
}

export function deleteTicket(id: number): Promise<void> {
  return apiDelete(`/api/tickets/${id}`)
}
