import { NavLink } from 'react-router-dom'
import {
  Users, Camera, DollarSign, LayoutDashboard, LogOut,
  Building2, UserCog, Settings, User, Clock, ClipboardList,
  TrendingUp, X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Role } from '../../api/client'

const nav: { to: string; icon: any; label: string; roles: Role[] }[] = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',     roles: ['root', 'admin', 'professor'] },
  { to: '/meu-perfil', icon: User,            label: 'Meu Perfil',    roles: ['aluno'] },
  { to: '/schools',    icon: Building2,       label: 'Escolas',       roles: ['root'] },
  { to: '/users',      icon: UserCog,         label: 'Usuários',      roles: ['root', 'admin'] },
  { to: '/students',   icon: Users,           label: 'Alunos',        roles: ['root', 'admin', 'professor'] },
  { to: '/schedules',  icon: Clock,           label: 'Horários',      roles: ['root', 'admin'] },
  { to: '/attendance', icon: Camera,          label: 'Chamada',       roles: ['root', 'admin', 'professor'] },
  { to: '/sessions',   icon: ClipboardList,   label: 'Presenças',     roles: ['root', 'admin', 'professor'] },
  { to: '/fees',       icon: DollarSign,      label: 'Mensalidades',  roles: ['root', 'admin'] },
  { to: '/financeiro', icon: TrendingUp,      label: 'Financeiro',    roles: ['root', 'admin'] },
  { to: '/settings',   icon: Settings,        label: 'Configurações', roles: ['admin'] },
]

const ROLE_LABELS: Record<Role, string> = {
  root:      'Root',
  admin:     'Administrador',
  professor: 'Professor',
  aluno:     'Aluno',
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 flex flex-col
          transition-transform duration-300 ease-in-out
          md:static md:translate-x-0 md:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ backgroundColor: '#0d0d0d', willChange: 'transform', isolation: 'isolate' }}
      >
        {/* ── Header ─────────────────────────────── */}
        <div
          className="px-5 py-5 flex items-start justify-between gap-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm tracking-widest text-white flex-shrink-0"
                style={{ backgroundColor: '#CC0000' }}
              >GB</span>
              {' '}{user?.school_name || 'Gracie Barra'}
            </h1>
            <p className="text-sm text-gray-300 font-medium truncate mt-1">{user?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user ? ROLE_LABELS[user.role as Role] : ''}</p>
          </div>

          {/* Fechar mobile */}
          <button
            onClick={onClose}
            className="md:hidden flex-shrink-0 p-1 text-gray-500 hover:text-white transition-colors mt-0.5"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Navegação ──────────────────────────── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav
            .filter((item) => user && item.roles.includes(user.role as Role))
            .map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  isActive
                    ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all'
                    : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-all'
                }
                style={({ isActive }) =>
                  isActive
                    ? { backgroundColor: '#cc0000' }
                    : {}
                }
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  if (!el.style.backgroundColor) el.style.backgroundColor = 'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  if (el.style.backgroundColor === 'rgba(255,255,255,0.05)') el.style.backgroundColor = ''
                }}
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
        </nav>

        {/* ── Footer ─────────────────────────────── */}
        <div
          className="px-4 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Linha decorativa GB */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, #cc0000, transparent)' }} />
            <span className="text-[10px] font-bold tracking-widest" style={{ color: '#cc0000' }}>GRACIE BARRA</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, #cc0000, transparent)' }} />
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5 w-full"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
