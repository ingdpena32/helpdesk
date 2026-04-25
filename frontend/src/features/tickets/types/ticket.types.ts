export type TicketStatus = 'open' | 'in_progress' | 'closed'

export type TicketPriority = 'low' | 'medium' | 'high'

/** Categorías válidas (mismo contrato que el backend). */
export type TicketCategory =
  | 'ERP'
  | 'Infraestructura'
  | 'Soporte técnico'
  | 'Bases de datos'
  | 'Desarrollo'

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'ERP', label: 'ERP' },
  { value: 'Infraestructura', label: 'Infraestructura' },
  { value: 'Soporte técnico', label: 'Soporte técnico' },
  { value: 'Bases de datos', label: 'Bases de datos' },
  { value: 'Desarrollo', label: 'Desarrollo' },
]

export type Ticket = {
  id: number
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  /** Texto tal como lo guarda PostgreSQL / API Python */
  category: string | null
  /** Obsoleto si la API solo envía `category`; se mantiene por compatibilidad */
  category_detail?: { id: number; name: string; description: string } | null
  created_at: string
  updated_at: string
  closed_at: string | null
  assigned_to: number | null
  created_by?: number
  resolution?: string | null
}

export type TicketFilters = {
  status?: TicketStatus
  priority?: TicketPriority
  assigned_to?: number
  /** Filtro por categoría exacta (texto) */
  category?: string
}

/** Creación: el backend toma el creador del token (no se envía created_by). */
export type CreateTicketPayload = {
  title: string
  description: string
  priority: TicketPriority
  category: TicketCategory
}

export type PatchTicketPayload = {
  status?: TicketStatus
  assigned_to?: number | null
  resolution?: string | null
}

export type TicketComment = {
  id: number
  user_id: number
  username: string
  content: string
  created_at: string
}
