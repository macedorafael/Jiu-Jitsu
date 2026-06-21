import os
import json
import uuid
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Student, User, UserRole, StudentProfile, Attendance, TrainingSession, ClassSchedule, StudentStatusHistory, School, BeltHistory
from app.schemas import StudentCreate, StudentUpdate, StudentOut, StudentDetail, StudentStatusChange, StudentStatusHistoryOut
from app.auth import require_professor_up, get_current_user, hash_password
from app.services.face_service import encode_face_from_bytes

router = APIRouter(prefix="/api/students", tags=["students"])

# ── Regras de idade mínima (Gracie Barra) ─────────────────────────────────────
# Idade mínima exigida para ser promovido À próxima faixa

# Infantil: idade para RECEBER a próxima faixa
_INFANTIL_NEXT_MIN_AGE: dict[str, Optional[int]] = {
    'white':        None,   # → cinza e branca: qualquer idade
    'grey_white':   None,   # → cinza
    'grey':         None,   # → cinza e preta
    'grey_black':   7,      # → amarela e branca
    'yellow_white': 7,      # → amarela
    'yellow':       7,      # → amarela e preta
    'yellow_black': 10,     # → laranja e branca
    'orange_white': 10,     # → laranja
    'orange':       10,     # → laranja e preta
    'orange_black': 13,     # → verde e branca
    'green_white':  13,     # → verde
    'green':        13,     # → verde e preta
    'green_black':  16,     # → azul (adulto)
}

# Adulto: idade para RECEBER a próxima faixa
_ADULT_NEXT_MIN_AGE: dict[str, Optional[int]] = {
    'white':        16,     # → azul
    'green_white':  13,     # → verde (ainda na progressão verde)
    'green':        13,     # → verde e preta
    'green_black':  16,     # → azul
    'blue':         16,     # → roxa (já tem 16)
    'purple':       18,     # → marrom
    'brown':        19,     # → preta
    'black':        None,   # faixa máxima
}


def _get_min_age_for_promotion(student: Student) -> Optional[int]:
    """Retorna a idade mínima exigida para o aluno ser promovido da faixa atual."""
    belt = str(student.belt.value) if hasattr(student.belt, 'value') else str(student.belt)
    profile = str(student.profile.value) if hasattr(student.profile, 'value') else str(student.profile)
    if profile == 'infantil':
        return _INFANTIL_NEXT_MIN_AGE.get(belt)
    return _ADULT_NEXT_MIN_AGE.get(belt)


def _calc_age(birth_date) -> Optional[int]:
    """Calcula idade atual a partir da data de nascimento."""
    if not birth_date:
        return None
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def _get_target_attendance(school: School, student: Student) -> Optional[int]:
    """Retorna o mínimo de presenças exigido para o aluno ser promovido na faixa atual."""
    belt = str(student.belt.value) if hasattr(student.belt, 'value') else str(student.belt)
    profile = str(student.profile.value) if hasattr(student.profile, 'value') else str(student.profile)

    if profile == 'infantil':
        return school.min_attendance_infantil

    # Adulto: branca → azul
    if belt == 'white':
        return school.min_attendance_blue
    # Variantes verdes (adulto) → progressão interna das faixas verdes (usa meta de coloridas)
    if belt in ('green_white', 'green'):
        return school.min_attendance_infantil
    # verde e preta → azul
    if belt == 'green_black':
        return school.min_attendance_blue
    if belt == 'blue':
        return school.min_attendance_purple
    if belt == 'purple':
        return school.min_attendance_brown
    if belt == 'brown':
        return school.min_attendance_black
    return None  # faixa preta: sem próxima faixa

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


def _school_filter(query, current_user: User):
    """Filtra alunos pela escola do usuário.
    Root sem override vê todos; com override filtra pela escola selecionada."""
    if current_user.school_id is not None:
        query = query.filter(Student.school_id == current_user.school_id)
    if current_user.profile_access and current_user.role in (UserRole.admin_especifico, UserRole.professor):
        query = query.filter(Student.profile == current_user.profile_access)
    return query


