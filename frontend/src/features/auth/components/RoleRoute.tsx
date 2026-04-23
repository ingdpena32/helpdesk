import { Navigate } from 'react-router-dom'

import type { UserRole } from '../types/auth.types'
import { useAuth } from '../context/AuthContext'

type Props = {
  allowed: UserRole[]
  children: React.ReactNode
}

export default function RoleRoute({ allowed, children }: Props) {
  const { user, ready, accessToken } = useAuth()

  if (!ready || !accessToken) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-on-surface-variant">Cargando…</div>
    )
  }

  if (!user || !allowed.includes(user.role)) {
    if (user?.role === 'admin') {
      return <Navigate to="/dashboard" replace />
    }
    if (user?.role === 'agent') {
      return <Navigate to="/dashboard/agente" replace />
    }
    return <Navigate to="/login" replace />
  }

  return children
}
