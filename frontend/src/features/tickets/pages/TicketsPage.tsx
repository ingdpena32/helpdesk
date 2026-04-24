import { useId, useState } from 'react'

import type { TicketStatus, TicketPriority } from '../types/ticket.types'
import { useTicketsQuery } from '../hooks/useTicketsQuery'

const statusOptions: { value: TicketStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'closed', label: 'Cerrado' },
]

const priorityOptions: { value: TicketPriority | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
]

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function categoryLabel(t: { category: string | null; category_detail?: { name: string } | null }) {
  if (typeof t.category === 'string' && t.category.trim()) return t.category
  return t.category_detail?.name ?? '—'
}

/** La API y la BD usan inglés; en pantalla mostramos español. */
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  closed: 'Cerrado',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status.replaceAll('_', ' ')
}

function priorityLabel(priority: string) {
  return PRIORITY_LABEL[priority] ?? priority
}

function TicketsPage() {
  const statusId = useId()
  const priorityId = useId()
  const [status, setStatus] = useState<TicketStatus | ''>('')
  const [priority, setPriority] = useState<TicketPriority | ''>('')

  const { data, isLoading, error } = useTicketsQuery({
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  })

  return (
    <section className="space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">Tickets</h2>
          <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
            Listado conectado a la API del backend (tickets en PostgreSQL).
          </p>
        </div>
      </div>

      <div className="dashboard-range-pill flex flex-col gap-2 p-2 sm:flex-row sm:flex-wrap sm:items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-surface-container/50 px-3 py-2 sm:min-w-[11rem]">
          <label htmlFor={statusId} className="shrink-0 text-xs font-semibold text-on-surface-variant">
            Estado
          </label>
          <select
            id={statusId}
            value={status}
            onChange={(e) => setStatus(e.target.value as TicketStatus | '')}
            className="ml-auto min-w-0 flex-1 border-0 bg-transparent text-right text-xs font-medium text-on-surface focus:ring-0"
          >
            {statusOptions.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-surface-container/50 px-3 py-2 sm:min-w-[11rem]">
          <label htmlFor={priorityId} className="shrink-0 text-xs font-semibold text-on-surface-variant">
            Prioridad
          </label>
          <select
            id={priorityId}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority | '')}
            className="ml-auto min-w-0 flex-1 border-0 bg-transparent text-right text-xs font-medium text-on-surface focus:ring-0"
          >
            {priorityOptions.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="dashboard-panel overflow-hidden p-0">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="border-b border-white/10 bg-surface-container-low/60 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              <th className="px-6 py-4">Ticket</th>
              <th className="px-6 py-4">Categoría</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4">Prioridad</th>
              <th className="px-6 py-4">Actualización</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                  Cargando…
                </td>
              </tr>
            ) : null}
            {error ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                  {(error as Error).message}
                </td>
              </tr>
            ) : null}
            {data && data.results.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                  No hay tickets con los filtros actuales.
                </td>
              </tr>
            ) : null}
            {data?.results.map((t) => (
              <tr key={t.id} className="border-b border-white/5 text-sm text-on-surface">
                <td className="px-6 py-4 font-medium">{t.title}</td>
                <td className="px-6 py-4 text-on-surface-variant">{categoryLabel(t)}</td>
                <td className="px-6 py-4 text-on-surface-variant">{statusLabel(t.status)}</td>
                <td className="px-6 py-4 text-on-surface-variant">{priorityLabel(t.priority)}</td>
                <td className="px-6 py-4 text-on-surface-variant">{formatDate(t.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default TicketsPage
