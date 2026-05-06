import { useState, useRef, useEffect } from 'react'
import {
  Upload, CheckCircle, AlertCircle, Calendar, Clock,
  ToggleLeft, ToggleRight, ScanFace, UserCheck, UserX,
  RefreshCw, Search, Award,
} from 'lucide-react'
import {
  attendanceApi, schedulesApi, studentsApi,
  ClassSchedule, Student, TempRecognized, TempUnidentified, ConfirmAttendanceItem,
} from '../../api/client'

const DAYS = [
  'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo',
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function faceImageUrl(path: string | undefined): string | undefined {
  if (!path) return undefined
  const n = path.replace(/\\/g, '/')
  const idx = n.indexOf('uploads/')
  return idx === -1 ? `/uploads/${n}` : `/${n.slice(idx)}`
}

// ─── FaceEntry ────────────────────────────────────────────────────────────────

type FaceEntry =
  | { kind: 'recognized'; data: TempRecognized }
  | { kind: 'unidentified'; data: TempUnidentified }

// ─── StudentPicker ────────────────────────────────────────────────────────────

function StudentPicker({
  students,
  onSelect,
  onCancel,
}: {
  students: Student[]
  onSelect: (id: number) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const filtered = students
    .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input text-xs py-1 pl-6"
          placeholder="Buscar aluno ativo..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      {q.length > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2 italic">Nenhum aluno encontrado</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                className="w-full text-left text-xs px-3 py-2 hover:bg-primary-50 hover:text-primary-700 transition-colors border-b border-gray-50 last:border-0"
                onClick={() => onSelect(s.id)}
              >
                {s.name}
              </button>
            ))
          )}
        </div>
      )}
      <button
        className="text-[11px] text-gray-400 hover:text-gray-600 text-left"
        onClick={onCancel}
      >
        Cancelar
      </button>
    </div>
  )
}

// ─── RecognizedCard ───────────────────────────────────────────────────────────

function RecognizedCard({
  entry, students,
  onChange, onRemove,
}: {
  entry: TempRecognized
  students: Student[]
  onChange: (prev: TempRecognized, next: TempRecognized) => void
  onRemove: (entry: TempRecognized) => void
}) {
  const [mode, setMode] = useState<'view' | 'change'>('view')
  const imgUrl = faceImageUrl(entry.photo_path) ?? faceImageUrl(entry.face_image_path)

  function handleChange(toId: number) {
    const s = students.find((x) => x.id === toId)
    if (!s) return
    onChange(entry, {
      ...entry,
      student_id: toId,
      student_name: s.name,
      confidence_score: undefined,
      photo_path: s.photo_path,
    })
    setMode('view')
  }

  return (
    <div className="bg-white rounded-xl border border-green-200 overflow-hidden flex flex-col">
      <div className="relative bg-gray-100 h-32 flex items-center justify-center">
        {imgUrl ? (
          <img src={imgUrl} alt={entry.student_name} className="w-full h-full object-cover" />
        ) : (
          <UserCheck size={36} className="text-green-300" />
        )}
        <span className="absolute top-1 right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">✓</span>
      </div>

      <div className="p-2 flex-1 flex flex-col gap-1">
        {mode === 'view' ? (
          <>
            <p className="text-sm font-semibold leading-tight truncate" title={entry.student_name}>
              {entry.student_name}
            </p>
            {entry.confidence_score != null && (
              <p className="text-[11px] text-gray-400">{Math.round(entry.confidence_score * 100)}% confiança</p>
            )}
            <div className="flex gap-1 mt-auto pt-1">
              <button
                className="flex-1 text-[11px] text-primary-600 hover:underline flex items-center gap-1 justify-center"
                onClick={() => setMode('change')}
              >
                <RefreshCw size={10} /> Alterar
              </button>
              <button
                className="text-[11px] text-red-400 hover:text-red-600"
                onClick={() => onRemove(entry)}
                title="Remover"
              >✕</button>
            </div>
          </>
        ) : (
          <StudentPicker
            students={students}
            onSelect={handleChange}
            onCancel={() => setMode('view')}
          />
        )}
      </div>
    </div>
  )
}

// ─── UnidentifiedCard ─────────────────────────────────────────────────────────

