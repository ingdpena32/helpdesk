import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../../../shared/api/client'
import { BrandMark } from '../../../shared/components/BrandMark'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, accessToken, user, ready } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (ready && accessToken && user) {
    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({
        user_name: userName.trim(),
        password,
      })
      const fallback = '/dashboard'
      const canUseFrom = Boolean(from) && from !== '/login'
      navigate(canUseFrom && from ? from : fallback, { replace: true })
    } catch (err) {
      let message = 'No se pudo iniciar sesión.'
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.message) as Record<string, unknown>
          if (typeof body.detail === 'string') {
            message = body.detail
          } else if (body.non_field_errors && Array.isArray(body.non_field_errors)) {
            message = String(body.non_field_errors[0])
          } else if (body.user_name && Array.isArray(body.user_name)) {
            message = String(body.user_name[0])
          }
        } catch {
          if (err.status === 401) {
            message = 'Usuario o contraseña incorrectos.'
          }
        }
      }
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-primary/15 blur-[90px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-sky-500/10 blur-[100px]"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-overlay/10 bg-surface-container p-8 shadow-2xl shadow-elevation/40">
        <BrandMark variant="login" />

        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <label htmlFor="user_name" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Usuario
            </label>
            <input
              id="user_name"
              name="user_name"
              type="text"
              autoComplete="username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full rounded-lg border border-overlay/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 placeholder:text-on-surface-variant/50 focus:border-primary/40 focus:ring-2"
              placeholder="Nombre de usuario"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-overlay/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none ring-primary/30 focus:border-primary/40 focus:ring-2"
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="btn-new-ticket flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold "
          >
            {submitting ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
