import { useQuery } from '@tanstack/react-query'

import { apiGet } from '../../../shared/api/client'
import type { Paginated } from '../../../shared/api/types'
import type { Ticket } from '../../tickets/types/ticket.types'

async function fetchOpenTicketsCount(): Promise<number> {
  const data = await apiGet<Paginated<Ticket>>('/api/tickets/?status=open&page_size=1')
  return data.count
}

export function useOpenTicketsCount() {
  const { data, isLoading, error } = useQuery<number>({
    queryKey: ['tickets', 'count', 'open'],
    queryFn: fetchOpenTicketsCount,
  })

  return {
    count: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
