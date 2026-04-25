import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type FormEvent } from 'react'

import { ApiError } from '../../../shared/api/client'
import { createAgent } from '../services/agentsApi'

type Props = {
  open: boolean
  onClose: () => void
}

function parseApiError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'No se pudo crear el agente.'
  try {
    const body = JSON.parse(err.message) as { error?: string }
    if (typeof body.error === 'string') return body.error
  } catch {
    /* no JSON */
  }
  if (err.status === 401) return 'Sesión expirada.'
  if (err.status === 403) return 'No tienes permiso para crear agentes.'
  if (err.status === 409) return 'Ya existe un usuario con ese email.'
  return err.message || 'No se pudo crear el agente.'
}

export default function CreateAgentModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: createAgent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
      setEmail('')
      setPassword('')
      setFormError(null)
      onClose()
    },
    onError: (e: unknown) => {
      setFormError(parseApiError(e))
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
    const em = email.trim().toLowerCase()
    if (!em) {
      setFormError('El email es obligatorio.')
      return
    }
    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    mutation.mutate({ email: em, password })
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1e293b] p-6 shadow-2xl shadow-black/50"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-architectural text-xl font-bold text-on-surface">Crear agente</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Se creará un usuario con rol agente y contraseña hasheada en el servidor.</p>
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
            <label htmlFor={emailId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
              required
            />
          </div>
          <div>
            <label htmlFor={passwordId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Contraseña (mín. 6 caracteres)
            </label>
            <input
              id={passwordId}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
              minLength={6}
              required
            />
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
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-60"
            >
              {mutation.isPending ? 'Creando…' : 'Crear agente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
