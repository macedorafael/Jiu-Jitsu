from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import os

from app.database import get_db
from app.models import User, UserRole

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.get(User, int(user_id))
    if not user or not user.active:
        raise credentials_exception
    return user


def require_roles(*roles: UserRole):
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Acesso não autorizado")
        return current_user
    return _check


# Helpers de acesso por perfil
require_root         = require_roles(UserRole.root)
require_admin_up     = require_roles(UserRole.root, UserRole.admin, UserRole.admin_especifico)
require_professor_up = require_roles(UserRole.root, UserRole.admin, UserRole.admin_especifico, UserRole.professor)
require_any          = require_roles(UserRole.root, UserRole.admin, UserRole.admin_especifico, UserRole.professor, UserRole.aluno)


def can_create_role(creator: User, target_role: UserRole) -> bool:
    """Check if creator is allowed to create a user with target_role."""
    if creator.role == UserRole.root:
        return True
    if creator.role == UserRole.admin:
        return target_role in (UserRole.admin_especifico, UserRole.professor, UserRole.aluno)
    if creator.role in (UserRole.admin_especifico, UserRole.professor):
        return target_role == UserRole.aluno
    return False


def same_school_or_root(current_user: User, school_id: Optional[int]) -> bool:
    """Returns True if user is root or belongs to the given school."""
    if current_user.role == UserRole.root:
        return True
    return current_user.school_id == school_id
