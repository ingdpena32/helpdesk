import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationsApi'
import type { NotificationItem, ToastNotification } from '../types/notification.types'

const POLL_MS = 12_000

function priorityLabel(p: string | null): string {
  if (!p) return '—'
  const m: Record<string, string> = { low: 'baja', medium: 'media', high: 'alta', critical: 'crítica' }
  return m[p] ?? p
}

export function useNotificationCenter() {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const bootstrapped = useRef(false)
  const maxSeenId = useRef(0)
  const toastedIds = useRef(new Set<number>())
  const timeoutsRef = useRef<Map<string, number>>(new Map())

  const dismissToast = useCallback((toastId: string) => {
    const t = timeoutsRef.current.get(toastId)
    if (t !== undefined) {
      window.clearTimeout(t)
      timeoutsRef.current.delete(toastId)
    }
    setToasts((prev) => prev.filter((x) => x.id !== toastId))
  }, [])

  const pushToast = useCallback(
    (n: NotificationItem) => {
      const toastId = `toast-${n.id}-${Date.now()}`
      const toast: ToastNotification = {
        id: toastId,
        notificationId: n.id,
        ticketId: n.ticket_id,
        title: n.title,
        priority: priorityLabel(n.priority),
        assignee: n.assignee_email ?? 'Sin asignar',
      }
      setToasts((prev) => {
        if (prev.some((t) => t.notificationId === n.id)) return prev
        return [...prev, toast].slice(-4)
      })
      const tid = window.setTimeout(() => {
        dismissToast(toastId)
      }, 5000)
      timeoutsRef.current.set(toastId, tid)
    },
    [dismissToast],
  )

  const poll = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        fetchNotifications(1, 30),
        fetchUnreadCount(),
      ])
      setUnreadCount(countRes.unread_count)
      setItems(listRes.results)
      const mx =
        listRes.results.length > 0 ? Math.max(...listRes.results.map((r) => r.id)) : maxSeenId.current

      if (!bootstrapped.current) {
        bootstrapped.current = true
        maxSeenId.current = mx
        return
      }

      const prevMax = maxSeenId.current
      maxSeenId.current = Math.max(prevMax, mx)

      const fresh = listRes.results.filter((r) => r.id > prevMax && !toastedIds.current.has(r.id))
      for (const n of fresh) {
        toastedIds.current.add(n.id)
        pushToast(n)
      }
    } catch {
      /* silencioso */
    }
  }, [pushToast])

  useEffect(() => {
    void poll()
    const id = window.setInterval(() => void poll(), POLL_MS)
    return () => {
      window.clearInterval(id)
      timeoutsRef.current.forEach((t) => window.clearTimeout(t))
      timeoutsRef.current.clear()
    }
  }, [poll])

  const openTicket = useCallback(
    async (n: NotificationItem) => {
      try {
        await markNotificationRead(n.id)
      } catch {
        /* ignorar */
      }
      setUnreadCount((c) => (n.is_read ? c : Math.max(0, c - 1)))
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      setOpen(false)
      navigate(`/tickets/${n.ticket_id}`)
    },
    [navigate],
  )

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead()
      setUnreadCount(0)
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
    } catch {
      /* silencioso */
    }
  }, [])

  const onToastClick = useCallback(
    async (t: ToastNotification) => {
      dismissToast(t.id)
      try {
        await markNotificationRead(t.notificationId)
      } catch {
        /* ignorar */
      }
      setUnreadCount((c) => Math.max(0, c - 1))
      setItems((prev) =>
        prev.map((x) => (x.id === t.notificationId ? { ...x, is_read: true } : x)),
      )
      navigate(`/tickets/${t.ticketId}`)
    },
    [dismissToast, navigate],
  )

  return {
    items,
    unreadCount,
    open,
    setOpen,
    openTicket,
    markAllRead,
    toasts,
    dismissToast,
    onToastClick,
  }
}
