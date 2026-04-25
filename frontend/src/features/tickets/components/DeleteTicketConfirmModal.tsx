import { useEffect, useId } from 'react'

type Props = {
  open: boolean
  title: string
  loading?: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteTicketConfirmModal({
  open,
  title,
  loading = false,
  error,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1e293b] p-6 shadow-2xl"
      >
        <h2 id={titleId} className="font-architectural text-lg font-bold text-on-surface">
          Eliminar ticket
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          ¿Seguro que deseas eliminar el ticket <span className="font-semibold text-on-surface">{title}</span>? Es una
          eliminación lógica: no se borrará de la base de datos, pero dejará de mostrarse en el sistema.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-white/5 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {loading ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
