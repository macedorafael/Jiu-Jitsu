import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const STORAGE_KEY = 'academia_remember'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Carrega credenciais salvas ao abrir a tela
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const { email: e, password: p } = JSON.parse(saved)
        setEmail(e ?? '')
        setPassword(p ?? '')
        setRemember(true)
      } catch {}
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      if (remember) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, password }))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
      navigate('/')
    } catch {
      setError('Email ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #0d0d0d 0%, #1a0000 50%, #0d0d0d 100%)',
      }}
    >
      {/* Padrão de fundo sutil */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #cc0000 0, #cc0000 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Faixa vermelha topo */}
          <div className="h-1.5 w-full" style={{ backgroundColor: '#CC0000' }} />

          <div className="px-8 pt-8 pb-10">
            {/* Logo / Header */}
            <div className="text-center mb-8">
                <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full font-black text-2xl tracking-widest text-white mb-4"
                style={{ backgroundColor: '#CC0000' }}
              >BJJ</div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-wide">
                Time BUBA
              </h1>
              <p className="text-gray-400 text-sm mt-1 tracking-widest uppercase font-medium">
                Sistema de Gestão
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  className="input"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Lembrar login */}
              <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded accent-red-600 cursor-pointer"
                />
                <span className="text-sm text-gray-500">Lembrar email e senha</span>
              </label>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span>⚠</span> {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-3 text-base tracking-wide"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Entrando...
                  </span>
                ) : 'Entrar'}
              </button>
            </form>
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-center text-gray-500 text-xs mt-6 italic">
          Bem-vindo à honra, disciplina e respeito; bem-vindo ao Jiu-Jitsu
        </p>
      </div>
    </div>
  )
}
