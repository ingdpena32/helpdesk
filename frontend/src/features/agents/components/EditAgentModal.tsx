import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type FormEvent } from 'react'

import { ApiError } from '../../../shared/api/client'
import { useDepartmentsQuery } from '../hooks/useDepartmentsQuery'
import { updateAgent } from '../services/agentsApi'
import type { Agent } from '../types/agent.types'

type Props = {
  open: boolean
  agent: Agent | null
  onClose: () => void
}

function parseApiError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'No se pudo guardar.'
  try {
    const body = JSON.parse(err.message) as { error?: string }
    if (typeof body.error === 'string') return body.error
  } catch {
    /* no JSON */
  }
  return err.message || 'Error.'
}

export default function EditAgentModal({ open, agent, onClose }: Props) {
  const queryClient = useQueryClient()
  const deps = useDepartmentsQuery()
  const fullNameId = useId()
  const corpId = useId()
  const phoneId = useId()
  const docId = useId()
  const genderId = useId()
  const deptId = useId()
  const roleProfId = useId()
  const activeId = useId()
  const pwId = useId()

  const [fullName, setFullName] = useState('')
  const [corporateEmail, setCorporateEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [gender, setGender] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [professionalRole, setProfessionalRole] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!agent) return
    setFullName(agent.full_name ?? '')
    setCorporateEmail(agent.corporate_email ?? agent.email)
    setPhone(agent.phone ?? '')
    setDocumentNumber(agent.document_number ?? '')
    setGender(agent.gender ?? '')
    setDepartmentId(agent.department_id != null ? String(agent.department_id) : '')
    setProfessionalRole(agent.professional_role ?? '')
    setIsActive(agent.is_active)
    setPassword('')
    setFormError(null)
  }, [agent])

  const mutation = useMutation({
    mutationFn: () => {
      if (!agent) throw new Error('missing')
      return updateAgent(agent.id, {
        full_name: fullName.trim() || null,
        corporate_email: corporateEmail.trim().toLowerCase(),
        phone: phone.trim() || null,
        document_number: documentNumber.trim() || null,
        gender: gender || null,
        department_id: departmentId === '' ? null : Number(departmentId),
        professional_role: professionalRole.trim() || null,
        is_active: isActive,
        password: password.trim() ? password : undefined,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
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

  if (!open || !agent) return null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!corporateEmail.trim()) {
      setFormError('El email corporativo es obligatorio.')
      return
    }
    mutation.mutate()
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1e293b] p-6 shadow-2xl shadow-black/50"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-architectural text-xl font-bold text-on-surface">Editar agente</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{agent.email}</p>
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

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label htmlFor={fullNameId} className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Nombre completo
            </label>
            <input
              id={fullNameId}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            />
          </div>
          <div>
            <label htmlFor={corpId} className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Email corporativo (único)
            </label>
            <input
              id={corpId}
              type="email"
              required
              value={corporateEmail}
              onChange={(e) => setCorporateEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            />
          </div>
          <div>
            <label htmlFor={phoneId} className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Teléfono
            </label>
            <input
              id={phoneId}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            />
          </div>
          <div>
            <label htmlFor={docId} className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Documento (único si se informa)
            </label>
            <input
              id={docId}
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            />
          </div>
          <div>
            <label htmlFor={genderId} className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Género
            </label>
            <select
              id={genderId}
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            >
              <option value="">—</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
              <option value="unspecified">Prefiero no indicar</option>
            </select>
          </div>
          <div>
            <label htmlFor={deptId} className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Departamento
            </label>
            <select
              id={deptId}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            >
              <option value="">— Sin departamento —</option>
              {(deps.data?.results ?? []).map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={roleProfId} className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Rol / cargo profesional
            </label>
            <input
              id={roleProfId}
              value={professionalRole}
              onChange={(e) => setProfessionalRole(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              id={activeId}
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-surface-container-low"
            />
            <label htmlFor={activeId} className="text-sm text-on-surface">
              Activo
            </label>
          </div>
          <div>
            <label htmlFor={pwId} className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Nueva contraseña (opcional, mín. 6 caracteres)
            </label>
            <input
              id={pwId}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            />
          </div>

          {formError ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-3">
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
              {mutation.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
