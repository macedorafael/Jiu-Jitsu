import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'
import { studentsApi, Student } from '../../api/client'

export default function StudentPhotoModal({
  student, onClose, onSaved,
}: { student: Student; onClose: () => void; onSaved: () => void }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  async function handleSave() {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      await studentsApi.uploadPhoto(student.id, file)
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Erro ao processar foto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Foto de referência — {student.name}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Envie uma foto com o rosto do aluno bem visível. Será usada para reconhecimento automático na chamada.
          </p>

          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary-500 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="preview" className="mx-auto h-48 object-cover rounded-lg" />
            ) : (
              <div className="text-gray-400">
                <Upload size={32} className="mx-auto mb-2" />
                <p className="text-sm">Clique para selecionar foto</p>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button className="btn-primary flex-1" onClick={handleSave} disabled={!file || loading}>
              {loading ? 'Processando...' : 'Salvar foto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
