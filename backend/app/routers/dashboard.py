from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    Student, TrainingSession, Attendance, BeltHistory,
    FeePayment, FeeStatus, User, UserRole, Belt, StudentProfile
)
from app.auth import require_professor_up

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_DAYS_PT = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

BELT_ORDER = [
    Belt.white,
    Belt.grey_white, Belt.grey, Belt.grey_black,
    Belt.yellow_white, Belt.yellow, Belt.yellow_black,
    Belt.orange_white, Belt.orange, Belt.orange_black,
    Belt.green_white, Belt.green, Belt.green_black,
    Belt.blue, Belt.purple, Belt.brown, Belt.black,
]


@router.get("")
def get_dashboard(
    profile: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    school_id = current_user.school_id if current_user.role != UserRole.root else None
    today = date.today()

    # ── Base queries ──────────────────────────────────────────────────────────
    sq = db.query(Student).filter(Student.active == True)
    sessq = db.query(TrainingSession)
    if school_id:
        sq = sq.filter(Student.school_id == school_id)
        sessq = sessq.filter(TrainingSession.school_id == school_id)

    # Filtro por perfil (admin_especifico e professor com profile_access sempre filtrados)
    effective_profile = profile
    if current_user.profile_access and current_user.role in (UserRole.admin_especifico, UserRole.professor):
        effective_profile = current_user.profile_access
    if effective_profile:
        sq = sq.filter(Student.profile == effective_profile)

    students = sq.all()

    # ── Stats de alunos ───────────────────────────────────────────────────────
    total_students = len(students)
    with_photo = sum(1 for s in students if s.photo_path)

    # ── Sessões ───────────────────────────────────────────────────────────────
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=today.weekday())

    sessions_month = sessq.filter(TrainingSession.date >= month_start).all()
    sessions_week_count = sessq.filter(TrainingSession.date >= week_start).count()
    total_sessions = sessq.count()

    # Presenças do mês — filtra por perfil se necessário
    att_month = 0
    for s in sessions_month:
        if effective_profile:
            att_month += sum(
                1 for a in s.attendance
                if a.student and str(a.student.profile.value) == effective_profile
            )
        else:
            att_month += len(s.attendance)

    avg_att = round(att_month / len(sessions_month), 1) if sessions_month else 0

    # Última sessão
    last_session = sessq.order_by(TrainingSession.date.desc()).first()

    # ── Distribuição de faixas ────────────────────────────────────────────────
    belt_dist = {}
    for b in BELT_ORDER:
        count = sum(1 for s in students if s.belt == b)
        if count > 0:
            belt_dist[b.value] = count

    # ── Atividade mensal (últimos 6 meses) ────────────────────────────────────
    monthly = []
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        m_start = date(y, m, 1)
        m_end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
        sess_list = sessq.filter(
            TrainingSession.date >= m_start,
            TrainingSession.date < m_end,
        ).all()
        att_total = sum(len(s.attendance) for s in sess_list)
        monthly.append({
            "month": f"{y}-{m:02d}",
            "sessions": len(sess_list),
            "attendances": att_total,
        })

    # ── Sessões recentes (últimas 5) ──────────────────────────────────────────
    recent_sessions = sessq.order_by(TrainingSession.date.desc()).limit(5).all()
    recent_out = []
    for s in recent_sessions:
        schedule_info = None
        if s.schedule:
            day = _DAYS_PT[s.schedule.day_of_week]
            schedule_info = f"{day} {s.schedule.start_time}–{s.schedule.end_time}"
        recent_out.append({
            "id": s.id,
            "date": s.date.isoformat(),
            "schedule_info": schedule_info or s.flexible_time or "Horário livre",
            "professor_name": s.professor.name if s.professor else None,
            "attendance_count": len(s.attendance),
        })

    # ── Promoções recentes (últimas 4) ────────────────────────────────────────
    belt_q = db.query(BeltHistory).join(Student).filter(Student.active == True)
    if school_id:
        belt_q = belt_q.filter(Student.school_id == school_id)
    if effective_profile:
        belt_q = belt_q.filter(Student.profile == effective_profile)
    recent_belts = belt_q.order_by(BeltHistory.awarded_date.desc()).limit(4).all()
    recent_belts_out = [
        {
            "student_name": b.student.name,
            "belt": b.belt.value,
            "degree": b.degree,
            "awarded_date": b.awarded_date.isoformat(),
        }
        for b in recent_belts
    ]

    # ── Financeiro (admin/root) ───────────────────────────────────────────────
    overdue_count = 0
    pending_count = 0
    if current_user.role in [UserRole.admin, UserRole.root, UserRole.admin_especifico]:
        fp_q = db.query(FeePayment)
        if school_id:
            fp_q = fp_q.join(Student).filter(Student.school_id == school_id)
        overdue_count = fp_q.filter(FeePayment.status == FeeStatus.overdue).count()
        pending_count = fp_q.filter(FeePayment.status == FeeStatus.pending).count()

    return {
        # Alunos
        "total_students": total_students,
        "students_with_photo": with_photo,
        "students_without_photo": total_students - with_photo,
        # Sessões
        "total_sessions": total_sessions,
        "sessions_this_month": len(sessions_month),
        "sessions_this_week": sessions_week_count,
        "attendances_this_month": att_month,
        "avg_attendance_per_session": avg_att,
        "last_session_date": last_session.date.isoformat() if last_session else None,
        "last_session_count": len(last_session.attendance) if last_session else 0,
        # Faixas
        "belt_distribution": belt_dist,
        # Atividade mensal
        "monthly_activity": monthly,
        # Recentes
        "recent_sessions": recent_out,
        "recent_belt_promotions": recent_belts_out,
        # Financeiro
        "overdue_count": overdue_count,
        "pending_count": pending_count,
    }
