import { clearSession, getAccessToken, getRefreshToken, persistSession, getStoredUser } from './authStorage'

const baseUrl = () => (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type ApiRequestInit = RequestInit & { auth?: boolean; _retry?: boolean }

function joinUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl()}${normalized}`
}

function buildHeaders(initHeaders?: HeadersInit, auth = true): Headers {
  const h = new Headers(initHeaders)
  if (!h.has('Accept')) {
    h.set('Accept', 'application/json')
  }
  if (auth) {
    const token = getAccessToken()
    if (token) {
      h.set('Authorization', `Bearer ${token}`)
    }
  }
  return h
}

async function tryRefreshToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null

  try {
    const res = await fetch(joinUrl('/api/auth/refresh/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) return null

    const data = (await res.json()) as { access: string }
    const user = getStoredUser()
    if (user) {
      persistSession(data.access, refresh, user)
    }
    return data.access
  } catch {
    return null
  }
}

async function request<T>(url: string, init: RequestInit & { auth?: boolean; _retry?: boolean }): Promise<T> {
  const { auth = true, _retry = false, ...rest } = init
  const headers = buildHeaders(rest.headers, auth)

  const res = await fetch(joinUrl(url), { credentials: 'include', ...rest, headers })

  if (res.status === 401 && auth && !_retry) {
    const newToken = await tryRefreshToken()
    if (newToken) {
      return request<T>(url, { ...init, _retry: true })
    }
    clearSession()
    window.location.href = '/login'
    throw new ApiError(401, 'Sesión expirada')
  }

  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, body || res.statusText)
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export async function apiGet<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return request<T>(path, { method: 'GET', ...init })
}

export async function apiPost<T>(path: string, body: unknown, init?: ApiRequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return request<T>(path, { method: 'POST', body: JSON.stringify(body), ...init, headers })
}

export async function apiPatch<T>(path: string, body: unknown, init?: ApiRequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...init, headers })
}

export async function apiPut<T>(path: string, body: unknown, init?: ApiRequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body), ...init, headers })
}

export async function apiDelete(path: string, init?: ApiRequestInit): Promise<void> {
  await request<void>(path, { method: 'DELETE', ...init })
}
