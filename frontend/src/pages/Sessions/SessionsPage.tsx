import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ClipboardList, ChevronDown, ChevronRight, Plus, UserPlus,
  Camera, Pencil, Calendar, Clock, User, X, Search,
  BarChart2, List, Award,
} from 'lucide-react'
import {
  attendanceApi, schedulesApi, studentsApi,
  Session, AttendanceResult, ClassSchedule, Student, StudentAttendanceSummary,
  BeltProgressEntry,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

const BELT_LABELS: Record<string, string> = {
  white: 'Branca', grey: 'Cinza', yellow: 'Amarela', orange: 'Laranja',
  green: 'Verde', blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}
const BELT_COLORS: Record<string, string> = {
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

// ── helpers ──────────────────────────────────────────────────────────────────
function photoUrl(path: string | undefined): string | undefined {
  if (!path) return undefined
  const n = path.replace(/\\/g, '/')
  const idx = n.indexOf('uploads/')
  return idx === -1 ? `/uploads/${n}` : `/${n.slice(idx)}`
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function sessionLabel(s: Session): string {
  if (s.schedule_info) return s.schedule_info
  if (s.flexible_time) return s.flexible_time
  return 'Horário livre'
}

/** Retorna data ISO de N meses atrás a partir de hoje */
function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

const PERIOD_OPTIONS = [
  { label: '1 mês', months: 1 },
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '12 meses', months: 12 },
]

// ── ManualSessionModal ────────────────────────────────────────────────────────
interface ManualModalProps {
  schedules: ClassSchedule[]
  onClose: () => void
  onCreated: (s: Session) => void
}

function ManualSessionModal({ schedules, onClose, onCreated }: ManualModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [sessionDate, setSessionDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [scheduleId, setScheduleId] = useState(0)
  const [useFlexible, setUseFlexible] = useState(false)
  const [flexibleTime, setFlexibleTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const grouped = DAYS.map((day, idx) => ({
    day, idx,
    items: schedules.filter((s) => s.day_of_week === idx),
  })).filter((g) => g.items.length > 0)

  async function handleSave() {
    setSaving(true)
    setErr('')
    try {
      const sid = useFlexible ? undefined : (scheduleId > 0 ? scheduleId : undefined)
      const flex = useFlexible ? flexibleTime.trim() || undefined : undefined
      const { data } = await attendanceApi.createManualSession({
        session_date: sessionDate,
        notes: notes || undefined,
        schedule_id: sid,
        flexible_time: flex,
      })
      onCreated(data)
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? 'Erro ao criar sessão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Pencil size={18} /> Nova Sessão Manual
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Data da aula *</label>
          <input type="date" className="input" value={sessionDate}
            max={today} onChange={(e) => setSessionDate(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium flex items-center gap-1"><Clock size={13} /> Horário</label>
            <button type="button" className="text-xs text-primary-600 hover:underline"
              onClick={() => { setUseFlexible(!useFlexible); setScheduleId(0); setFlexibleTime('') }}>
              {useFlexible ? 'Usar horário cadastrado' : 'Horário flexível'}
            </button>
          </div>
          {useFlexible ? (
            <input type="text" className="input" placeholder="Ex: Aula particular 15:00"
              value={flexibleTime} onChange={(e) => setFlexibleTime(e.target.value)} />
          ) : (
            <select className="input" value={scheduleId} onChange={(e) => setScheduleId(Number(e.target.value))}>
              <option value={0}>— Sem horário fixo —</option>
              {grouped.map(({ day, items }) =>
                items.map((s) => (
                  <option key={s.id} value={s.id}>{day} · {s.start_time}–{s.end_time}</option>
                ))
              )}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea className="input resize-none" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </div>

        {err && <p className="text-red-600 text-sm">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Criando...' : 'Criar sessão'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EditSessionModal ──────────────────────────────────────────────────────────
interface EditModalProps {
  session: Session
  schedules: ClassSchedule[]
  onClose: () => void
  onUpdated: (s: Session) => void
}

function EditSessionModal({ session, schedules, onClose, onUpdated }: EditModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [sessionDate, setSessionDate] = useState(session.date)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [scheduleId, setScheduleId] = useState(0)
  const [useFlexible, setUseFlexible] = useState(!!session.flexible_time)
  const [flexibleTime, setFlexibleTime] = useState(session.flexible_time ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const grouped = DAYS.map((day, idx) => ({
    day, idx,
    items: schedules.filter((s) => s.day_of_week === idx),
  })).filter((g) => g.items.length > 0)

  async function handleSave() {
    setSaving(true)
    setErr('')
    try {
      const sid = useFlexible ? undefined : (scheduleId > 0 ? scheduleId : undefined)
      const flex = useFlexible ? flexibleTime.trim() || undefined : undefined
      const { data } = await attendanceApi.updateSession(session.id, {
        session_date: sessionDate,
        notes: notes || undefined,
        schedule_id: sid,
        flexible_time: flex,
      })
      onUpdated(data)
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Pencil size={18} /> Editar Sessão
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Data da aula *</label>
          <input type="date" className="input" value={sessionDate}
            max={today} onChange={(e) => setSessionDate(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium flex items-center gap-1"><Clock size={13} /> Horário</label>
            <button type="button" className="text-xs text-primary-600 hover:underline"
              onClick={() => { setUseFlexible(!useFlexible); setScheduleId(0); setFlexibleTime('') }}>
              {useFlexible ? 'Usar horário cadastrado' : 'Horário flexível'}
            </button>
          </div>
          {useFlexible ? (
            <input type="text" className="input" placeholder="Ex: Aula particular 15:00"
              value={flexibleTime} onChange={(e) => setFlexibleTime(e.target.value)} />
          ) : (
            <select className="input" value={scheduleId} onChange={(e) => setScheduleId(Number(e.target.value))}>
              <option value={0}>— Sem horário fixo —</option>
              {grouped.map(({ day, items }) =>
                items.map((s) => (
                  <option key={s.id} value={s.id}>{day} · {s.start_time}–{s.end_time}</option>
                ))
              )}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea className="input resize-none" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </div>

        {err && <p className="text-red-600 text-sm">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SessionRow ────────────────────────────────────────────────────────────────
interface SessionRowProps {
  session: Session
  students: Student[]
  schedules: ClassSchedule[]
  canEdit: boolean
  onDeleted: (id: number) => void
  onUpdated: (s: Session) => void
}

function SessionRow({ session: initialSession, students, schedules, canEdit, onDeleted, onUpdated }: SessionRowProps) {
  const [session, setSession] = useState(initialSession)
  const [open, setOpen] = useState(false)
  const [attendees, setAttendees] = useState<AttendanceResult[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [addingStudent, setAddingStudent] = useState(false)
  const [savingAdd, setSavingAdd] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [showEdit, setShowEdit] = useState(false)

  async function loadDetail() {
    if (attendees !== null) { setOpen(true); return }
    setLoadingDetail(true)
    try {
      const { data } = await attendanceApi.getSession(session.id)
      setAttendees(data.recognized)
      setOpen(true)
    } catch {
      setOpen(true)
    } finally {
      setLoadingDetail(false)
    }
  }

  function toggle() {
    if (open) { setOpen(false); return }
    loadDetail()
  }

  async function handleAddStudent(studentId: number) {
    if (!studentId) return
    setSavingAdd(true)
    try {
      const { data: newAtt } = await attendanceApi.addAttendanceManual(session.id, studentId)
      setAttendees((prev) => [...(prev ?? []), newAtt])
      setAddingStudent(false)
      setAddSearch('')
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Erro ao adicionar aluno')
    } finally {
      setSavingAdd(false)
    }
  }

  async function handleRemoveAttendee(studentId: number) {
    if (!confirm('Remover presença deste aluno?')) return
    try {
      await attendanceApi.removeAttendance(session.id, studentId)
      setAttendees((prev) => (prev ?? []).filter((a) => a.student_id !== studentId))
    } catch {
      alert('Erro ao remover presença')
    }
  }

  const presentIds = new Set((attendees ?? []).map((a) => a.student_id))
  const availableStudents = students.filter((s) => !presentIds.has(s.id))

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
        onClick={toggle}
      >
        <span className="text-gray-400">
          {loadingDetail ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full" />
          ) : open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>

        <span className="flex items-center gap-1.5 font-semibold text-gray-800 min-w-[90px]">
          <Calendar size={14} className="text-primary-400 flex-shrink-0" />
          {formatDate(session.date)}
        </span>

        <span className="flex items-center gap-1.5 text-sm text-gray-500 flex-1 truncate">
          <Clock size={13} className="flex-shrink-0" />
          {sessionLabel(session)}
        </span>

        {session.professor_name && (
          <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
            <User size={13} className="flex-shrink-0" />
            {session.professor_name}
          </span>
        )}

        {session.training_photo_path && (
          <span title="Chamada por foto">
            <Camera size={14} className="text-primary-400" />
          </span>
        )}

        <span className="ml-auto flex-shrink-0 bg-primary-100 text-primary-700 text-xs font-bold px-2.5 py-1 rounded-full">
          {session.attendance_count} aluno{session.attendance_count !== 1 ? 's' : ''}
        </span>

        {canEdit && (
          <button
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="Editar sessão"
            onClick={(e) => { e.stopPropagation(); setShowEdit(true) }}
          >
            <Pencil size={14} />
          </button>
        )}
      </button>

      {showEdit && (
        <EditSessionModal
          session={session}
          schedules={schedules}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            setSession(updated)
            onUpdated(updated)
            setShowEdit(false)
          }}
        />
      )}

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50">
          {session.notes && (
            <p className="text-xs text-gray-500 italic mb-3 border-l-2 border-primary-300 pl-2">
              {session.notes}
            </p>
          )}

          {attendees === null ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : attendees.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nenhuma presença registrada.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-3">
              {attendees.map((a) => {
                const img = photoUrl(a.photo_path)
                const initials = a.student_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                return (
                  <div key={a.student_id} className="group relative flex flex-col items-center gap-1.5">
                    <div className="relative">
                      {img ? (
                        <img
                          src={img}
                          alt={a.student_name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary-100 border-2 border-white shadow-sm flex items-center justify-center">
                          <span className="text-primary-600 font-bold text-sm">{initials}</span>
                        </div>
                      )}
                      {a.confidence_score != null ? (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" title="Reconhecido automaticamente">✓</span>
                      ) : (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-gray-400 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" title="Inserido manualmente">M</span>
                      )}
                      {canEdit && (
                        <button
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 items-center justify-center hidden group-hover:flex"
                          title="Remover"
                          onClick={() => handleRemoveAttendee(a.student_id)}
                        >
                          <X size={9} />
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-700 font-medium text-center leading-tight w-full truncate px-1" title={a.student_name}>
                      {a.student_name.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {canEdit && (
            <div className="mt-1 pt-2 border-t border-gray-200">
              {addingStudent ? (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input text-sm pl-8"
                        placeholder="Buscar aluno ativo..."
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        autoFocus
                        disabled={savingAdd}
                      />
                    </div>
                    <button
                      className="btn-secondary text-sm px-3"
                      onClick={() => { setAddingStudent(false); setAddSearch('') }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {addSearch.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white shadow-md max-h-40 overflow-y-auto">
                      {availableStudents
                        .filter((s) => s.name.toLowerCase().includes(addSearch.toLowerCase()))
                        .slice(0, 8)
                        .map((s) => (
                          <button
                            key={s.id}
                            className="w-full text-left text-sm px-3 py-2 hover:bg-primary-50 hover:text-primary-700 transition-colors border-b border-gray-50 last:border-0"
                            onClick={() => { handleAddStudent(s.id); setAddSearch('') }}
                            disabled={savingAdd}
                          >
                            {s.name}
                          </button>
                        ))}
                      {availableStudents.filter((s) =>
                        s.name.toLowerCase().includes(addSearch.toLowerCase())
                      ).length === 0 && (
                        <p className="text-sm text-gray-400 px-3 py-2 italic">Nenhum aluno encontrado</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium"
                  onClick={() => setAddingStudent(true)}
                >
                  <UserPlus size={14} /> Adicionar aluno manualmente
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Belt Progress helpers ─────────────────────────────────────────────────────
const ALL_BELT_LABELS: Record<string, string> = {
  white: 'Branca',
  grey_white: 'Cinza e Branca', grey: 'Cinza', grey_black: 'Cinza e Preta',
  yellow_white: 'Amarela e Branca', yellow: 'Amarela', yellow_black: 'Amarela e Preta',
  orange_white: 'Laranja e Branca', orange: 'Laranja', orange_black: 'Laranja e Preta',
  green_white: 'Verde e Branca', green: 'Verde', green_black: 'Verde e Preta',
  blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}

const BELT_BAR_COLOR: Record<string, string> = {
  white: '#d1d5db',
  grey_white: '#9ca3af', grey: '#6b7280', grey_black: '#374151',
  yellow_white: '#fef08a', yellow: '#facc15', yellow_black: '#ca8a04',
  orange_white: '#fed7aa', orange: '#fb923c', orange_black: '#c2410c',
  green_white: '#bbf7d0', green: '#22c55e', green_black: '#15803d',
  blue: '#3b82f6', purple: '#9333ea', brown: '#92400e', black: '#111827',
}

// Próxima faixa por perfil
const NEXT_BELT_INFANTIL: Record<string, string> = {
  white: 'Cinza e Branca',
  grey_white: 'Cinza', grey: 'Cinza e Preta', grey_black: 'Amarela e Branca',
  yellow_white: 'Amarela', yellow: 'Amarela e Preta', yellow_black: 'Laranja e Branca',
  orange_white: 'Laranja', orange: 'Laranja e Preta', orange_black: 'Verde e Branca',
  green_white: 'Verde', green: 'Verde e Preta', green_black: 'Azul',
}
const NEXT_BELT_ADULTO: Record<string, string> = {
  white: 'Azul',
  green_white: 'Verde', green: 'Verde e Preta', green_black: 'Azul',
  blue: 'Roxa', purple: 'Marrom', brown: 'Preta',
}
function getNextBeltLabel(belt: string, profile: string): string | undefined {
  return profile === 'infantil' ? NEXT_BELT_INFANTIL[belt] : NEXT_BELT_ADULTO[belt]
}

function BeltProgressView({ loading }: { loading: boolean }) {
  const { user } = useAuth()
  const isAdminEspecifico = user?.role === 'admin_especifico'
  const lockedProfile = isAdminEspecifico ? (user?.profile_access ?? null) : null

  const [progress, setProgress] = useState<BeltProgressEntry[]>([])
  const [progLoading, setProgLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [profileFilter, setProfileFilter] = useState<'all' | 'adulto' | 'infantil'>(
    (lockedProfile as 'adulto' | 'infantil') ?? 'all'
  )

  useEffect(() => {
    setProgLoading(true)
    studentsApi.beltProgress()
      .then(({ data }) => setProgress(data))
      .catch(() => setProgress([]))
      .finally(() => setProgLoading(false))
  }, [])

  if (progLoading || loading) {
    return <div className="text-center py-16 text-gray-400">Carregando evolução...</div>
  }

  const filtered = progress.filter((p) => {
    const effectiveFilter = lockedProfile ?? (profileFilter !== 'all' ? profileFilter : null)
    if (effectiveFilter && p.profile !== effectiveFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const withTarget = filtered.filter((p) => p.target_attendance != null)
  const noTarget = filtered.filter((p) => p.target_attendance == null)
  const sorted = [
    ...withTarget.sort((a, b) => {
      const pctA = a.target_attendance! > 0 ? a.attendance_since_promotion / a.target_attendance! : 0
      const pctB = b.target_attendance! > 0 ? b.attendance_since_promotion / b.target_attendance! : 0
      return pctB - pctA
    }),
    ...noTarget.sort((a, b) => a.name.localeCompare(b.name)),
  ]

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 py-1.5 text-sm w-52"
            placeholder="Buscar aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {lockedProfile ? (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-xs font-medium ${
            lockedProfile === 'infantil' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 bg-gray-50 text-gray-700'
          }`}>
            {lockedProfile === 'adulto' ? '🥋 Adulto' : '👦 Infantil'}
            <span className="opacity-60 font-normal">(fixo)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
            {(['all', 'adulto', 'infantil'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProfileFilter(p)}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  profileFilter === p ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
                style={profileFilter === p ? { backgroundColor: '#cc0000' } : {}}
              >
                {p === 'all' ? 'Todos' : p === 'adulto' ? '🥋 Adulto' : '👦 Infantil'}
              </button>
            ))}
          </div>
        )}
        <span className="text-xs text-gray-400">{filtered.length} aluno{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Award size={36} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => {
            const img = p.photo_url
            const initials = p.name.split(' ').map((n) => n[0]).slice(0, 2).join('')
            const target = p.target_attendance
            const count = p.attendance_since_promotion
            const pct = target && target > 0 ? Math.min(100, Math.round((count / target) * 100)) : null
            const barColor = BELT_BAR_COLOR[p.belt] ?? '#6b7280'
            const beltLabel = ALL_BELT_LABELS[p.belt] ?? p.belt
            const nextLabel = getNextBeltLabel(p.belt, p.profile)

            return (
              <div key={p.student_id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {img ? (
                    <img src={img} alt={p.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-600 font-bold text-sm">{initials}</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm truncate">{p.name}</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-white flex-shrink-0"
                        style={{ backgroundColor: barColor, borderColor: barColor }}
                      >
                        {beltLabel}{p.degree > 0 ? ` ${'◆'.repeat(p.degree)}` : ''}
                      </span>
                    </div>

                    {p.belt === 'black' ? (
                      <p className="text-xs font-semibold text-yellow-600">🏆 Faixa máxima</p>
                    ) : (
                      <div className="space-y-1.5">
                        {/* Barra de presenças */}
                        {target == null ? (
                          <p className="text-xs text-gray-400 italic">Presenças: meta não configurada</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-12 text-right flex-shrink-0">{beltLabel}</span>
                              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, backgroundColor: barColor }} />
                              </div>
                              <span className="text-[10px] text-gray-400 w-12 flex-shrink-0">{nextLabel ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between px-14">
                              <span className="text-xs text-gray-600">{count} de {target} presenças</span>
                              <span className={`text-xs font-bold ${pct! >= 100 ? 'text-green-600' : 'text-gray-500'}`}>
                                {pct}%{pct! >= 100 && ' ✓'}
                              </span>
                            </div>
                          </>
                        )}
                        {/* Requisito de idade */}
                        {(() => {
                          const minAge = p.min_age_for_promotion
                          const age = p.student_age
                          if (!minAge) return null
                          if (age == null) return (
                            <p className="text-[11px] text-gray-400 italic px-14">
                              🎂 Idade mín. {minAge} anos — data de nascimento não informada
                            </p>
                          )
                          const ok = age >= minAge
                          return (
                            <div className={`flex items-center gap-1.5 px-14 text-[11px] font-medium ${ok ? 'text-green-600' : 'text-red-500'}`}>
                              <span>{ok ? '✓' : '✗'}</span>
                              <span>Idade mínima: {minAge} anos</span>
                              <span className="font-normal text-gray-400">({age} anos)</span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── StudentSummaryView ────────────────────────────────────────────────────────
function StudentSummaryView({
  summary, loading,
}: {
  summary: StudentAttendanceSummary[]
  loading: boolean
}) {
  const [search, setSearch] = useState('')
  const filtered = summary.filter((s) =>
    s.student_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Carregando...</div>
  }

  if (summary.length === 0) {
    return (
      <div className="card text-center py-16 text-gray-400">
        <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
        <p>Nenhuma presença no período selecionado</p>
      </div>
    )
  }

  const maxCount = Math.max(...summary.map((s) => s.attendance_count), 1)

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9 py-1.5 text-sm"
          placeholder="Buscar aluno..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Totalizador */}
      <p className="text-sm text-gray-500">
        <strong className="text-gray-800">{filtered.length}</strong> aluno{filtered.length !== 1 ? 's' : ''} —{' '}
        <strong className="text-gray-800">{filtered.reduce((a, s) => a + s.attendance_count, 0)}</strong> presenças no período
      </p>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map((s) => {
          const img = photoUrl(s.photo_path)
          const initials = s.student_name.split(' ').map((n) => n[0]).slice(0, 2).join('')
          const pct = Math.round((s.attendance_count / maxCount) * 100)
          const beltLabel = BELT_LABELS[s.belt] ?? s.belt
          const beltColor = BELT_COLORS[s.belt] ?? 'bg-gray-100 text-gray-700'

          return (
            <div key={s.student_id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
              {/* Avatar */}
              {img ? (
                <img src={img} alt={s.student_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold text-sm">{initials}</span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-gray-900 truncate">{s.student_name}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${beltColor}`}>
                    {beltLabel}
                  </span>
                </div>
                {/* Barra de progresso */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: '#cc0000' }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-20 text-right whitespace-nowrap">
                    {s.attendance_count} aula{s.attendance_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'root' || user?.role === 'admin' || user?.role === 'admin_especifico'

  const [sessions, setSessions] = useState<Session[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterName, setFilterName] = useState('')
  const [debouncedName, setDebouncedName] = useState('')
  const [activePeriod, setActivePeriod] = useState<number | null>(null)

  // Visão
  const [viewMode, setViewMode] = useState<'sessions' | 'students' | 'evolucao'>('sessions')
  const [summary, setSummary] = useState<StudentAttendanceSummary[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [showManualModal, setShowManualModal] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleNameChange(v: string) {
    setFilterName(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedName(v), 500)
  }

  // Aplica período rápido
  function applyPeriod(months: number) {
    const from = monthsAgo(months)
    const to = new Date().toISOString().slice(0, 10)
    setFilterFrom(from)
    setFilterTo(to)
    setActivePeriod(months)
  }

  function clearAllFilters() {
    setFilterFrom('')
    setFilterTo('')
    setFilterName('')
    setDebouncedName('')
    setActivePeriod(null)
  }

  // Load sessions
  const loadSessions = useCallback(async (nameFilter = '') => {
    setLoading(true)
    try {
      const [{ data: sess }, { data: studs }, { data: scheds }] = await Promise.all([
        attendanceApi.listSessions(nameFilter || undefined),
        studentsApi.list(),
        schedulesApi.list(),
      ])
      setSessions(sess)
      setStudents(studs)
      setSchedules(scheds)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])
  useEffect(() => { loadSessions(debouncedName) }, [debouncedName, loadSessions])

  // Load summary whenever view mode switches to 'students' or period changes
  useEffect(() => {
    if (viewMode !== 'students') return
    setSummaryLoading(true)
    attendanceApi.studentSummary(filterFrom || undefined, filterTo || undefined)
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary([]))
      .finally(() => setSummaryLoading(false))
  }, [viewMode, filterFrom, filterTo])

  // Filtros locais de data para a lista de sessões
  const filtered = sessions.filter((s) => {
    if (filterFrom && s.date < filterFrom) return false
    if (filterTo && s.date > filterTo) return false
    return true
  })

  // Agrupado por mês
  const byMonth: Record<string, Session[]> = {}
  for (const s of filtered) {
    const key = s.date.slice(0, 7)
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(s)
  }
  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  function monthLabel(key: string) {
    const [y, m] = key.split('-')
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
  }

  function handleManualCreated(s: Session) {
    setSessions((prev) => [s, ...prev])
    setShowManualModal(false)
  }

  function handleDeleted(id: number) {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  function handleUpdated(updated: Session) {
    setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s))
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList size={24} /> Relatório de Presenças
        </h1>
        {canEdit && (
          <button className="btn-primary flex items-center gap-2"
            onClick={() => setShowManualModal(true)}>
            <Plus size={16} /> Nova Sessão Manual
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card mb-4 space-y-3">
        {/* Filtros de período rápido */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Período:</span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.months}
              onClick={() => applyPeriod(opt.months)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                activePeriod === opt.months
                  ? 'text-white border-transparent'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-600'
              }`}
              style={activePeriod === opt.months ? { backgroundColor: '#cc0000', borderColor: '#cc0000' } : {}}
            >
              {opt.label}
            </button>
          ))}
          {(filterFrom || filterTo) && (
            <span className="text-xs text-gray-400 ml-1">
              {filterFrom ? formatDate(filterFrom) : '—'} → {filterTo ? formatDate(filterTo) : '—'}
            </span>
          )}
        </div>

        {/* Filtros avançados */}
        <div className="flex flex-wrap items-end gap-3">
          {viewMode === 'sessions' && (
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <Search size={11} /> Nome do aluno
              </label>
              <input type="text" className="input py-1.5 text-sm" placeholder="Buscar por aluno..."
                value={filterName} onChange={(e) => handleNameChange(e.target.value)} />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data início</label>
            <input type="date" className="input py-1.5 text-sm"
              value={filterFrom}
              onChange={(e) => { setFilterFrom(e.target.value); setActivePeriod(null) }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data fim</label>
            <input type="date" className="input py-1.5 text-sm"
              value={filterTo}
              onChange={(e) => { setFilterTo(e.target.value); setActivePeriod(null) }} />
          </div>
          {(filterFrom || filterTo || filterName) && (
            <button className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-0.5"
              onClick={clearAllFilters}>
              <X size={14} /> Limpar
            </button>
          )}
        </div>

        {/* Toggle de visão */}
        <div className="flex items-center gap-1 border-t border-gray-100 pt-3">
          <span className="text-xs font-medium text-gray-500 mr-2">Visualizar:</span>
          <button
            onClick={() => setViewMode('sessions')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              viewMode === 'sessions'
                ? 'text-white border-transparent'
                : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-600'
            }`}
            style={viewMode === 'sessions' ? { backgroundColor: '#cc0000', borderColor: '#cc0000' } : {}}
          >
            <List size={13} /> Por sessão
          </button>
          <button
            onClick={() => setViewMode('students')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              viewMode === 'students'
                ? 'text-white border-transparent'
                : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-600'
            }`}
            style={viewMode === 'students' ? { backgroundColor: '#cc0000', borderColor: '#cc0000' } : {}}
          >
            <BarChart2 size={13} /> Por aluno
          </button>
          <button
            onClick={() => setViewMode('evolucao')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              viewMode === 'evolucao'
                ? 'text-white border-transparent'
                : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-600'
            }`}
            style={viewMode === 'evolucao' ? { backgroundColor: '#cc0000', borderColor: '#cc0000' } : {}}
          >
            <Award size={13} /> Evolução
          </button>
          {viewMode === 'sessions' && (
            <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
              {filtered.length} sessão{filtered.length !== 1 ? 'ões' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {viewMode === 'evolucao' ? (
        <BeltProgressView loading={loading} />
      ) : viewMode === 'students' ? (
        <StudentSummaryView summary={summary} loading={summaryLoading} />
      ) : loading ? (
        <div className="text-center py-16 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
          <p>Nenhuma sessão encontrada</p>
          {canEdit && (
            <p className="text-sm mt-1">
              Registre uma chamada por foto ou crie uma sessão manual.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {months.map((month) => (
            <section key={month}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {monthLabel(month)}
                <span className="ml-2 font-normal normal-case">
                  — {byMonth[month].reduce((acc, s) => acc + s.attendance_count, 0)} presenças no mês
                </span>
              </h2>
              <div className="space-y-2">
                {byMonth[month].map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    students={students}
                    schedules={schedules}
                    canEdit={canEdit}
                    onDeleted={handleDeleted}
                    onUpdated={handleUpdated}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showManualModal && (
        <ManualSessionModal
          schedules={schedules}
          onClose={() => setShowManualModal(false)}
          onCreated={handleManualCreated}
        />
      )}
    </div>
  )
}
