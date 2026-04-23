import { useOpenTicketsCount } from '../hooks/useOpenTicketsCount'

function AgentDashboardPage() {
  const { count, loading, error } = useOpenTicketsCount()
  const openLabel = loading ? '…' : error ? '—' : count !== null ? String(count) : '—'

  return (
    <div className="relative z-0 space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Vista agente</p>
          <h2 className="font-architectural mt-1 text-4xl font-extrabold tracking-tight text-on-surface">
            Tu bandeja
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
            Resumen operativo para el rol de agente. Los listados de administración no están disponibles aquí.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-primary to-teal-400" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-primary">inbox</span>
            <span className="text-xs font-bold text-on-surface-variant">API</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Tickets abiertos</p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">{openLabel}</h3>
        </div>
      </div>
    </div>
  )
}

export default AgentDashboardPage
