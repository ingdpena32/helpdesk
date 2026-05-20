export type TicketStatus = 'open' | 'in_progress' | 'closed'

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

/** Nombre de categoría (catálogo dinámico en BD). */
export type TicketCategoryName = string

export const TICKET_AI_STATUS_OPTIONS = [
  { value: 'Sin IA', label: 'Sin IA' },
  { value: 'Procesando IA', label: 'Procesando IA' },
  { value: 'Clasificado', label: 'Clasificado' },
  { value: 'Error', label: 'Error' },
] as const

export const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
]

export type TicketAttachmentMeta = {
  id: number
  original_filename: string
  mime_type: string
  size_bytes: number
  download_url: string
  comment_id: number | null
}

export type TicketAuditEntry = {
  id: number
  ticket_id: number
  event_type: string
  actor_user_id: number | null
  metadata: Record<string, unknown>
  created_at: string
}

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
  transferred_by?: number | null
  transferred_at?: string | null
  created_by?: number
  resolution?: string | null
  /** Ingesta por correo (null si ticket manual o legado sin datos). */
  sender_name?: string | null
  sender_email?: string | null
  sender_user_id?: number | null
  /** Clasificación IA (tickets por correo): Sin IA, Procesando IA, Clasificado, Error. */
  ai_status?: string | null
  ai_motivo?: string | null
  attachments?: TicketAttachmentMeta[]
  audit_log?: TicketAuditEntry[]
}

export type TicketFilters = {
  status?: TicketStatus
  priority?: TicketPriority
  assigned_to?: number
  /** Filtro por categoría exacta (texto) */
  category?: string
  /** Búsqueda libre (título, descripción, categoría, correo, ID…) */
  q?: string
  page?: number
  page_size?: number
}

/** Creación: el backend toma el creador del token (no se envía created_by). */
export type CreateTicketPayload = {
  title: string
  description: string
  priority: TicketPriority
  category: TicketCategoryName
}

export type PatchTicketPayload = {
  status?: TicketStatus
  assigned_to?: number | null
  resolution?: string | null
  priority?: TicketPriority
  category?: TicketCategoryName
  ai_status?: string
}

export type TicketComment = {
  id: number
  user_id: number | null
  username: string
  content: string
  created_at: string
}
