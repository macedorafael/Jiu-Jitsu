import { useEffect, useState } from 'react'
import { Settings, QrCode, Check, X, Award } from 'lucide-react'
import { schoolsApi, School } from '../../api/client'

const BELT_GROUPS = [
  {
    key: 'min_attendance_infantil' as const,
    label: 'Faixas Coloridas (Infantil)',
    description: 'Vale para todas as faixas infantis: Branca → Cinza e Branca → Cinza → Amarela → Laranja → Verde e todas as variantes',
    color: 'bg-gradient-to-r from-gray-100 via-yellow-100 to-green-100',
    dot: 'bg-yellow-400',
  },
  {
    key: 'min_attendance_blue' as const,
    label: 'Faixa Azul',
    description: 'Mínimo de presenças para promover à faixa azul (adulto)',
    color: 'bg-blue-50',
    dot: 'bg-blue-500',
  },
  {
    key: 'min_attendance_purple' as const,
    label: 'Faixa Roxa',
    description: 'Mínimo de presenças para promover à faixa roxa',
    color: 'bg-purple-50',
    dot: 'bg-purple-600',
  },
  {
    key: 'min_attendance_brown' as const,
    label: 'Faixa Marrom',
    description: 'Mínimo de presenças para promover à faixa marrom',
    color: 'bg-amber-50',
    dot: 'bg-amber-700',
  },
  {
    key: 'min_attendance_black' as const,
    label: 'Faixa Preta',
    description: 'Mínimo de presenças para promover à faixa preta',
    color: 'bg-gray-100',
    dot: 'bg-gray-900',
  },
]

type AttendanceFields = Pick<School,
  'min_attendance_infantil' | 'min_attendance_blue' |
  'min_attendance_purple' | 'min_attendance_brown' | 'min_attendance_black'
>

export default function SettingsPage() {
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)

  // Pix
  const [pixKey, setPixKey] = useState('')
  const [savingPix, setSavingPix] = useState(false)
  const [successPix, setSuccessPix] = useState(false)
  const [errorPix, setErrorPix] = useState('')

  // Graduação
  const [attendance, setAttendance] = useState<Record<string, string>>({
    min_attendance_infantil: '',
    min_attendance_blue: '',
    min_attendance_purple: '',
    min_attendance_brown: '',
    min_attendance_black: '',
  })
  const [savingAtt, setSavingAtt] = useState(false)
  const [successAtt, setSuccessAtt] = useState(false)
  const [errorAtt, setErrorAtt] = useState('')

  useEffect(() => {
    schoolsApi.getMine()
      .then((r) => {
        const s = r.data
        setSchool(s)
        setPixKey(s.pix_key ?? '')
        setAttendance({
          min_attendance_infantil: s.min_attendance_infantil?.toString() ?? '',
          min_attendance_blue: s.min_attendance_blue?.toString() ?? '',
          min_attendance_purple: s.min_attendance_purple?.toString() ?? '',
          min_attendance_brown: s.min_attendance_brown?.toString() ?? '',
          min_attendance_black: s.min_attendance_black?.toString() ?? '',
        })
      })
      .catch(() => setErrorPix('Erro ao carregar dados da escola'))
      .finally(() => setLoading(false))
  }, [])

  async function savePix() {
    if (!school) return
    setSavingPix(true); setErrorPix(''); setSuccessPix(false)
    try {
      const updated = await schoolsApi.update(school.id, { pix_key: pixKey || undefined })
      setSchool(updated.data)
      setSuccessPix(true)
      setTimeout(() => setSuccessPix(false), 3000)
    } catch (err: any) {
      setErrorPix(err.response?.data?.detail ?? 'Erro ao salvar')
    } finally {
      setSavingPix(false)
    }
  }

  async function saveAttendance() {
    if (!school) return
    setSavingAtt(true); setErrorAtt(''); setSuccessAtt(false)
    try {
      const payload: Record<string, number | undefined> = {}
      for (const g of BELT_GROUPS) {
        const v = attendance[g.key]
        const parsed = v ? parseInt(v) : NaN
        payload[g.key] = !isNaN(parsed) && parsed > 0 ? parsed : undefined
      }
      const updated = await schoolsApi.update(school.id, payload as any)
      setSchool(updated.data)
      setSuccessAtt(true)
      setTimeout(() => setSuccessAtt(false), 3000)
    } catch (err: any) {
      setErrorAtt(err.response?.data?.detail ?? 'Erro ao salvar')
    } finally {
      setSavingAtt(false)
    }
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3 mb-2">
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
        <div className="card">
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
            Exemplos: 123.456.789-00 · contato@academia.com · +5511999999999
          </p>
        </div>
        {errorPix && <p className="text-red-600 text-sm mt-3">{errorPix}</p>}
        {successPix && (
          <div className="flex items-center gap-2 text-green-600 text-sm mt-3">
            <Check size={16} /> Chave Pix salva com sucesso!
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <button className="btn-secondary flex items-center gap-1" onClick={() => setPixKey(school?.pix_key ?? '')}>
            <X size={16} /> Cancelar
          </button>
          <button className="btn-primary flex items-center gap-1" onClick={savePix} disabled={savingPix}>
            <Check size={16} /> {savingPix ? 'Salvando...' : 'Salvar chave Pix'}
          </button>
        </div>
      </div>

      {/* Requisitos de Graduação */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Award size={18} className="text-primary-500" />
          <h2 className="font-semibold">Requisitos de Graduação</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Defina a quantidade mínima de presenças necessária para o aluno ser promovido.
          Esse valor é contado a partir da última graduação do aluno.
        </p>

        <div className="space-y-3">
          {BELT_GROUPS.map((g) => (
            <div key={g.key} className={`rounded-xl p-3 ${g.color}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${g.dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{g.label}</p>
                    <p className="text-xs text-gray-500 truncate">{g.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    className="input w-24 text-center"
                    placeholder="—"
                    value={attendance[g.key]}
                    onChange={(e) => setAttendance((prev) => ({ ...prev, [g.key]: e.target.value }))}
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">presenças</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {errorAtt && <p className="text-red-600 text-sm mt-3">{errorAtt}</p>}
        {successAtt && (
          <div className="flex items-center gap-2 text-green-600 text-sm mt-3">
            <Check size={16} /> Requisitos de graduação salvos!
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            className="btn-secondary flex items-center gap-1"
            onClick={() => {
              if (!school) return
              setAttendance({
                min_attendance_infantil: school.min_attendance_infantil?.toString() ?? '',
                min_attendance_blue: school.min_attendance_blue?.toString() ?? '',
                min_attendance_purple: school.min_attendance_purple?.toString() ?? '',
                min_attendance_brown: school.min_attendance_brown?.toString() ?? '',
                min_attendance_black: school.min_attendance_black?.toString() ?? '',
              })
            }}
          >
            <X size={16} /> Cancelar
          </button>
          <button className="btn-primary flex items-center gap-1" onClick={saveAttendance} disabled={savingAtt}>
            <Check size={16} /> {savingAtt ? 'Salvando...' : 'Salvar requisitos'}
          </button>
        </div>
      </div>
    </div>
  )
}