def _check_school_access(student: Student, current_user: User):
    """Levanta 403 se o usuário não pertence à mesma escola do aluno."""
    if current_user.school_id is None:
        return  # root sem override: acesso total
    if student.school_id != current_user.school_id:
        raise HTTPException(403, "Acesso não autorizado")


@router.get("/belt-progress")
def get_belt_progress(
    profile: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """Retorna progresso de presenças de cada aluno ativo em relação à próxima graduação."""
    if current_user.school_id is None:
        raise HTTPException(400, "Selecione uma escola para ver o progresso de faixas")

    school = db.get(School, current_user.school_id)
    if not school:
        raise HTTPException(404, "Escola não encontrada")

    q = db.query(Student).filter(Student.active == True)
    q = _school_filter(q, current_user)
    if profile:
        q = q.filter(Student.profile == profile)
    students = q.order_by(Student.name).all()

    result = []
    for student in students:
        # Data de referência: primeira vez que o aluno recebeu a COR da faixa atual
        # (graus/listras dentro da mesma faixa não reiniciam o contador)
        history = (
            db.query(BeltHistory)
            .filter(BeltHistory.student_id == student.id)
            .order_by(BeltHistory.awarded_date.asc())
            .all()
        )
        # Data de referência: entrada mais recente com belt==atual e degree==0 (= promoção de cor).
        # Se não existe (aluno entrou já nessa faixa, sem registro formal), usa enrollment_date.
        since_date: date = student.enrollment_date
        if history:
            for h in reversed(history):
                if h.belt == student.belt and h.degree == 0:
                    since_date = h.awarded_date
                    break

        # Conta presenças desde essa data
        att_count = (
            db.query(Attendance)
            .join(TrainingSession, TrainingSession.id == Attendance.session_id)
            .filter(
                Attendance.student_id == student.id,
                TrainingSession.date >= since_date,
            )
            .count()
        )

        target = _get_target_attendance(school, student)

        photo_url = None
        if student.photo_path:
            p = student.photo_path.replace("\\", "/")
            idx = p.find("uploads/")
            photo_url = f"/{p[idx:]}" if idx != -1 else f"/uploads/{p}"

        student_age = _calc_age(student.birth_date)
        min_age = _get_min_age_for_promotion(student)

        result.append({
            "student_id": student.id,
            "name": student.name,
            "profile": str(student.profile.value),
            "belt": str(student.belt.value),
            "degree": student.degree,
            "photo_url": photo_url,
            "attendance_since_promotion": att_count,
            "target_attendance": target,
            "since_date": since_date.isoformat(),
            "student_age": student_age,
            "min_age_for_promotion": min_age,
        })

    return result


@router.get("", response_model=list[StudentOut])
def list_students(
    active: bool = True,
    profile: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    q = db.query(Student).filter(Student.active == active)
    q = _school_filter(q, current_user)
    if profile:
        q = q.filter(Student.profile == profile)
    return q.order_by(Student.name).all()


@router.post("", response_model=StudentOut)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    # admin_especifico só pode criar alunos do seu perfil de acesso
    if current_user.role == UserRole.admin_especifico and current_user.profile_access:
        if str(data.profile.value) != current_user.profile_access:
            raise HTTPException(403, f"Você só pode cadastrar alunos do perfil '{current_user.profile_access}'")

    # Verifica se já existe usuário com este email
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Já existe um usuário cadastrado com este email")

    # Cria conta de usuário para o aluno (senha padrão: aluno123)
    user_account = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password("aluno123"),
        role=UserRole.aluno,
        school_id=current_user.school_id,
        must_change_password=True,
    )
    db.add(user_account)
    db.flush()  # Garante user_account.id sem commit

    # Cria o registro do aluno vinculado ao usuário e à escola
    # exclude_none=True evita sobrescrever defaults do modelo (ex: enrollment_date)
    student_data = data.model_dump(exclude_none=True)
    student = Student(
        **student_data,
        user_id=user_account.id,
        school_id=current_user.school_id,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get("/{student_id}", response_model=StudentDetail)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")

    # Aluno só pode ver o próprio perfil
    if current_user.role == UserRole.aluno:
        if not current_user.student or current_user.student.id != student_id:
            raise HTTPException(403, "Acesso não autorizado")
    else:
        _check_school_access(student, current_user)

    result = StudentDetail.model_validate(student)
    result.attendance_count = len(student.attendance)
    result.belt_history = student.belt_history
    return result


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    data: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)
    # admin_especifico não pode alterar o perfil do aluno para fora do seu escopo
    if current_user.role == UserRole.admin_especifico and current_user.profile_access:
        if data.profile and str(data.profile.value) != current_user.profile_access:
            raise HTTPException(403, f"Você só pode editar alunos do perfil '{current_user.profile_access}'")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(student, field, value)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=204)
