import logging
import os
from contextlib import asynccontextmanager
from datetime import date
from dotenv import load_dotenv
load_dotenv()

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal
from app.models import Base, FeePayment, FeeStatus, Student, FeePlan, User, UserRole
from app.routers import auth, students, attendance, belts, fees, schools, users, aluno, schedules, dashboard, financeiro
from app.services.notification_service import notify_overdue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


def check_overdue_fees():
    db: Session = SessionLocal()
    try:
        today = date.today()
        current_month = today.strftime("%Y-%m")
        plans = db.query(FeePlan).filter(FeePlan.active == True).all()
        for plan in plans:
            student: Student = plan.student
            if not student.active:
                continue
            payment = db.query(FeePayment).filter(
                FeePayment.student_id == student.id,
                FeePayment.month_reference == current_month,
            ).first()
            if not payment:
                is_overdue = today.day > plan.due_day
                status = FeeStatus.overdue if is_overdue else FeeStatus.pending
                payment = FeePayment(
                    fee_plan_id=plan.id,
                    student_id=student.id,
                    month_reference=current_month,
                    status=status,
                )
                db.add(payment)
            elif payment.status == FeeStatus.pending and today.day > plan.due_day:
                payment.status = FeeStatus.overdue
            if payment.status == FeeStatus.overdue:
                u: User | None = student.user
                email = u.email if u else None
                notify_overdue(student.name, email, student.phone, current_month, plan.amount)
        db.commit()
    except Exception as e:
        logger.error("Erro no job de inadimplência: %s", e)
        db.rollback()
    finally:
        db.close()


def seed_root():
    """Create default root user if no users exist."""
    from app.auth import hash_password
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            root = User(
                name="Root",
                email="root@academia.com",
                password_hash=hash_password("root123"),
                role=UserRole.root,
                school_id=None,
            )
            db.add(root)
            db.commit()
            logger.info("Usuário root criado: root@academia.com / root123")
    finally:
        db.close()


scheduler = AsyncIOScheduler()


def run_migrations():
    """Adiciona colunas novas a tabelas existentes sem perder dados (SQLite safe)."""
    migrations = [
        "ALTER TABLE training_sessions ADD COLUMN schedule_id INTEGER REFERENCES class_schedules(id)",
        "ALTER TABLE training_sessions ADD COLUMN flexible_time VARCHAR(50)",
        "ALTER TABLE students ADD COLUMN email VARCHAR(150)",
        "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0",
        "ALTER TABLE schools ADD COLUMN pix_key VARCHAR(150)",
        "ALTER TABLE belt_history ADD COLUMN certificate_path VARCHAR(300)",
        "ALTER TABLE belt_history ADD COLUMN certificate_name VARCHAR(200)",
        "ALTER TABLE schools ADD COLUMN min_attendance_infantil INTEGER",
        "ALTER TABLE schools ADD COLUMN min_attendance_blue INTEGER",
        "ALTER TABLE schools ADD COLUMN min_attendance_purple INTEGER",
        "ALTER TABLE schools ADD COLUMN min_attendance_brown INTEGER",
        "ALTER TABLE schools ADD COLUMN min_attendance_black INTEGER",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Coluna já existe — ignora


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    seed_root()

    scheduler.add_job(check_overdue_fees, "cron", hour=8, minute=0)
    scheduler.start()
    logger.info("Scheduler iniciado")

    yield

    scheduler.shutdown()


app = FastAPI(
    title="Academia Jiu-Jitsu API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(schools.router)
app.include_router(users.router)
app.include_router(students.router)
app.include_router(attendance.router)
app.include_router(belts.router)
app.include_router(fees.router)
app.include_router(schedules.router)
app.include_router(aluno.router)
app.include_router(dashboard.router)
app.include_router(financeiro.router)


@app.get("/")
def health():
    return {"status": "ok", "service": "Academia Jiu-Jitsu API", "version": "2.0.0"}
