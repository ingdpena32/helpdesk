import { apiPost } from '../../../shared/api/client'
import type { LoginRequest, LoginResponse } from '../types/auth.types'

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/auth/login', payload, { auth: false })
}
