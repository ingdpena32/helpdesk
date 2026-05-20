import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

export type SearchScope = 'tickets' | 'agents' | null

export function useSearchScope(): SearchScope {
  const { pathname } = useLocation()
  return useMemo(() => {
    if (pathname.startsWith('/agentes')) return 'agents'
    if (pathname.startsWith('/tickets')) return 'tickets'
    return null
  }, [pathname])
}

export function searchPlaceholder(scope: SearchScope): string {
  if (scope === 'tickets') return 'Buscar tickets por título, categoría, ID, correo…'
  if (scope === 'agents') return 'Buscar agentes por nombre, email, departamento…'
  return 'Búsqueda no disponible en esta vista'
}
