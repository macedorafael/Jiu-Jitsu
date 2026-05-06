import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import {
  Users, Camera, DollarSign, AlertCircle, Award,
  TrendingUp, CalendarCheck, UserCheck, Clock, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import api from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashData {
  total_students: number
  students_with_photo: number
  students_without_photo: number
  total_sessions: number
  sessions_this_month: number
  sessions_this_week: number
  attendances_this_month: number
  avg_attendance_per_session: number
  last_session_date: string | null
  last_session_count: number
  belt_distribution: Record<string, number>
  monthly_activity: { month: string; sessions: number; attendances: number }[]
  recent_sessions: { id: number; date: string; schedule_info: string; professor_name: string | null; attendance_count: number }[]
  recent_belt_promotions: { student_name: string; belt: string; degree: number; awarded_date: string }[]
  overdue_count: number
  pending_count: number
}

// ── Belt config ────────────────────────────────────────────────────────────────
const BELT_PT: Record<string, string> = {
  white: 'Branca', grey: 'Cinza', yellow: 'Amarela', orange: 'Laranja',
  green: 'Verde', blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}
const BELT_COLOR: Record<string, string> = {
  white: 'bg-gray-200 text-gray-700',
  grey: 'bg-gray-400 text-white',
  yellow: 'bg-yellow-400 text-gray-900',
  orange: 'bg-orange-400 text-white',
  green: 'bg-green-500 text-white',
  blue: 'bg-blue-500 text-white',
  purple: 'bg-purple-600 text-white',
  brown: 'bg-amber-800 text-white',
  black: 'bg-gray-900 text-white',
}
const BELT_BAR: Record<string, string> = {
  white: 'bg-gray-300',
  grey: 'bg-gray-400',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-400',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-600',
  brown: 'bg-amber-800',
  black: 'bg-gray-900',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return format(parseISO(iso), "d 'de' MMM", { locale: ptBR })
}
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-')
  return format(new Date(Number(y), Number(m) - 1, 1), 'MMM', { locale: ptBR })
}
function degreeLabel(d: number) {
  return d === 0 ? '' : '◆'.repeat(d)
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color, to,
}: {
  label: string; value: string | number; sub?: string
  icon: any; color: string; to?: string
}) {
  const inner = (
    <div className={`card flex items-start gap-4 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
      <div className={`${color} rounded-xl p-3 text-white flex-shrink-0`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ── Monthly bar chart ─────────────────────────────────────────────────────────
function MonthlyChart({ data }: { data: DashData['monthly_activity'] }) {
  const maxSess = Math.max(...data.map((d) => d.sessions), 1)
  const maxAtt = Math.max(...data.map((d) => d.attendances), 1)
  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-primary-500" /> Atividade — últimos 6 meses
      </h3>
      <div className="flex items-end gap-2 h-28">
        {data.map((d) => (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            {/* attendance bar (lighter, behind) */}
            <div className="relative w-full flex flex-col items-center justify-end h-20 gap-0.5">
              <div
                className="w-full bg-primary-100 rounded-t-sm"
                style={{ height: `${(d.attendances / maxAtt) * 100}%` }}
                title={`${d.attendances} presenças`}
              />
            </div>
            <span className="text-[10px] text-gray-400 capitalize">{fmtMonth(d.month)}</span>
            <span className="text-[10px] font-semibold text-gray-600">{d.sessions}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-primary-100 inline-block rounded-sm" /> Presenças</span>
        <span className="flex items-center gap-1 text-gray-600 font-medium">Número = sessões no mês</span>
      </div>
    </div>
  )
}

// ── Belt distribution ──────────────────────────────────────────────────────────
function BeltChart({ dist, total }: { dist: Record<string, number>; total: number }) {
  const belts = Object.entries(dist)
  if (belts.length === 0) return null
  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Award size={16} className="text-primary-500" /> Distribuição de Faixas
      </h3>
      <div className="space-y-2">
        {belts.map(([belt, count]) => (
          <div key={belt} className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full min-w-[72px] text-center ${BELT_COLOR[belt] ?? 'bg-gray-200'}`}>
              {BELT_PT[belt] ?? belt}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${BELT_BAR[belt] ?? 'bg-gray-400'}`}
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-700 w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">{total} aluno{total !== 1 ? 's' : ''} ativo{total !== 1 ? 's' : ''} no total</p>
    </div>
  )
}

// ── Recent Sessions ───────────────────────────────────────────────────────────
function RecentSessions({ sessions }: { sessions: DashData['recent_sessions'] }) {
  if (sessions.length === 0) return (
    <div className="card text-center text-gray-400 py-8 text-sm">Nenhuma sessão registrada ainda.</div>
  )
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <CalendarCheck size={16} className="text-primary-500" /> Sessões Recentes
        </h3>
        <Link to="/sessions" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
          Ver todas <ChevronRight size={12} />
        </Link>
      </div>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="bg-primary-50 text-primary-700 rounded-lg px-2.5 py-1.5 text-center min-w-[52px]">
              <p className="text-xs font-bold leading-none">{fmtDate(s.date).split(' ')[0]}</p>
              <p className="text-[10px] capitalize">{fmtDate(s.date).split(' ').slice(2).join(' ')}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{s.schedule_info}</p>
              {s.professor_name && (
                <p className="text-xs text-gray-400 truncate">{s.professor_name}</p>
              )}
            </div>
            <span className="flex-shrink-0 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {s.attendance_count} aluno{s.attendance_count !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Recent Promotions ─────────────────────────────────────────────────────────
function RecentPromotions({ promotions }: { promotions: DashData['recent_belt_promotions'] }) {
  if (promotions.length === 0) return null
  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Award size={16} className="text-yellow-500" /> Promoções Recentes
      </h3>
      <div className="space-y-2">
        {promotions.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${BELT_COLOR[p.belt] ?? 'bg-gray-200'}`}>
              {BELT_PT[p.belt] ?? p.belt}{p.degree > 0 ? ` ${degreeLabel(p.degree)}` : ''}
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800">{p.student_name}</span>
            <span className="text-xs text-gray-400">{fmtDate(p.awarded_date)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  const today = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })

  useEffect(() => {
    if (user?.role === 'aluno') return
    api.get<DashData>('/dashboard')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  if (user?.role === 'aluno') return <Navigate to="/meu-perfil" replace />

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Carregando dashboard...
    </div>
  )

  if (!data) return null

  const isAdmin = user?.role === 'admin' || user?.role === 'root'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 capitalize mt-0.5 text-sm">{today}</p>
        {user?.school_name && (
          <p className="text-primary-600 font-medium text-sm mt-0.5">🏫 {user.school_name}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Alunos ativos"
          value={data.total_students}
          sub={`${data.students_with_photo} com foto`}
          icon={Users}
          color="bg-blue-500"
          to="/students"
        />
        <StatCard
          label="Sessões este mês"
          value={data.sessions_this_month}
          sub={`${data.sessions_this_week} esta semana`}
          icon={Camera}
          color="bg-green-500"
          to="/sessions"
        />
        <StatCard
          label="Presenças este mês"
          value={data.attendances_this_month}
          sub={`Média ${data.avg_attendance_per_session} por sessão`}
          icon={UserCheck}
          color="bg-primary-500"
          to="/sessions"
        />
        {isAdmin ? (
          <StatCard
            label="Inadimplentes"
            value={data.overdue_count}
            sub={`${data.pending_count} pendente${data.pending_count !== 1 ? 's' : ''}`}
            icon={DollarSign}
            color={data.overdue_count > 0 ? 'bg-red-500' : 'bg-gray-400'}
            to="/fees"
          />
        ) : (
          <StatCard
            label="Total de sessões"
            value={data.total_sessions}
            sub={data.last_session_date ? `Última: ${fmtDate(data.last_session_date)}` : 'Sem sessões'}
            icon={Clock}
            color="bg-purple-500"
            to="/sessions"
          />
        )}
      </div>

      {/* Alerts */}
      {data.students_without_photo > 0 && (
        <Link to="/students">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors">
            <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{data.students_without_photo}</strong> aluno{data.students_without_photo !== 1 ? 's' : ''} sem foto cadastrada — o reconhecimento facial não funcionará para {data.students_without_photo !== 1 ? 'eles' : 'ele'}.
            </p>
          </div>
        </Link>
      )}

      {/* Middle row: chart + belt */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyChart data={data.monthly_activity} />
        <BeltChart dist={data.belt_distribution} total={data.total_students} />
      </div>

      {/* Bottom row: recent sessions + promotions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentSessions sessions={data.recent_sessions} />
        {data.recent_belt_promotions.length > 0 && (
          <RecentPromotions promotions={data.recent_belt_promotions} />
        )}
      </div>
    </div>
  )
}
