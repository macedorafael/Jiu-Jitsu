import { useEffect, useState } from 'react'
import { Award, Plus, Search } from 'lucide-react'
import { studentsApi, beltsApi, Student, Belt, BeltHistory } from '../../api/client'

const BELT_LABELS: Record<Belt, string> = {
  white: 'Branca', grey: 'Cinza', yellow: 'Amarela', orange: 'Laranja',
  green: 'Verde', blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}
const BELTS: Belt[] = ['white', 'grey', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black']

export default function BeltsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Student | null>(null)
  const [history, setHistory] = useState<BeltHistory[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ belt: 'white' as Belt, degree: 0, notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { studentsApi.list().then((r) => setStudents(r.data)) }, [])

  async function selectStudent(s: Student) {
    setSelected(s)
    setShowForm(false)
    const { data } = await beltsApi.history(s.id)
    setHistory(data)
  }

  async function promote() {
    if (!selected) return
    setSaving(true)
    try {
      await beltsApi.promote(selected.id, form)
      const { data } = await beltsApi.history(selected.id)
      setHistory(data)
      const { data: list } = await studentsApi.list()
      setStudents(list)
      setSelected(list.find((s) => s.id === selected.id) ?? selected)
      setShowForm(false)
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Faixas e Graus</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 space-y-2">
            <p className="text-sm font-medium text-gray-600">Selecione o aluno</p>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar..."
                className="input pl-8 py-1.5 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <ul className="divide-y max-h-[500px] overflow-y-auto">
            {students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())).map((s) => (
              <li
                key={s.id}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm ${selected?.id === s.id ? 'bg-primary-50 font-medium' : ''}`}
                onClick={() => selectStudent(s)}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-gray-400 text-xs">{BELT_LABELS[s.belt]} — {s.degree}ª grau</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-lg">{selected.name}</h2>
                    <p className="text-gray-500 text-sm">
                      {BELT_LABELS[selected.belt]} — {selected.degree}ª grau
                    </p>
                  </div>
                  <button
                    className="btn-primary flex items-center gap-2"
                    onClick={() => setShowForm(!showForm)}
                  >
                    <Plus size={16} /> Promover
                  </button>
                </div>

                {showForm && (
                  <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Nova faixa</label>
                        <select className="input" value={form.belt}
                          onChange={(e) => setForm({ ...form, belt: e.target.value as Belt })}>
                          {BELTS.map((b) => <option key={b} value={b}>{BELT_LABELS[b]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Grau (0-4)</label>
                        <input type="number" min={0} max={4} className="input" value={form.degree}
                          onChange={(e) => setForm({ ...form, degree: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
                      <input className="input" value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancelar</button>
                      <button className="btn-primary flex-1" onClick={promote} disabled={saving}>
                        {saving ? 'Salvando...' : 'Confirmar promoção'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Award size={16} /> Histórico de faixas
                </h3>
                {history.length === 0 ? (
                  <p className="text-gray-400 text-sm">Nenhuma promoção registrada</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between text-sm border-b pb-2">
                        <span>{BELT_LABELS[h.belt]} — {h.degree}ª grau</span>
                        <span className="text-gray-400">{h.awarded_date}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="card text-center py-12 text-gray-400">
              <Award size={32} className="mx-auto mb-2 opacity-30" />
              <p>Selecione um aluno para ver o histórico</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
