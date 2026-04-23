import { apiGet } from '../../../shared/api/client'
import type { Paginated } from '../../../shared/api/types'
import type { Ticket, TicketFilters } from '../types/ticket.types'

function toSearchParams(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function listTickets(filters: TicketFilters = {}): Promise<Paginated<Ticket>> {
  return apiGet<Paginated<Ticket>>(`/api/tickets/${toSearchParams(filters)}`)
}
