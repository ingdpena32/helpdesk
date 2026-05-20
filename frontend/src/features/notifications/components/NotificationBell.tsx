import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { formatRelativeTime } from '../utils/relativeTime'
import type { NotificationItem, ToastNotification } from '../types/notification.types'

/** Encima del layout (header z-40, aside z-30); por debajo de modales (z-[100]). */
const Z_BACKDROP = 92
const Z_DROPDOWN = 93
const Z_TOAST = 94

type Props = {
  items: NotificationItem[]
  unreadCount: number
  open: boolean
  setOpen: (v: boolean) => void
  onOpenTicket: (n: NotificationItem) => void
  onMarkAllRead: () => void
}

export default function NotificationBell({
  items,
  unreadCount,
  open,
  setOpen,
  onOpenTicket,
  onMarkAllRead,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number
    right: number
    width: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setDropdownStyle(null)
      return
    }

    const update = () => {
      const el = btnRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = window.innerWidth
      const maxW = Math.min(22 * 16, vw - 16)
      const width = Math.max(280, maxW)
      setDropdownStyle({
        top: r.bottom + 8,
        right: Math.max(8, vw - r.right),
        width,
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  const portalTarget = typeof document !== 'undefined' ? document.body : null

  const dropdownPortal =
    open && portalTarget && dropdownStyle
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 cursor-default bg-scrim/25 backdrop-blur-[1px]"
              style={{ zIndex: Z_BACKDROP }}
              aria-label="Cerrar notificaciones"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Lista de notificaciones"
              className="fixed flex max-h-[min(72vh,26rem)] flex-col rounded-xl border border-overlay/10 bg-surface-container-high/98 shadow-2xl shadow-elevation/50 backdrop-blur-xl"
              style={{
                zIndex: Z_DROPDOWN,
                top: dropdownStyle.top,
                right: dropdownStyle.right,
                width: dropdownStyle.width,
              }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-overlay/10 px-4 py-3">
                <p className="text-sm font-semibold text-on-surface">Notificaciones</p>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void onMarkAllRead()}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Marcar todas leídas
                  </button>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-b-xl">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-on-surface-variant">Sin notificaciones</p>
                ) : (
                  <ul className="divide-y divide-overlay/5">
                    {items.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void onOpenTicket(n)}
                          className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-overlay/[0.06] ${
                            n.is_read ? 'opacity-75' : 'bg-primary/5'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-sm font-semibold leading-snug ${
                                n.is_read ? 'text-on-surface-variant' : 'text-on-surface'
                              }`}
                            >
                              {n.title}
                            </span>
                            {!n.is_read ? (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary shadow shadow-primary/40" />
                            ) : null}
                          </div>
                          <p className="line-clamp-2 text-xs text-on-surface-variant">{n.message}</p>
                          <p className="text-[11px] text-on-surface-variant/80">
                            {formatRelativeTime(n.created_at)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>,
          portalTarget,
        )
      : null

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Notificaciones"
        onClick={() => setOpen(!open)}
        className="btn-icon relative p-1.5"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold  shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
      {dropdownPortal}
    </div>
  )
}

export function NotificationToastHost({
  toasts,
  onDismiss,
  onClickToast,
}: {
  toasts: ToastNotification[]
  onDismiss: (id: string) => void
  onClickToast: (t: ToastNotification) => void
}) {
  if (toasts.length === 0 || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-6 right-6 flex w-[min(100vw-2rem,20rem)] max-w-[20rem] flex-col gap-2 p-0 sm:bottom-8 sm:right-8"
      style={{ zIndex: Z_TOAST }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => void onClickToast(t)}
          className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-overlay/10 bg-surface-container-high/98 px-4 py-3 text-left shadow-xl shadow-elevation/40 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-2xl hover:shadow-primary/10"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-primary">Ticket #{t.ticketId}</span>
            <span
              role="button"
              tabIndex={0}
              className="btn-icon pointer-events-auto -m-1 p-1"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onDismiss(t.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  onDismiss(t.id)
                }
              }}
              aria-label="Cerrar"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </span>
          </div>
          <p className="line-clamp-2 text-sm font-semibold text-on-surface">{t.title}</p>
          <p className="text-xs text-on-surface-variant">
            Prioridad: <span className="text-on-surface">{t.priority}</span> · Asignado:{' '}
            <span className="text-on-surface">{t.assignee}</span>
          </p>
        </button>
      ))}
    </div>,
    document.body,
  )
}
