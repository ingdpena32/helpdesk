import type { UserRole } from './types/auth.types'

export function isAdminRole(role: string | UserRole | undefined | null): role is 'admin' {
  return role === 'admin'
}

/** Personal que opera tickets (admin cuenta también como agente operativo). */
export function isOperativeStaffRole(role: string | UserRole | undefined | null): boolean {
  return role === 'admin' || role === 'agent'
}

/** Exportaciones / datos globales (solo administrador). */
export function canExportSystemData(role: string | UserRole | undefined | null): boolean {
  return role === 'admin'
}
