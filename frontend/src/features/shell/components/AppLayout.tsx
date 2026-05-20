import { useId, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { AuthenticatedProfilePhoto } from '../../../shared/components/AuthenticatedProfilePhoto'
import { BrandMark } from '../../../shared/components/BrandMark'
import type { UserRole } from '../../auth/types/auth.types'
import { useAuth } from '../../auth/context/AuthContext'
import { withPhotoCacheBust } from '../../../shared/lib/photoUrl'
import NewTicketModal from '../../tickets/components/NewTicketModal'
import NotificationCenter from '../../notifications/components/NotificationCenter'
import { SearchProvider, useSearch } from '../context/SearchContext'
import { searchPlaceholder } from '../hooks/useSearchScope'

type NavItem = { to: string; icon: string; label: string; roles: UserRole[] }

const allNavItems: NavItem[] = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['admin', 'agent'] },
  { to: '/tickets', icon: 'confirmation_number', label: 'Tickets', roles: ['admin', 'agent'] },
  { to: '/agentes', icon: 'group', label: 'Agentes', roles: ['admin', 'agent'] },
  { to: '/settings', icon: 'settings', label: 'Ajustes', roles: ['admin', 'agent'] },
]

function HeaderSearch() {
  const { scope, query, setQuery, clearQuery } = useSearch()
  const searchFieldId = useId()

  return (
    <div
      className={`flex max-w-xl flex-1 items-center gap-3 rounded-full border px-4 py-2 shadow-inner shadow-elevation/20 transition-colors ${
        scope
          ? 'border-overlay/10 bg-surface-container/40 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20'
          : 'border-overlay/5 bg-surface-container/20 opacity-60'
      }`}
    >
      <span className="material-symbols-outlined text-on-surface-variant">search</span>
      <label htmlFor={searchFieldId} className="sr-only">
        {searchPlaceholder(scope)}
      </label>
      <input
        id={searchFieldId}
        type="search"
        value={query}
        disabled={!scope}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') clearQuery()
        }}
        placeholder={searchPlaceholder(scope)}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
      />
      {query && scope ? (
        <button type="button" onClick={clearQuery} className="btn-icon shrink-0 p-1" aria-label="Limpiar búsqueda">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      ) : null}
    </div>
  )
}

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
    user?.full_name?.trim() ||
    (user?.first_name || user?.last_name
      ? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()
      : user?.user_name ?? 'Usuario')

  const avatarPath = withPhotoCacheBust(user?.profile_photo_url, user?.avatar_cache_bust)

  return (
    <SearchProvider>
    <div className="min-h-screen bg-surface text-on-surface">
      <NewTicketModal open={newTicketOpen} onClose={() => setNewTicketOpen(false)} />

      <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-y-auto border-r border-overlay/5 bg-surface-container-low py-6">
        <BrandMark variant="sidebar" />

        <nav className="flex flex-1 flex-col space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-[3px] border-primary bg-overlay/5 text-primary shadow-sm shadow-elevation/20'
                    : 'border-l-[3px] border-transparent text-on-surface-variant hover:bg-overlay/[0.04] hover:text-on-surface'
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
            className="btn-new-ticket flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold  transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Nuevo ticket
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="btn-secondary flex w-full items-center justify-center gap-2 py-2.5 text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="fixed left-64 right-0 top-0 z-40 flex h-16 items-center justify-between gap-6 overflow-visible border-b border-overlay/5 bg-surface/90 px-8 py-3 backdrop-blur-xl">
        <HeaderSearch />

        <div className="flex shrink-0 items-center gap-5 text-on-surface-variant">
          <NotificationCenter />
          <button type="button" className="btn-icon p-1.5">
            <span className="material-symbols-outlined text-[22px]">help_outline</span>
          </button>
          <div className="hidden h-8 w-px bg-overlay/10 sm:block" />
          <button
            type="button"
            onClick={() => navigate('/mi-perfil')}
            className="group flex max-w-[min(100%,18rem)] items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 text-left transition-colors hover:border-overlay/10 hover:bg-overlay/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            aria-label="Ir a mi perfil"
          >
            <div className="hidden min-w-0 flex-1 text-right sm:block">
              <p className="truncate text-sm font-semibold leading-tight text-on-surface transition-colors group-hover:text-primary">
                {displayName}
              </p>
              <p className="truncate text-[11px] leading-tight text-on-surface-variant">
                {role === 'admin' ? 'Administrador · operativo' : 'Agente'}
              </p>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-surface-container-high text-sm font-bold text-primary shadow-md shadow-elevation/30 transition-transform group-hover:scale-[1.03] group-hover:border-primary/50"
              role="presentation"
            >
              {avatarPath ? (
                <AuthenticatedProfilePhoto
                  key={`hdr-av-${user?.avatar_cache_bust ?? 0}-${avatarPath}`}
                  path={avatarPath}
                  alt=""
                  className="h-full w-full object-cover"
                  fallback={displayName.slice(0, 1).toUpperCase()}
                />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>
          </button>
        </div>
      </header>

      <main className="ml-64 mt-16 min-h-[calc(100vh-4rem)] bg-surface px-8 pb-12 pt-10">
        <Outlet />
      </main>
    </div>
    </SearchProvider>
  )
}

export default AppLayout
