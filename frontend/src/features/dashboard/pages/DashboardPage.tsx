import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { listAgents } from '../../agents/services/agentsApi'
import { useAuth } from '../../auth/context/AuthContext'
import { useCategoriesQuery } from '../../categories/hooks/useCategoriesQuery'
import type { TicketPriority } from '../../tickets/types/ticket.types'
import AgentStatusStackedChart from '../components/AgentStatusStackedChart'
import DashboardDateRangeFilter from '../components/DashboardDateRangeFilter'
import RecentActivityFeed from '../components/RecentActivityFeed'
import { useAgentStatusChart } from '../hooks/useAgentStatusChart'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useRecentActivity } from '../hooks/useRecentActivity'
import { defaultDashboardDateRange, isDateRangeInvalid } from '../utils/dateRange'

const PRIORITY_OPTS: { value: TicketPriority | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
]

const FILTER_SELECT_CLASS = 'dashboard-filter-input'

function formatAvgHours(h: number | null) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  return `${h.toFixed(1)} h`
}

function countLabel(loading: boolean, err: string | null, n: number | null) {
  if (loading) return '…'
  if (err) return '—'
  if (n != null) return String(n)
  return '—'
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  gradient,
}: {
  icon: string
  label: string
  value: string
  hint?: string
  gradient: string
}) {
  return (
    <div className="dashboard-kpi">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
      <div className="mb-3 flex items-center justify-between">
        <span className="material-symbols-outlined text-2xl text-on-surface-variant">{icon}</span>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
      <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">{value}</h3>
      {hint ? <p className="mt-auto pt-2 text-[10px] leading-snug text-on-surface-variant">{hint}</p> : null}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const segmentId = useId()
  const categoryId = useId()
  const priorityId = useId()

  const defaultRange = useMemo(() => defaultDashboardDateRange(), [])
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [segmentAgentId, setSegmentAgentId] = useState<number | ''>('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState<TicketPriority | ''>('')

  const dateRangeInvalid = isDateRangeInvalid(dateFrom, dateTo)

  const assignedToFilter = useMemo(() => {
    if (!isAdmin) return user?.id
    if (segmentAgentId === '') return undefined
    return typeof segmentAgentId === 'number' ? segmentAgentId : Number(segmentAgentId)
  }, [isAdmin, user?.id, segmentAgentId])

  const dashboardFilters = useMemo(
    () => ({
      assignedTo: assignedToFilter,
      category: category.trim() || undefined,
      priority: priority || undefined,
      createdFrom: dateRangeInvalid ? undefined : dateFrom,
      createdTo: dateRangeInvalid ? undefined : dateTo,
      enabled: !!user && !dateRangeInvalid,
    }),
    [assignedToFilter, category, priority, dateFrom, dateTo, dateRangeInvalid, user],
  )

  const stats = useDashboardStats(dashboardFilters)
  const chart = useAgentStatusChart(dashboardFilters)
  const activity = useRecentActivity(dashboardFilters)

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => listAgents(),
    enabled: !!user && isAdmin,
  })

  const categoriesQuery = useCategoriesQuery(!!user)
  const categoryOptions = categoriesQuery.data?.results ?? []

  const activeAgents = useMemo(
    () => (agentsQuery.data?.results ?? []).filter((a) => a.is_active),
    [agentsQuery.data?.results],
  )

  const scopeDescription = isAdmin
    ? segmentAgentId === ''
      ? 'Vista global: todos los agentes y administradores operativos.'
      : 'Vista segmentada: métricas solo del usuario seleccionado.'
    : 'Vista personal: solo tus tickets asignados.'

  const avgHint =
    stats.closedPopulation != null && stats.closedPopulation > 0
      ? `Media sobre ${stats.closedPopulation} cerrado${stats.closedPopulation === 1 ? '' : 's'} en el período.`
      : 'Sin cerrados en el período.'

  const rangeLabel = dateRangeInvalid
    ? 'Rango de fechas inválido'
    : `${dateFrom} — ${dateTo}`

  return (
    <div className="relative z-0 mx-auto max-w-[90rem] space-y-8">
      <header className="flex flex-col gap-4 border-b border-overlay/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-architectural text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
            Dashboard
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-[15px]">
            {scopeDescription}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Período activo</p>
          <p className="mt-0.5 text-sm font-medium text-on-surface">{rangeLabel}</p>
          <Link
            to="/tickets"
            className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
          >
            Ver listado de tickets →
          </Link>
        </div>
      </header>

      <section className="dashboard-panel p-5 sm:p-6" aria-labelledby="dashboard-filters-heading">
        <h3
          id="dashboard-filters-heading"
          className="font-architectural mb-4 text-sm font-bold uppercase tracking-wider text-on-surface-variant"
        >
          Filtros
        </h3>
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <DashboardDateRangeFilter
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
          />
          <div className="grid gap-4">
            {isAdmin ? (
              <div className="min-w-0">
                <label htmlFor={segmentId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                  Agente
                </label>
                <select
                  id={segmentId}
                  value={segmentAgentId === '' ? '' : String(segmentAgentId)}
                  onChange={(e) => {
                    const v = e.target.value
                    setSegmentAgentId(v === '' ? '' : Number(v))
                  }}
                  disabled={agentsQuery.isLoading}
                  className={`${FILTER_SELECT_CLASS} disabled:opacity-60`}
                >
                  <option value="">Todos</option>
                  {activeAgents.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {(a.full_name || a.username).trim()}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex min-h-[2.75rem] items-center rounded-lg border border-overlay/10 bg-surface-container-low/50 px-3 py-2">
                <p className="text-sm text-on-surface">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Ámbito · </span>
                  Solo tus tickets
                </p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor={categoryId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Categoría
              </label>
              <select
                id={categoryId}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="">Todas</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor={priorityId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Prioridad
              </label>
              <select
                id={priorityId}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority | '')}
                className={FILTER_SELECT_CLASS}
              >
                {PRIORITY_OPTS.map((p) => (
                  <option key={p.value || 'all'} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="dashboard-kpis-heading">
        <h3
          id="dashboard-kpis-heading"
          className="font-architectural mb-4 text-sm font-bold uppercase tracking-wider text-on-surface-variant"
        >
          Métricas del período
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <KpiCard
            icon="dataset"
            label="Total de tickets"
            value={countLabel(stats.loading, stats.error, stats.totalCount)}
            gradient="from-slate-400 via-slate-300 to-primary"
          />
          <KpiCard
            icon="inbox"
            label="Tickets abiertos"
            value={countLabel(stats.loading, stats.error, stats.openCount)}
            gradient="from-cyan-300 via-primary to-teal-400"
          />
          <KpiCard
            icon="task_alt"
            label="Tickets cerrados"
            value={countLabel(stats.loading, stats.error, stats.closedCount)}
            gradient="from-slate-500 via-sky-500 to-primary"
          />
          <KpiCard
            icon="schedule"
            label="Tiempo promedio de cierre"
            value={stats.loading ? '…' : stats.error ? '—' : formatAvgHours(stats.avgResolutionHours)}
            hint={avgHint}
            gradient="from-teal-700 via-primary to-primary-fixed"
          />
          <KpiCard
            icon="priority_high"
            label="Prioridad alta"
            value={countLabel(stats.loading, stats.error, stats.highPriorityCount)}
            gradient="from-amber-500 via-orange-400 to-primary"
          />
        </div>
        {stats.error ? (
          <p className="mt-3 text-sm text-error" role="alert">
            {stats.error}
          </p>
        ) : null}
      </section>

      <section
        className="grid grid-cols-1 gap-6 xl:grid-cols-5 xl:items-stretch"
        aria-label="Análisis y actividad"
      >
        <div className="dashboard-panel flex min-h-[22rem] flex-col p-5 sm:p-6 xl:col-span-3">
          <div className="dashboard-panel-header">
            <h3 className="font-architectural text-lg font-bold text-on-surface sm:text-xl">
              Tickets por agente y estado
            </h3>
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <AgentStatusStackedChart
              agents={chart.agents}
              statuses={chart.statuses}
              statusLabels={chart.statusLabels}
              maxTotal={chart.maxTotal}
              loading={chart.loading}
              error={chart.error}
            />
          </div>
        </div>

        <div className="dashboard-panel flex min-h-[22rem] flex-col p-5 sm:p-6 xl:col-span-2">
          <div className="dashboard-panel-header">
            <h3 className="font-architectural text-lg font-bold text-on-surface sm:text-xl">Actividad reciente</h3>
            <Link
              to="/tickets"
              className="btn-outline-primary shrink-0 rounded-md px-2 py-1 text-[11px] uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              Ver tickets
            </Link>
          </div>
          <div className="min-h-0 flex-1">
            <RecentActivityFeed
              items={activity.items}
              loading={activity.loading}
              error={activity.error}
              className="h-full max-h-[24rem] xl:max-h-none"
            />
          </div>
        </div>
      </section>

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
