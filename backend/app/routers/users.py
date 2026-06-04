from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.schemas import UserCreate, UserUpdate, UserOut
from app.auth import (
    hash_password, get_current_user, require_professor_up,
    can_create_role, same_school_or_root,
)

router = APIRouter(prefix="/api/users", tags=["users"])


def _school_required(role: UserRole, school_id):
    """Valida que usuários não-root tenham escola associada."""
    if role != UserRole.root and not school_id:
        raise HTTPException(400, "Usuários com este perfil precisam ter uma escola associada")


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    q = db.query(User)

    # Root sem override vê todos; com override filtra pela escola selecionada
    if current_user.school_id is not None:
        q = q.filter(User.school_id == current_user.school_id)

    # Professor vê apenas alunos (e ele mesmo)
    if current_user.role == UserRole.professor:
        q = q.filter(
            (User.role == UserRole.aluno) | (User.id == current_user.id)
        )

    users = q.order_by(User.name).all()
    return [UserOut.from_user(u) for u in users]


@router.post("", response_model=UserOut)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    # Alunos são criados automaticamente ao cadastrar um aluno na tela de Alunos
    if data.role == UserRole.aluno:
        raise HTTPException(
            400,
            "Usuários do tipo 'aluno' são criados automaticamente ao cadastrar um aluno. "
            "Acesse o menu Alunos para adicionar um novo aluno.",
        )

    if not can_create_role(current_user, data.role):
        raise HTTPException(403, f"Você não tem permissão para criar usuários com perfil '{data.role}'")

    # Não-root: escola obrigatória e deve ser a mesma do criador
    if data.role != UserRole.root:
        if not data.school_id:
            # Herda a escola do criador se não informado
            data.school_id = current_user.school_id
        if current_user.role != UserRole.root and data.school_id != current_user.school_id:
            raise HTTPException(403, "Você só pode criar usuários na sua própria escola")
        _school_required(data.role, data.school_id)

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email já cadastrado")

    # admin_especifico obrigatoriamente precisa de profile_access
    if data.role == UserRole.admin_especifico and not data.profile_access:
        raise HTTPException(400, "admin_especifico precisa ter um perfil de acesso (adulto ou infantil)")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        school_id=data.school_id,
        profile_access=data.profile_access if data.role == UserRole.admin_especifico else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.from_user(user)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Usuário não encontrado")

    # Aluno só pode ver a si mesmo
    if current_user.role == UserRole.aluno and current_user.id != user_id:
        raise HTTPException(403, "Acesso não autorizado")

    # Demais só veem da mesma escola (exceto root)
    if not same_school_or_root(current_user, user.school_id):
        raise HTTPException(403, "Acesso não autorizado")

    return UserOut.from_user(user)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Usuário não encontrado")

    # Só pode editar usuários da mesma escola (exceto root)
    if not same_school_or_root(current_user, user.school_id):
        raise HTTPException(403, "Acesso não autorizado")

    # Professor só pode editar alunos
    if current_user.role == UserRole.professor and user.role != UserRole.aluno:
        raise HTTPException(403, "Professores só podem editar alunos")

    # Não permite rebaixar/promover além do permitido
    if data.role and not can_create_role(current_user, data.role):
        raise HTTPException(403, f"Você não pode atribuir o perfil '{data.role}'")

    for field, value in data.model_dump(exclude_none=True).items():
        if field == "password":
            user.password_hash = hash_password(value)
        else:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return UserOut.from_user(user)


@router.delete("/{user_id}", status_code=204)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_professor_up),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Usuário não encontrado")

    if user.id == current_user.id:
        raise HTTPException(400, "Você não pode desativar sua própria conta")

    if not same_school_or_root(current_user, user.school_id):
        raise HTTPException(403, "Acesso não autorizado")

    if current_user.role == UserRole.professor and user.role != UserRole.aluno:
        raise HTTPException(403, "Professores só podem desativar alunos")

    user.active = False
    db.commit()
