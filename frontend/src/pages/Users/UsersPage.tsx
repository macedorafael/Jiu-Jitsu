import { useEffect, useState } from 'react'
import { Plus, Search, UserCog, Pencil, X, Info } from 'lucide-react'
import { usersApi, schoolsApi, User, School, Role } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import UserForm from './UserForm'

const ROLE_LABELS: Record<Role, string> = {
  root: 'Root',
  admin: 'Administrador',
  professor: 'Professor',
  aluno: 'Aluno',
}

const ROLE_COLORS: Record<Role, string> = {
  root: 'bg-red-100 text-red-700',
  admin: 'bg-purple-100 text-purple-700',
  professor: 'bg-blue-100 text-blue-700',
  aluno: 'bg-green-100 text-green-700',
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    usersApi.list().then((r) => setUsers(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    if (me?.role === 'root' || me?.role === 'admin') {
      schoolsApi.list().then((r) => setSchools(r.data)).catch(() => {})
    }
  }, [me])

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  )

  async function deactivate(u: User) {
    if (!confirm(`Desativar usuário "${u.name}"?`)) return
    await usersApi.deactivate(u.id)
    load()
  }

  // Alunos são criados automaticamente via cadastro de aluno — não aparecem aqui
  const creatableRoles: Role[] = me?.role === 'root'
    ? ['root', 'admin', 'professor']
    : ['professor']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Usuários</h1>
        {me?.role !== 'aluno' && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => { setEditUser(null); setShowForm(true) }}
          >
            <Plus size={18} /> Novo usuário
          </button>
        )}
      </div>

      {/* Aviso sobre alunos */}
      <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>
          Usuários do tipo <strong>Aluno</strong> são criados automaticamente ao cadastrar um aluno.
          Para adicionar alunos, acesse o menu <strong>Alunos</strong>.
        </span>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="card overflow-hidden p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Nome', 'Email', 'Perfil', 'Escola', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.school_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== me?.id && u.active && me?.role !== 'aluno' && (
                      <div className="flex gap-2">
                        <button
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          onClick={() => { setEditUser(u); setShowForm(true) }}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                          onClick={() => deactivate(u)}
                          title="Desativar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    <UserCog size={28} className="mx-auto mb-2 opacity-30" />
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <UserForm
          user={editUser}
          schools={schools}
          creatableRoles={creatableRoles}
          currentUser={me!}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}
