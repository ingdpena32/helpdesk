import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type FormEvent } from 'react'

import { ApiError } from '../../../shared/api/client'
import { useDepartmentsQuery } from '../hooks/useDepartmentsQuery'
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
  if (err.status === 409) return 'Ya existe un usuario con ese email o datos únicos duplicados.'
  return err.message || 'No se pudo crear el agente.'
}

export default function CreateAgentModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const deps = useDepartmentsQuery()
  const emailId = useId()
  const passwordId = useId()
  const corpId = useId()
  const fullId = useId()
  const deptId = useId()
  const phoneId = useId()
  const docId = useId()
  const genderId = useId()
  const profId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [corporateEmail, setCorporateEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [phone, setPhone] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [gender, setGender] = useState('')
  const [professionalRole, setProfessionalRole] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: createAgent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
      setEmail('')
      setPassword('')
      setCorporateEmail('')
      setFullName('')
      setDepartmentId('')
      setPhone('')
      setDocumentNumber('')
      setGender('')
      setProfessionalRole('')
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
    mutation.mutate({
      email: em,
      password,
      corporate_email: corporateEmail.trim() ? corporateEmail.trim().toLowerCase() : undefined,
      full_name: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
      document_number: documentNumber.trim() || undefined,
      gender: gender || undefined,
      professional_role: professionalRole.trim() || undefined,
      department_id: departmentId === '' ? undefined : Number(departmentId),
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1e293b] p-6 shadow-2xl shadow-black/50"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-architectural text-xl font-bold text-on-surface">Crear agente</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Usuario con rol agente. Email corporativo por defecto coincide con el de acceso si lo deja vacío.
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

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label htmlFor={emailId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Email acceso
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
            <label htmlFor={corpId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Email corporativo (opcional, único)
            </label>
            <input
              id={corpId}
              type="email"
              value={corporateEmail}
              onChange={(e) => setCorporateEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <div>
            <label htmlFor={fullId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Nombre completo
            </label>
            <input
              id={fullId}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <div>
            <label htmlFor={deptId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Departamento
            </label>
            <select
              id={deptId}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
            >
              <option value="">—</option>
              {(deps.data?.results ?? []).map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={phoneId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Teléfono
            </label>
            <input
              id={phoneId}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <div>
            <label htmlFor={docId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Documento (único)
            </label>
            <input
              id={docId}
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <div>
            <label htmlFor={genderId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Género
            </label>
            <select
              id={genderId}
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
            >
              <option value="">—</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
              <option value="unspecified">Prefiero no indicar</option>
            </select>
          </div>
          <div>
            <label htmlFor={profId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Rol profesional / cargo
            </label>
            <input
              id={profId}
              value={professionalRole}
              onChange={(e) => setProfessionalRole(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
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
              className="btn-secondary px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              {mutation.isPending ? 'Creando…' : 'Crear agente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
