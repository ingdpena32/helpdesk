import { useMutation } from '@tanstack/react-query'

import { ApiError } from '../../../shared/api/client'
import { useAuth } from '../../auth/context/AuthContext'
import { canExportSystemData, canManageCategories } from '../../auth/permissions'
import CategoryAdminPanel from '../../categories/components/CategoryAdminPanel'
import { useCategoriesQuery } from '../../categories/hooks/useCategoriesQuery'
import { fetchTicketsExport } from '../services/adminExportApi'

function triggerJsonDownload(data: unknown, filenameBase: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function exportErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'No se pudo generar la exportación.'
  try {
    const body = JSON.parse(err.message) as { error?: string }
    if (typeof body.error === 'string') return body.error
  } catch {
    /* no JSON */
  }
  return err.message || 'No se pudo generar la exportación.'
}

export default function SettingsPage() {
  const { user } = useAuth()
  const showExport = canExportSystemData(user?.role)
  const showCategories = canManageCategories(user?.role)
  const categoriesQuery = useCategoriesQuery(showCategories)

  const exportMutation = useMutation({
    mutationFn: fetchTicketsExport,
    onSuccess: (payload) => {
      const stamp = payload.generated_at.replace(/[:.]/g, '-').slice(0, 19)
      triggerJsonDownload(payload, `helpdesk-tickets-export-${stamp}`)
    },
  })

  return (
    <section className="space-y-10">
      <div>
        <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">Ajustes</h2>
        <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
          Preferencias y herramientas administrativas. Las exportaciones solo están disponibles para administradores.
        </p>
      </div>

      {showCategories ? (
        <CategoryAdminPanel
          categories={categoriesQuery.data?.results ?? []}
          loading={categoriesQuery.isLoading}
        />
      ) : null}

      {showExport ? (
        <div className="dashboard-panel space-y-4 p-8">
          <h3 className="font-architectural text-lg font-bold text-on-surface">Exportación de tickets</h3>
          <p className="text-sm text-on-surface-variant">
            Descarga un JSON con todos los tickets no eliminados, asignación, transferencias y una muestra reciente de
            auditoría por ticket. Uso interno y respaldo lógico.
          </p>
          {exportMutation.isError ? (
            <p className="text-sm text-red-200" role="alert">
              {exportErrorMessage(exportMutation.error)}
            </p>
          ) : null}
          <button
            type="button"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            {exportMutation.isPending ? 'Generando…' : 'Descargar exportación JSON'}
          </button>
        </div>
      ) : !showCategories ? (
        <div className="dashboard-panel p-8">
          <p className="text-sm text-on-surface-variant">
            No hay opciones adicionales para tu rol. Si necesitas un informe global, contacta con un administrador.
          </p>
        </div>
      ) : null}
    </section>
  )
}
