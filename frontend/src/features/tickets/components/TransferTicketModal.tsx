import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type FormEvent } from 'react'

import { ApiError } from '../../../shared/api/client'
import { listAgents, transferTicket } from '../../agents/services/agentsApi'
import type { Agent } from '../../agents/types/agent.types'

type Props = {
  open: boolean
  ticketId: number
  currentAssigneeId: number | null
  onClose: () => void
}

function parseApiError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'No se pudo transferir el ticket.'
  try {
    const body = JSON.parse(err.message) as { error?: string }
    if (typeof body.error === 'string') return body.error
  } catch {
    /* no JSON */
  }
  return err.message || 'Error.'
}

export default function TransferTicketModal({ open, ticketId, currentAssigneeId, onClose }: Props) {
  const queryClient = useQueryClient()
  const selectId = useId()
  const [assigneeId, setAssigneeId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: listAgents,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (toId: number) => transferTicket(ticketId, toId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setError(null)
      onClose()
    },
    onError: (e: unknown) => {
      setError(parseApiError(e))
    },
  })

  useEffect(() => {
    if (!open) return
    setAssigneeId('')
    setError(null)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const agents: Agent[] = agentsQuery.data?.results ?? []
  const options = agents.filter((a) => a.id !== currentAssigneeId && a.is_active)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = Number(assigneeId)
    if (!Number.isFinite(n) || n < 1) {
      setError('Seleccione un agente destino.')
      return
    }
    mutation.mutate(n)
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
        aria-labelledby="transfer-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1e293b] p-6 shadow-2xl shadow-black/50"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="transfer-title" className="font-architectural text-xl font-bold text-on-surface">
              Transferir ticket
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              El ticket #{ticketId} se reasignará y quedará registrado en el historial de auditoría.
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
            <label htmlFor={selectId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Agente destino
            </label>
            {agentsQuery.isLoading ? (
              <p className="text-sm text-on-surface-variant">Cargando agentes…</p>
            ) : (
              <select
                id={selectId}
                required
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
              >
                <option value="">— Seleccionar —</option>
                {options.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {(a.full_name || a.username).trim()} · {a.corporate_email || a.email} (carga {a.workload})
                  </option>
                ))}
              </select>
            )}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
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
              disabled={mutation.isPending || agentsQuery.isLoading}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-60"
            >
              {mutation.isPending ? 'Transfiriendo…' : 'Confirmar transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
