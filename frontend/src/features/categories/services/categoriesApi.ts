import { apiDelete, apiGet, apiPost, apiPut } from '../../../shared/api/client'
import type {
  CategoriesListResponse,
  CreateCategoryPayload,
  TicketCategoryRecord,
  UpdateCategoryPayload,
} from '../types/category.types'

export function listCategories(): Promise<CategoriesListResponse> {
  return apiGet<CategoriesListResponse>('/api/categories')
}

export function createCategory(payload: CreateCategoryPayload): Promise<TicketCategoryRecord> {
  return apiPost<TicketCategoryRecord>('/api/categories', payload)
}

export function updateCategory(id: number, payload: UpdateCategoryPayload): Promise<TicketCategoryRecord> {
  return apiPut<TicketCategoryRecord>(`/api/categories/${id}`, payload)
}

export async function deleteCategory(id: number): Promise<void> {
  await apiDelete(`/api/categories/${id}`)
}
