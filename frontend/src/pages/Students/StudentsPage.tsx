import { useEffect, useState, useMemo } from 'react'
import { Plus, Search, Eye, Camera, Edit2, UserX, ChevronLeft, ChevronRight } from 'lucide-react'
import { studentsApi, Student, Belt } from '../../api/client'
import StudentForm from './StudentForm'
import StudentPhotoModal from './StudentPhotoModal'
import StudentDetailModal from './StudentDetailModal'
import { useAuth } from '../../contexts/AuthContext'

const PAGE_SIZE = 15

const BELT_BG: Record<Belt, string> = {
  white: 'bg-gray-100 text-gray-700',
  grey: 'bg-gray-300 text-gray-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  brown: 'bg-amber-100 text-amber-800',
  black: 'bg-gray-800 text-white',
}
const BELT_DOT: Record<Belt, string> = {
  white: 'bg-gray-400', grey: 'bg-gray-500', yellow: 'bg-yellow-500',
  orange: 'bg-orange-500', green: 'bg-green-600', blue: 'bg-blue-600',
  purple: 'bg-purple-600', brown: 'bg-amber-800', black: 'bg-white border border-gray-400',
}
const BELT_PT: Record<Belt, string> = {
  white: 'Branca', grey: 'Cinza', yellow: 'Amarela', orange: 'Laranja',
  green: 'Verde', blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}
const BELT_STRIPE: Record<Belt, string> = {
  white: 'bg-gray-400', grey: 'bg-gray-600', yellow: 'bg-yellow-600',
  orange: 'bg-orange-700', green: 'bg-green-700', blue: 'bg-blue-800',
  purple: 'bg-purple-800', brown: 'bg-amber-900', black: 'bg-white',
}

// Cor de fundo da linha baseada na faixa (hex para garantir override sobre bg-white do .card)
const BELT_ROW_BG: Record<Belt, string> = {
  white:  '#f8fafc',   // slate-50
  grey:   '#e5e7eb',   // gray-200
  yellow: '#fefce8',   // yellow-50
  orange: '#fff7ed',   // orange-50
  green:  '#f0fdf4',   // green-50
  blue:   '#eff6ff',   // blue-50
  purple: '#faf5ff',   // purple-50
  brown:  '#fffbeb',   // amber-50
  black:  '#1f2937',   // gray-800
}
// Cor da barra lateral esquerda
const BELT_ACCENT: Record<Belt, string> = {
  white:  '#9ca3af',
  grey:   '#6b7280',
  yellow: '#eab308',
  orange: '#f97316',
  green:  '#16a34a',
  blue:   '#3b82f6',
  purple: '#9333ea',
  brown:  '#92400e',
  black:  '#374151',
}
// Faixas de fundo escuro precisam de texto claro
const BELT_DARK: Partial<Record<Belt, true>> = { black: true }

