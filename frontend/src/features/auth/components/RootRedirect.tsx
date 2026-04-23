import { Navigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export default function RootRedirect() {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={user.role === 'admin' ? '/dashboard' : '/dashboard/agente'} replace />
}
