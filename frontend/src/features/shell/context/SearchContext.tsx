import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useSearchScope, type SearchScope } from '../hooks/useSearchScope'

type SearchContextValue = {
  scope: SearchScope
  query: string
  debouncedQuery: string
  setQuery: (value: string) => void
  clearQuery: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const scope = useSearchScope()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const urlQuery = scope ? (searchParams.get('q') ?? '') : ''

  const [query, setQueryState] = useState(urlQuery)

  useEffect(() => {
    setQueryState(urlQuery)
  }, [urlQuery, location.pathname, scope])

  const debouncedQuery = useDebouncedValue(query.trim(), 300)

  useEffect(() => {
    if (!scope) return
    const trimmed = debouncedQuery
    if (trimmed === urlQuery) return

    if (scope === 'tickets' && /^\/tickets\/\d+$/.test(location.pathname)) {
      navigate(trimmed ? `/tickets?q=${encodeURIComponent(trimmed)}` : '/tickets', { replace: true })
      return
    }

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (trimmed) next.set('q', trimmed)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [debouncedQuery, scope, urlQuery, location.pathname, navigate, setSearchParams])

  const setQuery = useCallback((value: string) => {
    setQueryState(value)
  }, [])

  const clearQuery = useCallback(() => {
    setQueryState('')
  }, [])

  const value = useMemo(
    () => ({
      scope,
      query,
      debouncedQuery,
      setQuery,
      clearQuery,
    }),
    [scope, query, debouncedQuery, setQuery, clearQuery],
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useSearch debe usarse dentro de SearchProvider')
  }
  return ctx
}
