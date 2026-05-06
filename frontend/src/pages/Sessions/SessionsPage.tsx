import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ClipboardList, ChevronDown, ChevronRight, Plus, UserPlus,
  Camera, Pencil, Calendar, Clock, User, Trash2, X, Search,
} from 'lucide-react'
import {
  attendanceApi, schedulesApi, studentsApi,
  Session, AttendanceResult, ClassSchedule, Student,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

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

// ── SessionRow ────────────────────────────────────────────────────────────────
interface SessionRowProps {
  session: Session
  students: Student[]
  canEdit: boolean
  onDeleted: (id: number) => void
}

function SessionRow({ session, students, canEdit, onDeleted }: SessionRowProps) {
  const [open, setOpen] = useState(false)
  const [attendees, setAttendees] = useState<AttendanceResult[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [addingStudent, setAddingStudent] = useState(false)
  const [savingAdd, setSavingAdd] = useState(false)
  const [addSearch, setAddSearch] = useState('')

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

  // students not yet in attendees
  const presentIds = new Set((attendees ?? []).map((a) => a.student_id))
  const availableStudents = students.filter((s) => !presentIds.has(s.id))

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
        onClick={toggle}
      >
        <span className="text-gray-400">
          {loadingDetail ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full" />
          ) : open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>

        {/* date */}
        <span className="flex items-center gap-1.5 font-semibold text-gray-800 min-w-[90px]">
          <Calendar size={14} className="text-primary-400 flex-shrink-0" />
          {formatDate(session.date)}
        </span>

        {/* schedule */}
        <span className="flex items-center gap-1.5 text-sm text-gray-500 flex-1 truncate">
          <Clock size={13} className="flex-shrink-0" />
          {sessionLabel(session)}
        </span>

        {/* professor */}
        {session.professor_name && (
          <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
            <User size={13} className="flex-shrink-0" />
            {session.professor_name}
          </span>
        )}

        {/* photo badge */}
        {session.training_photo_path && (
          <span title="Chamada por foto">
            <Camera size={14} className="text-primary-400" />
          </span>
        )}

        {/* count */}
        <span className="ml-auto flex-shrink-0 bg-primary-100 text-primary-700 text-xs font-bold px-2.5 py-1 rounded-full">
          {session.attendance_count} aluno{session.attendance_count !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Detail */}
      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50">
          {/* notes */}
          {session.notes && (
            <p className="text-xs text-gray-500 italic mb-3 border-l-2 border-primary-300 pl-2">
              {session.notes}
            </p>
          )}

          {/* attendees grid */}
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
                    {/* avatar */}
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
                      {/* badge */}
                      {a.confidence_score != null ? (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" title="Reconhecido automaticamente">✓</span>
                      ) : (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-gray-400 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" title="Inserido manualmente">M</span>
                      )}
                      {/* remove btn (hover) */}
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
                    {/* name */}
                    <span className="text-[11px] text-gray-700 font-medium text-center leading-tight w-full truncate px-1" title={a.student_name}>
                      {a.student_name.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* add student */}
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'root' || user?.role === 'admin' || user?.role === 'professor'

  const [sessions, setSessions] = useState<Session[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(true)

  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterName, setFilterName] = useState('')
  const [debouncedName, setDebouncedName] = useState('')
  const [showManualModal, setShowManualModal] = useState(false)

  // Debounce do filtro por nome (500ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleNameChange(v: string) {
    setFilterName(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedName(v), 500)
  }

  const load = useCallback(async (nameFilter = '') => {
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

  useEffect(() => { load() }, [load])
  // Re-fetch quando o debounced name muda
  useEffect(() => { load(debouncedName) }, [debouncedName, load])

  // ── filtros locais de data ────────────────────────────────────────────────
  const filtered = sessions.filter((s) => {
    if (filterFrom && s.date < filterFrom) return false
    if (filterTo && s.date > filterTo) return false
    return true
  })

  function clearAllFilters() {
    setFilterFrom('')
    setFilterTo('')
    setFilterName('')
    setDebouncedName('')
  }

  // ── group by month ───────────────────────────────────────────────────────────
  const byMonth: Record<string, Session[]> = {}
  for (const s of filtered) {
    const key = s.date.slice(0, 7) // "YYYY-MM"
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

      {/* Filters */}
      <div className="card mb-6 flex flex-wrap items-end gap-4">
        {/* Nome do aluno */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
            <Search size={11} /> Nome do aluno (opcional)
          </label>
          <input type="text" className="input py-1.5 text-sm" placeholder="Buscar por aluno..."
            value={filterName} onChange={(e) => handleNameChange(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data início</label>
          <input type="date" className="input py-1.5 text-sm"
            value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data fim</label>
          <input type="date" className="input py-1.5 text-sm"
            value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </div>
        {(filterFrom || filterTo || filterName) && (
          <button className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-0.5"
            onClick={clearAllFilters}>
            <X size={14} /> Limpar filtros
          </button>
        )}
        <div className="ml-auto text-sm text-gray-400 self-end mb-0.5 whitespace-nowrap">
          {filtered.length} sessão{filtered.length !== 1 ? 'ões' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content */}
      {loading ? (
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
                    canEdit={canEdit}
                    onDeleted={handleDeleted}
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
