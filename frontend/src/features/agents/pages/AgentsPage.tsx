import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { useAuth } from '../../auth/context/AuthContext'
import CreateAgentModal from '../components/CreateAgentModal'
import EditAgentModal from '../components/EditAgentModal'
import { useAgentsQuery } from '../hooks/useAgentsQuery'
import { deleteAgent } from '../services/agentsApi'
import type { Agent } from '../types/agent.types'

export default function AgentsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useAgentsQuery()
  const [createOpen, setCreateOpen] = useState(false)
  const [editAgent, setEditAgent] = useState<Agent | null>(null)

  /** Cuenta administradora del sistema: no se gestiona como agente desde esta UI. */
  function isProtectedAdminAccount(a: Agent): boolean {
    return (a.system_role || '').toLowerCase() === 'admin'
  }

  const deleteMutation = useMutation({
    mutationFn: deleteAgent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })

  function onDeleteClick(a: Agent) {
    if (!isAdmin) return
    if (
      !window.confirm(
        `¿Desactivar al agente ${(a.full_name || a.username).trim()}? No podrá iniciar sesión hasta que un administrador lo reactive.`,
      )
    ) {
      return
    }
    deleteMutation.mutate(a.id)
  }

  return (
    <section className="space-y-10">
      <CreateAgentModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditAgentModal open={!!editAgent} agent={editAgent} onClose={() => setEditAgent(null)} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">Agentes</h2>
          <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
            Directorio del equipo de soporte. Los agentes pueden consultar el listado; solo los administradores pueden
            crear, editar o desactivar cuentas.
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-new-ticket shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-900"
          >
            Crear agente
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="dashboard-panel overflow-x-auto p-0 xl:col-span-12">
          <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="border-b border-white/10 bg-surface-container-low/60 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                <th className="px-6 py-4">Agente</th>
                <th className="px-6 py-4">Email corporativo</th>
                <th className="px-6 py-4">Departamento</th>
                <th className="px-6 py-4">Cargo</th>
                <th className="px-6 py-4">Permisos</th>
                <th className="px-6 py-4">Carga</th>
                <th className="px-6 py-4">Activo</th>
                {isAdmin ? <th className="px-6 py-4 text-right">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {error ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                    {(error as Error).message}
                  </td>
                </tr>
              ) : null}
              {data && data.results.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                    No hay agentes registrados.
                  </td>
                </tr>
              ) : null}
              {data?.results.map((a) => (
                <tr key={a.id} className="border-b border-white/5 text-sm text-on-surface">
                  <td className="px-6 py-4 font-medium">
                    <div className="flex flex-col">
                      <span>{(a.full_name || a.username).trim()}</span>
                      <span className="text-xs text-on-surface-variant">{a.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.corporate_email || '—'}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.department_name ?? '—'}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.professional_role?.trim() || '—'}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.role}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.workload}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.is_active ? 'Sí' : 'No'}</td>
                  {isAdmin ? (
                    <td className="px-6 py-4 text-right">
                      {isProtectedAdminAccount(a) ? (
                        <span className="text-xs text-on-surface-variant">—</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditAgent(a)}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/5"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteClick(a)}
                            disabled={deleteMutation.isPending || !a.is_active}
                            className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Desactivar
                          </button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
