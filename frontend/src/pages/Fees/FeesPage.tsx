import { useEffect, useState } from 'react'
import { DollarSign, Plus, CheckCircle, Clock, AlertCircle, Search } from 'lucide-react'
import { studentsApi, feesApi, Student, FeePlan, Payment } from '../../api/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_CONFIG = {
  paid: { label: 'Pago', icon: CheckCircle, cls: 'text-green-600 bg-green-50' },
  pending: { label: 'Pendente', icon: Clock, cls: 'text-yellow-600 bg-yellow-50' },
  overdue: { label: 'Em atraso', icon: AlertCircle, cls: 'text-red-600 bg-red-50' },
}

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(new Date().getFullYear(), i, 1)
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM/yyyy', { locale: ptBR }) }
})

export default function FeesPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Student | null>(null)
  const [plans, setPlans] = useState<FeePlan[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planForm, setPlanForm] = useState({ amount: 150, due_day: 10, payment_method: 'PIX' })
  const [payForm, setPayForm] = useState({ month_reference: format(new Date(), 'yyyy-MM'), amount_paid: 0 })
  const [showPayForm, setShowPayForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { studentsApi.list().then((r) => setStudents(r.data)) }, [])

  async function selectStudent(s: Student) {
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
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erro')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mensalidades</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 space-y-2">
            <p className="text-sm font-medium text-gray-600">Selecione o aluno</p>
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
          <ul className="divide-y max-h-[500px] overflow-y-auto">
            {students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())).map((s) => (
              <li
                key={s.id}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm ${selected?.id === s.id ? 'bg-primary-50 font-medium' : ''}`}
                onClick={() => selectStudent(s)}
              >
                <div className="font-medium">{s.name}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              {/* Fee Plan */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Plano de mensalidade</h2>
                  <button className="btn-secondary text-sm flex items-center gap-1"
                    onClick={() => setShowPlanForm(!showPlanForm)}>
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

              {/* Payments */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Pagamentos</h2>
                  {plans.length > 0 && (
                    <button className="btn-secondary text-sm flex items-center gap-1"
                      onClick={() => setShowPayForm(!showPayForm)}>
                      <Plus size={14} /> Registrar
                    </button>
                  )}
                </div>

                {showPayForm && (
                  <div className="border rounded-lg p-4 bg-gray-50 mb-4 space-y-3">
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
                          <span>
                            {p.amount_paid ? `R$ ${p.amount_paid.toFixed(2)}` : '—'}
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
