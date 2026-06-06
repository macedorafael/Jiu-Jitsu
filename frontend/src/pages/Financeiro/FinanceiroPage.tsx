import { useEffect, useState, useMemo } from 'react'
import {
  TrendingUp, DollarSign, CheckCircle, Clock, AlertCircle,
  Search, RefreshCw, ChevronLeft, ChevronRight, Users, Calendar,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { financeiroApi, FinancialSummary, FinancialPayment, StudentProfile } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { currentMonthBR } from '../../utils/dateUtils'

// ── formatadores ──────────────────────────────────────────────────────────────

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtMonthShort(yyyyMM: string) {
  const [y, m] = yyyyMM.split('-')
  return `${MONTH_NAMES[+m - 1]}/${y.slice(2)}`
}
function fmtMonthFull(yyyyMM: string) {
  const [y, m] = yyyyMM.split('-')
  return `${MONTH_FULL[+m - 1]} ${y}`
}
function fmtDate(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── cores ─────────────────────────────────────────────────────────────────────

const COLOR_PAID    = '#22c55e'
const COLOR_PENDING = '#f59e0b'
const COLOR_OVERDUE = '#ef4444'

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string
  icon: any; color: string
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`rounded-xl p-3 flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    paid:    'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    overdue: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = { paid: 'Pago', pending: 'Pendente', overdue: 'Em atraso' }
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── CustomTooltip para recharts ────────────────────────────────────────────────

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{fmtMonthFull(label)}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-medium">{brl(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tabela ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

function PaymentsTable({ payments }: { payments: FinancialPayment[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(
    () => payments.filter((p) => p.student_name.toLowerCase().includes(search.toLowerCase())),
    [payments, search],
  )

  useEffect(() => setPage(1), [search])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <DollarSign size={16} className="text-primary-400" /> Pagamentos
          <span className="text-xs text-gray-400 font-normal">({total} registros)</span>
        </h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 text-sm w-full sm:w-56"
            placeholder="Buscar aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {paginated.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
          <p>Nenhum pagamento encontrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 font-semibold uppercase tracking-wide">
                <th className="pb-2 pr-4">Aluno</th>
                <th className="pb-2 pr-4">Mês ref.</th>
                <th className="pb-2 pr-4 text-right">Previsto</th>
                <th className="pb-2 pr-4 text-right">Recebido</th>
                <th className="pb-2 pr-4">Venc.</th>
                <th className="pb-2 pr-4">Pago em</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-gray-800 max-w-[180px] truncate">{p.student_name}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{fmtMonthFull(p.month_reference)}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-700">{brl(p.plan_amount)}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-gray-900">
                    {p.amount_paid != null ? brl(p.amount_paid) : '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500">
                    {p.due_day != null ? `Dia ${p.due_day}` : '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500">{fmtDate(p.payment_date)}</td>
                  <td className="py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
            onClick={() => setPage((p) => p - 1)} disabled={page === 1}
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <button
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
            onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page principal ────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { user } = useAuth()
  const isAdminEspecifico = user?.role === 'admin_especifico'
  // admin_especifico sempre bloqueado no seu perfil
  const lockedProfile = isAdminEspecifico ? (user?.profile_access ?? null) : null

  const [summary, setSummary]   = useState<FinancialSummary | null>(null)
  const [payments, setPayments] = useState<FinancialPayment[]>([])
  const [loadingS, setLoadingS] = useState(true)
  const [loadingP, setLoadingP] = useState(true)

  const [filterMonth,   setFilterMonth]   = useState(() => currentMonthBR())
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterProfile, setFilterProfile] = useState<StudentProfile | ''>( lockedProfile ?? '')

  const effectiveProfile = lockedProfile ?? (filterProfile || undefined)

  // Carrega resumo (fixo: sempre últimos 6 meses)
  useEffect(() => {
    setLoadingS(true)
    financeiroApi.summary({ profile: effectiveProfile })
      .then((r) => setSummary(r.data))
      .finally(() => setLoadingS(false))
  }, [effectiveProfile])

  // Carrega tabela quando filtros mudam
  useEffect(() => {
    setLoadingP(true)
    financeiroApi.payments({
      month: filterMonth || undefined,
      status: filterStatus || undefined,
      profile: effectiveProfile,
    })
      .then((r) => setPayments(r.data))
      .finally(() => setLoadingP(false))
  }, [filterMonth, filterStatus, effectiveProfile])

  const cm = summary?.current_month
  const totalCm = (cm?.paid ?? 0) + (cm?.pending ?? 0) + (cm?.overdue ?? 0)
  const totalStudentsCm = (cm?.paid_count ?? 0) + (cm?.pending_count ?? 0) + (cm?.overdue_count ?? 0)

  const pieData = cm ? [
    { name: 'Pago',      value: cm.paid_count,    amount: cm.paid },
    { name: 'Pendente',  value: cm.pending_count,  amount: cm.pending },
    { name: 'Em atraso', value: cm.overdue_count,  amount: cm.overdue },
  ].filter((d) => d.value > 0) : []

  const pieColors = [COLOR_PAID, COLOR_PENDING, COLOR_OVERDUE]

  const barData = summary?.monthly_history.map((m) => ({
    month: m.month,
    Recebido: m.paid,
    Pendente: m.pending,
    'Em atraso': m.overdue,
  })) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp size={24} className="text-primary-500" /> Financeiro
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Visão geral de mensalidades e recebimentos
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filtro de perfil — oculto para admin_especifico (já bloqueado) */}
          {!isAdminEspecifico ? (
            <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
              {([
                { value: '', label: 'Todos' },
                { value: 'adulto', label: '🥋 Adulto' },
                { value: 'infantil', label: '👦 Infantil' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilterProfile(opt.value as StudentProfile | '')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filterProfile === opt.value
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <span className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 ${
              lockedProfile === 'infantil'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-gray-50 text-gray-700'
            }`}>
              {lockedProfile === 'infantil' ? '👦 Infantil' : '🥋 Adulto'}
            </span>
          )}
          {loadingS && <RefreshCw size={18} className="animate-spin text-gray-400" />}
        </div>
      </div>

      {/* ── Cards de resumo do mês atual ── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard
            label="Planos ativos"
            value={String(summary.active_plans)}
            sub={`${brl(summary.monthly_expected)} / mês esperado`}
            icon={Users}
            color="bg-primary-500"
          />
          <SummaryCard
            label={`Recebido — ${fmtMonthFull(cm?.month ?? '')}`}
            value={brl(cm?.paid ?? 0)}
            sub={`${cm?.paid_count ?? 0} aluno${cm?.paid_count !== 1 ? 's' : ''}`}
            icon={CheckCircle}
            color="bg-green-500"
          />
          <SummaryCard
            label="Pendente"
            value={brl(cm?.pending ?? 0)}
            sub={`${cm?.pending_count ?? 0} aluno${cm?.pending_count !== 1 ? 's' : ''}`}
            icon={Clock}
            color="bg-yellow-500"
          />
          <SummaryCard
            label="Em atraso"
            value={brl(cm?.overdue ?? 0)}
            sub={`${cm?.overdue_count ?? 0} aluno${cm?.overdue_count !== 1 ? 's' : ''}`}
            icon={AlertCircle}
            color="bg-red-500"
          />
        </div>
      )}

      {/* ── Gráficos ── */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar chart — receita mensal */}
          <div className="card lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-400" />
              Receita mensal — últimos 6 meses
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barSize={14} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={fmtMonthShort}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false} width={52}
                />
                <Tooltip content={<BarTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value) => <span className="text-gray-600">{value}</span>}
                />
                <Bar dataKey="Recebido"   fill={COLOR_PAID}    radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pendente"   fill={COLOR_PENDING} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Em atraso"  fill={COLOR_OVERDUE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart — distribuição mês atual */}
          <div className="card flex flex-col">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-primary-400" />
              Status — {fmtMonthFull(cm?.month ?? '')}
            </h3>

            {pieData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Sem dados para o mês
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData} dataKey="value"
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={75}
                      paddingAngle={3}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={pieColors[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any, props: any) =>
                        [`${value} aluno${value !== 1 ? 's' : ''} · ${brl(props.payload.amount)}`, name]
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-2 mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: pieColors[i] }} />
                        <span className="text-gray-600">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-800">{brl(d.amount)}</span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({totalStudentsCm > 0 ? Math.round((d.value / totalStudentsCm) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Filtros da tabela ── */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <DollarSign size={16} className="text-primary-400" /> Relatório de pagamentos
        </h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mês</label>
            <input
              type="month"
              className="input text-sm"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              className="input text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="overdue">Em atraso</option>
            </select>
          </div>
          <button
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => {
              setFilterMonth(currentMonthBR())
              setFilterStatus('')
              if (!isAdminEspecifico) setFilterProfile('')
            }}
          >
            Limpar filtros
          </button>
          {loadingP && <RefreshCw size={15} className="animate-spin text-gray-400 mb-2" />}
        </div>

        {/* Totalizador do filtro */}
        {!loadingP && payments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
            {[
              { label: 'Total recebido', value: payments.filter((p) => p.status === 'paid').reduce((a, p) => a + (p.amount_paid ?? 0), 0), color: 'text-green-600' },
              { label: 'Total pendente', value: payments.filter((p) => p.status === 'pending').reduce((a, p) => a + p.plan_amount, 0), color: 'text-yellow-600' },
              { label: 'Total em atraso', value: payments.filter((p) => p.status === 'overdue').reduce((a, p) => a + p.plan_amount, 0), color: 'text-red-600' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <span className="text-gray-400">{label}: </span>
                <span className={`font-bold ${color}`}>{brl(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabela ── */}
      {loadingP ? (
        <div className="card text-center py-10 text-gray-400">
          <RefreshCw size={24} className="mx-auto animate-spin mb-2" />
          <p className="text-sm">Carregando pagamentos...</p>
        </div>
      ) : (
        <PaymentsTable payments={payments} />
      )}
    </div>
  )
}
