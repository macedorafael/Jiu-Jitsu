import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { studentsApi, feesApi, Student, Belt, StudentProfile } from '../../api/client'
import { X, Info, DollarSign } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

// ── Faixas infantis (ordenadas por progressão) ─────────────────────────────
const BELTS_INFANTIL: Belt[] = [
  'white',
  'grey_white', 'grey', 'grey_black',
  'yellow_white', 'yellow', 'yellow_black',
  'orange_white', 'orange', 'orange_black',
  'green_white', 'green', 'green_black',
]

// ── Faixas adultas ─────────────────────────────────────────────────────────
const BELTS_ADULTO: Belt[] = ['white', 'green_white', 'green', 'green_black', 'blue', 'purple', 'brown', 'black']

const BELT_LABELS: Record<Belt, string> = {
  white: 'Branca',
  grey_white: 'Cinza e Branca', grey: 'Cinza', grey_black: 'Cinza e Preta',
  yellow_white: 'Amarela e Branca', yellow: 'Amarela', yellow_black: 'Amarela e Preta',
  orange_white: 'Laranja e Branca', orange: 'Laranja', orange_black: 'Laranja e Preta',
  green_white: 'Verde e Branca', green: 'Verde', green_black: 'Verde e Preta',
  blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}

const PAYMENT_METHODS = ['Pix', 'Boleto', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro']

interface FormData {
  name: string
  email: string
  profile: StudentProfile
  belt: Belt
  degree: number
  birth_date: string
  phone: string
  enrollment_date: string
  fee_amount: string
  fee_due_day: string
  fee_payment_method: string
}

export default function StudentForm({
  student, onClose, onSaved,
}: { student: Student | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !student
  const { user } = useAuth()
  const isProfessor = user?.role === 'professor'
  const isAdminEspecifico = user?.role === 'admin_especifico'
  // admin_especifico só pode criar/editar alunos do seu próprio perfil
  const lockedProfile = isAdminEspecifico ? (user?.profile_access ?? null) : null
  const [withFeePlan, setWithFeePlan] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: student?.name ?? '',
      email: student?.email ?? '',
      profile: lockedProfile ?? student?.profile ?? 'adulto',
      belt: student?.belt ?? 'white',
      degree: student?.degree ?? 0,
      birth_date: student?.birth_date ?? '',
      phone: student?.phone ?? '',
      enrollment_date: student?.enrollment_date ?? new Date().toISOString().split('T')[0],
      fee_amount: '',
      fee_due_day: '10',
      fee_payment_method: 'Pix',
    },
  })

  const selectedProfile = watch('profile') as StudentProfile
  const beltOptions = selectedProfile === 'infantil' ? BELTS_INFANTIL : BELTS_ADULTO
  const maxDegree = selectedProfile === 'infantil' ? 11 : 4

  async function onSubmit(data: FormData) {
    try {
      if (student) {
        await studentsApi.update(student.id, {
          name: data.name,
          profile: data.profile,
          belt: data.belt,
          degree: Number(data.degree),
          enrollment_date: data.enrollment_date || undefined,
          birth_date: data.birth_date || undefined,
          phone: data.phone || undefined,
        })
      } else {
        const created = await studentsApi.create({
          name: data.name,
          email: data.email,
          profile: data.profile,
          belt: data.belt,
          degree: Number(data.degree),
          birth_date: data.birth_date || undefined,
          phone: data.phone || undefined,
          enrollment_date: data.enrollment_date || undefined,
        })

        if (!isProfessor && withFeePlan && data.fee_amount && data.fee_due_day) {
          const amount = parseFloat(data.fee_amount)
          const due_day = parseInt(data.fee_due_day)
          if (amount > 0 && due_day >= 1 && due_day <= 31) {
            await feesApi.createPlan(created.data.id, {
              amount,
              due_day,
              payment_method: data.fee_payment_method || undefined,
            })
          }
        }
      }
      onSaved()
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        const msgs = detail.map((e: any) => {
          const field = e.loc?.slice(-1)[0] ?? ''
          return field ? `${field}: ${e.msg}` : e.msg
        }).join('\n')
        alert(msgs)
      } else {
        alert(detail ?? 'Erro ao salvar')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">{student ? 'Editar aluno' : 'Novo aluno'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">

          {/* ── Perfil (adulto/infantil) ── */}
          <div>
            <label className="block text-sm font-medium mb-2">Perfil *</label>
            {lockedProfile ? (
              /* admin_especifico: perfil fixo, não editável */
              <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-medium text-sm ${
                lockedProfile === 'infantil'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-gray-50 text-gray-700'
              }`}>
                <input type="hidden" value={lockedProfile} {...register('profile')} />
                {lockedProfile === 'adulto' ? '🥋 Adulto' : '👦 Infantil'}
                <span className="text-xs font-normal opacity-60 ml-1">(fixo pelo seu perfil de acesso)</span>
              </div>
            ) : (
              <div className="flex gap-3">
                {(['adulto', 'infantil'] as StudentProfile[]).map((p) => (
                  <label
                    key={p}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 cursor-pointer font-medium text-sm transition-all ${
                      selectedProfile === p
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value={p}
                      className="sr-only"
                      {...register('profile', { required: true })}
                    />
                    {p === 'adulto' ? '🥋 Adulto' : '👦 Infantil'}
                  </label>
                ))}
              </div>
            )}
            {errors.profile && <p className="text-red-500 text-xs mt-1">Selecione o perfil</p>}
          </div>

          {/* ── Dados pessoais ── */}
          <div>
            <label className="block text-sm font-medium mb-1">Nome completo *</label>
            <input className="input" {...register('name', { required: true })} />
            {errors.name && <p className="text-red-500 text-xs mt-1">Obrigatório</p>}
          </div>

          {!isNew && student?.email && (
            <div>
              <label className="block text-sm font-medium mb-1">Email (conta de acesso)</label>
              <input
                type="email"
                className="input bg-gray-50 text-gray-500 cursor-not-allowed"
                value={student.email}
                readOnly
              />
            </div>
          )}

          {isNew && (
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                className="input"
                placeholder="email@exemplo.com"
                {...register('email', { required: true })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">Email obrigatório</p>}
              <div className="flex items-start gap-1.5 mt-1.5">
                <Info size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-600">
                  Será criada uma conta com senha padrão <strong>aluno123</strong>. O aluno deverá alterá-la no primeiro login.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Faixa</label>
              <select className="input" {...register('belt')}>
                {beltOptions.map((b) => (
                  <option key={b} value={b}>{BELT_LABELS[b]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Grau (0–{maxDegree})
              </label>
              <input
                type="number"
                min={0}
                max={maxDegree}
                className="input"
                {...register('degree', { min: 0, max: maxDegree })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data de nascimento</label>
              <input type="date" className="input" {...register('birth_date')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data de matrícula</label>
              <input type="date" className="input" {...register('enrollment_date')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Telefone / WhatsApp</label>
            <input className="input" placeholder="(67) 99999-9999" {...register('phone')} />
          </div>

          {/* ── Plano de mensalidade — oculto para professor ── */}
          {isNew && !isProfessor && (
            <div className="border-t pt-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-primary-600"
                  checked={withFeePlan}
                  onChange={(e) => setWithFeePlan(e.target.checked)}
                />
                <div className="flex items-center gap-1.5">
                  <DollarSign size={15} className="text-primary-500" />
                  <span className="text-sm font-medium">Definir plano de mensalidade agora</span>
                </div>
              </label>

              {withFeePlan && (
                <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600">Valor mensal (R$) *</label>
                      <input
                        type="number" step="0.01" min="0.01" className="input" placeholder="150,00"
                        {...register('fee_amount', { required: withFeePlan })}
                      />
                      {errors.fee_amount && <p className="text-red-500 text-xs mt-1">Obrigatório</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600">Dia de vencimento *</label>
                      <input
                        type="number" min={1} max={31} className="input" placeholder="10"
                        {...register('fee_due_day', { required: withFeePlan, min: 1, max: 31 })}
                      />
                      {errors.fee_due_day && <p className="text-red-500 text-xs mt-1">1–31</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Forma de pagamento</label>
                    <select className="input" {...register('fee_payment_method')}>
                      <option value="">Selecione...</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
