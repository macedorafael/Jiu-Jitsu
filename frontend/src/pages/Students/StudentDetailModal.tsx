import { useEffect, useState, useRef } from 'react'
import {
  X, User, Phone, Mail, Calendar, Award, Camera,
  CheckCircle, DollarSign, Pause, Play, History,
  Upload, Download, Trash2, FileText, RefreshCw,
} from 'lucide-react'
import { format, parseISO, differenceInYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  studentsApi, beltsApi, feesApi,
  Student, BeltHistory, FeePlan, Payment, Belt, StudentStatusHistoryEntry,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

type Tab = 'dados' | 'presencas' | 'faixas' | 'mensalidades'

interface AttRecord {
  session_id: number; date: string; schedule_info: string
  confidence_score?: number; auto: boolean
}

// ── belt config ───────────────────────────────────────────────────────────────
const BELT_PT: Record<Belt, string> = {
  white: 'Branca', grey: 'Cinza', yellow: 'Amarela', orange: 'Laranja',
  green: 'Verde', blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}
const BELT_BG: Record<Belt, string> = {
  white: 'bg-gray-200 text-gray-800', grey: 'bg-gray-400 text-white',
  yellow: 'bg-yellow-400 text-gray-900', orange: 'bg-orange-500 text-white',
  green: 'bg-green-500 text-white', blue: 'bg-blue-600 text-white',
  purple: 'bg-purple-600 text-white', brown: 'bg-amber-800 text-white',
  black: 'bg-gray-900 text-white',
}
const BELT_STRIPE: Record<Belt, string> = {
  white: 'bg-gray-400', grey: 'bg-gray-600', yellow: 'bg-yellow-600',
  orange: 'bg-orange-700', green: 'bg-green-700', blue: 'bg-blue-800',
  purple: 'bg-purple-800', brown: 'bg-amber-900', black: 'bg-white',
}

// ── helpers ───────────────────────────────────────────────────────────────────
function photoUrl(path?: string) {
  if (!path) return undefined
  const n = path.replace(/\\/g, '/')
  const idx = n.indexOf('uploads/')
  return idx === -1 ? `/uploads/${n}` : `/${n.slice(idx)}`
}
function fmtDate(iso: string) { return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }) }
function fmtDateTime(iso: string) { return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) }
function age(iso: string) { return differenceInYears(new Date(), parseISO(iso)) }

