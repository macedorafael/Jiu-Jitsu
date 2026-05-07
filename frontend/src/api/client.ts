import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default api

// ── Types ──────────────────────────────────────────────────────────────────

export type Role = 'root' | 'admin' | 'professor' | 'aluno'
export type Belt = 'white' | 'grey' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'brown' | 'black'
export type FeeStatus = 'pending' | 'paid' | 'overdue'

export interface School {
  id: number; name: string; phone?: string; pix_key?: string; active: boolean; created_at: string
}

export interface User {
  id: number; name: string; email: string; role: Role
  school_id?: number; school_name?: string; active: boolean
  must_change_password?: boolean; created_at: string
}

export interface StudentStatusHistoryEntry {
  id: number; new_status: string; observation?: string
  changed_by_name: string; created_at: string
}

export interface Student {
  id: number; name: string; email?: string; belt: Belt; degree: number
  enrollment_date: string; birth_date?: string; phone?: string
  photo_path?: string; active: boolean; created_at: string
  school_id?: number; user_id?: number; attendance_count?: number; belt_history?: BeltHistory[]
}

export interface BeltHistory {
  id: number; belt: Belt; degree: number; awarded_date: string; notes?: string; professor_id: number
  certificate_path?: string; certificate_name?: string
}

export interface AttendanceResult {
  student_id: number; student_name: string; confidence_score?: number; photo_path?: string
}

export interface UnidentifiedFace {
  id: number; face_image_path: string
}

export interface SessionResult {
  session_id: number; date: string
  recognized: AttendanceResult[]; unidentified: UnidentifiedFace[]
  faces_detected: number
}

// ── Two-phase attendance (detect → confirm) ────────────────────────────────

export interface TempRecognized {
  student_id: number; student_name: string
  confidence_score?: number; photo_path?: string
  face_image_path?: string   // recorte salvo em disco
}

export interface TempUnidentified {
  temp_face_id: string       // UUID local
  face_image_path: string
}

export interface DetectResult {
  temp_id: string
  recognized: TempRecognized[]
  unidentified: TempUnidentified[]
  faces_detected: number
}

export interface ConfirmAttendanceItem {
  student_id: number
  confidence_score?: number
  face_image_path?: string
}

export interface StudentAttendanceSummary {
  student_id: number
  student_name: string
  photo_path?: string
  belt: Belt
  attendance_count: number
}

export interface ClassSchedule {
  id: number; school_id?: number
  day_of_week: number   // 0=Segunda … 6=Domingo
  start_time: string    // "HH:MM"
  end_time: string      // "HH:MM"
  active: boolean; created_at: string
}

export interface Session {
  id: number; professor_id: number; professor_name?: string; date: string; notes?: string
  schedule_id?: number; schedule_info?: string; flexible_time?: string
  training_photo_path?: string; created_at: string; attendance_count: number
}

export interface FeePlan {
  id: number; student_id: number; amount: number; due_day: number
  payment_method?: string; active: boolean; created_at: string
}

export interface Payment {
  id: number; fee_plan_id: number; student_id: number
  month_reference: string; amount_paid?: number; payment_date?: string; status: FeeStatus
}

export interface AlunoDashboard {
  student: Student
  attendance: { session_id: number; date: string; notes?: string }[]
  belt_history: BeltHistory[]
  fee_status?: string   // 'paid' | 'pending' | 'overdue' | 'no_plan'
  fee_amount?: number
  fee_month?: string
  pix_key?: string
  pix_qrcode_base64?: string
  pix_copia_cola?: string
}

// ── API helpers ────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.postForm<{ access_token: string; must_change_password: boolean }>('/auth/login', { username: email, password }),
  me: () => api.get<User>('/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post<{ ok: boolean; message: string }>('/auth/change-password', data),
}

export const schoolsApi = {
  list: () => api.get<School[]>('/schools'),
  get: (id: number) => api.get<School>(`/schools/${id}`),
  getMine: () => api.get<School>('/schools/mine'),
  create: (data: { name: string; phone?: string; pix_key?: string }) => api.post<School>('/schools', data),
  update: (id: number, data: Partial<School>) => api.put<School>(`/schools/${id}`, data),
  deactivate: (id: number) => api.delete(`/schools/${id}`),
  activate: (id: number) => api.post<School>(`/schools/${id}/activate`),
}

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  get: (id: number) => api.get<User>(`/users/${id}`),
  create: (data: { name: string; email: string; password: string; role: Role; school_id?: number }) =>
    api.post<User>('/users', data),
  update: (id: number, data: Partial<User> & { password?: string }) =>
    api.put<User>(`/users/${id}`, data),
  deactivate: (id: number) => api.delete(`/users/${id}`),
}

export const studentsApi = {
  list: (active = true) => api.get<Student[]>('/students', { params: { active } }),
  get: (id: number) => api.get<Student>(`/students/${id}`),
  create: (data: Partial<Student> & { email: string }) => api.post<Student>('/students', data),
  update: (id: number, data: Partial<Student>) => api.put<Student>(`/students/${id}`, data),
  deactivate: (id: number) => api.delete(`/students/${id}`),
  uploadPhoto: (id: number, file: File) => {
    const form = new FormData(); form.append('file', file)
    return api.post<Student>(`/students/${id}/photo`, form)
  },
  attendanceHistory: (id: number) =>
    api.get<{ session_id: number; date: string; schedule_info: string; confidence_score?: number; auto: boolean }[]>(
      `/students/${id}/attendance-history`
    ),
  changeStatus: (id: number, status: 'ativo' | 'pausado', observation?: string) =>
    api.post<StudentStatusHistoryEntry>(`/students/${id}/status`, { status, observation }),
  statusHistory: (id: number) =>
    api.get<StudentStatusHistoryEntry[]>(`/students/${id}/status-history`),
}

