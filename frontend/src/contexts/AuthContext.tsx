import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authApi, User } from '../api/client'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  viewAsSchool: { id: number; name: string } | null
  setViewAsSchool: (school: { id: number; name: string } | null) => void
}

const AuthContext = createContext<AuthCtx>(null!)

const TOKEN_KEY      = 'token'
const TOKEN_EXP_KEY  = 'token_expires_at'
const VIEW_SCHOOL_KEY = 'view_as_school'
const SESSION_MS     = 24 * 60 * 60 * 1000  // 24 horas em ms

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXP_KEY)
  localStorage.removeItem(VIEW_SCHOOL_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewAsSchool, setViewAsSchoolState] = useState<{ id: number; name: string } | null>(() => {
    const saved = localStorage.getItem(VIEW_SCHOOL_KEY)
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    const token      = localStorage.getItem(TOKEN_KEY)
    const expiresAt  = localStorage.getItem(TOKEN_EXP_KEY)

    // Verifica se o token local já passou das 24h
    if (!token || (expiresAt && Date.now() > Number(expiresAt))) {
      clearSession()
      setLoading(false)
      return
    }

    authApi.me()
      .then((r) => setUser(r.data))
      .catch(() => clearSession())
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const { data } = await authApi.login(email, password)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + SESSION_MS))
    const me = await authApi.me()
    setUser(me.data)
  }

  function logout() {
    clearSession()
    setUser(null)
    setViewAsSchoolState(null)
  }

  function setViewAsSchool(school: { id: number; name: string } | null) {
    setViewAsSchoolState(school)
    if (school) {
      localStorage.setItem(VIEW_SCHOOL_KEY, JSON.stringify(school))
    } else {
      localStorage.removeItem(VIEW_SCHOOL_KEY)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, viewAsSchool, setViewAsSchool }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
