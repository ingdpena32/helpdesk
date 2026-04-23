import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  clearSession,
  getAccessToken,
  getStoredUser,
  persistSession,
  type StoredUser,
} from '../../../shared/api/authStorage'
import { login as loginRequest } from '../services/authApi'
import type { LoginRequest } from '../types/auth.types'

type AuthState = {
  user: StoredUser | null
  accessToken: string | null
  ready: boolean
}

type AuthContextValue = AuthState & {
  login: (payload: LoginRequest) => Promise<StoredUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    ready: false,
  })

  useEffect(() => {
    const token = getAccessToken()
    const storedUser = getStoredUser()
    if (token && !storedUser) {
      clearSession()
      setState({ user: null, accessToken: null, ready: true })
      return
    }
    setState({
      user: token && storedUser ? storedUser : null,
      accessToken: token,
      ready: true,
    })
  }, [])

  const login = useCallback(async (payload: LoginRequest) => {
    const data = await loginRequest(payload)
    persistSession(data.access, data.refresh, data.user)
    setState({ user: data.user, accessToken: data.access, ready: true })
    return data.user
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setState({ user: null, accessToken: null, ready: true })
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
    }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
