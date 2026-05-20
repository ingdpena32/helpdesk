import { useQuery } from '@tanstack/react-query'

import type { Paginated } from '../../../shared/api/types'
import { listTickets } from '../services/ticketsApi'
import type { Ticket, TicketFilters } from '../types/ticket.types'

function ticketsQueryKey(filters?: TicketFilters) {
  return [
    'tickets',
    filters?.status ?? '',
    filters?.priority ?? '',
    filters?.category ?? '',
    filters?.q ?? '',
    filters?.assigned_to ?? '',
    filters?.page ?? 1,
    filters?.page_size ?? 20,
  ] as const
}

export function useTicketsQuery(filters?: TicketFilters) {
  const hasSearch = Boolean(filters?.q?.trim())
  return useQuery<Paginated<Ticket>>({
    queryKey: ticketsQueryKey(filters),
    queryFn: () => listTickets(filters ?? {}),
    staleTime: hasSearch ? 0 : 30_000,
    placeholderData: undefined,
  })
}
