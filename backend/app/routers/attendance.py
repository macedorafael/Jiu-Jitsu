import json
import os
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Student, TrainingSession, Attendance, UnidentifiedFace, User, ClassSchedule
from app.schemas import (
    SessionResult, AttendanceOut, UnidentifiedFaceOut, SessionOut,
    IdentifyFaceRequest, ChangeAttendanceRequest, RemoveAttendanceRequest,
    ManualSessionCreate, ManualAttendanceAdd,
    DetectResult, TempRecognizedOut, TempUnidentifiedOut,
    ConfirmAttendanceItem, ConfirmSessionCreate,
    StudentAttendanceSummaryOut,
)
from app.auth import require_professor_up, get_current_user
from app.services.face_service import detect_and_crop_faces, get_face_encoding, match_face, save_face_crop, encode_face_from_crop_bytes

router = APIRouter(prefix="/api/sessions", tags=["attendance"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

# Cache em memória para resultados temporários de detecção (antes do confirm)
_temp_sessions: dict[str, dict] = {}


@router.post("/detect", response_model=DetectResult)
async def detect_session(
    file: UploadFile = File(...),
    notes: str = Form(default=""),
    session_date: str = Form(default=""),
    schedule_id: int = Form(default=0),
    flexible_time: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """
    Fase 1: processa a foto, detecta e identifica rostos.
    NÃO salva nada no banco — retorna um temp_id para uso em /confirm.
    """
    contents = await file.read()

    # Salva foto do treino em local temporário (prefixo "tmp_")
    photo_dir = os.path.join(UPLOAD_DIR, "sessions")
    os.makedirs(photo_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or ".jpg")[1]
    temp_id = str(uuid.uuid4())
    photo_path = os.path.join(photo_dir, f"tmp_{temp_id}{ext}")
    with open(photo_path, "wb") as f:
        f.write(contents)

    # Alunos ativos com encoding
    students = (
        db.query(Student)
        .filter(Student.active == True, Student.face_encoding.isnot(None))
        .all()
    )
    students_encodings = [(s.id, json.loads(s.face_encoding)) for s in students]
    students_map = {s.id: s for s in students}

    # Detecta rostos
    faces = detect_and_crop_faces(contents)

    recognized: list[TempRecognizedOut] = []
    unidentified: list[TempUnidentifiedOut] = []
    seen_student_ids: set[int] = set()

    for face_array, _region in faces:
        encoding = get_face_encoding(face_array)
        match = match_face(encoding, students_encodings) if encoding is not None else None
        face_path = save_face_crop(face_array, f"tmp_{temp_id}")

        if match:
            student_id, confidence = match
            if student_id in seen_student_ids:
                continue
            seen_student_ids.add(student_id)
            s = students_map.get(student_id)
            recognized.append(TempRecognizedOut(
                student_id=student_id,
                student_name=s.name if s else "?",
                confidence_score=confidence,
                photo_path=s.photo_path if s else None,
                face_image_path=face_path,
            ))
        else:
            unidentified.append(TempUnidentifiedOut(
                temp_face_id=str(uuid.uuid4()),
                face_image_path=face_path,
            ))

    # Guarda metadados em memória para o /confirm
    _temp_sessions[temp_id] = {
        "photo_path": photo_path,
        "session_date": session_date,
        "schedule_id": schedule_id,
        "flexible_time": flexible_time,
        "notes": notes,
        "professor_id": current_user.id,
        "school_id": current_user.school_id,
    }

    return DetectResult(
        temp_id=temp_id,
        recognized=recognized,
        unidentified=unidentified,
        faces_detected=len(recognized) + len(unidentified),
    )


@router.post("/confirm")
def confirm_session(
    data: ConfirmSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """
    Fase 2: salva a sessão e as presenças confirmadas pelo usuário.
    Recebe o temp_id da fase de detecção e a lista final de alunos.
    """
    temp = _temp_sessions.pop(data.temp_id, None)
    if not temp:
        raise HTTPException(400, "Sessão temporária não encontrada ou expirada. Reprocesse a foto.")

    # Renomeia foto de temporária para definitiva
    old_path: str = temp["photo_path"]
    final_photo_path = old_path.replace(f"tmp_{data.temp_id}", data.temp_id) if f"tmp_{data.temp_id}" in old_path else old_path
    try:
        if old_path != final_photo_path:
            os.rename(old_path, final_photo_path)
    except Exception:
        final_photo_path = old_path  # mantém o caminho original se rename falhar

    # Data da sessão
    parsed_date = date.today()
    if temp.get("session_date"):
        try:
            parsed_date = date.fromisoformat(temp["session_date"])
        except ValueError:
            pass

    resolved_schedule_id = temp.get("schedule_id") or None
    if resolved_schedule_id == 0:
        resolved_schedule_id = None
    resolved_flexible = (temp.get("flexible_time") or "").strip() or None

    # Cria a sessão
    session = TrainingSession(
        professor_id=temp["professor_id"],
        school_id=temp.get("school_id"),
        date=parsed_date,
        training_photo_path=final_photo_path,
        notes=temp.get("notes") or None,
        schedule_id=resolved_schedule_id,
        flexible_time=resolved_flexible,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Cria presenças
    seen_ids: set[int] = set()
    for item in data.attendance:
        if item.student_id in seen_ids:
            continue
        seen_ids.add(item.student_id)

        att = Attendance(
            session_id=session.id,
            student_id=item.student_id,
            confidence_score=item.confidence_score,
        )
        db.add(att)

        # Sempre atualiza a foto do aluno com o recorte mais recente da chamada
        if item.face_image_path:
            student = db.get(Student, item.student_id)
            if student and os.path.exists(item.face_image_path):
                student.photo_path = item.face_image_path
                try:
                    with open(item.face_image_path, "rb") as fh:
                        crop_bytes = fh.read()
                    encoding = encode_face_from_crop_bytes(crop_bytes)
                    if encoding:
                        student.face_encoding = json.dumps(encoding)
                except Exception:
                    pass

    db.commit()
    return {"ok": True, "session_id": session.id, "attendance_count": len(seen_ids)}


@router.post("", response_model=SessionResult)
async def create_session(
    file: UploadFile = File(...),
    notes: str = Form(default=""),
    session_date: str = Form(default=""),
    schedule_id: int = Form(default=0),
    flexible_time: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    contents = await file.read()

    # Save training photo
    photo_dir = os.path.join(UPLOAD_DIR, "sessions")
    os.makedirs(photo_dir, exist_ok=True)
    photo_filename = f"{uuid.uuid4()}{os.path.splitext(file.filename or '.jpg')[1]}"
    photo_path = os.path.join(photo_dir, photo_filename)
    with open(photo_path, "wb") as f:
        f.write(contents)

    parsed_date = date.today()
    if session_date:
        try:
            parsed_date = date.fromisoformat(session_date)
        except ValueError:
            pass

    # Resolve schedule_id (0 = nenhum)
    resolved_schedule_id = schedule_id if schedule_id and schedule_id > 0 else None
    resolved_flexible = flexible_time.strip() or None

    session = TrainingSession(
        professor_id=current_user.id,
        school_id=current_user.school_id,
        date=parsed_date,
        training_photo_path=photo_path,
        notes=notes or None,
        schedule_id=resolved_schedule_id,
        flexible_time=resolved_flexible,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Load all active students with face encodings
    students = db.query(Student).filter(Student.active == True, Student.face_encoding.isnot(None)).all()
    students_encodings = [
        (s.id, json.loads(s.face_encoding)) for s in students if s.face_encoding
    ]

    # Detect faces in the training photo
    faces = detect_and_crop_faces(contents)

    recognized: list[AttendanceOut] = []
    unidentified: list[UnidentifiedFaceOut] = []
    recognized_student_ids: set[int] = set()

    for face_array, region in faces:
        encoding = get_face_encoding(face_array)

        match = match_face(encoding, students_encodings) if encoding is not None else None

        if match:
            student_id, confidence = match
            if student_id in recognized_student_ids:
                continue  # already marked present
            recognized_student_ids.add(student_id)

            att = Attendance(session_id=session.id, student_id=student_id, confidence_score=confidence)
            db.add(att)

            student = db.get(Student, student_id)
            recognized.append(AttendanceOut(
                student_id=student_id,
                student_name=student.name,
                confidence_score=confidence,
                photo_path=student.photo_path,
            ))
        else:
            # Salva o recorte como não identificado mesmo se encoding falhou
            face_path = save_face_crop(face_array, session.id)
            unid = UnidentifiedFace(session_id=session.id, face_image_path=face_path)
            db.add(unid)
            db.flush()
            unidentified.append(UnidentifiedFaceOut(id=unid.id, face_image_path=face_path))

    db.commit()

    return SessionResult(
        session_id=session.id,
        date=session.date,
        recognized=recognized,
        unidentified=unidentified,
        faces_detected=len(faces),
    )


_DAYS_PT = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']


def _session_to_out(s: TrainingSession) -> SessionOut:
    out = SessionOut.model_validate(s)
    out.attendance_count = len(s.attendance)
    out.professor_name = s.professor.name if s.professor else None
    if s.schedule:
        day = _DAYS_PT[s.schedule.day_of_week]
        out.schedule_info = f"{day} {s.schedule.start_time}–{s.schedule.end_time}"
    return out


@router.get("", response_model=list[SessionOut])
def list_sessions(
    student_name: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    from app.models import UserRole
    q = db.query(TrainingSession)
    if current_user.role != UserRole.root:
        q = q.filter(TrainingSession.school_id == current_user.school_id)
    if student_name.strip():
        # Filtra apenas sessões onde o aluno com esse nome tem presença
        q = (
            q.join(Attendance, Attendance.session_id == TrainingSession.id)
             .join(Student, Student.id == Attendance.student_id)
             .filter(Student.name.ilike(f"%{student_name.strip()}%"))
             .distinct()
        )
    sessions = q.order_by(TrainingSession.date.desc()).all()
    return [_session_to_out(s) for s in sessions]


@router.get("/student-summary", response_model=list[StudentAttendanceSummaryOut])
def student_attendance_summary(
    from_date: str = "",
    to_date: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """Retorna contagem de presenças por aluno no período."""
    from sqlalchemy import func
    from app.models import UserRole

    q = (
        db.query(
            Student.id,
            Student.name,
            Student.photo_path,
            Student.belt,
            func.count(Attendance.id).label("attendance_count"),
        )
        .join(Attendance, Attendance.student_id == Student.id)
        .join(TrainingSession, TrainingSession.id == Attendance.session_id)
        .filter(Student.active == True)
    )

    if current_user.role != UserRole.root:
        q = q.filter(TrainingSession.school_id == current_user.school_id)

    if from_date:
        try:
            q = q.filter(TrainingSession.date >= date.fromisoformat(from_date))
        except ValueError:
            pass

    if to_date:
        try:
            q = q.filter(TrainingSession.date <= date.fromisoformat(to_date))
        except ValueError:
            pass

    rows = q.group_by(Student.id).order_by(func.count(Attendance.id).desc(), Student.name).all()

    return [
        StudentAttendanceSummaryOut(
            student_id=r.id,
            student_name=r.name,
            photo_path=r.photo_path,
            belt=r.belt.value if hasattr(r.belt, "value") else str(r.belt),
            attendance_count=r.attendance_count,
        )
        for r in rows
    ]


@router.post("/manual", response_model=SessionOut)
def create_manual_session(
    data: ManualSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    """Cria uma sessão de treino sem foto (entrada manual)."""
    parsed_date = date.today()
    if data.session_date:
        try:
            parsed_date = date.fromisoformat(data.session_date)
        except ValueError:
            pass

    resolved_schedule_id = data.schedule_id if data.schedule_id and data.schedule_id > 0 else None
    resolved_flexible = data.flexible_time.strip() if data.flexible_time else None

    session = TrainingSession(
        professor_id=current_user.id,
        school_id=current_user.school_id,
        date=parsed_date,
        notes=data.notes or None,
        schedule_id=resolved_schedule_id,
        flexible_time=resolved_flexible,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_out(session)


@router.get("/{session_id}", response_model=SessionResult)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_professor_up),
):
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(404, "Sessão não encontrada")

    recognized = [
        AttendanceOut(
            student_id=att.student_id,
            student_name=att.student.name,
            confidence_score=att.confidence_score,
            photo_path=att.student.photo_path,
        )
        for att in session.attendance
    ]
    unidentified = [
        UnidentifiedFaceOut(id=u.id, face_image_path=u.face_image_path)
        for u in session.unidentified_faces
        if u.identified_as_student_id is None
    ]
    return SessionResult(
        session_id=session.id,
        date=session.date,
        recognized=recognized,
        unidentified=unidentified,
        faces_detected=len(session.attendance) + len([u for u in session.unidentified_faces if u.identified_as_student_id is None]),
    )


@router.post("/{session_id}/attendance", response_model=AttendanceOut)
def add_attendance_manual(
    session_id: int,
    data: ManualAttendanceAdd,
    db: Session = Depends(get_db),
    _: User = Depends(require_professor_up),
):
    """Insere presença manual de um aluno em uma sessão."""
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(404, "Sessão não encontrada")

    student = db.get(Student, data.student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")

    existing = db.query(Attendance).filter(
        Attendance.session_id == session_id,
        Attendance.student_id == data.student_id,
    ).first()
    if existing:
        raise HTTPException(409, "Aluno já tem presença nesta sessão")

    att = Attendance(session_id=session_id, student_id=data.student_id, confidence_score=None)
    db.add(att)
    db.commit()
    return AttendanceOut(
        student_id=student.id,
        student_name=student.name,
        confidence_score=None,
        photo_path=student.photo_path,
    )


@router.post("/{session_id}/identify")
def identify_face(
    session_id: int,
    data: IdentifyFaceRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_professor_up),
):
    """Professor identifica uma face não reconhecida e registra presença.
    Se o aluno ainda não tiver foto de referência, o recorte vira a foto dele."""
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(404, "Sessão não encontrada")

    face = db.get(UnidentifiedFace, data.face_id)
    if not face or face.session_id != session_id:
        raise HTTPException(404, "Face não encontrada nesta sessão")

    student = db.get(Student, data.student_id)
    if not student:
        raise HTTPException(404, "Aluno não encontrado")

    face.identified_as_student_id = data.student_id

    # Registra presença se ainda não existe
    existing = db.query(Attendance).filter(
        Attendance.session_id == session_id,
        Attendance.student_id == data.student_id,
    ).first()
    if not existing:
        db.add(Attendance(session_id=session_id, student_id=data.student_id, confidence_score=None))

    # Se o aluno ainda não tem foto de perfil, salva o recorte como referência
    photo_saved = False
    if not student.photo_path and os.path.exists(face.face_image_path):
        # Salva a foto independentemente do encoding
        student.photo_path = face.face_image_path
        photo_saved = True
        # Tenta extrair o encoding também (não crítico)
        try:
            with open(face.face_image_path, "rb") as f:
                crop_bytes = f.read()
            encoding = encode_face_from_crop_bytes(crop_bytes)
            if encoding:
                student.face_encoding = json.dumps(encoding)
        except Exception:
            pass

    db.commit()
    return {"ok": True, "student_name": student.name, "photo_saved": photo_saved}


@router.patch("/{session_id}/attendance")
def change_attendance(
    session_id: int,
    data: ChangeAttendanceRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_professor_up),
):
    """Troca o aluno vinculado a uma presença reconhecida automaticamente."""
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(404, "Sessão não encontrada")

    # Remove presença anterior
    old_att = db.query(Attendance).filter(
        Attendance.session_id == session_id,
        Attendance.student_id == data.from_student_id,
    ).first()
    if old_att:
        db.delete(old_att)

    # Verifica se já existe presença para o novo aluno
    existing = db.query(Attendance).filter(
        Attendance.session_id == session_id,
        Attendance.student_id == data.to_student_id,
    ).first()
    if not existing:
        db.add(Attendance(session_id=session_id, student_id=data.to_student_id, confidence_score=None))

    new_student = db.get(Student, data.to_student_id)
    db.commit()
    return {
        "ok": True,
        "student_name": new_student.name if new_student else "",
        "photo_path": new_student.photo_path if new_student else None,
    }


@router.delete("/{session_id}/attendance")
def remove_attendance(
    session_id: int,
    data: RemoveAttendanceRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_professor_up),
):
    """Remove presença de um aluno de uma sessão (ex: ignorar rosto reconhecido erroneamente)."""
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(404, "Sessão não encontrada")

    att = db.query(Attendance).filter(
        Attendance.session_id == session_id,
        Attendance.student_id == data.student_id,
    ).first()
    if att:
        db.delete(att)
        db.commit()
    return {"ok": True}