const BELTS_ORDER: Belt[] = ['white', 'grey', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black']

function photoUrl(path: string | undefined) {
  if (!path) return undefined
  const n = path.replace(/\\/g, '/')
  const idx = n.indexOf('uploads/')
  return idx === -1 ? `/uploads/${n}` : `/${n.slice(idx)}`
}

export default function StudentsPage() {
  const { user } = useAuth()
  const canEdit = user?.role !== 'aluno'

  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativo' | 'pausado'>('all')
  const [filterBelt, setFilterBelt] = useState<Belt | 'all'>('all')
  const [filterDegree, setFilterDegree] = useState<number | 'all'>('all')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [photoStudent, setPhotoStudent] = useState<Student | null>(null)
  const [detailStudent, setDetailStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    Promise.all([studentsApi.list(true), studentsApi.list(false)])
      .then(([activeRes, inactiveRes]) => {
        setStudents([...activeRes.data, ...inactiveRes.data])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Apply all filters
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (filterStatus === 'ativo' && !s.active) return false
      if (filterStatus === 'pausado' && s.active) return false
      if (filterBelt !== 'all' && s.belt !== filterBelt) return false
      if (filterDegree !== 'all' && s.degree !== filterDegree) return false
      return true
    })
  }, [students, search, filterStatus, filterBelt, filterDegree])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, filterStatus, filterBelt, filterDegree])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleUpdated(updated: Student) {
    setStudents((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    if (detailStudent?.id === updated.id) setDetailStudent(updated)
  }

  const hasFilters = search || filterStatus !== 'all' || filterBelt !== 'all' || filterDegree !== 'all'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Alunos</h1>
        {canEdit && (
          <button className="btn-primary flex items-center gap-2"
            onClick={() => { setEditStudent(null); setShowForm(true) }}>
            <Plus size={18} /> Novo aluno
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2">
          {/* Status */}
          <select
            className="input text-sm flex-1 min-w-[130px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'ativo' | 'pausado')}
          >
            <option value="all">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
          </select>

          {/* Belt */}
          <select
            className="input text-sm flex-1 min-w-[130px]"
            value={filterBelt}
            onChange={(e) => setFilterBelt(e.target.value as Belt | 'all')}
          >
            <option value="all">Todas as faixas</option>
            {BELTS_ORDER.map((b) => (
              <option key={b} value={b}>{BELT_PT[b]}</option>
            ))}
          </select>

          {/* Degree */}
          <select
            className="input text-sm flex-1 min-w-[100px]"
            value={filterDegree}
            onChange={(e) => setFilterDegree(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">Todos os graus</option>
            {[0, 1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>{d === 0 ? 'Sem grau' : `${d}º grau`}</option>
            ))}
          </select>

          {/* Clear filters */}
          {hasFilters && (
            <button
              className="text-sm px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors"
              onClick={() => { setSearch(''); setFilterStatus('all'); setFilterBelt('all'); setFilterDegree('all') }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Count summary */}
        <p className="text-xs text-gray-400">
          {filtered.length} aluno{filtered.length !== 1 ? 's' : ''}
          {hasFilters ? ' encontrado' : ' no total'}
          {filtered.length !== 1 ? 's' : ''}
          {totalPages > 1 && ` · página ${page} de ${totalPages}`}
        </p>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-gray-500 text-center py-12">Carregando...</p>
      ) : (
        <>
          <div className="space-y-2">
            {paginated.map((s) => {
              const img = photoUrl(s.photo_path)
              const initials = s.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
              const isDark = !!BELT_DARK[s.belt]
              return (
                <div
                  key={s.id}
                  className="card p-0 flex items-center gap-4 pr-4 hover:shadow-md transition-shadow cursor-pointer group overflow-hidden"
                  style={{ backgroundColor: BELT_ROW_BG[s.belt] }}
                  onClick={() => setDetailStudent(s)}
                >
                  {/* Barra lateral colorida */}
                  <div
                    className="flex-shrink-0 w-1.5 self-stretch"
                    style={{ backgroundColor: BELT_ACCENT[s.belt] }}
                  />

                  {/* Avatar */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden">
                    {img ? (
                      <img src={img} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: BELT_ACCENT[s.belt] + '33' }}
                      >
                        <span className="font-bold text-base" style={{ color: BELT_ACCENT[s.belt] }}>
                          {initials}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {s.name}
                      </p>
                      {!s.active && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                          Pausado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {/* Belt badge */}
                      <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${BELT_BG[s.belt]}`}>
                        {BELT_PT[s.belt]}
                        {s.degree > 0 && (
                          <span className="flex gap-0.5 ml-0.5">
                            {Array.from({ length: s.degree }).map((_, i) => (
                              <span key={i} className={`w-2 h-2 rounded-full flex-shrink-0 ${BELT_STRIPE[s.belt]}`} />
                            ))}
                          </span>
                        )}
                      </span>
                      {/* Phone */}
                      {s.phone && (
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>{s.phone}</span>
                      )}
                      {/* No photo warning */}
                      {!s.photo_path && (
                        <span className="text-[10px] text-orange-400 font-medium">⚠ Sem foto</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-1 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={`p-2 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:bg-white/10' : 'text-primary-500 hover:bg-primary-50'}`}
                      title="Ver perfil completo"
                      onClick={() => setDetailStudent(s)}
                    >
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <>
                        <button
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}
                          title="Editar"
                          onClick={() => { setEditStudent(s); setShowForm(true) }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}
                          title="Alterar foto"
                          onClick={() => setPhotoStudent(s)}
                        >
                          <Camera size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {paginated.length === 0 && (
              <div className="card text-center py-12 text-gray-400">
                <UserX size={32} className="mx-auto mb-2 opacity-30" />
                <p>Nenhum aluno encontrado</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && arr[idx - 1] !== p - 1) acc.push('ellipsis')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${i}`} className="px-1 text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        p === page
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showForm && (
        <StudentForm
          student={editStudent}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
      {photoStudent && (
        <StudentPhotoModal
          student={photoStudent}
          onClose={() => setPhotoStudent(null)}
          onSaved={() => { setPhotoStudent(null); load() }}
        />
      )}
      {detailStudent && (
        <StudentDetailModal
          student={detailStudent}
          onClose={() => setDetailStudent(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
