export type NotificationType = 'ticket_created' | 'ticket_email' | 'ticket_assigned' | 'ticket_comment'

export type NotificationItem = {
  id: number
  ticket_id: number
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  created_at: string
  priority: string | null
  assigned_to: number | null
  assignee_email: string | null
}

export type NotificationsListResponse = {
  count: number
  next: string | null
  previous: string | null
  results: NotificationItem[]
}

export type UnreadCountResponse = {
  unread_count: number
}

export type ToastNotification = {
  id: string
  notificationId: number
  ticketId: number
  title: string
  priority: string | null
  assignee: string | null
}
