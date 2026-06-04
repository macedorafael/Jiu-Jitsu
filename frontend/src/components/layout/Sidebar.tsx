import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Users, Camera, DollarSign, LayoutDashboard, LogOut,
  Building2, UserCog, Settings, User, Clock, ClipboardList,
  TrendingUp, X, KeyRound, Eye, EyeOff, HelpCircle, Globe,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Role, authApi, schoolsApi } from '../../api/client'

// ── Modal de troca de senha ───────────────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext]       = useState(false)

  async function handleSave() {
    setError('')
    if (next.length < 6)         { setError('A nova senha deve ter pelo menos 6 caracteres.'); return }
    if (next !== confirm)        { setError('As senhas não coincidem.'); return }
    if (next === current)        { setError('A nova senha deve ser diferente da atual.'); return }
    setSaving(true)
    try {
      await authApi.changePassword({ current_password: current, new_password: next })
      setSuccess(true)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Erro ao alterar senha.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary-500" />
            <h3 className="font-bold text-gray-900">Alterar senha</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {success ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-green-600 font-semibold">Senha alterada com sucesso!</p>
            <button className="btn-primary w-full" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <>
            {/* Senha atual */}
            <div>
              <label className="block text-sm font-medium mb-1">Senha atual</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className="input pr-10"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowCurrent((v) => !v)}
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Nova senha */}
            <div>
              <label className="block text-sm font-medium mb-1">Nova senha</label>
              <div className="relative">
                <input
                  type={showNext ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowNext((v) => !v)}
                >
                  {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirmar */}
            <div>
              <label className="block text-sm font-medium mb-1">Confirmar nova senha</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={handleSave} disabled={saving || !current || !next || !confirm}>
                {saving ? 'Salvando...' : 'Alterar senha'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Seletor de escola para root ───────────────────────────────────────────────
function SchoolSelector() {
  const { viewAsSchool, setViewAsSchool } = useAuth()
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    schoolsApi.list().then(({ data }) => setSchools(data)).catch(() => {})
  }, [])

  return (
    <div className="mx-3 mb-2">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1 mb-1 flex items-center gap-1">
        <Globe size={10} /> Visualizando escola
      </p>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-all"
          style={{ backgroundColor: viewAsSchool ? 'rgba(204,0,0,0.15)' : 'rgba(255,255,255,0.05)', color: viewAsSchool ? '#ff6666' : '#9ca3af' }}
        >
          <span className="truncate font-medium">
            {viewAsSchool ? viewAsSchool.name : 'Todas as escolas'}
          </span>
          <span className="text-xs flex-shrink-0">▾</span>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              className="w-full text-left text-sm px-3 py-2.5 hover:bg-white/5 transition-colors"
              style={{ color: !viewAsSchool ? '#ffffff' : '#9ca3af' }}
              onClick={() => { setViewAsSchool(null); setOpen(false) }}
            >
              🌐 Todas as escolas
            </button>
            {schools.map((s) => (
              <button
                key={s.id}
                className="w-full text-left text-sm px-3 py-2.5 hover:bg-white/5 transition-colors border-t"
                style={{ color: viewAsSchool?.id === s.id ? '#ff6666' : '#9ca3af', borderColor: 'rgba(255,255,255,0.05)' }}
                onClick={() => { setViewAsSchool(s); setOpen(false) }}
              >
                🏫 {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const nav: { to: string; icon: any; label: string; roles: Role[] }[] = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',     roles: ['root', 'admin', 'admin_especifico', 'professor'] },
  { to: '/meu-perfil', icon: User,            label: 'Meu Perfil',    roles: ['aluno'] },
  { to: '/schools',    icon: Building2,       label: 'Escolas',       roles: ['root'] },
  { to: '/users',      icon: UserCog,         label: 'Usuários',      roles: ['root', 'admin'] },
  { to: '/students',   icon: Users,           label: 'Alunos',        roles: ['root', 'admin', 'admin_especifico', 'professor'] },
  { to: '/schedules',  icon: Clock,           label: 'Horários',      roles: ['root', 'admin', 'admin_especifico'] },
  { to: '/attendance', icon: Camera,          label: 'Chamada',       roles: ['root', 'admin', 'admin_especifico', 'professor'] },
  { to: '/sessions',   icon: ClipboardList,   label: 'Presenças',     roles: ['root', 'admin', 'admin_especifico', 'professor'] },
  { to: '/fees',       icon: DollarSign,      label: 'Mensalidades',  roles: ['root', 'admin', 'admin_especifico'] },
  { to: '/financeiro', icon: TrendingUp,      label: 'Financeiro',    roles: ['root', 'admin', 'admin_especifico'] },
  { to: '/settings',   icon: Settings,        label: 'Configurações', roles: ['admin'] },
  { to: '/help',       icon: HelpCircle,      label: 'Ajuda',         roles: ['root', 'admin', 'admin_especifico', 'professor', 'aluno'] },
]

const ROLE_LABELS: Record<Role, string> = {
  root:             'Root',
  admin:            'Administrador',
  admin_especifico: 'Admin Específico',
  professor:        'Professor',
  aluno:            'Aluno',
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout, viewAsSchool } = useAuth()
  const [showChangePwd, setShowChangePwd] = useState(false)

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
            {user?.role === 'root' && viewAsSchool && (
              <p className="text-xs mt-1 font-semibold truncate" style={{ color: '#ff6666' }}>
                👁 {viewAsSchool.name}
              </p>
            )}
          </div>

          {/* Fechar mobile */}
          <button
            onClick={onClose}
            className="md:hidden flex-shrink-0 p-1 text-gray-500 hover:text-white transition-colors mt-0.5"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Seletor de escola (só root) ────────── */}
        {user?.role === 'root' && (
          <div className="pt-3 pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <SchoolSelector />
          </div>
        )}

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
            onClick={() => setShowChangePwd(true)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5 w-full mb-1"
          >
            <KeyRound size={15} />
            Alterar senha
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5 w-full"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  )
}
