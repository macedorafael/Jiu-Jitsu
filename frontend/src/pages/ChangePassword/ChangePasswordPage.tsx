import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { authApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function ChangePasswordPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const isForced = user?.must_change_password === true

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.next !== form.confirm) {
      setError('As senhas não conferem')
      return
    }
    if (form.next.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await authApi.changePassword({
        current_password: form.current,
        new_password: form.next,
      })
      setDone(true)
      // Recarrega o usuário para limpar must_change_password e redireciona
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Erro ao alterar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary-100 text-primary-600 rounded-xl p-3">
            <Lock size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Alterar senha</h1>
            {isForced && (
              <p className="text-sm text-orange-600 mt-0.5">
                Por segurança, altere sua senha antes de continuar.
              </p>
            )}
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8 text-green-600">
            <CheckCircle size={48} />
            <p className="text-lg font-medium">Senha alterada com sucesso!</p>
            <p className="text-sm text-gray-500">Redirecionando...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Senha atual */}
            <div>
              <label className="block text-sm font-medium mb-1">Senha atual</label>
              <div className="relative">
                <input
                  type={showPw.current ? 'text' : 'password'}
                  className="input pr-10"
                  value={form.current}
                  onChange={(e) => setForm({ ...form, current: e.target.value })}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPw((s) => ({ ...s, current: !s.current }))}
                >
                  {showPw.current ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Nova senha */}
            <div>
              <label className="block text-sm font-medium mb-1">Nova senha</label>
              <div className="relative">
                <input
                  type={showPw.next ? 'text' : 'password'}
                  className="input pr-10"
                  value={form.next}
                  onChange={(e) => setForm({ ...form, next: e.target.value })}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPw((s) => ({ ...s, next: !s.next }))}
                >
                  {showPw.next ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres</p>
            </div>

            {/* Confirmar nova senha */}
            <div>
              <label className="block text-sm font-medium mb-1">Confirmar nova senha</label>
              <div className="relative">
                <input
                  type={showPw.confirm ? 'text' : 'password'}
                  className="input pr-10"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
                >
                  {showPw.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              {!isForced && (
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => navigate(-1)}
                >
                  Cancelar
                </button>
              )}
              {isForced && (
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={logout}
                >
                  Sair
                </button>
              )}
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
