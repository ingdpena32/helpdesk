import type { StoredUser } from '../../../shared/api/authStorage'

export type UserRole = 'admin' | 'agent'

export type LoginRequest = {
  user_name: string
  password: string
}

export type LoginResponse = {
  access: string
  refresh: string
  user: StoredUser
}
