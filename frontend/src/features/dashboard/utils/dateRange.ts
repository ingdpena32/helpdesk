/** Rango por defecto: primer día del mes actual hasta hoy (fecha local). */

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function defaultDashboardDateRange(): { from: string; to: string } {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    from: toDateInputValue(firstOfMonth),
    to: toDateInputValue(now),
  }
}

export function isDateRangeInvalid(from: string, to: string): boolean {
  if (!from || !to) return false
  return from > to
}
