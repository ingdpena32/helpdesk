import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { listAgents } from '../../agents/services/agentsApi'
import { useAuth } from '../../auth/context/AuthContext'
import { TICKET_CATEGORIES, type TicketPriority } from '../../tickets/types/ticket.types'
import { useDashboardStats } from '../hooks/useDashboardStats'

const PRIORITY_OPTS: { value: TicketPriority | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
]

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

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const segmentId = useId()
  const categoryId = useId()
  const priorityId = useId()

  const [segmentAgentId, setSegmentAgentId] = useState<number | ''>('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState<TicketPriority | ''>('')

  const assignedToFilter = useMemo(() => {
    if (!isAdmin) return user?.id
    if (segmentAgentId === '') return undefined
    return typeof segmentAgentId === 'number' ? segmentAgentId : Number(segmentAgentId)
  }, [isAdmin, user?.id, segmentAgentId])

  const stats = useDashboardStats({
    assignedTo: assignedToFilter,
    category: category.trim() || undefined,
    priority: priority || undefined,
    enabled: !!user,
  })

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: listAgents,
    enabled: !!user && isAdmin,
  })

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
    stats.sampleSize > 0 && stats.closedPopulation != null
      ? `Media calculada sobre los últimos ${stats.sampleSize} tickets cerrados mostrados (${stats.closedPopulation} cerrados en total en este filtro).`
      : 'Media de resolución sobre la muestra de tickets cerrados disponible.'

  return (
    <div className="relative z-0 space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">Dashboard</h2>
          <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">{scopeDescription}</p>
          <p className="mt-2 text-xs text-on-surface-variant">
            Los KPI se recalculan al cambiar filtros (misma API de tickets).{' '}
            <Link to="/tickets" className="font-semibold text-primary hover:underline">
              Ir al listado de tickets
            </Link>
          </p>
        </div>
      </div>

      <div className="dashboard-panel space-y-4 p-5 sm:p-6">
        <h3 className="font-architectural text-sm font-bold uppercase tracking-wider text-on-surface-variant">
          Filtros del panel
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isAdmin ? (
            <div>
              <label htmlFor={segmentId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Segmentar por agente
              </label>
              <select
                id={segmentId}
                value={segmentAgentId === '' ? '' : String(segmentAgentId)}
                onChange={(e) => {
                  const v = e.target.value
                  setSegmentAgentId(v === '' ? '' : Number(v))
                }}
                disabled={agentsQuery.isLoading}
                className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
              >
                <option value="">Todos los agentes</option>
                {activeAgents.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {(a.full_name || a.username).trim()} (#{a.id})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-surface-container-low/50 px-3 py-2.5 text-sm text-on-surface-variant">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/80">Ámbito</span>
              <p className="mt-1 font-medium text-on-surface">Solo tus tickets asignados</p>
            </div>
          )}
          <div>
            <label htmlFor={categoryId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Categoría
            </label>
            <select
              id={categoryId}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
            >
              <option value="">Todas</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={priorityId} className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Prioridad
            </label>
            <select
              id={priorityId}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority | '')}
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 via-slate-300 to-primary" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-on-surface-variant">dataset</span>
            <span className="text-xs font-bold text-on-surface-variant">API</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Total (ámbito)</p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">
            {countLabel(stats.loading, stats.error, stats.totalCount)}
          </h3>
        </div>

        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-primary to-teal-400" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-primary">inbox</span>
            <span className="text-xs font-bold text-on-surface-variant">API</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Abiertos</p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">
            {countLabel(stats.loading, stats.error, stats.openCount)}
          </h3>
        </div>

        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-400 via-primary to-sky-400" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-sky-300">pending_actions</span>
            <span className="text-xs font-bold text-on-surface-variant">API</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">En progreso</p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">
            {countLabel(stats.loading, stats.error, stats.inProgressCount)}
          </h3>
        </div>

        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-500 via-sky-500 to-primary" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-sky-300">task_alt</span>
            <span className="text-xs font-bold text-on-surface-variant">API</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Resueltos (cerrados)</p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">
            {countLabel(stats.loading, stats.error, stats.closedCount)}
          </h3>
        </div>

        <div className="dashboard-kpi">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-700 via-primary to-primary-fixed" />
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined text-2xl text-primary">schedule</span>
            <span className="text-xs font-bold text-on-surface-variant">API</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Tiempo medio hasta cierre
          </p>
          <h3 className="font-architectural mt-1.5 text-3xl font-bold tracking-tight text-on-surface">
            {stats.loading ? '…' : stats.error ? '—' : formatAvgHours(stats.avgResolutionHours)}
          </h3>
          <p className="mt-2 text-[10px] leading-snug text-on-surface-variant">{avgHint}</p>
        </div>
      </div>

      {stats.error ? (
        <p className="text-sm text-red-200" role="alert">
          {stats.error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="dashboard-panel relative flex min-h-[16rem] flex-col p-8 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-architectural text-xl font-bold text-on-surface">Evolución del volumen de tickets</h3>
            <button
              type="button"
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Más opciones"
            >
              <span className="material-symbols-outlined text-xl">more_horiz</span>
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 bg-surface-container-low/40 px-6 py-16">
            <p className="text-center text-sm text-on-surface-variant">Sin serie temporal conectada aún.</p>
          </div>
        </div>

        <div className="dashboard-panel flex flex-col p-8">
          <h3 className="font-architectural mb-6 text-xl font-bold text-on-surface">Por categoría</h3>
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-surface-container-low/40 py-12">
            <p className="px-4 text-center text-sm text-on-surface-variant">
              Use el filtro de categoría arriba para acotar KPIs; gráfico de barras pendiente de conectar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="dashboard-panel p-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-architectural text-xl font-bold text-on-surface">Actividad reciente</h3>
            <Link
              to="/tickets"
              className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              Ver tickets
            </Link>
          </div>
          <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-white/15 bg-surface-container-low/40 py-12">
            <p className="px-4 text-center text-sm text-on-surface-variant">
              Resumen operativo unificado; feed de actividad en tiempo real pendiente.
            </p>
          </div>
        </div>

        <div className="dashboard-panel p-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-architectural text-xl font-bold text-on-surface">Vencimientos de SLA</h3>
          </div>
          <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-white/15 bg-surface-container-low/40 py-12">
            <p className="px-4 text-center text-sm text-on-surface-variant">Sin vencimientos de SLA configurados.</p>
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
