import { Link } from 'react-router-dom'

import { formatRelativeTime } from '../../notifications/utils/relativeTime'
import type { RecentActivityItem } from '../types/dashboard.types'

const EVENT_ICONS: Record<string, string> = {
  ticket_created: 'add_circle',
  ticket_comment: 'chat',
  ticket_transfer: 'swap_horiz',
  ticket_updated: 'edit_note',
}

function iconForEvent(eventType: string): string {
  return EVENT_ICONS[eventType] ?? 'history'
}

type Props = {
  items: RecentActivityItem[]
  loading: boolean
  error: string | null
  className?: string
}

const EMPTY_BOX =
  'flex min-h-[10rem] flex-1 items-center justify-center rounded-xl border border-dashed border-overlay/15 bg-surface-container-low/40 px-4 py-10'

export default function RecentActivityFeed({ items, loading, error, className = '' }: Props) {
  if (loading) {
    return (
      <div className={`${EMPTY_BOX} ${className}`}>
        <p className="text-sm text-on-surface-variant">Cargando actividad…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${EMPTY_BOX} border-error/30 ${className}`}>
        <p className="px-4 text-center text-sm text-error" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={`${EMPTY_BOX} ${className}`}>
        <p className="px-4 text-center text-sm text-on-surface-variant">
          No hay actividad en el rango y filtros seleccionados.
        </p>
      </div>
    )
  }

  return (
    <ul className={`h-full space-y-1 overflow-y-auto pr-1 ${className}`}>
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`/tickets/${item.ticket_id}`}
            className="group flex gap-3 rounded-lg border border-transparent px-2 py-2.5 transition-colors hover:border-overlay/10 hover:bg-surface-container-low/80"
          >
            <span
              className="material-symbols-outlined mt-0.5 shrink-0 text-xl text-primary/80"
              aria-hidden
            >
              {iconForEvent(item.event_type)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-on-surface group-hover:text-primary">
                {item.summary}
              </p>
              {item.ticket_title ? (
                <p className="mt-0.5 truncate text-xs text-on-surface-variant">{item.ticket_title}</p>
              ) : null}
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/80">
                {formatRelativeTime(item.occurred_at)}
              </p>
            </div>
            <span
              className="material-symbols-outlined shrink-0 self-center text-lg text-on-surface-variant/50 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            >
              chevron_right
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
