import { useEffect, useState } from 'react'
import { Copy, Check, Award, Calendar, DollarSign, QrCode, AlertCircle, CheckCircle, Clock, Download, FileText } from 'lucide-react'
import { alunoApi, AlunoDashboard, Belt } from '../../api/client'

const BELT_COLORS: Record<Belt, string> = {
  white: 'bg-gray-100 text-gray-800',
  grey: 'bg-gray-300 text-gray-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  brown: 'bg-amber-100 text-amber-800',
  black: 'bg-gray-800 text-white',
}
const BELT_LABELS: Record<Belt, string> = {
  white: 'Branca', grey: 'Cinza', yellow: 'Amarela', orange: 'Laranja',
  green: 'Verde', blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}

const FEE_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  paid:    { label: 'Em dia',    color: 'text-green-700 bg-green-100',  icon: <CheckCircle size={16} /> },
  pending: { label: 'Pendente', color: 'text-yellow-700 bg-yellow-100', icon: <Clock size={16} /> },
  overdue: { label: 'Atrasado', color: 'text-red-700 bg-red-100',       icon: <AlertCircle size={16} /> },
  no_plan: { label: 'Sem plano', color: 'text-gray-600 bg-gray-100',    icon: <DollarSign size={16} /> },
}

function formatMonth(m?: string) {
  if (!m) return ''
  const [year, month] = m.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[parseInt(month) - 1]}/${year}`
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function certUrl(path: string) {
  const n = path.replace(/\\/g, '/')
  const idx = n.indexOf('uploads/')
  return idx === -1 ? `/uploads/${n}` : `/${n.slice(idx)}`
}

export default function AlunoDashboardPage() {
  const [data, setData] = useState<AlunoDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    alunoApi.dashboard()
      .then((r) => setData(r.data))
      .catch(() => setError('Erro ao carregar dados. Tente novamente.'))
      .finally(() => setLoading(false))
  }, [])

  async function copyPix() {
    if (!data?.pix_copia_cola) return
    try {
      await navigator.clipboard.writeText(data.pix_copia_cola)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      alert('Não foi possível copiar. Selecione e copie manualmente:\n\n' + data.pix_copia_cola)
    }
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>
  if (error)   return <p className="text-red-500">{error}</p>
  if (!data)   return null

  const { student, attendance, belt_history, fee_status, fee_amount, fee_month, pix_qrcode_base64, pix_copia_cola } = data
  const feeInfo = fee_status ? FEE_STATUS[fee_status] ?? FEE_STATUS.no_plan : FEE_STATUS.no_plan
  // Pix sempre visível quando disponível (independente do status de pagamento)
  const showPix = !!pix_copia_cola

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Olá, {student.name.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Acompanhe seu progresso na academia</p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Faixa */}
        <div className="card flex items-center gap-4">
          <div className="bg-primary-100 text-primary-600 rounded-xl p-3">
            <Award size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Faixa atual</p>
            <span className={`badge mt-0.5 ${BELT_COLORS[student.belt]}`}>
              {BELT_LABELS[student.belt]} {student.degree > 0 ? `• ${student.degree}º grau` : ''}
            </span>
          </div>
        </div>

        {/* Presenças */}
        <div className="card flex items-center gap-4">
          <div className="bg-green-100 text-green-600 rounded-xl p-3">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total de presenças</p>
            <p className="text-2xl font-bold text-gray-900">{attendance.length}</p>
          </div>
        </div>

        {/* Mensalidade */}
        <div className="card flex items-center gap-4">
          <div className={`rounded-xl p-3 ${feeInfo.color.includes('green') ? 'bg-green-100 text-green-600' : feeInfo.color.includes('yellow') ? 'bg-yellow-100 text-yellow-600' : feeInfo.color.includes('red') ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Mensalidade</p>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full mt-0.5 ${feeInfo.color}`}>
              {feeInfo.icon} {feeInfo.label}
            </span>
            {fee_amount != null && (
              <p className="text-sm font-semibold mt-0.5">R$ {fee_amount.toFixed(2)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Pix para pagamento */}
      {showPix && (
        <div className="card border-2 border-primary-200 bg-primary-50">
          <div className="flex items-center gap-2 mb-4">
            <QrCode size={20} className="text-primary-600" />
            <h2 className="font-semibold text-primary-800">
              {fee_status === 'paid' ? 'Pagamento Pix' : 'Pagar mensalidade'}
              {fee_month && <span className="ml-1 font-normal text-gray-500">— {formatMonth(fee_month)}</span>}
              {fee_amount != null && <span className="ml-2 text-primary-600">R$ {fee_amount.toFixed(2)}</span>}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* QR Code */}
            {pix_qrcode_base64 && (
              <div className="flex-shrink-0">
                <img
                  src={`data:image/png;base64,${pix_qrcode_base64}`}
                  alt="QR Code Pix"
                  className="w-48 h-48 rounded-xl border-4 border-white shadow"
                />
                <p className="text-xs text-center text-gray-500 mt-1">Escaneie com seu banco</p>
              </div>
            )}

            {/* Copia e cola */}
            <div className="flex-1 w-full">
              <p className="text-sm font-medium text-gray-700 mb-2">Pix Copia e Cola:</p>
              <div className="bg-white rounded-xl p-3 border border-gray-200 mb-3">
                <p className="text-xs text-gray-600 break-all font-mono leading-relaxed">
                  {pix_copia_cola}
                </p>
              </div>
              <button
                onClick={copyPix}
                className={`btn-primary w-full flex items-center justify-center gap-2 ${copied ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar código Pix</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Presenças recentes */}
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-primary-500" />
          Histórico de presenças ({attendance.length})
        </h2>
        {attendance.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">Nenhuma presença registrada ainda</p>
        ) : (
          <div className="divide-y max-h-64 overflow-y-auto">
            {attendance.map((a) => (
              <div key={a.session_id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium">{formatDate(a.date)}</span>
                {a.notes && <span className="text-gray-400 text-xs truncate ml-2 max-w-[200px]">{a.notes}</span>}
                <span className="text-green-600 text-xs font-medium ml-auto">✓ Presente</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de faixas */}
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Award size={18} className="text-primary-500" />
          Histórico de faixas
        </h2>
        {belt_history.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">Nenhuma promoção registrada ainda</p>
        ) : (
          <div className="divide-y">
            {belt_history.map((b) => (
              <div key={b.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${BELT_COLORS[b.belt]}`}>
                    {BELT_LABELS[b.belt]} {b.degree > 0 ? `${b.degree}º grau` : ''}
                  </span>
                  <span className="text-sm text-gray-500">{formatDate(b.awarded_date)}</span>
                  {b.notes && <span className="text-xs text-gray-400 italic">{b.notes}</span>}
                </div>
                {b.certificate_path && (
                  <a
                    href={certUrl(b.certificate_path)}
                    download={b.certificate_name ?? true}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors border border-primary-200"
                  >
                    <FileText size={13} />
                    {b.certificate_name ?? 'Certificado'}
                    <Download size={12} className="ml-0.5 opacity-70" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meus certificados (apenas entradas com certificado) */}
      {belt_history.some((b) => b.certificate_path) && (
        <div className="card border border-primary-100 bg-primary-50/40">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FileText size={18} className="text-primary-500" />
            Meus certificados
          </h2>
          <div className="space-y-2">
            {belt_history
              .filter((b) => b.certificate_path)
              .map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-primary-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`badge flex-shrink-0 ${BELT_COLORS[b.belt]}`}>
                      {BELT_LABELS[b.belt]} {b.degree > 0 ? `${b.degree}º` : ''}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {b.certificate_name ?? 'Certificado de promoção'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(b.awarded_date)}</p>
                    </div>
                  </div>
                  <a
                    href={certUrl(b.certificate_path!)}
                    download={b.certificate_name ?? true}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 ml-3 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-800 bg-primary-100 hover:bg-primary-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download size={13} />
                    Baixar
                  </a>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
