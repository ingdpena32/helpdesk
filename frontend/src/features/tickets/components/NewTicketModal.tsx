import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../../../shared/api/client'
import { useAuth } from '../../auth/context/AuthContext'
import { createTicket } from '../services/ticketsApi'
import type { TicketCategory, TicketPriority } from '../types/ticket.types'
import { TICKET_CATEGORIES } from '../types/ticket.types'

type Props = {
  open: boolean
  onClose: () => void
}

const priorityChoices: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
]

function parseApiError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'No se pudo crear el ticket.'
  try {
    const body = JSON.parse(err.message) as { error?: string }
    if (typeof body.error === 'string') return body.error
  } catch {
    /* cuerpo no JSON */
  }
  if (err.status === 401) return 'Sesión expirada. Vuelve a iniciar sesión.'
  return err.message || 'No se pudo crear el ticket.'
}

export default function NewTicketModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const titleId = useId()
  const descId = useId()
  const priorityId = useId()
  const categoryId = useId()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [category, setCategory] = useState<TicketCategory>('Soporte técnico')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setTitle('')
      setDescription('')
      setPriority('medium')
      setCategory('Soporte técnico')
      setFormError(null)
      onClose()
      navigate('/tickets')
    },
    onError: (err: unknown) => {
      setFormError(parseApiError(err))
    },
  })

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!user?.id) {
      setFormError('No hay usuario en sesión.')
      return
    }
    const t = title.trim()
    const d = description.trim()
    if (!t || !d) {
      setFormError('Título y descripción son obligatorios.')
      return
    }
    mutation.mutate({
      title: t,
      description: d,
      created_by: user.id,
      priority,
      category,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1e293b] p-6 shadow-2xl shadow-black/50"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-architectural text-xl font-bold text-on-surface">
              Nuevo ticket
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              El listado se actualiza al crear. La prioridad se guarda en la BD como low, medium o high; el
              desplegable muestra Baja/Media/Alta pero envía esos códigos en inglés.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-white/10 hover:text-on-surface"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor={`${titleId}-input`} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Título
            </label>
            <input
              id={`${titleId}-input`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 focus:border-primary/40 focus:ring-2"
              placeholder="Resumen breve del problema"
              maxLength={500}
              required
            />
          </div>

          <div>
            <label htmlFor={descId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Descripción
            </label>
            <textarea
              id={descId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 focus:border-primary/40 focus:ring-2"
              placeholder="Detalle del incidente o solicitud"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={priorityId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Prioridad
              </label>
              <select
                id={priorityId}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
              >
                {priorityChoices.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={categoryId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Categoría
              </label>
              <select
                id={categoryId}
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
              >
                {TICKET_CATEGORIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-new-ticket rounded-xl px-5 py-2.5 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Creando…' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
