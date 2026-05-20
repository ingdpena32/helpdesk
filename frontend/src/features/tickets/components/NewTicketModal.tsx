import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../../../shared/api/client'
import { createTicket } from '../services/ticketsApi'
import { useCategoriesQuery } from '../../categories/hooks/useCategoriesQuery'
import { TICKET_PRIORITY_OPTIONS, type TicketCategoryName, type TicketPriority } from '../types/ticket.types'

type Props = {
  open: boolean
  onClose: () => void
}

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
  const titleId = useId()
  const descId = useId()
  const priorityId = useId()
  const categoryId = useId()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [category, setCategory] = useState<TicketCategoryName>('')
  const [formError, setFormError] = useState<string | null>(null)

  const categoriesQuery = useCategoriesQuery(open)
  const categoryOptions = categoriesQuery.data?.results ?? []

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setTitle('')
      setDescription('')
      setPriority('medium')
      setCategory(categoryOptions[0]?.name ?? '')
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

  useEffect(() => {
    if (!open || categoryOptions.length === 0) return
    if (!category || !categoryOptions.some((c) => c.name === category)) {
      setCategory(categoryOptions[0].name)
    }
  }, [open, categoryOptions, category])

  if (!open) return null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const t = title.trim()
    const d = description.trim()
    if (!t || !d) {
      setFormError('Título y descripción son obligatorios.')
      return
    }
    if (!category.trim()) {
      setFormError('Selecciona una categoría.')
      return
    }
    mutation.mutate({
      title: t,
      description: d,
      priority,
      category,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim/60 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-overlay/10 bg-surface-container p-6 shadow-2xl shadow-elevation/50"
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
            className="btn-icon p-1.5"
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
              className="w-full rounded-lg border border-overlay/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 focus:border-primary/40 focus:ring-2"
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
              className="w-full resize-y rounded-lg border border-overlay/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 focus:border-primary/40 focus:ring-2"
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
                className="w-full rounded-lg border border-overlay/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
              >
                {TICKET_PRIORITY_OPTIONS.map((o) => (
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
                onChange={(e) => setCategory(e.target.value)}
                disabled={categoriesQuery.isLoading || categoryOptions.length === 0}
                className="w-full rounded-lg border border-overlay/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
              >
                {categoryOptions.length === 0 ? (
                  <option value="">Sin categorías disponibles</option>
                ) : (
                  categoryOptions.map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {formError ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-new-ticket rounded-xl px-5 py-2.5 text-sm font-bold "
            >
              {mutation.isPending ? 'Creando…' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
