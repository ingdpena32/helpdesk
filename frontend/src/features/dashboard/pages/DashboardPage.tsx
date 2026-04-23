import { useOpenTicketsCount } from '../hooks/useOpenTicketsCount'

function DashboardPage() {
  const { count, loading, error } = useOpenTicketsCount()
  const openLabel = loading ? '…' : error ? '—' : count !== null ? String(count) : '—'

  return (
    <div className="relative z-0 space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">Resumen</h2>
          <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
            Indicadores básicos enlazados a la API; el resto se completará con más datos.
          </p>
        </div>
        <div className="dashboard-range-pill flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="rounded-lg bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Últimas 24 horas
          </button>
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            Rango personalizado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-primary to-teal-400" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-primary">inbox</span>
            <span className="text-xs font-bold text-on-surface-variant">API</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Tickets abiertos
          </p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">{openLabel}</h3>
        </div>

        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-500 via-sky-500 to-primary" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-sky-300">task_alt</span>
            <span className="text-xs font-bold text-on-surface-variant">—</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Resueltos hoy</p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">—</h3>
        </div>

        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-700 via-primary to-primary-fixed" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-primary">schedule</span>
            <span className="text-xs font-bold text-on-surface-variant">—</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Tiempo de respuesta
          </p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">—</h3>
        </div>

        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-tertiary to-orange-500" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-tertiary">verified_user</span>
            <span className="text-xs font-bold text-on-surface-variant">—</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Cumplimiento de SLA
          </p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">—</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="dashboard-panel relative flex min-h-[16rem] flex-col p-8 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-architectural text-xl font-bold text-on-surface">
              Evolución del volumen de tickets
            </h3>
            <button
              type="button"
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Más opciones"
            >
              <span className="material-symbols-outlined text-xl">more_horiz</span>
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 bg-surface-container-low/40 px-6 py-16">
            <p className="text-center text-sm text-on-surface-variant">Sin datos de volumen para mostrar.</p>
          </div>
        </div>

        <div className="dashboard-panel flex flex-col p-8">
          <h3 className="font-architectural mb-6 text-xl font-bold text-on-surface">Por categoría</h3>
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-surface-container-low/40 py-12">
            <p className="px-4 text-center text-sm text-on-surface-variant">Sin distribución por categoría.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="dashboard-panel p-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-architectural text-xl font-bold text-on-surface">Actividad reciente</h3>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              Ver todo
            </button>
          </div>
          <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-white/15 bg-surface-container-low/40 py-12">
            <p className="px-4 text-center text-sm text-on-surface-variant">Sin actividad reciente.</p>
          </div>
        </div>

        <div className="dashboard-panel p-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-architectural text-xl font-bold text-on-surface">Vencimientos de SLA</h3>
          </div>
          <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-white/15 bg-surface-container-low/40 py-12">
            <p className="px-4 text-center text-sm text-on-surface-variant">Sin vencimientos de SLA.</p>
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none fixed -bottom-40 -right-40 z-0 h-80 w-80 rounded-full bg-primary/10 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -left-40 -top-40 z-0 h-80 w-80 rounded-full bg-sky-500/5 blur-[100px]"
        aria-hidden
      />
    </div>
  )
}

export default DashboardPage
