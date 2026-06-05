from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Date, ForeignKey, Text, Enum as SAEnum, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


# Re-export para conveniência
__all__ = ["UserRole", "StudentProfile", "Belt", "FeeStatus",
           "School", "User", "Student", "ClassSchedule",
           "TrainingSession", "Attendance", "UnidentifiedFace",
           "StudentStatusHistory", "BeltHistory", "FeePlan", "FeePayment"]


class UserRole(str, enum.Enum):
    root = "root"
    admin = "admin"
    admin_especifico = "admin_especifico"
    professor = "professor"
    aluno = "aluno"


class StudentProfile(str, enum.Enum):
    adulto = "adulto"
    infantil = "infantil"


class Belt(str, enum.Enum):
    # Faixas compartilhadas
    white = "white"
    # Faixas infantis
    grey_white = "grey_white"
    grey = "grey"
    grey_black = "grey_black"
    yellow_white = "yellow_white"
    yellow = "yellow"
    yellow_black = "yellow_black"
    orange_white = "orange_white"
    orange = "orange"
    orange_black = "orange_black"
    green_white = "green_white"
    green = "green"
    green_black = "green_black"
    # Faixas adultas
    blue = "blue"
    purple = "purple"
    brown = "brown"
    black = "black"


class FeeStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    overdue = "overdue"


class School(Base):
    __tablename__ = "schools"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pix_key: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    # Requisitos mínimos de presença por categoria de faixa
    min_attendance_infantil: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    min_attendance_blue: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    min_attendance_purple: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    min_attendance_brown: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    min_attendance_black: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    users: Mapped[list["User"]] = relationship("User", back_populates="school")
    students: Mapped[list["Student"]] = relationship("Student", back_populates="school")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.aluno)
    profile_access: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "adulto"|"infantil" para admin_especifico
    school_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schools.id"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    school: Mapped[Optional["School"]] = relationship("School", back_populates="users")
    student: Mapped[Optional["Student"]] = relationship("Student", back_populates="user", uselist=False)
    sessions: Mapped[list["TrainingSession"]] = relationship("TrainingSession", back_populates="professor")
    belt_promotions: Mapped[list["BeltHistory"]] = relationship("BeltHistory", back_populates="professor")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    school_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schools.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    profile: Mapped[StudentProfile] = mapped_column(SAEnum(StudentProfile), default=StudentProfile.adulto)
    belt: Mapped[Belt] = mapped_column(SAEnum(Belt), default=Belt.white)
    degree: Mapped[int] = mapped_column(Integer, default=0)
    enrollment_date: Mapped[date] = mapped_column(Date, default=date.today)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    photo_path: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    face_encoding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    user: Mapped[Optional[User]] = relationship("User", back_populates="student")
    school: Mapped[Optional[School]] = relationship("School", back_populates="students")
    attendance: Mapped[list["Attendance"]] = relationship("Attendance", back_populates="student")
    belt_history: Mapped[list["BeltHistory"]] = relationship("BeltHistory", back_populates="student")
    status_history: Mapped[list["StudentStatusHistory"]] = relationship("StudentStatusHistory", back_populates="student", order_by="StudentStatusHistory.created_at.desc()")
    fee_plans: Mapped[list["FeePlan"]] = relationship("FeePlan", back_populates="student")
    fee_payments: Mapped[list["FeePayment"]] = relationship("FeePayment", back_populates="student")
    identified_faces: Mapped[list["UnidentifiedFace"]] = relationship(
        "UnidentifiedFace", back_populates="identified_as",
        foreign_keys="UnidentifiedFace.identified_as_student_id"
    )


class ClassSchedule(Base):
    """Horários fixos de aula da academia (ex: Segunda 20:00-21:30)."""
    __tablename__ = "class_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schools.id"), nullable=True)
    day_of_week: Mapped[int] = mapped_column(Integer)   # 0=Segunda … 6=Domingo
    start_time: Mapped[str] = mapped_column(String(5))   # "HH:MM"
    end_time: Mapped[str] = mapped_column(String(5))     # "HH:MM"
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    school: Mapped[Optional["School"]] = relationship("School")


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    school_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schools.id"), nullable=True)
    schedule_id: Mapped[Optional[int]] = mapped_column(ForeignKey("class_schedules.id"), nullable=True)
    flexible_time: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    date: Mapped[date] = mapped_column(Date, default=date.today)
    training_photo_path: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    professor: Mapped[User] = relationship("User", back_populates="sessions")
    schedule: Mapped[Optional["ClassSchedule"]] = relationship("ClassSchedule")
    attendance: Mapped[list["Attendance"]] = relationship("Attendance", back_populates="session")
    unidentified_faces: Mapped[list["UnidentifiedFace"]] = relationship("UnidentifiedFace", back_populates="session")


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("training_sessions.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    session: Mapped[TrainingSession] = relationship("TrainingSession", back_populates="attendance")
    student: Mapped[Student] = relationship("Student", back_populates="attendance")


class UnidentifiedFace(Base):
    __tablename__ = "unidentified_faces"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("training_sessions.id"))
    face_image_path: Mapped[str] = mapped_column(String(300))
    identified_as_student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    session: Mapped[TrainingSession] = relationship("TrainingSession", back_populates="unidentified_faces")
    identified_as: Mapped[Optional[Student]] = relationship(
        "Student", back_populates="identified_faces",
        foreign_keys=[identified_as_student_id]
    )


class StudentStatusHistory(Base):
    """Histórico de mudanças de status do aluno (ativo/pausado)."""
    __tablename__ = "student_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    changed_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    new_status: Mapped[str] = mapped_column(String(20))   # "ativo" | "pausado"
    observation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    student: Mapped["Student"] = relationship("Student", back_populates="status_history")
    changed_by: Mapped["User"] = relationship("User")


class BeltHistory(Base):
    __tablename__ = "belt_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    belt: Mapped[Belt] = mapped_column(SAEnum(Belt))
    degree: Mapped[int] = mapped_column(Integer)
    awarded_date: Mapped[date] = mapped_column(Date, default=date.today)
    professor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    certificate_path: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    certificate_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    student: Mapped[Student] = relationship("Student", back_populates="belt_history")
    professor: Mapped[User] = relationship("User", back_populates="belt_promotions")


class FeePlan(Base):
    __tablename__ = "fee_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    amount: Mapped[float] = mapped_column(Float)
    due_day: Mapped[int] = mapped_column(Integer)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    student: Mapped[Student] = relationship("Student", back_populates="fee_plans")
    payments: Mapped[list["FeePayment"]] = relationship("FeePayment", back_populates="fee_plan")


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    fee_plan_id: Mapped[int] = mapped_column(ForeignKey("fee_plans.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    month_reference: Mapped[str] = mapped_column(String(7))
    amount_paid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[FeeStatus] = mapped_column(SAEnum(FeeStatus), default=FeeStatus.pending)

    fee_plan: Mapped[FeePlan] = relationship("FeePlan", back_populates="payments")
    student: Mapped[Student] = relationship("Student", back_populates="fee_payments")