def deactivate_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)
    student.active = False
    db.commit()


_DAYS_PT = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']


@router.get("/{student_id}/attendance-history")
def get_student_attendance_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """Retorna todas as presenças de um aluno com detalhes da sessão."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)

    records = (
        db.query(Attendance)
        .filter(Attendance.student_id == student_id)
        .join(TrainingSession, TrainingSession.id == Attendance.session_id)
        .order_by(TrainingSession.date.desc())
        .all()
    )

    result = []
    for att in records:
        s = att.session
        schedule_info = None
        if s.schedule:
            day = _DAYS_PT[s.schedule.day_of_week]
            schedule_info = f"{day} {s.schedule.start_time}–{s.schedule.end_time}"
        result.append({
            "session_id": s.id,
            "date": s.date.isoformat(),
            "schedule_info": schedule_info or s.flexible_time or "Horário livre",
            "confidence_score": att.confidence_score,
            "auto": att.confidence_score is not None,
        })
    return result


@router.post("/{student_id}/photo", response_model=StudentOut)
async def upload_student_photo(
    student_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)

    contents = await file.read()
    filename = f"{uuid.uuid4()}{os.path.splitext(file.filename or '.jpg')[1]}"
    photo_dir = os.path.join(UPLOAD_DIR, "photos")
    os.makedirs(photo_dir, exist_ok=True)
    photo_path = os.path.join(photo_dir, filename)

    with open(photo_path, "wb") as f:
        f.write(contents)

    encoding = encode_face_from_bytes(contents)
    if encoding is None:
        os.remove(photo_path)
        raise HTTPException(400, "Nenhum rosto detectado na foto. Use uma foto com o rosto bem visível.")

    student.photo_path = photo_path
    student.face_encoding = json.dumps(encoding)
    db.commit()
    db.refresh(student)
    return student


@router.post("/{student_id}/status", response_model=StudentStatusHistoryOut)
def change_student_status(
    student_id: int,
    data: StudentStatusChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """Muda o status do aluno (ativo/pausado) e registra no histórico."""
    if data.status not in ("ativo", "pausado"):
        raise HTTPException(400, "Status deve ser 'ativo' ou 'pausado'")

    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)

    novo_ativo = data.status == "ativo"
    student.active = novo_ativo

    # Sincroniza o usuário vinculado
    if student.user_id:
        user = db.get(User, student.user_id)
        if user:
            user.active = novo_ativo

    # Registra histórico
    hist = StudentStatusHistory(
        student_id=student_id,
        changed_by_id=current_user.id,
        new_status=data.status,
        observation=data.observation or None,
    )
    db.add(hist)
    db.commit()
    db.refresh(hist)

    return StudentStatusHistoryOut(
        id=hist.id,
        new_status=hist.new_status,
        observation=hist.observation,
        changed_by_name=current_user.name,
        created_at=hist.created_at,
    )


@router.get("/{student_id}/status-history", response_model=list[StudentStatusHistoryOut])
def get_status_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")
    _check_school_access(student, current_user)

    records = (
        db.query(StudentStatusHistory)
        .filter(StudentStatusHistory.student_id == student_id)
        .order_by(StudentStatusHistory.created_at.desc())
        .all()
    )
    return [
        StudentStatusHistoryOut(
            id=r.id,
            new_status=r.new_status,
            observation=r.observation,
            changed_by_name=r.changed_by.name if r.changed_by else "—",
            created_at=r.created_at,
        )
        for r in records
    ]
