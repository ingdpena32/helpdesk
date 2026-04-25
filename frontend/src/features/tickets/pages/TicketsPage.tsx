import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError } from '../../../shared/api/client'
import { useAuth } from '../../auth/context/AuthContext'
import DeleteTicketConfirmModal from '../components/DeleteTicketConfirmModal'
import { useTicketsQuery } from '../hooks/useTicketsQuery'
import { deleteTicket } from '../services/ticketsApi'
import type { TicketStatus, TicketPriority } from '../types/ticket.types'

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

function parseDeleteError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'No se pudo eliminar el ticket.'
  try {
    const body = JSON.parse(err.message) as { error?: string }
    if (typeof body.error === 'string') return body.error
  } catch {
    /* no JSON */
  }
  return err.message || 'No se pudo eliminar el ticket.'
}

function TicketsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const statusId = useId()
  const priorityId = useId()
  const [status, setStatus] = useState<TicketStatus | ''>('')
  const [priority, setPriority] = useState<TicketPriority | ''>('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data, isLoading, error } = useTicketsQuery({
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  })

  const isAdmin = user?.role === 'admin'
  const colSpan = isAdmin ? 6 : 5

  const deleteMutation = useMutation({
    mutationFn: deleteTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['tickets', 'count', 'open'] })
      setDeleteTarget(null)
      setDeleteError(null)
    },
    onError: (e: unknown) => {
      setDeleteError(parseDeleteError(e))
    },
  })

  return (
    <section className="space-y-10">
      <DeleteTicketConfirmModal
        open={deleteTarget !== null}
        title={deleteTarget?.title ?? ''}
        loading={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
        onConfirm={() => {
          if (deleteTarget) {
            setDeleteError(null)
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />

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
              {isAdmin ? <th className="px-6 py-4 text-right">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                  Cargando…
                </td>
              </tr>
            ) : null}
            {error ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                  {(error as Error).message}
                </td>
              </tr>
            ) : null}
            {data && data.results.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                  No hay tickets con los filtros actuales.
                </td>
              </tr>
            ) : null}
            {data?.results.map((t) => (
              <tr key={t.id} className="border-b border-white/5 text-sm text-on-surface">
                <td className="px-6 py-4 font-medium">
                  <Link to={`/tickets/${t.id}`} className="text-primary hover:underline">
                    {t.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-on-surface-variant">{categoryLabel(t)}</td>
                <td className="px-6 py-4 text-on-surface-variant">{statusLabel(t.status)}</td>
                <td className="px-6 py-4 text-on-surface-variant">{priorityLabel(t.priority)}</td>
                <td className="px-6 py-4 text-on-surface-variant">{formatDate(t.updated_at)}</td>
                {isAdmin ? (
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleteTarget({ id: t.id, title: t.title })
                      }}
                      className="text-xs font-semibold text-red-300 hover:text-red-200 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default TicketsPage
