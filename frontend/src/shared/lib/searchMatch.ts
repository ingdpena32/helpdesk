import type { Agent } from '../../features/agents/types/agent.types'
import type { Ticket } from '../../features/tickets/types/ticket.types'

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
}

export function ticketMatchesQuery(ticket: Ticket, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (q === String(ticket.id)) return true
  if (/^\d+$/.test(q) && ticket.id === Number(q)) return true
  return (
    norm(ticket.title).includes(q) ||
    norm(ticket.description).includes(q) ||
    norm(ticket.category).includes(q) ||
    norm(ticket.sender_email).includes(q) ||
    norm(ticket.sender_name).includes(q) ||
    norm(ticket.ai_motivo).includes(q) ||
    norm(ticket.ai_status).includes(q)
  )
}

export function agentMatchesQuery(agent: Agent, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    norm(agent.full_name).includes(q) ||
    norm(agent.username).includes(q) ||
    norm(agent.email).includes(q) ||
    norm(agent.corporate_email).includes(q) ||
    norm(agent.department_name).includes(q) ||
    norm(agent.professional_role).includes(q) ||
    norm(agent.phone).includes(q) ||
    norm(agent.document_number).includes(q)
  )
}
