import { useAgentsQuery } from '../hooks/useAgentsQuery'

function AgentsPage() {
  const { data, isLoading, error } = useAgentsQuery()

  return (
    <section className="space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">Agentes</h2>
          <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
            Perfiles de agente expuestos por la API (`/api/agents/`).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="dashboard-panel overflow-hidden p-0 xl:col-span-8">
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="border-b border-white/10 bg-surface-container-low/60 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                <th className="px-6 py-4">Agente</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Carga</th>
                <th className="px-6 py-4 text-right">Activo</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {error ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                    {(error as Error).message}
                  </td>
                </tr>
              ) : null}
              {data && data.results.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-sm text-on-surface-variant">
                    No hay agentes registrados.
                  </td>
                </tr>
              ) : null}
              {data?.results.map((a) => (
                <tr key={a.id} className="border-b border-white/5 text-sm text-on-surface">
                  <td className="px-6 py-4 font-medium">{a.username}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.role}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.workload}</td>
                  <td className="px-6 py-4 text-right text-on-surface-variant">{a.is_active ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="dashboard-panel p-6 xl:col-span-4">
          <h3 className="font-architectural text-xl font-bold text-on-surface">Niveles de soporte</h3>
          <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
            Los roles L1–L3 y Admin provienen del modelo `AgentProfile` en el backend.
          </p>
        </aside>
      </div>
    </section>
  )
}

export default AgentsPage
