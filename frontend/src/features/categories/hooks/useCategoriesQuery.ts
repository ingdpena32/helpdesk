import { useQuery } from '@tanstack/react-query'

import { listCategories } from '../services/categoriesApi'

export const CATEGORIES_QUERY_KEY = ['categories'] as const

export function useCategoriesQuery(enabled = true) {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: listCategories,
    enabled,
    staleTime: 60_000,
  })
}
