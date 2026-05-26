import { useId } from 'react'

import { isDateRangeInvalid } from '../utils/dateRange'

type Props = {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

export default function DashboardDateRangeFilter({ from, to, onFromChange, onToChange }: Props) {
  const fromId = useId()
  const toId = useId()
  const invalid = isDateRangeInvalid(from, to)

  return (
    <div className="w-full">
      <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Rango de fechas</span>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={fromId} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
            Desde
          </label>
          <input
            id={fromId}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFromChange(e.target.value)}
            className="dashboard-filter-input"
          />
        </div>
        <div>
          <label htmlFor={toId} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
            Hasta
          </label>
          <input
            id={toId}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onToChange(e.target.value)}
            className="dashboard-filter-input"
          />
        </div>
      </div>
      {invalid ? (
        <p className="mt-2 text-xs text-error" role="alert">
          La fecha «Desde» no puede ser posterior a «Hasta».
        </p>
      ) : null}
    </div>
  )
}
