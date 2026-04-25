import { Navigate, Route, Routes } from 'react-router-dom'

import ProtectedRoute from '../features/auth/components/ProtectedRoute'
import RoleRoute from '../features/auth/components/RoleRoute'
import RootRedirect from '../features/auth/components/RootRedirect'
import LoginPage from '../features/auth/pages/LoginPage'
import AgentsPage from '../features/agents/pages/AgentsPage'
import AgentDashboardPage from '../features/dashboard/pages/AgentDashboardPage'
import DashboardPage from '../features/dashboard/pages/DashboardPage'
import SettingsPage from '../features/settings/pages/SettingsPage'
import AppLayout from '../features/shell/components/AppLayout'
import TicketDetailPage from '../features/tickets/pages/TicketDetailPage'
import TicketsPage from '../features/tickets/pages/TicketsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/dashboard"
            element={
              <RoleRoute allowed={['admin']}>
                <DashboardPage />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/agente"
            element={
              <RoleRoute allowed={['agent']}>
                <AgentDashboardPage />
              </RoleRoute>
            }
          />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route
            path="/agentes"
            element={
              <RoleRoute allowed={['admin']}>
                <AgentsPage />
              </RoleRoute>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
