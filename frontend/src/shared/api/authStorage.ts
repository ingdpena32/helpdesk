const ACCESS = 'helpdesk_access_token'
const REFRESH = 'helpdesk_refresh_token'
const USER = 'helpdesk_user'

export type StoredUser = {
  id: number
  user_name: string
  email: string
  role: 'admin' | 'agent'
  first_name: string
  last_name: string
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH)
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}

export function persistSession(access: string, refresh: string, user: StoredUser) {
  localStorage.setItem(ACCESS, access)
  localStorage.setItem(REFRESH, refresh)
  localStorage.setItem(USER, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(ACCESS)
  localStorage.removeItem(REFRESH)
  localStorage.removeItem(USER)
}
