from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

from app.models import UserRole, Belt, FeeStatus


# ── Auth ──────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Schools ───────────────────────────────────────────────────────────────────

class SchoolCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    pix_key: Optional[str] = None


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    pix_key: Optional[str] = None
    active: Optional[bool] = None


class SchoolOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    pix_key: Optional[str]
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Users ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.aluno
    school_id: Optional[int] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    school_id: Optional[int] = None
    active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    school_id: Optional[int]
    school_name: Optional[str] = None
    active: bool
    must_change_password: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            school_id=user.school_id,
            school_name=user.school.name if user.school else None,
            active=user.active,
            must_change_password=user.must_change_password,
            created_at=user.created_at,
        )


# ── Students ──────────────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    name: str
    email: str
    belt: Belt = Belt.white
    degree: int = 0
    enrollment_date: Optional[date] = None
    birth_date: Optional[date] = None
    phone: Optional[str] = None

    @field_validator("degree")
    @classmethod
    def degree_range(cls, v: int) -> int:
        if not 0 <= v <= 4:
            raise ValueError("Grau deve ser entre 0 e 4")
        return v


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    belt: Optional[Belt] = None
    degree: Optional[int] = None
    enrollment_date: Optional[date] = None
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    active: Optional[bool] = None


class StudentOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    belt: Belt
    degree: int
    enrollment_date: date
    birth_date: Optional[date]
    phone: Optional[str]
    photo_path: Optional[str]
    active: bool
    created_at: datetime
    school_id: Optional[int] = None
    user_id: Optional[int] = None

    model_config = {"from_attributes": True}


class StudentDetail(StudentOut):
    belt_history: list["BeltHistoryOut"] = []
    attendance_count: int = 0


# ── Student Status ────────────────────────────────────────────────────────────

class StudentStatusChange(BaseModel):
    status: str            # "ativo" | "pausado"
    observation: Optional[str] = None


class StudentStatusHistoryOut(BaseModel):
    id: int
    new_status: str
    observation: Optional[str]
    changed_by_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Belt History ──────────────────────────────────────────────────────────────

class BeltPromote(BaseModel):
    belt: Belt
    degree: int
    awarded_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("degree")
    @classmethod
    def degree_range(cls, v: int) -> int:
        if not 0 <= v <= 4:
            raise ValueError("Grau deve ser entre 0 e 4")
        return v


class BeltHistoryOut(BaseModel):
    id: int
    belt: Belt
    degree: int
    awarded_date: date
    notes: Optional[str]
    professor_id: int
    certificate_path: Optional[str] = None
    certificate_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Class Schedules ──────────────────────────────────────────────────────────

class ClassScheduleCreate(BaseModel):
    day_of_week: int   # 0=Segunda … 6=Domingo
    start_time: str    # "HH:MM"
    end_time: str      # "HH:MM"

    @field_validator("day_of_week")
    @classmethod
    def day_range(cls, v: int) -> int:
        if not 0 <= v <= 6:
            raise ValueError("Dia da semana deve ser entre 0 (segunda) e 6 (domingo)")
        return v

    @field_validator("start_time", "end_time")
    @classmethod
    def time_format(cls, v: str) -> str:
        import re
        if not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError("Horário deve estar no formato HH:MM")
        return v


class ClassScheduleOut(BaseModel):
    id: int
    school_id: Optional[int]
    day_of_week: int
    start_time: str
    end_time: str
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Training Sessions ─────────────────────────────────────────────────────────

class AttendanceOut(BaseModel):
    student_id: int
    student_name: str
    confidence_score: Optional[float]
    photo_path: Optional[str] = None   # foto de referência do aluno

    model_config = {"from_attributes": True}


class ChangeAttendanceRequest(BaseModel):
    from_student_id: int   # presença atual a remover
    to_student_id: int     # novo aluno a associar


class UnidentifiedFaceOut(BaseModel):
    id: int
    face_image_path: str

    model_config = {"from_attributes": True}


class SessionResult(BaseModel):
    session_id: int
    date: date
    recognized: list[AttendanceOut]
    unidentified: list[UnidentifiedFaceOut]
    faces_detected: int = 0   # total de rostos detectados na foto


class IdentifyFaceRequest(BaseModel):
    face_id: int
    student_id: int


class RemoveAttendanceRequest(BaseModel):
    student_id: int


class SessionOut(BaseModel):
    id: int
    professor_id: int
    professor_name: Optional[str] = None
    date: date
    notes: Optional[str]
    schedule_id: Optional[int] = None
    schedule_info: Optional[str] = None     # "Segunda 20:00–21:30"
    flexible_time: Optional[str] = None
    training_photo_path: Optional[str] = None
    created_at: datetime
    attendance_count: int = 0

    model_config = {"from_attributes": True}


class ManualSessionCreate(BaseModel):
    session_date: Optional[str] = None     # ISO "YYYY-MM-DD"
    notes: Optional[str] = None
    schedule_id: Optional[int] = None
    flexible_time: Optional[str] = None


class ManualAttendanceAdd(BaseModel):
    student_id: int


# ── Detect / Confirm (two-phase attendance) ───────────────────────────────────

class TempRecognizedOut(BaseModel):
    student_id: int
    student_name: str
    confidence_score: Optional[float] = None
    photo_path: Optional[str] = None
    face_image_path: Optional[str] = None   # recorte do rosto detectado


class TempUnidentifiedOut(BaseModel):
    temp_face_id: str                        # UUID local para rastreamento
    face_image_path: str


class DetectResult(BaseModel):
    temp_id: str
    recognized: list[TempRecognizedOut]
    unidentified: list[TempUnidentifiedOut]
    faces_detected: int


class ConfirmAttendanceItem(BaseModel):
    student_id: int
    confidence_score: Optional[float] = None
    face_image_path: Optional[str] = None   # recorte a salvar como foto de perfil


class ConfirmSessionCreate(BaseModel):
    temp_id: str
    attendance: list[ConfirmAttendanceItem]


# ── Fees ──────────────────────────────────────────────────────────────────────

class FeePlanCreate(BaseModel):
    amount: float
    due_day: int
    payment_method: Optional[str] = None

    @field_validator("due_day")
    @classmethod
    def due_day_range(cls, v: int) -> int:
        if not 1 <= v <= 31:
            raise ValueError("Dia de vencimento deve ser entre 1 e 31")
        return v


class FeePlanOut(BaseModel):
    id: int
    student_id: int
    amount: float
    due_day: int
    payment_method: Optional[str]
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    fee_plan_id: int
    student_id: int
    month_reference: str
    amount_paid: float
    payment_date: Optional[date] = None


class PaymentOut(BaseModel):
    id: int
    fee_plan_id: int
    student_id: int
    month_reference: str
    amount_paid: Optional[float]
    payment_date: Optional[date]
    status: FeeStatus

    model_config = {"from_attributes": True}


# ── Aluno Dashboard ───────────────────────────────────────────────────────────

class AlunoDashboard(BaseModel):
    student: StudentOut
    attendance: list[dict]
    belt_history: list[BeltHistoryOut]
    fee_status: Optional[str]       # paid / pending / overdue / no_plan
    fee_amount: Optional[float]
    fee_month: Optional[str]
    pix_key: Optional[str]
    pix_qrcode_base64: Optional[str]
    pix_copia_cola: Optional[str]
