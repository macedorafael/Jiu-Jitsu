from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import School, User, UserRole
from app.schemas import SchoolCreate, SchoolUpdate, SchoolOut
from app.auth import require_root, require_admin_up, get_current_user

router = APIRouter(prefix="/api/schools", tags=["schools"])


@router.get("", response_model=list[SchoolOut])
def list_schools(db: Session = Depends(get_db), _: User = Depends(require_root)):
    return db.query(School).order_by(School.name).all()


@router.post("", response_model=SchoolOut)
def create_school(data: SchoolCreate, db: Session = Depends(get_db), _: User = Depends(require_root)):
    if db.query(School).filter(School.name == data.name).first():
        raise HTTPException(400, "Já existe uma escola com este nome")
    school = School(**data.model_dump())
    db.add(school)
    db.commit()
    db.refresh(school)
    return school


@router.get("/mine", response_model=SchoolOut)
def get_my_school(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_up),
):
    """Retorna a escola do usuário logado (para admin configurar sua academia)."""
    if current_user.role == UserRole.root:
        raise HTTPException(400, "Root não pertence a uma escola específica")
    school = db.get(School, current_user.school_id)
    if not school:
        raise HTTPException(404, "Escola não encontrada")
    return school


@router.get("/{school_id}", response_model=SchoolOut)
def get_school(
    school_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    school = db.get(School, school_id)
    if not school:
        raise HTTPException(404, "Escola não encontrada")
    # Root vê qualquer escola; admin vê apenas a própria
    if current_user.role != UserRole.root and current_user.school_id != school_id:
        raise HTTPException(403, "Acesso não autorizado")
    return school


@router.put("/{school_id}", response_model=SchoolOut)
def update_school(
    school_id: int,
    data: SchoolUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_up),
):
    school = db.get(School, school_id)
    if not school:
        raise HTTPException(404, "Escola não encontrada")
    # Admin só pode editar a própria escola; root edita qualquer uma
    if current_user.role != UserRole.root and current_user.school_id != school_id:
        raise HTTPException(403, "Acesso não autorizado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(school, field, value)
    db.commit()
    db.refresh(school)
    return school


@router.delete("/{school_id}", status_code=204)
def deactivate_school(school_id: int, db: Session = Depends(get_db), _: User = Depends(require_root)):
    school = db.get(School, school_id)
    if not school:
        raise HTTPException(404, "Escola não encontrada")
    school.active = False
    # Cascade: desativa todos os usuários da escola
    db.query(User).filter(User.school_id == school_id).update({"active": False})
    db.commit()


@router.post("/{school_id}/activate", response_model=SchoolOut)
def activate_school(school_id: int, db: Session = Depends(get_db), _: User = Depends(require_root)):
    school = db.get(School, school_id)
    if not school:
        raise HTTPException(404, "Escola não encontrada")
    school.active = True
    # Cascade: reativa todos os usuários da escola
    db.query(User).filter(User.school_id == school_id).update({"active": True})
    db.commit()
    db.refresh(school)
    return school
