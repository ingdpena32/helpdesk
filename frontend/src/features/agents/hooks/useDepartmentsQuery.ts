import { useQuery } from '@tanstack/react-query'

import { listDepartments } from '../services/agentsApi'
import type { Department } from '../types/agent.types'

export function useDepartmentsQuery() {
  return useQuery<{ results: Department[] }>({
    queryKey: ['departments'],
    queryFn: listDepartments,
  })
}
