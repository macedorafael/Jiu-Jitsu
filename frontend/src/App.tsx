import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudentsPage from './pages/Students/StudentsPage'
import AttendancePage from './pages/Attendance/AttendancePage'
import FeesPage from './pages/Fees/FeesPage'
import FinanceiroPage from './pages/Financeiro/FinanceiroPage'
import SchoolsPage from './pages/Schools/SchoolsPage'
import UsersPage from './pages/Users/UsersPage'
import ChangePasswordPage from './pages/ChangePassword/ChangePasswordPage'
import AlunoDashboardPage from './pages/AlunoDashboard/AlunoDashboardPage'
import SettingsPage from './pages/Settings/SettingsPage'
import SchedulesPage from './pages/Schedules/SchedulesPage'
import SessionsPage from './pages/Sessions/SessionsPage'
import HelpPage from './pages/Help/HelpPage'
import { Role } from './api/client'

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fecha a sidebar ao navegar
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>
  if (!user) return <Navigate to="/login" replace />

  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile — oculto em md+ */}
        <header
          className="md:hidden sticky top-0 z-10 text-white flex items-center gap-3 px-4 py-3 shadow-lg"
          style={{ backgroundColor: '#0d0d0d', borderBottom: '2px solid #cc0000' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-lg transition-colors hover:bg-white/10"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-sm truncate">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs tracking-widest text-white flex-shrink-0"
              style={{ backgroundColor: '#CC0000' }}
            >GB</span>
            {' '}{user.school_name || 'Gracie Barra'}
          </span>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function RoleRoute({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role as Role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/meu-perfil" element={
              <RoleRoute roles={['aluno']}><AlunoDashboardPage /></RoleRoute>
            } />
            <Route path="/schools" element={
              <RoleRoute roles={['root']}><SchoolsPage /></RoleRoute>
            } />
            <Route path="/users" element={
              <RoleRoute roles={['root', 'admin']}><UsersPage /></RoleRoute>
            } />
            <Route path="/students" element={
              <RoleRoute roles={['root', 'admin', 'admin_especifico', 'professor']}><StudentsPage /></RoleRoute>
            } />
            <Route path="/attendance" element={
              <RoleRoute roles={['root', 'admin', 'admin_especifico', 'professor']}><AttendancePage /></RoleRoute>
            } />
            <Route path="/fees" element={
              <RoleRoute roles={['root', 'admin', 'admin_especifico']}><FeesPage /></RoleRoute>
            } />
            <Route path="/financeiro" element={
              <RoleRoute roles={['root', 'admin', 'admin_especifico']}><FinanceiroPage /></RoleRoute>
            } />
            <Route path="/schedules" element={
              <RoleRoute roles={['root', 'admin', 'admin_especifico']}><SchedulesPage /></RoleRoute>
            } />
            <Route path="/sessions" element={
              <RoleRoute roles={['root', 'admin', 'admin_especifico', 'professor']}><SessionsPage /></RoleRoute>
            } />
            <Route path="/settings" element={
              <RoleRoute roles={['admin']}><SettingsPage /></RoleRoute>
            } />
            <Route path="/help" element={<HelpPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
