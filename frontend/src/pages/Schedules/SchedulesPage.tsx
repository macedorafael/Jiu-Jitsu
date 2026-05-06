import { useEffect, useState } from 'react'
import { Plus, Clock, Pencil, Trash2, X, Check } from 'lucide-react'
import { schedulesApi, ClassSchedule } from '../../api/client'

const DAYS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
]

const DAY_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-purple-100 text-purple-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-orange-100 text-orange-700',
  'bg-red-100 text-red-700',
]

interface FormState {
  day_of_week: number
  start_time: string
  end_time: string
}

const EMPTY_FORM: FormState = { day_of_week: 0, start_time: '20:00', end_time: '21:30' }

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load() {
    schedulesApi.list()
      .then((r) => setSchedules(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setError('')
    setShowForm(true)
  }

  function openEdit(s: ClassSchedule) {
    setForm({ day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time })
    setEditId(s.id)
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.start_time || !form.end_time) { setError('Preencha os horários'); return }
    if (form.start_time >= form.end_time) { setError('Horário de início deve ser anterior ao término'); return }
    setSaving(true); setError('')
    try {
      if (editId) {
        await schedulesApi.update(editId, form)
      } else {
        await schedulesApi.create(form)
      }
      setShowForm(false)
      load()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function remove(s: ClassSchedule) {
    if (!confirm(`Remover horário ${DAYS[s.day_of_week]} ${s.start_time}–${s.end_time}?`)) return
    await schedulesApi.delete(s.id)
    load()
  }

  // Agrupa por dia da semana
  const grouped = DAYS.map((day, idx) => ({
    day,
    idx,
    items: schedules.filter((s) => s.day_of_week === idx),
  })).filter((g) => g.items.length > 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Horários de Aulas</h1>
          <p className="text-sm text-gray-500 mt-1">Defina os dias e horários fixos da academia</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus size={18} /> Novo horário
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card mb-6 border-primary-200 bg-primary-50">
          <h2 className="font-semibold mb-4">{editId ? 'Editar horário' : 'Novo horário de aula'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Dia da semana *</label>
              <select
                className="input"
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Início *</label>
              <input
                type="time"
                className="input"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Término *</label>
              <input
                type="time"
                className="input"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button className="btn-secondary flex items-center gap-1" onClick={() => setShowForm(false)}>
              <X size={16} /> Cancelar
            </button>
            <button className="btn-primary flex items-center gap-1" onClick={save} disabled={saving}>
              <Check size={16} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista agrupada por dia */}
      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : schedules.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum horário cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo horário" para começar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ day, idx, items }) => (
            <div key={idx} className="card">
              <div className="flex items-center gap-2 mb-3">
                <span className={`badge text-sm font-semibold ${DAY_COLORS[idx]}`}>{day}</span>
                <span className="text-xs text-gray-400">{items.length} aula{items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Clock size={16} className="text-primary-500" />
                      <span className="font-semibold text-gray-800">
                        {s.start_time} <span className="text-gray-400 font-normal">até</span> {s.end_time}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({calcDuration(s.start_time, s.end_time)})
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(s)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dias sem aula */}
      {!loading && schedules.length > 0 && (
        <div className="mt-4 card bg-gray-50">
          <p className="text-xs text-gray-500 font-medium mb-2">Dias sem aula cadastrada:</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, idx) =>
              schedules.every((s) => s.day_of_week !== idx) ? (
                <span key={idx} className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{day}</span>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function calcDuration(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const totalMin = (eh * 60 + em) - (sh * 60 + sm)
  if (totalMin <= 0) return ''
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m}min`
}
