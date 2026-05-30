from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Student, FeePlan, FeePayment, FeeStatus, User
from app.schemas import FeePlanCreate, FeePlanOut, PaymentCreate, PaymentOut
from app.auth import require_admin_up, require_professor_up

router = APIRouter(prefix="/api", tags=["fees"])


# ── Fee Plans ─────────────────────────────────────────────────────────────────

@router.get("/students/{student_id}/fee-plan", response_model=list[FeePlanOut])
def get_fee_plans(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_up),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    return db.query(FeePlan).filter(FeePlan.student_id == student_id, FeePlan.active == True).all()


@router.post("/students/{student_id}/fee-plan", response_model=FeePlanOut)
def create_fee_plan(
    student_id: int,
    data: FeePlanCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_up),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")

    # Deactivate previous active plans
    db.query(FeePlan).filter(FeePlan.student_id == student_id, FeePlan.active == True).update({"active": False})

    plan = FeePlan(student_id=student_id, **data.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.put("/students/{student_id}/fee-plan/{fee_id}", response_model=FeePlanOut)
def update_fee_plan(
    student_id: int,
    fee_id: int,
    data: FeePlanCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_up),
):
    plan = db.query(FeePlan).filter(FeePlan.id == fee_id, FeePlan.student_id == student_id).first()
    if not plan:
        raise HTTPException(404, "Plano de mensalidade não encontrado")
    for field, value in data.model_dump().items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan


# ── Payments ──────────────────────────────────────────────────────────────────

@router.get("/payments", response_model=list[PaymentOut])
def list_payments(
    month: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_up),
):
    q = db.query(FeePayment)
    if month:
        q = q.filter(FeePayment.month_reference == month)
    if status:
        q = q.filter(FeePayment.status == status)
    return q.order_by(FeePayment.month_reference.desc()).all()


@router.get("/students/{student_id}/payments", response_model=list[PaymentOut])
def student_payments(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_up),
):
    return (
        db.query(FeePayment)
        .filter(FeePayment.student_id == student_id)
        .order_by(FeePayment.month_reference.desc())
        .all()
    )


@router.post("/payments", response_model=PaymentOut)
def register_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_up),
):
    plan = db.get(FeePlan, data.fee_plan_id)
    if not plan:
        raise HTTPException(404, "Plano não encontrado")

    # Se já existe registro (criado pelo job de inadimplência), atualiza para pago
    existing = db.query(FeePayment).filter(
        FeePayment.student_id == data.student_id,
        FeePayment.month_reference == data.month_reference,
    ).first()

    if existing:
        existing.fee_plan_id  = data.fee_plan_id
        existing.amount_paid  = data.amount_paid
        existing.payment_date = data.payment_date or date.today()
        existing.status       = FeeStatus.paid
        db.commit()
        db.refresh(existing)
        return existing

    payment = FeePayment(
        fee_plan_id=data.fee_plan_id,
        student_id=data.student_id,
        month_reference=data.month_reference,
        amount_paid=data.amount_paid,
        payment_date=data.payment_date or date.today(),
        status=FeeStatus.paid,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
