"""
Router financeiro: resumo e listagem de pagamentos para admin/root.
"""
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from typing import Optional
from app.models import Student, FeePlan, FeePayment, User, UserRole, StudentProfile
from app.auth import require_admin_up

router = APIRouter(prefix="/api/financeiro", tags=["financeiro"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _student_ids(db: Session, current_user: User, profile: Optional[str] = None) -> list[int]:
    """IDs dos alunos visíveis para o usuário (escola ou todos para root), com filtro de perfil."""
    q = db.query(Student.id).filter(Student.active == True)
    if current_user.school_id is not None:
        q = q.filter(Student.school_id == current_user.school_id)
    # admin_especifico: sempre restrito ao seu perfil de acesso
    effective_profile = profile
    if current_user.role == UserRole.admin_especifico and current_user.profile_access:
        effective_profile = current_user.profile_access
    if effective_profile:
        q = q.filter(Student.profile == effective_profile)
    return [sid for (sid,) in q.all()]


def _month_str(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _last_n_months(n: int) -> list[str]:
    """Retorna lista de YYYY-MM dos últimos N meses (mais antigo → mais recente)."""
    today = date.today()
    months = []
    for i in range(n - 1, -1, -1):
        month = today.month - i
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        months.append(_month_str(year, month))
    return months


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/summary")
def get_summary(
    profile: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_up),
):
    """Retorna resumo financeiro: planos ativos, histórico 6 meses, status mês atual."""
    student_ids = _student_ids(db, current_user, profile)

    empty_month = {
        "month": date.today().strftime("%Y-%m"),
        "paid": 0.0, "pending": 0.0, "overdue": 0.0,
        "paid_count": 0, "pending_count": 0, "overdue_count": 0,
    }
    if not student_ids:
        return {
            "active_plans": 0, "monthly_expected": 0.0,
            "current_month": empty_month, "monthly_history": [],
        }

    # Planos ativos
    active_plans = (
        db.query(FeePlan)
        .filter(FeePlan.active == True, FeePlan.student_id.in_(student_ids))
        .all()
    )
    plan_amounts: dict[int, float] = {p.id: p.amount for p in active_plans}
    monthly_expected = round(sum(plan_amounts.values()), 2)

    months = _last_n_months(6)
    monthly_history = []

    for month_str in months:
        payments = (
            db.query(FeePayment)
            .filter(
                FeePayment.student_id.in_(student_ids),
                FeePayment.month_reference == month_str,
            )
            .all()
        )

        paid       = round(sum(p.amount_paid or 0 for p in payments if p.status.value == "paid"), 2)
        paid_count = sum(1 for p in payments if p.status.value == "paid")

        pending_plan_ids = [p.fee_plan_id for p in payments if p.status.value == "pending"]
        overdue_plan_ids = [p.fee_plan_id for p in payments if p.status.value == "overdue"]

        pending = round(sum(plan_amounts.get(pid, 0) for pid in pending_plan_ids), 2)
        overdue = round(sum(plan_amounts.get(pid, 0) for pid in overdue_plan_ids), 2)

        monthly_history.append({
            "month": month_str,
            "paid": paid, "pending": pending, "overdue": overdue,
            "paid_count": paid_count,
            "pending_count": len(pending_plan_ids),
            "overdue_count": len(overdue_plan_ids),
        })

    return {
        "active_plans": len(active_plans),
        "monthly_expected": monthly_expected,
        "current_month": monthly_history[-1],
        "monthly_history": monthly_history,
    }


@router.get("/payments")
def list_payments(
    month: str = "",
    status: str = "",
    profile: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_up),
):
    """Lista pagamentos com filtros de mês, status e perfil de aluno."""
    student_ids = _student_ids(db, current_user, profile)
    if not student_ids:
        return []

    q = db.query(FeePayment).filter(FeePayment.student_id.in_(student_ids))
    if month:
        q = q.filter(FeePayment.month_reference == month)
    if status:
        q = q.filter(FeePayment.status == status)

    payments = q.order_by(FeePayment.month_reference.desc()).all()

    students_map = {
        s.id: s
        for s in db.query(Student).filter(Student.id.in_(student_ids)).all()
    }
    plans_map = {p.id: p for p in db.query(FeePlan).all()}

    result = []
    for p in payments:
        student = students_map.get(p.student_id)
        plan    = plans_map.get(p.fee_plan_id)
        result.append({
            "id":              p.id,
            "student_id":      p.student_id,
            "student_name":    student.name if student else "?",
            "month_reference": p.month_reference,
            "amount_paid":     p.amount_paid,
            "plan_amount":     plan.amount if plan else 0.0,
            "payment_date":    p.payment_date.isoformat() if p.payment_date else None,
            "due_day":         plan.due_day if plan else None,
            "status":          p.status.value,
        })

    return result
