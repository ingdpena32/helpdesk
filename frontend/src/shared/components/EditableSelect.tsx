import { useId } from 'react'

export type EditableSelectOption = {
  value: string
  label: string
}

type EditableSelectProps = {
  label: string
  value: string
  options: EditableSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  saving?: boolean
  error?: string | null
  hint?: string
  id?: string
}

export function EditableSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  saving = false,
  error = null,
  hint,
  id: idProp,
}: EditableSelectProps) {
  const autoId = useId()
  const fieldId = idProp ?? autoId
  const isDisabled = disabled || saving

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
        {label}
      </label>
      <select
        id={fieldId}
        value={value}
        disabled={isDisabled}
        onChange={(e) => {
          const next = e.target.value
          if (next === value || isDisabled) return
          onChange(next)
        }}
        className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none transition-shadow focus:border-primary/40 focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {saving ? <p className="mt-1.5 text-xs font-medium text-on-surface-variant">Guardando…</p> : null}
      {error ? (
        <p className="mt-1.5 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {hint && !error ? <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant">{hint}</p> : null}
    </div>
  )
}
