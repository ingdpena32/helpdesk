import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, apiGetBlob } from '../../../shared/api/client'
import { EditableSelect } from '../../../shared/components/EditableSelect'
import { useAuth } from '../../auth/context/AuthContext'
import { listAgents, transferTicket } from '../../agents/services/agentsApi'
import { useCategoriesQuery } from '../../categories/hooks/useCategoriesQuery'
import DeleteTicketConfirmModal from '../components/DeleteTicketConfirmModal'
import { useTicketDetailQuery } from '../hooks/useTicketDetailQuery'
import { deleteTicket, listTicketComments, patchTicket, postTicketComment } from '../services/ticketsApi'
import type {
  PatchTicketPayload,
  TicketAuditEntry,
  TicketComment,
  TicketPriority,
  TicketStatus,
} from '../types/ticket.types'
import { TICKET_AI_STATUS_OPTIONS, TICKET_PRIORITY_OPTIONS } from '../types/ticket.types'

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  closed: 'Cerrado',
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
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

function auditSummary(entry: TicketAuditEntry): string {
  if (entry.event_type === 'ticket_transfer') {
    const m = entry.metadata as { from_user_id?: number | null; to_user_id?: number }
    return `Transferencia → usuario #${m.to_user_id ?? '—'}`
  }
  if (entry.event_type === 'ticket_updated') {
    return 'Actualización de ticket'
  }
  return entry.event_type
}

function parseApiError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Error inesperado.'
  try {
    const body = JSON.parse(err.message) as { error?: string }
    if (typeof body.error === 'string') return body.error
  } catch {
    /* no JSON */
  }
  return err.message || 'Error.'
}

