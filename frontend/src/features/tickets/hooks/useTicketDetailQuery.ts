import { useQuery } from '@tanstack/react-query'

import { getTicket } from '../services/ticketsApi'
import type { Ticket } from '../types/ticket.types'

export function useTicketDetailQuery(ticketId: number | undefined) {
  return useQuery<Ticket>({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId as number),
    enabled: typeof ticketId === 'number' && ticketId > 0,
  })
}
