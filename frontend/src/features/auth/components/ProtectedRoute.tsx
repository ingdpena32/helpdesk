import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { accessToken, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120] text-on-surface-variant">
        Cargando…
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
