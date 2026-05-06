import { useEffect, useState } from 'react'
import { Settings, QrCode, Check, X } from 'lucide-react'
import { schoolsApi, School } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function SettingsPage() {
  const { user } = useAuth()
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [pixKey, setPixKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    schoolsApi.getMine()
      .then((r) => {
        setSchool(r.data)
        setPixKey(r.data.pix_key ?? '')
      })
      .catch(() => setError('Erro ao carregar dados da escola'))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!school) return
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const updated = await schoolsApi.update(school.id, { pix_key: pixKey || undefined })
      setSchool(updated.data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary-100 text-primary-600 rounded-xl p-3">
          <Settings size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configurações da sua academia</p>
        </div>
      </div>

      {/* Info da escola */}
      {school && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-3 text-gray-700">Dados da escola</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Nome</span>
              <span className="font-medium">{school.name}</span>
            </div>
            {school.phone && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Telefone</span>
                <span className="font-medium">{school.phone}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`badge ${school.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {school.active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Configuração Pix */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={18} className="text-primary-500" />
          <h2 className="font-semibold">Chave Pix para recebimento</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Configure a chave Pix da academia. Os alunos verão o QR Code e o código copia-e-cola
          com o valor da mensalidade já preenchido no painel deles.
        </p>

        <div>
          <label className="block text-sm font-medium mb-1">Chave Pix</label>
          <input
            className="input"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="CPF, CNPJ, email, telefone ou chave aleatória"
          />
          <p className="text-xs text-gray-400 mt-1">
            Exemplos: 123.456.789-00 · contato@academia.com · +5511999999999 · chave-aleatória-uuid
          </p>
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm mt-3">
            <Check size={16} /> Chave Pix salva com sucesso!
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            className="btn-secondary flex items-center gap-1"
            onClick={() => setPixKey(school?.pix_key ?? '')}
          >
            <X size={16} /> Cancelar
          </button>
          <button
            className="btn-primary flex items-center gap-1"
            onClick={save}
            disabled={saving}
          >
            <Check size={16} /> {saving ? 'Salvando...' : 'Salvar chave Pix'}
          </button>
        </div>
      </div>
    </div>
  )
}
