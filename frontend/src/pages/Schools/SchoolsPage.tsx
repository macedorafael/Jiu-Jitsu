import { useEffect, useState } from 'react'
import { Plus, Building2, Phone, Pencil, X, Check, Power, QrCode } from 'lucide-react'
import { schoolsApi, School } from '../../api/client'

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', pix_key: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load() {
    schoolsApi.list().then((r) => setSchools(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm({ name: '', phone: '', pix_key: '' })
    setEditId(null)
    setShowForm(true)
    setError('')
  }

  function openEdit(s: School) {
    setForm({ name: s.name, phone: s.phone ?? '', pix_key: s.pix_key ?? '' })
    setEditId(s.id)
    setShowForm(true)
    setError('')
  }

  async function save() {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      if (editId) {
        await schoolsApi.update(editId, {
          name: form.name,
          phone: form.phone || undefined,
          pix_key: form.pix_key || undefined,
        })
      } else {
        await schoolsApi.create({
          name: form.name,
          phone: form.phone || undefined,
          pix_key: form.pix_key || undefined,
        })
      }
      setShowForm(false)
      load()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s: School) {
    const action = s.active ? 'Desativar' : 'Ativar'
    const cascade = s.active ? ' Todos os usuários da escola serão desativados.' : ' Todos os usuários da escola serão reativados.'
    if (!confirm(`${action} a escola "${s.name}"?${cascade}`)) return
    try {
      if (s.active) {
        await schoolsApi.deactivate(s.id)
      } else {
        await schoolsApi.activate(s.id)
      }
      load()
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erro ao alterar status')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Escolas</h1>
          <p className="text-sm text-gray-500 mt-1">Apenas o perfil root tem acesso a esta tela</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus size={18} /> Nova escola
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card mb-6 border-primary-200 bg-primary-50">
          <h2 className="font-semibold mb-4">{editId ? 'Editar escola' : 'Nova escola'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome da escola *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Academia JJ Centro"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Chave Pix</label>
              <input
                className="input"
                value={form.pix_key}
                onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
                placeholder="CPF, CNPJ, email, telefone ou chave aleatória"
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

      {/* Lista */}
      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : schools.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Building2 size={32} className="mx-auto mb-2 opacity-30" />
          <p>Nenhuma escola cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((s) => (
            <div key={s.id} className={`card ${!s.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${s.active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    {s.phone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone size={12} /> {s.phone}
                      </p>
                    )}
                    {s.pix_key && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <QrCode size={11} /> Pix configurado
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {s.active && (
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleActive(s)}
                    className={`p-1.5 rounded ${s.active ? 'hover:bg-red-50 text-gray-500 hover:text-red-600' : 'hover:bg-green-50 text-gray-500 hover:text-green-600'}`}
                    title={s.active ? 'Desativar' : 'Ativar'}
                  >
                    <Power size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <span className={`badge ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
