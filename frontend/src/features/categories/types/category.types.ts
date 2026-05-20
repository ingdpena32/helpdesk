export type TicketCategoryRecord = {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export type CategoriesListResponse = {
  results: TicketCategoryRecord[]
}

export type CreateCategoryPayload = {
  name: string
}

export type UpdateCategoryPayload = {
  name: string
}
