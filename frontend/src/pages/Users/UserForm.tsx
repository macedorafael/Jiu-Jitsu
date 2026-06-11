import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, AlertCircle } from 'lucide-react'
import { usersApi, User, School, Role, StudentProfile } from '../../api/client'

const ROLE_LABELS: Record<Role, string> = {
  root: 'Root',
  admin: 'Administrador',
  admin_especifico: 'Admin Específico',
  professor: 'Professor',
  aluno: 'Aluno',
}

interface FormData {
  name: string
  email: string
  password: string
  role: Role
  school_id: string
  profile_access: StudentProfile | ''
}

interface Props {
  user: User | null
  schools: School[]
  creatableRoles: Role[]
  currentUser: User
  onClose: () => void
  onSaved: () => void
}

function parseApiError(err: any): string {
  const detail = err.response?.data?.detail
  if (!detail) return 'Erro ao salvar. Tente novamente.'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d: any) => {
      const msg: string = d.msg ?? ''
      // Traduz erros comuns de email do Pydantic
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('@-sign') || msg.toLowerCase().includes('period')) {
        return 'E-mail inválido — use o formato correto, ex: nome@dominio.com'
      }
      return msg || JSON.stringify(d)
    }).join('\n')
  }
  return JSON.stringify(detail)
}

export default function UserForm({ user, schools, creatableRoles, currentUser, onClose, onSaved }: Props) {
  const isEdit = !!user
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? creatableRoles[0],
      school_id: user?.school_id?.toString() ?? currentUser.school_id?.toString() ?? '',
      profile_access: user?.profile_access ?? '',
    },
  })

  const isAlunoEdit = isEdit && user?.role === 'aluno'
  const availableRoles = isAlunoEdit ? ['aluno'] as Role[] : creatableRoles
  const selectedRole = watch('role')
  const needsSchool = selectedRole !== 'root'
  const needsProfileAccess = selectedRole === 'admin_especifico' || selectedRole === 'professor'

  async function onSubmit(data: FormData) {
    setServerError('')
    try {
      const payload: any = {
        name: data.name,
        email: data.email,
        role: data.role,
        school_id: needsSchool && data.school_id ? Number(data.school_id) : undefined,
      }
      if (needsProfileAccess) {
        if (!data.profile_access) {
          setServerError('Selecione o perfil de acesso (Adulto ou Infantil).')
          return
        }
        payload.profile_access = data.profile_access
      }
      if (data.password) payload.password = data.password

      if (isEdit) {
        await usersApi.update(user!.id, payload)
      } else {
        if (!data.password) {
          setServerError('A senha é obrigatória para novos usuários.')
          return
        }
        await usersApi.create({ ...payload, password: data.password })
      }
      onSaved()
    } catch (err: any) {
      setServerError(parseApiError(err))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Editar usuário' : 'Novo usuário'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium mb-1">Nome completo *</label>
            <input className="input" {...register('name', { required: true })} />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> Nome é obrigatório.
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              className={`input ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="exemplo@dominio.com"
              {...register('email', {
                required: 'E-mail é obrigatório.',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'E-mail inválido — use o formato correto, ex: nome@dominio.com',
                },
              })}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.email.message}
              </p>
            )}
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
            </label>
            <input type="password" className="input" placeholder="Mínimo 6 caracteres" {...register('password')} />
          </div>

          {/* Perfil + Escola */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Perfil *</label>
              <select className="input" disabled={isAlunoEdit} {...register('role')}>
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              {isAlunoEdit && (
                <p className="text-xs text-gray-400 mt-1">
                  Alunos não podem ser promovidos aqui. Crie um novo usuário como Professor ou Admin.
                </p>
              )}
            </div>

            {needsSchool && (
              <div>
                <label className="block text-sm font-medium mb-1">Escola *</label>
                {currentUser.role === 'root' ? (
                  <select className={`input ${errors.school_id ? 'border-red-400' : ''}`}
                    {...register('school_id', { required: needsSchool })}>
                    <option value="">Selecione...</option>
                    {schools.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input bg-gray-50"
                    value={currentUser.school_name ?? `Escola #${currentUser.school_id}`}
                    readOnly
                  />
                )}
                {errors.school_id && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> Selecione uma escola.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Perfil de acesso */}
          {needsProfileAccess && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Perfil de acesso *
                <span className="text-xs text-gray-400 font-normal ml-1">
                  ({selectedRole === 'professor' ? 'este professor' : 'este admin'} só verá alunos deste perfil)
                </span>
              </label>
              <div className="flex gap-3">
                {(['adulto', 'infantil'] as StudentProfile[]).map((p) => {
                  const val = watch('profile_access')
                  return (
                    <label
                      key={p}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 cursor-pointer font-medium text-sm transition-all ${
                        val === p
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <input type="radio" value={p} className="sr-only" {...register('profile_access')} />
                      {p === 'adulto' ? '🥋 Adulto' : '👦 Infantil'}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Erro do servidor */}
          {serverError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 whitespace-pre-line">{serverError}</p>
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
