export type TicketStatus = 'open' | 'in_progress' | 'closed'

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

export type Ticket = {
  id: number
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: number | null
  category_detail?: { id: number; name: string; description: string } | null
  created_at: string
  updated_at: string
  closed_at: string | null
  assigned_to: number | null
}

export type TicketFilters = {
  status?: TicketStatus
  priority?: TicketPriority
  assigned_to?: number
  category?: number
}
