import type { AgentBreakdownAgent } from '../types/dashboard.types'

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-cyan-500',
  in_progress: 'bg-indigo-500',
  closed: 'bg-slate-500',
}

const STATUS_FALLBACK = 'bg-primary/70'

type Props = {
  agents: AgentBreakdownAgent[]
  statuses: string[]
  statusLabels: Record<string, string>
  maxTotal: number
  loading: boolean
  error: string | null
}

export default function AgentStatusStackedChart({
  agents,
  statuses,
  statusLabels,
  maxTotal,
  loading,
  error,
}: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center rounded-xl border border-dashed border-overlay/15 bg-surface-container-low/40 py-12">
        <p className="text-sm text-on-surface-variant">Cargando gráfico…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center rounded-xl border border-dashed border-error/30 bg-surface-container-low/40 py-12">
        <p className="px-4 text-center text-sm text-error" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center rounded-xl border border-dashed border-overlay/15 bg-surface-container-low/40 py-12">
        <p className="px-4 text-center text-sm text-on-surface-variant">
          No hay tickets en el rango y filtros seleccionados.
        </p>
      </div>
    )
  }

  const scaleMax = maxTotal > 0 ? maxTotal : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
        {statuses.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm ${STATUS_COLORS[s] ?? STATUS_FALLBACK}`}
              aria-hidden
            />
            {statusLabels[s] ?? s}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="flex min-w-min items-end justify-center gap-4 px-2 sm:justify-start"
          style={{ minHeight: '14rem' }}
          role="img"
          aria-label="Gráfico de barras apiladas: tickets por agente y estado"
        >
          {agents.map((agent) => {
            const barHeightPct = (agent.total / scaleMax) * 100
            return (
              <div
                key={agent.agent_id ?? 'unassigned'}
                className="flex w-12 shrink-0 flex-col items-center sm:w-14 md:w-16"
              >
                <span className="mb-1 text-[10px] font-semibold tabular-nums text-on-surface-variant">
                  {agent.total}
                </span>
                <div
                  className="flex w-full flex-col justify-end rounded-t-md border border-overlay/10 bg-surface-container-low/50"
                  style={{ height: '10rem' }}
                  title={`${agent.agent_name}: ${agent.total} tickets`}
                >
                  <div
                    className="flex w-full flex-col justify-end overflow-hidden rounded-t-md"
                    style={{ height: `${barHeightPct}%`, minHeight: agent.total > 0 ? '4px' : 0 }}
                  >
                    {statuses.map((status) => {
                      const n = agent.by_status[status] ?? 0
                      if (n <= 0) return null
                      const segPct = agent.total > 0 ? (n / agent.total) * 100 : 0
                      return (
                        <div
                          key={status}
                          className={`w-full ${STATUS_COLORS[status] ?? STATUS_FALLBACK}`}
                          style={{ height: `${segPct}%`, minHeight: '2px' }}
                          title={`${statusLabels[status] ?? status}: ${n}`}
                        />
                      )
                    })}
                  </div>
                </div>
                <span
                  className="mt-2 max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight text-on-surface"
                  title={agent.agent_name}
                >
                  {agent.agent_name}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
