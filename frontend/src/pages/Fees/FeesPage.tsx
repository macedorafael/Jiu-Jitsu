import { useEffect, useState, useRef, useCallback } from 'react'
import { DollarSign, Plus, CheckCircle, Clock, AlertCircle, Search, AlertTriangle, XCircle } from 'lucide-react'
import { studentsApi, feesApi, financeiroApi, Student, FeePlan, Payment, FinancialPayment } from '../../api/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { currentMonthBR } from '../../utils/dateUtils'

const STATUS_CONFIG = {
  paid:    { label: 'Pago',       icon: CheckCircle,  cls: 'text-green-600 bg-green-50' },
  pending: { label: 'Pendente',   icon: Clock,        cls: 'text-yellow-600 bg-yellow-50' },
  overdue: { label: 'Em atraso',  icon: AlertCircle,  cls: 'text-red-600 bg-red-50' },
}

const CURRENT_MONTH = currentMonthBR()

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(new Date().getFullYear(), i, 1)
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM/yyyy', { locale: ptBR }) }
})

export default function FeesPage() {
  const [students, setStudents]       = useState<Student[]>([])
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState<Student | null>(null)
  const [plans, setPlans]             = useState<FeePlan[]>([])
  const [payments, setPayments]       = useState<Payment[]>([])
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planForm, setPlanForm]       = useState({ amount: 130, due_day: 10, payment_method: 'PIX' })
  const [payForm, setPayForm]         = useState({ month_reference: CURRENT_MONTH, amount_paid: 0 })
  const [showPayForm, setShowPayForm] = useState(false)
  const [saving, setSaving]           = useState(false)

  // Filtro: 'all' | 'pending' | 'overdue'
  const [filter, setFilter]                       = useState<'all' | 'pending' | 'overdue'>('all')
  const [pendingStudentIds, setPendingStudentIds] = useState<Set<number>>(new Set())
  const [overdueStudentIds, setOverdueStudentIds] = useState<Set<number>>(new Set())
  const [loadingPending, setLoadingPending]       = useState(false)

  // Ref para scroll automático ao formulário de pagamento
  const payFormRef = useRef<HTMLDivElement>(null)

  // Carrega todos os alunos
  useEffect(() => { studentsApi.list().then((r) => setStudents(r.data)) }, [])

  // Carrega IDs de alunos pendentes e atrasados no mês atual
  const loadFiltered = useCallback(async () => {
    setLoadingPending(true)
    try {
      const [{ data: overdue }, { data: pending }] = await Promise.all([
        financeiroApi.payments({ month: CURRENT_MONTH, status: 'overdue' }),
        financeiroApi.payments({ month: CURRENT_MONTH, status: 'pending' }),
      ])
      setPendingStudentIds(new Set(pending.map((p: FinancialPayment) => p.student_id)))
      setOverdueStudentIds(new Set(overdue.map((p: FinancialPayment) => p.student_id)))
    } finally {
      setLoadingPending(false)
    }
  }, [])

  useEffect(() => {
    if (filter !== 'all') loadFiltered()
  }, [filter, loadFiltered])

  async function selectStudent(s: Student, autoOpenPay = false, clearFilter = false) {
    setSelected(s)
    setShowPlanForm(false)
    setShowPayForm(false)

    const [{ data: p }, { data: pay }] = await Promise.all([
      feesApi.getPlans(s.id),
      feesApi.studentPayments(s.id),
    ])
    setPlans(p)
    setPayments(pay)
    if (p.length) setPayForm((f) => ({ ...f, amount_paid: p[0].amount }))

    if (autoOpenPay && p.length) {
      setShowPayForm(true)
      // Scroll suave até o formulário de pagamento
      setTimeout(() => {
        payFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  async function savePlan() {
    if (!selected) return
    setSaving(true)
    try {
      await feesApi.createPlan(selected.id, planForm)
      const { data } = await feesApi.getPlans(selected.id)
      setPlans(data)
      setShowPlanForm(false)
    } finally { setSaving(false) }
  }

  async function savePayment() {
    if (!selected || !plans[0]) return
    setSaving(true)
    try {
      await feesApi.registerPayment({
        fee_plan_id: plans[0].id,
        student_id: selected.id,
        ...payForm,
      })
      const { data } = await feesApi.studentPayments(selected.id)
      setPayments(data)
      setShowPayForm(false)
      // Remove aluno dos sets de pendente/atrasado após pagamento
      setPendingStudentIds((prev) => { const s = new Set(prev); s.delete(selected.id); return s })
      setOverdueStudentIds((prev) => { const s = new Set(prev); s.delete(selected.id); return s })
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erro')
    } finally { setSaving(false) }
  }

  // Lista filtrada de alunos
  const displayedStudents = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    if (filter === 'pending') return matchSearch && pendingStudentIds.has(s.id)
    if (filter === 'overdue') return matchSearch && overdueStudentIds.has(s.id)
    return matchSearch
  })

  const pendingCount = pendingStudentIds.size
  const overdueCount = overdueStudentIds.size

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mensalidades</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Lista de alunos ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 space-y-3">

            {/* Filtro */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  filter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Clock size={11} />
                Pendentes
                {filter === 'pending' && pendingCount > 0 && (
                  <span className="bg-white/30 text-white text-[10px] font-bold px-1 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilter('overdue')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  filter === 'overdue'
                    ? 'bg-red-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <AlertTriangle size={11} />
                Atraso
                {filter === 'overdue' && overdueCount > 0 && (
                  <span className="bg-white/30 text-white text-[10px] font-bold px-1 py-0.5 rounded-full">
                    {overdueCount}
                  </span>
                )}
              </button>
            </div>

            {/* Busca */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar..."
                className="input pl-8 py-1.5 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loadingPending ? (
            <div className="p-6 text-center text-sm text-gray-400">Carregando...</div>
          ) : displayedStudents.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              {filter === 'pending' ? '✓ Nenhum aluno pendente!'
                : filter === 'overdue' ? '✓ Nenhum aluno em atraso!'
                : 'Nenhum aluno encontrado.'}
            </div>
          ) : (
            <ul className="divide-y max-h-[500px] overflow-y-auto">
              {displayedStudents.map((s) => {
                const isOverdue = overdueStudentIds.has(s.id)
                const isPending = pendingStudentIds.has(s.id)
                return (
                  <li
                    key={s.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm transition-colors ${
                      selected?.id === s.id ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => selectStudent(s, filter !== 'all')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium truncate ${selected?.id === s.id ? 'text-primary-700' : ''}`}>
                        {s.name}
                      </span>
                      {isOverdue && (
                        <span className="flex-shrink-0">
                          <AlertCircle size={14} className="text-red-400" />
                        </span>
                      )}
                      {!isOverdue && isPending && (
                        <span className="flex-shrink-0">
                          <Clock size={14} className="text-yellow-500" />
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ── Detalhe do aluno ── */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              {/* Plano */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Plano de mensalidade — {selected.name}</h2>
                  <button
                    className="btn-secondary text-sm flex items-center gap-1"
                    onClick={() => setShowPlanForm(!showPlanForm)}
                  >
                    <Plus size={14} /> {plans.length ? 'Alterar' : 'Criar plano'}
                  </button>
                </div>

                {plans.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p><span className="text-gray-500">Valor:</span> <strong>R$ {plans[0].amount.toFixed(2)}</strong></p>
                    <p><span className="text-gray-500">Vencimento:</span> <strong>Todo dia {plans[0].due_day}</strong></p>
                    <p><span className="text-gray-500">Método:</span> {plans[0].payment_method || '—'}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Nenhum plano cadastrado</p>
                )}

                {showPlanForm && (
                  <div className="border rounded-lg p-4 bg-gray-50 mt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Valor (R$)</label>
                        <input type="number" className="input" value={planForm.amount}
                          onChange={(e) => setPlanForm({ ...planForm, amount: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Vencimento (dia)</label>
                        <input type="number" min={1} max={31} className="input" value={planForm.due_day}
                          onChange={(e) => setPlanForm({ ...planForm, due_day: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Método</label>
                        <select className="input" value={planForm.payment_method}
                          onChange={(e) => setPlanForm({ ...planForm, payment_method: e.target.value })}>
                          {['PIX', 'Dinheiro', 'Cartão', 'Boleto'].map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary flex-1" onClick={() => setShowPlanForm(false)}>Cancelar</button>
                      <button className="btn-primary flex-1" onClick={savePlan} disabled={saving}>
                        {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagamentos */}
              <div className="card" ref={payFormRef}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Pagamentos</h2>
                  {plans.length > 0 && (
                    <button
                      className="btn-secondary text-sm flex items-center gap-1"
                      onClick={() => {
                        setShowPayForm(!showPayForm)
                        if (!showPayForm) {
                          setTimeout(() => payFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
                        }
                      }}
                    >
                      <Plus size={14} /> Registrar
                    </button>
                  )}
                </div>

                {showPayForm && (
                  <div className="border border-primary-200 rounded-lg p-4 bg-primary-50 mb-4 space-y-3">
                    <p className="text-sm font-semibold text-primary-700">Registrar pagamento</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Mês de referência</label>
                        <select className="input" value={payForm.month_reference}
                          onChange={(e) => setPayForm({ ...payForm, month_reference: e.target.value })}>
                          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Valor pago (R$)</label>
                        <input type="number" className="input" value={payForm.amount_paid}
                          onChange={(e) => setPayForm({ ...payForm, amount_paid: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary flex-1" onClick={() => setShowPayForm(false)}>Cancelar</button>
                      <button className="btn-primary flex-1" onClick={savePayment} disabled={saving}>
                        {saving ? 'Salvando...' : 'Confirmar pagamento'}
                      </button>
                    </div>
                  </div>
                )}

                {payments.length === 0 ? (
                  <p className="text-gray-400 text-sm">Nenhum pagamento registrado</p>
                ) : (
                  <ul className="space-y-2">
                    {payments.map((p) => {
                      const cfg = STATUS_CONFIG[p.status]
                      const Icon = cfg.icon
                      return (
                        <li key={p.id} className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 ${cfg.cls}`}>
                          <span className="flex items-center gap-2">
                            <Icon size={14} />
                            {p.month_reference}
                          </span>
                          <span className="text-right">
                            {p.amount_paid
                              ? `R$ ${p.amount_paid.toFixed(2)}`
                              : p.plan_amount
                                ? <span className="opacity-60">R$ {p.plan_amount.toFixed(2)}</span>
                                : '—'
                            }
                            {p.payment_date && <span className="text-xs ml-2 opacity-70">{p.payment_date}</span>}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="card text-center py-12 text-gray-400">
              <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
              <p>Selecione um aluno para gerenciar mensalidades</p>
              {filter === 'pending' && pendingCount > 0 && (
                <p className="text-sm text-yellow-500 mt-2">
                  {pendingCount} aluno{pendingCount !== 1 ? 's' : ''} com pagamento pendente
                </p>
              )}
              {filter === 'overdue' && overdueCount > 0 && (
                <p className="text-sm text-red-400 mt-2">
                  {overdueCount} aluno{overdueCount !== 1 ? 's' : ''} em atraso
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