function UnidentifiedCard({
  entry, students,
  onIdentify, onIgnore,
}: {
  entry: TempUnidentified
  students: Student[]
  onIdentify: (entry: TempUnidentified, studentId: number) => void
  onIgnore: (entry: TempUnidentified) => void
}) {
  const [mode, setMode] = useState<'ask' | 'select'>('ask')
  const imgUrl = faceImageUrl(entry.face_image_path)

  return (
    <div className="bg-white rounded-xl border border-orange-200 overflow-hidden flex flex-col">
      <div className="relative bg-gray-100 h-32 flex items-center justify-center">
        {imgUrl ? (
          <img src={imgUrl} alt="rosto" className="w-full h-full object-cover" />
        ) : (
          <UserX size={36} className="text-orange-300" />
        )}
        <span className="absolute top-1 right-1 bg-orange-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">?</span>
      </div>

      <div className="p-2 flex-1 flex flex-col gap-1">
        {mode === 'ask' ? (
          <>
            <p className="text-xs text-gray-500 italic">Não identificado</p>
            <div className="flex flex-col gap-1 mt-auto pt-1">
              <button
                className="text-[11px] text-primary-600 hover:underline text-left flex items-center gap-1"
                onClick={() => setMode('select')}
              >
                <UserCheck size={10} /> Identificar aluno
              </button>
              <button
                className="text-[11px] text-gray-400 hover:text-gray-600 text-left"
                onClick={() => onIgnore(entry)}
              >Ignorar</button>
            </div>
          </>
        ) : (
          <StudentPicker
            students={students}
            onSelect={(id) => { onIdentify(entry, id); setMode('ask') }}
            onCancel={() => setMode('ask')}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'detecting' | 'review' | 'confirming' | 'success'

export default function AttendancePage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')

  // Formulário
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [sessionDate, setSessionDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [scheduleId, setScheduleId] = useState<number>(0)
  const [useFlexible, setUseFlexible] = useState(false)
  const [flexibleTime, setFlexibleTime] = useState('')

  // Detecção
  const [tempId, setTempId] = useState<string | null>(null)
  const [facesDetected, setFacesDetected] = useState(0)
  const [faces, setFaces] = useState<FaceEntry[]>([])
  const [students, setStudents] = useState<Student[]>([])

  // Sucesso
  const [successInfo, setSuccessInfo] = useState<{ count: number } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    schedulesApi.list().then((r) => setSchedules(r.data)).catch(() => {})
  }, [])

  const grouped = DAYS.map((day, idx) => ({
    day, idx,
    items: schedules.filter((s) => s.day_of_week === idx),
  })).filter((g) => g.items.length > 0)

  const formLocked = phase === 'detecting' || phase === 'confirming'

  // ── Selecionar foto → detectar automaticamente ─────────────────────────────

  function handleFile(f: File) {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
    setFaces([])
    setTempId(null)
    startDetect(f)
  }

  async function startDetect(f: File) {
    setPhase('detecting')
    setError('')
    try {
      const sid = useFlexible ? undefined : (scheduleId > 0 ? scheduleId : undefined)
      const flex = useFlexible ? flexibleTime.trim() || undefined : undefined
      const [{ data: detect }, { data: studs }] = await Promise.all([
        attendanceApi.detectFaces(f, notes || undefined, sessionDate, sid, flex),
        studentsApi.list(),
      ])
      setStudents(studs)
      setTempId(detect.temp_id)
      setFacesDetected(detect.faces_detected)
      setFaces([
        ...detect.recognized.map((r): FaceEntry => ({ kind: 'recognized', data: r })),
        ...detect.unidentified.map((u): FaceEntry => ({ kind: 'unidentified', data: u })),
      ])
      setPhase('review')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Erro ao processar foto')
      setPhase('idle')
    }
  }

  // ── Mutações locais (sem API) ──────────────────────────────────────────────

  function onRecognizedChange(prev: TempRecognized, next: TempRecognized) {
    setFaces((fs) =>
      fs.map((f) =>
        f.kind === 'recognized' && f.data.student_id === prev.student_id
          ? { kind: 'recognized', data: next }
          : f,
      ),
    )
  }

  function onRecognizedRemove(entry: TempRecognized) {
    setFaces((fs) => fs.filter((f) => !(f.kind === 'recognized' && f.data.student_id === entry.student_id)))
  }

  function onIdentify(entry: TempUnidentified, studentId: number) {
    const s = students.find((x) => x.id === studentId)
    if (!s) return
    setFaces((fs) =>
      fs.map((f) =>
        f.kind === 'unidentified' && f.data.temp_face_id === entry.temp_face_id
          ? {
              kind: 'recognized',
              data: {
                student_id: studentId,
                student_name: s.name,
                confidence_score: undefined,
                photo_path: s.photo_path,
                face_image_path: entry.face_image_path,
              },
            }
          : f,
      ),
    )
  }

  function onIgnore(entry: TempUnidentified) {
    setFaces((fs) => fs.filter((f) => !(f.kind === 'unidentified' && f.data.temp_face_id === entry.temp_face_id)))
  }

  // ── Confirmar e salvar ─────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!tempId) return
    setPhase('confirming')
    try {
      const attendance: ConfirmAttendanceItem[] = faces
        .filter((f) => f.kind === 'recognized')
        .map((f) => ({
          student_id: (f.data as TempRecognized).student_id,
          confidence_score: (f.data as TempRecognized).confidence_score,
          face_image_path: (f.data as TempRecognized).face_image_path,
        }))

      const { data } = await attendanceApi.confirmSession(tempId, attendance)
      setSuccessInfo({ count: data.attendance_count })
      setPhase('success')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Erro ao registrar chamada')
      setPhase('review')
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function handleReset() {
    setPhase('idle')
    setFile(null)
    setPreview(null)
    setTempId(null)
    setFaces([])
    setFacesDetected(0)
    setError('')
    setNotes('')
    setSuccessInfo(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Contadores ─────────────────────────────────────────────────────────────

  const recognizedCount = faces.filter((f) => f.kind === 'recognized').length
  const unidentifiedCount = faces.filter((f) => f.kind === 'unidentified').length

  // ── Render ─────────────────────────────────────────────────────────────────

  // Tela de sucesso
  if (phase === 'success' && successInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={44} className="text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Chamada registrada!</h2>
          <p className="text-gray-500 mt-2">
            <strong className="text-gray-800">{successInfo.count}</strong>{' '}
            aluno{successInfo.count !== 1 ? 's' : ''} com presença confirmada.
          </p>
        </div>
        <button className="btn-primary px-8 py-3 text-base" onClick={handleReset}>
          Fazer nova chamada
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Chamada por Foto</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Formulário ── */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Calendar size={18} /> Configurar sessão
          </h2>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium mb-1">Data da aula *</label>
            <input
              type="date" className="input"
              value={sessionDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setSessionDate(e.target.value)}
              disabled={formLocked || phase === 'review'}
            />
          </div>

          {/* Horário */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium flex items-center gap-1">
                <Clock size={14} /> Horário da aula
              </label>
              <button
                type="button"
                onClick={() => { setUseFlexible(!useFlexible); setScheduleId(0); setFlexibleTime('') }}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
                disabled={formLocked || phase === 'review'}
              >
                {useFlexible
                  ? <><ToggleRight size={16} /> Aula regular</>
                  : <><ToggleLeft size={16} /> Horário flexível</>}
              </button>
            </div>
            {useFlexible ? (
              <div>
                <input type="text" className="input"
                  placeholder="Ex: Aula particular – 15:00 às 16:00"
                  value={flexibleTime}
                  onChange={(e) => setFlexibleTime(e.target.value)}
                  disabled={formLocked || phase === 'review'} />
                <p className="text-xs text-gray-400 mt-1">Descreva o horário livremente</p>
              </div>
            ) : (
              <select className="input" value={scheduleId}
                onChange={(e) => setScheduleId(Number(e.target.value))}
                disabled={formLocked || phase === 'review'}>
                <option value={0}>— Horário cadastrado (opcional) —</option>
                {grouped.map(({ day, items }) =>
                  items.map((s) => (
                    <option key={s.id} value={s.id}>{day} · {s.start_time}–{s.end_time}</option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Observações */}
          <textarea className="input resize-none"
            placeholder="Observações (opcional)" rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={formLocked || phase === 'review'} />

          {/* Foto */}
          <div>
            <p className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <Upload size={14} /> Foto do treino
              {phase === 'idle' && (
                <span className="text-xs text-gray-400 font-normal ml-1">
                  — o reconhecimento inicia ao selecionar
                </span>
              )}
            </p>
            <div
              className={`border-2 border-dashed rounded-xl text-center transition-colors relative overflow-hidden
                ${formLocked ? 'border-primary-300 cursor-not-allowed'
                  : phase === 'review' ? 'border-gray-200 cursor-default'
                  : 'border-gray-300 cursor-pointer hover:border-primary-500'}
              `}
              onClick={() => !formLocked && phase === 'idle' && inputRef.current?.click()}
            >
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="treino" className="w-full max-h-56 object-cover rounded-xl" />
                  {phase === 'detecting' && (
                    <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center rounded-xl gap-2">
                      <RefreshCw size={28} className="text-white animate-spin" />
                      <p className="text-white text-sm font-semibold">Identificando rostos...</p>
                    </div>
                  )}
                  {phase === 'review' && (
                    <button
                      className="absolute top-2 right-2 bg-white/90 text-xs px-2 py-1 rounded-lg shadow hover:bg-white transition-colors font-medium text-gray-600"
                      onClick={handleReset}
                    >✕ Trocar foto</button>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 py-10">
                  <Upload size={40} className="mx-auto mb-3" />
                  <p className="font-medium">Clique para selecionar a foto do treino</p>
                  <p className="text-sm mt-1">JPG, PNG ou WEBP</p>
                </div>
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* ── Painel de resultados ── */}
        <div className="space-y-4">
          {phase === 'idle' && (
            <div className="card text-center text-gray-400 py-16">
              <Upload size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Selecione a foto do treino</p>
              <p className="text-sm mt-1 opacity-70">O reconhecimento inicia automaticamente</p>
            </div>
          )}

          {phase === 'detecting' && (
            <div className="card text-center text-primary-500 py-16 space-y-3">
              <RefreshCw size={36} className="mx-auto animate-spin opacity-70" />
              <p className="font-semibold">Processando reconhecimento facial...</p>
              <p className="text-sm text-gray-400">Isso pode levar alguns segundos</p>
            </div>
          )}

          {(phase === 'review' || phase === 'confirming') && (
            <>
              {/* Resumo */}
              <div className="card py-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <ScanFace size={16} className="text-primary-400 flex-shrink-0" />
                <span>
                  <strong className="text-gray-700">{facesDetected}</strong> rosto{facesDetected !== 1 ? 's' : ''} detectado{facesDetected !== 1 ? 's' : ''} —{' '}
                  <strong className="text-green-600">{recognizedCount}</strong> reconhecido{recognizedCount !== 1 ? 's' : ''},{' '}
                  <strong className="text-orange-500">{unidentifiedCount}</strong> não identificado{unidentifiedCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Grid de rostos */}
              {faces.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <ScanFace size={15} className="text-primary-400" />
                    Rostos detectados
                    <span className="text-xs font-normal text-gray-400 ml-auto flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> reconhecido
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> não identificado
                      </span>
                    </span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {faces.map((face, i) =>
                      face.kind === 'recognized' ? (
                        <RecognizedCard
                          key={`rec-${face.data.student_id}-${i}`}
                          entry={face.data}
                          students={students}
                          onChange={onRecognizedChange}
                          onRemove={onRecognizedRemove}
                        />
                      ) : (
                        <UnidentifiedCard
                          key={`unid-${face.data.temp_face_id}`}
                          entry={face.data}
                          students={students}
                          onIdentify={onIdentify}
                          onIgnore={onIgnore}
                        />
                      )
                    )}
                  </div>

                  {unidentifiedCount > 0 && (
                    <p className="text-xs text-orange-600 mt-3 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Rostos de visitantes podem ser ignorados.
                    </p>
                  )}
                </div>
              )}

              {/* Botão registrar */}
              <button
                className="btn-primary w-full py-3 text-base font-bold flex items-center justify-center gap-2"
                onClick={handleConfirm}
                disabled={phase === 'confirming' || recognizedCount === 0}
              >
                {phase === 'confirming' ? (
                  <><RefreshCw size={16} className="animate-spin" /> Registrando...</>
                ) : (
                  <><Award size={16} /> Registrar chamada ({recognizedCount} aluno{recognizedCount !== 1 ? 's' : ''})</>
                )}
              </button>

              {recognizedCount === 0 && (
                <p className="text-xs text-center text-gray-400">
                  Identifique pelo menos um aluno para registrar a chamada.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
