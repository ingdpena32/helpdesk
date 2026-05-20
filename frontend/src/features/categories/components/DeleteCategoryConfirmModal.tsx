type Props = {
  open: boolean
  name: string
  loading: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteCategoryConfirmModal({
  open,
  name,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-category-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-overlay/10 bg-surface-container-high p-6 shadow-2xl">
        <h2 id="delete-category-title" className="font-architectural text-lg font-bold text-on-surface">
          Eliminar categoría
        </h2>
        <p className="mt-3 text-sm text-on-surface-variant">
          ¿Eliminar <span className="font-semibold text-on-surface">{name}</span>? Solo es posible si ningún ticket la
          usa.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="btn-danger-outline px-4 py-2 text-sm"
          >
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