function BeltBadge({ belt, degree }: { belt: Belt; degree: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold px-3 py-1 rounded-full ${BELT_BG[belt]}`}>{BELT_PT[belt]}</span>
      {degree > 0 && (
        <div className="flex gap-1">
          {Array.from({ length: degree }).map((_, i) => (
            <span key={i} className={`w-3 h-3 rounded-full ${BELT_STRIPE[belt]}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <Icon size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-sm text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      active ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'
    }`}>
      {children}
    </button>
  )
}

const BELTS_ORDER: Belt[] = ['white', 'grey', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black']

// ── PromoteBeltModal ──────────────────────────────────────────────────────────
function PromoteBeltModal({
  student, onClose, onSaved,
}: { student: Student; onClose: () => void; onSaved: (belt: Belt, degree: number, entry: BeltHistory) => void }) {
  const [belt, setBelt] = useState<Belt>(student.belt)
  const [degree, setDegree] = useState(student.degree)
  const [awardedDate, setAwardedDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [certFile, setCertFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const certRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const { data: entry } = await beltsApi.promote(student.id, {
        belt, degree,
        notes: notes.trim() || undefined,
        awarded_date: awardedDate || undefined,
      })
      // Se selecionou certificado, faz upload logo após criar a promoção
      if (certFile) {
        try {
          const { data: withCert } = await beltsApi.uploadCertificate(student.id, entry.id, certFile)
          onSaved(belt, degree, withCert)
          return
        } catch {
          // promoção foi criada; certificado falhou mas não bloqueia
        }
      }
      onSaved(belt, degree, entry)
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? 'Erro ao registrar promoção')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <Award size={20} className="text-primary-500" />
          <h3 className="font-bold text-gray-900">Promover faixa</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Faixa</label>
            <select className="input" value={belt} onChange={(e) => setBelt(e.target.value as Belt)}>
              {BELTS_ORDER.map((b) => (
                <option key={b} value={b}>{BELT_PT[b]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Grau</label>
            <select className="input" value={degree} onChange={(e) => setDegree(Number(e.target.value))}>
              {[0, 1, 2, 3, 4].map((d) => (
                <option key={d} value={d}>{d === 0 ? 'Sem grau' : `${d}º grau`}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Data de graduação</label>
          <input type="date" className="input" value={awardedDate}
            onChange={(e) => setAwardedDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Observações <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea className="input resize-none" rows={2}
            placeholder="Ex: Graduação de fim de ano, exame..." value={notes}
            onChange={(e) => setNotes(e.target.value)} />
        </div>

        {/* Certificado */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Certificado <span className="text-gray-400 font-normal">(opcional — PDF ou imagem)</span>
          </label>
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
            onClick={() => certRef.current?.click()}
          >
            {certFile ? (
              <div className="flex items-center justify-center gap-2 text-sm text-primary-700">
                <FileText size={16} />
                <span className="truncate max-w-[240px]">{certFile.name}</span>
                <button
                  className="text-gray-400 hover:text-red-500 ml-1"
                  onClick={(e) => { e.stopPropagation(); setCertFile(null) }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="text-gray-400 text-sm flex items-center justify-center gap-2">
                <Upload size={16} /> Clique para selecionar
              </div>
            )}
          </div>
          <input
            ref={certRef} type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => e.target.files?.[0] && setCertFile(e.target.files[0])}
          />
        </div>

        {err && <p className="text-red-600 text-sm">{err}</p>}

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Promover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── BeltHistoryEntry ──────────────────────────────────────────────────────────
function BeltHistoryEntry({
  entry, studentId, canEdit, onUpdated,
}: {
  entry: BeltHistory; studentId: number; canEdit: boolean
  onUpdated: (updated: BeltHistory) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const certRef = useRef<HTMLInputElement>(null)

  const certUrl = entry.certificate_path
    ? (() => {
        const n = entry.certificate_path.replace(/\\/g, '/')
        const idx = n.indexOf('uploads/')
        return idx === -1 ? `/uploads/${n}` : `/${n.slice(idx)}`
      })()
    : null

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const { data } = await beltsApi.uploadCertificate(studentId, entry.id, file)
      onUpdated(data)
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Erro ao enviar certificado')
    } finally { setUploading(false) }
  }

  async function handleRemove() {
    if (!confirm('Remover certificado desta promoção?')) return
    setRemoving(true)
    try {
      await beltsApi.deleteCertificate(studentId, entry.id)
      onUpdated({ ...entry, certificate_path: undefined, certificate_name: undefined })
    } catch {
      alert('Erro ao remover certificado')
    } finally { setRemoving(false) }
  }

  return (
    <div className="flex items-start gap-4 pl-8 relative">
      <span className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow bg-primary-400" />
      <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <BeltBadge belt={entry.belt as Belt} degree={entry.degree} />
          <span className="text-xs text-gray-400">{fmtDate(entry.awarded_date)}</span>
        </div>
        {entry.notes && <p className="text-xs text-gray-500 mt-1.5 italic">{entry.notes}</p>}

        {/* Certificado */}
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          {certUrl ? (
            <>
              <a
                href={certUrl}
                download={entry.certificate_name || 'certificado'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-800 transition-colors"
              >
                <Download size={12} />
                {entry.certificate_name && entry.certificate_name.length > 28
                  ? entry.certificate_name.slice(0, 26) + '…'
                  : (entry.certificate_name || 'Certificado')}
              </a>
              {canEdit && (
                <>
                  <button
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-primary-600 transition-colors"
                    onClick={() => certRef.current?.click()}
                    disabled={uploading}
                    title="Substituir certificado"
                  >
                    {uploading ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    Substituir
                  </button>
                  <button
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 transition-colors ml-auto"
                    onClick={handleRemove}
                    disabled={removing}
                    title="Remover certificado"
                  >
                    <Trash2 size={11} /> Remover
                  </button>
                </>
              )}
            </>
          ) : canEdit ? (
            <button
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-primary-600 transition-colors"
              onClick={() => certRef.current?.click()}
              disabled={uploading}
            >
              {uploading
                ? <><RefreshCw size={11} className="animate-spin" /> Enviando...</>
                : <><Upload size={11} /> Anexar certificado</>
              }
            </button>
          ) : (
            <span className="text-[11px] text-gray-300 italic">Sem certificado</span>
          )}
        </div>

        <input
          ref={certRef} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
      </div>
    </div>
  )
}

// ── StatusChangeModal ─────────────────────────────────────────────────────────
function StatusChangeModal({
  student, onClose, onSaved,
}: { student: Student; onClose: () => void; onSaved: (s: Student, entry: StudentStatusHistoryEntry) => void }) {
  const newStatus: 'ativo' | 'pausado' = student.active ? 'pausado' : 'ativo'
  const [observation, setObservation] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setSaving(true)
    setErr('')
    try {
      const { data: entry } = await studentsApi.changeStatus(student.id, newStatus, observation.trim() || undefined)
      const updated: Student = { ...student, active: newStatus === 'ativo' }
      onSaved(updated, entry)
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? 'Erro ao alterar status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          {newStatus === 'pausado'
            ? <Pause size={20} className="text-orange-500" />
            : <Play size={20} className="text-green-500" />
          }
          <h3 className="font-bold text-gray-900">
            {newStatus === 'pausado' ? 'Pausar aluno' : 'Reativar aluno'}
          </h3>
        </div>

        <p className="text-sm text-gray-600">
          {newStatus === 'pausado'
            ? `O aluno ${student.name} será marcado como pausado e o acesso ao sistema será desativado.`
            : `O aluno ${student.name} será reativado e o acesso ao sistema será restaurado.`
          }
        </p>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Observação <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Ex: Viagem, lesão, pausa temporária..."
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            autoFocus
          />
        </div>

        {err && <p className="text-red-600 text-sm">{err}</p>}

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button
            className={`flex-1 font-semibold py-2 px-4 rounded-lg text-white transition-colors ${
              newStatus === 'pausado' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'
            }`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando...' : newStatus === 'pausado' ? 'Pausar' : 'Reativar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function StudentDetailModal({
  student: initialStudent, onClose, onUpdated,
}: { student: Student; onClose: () => void; onUpdated: (s: Student) => void }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'root'
  const canEdit = user?.role !== 'aluno'
  const canChangeStatus = user?.role === 'root' || user?.role === 'admin' || user?.role === 'professor'

  const [student, setStudent] = useState(initialStudent)
  const [tab, setTab] = useState<Tab>('dados')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showPromoteModal, setShowPromoteModal] = useState(false)

  const [attendance, setAttendance] = useState<AttRecord[] | null>(null)
  const [belts, setBelts] = useState<BeltHistory[] | null>(null)
  const [feePlan, setFeePlan] = useState<FeePlan | null | 'none'>('none')
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [statusHistory, setStatusHistory] = useState<StudentStatusHistoryEntry[] | null>(null)

  const photoRef = useRef<HTMLInputElement>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    if (tab === 'presencas' && attendance === null) {
      studentsApi.attendanceHistory(student.id).then((r) => setAttendance(r.data)).catch(() => setAttendance([]))
    }
    if (tab === 'faixas' && belts === null) {
      beltsApi.history(student.id).then((r) => setBelts(r.data)).catch(() => setBelts([]))
    }
    if (tab === 'mensalidades' && feePlan === 'none') {
      feesApi.getPlans(student.id)
        .then((r) => { setFeePlan(r.data[0] ?? null); return feesApi.studentPayments(student.id) })
        .then((r) => setPayments(r.data))
        .catch(() => { setFeePlan(null); setPayments([]) })
    }
    if (tab === 'dados' && statusHistory === null) {
      studentsApi.statusHistory(student.id).then((r) => setStatusHistory(r.data)).catch(() => setStatusHistory([]))
    }
  }, [tab, student.id])

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true); setPhotoError('')
    try {
      const { data } = await studentsApi.uploadPhoto(student.id, file)
      setStudent(data); onUpdated(data)
    } catch (e: any) {
      setPhotoError(e.response?.data?.detail ?? 'Erro ao enviar foto')
    } finally { setUploadingPhoto(false) }
  }

  function handlePromoteSaved(belt: Belt, degree: number, entry: BeltHistory) {
    const updated = { ...student, belt, degree }
    setStudent(updated)
    onUpdated(updated)
    setBelts((prev) => (prev ? [entry, ...prev] : [entry]))
    setShowPromoteModal(false)
  }

  function handleStatusSaved(updated: Student, entry: StudentStatusHistoryEntry) {
    setStudent(updated)
    onUpdated(updated)
    setStatusHistory((prev) => [entry, ...(prev ?? [])])
    setShowStatusModal(false)
  }

  const img = photoUrl(student.photo_path)
  const initials = student.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-start gap-4 p-6 border-b border-gray-100">
            {/* Photo */}
            <div className="relative flex-shrink-0">
              {img ? (
                <img src={img} alt={student.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-100 shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center border-2 border-gray-100">
                  <span className="text-2xl font-bold text-primary-600">{initials}</span>
                </div>
              )}
              {canEdit && (
                <button
                  className="absolute -bottom-1.5 -right-1.5 bg-white border border-gray-200 rounded-full p-1.5 shadow hover:bg-gray-50"
                  onClick={() => photoRef.current?.click()} disabled={uploadingPhoto}
                >
                  <Camera size={13} className="text-gray-600" />
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
            </div>

            {/* Name + belt + status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 truncate">{student.name}</h2>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  student.active ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {student.active ? 'Ativo' : 'Pausado'}
                </span>
              </div>
              <BeltBadge belt={student.belt} degree={student.degree} />
              {photoError && <p className="text-red-500 text-xs mt-1">{photoError}</p>}
              {uploadingPhoto && <p className="text-gray-400 text-xs mt-1">Enviando foto...</p>}
              <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                {student.attendance_count != null && (
                  <span><strong className="text-gray-700">{student.attendance_count}</strong> presenças</span>
                )}
                {student.enrollment_date && (
                  <span>Desde <strong className="text-gray-700">{fmtDate(student.enrollment_date)}</strong></span>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {canEdit && student.active && (
                  <button
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors"
                    onClick={() => setShowPromoteModal(true)}
                  >
                    <Award size={12} /> Promover faixa
                  </button>
                )}
                {canChangeStatus && (
                  <button
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      student.active
                        ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                    onClick={() => setShowStatusModal(true)}
                  >
                    {student.active ? <><Pause size={12} /> Pausar aluno</> : <><Play size={12} /> Reativar aluno</>}
                  </button>
                )}
              </div>
            </div>

            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={22} />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-100 overflow-x-auto px-4">
            <TabBtn active={tab === 'dados'} onClick={() => setTab('dados')}>Dados</TabBtn>
            <TabBtn active={tab === 'presencas'} onClick={() => setTab('presencas')}>
              Presenças{student.attendance_count ? ` (${student.attendance_count})` : ''}
            </TabBtn>
            <TabBtn active={tab === 'faixas'} onClick={() => setTab('faixas')}>Faixas</TabBtn>
            {isAdmin && <TabBtn active={tab === 'mensalidades'} onClick={() => setTab('mensalidades')}>Mensalidades</TabBtn>}
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* DADOS */}
            {tab === 'dados' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <InfoRow icon={User} label="Nome completo" value={student.name} />
                  <InfoRow icon={Mail} label="E-mail" value={student.email} />
                  <InfoRow icon={Phone} label="Telefone" value={student.phone} />
                  <InfoRow icon={Calendar} label="Data de nascimento"
                    value={student.birth_date ? `${fmtDate(student.birth_date)} (${age(student.birth_date)} anos)` : undefined} />
                  <InfoRow icon={Calendar} label="Data de matrícula"
                    value={student.enrollment_date ? fmtDate(student.enrollment_date) : undefined} />
                  <InfoRow icon={Camera} label="Reconhecimento facial"
                    value={student.photo_path ? 'Foto cadastrada — ativo' : 'Sem foto — envie para ativar'} />
                </div>

                {/* Histórico de status */}
                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                    <History size={14} className="text-gray-400" /> Histórico de status
                  </h3>
                  {statusHistory === null ? (
                    <p className="text-sm text-gray-400">Carregando...</p>
                  ) : statusHistory.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhuma alteração de status registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {statusHistory.map((h) => (
                        <div key={h.id} className={`rounded-xl p-3 border text-sm ${
                          h.new_status === 'ativo'
                            ? 'bg-green-50 border-green-100'
                            : 'bg-orange-50 border-orange-100'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {h.new_status === 'ativo'
                                ? <Play size={13} className="text-green-600" />
                                : <Pause size={13} className="text-orange-600" />
                              }
                              <span className={`font-semibold capitalize ${
                                h.new_status === 'ativo' ? 'text-green-700' : 'text-orange-700'
                              }`}>{h.new_status}</span>
                              <span className="text-gray-400 text-xs">por {h.changed_by_name}</span>
                            </div>
                            <span className="text-xs text-gray-400">{fmtDateTime(h.created_at)}</span>
                          </div>
                          {h.observation && (
                            <p className="text-gray-600 text-xs mt-1.5 italic border-l-2 border-gray-200 pl-2">
                              {h.observation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PRESENÇAS */}
            {tab === 'presencas' && (
              attendance === null ? <p className="text-gray-400 text-sm">Carregando...</p>
              : attendance.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Nenhuma presença registrada.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attendance.map((a) => (
                    <div key={a.session_id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="bg-primary-100 text-primary-700 rounded-lg px-3 py-2 text-center min-w-[60px]">
                        <p className="text-sm font-bold leading-none">{fmtDate(a.date).slice(0, 5)}</p>
                        <p className="text-[10px] text-primary-500">{fmtDate(a.date).slice(6)}</p>
                      </div>
                      <p className="text-sm font-medium text-gray-800 flex-1 truncate">{a.schedule_info}</p>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        a.auto ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {a.auto ? `${Math.round((a.confidence_score ?? 0) * 100)}% auto` : 'manual'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* FAIXAS */}
            {tab === 'faixas' && (
              belts === null ? <p className="text-gray-400 text-sm">Carregando...</p>
              : (
                <div>
                  <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <Award size={20} className="text-primary-500" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Faixa atual</p>
                      <div className="mt-0.5"><BeltBadge belt={student.belt} degree={student.degree} /></div>
                    </div>
                  </div>
                  {belts.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">Sem histórico de graduações.</p>
                  ) : (
                    <div className="relative space-y-3 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                      {belts.map((b) => (
                        <BeltHistoryEntry
                          key={b.id}
                          entry={b}
                          studentId={student.id}
                          canEdit={canEdit}
                          onUpdated={(updated) =>
                            setBelts((prev) => prev ? prev.map((x) => x.id === updated.id ? updated : x) : prev)
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            )}

            {/* MENSALIDADES */}
            {tab === 'mensalidades' && isAdmin && (
              feePlan === 'none' ? <p className="text-gray-400 text-sm">Carregando...</p>
              : feePlan === null ? (
                <div className="text-center py-12 text-gray-400">
                  <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Nenhum plano de mensalidade cadastrado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-primary-50 rounded-xl border border-primary-100 flex items-center gap-4">
                    <DollarSign size={20} className="text-primary-500" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Plano ativo</p>
                      <p className="text-lg font-bold text-gray-900">
                        R$ {feePlan.amount.toFixed(2).replace('.', ',')}
                        <span className="text-sm font-normal text-gray-500 ml-1">/ mês</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Vencimento dia {feePlan.due_day}
                        {feePlan.payment_method && ` · ${feePlan.payment_method}`}
                      </p>
                    </div>
                  </div>
                  {payments && payments.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Histórico de pagamentos</p>
                      <div className="space-y-2">
                        {payments.map((p) => (
                          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{p.month_reference}</p>
                              {p.payment_date && <p className="text-xs text-gray-400">Pago em {fmtDate(p.payment_date)}</p>}
                            </div>
                            {p.amount_paid != null && (
                              <span className="text-sm font-semibold">R$ {p.amount_paid.toFixed(2).replace('.', ',')}</span>
                            )}
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              p.status === 'paid' ? 'bg-green-100 text-green-700'
                              : p.status === 'overdue' ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {p.status === 'paid' ? 'Pago' : p.status === 'overdue' ? 'Vencido' : 'Pendente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {showPromoteModal && (
        <PromoteBeltModal
          student={student}
          onClose={() => setShowPromoteModal(false)}
          onSaved={handlePromoteSaved}
        />
      )}
      {showStatusModal && (
        <StatusChangeModal
          student={student}
          onClose={() => setShowStatusModal(false)}
          onSaved={handleStatusSaved}
        />
      )}
    </>
  )
}