export default function TicketDetailPage() {
  const { ticketId: ticketIdParam } = useParams<{ ticketId: string }>()
  const ticketId = Number(ticketIdParam)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const statusFieldId = useId()
  const assignFieldId = useId()
  const resolutionFieldId = useId()
  const commentFieldId = useId()
  const transferFieldId = useId()

  const { data: ticket, isLoading: loadingTicket, error: ticketError } = useTicketDetailQuery(
    Number.isFinite(ticketId) && ticketId > 0 ? ticketId : undefined,
  )

  const commentsQuery = useQuery({
    queryKey: ['ticket', ticketId, 'comments'],
    queryFn: () => listTicketComments(ticketId),
    enabled: Number.isFinite(ticketId) && ticketId > 0,
  })

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => listAgents(),
    enabled: !!user,
  })

  const [status, setStatus] = useState<TicketStatus>('open')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [resolution, setResolution] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})

  const isAdmin = user?.role === 'admin'
  const canStaff = user?.role === 'admin' || user?.role === 'agent'

  const categoriesQuery = useCategoriesQuery(!!ticket)

  const deleteMutation = useMutation({
    mutationFn: () => deleteTicket(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDeleteOpen(false)
      setDeleteError(null)
      navigate('/tickets', { replace: true })
    },
    onError: (e: unknown) => {
      setDeleteError(parseDeleteError(e))
    },
  })

  useEffect(() => {
    if (!ticket) return
    setStatus(ticket.status)
    setAssignedTo(ticket.assigned_to != null ? String(ticket.assigned_to) : '')
    setResolution(ticket.resolution ?? '')
    setFormError(null)
  }, [ticket])

  const patchMutation = useMutation({
    mutationFn: (payload: PatchTicketPayload) => patchTicket(ticketId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setFormError(null)
      if (variables && typeof variables === 'object') {
        const keys = Object.keys(variables as PatchTicketPayload)
        if (keys.length === 1) {
          setFieldErrors((prev) => ({ ...prev, [keys[0]]: null }))
        }
      }
    },
    onError: (e: unknown, variables) => {
      const msg = parseApiError(e)
      if (variables && typeof variables === 'object') {
        const keys = Object.keys(variables as PatchTicketPayload)
        if (keys.length === 1) {
          setFieldErrors((prev) => ({ ...prev, [keys[0]]: msg }))
          return
        }
      }
      setFormError(msg)
    },
  })

  function patchField(fieldKey: string, payload: PatchTicketPayload) {
    setSavingField(fieldKey)
    patchMutation.mutate(payload, {
      onSettled: () => setSavingField(null),
    })
  }

  const transferMutation = useMutation({
    mutationFn: (toUserId: number) => transferTicket(ticketId, toUserId),
    onMutate: () => {
      setTransferError(null)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: unknown) => {
      setTransferError(parseApiError(e))
    },
  })

  const commentMutation = useMutation({
    mutationFn: (text: string) => postTicketComment(ticketId, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'comments'] })
      setCommentText('')
      setCommentError(null)
    },
    onError: (e: unknown) => {
      setCommentError(parseApiError(e))
    },
  })

  if (!Number.isFinite(ticketId) || ticketId < 1) {
    return (
      <section className="space-y-6">
        <p className="text-on-surface-variant">Identificador de ticket no válido.</p>
        <Link to="/tickets" className="text-primary hover:underline">
          Volver al listado
        </Link>
      </section>
    )
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const payload: PatchTicketPayload = { status }
    const trimmedRes = resolution.trim()
    if (status === 'closed' && !trimmedRes) {
      setFormError('No se puede cerrar un ticket sin resolución.')
      return
    }
    payload.resolution = trimmedRes || null
    if (assignedTo.trim() === '') {
      payload.assigned_to = null
    } else {
      const n = Number(assignedTo)
      if (!Number.isFinite(n) || n < 1) {
        setFormError('Asignado a debe ser un número de usuario válido o vacío.')
        return
      }
      payload.assigned_to = n
    }
    patchMutation.mutate(payload)
  }

  function onAddComment(e: React.FormEvent) {
    e.preventDefault()
    setCommentError(null)
    const t = commentText.trim()
    if (!t) {
      setCommentError('Escribe un comentario.')
      return
    }
    commentMutation.mutate(t)
  }

  const comments: TicketComment[] = commentsQuery.data?.results ?? []

  const categoryOptions = (() => {
    const fromApi = (categoriesQuery.data?.results ?? []).map((c) => ({
      value: c.name,
      label: c.name,
    }))
    if (ticket?.category && !fromApi.some((o) => o.value === ticket.category)) {
      return [{ value: ticket.category, label: `${ticket.category} (legado)` }, ...fromApi]
    }
    return fromApi
  })()

  const currentAiStatus = ticket?.ai_status?.trim() || 'Sin IA'

  async function handleDownloadAttachment(downloadUrl: string, filename: string, attId: number) {
    try {
      setDownloadingId(attId)
      const blob = await apiGetBlob(downloadUrl)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      /* descarga fallida */
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section className="space-y-10">
      <DeleteTicketConfirmModal
        open={deleteOpen && !!ticket}
        title={ticket?.title ?? ''}
        loading={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteOpen(false)
            setDeleteError(null)
          }
        }}
        onConfirm={() => {
          setDeleteError(null)
          deleteMutation.mutate()
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-2 text-sm font-medium text-primary hover:underline"
          >
            ← Volver
          </button>
          <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">
            {loadingTicket ? 'Ticket…' : ticket ? ticket.title : 'Ticket'}
          </h2>
          {ticket ? (
            <p className="mt-1 text-sm text-on-surface-variant">
              #{ticket.id} · Creado {formatDate(ticket.created_at)} · Actualizado {formatDate(ticket.updated_at)}
            </p>
          ) : null}
        </div>
        <Link to="/tickets" className="text-sm font-semibold text-on-surface-variant hover:text-on-surface">
          Listado
        </Link>
      </div>

      {ticketError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {(ticketError as Error).message}
        </div>
      ) : null}

      {loadingTicket ? (
        <p className="text-on-surface-variant">Cargando ticket…</p>
      ) : null}

      {ticket ? (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="dashboard-panel p-6">
              <h3 className="font-architectural text-lg font-bold text-on-surface">Descripción</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                {ticket.description}
              </p>
              <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Remitente (correo)
                  </dt>
                  <dd className="mt-1 text-on-surface">
                    {ticket.sender_email?.trim() || ticket.sender_name?.trim() ? (
                      <>
                        <span className="block font-medium">
                          {ticket.sender_name?.trim() ? ticket.sender_name : '—'}
                        </span>
                        <span className="mt-0.5 block text-sm text-on-surface-variant">
                          {ticket.sender_email ?? '—'}
                        </span>
                        {ticket.sender_user_id != null ? (
                          <span className="mt-1 block text-xs text-on-surface-variant">
                            Usuario registrado (#{ticket.sender_user_id})
                          </span>
                        ) : ticket.sender_email ? (
                          <span className="mt-1 block text-xs text-on-surface-variant">Remitente externo</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-on-surface-variant">Sin datos de correo (web o legado)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Creador (id)</dt>
                  <dd className="mt-1 text-on-surface">{ticket.created_by ?? '—'}</dd>
                </div>
              </dl>
            </div>

            {ticket.audit_log && ticket.audit_log.length > 0 ? (
              <div className="dashboard-panel p-6">
                <h3 className="font-architectural text-lg font-bold text-on-surface">Auditoría reciente</h3>
                <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
                  {ticket.audit_log.slice(0, 12).map((ev) => (
                    <li key={ev.id} className="rounded-lg border border-white/10 bg-surface-container-low/30 px-3 py-2">
                      <span className="font-medium text-on-surface">{auditSummary(ev)}</span>
                      <span className="ml-2 text-xs">{formatDate(ev.created_at)}</span>
                      {ev.actor_user_id != null ? (
                        <span className="mt-1 block text-xs">Actor: #{ev.actor_user_id}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ticket.attachments && ticket.attachments.length > 0 ? (
              <div className="dashboard-panel p-6">
                <h3 className="font-architectural text-lg font-bold text-on-surface">Adjuntos</h3>
                <ul className="mt-4 space-y-2">
                  {ticket.attachments.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={downloadingId === a.id}
                        onClick={() => handleDownloadAttachment(a.download_url, a.original_filename, a.id)}
                        className="text-left text-sm font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {downloadingId === a.id ? 'Descargando…' : `${a.original_filename} (${(a.size_bytes / 1024).toFixed(1)} KB)`}
                      </button>
                      {a.comment_id != null ? (
                        <span className="ml-2 text-xs text-on-surface-variant">· en comentario #{a.comment_id}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="dashboard-panel p-6">
              {commentsQuery.isLoading ? (
                <p className="mt-4 text-sm text-on-surface-variant">Cargando comentarios…</p>
              ) : null}
              {commentsQuery.error ? (
                <p className="mt-4 text-sm text-red-200">{(commentsQuery.error as Error).message}</p>
              ) : null}
              <ul className="mt-4 space-y-4">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-white/10 bg-surface-container-low/40 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-on-surface">{c.username}</span>
                      <span className="text-xs text-on-surface-variant">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant">{c.content}</p>
                  </li>
                ))}
              </ul>
              {comments.length === 0 && !commentsQuery.isLoading ? (
                <p className="mt-4 text-sm text-on-surface-variant">Sin comentarios aún.</p>
              ) : null}

              <form className="mt-6 space-y-3" onSubmit={onAddComment}>
                <label htmlFor={commentFieldId} className="block text-xs font-semibold text-on-surface-variant">
                  Nuevo comentario
                </label>
                <textarea
                  id={commentFieldId}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                  placeholder="Añade contexto o seguimiento…"
                />
                {commentError ? (
                  <p className="text-sm text-red-200" role="alert">
                    {commentError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={commentMutation.isPending}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  {commentMutation.isPending ? 'Publicando…' : 'Publicar comentario'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-5">
            <form className="dashboard-panel space-y-4 p-6" onSubmit={onSave}>
              <h3 className="font-architectural text-lg font-bold text-on-surface">Gestión</h3>

              <div className="space-y-4 rounded-xl border border-white/10 bg-surface-container-low/30 p-4">
                {canStaff ? (
                  <>
                    <EditableSelect
                      label="Prioridad"
                      value={ticket.priority}
                      options={TICKET_PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      onChange={(v) => patchField('priority', { priority: v as TicketPriority })}
                      disabled={!canStaff}
                      saving={savingField === 'priority'}
                      error={fieldErrors.priority}
                    />
                    <EditableSelect
                      label="Categoría"
                      value={ticket.category ?? ''}
                      options={
                        categoryOptions.length > 0
                          ? categoryOptions
                          : [{ value: ticket.category ?? '', label: ticket.category ?? '—' }]
                      }
                      onChange={(v) => patchField('category', { category: v })}
                      disabled={categoriesQuery.isLoading || categoryOptions.length === 0}
                      saving={savingField === 'category'}
                      error={fieldErrors.category}
                      hint="Catálogo administrable en Ajustes."
                    />
                    <EditableSelect
                      label="Clasificación IA"
                      value={currentAiStatus}
                      options={TICKET_AI_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      onChange={(v) => patchField('ai_status', { ai_status: v })}
                      saving={savingField === 'ai_status'}
                      error={fieldErrors.ai_status}
                    />
                  </>
                ) : (
                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Prioridad</dt>
                      <dd className="mt-1 text-on-surface">
                        {TICKET_PRIORITY_OPTIONS.find((o) => o.value === ticket.priority)?.label ?? ticket.priority}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Categoría</dt>
                      <dd className="mt-1 text-on-surface">{ticket.category ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Clasificación IA
                      </dt>
                      <dd className="mt-1 text-on-surface">{currentAiStatus}</dd>
                    </div>
                  </dl>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Motivo IA</p>
                  <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-surface-container-low/50 px-3 py-2 text-sm text-on-surface">
                    {ticket.ai_motivo?.trim() || '—'}
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Cierre</p>
                  <p className="text-sm text-on-surface">{ticket.closed_at ? formatDate(ticket.closed_at) : '—'}</p>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Última transferencia</p>
                  <p className="text-sm text-on-surface">
                    {ticket.transferred_at
                      ? `${formatDate(ticket.transferred_at)} (por usuario #${ticket.transferred_by ?? '—'})`
                      : '—'}
                  </p>
                </div>
              </div>

              {canStaff && ticket ? (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <label
                    htmlFor={transferFieldId}
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    Transferir a
                  </label>
                  <select
                    id={transferFieldId}
                    disabled={transferMutation.isPending || agentsQuery.isLoading}
                    value={ticket.assigned_to != null ? String(ticket.assigned_to) : ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (!v || transferMutation.isPending) return
                      const nextId = Number(v)
                      if (!Number.isFinite(nextId) || nextId < 1) return
                      if (nextId === ticket.assigned_to) return
                      transferMutation.mutate(nextId)
                    }}
                    className="w-full rounded-lg border border-white/10 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none transition-shadow focus:border-primary/40 focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ticket.assigned_to == null ? (
                      <option value="">Elige agente o administrador…</option>
                    ) : null}
                    {ticket.assigned_to != null &&
                    !(agentsQuery.data?.results ?? []).some((a) => a.id === ticket.assigned_to && a.is_active) ? (
                      <option value={String(ticket.assigned_to)}>Asignado actual (#{ticket.assigned_to})</option>
                    ) : null}
                    {(agentsQuery.data?.results ?? [])
                      .filter((a) => a.is_active)
                      .map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {(a.full_name || a.username).trim()} (#{a.id}) — carga {a.workload}
                        </option>
                      ))}
                  </select>
                  {transferMutation.isPending ? (
                    <p className="mt-2 text-xs font-medium text-on-surface-variant">Transfiriendo…</p>
                  ) : null}
                  {transferError ? (
                    <p className="mt-2 text-sm text-red-200" role="alert">
                      {transferError}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
                    Al elegir otro usuario la reasignación es inmediata y queda en auditoría.
                  </p>
                </div>
              ) : null}

              <div>
                <label htmlFor={statusFieldId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                  Estado
                </label>
                <select
                  id={statusFieldId}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                >
                  {(['open', 'in_progress', 'closed'] as const).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={assignFieldId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                  Asignado a
                </label>
                {agentsQuery.data?.results?.length ? (
                  <select
                    id={assignFieldId}
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                  >
                    <option value="">Sin asignar</option>
                    {ticket.assigned_to != null &&
                    !agentsQuery.data.results.some((a) => a.id === ticket.assigned_to) ? (
                      <option value={String(ticket.assigned_to)}>
                        Asignado actual (#{ticket.assigned_to})
                      </option>
                    ) : null}
                    {agentsQuery.data.results.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {(a.full_name || a.username).trim()} (#{a.id}) — carga {a.workload}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={assignFieldId}
                    type="text"
                    inputMode="numeric"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                    placeholder="Vacío = sin asignar"
                  />
                )}
              </div>

              <div>
                <label
                  htmlFor={resolutionFieldId}
                  className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
                >
                  Resolución {status === 'closed' ? '(obligatoria al cerrar)' : ''}
                </label>
                <textarea
                  id={resolutionFieldId}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                  placeholder="Describe la solución o el cierre…"
                />
              </div>

              {formError ? (
                <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={patchMutation.isPending}
                className="btn-primary w-full px-4 py-2.5 text-sm"
              >
                {patchMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>

            {isAdmin ? (
              <div className="dashboard-panel mt-6 border border-red-500/20 p-6">
                <h3 className="font-architectural text-lg font-bold text-red-200">Zona de peligro</h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  El ticket dejará de mostrarse en listados (eliminación lógica).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null)
                    setDeleteOpen(true)
                  }}
                  className="btn-danger-outline mt-4 w-full px-4 py-2.5 text-sm"
                >
                  Eliminar ticket
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
