import { apiGet, apiPatch } from '../../../shared/api/client'
import type { NotificationsListResponse, UnreadCountResponse } from '../types/notification.types'

export async function fetchNotifications(page = 1, pageSize = 30): Promise<NotificationsListResponse> {
  const q = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  return apiGet<NotificationsListResponse>(`/api/notifications?${q.toString()}`)
}

export async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  return apiGet<UnreadCountResponse>('/api/notifications/unread-count')
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiPatch(`/api/notifications/${id}/read`, {})
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiPatch('/api/notifications/read-all', {})
}
