import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import type { UserRole } from '../../auth/types/auth.types'
import { useAuth } from '../../auth/context/AuthContext'
import NewTicketModal from '../../tickets/components/NewTicketModal'

type NavItem = { to: string; icon: string; label: string; roles: UserRole[] }

const allNavItems: NavItem[] = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['admin'] },
  { to: '/dashboard/agente', icon: 'dashboard', label: 'Mi panel', roles: ['agent'] },
  { to: '/tickets', icon: 'confirmation_number', label: 'Tickets', roles: ['admin', 'agent'] },
  { to: '/agentes', icon: 'group', label: 'Agentes', roles: ['admin'] },
  { to: '/settings', icon: 'settings', label: 'Ajustes', roles: ['admin', 'agent'] },
]

function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const role = user?.role
  const navItems = allNavItems.filter((item) => (role ? item.roles.includes(role) : false))

  function onLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const displayName =
    user?.first_name || user?.last_name
      ? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()
      : user?.user_name ?? 'Usuario'

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <NewTicketModal open={newTicketOpen} onClose={() => setNewTicketOpen(false)} />

      <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-y-auto border-r border-white/5 bg-surface-container-low py-6">
        <div className="mb-8 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary shadow-lg shadow-primary/25">
              <span className="material-symbols-outlined text-[20px] text-slate-900">architecture</span>
            </div>
            <div>
              <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">Nocturnal</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                Architect v1.0
              </p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-[3px] border-primary bg-white/5 text-primary shadow-sm shadow-black/20'
                    : 'border-l-[3px] border-transparent text-on-surface-variant hover:bg-white/[0.04] hover:text-on-surface'
                }`
              }
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-2 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={() => setNewTicketOpen(true)}
            className="btn-new-ticket flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-slate-900 transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Nuevo ticket
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="fixed left-64 right-0 top-0 z-20 flex h-16 items-center justify-between gap-6 border-b border-white/5 bg-surface/90 px-8 py-3 backdrop-blur-xl">
        <div className="flex max-w-xl flex-1 items-center gap-3 rounded-full border border-white/10 bg-surface-container/40 px-4 py-2 shadow-inner shadow-black/20 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
          <span className="material-symbols-outlined text-on-surface-variant">search</span>
          <input
            type="search"
            placeholder="Buscar tickets, sistemas o usuarios…"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-0"
          />
        </div>

        <div className="flex shrink-0 items-center gap-5 text-on-surface-variant">
          <button type="button" className="rounded-lg p-1.5 transition-colors hover:bg-white/5 hover:text-on-surface">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </button>
          <button type="button" className="rounded-lg p-1.5 transition-colors hover:bg-white/5 hover:text-on-surface">
            <span className="material-symbols-outlined text-[22px]">help_outline</span>
          </button>
          <div className="hidden h-8 w-px bg-white/10 sm:block" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-on-surface">{displayName}</p>
              <p className="text-[11px] leading-tight text-on-surface-variant">
                {role === 'admin' ? 'Administrador' : 'Agente'}
              </p>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-surface-container-high text-sm font-bold text-primary shadow-md shadow-black/30"
              role="img"
              aria-label="Avatar de usuario"
            >
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="ml-64 mt-16 min-h-[calc(100vh-4rem)] bg-surface px-8 pb-12 pt-10">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
