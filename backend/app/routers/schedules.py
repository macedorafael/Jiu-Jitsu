from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClassSchedule, User, UserRole
from app.schemas import ClassScheduleCreate, ClassScheduleOut
from app.auth import require_admin_geral, require_professor_up

router = APIRouter(prefix="/api/schedules", tags=["schedules"])

DAYS_PT = {
    0: "Segunda-feira",
    1: "Terça-feira",
    2: "Quarta-feira",
    3: "Quinta-feira",
    4: "Sexta-feira",
    5: "Sábado",
    6: "Domingo",
}


@router.get("", response_model=list[ClassScheduleOut])
def list_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """Lista os horários ativos da escola do usuário logado."""
    q = db.query(ClassSchedule).filter(ClassSchedule.active == True)
    if current_user.school_id is not None:
        q = q.filter(ClassSchedule.school_id == current_user.school_id)
    return q.order_by(ClassSchedule.day_of_week, ClassSchedule.start_time).all()


@router.post("", response_model=ClassScheduleOut)
def create_schedule(
    data: ClassScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_geral),
):
    """Cria um novo horário de aula."""
    # Verifica duplicidade: mesmo dia + horário de início na mesma escola
    existing = db.query(ClassSchedule).filter(
        ClassSchedule.school_id == current_user.school_id,
        ClassSchedule.day_of_week == data.day_of_week,
        ClassSchedule.start_time == data.start_time,
        ClassSchedule.active == True,
    ).first()
    if existing:
        raise HTTPException(400, f"Já existe um horário para {DAYS_PT[data.day_of_week]} às {data.start_time}")

    schedule = ClassSchedule(
        **data.model_dump(),
        school_id=current_user.school_id,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.put("/{schedule_id}", response_model=ClassScheduleOut)
def update_schedule(
    schedule_id: int,
    data: ClassScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_geral),
):
    """Atualiza um horário de aula."""
    schedule = db.get(ClassSchedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Horário não encontrado")
    if current_user.role != UserRole.root and schedule.school_id != current_user.school_id:
        raise HTTPException(403, "Acesso não autorizado")

    for field, value in data.model_dump().items():
        setattr(schedule, field, value)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_geral),
):
    """Desativa um horário de aula."""
    schedule = db.get(ClassSchedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Horário não encontrado")
    if current_user.role != UserRole.root and schedule.school_id != current_user.school_id:
        raise HTTPException(403, "Acesso não autorizado")

    schedule.active = False
    db.commit()
