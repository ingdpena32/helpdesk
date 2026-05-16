import { apiGet } from '../../../shared/api/client'

export type TicketsExportResponse = {
  schema: string
  generated_at: string
  ticket_count: number
  tickets: unknown[]
}

export function fetchTicketsExport(): Promise<TicketsExportResponse> {
  return apiGet<TicketsExportResponse>('/api/admin/tickets-export')
}
