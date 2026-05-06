import os
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Student, BeltHistory, User, UserRole
from app.schemas import BeltPromote, BeltHistoryOut
from app.auth import require_professor_up

router = APIRouter(prefix="/api/students", tags=["belts"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
ALLOWED_CERT_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}


def _check_school_access(student: Student, current_user: User):
    if current_user.role == UserRole.root:
        return
    if student.school_id != current_user.school_id:
        raise HTTPException(403, "Acesso não autorizado")


@router.get("/{student_id}/belts", response_model=list[BeltHistoryOut])
def get_belt_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)
    return sorted(student.belt_history, key=lambda h: h.awarded_date, reverse=True)


@router.post("/{student_id}/belts", response_model=BeltHistoryOut)
def promote_belt(
    student_id: int,
    data: BeltPromote,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)

    awarded = data.awarded_date or date.today()

    history = BeltHistory(
        student_id=student_id,
        belt=data.belt,
        degree=data.degree,
        awarded_date=awarded,
        professor_id=current_user.id,
        notes=data.notes,
    )
    db.add(history)

    # Atualiza faixa/grau atual do aluno
    student.belt = data.belt
    student.degree = data.degree
    db.commit()
    db.refresh(history)
    return history


@router.post("/{student_id}/belts/{belt_id}/certificate", response_model=BeltHistoryOut)
async def upload_certificate(
    student_id: int,
    belt_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """Faz upload (ou substitui) o certificado de uma promoção de faixa."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)

    history = db.get(BeltHistory, belt_id)
    if not history or history.student_id != student_id:
        raise HTTPException(404, "Promoção não encontrada")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_CERT_EXTS:
        raise HTTPException(400, "Formato inválido. Use PDF, JPG, PNG ou WEBP.")

    # Remove arquivo anterior se existir
    if history.certificate_path and os.path.exists(history.certificate_path):
        try:
            os.remove(history.certificate_path)
        except Exception:
            pass

    # Salva novo arquivo
    cert_dir = os.path.join(UPLOAD_DIR, "certificates")
    os.makedirs(cert_dir, exist_ok=True)
    filename = f"cert_{student_id}_{belt_id}_{uuid.uuid4()}{ext}"
    path = os.path.join(cert_dir, filename)

    contents = await file.read()
    with open(path, "wb") as f:
        f.write(contents)

    history.certificate_path = path
    history.certificate_name = file.filename or filename
    db.commit()
    db.refresh(history)
    return history


@router.delete("/{student_id}/belts/{belt_id}/certificate")
def delete_certificate(
    student_id: int,
    belt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """Remove o certificado de uma promoção de faixa."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)

    history = db.get(BeltHistory, belt_id)
    if not history or history.student_id != student_id:
        raise HTTPException(404, "Promoção não encontrada")

    if history.certificate_path and os.path.exists(history.certificate_path):
        try:
            os.remove(history.certificate_path)
        except Exception:
            pass

    history.certificate_path = None
    history.certificate_name = None
    db.commit()
    return {"ok": True}
