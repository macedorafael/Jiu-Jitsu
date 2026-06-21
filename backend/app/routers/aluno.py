from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.models import User, FeePayment, UserRole
from app.schemas import AlunoDashboard, StudentOut, BeltHistoryOut
from app.auth import get_current_user
from app.services.pix_service import build_pix_payload, generate_qr_base64

router = APIRouter(prefix="/api/aluno", tags=["aluno"])


@router.get("/dashboard", response_model=AlunoDashboard)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dashboard do aluno: presenças, histórico de faixas, mensalidade e QR Pix."""
    if current_user.role != UserRole.aluno:
        raise HTTPException(403, "Apenas alunos têm acesso ao dashboard")

    student = current_user.student
    if not student:
        raise HTTPException(404, "Perfil de aluno não encontrado. Contate o administrador.")

    # ── Presenças ────────────────────────────────────────────────────────────
    attendance = [
        {
            "session_id": a.session_id,
            "date": a.session.date.isoformat(),
            "notes": a.session.notes,
        }
        for a in sorted(student.attendance, key=lambda x: x.session.date, reverse=True)
    ]

    # ── Histórico de faixas ──────────────────────────────────────────────────
    belt_history = sorted(student.belt_history, key=lambda x: x.awarded_date, reverse=True)

    # ── Mensalidade ──────────────────────────────────────────────────────────
    today = date.today()
    current_month = today.strftime("%Y-%m")
    active_plan = next((p for p in student.fee_plans if p.active), None)

    fee_status: str | None = None
    fee_amount: float | None = None
    fee_month: str | None = None
    pix_key: str | None = None
    pix_qrcode_base64: str | None = None
    pix_copia_cola: str | None = None

    if not active_plan:
        fee_status = "no_plan"
    else:
        fee_amount = active_plan.amount
        fee_month = current_month

        # Busca por student_id + month_reference para tolerar troca de plano (novo fee_plan_id)
        payment = db.query(FeePayment).filter(
            FeePayment.student_id == student.id,
            FeePayment.month_reference == current_month,
        ).first()

        if payment:
            fee_status = payment.status.value
        else:
            fee_status = "overdue" if today.day > active_plan.due_day else "pending"

    # ── Pix — SEMPRE gerado quando a escola tem chave Pix configurada ─────────
    # Exibido independentemente do status de pagamento para facilitar futuros pagamentos
    school = student.school
    if school and school.pix_key and fee_amount is not None:
        pix_key = school.pix_key
        try:
            pix_copia_cola = build_pix_payload(
                key=pix_key,
                name=school.name,
                city="Brasil",
                amount=fee_amount,
                description="Mensalidade",
            )
            pix_qrcode_base64 = generate_qr_base64(pix_copia_cola)
        except Exception:
            pass

    # ── Progresso de faixa ───────────────────────────────────────────────────
    from app.routers.students import _get_target_attendance, _get_min_age_for_promotion, _calc_age

    _ADULT_NEXT = {
        'white': 'blue',
        'green_white': 'green', 'green': 'green_black', 'green_black': 'blue',
        'blue': 'purple', 'purple': 'brown', 'brown': 'black',
    }
    _INFANTIL_NEXT = {
        'white': 'grey_white', 'grey_white': 'grey', 'grey': 'grey_black', 'grey_black': 'yellow_white',
        'yellow_white': 'yellow', 'yellow': 'yellow_black', 'yellow_black': 'orange_white',
        'orange_white': 'orange', 'orange': 'orange_black', 'orange_black': 'green_white',
        'green_white': 'green', 'green': 'green_black', 'green_black': 'blue',
    }

    history_sorted = sorted(student.belt_history, key=lambda x: x.awarded_date)
    since_date = student.enrollment_date
    if history_sorted:
        last_diff_idx = -1
        for i, h in enumerate(history_sorted):
            if h.belt != student.belt:
                last_diff_idx = i
        if last_diff_idx >= 0:
            start_idx = last_diff_idx + 1
            if start_idx < len(history_sorted):
                since_date = history_sorted[start_idx].awarded_date
    att_since_count = sum(1 for a in student.attendance if a.session.date >= since_date)

    belt_val = str(student.belt.value)
    profile_val = str(student.profile.value)
    belt_target = _get_target_attendance(school, student) if school else None
    belt_next = _ADULT_NEXT.get(belt_val) if profile_val == 'adulto' else _INFANTIL_NEXT.get(belt_val)
    student_age = _calc_age(student.birth_date)
    min_age = _get_min_age_for_promotion(student)

    return AlunoDashboard(
        student=StudentOut.model_validate(student),
        attendance=attendance,
        belt_history=[BeltHistoryOut.model_validate(b) for b in belt_history],
        fee_status=fee_status,
        fee_amount=fee_amount,
        fee_month=fee_month,
        pix_key=pix_key,
        pix_qrcode_base64=pix_qrcode_base64,
        pix_copia_cola=pix_copia_cola,
        belt_progress_count=att_since_count,
        belt_progress_target=belt_target,
        belt_progress_since=since_date.isoformat(),
        belt_next=belt_next,
        student_age=student_age,
        min_age_for_promotion=min_age,
    )
