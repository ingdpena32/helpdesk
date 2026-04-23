import { useQuery } from '@tanstack/react-query'

import type { Paginated } from '../../../shared/api/types'
import { listTickets } from '../services/ticketsApi'
import type { Ticket, TicketFilters } from '../types/ticket.types'

export function useTicketsQuery(filters?: TicketFilters) {
  return useQuery<Paginated<Ticket>>({
    queryKey: ['tickets', filters],
    queryFn: () => listTickets(filters ?? {}),
  })
}
