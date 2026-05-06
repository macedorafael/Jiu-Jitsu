import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { usersApi, User, School, Role } from '../../api/client'

const ROLE_LABELS: Record<Role, string> = {
  root: 'Root',
  admin: 'Administrador',
  professor: 'Professor',
  aluno: 'Aluno',
}

interface FormData {
  name: string
  email: string
  password: string
  role: Role
  school_id: string
}

interface Props {
  user: User | null
  schools: School[]
  creatableRoles: Role[]
  currentUser: User
  onClose: () => void
  onSaved: () => void
}

export default function UserForm({ user, schools, creatableRoles, currentUser, onClose, onSaved }: Props) {
  const isEdit = !!user
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? creatableRoles[0],
      school_id: user?.school_id?.toString() ?? currentUser.school_id?.toString() ?? '',
    },
  })

  const selectedRole = watch('role')
  const needsSchool = selectedRole !== 'root'

  async function onSubmit(data: FormData) {
    try {
      const payload: any = {
        name: data.name,
        email: data.email,
        role: data.role,
        school_id: needsSchool && data.school_id ? Number(data.school_id) : undefined,
      }
      if (data.password) payload.password = data.password

      if (isEdit) {
        await usersApi.update(user!.id, payload)
      } else {
        if (!data.password) { alert('Senha é obrigatória'); return }
        await usersApi.create({ ...payload, password: data.password })
      }
      onSaved()
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erro ao salvar')
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
          <div>
            <label className="block text-sm font-medium mb-1">Nome completo *</label>
            <input className="input" {...register('name', { required: true })} />
            {errors.name && <p className="text-red-500 text-xs mt-1">Obrigatório</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input type="email" className="input" {...register('email', { required: true })} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
            </label>
            <input type="password" className="input" {...register('password')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Perfil *</label>
              <select className="input" {...register('role')}>
                {creatableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>

            {needsSchool && (
              <div>
                <label className="block text-sm font-medium mb-1">Escola *</label>
                {currentUser.role === 'root' ? (
                  <select className="input" {...register('school_id', { required: needsSchool })}>
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
              </div>
            )}
          </div>

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
