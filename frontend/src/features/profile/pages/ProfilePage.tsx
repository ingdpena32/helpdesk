import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type FormEvent } from 'react'

import { ApiError } from '../../../shared/api/client'
import { getAccessToken, getRefreshToken, getStoredUser, persistSession } from '../../../shared/api/authStorage'
import { useAuth } from '../../auth/context/AuthContext'
import { getMyProfile, patchMyProfile, uploadProfilePhoto, type MyProfile } from '../services/profileApi'

const GENDERS: { value: string; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
  { value: 'other', label: 'Otro' },
  { value: 'unspecified', label: 'Prefiero no indicar' },
]

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

function mergeStoredUser(profile: MyProfile) {
  const token = getAccessToken()
  const refresh = getRefreshToken()
  const prev = getStoredUser()
  if (!token || !refresh || !prev) return
  persistSession(token, refresh, {
    ...prev,
    first_name: profile.full_name?.trim() ? profile.full_name.trim().split(/\s+/)[0] : prev.first_name,
    last_name:
      profile.full_name?.trim().split(/\s+/).length > 1
        ? profile.full_name.trim().split(/\s+/).slice(1).join(' ')
        : prev.last_name,
    full_name: profile.full_name,
    corporate_email: profile.corporate_email,
    profile_photo: profile.profile_photo,
    profile_photo_url: profile.profile_photo_url,
    phone: profile.phone,
    department_id: profile.department_id,
    professional_role: profile.professional_role,
  })
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const { user: authUser } = useAuth()
  const nameId = useId()
  const phoneId = useId()
  const genderId = useId()
  const fileId = useId()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const profileQuery = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: getMyProfile,
  })

  useEffect(() => {
    const p = profileQuery.data
    if (!p) return
    setFullName(p.full_name ?? '')
    setPhone(p.phone ?? '')
    setGender(p.gender ?? '')
  }, [profileQuery.data])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const patchMutation = useMutation({
    mutationFn: patchMyProfile,
    onSuccess: (data) => {
      mergeStoredUser(data)
      void queryClient.invalidateQueries({ queryKey: ['me', 'profile'] })
      setBanner({ type: 'ok', text: 'Perfil actualizado correctamente.' })
    },
    onError: (e: unknown) => {
      setBanner({ type: 'err', text: parseApiError(e) })
    },
  })

  const photoMutation = useMutation({
    mutationFn: uploadProfilePhoto,
    onSuccess: async () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      const fresh = await queryClient.fetchQuery({ queryKey: ['me', 'profile'], queryFn: getMyProfile })
      mergeStoredUser(fresh)
      setBanner({ type: 'ok', text: 'Foto de perfil actualizada.' })
      void queryClient.invalidateQueries({ queryKey: ['me', 'profile'] })
    },
    onError: (e: unknown) => {
      setBanner({ type: 'err', text: parseApiError(e) })
    },
  })

  const p = profileQuery.data
  const displayPhoto = previewUrl || (p?.profile_photo_url ? p.profile_photo_url : null)
  const initials =
    (authUser?.full_name || authUser?.user_name || '?')
      .trim()
      .slice(0, 2)
      .toUpperCase() || '?'

  function onSaveBasics(e: FormEvent) {
    e.preventDefault()
    setBanner(null)
    patchMutation.mutate({
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      gender: gender || null,
    })
  }

  function onFileChange(files: FileList | null) {
    setBanner(null)
    const f = files?.[0]
    if (!f) return
    if (!/^image\/(jpeg|png)$/i.test(f.type)) {
      setBanner({ type: 'err', text: 'Solo JPG o PNG.' })
      return
    }
    if (f.size > 2 * 1024 * 1024) {
      setBanner({ type: 'err', text: 'La imagen supera 2MB.' })
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
    photoMutation.mutate(f)
  }

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">Mi perfil</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Datos profesionales y foto visible para el equipo (según permisos de la aplicación).
        </p>
      </div>

      {banner ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
          role="status"
        >
          {banner.text}
        </div>
      ) : null}

      {profileQuery.isLoading ? (
        <p className="text-on-surface-variant">Cargando perfil…</p>
      ) : null}
      {profileQuery.error ? (
        <p className="text-sm text-red-200">{(profileQuery.error as Error).message}</p>
      ) : null}

      {p ? (
        <div className="dashboard-panel overflow-hidden p-0">
          <div className="border-b border-white/10 bg-gradient-to-br from-primary/15 to-transparent px-8 py-10">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="relative">
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt=""
                    className="h-28 w-28 rounded-full border-2 border-primary/40 object-cover shadow-lg shadow-black/40"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-primary/40 bg-surface-container-high text-2xl font-bold text-primary shadow-lg">
                    {initials}
                  </div>
                )}
                {photoMutation.isPending ? (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Subiendo…
                  </span>
                ) : null}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-architectural text-2xl font-bold text-on-surface">
                  {(p.full_name || p.email).trim()}
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">{p.corporate_email}</p>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Rol permisos</dt>
                    <dd className="text-on-surface">{p.role === 'admin' ? 'Administrador' : 'Agente'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Cargo</dt>
                    <dd className="text-on-surface">{p.professional_role?.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Departamento</dt>
                    <dd className="text-on-surface">{p.department_name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Documento</dt>
                    <dd className="text-on-surface">{p.document_number?.trim() || '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-8 py-8">
            <div>
              <label htmlFor={fileId} className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Cambiar foto (JPG/PNG, máx. 2MB)
              </label>
              <input
                id={fileId}
                type="file"
                accept="image/jpeg,image/png"
                disabled={photoMutation.isPending}
                onChange={(e) => onFileChange(e.target.files)}
                className="block w-full max-w-md text-sm text-on-surface-variant file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-bold file:text-slate-900"
              />
            </div>

            <form className="space-y-4" onSubmit={onSaveBasics}>
              <h4 className="font-architectural text-lg font-bold text-on-surface">Datos editables</h4>
              <p className="text-xs text-on-surface-variant">
                Email corporativo, documento, departamento y cargo solo los modifica un administrador.
              </p>
              <div>
                <label htmlFor={nameId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                  Nombre completo
                </label>
                <input
                  id={nameId}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                />
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
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={patchMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-60"
              >
                {patchMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