export const schedulesApi = {
  list: () => api.get<ClassSchedule[]>('/schedules'),
  create: (data: { day_of_week: number; start_time: string; end_time: string }) =>
    api.post<ClassSchedule>('/schedules', data),
  update: (id: number, data: { day_of_week: number; start_time: string; end_time: string }) =>
    api.put<ClassSchedule>(`/schedules/${id}`, data),
  delete: (id: number) => api.delete(`/schedules/${id}`),
}

export const attendanceApi = {
  createSession: (
    file: File,
    notes?: string,
    date?: string,
    scheduleId?: number,
    flexibleTime?: string,
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (notes) form.append('notes', notes)
    if (date) form.append('session_date', date)
    if (scheduleId) form.append('schedule_id', scheduleId.toString())
    if (flexibleTime) form.append('flexible_time', flexibleTime)
    return api.post<SessionResult>('/sessions', form)
  },
  listSessions: (studentName?: string) =>
    api.get<Session[]>('/sessions', { params: studentName ? { student_name: studentName } : {} }),
  getSession: (id: number) => api.get<SessionResult>(`/sessions/${id}`),
  identifyFace: (sessionId: number, faceId: number, studentId: number) =>
    api.post<{ ok: boolean; student_name: string; photo_saved: boolean }>(
      `/sessions/${sessionId}/identify`,
      { face_id: faceId, student_id: studentId },
    ),
  changeAttendance: (sessionId: number, fromStudentId: number, toStudentId: number) =>
    api.patch<{ ok: boolean; student_name: string; photo_path?: string }>(
      `/sessions/${sessionId}/attendance`,
      { from_student_id: fromStudentId, to_student_id: toStudentId },
    ),
  removeAttendance: (sessionId: number, studentId: number) =>
    api.delete<{ ok: boolean }>(
      `/sessions/${sessionId}/attendance`,
      { data: { student_id: studentId } },
    ),
  addAttendanceManual: (sessionId: number, studentId: number) =>
    api.post<AttendanceResult>(`/sessions/${sessionId}/attendance`, { student_id: studentId }),
  createManualSession: (data: {
    session_date?: string; notes?: string; schedule_id?: number; flexible_time?: string
  }) => api.post<Session>('/sessions/manual', data),
  detectFaces: (
    file: File, notes?: string, date?: string, scheduleId?: number, flexibleTime?: string,
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (notes) form.append('notes', notes)
    if (date) form.append('session_date', date)
    if (scheduleId) form.append('schedule_id', scheduleId.toString())
    if (flexibleTime) form.append('flexible_time', flexibleTime)
    return api.post<DetectResult>('/sessions/detect', form)
  },
  confirmSession: (tempId: string, attendance: ConfirmAttendanceItem[]) =>
    api.post<{ ok: boolean; session_id: number; attendance_count: number }>(
      '/sessions/confirm',
      { temp_id: tempId, attendance },
    ),
  studentSummary: (fromDate?: string, toDate?: string) =>
    api.get<StudentAttendanceSummary[]>('/sessions/student-summary', {
      params: { from_date: fromDate, to_date: toDate },
    }),
}

export const beltsApi = {
  history: (studentId: number) => api.get<BeltHistory[]>(`/students/${studentId}/belts`),
  promote: (studentId: number, data: { belt: Belt; degree: number; notes?: string; awarded_date?: string }) =>
    api.post<BeltHistory>(`/students/${studentId}/belts`, data),
  uploadCertificate: (studentId: number, beltId: number, file: File) => {
    const form = new FormData(); form.append('file', file)
    return api.post<BeltHistory>(`/students/${studentId}/belts/${beltId}/certificate`, form)
  },
  deleteCertificate: (studentId: number, beltId: number) =>
    api.delete<{ ok: boolean }>(`/students/${studentId}/belts/${beltId}/certificate`),
}

export const feesApi = {
  getPlans: (studentId: number) => api.get<FeePlan[]>(`/students/${studentId}/fee-plan`),
  createPlan: (studentId: number, data: { amount: number; due_day: number; payment_method?: string }) =>
    api.post<FeePlan>(`/students/${studentId}/fee-plan`, data),
  listPayments: (params?: { month?: string; status?: string }) => api.get<Payment[]>('/payments', { params }),
  studentPayments: (studentId: number) => api.get<Payment[]>(`/students/${studentId}/payments`),
  registerPayment: (data: {
    fee_plan_id: number; student_id: number; month_reference: string
    amount_paid: number; payment_date?: string
  }) => api.post<Payment>('/payments', data),
}

export const alunoApi = {
  dashboard: () => api.get<AlunoDashboard>('/aluno/dashboard'),
}

// ── Financeiro ────────────────────────────────────────────────────────────────

export interface MonthSummary {
  month: string; paid: number; pending: number; overdue: number
  paid_count: number; pending_count: number; overdue_count: number
}

export interface FinancialSummary {
  active_plans: number
  monthly_expected: number
  current_month: MonthSummary
  monthly_history: MonthSummary[]
}

export interface FinancialPayment {
  id: number; student_id: number; student_name: string
  month_reference: string; amount_paid?: number; plan_amount: number
  payment_date?: string; due_day?: number; status: FeeStatus
}

export const financeiroApi = {
  summary: () => api.get<FinancialSummary>('/financeiro/summary'),
  payments: (params?: { month?: string; status?: string }) =>
    api.get<FinancialPayment[]>('/financeiro/payments', { params }),
}
